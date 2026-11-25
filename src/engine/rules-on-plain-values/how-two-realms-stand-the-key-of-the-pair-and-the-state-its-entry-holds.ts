// ── How two realms stand: the key of the pair, and the state its entry holds (B-06aq) ────
// A save's relations (G.relations) hold one entry a pair of realms, keyed "lower-higher" by the realms' indices; a
// pair with no entry, or a blank one, stands Neutral (src/content/the-relations-between-two-realms-…). The key is
// written here once, and every reader of a pair's entry asks it: relationBetween, areEnemies and areAllied beside the
// captures (src/engine/realms/relations-and-captures.ts), and the readers on a state that can't import them (their file
// imports the files that would import them back): relOfReport, the bots' botRelationRaw and the Reckoning's
// alliedBloc. Each of those keeps its own answer for a realm missing and for a realm with itself.
import { THE_STATE_A_PAIR_WITH_NO_ENTRY_STANDS_IN } from '../../content/the-relations-between-two-realms-the-three-states-a-pair-stands-in-and-the-treat-declaration.ts';

/** The key of a pair of realms in a save's relations: the lower index first, either way round. */
export function relKeyOf(a: number, b: number) {
  return a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`;
}

/** The state a pair's entry in a state's relations holds: Neutral when the pair has no entry, or a blank one. */
export function theStateThePairsEntryHolds(
  relations: Readonly<Partial<Record<string, string>>> | null | undefined,
  a: number,
  b: number,
) {
  const rel = relations?.[relKeyOf(a, b)] ?? '';
  return rel || THE_STATE_A_PAIR_WITH_NO_ENTRY_STANDS_IN;
}
