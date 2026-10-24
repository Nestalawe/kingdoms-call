// ── THE FACTS A BATTLE'S LINES RECORD (plan P1-12c3: P1-12's Decisions of 2026-10-24, Decision 2) ────
// A typed line records a fact, and the views write its words after perception (src/views/prose/the-words-of-a-
// battles-lines.ts): the engine no longer writes those words itself. Each kind below is one sentence's sense, with the
// fields its words are made from, and its audience (Decision 6). Rows c4 to c6 add the rest of the fights' lines.
// LineFact (src/engine/turn/events-and-their-audiences.ts) is the union of every area's kinds; a kind with no words in
// src/views/prose/ is a compile error there.

/** One unit of a force drawn up for battle, as its header row shows it. */
export interface AUnitOfAForceDrawnUp {
  type: string;
  quality: string;
  unitName: string;
  race: string | null;
  phantom: boolean;
  skeletal: boolean;
  wildHunt: boolean;
  wildHuntUntil: number | null;
}

/** A side's force as a battle begins: its header (its name, its owner's colour, how it comes on) and one row per unit
 *  (forceMarker, battle-report-lines-and-force-markers.ts). Its words are the header's machine form, which the player
 *  page and the GM page draw as the force's rows. Its audience: the fight's. */
export interface AForceDrawnUpForBattle {
  kind: 'a force drawn up for battle';
  name: string;
  color: string | null;
  neutral: boolean;
  guard: boolean;
  role: string;
  verb: string;
  armies: AUnitOfAForceDrawnUp[];
}

/** Where a battle's losses tally goes (emitBattle files it after the battle's lines): the views work the tally out from
 *  the words of the battle's lines, and put it where the casualty lists begin, or leave it out when there is none to
 *  tally. It has no words of its own. Its audience: the fight's. */
export interface ABattlesLossesTalliedFromItsLines {
  kind: "a battle's losses, tallied from its lines";
}

/** The facts a battle's lines record. */
export type TheFactOfABattlesLine = AForceDrawnUpForBattle | ABattlesLossesTalliedFromItsLines;

/** The place of a battle's losses tally, as emitBattle files it. */
export const THE_PLACE_OF_A_BATTLES_LOSSES_TALLY: ABattlesLossesTalliedFromItsLines = {
  kind: "a battle's losses, tallied from its lines",
};
