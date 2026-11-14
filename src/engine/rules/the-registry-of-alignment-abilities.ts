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
import {
  A_REALMS_ALIGNMENT_GIVES_A_SIDE_ITS_CHANCE_OF_ZEAL,
  A_REALMS_ALIGNMENT_STIRS_A_SIDES_FERVOUR,
  CONSECRATED_GROUND_STIRS_A_DEFENDERS_ZEAL,
} from './alignment-abilities/a-sides-zeal-and-fervour-in-a-battle.ts';
import type {
  AChanceOfZealOnConsecratedGround,
  ASideAsItsFervourIsWeighed,
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
  'zeal-of-a-divine-realm': {
    strength: {
      "a realm's alignment gives a side its chance of zeal":
        A_REALMS_ALIGNMENT_GIVES_A_SIDE_ITS_CHANCE_OF_ZEAL['zeal-of-a-divine-realm'],
    },
  },
  'zeal-of-a-good-realm': {
    strength: {
      "a realm's alignment gives a side its chance of zeal":
        A_REALMS_ALIGNMENT_GIVES_A_SIDE_ITS_CHANCE_OF_ZEAL['zeal-of-a-good-realm'],
    },
  },
  'zeal-of-a-druidic-realm': {
    strength: {
      "a realm's alignment gives a side its chance of zeal":
        A_REALMS_ALIGNMENT_GIVES_A_SIDE_ITS_CHANCE_OF_ZEAL['zeal-of-a-druidic-realm'],
    },
  },
  'zeal-of-a-neutral-realm': {
    strength: {
      "a realm's alignment gives a side its chance of zeal":
        A_REALMS_ALIGNMENT_GIVES_A_SIDE_ITS_CHANCE_OF_ZEAL['zeal-of-a-neutral-realm'],
    },
  },
  'zeal-of-a-pagan-realm': {
    strength: {
      "a realm's alignment gives a side its chance of zeal":
        A_REALMS_ALIGNMENT_GIVES_A_SIDE_ITS_CHANCE_OF_ZEAL['zeal-of-a-pagan-realm'],
    },
  },
  'zeal-of-an-evil-realm': {
    strength: {
      "a realm's alignment gives a side its chance of zeal":
        A_REALMS_ALIGNMENT_GIVES_A_SIDE_ITS_CHANCE_OF_ZEAL['zeal-of-an-evil-realm'],
    },
  },
  'zeal-of-an-undead-realm': {
    strength: {
      "a realm's alignment gives a side its chance of zeal":
        A_REALMS_ALIGNMENT_GIVES_A_SIDE_ITS_CHANCE_OF_ZEAL['zeal-of-an-undead-realm'],
    },
  },
  'consecrated-ground-doubles-a-defenders-zeal': {
    strength: {
      "consecrated ground stirs a defender's zeal":
        CONSECRATED_GROUND_STIRS_A_DEFENDERS_ZEAL['consecrated-ground-doubles-a-defenders-zeal'],
    },
  },
  'savage-fury': {
    strength: { "a realm's alignment stirs a side's fervour": A_REALMS_ALIGNMENT_STIRS_A_SIDES_FERVOUR['savage-fury'] },
  },
  'skeletal-fervour': {
    strength: {
      "a realm's alignment stirs a side's fervour": A_REALMS_ALIGNMENT_STIRS_A_SIDES_FERVOUR['skeletal-fervour'],
    },
  },
} satisfies Record<AlignmentAbilitySlug, AlignmentAbilityEntry>;

/** Each stage's order: the entries with an effect at the stage, each once; the runner asks them in this order. */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_ALIGNMENT_ABILITIES = {
  strength: {
    "a realm's alignment gives a side its chance of zeal": [
      'zeal-of-a-divine-realm',
      'zeal-of-a-good-realm',
      'zeal-of-a-druidic-realm',
      'zeal-of-a-neutral-realm',
      'zeal-of-a-pagan-realm',
      'zeal-of-an-evil-realm',
      'zeal-of-an-undead-realm',
    ],
    "consecrated ground stirs a defender's zeal": ['consecrated-ground-doubles-a-defenders-zeal'],
    // as the old Math.max named them: the skeletal legions' (under the king, under a hero), then the Monsters'
    "a realm's alignment stirs a side's fervour": ['skeletal-fervour', 'savage-fury'],
  },
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
const STRENGTH = THE_ORDER_OF_EACH_STAGE_OF_THE_ALIGNMENT_ABILITIES.strength;

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

/** The alignment a side of a battle fights under: its realm's, or Neutral for a realm of none (or none given), as both
 *  battles read it before. */
const theAlignmentASideFightsUnder = (theAlignment: string | null | undefined): string =>
  (theAlignment ?? '') || 'Neutral';

/** The runner of "strength: a realm's alignment gives a side its chance of zeal" (both battles, before the realm's
 *  fanaticism discoveries add theirs): the chance of the ability the side's alignment holds, or 0.1 for an alignment
 *  none holds, as the old table's `?? 0.1` gave. */
export function theChanceOfZealARealmsAlignmentGivesASide(theAlignment: string | null | undefined): number {
  const theStage = "a realm's alignment gives a side its chance of zeal";
  const [slug] = theAbilitiesOfTheStageAnAlignmentHolds(theAlignmentASideFightsUnder(theAlignment), STRENGTH[theStage]);
  return (slug === undefined ? undefined : ENTRIES[slug].strength?.[theStage]?.()) ?? 0.1;
}

/** The runner of "strength: consecrated ground stirs a defender's zeal" (combatVsChar, for a defender on a province his
 *  realm owns and its consecration list holds, after the discoveries' share): the chance after each effect of the
 *  stage, in its order, each handed the chance the one before gave. It is handed no alignment: the consecration list
 *  gates it, as before. */
export function theChanceOfZealOfADefenderOnConsecratedGround(facts: AChanceOfZealOnConsecratedGround): number {
  const theStage = "consecrated ground stirs a defender's zeal";
  return STRENGTH[theStage].reduce(
    (theChance, slug) => ENTRIES[slug].strength?.[theStage]?.({ theChance }) ?? theChance,
    facts.theChance,
  );
}

/** A side's fervour: the factor it lifts the whole force by, and the abilities of its alignment that stirred it (the
 *  battles' lines name them). */
export interface ASidesFervour {
  readonly theFactor: number;
  readonly theAbilitiesThatStirredIt: readonly AlignmentAbilitySlug[];
}

/** The runner of "strength: a realm's alignment stirs a side's fervour" (both battles, after the zeal rolls): the
 *  strongest counts, never stacked. As the old Math.max: 1, zeal's strength if the roll seized the side (the Divine
 *  row's, for every creed and a realm of none), then each fervour the side's alignment holds that stirs, in the stage's
 *  order. */
export function theFervourOfASide(
  theAlignment: string | null | undefined,
  facts: ASideAsItsFervourIsWeighed,
): ASidesFervour {
  const theStage = "a realm's alignment stirs a side's fervour";
  const stirred = theAbilitiesOfTheStageAnAlignmentHolds(
    theAlignmentASideFightsUnder(theAlignment),
    STRENGTH[theStage],
  ).flatMap((slug) => {
    const theFactor = ENTRIES[slug].strength?.[theStage]?.(facts) ?? null;
    return theFactor === null ? [] : [{ slug, theFactor }];
  });
  const theStrengthOfZeal = ALIGNMENT_ABILITIES['zeal-of-a-divine-realm'].theNumbers.theStrengthOfZeal.value;
  return {
    theFactor: Math.max(1, facts.isItSeizedByZeal ? theStrengthOfZeal : 1, ...stirred.map((s) => s.theFactor)),
    theAbilitiesThatStirredIt: stirred.map((s) => s.slug),
  };
}
