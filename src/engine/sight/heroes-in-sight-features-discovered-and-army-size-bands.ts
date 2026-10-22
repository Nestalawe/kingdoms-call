// ── THE SIGHT RULES (plan P1-12b1: moved from src/views/visibility.ts) ────
// Who sees another realm's hero where he stands, the provinces next to a spied one, a host's size at a glance, why a
// seen hero can't be encountered, and which realm knows a province's feature. Pure: the engine asks them as it resolves
// (the bots, Move, Explore, world generation, a spy's findings, the warnings, the report's filter), and perception in
// src/views applies them. The engine may not import src/views, so they live here, in one copy.
import { relOfReport, spotEnemyInOwnedProvince } from '../heroes/fame-and-consecration.ts';
import { activeItems } from '../items/equipment.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import type { Character, GameState, ProvinceFeature } from '../../schemas/saved-game-state.ts';

// ── Items 1 & 12: ONE visibility rule for non-own characters ────
// (the map's Spy-contest vs the list's flat cloak). Every consumer now calls this.
// ctx: {ownedProvIds:Set, ownCharLocs:Set, spiedThisTurn:Set, nearSpied?:Set} — all keyed by province id.
// Returns true when viewer `viewerPi` can see character `c` where it stands right now.
export interface SightContext {
  ownedProvIds: Set<number>;
  ownCharLocs: Set<number>;
  spiedThisTurn: Set<number>;
  nearSpied?: Set<number> | undefined;
}
// 2026-10-15 (Toby, D2): the provinces next to those spied this turn (not the spied ones themselves).
export function nearSpiedProvIds(gs: GameState, spiedIds: Set<number>) {
  const out = new Set<number>(),
    W = gs.world,
    P = W.provinces || [];
  spiedIds.forEach((id) => {
    const p = P[id];
    if (!p) return;
    getNeighborsP(p, W.cols, W.rows, P).forEach((n) => {
      if (n && !spiedIds.has(n.id)) out.add(n.id);
    });
  });
  return out;
}
// 2026-10-15 (Toby, D1): how big a force a hero you have not spied leads, as a glance across the field
// gives it — never the exact count. One wording for the map, the hero sightings and the intrusion alerts.
export function armySizeBand(n: number) {
  return n <= 0
    ? 'no armies'
    : n <= 2
      ? 'a small escort (a few units)'
      : n <= 5
        ? 'a modest band'
        : n <= 9
          ? 'a sizeable host'
          : n <= 15
            ? 'a large host'
            : 'a vast host';
}
export function enemyCharVisibleTo(
  gs: GameState,
  viewerPi: number,
  c: Character | null | undefined,
  ctx: SightContext,
) {
  if (!c || !c.alive) return false;
  if (c.player === viewerPi) return true;
  const p = gs.world.provinces[c.location];
  if (!p) return false;
  // a character this realm watches with Clairvoyance is seen wherever they stand — as if spied on —
  // and, unlike a Spy, the mind-link pierces Invisibility and every stealth cloak.
  {
    const _vp = gs.players && gs.players[viewerPi];
    if (_vp && _vp._clairCharThisTurn != null && _vp._clairCharThisTurn === c.id) return true;
  }
  // 2026-10-15 (Toby, D2): a province next to one spied this turn is seen as if a hero of yours stood there.
  const coLoc = ctx.ownCharLocs.has(p.id) || !!(ctx.nearSpied && ctx.nearSpied.has(p.id)),
    ownHere = ctx.ownedProvIds.has(p.id),
    spied = ctx.spiedThisTurn.has(p.id);
  if (!coLoc && !ownHere && !spied) return false; // no line of sight at all
  if (c._invisTurn === gs.turn) return false; // Invisibility beats even a spy
  if (spied) return true; // a deliberate Spy pierces stealth
  // 2026-10-15 (Toby, D1): another realm's hero beside one of yours at the end of the turn is always
  // seen; their Spy cannot slip them past your hero (only Invisibility, above, still can). Wandering
  // heroes and local chieftains keep their small chance to slip by (the cloak below).
  if (coLoc && c.player != null) return true;
  const isEnemy = c.player != null && relOfReport(gs, viewerPi, c.player) === 'enemy';
  if (isEnemy && ownHere && !coLoc) {
    // Lurking in land you own with none of your characters present: Spy contest (a column can't
    // hide).
    if ((c.armies || []).length > 0) return true;
    return spotEnemyInOwnedProvince(gs, viewerPi, p, c);
  }
  if (c.player == null || !ownHere) {
    if (c._unspottedTurn === gs.turn) return false; // flat unspotted cloak
  }
  return true;
}
// Why a VISIBLE character still cannot be the target of an Encounter Character order (null = can).
export function encounterUntargetableReason(c: Character | null | undefined) {
  if (c && activeItems(c).some((it) => it && it.effect && it.effect.stat === 'hidden')) return 'faceless';
  return null;
}

// ── Per-player feature discovery ────
// f.discovered remains the engine-internal "discovered by ANYONE" flag; player-facing views must
// instead ask featDiscovered(f, playerIndex). Legacy saves (features with discovered:true but no
// discoveredBy array) are grandfathered as visible to everyone who could already see them
// (_legacyAll), so upgrading mid-game never takes knowledge away from a player.
export function featDiscovered(f: ProvinceFeature | null | undefined, pi: number | null | undefined) {
  if (!f) return false;
  if (pi == null) return !!f.discovered; // engine-internal: anyone
  if (f._legacyAll) return true; // pre-upgrade discovery: everyone keeps it
  if (Array.isArray(f.discoveredBy)) return f.discoveredBy.includes(pi);
  return !!f.discovered; // legacy save, array never created yet
}
export function discoverFeat(f: ProvinceFeature | null | undefined, pi: number | null | undefined) {
  if (!f) return false;
  const wasKnown = featDiscovered(f, pi);
  if (pi != null) {
    if (!Array.isArray(f.discoveredBy)) {
      if (f.discovered) f._legacyAll = true; // grandfather old-save global discovery
      f.discoveredBy = [];
    }
    if (!f.discoveredBy.includes(pi)) f.discoveredBy.push(pi);
  }
  f.discovered = true;
  return !wasKnown;
}
