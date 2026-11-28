// The bots' first version's weights weigh every kind of result, and hold the numbers the ledger wrote (B-06h, T7: the
// rules pulled out, the bots' worth of gold). The weights file is keyed by the kind of result a rule hands a bot
// (AKindOfResultABotWeighs), never by the effect, and ends `satisfies TheWeightsOfABotVersion`, the type of its Zod
// schema (B-17q: src/schemas/the-weights-of-a-bot-version-…ts, each kind an object of its names). Here, as types the
// compiler checks: the file weighs every kind and no other, it meets the schema's type, and it fails it with one more
// kind (a kind with no weight), a name misspelt or a weight not a number, each a constant whose type holds only while
// that is so (no comment that waives an error). Then the file parsed with the schema's strict version: no issue, and a
// weight of the wrong type, a missing name and one more name each give one. Then the gold's weights, each the number
// botLedger wrote before T7, a title's (B-06r), each the number botTargetTitles and botSpecialistRoles wrote, and an
// alignment ability's (P1-19bb8), each the number botHeroCap, botSpecialistRoles and the scholar's orders wrote, and a
// race gift's (B-06ah), each the number botTuning's race overlays wrote, a temper's (B-06aj), each the number
// botDuelRating and the war bar's table (BOT_WAR.temper) wrote, and a point of a host's strength's (B-06bq), each the
// number botBattleForce, botGuessDefence and botMarginFor wrote, in its place: a change of one is a change of the bots'
// play (the balance matrix), never a refactor.
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

test('the weights file weighs every kind of result and no other, meets its schema, and a kind with no weight, a misspelt name or a weight not a number fails to compile', () => {
  const itWeighsEveryKindAndNoOther: TheSame<keyof TheFirstVersionsWeights, AKindOfResultABotWeighs> = true;
  const itMeetsTheSchemasType: ItMeetsTheSchema<TheFirstVersionsWeights> = true;
  const aKindWithNoWeightFailsIt: ItMeetsTheSchema<
    Omit<TheFirstVersionsWeights, 'temper'> & Record<'a-kind-with-no-weight', AGold>
  > = false;
  const aMisspeltNameFailsIt: ItMeetsTheSchema<WithANameMisspelt> = false;
  const aWeightNotANumberFailsIt: ItMeetsTheSchema<WithAWeightNotANumber> = false;
  expect([
    itWeighsEveryKindAndNoOther,
    itMeetsTheSchemasType,
    aKindWithNoWeightFailsIt,
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

test("the schema's strict version refuses a weight of the wrong type, a missing name and one more name", () => {
  const { gold } = THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION;
  const goldWithANameMissing = Object.fromEntries(
    Object.entries(gold).filter(([name]) => name !== 'theMostGoldTheChestKeepsOnAWarFooting'),
  );
  const withAWeightOfTheWrongType = {
    ...THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION,
    gold: { ...gold, theMostGoldTheChestKeepsOnAWarFooting: '8' },
  };
  const withANameMissing = { ...THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION, gold: goldWithANameMissing };
  const withOneMoreName = {
    ...THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION,
    gold: { ...gold, aWeightTheSchemaDoesNotName: 1 },
  };
  const theIssues = (value: unknown): string => strictIssues(TheWeightsOfABotVersionSchema, value).join(' | ');
  expect(theIssues(withAWeightOfTheWrongType), 'a weight of the wrong type').toMatch(
    /^gold\.theMostGoldTheChestKeepsOnAWarFooting: invalid_type/,
  );
  expect(theIssues(withANameMissing), 'a missing name').toMatch(
    /^gold\.theMostGoldTheChestKeepsOnAWarFooting: invalid_type/,
  );
  expect(theIssues(withOneMoreName), 'one more name').toMatch(/^gold: unrecognized_keys .*aWeightTheSchemaDoesNotName/);
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
