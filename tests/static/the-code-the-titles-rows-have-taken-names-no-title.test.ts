// The code the titles' rows have taken names no title (B-06, T7, the rules pulled out: its Reckoning and titles
// family, B-06i to B-06r): each function (or file's top level) the family's rows have taken holds no string naming an
// Imperial Title or a minor title by its key or its name (`'duelist'`, `'The Duelist'`), whatever the code does with it
// (compared, a `case`, a lookup, a list, a map's key or value, a literal type, or in a function nested inside). It
// reads the title's row instead. Each row adds what it takes to TAKEN, which is empty until the first of them
// (B-06i). With them, the ratchet's count of the titles the engine names outside src/engine/rules/ (tools/ratchet.ts's
// titleChecksInEngine, by its helper titleChecksByFunction: a title's key or name anywhere but a literal type), so
// that count only falls: the helper counts each title planted, and none in src/engine/rules/ or a page's code.
// Not seen: a title read as a property's key (`G._minorHolders?.warlock`), and the six Imperial keys that are another
// rule's words too (`sea`, `spy`, `monster`, `beast`, `wild`, `arch`).
//
// Level 0 (static): the files' syntax trees and the titles' tables as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { TITLE_DEFS } from '../../src/content/kingdoms-call-data.ts';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  readBaseline,
  THE_IMPERIAL_KEYS_THAT_ARE_OTHER_WORDS,
  THE_MINOR_TITLES_FILE,
  theCodeFiles,
  theMinorTitlesKeysAndNames,
  TITLE_VOCABULARY,
  titleChecksByFunction,
  titleChecksInEngine,
} from '../../tools/ratchet.ts';

/** The top level of a file: what no function holds. */
const TOP = '(top)';

/** Each function (or a file's top level) the titles' rows have taken, by its file, from the row that took it: each of
 *  the family's rows adds what it takes. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  [
    'src/engine/titles/reckoning.ts',
    TOP,
    "B-06i, the minor titles' rows and the skills they add to (MINOR_TITLES, SKILL_EXTRA_MINORS), to content",
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcCharCombatant',
    "B-06j, a hero's titles add to his skills in a fight, to the minor titles' registry (personalCombat)",
  ],
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

/** In the function named (or the file's top level, outside every named function): every string naming a title, in the
 *  order written, a literal type's too (a function nested inside with no name counts); null if the file doesn't
 *  declare the function. */
function everyTitleIn(file: string, text: string, fn: string): string[] | null {
  let found: string[] | null = fn === TOP ? [] : null;
  const collect = (node: ts.Node, into: string[], atTheTop: boolean): void => {
    if (atTheTop && aFunctionsName(node) !== null) return;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && TITLE_VOCABULARY.has(node.text))
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

test.for(TAKEN)('%s: %s names no title (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = titleChecksByFunction(file, text);
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s names of a title (the ratchet's helper)`).toBe(0);
  expect(everyTitleIn(file, text, fn), `every string in ${fn} naming a title`).toEqual([]);
});

// The words are the tables' own: every key and name of TITLE_DEFS and of MINOR_TITLES (read from its syntax tree), the
// six keys that are other words aside, and nothing written by hand.
test("the vocabulary is every title's key and name in the two tables, less the six keys that are other words", () => {
  const minor = theMinorTitlesKeysAndNames(fs.readFileSync(path.join(ROOT, THE_MINOR_TITLES_FILE), 'utf8'));
  expect(minor.length, 'a key and a name for each minor title').toBe(40);
  expect(minor.slice(0, 2)).toEqual(['duelist', 'The Duelist']);
  const imperial = TITLE_DEFS.flatMap((t): string[] => [t.key, t.name]);
  expect(imperial.length, 'a key and a name for each of the thirteen Imperial Titles').toBe(26);
  expect([...THE_IMPERIAL_KEYS_THAT_ARE_OTHER_WORDS].filter((k) => !imperial.includes(k))).toEqual([]);
  expect([...TITLE_VOCABULARY]).toEqual(
    [...imperial, ...minor].filter((w) => !THE_IMPERIAL_KEYS_THAT_ARE_OTHER_WORDS.has(w)),
  );
  expect(TITLE_VOCABULARY.size).toBe(60);
});

test("the minor titles' reader reads a list behind `satisfies` (and `as const`), and refuses a file without one", () => {
  const planted = `export const MINOR_TITLES = [
    { key: 'a', name: 'The A', perk: 'p', metric: (c) => c },
    { key: 'b', name: "The B's" },
  ] satisfies readonly unknown[];`;
  expect(theMinorTitlesKeysAndNames(planted)).toEqual(['a', 'The A', 'b', "The B's"]);
  expect(
    theMinorTitlesKeysAndNames(
      `export const MINOR_TITLES = [{ key: 'a', name: 'The A', howTheHolderIsFound: { theMeasure: 'm' } }] as const satisfies readonly unknown[];`,
    ),
  ).toEqual(['a', 'The A']);
  expect(() => theMinorTitlesKeysAndNames('export const OTHER = [];')).toThrow(/no "const MINOR_TITLES/);
});

// The helper finds what it counts: each form of a title planted in one function of the engine (an arrow with no name
// inside it counts for it, a named one for itself; one outside every function for the top level), and none of what
// isn't a title's key or name, or is a literal type, or is one of the six keys left out.
test("the ratchet's helper counts each title's key and name, a literal type's aside", () => {
  const planted = `
    type Key = 'duelist' | 'warlock';
    const TABLE = { 'swift': 1, x: 'The Throne' };
    export function planted(h: { titles: string[] }, key: string) {
      const a = (key === 'cutpurse') + h.titles.includes('The Sea-Wolf') + ['hostleader'].length;
      switch (key) { case 'throne': break; }
      const t = { key: \`lore\` };
      const inside = [h].some(() => key !== 'The Cartographer');
      const notTitles = 'Duelist' + 'the throne' + 'sea' + 'spy' + 'wild' + 'arch' + 'beast' + 'monster';
      return a + t.key + inside + notTitles;
    }
    const nested = function named() { return 'champion'; };`;
  expect(Object.fromEntries(titleChecksByFunction('src/engine/planted.ts', planted))).toEqual({
    [TOP]: 2,
    planted: 6,
    nested: 1,
  });
});

test('every string naming a title in a function, or at the top level, is found', () => {
  const planted = `
    type Key = 'duelist';
    const before = 'The Throne';
    export function planted(h) {
      const a = holds(h, 'cutpurse') + [\`seawolf\`].length + (h.key === 'swift');
      const inside = () => 'The Warlock', notATitle = 'warlocks' || 'sea';
      return a + inside() + notATitle;
    }
    const after = 'vault';`;
  expect(everyTitleIn('planted.ts', planted, 'planted')).toEqual(['cutpurse', 'seawolf', 'swift', 'The Warlock']);
  expect(everyTitleIn('planted.ts', planted, TOP)).toEqual(['duelist', 'The Throne', 'vault']);
  expect(everyTitleIn('planted.ts', planted, 'absent')).toBeNull();
});

// A title planted in a file of src/engine/ (the bots' included) raises titleChecksInEngine by one, and the ratchet
// fails on it; one in src/engine/rules/ or in a page's code isn't counted.
test.for([
  ['src/engine/battle/x.ts', 1],
  ['src/engine/bots/x.ts', 1],
  ['src/engine/rules/x.ts', 0],
  ['src/ui/player/x.ts', 0],
] as const)('a title planted in %s raises titleChecksInEngine by %i', ([file, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), titleChecksInEngine: titleChecksInEngine(files) };
  expect(asTheyAre.titleChecksInEngine).toBe(readBaseline()['titleChecksInEngine']);
  const planted = {
    ...asTheyAre,
    titleChecksInEngine: titleChecksInEngine([
      ...files,
      [file, "export const planted = (key: string): boolean => key === 'trailblazer';\n"],
    ]),
  };
  expect(planted.titleChecksInEngine).toBe(asTheyAre.titleChecksInEngine + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => /^titleChecksInEngine rose from \d+ to \d+\./.test(r))).toEqual(rose);
});
