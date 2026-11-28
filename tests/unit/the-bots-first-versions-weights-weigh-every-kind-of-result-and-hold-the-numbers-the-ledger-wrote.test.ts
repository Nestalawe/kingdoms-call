// The bots' first version's weights weigh every kind of result, and hold the numbers the ledger wrote (B-06h, T7: the
// rules pulled out, the bots' worth of gold). The weights file is keyed by the kind of result a rule hands a bot
// (AKindOfResultABotWeighs), never by the effect, and ends `satisfies Record<…>`: a kind it gives no weights fails to
// compile. Here, as types the compiler checks: the file weighs every kind and no other, it meets the Record of the
// kinds, and it fails the Record of the kinds with one more (a kind with no weight), each a constant whose type holds
// only while that is so (no comment that waives an error). Then the gold's weights, each the number botLedger wrote
// before T7, a title's (B-06r), each the number botTargetTitles and botSpecialistRoles wrote, and an alignment
// ability's (P1-19bb8), each the number botHeroCap, botSpecialistRoles and the scholar's orders wrote, and a race
// gift's (B-06ah), each the number botTuning's race overlays wrote, a temper's (B-06aj), each the number botDuelRating
// and the war bar's table (BOT_WAR.temper) wrote, and a point of a host's strength's (B-06bq), each the number
// botBattleForce, botGuessDefence and botMarginFor wrote, in its place: a change of one is a change of the bots' play
// (the balance matrix), never a refactor.
//
// Level 1 (unit): the weights module is imported and its numbers read; its types are the compiler's (`npm run check`),
// which a lower level can't run.
import { expect, test } from 'vitest';
import type { AKindOfResultABotWeighs, TheWeightsOfAKindOfResult } from '../../src/engine/bots/intel.ts';
import { THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION } from '../../src/engine/bots/the-weights-of-the-bots-first-version-what-a-unit-of-each-kind-of-result-is-worth.ts';

type TheFirstVersionsWeights = typeof THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION;

/** Whether two types are the same, each taking the other (no `boolean` passes for `true`). */
type TheSame<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Whether the first version's weights meet the Record of the kinds given, each kind's weights numbers. */
type TheWeightsMeetTheRecordOf<Kinds extends string> = [TheFirstVersionsWeights] extends [
  Record<Kinds, TheWeightsOfAKindOfResult>,
]
  ? true
  : false;

test('the weights file weighs every kind of result and no other, and a kind with no weight fails to compile', () => {
  const itWeighsEveryKindAndNoOther: TheSame<keyof TheFirstVersionsWeights, AKindOfResultABotWeighs> = true;
  const itMeetsTheRecordOfTheKinds: TheWeightsMeetTheRecordOf<AKindOfResultABotWeighs> = true;
  const aKindWithNoWeightFailsIt: TheWeightsMeetTheRecordOf<AKindOfResultABotWeighs | 'a-kind-with-no-weight'> = false;
  expect([itWeighsEveryKindAndNoOther, itMeetsTheRecordOfTheKinds, aKindWithNoWeightFailsIt]).toEqual([
    true,
    true,
    false,
  ]);
});

test("a gold's weights are the numbers botLedger wrote before T7, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.gold).toEqual({
    theMostUnitsOfAnEnemyHostThatLeaveTheRealmAtPeace: 5,
    theShareOfTheIncomeTheWagesMayTakeOnAWarFooting: 1,
    theShareOfTheWagesTheChestKeepsOnAWarFooting: 0.15,
    theLeastGoldTheChestKeepsOnAWarFooting: 2,
    theMostGoldTheChestKeepsOnAWarFooting: 8,
    theProvincesBelowWhichARealmIsSmall: 15,
    theShareOfTheFreeTreasuryASmallRealmsWagesMayLeanOn: 0.6,
    theUnitsEachDefenderLeadsAtFullStrength: 3,
    theShareOfTheWageCeilingHeldBackForTheDefenders: 0.2,
  });
});

test("a title's weights are the numbers botTargetTitles and botSpecialistRoles wrote before T7, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.title).toEqual({
    theWorthOfATitleTheRealmHolds: 3,
    theShareOfItsHoldersMeritThatMakesATitleWorthChasing: 0.6,
    theMostTitlesARealmChases: 3,
    theWorthOfEachLevelOfAFightingSkillTowardsATitleWonByFighting: 1,
    theWorthOfEachLevelOfTheSkillsATitleMeasures: 2,
    theWorthOfATitleWonByBattlesOnLandBeforeAnyLevel: 5,
    theWorthOfATitleWonBySlayingGuardiansBeforeAnyLevel: 2,
    theTitlesARealmChasesWhenNoneIsWorthAPoint: 2,
    theSpecialistsMoreAChasedTitleWants: 1,
  });
});

test("an alignment ability's weights are the numbers botHeroCap, botSpecialistRoles and the scholar's orders wrote before T7", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.alignmentAbility).toEqual({
    theHeroesMoreARealmWhoseDearestWandererAsksTheLeastWants: 1,
    theScholarsMoreARealmWhoseAlignmentAddsToResearchWants: 1,
    theSageLevelFromWhichSuchARealmsScholarResearches: 1,
    theSageLevelFromWhichAnyOtherRealmsScholarResearches: 2,
  });
});

test("a race gift's weights are the numbers botTuning's race overlays wrote before T7, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.raceGift).toEqual({
    theKingsAttackMarginARealmWhoseCompaniesDefendAtAGiftsFactorOnAnyGroundAdds: 0.1,
    theHerosAttackMarginARealmWhoseCompaniesDefendAtAGiftsFactorOnAnyGroundAdds: 0.1,
    theKingsAttackMarginARealmThatTakesTheSpoilsOfABattleWonAttackingTakesOff: 0.05,
    theHerosAttackMarginARealmThatTakesTheSpoilsOfABattleWonAttackingTakesOff: 0.05,
    theShareOfTheIncomeTheWagesMayTakeMoreInARealmThatTakesTheSpoilsOfABattleWonAttacking: 0.05,
  });
});

test("a temper's weights are the numbers botDuelRating and the war bar's table wrote before T7, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.temper).toEqual({
    theDuelWorthOfABerserkHero: 6,
    theDuelWorthOfABraveHero: 4,
    theDuelWorthOfACautiousHero: 5,
    theDuelWorthOfACowardlyHero: 0,
    whatABerserkKingAddsToTheBarForWar: -0.25,
    whatABraveKingAddsToTheBarForWar: -0.1,
    whatACautiousKingAddsToTheBarForWar: 0.15,
    whatACowardlyKingAddsToTheBarForWar: 0.3,
  });
});

test("a point of a host's strength's weights are the numbers botBattleForce, botGuessDefence and botMarginFor wrote before T7, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.battleStrength).toEqual({
    theHighestLevelOfTacticalTheBotsWeigh: 5,
    theHighestLevelOfNavalTheBotsWeigh: 5,
    theStrengthOfAUnitTheBotsCantSee: 6,
    theFactorTheBotsGuessARivalsProvinceHeldMoreHeavilyBy: 1.25,
    theLeastMarginAKingsAttackWants: 1.15,
    theLeastMarginAHerosAttackWants: 1,
    theShareTheMarginEasesEachTurnTheRealmGainsNoLand: 0.08,
    theLeastShareTheMarginEasesTo: 0.6,
    theUnitsOfAHostBeforeItsStakeAddsToTheMargin: 5,
    whatEachUnitMoreOfAHostAddsToTheMargin: 0.02,
    theMostAHostsStakeAddsToTheMargin: 0.1,
  });
});
