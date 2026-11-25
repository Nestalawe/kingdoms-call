// ── THE PROVINCES A REALM HAS IN SIGHT NOW, AND THOSE IT HAS VISITED (B-06bw) ────
// One sight rule, read by the turn's report (playerView, src/views/what-each-realm-may-see-of-the-world.ts) and by the
// bots (botIntel, src/engine/bots/intel.ts): the parts the two copies work out the same way. Each copy reads its own
// three sources (the provinces it owns, where its heroes stand, the provinces it spied) and its own bordering ring, as
// it did before; tests/unit/the-reports-copy-and-the-bots-copy-of-the-sight-rule-each-give-what-they-gave-before.test.ts
// holds the two copies together.
import { nearSpiedProvIds, type SightContext } from './heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { GameState } from '../../schemas/saved-game-state.ts';

/** A realm's three sources of sight now, each as the copy that asks reads it: the provinces it owns, the provinces
 *  where a hero of its own stands, and the provinces it spied. */
export interface TheThreeSourcesOfARealmsSight {
  owned: Set<number>;
  heroesThere: Set<number>;
  spied: Set<number>;
}

/** The sight rule's context (enemyCharVisibleTo's): the three sources, the same sets, and the provinces next to a
 *  spied one. */
export interface TheSightContextOfARealm extends SightContext {
  nearSpied: Set<number>;
}

/** The provinces a realm has in sight now: those it owns, then those where a hero of its own stands, then those it
 *  spied, each once, in that order. */
export function theProvincesInSightNow(sources: TheThreeSourcesOfARealmsSight): Set<number> {
  return new Set([...sources.owned, ...sources.heroesThere, ...sources.spied]);
}

/** The sight rule's context from a realm's three sources (the same sets) and the provinces next to the spied ones. */
export function theSightContextOfARealm(
  state: GameState,
  sources: TheThreeSourcesOfARealmsSight,
): TheSightContextOfARealm {
  return {
    ownedProvIds: sources.owned,
    ownCharLocs: sources.heroesThere,
    spiedThisTurn: sources.spied,
    nearSpied: nearSpiedProvIds(state, sources.spied),
  };
}

/** The provinces a hero of the realm has ever set foot in (each province's visitedBy), in the world's order. */
export function theProvincesARealmHasVisited(state: GameState, realm: number): Set<number> {
  const visited = new Set<number>();
  (asItsGuardReadsIt(state.world.provinces) ?? []).forEach((p) => {
    if (asItsGuardReadsIt(p) && (asItsGuardReadsIt(p.visitedBy) ?? []).includes(realm)) visited.add(p.id);
  });
  return visited;
}
