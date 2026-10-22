// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { homeProvinceIdFor } from '../grand-design.ts';
import { spotEnemyInOwnedProvince } from '../heroes/fame-and-consecration.ts';
import { featDiscovered } from '../../views/visibility.ts';
import { getNeighborsP } from './map-helpers.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { refreshMovePool } from '../units/movement-pools.ts';
import { SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { emit } from '../turn/events-and-their-audiences.ts';

// ── PROVINCE BOOKKEEPING AND RALLIED GARRISONS (plan P1-08i1: lifted out of resolveTurn) ────
// Once a contest ends, the garrison troops a defending hero rallied go home or stay with him (settleRalliedGarrisons).
// The provinces a realm's characters entered this phase (noteEntered, into the context's enteredThisPhase, which
// resolveTurn empties at each phase's start and end), each province's list of characters rebuilt from where they stand
// (reconcileProvinceCharacters), and each realm's memory of the provinces it can see (updateProvinceMemory). They take
// the turn's context first (src/engine/turn/context.ts).
// ── Settle rallied garrisons once a contest ends ── Units folded into a defending hero during a
// contested defence carry a _garrisonOf marker naming their home province. Called after every
// stalled-battle resolution pass: for each such unit, once the home province is no longer
// contested, decide its fate by the FINAL result of the whole fight —
// • the hero WON and still holds the province → the troops RETURN to garrison it; or
// • the hero lost / retreated / fell → the troops have "joined the hero" and stay with him
// (they retreated at his side), so we simply drop the marker.
// While the province is still contested (_battleUnresolved) the marker is left in place and the
// unit keeps fighting as part of the hero's host.
export function settleRalliedGarrisons(turnContext) {
  const { G } = turnContext;
  const _returnedByProv = {}; // provId -> count, for a clean grouped log
  (G.characters || []).forEach((c) => {
    if (!c || !Array.isArray(c.armies) || c.armies.length === 0) return;
    const marked = c.armies.filter((a) => a && a._garrisonOf != null);
    if (marked.length === 0) return;
    let changed = false;
    marked.forEach((a) => {
      const homeId = a._garrisonOf;
      const home = G.world.provinces[homeId];
      if (!home) {
        delete a._garrisonOf;
        changed = true;
        return;
      }
      if (home._battleUnresolved) return; // still contested — fight on with the hero
      if (c.alive && c.location === homeId && home.owner === c.player) {
        // WON and held: the troops fall back into garrison duty in the province they defended.
        delete a._garrisonOf;
        c.armies = c.armies.filter((x) => x !== a);
        home.garrisonArmies = (home.garrisonArmies || []).concat(a);
        _returnedByProv[homeId] = (_returnedByProv[homeId] || 0) + 1;
        changed = true;
      } else {
        // The hero left the province (retreated with them) or lost it — they stay in his host
        // now.
        delete a._garrisonOf;
        changed = true;
      }
    });
    if (changed && typeof refreshMovePool === 'function') refreshMovePool(turnContext, c);
  });
  Object.keys(_returnedByProv).forEach((pid) => {
    const prov = G.world.provinces[pid];
    if (!prov) return;
    const n = _returnedByProv[pid];
    emit(turnContext, {
      type: 'combat',
      text: `🛡 With ${prov.name} held, its standing troops (${n} unit${n !== 1 ? 's' : ''}) resume their post as the garrison.`,
      audience: { actor: prov.owner, realms: [prov.owner].filter((x) => x != null), seen: 'battle' },
      province: prov.id,
    });
  });
}

export const noteEntered = (turnContext, pi, provId) => {
  if (pi == null || provId == null) return;
  (turnContext.enteredThisPhase[pi] = turnContext.enteredThisPhase[pi] || new Set()).add(provId);
};

// ── province.characters is DERIVED STATE — rebuild it, never trust it ── Every province carries
// a `characters` array of ids, and roughly fifteen sites across the engine maintain it by hand
// alongside `character.location`. Any path that updates one and not the other desyncs the two,
// and the map renderer reads the ARRAY while visibility reads the LOCATION — so a desync makes a
// character vanish from the map while the province still counts as occupied.
//
// That is exactly what happened after a contested battle: combatVsNPC and combatVsChar fight on
// shallow COPIES and decide the attacker's fate on the copy, and the callers propagate the copy's
// `location` back to the real character WITHOUT touching either province's `characters` array.
// The character ended up listed in the province they had left and missing from the one they were
// in.
//
// Rather than patch each site (and wait for the next one to drift), `location` is now the single
// source of truth and this pass rebuilds every array from it. Cheap, total, and it retires the
// whole class of bug.
export function reconcileProvinceCharacters(turnContext) {
  const { G } = turnContext;
  // The DEAD are kept, at the location they fell. Nothing previously removed a corpse from this
  // array and one reader (the GM's province panel) lists ids without an alive check, so dropping
  // them here would quietly delete bodies from the map. Readers that want only the living already
  // filter for themselves.
  const byProv = new Map();
  (G.characters || []).forEach((c) => {
    if (!c || c.location == null) return;
    if (!byProv.has(c.location)) byProv.set(c.location, []);
    byProv.get(c.location).push(c.id);
  });
  (G.world.provinces || []).forEach((pv) => {
    if (!pv) return;
    pv.characters = byProv.get(pv.id) || [];
  });
}

// per-player province memory. Called at the end of each phase — snapshots the observable state of
// every province a player can currently see (owned, occupied, their neighbours, or spied that
// phase) into player._provMemory. Latest observation wins, so the map shows phase-accurate "last
// seen" info: a player only learns of changes made while they can actually see the province.
export function updateProvinceMemory(turnContext, ph) {
  const { G, turnLog, clairWatch } = turnContext;
  const cols = G.world.cols,
    rows = G.world.rows;
  const spiedThisPhase = {}; // player index -> Set(provinceId)
  turnLog.forEach((e) => {
    if (e.spy && e.actor != null && e.provinceId != null && e.phase === ph) {
      (spiedThisPhase[e.actor] = spiedThisPhase[e.actor] || new Set()).add(e.provinceId);
    }
  });
  G.players.forEach((pl, pi) => {
    if (!pl._provMemory) pl._provMemory = {};
    // Core: provinces this player owns or currently occupies.
    const core = new Set();
    (G.world.provinces || []).forEach((pv) => {
      if (pv && pv.owner === pi) core.add(pv.id);
    });
    (G.characters || []).forEach((c) => {
      if (c.player === pi && c.alive && c.location != null) core.add(c.location);
    });
    // Observed = core + their neighbours + anything spied this phase.
    const observed = new Set(core);
    core.forEach((pid) => {
      const pv = G.world.provinces[pid];
      if (!pv) return;
      getNeighborsP(pv, cols, rows, G.world.provinces).forEach((n) => {
        if (n) observed.add(n.id);
      });
    });
    (spiedThisPhase[pi] || []).forEach((id) => observed.add(id));
    // CLAIRVOYANCE — from the cast phase on, the watched character's province is observed each
    // phase (so the map keeps the hex) and they are recorded as seen there (Clairvoyance can
    // re-target).
    {
      const _w = clairWatch[pi];
      if (_w && _w.charId != null && ph >= (_w.fromPhase || 0)) {
        const _wc = (G.characters || []).find((x) => x && x.id === _w.charId);
        if (_wc && _wc.alive && _wc.location != null && _wc.player !== pi) {
          observed.add(_wc.location);
          const _wp = G.world.provinces[_wc.location];
          if (!pl.seenCharIntel) pl.seenCharIntel = {};
          pl.seenCharIntel[_wc.id] = {
            id: _wc.id,
            name: _wc.name,
            isKing: !!_wc.isKing,
            race: _wc.race,
            alignment: _wc.alignment,
            player: _wc.player,
            isWandering: _wc.player === null,
            lastSeenTurn: G.turn,
            lastLocId: _wc.location,
            lastLocName: _wp ? _wp.name : '?',
          };
        }
      }
    }
    // ── Character sightings ── Any living character standing in a province this player owns or
    // occupies right now is recorded into a persistent per-player intel record. Clairvoyance
    // targets "any character seen at any point in the game" — this is that record.
    if (!pl.seenCharIntel) pl.seenCharIntel = {};
    (G.characters || []).forEach((sc) => {
      if (!sc.alive || sc.player === pi || sc.location == null) return;
      if (!core.has(sc.location)) return;
      const sp = G.world.provinces[sc.location];
      pl.seenCharIntel[sc.id] = {
        id: sc.id,
        name: sc.name,
        isKing: !!sc.isKing,
        race: sc.race,
        alignment: sc.alignment,
        player: sc.player,
        isWandering: sc.player === null,
        lastSeenTurn: G.turn,
        lastLocId: sc.location,
        lastLocName: sp ? sp.name : '?',
      };
    });
    // ── SPY EXPERIENCE (2026-09-21, Toby): spotting a hidden enemy in your own land. ──
    // A lone enemy (at war, leading no column, not Invisible, with Spy 1+ to hide by) standing in a
    // province this realm owns is "spotted" by the realm's character standing there — or, if none
    // is, by the realm's watchers in neighbouring owned provinces when the ordinary Spy contest
    // (spotEnemyInOwnedProvince) finds him. The best Spy among the spotters rolls for Spy, once per
    // lurker per turn.
    (G.characters || []).forEach((sc) => {
      if (!sc || !sc.alive || sc.player == null || sc.player === pi || sc.location == null) return;
      if ((sc.armies || []).length > 0 || sc._invisTurn === G.turn || ((sc.skills || {}).spy || 0) < 1) return;
      const sp = G.world.provinces[sc.location];
      if (!sp || sp.owner !== pi || !areEnemies(turnContext, pi, sc.player)) return;
      let watchers = (G.characters || []).filter((w) => w && w.alive && w.player === pi && w.location === sp.id);
      if (!watchers.length) {
        if (!spotEnemyInOwnedProvince(G, pi, sp, sc)) return;
        const _nb = new Set(
          getNeighborsP(sp, cols, rows, G.world.provinces)
            .filter((n) => n && n.owner === pi)
            .map((n) => n.id),
        );
        watchers = (G.characters || []).filter((w) => w && w.alive && w.player === pi && _nb.has(w.location));
      }
      if (!watchers.length) return;
      const best = watchers.reduce((a, b) => (((b.skills || {}).spy || 0) > ((a.skills || {}).spy || 0) ? b : a));
      if (!best._spySpotted || best._spySpotted.turn !== G.turn) best._spySpotted = { turn: G.turn, ids: [] };
      if (best._spySpotted.ids.includes(sc.id)) return;
      best._spySpotted.ids.push(sc.id);
      const _prevCtx = turnContext._logCtx;
      turnContext._logCtx = { charId: best.id, phase: ph };
      try {
        trySkillGain(turnContext, best, 'spy', SKILLGAIN_STD);
      } finally {
        turnContext._logCtx = _prevCtx;
      }
    });
    // Provinces entered this phase — and their neighbours — even if the character was thrown back
    // out again. Marching in and being repelled still buys you the same look at the country that
    // walking in unopposed would have: you learn the province and what borders it.
    (turnContext.enteredThisPhase[pi] || []).forEach((pid) => {
      observed.add(pid);
      const pv = G.world.provinces[pid];
      if (!pv) return;
      getNeighborsP(pv, cols, rows, G.world.provinces).forEach((n) => {
        if (n) observed.add(n.id);
      });
    });
    // Snapshot each observed province's current observable state (frozen at this phase).
    observed.forEach((pid) => {
      const pv = G.world.provinces[pid];
      if (!pv) return;
      pl._provMemory[pid] = {
        turn: G.turn,
        phase: ph,
        name: pv.name,
        terrain: pv.terrain,
        race: pv.race,
        tax: pv.tax,
        armyTypes: (pv.armyTypes || []).slice(),
        // Retain ritualSite (and guardian power) so a REMEMBERED province keeps its moon icon and
        // popup listing once discovered — a discovered ritual site must stay on the map from then
        // on, regardless of who later owns the ground.
        features: (pv.features || [])
          .filter((f) => featDiscovered(f, pi))
          .map((f) => ({
            name: f.name,
            cleared: !!f.cleared,
            ritualSite: !!f.ritualSite,
            power: (f.monster && f.monster.power) || '',
          })),
        owner: pv.owner,
        ownerName: pv.owner != null ? G.players[pv.owner]?.name : null,
        ownerColor: pv.owner != null ? G.players[pv.owner]?.color : null,
        // A realm's seat can MOVE (conquest, a new capital). Snapshot it with everything else so
        // a remembered hex shows the crown exactly as it stood when last observed.
        isHomeCapitalOfOwner: pv.owner != null && homeProvinceIdFor(G, pv.owner) === pv.id,
      };
    });
    // ── DIPLOMACY ENCOUNTER TRACKING ── Seeing another player's PROVINCE (any observed province
    // they own) or CHARACTER (recorded in seenCharIntel this phase) counts as encountering that
    // realm. Only encountered realms may be treated with. The set is persistent (part of G) and
    // grows.
    if (!pl._encountered) pl._encountered = [];
    const _meet = (otherPi) => {
      if (otherPi != null && otherPi !== pi && !pl._encountered.includes(otherPi)) pl._encountered.push(otherPi);
    };
    observed.forEach((pid) => {
      const pv = G.world.provinces[pid];
      if (pv && pv.owner != null) _meet(pv.owner);
    });
    Object.values(pl.seenCharIntel || {}).forEach((ci) => {
      if (ci && ci.player != null) _meet(ci.player);
    });
  });
}
