// ── The share of a province an Explore order maps (plan P1-11d14) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). The turn's Explore order (resolveExploreOrder, src/engine/orders/explore-and-search-orders-maps-
// lairs-rites-and-rumours.ts) asks it with the hero's Explorer as effStat counts it, his Trailblazer title and his
// realm's discoveries' factor on the ground; the order form's forecast (exploreGainFor, src/ui/player/order-targets.ts)
// asks it through src/shared/ with the same three as the report gives them (R-125: the Loremaster adds nothing).
import { KC_BASIC_EXPLORE } from '../../content/kingdoms-call-data.ts';

/** AK 3.2: the ground's Basic Exploration Number × (Explorer + 1), in percent of the province, capped at 100. The
 *  terrain table: Plain 35, Desert 25, Forest 20, Mountain 20, Jungle 15, Sea 25 (cut 15 points from the original
 *  {plain:50,desert:40,forest:35,mountain:35,jungle:30,sea:40} to slow the early land-grab), and 15 for a ground it
 *  doesn't name (or none). His Explorer counts to 5. The Trailblazer minor title adds 5% (the Loremaster's old bonus is
 *  gone: R-125). His realm's `explore` discoveries multiply it by their factor on this ground (Scouts & Rangers and The
 *  Compass among them). Rounded down, multiplied in this order (the forecast's old order gives the same figure on
 *  every share, level and factor the content holds: plan P1-11d14). */
export function theShareOfAProvinceAnExploreOrderMaps(
  theGround: string | null | undefined,
  theExplorersLevel: number,
  heHoldsTheTrailblazer: boolean,
  theFactorHisRealmsDiscoveriesMultiplyItBy: number,
): number {
  const BASIC_EXPLORE: Readonly<Partial<Record<string, number>>> = { ...KC_BASIC_EXPLORE }; // read by any ground
  const basicRate = (theGround == null ? 0 : (BASIC_EXPLORE[theGround] ?? 0)) || 15;
  const explorerSkill = Math.min(5, theExplorersLevel);
  const loreMult = heHoldsTheTrailblazer ? 1.05 : 1;
  return Math.min(
    100,
    Math.floor(basicRate * (explorerSkill + 1) * loreMult * theFactorHisRealmsDiscoveriesMultiplyItBy),
  );
}
