// npm run build (plan P1-09d): Vite builds the site from src/ into site/. site/ is build output, not in git: it is what
// GitHub Pages publishes (deploy.yml), what staging publishes (staging.yml), and what every test opens. The test runs
// build it first (tests/setup/global.ts, tools/balance/run.ts), so they never open stale pages.
//
// Every src/*.html is a page. Each is built on its own (P1-09's Decision 8), so its bundle stands alone: one script,
// assets/<page>-<hash>.js, with no import left (jsdom runs no module script, so tests/lib/boot.js inlines it as a
// classic one), and one stylesheet, assets/<page>-<hash>.css. public/ is copied as it is: kc-config.js (staging overwrites it),
// kc-staging-footer.js and vendor/. The options, in one place for the build and the dev server (tools/dev.ts):
// - minify: false: a live error's stack keeps the code's names, and the size is what it was;
// - target esnext and no module preload: the code is left as written, and nothing is added to the page;
// - names with a hash of the file's content (assets/<page>-<hash>.js, P1-06b): a change gives the file a new name, an
//   unchanged file keeps its own (and the browser its cached copy). A page cached before a deploy still names the old
//   file, so the deploy keeps it (tools/deploy/keep-the-previous-deploys-files.ts, run by the build jobs). The bytes,
//   and so the names, are the same on every build of the same src/ run from the folder that holds it: Rolldown names
//   each module in a bundle (//#region src/…) from the folder it runs in;
// - no constant written in where it is read (Rolldown's inlineConst, on by default): every constant keeps its name, so
//   the code reads as written and a test can still reach one. Rolldown (Vite's bundler) still leaves out a function or
//   constant that nothing reaches (it can't be turned off for a page: Vite treats a page as having no exports), writes
//   each top-level const, let and class as a var, and lays the code out its own way.
// After Vite, each page gets its version (P1-06c): the build line where its template has the marker <!--kc-build-->
// (the footers of the four pages that use the database), `build <7-character commit> · <date and time, New Zealand>`,
// and two metas, kc-build (the commit) and kc-page-version (the page's fingerprint: the first 12 hex digits of the
// SHA-256 of its HTML before these are filled in; the HTML names its hashed files, so the fingerprint changes exactly
// when the page or one of its files does). version.json, beside the pages, lists the commit, its time and every page's
// fingerprint: open pages read it (src/ui/shared/a-newer-version-of-this-page.ts). The commit and its time are git's
// (`git log -1` in the folder that holds src/), so the same commit always builds the same bytes; KC_BUILD_COMMIT and
// KC_BUILD_TIME override them; with no git, "build unknown". The bundles never hold the commit, so their names change
// only with their code.
// Vite builds into a new temporary folder; then site/ gets only what changed, each file through a temporary file, and
// loses what is no longer made. So a test reading site/ while another run builds it never sees half a file.
//
//   node tools/build.ts [out]     out: the folder to build into (default: site/ beside src/)
//
// build(out, src) does the same from another script and waits for it (it runs this file in a child process: Vite's
// build is asynchronous); buildSite(out, src) is the asynchronous build itself.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build as viteBuild, createLogger, type InlineConfig, type Logger } from 'vite';

export const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = path.join(ROOT, 'site');
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');

/** The files under `dir`, as paths relative to it with "/" between folders, sorted. */
export function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

/** The pages: every .html file at the top of `src`. */
const pagesIn = (src: string) =>
  fs
    .readdirSync(src)
    .filter((f) => f.endsWith('.html'))
    .sort();

// Vite says a <script src> without type="module" can't be bundled: those are the classic scripts in public/
// (kc-config.js, the staging footer, supabase-js), loaded as they are, on purpose. Any other warning is printed.
const CLASSIC_SCRIPT = /<script src="[^"]+"> in "[^"]+" can't be bundled without type="module" attribute/;
function quietAboutClassicScripts(): Logger {
  const logger = createLogger('warn');
  const warn = logger.warn.bind(logger);
  logger.warn = (msg, options) => {
    if (!CLASSIC_SCRIPT.test(msg)) warn(msg, options);
  };
  return logger;
}

/** The bundler's options for the site's code and for the engine's bundle (tests/lib/engine.ts): no constant written in
 *  where it is read. */
export const KEEP_THE_CODE = { optimization: { inlineConst: false } } as const;

/** Vite's options for the site, shared by the build (one page at a time) and the dev server (tools/dev.ts). */
export function siteOptions(src = SRC, pub = PUBLIC): InlineConfig {
  return {
    configFile: false,
    root: src,
    publicDir: pub,
    base: './',
    logLevel: 'warn',
    customLogger: quietAboutClassicScripts(),
    build: { minify: false, target: 'esnext', modulePreload: false },
  };
}

/** The options for one page's build into `out`. */
function pageOptions(page: string, out: string, src: string, pub: string, first: boolean): InlineConfig {
  const site = siteOptions(src, pub);
  return {
    ...site,
    // Only the first page's build copies public/: the others would copy the same files again.
    publicDir: first ? pub : false,
    build: {
      ...site.build,
      outDir: out,
      emptyOutDir: first,
      rolldownOptions: {
        ...KEEP_THE_CODE,
        input: { [page.replace(/\.html$/, '')]: path.join(src, page) },
        output: { entryFileNames: 'assets/[name]-[hash].js', assetFileNames: 'assets/[name]-[hash][extname]' },
      },
    },
  };
}

/** The marker a template puts where its build line goes. */
export const BUILD_LINE_MARKER = '<!--kc-build-->';
/** The file the build writes beside the pages: the deploy's commit and every page's fingerprint. */
export const VERSION_FILE = 'version.json';

/** What a build is built from: the commit (a hex hash, "unknown" with no git, or "dev" on the dev server) and its
 *  time (ISO), or null. */
export interface BuildVersion {
  commit: string;
  time: string | null;
}

/** The commit `src` is built from and its time: git's in the folder that holds `src`, unless KC_BUILD_COMMIT or
 *  KC_BUILD_TIME in `env` says otherwise. Throws on a KC_BUILD_COMMIT that isn't a hex hash or a KC_BUILD_TIME that
 *  isn't a time. */
export function buildVersionOf(src: string, env: NodeJS.ProcessEnv = process.env): BuildVersion {
  const given = (name: string) => (env[name] === '' ? undefined : env[name]);
  let commit = given('KC_BUILD_COMMIT');
  let time = given('KC_BUILD_TIME');
  if (commit !== undefined && !/^[0-9a-f]{7,40}$/.test(commit))
    throw new Error(`KC_BUILD_COMMIT is ${commit}: a commit's hash (7 to 40 hex digits) was expected`);
  if (time !== undefined && !Number.isFinite(Date.parse(time)))
    throw new Error(`KC_BUILD_TIME is ${time}: a time (ISO 8601) was expected`);
  if (commit === undefined || time === undefined) {
    const git = spawnSync('git', ['log', '-1', '--format=%H%n%cI'], { cwd: path.dirname(src), encoding: 'utf8' });
    const [hash, when] = git.status === 0 ? git.stdout.trim().split('\n') : [];
    if (hash && /^[0-9a-f]{40}$/.test(hash) && when) {
      commit ??= hash;
      time ??= when;
    }
  }
  return { commit: commit ?? 'unknown', time: time ?? null };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NEW_ZEALAND = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Pacific/Auckland',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** The footer's build line: "build 3f2a9c1 · 22 Oct 2026, 10:15" (New Zealand time), "build unknown", "build dev". */
export function buildLine({ commit, time }: BuildVersion): string {
  if (!/^[0-9a-f]{7,40}$/.test(commit)) return `build ${commit}`;
  if (time === null) return `build ${commit.slice(0, 7)}`;
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    NEW_ZEALAND.formatToParts(new Date(time)).find((p) => p.type === type)?.value ?? '';
  const when = `${String(Number(part('day')))} ${MONTHS[Number(part('month')) - 1] ?? ''} ${part('year')}, ${part('hour')}:${part('minute')}`;
  return `build ${commit.slice(0, 7)} · ${when}`;
}

/** A page's fingerprint: the first 12 hex digits of the SHA-256 of its built HTML, before its version is filled in. */
export const fingerprintOf = (html: string): string => createHash('sha256').update(html).digest('hex').slice(0, 12);

/** `html` with its version filled in: the build line for the marker, and the metas kc-build and (given a fingerprint)
 *  kc-page-version before </head>. */
export function withVersion(html: string, version: BuildVersion, fingerprint: string | null): string {
  const end = html.indexOf('</head>');
  if (end < 0) throw new Error('a page with no </head> to put its version metas before');
  const metas =
    `<meta name="kc-build" content="${version.commit}">\n` +
    (fingerprint === null ? '' : `<meta name="kc-page-version" content="${fingerprint}">\n`);
  return (html.slice(0, end) + metas + html.slice(end)).replaceAll(BUILD_LINE_MARKER, buildLine(version));
}

export interface BuildResult {
  /** The files made. */
  files: number;
  /** Those written into the output folder (new or changed), and those removed from it. */
  written: string[];
  removed: string[];
  /** For each page, the files under src/ its bundle is built from (Rolldown's list of the bundle's modules: the
   *  template, the stylesheet it imports and every module; none for a page with no script), relative to src/, sorted. */
  modules: Record<string, string[]>;
}

/** Builds the site from `src` (and `pub`, copied as it is) into `out`: writes what changed, removes what is no longer
 *  made. */
export async function buildSite(out = SITE, src = SRC, pub = PUBLIC): Promise<BuildResult> {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-build-'));
  try {
    const pages = pagesIn(src);
    if (!pages.length) throw new Error(`${src}: no page (no .html file at the top)`);
    let first = true;
    // Rolldown names each module by its real path (macOS's /tmp is /private/tmp).
    const realSrc = fs.realpathSync(src);
    const modules: Record<string, string[]> = {};
    for (const page of pages) {
      const result = await viteBuild(pageOptions(page, temp, src, pub, first));
      first = false;
      const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => ('output' in r ? r.output : []));
      modules[page] = [
        ...new Set(
          outputs
            .flatMap((o) => (o.type === 'chunk' ? o.moduleIds : []))
            .map((id) => path.relative(realSrc, id.replace(/\?.*$/, '')).split(path.sep).join('/'))
            .filter((f) => !f.startsWith('..') && !f.includes('\0')),
        ),
      ].sort();
    }
    // Each page's version (P1-06c), then version.json beside the pages.
    const version = buildVersionOf(src);
    const fingerprints: Record<string, string> = {};
    for (const page of pages) {
      const file = path.join(temp, page);
      const html = fs.readFileSync(file, 'utf8');
      const fingerprint = fingerprintOf(html);
      fingerprints[page] = fingerprint;
      fs.writeFileSync(file, withVersion(html, version, fingerprint));
    }
    fs.writeFileSync(
      path.join(temp, VERSION_FILE),
      JSON.stringify({ commit: version.commit, time: version.time, pages: fingerprints }, null, 2) + '\n',
    );
    // public/dev/ holds the dev server's config (tools/dev.ts), which points at a local database: never published.
    const made = filesUnder(temp).filter((f) => !f.startsWith('dev/'));
    const written: string[] = [];
    for (const name of made) {
      const bytes = fs.readFileSync(path.join(temp, name));
      const target = path.join(out, name);
      if (fs.existsSync(target) && fs.readFileSync(target).equals(bytes)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      // Two runs at once (Vitest and Playwright, say) each write a whole file: a reader never sees half of one.
      const part = `${target}.${String(process.pid)}.tmp`;
      fs.writeFileSync(part, bytes);
      fs.renameSync(part, target);
      written.push(name);
    }
    const kept = new Set(made);
    const removed = filesUnder(out).filter((f) => !kept.has(f) && !f.endsWith('.tmp'));
    for (const f of removed) fs.rmSync(path.join(out, f));
    return { files: made.length, written, removed, modules };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/** buildSite, waited for: it runs this file in a child process (`node tools/build.ts out --src src --public pub`),
 *  with `env` as its environment (KC_BUILD_COMMIT, KC_BUILD_TIME). Throws with Vite's message if the build fails;
 *  passes Vite's warnings on if it doesn't. */
export function build(out = SITE, src = SRC, pub = PUBLIC, env: NodeJS.ProcessEnv = process.env): BuildResult {
  const args = [import.meta.filename, out, '--src', src, '--public', pub, '--json'];
  const run = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...args], {
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(`the build of ${src} failed:\n${run.stderr || String(run.error)}`);
  if (run.stderr) process.stderr.write(run.stderr);
  return JSON.parse(run.stdout) as BuildResult;
}

// Real paths: a folder reached through a link (macOS's /tmp, say) must still count as this script being run.
const entry = process.argv[1];
if (entry && fs.realpathSync(entry) === fs.realpathSync(import.meta.filename)) {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args.splice(i, 2)[1];
  };
  const src = path.resolve(option('--src') ?? SRC);
  const pub = path.resolve(option('--public') ?? PUBLIC);
  const json = args.includes('--json');
  const out = path.resolve(args.find((a) => !a.startsWith('--')) ?? SITE);
  // No top-level await: the test scripts require() this file (CommonJS can't load a module that awaits as it loads).
  void buildSite(out, src, pub).then((r) => {
    if (json) process.stdout.write(JSON.stringify(r));
    else {
      const changed = [
        r.written.length ? `${String(r.written.length)} written` : '',
        r.removed.length ? `${String(r.removed.length)} removed (${r.removed.join(', ')})` : '',
      ].filter(Boolean);
      console.log(
        `Built ${path.relative(process.cwd(), out) || '.'}/ from src/: ${String(r.files)} files` +
          (changed.length ? `, ${changed.join(', ')}.` : ', none changed.'),
      );
    }
  });
}
