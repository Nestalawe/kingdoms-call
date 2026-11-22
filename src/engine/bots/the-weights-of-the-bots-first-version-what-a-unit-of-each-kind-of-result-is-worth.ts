// ── The weights of the bots' first version: what a unit of each kind of result is worth to it (B-06h) ──
// One file a bot version (the kinds and the shape: the-kinds-of-result-a-bot-weighs-and-the-shape-of-a-bot-versions-
// weights.ts). Each number is the one the bots' code wrote before T7, copied exactly; weights tuned by kind come after
// T7, the old bot played against the new.
import type {
  AKindOfResultABotWeighs,
  TheWeightsOfAKindOfResult,
} from './the-kinds-of-result-a-bot-weighs-and-the-shape-of-a-bot-versions-weights.ts';

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
} satisfies Record<AKindOfResultABotWeighs, TheWeightsOfAKindOfResult>;
