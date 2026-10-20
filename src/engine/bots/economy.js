import { KC_RIVAL_RACE, KC_UNIT_CLASS, SPELL_DEFS_P } from '../../content/kingdoms-call-data.js';
import { ARMY_COST_MASTER, ARMY_SPEED_MASTER, SKILL_LABELS } from '../army-tables.js';
import { UNIT_BASE_STR } from '../battle/strength.js';
import { TAMED_FLYER_TYPES_D, druIdPenaltyMult, heroHireWage } from '../world/tables.js';
import { effSkillOf } from '../heroes/skills-and-hp.js';
import { UNIT_DRILL_BASE } from '../units/drill-and-spoils.js';
import { BOT_HEX_DIRS, botBelievedOwner, botHasDisc, botNeighbourProv, botRaceTerrainMult, botRelationRaw, botSeesChar } from './intel.js';
import { BOT_CARRIER_TYPES, BOT_MONSTER_ARMIES, BOT_SEA_ALL } from './war.js';
import { BOT_SPECIALIST_SKILLS } from './specialist-skills.js';
import { botFieldRecruitTokens, botGarrisonOrder, botHireOrder, botLedger, botRecruitOrder, botRoles } from './strategy.js';
import { BOT_SCHOOLS } from './schools.js';
import { BOT_SPECIALIST_ROLES, botNearbyThreat, botPathLen, botPracticeFallback } from './specialists.js';
import { botIsTeach, botOrderLocs, botPickupOrder } from './missions.js';
import { skillLevel } from '../titles/perks.js';
import { _BEST_SCHOOL } from '../titles/reckoning.js';

// ══ BOT PLAYERS — Phase 3b: economy (recruit / hire) ════
// Runs AFTER runBotMovement: any bot character still HOLDING (no movement order) in an owned
// province spends the treasury on reinforcements. Tax income is PASSIVE in this engine (applied
// automatically each turn ~line 11672), so there is no "tax" order — expanding already grows a
// bot's income.
//
// SOLVENCY BY CONSTRUCTION: a unit's recruit cost is ALSO its per-turn upkeep/wage (see the note
// above ARMY_COST_MASTER). So recruitment is gated on BOTH an upfront gold reserve AND an upkeep
// cap (total wages kept ≤ 90% of the bot's tax income). This ties army size to economic base — a
// bot recruits more only as it expands — and prevents a wage spiral that would bankrupt it.
export const BOT_NAVAL_TYPES = new Set(KC_UNIT_CLASS.sea);
export function botRecruitableTypes(prov, G, cmdr) {
  // rank by the strength the intended COMMANDER gets out of the unit (Druid shortfall applied, race
  // = the province's race as the engine assigns it), not the raw table value — a Druid-0 king
  // buying Cave Trolls at −60% was throwing gold away.
  const effOf = (t) => {
    const base = UNIT_BASE_STR[t] || 4;
    if (!G || !cmdr) return base;
    const align = (cmdr.player != null ? ((G.players || [])[cmdr.player] || {}).alignment : null) || 'Neutral';
    const tamed = cmdr.player != null && botHasDisc(G, cmdr.player, 'sd40');
    let m = 1;
    try {
      m = druIdPenaltyMult(cmdr, { type: t, race: prov.race || 'Human' }, align, tamed && TAMED_FLYER_TYPES_D.has(t));
    } catch (e) {
      m = 1;
    }
    // Sept 2026: kinship / grudge for THIS commander, and the unconditional fervour an Evil (Monster) realm
    // gets from the unit — an Orc lord buying human levies at −20% was paying full price. (The Druidic
    // ×1.25, Wild Ferocity, was retired 2026-10-13.)
    m *= botRaceTerrainMult(G, cmdr, { type: t, race: prov.race || 'Human' }, null, false, cmdr.player);
    if (align === 'Evil' && BOT_MONSTER_ARMIES.has(t)) m *= 1.25;
    return base * m;
  };
  // Sept 2026 (Toby): a general raises troops of his own blood and the king's (+20% kinship each) and never
  // troops of the grudge race (Elf↔Dwarf, Human↔Orc: −20% under him) while any other muster is possible — a
  // grudge-race province yields nothing to that commander; the feeder pipeline brings him kin instead.
  if (G && cmdr) {
    const RIV = { ...KC_RIVAL_RACE };
    const pr = prov.race || 'Human';
    if (cmdr.race && RIV[pr] === cmdr.race && !String(pr).startsWith('Primal')) {
      const pi2 = cmdr.player;
      const near = (G.world.provinces || []).some(
        (x) =>
          x &&
          x.owner === pi2 &&
          x.id !== prov.id &&
          x.terrain !== 'sea' &&
          (x.armyTypes || []).some((t) => t && !/garrison/i.test(t) && !BOT_NAVAL_TYPES.has(t)) &&
          RIV[x.race || 'Human'] !== cmdr.race &&
          (botPathLen(G, pi2, prov, x.id, false) || 99) <= 2,
      );
      if (near) return [];
    }
  } // "when possible": only while kin can be raised within two hops
  const all = (prov.armyTypes || [])
    .filter((t) => t && !/garrison/i.test(t) && !BOT_NAVAL_TYPES.has(t)) // land field units only (v1)
    .sort((a, b) => effOf(b) - effOf(a)); // strongest FOR THIS COMMANDER first (kinship already in effOf)
  // Sept 2026 (bot strategy): a speed-1 unit (Mountain Guns, Stone Giants…) pins the whole host to
  // one hop a turn, which costs far more conquest than its strength buys. Skip them when anything
  // else exists.
  if (cmdr && cmdr._botRole === 'defender') return all; // a posted defender never marches: Mountain Guns are welcome
  const mobile = all.filter((t) => (ARMY_SPEED_MASTER[t] || 3) >= 2);
  return mobile.length ? mobile : all;
}
export function botUpkeep(G, pi) {
  let w = 0;
  (G.characters || []).forEach((c) => {
    if (c && c.alive && c.player === pi)
      (c.armies || []).forEach((a) => {
        if (a._temporary || a._wildHuntUntilTurn != null) return;
        w += a._isSkeletal ? 1 : ARMY_COST_MASTER[a.type] || 2;
      });
  });
  // Sept 2026: garrison units draw wages too (the engine bills them alongside field armies) — the
  // solvency guard must see them now that bots garrison every province.
  (G.world.provinces || []).forEach((p) => {
    if (p && p.owner === pi)
      (p.garrisonArmies || []).forEach((a) => {
        if (a._temporary || a._wildHuntUntilTurn != null) return;
        w += a._isSkeletal ? 1 : ARMY_COST_MASTER[a.type] || 2;
      });
  });
  (G.characters || []).forEach((c) => {
    if (c && c.alive && c.player === pi && !c.isKing) w += c.pay || 0;
  }); // hero wages are real wages too
  return w;
}
export function botTaxIncome(G, pi) {
  let inc = 0;
  (G.world.provinces || []).forEach((p) => {
    if (p && p.owner === pi) inc += p.tax || 0;
  });
  return inc;
}
// ── ECONOMY helpers for the 2026-08 batch ────
// is this bot AT WAR (any at-war relation with a live player)? At-war bots spend their treasury
// down and raise their sustainable army ceiling to build for the fight.
export function botAtWar(G, pi) {
  return (G.players || []).some(
    (p, j) =>
      j !== pi &&
      p &&
      (G.characters || []).some((c) => c && c.alive && c.isKing && c.player === j) &&
      botRelationRaw(G, pi, j) === 'enemy',
  );
}
// the biggest army stack (unit count) any at-war enemy is currently leading. Used to decide when to
// go to a war footing and roughly how big an army to build toward.
export function botMaxEnemyStack(G, pi) {
  // the biggest host this realm has EYES ON, not the biggest in the world.
  let mx = 0;
  (G.characters || []).forEach((c) => {
    if (
      c &&
      c.alive &&
      c.player != null &&
      c.player !== pi &&
      botRelationRaw(G, pi, c.player) === 'enemy' &&
      botSeesChar(G, pi, c)
    ) {
      const n = (c.armies || []).length;
      if (n > mx) mx = n;
    }
  });
  return mx;
}
// a CARRIER fleet type this province can raise (for sea conquest / troop transport), else null.
export function botCoastalFleetType(prov) {
  return (prov.armyTypes || []).find((t) => BOT_CARRIER_TYPES.has(t)) || null;
}
// Sept 2026: an at-war ENEMY coast one sea-hop from this province (the only naval reason worth a
// fleet while land remains to conquer).
export function botNavalEnemyCoast(G, prov, pi) {
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, prov, i);
    if (!N || N.terrain !== 'sea') continue;
    for (let j = 0; j < 6; j++) {
      const K = botNeighbourProv(G, N, j);
      const ko = botBelievedOwner(G, pi, K);
      if (K && K.terrain !== 'sea' && ko != null && ko !== pi && botRelationRaw(G, pi, ko) === 'enemy') return true;
    }
  } // believed owner, not the true one
  return false;
}
// how many fleet hulls the bot already leads across its whole roster (so it stops over-building
// ships).
export function botFleetHullCount(G, pi) {
  let h = 0;
  (G.characters || []).forEach((c) => {
    if (c && c.alive && c.player === pi)
      (c.armies || []).forEach((a) => {
        if (a && BOT_CARRIER_TYPES.has(a.type)) h++;
      });
  });
  return h;
}
export function runBotEconomy(G, botIdxSet) {
  if (!botIdxSet || !botIdxSet.size || !G.world) return;
  G.turnOrders = G.turnOrders || {};
  botIdxSet.forEach((pi) => {
    const player = G.players[pi];
    if (!player || player.conceded) return; // conceded realms spend nothing
    const L = botLedger(G, pi),
      roles = botRoles(G, pi);
    if (
      L.budget < 1 ||
      (L.upkeep >= L.upkeepCap && !(L.nav && L.nav.upkeep < L.nav.cap) && !(L.air && L.air.upkeep < L.air.cap))
    )
      return; // broke or every wage cap committed
    // A holder is a bot character not doing anything yet. NOTE: runTurn pre-populates
    // G.turnOrders[c.id] with an all-null array before the bot passes, and runBotMovement writes
    // movers' plans — so "idle" means every phase is still null (or a plain Defend), never a real
    // action.
    const isIdle = (c) => {
      const o = G.turnOrders[c.id];
      return !o || o.every((x) => x == null || x.action === 'defend' || botIsTeach(x));
    }; // a teaching phase (slayer school) is kept, the rest is filled
    // Leaders first (their host is the priority), then feeders raising troops to carry to a host.
    const holders = (G.characters || [])
      .filter((c) => c && c.alive && c.player === pi && !c._isHeir && isIdle(c))
      .sort((a, b) => (roles.leaders.includes(b.id) ? 1 : 0) - (roles.leaders.includes(a.id) ? 1 : 0));
    L.diag.holdersIdle = holders.length;
    L.diag.holdersInRecruit = holders.filter((c) => {
      const p = G.world.provinces[c.location];
      return p && p.owner === pi && (p.armyTypes || []).some((t) => t && !/garrison/i.test(t));
    }).length;
    holders.forEach((c) => {
      const prov = G.world.provinces[c.location];
      if (!prov || prov.owner !== pi) return; // must control the province to raise troops
      const orders = [null, null, null, null, null];
      let ph = 0;
      const hire = botHireOrder(G, pi, c, L);
      if (hire) orders[ph++] = hire;
      // Field troops muster to a co-located LEADER's banner when one stands here; else to the
      // holder
      // (a feeder, who then carries them to the nearest host next turn).
      const ld = (G.characters || []).find(
        (l) => l && l.alive && l.player === pi && roles.leaders.includes(l.id) && l.location === c.location,
      );
      const dest = ld && ld.id !== c.id ? ld.id : null;
      const toks = botFieldRecruitTokens(G, pi, c, prov, L);
      const ro = botRecruitOrder(toks, dest);
      if (ro && ph < 5) orders[ph++] = ro;
      // keep a single-unit garrison in every province (2/3 for valuable land / the capital once a
      // player is on our doorstep) — cheap tripwires, never a substitute for the field army.
      const go = botGarrisonOrder(G, pi, prov, L);
      if (go && ph < 5) orders[ph++] = go;
      {
        const prev = G.turnOrders[c.id] || [];
        const tp = [0, 1, 2, 3, 4].filter((p) => botIsTeach(prev[p])); // 2026-09-28: teaching phases stay where the slayer school put them
        if (tp.length && orders.some((o) => o)) {
          const q = orders.filter((o) => o);
          const merged = [null, null, null, null, null];
          tp.forEach((p) => {
            merged[p] = prev[p];
          });
          let k = 0;
          for (let p = 0; p < 5 && k < q.length; p++) {
            if (!merged[p]) merged[p] = q[k++];
          }
          orders.splice(0, 5, ...merged);
          ph = merged.filter(Boolean).length;
        }
      }
      if (orders.some((o) => o)) {
        const tail = botPracticeFallback(G, pi, c);
        for (let p = 0; p < 5; p++)
          if (!orders[p])
            orders[p] =
              p === ph
                ? { action: 'defend', target: '', extra: '', desc: 'Hold' }
                : tail
                  ? { ...tail }
                  : { action: 'defend', target: '', extra: '', desc: 'Hold' };
        G.turnOrders[c.id] = orders;
      }
    });
    // Sept 2026 (§94, idle gold): recruit OPPORTUNITIES were the binding constraint, not the ceiling.
    // (a) A marching leader recruits in the first owned recruit province his plan stands in with a filler
    //     phase to spare (the filler after his last move is usually Practice/Defend).
    // (b) With 20g+ in the chest, a specialist still TRAINING in an owned recruit province spends one phase
    //     mustering troops to carry to the nearest host next year (an armed hero is a feeder).
    const filler = (o) => !o || (['practice', 'defend', 'research', 'explore'].includes(o.action) && !botIsTeach(o)); // a teaching phase is not spare
    // review II A2: a leader, defender, armed hero or unassigned hero standing (or arriving) in an owned province
    // holding more than two garrison units takes the surplus up at his first filler phase there.
    (G.characters || []).forEach((c) => {
      if (!(c && c.alive && c.player === pi && !c._isHeir)) return;
      if (BOT_SPECIALIST_ROLES.has(c._botRole)) return; // scholars, scouts, spies, thieves and slayers stay unarmed
      const o = G.turnOrders[c.id];
      if (!Array.isArray(o)) return;
      let cur = G.world.provinces[c.location];
      if (!cur) return;
      for (let p = 0; p < 5; p++) {
        const x = o[p];
        if (x && x.action === 'move') {
          let N = null;
          if (String(x.target).startsWith('dir:')) {
            const d = BOT_HEX_DIRS.indexOf(String(x.target).slice(4));
            N = botNeighbourProv(G, cur, d);
          } else N = G.world.provinces[+x.target];
          if (!N) return;
          cur = N;
          continue;
        }
        if (x && x.action === 'pickup_army') return;
        if (filler(x) && !(x && x.action === 'defend' && p === 0 && c._botRole === 'defender')) {
          const po = botPickupOrder(G, pi, c, cur);
          if (po) {
            o[p] = po;
            return;
          }
        }
      }
    });
    (G.characters || []).forEach((c) => {
      if (!(c && c.alive && c.player === pi && !c._isHeir)) return;
      const o = G.turnOrders[c.id];
      if (!o || !o.some((x) => x && x.action === 'move')) return;
      if (!roles.leaders.includes(c.id)) return;
      let cur = G.world.provinces[c.location];
      if (!cur) return;
      for (let p = 0; p < 5; p++) {
        const x = o[p];
        if (x && x.action === 'move') {
          let N = null;
          if (String(x.target).startsWith('dir:')) {
            const d = BOT_HEX_DIRS.indexOf(String(x.target).slice(4));
            N = botNeighbourProv(G, cur, d);
          } else N = G.world.provinces[+x.target];
          if (!N) return;
          cur = N;
          continue;
        }
        if (filler(x) && cur.owner === pi && (cur.armyTypes || []).length && L.budget >= 2 && L.upkeep < L.upkeepCap) {
          const toks = botFieldRecruitTokens(G, pi, c, cur, L).filter(
            (t) => !BOT_SEA_ALL.has(t.split('|')[0]) || c._botRole === 'admiral',
          );
          const ro = botRecruitOrder(toks, null);
          if (ro) {
            o[p] = ro;
          }
          return;
        }
      }
    });
    // Sept 2026 (Toby): the KING TEACHES THE SCHOLAR — generalised 2026-09-26 (Toby: slayers must train fast enough to
    // clear a lair a year): EVERY TRAINEE IS MENTORED. The engine's mentor rule makes a practice automatic when a
    // friendly character in the same province practises the same skill in the same phase at a HIGHER level. So for
    // every character practising skill S at level L, any co-located realm character above L whose phase is a filler
    // (a practice that is not a host drill, or a Hold with nothing near) practises S too. Levels 1→3 that took a
    // slayer five or six years solo (15–20% a phase) now take one, whenever a better swordsman stands with him
    // (botTrainOrders walks him to one).
    {
      const locs = (ch) => {
        const o = G.turnOrders[ch.id] || [];
        const out = [];
        let cur = G.world.provinces[ch.location];
        for (let p = 0; p < 5; p++) {
          out.push(cur ? cur.id : null);
          const x = o[p];
          if (x && x.action === 'move' && cur) {
            let N = null;
            if (String(x.target).startsWith('dir:'))
              N = botNeighbourProv(G, cur, BOT_HEX_DIRS.indexOf(String(x.target).slice(4)));
            else N = G.world.provinces[+x.target];
            cur = N || cur;
          }
        }
        return out;
      };
      const mine = (G.characters || []).filter(
        (x) => x && x.alive && x.player === pi && !x._isHeir && Array.isArray(G.turnOrders[x.id]),
      );
      const L_ = new Map();
      mine.forEach((x) => L_.set(x.id, locs(x)));
      const filler = (m, p) => {
        const k = (G.turnOrders[m.id] || [])[p];
        if (!k) return true;
        if (k.action === 'practice')
          return !/drill the host|drill the fleet|lead the host cleanly/.test(k.desc || '') && !botIsTeach(k);
        return k.action === 'defend' && p > 0 && !botNearbyThreat(G, pi, m);
      };
      mine.forEach((t) => {
        const to = G.turnOrders[t.id];
        const tl = L_.get(t.id);
        for (let p = 0; p < 5; p++) {
          const x = to[p];
          if (!(x && x.action === 'practice' && x.target)) continue;
          const S = x.target;
          const lvl = (t.skills || {})[S] || 0;
          if (lvl >= 5) continue;
          // the best mentor standing here this phase — highest level above the trainee's
          let best = null;
          mine.forEach((m) => {
            if (m.id === t.id) return;
            const ml = (m.skills || {})[S] || 0;
            if (ml <= lvl) return;
            if (L_.get(m.id)[p] == null || L_.get(m.id)[p] !== tl[p]) return;
            if (!filler(m, p)) return;
            if (!best || ml > ((best.skills || {})[S] || 0)) best = m;
          });
          if (!best) continue;
          const mo = G.turnOrders[best.id];
          if (mo[p] && mo[p].action === 'practice' && mo[p].target === S) continue; // already teaching
          mo[p] = {
            action: 'practice',
            target: S,
            extra: '',
            desc: 'Practice ' + (SKILL_LABELS[S] || S) + ' (teach ' + t.name + ')',
          };
        }
      });
      // 2026-09-28 (Toby): SLAYER TRAINING PARTNERS. When a slayer practises Melee, Archery or a magic school, every
      // other realm character standing with him with that phase spare practises it too, whatever his own level:
      // one below the slayer is taught by him (the mentor rule — a guaranteed level), one at his level makes a
      // pair (+half the solo chance each), one above teaches him. A specialist's own craft practice (Sage, Spy…)
      // is left alone.
      const PARTNER_SK = new Set(['melee', 'archery', ...BOT_SCHOOLS]);
      mine
        .filter((t) => t._botRole === 'slayer')
        .forEach((t) => {
          const to = G.turnOrders[t.id];
          const tl = L_.get(t.id);
          if (!Array.isArray(to) || !tl) return;
          for (let p = 0; p < 5; p++) {
            const x = to[p];
            if (!(x && x.action === 'practice' && PARTNER_SK.has(x.target))) continue;
            const S = x.target;
            if (((t.skills || {})[S] || 0) >= 5) continue;
            mine.forEach((m) => {
              if (m.id === t.id) return;
              const ml = L_.get(m.id);
              if (!ml || ml[p] == null || ml[p] !== tl[p]) return;
              if (!filler(m, p)) return;
              const mo = G.turnOrders[m.id];
              const cur = mo[p];
              if (
                cur &&
                cur.action === 'practice' &&
                (cur.target === S || cur.target === BOT_SPECIALIST_SKILLS[m._botRole])
              )
                return;
              if (((m.skills || {})[S] || 0) >= 5 && ((t.skills || {})[S] || 0) >= ((m.skills || {})[S] || 0)) return;
              mo[p] = {
                action: 'practice',
                target: S,
                extra: '',
                desc: 'Practice ' + (SKILL_LABELS[S] || S) + ' (with ' + t.name + ')',
              };
            });
          }
        });
    }
    if (L.budget >= 20) {
      (G.characters || []).forEach((c) => {
        if (!(c && c.alive && c.player === pi && !c.isKing && !c._isHeir && !(c.armies || []).length)) return;
        if (L.budget < 2 || L.upkeep >= L.upkeepCap) return;
        const o = G.turnOrders[c.id];
        if (!o || !o.length || o.some((x) => x && x.action === 'move')) return;
        const training = o.some((x) => x && (x.action === 'practice' || x.action === 'explore'));
        if (!training) return; // 2026-09-26: Explore is a filler phase too (the explore-first fallback had closed this muster path)
        if (['scholar', 'spy'].includes(c._botRole)) return; // the court's scholars and spies keep at their books
        const prov = G.world.provinces[c.location];
        if (!prov || prov.owner !== pi || !(prov.armyTypes || []).length) return;
        const p = o.findIndex(
          (x) =>
            x &&
            (x.action === 'practice' || x.action === 'explore') &&
            !botIsTeach(x) &&
            !/\(taught by /.test(x.desc || ''),
        );
        if (p < 0) return;
        const toks = botFieldRecruitTokens(G, pi, c, prov, L).filter((t) => !BOT_SEA_ALL.has(t.split('|')[0]));
        const ro = botRecruitOrder(toks, null);
        if (ro) {
          ro.desc += ' (for the host)';
          o[p] = ro;
        }
      });
    }
    if (typeof window !== 'undefined' && Array.isArray(window.__botDiag))
      window.__botDiag.push({ turn: G.turn, pi, ...L.diag, budgetEnd: L.budget, upkeepEnd: L.upkeep }); // harness-only diagnostics
  });
}

// ══ BOT PLAYERS — Phase 3c: character actions (Practice / Rest / Explore) ═════ Runs AFTER
// movement (3a) and economy (3b): any bot character STILL idle — no move, no recruit — is given
// something useful instead of a bare Defend. All three actions are self-contained and zero-risk
// (a character that is attacked still fights, whatever its order), so this is purely additive.
// • wounded (hp < 60% max) → Rest (heal)
// • otherwise, a skill to raise → Practice it (permanent growth toward the drill cap of 5)
// • otherwise, province unmapped → Explore (reveal fog / find feature sites)
// • otherwise → leave to the default-to-Defend pass
// STAGED (not wired here): Search (fights a feature's guardian monster — a hero can DIE; needs a
// monster-strength gate like the guard gate, so it belongs with Phase 4 combat assessment) and
// action-phase spells / battle magic (school knowledge, per-turn limits, fizzle, and summon-before-
// battle timing that ties into Phase 4 — deferred to a dedicated spell pass).
export function botPracticeSkill(c) {
  const sk = c.skills || {};
  // Prefer the highest skill still below the drill cap (push a strength toward its level-5 perks).
  let best = null,
    bestLvl = -1;
  for (const k of Object.keys(sk)) {
    const v = sk[k] || 0;
    if (v < 5 && v > bestLvl) {
      best = k;
      bestLvl = v;
    }
  }
  if (best != null) return best;
  // No trainable existing skill — train a core combat/command skill from scratch, if any is
  // unmaxed.
  for (const k of ['melee', 'tactical', 'march']) {
    if ((sk[k] || 0) < 5) return k;
  }
  return null; // everything relevant already at the drill cap
}
// ══ BOT ORDER HYGIENE (2026-09-29, Toby) ════
// The last bot pass of the turn, after every planner has written its orders. A 30-game audit found 8.6% of bot
// orders could not have worked when they were given: Practice on a skill already at the drill cap of 5 (240 a
// game, many sources: the generic fillers, cross-training, the host/fleet drills), casts past the per-turn school
// limit (154 a game, mostly a second or third Elemental Summon / Skeletal Armies), a Hire of a hero the SAME realm
// had already hired, a hero the hirer will not be standing with, or one the treasury cannot pay (73), and column
// hand-overs whose Skeletal Armies then refuse a living commander and disband (2 a game).
// Rules (Toby): a hero at 5+ in a skill practises it ONLY to teach a comrade practising it beside him (or, for
// Tactical / Naval, to drill troops that can still improve). Heroes still train TOGETHER: a phase freed here is
// first offered to a comrade training in the same place (learn from him, teach him, or pair at equal level for
// +50% each), and a final pass pulls a free hero standing with a trainee into teaching or pairing with him.
export const BOT_PRACTICE_BASE = [0.25, 0.2, 0.15, 0.1, 0.05]; // the engine's solo chance by level (case 'practice')
export const BOT_HYG_CRAFT = new Set(['sage', 'explorer', 'spy', 'thief']);
export function botDrillUseful(c, S) {
  if (S !== 'tactical' && S !== 'naval') return false;
  const sea = new Set((KC_UNIT_CLASS && KC_UNIT_CLASS.sea) || []);
  return (c.armies || []).some(
    (a) =>
      a &&
      !a._isSkeletal &&
      !a._phantom &&
      (UNIT_DRILL_BASE[a.quality] || 0) > 0 &&
      (S === 'naval' ? sea.has(a.type) : !sea.has(a.type)),
  );
}
// `practised`: Practice orders on this school earlier in the turn. Like the player's order form
// (item 16, 2026-10-13), the limit assumes each one succeeds (+1 a time, training stops at 5).
export function botCastLimit(G, c, school, practised) {
  const raw = skillLevel(c, school),
    pr = practised || 0;
  const l = effSkillOf(
    pr && raw < 5 ? { ...c, skills: { ...(c.skills || {}), [school]: Math.min(5, raw + pr) } } : c,
    school,
    G.characters || [],
  );
  const w =
    G._minorHolders &&
    G._minorHolders.warlock &&
    G._minorHolders.warlock.charId === c.id &&
    _BEST_SCHOOL(c) === skillLevel(c, school)
      ? 1
      : 0;
  return (l >= 4 ? 3 : l >= 3 ? 2 : 1) + w;
}
export function runBotOrderHygiene(G, botIdxSet) {
  const tally = typeof window !== 'undefined' && window.__botHyg ? window.__botHyg : null;
  const bump = (k) => {
    if (tally) tally[k] = (tally[k] || 0) + 1;
  };
  botIdxSet.forEach((pi) => {
    const P = (G.players || [])[pi];
    if (!P) return;
    const mine = (G.characters || []).filter(
      (x) => x && x.alive && x.player === pi && !x._isHeir && Array.isArray(G.turnOrders[x.id]),
    );
    if (!mine.length) return;
    const LOC = new Map();
    mine.forEach((x) => LOC.set(x.id, botOrderLocs(G, x)));
    const lv = (ch, S) => (ch.skills || {})[S] || 0;
    const ord = (ch, p) => (G.turnOrders[ch.id] || [])[p];
    const at = (ch, p) => {
      const l = LOC.get(ch.id);
      return l ? l[p] : null;
    };
    const here = (a, b, p) => at(a, p) != null && at(a, p) === at(b, p);
    const isPr = (o) => !!(o && o.action === 'practice' && o.target);
    const isDrill = (o) => /drill the host|drill the fleet|lead the host cleanly/.test((o && o.desc) || '');
    const dead = []; // [char, phase] slots to refill
    // ── 1. SPELLS: the per-turn school limit, and one Elemental Summon a turn
    mine.forEach((c) => {
      const o = G.turnOrders[c.id];
      const used = {};
      let summoned = false;
      for (let p = 0; p < 5; p++) {
        const x = o[p];
        if (!(x && x.action === 'cast_spell')) continue;
        const d = SPELL_DEFS_P[x.target];
        if (!d || !d.school) continue;
        if (x.target === 'Elemental Summon') {
          if (summoned) {
            dead.push([c, p]);
            bump('summonTwice');
            continue;
          }
          summoned = true;
        }
        const lim = botCastLimit(
          G,
          c,
          d.school,
          o.slice(0, p).filter((y) => y && y.action === 'practice' && y.target === d.school).length,
        );
        used[d.school] = used[d.school] || 0;
        if (used[d.school] >= lim) {
          dead.push([c, p]);
          bump('overLimit');
          continue;
        }
        used[d.school]++;
      }
    });
    // ── 2. HIRES: one order per hero per realm, the hirer standing where the hero is, a wage the treasury can meet
    {
      const taken = new Set();
      let gold = P.gold || 0;
      const H = [];
      mine.forEach((c) => {
        const o = G.turnOrders[c.id];
        for (let p = 0; p < 5; p++) {
          const x = o[p];
          if (x && x.action === 'hire') H.push([c, p, x]);
        }
      });
      H.sort((a, b) => a[1] - b[1]);
      H.forEach(([c, p, x]) => {
        const h = (G.characters || []).find((z) => z && z.id === parseInt(x.target));
        if (!h || h.player !== null || !h.alive) {
          dead.push([c, p]);
          bump('hireGone');
          return;
        }
        if (taken.has(h.id)) {
          dead.push([c, p]);
          bump('hireTwice');
          return;
        }
        if (at(c, p) !== h.location) {
          dead.push([c, p]);
          bump('hireElsewhere');
          return;
        }
        const w = heroHireWage(P.alignment || 'Neutral', h.alignment, false, h);
        if (w == null || gold < w) {
          dead.push([c, p]);
          bump('hireUnaffordable');
          return;
        }
        taken.add(h.id);
        gold -= w;
      });
    }
    // ── 3. HAND-OVERS: Skeletal Armies follow only an Undead commander — keep them, pass on the rest
    mine.forEach((c) => {
      const o = G.turnOrders[c.id];
      for (let p = 0; p < 5; p++) {
        const x = o[p];
        if (!(x && x.action === 'leave_army' && x.extra)) continue;
        const r = (G.characters || []).find((z) => z && z.id === parseInt(x.extra));
        if (!r) continue;
        const undead =
          r.alignment === 'Undead' || (r.player != null && ((G.players || [])[r.player] || {}).alignment === 'Undead');
        if (undead) continue;
        const skel = (c.armies || []).filter((a) => a && a._isSkeletal);
        if (!skel.length) continue;
        const live = (c.armies || []).filter(
          (a) =>
            a &&
            !a._isSkeletal &&
            (x.target === 'all' ||
              String(x.target)
                .split(',')
                .map((t) => t.trim())
                .some((t) => t === a.type || t === a.unitName)),
        );
        if (!live.length) {
          dead.push([c, p]);
          bump('handoverAllSkeletal');
          continue;
        }
        x.target = live.map((a) => (a.unitName && !/,/.test(a.unitName) ? a.unitName : a.type)).join(',');
        x.desc = (x.desc || 'Hand column') + ' (the living only)';
        bump('handoverTrimmed');
      }
    });
    // ── 4. PRACTICE at the drill cap: only to teach, or to drill troops that can still improve
    mine.forEach((c) => {
      const o = G.turnOrders[c.id];
      for (let p = 0; p < 5; p++) {
        const x = o[p];
        if (!isPr(x)) continue;
        const S = x.target;
        if (lv(c, S) < 5) continue;
        if ((S === 'tactical' || S === 'naval') && botDrillUseful(c, S)) continue;
        if (
          mine.some(
            (t) => t.id !== c.id && here(t, c, p) && isPr(ord(t, p)) && ord(t, p).target === S && lv(t, S) < lv(c, S),
          )
        )
          continue; // teaching
        dead.push([c, p]);
        bump('practiceCapped');
      }
    });
    // ── refill each dead slot: join a comrade training here, else own best skill below 5, else drill, else hold
    const filler = (c, p) => {
      let best = null;
      mine.forEach((t) => {
        if (t.id === c.id || !here(t, c, p)) return;
        const o = ord(t, p);
        if (!isPr(o) || isDrill(o)) return;
        const S = o.target;
        if (!SKILL_LABELS[S]) return;
        const me = lv(c, S),
          him = lv(t, S);
        let sc = 0;
        if (me < 5 && him > me) sc = 3;
        else if (him < me) sc = 2;
        else if (me < 5 && him === me) sc = 1;
        if (sc && (!best || sc > best.sc)) best = { S, sc, t };
      });
      if (best)
        return {
          action: 'practice',
          target: best.S,
          extra: '',
          desc:
            'Practice ' +
            (SKILL_LABELS[best.S] || best.S) +
            ' (' +
            (best.sc === 3 ? 'taught by ' : best.sc === 2 ? 'teach ' : 'with ') +
            best.t.name +
            ')',
        };
      const S = botPracticeSkill(c);
      if (S) return { action: 'practice', target: S, extra: '', desc: 'Practice ' + (SKILL_LABELS[S] || S) };
      if (botDrillUseful(c, 'tactical'))
        return { action: 'practice', target: 'tactical', extra: '', desc: 'Practice Tactical (drill the host)' };
      if (botDrillUseful(c, 'naval'))
        return { action: 'practice', target: 'naval', extra: '', desc: 'Practice Naval (drill the fleet)' };
      return { action: 'defend', target: '', extra: '', desc: 'Hold' };
    };
    dead.forEach(([c, p]) => {
      G.turnOrders[c.id][p] = null;
    });
    dead.forEach(([c, p]) => {
      if (!G.turnOrders[c.id][p]) G.turnOrders[c.id][p] = filler(c, p);
    });
    // ── 5. TRAIN TOGETHER: a free hero standing with a trainee teaches him (a certain level), or pairs with him at
    // equal level when the pair's +50% beats his own solo chance. "Free" = a plain practice (not a drill, a lesson,
    // a pairing, a specialist's own craft, a slayer's ladder) or a Hold after Spring with no threat near.
    const free = (m, p) => {
      const k = ord(m, p);
      if (!k) return true;
      if (k.action === 'defend')
        return p > 0 && !/Watch|lies in wait/i.test(k.desc || '') && !botNearbyThreat(G, pi, m);
      if (!isPr(k) || isDrill(k) || /\((teach|taught by|with) /.test(k.desc || '')) return false;
      if (m._botRole === 'slayer' || m._botRole === 'mage') return false;
      if (BOT_HYG_CRAFT.has(k.target) && BOT_SPECIALIST_ROLES.has(m._botRole)) return false;
      return true;
    };
    for (let p = 0; p < 5; p++) {
      mine.forEach((t) => {
        const x = ord(t, p);
        if (!isPr(x) || isDrill(x)) return;
        const S = x.target;
        const tl = lv(t, S);
        if (tl >= 5 || !SKILL_LABELS[S]) return;
        if (
          mine.some((m) => m.id !== t.id && here(m, t, p) && isPr(ord(m, p)) && ord(m, p).target === S && lv(m, S) > tl)
        )
          return; // already taught
        let mentor = null;
        mine.forEach((m) => {
          if (m.id === t.id || !here(m, t, p) || !free(m, p)) return;
          if (lv(m, S) > tl && (!mentor || lv(m, S) > lv(mentor, S))) mentor = m;
        });
        if (mentor) {
          G.turnOrders[mentor.id][p] = {
            action: 'practice',
            target: S,
            extra: '',
            desc: 'Practice ' + (SKILL_LABELS[S] || S) + ' (teach ' + t.name + ')',
          };
          bump('teachAdded');
          return;
        }
        if (
          mine.some(
            (m) => m.id !== t.id && here(m, t, p) && isPr(ord(m, p)) && ord(m, p).target === S && lv(m, S) === tl,
          )
        )
          return; // already paired
        let peer = null;
        mine.forEach((m) => {
          if (peer || m.id === t.id || !here(m, t, p) || !free(m, p) || lv(m, S) !== tl) return;
          const k = ord(m, p);
          const own = isPr(k) ? (lv(m, k.target) < 5 ? BOT_PRACTICE_BASE[Math.min(4, lv(m, k.target))] : 0) : 0;
          if (BOT_PRACTICE_BASE[Math.min(4, tl)] * 1.5 >= own) peer = m;
        });
        if (peer) {
          G.turnOrders[peer.id][p] = {
            action: 'practice',
            target: S,
            extra: '',
            desc: 'Practice ' + (SKILL_LABELS[S] || S) + ' (with ' + t.name + ')',
          };
          bump('pairAdded');
        }
      });
    }
  });
}
