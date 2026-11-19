// tests/lib/boot.ts: the one way tests load the pages in site/.
//
//   SITE, sitePath(name)        where the deployable files live (site/, or $KC_SITE)
//   readPage(nameOrPath)        page HTML ready for jsdom, which runs no module script and loads no stylesheet: its
//                               bundle (assets/<page>-<hash>.js, P1-09d, P1-06b) as a classic script at the end of the body, strict as
//                               a module is; its stylesheet inline where its <link> was; its local classic scripts
//                               (kc-config.js, kc-staging-footer.js) inlined; the supabase-js <script> removed
//   pageFiles(nameOrPath)       the files readPage reads for that page: the page, then each file it inlines
//   bootJsdom(html, opts)       a jsdom with the page's scripts running and a Supabase stub installed
//   serve(dir, port)            a static file server for Chromium (as the pages are deployed: one folder)
//   routeExternal(target, cdn)  answers supabase-js with a stub, kc-config.js with a dead address and fonts with nothing
//                               (Playwright page/context)
//   DB_VERSION                  the newest migration in supabase/migrations/: the database version every
//                               stand-in database reports through rpc('kc_db_version') (P0-34), unless a test
//                               says otherwise (bootJsdom's opts.dbVersion)
//
// Fixed seed: when KC_SEED is set (npm test sets it), this Node process's Math.random is replaced by a seeded sfc32
// generator (for a harness's own random orders), and every page booted with bootJsdom is given a seed: its dice,
// kcRng() (src/engine/rng.ts, P1-07), are the same sfc32 generator seeded the same way. Same seed, same random
// sequence. bootJsdom's opts.seed and opts.now pin one page completely: its dice and its clock (P1-01a). A page given
// no seed seeds its dice from crypto.getRandomValues, as on the live site.
//
// Plain Node runs this file as it is (its types are stripped), so the old JavaScript scripts in tests/*.test.js can
// require it: it uses only TypeScript that can be erased (no enum, no namespace, no parameter property).
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { BrowserContext, Page } from '@playwright/test';
import type { Db } from '../../src/db/the-db-interface-and-its-areas.ts';
import type * as TheDatabaseCallRecorder from '../../tools/proof/every-database-call-a-page-makes.ts';

// jsdom loads only when a page is booted, and the database-call recorder only when asked for: a test that only reads
// a page doesn't load jsdom.
const requireFromHere = createRequire(import.meta.url);

/** A page's window as a test reaches it: run code in the page, read and set its globals. */
export interface PageWindow {
  eval(code: string): unknown;
  close(): void;
  addEventListener(type: 'error', listener: (e: { error?: { stack?: string }; message: string }) => void): void;
  onunhandledrejection: ((e: { reason: unknown }) => void) | null;
  console: Record<'log' | 'warn' | 'error', (...args: unknown[]) => void>;
  [global: string]: unknown;
}

/** The page's dice (src/engine/rng.ts): the next number in [0, 1). `seed(n)` starts again from seed n; `use(fn)` draws
 *  from fn from now on and returns what it drew from before, to restore. */
export interface KcRng {
  (): number;
  seed(seed: number): void;
  use(fn: () => number): () => number;
}

/** What rpc('kc_db_version') answers (withDbVersion below): a version, null, 'offline', or a list of those. */
type TheDatabaseVersionAnswers = string | null | (string | null)[];

export interface BootOptions {
  supabase?: unknown;
  setup?: (w: PageWindow) => void;
  url?: string;
  pretendToBeVisual?: boolean;
  dbVersion?: TheDatabaseVersionAnswers;
  dbCalls?: string[];
  /** A Db the page takes as its own (its fake, tests/lib/fake-db.ts), handed in before the page's scripts run. */
  db?: Db;
  /** The seed of the page's dice (kcRng, src/engine/rng.ts; its Math.random gets the same seed). */
  seed?: number;
  /** Pins the page's clock: starts here (ms since 1970, or a date string), 1 ms on at each reading. */
  now?: number | string;
}

/** jsdom's console for the page: its own messages ("jsdomError", e.g. "Not implemented: navigation…" when the page
 *  reloads, which jsdom can't do) are printed by default; a test may take them over. */
export interface PageVirtualConsole {
  removeAllListeners(event: 'jsdomError'): unknown;
  on(event: 'jsdomError', listener: (e: { message: string }) => void): unknown;
}

/** The page's window before its scripts run (jsdom's beforeParse): the names bootJsdom sets on it. */
interface ThePageWindowBeforeItsScriptsRun extends PageWindow {
  KC_RNG_SEED: number;
  Math: Math;
  Date: DateConstructor;
  supabase: unknown;
  kcTheDbATestHandsThePage: Db;
  confirm: () => boolean;
  alert: () => void;
}

/** The part of jsdom bootJsdom uses (jsdom ships no types, and @types/jsdom isn't installed). */
interface TheJsdomPackageAsBootJsdomUsesIt {
  JSDOM: new (
    html: string,
    options: {
      runScripts: 'dangerously';
      pretendToBeVisual: boolean;
      url: string;
      beforeParse(w: ThePageWindowBeforeItsScriptsRun): void;
    },
  ) => { window: PageWindow; virtualConsole: PageVirtualConsole };
}

/** A stand-in supabase (a test's): its createClient makes a client with rpc(), and from() if the test needs it. */
interface AStandInSupabaseClient {
  rpc: (fn: string, ...args: unknown[]) => unknown;
  from?: (table: string, ...args: unknown[]) => unknown;
}
interface AStandInSupabase {
  createClient: (...args: unknown[]) => AStandInSupabaseClient;
}
/** The check withDbVersion has always made: anything with a createClient function is taken as a stand-in supabase. */
function hasCreateClient(supabase: unknown): supabase is AStandInSupabase {
  return (
    (typeof supabase === 'object' || typeof supabase === 'function') &&
    supabase !== null &&
    'createClient' in supabase &&
    typeof supabase.createClient === 'function'
  );
}

// KC_SITE points the tests at another copy of the site (e.g. a deliberately broken one).
// An empty KC_SITE counts as none, as it always has.
const KC_SITE = process.env['KC_SITE'];
export const SITE = path.resolve(
  KC_SITE === undefined || KC_SITE === '' ? path.join(import.meta.dirname, '..', '..', 'site') : KC_SITE,
);
export const sitePath = (name: string) => path.join(SITE, name);

// A <script src="…"> naming a plain file beside the page (no "/" or ":"), e.g. kc-config.js.
const LOCAL_TAG = /<script src="([A-Za-z0-9._-]+\.js)"><\/script>/g;
// The page's bundle and its stylesheet, as Vite writes their tags (tools/build.ts, P1-09d).
const BUNDLE_TAG = /[ \t]*<script type="module" crossorigin src="\.\/(assets\/[A-Za-z0-9._-]+\.js)"><\/script>\n?/g;
const STYLE_TAG = /<link rel="stylesheet" crossorigin href="\.\/(assets\/[A-Za-z0-9._-]+\.css)">/g;
// supabase-js: site/assets/supabase-js-<hash>.js, the npm package's browser build, since P1-17b; site/vendor/supabase-js-
// <version>.min.js from P0-18; a CDN before (both still removed, so KC_SITE can point at an older copy of the site).
// Tests install a stand-in instead.
const SUPABASE_TAG =
  /<script src="(?:\.\/assets\/supabase-js-[^"]*|vendor\/supabase-js-[^"]*|https:\/\/cdn\.jsdelivr[^"]*)"><\/script>/g;

// A name ('kingdoms-call-gm-portal.html') is looked up in site/; a path is used as given. Local scripts are
// the ones beside the page, as when deployed (jsdom doesn't fetch them itself).
const pageFile = (nameOrPath: string) => (/[\\/]/.test(nameOrPath) ? nameOrPath : sitePath(nameOrPath));
export function readPage(nameOrPath: string): string {
  const file = pageFile(nameOrPath);
  const beside = (src: string) => path.join(path.dirname(file), src);
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(LOCAL_TAG, (tag: string, src: string) => {
    const local = beside(src);
    return fs.existsSync(local) ? '<script>' + fs.readFileSync(local, 'utf8') + '</script>' : tag;
  });
  html = html.replace(
    STYLE_TAG,
    (tag: string, href: string) => '<style>\n' + fs.readFileSync(beside(href), 'utf8') + '</style>',
  );
  // A module script runs once the document is parsed, after the classic scripts, in strict mode: its classic stand-in
  // goes last in the body, "use strict" first.
  const bundles: string[] = [];
  html = html.replace(BUNDLE_TAG, (tag: string, src: string) => {
    bundles.push(fs.readFileSync(beside(src), 'utf8'));
    return '';
  });
  if (bundles.length) {
    const end = html.lastIndexOf('</body>');
    if (end < 0) throw new Error(file + ': no </body> to put its bundle before');
    html =
      html.slice(0, end) + bundles.map((b) => '<script>"use strict";\n' + b + '</script>\n').join('') + html.slice(end);
  }
  return html.replace(SUPABASE_TAG, '');
}

// The files readPage reads for a page, as full paths: the page, then each file it inlines (its stylesheet, its local
// scripts, its bundle). The balance runner checks the GM page's sources are all engine paths
// (tools/balance/engine-paths.ts), so CI plays the matrix when one changes.
export function pageFiles(nameOrPath: string): string[] {
  const file = pageFile(nameOrPath);
  const html = fs.readFileSync(file, 'utf8');
  const named = [STYLE_TAG, LOCAL_TAG, BUNDLE_TAG].flatMap((re) =>
    [...html.matchAll(re)].map((m) => path.join(path.dirname(file), m[1] ?? '')),
  );
  return [file, ...named.filter((f) => fs.existsSync(f))];
}

// sfc32, seeded through splitmix32 so nearby seeds give unrelated streams. The page's kcRng (src/engine/rng.ts) is the
// same generator, seeded the same way (tests/unit/rng.test.ts).
export function seededRandom(seed: number | string): () => number {
  let s = Number(seed) >>> 0 || 1;
  const mix = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = mix(),
    b = mix(),
    c = mix(),
    d = mix();
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
// The pages check the database's version before their first read (src/db/kc-db-guard.ts, bundled into each page).
// Every stand-in database answers it as an up-to-date database would: the newest migration in the repo.
const NEWEST_MIGRATION = fs
  .readdirSync(path.join(import.meta.dirname, '..', '..', 'supabase', 'migrations'))
  .map((f) => (/^(\d{14})_/.exec(f) ?? [])[1])
  .filter((version): version is string => Boolean(version))
  .sort()
  .pop();
if (NEWEST_MIGRATION === undefined) throw new Error('tests/lib/boot.ts: no migration in supabase/migrations/');
export const DB_VERSION: string = NEWEST_MIGRATION;

// Wraps a stand-in `supabase` so its clients answer rpc('kc_db_version'). `answers`: a version, null (no such
// function: a database from before P0-34), 'offline' (no answer at all), or a list of those, used in order (the
// last one repeats). `calls` (optional) records every from()/rpc() the page makes, by name.
export function withDbVersion(
  supabase: unknown,
  answers: TheDatabaseVersionAnswers = DB_VERSION,
  calls?: string[],
): unknown {
  if (!supabase || !hasCreateClient(supabase)) return supabase;
  const list = Array.isArray(answers) ? answers.slice() : [answers];
  const next = () => (list.length > 1 ? list.shift() : list[0]);
  return {
    ...supabase,
    createClient(...args: unknown[]) {
      const c = supabase.createClient(...args),
        rpc = c.rpc,
        from = c.from;
      c.rpc = (fn, ...a) => {
        if (calls) calls.push('rpc:' + fn);
        if (fn !== 'kc_db_version') return rpc.call(c, fn, ...a);
        const v = next();
        if (v === 'offline')
          return Promise.resolve({ data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 });
        if (v === null)
          return Promise.resolve({
            data: null,
            status: 404,
            error: {
              code: 'PGRST202',
              message: 'Could not find the function public.kc_db_version without parameters in the schema cache',
            },
          });
        return Promise.resolve({ data: v, error: null, status: 200 });
      };
      if (calls && typeof from === 'function')
        c.from = (t, ...a) => {
          calls.push('from:' + t);
          return from.call(c, t, ...a);
        };
      // P1-17's proof: with KC_RECORD_DATABASE_CALLS set, every call recorded (tools/proof/every-database-call-a-page-makes.ts)
      return process.env['KC_RECORD_DATABASE_CALLS']
        ? // `as`: require() gives no type; the type is the recorder's own module's.
          (
            requireFromHere('../../tools/proof/every-database-call-a-page-makes.ts') as typeof TheDatabaseCallRecorder
          ).recordEveryDatabaseCall(c, args)
        : c;
    },
  };
}

// A Date that starts at `now` and moves on 1 ms at every reading (new Date(), Date.now(), Date()), so a page's
// clock is the same on every run and two readings never tie. Dates built from a value are ordinary. The engine's
// kcClock() (src/engine/clock.ts, P1-07) reads it.
export function pinnedDate(RealDate: DateConstructor, now: number | string): DateConstructor {
  let t = typeof now === 'number' ? now : RealDate.parse(now);
  if (!Number.isFinite(t)) throw new Error('bootJsdom: opts.now is not a time: ' + String(now));
  const tick = () => t++;
  function PinnedDate(...args: unknown[]) {
    // TypeScript types new.target as undefined in a plain function (it can't call one with new); the page's code can.
    const calledWithNew: unknown = new.target;
    if (!calledWithNew) return new RealDate(tick()).toString();
    // `as`: the page's own arguments go on to Date as they came; TypeScript can't spread a list into Date's overloads.
    return args.length ? new RealDate(...(args as ConstructorParameters<DateConstructor>)) : new RealDate(tick());
  }
  PinnedDate.prototype = RealDate.prototype;
  PinnedDate.now = tick;
  PinnedDate.parse = RealDate.parse;
  PinnedDate.UTC = RealDate.UTC;
  // `as`: a function that answers both a call and `new` is a DateConstructor, but TypeScript can't see a function as one.
  return PinnedDate as unknown as DateConstructor;
}

const SEED = process.env['KC_SEED'];
let bootCount = 0;
if (SEED != null && SEED !== '') Math.random = seededRandom(SEED);

// opts.supabase   the object installed as window.supabase (e.g. {createClient:()=>({})})
// opts.setup(w)   the harness's own beforeParse lines (error capture, console handling, overrides)
// opts.url, opts.pretendToBeVisual   jsdom options; defaults match the original harnesses
// opts.dbVersion, opts.dbCalls         what rpc('kc_db_version') answers, and a list recording the page's
//                                      database calls (withDbVersion above); by default an up-to-date database
// opts.db         a Db the page takes as its own (its fake: tests/lib/fake-db.ts), set on the window under the name
//                 src/db/the-pages-database-client.ts reads (THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER)
// opts.seed       the seed of the page's dice, kcRng (by default each page booted gets its own stream from KC_SEED). The
//                 page's Math.random gets the same seed, for any code outside src/. A test fixes dice in a page that
//                 has booted through kcRng.seed(n) or kcRng.use(fn) (docs/traps.md, "Dice come from kcRng()")
// opts.now        pins the page's clock: Date and Date.now start at this time (ms since 1970, or a date
//                 string) and move on 1 ms each time the page reads it (pinnedDate below)
export function bootJsdom(
  html: string,
  opts: BootOptions = {},
): { window: PageWindow; virtualConsole: PageVirtualConsole } {
  // `as`: require() gives no type, and jsdom ships none; the type is the part of jsdom used here.
  const { JSDOM } = requireFromHere('jsdom') as TheJsdomPackageAsBootJsdomUsesIt;
  const n = bootCount++;
  return new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: opts.pretendToBeVisual ?? true,
    url: opts.url === undefined || opts.url === '' ? 'https://example.org/' : opts.url,
    beforeParse(w) {
      const seed = opts.seed ?? (SEED != null && SEED !== '' ? (Number(SEED) >>> 0) + 0x10000 * (n + 1) : null);
      if (seed != null) {
        w.KC_RNG_SEED = seed;
        w.Math.random = seededRandom(seed);
      }
      if (opts.now != null) w.Date = pinnedDate(w.Date, opts.now);
      if (opts.supabase) w.supabase = opts.supabase;
      if (opts.db) w.kcTheDbATestHandsThePage = opts.db;
      w.confirm = () => true;
      w.alert = () => undefined;
      if (opts.setup) opts.setup(w);
      w.supabase = withDbVersion(w.supabase, 'dbVersion' in opts ? opts.dbVersion : DB_VERSION, opts.dbCalls);
    },
  });
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.csv': 'text/csv',
};
/** A static file server for Chromium: the folder as deployed. `url` is where it listens (http://127.0.0.1:<port>). */
export function serve(dir = SITE, port = 0): Promise<http.Server & { url: string }> {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    // A server's request always has its url (only a client's response has none); split always gives a first part.
    const f = path.join(root, decodeURIComponent((req.url ?? '').split('?')[0] ?? '').replace(/^\/+/, ''));
    if (!f.startsWith(root) || !fs.existsSync(f) || !fs.statSync(f).isFile()) {
      res.writeHead(404);
      return res.end('no');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  return new Promise((r) =>
    server.listen(port, '127.0.0.1', () => {
      // `as`: a server listening on a port (not a pipe) gives its address as an AddressInfo.
      r(Object.assign(server, { url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}` }));
    }),
  );
}

// The stub's clients answer rpc('kc_db_version') with DB_VERSION, as withDbVersion does in jsdom.
const dbVersionPatch = (v: string) =>
  `;(function(){var s=window.supabase;if(!s||!s.createClient)return;var mk=s.createClient;` +
  `window.supabase=Object.assign({},s,{createClient:function(){var c=mk.apply(s,arguments),rpc=c.rpc;` +
  `c.rpc=function(fn){return fn==='kc_db_version'?Promise.resolve({data:${JSON.stringify(v)},error:null,status:200}):rpc.apply(c,arguments);};return c;}});})();`;
// kc-config.js names a database address that never answers (.invalid is never a real name), so a page whose stand-in
// route missed makes the real client and fails, and reaches no database (P1-17b).
const NO_DATABASE = 'http://no-database.invalid';
/** Answers supabase-js with `stubBody` (a script), kc-config.js with a database address that never answers, and Google
 *  Fonts with nothing, in a Playwright page or context. */
export async function routeExternal(target: Page | BrowserContext, stubBody: string): Promise<void> {
  const stub = (r: Parameters<Parameters<Page['route']>[1]>[0]) =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: stubBody + dbVersionPatch(DB_VERSION) });
  await target.route('**/kc-config.js', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `const KC_CONFIG=Object.freeze({env:'test',supabaseUrl:${JSON.stringify(NO_DATABASE)},supabaseKey:'test-key'});`,
    }),
  );
  await target.route('**/assets/supabase-js-*.js', stub);
  await target.route('**/vendor/supabase-js-*.js', stub);
  await target.route('**cdn.jsdelivr.net/**', stub);
  await target.route('**unpkg.com/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  );
  await target.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await target.route('**fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, body: '' }));
}
