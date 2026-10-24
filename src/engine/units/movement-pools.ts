// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { ARMY_SPEED_R } from '../battle/ladder.ts';
import { carrierBerths, marchSpeedBonus, navalSpeedBonus } from './movement.ts';
import {
  AERIAL_TYPES,
  FLYING_TYPES,
  SEA_TYPES,
  getFlyCapability,
  isAirCarriable,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { discEff, discUnitMatch } from '../discoveries.ts';
import { charMinor } from '../titles/title-holders-and-battle-merit.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { perkTier } from '../titles/perks.ts';

// ── MOVEMENT POOLS (plan P1-08b: lifted out of resolveTurn) ────
// Where a column may step, and each hero's move points for the turn: the land and sea pools (resolveTurn's movePoints,
// seaMovePoints, seaMoveActive, seaCap, moveMax and seaMoveMax, which join the turn's context by reference), set at
// the start of the turn and refreshed when a column changes; and the chance that two contingents unify.
// computeMovePoolMax, setMovePool and refreshMovePool take the turn's context first (src/engine/turn/context.ts); the
// rest read no turn state. Whether a column can put to sea (getSeaCapability; plan P1-13e1 moved it here from
// sea-lift-stranding-and-retreats.ts) comes first: canEnterTerrain and the sea pool read its answer.
// Get movement allowance for a character AT THE START OF THE TURN (before any armies picked up)
// stored per character for the whole turn
export function getSeaCapability(armies, leadChar) {
  // spectral doubles are illusions — they weigh nothing, need no berth and no griffon, and are
  // never counted against a force's lift. (They normally live outside ch.armies entirely; this
  // guards the case where a fighting copy is still attached mid-phase.)
  armies = (armies || []).filter((a) => a && !a._phantom);
  if (armies.length === 0) return 'all';
  const landArmies = armies.filter((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type));
  // Only CARRIERS provide capacity. Primal sea beasts swim themselves across but carry nothing,
  // so they contribute 0 — a force of one Kraken plus one Goblin Horde still cannot put to sea.
  const seaCount = armies.reduce((s, a) => s + carrierBerths(a), 0); // berths, not hulls: a turtle offers two (Island Back)
  const flyCount = armies.filter((a) => AERIAL_TYPES.has(a.type)).length;
  if (landArmies.length === 0) return 'all'; // only flying/sea
  // if the humanoid flyers can lift every foot soldier, the whole column takes to the air and
  // crosses sea without a fleet — just like an all-flying host.
  if (getFlyCapability(armies)) return 'sea';
  // Fleet capacity: light foot = 0.5 capacity (2 per hull), heavy/cavalry/siege/beast = 1 per
  // hull
  const LIGHT_ARMIES = new Set(KC_UNIT_CLASS.lightFoot); // gun-crews ride as light foot — an Ironclad ferries a Gun + a Guard
  // HULLS AND FLYERS POOL THEIR LIFT. Now:
  // • units a flyer cannot lift (cavalry, siege, walking creatures/monsters) MUST go aboard ship;
  // • everything a flyer CAN lift rides a hull if there is room, else is carried by one humanoid
  // flyer apiece (primal winged beasts still carry nothing);
  // • the shortfall is what the flyers must cover, so hulls + flyers together decide the question.
  const _capOf = (a) => (LIGHT_ARMIES.has(a.type) ? 0.5 : 1); // light foot take half a hull, everything else a full one
  let hullCap = seaCount;
  if (leadChar && perkTier(leadChar, 'naval') >= 3) hullCap *= 2; // NAVAL L8: one naval hull carries what once needed two
  const _mustSail = landArmies.filter((a) => !isAirCarriable(a)); // horses, siege, beasts — ship or nothing
  const _liftable = landArmies.filter((a) => isAirCarriable(a)); // humanoid foot — ship OR air
  let _room = hullCap - _mustSail.reduce((s, a) => s + _capOf(a), 0);
  if (_room < 0) return 'land'; // no berth for the unliftable — stay ashore
  // Fill the remaining berths with the LIGHTEST liftable units first: that puts the most bodies
  // aboard and so leaves the fewest for the flyers (a flyer lifts one unit whatever its weight).
  let _byAir = 0;
  _liftable
    .slice()
    .sort((a, b) => _capOf(a) - _capOf(b))
    .forEach((a) => {
      const _c = _capOf(a);
      if (_room >= _c) _room -= _c;
      else _byAir++;
    });
  const flyerLift = armies.filter((a) => FLYING_TYPES.has(a.type)).length; // humanoid flyers: one unit each
  if (_byAir <= flyerLift) return 'sea';
  return 'land';
}

export function canEnterTerrain(c, terrain, seaCap) {
  if (terrain === 'sea') {
    if (seaCap === 'all' || seaCap === 'sea') return true;
    if (c._partSeaThisPhase) return true; // Part Sea spell active this phase
    return false;
  }
  // Land province: sea-only armies can't move land→land unless adjacent to same sea
  // For simplicity we allow land movement unless they have ONLY sea armies (no land/flying)
  const armies = c.armies || [];
  if (armies.length > 0 && armies.every((a) => SEA_TYPES.has(a.type))) return false;
  return true;
}

// 2026-10-08 (Toby item 14): can this column step from `from` into `to`? canEnterTerrain judges only the
// ground it would stand on; the Move order also forbids a column leading ANY naval unit (fleet or
// sea-beast) to step from one land province to another — ships cannot cross land (see the move
// case: "cannot march overland while leading naval units"). The Defend ride-outs and the force-march
// reinforcement checked terrain alone, so a general with ships and troops in a coastal province rode
// out overland to a neighbour on Defend. Every path that marches a column without a Move order now
// asks this instead.
export function canStepBetween(c, from, to, cap) {
  if (!to || !canEnterTerrain(c, to.terrain, cap)) return false;
  const naval = (c.armies || []).some((a) => a && SEA_TYPES.has(a.type));
  if (naval && from && from.terrain !== 'sea' && to.terrain !== 'sea') return false;
  return true;
}

// The March speed table is MARCH_NAVAL_BONUS at module level (item 14: one rate for every unit).
// Unify chance table [0 distance, 1 distance, 2 distance] by March level
export const MARCH_UNIFY = [
  [80, 50, 20],
  [90, 60, 30],
  [100, 70, 40],
  [100, 80, 50],
  [100, 90, 60],
  [100, 100, 70],
];

// Naval table: similar to March but for sea movement, +20% fleet str per level
export const NAVAL_UNIFY = [
  [80, 50, 20],
  [90, 60, 30],
  [100, 70, 40],
  [100, 80, 50],
  [100, 90, 60],
  [100, 100, 70],
];

// Pure computation of a character's move-pool MAXIMUMS from CURRENT army composition + skills.
// Returns {land, sea, seaActive, cap}. Shared by setMovePool (turn start) and refreshMovePool
// (mid-turn, after composition or March/Naval changes), so both stay perfectly in step.
export function computeMovePoolMax(turnContext, c) {
  const armies = (c.armies || []).filter((a) => a && !a._phantom); // illusions set no pace and take no berth
  const marchLevel = effStat(turnContext, c, 'march');
  const navalLevel = effStat(turnContext, c, 'naval');
  let land, sea, seaActive;
  if (armies.length === 0) {
    land = 5;
    sea = 5;
    seaActive = true; // a hero with no fleet takes passage — Naval skill buys nothing
  } else {
    const landArmies = armies.filter((a) => !SEA_TYPES.has(a.type));
    if (landArmies.length > 0) {
      const landSpeeds = landArmies.map((a) => {
        const base = ARMY_SPEED_R[a.type] || 3;
        if (AERIAL_TYPES.has(a.type)) return base; // no flyer (rider or winged beast) is sped by March (item 14)
        // sd13 Road Network (+1 for speed 1-2 land armies) and Item 5 `move` discoveries (race /
        // cls filtered), same speed band.
        let _road = 0;
        if (c.player != null && base <= 2) {
          discEff(turnContext, c.player, 'move').forEach((e) => {
            if (discUnitMatch(e, a)) _road += e.extra || 0;
          });
        }
        return base + marchSpeedBonus(marchLevel) + _road;
      });
      land = Math.min(...landSpeeds);
    } else {
      land = 0; // only sea armies: can't traverse land directly
    }
    const seaArmies = armies.filter((a) => SEA_TYPES.has(a.type));
    if (seaArmies.length > 0) {
      const seaSpeeds = seaArmies.map((a) => {
        const base = ARMY_SPEED_R[a.type] || 3;
        return base + navalSpeedBonus(base, navalLevel);
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
      const flyerSpeeds = armies.filter((a) => AERIAL_TYPES.has(a.type)).map((a) => ARMY_SPEED_R[a.type] || 3);
      if (flyerSpeeds.length) {
        land = Math.min(...flyerSpeeds);
        sea = land;
        seaActive = true;
      }
    }
  }
  // Swift / Seawolf minor titles keep their +1 (only when a pool actually exists).
  if (charMinor(turnContext, c, 'swift') && land > 0) land += 1;
  if (charMinor(turnContext, c, 'seawolf') && sea > 0) sea += 1;
  return { land, sea, seaActive, cap: getSeaCapability(armies, c) };
}
export function setMovePool(turnContext, c) {
  const { movePoints, seaMovePoints, seaMoveActive, seaCap, moveMax, seaMoveMax } = turnContext;
  const m = computeMovePoolMax(turnContext, c);
  movePoints[c.id] = m.land;
  seaMovePoints[c.id] = m.sea;
  seaMoveActive[c.id] = m.seaActive;
  seaCap[c.id] = m.cap;
  moveMax[c.id] = m.land;
  seaMoveMax[c.id] = m.sea;
}
// Recompute the pool mid-turn after a composition change (transfer/give/garrison/disband) or a
// March/Naval skill gain, WITHOUT refunding or double-spending: points already spent this turn
// are preserved, so dropping a slow unit correctly frees up the extra reach for the rest of the
// turn, and picking up a slow unit correctly reduces it. (Fixes: army stuck at an old slow speed
// after a slow unit was transferred out; move rate not rising when March increased mid-turn.)
export function refreshMovePool(turnContext, c) {
  const { moveMax, movePoints, seaMoveMax, seaMovePoints, seaMoveActive, seaCap } = turnContext;
  if (!c || c.id == null) return;
  const oldLandMax = moveMax[c.id] != null ? moveMax[c.id] : (movePoints[c.id] ?? 0);
  const oldSeaMax = seaMoveMax[c.id] != null ? seaMoveMax[c.id] : (seaMovePoints[c.id] ?? 0);
  const oldLandRem = movePoints[c.id] != null ? movePoints[c.id] : oldLandMax;
  const oldSeaRem = seaMovePoints[c.id] != null ? seaMovePoints[c.id] : oldSeaMax;
  const m = computeMovePoolMax(turnContext, c);
  // Composition-change accounting WITHOUT retroactive penalties. Remaining points are carried
  // forward and adjusted only by the CHANGE in the pool's maximum:
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
  movePoints[c.id] = Math.max(0, Math.min(m.land, oldLandRem + Math.max(0, m.land - oldLandMax)));
  seaMovePoints[c.id] = Math.max(0, Math.min(m.sea, oldSeaRem + Math.max(0, m.sea - oldSeaMax)));
  seaMoveActive[c.id] = m.seaActive;
  seaCap[c.id] = m.cap;
  moveMax[c.id] = m.land;
  seaMoveMax[c.id] = m.sea;
}

// Contingent unify helper — used when two friendly forces attack same province same phase
export function contingentUnifyChance(marchOrNaval, distanceProvinces, isNaval) {
  const table = isNaval ? NAVAL_UNIFY : MARCH_UNIFY;
  const row = table[Math.min(marchOrNaval, 5)] || table[0];
  return row[Math.min(distanceProvinces, 2)] || row[row.length - 1];
}
