// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng } from '../rng.ts';
import { GUARDIAN_POWER_RANK, SKILL_LABELS, STEAL_TIER_PEN } from '../army-tables.ts';
import { GRAND_HEIST_RICH_TAX } from '../items/tiers-and-hoards.ts';
import { featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import {
  BOT_DEF_BONUS,
  BOT_HEX_DIRS,
  BOT_SEA_ALL,
  botAlignFriendly,
  botBattleForce,
  botBelief,
  botBelievedOwner,
  botDruidShortfall,
  botEffForce,
  botForceStrength,
  botKnows,
  botKnowsGraves,
  botMarginFor,
  botMutualFoe,
  botNeighbourProv,
  botRelationRaw,
  botSees,
  botSeesChar,
  botTargetDefence,
  botTurnCache,
  botVisibleCharsIn,
} from './intel.ts';
import { botDefenceNeed, botEnemyChars, botIsLoadedFleet, botIsValuable, botSeaCap } from './war.ts';
import { BOT_SPECIALIST_SKILLS } from './specialist-skills.ts';
import {
  BOT_SLAYER_FIGHTERS_ONLY,
  botFieldRecruitTokens,
  botFleetOnly,
  botHeroCap,
  botHexDist,
  botHomeId,
  botIsFighter,
  botLandReach,
  botPassable,
  botRecruitOrder,
  botRoles,
} from './strategy.ts';
import { BOT_SCHOOLS } from './schools.ts';
import {
  botAllyNear,
  botDuelSkill,
  botEnemyIntel,
  botHostMargin,
  botLairCandidates,
  botLairPlan,
  botMasteryPre,
  botPickupOrder,
  botRememberedHostAt,
  botSkillsUnknown,
  botSlayerHasLairsToGrowInto,
  botSlayerTrainSkill,
} from './missions.ts';
import { BOT_NAVAL_TYPES, botAtWar, botPracticeSkill } from './economy.ts';
import {
  botBeatableLairIn,
  botCastPlan,
  botCrossTrainSkill,
  botPathAny,
  botPathLenAny,
  botPlannedAttackTarget,
  botSchoolLimit,
  botTargetTitles,
  botTitleFocusSkill,
} from './spellcraft.ts';
import { botPins } from './phase-one.ts';

// ── MAGE (2026-09-26, Toby): a specialist who focuses on TWO schools of magic — his strongest, and the next
// strongest (a complementary pick when he holds only one: Elemental with White, otherwise White with Elemental).
// He casts wherever a cast is worth making (botCastPlan already ranks every school's spells by the situation),
// stands with the general when nothing is, and trains the weaker of his two schools between times.
export function botMageSchools(c) {
  const s = (c && c.skills) || {};
  const ranked = [...BOT_SCHOOLS].sort(
    (a, b) => (s[b] || 0) - (s[a] || 0) || BOT_SCHOOLS.indexOf(a) - BOT_SCHOOLS.indexOf(b),
  );
  const s1 = ranked[0];
  let s2 = ranked.find((x) => x !== s1 && (s[x] || 0) > 0) || null;
  if (!s2) s2 = s1 === 'elemental' ? 'white' : 'elemental';
  return [s1, s2];
}
export function botMageAptitude(c) {
  const s = (c && c.skills) || {};
  const [a, b] = botMageSchools(c);
  return (s[a] || 0) * 4 + (s[b] || 0) * 3;
}
export const BOT_SPECIALIST_ROLES = new Set(Object.keys(BOT_SPECIALIST_SKILLS));
export const BOT_DEFEND_ORDER = { action: 'defend', target: '', extra: '', desc: 'Hold the post' };
export function botMagicScore(c) {
  const s = c.skills || {};
  return (s.elemental || 0) + (s.necromancy || 0) + (s.psychic || 0) + (s.illusory || 0) + (s.white || 0);
}
export function botLandCount(G, pi) {
  return (G.world.provinces || []).filter((p) => p && p.owner === pi && p.terrain !== 'sea').length;
}
// The six-hex Defend zone about a province (the engine's inDefendZone, in engine/units/defend-ride-outs-ambushes-and-reinforcements.ts, takes the turn's context).
export function botZoneOf(G, X) {
  const z = [X];
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, X, i);
    if (N) z.push(N);
  }
  return z;
}
// SPECIALIST ASSIGNMENT — cached per turn. `excluded` = ids already claimed (companions).
export function botSpecialistRoles(G, pi, excluded) {
  const cache = botTurnCache(G);
  cache.spec = cache.spec || {};
  if (cache.spec[pi]) return cache.spec[pi];
  const roles = botRoles(G, pi);
  const p = (G.players || [])[pi] || {};
  // Sept 2026 (Toby): the court's core is a general, a slayer and a scholar — and the KING may be any of the three.
  // He is a leader whenever his generalship ranks him one (botRoles); otherwise he takes slayer or scholar here.
  const heroes = (G.characters || []).filter(
    (c) =>
      c &&
      c.alive &&
      c.player === pi &&
      !c._isHeir &&
      !roles.leaders.includes(c.id) &&
      !roles.defenders.includes(c.id) &&
      !(c.armies || []).length &&
      !(excluded && excluded.has(c.id)),
  );
  const land = botLandCount(G, pi),
    met = botHasMetPlayers(G, pi),
    war = botAtWar(G, pi),
    turn = G.turn || 0;
  const unmapped = (G.world.provinces || []).filter(
    (x) => x && x.owner === pi && x.terrain !== 'sea' && ((x.exploredBy || {})[pi] || 0) < 100,
  ).length;
  const lairs = (G.world.provinces || []).reduce(
    (n, x) =>
      n +
      (x && x.terrain !== 'sea' && botKnows(G, pi, x.id)
        ? (x.features || []).filter((f) => f && !f.cleared && !f.ritualSite && f.monster && featDiscovered(f, pi))
            .length
        : 0),
    0,
  );
  const titles = botTargetTitles(G, pi); // review II A6: a chased title buys a second specialist
  const want = {
    slayer: 1 + (lairs >= 6 ? 1 : 0) + (titles.includes('monster') ? 1 : 0), // Sept 2026 (Toby): EVERY realm trains a guardian-killer from turn 1; a second once six lairs are known   // Sept 2026 (Toby): guardian-killers, trained for the lairs on the map
    scout: unmapped > 0 ? Math.min(3, 1 + Math.floor(unmapped / 6)) : 0,
    scholar: (land >= 10 ? 2 : 1) + (p.alignment === 'Neutral' ? 1 : 0) + (titles.includes('lore') ? 1 : 0), // Neutral scholars find twice as much   // 2026-09-26 (Toby item 4): a second scholar only at 10+ land — gold and armies come first (12 in the first cut cost a third of the discoveries)
    spy: (met || turn >= 3 ? (war ? 2 : 1) : 0) + (titles.includes('spy') ? 1 : 0),
    thief: met || turn >= 4 ? 1 : 0,
    mage:
      heroes.some((c) => BOT_SCHOOLS.some((k) => ((c.skills || {})[k] || 0) >= 1)) || turn >= 3
        ? 1 + (land >= 10 ? 1 : 0)
        : 0, // 2026-09-26 (Toby): a mage from the first hero who knows a school
  };
  if (titles.includes('carto')) want.scout += 1;
  // keep one hero free to muster / carry troops once there is a realm to feed
  const slots = Math.max(Math.min(2, heroes.length), heroes.length - (land >= 3 ? 1 : 0)); // the slayer and the scholar are never squeezed out by the feeder reserve
  const order = [
    'slayer',
    'scholar',
    'scout',
    'mage',
    'spy',
    'thief',
    'scholar',
    'mage',
    'spy',
    'slayer',
    'scout',
    'scholar',
    'scout',
  ]; // 2026-09-26: the mage after the scout   // slayer first (Toby), the scholar straight after (discoveries halved when he came third)
  const apt = (c, role) => {
    const s = c.skills || {};
    const k = BOT_SPECIALIST_SKILLS[role];
    if (c.isKing && role !== 'slayer') return -1e9; // Sept 2026 (Toby): a king is the general or the slayer — never scholar, scout, spy or thief
    if (role === 'mage')
      return (
        botMageAptitude(c) +
        (c._botRole === role ? 3 : 0) -
        ((s.melee || 0) + (s.archery || 0) + (s.tactical || 0)) * 0.5
      );
    if (BOT_SLAYER_FIGHTERS_ONLY && role === 'slayer' && !botIsFighter(c)) return -1e9; // 2026-09-28 (option 1, strict — off by default)
    if (role === 'slayer')
      return (
        (s.melee || 0) * 4 +
        (s.archery || 0) * 3 +
        (c.maxHp || 20) * 0.3 +
        (c._botRole === role ? 3 : 0) +
        ((s.elemental || 0) + (s.necromancy || 0) + (s.psychic || 0) + (s.white || 0)) * 0.5
      ); // 2026-09-26: a duelling school counts a little FOR a slayer (×1.5 handed the role to mages: Melee 1.9 at game end)
    return (
      (s[k] || 0) * 4 +
      (c._botRole === role ? 3 : 0) -
      ((s.melee || 0) + (s.archery || 0) + (s.tactical || 0)) * 0.5 -
      botMagicScore(c) * 0.5
    );
  };
  const byId = {},
    filled = {};
  const taken = new Set();
  let n = 0;
  for (const role of order) {
    if (n >= slots) break;
    if ((filled[role] || 0) >= (want[role] || 0)) continue;
    let best = null;
    heroes.forEach((c) => {
      if (taken.has(c.id)) return;
      const a = apt(c, role);
      if (a <= -1e8) return;
      if (!best || a > best.a) best = { c, a };
    }); // a barred candidate is never picked (the 1231 build could make a lone king a scout)
    if (!best) break;
    taken.add(best.c.id);
    byId[best.c.id] = role;
    filled[role] = (filled[role] || 0) + 1;
    n++;
  }
  // 2026-09-26 (Toby item 1/3): nobody sits idle. Every free hero the wanted counts did not claim (the one
  // muster reserve excepted) becomes a further scout while ground is unmapped, else a further slayer —
  // both explore and hunt lairs rather than drilling at the capital.
  for (const c of heroes) {
    if (n >= slots) break;
    if (taken.has(c.id) || c.isKing) continue;
    let role = unmapped > 0 ? 'scout' : 'slayer';
    if (BOT_SLAYER_FIGHTERS_ONLY && role === 'slayer' && !botIsFighter(c)) {
      let b = null;
      ['mage', 'scholar', 'scout', 'spy', 'thief'].forEach((r) => {
        const a = apt(c, r);
        if (a > -1e8 && (!b || a > b.a)) b = { r, a };
      });
      if (!b) continue;
      role = b.r;
    } // a non-fighter takes his best other craft
    taken.add(c.id);
    byId[c.id] = role;
    filled[role] = (filled[role] || 0) + 1;
    n++;
  }
  // 2026-09-26 (Toby): every hero also carries a SECONDARY specialist role (c._botRole2) — his next-best aptitude
  // — used whenever his primary role has no good action this year (botSpecialistOrders / the unarmed leader).
  const allMine = (G.characters || []).filter((c) => c && c.alive && c.player === pi && !c._isHeir && !c.isKing);
  allMine.forEach((c) => {
    const prim = byId[c.id] || c._botRole || null;
    let best = null;
    ['slayer', 'scholar', 'scout', 'mage', 'spy', 'thief'].forEach((role) => {
      if (role === prim) return;
      const a = apt(c, role);
      if (a <= -1e8) return;
      if (!best || a > best.a) best = { role, a };
    });
    c._botRole2 = best ? best.role : null;
  });
  heroes.forEach((c) => {
    if (byId[c.id]) c._botRole = byId[c.id];
    else if (BOT_SPECIALIST_ROLES.has(c._botRole)) delete c._botRole;
    // review II A11: a working thief fights by stealing and fleeing; anyone else keeps the engine's auto plan
    const ep = c.encounterPlan || {};
    if (c._botRole === 'thief' && ((c.skills || {}).thief || 0) >= 3) {
      c.encounterPlan = { ...ep, tactics: ['ST', 'FL', 'FL', 'FL', 'FL', 'FL'], _botTactics: true };
    } else if (ep._botTactics) {
      c.encounterPlan = { ...ep, tactics: [], _botTactics: false };
    }
  });
  const r = { byId, want, filled };
  cache.spec[pi] = r;
  return r;
}
export function botSpecialistOf(G, pi, c) {
  const s = botSpecialistRoles(G, pi);
  return s.byId[c.id] || null;
}
// TRAINING RENDEZVOUS — walk to the capital (through any land; unarmed) and practise `skill`.
export function botTrainOrders(G, pi, c, pre, skill, why) {
  const P = G.world.provinces[c.location];
  const home = botHomeId(G, pi);
  const H = home != null ? G.world.provinces[home] : null;
  const mv = [];
  // 2026-09-26 (Toby): train WITH A MENTOR. The best realm character above the trainee's level in this skill who is
  // not marching this year and stands within three hops (own / allied / unowned land) is the rendezvous; the
  // mentor pass in runBotEconomy then makes his filler phases Practice the same skill, and the engine's mentor
  // rule makes every such phase an automatic level. Else the capital, as before.
  let dest = null,
    why2 = '';
  if (P) {
    const lvl = (c.skills || {})[skill] || 0;
    let best = null;
    (G.characters || []).forEach((m) => {
      if (!(m && m.alive && m.player === pi && m.id !== c.id && !m._isHeir)) return;
      const ml = (m.skills || {})[skill] || 0;
      if (ml <= lvl) return;
      const mo = G.turnOrders[m.id];
      if (Array.isArray(mo) && mo.some((x) => x && (x.action === 'move' || x.action === 'encounter'))) return;
      const d = m.location === c.location ? 0 : botPathLen(G, pi, P, m.location, true);
      if (d == null || d > 3) return;
      const sc = ml * 4 - d;
      if (!best || sc > best.sc) best = { m, d, sc };
    });
    if (best) {
      dest = best.m.location;
      why2 = ' with ' + best.m.name;
    }
  }
  if (dest == null && H && H.owner === pi) dest = home;
  if (dest != null && P && c.location !== dest) {
    const D = G.world.provinces[dest];
    const path = botPathDirs(G, pi, P, dest, Math.max(0, 4 - pre.length), true) || [];
    path.forEach((d) => mv.push(botMoveOrder(d, 'Rendezvous at ' + (D ? D.name : '') + why2)));
  }
  const pr = {
    action: 'practice',
    target: skill,
    extra: '',
    desc: 'Practice ' + (SKILL_LABELS[skill] || skill) + (why ? ' (' + why + ')' : ''),
  };
  const out = [...pre, ...mv];
  while (out.length < 5) out.push({ ...pr });
  return out.slice(0, 5);
}
// SCHOLAR — Research at Sage 2+ (Neutral: 1+; every Sage level is 5%, 10% for Neutral), else train Sage.
export function botScholarOrders(G, pi, c, pre) {
  const sg = (c.skills || {}).sage || 0;
  const neutral = ((G.players || [])[pi] || {}).alignment === 'Neutral';
  const working = neutral ? sg >= 1 : sg >= 2;
  if (!working) {
    // Sept 2026 (Toby): the scholar studies WITH THE KING (every king starts at Sage 1) — if the king's plan this
    // year keeps him in one province within three hops, the scholar goes there; otherwise the capital.
    const king = (G.characters || []).find((k) => k && k.alive && k.isKing && k.player === pi);
    const ko = king && G.turnOrders[king.id];
    if (king && king.location !== c.location && Array.isArray(ko) && !ko.some((x) => x && x.action === 'move')) {
      const P = G.world.provinces[c.location];
      const path = P ? botPathDirs(G, pi, P, king.location, Math.min(3, 4 - pre.length), true) || [] : [];
      const d = P ? botPathLen(G, pi, P, king.location, true) : null;
      if (d != null && path.length === d && d <= 3) {
        const out = [...pre, ...path.map((x) => botMoveOrder(x, 'Study with the king'))];
        while (out.length < 5)
          out.push({ action: 'practice', target: 'sage', extra: '', desc: 'Practice Sage (scholar)' });
        return out.slice(0, 5);
      }
    }
    return botTrainOrders(G, pi, c, pre, 'sage', 'scholar');
  }
  const research = { action: 'research', target: '', extra: '', desc: 'Research' };
  const pr = { action: 'practice', target: 'sage', extra: '', desc: 'Practice Sage (scholar)' };
  // a scholar still short of Sage 5 splits the year: three Research, two practices
  const out = [...pre];
  let k = 0;
  while (out.length < 5) {
    out.push(sg >= 5 || k < 3 ? { ...research } : { ...pr });
    k++;
  }
  return out;
}
// SCOUT — the nearest known land province (ours, or unowned) still short of fully mapped; walk there
// and Explore for the rest of the year. Wild (Creature/Monster) ground is where lairs lie: +bonus.
export function botScoutTarget(G, pi, c, maxD) {
  const from = G.world.provinces[c.location];
  if (!from) return null;
  let best = null;
  (G.world.provinces || []).forEach((X) => {
    if (!X || X.terrain === 'sea') return;
    if (X.owner !== pi) {
      if (!botKnows(G, pi, X.id)) return;
      const bo = botBelievedOwner(G, pi, X);
      if (bo != null) return;
    }
    const mapped = (X.exploredBy || {})[pi] || 0;
    if (mapped >= 100) return;
    const d = X.id === from.id ? 0 : botPathLen(G, pi, from, X.id, true);
    if (d == null || d > maxD) return;
    const wild = X.race && String(X.race).startsWith('Primal:') ? 15 : 0;
    const sc = (100 - mapped) / 4 + wild + (X.owner === pi ? 6 : 0) - d * 8;
    if (!best || sc > best.sc) best = { X, d, sc };
  });
  return best;
}
export function botScoutOrders(G, pi, c, pre) {
  const P = G.world.provinces[c.location];
  const t = botScoutTarget(G, pi, c, 4);
  if (!t) return null;
  const path = t.d > 0 ? botPathDirs(G, pi, P, t.X.id, 4, true) || [] : [];
  if (t.d > 0 && path.length !== t.d) return null;
  if (pre.length + path.length >= 5) return null;
  const out = [...pre, ...path.map((d) => botMoveOrder(d, 'Scout ' + t.X.name))];
  while (out.length < 5) out.push({ action: 'explore', target: '', extra: '', desc: 'Explore ' + t.X.name });
  return out;
}
// ROAM (2026-09-26, Toby item 5) — a hero sent out to FIND wandering heroes: the nearest known land
// province (not an enemy's) that none of the realm's characters has ever stood in, up to five hops
// through any land; explore on arrival so the walk maps ground too. Falls back to the scout target.
export function botRoamOrders(G, pi, c, pre) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  let best = null;
  (G.world.provinces || []).forEach((X) => {
    if (!X || X.terrain === 'sea' || X.id === P.id || !botKnows(G, pi, X.id)) return;
    const bo = botBelievedOwner(G, pi, X);
    if (bo != null && bo !== pi && botRelationRaw(G, pi, bo) !== 'allied') return;
    if ((X.visitedBy || []).includes(pi)) return;
    const d = botPathLenAny(G, P, X.id, 5);
    if (d == null) return;
    const sc = (X.tax || 0) - d * 3 + ((X.features || []).length ? 1 : 0);
    if (!best || sc > best.sc) best = { X, d, sc };
  });
  if (!best) return botScoutOrders(G, pi, c, pre);
  const path = botPathAny(G, P, best.X.id, 5) || [];
  if (path.length !== best.d || pre.length + path.length >= 5) return botScoutOrders(G, pi, c, pre);
  const out = [...pre, ...path.map((d) => botMoveOrder(d, 'Roam to ' + best.X.name + ' (seek heroes)'))];
  while (out.length < 5) out.push({ action: 'explore', target: '', extra: '', desc: 'Explore ' + best.X.name });
  return out;
}
// SPY — a rival's province the realm has seen, within reach; prefer capitals, wealth, war enemies and
// ground not spied lately. Memo of spied provinces lives on the player record (p._botSpyMemo).
export function botSpyTarget(G, pi, c, maxD) {
  const from = G.world.provinces[c.location];
  if (!from) return null;
  const memo = ((G.players || [])[pi] || {})._botSpyMemo || {};
  let best = null;
  (G.world.provinces || []).forEach((X) => {
    if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id)) return;
    const bo = botBelievedOwner(G, pi, X);
    if (bo == null || bo === pi || botRelationRaw(G, pi, bo) === 'allied') return;
    const d = X.id === from.id ? 0 : botPathLenAny(G, from, X.id, maxD);
    if (d == null) return;
    const b = botBelief(G, pi, X) || {};
    const home = ((G.players || [])[bo] || {}).homeProvinceId === X.id;
    const staleness = Math.min(4, (G.turn || 0) - (memo[X.id] || -99));
    let gen = 0;
    {
      const I = botEnemyIntel(G, pi);
      Object.values(I.generals).forEach((r) => {
        if (botRelationRaw(G, pi, r.player) !== 'enemy' || (G.turn || 0) - r.turn > 3) return;
        if (r.provId === X.id) gen += 5;
        else
          for (let i = 0; i < 6; i++) {
            const N = botNeighbourProv(G, X, i);
            if (N && N.id === r.provId) {
              gen += 2;
              break;
            }
          }
      });
    }
    let unknown = 0;
    botVisibleCharsIn(G, pi, X).forEach((e) => {
      if (e && e.player != null && e.player !== pi && botSkillsUnknown(G, pi, e))
        unknown += (e.armies || []).length ? 4 : 2;
    });
    const sc =
      (b.tax || 0) +
      (home ? 4 : 0) +
      (botRelationRaw(G, pi, bo) === 'enemy' ? 6 : 0) +
      staleness * 2 -
      d * 2 +
      gen +
      unknown; // Sept 2026: scout where the enemy's hosts were last seen; learn the skills of whoever stands there
    if (!best || sc > best.sc) best = { X, d, sc };
  });
  return best;
}
// INVISIBILITY FIRST (2026-09-26, idea 3): an Illusory 1+ character who will end a walk on ground that is not
// ours casts Invisibility before setting out — twice as hard to hit, +30% to flee, +15% to steal.
export function botCloakPre(G, pi, c, pre, destProv) {
  if (((c.skills || {}).illusory || 0) < 1 || pre.length >= 4) return pre;
  if (pre.some((o) => o && o.action === 'cast_spell' && o.target === 'Invisibility')) return pre;
  if (destProv && destProv.owner === pi) return pre;
  return [...pre, { action: 'cast_spell', target: 'Invisibility', extra: '', desc: 'Cast Invisibility' }];
}
export function botSpyOrders(G, pi, c, pre) {
  const P = G.world.provinces[c.location];
  // Sept 2026 (Toby): learn a rival's skills before anyone decides to fight him — a character standing here whose
  // skills our spies have not reported (generals and kings first) is spied on this phase.
  {
    const mark = botVisibleCharsIn(G, pi, P || {})
      .filter(
        (e) =>
          e &&
          e.alive &&
          e.player != null &&
          e.player !== pi &&
          botRelationRaw(G, pi, e.player) !== 'allied' &&
          botSkillsUnknown(G, pi, e) &&
          e._invisTurn !== G.turn,
      )
      .sort(
        (a, b) => (b.armies || []).length * 2 + (b.isKing ? 5 : 0) - ((a.armies || []).length * 2 + (a.isKing ? 5 : 0)),
      )[0];
    if (mark && pre.length < 4) {
      const out = [
        ...pre,
        { action: 'spy', target: 'char:' + mark.id, extra: '', desc: 'Spy on ' + mark.name },
        { action: 'spy', target: '', extra: '', desc: 'Spy on ' + (P ? P.name : '') },
      ];
      while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
      return out;
    }
  }
  // Sept 2026: SHADOW A GENERAL — an at-war (or future-foe) general seen within two turns whose skills are
  // unreported: walk to where he was last seen and spy on him there (he may have moved; the order then fails
  // harmlessly and the spy reports the province instead).
  {
    const I = botEnemyIntel(G, pi);
    let best = null;
    Object.keys(I.generals).forEach((k) => {
      const r = I.generals[k];
      if ((G.turn || 0) - r.turn > 2) return;
      const e = (G.characters || []).find((x) => x && x.id === +k);
      if (!e || !e.alive || !botSkillsUnknown(G, pi, e)) return;
      if (botRelationRaw(G, pi, r.player) === 'allied') return;
      if (r.provId === c.location) return;
      const X = G.world.provinces[r.provId];
      if (!X) return;
      const d = botPathLenAny(G, P, X.id, 3);
      if (d == null || d + pre.length > 3) return;
      const sc = r.units * 2 + (r.isKing ? 6 : 0) + (botRelationRaw(G, pi, r.player) === 'enemy' ? 5 : 0) - d * 2;
      if (!best || sc > best.sc) best = { e, X, d, sc };
    });
    if (best) {
      const path = botPathAny(G, P, best.X.id, 3) || [];
      if (path.length === best.d) {
        const out = [
          ...pre,
          ...path.map((d) => botMoveOrder(d, 'Shadow ' + best.e.name)),
          { action: 'spy', target: 'char:' + best.e.id, extra: '', desc: 'Spy on ' + best.e.name },
        ];
        if (out.length < 5) out.push({ action: 'spy', target: '', extra: '', desc: 'Spy on ' + best.X.name });
        while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
        return out;
      }
    }
  }
  const t = botSpyTarget(G, pi, c, 4);
  if (!t) return null;
  const path = t.d > 0 ? botPathAny(G, P, t.X.id, 4) || [] : [];
  if (t.d > 0 && path.length !== t.d) return null;
  if (pre.length + path.length >= 5) return null;
  const p = (G.players || [])[pi];
  if (p) {
    p._botSpyMemo = p._botSpyMemo || {};
    p._botSpyMemo[t.X.id] = G.turn;
  }
  pre = botCloakPre(G, pi, c, pre, t.X);
  if (pre.length + path.length >= 5) pre = pre.filter((o) => !(o && o.target === 'Invisibility'));
  const out = [...pre, ...path.map((d) => botMoveOrder(d, 'Slip into ' + t.X.name))];
  const spy = { action: 'spy', target: '', extra: '', desc: 'Spy on ' + t.X.name };
  // two attempts, then lie in wait (a Defend with no column is an ambush watch)
  let k = 0;
  while (out.length < 5) {
    out.push(k < 2 ? { ...spy } : { action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
    k++;
  }
  return out;
}
// THIEF — a visible rival hero (at-war, or a crown the spectrum makes a future foe) or a rival garrison
// paymaster, within reach. Heroes leading troops halve the chance, so they score lower.
export function botStealTarget(G, pi, c, maxD) {
  const from = G.world.provinces[c.location];
  if (!from) return null;
  let best = null;
  const hostile = (j) =>
    j != null &&
    j !== pi &&
    botRelationRaw(G, pi, j) !== 'allied' &&
    (botRelationRaw(G, pi, j) === 'enemy' || !botAlignFriendly(G, pi, j));
  (G.characters || []).forEach((e) => {
    if (!(e && e.alive && e.player != null && hostile(e.player) && botSeesChar(G, pi, e))) return;
    if (e._invisTurn === G.turn) return;
    const d = e.location === from.id ? 0 : botPathLenAny(G, from, e.location, maxD);
    if (d == null) return;
    const sc =
      (e.isKing ? 6 : 3) +
      (e.items || []).length * 2 -
      ((e.armies || []).length ? 5 : 0) -
      d * 2 +
      (((G.players || [])[e.player] || {}).homeProvinceId === e.location ? 3 : 0); // idea 7: a rival crown's capital is where the purses are
    if (!best || sc > best.sc) best = { kind: 'char', e, provId: e.location, d, sc };
  });
  (G.world.provinces || []).forEach((X) => {
    if (!X || X.terrain === 'sea' || !botSees(G, pi, X.id)) return;
    if (!hostile(X.owner) || !(X.garrisonArmies || []).length) return;
    const d = X.id === from.id ? 0 : botPathLenAny(G, from, X.id, maxD);
    if (d == null) return;
    const sc = Math.min(4, (X.garrisonArmies || []).length) - d * 2;
    if (!best || sc > best.sc) best = { kind: 'garrison', provId: X.id, d, sc, X };
  });
  return best;
}
export function botThiefOrders(G, pi, c, pre) {
  const P = G.world.provinces[c.location];
  // 2026-09-26 (idea 7): GRAND HEIST — a Thief 7+ at war walks (cloaked) into the richest seen enemy capital or
  // Rich province within four hops and breaks into its vaults; the attempt is once a turn.
  if (((c.skills || {}).thief || 0) >= 7 && botAtWar(G, pi) && P) {
    let best = null;
    (G.world.provinces || []).forEach((X) => {
      if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id)) return;
      const bo = botBelievedOwner(G, pi, X);
      if (bo == null || bo === pi || botRelationRaw(G, pi, bo) !== 'enemy') return;
      const home = ((G.players || [])[bo] || {}).homeProvinceId === X.id;
      const b = botBelief(G, pi, X) || {};
      if (!home && (b.tax || 0) < GRAND_HEIST_RICH_TAX) return;
      const d = X.id === P.id ? 0 : botPathLenAny(G, P, X.id, 4);
      if (d == null) return;
      const guarded = (X.garrisonArmies || []).length > 0 && botSees(G, pi, X.id) ? 6 : 0;
      const sc = (((G.players || [])[bo] || {}).gold || 0) / 4 + (home ? 4 : 0) - guarded - d * 2;
      if (!best || sc > best.sc) best = { X, d, sc };
    });
    if (best) {
      const path = best.d > 0 ? botPathAny(G, P, best.X.id, 4) || [] : [];
      let pre2 = botCloakPre(G, pi, c, pre, best.X);
      if (pre2.length + path.length >= 5) pre2 = pre;
      if (path.length === best.d && pre2.length + path.length < 5) {
        const out = [
          ...pre2,
          ...path.map((d) => botMoveOrder(d, 'Creep toward the vaults of ' + best.X.name)),
          { action: 'grand_heist', target: '', extra: '', desc: 'Grand Heist — ' + best.X.name },
        ];
        while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie low' });
        return out;
      }
    }
  }
  // review II A11: a Thief 3+ robs a guardian's hoard by the STEAL tactic (50 + 10×Thief − tier penalty, Weak 0 /
  // Moderate 15 / Powerful 30 / Legendary 45) when that reads 75%+ — his encounter plan is Steal-then-flee
  // (set in botSpecialistRoles), so a failed steal ends in flight rather than a fight.
  {
    const th = Math.min(5, (c.skills || {}).thief || 0);
    if (th >= 3) {
      const PEN = { ...STEAL_TIER_PEN };
      const lair = botLairCandidates(G, pi, c, 4)
        .filter(
          (k) =>
            k.f.monster &&
            50 + 10 * th - (PEN[k.f.monster.power || 'Weak'] || 0) >= 75 &&
            !(k.rumour && k.rumour.band >= 101) &&
            !(k.f._pickedCleanBy || []).includes(pi),
        )
        .sort((a, b) => b.grade - a.grade || a.d - b.d)[0]; // 2026-09-29: never a hoard this realm has already emptied
      if (lair) {
        const path = lair.d > 0 ? botPathDirs(G, pi, P, lair.X.id, 4, true) || [] : [];
        if ((lair.d === 0 || path.length === lair.d) && pre.length + path.length < 5) {
          // 2026-09-29 (Toby, lair study): the robber goes in to STEAL AND RUN. The steal-then-flee plan was set
          // only for a hero whose PRIMARY role is thief (botSpecialistRoles), but this order also reaches a hero
          // with Thief 3+ working his secondary role — who then walked into a Moderate guardian with an ordinary
          // melee plan and fought it (40 bot games: every "untrained" Moderate death was one of these). The plan
          // now travels with the order; the role pass resets `_botTactics` plans next turn as before.
          c.encounterPlan = {
            ...(c.encounterPlan || {}),
            tactics: ['ST', 'FL', 'FL', 'FL', 'FL', 'FL'],
            _botTactics: true,
          };
          const out = [
            ...pre,
            ...path.map((d) => botMoveOrder(d, 'Creep toward the lair in ' + lair.X.name)),
            { action: 'search', target: String(lair.li), extra: '', desc: 'Rob the hoard', prov: lair.X.id },
          ];
          while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
          return out;
        }
      }
    }
  }
  const t = botStealTarget(G, pi, c, 4);
  if (!t) return null;
  const path = t.d > 0 ? botPathAny(G, P, t.provId, 4) || [] : [];
  if (t.d > 0 && path.length !== t.d) return null;
  if (pre.length + path.length >= 5) return null;
  const X = G.world.provinces[t.provId];
  pre = botCloakPre(G, pi, c, pre, X);
  if (pre.length + path.length >= 5) pre = pre.filter((o) => !(o && o.target === 'Invisibility'));
  const steal =
    t.kind === 'char'
      ? { action: 'steal', target: String(t.e.id), extra: '', desc: 'Rob ' + t.e.name }
      : { action: 'steal', target: 'garrison', extra: '', desc: 'Rob the paymaster of ' + (X ? X.name : '') };
  const out = [...pre, ...path.map((d) => botMoveOrder(d, 'Creep toward ' + (X ? X.name : '')))];
  let k = 0;
  while (out.length < 5) {
    out.push(k < 1 ? { ...steal } : { action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
    k++;
  }
  return out;
}
// LAIR TRAVEL — a beatable, discovered, uncleared lair in ground that is ours, unowned or an ally's,
// within reach of an unarmed fighter (Melee/Archery 3+ — botCanBeatGuardian's own floor).
export function botLairTarget(G, pi, c, maxD) {
  const from = G.world.provinces[c.location];
  if (!from) return null;
  let best = null;
  const POWER_RANK = { ...GUARDIAN_POWER_RANK };
  (G.world.provinces || []).forEach((X) => {
    if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id)) return;
    const bo = botBelievedOwner(G, pi, X);
    if (bo != null && bo !== pi && botRelationRaw(G, pi, bo) !== 'allied') return;
    const li = botBeatableLairIn(G, c, X);
    if (li < 0) return;
    const d = X.id === from.id ? 0 : botPathLen(G, pi, from, X.id, true);
    if (d == null || d > maxD) return;
    const f = X.features[li];
    const sc = (POWER_RANK[(f.monster && f.monster.power) || ''] || 0) * 2 - d * 2;
    if (!best || sc > best.sc) best = { X, li, d, sc };
  });
  return best;
}
export function botLairOrders(G, pi, c, pre) {
  const P = G.world.provinces[c.location];
  const t = botLairTarget(G, pi, c, 4);
  if (!t) return null;
  const path = t.d > 0 ? botPathDirs(G, pi, P, t.X.id, 4, true) || [] : [];
  if (t.d > 0 && path.length !== t.d) return null;
  if (pre.length + path.length >= 5) return null;
  const mv = [
    ...path.map((d) => botMoveOrder(d, 'Seek the lair in ' + t.X.name)),
    { action: 'search', target: String(t.li), extra: '', desc: 'Search Lair', prov: t.X.id },
  ];
  return botFillOrders(G, pi, c, pre, mv);
}
// ROLE WORK — the orders a role does when it has real work this year, or null (2026-09-26, Toby: primary role,
// then the SECONDARY role, then the primary's training — nobody trains while another craft has work to do).
export function botRoleWork(G, pi, c, pre, role, L) {
  switch (role) {
    case 'slayer': {
      const lp = botLairPlan(G, pi, c, pre, L);
      if (lp) return lp;
      if (((c.skills || {}).melee || 0) >= 3 && !botSlayerHasLairsToGrowInto(G, pi, c)) {
        const so = botScoutOrders(G, pi, c, pre);
        if (so) return so;
      }
      return null;
    }
    case 'scholar': {
      const sg = (c.skills || {}).sage || 0;
      const neutral = ((G.players || [])[pi] || {}).alignment === 'Neutral';
      if (!(neutral ? sg >= 1 : sg >= 2)) return null;
      return botScholarOrders(G, pi, c, pre);
    }
    case 'scout': {
      if (((c.skills || {}).explorer || 0) >= 7 && pre.length < 4) {
        const P = G.world.provinces[c.location];
        const cand = [P];
        for (let i = 0; i < 6; i++) {
          const N = botNeighbourProv(G, P, i);
          if (N) cand.push(N);
        }
        const X = cand
          .filter(
            (N) =>
              N && N.terrain !== 'sea' && ((N.exploredBy || {})[pi] || 0) < 100 && (N.owner === pi || N.owner == null),
          )
          .sort((a, b) => ((a.exploredBy || {})[pi] || 0) - ((b.exploredBy || {})[pi] || 0))[0];
        if (X) {
          const so = botScoutOrders(G, pi, c, [
            ...pre,
            { action: 'chart_unknown', target: String(X.id), extra: '', desc: 'Chart the Unknown — ' + X.name },
          ]);
          if (so) return so;
        }
      } // review II A8
      return botScoutOrders(G, pi, c, pre);
    }
    case 'spy': {
      const lvl = (c.skills || {}).spy || 0;
      if (lvl < 2) return null;
      if (lvl >= 9) {
        const P = G.world.provinces[c.location];
        const mark = botVisibleCharsIn(G, pi, P || {})
          .filter(
            (e) => e && e.alive && e.player != null && e.player !== pi && botRelationRaw(G, pi, e.player) === 'enemy',
          )
          .sort((a, b) => (b.isKing ? 1 : 0) - (a.isKing ? 1 : 0))[0];
        if (mark) {
          const out = [
            ...pre,
            { action: 'assassinate', target: String(mark.id), extra: '', desc: 'Assassinate ' + mark.name },
          ];
          while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
          return out;
        }
      }
      if (lvl >= 7 && botAtWar(G, pi)) {
        let best = null;
        (G.world.provinces || []).forEach((X) => {
          if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id)) return;
          const bo = botBelievedOwner(G, pi, X);
          if (bo == null || bo === pi || botRelationRaw(G, pi, bo) !== 'enemy') return;
          const b = botBelief(G, pi, X) || {};
          const v = (b.tax || 0) + (((G.players || [])[bo] || {}).homeProvinceId === X.id ? 3 : 0);
          if (!best || v > best.v) best = { X, v };
        });
        if (best) {
          const out = [
            ...pre,
            { action: 'sabotage', target: String(best.X.id), extra: '', desc: 'Sabotage ' + best.X.name },
          ];
          while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Lie in wait' });
          return out;
        }
      }
      return botSpyOrders(G, pi, c, pre);
    }
    case 'thief': {
      const lvl = (c.skills || {}).thief || 0;
      if (lvl < 2) return null;
      return botThiefOrders(G, pi, c, pre);
    }
    case 'mage':
      return botMageOrders(G, pi, c, pre, L);
  }
  return null;
}
// MAGE WORK: every cast worth making from where he stands (up to three, both schools, offence first — the plan
// already refuses spells the situation cannot use), then practice the weaker school; with nothing to cast, walk
// to the nearest general leading a host (≤4 hops through any land) to be his caster next year; else null (train).
export function botMageOrders(G, pi, c, pre, L) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const [s1, s2] = botMageSchools(c);
  const sk = c.skills || {};
  const weakSch = (sk[s1] || 0) <= (sk[s2] || 0) ? s1 : s2;
  const prac = {
    action: 'practice',
    target: weakSch,
    extra: '',
    desc: 'Practice ' + (SKILL_LABELS[weakSch] || weakSch) + ' (mage)',
  };
  // idea 6: CHARM a seen wanderer within three hops instead of paying his wage (court under the cap)
  if ((sk.psychic || 0) >= 1) {
    const heroesNow = (G.characters || []).filter(
      (x) => x && x.alive && x.player === pi && !x.isKing && !x._isHeir,
    ).length;
    let bestW = null;
    if (heroesNow < botHeroCap(G, pi))
      (G.characters || []).forEach((h) => {
        if (!(
          h &&
          h.alive &&
          h.player === null &&
          !h._isNeutralGuard &&
          !h._justDefeated &&
          !h.isKing &&
          !(h.armies || []).length &&
          botSeesChar(G, pi, h)
        ))
          return;
        const d = h.location === c.location ? 0 : botPathLenAny(G, P, h.location, 3);
        if (d == null) return;
        if (!bestW || d < bestW.d) bestW = { h, d };
      });
    if (bestW && pre.length + bestW.d < 5) {
      const path = bestW.d > 0 ? botPathAny(G, P, bestW.h.location, 3) || [] : [];
      if (path.length === bestW.d) {
        const out = [
          ...pre,
          ...path.map((d) => botMoveOrder(d, 'Seek ' + bestW.h.name + ' to charm')),
          { action: 'cast_spell', target: 'Charm', extra: String(bestW.h.id), desc: 'Charm ' + bestW.h.name },
        ];
        while (out.length < 5) out.push({ ...prac });
        return out.slice(0, 5);
      }
    }
  }
  // idea 5: HEX THE ENEMY GENERAL — a rival host seen within two turns, within three hops, and a school to hurt him
  if ((sk.psychic || 0) >= 1 || (sk.necromancy || 0) >= 1) {
    const I = botEnemyIntel(G, pi);
    let bestG = null;
    Object.keys(I.generals).forEach((k) => {
      const r = I.generals[k];
      if ((G.turn || 0) - r.turn > 2 || botRelationRaw(G, pi, r.player) !== 'enemy') return;
      const e = (G.characters || []).find((x) => x && x.id === +k && x.alive);
      if (!e || e.location !== r.provId) return;
      const X = G.world.provinces[r.provId];
      if (!X) return;
      const d = X.id === P.id ? 0 : botPathLenAny(G, P, X.id, 3);
      if (d == null || pre.length + d >= 4) return;
      const sc = r.units * 2 + (r.isKing ? 5 : 0) - d * 2;
      if (!bestG || sc > bestG.sc) bestG = { X, d, sc, e };
    });
    if (bestG) {
      const path = bestG.d > 0 ? botPathAny(G, P, bestG.X.id, 3) || [] : [];
      if (path.length === bestG.d) {
        const hexes = botCastPlan(G, pi, c, bestG.X, { max: 3 }).filter((o) =>
          ['Curse', 'Psychic Blast', 'Telekinetic Storm'].includes(o.target),
        );
        if (hexes.length) {
          let pre2 = pre;
          if (bestG.X.owner !== pi) pre2 = botCloakPre(G, pi, c, pre, bestG.X);
          const out = [...pre2, ...path.map((d) => botMoveOrder(d, 'Close on ' + bestG.e.name)), ...hexes];
          while (out.length < 5) out.push({ ...prac });
          return out.slice(0, 5);
        }
      }
    }
  }
  // siege beside a general who attacks this year (idea 4): his target is in my reach from here
  const _roles = botRoles(G, pi);
  const genHere = (G.characters || []).find(
    (l) =>
      l && l.alive && l.player === pi && l.id !== c.id && l.location === c.location && _roles.leaders.includes(l.id),
  );
  const siege = genHere ? botPlannedAttackTarget(G, genHere) : null;
  const casts = botCastPlan(G, pi, c, P, {
    max: 3,
    siege,
    fighting: genHere && siege != null ? genHere : null,
    threat: botNearbyThreat(G, pi, c),
  });
  if (casts.length) {
    const out = [...pre, ...casts];
    while (out.length < 5) out.push({ ...prac });
    return out.slice(0, 5);
  }
  // idea 9: a NECROMANCER walks to the nearest known battlefield graves in our own or unowned ground (three hops)
  // and raises them — Skeletal Armies needs him standing on the dead.
  if ((sk.necromancy || 0) >= 1) {
    let bestX = null;
    (G.world.provinces || []).forEach((X) => {
      if (!X || X.id === P.id || X.terrain === 'sea' || !botKnowsGraves(G, pi, X.id)) return;
      if (X.owner != null && X.owner !== pi) return;
      const d = botPathLenAny(G, P, X.id, 3);
      if (d == null || pre.length + d >= 5) return;
      if (!bestX || d < bestX.d) bestX = { X, d };
    });
    if (bestX) {
      const path = botPathAny(G, P, bestX.X.id, 3) || [];
      if (path.length === bestX.d) {
        const out = [...pre, ...path.map((d) => botMoveOrder(d, 'To the battlefield dead of ' + bestX.X.name))];
        const lim = botSchoolLimit(sk.necromancy || 0);
        for (let i = 0; i < lim && out.length < 5; i++)
          out.push({ action: 'cast_spell', target: 'Skeletal Armies', extra: '', desc: 'Cast Skeletal Armies' });
        while (out.length < 5) out.push({ ...prac });
        return out;
      }
    }
  }
  // idea 10: a WHITE mage with nothing better to do keeps the realm's richest province blessed — he walks there
  // (three hops) and Blesses it and its richest neighbour every year (Bless reaches the adjacent province too).
  if ((sk.white || 0) >= 1) {
    let bestR = null;
    (G.world.provinces || []).forEach((X) => {
      if (!X || X.owner !== pi || X.terrain === 'sea') return;
      const d = X.id === P.id ? 0 : botPathLen(G, pi, P, X.id, true);
      if (d == null || d > 3 || pre.length + d >= 5) return;
      let v = X.tax || 0;
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, X, i);
        if (N && N.owner === pi && N.terrain !== 'sea') v = Math.max(v, (X.tax || 0) + (N.tax || 0) * 0.8);
      }
      const sc = v - d;
      if (!bestR || sc > bestR.sc) bestR = { X, d, sc };
    });
    if (bestR && bestR.d > 0) {
      const path = botPathDirs(G, pi, P, bestR.X.id, 3, true) || [];
      if (path.length === bestR.d) {
        const bl = botCastPlan(G, pi, c, bestR.X, { max: 2 }).filter((o) => o.target === 'Bless Province');
        const out = [...pre, ...path.map((d) => botMoveOrder(d, 'To bless ' + bestR.X.name)), ...bl];
        while (out.length < 5) out.push({ ...prac });
        return out.slice(0, 5);
      }
    }
  }
  const roles = _roles;
  let best = null;
  (G.characters || []).forEach((l) => {
    if (!(
      l &&
      l.alive &&
      l.player === pi &&
      roles.leaders.includes(l.id) &&
      (l.armies || []).length >= 3 &&
      l.location !== c.location
    ))
      return;
    const d = botPathLenAny(G, P, l.location, 4);
    if (d == null) return;
    if (!best || d < best.d) best = { l, d };
  });
  if (best && pre.length + best.d < 5) {
    const path = botPathAny(G, P, best.l.location, 4) || [];
    if (path.length === best.d) {
      const out = [...pre, ...path.map((d) => botMoveOrder(d, 'Join ' + best.l.name + ' as his caster'))];
      const weak = (sk[s1] || 0) <= (sk[s2] || 0) ? s1 : s2;
      while (out.length < 5)
        out.push({
          action: 'practice',
          target: weak,
          extra: '',
          desc: 'Practice ' + (SKILL_LABELS[weak] || weak) + ' (mage)',
        });
      return out;
    }
  }
  return null;
}
export function botRoleTrain(G, pi, c, pre, role) {
  switch (role) {
    case 'slayer': {
      const k = botSlayerTrainSkill(c);
      return k ? botTrainOrders(G, pi, c, pre, k, 'slayer') : null;
    }
    case 'scholar':
      return botScholarOrders(G, pi, c, pre); // below the working level this studies with the king / at the capital
    case 'scout':
      return botTrainOrders(G, pi, c, pre, 'explorer', 'scout');
    case 'spy':
      return botTrainOrders(G, pi, c, pre, 'spy', 'spy');
    case 'thief':
      return botTrainOrders(G, pi, c, pre, 'thief', 'thief');
    case 'mage': {
      const [s1, s2] = botMageSchools(c);
      const sk = c.skills || {};
      const pick = (sk[s1] || 0) < 2 ? s1 : (sk[s2] || 0) < (sk[s1] || 0) ? s2 : s1;
      return botTrainOrders(G, pi, c, pre, pick, 'mage');
    } // the first school to 2, then the two rise together
  }
  return null;
}
// Is a hero AT his primary role's working level? Below it, training the primary is the immediate good action and
// the secondary role waits (the first cut let secondaries starve slayers of Melee: 1.8 average at game end).
export function botRoleReady(G, pi, c, role) {
  const s = (c && c.skills) || {};
  const neutral = ((G.players || [])[pi] || {}).alignment === 'Neutral';
  switch (role) {
    case 'slayer':
      return (s.melee || 0) >= 3 || (s.archery || 0) >= 3;
    case 'scholar':
      return neutral ? (s.sage || 0) >= 1 : (s.sage || 0) >= 2;
    case 'spy':
      return (s.spy || 0) >= 2;
    case 'thief':
      return (s.thief || 0) >= 2;
    case 'scout':
      return true;
    case 'mage': {
      const [s1] = botMageSchools(c);
      return (s[s1] || 0) >= 2;
    }
  }
  return true;
}
export function botSpecialistOrders(G, pi, c, pre, role, L) {
  const w = botRoleWork(G, pi, c, pre, role, L);
  if (w) return w;
  const r2 = c._botRole2;
  if (r2 && r2 !== role && botRoleReady(G, pi, c, role)) {
    const w2 = botRoleWork(G, pi, c, pre, r2, L);
    if (w2) {
      w2.forEach((o) => {
        if (o && !pre.includes(o)) o._role2 = r2;
      });
      return w2;
    }
  }
  return botRoleTrain(G, pi, c, pre, role);
}
// DEFENDER POST — the owned land province whose Defend zone covers the most owned tax not already
// covered (`covered`: provinces a field host stands on plus earlier defenders' zones). Sticky: the
// current post is kept while it scores at least 80% of the best. Returns {X,d,sc} or null.
export function botDefenderPost(G, pi, c, covered) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const home = botHomeId(G, pi);
  const armed = (c.armies || []).length > 0;
  const owned = (G.world.provinces || []).filter((p) => p && p.owner === pi && p.terrain !== 'sea');
  const val = (q) => (q.tax || 0) + (q.id === home ? 6 : 0) + (botIsEdge(G, pi, q) ? 2 : 0);
  const cover = (X) => {
    let sc = 0;
    botZoneOf(G, X).forEach((q) => {
      if (q.owner === pi && q.terrain !== 'sea' && !covered.has(q.id)) sc += val(q);
    });
    return sc;
  };
  const raise = (X) =>
    (X.armyTypes || []).some((t) => !/garrison/i.test(t) && !BOT_NAVAL_TYPES.has(t)) ? (armed ? 1 : 4) : 0; // an unarmed defender needs somewhere to raise a column
  const plainDef = armed ? botBattleForce(G, c, null, 'plain', { defending: true }) : 0;
  const ground = (X) =>
    armed && plainDef > 0 ? (botBattleForce(G, c, null, X.terrain, { defending: true }) / plainDef - 1) * 8 : 0; // Sept 2026: hold ground where our troops fight best
  let best = null;
  owned.forEach((X) => {
    const d = X.id === P.id ? 0 : botPathLen(G, pi, P, X.id, !armed);
    if (d == null) return;
    const sc = cover(X) + raise(X) + ground(X) - d * 1.5;
    if (!best || sc > best.sc) best = { X, d, sc };
  });
  if (best && c._botPost != null && c._botPost !== best.X.id) {
    const cur = owned.find((x) => x.id === c._botPost);
    if (cur) {
      const d = cur.id === P.id ? 0 : botPathLen(G, pi, P, cur.id, !armed);
      const sc = cover(cur) + raise(cur) + ground(cur) - (d == null ? 99 : d * 1.5);
      if (d != null && sc >= best.sc * 0.8) best = { X: cur, d, sc };
    }
  }
  return best;
}
// DEFENDER ORDERS — hire, walk to the post (if not there), ONE Defend, recruit to self at an owned post,
// then the useful tail: Bless / Illusory Terrain / Resurrect (and Oratory while a hostile host is within
// two hexes), cross-training with anyone standing here, else Tactical drill / the best skill to raise.
export function botDefenderOrders(G, pi, c, pre, post, L) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const armed = (c.armies || []).length > 0;
  const out = [...pre];
  let here = P;
  if (post && post.d > 0) {
    const reach = Math.min(3, armed ? botLandReach(c) || 1 : 5);
    const path = botPathDirs(G, pi, P, post.X.id, Math.min(reach, Math.max(0, 4 - out.length)), !armed) || [];
    for (const d of path) {
      const N = botNeighbourProv(G, here, d);
      if (!N) break;
      out.push(botMoveOrder(d, 'Take post at ' + post.X.name));
      here = N;
    }
  }
  // Sept 2026: at his post with no hostile host within two hexes, a defender first rides one hex to an owned
  // province holding 3+ garrison units, takes the surplus up and returns — the Defend then comes later than the
  // usual first/second phase (judgement call: only when nothing threatens).
  if (post && post.d === 0 && here.id === P.id && out.length <= 1 && !botNearbyThreat(G, pi, c)) {
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, P, i);
      if (!N || N.owner !== pi || N.terrain === 'sea' || (N.garrisonArmies || []).length <= 2) continue;
      const po = botPickupOrder(G, pi, c, N);
      if (po) {
        out.push(botMoveOrder(i, 'Gather the garrison of ' + N.name));
        out.push(po);
        out.push(botMoveOrder(5 - i, 'Return to the post'));
        break;
      }
    }
  }
  if (out.length < 5) out.push({ ...BOT_DEFEND_ORDER });
  if (out.length < 5 && here.id === P.id) {
    const po = botPickupOrder(G, pi, c, P);
    if (po) out.push(po);
  } // review II A2: the post's surplus garrison joins the defender
  if (out.length < 5 && here.id === P.id && armed) {
    const mo = botMasteryPre(G, pi, c, P, { holding: true, threat: !!botNearbyThreat(G, pi, c) });
    if (mo) out.push(mo);
  } // review II A7: a Tactical-7 defender lays a Feigned Retreat
  if (here.id === P.id && P.owner === pi && L && out.length < 5) {
    const toks = botFieldRecruitTokens(G, pi, c, P, L).filter((t) => !BOT_SEA_ALL.has(t.split('|')[0]));
    const ro = botRecruitOrder(toks, null);
    if (ro) out.push(ro);
  }
  if (out.length < 5 && here.id === P.id) {
    const threat = botNearbyThreat(G, pi, c);
    const casts = botCastPlan(G, pi, c, P, { max: 2, fighting: threat && armed ? c : null, threat: !!threat }).filter(
      (o) =>
        [
          'Bless Province',
          'Illusory Terrain',
          'Resurrect',
          'Oratory',
          'Curse',
          'Psychic Blast',
          'Telekinetic Storm',
        ].includes(o.target),
    );
    casts.forEach((o) => {
      if (out.length < 5) out.push(o);
    });
  }
  const land = (c.armies || []).filter((a) => a && !BOT_SEA_ALL.has(a.type) && !a._isSkeletal).length;
  const sk = botCrossTrainSkill(G, c, pi) || (land >= 3 ? 'tactical' : null) || botPracticeSkill(c) || 'tactical';
  const pr =
    sk === 'sage' && ((c.skills || {}).sage || 0) >= 2
      ? { action: 'research', target: '', extra: '', desc: 'Research' }
      : { action: 'practice', target: sk, extra: '', desc: 'Practice ' + (SKILL_LABELS[sk] || sk) };
  while (out.length < 5) out.push({ ...pr });
  return out.slice(0, 5);
}
// DRILL: a commander leading 3+ land/air units practises Tactical in every spare phase (levels the
// skill AND promotes unit quality); a fleet commander drills Naval. Else the phase is a Hold.
export function botDrillOrder(G, pi, c) {
  const land = (c.armies || []).filter((a) => a && !BOT_SEA_ALL.has(a.type) && !a._isSkeletal).length;
  const sea = (c.armies || []).filter((a) => a && BOT_SEA_ALL.has(a.type)).length;
  // a commander whose host carries units he cannot lead cleanly trains DRUID before anything else —
  // every missing level is −20% on those units, which no amount of Tactical drill recovers.
  if ((c.armies || []).length && ((c.skills || {}).druid || 0) < 5 && botDruidShortfall(G, c) > 0)
    return { action: 'practice', target: 'druid', extra: '', desc: 'Practice Druid (lead the host cleanly)' };
  // Sept 2026 (Toby): a general who cannot win a duel trains for one — his best of Melee / Archery / a battle
  // school — until it stands at 3; Tactical drill then resumes. He must be able to fight the duel his host invites.
  if ((c.armies || []).length && botDuelSkill(c) < 3 && ((c.skills || {}).tactical || 0) >= 2) {
    const s = c.skills || {};
    const pick = [
      ['melee', s.melee || 0],
      ['archery', s.archery || 0],
      ['elemental', s.elemental || 0],
      ['necromancy', s.necromancy || 0],
      ['psychic', s.psychic || 0],
    ].sort((a, b) => b[1] - a[1])[0][0];
    return {
      action: 'practice',
      target: pick,
      extra: '',
      desc: 'Practice ' + (SKILL_LABELS[pick] || pick) + ' (fit for a duel)',
    };
  }
  if (land >= 3)
    return { action: 'practice', target: 'tactical', extra: '', desc: 'Practice Tactical (drill the host)' };
  if (sea >= 3) return { action: 'practice', target: 'naval', extra: '', desc: 'Practice Naval (drill the fleet)' };
  return null;
}
// Fill a 5-phase order list: pre-orders, then moves, then a Defend watch if a phase is spare, then
// the character's practice fallback — drilling a host, else the skill most worth training (with
// co-located partners when possible, toward the drill cap of 5). Practice is always secondary: it
// only ever fills phases nothing else claimed.
// 2026-09-26 (study): an officer below his role's working level trains THAT skill in every filler phase — an
// admiral to Naval 3. (The flying general trained Druid 3 while the winged riders were beasts; since 2026-10-11
// they are soldiers of their race and need none.) Without this the explore-first filler left admirals at Naval 1.
export function botRoleTrainSkill(c) {
  const s = (c && c.skills) || {};
  if (c._botRole === 'admiral' && (s.naval || 0) < 3) return 'naval';
  // 2026-09-26 (idea 8): the holder of a craft keeps at it to MASTERY 7 in his filler phases — Sabotage,
  // Grand Heist, Chart the Unknown, Research Breakthrough and the rest are level-7 orders nobody reached.
  const k = { scholar: 'sage', scout: 'explorer', spy: 'spy', thief: 'thief' }[c._botRole];
  if (k && (s[k] || 0) >= 5 && (s[k] || 0) < 7) return k;
  return null;
}
export function botPracticeFallback(G, pi, c, opts) {
  const drill = botDrillOrder(G, pi, c);
  if (drill) return drill;
  {
    const rs = botRoleTrainSkill(c);
    if (rs)
      return {
        action: 'practice',
        target: rs,
        extra: '',
        desc:
          'Practice ' +
          (SKILL_LABELS[rs] || rs) +
          ' (' +
          (c._botRole === 'admiral' ? 'admiral' : 'flying general') +
          ')',
      };
  }
  // 2026-09-26 (Toby item 1): Practice is the LAST resort, not the default. Ground under the character's
  // feet that the realm has not fully mapped is explored first (lairs, features and wanderers come of it).
  // Only for a character standing still this turn — an Explore after a march would land on other ground.
  const P = G.world.provinces[c.location];
  if (
    !(opts && opts.moving) &&
    P &&
    P.terrain !== 'sea' &&
    (P.owner === pi || P.owner == null) &&
    ((P.exploredBy || {})[pi] || 0) < 100
  )
    return { action: 'explore', target: '', extra: '', desc: 'Explore ' + P.name };
  const sk = botCrossTrainSkill(G, c, pi) || botTitleFocusSkill(c, botTargetTitles(G, pi)) || botPracticeSkill(c);
  if (!sk) return null;
  const sg = (c.skills || {}).sage || 0;
  if (sk === 'sage' && sg >= 1 && (sg >= 5 || kcRng() < 0.5))
    return { action: 'research', target: '', extra: '', desc: 'Research' };
  return { action: 'practice', target: sk, extra: '', desc: 'Practice ' + (SKILL_LABELS[sk] || sk) };
}
// CONTACT: until another crown has been met — a non-neutral relation, or any other player's land or
// armed character within 2 hexes of our own land — Defend watches are pointless.
export function botHasMetPlayers(G, pi) {
  const cache = botTurnCache(G);
  cache.met = cache.met || {};
  if (cache.met[pi] != null) return cache.met[pi];
  let met = false;
  const rel = G.relations || {};
  for (const k of Object.keys(rel)) {
    if (rel[k] !== 'neutral' && k.split('-').map(Number).includes(pi)) {
      met = true;
      break;
    }
  }
  // "have we met another crown" is now the engine's OWN encounter record
  // (player._encountered), which updateProvinceMemory fills from provinces and characters this realm
  // actually observed — the same list that gates a human's Treat / Declare War controls. The old
  // test measured raw hex distance to any rival province or host, so a bot knew it had neighbours
  // before it had seen one.
  if (!met) {
    met = (((G.players || [])[pi] || {})._encountered || []).length > 0;
  }
  cache.met[pi] = met;
  return met;
}
// A non-allied player's armed host within 2 hexes of this character — reason for an early watch.
export function botNearbyThreat(G, pi, c) {
  const P = G.world.provinces[c.location];
  if (!P) return false;
  // a host two hexes away sets a watch only if the realm can see it standing there.
  return (G.characters || []).some(
    (e) =>
      e &&
      e.alive &&
      e.player != null &&
      e.player !== pi &&
      (e.armies || []).length &&
      botRelationRaw(G, pi, e.player) !== 'allied' &&
      botSeesChar(G, pi, e) &&
      (() => {
        const X = G.world.provinces[e.location];
        return X && botHexDist(G, P, X) <= 2;
      })(),
  );
}
// Fill a 5-phase order list. Toby 2026-09-10: a Defend watch is set EARLY (phase 0) and only when
// it is needed — other crowns met and a hostile host within 2 hexes — so the general answers an
// incursion at the top of the year and still marches to his attacks afterwards (the engine drops a
// watch the moment a later phase holds a Move). A general with no moves keeps the watch all turn.
// Before this a Defend was tacked on AFTER the moves, and reacting to a neighbour's skirmish
// routinely dragged the main host off its advance.
export function botFillOrders(G, pi, c, pre, moves) {
  const armed = (c.armies || []).length > 0,
    met = botHasMetPlayers(G, pi);
  const watch =
    armed && met && botNearbyThreat(G, pi, c) ? [{ action: 'defend', target: '', extra: '', desc: 'Watch' }] : [];
  const out = (
    moves.length
      ? [...watch, ...pre, ...moves]
      : [...pre, ...(met ? [{ action: 'defend', target: '', extra: '', desc: 'Hold' }] : [])]
  ).slice(0, 5);
  const tail = botPracticeFallback(G, pi, c, {
    moving: out.some((o) => o && (o.action === 'move' || o.action === 'encounter')),
  });
  while (out.length < 5) out.push(tail ? { ...tail } : { action: 'defend', target: '', extra: '', desc: 'Hold' });
  return out;
}
export const botMoveOrder = (dirIdx, desc) => ({
  action: 'move',
  target: 'dir:' + BOT_HEX_DIRS[dirIdx],
  extra: '',
  desc: desc || 'Advance',
});
// PATHING — shortest march from `from` to province `toId` through passable land (own/allied); the
// destination itself may be anything. Returns up to maxHops direction indices, or null if
// unreachable.
export function botPathDirs(G, pi, from, toId, maxHops, unarmed) {
  if (!from || toId == null || from.id === toId) return [];
  const prev = {};
  prev[from.id] = null;
  const dirOf = {};
  const q = [from];
  const passable = (N) => botPassable(G, pi, N) || (unarmed && N && N.terrain !== 'sea' && N.owner == null);
  while (q.length) {
    const cur = q.shift();
    let found = false;
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, cur, i);
      if (!N || prev[N.id] !== undefined) continue;
      if (N.id !== toId && !passable(N)) continue;
      prev[N.id] = cur.id;
      dirOf[N.id] = i;
      if (N.id === toId) {
        found = true;
        break;
      }
      q.push(N);
    }
    if (found) break;
  }
  if (prev[toId] === undefined) return null;
  const dirs = [];
  let id = toId;
  while (prev[id] !== null) {
    dirs.unshift(dirOf[id]);
    id = prev[id];
  }
  return dirs.slice(0, Math.max(0, maxHops));
}
// BFS distance through passable land (null = unreachable).
export function botPathLen(G, pi, from, toId, unarmed) {
  const d = botPathDirs(G, pi, from, toId, 99, unarmed);
  return d ? d.length : null;
}
// FRONTIER — nearest own/allied land province that borders unowned or at-war-enemy land (ties → the one
// with the most such neighbours). null if `P` is itself on the edge or nothing is reachable.
export function botIsEdge(G, pi, prov) {
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, prov, i);
    if (!N || N.terrain === 'sea') continue;
    if (N.owner == null || (N.owner !== pi && botRelationRaw(G, pi, N.owner) === 'enemy')) return true;
  }
  return false;
}
export function botFrontierTarget(G, pi, P) {
  if (botIsEdge(G, pi, P)) return null;
  // counted on BELIEVED ownership — staging through an ally's land can look two hops past our own
  // border, and unmapped ground is not counted as open country.
  const openCount = (prov) => {
    let n = 0;
    for (let j = 0; j < 6; j++) {
      const K = botNeighbourProv(G, prov, j);
      if (!K || K.terrain === 'sea') continue;
      const ko = botBelievedOwner(G, pi, K);
      if (ko === undefined) continue;
      if (ko == null || (ko !== pi && botRelationRaw(G, pi, ko) === 'enemy')) {
        const b = botBelief(G, pi, K);
        n += 1 + Math.min(3, ((b && b.tax) || 0) / 3);
      }
    }
    return n;
  }; // Sept 2026 (R8): weighted by the wealth band the border shows
  const seen = new Set([P.id]);
  let q = [P],
    depth = 0,
    best = null;
  while (q.length && depth < 8) {
    const next = [];
    depth++;
    q.forEach((cur) => {
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, cur, i);
        if (!N || seen.has(N.id) || !botPassable(G, pi, N)) continue;
        seen.add(N.id);
        const oc = openCount(N);
        if (oc > 0 && (!best || oc > best.oc)) best = { id: N.id, oc };
        next.push(N);
      }
    });
    if (best) return best.id;
    q = next;
  }
  return null;
}
// HOME THREAT — the strongest at-war enemy host standing within 2 hops of the capital (a human
// massing on the border). {force, provId} or null.
export function botHomeThreat(G, pi) {
  const hid = botHomeId(G, pi);
  const H = hid != null ? G.world.provinces[hid] : null;
  if (!H) return null;
  let best = null;
  (G.characters || []).forEach((e) => {
    if (!(
      e &&
      e.alive &&
      e.player != null &&
      e.player !== pi &&
      (e.armies || []).length &&
      botRelationRaw(G, pi, e.player) === 'enemy'
    ))
      return;
    if (!botSeesChar(G, pi, e)) return; // only a host we can see
    const P = G.world.provinces[e.location];
    if (!P || botHexDist(G, P, H) > 2) return;
    const f = botForceStrength(e.armies);
    if (!best || f > best.force) best = { force: f, provId: P.id };
  });
  return best;
}
// TARGET SCAN — from province P with a column of strength myStr: the best winnable adjacent target
// (attack an at-war enemy province, take unowned land, hunt enemy leaders, put to sea), the strongest
// at-war enemy host on the doorstep, and the neighbouring valuable province most in need of help.
export function botScanTargets(G, pi, c, P, myStr, T, visited) {
  const margin = botMarginFor(G, pi, c, T);
  // `myStr` is the column's plain-ground battle force (possibly discounted for fights already
  // chained this turn); re-project it onto each target's terrain so a mountain front line is read
  // honestly.
  const plainStr = botBattleForce(G, c, null, 'plain');
  const k = plainStr > 0 ? myStr / plainStr : 1;
  const strIn = (t) => botBattleForce(G, c, null, t) * k;
  let best = null,
    reinforce = null,
    maxThreat = 0,
    threatDir = -1;
  const _pins = botPins(G, pi);
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, P, i);
    if (!N) continue;
    // the doorstep threat is what the realm can SEE next door — a hex bordering our land shows
    // terrain and ownership, never the column standing on it.
    let enemyForceInN = 0;
    botVisibleCharsIn(G, pi, N).forEach((e) => {
      if (e.player != null && e.player !== pi && botRelationRaw(G, pi, e.player) === 'enemy')
        enemyForceInN += botEffForce(G, e);
    });
    if (enemyForceInN > maxThreat) {
      maxThreat = enemyForceInN;
      threatDir = i;
    }
    if (visited && visited.has(N.id)) continue;
    if (_pins.has(N.id)) continue; // 2026-09-29: flooded this Spring by our own mage — sea all year
    if (N.terrain === 'sea' && botSeaCap(c.armies) === 'land') continue; // no shipping — can't put to sea
    if (N.terrain !== 'sea' && botFleetOnly(c.armies)) continue; // 2026-09-28: bare hulls cannot step ashore
    if (N.owner === pi) {
      if (botIsValuable(G, N, pi)) {
        const need = botDefenceNeed(G, N, pi);
        if (need > 0 && (!reinforce || need > reinforce.need)) reinforce = { dirIdx: i, need };
      }
      continue;
    }
    if (N.owner != null && botRelationRaw(G, pi, N.owner) === 'allied') continue; // an ally's land is not a target
    let targetStr,
      enemyTarget = false;
    const ec = botEnemyChars(G, N, pi);
    if (N.owner == null) {
      targetStr = botTargetDefence(G, pi, N) + ec.force * BOT_DEF_BONUS;
    } else {
      if (botRelationRaw(G, pi, N.owner) !== 'enemy') continue;
      targetStr = botTargetDefence(G, pi, N);
      enemyTarget = true;
    }
    const rem = enemyTarget ? botRememberedHostAt(G, pi, N.id) : { units: 0, strength: 0 };
    targetStr += rem.strength * BOT_DEF_BONUS; // Sept 2026: a host seen here lately may still be here
    let effMargin = ec.hasKing ? margin * 0.9 : margin;
    effMargin = botHostMargin(effMargin, ec.units + rem.units); // 1.5–2× against a general
    if (targetStr > 0 && strIn(N.terrain) < targetStr * effMargin) continue;
    const terrainEdge = plainStr > 0 ? (strIn(N.terrain) / (plainStr * k) - 1) * 15 : 0; // fight where OUR troops stand tallest
    // a winnable enemy HOST is the prize — the bigger the stack we can smash, the better.
    // 2026-09-12: an ally's enemy is the enemy to press — a shared front ends the war sooner.
    // Sept 2026 (Toby: avoid stronger armies): a province standing beside an enemy host we could not beat is a trap
    let trap = 0;
    if (enemyTarget) {
      for (let j = 0; j < 6; j++) {
        const K = botNeighbourProv(G, N, j);
        if (!K || K.terrain === 'sea' || K.id === P.id || _pins.has(K.id)) continue;
        const kc = botEnemyChars(G, K, pi);
        /* a pinned host cannot come to its neighbour's aid */ const kr = botRememberedHostAt(G, pi, K.id);
        const f = kc.force + kr.strength;
        if (f > 0 && strIn(N.terrain) < f * 1.2) {
          trap = -25;
          break;
        }
      }
    }
    let score =
      (N.tax || 0) * T.taxScoreWeight -
      targetStr +
      (enemyTarget ? T.rivalBias : 0) +
      ec.value +
      ec.units * 3 +
      terrainEdge +
      (ec.units > 0 ? T.rivalBias : 0) +
      trap +
      (enemyTarget && botMutualFoe(G, pi, N.owner) ? T.rivalBias : 0) +
      (enemyTarget && botAllyNear(G, pi, N) ? T.rivalBias / 2 : 0); // Sept 2026 (R7): press the front an ally is already on
    if (N.terrain === 'sea') {
      score -= c._botRole === 'admiral' ? 0 : 40; // sea is the ADMIRAL's front; others claim it only when land is exhausted
      if (botIsLoadedFleet(c.armies))
        for (let j = 0; j < 6; j++) {
          const K = botNeighbourProv(G, N, j);
          if (
            K &&
            K.terrain !== 'sea' &&
            K.owner != null &&
            K.owner !== pi &&
            botRelationRaw(G, pi, K.owner) === 'enemy'
          ) {
            score += 40 + T.rivalBias * 2;
            break;
          }
        }
    }
    if (!best || score > best.score) best = { dirIdx: i, score, N, targetStr };
  }
  return { best, reinforce, maxThreat, threatDir };
}
// CHAINED HOPS — continue a march from a predicted position: attack the next winnable neighbour,
// else walk toward the frontier. Strength is discounted 15% per fight fought (losses) and each
// extra hop that fights demands a stiffer margin; at most two fights per turn are chained.
export const BOT_MAX_FIGHTS = 3;
export function botChainHops(G, pi, c, startProv, myStr, T, hopsLeft, visited, fights) {
  const moves = [];
  let cur = startProv,
    str = myStr,
    fought = fights || 0;
  while (hopsLeft > 0 && cur) {
    const scan = botScanTargets(G, pi, c, cur, str / (fought ? 1.2 : 1), T, visited);
    if (scan.best && str === 0 && scan.best.targetStr > 0) scan.best = null; // exhausted host: no third fight
    if (scan.best) {
      moves.push(botMoveOrder(scan.best.dirIdx, scan.best.targetStr > 0 ? 'Attack' : 'Advance'));
      visited.add(scan.best.N.id);
      cur = scan.best.N;
      hopsLeft--;
      if (scan.best.targetStr > 0) {
        str *= 0.85;
        fought++;
        if (fought >= BOT_MAX_FIGHTS) str = 0;
      } // 2026-09-29 (Toby: attack more than one enemy province a year): three fights a year (was two), then only unguarded ground — every hop is used
      continue;
    }
    const ft = botFrontierTarget(G, pi, cur);
    if (ft == null) break;
    const path = botPathDirs(G, pi, cur, ft, hopsLeft);
    if (!path || !path.length) break;
    for (const d of path) {
      const N = botNeighbourProv(G, cur, d);
      if (!N) break;
      moves.push(botMoveOrder(d, 'Advance to frontier'));
      visited.add(N.id);
      cur = N;
      hopsLeft--;
    }
  }
  return moves;
}
// DISTANT STRIKE: BFS through the bot's own (and allied) land up to 8 hops from P for the staging
// province whose winnable neighbour scores best (tax, weakness, rival bias, minus 4/hop of
// marching). Returns the move list: the path as far as this turn's hops allow, then — if a hop
// remains on arrival — the attack itself and any chained follow-ups. null when nothing winnable
// exists in reach.
export function botDistantStrike(G, pi, c, P, myStr, T, maxHops) {
  if (maxHops <= 0) return null;
  const margin = botMarginFor(G, pi, c, T);
  const plainStr = botBattleForce(G, c, null, 'plain');
  const k = plainStr > 0 ? myStr / plainStr : 1;
  const strIn = (t) => botBattleForce(G, c, null, t) * k;
  const seen = new Set([P.id]);
  let q = [P],
    depth = 0,
    best = null;
  while (q.length && depth < 8) {
    const next = [];
    depth++;
    q.forEach((cur) => {
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, cur, i);
        if (!N || seen.has(N.id) || !botPassable(G, pi, N)) continue;
        seen.add(N.id);
        next.push(N);
        // does N border something we can take?
        let sc = null;
        for (let j = 0; j < 6; j++) {
          const X = botNeighbourProv(G, N, j);
          if (!X || X.terrain === 'sea' || X.owner === pi) continue;
          // a staging province may be an ALLY's, whose far side is two hops past our own border and
          // may never have been seen. Unmapped ground is not a target.
          if (!botKnows(G, pi, X.id)) continue;
          if (X.owner != null && botRelationRaw(G, pi, X.owner) !== 'enemy') continue;
          const ec = botEnemyChars(G, X, pi);
          let tStr,
            enemyTarget = false;
          if (X.owner == null) tStr = botTargetDefence(G, pi, X) + ec.force * BOT_DEF_BONUS;
          else {
            tStr = botTargetDefence(G, pi, X);
            enemyTarget = true;
          }
          const rem = enemyTarget ? botRememberedHostAt(G, pi, X.id) : { units: 0, strength: 0 };
          tStr += rem.strength * BOT_DEF_BONUS;
          let effMargin = ec.hasKing ? margin * 0.9 : margin;
          effMargin = botHostMargin(effMargin, ec.units + rem.units);
          if (tStr > 0 && strIn(X.terrain) < tStr * effMargin) continue;
          const terrainEdge = plainStr > 0 ? (strIn(X.terrain) / (plainStr * k) - 1) * 15 : 0;
          const v =
            (X.tax || 0) * T.taxScoreWeight -
            tStr +
            (enemyTarget ? T.rivalBias : 0) +
            ec.value +
            ec.units * 3 -
            depth * 4 +
            terrainEdge +
            (ec.units > 0 ? T.rivalBias : 0) +
            (enemyTarget && botMutualFoe(G, pi, X.owner) ? T.rivalBias : 0) +
            (enemyTarget && botAllyNear(G, pi, X) ? T.rivalBias / 2 : 0);
          if (sc == null || v > sc) sc = v;
        }
        if (sc != null && (!best || sc > best.sc)) best = { id: N.id, sc };
      }
    });
    q = next;
  }
  if (!best) return null;
  const path = botPathDirs(G, pi, P, best.id, 99, false);
  if (!path || !path.length) return null;
  const moves = [];
  let cur = P;
  const visited = new Set([P.id]);
  for (const d of path) {
    if (moves.length >= maxHops) break;
    const N = botNeighbourProv(G, cur, d);
    if (!N) break;
    moves.push(botMoveOrder(d, 'March on ' + (G.world.provinces[best.id] || {}).name));
    visited.add(N.id);
    cur = N;
  }
  if (cur.id === best.id && moves.length < maxHops)
    moves.push(...botChainHops(G, pi, c, cur, myStr, T, maxHops - moves.length, visited, 0));
  return moves.length ? { moves, stageId: best.id } : null;
}
