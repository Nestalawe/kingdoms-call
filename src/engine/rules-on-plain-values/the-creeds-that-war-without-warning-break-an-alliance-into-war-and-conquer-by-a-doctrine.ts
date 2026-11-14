// The creeds that war without warning, break an alliance into war and conquer by a doctrine (plan P1-19's alignment
// abilities family, row P1-19ax2): each reads its abilities' rows (src/content/alignment-abilities-their-keys-names-
// numbers-and-words.ts), not the registry's runner, since the player portal shares this file (src/shared/: the
// march's forecast, the diplomacy card, the order form's doctrine) and it may import only src/content. Their registry
// entries have no stage (the registry's unit test lists them), but the doctrine's, whose numbers the turn reads
// through the runner.
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
} from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';

/** Whether a row of the list is of the alignment (as the old lists' `includes`: an alignment no row holds, or none,
 *  is not). */
const anAbilityOfTheListIsOf = (theList: readonly AlignmentAbilitySlug[], theAlignment: unknown): boolean =>
  theList.some((slug) => ALIGNMENT_ABILITIES[slug].alignment === theAlignment);

/** Whether a realm of the alignment declares war without warning: its declaration on a realm it has met stands from
 *  the turn's first phase (the turn's start, and the march's forecast). */
export const doesAnAlignmentDeclareWarWithoutWarning = (theAlignment: unknown): boolean =>
  anAbilityOfTheListIsOf(
    ['war-without-warning-of-an-evil-realm', 'war-without-warning-of-an-undead-realm'],
    theAlignment,
  );

/** Whether a realm of the alignment that breaks an alliance goes to war, not to neutral (the reckoning, and the
 *  diplomacy card's button). */
export const doesAnAlignmentBreakAnAllianceIntoWar = (theAlignment: unknown): boolean =>
  anAbilityOfTheListIsOf(
    ['a-broken-alliance-means-war-for-an-evil-realm', 'a-broken-alliance-means-war-for-an-undead-realm'],
    theAlignment,
  );

/** Whether a realm of the alignment conquers by a doctrine its heroes set on their orders (the order form's choice;
 *  the turn reads the doctrine's numbers through the registry's runner). */
export const doesAnAlignmentConquerByADoctrine = (theAlignment: unknown): boolean =>
  anAbilityOfTheListIsOf(['plunder-or-enslave'], theAlignment);
