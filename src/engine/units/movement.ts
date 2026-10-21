// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_CARRIER_BERTHS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { ARMY_SPEED_MASTER } from '../army-tables.ts';
import { typeOfX } from '../battle/lines.ts';
import { hasItemBase } from '../items/equipment.ts';
import { discEffectsOf, discUnitMatch } from '../discoveries.ts';
import { CARRIER_TYPES } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';

// ── MARCH AND NAVAL SPEED BONUS ────
// 2026-10-13 (Toby, item 14): one rate of advance. Every unit a hero leads gains the same bonus
// from March (on land) or Naval (at sea), whatever its base move: +0/+0/+1/+1/+2/+3 at levels 0–5
// (the old "slow column" ladder; the "fast column" ladder +0/+1/+1/+2/+2/+2 is gone). Flyers gain
// nothing from March. Kept at module top level so the engine, the turn report and the bots all
// read the same table.
export const MARCH_NAVAL_BONUS = [0, 0, 1, 1, 2, 3];
export function marchSpeedBonus(marchLevel) {
  return MARCH_NAVAL_BONUS[Math.max(0, Math.min(5, marchLevel || 0))];
}
// Report helper (2026-09-23, item 7): the movement rate of an UNLED (garrison) unit — base speed,
// plus the realm's Road / race `move` discoveries for a speed-1/2 land unit, as computeMovePoolMax
// adds them. No commander, so no March / Naval / title bonus.
export const GARRISON_SEA_TYPES_R = new Set(KC_UNIT_CLASS.sea);
export const GARRISON_AIR_TYPES_R = new Set(KC_UNIT_CLASS.aerial);
export const GARRISON_FLY_TYPES_R = new Set(KC_UNIT_CLASS.flying);
export function garrisonMoveRate(a, pl) {
  if (!a) return {};
  const base = ARMY_SPEED_MASTER[a.type] || 3;
  const sea = GARRISON_SEA_TYPES_R.has(a.type);
  let road = 0;
  if (!sea && !GARRISON_FLY_TYPES_R.has(a.type) && base <= 2 && pl && typeof discEffectsOf === 'function')
    discEffectsOf(pl, 'move').forEach((e) => {
      if (discUnitMatch(e, a)) road += e.extra || 0;
    });
  return { moveRate: base + road, moveKind: sea ? 'sea' : GARRISON_AIR_TYPES_R.has(a.type) ? 'air' : 'land' };
}
export function navalSpeedBonus(baseSpeed, navalLevel) {
  // baseSpeed is no longer used (item 14: one rate)
  return MARCH_NAVAL_BONUS[Math.max(0, Math.min(5, navalLevel || 0))];
}
// Berths a unit offers land troops: one per hull, KC_CARRIER_BERTHS for the exceptions (2026-10-13, Creatures and Monsters VI:
// the Great Turtles' Island Back carries two), nothing for anything that is not a carrier.
export function carrierBerths(a) {
  return a && CARRIER_TYPES.has(a.type) ? (KC_CARRIER_BERTHS && KC_CARRIER_BERTHS[a.type]) || 1 : 0;
}

// HUMAN — Ride Them Down only works in open country. Light horse need room to run a broken enemy
// down; in woods, jungle or mountains the survivors simply scatter into cover.
export const OPEN_COUNTRY = new Set(['plain', 'desert']);
// ORC — Run Them Down (2026-10-09, Toby item 7): added to each beaten unit's destruction chance when at
// least half the winning force are Warg Riders. Any terrain. (Ride Them Down, for comparison, gives
// +6% per Free Lances unit up to +18%, open country only.)
export const RUN_THEM_DOWN_PCT = 0.15;
export function rideThemDownBonus(force, terrain, cmdr) {
  if (countType(force, 'Free Lances') === 0) return 0;
  // War-Horn of the Plains: the commander's Free Lances always pursue — any terrain, full bonus.
  if (cmdr && hasItemBase(cmdr, 'War-Horn of the Plains')) return 0.18;
  if (!OPEN_COUNTRY.has(terrain)) return 0;
  return Math.min(0.18, 0.06 * countType(force, 'Free Lances'));
}
export function countType(force, type) {
  return (force || []).filter((a) => a && a.type === type).length;
}
// Telekinetic Storm (battle magic) HALVES the effectiveness of a commander's Tactical bonus for the
// battle (it no longer negates it). `_tacticalMult` defaults to 1; the spell sets it to 0.5. We
// halve
// only the bonus ABOVE 1 so the result is always a bonus (never a penalty): ×1.6 → ×1.3, etc.
export function tacMulted(bonus, cmdr) {
  const m = cmdr && cmdr._tacticalMult != null ? cmdr._tacticalMult : 1;
  return 1 + (bonus - 1) * m;
}
// "At least half the units in the force" — the gate on the strongest abilities, so a single
// bolted-on unit can't grant them to an otherwise unrelated stack.
export function isHalfOrMore(force, type) {
  const n = (force || []).length;
  return n > 0 && countType(force, type) * 2 >= n;
}
// DWARF — Shield Fort's gate (2026-10-11, Toby, the unit abilities): at least half the FRONT LINE is
// Dwarven Guard, a Dwarf Garrison counting as Guard (Deep Halls). Without a placed grid (an estimate)
// it reads half the force, as it did before.
export function shieldFortHolds(force, grid) {
  if (grid && Array.isArray(grid.front)) {
    const cells = grid.front.filter(Boolean);
    const n = cells.filter((x) => {
      const t = typeOfX(x);
      return t === 'Dwarven Guard' || t === 'Dwarf Garrison';
    }).length;
    return n > 0 && n * 2 >= cells.length;
  }
  return isHalfOrMore(force, 'Dwarven Guard');
}

// The orc foot that count for Sheer Numbers.
export const ORC_FOOT_TYPES = new Set(['Goblin Horde', 'Orc Berserkers', 'Orc Garrison']);
