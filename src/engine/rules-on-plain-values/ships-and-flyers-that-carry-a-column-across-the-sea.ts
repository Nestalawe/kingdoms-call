// ── The ships and flyers that carry a column across the sea (plan P1-11b4) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). Whether a column can put to sea was getSeaCapability's body (src/engine/units/movement-pools.ts,
// which keeps it as a wrapper that works out the leader's naval mastery); the player portal's Move notice
// (poSeaAnalysis) restated it with the figures it explains itself by. Both now ask seaLiftOfAColumn.
import { KC_CARRIER_BERTHS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import {
  AERIAL_TYPES,
  CARRIER_TYPES,
  FLYING_TYPES,
  SEA_TYPES,
  getFlyCapability,
  isAirCarriable,
  type UnitOfAType,
} from './units-that-fly-sail-or-can-be-carried-through-the-air.ts';

/** The berths each carrier offers where it isn't one (2026-10-13, Creatures and Monsters VI: the Great Turtles). */
const BERTHS_OF_A_CARRIER: Readonly<Partial<Record<string, number>>> = KC_CARRIER_BERTHS;
// Berths a unit offers land troops: one per hull, KC_CARRIER_BERTHS for the exceptions (2026-10-13, Creatures and Monsters VI:
// the Great Turtles' Island Back carries two), nothing for anything that is not a carrier.
export function carrierBerths(a: UnitOfAType | null | undefined): number {
  return a && CARRIER_TYPES.has(a.type) ? (BERTHS_OF_A_CARRIER[a.type] ?? 1) : 0;
}

// Fleet capacity: light foot = 0.5 capacity (2 per hull), heavy/cavalry/siege/beast = 1 per hull
const LIGHT_ARMIES = new Set(KC_UNIT_CLASS.lightFoot); // gun-crews ride as light foot — an Ironclad ferries a Gun + a Guard
/** Whether a unit takes half a hull aboard ship (light foot), not a whole one. */
export function takesHalfAHullAboard(a: UnitOfAType): boolean {
  return LIGHT_ARMIES.has(a.type);
}

/** Whether a column can put to sea: 'all' (nothing to carry: no unit, or every one sails or flies on its own), 'sea'
 *  (its hulls and flyers lift every land unit), 'land' (it can't). */
export type PuttingToSea = 'all' | 'sea' | 'land';
/** A column's sea lift: the answer, and the figures it comes from. */
export interface AColumnsSeaLift<U extends UnitOfAType> {
  readonly answer: PuttingToSea;
  /** The berths its carriers offer (a turtle two, any other carrier one; a sea beast none). */
  readonly berths: number;
  /** The berths with the leader's naval mastery (Naval 8: each carries double). */
  readonly berthsUnderItsLeader: number;
  /** Its units that neither fly nor sail. */
  readonly landUnits: number;
  /** Its land units no flyer can lift (cavalry, siege, walking beasts), which must go aboard; 0 unless the hulls are
   *  loaded (the answer is neither 'all' nor the flyers' lift). */
  readonly unitsThatMustSail: number;
  /** Its humanoid flyers: each lifts one unit the hulls have no room for. */
  readonly humanoidFlyers: number;
  /** Whether its flyers lift the whole column, so it crosses the sea as a flying host (getFlyCapability). */
  readonly flyersLiftTheWholeColumn: boolean;
  /** The hulls' room left once loaded (below 0: the units that must sail don't fit); every berth if none was loaded. */
  readonly roomLeft: number;
  /** The units left ashore when the answer is 'land': the units that must sail and have no berth, the heaviest first;
   *  else the units neither hull nor flyer can take. */
  readonly unitsLeftAshore: readonly U[];
}

/** Whether `column` can put to sea, and why: its hulls (doubled when `hullsCarryDouble`, the leader's Naval 8) and its
 *  humanoid flyers pool their lift. `takesHalfAHull` says which units take half a hull (light foot; the player
 *  portal adds the units it can't type in advance). */
export function seaLiftOfAColumn<U extends UnitOfAType>(
  column: readonly (U | null | undefined)[] | null | undefined,
  hullsCarryDouble: boolean,
  takesHalfAHull: (a: U) => boolean = takesHalfAHullAboard,
): AColumnsSeaLift<U> {
  // spectral doubles are illusions — they weigh nothing, need no berth and no griffon, and are
  // never counted against a force's lift. (They normally live outside ch.armies entirely; this
  // guards the case where a fighting copy is still attached mid-phase.)
  const armies = (column ?? []).filter((a): a is U => !!a && !a._phantom);
  const landArmies = armies.filter((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type));
  // Only CARRIERS provide capacity. Primal sea beasts swim themselves across but carry nothing,
  // so they contribute 0 — a force of one Kraken plus one Goblin Horde still cannot put to sea.
  const seaCount = armies.reduce((s, a) => s + carrierBerths(a), 0); // berths, not hulls: a turtle offers two (Island Back)
  let hullCap = seaCount;
  if (hullsCarryDouble) hullCap *= 2; // NAVAL L8: one naval hull carries what once needed two
  const flyerLift = armies.filter((a) => FLYING_TYPES.has(a.type)).length; // humanoid flyers: one unit each
  const lifted = getFlyCapability(armies);
  const lift = (
    answer: PuttingToSea,
    room: number,
    mustSail: number,
    leftAshore: readonly U[],
  ): AColumnsSeaLift<U> => ({
    answer,
    berths: seaCount,
    berthsUnderItsLeader: hullCap,
    landUnits: landArmies.length,
    unitsThatMustSail: mustSail,
    humanoidFlyers: flyerLift,
    flyersLiftTheWholeColumn: lifted,
    roomLeft: room,
    unitsLeftAshore: leftAshore,
  });
  if (armies.length === 0) return lift('all', hullCap, 0, []);
  if (landArmies.length === 0) return lift('all', hullCap, 0, []); // only flying/sea
  // if the humanoid flyers can lift every foot soldier, the whole column takes to the air and
  // crosses sea without a fleet — just like an all-flying host.
  if (lifted) return lift('sea', hullCap, 0, []);
  // HULLS AND FLYERS POOL THEIR LIFT. Now:
  // • units a flyer cannot lift (cavalry, siege, walking creatures/monsters) MUST go aboard ship;
  // • everything a flyer CAN lift rides a hull if there is room, else is carried by one humanoid
  // flyer apiece (primal winged beasts still carry nothing);
  // • the shortfall is what the flyers must cover, so hulls + flyers together decide the question.
  const _capOf = (a: U) => (takesHalfAHull(a) ? 0.5 : 1); // light foot take half a hull, everything else a full one
  const _mustSail = landArmies.filter((a) => !isAirCarriable(a)); // horses, siege, beasts — ship or nothing
  const _liftable = landArmies.filter((a) => isAirCarriable(a)); // humanoid foot — ship OR air
  let _room = hullCap - _mustSail.reduce((s, a) => s + _capOf(a), 0);
  if (_room < 0) {
    // no berth for the unliftable — stay ashore. The ship-only units without a berth, the heaviest first.
    const _ashore: U[] = [];
    let _over = -_room;
    for (const a of _mustSail.slice().sort((a, b) => _capOf(b) - _capOf(a))) {
      if (_over <= 0) break;
      _ashore.push(a);
      _over -= _capOf(a);
    }
    return lift('land', _room, _mustSail.length, _ashore);
  }
  // Fill the remaining berths with the LIGHTEST liftable units first: that puts the most bodies
  // aboard and so leaves the fewest for the flyers (a flyer lifts one unit whatever its weight).
  const _byAir: U[] = [];
  _liftable
    .slice()
    .sort((a, b) => _capOf(a) - _capOf(b))
    .forEach((a) => {
      const _c = _capOf(a);
      if (_room >= _c) _room -= _c;
      else _byAir.push(a);
    });
  if (_byAir.length <= flyerLift) return lift('sea', _room, _mustSail.length, []);
  return lift('land', _room, _mustSail.length, _byAir.slice(flyerLift));
}
