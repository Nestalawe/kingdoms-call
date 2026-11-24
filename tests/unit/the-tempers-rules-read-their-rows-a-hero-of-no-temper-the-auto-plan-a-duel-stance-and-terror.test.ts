// The tempers' rules read their rows (B-06ai, T7, the rules pulled out: the tempers' family), each figure as it was: a
// hero of no temper fights as Brave (content's constant, read by effTemper and temperOf, which reads a name no row has
// as Brave's row); a hero's auto plan (a neutral's or a bot's) keeps an exit and five actions when his temper's row
// says so (Cautious, Cowardly) and charges, firing once, when it says so (Berserk); a commander with no orders answers
// single combat by his temper's row (Berserk and Brave challenge, Cautious accepts, Cowardly refuses; the guardians'
// row of no temper and a name no row has accept); and terror's courage test adds his temper's figure (Berserk −15,
// Brave −10, Cautious −5, Cowardly +10; none for the row of no temper or a name no row has). No matrix game shows these
// apart: no seeded hero is of no temper, the courage test is called by no guardian's ability today, and the balance
// games hold a plan and a stance only as a fight's outcome.
//
// Level 1 (unit): the engine's functions called directly on plain heroes and fighters. Not lower: a static test can't
// run them, and the temper, the plan, the stance and the chance are what they hand on.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { TEMPER_TRAITS } from '../../src/content/kingdoms-call-data.ts';
import { effTemper } from '../../src/engine/items/equipment.ts';
import {
  autoEncounterPlan,
  duelStanceOf,
  ensureEncounterPlan,
} from '../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts';
import { pcCourageChance } from '../../src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts';
import { temperOf } from '../../src/engine/world/tables.ts';

/** The tempers a hero may hold: content's four, the guardians' row of no temper, a name no row has and none. */
const TEMPERS = ['Berserk', 'Brave', 'Cautious', 'Cowardly', 'None', 'Fey', undefined] as const;

/** A hero with no orders and no realm, of the temper given (none: no temper), Melee 2 and Archery 3, no magic. */
const aNeutralHero = (temper: string | undefined) => ({
  id: 1,
  name: 'Odo the Grey',
  player: null,
  alive: true,
  items: [],
  skills: { melee: 2, archery: 3 },
  ...(temper === undefined ? {} : { temper }),
});

describe('a hero of no temper fights as Brave', () => {
  test("effTemper: no hero, no temper, an empty one or a null one is Brave's; a temper is his own", () => {
    const theTempers = [null, undefined, {}, { temper: '' }, { temper: null }, { temper: 'Cautious' }].map((c) =>
      effTemper(c),
    );
    expect(theTempers.join(' '), 'no hero, none, empty, null, Cautious').toBe('Brave Brave Brave Brave Brave Cautious');
  });
  test("temperOf: a name no row has, none or an empty one reads as Brave's row; a temper's name its own", () => {
    for (const t of ['Fey', undefined, null, ''])
      expect(temperOf(t), `temperOf(${String(t)})`).toBe(TEMPER_TRAITS.Brave);
    expect(temperOf('Berserk'), 'temperOf(Berserk)').toBe(TEMPER_TRAITS.Berserk);
  });
});

describe("a hero's auto plan, by his temper's row", () => {
  test('Cautious and Cowardly keep an exit and five actions; Berserk charges, firing once; every other works the bow', () => {
    const theTurn = { G: { characters: [], players: [] } };
    // `as`: a plain hero of the few fields the plan reads
    const thePlans = TEMPERS.map(
      (t) => `${t ?? 'none'}: ${autoEncounterPlan(theTurn as never, aNeutralHero(t) as never).join(' ')}`,
    );
    expect(thePlans.join('; ')).toBe(
      'Berserk: FI ME ME ME ME ME; Brave: FI FI FI ME ME ME; Cautious: FI FI FI ME ME FL; ' +
        'Cowardly: FI FI FI ME ME FL; None: FI FI FI ME ME ME; Fey: FI FI FI ME ME ME; none: FI FI FI ME ME ME',
    );
  });
});

describe("a commander with no orders answers single combat by his temper's row", () => {
  const STANCES =
    'Berserk: challenge; Brave: challenge; Cautious: accept; Cowardly: refuse; None: accept; Fey: accept; none: challenge';
  test('duelStanceOf: a neutral commander with no stance set', () => {
    // `as`: a plain hero of the few fields the stance reads
    const theStances = TEMPERS.map((t) => `${t ?? 'none'}: ${duelStanceOf(aNeutralHero(t) as never)}`);
    expect(theStances.join('; ')).toBe(STANCES);
  });
  test('ensureEncounterPlan: the plan it gives a neutral commander with no plan', () => {
    const theTurn = { G: { characters: [], players: [] }, _botPlayerIdx: undefined };
    const theStances = TEMPERS.map(
      (t) => `${t ?? 'none'}: ${ensureEncounterPlan(theTurn as never, aNeutralHero(t) as never)?.duelStance ?? '?'}`,
    );
    expect(theStances.join('; ')).toBe(STANCES);
  });
});

describe("terror's courage test adds the temper's figure", () => {
  test('Melee 4 facing no creature: 55 − 20, then Berserk −15, Brave −10, Cautious −5, Cowardly +10, every other none', () => {
    const theChances = TEMPERS.map(
      (t) => `${t ?? 'none'}: ${String(pcCourageChance({ melee: 4, archery: 0, temper: t ?? '' }, null))}`,
    );
    expect(theChances.join('; ')).toBe(
      'Berserk: 20; Brave: 25; Cautious: 30; Cowardly: 45; None: 35; Fey: 35; none: 35',
    );
  });
});
