// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
// ── LINES IN THE GM'S LOG (plan P1-08a: lifted out of resolveTurn) ────
// The spell records, the silent heroes' line and a realm's name tag. Each takes the turn's context first
// (src/engine/turn/context.ts). The helpers that write a line of a
// fight's narrative, to a hero or a province's owner, or a private line with a public twin are in
// events-and-their-audiences.ts (plan P1-12a2), beside emit, the one door into the GM's log. At the end, the
// telemetry's two snapshots of a realm, its situation and its orders (telRealmSnapshot, telOrdersFor: moved from
// src/views/turn-report.ts in plan P1-12b1, so the engine imports no view), which read no turn context.
import { emit } from './events-and-their-audiences.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { consecratedIds, relOfReport } from '../heroes/fame-and-consecration.ts';
import { LEGENDARY_NAMES_P } from '../items/equipment.ts';
// A spell worked inside a battle or a duel (2026-10-09, Toby item 5): only the Cast order logged its
// casts, so pre-battle, defender and duel magic never reached the spell records. ctx says where.
export const telSpell = (turnContext, ch, spell, school, lvl, chance, roll, ctx) => {
  const { _tel } = turnContext;
  try {
    if (ch && ch.player != null)
      _tel.spells.push({
        ph: turnContext._logCtx.phase ?? turnContext._currentPhase,
        pi: ch.player,
        charId: ch.id,
        spell,
        school,
        lvl,
        chance,
        ok: roll <= chance,
        ctx,
      });
  } catch (_te) {}
};

// ── NO SILENT SEASON (2026-10-09, Toby item 1) ────
// Every hero of a realm has at least one line in every season of his Chronicle. A hero can still
// be moved or swept into a fight by code that files its lines under someone else (a veiled march,
// a pooled host, a stalled battle resumed by the strongest force); his season then read as if he
// did nothing. Run at the end of each phase: a living realm hero with no line of his own for the
// phase — by charId, by charIds, or as a commander of one of its battles (the same tests the report
// uses to file a line under him) — gets a plain line saying where the season leaves him. The line is a fact (since
// P1-12d15: the-facts-a-silent-heros-season-line-records.ts), each province's name as the world holds it (none where
// the line says "the field"), its words written in the views.
export function noteSilentHeroes(turnContext, ph, startLoc) {
  const { turnLog, battleCommanders, G } = turnContext;
  const heard = new Set();
  turnLog.forEach((e) => {
    if (e.phase !== ph) return;
    if (e.charId != null) heard.add(e.charId);
    if (Array.isArray(e.charIds)) e.charIds.forEach((id) => heard.add(id));
  });
  Object.keys(battleCommanders).forEach((k) => {
    if (k.endsWith('@' + ph)) (battleCommanders[k] || []).forEach((id) => heard.add(id));
  });
  (G.characters || []).forEach((c) => {
    if (!c || !c.alive || c.player == null || heard.has(c.id)) return;
    const from = startLoc ? startLoc[c.id] : undefined;
    emit(turnContext, {
      type: 'move',
      fact:
        from != null && from !== c.location
          ? {
              kind: 'a hero with no line of his own leaves a province and ends the season in another',
              heroName: c.name,
              fromProvinceName: (G.world.provinces[from] && G.world.provinces[from].name) || null,
              provinceName:
                (c.location != null && G.world.provinces[c.location] && G.world.provinces[c.location].name) || null,
            }
          : {
              kind: 'a hero with no line of his own remains where he is this season',
              heroName: c.name,
              provinceName:
                (c.location != null && G.world.provinces[c.location] && G.world.provinces[c.location].name) || null,
            },
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: ph,
      province: c.location != null ? c.location : null,
    });
  });
}

export function realmTag(turnContext, pi) {
  const { G } = turnContext;
  return pi != null && G.players[pi] ? ` (${G.players[pi].name})` : '';
}

// ── SNAPSHOT of one realm's situation, from a parsed game state. Module level: uses only module-level
// helpers (unitBaseStrength, relOfReport, consecratedIds), so buildGameResultRows can call it on any
// loaded state, not just inside runTurn.
export function telRealmSnapshot(gs, pi) {
  const pl = ((gs && gs.players) || [])[pi];
  if (!pl) return null;
  const provs = (gs.world && gs.world.provinces) || [];
  const owned = provs.filter((p) => p && p.owner === pi);
  const chars = (gs.characters || []).filter((c) => c && c.player === pi && c.alive);
  const king = chars.find((c) => c.isKing) || null;
  const unitRec = (a) => ({ t: a.type, q: a.quality || 'Average', ...(a._isSkeletal ? { sk: 1 } : {}) });
  let ledUnits = 0,
    ledStr = 0,
    garUnits = 0,
    garStr = 0;
  const characters = chars.map((c) => {
    const units = (c.armies || []).filter((a) => a && !a._phantom);
    units.forEach((a) => {
      ledUnits++;
      ledStr += unitBaseStrength(a);
    });
    const pv = c.location != null ? provs[c.location] : null;
    const skills = {};
    Object.entries(c.skills || {}).forEach(([k, v]) => {
      if (v > 0) skills[k] = v;
    });
    return {
      id: c.id,
      name: c.name,
      king: !!c.isKing,
      loc: c.location,
      terrain: pv ? pv.terrain : null,
      home: !!(pv && pv.owner === pi),
      hp: c.hp,
      maxHp: c.maxHp,
      skills,
      units: units.map(unitRec),
      items: (c.items || []).map((it) => it && it.name).filter(Boolean),
    };
  });
  owned.forEach((p) =>
    (p.garrisonArmies || []).forEach((a) => {
      if (a) {
        garUnits++;
        garStr += unitBaseStrength(a);
      }
    }),
  );
  // heroes who fell THIS turn, as they were at death (the Hall of Fame counts their peaks; no totals
  // above include them). Units and items are what death left on them, usually nothing.
  const fallen = (gs.characters || [])
    .filter((c) => c && c.player === pi && !c.alive && c.killedThisTurn)
    .map((c) => {
      const skills = {};
      Object.entries(c.skills || {}).forEach(([k, v]) => {
        if (v > 0) skills[k] = v;
      });
      return {
        id: c.id,
        name: c.name,
        king: !!c.isKing,
        fell: 1,
        hp: 0,
        maxHp: c.maxHp,
        skills,
        units: (c.armies || []).filter((a) => a && !a._phantom).map(unitRec),
        items: (c.items || []).map((it) => it && it.name).filter(Boolean),
      };
    });
  const tax = owned.reduce((s, p) => s + (p.tax || 0), 0);
  const worldTax = provs.reduce((s, p) => s + ((p && p.tax) || 0), 0);
  const rel = { enemies: [], allies: [] };
  (gs.players || []).forEach((o, oi) => {
    if (oi === pi || !o) return;
    const r = relOfReport(gs, pi, oi);
    if (r === 'enemy') rel.enemies.push(oi);
    else if (r === 'allied') rel.allies.push(oi);
  });
  const explored = provs.filter((p) => p && Array.isArray(p.visitedBy) && p.visitedBy.includes(pi)).length;
  const legNames = typeof LEGENDARY_NAMES_P !== 'undefined' ? LEGENDARY_NAMES_P : new Set();
  let items = 0,
    relics = 0;
  chars.forEach((c) =>
    (c.items || []).forEach((it) => {
      if (!it) return;
      items++;
      if (legNames.has(it.name)) relics++;
    }),
  );
  return {
    gold: Math.round(pl.gold || 0),
    provinces: owned.length,
    land: owned.filter((p) => p.terrain !== 'sea').length,
    sea: owned.filter((p) => p.terrain === 'sea').length,
    tax,
    taxShare: worldTax > 0 ? Math.round((1000 * tax) / worldTax) / 10 : 0,
    chars: chars.length,
    heroes: chars.length - (king ? 1 : 0),
    kingAlive: !!king,
    kingHp: king ? king.hp : null,
    ledUnits,
    ledStr: Math.round(ledStr),
    garUnits,
    garStr: Math.round(garStr),
    units: ledUnits + garUnits,
    str: Math.round(ledStr + garStr),
    items,
    relics,
    discoveries: (pl.discoveries || []).length,
    consecrated: consecratedIds(pl).length,
    explored,
    conceded: !!pl.conceded,
    eliminated: !!pl._eliminated,
    rel,
    characters,
    ...(fallen.length ? { fallen } : {}),
  };
}
// The orders a realm gave this turn, as resolved by runTurn's ingestion (humans' submitted orders,
// bots' planned ones, Defend for anything missing). One entry per living character, five phases each.
export function telOrdersFor(gs, pi, extras) {
  const chars = (gs.characters || []).filter((c) => c && c.player === pi && c.alive);
  const byChar = {};
  chars.forEach((c) => {
    const slots = (gs.turnOrders || {})[c.id] || [];
    byChar[c.id] = {
      name: c.name,
      king: !!c.isKing,
      ph: [0, 1, 2, 3, 4].map((i) => {
        const o = slots[i];
        if (!o) return { a: 'defend' };
        const r = { a: String(o.action || 'defend').toLowerCase() };
        if (o.target != null && o.target !== '') r.t = String(o.target).slice(0, 80);
        if (o.extra != null && o.extra !== '') r.x = String(o.extra).slice(0, 80);
        if (o.desc) r.d = String(o.desc).slice(0, 140);
        if (o._pinned) r.pinned = 1;
        if (o._unifiedWith != null) r.unified = o._unifiedWith;
        return r;
      }),
    };
  });
  const out = { chars: byChar };
  if (extras) {
    Object.entries(extras).forEach(([k, v]) => {
      if (
        v !== undefined &&
        v !== null &&
        !(Array.isArray(v) && !v.length) &&
        !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)
      )
        out[k] = v;
    });
  }
  return out;
}
