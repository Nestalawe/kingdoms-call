// A hero's minor titles add to his Tactical and lift the units he leads in a battle, as the engine did (B-06k): the
// Strategist's +1 Tactical, which commandScore, combatVsChar (each side) and combatVsNPC (the attacker and the guard who
// leads the defenders) added themselves, and the Naturalist's, the Beastmaster's, the Cavalier's and the Ironclad's
// ×1.05, which armStr and the army card asked of one rule on plain values, are now the effects of two stages of
// `strength` in the minor titles' registry, their numbers in the titles' rows.
// - The army perks: for every set of the four titles a commander may hold (none, each alone, any two, three, all four),
//   on a unit of each kind they lift (a Creature, a Monster, a cavalry unit, a Creature that is cavalry, a heavy unit, a
//   fleet that is a Creature) and of none, at several strengths, the strength and the perks are the old rule's (written
//   here as it was), both by the army card's rule and by armStr (its ladder's words too, in their order); the
//   Naturalist and the Beastmaster on one hero lift a unit once; each step rounds before the next.
// - The order: the registry's order of the stage is the army card's, read from the rows; each effect reads its row.
// - The Strategist: in each of the five places, a holder of Tactical 1 fights as a hero of Tactical 2 who holds none,
//   and not as one of Tactical 1 (commandScore's figure; the Tactical each battle records on its lines).
// Level 1 (unit): armStr and commandScore are functions of the turn's context; the battles are called directly
// (tests/lib/a-battle-called-directly.ts) on a world the engine makes from a fixed seed, no turn played. A static test
// can't run them, and the matrix may never give a guard the Strategist, nor a commander two of these titles at once.
// What is compared is worked out before any die decides the battle, so it doesn't depend on the dice.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { MINOR_TITLES } from '../../src/content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import { armStr } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { commandScore } from '../../src/engine/battle/best-commander.ts';
import {
  MINOR_CAV,
  MINOR_HEAVY,
  THE_MINOR_TITLES_WITH_AN_ARMY_PERK_IN_THEIR_ORDER,
  theStrengthAUnitsCommandersMinorTitlesLiftItTo,
  type AMinorTitleWithAnArmyPerk,
} from '../../src/engine/rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../../src/engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { THE_COMMANDERS_MINOR_TITLES_LIFT_THE_UNITS_HE_LEADS } from '../../src/engine/rules/the-minor-titles/a-heros-titles-add-to-his-tactical-and-lift-the-units-he-leads-in-a-battle.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES,
  theLevelsAHerosTitlesAddToHisTacticalInABattle,
} from '../../src/engine/rules/the-registry-of-the-minor-titles-perks.ts';
import type { AModifierOfAUnitInTheLadder } from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';
import type { ArmyInABattle, HeroInABattle } from '../../src/engine/army-tables.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import {
  aBattleAgainstTheProvince,
  aBattleBetweenHeroes,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  place,
  theTurnsContext,
  type Character,
  type World,
} from '../lib/a-battle-called-directly.ts';

const THE_TITLES: readonly AMinorTitleWithAnArmyPerk[] = ['naturalist', 'beastmaster', 'cavalier', 'ironclad'];
/** Every set of the four titles, by the bits of 0 to 15. */
const EVERY_SET: readonly (readonly AMinorTitleWithAnArmyPerk[])[] = Array.from({ length: 16 }, (_, bits) =>
  THE_TITLES.filter((_t, i) => (bits >> i) & 1),
);
/** A Creature, a Monster, a cavalry unit, a Creature that is cavalry, a heavy unit, a fleet that is a Creature, none. */
const THE_UNITS = [
  'Thunderbirds',
  'Cave Trolls',
  'Free Lances',
  'Unicorn Herd',
  'Siege Towers',
  'Great Turtles',
  'Men-at-Arms',
];

/** The old rule, as theStrengthAUnitsCommandersMinorTitlesLiftItTo wrote it before B-06k. */
function theOldRule(strength: number, unitType: string, holds: (title: AMinorTitleWithAnArmyPerk) => boolean) {
  let str = strength;
  const liftedBy: string[] = [];
  const _prim = CREATURE_ARMIES.has(unitType) || MONSTER_ARMIES.has(unitType);
  if (_prim && (holds('naturalist') || holds('beastmaster'))) {
    str = Math.round(str * 1.05);
    liftedBy.push('naturalist or beastmaster');
  }
  if (holds('cavalier') && MINOR_CAV.has(unitType)) {
    str = Math.round(str * 1.05);
    liftedBy.push('cavalier');
  }
  if (holds('ironclad') && MINOR_HEAVY.has(unitType)) {
    str = Math.round(str * 1.05);
    liftedBy.push('ironclad');
  }
  return { strength: str, liftedBy };
}
/** The ladder's words for each perk, as armStr wrote them before B-06k. */
const THE_OLD_LADDER: Readonly<Record<string, string>> = {
  'naturalist or beastmaster': "a naturalist's or beastmaster's title",
  cavalier: "a cavalier's title",
  ironclad: "an ironclad's title",
};

describe("the commander's minor titles lift the units he leads", () => {
  /** A unit of no race (so no kinship), Average. */
  const unit = (type: string): ArmyInABattle => ({ type, quality: 'Average', race: '', unitName: `the Test ${type}` });
  /** A hero of no realm, an Elf, Druid 4 (he leads each unit here with no shortfall and no mastery over its need). */
  const hero = { id: 7, name: 'Testhero', player: null, race: 'Elven', alignment: 'Neutral', skills: { druid: 4 } };
  /** The turn's context: realm 0, and the minor titles given held by the hero (or by another, id 8). */
  const turn = (held: readonly AMinorTitleWithAnArmyPerk[], byWhom = 7) =>
    ({
      G: {
        players: [{ alignment: 'Neutral', race: 'Human', discoveries: [] }],
        characters: [],
        _minorHolders: Object.fromEntries(held.map((t) => [t, { charId: byWhom }])),
      },
    }) as unknown as TurnContext;
  /** armStr's figure for `type` led by the hero, and the ladder's words for the titles. */
  const armStrOf = (type: string, t: TurnContext) => {
    const trace: AModifierOfAUnitInTheLadder[] = [];
    const s = armStr(t, unit(type), { ...hero, items: [] } as unknown as HeroInABattle, 'Neutral', null, {
      enemyForce: [],
      trace,
    });
    return { s, titles: trace.map((x) => x.reason.kind).filter((k) => k.endsWith(' title')) };
  };

  test.each(EVERY_SET.map((set) => [set.join(', ') || 'none', set] as const))(
    "holding %s: each unit's strength and perks are the old rule's, by the army card's rule and by armStr",
    (_label, set) => {
      const holds = (title: AMinorTitleWithAnArmyPerk) => set.includes(title);
      for (const type of THE_UNITS) {
        for (const strength of [9, 10, 30, 41, 50]) {
          expect(
            theStrengthAUnitsCommandersMinorTitlesLiftItTo(strength, type, holds),
            `${type} at ${String(strength)}`,
          ).toEqual(theOldRule(strength, type, holds));
        }
        // armStr's own figure for the unit, under no title, then lifted by the old rule: the same, and its ladder too
        const unlifted = armStrOf(type, turn([])).s;
        const old = theOldRule(unlifted, type, holds);
        expect(armStrOf(type, turn(set)), `armStr, ${type}`).toEqual({
          s: old.strength,
          titles: old.liftedBy.map((perk) => THE_OLD_LADDER[perk]),
        });
        expect(armStrOf(type, turn(set, 8)), `armStr, ${type}, another hero holding them`).toEqual({
          s: unlifted,
          titles: [],
        });
      }
    },
  );

  test('each perk alone lifts its kind ×1.05; the Naturalist and the Beastmaster together, once; two steps round in turn', () => {
    const one = (held: readonly AMinorTitleWithAnArmyPerk[], type: string, s: number) =>
      theStrengthAUnitsCommandersMinorTitlesLiftItTo(s, type, (t) => held.includes(t));
    expect(one(['naturalist'], 'Thunderbirds', 30)).toEqual({ strength: 32, liftedBy: ['naturalist or beastmaster'] });
    expect(one(['beastmaster'], 'Cave Trolls', 30)).toEqual({ strength: 32, liftedBy: ['naturalist or beastmaster'] });
    expect(one(['naturalist', 'beastmaster'], 'Cave Trolls', 30)).toEqual({
      strength: 32,
      liftedBy: ['naturalist or beastmaster'],
    });
    expect(one(['cavalier'], 'Free Lances', 41)).toEqual({ strength: 43, liftedBy: ['cavalier'] });
    expect(one(['ironclad'], 'Siege Towers', 50)).toEqual({ strength: 53, liftedBy: ['ironclad'] });
    // the Unicorn Herd, a Creature and cavalry, under the Beastmaster and the Cavalier: 10 → 10.5 → 11 → 11.55 → 12,
    // the Beastmaster's step first (the stage's order, not the rows'); ×1.1025 at once would give 11
    expect(one(['beastmaster', 'cavalier'], 'Unicorn Herd', 10)).toEqual({
      strength: 12,
      liftedBy: ['naturalist or beastmaster', 'cavalier'],
    });
    // the Great Turtles, a Creature and a fleet: 9 → 9.45 → 9 → 9.45 → 9 (×1.1025 at once would give 10)
    expect(one(['naturalist', 'ironclad'], 'Great Turtles', 9)).toEqual({
      strength: 9,
      liftedBy: ['naturalist or beastmaster', 'ironclad'],
    });
  });

  test("the registry's order of the stage is the army card's, read from the rows, and each effect reads its row", () => {
    expect([...THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES.strength["the commander's minor titles"]]).toEqual([
      ...THE_MINOR_TITLES_WITH_AN_ARMY_PERK_IN_THEIR_ORDER,
    ]);
    expect([...THE_MINOR_TITLES_WITH_AN_ARMY_PERK_IN_THEIR_ORDER]).toEqual(THE_TITLES);
    for (const title of THE_TITLES) {
      const row = MINOR_TITLES.find((t) => t.key === title);
      const perk =
        row && 'theCompaniesItsHolderLeadsFightStronger' in row ? row.theCompaniesItsHolderLeadsFightStronger : null;
      expect(perk?.by, `${title}'s row`).toBe(1.05);
      const lifted = THE_UNITS.filter((type) =>
        THE_COMMANDERS_MINOR_TITLES_LIFT_THE_UNITS_HE_LEADS[title]({ unitType: type }),
      );
      expect(
        THE_UNITS.map((type) => THE_COMMANDERS_MINOR_TITLES_LIFT_THE_UNITS_HE_LEADS[title]({ unitType: type })).filter(
          (step) => step !== null,
        ),
        `${title}'s steps`,
      ).toEqual(lifted.map(() => ({ multipliesBy: perk?.by, thePerk: perk?.thePerk })));
    }
  });
});

describe('the Strategist adds his +1 to the Tactical each battle fights with', () => {
  const SEED = 1;
  /** The world, the Strategist held by the hero `who` picks (or by none). */
  const holdingTheStrategist = (G: World, c: Character | null) => {
    Object.assign(G, {
      _minorHolders: c ? { strategist: { charId: c.id, playerIndex: c.player, name: 'The Strategist' } } : {},
    });
  };
  /** Every Tactical a battle records on its lines: the level a side's host is marked with, and the ladder's multipliers. */
  const theTacticalRecorded = (narrative: readonly unknown[]): unknown[] => {
    const found: unknown[] = [];
    const visit = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v !== null && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if ('tacticalLevel' in o) found.push({ tacticalLevel: o['tacticalLevel'] });
        if (o['kind'] === 'tactical' || o['kind'] === 'tactical at its level') found.push(o);
        Object.values(o).forEach(visit);
      }
    };
    visit(narrative);
    return found;
  };
  /** Each case: a holder of Tactical 1, one of Tactical 2 who holds none, one of Tactical 1 who holds none. */
  const theThree = (fight: (tactical: number, holds: boolean) => unknown) => ({
    holder: fight(1, true),
    two: fight(2, false),
    one: fight(1, false),
  });

  test('commandScore: a Strategist of Tactical 1 leads a pooled host as one of Tactical 2', () => {
    const score = (tactical: number, holds: boolean) => {
      const G = aWorld(SEED);
      const { field } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
      const H = G.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
      if (!H) throw new Error('realm 0 has no hero but its king');
      H.armies = companies('Shieldwall Levies', 4, 'Average');
      H.items = [];
      H.skills = { ...H.skills, tactical };
      holdingTheStrategist(G, holds ? H : null);
      const tc = theTurnsContext(G);
      return commandScore(...([tc, H, H.armies, field, true] as unknown as Parameters<typeof commandScore>));
    };
    const { holder, two, one } = theThree(score);
    expect(holder).toBe(two);
    expect(holder).not.toBe(one);
  });

  /** Realm 0's king attacks realm 1's on a plain of realm 1's, the Strategist held by the side named, of the Tactical
   *  given; the other side's commander has Tactical 0. */
  const theRealmBattle = (side: 'attacker' | 'defender') => (tactical: number, holds: boolean) => {
    const G = aWorld(SEED);
    G.relations['0-1'] = 'enemy';
    const [A, B] = [0, 1].map((pi) => G.characters.find((c) => c.alive && c.isKing && c.player === pi));
    if (!A || !B) throw new Error('the world has no king in realm 0 or 1');
    const { field: X, from: Z } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
    own(G, X, 1);
    own(G, Z, 0);
    A.armies = companies('Shieldwall Levies', 4, 'Average');
    B.armies = companies('Shieldwall Levies', 4, 'Average');
    const [his, other] = side === 'attacker' ? [A, B] : [B, A];
    his.skills = { ...his.skills, tactical };
    other.skills = { ...other.skills, tactical: 0 };
    for (const c of [A, B]) {
      c.items = [];
      c.encounterPlan = MELEE_AND_NO_DUEL();
    }
    holdingTheStrategist(G, holds ? his : null);
    place(G, B, X);
    attackFrom(G, A, Z, X);
    return theTacticalRecorded(aBattleBetweenHeroes(theTurnsContext(G), A, B, X).narrative);
  };
  /** Realm 0's first hero attacks a guard made by the test on a free plain, the Strategist held by the side named, of
   *  the Tactical given; the other side's commander has Tactical 0. */
  const theProvinceBattle = (side: 'attacker' | 'guard') => (tactical: number, holds: boolean) => {
    const G = aWorld(SEED);
    const H = G.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
    if (!H) throw new Error('realm 0 has no hero but its king');
    const { field: N, from: P } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
    own(G, P, 0);
    const guard = aGuardMadeByTheTest(G, N, companies('Shieldwall Levies', 4, 'Average'), {
      skills: { tactical: side === 'guard' ? tactical : 0 },
    });
    H.armies = companies('Shieldwall Levies', 4, 'Average');
    H.items = [];
    H.skills = { ...H.skills, tactical: side === 'attacker' ? tactical : 0 };
    H.encounterPlan = MELEE_AND_NO_DUEL();
    holdingTheStrategist(G, holds ? (side === 'attacker' ? H : guard) : null);
    attackFrom(G, H, P, N);
    return theTacticalRecorded(aBattleAgainstTheProvince(theTurnsContext(G), H, N, guard).narrative);
  };

  test.each([
    ['a battle between heroes, the attacker', theRealmBattle('attacker')],
    ['a battle between heroes, the defender', theRealmBattle('defender')],
    ["a battle against a province's defenders, the attacker", theProvinceBattle('attacker')],
    ["a battle against a province's defenders, the guard who leads them", theProvinceBattle('guard')],
  ] as const)('%s: a Strategist of Tactical 1 fights as one of Tactical 2', (_label, battle) => {
    const { holder, two, one } = theThree(battle);
    expect(holder, 'the battle records a Tactical').not.toEqual([]);
    expect(holder).toEqual(two);
    expect(holder).not.toEqual(one);
  });

  test("the runner adds the Strategist's level from his row, asking only of the Strategist", () => {
    const asked: string[] = [];
    expect(
      theLevelsAHerosTitlesAddToHisTacticalInABattle((t) => {
        asked.push(t);
        return true;
      }),
    ).toBe(1);
    expect(asked).toEqual(['strategist']);
    expect(theLevelsAHerosTitlesAddToHisTacticalInABattle(() => false)).toBe(0);
  });
});
