// ── THE PROVINCES A REALM HAS IN SIGHT NOW, AND THOSE IT HAS VISITED (B-06bw) ────
// One sight rule, read by the turn's report (playerView, src/views/what-each-realm-may-see-of-the-world.ts) and by the
// bots (botIntel, src/engine/bots/intel.ts): the parts the two copies work out the same way. Each copy reads its own
// three sources (`owned`, `heroesThere`, `spied`) and keeps its own other sets, as it did before. The test that holds
// the two copies together: tests/unit/the-reports-copy-and-the-bots-copy-of-the-sight-rule-each-give-what-they-gave-before.test.ts.
import { nearSpiedProvIds, type SightContext } from './heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { GameState } from '../../schemas/saved-game-state.ts';

/** A realm's three sources of the sight rule, each as the copy that asks reads it. */
export interface TheThreeSourcesOfARealmsSight {
  owned: Set<number>;
  heroesThere: Set<number>;
  spied: Set<number>;
}

/** The sight rule's context (enemyCharVisibleTo's): the three sources, the same sets, and `nearSpied`. */
export interface TheSightContextOfARealm extends SightContext {
  nearSpied: Set<number>;
}

/** The three sources together, each province once, in the order `owned`, `heroesThere`, `spied`. */
export function theProvincesInSightNow(sources: TheThreeSourcesOfARealmsSight): Set<number> {
  return new Set([...sources.owned, ...sources.heroesThere, ...sources.spied]);
}

/** The sight rule's context from a realm's three sources (the same sets), with nearSpiedProvIds of `spied`. */
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

/** The provinces whose `visitedBy` names the realm, in the world's order. */
export function theProvincesARealmHasVisited(state: GameState, realm: number): Set<number> {
  const visited = new Set<number>();
  (asItsGuardReadsIt(state.world.provinces) ?? []).forEach((p) => {
    if (asItsGuardReadsIt(p) && (asItsGuardReadsIt(p.visitedBy) ?? []).includes(realm)) visited.add(p.id);
  });
  return visited;
}
