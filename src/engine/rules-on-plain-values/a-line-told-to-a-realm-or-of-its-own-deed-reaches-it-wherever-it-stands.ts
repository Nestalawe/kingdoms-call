// ── A line told to a realm, or of its own deed, reaches it wherever it stands (B-18a) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). Two places read who a line of the turn reaches by its audience alone, with no eyes anywhere: emit,
// filing a line under the hero whose order is resolving only when it reaches his realm
// (src/engine/turn/events-and-their-audiences.ts), and the gate that says which lines each realm reads
// (src/views/the-gate-that-says-which-lines-of-the-turn-each-realm-reads-and-how-each-reaches-it.ts). Both ask this: a
// line told to the realm (one of the realms its audience names) or whose deed is the realm's own (its actor). The
// rest of what each reads (the world, eyes there, a battle) is its own.

/** How a line reaches a realm by its audience alone, wherever the realm's heroes stand: told it (one of the realms it
 *  is told to), or its deed (the realm is its actor), in that order; null: neither. */
export function theWayALineReachesARealmWhereverItStands(
  toldTo: readonly (number | null)[],
  actor: number | null | undefined,
  realm: number,
): 'told' | 'its deed' | null {
  if (toldTo.includes(realm)) return 'told';
  if (actor === realm) return 'its deed';
  return null;
}
