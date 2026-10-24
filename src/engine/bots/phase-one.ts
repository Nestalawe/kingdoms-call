// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import {
  BOT_DEF_BONUS,
  BOT_HEX_DIRS,
  BOT_SEA_ALL,
  botBattleForce,
  botConceded,
  botEffForce,
  botForceStrength,
  botMarginFor,
  botNeighbourProv,
  botRelationRaw,
  botSees,
  botTargetDefence,
  botTuning,
  botTurnCache,
  botVisibleCharsIn,
} from './intel.ts';
import {
  BOT_P1,
  botAtWar,
  botEnemyChars,
  botEnemyHostsIn,
  botFieldRecruitTokens,
  botHexDist,
  botHomeId,
  botInContact,
  botIsValuable,
  botLedger,
  botRecruitOrder,
  botRoles,
  botSchoolLimit,
} from './strategy.ts';
import { botMoveOrder, botNearbyThreat } from './specialists.ts';
import { botIsTeach } from './missions.ts';
import { skillLevel } from '../titles/perks.ts';

// ══ PHASE-ONE PASS (2026-09-29, Toby: "use phase 1 orders wisely") ═════════════════════════════════
// Engine facts it relies on: within a phase every NON-MOVING order (recruit, hand-over, cast,
// challenge…) resolves before anyone's Move, the Defend step sits between the two, a host caught on a
// war front fights at the END of Spring, a stalled battle resumes at the top of every phase, and a
// Flooded province is sea for the rest of the year (land armies there are stranded, none may enter).
// So what a bot writes into Spring (phase 1) happens before any enemy can march.
// Stage 'muster' (after the movement planner, BEFORE the economy — first claim on the chest):
//   W. WAR CHEST — the ledger holds back gold for every host in contact (botLedger); it is released
//      here, spent on those hosts' musters first, and whatever is left goes back to the economy.
//   A. TRIAGE — (1) a host on an enemy's ground or beside an enemy host, not locked in battle and
//      clearly outmatched, withdraws in Spring; (2) a host outmatched by an enemy host NEXT DOOR: if that
//      host is pinned by a Flood (botPins) the Flood goes off in Spring and the host withdraws in the
//      second phase ("flood, then retreat"); unpinned and badly outmatched, it withdraws in Spring. The
//      capital and Rich land are held instead (muster + pin).
//   R. RELIEF — a host locked in battle is joined in Spring by any armed character of ours standing
//      next door with nothing better to do; a feeder hands it his column in the second phase.
//   V. EVACUATION — an unarmed character (the king included) sharing a province with an enemy host, or
//      the king beside one on ground we cannot hold, leaves in Spring (or cloaks with Invisibility).
//   B. MUSTER — a host in contact in an OWNED province (a battle there does not stop it) with no
//      muster in its plan gets one in Spring, with an emergency levy past the wage ceiling.
// Stage 'order' (after every other pass):
//   E. NO SELF-FLOOD — a Flood on ground our own host stands on or marches into is struck out.
//   P. PINS — every Flood pin (botPins) is written into its caster's Spring.
//   B–D. REORDER — a stable sort of each plan's pre-move block: strikes (5), musters in contact (4),
//      guard magic and the watch under threat (3), hire (1), the rest (0).
// Reordering is confined to the orders before the first move (all resolve in the starting province).
// The pass's tuning, BOT_P1, and its contact tests, botEnemyHostsIn and botInContact, are in bots/strategy.ts.
export function botOrderDest(G, cur, o) {
  if (!cur || !o) return null;
  if (String(o.target).startsWith('dir:'))
    return botNeighbourProv(G, cur, BOT_HEX_DIRS.indexOf(String(o.target).slice(4)));
  const n = Number(o.target);
  return Number.isFinite(n) ? G.world.provinces[n] : null;
}
export function botIsFiller(o) {
  return (
    !o ||
    (o.action === 'defend' && o.desc !== 'Watch') ||
    ((o.action === 'practice' || o.action === 'explore' || o.action === 'research') && !botIsTeach(o))
  );
}
// FLOOD PINS (2026-09-29, Toby: flood to slow the enemy, and to lock a host in place while we strike
// elsewhere). Chosen from the start-of-year board, lazily, before the movement planner reads them:
// every visible at-war enemy host on land not ours, bordering our land or within two hexes of a host
// of ours, that no host / garrison of ours beside it could meet at BOT_PIN_EDGE, strongest first, each
// given to one of our Elemental casters standing NEXT to it (never in it) with a casting to spare.
// The planner treats a pinned province as sea this year — no attack into it, and no longer a "trap"
// beside a target — so the generals strike the unflooded provinces around it instead.
export const BOT_PIN_EDGE = 1.2;
export function botPins(G, pi) {
  const cache = botTurnCache(G);
  cache.pins = cache.pins || {};
  if (cache.pins[pi]) return cache.pins[pi];
  const pins = new Map();
  cache.pins[pi] = pins;
  if (!botAtWar(G, pi)) return pins;
  const mine = (G.characters || []).filter((c) => c && c.alive && c.player === pi && !c._isHeir);
  const casters = mine.filter((c) => ((c.skills || {}).elemental || 0) >= 1);
  if (!casters.length) return pins;
  const hosts = mine.filter((c) => (c.armies || []).length);
  const cands = [];
  (G.world.provinces || []).forEach((X) => {
    if (!X || X.terrain === 'sea' || X._flood || X.owner === pi || !botSees(G, pi, X.id)) return;
    const foes = botEnemyHostsIn(G, pi, X);
    if (!foes.length) return;
    if (hosts.some((h) => h.location === X.id)) return;
    const s = foes.reduce((t, e) => t + botForceStrength(e.armies), 0);
    let border = false,
      best = 0;
    for (let i = 0; i < 6; i++) {
      const K = botNeighbourProv(G, X, i);
      if (!K) continue;
      if (K.owner === pi) border = true;
      let f = K.owner === pi ? botForceStrength(K.garrisonArmies) : 0;
      hosts.forEach((h) => {
        if (h.location === K.id) f += botForceStrength(h.armies);
      });
      if (f > best) best = f;
    }
    const near = hosts.some((h) => {
      const H = G.world.provinces[h.location];
      return H && botHexDist(G, H, X) <= 2;
    });
    if (!border && !near) return;
    if (best >= s * BOT_PIN_EDGE) return; // beatable where it stands — let it come, or go and break it
    cands.push({ X, s });
  });
  cands.sort((a, b) => b.s - a.s);
  const used = new Map();
  cands.forEach(({ X }) => {
    const cs = casters
      .filter((c) => {
        const P = G.world.provinces[c.location];
        return (
          P &&
          P.id !== X.id &&
          botAdj(G, P, X) &&
          (used.get(c.id) || 0) < botSchoolLimit((c.skills || {}).elemental || 0)
        );
      })
      .sort((a, b) => ((a.armies || []).length ? 1 : 0) - ((b.armies || []).length ? 1 : 0))[0]; // an unarmed mage before a general
    if (cs) {
      pins.set(X.id, cs.id);
      used.set(cs.id, (used.get(cs.id) || 0) + 1);
    }
  });
  return pins;
}
// Write "Flood X" into a character's Spring: drop a filler from the pre-move block (or the last
// phase if it is a filler, shifting the plan a phase); make room in the school's casting limit.
export function botAdj(G, A, B) {
  if (!A || !B) return false;
  if (A.id === B.id) return true;
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, A, i);
    if (N && N.id === B.id) return true;
  }
  return false;
}
export function botPutSpring(o, order) {
  let end = o.findIndex((x) => x && BOT_P1.reloc.has(x.action));
  if (end < 0) end = 5;
  const fi = o.findIndex((x, i) => i < end && botIsFiller(x));
  if (fi >= 0) {
    o.splice(fi, 1);
    o.unshift(order);
    return true;
  }
  if (botIsFiller(o[4])) {
    o.splice(4, 1);
    o.unshift(order);
    return true;
  }
  return false;
}
export function botSafeStep(G, pi, P, awayFrom) {
  let best = null;
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, P, i);
    if (!N || N.terrain === 'sea' || N._flood) continue;
    const own = N.owner === pi,
      ally = N.owner != null && botRelationRaw(G, pi, N.owner) === 'allied';
    if (!own && !ally) continue;
    if (botEnemyHostsIn(G, pi, N).length) continue;
    let near = 0;
    for (let j = 0; j < 6; j++) {
      const K = botNeighbourProv(G, N, j);
      if (K && botEnemyHostsIn(G, pi, K).length) near++;
    }
    const sc =
      (own ? 10 : 0) +
      (N.id === botHomeId(G, pi) ? 5 : 0) +
      (N.tax || 0) -
      near * 6 +
      (awayFrom ? botHexDist(G, N, awayFrom) * 4 : 0);
    if (!best || sc > best.sc) best = { N, i, sc };
  }
  return best;
}
export function runBotPhaseOne(G, botIdxSet, stage) {
  const MUSTER = stage === 'muster';
  if (!botIdxSet || !botIdxSet.size || !G.world) return;
  botIdxSet.forEach((pi) => {
    if (botConceded(G, pi)) return;
    const L = botLedger(G, pi);
    if (MUSTER && L.warChest) {
      L.budget += L.warChest;
      L.warChest = 0;
    } // W: the chest opens for the hosts in contact
    const mine = (G.characters || []).filter(
      (c) => c && c.alive && c.player === pi && !c._isHeir && Array.isArray(G.turnOrders[c.id]),
    );
    const leaderIds = new Set(botRoles(G, pi).leaders || []);
    const pins = botPins(G, pi),
      pinCasters = new Set(pins.values());
    const spring = new Set(); // characters whose plans this pass rewrote outright
    const valuable = (P) => P && P.owner === pi && botIsValuable(G, P, pi);
    const hold = (d) => ({ action: 'defend', target: '', extra: '', desc: d || 'Hold' });
    if (MUSTER) {
      // ── A: triage ──
      mine.forEach((c) => {
        const o = G.turnOrders[c.id];
        const P = G.world.provinces[c.location];
        if (!P || !(c.armies || []).length || P._battleUnresolved) return;
        if (o[0] && o[0].action === 'move' && !/^Advance/.test(o[0].desc || '')) return; // already marching somewhere on purpose
        let mineStr = 0;
        botVisibleCharsIn(G, pi, P).forEach((x) => {
          if (x.player === pi) mineStr += botBattleForce(G, x, null, P.terrain, {});
        });
        const onEnemy = P.owner != null && P.owner !== pi && botRelationRaw(G, pi, P.owner) === 'enemy',
          here = botEnemyHostsIn(G, pi, P);
        if (onEnemy || here.length) {
          // A1
          let foe = onEnemy ? botTargetDefence(G, pi, P) : 0;
          if (!onEnemy)
            here.forEach((e) => {
              foe += botBattleForce(G, e, null, P.terrain, { defending: true, viewerPi: pi });
            });
          if (foe > 0 && mineStr < foe * BOT_P1.retreatRatio) {
            const st = botSafeStep(G, pi, P, null);
            if (st) {
              const out = [botMoveOrder(st.i, 'Withdraw from ' + P.name + ' to ' + st.N.name + ' (outmatched)')];
              if (st.N.owner === pi) {
                const ro = botRecruitOrder(
                  botFieldRecruitTokens(G, pi, c, st.N, L).filter((t) => !BOT_SEA_ALL.has(t.split('|')[0])),
                  null,
                );
                if (ro) out.push(ro);
              }
              while (out.length < 5) out.push(hold());
              G.turnOrders[c.id] = out;
              spring.add(c.id);
            }
          }
          return;
        }
        // A2 — the strongest enemy host next door
        let worst = null;
        for (let i = 0; i < 6; i++) {
          const N = botNeighbourProv(G, P, i);
          if (!N) continue;
          const f = botEnemyHostsIn(G, pi, N).reduce(
            (t, e) => t + botBattleForce(G, e, null, P.terrain, { viewerPi: pi }),
            0,
          );
          if (f > 0 && (!worst || f > worst.f)) worst = { N, f };
        }
        if (!worst) return;
        const gar =
          P.owner === pi
            ? botBattleForce(G, null, P.garrisonArmies || [], P.terrain, { defending: true, ownerPi: pi })
            : 0;
        const ratio = (mineStr + gar) / worst.f;
        if (ratio >= BOT_P1.retreatRatio || valuable(P)) return; // hold the capital and Rich land (muster + pin)
        const pinned = pins.has(worst.N.id);
        if (!pinned && ratio >= BOT_P1.fleeRatio) return;
        const st = botSafeStep(G, pi, P, worst.N);
        if (!st) return;
        const mv = botMoveOrder(st.i, 'Withdraw to ' + st.N.name + (pinned ? ' behind the flood' : ' (outmatched)'));
        const out = pinned ? [hold('Stand while the flood rises'), mv] : [mv];
        while (out.length < 5) out.push(hold());
        G.turnOrders[c.id] = out;
        spring.add(c.id);
        if (pinned) {
          const cid = pins.get(worst.N.id);
          const k = (G.characters || []).find((x) => x && x.id === cid);
          if (k && k.id !== c.id && k.location === c.location) {
            // the caster floods, then goes with the host
            const fl = {
              action: 'cast_spell',
              target: 'Flood',
              extra: String(worst.N.id),
              desc: 'Flood ' + worst.N.name + ' — strand the enemy host',
            };
            const ko = [fl, { ...mv, desc: 'Withdraw with ' + c.name }];
            while (ko.length < 5) ko.push(hold());
            G.turnOrders[k.id] = ko;
            spring.add(k.id);
          } else if (k && k.id === c.id) {
            out[0] = {
              action: 'cast_spell',
              target: 'Flood',
              extra: String(worst.N.id),
              desc: 'Flood ' + worst.N.name + ' — strand the enemy host',
            };
          }
        }
      });
      // ── R: relieve a host locked in battle ──
      mine
        .filter(
          (h) =>
            (h.armies || []).length &&
            G.world.provinces[h.location] &&
            G.world.provinces[h.location]._battleUnresolved &&
            botEnemyHostsIn(G, pi, G.world.provinces[h.location]).length,
        )
        .forEach((h) => {
          const B = G.world.provinces[h.location];
          mine.forEach((x) => {
            if (x.id === h.id || spring.has(x.id) || !(x.armies || []).length || x.location === B.id) return;
            const X = G.world.provinces[x.location];
            if (!X || X.id === B.id || !botAdj(G, X, B) || X._battleUnresolved) return;
            if (x._botRole === 'defender' && B.owner !== pi) return; // a post leaves only to save our own ground
            const o = G.turnOrders[x.id] || [];
            if (o.some((y) => y && BOT_P1.reloc.has(y.action))) return; // already marching
            if (botInContact(G, pi, x) && X.owner === pi && botEnemyHostsIn(G, pi, X).length) return; // besieged himself
            let d = -1;
            for (let i = 0; i < 6; i++) {
              const N = botNeighbourProv(G, X, i);
              if (N && N.id === B.id) {
                d = i;
                break;
              }
            }
            if (d < 0) return;
            const out = [botMoveOrder(d, 'Reinforce ' + h.name + ' in the battle for ' + B.name)];
            if (!leaderIds.has(x.id))
              out.push({
                action: 'leave_army',
                target: 'all',
                extra: String(h.id),
                desc: 'Hand the column to ' + h.name,
              });
            while (out.length < 5) out.push(hold());
            G.turnOrders[x.id] = out;
            spring.add(x.id);
          });
        });
      // ── V: evacuate the unarmed ──
      mine.forEach((c) => {
        if ((c.armies || []).length || spring.has(c.id) || pinCasters.has(c.id)) return;
        const o = G.turnOrders[c.id];
        const P = G.world.provinces[c.location];
        if (!P) return;
        if (
          o.some(
            (x) =>
              x &&
              (BOT_P1.strike.has(x.target) ||
                ['steal', 'spy', 'encounter', 'challenge', 'grand_heist', 'assassinate', 'sabotage'].includes(
                  x.action,
                )),
          )
        )
          return; // there on purpose
        if (o[0] && o[0].action === 'move') return;
        const here = botEnemyHostsIn(G, pi, P).filter((e) => e._invisTurn !== G.turn);
        let danger = here.length > 0;
        if (!danger && c.isKing) {
          let f = 0;
          for (let i = 0; i < 6; i++) {
            const N = botNeighbourProv(G, P, i);
            if (N)
              botEnemyHostsIn(G, pi, N).forEach((e) => {
                f += botForceStrength(e.armies);
              });
          }
          if (f > 0) {
            let def = P.owner === pi ? botForceStrength(P.garrisonArmies) : 0;
            botVisibleCharsIn(G, pi, P).forEach((x) => {
              if (x.player === pi) def += botForceStrength(x.armies);
            });
            danger = def < f;
          }
        }
        if (!danger) return;
        if (((c.skills || {}).illusory || 0) >= 1 && !o.some((x) => x && x.target === 'Invisibility')) {
          o.unshift({
            action: 'cast_spell',
            target: 'Invisibility',
            extra: '',
            desc: 'Cast Invisibility (evacuate: an enemy host is at hand)',
          });
          o.length = 5;
          spring.add(c.id);
          return;
        }
        const st = botSafeStep(G, pi, P, P);
        if (!st) return;
        const out = [botMoveOrder(st.i, 'Evacuate to ' + st.N.name + ' (an enemy host is at hand)')];
        while (out.length < 5) out.push(hold());
        G.turnOrders[c.id] = out;
        spring.add(c.id);
      });
      // ── B: muster in contact (the war chest pays first) ──
      mine.forEach((c) => {
        if (spring.has(c.id) || !botInContact(G, pi, c)) return;
        const o = G.turnOrders[c.id];
        const P = G.world.provinces[c.location];
        if (!P || P.owner !== pi || !(P.armyTypes || []).length) return; // only in a province we control — a battle there does not stop it
        if (!(leaderIds.has(c.id) || (c.armies || []).length >= 2)) return;
        let end = o.findIndex((x) => x && BOT_P1.reloc.has(x.action));
        if (end < 0) end = 5;
        if (end === 0 && /^(Attack|Assault|Lightning strike)/.test((o[0] || {}).desc || '')) return; // striking first outranks mustering
        if (o.slice(0, end).some((x) => x && (x.action === 'recruit' || x.action === 'pickup_army'))) return;
        const _cap0 = L.upkeepCap;
        L.upkeepCap = Math.max(_cap0 * BOT_P1.levyCap, (L.upkeep || 0) + BOT_P1.levyWages); // EMERGENCY LEVY
        let toks = [];
        try {
          toks = botFieldRecruitTokens(G, pi, c, P, L).filter(
            (t) => !BOT_SEA_ALL.has(t.split('|')[0]) || c._botRole === 'admiral',
          );
        } finally {
          L.upkeepCap = _cap0;
        }
        const ro = botRecruitOrder(toks, null);
        if (!ro) return;
        ro.desc += ' (war chest — the enemy is at hand)';
        botPutSpring(o, ro);
      });
      return;
    }
    // ═══ stage 'order' ═══
    const entered = new Set();
    mine
      .filter((c) => (c.armies || []).length)
      .forEach((c) => {
        let cur = G.world.provinces[c.location];
        (G.turnOrders[c.id] || []).forEach((o) => {
          if (o && o.action === 'move') {
            const N = botOrderDest(G, cur, o);
            if (N) {
              entered.add(N.id);
              cur = N;
            }
          }
        });
      });
    mine.forEach((c) => {
      if ((c.armies || []).length) entered.add(c.location);
    });
    // E: never flood our own march or our own host
    mine.forEach((c) => {
      const o = G.turnOrders[c.id];
      o.forEach((x, i) => {
        if (x && x.action === 'cast_spell' && x.target === 'Flood' && entered.has(Number(x.extra))) o[i] = hold();
      });
    });
    // P: every pin is cast in Spring by its caster
    pins.forEach((cid, Xid) => {
      if (entered.has(Xid)) return;
      const k = mine.find((x) => x.id === cid);
      if (!k) return;
      const o = G.turnOrders[k.id];
      const X = G.world.provinces[Xid];
      if (!X) return;
      if (o[0] && o[0].action === 'cast_spell' && o[0].target === 'Flood' && Number(o[0].extra) === Xid) return;
      o.forEach((x, i) => {
        if (x && x.action === 'cast_spell' && x.target === 'Flood' && Number(x.extra) === Xid) o[i] = hold();
      });
      const lim = botSchoolLimit((k.skills || {}).elemental || 0),
        EL = new Set(['Flood', 'Earthquake', 'Elemental Summon']);
      let n = o.filter((x) => x && x.action === 'cast_spell' && EL.has(x.target)).length;
      for (let i = 4; i >= 0 && n >= lim; i--) {
        const x = o[i];
        if (
          x &&
          x.action === 'cast_spell' &&
          EL.has(x.target) &&
          !(x.target === 'Flood' && pins.has(Number(x.extra)))
        ) {
          o[i] = hold();
          n--;
        }
      }
      if (n >= lim) return;
      botPutSpring(o, {
        action: 'cast_spell',
        target: 'Flood',
        extra: String(Xid),
        desc: 'Flood ' + X.name + ' — strand the enemy host',
      });
    });
    // T: TACTICS ON THE WRITTEN PLANS (2026-09-29, Toby: "implement all of your other tactics"). Every
    // attack a general has written this year is prepared in Spring by whoever of ours can reach it:
    //   T1 SOFTEN — Plague (humanoid units lose a level) and Illusory Terrain (defenders fight disoriented)
    //      over each attack target, cast in Spring by any caster of ours standing in or next to it with a
    //      casting to spare — before any move, so even a Spring assault meets a weakened garrison.
    //   T2 FORCED MARCH — a March-7 general with two or more attacks this year makes the march between
    //      them (or the approach to the first) a Forced March: a 50% chance to slip past a battle that
    //      would otherwise stop him short of his second target.
    //   T3 FEINT — (after the reorder) a general whose first target sits beside an enemy host that would
    //      turn the battle if it rode to its aid sends one unit with a hero at his side, in Spring, into
    //      ANOTHER province of that realm beside the host but not beside his target: a host on Defend
    //      answers the incursion and can no longer reach his target from where it has gone.
    const attacksOf = (g) => {
      const out = [];
      let cur = G.world.provinces[g.location];
      (G.turnOrders[g.id] || []).forEach((x, i) => {
        if (!x || !BOT_P1.reloc.has(x.action) || x.action === 'encounter' || x.action === 'pursue') return;
        const N = botOrderDest(G, cur, x);
        if (!N) return;
        if (/^(Attack|Assault|Lightning strike)/.test(x.desc || '')) out.push({ N, i });
        cur = N;
      });
      return out;
    };
    const castsOf = (k, school, spells) =>
      (G.turnOrders[k.id] || []).filter((x) => x && x.action === 'cast_spell' && spells.has(x.target)).length;
    const SCH = {
      illusory: new Set(['Illusory Terrain', 'Invisibility', 'Phantasmal Armies']),
      necromancy: new Set(['Plague', 'Curse', 'Skeletal Armies']),
    };
    const softened = new Set();
    mine
      .filter((g) => (g.armies || []).length)
      .forEach((g) => {
        attacksOf(g).forEach(({ N }) => {
          if (N.terrain === 'sea' || N._flood || pins.has(N.id)) return;
          const enemyThere = (N.owner != null && N.owner !== pi) || botEnemyHostsIn(G, pi, N).length;
          if (!enemyThere) return;
          [
            ['illusory', 'Illusory Terrain', N._illusoryTerrain && N._illusoryTerrain.appliedTurn === G.turn],
            ['necromancy', 'Plague', N._plaguedTurn === G.turn],
          ].forEach(([school, spell, done]) => {
            if (done || softened.has(spell + ':' + N.id)) return;
            const k = mine.find((m) => {
              const P = G.world.provinces[m.location];
              if (!P || !botAdj(G, P, N)) return false;
              const lv = (m.skills || {})[school] || 0;
              if (lv < 1) return false;
              if (
                (G.turnOrders[m.id] || []).some(
                  (x) => x && x.action === 'cast_spell' && x.target === spell && Number(x.extra) === N.id,
                )
              )
                return true; // already on it
              return castsOf(m, school, SCH[school]) < botSchoolLimit(lv);
            });
            if (!k) return;
            softened.add(spell + ':' + N.id);
            const o = G.turnOrders[k.id];
            if (o.some((x) => x && x.action === 'cast_spell' && x.target === spell && Number(x.extra) === N.id)) {
              const i = o.findIndex(
                (x) => x && x.action === 'cast_spell' && x.target === spell && Number(x.extra) === N.id,
              );
              const x = o[i];
              o.splice(i, 1);
              o.unshift(x);
              return;
            } // move it to Spring
            botPutSpring(o, {
              action: 'cast_spell',
              target: spell,
              extra: String(N.id),
              desc: spell + ' over ' + N.name + ' (before ' + g.name + ' attacks)',
            });
          });
        });
        // T2 forced march
        if (skillLevel(g, 'march') >= 7) {
          const atk = attacksOf(g);
          const o = G.turnOrders[g.id];
          if (atk.length >= 2 && !o.some((x) => x && x.action === 'forced_march')) {
            let j = -1;
            for (let i = atk[0].i + 1; i < atk[atk.length - 1].i; i++) {
              if (o[i] && o[i].action === 'move') {
                j = i;
                break;
              }
            }
            if (j < 0) j = atk[1].i; // no march between them: the second assault itself goes in as a forced march
            if (j >= 0 && o[j] && o[j].action === 'move')
              o[j] = { ...o[j], action: 'forced_march', desc: 'Forced March — ' + (o[j].desc || 'march') };
          }
        }
      });
    // B–D: reorder each pre-move block
    mine.forEach((c) => {
      const o = G.turnOrders[c.id];
      const P = G.world.provinces[c.location];
      if (!P) return;
      const hostsHere = botEnemyHostsIn(G, pi, P);
      let hostsAdj = 0;
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, P, i);
        if (N) hostsAdj += botEnemyHostsIn(G, pi, N).length;
      }
      const contact = botInContact(G, pi, c),
        nearby = contact || botNearbyThreat(G, pi, c);
      let end = o.findIndex((x) => x && BOT_P1.reloc.has(x.action));
      if (end < 0) end = 5;
      const isEnemyChar = (id) => {
        const e = (G.characters || []).find((x) => x && x.id === Number(id));
        return !!(e && e.player != null && e.player !== pi && botRelationRaw(G, pi, e.player) !== 'allied');
      };
      const urgency = (x) => {
        if (!x) return 0;
        const a = x.action;
        if (a === 'cast_spell' && x.target === 'Invisibility') return 5; // the cloak stays ahead of the strikes it covers
        if (a === 'cast_spell' && BOT_P1.strike.has(x.target))
          return x.target === 'Charm' && !isEnemyChar(x.extra) ? 1 : 5; // a wanderer's Charm is a hire
        if (a === 'challenge') return 5;
        if (a === 'steal' && x.target !== 'garrison') return 5;
        if (contact) {
          if (a === 'recruit' && !/to:garrison/.test(x.target)) return 4;
          if (a === 'pickup_army' || a === 'harvest_field' || a === 'rite') return 4;
          if (a === 'leave_army' && leaderIds.has(Number(x.extra))) return 4;
          if (a === 'cast_spell' && BOT_P1.gainSpell.has(x.target)) return 4;
        }
        if (a === 'recruit' && /to:garrison/.test(x.target) && P.owner === pi && (hostsHere.length || hostsAdj))
          return 4;
        if (nearby) {
          if (a === 'cast_spell' && BOT_P1.guard.has(x.target)) return 3;
          if (a === 'feigned_retreat') return 3;
          if (a === 'defend' && x.desc === 'Watch') return 3;
        }
        if (a === 'hire') return 1;
        return 0;
      };
      const block = o.slice(0, end).map((x, i) => ({ x, i, u: urgency(x) }));
      if (block.some((b) => b.u > 1)) {
        block.sort((a, b) => b.u - a.u || a.i - b.i);
        block.forEach((b, k) => {
          o[k] = b.x;
        });
      }
    });
    // T3: FEINT (see above)
    {
      const T = botTuning(G, pi);
      mine
        .filter((g) => leaderIds.has(g.id) && (g.armies || []).length >= 3)
        .forEach((g) => {
          const S = G.world.provinces[g.location];
          if (!S || S._battleUnresolved) return;
          const atk = attacksOf(g);
          if (!atk.length) return;
          const t1 = atk[0].N;
          const mG = botMarginFor(G, pi, g, T),
            def1 = botTargetDefence(G, pi, t1),
            myF = botBattleForce(G, g, null, t1.terrain, {});
          if (myF < def1 * mG) return;
          let foe = null;
          for (let i = 0; i < 6; i++) {
            const X = botNeighbourProv(G, t1, i);
            if (!X || X.id === S.id || X.terrain === 'sea' || X._flood || pins.has(X.id)) continue;
            botEnemyHostsIn(G, pi, X).forEach((e) => {
              if (X.owner !== e.player) return;
              const f = botEffForce(G, e);
              if (!foe || f > foe.f) foe = { X, e, f };
            });
          }
          if (!foe || myF >= (def1 + foe.f * BOT_DEF_BONUS) * mG) return; // it could not turn the battle anyway
          const hero = mine.find(
            (h) =>
              h.id !== g.id &&
              h.location === g.location &&
              !h.isKing &&
              !(h.armies || []).length &&
              !spring.has(h.id) &&
              !pinCasters.has(h.id) &&
              (h.hp != null ? h.hp : h.maxHp || 20) >= (h.maxHp || 20) * 0.7 &&
              !(G.turnOrders[h.id] || []).some(
                (x) => x && ['steal', 'spy', 'encounter', 'challenge', 'hire'].includes(x.action),
              ),
          );
          if (!hero) return;
          let A = null;
          for (let i = 0; i < 6; i++) {
            const N = botNeighbourProv(G, S, i);
            if (
              !N ||
              N.terrain === 'sea' ||
              N._flood ||
              N.id === t1.id ||
              N.owner !== foe.e.player ||
              pins.has(N.id) ||
              entered.has(N.id)
            )
              continue;
            if (!botAdj(G, N, foe.X) || N.id === foe.X.id || botAdj(G, N, t1)) continue;
            A = { N, i };
            break;
          }
          if (!A) return;
          const unit = (g.armies || [])
            .filter((a) => a && !a._temporary && !BOT_SEA_ALL.has(a.type))
            .sort((x, y) => unitBaseStrength(x) - unitBaseStrength(y))[0];
          if (!unit) return;
          const o = G.turnOrders[g.id];
          const lv = {
            action: 'leave_army',
            target: unit.unitName || unit.type,
            extra: String(hero.id),
            desc:
              'Feint — ' +
              (unit.unitName || unit.type) +
              ' to ' +
              hero.name +
              ' to draw ' +
              foe.e.name +
              ' into ' +
              A.N.name,
          };
          if (!botPutSpring(o, lv)) return;
          const li = o.indexOf(lv);
          if (attacksOf(g)[0] && attacksOf(g)[0].i <= li) {
            o.splice(li, 1);
            while (o.length < 5) o.push(hold());
            return;
          } // the feint must go in before the blow falls
          const out = [];
          while (out.length < li) out.push(hold('Wait for the column'));
          out.push(botMoveOrder(A.i, 'Feint on ' + A.N.name + ' (draw ' + foe.e.name + ' away from ' + t1.name + ')'));
          while (out.length < 5) out.push(hold('Hold'));
          G.turnOrders[hero.id] = out.slice(0, 5);
          spring.add(hero.id);
          entered.add(A.N.id);
        });
    }
    // S: SECOND FRONT (2026-09-29, Toby: attack more than one province a year). A general whose host can
    // spare a detachment strong enough to take ANOTHER province next to where he stands — and still beat
    // his own first target — hands it in Spring to an unarmed hero at his side (never the king, never a
    // pin caster), who marches on that province in the same phase (hand-overs resolve before moves).
    {
      const T = botTuning(G, pi),
        taken = new Set(entered);
      mine
        .filter((g) => leaderIds.has(g.id) && (g.armies || []).length >= 4 && !spring.has(g.id))
        .forEach((g) => {
          const o = G.turnOrders[g.id];
          const P = G.world.provinces[g.location];
          if (!P || P._battleUnresolved) return;
          let cur = P,
            t1 = null;
          for (const x of o) {
            if (!x) continue;
            if (x.action === 'move') {
              const N = botOrderDest(G, cur, x);
              if (!N) break;
              if (/^(Attack|Assault)/.test(x.desc || '')) {
                t1 = N;
                break;
              }
              cur = N;
            }
          }
          const hero = mine.find(
            (h) =>
              h.id !== g.id &&
              h.location === g.location &&
              !h.isKing &&
              !(h.armies || []).length &&
              !spring.has(h.id) &&
              !pinCasters.has(h.id) &&
              (h.hp != null ? h.hp : h.maxHp || 20) >= (h.maxHp || 20) * 0.7 &&
              !(G.turnOrders[h.id] || []).some(
                (x) => x && ['steal', 'spy', 'encounter', 'challenge', 'hire'].includes(x.action),
              ),
          );
          if (!hero) return;
          const mH = botMarginFor(G, pi, hero, T),
            mG = botMarginFor(G, pi, g, T);
          let best = null;
          for (let i = 0; i < 6; i++) {
            const N = botNeighbourProv(G, P, i);
            if (
              !N ||
              N.terrain === 'sea' ||
              N._flood ||
              N.owner === pi ||
              taken.has(N.id) ||
              pins.has(N.id) ||
              (t1 && N.id === t1.id)
            )
              continue;
            if (N.owner != null && botRelationRaw(G, pi, N.owner) !== 'enemy') continue;
            const d = botTargetDefence(G, pi, N) + botEnemyChars(G, N, pi).force * BOT_DEF_BONUS;
            const sc = (N.tax || 0) * 2 + (N.owner != null ? 8 : 0) - d / 4;
            if (!best || sc > best.sc) best = { N, i, d, sc };
          }
          if (!best) return;
          // weakest units first until the detachment would take N
          const ranked = (g.armies || [])
            .filter((a) => a && !a._temporary && !BOT_SEA_ALL.has(a.type))
            .map((a) => ({ a, v: unitBaseStrength(a) }))
            .sort((x, y) => x.v - y.v);
          const give = [];
          for (const r of ranked) {
            if (best.d <= 0 && give.length >= 1) break;
            give.push(r.a);
            if (botBattleForce(G, hero, give, best.N.terrain, {}) >= best.d * mH) break;
          }
          if (!give.length || give.length >= (g.armies || []).length - 1) return;
          if (best.d > 0 && botBattleForce(G, hero, give, best.N.terrain, {}) < best.d * mH) return;
          if (t1) {
            const keep = (g.armies || []).filter((a) => !give.includes(a));
            if (botBattleForce(G, g, keep, t1.terrain, {}) < botTargetDefence(G, pi, t1) * mG) return;
          }
          const lv = {
            action: 'leave_army',
            target: give.map((a) => a.unitName || a.type).join(','),
            extra: String(hero.id),
            desc:
              'Second front — ' +
              give.length +
              ' unit' +
              (give.length !== 1 ? 's' : '') +
              ' to ' +
              hero.name +
              ' for ' +
              best.N.name,
          };
          if (!botPutSpring(o, lv)) return;
          const li = o.indexOf(lv);
          const ho = G.turnOrders[hero.id] || [];
          const keepCasts = ho.filter((x, i) => x && x.action === 'cast_spell' && BOT_P1.strike.has(x.target) && i < 3);
          const out = [...keepCasts];
          while (out.length < li) out.push(hold('Wait for the column'));
          out.push(botMoveOrder(best.i, (best.d > 0 ? 'Attack ' : 'Advance on ') + best.N.name + ' (second front)'));
          while (out.length < 5) out.push(hold('Hold ' + best.N.name));
          G.turnOrders[hero.id] = out.slice(0, 5);
          spring.add(hero.id);
          taken.add(best.N.id);
        });
    }
  });
}
