import { homeProvinceIdFor } from '../grand-design.ts';
import { spotEnemyInOwnedProvince } from '../heroes/fame-and-consecration.ts';
import { featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { getNeighborsP } from './map-helpers.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { refreshMovePool } from '../units/movement-pools.ts';
import { SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { Army, Character, Province, Realm } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';

// Its types (plan P1-10b32): each parameter typed from what its callers pass and as wide as the body's guards (plan
// P1-10's Decision 2), so each guard stays.
/** A province as a realm remembers it, as the code writes it: the name and colour of a realm its owner's index names
 *  none of are left undefined, as JavaScript reads them. */
type AProvinceAsItIsRemembered = Omit<NonNullable<Realm['_provMemory']>[string], 'ownerName' | 'ownerColor'> & {
  ownerName: string | null | undefined;
  ownerColor: string | null | undefined;
};
/** A hero a realm has seen, as its record holds him. */
type AHeroAsARealmHasSeenHim = NonNullable<Realm['seenCharIntel']>[string];

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
export function settleRalliedGarrisons(turnContext: TurnContext): void {
  const { G } = turnContext;
  const _returnedByProv: Partial<Record<string, number>> = {}; // provId -> count, for a clean grouped log
  (asItsGuardReadsIt(G.characters) ?? []).forEach((c: Character | null | undefined) => {
    if (!c || !Array.isArray(asItsGuardReadsIt(c.armies)) || c.armies.length === 0) return;
    const marked = c.armies.filter((a: Army | null | undefined) => a?._garrisonOf != null);
    if (marked.length === 0) return;
    let changed = false;
    for (const a of marked) {
      const homeId = a._garrisonOf;
      const home = homeId === undefined ? undefined : G.world.provinces[homeId];
      if (!home) {
        delete a._garrisonOf;
        changed = true;
        continue;
      }
      if (home._battleUnresolved) continue; // still contested — fight on with the hero
      if (c.alive && c.location === homeId && home.owner === c.player) {
        // WON and held: the troops fall back into garrison duty in the province they defended.
        delete a._garrisonOf;
        c.armies = c.armies.filter((x) => x !== a);
        home.garrisonArmies = (asItsGuardReadsIt(home.garrisonArmies) ?? []).concat(a);
        _returnedByProv[homeId] = (_returnedByProv[homeId] ?? 0) + 1;
        changed = true;
      } else {
        // The hero left the province (retreated with them) or lost it — they stay in his host
        // now.
        delete a._garrisonOf;
        changed = true;
      }
    }
    if (changed) refreshMovePool(turnContext, c);
  });
  Object.keys(_returnedByProv).forEach((pid) => {
    // (a key the count above wrote by a province's id: the same number)
    const prov = G.world.provinces[Number(pid)];
    if (!prov) return;
    const n = _returnedByProv[pid];
    // (counted just above for every province it names)
    if (n === undefined) throw new TypeError("a held province's returning troops are not counted");
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: "a held province's standing troops resume their post as its garrison",
        provinceName: prov.name,
        units: n,
      },
      audience: { actor: prov.owner, realms: [prov.owner].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    });
  });
}

export const noteEntered = (
  turnContext: Pick<TurnContext, 'enteredThisPhase'>,
  pi: number | null | undefined,
  provId: number | null | undefined,
): void => {
  if (pi == null || provId == null) return;
  (turnContext.enteredThisPhase[pi] = turnContext.enteredThisPhase[pi] ?? new Set()).add(provId);
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
export function reconcileProvinceCharacters(turnContext: Pick<TurnContext, 'G'>) {
  const { G } = turnContext;
  // The DEAD are kept, at the location they fell. Nothing previously removed a corpse from this
  // array and one reader (the GM's province panel) lists ids without an alive check, so dropping
  // them here would quietly delete bodies from the map. Readers that want only the living already
  // filter for themselves.
  const byProv = new Map<number, number[]>();
  (asItsGuardReadsIt(G.characters) ?? []).forEach((c: Character | null | undefined) => {
    if (!c || asItsGuardReadsIt(c.location) == null) return;
    if (!byProv.has(c.location)) byProv.set(c.location, []);
    // (set just above for his province, if it wasn't)
    const here = byProv.get(c.location);
    if (!here) throw new TypeError("Cannot read properties of undefined (reading 'push')");
    here.push(c.id);
  });
  (asItsGuardReadsIt(G.world.provinces) ?? []).forEach((pv: Province | null | undefined) => {
    if (!pv) return;
    pv.characters = byProv.get(pv.id) ?? [];
  });
}

// per-player province memory. Called at the end of each phase — snapshots the observable state of
// every province a player can currently see (owned, occupied, their neighbours, or spied that
// phase) into player._provMemory. Latest observation wins, so the map shows phase-accurate "last
// seen" info: a player only learns of changes made while they can actually see the province.
export function updateProvinceMemory(turnContext: TurnContext, ph: number) {
  const { G, turnLog, clairWatch } = turnContext;
  const cols = G.world.cols,
    rows = G.world.rows;
  const spiedThisPhase: Partial<Record<number, Set<number>>> = {}; // player index -> Set(provinceId)
  turnLog.forEach((e) => {
    if (e.spy && e.actor != null && e.provinceId != null && e.phase === ph) {
      (spiedThisPhase[e.actor] = spiedThisPhase[e.actor] ?? new Set()).add(e.provinceId);
    }
  });
  G.players.forEach((pl, pi) => {
    pl._provMemory ??= {};
    // Core: provinces this player owns or currently occupies.
    const core = new Set<number>();
    (asItsGuardReadsIt(G.world.provinces) ?? []).forEach((pv: Province | null | undefined) => {
      if (pv?.owner === pi) core.add(pv.id);
    });
    (asItsGuardReadsIt(G.characters) ?? []).forEach((c) => {
      if (c.player === pi && c.alive && asItsGuardReadsIt(c.location) != null) core.add(c.location);
    });
    // Observed = core + their neighbours + anything spied this phase.
    const observed = new Set(core);
    core.forEach((pid) => {
      const pv = G.world.provinces[pid];
      if (!pv) return;
      getNeighborsP(pv, cols, rows, G.world.provinces).forEach((n: Province | null | undefined) => {
        if (n) observed.add(n.id);
      });
    });
    const spiedHere: ReadonlySet<number> | readonly number[] = spiedThisPhase[pi] ?? [];
    spiedHere.forEach((id: number) => observed.add(id));
    // CLAIRVOYANCE — from the cast phase on, the watched character's province is observed each
    // phase (so the map keeps the hex) and they are recorded as seen there (Clairvoyance can
    // re-target).
    {
      const _w = clairWatch[pi];
      if (_w && asItsGuardReadsIt(_w.charId) != null && ph >= (_w.fromPhase || 0)) {
        const _wc = (asItsGuardReadsIt(G.characters) ?? []).find(
          (x: Character | null | undefined) => x?.id === _w.charId,
        );
        if (_wc && _wc.alive && asItsGuardReadsIt(_wc.location) != null && _wc.player !== pi) {
          observed.add(_wc.location);
          const _wp = G.world.provinces[_wc.location];
          pl.seenCharIntel ??= {};
          pl.seenCharIntel[_wc.id] = {
            id: _wc.id,
            name: _wc.name,
            isKing: _wc.isKing,
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
    pl.seenCharIntel ??= {};
    const hisIntel = pl.seenCharIntel;
    (asItsGuardReadsIt(G.characters) ?? []).forEach((sc) => {
      if (!sc.alive || sc.player === pi || asItsGuardReadsIt(sc.location) == null) return;
      if (!core.has(sc.location)) return;
      const sp = G.world.provinces[sc.location];
      hisIntel[sc.id] = {
        id: sc.id,
        name: sc.name,
        isKing: sc.isKing,
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
    (asItsGuardReadsIt(G.characters) ?? []).forEach((sc: Character | null | undefined) => {
      if (!sc || !sc.alive || sc.player == null || sc.player === pi || asItsGuardReadsIt(sc.location) == null) return;
      if (
        (asItsGuardReadsIt(sc.armies) ?? []).length > 0 ||
        sc._invisTurn === G.turn ||
        ((asItsGuardReadsIt(sc.skills)?.spy ?? 0) || 0) < 1
      )
        return;
      const sp = G.world.provinces[sc.location];
      if (sp?.owner !== pi || !areEnemies(turnContext, pi, sc.player)) return;
      let watchers = (asItsGuardReadsIt(G.characters) ?? []).filter(
        (w: Character | null | undefined) => w && w.alive && w.player === pi && w.location === sp.id,
      );
      if (!watchers.length) {
        if (!spotEnemyInOwnedProvince(G, pi, sp, sc)) return;
        const _nb = new Set(
          getNeighborsP(sp, cols, rows, G.world.provinces)
            .filter((n: Province | null | undefined) => n?.owner === pi)
            .map((n) => n.id),
        );
        watchers = (asItsGuardReadsIt(G.characters) ?? []).filter(
          (w: Character | null | undefined) => w && w.alive && w.player === pi && _nb.has(w.location),
        );
      }
      if (!watchers.length) return;
      const best = watchers.reduce((a, b) =>
        ((asItsGuardReadsIt(b.skills)?.spy ?? 0) || 0) > ((asItsGuardReadsIt(a.skills)?.spy ?? 0) || 0) ? b : a,
      );
      if (best._spySpotted?.turn !== G.turn) best._spySpotted = { turn: G.turn, ids: [] };
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
    const enteredHere: ReadonlySet<number> | readonly number[] = turnContext.enteredThisPhase[pi] ?? [];
    enteredHere.forEach((pid: number) => {
      observed.add(pid);
      const pv = G.world.provinces[pid];
      if (!pv) return;
      getNeighborsP(pv, cols, rows, G.world.provinces).forEach((n: Province | null | undefined) => {
        if (n) observed.add(n.id);
      });
    });
    // Snapshot each observed province's current observable state (frozen at this phase).
    const hisMemory: Partial<Record<string, AProvinceAsItIsRemembered>> = pl._provMemory;
    observed.forEach((pid) => {
      const pv = G.world.provinces[pid];
      if (!pv) return;
      hisMemory[pid] = {
        turn: G.turn,
        phase: ph,
        name: pv.name,
        terrain: pv.terrain,
        race: pv.race,
        tax: pv.tax,
        armyTypes: (asItsGuardReadsIt(pv.armyTypes) ?? []).slice(),
        // Retain ritualSite (and guardian power) so a REMEMBERED province keeps its moon icon and
        // popup listing once discovered — a discovered ritual site must stay on the map from then
        // on, regardless of who later owns the ground.
        features: (asItsGuardReadsIt(pv.features) ?? [])
          .filter((f) => featDiscovered(f, pi))
          .map((f) => ({
            name: f.name,
            cleared: f.cleared,
            ritualSite: !!f.ritualSite,
            power: f.monster?.power ?? '',
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
    if (!asItsGuardReadsIt(pl._encountered)) pl._encountered = [];
    const _meet = (otherPi: number | null | undefined) => {
      if (otherPi != null && otherPi !== pi && !pl._encountered.includes(otherPi)) pl._encountered.push(otherPi);
    };
    observed.forEach((pid) => {
      const pv = G.world.provinces[pid];
      if (pv?.owner != null) _meet(pv.owner);
    });
    Object.values(pl.seenCharIntel ?? {}).forEach((ci: AHeroAsARealmHasSeenHim | null | undefined) => {
      if (ci?.player != null) _meet(ci.player);
    });
  });
}
