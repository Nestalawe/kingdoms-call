// ── THE WORDS OF A BOT'S CONCESSION LINE (plan P1-12d17: P1-12's Decisions of 2026-10-30, Decision 2) ──
// The views write the words of the fact a bot's concession line records (src/engine/bots/the-facts-a-bots-concession-
// line-records.ts), in the same words the engine wrote before (bots/missions.ts, runBotConcessions).
import type { TheFactOfABotsConcessionLine } from '../../engine/bots/the-facts-a-bots-concession-line-records.ts';

/** The words of a bot's concession line (its one kind). */
export function theWordsOfABotsConcessionLine(fact: TheFactOfABotsConcessionLine): string {
  return `\u{1F3F3} ${fact.realmName} holds no province in all the world — the realm CONCEDES the game. Its heroes lay down their ambitions and will only defend what they have from here on.`;
}
