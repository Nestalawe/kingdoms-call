// ── The weights of the bots' first version: what a unit of each kind of result is worth to it (B-06h, B-06r) ──
// One file a bot version. Its shape is the schema's (src/schemas/the-weights-of-a-bot-version-…ts: each kind's names,
// each with what it weighs), so a name misspelt, missing or more fails to compile. Each number is the one the bots'
// code wrote before T7, copied exactly; weights tuned by kind come after T7, the old bot played against the new.
import type { TheWeightsOfABotVersion } from '../../schemas/the-weights-of-a-bot-version-each-kind-of-result-and-the-names-of-its-weights.ts';

/** What the bots' first version makes of each kind of result, by the kind. */
export const THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION = {
  /** A gold: what the realm's ledger keeps in its chest, lets its wages take and holds back for its posts and its
   *  fleets each turn (botLedger, bots/strategy.ts; the fleets' caps: BOT_NAV_CAP_* and BOT_AIR_CAP_*, B-17s). The wages and the tax it weighs are the rules' (botUpkeep, botTaxIncome). */
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
    theShareOfTheWageCeilingTheAdmiralsFleetMayTake: 0.2,
    theShareOfTheWageCeilingTheSkyGeneralsHostMayTake: 0.15,
    theLeastWagesTheAdmiralsFleetMayTake: 4,
    theLeastWagesTheSkyGeneralsHostMayTake: 4,
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
   *  one (Toby's tuning of 2026-09-29b); and the alignment steps within which a realm courts another
   *  (BOT_ALLY_ALIGN_DIST, B-17s). A king's temper's share of the bar is the kind `temper`'s. */
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
    theStepsOfAlignmentWithinWhichARealmCourtsAnotherRatherThanFightsIt: 1,
  },
  /** A lair's guardian: the slayer's ladder (bots/missions.ts: the BOT_LAIR_* names read these; the two knobs of
   *  2026-09-29, bots/strategy.ts). What a lair holds and the odds bands its rumour tells are the rules'; these are the
   *  bots' judgement of when a hero asks, goes in and moves up a grade (Toby's tuning of September 2026), and the
   *  gold set aside for each slayer's rumours (BOT_RUMOUR_FUND_PER_SLAYER, B-17s). */
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
    theGoldSetAsideForEachSlayersRumours: 4,
  },
  /** A realm's tuning, before its alignment's and its race's overlays (botTuning, bots/intel.ts: the tables BOT_TUNING
   *  and BOT_DIFFICULTY read these; a province's worth to hold, bots/strategy.ts; a march's chained fights,
   *  BOT_MAX_FIGHTS, bots/specialists.ts, B-17s). Every bot realm plays at what was the Hard setting (Toby,
   *  2026-09-26). */
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
    theFightsAHostChainsInATurnBeforeItTakesOnlyUnguardedGround: 3,
  },
  /** A duel: when a bot's general refuses, accepts or challenges (botDuelStance, bots/missions.ts: the tables BOT_DUEL
   *  and BOT_DUEL_WITHOUT_A_FORECAST read these). What a duel does is the rules' (the engine's own personal combat,
   *  forecast on copies); these are the bots' judgement of the odds worth riding out for (Toby, September 2026). */
  duel: {
    theChanceToWinFromWhichAHeroAcceptsADuel: 0.5,
    theChanceToWinFromWhichAKingAcceptsADuel: 0.6,
    theMostChanceOfFallingAKingRisksInADuel: 0.1,
    theChanceToWinFromWhichADuellistChallenges: 0.65,
    theChanceOfFallingCountedWithNoForecastByOneRatedClearlyStronger: 0.05,
    theChanceOfFallingCountedWithNoForecastByAnyOther: 0.3,
  },
  /** The Spring pass (bots/phase-one.ts: the table BOT_P1, bots/strategy.ts, and BOT_PIN_EDGE read these): when a host
   *  in contact holds, falls back or flees, the emergency levy, the war chest (botLedger) and when an enemy host is
   *  beatable where it stands rather than pinned. What a season's orders do is the rules'. */
  springPass: {
    theStrengthAgainstTheFoeBelowWhichAHostInContactFallsBack: 0.75,
    theStrengthAgainstTheFoeBelowWhichAHostWhoseFoeNoFloodPinsFlees: 0.5,
    theFactorTheEmergencyLevyRaisesTheWageCeilingBy: 1.2,
    theLeastWagesTheEmergencyLevyRaisesTheCeilingAboveWhatTheRealmPays: 8,
    theGoldTheWarChestHoldsForEachHostInContact: 10,
    theMostShareOfTheFreeTreasuryTheWarChestHolds: 0.5,
    theTimesAnEnemyHostsStrengthAtWhichItIsBeatableWhereItStands: 1.2,
  },
  /** A rival's hero: the skills the bots' estimates assume of him by default (botSkillsFor, bots/intel.ts: the table
   *  BOT_ASSUMED_SKILLS reads these; Toby, September 2026). */
  rivalsSkills: {
    theMeleeTheBotsAssumeOfARivalsHeroByDefault: 3,
    theArcheryTheBotsAssumeOfARivalsHeroByDefault: 2,
    theTacticalTheBotsAssumeOfARivalsHeroByDefault: 2,
    theElementalTheBotsAssumeOfARivalsHeroByDefault: 2,
  },
  /** The specialists a realm's court wants, by role: how many of each (botSpecialistRoles, bots/specialists.ts) and how many heroes it keeps free of them. */
  specialistsWanted: {
    theLairsFromWhichTheCourtWantsASecondSlayer: 6,
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
  },
  /** A hero's aptitude for each specialist role: what each of his skills adds to or takes off his claim to a role (botSpecialistRoles, botMageAptitude, bots/specialists.ts). */
  specialistsAptitude: {
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
  },
  /** The work of a specialist's season: whom a hero trains with, where a scholar, scout, roaming hero and spy go, and what draws each there (bots/specialists.ts: botTrainOrders, botScholarOrders, botScoutTarget, botRoamOrders, botSpyOrders). */
  specialistsWork: {
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
    theTurnsAGeneralMayBeShadowedAfterHisLastPlacing: 2,
    theProvincesAwayASpyShadowsAGeneral: 3,
    theWorthOfEachUnitAGeneralToShadowLeads: 2,
    theWorthOfAKingToShadow: 6,
    theWorthOfAGeneralAtWarToShadow: 5,
    whatEachStepAwayTakesOffAShadowedGeneral: 2,
    theProvincesAwayASpyLooksForANewTarget: 4,
    theSpyAttemptsBeforeASpyLiesInWait: 2,
  },
  /** What draws a thief to a mark, a vault or a hoard, and how far he looks for each (botStealTarget, botThiefOrders, bots/specialists.ts). */
  specialistsTheft: {
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
  },
  /** The skill levels from which each role has work of its own, and the work of a scout, a spy and a thief that goes beyond a target (botRoleWork, botRoleReady, botRoleTrain, bots/specialists.ts). */
  specialistsRoleWork: {
    theMeleeFromWhichASlayerWithNoLairsToGrowIntoScouts: 3,
    theExplorerLevelFromWhichAScoutChartsGroundBesideHim: 7,
    theSpySkillFromWhichASpyHasWork: 2,
    theSpySkillFromWhichASpyAssassinates: 9,
    theSpySkillFromWhichASpyAtWarSabotages: 7,
    theWorthOfARivalCapitalToSabotage: 3,
    theThiefSkillFromWhichAThiefHasWork: 2,
    theLevelOfAMagesFirstSchoolBeforeTheTwoRiseTogether: 2,
    theLevelOfMeleeOrArcheryFromWhichASlayerIsReady: 3,
  },
  /** Where a mage walks to cast and what draws him there (botMageOrders, bots/specialists.ts). */
  /** Which lair an unarmed fighter goes to, and how far (botLairTarget, botLairOrders, bots/specialists.ts: called only by the plan's tests today). */
  specialistsUnarmedFighters: {
    theWorthOfEachRankOfAGuardianToALairTarget: 2,
    whatEachStepAwayTakesOffALairTarget: 2,
    theProvincesAwayAnUnarmedFighterLooksForALair: 4,
  },
  specialistsMageWork: {
    theProvincesAwayAMageLooksForAWandererToCharm: 3,
    theTurnsAGeneralMayBeHexedAfterHisLastPlacing: 2,
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
  },
  /** Where a defender takes his post, how far he walks to it and what he does there (botDefenderPost, botDefenderOrders, botHomeThreat, bots/specialists.ts). */
  specialistsDefenders: {
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
  },
  /** What a host weighs in a target's score and as it chains fights or strikes from afar (botScanTargets, botChainHops, botDistantStrike, bots/specialists.ts). */
  specialistsHostsMarch: {
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
  },
} satisfies TheWeightsOfABotVersion;
