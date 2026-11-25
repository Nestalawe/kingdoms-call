// Personal combat's speed, a change of range, the plans, a hero's hit points, the mastery perks, a flight, a rebirth,
// an arrow and a theft read their rows' figures where no game of the matrix reaches, or where one reaches them but no
// case would tell a figure changed by a little (B-06bo: the numbers of personal combat's speed, encounter plans and
// combatants, its melee, flight and archery, and its tactics moved to content's rows, src/content/kingdoms-call-data.ts,
// each named for its rule). Each case is worked out by hand from the rule, and the figures are written here as
// literals, so a row's figure changed fails a case:
// - a guardian's speed by his pace is 3, 2 and 1, one of a pace the table holds not 2, a hero's 2 and his bonus, no
//   fighter's 2 (KC_A_FIGHTERS_SPEED_IN_PERSONAL_COMBAT);
// - breaking away is 40% against a foe of his own speed, 15% a step of speed; advancing is 60% at speed 2, 15% a step
//   above it (a slow guardian advances as at 2); a hero's raw Archery adds 5% a level; from 10% to 90%; a fast guardian
//   closes 2 ranges in one advance (KC_THE_CHANCE_A_FIGHTER_CHANGES_RANGE_IN_PERSONAL_COMBAT);
// - a fighter whose record holds no most HP is read at 20 when his temper weighs a flight, when he weighs a draught or
//   a ward, and when a draught heals him (KC_THE_MOST_HP_OF_A_FIGHTER_WHOSE_RECORD_HOLDS_NONE);
// - a hero with no orders plans 6 actions, a wary one fills 5 with blows before his flight, an archer opens with 3
//   shots (KC_THE_ENCOUNTER_PLAN_OF_A_HERO_WITH_NO_ORDERS);
// - the unkillable wanderer at no HP enters with half his most, rounded; a guardian of no HP has 10; a hero whose
//   record holds no most HP has 20 (KC_A_FIGHTERS_HIT_POINTS_AS_HE_ENTERS_A_PERSONAL_COMBAT,
//   KC_THE_MOST_HP_OF_A_FIGHTER_WHOSE_RECORD_HOLDS_NONE);
// - Counterattack and Trueshot from Melee 8 and Archery 8 (the third mastery tier); a riposte, an impaling arrow and
//   a Trueshot each at a die below 0.5, not at 0.5; an impaling arrow bleeds 1 to 3
//   (KC_THE_MASTERY_PERKS_OF_MELEE_AND_ARCHERY_IN_PERSONAL_COMBAT);
// - a guardian plans 12 actions, a shot at each 4th and a power at each 3rd; a power of no chance named is used at 50%
//   (KC_A_GUARDIANS_PLAN_IN_PERSONAL_COMBAT);
// - a flight is 30%, 25% more against a slow guardian and 15% less against a fast one, a hero foe read at speed 2, a
//   Charm's ×2, from 5% to 95% (KC_THE_CHANCE_A_FIGHTER_FLEES_IN_PERSONAL_COMBAT);
// - a guardian reborn rises with 40% of his most HP, rounded, at least 5 (KC_A_GUARDIANS_REBIRTH_IN_PERSONAL_COMBAT);
// - an archer of Archery 3 looses 2 arrows; an arrow is 1 to 3 and half his Archery, rounded up
//   (KC_AN_ARROW_IN_PERSONAL_COMBAT);
// - a theft is 50%, 10% a level of Thief to 5, less the guardian's grade's penalty, at most 95%
//   (KC_A_PARLEY_A_THEFT_AND_A_SCOUTING_IN_PERSONAL_COMBAT). Its least, 5%, binds no theft (the lowest is 15%: Thief 1
//   against a Legendary guardian, of no bonus), nor its Thief counted to 5 (the level a theft reads already counts at
//   most 5: theLevelAHerosSkillCountsAt), and the parley's and the scouting's figures are read by no fight while
//   their tactics are switched off (PARLEY_ENABLED, SCOUT_ENABLED): no case here.
//
// Level 1 (unit): the engine's functions called directly on staged fighters and a hero of the world (tests/lib/
// personal-combat.ts), the dice pinned (pc.pinned). Not lower: each figure is read inside a computed value.
import { describe, expect, test } from 'vitest';
import { clone, personalCombatEngine } from '../lib/personal-combat.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { Character } from '../../src/schemas/saved-game-state.ts';

const pc = await personalCombatEngine();
/** The turn's context the engine made for this world (the test library's type names only the fields it reads). */
const tc = pc.turnContext as unknown as TurnContext;
const { autoEncounterPlan, pcCharCombatant, pcMonsterCombatant, pcMonsterPlan, pcMoveCheck, pcNewStatus, pcSpeedOf } =
  await import('../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts');
const { pcAdvanceOrStrike, pcArrowDamage, pcFireOne, pcFleeChance, pcFreeStrike, pcTryCounter, pcVolleySize } =
  await import('../../src/engine/personal-combat/melee-flight-and-archery.ts');
const { pcAct, pcCombatItemWanted, pcTemperFallback, pcUseCombatItem } =
  await import('../../src/engine/personal-combat/tactics-combat-items-and-actions.ts');

type Staged = Record<string, unknown>;
/** A plain fighter (a guardian of no perks, 20 HP, Melee 2, no wards, of the temper "None": no bonus), with the
 *  fields given. */
function fighter(over: Staged = {}): AFighterInAPersonalCombat {
  const f: Staged = { ...pcMonsterCombatant({ name: 'Made-up Mole', hp: 20, melee: 2 }), ...over };
  return f as unknown as AFighterInAPersonalCombat;
}
/** A hero's fighter as far as these rules read him: a plain fighter of the kind "character", with the fields given. */
const heroFighter = (over: Staged = {}) => fighter({ kind: 'character', speedName: undefined, ...over });
/** A guardian of a pace. */
const guardianOfPace = (speedName: string, over: Staged = {}) => fighter({ speedName, ...over });
/** A fighter's status as pcNewStatus makes it, with the fields given. */
const status = (over: Staged = {}) => ({ ...pcNewStatus(), ...over });
/** A line of a narrative as the fact it is, read by its fields. */
type AFact = Readonly<Record<string, unknown>>;
const facts = (narrative: readonly NarrativeLine[]): AFact[] =>
  narrative.map((l): AFact => {
    if (typeof l === 'string') return { kind: l };
    const theFact: object = l;
    return Object.fromEntries(Object.entries(theFact));
  });
/** The lines of a kind. */
const ofKind = (lines: readonly AFact[], kind: string) => lines.filter((l) => l['kind'] === kind);
/** A hero of the world, copied, of no items, titles or magic, with the skills and fields given. */
function aHero(skills: Record<string, number>, over: Staged = {}): Character {
  const theHero: Staged = {
    ...clone(pc.base),
    items: [],
    skills: { ...Object.fromEntries(Object.keys(pc.base.skills).map((k) => [k, 0])), ...skills },
    ...over,
  };
  return theHero as unknown as Character;
}

describe("a fighter's speed and a change of range", () => {
  test('a guardian is 3, 2 or 1 by his pace, 2 of a pace the table holds not; a hero 2 and his bonus; no fighter 2', () => {
    expect(['fast', 'medium', 'slow', 'a made-up pace'].map((p) => pcSpeedOf(guardianOfPace(p)))).toEqual([3, 2, 1, 2]);
    expect([pcSpeedOf(heroFighter()), pcSpeedOf(heroFighter({ speedBonus: 1 })), pcSpeedOf(null)]).toEqual([2, 3, 2]);
  });
  test('breaking away is 40% against a foe of his own speed, 15% a step of speed, at least 10%', () => {
    const away = (a: AFighterInAPersonalCombat, f: AFighterInAPersonalCombat) => pcMoveCheck(a, f, 'withdraw');
    expect([
      away(guardianOfPace('medium'), guardianOfPace('medium')),
      away(guardianOfPace('fast'), guardianOfPace('medium')),
      away(guardianOfPace('slow'), guardianOfPace('medium')),
      away(heroFighter({ speedBonus: -2 }), guardianOfPace('fast')),
    ]).toEqual([40, 55, 25, 10]);
  });
  test('advancing is 60% at speed 2, 15% a step above it, a slow guardian as at 2, at most 90%', () => {
    const on = (a: AFighterInAPersonalCombat) => pcMoveCheck(a, guardianOfPace('medium'), 'advance');
    expect([
      on(guardianOfPace('medium')),
      on(guardianOfPace('fast')),
      on(guardianOfPace('slow')),
      on(heroFighter({ speedBonus: -1 })),
      on(heroFighter({ speedBonus: 3 })),
    ]).toEqual([60, 75, 60, 45, 90]);
  });
  test("a hero's raw Archery adds 5% a level to both range checks (Fieldcraft)", () => {
    const archer = heroFighter({ archeryRaw: 2 });
    expect([pcMoveCheck(archer, heroFighter(), 'advance'), pcMoveCheck(archer, heroFighter(), 'withdraw')]).toEqual([
      70, 50,
    ]);
  });
  test('a fast guardian closes 2 ranges in one advance, a medium one 1', () => {
    const closes = (pace: string) => {
      const state = { range: 'spell' };
      const narrative: NarrativeLine[] = [];
      pcAdvanceOrStrike(tc, guardianOfPace(pace), heroFighter(), narrative, state);
      const steps = ofKind(facts(narrative), 'a fighter advances and the combatants close').map((l) => l['steps']);
      return [state.range, steps];
    };
    expect([closes('fast'), closes('medium')]).toEqual([
      ['melee', [2]],
      ['bow', [1]],
    ]);
  });
});

describe('the plans', () => {
  /** The plan of a hero with no orders, of Archery 3 and Melee 2, of the temper given. */
  const planOf = (temper: string) => autoEncounterPlan(tc, aHero({ archery: 3, melee: 2 }, { temper }));
  test('a hero with no orders plans 6 actions: an archer opens with 3 shots; a wary one keeps the last for flight', () => {
    expect(planOf('Brave')).toEqual(['FI', 'FI', 'FI', 'ME', 'ME', 'ME']);
    expect(planOf('Cautious')).toEqual(['FI', 'FI', 'FI', 'ME', 'ME', 'FL']);
    expect(planOf('Berserk')).toEqual(['FI', 'ME', 'ME', 'ME', 'ME', 'ME']);
  });
  test('a guardian plans 12 actions, a shot at each 4th and his next power at each 3rd', () => {
    const plan = pcMonsterPlan({
      spells: [
        { name: 'Made-up Roar', effect: 'roars' },
        { name: 'Made-up Howl', effect: 'howls' },
      ],
      archery: 1,
    });
    expect(plan).toEqual([
      'MS:Made-up Roar',
      'FI',
      'ME',
      'ME',
      'FI',
      'ME',
      'MS:Made-up Howl',
      'ME',
      'FI',
      'MS:Made-up Roar',
      'ME',
      'ME',
    ]);
  });
  test('a power whose record names no chance is used at 50%: at a die of 0.5 the moment slips away', () => {
    const slips = (die: number) => {
      const roar = { name: 'Made-up Roar', effect: 'roars', dmgW: 1 };
      const actor = fighter({ specials: [roar], tactics: ['MS:Made-up Roar'], tacIdx: 0 });
      const narrative: NarrativeLine[] = [];
      pc.pinned(die, () => {
        pcAct(tc, actor, heroFighter(), narrative, { range: 'melee' });
      });
      return ofKind(facts(narrative), 'a fighter gathers itself for a power but the moment slips away').map(
        (l) => l['castChancePct'],
      );
    };
    expect(slips(0.5)).toEqual([50]);
    expect(slips(0.49)).toEqual([]);
  });
});

describe("a fighter's hit points as he enters a fight", () => {
  test('the unkillable wanderer at no HP enters with half his most, rounded: 11 of 21', () => {
    const wanderer = aHero({ melee: 2 }, { _unkillable: true, hp: 0, maxHp: 21, temper: 'Brave' });
    expect(pc.pinned(0, () => pcCharCombatant(tc, wanderer)).hp).toBe(11);
  });
  test('a hero whose record holds no most HP enters with 20; a guardian of no HP with 10', () => {
    const hero = aHero({ melee: 2 }, { hp: 5, maxHp: 0, temper: 'Brave' });
    expect(pc.pinned(0, () => pcCharCombatant(tc, hero)).maxHp).toBe(20);
    expect(pcMonsterCombatant({ name: 'Made-up Mole', hp: 0, melee: 2 }).maxHp).toBe(10);
  });
  test('Counterattack from Melee 8 and Trueshot from Archery 8, not at 7', () => {
    const perks = (level: number) => {
      const f = pc.pinned(0, () => pcCharCombatant(tc, aHero({ melee: level, archery: level }, { temper: 'Brave' })));
      return [f.perkCounter, f.perkTrueshot];
    };
    expect([perks(7), perks(8)]).toEqual([
      [false, false],
      [true, true],
    ]);
  });
});

describe('the mastery perks', () => {
  test('a Counterattack strikes at a die below 0.5, not at 0.5', () => {
    const ripostes = (dice: number[]) => {
      const narrative: NarrativeLine[] = [];
      pc.pinned(dice, () => {
        pcTryCounter(tc, heroFighter({ perkCounter: true }), fighter(), narrative, 'archery');
      });
      return ofKind(facts(narrative), 'the hero seizes the opening and counterattacks').length;
    };
    expect([ripostes([0.5, 0]), ripostes([0.49, 0])]).toEqual([0, 1]);
  });
  /** An arrow of a hero of Archery 3 with the perks given at a foe of 40 HP, every die at `die`: the lines. */
  const shoot = (die: number, perks: Staged) => {
    const narrative: NarrativeLine[] = [];
    const foe = fighter({ hp: 40, maxHp: 40 });
    pc.pinned(die, () => {
      pcFireOne(tc, heroFighter({ archery: 3, archeryRaw: 3, ...perks }), foe, narrative);
    });
    return { lines: facts(narrative), foe };
  };
  test('an arrow impales at a die below 0.5, not at 0.5, bleeding 1 to 3 (1 at a die of 0.26)', () => {
    expect(ofKind(shoot(0.5, { perkImpale: true }).lines, "a fighter's arrow impales the foe")).toEqual([]);
    expect(
      ofKind(shoot(0.26, { perkImpale: true }).lines, "a fighter's arrow impales the foe").map((l) => l['impDmg']),
    ).toEqual([1]);
  });
  test("a Trueshot finds a vital point at a die below 0.5, not at 0.5: the foe's next attack fails", () => {
    expect(shoot(0.5, { perkTrueshot: true }).foe.status.nextAttackFails).toBe(0);
    expect(shoot(0.49, { perkTrueshot: true }).foe.status.nextAttackFails).toBe(1);
  });
});

describe('a flight', () => {
  const flee = (over: Staged, foe: AFighterInAPersonalCombat) =>
    pcFleeChance(heroFighter({ status: status(over) }), foe);
  test('30%, 25% more against a slow guardian, 15% less against a fast one; a hero foe is read at speed 2', () => {
    expect([
      flee({}, guardianOfPace('medium')),
      flee({}, guardianOfPace('slow')),
      flee({}, guardianOfPace('fast')),
      flee({}, heroFighter({ speedBonus: 1 })),
    ]).toEqual([30, 55, 15, 30]);
  });
  test('a Charm doubles it, to at most 95%; it is at least 5%', () => {
    expect([
      flee({ fleeDoubled: true }, guardianOfPace('medium')),
      flee({ fleeDoubled: true }, guardianOfPace('slow')),
      flee({ fleePenalty: 100 }, guardianOfPace('medium')),
    ]).toEqual([60, 95, 5]);
  });
});

describe('a rebirth, an arrow and a theft', () => {
  test('a guardian reborn rises with 40% of his most HP, rounded, and at least 5', () => {
    const risesWith = (maxHp: number) => {
      const foe = fighter({ hp: 1, maxHp, _rebirth: true });
      pc.pinned(0, () => {
        pcFreeStrike(tc, fighter({ melee: 5 }), foe, []);
      });
      return foe.hp;
    };
    expect([risesWith(20), risesWith(10)]).toEqual([8, 5]);
  });
  test('Archery 3 looses 2 arrows, Archery 2 one; an arrow is 1 to 3 and half his Archery, rounded up', () => {
    expect([pcVolleySize({ archery: 2 }), pcVolleySize({ archery: 3 })]).toEqual([1, 2]);
    const arrow = (die: number, archeryRaw: number) => pc.pinned(die, () => pcArrowDamage({ archery: 0, archeryRaw }));
    expect([arrow(0, 3), arrow(0.99, 3), arrow(0, 4)]).toEqual([3, 5, 3]);
  });
  test("a theft is 50%, 10% a level of Thief to 5, less the guardian's grade's penalty, at most 95%", () => {
    const theChance = (thief: number, power: string) => {
      const narrative: NarrativeLine[] = [];
      const thiefsFighter = heroFighter({
        ref: aHero({ thief }, { temper: 'None' }),
        tactics: ['ST'],
        tacIdx: 0,
        castSpells: [],
      });
      const guardian = fighter({ ref: { name: 'Made-up Mole', power } });
      pc.pinned(0.99, () => {
        pcAct(tc, thiefsFighter, guardian, narrative, { range: 'melee' });
      });
      return facts(narrative)
        .filter((l) => 'tierPen' in l)
        .map((l) => l['chance']);
    };
    expect([theChance(3, 'Weak'), theChance(7, 'Weak'), theChance(1, 'Legendary')]).toEqual([[80], [95], [15]]);
  });
});

describe('a fighter whose record holds no most HP is read at 20', () => {
  const unrecorded = (hp: number, over: Staged = {}) => heroFighter({ hp, maxHp: 0, ...over });
  /** A combat item's effect as these cases give it. */
  interface AnEffect {
    use: string;
    amt?: number;
    below?: number;
    absorb?: number;
    dmg?: number[];
  }
  test('a Cautious fighter of 8 HP (40% of 20) fights on; of 7 he bolts at a die of 0', () => {
    const next = (hp: number) =>
      pc.pinned(0, () => pcTemperFallback(unrecorded(hp, { temper: 'Cautious' }), fighter()));
    expect([next(8), next(7)]).toEqual(['ME', 'FL']);
  });
  test('a healing draught is wanted below half of 20 (at 9 HP, not 10); a ward only below 20', () => {
    const wanted = (hp: number, effect: AnEffect) =>
      pcCombatItemWanted(
        unrecorded(hp),
        fighter(),
        { name: 'a made-up draught', effect: { stat: 'combatUse', ...effect } },
        {},
      );
    expect([wanted(10, { use: 'heal', amt: 30, below: 0.5 }), wanted(9, { use: 'heal', amt: 30, below: 0.5 })]).toEqual(
      [false, true],
    );
    expect([wanted(20, { use: 'absorb', absorb: 10 }), wanted(19, { use: 'absorb', absorb: 10 })]).toEqual([
      false,
      true,
    ]);
  });
  test('a draught heals him to 20 at most, and so does a drain', () => {
    const healedTo = (hp: number, effect: AnEffect) => {
      const actor = unrecorded(hp);
      pc.pinned(0, () => {
        pcUseCombatItem(
          tc,
          actor,
          fighter({ hp: 40, maxHp: 40 }),
          { name: 'a made-up draught', effect: { stat: 'combatUse', ...effect } },
          [],
          {
            range: 'melee',
          },
        );
      });
      return actor.hp;
    };
    expect([
      healedTo(5, { use: 'heal', amt: 30 }),
      healedTo(5, { use: 'secondwind', amt: 30 }),
      healedTo(15, { use: 'drain', dmg: [10, 10] }),
    ]).toEqual([20, 20, 20]);
  });
});
