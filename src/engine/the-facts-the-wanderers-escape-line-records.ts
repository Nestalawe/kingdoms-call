// ── THE FACT THE WANDERER'S ESCAPE RECORDS (plan P1-12d5: P1-12's Decisions of 2026-10-26, Decisions 2, 4 and 6) ──
// One neutral hero each game is the wanderer who cannot fall (names.ts, _escapesTheEnd): whenever a killing blow
// should land on him, a line says he slipped it. Its sentence is one of five, picked by a die where the line is told
// (_garrethEscapeLine): the die stays in the engine, in its place, so every draw after it is the same, and the fact
// holds which sentence (Decision 4); the prose writes the words (src/views/prose/the-words-of-the-wanderers-escape.ts).
// The line is filed on its own by every caller but the duel before a battle, which tells it in the battle's
// narrative: its audience is its event's (in a fight's narrative, the fight's), as a kind filed on its own (Decision 6).
// No rules or help text mentions him: an Easter egg only.
import type { TheAudienceOfAKindOfLine, TheTierOfAKindOfABattlesLine } from './turn/events-and-their-audiences.ts';

/** How many sentences the wanderer's escape is told with (the prose's): the engine draws which, the prose writes it. */
export const THE_NUMBER_OF_WAYS_THE_WANDERER_ESCAPES = 5;

/** What the wanderer's escape records: his name as the world holds it ('' when he has none: the prose calls him "The
 *  wanderer"), and which of its sentences the die picked. */
export interface TheFactOfTheWanderersEscape {
  readonly kind: 'the wanderer slips a killing blow';
  readonly heroName: string;
  readonly whichSentence: number;
}

/** Each kind's audience: its event's (a kind filed on its own; in a fight's narrative, the fight's). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_WANDERERS_ESCAPE: Readonly<
  Record<TheFactOfTheWanderersEscape['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'the wanderer slips a killing blow': "its event's",
};

/** Each kind's tier when it is told in a battle's lines (the duel before it; plan P1-12d34): the short account's, as
 *  its words gave when the views read the tiers from them. */
export const THE_TIER_OF_EACH_KIND_OF_THE_WANDERERS_ESCAPE: Readonly<
  Record<TheFactOfTheWanderersEscape['kind'], Extract<TheTierOfAKindOfABattlesLine, 'k'>>
> = {
  'the wanderer slips a killing blow': 'k',
};
