// The world is made by the stages its list holds (src/engine/world/the-worlds-making/the-stages-in-the-order-they-run.ts,
// B-06ab), each once, in the list's order:
// - generateNewGame takes the stages' functions from the list as it starts (not as its module loads), one name an
//   entry, each its entry's function's own name, in the list's order, and generate.ts imports none from a stage's file;
// - generateNewGame calls each of them once, in the list's order (a stage dropped, added or moved fails it);
// - the list's ids are S0, S1, … in order, and each names a function of its own;
// - what the tools read from the list's syntax tree (tools/the-worlds-makings-stages-read-from-their-list-in-src.ts:
//   the world proof's stage table and the world-making counts' list) is the list as it runs, entry by entry;
// - the checks are red on a planted generate.ts that swaps two stages' calls, drops one, or binds two names swapped.
// Level 1 (unit): it imports the list to compare its functions' names with generate.ts's text and what the tools read.
// Static alone can't: the functions' names are only known by running the list's module.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import '../lib/the-whole-engine.ts';
import { THE_WORLDS_MAKINGS_STAGES_IN_THE_ORDER_THEY_RUN } from '../../src/engine/world/the-worlds-making/the-stages-in-the-order-they-run.ts';
import { ROOT } from '../../tools/build.ts';
import {
  THE_STAGES_LIST,
  theStagesTheListHolds,
} from '../../tools/the-worlds-makings-stages-read-from-their-list-in-src.ts';

const GENERATE = 'src/engine/world/generate.ts';
const generateText = fs.readFileSync(path.join(ROOT, GENERATE), 'utf8');

/** What generate.ts's text does with the stages: the names it binds from the list, in the pattern's order; the calls
 *  generateNewGame makes to them, in its text's order; and what it imports from a stage's file. */
function theStagesIn(text: string): { bound: string[]; called: string[]; importedFromAStagesFile: string[] } {
  const source = ts.createSourceFile(GENERATE, text, ts.ScriptTarget.Latest, true);
  const bound: string[] = [];
  const importedFromAStagesFile: string[] = [];
  let body: ts.Block | undefined;
  for (const s of source.statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier))
      if (/\/s\d\d-/.test(s.moduleSpecifier.text)) importedFromAStagesFile.push(s.moduleSpecifier.text);
    if (ts.isFunctionDeclaration(s) && s.name?.text === 'generateNewGame') body = s.body;
  }
  if (!body) throw new Error(`${GENERATE} declares no generateNewGame`);
  // The binding from the list: a statement of generateNewGame's own body (not the module's top level, read as it loads).
  for (const s of body.statements) {
    if (ts.isVariableStatement(s))
      for (const d of s.declarationList.declarations) {
        if (!d.initializer || !ts.isIdentifier(d.initializer) || d.initializer.text !== THE_STAGES_LIST.name) continue;
        if (!ts.isArrayBindingPattern(d.name)) continue;
        for (const e of d.name.elements) {
          const run =
            ts.isBindingElement(e) && ts.isObjectBindingPattern(e.name)
              ? e.name.elements.find(
                  (b) => b.propertyName && ts.isIdentifier(b.propertyName) && b.propertyName.text === 'run',
                )
              : undefined;
          bound.push(run && ts.isIdentifier(run.name) ? run.name.text : '(not { run: <a name> })');
        }
      }
  }
  const names = new Set(bound);
  const called: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.has(n.expression.text))
      called.push(n.expression.text);
    ts.forEachChild(n, visit);
  };
  visit(body);
  return { bound, called, importedFromAStagesFile };
}

const theListsFunctions = THE_WORLDS_MAKINGS_STAGES_IN_THE_ORDER_THEY_RUN.map((s) => s.run.name);
const here = theStagesIn(generateText);

test("generateNewGame binds each stage's function from the list under its own name, in the list's order", () => {
  expect(here.bound, "the names generate.ts binds from the list, against the list's functions").toEqual(
    theListsFunctions,
  );
  expect(here.importedFromAStagesFile, "generate.ts's imports from a stage's file").toEqual([]);
});

test("generateNewGame calls each stage's function once, in the list's order", () => {
  expect(here.called, "generateNewGame's calls of the stages, against the list").toEqual(theListsFunctions);
});

test("the list's ids are S0, S1, … in order, and each stage's function is its own", () => {
  expect(THE_WORLDS_MAKINGS_STAGES_IN_THE_ORDER_THEY_RUN.map((s) => s.stage)).toEqual(
    THE_WORLDS_MAKINGS_STAGES_IN_THE_ORDER_THEY_RUN.map((_, i) => `S${String(i)}`),
  );
  expect(theListsFunctions.filter((f, i) => f === '' || theListsFunctions.indexOf(f) !== i)).toEqual([]);
});

test('what the tools read from the list is the list as it runs, entry by entry', () => {
  const read = theStagesTheListHolds();
  expect(read.map((s) => [s.stage, s.inGameTerms, s.fn])).toEqual(
    THE_WORLDS_MAKINGS_STAGES_IN_THE_ORDER_THEY_RUN.map((s) => [s.stage, s.inGameTerms, s.run.name]),
  );
  for (const s of read)
    expect(
      fs.readFileSync(path.join(ROOT, s.file), 'utf8').includes(`export function ${s.fn}(`),
      `${s.file} declares ${s.fn}`,
    ).toBe(true);
});

// Each plant changes generate.ts's text as a row could by mistake; the checks must part from the list on it.
const S12 = 'everyLandProvinceLiftedToTheTaxFloor({ provinces });';
const S14 = 'everyNeutralProvincesDefendersBroughtInsideItsTaxsBand({ provinces });';
const S15 = 'everyNeutralProvinceFieldsTheStrongestMixOfItsOwnUnits({ provinces });';
const S14s = '{ run: everyNeutralProvincesDefendersBroughtInsideItsTaxsBand },';
const S15s = '{ run: everyNeutralProvinceFieldsTheStrongestMixOfItsOwnUnits },';
test.for([
  { plant: "S14's and S15's calls swapped", old: `${S14}\n  ${S15}`, new: `${S15}\n  ${S14}` },
  { plant: "S12's call dropped", old: `${S12}\n  `, new: '' },
  { plant: "S14's and S15's names bound swapped", old: `${S14s}\n    ${S15s}`, new: `${S15s}\n    ${S14s}` },
])('the checks are red on a planted generate.ts: $plant', ({ old, new: planted }) => {
  expect(generateText.includes(old), `${GENERATE} holds the plant's text`).toBe(true);
  const there = theStagesIn(generateText.replace(old, planted));
  expect([there.bound, there.called]).not.toEqual([theListsFunctions, theListsFunctions]);
});
