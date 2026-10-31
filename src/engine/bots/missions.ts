// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import {
  alignProto,
  CALL_OF_THE_WILD_RANGE,
  CALL_WILD_COST,
  CONSECRATE_COST,
  DESPOIL_COST,
  EMBARGO_COST,
  GOOD_WORKS_COST,
  GROW_WILD_COST,
  isBarrow,
  kingOrderReady,
  kitTactics,
  kitTargetBonus,
  LIGHT_BEACONS_COST_PER_COMPANY,
  neighboursOf,
  RITE_OF_AWAKENING_COST,
  BIND_BONES_COST,
  CALL_STORM_COST,
  PROCLAIM_CRUSADE_COST,
  protoBeastRoomExtra,
} from '../alignment-prototypes.ts';
import { hexDistP } from '../world/map-helpers.ts';
import {
  darkPactBlood,
  darkPactCost,
  darkPactKinds,
  stormTargets,
  tradePactPrice,
  tradePactPriceOwned,
  tradePactTargets,
} from '../orders/alignment-prototype-orders.ts';
import { KC_CARRIER_BERTHS, PRIMAL_ARMY_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { ARMY_COST_MASTER, ARMY_SPEED_MASTER, SKILL_LABELS } from '../army-tables.ts';
import { beastCommandCount, beastCommandRoom } from '../world/tables.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { heroHireWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { wildHuntPrice } from '../items/tiers-and-hoards.ts';
import { consecratedIds } from '../heroes/fame-and-consecration.ts';
import { itemSlot, itemUsableBy } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { featDiscovered } from '../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { ITEM_SLOT_CAP, activeItems, itemPowerScore } from '../items/equipment.ts';
import { effSkillOf } from '../heroes/skills-and-hp.ts';
import { RUMOUR_COST_BY_POWER, isMithril } from '../personal-combat/helpers.ts';
import {
  BOT_AERIAL_TYPES,
  BOT_CARRIER_TYPES,
  BOT_DEF_BONUS,
  BOT_HEX_DIRS,
  BOT_SEA_ALL,
  BOT_MONSTER_ARMIES,
  botBattleForce,
  botBelief,
  botBelievedOwner,
  botKnows,
  botKnowsGraves,
  botMarginFor,
  botNeighbourProv,
  botRaceTerrainMult,
  botRelationRaw,
  botSees,
  botSeesChar,
  botTargetDefence,
  botTurnCache,
  botVisibleCharsIn,
} from './intel.ts';
import { botCanFly, botSeaCap } from './war.ts';
import {
  BOT_LAIR_GO_BAND_HI,
  BOT_LAIR_REASK_GAIN,
  BOT_SPECIALIST_ROLES,
  botAssumedChar,
  botAtWar,
  botDuelSkill,
  botEnemyChars,
  botEnemyIntel,
  botFleetOnly,
  botGarrisonTarget,
  botHasMetPlayers,
  botHeroCap,
  botHireBias,
  botHomeId,
  botIsEdge,
  botIsLeader,
  botIsTeach,
  botLairRating,
  botLiftable,
  botMoveOrder,
  botNearbyThreat,
  botPathDirs,
  botPathLen,
  botRumourFor,
  botBeastFundPay,
  botCanAfford,
  botSpend,
} from './strategy.ts';
import { BOT_SCHOOLS } from './schools.ts';
import { botDuelRating, botFillOrders, botPathAny, botPathLenAny, botSpyTarget } from './spellcraft.ts';
import { isCharmedNow } from '../heroes/charms-and-neutrals.ts';
import { DISC_BY_ID } from '../discoveries.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';

// ══ INFILTRATOR — conjure a host behind the enemy line ════
// A caster with Necromancy or Elemental magic takes provinces by himself, with no army at all. He
// walks UNARMED into undefended enemy ground (no guard engages an unarmed character, so he can
// cross the front line freely), then spends his remaining phases casting:
// Necromancy → Skeletal Armies — raises 1–3 dead units per success (by Necromancy level) from the province's battleGraves
// Elemental → Elemental Summon — tears an elemental out of the air (no prerequisite; always available)
// Either way the caster GAINS a unit while standing on ground he does not own, and the engine's
// resolveUnitGainInProvince hands him the province that same phase when nothing is there to contest
// it.
//
// The two schools then diverge, and both are wanted:
// • An elemental DISSOLVES at turn's end — the land stays taken, the caster is unarmed again next turn
// and simply walks on to the next undefended province. A one-man province-taking machine.
// • Skeletons STAY (1g/turn upkeep). A necromancer therefore snowballs: once he holds 3+ units
// botRoles promotes him to a field LEADER and the ordinary expansion/recruit AI takes him over —
// which is Toby's "or start recruiting armies and capturing more provinces".
// Between those two states (1–2 skeletons) he keeps infiltrating, but only into ADJACENT undefended
// ground: an armed column that marches into a defended province fights, and this force must not.
//
// TARGETING — "undefended" means nothing present can contest the province: no foreign armed
// character, no garrison, no neutral defenders. Scoring prefers ground DEEP inside enemy land
// (counted as enemy-owned neighbours: that is the "behind the front line" test), rich ground, and —
// for a necromancer — graves, less 3 per hop of walking. Unowned undefended land is a legal
// secondary target and needs no war.
export const BOT_INFILTRATE_RANGE = 5; // an unarmed character's full walking reach
export function botInfiltrateSchool(c) {
  const s = c.skills || {};
  const nec = s.necromancy || 0,
    ele = s.elemental || 0;
  if (nec < 1 && ele < 1) return null;
  return nec >= ele ? 'necromancy' : 'elemental';
}
// All of this character's units are conjured skeletons (i.e. everything he has, he raised himself).
export function botOnlySkeletal(c) {
  const a = c.armies || [];
  return a.length > 0 && a.every((x) => x && x._isSkeletal);
}
// Nothing in this province can fight for it. 2026-09-17: "undefended" is now a BELIEF, not a fact.
// Where the realm has eyes it still reads the ground truthfully; where it does not, an
// empty-looking province is only believed empty if the realm has seen it before AND its wealth band
// suggests little there — and the caster can still walk into a garrison nobody told him about,
// exactly as a player's infiltrator can.
export function botProvUndefended(G, prov, pi) {
  if (!prov || prov.terrain === 'sea') return false;
  if (!botKnows(G, pi, prov.id)) return false; // never seen — not a plan, a guess in the dark
  if (!botSees(G, pi, prov.id)) {
    const b = botBelief(G, pi, prov);
    return !!b && (b.tax || 0) < 3 && b.owner == null; // only poor, unowned ground is ASSUMED empty
  }
  if ((prov.garrisonArmies || []).length > 0) return false;
  if ((prov.neutralDefenders || []).length > 0 || (prov.npcArmies || 0) > 0) return false;
  return !botVisibleCharsIn(G, pi, prov).some(
    (e) => e.player !== pi && (e.armies || []).length > 0 && !e._justDefeated,
  );
}
// Best province to conjure a host in, within `range` hops. {P,d,sc} or null.
export function botInfiltrateTarget(G, pi, c, school, range) {
  const from = G.world.provinces[c.location];
  if (!from) return null;
  // the scan is confined to ground this realm has SEEN, judged on what it believes rather than on
  // the live arrays. Graves are read from the realm's own Graveyard lore
  // (_graveIntel — filled only by a necromancer standing on the ground or a Control Undead scan), not
  // from prov.battleGraves, so a bot can no longer smell every corpse in the world.
  const gravesKnown = (X) => botKnowsGraves(G, pi, X.id);
  const graveCount = (X) => (botSees(G, pi, X.id) ? (X.battleGraves || []).length : gravesKnown(X) ? 2 : 0);
  let best = null;
  (G.world.provinces || []).forEach((X) => {
    if (!X || X.terrain === 'sea') return;
    if (!botKnows(G, pi, X.id)) return; // unmapped country — not a target
    const b = botBelief(G, pi, X);
    if (!b) return;
    if (b.owner === pi) return;
    const enemyLand = b.owner != null && botRelationRaw(G, pi, b.owner) === 'enemy';
    if (b.owner != null && !enemyLand) return; // never an ally's or a at-peace crown's land
    if (school === 'necromancy' && !gravesKnown(X)) return; // no dead here that this realm knows of
    if (!botProvUndefended(G, X, pi)) return;
    const d = X.id === from.id ? 0 : botPathLenAny(G, from, X.id, range);
    if (d == null) return;
    let depth = 0;
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, X, i);
      const no = botBelievedOwner(G, pi, N);
      if (N && no != null && no !== pi && botRelationRaw(G, pi, no) === 'enemy') depth++;
    }
    const sc = (b.tax || 0) * 2 + depth * 4 + (enemyLand ? 10 : 0) + Math.min(3, graveCount(X)) * 2 - d * 3;
    if (!best || sc > best.sc) best = { P: X, d, sc };
  });
  return best;
}
// Build the full 5-phase infiltration order list, or null if it will not fit. `pre` is consumed.
export function botInfiltrateOrders(G, pi, c, pre, school, range) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const tgt = botInfiltrateTarget(G, pi, c, school, range);
  if (!tgt) return null;
  const spell = school === 'necromancy' ? 'Skeletal Armies' : 'Elemental Summon';
  const path = tgt.d > 0 ? botPathAny(G, P, tgt.P.id, range) || [] : [];
  if (tgt.d > 0 && path.length !== tgt.d) return null; // could not reconstruct the walk
  if (pre.length + path.length >= 5) return null; // no phase left to cast in
  const mv = path.map((d) => botMoveOrder(d, 'Infiltrate ' + tgt.P.name));
  const casts = [];
  while (pre.length + mv.length + casts.length < 5)
    casts.push({ action: 'cast_spell', target: spell, extra: '', desc: 'Cast ' + spell });
  if (!casts.length) return null;
  return botFillOrders(G, pi, c, [...pre, ...mv, ...casts], []);
}

// ══ SIGNATURE ACTIONS (Sept 2026, bot strategy review R2) ════
// Until now no bot ever used its alignment's signature order. Each helper returns a pre-order (or null)
// for the character standing in `P`, spending through the turn ledger where gold is involved. One
// signature pre-order per character per turn; the engine's own once-per-turn rules still apply.
export function botConsecrateOK(G, pi, c, X) {
  const pl = (G.players || [])[pi];
  if (!pl || pl.alignment !== 'Divine' || !X || X.owner !== pi || X.terrain === 'sea') return false;
  if (alignProto(G, 'Divine')) {
    // PROTOTYPE Divine: any hero with White 1+, on a province of the realm's bordering the home or holy ground, and the
    // rite's price in the chest (round 5)
    if (effSkillOf(c, 'white', G.characters || []) < 1 || (pl.gold || 0) < CONSECRATE_COST) return false; // round 21: White 2 (the signature +1 counts)
    const home = botHomeId(G, pi);
    const list = consecratedIds(pl) || [];
    if (X.id === home || list.includes(X.id)) return false;
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, X, i);
      if (N && (N.id === home || list.includes(N.id))) return true;
    }
    return false;
  }
  if (!c.isKing) return false;
  const home = botHomeId(G, pi);
  if (X.id === home) return false;
  const H = home != null ? G.world.provinces[home] : null;
  if (H) {
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, H, i);
      if (N && N.id === X.id) return false;
    }
  }
  const list = consecratedIds(pl) || [];
  if (list.includes(X.id)) return false;
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, X, i);
    if (N && list.includes(N.id)) return false;
  }
  return list.length < ((c.skills || {}).white || 0);
}
// The richest consecratable owned province within `maxD` hops of the king (through own land). {X,d} or null.
export function botConsecrateTarget(G, pi, c, maxD) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  let best = null;
  (G.world.provinces || []).forEach((X) => {
    if (!botConsecrateOK(G, pi, c, X)) return;
    const d = X.id === P.id ? 0 : botPathLen(G, pi, P, X.id, false);
    if (d == null || d > maxD) return;
    const holy =
      kitTactics(G, pi) === 'Divine' && (X.features || []).some((f) => f && f.ritualSite && f.siteKind === 'holy');
    const sc = (X.tax || 0) * 2 - d * 3 + (holy ? 20 : 0); // PROTOTYPE tactics: a holy site first
    if (!best || sc > best.sc) best = { X, d, sc };
  });
  return best;
}
export function botSignaturePre(G, pi, c, P, L) {
  const pl = (G.players || [])[pi];
  if (!pl || !P) return null;
  const sk = c.skills || {};
  L.sig = L.sig || {}; // per-realm once-per-turn flags
  // PROTOTYPE (alignment ideas round 1): the kits' own orders, when the realm's kit is on.
  if (alignProto(G, pl.alignment)) {
    const kit = botKitPre(G, pi, c, P, L);
    if (kit) return kit;
    if (pl.alignment === 'Good' || pl.alignment === 'Druidic' || pl.alignment === 'Evil') return null; // their old orders are gone
  }
  switch (pl.alignment) {
    case 'Divine': // CONSECRATE the ground the king stands on
      if (botConsecrateOK(G, pi, c, P))
        return { action: 'consecrate', target: '', extra: '', desc: 'Consecrate ' + P.name };
      return null;
    case 'Good': {
      // CALL TO ARMS: a free Green garrison, king only, once a turn
      if (!c.isKing || L.sig.cta) return null;
      let best = null;
      (G.world.provinces || []).forEach((X) => {
        if (!X || X.owner !== pi || X.terrain === 'sea') return;
        if ((X.race || '').startsWith('Primal')) return; // the engine falls back to GARRISON_BY_RACE_CTA
        if ((X.tax || 0) < 4 && X.id !== botHomeId(G, pi)) return; // Toby's garrison rule: Prosperous+ land (and the capital) only
        const g = (X.garrisonArmies || []).length;
        if (g >= 2) return;
        const sc = (X.tax || 0) + (botIsEdge(G, pi, X) ? 4 : 0) + (X.id === botHomeId(G, pi) ? 2 : 0) - g * 3;
        if (!best || sc > best.sc) best = { X, sc };
      });
      if (!best) return null;
      L.sig.cta = 1;
      return { action: 'call_to_arms', target: String(best.X.id), extra: '', desc: 'Call to Arms in ' + best.X.name };
    }
    // Druidic and Evil: no signature order since 2026-10-12 (Toby item 22: Awaken the Wild and Call from the Pit removed).
    case 'Undead': {
      // HARVEST THE FIELD: raise a grave for 2g (a necromancer keeps it); round 20: under the kit, at a held barrow only
      if ((sk.necromancy || 0) < 1 || !botSees(G, pi, P.id) || !(P.battleGraves || []).length) return null;
      if (L.budget < 2) return null;
      L.budget -= 2;
      L.upkeep += 1;
      return { action: 'harvest_field', target: '', extra: '', desc: 'Harvest the Field in ' + P.name };
    }
    case 'Neutral': {
      // BROKER: hire a seen wanderer from afar, else buy a Spy report (2g)
      if (!c.isKing || L.sig.broker) return null;
      L.hired = L.hired || new Set();
      const heroes = (G.characters || []).filter(
        (x) => x && x.alive && x.player === pi && !x.isKing && !x._isHeir,
      ).length;
      if (heroes < botHeroCap(G, pi)) {
        let best = null;
        (G.characters || []).forEach((h) => {
          if (!(h && h.alive && h.player === null && !h._isNeutralGuard && !h._justDefeated && !L.hired.has(h.id)))
            return;
          if (h.location === c.location) return; // a plain Hire does that
          const X = G.world.provinces[h.location];
          if (!X || !(X.owner === pi || (X.visitedBy || []).includes(pi))) return; // the engine's own Broker visibility
          const w = heroHireWage(pl.alignment, h.alignment, false, h);
          if (w == null || L.budget < w) return;
          const v = Object.values(h.skills || {}).reduce((a, b) => a + (b || 0), 0) - w + botHireBias(G, pi, h) * 3;
          if (!best || v > best.v) best = { h, w, v };
        });
        if (best) {
          botSpend(L, best.w);
          L.hired.add(best.h.id);
          L.sig.broker = 1;
          return { action: 'broker', target: 'hire:' + best.h.id, extra: '', desc: 'Broker — hire ' + best.h.name };
        }
      }
      if (L.budget >= 2) {
        const t = botSpyTarget(G, pi, c, 99);
        if (t && botKnows(G, pi, t.X.id)) {
          L.budget -= 2;
          L.sig.broker = 1;
          pl._botSpyMemo = pl._botSpyMemo || {};
          pl._botSpyMemo[t.X.id] = G.turn;
          return { action: 'broker', target: 'spy:' + t.X.id, extra: '', desc: 'Broker — buy word from ' + t.X.name };
        }
      }
      return null;
    }
  }
  return null;
}
// PERFORM RITE (Pagan): only for an armed host standing at a ritual site with a fight ahead. The Wild
// Hunt binds two wage-free Veterans of the province's wild kind for the price of one; a host of 6+ that
// cannot hunt makes a Blood Offering — its two weakest for two tiers on its two strongest.
export function botRitePre(G, pi, c, P, L, fightAhead) {
  const pl = (G.players || [])[pi];
  if (!pl || pl.alignment !== 'Pagan' || !P || !fightAhead) return null;
  if (P._riteTurn === G.turn) return null;
  const site = (P.features || []).find(
    (f) => f && f.ritualSite && !f.siteKind && (featDiscovered(f, pi) || P.owner === pi),
  );
  if (!site) return null;
  const army = (c.armies || []).filter((a) => a && !a._temporary && a._wildHuntUntilTurn == null && !a._isSkeletal);
  const wild = (P.armyTypes || []).find((t) => PRIMAL_ARMY_DEFS_P[t]);
  if (wild) {
    const cost = wildHuntPrice(wild);
    if (L.budget >= cost) {
      L.budget -= cost;
      return { action: 'rite', target: 'wild hunt', extra: '', desc: 'Perform Rite — the Wild Hunt' };
    }
  }
  if (army.length >= 6) {
    const idx = (c.armies || [])
      .map((a, i) => ({ a, i }))
      .filter((x) => x.a && army.includes(x.a))
      .map((x) => ({ i: x.i, v: unitBaseStrength(x.a) }))
      .sort((x, y) => x.v - y.v);
    const S = idx.slice(0, 2).map((x) => x.i),
      E = idx.slice(-2).map((x) => x.i);
    if (S.some((i) => E.includes(i))) return null;
    return {
      action: 'rite',
      target: 'blood offering',
      extra: `S:${S.join(',')}|E:${E.join(',')}`,
      desc: 'Perform Rite — a Blood Offering',
    };
  }
  return null;
}
// RESEARCH CHOICE (R1): a bot keeps the discovery whose category / wording fits its situation — war-craft
// while at war, statecraft and wealth while expanding, espionage once other crowns are met. Public fields only.
export function botResearchPick(G, pi, options) {
  const war = botAtWar(G, pi),
    met = botHasMetPlayers(G, pi);
  const CAT = {
    Military: war ? 4 : 2,
    Economy: war ? 2 : 4,
    Espionage: met ? 3 : 1,
    Scholarship: 2,
    Heroic: 3,
    Special: 3,
  }; // review II A9: the data file's six categories, explicitly
  const score = (id) => {
    const d = DISC_BY_ID[id];
    if (!d) return -99;
    const txt = ((d.category || '') + ' ' + (d.name || '') + ' ' + (d.desc || '')).toLowerCase();
    let v = (CAT[d.category] || 0) * 2;
    if (/war|battle|arm|siege|strength|fight|host|troop|unit|command/.test(txt)) v += war ? 4 : 2;
    if (/tax|gold|trade|wealth|state|treasur|income|harvest/.test(txt)) v += war ? 1 : 3;
    if (/spy|cipher|scout|explor|map|thief|steal/.test(txt)) v += met ? 2 : 0;
    if (/sage|research|lore|scholar/.test(txt)) v += 1;
    return v;
  };
  return [...options].sort((a, b) => score(b) - score(a))[0];
}
// ══ ITEMS (Sept 2026, review R3) ════
// Bots picked up hoards and never touched them. Three habits a human has: don the best kit (the engine's
// normaliseEquipment dons whatever came first), send combat kit from the court's scholars and scouts to
// the general who fights, and crack the Philosopher's Stone once the realm has an army worth promoting.
// One item pre-order per character per turn. Reads only the bot's own items.
export const BOT_FIGHT_STATS = new Set([
  'melee',
  'archery',
  'tactical',
  'armour',
  'mithrilArmour',
  'maxHp',
  'combatUse',
  'druid',
]);
export function botItemPre(G, pi, c, roles) {
  const items = (c.items || []).filter(Boolean);
  if (!items.length) return null;
  // 1. Philosopher's Stone — every unit of the realm one tier up, once per game
  const stone = items.find((it) => it.effect && it.effect.stat === 'massPromote' && !it._spent);
  if (stone) {
    let units = 0;
    (G.characters || []).forEach((x) => {
      if (x && x.alive && x.player === pi) units += (x.armies || []).length;
    });
    (G.world.provinces || []).forEach((p) => {
      if (p && p.owner === pi) units += (p.garrisonArmies || []).length;
    });
    if (units >= 8)
      return {
        action: 'use_item',
        target: String(stone.id != null ? stone.id : stone.name),
        extra: '',
        desc: 'Use ' + stone.name,
      };
  }
  // 2. Wear the best of what we carry, slot by slot
  const slotted = items.filter((it) => itemSlot(it) && itemUsableBy(it, c));
  if (slotted.length) {
    const bySlot = {};
    slotted.forEach((it) => {
      (bySlot[itemSlot(it)] = bySlot[itemSlot(it)] || []).push(it);
    });
    const want = [];
    Object.keys(bySlot).forEach((sl) => {
      bySlot[sl]
        .sort((a, b) => itemPowerScore(b) - itemPowerScore(a))
        .slice(0, ITEM_SLOT_CAP[sl] || 1)
        .forEach((it) => want.push(it));
    });
    const wornNow = slotted.filter((it) => it.equipped === true);
    const differs = want.length !== wornNow.length || want.some((it) => !wornNow.includes(it));
    if (differs)
      return {
        action: 'equip_items',
        target: want.map((it) => String(it.id != null ? it.id : it.name)).join(','),
        extra: '',
        desc: 'Don the best kit',
      };
  }
  // 3. ITEMS GO TO THE ROLE THEY FIT (2026-09-26, Toby). Every character sends any item its own role does not
  // use to the realm character whose role does — duelling kit to the slayer, command kit to the general, a
  // Naval charm to the admiral, a Sage tome to the scholar, Spy / Thief / Explorer kit to those crafts — when
  // the recipient has slot room (or the item beats his worst in that slot). At most two a year, by courier.
  const myRole = botItemRoleOf(G, pi, c, roles);
  const myStats = BOT_ROLE_ITEM_STATS[myRole] || BOT_ROLE_ITEM_STATS.none;
  const mates = (G.characters || [])
    .filter((x) => x && x.alive && x.player === pi && x.id !== c.id && !x._isHeir && !isCharmedNow(G, x))
    .map((x) => ({ x, role: botItemRoleOf(G, pi, x, roles) }));
  const gives = {}; // recipient id → indices
  items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => itemPowerScore(b.it) - itemPowerScore(a.it))
    .forEach(({ it, i }) => {
      const e = it.effect || {};
      if (!e.stat || it._spent || isMithril(it)) return;
      // 2026-09-28 (option 4): duelling kit (Melee, Archery, armour, HP, combat charms, spell schools) goes to a
      // SLAYER ahead of the general — the lair fights it wins are income; a general who holds it sends it on.
      const _toSlayer =
        myRole !== 'slayer' &&
        _BOT_DUEL_KIT.includes(e.stat) &&
        mates.some(({ x, role }) => role === 'slayer' && itemUsableBy(it, x));
      if (myStats.has(e.stat) && itemUsableBy(it, c) && !_toSlayer) return; // my own role uses it — keep it
      const sl = itemSlot(it);
      let best = null;
      mates.forEach(({ x, role }) => {
        const st = BOT_ROLE_ITEM_STATS[role] || BOT_ROLE_ITEM_STATS.none;
        if (!st.has(e.stat) || !itemUsableBy(it, x)) return;
        let room = 1;
        if (sl) {
          const theirs = (x.items || [])
            .filter((y) => y && itemSlot(y) === sl && itemUsableBy(y, x))
            .sort((p, q) => itemPowerScore(p) - itemPowerScore(q));
          const cap = ITEM_SLOT_CAP[sl] || 1;
          room =
            Math.max(0, cap - theirs.length) + (theirs[0] && itemPowerScore(theirs[0]) < itemPowerScore(it) ? 1 : 0);
        }
        if (room <= 0) return;
        const sc =
          (BOT_ROLE_ITEM_PRIMARY[role] && BOT_ROLE_ITEM_PRIMARY[role].has(e.stat) ? 10 : 0) +
          (role === 'slayer' && _BOT_DUEL_KIT.includes(e.stat) ? 5 : 0) +
          room;
        if (!best || sc > best.sc) best = { x, sc };
      });
      if (best) {
        (gives[best.x.id] = gives[best.x.id] || []).push(i);
      }
    });
  const rid = Object.keys(gives).sort((a, b) => gives[b].length - gives[a].length)[0];
  if (!rid) return null;
  const idx = gives[rid].sort((a, b) => a - b).slice(0, 2);
  const rc = (G.characters || []).find((x) => x && x.id === +rid);
  return {
    action: 'give_item',
    target: idx.join(','),
    extra: String(rid),
    desc: 'Send kit to ' + (rc ? rc.name : 'a comrade'),
  };
}
// Which role a character's KIT should serve. Leaders are generals (the admiral and flying general keep their
// own names), armed kings and defenders fight, specialists are their craft.
export function botItemRoleOf(G, pi, c, roles) {
  if (c._botRole === 'admiral' || c._botRole === 'skygeneral') return c._botRole;
  if (roles && roles.leaders.includes(c.id)) return 'general';
  if (c.isKing) return (c.armies || []).length ? 'general' : 'slayer';
  if (c._botRole === 'defender') return 'defender';
  if (BOT_SPECIALIST_ROLES.has(c._botRole)) return c._botRole;
  return (c.armies || []).length ? 'general' : 'none';
}
export const _BOT_DUEL_KIT = [
  'melee',
  'archery',
  'maxHp',
  'armour',
  'mithrilArmour',
  'combatUse',
  'pc',
  'temper',
  'elemental',
  'white',
  'illusory',
  'necromancy',
  'psychic',
];
export const BOT_ROLE_ITEM_STATS = {
  general: new Set([
    ..._BOT_DUEL_KIT,
    'tactical',
    'march',
    'armyBonus',
    'aura',
    'undeadBonus',
    'siege',
    'homeDefence',
    'druid',
  ]),
  slayer: new Set(_BOT_DUEL_KIT),
  admiral: new Set([..._BOT_DUEL_KIT, 'naval', 'fleet', 'tactical']),
  skygeneral: new Set([..._BOT_DUEL_KIT, 'druid', 'tactical', 'march']),
  defender: new Set([..._BOT_DUEL_KIT, 'tactical', 'homeDefence', 'armyBonus']),
  mage: new Set([
    'white',
    'psychic',
    'illusory',
    'elemental',
    'necromancy',
    'castSpell',
    'maxHp',
    'armour',
    'combatUse',
  ]),
  scholar: new Set(['sage', 'castSpell', 'practice']),
  scout: new Set(['explorer', 'oracle']),
  spy: new Set(['spy', 'hidden', 'oracle']),
  thief: new Set(['thief', 'hidden']),
  none: new Set([]),
};
// the stats a role is the FIRST home for (breaks ties between several willing recipients)
export const BOT_ROLE_ITEM_PRIMARY = {
  general: new Set(['tactical', 'march', 'armyBonus', 'aura', 'undeadBonus', 'siege']),
  slayer: new Set(_BOT_DUEL_KIT),
  admiral: new Set(['naval', 'fleet']),
  skygeneral: new Set(['druid']),
  mage: new Set(['white', 'psychic', 'illusory', 'elemental', 'necromancy', 'castSpell']),
  scholar: new Set(['sage']),
  scout: new Set(['explorer']),
  spy: new Set(['spy', 'hidden']),
  thief: new Set(['thief']),
};
// ALLIED FRONT (review R7): a target within two hexes of an allied realm's field host is worth more — two
// crowns pressing one border beat two crowns pressing two. Only hosts the bot can see.
export function botAllyNear(G, pi, X) {
  if (!X) return false;
  return (G.characters || []).some((e) => {
    if (!(
      e &&
      e.alive &&
      e.player != null &&
      e.player !== pi &&
      (e.armies || []).length >= 3 &&
      botRelationRaw(G, pi, e.player) === 'allied' &&
      botSeesChar(G, pi, e)
    ))
      return false;
    if (e.location === X.id) return true;
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, X, i);
      if (N && N.id === e.location) return true;
    }
    return false;
  });
}
// ══ ENEMY INTEL (Sept 2026, Toby: track enemy generals and heroes) ════
// What the realm SAW this turn of rival characters, remembered on the player record for six turns:
// p._botIntel.generals[charId] = {turn, provId, units, strength, name, player, isKing} for anyone leading
// troops, p._botIntel.heroes for the unarmed. Only characters botSeesChar can see are recorded, so the
// memory is exactly what a human's past reports hold. A remembered host that is no longer visible still
// counts against a target for three turns (it may still be there), and remembered heroes are hunted.
// botUpdateIntel, which records what the realm saw, and botEnemyIntel, which reads it back, are in bots/strategy.ts.
// Remembered at-war hosts last seen in province `provId` within three turns and not visible now: {units,strength}.
export function botRememberedHostAt(G, pi, provId) {
  const I = botEnemyIntel(G, pi);
  let units = 0,
    strength = 0;
  const turn = G.turn || 0;
  Object.keys(I.generals).forEach((k) => {
    const r = I.generals[k];
    if (r.provId !== provId || turn - r.turn > 3 || botRelationRaw(G, pi, r.player) !== 'enemy') return;
    const e = (G.characters || []).find((x) => x && x.id === +k);
    if (!e || !e.alive) return;
    if (botSeesChar(G, pi, e)) return; // visible hosts are counted by the scorer itself
    units += r.units;
    strength += r.strength;
  });
  return { units, strength };
}
// The margin demanded against an enemy HOST (Toby): 1.5× a five-unit column, rising 0.05 per unit to 2×.
export function botHostMargin(base, hostUnits) {
  if (!(hostUnits > 0)) return base;
  return Math.max(base, Math.min(2.0, 1.5 + 0.05 * Math.max(0, hostUnits - 5)));
}
// ══ LAIRS BY RUMOUR (Sept 2026, Toby: Hunting Rumours first, clear at 80%+, weakest first) ════
// A rumour is bought (1–4g by grade) by the hero who would fight, and the engine records the odds band it
// told him (f._rumourOdds[pi] — the same five bands the player reads). Only a band of "almost certain"
// (80%+) sends him in. A rumour by another hero, or older than three turns, or bought before the hero
// gained a level, is stale. Lairs are taken weakest grade first.
export const BOT_LAIR_GRADE = { '': 0, Weak: 0, Moderate: 1, Powerful: 2, Legendary: 3 };
// botRumourFor (a hero's rumour of a lair, while it holds) and botLairRating are in bots/strategy.ts.
// Candidate lairs for this hero: {X,li,f,grade,d,rumour}. `maxD` hops through own/allied/unowned ground.
export function botLairCandidates(G, pi, c, maxD) {
  const from = G.world.provinces[c.location];
  if (!from) return [];
  const out = [];
  (G.world.provinces || []).forEach((X) => {
    if (!X || X.terrain === 'sea' || !botKnows(G, pi, X.id)) return;
    const bo = botBelievedOwner(G, pi, X);
    if (bo != null && bo !== pi && botRelationRaw(G, pi, bo) !== 'allied') return;
    (X.features || []).forEach((f, li) => {
      if (!f || f.cleared || f.ritualSite || !featDiscovered(f, pi)) return;
      const d = X.id === from.id ? 0 : botPathLen(G, pi, from, X.id, true);
      if (d == null || d > maxD) return;
      const grade = (f.monster && f.monster.power) || f.tier || '';
      out.push({
        X,
        li,
        f,
        grade: BOT_LAIR_GRADE[grade] || 0,
        price: RUMOUR_COST_BY_POWER[grade] || 1,
        d,
        rumour: f.monster ? botRumourFor(G, pi, c, f) : { band: 101 },
      });
    });
  });
  return out.sort((a, b) => a.grade - b.grade || a.d - b.d);
}
// The slayer's (or any fighter's) year: search a lair his rumour rates 80%+; else buy the rumour on the
// weakest lair he has not assessed; else null (train). Fighters only: Melee or Archery 3+.
// Sept 2026 (Toby): the guardian-killer's LADDER. The guardian ladder is tuned to a benchmark hero per grade
// (Weak: 15 HP, Melee 3 / Archery 2 or Melee 4 / Archery 1 + a school at 1; Moderate: 30 HP, 5 tier-1 items,
// Melee 6 + a school at 3 …), so the slayer trains toward Melee 3 / Archery 2 first, then Melee 4+, a battle
// school, and on. He clears a lair only on his own fresh top-band rumour (80%+), takes the lowest grade on the
// map first, and does not buy a rumour on a grade above one his current rating has already been told is too
// hard — he trains until the rating changes (a level, an item) and asks again.
// 2026-09-26 (Toby): the slayer's ladder now carries a BATTLE SCHOOL from the start — Melee 3, Archery 2, a
// school at 1, Melee 4, school 2, Melee 5, school 3, Melee 6, then Archery. The school is Elemental unless
// another duelling school (Necromancy, Psychic, White) is already the hero's strongest: the auto encounter
// plan casts that school's spell in every lair fight (autoEncounterPlan → CA:), so every level is used.
export function botSlayerSchool(c) {
  const s = (c && c.skills) || {};
  return ['elemental', 'necromancy', 'psychic', 'white'].sort(
    (a, b) => (s[b] || 0) - (s[a] || 0) || (a === 'elemental' ? -1 : b === 'elemental' ? 1 : 0),
  )[0];
}
export function botSlayerTrainSkill(c) {
  const s = c.skills || {};
  const sch = botSlayerSchool(c);
  // 2026-09-28 (Toby): never a skill already at 5 — Practice cannot take it further (levels 6–9 come only from
  // experience). The ladder: Melee 3, Archery 2, school 1, Melee 4, school 2, Melee 5, school 3→5, Archery 5,
  // then his other combat schools; null when all are at 5.
  const L = [
    ['melee', 3],
    ['archery', 2],
    [sch, 1],
    ['melee', 4],
    [sch, 2],
    ['melee', 5],
    [sch, 3],
    [sch, 5],
    ['archery', 5],
    ['elemental', 5],
    ['necromancy', 5],
    ['psychic', 5],
    ['white', 5],
  ];
  for (const [k, to] of L) {
    if ((s[k] || 0) < Math.min(5, to)) return k;
  }
  return null;
}
// 2026-09-28 (Toby: slayers clear too few lairs): a rumour costs 1–4g and is paid from the TREASURY when the
// Hunt Rumours phase resolves. The planner used to demand it from the muster budget, which the leaders (who plan
// first) had usually spent to nothing — a slayer with lairs in reach then trained instead of asking, one slayer
// year in five. Now the rumour goes ahead whenever the treasury itself can pay it with a little to spare.
// BOT_RUMOUR_FUND_PER_SLAYER (each slayer's share of the rumour fund) is in bots/strategy.ts.
export function botRumourAffordable(G, pi, L, price) {
  return (
    (L.rumourFund || 0) >= price || L.budget >= price + 1 || (((G.players || [])[pi] || {}).gold || 0) >= price + 3
  );
}
export function botSpendRumour(L, price) {
  const f = Math.min(L.rumourFund || 0, price);
  L.rumourFund = (L.rumourFund || 0) - f;
  L.budget -= price - f;
}
// ══ THE SLAYER'S LADDER (2026-09-28, Toby) ════
// • He searches a lair on a rumour of 80%+ (bands "the odds favour you… confident / certain": band.max ≥ 90).
// • Two lairs cleared of a grade and that grade is his: he searches its lairs with no rumour at all (and any
//   grade below), until six are cleared.
// • At six he hunts a rumour of the grade above. 80%+ → he goes; below → he clears two more of his own grade
//   before asking again (c._botLadder.retryAt). One clear of the grade above keeps him asking about it until
//   the second makes it his.
// • He rests before a hunt when hurt (to 75% of max HP — Rest heals 30% a phase), and searches every lair he
//   can reach in the year, up to three; every search after the first carries `_botMinHp` (0.6): the engine
//   turns it into a Rest if the earlier fight left him under 60%.
export const BOT_LAIR_WEAK_BAND = 80,
  BOT_LAIR_WEAK_HP = 0.95,
  BOT_LAIR_REACH = 6,
  BOT_LAIR_MAX_RUMOURS = 3; // 2026-09-28 (options 3, 5)
// 2026-09-29 (Toby): PROMOTE_AT 6 → 4 → 2 (study C4; RETRY_EXTRA 2 → 0: no hold after a poor reading) — the rumour (80%+) still decides whether he goes in, so asking sooner
// costs a few gold, not a life.
// The tuning knobs BOT_LAIR_GO_BAND_HI and BOT_LAIR_REASK_GAIN are in bots/strategy.ts.
export function botGoBand(g) {
  return g > 0 ? BOT_LAIR_GO_BAND_HI : BOT_LAIR_GO_BAND;
}
export const BOT_LAIR_GO_BAND = 90,
  BOT_LAIR_OWN_AFTER = 2,
  BOT_LAIR_PROMOTE_AT = 2,
  BOT_LAIR_RETRY_EXTRA = 0,
  BOT_LAIR_MIN_HP = 0.75,
  BOT_LAIR_NEXT_HP = 0.6,
  BOT_LAIR_MAX_SEARCHES = 3;
export const BOT_LAIR_GN = ['Weak', 'Moderate', 'Powerful', 'Legendary'];
// 2026-09-29 (Toby): PROMOTION ON STRENGTH as well as kills. A hero who owns his grade and is already
// kitted or trained for the grade above asks about it without waiting for the kill count: equipped items
// at least BOT_LAIR_STRONG_ITEMS[g], OR his best fighting skill (Melee, Archery or a duelling school,
// items included) at least BOT_LAIR_STRONG_SKILL[g]. Indexed by the grade he would move UP to. Moderate
// 4 items / skill 5, Powerful 6 / 7, Legendary 8 / 9 — the guardian-ladder benchmark heroes carry 5
// tier-1 items for Moderate.
export const BOT_LAIR_STRONG_ITEMS = [0, 3, 5, 7],
  BOT_LAIR_STRONG_SKILL = [0, 4, 6, 8]; // 2026-09-29 (Toby, study C4): was [0,4,6,8] / [0,5,7,9]
export function botLairStrongFor(c, g) {
  if (!c || g < 1 || g > 3) return false;
  const n = activeItems(c).length;
  const best = Math.max(
    ...['melee', 'archery', 'elemental', 'necromancy', 'psychic', 'white'].map((k) => effSkillOf(c, k, []) || 0),
  );
  return n >= BOT_LAIR_STRONG_ITEMS[g] || best >= BOT_LAIR_STRONG_SKILL[g];
}
// PROTOTYPE (ideas round 4): with `G.botLairHunting` on, a hero climbs the grades by the calendar as a human player
// does (Weak from turn 3, Moderate from 8, Powerful from 13, Legendary from 18), as far as his strength or a kill at
// the grade below allows; the rumour still decides whether he goes into the grade above.
export const HUMAN_LAIR_PACE_TURNS = [3, 8, 13, 18];
export function botLairTiers(c, G) {
  const K = c._botLairKills || {};
  const k = (g) => K[BOT_LAIR_GN[g]] || 0;
  const lad = c._botLadder || {};
  let cur = -1;
  for (let g = 0; g < 4; g++) if (k(g) >= BOT_LAIR_OWN_AFTER) cur = g;
  let up = null;
  if (cur < 0) up = 0;
  else if (
    cur < 3 &&
    (k(cur) >= BOT_LAIR_PROMOTE_AT || k(cur + 1) >= 1 || botLairStrongFor(c, cur + 1)) &&
    k(cur) >= (lad.retryAt || 0)
  )
    up = cur + 1;
  if (G && G.botLairHunting === true) {
    const turn = G.turn || 0;
    let byTurn = -1;
    HUMAN_LAIR_PACE_TURNS.forEach((t, g) => {
      if (turn >= t) byTurn = g;
    });
    // his own grade (no rumour needed): Weak once he is a trained fighter (today's gate), each grade above once he is
    // kitted for it AND has two kills at the grade below; anyone else hunts on a good rumour only
    const sk0 = c.skills || {};
    const _cs0 = Math.max(sk0.elemental || 0, sk0.necromancy || 0, sk0.psychic || 0);
    const trained =
      (sk0.melee || 0) >= 3 ||
      (sk0.archery || 0) >= 3 ||
      (sk0.melee || 0) + (sk0.archery || 0) >= 5 ||
      ((sk0.melee || 0) >= 2 && (sk0.melee || 0) + (sk0.archery || 0) + _cs0 >= 6);
    let strong = trained ? 0 : -1;
    for (let g = 1; g <= 3 && strong === g - 1; g++) if (botLairStrongFor(c, g) && k(g - 1) >= 2) strong = g;
    const hc = Math.min(byTurn, Math.max(cur, strong));
    return { cur: hc, up: hc < 3 && byTurn > hc ? hc + 1 : null, k };
  }
  return { cur, up, k };
}
export function botLairPlan(G, pi, c, pre, L) {
  const sk = c.skills || {};
  const _cs = Math.max(sk.elemental || 0, sk.necromancy || 0, sk.psychic || 0);
  // PROTOTYPE (ideas round 4): a lair-hunting realm sends any hero who can fight at all, from turn 3
  const hunting = G.botLairHunting === true && (G.turn || 0) >= 3 && (sk.melee || 0) + (sk.archery || 0) + _cs >= 2;
  if (
    !hunting &&
    (sk.melee || 0) < 3 &&
    (sk.archery || 0) < 3 &&
    (sk.melee || 0) + (sk.archery || 0) < 5 &&
    !((sk.melee || 0) >= 2 && (sk.melee || 0) + (sk.archery || 0) + _cs >= 6)
  )
    return null; // a combat school counts toward the gate (the rumour still decides)
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const cands = botLairCandidates(G, pi, c, BOT_LAIR_REACH).filter((x) => x.f && x.f.monster);
  if (!cands.length) return null; // option 5: six hops
  const rating = botLairRating(c);
  const lad = (c._botLadder = c._botLadder || {});
  const told = (f) => {
    const r = f._rumourOdds && f._rumourOdds[pi];
    return r &&
      r.charId === c.id &&
      (G.turn || 0) - r.turn <= 6 &&
      !(r.rating != null && rating < r.rating) &&
      !(BOT_LAIR_REASK_GAIN > 0 && r.rating != null && rating >= r.rating + BOT_LAIR_REASK_GAIN)
      ? r
      : null;
  }; // an assessment still good for him
  let T = botLairTiers(c, G);
  // a fresh "below 80%" on the grade above: clear two more of his own grade before he asks again
  if (
    T.up != null &&
    T.cur >= 0 &&
    T.up > T.cur &&
    cands.some(
      (x) =>
        x.grade === T.up &&
        (() => {
          const r = told(x.f);
          return r && r.band < botGoBand(x.grade) && (G.turn || 0) - r.turn <= 1;
        })(),
    ) &&
    !((lad.retryAt || 0) > T.k(T.cur))
  ) {
    lad.retryAt = T.k(T.cur) + BOT_LAIR_RETRY_EXTRA;
    T = botLairTiers(c, G);
  }
  const mhp0 = c.maxHp || 20,
    hp0 = c.hp != null ? c.hp : mhp0;
  // option 3: a WEAK lair on a 60–80% rumour ("the odds favour you") when he stands at full health (95%+)
  const weakRisk = (x) =>
    x.grade === 0 && x.rumour && x.rumour.band >= BOT_LAIR_WEAK_BAND && x.rumour.band < BOT_LAIR_GO_BAND;
  const searchable = (x) =>
    (T.cur >= 0 && x.grade <= T.cur) ||
    (x.rumour && x.rumour.band >= botGoBand(x.grade)) ||
    (weakRisk(x) && hp0 >= mhp0 * BOT_LAIR_WEAK_HP);
  const askable = (x) =>
    T.up != null && x.grade === T.up && !x.rumour && !told(x.f) && L && botRumourAffordable(G, pi, L, x.price);
  if (!cands.some(searchable) && !cands.some(askable)) return null;
  // rest first when hurt: to 75% of max HP, 30% a phase
  const mhp = c.maxHp || 20,
    hp = c.hp != null ? c.hp : mhp;
  const per = Math.max(1, Math.ceil(mhp * 0.3));
  const restN = hp < mhp * BOT_LAIR_MIN_HP ? Math.ceil((mhp * BOT_LAIR_MIN_HP - hp) / per) : 0;
  const mv = [];
  for (let i = 0; i < restN && pre.length + mv.length < 5; i++)
    mv.push({ action: 'rest', target: '', extra: '', desc: 'Rest before the hunt' });
  const left = () => 5 - pre.length - mv.length;
  let pos = P,
    searches = 0,
    asked = 0;
  const used = new Set(),
    askedProv = new Set();
  // 2026-09-29 (Toby: bots never climb past Weak lairs): once his ladder says the grade above is due
  // (T.up > T.cur), the year's FIRST move is to hear the talk of that grade, before farming his own. The loop
  // below only reached the rumour branch when no searchable own-grade lair was left in reach, so a slayer with
  // Weak lairs about him cleared Weak lairs forever and never asked about a Moderate one (40 bot games, 30
  // turns: 50 heroes past six Weak kills, 17 Moderate rumours heard in all).
  const preferAsk = T.cur >= 0 && T.up != null && T.up > T.cur;
  while (left() > 0) {
    const aopts =
      asked < BOT_LAIR_MAX_RUMOURS
        ? cands
            .filter((x) => !askedProv.has(x.X.id) && askable(x))
            .map((x) => ({ x, d: x.X.id === pos.id ? 0 : botPathLen(G, pi, pos, x.X.id, true) }))
            .filter((o) => o.d != null && o.d + 1 <= left())
            .sort((a, b) => a.d - b.d)
        : [];
    const opts =
      preferAsk && asked === 0 && aopts.length
        ? []
        : searches < BOT_LAIR_MAX_SEARCHES
          ? cands
              .filter((x) => !used.has(x.X.id + ':' + x.li) && searchable(x))
              .map((x) => ({ x, d: x.X.id === pos.id ? 0 : botPathLen(G, pi, pos, x.X.id, true) }))
              .filter((o) => o.d != null && o.d + 1 <= left())
              .sort((a, b) => a.d - b.d || b.x.grade - a.x.grade)
          : [];
    if (opts.length) {
      const o = opts[0];
      const path = o.d > 0 ? botPathDirs(G, pi, pos, o.x.X.id, left() - 1, true) || [] : [];
      if (o.d > 0 && path.length !== o.d) {
        used.add(o.x.X.id + ':' + o.x.li);
        continue;
      }
      path.forEach((d) => mv.push(botMoveOrder(d, 'Seek the lair in ' + o.x.X.name)));
      if (searches === 0 && (sk.illusory || 0) >= 1 && left() >= 2)
        mv.push({
          action: 'cast_spell',
          target: 'Invisibility',
          extra: '',
          desc: 'Cast Invisibility (before the lair)',
        });
      const own = T.cur >= 0 && o.x.grade <= T.cur;
      const so = {
        action: 'search',
        target: String(o.x.li),
        extra: '',
        desc: 'Search Lair' + (own ? ' (his own grade)' : ''),
        prov: o.x.X.id,
      };
      if (searches > 0) so._botMinHp = BOT_LAIR_NEXT_HP;
      if (!own && weakRisk(o.x)) so._botMinHp = BOT_LAIR_WEAK_HP; // a 60–80% Weak lair only at full health
      mv.push(so);
      used.add(o.x.X.id + ':' + o.x.li);
      pos = o.x.X;
      searches++;
      continue;
    }
    if (aopts.length) {
      const o = aopts[0];
      const path = o.d > 0 ? botPathDirs(G, pi, pos, o.x.X.id, left() - 1, true) || [] : [];
      if (o.d > 0 && path.length !== o.d) {
        askedProv.add(o.x.X.id);
        continue;
      }
      botSpendRumour(L, o.x.price);
      path.forEach((d) => mv.push(botMoveOrder(d, 'Hear the talk of ' + o.x.X.name)));
      mv.push({ action: 'hunt_rumours', target: String(o.x.li), extra: '', desc: 'Hunt Rumours — ' + o.x.f.name });
      askedProv.add(o.x.X.id);
      pos = o.x.X;
      asked++;
      // option 2: SEARCH IN THE SAME YEAR if the talk is good — a conditional order the engine checks against the
      // rumour this hero heard this turn (80%+, or 60%+ on a Weak lair at full health); otherwise he rests.
      if (left() > 0 && searches < BOT_LAIR_MAX_SEARCHES) {
        const so = {
          action: 'search',
          target: String(o.x.li),
          extra: '',
          desc: 'Search Lair (if the talk is good)',
          prov: o.x.X.id,
          _botIfRumour: botGoBand(o.x.grade),
          _botMinHp: searches > 0 ? BOT_LAIR_NEXT_HP : 0.5,
        };
        if (o.x.grade === 0) {
          so._botIfRumourLow = BOT_LAIR_WEAK_BAND;
          so._botIfRumourLowHp = BOT_LAIR_WEAK_HP;
        }
        mv.push(so);
        used.add(o.x.X.id + ':' + o.x.li);
        searches++;
      }
      continue;
    }
    break;
  }
  if (!searches && !asked) return null;
  return botFillOrders(G, pi, c, pre, mv);
}
// Are there known, uncleared lairs within a slayer's reach that he cannot yet clear? Then training is what
// makes them clearable — he trains; with NO lair known in reach he explores to find one (2026-09-26, Toby).
export function botSlayerHasLairsToGrowInto(G, pi, c) {
  return botLairCandidates(G, pi, c, 4).some((k) => k.f && k.f.monster);
}
// ══ NAVAL DOCTRINE (Sept 2026, Toby) ════
// An ADMIRAL is a leader whose job is the sea: he raises carrier fleets at a coastal port, fills the hulls
// with the most effective liftable land units the port can raise, claims unowned sea provinces, and lands on
// enemy coasts — the scorer's −40 on sea targets does not apply to him. A realm wants one admiral once it
// holds two coastal provinces that can build ships and there is sea worth taking (unowned sea in reach, or
// an at-war coast across the water). Fleets are still bought for ordinary hosts only for the old reasons.
// botCoastalPorts and botSeaWorthTaking (does the realm want an admiral?) are in bots/strategy.ts.
// ── FLYING GENERAL (2026-09-26, Toby item 8) ── the owned provinces that raise a humanoid flyer (the
// only units that both fly AND carry a foot soldier), and the reach of an airborne column: the slowest
// self-flying unit sets the pace, March never speeds flight (mirrors computeMovePoolMax's FLYING CARRY).
// botFlyerType and botFlyerPorts are in bots/strategy.ts; botAirReach, the column's reach, is below.
export function botAirReach(c) {
  const sp = (c.armies || [])
    .filter((a) => a && BOT_AERIAL_TYPES.has(a.type))
    .map((a) => ARMY_SPEED_MASTER[a.type] || 3);
  return sp.length ? Math.max(0, Math.min(5, Math.min(...sp))) : 0;
}
// Nearest of `list` (owned land provinces) by path length; {X,d} or null. Unarmed walks through any land.
export function botNearestOf(G, pi, c, list, unarmed) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  let best = null;
  (list || []).forEach((X) => {
    const d = X.id === P.id ? 0 : botPathLen(G, pi, P, X.id, !!unarmed);
    if (d == null) return;
    if (!best || d < best.d || (d === best.d && (X.tax || 0) > (best.X.tax || 0))) best = { X, d };
  });
  return best;
}
// The berths an admiral still has free: hulls minus the liftable land units he already carries.
export function botSpareBerths(c) {
  const a = (c && c.armies) || [];
  return (
    a.reduce(
      (s, x) => s + (x && BOT_CARRIER_TYPES.has(x.type) ? (KC_CARRIER_BERTHS && KC_CARRIER_BERTHS[x.type]) || 1 : 0),
      0,
    ) - a.filter((x) => x && botLiftable(x.type) && !BOT_SEA_ALL.has(x.type)).length
  );
} // berths: a turtle's Island Back offers two
// botLiftable (a land unit a fleet can carry) is in bots/strategy.ts.
// BFS over sea hexes from `P` (a coast or a sea hex): the best landing — an enemy or unowned land province
// beside the water that this column can beat — or an unowned sea hex to claim. Returns {moves,N} or null.
// 2026-09-26 (Toby item 6): SEA TARGETS ARE NOW STRENGTH-GATED — before this an admiral would sail into a
// Kraken sea on its tax alone. Order of preference among winnable seas: OPEN water first (no defenders,
// +40), the poor WHALE and SHARK waters next (+15), then the prosperous primal seas. Coastal land: poor before rich
// falls out of the same gate — a weak fleet can only take a poorly-held coast, a strong one prefers the
// wealth. Item 7: an admiral with spare berths also sails to an owned coast where a GENERAL stands with
// liftable troops (a rendezvous: the general hands his foot soldiers over next turn).
export function botSeaStrike(G, pi, c, P, myStr, T, maxHops) {
  if (maxHops <= 0 || botSeaCap(c.armies) === 'land') return null;
  const margin = botMarginFor(G, pi, c, T);
  const plainStr = botBattleForce(G, c, null, 'plain');
  const k = plainStr > 0 ? myStr / plainStr : 1;
  const strIn = (t) => botBattleForce(G, c, null, t) * k;
  const adm = c._botRole === 'admiral';
  const spare = adm ? botSpareBerths(c) : 0;
  const prev = {};
  prev[P.id] = null;
  const dirOf = {};
  let q = [P],
    depth = 0,
    best = null;
  const consider = (N, d, viaSea) => {
    if (!N || N.id === P.id) return;
    let sc = null,
      fight = false,
      rv = false;
    if (N.terrain === 'sea') {
      if (N.owner == null && botKnows(G, pi, N.id)) {
        const tStr = botTargetDefence(G, pi, N);
        if (tStr > 0 && strIn('sea') < tStr * margin) return;
        const kind =
          N.race === 'Primal:Whale' || N.race === 'Primal:Shark'
            ? 'whale'
            : N.race && String(N.race).startsWith('Primal:')
              ? 'primal'
              : 'open'; // poor waters (whale or shark) score alike
        sc = (N.tax || 1) * T.taxScoreWeight - tStr - d * 2 + (kind === 'open' ? 40 : kind === 'whale' ? 15 : 0);
        fight = tStr > 0;
      }
    } else {
      const bo = N.owner;
      // rendezvous: an owned coast where a general with liftable foot soldiers stands, when the hulls have room
      if (bo === pi) {
        if (spare >= 1) {
          const gen = (G.characters || []).find(
            (l) =>
              l &&
              l.alive &&
              l.player === pi &&
              l.id !== c.id &&
              l.location === N.id &&
              l._botRole !== 'admiral' &&
              botIsLeader(G, pi, l.id) &&
              (l.armies || []).some((a) => a && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type)),
          );
          if (gen) {
            const lift = (gen.armies || []).filter((a) => a && botLiftable(a.type) && !BOT_SEA_ALL.has(a.type)).length;
            sc = 20 + Math.min(spare, lift) * 4 - d * 3;
            rv = true;
          }
        }
        if (sc == null) return;
      } else {
        if (botFleetOnly(c.armies)) return; // 2026-09-28: bare hulls cannot land — they claim and clear water
        if (bo != null && botRelationRaw(G, pi, bo) !== 'enemy') return;
        if (!botKnows(G, pi, N.id)) return;
        const ec = botEnemyChars(G, N, pi);
        let tStr = botTargetDefence(G, pi, N) + (bo == null ? ec.force * BOT_DEF_BONUS : 0);
        const rem = bo != null ? botRememberedHostAt(G, pi, N.id) : { units: 0, strength: 0 };
        tStr += rem.strength * BOT_DEF_BONUS;
        const eff = botHostMargin(ec.hasKing ? margin * 0.9 : margin, ec.units + rem.units);
        if (tStr > 0 && strIn(N.terrain) < tStr * eff * 1.1) return; // an amphibious assault asks a little more
        fight = tStr > 0;
        sc =
          (N.tax || 0) * T.taxScoreWeight * 1.5 -
          tStr +
          (bo != null ? T.rivalBias * 2 : 0) +
          ec.value +
          ec.units * 3 -
          d * 3;
      }
    }
    if (sc != null && (!best || sc > best.sc)) best = { N, sc, d, fight, rv };
  };
  while (q.length && depth < maxHops) {
    const next = [];
    depth++;
    q.forEach((cur) => {
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, cur, i);
        if (!N || prev[N.id] !== undefined) continue;
        if (N.terrain === 'sea') {
          prev[N.id] = cur.id;
          dirOf[N.id] = i;
          consider(N, depth, true);
          // sail ON through waters that will not stop the fleet: ours, an ally's, or unowned and undefended (a guarded sea may be the target, never the road)
          if (
            N.owner === pi ||
            (N.owner != null && botRelationRaw(G, pi, N.owner) === 'allied') ||
            (N.owner == null && !(N.neutralDefenders || []).length)
          )
            next.push(N);
        } else {
          prev[N.id] = cur.id;
          dirOf[N.id] = i;
          consider(N, depth, false);
        }
      }
    });
    q = next;
  }
  if (!best) return null;
  const dirs = [];
  let id = best.N.id;
  while (prev[id] !== null && prev[id] !== undefined) {
    dirs.unshift(dirOf[id]);
    id = prev[id];
  }
  const moves = dirs.map((d, i) =>
    botMoveOrder(
      d,
      i === dirs.length - 1
        ? best.rv
          ? 'Rendezvous with the general'
          : best.fight
            ? best.N.terrain === 'sea'
              ? 'Clear the waters'
              : 'Assault from the sea'
            : best.N.terrain === 'sea'
              ? 'Claim the sea'
              : 'Land'
        : 'Sail',
    ),
  );
  return { moves, N: best.N };
}
// ── AIR STRIKE (2026-09-26, Toby item 8) ── the FLYING GENERAL's planner. An airborne column (humanoid
// flyers carrying every foot soldier) crosses sea and land alike, so the BFS passes over open sea, its
// own and allied land and unowned land it could simply take, and looks for the best winnable target within
// its reach: an enemy province BEHIND THE FRONT (one that touches none of our land, +25 — a lightning
// strike on the rear), any other enemy province, or unowned land / sea to claim. Returns {moves,N} or null.
export function botAirStrike(G, pi, c, P, myStr, T, maxHops) {
  if (maxHops <= 0 || !botCanFly(c.armies)) return null;
  const margin = botMarginFor(G, pi, c, T);
  const plainStr = botBattleForce(G, c, null, 'plain');
  const k = plainStr > 0 ? myStr / plainStr : 1;
  const strIn = (t) => botBattleForce(G, c, null, t) * k;
  const touchesOurs = (N) => {
    for (let j = 0; j < 6; j++) {
      const K = botNeighbourProv(G, N, j);
      if (K && K.owner === pi) return true;
    }
    return false;
  };
  const prev = {};
  prev[P.id] = null;
  const dirOf = {};
  let q = [P],
    depth = 0,
    best = null;
  const winnable = (N) => {
    const bo = N.owner;
    if (bo === pi || (bo != null && botRelationRaw(G, pi, bo) !== 'enemy')) return null;
    if (!botKnows(G, pi, N.id)) return null;
    const ec = botEnemyChars(G, N, pi);
    let tStr = botTargetDefence(G, pi, N) + (bo == null ? ec.force * BOT_DEF_BONUS : 0);
    const rem = bo != null ? botRememberedHostAt(G, pi, N.id) : { units: 0, strength: 0 };
    tStr += rem.strength * BOT_DEF_BONUS;
    const eff = botHostMargin(ec.hasKing ? margin * 0.9 : margin, ec.units + rem.units);
    if (tStr > 0 && strIn(N.terrain) < tStr * eff) return null;
    return { tStr, ec, bo };
  };
  const consider = (N, d) => {
    if (!N || N.id === P.id) return;
    const w = winnable(N);
    if (!w) return;
    const enemy = w.bo != null;
    const rear = enemy && !touchesOurs(N);
    const sc =
      (N.tax || 0) * T.taxScoreWeight * (N.terrain === 'sea' ? 0.5 : 1.2) -
      w.tStr +
      (enemy ? T.rivalBias * 2 : 0) +
      (rear ? 25 : 0) +
      w.ec.value +
      w.ec.units * 3 -
      d * 2 +
      kitTargetBonus(G, pi, N, (f) => featDiscovered(f, pi)); // PROTOTYPE tactics
    if (!best || sc > best.sc) best = { N, sc, d, fight: w.tStr > 0 };
  };
  const passable = (N) =>
    N.terrain === 'sea'
      ? N.owner == null
        ? !(N.neutralDefenders || []).length
        : N.owner === pi || botRelationRaw(G, pi, N.owner) === 'allied'
      : N.owner === pi || (N.owner != null && botRelationRaw(G, pi, N.owner) === 'allied');
  while (q.length && depth < maxHops) {
    const next = [];
    depth++;
    q.forEach((cur) => {
      for (let i = 0; i < 6; i++) {
        const N = botNeighbourProv(G, cur, i);
        if (!N || prev[N.id] !== undefined) continue;
        prev[N.id] = cur.id;
        dirOf[N.id] = i;
        consider(N, depth);
        if (passable(N)) next.push(N);
      }
    });
    q = next;
  }
  if (!best) return null;
  const dirs = [];
  let id = best.N.id;
  while (prev[id] !== null && prev[id] !== undefined) {
    dirs.unshift(dirOf[id]);
    id = prev[id];
  }
  const moves = dirs.map((d, i) =>
    botMoveOrder(
      d,
      i === dirs.length - 1
        ? best.fight
          ? 'Lightning strike'
          : best.N.terrain === 'sea'
            ? 'Claim the sea'
            : 'Seize'
        : 'Fly',
    ),
  );
  return { moves, N: best.N };
}
// HONEST KNOWLEDGE OF RIVAL CHARACTERS: the rule, BOT_ASSUMED_SKILLS, botKnownSkills and botSkillsFor are in bots/intel.ts;
// botAssumedChar and botSkillsUnknown, which read them, in bots/strategy.ts.
// ══ MASTERY ORDERS (review II A7) ════
export function botMasteryPre(G, pi, c, P, ctx) {
  const sk = c.skills || {};
  ctx = ctx || {};
  if (ctx.fightAhead) {
    if ((sk.tactical || 0) >= 9) return { action: 'grand_stratagem', target: '', extra: '', desc: 'Grand Stratagem' };
    if ((sk.march || 0) >= 9) return { action: 'lightning_advance', target: '', extra: '', desc: 'Lightning Advance' };
    if (ctx.fromSea && (sk.naval || 0) >= 9 && (c.armies || []).some((a) => a && BOT_SEA_ALL.has(a.type)))
      return { action: 'raid_coast', target: '', extra: '', desc: 'Raid the Coast' };
  }
  if (ctx.holding && (sk.tactical || 0) >= 7 && ctx.threat)
    return { action: 'feigned_retreat', target: '', extra: '', desc: 'Feigned Retreat' };
  if (
    c._botRole === 'admiral' &&
    (sk.naval || 0) >= 7 &&
    botAtWar(G, pi) &&
    (c.armies || []).some((a) => a && BOT_SEA_ALL.has(a.type))
  ) {
    // review II A8: seal a rival's waters
    const cand = [P];
    for (let i = 0; i < 6; i++) {
      const N = botNeighbourProv(G, P, i);
      if (N) cand.push(N);
    }
    const sea = cand
      .filter(
        (N) =>
          N &&
          N.terrain === 'sea' &&
          N.owner != null &&
          N.owner !== pi &&
          botRelationRaw(G, pi, N.owner) === 'enemy' &&
          N._blockadeTurn !== G.turn,
      )
      .sort((a, b) => (b.tax || 0) - (a.tax || 0))[0];
    if (sea) return { action: 'blockade', target: String(sea.id), extra: '', desc: 'Blockade ' + sea.name };
  }
  if (ctx.duelSim && (sk.melee || 0) >= 7 && botAtWar(G, pi)) {
    const foe = botVisibleCharsIn(G, pi, P)
      .filter(
        (e) =>
          e &&
          e.alive &&
          e.player != null &&
          e.player !== pi &&
          !(e.armies || []).length &&
          botRelationRaw(G, pi, e.player) === 'enemy' &&
          e._invisTurn !== G.turn &&
          (!e.isKing || c.isKing),
      )
      .sort((a, b) => (b.isKing ? 1 : 0) - (a.isKing ? 1 : 0))[0];
    if (foe) {
      const f = ctx.duelSim(c, botAssumedChar(G, pi, foe), 24);
      if (f && f.win >= 0.7 && f.felled <= 0.1)
        return { action: 'challenge', target: String(foe.id), extra: '', desc: 'Challenge ' + foe.name };
    }
  }
  return null;
}
// ══ DUELS (Sept 2026, Toby): a general's duel stance is a judgement, not a temper ════
// The engine let a bot commander's Temper pick the stance — a Brave lord with Melee 0 rode out to die.
// Now every bot character carries a stance set here each turn: CHALLENGE only when he is a real duellist
// (a fighting skill or battle school at 4+, 80%+ health) and any enemy general seen within two hexes
// is forecast beaten (on the skills our spies know); ACCEPT when he can hold his own (a duel skill at
// 2+, 60%+ health); REFUSE when he cannot (the 20% morale cost is cheaper than a dead general).
// botDuelSkill (a character's best duelling skill) is in bots/strategy.ts.
export function botDuelStance(G, pi, c, duelSim) {
  const hp = c.hp != null ? c.hp : c.maxHp || 20,
    mhp = c.maxHp || 20;
  const d = botDuelSkill(c);
  if (d < 2 || hp < mhp * 0.6) return 'refuse';
  if (d < 4 || hp < mhp * 0.8) return 'accept';
  const P = G.world.provinces[c.location];
  if (!P) return 'accept';
  const near = [P];
  for (let i = 0; i < 6; i++) {
    const N = botNeighbourProv(G, P, i);
    if (N) near.push(N);
  }
  const I = botEnemyIntel(G, pi);
  let worst = null;
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
    const r = I.generals[e.id];
    const loc = botSeesChar(G, pi, e) ? e.location : r && (G.turn || 0) - r.turn <= 2 ? r.provId : null;
    if (loc == null || !near.some((x) => x.id === loc)) return;
    const f = typeof duelSim === 'function' ? duelSim(c, botAssumedChar(G, pi, e), 16) : null;
    const win = f ? f.win : botDuelRating(c) >= botDuelRating(botAssumedChar(G, pi, e)) * 1.3 ? 0.7 : 0.4;
    if (worst == null || win < worst) worst = win;
  });
  if (worst != null && worst < 0.65) return 'accept';
  return 'challenge';
}
export function botSetDuelStances(G, pi, duelSim) {
  (G.characters || []).forEach((c) => {
    if (!(c && c.alive && c.player === pi)) return;
    c.encounterPlan = c.encounterPlan || {};
    c.encounterPlan.duelStance = botDuelStance(G, pi, c, duelSim);
    c.encounterPlan._botStance = true;
  });
}
// ══ GARRISON SWEEP (Sept 2026, review II A2 — corrected: the engine's Pick Up Army order does it) ════
// Garrisons fill past the two-per-province rule from engine deliveries the recruit cap never sees (Call to
// Arms, Elven Homeward Flight, a dispersed column). A character standing in such a province takes the
// surplus into his column with `pickup_army` target "g:<i>,g:<j>" — the best units for HIM (strength ×
// kinship/grudge), leaving the two weakest behind as the tripwire. One sweep per province per turn.
/** PROTOTYPE round 11: a skeletal company that rose from dead land, bound to its garrison. */
export function botBoundDead(a) {
  return a != null && a._isSkeletal === true && a._kitGarrison === true;
}
export function botPickupOrder(G, pi, c, prov) {
  if (!prov || prov.owner !== pi || prov.terrain === 'sea') return null;
  const garr = prov.garrisonArmies || [];
  const keep = Math.min(2, botGarrisonTarget(G, prov, pi));
  if (garr.length <= keep) return null; // 2026-09-26 (Toby): only the garrison the province is meant to hold stays behind (was always 2) — a fallen commander's host garrisoned here is taken up whole
  const cache = botTurnCache(G);
  cache.swept = cache.swept || new Set();
  if (cache.swept.has(prov.id)) return null;
  const val = (a) => unitBaseStrength(a) * botRaceTerrainMult(G, c, a, null, false, pi);
  // PROTOTYPE round 11: the dead that rose from dead land will not leave it; they stay and count as the garrison kept
  const ranked = garr
    .map((a, i) => ({ i, v: a ? val(a) : -1, bound: botBoundDead(a) }))
    .filter((x) => !x.bound)
    .sort((x, y) => y.v - x.v);
  const take = ranked
    .slice(0, Math.max(0, ranked.length - Math.max(0, keep - (garr.length - ranked.length))))
    .map((x) => x.i)
    .sort((a, b) => a - b);
  if (!take.length) return null;
  cache.swept.add(prov.id);
  return {
    action: 'pickup_army',
    target: take.map((i) => 'g:' + i).join(','),
    extra: '',
    desc: 'Take up ' + take.length + ' surplus garrison unit' + (take.length !== 1 ? 's' : '') + ' in ' + prov.name,
  };
}
// ORPHANED HOST (2026-09-26, Toby): when a commander falls his host garrisons the nearest friendly province
// (disperseDeadCharArmies). Any owned land province holding three or more garrison units beyond its target is
// such a host; the nearest free hero walks there and takes it up. One claimant per province per turn.
export function botOrphanHostOrders(G, pi, c, pre) {
  const P = G.world.provinces[c.location];
  if (!P) return null;
  const cache = botTurnCache(G);
  cache.orphan = cache.orphan || new Set();
  let best = null;
  (G.world.provinces || []).forEach((X) => {
    if (!X || X.owner !== pi || X.terrain === 'sea' || cache.orphan.has(X.id)) return;
    const n =
      (X.garrisonArmies || []).filter((a) => !botBoundDead(a)).length - Math.min(2, botGarrisonTarget(G, X, pi));
    const bred = botKitBredHere(G, pi, c, X); // PROTOTYPE tactics: beasts or skeletons the kit raised here
    if (n < 3 && !(bred && n >= 1)) return;
    const d = X.id === P.id ? 0 : botPathLen(G, pi, P, X.id, true);
    if (d == null || d > 5) return;
    const sc = n * 3 - d * 2;
    if (!best || sc > best.sc) best = { X, d, sc, n };
  });
  if (!best) return null;
  const path = best.d > 0 ? botPathDirs(G, pi, P, best.X.id, 5, true) || [] : [];
  if (best.d > 0 && path.length !== best.d) return null;
  if (pre.length + path.length >= 5) return null;
  cache.orphan.add(best.X.id);
  const out = [...pre, ...path.map((d) => botMoveOrder(d, 'Take up the leaderless host at ' + best.X.name))];
  const po = botPickupOrder(G, pi, { ...c, location: best.X.id }, best.X);
  if (!po) return null;
  out.push(po);
  while (out.length < 5) out.push({ action: 'defend', target: '', extra: '', desc: 'Hold with the host' });
  return out;
}
// ══ BOT CONCESSION ════
// A bot realm with no province anywhere in the world has nothing to rule, nothing to tax and
// nothing to rebuild from: it concedes. The engine's existing concession machinery then does
// everything else — the realm's characters only ever Defend (enforced in the order-merge pass), it
// stops being waited on
// (realmExemptFromOrders) and it no longer counts toward the last-realm-standing victory test.
// MUST run before the bot movement/economy/action passes so a conceding realm never writes orders.
export function runBotConcessions(G, botIdxSet, turnContext) {
  if (!botIdxSet || !botIdxSet.size || !G || !G.world) return;
  if (!(G.world.provinces || []).length) return; // world not built — never concede on a blank state
  if ((G.turn || 0) < 1) return;
  botIdxSet.forEach((pi) => {
    const p = (G.players || [])[pi];
    if (!p || p.conceded) return;
    if ((p.provinces || []).length > 0) return;
    // Belt and braces: the realm's own province list is the engine's record, but cross-check the
    // map so a stale/desynced list can never concede a bot that still holds ground.
    if ((G.world.provinces || []).some((pv) => pv && pv.owner === pi)) return;
    p.conceded = true;
    p.concededTurn = G.turn;
    if (turnContext)
      emit(turnContext, {
        type: 'system',
        text: `\u{1F3F3} ${p.name} holds no province in all the world — the realm CONCEDES the game. Its heroes lay down their ambitions and will only defend what they have from here on.`,
        audience: { actor: null, realms: [], seen: 'world' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        system: true,
      });
  });
}

// Write movement (and phase-0 muster) orders for every bot character. Called from runTurn after
// human orders are merged into G.turnOrders and before the default-to-Defend pass.
// ══ SLAYER SCHOOL (2026-09-28, Toby) ════
// The engine's mentor rule makes a Practice phase a GUARANTEED level when a friendly character in the same
// province practises the same skill in the same phase at a higher level. The study found only 7% of slayer
// training years had a mentor — the king, the usual teacher, is the general and was marching or mustering.
// Once every other plan is made, each training slayer is sent to the realm character who can teach him the
// most levels this year, in the phases that character has spare:
//   • the KING teaches Melee, Archery and every magic school he knows better;
//   • any other HERO teaches the magic schools he knows better.
// It never touches a general's march: only phases that are already filler (a Hold, a plain Practice, nothing)
// are used, and only in a province the realm owns at the start of the year. A phase the KING meant to spend
// recruiting is handed to another hero standing with him — he raises the same troops for the king's host — so
// the king is free to teach ("heroes other than the king recruit to the general").
export const BOT_TEACH_KING = ['melee', 'archery', ...BOT_SCHOOLS];
// botIsTeach (is this order a lesson?) is in bots/strategy.ts.
export function botSlayerSkillPri(S, sk) {
  if (S === 'melee') return 0;
  if (S === botSlayerSchool({ skills: sk })) return 1;
  if (S === 'archery') return 2;
  if (S === 'elemental' || S === 'necromancy' || S === 'psychic') return 3;
  return 4;
}
export function botOrderLocs(G, c) {
  const o = G.turnOrders[c.id] || [];
  const out = [];
  let cur = G.world.provinces[c.location];
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
}
export function botTeachFree(G, pi, m, p) {
  const k = (G.turnOrders[m.id] || [])[p];
  if (!k) return true;
  if (k.action === 'practice')
    return !/drill the host|drill the fleet|lead the host cleanly/.test(k.desc || '') && !botIsTeach(k);
  return k.action === 'defend' && p > 0 && !botNearbyThreat(G, pi, m);
}
export function botRunSlayerSchool(G, pi, roles) {
  const res = (botTurnCache(G).teach = botTurnCache(G).teach || {}); // mentorId → {phase: skill}
  const mine = (G.characters || []).filter((x) => x && x.alive && x.player === pi && !x._isHeir);
  const king = mine.find((x) => x.isKing) || null;
  const BUSY = new Set([
    'search',
    'hunt_rumours',
    'hire',
    'encounter',
    'cast_spell',
    'rest',
    'assassinate',
    'sabotage',
    'steal',
    'spy',
    'research',
    'consecrate',
    'chart_unknown',
    'leave_army',
    'recruit',
    'pickup_army',
  ]);
  const slayers = mine.filter(
    (c) =>
      c._botRole === 'slayer' &&
      !c.isKing &&
      !roles.leaders.includes(c.id) &&
      !(c.armies || []).length &&
      (c.hp != null ? c.hp : c.maxHp || 20) >= (c.maxHp || 20) * 0.6,
  );
  slayers.forEach((sl) => {
    const so = G.turnOrders[sl.id] || [];
    if (so.some((x) => x && BUSY.has(x.action))) return; // lair work, a hire or a spell comes first
    const Ps = G.world.provinces[sl.location];
    if (!Ps) return;
    let best = null;
    // Below the hunting gate (botLairPlan) the lessons that open it come first: Melee / Archery from the king.
    // Magic lessons (anyone) once he hunts — a magic level in place of his Melee practice had kept slayers
    // below the gate longer (study 2026-09-28).
    const _ss = sl.skills || {};
    const belowGate = (_ss.melee || 0) < 3 && (_ss.archery || 0) < 3 && (_ss.melee || 0) + (_ss.archery || 0) < 5;
    mine.forEach((m) => {
      if (m.id === sl.id) return;
      const teach = belowGate ? (m.isKing ? ['melee', 'archery'] : []) : m.isKing ? BOT_TEACH_KING : BOT_SCHOOLS;
      const ms = m.skills || {};
      if (!teach.length) return;
      if (!teach.some((S) => (ms[S] || 0) > ((sl.skills || {})[S] || 0) && ((sl.skills || {})[S] || 0) < 5)) return;
      const locs = botOrderLocs(G, m);
      const mo = G.turnOrders[m.id] || [];
      const r = res[m.id] || {};
      // the king teaches in his drill phases too (a drill is not a march — Toby: teaching must not slow the conquest)
      const free = [0, 1, 2, 3, 4].map(
        (p) =>
          botTeachFree(G, pi, m, p) ||
          (m.isKing &&
            !!mo[p] &&
            mo[p].action === 'practice' &&
            /drill the host|lead the host cleanly/.test(mo[p].desc || '')),
      );
      // the KING's recruit phase can be handed to a hero standing with him who has that phase spare
      const helper = [0, 1, 2, 3, 4].map((p) => {
        if (!m.isKing || !(mo[p] && mo[p].action === 'recruit')) return null;
        return (
          mine.find(
            (h) =>
              h.id !== m.id &&
              h.id !== sl.id &&
              !h.isKing &&
              h._botRole !== 'slayer' &&
              botOrderLocs(G, h)[p] === locs[p] &&
              botTeachFree(G, pi, h, p),
          ) || null
        );
      });
      for (let p0 = 0; p0 < 5; p0++) {
        const X = locs[p0];
        if (X == null) continue;
        if (!(free[p0] || helper[p0])) continue;
        const PX = G.world.provinces[X];
        if (!PX || PX.terrain === 'sea') continue;
        // our own ground; or ground the KING's march takes this year — the slayer follows him there and arrives
        // a phase after the king, never into the fight (an enemy province is never on an unarmed path anyway)
        const arrive = locs.indexOf(X);
        if (PX.owner !== pi && !(m.isKing && (PX.owner == null || PX.owner === pi))) continue;
        const path = X === Ps.id ? [] : botPathDirs(G, pi, Ps, X, Math.min(p0, 3), true);
        if (!path || path.length > p0 || path.length > 3) continue; // lessons within three hops — a slayer is not drawn off to the front
        if (PX.owner !== pi && X !== Ps.id && path.length < arrive + 1) continue;
        const lv = { ...(sl.skills || {}) };
        const plan = [];
        for (let q = path.length; q < 5; q++) {
          if (locs[q] !== X || !(free[q] || helper[q])) continue;
          const ok = (S) => (ms[S] || 0) > (lv[S] || 0) && (lv[S] || 0) < 5;
          let S = null;
          if (r[q]) {
            if (ok(r[q])) S = r[q];
          } else
            S =
              teach
                .filter(ok)
                .sort((a, b) => botSlayerSkillPri(a, sl.skills || {}) - botSlayerSkillPri(b, sl.skills || {}))[0] ||
              null;
          if (!S) continue;
          plan.push({ q, S, helper: free[q] ? null : helper[q], gate: S === 'melee' && (lv.melee || 0) < 3 });
          lv[S] = (lv[S] || 0) + 1;
        }
        if (!plan.length) continue;
        const sc = plan.length * 10 + plan.filter((x) => x.gate).length * 6 - path.length + (m.isKing ? 1 : 0); // a Melee lesson below the hunting gate is worth most
        if (!best || sc > best.sc) best = { m, X, path, plan, sc };
      }
    });
    if (!best) {
      // NO LESSON THIS YEAR: when the king can teach him Melee, Archery or a combat school, the slayer walks to
      // where the king will stand at the end of the year (our ground, or ground the king takes — arriving after him),
      // so next year they start together and the king's spare phases become lessons.
      if (!king || king.id === sl.id) return;
      const ks = king.skills || {},
        ss = sl.skills || {};
      if (!belowGate || !['melee', 'archery'].some((S) => (ks[S] || 0) > (ss[S] || 0))) return; // only to open the hunting gate
      const kl = botOrderLocs(G, king);
      const ko = G.turnOrders[king.id] || [];
      let kEnd = G.world.provinces[kl[4]];
      {
        const x = ko[4];
        if (x && x.action === 'move' && kEnd) {
          const N = String(x.target).startsWith('dir:')
            ? botNeighbourProv(G, kEnd, BOT_HEX_DIRS.indexOf(String(x.target).slice(4)))
            : G.world.provinces[+x.target];
          if (N) kEnd = N;
        }
      }
      if (!kEnd || kEnd.terrain === 'sea' || kEnd.id === sl.location) return;
      if (!(kEnd.owner === pi || kEnd.owner == null)) return;
      const path = botPathDirs(G, pi, Ps, kEnd.id, 5, true);
      if (!path || !path.length || path.length > 5) return;
      const kArr = kl.indexOf(kEnd.id) < 0 ? 5 : kl.indexOf(kEnd.id);
      if (kEnd.owner !== pi && path.length < Math.min(5, kArr + 1)) return;
      const solo = botSlayerTrainSkill(sl);
      const out = path.map((d) => botMoveOrder(d, 'Join ' + king.name + ' for training'));
      while (out.length < 5)
        out.push(
          solo
            ? {
                action: 'practice',
                target: solo,
                extra: '',
                desc: 'Practice ' + (SKILL_LABELS[solo] || solo) + ' (slayer)',
              }
            : { action: 'defend', target: '', extra: '', desc: 'Hold' },
        );
      G.turnOrders[sl.id] = out;
      const D = (botTurnCache(G).teachDiag = botTurnCache(G).teachDiag || []);
      D.push({ pi, slayer: sl.id, mentor: king.id, king: true, phases: 0, handed: 0, follow: true });
      return;
    }
    // the slayer's year: walk to the teacher, practise the taught skill in each taught phase, the ladder skill between
    const solo = botSlayerTrainSkill(sl);
    const out = [];
    const byQ = {};
    best.plan.forEach((x) => {
      byQ[x.q] = x;
    });
    best.path.forEach((d) => out.push(botMoveOrder(d, 'To ' + best.m.name + ' for training')));
    for (let q = out.length; q < 5; q++) {
      const x = byQ[q];
      out.push(
        x
          ? {
              action: 'practice',
              target: x.S,
              extra: '',
              desc: 'Practice ' + (SKILL_LABELS[x.S] || x.S) + ' (taught by ' + best.m.name + ')',
            }
          : solo
            ? {
                action: 'practice',
                target: solo,
                extra: '',
                desc: 'Practice ' + (SKILL_LABELS[solo] || solo) + ' (slayer)',
              }
            : { action: 'defend', target: '', extra: '', desc: 'Hold' },
      );
    }
    G.turnOrders[sl.id] = out;
    // the teacher's phases (and any recruit handed to a helper, raised into the king's host)
    const mo = (G.turnOrders[best.m.id] = Array.isArray(G.turnOrders[best.m.id])
      ? G.turnOrders[best.m.id]
      : [null, null, null, null, null]);
    const r = (res[best.m.id] = res[best.m.id] || {});
    best.plan.forEach((x) => {
      if (x.helper) {
        const ro = mo[x.q];
        const ho = (G.turnOrders[x.helper.id] = Array.isArray(G.turnOrders[x.helper.id])
          ? G.turnOrders[x.helper.id]
          : [null, null, null, null, null]);
        ho[x.q] = {
          ...ro,
          target: String(ro.target).replace(/,to:\d+$/, '') + `,to:${best.m.id}`,
          desc: ro.desc + ' (for ' + best.m.name + "'s host)",
        };
      }
      mo[x.q] = {
        action: 'practice',
        target: x.S,
        extra: '',
        desc: 'Practice ' + (SKILL_LABELS[x.S] || x.S) + ' (teach ' + sl.name + ')',
      };
      r[x.q] = x.S;
    });
    const D = (botTurnCache(G).teachDiag = botTurnCache(G).teachDiag || []);
    D.push({
      pi,
      slayer: sl.id,
      mentor: best.m.id,
      king: !!best.m.isKing,
      phases: best.plan.length,
      handed: best.plan.filter((x) => x.helper).length,
    });
  });
}

// ── PROTOTYPE (alignment ideas round 1): the kits' orders a bot gives where it stands ────
// One pre-order per hero per turn, through the ledger where gold is spent. Good Works where a Good hero stands on a
// province of the realm's that can still rise; Grow the Wild and Tend the Grove for a Druid on the realm's plains or
// woods; a Trade Pact for the richest unclaimed humanoid neighbour the chest can buy (once a turn); Lay Waste when an
// Evil realm is short of gold, and an Evil column of three or fewer companies enslaves rather than plunders; Despoil a
// poor province of the Undead realm's, and Bind the Bones when a necromancer has two or more companies to bind and the
// gold to pay; a Pagan awakens the stones the realm holds.
/** PROTOTYPE tactics: the kit's own units standing in the garrison of `X` that hero `c` could lead away (a Druidic
 *  realm's beasts with command room to spare; an Undead necromancer's skeletons). */
export function botKitBredHere(G, pi, c, X) {
  const kit = kitTactics(G, pi);
  if (!kit || !X || X.owner !== pi) return false;
  const garr = X.garrisonArmies || [];
  if (kit === 'Druidic')
    return (
      garr.some((a) => a && beastCommandCount(a)) &&
      beastCommandRoom(c, G.characters || [], protoBeastRoomExtra(G, c)) > 0
    );
  // round 11: the dead that rose from dead land garrison it and cannot be led away
  if (kit === 'Undead')
    return garr.some((a) => a && a._isSkeletal && a._kitGarrison !== true) && (c.skills || {}).necromancy >= 1;
  return false;
}
export function botKitPre(G, pi, c, P, L) {
  const pl = (G.players || [])[pi];
  const sk = c.skills || {};
  const home = botHomeId(G, pi);
  const humanoid = P.terrain !== 'sea' && !String(P.race || '').startsWith('Primal');
  const owned = P.owner === pi;
  const tactics = kitTactics(G, pi) != null;
  // PROTOTYPE tactics: take up what the kit bred in this garrison before anything else
  if (tactics && botKitBredHere(G, pi, c, P)) {
    const po = botPickupOrder(G, pi, c, P);
    if (po) return po;
  }
  // PROTOTYPE tactics (Neutral, master list): the League's heroes fight to capture — a captive is sold back
  if (pl.alignment === 'Neutral') {
    c.encounterPlan = c.encounterPlan || {};
    c.encounterPlan.ransom = true;
  }
  // PROTOTYPE tactics (Neutral): hire the sell-swords standing here, at the realm's discount
  if (tactics && pl.alignment === 'Neutral') {
    const toks = [];
    (G.mercenaries || []).forEach((m) => {
      if (!m || m.location !== P.id || m.isSea) return;
      const cost = Math.max(1, (ARMY_COST_MASTER[m.type] || 2) - 2);
      if (!botNeutralHirePay(L, cost)) return;
      toks.push('merc:' + String(m.id));
    });
    if (toks.length)
      return { action: 'recruit', target: toks.join(','), extra: '', desc: 'Hire the sell-swords in ' + P.name };
  }
  // PROTOTYPE tactics (round 2): the king's own orders, each when its moment comes
  if (tactics && c.isKing) {
    const ko = botKingKitOrder(G, pi, c, P, L);
    if (ko) return ko;
  }
  // PROTOTYPE tactics (round 5, Toby): a Druidic realm recruits the creatures of its own creature provinces, and an Evil
  // realm the monsters of its monster provinces, as fast as the hero standing there can lead them and the chest allows
  if (tactics && owned && (pl.alignment === 'Druidic' || pl.alignment === 'Evil')) {
    const kinds = (P.armyTypes || []).filter(
      (t) =>
        beastCommandCount({ type: t, quality: 'Average', race: P.race || 'Primal' }) &&
        (pl.alignment === 'Evil') === BOT_MONSTER_ARMIES.has(t),
    );
    // beyond what he can lead, the engine musters a beast into the province's garrison (to 3 there): the Call of the
    // Wild and the next hero through collect them
    let room =
      beastCommandRoom(c, G.characters || [], protoBeastRoomExtra(G, c)) +
      Math.max(0, 3 - (P.garrisonArmies || []).filter((a) => a && beastCommandCount(a)).length);
    const toks = [];
    for (const t of kinds) {
      const cost = ARMY_COST_MASTER[t] || 4;
      let q = 0;
      while (room > 0 && q < 2 && botBeastFundPay(L, cost)) {
        q++;
        room--;
      }
      if (q) toks.push(t + '|' + String(q));
    }
    if (toks.length)
      return { action: 'recruit', target: toks.join(','), extra: '', desc: 'Recruit the beasts of ' + P.name };
  }
  // round 11: a one-off price (an order's gold, not a wage) is tested against the chest alone, not the wage cap
  const spendIf = (cost) => {
    if (L.budget < cost) return false;
    L.budget -= cost;
    return true;
  };
  switch (pl.alignment) {
    case 'Good':
      // master list: Good Works lifts Terror and plague — given where either sits on a province of the realm
      if (
        owned &&
        humanoid &&
        P._goodWorksTurn !== G.turn &&
        (P._terrorStacks || P._plaguedTurn != null || P._kitPlague) &&
        spendIf(GOOD_WORKS_COST)
      )
        return { action: 'good_works', target: '', extra: '', desc: 'Good Works in ' + P.name };
      return null;
    case 'Druidic':
      if (!owned || (sk.druid || 0) < 2) return null; // master list: Grow the Wild needs Druid 3 (the signature +1 counts)
      if (
        (P.terrain === 'plain' || P.terrain === 'desert') &&
        L.budget >= GROW_WILD_COST + 4 &&
        spendIf(GROW_WILD_COST)
      )
        return { action: 'grow_wild', target: '', extra: '', desc: 'Grow the Wild in ' + P.name };
      return null;
    case 'Neutral': {
      if (L.sig.pact) return null;
      let best = null;
      tradePactTargets(G, c, P).forEach((X) => {
        if (!botKnows(G, pi, X.id)) return;
        // master list: another realm's province may be bought too — a bot buys only from a realm it is at war with
        if (X.owner != null && botRelationRaw(G, pi, X.owner) !== 'enemy') return;
        const price = X.owner == null ? tradePactPrice(X) : tradePactPriceOwned(X);
        if (price > L.budget) return;
        const v = (X.tax || 0) * 3 - price * 0.5 + (X.owner != null ? 4 : 0);
        if (!best || v > best.v) best = { X, price, v };
      });
      if (!best) return null;
      L.budget -= best.price;
      L.sig.pact = 1;
      return {
        action: 'trade_pact',
        target: 'prov:' + String(best.X.id),
        extra: '',
        desc: 'Trade Pact with ' + best.X.name,
      };
    }
    case 'Evil': {
      // enslave with a small column, plunder and terrorise with a large one
      c.encounterPlan = c.encounterPlan || {};
      c.encounterPlan.evilMode = (c.armies || []).length <= 3 ? 'enslave' : 'terror';
      // master list: Spread Dread — from a province of the realm, when dread does not yet grip it or a neighbour
      if (
        tactics &&
        owned &&
        !c.isKing &&
        (!P._terrorStacks || neighboursOf(G, P).some((X) => X.terrain !== 'sea' && !X._terrorStacks))
      )
        return { action: 'spread_dread', target: '', extra: '', desc: 'Spread Dread from ' + P.name };
      return null;
    }
    case 'Undead': {
      const land = (pl.provinces || []).length;
      if (
        owned &&
        humanoid &&
        P.id !== home &&
        !P._despoiled &&
        (P.tax || 0) <= (tactics ? 5 : 3) && // round 14: tax 5 or less (dead land pays 1 + 4g Grave Goods)
        land >= (tactics ? 3 : 4) &&
        spendIf(DESPOIL_COST)
      )
        return { action: 'despoil', target: '', extra: '', desc: 'Despoil ' + P.name };
      return null;
    }
    case 'Pagan': {
      const stones = (P.features || []).find((f) => f && f.ritualSite && !f.siteKind);
      if (
        owned &&
        stones &&
        P._riteActivatedBy !== pi &&
        P._riteTurn !== G.turn &&
        (tactics ? G.turn >= 4 && L.budget >= 12 : L.budget >= 9) // tactics: soldiers first, the stones from turn 4 (master list: 5g)
      ) {
        L.budget -= RITE_OF_AWAKENING_COST;
        return { action: 'rite', target: 'awakening', extra: '', desc: 'Perform Rite — the Awakening at ' + P.name };
      }
      return null;
    }
  }
  return null;
}

// PROTOTYPE tactics (alignment ideas round 2): the kings' orders. The realm the bot is at war with that holds the most
// land is the one it proclaims against or embargoes; the muster, the sacrifice and the plague wait for a war; the pact
// and the call wait for room to lead what they bring.
function botWarFoe(G, pi) {
  let best = null;
  (G.players || []).forEach((p, j) => {
    if (j === pi || !p || botRelationRaw(G, pi, j) !== 'enemy') return;
    if (!(G.characters || []).some((k) => k && k.alive && k.isKing && k.player === j)) return;
    const land = (p.provinces || []).length;
    if (!best || land > best.land) best = { j, land };
  });
  return best ? best.j : null;
}
export function botKingKitOrder(G, pi, c, P, L) {
  const pl = (G.players || [])[pi];
  if (!pl || !P) return null;
  const war = botAtWar(G, pi);
  const owned = P.owner === pi;
  const ready = (key) => kingOrderReady(G, pl, key);
  switch (pl.alignment) {
    case 'Divine': {
      if (!war || !ready('proclaim_crusade') || !botCanAfford(L, PROCLAIM_CRUSADE_COST)) return null;
      const foe = botWarFoe(G, pi);
      if (foe == null) return null;
      botSpend(L, PROCLAIM_CRUSADE_COST);
      return {
        action: 'proclaim_crusade',
        target: 'realm:' + String(foe),
        extra: '',
        desc: 'Proclaim a Crusade against ' + ((G.players || [])[foe] || {}).name,
      };
    }
    case 'Good':
      if ((!war && G.turn < 6) || !ready('light_beacons') || !botCanAfford(L, 2 * LIGHT_BEACONS_COST_PER_COMPANY)) // round 22: at war, or from turn 6
        return null;
      botSpend(L, Math.min(L.budget, 4 * LIGHT_BEACONS_COST_PER_COMPANY));
      return { action: 'light_beacons', target: '', extra: '', desc: 'Light the Beacons' };
    case 'Druidic': {
      if (!owned) return null; // round 6: any Druidic king
      const room = beastCommandRoom(c, G.characters || [], protoBeastRoomExtra(G, c));
      if (room < 1) return null; // round 6: one beast to lead is reason enough (round 2-5: two)
      let n = 0;
      (pl.provinces || []).forEach((id) => {
        const X = G.world.provinces[id];
        if (!X || X.owner !== pi || hexDistP(X, P, G.world.cols) > CALL_OF_THE_WILD_RANGE) return;
        n += (X.garrisonArmies || []).filter(
          (a) => a && beastCommandCount(a) && !BOT_MONSTER_ARMIES.has(a.type),
        ).length;
      });
      if (n < 1 || !botCanAfford(L, CALL_WILD_COST)) return null;
      botSpend(L, CALL_WILD_COST);
      return { action: 'call_wild', target: '', extra: '', desc: 'Sound the Call of the Wild' };
    }
    case 'Neutral': {
      if (!war || !ready('embargo') || !botCanAfford(L, EMBARGO_COST)) return null;
      const foe = botWarFoe(G, pi);
      if (foe == null) return null;
      botSpend(L, EMBARGO_COST);
      return {
        action: 'embargo',
        target: 'realm:' + String(foe),
        extra: '',
        desc: 'Declare an Embargo on ' + ((G.players || [])[foe] || {}).name,
      };
    }
    case 'Pagan': {
      // master list: Call down the storm on the enemy host standing on or beside the realm's woken stones, where the
      // enemy has more companies there than the realm has
      if (!ready('call_storm') || !botCanAfford(L, CALL_STORM_COST)) return null;
      let best = null;
      stormTargets(G, pi).forEach((X) => {
        let foe = 0;
        let own = X.owner === pi ? (X.garrisonArmies || []).length : 0;
        (G.characters || []).forEach((h) => {
          if (!h || !h.alive || h.location !== X.id) return;
          const n = (h.armies || []).filter((a) => a && !a._phantom).length;
          if (h.player === pi) own += n;
          else if (h.player != null && botRelationRaw(G, pi, h.player) === 'enemy') foe += n;
        });
        if (X.owner != null && X.owner !== pi && botRelationRaw(G, pi, X.owner) === 'enemy') foe += (X.garrisonArmies || []).length;
        const gain = foe - own;
        if (foe >= 3 && gain >= 2 && (!best || gain > best.gain)) best = { X, gain };
      });
      if (!best) return null;
      botSpend(L, CALL_STORM_COST);
      return { action: 'call_storm', target: 'prov:' + String(best.X.id), extra: '', desc: 'Call down the storm on ' + best.X.name };
    }
    case 'Evil': {
      // round 5: the dearest monster of the realm's pits the chest can pay for, every turn the king can spare the blood
      // (master list: the pact takes 40% of his current HP, so only a king above half health pays it)
      if ((c.hp || 0) <= Math.max(10, Math.ceil((c.maxHp || 20) * 0.5)) || darkPactBlood(c) >= (c.hp || 0)) return null;
      if (beastCommandRoom(c, G.characters || [], protoBeastRoomExtra(G, c)) <= 0) return null;
      const kinds = darkPactKinds(G, pi)
        .filter((k) => L.budget >= darkPactCost(k) + 4)
        .sort((a, b) => darkPactCost(b) - darkPactCost(a));
      const kind = kinds[0];
      if (!kind) return null;
      botSpend(L, darkPactCost(kind));
      return { action: 'dark_pact', target: 'type:' + kind, extra: '', desc: 'Make a Dark Pact for ' + kind };
    }
    case 'Undead': {
      // master list: Bind the Bones — when two or more skeletal companies here can still rise a tier and the chest can
      // pay for them beyond its wages
      if (!ready('bind_bones')) return null;
      let n = (c.armies || []).filter((a) => a && a._isSkeletal && !a._phantom && a.quality !== 'Elite').length;
      if (owned) n += (P.garrisonArmies || []).filter((a) => a && a._isSkeletal && a.quality !== 'Elite').length;
      (G.characters || []).forEach((h) => {
        if (h && h.alive && h.id !== c.id && h.player === pi && h.location === P.id)
          n += (h.armies || []).filter((a) => a && a._isSkeletal && a.quality !== 'Elite').length;
      });
      const affordable = Math.min(n, Math.floor(Math.max(0, L.budget - 4) / BIND_BONES_COST));
      if (affordable < 1) return null;
      botSpend(L, affordable * BIND_BONES_COST);
      return { action: 'bind_bones', target: '', extra: '', desc: 'Bind the Bones in ' + P.name };
    }
  }
  return null;
}

// PROTOTYPE tactics (round 5, Toby): BEAST MUSTER. A Druidic or Evil realm's hero with room to lead walks to the nearest
// beast province of the realm's own kind (within `maxHops`) and recruits there, as many as he can lead and the chest
// allows. Returns the destination, the path and the recruit tokens, or null (the budget is left untouched then).
/** PROTOTYPE tactics (round 11): a Neutral chest above NEUTRAL_HOARD hires beyond the wage cap (the counting-houses pay
 *  nothing more on it); below, a hire is any recruit. */
export const NEUTRAL_HOARD = 30;
export function botNeutralHirePay(L, cost) {
  if (L.budget >= NEUTRAL_HOARD + cost) {
    L.budget -= cost;
    L.upkeep += cost;
    return true;
  }
  if (!botCanAfford(L, cost)) return false;
  botSpend(L, cost);
  return true;
}
/** PROTOTYPE tactics (round 11): the nearest province of an Undead realm's that a hero should Despoil (humanoid, not the
 *  capital, not dead land yet, poor), within `maxHops` through the realm's land, while the chest can pay. {X, d, path}. */
export function botDespoilPlan(G, pi, c, P, L, maxHops) {
  const pl = (G.players || [])[pi];
  if (!pl || !P || (pl.provinces || []).length < 2 || L.budget < DESPOIL_COST + 2) return null; // round 12: from the second province, 5 hops
  const home = botHomeId(G, pi);
  let best = null;
  (pl.provinces || []).forEach((id) => {
    const X = G.world.provinces[id];
    if (!X || X.owner !== pi || X.id === P.id || X.id === home || X._despoiled != null) return;
    if (X.terrain === 'sea' || String(X.race || '').startsWith('Primal') || (X.tax || 0) > 5) return;
    const d = botPathLen(G, pi, P, X.id, false);
    if (d == null || d > maxHops) return;
    const sc = d * 2 + (X.tax || 0); // the nearest, the poorest
    if (!best || sc < best.sc) best = { X, d, sc };
  });
  if (!best) return null;
  const path = botPathDirs(G, pi, P, best.X.id, maxHops, false) || [];
  if (path.length !== best.d) return null;
  L.budget -= DESPOIL_COST;
  return { X: best.X, d: best.d, path };
}
/** PROTOTYPE tactics (master list): the nearest held barrow with graves lying in it that an Undead necromancer can walk
 *  to within `maxHops` through the realm's land, to raise them there. {X, d, path}. */
export function botBarrowPlan(G, pi, c, P, L, maxHops) {
  const pl = (G.players || [])[pi];
  if (!pl || !P || (c.skills || {}).necromancy < 1) return null;
  let best = null;
  (pl.provinces || []).forEach((id) => {
    const X = G.world.provinces[id];
    if (!X || X.owner !== pi || X.id === P.id || !(X.features || []).some(isBarrow)) return;
    if ((X.battleGraves || []).length < 1) return;
    const d = botPathLen(G, pi, P, X.id, false);
    if (d == null || d > maxHops) return;
    const sc = d * 2 - (X.battleGraves || []).length;
    if (!best || sc < best.sc) best = { X, d, sc };
  });
  if (!best) return null;
  const path = botPathDirs(G, pi, P, best.X.id, maxHops, false) || [];
  if (path.length !== best.d) return null;
  return { X: best.X, d: best.d, path };
}
/** PROTOTYPE tactics (round 11): the nearest sell-swords in the realm's own land a Neutral hero can walk to within
 *  `maxHops` and hire from a chest above the hoard line. {X, d, path, toks}. */
export function botMarketPlan(G, pi, c, P, L, maxHops) {
  if (!P || L.budget < NEUTRAL_HOARD + 2) return null;
  const byProv = {};
  (G.mercenaries || []).forEach((m) => {
    if (!m || m.isSea || m.location == null || m.location === P.id) return;
    const X = G.world.provinces[m.location];
    if (!X || X.owner !== pi) return;
    (byProv[X.id] = byProv[X.id] || []).push(m);
  });
  let best = null;
  Object.keys(byProv).forEach((k) => {
    const X = G.world.provinces[Number(k)];
    const d = botPathLen(G, pi, P, X.id, false);
    if (d == null || d > maxHops) return;
    if (!best || d < best.d) best = { X, d, ms: byProv[k] };
  });
  if (!best) return null;
  const path = botPathDirs(G, pi, P, best.X.id, maxHops, false) || [];
  if (path.length !== best.d) return null;
  const toks = [];
  best.ms.forEach((m) => {
    const cost = Math.max(1, (ARMY_COST_MASTER[m.type] || 2) - 2);
    if (L.budget >= NEUTRAL_HOARD + cost) {
      L.budget -= cost;
      L.upkeep += cost;
      toks.push('merc:' + String(m.id));
    }
  });
  if (!toks.length) return null;
  return { X: best.X, d: best.d, path, toks };
}
export function botBeastMusterPlan(G, pi, c, P, L, kit, maxHops) {
  const room0 = beastCommandRoom(c, G.characters || [], protoBeastRoomExtra(G, c));
  if (!P) return null;
  const pl = (G.players || [])[pi];
  if (!pl) return null;
  const garrRoom = (X) => Math.max(0, 3 - (X.garrisonArmies || []).filter((a) => a && beastCommandCount(a)).length);
  const want = (t) =>
    beastCommandCount({ type: t, quality: 'Average', race: 'Primal' }) &&
    (kit === 'Evil') === BOT_MONSTER_ARMIES.has(t);
  let best = null;
  (pl.provinces || []).forEach((id) => {
    const X = G.world.provinces[id];
    if (!X || X.owner !== pi || X.id === P.id || !String(X.race || '').startsWith('Primal')) return;
    const kinds = (X.armyTypes || []).filter(want);
    if (!kinds.length || room0 + garrRoom(X) <= 0) return;
    const cheapest = Math.min(...kinds.map((t) => ARMY_COST_MASTER[t] || 4));
    if ((L.beastFund || 0) < cheapest && !botCanAfford(L, cheapest)) return;
    const d = botPathLen(G, pi, P, X.id, false);
    if (d == null || d > maxHops) return;
    if (!best || d < best.d) best = { X, d, kinds };
  });
  if (!best) return null;
  const path = best.d > 0 ? botPathDirs(G, pi, P, best.X.id, maxHops, false) || [] : [];
  if (path.length !== best.d) return null;
  const toks = [];
  let room = room0 + garrRoom(best.X); // beyond what he can lead, the beasts muster into that garrison (to 3)
  for (const t of best.kinds) {
    const cost = ARMY_COST_MASTER[t] || 4;
    let q = 0;
    while (room > 0 && q < 2 && botBeastFundPay(L, cost)) {
      q++;
      room--;
    }
    if (q) toks.push(t + '|' + String(q));
  }
  if (!toks.length) return null;
  return { X: best.X, d: best.d, path, toks };
}
