import { KC_QUALITY_DOWN } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import {
  theProvinceNextToAProvinceInADirection,
  theProvincesNextToAProvince,
} from '../rules-on-plain-values/the-hexes-next-to-a-province-on-a-map-that-wraps-east-to-west.ts';
import { QUALITY_TIERS } from '../army-tables.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';
import type { ArmyInABattle } from '../army-tables.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../turn/context.ts';
import type { Province } from '../../schemas/saved-game-state.ts';

// A place on the map: its row and column.
type APlaceOnTheMap = Pick<Province, 'row' | 'col'>;

// The provinces next to a province, from the map's list (the hex step: src/engine/rules-on-plain-values/, P1-11d5).
export function getNeighborsP<P>(
  prov: APlaceOnTheMap,
  cols: number,
  rows: number,
  provinces: readonly (P | null | undefined)[],
): P[] {
  return theProvincesNextToAProvince(prov, cols, rows, provinces);
}

// Raise Wraiths — "Wraith's Touch": if a force contains a wraith, ONE random highest-experience
// enemy unit is PERMANENTLY reduced by one experience tier (written back to the real unit). Fires
// once at the start of a battle, per side that fields a wraith.
export const _WRAITH_DOWN: Readonly<Record<string, string | undefined>> = { ...KC_QUALITY_DOWN };
// a force as Wraith's Touch reads it: a list of units, each maybe missing
type AForce = (ArmyInABattle | null | undefined)[] | null | undefined;
export function applyWraithTouch(friendly: AForce, enemy: AForce, narr: NarrativeLine[] | null | undefined) {
  if (!Array.isArray(friendly) || !Array.isArray(enemy)) return;
  if (!friendly.some((a) => a?._isWraith)) return;
  const tiers = QUALITY_TIERS.slice();
  const dem = enemy.filter((a): a is ArmyInABattle => !!a && tiers.indexOf(a.quality) > 0);
  if (dem.length === 0) return;
  const maxT = Math.max.apply(
    null,
    dem.map((a) => tiers.indexOf(a.quality)),
  );
  const top = dem.filter((a) => tiers.indexOf(a.quality) === maxT);
  const v = top[Math.floor(kcRng() * top.length)];
  if (!v) return; // never met: top holds the units at the highest tier, at least one
  const was = v.quality;
  v.quality = _WRAITH_DOWN[v.quality] ?? v.quality;
  if (narr)
    narrate(narr, {
      kind: "Wraith's Touch withers the enemy's best unit",
      unitName: v.unitName || v.type,
      was,
      quality: v.quality,
    });
}

// PHANTASMAL ARMIES / PHANTOM HOST — illusory duplicates live in ch._phantoms (a SEPARATE store, so
// they never appear in rosters, order dropdowns, wages, give/disband/garrison — all of which read
// ch.armies). They are injected as marked copies into the fighting force only for the duration of a
// battle, then removed.
export const _PH_TIERS = QUALITY_TIERS.slice();
// A spectral double as the Illusory spells store it (a hero's _phantoms): the unit it copies, the tag of the unit it
// mirrors, and `_synced` while a battle's copy has handed its quality back to it.
interface ASpectralDouble {
  type: string;
  quality: string;
  race: string;
  unitName: string;
  _phantomOf: string;
  _synced?: boolean | undefined;
}
// a hero, or a battle's copy of him, as these read him: his units and his doubles, each list maybe missing
interface AHostWithDoubles {
  armies?: (ArmyInABattle | null | undefined)[] | null | undefined;
  _phantoms?: (ASpectralDouble | null | undefined)[] | null | undefined;
}
export function _phBetterQuality(a: string, b: string) {
  return _PH_TIERS.indexOf(a) >= _PH_TIERS.indexOf(b) ? a : b;
}
export function injectPhantoms(ch: AHostWithDoubles | null | undefined, real: AHostWithDoubles | null | undefined) {
  if (!ch || !Array.isArray(ch._phantoms) || ch._phantoms.length === 0 || !Array.isArray(ch.armies)) return;
  const byTag: Record<string, ArmyInABattle | undefined> = {};
  ch.armies.forEach((a) => {
    if (a?._phTag && !a._phantom) byTag[a._phTag] = a;
  });
  // A DOUBLE DIES WITH ITS ORIGINAL. If the true self has been disbanded, given away, left in a
  // garrison, killed, stolen by a Wild Calling or has otherwise left this force, the illusion has
  // nothing left to be an illusion OF — it dissipates and is destroyed, rather than fighting on as
  // a free-standing unit. (This filter is the single choke point: every route out of ch.armies
  // passes it.)
  ch._phantoms = ch._phantoms.filter((ph) => ph && byTag[ph._phantomOf]);
  if (real && real !== ch) real._phantoms = ch._phantoms; // battles run on shallow copies — keep the real store in step
  const armies = ch.armies;
  ch._phantoms.forEach((ph) => {
    if (!ph) return; // never met: the filter above kept only doubles
    const o = byTag[ph._phantomOf];
    if (!o) return; // never met: the filter above kept only doubles whose unit is here
    // Copy is drawn from the CURRENT original, so it mirrors its strength (promotions) and this
    // battle's per-battle buffs (Tactical/War Drum tier-ups, skeletal status) — same strength AND
    // effects. Item 1: the fighting copy is NAMED as a spectral double, so every battle line that
    // names a unit (rosters, archery, magic, casualties, promotions, pursuit) shows which are
    // illusions.
    const _baseNm = o.unitName && o.unitName !== o.type && !o.unitName.startsWith('undefined') ? o.unitName : o.type;
    // a double that earned a promotion in an earlier battle KEEPS it for the rest of the turn. The
    // copy takes the better of its own hard-won quality and its original's current one, so a double
    // never fights worse than the unit it mirrors, and its own experience is not thrown away with
    // the transient fighting copy at the end of each battle.
    const _phQ = _phBetterQuality(ph.quality || o.quality, o.quality);
    const copy: ArmyInABattle = {
      type: o.type,
      quality: _phQ,
      race: o.race,
      unitName: _baseNm + ' (spectral double)',
      _phantom: true,
      _phantomOf: ph._phantomOf,
    };
    if (o._isSkeletal) copy._isSkeletal = true;
    if (o._tacUp) copy._tacUp = true;
    if (o._drumUp) copy._drumUp = true;
    armies.push(copy);
  });
}
export function clearPhantomCopies(
  ch: AHostWithDoubles | null | undefined,
  lost: boolean | null | undefined,
  real: AHostWithDoubles | null | undefined,
) {
  if (!ch) return;
  // harvest each fighting copy's quality back onto its stored double BEFORE the copy is discarded,
  // so promotions earned in this battle persist into the next one this turn.
  const store = real && Array.isArray(real._phantoms) ? real._phantoms : ch._phantoms;
  if (Array.isArray(ch.armies) && Array.isArray(store)) {
    ch.armies.forEach((a) => {
      if (a?._phantom) {
        const rec = store.find((ph) => ph && ph._phantomOf === a._phantomOf && !ph._synced);
        if (rec) {
          rec.quality = _phBetterQuality(a.quality, rec.quality || a.quality);
          rec._synced = true;
        }
      }
    });
    store.forEach((ph) => {
      if (ph) delete ph._synced;
    });
  }
  if (Array.isArray(ch.armies)) ch.armies = ch.armies.filter((a) => !a?._phantom); // remove the transient fighting copies
  // A beaten force loses ALL its phantasmal armies. 2026-09-14: battles are fought on shallow
  // COPIES, so clearing `ch._phantoms` alone only cleared the copy's own property and the real
  // character kept his illusions after a rout. Clear the real character too when one was handed in.
  if (lost) {
    ch._phantoms = [];
    if (real) real._phantoms = [];
  }
}

export function hexDistP(a: APlaceOnTheMap, b: APlaceOnTheMap, cols: number) {
  let dc = Math.abs(a.col - b.col);
  if (cols > 0) dc = Math.min(dc, cols - dc);
  const dr = Math.abs(a.row - b.row);
  return Math.max(dc, dr, (dc + dr) >> 1);
}

// ── LIFTED OUT OF resolveTurn (plan P1-08b) ── a province's name by id, the province a hero stands in, and the
// neighbour in a compass direction. Each takes the turn's context first (src/engine/turn/context.ts).
export function provName(turnContext: TurnContext, id: number) {
  const { G } = turnContext;
  const name = G.world.provinces[id]?.name ?? '';
  return name || 'unknown';
}
export function provOf(turnContext: TurnContext, c: { readonly location: number }) {
  const { G } = turnContext;
  return G.world.provinces[c.location];
}

// The province next to a province in a compass direction (NW, NE, W, E, SW or SE: the hex step, as above).
export function neighborInDir(turnContext: TurnContext, prov: APlaceOnTheMap, dir: string) {
  const { G } = turnContext;
  return theProvinceNextToAProvinceInADirection(prov, dir, G.world.cols, G.world.rows, G.world.provinces);
}
