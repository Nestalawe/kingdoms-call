// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng } from '../rng.ts';
import { COMBAT_ONLY_TACTICS } from '../army-tables.ts';
import { homeFounderOf, homeProvinceIdFor } from '../grand-design.ts';
import { _escapesTheEnd, _garrethEscapeLine } from '../names.ts';
import { GRAND_HEIST_RICH_TAX } from '../items/tiers-and-hoards.ts';
import { activeItems, settleTheItemsAHeroGained } from '../items/equipment.ts';
import { theSpysItemsMakeHisSpySure } from '../rules/the-registry-of-magic-item-effects.ts';
import { applyItemMaxHp, transferableItems } from '../personal-combat/helpers.ts';
import { d100, rng } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { markProvinceCombat } from '../bots/intel.ts';
import { TM, noteEspionage, perkTier, skillLevel } from '../titles/perks.ts';
import { discParam, discSum, hasDisc } from '../discoveries.ts';
import { emit, emitNarrLine, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { charMinor } from '../titles/title-holders-and-battle-merit.ts';
import {
  effStat,
  isVanished,
  theOddsShownAsALineTellsIt,
  theStatShownAsALineTellsIt,
} from '../heroes/effective-skills-and-hidden-heroes.ts';
import { provIsCoastal } from '../battle/terrain-and-unit-strength.ts';
import {
  SKILLGAIN_COMMON,
  SKILLGAIN_STD,
  awardKillXP,
  trySkillGain,
} from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { applySpySuccess } from '../espionage/what-a-spy-learns.ts';
import { duelStanceOf, ensureEncounterPlan } from '../personal-combat/speed-encounter-plans-and-combatants.ts';
import { resolveCharVsChar } from '../personal-combat/duels-and-character-encounters.ts';
import { reportHeroFall } from '../heroes/hero-death-and-leaderless-hosts.ts';
import { theUnitsAsTheLineNamesThem } from '../battle/the-facts-a-battles-lines-record.ts';

// ── THE ESPIONAGE ORDERS (plan P1-08j6: the sixth family taken out of processOrder in resolveTurn) ──
// Spy (on the province he stands in, or on a hero beside him), Steal (a magic item or gold from a hero beside him, or
// the garrison's pay), Sabotage (an enemy province's coffers and one company of its garrison), Grand Heist (the vaults
// of an enemy's capital or rich country, and a parcel on its roads), Assassinate (an enemy hero beside him) and Vanish
// (nothing can bring him to bay for the rest of the turn), each once processOrder has read the order and checked he may
// act (a mastery order once a turn, never for a hero held by an enchantment). Before them, the two helpers the Spy,
// Steal and Grand Heist orders share, nested in processOrder until this row: a thief caught in the act, and an item
// lifted from a hero's pack. Each takes the turn's context first (src/engine/turn/context.ts), then the values
// processOrder worked out before it that it reads, in the order processOrder declares them. Each body keeps
// processOrder's indent (plan P1-08's Decisions); a case-level break became a return.
// ── THIEF: caught in the act ────
// A thief detected mid-theft is set upon by the victim: a PERSONAL duel on both encounter plans
// (the thief is well advised to lead with FLEE), unless the victim's duel stance is REFUSE — then
// the victim lets the thief go and merely raises the alarm. A Vanished thief (Thief 9) is never
// brought to bay at all. What he was caught at is a record of its values (WhatAThiefWasCaughtAt, the facts module beside
// this file): the victim's line tells it.
export function thiefCaughtScuffle(turnContext, prov, thief, victim, caughtAt) {
  const { G } = turnContext;
  const targetsPi = [thief.player, victim.player].filter((x) => x != null);
  if (thief._vanishTurn === G.turn) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'a thief has already melted into the shadows when the alarm is raised',
        victimName: victim.name,
        thiefName: thief.name,
      },
      audience: { actor: thief.player, realms: targetsPi },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: [thief.id, victim.id],
    });
    return;
  }
  ensureEncounterPlan(turnContext, victim);
  if (duelStanceOf(victim) === 'refuse') {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'a victim who wants no brawl drives a caught thief off',
        victimName: victim.name,
        thiefName: thief.name,
        caughtAt: caughtAt,
      },
      audience: { actor: thief.player, realms: targetsPi },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: [thief.id, victim.id],
    });
    return;
  }
  const COMBAT_ONLY = COMBAT_ONLY_TACTICS;
  const filterPlan = (plan) =>
    ((plan && plan.tactics) || ['ME']).filter(
      (t) => COMBAT_ONLY.has(String(t).split(':')[0].toUpperCase()) || String(t).toUpperCase().startsWith('CA:'),
    );
  ensureEncounterPlan(turnContext, thief);
  const atkPlan = filterPlan(thief.encounterPlan);
  if (!atkPlan.length) atkPlan.push('ME');
  const defPlan = filterPlan(victim.encounterPlan);
  if (!defPlan.length) defPlan.push('ME');
  const _duelChars = [thief.id, victim.id];
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: 'a victim catches a thief and blades are drawn',
      victimName: victim.name,
      thiefName: thief.name,
      caughtAt: caughtAt,
    },
    audience: { actor: thief.player, realms: targetsPi, seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
    heroes: _duelChars,
  });
  markProvinceCombat(prov, [thief.player, victim.player]); // purple swords: a personal combat, not a field battle
  const enc = resolveCharVsChar(
    turnContext,
    thief,
    victim,
    atkPlan,
    defPlan,
    prov,
    (...a) => effStat(turnContext, ...a),
    rng,
    G,
  );
  enc.narrative.forEach((line) =>
    emitNarrLine(turnContext, line, {
      type: 'combat',
      audience: { actor: thief.player, realms: targetsPi },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: _duelChars,
    }),
  );
  thief.hp = Math.max(1, enc.atkHp);
  if (victim.player !== null) victim.hp = Math.max(1, enc.defHp);
  if (enc.atkKilled || enc.atkHp <= 0) {
    if (_escapesTheEnd(thief)) {
      if (thief.hp != null && thief.hp <= 0) thief.hp = 1;
      emit(turnContext, {
        type: 'combat',
        fact: _garrethEscapeLine(thief),
        audience: { actor: thief.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      });
    } else {
      reportHeroFall(
        turnContext,
        thief,
        victim,
        { kind: 'a hero is slain outside a battle', heroName: thief.name, how: "a thief's end", killerName: null },
        {
          audience: { actor: thief.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
          heroes: _duelChars,
        },
      );
      awardKillXP(turnContext, victim, thief);
    }
  }
  if (enc.defKilled || enc.defHp <= 0) {
    if (_escapesTheEnd(victim)) {
      if (victim.hp != null && victim.hp <= 0) victim.hp = 1;
      emit(turnContext, {
        type: 'combat',
        fact: _garrethEscapeLine(victim),
        audience: { actor: thief.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      });
    } else {
      reportHeroFall(
        turnContext,
        victim,
        thief,
        {
          kind: 'a hero is slain outside a battle',
          heroName: victim.name,
          how: 'by the cornered thief',
          killerName: null,
        },
        {
          audience: { actor: thief.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
          heroes: _duelChars,
        },
      );
      awardKillXP(turnContext, thief, victim);
    }
  }
}
// Shared: lift a random magic item from a victim (null if none, or if the victim is a master
// thief).
export function liftRandomItem(turnContext, thief, victim) {
  const { G } = turnContext;
  const items = victim.items || [];
  const pool = transferableItems(items); // a granted Mithril suit cannot be lifted off its wearer
  if (!pool.length) return null;
  if (perkTier(victim, 'thief') >= 3) return { guarded: true }; // THIEF L8: a master thief's own pockets cannot be picked
  // the thief grabs what comes to hand — the pick is weighted TOWARD the lesser trinkets. Weak
  // 8: Moderate 4: Powerful 2: Legendary 1, so a hero carrying one item of each tier loses the
  // Weak one 53% of the time and the Legendary one under 7%.
  const STEAL_TIER_W = { 1: 8, 2: 4, 3: 2, 4: 1 };
  const wsum = pool.reduce((t, x) => t + (STEAL_TIER_W[x.tier || 1] || 8), 0);
  let r = kcRng() * wsum,
    it = pool[pool.length - 1];
  for (const x of pool) {
    r -= STEAL_TIER_W[x.tier || 1] || 8;
    if (r < 0) {
      it = x;
      break;
    }
  }
  items.splice(items.indexOf(it), 1);
  applyItemMaxHp(victim, it);
  thief.items = thief.items || [];
  thief.items.push(it);
  applyItemMaxHp(thief, it);
  it._stolenTurn = G.turn; // a charmed hero's automatic Send Item hands over this turn's loot first
  return it;
}
// Spy: the province he stands in (what it holds, and the realm's secrets if it is a capital), or a hero beside him (every skill, item and company); a hero spied on may catch the spy.
export function resolveSpyOrder(turnContext, c, target, prov) {
  const { G } = turnContext;
  const hasCrystalOrb = theSpysItemsMakeHisSpySure(activeItems(c)); // the items' registry (plan P1-19o)
  // sd21 Forgery Arts: +15% spy success chance
  const targetProvForSpy = G.world.provinces[parseInt(target)];
  // spy / counterSpy discoveries — optionally scoped to the TARGET province's terrain, to coastal
  // ground or (counterSpy) to the defender's capital. sd21 / sd19 are now ordinary effects.
  const _spyProv = String(target || '').startsWith('char:') ? prov : targetProvForSpy || prov;
  const _spyScope = (e, ownerPi) =>
    (!e.terrains || (_spyProv && e.terrains.includes(_spyProv.terrain))) &&
    (!e.coastal || (_spyProv && provIsCoastal(G, _spyProv))) &&
    (!e.home || (_spyProv && ownerPi != null && homeFounderOf(G, _spyProv.id) === ownerPi));
  const spyBonus = discSum(turnContext, c.player, 'spy', 'pct', (e) => _spyScope(e, null)); // spy discoveries
  const cipherPenalty =
    targetProvForSpy && targetProvForSpy.owner !== null && targetProvForSpy.owner !== c.player
      ? discSum(turnContext, targetProvForSpy.owner, 'counterSpy', 'pct', (e) => _spyScope(e, targetProvForSpy.owner))
      : 0; // counterSpy discoveries
  // ── Item 10: SPY ON A CHARACTER ── target 'char:<id>' names a non-own character standing
  // in the same province. Success 25% +10%/Spy level (Master Spy / Crystal Orb: automatic)
  // reveals every skill level, every magic item and every army unit they lead. Success or
  // not, the spy may be CAUGHT: 20% +10%/target Spy −10%/own Spy, +15% in the target realm's
  // own land,
  // −15% in this realm's own land (clamped 5–95; The Shadow is never caught). Caught → a personal
  // combat, unless the target's Encounter Plan stance is Refuse (same scuffle as a caught
  // thief).
  if (String(target || '').startsWith('char:')) {
    const _tid = String(target).slice(5);
    const _tgt = (G.characters || []).find((x) => x && String(x.id) === _tid && x.alive);
    if (!_tgt || _tgt.location !== c.location || _tgt.player === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'a spy finds no quarry to spy on',
          heroName: c.name,
          quarryName: _tgt ? _tgt.name : null,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    if (activeItems(_tgt).some((it) => it && it.effect && it.effect.stat === 'hidden')) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'a spy cannot fix on a cloaked face',
          heroName: c.name,
          targetName: _tgt.name,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    const _mySpy = effStat(turnContext, c, 'spy'),
      _tgSpy = effStat(turnContext, _tgt, 'spy');
    const _masterSpy = perkTier(c, 'spy') > 0;
    const _auto = hasCrystalOrb || _masterSpy;
    const _chance = Math.max(
      5,
      Math.min(
        95,
        dispFloor(
          (0.25 +
            0.1 * _mySpy +
            spyBonus +
            discSum(turnContext, c.player, 'spyChar', 'pct', (e) => _spyScope(e, null))) *
            100,
        ),
      ),
    ); // + spyChar discoveries (optionally scoped to where it happens)
    const _roll = d100();
    const _ok = _auto || _roll <= _chance;
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a spy's roll to read a hero",
        targetName: _tgt.name,
        heroName: c.name,
        spyLevel: _mySpy,
        provinceName: prov.name,
        theSuccessIsCertain: _auto,
        byTheCrystalOrb: hasCrystalOrb,
        chance: _chance,
        roll: _roll,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    if (_ok) {
      TM(c).spyActions = (TM(c).spyActions || 0) + 1; // TITLE MERIT: Spymaster
      noteEspionage(G, c, prov.id, 'read one of your heroes');
      trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD);
      const _ap = G.players[c.player];
      // 2026-10-15 (Toby, D2/D9): every skill, the magic items carried and the army units led, kept for
      // the report's hero sightings — for a wandering hero or a local chieftain as for a rival's hero.
      if (_ap) {
        _ap._spiedHeroSkills = _ap._spiedHeroSkills || {};
        _ap._spiedHeroSkills[_tgt.id] = {
          name: _tgt.name,
          isKing: !!_tgt.isKing,
          alignment: _tgt.alignment || null,
          race: _tgt.race || null,
          kingdom: _tgt.player != null ? G.players[_tgt.player]?.name || null : null,
          skills: { ...(_tgt.skills || {}) },
          items: (_tgt.items || []).map((it) => it && it.name).filter(Boolean),
          armies: (_tgt.armies || []).map((a) => ({ type: a.type, quality: a.quality, unitName: a.unitName || '' })),
          turn: G.turn,
        };
      }
      emit(turnContext, {
        type: 'spy',
        fact: {
          kind: "a spy's report on a hero",
          heroName: c.name,
          targetName: _tgt.name,
          targetsRealmName: _tgt.player != null ? G.players[_tgt.player]?.name : null,
          race: _tgt.race || null,
          alignment: _tgt.alignment || null,
          isKing: !!_tgt.isKing,
          skills: Object.entries(_tgt.skills || {})
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1]),
          itemNames: (_tgt.items || []).map((it) => it.name),
          units: theUnitsAsTheLineNamesThem(_tgt.armies || []),
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        spy: true,
      });
    } else {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'a spy learns nothing of a hero',
          heroName: c.name,
          targetName: _tgt.name,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      trySkillGain(turnContext, c, 'spy', SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
    }
    // Caught?
    if (!charMinor(turnContext, c, 'shadow')) {
      let _catch = 20 + 10 * _tgSpy - 10 * _mySpy;
      const _tgRealmLand = _tgt.player != null && prov.owner === _tgt.player,
        _myLand = prov.owner === c.player;
      if (_tgRealmLand) _catch += 15;
      if (_myLand) _catch -= 15;
      if (_tgt.player != null)
        _catch += discSum(turnContext, _tgt.player, 'catchSpy', 'pct', (e) => _spyScope(e, _tgt.player)); // catchSpy discoveries (sd63 Informer Rewards)
      _catch = Math.max(5, Math.min(95, _catch));
      const _cr = d100();
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a hero's chance to notice a spy",
          targetName: _tgt.name,
          targetsSpy: theStatShownAsALineTellsIt(turnContext, c.player, _tgt, 'spy'),
          heroName: c.name,
          inTheirOwnLand: _tgRealmLand,
          inYourLand: _myLand,
          odds: theOddsShownAsALineTellsIt(turnContext, c.player, _tgt, _catch, _cr),
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      if (_cr <= _catch) {
        if (_tgt.player != null)
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: 'a realm learns a spy was caught on its hero',
              spyName: c.name,
              spysRealmName: c.player != null ? G.players[c.player]?.name : null,
              targetName: _tgt.name,
              provinceName: prov.name,
            },
            audience: { actor: c.player, realms: [_tgt.player] },
            province: prov.id,
            hero: _tgt.id,
          });
        thiefCaughtScuffle(turnContext, prov, c, _tgt, { kind: 'caught spying on a hero' });
      }
    } else
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a spy slips away unseen as The Shadow', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    return;
  }
  // LEVEL 6+ SKILL PERK — Master Spy: at Spy 6+, espionage never fails (as the Crystal Orb).
  const masterSpy = perkTier(c, 'spy') > 0;
  // Disguise is decided fresh for EVERY spy order — the flag lives on the character record
  // and persists in the save, so leaving it set once made a spy invisible for the rest of the
  // game.
  c._spyDisguised = false;
  if (charMinor(turnContext, c, 'shadow')) c._spyDisguised = true; // MINOR TITLE — The Shadow: spies never detected
  // show the spy's success chance and the actual roll (previously neither was reported).
  const _spyChance = dispFloor((0.2 + effStat(turnContext, c, 'spy') * 0.2 + spyBonus - cipherPenalty) * 100);
  const _autoSpy = hasCrystalOrb || masterSpy;
  const _spyRoll = d100();
  const success = _autoSpy || _spyRoll <= _spyChance;
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: "a spy's roll to spy out a province",
      heroName: c.name,
      spyLevel: effStat(turnContext, c, 'spy'),
      provinceName: prov.name,
      theSuccessIsCertain: _autoSpy,
      byTheCrystalOrb: hasCrystalOrb,
      chance: _spyChance,
      roll: _spyRoll,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  // sd23 Disguise Techniques: 50% HARDER to be discovered — the counter-intelligence alert
  // that would otherwise always fire is turned aside half the time.
  if (success && !c._spyDisguised && hasDisc(turnContext, c.player, 'sd23')) {
    const _dgRoll = d100();
    const _dgPct = Math.round(discParam('sd23', 'pct', 0.5) * 100);
    if (_dgRoll <= _dgPct) c._spyDisguised = true;
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a spy's disguise is put to the test",
        heroName: c.name,
        provinceName: prov.name,
        chance: _dgPct,
        roll: _dgRoll,
        theDisguiseHolds: c._spyDisguised,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  }
  if (success) {
    TM(c).spyActions = (TM(c).spyActions || 0) + 1; // TITLE MERIT: Spymaster
    noteEspionage(G, c, prov.id, 'spied out the province');
    applySpySuccess(turnContext, c, prov);
  } else {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "a spy's espionage in a province yields little", heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    trySkillGain(turnContext, c, 'spy', SKILLGAIN_COMMON);
  } // batch item 11: a failed attempt is a small chance to learn
  return;
}
// Steal: a magic item (or, failing one, gold) from a hero beside him, or the pay of a rival's garrison; a thief who fails may be caught.
export function resolveStealOrder(turnContext, c, target, prov, player) {
  const { G } = turnContext;
  // ── STEAL ── Needs Thief 1+. Targets: a character in the province (magic item, or 5% of
  // their realm's treasury — the player chooses via `extra`, defaulting to an item when one
  // is carried), or the province GARRISON paymaster (target 'garrison': 1g per garrison unit
  // from the owning realm). Success: 50% + 10%/Thief
  // (cap L5), halved against a commander leading troops (or the guarded paymaster). A failed attempt is
  // noticed unless the thief slips away (Thief × 20%, cap 95%); a noticed thief is brought to
  // a duel unless the victim's duel stance is REFUSE (thiefCaughtScuffle above).
  const thiefLevel = effStat(turnContext, c, 'thief');
  if (thiefLevel < 1) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero with no Thief skill cannot steal', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const _tgtRaw = String(target || '')
    .trim()
    .toLowerCase();
  // cap at 95%. 50 + 10×5 reached a flat 100 at Thief 5, and nothing in this engine is ever
  // certain — every other roll is clamped short of it. The halved variants (a target leading
  // troops, a guarded paymaster) floor out of this figure, so they cap at 47%.
  const stealBase = Math.min(95, 50 + 10 * Math.min(thiefLevel, 5));
  const escapeChance = Math.min(95, thiefLevel * 20); // chance to slip away unnoticed on a failure
  if (_tgtRaw === 'garrison') {
    // (e) The garrison paymaster: 1g per unit standing garrison here, from the province's owner.
    const _gN = (prov.garrisonArmies || []).length;
    if (prov.owner == null || prov.owner === c.player || _gN === 0) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a thief finds no enemy paymaster to rob', heroName: c.name, provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    const ownerP = G.players[prov.owner];
    const chance = Math.floor(stealBase / 2);
    const roll = d100();
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a thief's roll to rob a garrison's paymaster",
        heroName: c.name,
        thiefLevel: thiefLevel,
        provinceName: prov.name,
        garrisonUnits: _gN,
        chance: chance,
        roll: roll,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    if (roll <= chance) {
      noteEspionage(G, c, prov.id, 'robbed the garrison paymaster');
      const take = Math.min(ownerP.gold || 0, _gN);
      if (take > 0) {
        ownerP.gold -= take;
        player.gold = (player.gold || 0) + take;
        c.merits = (c.merits || 0) + 1;
      }
      emit(turnContext, {
        type: 'hire',
        fact: {
          kind: "a thief lifts gold from a garrison's paymaster",
          heroName: c.name,
          gold: take,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      if (take > 0)
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "a realm learns its garrison's paymaster was robbed",
            provinceName: prov.name,
            gold: take,
            thiefName: c.name,
            thiefsRealmName: G.players[c.player]?.name,
          },
          audience: { actor: c.player, realms: [prov.owner] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
      trySkillGain(turnContext, c, 'thief', SKILLGAIN_STD);
    } else if (kcRng() * 100 >= escapeChance) {
      const dmg = rng(1, 4);
      c.hp = Math.max(1, c.hp - dmg);
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: "a thief is caught and beaten back by a garrison's guards",
          heroName: c.name,
          provinceName: prov.name,
          damage: dmg,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a realm learns a thief was caught at its garrison's paymaster",
          thiefName: c.name,
          thiefsRealmName: G.players[c.player]?.name,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [prov.owner] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else
      emit(turnContext, {
        type: 'system',
        fact: { kind: "a thief's attempt on a paymaster fails unnoticed", heroName: c.name, provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    if (roll > chance) trySkillGain(turnContext, c, 'thief', SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
    return;
  }
  const targetId = parseInt(target);
  const victim = G.characters.find((ch) => ch.alive && ch.id === targetId && ch.location === c.location);
  if (!victim) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a thief finds no target to steal from', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (victim.player === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a thief will not rob a comrade', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (isVanished(turnContext, victim)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "a thief reaches for a vanished hero's purse", heroName: c.name, victimName: victim.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  // the player never chooses the prize and is never told whether the target carries anything.
  // A magic item is lifted if one can be (random, weighted toward the weaker tiers — see
  // liftRandomItem); a target with nothing liftable is robbed of gold instead. The saved
  // `extra` ('item'/'gold') from older order forms is ignored.
  const hasItems = transferableItems(victim.items || []).length > 0;
  const wantGold = !hasItems;
  if (wantGold && victim.player == null) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a thief finds nothing worth stealing on a hero', heroName: c.name, victimName: victim.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  const leadsArmies = (victim.armies || []).length > 0;
  let stealChance = stealBase;
  if (leadsArmies) stealChance = Math.floor(stealChance / 2);
  const stealRoll = d100();
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: "a thief's roll to rob a hero",
      heroName: c.name,
      thiefLevel: thiefLevel,
      victimName: victim.name,
      forTheGold: wantGold,
      chance: stealChance,
      roll: stealRoll,
      theTargetLeadsArmies: leadsArmies,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  if (stealRoll <= stealChance) {
    noteEspionage(G, c, prov.id, wantGold ? 'picked a hero\u2019s purse' : 'lifted a magic item from a hero');
    if (wantGold) {
      const purse = G.players[victim.player]?.gold || 0;
      const take = Math.min(purse, Math.max(1, Math.floor(purse * 0.05)));
      if (purse <= 0) {
        emit(turnContext, {
          type: 'system',
          fact: { kind: "a thief picks a hero's empty purse", heroName: c.name, victimName: victim.name },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
      } else {
        G.players[victim.player].gold -= take;
        player.gold = (player.gold || 0) + take;
        c.merits = (c.merits || 0) + 1;
        emit(turnContext, {
          type: 'hire',
          fact: {
            kind: "a thief lifts gold from a hero's strongbox",
            heroName: c.name,
            gold: take,
            victimName: victim.name,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: 'a realm learns a thief stole its gold',
            thiefName: c.name,
            thiefsRealmName: G.players[c.player]?.name,
            gold: take,
            victimName: victim.name,
          },
          audience: { actor: c.player, realms: [victim.player] },
          province: prov.id,
          hero: victim.id,
        });
      }
    } else {
      const stolen = liftRandomItem(turnContext, c, victim);
      if (stolen && stolen.guarded) {
        emit(turnContext, {
          type: 'system',
          fact: { kind: "a master thief's own pockets cannot be picked", heroName: c.name, victimName: victim.name },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
      } else {
        c.merits = (c.merits || 0) + 2;
        emit(turnContext, {
          type: 'hire',
          fact: {
            kind: 'a thief lifts a magic item from a hero',
            heroName: c.name,
            itemName: stolen.name,
            victimName: victim.name,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
        emit(turnContext, {
          type: 'hire',
          fact: {
            kind: 'a thief notes how he carries what he took',
            theItemsHeGained: settleTheItemsAHeroGained(c, [stolen]),
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        }); // item 10
        if (victim.player !== null)
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: 'a realm learns a thief stole a magic item',
              thiefName: c.name,
              thiefsRealmName: G.players[c.player]?.name,
              itemName: stolen.name,
              victimName: victim.name,
            },
            audience: { actor: c.player, realms: [victim.player] },
            province: prov.id,
            hero: victim.id,
          });
      }
    }
    trySkillGain(turnContext, c, 'thief', SKILLGAIN_STD);
  } else {
    const caught = kcRng() * 100 >= escapeChance;
    if (caught)
      thiefCaughtScuffle(turnContext, prov, c, victim, {
        kind: "caught with a hand in a hero's strongbox or pack",
        forTheGold: wantGold,
      });
    else
      emit(turnContext, {
        type: 'system',
        fact: { kind: "a thief's attempt on a hero fails unnoticed", heroName: c.name, victimName: victim.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
    trySkillGain(turnContext, c, 'thief', SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
  }
  return;
}
// Sabotage (Spy 7): an enemy province yields no tax this turn, and one company of its garrison is put to the torch.
export function resolveSabotageOrder(turnContext, c, target) {
  const { G } = turnContext;
  if (skillLevel(c, 'spy') < 7) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Spy mastery to attempt Sabotage', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const tp = G.world.provinces[parseInt(target)];
  if (!tp || tp.owner == null || tp.owner === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Sabotage needs an enemy province the hero has seen', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (!areEnemies(turnContext, c.player, tp.owner)) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'Sabotage of a province whose owner is not at war is refused',
        heroName: c.name,
        provinceName: tp.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  tp._sabotagedForTurn = G.turn;
  let torchedCompany = null;
  if ((tp.garrisonArmies || []).length > 0) {
    const u = tp.garrisonArmies.splice(Math.floor(kcRng() * tp.garrisonArmies.length), 1)[0];
    torchedCompany = u ? { quality: u.quality || null, type: u.type } : null;
  }
  emit(turnContext, {
    type: 'spy',
    fact: { kind: "a spy's agents sabotage a province", heroName: c.name, provinceName: tp.name, torchedCompany },
    audience: { actor: c.player, realms: [c.player, tp.owner].filter((x) => x != null) },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: tp.id,
  });
  TM(c).spyActions = (TM(c).spyActions || 0) + 1; // TITLE MERIT: Spymaster
  noteEspionage(G, c, tp.id, 'worked sabotage');
  trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD);
  return;
}
// Grand Heist (Thief 7): a quarter of an enemy's treasury from the vaults of its capital or rich country he stands in, and a parcel cut from its couriers.
export function resolveGrandHeistOrder(turnContext, c, ph, prov) {
  const { G } = turnContext;
  // ── GRAND HEIST ────
  // The TARGET is the PROVINCE the thief is standing in, not any one hero — the job is
  // breaking into a realm's vaults, and the realm robbed is whoever holds the ground.
  // • PLACE — the province must be held by a realm you are at WAR with, and be either their
  // HOME CAPITAL or RICH country (tax base ≥ GRAND_HEIST_RICH_TAX).
  // • ONCE per turn per thief — the attempt is spent whether it succeeds or fails.
  // • ODDS — 60% + 5% per Thief level past 5, HALVED if the vaults are guarded: a garrison
  // stands here, or an enemy commander of that realm is here at the head of troops.
  // • TAKE — 25% of the realm's treasury (THIEF L8 doubles it; the realm is floored at 0), plus
  // ONE magic item taken from that realm's COURIER TRAFFIC — a parcel sent by a Send Item
  // order earlier this turn and still on the road. What a hero carries in their own pack is
  // never touched by a heist; that is the Steal order's business.
  // • CAUGHT — a failed heist is noticed unless the thief slips away (Thief × 20%, cap 95%).
  // If a hero of the robbed realm is standing here they run the thief down (a duel, unless
  // their stance is Refuse); otherwise the garrison guards beat him off.
  if (skillLevel(c, 'thief') < 7) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Thief mastery for a Grand Heist', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (c._grandHeistTurn === G.turn) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a thief has already attempted a Grand Heist this turn', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const vp = prov.owner;
  if (vp == null || vp === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Grand Heist needs ground a rival crown holds', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  if (!areEnemies(turnContext, c.player, vp)) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'a Grand Heist on a realm not at war is refused',
        heroName: c.name,
        realmName: G.players[vp]?.name || null,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  const _ghHome = homeProvinceIdFor(G, vp) === prov.id;
  const _ghRich = (prov.tax || 0) >= GRAND_HEIST_RICH_TAX;
  if (!_ghHome && !_ghRich) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'a Grand Heist needs a capital or rich country',
        heroName: c.name,
        provinceName: prov.name,
        richTax: GRAND_HEIST_RICH_TAX,
        tax: prov.tax || 0,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  c._grandHeistTurn = G.turn; // the attempt is spent, win or lose
  // Who could catch him, and how well watched are the vaults?
  const _ghWardens = (G.characters || []).filter((x) => x && x.alive && x.player === vp && x.location === prov.id);
  const _ghGuarded = (prov.garrisonArmies || []).length > 0 || _ghWardens.some((x) => (x.armies || []).length > 0);
  const _hLvl = skillLevel(c, 'thief');
  let _hChance = Math.min(95, 60 + 5 * (_hLvl - 5));
  if (_ghGuarded) _hChance = Math.floor(_hChance / 2);
  const _hRoll = d100();
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: "a thief's roll to crack the vaults",
      heroName: c.name,
      thiefLevel: _hLvl,
      isTheEnemyCapital: _ghHome,
      provinceName: prov.name,
      realmName: G.players[vp]?.name || null,
      chance: _hChance,
      roll: _hRoll,
      theVaultsAreGuarded: _ghGuarded,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  if (_hRoll <= _hChance) {
    noteEspionage(G, c, prov.id, 'cracked the vaults');
    const purse = G.players[vp]?.gold || 0;
    let take = Math.floor(purse * 0.25);
    if (perkTier(c, 'thief') >= 3) take *= 2; // THIEF L8: gold stolen doubled — the thief takes the full amount even if the realm cannot cover it (floored at 0 below)
    let _heistItem = null;
    if (take > 0) {
      G.players[vp].gold = Math.max(0, purse - take);
      G.players[c.player].gold = (G.players[c.player].gold || 0) + take;
    }
    // ── COURIER INTERCEPT ── one item from a parcel still on the road inside the robbed
    // realm.
    const _ghParcels = (G._itemDeliveries || []).filter((d) => {
      if (!d || !Array.isArray(d.items) || !d.items.length) return false;
      const dest = (G.characters || []).find((ch) => ch && ch.id === d.toId);
      return !!dest && dest.player === vp;
    });
    if (_ghParcels.length) {
      const _p = _ghParcels[Math.floor(kcRng() * _ghParcels.length)];
      const _it = _p.items.splice(Math.floor(kcRng() * _p.items.length), 1)[0];
      c.items = c.items || [];
      c.items.push(_it);
      applyItemMaxHp(c, _it);
      _heistItem = _it;
      const _dest = (G.characters || []).find((ch) => ch && ch.id === _p.toId); // the parcel's intended recipient
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a realm's courier is waylaid on the road",
          realmName: G.players[vp]?.name,
          itemName: _it.name,
          senderName: _p.fromName || null,
          recipientName: _dest ? _dest.name : null,
        },
        audience: { actor: null, realms: [vp] },
        province: prov.id,
        hero: _dest ? _dest.id : THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: ph,
      });
    }
    c.merits = (c.merits || 0) + 2;
    // the haul: the gold lifted (told when there is any) and the courier's item, else that none was on the road
    const haul = { gold: take, courierItemName: _heistItem ? _heistItem.name : null };
    emit(turnContext, {
      type: 'hire',
      fact: { kind: 'a thief pulls off a Grand Heist', heroName: c.name, provinceName: prov.name, haul },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    if (_heistItem) {
      const _gn = settleTheItemsAHeroGained(c, [_heistItem]);
      if (_gn)
        emit(turnContext, {
          type: 'hire',
          fact: { kind: 'a thief notes how he carries what he took', theItemsHeGained: _gn },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
    } // item 10
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'a realm learns a Grand Heist was staged on it',
        thiefName: c.name,
        thiefsRealmName: G.players[c.player]?.name,
        provinceName: prov.name,
        haul,
      },
      audience: { actor: c.player, realms: [vp] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    trySkillGain(turnContext, c, 'thief', SKILLGAIN_STD);
  } else {
    trySkillGain(turnContext, c, 'thief', SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn
    const caught = kcRng() * 100 >= Math.min(95, _hLvl * 20);
    if (!caught) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a Grand Heist comes to nothing unnoticed', heroName: c.name, provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    // A hero of the robbed realm gives chase; failing that, the guards do.
    const _ghCatcher = _ghWardens.find((x) => !x.isKing) || _ghWardens[0] || null;
    if (_ghCatcher)
      thiefCaughtScuffle(turnContext, prov, c, _ghCatcher, {
        kind: 'caught breaking into the vaults of a province',
        provinceName: prov.name,
      });
    else {
      const dmg = rng(1, 4);
      c.hp = Math.max(1, c.hp - dmg);
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'a thief is caught at the vaults and beaten back',
          heroName: c.name,
          provinceName: prov.name,
          damage: dmg,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'a realm learns a thief was driven off its vaults',
          thiefName: c.name,
          thiefsRealmName: G.players[c.player]?.name,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [vp] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
  }
  return;
}
// Assassinate (Spy 9): a knife in the dark for an enemy hero beside him.
export function resolveAssassinateOrder(turnContext, c, target, prov) {
  const { G } = turnContext;
  if (skillLevel(c, 'spy') < 9) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Spy mastery to Assassinate', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const victim = G.characters.find(
    (ch) => ch.alive && ch.id === parseInt(target) && ch.location === c.location && ch.player !== c.player,
  );
  if (!victim) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero finds no enemy hero to assassinate', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (isVanished(turnContext, victim)) {
    emit(turnContext, {
      type: 'spy',
      fact: {
        kind: 'an assassin stalks a vanished mark',
        heroName: c.name,
        victimName: victim.name,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  if (victim.player != null && !areEnemies(turnContext, c.player, victim.player)) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'an assassination of a hero whose crown is not at war is refused',
        heroName: c.name,
        victimName: victim.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  const chance = Math.min(80, 25 + skillLevel(c, 'spy') * 6) - (victim.isKing ? 25 : 0);
  const roll = d100();
  markProvinceCombat(prov, [c.player, victim.player]); // purple swords: knife-work counts as a personal combat
  // The roll line is the ASSASSIN'S working: it names their own Spy level and the odds, so it
  // goes to their realm alone. The victim's realm is told an attempt was made on their hero —
  // they would certainly notice a knife in the dark — but never the assassin's skill or the
  // numbers behind it. (Before 2026-09-26 both realms got the full line, handing the victim
  // the attacker's Spy level for free.)
  emit(turnContext, {
    type: 'spy',
    fact: {
      kind: "an assassin's roll",
      heroName: c.name,
      spyLevel: skillLevel(c, 'spy'),
      victimName: victim.name,
      chance: chance,
      roll: roll,
      theMarkIsAKing: !!victim.isKing,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    heroes: [c.id, victim.id].filter((v) => v != null),
    province: prov.id,
  });
  if (victim.player != null && victim.player !== c.player)
    emit(turnContext, {
      type: 'spy',
      fact: {
        kind: "a realm learns an attempt was made on its hero's life",
        victimName: victim.name,
        theMarkIsAKing: !!victim.isKing,
      },
      audience: { actor: victim.player, realms: [victim.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      heroes: [victim.id].filter((v) => v != null),
      province: prov.id,
    });
  if (roll <= chance) {
    if (_escapesTheEnd(victim)) {
      emit(turnContext, {
        type: 'combat',
        fact: _garrethEscapeLine(victim),
        audience: { actor: c.player, realms: [c.player].filter((x) => x != null), seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      reportHeroFall(
        turnContext,
        victim,
        c,
        {
          kind: 'a hero is slain outside a battle',
          heroName: victim.name,
          how: "by an assassin's blade",
          killerName: c.name,
        },
        {
          audience: { actor: c.player, realms: [c.player, victim.player].filter((x) => x != null), seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        },
      );
      awardKillXP(turnContext, c, victim);
      c.merits = (c.merits || 0) + 2;
      TM(c).spyActions = (TM(c).spyActions || 0) + 1; // TITLE MERIT: Spymaster — only a blade that lands
      noteEspionage(G, c, prov.id, 'put a blade in one of your heroes');
    }
  } else {
    emit(turnContext, {
      type: 'spy',
      fact: { kind: "an assassin's attempt fails", heroName: c.name, victimName: victim.name },
      audience: { actor: c.player, realms: [c.player, victim.player].filter((x) => x != null) },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      heroes: [c.id, victim.id].filter((v) => v != null),
      province: prov.id,
    });
  }
  trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD);
  return;
}
// Vanish (Thief 9): for the rest of the turn nothing can bring him to bay or harm him.
export function resolveVanishOrder(turnContext, c, prov) {
  const { G } = turnContext;
  if (skillLevel(c, 'thief') < 9) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Thief mastery to Vanish', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  c._vanishTurn = G.turn;
  emit(turnContext, {
    type: 'move',
    fact: { kind: 'a thief melts into the shadows', heroName: c.name },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'thief', SKILLGAIN_STD);
  return;
}
