// ── The weights of a bot version: each kind of result, and the names of its weights (B-17q) ────
// What a bot version's weights file holds (bots/the-weights-of-the-bots-first-version-…ts), as a Zod schema: each kind
// of result a rule's what-if hands a bot is an object of its weights' names, each a number, each name written once
// here with what it weighs. The types come from it (z.infer): the kinds (`AKindOfResultABotWeighs`, bots/intel.ts) and
// each kind's names, so a weights file with a name misspelt, missing or more fails to compile. The weights file is code,
// not a save, so nothing parses it at load: its test parses it with the schema's strict version (a number of the wrong
// type, a missing name or one more each fail), as the save's tests do. src/ imports this file as types only (the rule
// in .dependency-cruiser.mts), so no page's bundle holds it.
import { z } from 'zod';

/** A gold: what the realm's ledger keeps in its chest, lets its wages take and holds back for its posts each turn. */
const TheWeightsOfAGoldSchema = z.object({
  /** An enemy host of more units than this puts the realm on a war footing, as a war does. */
  theMostUnitsOfAnEnemyHostThatLeaveTheRealmAtPeace: z.number(),
  /** On a war footing, the share of the income the wages may take (in peace, the bots' tuning's). */
  theShareOfTheIncomeTheWagesMayTakeOnAWarFooting: z.number(),
  /** On a war footing, the chest keeps this share of the wages, rounded down, between the least and the most below
   *  (in peace, the bots' tuning's reserve). */
  theShareOfTheWagesTheChestKeepsOnAWarFooting: z.number(),
  /** On a war footing, the least gold the chest keeps. */
  theLeastGoldTheChestKeepsOnAWarFooting: z.number(),
  /** On a war footing, the most gold the chest keeps. */
  theMostGoldTheChestKeepsOnAWarFooting: z.number(),
  /** A realm of fewer provinces than this is small: its wages may lean on a larger share of its free treasury. */
  theProvincesBelowWhichARealmIsSmall: z.number(),
  /** The share of the free treasury a small realm's wages may lean on (a larger realm's: the bots' tuning's). */
  theShareOfTheFreeTreasuryASmallRealmsWagesMayLeanOn: z.number(),
  /** A realm's defenders stand under strength while they lead fewer than this many units each. */
  theUnitsEachDefenderLeadsAtFullStrength: z.number(),
  /** While its defenders stand under strength, the share of the land's wage ceiling held back for their muster,
   *  rounded down. */
  theShareOfTheWageCeilingHeldBackForTheDefenders: z.number(),
  /** The share of the land's wage ceiling the admiral's fleet may take, at least ... */
  theShareOfTheWageCeilingTheAdmiralsFleetMayTake: z.number(),
  /** ... and the sky general's host's, at least ... */
  theShareOfTheWageCeilingTheSkyGeneralsHostMayTake: z.number(),
  /** ... these wages for the fleet ... */
  theLeastWagesTheAdmiralsFleetMayTake: z.number(),
  /** ... and these for the sky general's host. */
  theLeastWagesTheSkyGeneralsHostMayTake: z.number(),
});

/** An Imperial Title: which titles the realm chases, the skill each hero trains towards them and the specialists they
 *  want. */
const TheWeightsOfATitleSchema = z.object({
  /** From the standings: a title the realm holds is worth this to chase (to keep). */
  theWorthOfATitleTheRealmHolds: z.number(),
  /** From the standings: a rival's title is worth chasing once the realm's best hero has this share of its holder's
   *  merit, and is then worth that share. */
  theShareOfItsHoldersMeritThatMakesATitleWorthChasing: z.number(),
  /** The most titles a realm chases at once, the worthiest first (a tie to the first found). */
  theMostTitlesARealmChases: z.number(),
  /** With none worth chasing in the standings, each title the bots train towards is worth its court's levels in the
   *  skills they train towards it: each level of a fighting skill towards a title won by fighting, ... */
  theWorthOfEachLevelOfAFightingSkillTowardsATitleWonByFighting: z.number(),
  /** ... and each level of the skill (or the schools) a title measures, towards any other. */
  theWorthOfEachLevelOfTheSkillsATitleMeasures: z.number(),
  /** What a title won by battles on land is worth before any level. */
  theWorthOfATitleWonByBattlesOnLandBeforeAnyLevel: z.number(),
  /** What a title won by slaying lairs' guardians is worth before any level. */
  theWorthOfATitleWonBySlayingGuardiansBeforeAnyLevel: z.number(),
  /** With none worth a point either, the realm chases this many, the first in the bots' order. */
  theTitlesARealmChasesWhenNoneIsWorthAPoint: z.number(),
  /** A chased title wants this many specialists more, of the role whose work earns its deeds. */
  theSpecialistsMoreAChasedTitleWants: z.number(),
});

/** What an ability of a realm's alignment gives it: the heroes its court wants, the scholars it wants and the Sage
 *  level they work from. */
const TheWeightsOfAnAlignmentAbilitySchema = z.object({
  /** A realm whose dearest wandering hero asks the least wage any realm's dearest asks (the ladder's middle) wants
   *  this many heroes more at court. */
  theHeroesMoreARealmWhoseDearestWandererAsksTheLeastWants: z.number(),
  /** A realm whose alignment adds to a Research's chance with each Sage level wants this many scholars more. */
  theScholarsMoreARealmWhoseAlignmentAddsToResearchWants: z.number(),
  /** Such a realm's scholar researches from this Sage level, and trains Sage below it, ... */
  theSageLevelFromWhichSuchARealmsScholarResearches: z.number(),
  /** ... and any other realm's from this one. */
  theSageLevelFromWhichAnyOtherRealmsScholarResearches: z.number(),
});

/** What a gift of a realm's race gives it: its tuning's attack margins and the share of its income its wages take. */
const TheWeightsOfARaceGiftSchema = z.object({
  /** A realm whose companies of its race defend at a gift's factor on any ground (it wins by being attacked) adds
   *  this to its king's attack margin, ... */
  theKingsAttackMarginARealmWhoseCompaniesDefendAtAGiftsFactorOnAnyGroundAdds: z.number(),
  /** ... and this to its heroes'. */
  theHerosAttackMarginARealmWhoseCompaniesDefendAtAGiftsFactorOnAnyGroundAdds: z.number(),
  /** A realm that takes the spoils of a battle won attacking (its winners' wages halved) takes this off its king's
   *  attack margin, ... */
  theKingsAttackMarginARealmThatTakesTheSpoilsOfABattleWonAttackingTakesOff: z.number(),
  /** ... this off its heroes', ... */
  theHerosAttackMarginARealmThatTakesTheSpoilsOfABattleWonAttackingTakesOff: z.number(),
  /** ... and lets its wages take this share of the income more (never more than the whole). */
  theShareOfTheIncomeTheWagesMayTakeMoreInARealmThatTakesTheSpoilsOfABattleWonAttacking: z.number(),
});

/** What a temper gives a hero or a king: a hero's worth in a duel, and the bar a war of his realm's must clear. */
const TheWeightsOfATemperSchema = z.object({
  /** A Berserk hero's worth in a duel, added to his hit points, skills and items. */
  theDuelWorthOfABerserkHero: z.number(),
  /** A Brave hero's. */
  theDuelWorthOfABraveHero: z.number(),
  /** A Cautious hero's. */
  theDuelWorthOfACautiousHero: z.number(),
  /** A Cowardly hero's. */
  theDuelWorthOfACowardlyHero: z.number(),
  /** What a Berserk king adds to the bar a war of his realm's must clear (less: war comes sooner). */
  whatABerserkKingAddsToTheBarForWar: z.number(),
  /** A Brave king's. */
  whatABraveKingAddsToTheBarForWar: z.number(),
  /** A Cautious king's. */
  whatACautiousKingAddsToTheBarForWar: z.number(),
  /** A Cowardly king's. */
  whatACowardlyKingAddsToTheBarForWar: z.number(),
});

/** A point of a host's strength: how the bots estimate a host and a defence, and the margin they want before they
 *  attack. */
const TheWeightsOfAPointOfAHostsStrengthSchema = z.object({
  /** The highest level of a commander's Tactical the bots weigh: his skills alone, no title's level (the battle
   *  counts every level, to its most). */
  theHighestLevelOfTacticalTheBotsWeigh: z.number(),
  /** The highest level of a commander's Naval the bots weigh (the battle's Naval has no cap). */
  theHighestLevelOfNavalTheBotsWeigh: z.number(),
  /** The strength the bots give a defending unit they can't see: about an average line unit's base strength. */
  theStrengthOfAUnitTheBotsCantSee: z.number(),
  /** A rival's province is guessed this many times more heavily held than neutral ground of the same tax. */
  theFactorTheBotsGuessARivalsProvinceHeldMoreHeavilyBy: z.number(),
  /** The least margin a king's attack wants, however long his realm gains no land, ... */
  theLeastMarginAKingsAttackWants: z.number(),
  /** ... and a hero's. */
  theLeastMarginAHerosAttackWants: z.number(),
  /** Each turn its realm gains no land, the margin eases by this share, ... */
  theShareTheMarginEasesEachTurnTheRealmGainsNoLand: z.number(),
  /** ... to at least this share of it. */
  theLeastShareTheMarginEasesTo: z.number(),
  /** A host of more units than this stakes more on its attack: ... */
  theUnitsOfAHostBeforeItsStakeAddsToTheMargin: z.number(),
  /** ... each unit more adds this to the margin, ... */
  whatEachUnitMoreOfAHostAddsToTheMargin: z.number(),
  /** ... and at most this. */
  theMostAHostsStakeAddsToTheMargin: z.number(),
});

/** A war between two realms: the bar the realm's strength against a rival's must clear before it declares war, what
 *  moves the bar, and when it sues for peace or accepts one (botWarAssess, bots/war.ts; the grudge's survival exception,
 *  bots/bot-diplomacy-…ts). */
const TheWeightsOfAWarSchema = z.object({
  /** The bar: the realm declares war once its strength is this many times the rival's, before what moves it. */
  theBarTheRealmsStrengthAgainstARivalsMustClearForWar: z.number(),
  /** However far the bar falls, it stays at least this. */
  theLowestTheBarForWarFalls: z.number(),
  /** Each step of alignment between the two realms beyond the second takes this off the bar. */
  whatEachStepOfAlignmentBeyondTheSecondTakesOffTheBar: z.number(),
  /** A realm whose alignment declares war without warning takes this off the bar. */
  whatARealmWhoseAlignmentDeclaresWarWithoutWarningTakesOffTheBar: z.number(),
  /** While free neutral land still borders the realm, this goes on the bar: the easy land first. */
  whatARealmStillExpandingIntoFreeLandAddsToTheBar: z.number(),
  /** After this many turns gaining no land, the realm no longer expands first. */
  theTurnsGainingNoLandAfterWhichARealmNoLongerExpandsFirst: z.number(),
  /** Each opportunity against the rival (bots/war.ts names them) takes this off the bar, ... */
  whatEachOpportunityTakesOffTheBar: z.number(),
  /** ... and all of them together at most this. */
  theMostTheOpportunitiesTakeOffTheBar: z.number(),
  /** At war past its first turns, the realm sues for peace while its strength is below this share of the rival's, ... */
  theShareOfTheRivalsStrengthBelowWhichARealmAtWarSuesForPeace: z.number(),
  /** ... or once it has lost this many battles against the rival lately, and more than it has won. */
  theBattlesLostLatelyAtWhichARealmAtWarSuesForPeace: z.number(),
  /** A new war is kept this many turns before peace is weighed. */
  theTurnsAWarIsKeptBeforePeaceIsWeighed: z.number(),
  /** A new peace is kept this many turns before war is weighed again. */
  theTurnsAPeaceIsKeptBeforeWarIsWeighedAgain: z.number(),
  /** Each side counts this share of each of its allies' strength. */
  theShareOfAnAllysStrengthCountedOnItsSide: z.number(),
  /** The realm counts its own strength less this share of each other foe it is at war with. */
  theShareOfEachOtherFoesStrengthTakenOffTheRealmsOwn: z.number(),
  /** A rival's host counts in the rival's strength for this many turns. */
  theTurnsARivalsHostCountsInItsStrength: z.number(),
  /** The news of a battle between two realms is kept this many turns. */
  theTurnsTheNewsOfABattleIsKept: z.number(),
  /** A rival's hosts count at least this much strength for each of its land provinces. */
  theStrengthARivalsHostsCountAtLeastForEachOfItsLandProvinces: z.number(),
  /** A rival's host this many provinces or more from its capital is far from home (an opportunity). */
  theProvincesFromItsCapitalAtWhichARivalsHostIsFarFromHome: z.number(),
  /** A grudge against a human yields (the realm treats for peace) once the human is this many times its strength, ... */
  theTimesTheRealmsStrengthAtWhichAGrudgeYields: z.number(),
  /** ... and comes back once the human is no more than this many times it. */
  theTimesTheRealmsStrengthAtWhichAGrudgeComesBack: z.number(),
  /** A prize may lie this many provinces from the realm: 2 is on its border or one province beyond it. */
  theProvincesFromTheRealmAPrizeMayLie: z.number(),
  /** No new war while the realm's strength is below this share of any foe's it is at war with. */
  theShareOfAFoesStrengthBelowWhichTheRealmStartsNoNewWar: z.number(),
  /** With no prize in reach, war only once the realm's strength clears the bar this many times over. */
  theTimesTheBarAWarWithNoPrizeInReachMustClear: z.number(),
  /** The realm accepts a rival's peace while its strength is below this share of the rival's (and below the bar), ... */
  theShareOfTheRivalsStrengthBelowWhichARealmAcceptsItsPeace: z.number(),
  /** ... or, with no prize in reach, below this share. */
  theShareOfTheRivalsStrengthBelowWhichARealmWithNoPrizeInReachAcceptsItsPeace: z.number(),
  /** A realm courts another whose alignment is this many steps away or fewer, and fights one further (the bots'
   *  diplomacy); and, at the set-up, which alignments the bots' realms are given, friendly or hostile to the
   *  players. */
  theStepsOfAlignmentWithinWhichARealmCourtsAnotherRatherThanFightsIt: z.number(),
});

/** A lair's guardian: when a hero buys a rumour of a lair, when he goes in, how far he goes and when he moves up a
 *  grade (the slayer's ladder: botLairTiers, botSlayerOrders and their kin, bots/missions.ts; botRumourFor,
 *  bots/strategy.ts). The odds bands are the rumour's, which the bots read; these are the bots' reading of them. */
const TheWeightsOfALairSchema = z.object({
  /** A Weak lair whose rumour tells odds from this band (but below the band that sends him in) is a risk he takes ... */
  theRumourBandFromWhichAHeroRisksAWeakLair: z.number(),
  /** ... only with at least this share of his hit points. */
  theShareOfHisHitPointsAHeroRisksAWeakLairWith: z.number(),
  /** A hero looks for lairs this many provinces away at most. */
  theProvincesAwayAHeroLooksForALair: z.number(),
  /** A hero buys at most this many rumours a year. */
  theMostRumoursAHeroBuysAYear: z.number(),
  /** A rumour telling odds from this band sends a hero into a Weak lair, ... */
  theRumourBandThatSendsAHeroIntoAWeakLair: z.number(),
  /** ... and one from this band into a Moderate lair or stronger. */
  theRumourBandThatSendsAHeroIntoAStrongerLair: z.number(),
  /** Once a hero has cleared this many lairs of a grade, the grade is his: he searches its lairs with no rumour. */
  theLairsOfAGradeClearedThatMakeItAHerosOwn: z.number(),
  /** Once he has cleared this many of his own grade, he asks a rumour of the grade above. */
  theLairsOfHisOwnGradeClearedBeforeAHeroAsksOfTheGradeAbove: z.number(),
  /** After a poor reading of the grade above, he clears this many more of his own before he asks again. */
  theLairsMoreOfHisOwnGradeAHeroClearsAfterAPoorReading: z.number(),
  /** A hero rests before a hunt while he has less than this share of his hit points. */
  theShareOfHisHitPointsBelowWhichAHeroRestsBeforeAHunt: z.number(),
  /** Each search after his first in a year becomes a Rest if the fight before left him under this share of his hit
   *  points. */
  theShareOfHisHitPointsBelowWhichAHerosNextSearchBecomesARest: z.number(),
  /** A hero searches at most this many lairs a year. */
  theMostLairsAHeroSearchesAYear: z.number(),
  /** A hero who owns his grade asks of the grade above, without the kills, once he carries this many items: towards
   *  Moderate, ... */
  theItemsAHeroCarriesToAskOfModerateLairsEarly: z.number(),
  /** ... towards Powerful, ... */
  theItemsAHeroCarriesToAskOfPowerfulLairsEarly: z.number(),
  /** ... towards Legendary; ... */
  theItemsAHeroCarriesToAskOfLegendaryLairsEarly: z.number(),
  /** ... or once his best fighting skill is at this level: towards Moderate, ... */
  theFightingSkillAHeroHasToAskOfModerateLairsEarly: z.number(),
  /** ... towards Powerful, ... */
  theFightingSkillAHeroHasToAskOfPowerfulLairsEarly: z.number(),
  /** ... towards Legendary. */
  theFightingSkillAHeroHasToAskOfLegendaryLairsEarly: z.number(),
  /** A hero asks a lair's rumour again once his rating has risen this much since he was told (0: he waits out his
   *  rumour's turns). */
  theRiseInHisRatingAfterWhichAHeroAsksALairsRumourAgain: z.number(),
  /** The gold set aside for each slayer's rumours before any muster can spend it. */
  theGoldSetAsideForEachSlayersRumours: z.number(),
});

/** A realm's tuning: the margins of strength its attacks want, the pull of a province's tax, the gold it keeps and the
 *  share of its income its wages take, before its alignment's and its race's overlays (botTuning, bots/intel.ts: the
 *  tables BOT_TUNING and BOT_DIFFICULTY read these). Every bot realm plays at one strength (the old Hard). */
const TheWeightsOfARealmsTuningSchema = z.object({
  /** The strength a king's attack wants, as times the defence's (before the strength's factor below), ... */
  theStrengthRatioAKingsAttackWants: z.number(),
  /** ... a hero's, ... */
  theStrengthRatioAHerosAttackWants: z.number(),
  /** ... and a concentrated assault's, combined (it buffers the columns' chance to unite). */
  theStrengthRatioAConcentratedAssaultWants: z.number(),
  /** A province of this tax or more is valuable to hold and reinforce (the home capital always is). */
  theTaxFromWhichAProvinceIsValuableToHold: z.number(),
  /** Each gold of a target province's tax adds this to its score as a target. */
  whatEachGoldOfATargetProvincesTaxAddsToItsScore: z.number(),
  /** The gold the realm keeps in hand before any recruiting. */
  theGoldKeptInHandBeforeAnyRecruiting: z.number(),
  /** The share of the free treasury the wages may lean on (a small realm's: the kind `gold`'s). */
  theShareOfTheFreeTreasuryTheWagesMayLeanOn: z.number(),
  /** Every bot realm's strength: its king's and its heroes' attack margins are taken by this factor, ... */
  theFactorTheBotsStrengthTakesTheAttackMarginsBy: z.number(),
  /** ... its assault margin by this one, ... */
  theFactorTheBotsStrengthTakesTheAssaultMarginBy: z.number(),
  /** ... a rival's province carries this bias over neutral land in its score as a target (each score reads it at its
   *  own weight, and the alignment's overlay may raise it), ... */
  theBiasTowardsARivalsProvinceOverNeutralLandInATargetsScore: z.number(),
  /** ... and its wages may take this share of its income in peace (a war footing's: the kind `gold`'s). */
  theShareOfTheIncomeTheWagesMayTakeInPeace: z.number(),
  /** After this many fights in a turn, a host's chained march takes only unguarded ground. */
  theFightsAHostChainsInATurnBeforeItTakesOnlyUnguardedGround: z.number(),
});

/** A duel: the odds a bot's general wants before he accepts or challenges, on the duel's forecast (botDuelStance,
 *  bots/missions.ts: the tables BOT_DUEL and BOT_DUEL_WITHOUT_A_FORECAST read these). */
const TheWeightsOfADuelSchema = z.object({
  /** A hero accepts a duel from this chance to win against each enemy general in reach, ... */
  theChanceToWinFromWhichAHeroAcceptsADuel: z.number(),
  /** ... a king from this one, ... */
  theChanceToWinFromWhichAKingAcceptsADuel: z.number(),
  /** ... and only while his chance of falling is this or less (a challenge's too). */
  theMostChanceOfFallingAKingRisksInADuel: z.number(),
  /** A real duellist challenges from this chance to win against each enemy general in reach. */
  theChanceToWinFromWhichADuellistChallenges: z.number(),
  /** With no forecast handed in, a commander rated clearly stronger than his foe counts this chance of falling, ... */
  theChanceOfFallingCountedWithNoForecastByOneRatedClearlyStronger: z.number(),
  /** ... and any other this one. */
  theChanceOfFallingCountedWithNoForecastByAnyOther: z.number(),
});

/** The Spring pass: a host in contact holding, falling back or fleeing, the emergency levy, the war chest and the
 *  pins (bots/phase-one.ts: the table BOT_P1, bots/strategy.ts, and BOT_PIN_EDGE read these). */
const TheWeightsOfTheSpringPassSchema = z.object({
  /** A host in contact whose strength is below this share of its foe's falls back (the capital and Rich land
   *  hold), ... */
  theStrengthAgainstTheFoeBelowWhichAHostInContactFallsBack: z.number(),
  /** ... and, when no flood pins its foe, flees below this share. */
  theStrengthAgainstTheFoeBelowWhichAHostWhoseFoeNoFloodPinsFlees: z.number(),
  /** The emergency levy raises the wage ceiling by this factor, ... */
  theFactorTheEmergencyLevyRaisesTheWageCeilingBy: z.number(),
  /** ... and to at least this many wages above what the realm pays now. */
  theLeastWagesTheEmergencyLevyRaisesTheCeilingAboveWhatTheRealmPays: z.number(),
  /** The war chest holds this gold for each host in contact, ... */
  theGoldTheWarChestHoldsForEachHostInContact: z.number(),
  /** ... up to this share of the free treasury. */
  theMostShareOfTheFreeTreasuryTheWarChestHolds: z.number(),
  /** An enemy host the realm could meet at this many times its strength is beatable where it stands: no caster pins
   *  it. */
  theTimesAnEnemyHostsStrengthAtWhichItIsBeatableWhereItStands: z.number(),
});

/** A rival's hero: the skills the bots' estimates assume of him by default (botSkillsFor, bots/intel.ts: the table
 *  BOT_ASSUMED_SKILLS reads these). */
const TheWeightsOfARivalsSkillsSchema = z.object({
  /** The Melee assumed, ... */
  theMeleeTheBotsAssumeOfARivalsHeroByDefault: z.number(),
  /** ... the Archery, ... */
  theArcheryTheBotsAssumeOfARivalsHeroByDefault: z.number(),
  /** ... the Tactical ... */
  theTacticalTheBotsAssumeOfARivalsHeroByDefault: z.number(),
  /** ... and a school's (Elemental). */
  theElementalTheBotsAssumeOfARivalsHeroByDefault: z.number(),
});

/** The specialists a realm's court wants, by role: how many of each (botSpecialistRoles, bots/specialists.ts) and how many heroes it keeps free of them. */
const TheWeightsOfTheSpecialistsACourtWantsSchema = z.object({
  /** The court wants a second slayer once this many uncleared lairs count in its reckoning. */
  theLairsFromWhichTheCourtWantsASecondSlayer: z.number(),
  /** The most scouts the court wants at once, while ground is unmapped. */
  theMostScoutsTheCourtWants: z.number(),
  /** The court wants one scout more for each this many unmapped provinces it holds, after the first. */
  theUnmappedProvincesAScoutIsWantedFor: z.number(),
  /** A realm of this many provinces or more wants more scholars. */
  theProvincesFromWhichTheCourtWantsASecondScholar: z.number(),
  /** The scholars the court wants at that size (one below it), before an alignment's or a title's extra. */
  theScholarsALargerCourtWants: z.number(),
  /** From this turn the court wants a spy, though no other realm is met. */
  theTurnFromWhichTheCourtWantsASpyWithNoRealmMet: z.number(),
  /** The spies the court wants while its realm is at war (one otherwise). */
  theSpiesTheCourtWantsAtWar: z.number(),
  /** From this turn the court wants a thief, though no other realm is met. */
  theTurnFromWhichTheCourtWantsAThiefWithNoRealmMet: z.number(),
  /** From this turn the court wants a mage, though no hero has a level in a school of magic. */
  theTurnFromWhichTheCourtWantsAMageWithNoHeroKnowingASchool: z.number(),
  /** A realm of this many provinces or more wants a second mage. */
  theProvincesFromWhichTheCourtWantsASecondMage: z.number(),
  /** The reserve of one hero to muster troops never leaves fewer than this many heroes for the roles (the slayer and the scholar). */
  theHeroesTheFeederReserveNeverSqueezesOut: z.number(),
  /** A realm of this many provinces or more keeps one hero back to muster and carry troops. */
  theProvincesFromWhichOneHeroIsKeptToMusterTroops: z.number(),
});

/** A hero's aptitude for each specialist role: what each of his skills adds to or takes off his claim to a role (botSpecialistRoles, botMageAptitude, bots/specialists.ts). */
const TheWeightsOfTheAptitudesOfASpecialistSchema = z.object({
  /** Each level of the mage's best school adds this to his aptitude. */
  theWorthOfEachLevelOfAMagesBestSchool: z.number(),
  /** Each level of his second school adds this. */
  theWorthOfEachLevelOfAMagesSecondSchool: z.number(),
  /** A hero who already holds a role adds this to his claim to it (a mage, a slayer or any other role). */
  theWorthOfHoldingARoleAlready: z.number(),
  /** For a mage and for a scholar, scout, spy or thief, each level of Melee, Archery and Tactical takes this off. */
  whatEachLevelOfAFightingSkillTakesOffAThinkingRolesCandidate: z.number(),
  /** Each level of Melee adds this to a slayer's aptitude. */
  theWorthOfEachLevelOfMeleeForASlayer: z.number(),
  /** Each level of Archery adds this to a slayer's aptitude. */
  theWorthOfEachLevelOfArcheryForASlayer: z.number(),
  /** Each hit point adds this to a slayer's aptitude. */
  theWorthOfEachHitPointForASlayer: z.number(),
  /** Each level of Elemental, Necromancy, Psychic and White adds this to a slayer's aptitude. */
  theWorthOfEachLevelOfADuellingSchoolForASlayer: z.number(),
  /** For a scholar, scout, spy or thief, each level of the role's own skill adds this. */
  theWorthOfEachLevelOfTheRolesOwnSkillForAnyOtherRole: z.number(),
  /** For a scholar, scout, spy or thief, each point of his magic score takes this off. */
  whatEachPointOfMagicTakesOffAnyOtherRolesCandidate: z.number(),
});

/** The work of a specialist's season: whom a hero trains with, where a scholar, scout, roaming hero and spy go, and what draws each there (bots/specialists.ts: botSpecialistRoles, botTrainOrders, botScholarOrders, botScoutTarget, botRoamOrders, botCloakPre, botSpyOrders). */
const TheWeightsOfTheWorkOfASpecialistSchema = z.object({
  /** A thief of this skill level or more sets his encounter plan to steal and flee. */
  theThiefSkillFromWhichAThiefFightsByStealingAndFleeing: z.number(),
  /** A mentor to train with is looked for this many steps away at most. */
  theProvincesAwayAMentorMayStand: z.number(),
  /** Each level of a mentor's skill adds this to his worth as the one to train with, each step away taking one off. */
  theWorthOfEachLevelOfAMentorsSkill: z.number(),
  /** A scholar who has not reached his research level joins the king if he is this many steps away at most. */
  theProvincesAwayTheKingMayBeForAScholarToJoinHim: z.number(),
  /** A scholar of this Sage level or more researches all season. */
  theSageLevelFromWhichAScholarOnlyResearches: z.number(),
  /** Below that level a scholar researches this many orders of the season and practises the rest. */
  theResearchesAScholarBelowThatLevelDoesEachSeason: z.number(),
  /** A province of a wild race adds this to a scout's target. */
  theWorthOfWildGroundToAScout: z.number(),
  /** Each this many points a province is short of fully mapped add one to a scout's target. */
  theUnmappedPointsThatMakeAPointOfAScoutsTargetScore: z.number(),
  /** A province of the realm's own adds this to a scout's target. */
  theWorthOfOwnGroundToAScout: z.number(),
  /** Each step away takes this off a scout's target. */
  whatEachStepAwayTakesOffAScoutsTarget: z.number(),
  /** A scout looks for a target this many steps away at most. */
  theProvincesAwayAScoutGoes: z.number(),
  /** A roaming hero looks for unvisited ground this many steps away at most. */
  theProvincesAwayARoamingHeroLooksForNewGround: z.number(),
  /** Each step away takes this off a roaming hero's target. */
  whatEachStepAwayTakesOffARoamsTarget: z.number(),
  /** Each unit a rival hero leads adds this to his worth as the one to spy on. */
  theWorthOfEachUnitAMarkLeadsToSpyOn: z.number(),
  /** A rival king adds this to his worth as the one to spy on. */
  theWorthOfAKingAsAMarkToSpyOn: z.number(),
  /** A rival general within this many turns of his last placing may be shadowed. */
  theTurnsAGeneralMayBeShadowedAfterHisLastPlacing: z.number(),
  /** A spy follows a general this many steps away at most. */
  theProvincesAwayASpyShadowsAGeneral: z.number(),
  /** Each unit a general to shadow leads adds this to his worth as the one to shadow. */
  theWorthOfEachUnitAGeneralToShadowLeads: z.number(),
  /** A king adds this to his worth as the one to shadow. */
  theWorthOfAKingToShadow: z.number(),
  /** A general of a realm at war with the spy's adds this to his worth as the one to shadow. */
  theWorthOfAGeneralAtWarToShadow: z.number(),
  /** Each step away takes this off a general's worth as the one to shadow. */
  whatEachStepAwayTakesOffAShadowedGeneral: z.number(),
  /** A spy looks for a province to spy on this many steps away at most. */
  theProvincesAwayASpyLooksForANewTarget: z.number(),
  /** A spy at his target spies this many orders, then lies in wait for the rest of the season. */
  theSpyAttemptsBeforeASpyLiesInWait: z.number(),
});

/** A bot version's weights: what a unit of each kind of result is worth to it, keyed by the kind, never by the
 *  effect. */
export const TheWeightsOfABotVersionSchema = z.object({
  gold: TheWeightsOfAGoldSchema,
  title: TheWeightsOfATitleSchema,
  alignmentAbility: TheWeightsOfAnAlignmentAbilitySchema,
  raceGift: TheWeightsOfARaceGiftSchema,
  temper: TheWeightsOfATemperSchema,
  battleStrength: TheWeightsOfAPointOfAHostsStrengthSchema,
  war: TheWeightsOfAWarSchema,
  lair: TheWeightsOfALairSchema,
  tuning: TheWeightsOfARealmsTuningSchema,
  duel: TheWeightsOfADuelSchema,
  springPass: TheWeightsOfTheSpringPassSchema,
  rivalsSkills: TheWeightsOfARivalsSkillsSchema,
  specialistsWanted: TheWeightsOfTheSpecialistsACourtWantsSchema,
  specialistsAptitude: TheWeightsOfTheAptitudesOfASpecialistSchema,
  specialistsWork: TheWeightsOfTheWorkOfASpecialistSchema,
});
/** A bot version's weights, as its weights file holds them: every kind, and in each every name, each a number. */
export type TheWeightsOfABotVersion = z.infer<typeof TheWeightsOfABotVersionSchema>;
