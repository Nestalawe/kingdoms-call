import { theProvincesNextToAProvince } from './the-hexes-next-to-a-province-on-a-map-that-wraps-east-to-west.ts';
import {
  aColumnLeadingShipsMayNotStepFromLandToLand,
  canEnterTerrain,
} from './where-a-column-may-step-the-ground-a-neutral-realms-border-and-ships-over-land.ts';
import type { AColumnAsTheTerrainTestsReadIt } from './where-a-column-may-step-the-ground-a-neutral-realms-border-and-ships-over-land.ts';

// ── The first step of a shortest route a column may take (plan P1-11e7) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other. The road a far march follows
// (stepTowardPath in src/engine/world/routes-and-distances.ts) asks this with the turn's map, the column, the ground
// its ships or flyers let it enter (its sea cap) and whether it leads ships. Plan P1-11e7 moved it here, with the map's
// values handed in, so the order form's march forecast can ask the same rule on the report's map.

/** A province as a route reads it: its id, its ground, and its row and column on the map. */
export interface AProvinceOnARoute {
  readonly id: number;
  readonly terrain: string;
  readonly row: number;
  readonly col: number;
}

/** A map as a route reads it: its provinces in row order (a gap where it holds none), `cols` wide and `rows` high. */
export interface AMapARouteCrosses<P> {
  readonly provinces: readonly (P | null | undefined)[];
  readonly cols: number;
  readonly rows: number;
}

/** A search, breadth first, from `from` toward the province `toId`: the first step of a shortest route the column may
 *  take, and its depth (the steps after the first), or null when no route of at most 40 steps exists. A step may
 *  enter a province whose ground the column may enter (canEnterTerrain, with its sea cap) and that `extraFilter`
 *  allows, if given; a column that leads ships may not step from land to land. Neighbours are searched in the compass
 *  directions' order (NW, NE, W, E, SW, SE), so of two routes as short, the one whose first step comes first wins. */
export function theFirstStepOfAShortestRouteAColumnMayTake<P extends AProvinceOnARoute>(
  theColumn: AColumnAsTheTerrainTestsReadIt,
  itsSeaCap: string,
  itLeadsShips: boolean,
  theMap: AMapARouteCrosses<P>,
  from: P,
  toId: number,
  extraFilter?: (p: P) => boolean,
): { first: P; depth: number } | null {
  const passable = (p: P | null | undefined) =>
    !!p && canEnterTerrain(theColumn, p.terrain, itsSeaCap) && (!extraFilter || extraFilter(p));
  const edgeOk = (a: P, b: P) => !aColumnLeadingShipsMayNotStepFromLandToLand(itLeadsShips, a.terrain, b.terrain);
  const seen = new Set([from.id]);
  // BFS storing the first step taken on each path
  let frontier = theProvincesNextToAProvince(from, theMap.cols, theMap.rows, theMap.provinces)
    .filter((p) => passable(p) && edgeOk(from, p))
    .map((p) => ({ p, first: p }));
  frontier.forEach((e) => seen.add(e.p.id));
  let depth = 0;
  while (frontier.length && depth < 40) {
    for (const e of frontier) {
      if (e.p.id === toId) return { first: e.first, depth: depth };
    }
    const next = [];
    for (const e of frontier) {
      for (const nb of theProvincesNextToAProvince(e.p, theMap.cols, theMap.rows, theMap.provinces)) {
        if (seen.has(nb.id) || !passable(nb) || !edgeOk(e.p, nb)) continue;
        seen.add(nb.id);
        next.push({ p: nb, first: e.first });
      }
    }
    frontier = next;
    depth++;
  }
  return null;
}

/** Whether a realm's column may pass through a province on its way without starting a fight or being turned back (plan
 *  P1-11e12): its realm's own, an ally's (`theRelation`, asked only of another realm's province), or ground no realm
 *  holds where no armed neutral guard stands (`anArmedNeutralGuardStandsThere`, asked only there). */
export function aProvinceIsSafePassageForARealmsColumn(
  // (undefined where the order form's report gives the realm no index: compared only)
  theRealm: number | null | undefined,
  theOwner: number | null | undefined,
  theRelation: () => string,
  anArmedNeutralGuardStandsThere: () => boolean,
): boolean {
  if (theOwner === theRealm) return true;
  if (theOwner != null) return theRelation() === 'allied';
  return !anArmedNeutralGuardStandsThere();
}

/** The step a column takes toward a far province (plan P1-11e12): the first step of a shortest route (`theRoute`, asked
 *  with no filter), but where it serves a realm, of a route over safe passage (`isSafePassage`: the province it makes
 *  for may be any) that is no longer, that one's. Null when no route reaches it. */
export function theStepAColumnTakesTowardAFarProvince<P extends AProvinceOnARoute>(
  theRoute: (extraFilter?: (p: P) => boolean) => { first: P; depth: number } | null,
  toId: number | null | undefined,
  itServesARealm: boolean,
  isSafePassage: (p: P) => boolean,
): P | null {
  const any = theRoute();
  if (!any) return null;
  if (itServesARealm) {
    const safe = theRoute((p) => p.id === toId || isSafePassage(p));
    if (safe && safe.depth <= any.depth) return safe.first;
  }
  return any.first;
}
