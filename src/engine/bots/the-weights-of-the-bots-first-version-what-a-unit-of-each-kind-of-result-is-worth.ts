// ── The weights of the bots' first version: what a unit of each kind of result is worth to it (B-06h, B-06r) ──
// One file a bot version. Its shape is the schema's (src/schemas/the-weights-of-a-bot-version-…ts: each kind's names,
// each with what it weighs), so a name misspelt, missing or more fails to compile. Each number is the one the bots'
// code wrote before T7, copied exactly; weights tuned by kind come after T7, the old bot played against the new.
import type { TheWeightsOfABotVersion } from '../../schemas/the-weights-of-a-bot-version-each-kind-of-result-and-the-names-of-its-weights.ts';

/** What the bots' first version makes of each kind of result, by the kind. */
export const THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION = {
  /** A gold: what the realm's ledger keeps in its chest, lets its wages take and holds back for its posts each turn
   *  (botLedger, bots/strategy.ts). The wages and the tax it weighs are the rules' (botUpkeep, botTaxIncome). */
  gold: {
    theMostUnitsOfAnEnemyHostThatLeaveTheRealmAtPeace: 5,
    theShareOfTheIncomeTheWagesMayTakeOnAWarFooting: 1.0,
    theShareOfTheWagesTheChestKeepsOnAWarFooting: 0.15,
    theLeastGoldTheChestKeepsOnAWarFooting: 2,
    theMostGoldTheChestKeepsOnAWarFooting: 8,
    theProvincesBelowWhichARealmIsSmall: 15,
    theShareOfTheFreeTreasuryASmallRealmsWagesMayLeanOn: 0.6,
    theUnitsEachDefenderLeadsAtFullStrength: 3,
    theShareOfTheWageCeilingHeldBackForTheDefenders: 0.2,
  },
  /** An Imperial Title: which titles the realm chases (botTargetTitles, bots/spellcraft.ts), the skill each hero trains
   *  towards them (botTitleFocusSkill) and the specialists they want (botSpecialistRoles, bots/specialists.ts). What a
   *  title measures is its row's (`howTheHolderIsFound`); the skills the bots train towards it, and the role whose work
   *  earns its deeds, are the bots' reading of the row (bots/spellcraft.ts). */
  title: {
    theWorthOfATitleTheRealmHolds: 3,
    theShareOfItsHoldersMeritThatMakesATitleWorthChasing: 0.6,
    theMostTitlesARealmChases: 3,
    theWorthOfEachLevelOfAFightingSkillTowardsATitleWonByFighting: 1,
    theWorthOfEachLevelOfTheSkillsATitleMeasures: 2,
    theWorthOfATitleWonByBattlesOnLandBeforeAnyLevel: 5,
    theWorthOfATitleWonBySlayingGuardiansBeforeAnyLevel: 2,
    theTitlesARealmChasesWhenNoneIsWorthAPoint: 2,
    theSpecialistsMoreAChasedTitleWants: 1,
  },
  /** What an ability of a realm's alignment gives it: the heroes its court wants (botHeroCap, bots/strategy.ts), and
   *  the scholars it wants and the Sage level they work from (botSpecialistRoles and the scholar's orders,
   *  bots/specialists.ts). What each ability does is its row's, asked through the rules (the hire wage by the ladder,
   *  a Research's chance by the alignment); a host's fervour (botFervourMult, bots/intel.ts) and a recruit's
   *  (botRecruitableTypes) are the rules' factors themselves, weighed at a point of strength a point. */
  alignmentAbility: {
    theHeroesMoreARealmWhoseDearestWandererAsksTheLeastWants: 1,
    theScholarsMoreARealmWhoseAlignmentAddsToResearchWants: 1,
    theSageLevelFromWhichSuchARealmsScholarResearches: 1,
    theSageLevelFromWhichAnyOtherRealmsScholarResearches: 2,
  },
  /** What a gift of a realm's race gives it: its tuning's margins and wage cap (botTuning, bots/intel.ts). What each
   *  gift does is its row's, asked through the race gifts' runners (a company of the realm's race defending at a
   *  gift's factor, the spoils of a battle won attacking); a company's strength in the estimates (botRaceTerrainMult)
   *  is the rows' factors themselves, and the kin rule's, weighed at a point of strength a point. */
  raceGift: {
    theKingsAttackMarginARealmWhoseCompaniesDefendAtAGiftsFactorOnAnyGroundAdds: 0.1,
    theHerosAttackMarginARealmWhoseCompaniesDefendAtAGiftsFactorOnAnyGroundAdds: 0.1,
    theKingsAttackMarginARealmThatTakesTheSpoilsOfABattleWonAttackingTakesOff: 0.05,
    theHerosAttackMarginARealmThatTakesTheSpoilsOfABattleWonAttackingTakesOff: 0.05,
    theShareOfTheIncomeTheWagesMayTakeMoreInARealmThatTakesTheSpoilsOfABattleWonAttacking: 0.05,
  },
  /** What a temper gives a hero or a king: a hero's worth in a duel (botDuelRating, bots/spellcraft.ts) and the bar a
   *  realm's war must clear, by its king's temper (botWarAssess, bots/war.ts). What each temper does in a fight is its
   *  row's (TEMPER_TRAITS); these are the bots' reading of the four tempers a hero is given, one weight a temper each
   *  (answer 135: under one kind; weights by kind come after T7). A temper none names, or none, adds nothing. */
  temper: {
    theDuelWorthOfABerserkHero: 6,
    theDuelWorthOfABraveHero: 4,
    theDuelWorthOfACautiousHero: 5,
    theDuelWorthOfACowardlyHero: 0,
    whatABerserkKingAddsToTheBarForWar: -0.25,
    whatABraveKingAddsToTheBarForWar: -0.1,
    whatACautiousKingAddsToTheBarForWar: 0.15,
    whatACowardlyKingAddsToTheBarForWar: 0.3,
  },
  /** A point of a host's strength: how the bots estimate a host and a defence (botBattleForce, botGuessDefence,
   *  bots/intel.ts) and the margin of strength they want before they attack (botMarginFor). What a battle does is its
   *  rows' (Tactical's and Naval's rise, Tactical's most, the defender's edge, a Druid shortfall's step), which the
   *  bots read; these are the bots' own reading beside them, where it differs from the battle's (KD-477) or the battle
   *  has no rule (B-06bq). */
  battleStrength: {
    theHighestLevelOfTacticalTheBotsWeigh: 5,
    theHighestLevelOfNavalTheBotsWeigh: 5,
    theStrengthOfAUnitTheBotsCantSee: 6,
    theFactorTheBotsGuessARivalsProvinceHeldMoreHeavilyBy: 1.25,
    theLeastMarginAKingsAttackWants: 1.15,
    theLeastMarginAHerosAttackWants: 1.0,
    theShareTheMarginEasesEachTurnTheRealmGainsNoLand: 0.08,
    theLeastShareTheMarginEasesTo: 0.6,
    theUnitsOfAHostBeforeItsStakeAddsToTheMargin: 5,
    whatEachUnitMoreOfAHostAddsToTheMargin: 0.02,
    theMostAHostsStakeAddsToTheMargin: 0.1,
  },
  /** A war between two realms: the bar the realm's strength against a rival's must clear (botWarAssess, bots/war.ts:
   *  the table BOT_WAR reads these), what moves it, and when it sues for peace or accepts one; the grudge's survival
   *  exception (bots/bot-diplomacy-…ts). What a war does is the rules'; these are the bots' judgement of when to make
   *  one (Toby's tuning of 2026-09-29b). A king's temper's share of the bar is the kind `temper`'s. */
  war: {
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
  },
  /** A lair's guardian: the slayer's ladder (bots/missions.ts: the BOT_LAIR_* names read these; the two knobs of
   *  2026-09-29, bots/strategy.ts). What a lair holds and the odds bands its rumour tells are the rules'; these are the
   *  bots' judgement of when a hero asks, goes in and moves up a grade (Toby's tuning of September 2026). */
  lair: {
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
  },
  /** A realm's tuning, before its alignment's and its race's overlays (botTuning, bots/intel.ts: the tables BOT_TUNING
   *  and BOT_DIFFICULTY read these; a province's worth to hold, bots/strategy.ts). Every bot realm plays at what was the
   *  Hard setting (Toby, 2026-09-26). */
  tuning: {
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
  },
} satisfies TheWeightsOfABotVersion;
