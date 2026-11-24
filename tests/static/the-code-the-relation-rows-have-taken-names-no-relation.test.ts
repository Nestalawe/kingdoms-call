// The code the relation rows have taken names no relation (B-06, T7, the rules pulled out: Run 3b's diplomacy): each
// function (or file's top level) the family's rows have taken holds no string naming a relation between two realms or
// the Treat declaration (`'enemy'`, `'allied'`, `'neutral'`, `'treat'`), whatever the code does with it (compared, a
// `case`, a list, a map's value, a literal type, or in a function nested inside). It asks the relation's one reader
// instead. Each row adds what it takes to TAKEN, which is empty until the first of them. With them, the ratchet's
// count of the relations the engine names outside src/engine/rules/ (tools/ratchet.ts's relationChecksInEngine, by its
// helper relationChecksByFunction), so that count only falls: the helper counts each relation planted, and none in
// src/engine/rules/ or a page's code. Its two listed exceptions (a battle's kind and a death's cause, each a
// `'neutral'` of another sense) are each still in its function, and let only one string through.
//
// Level 0 (static): the files' syntax trees; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  readBaseline,
  RELATION_VOCABULARY,
  relationChecksByFunction,
  relationChecksInEngine,
  THE_RELATION_WORDS_THAT_ARE_NOT_A_RELATION,
  theCodeFiles,
} from '../../tools/ratchet.ts';
import { everyStringIn, TOP } from '../lib/the-strings-a-function-of-the-code-holds.ts';

/** Each function (or a file's top level) the relation rows have taken, by its file, from the row that took it. Empty
 *  until the family's first row: each adds what it takes. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [];

const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const isARelation = (word: string): boolean => RELATION_VOCABULARY.has(word);

test.for(TAKEN)('%s: %s names no relation (%s)', ([file, fn]) => {
  const text = read(file);
  const counts = relationChecksByFunction(file, text);
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s names of a relation (the ratchet's helper)`).toBe(0);
  const theExceptions = THE_RELATION_WORDS_THAT_ARE_NOT_A_RELATION.filter(([f, g]) => f === file && g === fn).map(
    ([, , word]) => word,
  );
  expect(everyStringIn(file, text, fn, isARelation), `every string in ${fn} naming a relation`).toEqual(theExceptions);
});

test('the vocabulary holds the three states of a relation and the Treat declaration, and no other word', () => {
  expect([...RELATION_VOCABULARY]).toEqual(['enemy', 'allied', 'neutral', 'treat']);
});

// A listed exception that its function no longer holds would let a new relation through: each is still there, once.
test.for(THE_RELATION_WORDS_THAT_ARE_NOT_A_RELATION)('%s: %s still holds its %s (%s)', ([file, fn, word]) => {
  expect(
    everyStringIn(file, read(file), fn, (w) => w === word),
    `${fn}'s ${word}`,
  ).toEqual([word]);
  expect(relationChecksByFunction(file, read(file)).get(fn) ?? 0, `${fn}'s relations, its exception let through`).toBe(
    0,
  );
});

// The helper finds what it counts: each form of a relation planted in one function of the engine (an arrow given to a
// name counts for that name, as a named function does; one outside every function for the top level), and none of
// what isn't a relation or is a literal type or a property's key; an exception lets one string of its function
// through, and no more.
test("the ratchet's helper counts each relation, a literal type's and a key's aside, and each exception once", () => {
  const planted = `
    type Relation = 'enemy' | 'allied';
    const LABEL = { neutral: 'Neutral', x: 'treat' };
    export function planted(r: string) {
      const a = (r === 'enemy') + ['allied', 'neutral'].length;
      const inner = () => \`treat\`;
      return a + inner() + (r || 'neutral') + 'peace' + 'war' + 'hostile' + 'self';
    }`;
  expect(Object.fromEntries(relationChecksByFunction('src/engine/planted.ts', planted))).toEqual({
    [TOP]: 1,
    planted: 4,
    inner: 1,
  });
  const theBattle = 'src/engine/battle/battles-against-province-defenders.ts';
  const twice = "export function combatVsNPC() { return 'neutral' + 'neutral' + 'enemy'; }";
  expect(relationChecksByFunction(theBattle, twice).get('combatVsNPC'), 'one neutral let through, not two').toBe(2);
});

// The count on the tree is the ratchet's baseline; a relation planted in an engine function raises it by one, in the
// bots too, and the ratchet fails on it; one planted in src/engine/rules/ or a page's code isn't counted.
test.for([
  ['src/engine/realms/relations-and-captures.ts', "return 'allied';", 1],
  ['src/engine/bots/war.ts', "return ['enemy', 'treat'];", 2],
  ['src/engine/rules/the-registry-of-alignment-abilities.ts', "return 'enemy';", 0],
  ['src/ui/player/map-symbols.ts', "return 'neutral';", 0],
] as const)('%s: %s raises relationChecksInEngine by %i', ([file, body, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), relationChecksInEngine: relationChecksInEngine(files) };
  expect(asTheyAre.relationChecksInEngine, 'relationChecksInEngine on the tree as it is').toBe(
    readBaseline()['relationChecksInEngine'],
  );
  const withThePlant = files.map(([f, text]): [string, string] =>
    f === file ? [f, `${text}\nexport function aPlantedRelation() { ${body} }\n`] : [f, text],
  );
  const planted = { ...asTheyAre, relationChecksInEngine: relationChecksInEngine(withThePlant) };
  expect(planted.relationChecksInEngine, `relationChecksInEngine with ${body} planted in ${file}`).toBe(
    asTheyAre.relationChecksInEngine + rise,
  );
  expect(compare(asTheyAre, planted).rose, 'the ratchet fails on a rise').toHaveLength(rise > 0 ? 1 : 0);
});
