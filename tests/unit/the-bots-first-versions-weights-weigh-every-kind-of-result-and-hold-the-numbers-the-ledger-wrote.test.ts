// The bots' first version's weights weigh every kind of result, and hold the numbers the ledger wrote (B-06h, T7: the
// rules pulled out, the bots' worth of gold). The weights file is keyed by the kind of result a rule hands a bot
// (AKindOfResultABotWeighs), never by the effect, and ends `satisfies TheWeightsOfABotVersion`, the type of its Zod
// schema (B-17q: src/schemas/the-weights-of-a-bot-version-…ts, each kind an object of its names). Here, as types the
// compiler checks: the file weighs every kind and no other, it meets the schema's type, and it fails it with a kind
// missing, a name misspelt or a weight not a number, each a constant whose type holds only while that is so (no
// comment that waives an error). Then the file parsed with the schema's strict version: no issue; and in every kind,
// each name missing or in words gives one on that name, and one more name one on the kind. Then the gold's weights,
// each the number botLedger wrote before T7, a title's (B-06r), each the number botTargetTitles and botSpecialistRoles
// wrote, and an alignment ability's (P1-19bb8), each the number botHeroCap, botSpecialistRoles and the scholar's orders
// wrote, and a race gift's (B-06ah), each the number botTuning's race overlays wrote, a temper's (B-06aj), each the
// number botDuelRating and the war bar's table (BOT_WAR.temper) wrote, and a point of a host's strength's (B-06bq),
// each the number botBattleForce, botGuessDefence and botMarginFor wrote, a war's (B-17r), each the number BOT_WAR
// wrote, a lair's (B-17r), each the number the BOT_LAIR_* names wrote, and a realm's tuning (B-17r), each the number
// BOT_TUNING and BOT_DIFFICULTY wrote; then B-17s's: a duel's (BOT_DUEL, BOT_DUEL_WITHOUT_A_FORECAST), the Spring
// pass's (BOT_P1, BOT_PIN_EDGE), a rival's hero's assumed skills' (BOT_ASSUMED_SKILLS), and the names B-17s added to the gold
// (the fleets' caps), the war (BOT_ALLY_ALIGN_DIST), the lair (BOT_RUMOUR_FUND_PER_SLAYER) and the tuning
// (BOT_MAX_FIGHTS), each in its place: a change of one is a change of the bots' play (the balance matrix), never a
// refactor.
//
// Level 1 (unit): the weights module and its schema are imported, its numbers read and parsed; its types are the
// compiler's (`npm run check`), which a lower level can't run.
import { expect, test } from 'vitest';
import type { AKindOfResultABotWeighs } from '../../src/engine/bots/intel.ts';
import { THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION } from '../../src/engine/bots/the-weights-of-the-bots-first-version-what-a-unit-of-each-kind-of-result-is-worth.ts';
import {
  TheWeightsOfABotVersionSchema,
  type TheWeightsOfABotVersion,
} from '../../src/schemas/the-weights-of-a-bot-version-each-kind-of-result-and-the-names-of-its-weights.ts';
import { strictIssues } from '../lib/strict-schema.ts';

type TheFirstVersionsWeights = typeof THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION;
type AGold = TheWeightsOfABotVersion['gold'];

/** Whether two types are the same, each taking the other (no `boolean` passes for `true`). */
type TheSame<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Whether a bot version's weights of the shape given meet the schema's type. */
type ItMeetsTheSchema<Weights> = [Weights] extends [TheWeightsOfABotVersion] ? true : false;

/** The weights with the gold's most kept on a war footing misspelt (`Keep` for `Keeps`). */
type WithANameMisspelt = Omit<TheWeightsOfABotVersion, 'gold'> & {
  gold: Omit<AGold, 'theMostGoldTheChestKeepsOnAWarFooting'> & { theMostGoldTheChestKeepOnAWarFooting: number };
};
/** The weights with the gold's most kept on a war footing written as words, not a number. */
type WithAWeightNotANumber = Omit<TheWeightsOfABotVersion, 'gold'> & {
  gold: Omit<AGold, 'theMostGoldTheChestKeepsOnAWarFooting'> & { theMostGoldTheChestKeepsOnAWarFooting: string };
};

test('the weights file weighs every kind of result and no other, meets its schema, and a missing kind, a misspelt name or a weight not a number fails to compile', () => {
  const itWeighsEveryKindAndNoOther: TheSame<keyof TheFirstVersionsWeights, AKindOfResultABotWeighs> = true;
  const itMeetsTheSchemasType: ItMeetsTheSchema<TheFirstVersionsWeights> = true;
  const aMissingKindFailsIt: ItMeetsTheSchema<Omit<TheFirstVersionsWeights, 'temper'>> = false;
  const aMisspeltNameFailsIt: ItMeetsTheSchema<WithANameMisspelt> = false;
  const aWeightNotANumberFailsIt: ItMeetsTheSchema<WithAWeightNotANumber> = false;
  expect([
    itWeighsEveryKindAndNoOther,
    itMeetsTheSchemasType,
    aMissingKindFailsIt,
    aMisspeltNameFailsIt,
    aWeightNotANumberFailsIt,
  ]).toEqual([true, true, false, false, false]);
});

test("the weights file parses with its schema's strict version: every kind and name, each a number, no other", () => {
  expect(
    strictIssues(TheWeightsOfABotVersionSchema, THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION),
    'the weights file',
  ).toEqual([]);
});

test("the schema's strict version refuses, in every kind, each name missing, each name not a number and one more name", () => {
  const theWeights: Readonly<Record<string, Readonly<Record<string, unknown>>>> = THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION;
  /** Each issue of a value parsed strictly, as its path and its code (`gold.theMost…: invalid_type`). */
  const theIssues = (value: unknown): string[] =>
    strictIssues(TheWeightsOfABotVersionSchema, value).map((issue) => issue.split(' ').slice(0, 2).join(' '));
  let theNamesChecked = 0;
  for (const [kind, names] of Object.entries(theWeights)) {
    for (const name of Object.keys(names)) {
      theNamesChecked += 1;
      const withTheNameMissing = {
        ...theWeights,
        [kind]: Object.fromEntries(Object.entries(names).filter(([other]) => other !== name)),
      };
      expect(theIssues(withTheNameMissing), `${kind}.${name} missing`).toEqual([`${kind}.${name}: invalid_type`]);
      const withTheNameInWords = { ...theWeights, [kind]: { ...names, [name]: 'a weight in words' } };
      expect(theIssues(withTheNameInWords), `${kind}.${name} in words`).toEqual([`${kind}.${name}: invalid_type`]);
    }
    const withOneMoreName = { ...theWeights, [kind]: { ...names, aWeightTheSchemaDoesNotName: 1 } };
    expect(theIssues(withOneMoreName), `${kind} with one more name`).toEqual([`${kind}: unrecognized_keys`]);
  }
  expect(theNamesChecked, 'the names checked, every kind').toBe(125);
});

test("a gold's weights are the numbers botLedger wrote before T7 and the fleets' caps before B-17s, each in its place", () => {
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
    theShareOfTheWageCeilingTheAdmiralsFleetMayTake: 0.2,
    theShareOfTheWageCeilingTheSkyGeneralsHostMayTake: 0.15,
    theLeastWagesTheAdmiralsFleetMayTake: 4,
    theLeastWagesTheSkyGeneralsHostMayTake: 4,
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

test("a war's weights are the numbers BOT_WAR wrote before B-17r and BOT_ALLY_ALIGN_DIST before B-17s, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.war).toEqual({
    theBarTheRealmsStrengthAgainstARivalsMustClearForWar: 0.8,
    theLowestTheBarForWarFalls: 0.75,
    whatEachStepOfAlignmentBeyondTheSecondTakesOffTheBar: 0.1,
    whatARealmWhoseAlignmentDeclaresWarWithoutWarningTakesOffTheBar: 0.15,
    whatARealmStillExpandingIntoFreeLandAddsToTheBar: 0.1,
    theTurnsGainingNoLandAfterWhichARealmNoLongerExpandsFirst: 3,
    whatEachOpportunityTakesOffTheBar: 0.2,
    theMostTheOpportunitiesTakeOffTheBar: 0.5,
    theShareOfTheRivalsStrengthBelowWhichARealmAtWarSuesForPeace: 0.35,
    theBattlesLostLatelyAtWhichARealmAtWarSuesForPeace: 3,
    theTurnsAWarIsKeptBeforePeaceIsWeighed: 5,
    theTurnsAPeaceIsKeptBeforeWarIsWeighedAgain: 6,
    theShareOfAnAllysStrengthCountedOnItsSide: 0.6,
    theShareOfEachOtherFoesStrengthTakenOffTheRealmsOwn: 0.25,
    theTurnsASightingOfARivalsHostCountsInItsStrength: 4,
    theTurnsTheNewsOfABattleIsKept: 4,
    theStrengthARivalsHostsCountAtLeastForEachLandProvinceSeenHeld: 5,
    theProvincesFromItsCapitalAtWhichARivalsHostIsFarFromHome: 3,
    theTimesTheRealmsStrengthAtWhichAGrudgeYields: 5,
    theTimesTheRealmsStrengthAtWhichAGrudgeComesBack: 2,
    theProvincesFromTheRealmAPrizeMayLie: 2,
    theShareOfAFoesStrengthBelowWhichTheRealmStartsNoNewWar: 0.6,
    theTimesTheBarAWarWithNoPrizeInReachMustClear: 1.3,
    theShareOfTheRivalsStrengthBelowWhichARealmAcceptsItsPeace: 0.9,
    theShareOfTheRivalsStrengthBelowWhichARealmWithNoPrizeInReachAcceptsItsPeace: 0.7,
    theStepsOfAlignmentWithinWhichARealmCourtsAnotherRatherThanFightsIt: 1,
  });
});

test("a lair's weights are the numbers the BOT_LAIR_* names wrote before B-17r and the rumour fund before B-17s, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.lair).toEqual({
    theRumourBandFromWhichAHeroRisksAWeakLair: 80,
    theShareOfHisHitPointsAHeroRisksAWeakLairWith: 0.95,
    theProvincesAwayAHeroLooksForALair: 6,
    theMostRumoursAHeroBuysAYear: 3,
    theRumourBandThatSendsAHeroIntoAWeakLair: 90,
    theRumourBandThatSendsAHeroIntoAStrongerLair: 90,
    theLairsOfAGradeClearedThatMakeItAHerosOwn: 2,
    theLairsOfHisOwnGradeClearedBeforeAHeroAsksOfTheGradeAbove: 2,
    theLairsMoreOfHisOwnGradeAHeroClearsAfterAPoorReading: 0,
    theShareOfHisHitPointsBelowWhichAHeroRestsBeforeAHunt: 0.75,
    theShareOfHisHitPointsBelowWhichAHerosNextSearchBecomesARest: 0.6,
    theMostLairsAHeroSearchesAYear: 3,
    theItemsAHeroCarriesToAskOfModerateLairsEarly: 3,
    theItemsAHeroCarriesToAskOfPowerfulLairsEarly: 5,
    theItemsAHeroCarriesToAskOfLegendaryLairsEarly: 7,
    theFightingSkillAHeroHasToAskOfModerateLairsEarly: 4,
    theFightingSkillAHeroHasToAskOfPowerfulLairsEarly: 6,
    theFightingSkillAHeroHasToAskOfLegendaryLairsEarly: 8,
    theRiseInHisRatingAfterWhichAHeroAsksALairsRumourAgain: 3,
    theGoldSetAsideForEachSlayersRumours: 4,
  });
});

test("a realm's tuning's weights are the numbers BOT_TUNING and BOT_DIFFICULTY wrote before B-17r and BOT_MAX_FIGHTS before B-17s", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.tuning).toEqual({
    theStrengthRatioAKingsAttackWants: 1.35,
    theStrengthRatioAHerosAttackWants: 1.2,
    theStrengthRatioAConcentratedAssaultWants: 1.4,
    theTaxFromWhichAProvinceIsValuableToHold: 7,
    whatEachGoldOfATargetProvincesTaxAddsToItsScore: 10,
    theGoldKeptInHandBeforeAnyRecruiting: 3,
    theShareOfTheFreeTreasuryTheWagesMayLeanOn: 0.35,
    theFactorTheBotsStrengthTakesTheAttackMarginsBy: 0.92,
    theFactorTheBotsStrengthTakesTheAssaultMarginBy: 0.9,
    whatARivalsProvinceAddsToItsScoreAsATarget: 12,
    theShareOfTheIncomeTheWagesMayTakeInPeace: 0.97,
    theFightsAHostChainsInATurnBeforeItTakesOnlyUnguardedGround: 3,
  });
});

test("a duel's weights are the numbers BOT_DUEL and BOT_DUEL_WITHOUT_A_FORECAST wrote before B-17s, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.duel).toEqual({
    theChanceToWinFromWhichAHeroAcceptsADuel: 0.5,
    theChanceToWinFromWhichAKingAcceptsADuel: 0.6,
    theMostChanceOfFallingAKingRisksInADuel: 0.1,
    theChanceToWinFromWhichADuellistChallenges: 0.65,
    theChanceOfFallingCountedWithNoForecastByOneRatedClearlyStronger: 0.05,
    theChanceOfFallingCountedWithNoForecastByAnyOther: 0.3,
  });
});

test("the Spring pass's weights are the numbers BOT_P1 and BOT_PIN_EDGE wrote before B-17s, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.springPass).toEqual({
    theStrengthAgainstTheFoeBelowWhichAHostInContactFallsBack: 0.75,
    theStrengthAgainstTheFoeBelowWhichAHostNotPinningItsFoeFlees: 0.5,
    theFactorTheEmergencyLevyRaisesTheWageCeilingBy: 1.2,
    theLeastWagesTheEmergencyLevyRaisesTheCeilingAboveWhatTheRealmPays: 8,
    theGoldTheWarChestHoldsForEachHostInContact: 10,
    theMostShareOfTheFreeTreasuryTheWarChestHolds: 0.5,
    theTimesAnEnemyHostsStrengthAtWhichItIsBeatableWhereItStands: 1.2,
  });
});

test("a rival's hero's assumed skills' weights are the numbers BOT_ASSUMED_SKILLS wrote before B-17s, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.rivalsSkills).toEqual({
    theMeleeTheBotsAssumeOfARivalsHeroByDefault: 3,
    theArcheryTheBotsAssumeOfARivalsHeroByDefault: 2,
    theTacticalTheBotsAssumeOfARivalsHeroByDefault: 2,
    theElementalTheBotsAssumeOfARivalsHeroByDefault: 2,
  });
});
