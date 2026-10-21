// The player portal reaches the engine's rules only through src/shared/ (plan P1-11a4; P1-11a's Decisions 2 and 7).
// src/shared/ re-exports only from src/engine/rules-on-plain-values/, whose files import only src/content and each other
// (tests/static/rules-on-plain-values-import-only-the-content-and-each-other.test.ts). The portal's own files
// (src/ui/player/) import no engine or views file, and declare none of the copies P1-11a4 retired nor any name
// src/shared/ hands them: one function per rule, under the engine's name. So the player page loads no engine file outside
// the folder, and runs none of the engine's set-up. Every import counts: `import … from`, `export … from`, a bare
// `import '…'`, `import(…)` and `require(…)` (TypeScript's preProcessFile reads them all). Until P1-13's
// dependency-cruiser rules do the same. Level 0 (static): it reads the sources and runs nothing.
//
// It fails on its base (P1-11a3) by design: there the copies are still in the portal, and src/shared/ isn't there yet.
// The one exception to refactor-only's "new tests pass before and after" (P1-11a, Decision 7, agreed by Theo).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { filesUnder, ROOT } from '../../tools/build.ts';
import { pageModules } from '../../tools/pages.ts';

const SRC = path.join(ROOT, 'src');
const SHARED = 'shared/';
const RULES = 'engine/rules-on-plain-values/';
const PLAYER = 'ui/player/';
const PLAYER_PAGE = 'kingdoms-call-player-portal.html';

/** The player portal's copies of the engine's rules that P1-11a4 swapped for the engine's functions, and the tables
 *  only they read: none may come back, under these names or any other (the names src/shared/ hands the portal). */
const RETIRED = [
  'floorNumP',
  'unitTypeOfP',
  'UNIT_BASE_STR_P',
  'UNIT_Q_MULT_P',
  'unitBaseStrengthP',
  'ITEM_SLOT_OF_P',
  'isLegendaryItemP',
  'itemSlotP',
  '_ITEM_RACE_ALIAS_P',
  'itemRaceOfP',
  'itemUsableByP',
  'ALIGN_SPECTRUM_PP',
  'alignDistPP',
  'heroHireWagePP',
  'gameMetaP',
  'skillFameLabel',
  'PO_CAVALRY_TYPES',
  'PO_CREATURE_TYPES',
  'PO_MONSTER_TYPES',
  'poAirCarriable',
  'poFlyCapability',
  'actionSpellLimit',
  'combatSpellLimit',
];

const filesIn = (folder: string) => filesUnder(SRC).filter((f) => f.startsWith(folder));

/** Each import of `file` (relative to src/): what it names, and where that is relative to src/ (null: not a file of
 *  src/, e.g. a package or one of Node's modules). */
function importsOf(file: string): { names: string; resolved: string | null }[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  return ts.preProcessFile(text, true, true).importedFiles.map(({ fileName }) => {
    if (!fileName.startsWith('.')) return { names: fileName, resolved: null };
    const resolved = path.relative(SRC, path.resolve(path.dirname(path.join(SRC, file)), fileName));
    return { names: fileName, resolved: resolved.startsWith('..') ? null : resolved.split(path.sep).join('/') };
  });
}

/** Every name `file` declares, at any depth: functions, classes, variables (destructured too), parameters aside. */
function namesDeclaredIn(file: string): string[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names: string[] = [];
  const bound = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) names.push(name.text);
    else for (const e of name.elements) if (!ts.isOmittedExpression(e)) bound(e.name);
  };
  const visit = (node: ts.Node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) names.push(node.name.text);
    else if (ts.isVariableDeclaration(node)) bound(node.name);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return names;
}

/** The names src/shared/ hands the portal (each `export { … } from`). */
function namesSharedExports(): string[] {
  return filesIn(SHARED).flatMap((file) => {
    const text = fs.readFileSync(path.join(SRC, file), 'utf8');
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    return tree.statements.flatMap((s) =>
      ts.isExportDeclaration(s) && s.exportClause && ts.isNamedExports(s.exportClause)
        ? s.exportClause.elements.map((e) => e.name.text)
        : [],
    );
  });
}

describe('src/shared/ re-exports only from src/engine/rules-on-plain-values/', () => {
  const files = filesIn(SHARED);

  test('src/shared/ is there to check, and hands the portal some names', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(namesSharedExports().length).toBeGreaterThan(0);
  });

  test('every import a file of src/shared/ makes is of a file of the folder that is there', () => {
    const outside = files.flatMap((file) =>
      importsOf(file)
        .filter(({ resolved }) => resolved === null || !resolved.startsWith(RULES))
        .map(({ names }) => `${file} imports ${names}`),
    );
    const missing = files.flatMap((file) =>
      importsOf(file)
        .filter(({ resolved }) => resolved !== null && !fs.existsSync(path.join(SRC, resolved)))
        .map(({ names }) => `${file} imports ${names}, which isn't there`),
    );
    expect([...outside, ...missing]).toEqual([]);
  });

  test('src/shared/ only re-exports: it declares nothing of its own', () => {
    expect(files.flatMap((file) => namesDeclaredIn(file).map((name) => `${file} declares ${name}`))).toEqual([]);
  });
});

describe('the player portal reaches the engine only through src/shared/', () => {
  const files = filesIn(PLAYER).filter((f) => f.endsWith('.ts'));

  test('the portal is there to check', () => {
    expect(files).toContain(`${PLAYER}page.ts`);
  });

  test('no file of the portal imports an engine or a views file', () => {
    const reaching = files.flatMap((file) =>
      importsOf(file)
        .filter(({ resolved }) => resolved !== null && /^(engine|views)\//.test(resolved))
        .map(({ names }) => `${file} imports ${names}`),
    );
    expect(reaching).toEqual([]);
  });

  test('no file of the portal declares a retired copy, or a name src/shared/ hands it', () => {
    const refused = new Set([...RETIRED, ...namesSharedExports()]);
    const copies = files.flatMap((file) =>
      namesDeclaredIn(file)
        .filter((name) => refused.has(name))
        .map((name) => `${file} declares ${name}`),
    );
    expect(copies).toEqual([]);
  });

  test('the player page loads no engine file outside the folder, and no views file', () => {
    const modules = pageModules(PLAYER_PAGE);
    expect(modules.filter((f) => f.startsWith(SHARED)).length).toBeGreaterThan(0);
    expect(modules.filter((f) => /^(engine|views)\//.test(f) && !f.startsWith(RULES))).toEqual([]);
  });
});
