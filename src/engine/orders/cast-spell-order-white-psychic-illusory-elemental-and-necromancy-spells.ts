// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_QUALITY_UP, SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { actionSpellsAllowedPerSchoolEachTurn } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import {
  CHARMED_NO_TURN_SPELLS,
  COMBAT_ONLY_TACTICS,
  SKILL_LABELS,
  SPELL_FNS_NEED_COLOCATED_TARGET,
  demoteOrDisband,
} from '../army-tables.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { heroHireWage } from '../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { ABILITIES_P, shuffleP } from '../battle/fortune.ts';
import { _escapesTheEnd, _garrethEscapeLine } from '../names.ts';
import { noteGraveIntel, skeletalRaiseCount, takeBestGrave } from '../graves.ts';
import { claimWandererName, itemNameList } from '../heroes/fame-and-consecration.ts';
import { activeItems } from '../items/equipment.ts';
import { armyUnitName, d100, fmtRoll, rng } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { markProvinceCombat } from '../bots/intel.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { TM, perkTier, skillLevel } from '../titles/perks.ts';
import { graveServedOther, isPreOrderRef, orderCharRef } from '../heroes/charms-and-neutrals.ts';
import { castChanceFor } from '../chances-and-lair-grades.ts';
import { _BEST_SCHOOL } from '../titles/reckoning.ts';
import { applyPendingSynthPlan, discSum, gdActive, hasDisc } from '../discoveries.ts';
import { realmTag } from '../turn/log-line-helpers.ts';
import {
  emit,
  emitNarrLine,
  logSplit,
  notifyProvinceOwner,
  notifyTarget,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
} from '../turn/events-and-their-audiences.ts';
import { charMinor } from '../titles/title-holders-and-battle-merit.ts';
import {
  effStat,
  isHiddenChar,
  isVanished,
  isVeiled,
  recalcHeroPay,
} from '../heroes/effective-skills-and-hidden-heroes.ts';
import { setMovePool } from '../units/movement-pools.ts';
import { applyPlague, blessWardNegates } from '../magic/plague-and-bless-ward.ts';
import {
  SKILLGAIN_COMMON,
  SKILLGAIN_STD,
  awardKillXP,
  trySkillGain,
} from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { ensureEncounterPlan } from '../personal-combat/speed-encounter-plans-and-combatants.ts';
import { resolveCharVsChar } from '../personal-combat/duels-and-character-encounters.ts';
import { reportHeroFall } from '../heroes/hero-death-and-leaderless-hosts.ts';
import { normaliseAction } from '../turn/phase-intents-and-dependency-ordering.ts';
import { resolveUnitGainInProvince } from '../battle/hosts-gained-in-a-province.ts';

// ── THE CAST SPELL ORDER (plan P1-08j7: the seventh family taken out of processOrder in resolveTurn) ──
// A hero works a spell as a phase order: the casting limits (a school's casts a turn, a mastery spell once a turn), the
// cast chance and its roll, then the spell itself, school by school: White Magic (Resurrect, Part Sea, Holy Symbol,
// Bless Province, Sanctuary, Divine Judgment), Psychic (Charm, Oratory, Clairvoyance, Psychic Blast, Telekinetic Storm,
// Mass Confusion, Dominate), Illusory (Illusory Terrain, Phantasmal Armies, Hide Lairs, Phantom Host, Invisibility,
// Veil), Elemental (Earthquake, Flood, Summon Elemental, Chain Lightning, Cataclysm) and Necromancy (Control Undead,
// Skeletal Armies, Curse, Plague, Raise Wraiths, Death's Dominion). A spell item used through Use Item arrives here as
// a cast (processOrder turns it into one). Before it, the helper a failed Charm calls, nested in processOrder until this
// row, with its constant. Each takes the turn's context first (src/engine/turn/context.ts), then the values processOrder
// worked out before it that it reads, in the order processOrder declares them. Each body keeps processOrder's indent
// (plan P1-08's Decisions); a case-level break became a return.
// ── CHARM BACKLASH ────
// A Charm that FAILS to take hold (fizzle, resisted, or sliding off a mind swayed last season)
// may bring the enchanter and their intended victim to blows: CHARM_BACKLASH_PCT chance of a
// personal encounter on both encounter plans. If EITHER hero leads their plan with Flee there
// is no encounter at all — one of them wants no part of it and the other cannot force it.
export const CHARM_BACKLASH_PCT = 50;
export function charmBacklash(turnContext, prov, caster, t, why) {
  const { G } = turnContext;
  if (!t || t.alive === false || t.location !== caster.location) return;
  const targetsPi = [caster.player, t.player].filter((x) => x != null);
  const roll = d100();
  emit(turnContext, {
    type: 'system',
    text: `📊 Charm backlash — ${t.name} may turn on ${caster.name} (${why}): ${fmtRoll(CHARM_BACKLASH_PCT, roll)}`,
    audience: { actor: caster.player, realms: [caster.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  if (roll > CHARM_BACKLASH_PCT) return;
  ensureEncounterPlan(turnContext, caster);
  ensureEncounterPlan(turnContext, t);
  const leadsFlee = (ch) => {
    const first = String(((ch.encounterPlan && ch.encounterPlan.tactics) || ['ME'])[0] || '')
      .split(':')[0]
      .toUpperCase();
    return first === 'FL' || first === 'FLEE';
  };
  if (leadsFlee(caster) || leadsFlee(t)) {
    const who = leadsFlee(caster) ? caster : t;
    emit(turnContext, {
      type: 'system',
      text: `${t.name} rounds on ${caster.name} as the enchantment fails — but ${who.name} is already slipping away, and there is no encounter.`,
      audience: { actor: caster.player, realms: targetsPi },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: [caster.id, t.id],
    });
    return;
  }
  const COMBAT_ONLY = COMBAT_ONLY_TACTICS;
  const filterPlan = (plan) =>
    ((plan && plan.tactics) || ['ME']).filter(
      (x) => COMBAT_ONLY.has(String(x).split(':')[0].toUpperCase()) || String(x).toUpperCase().startsWith('CA:'),
    );
  const atkPlan = filterPlan(t.encounterPlan);
  if (!atkPlan.length) atkPlan.push('ME');
  const defPlan = filterPlan(caster.encounterPlan);
  if (!defPlan.length) defPlan.push('ME');
  const _duelChars = [t.id, caster.id];
  emit(turnContext, {
    type: 'combat',
    text: `⚔ ${t.name} feels the enchantment clawing at their mind and rounds on ${caster.name} — blades are drawn!`,
    audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
    heroes: _duelChars,
  });
  markProvinceCombat(prov, [caster.player, t.player]);
  const enc = resolveCharVsChar(
    turnContext,
    t,
    caster,
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
      audience: { actor: caster.player, realms: targetsPi },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: _duelChars,
    }),
  );
  if (t.player !== null) t.hp = Math.max(1, enc.atkHp);
  caster.hp = Math.max(1, enc.defHp);
  if (enc.atkKilled || enc.atkHp <= 0) {
    if (_escapesTheEnd(t)) {
      if (t.hp != null && t.hp <= 0) t.hp = 1;
      emit(turnContext, {
        type: 'combat',
        text: _garrethEscapeLine(t),
        audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      });
    } else {
      reportHeroFall(turnContext, t, caster, `${t.name} is cut down by the enchanter they turned on.`, {
        audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      });
      awardKillXP(turnContext, caster, t);
    }
  }
  if (enc.defKilled || enc.defHp <= 0) {
    if (_escapesTheEnd(caster)) {
      if (caster.hp != null && caster.hp <= 0) caster.hp = 1;
      emit(turnContext, {
        type: 'combat',
        text: _garrethEscapeLine(caster),
        audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      });
    } else {
      reportHeroFall(turnContext, caster, t, `${caster.name} is slain — the failed Charm was their last spell.`, {
        audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      });
      awardKillXP(turnContext, t, caster);
    }
  }
}
// Cast Spell: the casting limits, the cast chance and its roll, then the spell, school by school (a spell item's Use Item arrives here as a cast).
export function resolveCastSpellOrder(turnContext, c, o, ph, target, extra, prov, player, _itemCast) {
  const { G, _tel, clairWatch } = turnContext;
  // target = spell name, extra = target province id or character id (if needed)
  const spellName = _itemCast ? _itemCast.spell : target;
  const spellDef = SPELL_DEFS_P[spellName];
  if (!spellDef) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: unknown spell "${spellName}".`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (!spellDef.phase) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: ${spellName} cannot be used as a phase order.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // a seized ENEMY hero will not turn hostile magic on their own lord's characters (the same
  // rule as Encounter) — refused BEFORE the cast is even attempted, so it costs no casting
  // slot. Other realms' heroes: as normal.
  if (c._charmTempControl && c._charmOriginalPlayer != null && CHARMED_NO_TURN_SPELLS.has(spellName)) {
    const _lordChar = G.characters.find((ch) => ch.alive && ch.id === (parseInt(extra) || -1));
    if (_lordChar && _lordChar.player === c._charmOriginalPlayer) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} lets the ${spellName} die on their lips — the Charm bends their will, but not so far as to turn them on their own lord's people.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      o._castNotWorked = true;
      return;
    }
  }

  // Enforce action spell limits (AK rules): level 1-2 → 1/turn, level 3 → 2/turn, level 4-5 → 3/turn
  if (!_itemCast) {
    const _school = spellDef.school;
    const _lvl = effStat(turnContext, c, _school);
    const _limit =
      actionSpellsAllowedPerSchoolEachTurn(_lvl) +
      (charMinor(turnContext, c, 'warlock') && _BEST_SCHOOL(c) === skillLevel(c, _school) ? 1 : 0); // Warlock minor (Archmage +1-cast perk removed \u2014 now an intel line)
    const _divCath = gdActive(turnContext, c.player, 'Divine'); // GRAND DESIGN — Divine (Grand Cathedral): Bless uses no casting slot
    // NORMALISE the saved action: the player portal writes "Cast Spell", the bots write
    // "cast_spell". Comparing the raw string counted only the bots' casts, so a human caster
    // had NO per-turn limit at all (a Psychic 1 hero could work five action spells a season).
    // The spell key is "Bless Province", never "Bless" — the old test never matched, so a
    // Grand Cathedral's free Bless was not free either. An order the engine REFUSED before it
    // was ever worked (_castNotWorked) costs no slot.
    const _castsSoFar = (G.turnOrders[c.id] || []).slice(0, ph).filter((o) => {
      if (!o || normaliseAction(o) !== 'cast_spell') return false;
      if (o._castNotWorked) return false; // never left the caster's lips
      if (o.target === 'Bless Province' && _divCath) return false; // a Grand Cathedral's Bless never consumes a slot
      return SPELL_DEFS_P[o.target]?.school === _school;
    }).length;
    if (_castsSoFar >= _limit && _lvl > 0 && !(spellName === 'Bless Province' && _divCath)) {
      o._castNotWorked = true; // 2026-10-13 (item 16): a blocked cast is never worked, so it spends no slot either
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: ${SKILL_LABELS[_school] || _school} level ${_lvl} casting limit (${_castsSoFar}/${_limit} per turn). ${spellName} blocked.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
  }

  const school = spellDef.school;
  const spellLevel = _itemCast ? Math.max(3, effStat(turnContext, c, school)) : effStat(turnContext, c, school); // a spell item works as at least level 3
  const spellLevelEff = Math.min(spellLevel, 5); // spell EFFECTS cap at caster level 5; cast chance keeps the full level
  if (spellLevel === 0) {
    // Check if they were trying to cast after a practice order this turn
    // (the practice didn't raise the skill, so the cast fails gracefully). 2026-10-13 (Toby,
    // item 16): the order form lets a hero queue casts on the assumption that every earlier
    // practice succeeds, so a cast refused here spends no casting slot — a later practice that
    // does succeed still opens the later casts the form promised.
    o._castNotWorked = true;
    emit(turnContext, {
      type: 'system',
      text: `${c.name} attempts to cast ${spellName} but lacks the required ${SKILL_LABELS[school] || school} skill — the practice order earlier this turn did not result in a skill gain. The spell fails.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // L7/L9 mastery spells require the RAW school level (past-5 comes from experience only).
  if (_itemCast && spellDef.reqLevel) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}: the ${_itemCast.item} can no longer work ${spellName} — such mastery must be earned, not carried. The item lies inert.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  } // Item 6
  if (!_itemCast && spellDef.reqLevel && skillLevel(c, school) < spellDef.reqLevel) {
    o._castNotWorked = true; // never worked: no casting slot spent (item 16)
    emit(turnContext, {
      type: 'system',
      text: `${c.name} cannot yet wield ${spellName} — it demands ${SKILL_LABELS[school] || school} level ${spellDef.reqLevel}, and they have reached only ${skillLevel(c, school)}.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }

  // ── ONCE PER TURN ── a mastery spell (L7/L9, has reqLevel) may be attempted only once per
  // turn per caster. Base spells keep the per-school casting limit above; this is the extra
  // cap.
  if (spellDef.reqLevel) {
    c._masterySpellUsed = c._masterySpellUsed || {};
    if (c._masterySpellUsed[spellName] === G.turn) {
      o._castNotWorked = true; // never worked: no casting slot spent (item 16)
      emit(turnContext, {
        type: 'system',
        text: `${c.name} has already invoked ${spellName} this turn \u2014 such mastery may be worked but once per turn.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    c._masterySpellUsed[spellName] = G.turn;
  }

  // Cast chance — computed by the shared castChanceFor() so the player's order form can quote
  // exactly what will be rolled here (see the helper beside MAGIC_L8_SCHOOLS). Wailing
  // Phylactery: the first Necromancy spell each turn cannot fail.
  const necroAuto =
    school === 'necromancy' &&
    !c._necroAutoUsed &&
    activeItems(c).some((it) => it.effect && it.effect.stat === 'necroAuto');
  const castChance = castChanceFor(c, school, G.players[c.player], {
    chars: G.characters || [],
    itemCast: !!_itemCast,
    necroAuto,
  }).chance;
  if (necroAuto && !_itemCast) c._necroAutoUsed = true;
  // ── TARGET STILL HERE? ── Refused BEFORE the roll, so a spell that was never worked costs
  // neither the cast nor the turn's casting slot. This is what a caster meets when the hero
  // they aimed at has left the province — most often a general on Defend who rode out to a
  // threatened neighbour at the top of the phase, before any order resolved.
  if (SPELL_FNS_NEED_COLOCATED_TARGET.has(spellDef.fn)) {
    const _tid = parseInt(extra);
    const _t = Number.isInteger(_tid) ? (G.characters || []).find((ch) => ch && ch.alive && ch.id === _tid) : null;
    if (_t && _t.location !== c.location) {
      const _tp = G.world.provinces[_t.location];
      const _own = _t.player === c.player;
      o._castNotWorked = true; // costs no casting slot for the rest of the turn
      emit(turnContext, {
        type: 'system',
        text: `${c.name} looks for ${_t.name} to work ${spellName} upon, and finds them gone — ${_own ? 'they had already marched' : 'they had already moved'} on to ${_tp ? _tp.name : 'another province'} before the spell could be shaped. It is never worked, and costs ${c.name} nothing.`,
        audience: { actor: c.player, realms: [c.player] },
        province: prov.id,
        hero: c.id,
        phase: ph,
      });
      return;
    }
  }
  const castRoll = d100();
  try {
    _tel.spells.push({
      ph,
      pi: c.player,
      charId: c.id,
      spell: spellName,
      school,
      lvl: spellLevel,
      chance: castChance,
      ok: castRoll <= castChance,
      item: !!_itemCast,
    });
  } catch (_te) {}
  if (_itemCast) {
    emit(turnContext, {
      type: 'system',
      text: `🔮 ${c.name} invokes the ${_itemCast.item} to work ${spellName}.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    trySkillGain(turnContext, c, 'sage', SKILLGAIN_COMMON);
  } // 2026-09-21: using a magic item may teach Sage (small chance)
  emit(turnContext, {
    type: 'system',
    text: `📊 ${c.name} casts ${spellName} (${SKILL_LABELS[school] || school} ${spellLevel}${(() => {
      const _tr = skillLevel(c, school);
      return _tr < spellLevel ? ` — ${_tr} trained, +${spellLevel - _tr} from ${_itemCast ? 'the item' : 'items'}` : '';
    })()}): ${castChance}% chance [roll ${castRoll}${castRoll <= castChance ? ' ✓' : ' ✗'}]`,
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });

  if (castRoll > castChance) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}'s ${spellName} fizzles — the spell dissipates without effect.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    if (!_itemCast) trySkillGain(turnContext, c, school, SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn (an item's cast teaches nothing when it fails)
    // a fizzled Charm may bring its intended victim down on the caster.
    if (spellDef.fn === 'psychic_charm') {
      const _ct = G.characters.find((ch) => ch.alive && ch.id === (parseInt(extra) || -1));
      if (_ct && _ct.player !== c.player && !_ct.isKing) charmBacklash(turnContext, prov, c, _ct, 'the spell fizzled');
    }
    return;
  }

  // Sept 2026: the old MAGIC BASE PERK (every successful cast raised current & max HP by 3-5)
  // is REMOVED. Casting no longer affects HP in any way — the max-HP ceiling grows only
  // through kills, lairs, Orc Vigour and skill training.
  if (school === 'necromancy') TM(c).darkCasts = (TM(c).darkCasts || 0) + 1; // TITLE MERIT: Deathpriest
  // Resolve spell effect
  const fn = spellDef.fn;
  // a pre-order hero named as the target of a friendly spell resolves to their real id; a
  // synthetic id used to parse as NaN → 0 and aimed the spell at character 0 (2026-09-23).
  const extraId = isPreOrderRef(extra) ? (orderCharRef(G, extra) || { id: -1 }).id : parseInt(extra) || 0;
  const targetProv = extraId >= 0 && G.world.provinces[extraId] ? G.world.provinces[extraId] : prov;
  const targetChar = G.characters.find((ch) => ch.alive && ch.id === extraId);
  // THIEF L9 Vanish: a vanished character cannot be reached by ANY hostile spell for the rest
  // of the turn.
  if (targetChar && targetChar.player !== c.player && isVanished(turnContext, targetChar)) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}'s ${spellName} gropes after ${targetChar.name} and finds only shadow — they have vanished, and nothing may touch them this season.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // ILLUSORY L9 Veil: a veiled character (and the host they lead) cannot be reached by ANY
  // hostile spell while the veil holds.
  if (targetChar && targetChar.player !== c.player && isVeiled(turnContext, targetChar)) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}'s ${spellName} cannot reach ${targetChar.name} — they and their host are veiled from all hostile magic.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // Cloak of Many Faces: shields the wearer from hostile Psychic Blast / Curse.
  if (
    targetChar &&
    targetChar.player !== c.player &&
    isHiddenChar(turnContext, targetChar) &&
    (spellName === 'Psychic Blast' || spellName === 'Curse')
  ) {
    emit(turnContext, {
      type: 'system',
      text: `${c.name}'s ${spellName} cannot find ${targetChar.name} — they are cloaked from hostile magic.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }

  // ── WHITE ──
  if (fn === 'white_resurrect') {
    // Bring a slain (non-king) hero back to life, WITHOUT their possessions. The body must
    // lie in the caster's province, the player must know of the death, and no-one may have
    // raised them earlier this turn. (We use the caster's current province as the resting
    // place.)
    if (!G.heroGraveyard) G.heroGraveyard = [];
    if (!G._resurrectedThisTurn) G._resurrectedThisTurn = [];
    // A fallen MONARCH's body was borne home when he died and stays there, even if that
    // province has since been captured (2026-10-08, Toby item 1) — never move it here.
    const knownIds = new Set(G.players[c.player]?.knownDeadHeroIds || []);
    // the body must lie in the CASTER'S OWN province for any of this to resolve — and a
    // caster standing over a corpse can plainly see it. Requiring a remembered death as well
    // meant a visible body could never be raised. (Monarch graves keep their own separate
    // guards below: only the fallen king's own realm, only the most recent monarch.)
    const _graveKnown = (g) => !!g && (knownIds.has(g.id) || g.location === c.location);
    // Resolve which grave: honour the EXPLICITLY chosen body (needed so a player can name
    // their fallen king rather than whatever corpse is freshest), else the most recent known
    // body here.
    // (targetChar only matches LIVE characters, so a dead target never bound here before — the
    // selection silently fell through to "most recent". Match the graveyard by id directly.)
    const _explicitGraveId = extra != null && String(extra).trim() !== '' ? parseInt(extra) : NaN;
    const grave = Number.isInteger(_explicitGraveId)
      ? G.heroGraveyard.find((g) => g.id === _explicitGraveId && g.location === c.location && _graveKnown(g))
      : G.heroGraveyard
          .filter((g) => g.location === c.location && _graveKnown(g))
          .sort((a, b) => b.killedOnTurn - a.killedOnTurn)[0];
    if (!grave) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} casts Resurrect, but no fallen hero you know of lies in ${prov.name} — perhaps another raised them first.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // MONARCH grave: only the realm that the king ruled may recall him, and only the MOST
    // RECENTLY fallen monarch of that line — earlier kings have passed beyond recall.
    if (grave._monarch) {
      if (grave.player !== c.player) {
        emit(turnContext, {
          type: 'system',
          text: `${c.name}: the fallen crown of ${grave.name} answers only to its own realm — no rival's prayer will restore it.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        return;
      }
      if (G.players[c.player]?._resurrectableMonarchId !== grave.id) {
        emit(turnContext, {
          type: 'system',
          text: `${c.name}: the spirit of ${grave.name} has passed beyond recall — only your most recently fallen monarch may be restored.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        return;
      }
    } else if (grave.isKing) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: ${grave.name} was a king — kings cannot be resurrected.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    } else if (graveServedOther(grave, c.player)) {
      // 2026-09-23 (Toby): a hero who ever served ANOTHER realm cannot be raised into yours.
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: ${grave.name} once swore to another crown — that oath holds even in death, and the spirit will not answer.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (G._resurrectedThisTurn.includes(grave.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: ${grave.name} has already been raised this turn.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const deadHero = G.characters.find((ch) => ch.id === grave.id);
    if (!deadHero) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: the spirit of ${grave.name} cannot be found.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (!grave._monarch && deadHero.isKing) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: kings cannot be resurrected.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // Revive — at full health, WITHOUT any possessions carried in life.
    deadHero.alive = true;
    TM(c).holyCasts += 1; // TITLE MERIT: Hierophant
    deadHero.hp = deadHero.maxHp || 20;
    deadHero.location = c.location;
    deadHero.killedThisTurn = false;
    deadHero._justDefeated = false;
    deadHero.items = [];
    deadHero.armies = []; // raised without possessions
    if (grave._monarch) {
      // The rightful king returns to his own throne. The body was borne home, so he is raised
      // ONLY by his own realm (guarded above) and reclaims the crown. Any reigning king or
      // freshly-crowned heir steps down to serve as a normal hero of the realm.
      deadHero.player = grave.player;
      const curMonarch = G.characters.find(
        (k) => k.isKing && k.player === grave.player && k.alive && k.id !== deadHero.id,
      );
      if (curMonarch) {
        curMonarch.isKing = false;
        curMonarch._isHeir = false;
        curMonarch._pendingSkillAllocation = 0;
        emit(turnContext, {
          type: 'system',
          text: `👑 ${curMonarch.name} steps down from the throne as ${deadHero.name} is restored to life — the former regent now serves the realm as a hero.`,
          audience: { actor: grave.player, realms: [grave.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
      }
      deadHero.isKing = true;
      deadHero._isHeir = false;
      deadHero._pendingSkillAllocation = 0;
      if (G.players[grave.player]) G.players[grave.player]._resurrectableMonarchId = null; // slot spent — he lives again
    } else {
      deadHero.player = c.player; // an ordinary raised hero serves the caster's realm
      deadHero.isKing = false;
      claimWandererName(deadHero); // a raised wanderer now serves this crown
    }
    if (!prov.characters.includes(deadHero.id)) prov.characters.push(deadHero.id);
    G.heroGraveyard = (G.heroGraveyard || []).filter((g) => g.id !== grave.id);
    G._resurrectedThisTurn.push(grave.id);
    const wasEnemy = grave.player != null && grave.player !== c.player;
    if (grave._monarch) {
      emit(turnContext, {
        type: 'explore',
        text: `✨👑 ${c.name} calls upon divine power — ${deadHero.name} rises from death at full health and reclaims the throne of ${player.name}! The rightful king walks again, stripped of all possessions but restored in spirit and skill.`,
        audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      emit(turnContext, {
        type: 'explore',
        text: `✨ ${c.name} calls upon divine power — ${deadHero.name} rises from death at full health, stripped of all possessions, and now serves ${player.name}!${wasEnemy ? ' The fallen foe is bound to a new master.' : ''}`,
        audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
    // The raise succeeded — now, and only now, honour any orders this player pre-wrote for
    // this hero. Matched on caster AND hero so a rival's pre-orders for the same corpse are
    // ignored; applied only to phases after the cast, since actingThisPhase() will skip the
    // hero in every earlier phase anyway (they were dead).
    {
      // the player portal now shows ONE order card per fallen hero, whichever of the realm's
      // casters targets them — so the orders apply if ANY of this realm's casters raises the
      // hero
      // (an exact caster match still wins if two cards were somehow submitted). A rival's orders never apply.
      const _pendAll = G._pendingResurrectOrders || [];
      const pend =
        _pendAll.find((x) => x.heroId === deadHero.id && x.casterId === c.id && x.player === c.player) ||
        _pendAll.find((x) => x.heroId === deadHero.id && x.player === c.player);
      if (pend && Array.isArray(pend.orders)) {
        const slots = G.turnOrders[deadHero.id] || [null, null, null, null, null];
        let applied = 0;
        pend.orders.forEach((o, pi2) => {
          if (pi2 > ph && o && o.action && o.action !== 'Defend' && o.action !== 'defend') {
            slots[pi2] = o;
            applied++;
          }
        });
        G.turnOrders[deadHero.id] = slots;
        if (applied > 0)
          emit(turnContext, {
            type: 'system',
            text: `${deadHero.name} takes up the orders ${player.name} laid down for them — ${applied} phase${applied !== 1 ? 's' : ''} of this turn remain to be acted on.`,
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
      }
      // Step 3 of order ingestion only defaults LIVING characters to Defend, and this hero
      // was a corpse when it ran. Fill the rest of the turn in now so they behave like anyone
      // else.
      const fin = G.turnOrders[deadHero.id] || [null, null, null, null, null];
      for (let pz = 0; pz < 5; pz++) {
        if (pz > ph && !fin[pz]) fin[pz] = { action: 'defend', target: '', extra: '', desc: 'Defend' };
      }
      G.turnOrders[deadHero.id] = fin;
      applyPendingSynthPlan(G, deadHero, c.player); // 2026-09-21: the card's encounter plan lands only now
    }
  } else if (fn === 'white_part_sea') {
    // A sea province the caster is in or adjacent to becomes plains for the rest of the turn.
    // the target may be a sea OR a land province in reach — a land province that has been
    // FLOODED into sea earlier this turn reads as terrain 'sea' at resolution, so Part Sea
    // reverts it (the intended Flood counter); a still-dry land target simply finds no sea to
    // part.
    const casterProv = G.world.provinces[c.location];
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => p2 && p2.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Part Sea can only target a province you are in or next to.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (blessWardNegates(turnContext, targetProv, c, 'Part Sea')) return; // Q2: a warded province can turn aside an enemy Part Sea too
    if (targetProv.terrain === 'sea') {
      // Part the waters: open sea OR a flooded land province becomes dry plains for the rest
      // of the turn.
      delete targetProv._flooded; // cancel any Flood on this province
      targetProv._partSea = { orig: targetProv.terrain, turn: G.turn, blockFleetsFromPhase: ph + 1 };
      targetProv.terrain = 'plains';
      emit(turnContext, {
        type: 'explore',
        text: `✨ ${c.name} raises their hands and the waters of ${targetProv.name} draw back — the seabed lies bare as dry plains for the rest of the turn. Land armies may cross freely, but no fleet can enter or leave from the next phase onward.`,
        audience: { actor: c.player, realms: [c.player], seen: 'there' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: targetProv.id,
        env: true,
      });
      notifyProvinceOwner(
        turnContext,
        targetProv,
        `🌊 ${c.name} (${G.players[c.player]?.name || 'a foreign realm'}) has parted the sea at ${targetProv.name} — it lies as dry plains for the rest of the turn; land armies may cross it and no fleet may enter or leave from the next phase.`,
        c.player,
        ph,
      ); // the owner is told
    } else {
      // Cast on dry land — the anticipated Flood never came (or was already parted). There is
      // no sea to part; clear any lingering flood marker and note it. The cast is spent but
      // harmless.
      delete targetProv._flooded;
      emit(turnContext, {
        type: 'explore',
        text: `✨ ${c.name} calls the waters back from ${targetProv.name}, but the ground already lies dry — the spell finds no sea to part.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: targetProv.id,
        env: true,
      });
    }
  } else if (fn === 'white_holy_symbol') {
    // ACTION FORM (Toby 2026-09-19): the Holy Symbol raised over the caster's own province lays
    // its battlefield dead to rest — every grave there is cleansed, so no necromancer can raise
    // them (Skeletal Armies, Harvest the Field, Raise Wraiths, Death's Dominion, Bind Wraith all
    // draw on prov.battleGraves). Always the province the caster stands in; no target.
    // The combat and battle-magic forms are unchanged.
    const _hsProv = G.world.provinces[c.location] || prov;
    const _dead = (_hsProv.battleGraves || []).length;
    TM(c).holyCasts += 1; // TITLE MERIT: Hierophant
    if (_dead === 0) {
      emit(turnContext, {
        type: 'explore',
        text: `✝ ${c.name} raises the Holy Symbol over ${_hsProv.name}, but no battlefield dead lie unquiet here — there is nothing to cleanse.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: _hsProv.id,
      });
    } else {
      _hsProv.battleGraves = [];
      logSplit(
        turnContext,
        'explore',
        `✝ ${c.name} raises the Holy Symbol over ${_hsProv.name} and the graves of its battlefield dead are cleansed — every fallen unit buried there is laid to rest, beyond the reach of any necromancer.`,
        `✝ ${c.name}${realmTag(turnContext, c.player)} raises a Holy Symbol over the battlefields of ${_hsProv.name}, and the dead buried there are laid to rest — the graves are cleansed and can no longer be raised.`,
        { audience: { actor: c.player }, province: _hsProv.id, hero: c.id, phase: ph },
      );
    }
    noteGraveIntel(G.players[c.player], _hsProv.id, G.turn, []); // the caster's realm now knows the ground is clean
  } else if (fn === 'white_bless_province') {
    const casterProv = G.world.provinces[c.location];
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => p2 && p2.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Bless Province can only target a province you are in or adjacent to.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetProv._blessedTurn === G.turn) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: ${targetProv.name} is already blessed this turn — a second Bless has no further effect (they do not stack).`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    targetProv._blessedTurn = G.turn;
    // Item: the blessing also WARDS the province — a chance to turn aside a later enemy Flood
    // / Earthquake / Plague / Part Sea. 2026-09-14: base 50% + 5% per point of the caster's
    // White skill, counted to level 5 — so 50% from an untrained blesser up to 75% from a
    // master. (Was 10% + 15%/level, i.e. 25% at White 1 rising to 85% at White 5: the ward is
    // now dependable at every level and much flatter across the ladder.)
    targetProv._blessWardTurn = G.turn;
    targetProv._blessWardBy = c.player;
    targetProv._blessWardPct = Math.min(100, 50 + 5 * Math.min(5, effStat(turnContext, c, 'white'))); // 50% + 5% per White skill level (cap level 5)
    TM(c).holyCasts += 1; // TITLE MERIT: Hierophant
    // DIVINE: a Divine realm's casters bless at +80% (the long-advertised alignment bonus,
    // previously described but never implemented — engine now honours it), and the Divine
    // KING himself blesses at +100% — the gods answer their anointed in full.
    const _divineKingdom = G.players[c.player]?.alignment === 'Divine';
    const _divineKingBless = c.isKing && _divineKingdom;
    targetProv._blessedMult =
      (_divineKingBless ? 2.0 : _divineKingdom ? 1.8 : 1.6) + discSum(turnContext, c.player, 'bless', 'pct'); // ad09 Rites of Plenty (+0.2)
    const _blessPct =
      `+${dispFloor((targetProv._blessedMult - 1) * 100)}% tax` +
      (_divineKingBless
        ? " (a Divine king's blessing — the gods answer their anointed in full)"
        : _divineKingdom
          ? ' (Divine blessing)'
          : '');
    emit(turnContext, {
      type: 'explore',
      text: `✨ ${c.name} blesses ${targetProv.name} — its lands flourish, yielding ${_blessPct} at collection this turn. The sacred ground is warded — a ${targetProv._blessWardPct}% chance to turn aside any enemy Flood, Earthquake, Plague or Part Sea cast here this turn.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
      env: true,
    });
  }

  // ── PSYCHIC ──
  else if (fn === 'psychic_charm') {
    const t = targetChar;
    if (!t || t.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        text: `Charm: no valid target hero stands in ${prov.name} this phase.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (t.player === c.player) {
      emit(turnContext, {
        type: 'system',
        text: `Charm cannot be used on your own heroes.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (t.isKing) {
      emit(turnContext, {
        type: 'system',
        text: `Charm cannot sway a king.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // A mind that has been swayed shuts against the next enchanter: a hero charmed on one
    // turn is IMMUNE to Charm for the whole of the following turn. `_charmImmuneTurn` is the
    // turn on which the immunity holds; it deliberately survives the end-of-turn flag sweep,
    // and is cleared lazily once it has passed.
    if (t._charmImmuneTurn != null && t._charmImmuneTurn < G.turn) delete t._charmImmuneTurn;
    if (t._charmImmuneTurn === G.turn) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}'s Charm slides off ${t.name} — a mind so lately swayed is closed to enchantment for a season.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      charmBacklash(turnContext, prov, c, t, 'closed to enchantment this season');
      return;
    }
    // every Charm that has ever taken hold leaves the mind 30% harder to sway —
    // `_charmResist` is cumulative and permanent (it survives the turn-end flag sweep like
    // _charmImmuneTurn does). Rolled here, after the cast itself has succeeded.
    if ((t._charmResist || 0) > 0) {
      const _rr = d100();
      emit(turnContext, {
        type: 'system',
        text: `📊 ${t.name} resists the Charm (${t._charmResist}% — swayed ${Math.round(t._charmResist / 30)} time${t._charmResist === 30 ? '' : 's'} before): ${fmtRoll(t._charmResist, _rr)}`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      if (_rr <= t._charmResist) {
        emit(turnContext, {
          type: 'system',
          text: `${c.name}'s Charm breaks against ${t.name}'s will — a mind that has been swayed before knows the feel of it, and shuts.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
        if (t.player != null)
          emit(turnContext, {
            type: 'system',
            text: `${t.name} feels an enchantment reach for their mind — and throws it off.`,
            audience: { actor: t.player, realms: [t.player] },
            hero: t.id,
            province: prov.id,
          });
        charmBacklash(turnContext, prov, c, t, 'the Charm was resisted');
        return;
      }
    }
    // the enchanter learns exactly what they have taken — the charmed hero's skills and every
    // magic item they carry, reported to the CASTER only.
    const _charmIntel = (hero) => {
      const sk = ABILITIES_P.filter((k) => skillLevel(hero, k) > 0).map(
        (k) => `${SKILL_LABELS[k] || k} ${skillLevel(hero, k)}`,
      );
      const its = (hero.items || []).filter(Boolean);
      emit(turnContext, {
        type: 'system',
        text: `🔍 ${c.name} reads ${hero.name}'s mind as the Charm takes hold — Skills: ${sk.length ? sk.join(', ') : 'none'}. Magic items: ${its.length ? itemNameList(its, true) : 'none'}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    };
    // Charm cannot reach the dead. (targetChar is already alive-filtered at resolution, so a
    // hero who fell earlier this turn never arrives here — this makes the rule explicit and
    // guards any future path that might resolve a target without the alive check.)
    if (t.alive === false) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}'s Charm reaches for ${t.name}, but there is no living mind left to sway.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // Charm sways only a LONE hero — one leading no armies (wandering OR enemy alike). A hero
    // at the head of a column is beyond a single enchanter's reach.
    if ((t.armies || []).length > 0) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}'s Charm cannot grip ${t.name} — a hero leading troops is beyond its reach.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // Apply this player's pre-written orders for the swayed hero to phases AFTER the cast,
    // then default any remaining post-cast phase to Defend. Matched on caster+hero+player so
    // a rival's pre-orders for the same hero are ignored. Shared by both charm outcomes.
    const _applyCharmOrders = (hero) => {
      const pend = (G._pendingCharmOrders || []).find(
        (x) => x.heroId === hero.id && x.casterId === c.id && x.player === c.player,
      );
      const slots = G.turnOrders[hero.id] || [null, null, null, null, null];
      let applied = 0;
      if (pend && Array.isArray(pend.orders)) {
        pend.orders.forEach((o, pi2) => {
          if (pi2 > ph && o && o.action && o.action !== 'Defend' && o.action !== 'defend') {
            slots[pi2] = o;
            applied++;
          }
        });
      }
      for (let pz = 0; pz < 5; pz++) {
        if (pz > ph && !slots[pz]) slots[pz] = { action: 'defend', target: '', extra: '', desc: 'Defend' };
      }
      G.turnOrders[hero.id] = slots;
      applyPendingSynthPlan(G, hero, c.player); // 2026-09-21: the card's encounter plan lands only now
      return applied;
    };
    if (t.player === null) {
      // Wandering hero — enters your service permanently for free (you still pay upkeep). A
      // hero released from service this turn cannot be charmed straight back by the same
      // realm.
      if (t._releasedTurn === G.turn && t._releasedBy === c.player) {
        emit(turnContext, {
          type: 'system',
          text: `${c.name}'s Charm finds ${t.name} unmoved — a hero only just dismissed will not be drawn back the same season.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        return;
      }
      // The Divine/Undead gulf binds even magic: no charm sways a soul across distance 6.
      const _chWage = heroHireWage(
        G.players[c.player]?.alignment || 'Neutral',
        t.alignment,
        hasDisc(turnContext, c.player, 'sd31'),
        t,
      );
      if (_chWage == null) {
        emit(turnContext, {
          type: 'system',
          text: `${c.name}'s Charm washes over ${t.name} and finds nothing to grip — ${t.alignment} souls cannot be swayed to a ${G.players[c.player]?.alignment} crown.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        return;
      }
      t.pay = _chWage;
      t.player = c.player;
      t.hiredInPhase = ph; // hiredInPhase gates acting to ph+1 (permanent join)
      claimWandererName(t); // they serve a crown now — drop the ' (wandering)' tag
      t._charmedTurn = G.turn; // a charmed mind will not send its possessions away this turn
      delete t._defend;
      delete t._pursuit;
      delete t._defendReactedPhase;
      if (typeof setMovePool === 'function') setMovePool(turnContext, t);
      t._charmImmuneTurn = G.turn + 1; // closed to any further Charm for the whole of next turn
      t._charmResist = Math.min(95, (t._charmResist || 0) + 30); // +30% resistance to every later Charm, cumulative (capped 95%)
      emit(turnContext, {
        type: 'hire',
        text: `✨ ${c.name}'s Charm sways ${t.name} — the wandering hero joins ${player.name} at no cost (you must still pay their upkeep).`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      _charmIntel(t); // 2026-09-18
      const applied = _applyCharmOrders(t);
      if (applied > 0)
        emit(turnContext, {
          type: 'system',
          text: `${t.name} takes up the orders ${player.name} laid down for them — ${applied} phase${applied !== 1 ? 's' : ''} of this turn remain to be acted on.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
    } else {
      // Enemy hero leading no armies — command seized for the REST OF THE TURN. Implemented
      // as a temporary player-swap: they act on YOUR orders and fight under your banner from
      // the next phase (actingThisPhase() gates them via _charmControlFrom). At Early
      // Winter's turn-end economy they revert to their own lord, who pays their wages — see
      // the charm-revert pass in the ph===4 block. A charmable enemy hero leads no armies
      // (checked above), so this never transfers a column or triggers an invasion by itself.
      const _origOwner = t.player;
      t._charmOriginalPlayer = _origOwner;
      t._charmedByPlayer = c.player;
      t._charmedForPhase = ph;
      t._charmTempControl = true;
      t._charmedTurn = G.turn; // 2026-09-12
      t._charmControlFrom = ph;
      t._charmImmuneTurn = G.turn + 1; // closed to any further Charm for the whole of next turn
      t._charmResist = Math.min(95, (t._charmResist || 0) + 30); // +30% resistance to every later Charm, cumulative (capped 95%)
      t.player = c.player;
      delete t._defend;
      delete t._pursuit;
      delete t._defendReactedPhase; // drop any watch/chase set under their old lord
      if (typeof setMovePool === 'function') setMovePool(turnContext, t);
      const applied = _applyCharmOrders(t);
      emit(turnContext, {
        type: 'hire',
        text: `✨ ${c.name}'s Charm grips ${t.name} — they fall under ${player.name}'s command until the season turns, when they return to their own lord (who still pays their wages).${applied > 0 ? ` ${applied} phase${applied !== 1 ? 's' : ''} of orders await them.` : ''}`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      _charmIntel(t); // 2026-09-18
      // file this under the CHARMED HERO (charId) — without it the entry inherited the
      // caster's charId from _logCtx, and the report's own-character rule handed the victim's
      // warning to the caster. After the ph-4 revert the hero belongs to _origOwner again, so
      // it lands in THEIR section only.
      emit(turnContext, {
        type: 'system',
        text: `⚠ ${t.name} is ensorcelled by an enemy Charm and slips your command until the season turns.`,
        audience: { actor: _origOwner, realms: [_origOwner] },
        hero: t.id,
        province: prov.id,
      });
    }
  } else if (fn === 'psychic_oratory') {
    // Self or an allied character in the same province — their travelling armies gain +1
    // quality this turn.
    // A NAMED ally who is not here is caught above (free refusal). What is left is a named
    // ally of another realm, or no target at all — self. Never silently swap a named target.
    if (targetChar && targetChar.player !== c.player) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}'s Oratory can only stir their own realm's troops — ${targetChar.name} serves another crown.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    const oratoryTarget =
      targetChar && targetChar.player === c.player && targetChar.location === c.location ? targetChar : c;
    const _oTiers = perkTier(c, 'psychic') >= 1 ? 2 : 1; // PSYCHIC L6 (Words of Awe): +2 quality tiers instead of +1
    oratoryTarget._oratoryBoost = _oTiers; // read by armStr: +N effective quality tiers (not cumulative)
    emit(turnContext, {
      type: 'explore',
      text: `✨ ${c.name}'s stirring Oratory lifts ${oratoryTarget === c ? 'their own' : oratoryTarget.name + "'s"} troops — every army travelling with ${oratoryTarget === c ? c.name : oratoryTarget.name} fights ${_oTiers > 1 ? 'two quality levels' : 'one quality level'} higher this turn.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: c.location,
    });
  } else if (fn === 'psychic_clairvoyance') {
    if (!targetChar) {
      // The intended target may have died (targetChar only resolves living characters). If
      // so, tell the caster their quarry is dead and where the body lies.
      const deadT = (G.characters || []).find((ch) => ch.id === extraId);
      if (deadT && !deadT.alive) {
        const grave = (G.heroGraveyard || []).find((g) => g.id === extraId);
        const bodyLoc = grave && grave.location != null ? grave.location : deadT.location;
        const bp = bodyLoc != null ? G.world.provinces[bodyLoc] : null;
        emit(turnContext, {
          type: 'explore',
          text: `✨ ${c.name} casts Clairvoyance upon ${deadT.name}, but reaches only silence — ${deadT.name} is dead. Their body lies in ${bp ? bp.name : 'parts unknown'}.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          spy: true,
          province: bodyLoc,
        });
        return;
      }
      emit(turnContext, {
        type: 'system',
        text: `Clairvoyance: choose a character you have seen to watch.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // Clairvoyance reaches a mind bound to a crown — it cannot be turned on a neutral or
    // wandering hero (a hero guarding a neutral province, or one roaming unaligned).
    if (targetChar.player == null) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}'s Clairvoyance finds no thread to follow — ${targetChar.name} serves no crown, and the spell cannot fix upon a wandering or neutral mind.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: c.location,
      });
      return;
    }
    // Only one Clairvoyance at a time — a new casting replaces the old.
    (G.characters || []).forEach((ch) => {
      if (Array.isArray(ch._clairvoyantBy)) ch._clairvoyantBy = ch._clairvoyantBy.filter((pl) => pl !== c.player);
    });
    targetChar._clairvoyantBy = targetChar._clairvoyantBy || [];
    if (!targetChar._clairvoyantBy.includes(c.player)) targetChar._clairvoyantBy.push(c.player);
    // remember this watch so the report can surface everything that befalls the target FROM
    // THIS PHASE ONWARD, filed into the caster's Realm Events. One watch per player.
    clairWatch[c.player] = { charId: targetChar.id, fromPhase: ph };
    // the watched character is SEEN wherever they end the turn — on the map, in hero
    // sightings and the Encounter list — as if spied on, and the mind-link pierces
    // Invisibility.
    if (G.players[c.player]) G.players[c.player]._clairCharThisTurn = targetChar.id;
    const tp = G.world.provinces[targetChar.location];
    // watching a character with Clairvoyance also reveals their full skills.
    {
      const actingP = G.players[c.player];
      if (actingP) {
        actingP._spiedHeroSkills = actingP._spiedHeroSkills || {};
        actingP._spiedHeroSkills[targetChar.id] = {
          name: targetChar.name,
          isKing: !!targetChar.isKing,
          alignment: targetChar.alignment || null,
          race: targetChar.race || null,
          kingdom: targetChar.player != null ? G.players[targetChar.player]?.name || null : null,
          skills: { ...(targetChar.skills || {}) },
          turn: G.turn,
        };
      }
    }
    emit(turnContext, {
      type: 'explore',
      text: `✨ ${c.name} opens their mind's eye upon ${targetChar.name} — all that befalls them is known to you for the rest of the turn. They are currently in ${tp ? tp.name : 'parts unknown'}.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      spy: true,
      province: targetChar.location,
    });
  } else if (fn === 'psychic_blast') {
    if (!targetChar || targetChar.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        text: `Psychic Blast: no valid target hero in ${prov.name} this phase.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        text: `Psychic Blast cannot be turned on your own heroes.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // The target loses 2 skill levels, each drawn from a random owned skill (the two picks
    // may land on the same skill, in which case it drops by 2).
    const _pbDrops = [];
    for (let _k = 0; _k < 2; _k++) {
      const owned = Object.keys(targetChar.skills || {}).filter((s) => (targetChar.skills[s] || 0) > 0);
      if (owned.length === 0) break;
      const sk = owned[Math.floor(kcRng() * owned.length)];
      targetChar.skills[sk] = Math.max(0, (targetChar.skills[sk] || 0) - 1);
      _pbDrops.push(SKILL_LABELS[sk] || sk);
    }
    if (_pbDrops.length === 0) {
      emit(turnContext, {
        type: 'combat',
        text: `✨ ${c.name}'s Psychic Blast rakes ${targetChar.name}'s mind, but they have no trained skills left to lose.`,
        audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        heroes: [c.id, targetChar.id].filter((v) => v != null),
        province: prov.id,
      });
      return;
    }
    emit(turnContext, {
      type: 'combat',
      text: `✨ ${c.name} unleashes Psychic Blast — ${targetChar.name}'s mind buckles, losing ${_pbDrops.join(' and ')}!`,
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      `🧠 ${targetChar.name} reels — ${c.name}'s Psychic Blast sears away ${_pbDrops.join(' and ')}.`,
      ph,
      'combat',
    );
    // 2026-09-21 (Toby): a hero stripped of skill levels commands a lower wage — re-evaluate it,
    // exactly as a skill rise does, and tell the hero's own realm.
    {
      const _pbPay0 = targetChar.pay || 0;
      recalcHeroPay(targetChar);
      const _pbPay1 = targetChar.pay || 0;
      if (targetChar.player != null && _pbPay1 !== _pbPay0)
        emit(turnContext, {
          type: 'system',
          text: `💰 ${targetChar.name}'s lost skill lowers their wage to ${_pbPay1}g/turn (was ${_pbPay0}g/turn).`,
          audience: { actor: targetChar.player, realms: [targetChar.player] },
          hero: targetChar.id,
          phase: ph,
        });
    }
  } else if (fn === 'psychic_storm') {
    if (!targetChar || targetChar.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        text: `Telekinetic Storm: no valid target hero in ${prov.name} this phase.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        text: `Telekinetic Storm cannot be turned on your own heroes.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const armies = targetChar.armies || [];
    if (armies.length === 0) {
      emit(turnContext, {
        type: 'combat',
        text: `✨ Telekinetic Storm buffets ${targetChar.name}, but they lead no armies to scatter.`,
        audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        heroes: [c.id, targetChar.id].filter((v) => v != null),
        province: prov.id,
      });
      return;
    }
    const n = Math.min(spellLevelEff, armies.length);
    const picks = shuffleP(armies).slice(0, n);
    let demoted = 0,
      destroyed = 0;
    const _lines = [];
    // the loss is PERMANENT — every struck unit drops one experience level for
    // good (Elite→Crack→Veteran→Average→Green), and a Green unit disbands outright, exactly as a battle
    // demotion does (demoteOrDisband). Skeletal units never change quality by any means, so
    // the storm rattles their bones and leaves them as they were. (Was: a strength penalty
    // for the rest of the turn.)
    picks.forEach((a) => {
      if (a._isSkeletal) {
        a._disbanded = true;
        destroyed++;
        _lines.push(`${a.unitName || a.type} shattered to dust — the storm scatters every bone`);
        return;
      } // skeletons shatter outright
      const _q0 = a.quality;
      if (demoteOrDisband(a)) {
        destroyed++;
        _lines.push(`${a.unitName || a.type} (${_q0}) torn apart and scattered for good`);
        return;
      }
      demoted++;
      _lines.push(`${a.unitName || a.type} ${_q0}→${a.quality}`);
    });
    targetChar.armies = armies.filter((a) => !a._disbanded);
    emit(turnContext, {
      type: 'combat',
      text: `✨ ${c.name}'s Telekinetic Storm hurls ${targetChar.name}'s troops about — ${n} unit${n !== 1 ? 's' : ''} caught: ${destroyed} shattered outright, ${demoted} permanently reduced one experience level. (${_lines.join('; ')})`,
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      `🌀 ${c.name}'s Telekinetic Storm scatters ${targetChar.name}'s formations — ${destroyed} destroyed, ${demoted} permanently reduced one experience level. (${_lines.join('; ')})`,
      ph,
      'combat',
    );
  }

  // ── ILLUSORY ──
  else if (fn === 'illusory_terrain') {
    const casterProv = G.world.provinces[c.location];
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => p2 && p2.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Illusory Terrain must target a province you are in or adjacent to.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // Sea → 50% looks like random land; land → 50% looks like sea (else a different random land).
    const LANDS = ['plain', 'forest', 'mountain', 'desert'];
    let fake;
    if (targetProv.terrain === 'sea') {
      fake = kcRng() < 0.5 ? LANDS[Math.floor(kcRng() * LANDS.length)] : 'sea';
    } else {
      fake = kcRng() < 0.5 ? 'sea' : LANDS.filter((t) => t !== targetProv.terrain)[Math.floor(kcRng() * 3)];
    }
    targetProv._illusoryTerrain = { caster: c.player, fake, appliedTurn: G.turn };
    emit(turnContext, {
      type: 'explore',
      text: `✨ ${c.name} cloaks ${targetProv.name} in shifting illusion — to enemy eyes the ground blurs and rearranges into ever-changing, confusing terrain. Any enemy who gives battle here is disoriented, each of their units fighting as though caught in the worst possible ground for its kind (at least −15% strength).`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
    });
  } else if (fn === 'illusory_phantasmal') {
    // Target: the caster themselves, or any friendly hero in the SAME province. No longer
    // requires the target to be leading armies at cast time — the buff sits on the character
    // and is spent by the next battle they fight, so it still pays off if they pick up or
    // recruit armies in a later phase this turn.
    const t = targetChar && targetChar.player === c.player ? targetChar : c;
    if (t.id !== c.id && t.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Phantasmal Armies must target yourself or an allied hero in your province.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const _realForce = (t.armies || []).filter((a) => a && !a._phantom);
    const _elig = _realForce.filter((a) => !CREATURE_ARMIES.has(a.type) && !MONSTER_ARMIES.has(a.type));
    if (_elig.length === 0) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: ${t === c ? 'you have' : t.name + ' has'} no humanoid armies for Phantasmal Armies to duplicate.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const _n = Math.min(_elig.length, Math.max(1, Math.floor(0.1 * Math.min(spellLevel, 5) * _realForce.length))); // 10% of the host per level, capped at level 5 (was 15%)
    t._phantoms = t._phantoms || [];
    shuffleP(_elig)
      .slice(0, _n)
      .forEach((orig) => {
        if (!orig._phTag) orig._phTag = 'ph' + (G._phSeq = (G._phSeq || 0) + 1);
        t._phantoms.push({
          type: orig.type,
          quality: orig.quality,
          race: orig.race,
          unitName: orig.unitName,
          _phantomOf: orig._phTag,
        });
      }); // random selection
    emit(turnContext, {
      type: 'explore',
      text: `✨ ${c.name} conjures phantasmal duplicates of ${_n} of ${t === c ? 'their' : t.name + "'s"} humanoid ${_n === 1 ? 'army' : 'armies'} — spectral doubles that march and fight with the real host for the rest of the turn, melting away if their true selves fall or the force is beaten.`,
      audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: t.location,
    });
  } else if (fn === 'illusory_hide_feature') {
    const casterProv = G.world.provinces[c.location];
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => p2 && p2.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Hide Lairs must target a province you are in or adjacent to.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const toHide = (targetProv.features || []).filter((f) => !f._hidden);
    if (toHide.length === 0) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: there are no lairs left to hide in ${targetProv.name}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    toHide.forEach((f) => {
      f._hidden = true;
      f._hiddenBy = c.player;
    });
    emit(turnContext, {
      type: 'explore',
      text: `✨ ${c.name} veils ${targetProv.name} in confounding illusion — every lair within (${toHide.length}) vanishes from all other explorers' sight, and none can be freshly discovered here until the glamour fades.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
    });
  }

  // ── ELEMENTAL ──
  // (Lightning Bolt & Fireball are combat/battle-magic spells only — no action-phase form.)
  else if (fn === 'elemental_earthquake') {
    const casterProv = G.world.provinces[c.location];
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => p2 && p2.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Earthquake must target your province or one adjacent.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (blessWardNegates(turnContext, targetProv, c, 'Earthquake')) return;
    targetProv._earthquakeNoTax = G.turn;
    emit(turnContext, {
      type: 'combat',
      text: `✨ ${c.name} rends the earth beneath ${targetProv.name} — its fields and roads are ruined, and it will yield no tax at the end of this turn.`,
      audience: {
        actor: c.player,
        realms: targetProv.owner != null && targetProv.owner !== c.player ? [targetProv.owner] : [],
        seen: 'battle',
      },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
      env: true,
    });
    notifyProvinceOwner(
      turnContext,
      targetProv,
      `🜃 An enemy Earthquake has torn through ${targetProv.name} — it will yield no tax this turn.`,
      c.player,
      ph,
    );
  } else if (fn === 'elemental_flood') {
    const casterProv = G.world.provinces[c.location];
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => p2 && p2.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Flood must target a land province you are in or adjacent to.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetProv.terrain === 'sea') {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Flood can only be cast on a land province.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // Cancel Part Sea if present, then submerge the province for the rest of the turn.
    if (blessWardNegates(turnContext, targetProv, c, 'Flood')) return;
    if (targetProv._partSea) {
      delete targetProv._partSea;
    }
    targetProv._flood = { orig: targetProv.terrain, turn: G.turn };
    targetProv.terrain = 'sea';
    emit(turnContext, {
      type: 'combat',
      text: `✨ ${c.name} calls up the deluge — ${targetProv.name} vanishes beneath the waves and acts as a sea province for the rest of the turn. Land armies are stranded; only fleets and flyers may pass.`,
      audience: {
        actor: c.player,
        realms: targetProv.owner != null && targetProv.owner !== c.player ? [targetProv.owner] : [],
        seen: 'battle',
      },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
      env: true,
    });
    notifyProvinceOwner(
      turnContext,
      targetProv,
      `🌊 An enemy Flood has swallowed ${targetProv.name} — it acts as sea for the rest of the turn, and any land army there is stranded.`,
      c.player,
      ph,
    );
  } else if (fn === 'elemental_summon') {
    if (c._elementalSummonedThisTurn) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name} has already summoned an elemental this turn.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const ELEMENTALS = [
      { type: 'Air Elemental', unitName: 'the Howling Gale' },
      { type: 'Fire Elemental', unitName: 'the Living Conflagration' },
      { type: 'Earth Elemental', unitName: 'the Walking Mountain' },
      { type: 'Water Elemental', unitName: 'the Surging Tide' },
      { type: 'Darkness Elemental', unitName: 'the Devouring Shade' },
    ];
    const pick = ELEMENTALS[Math.floor(kcRng() * ELEMENTALS.length)];
    const elemental = {
      type: pick.type,
      quality: 'Veteran',
      race: 'Elemental',
      unitName: pick.unitName,
      _temporary: true,
      _expiresAfterPhase: -1,
    };
    c.armies = c.armies || [];
    c.armies.push(elemental);
    c._elementalSummonedThisTurn = true;
    logSplit(
      turnContext,
      'explore',
      `✨ ${c.name} tears open a rift in ${prov.name} and ${pick.unitName} — a ${pick.type} — surges forth to fight under your command! It will dissolve at the end of the turn.`,
      `✨ ${c.name}${realmTag(turnContext, c.player)} tears open a rift in ${prov.name} — ${pick.unitName}, a ${pick.type}, surges forth to fight under their banner.`,
      { audience: { actor: c.player }, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING, province: prov.id },
    );
    resolveUnitGainInProvince(turnContext, c, prov, ph);
  }

  // ── NECROMANCY ──
  else if (fn === 'necromancy_control') {
    // Province-scan mode: cast on the province the caster stands in to sense the battlefield
    // dead lying there (the units a Skeletal Armies cast could raise).
    //
    // AN UNTARGETED CONTROL UNDEAD IS A PROVINCE SCAN. The spell has two modes and the order
    // form offers both in one dropdown, whose default option is the empty "— Target character
    // —". A player who chose Control Undead and left that default sent `extra:''`, which fell
    // through to the seize-a-unit branch and was reported as "no valid target hero stands in
    // <province> this phase" — a failure, for a spell that had a perfectly good thing to do
    // where the caster was standing. An empty target is now read as the scan: there is always
    // a province underfoot, so the cast is never wasted.
    if (extra === '' || extra == null || extra === '__scan__') {
      const graves = prov.battleGraves || [];
      if (graves.length === 0) {
        noteGraveIntel(G.players[c.player], prov.id, G.turn, []); // seen bare — forget any stale record
        emit(turnContext, {
          type: 'explore',
          text: `✨ ${c.name}'s Control Undead searches ${prov.name} for the dead — but no fallen army units lie here to sense.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
      } else {
        const counts = {};
        graves.forEach((g) => {
          const k = `${g.quality || 'Average'} ${g.type}`;
          counts[k] = (counts[k] || 0) + 1;
        });
        const list = Object.entries(counts)
          .map(([k, nn]) => `${nn}× ${k}`)
          .join(', ');
        noteGraveIntel(G.players[c.player], prov.id, G.turn, graves); // the fuller reading is kept in Graveyards known
        emit(turnContext, {
          type: 'explore',
          text: `💀 ${c.name}'s Control Undead senses the dead of ${prov.name}: ${list}. (${graves.length} grave${graves.length !== 1 ? 's' : ''} that could be raised as skeletal servants.)`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
      }
      // THE SPELL REACHES PAST THE PROVINCE LINE. The caster also feels which of the
      // SURROUNDING provinces hold battlefield dead. That is all it gives: existence, never
      // the count and never what the graves hold — for that a caster must stand on the ground
      // and scan it. Each neighbour is written into the realm's graveyard lore with `null`
      // detail, which noteGraveIntel treats as a bare sensing (any richer reading already on
      // record keeps its own older turn stamp and is NOT downgraded); a neighbour sensed
      // EMPTY is written as `[]`, which clears any stale promise of graves there. Both feed
      // the report's Graveyards Known.
      {
        const _pl = G.players[c.player];
        const _nbrs = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).filter(
          (p2) => p2 && p2.id != null,
        );
        const _withDead = [];
        _nbrs.forEach((nb) => {
          if ((nb.battleGraves || []).length > 0) {
            noteGraveIntel(_pl, nb.id, G.turn, null);
            _withDead.push(nb.name);
          } else noteGraveIntel(_pl, nb.id, G.turn, []);
        });
        if (_withDead.length > 0)
          emit(turnContext, {
            type: 'explore',
            text: `💀 ${c.name}'s sending spreads out from ${prov.name} and the dead answer from beyond its borders — battlefield graves lie in ${_withDead.sort().join(', ')}. How many, and what they hold, only a caster standing on that ground could say.`,
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
        else if (_nbrs.length > 0)
          emit(turnContext, {
            type: 'explore',
            text: `✨ ${c.name}'s sending spreads out from ${prov.name}, but the lands around it are quiet — no battlefield dead lie in any neighbouring province.`,
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
      }
      trySkillGain(turnContext, c, school, SKILLGAIN_STD);
      return;
    }
    if (!targetChar || targetChar.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        text: `Control Undead: no valid target hero stands in ${prov.name} this phase.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        text: `Control Undead cannot be turned on your own heroes.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const undeadIdxs = (targetChar.armies || [])
      .map((a, i) => ({ a, i }))
      .filter(
        (x) => x.a._isSkeletal || x.a.race === 'Undead' || /Skelet|Bone|Wraith|Zombie|Ghoul|Lich/i.test(x.a.type || ''),
      );
    if (undeadIdxs.length === 0) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}'s Control Undead finds no undead among ${targetChar.name}'s forces.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    const pick = undeadIdxs[Math.floor(kcRng() * undeadIdxs.length)];
    const seized = targetChar.armies.splice(pick.i, 1)[0];
    c.armies = c.armies || [];
    c.armies.push(seized);
    logSplit(
      turnContext,
      'hire',
      `✨ ${c.name}'s Control Undead wrests the ${seized.unitName || seized.type} from ${targetChar.name} in ${prov.name} — it now marches under your banner!`,
      `✨ ${c.name}${realmTag(turnContext, c.player)}'s Control Undead wrests the ${seized.unitName || seized.type} from ${targetChar.name}${realmTag(turnContext, targetChar.player)} in ${prov.name} — it now marches under ${c.name}'s banner.`,
      {
        audience: { actor: c.player },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        alsoNotFor: [targetChar.player],
      },
    );
    notifyTarget(
      turnContext,
      targetChar,
      `✨ ${c.name}${realmTag(turnContext, c.player)}'s Control Undead wrests the ${seized.unitName || seized.type} from ${targetChar.name} in ${prov.name} — it now marches under the enemy's banner.`,
      ph,
      'hire',
    );
    resolveUnitGainInProvince(turnContext, c, prov, ph);
  } else if (fn === 'necromancy_skeletal') {
    // Skeletal Armies: raise destroyed armies from this province's battlefield graves
    const graves = prov.battleGraves || [];
    if (graves.length === 0) {
      emit(turnContext, {
        type: 'explore',
        text: `${c.name} calls out to the fallen in ${prov.name}, but there are no battlefield dead here to answer. Seek a province where armies have previously perished.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    // Units raised per cast scale with the caster's Necromancy (benefit scale, items count):
    // 1 at level 1-2, 2 at level 3-4, 3 at level 5+ — never more than the graves hold. An
    // item-cast by a non-necromancer (Reaper's Bell, Ossuary Key) raises one.
    const _skN = skeletalRaiseCount(effStat(turnContext, c, 'necromancy'));
    const _uTier = gdActive(turnContext, c.player, 'Undead'); // GRAND DESIGN — Undead: +1 tier when raised
    for (let _sk = 0; _sk < _skN && (prov.battleGraves || []).length > 0; _sk++) {
      const grave = takeBestGrave(prov); // the most experienced dead answer first
      if (!grave) break;
      const skel = {
        type: grave.type,
        quality: _uTier ? KC_QUALITY_UP[grave.quality] || grave.quality : grave.quality,
        race: 'Undead',
        _isSkeletal: true,
        unitName: `${grave.unitName || armyUnitName(grave.type)} (Skeletal)`,
      };
      c.armies = c.armies || [];
      c.armies.push(skel);
      emit(turnContext, {
        type: 'explore',
        text: `💀 ${c.name} calls forth ${skel.unitName} — a ${skel.quality} ${skel.type} rises from the graves of ${prov.name} to serve! (Upkeep 1g/turn.)`,
        audience: { actor: c.player, realms: [c.player], seen: 'there' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
    // the caster has just gained a unit here — if this is a neutral/enemy province, that
    // force must fight any defenders this phase, or take control if the land is undefended.
    resolveUnitGainInProvince(turnContext, c, prov, ph);
  } else if (fn === 'necromancy_curse') {
    if (!targetChar || targetChar.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        text: `Curse: no valid target hero in ${prov.name} this phase.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        text: `Curse cannot be turned on your own heroes.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // EVERY skill the target has is halved (rounded down) for the rest of the turn — was the
    // single highest skill. A second Curse the same turn halves what is left again.
    const _cursed = Object.entries(targetChar.skills || {}).filter(([, v]) => v > 0);
    if (!_cursed.length) {
      emit(turnContext, {
        type: 'system',
        text: `${targetChar.name} has no skills to curse.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    targetChar._curses = targetChar._curses || {};
    const _parts = _cursed.map(([sk, val]) => {
      const cur = Math.max(0, val - (targetChar._curses[sk] || 0)); // what the skill IS right now, after any earlier curse
      const reduce = cur - Math.floor(cur / 2);
      targetChar._curses[sk] = (targetChar._curses[sk] || 0) + reduce;
      return `${SKILL_LABELS[sk] || sk} ${cur}→${Math.floor(cur / 2)}`;
    });
    emit(turnContext, {
      type: 'combat',
      text: `✨ ${c.name}'s Curse settles over ${targetChar.name} — every skill is halved for the rest of the turn (${_parts.join(', ')})!`,
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      `☠ A Curse from ${c.name} settles over ${targetChar.name} — every skill is halved for the rest of the turn (${_parts.join(', ')}).`,
      ph,
      'combat',
    );
  }
  // (Hand of Death is a combat-only spell — no action-phase form.)
  else if (fn === 'necromancy_plague') {
    // Target the caster's province or an adjacent one.
    const casterProv = G.world.provinces[c.location];
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => p2 && p2.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Plague must target your province or one adjacent.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetProv._plaguedTurn === G.turn) {
      emit(turnContext, {
        type: 'system',
        text: `${targetProv.name} is already stricken with plague this turn — a second casting adds nothing (not cumulative).`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (blessWardNegates(turnContext, targetProv, c, 'Plague')) return;
    targetProv._plaguedTurn = G.turn;
    targetProv._plagueLevel = spellLevelEff;
    targetProv._plagueCaster = c.player;
    const res = applyPlague(turnContext, targetProv, spellLevelEff, ph);
    emit(turnContext, {
      type: 'combat',
      text: `☠ ${c.name} calls down a Plague upon ${targetProv.name} — of ${res.tested} humanoid unit${res.tested !== 1 ? 's' : ''}, ${res.affected} sicken and lose an experience level. It may spread to neighbouring lands in the phases to come.`,
      audience: {
        actor: c.player,
        realms: targetProv.owner != null && targetProv.owner !== c.player ? [targetProv.owner] : [],
        seen: 'battle',
      },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
      env: true,
    });
    notifyProvinceOwner(
      turnContext,
      targetProv,
      `☠ An enemy Plague has struck ${targetProv.name} — ${res.affected} of your unit${res.affected !== 1 ? 's there sicken' : ' there sickens'} and may spread to neighbouring lands.`,
      c.player,
      ph,
    );
  }

  // ══ LEVEL 7 & 9 MASTERY SPELLS ════
  // WHITE
  else if (fn === 'white_sanctuary') {
    const casterProv = G.world.provinces[c.location];
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => p2 && p2.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Sanctuary must ward your province or one adjacent.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    targetProv._sanctuaryTurn = G.turn;
    targetProv._sanctuaryBy = c.player;
    emit(turnContext, {
      type: 'explore',
      text: `✨ ${c.name} raises a Sanctuary over ${targetProv.name} — hostile armies that give battle here fight at −25% strength this turn.`,
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
    });
    notifyProvinceOwner(
      turnContext,
      targetProv,
      `✨ ${c.name} (${G.players[c.player]?.name || 'a foreign realm'}) has raised a Sanctuary over ${targetProv.name} — armies hostile to that realm that give battle there fight at −25% strength this turn.`,
      c.player,
      ph,
    ); // the owner is told
  } else if (fn === 'white_judgment') {
    if (!targetChar || targetChar.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        text: `Divine Judgment: no valid enemy hero in ${prov.name} this phase.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        text: `Divine Judgment cannot be turned on your own heroes.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const dmg = 10 + spellLevelEff * 3;
    targetChar.hp = Math.max(1, (targetChar.hp || 20) - dmg);
    const src = targetChar.armies || [];
    const kills = Math.min(src.length, 2 + Math.floor(spellLevelEff / 2));
    const idxs = shuffleP(src.map((_, i) => i))
      .slice(0, kills)
      .sort((a, b) => b - a);
    idxs.forEach((i) => src.splice(i, 1));
    emit(turnContext, {
      type: 'combat',
      text: `⚡ ${c.name} calls down Divine Judgment on ${targetChar.name} — ${dmg} holy damage${kills > 0 ? `, and ${kills} of their unit${kills !== 1 ? 's' : ''} are smitten to ash` : ''}!`,
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      `⚡ Divine Judgment falls on ${targetChar.name} from ${c.name} — ${dmg} holy damage${kills > 0 ? `, ${kills} unit${kills !== 1 ? 's' : ''} smitten` : ''}.`,
      ph,
      'combat',
    );
  }
  // PSYCHIC
  else if (fn === 'psychic_massconfusion') {
    if (!targetChar || targetChar.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        text: `Mass Confusion: no valid enemy hero in ${prov.name} this phase.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        text: `Mass Confusion cannot be turned on your own heroes.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    targetChar._massConfusedTurn = G.turn;
    emit(turnContext, {
      type: 'combat',
      text: `✨ ${c.name} sows Mass Confusion through ${targetChar.name}'s ranks — their commander's Tactical genius deserts them in their next battle this turn.`,
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      `✨ Mass Confusion from ${c.name} grips ${targetChar.name} — their Tactical command deserts them in their next battle.`,
      ph,
      'combat',
    );
  } else if (fn === 'psychic_dominate') {
    if (!targetChar || targetChar.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        text: `Dominate: no valid enemy hero in ${prov.name} this phase.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        text: `Dominate cannot be turned on your own heroes.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const src = targetChar.armies || [];
    if (src.length === 0) {
      emit(turnContext, {
        type: 'combat',
        text: `✨ ${c.name}'s Dominate grips ${targetChar.name}, but they lead no troops to turn.`,
        audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        heroes: [c.id, targetChar.id].filter((v) => v != null),
        province: prov.id,
      });
      return;
    }
    const take = Math.max(1, Math.floor(src.length * 0.25));
    const idxs = shuffleP(src.map((_, i) => i))
      .slice(0, take)
      .sort((a, b) => b - a);
    const seized = idxs.map((i) => src.splice(i, 1)[0]);
    c.armies = (c.armies || []).concat(seized);
    logSplit(
      turnContext,
      'hire',
      `✨ ${c.name} Dominates ${targetChar.name} in ${prov.name} — ${seized.length} of their unit${seized.length !== 1 ? 's' : ''} turn coat and march under your banner!`,
      `✨ ${c.name}${realmTag(turnContext, c.player)} Dominates ${targetChar.name}${realmTag(turnContext, targetChar.player)} in ${prov.name} — ${seized.length} of their unit${seized.length !== 1 ? 's' : ''} turn coat and march under ${c.name}'s banner.`,
      {
        audience: { actor: c.player },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        alsoNotFor: [targetChar.player],
      },
    );
    notifyTarget(
      turnContext,
      targetChar,
      `✨ ${c.name}${realmTag(turnContext, c.player)} Dominates ${targetChar.name} in ${prov.name} — ${seized.length} of their unit${seized.length !== 1 ? 's' : ''} turn coat and desert to the enemy.`,
      ph,
      'hire',
    );
    resolveUnitGainInProvince(turnContext, c, prov, ph);
  }
  // ILLUSORY
  else if (fn === 'illusory_phantomhost') {
    const _realForceH = (c.armies || []).filter((a) => a && !a._phantom);
    const _eligH = _realForceH.filter((a) => CREATURE_ARMIES.has(a.type) || MONSTER_ARMIES.has(a.type));
    if (_eligH.length === 0) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: you lead no monsters or creatures for Phantom Host to duplicate.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const _nH = Math.min(_eligH.length, Math.max(1, Math.floor(0.1 * Math.min(spellLevel, 5) * _realForceH.length))); // 10% of the host per level, capped at level 5 (was 15%)
    c._phantoms = c._phantoms || [];
    shuffleP(_eligH)
      .slice(0, _nH)
      .forEach((orig) => {
        if (!orig._phTag) orig._phTag = 'ph' + (G._phSeq = (G._phSeq || 0) + 1);
        c._phantoms.push({
          type: orig.type,
          quality: orig.quality,
          race: orig.race,
          unitName: orig.unitName,
          _phantomOf: orig._phTag,
        });
      }); // random selection
    emit(turnContext, {
      type: 'explore',
      text: `✨ ${c.name} conjures a Phantom Host — spectral doubles of ${_nH} of their ${_nH === 1 ? 'beast' : 'beasts'} that fight with the real host for the rest of the turn, melting away if their true selves fall or the force is beaten.`,
      audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  } else if (fn === 'illusory_invisibility') {
    // Invisibility as an ACTION spell — self only. 80% to slip from all enemy sight for the
    // rest of this turn (report sightings, spy reports, Encounter targeting and the map all
    // honour _invisTurn). Fails (20%): visible as normal.
    const _ivRoll = d100();
    if (_ivRoll <= 80) {
      c._invisTurn = G.turn;
      c._unspottedTurn = G.turn;
      emit(turnContext, {
        type: 'explore',
        text: `✨ ${c.name} weaves Invisibility about themself — no enemy eye will find them for the rest of this turn. ${fmtRoll(80, _ivRoll)}`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else
      emit(turnContext, {
        type: 'explore',
        text: `✨ ${c.name}'s Invisibility shimmers and fails to hold — they remain in plain sight. ${fmtRoll(80, _ivRoll)}`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
  } else if (fn === 'illusory_veil') {
    c._veilTurn = G.turn;
    c._veilCastPhase = ph; // ILLUSORY L9 Veil: active THIS phase and the next (two phases)
    emit(turnContext, {
      type: 'explore',
      text: `✨ ${c.name} draws a Veil of illusion over their host — for this phase and the next, they and the armies they lead vanish from all enemy sight, cannot be touched by hostile magic, and cannot be brought to battle. The illusion parts as the phase after next begins.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  }
  // ELEMENTAL
  else if (fn === 'elemental_chainlightning') {
    if (!targetChar || targetChar.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        text: `Chain Lightning: no valid enemy hero in ${prov.name} this phase.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        text: `Chain Lightning cannot be turned on your own heroes.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const src = targetChar.armies || [];
    if (src.length === 0) {
      emit(turnContext, {
        type: 'combat',
        text: `✨ Chain Lightning crackles around ${targetChar.name}, but they lead no troops to strike.`,
        audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        heroes: [c.id, targetChar.id].filter((v) => v != null),
        province: prov.id,
      });
      return;
    }
    const pool = Math.floor(src.length * 0.3);
    if (pool <= 0) {
      emit(turnContext, {
        type: 'combat',
        text: `⚡ ${c.name}'s Chain Lightning crackles around ${targetChar.name}'s handful of troops but earths out without a kill.`,
        audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        heroes: [c.id, targetChar.id].filter((v) => v != null),
        province: prov.id,
      });
      return;
    }
    const idxs = shuffleP(src.map((_, i) => i))
      .slice(0, pool)
      .sort((a, b) => b - a);
    let killed = 0;
    idxs.forEach((i) => {
      if (kcRng() < 0.5) {
        src.splice(i, 1);
        killed++;
      }
    });
    emit(turnContext, {
      type: 'combat',
      text: `⚡ ${c.name}'s Chain Lightning arcs through ${targetChar.name}'s ranks — of ${pool} unit${pool !== 1 ? 's' : ''} caught in the arc, ${killed} ${killed === 1 ? 'is' : 'are'} blasted apart!`,
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      `⚡ ${c.name}'s Chain Lightning tears through ${targetChar.name}'s ranks — ${killed} unit${killed !== 1 ? 's' : ''} blasted apart.`,
      ph,
      'combat',
    );
  } else if (fn === 'elemental_cataclysm') {
    const casterProv = G.world.provinces[c.location];
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => p2 && p2.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        text: `${c.name}: Cataclysm must target your province or one adjacent.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    targetProv._earthquakeNoTax = G.turn;
    targetProv.tax = 0;
    targetProv._taxDestroyed = true; // Cataclysm now ruins the tax base PERMANENTLY
    let totalDestroyed = 0;
    const _ccVictims = new Set();
    (G.characters || [])
      .filter(
        (ch) => ch.alive && ch.location === targetProv.id && ch.player !== c.player && (ch.armies || []).length > 0,
      )
      .forEach((ch) => {
        const n = Math.min(ch.armies.length, 1 + Math.floor(spellLevelEff / 2));
        const idxs = shuffleP(ch.armies.map((_, i) => i))
          .slice(0, n)
          .sort((a, b) => b - a);
        idxs.forEach((i) => ch.armies.splice(i, 1));
        totalDestroyed += n;
        if (ch.player != null) _ccVictims.add(ch.player);
      });
    if (targetProv.owner != null && targetProv.owner !== c.player) _ccVictims.add(targetProv.owner);
    emit(turnContext, {
      type: 'combat',
      text: `☄ ${c.name} calls down a Cataclysm upon ${targetProv.name} — ${totalDestroyed} enemy unit${totalDestroyed !== 1 ? 's' : ''} destroyed, and the land is left permanently barren (tax base reduced to 0 for good).`,
      audience: { actor: c.player, realms: [..._ccVictims], seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
    });
    notifyProvinceOwner(
      turnContext,
      targetProv,
      `☄ An enemy Cataclysm has devastated ${targetProv.name} — its tax base is permanently ruined${totalDestroyed > 0 ? ` and ${totalDestroyed} of your unit${totalDestroyed !== 1 ? 's were' : ' was'} destroyed` : ''}.`,
      c.player,
      ph,
    );
  }
  // NECROMANCY
  else if (fn === 'necromancy_wraiths') {
    const graves = prov.battleGraves || [];
    if (graves.length === 0) {
      emit(turnContext, {
        type: 'explore',
        text: `${c.name}'s call for Wraiths finds no battlefield dead in ${prov.name} to answer.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    let _wbi = 0,
      _wbs = -1;
    prov.battleGraves.forEach((gr, i) => {
      const st = unitBaseStrength({ type: gr.type, quality: gr.quality || 'Average' });
      if (st > _wbs) {
        _wbs = st;
        _wbi = i;
      }
    }); // raise the STRONGEST fallen unit
    const g = prov.battleGraves.splice(_wbi, 1)[0];
    const wraith = {
      type: g.type,
      quality: 'Elite',
      race: 'Undead',
      _isSkeletal: true,
      _isWraith: true,
      unitName: `Wraiths (${armyUnitName(g.type)})`,
    };
    c.armies = c.armies || [];
    c.armies.push(wraith);
    logSplit(
      turnContext,
      'explore',
      `💀 ${c.name} binds the dead of ${prov.name} into ${wraith.unitName} — Elite undead at your side! (Upkeep 1g/turn.)`,
      `💀 ${c.name}${realmTag(turnContext, c.player)} binds the dead of ${prov.name} into ${wraith.unitName} — Elite undead now march at their side.`,
      { audience: { actor: c.player }, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING, province: prov.id },
    );
    resolveUnitGainInProvince(turnContext, c, prov, ph);
  } else if (fn === 'necromancy_dominion') {
    const graves = prov.battleGraves || [];
    if (graves.length === 0) {
      emit(turnContext, {
        type: 'explore',
        text: `${c.name}'s Death's Dominion finds no fallen army in ${prov.name} to raise.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    const QUALITY_UP = { ...KC_QUALITY_UP };
    // Death's Dominion already raises the dead one tier stronger than they fell. The
    // Deathless Legion adds ITS tier on top, so an Undead realm holding its Wonder pulls them
    // up TWO tiers — Average dead rise Crack. Elite is still the ceiling.
    const _ddUp = gdActive(turnContext, c.player, 'Undead')
      ? (q) => QUALITY_UP[QUALITY_UP[q] || q] || QUALITY_UP[q] || q
      : (q) => QUALITY_UP[q] || q;
    const n = Math.min(graves.length, spellLevelEff);
    let raised = 0;
    for (let k = 0; k < n; k++) {
      const g = takeBestGrave(prov);
      if (!g) break;
      /*best first, down the line */ c.armies = c.armies || [];
      c.armies.push({
        type: g.type,
        quality: _ddUp(g.quality),
        race: 'Undead',
        _isSkeletal: true,
        unitName: `${g.unitName || armyUnitName(g.type)} (Skeletal)`,
      });
      raised++;
    }
    emit(turnContext, {
      type: 'explore',
      text: `💀 ${c.name} unleashes Death's Dominion over ${prov.name} — ${raised} skeletal unit${raised !== 1 ? 's' : ''} claw up from the graves to serve!`,
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    resolveUnitGainInProvince(turnContext, c, prov, ph);
  }

  // Magic school skill gain on a successful action cast
  trySkillGain(turnContext, c, school, SKILLGAIN_STD);
  return;
}
