// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { TITLE_DEFS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { actionSpellsAllowedPerSchoolEachTurn } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import { GUARDIAN_POWER_RANK, SKILL_LABELS } from '../army-tables.ts';
import { featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import {
  BOT_HEX_DIRS,
  botBelief,
  botConceded,
  botKnows,
  botKnowsGraves,
  botNeighbourProv,
  botRelationRaw,
  botScouted,
  botSees,
  botSeesChar,
  botVisibleCharsIn,
} from './intel.ts';
import { BOT_SEA_ALL, botDefenceNeed, botEnemyDefence } from './war.ts';
import { botTurnCache } from './strategy.ts';
import { BOT_SCHOOLS } from './schools.ts';
import { botRoleTrainSkill } from './specialists.ts';
import { botAssumedChar, botEnemyIntel, botIsTeach, botRumourFor } from './missions.ts';
import { botRaiseTargets } from './movement.ts';
import { botPracticeSkill } from './economy.ts';
import { botPins } from './phase-one.ts';
import { _charTitleMerit, computeStandings } from '../titles/reckoning.ts';

// ══ BOT SPELLCRAFT (Sept 2026 self-play batch) ════
// Replaces the single-cast botActionCast. botCastPlan builds an ORDERED list of action-phase casts
// (up to `max`) from a given standing province, honouring the engine's per-school per-turn cap (1
// at L1-2, 2 at L3, 3 at L4+) and each spell's real range: character spells (Curse, Psychic Blast,
// Telekinetic Storm, Charm, Oratory, Phantasmal Armies, Resurrect) need the target IN the caster's
// province; province spells
// (Plague, Flood, Earthquake, Bless, Illusory Terrain) reach the province or a neighbour. (The old planner
// aimed Curse / Psychic Blast at ADJACENT enemies, which the engine rejects — a wasted phase every
// time.) Offence first when an enemy is in reach, then buffs for a host about to fight, then
// economy.
export function botSchoolLimit(lvl) {
  return actionSpellsAllowedPerSchoolEachTurn(lvl);
}
export function botCastPlan(G, pi, c, prov, opts) {
  opts = opts || {};
  const max = opts.max || 5;
  const sk = c.skills || {};
  const out = [];
  const used = {};
  if (!prov) return out;
  const lvl = (s) => sk[s] || 0;
  const can = (s) => lvl(s) >= 1 && (used[s] || 0) < botSchoolLimit(lvl(s));
  const push = (school, spell, extra, desc) => {
    if (out.length >= max || !can(school)) return false;
    used[school] = (used[school] || 0) + 1;
    out.push({ action: 'cast_spell', target: spell, extra: extra == null ? '' : String(extra), desc });
    return true;
  };
  const enemyRel = (j) => j != null && j !== pi && botRelationRaw(G, pi, j) === 'enemy';
  // targets are drawn from what this realm can see. charsIn goes through botVisibleCharsIn (so a
  // cloaked or unspotted hero is not picked as a target at all, rather than being targeted and
  // fizzling), and a neighbouring province is only a spell target if the realm has at least scouted
  // it — ownership on the border tier is public, the host standing there is not.
  const charsIn = (P) => botVisibleCharsIn(G, pi, P);
  const hereEnemies = charsIn(prov).filter((e) => e.player != null && enemyRel(e.player));
  const near = [prov];
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, prov, i);
    if (N && botScouted(G, pi, N.id)) near.push(N);
  }
  const enemyProvs = near.filter((N) => N.owner != null && enemyRel(N.owner) && N.terrain !== 'sea');
  const armiesIn = (N) => botEnemyDefence(G, N, N.owner, pi); // judged on what this realm can see
  const skillTotal = (e) => Object.values(e.skills || {}).reduce((a, b) => a + (b || 0), 0);
  // ── OFFENCE: enemies standing WITH the caster ──
  const armyLeader = [...hereEnemies]
    .filter((e) => (e.armies || []).length >= 2)
    .sort((a, b) => (b.armies || []).length - (a.armies || []).length)[0];
  if (armyLeader) push('psychic', 'Telekinetic Storm', armyLeader.id, 'Cast Telekinetic Storm on ' + armyLeader.name);
  const juiciest = [...hereEnemies].sort(
    (a, b) => (b.isKing ? 100 : 0) + skillTotal(b) - ((a.isKing ? 100 : 0) + skillTotal(a)),
  )[0];
  // 2026-09-29 (Toby): CURSE THE GENERAL — every skill halved for the rest of the turn, Tactical included, so a
  // host whose commander is cursed in Spring fights the rest of the year at a fraction of its battle multiplier.
  // An enemy KING here takes it first (a cursed king is a king who can fall); else the enemy leading the
  // biggest host here; else the most valuable hero.
  if (juiciest) {
    push('psychic', 'Psychic Blast', juiciest.id, 'Cast Psychic Blast on ' + juiciest.name);
    const _cz = juiciest.isKing ? juiciest : armyLeader || juiciest;
    push(
      'necromancy',
      'Curse',
      _cz.id,
      'Cast Curse on ' + _cz.name + (_cz === armyLeader ? ' (break the general before the battle)' : ''),
    );
  }
  // ── OFFENCE: enemy provinces in reach ──
  const withArmies = enemyProvs.filter((N) => armiesIn(N) > 0).sort((a, b) => armiesIn(b) - armiesIn(a));
  // FLOOD (2026-09-29): pins — Floods that strand an enemy host we cannot meet — are chosen centrally
  // (botPins) and written into the caster's Spring by the phase-one pass. What remains here is the old
  // harassing Flood on an enemy province holding forces: never where a host of ours stands, never on a
  // pinned province (its caster is already on it), never the siege target.
  {
    const oursThere = (N) =>
      (G.characters || []).some(
        (x) => x && x.alive && x.player === pi && x.location === N.id && (x.armies || []).length,
      );
    const _pins = botPins(G, pi);
    const fl = withArmies.find((N) => !N._flood && N.id !== opts.siege && !oursThere(N) && !_pins.has(N.id));
    if (fl) push('elemental', 'Flood', fl.id, 'Cast Flood on ' + fl.name);
  }
  const plagueT = withArmies.find((N) => N._flood) || withArmies[0];
  if (plagueT) push('necromancy', 'Plague', plagueT.id, 'Cast Plague on ' + plagueT.name);
  const rich = [...enemyProvs].sort((a, b) => (b.tax || 0) - (a.tax || 0))[0];
  if (rich && (rich.tax || 0) >= 4) push('elemental', 'Earthquake', rich.id, 'Cast Earthquake on ' + rich.name);
  // ── CHARM: a wandering hero here is a free hire; a lone enemy hero can be turned for the turn ──
  const wanderer = charsIn(prov).find(
    (h) => h.player === null && !h._isNeutralGuard && !h._justDefeated && !h.isKing && !(h.armies || []).length,
  );
  if (wanderer) push('psychic', 'Charm', wanderer.id, 'Charm ' + wanderer.name);
  else {
    const lone = hereEnemies.find((e) => !e.isKing && !(e.armies || []).length);
    if (lone) push('psychic', 'Charm', lone.id, 'Charm ' + lone.name);
  }
  // ── BUFFS for a host about to fight (opts.fighting: the caster or a co-located friendly leader
  // attacks this turn) ──
  if (opts.fighting) {
    const host = opts.fighting;
    push('psychic', 'Oratory', host.id === c.id ? '' : host.id, 'Oratory for ' + host.name);
    if (host.id === c.id) push('elemental', 'Elemental Summon', '', 'Summon an elemental');
    push('illusory', 'Phantasmal Armies', host.id === c.id ? '' : host.id, 'Phantasmal Armies for ' + host.name);
  }
  // ── SIEGE MAGIC (2026-09-26, Toby ideas 2 / 4): opts.siege is the enemy province a friendly host attacks this
  // turn, when it lies in this caster's reach. Illusory Terrain there makes the defenders fight at 80%; Plague
  // thins their units before the host arrives. (No Earthquake — that would only cost us the tax of a province
  // we are about to take; no Flood — it would strand our own assault.)
  if (opts.siege != null) {
    const S = G.world.provinces[opts.siege];
    if (S && near.some((N) => N.id === S.id)) {
      if (S._illusoryTurn !== G.turn)
        push('illusory', 'Illusory Terrain', S.id, 'Illusory Terrain over ' + S.name + ' (siege)');
      push('necromancy', 'Plague', S.id, 'Plague on ' + S.name + ' (siege)');
    }
  }
  // ── DEFENCE: false terrain over an owned province an enemy host stands beside — and (idea 2) over the
  // caster's own ground the moment a hostile host is seen within two hexes (opts.threat) ──
  if (lvl('illusory') >= 1) {
    const threatened = near
      .filter(
        (N) => N.owner === pi && N.terrain !== 'sea' && N._illusoryTurn !== G.turn && botDefenceNeed(G, N, pi) > 0,
      )
      .sort((a, b) => (b.tax || 0) - (a.tax || 0))[0];
    if (threatened) push('illusory', 'Illusory Terrain', threatened.id, 'Cast Illusory Terrain on ' + threatened.name);
    else if (opts.threat && prov.owner === pi && prov.terrain !== 'sea' && prov._illusoryTurn !== G.turn)
      push('illusory', 'Illusory Terrain', prov.id, 'Cast Illusory Terrain on ' + prov.name + ' (a host draws near)');
  }
  // ── RESURRECT a known fallen hero lying here (never one who served another realm — a raised hero serves the raiser) ──
  if (lvl('white') >= 1) {
    const known = new Set((G.players[pi] || {}).knownDeadHeroIds || []);
    const grave = botRaiseTargets(G, pi).find((x) => x.loc === prov.id);
    void known; // 2026-09-28: the same bodies the errand pass raises (own heroes, own recallable monarch)
    if (grave) push('white', 'Resurrect', grave.g.id, 'Resurrect ' + grave.g.name);
  }
  // ── ECONOMY ──
  if (lvl('white') >= 1) {
    const own = near
      .filter((N) => N.owner === pi && N._blessedTurn !== G.turn && N.terrain !== 'sea')
      .sort((a, b) => (b.tax || 0) - (a.tax || 0))[0];
    // Sept 2026: a Divine KING's Bless is +100% (a hero's +80%) — a hero standing with his Divine king leaves it to him
    const kingHere =
      !c.isKing &&
      ((G.players || [])[pi] || {}).alignment === 'Divine' &&
      (G.characters || []).some(
        (k) =>
          k &&
          k.alive &&
          k.isKing &&
          k.player === pi &&
          k.location === c.location &&
          ((k.skills || {}).white || 0) >= 1,
      );
    if (own && !kingHere) push('white', 'Bless Province', own.id, 'Cast Bless Province on ' + own.name);
  }
  // Skeletal Armies: the caster is STANDING here, so he feels the dead underfoot if he has the
  // Necromancy to feel them — but the realm's own grave lore is the record, not prov.battleGraves.
  if (
    lvl('necromancy') >= 1 &&
    (botKnowsGraves(G, pi, prov.id) || (botSees(G, pi, prov.id) && (prov.battleGraves || []).length > 0))
  )
    push('necromancy', 'Skeletal Armies', '', 'Cast Skeletal Armies');
  return out;
}
// The enemy province a character's written plan attacks this turn (first Move tagged Attack / Assault /
// Lightning strike), or null. Used to aim siege magic (idea 4).
export function botPlannedAttackTarget(G, l) {
  const lo = G.turnOrders[l.id] || [];
  let cur = G.world.provinces[l.location];
  if (!cur) return null;
  for (const o of lo) {
    if (!o || o.action !== 'move') continue;
    let N = null;
    if (String(o.target).startsWith('dir:')) {
      const d = BOT_HEX_DIRS.indexOf(String(o.target).slice(4));
      N = botNeighbourProv(G, cur, d);
    } else N = G.world.provinces[+o.target];
    if (!N) return null;
    if (/^(Attack|Assault|Lightning strike)/.test(o.desc || '')) return N.id;
    cur = N;
  }
  return null;
}
// Legacy entry point kept for callers that want a single best cast.
export function botActionCast(G, c) {
  const plan = botCastPlan(G, c.player, c, G.world.provinces[c.location], { max: 1 });
  return plan[0] || null;
}
// Which schools make a character a RAIDER (offensive action magic worth carrying into enemy land).
export function botOffensiveMagic(c) {
  const s = c.skills || {};
  return (s.elemental || 0) + (s.necromancy || 0) + (s.psychic || 0);
}
// Personal-combat rating for hunter/quarry comparisons (mirror of botCanBeatGuardian's character
// side).
export function botDuelRating(c) {
  const s = c.skills || {};
  const bm = (s.elemental || 0) + (s.necromancy || 0) + (s.psychic || 0);
  const t = c.temper || '';
  const tb = t === 'Berserk' ? 6 : t === 'Brave' ? 4 : t === 'Cautious' ? 5 : 0;
  const hp = c.hp != null ? c.hp : c.maxHp || 20;
  return hp + (s.melee || 0) * 6 + (s.archery || 0) * 4 + bm * 4 + tb + (c.items || []).length * 3;
}
// Nearest at-war enemy province worth raiding (rich, or holding enemy characters/armies) within
// `maxD` hops for an UNARMED character (who may cross anyone's land). Returns {P, d} or null.
export function botRaidTarget(G, pi, from, maxD) {
  // only ground this realm has seen, valued on the owner and wealth it BELIEVES are there plus
  // whatever characters it can actually see standing in it.
  let best = null;
  (G.world.provinces || []).forEach((P) => {
    if (!P || P.terrain === 'sea') return;
    if (!botKnows(G, pi, P.id)) return;
    const b = botBelief(G, pi, P);
    if (!b || b.owner == null || b.owner === pi || botRelationRaw(G, pi, b.owner) !== 'enemy') return;
    const chars = botVisibleCharsIn(G, pi, P).filter((x) => x.player === b.owner);
    const value = (b.tax || 0) + chars.reduce((s, e) => s + (e.isKing ? 12 : 6) + (e.armies || []).length * 2, 0);
    if (value < 4) return;
    const d = botPathLenAny(G, from, P.id, maxD);
    if (d == null) return;
    const sc = value - d * 2;
    if (!best || sc > best.sc) best = { P, d, sc };
  });
  return best;
}
// BFS over ALL land provinces (an unarmed character's world), capped at maxD.
export function botPathAny(G, from, toId, maxD) {
  if (!from || toId == null) return null;
  if (from.id === toId) return [];
  const prev = {};
  prev[from.id] = null;
  const dirOf = {};
  let q = [from],
    depth = 0;
  while (q.length && depth < maxD) {
    const next = [];
    depth++;
    let found = false;
    for (const cur of q) {
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, cur, i);
        if (!N || prev[N.id] !== undefined || N.terrain === 'sea') continue;
        prev[N.id] = cur.id;
        dirOf[N.id] = i;
        if (N.id === toId) {
          found = true;
          break;
        }
        next.push(N);
      }
      if (found) break;
    }
    if (found) break;
    q = next;
  }
  if (prev[toId] === undefined) return null;
  const dirs = [];
  let id = toId;
  while (prev[id] !== null) {
    dirs.unshift(dirOf[id]);
    id = prev[id];
  }
  return dirs;
}
export function botPathLenAny(G, from, toId, maxD) {
  const p = botPathAny(G, from, toId, maxD);
  return p ? p.length : null;
}
// A beatable enemy hero (not a king unless the hunter is one) within `maxD` hops, or null.
export function botHuntTarget(G, pi, c, maxD, duelSim) {
  if (!((c.skills || {}).melee >= 3 || (c.skills || {}).archery >= 3)) return null;
  const mine = botDuelRating(c);
  const from = G.world.provinces[c.location];
  if (!from) return null;
  const cands = [];
  const I = botEnemyIntel(G, pi);
  (G.characters || []).forEach((e) => {
    if (!(e && e.alive && e.player != null && e.player !== pi && botRelationRaw(G, pi, e.player) === 'enemy')) return;
    // a quarry must be one this realm can SEE right now — the same rule that builds a human's
    // Encounter Character dropdown (enemyCharVisibleTo). Bots were hunting heroes across the map by
    // reading their true position out of the game state.
    // Sept 2026 (Toby: track down enemy heroes): a hero seen unarmed within the last two turns is stalked to the
    // province he was last seen in even when out of sight now — the hunter walks there and lies in wait.
    const seen = botSeesChar(G, pi, e);
    const mem = !seen && I.heroes[e.id] && (G.turn || 0) - I.heroes[e.id].turn <= 2 ? I.heroes[e.id] : null;
    if (!seen && !mem) return;
    if (mem && ((e.armies || []).length || mem.provId === from.id)) return;
    if (e.isKing && !c.isKing) return;
    if (e._invisTurn === G.turn) return;
    if (mine < botDuelRating(botAssumedChar(G, pi, e)) * 1.2) return; // cheap pre-filter, on known skills only
    const loc = seen ? e.location : mem.provId;
    const d = botPathLenAny(G, from, loc, maxD);
    if (d == null) return;
    cands.push({
      e,
      d,
      loc,
      mem: !!mem,
      sc:
        (e.isKing ? 40 : 10) + Object.values(e.skills || {}).reduce((a, b) => a + (b || 0), 0) - d * 2 - (mem ? 4 : 0),
    });
  });
  cands.sort((a, b) => b.sc - a.sc);
  // Forecast the top few on the engine's duel model and take the best bet: a kill is the prize, a
  // quarry that flees costs nothing, being felled is what we refuse (<=20%). Without a forecaster
  // (module-level callers) fall back to a stiff rating margin.
  let best = null;
  for (const cand of cands.slice(0, 5)) {
    if (typeof duelSim === 'function') {
      const f = duelSim(c, botAssumedChar(G, pi, cand.e), 24);
      if (!f || f.felled > 0.1 || f.win < 0.4) continue;
      cand.forecast = f; // Sept 2026 (review II A3): a tenth, not a fifth
      cand.bet = f.win * 10 - f.felled * 20 + (cand.e.isKing ? 4 : 0) - cand.d;
    } else {
      if (mine < botDuelRating(botAssumedChar(G, pi, cand.e)) * 1.5) continue;
      cand.bet = cand.sc;
    }
    if (!best || cand.bet > best.bet) best = cand;
  }
  return best;
}
// CROSS-TRAINING. Co-located allies drill faster together: the engine gives a character a
// GUARANTEED skill gain when a higher-level co-trainer practises the same skill (mentor rule), and
// a group bonus among equals. So instead of each bot character grinding its own skill alone, a
// cluster converges on one "mentor skill" — the strongest teachable skill present — and the
// laggards (including freshly-hired heroes standing with the king) level up quickly. Deterministic
// from skills, so every member of the cluster independently picks the same focus and they all
// co-train.
export function botCrossTrainSkill(G, c, pi) {
  const partners = (G.characters || []).filter(
    (x) =>
      x &&
      x.alive &&
      x.player === pi &&
      x.location === c.location &&
      x.id !== c.id &&
      (() => {
        const o = G.turnOrders[x.id];
        return (
          !o ||
          o.every(
            (y) => y == null || ['defend', 'practice', 'research', 'hire', 'recruit', 'leave_army'].includes(y.action),
          )
        );
      })(),
  );
  if (partners.length === 0) return null; // need a training partner
  const group = [c, ...partners];
  // NOT a copy of KC_MAGIC_SCHOOLS/KC_SKILLS: this ORDER is the tie-break priority. Leave it hand-kept (2026-09-27).
  const SKILLS = [
    'melee',
    'tactical',
    'march',
    'archery',
    'naval',
    'white',
    'psychic',
    'illusory',
    'elemental',
    'necromancy',
    'spy',
    'thief',
    'sage',
    'druid',
    'explorer',
  ];
  let bestSkill = null,
    bestLvl = 0;
  // Sept 2026 (Toby): the realm's thin craft skills (Sage first, then Spy / Thief / Explorer) outrank a
  // strong fighting mentor while fewer than two characters hold them at 2+, so a court cross-trains
  // Sage rather than converging on Melee every year. Deterministic from realm state, so every member
  // of the cluster still picks the same focus.
  const NEED_SKILLS = { sage: 3, spy: 2, thief: 2, explorer: 2 };
  const need = {};
  Object.keys(NEED_SKILLS).forEach((k) => {
    const n = (G.characters || []).filter(
      (x) => x && x.alive && x.player === pi && ((x.skills || {})[k] || 0) >= 2,
    ).length;
    need[k] = n < 2 ? NEED_SKILLS[k] : 0;
  });
  for (const sk of SKILLS) {
    let mx = 0,
      mn = 99;
    group.forEach((x) => {
      const l = (x.skills || {})[sk] || 0;
      if (l > mx) mx = l;
      if (l < mn) mn = l;
    });
    // A worthwhile focus: someone can teach it (mx≥1) and someone below can still learn (mn<mx,
    // mn<5).
    const score = mx + (need[sk] || 0) + (BOT_SCHOOLS.includes(sk) ? 1 : 0); // 2026-09-28 (Toby: especially magic) — a school outranks a craft or weapon of the same level
    if (mx >= 1 && mn < mx && mn < 5 && score > bestLvl) {
      bestLvl = score;
      bestSkill = sk;
    }
  }
  return bestSkill;
}
// TITLE STRATEGY. The throne (winning) is pursued by runBotReckoning; on top of that each bot picks
// 2-3 MAIN titles to chase, drawn from its roster's aptitudes, and biases which skills it drills
// toward them. Most of the merit already flows from the aggressive play elsewhere (fighting → Grand
// Marshal, lair-raiding → Monster-Bane, exploring → Loremaster, casting → Archmage); this just points a
// bot's *training* at its chosen prizes so it leans into them. Decided once and cached for
// stability.
export function botTargetTitles(G, pi) {
  const p = G.players[pi];
  if (!p) return [];
  // Sept 2026 (review II A6): recomputed every turn from the standings the reports publish — a title we hold is
  // defended, a title whose holder's merit our best character already reaches 60% of is chased; only the
  // skill-based fallback below remains for a realm with no standings yet. Roles read the picks (botSpecialistRoles).
  const cache = botTurnCache(G);
  cache.titles = cache.titles || {};
  if (cache.titles[pi]) return cache.titles[pi];
  try {
    const st = computeStandings(G).titles || {};
    const mine = (G.characters || []).filter((c) => c && c.alive && c.player === pi);
    const picks = [];
    TITLE_DEFS.forEach((t) => {
      if (t.kingdomLevel) return;
      const h = st[t.key];
      if (!h) return;
      if (h.playerIndex === pi) {
        picks.push([t.key, 3]);
        return;
      }
      let best = 0;
      mine.forEach((c) => {
        try {
          const m = _charTitleMerit(c)[t.key] || 0;
          if (m > best) best = m;
        } catch (e) {}
      });
      const ratio = h.merit > 0 ? best / h.merit : best > 0 ? 1 : 0;
      if (ratio >= 0.6) picks.push([t.key, ratio]);
    });
    if (picks.length) {
      const out = picks
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((x) => x[0]);
      cache.titles[pi] = out;
      p._botTitles = out;
      return out;
    }
  } catch (e) {}
  if (p._botTitles) {
    cache.titles[pi] = p._botTitles;
    return p._botTitles;
  }
  let magic = 0,
    combat = 0,
    naval = 0,
    sage = 0,
    spy = 0,
    expl = 0;
  (G.characters || [])
    .filter((c) => c && c.player === pi)
    .forEach((c) => {
      const s = c.skills || {};
      magic += (s.white || 0) + (s.psychic || 0) + (s.illusory || 0) + (s.elemental || 0) + (s.necromancy || 0);
      combat += (s.melee || 0) + (s.tactical || 0) + (s.march || 0) + (s.archery || 0);
      naval += s.naval || 0;
      sage += s.sage || 0;
      spy += s.spy || 0;
      expl += s.explorer || 0;
    });
  // the four new titles join the bot's candidate list. `explore` no longer stands for the
  // Loremaster alone \u2014 Sage and Explorer are now separate prizes \u2014 so each is weighed on
  // its own skill. The beast titles are deed-only and are not chased by training, so they are
  // absent here.
  const cand = [
    ['marshal', combat + 5],
    ['monster', combat + 2],
    ['arch', magic * 2],
    ['lore', sage * 2],
    ['sea', naval * 2],
    ['spy', spy * 2],
    ['carto', expl * 2],
  ];
  cand.sort((a, b) => b[1] - a[1]);
  const picks = cand
    .filter((x) => x[1] > 0)
    .slice(0, 3)
    .map((x) => x[0]);
  p._botTitles = picks.length ? picks : ['marshal', 'monster'];
  return p._botTitles;
}
export function botTitleFocusSkill(c, titles) {
  const sk = c.skills || {};
  // Re-bias among skills the character ALREADY has (≥1, still trainable) toward a target title —
  // never starts a new skill from scratch (that stays with botPracticeSkill's own fallback), so a
  // maxed or non-matching character simply returns null and the normal practice/explore order is
  // preserved.
  const pickHighest = (list) => {
    let best = null,
      bl = 0;
    list.forEach((k) => {
      const v = sk[k] || 0;
      if (v >= 1 && v < 5 && v > bl) {
        bl = v;
        best = k;
      }
    });
    return best;
  };
  for (const t of titles || []) {
    if (t === 'arch') {
      const m = pickHighest(['elemental', 'necromancy', 'psychic', 'white', 'illusory']);
      if (m) return m;
    } // tie-break ORDER — deliberately not KC_MAGIC_SCHOOLS
    if (t === 'marshal' || t === 'monster') {
      const m = pickHighest(['melee', 'tactical', 'march', 'archery']);
      if (m) return m;
    }
    if (t === 'lore') {
      const m = pickHighest(['sage']);
      if (m) return m;
    }
    if (t === 'sea') {
      const m = pickHighest(['naval']);
      if (m) return m;
    }
    if (t === 'spy') {
      const m = pickHighest(['spy']);
      if (m) return m;
    }
    if (t === 'carto') {
      const m = pickHighest(['explorer']);
      if (m) return m;
    }
  }
  return null;
}
// LAIR RAIDING. A lair's guardian is a personal-combat monster ({hp, power}); clearing it yields
// its gold hoard and Monster-Bane merit and toughens the hero — but a hero can DIE, so bots need a
// real winnability gate (prior sessions staged Search for exactly this reason). botCanBeatGuardian
// rates the hero (max HP + combat skills) against the guardian (HP + a power-tier surcharge) and
// demands a clear 1.5× edge. This encodes "know the difficulty of lairs" and ties to item 1: as a
// hero cross- trains up, ever-tougher guardians come within reach. botBeatableLair returns the
// richest beatable, uncleared, non-ritual lair standing in the hero's own province.
export function botCanBeatGuardian(c, m, G, pi, f) {
  if (!m) return true;
  // Sept 2026 (Toby): a lair is entered on a bought rumour rating the hero "almost certain" (80%+), never on
  // the old skill heuristic alone. Callers passing the feature get the rumour test; the heuristic below stays
  // only as the pre-filter for whom to send to buy a rumour.
  if (G && f) {
    const r = botRumourFor(G, pi, c, f);
    return !!(r && r.band >= 101);
  } // no guardian → trivially clearable
  const sk = c.skills || {};
  // don't send heroes into lairs until they're real fighters: require melee 3 OR archery 3 before
  // attempting ANY guardian. (Softer combat-skill≥1 was letting fresh heroes die.)
  if ((sk.melee || 0) < 3 && (sk.archery || 0) < 3) return false;
  const battleMagic = (sk.elemental || 0) + (sk.necromancy || 0) + (sk.psychic || 0); // can also blast the monster in the encounter
  const POWER = { '': 0, Weak: 0, Moderate: 12, Powerful: 28, Legendary: 44 }; // skills on the 1–9 ladder + passives — demand more of a bot hero
  const monRating = (m.hp || 10) + (POWER[m.power] || 0);
  const charRating =
    (c.maxHp || 20) + (sk.melee || 0) * 6 + (sk.tactical || 0) * 3 + (sk.archery || 0) * 2 + battleMagic * 4;
  return charRating >= monRating * 1.5; // conservative — demand a clear edge (deaths are permanent)
}
export function botBeatableLair(G, c) {
  return botBeatableLairIn(G, c, G.world.provinces[c.location]);
}
// only lairs this realm has DISCOVERED are candidates, and they are ranked by the guardian's danger
// rather than by the hoard inside — the size of a hoard is not something a player knows before
// opening the chest, and bots were sorting the world's treasure by value. The index returned is
// still the index into prov.features, which is what the Search order expects.
export function botBeatableLairIn(G, c, prov) {
  if (!prov || !prov.features) return -1;
  const pi = c && c.player != null ? c.player : null;
  let bestIdx = -1,
    bestRating = -1;
  prov.features.forEach((f, idx) => {
    if (!f || f.cleared || f.ritualSite) return;
    if (pi != null && !featDiscovered(f, pi)) return; // not on this realm's map
    if (!botCanBeatGuardian(c, f.monster, G, pi, f)) return; // no rumour rating this hero 80%+ yet
    const POWER_RANK = { ...GUARDIAN_POWER_RANK };
    const rating = POWER_RANK[(f.monster && f.monster.power) || ''] || 0; // the guardian's power band IS public once discovered
    if (rating > bestRating) {
      bestRating = rating;
      bestIdx = idx;
    }
  });
  return bestIdx;
}
export function runBotActions(G, botIdxSet) {
  if (!botIdxSet || !botIdxSet.size || !G.world) return;
  G.turnOrders = G.turnOrders || {};
  // Sept 2026 (bot strategy): a character is "fillable" if it is not marching this turn — its
  // remaining Hold phases (after any phase-0 hire / recruit / garrison / hand-over muster orders)
  // get real work.
  const MUSTER = new Set(['hire', 'recruit', 'leave_army']);
  const isFillable = (c) => {
    const o = G.turnOrders[c.id];
    return !o || o.every((x) => x == null || x.action === 'defend' || MUSTER.has(x.action) || botIsTeach(x));
  }; // teaching phases kept (overlay only fills null / Hold)
  // Overlay a 5-phase plan onto the free (null / Hold) phases, in order, keeping muster orders in
  // place.
  const overlay = (cid, plan) => {
    const o = G.turnOrders[cid] || [null, null, null, null, null];
    let k = 0;
    for (let p = 0; p < 5 && k < plan.length; p++) {
      if (o[p] == null || o[p].action === 'defend') {
        o[p] = { ...plan[k++] };
      }
    }
    G.turnOrders[cid] = o;
  };
  const fill = (cid, order) => {
    overlay(
      cid,
      [0, 1, 2, 3, 4].map(() => ({ ...order })),
    );
  };
  botIdxSet.forEach((pi) => {
    if (botConceded(G, pi)) return; // a conceded realm only ever Defends
    (G.characters || [])
      .filter((c) => c && c.alive && c.player === pi && !c._isHeir && isFillable(c))
      .forEach((c) => {
        const maxHp = c.maxHp || 20,
          hp = c.hp != null ? c.hp : maxHp;
        if (hp < maxHp * 0.6) {
          fill(c.id, { action: 'rest', target: '', extra: '', desc: 'Rest & heal' });
          return;
        }
        // a commander of a host (5+ land/air units) always drills it: Practice Tactical raises the
        // skill AND promotes unit quality (and at Tactical 5 still drills). 3-4 units: drill too
        // unless the co-located cross-training group is converging on a different skill (mentor gains
        // are guaranteed).
        const _landUnits = (c.armies || []).filter((a) => a && !BOT_SEA_ALL.has(a.type) && !a._isSkeletal).length;
        const _drillPick =
          _landUnits >= 5 ? 'tactical' : _landUnits >= 3 && ((c.skills || {}).tactical || 0) < 5 ? 'tactical' : null;
        // Action-phase spells: the full ordered cast plan (offence, buffs, defence, resurrection,
        // economy) fills the free phases; whatever remains is practice / research / exploration.
        const _castPlan = botCastPlan(G, pi, c, G.world.provinces[c.location], { max: 4 });
        const castOrder = _castPlan[0] || null;
        const OFFENSIVE_CAST = new Set([
          'Curse',
          'Psychic Blast',
          'Earthquake',
          'Plague',
          'Flood',
          'Telekinetic Storm',
          'Charm',
        ]);
        // Sept 2026: discoveries now come from the Research order, not Practice Sage. A bot scholar
        // (Sage 1+) whose pick is Sage researches instead — always once Sage is maxed at 5, otherwise
        // half the time, so the skill still grows.
        const botSageOrResearch = (sk) => {
          const sg = (c.skills || {}).sage || 0;
          if (sk === 'sage' && sg >= 1 && (sg >= 5 || kcRng() < 0.5))
            return { action: 'research', target: '', extra: '', desc: 'Research' };
          return sk
            ? { action: 'practice', target: sk, extra: '', desc: 'Practice ' + (SKILL_LABELS[sk] || sk) }
            : { action: 'defend', target: '', extra: '', desc: 'Hold' };
        };
        // 2026-09-26 (Toby item 1): unmapped ground under a character who is standing still is explored before any
        // practice — Practice is the last resort, not the default (a host's commander still drills it).
        const _here = G.world.provinces[c.location];
        const _exploreHere =
          _landUnits < 3 &&
          !botRoleTrainSkill(c) &&
          _here &&
          _here.terrain !== 'sea' &&
          (_here.owner === pi || _here.owner == null) &&
          ((_here.exploredBy || {})[pi] || 0) < 100
            ? { action: 'explore', target: '', extra: '', desc: 'Explore ' + _here.name }
            : null;
        const practiceTail = () => {
          if (_exploreHere) return { ..._exploreHere };
          const sk =
            (_landUnits >= 5 ? 'tactical' : null) ||
            botRoleTrainSkill(c) ||
            botCrossTrainSkill(G, c, pi) ||
            _drillPick ||
            botTitleFocusSkill(c, botTargetTitles(G, pi)) ||
            botPracticeSkill(c);
          return botSageOrResearch(sk);
        };
        // Offensive casts fire first — hexing a nearby enemy beats anything peaceful.
        if (castOrder && OFFENSIVE_CAST.has(castOrder.target)) {
          const tail = practiceTail();
          overlay(c.id, [..._castPlan, { ...tail }, { ...tail }, { ...tail }, { ...tail }].slice(0, 5));
          return;
        }
        // the commander of a HOST (5+ land/air units) drills it every spare phase.
        if (_landUnits >= 5) {
          fill(c.id, { action: 'practice', target: 'tactical', extra: '', desc: 'Practice Tactical (drill the host)' });
          return;
        }
        // raid a beatable lair standing here (hoard + permanent strength) before low-value
        // self-buffs.
        const li = botBeatableLair(G, c);
        if (li >= 0) {
          const tail = practiceTail();
          overlay(c.id, [
            { action: 'search', target: String(li), extra: '', desc: 'Search Lair', prov: c.location },
            { ...tail },
            { ...tail },
            { ...tail },
            { ...tail },
          ]);
          return;
        }
        if (castOrder) {
          const tail = practiceTail();
          overlay(c.id, [..._castPlan, { ...tail }, { ...tail }, { ...tail }, { ...tail }].slice(0, 5));
          return;
        }
        if (_exploreHere) {
          fill(c.id, _exploreHere);
          return;
        }
        const skill =
          botRoleTrainSkill(c) ||
          botCrossTrainSkill(G, c, pi) ||
          _drillPick ||
          botTitleFocusSkill(c, botTargetTitles(G, pi)) ||
          botPracticeSkill(c);
        if (skill) {
          fill(c.id, botSageOrResearch(skill));
          return;
        }
        const prov = G.world.provinces[c.location];
        const mapped = prov && prov.exploredBy ? prov.exploredBy[pi] || 0 : 0;
        if (prov && mapped < 100) {
          fill(c.id, { action: 'explore', target: '', extra: '', desc: 'Explore' });
          return;
        }
        // else: nothing worthwhile — leave the character to the default-to-Defend pass.
      });
  });
}
