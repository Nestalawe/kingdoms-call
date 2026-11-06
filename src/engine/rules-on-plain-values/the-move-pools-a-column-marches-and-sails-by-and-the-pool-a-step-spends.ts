import { AERIAL_TYPES, SEA_TYPES, getFlyCapability } from './units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import type { UnitOfAType } from './units-that-fly-sail-or-can-be-carried-through-the-air.ts';

// ── The move pools a column marches and sails by, and the pool a step spends ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other. The turn's move pools
// (computeMovePoolMax and refreshMovePool in src/engine/units/movement-pools.ts) and the Move order's own function
// (src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts) ask these. Plan P1-11e5 moved them here,
// with what the caller reads of the world handed in (the speed table, his March and Naval bonuses from his skills as
// they count, his realm's discoveries, his minor titles), so the order form's march forecast can ask the same rules.

/** What a column's move pools are worked out from, each read by the caller: the companies that set its pace (the
 *  illusions left out), the speed table, the move points his March adds to a land company that doesn't fly (one rate
 *  for every company, item 14), those his Naval adds to a ship of a base speed, the move points his realm's
 *  discoveries add to a land company of Speed 1–2 (null for a hero of no realm), and whether he holds the Swift and
 *  the Seawolf minor titles. */
export interface WhatAColumnsMovePoolsAreWorkedOutFrom<U extends UnitOfAType> {
  readonly companies: readonly U[];
  readonly theSpeedOfEachType: Readonly<Partial<Record<string, number>>>;
  readonly whatHisMarchAddsOnLand: number;
  readonly whatHisNavalAddsToAShipOfTheSpeed: (base: number) => number;
  readonly whatHisRealmsDiscoveriesAddTo: ((company: U) => number) | null;
  readonly heHoldsSwift: boolean;
  readonly heHoldsSeawolf: boolean;
}

/** A column's move pools for a turn: its land pace, its sea pace, and whether it may move at sea at all. */
export interface TheMovePoolsOfAColumn {
  readonly land: number;
  readonly sea: number;
  readonly seaActive: boolean;
}

// A character's move-pool MAXIMUMS from his CURRENT army composition and skills. Shared by setMovePool (turn start)
// and refreshMovePool (mid-turn, after composition or March/Naval changes), so both stay perfectly in step.
export function theMovePoolsOfAColumn<U extends UnitOfAType>(
  theColumn: WhatAColumnsMovePoolsAreWorkedOutFrom<U>,
): TheMovePoolsOfAColumn {
  const armies = theColumn.companies;
  const ARMY_SPEED_R = theColumn.theSpeedOfEachType;
  let land: number, sea: number, seaActive: boolean;
  if (armies.length === 0) {
    land = 5;
    sea = 5;
    seaActive = true; // a hero with no fleet takes passage — Naval skill buys nothing
  } else {
    const landArmies = armies.filter((a) => !SEA_TYPES.has(a.type));
    if (landArmies.length > 0) {
      const landSpeeds = landArmies.map((a) => {
        const base = (ARMY_SPEED_R[a.type] ?? 0) || 3;
        if (AERIAL_TYPES.has(a.type)) return base; // no flyer (rider or winged beast) is sped by March (item 14)
        // sd13 Road Network (+1 for speed 1-2 land armies) and Item 5 `move` discoveries (race /
        // cls filtered), same speed band (the discoveries' registry's since plan P1-19af: "movementCost: a realm's
        // discoveries add to a march").
        let _road = 0;
        if (theColumn.whatHisRealmsDiscoveriesAddTo !== null && base <= 2) {
          _road = theColumn.whatHisRealmsDiscoveriesAddTo(a);
        }
        return base + theColumn.whatHisMarchAddsOnLand + _road;
      });
      land = Math.min(...landSpeeds);
    } else {
      land = 0; // only sea armies: can't traverse land directly
    }
    const seaArmies = armies.filter((a) => SEA_TYPES.has(a.type));
    if (seaArmies.length > 0) {
      const seaSpeeds = seaArmies.map((a) => {
        const base = (ARMY_SPEED_R[a.type] ?? 0) || 3;
        return base + theColumn.whatHisNavalAddsToAShipOfTheSpeed(base);
      });
      sea = Math.min(...seaSpeeds);
      seaActive = true;
    } else if (armies.every((a) => AERIAL_TYPES.has(a.type))) {
      sea = land;
      seaActive = true; // all flying: free sea entry
    } else {
      sea = 0;
      seaActive = false;
    }
    // FLYING CARRY. If the humanoid flyers can lift every foot soldier (1 each, nothing grounded
    // left behind), the column takes to the air: it no longer marches at the infantry's pace but
    // at the flyers' own speed, and — like an all-flying host — it crosses sea freely. Only the
    // self-flying units (humanoid flyers + primal winged beasts) set the pace; carried infantry
    // ride along at that speed. March does not speed flight (flyers already ignore March above).
    if (getFlyCapability(armies) && !armies.every((a) => AERIAL_TYPES.has(a.type))) {
      const flyerSpeeds = armies.filter((a) => AERIAL_TYPES.has(a.type)).map((a) => (ARMY_SPEED_R[a.type] ?? 0) || 3);
      if (flyerSpeeds.length) {
        land = Math.min(...flyerSpeeds);
        sea = land;
        seaActive = true;
      }
    }
  }
  // Swift / Seawolf minor titles keep their +1 (only when a pool actually exists).
  if (theColumn.heHoldsSwift && land > 0) land += 1;
  if (theColumn.heHoldsSeawolf && sea > 0) sea += 1;
  return { land, sea, seaActive };
}

// Recompute a pool mid-turn after a composition change (transfer/give/garrison/disband) or a March/Naval skill gain,
// WITHOUT refunding or double-spending. Remaining points are carried forward and adjusted only by the CHANGE in the
// pool's maximum:
// • ADDING a slower unit (newMax < oldMax): the fresh unit just mustered/joined and has not
// marched, so the moves already made are NOT charged against its allowance —
// remaining = min(newMax, oldRemaining). (Fixes: recruiting or picking up a speed-1 garrison
// after an earlier march wrongly reported "no movement points left".)
// • DROPPING a slow unit (newMax > oldMax): the freed reach is handed back — remaining rises by
// the max increase (still capped at newMax), so shedding a slow unit speeds the column up.
// • No change (newMax == oldMax): remaining is untouched.
// This also subsumes the old light-travel discount (a no-army hero's generous 5-move pool
// dropping to an army pace is just the "added a slower unit" case). Total moves stay capped by
// the 5-phase turn (one move per phase), so a character can still never exceed 5 provinces in a
// turn.
/** The move points a pool has left once its maximum changes from `theOldMaximum` to `theNewMaximum`, given the
 *  points it had left: never more than the new maximum nor less than none, and raised by the rise alone. */
export function theMovePointsAPoolHasLeftOnceItsMaximumChanges(
  theOldMaximum: number,
  thePointsItHadLeft: number,
  theNewMaximum: number,
): number {
  return Math.max(0, Math.min(theNewMaximum, thePointsItHadLeft + Math.max(0, theNewMaximum - theOldMaximum)));
}

/** The pool a step from one ground into another spends: the sea pool to enter the sea, or to land from it (a coastal
 *  landing: the journey is naval); the land pool from land to land. */
export function theMovePoolAStepSpends(theGroundItLeaves: string, theGroundItEnters: string): 'sea' | 'land' {
  const enteringSea = theGroundItEnters === 'sea';
  const leavingSea = theGroundItLeaves === 'sea';
  const coastalLanding = leavingSea && !enteringSea;
  return enteringSea || coastalLanding ? 'sea' : 'land';
}
