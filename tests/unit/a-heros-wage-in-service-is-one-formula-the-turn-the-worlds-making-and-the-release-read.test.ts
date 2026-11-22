// A hero's wage in service is one formula, which the turn, the world's making and the release read (B-06d): what his
// allegiance was bargained at, plus his skill premium (a gold for every 4 skill points, rounded up, less 1, never below
// nothing), never below 1g. Each copy it replaced is written here as it was, and the formula is compared with it on
// every skill total from 0 to 60 and every allegiance from none to 8: recalcHeroPay's (the bargained allegiance, 1g
// for a hero never hired), the world's founding heroes' (`max(1, ceil(total/4))`), its wandering heroes' and the
// release's (`max(1, 1 + premium)`). recalcHeroPay leaves a king and no hero alone.
// Level 1 (unit): the formula and recalcHeroPay are functions on plain values; a static test can't run them. The
// release's own case is in tests/lib/item-and-army-order-cases.ts ("his asking price is a wanderer's"); the world's
// making is in every game.
import { expect, test } from 'vitest';
import {
  heroSkillWage,
  theWageOfAHeroInService,
} from '../../src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { recalcHeroPay } from '../../src/engine/heroes/effective-skills-and-hidden-heroes.ts';
import { KC_A_HEROS_WAGE_IN_SERVICE } from '../../src/content/kingdoms-call-data.ts';

/** A hero's skills whose points add to the total, spread over a few skills, as the world deals them. */
function skillsOf(total: number): Record<string, number> {
  const skills: Record<string, number> = {};
  const names = ['melee', 'tactical', 'march', 'spy', 'sage', 'druid'];
  for (let i = 0; i < total; i++) {
    const name = names[i % names.length] ?? 'melee';
    skills[name] = (skills[name] ?? 0) + 1;
  }
  return skills;
}
const TOTALS = Array.from({ length: 61 }, (_, i) => i);
const ALLEGIANCES = [undefined, 0, 1, 2, 3, 4, 5, 6, 7, 8];
const NEVER_HIRED = KC_A_HEROS_WAGE_IN_SERVICE.theAllegianceOfAHeroNeverHired;

test('the skill premium: a gold for every 4 skill points, rounded up, less 1, never below nothing', () => {
  for (const total of TOTALS)
    expect(heroSkillWage({ skills: skillsOf(total) }), `${String(total)} points`).toBe(
      Math.max(0, Math.ceil(total / 4) - 1),
    );
  expect(heroSkillWage({ skills: { melee: 3 } })).toBe(0);
  expect(heroSkillWage({ skills: { melee: 5, tactical: 4 } })).toBe(2);
  expect(heroSkillWage(null)).toBe(0);
});

test('recalcHeroPay: the bargained allegiance (1g for a hero never hired) plus the premium, 1g at the least, as it wrote it', () => {
  for (const total of TOTALS)
    for (const _hireAlignWage of ALLEGIANCES) {
      const hero: { skills: Record<string, number>; _hireAlignWage?: number; pay?: number } = {
        skills: skillsOf(total),
      };
      if (_hireAlignWage !== undefined) hero._hireAlignWage = _hireAlignWage;
      recalcHeroPay(hero);
      const was = Math.max(1, (hero._hireAlignWage ?? 1) + heroSkillWage(hero));
      expect(hero.pay, `${String(total)} points, allegiance ${String(_hireAlignWage)}`).toBe(was);
      expect(theWageOfAHeroInService(_hireAlignWage ?? NEVER_HIRED, hero)).toBe(was);
    }
  const theKing = { isKing: true, skills: skillsOf(20), pay: 0 };
  recalcHeroPay(theKing);
  expect(theKing.pay, 'a king draws no wage').toBe(0);
  expect(() => {
    recalcHeroPay(null);
  }).not.toThrow();
  const hired = { skills: skillsOf(9), _hireAlignWage: 4, pay: 0 };
  recalcHeroPay(hired);
  expect(hired.pay).toBe(6);
});

test("the world's founding and wandering heroes and the release: a hero never hired, as each wrote it", () => {
  for (const total of TOTALS) {
    const hSkills: Partial<Record<string, number>> = skillsOf(total); // as the world types them
    const hero = { skills: hSkills };
    const theFoundingHerosWas = Math.max(
      1,
      Math.ceil(Object.values(hSkills).reduce((s: number, v) => s + Number(v), 0) / 4),
    );
    const theWanderersWas = Math.max(
      1,
      1 + Math.max(0, Math.ceil(Object.values(hSkills).reduce((s: number, v) => s + Number(v), 0) / 4) - 1),
    );
    const theReleasesWas = Math.max(1, 1 + heroSkillWage(hero));
    const now = theWageOfAHeroInService(NEVER_HIRED, hero);
    expect(now, `${String(total)} points: the founding hero's`).toBe(theFoundingHerosWas);
    expect(now, `${String(total)} points: the wanderer's`).toBe(theWanderersWas);
    expect(now, `${String(total)} points: the release's`).toBe(theReleasesWas);
  }
  expect(theWageOfAHeroInService(NEVER_HIRED, { skills: { melee: 2, spy: 1 } })).toBe(1);
  expect(theWageOfAHeroInService(NEVER_HIRED, { skills: skillsOf(24) })).toBe(6);
});
