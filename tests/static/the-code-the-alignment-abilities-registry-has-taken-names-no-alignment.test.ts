// The code the alignment abilities' registry has taken names no alignment (plan P1-19's alignment abilities family,
// Decision A): each function (or file's top level) the registry (src/engine/rules/the-registry-of-alignment-
// abilities.ts) has taken holds no string naming an alignment (`'Neutral'`, `'Undead'`), whatever the code does with it
// (compared, a `case`, a lookup, a list, a map's key or value, a literal type, or in a function nested inside). It asks
// the registry's runner, which reads the ability's row, instead. Each row of the family adds what it takes. With them,
// the ratchet's count of the alignments the engine names outside src/engine/rules/ (tools/ratchet.ts's
// alignmentChecksInEngine, by its helper alignmentChecksByFunction: a name anywhere but a literal type), so that count
// only falls: the helper counts each name planted, and none in src/engine/rules/ or a page's code.
//
// Red on its row's base by design (neutralTradeGold held 1 on P1-19at1's base: the Neutral trade's 'Neutral'), as the
// unit-name, item-effect, spell, discovery, perk and alignment-order tests were: the one exception to refactor-only's
// rule that new tests pass before and after (Theo, 2026-10-25).
// Level 0 (static): the files' syntax trees and the content's list of alignments as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  ALIGNMENT_VOCABULARY,
  alignmentChecksByFunction,
  alignmentChecksInEngine,
  compare,
  readBaseline,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** The top level of a file: what no function holds. */
const TOP = '(top)';

/** Each function (or a file's top level) the alignment abilities' registry has taken, by its file, from the row that
 *  took it. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  ['src/engine/grand-design.ts', 'neutralTradeGold', 'P1-19at1, the Neutral trade: its alignment, from its row'],
];

/** A function's or a method's declaration, or a variable's arrow or function, and its name (as the ratchet's helper
 *  finds a function). */
function aFunctionsName(node: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText();
  return ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer !== undefined &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ? node.name.text
    : null;
}

/** In the function named (or the file's top level, outside every named function): every string naming an alignment, in
 *  the order written, a literal type's too (a function nested inside with no name counts); null if the file doesn't
 *  declare the function. */
function everyAlignmentIn(file: string, text: string, fn: string): string[] | null {
  let found: string[] | null = fn === TOP ? [] : null;
  const collect = (node: ts.Node, into: string[], atTheTop: boolean): void => {
    if (atTheTop && aFunctionsName(node) !== null) return;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && ALIGNMENT_VOCABULARY.has(node.text))
      into.push(node.text);
    ts.forEachChild(node, (child) => {
      collect(child, into, atTheTop);
    });
  };
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  if (found) {
    collect(source, found, true);
    return found;
  }
  const visit = (node: ts.Node): void => {
    if (aFunctionsName(node) === fn) {
      found ??= [];
      collect(node, found, false);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test.for(TAKEN)('%s: %s names no alignment (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = alignmentChecksByFunction(file, text);
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s names of an alignment (the ratchet's helper)`).toBe(0);
  expect(everyAlignmentIn(file, text, fn), `every string in ${fn} naming an alignment`).toEqual([]);
});

test("the vocabulary holds the seven alignments' names, and no other word", () => {
  expect([...ALIGNMENT_VOCABULARY]).toEqual(['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead']);
});

// The helper finds what it counts: each form of a name planted in one function of the engine (an arrow with no name
// inside it counts for it, a named one for itself; one outside every function for the top level), and none of what
// isn't a name or is a literal type.
test("the ratchet's helper counts each alignment's name, a literal type's aside", () => {
  const planted = `
    type Creed = 'Divine' | 'Undead';
    const CHANCE = { 'Divine': 0.5, Good: 0.4, x: 'Evil' };
    export function planted(p: { alignment: string }, list: string[]) {
      const a = (p.alignment === 'Neutral') + list.includes('Pagan') + ['Druidic'].length;
      switch (p.alignment) { case 'Good': break; }
      const realm = { alignment: \`Undead\` };
      const inside = [p].some((x) => x.alignment !== 'Evil');
      const notNames = 'neutral' + 'Divine ' + 'Undeads' + 'Goodly' + 'Druid';
      return a + realm.alignment + inside + notNames;
    }
    const nested = function named() { return 'Divine'; };`;
  expect(Object.fromEntries(alignmentChecksByFunction('src/engine/planted.ts', planted))).toEqual({
    [TOP]: 2,
    planted: 6,
    nested: 1,
  });
});

test('every string naming an alignment in a function, or at the top level, is found', () => {
  const planted = `
    type Creed = 'Divine';
    const before = 'Good';
    export function planted(p) {
      const a = helper('Pagan') + [\`Undead\`].length + (p.alignment === 'Neutral');
      const inside = () => 'Evil', notAName = 'evil' || 'Druid';
      return a + inside() + notAName;
    }
    const after = 'Druidic';`;
  expect(everyAlignmentIn('planted.ts', planted, 'planted')).toEqual(['Pagan', 'Undead', 'Neutral', 'Evil']);
  expect(everyAlignmentIn('planted.ts', planted, TOP)).toEqual(['Divine', 'Good', 'Druidic']);
  expect(everyAlignmentIn('planted.ts', planted, 'absent')).toBeNull();
});

// A name planted in a file of src/engine/ raises alignmentChecksInEngine by one, and the ratchet fails on it; one in
// src/engine/rules/ or in a page's code isn't counted.
test.for([
  ['src/engine/bots/x.ts', 1],
  ['src/engine/rules/x.ts', 0],
  ['src/ui/gm/x.ts', 0],
] as const)('a name planted in %s raises alignmentChecksInEngine by %i', ([file, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), alignmentChecksInEngine: alignmentChecksInEngine(files) };
  expect(asTheyAre.alignmentChecksInEngine).toBe(readBaseline()['alignmentChecksInEngine']);
  const planted = {
    ...asTheyAre,
    alignmentChecksInEngine: alignmentChecksInEngine([
      ...files,
      [file, "export const planted = (p: { alignment: string }): boolean => p.alignment === 'Neutral';\n"],
    ]),
  };
  expect(planted.alignmentChecksInEngine).toBe(asTheyAre.alignmentChecksInEngine + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => /^alignmentChecksInEngine rose from \d+ to \d+\./.test(r))).toEqual(rose);
});
