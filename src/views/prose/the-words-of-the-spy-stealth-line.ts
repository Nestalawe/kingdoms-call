// ── THE WORDS OF THE SPY STEALTH'S LINE (plan P1-12d17: P1-12's Decisions of 2026-10-30, Decision 2) ──
// The views write the words of the fact the Spy stealth's line records (src/engine/turn/the-facts-the-spy-stealth-line-
// records.ts), in the same words the engine wrote before (run-turn.ts, spyStealthAndInvisibilityStampedForTheReports).
// The report's filters read its "[Intelligence] " opening.
import type { TheFactOfTheSpyStealthLine } from '../../engine/turn/the-facts-the-spy-stealth-line-records.ts';

/** The words of the Spy stealth's line (its one kind). */
export function theWordsOfTheSpyStealthLine(fact: TheFactOfTheSpyStealthLine): string {
  return `[Intelligence] 🕶 ${fact.heroName} moved unseen this turn — ${fact.byTheShimmer ? 'the Shimmer of illusory magic blurred them from watching eyes' : 'Spy ' + String(fact.spyLevel) + ' kept them out of enemy sightings'}.`;
}
