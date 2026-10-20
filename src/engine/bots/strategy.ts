// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_RIVAL_RACE, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { ARMY_COST_MASTER, ARMY_SPEED_MASTER, botSafeWindow } from '../army-tables.ts';
import { marchSpeedBonus, navalSpeedBonus } from '../units/movement.ts';
import { heroHireWage } from '../world/tables.ts';
import { botNeighbourProv, botRelationRaw, botSeesChar, botTuning } from './intel.ts';
import { BOT_AERIAL_TYPES, BOT_CARRIER_TYPES, BOT_FLYING_TYPES, BOT_SEA_ALL } from './war.ts';
import { botFrontierTarget, botHasMetPlayers, botIsEdge, botLandCount, botMagicScore } from './specialists.ts';
import {
  BOT_RUMOUR_FUND_PER_SLAYER,
  botFlyerPorts,
  botFlyerType,
  botLiftable,
  botSeaWorthTaking,
  botUpdateIntel,
} from './missions.ts';
import {
  BOT_NAVAL_TYPES,
  botAtWar,
  botCoastalFleetType,
  botFleetHullCount,
  botMaxEnemyStack,
  botNavalEnemyCoast,
  botRecruitableTypes,
  botTaxIncome,
  botUpkeep,
} from './economy.ts';
import { BOT_P1, botInContact } from './phase-one.ts';

// ══ BOT STRATEGY (Sept 2026 batch) — shared helpers ════
// Design (BOT_PLAYERS_DESIGN §8, v2.4): ONE big field army under the bot's BEST GENERAL is both its
// offence and its defence. It expands as fast as its move pool allows (multi-hop turns), garrisons
// the trail with single cheap units (garrisons only slow an enemy — they never hold ground), and
// every other character is a FEEDER: it raises troops wherever it stands and marches them to the
// nearest field army. When the realm grows too wide for the main army to cross in one turn, a
// second field army is raised under the next-best general, and so on. Bots hire every wandering
// hero they can reach, drill their hosts with Tactical while campaigning, and never war one another
// while a human king reigns.
export function botIsBotPlayer(G, j) {
  const p = (G.players || [])[j];
  return !!(p && (p._isBot || p.isBot));
}
// Land a column may march through freely: our own, or an ally's (free passage).
export function botPassable(G, pi, N) {
  return (
    !!N && N.terrain !== 'sea' && (N.owner === pi || (N.owner != null && botRelationRaw(G, pi, N.owner) === 'allied'))
  );
}
// Hex distance with the map's east-west wrap — mirrors generateNewGame's cellDistRC.
export function botHexDist(G, a, b) {
  const cols = G.world.cols;
  let dc = Math.abs(a.col - b.col);
  dc = Math.min(dc, cols - dc);
  const dr = Math.abs(a.row - b.row);
  return Math.max(dc, dr, (dc + dr) >> 1);
}
export function botHomeId(G, pi) {
  const p = G.players[pi] || {};
  const h = G.world.provinces[p.homeProvinceId];
  if (h && h.owner === pi) return h.id;
  let best = null;
  (G.world.provinces || []).forEach((x) => {
    if (x && x.owner === pi && x.terrain !== 'sea' && (!best || (x.tax || 0) > (best.tax || 0))) best = x;
  });
  return best ? best.id : null;
}
export const BOT_GARRISON_UNIT_TYPES = new Set(KC_UNIT_CLASS.garrison);
// Hops per turn this column can march over land (mirror of computeMovePoolMax's land branch on base
// stats — flyers ignore March; an unarmed character walks 5). `extraTypes` lets a planner include
// units it is about to recruit this turn.
export function botLandReach(c, extraTypes) {
  const types = (c.armies || [])
    .filter((a) => a && !BOT_SEA_ALL.has(a.type))
    .map((a) => a.type)
    .concat(extraTypes || []);
  if (!types.length) return (c.armies || []).length ? 0 : 5;
  const ml = Math.min((c.skills || {}).march || 0, 5);
  let mn = 99;
  types.forEach((t) => {
    const base = ARMY_SPEED_MASTER[t] ?? 3;
    // EXPERIMENT: a garrison unit never moves (0): no March bonus, like a flyer
    const sp = BOT_AERIAL_TYPES.has(t) || BOT_GARRISON_UNIT_TYPES.has(t) ? base : base + marchSpeedBonus(ml);
    if (sp < mn) mn = sp;
  });
  return Math.max(0, Math.min(5, mn));
}
// 2026-09-28 (Toby: bots never take the sea): a FLEET'S reach — the slowest ship sets the pace, Naval
// speeds it (mirrors computeMovePoolMax's sea pool). Before this a hulls-only column read botLandReach = 0
// and every admiral who had bought his fleet held in harbour for the rest of the game.
export function botSeaReach(c) {
  const sh = (c.armies || []).filter((a) => a && BOT_SEA_ALL.has(a.type));
  if (!sh.length) return 0;
  const nl = Math.min((c.skills || {}).naval || 0, 5);
  return Math.max(
    0,
    Math.min(
      5,
      Math.min(
        ...sh.map((a) => {
          const b = ARMY_SPEED_MASTER[a.type] ?? 3;
          return b + navalSpeedBonus(b, nl);
        }),
      ),
    ),
  );
}
// a column of ships only (nothing that can step ashore) — it may claim or clear water, never land.
export function botFleetOnly(armies) {
  armies = armies || [];
  return armies.length > 0 && armies.every((a) => a && BOT_SEA_ALL.has(a.type));
}
export function botEmpireDiameter(G, pi) {
  const own = (G.world.provinces || []).filter((p) => p && p.owner === pi && p.terrain !== 'sea');
  let d = 0;
  for (let i = 0; i < own.length; i++)
    for (let j = i + 1; j < own.length; j++) {
      const x = botHexDist(G, own[i], own[j]);
      if (x > d) d = x;
    }
  return d;
}
// How good a field commander this character is. Tactical dominates (battle multiplier + drilling),
// March
// (reach), then personal combat; the units already under command add a little so the current holder of
// the host is not displaced by a marginally better tactician every turn.
export function botGeneralship(c) {
  const s = c.skills || {};
  const a = c.armies || [];
  const n = a.length;
  // Sept 2026 (review §3): a lord of the column's own blood (+20% kinship, no grudge) and a Necromancy king
  // over skeletons (×1.5 fanaticism vs ×1.3) are better generals than the raw skills say.
  const kin = n ? a.filter((x) => x && x.race === c.race).length / n : 0;
  const RIV = { ...KC_RIVAL_RACE };
  const grudge = n ? a.filter((x) => x && RIV[x.race] === c.race).length / n : 0;
  const skel = n ? a.filter((x) => x && x._isSkeletal).length / n : 0;
  return (
    (s.tactical || 0) * 4 +
    (s.march || 0) * 2 +
    (s.melee || 0) +
    (s.archery || 0) +
    Math.min(10, n) +
    (n >= 3 ? 8 : 0) +
    Math.round(kin * 4 - grudge * 6) +
    (c.isKing && (s.necromancy || 0) >= 1 && skel >= 0.5 ? 10 : 0)
  );
} // +8 sticky bonus: handing a host to a marginally better general cost a turn of conquest every time a hero was hired
// Per-turn scratch state (roles + treasury ledger), keyed by the live game-state object so it never
// leaks into the persisted game_state and never survives into the next turn.
export const _botTurnCache = new WeakMap();
export function botTurnCache(G) {
  let o = _botTurnCache.get(G);
  if (!o || o.turn !== G.turn) {
    o = { turn: G.turn, roles: {}, ledger: {} };
    _botTurnCache.set(G, o);
  }
  return o;
}
// ROLES — field-army LEADERS (best generals; one per desired field army) vs FEEDERS (everyone
// else). Desired field armies = 1 + floor(empire diameter / primary reach): once the realm is wider
// than the main host can cross in a turn, a second host is raised, and so on.
export function botRoles(G, pi) {
  const cache = botTurnCache(G);
  if (cache.roles[pi]) return cache.roles[pi];
  botUpdateIntel(G, pi); // Sept 2026: refresh the memory of rival generals and heroes first
  const all = (G.characters || []).filter((c) => c && c.alive && c.player === pi && !c._isHeir);
  // Sept 2026 (Toby: bot defence): standing DEFENDERS (c._botRole, set below) sit outside the
  // general ranking, so a defender who has raised three units is not pulled off his post as a new
  // field leader.
  const sticky = all.filter((c) => c._botRole === 'defender' && !c.isKing);
  let chars = all.filter((c) => !sticky.includes(c));
  if (!chars.length) chars = all;
  const ranked = [...chars].sort((a, b) => botGeneralship(b) - botGeneralship(a));
  const primary = ranked[0] || null;
  const reach = Math.max(1, primary ? botLandReach(primary) || 1 : 3);
  const holding = chars.filter((c) => (c.armies || []).length >= 3).length; // a split-off second host keeps its own commander
  const heroCount = all.filter((c) => !c.isKing).length;
  const want = Math.max(
    1,
    holding,
    Math.min(ranked.length, 1 + Math.floor(botEmpireDiameter(G, pi) / reach)),
    heroCount >= 3 && primary && primary.isKing ? 2 : 1,
  ); // Sept 2026 (Toby): a HERO general beside a king who leads, once the court has three heroes
  const leaders = ranked.slice(0, want).map((c) => c.id);
  // ── ROLE PRIORITY (2026-09-26, Toby item 2/3): General > Slayer > Sage > Explorer > Admiral > Flying
  // General > Defender > Spy > Thief. The first three specialists are filled by botSpecialistRoles from
  // whoever is left; the admiral and the flying general are therefore only wanted once the court has
  // FOUR non-king heroes (the general's slot may be the king's), and defenders only from the heroes left
  // after those. The one exception: a realm whose land frontier is spent wants its admiral at any size.
  const _landSpent = !(G.world.provinces || []).some(
    (p) => p && p.owner === pi && p.terrain !== 'sea' && botIsEdge(G, pi, p),
  ); // no owned land borders unowned or enemy land
  // ADMIRAL (Sept 2026, Toby): once there is sea worth taking, the best remaining non-king general (sticky via
  // _botRole) is a leader whose front is the water — see botSeaStrike / botFieldRecruitTokens.
  {
    const wantAdm =
      botSeaWorthTaking(G, pi) && ranked.length > want && (heroCount >= 4 || (_landSpent && heroCount >= 2));
    let adm = all.find((c) => c._botRole === 'admiral' && c.alive && !c.isKing);
    if (!wantAdm) {
      if (adm) {
        delete adm._botRole;
      }
      adm = null;
    } else if (!adm || leaders.includes(adm.id)) {
      adm =
        ranked
          .filter(
            (c) => !c.isKing && !leaders.includes(c.id) && c._botRole !== 'defender' && c._botRole !== 'skygeneral',
          )
          .sort(
            (a, b) =>
              ((b.skills || {}).naval || 0) * 3 +
              botGeneralship(b) -
              ((a.skills || {}).naval || 0) * 3 -
              botGeneralship(a),
          )[0] || null;
    }
    all.forEach((c) => {
      if (c._botRole === 'admiral' && c !== adm) delete c._botRole;
    }); // one admiral only
    if (adm) {
      adm._botRole = 'admiral';
      if (!leaders.includes(adm.id)) leaders.push(adm.id);
    }
  }
  // FLYING GENERAL (2026-09-26, Toby item 8): one per realm, sticky, once a province of ours raises a humanoid
  // flyer, another crown has been met (or from turn 5) and five heroes serve. He recruits flyers and the foot
  // they carry and makes lightning strikes over sea and behind the front — botAirStrike.
  {
    const wantSky =
      botFlyerPorts(G, pi).length > 0 &&
      ranked.length > leaders.length &&
      heroCount >= 5 &&
      (botHasMetPlayers(G, pi) || (G.turn || 0) >= 5);
    let sky = all.find((c) => c._botRole === 'skygeneral' && c.alive && !c.isKing);
    if (!wantSky) {
      if (sky) {
        delete sky._botRole;
      }
      sky = null;
    } else if (!sky || leaders.includes(sky.id)) {
      sky =
        ranked
          .filter((c) => !c.isKing && !leaders.includes(c.id) && c._botRole !== 'defender' && c._botRole !== 'admiral')
          .sort(
            (a, b) =>
              ((b.skills || {}).druid || 0) * 2 +
              botGeneralship(b) -
              ((a.skills || {}).druid || 0) * 2 -
              botGeneralship(a),
          )[0] || null;
    }
    all.forEach((c) => {
      if (c._botRole === 'skygeneral' && c !== sky) delete c._botRole;
    });
    if (sky) {
      sky._botRole = 'skygeneral';
      if (!leaders.includes(sky.id)) leaders.push(sky.id);
    }
  }
  // DEFENDERS — one per four land provinces (max 3) once another crown has been met (or from turn
  // 4), and never at the expense of the slayer, the scholar and the scout: only the heroes beyond the
  // first three free (non-leading) ones may be posted. Existing defenders keep the role; new ones are the
  // best non-leader fighters, preferring anyone already holding a column and steering mages toward
  // companion duty instead.
  const leaderSet = new Set(leaders);
  const freeHeroes = all.filter((c) => !c.isKing && !leaderSet.has(c.id)).length;
  const wantDef = botSafeWindow(G)
    ? 0
    : botHasMetPlayers(G, pi) || (G.turn || 0) >= 4
      ? Math.max(0, Math.min(3, Math.floor(botLandCount(G, pi) / 4), freeHeroes - 3))
      : 0;
  let defenders = sticky.filter((c) => !leaderSet.has(c.id));
  const defScore = (c) => {
    const s = c.skills || {};
    return (
      (c.armies || []).length * 5 +
      (s.tactical || 0) * 3 +
      (s.melee || 0) +
      (s.archery || 0) -
      botMagicScore(c) * 2 -
      ((s.sage || 0) + (s.spy || 0) + (s.thief || 0) + (s.explorer || 0)) * 2
    );
  };
  defenders.sort((a, b) => defScore(b) - defScore(a));
  defenders = defenders.slice(0, wantDef);
  const pool = all
    .filter((c) => !c.isKing && !leaderSet.has(c.id) && !defenders.includes(c))
    .sort((a, b) => defScore(b) - defScore(a));
  while (defenders.length < wantDef && pool.length) defenders.push(pool.shift());
  const defIds = defenders.map((c) => c.id);
  all.forEach((c) => {
    if (defIds.includes(c.id)) c._botRole = 'defender';
    else if (c._botRole === 'defender') {
      delete c._botRole;
      delete c._botPost;
    }
  });
  const r = { leaders, defenders: defIds, primaryId: primary ? primary.id : null, reach, want };
  cache.roles[pi] = r;
  return r;
}
export function botIsLeader(G, pi, id) {
  return botRoles(G, pi).leaders.includes(id);
}
// LEDGER — one treasury/upkeep budget per bot per turn, shared by the movement and economy passes
// so a recruit written in phase 0 by a marching host is not double-spent by an idle holder later.
export function botLedger(G, pi) {
  const cache = botTurnCache(G);
  if (cache.ledger[pi]) return cache.ledger[pi];
  const T = botTuning(G, pi),
    player = G.players[pi] || {};
  const income = botTaxIncome(G, pi);
  // WAR FOOTING: at war (or facing a big enemy host) the bot spends its treasury down and lifts its
  // sustainable army ceiling toward 100% of income; in peacetime it keeps the tuned cap + a small
  // chest.
  const warFooting = botAtWar(G, pi) || botMaxEnemyStack(G, pi) > 5;
  const effCapFrac = warFooting ? 1.0 : T.upkeepCapFrac; // Sept 2026 (review II A1): at war the whole income is wages
  const reserve = warFooting ? Math.min(8, Math.max(2, Math.floor(botUpkeep(G, pi) * 0.15))) : T.goldReserve; // Sept 2026 (R9): at war, one quarter-turn of wages stays in the chest so a lost battle does not disband the army
  const budget = (player.gold || 0) - reserve;
  // "As much as they can afford": wages are paid from the treasury, not just income, so a chest can
  // carry a deficit. The cap is the income share PLUS a third of the free treasury — a host the
  // realm can pay for four turns while the conquests it makes pay it back.
  const L = {
    income,
    warFooting,
    upkeepCap: Math.floor(income * effCapFrac + Math.max(0, budget) * (botLandCount(G, pi) < 15 ? 0.6 : T.chestShare)),
    upkeep: botUpkeep(G, pi),
    budget,
    recruitedByProv: {},
  };
  // 2026-09-28 (Toby: slayers must always have the gold to hunt rumours): 4g a slayer (two Moderate or four Weak
  // rumours) is set aside BEFORE any muster can spend it; botRumourAffordable / botSpendRumour draw on it first.
  {
    const nSl = (G.characters || []).filter((c) => c && c.alive && c.player === pi && c._botRole === 'slayer').length;
    L.rumourFund = Math.max(0, Math.min(Math.max(0, budget), nSl * BOT_RUMOUR_FUND_PER_SLAYER));
    L.budget -= L.rumourFund;
  }
  // 2026-09-29 (Toby): WAR CHEST — for every host of ours in CONTACT (botInContact) 10g is held back, up to
  // half the free treasury, BEFORE the planner and the economy can spend it; runBotPhaseOne('muster') opens
  // it for those hosts' Spring musters and hands back whatever is left.
  {
    const nC = (G.characters || []).filter(
      (c) => c && c.alive && c.player === pi && !c._isHeir && botInContact(G, pi, c),
    ).length;
    L.warChest = Math.max(0, Math.min(Math.floor(Math.max(0, L.budget) * BOT_P1.chestShare), nC * BOT_P1.chestPerHost));
    L.budget -= L.warChest;
  }
  L.diag = {
    gold: player.gold || 0,
    income,
    reserve,
    budget0: budget,
    upkeep0: L.upkeep,
    cap: L.upkeepCap,
    calls: 0,
    noTypes: 0,
    noKin: 0,
    capStop: 0,
    budgetStop: 0,
    tokens: 0,
    holdersIdle: 0,
    holdersInRecruit: 0,
  }; // Sept 2026 (§99 diagnosis; read by the study through window.__botDiag)
  // Sept 2026 (Toby: bot defence): while the realm's DEFENDERS stand under-strength (fewer than three
  // units each), 30% of the wage ceiling is held back from the field hosts' muster so the posts get
  // troops too — otherwise the leaders, who muster first, spent every coin every year.
  const _defs = botRoles(G, pi)
    .defenders.map((id) => (G.characters || []).find((c) => c && c.id === id))
    .filter(Boolean);
  const _defUnits = _defs.reduce((n, c) => n + (c.armies || []).length, 0);
  L.defReserve = _defs.length && _defUnits < 3 * _defs.length ? Math.floor(L.upkeepCap * 0.2) : 0;
  // 2026-09-26 (Toby items 1 / 6 / 8): the same for the NAVY and the AIR — while the admiral has fewer than
  // three hulls, or the flying general fewer than two flyers, a share of the ceiling is held back from every
  // other muster (the land general musters first and was spending every coin before the fleet got a hull).
  {
    const chars = G.characters || [];
    const adm = chars.find((c) => c && c.alive && c.player === pi && c._botRole === 'admiral');
    const sky = chars.find((c) => c && c.alive && c.player === pi && c._botRole === 'skygeneral');
    const hulls = adm ? (adm.armies || []).filter((a) => a && BOT_CARRIER_TYPES.has(a.type)).length : 9;
    const wings = sky ? (sky.armies || []).filter((a) => a && BOT_FLYING_TYPES.has(a.type)).length : 9;
    const atPort =
      adm &&
      (() => {
        const X = G.world.provinces[adm.location];
        return X && X.owner === pi && !!botCoastalFleetType(X);
      })(); // only while he stands where hulls are laid down — a reserve nobody can spend this turn is gold idling
    const atEyrie =
      sky &&
      (() => {
        const X = G.world.provinces[sky.location];
        return X && X.owner === pi && !!botFlyerType(X);
      })();
    void hulls;
    void wings;
    void atPort;
    void atEyrie;
    L.navReserve = 0;
    L.airReserve = 0; // superseded 2026-09-28 by the separate wage caps below
    // ── NAVY and AIR WAGE CAPS (2026-09-28, Toby): the admiral and the flying general each draw on a wage
    // ceiling of their OWN, carved out of the realm's ceiling while they serve — 20% for the navy, 15% for
    // the air (never less than one unit's wages). Their columns' army wages are billed to their own cap;
    // the land hosts, garrisons and hero wages share what is left. Before this the reserves above only held
    // gold back from OTHER musters, which did nothing once the realm's wages already filled the ceiling —
    // the study found the admiral at port with no headroom two years in three.
    const _wage = (x) =>
      (x.armies || []).reduce(
        (w, a) =>
          w +
          (!a || a._temporary || a._wildHuntUntilTurn != null ? 0 : a._isSkeletal ? 1 : ARMY_COST_MASTER[a.type] || 2),
        0,
      );
    const full = L.upkeepCap;
    L.nav = adm
      ? { cap: Math.max(BOT_NAV_CAP_MIN, Math.floor(full * BOT_NAV_CAP_FRAC)), upkeep: _wage(adm), id: adm.id }
      : null;
    L.air = sky
      ? { cap: Math.max(BOT_AIR_CAP_MIN, Math.floor(full * BOT_AIR_CAP_FRAC)), upkeep: _wage(sky), id: sky.id }
      : null;
    L.upkeepCap = Math.max(0, full - (L.nav ? L.nav.cap : 0) - (L.air ? L.air.cap : 0));
    L.upkeep = L.upkeep - (L.nav ? L.nav.upkeep : 0) - (L.air ? L.air.upkeep : 0);
    if (L.defReserve) L.defReserve = Math.floor(L.upkeepCap * 0.2); // the defenders' 20% is of the LAND ceiling now
    L.diag.navCap = L.nav ? L.nav.cap : 0;
    L.diag.airCap = L.air ? L.air.cap : 0;
  }
  cache.ledger[pi] = L;
  return L;
}
export const BOT_NAV_CAP_FRAC = 0.2,
  BOT_AIR_CAP_FRAC = 0.15,
  BOT_NAV_CAP_MIN = 4,
  BOT_AIR_CAP_MIN = 4; // 2026-09-28: see botLedger
export function botCanAfford(L, cost) {
  return L.budget >= cost && L.upkeep + cost <= L.upkeepCap;
}
export function botSpend(L, cost) {
  L.budget -= cost;
  L.upkeep += cost;
}
// GARRISONS: one cheap unit per province — enough to make an enemy stop and fight, never meant to
// hold. Only once a player is actually on our doorstep (in or beside our land) do valuable
// provinces get 2 and the capital 3.
export function botUnderAttack(G, pi) {
  // an enemy host counts only once the realm can see it (in our own land, or in ground we have eyes
  // on beside it) — botSeesChar is the same rule the player's map uses.
  return (G.characters || []).some((e) => {
    if (!(
      e &&
      e.alive &&
      e.player != null &&
      e.player !== pi &&
      (e.armies || []).length &&
      botRelationRaw(G, pi, e.player) === 'enemy'
    ))
      return false;
    if (!botSeesChar(G, pi, e)) return false;
    const P = G.world.provinces[e.location];
    if (!P) return false;
    if (P.owner === pi) return true;
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, P, i);
      if (N && N.owner === pi) return true;
    }
    return false;
  });
}
export function botGarrisonTarget(G, prov, pi) {
  if (!prov || prov.owner !== pi || prov.terrain === 'sea') return 0;
  // Sept 2026 (Toby): garrisons only in Prosperous/Rich land (tax 4+; the capital always), never
  // more than 2 per province. Defence proper is the DEFENDER heroes (botRoles / botDefenderOrders).
  // 2026-09-26 (Toby): FEWER GARRISONS, BIGGER FIELD HOST. Only the capital is garrisoned in peace (one unit);
  // once an enemy host is on the doorstep the capital takes two and a Rich province (tax 7+) one. Everything
  // else is held by the defenders and the field army — every levy not sunk into a garrison marches with the general.
  const home = prov.id === botHomeId(G, pi);
  const attacked = botUnderAttack(G, pi);
  if (home) return attacked ? 2 : botSafeWindow(G) ? 0 : 1; // Safe Start: no peace garrison while no war can come before next turn
  return attacked && (prov.tax || 0) >= 7 ? 1 : 0;
}
export function botGarrisonType(prov) {
  return (prov.armyTypes || []).find((x) => /garrison/i.test(x)) || null;
}
export function botGarrisonOrder(G, pi, prov, L) {
  const tgt = botGarrisonTarget(G, prov, pi),
    have = (prov.garrisonArmies || []).length;
  if (have >= tgt) return null;
  const gt = botGarrisonType(prov);
  if (!gt) return null;
  const done = (L.recruitedByProv[prov.id] = L.recruitedByProv[prov.id] || {});
  if (done[gt]) return null;
  const cost = ARMY_COST_MASTER[gt] || 1;
  let q = 0;
  while (q < Math.min(2, tgt - have) && botCanAfford(L, cost)) {
    q++;
    botSpend(L, cost);
  }
  if (!q) return null;
  done[gt] = 1;
  return { action: 'recruit', target: `${gt}|${q},to:garrison`, extra: '', desc: `Garrison ${prov.name} (${q})` };
}
// FIELD RECRUITMENT — one Recruit order packing the strongest affordable, sustainable field units
// this province offers (2 of a type where tax>=10 allows). Navy first when there is a naval reason
// here.
// 2026-09-28 (Toby): troops raised for the ADMIRAL or the FLYING GENERAL are paid from their own wage cap
// (L.nav / L.air, see botLedger) — the ledger's ceiling is swapped for the pool's while the muster runs.
export function botRecruitCmdr(G, pi, c) {
  if (c && (c._botRole === 'admiral' || c._botRole === 'skygeneral')) return c;
  return (
    (G.characters || []).find(
      (l) => l && l.alive && l.player === pi && l.id !== c.id && l.location === c.location && botIsLeader(G, pi, l.id),
    ) || c
  );
}
export function botFieldRecruitTokens(G, pi, c, prov, L) {
  const cm = botRecruitCmdr(G, pi, c);
  const pool = cm._botRole === 'admiral' ? L.nav : cm._botRole === 'skygeneral' ? L.air : null;
  if (!pool) return botFieldRecruitTokensCore(G, pi, c, prov, L);
  const su = L.upkeep,
    sc = L.upkeepCap;
  L.upkeep = pool.upkeep;
  L.upkeepCap = pool.cap;
  try {
    return botFieldRecruitTokensCore(G, pi, c, prov, L);
  } finally {
    pool.upkeep = L.upkeep;
    L.upkeep = su;
    L.upkeepCap = sc;
  }
}
export function botFieldRecruitTokensCore(G, pi, c, prov, L) {
  if (!prov || !prov.armyTypes || prov.owner !== pi) return [];
  const done = (L.recruitedByProv[prov.id] = L.recruitedByProv[prov.id] || {});
  const perTypeLimit = L.upkeepCap - L.upkeep >= 12 ? 3 : prov.tax >= 10 || L.budget >= 20 ? 2 : 1; // Sept 2026 (§99): the ledger showed 17g of unused wage ceiling per turn with few holders in recruit provinces — a wide ceiling buys three of a kind
  const tokens = [];
  const fleetType = botCoastalFleetType(prov);
  // Sept 2026: a fleet pins a mixed host to the coast (it cannot march overland while leading
  // ships), so hulls are bought only for a real naval reason — an at-war enemy coast across the
  // water — or once the realm has no land frontier left to expand into.
  const cmdr = botRecruitCmdr(G, pi, c); // who will lead these recruits (the admiral / flying general raise for themselves)
  const adm = cmdr._botRole === 'admiral';
  const sky = cmdr._botRole === 'skygeneral';
  const D = L.diag || {};
  D.calls = (D.calls || 0) + 1;
  const _navalNeed =
    fleetType &&
    !sky &&
    (adm || botNavalEnemyCoast(G, prov, pi) || (!botIsEdge(G, pi, prov) && botFrontierTarget(G, pi, prov) == null)); // a hull would ground the flying general's column
  // Sept 2026 (Toby): the ADMIRAL raises hulls at his port until every liftable land unit he leads has a berth
  // (plus one spare), up to a cap that grows with the realm; other hosts buy a single hull for the old reasons.
  // 2026-09-26 (item 1): the cap starts at three hulls and grows a hull per three land provinces (was 2 + land/4).
  const hullCap = adm ? Math.min(10, 3 + Math.floor(botLandCount(G, pi) / 3)) : 3;
  if (_navalNeed && !done[fleetType] && botFleetHullCount(G, pi) < hullCap) {
    const cost = ARMY_COST_MASTER[fleetType] || 3;
    let q = 0;
    const myHulls = (cmdr.armies || []).filter((a) => a && BOT_CARRIER_TYPES.has(a.type)).length,
      myLand = (cmdr.armies || []).filter((a) => a && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type)).length;
    const wantHulls = adm ? Math.max(1, Math.min(hullCap - botFleetHullCount(G, pi), myLand + 1 - myHulls)) : 1;
    while (q < wantHulls && botCanAfford(L, cost)) {
      q++;
      botSpend(L, cost);
    }
    if (q > 0) {
      tokens.push(`${fleetType}|${q}`);
      done[fleetType] = 1;
    }
  }
  const hold =
    adm || sky ? 0 : (c._botRole === 'defender' ? 0 : L.defReserve || 0) + (L.navReserve || 0) + (L.airReserve || 0); // the defenders' share (see botLedger); the navy / air pay from their own caps
  const canAff = (cost) => botCanAfford(L, cost) && L.upkeep + cost <= L.upkeepCap - hold;
  // the admiral fills his berths with the most effective LIFTABLE units the port raises, never more than the hulls carry
  let berths = adm
    ? (cmdr.armies || []).filter((a) => a && BOT_CARRIER_TYPES.has(a.type)).length +
      tokens.reduce((s, tk) => s + (BOT_CARRIER_TYPES.has(tk.split('|')[0]) ? +tk.split('|')[1] : 0), 0) -
      (cmdr.armies || []).filter((a) => a && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type)).length
    : 99;
  const kinds = botRecruitableTypes(prov, G, cmdr);
  if (!kinds.length) {
    const landKinds = (prov.armyTypes || []).filter((t) => t && !/garrison/i.test(t) && !BOT_NAVAL_TYPES.has(t));
    if (landKinds.length) D.noKin = (D.noKin || 0) + 1;
    else D.noTypes = (D.noTypes || 0) + 1;
  }
  // 2026-09-26 (Toby item 8): the FLYING GENERAL musters an airborne column — the province's humanoid flyers
  // first (they fly and each carries one foot soldier), then liftable foot up to the number of flyers he
  // will have; nothing that would ground the column (horses, hulls, creatures, monsters).
  if (sky) {
    const ft = botFlyerType(prov);
    const have = cmdr.armies || [];
    let flyers = have.filter((a) => a && BOT_FLYING_TYPES.has(a.type)).length,
      foot = have.filter((a) => a && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type)).length;
    if (ft && !done[ft]) {
      const cost = ARMY_COST_MASTER[ft] || 4;
      let q = 0;
      const wantF = Math.max(1, Math.min(perTypeLimit, foot + 1 - flyers));
      while (q < wantF && canAff(cost)) {
        q++;
        botSpend(L, cost);
        flyers++;
      }
      if (q > 0) {
        tokens.push(`${ft}|${q}`);
        done[ft] = 1;
        D.tokens = (D.tokens || 0) + q;
      }
    }
    for (const t of kinds) {
      if (done[t] || BOT_FLYING_TYPES.has(t) || !botLiftable(t) || BOT_SEA_ALL.has(t)) continue;
      if (foot >= flyers) break;
      if (!canAff(1)) break;
      const cost = ARMY_COST_MASTER[t] || 2;
      let q = 0;
      while (q < perTypeLimit && foot < flyers && canAff(cost)) {
        q++;
        botSpend(L, cost);
        foot++;
      }
      if (q > 0) {
        tokens.push(`${t}|${q}`);
        done[t] = 1;
        D.tokens = (D.tokens || 0) + q;
      }
    }
    return tokens;
  }
  for (const t of kinds) {
    if (done[t]) continue;
    if (!canAff(1)) {
      if (L.budget < 1) D.budgetStop = (D.budgetStop || 0) + 1;
      else D.capStop = (D.capStop || 0) + 1;
      break;
    }
    if (adm && (!botLiftable(t) || berths <= 0)) continue;
    const cost = ARMY_COST_MASTER[t] || 2;
    let q = 0;
    while (q < perTypeLimit && canAff(cost) && (!adm || berths > 0)) {
      q++;
      botSpend(L, cost);
      if (adm) berths--;
    }
    if (q > 0) {
      tokens.push(`${t}|${q}`);
      done[t] = 1;
      D.tokens = (D.tokens || 0) + q;
    }
  }
  return tokens;
}
export function botRecruitOrder(tokens, destId) {
  if (!tokens.length) return null;
  const n = tokens.reduce((s, tk) => s + parseInt(tk.split('|')[1] || 1), 0);
  return {
    action: 'recruit',
    target: tokens.join(',') + (destId != null ? `,to:${destId}` : ''),
    extra: '',
    desc: 'Recruit ' + n + ' unit' + (n > 1 ? 's' : ''),
  };
}
export function botHeroCap(G, pi) {
  const land = (G.world.provinces || []).filter((p) => p && p.owner === pi && p.terrain !== 'sea').length;
  const pl = (G.players || [])[pi] || {};
  return 4 + land + (pl.alignment === 'Neutral' ? 1 : 0) + ((pl.gold || 0) > 30 ? 2 : 0);
} // Sept 2026 (Toby): hire as much as possible   // §94: a fat chest hires two more   // Neutral: wages capped at 3g, so the widest court   // more heroes = more actions (was 2+land/2)
// 2026-09-28 (Toby, option 1): a SLAYER must be a fighter — Melee or Archery 2+. While the realm has no fighting
// slayer, a wandering fighter is worth two hops more than any other wanderer (seek / broker choices).
// BOT_SLAYER_FIGHTERS_ONLY (option 1, strict): true = only a fighter may hold the slayer role at all. Tested
// 2026-09-28: 2.5× the clears per slayer, but 60% fewer slayers and −14% lairs cleared overall (the trainee
// slayers grow into hunters and are the group-practice partners), so it ships OFF; the hiring preference stays on.
export const BOT_SLAYER_FIGHTERS_ONLY = false;
export function botIsFighter(h) {
  const s = (h && h.skills) || {};
  return (s.melee || 0) >= 2 || (s.archery || 0) >= 2;
}
export function botNeedsSlayer(G, pi) {
  return !(G.characters || []).some(
    (c) => c && c.alive && c.player === pi && c._botRole === 'slayer' && botIsFighter(c),
  );
}
export function botHireBias(G, pi, h) {
  return botIsFighter(h) && botNeedsSlayer(G, pi) ? 2 : 0;
}
export function botHireOrder(G, pi, c, L) {
  L.hired = L.hired || new Set(); // one claimant per wanderer per turn
  // botSeesChar — a hero standing beside our own character is normally plainly visible, but one who
  // moved in unspotted, is Invisible or wears a Cloak of Many Faces is not, and the human's Hire
  // list would not offer them either.
  const hh = (G.characters || []).find(
    (h) =>
      h &&
      h.alive &&
      h.player === null &&
      h.location === c.location &&
      !h._isNeutralGuard &&
      !h._justDefeated &&
      !L.hired.has(h.id) &&
      botSeesChar(G, pi, h) &&
      heroHireWage((G.players[pi] || {}).alignment || 'Neutral', h.alignment, false, h) != null,
  );
  if (!hh) return null;
  // Self-play finding: an uncapped court (15 heroes, no army) ate the whole wage budget. Cap heroes
  // to the realm's size so wages stay with the field army.
  const heroes = (G.characters || []).filter((x) => x && x.alive && x.player === pi && !x.isKing && !x._isHeir).length;
  if (heroes >= botHeroCap(G, pi)) return null;
  const wage = heroHireWage((G.players[pi] || {}).alignment || 'Neutral', hh.alignment, false, hh);
  // a hero's wage (1–3g) is paid from the chest and no longer competes with troops for the upkeep
  // cap — bots try to hire at least one wanderer every turn they can reach one.
  if (wage == null || L.budget < wage) return null;
  botSpend(L, wage);
  L.hired.add(hh.id);
  return { action: 'hire', target: String(hh.id), extra: '', desc: 'Hire ' + hh.name };
}
// ══ BOT HERO ROLES (Sept 2026, Toby: "put heroes to use") ════
// Before this every unarmed bot hero fell through seek-wanderer → companion → (at war) hunter/raider →
// march-to-muster → idle practice, and the idle practice converged on the strongest skill in the room
// (melee/tactical). A twelve-hero court sat at the capital drilling Melee while nobody explored, spied,
// stole or researched. Two new kinds of role fix that:
//   DEFENDERS — armed non-leaders posted where a Defend watch (the province + its six neighbours) covers
//     the most owned tax nobody else guards. Chosen in botRoles, sticky via c._botRole, never fed to a
//     leader. One Defend in the first (or second) phase, then Bless/Oratory/Illusory Terrain, cross-training
//     with anyone standing there, or Tactical drill.
//   SPECIALISTS — scholar (Sage → Research), scout (Explorer → Explore unmapped land to find lairs),
//     spy (Spy → spy on rival provinces), thief (Thief → rob rival heroes and paymasters). Assigned each turn
//     by aptitude toward whichever role the realm lacks, sticky via c._botRole. A specialist below the
//     working level trains its skill at the capital (so the mentor rule fires); at the working level it goes
//     to work. Fighters (Melee/Archery 3+) additionally travel to any beatable discovered lair in reach.
// Everything a role reads is gated on what the realm can see (botKnows / botSees / botSeesChar), as before.
