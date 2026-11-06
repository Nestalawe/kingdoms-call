import { SEA_TYPES } from './units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import type { UnitOfAType } from './units-that-fly-sail-or-can-be-carried-through-the-air.ts';

// ── Where a column may step: the ground it enters, a neutral realm's border, ships over land ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other. The Move order's own function
// (src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts) asks all three; the steps a column takes
// without a Move order (canStepBetween in src/engine/units/movement-pools.ts) and the road a far march follows
// (stepTowardPath in src/engine/world/routes-and-distances.ts) ask the ground and ships over land. Plan P1-11e4 moved
// them here, with the world's values handed in, so the order form's march forecast can ask the same rules.

/** A column as the terrain tests read it: its units (a gap passed over where the step's test guards one), and the Part
 *  Sea mark of this phase (Parked: nothing sets it). */
export interface AColumnAsTheTerrainTestsReadIt {
  readonly _partSeaThisPhase?: unknown;
  readonly armies?: readonly UnitOfAType[] | null | undefined;
}

export function canEnterTerrain(c: AColumnAsTheTerrainTestsReadIt, terrain: string, seaCap: string): boolean {
  if (terrain === 'sea') {
    if (seaCap === 'all' || seaCap === 'sea') return true;
    if (c._partSeaThisPhase) return true; // Part Sea spell active this phase
    return false;
  }
  // Land province: sea-only armies can't move land→land unless adjacent to same sea
  // For simplicity we allow land movement unless they have ONLY sea armies (no land/flying)
  const armies = c.armies ?? [];
  if (armies.length > 0 && armies.every((a) => SEA_TYPES.has(a.type))) return false;
  return true;
}

/** Whether a hero's march into a province is turned back at its border: it is held by another realm his own is merely
 *  neutral with (no alliance, no war), and he leads companies (a lone hero passes freely). The relation is the one
 *  between his realm and the province's owner, as the turn reads it (`'neutral'`, `'allied'`, `'enemy'` or `'self'`). */
export function aColumnIsTurnedBackAtANeutralRealmsBorder(
  theMarchersRealm: number | null | undefined,
  theProvincesOwner: number | null | undefined,
  theCompaniesHeLeads: number,
  theRelationBetweenThem: string,
): boolean {
  return (
    theProvincesOwner != null &&
    theProvincesOwner !== theMarchersRealm &&
    theCompaniesHeLeads > 0 &&
    theRelationBetweenThem === 'neutral'
  );
}

/** Whether a column that leads any naval unit (a fleet or a sea-beast) is refused this step: ships never cross land, so
 *  it may not step from one land province to another; it puts out to sea first, and lands again only from the sea. */
export function aColumnLeadingShipsMayNotStepFromLandToLand(
  theColumnLeadsShips: boolean,
  theGroundItLeaves: string,
  theGroundItEnters: string,
): boolean {
  return theColumnLeadsShips && theGroundItLeaves !== 'sea' && theGroundItEnters !== 'sea';
}
