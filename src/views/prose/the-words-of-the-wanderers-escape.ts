// ── THE WORDS OF THE WANDERER'S ESCAPE (plan P1-12d5: P1-12's Decisions of 2026-10-26, Decisions 4 and 6) ──
// The views write the words of the fact the wanderer's escape records (src/engine/the-facts-the-wanderers-escape-line-
// records.ts), in the same words the engine wrote before: the sentence the die picked, after his name. The sentences
// moved here from src/engine/names.ts (_GARRETH_ESCAPES); the die that picks one stays there, in its place.
import {
  THE_NUMBER_OF_WAYS_THE_WANDERER_ESCAPES,
  type TheFactOfTheWanderersEscape,
} from '../../engine/the-facts-the-wanderers-escape-line-records.ts';

/** The sentences the wanderer's escape is told with, after his name: the engine draws which, as many as it counts. */
export const _GARRETH_ESCAPES = [
  ' somehow slips the final blow and is gone before the dust settles.',
  ' takes what should be a mortal stroke — and walks out of it without a scratch.',
  ' should by all rights have fallen, yet somehow escapes the final blow.',
  ' reels from a killing hit, staggers into the smoke, and simply isn’t there when it clears.',
  ' is run through — or seems to be — but slips free, whole and unbothered.',
] as const satisfies { length: typeof THE_NUMBER_OF_WAYS_THE_WANDERER_ESCAPES };

/** The words of the wanderer's escape (its one kind). */
export function theWordsOfTheWanderersEscape(fact: TheFactOfTheWanderersEscape): string {
  return `\u{1F340} ${fact.heroName || 'The wanderer'}${String(_GARRETH_ESCAPES[fact.whichSentence])}`;
}
