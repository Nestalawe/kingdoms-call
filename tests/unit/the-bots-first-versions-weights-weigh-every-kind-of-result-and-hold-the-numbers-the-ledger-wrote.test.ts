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
// (BOT_MAX_FIGHTS), and B-17t's: the court's wants, a hero's aptitudes and a specialist's work (bots/specialists.ts,
// part 1), and B-17u's: a thief's targets, the roles' work, a mage's work, a defender's post and a host's march (part
// 2), and B-17v's: an infiltration's and a consecration's, the signature orders', a research pick's and a slayer's kit,
// and an allied front's, a host's margin and the slayer's ladder (bots/missions.ts, part 1), and B-17w's: a lair plan's and the hunting gate's, a fleet's and an airborne column's strikes, a mastery challenge's and a duel stance's, a leaderless host's and a slayer's lessons (bots/missions.ts, part 2), each in its place: a
// change of one is a change of the bots' play (the balance matrix), never a refactor.
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
  expect(theNamesChecked, 'the names checked, every kind').toBe(347);
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
    theTurnsARivalsHostCountsInItsStrength: 4,
    theTurnsTheNewsOfABattleIsKept: 4,
    theStrengthARivalsHostsCountAtLeastForEachOfItsLandProvinces: 5,
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
    theBiasTowardsARivalsProvinceOverNeutralLandInATargetsScore: 12,
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
    theStrengthAgainstTheFoeBelowWhichAHostWhoseFoeNoFloodPinsFlees: 0.5,
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

test("the court's wanted specialists' weights are the numbers botSpecialistRoles wrote for its wants and its feeder reserve before B-17t, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.specialistsWanted).toEqual({
    theLairsKnownFromWhichTheCourtWantsASecondSlayer: 6,
    theMostScoutsTheCourtWants: 3,
    theUnmappedProvincesAScoutIsWantedFor: 6,
    theProvincesFromWhichTheCourtWantsASecondScholar: 10,
    theScholarsALargerCourtWants: 2,
    theTurnFromWhichTheCourtWantsASpyWithNoRealmMet: 3,
    theSpiesTheCourtWantsAtWar: 2,
    theTurnFromWhichTheCourtWantsAThiefWithNoRealmMet: 4,
    theTurnFromWhichTheCourtWantsAMageWithNoHeroKnowingASchool: 3,
    theProvincesFromWhichTheCourtWantsASecondMage: 10,
    theHeroesTheFeederReserveNeverSqueezesOut: 2,
    theProvincesFromWhichOneHeroIsKeptToMusterTroops: 3,
  });
});

test("a hero's aptitudes' weights are the numbers botSpecialistRoles' aptitude and botMageAptitude wrote before B-17t, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.specialistsAptitude).toEqual({
    theWorthOfEachLevelOfAMagesBestSchool: 4,
    theWorthOfEachLevelOfAMagesSecondSchool: 3,
    theWorthOfHoldingARoleAlready: 3,
    whatEachLevelOfAFightingSkillTakesOffAThinkingRolesCandidate: 0.5,
    theWorthOfEachLevelOfMeleeForASlayer: 4,
    theWorthOfEachLevelOfArcheryForASlayer: 3,
    theWorthOfEachHitPointForASlayer: 0.3,
    theWorthOfEachLevelOfADuellingSchoolForASlayer: 0.5,
    theWorthOfEachLevelOfTheRolesOwnSkillForAnyOtherRole: 4,
    whatEachPointOfMagicTakesOffAnyOtherRolesCandidate: 0.5,
  });
});

test("a specialist's work's weights are the numbers botTrainOrders, botScholarOrders, botScoutTarget, botRoamOrders and botSpyOrders wrote before B-17t, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.specialistsWork).toEqual({
    theThiefSkillFromWhichAThiefFightsByStealingAndFleeing: 3,
    theProvincesAwayAMentorMayStand: 3,
    theWorthOfEachLevelOfAMentorsSkill: 4,
    theProvincesAwayTheKingMayBeForAScholarToJoinHim: 3,
    theSageLevelFromWhichAScholarOnlyResearches: 5,
    theResearchesAScholarBelowThatLevelDoesEachSeason: 3,
    theWorthOfWildGroundToAScout: 15,
    theUnmappedPointsThatMakeAPointOfAScoutsTargetScore: 4,
    theWorthOfOwnGroundToAScout: 6,
    whatEachStepAwayTakesOffAScoutsTarget: 8,
    theProvincesAwayAScoutGoes: 4,
    theProvincesAwayARoamingHeroLooksForNewGround: 5,
    whatEachStepAwayTakesOffARoamsTarget: 3,
    theWorthOfEachUnitAMarkLeadsToSpyOn: 2,
    theWorthOfAKingAsAMarkToSpyOn: 5,
    theTurnsAGeneralLastSeenIsStillShadowed: 2,
    theProvincesAwayASpyShadowsAGeneral: 3,
    theWorthOfEachUnitALastSeenGeneralLeads: 2,
    theWorthOfAKingToShadow: 6,
    theWorthOfAGeneralAtWarToShadow: 5,
    whatEachStepAwayTakesOffAShadowedGeneral: 2,
    theProvincesAwayASpyLooksForANewTarget: 4,
    theSpyAttemptsBeforeASpyLiesInWait: 2,
  });
});

test("specialistsTheft's weights are the numbers bots/specialists.ts wrote inline before B-17u, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.specialistsTheft).toEqual({
    theWorthOfARivalKingAsAThievesMark: 6,
    theWorthOfARivalHeroAsAThievesMark: 3,
    theWorthOfEachItemAMarkCarriesToAThief: 2,
    whatALeadingMarkTakesOffAThievesTarget: 5,
    theWorthOfARivalCapitalAsAThievesMark: 3,
    theMostGarrisonsThatAddToAThievesTarget: 4,
    whatEachStepAwayTakesOffAThievesTarget: 2,
    theProvincesAwayAThiefLooksForAMarkToRob: 4,
    theThiefSkillFromWhichAThiefAtWarBreaksIntoAVault: 7,
    theProvincesAwayAThiefLooksForAVaultToBreakInto: 4,
    whatAGuardedVaultTakesOffAThievesTarget: 6,
    theGoldThatMakesAPointOfAVaultsWorthToAThief: 4,
    theWorthOfARivalCapitalAsAVaultToAThief: 4,
    theThiefSkillFromWhichAThiefRobsAGuardiansHoard: 3,
    theChanceFromWhichAThiefRobsAGuardiansHoard: 75,
    theProvincesAwayAThiefLooksForAHoardToRob: 4,
    theStealAttemptsBeforeAThiefLiesInWait: 1,
  });
});

test("specialistsRoleWork's weights are the numbers bots/specialists.ts wrote inline before B-17u, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.specialistsRoleWork).toEqual({
    theMeleeFromWhichASlayerWithNoLairsToGrowIntoScouts: 3,
    theExplorerLevelFromWhichAScoutChartsTheUnknown: 7,
    theSpySkillFromWhichASpyHasWork: 2,
    theSpySkillFromWhichASpyAssassinates: 9,
    theSpySkillFromWhichASpyAtWarSabotages: 7,
    theWorthOfARivalCapitalToSabotage: 3,
    theThiefSkillFromWhichAThiefHasWork: 2,
    theLevelOfAMagesFirstSchoolBeforeTheTwoRiseTogether: 2,
    theLevelOfMeleeOrArcheryFromWhichASlayerIsReady: 3,
  });
});

test("specialistsUnarmedFighters's weights are the numbers botLairTarget and botLairOrders wrote inline before B-17u, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.specialistsUnarmedFighters).toEqual({
    theWorthOfEachRankOfAGuardianToALairTarget: 2,
    whatEachStepAwayTakesOffALairTarget: 2,
    theProvincesAwayAnUnarmedFighterLooksForALair: 4,
  });
});

test("specialistsMageWork's weights are the numbers bots/specialists.ts wrote inline before B-17u, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.specialistsMageWork).toEqual({
    theProvincesAwayAMageLooksForAWandererToCharm: 3,
    theTurnsAGeneralLastSeenIsStillToBeHexed: 2,
    theProvincesAwayAMageGoesToHexAGeneral: 3,
    theWorthOfEachUnitAGeneralToHexLeads: 2,
    theWorthOfAKingToHex: 5,
    whatEachStepAwayTakesOffAGeneralToHex: 2,
    theProvincesAwayANecromancerGoesToBattlefieldDead: 3,
    theProvincesAwayAWhiteMageGoesToBlessGround: 3,
    theShareOfAnOwnedNeighboursTaxThatAddsToAProvincesBlessingWorth: 0.8,
    theUnitsAGeneralMustLeadForAMageToJoinHim: 3,
    theProvincesAwayAMageGoesToJoinAGeneral: 4,
    theMostCastsAMageGivesToHexAGeneral: 3,
    theMostCastsAMageGivesBesideAGeneral: 3,
    theMostCastsAMageGivesToBlessAProvince: 2,
  });
});

test("specialistsDefenders's weights are the numbers bots/specialists.ts wrote inline before B-17u, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.specialistsDefenders).toEqual({
    theWorthOfTheCapitalToADefendersPost: 6,
    theWorthOfAFrontierProvinceToADefendersPost: 2,
    theWorthOfARaisingPlaceToAnUnarmedDefender: 4,
    theWorthOfTheShareByWhichAProvincesGroundRaisesADefendersForce: 8,
    whatEachStepAwayTakesOffADefendersPost: 1.5,
    theShareOfTheBestPostsWorthWhichKeepsADefenderAtHisPost: 0.8,
    theMostStepsADefenderWalksToHisPostInASeason: 3,
    theGarrisonUnitsAnOwnedNeighbourMustHoldAboveForADefenderToGatherThem: 2,
    theLandUnitsFromWhichADefenderDrillsTactical: 3,
    theSageLevelFromWhichADefenderResearches: 2,
    theHexesFromTheCapitalWithinWhichAnEnemyHostIsAHomeThreat: 2,
    theWorthOfARaisingPlaceToAnArmedDefender: 1,
    theMostCastsADefenderGives: 2,
  });
});

test("specialistsHostsMarch's weights are the numbers bots/specialists.ts wrote inline before B-17u, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.specialistsHostsMarch).toEqual({
    theShareOfTheMarginAHostFacesWhenTheFoeHasAKing: 0.9,
    theWorthOfTheShareByWhichATargetsGroundRaisesAHostsForce: 15,
    theTimesAHostBesideATargetsStrengthTheColumnMustReachToAvoidATrap: 1.2,
    whatATargetBesideAnUnbeatableHostTakesOffItsScore: 25,
    theWorthOfEachUnitATargetsDefendersLead: 3,
    theNumberTheRivalBiasIsDividedByWhenAnAllyIsNearATarget: 2,
    whatSeaTakesOffATargetsScoreForAHostThatIsNotAnAdmirals: 40,
    theWorthOfASeaTargetBesideAnEnemyShoreToALoadedFleet: 40,
    theTimesTheRivalBiasASeaTargetBesideAnEnemyShoreAdds: 2,
    theFactorEachFightFoughtDividesAHostsStrengthBy: 1.2,
    theShareOfAHostsStrengthLeftAfterAFight: 0.85,
    theMostStepsAStrikeLooksAcrossForAStagingProvince: 8,
    whatEachStepOfMarchingTakesOffAStrikesTarget: 4,
  });
});

test("missionsInfiltration's weights are the numbers bots/missions.ts wrote inline before B-17v, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.missionsInfiltration).toEqual({
    theTaxBelowWhichUnownedGroundCountsAsEmpty: 3,
    theGravesCountedForAProvinceWhoseGravesAreKnownOnlyInPart: 2,
    theWorthOfEachPointOfTaxToAnInfiltrationTarget: 2,
    theWorthOfEachNeighbourAtWarToAnInfiltrationTarget: 4,
    theWorthOfEnemyLandToAnInfiltrationTarget: 10,
    theMostGravesThatAddToAnInfiltrationTarget: 3,
    theWorthOfEachGraveToAnInfiltrationTarget: 2,
    whatEachStepAwayTakesOffAnInfiltrationTarget: 3,
    theWorthOfEachPointOfTaxToAConsecrationTarget: 2,
    whatEachStepAwayTakesOffAConsecrationTarget: 3,
  });
});

test("missionsSignatureOrders's weights are the numbers bots/missions.ts wrote inline before B-17v, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.missionsSignatureOrders).toEqual({
    theGarrisonsThatTurnACallToArmsAway: 2,
    theWorthOfAFrontierProvinceToACallToArms: 4,
    theWorthOfTheCapitalToACallToArms: 2,
    whatEachGarrisonTakesOffACallToArmsTarget: 3,
    theWorthOfEachPointOfHireBiasToABrokersHire: 3,
    theUnitsAHostMustHoldToMakeABloodOffering: 6,
  });
});

test("missionsResearchAndKit's weights are the numbers bots/missions.ts wrote inline before B-17v, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.missionsResearchAndKit).toEqual({
    theWorthOfAMilitaryDiscoveryAtWar: 4,
    theWorthOfAMilitaryDiscoveryAtPeace: 2,
    theWorthOfAnEconomicDiscoveryAtWar: 2,
    theWorthOfAnEconomicDiscoveryAtPeace: 4,
    theWorthOfAnEspionageDiscoveryOnceOtherCrownsAreMet: 3,
    theWorthOfAnEspionageDiscoveryBeforeOtherCrownsAreMet: 1,
    theWorthOfAScholarshipDiscovery: 2,
    theWorthOfAHeroicDiscovery: 3,
    theWorthOfASpecialDiscovery: 3,
    theTimesACategorysWorthCountsInADiscoverysWorth: 2,
    theWorthOfAWarlikeWordingAtWar: 4,
    theWorthOfAWarlikeWordingAtPeace: 2,
    theWorthOfAWordingOfWealthAtWar: 1,
    theWorthOfAWordingOfWealthAtPeace: 3,
    theWorthOfAWordingOfEspionageOnceOtherCrownsAreMet: 2,
    theWorthOfAWordingOfLore: 1,
    theUnitsTheRealmMustHoldForThePhilosophersStoneToBeUsed: 8,
    theWorthOfTheComradeWhoseRoleMostUsesAKitsStat: 10,
    theWorthOfASlayerAsTheComradeToGetDuellingKit: 5,
    theMostKitSentToOneComradeInATurn: 2,
  });
});

test("missionsAlliesAndLairs's weights are the numbers bots/missions.ts wrote inline before B-17v, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.missionsAlliesAndLairs).toEqual({
    theUnitsAnAlliedHostMustLeadToCountAsAnAlliedFront: 3,
    theTurnsARecordedHostStillCountsAgainstATarget: 3,
    theMostMarginAHostAsksOfAFoesHost: 2,
    theMarginAHostAsksOfAFoesColumnAtOrBelowTheMarginsThreshold: 1.5,
    theMarginEachUnitBeyondTheMarginsThresholdAddsToWhatAHostAsks: 0.05,
    theUnitsOfAFoesHostBeyondWhichTheMarginRises: 5,
    theLevelOfMeleeTheSlayersLadderFirstAsksOf: 3,
    theLevelOfArcheryTheSlayersLadderFirstAsksOf: 2,
    theLevelOfASchoolTheSlayersLadderFirstAsksOf: 1,
    theLevelOfMeleeTheSlayersLadderNextAsksOf: 4,
    theLevelOfASchoolTheSlayersLadderNextAsksOf: 2,
    theLevelOfMeleeTheSlayersLadderThenAsksOf: 5,
    theLevelOfASchoolTheSlayersLadderThenAsksOf: 3,
    theLevelOfASchoolTheSlayersLadderFinallyAsksOf: 5,
    theLevelOfArcheryTheSlayersLadderFinallyAsksOf: 5,
    theLevelOfEachOtherBattleSchoolTheSlayersLadderEndsWith: 5,
    theGoldAboveARumoursPriceTheMusterBudgetMustHold: 1,
    theGoldAboveARumoursPriceTheTreasuryMustHold: 3,
    theLairsOfTheGradeAboveClearedThatKeepAHeroAskingAboutIt: 1,
  });
});

test("missionsLairPlan's weights are the numbers bots/missions.ts wrote inline before B-17w, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.missionsLairPlan).toEqual({
    theMeleeOrArcheryLevelBelowWhichAHeroIsNotSentHuntingAlone: 3,
    theMeleeAndArcheryLevelsTogetherBelowWhichAHeroIsNotSentHuntingAlone: 5,
    theMeleeLevelFromWhichACombatSchoolCanOpenTheHuntingGate: 2,
    theLevelsOfMeleeArcheryAndACombatSchoolTogetherThatOpenTheHuntingGate: 6,
    theTurnsAnAssessmentOfALairStaysGoodForTheHeroWhoAskedIt: 6,
    theTurnsAFreshLowAssessmentOfTheGradeAboveHoldsBackAskingAgain: 1,
    theOrdersAHeroMustHaveLeftToCastInvisibilityBeforeALair: 2,
    theShareOfAHeroesHitPointsHeMustHoldForAFirstSearchOrderedOnAFreshAssessment: 0.5,
    theStepsFromASlayerWithinWhichAKnownLairIsOneHeMayGrowInto: 4,
  });
});

test("missionsStrikes's weights are the numbers bots/missions.ts wrote inline before B-17w, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.missionsStrikes).toEqual({
    whatEachStepOfSailingTakesOffAnUnownedSeaAsAFleetsTarget: 2,
    theWorthOfOpenWaterAsAFleetsTarget: 40,
    theWorthOfPoorWatersAsAFleetsTarget: 15,
    theWorthOfAnOwnedCoastWithAGeneralWhoseFootSoldiersAFleetMayLift: 20,
    theWorthOfEachBerthFilledAtAFleetsRendezvous: 4,
    whatEachStepOfSailingTakesOffAFleetsRendezvous: 3,
    theShareOfAMarginAHostAsksWhenItsFoeHoldsAKing: 0.9,
    theMarginAnAmphibiousAssaultAsksBeyondALandAssault: 1.1,
    theTimesATaxPointCountsWhenAFleetChoosesALandingCoast: 1.5,
    theTimesARivalBiasCountsInAStrikesTarget: 2,
    theWorthOfEachUnitOfAFoesHostInAStrikesTarget: 3,
    whatEachStepOfSailingTakesOffAFleetsLandingCoast: 3,
    theTimesATaxPointCountsWhenAnAirborneColumnChoosesASeaTarget: 0.5,
    theTimesATaxPointCountsWhenAnAirborneColumnChoosesALandTarget: 1.2,
    theWorthOfAnEnemyProvinceBehindTheFrontToAnAirborneColumn: 25,
    whatEachStepOfFlyingTakesOffAnAirborneColumnsTarget: 2,
  });
});

test("missionsDuels's weights are the numbers bots/missions.ts wrote inline before B-17w, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.missionsDuels).toEqual({
    theChanceToWinFromWhichAMasteryChallengeIsMade: 0.7,
    theMostChanceOfFallingFromWhichAMasteryChallengeIsMade: 0.1,
    theDuelsPlayedToForecastAMasteryChallenge: 24,
    theDuellingSkillBelowWhichAHeroRefusesEveryDuel: 2,
    theShareOfHitPointsBelowWhichAHeroRefusesEveryDuel: 0.6,
    theDuellingSkillOfARealDuellist: 4,
    theShareOfHitPointsAFitDuellistMustHold: 0.8,
    theDuellingSkillFromWhichAKingAcceptsWithNoGeneralInSight: 4,
    theTurnsAnEnemyGeneralRecordedElsewhereStillCountsAsNear: 2,
    theDuelsPlayedToForecastAStance: 16,
    theRatingAHeroMustHaveOverAFoeToCountAsStrongerWithNoForecast: 1.3,
    theChanceToWinCountedWithNoForecastForOneRatedStronger: 0.7,
    theChanceToWinCountedWithNoForecastForAnyOther: 0.4,
  });
});

test("missionsOrphanedHost's weights are the numbers bots/missions.ts wrote inline before B-17w, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.missionsOrphanedHost).toEqual({
    theUnitsBeyondItsGarrisonTargetAProvinceMustHoldToCountAsALeaderlessHost: 3,
    theMostStepsAHeroWalksToTakeUpALeaderlessHost: 5,
    theWorthOfEachUnitOfALeaderlessHost: 3,
    whatEachStepTakesOffALeaderlessHostsWorth: 2,
  });
});

test("missionsSlayerSchool's weights are the numbers bots/missions.ts wrote inline before B-17w, each in its place", () => {
  expect(THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION.missionsSlayerSchool).toEqual({
    theRankOfMeleeAmongTheSkillsASlayerIsTaught: 0,
    theRankOfTheSlayersOwnSchoolAmongTheSkillsASlayerIsTaught: 1,
    theRankOfArcheryAmongTheSkillsASlayerIsTaught: 2,
    theRankOfEachOtherBattleSchoolAmongTheSkillsASlayerIsTaught: 3,
    theRankOfEveryOtherSkillAmongTheSkillsASlayerIsTaught: 4,
    theShareOfHitPointsAnUnarmedSlayerMustHoldToBeTaught: 0.6,
    theMostStepsASlayerWalksToALesson: 3,
    theWorthOfEachPhaseOfLessonsInATeachersPlan: 10,
    theWorthOfEachLessonThatOpensTheHuntingGate: 6,
    theWorthOfTheKingAsTheTeacherOfAPlan: 1,
    theMostStepsASlayerWalksToWhereTheKingWillStand: 5,
  });
});
