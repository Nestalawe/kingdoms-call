// ── THE WORDS OF THE INTRUSION WARNINGS' LINES (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact the intrusion warnings' lines record (src/engine/turn/the-facts-the-intrusion-
// warnings-lines-record.ts), in the same words the engine wrote before (turn/intrusion-warnings.ts,
// flushIntrusionNotifications): the phases he was seen in as one season, a run of them ("Spring–Late Summer") or a list,
// and his force's size, or how it shifted and what it was when last seen. A kind with no words here is a compile error
// (the `never` below).
import type { TheFactOfAnIntrusionWarningsLine } from '../../engine/turn/the-facts-the-intrusion-warnings-lines-record.ts';

/** The phases a hero was seen in, as the warning names them: one season, a run of them, or a list. */
function thePhasesSeen(fact: TheFactOfAnIntrusionWarningsLine): string | undefined {
  const { phases, seasonNames } = fact;
  if (phases.length === 1) return seasonNames[0];
  const contiguous = Number(phases[phases.length - 1]) - Number(phases[0]) === phases.length - 1;
  if (contiguous) return `${String(seasonNames[0])}–${String(seasonNames[seasonNames.length - 1])}`; // en-dash range
  return seasonNames.join(', ');
}

/** His force, as the warning tells it: its one size, or how it shifted. */
function theForceSeen(fact: TheFactOfAnIntrusionWarningsLine): string {
  return fact.sizesSeen.length === 1
    ? `They appear to be leading ${String(fact.sizesSeen[0])}.`
    : `Their strength shifted — most recently (${String(fact.seasonNames[fact.seasonNames.length - 1])}) leading ${String(fact.lastSize)}.`;
}

/** The words of one fact of the intrusion warnings' lines. */
export function theWordsOfAnIntrusionWarningsLine(fact: TheFactOfAnIntrusionWarningsLine): string {
  switch (fact.kind) {
    case "an enemy hero is spotted in a province of the realm's own":
      return `[Intelligence] ${fact.heroName} of ${fact.realmName} was spotted in your province of ${fact.provinceName} during ${String(thePhasesSeen(fact))}. ${theForceSeen(fact)}`;
    case "a hero of another realm shares a province with the realm's forces":
      return `[Intelligence] A hero of ${fact.realmName} (${fact.heroName}) shared ${fact.provinceName} with your forces during ${String(thePhasesSeen(fact))}. ${theForceSeen(fact)}`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the intrusion warnings' lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
