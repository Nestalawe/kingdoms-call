// The site's build (tools/build.ts, plan P1-09d): Vite builds each src/*.html on its own, and public/ is copied as it
// is. It replaced P1-05's stitch and its two tests (static/build.test.ts, static/engine-files.test.ts). Level 0
// (static): it builds the site into temporary folders (Vite, a few seconds) and reads what was made; nothing runs.
// - Every page builds, and the site is exactly: each page, its bundle and its stylesheet (a page with no script has no
//   bundle), each named by its page and a hash of its content (P1-06b), and public/ as it is, but public/dev/ (the dev
//   server's config), which is never published. Two builds of the same src/ are byte-identical.
// - Each bundle stands alone: it parses as a classic script, with no import or export left, so jsdom can run it
//   (tests/lib/boot.js), and holds no stitch marker.
// - Every file under src/ is in a page: in a bundle (Rolldown's own list of the bundle's modules), or a page's
//   template or stylesheet. A file nothing reaches is found (planted), and a file a module imports that isn't there
//   stops the build (planted). src/globals.d.ts is for TypeScript only, in no bundle. The schemas of src/schemas/
//   (P1-10a1) are imported as types only (`import type`) but once: the save's upgrade imports the check of a saved
//   game for its code (P1-15d: the check at load parses with the saved state's schema), so the GM page's bundle holds
//   that check, the schemas it reads and Zod, and no other page's holds any; a schema no bundle holds (the orders')
//   is let through as types. A second value import (planted, in each form, the upgrade's own file too) is refused,
//   and a type-only one (planted) leaves every bundle without the file it names.
// - tools/pages.ts names each page's files as Rolldown does, but a module nothing on the page reads, which Rolldown
//   would leave out (none today: kc-safe.ts was one, on the Overlord page, until its reload banner called it, P1-06d;
//   so the test now expects none on any page). Its importsOf reads a module's imports that
//   bring code, and leaves out a type-only one (P1-10a2: engine/turn/context.ts imports the schemas' types), in every
//   form, and a package's (P1-15d: Zod), whose files aren't under src/ (planted).
// - The engine's files (tools/pages.ts's engineEntryFiles, which tests/lib/engine.ts bundles) are the data file and
//   every file under src/engine/ and src/views/, each in the GM page's bundle, in the order the page's entry lists them,
//   the dice and the clock first.
// - The build writes only what changed and removes what it no longer makes.
// - Each page's version (P1-06c): the four pages whose footer has the marker get the build line ("build <commit> ·
//   <date and time, New Zealand>"); every page gets the metas kc-build and kc-page-version; version.json names every
//   page with its fingerprint, the hash of the page before its version is filled in. A change to one page changes only
//   its fingerprint (planted); another commit changes no bundle and no fingerprint; with no git, "build unknown". No
//   hand-typed stamp is left in src/ (KC_DATA_STAMP, KC_DATA_MIN, the data file's "Data file v" line, a footer's
//   "v2026.10.18-2300").
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as acorn from 'acorn';
import ts from 'typescript';
import { afterAll, describe, expect, test } from 'vitest';
import {
  build,
  BUILD_LINE_MARKER,
  buildLine,
  filesUnder,
  fingerprintOf,
  ROOT,
  VERSION_FILE,
  type BuildResult,
} from '../../tools/build.ts';
import { DATA_FILE, engineEntryFiles, importsOf, pageEntries, pageFiles, pageNames } from '../../tools/pages.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-pages-build-'));
// A test that builds the site again (each build is Vite's, one per page), copies src/ or reads every file of a page by
// its syntax tree takes about a second here and up to 6 s on CI's runners when the static tests run side by side, past
// Vitest's default of 5 s: its time limit is sized to the work (tests/lib/time-limits.ts).
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** A copy of src/ in a new temporary folder, changed by `change`. */
function srcCopy(change: (dir: string) => void): string {
  const dir = fs.mkdtempSync(path.join(tmp, 'src-'));
  fs.cpSync(SRC, dir, { recursive: true });
  change(dir);
  return dir;
}

/** The files under `src` that no page's bundle, template or stylesheet holds. */
function unreached(src: string, r: BuildResult): string[] {
  const reached = new Set([
    ...Object.values(r.modules).flat(),
    ...pageNames(src).flatMap((page) => [page, ...pageEntries(page, src).styles]),
    // Types only, for TypeScript (tsconfig.json includes src/): no module imports it and no bundle holds it (P1-09e).
    'globals.d.ts',
  ]);
  return filesUnder(src).filter((f) => !reached.has(f) && !isASchema(f));
}

// The saved state's and the orders' Zod schemas (P1-10a1), and the check of a saved game that parses with them
// (P1-15d): src/ imports them as types only, but the save's upgrade, which imports the check for its code. So the GM
// page's bundle holds the check and what it reads, and a schema no bundle holds is types for the code.
const SCHEMAS = 'schemas/';
const isASchema = (file: string): boolean => file.startsWith(SCHEMAS);
/** The one value import of src/schemas/, as valueImportsOfTheSchemas names it. */
const THE_ONE_VALUE_IMPORT =
  'engine/saves/upgrade-a-saved-game-and-check-it.ts: ' +
  "import { whereASavedGameDiffersFromThisBuildsSchema } from '../../schemas/where-a-saved-game-differs-from-this-builds-schema.ts';";
/** The files of src/schemas/ the GM page's bundle holds: the check, the schemas it reads, and theirs. */
const THE_SCHEMAS_THE_GM_PAGE_BUNDLES = [
  'schemas/ids-of-provinces-heroes-and-realms.ts',
  'schemas/saved-game-state.ts',
  'schemas/the-strict-version-of-a-schema.ts',
  'schemas/where-a-saved-game-differs-from-this-builds-schema.ts',
];

/** Each import or re-export of src/schemas/ from a file of src/ outside it that isn't `import type` or `export type`
 *  (`file: the line`), but the one (THE_ONE_VALUE_IMPORT, kept with `andTheOne`): a value import, an
 *  `import { type X }` (with verbatimModuleSyntax it leaves a bare import of the file behind), an `import()` or a
 *  `require()`. */
function valueImportsOfTheSchemas(src: string, andTheOne = false): string[] {
  const found: string[] = [];
  for (const file of filesUnder(src).filter((f) => /\.(ts|mts|cts)$/.test(f) && !isASchema(f))) {
    const text = fs.readFileSync(path.join(src, file), 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const intoTheSchemas = (spec: ts.Node | undefined): boolean =>
      !!spec &&
      ts.isStringLiteralLike(spec) &&
      isASchema(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec.text)));
    const visit = (node: ts.Node): void => {
      const value =
        (ts.isImportDeclaration(node) &&
          intoTheSchemas(node.moduleSpecifier) &&
          node.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword) ||
        (ts.isExportDeclaration(node) && intoTheSchemas(node.moduleSpecifier) && !node.isTypeOnly) ||
        (ts.isImportEqualsDeclaration(node) &&
          ts.isExternalModuleReference(node.moduleReference) &&
          intoTheSchemas(node.moduleReference.expression)) ||
        (ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
          intoTheSchemas(node.arguments[0]));
      if (value) found.push(`${file}: ${node.getText(source).split('\n')[0] ?? ''}`);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return andTheOne ? found : found.filter((line) => line !== THE_ONE_VALUE_IMPORT);
}

const SITE = path.join(tmp, 'site');
const built = build(SITE);
const pages = pageNames();
// Each page's bundle and stylesheet are named by the page and a hash of their content (P1-06b: assets/<page>-<hash>.js),
// so a deploy never replaces a file a cached page still names (tools/deploy/keep-the-previous-deploys-files.ts).
const HASHED = (page: string, ext: string) =>
  new RegExp(`^assets/${page.replace(/\.html$/, '').replace(/[.-]/g, '\\$&')}-[A-Za-z0-9_-]{8}\\.${ext}$`);
const assetsOf = (site: string, page: string, ext: string) => filesUnder(site).filter((f) => HASHED(page, ext).test(f));
const bundleOf = (page: string) => assetsOf(SITE, page, 'js')[0] ?? `no bundle of ${page}`;

describe('every page builds', () => {
  test('the pages are the seven published ones', () => {
    expect(pages).toEqual([
      'index.html',
      'kingdoms-call-gm-portal.html',
      'kingdoms-call-leaderboard.html',
      'kingdoms-call-overlord.html',
      'kingdoms-call-player-portal.html',
      'kingdoms-call-rules-intro.html',
      'kingdoms-call-rules.html',
    ]);
  });

  test('the site is each page, its bundle and its stylesheet, each named by its page and a hash, and public/ as it is', () => {
    const scripted = pages.filter((p) => pageEntries(p).modules.length);
    for (const p of pages) expect(assetsOf(SITE, p, 'css'), p).toHaveLength(1);
    for (const p of scripted) expect(assetsOf(SITE, p, 'js'), p).toHaveLength(1);
    const want = [
      ...pages,
      ...scripted.flatMap((p) => assetsOf(SITE, p, 'js')),
      ...pages.flatMap((p) => assetsOf(SITE, p, 'css')),
      ...filesUnder(PUBLIC).filter((f) => !f.startsWith('dev/')),
      VERSION_FILE,
    ].sort();
    expect(filesUnder(SITE)).toEqual(want);
    expect(built.files).toBe(want.length);
  });

  test('two builds of the same src/ are byte-identical, names and all', timeLimitForTheWork({ siteBuilds: 1 }), () => {
    const again = path.join(tmp, 'site-twice');
    build(again);
    expect(filesUnder(again)).toEqual(filesUnder(SITE));
    for (const f of filesUnder(SITE))
      expect(fs.readFileSync(path.join(again, f)).equals(fs.readFileSync(path.join(SITE, f))), f).toBe(true);
  });

  test('a page with no script of its own has no bundle: the landing page', () => {
    expect(pages.filter((p) => !pageEntries(p).modules.length)).toEqual(['index.html']);
  });

  test.for(pages.filter((p) => pageEntries(p).modules.length))(
    '%s: its bundle stands alone, a classic script with no import or export, and the page loads it',
    timeLimitForTheWork({ everyFileReads: 1 }),
    (page) => {
      const code = fs.readFileSync(path.join(SITE, bundleOf(page)), 'utf8');
      const program = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
      expect(program.body.filter((s) => /^(Import|Export)/.test(s.type)).map((s) => s.type)).toEqual([]);
      expect(() => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' })).not.toThrow();
      expect(code.includes('{{kc-build:')).toBe(false);
      const html = fs.readFileSync(path.join(SITE, page), 'utf8');
      expect(html).toContain(`<script type="module" crossorigin src="./${bundleOf(page)}"></script>`);
    },
  );
});

describe('every file under src/ is in a page', () => {
  test('none is left out', () => {
    expect(unreached(SRC, built)).toEqual([]);
  });

  test('a file nothing imports is found (planted)', timeLimitForTheWork({ siteBuilds: 1, everyFileReads: 1 }), () => {
    const copy = srcCopy((d) => {
      fs.writeFileSync(path.join(d, 'engine', 'forgotten.ts'), 'export const forgotten = 1;\n');
    });
    expect(unreached(copy, build(path.join(tmp, 'site-forgotten'), copy))).toEqual(['engine/forgotten.ts']);
  });

  test(
    'a file a module imports that is missing stops the build (planted)',
    timeLimitForTheWork({ siteBuilds: 1, everyFileReads: 1 }),
    () => {
      const copy = srcCopy((d) => {
        fs.rmSync(path.join(d, 'engine', 'graves.ts'));
      });
      expect(() => build(path.join(tmp, 'site-missing'), copy)).toThrow(/graves\.ts/);
    },
  );

  test(
    "src/schemas/ is in the GM page's bundle alone, through the one value import, the save's upgrade's",
    timeLimitForTheWork({ everyFileReads: 1 }),
    () => {
      expect(filesUnder(path.join(SRC, SCHEMAS))).toEqual(
        expect.arrayContaining([
          'ids-of-provinces-heroes-and-realms.ts',
          'orders-a-realm-submits.ts',
          'saved-game-state.ts',
          'the-strict-version-of-a-schema.ts',
          'where-a-saved-game-differs-from-this-builds-schema.ts',
        ]),
      );
      for (const page of pages)
        expect((built.modules[page] ?? []).filter(isASchema), page).toEqual(
          page === 'kingdoms-call-gm-portal.html' ? THE_SCHEMAS_THE_GM_PAGE_BUNDLES : [],
        );
      expect(valueImportsOfTheSchemas(SRC, true)).toEqual([THE_ONE_VALUE_IMPORT]);
      expect(valueImportsOfTheSchemas(SRC)).toEqual([]);
    },
  );

  test(
    "a second value import of src/schemas/ is refused, in each of its forms, the upgrade's own file too (planted)",
    timeLimitForTheWork({ everyFileReads: 2 }),
    () => {
      const copy = srcCopy((d) => {
        fs.writeFileSync(
          path.join(d, 'engine', 'reads-a-schema.ts'),
          [
            "import { GameStateSchema } from '../schemas/saved-game-state.ts';",
            "import { type Realm } from '../schemas/saved-game-state.ts';",
            "import '../schemas/orders-a-realm-submits.ts';",
            "export { ProvinceIdSchema } from '../schemas/ids-of-provinces-heroes-and-realms.ts';",
            "export const later = () => import('../schemas/saved-game-state.ts');",
            'export const schema = GameStateSchema;',
            'export type R = Realm;',
            '',
          ].join('\n'),
        );
        const upgrade = path.join(d, 'engine', 'saves', 'upgrade-a-saved-game-and-check-it.ts');
        fs.writeFileSync(
          upgrade,
          fs.readFileSync(upgrade, 'utf8') +
            "import { GameStateSchema } from '../../schemas/saved-game-state.ts';\nexport const planted = GameStateSchema;\n",
        );
      });
      expect(valueImportsOfTheSchemas(copy)).toEqual([
        "engine/reads-a-schema.ts: import { GameStateSchema } from '../schemas/saved-game-state.ts';",
        "engine/reads-a-schema.ts: import { type Realm } from '../schemas/saved-game-state.ts';",
        "engine/reads-a-schema.ts: import '../schemas/orders-a-realm-submits.ts';",
        "engine/reads-a-schema.ts: export { ProvinceIdSchema } from '../schemas/ids-of-provinces-heroes-and-realms.ts';",
        "engine/reads-a-schema.ts: import('../schemas/saved-game-state.ts')",
        "engine/saves/upgrade-a-saved-game-and-check-it.ts: import { GameStateSchema } from '../../schemas/saved-game-state.ts';",
      ]);
    },
  );

  test(
    "a type-only import of src/schemas/ from a page's module leaves every bundle without the file it names (planted)",
    timeLimitForTheWork({ siteBuilds: 1, everyFileReads: 3 }),
    () => {
      // the orders' schema, which the check doesn't read, so no bundle holds it; rng.ts is in the GM page's bundle
      const ORDERS = 'schemas/orders-a-realm-submits.ts';
      const copy = srcCopy((d) => {
        const file = path.join(d, 'engine', 'rng.ts');
        fs.writeFileSync(
          file,
          "import type { OrdersARealmSubmits } from '../schemas/orders-a-realm-submits.ts';\n" +
            "export type { PhaseOrder } from '../schemas/orders-a-realm-submits.ts';\n" +
            'export type OrdersTheDiceServe = OrdersARealmSubmits;\n' +
            fs.readFileSync(file, 'utf8'),
        );
      });
      expect(valueImportsOfTheSchemas(copy)).toEqual([]);
      const r = build(path.join(tmp, 'site-types-only'), copy);
      expect(Object.values(r.modules).flat()).toContain('engine/rng.ts');
      expect(Object.values(r.modules).flat()).not.toContain(ORDERS);
      expect(unreached(copy, r)).toEqual([]);
      // …and tools/pages.ts names it for no page either (P1-10a2: importsOf leaves type-only imports out).
      expect(pageNames(copy).flatMap((page) => pageFiles(page, copy))).not.toContain(ORDERS);
    },
  );

  test(
    "tools/pages.ts's importsOf reads the imports that bring code, and not a type-only one (planted)",
    timeLimitForTheWork({ everyFileReads: 1 }),
    () => {
      const copy = srcCopy((d) => {
        fs.writeFileSync(
          path.join(d, 'engine', 'imports-in-every-form.ts'),
          [
            "import type { GameState } from '../schemas/saved-game-state.ts';",
            "export type { Realm } from '../schemas/saved-game-state.ts';",
            "import { z } from 'zod';",
            "import { kcRng } from './rng.ts';",
            "import { type kcClock } from './clock.ts';",
            "import './graves.ts';",
            "export * from './discoveries.ts';",
            "export { KC_UNIT_TYPE } from '../content/kingdoms-call-data.ts';",
            "export const later = () => import('./world/map-helpers.ts');",
            'export const roll = (g: GameState) => (g ? kcRng() : z.number().parse(0));',
            '',
          ].join('\n'),
        );
      });
      expect(importsOf('engine/imports-in-every-form.ts', copy)).toEqual([
        'engine/rng.ts',
        'engine/clock.ts',
        'engine/graves.ts',
        'engine/discoveries.ts',
        'content/kingdoms-call-data.ts',
        'engine/world/map-helpers.ts',
      ]);
    },
  );

  test.for(pages)(
    "%s: tools/pages.ts names the files Rolldown's bundle holds",
    timeLimitForTheWork({ everyFileReads: 1 }),
    (page) => {
      const theirs = built.modules[page] ?? [];
      const ours = pageFiles(page);
      expect(theirs.filter((f) => !ours.includes(f))).toEqual([]);
      const leftOut = ours.filter((f) => !theirs.includes(f) && !pageEntries(page).styles.includes(f) && f !== page);
      const scriptless = !pageEntries(page).modules.length;
      expect(leftOut).toEqual([]);
      expect(scriptless ? theirs : []).toEqual([]);
    },
  );
});

describe("the engine's files", () => {
  const GM = 'kingdoms-call-gm-portal.html';
  const files = engineEntryFiles();
  const inFolders = filesUnder(SRC).filter((f) => /^(engine|views)\//.test(f));

  test('the data file, then every file under src/engine/ and src/views/, the dice and the clock first', () => {
    expect(files[0]).toBe(DATA_FILE);
    expect([...files.slice(1)].sort()).toEqual(inFolders);
    expect(files.slice(1, 3)).toEqual(['engine/rng.ts', 'engine/clock.ts']);
  });

  test("each is in the GM page's bundle, in the order the page's entry lists them", () => {
    const inBundle = built.modules[GM] ?? [];
    expect(files.filter((f) => !inBundle.includes(f))).toEqual([]);
    const listed = importsOf('ui/gm/page.ts');
    expect(files.filter((f) => listed.includes(f))).toEqual(listed.filter((f) => files.includes(f)));
  });
});

test("public/dev/ (the dev server's config) is never published", timeLimitForTheWork({ siteBuilds: 1 }), () => {
  const pub = path.join(tmp, 'public');
  fs.cpSync(PUBLIC, pub, { recursive: true });
  fs.mkdirSync(path.join(pub, 'dev'), { recursive: true });
  fs.writeFileSync(path.join(pub, 'dev', 'kc-config.js'), 'const KC_CONFIG = {};\n');
  const out = path.join(tmp, 'site-dev');
  build(out, SRC, pub);
  expect(filesUnder(out).filter((f) => f.startsWith('dev/'))).toEqual([]);
  expect(filesUnder(out)).toContain('kc-config.js');
});

test(
  'the build writes only what changed, and removes what it no longer makes',
  timeLimitForTheWork({ siteBuilds: 3 }),
  () => {
    const out = path.join(tmp, 'site-again');
    const first = build(out);
    expect(first.written).toHaveLength(first.files);
    for (const f of filesUnder(SITE))
      expect(fs.readFileSync(path.join(out, f)).equals(fs.readFileSync(path.join(SITE, f))), f).toBe(true);
    fs.writeFileSync(path.join(out, 'stale.html'), 'old');
    fs.writeFileSync(path.join(out, 'kc-staging-footer.js'), 'changed by hand');
    const second = build(out);
    expect(second.written).toEqual(['kc-staging-footer.js']);
    expect(second.removed).toEqual(['stale.html']);
    expect(build(out)).toMatchObject({ written: [], removed: [] });
  },
);

describe("each page's version (P1-06c)", () => {
  interface Published {
    commit: string;
    time: string | null;
    pages: Record<string, string>;
  }
  const versionOf = (site: string) => JSON.parse(fs.readFileSync(path.join(site, VERSION_FILE), 'utf8')) as Published;
  const html = (site: string, page: string) => fs.readFileSync(path.join(site, page), 'utf8');
  const META = /<meta name="(kc-build|kc-page-version)" content="([^"]*)">\n/g;
  const metasOf = (text: string): Record<string, string | undefined> =>
    Object.fromEntries([...text.matchAll(META)].map((m): [string, string | undefined] => [m[1] ?? '', m[2]]));
  const LINE = / · (build (?:[0-9a-f]{7} · \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}|unknown))</g;
  const linesOf = (text: string) => [...text.matchAll(LINE)].map((m) => m[1]);
  const marked = pages.filter((p) => fs.readFileSync(path.join(SRC, p), 'utf8').includes(BUILD_LINE_MARKER));
  /** The page as it was before its version was filled in: the metas out, the marker back for the build line. */
  const beforeItsVersion = (text: string) => text.replace(META, '').replace(LINE, ` · ${BUILD_LINE_MARKER}<`);

  /** A build of a copy of src/ changed by `change`, run from the folder that holds the copy (docs/traps.md: Rolldown
   *  names each module from the folder it runs in), with `env`. */
  function buildOf(name: string, change: (src: string) => void, env: NodeJS.ProcessEnv = process.env): string {
    const home = fs.mkdtempSync(path.join(tmp, `${name}-`));
    const src = path.join(home, 'src');
    fs.cpSync(SRC, src, { recursive: true });
    change(src);
    const out = path.join(home, 'site');
    const run = spawnSync(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', path.join(ROOT, 'tools', 'build.ts'), out, '--src', src],
      { cwd: home, env, encoding: 'utf8' },
    );
    if (run.status !== 0) throw new Error(`the build of ${src} failed:\n${run.stderr}`);
    return out;
  }

  test('the four pages that use the database have the marker in their footer, and no other page', () => {
    expect(marked).toEqual([
      'kingdoms-call-gm-portal.html',
      'kingdoms-call-leaderboard.html',
      'kingdoms-call-overlord.html',
      'kingdoms-call-player-portal.html',
    ]);
  });

  test.for(pages)('%s: its metas name the commit and its fingerprint, and its build line the commit', (page) => {
    const v = versionOf(SITE);
    const text = html(SITE, page);
    expect(text).not.toContain(BUILD_LINE_MARKER);
    expect(metasOf(text)).toEqual({ 'kc-build': v.commit, 'kc-page-version': v.pages[page] });
    expect(linesOf(text)).toEqual(marked.includes(page) ? [buildLine(v)] : []);
    expect(fingerprintOf(beforeItsVersion(text))).toBe(v.pages[page]);
  });

  test("version.json names every page with its fingerprint, and the commit this checkout's src/ is built from", () => {
    const v = versionOf(SITE);
    expect(Object.keys(v.pages)).toEqual(pages);
    for (const f of Object.values(v.pages)) expect(f).toMatch(/^[0-9a-f]{12}$/);
    const git = spawnSync('git', ['log', '-1', '--format=%H%n%cI'], { cwd: ROOT, encoding: 'utf8' });
    expect(`${v.commit}\n${String(v.time)}`).toBe(git.stdout.trim());
  });

  test('the build line: the commit, then its date and time in New Zealand', () => {
    expect(buildLine({ commit: '3f2a9c1' + '0'.repeat(33), time: '2026-10-21T21:15:00Z' })).toBe(
      'build 3f2a9c1 · 22 Oct 2026, 10:15',
    );
    expect(buildLine({ commit: 'abcdef0123', time: '2026-09-02T11:05:00Z' })).toBe('build abcdef0 · 2 Sep 2026, 23:05');
    expect(buildLine({ commit: 'unknown', time: null })).toBe('build unknown');
    expect(buildLine({ commit: 'dev', time: null })).toBe('build dev');
  });

  test(
    'with no git (a copy of src/ outside the checkout), the build says "build unknown"',
    timeLimitForTheWork({ siteBuilds: 1, everyFileReads: 1 }),
    () => {
      const out = path.join(tmp, 'site-no-git');
      build(
        out,
        srcCopy(() => undefined),
      );
      expect(versionOf(out)).toMatchObject({ commit: 'unknown', time: null });
      for (const page of marked) expect(linesOf(html(out, page))).toEqual(['build unknown']);
    },
  );

  test(
    "another commit changes no bundle and no fingerprint: only the pages' metas and build lines",
    timeLimitForTheWork({ siteBuilds: 2 }),
    () => {
      const commits = ['0123456789abcdef0123456789abcdef01234567', 'fedcba9876543210fedcba9876543210fedcba98'];
      const [one, two] = commits.map((commit, i) => {
        const out = path.join(tmp, `site-commit-${String(i)}`);
        build(out, SRC, PUBLIC, { ...process.env, KC_BUILD_COMMIT: commit, KC_BUILD_TIME: '2026-10-21T21:15:00Z' });
        return out;
      }) as [string, string];
      expect(filesUnder(two)).toEqual(filesUnder(one));
      const differ = filesUnder(one).filter(
        (f) => !fs.readFileSync(path.join(one, f)).equals(fs.readFileSync(path.join(two, f))),
      );
      expect(differ).toEqual([...pages, VERSION_FILE].sort());
      expect(versionOf(two).pages).toEqual(versionOf(one).pages);
      expect(versionOf(one).commit).toBe(commits[0]);
      expect(linesOf(html(two, 'kingdoms-call-gm-portal.html'))).toEqual(['build fedcba9 · 22 Oct 2026, 10:15']);
      for (const page of pages) expect(beforeItsVersion(html(two, page)), page).toBe(beforeItsVersion(html(one, page)));
    },
  );

  test(
    "a change to one page's code changes only that page's fingerprint (planted)",
    timeLimitForTheWork({ siteBuilds: 2, everyFileReads: 2 }),
    () => {
      const before = buildOf('unchanged', () => undefined);
      const after = buildOf('gm-changed', (src) => {
        fs.appendFileSync(
          path.join(src, 'ui', 'gm', 'startup.ts'),
          '\n(globalThis as { aPlantedChange?: number }).aPlantedChange = 1;\n',
        );
      });
      const [a, b] = [versionOf(before).pages, versionOf(after).pages];
      expect(Object.keys(a).filter((page) => a[page] !== b[page])).toEqual(['kingdoms-call-gm-portal.html']);
    },
  );

  test('a KC_BUILD_COMMIT that is not a commit stops the build', timeLimitForTheWork({ siteBuilds: 1 }), () => {
    expect(() =>
      build(path.join(tmp, 'site-bad-commit'), SRC, PUBLIC, { ...process.env, KC_BUILD_COMMIT: '<b>not a commit' }),
    ).toThrow(/KC_BUILD_COMMIT/);
  });

  test('no hand-typed stamp is left in src/', () => {
    const STAMPS = [
      /\bKC_DATA_STAMP\b/,
      /\bKC_DATA_MIN(?:_P)?\b/,
      /\bKC_SHARED_TABLE_NAMES\b/,
      /Data file v\d/,
      /\bKC_BUILD_STAMP\s*=\s*['"`]\d/,
      /(?:Portal|Hall of Fame|Overlord) v\d{4}\.\d{2}\.\d{2}-\d{4}/,
    ];
    const found = filesUnder(SRC).flatMap((f) => {
      const text = fs.readFileSync(path.join(SRC, f), 'utf8');
      return STAMPS.filter((re) => re.test(text)).map((re) => `${f}: ${re.source}`);
    });
    expect(found).toEqual([]);
  });
});
