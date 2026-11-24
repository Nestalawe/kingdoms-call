// Each copy of how two realms stand gives the relation reader's answer on every state (B-06aq): the readers on a state
// that can't import relationBetween (the report's relOfReport, the bots' botRelationRaw, the Reckoning's alliedBloc)
// and the reads of a pair's entry inside diplomacy's resolution and war without warning (theStateThePairsEntryHolds)
// each ask the one key and the one reader of a pair's entry. Each is held to relationBetween over every state a save
// allows: no relations, a pair with no entry, a blank one, each of the three states, a word no state is, a realm
// missing, and a realm with itself (where relationBetween says 'self', and each copy keeps its own answer, Neutral).
// The three states and the Treat are the content's constants, each the word a save writes.
// Level 1 (unit): plain functions on staged values, called directly on the engine's modules; a static check can't run
// them, and no matrix game stages a missing or a blank entry, a word no state is, or a realm with itself.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  THE_STATE_A_PAIR_WITH_NO_ENTRY_STANDS_IN,
  THE_STATES_TWO_REALMS_STAND_IN,
  THE_TREAT_DECLARATION,
} from '../../src/content/the-relations-between-two-realms-the-three-states-a-pair-stands-in-and-the-treat-declaration.ts';
import {
  relKeyOf,
  theStateThePairsEntryHolds,
} from '../../src/engine/rules-on-plain-values/how-two-realms-stand-the-key-of-the-pair-and-the-state-its-entry-holds.ts';
import { areAllied, areEnemies, relationBetween } from '../../src/engine/realms/relations-and-captures.ts';
import { relOfReport } from '../../src/engine/heroes/fame-and-consecration.ts';
import { botRelationRaw } from '../../src/engine/bots/intel.ts';
import { alliedBloc } from '../../src/engine/titles/reckoning.ts';

type TheRelations = Record<string, string> | undefined;
/** The relations a save may hold for realms 1 and 3 (key "1-3"), each by its name; the last holds an entry for realm
 *  3 with itself too (key "3-3"), which no reader but the reads of a pair's entry ever reads. */
const THE_STATES_A_SAVE_ALLOWS: readonly (readonly [name: string, relations: TheRelations])[] = [
  ['no relations at all', undefined],
  ['no entry for the pair', { '0-1': 'allied' }],
  ['a blank entry', { '1-3': '' }],
  ['at war', { '1-3': 'enemy' }],
  ['allied', { '1-3': 'allied' }],
  ['neutral', { '1-3': 'neutral' }],
  ['a word no state is', { '1-3': 'sworn-brothers' }],
  ['an entry for realm 3 with itself', { '1-3': 'enemy', '3-3': 'allied' }],
];
/** The pairs asked: either way round, a realm missing on either side, and a realm with itself. */
const THE_PAIRS: readonly (readonly [a: number | null | undefined, b: number | null | undefined])[] = [
  [1, 3],
  [3, 1],
  [null, 3],
  [1, undefined],
  [3, 3],
];
/** relationBetween's answer, on a save's relations (a save always has them: none is read as an empty list). */
const theReadersAnswer = (relations: TheRelations, a: number | null | undefined, b: number | null | undefined) =>
  relationBetween({ G: { relations: relations ?? {} } } as never, a, b);
/** A copy's answer where relationBetween says 'self' (a realm with itself): Neutral. */
const asACopyAnswers = (answer: string) => (answer === 'self' ? THE_STATES_TWO_REALMS_STAND_IN.neutral : answer);

const everyCase = THE_STATES_A_SAVE_ALLOWS.flatMap(([name, relations]) =>
  THE_PAIRS.map(([a, b]) => ({ name, relations, a, b })),
);

describe('the home: relationBetween, areEnemies and areAllied', () => {
  test.for(everyCase)('$name, realms $a and $b', ({ relations, a, b }) => {
    const answer = theReadersAnswer(relations, a, b);
    const entry = a != null && b != null && a !== b ? (relations?.['1-3'] ?? '') : '';
    const expected = a != null && b != null && a === b ? 'self' : entry || 'neutral';
    expect(answer, `relationBetween(${String(a)}, ${String(b)})`).toBe(expected);
    const G = { relations: relations ?? {} };
    expect(areEnemies({ G } as never, a, b), 'areEnemies').toBe(expected === 'enemy');
    expect(areAllied({ G } as never, a, b), 'areAllied').toBe(expected === 'allied');
  });

  test('the key of a pair is the lower realm first, either way round', () => {
    expect([relKeyOf(1, 3), relKeyOf(3, 1), relKeyOf(0, 12), relKeyOf(12, 0)]).toEqual(['1-3', '1-3', '0-12', '0-12']);
  });
});

describe('each copy gives the reader’s answer, and Neutral for a realm with itself', () => {
  test.for(everyCase)('relOfReport (the report’s): $name, realms $a and $b', ({ relations, a, b }) => {
    expect(relOfReport({ relations }, a, b), `relOfReport(${String(a)}, ${String(b)})`).toBe(
      asACopyAnswers(theReadersAnswer(relations, a, b)),
    );
  });

  test.for(everyCase)('botRelationRaw (the bots’): $name, realms $a and $b', ({ relations, a, b }) => {
    expect(botRelationRaw({ relations } as never, a, b), `botRelationRaw(${String(a)}, ${String(b)})`).toBe(
      asACopyAnswers(theReadersAnswer(relations, a, b)),
    );
  });

  // The reads inside diplomacy's resolution and war without warning: a pair of two realms, never a realm missing, and
  // never one with itself (each loop skips it); on a realm with itself the read is that realm's own entry, as the
  // inline reads were, Neutral when it has none.
  test.for(everyCase.filter(({ a, b }) => a != null && b != null))(
    'the reads inside diplomacy’s resolution and war without warning: $name, realms $a and $b',
    ({ relations, a, b }) => {
      if (a == null || b == null) throw new Error('a pair of two realms');
      const expected =
        a === b ? (relations?.[`${String(a)}-${String(a)}`] ?? '') || 'neutral' : theReadersAnswer(relations, a, b);
      expect(theStateThePairsEntryHolds(relations, a, b), `the entry of ${String(a)} and ${String(b)}`).toBe(expected);
    },
  );

  // alliedBloc: the realm itself, then every other realm the reader calls allied, in their order.
  test.for(THE_STATES_A_SAVE_ALLOWS)('alliedBloc (the Reckoning’s): %s', ([, relations]) => {
    const players = [{}, {}, {}, {}];
    for (const pi of [1, 3]) {
      const expected = [pi, ...[0, 1, 2, 3].filter((y) => y !== pi && theReadersAnswer(relations, pi, y) === 'allied')];
      expect(alliedBloc({ relations, players } as never, pi), `realm ${String(pi)}'s bloc`).toEqual(expected);
    }
  });
});

test('the three states and the Treat are the words a save writes', () => {
  expect(THE_STATES_TWO_REALMS_STAND_IN).toEqual({ atWar: 'enemy', allied: 'allied', neutral: 'neutral' });
  expect(THE_STATE_A_PAIR_WITH_NO_ENTRY_STANDS_IN).toBe('neutral');
  expect(THE_TREAT_DECLARATION).toBe('treat');
});
