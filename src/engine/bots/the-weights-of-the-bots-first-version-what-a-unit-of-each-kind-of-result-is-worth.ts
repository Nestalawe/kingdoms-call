// ── The weights of the bots' first version: what a unit of each kind of result is worth to it (B-06h, B-06r) ──
// One file a bot version (the kinds and the shape: bots/intel.ts, beside the bots' other shapes). Each number is the
// one the bots' code wrote before T7, copied exactly; weights tuned by kind come after T7, the old bot played against
// the new.
import type { AKindOfResultABotWeighs, TheWeightsOfAKindOfResult } from './intel.ts';

/** What the bots' first version makes of each kind of result, by the kind. */
export const THE_WEIGHTS_OF_THE_BOTS_FIRST_VERSION = {
  /** A gold: what the realm's ledger keeps in its chest, lets its wages take and holds back for its posts each turn
   *  (botLedger, bots/strategy.ts). The wages and the tax it weighs are the rules' (botUpkeep, botTaxIncome). */
  gold: {
    /** An enemy host of more units than this puts the realm on a war footing, as a war does. */
    theMostUnitsOfAnEnemyHostThatLeaveTheRealmAtPeace: 5,
    /** On a war footing, the share of the income the wages may take (in peace, the bots' tuning's). */
    theShareOfTheIncomeTheWagesMayTakeOnAWarFooting: 1.0,
    /** On a war footing, the chest keeps this share of the wages, rounded down, between the least and the most below
     *  (in peace, the bots' tuning's reserve). */
    theShareOfTheWagesTheChestKeepsOnAWarFooting: 0.15,
    theLeastGoldTheChestKeepsOnAWarFooting: 2,
    theMostGoldTheChestKeepsOnAWarFooting: 8,
    /** A realm of fewer provinces than this is small: its wages may lean on a larger share of its free treasury. */
    theProvincesBelowWhichARealmIsSmall: 15,
    /** The share of the free treasury a small realm's wages may lean on (a larger realm's: the bots' tuning's). */
    theShareOfTheFreeTreasuryASmallRealmsWagesMayLeanOn: 0.6,
    /** A realm's defenders stand under strength while they lead fewer than this many units each. */
    theUnitsEachDefenderLeadsAtFullStrength: 3,
    /** While its defenders stand under strength, the share of the land's wage ceiling held back for their muster,
     *  rounded down. */
    theShareOfTheWageCeilingHeldBackForTheDefenders: 0.2,
  },
  /** An Imperial Title: which titles the realm chases (botTargetTitles, bots/spellcraft.ts), the skill each hero trains
   *  towards them (botTitleFocusSkill) and the specialists they want (botSpecialistRoles, bots/specialists.ts). What a
   *  title measures is its row's (`howTheHolderIsFound`); the skills the bots train towards it, and the role whose work
   *  earns its deeds, are the bots' reading of the row (bots/spellcraft.ts). */
  title: {
    /** From the standings: a title the realm holds is worth this to chase (to keep). */
    theWorthOfATitleTheRealmHolds: 3,
    /** From the standings: a rival's title is worth chasing once the realm's best hero has this share of its holder's
     *  merit, and is then worth that share. */
    theShareOfItsHoldersMeritThatMakesATitleWorthChasing: 0.6,
    /** The most titles a realm chases at once, the worthiest first (a tie to the first found). */
    theMostTitlesARealmChases: 3,
    /** With none worth chasing in the standings, each title the bots train towards is worth its court's levels in the
     *  skills they train towards it: each level of a fighting skill towards a title won by fighting, ... */
    theWorthOfEachLevelOfAFightingSkillTowardsATitleWonByFighting: 1,
    /** ... and each level of the skill (or the schools) a title measures, towards any other. */
    theWorthOfEachLevelOfTheSkillsATitleMeasures: 2,
    /** What a title won by battles on land is worth before any level. */
    theWorthOfATitleWonByBattlesOnLandBeforeAnyLevel: 5,
    /** What a title won by slaying lairs' guardians is worth before any level. */
    theWorthOfATitleWonBySlayingGuardiansBeforeAnyLevel: 2,
    /** With none worth a point either, the realm chases this many, the first in the bots' order. */
    theTitlesARealmChasesWhenNoneIsWorthAPoint: 2,
    /** A chased title wants this many specialists more, of the role whose work earns its deeds. */
    theSpecialistsMoreAChasedTitleWants: 1,
  },
  /** What an ability of a realm's alignment gives it: the heroes its court wants (botHeroCap, bots/strategy.ts), and
   *  the scholars it wants and the Sage level they work from (botSpecialistRoles and the scholar's orders,
   *  bots/specialists.ts). What each ability does is its row's, asked through the rules (the hire wage by the ladder,
   *  a Research's chance by the alignment); a host's fervour (botFervourMult, bots/intel.ts) and a recruit's
   *  (botRecruitableTypes) are the rules' factors themselves, weighed at a point of strength a point. */
  alignmentAbility: {
    /** A realm whose dearest wandering hero asks the least wage any realm's dearest asks (the ladder's middle) wants
     *  this many heroes more at court. */
    theHeroesMoreARealmWhoseDearestWandererAsksTheLeastWants: 1,
    /** A realm whose alignment adds to a Research's chance with each Sage level wants this many scholars more. */
    theScholarsMoreARealmWhoseAlignmentAddsToResearchWants: 1,
    /** Such a realm's scholar researches from this Sage level, and trains Sage below it, ... */
    theSageLevelFromWhichSuchARealmsScholarResearches: 1,
    /** ... and any other realm's from this one. */
    theSageLevelFromWhichAnyOtherRealmsScholarResearches: 2,
  },
} satisfies Record<AKindOfResultABotWeighs, TheWeightsOfAKindOfResult>;
