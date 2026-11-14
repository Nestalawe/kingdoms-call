// The rule registry of a realm's alignment's abilities (plan P1-19's alignment abilities family, row P1-19at1). An
// ability is one row in src/content/ (its alignment, how it is used and the numbers the books state for it:
// alignment-abilities-their-keys-names-numbers-and-words.ts) and one entry here, keyed by the same slug, naming its
// effect at each stage of a hook point. The hook points and their stages are the content effects' (one union, in
// the-registry-of-content-effects.ts); each stage's order is THE_ORDER_OF_EACH_STAGE_OF_THE_ALIGNMENT_ABILITIES. A
// runner is handed the alignment the rule reads (the realm's today) and asks, in the stage's order, the effects of the
// abilities that alignment holds. No effect draws a die: one that needs a roll returns its chance, and the resolver
// draws where it drew before. How to add one: docs/architecture/the-alignment-abilities-registry-its-stages-and-how-to-
// add-an-ability.md.
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
  type AnAlignmentAbility,
} from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  A_REALMS_ALIGNMENT_ADDS_TO_ITS_TAX,
  A_REALMS_CONSECRATED_GROUND_RAISES_A_PROVINCES_TAX,
} from './alignment-abilities/a-realms-alignment-at-the-turns-end.ts';
import type {
  HookPointName,
  TheIncomeARealmsAlignmentAddsTo,
  TheStagesOfEachHookPoint,
  TheTaxOfAProvinceOnConsecratedGround,
} from './the-registry-of-content-effects.ts';

/** An entry: the ability's effect at each stage it acts in. */
export type AlignmentAbilityEntry = { readonly [H in HookPointName]?: Partial<TheStagesOfEachHookPoint[H]> };

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). */
export const THE_REGISTRY_OF_ALIGNMENT_ABILITIES = {
  'neutral-trade': {
    turnEnd: { "a realm's alignment adds to its tax": A_REALMS_ALIGNMENT_ADDS_TO_ITS_TAX['neutral-trade'] },
  },
  'consecrated-ground-tax': {
    turnEnd: {
      "a realm's consecrated ground raises a province's tax":
        A_REALMS_CONSECRATED_GROUND_RAISES_A_PROVINCES_TAX['consecrated-ground-tax'],
    },
  },
} satisfies Record<AlignmentAbilitySlug, AlignmentAbilityEntry>;

/** Each stage's order: the entries with an effect at the stage, each once; the runner asks them in this order. */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_ALIGNMENT_ABILITIES = {
  turnEnd: {
    "a realm's alignment adds to its tax": ['neutral-trade'],
    "a realm's consecrated ground raises a province's tax": ['consecrated-ground-tax'],
  },
} as const satisfies {
  readonly [H in HookPointName]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly AlignmentAbilitySlug[];
  };
};

const ROWS: Readonly<Record<AlignmentAbilitySlug, AnAlignmentAbility>> = ALIGNMENT_ABILITIES;
const ENTRIES: Readonly<Record<AlignmentAbilitySlug, AlignmentAbilityEntry>> = THE_REGISTRY_OF_ALIGNMENT_ABILITIES;
const TURN_END = THE_ORDER_OF_EACH_STAGE_OF_THE_ALIGNMENT_ABILITIES.turnEnd;

/** The abilities of a stage's order the alignment holds, in the order. */
const theAbilitiesOfTheStageAnAlignmentHolds = (
  theAlignment: string | null | undefined,
  theOrder: readonly AlignmentAbilitySlug[],
): readonly AlignmentAbilitySlug[] => theOrder.filter((slug) => ROWS[slug].alignment === theAlignment);

/** The runner of "turnEnd: a realm's alignment adds to its tax" (neutralTradeGold, which Early Winter's collection and
 *  the report's forecast ask): the gold the abilities the alignment holds add to the provinces' income, added. */
export function whatARealmsAlignmentAddsToItsTax(
  theAlignment: string | null | undefined,
  facts: TheIncomeARealmsAlignmentAddsTo,
): number {
  const theStage = "a realm's alignment adds to its tax";
  return theAbilitiesOfTheStageAnAlignmentHolds(theAlignment, TURN_END[theStage]).reduce(
    (theGold, slug) => theGold + (ENTRIES[slug].turnEnd?.[theStage]?.(facts) ?? 0),
    0,
  );
}

/** The runner of "turnEnd: a realm's consecrated ground raises a province's tax" (Early Winter's collection and the
 *  report's forecast, for a province the realm's consecration list holds): the province's tax after each effect of the
 *  stage, in its order, each handed the tax the one before gave. It is handed no alignment: the consecration list gates
 *  it, as before. */
export function theTaxOfAProvinceOnConsecratedGround(facts: TheTaxOfAProvinceOnConsecratedGround): number {
  const theStage = "a realm's consecrated ground raises a province's tax";
  return TURN_END[theStage].reduce(
    (theTax, slug) => ENTRIES[slug].turnEnd?.[theStage]?.({ theTax }) ?? theTax,
    facts.theTax,
  );
}
