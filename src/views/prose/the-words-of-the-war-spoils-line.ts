// ── THE WORDS OF THE WAR-SPOILS LINE (plan P1-12d14: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of the fact the war-spoils line records (src/engine/units/the-facts-the-war-spoils-line-
// records.ts), in the same words the engine wrote before (units/drill-and-spoils.ts, markOrcAttackWin): the
// commander's name without its "(wandering)", and the plurals from the count.
import type { TheFactOfTheWarSpoilsLine } from '../../engine/units/the-facts-the-war-spoils-line-records.ts';

/** The words of the war-spoils line (its one kind). */
export function theWordsOfTheWarSpoilsLine(fact: TheFactOfTheWarSpoilsLine): string {
  const n = fact.units;
  return `🪓 **Orcish war-spoils**: ${String(n)} Orcish unit${n !== 1 ? 's' : ''} of ${fact.heroName.replace(' (wandering)', '')}'s host plunder${n === 1 ? 's' : ''} the field — their wages are halved this turn.`;
}
