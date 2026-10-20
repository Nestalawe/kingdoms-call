import { fullRaceLandRoster } from './world/tables.ts';
import { discProvCoastal } from './discoveries.ts';

// ── GRAND DESIGN ────
// A Wonder stands in the province it was raised in. Its realm-wide blessings flow only while the
// realm that built it still CONTROLS that province: lose the ground and every effect lapses at
// once; retake it
// and they all return, undiminished. The Wonder itself is never destroyed and never changes hands — a
// conqueror who takes the province gains none of its powers, only the view. `align` optionally
// checks the realm's alignment in the same breath, since each Wonder belongs to exactly one
// alignment. Module level so buildPlayerReport (which works from gameState, not the runTurn-scoped
// G) shares it.
export function gdActiveFor(gs, playerIndex, align) {
  const pl = gs && gs.players && gs.players[playerIndex];
  if (!pl) return false;
  if (align && pl.alignment !== align) return false;
  if (!(pl.discoveries || []).some((d) => d && d.id === 'gd')) return false;
  const pid = pl.gdProvinceId;
  if (pid == null) return true; // legacy save raised before Wonders were sited — grandfathered as always-on
  const pv = gs.world && gs.world.provinces && gs.world.provinces[pid];
  return !!pv && pv.owner === playerIndex;
}
export function homeProvinceIdFor(gs, playerIndex) {
  const pl = ((gs && gs.players) || [])[playerIndex];
  if (!pl) return null;
  if (pl.homeProvinceId != null) return pl.homeProvinceId;
  let fallback = pl.provinces && pl.provinces.length && pl.provinces[0] != null ? pl.provinces[0] : null;
  if (fallback == null) {
    const king = (gs.characters || []).find((c) => c.player === playerIndex && c.isKing);
    fallback = king ? king.location : null;
  }
  if (fallback != null) pl.homeProvinceId = fallback; // freeze it from now on
  return fallback;
}
// ── PLAYER MAP CENTRING ────
// Each player's map is therefore rolled horizontally so their founding capital sits in the middle
// column; the wrap seam then falls behind them instead of through their territory. Same world,
// different starting column per player. North-south is untouched — the grid does not wrap that way.
//
// Games saved before this existed have no homeProvinceId, so it is backfilled once, here, and then
// frozen: provinces[0] was seeded with the capital at world gen, and the king's location is the
// last resort. Backfilling from the CURRENT province list would let the centre drift as land
// changes hands, which is exactly what this is meant to prevent. Item 4: who FOUNDED this province
// as their capital (null if nobody). Home-ground bonuses belong only to that player — defending it,
// or attacking to win it back.
export function homeFounderOf(gs, provId) {
  const pls = (gs && gs.players) || [];
  for (let i = 0; i < pls.length; i++) {
    if (pls[i] && homeProvinceIdFor(gs, i) === provId) return i;
  }
  return null;
}

// Neutral trade bonus: +20% of province tax income, rounded down. Exact integer division so the
// end-of-turn collector and the Tax Income forecast can never disagree by a floating-point hair.
export function neutralTradeGold(pl, income) {
  return pl && pl.alignment === 'Neutral' ? Math.floor((income || 0) / 5) : 0;
}

// Existing saves: every king's home province recruits his race's FULL land roster. Idempotent -
// appends any missing land type to the home's armyTypes, keeping fleets and order. Runs at the top
// of every runTurn; a no-op once the roster is complete.
export function backfillHomeRosters(gs) {
  ((gs && gs.players) || []).forEach((pl, pi) => {
    if (!pl) return;
    const hid = homeProvinceIdFor(gs, pi);
    const h = hid != null ? ((gs.world && gs.world.provinces) || [])[hid] : null;
    if (!h || h.terrain === 'sea' || !pl.race || h.race !== pl.race) return;
    if (!Array.isArray(h.armyTypes)) h.armyTypes = [];
    fullRaceLandRoster(pl.race).forEach((u) => {
      if (!h.armyTypes.includes(u)) h.armyTypes.push(u);
    });
    // 2026-09-25 (Toby): a coastal capital always offers its racial fleet — add it to any running
    // game whose home rolled without one.
    const fleet = HOME_FLEET_BY_RACE[pl.race];
    if (fleet && !h.armyTypes.includes(fleet) && typeof discProvCoastal === 'function' && discProvCoastal(gs, h))
      h.armyTypes.push(fleet);
  });
}
export const HOME_FLEET_BY_RACE = {
  Human: 'Galleon Fleet',
  Elven: 'Elven Galleys',
  Dwarven: 'Dwarf Ironclads',
  Orcish: 'Orcish Longships',
};
// 2026-10-15 (Toby, D3): the Corsair Fleet is gone. New worlds stopped offering it on 2026-10-11; a
// province of a game already running whose pool still offers it now offers the Galleon Fleet in its
// place (or simply loses it, if the Galleon is already there). A Corsair company already raised is
// kept and fights as before. Idempotent: runs at the top of every runTurn.
export function retireCorsairPools(gs) {
  ((gs && gs.world && gs.world.provinces) || []).forEach((p) => {
    if (!p || !Array.isArray(p.armyTypes)) return;
    const i = p.armyTypes.indexOf('Corsair Fleet');
    if (i < 0) return;
    if (p.armyTypes.includes('Galleon Fleet')) p.armyTypes = p.armyTypes.filter((t) => t !== 'Corsair Fleet');
    else {
      p.armyTypes[i] = 'Galleon Fleet';
      p.armyTypes = p.armyTypes.filter((t) => t !== 'Corsair Fleet');
    }
  });
}

// Resting place for a fallen MONARCH awaiting Resurrect (item: dead kings resurrectable). The body
// is borne home: it lies in the player's home province while they still hold it, else in their
// wealthiest remaining province. Returns null only if the dynasty holds no land at all (extinct).
// 2026-10-08 (Toby item 1): this is worked out ONCE, when the king dies (handleHeroDeath), and
// stored on the grave. The body then stays there, even if that province is captured later; every
// reader uses the stored `g.location`, so the map, the Resurrect list and the engine always agree.
export function monarchRestProvId(gs, playerIndex) {
  const pl = ((gs && gs.players) || [])[playerIndex];
  if (!pl) return null;
  const owned = (pl.provinces || []).map((id) => ((gs.world && gs.world.provinces) || [])[id]).filter(Boolean);
  if (!owned.length) return null;
  const home = homeProvinceIdFor(gs, playerIndex);
  if (home != null && (pl.provinces || []).includes(home)) return home;
  return owned.reduce((best, pv) => (pv.tax >= (best ? best.tax || 0 : 0) ? pv : best), owned[0]).id;
}
// The column the map should be rolled around, or null to leave the map unshifted.
export function mapCentreColFor(gs, playerIndex) {
  const hid = homeProvinceIdFor(gs, playerIndex);
  if (hid == null) return null;
  const hp = ((gs.world && gs.world.provinces) || [])[hid];
  return hp && hp.col != null ? hp.col : null;
}
