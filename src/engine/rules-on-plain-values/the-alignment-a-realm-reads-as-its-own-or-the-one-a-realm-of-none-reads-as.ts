// ── The alignment a realm reads as: its own, or the one a realm of none reads as (plan P1-19bb1) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
import { THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';

/** The alignment a realm reads as: its own, or, for a realm of none (an empty alignment, or none given), the one the
 *  content names (THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS), exactly as each reader's `|| 'Neutral'` gave before. */
export const theAlignmentARealmReadsAs = (theAlignment: string | null | undefined): string =>
  (theAlignment ?? '') || THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS;
