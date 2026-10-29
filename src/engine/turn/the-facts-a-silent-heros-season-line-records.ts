// ── THE FACTS A SILENT HERO'S SEASON LINE RECORDS (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// No silent season (turn/log-line-helpers.ts, noteSilentHeroes): a living realm hero with no line of his own in a phase
// gets one saying where the season leaves him: he left one province and ended the season in another, or he remains
// where he is. Each kind holds the hero's and the provinces' names as the world holds them (a province's null where the
// line says "the field"); the prose writes the words (src/views/prose/the-words-of-a-silent-heros-season-line.ts). Each
// is filed on its own, with the audience its event names (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from './events-and-their-audiences.ts';

/** What a silent hero's season line records. */
export type TheFactOfASilentHerosSeasonLine =
  | {
      kind: 'a hero with no line of his own leaves a province and ends the season in another';
      heroName: string;
      /** Null where the line says "the field". */
      fromProvinceName: string | null;
      provinceName: string | null;
    }
  | {
      kind: 'a hero with no line of his own remains where he is this season';
      heroName: string;
      provinceName: string | null;
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_SILENT_HEROS_SEASON_LINE: Readonly<
  Record<TheFactOfASilentHerosSeasonLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a hero with no line of his own leaves a province and ends the season in another': "its event's",
  'a hero with no line of his own remains where he is this season': "its event's",
};
