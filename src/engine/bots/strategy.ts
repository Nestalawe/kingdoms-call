// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kitTactics } from '../alignment-prototypes.ts';
import { protoAlignOf } from '../alignment-prototypes.ts';
import { gdActiveFor } from '../grand-design.ts';
import { KC_RIVAL_RACE, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { ARMY_COST_MASTER, ARMY_SPEED_MASTER, botSafeWindow, SKILL_LABELS } from '../army-tables.ts';
import { marchSpeedBonus, navalSpeedBonus } from '../units/movement.ts';
import { heroHireWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { TAMED_FLYER_TYPES_D } from '../rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import { druIdPenaltyMult } from '../world/tables.ts';
import { actionSpellsAllowedPerSchoolEachTurn } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import { graveServedOther } from '../heroes/charms-and-neutrals.ts';
import { UNIT_BASE_STR, unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import {
  BOT_AERIAL_TYPES,
  BOT_CARRIER_TYPES,
  BOT_DEF_BONUS,
  BOT_MONSTER_ARMIES,
  BOT_SEA_ALL,
  BOT_TUNING,
  botBelievedOwner,
  botEffForce,
  botForceStrength,
  botGuessDefence,
  botHasDisc,
  botNeighbourProv,
  botRaceTerrainMult,
  botRelationRaw,
  botSees,
  botSeesChar,
  botTuning,
  botTurnCache,
  botVisibleCharsIn,
  botDruidShortfall,
  BOT_HEX_DIRS,
  botBelief,
  botBattleForce,
  botKnownSkills,
  BOT_ASSUMED_SKILLS,
} from './intel.ts';
import { BOT_SPECIALIST_SKILLS } from './specialist-skills.ts';

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
    const base = ARMY_SPEED_MASTER[t] || 3;
    const sp = BOT_AERIAL_TYPES.has(t) ? base : base + marchSpeedBonus(ml);
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
          const b = ARMY_SPEED_MASTER[a.type] || 3;
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
  // PROTOTYPE tactics (round 5, Toby): BEAST FUND — a Druidic or Evil realm sets half its free gold (to 12g) aside for
  // the beasts of its own provinces before any other muster, and that gold is spent on beasts even past the wage cap:
  // a beast realm fields beasts before levies. botBeastMusterPlan and the kit's recruit draw on it (botBeastFundPay).
  {
    const kit = kitTactics(G, pi);
    L.beastFund =
      kit === 'Druidic' || kit === 'Evil' ? Math.max(0, Math.min(8, Math.floor(Math.max(0, L.budget) * 0.5))) : 0; // round 6: to 8g (round 5: 12g)
    L.budget -= L.beastFund;
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
/** PROTOTYPE tactics (round 5): pay `cost` for a beast from the beast fund first (no wage-cap test), else from the
 *  general budget as any recruit; false when neither can. */
export function botBeastFundPay(L, cost) {
  if ((L.beastFund || 0) >= cost) {
    L.beastFund -= cost;
    L.upkeep += cost;
    return true;
  }
  if (!botCanAfford(L, cost)) return false;
  botSpend(L, cost);
  return true;
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
  // PROTOTYPE round 5 (Toby): under the bot switch (G.botLairHunting, KC_BOT_LAIRS=1) no bot recruits garrison
  // companies unless it has an ability that makes garrisons worth it (the Good kit's Shield and Yeomanry, or the Good
  // Grand Design). Off, the bots garrison as they do today, so a game without the switch plays as it did.
  if (G.botLairHunting === true && protoAlignOf(G, pi) !== 'Good' && !gdActiveFor(G, pi, 'Good')) return 0;
  const home = prov.id === botHomeId(G, pi);
  const attacked = botUnderAttack(G, pi);
  if (home) return attacked ? 2 : botSafeWindow(G) ? 0 : 1; // Safe Start: no peace garrison while no war can come before next turn
  // PROTOTYPE tactics (Good): one company in every humanoid province, since the Shield makes it fight at ×1.5 (round 6
  // marched them at war; round 7 keeps them home: the Shield is a defence rule)
  if (kitTactics(G, pi) === 'Good' && !String(prov.race || '').startsWith('Primal') && !botSafeWindow(G)) return 1;
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
// ══ SHARED BY THE BOTS' PASSES ════
// Helpers that several of the bots' passes read, kept in this file, which the passes' files import.
// ── The war pass's judgments (bots/war.ts): a province's defence, what is worth holding, the enemies in sight ──
// Defending strength of an ENEMY PLAYER's province (Phase 4): the owner's characters standing there
// (their armies) plus any standing garrison. An undefended enemy province reads 0 → walked in freely.
// `viewerPi` is the realm doing the looking. Without sight of the province it gets the wealth-band
// guess, never the true garrison.
export function botEnemyDefence(G, prov, ownerPi, viewerPi) {
  if (!prov) return 0;
  if (viewerPi != null && !botSees(G, viewerPi, prov.id))
    return botGuessDefence(G, viewerPi, prov, prov.terrain) / BOT_DEF_BONUS;
  let s = 0;
  const pool =
    viewerPi != null
      ? botVisibleCharsIn(G, viewerPi, prov)
      : (prov.characters || []).map((id) => (G.characters || []).find((x) => x && x.id === id)).filter(Boolean);
  pool.forEach((c) => {
    if (c && c.alive && c.player === ownerPi) s += botEffForce(G, c);
  });
  (prov.garrisonArmies || []).forEach((a) => {
    s += unitBaseStrength(a);
  });
  return s;
}
// A province worth defending: the bot's home capital, or Rich land (tax ≥ 7). Marginal frontier
// provinces are not worth freezing a field army over — they can be lost and retaken.
export function botIsValuable(G, prov, pi) {
  if (!prov) return false;
  const home = (G.players[pi] || {}).homeProvinceId;
  // PROTOTYPE: a holy site to a Divine realm, a barrow to an Undead one, the stones to a Pagan one
  const kit = protoAlignOf(G, pi);
  if (
    kit &&
    (prov.features || []).some(
      (f) =>
        f &&
        f.ritualSite &&
        (kit === 'Divine'
          ? f.siteKind === 'holy'
          : kit === 'Undead'
            ? f.siteKind === 'barrow'
            : kit === 'Pagan' && !f.siteKind),
    )
  )
    return true;
  return prov.id === home || (prov.tax || 0) >= BOT_TUNING.valuableTax;
}
// How under-defended an owned province is RIGHT NOW: (strongest at-war enemy force adjacent to it)
// minus (its own defenders + garrison). >0 means an enemy on its border could take it as it stands
// — a candidate to reinforce. 0 means adequately held (or unthreatened).
export function botDefenceNeed(G, prov, pi) {
  if (!prov || prov.owner !== pi) return 0;
  let threat = 0;
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, prov, i);
    if (!N) continue;
    // a massing enemy is only a known threat if the realm can SEE it. A hex merely bordering our
    // land shows terrain and ownership, never the host standing on it — so an army gathering in
    // unseen country now falls on the bot unannounced, as it would on a player.
    let s = 0;
    botVisibleCharsIn(G, pi, N).forEach((e) => {
      if (e.player != null && e.player !== pi && botRelationRaw(G, pi, e.player) === 'enemy')
        s += botForceStrength(e.armies);
    });
    if (s > threat) threat = s;
  }
  if (threat <= 0) return 0;
  let def = 0;
  (prov.characters || []).forEach((id) => {
    const f = (G.characters || []).find((x) => x && x.id === id);
    if (f && f.alive && f.player === pi) def += botForceStrength(f.armies);
  });
  (prov.garrisonArmies || []).forEach((a) => {
    def += unitBaseStrength(a);
  });
  return Math.max(0, threat - def);
}
// The flying, creature and cavalry unit-type sets (bots/intel.ts has the rest).
export const BOT_FLYING_TYPES = new Set(KC_UNIT_CLASS.flying);
export const BOT_CREATURE_ARMIES = new Set(KC_UNIT_CLASS.creature);
export const BOT_CAVALRY_TYPES = new Set(KC_UNIT_CLASS.cavalry);
// only the enemy characters this realm can actually see. On ground it cannot see into, the answer
// is honestly empty — the bot then judges the province on its wealth-band guess alone.
export function botEnemyChars(G, prov, pi) {
  let force = 0,
    value = 0,
    hasKing = false,
    units = 0;
  botVisibleCharsIn(G, pi, prov).forEach((e) => {
    if (e.player != null && e.player !== pi && botRelationRaw(G, pi, e.player) === 'enemy') {
      force += botEffForce(G, e);
      value += e.isKing ? 50 : 15;
      if (e.isKing) hasKing = true;
      units += (e.armies || []).length;
    }
  });
  return { force, value, hasKing, units };
}
// ── Raise the fallen: the bodies this realm may raise (bots/movement.ts says the rule) ──
export function botRaiseTargets(G, pi) {
  const p = (G.players || [])[pi] || {};
  const known = new Set(p.knownDeadHeroIds || []);
  return (G.heroGraveyard || [])
    .filter((g) => {
      if (!g) return false;
      if (g._monarch) return g.player === pi && p._resurrectableMonarchId === g.id;
      return (
        !g.isKing &&
        g.player === pi &&
        known.has(g.id) &&
        !graveServedOther(g, pi) &&
        !(G.characters || []).some((c) => c && c.id === g.id && c.alive)
      );
    })
    .map((g) => ({
      g,
      loc: g.location,
      val: (g._monarch ? 100 : 0) + Object.values(g.skills || {}).reduce((a, b) => a + (b || 0), 0),
    }))
    .filter((x) => x.loc != null)
    .sort((a, b) => b.val - a.val);
}
// ── Spellcraft: the engine's per-school cap on casts each turn (bots/spellcraft.ts) ──
export function botSchoolLimit(lvl) {
  return actionSpellsAllowedPerSchoolEachTurn(lvl);
}
// ── The phase-one pass's tuning, and whether a host is in contact (bots/phase-one.ts says the pass) ──
export const BOT_P1 = {
  retreatRatio: 0.75,
  fleeRatio: 0.5,
  levyCap: 1.2,
  levyWages: 8,
  chestPerHost: 10,
  chestShare: 0.5,
  strike: new Set(['Flood', 'Plague', 'Curse', 'Psychic Blast', 'Telekinetic Storm', 'Charm']),
  guard: new Set(['Illusory Terrain', 'Oratory', 'Phantasmal Armies']),
  gainSpell: new Set(['Elemental Summon', 'Skeletal Armies']),
  reloc: new Set(['move', 'pursue', 'encounter', 'forced_march', 'lightning_advance']),
};
export function botEnemyHostsIn(G, pi, X) {
  return X
    ? botVisibleCharsIn(G, pi, X).filter(
        (e) =>
          e.player != null && e.player !== pi && (e.armies || []).length && botRelationRaw(G, pi, e.player) === 'enemy',
      )
    : [];
}
// A host in CONTACT: battle running here, a visible at-war host here or next door, or standing on enemy ground.
export function botInContact(G, pi, c) {
  if (!c || !(c.armies || []).length) return false;
  const P = G.world.provinces[c.location];
  if (!P) return false;
  if (P._battleUnresolved || botEnemyHostsIn(G, pi, P).length) return true;
  if (P.owner != null && P.owner !== pi && botRelationRaw(G, pi, P.owner) === 'enemy') return true;
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, P, i);
    if (N && botEnemyHostsIn(G, pi, N).length) return true;
  }
  return false;
}
// ── The economy pass's helpers: what a province can raise, wages and taxes (bots/economy.ts says the pass) ──
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
    if (align === 'Evil' && BOT_MONSTER_ARMIES.has(t)) m *= kitTactics(G, cmdr.player) === 'Evil' ? 1.5 : 1.25; // PROTOTYPE tactics: Savage Fury ×1.5
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
        if (a._temporary || a._wildHuntUntilTurn != null || a._slave) return;
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
// ── The specialists' pass's helpers (bots/specialists.ts says the pass): the specialist roles, a character's magic, the
// realm's land, the drill and the role skill, contact, a march's orders, the pathing and the frontier ──
export const BOT_SPECIALIST_ROLES = new Set(Object.keys(BOT_SPECIALIST_SKILLS));
export function botMagicScore(c) {
  const s = c.skills || {};
  return (s.elemental || 0) + (s.necromancy || 0) + (s.psychic || 0) + (s.illusory || 0) + (s.white || 0);
}
export function botLandCount(G, pi) {
  return (G.world.provinces || []).filter((p) => p && p.owner === pi && p.terrain !== 'sea').length;
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
// ── The missions pass's helpers (bots/missions.ts says the rules): enemy intel, lair rumours, admirals and flyers, a
// rival's known skills, duels and lessons ──
// Enemy intel: what the realm saw of rival characters (bots/missions.ts's ENEMY INTEL says what is kept).
export function botUpdateIntel(G, pi) {
  const p = (G.players || [])[pi];
  if (!p) return null;
  const I = (p._botIntel = p._botIntel || { generals: {}, heroes: {} });
  const turn = G.turn || 0;
  (G.characters || []).forEach((e) => {
    if (!(e && e.player != null && e.player !== pi)) return;
    if (!e.alive) {
      delete I.generals[e.id];
      delete I.heroes[e.id];
      return;
    }
    if (!botSeesChar(G, pi, e)) return;
    const rec = {
      turn,
      provId: e.location,
      units: (e.armies || []).length,
      name: e.name,
      player: e.player,
      isKing: !!e.isKing,
      strength: botBattleForce(G, e, null, 'plain', { viewerPi: pi }),
      skillsKnown: !botSkillsUnknown(G, pi, e),
    };
    if (rec.units) {
      I.generals[e.id] = rec;
      delete I.heroes[e.id];
    } else {
      I.heroes[e.id] = rec;
      delete I.generals[e.id];
    }
  });
  [I.generals, I.heroes].forEach((M) =>
    Object.keys(M).forEach((k) => {
      if (turn - M[k].turn > 6) delete M[k];
    }),
  );
  // review II A10: allied realms exchange reports — what an ally saw this turn is copied in (never overwriting fresher news)
  (G.players || []).forEach((a, j) => {
    if (j === pi || !a || !a._botIntel || botRelationRaw(G, pi, j) !== 'allied') return;
    [
      ['generals', I.generals, a._botIntel.generals],
      ['heroes', I.heroes, a._botIntel.heroes],
    ].forEach(([_, mine, theirs]) => {
      Object.keys(theirs || {}).forEach((k) => {
        const r = theirs[k];
        if (!r || r.player === pi || botRelationRaw(G, pi, r.player) !== 'enemy') return;
        if (!mine[k] || mine[k].turn < r.turn) mine[k] = { ...r };
      });
    });
  });
  return I;
}
export function botEnemyIntel(G, pi) {
  const p = (G.players || [])[pi];
  return (p && p._botIntel) || { generals: {}, heroes: {} };
}
export function botRumourFor(G, pi, c, f) {
  const r = f && f._rumourOdds && f._rumourOdds[pi];
  if (!r || r.charId !== c.id) return null;
  if ((G.turn || 0) - r.turn > 3) return null;
  if (r.rating != null && botLairRating(c) < r.rating) return null;
  if (BOT_LAIR_REASK_GAIN > 0 && r.rating != null && botLairRating(c) >= r.rating + BOT_LAIR_REASK_GAIN) return null;
  return r;
} // 2026-09-28: stale only if he has WEAKENED since (a level gained no longer voids it)
export function botLairRating(c) {
  const sk = c.skills || {};
  return (
    (c.maxHp || 20) +
    (sk.melee || 0) * 6 +
    (sk.tactical || 0) * 3 +
    (sk.archery || 0) * 2 +
    ((sk.elemental || 0) + (sk.necromancy || 0) + (sk.psychic || 0)) * 4 +
    (c.items || []).length
  );
}
export const BOT_RUMOUR_FUND_PER_SLAYER = 4;
// 2026-09-29 tuning knobs (defaults = previous behaviour): BOT_LAIR_GO_BAND_HI is the rumour band that sends a hero
// into a Moderate-or-higher lair (BOT_LAIR_GO_BAND stays the Weak one); BOT_LAIR_REASK_GAIN > 0 lets a hero re-ask a
// lair once his botLairRating has risen that much since he was told (0 = off: he waits out the six turns).
export const BOT_LAIR_GO_BAND_HI = 90,
  BOT_LAIR_REASK_GAIN = 3; // 2026-09-29 (Toby, study C4): re-ask once his rating has risen 3
// Admirals and flying generals (bots/missions.ts's NAVAL DOCTRINE and FLYING GENERAL).
export function botCoastalPorts(G, pi) {
  return (G.world.provinces || []).filter((p) => p && p.owner === pi && p.terrain !== 'sea' && botCoastalFleetType(p));
}
// 2026-09-26 (Toby item 1/6): ONE port is enough to want an admiral (was two — most realms never got there).
export function botSeaWorthTaking(G, pi) {
  const ports = botCoastalPorts(G, pi);
  if (ports.length < 1) return false;
  return ports.some((p) => {
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, p, i);
      if (!N || N.terrain !== 'sea') continue;
      if (N.owner == null || N.owner !== pi) return true;
    }
    return botNavalEnemyCoast(G, p, pi);
  });
}
export function botFlyerType(prov) {
  return ((prov && prov.armyTypes) || []).find((t) => BOT_FLYING_TYPES.has(t)) || null;
}
export function botFlyerPorts(G, pi) {
  return (G.world.provinces || []).filter((p) => p && p.owner === pi && p.terrain !== 'sea' && botFlyerType(p));
}
export function botLiftable(t) {
  return !(
    BOT_SEA_ALL.has(t) ||
    BOT_AERIAL_TYPES.has(t) ||
    BOT_CREATURE_ARMIES.has(t) ||
    BOT_MONSTER_ARMIES.has(t) ||
    BOT_CAVALRY_TYPES.has(t)
  );
}
// A clone of a rival with only the skills we know (for the duel forecast).
export function botAssumedChar(G, pi, e) {
  const k = botKnownSkills(G, pi, e);
  if (k === (e.skills || {}) || e.player === pi) return e;
  const c = JSON.parse(JSON.stringify(e));
  c.skills = k ? { ...k } : { ...BOT_ASSUMED_SKILLS };
  if (!k) {
    c.items = [];
  }
  return c;
}
export function botSkillsUnknown(G, pi, e) {
  return botKnownSkills(G, pi, e) === null;
}
export function botDuelSkill(c) {
  const s = c.skills || {};
  return Math.max(s.melee || 0, s.archery || 0, s.elemental || 0, s.necromancy || 0, s.psychic || 0);
}
export function botIsTeach(o) {
  return !!(o && o.action === 'practice' && /\(teach /.test(o.desc || ''));
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
