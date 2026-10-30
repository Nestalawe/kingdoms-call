// ── THE FACT A BOT'S CONCESSION LINE RECORDS (plan P1-12d17: P1-12's Decisions of 2026-10-30, Decision 2) ──
// A bot realm left with no province anywhere in the world concedes the game (bots/missions.ts, runBotConcessions),
// and the world is told. The fact holds the realm's name as the world holds it; the prose writes the words
// (src/views/prose/the-words-of-a-bots-concession-line.ts). It is filed on its own, with the audience its event names
// (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** What a bot's concession line records. */
export interface TheFactOfABotsConcessionLine {
  readonly kind: 'a bot realm with no province concedes the game';
  readonly realmName: string;
}

/** Each kind's audience: its event's (it is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_BOTS_CONCESSION_LINE: Readonly<
  Record<TheFactOfABotsConcessionLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a bot realm with no province concedes the game': "its event's",
};
