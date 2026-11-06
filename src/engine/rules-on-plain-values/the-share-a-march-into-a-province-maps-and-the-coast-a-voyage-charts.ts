// ── The share a march into a province maps, and the coast a voyage charts (plan P1-11e6) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other. The Move order's own function
// (src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts) asks these with what it reads of the hero:
// his Explorer as effStat counts it, the share his worn items add (the items' registry's runner, which stays there),
// his March and Naval perks and the companies he leads. Plan P1-11e6 moved them here so the order form's Explore note
// can ask the same rules.

/** The share of a province a hero's march into it maps, on every march in (not the first alone): 10%, and 5% a level
 *  of his Explorer as the turn counts it, and the share his worn items add (a Traveller's Cloak 20%), and at March 6 or
 *  more 2% a company he leads. In percent; the cap is the province's (below). */
export function theShareOfAProvinceAMarchIntoItMaps(
  theMarchersExplorerLevel: number,
  theShareHisWornItemsAdd: number,
  heHoldsMarchSixOrMore: boolean,
  theCompaniesHeLeads: number,
): number {
  return (
    10 + 5 * theMarchersExplorerLevel + theShareHisWornItemsAdd + (heHoldsMarchSixOrMore ? 2 * theCompaniesHeLeads : 0)
  );
}

/** A realm's share of a province mapped once a march or a voyage adds its share to what it had: at most 100%. */
export function theShareOfAProvinceMappedOnceAShareIsAdded(
  theShareMappedBefore: number,
  theShareAdded: number,
): number {
  return Math.min(100, theShareMappedBefore + theShareAdded);
}

/** Naval 6, charting the coast: a hero who sails into a sea at Naval 6 or more, leading ships, charts 5% of each land
 *  province beside it; else he charts none (0). */
export function theShareAVoyageChartsOfEachCoastBesideTheSea(
  theGroundHeEnters: string,
  heHoldsNavalSixOrMore: boolean,
  heLeadsShips: boolean,
): number {
  return theGroundHeEnters === 'sea' && heHoldsNavalSixOrMore && heLeadsShips ? 5 : 0;
}

/** The provinces beside the sea a voyage charts are its coast: those of land (not the sea's own). */
export function aProvinceBesideTheSeaIsACoastAVoyageCharts(theGroundBesideIt: string): boolean {
  return theGroundBesideIt !== 'sea';
}
