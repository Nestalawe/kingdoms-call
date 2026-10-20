// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_HEX_DIRS, KC_QUALITY_DOWN } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { QUALITY_TIERS } from '../army-tables.ts';

export function getNeighborsP(prov, cols, rows, provinces) {
  const { row, col } = prov;
  const offsets =
    row % 2 === 0
      ? [
          [-1, -1],
          [-1, 0],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, 0],
          [1, 1],
        ];
  return offsets
    .map(([dr, dc]) => {
      const nr = row + dr;
      if (nr < 0 || nr >= rows) return null;
      const nc = (((col + dc) % cols) + cols) % cols;
      return provinces[nr * cols + nc];
    })
    .filter(Boolean);
}

// Raise Wraiths — "Wraith's Touch": if a force contains a wraith, ONE random highest-experience
// enemy unit is PERMANENTLY reduced by one experience tier (written back to the real unit). Fires
// once at the start of a battle, per side that fields a wraith.
export const _WRAITH_DOWN = { ...KC_QUALITY_DOWN };
export function applyWraithTouch(friendly, enemy, narr) {
  if (!Array.isArray(friendly) || !Array.isArray(enemy)) return;
  if (!friendly.some((a) => a && a._isWraith)) return;
  const tiers = QUALITY_TIERS.slice();
  const dem = enemy.filter((a) => a && tiers.indexOf(a.quality) > 0);
  if (dem.length === 0) return;
  const maxT = Math.max.apply(
    null,
    dem.map((a) => tiers.indexOf(a.quality)),
  );
  const top = dem.filter((a) => tiers.indexOf(a.quality) === maxT);
  const v = top[Math.floor(kcRng() * top.length)];
  const was = v.quality;
  v.quality = _WRAITH_DOWN[v.quality] || v.quality;
  if (narr)
    narr.push(
      `  \u2620 Wraith's Touch withers ${v.unitName || v.type} \u2014 permanently reduced from ${was} to ${v.quality}.`,
    );
}

// PHANTASMAL ARMIES / PHANTOM HOST — illusory duplicates live in ch._phantoms (a SEPARATE store, so
// they never appear in rosters, order dropdowns, wages, give/disband/garrison — all of which read
// ch.armies). They are injected as marked copies into the fighting force only for the duration of a
// battle, then removed.
export const _PH_TIERS = QUALITY_TIERS.slice();
export function _phBetterQuality(a, b) {
  return _PH_TIERS.indexOf(a) >= _PH_TIERS.indexOf(b) ? a : b;
}
export function injectPhantoms(ch, real) {
  if (!ch || !Array.isArray(ch._phantoms) || ch._phantoms.length === 0 || !Array.isArray(ch.armies)) return;
  const byTag = {};
  ch.armies.forEach((a) => {
    if (a && a._phTag && !a._phantom) byTag[a._phTag] = a;
  });
  // A DOUBLE DIES WITH ITS ORIGINAL. If the true self has been disbanded, given away, left in a
  // garrison, killed, stolen by a Wild Calling or has otherwise left this force, the illusion has
  // nothing left to be an illusion OF — it dissipates and is destroyed, rather than fighting on as
  // a free-standing unit. (This filter is the single choke point: every route out of ch.armies
  // passes it.)
  ch._phantoms = ch._phantoms.filter((ph) => ph && byTag[ph._phantomOf]);
  if (real && real !== ch) real._phantoms = ch._phantoms; // battles run on shallow copies — keep the real store in step
  ch._phantoms.forEach((ph) => {
    const o = byTag[ph._phantomOf];
    // Copy is drawn from the CURRENT original, so it mirrors its strength (promotions) and this
    // battle's per-battle buffs (Tactical/War Drum tier-ups, skeletal status) — same strength AND
    // effects. Item 1: the fighting copy is NAMED as a spectral double, so every battle line that
    // names a unit (rosters, archery, magic, casualties, promotions, pursuit) shows which are
    // illusions.
    const _baseNm =
      o.unitName && o.unitName !== o.type && !String(o.unitName).startsWith('undefined') ? o.unitName : o.type;
    // a double that earned a promotion in an earlier battle KEEPS it for the rest of the turn. The
    // copy takes the better of its own hard-won quality and its original's current one, so a double
    // never fights worse than the unit it mirrors, and its own experience is not thrown away with
    // the transient fighting copy at the end of each battle.
    const _phQ = _phBetterQuality(ph.quality || o.quality, o.quality);
    const copy = {
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
    ch.armies.push(copy);
  });
}
export function clearPhantomCopies(ch, lost, real) {
  if (!ch) return;
  // harvest each fighting copy's quality back onto its stored double BEFORE the copy is discarded,
  // so promotions earned in this battle persist into the next one this turn.
  const store = real && Array.isArray(real._phantoms) ? real._phantoms : ch._phantoms;
  if (Array.isArray(ch.armies) && Array.isArray(store)) {
    ch.armies.forEach((a) => {
      if (a && a._phantom) {
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
  if (Array.isArray(ch.armies)) ch.armies = ch.armies.filter((a) => !(a && a._phantom)); // remove the transient fighting copies
  // A beaten force loses ALL its phantasmal armies. 2026-09-14: battles are fought on shallow
  // COPIES, so clearing `ch._phantoms` alone only cleared the copy's own property and the real
  // character kept his illusions after a rout. Clear the real character too when one was handed in.
  if (lost) {
    ch._phantoms = [];
    if (real) real._phantoms = [];
  }
}

export function hexDistP(a, b, cols) {
  let dc = Math.abs(a.col - b.col);
  if (cols > 0) dc = Math.min(dc, cols - dc);
  const dr = Math.abs(a.row - b.row);
  return Math.max(dc, dr, (dc + dr) >> 1);
}

// ── LIFTED OUT OF resolveTurn (plan P1-08b) ── a province's name by id, the province a hero stands in, and the
// neighbour in a compass direction. Each takes the turn's context first (src/engine/turn/context.ts).
export function provName(turnContext, id) {
  const { G } = turnContext;
  return G.world.provinces[id]?.name || 'unknown';
}
export function provOf(turnContext, c) {
  const { G } = turnContext;
  return G.world.provinces[c.location];
}

// Direction → neighbor lookup
export const HEX_DIRS = KC_HEX_DIRS.slice();
export function neighborInDir(turnContext, prov, dir) {
  const { G } = turnContext;
  const { row, col } = prov;
  const cols = G.world.cols,
    rows = G.world.rows;
  const even = [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ];
  const odd = [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  const idx = HEX_DIRS.indexOf(dir);
  if (idx < 0) return null;
  const [dr, dc] = (row % 2 === 0 ? even : odd)[idx];
  const nr = row + dr;
  if (nr < 0 || nr >= rows) return null;
  const nc = (((col + dc) % cols) + cols) % cols;
  return G.world.provinces[nr * cols + nc];
}
