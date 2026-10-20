// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
// ── The units that fly, sail or can be carried through the air (plan P1-11a3) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';

// Flying armies can cross sea provinces without a fleet
export const FLYING_TYPES = new Set(KC_UNIT_CLASS.flying);
// AERIAL_TYPES governs SEA-CROSSING only: every unit that flies and so needs no naval escort to
// enter a sea province. It is a superset of FLYING_TYPES and adds the winged primal beasts. It is
// deliberately separate from FLYING_TYPES so their combat terrain modifiers stay untouched.
export const AERIAL_TYPES = new Set(KC_UNIT_CLASS.aerial);
// Non-humanoid army classification for Druidic/Evil alignment bonuses
export const CREATURE_ARMIES = new Set(KC_UNIT_CLASS.creature);
export const MONSTER_ARMIES = new Set(KC_UNIT_CLASS.monster);

// Sea-capable armies (fleets etc) CARRIER_TYPES — the six humanoid fleets. These are the ONLY
// units that can ferry land armies across a sea province; each hull provides 1 point of carrying
// capacity.
export const CARRIER_TYPES = new Set(KC_UNIT_CLASS.carrier);
// PRIMAL_SEA_TYPES — Druid-summoned sea beasts. They swim under their own power, so they need no
// escort to enter the sea, but they are not ships: they carry NOTHING. A kraken cannot ferry
// infantry. They also cannot march: like a fleet, their only legal land moves are land→sea and
// sea→coastal land. Recruitable only in sea provinces (see the 'recruit' case).
export const PRIMAL_SEA_TYPES = new Set(KC_UNIT_CLASS.primalSea);
// SEA_TYPES — every unit that crosses sea under its own power. Used throughout the engine for "is
// this a naval unit" (sea-battle penalties, Naval-skill bonuses, hull targeting, move pools).
export const SEA_TYPES = new Set([...CARRIER_TYPES, ...PRIMAL_SEA_TYPES]);

// ── FLYING CARRY ────
// A humanoid flyer (one of FLYING_TYPES) can lift a single humanoid FOOT soldier and carry it
// through the air, exactly as a fleet ferries land units across the sea. Cavalry, naval hulls,
// sea beasts and creature/monster units are too heavy or unsuitable and are never carried.
export const CAVALRY_TYPES = new Set(KC_UNIT_CLASS.cavalry);
export function isAirCarriable(a) {
  if (!a) return false;
  const t = a.type;
  if (AERIAL_TYPES.has(t) || SEA_TYPES.has(t)) return false; // flyers carry, hulls/sea-beasts sail
  if (CREATURE_ARMIES.has(t) || MONSTER_ARMIES.has(t)) return false; // no lifting creatures/monsters
  if (CAVALRY_TYPES.has(t)) return false; // horses don't ride griffons
  return true; // humanoid foot (levy/archer/guard/garrison/gun)
}
// Can this WHOLE force take to the air? Every foot soldier must be liftable, and there must be at
// least one humanoid flyer per carried unit (self-flying units ride for free: humanoid flyers and
// primal winged beasts). Any grounded unit that can be neither carried nor fly on its own — a
// horse, a fleet, a walking creature/monster — anchors the column to the earth.
export function getFlyCapability(armies) {
  armies = (armies || []).filter((a) => a && !a._phantom); // spectral doubles are weightless — never carried, never counted
  if (armies.length === 0) return false;
  let carriers = 0,
    carried = 0,
    sawSelfFlier = false;
  for (const a of armies) {
    if (!a) continue;
    if (FLYING_TYPES.has(a.type)) {
      carriers++;
      sawSelfFlier = true;
      continue;
    } // humanoid flyer: flies + carries 1
    if (AERIAL_TYPES.has(a.type)) {
      sawSelfFlier = true;
      continue;
    } // primal winged beast: flies, carries none
    if (isAirCarriable(a)) {
      carried++;
      continue;
    } // foot soldier that must be lifted
    return false; // grounded — the force cannot fly
  }
  return sawSelfFlier && carriers >= carried;
}
