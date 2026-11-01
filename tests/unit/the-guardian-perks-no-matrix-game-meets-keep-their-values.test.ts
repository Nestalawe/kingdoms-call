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
// Level 1 (unit): the runners and monsterTraits read the registry's values and the content's rows, which a syntax
// tree can't evaluate; the whole engine is imported first (tests/lib/the-whole-engine.ts), and a cast is staged on the
// engine's modules (tests/lib/personal-combat.ts), the dice pinned.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { monsterTraits } from '../../src/engine/personal-combat/lair-guardians-and-the-odds.ts';
import {
  theApproachesAGuardiansPerksTurn,
  theLingeringHarmWardAGuardiansPerksGiveHim,
  theStunWardAGuardiansPerksGiveHim,
  whatAGuardiansGradesCapDoesBesideHisOwn,
} from '../../src/engine/rules/the-registry-of-guardian-perks.ts';
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
