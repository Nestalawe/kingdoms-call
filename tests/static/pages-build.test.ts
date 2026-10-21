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
//   stops the build (planted). Two kinds of file are for TypeScript only, in no bundle: src/globals.d.ts, and the
//   schemas of src/schemas/ (P1-10a1), which src/ imports as types only (`import type`) until P1-15 parses a save at
//   load: a value import of one (planted) is refused, and a type-only one (planted) leaves every bundle without it.
// - tools/pages.ts names each page's files as Rolldown does, but a module nothing on the page reads, which Rolldown
//   leaves out (kc-safe.ts on the Overlord page, which calls none of it). Its importsOf reads a module's imports that
//   bring code, and leaves out a type-only one (P1-10a2: engine/turn/context.ts imports the schemas' types), in every
//   form (planted).
// - The engine's files (tools/pages.ts's engineEntryFiles, which tests/lib/engine.ts bundles) are the data file and
//   every file under src/engine/ and src/views/, each in the GM page's bundle, in the order the page's entry lists them,
//   the dice and the clock first.
// - The build writes only what changed and removes what it no longer makes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as acorn from 'acorn';
import ts from 'typescript';
import { afterAll, describe, expect, test } from 'vitest';
import { build, filesUnder, ROOT, type BuildResult } from '../../tools/build.ts';
import { DATA_FILE, engineEntryFiles, importsOf, pageEntries, pageFiles, pageNames } from '../../tools/pages.ts';

const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-pages-build-'));
// A test that builds the site again (each build is Vite's, one per page) takes about a second here and up to 6 s on
// CI's runners when the static tests run side by side, past Vitest's default of 5 s: its time limit is sized to the
// work.
const BUILDS = { timeout: 30_000 };
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
  return filesUnder(src).filter((f) => !reached.has(f) && !isTypesOnly(f));
}

// The saved state's and the orders' Zod schemas (P1-10a1): src/ imports them as types only until P1-15, so no bundle
// holds them (nor Zod).
const SCHEMAS = 'schemas/';
const isTypesOnly = (file: string): boolean => file.startsWith(SCHEMAS);

/** Each import or re-export of src/schemas/ from a file of src/ outside it that isn't `import type` or `export type`
 *  (`file: the line`): a value import, an `import { type X }` (with verbatimModuleSyntax it leaves a bare import of the
 *  file behind), an `import()` or a `require()`. */
function valueImportsOfTheSchemas(src: string): string[] {
  const found: string[] = [];
  for (const file of filesUnder(src).filter((f) => /\.(ts|mts|cts)$/.test(f) && !isTypesOnly(f))) {
    const text = fs.readFileSync(path.join(src, file), 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const intoTheSchemas = (spec: ts.Node | undefined): boolean =>
      !!spec &&
      ts.isStringLiteralLike(spec) &&
      isTypesOnly(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec.text)));
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
  return found;
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
    ].sort();
    expect(filesUnder(SITE)).toEqual(want);
    expect(built.files).toBe(want.length);
  });

  test('two builds of the same src/ are byte-identical, names and all', BUILDS, () => {
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

  test('a file nothing imports is found (planted)', () => {
    const copy = srcCopy((d) => {
      fs.writeFileSync(path.join(d, 'engine', 'forgotten.ts'), 'export const forgotten = 1;\n');
    });
    expect(unreached(copy, build(path.join(tmp, 'site-forgotten'), copy))).toEqual(['engine/forgotten.ts']);
  });

  test('a file a module imports that is missing stops the build (planted)', () => {
    const copy = srcCopy((d) => {
      fs.rmSync(path.join(d, 'engine', 'graves.ts'));
    });
    expect(() => build(path.join(tmp, 'site-missing'), copy)).toThrow(/graves\.ts/);
  });

  test('src/schemas/ is in no bundle, and src/ imports it as types only', () => {
    expect(filesUnder(path.join(SRC, SCHEMAS))).toEqual(
      expect.arrayContaining([
        'ids-of-provinces-heroes-and-realms.ts',
        'orders-a-realm-submits.ts',
        'saved-game-state.ts',
      ]),
    );
    expect(Object.values(built.modules).flat().filter(isTypesOnly)).toEqual([]);
    expect(valueImportsOfTheSchemas(SRC)).toEqual([]);
  });

  test('a value import of src/schemas/ is refused, in each of its forms (planted)', () => {
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
    });
    expect(valueImportsOfTheSchemas(copy)).toEqual([
      "engine/reads-a-schema.ts: import { GameStateSchema } from '../schemas/saved-game-state.ts';",
      "engine/reads-a-schema.ts: import { type Realm } from '../schemas/saved-game-state.ts';",
      "engine/reads-a-schema.ts: import '../schemas/orders-a-realm-submits.ts';",
      "engine/reads-a-schema.ts: export { ProvinceIdSchema } from '../schemas/ids-of-provinces-heroes-and-realms.ts';",
      "engine/reads-a-schema.ts: import('../schemas/saved-game-state.ts')",
    ]);
  });

  test(
    "a type-only import of src/schemas/ from a page's module leaves every bundle without it (planted)",
    BUILDS,
    () => {
      const copy = srcCopy((d) => {
        const file = path.join(d, 'engine', 'rng.ts');
        fs.writeFileSync(
          file,
          "import type { GameState } from '../schemas/saved-game-state.ts';\n" +
            "export type { Realm } from '../schemas/saved-game-state.ts';\n" +
            'export type StateTheDiceServe = GameState;\n' +
            fs.readFileSync(file, 'utf8'),
        );
      });
      expect(valueImportsOfTheSchemas(copy)).toEqual([]);
      const r = build(path.join(tmp, 'site-types-only'), copy);
      expect(Object.values(r.modules).flat().filter(isTypesOnly)).toEqual([]);
      expect(unreached(copy, r)).toEqual([]);
      // …and tools/pages.ts names no schema for any page either (P1-10a2: importsOf leaves type-only imports out).
      expect(
        pageNames(copy)
          .flatMap((page) => pageFiles(page, copy))
          .filter(isTypesOnly),
      ).toEqual([]);
    },
  );

  test("tools/pages.ts's importsOf reads the imports that bring code, and not a type-only one (planted)", () => {
    const copy = srcCopy((d) => {
      fs.writeFileSync(
        path.join(d, 'engine', 'imports-in-every-form.ts'),
        [
          "import type { GameState } from '../schemas/saved-game-state.ts';",
          "export type { Realm } from '../schemas/saved-game-state.ts';",
          "import { kcRng } from './rng.ts';",
          "import { type kcClock } from './clock.ts';",
          "import './graves.ts';",
          "export * from './discoveries.ts';",
          "export { KC_UNIT_TYPE } from '../content/kingdoms-call-data.ts';",
          "export const later = () => import('./world/map-helpers.ts');",
          'export const roll = (g: GameState) => (g ? kcRng() : 0);',
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
  });

  test.for(pages)("%s: tools/pages.ts names the files Rolldown's bundle holds", (page) => {
    const theirs = built.modules[page] ?? [];
    const ours = pageFiles(page);
    expect(theirs.filter((f) => !ours.includes(f))).toEqual([]);
    const leftOut = ours.filter((f) => !theirs.includes(f) && !pageEntries(page).styles.includes(f) && f !== page);
    const scriptless = !pageEntries(page).modules.length;
    expect(leftOut).toEqual(page === 'kingdoms-call-overlord.html' ? ['ui/shared/kc-safe.ts'] : []);
    expect(scriptless ? theirs : []).toEqual([]);
  });
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

test("public/dev/ (the dev server's config) is never published", BUILDS, () => {
  const pub = path.join(tmp, 'public');
  fs.cpSync(PUBLIC, pub, { recursive: true });
  fs.mkdirSync(path.join(pub, 'dev'), { recursive: true });
  fs.writeFileSync(path.join(pub, 'dev', 'kc-config.js'), 'const KC_CONFIG = {};\n');
  const out = path.join(tmp, 'site-dev');
  build(out, SRC, pub);
  expect(filesUnder(out).filter((f) => f.startsWith('dev/'))).toEqual([]);
  expect(filesUnder(out)).toContain('kc-config.js');
});

test('the build writes only what changed, and removes what it no longer makes', BUILDS, () => {
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
});
