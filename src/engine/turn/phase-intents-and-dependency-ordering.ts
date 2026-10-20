import { getNeighborsP, neighborInDir } from '../world/map-helpers.ts';
import { orderCharRef } from '../heroes/charms-and-neutrals.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { totalInit } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { stepTowardPreferSafe } from '../world/routes-and-distances.ts';

// ── THE PHASE PIPELINE: INTENTS, DEPENDENCY ORDERING, MOVEMENT INTERLOCKS (plan P1-08i1: lifted out of resolveTurn) ────
// Before anyone acts in a phase: what every acting character intends to do (buildPhaseIntents), the order they act in
// (orderPhaseActors: initiative in tiers, the AK [3.0] dependencies first), and the defenders an enemy column pins by
// arriving before they can march out (applyMoveInterlocks). PHASE_ACTION_MAP turns an order's name into the action key
// processOrder and the pipeline share. They take the turn's context first (src/engine/turn/context.js); normaliseAction and
// _phaseActionTier take none.
// ════
// PHASE PIPELINE — intent table, dependency ordering, movement interlocks
// ════
// AK [3.0] resolves a phase as more than a flat initiative queue: characters helping an ally wait
// for that ally, a general ordered to move away from an invaded province stays to fight instead,
// and a pursuer acts immediately after his quarry. All of those need to know what EVERY character
// intends to do this phase BEFORE anyone acts. buildPhaseIntents() produces that read-only table;
// nothing in it mutates game state.

// Canonical order-name → internal action-key map. Shared by processOrder and the phase pipeline
// (buildPhaseIntents / phaseDependencies) so both always agree on what a character is doing.
export const PHASE_ACTION_MAP = {
  move: 'move',
  explore: 'explore',
  'explore province': 'explore',
  search: 'search',
  'search lair': 'search',
  'search feature': 'search', // 'search feature' kept as a backward-compat alias for orders written before the Lair rename
  'hunting rumours': 'hunt_rumours',
  'hunt rumours': 'hunt_rumours',
  hunt_rumours: 'hunt_rumours', // 2026-09-17 (late)
  recruit: 'recruit',
  'recruit armies': 'recruit',
  hire: 'hire',
  'hire hero': 'hire',
  release: 'release',
  'release hero': 'release',
  'dismiss hero': 'release',
  leave_army: 'leave_army',
  'leave/transfer army': 'leave_army',
  'leave army': 'leave_army',
  'transfer army': 'leave_army',
  disband_army: 'disband_army',
  'disband army': 'disband_army',
  disband: 'disband_army',
  pickup_army: 'pickup_army',
  'pick up army': 'pickup_army',
  pick_up_army: 'pickup_army',
  give_item: 'give_item',
  'give item': 'give_item',
  'give magic item': 'give_item',
  send_item: 'give_item',
  'send item': 'give_item',
  'send magic item': 'give_item', // Give Item renamed Send Item (old label kept for back-compat)
  cast_spell: 'cast_spell',
  'cast spell': 'cast_spell',
  spy: 'spy',
  practice: 'practice',
  'practice skill': 'practice',
  'practice ability': 'practice',
  research: 'research',
  'research discovery': 'research',
  defend: 'defend',
  rest: 'rest',
  'rest & heal': 'rest',
  'rest and heal': 'rest',
  consecrate: 'consecrate',
  'consecrate province': 'consecrate',
  'call to arms': 'call_to_arms',
  call_to_arms: 'call_to_arms',
  broker: 'broker',
  'awaken the wild': 'awaken_wild',
  awaken_wild: 'awaken_wild',
  'call from the pit': 'call_pit',
  call_pit: 'call_pit',
  'harvest the field': 'harvest_field',
  harvest_field: 'harvest_field',
  encounter: 'encounter',
  'encounter character': 'encounter',
  steal: 'steal',
  'steal item': 'steal',
  'steal from character': 'steal',
  use_item: 'use_item',
  'use item': 'use_item',
  'use magic item': 'use_item',
  equip_items: 'equip_items',
  'equip items': 'equip_items',
  equip: 'equip_items',
  'equip item': 'equip_items',
  pursue: 'encounter',
  'pursue character': 'encounter', // Pursue is folded into Encounter
  rite: 'rite',
  'perform rite': 'rite',
  sabotage: 'sabotage',
  'forced march': 'forced_march',
  forced_march: 'forced_march',
  'grand heist': 'grand_heist',
  grand_heist: 'grand_heist',
  'awaken grove': 'awaken_grove',
  awaken_grove: 'awaken_grove',
  'chart the unknown': 'chart_unknown',
  chart_unknown: 'chart_unknown',
  'discover lost ruin': 'discover_ruin',
  discover_ruin: 'discover_ruin',
  blockade: 'blockade',
  'research breakthrough': 'research_breakthrough',
  research_breakthrough: 'research_breakthrough',
  assassinate: 'assassinate',
  vanish: 'vanish',
  challenge: 'challenge',
  rampage: 'rampage',
  'rain of arrows': 'rain_of_arrows',
  rain_of_arrows: 'rain_of_arrows',
  "sniper's mark": 'snipers_mark',
  'snipers mark': 'snipers_mark',
  snipers_mark: 'snipers_mark',
  'feigned retreat': 'feigned_retreat',
  feigned_retreat: 'feigned_retreat',
  'grand stratagem': 'grand_stratagem',
  grand_stratagem: 'grand_stratagem',
  'lightning advance': 'lightning_advance',
  lightning_advance: 'lightning_advance',
  'raid the coast': 'raid_coast',
  raid_coast: 'raid_coast',
  'wild calling': 'wild_calling',
  wild_calling: 'wild_calling',
  'grand design': 'grand_design',
  grand_design: 'grand_design',
};

// Resolve a move order's destination WITHOUT moving anybody.
export function intendedDestination(turnContext, c, order) {
  const { G } = turnContext;
  if (!order) return null;
  const t = order.target || '';
  const from = G.world.provinces[c.location];
  if (!from) return null;
  if (t.startsWith('dir:')) return neighborInDir(turnContext, from, t.slice(4));
  if (t.startsWith('prov:')) {
    // Absolute target: the province itself if adjacent, else the first step toward it (mirrors
    // the move case so phase intents / interceptions see where the column will actually go).
    const want = G.world.provinces[parseInt(t.slice(5))];
    if (!want || want.id === from.id) return null;
    if (getNeighborsP(from, G.world.cols, G.world.rows, G.world.provinces).some((n) => n && n.id === want.id))
      return want;
    return stepTowardPreferSafe(turnContext, c, want.id);
  }
  const id = parseInt(t);
  if (isNaN(id)) return null;
  return G.world.provinces[id] || null;
}

export function normaliseAction(order) {
  const raw = ((order && order.action) || 'defend').toLowerCase().trim();
  return PHASE_ACTION_MAP[raw] || 'defend';
}

// Characters who may act this phase (hired heroes only become active the phase AFTER hiring).
export function actingThisPhase(turnContext, ph) {
  const { G } = turnContext;
  return (G.characters || []).filter((c) => {
    if (c.player === null || !c.alive) return false;
    if (c.hiredInPhase != null && c.hiredInPhase >= 0 && ph <= c.hiredInPhase) return false;
    // A charmed ENEMY hero is under your banner (c.player already swapped) but must not act on
    // your orders until the phase AFTER the cast — mirrors the hiredInPhase gate for a sworn
    // wanderer.
    if (c._charmTempControl && c._charmControlFrom != null && ph <= c._charmControlFrom) return false;
    return true;
  });
}

export function buildPhaseIntents(turnContext, ph) {
  const { G } = turnContext;
  const intents = new Map();
  actingThisPhase(turnContext, ph).forEach((c) => {
    const order = (G.turnOrders[c.id] || [])[ph] || null;
    const action = normaliseAction(order);
    const leadsArmy = (c.armies || []).length > 0;
    const dest = action === 'move' ? intendedDestination(turnContext, c, order) : null;
    intents.set(c.id, {
      c,
      id: c.id,
      player: c.player,
      order,
      action,
      leadsArmy,
      init: totalInit(c),
      fromId: c.location,
      toId: dest ? dest.id : null,
      dest,
      cancelled: false,
      cancelReason: null,
    });
  });
  return intents;
}

// Does this intent amount to an armed attack on a province held by another player?
export function isHostileInvasion(turnContext, it) {
  const { G, seaMovePoints, movePoints } = turnContext;
  if (!it || it.cancelled || it.action !== 'move' || !it.leadsArmy || !it.dest) return false;
  const d = it.dest;
  // a column with NO movement left in the pool this march would draw on is not an invasion — the
  // move case will refuse it ("no movement points remaining"). Counting it sent a general on
  // Defend riding out to meet an enemy who never arrived: the player read "march to meet the
  // threat" and then no battle. Pools are per-turn and set at turn start; an undefined pool
  // (never computed) is left to the move case to settle, so it still counts here.
  {
    const from = G.world.provinces[it.fromId];
    const bySea = d.terrain === 'sea' || (!!from && from.terrain === 'sea');
    const pool = bySea ? seaMovePoints[it.id] : movePoints[it.id];
    if (pool !== undefined && pool !== null && pool <= 0) return false;
  }
  // DIPLOMACY: an invasion is hostile only if the mover is at WAR with the province's owner.
  // Marching into an ally's land (free passage) or a neutral's (turned back at the border) is not
  // an invasion — it must not pin defenders or trigger Defend reactions.
  if (d.owner != null && d.owner !== it.player && areEnemies(turnContext, it.player, d.owner)) return true;
  // An armed ENEMY force standing in the province is an invasion even if the land is unowned.
  return (G.characters || []).some(
    (o) =>
      o.alive &&
      o.location === d.id &&
      (o.armies || []).length > 0 &&
      o.player != null &&
      o.player !== it.player &&
      areEnemies(turnContext, it.player, o.player),
  );
}

// ── Dependency ordering (AK [3.0] exceptions) ────
// Returns [charId_before, charId_after] pairs meaning "before" must be processed first.
export function phaseDependencies(turnContext, ph, intents) {
  const { G } = turnContext;
  const edges = [];
  const list = [...intents.values()];
  const byId = (id) => intents.get(id);

  list.forEach((it) => {
    const { c, order, action } = it;
    if (!order) return;
    const tgtId = parseInt(order.target);
    const tgt = isNaN(tgtId) ? null : byId(tgtId);

    // (a) A character doing something FOR a co-located ally goes first, so the ally can use it.
    // Give Item / Leave-Transfer Army to a named ally, and friendly action spells.
    // EXCEPTION: if that ally is marching INTO this province this phase, rule (c) below
    // applies instead and the ally arrives first — emitting both edges would make a cycle,
    // and Kahn's algorithm would then fall back to plain initiative and honour neither.
    const tgtArrivingHere = (t) => !!t && t.action === 'move' && t.toId === it.fromId;
    // 2026-09-23: the RECIPIENT of Send Item / Transfer Army is in `extra` (the target holds item
    // indices / unit names). Reading `target` here linked the sender to whichever character's id
    // matched the first item index, and never to the real recipient.
    const _rcp =
      action === 'give_item' || action === 'leave_army'
        ? (() => {
            const r = orderCharRef(G, order.extra);
            return r ? byId(r.id) : null;
          })()
        : null;
    if (_rcp && _rcp.player === it.player && _rcp.id !== it.id && !tgtArrivingHere(_rcp)) {
      edges.push([it.id, _rcp.id]);
    }
    if (action === 'cast_spell') {
      const spellTargetId = parseInt(order.extra);
      const st = isNaN(spellTargetId) ? null : byId(spellTargetId);
      if (st && st.player === it.player && st.id !== it.id && !tgtArrivingHere(st)) edges.push([it.id, st.id]);
    }
    // (b) Pick Up waits for anyone Leaving armies in the same province this phase.
    if (action === 'pickup_army') {
      list.forEach((other) => {
        if (other.id === it.id || other.player !== it.player) return;
        if (other.action !== 'leave_army') return;
        if (other.fromId !== it.fromId) return;
        edges.push([other.id, it.id]);
      });
    }
    // (c) A character MOVING IN to a province where an ally intends to hand him something
    // arrives first — the ally waits for him (AK [3.0]).
    if (action === 'move' && it.dest) {
      list.forEach((other) => {
        if (other.id === it.id || other.player !== it.player) return;
        if (other.fromId !== it.dest.id) return;
        if (other.action !== 'give_item' && other.action !== 'leave_army') return;
        const _oR = orderCharRef(G, other.order && other.order.extra); // recipient is in extra (2026-09-23)
        if (!_oR || _oR.id !== it.id) return;
        edges.push([it.id, other.id]);
      });
    }
    // (d) A pursuer acts immediately after the character he is chasing (AK [3.0]).
    if ((action === 'pursue' || action === 'encounter') && tgt && tgt.id !== it.id) edges.push([tgt.id, it.id]); // an Encounter chaser acts right after their quarry
    if (it.c._pursuit && it.c._pursuit.active) {
      const pt = byId(it.c._pursuit.targetId);
      if (pt && pt.id !== it.id) edges.push([pt.id, it.id]);
    }
  });
  return edges;
}

// Initiative comparator — AK [3.0]: highest total ability first (March ×3), ties broken by lowest
// character number. Actions resolve in tiers: all non-relocating orders (cast, recruit, give,
// search, spy, …) settle FIRST while everyone is still in their start-of-phase positions, THEN
// Move/Pursue relocate and any battles they start are fought, and Defend orders always come last.
// So a fast general can no longer march out and start a fight before a co-located caster gets to
// act. Dependency edges (buildPhaseIntents → phaseDependencies, e.g. a hero marching in to receive
// an item) still override this tiering through Kahn's topological sort, so the AK [3.0]
// exceptions that require a specific move-before/after ordering are preserved.
export function _phaseActionTier(d) {
  return d === 'defend' ? 2 : d === 'move' || d === 'pursue' || d === 'encounter' ? 1 : 0;
} // Encounter relocates (chases), so it tiers with Move
export function phaseInitCompare(turnContext, ph) {
  const { G } = turnContext;
  return (a, b) => {
    const aD = normaliseAction((G.turnOrders[a.id] || [])[ph]);
    const bD = normaliseAction((G.turnOrders[b.id] || [])[ph]);
    const at = _phaseActionTier(aD),
      bt = _phaseActionTier(bD);
    if (at !== bt) return at - bt; // non-move → move/pursue → defend
    const d = totalInit(b) - totalInit(a);
    if (d !== 0) return d;
    return a.id - b.id;
  };
}

// Kahn's algorithm over the dependency edges, using initiative order as the tie-break priority.
// Any characters left in a dependency cycle (e.g. two heroes each Giving to the other) are
// appended in plain initiative order rather than dropped.
export function orderPhaseActors(turnContext, ph, intents) {
  const cmp = phaseInitCompare(turnContext, ph);
  const nodes = [...intents.values()].map((it) => it.c).sort(cmp);
  const edges = phaseDependencies(turnContext, ph, intents).filter(
    ([u, v]) => intents.has(u) && intents.has(v) && u !== v,
  );
  const indeg = new Map(nodes.map((c) => [c.id, 0]));
  const out = new Map(nodes.map((c) => [c.id, []]));
  edges.forEach(([u, v]) => {
    out.get(u).push(v);
    indeg.set(v, indeg.get(v) + 1);
  });
  const ready = nodes.filter((c) => indeg.get(c.id) === 0);
  const result = [];
  const placed = new Set();
  while (ready.length) {
    ready.sort(cmp);
    const c = ready.shift();
    if (placed.has(c.id)) continue;
    placed.add(c.id);
    result.push(c);
    out.get(c.id).forEach((v) => {
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) {
        const n = nodes.find((x) => x.id === v);
        if (n && !placed.has(v)) ready.push(n);
      }
    });
  }
  nodes.forEach((c) => {
    if (!placed.has(c.id)) result.push(c);
  });
  return result;
}

// ── MOVEMENT INTERLOCKS (AK [3.1]) ────
// "When an army leader Moves into an enemy province, any enemy armies in that province who had
// been ordered to move away and haven't yet moved out of the province, stay for the battle
// instead, unless they are sent to an adjacent province by a general who has Defend orders."
//
// Because every order used to resolve in isolation, two armies ordered into each other's
// provinces simply swapped places — marching straight through one another with no battle. The
// head-on swap is just the most visible case of the general rule, so both are handled here: a
// defender is pinned whenever an armed enemy is due to arrive in his province BEFORE he leaves.
// "Before he leaves" is decided by initiative, so a fast general still gets clear in time.
export function applyMoveInterlocks(turnContext, ph, intents) {
  const { G, log } = turnContext;
  const list = [...intents.values()];
  const invasions = list.filter((...a) => isHostileInvasion(turnContext, ...a));
  if (!invasions.length) return;
  const cmp = phaseInitCompare(turnContext, ph);

  list.forEach((def) => {
    if (def.cancelled || def.action !== 'move' || !def.leadsArmy || !def.dest) return;
    // Which hostile forces are arriving in the province this general is standing in?
    const incoming = invasions.filter(
      (inv) => inv.id !== def.id && inv.player !== def.player && inv.toId === def.fromId && !inv.cancelled,
    );
    if (!incoming.length) return;
    // Does at least one of them get there before this general marches out?
    const beatsHim = incoming.some((inv) => cmp(inv.c, def.c) < 0);
    if (!beatsHim) return;
    // Exception: a general under Defend orders may still be redirected to an adjacent province.
    if (def.c._defend && def.c._defend.active) return;

    def.cancelled = true;
    def.cancelReason = 'pinned';
    const home = G.world.provinces[def.fromId];
    const dest = def.dest;
    const swapPartner = incoming.find((inv) => inv.fromId === def.toId);
    if (swapPartner) {
      // Head-on: both were marching into each other's territory. The slower column is caught
      // still forming up and has to turn and fight on its own ground.
      log(
        'move',
        `${def.c.name} breaks camp for ${dest.name}, but ${swapPartner.c.name}'s banners are already cresting the hills toward ${home ? home.name : 'the province'} — there is no time to march past one another. ${def.c.name} turns their column about and stands to defend.`,
        { actor: def.player, targets: [def.player], provinceId: def.fromId },
      );
    } else {
      log(
        'move',
        `${def.c.name} is under orders to march on ${dest.name}, but an enemy force enters ${home ? home.name : 'the province'} before the column can clear the gates. ${def.c.name} stays to defend.`,
        { actor: def.player, targets: [def.player], provinceId: def.fromId },
      );
    }
  });
}
