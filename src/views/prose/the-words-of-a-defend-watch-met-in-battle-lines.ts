// ── THE WORDS OF A DEFEND WATCH MET IN BATTLE'S LINES (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact a Defend watch met in battle's lines record (src/engine/turn/the-facts-a-
// defend-watch-met-in-battle-lines-record.ts), in the same words the engine wrote before (turn/mercenary-ids-and-battle-
// records.ts: completeDefendWatches, noteBattleLoss). A kind with no words here is a compile error (the `never` below).
import type { TheFactOfADefendWatchMetInBattlesLine } from '../../engine/turn/the-facts-a-defend-watch-met-in-battle-lines-record.ts';

/** The words of one fact of a Defend watch met in battle's lines. */
export function theWordsOfADefendWatchMetInBattlesLine(fact: TheFactOfADefendWatchMetInBattlesLine): string {
  switch (fact.kind) {
    case "a defender's Defend order is fulfilled once the threat is met in battle":
      return `🛡 ${fact.heroName}'s Defend order is fulfilled — the threat has been met in battle, and they keep no further watch unless ordered to Defend again.`;
    case "a defender's watch is broken by a defeat":
      return `${fact.heroName}'s defensive watch is broken by this defeat — they will hold no further ground this turn.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a Defend watch met in battle's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
