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
// Level 1 (unit): the runners and monsterTraits read the registry's values and the content's rows, which a syntax
// tree can't evaluate; the whole engine is imported first (tests/lib/the-whole-engine.ts).
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { monsterTraits } from '../../src/engine/personal-combat/lair-guardians-and-the-odds.ts';
import {
  theApproachesAGuardiansPerksTurn,
  whatAGuardiansGradesCapDoesBesideHisOwn,
} from '../../src/engine/rules/the-registry-of-guardian-perks.ts';

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
