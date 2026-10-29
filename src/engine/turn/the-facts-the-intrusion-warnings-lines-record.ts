// ── THE FACTS THE INTRUSION WARNINGS' LINES RECORD (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The warnings a realm gets, after the phases, of a hero of another realm seen in its land or beside its own heroes
// (turn/intrusion-warnings.ts, flushIntrusionNotifications): one line for each hero, province and branch, gathering the
// phases he was seen in. Each kind holds plain values: the hero's, his realm's and the province's names as the world
// holds them, the phases he was seen in (in order) with each phase's name as the turn names its seasons, and the rough
// size of his force: each size seen (in the order first seen) and the last, each as the map names it (armySizeBand,
// src/engine/sight/: a band, as a label). The prose writes every word (src/views/prose/the-words-of-the-intrusion-
// warnings-lines.ts), each line opening "[Intelligence] " as before. Each is filed on its own, with the audience its
// event names (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from './events-and-their-audiences.ts';

/** What an intrusion warning's line records (both kinds alike). */
interface AHeroSeenAsAWarningTellsIt {
  /** The hero seen, and his realm. */
  heroName: string;
  realmName: string;
  provinceName: string;
  /** The phases he was seen in, in order, and each one's name (as SEASONS reads it: none for no phase). */
  phases: number[];
  seasonNames: (string | undefined)[];
  /** The rough size of his force: each seen, in the order first seen, and in the last phase he was seen. */
  sizesSeen: (string | undefined)[];
  lastSize: string | undefined;
}

/** What a line of the intrusion warnings records. */
export type TheFactOfAnIntrusionWarningsLine =
  | ({ kind: "an enemy hero is spotted in a province of the realm's own" } & AHeroSeenAsAWarningTellsIt)
  | ({ kind: "a hero of another realm shares a province with the realm's forces" } & AHeroSeenAsAWarningTellsIt);

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_AN_INTRUSION_WARNINGS_LINE: Readonly<
  Record<TheFactOfAnIntrusionWarningsLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  "an enemy hero is spotted in a province of the realm's own": "its event's",
  "a hero of another realm shares a province with the realm's forces": "its event's",
};
