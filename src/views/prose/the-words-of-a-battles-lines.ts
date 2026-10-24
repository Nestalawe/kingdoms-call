// ── THE WORDS OF A BATTLE'S LINES (plan P1-12c3: P1-12's Decisions of 2026-10-24, Decision 2) ────
// The views write the words of each fact a battle's lines record (src/engine/battle/the-facts-a-battles-lines-record.ts),
// after the engine, in the same words the engine wrote before. A kind with no words here is a compile error (the
// `never` below) and, from an untyped caller, a throw in play.
import type { TheFactOfABattlesLine } from '../../engine/battle/the-facts-a-battles-lines-record.ts';

/** The words of one fact of a battle's lines. */
export function theWordsOfABattlesLine(fact: TheFactOfABattlesLine): string {
  switch (fact.kind) {
    case 'a force drawn up for battle': {
      // The header's machine form, its keys in this order: the player page, the GM page, the battle's tiers and its
      // tally read it back (join-and-chronicle.ts, turn-log.ts, engine/battle/fates.ts).
      const { name, color, neutral, guard, role, verb, armies } = fact;
      return '⚑FORCE⚑' + JSON.stringify({ name, color, neutral, guard, role, verb, armies });
    }
    case "a battle's losses, tallied from its lines":
      throw new Error(
        "a battle's losses tally is written from the words of the battle's lines (theTurnsLinesInWords), not on its own",
      );
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a battle's line records a fact with no words: ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
