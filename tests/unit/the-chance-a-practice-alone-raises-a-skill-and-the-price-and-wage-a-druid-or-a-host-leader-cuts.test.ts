// The orders' and gold's rules, on plain values (plan P1-11e23 moved these out of the turn, so the order form's practice
// note and gold ledger can later ask the turn's own): the chance a practice alone raises a skill (25% at level 0 down to
// 5% at level 4, none past 5; plus the realm's discoveries; ×1.2 for each practice failed this turn; ×1.5 for a Human of
// a Human realm); a Druid 6 recruiter's half price for a beast (rounded down); and Early Winter's wage cuts that read no
// registry (no wage for a summons or a Wild Hunt beast; a beast's half wage, at least 1g, under a Druid 6 leader or a
// Druidic Wonder; the Host-Leader's 1g a company he leads, the wages never below 0).
//
// Level 1 (unit): the functions of src/engine/rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-
// price-and-wage-a-druid-or-a-host-leader-cuts.ts on made-up levels, prices and companies. A lower level can't run a
// function. A fault planted in a shared function moves every caller at once (the turn and the report alike), so these
// cases pin its answers; the practice, recruit and Early Winter tests check the engine's calls in whole turns.
import { describe, expect, test } from 'vitest';
import {
  THE_PERCENT_CHANCE_A_PRACTICE_ALONE_RAISES_A_SKILL_FROM_EACH_LEVEL,
  aCompanyDrawsNoWage,
  aCompanyIsABeastADruidHalves,
  aLeadersBeastsPayHalfWages,
  aSkillAtThisLevelIsPractisedNoFurther,
  theBaseChanceAPracticeAloneRaisesASkill,
  theChanceAHeroPractisingAloneRaisesHisSkill,
  theCompaniesTheHostLeaderSavesOn,
  theHostLeadersCut,
  thePerseveranceOfAHeroWhoFailedPracticesThisTurn,
  thePriceADruidPaysForABeast,
  theShareAQuickLearnerPractisesAt,
  theWageABeastPaysUnderADruid,
} from '../../src/engine/rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts';

describe('the chance a practice alone raises a skill', () => {
  test("the report's table: 25% at level 0 down to 5% at level 4", () => {
    expect(THE_PERCENT_CHANCE_A_PRACTICE_ALONE_RAISES_A_SKILL_FROM_EACH_LEVEL).toEqual([25, 20, 15, 10, 5]);
  });
  test('the base chance by the level he holds, exactly as the turn rolls it; a level past 4 reads level 4', () => {
    expect([0, 1, 2, 3, 4, 5, 7].map((l) => theBaseChanceAPracticeAloneRaisesASkill(l))).toEqual([
      0.25, 0.2, 0.15, 0.1, 0.05, 0.05, 0.05,
    ]);
  });
  test('no roll is made from level 5 on, and one is below it', () => {
    expect([0, 4, 5, 6, 9].map((l) => aSkillAtThisLevelIsPractisedNoFurther(l))).toEqual([
      false,
      false,
      true,
      true,
      true,
    ]);
  });
  test('perseverance: ×1.2 for each practice he failed this turn', () => {
    expect(thePerseveranceOfAHeroWhoFailedPracticesThisTurn(0)).toBe(1);
    expect(thePerseveranceOfAHeroWhoFailedPracticesThisTurn(1)).toBe(1.2);
    expect(thePerseveranceOfAHeroWhoFailedPracticesThisTurn(3)).toBeCloseTo(1.728, 12);
  });
  test('a Human of a Human realm practises at ×1.5; any other hero at ×1', () => {
    expect(theShareAQuickLearnerPractisesAt(true)).toBe(1.5);
    expect(theShareAQuickLearnerPractisesAt(false)).toBe(1);
  });
  test('alone: the base, plus the discoveries, times his perseverance, times his quick learning', () => {
    expect(theChanceAHeroPractisingAloneRaisesHisSkill(0, 0, 0, false)).toBe(0.25);
    expect(theChanceAHeroPractisingAloneRaisesHisSkill(3, 0, 0, true)).toBeCloseTo(0.15, 12);
    expect(theChanceAHeroPractisingAloneRaisesHisSkill(4, 0.05, 0, false)).toBeCloseTo(0.1, 12);
    // (15% + 5%) × 1.2 × 1.5: the discoveries are added before the two shares multiply
    expect(theChanceAHeroPractisingAloneRaisesHisSkill(2, 0.05, 1, true)).toBeCloseTo(0.36, 12);
    expect(theChanceAHeroPractisingAloneRaisesHisSkill(1, 0, 2, false)).toBeCloseTo(0.288, 12);
  });
});

describe("a Druid's half price and wage for a beast", () => {
  test('a creature or a monster is a beast a Druid halves; a garrison, a levy or a ship is not', () => {
    expect(aCompanyIsABeastADruidHalves('Thunderbirds')).toBe(true);
    expect(aCompanyIsABeastADruidHalves('Cave Trolls')).toBe(true);
    expect(aCompanyIsABeastADruidHalves('Human Garrison')).toBe(false);
    expect(aCompanyIsABeastADruidHalves('Longships')).toBe(false);
    expect(aCompanyIsABeastADruidHalves('')).toBe(false);
  });
  test('a Druid 6 recruiter pays half, rounded down (a 1g beast is free)', () => {
    expect([1, 2, 7, 8, 13].map((g) => thePriceADruidPaysForABeast(g))).toEqual([0, 1, 3, 4, 6]);
  });
  test("a leader's beasts pay half wages under Druid 6, or under the Druidic Wonder, asked only when he lacks it", () => {
    let asked = 0;
    const theWonder = (built: boolean) => () => {
      asked += 1;
      return built;
    };
    expect(aLeadersBeastsPayHalfWages(true, theWonder(false))).toBe(true);
    expect(asked).toBe(0);
    expect(aLeadersBeastsPayHalfWages(false, theWonder(true))).toBe(true);
    expect(aLeadersBeastsPayHalfWages(false, theWonder(false))).toBe(false);
    expect(asked).toBe(2);
  });
  test('a beast under a Druid pays half its wage, rounded down, at least 1g', () => {
    expect([1, 2, 3, 5, 8, 9].map((g) => theWageABeastPaysUnderADruid(g))).toEqual([1, 1, 1, 2, 4, 4]);
  });
});

describe("the wages' cuts that read no registry", () => {
  test('a summons and a Wild Hunt beast draw no wage (whatever its last turn, even 0); any other company does', () => {
    expect(aCompanyDrawsNoWage({})).toBe(false);
    expect(aCompanyDrawsNoWage({ _temporary: true })).toBe(true);
    expect(aCompanyDrawsNoWage({ _temporary: false })).toBe(false);
    expect(aCompanyDrawsNoWage({ _wildHuntUntilTurn: 0 })).toBe(true);
    expect(aCompanyDrawsNoWage({ _wildHuntUntilTurn: 12 })).toBe(true);
    expect(aCompanyDrawsNoWage({ _wildHuntUntilTurn: null })).toBe(false);
  });
  test('the Host-Leader saves on the companies he leads that draw a wage', () => {
    expect(theCompaniesTheHostLeaderSavesOn([])).toBe(0);
    expect(
      theCompaniesTheHostLeaderSavesOn([
        {},
        { _temporary: true },
        { _wildHuntUntilTurn: 9 },
        { _wildHuntUntilTurn: null },
        { _temporary: false },
      ]),
    ).toBe(3);
  });
  test("the Host-Leader's cut: 1g a company, no more than the wages, the wages never below 0", () => {
    expect(theHostLeadersCut(10, 3)).toEqual({ theGoldSaved: 3, theWagesLeft: 7 });
    expect(theHostLeadersCut(4, 4)).toEqual({ theGoldSaved: 4, theWagesLeft: 0 });
    expect(theHostLeadersCut(2, 5)).toEqual({ theGoldSaved: 2, theWagesLeft: 0 });
    expect(theHostLeadersCut(0, 0)).toEqual({ theGoldSaved: 0, theWagesLeft: 0 });
  });
});
