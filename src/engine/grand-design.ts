// The game's state as these functions read it: the turn's, a report's or the GM page's, or an older save's, so a
// realm, a province, a field or a list may be missing (the guards below say so). Today's GameState passes.
interface RealmAsTheseRead {
  alignment?: string | undefined;
  discoveries?: readonly ({ readonly id?: string | undefined } | null | undefined)[] | null | undefined;
  // the province its Wonder was raised in (the Grand Design order; a Wonder raised before they were sited has none)
  gdProvinceId?: number | null | undefined;
  homeProvinceId?: number | null | undefined;
  provinces?: readonly number[] | null | undefined;
}
interface ProvinceAsTheseRead {
  readonly id: number;
  readonly owner?: number | null | undefined;
  readonly tax: number;
  readonly col?: number | null | undefined;
  armyTypes?: string[] | null | undefined;
}
// a realm's monarch, and where he stands
interface HeroAsTheseRead {
  readonly player: number | null;
  readonly isKing: boolean;
  readonly location: number;
}
interface StateAsTheseRead {
  readonly players?: readonly (RealmAsTheseRead | null | undefined)[] | null | undefined;
  readonly world?:
    { readonly provinces?: readonly (ProvinceAsTheseRead | null | undefined)[] | null | undefined } | null | undefined;
  readonly characters?: readonly HeroAsTheseRead[] | null | undefined;
}
const isAProvince = (p: ProvinceAsTheseRead | null | undefined): p is ProvinceAsTheseRead => Boolean(p);

// ── GRAND DESIGN ────
// A Wonder stands in the province it was raised in. Its realm-wide blessings flow only while the
// realm that built it still CONTROLS that province: lose the ground and every effect lapses at
// once; retake it
// and they all return, undiminished. The Wonder itself is never destroyed and never changes hands — a
// conqueror who takes the province gains none of its powers, only the view. `align` optionally
// checks the realm's alignment in the same breath, since each Wonder belongs to exactly one
// alignment. Module level so buildPlayerReport (which works from gameState, not the runTurn-scoped
// G) shares it.
export function gdActiveFor(
  gs: StateAsTheseRead | null | undefined,
  playerIndex: number,
  align: string | null | undefined,
) {
  const pl = gs?.players?.[playerIndex];
  if (!pl) return false;
  if (align && pl.alignment !== align) return false;
  if (!(pl.discoveries ?? []).some((d) => d?.id === 'gd')) return false;
  const pid = pl.gdProvinceId;
  if (pid == null) return true; // legacy save raised before Wonders were sited — grandfathered as always-on
  const pv = gs.world?.provinces?.[pid];
  return !!pv && pv.owner === playerIndex;
}
export function homeProvinceIdFor(gs: StateAsTheseRead | null | undefined, playerIndex: number) {
  const pl = (gs?.players ?? [])[playerIndex];
  if (!pl) return null;
  if (pl.homeProvinceId != null) return pl.homeProvinceId;
  let fallback = pl.provinces?.length && pl.provinces[0] != null ? pl.provinces[0] : null;
  if (fallback == null) {
    const king = (gs?.characters ?? []).find((c) => c.player === playerIndex && c.isKing);
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
export function homeFounderOf(gs: StateAsTheseRead | null | undefined, provId: number) {
  const pls = gs?.players ?? [];
  for (let i = 0; i < pls.length; i++) {
    if (pls[i] && homeProvinceIdFor(gs, i) === provId) return i;
  }
  return null;
}

// Neutral trade bonus: +20% of province tax income, rounded down. Exact integer division so the
// end-of-turn collector and the Tax Income forecast can never disagree by a floating-point hair.
export function neutralTradeGold(
  pl: Pick<RealmAsTheseRead, 'alignment'> | null | undefined,
  income: number | null | undefined,
) {
  return pl?.alignment === 'Neutral' ? Math.floor((Number(income) || 0) / 5) : 0;
}

export const HOME_FLEET_BY_RACE: Readonly<Record<string, string | undefined>> = {
  Human: 'Galleon Fleet',
  Elven: 'Elven Galleys',
  Dwarven: 'Dwarf Ironclads',
  Orcish: 'Orcish Longships',
};
// 2026-10-15 (Toby, D3): the Corsair Fleet is gone. New worlds stopped offering it on 2026-10-11; a
// province of a game already running whose pool still offers it now offers the Galleon Fleet in its
// place (or simply loses it, if the Galleon is already there). A Corsair company already raised is
// kept and fights as before. Idempotent: runs at the top of every runTurn.
export function retireCorsairPools(gs: StateAsTheseRead | null | undefined) {
  (gs?.world?.provinces ?? []).forEach((p) => {
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
export function monarchRestProvId(gs: StateAsTheseRead | null | undefined, playerIndex: number) {
  const pl = (gs?.players ?? [])[playerIndex];
  if (!pl) return null;
  const owned = (pl.provinces ?? []).map((id) => (gs?.world?.provinces ?? [])[id]).filter(isAProvince);
  const first = owned[0]; // owned holds provinces only, so it has a first exactly when it isn't empty
  if (!first) return null;
  const home = homeProvinceIdFor(gs, playerIndex);
  if (home != null && (pl.provinces ?? []).includes(home)) return home;
  return owned.reduce((best, pv) => (pv.tax >= (best.tax || 0) ? pv : best), first).id;
}
// The column the map should be rolled around, or null to leave the map unshifted.
export function mapCentreColFor(gs: StateAsTheseRead | null | undefined, playerIndex: number) {
  const hid = homeProvinceIdFor(gs, playerIndex);
  if (hid == null) return null;
  const hp = (gs?.world?.provinces ?? [])[hid];
  return hp?.col ?? null;
}
