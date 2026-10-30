// ── THE WORDS OF THE LINES OF A RALLIED GARRISON AND WRAITH'S TOUCH (plan P1-12d17: P1-12's Decisions of 2026-10-30,
// Decision 2) ──
// The views write the words of the facts the lines of src/engine/world/ record (src/engine/world/the-facts-rallied-
// garrisons-and-wraiths-touch-lines-record.ts), in the same words the engine wrote before (world/province-bookkeeping-
// and-rallied-garrisons.ts, world/map-helpers.ts): the plural from the count, and Wraith's Touch indented as a
// battle's line.
import type { TheFactOfARalliedGarrisonOrWraithsTouchLine } from '../../engine/world/the-facts-rallied-garrisons-and-wraiths-touch-lines-record.ts';

/** The words of a line of a rallied garrison or of Wraith's Touch (each of its kinds). */
export function theWordsOfARalliedGarrisonOrWraithsTouchLine(
  fact: TheFactOfARalliedGarrisonOrWraithsTouchLine,
): string {
  switch (fact.kind) {
    case "a held province's standing troops resume their post as its garrison":
      return `🛡 With ${fact.provinceName} held, its standing troops (${String(fact.units)} unit${fact.units !== 1 ? 's' : ''}) resume their post as the garrison.`;
    case "Wraith's Touch withers the enemy's best unit":
      return `  ☠ Wraith's Touch withers ${fact.unitName} — permanently reduced from ${fact.was} to ${fact.quality}.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the lines of src/engine/world/ have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
