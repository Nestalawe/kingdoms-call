// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import {
  KC_UNIT_CLASS,
  MONSTERS_P,
  PRIMAL_ARMY_DEFS_P,
  SAGE_DISCOVERIES_P,
  TITLE_DEFS,
} from '../content/kingdoms-call-data.ts';
import {
  ARMY_COST_MASTER,
  ARMY_SPEED_MASTER,
  PRIMAL_SEA_NAMES,
  SAFE_START_TURN,
  SKILL_LABELS,
} from '../engine/army-tables.ts';
import {
  ALL_SKILLS,
  skillFameLabelM,
  topSkillOf,
} from '../engine/rules-on-plain-values/skills-in-order-and-a-heros-fame-in-words.ts';
import { marchSpeedBonus, navalSpeedBonus } from '../engine/units/movement.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
  getFlyCapability,
} from '../engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { neutralTradeGold } from '../engine/grand-design.ts';
import { twoATurn } from '../engine/world/tables.ts';
import { ABILITIES_P } from '../engine/battle/fortune.ts';
import { itemLore, wildHuntPrice } from '../engine/items/tiers-and-hoards.ts';
import { isConsecrated } from '../engine/heroes/fame-and-consecration.ts';
import { activeItems, effTemper, normaliseEquipment } from '../engine/items/equipment.ts';
import { itemSlot } from '../engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { effSkillOf, skillBonusBreakdown } from '../engine/heroes/skills-and-hp.ts';
import { lairRumourKey } from '../engine/personal-combat/helpers.ts';
import { dispFloor } from '../engine/rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { RECKONING_MIN_TURN, TITLES_PUBLIC_FROM_TURN, itemAcquiredThisTurn, perkTier } from '../engine/titles/perks.ts';
import { MAGIC_L8_SCHOOLS, castChanceFor } from '../engine/chances-and-lair-grades.ts';
import { MINOR_TITLES, _TITLE_LABEL } from '../engine/titles/reckoning.ts';
import {
  DISC_BY_ID,
  RESEARCH_HIDDEN_CATS,
  capItemTaxGold,
  discBlockedIds,
  discEffectsOf,
  discEligible,
  discExploreMult,
  discHeroWage,
  discSumOf,
  discUnitIs,
  discUnitMatch,
  discUpkeepWage,
  realmRecruitCost,
  taxBonusCap,
  taxRecordsGold,
} from '../engine/discoveries.ts';
import { TERROR_MAX_STACKS, TERROR_PCT_PER_STACK } from '../engine/battle/evil-terror.ts';

// ── EVIL TERROR: the reading (2026-10-12, Toby items 21 and 23) ── The constants (−10% a stack, at most three stacks)
// are the engine's (src/engine/battle/evil-terror.ts, plan P1-12b1), so the engine (spreadTerror, consumeTerror) and the
// report (an Evil realm sees each province's Terror on the map and in its report) read the same figures.
// terrorReadingOf(p, viewer) → {pct, stacks, byYou} or null when no Terror grips the province.
export function terrorReadingOf(p, viewer) {
  const n = Math.min(TERROR_MAX_STACKS, (p && p._terrorStacks) | 0);
  if (!(n > 0) || p._terrorTurn === undefined) return null;
  const per = typeof p._terrorPct === 'number' && p._terrorPct > 0 ? p._terrorPct : TERROR_PCT_PER_STACK;
  return { pct: Math.round(per * n * 100), stacks: n, byYou: p._terrorisedBy === viewer };
}
export function buildTurnReport(view, itsLines = null) {
  const playerIndex = view.realm;
  const player = view.me;
  const chars = view.ownHeroes.slice(); // a copy: sorted below (the view's own heroes: alive, or fallen this turn)
  // honour the player's own arrangement of their heroes (set from the orders column and kept on the
  // realm). Array.sort is stable, so heroes the arrangement does not name — newly hired, raised or
  // crowned — fall in after the named ones in engine order. This drives both the report's character
  // list and, through it, next turn's orders column.
  {
    const _ho = Array.isArray(player && player.heroOrder) ? player.heroOrder.map(String) : [];
    if (_ho.length) {
      const _rank = new Map(_ho.map((id, i) => [String(id), i]));
      chars.sort(
        (a, b) =>
          (_rank.has(String(a.id)) ? _rank.get(String(a.id)) : 1e9) -
          (_rank.has(String(b.id)) ? _rank.get(String(b.id)) : 1e9),
      );
    }
  }
  // ── TITLES: per-character holdings (Items 1 & 2). Computed once (the view's); public from turn 5. ──
  const _titlesPublic = view.titles.public;
  let _stdT = { titles: {} },
    _minT = {};
  if (_titlesPublic) {
    _stdT = { titles: view.titles.holders };
    _minT = view.titles.minor;
  }
  const ownedProvIds = view.sight.owned;

  const ownedProvinces = ownedProvincesOf(view);

  const ARMY_SPEED_P = ARMY_SPEED_MASTER; // alias → master table at top of script

  const charReports = chars.map((c) => {
    const prov = view.provinces[c.location];
    const armies = (c.armies || []).map((a) => ({
      type: a.type,
      quality: a.quality,
      speed: ARMY_SPEED_P[a.type] || 3,
      unitName: a.unitName,
      race: a.race || null,
      cost: a._temporary || a._wildHuntUntilTurn != null ? 0 : a._isSkeletal ? 1 : ARMY_COST_MASTER[a.type] || 2,
      skeletal: !!a._isSkeletal,
      temporary: !!a._temporary,
      wildHunt: a._wildHuntUntilTurn != null,
      wildHuntUntil: a._wildHuntUntilTurn != null ? a._wildHuntUntilTurn : null,
    })); // Wild Hunt tag
    // 2026-09-09e: these were read RAW, so an item granting March or Naval was left out of the
    // speed the player was shown while the engine moved them at the higher rate. Same stack as
    // setMovePool.
    // (the Crown of Command's bearer is one of the realm's own heroes beside him: its own heroes are enough to find him)
    const marchLvl = effSkillOf(c, 'march', view.ownHeroes);
    const navalLvl = effSkillOf(c, 'naval', view.ownHeroes);
    const _repPl = c.player != null ? player || null : null;
    function repSpd(a) {
      const base = a.speed || 3;
      const SEA_T = new Set(KC_UNIT_CLASS.sea);
      const FLY_T = new Set(KC_UNIT_CLASS.aerial); // every flyer, riders and winged beasts (item 14)
      if (SEA_T.has(a.type)) return base + navalSpeedBonus(base, navalLvl); // the engine's naval table (was +navalLvl)
      if (FLY_T.has(a.type)) return base;
      // Road Network (sd13) and the race/alignment `move` discoveries (Toll Roads, Caravan Roads…)
      // add to Speed 1–2 land units in the engine (computeMovePoolMax) but were missing here, so
      // the order form showed a Road-Network Dwarven Guard column at 2 while it actually marched at
      // 3.
      let _road = 0;
      if (base <= 2 && _repPl) {
        discEffectsOf(_repPl, 'move').forEach((e) => {
          if (discUnitMatch(e, a)) _road += e.extra || 0;
        });
      } // sd13 Road Network is now a `move` effect
      return base + marchSpeedBonus(marchLvl) + _road;
    }
    const SEA_UNIT_TYPES = new Set(KC_UNIT_CLASS.sea);
    // Winged units cross sea without a fleet (matches AERIAL_TYPES in the engine).
    const AERIAL_UNIT_TYPES = new Set(KC_UNIT_CLASS.aerial);
    const landArmiesRep = armies.filter((a) => !SEA_UNIT_TYPES.has(a.type));
    const seaArmiesRep = armies.filter((a) => SEA_UNIT_TYPES.has(a.type));
    const trueLandRep = armies.filter((a) => !SEA_UNIT_TYPES.has(a.type) && !AERIAL_UNIT_TYPES.has(a.type));
    let effSpd =
      armies.length === 0 ? 5 : landArmiesRep.length > 0 ? Math.min(...landArmiesRep.map((a) => repSpd(a))) : 0;
    // Sea speed: use fleets if present; else all-flying/empty forces cross by air at their land
    // speed. 2026-09-12: the squadron sails at its SLOWEST ship and a lone hero takes passage at a
    // flat 5 — both as the engine does.
    let effSeaSpd =
      seaArmiesRep.length > 0
        ? Math.min(...seaArmiesRep.map((a) => repSpd(a)))
        : armies.length === 0
          ? 5
          : trueLandRep.length === 0
            ? landArmiesRep.length > 0
              ? Math.min(...landArmiesRep.map((a) => repSpd(a)))
              : 5
            : 0;
    // ── FLYING CARRY (getFlyCapability, engine/rules-on-plain-values/) ── If the humanoid flyers can lift every
    // foot soldier in the force (1 each, nothing grounded left behind), the column takes to the
    // air: it moves at the flyers' pace (carried infantry no longer slow it) and crosses sea
    // freely. (A column all of whose units fly is not carried: it gets the flyers' pace below.)
    {
      const canFlyRep = getFlyCapability(armies) && !armies.every((a) => AERIAL_UNIT_TYPES.has(a.type));
      if (canFlyRep) {
        const flyerSpeeds = armies.filter((a) => AERIAL_UNIT_TYPES.has(a.type)).map((a) => repSpd(a));
        if (flyerSpeeds.length) {
          effSpd = Math.min(...flyerSpeeds);
          effSeaSpd = effSpd;
        }
      }
      // the force's FLYING pace for the army summary line — the slowest flyer when the whole column
      // takes to the air (all winged, or the flyers carry every foot soldier); 0 when anything is
      // left on the ground.
      var _effAirSpd = 0;
      if (armies.length > 0 && (canFlyRep || armies.every((a) => AERIAL_UNIT_TYPES.has(a.type)))) {
        const _fs = armies.filter((a) => AERIAL_UNIT_TYPES.has(a.type)).map((a) => repSpd(a));
        if (_fs.length) _effAirSpd = Math.min(..._fs);
      }
    }
    // ── PER-UNIT MOVEMENT RATE (2026-09-23, Toby item 7) ── each led unit's OWN rate, exactly as
    // computeMovePoolMax prices it: base speed + the March table (one rate for all) + Road
    // / race `move` discoveries (speed 1–2 land units) for land units; base + the Naval table for
    // sea units; flyers (riders and winged beasts) are untouched by March. Items that raise March / Naval count (repSpd reads
    // the effective skill). The Swift / Sea-Wolf minor titles add +1 to land / sea pace. The
    // COLUMN still moves at its slowest unit (and a lifted column at its flyers' pace) — that figure
    // is the header's "Land: N/turn".
    {
      const _mh = view.titles.lastTurnsMinorHoldersOfItsHeroes;
      const _swift = !!(_mh.swift && _mh.swift.charId === c.id),
        _seawolf = !!(_mh.seawolf && _mh.seawolf.charId === c.id);
      armies.forEach((a) => {
        const _sea = SEA_UNIT_TYPES.has(a.type);
        a.moveRate = repSpd(a) + (_sea ? (_seawolf ? 1 : 0) : _swift ? 1 : 0);
        a.moveKind = _sea ? 'sea' : AERIAL_UNIT_TYPES.has(a.type) ? 'air' : 'land';
      });
      // the column pace quoted in the orders header must match computeMovePoolMax, which adds the
      // Swift / Sea-Wolf +1 to the land / sea pool (whenever that pool exists). The report left
      // both out, so a Swift holder was shown one province slower than he actually marched.
      if (_swift && effSpd > 0) effSpd += 1;
      if (_seawolf && effSeaSpd > 0) effSeaSpd += 1;
    }
    return {
      id: c.id,
      name: c.name,
      isKing: c.isKing,
      race: c.race,
      alignment: c.alignment,
      temper: c.temper,
      temperEff: effTemper(c), // Item 7
      hp: c.hp,
      maxHp: c.maxHp,
      skills: c.skills || {},
      aptitude: c.aptitude || {},
      armies,
      // 2026-09-09e: the EFFECTIVE skill of each ability and where the difference comes from,
      // computed
      // by skillBonusBreakdown — the very function the engine's effStat uses — so the player's own
      // character card can show exactly the numbers the turn will be resolved with.
      skillEff: (() => {
        const out = {};
        ABILITIES_P.forEach((k) => {
          const b = skillBonusBreakdown(c, k, view.ownHeroes);
          if (b.base > 0 || b.total > 0)
            out[k] = {
              base: b.base,
              total: b.total,
              bonus: b.bonus,
              items: b.items,
              aura: b.aura,
              curse: b.curse,
              sources: b.sources,
            };
        });
        return out;
      })(),
      // Cast chance per school, exactly as the action phase will roll it (see castChanceFor).
      // Includes the flat 95% of a spell worked from an ITEM and whether a Wailing Phylactery still
      // has its free Necromancy casting in hand this turn, so the order form can quote either.
      castChance: (() => {
        const out = {};
        MAGIC_L8_SCHOOLS.forEach((sc) => {
          const r = castChanceFor(c, sc, player, { chars: view.ownHeroes });
          if (r.level > 0)
            out[sc] = {
              level: r.level,
              chance: r.chance,
              arcane: r.arcane || 0,
              mastery: r.l8 || 0,
              discovery: r.disc || 0,
            };
        });
        return out;
      })(),
      castFromItem: 95,
      // ── ORDER SUCCESS CHANCES ────
      // The odds the action phase will roll for this character, by the engine's own formulas, so an
      // order form can quote them before the turn is filed. Where an unknowable factor applies — an
      // enemy realm's counter-espionage, a guarded vault, a mentor practising alongside — the note
      // in the portal says so rather than pretending the figure is final.
      orderChance: (() => {
        const pl = player || {};
        const has = (id) => (pl.discoveries || []).some((d) => d && d.id === id);
        const eff = (k) => effSkillOf(c, k, view.ownHeroes);
        const raw = (k) => Math.max(0, Math.min(9, (c.skills || {})[k] || 0));
        const items = activeItems(c);
        const out = {};
        // SPY — 20% + 20% per level, + Forgery Arts and any spy discoveries. Automatic with a
        // Crystal Orb or at Spy 6+. An enemy's Cipher Scripts can cut it by up to 25%.
        out.spy = {
          auto: items.some((it) => it.effect && it.effect.stat === 'oracle') || raw('spy') >= 6,
          autoWhy: items.some((it) => it.effect && it.effect.stat === 'oracle')
            ? 'Crystal Orb'
            : raw('spy') >= 6
              ? 'Master Spy'
              : '',
          level: eff('spy'),
          chance: dispFloor(
            (0.2 + eff('spy') * 0.2 + discSumOf(pl, 'spy', 'pct', (e) => !e.terrains && !e.coastal)) * 100,
          ),
        }; // unscoped spy discoveries only (terrain/coastal ones depend on the target)
        // RESEARCH — Sage level x 5%, doubled for Neutral realms, + Loreseeker.
        {
          const per = 5;
          out.research = {
            level: eff('sage'),
            rawLevel: raw('sage'),
            chance:
              eff('sage') * per +
              (pl.alignment === 'Neutral' ? eff('sage') * 5 : 0) +
              (((_minT && _minT.loreseeker) || view.titles.lastTurnsMinorHoldersOfItsHeroes.loreseeker || {}).charId ===
              c.id
                ? per
                : 0) +
              discSumOf(pl, 'research', 'pct', (e) => !e.field),
          };
        }
        // ASSASSINATE (Spy 9) — 25% + 6% per RAW Spy level, cap 80, less 25 against a king.
        out.assassinate = { level: raw('spy'), chance: Math.min(80, 25 + raw('spy') * 6), kingPenalty: 25 };
        // STEAL / GRAND HEIST — the thief's own odds before the target's circumstances.
        out.steal = {
          level: eff('thief'),
          chance: Math.min(95, 50 + 10 * Math.min(eff('thief'), 5)),
          escape: Math.min(95, eff('thief') * 20),
        }; // 95% ceiling, matching the engine
        out.grandHeist = {
          level: raw('thief'),
          chance: Math.min(95, 60 + 5 * Math.max(0, raw('thief') - 5)),
          escape: Math.min(95, raw('thief') * 20),
        };
        // PRACTICE — the solo chance at each level; a peer adds half as much again, a mentor makes
        // it certain.
        out.practice = {
          byLevel: [25, 20, 15, 10, 5],
          astro: 0,
          discovery: discSumOf(pl, 'practice', 'pct', (e) => !e.skills) * 100,
          bySkill: (() => {
            const m = {};
            discEffectsOf(pl, 'practice').forEach((e) => {
              (e.skills || []).forEach((k) => {
                m[k] = (m[k] || 0) + (e.pct || 0) * 100;
              });
            });
            return m;
          })(),
        }; // sd26 is now a `practice` effect; skill-scoped practice discoveries itemised per skill
        // BLOCKADE (Naval 7) — the blockade forms half the time.
        out.blockade = { chance: 50 };
        return out;
      })(),
      necroAutoReady: !!(!c._necroAutoUsed && activeItems(c).some((it) => it.effect && it.effect.stat === 'necroAuto')),
      // EVERY bonus that is not already folded into the skill itself — minor titles and the Veteran
      // Training discovery — with the `kind` that colours it and the `scope` that says when it
      // bites. Single source: extraSkillBonuses at module level. This replaces the old hand-rolled
      // list, which knew only the four personal-combat titles and so left The Strategist's +1
      // Tactical, The Swift, The Sea-Wolf and The Loreseeker invisible.
      // Prefer this report's freshly-computed holders; fall back to the set the last turn
      // resolved with, so a character sees their own perk even before titles become public (the view works them out).
      skillExtra: view.extraSkillBonusesOfItsHeroes[c.id],
      // Kept as-is for any cached older player portal: the personal-combat subset only, same shape.
      combatSkillBonus: (() => {
        const all = view.extraSkillBonusesOfItsHeroes[c.id],
          out = {};
        Object.keys(all).forEach((sk) => {
          const only = all[sk].filter((x) => x.scope === 'combat');
          if (only.length) out[sk] = only;
        });
        return out;
      })(),
      items:
        (normaliseEquipment(c),
        (c.items || []).map((it) =>
          it ? { ...it, slot: itemSlot(it), lore: itemLore(it), acquiredThisTurn: itemAcquiredThisTurn(c, it) } : it,
        )),
      pay: c.pay || 0,
      locationId: c.location,
      locationName: prov?.name || 'Unknown',
      merits: c.merits,
      effectiveSpeed: effSpd,
      effectiveSeaSpeed: effSeaSpd,
      effectiveAirSpeed: _effAirSpd,
      hiredInPhase: c.hiredInPhase ?? -1, // -1 = was hired before this turn
      encounterPlan: c.encounterPlan || { tactics: ['ME'], notes: '' },
      alive: c.alive !== false,
      killedThisTurn: !!c.killedThisTurn, // so the report can show a fallen hero's own section
      _isHeir: !!c._isHeir,
      _pendingSkillAllocation: c._pendingSkillAllocation || 0, // royal succession skill choice
      // Titles/perks this character holds, and any won THIS turn are flagged via titles.gains.
      titlesHeld: _titlesPublic
        ? TITLE_DEFS.filter((t) => _stdT.titles[t.key] && _stdT.titles[t.key].charId === c.id).map((t) => ({
            key: t.key,
            name: t.name,
            perk: t.perk,
            req: t.req,
          }))
        : [],
      minorHeld: _titlesPublic
        ? MINOR_TITLES.filter((t) => _minT[t.key] && _minT[t.key].charId === c.id).map((t) => ({
            key: t.key,
            name: t.name,
            perk: t.perk,
            req: t.req,
          }))
        : [],
    };
  });

  // Enemy/wandering characters visible to this player (in same province as one of our chars)
  // 2026-10-15 (Toby, D1): the one sight rule decides who is listed (Invisibility and the wanderers'
  // cloak hide them here too), and another realm's hero gives away only name, realm and the rough size
  // of their army (leadsArmies says whether there is one, for Charm and Telekinetic Storm). A wandering
  // hero's race, alignment and the rest stay public, as the Hire list shows them. (The view applies the rule:
  // heroesBesideItsOwn.)
  const visibleChars = view.heroesBesideItsOwn.map((c) => ({
    id: c.id,
    name: c.name,
    locationId: c.location,
    locationName: view.provinces[c.location]?.name || '?',
    isKing: c.isKing,
    ...(c.player == null ? { race: c.race, alignment: c.alignment } : {}),
    leadsArmies: c.leadsArmies,
    armyBand: c.armyBand,
    player: c.player,
    isWandering: c.player === null,
    // Wandering heroes are unowned and public (like a hireable hero), so it is safe to surface
    // their full detail — the player portal needs it to build a Charm order card if this hero is
    // charmed into their service. Owned enemy heroes get NONE of this (no intel leak).
    // Charm-eligible heroes (unowned OR enemy) leading NO armies are surfaced in full so the player
    // portal can build a Charm order card for them. They're standing unarmed in a province where
    // you have a character — close enough for your hero to take their measure. A hero leading
    // troops isn't charmable, so gets none of this (no intel leak on a fielded commander). A hero
    // charmed last turn is closed to Charm for the whole of this one — surfaced so the order form
    // can grey them out rather than let the player spend a cast on a mind that cannot be swayed.
    charmImmune: c.charmImmune,
    // an ENEMY hero's skills are never sent — a charmer must not learn them. A wandering hero's are
    // public (the Hire list shows them), so they still travel.
    ...(c.player == null && !c.isKing && !c.leadsArmies
      ? { skills: { ...(c.skills || {}) }, temper: c.temper || null, hp: c.hp, maxHp: c.maxHp, pay: c.pay }
      : {}),
  }));

  // ── Persistent "ever seen" character intel (Clairvoyance targeting) ── AK: Clairvoyance may
  // target "any character the player has seen at any point in the game". The engine records
  // sightings into player.seenCharIntel each phase (updateProvinceMemory); the report surfaces the
  // whole record here, refreshed with anything visible right now.
  const everSeenChars = (() => {
    const rec = { ...((player && player.seenCharIntel) || {}) };
    visibleChars.forEach((v) => {
      rec[v.id] = {
        id: v.id,
        name: v.name,
        isKing: v.isKing,
        race: v.race,
        alignment: v.alignment,
        player: v.player,
        isWandering: v.isWandering,
        lastSeenTurn: view.turn,
        lastLocId: v.locationId,
        lastLocName: v.locationName,
      };
    });
    // Own characters are always "seen" but are never Clairvoyance targets worth listing — skip
    // them. Task 7(b): neutral/wandering heroes (player==null) cannot be Clairvoyance targets —
    // drop them.
    return Object.values(rec).filter((x) => {
      // alive and serving a realm now (the view says which): dead handled by the spell's dead-target report; neutrals excluded
      return view.heroesItHasSeenAliveAndServingARealm.has(x.id);
    });
  })();

  // Helper: get the single most notable skill for display (highest level; random if tie)
  // A hero who is not yours is known by reputation, not by an exact skill level. Three bands across levels 1–9:
  // skillFameLabelM (engine/rules-on-plain-values/), which the player portal shares (P1-11a4 retired its own copy),
  // so the Intelligence report, the Hire dropdown and the Broker dropdown cannot describe the same hero differently.
  function skillFameLabel(level) {
    return skillFameLabelM(level);
  }
  function topSkill(char) {
    return topSkillOf(char);
  }

  const intel = [];

  // set of provinces this player spied THIS turn. Details of armies the player does NOT control
  // (neutral guards / enemy forces) are only revealed for provinces they actually spied, making Spy
  // the sole way to learn enemy/neutral force composition.
  const spiedThisTurn = view.sight.spied;

  // enemy characters a hero may set out to Encounter. Visibility follows the intel rules — an enemy
  // is targetable if they stand in a province you OWN, a province where you have a character
  // (same-province line of sight), or a province you SPIED this turn. A character who moved
  // UNSPOTTED is hidden from passive sightings unless you spied where they now stand; a cloaked
  // (Veil / hidden-item) hero cannot be picked out at all. The Encounter order then chases the
  // quarry wherever they go, so the list need only reflect where they were last seen. Items 1 & 12:
  // the list is exactly the characters the MAP shows (one shared rule, enemyCharVisibleTo). A
  // visible character who still cannot be hunted (Cloak of Many Faces) is carried with
  // `untargetable` so the order form can show WHY instead of silently dropping them. (D2: the map's rule, next-to-spied
  // included, which the view applies: heroesItSees.)
  const encounterTargets = view.heroesItSees
    .filter((c) => c.player !== null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      isKing: !!c.isKing,
      locationId: c.location,
      locationName: view.provinces[c.location]?.name || '?',
      leadsArmy: c.leadsArmies,
      untargetable: c.untargetable,
    }));

  // Province-level intelligence (visited non-owned)
  intel.push(...linesOfTheProvincesIntelligence(view));

  // Known features across all visited/owned provinces
  const knownFeatures = knownFeaturesOf(view);

  // Provinces visible to this player: owned OR containing one of their characters
  // (declared here — used by dead-hero, mercenary, and hero-sighting intel below)
  const playerCharLocations = view.sight.heroThere;
  // a province you SPIED this turn counts as seen at END OF TURN, exactly as if you had a character
  // standing in it — your agent is still there when the season closes and reports what he finds.
  // Without this a successful Spy revealed force composition in the intel text but the hex itself
  // stayed on the border/remembered tier, which draws NO characters — so the enemy and neutral
  // heroes your spy had just walked among were missing from the map and the hero lists.
  const visibleProvIds = new Set([...ownedProvIds, ...playerCharLocations, ...spiedThisTurn]);

  // Dead heroes visible to this player — in provinces they own or have a character in Dead heroes
  // visible this turn:
  // - Own dead heroes always visible
  // - Others only if: this player saw them die this turn (seenDeadHeroIds)
  // OR had a spy/explore in that province this turn
  // (the view holds the fallen it knows of: its own, witnessed, ever known, or lying where it sees now)
  const seenThisTurn = new Set(view.me?.seenDeadHeroIds || []);
  const knownEver = new Set(view.me?.knownDeadHeroIds || []);
  const visibleDeadHeroes = view.theDeadItKnowsOf
    .filter((g) => {
      if (g.player === playerIndex) return true; // always see own dead heroes
      if (seenThisTurn.has(g.id)) return true; // witnessed the fall this turn
      // also list a fallen hero whose body lies in a province this player can see right now — you
      // know they are there because you have eyes on the ground.
      if (g.location != null && visibleProvIds.has(g.location)) return true;
      return false;
    })
    .map((g) => ({
      id: g.id,
      name: g.name,
      player: g.player,
      killedOnTurn: g.killedOnTurn,
      race: g.race || null,
      alignment: g.alignment || null,
      topSkill: topSkill(g), // the fallen keep their fame
      locationName: g.locationName || 'unknown',
      locationId: g.location,
      isOwn: g.player === playerIndex,
      isKing: !!g.isKing,
      // 2026-09-27 (Toby item 10): the realm that held this hero WHEN THEY FELL (null = neutral), and
      // whether that puts them beyond this realm's Resurrect. `player` was already on the graveyard
      // record and on the Resurrect dropdown's own list; it simply never reached the map tooltip or the
      // Fallen Heroes card, so a player could not tell whose body they were looking at.
      servedOther: g.servedOther,
      inVisibleProv: visibleProvIds.has(g.location),
    }));
  // Dead heroes this player knows of (for Resurrect targeting). 2026-09-12: the list and the MAP
  // must never disagree again. Anything the map shows as a body (visibleDeadHeroes) is listed here
  // too; entries the rules forbid raising carry raisable:false and a plain-language `whyNot`, and
  // the portal renders them greyed with the reason. Silently omitting them is what produced "I can
  // see him but he isn't in the dropdown". Inclusion = the map's rule (own / witnessed / body in a
  // province you own or stand in) PLUS every grave you have ever known of, since the engine
  // (`_graveKnown`) still lets you march back to it.
  const _mapVisibleIds = new Set(visibleDeadHeroes.map((g) => g.id));
  const knownDeadHeroes = view.theDeadItKnowsOf
    .filter(
      (g) =>
        g &&
        (g.player === playerIndex ||
          knownEver.has(g.id) ||
          seenThisTurn.has(g.id) ||
          (g.location != null && visibleProvIds.has(g.location)) ||
          _mapVisibleIds.has(g.id)),
    )
    .map((g) => {
      const locId = g.location; // a monarch's resting place is fixed at death (see monarchRestProvId)
      // Why this body may or may not be raised — mirrors the guards in `white_resurrect` exactly.
      let raisable = true,
        whyNot = '';
      if (g._monarch) {
        if (g.player !== playerIndex) {
          raisable = false;
          whyNot = 'a fallen crown answers only to its own realm';
        } else if ((view.me || {})._resurrectableMonarchId !== g.id) {
          raisable = false;
          whyNot = 'passed beyond recall — only your most recently fallen monarch may be restored';
        }
      } else if (g.isKing) {
        raisable = false;
        whyNot = 'kings cannot be resurrected';
      } else if (g.servedOther) {
        raisable = false;
        whyNot = 'once served another realm — only heroes who never served a rival crown may be raised';
      }
      return {
        id: g.id,
        name: g.name,
        killedOnTurn: g.killedOnTurn,
        race: g.race || null,
        skills: g.skills || {},
        alignment: g.alignment || 'Neutral',
        temper: g.temper || 'Brave',
        locationId: locId,
        locationName: g.locationName || 'unknown',
        isMonarch: g._monarch === true,
        isKing: !!g.isKing,
        raisable,
        whyNot,
        player: g.player != null ? g.player : null, // the realm the body served, so the form can name it
        wasOwnHero: g.player === playerIndex,
      };
    });

  // Mercenary sightings — visible if in owned province or where player has a character (the view's: where it sees now)
  const mercIntel = [];
  view.mercenariesItSees.forEach((merc) => {
    if (!visibleProvIds.has(merc.location)) return;
    const p2 = view.provinces[merc.location];
    mercIntel.push({
      id: merc.id,
      type: merc.type,
      quality: merc.quality,
      unitName: merc.unitName,
      race: merc.race || null,
      // Hire price, so the Recruit Armies order form can list mercenaries beside native units.
      // Neutral realms get 1g off (min 1g) — mirrored from the recruit handler.
      cost: Math.max(
        1,
        (ARMY_COST_MASTER[merc.type] || 2) -
          (player && player.alignment === 'Neutral' ? 2 : 0) +
          (player ? discSumOf(player, 'merc', 'delta', (e) => !e.cls || discUnitIs(e.cls, merc.type, true)) : 0),
      ), // + merc discoveries
      location: p2?.name || 'unknown',
      locationId: merc.location,
      isSea: merc.isSea,
    });
  });

  // Hero sightings — all wandering and enemy heroes visible to this player Visible if in an owned
  // province OR in a province where one of this player's characters is present

  const heroSightings = [];
  // persisted spy intel on non-own heroes: full skill sets learned via a Spy (or Clairvoyance) at
  // some point, refreshed on each new spy. Keyed by hero id.
  const spiedHeroSkills = (player && player._spiedHeroSkills) || {};
  const fmtSkills = (sk) =>
    Object.entries(sk || {})
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1] || ALL_SKILLS.indexOf(a[0]) - ALL_SKILLS.indexOf(b[0]))
      .map(([k, v]) => `${SKILL_LABELS[k] || k} ${v}`)
      .join(', ');
  // a co-located enemy/neutral hero gives away only a ROUGH idea of how many armies they lead (a
  // glance across the field, not a muster roll). Spying still reveals exact units.
  // (the view gives the rough size: armySizeBand)
  const _armyBand = (band) => 'leads ' + band;
  // Items 1 & 12: same rule as the map and the Encounter list (enemyCharVisibleTo), which the view applies: heroesItSees.
  view.heroesItSees.forEach((c) => {
    const inOwned = ownedProvIds.has(c.location);
    const prov = view.provinces[c.location];
    if (!prov) return;
    const ts = c.player === null ? c.topSkill : undefined; // (a wandering hero's fame: the view's)
    const topStr = ts ? `${skillFameLabel(ts.level)} ${SKILL_LABELS[ts.skill] || ts.skill}` : 'no notable skills';
    // If this hero has been spied, we know their FULL skill list (as of the spy).
    const spyRec = spiedHeroSkills[c.id];
    const spiedSkills = spyRec ? spyRec.skills : null;
    const spiedSkillStr = spiedSkills ? fmtSkills(spiedSkills) : null;
    const skillDisplay = spiedSkillStr ? `known skills (spied turn ${spyRec.turn}): ${spiedSkillStr}` : topStr;
    // The sighting text puts this straight after a full stop, so give it a capital.
    const skillSentence = skillDisplay.charAt(0).toUpperCase() + skillDisplay.slice(1);
    if (c.player === null) {
      // Wandering/neutral hero. the hire cost is the alignment-distance wage for THIS realm (2g
      // base +1g per two steps of alignment distance) — the same figure the hire order actually
      // charges — NOT the hero's stale internal `pay` field (which is a spawn artefact and always
      // reads ~1g). A null wage means the Divine<->Undead gulf: they will not serve this crown (the
      // sd31 waiver, if the realm holds it, is applied at the real hire). Guards keep their beast
      // label; a defeated guard now wandering (player===null, not a guard) shows a proper race (see
      // runTurn normaliser).
      const _wWage = c.isNeutralGuard ? null : c.hireWage; // 2026-10-08 item 12: sd31 waives the gulf, exactly as the hire does (the view's heroHireWage)
      const _wHireTxt = c.isNeutralGuard
        ? ''
        : _wWage != null
          ? ` Available to hire for ${_wWage}g/turn.`
          : ' Will not serve your crown — the alignment gulf is too wide.';
      heroSightings.push({
        type: c.isNeutralGuard ? 'neutral_guard' : 'wandering',
        name: c.name,
        race: c.race,
        alignment: c.alignment,
        temper: c.temper,
        locationName: prov.name,
        locationId: c.location,
        topSkill: ts,
        pay: _wWage,
        armyBand: _armyBand(c.armyBand),
        spiedSkills: spiedSkills || null,
        spiedTurn: spyRec ? spyRec.turn : null,
        spiedItems: (spyRec && spyRec.items) || null,
        spiedArmies: (spyRec && spyRec.armies) || null,
        inOwnedProvince: inOwned,
        text: `Wandering hero ${c.name} (${c.race}, ${c.alignment}) is in ${prov.name}. ${skillSentence}.${_wHireTxt}`,
      });
    } else {
      // Another realm's hero. 2026-10-15 (Toby, D1): without a Spy you learn only the name, the
      // realm and the rough size of the army they lead, wherever they stand (your own land too): no
      // race, alignment or renown. What a Spy has read (spiedSkills) is still shown.
      const enemyKingdom = c.realmName || 'unknown realm';
      const _band = _armyBand(c.armyBand);
      heroSightings.push({
        type: 'enemy',
        name: c.name,
        kingdom: enemyKingdom,
        kingdomColor: c.realmColor || null,
        locationName: prov.name,
        locationId: c.location,
        armyBand: _band,
        spiedSkills: spiedSkills || null,
        spiedTurn: spyRec ? spyRec.turn : null,
        spiedItems: (spyRec && spyRec.items) || null,
        spiedArmies: (spyRec && spyRec.armies) || null,
        inOwnedProvince: inOwned,
        text: `${c.name} of ${enemyKingdom} is in ${inOwned ? 'your province of ' : ''}${prov.name}, and ${_band}.${spiedSkillStr ? ` Known skills (spied turn ${spyRec.turn}): ${spiedSkillStr}.` : ''}`,
      });
    }
  });

  // Also add intel text entries for the chronicle
  heroSightings.forEach((s) => intel.push(s.text));

  const worldMeta = worldMetaOf(view);

  // Tax Income forecast — mirror the end-of-turn tax-collection engine so the player sees an
  // accurate projection of what they'll actually collect. We include every PERSISTENT modifier the
  // engine applies (discovery bonuses sd11/sd15/sd18, Ring of Wealth, Merchant's Ledger, Merchant
  // Guilds interest sd12, Neutral trade bonus, and any lingering _earthquakeTax reduction). We
  // deliberately do NOT fold in the two SAME-TURN transient effects (Bless Province / Earthquake
  // no-tax), since those depend on orders not yet given this turn and can't be forecast at turn
  // start.
  const hasDiscR = (id) => (player.discoveries || []).some((d) => d.id === id);
  // track each income modifier separately so the Tax Income box can itemise WHAT is lifting
  // (or cutting) the realm's revenue — mirroring the end-of-turn collection engine.
  let _sdAgri = 0,
    _sdMining = 0,
    _sdAqueduct = 0,
    _sdGrand = 0,
    _eqReduction = 0,
    _sdCreed = 0,
    _enslaveReduction = 0,
    _consecG = 0,
    _sdRecords = 0;
  let _rawTaxBase = 0;
  // 2026-09-09. The box is a NEXT-turn projection and had drifted from the collector: it ignored
  // the Enslave resentment (-1 tax for 3 turns, persistent) and every heritage / creed `tax` and
  // `interest` discovery. Any base difference shifts the floor(base x 20%) Neutral bonus by a gold
  // too. All of those are persistent, so they belong in the forecast; the deliberate omissions are
  // still only the SAME-TURN transients (Bless, Consecrate, Earthquake no-tax, Sabotage). Keep this
  // loop and the end-of-turn collector in step.
  // the 5%-of-base ceiling every tax-gold source shares. Base = the bare province tax of the land
  // held now, before any bonus or penalty — computed up front so the loop below can cap as it goes.
  // (the base and each province's discovery gold are worked out from the world: the view's books)
  const _baseTaxR = view.books.baseTax,
    _taxCapR = taxBonusCap(_baseTaxR);
  const _nextTurn = view.turn || 0; // reports are built AFTER the turn counter advances, so the turn is already the turn whose end-of-turn collection this forecasts
  const provTaxIncome = (player.provinces || []).reduce((s, pid, _i) => {
    const pv = view.provinces[pid];
    if (!pv) return s;
    let t = pv.tax || 0;
    _rawTaxBase += t; // the bare province tax, before any bonus or penalty
    // Consecrate is PERSISTENT (player.consecratedProvIds — broken only when the province changes
    // hands), not a one-turn effect, so it belongs in the forecast. Same position and rounding as
    // the collector: after Bless (a transient we still skip), before Enslave / earthquake damage.
    if (isConsecrated(player, pv.id)) {
      const _cb = t;
      t = Math.round(t * 1.5);
      _consecG += t - _cb;
    }
    if (pv._enslavedUntil != null && pv._enslavedUntil >= _nextTurn) {
      const _e0 = t;
      t = Math.max(0, t - 1);
      _enslaveReduction += _e0 - t;
    } // EVIL — Enslave resentment
    const _t0 = t;
    if (pv._earthquakeTax) t = Math.max(0, t - (pv._earthquakeTax || 0)); // lingering earthquake damage
    _eqReduction += _t0 - t; // gold lost to earthquakes (positive)
    // every province-tax discovery (Advanced Agriculture, Mining, Aqueducts … heritage & creed) now
    // runs through discTaxAdd, capped exactly as the collector caps it.
    {
      const _dt = view.books.discoveryTaxGoldOfEachOfItsProvinces[_i];
      t += _dt;
      _sdCreed += _dt;
    }
    if (view.books.wonderBlesses.Good && (pv.garrison || []).length > 0) {
      t += 2;
      _sdGrand += 2;
    } // GRAND DESIGN — Good: +2 tax per garrisoned province (only while the Wonder's province is held)
    return s + t;
  }, 0);
  const _pChars = view.ownHeroes.filter((c) => c.player === playerIndex && c.alive);
  const _itemStat = (st) =>
    _pChars.reduce(
      (s, c) => s + activeItems(c).reduce((a, it) => a + (it.effect && it.effect.stat === st ? it.effect.bonus : 0), 0),
      0,
    );
  // item tax gold (Ring of Wealth & co, Merchant's Ledger) — together capped at 5% of base tax
  const _taxBonusRaw = _pChars.reduce((s, c) => s + (c.taxBonus || 0), 0) + _itemStat('taxBonus');
  const ledgers = _pChars.some((c) => activeItems(c).some((it) => it.effect && it.effect.stat === 'taxPerProv'));
  const _perProvRaw = ledgers ? view.books.provincesItHoldsByTheirRecord : 0; // Merchant's Ledger
  const _itemTaxR = capItemTaxGold(_taxBonusRaw, _perProvRaw, _taxCapR);
  const taxBonus = _itemTaxR.taxBonus,
    perProvBonus = _itemTaxR.perProvBonus;
  const interestBonus = discEffectsOf(player, 'interest').reduce(
    (s2, e) => s2 + Math.min(_taxCapR, Math.floor((player.gold || 0) * (e.pct || 0))),
    0,
  ); // Merchant Guilds + creed interest discoveries (as collected)
  _sdRecords = hasDiscR('sd14') ? taxRecordsGold(provTaxIncome, _taxCapR) : 0; // sd14 Taxation Records — keep in step with the collector
  const neutralTradeBonus = neutralTradeGold(player, provTaxIncome);
  // title perks that add tax-season gold (mirrors the end-of-turn collection). computeStandings /
  // computeMinorTitles are module-level and already used above, so the report builder can read the
  // live holders without runTurn's G-scoped helpers. Each perk is tracked separately for
  // itemisation. 2026-09-17: `throneG` / `vaultG` REMOVED. The Throne and the Vaultkeeper once paid
  // tax-season gold; when they became pure intel titles the payout was dropped but the two
  // variables were left behind, declared at 0 and never assigned. They were still summed into
  // titlePerkGold, still shipped in the report, and still itemised by the player portal — two
  // income lines that could never print. Gone, along with their report fields.
  let cutpurseG = 0,
    championG = 0,
    castellanG = 0,
    _hostLeaderChar = null;
  try {
    if (!_titlesPublic) throw 'titles-hidden'; // Item: title perks (incl. their tax gold) take effect only once Titles are revealed at turn 5 — matching the gated end-of-turn collection.
    const _std = view.titles.holders || {};
    const _min = view.titles.minor || {};
    const _holdsTitle = (key) => !!(_std[key] && _std[key].playerIndex === playerIndex);
    const _charHasMinor = (key) => !!(_min[key] && _pChars.some((c) => c.id === _min[key].charId));
    if (_charHasMinor('cutpurse')) cutpurseG = 2;
    if (_charHasMinor('champion')) championG = 2;
    if (_charHasMinor('castellan')) {
      const _owned = view.books.provincesItHoldsByTheirRecord;
      castellanG = Math.floor(_owned / 5);
    }
    if (_charHasMinor('hostleader')) _hostLeaderChar = _pChars.find((c) => c.id === _min.hostleader.charId) || null; // wage forecast mirror
  } catch (e) {}
  const titlePerkGold = cutpurseG + championG + castellanG;
  const baseTaxIncome = provTaxIncome; // province tax after persistent modifiers (before the flat bonuses)
  const thiefStipend = _pChars.reduce((sm, ch) => sm + (perkTier(ch, 'thief') > 0 ? 5 : 0), 0); // THIEF L6: +5g income per Thief-6 character
  const taxIncome =
    provTaxIncome +
    taxBonus +
    perProvBonus +
    interestBonus +
    neutralTradeBonus +
    _sdRecords +
    titlePerkGold +
    thiefStipend;
  // Tax Income box ledger: bare base, then one line per SOURCE. Every Sage discovery that pays gold
  // (Agriculture, Mining, Aqueducts, Taxation Records, Merchant Guilds interest, heritage / creed tax
  // and interest discoveries) is rolled into ONE total. Must satisfy
  // rawTaxBase + bonuses − reductions === taxIncome (asserted by the tax ledger test).
  const sageDiscG = _sdAgri + _sdMining + _sdAqueduct + _sdCreed + _sdRecords + interestBonus;
  const ARMY_COST_TR = ARMY_COST_MASTER; // alias → master table at top of script
  const playerCharsForWages = view.ownHeroes.filter((c) => c.player === playerIndex && c.alive);
  const allArmiesForWages = playerCharsForWages.flatMap((c) => c.armies || []);
  const garrisonArmiesForWages = view.books.unitsGarrisonedInTheProvincesItHolds;
  // Build structured data for order dropdowns availableHeroes: per province, wandering heroes
  // visible to this player
  const availableHeroesByProv = availableHeroesByProvOf(view);

  const provinceOrderData = provinceOrderDataOf(view, availableHeroesByProv);

  const _druidHalfWageR = new Set();
  playerCharsForWages.forEach((ch) => {
    if (perkTier(ch, 'druid') > 0 || view.books.wonderBlesses.Druidic)
      (ch.armies || []).forEach((a) => {
        if (CREATURE_ARMIES.has(a.type) || MONSTER_ARMIES.has(a.type)) _druidHalfWageR.add(a);
      });
  }); // DRUID L6 + GRAND DESIGN Druidic (report mirror)
  const _upkAccR = new Map();
  let _discUpkeepR = 0; // `upkeep` discoveries (mirrors the collector)
  let armyWages = [...allArmiesForWages, ...garrisonArmiesForWages].reduce((s, a) => {
    if (a._temporary || a._wildHuntUntilTurn != null) return s;
    /* Wild Hunt beasts serve the old gods, not a paymaster */ if (a._isSkeletal) return s + 1;
    /* skeletons are a flat 1g everywhere */ let w = ARMY_COST_TR[a.type] || 2;
    if (_druidHalfWageR.has(a)) w = Math.max(1, Math.floor(w * 0.5));
    {
      const _w0 = w;
      w = discUpkeepWage(player, a, w, _upkAccR, _taxCapR);
      _discUpkeepR += _w0 - w;
    }
    return s + w;
  }, 0);
  // 2026-09-09. The forecast skipped three PERSISTENT discounts the collector applies — the
  // Host-Leader minor title (−1g per unit he leads, floor 0 on the total), Granaries sd17 (−1g per
  // hero) and every heritage/creed `heroWage` discovery (−Ng per hero), all with the collector's
  // max(1,…) floor. The only wage effect still left out on purpose is the same-turn Orc war-spoils
  // half-wage (depends on a battle not yet fought). Keep in step with ~17220.
  let hostLeaderG = 0;
  if (_hostLeaderChar) {
    const led = (_hostLeaderChar.armies || []).filter((a) => !a._temporary && a._wildHuntUntilTurn == null).length;
    hostLeaderG = Math.min(armyWages, led);
    armyWages = Math.max(0, armyWages - led);
  }
  const _hwAccR = new Map(); // heroWage / heroWageCap discoveries (Granaries, Inspiring Leadership, creeds) — mirrors the collector
  let heroWageDisc = 0;
  let heroWages = playerCharsForWages
    .filter((c) => !c.isKing)
    .reduce((s, h) => {
      const raw = h.pay || 0;
      const w = discHeroWage(player, h, raw, _hwAccR, _taxCapR);
      heroWageDisc += Math.max(0, raw - w);
      return s + w;
    }, 0);
  // 2026-09-10 item 3: when this report follows a resolved turn, "Your Realm" shows the wages the
  // collector ACTUALLY charged (stamped in p._lastWages) — identical to the Realm Events line by
  // construction. The roster-based figures computed above become a "next turn" note only when they
  // differ (e.g. units disbanded for non-payment, escaped units returning, skeleton rises, a new
  // heir on the payroll).
  let nextArmyWages = null,
    nextHeroWages = null,
    orcSpoilsG = 0;
  {
    const lw = player._lastWages;
    if (lw && lw.turn === (view.turn || 1) - 1) {
      if (lw.armyWages !== armyWages) nextArmyWages = armyWages;
      if (lw.heroWages !== heroWages) nextHeroWages = heroWages;
      armyWages = lw.armyWages;
      heroWages = lw.heroWages;
      hostLeaderG = lw.hostLeaderG || 0;
      heroWageDisc = lw.heroWageDisc || 0;
      orcSpoilsG = lw.orcSpoilsG || 0;
    }
  }
  theTerrorAnEvilRealmSees(view, worldMeta, ownedProvinces, intel);
  const report = {
    playerIndex,
    playerName: player.name,
    turnNumber: view.turn,
    kingdom: {
      conceded: !!player.conceded,
      eliminated: !!player._eliminated,
      gold: player.gold,
      merits: player.merits,
      taxIncome,
      baseTaxIncome,
      rawTaxBase: _rawTaxBase,
      sageDiscG,
      thiefStipend,
      taxBonus,
      perProvBonus,
      taxBonusCapG: _taxCapR,
      taxBonusCutG: _itemTaxR.cut,
      interestBonus,
      neutralTradeBonus,
      sdAgri: _sdAgri,
      sdMining: _sdMining,
      sdAqueduct: _sdAqueduct,
      sdGrand: _sdGrand,
      sdCreed: _sdCreed,
      sdRecords: _sdRecords,
      enslaveReduction: _enslaveReduction,
      earthquakeReduction: _eqReduction,
      cutpurseG,
      championG,
      castellanG,
      consecG: _consecG,
      hostLeaderG,
      heroWageDisc,
      orcSpoilsG,
      armyWages,
      heroWages,
      nextArmyWages,
      nextHeroWages,
      alignment: player.alignment,
      race: player.race,
      color: player.color,
    },
    exploreDiscMult: Object.fromEntries(
      ['plain', 'desert', 'forest', 'mountain', 'jungle', 'sea'].map((t) => [t, discExploreMult(player, t)]),
    ), // player portal explore preview
    discoveries: (player.discoveries || []).map((d) => {
      const m = DISC_BY_ID[d.id];
      return {
        id: d.id,
        name: (m && m.name) || d.name,
        category: (m && m.category) || d.category,
        desc: (m && m.desc) || d.desc,
        turnDiscovered: d.turnDiscovered,
      };
    }), // master text wins over the copy stored at discovery time
    // the Research order's category dropdown — every category this realm is eligible for, with how
    // many of its discoveries are already known (the portal greys out exhausted ones). Names and
    // effects of the discoveries themselves are never sent.
    // RESEARCH CHOICE: pairs awaiting the player's pick this turn (names and effects shown — the player found them)
    pendingDiscoveryChoices: (player.pendingDiscoveryChoices || [])
      .filter((p) => p && Array.isArray(p.options))
      .map((p) => ({
        key: p.key,
        turn: p.turn,
        charName: p.charName || '',
        category: p.category || '',
        options: p.options
          .map((id) => {
            const m = DISC_BY_ID[id];
            return m ? { id, name: m.name, category: m.category, desc: m.desc } : null;
          })
          .filter(Boolean),
      })),
    researchCategories: (() => {
      const known = new Set((player.discoveries || []).map((d) => d.id));
      discBlockedIds(player).forEach((id) => known.add(id));
      const m = {}; // forgotten / awaiting-choice discoveries count as spent for the field's tally
      SAGE_DISCOVERIES_P.filter((d) => discEligible(d, player) && !RESEARCH_HIDDEN_CATS.has(d.category)).forEach(
        (d) => {
          const e = m[d.category] || (m[d.category] = { name: d.category, total: 0, known: 0 });
          e.total++;
          if (known.has(d.id)) e.known++;
        },
      ); // hidden fields never listed
      return Object.values(m);
    })(),
    // Dead heroes — from persistent graveyard (any turn) for Resurrect targeting Any dead hero
    // visible to this player can be resurrected — except (2026-09-23) a body that ever served another realm (graveServedOther)
    deadHeroes: view.theDeadItKnowsOf
      .filter((g) => g.player === playerIndex || (visibleProvIds.has(g.location) && !g._monarch))
      .map((g) => {
        const locId = g.location;
        return {
          id: g.id,
          name: g.name,
          killedOnTurn: g.killedOnTurn,
          locationId: locId,
          isMonarch: g._monarch === true,
          wasOwnHero: g.player === playerIndex,
        };
      }),
    characters: charReports,
    ownedProvinces,
    intel,
    // the hero arrangement, so the player portal keeps it on a fresh turn even before any draft
    // exists (the orders payload is wiped after every run).
    heroOrder: Array.isArray(player && player.heroOrder) ? player.heroOrder.map(String) : [],
    // Tasks 1 & 4: colour lookups so the portal can tint EVERY realm name and character name in any
    // report line in the controlling player's colour. Realm names are public; character names are
    // limited to living (or just-fallen) NON-cloaked characters — a Cloak of Many Faces stays
    // anonymous, so nothing hidden leaks — and the portal only visibly tints names that actually
    // appear in the rendered text.
    // (the view's lookup tables: every realm, and every named hero alive or fallen this turn but the cloaked, until P2-06)
    allKingdoms: view.lookupTables.realms.map((p, i) => ({
      index: i,
      name: (p && p.name) || 'Realm ' + (i + 1),
      color: (p && p.color) || null,
    })),
    nameColors: view.lookupTables.heroes.map((c) => ({
      name: c.name,
      color: c.player != null ? c.realmColor || null : null,
      neutral: c.player == null,
      guard: !!(c.player == null && c.isNeutralGuard),
    })), // guard → chieftain-brown tint
    visitedProvinceIds: view.provinces.filter((p) => p.seen.visited).map((p) => p.id),
    worldMeta,
    availableHeroesByProv,
    provinceOrderData,
    knownFeatures,
    heroSightings,
    visibleChars,
    encounterTargets,
    everSeenChars,
    mercIntel,
    visibleDeadHeroes,
    knownDeadHeroes,
    // every province this realm knows holds battlefield graves, with the turn it was learned.
    // Deliberately stale-tolerant — the graves may since have been raised.
    graveIntel: view.graveIntel,
    // guardian weaknesses this realm has learned — by scouting one, or by watching one bite. Keyed
    // by guardian NAME, so the lesson applies to every lair holding that kind.
    knownGuardianWeaknesses: (() => {
      const known = (player && player._knownWeak) || {};
      const out = {};
      MONSTERS_P.forEach((m) => {
        if (m && m.weak && known[m.name]) out[m.name] = { name: m.weak.name, desc: m.weak.desc };
      });
      return out;
    })(),
    // ── DIPLOMACY (KC alliance system) ── realms this player has encountered, with the current
    // relation. The portal renders Treat / Declare War controls against this list (king-only).
    diplomacy: (() => {
      // (the relation between the two: the view's, for each realm it has encountered)
      const relOf = (o) => {
        if (o === playerIndex) return 'self';
        return view.realms[o]?.relation || 'neutral';
      };
      const enc = player._encountered || [];
      return {
        alliancesAllowed: view.realms.length > 3,
        safeStartUntil: view.safeStart ? SAFE_START_TURN : null,
        known: enc
          .filter((o) => o !== playerIndex && view.realms[o])
          .map((o) => ({
            index: o,
            name: view.realms[o]?.name || 'Realm ' + (o + 1),
            color: view.realms[o]?.color || null,
            alignment: view.realms[o]?.alignment || null,
            // 2026-09-27 (Toby item 7): a realm that has quit the game is no longer a party anyone can
            // treat with. The portal shows the state and withdraws every diplomacy control against it.
            conceded: !!view.realms[o]?.conceded,
            // 2026-10-08 (Toby item 3c): 'peace' / 'alliance' when this realm sent us an overture last
            // turn (see 6d in runTurn), so the card can show it beside the realm's name.
            offeredUs: ((player._overturesIn || []).find((x) => x && x.from === o) || {}).kind || null,
            concededTurn: view.realms[o]?.concededTurn || null,
            eliminated: !!view.realms[o]?.eliminated,
            relation: relOf(o),
          })),
      };
    })(),
    // ── VICTORY & TITLES ── standings board (public from turn 5), Reckoning status, and whether
    // this player may Call the Reckoning right now.
    titles: (() => {
      const turn = view.turn || 1;
      // (the standings, worked out from the whole world: the view's)
      const st = { standings: view.titles.standings, titles: view.titles.holders };
      const myShare = view.titles.blocShare;
      const _elig = view.titles.eligibility; // bloc bar + caller's own floor
      const kingAlive = view.ownHeroes.some((c) => c.alive && c.isKing && c.player === playerIndex);
      const rk = view.reckoning || null,
        over = view.gameOver || null;
      const isPublic = turn >= TITLES_PUBLIC_FROM_TURN || !!over;
      const _race = isPublic ? view.titles.race : {}; // this realm's best contender per title, as percentages only
      // ── UNMET REALMS STAY NAMELESS (2026-09-27, Toby item 3) ────────────────────────────────────
      // The Titles & Victory card listed every realm in the world by name — standings board, title
      // holders, minor titles, a title lost to a rival, the Reckoning claimant — which handed a
      // player the name of every crown in the game on the turn the titles went public, long before
      // their scouts had found any of them. The title INTEL lines have respected `_encountered`
      // since 2026-09-24 (see the `met` helper on the intel sweep); the payload did not.
      // A realm is named only once this player has met it — the same list that gates Treat /
      // Declare War, and the same list the Dispatches tab uses. An unmet realm is still counted in
      // the standings (its score and its titles are public knowledge); only its name, its
      // character's name and its colour are withheld. The ONE exception is the end-of-game board:
      // once the world is judged, every realm is revealed with the final result.
      const _metSet = new Set([playerIndex, ...(player._encountered || [])]);
      const _reveal = !!over; // game over → the whole field is named
      const _metPi = (pi) => pi == null || _reveal || _metSet.has(pi);
      const UNMET_REALM = 'An unknown realm',
        UNMET_CHAR = 'an unknown champion';
      // (the view holds a realm's name and colour once met: _metPi asks the same of the same lists)
      const _realmNm = (pi) =>
        pi == null ? null : _metPi(pi) ? view.realms[pi]?.name || 'Realm ' + (pi + 1) : UNMET_REALM;
      const _realmCol = (pi) => (pi != null && _metPi(pi) ? view.realms[pi]?.color || null : null);
      const _charNm = (pi, nm) => (!nm ? null : _metPi(pi) ? nm : UNMET_CHAR);
      return {
        publicFromTurn: TITLES_PUBLIC_FROM_TURN,
        public: isPublic,
        gains: view.titles.gains, // titles this player won this turn
        losses: view.titles.losses.map((l) =>
          l && l.newHolderIndex != null && !_metPi(l.newHolderIndex)
            ? { ...l, newHolderName: UNMET_REALM, newCharName: l.newCharName ? UNMET_CHAR : null }
            : l,
        ), // titles this player LOST this turn — a rival they have not met is not named
        // the bar THIS realm must carry — its own bloc's size raises it. The solo bar is shipped
        // alongside so the portal can say what an alliance is costing.
        threshold: _elig.threshold,
        soloThreshold: _elig.soloThreshold,
        blocSize: _elig.blocSize,
        allyStep: _elig.allyStep,
        reckoningMinTurn: RECKONING_MIN_TURN,
        myShare,
        myOwnShare: _elig.ownShare, // this realm's tax base WITHOUT its allies
        callerMin: _elig.callerMin, // the personal floor a claimant must clear
        callBlockedReason: _elig.reason, // 'tooEarly' | 'blocShort' | 'callerShort' | null
        canCallReckoning: isPublic && kingAlive && !rk && !over && _elig.ok,
        kingAlive, // Orders → Realm shows why the call is unavailable
        reckoning: rk
          ? {
              byName: _realmNm(rk.by),
              calledTurn: rk.calledTurn,
              resolveAtTurn: rk.resolveAtTurn,
              mine: rk.by === playerIndex || (rk.bloc || []).includes(playerIndex),
            }
          : null,
        gameOver: over
          ? {
              winner: over.winner,
              winnerName: over.winner != null ? view.realms[over.winner]?.name || null : null,
              byElimination: !!over.byElimination,
              byConcession: !!over.byConcession,
              byReckoning: !!over.byReckoning,
              standings: (over.standings || []).map((s) => ({
                ...s,
                titleNames: (s.titles || []).map((k) => _TITLE_LABEL[k] || k),
              })),
            }
          : null,
        standings: isPublic
          ? st.standings.map((s) => ({
              ...s,
              name: _realmNm(s.index),
              color: _realmCol(s.index),
              unmet: !_metPi(s.index),
              titleNames: (s.titles || []).map((k) => _TITLE_LABEL[k] || k),
            }))
          : null,
        holders: isPublic
          ? Object.fromEntries(
              TITLE_DEFS.map((t) => {
                const h = st.titles[t.key];
                const hcName = h.charId != null ? view.titles.heroNames.get(h.charId) : null; // (the view's)
                return [
                  t.key,
                  {
                    name: t.name,
                    prize: t.prize,
                    holderIndex: h.playerIndex,
                    holderName: _realmNm(h.playerIndex),
                    charName: _charNm(h.playerIndex, hcName),
                    unmet: h.playerIndex != null && !_metPi(h.playerIndex),
                    kingdomLevel: !!t.kingdomLevel,
                    req: t.req,
                    perk: t.perk,
                    mine: h.playerIndex === playerIndex,
                    race: _race[t.key] || null,
                  },
                ];
              }),
            )
          : null,
        minor: isPublic
          ? (() => {
              const mh = view.titles.minor;
              const all = MINOR_TITLES.map((t) => {
                const h = mh[t.key];
                const holderName = h ? view.titles.heroNames.get(h.charId) : null; // (the view's)
                const _pi = h ? h.playerIndex : null;
                return {
                  key: t.key,
                  name: t.name,
                  perk: t.perk,
                  req: t.req,
                  holderName: _charNm(_pi, holderName),
                  kingdomName: _realmNm(_pi),
                  unmet: _pi != null && !_metPi(_pi),
                  holderIndex: _pi,
                  mine: !!(h && h.playerIndex === playerIndex),
                };
              });
              return { all, mine: all.filter((x) => x.mine) };
            })()
          : null,
      };
    })(),
    // Which GM build wrote this report. The player portal shows it when a feature the report should
    // carry is missing (e.g. the title-race percentages, added in v2026.09.20-0153), so a stale
    // uploaded GM portal is visible at a glance instead of looking like a player-portal bug. The page
    // fills it in, here in its place (P1-18d): the turn shell (src/ui/gm/turn-shell.ts) and Turn 0.
    engineStamp: null,
    // 2026-09-23 (Toby item 6): prices the orders-column spending tracker needs and the player portal
    // has no table for — each unit type's per-turn WAGE (its recruit price after this realm's
    // `upkeep` discoveries; skeletal units are a flat 1g) and the Harvest the Field price, as the engine
    // charges them. (The Awaken the Wild surcharge went with the order, 2026-10-12.)
    orderPrices: (() => {
      const unitWage = {};
      Object.keys(ARMY_COST_MASTER).forEach((t) => {
        unitWage[t] = discUpkeepWage(player, { type: t }, ARMY_COST_MASTER[t] || 2, new Map(), _taxCapR);
      });
      return {
        unitWage,
        unitCost: { ...ARMY_COST_MASTER },
        harvest: Math.max(0, 2 + discSumOf(player, 'harvestCost', 'delta')),
        brokerSpy: 2,
      };
    })(),
    lastTurnLog: [{ type: 'system', text: `Turn ${view.turn} begins. ${player.name} stands ready.` }],
  };
  if (itsLines) withWhatItsLinesShow(report, view, itsLines);
  return report;
}

// ── THE MAP AND THE PROVINCES (plan P1-12b4: P1-12's Decision 11, part 1) ────
// The report's sections of the map and the provinces, each built only from what the realm may see of the world: its
// view (playerView, src/views/what-each-realm-may-see-of-the-world.ts), never the world itself. Each statement is as
// it was in buildTurnReport, reading the view's province (and the realm, view.me) where it read the world; the sight
// rules and the engine's helpers that read the whole world are the view's. view.realm is the realm reading.

// The realm's own provinces, in full (with the heroes it sees in them, as its map does).
function ownedProvincesOf(view) {
  const playerIndex = view.realm;
  return view.provinces
    .filter((p) => p.seen.owned)
    .map((p) => ({
      id: p.id,
      name: p.name,
      terrain: p.terrain,
      tax: p.tax,
      race: p.race,
      population: p.population,
      owner: p.owner, // the Steal form needs to know whose garrison stands here (paymaster target)
      // Only show features that have been discovered based on exploration threshold At 100% explored
      // all features visible; threshold = 100/totalFeatures per feature
      features: (() => {
        return p.features
          .map((f) => {
            const known = f.discovered;
            // a ritual site in your OWN province is always visible — you hold the ground and know your
            // own standing stones. Other features still follow the explore-threshold reveal.
            const canSee = known || f.revealedByExploring || !!f.ritualSite;
            if (!canSee) return null;
            return {
              name: f.name,
              discovered: canSee,
              cleared: f.cleared,
              ritualSite: !!f.ritualSite,
              monsterPower: f.monsterPower || f.tier || '',
              monsterCat: f.monsterCat,
              treasure: known ? f.treasure : null,
            };
          })
          .filter(Boolean);
      })(),
      neutralDefenders: (() => {
        // Get armies from the neutral guard hero if one exists, otherwise fall back to province array
        const defs = p.neutralGuard.armies;
        return defs.map((d) => ({ type: d.type, quality: d.quality, unitName: d.unitName || '' }));
      })(),
      neutralGuard: (() => {
        const ng = p.neutralGuard.leader;
        return ng ? { id: ng.id, name: ng.name, race: ng.race, skills: ng.skills } : null;
      })(),
      armyTypes: p.armyTypes,
      // Unled (garrisoned) armies the player keeps in this province — recruited directly to the
      // garrison, or left behind here by one of their characters.
      garrisonArmies: p.garrison.map((a) => ({
        type: a.type,
        quality: a.quality,
        unitName: a.unitName || '',
        race: a.race || null,
        skeletal: !!a._isSkeletal,
        wildHunt: a._wildHuntUntilTurn != null,
        wildHuntUntil: a._wildHuntUntilTurn != null ? a._wildHuntUntilTurn : null,
        // 2026-09-23 (item 7): an unled unit's own pace — base speed plus the realm's Road / `move`
        // discoveries for a speed-1/2 land unit (no commander, so no March, Naval or title bonus).
        ...a.movement,
      })),
      grandDesign: p.grandDesign
        ? {
            name: p.grandDesign.name,
            ownerName: p.grandDesign.ownerRealmName || null,
            active: p.grandDesign.active,
          }
        : null, // Wonder of the age
      explored: p.explored || 0,
      // the heroes it sees here (the map's sight rule: the view's list)
      characters: p.heroesItSeesInItsOwnProvince
        .map((c) => {
          // A fallen character is shown ONLY by the ☠ marker (from visibleDeadHeroes), never as a
          // living character circle. This owned-province list omitted the c.alive filter that
          // liveChars() applies, so a corpse lying in your own province drew a second, colourless
          // (grey) character icon on top of its skull. Filter the dead out here to match liveChars().
          // 2026-09-09: carry the SAME fields as the worldMeta liveChars() list (owner name/colour,
          // wanderer/chieftain flags, army count). The portal now keeps the worldMeta list; this is
          // belt-and-braces.
          // (the view's list holds the living only: the dead are shown by the ☠ marker alone, as before)
          const _own = c.player === playerIndex;
          return {
            id: c.id,
            name: c.name,
            isOwn: _own,
            isKing: c.isKing,
            isWanderer: c.player === null,
            isNeutralGuard: c.isNeutralGuard,
            ownerName: c.player != null && !_own ? c.realmName || null : null,
            armyCount: c.armyCount,
            ownerColor: c.player !== null ? c.realmColor : null,
          };
        })
        .filter(Boolean),
    }));
}

// The province-level lines of the realm's intelligence: each province it has visited and doesn't hold.
function linesOfTheProvincesIntelligence(view) {
  const playerIndex = view.realm;
  const intel = [];
  view.provinces
    .filter((p) => p.seen.visited && !p.seen.owned)
    .forEach((p) => {
      if (p.owner !== null && p.owner !== playerIndex)
        // The realm that holds it is named once this realm has met it (R-046).
        intel.push(`${p.name} (${p.terrain}): controlled by ${p.theOwnersNameOnceItHasMetThem || 'an unknown realm'}.`);
      const guardNPC = p.neutralGuard.leader;
      const guardArmyCount = p.neutralGuard.armyCount;
      if (guardArmyCount > 0) {
        const guardLabel = guardNPC ? `${guardNPC.name} leads: ` : '';
        if (p.seen.spied) {
          // Spied this turn → full force composition revealed.
          const guardArmies = p.neutralGuard.armies;
          intel.push(
            `${p.name}: ${guardLabel}${guardArmies.length} neutral defender${guardArmies.length > 1 ? 's' : ''} — ${guardArmies.map((d) => (d.unitName ? `${d.unitName} (${d.type}, ${d.quality})` : `${d.quality} ${d.type}`)).join(', ')}. 🔍`,
          );
        } else {
          // Not spied → only the count is known; composition is hidden until spied.
          intel.push(
            `${p.name}: ${guardLabel}${guardArmyCount} neutral defender${guardArmyCount > 1 ? 's' : ''} (composition unknown — Spy this province to reveal).`,
          );
        }
      }
    });
  return intel;
}

// Known features across all visited and owned provinces, and those a hero of its own stands in.
function knownFeaturesOf(view) {
  const knownFeatures = [];
  // A discovered feature under one of your OWN characters must appear even when the province is
  // neither owned nor previously-visited (e.g. a Pagan hero standing on a discovered ritual site in
  // unowned land) — otherwise the site shows on the map but not in the report or order forms.
  view.provinces
    .filter((p) => p.seen.visited || p.seen.owned || p.seen.heroThere)
    .forEach((p) => {
      const _rum = (view.me || {})._lairRumours || {};
      p.features.forEach((f) => {
        const _fi = f.index;
        if (!(f.discovered || (p.seen.owned && !!f.ritualSite))) return;
        knownFeatures.push({
          province: p.name,
          name: f.name,
          cleared: f.cleared,
          rumour: (!f.cleared && _rum[lairRumourKey(p.id, _fi)]) || null, // hoard learned by Hunting Rumours
          ritualSite: !!f.ritualSite,
          monster: f.ritualSite ? '' : f.monsterName || 'unknown guardian',
          monsterCat: f.ritualSite ? '' : f.monsterCat,
          monsterPower: f.monsterPower || f.tier || '',
          isOwned: p.seen.owned,
        });
      });
    });
  return knownFeatures;
}

// World meta: the map, every hex of the grid with what this realm sees of it (owned, live, border, remembered,
// unknown).
function worldMetaOf(view) {
  const playerIndex = view.realm;
  // ── tiered map visibility (last-seen fog of war) ──
  // the character this realm watches with Clairvoyance is drawn wherever they end the turn —
  // including border and remembered hexes (which otherwise never show characters) and a never-seen
  // hex.
  const _clairChar = view.watchedByClairvoyance ? view.watchedByClairvoyance.hero : null;
  const { cols, rows } = view.map;
  // World meta — full hex grid with visibility-appropriate data for map rendering
  return {
    cols,
    rows,
    centreCol: view.map.centreCol,
    provinces: view.provinces.map((p) => {
      // neighbour IDs for the map renderer (the view's: the hex grid, wrapping east to west)
      const neighbors = p.neighbours;

      const isOwned = p.seen.owned;
      // a spied province is drawn at the LIVE tier — full current info and line-of-sight
      // characters. liveChars() still filters every non-own character through enemyCharVisibleTo,
      // which already treats a deliberate Spy as piercing stealth, so this changes WHICH HEXES draw
      // characters, never WHO is visible within one.
      const isLive = !isOwned && (p.seen.heroThere || p.seen.spied); // character here now, or spied this turn
      const isBorder = !isOwned && !isLive && p.seen.nextToOwned; // adjacent to your own land
      const memo = p.remembered;
      // Illusory Terrain: enemies of the caster see a false terrain until they enter or it fades.
      const _apparentTerrain = p.terrainAsItLooks;
      const explored = p.explored || 0;
      // does THIS player lead an army here right now? Computed straight from character locations
      // (c.location), so the field-banner never depends on prov.characters staying in sync — a king
      // or hero leading troops always flies a flag wherever they actually stand.
      const _ownArmyHere = p.ownArmyHere;
      // Live-visible characters here: own characters always; enemy/neutral only where this player
      // currently has a character present. Enemy units/characters are NEVER shown as "last seen" —
      // only when visible at the end of the turn (line of sight).
      // Line of sight: a non-own character is visible only where you have a character (co-location) or
      // you OWN the province (your garrison/subjects report anyone in your land). Items 1 & 12: the map,
      // the hero lists and the Encounter target list all use the ONE rule in enemyCharVisibleTo (line of
      // sight, Invisibility, Spy pierce, Spy-contest in owned land, flat unspotted cloak elsewhere): the
      // view applies it (heroesOnTheMap).
      const liveChars = () =>
        p.heroesOnTheMap
          .map((c) => {
            const isOwn = c.player === playerIndex;
            return {
              id: c.id,
              name: c.name,
              isOwn,
              isKing: c.isKing,
              isWanderer: c.player === null,
              // A neutral character is either the sworn guardian of this province ("local chieftain")
              // or a masterless hero passing through ("wandering"). The portal needs the distinction to
              // label them correctly — they are otherwise indistinguishable client-side.
              isNeutralGuard: c.isNeutralGuard,
              ownerName: c.player != null && !isOwn ? c.realmName || null : null,
              // 2026-10-15 (Toby, D1): your own hero's exact count; anyone else's rough size only
              ...(isOwn ? { armyCount: c.armyCount } : { armyBand: c.armyBand }),
              ownerColor: c.player !== null ? c.realmColor : null,
            };
          })
          .filter(Boolean);
      const _clairCharsHere = () =>
        _clairChar && p.seen.watchedHeroThere
          ? [
              {
                id: _clairChar.id,
                name: _clairChar.name,
                isOwn: false,
                isKing: _clairChar.isKing,
                isWanderer: _clairChar.player === null,
                isNeutralGuard: _clairChar.isNeutralGuard,
                ownerName: _clairChar.player != null ? _clairChar.realmName || null : null,
                armyBand: _clairChar.armyBand,
                ownerColor: _clairChar.player !== null ? _clairChar.realmColor : null,
                clairvoyant: true,
              },
            ]
          : [];

      if (isOwned) {
        // Full live info — your own province.
        return {
          id: p.id,
          row: p.row,
          col: p.col,
          name: p.name,
          terrain: p.terrain,
          tier: 'owned',
          isHomeCapitalOfOwner: p.isHomeCapitalOfOwner, // Grand Heist needs to know a capital when it sees one
          tax: p.tax,
          wealth: p.tax >= 7 ? 'Rich' : p.tax >= 4 ? 'Prosperous' : 'Poor',
          ownArmyHere: _ownArmyHere,
          consecrated: isConsecrated(view.me, p.id), // DIVINE — Consecrate: mark the realm's holy ground so the player can confirm it is active
          hadBattle: !!p.hadBattleThisTurn,
          hadCombat: p.thisRealmFoughtHere,
          battleUnresolved: !!p.battleUnresolved /* item 14 */,
          race: p.race,
          owner: p.owner,
          ownerName: p.owner !== null ? p.ownerRealmName : null,
          ownerColor: p.owner !== null ? p.ownerRealmColor : null,
          armyTypes: p.armyTypes,
          neighbors,
          explored,
          features: p.features
            .filter((f) => f.discovered)
            .map((f) => ({
              name: f.name,
              cleared: !!f.cleared,
              ritualSite: !!f.ritualSite,
              power: f.monsterPower || '',
            })),
          grandDesign: p.grandDesign
            ? {
                name: p.grandDesign.name,
                ownerName: p.grandDesign.ownerRealmName || null,
                active: p.grandDesign.active,
              }
            : null, // a Wonder of the age is visible to anyone who can see the province
          characters: liveChars(),
          ownArmyHere: _ownArmyHere,
        };
      } else if (isLive) {
        // You have a character standing here right now — full current info + line-of-sight
        // characters.
        return {
          id: p.id,
          row: p.row,
          col: p.col,
          name: p.name,
          terrain: _apparentTerrain,
          tier: 'live',
          race: p.race,
          isHomeCapitalOfOwner: p.isHomeCapitalOfOwner, // Grand Heist eligibility
          wealth: p.tax >= 7 ? 'Rich' : p.tax >= 4 ? 'Prosperous' : 'Poor',
          consecrated: p.consecrated, // holy ground is visible to anyone who can see the province
          owner: p.owner,
          ownerName: p.owner !== null ? p.ownerRealmName : null,
          ownerColor: p.owner !== null ? p.ownerRealmColor : null,
          armyTypes: p.armyTypes,
          neighbors,
          explored,
          hadBattle: !!p.hadBattleThisTurn,
          hadCombat: p.thisRealmFoughtHere,
          battleUnresolved: !!p.battleUnresolved /* item 14 */,
          features: p.features
            .filter((f) => f.discovered)
            .map((f) => ({
              name: f.name,
              cleared: !!f.cleared,
              ritualSite: !!f.ritualSite,
              power: f.monsterPower || '',
            })),
          grandDesign: p.grandDesign
            ? {
                name: p.grandDesign.name,
                ownerName: p.grandDesign.ownerRealmName || null,
                active: p.grandDesign.active,
              }
            : null, // a Wonder of the age is visible to anyone who can see the province
          characters: liveChars(),
          ownArmyHere: _ownArmyHere,
          // a character standing here sees the standing garrison, whoever owns it — the map pop-up
          // reports how many units are garrisoned (type and quality only).
          garrisonArmies: p.garrison.map((a) => ({
            type: a.type,
            quality: a.quality,
            unitName: a.unitName || '',
          })),
        };
      } else if (isBorder) {
        // Adjacent to your land: current core info + CURRENT ownership. No enemy units/characters.
        return {
          id: p.id,
          row: p.row,
          col: p.col,
          name: p.name,
          terrain: _apparentTerrain,
          tier: 'border',
          race: p.race,
          isHomeCapitalOfOwner: p.isHomeCapitalOfOwner, // crown marker
          wealth: p.tax >= 7 ? 'Rich' : p.tax >= 4 ? 'Prosperous' : 'Poor',
          consecrated: p.consecrated, // holy ground is visible to anyone who can see the province
          owner: p.owner,
          ownerName: p.owner !== null ? p.ownerRealmName : null,
          ownerColor: p.owner !== null ? p.ownerRealmColor : null,
          armyTypes: p.armyTypes,
          neighbors,
          explored,
          hadBattle: !!p.hadBattleThisTurn,
          hadCombat: p.thisRealmFoughtHere,
          battleUnresolved: !!p.battleUnresolved /* item 14 */,
          features: p.features
            .filter((f) => f.discovered)
            .map((f) => ({
              name: f.name,
              cleared: !!f.cleared,
              ritualSite: !!f.ritualSite,
              power: f.monsterPower || '',
            })),
          grandDesign: p.grandDesign
            ? {
                name: p.grandDesign.name,
                ownerName: p.grandDesign.ownerRealmName || null,
                active: p.grandDesign.active,
              }
            : null, // a Wonder of the age is visible to anyone who can see the province
          characters: p.seen.nextToSpied ? liveChars() : _clairCharsHere(),
          ownArmyHere: _ownArmyHere, // D2: next to a spied province
        };
      } else if (memo) {
        // Remembered: frozen at the last phase one of your characters could see it. Core info and
        // ownership are as last observed (may be out of date); no live units/characters shown.
        return {
          id: p.id,
          row: p.row,
          col: p.col,
          name: memo.name,
          terrain: memo.terrain,
          tier: 'remembered',
          race: memo.race,
          wealth: memo.tax >= 7 ? 'Rich' : memo.tax >= 4 ? 'Prosperous' : 'Poor',
          owner: memo.owner,
          ownerName: memo.ownerName ?? null,
          ownerColor: memo.ownerColor ?? null,
          armyTypes: memo.armyTypes || [],
          neighbors,
          explored,
          seenTurn: memo.turn,
          isHomeCapitalOfOwner: !!memo.isHomeCapitalOfOwner, // crown marker, as it stood when last observed
          // hadCombat is NOT sent on the remembered tier. All three sword markers — red (battle),
          // orange (battle still raging) and purple (personal combat) — now share exactly one
          // visibility rule: owned, live or border.
          features: memo.features || [],
          characters: p.seen.nextToSpied ? liveChars() : _clairCharsHere(),
          ownArmyHere: _ownArmyHere, // D2: next to a spied province
        };
      } else {
        // Unknown — just the grid position so we can draw an empty hex.
        // 2026-10-15 (D2): next to a spied province, the characters there are seen as if a hero stood
        // there, so the hex is drawn as the Clairvoyant's is, with the ground as it now stands.
        const _nearChars = p.seen.nextToSpied ? liveChars() : [];
        if (_nearChars.length) {
          return {
            id: p.id,
            row: p.row,
            col: p.col,
            name: p.name,
            terrain: _apparentTerrain,
            tier: 'remembered',
            race: p.race,
            wealth: p.tax >= 7 ? 'Rich' : p.tax >= 4 ? 'Prosperous' : 'Poor',
            owner: p.owner,
            ownerName: p.owner !== null ? p.ownerRealmName : null,
            ownerColor: p.owner !== null ? p.ownerRealmColor : null,
            armyTypes: p.armyTypes || [],
            neighbors,
            explored,
            seenTurn: view.turn,
            isHomeCapitalOfOwner: p.isHomeCapitalOfOwner,
            features: [],
            characters: _nearChars,
            ownArmyHere: _ownArmyHere,
          };
        }
        if (_clairChar && p.seen.watchedHeroThere) {
          // Never seen by this realm, but the Clairvoyant sees through the watched character's
          // eyes.
          return {
            id: p.id,
            row: p.row,
            col: p.col,
            name: p.name,
            terrain: _apparentTerrain,
            tier: 'remembered',
            race: p.race,
            wealth: p.tax >= 7 ? 'Rich' : p.tax >= 4 ? 'Prosperous' : 'Poor',
            owner: p.owner,
            ownerName: p.owner !== null ? p.ownerRealmName : null,
            ownerColor: p.owner !== null ? p.ownerRealmColor : null,
            armyTypes: p.armyTypes || [],
            neighbors,
            explored,
            seenTurn: view.turn,
            isHomeCapitalOfOwner: p.isHomeCapitalOfOwner, // crown marker
            features: [],
            characters: _clairCharsHere(),
            ownArmyHere: _ownArmyHere,
          };
        }
        return { id: p.id, row: p.row, col: p.col, terrain: null, tier: 'unknown', neighbors };
      }
    }),
  };
}

function availableHeroesByProvOf(view) {
  // Build structured data for order dropdowns availableHeroes: per province, wandering heroes
  // visible to this player
  const availableHeroesByProv = {};
  view.provinces.forEach((p) => {
    // use the SAME visibility rule as the map / Wandering Heroes sightings — a province you OWN or
    // where one of your characters stands right now, and never a hero who moved unspotted /
    // invisible this turn (Items 1 & 12: one rule, which the view applies: wanderersItCouldHire).
    const provHeroes = p.wanderersItCouldHire;
    if (provHeroes.length > 0) {
      availableHeroesByProv[p.id] = provHeroes.map((h) => ({
        id: h.id,
        name: h.name,
        race: h.race,
        alignment: h.alignment,
        temper: h.temper,
        topSkill: h.topSkill,
        pay: h.pay || 1, // 2026-09-24 (Toby item 8): fame only — the full skill list no longer ships, so the order form cannot leak it
        // 2026-10-08 (Toby item 12): what hiring this hero will actually cost THIS realm — alignment
        // distance AND the skill premium, with sd31's waiver — the same figure the Wandering Heroes
        // report quotes and the hire charges. null: will not serve this crown. The order form used to
        // work the price out from alignment alone, so it quoted less than the report for any hero
        // who had grown while wandering.
        hireWage: h.hireWage,
        locationId: p.id,
        locationName: p.name,
      }));
    }
  });
  return availableHeroesByProv;
}

// provinceOrderData: per-province data needed for order dropdowns
function provinceOrderDataOf(view, availableHeroesByProv) {
  const provinceOrderData = {};
  // also expose provinces ADJACENT to owned/visited ones — the map already shows these neighbours
  // and their recruitable units, so a player may queue a conditional recruit that only fires if
  // they capture the province this turn. canRecruit stays false until owned.
  view.provinces
    .filter((p) => p.seen.owned || p.seen.visited || p.seen.nextToOwnedOrVisited || p.seen.heroThere)
    .forEach((p) => {
      const ARMY_COST_OD = ARMY_COST_MASTER; // alias → master table at top of script
      const isOwned = p.seen.owned;
      const isVisited = p.seen.visited;
      const isAdjacent = p.seen.nextToOwnedOrVisited;
      const isHome = isOwned && p.foundedByThisRealm; // 2026-09-24 (Toby item 10): the FOUNDER's own capital, still held — a captured rival seat is not 'home'
      provinceOrderData[p.id] = {
        name: p.name,
        terrain: p.terrain,
        race: p.race,
        tax: p.tax,
        isOwned,
        isVisited,
        isAdjacent,
        isHome,
        // the Explore order note reads pd.explored, but this builder never emitted it — so the orders
        // section always showed "0% mapped" while the map pop-up
        // (worldMeta, which DOES carry it) showed the true figure. Same per-player source as the map:
        // exploredBy[playerIndex], never the legacy shared p.explored (that holds whichever player
        // explored the province most recently, so it leaks/misreports across realms).
        explored: p.explored || 0,
        // Rite of the Wild Hunt: resolve the type the ENGINE will bind (first primal type in the
        // province's pool) and its price — the cost of ONE beast — so the player's order form
        // displays exactly what will be charged instead of re-deriving it and drifting.
        wildHuntType: (p.armyTypes || []).find((t) => PRIMAL_ARMY_DEFS_P[t]) || null,
        wildHuntCost: (() => {
          const t = (p.armyTypes || []).find((x) => PRIMAL_ARMY_DEFS_P[x]);
          return t ? wildHuntPrice(t) : null;
        })(),
        canRecruit: isOwned,
        // Primal sea beasts are only offered where they can actually be summoned: at sea.
        armyTypes: (p.armyTypes || [])
          .filter((at) => !(PRIMAL_SEA_NAMES.has(at) && p.terrain !== 'sea'))
          .map((at) => ({
            type: at,
            cost: realmRecruitCost(view.me, at, ARMY_COST_OD[at] || 2), // realm discounts shown in the preview
            maxPerTurn: twoATurn(at) || isHome ? 2 : 1, // the same gate as getRecruitLimit (garrisons, fleets, Goblin Hordes; two of anything at the founder's capital)
          })),
        features: (() => {
          return p.features
            .filter((f) => {
              if (f.cleared) return false;
              return f.discovered || f.revealedByExploring || (isOwned && !!f.ritualSite);
            })
            .map((f) => ({
              name: f.name,
              idx: f.index,
              ritualSite: !!f.ritualSite,
              monsterPower: f.monsterPower || f.tier || '',
              monster: f.monsterName || '',
              monsterCat: f.monsterCat,
            }));
        })(),
        availableHeroes: availableHeroesByProv[p.id] || [],
        // don't leak an ADJACENT enemy province's garrison composition — only owned/visited provinces
        // (which already exposed it) carry garrison detail; adjacent-only entries exist purely to
        // surface recruitable unit TYPES for a conditional recruit.
        garrisonArmies:
          isOwned || isVisited
            ? p.garrison.map((a) => ({
                type: a.type,
                quality: a.quality,
                unitName: a.unitName || '',
                race: a.race || null,
                skeletal: !!a._isSkeletal,
                wildHunt: a._wildHuntUntilTurn != null,
                wildHuntUntil: a._wildHuntUntilTurn != null ? a._wildHuntUntilTurn : null,
              }))
            : [],
      };
    });
  return provinceOrderData;
}

function theTerrorAnEvilRealmSees(view, worldMeta, ownedProvinces, intel) {
  const playerIndex = view.realm;
  // EVIL sees the Terror (2026-10-12, Toby item 23): every province of the map that Terror grips carries its
  // reading, the realm's own provinces in the report's list too, and a province it has visited but does not hold
  // gets an intel line. No other crown is told.
  if ((view.me && view.me.alignment) === 'Evil') {
    const _tr = (id) => terrorReadingOf(view.provinces[id]?.terror, playerIndex);
    (worldMeta.provinces || []).forEach((r) => {
      if (!r) return;
      const t = _tr(r.id);
      if (t) r.terror = t;
    });
    (ownedProvinces || []).forEach((r) => {
      if (!r) return;
      const t = _tr(r.id);
      if (t) r.terror = t;
    });
    view.provinces
      .filter((p) => p && p.seen.visited && !p.seen.owned)
      .forEach((p) => {
        const t = _tr(p.id);
        if (t)
          intel.push(
            `${p.name}: 💀 Terror ${t.pct}% (${t.stacks} stack${t.stacks !== 1 ? 's' : ''}${t.byYou ? ', your own' : ''}) — its next defenders fight at −${t.pct}%.`,
          );
      });
  }
}

// ── WHAT THE REALM'S LINES SHOW (plan P1-12b5: out of buildReports) ────
// A report built after a turn (buildReports, src/views/every-realms-report-and-the-lines-each-realm-reads.ts) gets the
// realm's lines of the turn (playerEvents' result) beside its view: its battle markers, its province intelligence, its
// spy activity, its chronicle and its province events, each named from the view. A report built with no turn (Turn 0,
// the tests' staged worlds) has none of these.
function withWhatItsLinesShow(report, view, itsLines) {
  const { lastTurnLog, provinceEvents: provinceEventsItReads, spyActivity } = itsLines;
  // The map's battle markers: a battle this realm witnessed (the view says which, from its lines).
  (report.worldMeta?.provinces || []).forEach((pv) => {
    if (!pv) return;
    const _seenHere = view.provinces[pv.id];
    const _witnessed = !!_seenHere?.seen.witnessedABattle;
    const realBattle = !!_seenHere?.hadBattleThisTurn;
    pv.hadBattle = realBattle && _witnessed;
    // the ORANGE ongoing-battle marker (battleUnresolved) was set unconditionally in
    // buildTurnReport and never visibility-gated, so a carry-on fight anywhere on the map lit up
    // for every player. Restrict it to a battle this player can actually witness, exactly like
    // the crossed-swords marker above.
    if (pv.battleUnresolved) pv.battleUnresolved = _witnessed;
  });

  report.provinceCharIntel = provinceCharIntelOf(view);

  report.spyActivity = spyActivity;
  report.lastTurnLog = lastTurnLog;
  // each province event with its province's name, as the realm's view has it
  report.provinceEvents = provinceEventsItReads.map((e) => ({
    ...e,
    provName: e.provinceId != null && view.provinces[e.provinceId] ? view.provinces[e.provinceId].name : null,
  }));
}

// ── Province character intel (Intelligence → Province Reports) ── (plan P1-12b4: out of buildReports, reading only the
// realm's view, src/views/what-each-realm-may-see-of-the-world.ts; P1-12b5: here, with the rest of the report)
// For each province the player has visibility into (a character present at end of turn, or a
// Spy action there this turn), list the characters they can see (own / neutral / enemy) with
// the NUMBER of army units each leads. Actual unit types/qualities are only revealed for a
// province this player SPIED this turn (own characters' armies are always known).
function provinceCharIntelOf(view) {
  const pi = view.realm;
  const provinceCharIntel = [];
  view.provinces.forEach((p) => {
    const spied = p.seen.spiedByItsLines;
    const hasPresence = p.seen.heroThere;
    if (!hasPresence && !spied) return; // no line of sight and not spied → no intel
    // 2026-10-15 (D1): the one sight rule, as the map and the hero sightings use it (Invisibility,
    // a Spy piercing stealth, another realm's hero always seen beside yours, the wanderers' cloak):
    // the view applies it (heroesInItsProvinceIntelligence).
    const visible = p.heroesInItsProvinceIntelligence;
    if (visible.length === 0) return;
    // Only surface as an intel entry if there is a non-own character present, or the player spied
    // it.
    if (!visible.some((c) => c.player !== pi) && !spied) return;
    const _spiedSkillsPi = (view.me && view.me._spiedHeroSkills) || {};
    const characters = visible.map((c) => {
      const category = c.player === pi ? 'own' : c.player === null ? 'neutral' : 'enemy';
      // for a non-own hero we've spied (now or previously), attach their known skills.
      const spyRec = c.player !== pi ? _spiedSkillsPi[c.id] : null;
      return {
        name: c.name,
        isKing: !!c.isKing,
        category,
        isNeutralGuard: c.isNeutralGuard,
        kingdom: c.player != null && c.player !== pi ? c.realmName || 'an enemy realm' : null,
        color: c.player != null ? c.realmColor : null,
        ...(c.player === pi ? { armyCount: c.armyCount } : { armyBand: c.armyBand }), // D1: rough size for anyone not yours
        // the units themselves: a hero of its own, or one in a province it spied (the view holds them only then)
        armies: c.armies
          ? c.armies.map((a) => ({ type: a.type, quality: a.quality, unitName: a.unitName || '' }))
          : null,
        spiedSkills: spyRec ? spyRec.skills : null,
        spiedTurn: spyRec ? spyRec.turn : null,
      };
    });
    provinceCharIntel.push({ provId: p.id, provName: p.name, spied, characters });
  });
  return provinceCharIntel;
}
