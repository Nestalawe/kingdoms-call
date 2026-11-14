// The prices and the scholars of a realm's alignment (plan P1-19's alignment abilities family, row P1-19av1): the
// abilities that cut a mercenary band's price ("orderOutcome: a realm's alignment cuts a mercenary band's price"),
// raise a Bless's yield ("orderOutcome: a realm's alignment raises a Bless's yield") and add to a Research's chance
// ("orderOutcome: a realm's alignment adds to research"). Each is handed the facts of its stage and reads its numbers
// from its row (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts); the runner
// (the-registry-of-alignment-abilities.ts) asks those the realm's alignment holds. No effect draws a die. (The Druids'
// Creature need and Evil's Monsters are read in src/engine/rules-on-plain-values/, which the player portal shares.)
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
} from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheOrdersOutcomesStages = TheStagesOfEachHookPoint['orderOutcome'];

/** "orderOutcome: a realm's alignment cuts a mercenary band's price": the Neutral discount, its row's gold. */
export const A_REALMS_ALIGNMENT_CUTS_A_MERCENARY_BANDS_PRICE = {
  'the-neutral-mercenary-discount': () =>
    ALIGNMENT_ABILITIES['the-neutral-mercenary-discount'].theNumbers.theGoldLess.value,
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheOrdersOutcomesStages["a realm's alignment cuts a mercenary band's price"]>
>;

/** "orderOutcome: a realm's alignment raises a Bless's yield": the Divine blessing, the king's in person or the realm's
 *  casters', each `1 + its row's share / 100` (exactly 2 and 1.8, as the old literals). */
export const A_REALMS_ALIGNMENT_RAISES_A_BLESSS_YIELD = {
  'the-divine-blessing': (facts) => {
    const theNumbers = ALIGNMENT_ABILITIES['the-divine-blessing'].theNumbers;
    return 1 + (facts.isTheCasterTheKing ? theNumbers.byTheKingInPerson : theNumbers.byTheRealmsCasters).value / 100;
  },
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheOrdersOutcomesStages["a realm's alignment raises a Bless's yield"]>
>;

/** "orderOutcome: a realm's alignment adds to research": the Neutral scholars, the Sage level times its row's points
 *  (`sageLevel * 5`, as before). */
export const A_REALMS_ALIGNMENT_ADDS_TO_RESEARCH = {
  'neutral-scholars': (facts) =>
    facts.theSageLevel * ALIGNMENT_ABILITIES['neutral-scholars'].theNumbers.thePointsASageLevelAdds.value,
} satisfies Partial<Record<AlignmentAbilitySlug, TheOrdersOutcomesStages["a realm's alignment adds to research"]>>;
