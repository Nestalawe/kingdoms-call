// The guardian perks no matrix game meets keep their values (plan P1-19's guardian perks, from P1-19ai): each line of
// the perks' registry, or of a resolver it took, that no game of the balance matrix reaches (or reaches only in part),
// and each perk a game never meets acting, has a case here on a staged guardian, red on a fault planted in it. The
// matrix (npm run balance) sees the rest. Later rows of the family add theirs.
// - A guardian's card (monsterTraits, through "a guardian's perks: what his card turns"): a perk that turns spells keeps
//   the hidden spell multiplier of his nature at 1 or below (no guardian fought in any game carries one beside an
//   undead, fiend or armoured nature: the table test, tests/guardian-traits.test.js, sees it only through the table's
//   mix); a perk of the older form, a field of the ward's own name, counts too; and the runner passes over a perk that
//   isn't there.
// - A guardian's grade's cap beside his own (pcMonsterCombatant, through "a guardian's perks: his grade's cap beside his
//   own"): no cap from a grade that gives none; the grade's merged, and a tighter own cap kept, a looser one not.
// - A guardian's ward against one school (pcCastCombatSpell, through "a guardian's perks: a combat spell's chance: a
//   ward against its school"; met acting in 5 or 6 games of 60, and no test saw its floor or its weakness rule): its
//   points come off the cast's chance, never below 5, and the line names the perk; a guardian weak to the spell's
//   school is never warded against it.
// - A guardian's stun and lingering-harm wards as a round starts (pcRoundStart, through "a guardian's perks: a round
//   starts" and "… a lingering harm bites"; no game clears a stun there, or sloughs off a harm by a perk's whole ward):
//   wards that turn every stun clear a stun he is under, a lesser stun ward doesn't; a whole lingering-harm ward sloughs
//   off every lingering harm, a lesser one turns its share of each tick; each line names his perk. And the runners of
//   the stun ward and the tick keep each between 0 and a full ward's 100, none worn 0, with the ward the line names.
// - What a rider does in a fight (P1-19ak: the items' rider rows, which a guardian's perk of the same rider reaches;
//   each the matrix sees in some games, and no test saw before: the burn at any range, drain without its fade, the
//   damage bonus off, the aura and the bonus to hit off an arrow): the aura laid on his foe as the fight opens, beside
//   a penalty the foe carries; the burn only at melee range, its line naming his perk; the aura's penalty and his
//   bonus on a blow's and an arrow's chance; the damage bonus on a blow, and a special's weight multiplying it; the
//   drain in full to round 4, half to round 8, then none, its line naming his perk. And the riders' runners on the
//   edges no game meets (none worn, a rider of 0, a maximum of none, the fade asked only when he drinks).
// Level 1 (unit): the runners and monsterTraits read the registry's values and the content's rows, which a syntax
// tree can't evaluate; the whole engine is imported first (tests/lib/the-whole-engine.ts), and a cast, a blow, a
// special and a fight are staged on the engine's modules (tests/lib/personal-combat.ts), every die pinned.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { monsterTraits } from '../../src/engine/personal-combat/lair-guardians-and-the-odds.ts';
import {
  theApproachesAGuardiansPerksTurn,
  theLingeringHarmWardAGuardiansPerksGiveHim,
  theStunWardAGuardiansPerksGiveHim,
  whatAGuardiansGradesCapDoesBesideHisOwn,
} from '../../src/engine/rules/the-registry-of-guardian-perks.ts';
import {
  hisBonusToHitOnceACombatItemAddsItsOwn,
  theAuraPenaltyAFightersAuraLaysOnHisFoe,
  theDamageAStrikersRiderAddsToHisBlow,
  theHarmAFightersBurnSearsHisFoeWith,
  whatAStrikersBonusAddsToHisChanceToHit,
  whatAStrikersDrainDrinksOfHisBlow,
  whatTheAuraOnAStrikerTakesOffHisChanceToHit,
} from '../../src/engine/rules/the-registry-of-magic-item-effects.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { clone, personalCombatEngine, type Combatant } from '../lib/personal-combat.ts';

const { call, base, MON, pinned, wordsOf } = await personalCombatEngine();

type AGuardian = Parameters<typeof monsterTraits>[0];
/** A made-up guardian of the kind given, with the perks given (each a made-up name). */
const aGuardian = (cat: string, ...fxs: Record<string, unknown>[]): AGuardian => ({
  name: 'Made-up Mole',
  cat,
  passives: fxs.map((fx, i) => ({ name: `Made-up Perk ${String(i)}`, fx })),
});

describe("a guardian's card: what his perks turn", () => {
  test('a perk that turns spells keeps an undead, fiend or armoured guardian’s spell multiplier at 1', () => {
    expect(monsterTraits(aGuardian('undead')).mods.spell).toBe(1.5);
    expect(monsterTraits(aGuardian('undead', { ward: 'spellPct', pct: 15 })).mods.spell).toBe(1);
    expect(monsterTraits(aGuardian('fiend', { ward: 'spellPct', pct: 25 })).mods.spell).toBe(1);
    expect(monsterTraits(aGuardian('construct', { ward: 'spellPct', pct: 35 })).mods).toEqual({
      melee: 0.8,
      archery: 1,
      spell: 1,
    });
    // a ward of another kind turns nothing on the card
    expect(monsterTraits(aGuardian('undead', { ward: 'dodge', pct: 15 })).mods.spell).toBe(1.5);
  });

  test("a perk of the older form, a field of the ward's own name, turns its approach too", () => {
    expect(monsterTraits(aGuardian('beast')).mods.melee).toBe(1.1);
    expect(monsterTraits(aGuardian('beast', { meleeDR: 1 })).mods.melee).toBe(1);
    expect(monsterTraits(aGuardian('undead', { spellPct: 15 })).mods.spell).toBe(1);
    // a field of 0 is none
    expect(monsterTraits(aGuardian('beast', { meleeDR: 0 })).mods.melee).toBe(1.1);
  });

  test('the runner passes over a perk that isn’t there, and gathers each approach turned', () => {
    expect(theApproachesAGuardiansPerksTurn([null, undefined, { ward: 'arrowDR' }])).toEqual({
      melee: false,
      archery: true,
      spell: false,
    });
    expect(theApproachesAGuardiansPerksTurn([{ ward: 'meleeDR' }, { ward: 'arrowDR' }, { ward: 'spellPct' }])).toEqual({
      melee: true,
      archery: true,
      spell: true,
    });
    expect(theApproachesAGuardiansPerksTurn([])).toEqual({ melee: false, archery: false, spell: false });
  });
});

describe("a guardian's build: his grade's cap beside his own", () => {
  test('a grade that gives no cap gives nothing', () => {
    expect(whatAGuardiansGradesCapDoesBesideHisOwn({ theCapOfHisGrade: 0, theWardsHisPerksGaveHim: null })).toBeNull();
    expect(
      whatAGuardiansGradesCapDoesBesideHisOwn({ theCapOfHisGrade: 0, theWardsHisPerksGaveHim: { names: [], cap: 15 } }),
    ).toBeNull();
  });

  test("the grade's cap is merged, and a tighter own cap kept, a looser one not", () => {
    expect(
      whatAGuardiansGradesCapDoesBesideHisOwn({ theCapOfHisGrade: 20, theWardsHisPerksGaveHim: undefined }),
    ).toEqual({ theWardHisGradeAdds: { ward: 'cap', pct: 20 }, whatHisOwnTighterCapKeeps: null });
    expect(
      whatAGuardiansGradesCapDoesBesideHisOwn({
        theCapOfHisGrade: 20,
        theWardsHisPerksGaveHim: { names: [], cap: 15 },
      }),
    ).toEqual({ theWardHisGradeAdds: { ward: 'cap', pct: 20 }, whatHisOwnTighterCapKeeps: { cap: 15 } });
    expect(
      whatAGuardiansGradesCapDoesBesideHisOwn({
        theCapOfHisGrade: 20,
        theWardsHisPerksGaveHim: { names: [], cap: 20 },
      }),
    ).toEqual({ theWardHisGradeAdds: { ward: 'cap', pct: 20 }, whatHisOwnTighterCapKeeps: null });
    expect(
      whatAGuardiansGradesCapDoesBesideHisOwn({
        theCapOfHisGrade: 20,
        theWardsHisPerksGaveHim: { names: [], cap: 30 },
      }),
    ).toEqual({ theWardHisGradeAdds: { ward: 'cap', pct: 20 }, whatHisOwnTighterCapKeeps: null });
  });
});

describe("a guardian's ward against one school: a cast at him", () => {
  /** The first guardian of the table as a fighter, renamed, wearing only a ward against Psychic magic of the points
   *  given (his perk of it named), and weak to the school given, or to none. */
  const aWardedGuardian = (points: number, weakTo: string | null): Combatant => {
    const m = MON[0];
    if (!m) throw new Error('no guardian in the table');
    const t = call('pcMonsterCombatant', { ...clone(m), _hpFull: m.hp }) as Combatant;
    t.name = 'Made-up Mole';
    t.arm = { names: ['Made-up Ward'], schoolWard: { psychic: points } };
    t['_perkName'] = { schoolWard: 'Made-up Ward' };
    t.weak = weakTo ? { kind: 'school', key: weakTo, name: 'Made-up Weakness', desc: 'made up' } : null;
    return t;
  };
  /** A hero of Psychic at the level given: his cast's chance is 30 + 10 a level (40 at level 1). */
  const aPsychic = (level: number): Combatant =>
    call('pcCharCombatant', {
      ...clone(base),
      items: [],
      skills: { ...base.skills, psychic: level },
      encounterPlan: { tactics: ['ME'], duelStance: 'accept' },
    }) as Combatant;
  const st = () => ({ fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null });
  /** The words of a Psychic Blast's cast at the guardian (the roll 100, so it fizzles and nothing else is drawn). */
  const theCastsWords = (caster: Combatant, target: Combatant): string => {
    const narrative: NarrativeLine[] = [];
    pinned(0.99, () => call('pcCastCombatSpell', caster, target, 'Psychic Blast', narrative, st()));
    return wordsOf(narrative)[0] ?? '';
  };

  test('his points come off the chance (40 − 30 = 10), and the line names his perk', () => {
    expect(theCastsWords(aPsychic(1), aWardedGuardian(30, null))).toMatch(
      /\(10% to cast successfully, −30 for Made-up Mole's Made-up Ward\)/,
    );
  });

  test('never below 5 (40 − 50 is 5)', () => {
    expect(theCastsWords(aPsychic(1), aWardedGuardian(50, null))).toMatch(
      /\(5% to cast successfully, −50 for Made-up Mole's Made-up Ward\)/,
    );
  });

  test("a guardian weak to the spell's school is never warded against it (95, no points off)", () => {
    expect(theCastsWords(aPsychic(1), aWardedGuardian(50, 'psychic'))).toMatch(/\(95% to cast successfully\)/);
    // weak to another school, his ward holds
    expect(theCastsWords(aPsychic(1), aWardedGuardian(50, 'white'))).toMatch(/\(5% to cast successfully, −50 for /);
  });
});

describe("a guardian's stun and lingering-harm wards as a round starts", () => {
  /** The first guardian of the table as a fighter, renamed, wearing only the wards given (his perks of a stun ward and
   *  a lingering-harm ward named), under the stun and the lingering harm given. */
  const aGuardianUnder = (wards: Record<string, unknown>, stun: number, dot: { dmg: number; rounds: number }[]) => {
    const m = MON[0];
    if (!m) throw new Error('no guardian in the table');
    const t = call('pcMonsterCombatant', { ...clone(m), _hpFull: m.hp }) as Combatant;
    t.name = 'Made-up Mole';
    t.hp = t.maxHp = 50;
    t.arm = { names: ['Made-up Calm', 'Made-up Hide'], ...wards };
    t['_perkName'] = { stunWard: 'Made-up Calm', dotWard: 'Made-up Hide' };
    t.status = {
      ...t.status,
      stun,
      dot: dot.map((d) => ({ ...d, source: { kind: 'a spell that burns', spellName: 'Fireball' } })),
    };
    return t;
  };
  const theRoundsWords = (t: Combatant): string[] => {
    const narrative: NarrativeLine[] = [];
    call('pcRoundStart', t, narrative);
    return wordsOf(narrative);
  };

  test('a full stun ward clears a stun he is under, and the line names his perk; a lesser one leaves it', () => {
    const full = aGuardianUnder({ stunWard: 100 }, 2, []);
    expect(theRoundsWords(full).join('\n')).toMatch(
      /Made-up Mole cannot be held \(Made-up Calm\) — the daze is ignored/,
    );
    expect(full.status.stun).toBe(0);
    const lesser = aGuardianUnder({ stunWard: 80 }, 2, []);
    expect(theRoundsWords(lesser)).toEqual([]);
    expect(lesser.status.stun).toBe(2);
    // his items' refusal clears it too, and the line still names his stun ward's perk
    const refused = aGuardianUnder({ stunWard: 40, stunImmune: true }, 1, []);
    expect(theRoundsWords(refused).join('\n')).toMatch(/cannot be held \(Made-up Calm\)/);
    expect(refused.status.stun).toBe(0);
  });

  test('a whole lingering-harm ward sloughs off every harm; a lesser one turns its share of each tick', () => {
    const whole = aGuardianUnder({ dotWard: 100 }, 0, [{ dmg: 10, rounds: 3 }]);
    expect(theRoundsWords(whole).join('\n')).toMatch(
      /Made-up Mole's Made-up Hide sloughs off every burn, poison and bleeding/,
    );
    expect([whole.hp, whole.status.dot]).toEqual([50, []]);
    const lesser = aGuardianUnder({ dotWard: 80 }, 0, [{ dmg: 10, rounds: 3 }]);
    expect(theRoundsWords(lesser).join('\n')).toMatch(/for 2 damage \(Made-up Mole's Made-up Hide turns 80% of it\)/);
    expect(lesser.hp).toBe(48);
  });
});

test("the runners: a stun ward's chance and a tick's share run from 0 to a full ward's 100 (none worn: 0), each with the ward its line names", () => {
  expect(theStunWardAGuardiansPerksGiveHim(null)).toEqual({ theChance: 0, theWardTheLineNames: 'stunWard' });
  expect(theStunWardAGuardiansPerksGiveHim({ stunWard: 60 }).theChance).toBe(60);
  expect(theStunWardAGuardiansPerksGiveHim({ stunWard: 150 }).theChance).toBe(100);
  expect(theStunWardAGuardiansPerksGiveHim({ stunWard: -5 }).theChance).toBe(0);
  expect(theLingeringHarmWardAGuardiansPerksGiveHim(undefined)).toEqual({
    theShareItTurns: 0,
    theWardTheLineNames: 'dotWard',
  });
  expect(theLingeringHarmWardAGuardiansPerksGiveHim({ dotWard: 150 }).theShareItTurns).toBe(100);
});

describe("what a rider does in a fight, an item's or a guardian's perk's", () => {
  /** The first guardian of the table as a fighter, renamed, at the hit points given, with the riders given. */
  const aGuardianWith = (riders: Record<string, unknown>, hp = 50): Combatant => {
    const m = MON[0];
    if (!m) throw new Error('no guardian in the table');
    const t = call('pcMonsterCombatant', { ...clone(m), _hpFull: m.hp }) as Combatant;
    t.name = 'Made-up Mole';
    t.hp = hp;
    t.maxHp = 100;
    t.arm = null;
    t['perks'] = [];
    t['passiveName'] = undefined;
    t['_perkName'] = { burn: 'Made-up Embers', drain: 'Made-up Thirst' };
    return Object.assign(t, riders);
  };
  /** A hero of the world, renamed, with no items, at 100 hit points, of a temper with no guard. */
  const aHero = (): Combatant => {
    const h = call('pcCharCombatant', {
      ...clone(base),
      items: [],
      temper: 'Brave',
      encounterPlan: { tactics: ['ME'], duelStance: 'accept' },
    }) as Combatant;
    h.name = 'Made-up Fennick';
    h.hp = h.maxHp = 100;
    return h;
  };

  test("the fight opens: a guardian's aura lays its penalty on his foe, beside one he carries; his burn sears only at melee range", () => {
    const hero = aHero(),
      mole = aGuardianWith({ aura: 15, burn: 4 });
    hero.status['auraPenalty'] = 5;
    // every die 0.5: the hero closes to bow range in round 1 and to melee in round 2, so round 3 opens at melee range
    const res = pinned(0.5, () => call('resolvePersonalCombat', hero, mole, { maxRounds: 3 })) as {
      narrative: NarrativeLine[];
    };
    expect(hero.status['auraPenalty']).toBe(20);
    const words = wordsOf(res.narrative);
    const atMelee = words.findIndex((l) => l.includes('close to melee range'));
    const sears = words.flatMap((l, i) => (l.includes('Made-up Embers') ? [i] : []));
    expect(atMelee).toBeGreaterThan(0);
    expect(sears).toHaveLength(1);
    expect(sears[0]).toBeGreaterThan(atMelee);
    expect(words[sears[0] ?? 0]).toMatch(/Made-up Embers sears Made-up Fennick for 4\./);
  });

  test('the aura laid on a striker and his own bonus to hit move his blow’s chance (−20, then +10)', () => {
    const striker = aGuardianWith({});
    striker['melee'] = 2;
    striker['meleeRaw'] = 2;
    const chance = (marks: Record<string, unknown>) => {
      Object.assign(striker.status, { auraPenalty: 0, hitBonus: 0, hitPenalty: 0, hitPenaltyFixed: 0, ...marks });
      return call('pcHitChance', striker, aHero()) as number;
    };
    const none = chance({});
    expect(none).toBeGreaterThan(30);
    expect(none).toBeLessThan(60);
    expect(chance({ auraPenalty: 20 })).toBe(none - 20);
    expect(chance({ auraPenalty: 20, hitBonus: 10 })).toBe(none - 10);
  });

  test('the aura laid on an archer and his own bonus to hit move his arrow’s chance (30 + 50 − 20 + 10)', () => {
    const archer = aGuardianWith({});
    archer['archery'] = 5;
    archer['archeryRaw'] = 5;
    const chance = (marks: Record<string, unknown>) => {
      Object.assign(archer.status, { auraPenalty: 0, hitBonus: 0, hitPenalty: 0, hitPenaltyFixed: 0, ...marks });
      return call('pcArrowHitChance', archer, aHero()) as number;
    };
    expect(chance({})).toBe(80);
    expect(chance({ auraPenalty: 20 })).toBe(60);
    expect(chance({ auraPenalty: 20, hitBonus: 10 })).toBe(70);
  });

  test("a guardian's damage bonus adds to his blow, and a special's weight multiplies it with the blow (×2: +6)", () => {
    const blow = (dmgBonus: number) => pinned(0.01, () => call('pcMeleeDamage', aGuardianWith({ dmgBonus }), null));
    expect(Number(blow(3)) - Number(blow(0))).toBe(3);
    const special = (dmgBonus: number) => {
      const hero = aHero();
      const narrative: NarrativeLine[] = [];
      pinned(0.01, () =>
        call(
          'pcMonsterSpecial',
          aGuardianWith({ dmgBonus }),
          hero,
          { name: 'Made-up Breath', dmgW: 2, effect: '' },
          narrative,
          { range: 'melee' },
        ),
      );
      return 100 - hero.hp;
    };
    expect(special(3) - special(0)).toBe(6);
  });

  test('a guardian drinks his share of the wound his blow deals: in full to round 4, half to round 8, then none', () => {
    /** His hit points gained, and the damage dealt, by a blow at the round given (every die 0.01: the blow lands). */
    const drunkAt = (round: number) => {
      const mole = aGuardianWith({ drain: 1, _roundNo: round }, 10),
        hero = aHero(),
        narrative: NarrativeLine[] = [];
      pinned(0.01, () => call('pcMeleeStrike', mole, hero, narrative));
      return { gained: mole.hp - 10, dealt: 100 - hero.hp, words: wordsOf(narrative).join('\n') };
    };
    const full = drunkAt(4),
      half = drunkAt(5),
      none = drunkAt(9);
    expect(full.dealt).toBeGreaterThan(1);
    expect(full.gained).toBe(full.dealt);
    expect(full.words).toMatch(/Made-up Thirst/);
    expect(half.gained).toBe(Math.round(half.dealt / 2));
    expect([none.gained, none.words.includes('Made-up Thirst')]).toEqual([0, false]);
  });
});

test("the riders' runners: each gives what the fight applies, or nothing, and the rider its line names", () => {
  // the aura: added to the penalty the foe carries (none: 0); no aura, or one of 0, lays nothing
  expect(theAuraPenaltyAFightersAuraLaysOnHisFoe({ theRiders: { aura: 15 }, theFoesAuraPenaltySoFar: undefined })).toBe(
    15,
  );
  expect(
    theAuraPenaltyAFightersAuraLaysOnHisFoe({ theRiders: { aura: 15 }, theFoesAuraPenaltySoFar: Number.NaN }),
  ).toBe(15);
  expect(theAuraPenaltyAFightersAuraLaysOnHisFoe({ theRiders: { aura: 0 }, theFoesAuraPenaltySoFar: 5 })).toBeNull();
  expect(theAuraPenaltyAFightersAuraLaysOnHisFoe({ theRiders: {}, theFoesAuraPenaltySoFar: 5 })).toBeNull();
  // a striker's marks: none is 0
  expect([whatTheAuraOnAStrikerTakesOffHisChanceToHit({}), whatAStrikersBonusAddsToHisChanceToHit({})]).toEqual([0, 0]);
  // the damage bonus: none is 0
  expect([theDamageAStrikersRiderAddsToHisBlow({ dmgBonus: 2 }), theDamageAStrikersRiderAddsToHisBlow({})]).toEqual([
    2, 0,
  ]);
  // the burn: its harm and the rider its line names; none, or 0, sears nothing
  expect(theHarmAFightersBurnSearsHisFoeWith({ burn: 4 })).toEqual({ theHarm: 4, theRiderTheLineNames: 'burn' });
  expect([theHarmAFightersBurnSearsHisFoeWith({ burn: 0 }), theHarmAFightersBurnSearsHisFoeWith({})]).toEqual([
    null,
    null,
  ]);
  // the drain: its share at the fade, up to his maximum (20 for one of none), and the rider its line names
  const drink = (facts: Partial<Parameters<typeof whatAStrikersDrainDrinksOfHisBlow>[0]>) =>
    whatAStrikersDrainDrinksOfHisBlow({
      theRiders: { drain: 0.5 },
      theDamageDealt: 8,
      hisHp: 10,
      hisMaxHp: 100,
      theSustainsFade: () => 1,
      ...facts,
    });
  expect(drink({})).toEqual({ theHpDrunk: 4, theFade: 1, theRiderTheLineNames: 'drain' });
  expect(drink({ theSustainsFade: () => 0.5 })).toEqual({ theHpDrunk: 2, theFade: 0.5, theRiderTheLineNames: 'drain' });
  expect(drink({ hisHp: 98 })?.theHpDrunk).toBe(2);
  expect(drink({ hisHp: 18, hisMaxHp: 0 })?.theHpDrunk).toBe(2);
  // nothing: no wound dealt, no drain, at his maximum, or a fade of none
  let asked = 0;
  const fade = () => {
    asked++;
    return 1;
  };
  expect([
    drink({ theDamageDealt: 0, theSustainsFade: fade }),
    drink({ theRiders: {}, theSustainsFade: fade }),
    drink({ theRiders: { drain: 0 }, theSustainsFade: fade }),
    drink({ hisHp: 100, theSustainsFade: fade }),
    drink({ hisHp: 20, hisMaxHp: 0, theSustainsFade: fade }),
  ]).toEqual([null, null, null, null, null]);
  expect(asked).toBe(0);
  expect(drink({ theSustainsFade: () => 0 })).toBeNull();
  // a combat item's bonus to hit adds to his bonus so far (none: 0)
  expect([
    hisBonusToHitOnceACombatItemAddsItsOwn({ theBonusSoFar: undefined, theBonusAdded: 10 }),
    hisBonusToHitOnceACombatItemAddsItsOwn({ theBonusSoFar: 5, theBonusAdded: 7 }),
  ]).toEqual([10, 12]);
});
