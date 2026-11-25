// The portal's code the alignment rows have taken names no alignment (B-06, T7, the rules pulled out: Run 3e, the
// player portal's alignment rules): each function (or file's top level) of src/ui/, src/views/ or src/shared/ the
// family's rows have taken holds no string naming an alignment (`'Neutral'`, `'Undead'`), whatever the code does with
// the name (compared, a `case`, a lookup, a list, a map's value, a literal type, or in a function nested inside). It
// reads the alignment's row or content's constant instead. Each row adds what it takes to TAKEN. With them, the
// ratchet's count of the alignments the portal, the views and the shared rules name (tools/ratchet.ts's
// alignmentChecksOutsideTheEngine, by its helper alignmentChecksOutsideTheEngineByFunction), so that count only falls:
// the helper counts each alignment planted there, and none in the engine. Its one listed exception (the map's label of
// the relation "neutral") is still in its function, and lets only one string through. Not seen: an alignment's rule
// written in prose or in a page's HTML.
//
// Level 0 (static): the files' syntax trees and content's list of alignments as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  ALIGNMENT_VOCABULARY,
  alignmentChecksOutsideTheEngine,
  alignmentChecksOutsideTheEngineByFunction,
  compare,
  countsAlignmentChecksOutsideTheEngine,
  readBaseline,
  THE_ALIGNMENT_WORDS_OUTSIDE_THE_ENGINE_THAT_ARE_NOT_AN_ALIGNMENT,
  theCodeFiles,
} from '../../tools/ratchet.ts';
import { everyStringIn, TOP } from '../lib/the-strings-a-function-of-the-code-holds.ts';

/** Each function (or a file's top level) of the portal, the views or the shared rules the alignment rows have taken,
 *  by its file, from the row that took it: each row adds what it takes. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  ['src/ui/gm/turn-zero.ts', 'runTurn0', 'B-06br'],
  ['src/ui/player/join-and-chronicle.ts', 'showJoinGame', 'B-06br'],
  ['src/ui/player/pre-orders.ts', 'injectResurrectOrders', 'B-06br'],
  ['src/ui/player/pre-orders.ts', 'injectCharmOrders', 'B-06br'],
  [
    'src/ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts',
    'heroHireWageOfP',
    'B-06br',
  ],
  ['src/views/turn-report.ts', 'buildTurnReport', 'B-06br'],
  ['src/views/what-each-realm-may-see-of-the-world.ts', 'otherHeroAsSeen', 'B-06br'],
  ['src/views/what-each-realm-may-see-of-the-world.ts', 'provinceAsSeen', 'B-06br'],
];

const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const isAnAlignment = (word: string): boolean => ALIGNMENT_VOCABULARY.has(word);

test.for(TAKEN)('%s: %s names no alignment (%s)', ([file, fn]) => {
  const text = read(file);
  const counts = alignmentChecksOutsideTheEngineByFunction(file, text);
  expect(countsAlignmentChecksOutsideTheEngine(file), `${file} is one the count reads`).toBe(true);
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s names of an alignment (the ratchet's helper)`).toBe(0);
  const theExceptions = THE_ALIGNMENT_WORDS_OUTSIDE_THE_ENGINE_THAT_ARE_NOT_AN_ALIGNMENT.filter(
    ([f, g]) => f === file && g === fn,
  ).map(([, , word]) => word);
  expect(everyStringIn(file, text, fn, isAnAlignment), `every string in ${fn} naming an alignment`).toEqual(
    theExceptions,
  );
});

// A listed exception that its function no longer holds would let a new alignment through: it is still there, once.
test.for(THE_ALIGNMENT_WORDS_OUTSIDE_THE_ENGINE_THAT_ARE_NOT_AN_ALIGNMENT)(
  '%s: %s still holds its %s (%s)',
  ([file, fn, word]) => {
    expect(
      everyStringIn(file, read(file), fn, (w) => w === word),
      `${fn}'s ${word}`,
    ).toEqual([word]);
    expect(
      alignmentChecksOutsideTheEngineByFunction(file, read(file)).get(fn) ?? 0,
      `${fn}'s alignments, its exception let through`,
    ).toBe(0);
  },
);

test('the files the count reads are the TypeScript of src/ui/, src/views/ and src/shared/', () => {
  expect(
    [
      'src/ui/player/map-symbols.ts',
      'src/views/every-realms-report-and-the-lines-each-realm-reads.ts',
      'src/shared/the-engines-rules-the-player-portal-shares.ts',
      'src/engine/grand-design.ts',
      'src/content/kingdoms-call-data.ts',
      'src/ui/player/player-portal.html',
      'src/ui/types.d.ts',
    ].map(countsAlignmentChecksOutsideTheEngine),
  ).toEqual([true, true, true, false, false, false, false]);
});

// The helper finds what it counts: each form of an alignment planted in one function (an arrow given to a name counts
// for that name, as a named function does; one outside every function for the top level), and none of what isn't an
// alignment or is a literal type or a property's key.
test("the ratchet's helper counts each alignment's name, a literal type's and a key's aside", () => {
  const planted = `
    type Creed = 'Divine' | 'Undead';
    const GUIDE = { Druidic: 'Creatures', x: 'Evil' };
    export function planted(r: { alignment?: string }) {
      const a = (r.alignment === 'Pagan') + ['Good', 'Neutral'].length;
      const inner = () => \`Undead\`;
      return a + inner() + (r.alignment || 'Neutral') + 'neutral';
    }`;
  expect(Object.fromEntries(alignmentChecksOutsideTheEngineByFunction('src/ui/planted.ts', planted))).toEqual({
    [TOP]: 1,
    planted: 4,
    inner: 1,
  });
});

// The count on the tree is the ratchet's baseline; an alignment planted in a function of the portal, the views or the
// shared rules raises it by one, and the ratchet fails on it; one planted in the engine isn't counted here.
test.for([
  ['src/ui/player/map-symbols.ts', "return 'Neutral';", 1],
  ['src/views/every-realms-report-and-the-lines-each-realm-reads.ts', "return ['Evil', 'Undead'];", 2],
  ['src/shared/the-engines-rules-the-player-portal-shares.ts', "return 'Divine';", 1],
  ['src/engine/grand-design.ts', "return 'Pagan';", 0],
] as const)('%s: %s raises alignmentChecksOutsideTheEngine by %i', ([file, body, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), alignmentChecksOutsideTheEngine: alignmentChecksOutsideTheEngine(files) };
  expect(asTheyAre.alignmentChecksOutsideTheEngine, 'alignmentChecksOutsideTheEngine on the tree as it is').toBe(
    readBaseline()['alignmentChecksOutsideTheEngine'],
  );
  const withThePlant = files.map(([f, text]): [string, string] =>
    f === file ? [f, `${text}\nexport function aPlantedAlignment() { ${body} }\n`] : [f, text],
  );
  const planted = { ...asTheyAre, alignmentChecksOutsideTheEngine: alignmentChecksOutsideTheEngine(withThePlant) };
  expect(
    planted.alignmentChecksOutsideTheEngine,
    `alignmentChecksOutsideTheEngine with ${body} planted in ${file}`,
  ).toBe(asTheyAre.alignmentChecksOutsideTheEngine + rise);
  expect(compare(asTheyAre, planted).rose, 'the ratchet fails on a rise').toHaveLength(rise > 0 ? 1 : 0);
});
