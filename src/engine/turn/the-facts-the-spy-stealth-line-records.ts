// ── THE FACT THE SPY STEALTH'S LINE RECORDS (plan P1-12d17: P1-12's Decisions of 2026-10-30, Decision 2) ──
// Before any report is built, each hero with Spy skill (or the Shimmer of illusory magic) rolls once to slip out of
// enemy sightings for the turn (run-turn.ts, spyStealthAndInvisibilityStampedForTheReports), and his realm is told when
// he does. The fact holds the hero's name as the world holds it, his Spy level and a flag for the Shimmer (the clause
// the line chooses); the prose writes the words (src/views/prose/the-words-of-the-spy-stealth-line.ts). It is filed on
// its own, with the audience its event names (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from './events-and-their-audiences.ts';

/** What the Spy stealth's line records. */
export interface TheFactOfTheSpyStealthLine {
  readonly kind: 'a hero moves unseen this turn';
  readonly heroName: string;
  /** Whether the Shimmer of illusory magic hid him (else his Spy level did). */
  readonly byTheShimmer: boolean;
  readonly spyLevel: number;
}

/** Each kind's audience: its event's (it is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_SPY_STEALTH_LINE: Readonly<
  Record<TheFactOfTheSpyStealthLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a hero moves unseen this turn': "its event's",
};
