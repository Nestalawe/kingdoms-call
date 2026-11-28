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

/** A bot version's weights: what a unit of each kind of result is worth to it, keyed by the kind, never by the
 *  effect. */
export const TheWeightsOfABotVersionSchema = z.object({
  gold: TheWeightsOfAGoldSchema,
  title: TheWeightsOfATitleSchema,
  alignmentAbility: TheWeightsOfAnAlignmentAbilitySchema,
  raceGift: TheWeightsOfARaceGiftSchema,
  temper: TheWeightsOfATemperSchema,
  battleStrength: TheWeightsOfAPointOfAHostsStrengthSchema,
});
/** A bot version's weights, as its weights file holds them: every kind, and in each every name, each a number. */
export type TheWeightsOfABotVersion = z.infer<typeof TheWeightsOfABotVersionSchema>;
