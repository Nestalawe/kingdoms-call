// npm run build (plan P1-09d): Vite builds the site from src/ into site/. site/ is build output, not in git: it is what
// GitHub Pages publishes (deploy.yml), what staging publishes (staging.yml), and what every test opens. The test runs
// build it first (tests/setup/global.ts, tools/balance/run.ts), so they never open stale pages.
//
// Every src/*.html is a page. Each is built on its own (P1-09's Decision 8), so its bundle stands alone: one script,
// assets/<page>.js, with no import left (jsdom runs no module script, so tests/lib/boot.js inlines it as a classic
// one), and one stylesheet, assets/<page>.css. public/ is copied as it is: kc-config.js (staging overwrites it),
// kc-staging-footer.js and vendor/. The options, in one place for the build and the dev server (tools/dev.ts):
// - minify: false: a live error's stack keeps the code's names, and the size is what it was;
// - target esnext and no module preload: the code is left as written, and nothing is added to the page;
// - names without a hash (assets/<page>.js): a cached page asking for a file a later deploy deleted would not load.
//   Hashed names come with P1-06, with the previous deploy's files kept;
// - no constant written in where it is read (Rolldown's inlineConst, on by default): every constant keeps its name, so
//   the code reads as written and a test can still reach one. Rolldown (Vite's bundler) still leaves out a function or
//   constant that nothing reaches (it can't be turned off for a page: Vite treats a page as having no exports), writes
//   each top-level const, let and class as a var, and lays the code out its own way.
// Vite builds into a new temporary folder; then site/ gets only what changed, each file through a temporary file, and
// loses what is no longer made. So a test reading site/ while another run builds it never sees half a file.
//
//   node tools/build.ts [out]     out: the folder to build into (default: site/ beside src/)
//
// build(out, src) does the same from another script and waits for it (it runs this file in a child process: Vite's
// build is asynchronous); buildSite(out, src) is the asynchronous build itself.
import { spawnSync } from 'node:child_process';
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
        output: { entryFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' },
      },
    },
  };
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

/** buildSite, waited for: it runs this file in a child process (`node tools/build.ts out --src src --public pub`).
 *  Throws with Vite's message if the build fails; passes Vite's warnings on if it doesn't. */
export function build(out = SITE, src = SRC, pub = PUBLIC): BuildResult {
  const args = [import.meta.filename, out, '--src', src, '--public', pub, '--json'];
  const run = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...args], {
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
