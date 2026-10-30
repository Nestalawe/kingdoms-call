import { KC_QUALITY_UP, SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { actionSpellsAllowedPerSchoolEachTurn } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import {
  CHARMED_NO_TURN_SPELLS,
  COMBAT_ONLY_TACTICS,
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
import { claimWandererName } from '../heroes/fame-and-consecration.ts';
import { activeItems } from '../items/equipment.ts';
import { armyUnitName, d100, rng } from '../dice-and-army-names.ts';
import { markProvinceCombat } from '../bots/intel.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { TM, perkTier, skillLevel } from '../titles/perks.ts';
import { graveServedOther, isPreOrderRef, orderCharRef } from '../heroes/charms-and-neutrals.ts';
import { castChanceFor } from '../chances-and-lair-grades.ts';
import { _BEST_SCHOOL } from '../titles/reckoning.ts';
import { applyPendingSynthPlan, discSum, gdActive, hasDisc } from '../discoveries.ts';
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
import { theItemsAsTheLineNamesThem } from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';
import { theGravesAsTheLineCountsThem } from './the-facts-the-cast-spell-orders-lines-record.ts';
import { asItsGuardReadsIt } from '../personal-combat/to-hit-wounds-stuns-and-courage.ts';
import type {
  ACompanyTheStormStrikes,
  WhyAnEnchantedHeroMayTurnOnHisEnchanter,
} from './the-facts-the-cast-spell-orders-lines-record.ts';
import type { ArmyInABattle, HeroInABattle } from '../army-tables.ts';
import type { GameState, Grave, Province, Realm } from '../../schemas/saved-game-state.ts';
import type { TurnContext, TurnOrder } from '../turn/context.ts';

/** A hero as the Cast Spell order marks him: a hero in a turn (the battle's marks: Oratory's tiers, the Charm's
 *  seizure), his companies as a battle marks them (the Telekinetic Storm's), and the turn's marks only the spells write.
 *  None is in the saved state's schema; each is wiped by the new turn, or never saved. */
type AHeroAsTheCastMarksHim = Omit<HeroInABattle, 'armies'> & {
  armies: ArmyInABattle[];
  /** The Wailing Phylactery's sure Necromancy cast is spent for the turn. */
  _necroAutoUsed?: boolean;
  /** He has summoned an elemental this turn (Summon Elemental, once a turn). */
  _elementalSummonedThisTurn?: boolean;
  /** The realms that watch him with Clairvoyance (one watch a realm). */
  _clairvoyantBy?: number[];
  /** The levels each Curse this turn has taken from each skill. */
  _curses?: Record<string, number>;
};
/** A province as the Cast Spell order marks it: a province, and the marks of Part Sea and Flood, which the new turn
 *  takes back. */
type AProvinceAsTheCastMarksIt = Province & {
  /** A Flood's older mark (the new turn wipes it): Part Sea and a Flood cancel it. */
  _flooded?: unknown;
  /** Part Sea's waters drawn back: the terrain it had, the turn, and the phase from which no fleet sails there. */
  _partSea?: { orig: string; turn: number; blockFleetsFromPhase: number };
  /** A Flood: the terrain it had, and the turn. */
  _flood?: { orig: string; turn: number };
};
/** A hero's order as the Cast Spell order marks it: the turn's order, and whether it was refused before it was worked
 *  (it spends no casting slot). */
type AnOrderAsTheCastMarksIt = TurnOrder & { _castNotWorked?: boolean };
/** A realm's orders for a hero it means to raise or charm, held by the merge until the spell takes (each field compared
 *  as it is; the orders a list of the phases', with gaps). */
interface OrdersHeldForAHero {
  readonly heroId?: unknown;
  readonly casterId?: unknown;
  readonly player?: unknown;
  readonly orders?: (TurnOrder | null | undefined)[] | null | undefined;
}
/** The state as the Cast Spell order reads it: its heroes and provinces as it marks them, the graveyard as a guard reads
 *  it (an older save may lack it), the heroes' orders for the turn (the saved state holds them cleared), and the turn's
 *  lists of the heroes raised and the orders held for a hero a realm means to raise or charm. */
type TheStateAsTheCastReadsIt = Omit<GameState, 'characters' | 'world' | 'heroGraveyard' | 'turnOrders'> & {
  characters: AHeroAsTheCastMarksHim[];
  world: Omit<GameState['world'], 'provinces'> & { provinces: AProvinceAsTheCastMarksIt[] };
  heroGraveyard?: Grave[] | undefined;
  turnOrders: Record<string, (AnOrderAsTheCastMarksIt | null | undefined)[] | undefined>;
  _resurrectedThisTurn?: number[];
  _pendingResurrectOrders?: readonly OrdersHeldForAHero[] | undefined;
  _pendingCharmOrders?: readonly OrdersHeldForAHero[] | undefined;
  _pendingSynthPlans?: unknown;
};
/** A spell's row as the order reads it by any name. */
interface ASpellAsTheCastReadsIt {
  readonly school: string;
  readonly phase: boolean;
  readonly fn: string;
  readonly reqLevel?: number;
}
/** Whether a hero serves a realm. */
function servesARealm<Hero extends { readonly player: number | null }>(
  h: Hero,
): h is Hero & { readonly player: NonNullable<Hero['player']> } {
  return h.player !== null;
}
/** The caster's realm's name: processOrder hands a hero of a realm his realm, so there is one; for none, the TypeError
 *  the read of its name would throw. */
function theCastersRealmsName(player: Realm | undefined) {
  if (!player) throw new TypeError("Cannot read properties of undefined (reading 'name')");
  return player.name;
}
/** A realm's name by its index, as a line names a hero's realm: none for no realm (a wanderer's), or no realm there. */
function aRealmsNameOrNone(players: readonly Realm[], pi: number | null) {
  const realm = pi === null ? undefined : players[pi];
  return realm ? realm.name : null;
}
/** The province the caster stands in, as a spell's reach is measured from it: every living hero stands in a province of
 *  the map (the matrix's invariant "armies in real provinces"), so there is one; for none, the TypeError its first read
 *  throws. */
function theProvinceTheCasterStandsIn(p: AProvinceAsTheCastMarksIt | undefined) {
  if (!p) throw new TypeError("Cannot destructure property 'row' of 'prov' as it is undefined.");
  return p;
}
/** What a die picks from a list the code has just made sure holds something (an index below its length); for none, a
 *  TypeError. */
function theOneThePickFell<Picked>(picked: Picked | undefined): Picked {
  if (picked === undefined) throw new TypeError('a pick from a list fell on nothing');
  return picked;
}
/** The one taken out of a list at an index the code has just drawn from it (there is always one); for none, a
 *  TypeError. */
function theOneTakenOut<Taken>(list: Taken[], i: number): Taken {
  const [taken] = list.splice(i, 1);
  return theOneThePickFell(taken);
}

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
export function charmBacklash(
  turnContext: TurnContext,
  prov: Province,
  caster: AHeroAsTheCastMarksHim,
  t: AHeroAsTheCastMarksHim | null | undefined,
  why: WhyAnEnchantedHeroMayTurnOnHisEnchanter,
) {
  const { G } = turnContext;
  if (!t || asItsGuardReadsIt(t.alive) === false || t.location !== caster.location) return;
  const targetsPi = [caster.player, t.player].filter((x) => x != null);
  const roll = d100();
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: 'an enchanted hero may turn on his enchanter',
      targetName: t.name,
      casterName: caster.name,
      why: why,
      chance: CHARM_BACKLASH_PCT,
      roll: roll,
    },
    audience: { actor: caster.player, realms: [caster.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  if (roll > CHARM_BACKLASH_PCT) return;
  ensureEncounterPlan(turnContext, caster);
  ensureEncounterPlan(turnContext, t);
  const leadsFlee = (ch: Pick<AHeroAsTheCastMarksHim, 'encounterPlan'>) => {
    // split gives at least one piece: `?? ''` never holds
    const first = (((ch.encounterPlan?.tactics ?? ['ME'])[0] ?? '').split(':')[0] ?? '').toUpperCase();
    return first === 'FL' || first === 'FLEE';
  };
  if (leadsFlee(caster) || leadsFlee(t)) {
    const who = leadsFlee(caster) ? caster : t;
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'an enchanted hero rounds on his enchanter but one of them slips away',
        targetName: t.name,
        casterName: caster.name,
        slipsAwayName: who.name,
      },
      audience: { actor: caster.player, realms: targetsPi },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: [caster.id, t.id],
    });
    return;
  }
  const COMBAT_ONLY = COMBAT_ONLY_TACTICS;
  const filterPlan = (plan: AHeroAsTheCastMarksHim['encounterPlan']) =>
    (plan?.tactics ?? ['ME']).filter(
      // split gives at least one piece: `?? ''` never holds
      (x) => COMBAT_ONLY.has((x.split(':')[0] ?? '').toUpperCase()) || x.toUpperCase().startsWith('CA:'),
    );
  const atkPlan = filterPlan(t.encounterPlan);
  if (!atkPlan.length) atkPlan.push('ME');
  const defPlan = filterPlan(caster.encounterPlan);
  if (!defPlan.length) defPlan.push('ME');
  const _duelChars = [t.id, caster.id];
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: 'an enchanted hero rounds on his enchanter and blades are drawn',
      targetName: t.name,
      casterName: caster.name,
    },
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
    (...a: [hero: unknown, stat: unknown]) => effStat(turnContext, ...a),
    rng,
    G,
  );
  enc.narrative.forEach((line) => {
    emitNarrLine(turnContext, line, {
      type: 'combat',
      audience: { actor: caster.player, realms: targetsPi },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: _duelChars,
    });
  });
  if (t.player !== null) t.hp = Math.max(1, enc.atkHp);
  caster.hp = Math.max(1, enc.defHp);
  if (enc.atkKilled || enc.atkHp <= 0) {
    if (_escapesTheEnd(t)) {
      const theTargetsHp = asItsGuardReadsIt(t.hp);
      if (theTargetsHp != null && theTargetsHp <= 0) t.hp = 1;
      emit(turnContext, {
        type: 'combat',
        fact: _garrethEscapeLine(t),
        audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      });
    } else {
      reportHeroFall(
        turnContext,
        t,
        caster,
        {
          kind: 'a hero is slain outside a battle',
          heroName: t.name,
          how: 'by the enchanter he turned on',
          killerName: null,
        },
        {
          audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
          heroes: _duelChars,
        },
      );
      awardKillXP(turnContext, caster, t);
    }
  }
  if (enc.defKilled || enc.defHp <= 0) {
    if (_escapesTheEnd(caster)) {
      const theCastersHp = asItsGuardReadsIt(caster.hp);
      if (theCastersHp != null && theCastersHp <= 0) caster.hp = 1;
      emit(turnContext, {
        type: 'combat',
        fact: _garrethEscapeLine(caster),
        audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      });
    } else {
      reportHeroFall(
        turnContext,
        caster,
        t,
        {
          kind: 'a hero is slain outside a battle',
          heroName: caster.name,
          how: 'by his failed Charm',
          killerName: null,
        },
        {
          audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
          heroes: _duelChars,
        },
      );
      awardKillXP(turnContext, t, caster);
    }
  }
}
// Cast Spell: the casting limits, the cast chance and its roll, then the spell, school by school (a spell item's Use Item arrives here as a cast).
export function resolveCastSpellOrder(
  turnContext: TurnContext,
  c: AHeroAsTheCastMarksHim,
  o: AnOrderAsTheCastMarksIt,
  ph: number,
  target: string,
  extra: string | null | undefined,
  prov: AProvinceAsTheCastMarksIt,
  player: Realm | undefined,
  _itemCast: { item: string; spell: string | undefined } | null,
) {
  const { G, _tel, clairWatch }: Pick<TurnContext, '_tel' | 'clairWatch'> & { readonly G: TheStateAsTheCastReadsIt } =
    turnContext;
  // Only a hero of a realm acts in a phase (actingThisPhase passes none without one, and Release Hero frees only the
  // hero who gives it, for the phases after), so the caster always serves one; for none, a TypeError.
  if (!servesARealm(c)) throw new TypeError('a hero who serves no realm casts a spell');
  // the spells' rows by any name (the key "undefined" for none, as JavaScript reads it)
  const spellDefs: Readonly<Partial<Record<string, ASpellAsTheCastReadsIt>>> = SPELL_DEFS_P;
  // target = spell name, extra = target province id or character id (if needed)
  const spellName = _itemCast ? _itemCast.spell : target;
  const spellDef = spellDefs[String(spellName)];
  if (!spellDef || spellName === undefined) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero names a spell there is none of', heroName: c.name, spellName: spellName },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  if (!spellDef.phase) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a spell cannot be worked as a phase order', heroName: c.name, spellName: spellName },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // a seized ENEMY hero will not turn hostile magic on their own lord's characters (the same
  // rule as Encounter) — refused BEFORE the cast is even attempted, so it costs no casting
  // slot. Other realms' heroes: as normal.
  if (c._charmTempControl && c._charmOriginalPlayer != null && CHARMED_NO_TURN_SPELLS.has(spellName)) {
    const _lordChar = G.characters.find((ch) => ch.alive && ch.id === (parseInt(String(extra)) || -1));
    if (_lordChar?.player === c._charmOriginalPlayer) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a charmed hero will not turn a spell on his own lord's people",
          heroName: c.name,
          spellName: spellName,
        },
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
    const _castsSoFar = (G.turnOrders[c.id] ?? []).slice(0, ph).filter((o) => {
      if (!o || normaliseAction(o) !== 'cast_spell') return false;
      if (o._castNotWorked) return false; // never left the caster's lips
      if (o.target === 'Bless Province' && _divCath) return false; // a Grand Cathedral's Bless never consumes a slot
      return spellDefs[o.target]?.school === _school;
    }).length;
    if (_castsSoFar >= _limit && _lvl > 0 && !(spellName === 'Bless Province' && _divCath)) {
      o._castNotWorked = true; // 2026-10-13 (item 16): a blocked cast is never worked, so it spends no slot either
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a school's casting limit blocks a spell",
          heroName: c.name,
          school: _school,
          schoolLevel: _lvl,
          castsSoFar: _castsSoFar,
          limit: _limit,
          spellName: spellName,
        },
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
      fact: {
        kind: 'a hero lacks the skill a spell needs after a practice that did not raise it',
        heroName: c.name,
        spellName: spellName,
        school: school,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }
  // L7/L9 mastery spells require the RAW school level (past-5 comes from experience only).
  if (_itemCast && spellDef.reqLevel) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'an item can no longer work a mastery spell',
        heroName: c.name,
        itemName: _itemCast.item,
        spellName: spellName,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  } // Item 6
  if (!_itemCast && spellDef.reqLevel && skillLevel(c, school) < spellDef.reqLevel) {
    o._castNotWorked = true; // never worked: no casting slot spent (item 16)
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'a hero has not yet reached the level a mastery spell demands',
        heroName: c.name,
        spellName: spellName,
        school: school,
        levelDemanded: spellDef.reqLevel,
        levelReached: skillLevel(c, school),
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return;
  }

  // ── ONCE PER TURN ── a mastery spell (L7/L9, has reqLevel) may be attempted only once per
  // turn per caster. Base spells keep the per-school casting limit above; this is the extra
  // cap.
  if (spellDef.reqLevel) {
    c._masterySpellUsed = c._masterySpellUsed ?? {};
    if (c._masterySpellUsed[spellName] === G.turn) {
      o._castNotWorked = true; // never worked: no casting slot spent (item 16)
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a mastery spell is worked but once a turn', heroName: c.name, spellName: spellName },
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
    activeItems(c).some((it) => asItsGuardReadsIt(it.effect)?.stat === 'necroAuto');
  const castChance = castChanceFor(c, school, G.players[c.player], {
    chars: asItsGuardReadsIt(G.characters) ?? [],
    itemCast: !!_itemCast,
    necroAuto,
  }).chance;
  if (necroAuto && !_itemCast) c._necroAutoUsed = true;
  // ── TARGET STILL HERE? ── Refused BEFORE the roll, so a spell that was never worked costs
  // neither the cast nor the turn's casting slot. This is what a caster meets when the hero
  // they aimed at has left the province — most often a general on Defend who rode out to a
  // threatened neighbour at the top of the phase, before any order resolved.
  if (SPELL_FNS_NEED_COLOCATED_TARGET.has(spellDef.fn)) {
    const _tid = parseInt(String(extra));
    const _t = Number.isInteger(_tid)
      ? (asItsGuardReadsIt<readonly (AHeroAsTheCastMarksHim | null | undefined)[]>(G.characters) ?? []).find(
          (ch) => ch?.alive && ch.id === _tid,
        )
      : null;
    if (_t && _t.location !== c.location) {
      const _tp = G.world.provinces[_t.location];
      const _own = _t.player === c.player;
      o._castNotWorked = true; // costs no casting slot for the rest of the turn
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a spell's mark has gone from the province",
          heroName: c.name,
          targetName: _t.name,
          spellName: spellName,
          theMarkServesTheCastersRealm: _own,
          whereTheMarkWentName: _tp ? _tp.name : null,
        },
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
      fact: {
        kind: 'a hero invokes an item to work a spell',
        heroName: c.name,
        itemName: _itemCast.item,
        spellName: spellName,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    trySkillGain(turnContext, c, 'sage', SKILLGAIN_COMMON);
  } // 2026-09-21: using a magic item may teach Sage (small chance)
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: "a spell's cast is rolled",
      heroName: c.name,
      spellName,
      school,
      spellLevel,
      trainedLevel: skillLevel(c, school),
      byAnItem: !!_itemCast,
      chance: castChance,
      roll: castRoll,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });

  if (castRoll > castChance) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a spell fizzles without effect', heroName: c.name, spellName: spellName },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    if (!_itemCast) trySkillGain(turnContext, c, school, SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn (an item's cast teaches nothing when it fails)
    // a fizzled Charm may bring its intended victim down on the caster.
    if (spellDef.fn === 'psychic_charm') {
      const _ct = G.characters.find((ch) => ch.alive && ch.id === (parseInt(String(extra)) || -1));
      if (_ct && _ct.player !== c.player && !_ct.isKing)
        charmBacklash(turnContext, prov, c, _ct, { kind: 'the Charm fizzled' });
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
  const extraId = isPreOrderRef(extra) ? (orderCharRef(G, extra) ?? { id: -1 }).id : parseInt(String(extra)) || 0;
  const targetProv = extraId >= 0 && G.world.provinces[extraId] ? G.world.provinces[extraId] : prov;
  const targetChar = G.characters.find((ch) => ch.alive && ch.id === extraId);
  // THIEF L9 Vanish: a vanished character cannot be reached by ANY hostile spell for the rest
  // of the turn.
  if (targetChar && targetChar.player !== c.player && isVanished(turnContext, targetChar)) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a spell's mark has vanished",
        heroName: c.name,
        spellName: spellName,
        targetName: targetChar.name,
      },
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
      fact: {
        kind: "a spell's mark is veiled from hostile magic",
        heroName: c.name,
        spellName: spellName,
        targetName: targetChar.name,
      },
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
      fact: {
        kind: "a spell's mark is cloaked from hostile magic",
        heroName: c.name,
        spellName: spellName,
        targetName: targetChar.name,
      },
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
    G.heroGraveyard ??= [];
    G._resurrectedThisTurn ??= [];
    // A fallen MONARCH's body was borne home when he died and stays there, even if that
    // province has since been captured (2026-10-08, Toby item 1) — never move it here.
    const knownIds = new Set(G.players[c.player]?.knownDeadHeroIds ?? []);
    // the body must lie in the CASTER'S OWN province for any of this to resolve — and a
    // caster standing over a corpse can plainly see it. Requiring a remembered death as well
    // meant a visible body could never be raised. (Monarch graves keep their own separate
    // guards below: only the fallen king's own realm, only the most recent monarch.)
    const _graveKnown = (g: Grave | null | undefined) => !!g && (knownIds.has(g.id) || g.location === c.location);
    // Resolve which grave: honour the EXPLICITLY chosen body (needed so a player can name
    // their fallen king rather than whatever corpse is freshest), else the most recent known
    // body here.
    // (targetChar only matches LIVE characters, so a dead target never bound here before — the
    // selection silently fell through to "most recent". Match the graveyard by id directly.)
    const _explicitGraveId = extra != null && extra.trim() !== '' ? parseInt(extra) : NaN;
    const grave = Number.isInteger(_explicitGraveId)
      ? G.heroGraveyard.find((g) => g.id === _explicitGraveId && g.location === c.location && _graveKnown(g))
      : G.heroGraveyard
          .filter((g) => g.location === c.location && _graveKnown(g))
          .sort((a, b) => b.killedOnTurn - a.killedOnTurn)[0];
    if (!grave) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'Resurrect finds no fallen hero known to lie in the province',
          heroName: c.name,
          provinceName: prov.name,
        },
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
          fact: {
            kind: "a fallen monarch's crown answers only to its own realm",
            heroName: c.name,
            fallenName: grave.name,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        return;
      }
      if (G.players[c.player]?._resurrectableMonarchId !== grave.id) {
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "a fallen monarch's spirit has passed beyond recall",
            heroName: c.name,
            fallenName: grave.name,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        return;
      }
    } else if (grave.isKing) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a fallen king cannot be resurrected', heroName: c.name, fallenName: grave.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    } else if (graveServedOther(grave, c.player)) {
      // 2026-09-23 (Toby): a hero who ever served ANOTHER realm cannot be raised into yours.
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'a fallen hero sworn to another crown will not answer',
          heroName: c.name,
          fallenName: grave.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (G._resurrectedThisTurn.includes(grave.id)) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a fallen hero has already been raised this turn', heroName: c.name, fallenName: grave.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const deadHero = G.characters.find((ch) => ch.id === grave.id);
    if (!deadHero) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "a fallen hero's spirit cannot be found", heroName: c.name, fallenName: grave.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (!grave._monarch && deadHero.isKing) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'kings cannot be resurrected', heroName: c.name },
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
          fact: {
            kind: 'a reigning monarch steps down as the fallen monarch is restored',
            regentName: curMonarch.name,
            restoredName: deadHero.name,
          },
          audience: { actor: grave.player, realms: [grave.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
      }
      deadHero.isKing = true;
      deadHero._isHeir = false;
      deadHero._pendingSkillAllocation = 0;
      const theFallenMonarchsRealm = grave.player === null ? undefined : G.players[grave.player];
      if (theFallenMonarchsRealm) theFallenMonarchsRealm._resurrectableMonarchId = null; // slot spent — he lives again
    } else {
      deadHero.player = c.player; // an ordinary raised hero serves the caster's realm
      deadHero.isKing = false;
      claimWandererName(deadHero); // a raised wanderer now serves this crown
    }
    if (!prov.characters.includes(deadHero.id)) prov.characters.push(deadHero.id);
    G.heroGraveyard = (asItsGuardReadsIt(G.heroGraveyard) ?? []).filter((g) => g.id !== grave.id);
    G._resurrectedThisTurn.push(grave.id);
    const wasEnemy = grave.player != null && grave.player !== c.player;
    if (grave._monarch) {
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'a fallen monarch rises and reclaims the throne',
          heroName: c.name,
          restoredName: deadHero.name,
          realmName: theCastersRealmsName(player),
        },
        audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'a fallen hero rises to serve the realm',
          heroName: c.name,
          restoredName: deadHero.name,
          realmName: theCastersRealmsName(player),
          wasAFoe: wasEnemy,
        },
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
      const _pendAll = G._pendingResurrectOrders ?? [];
      const pend =
        _pendAll.find((x) => x.heroId === deadHero.id && x.casterId === c.id && x.player === c.player) ??
        _pendAll.find((x) => x.heroId === deadHero.id && x.player === c.player);
      if (pend && Array.isArray(pend.orders)) {
        const slots = G.turnOrders[deadHero.id] ?? [null, null, null, null, null];
        let applied = 0;
        pend.orders.forEach((o, pi2) => {
          if (pi2 > ph && o?.action && o.action !== 'Defend' && o.action !== 'defend') {
            slots[pi2] = o;
            applied++;
          }
        });
        G.turnOrders[deadHero.id] = slots;
        if (applied > 0)
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: 'a hero takes up the orders his realm laid down for him',
              heroName: deadHero.name,
              realmName: theCastersRealmsName(player),
              phasesLeft: applied,
            },
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          });
      }
      // Step 3 of order ingestion only defaults LIVING characters to Defend, and this hero
      // was a corpse when it ran. Fill the rest of the turn in now so they behave like anyone
      // else.
      const fin = G.turnOrders[deadHero.id] ?? [null, null, null, null, null];
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
    const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => asItsGuardReadsIt(p2)?.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Part Sea is cast beyond its reach', heroName: c.name },
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
        fact: { kind: 'the waters of a province draw back', heroName: c.name, provinceName: targetProv.name },
        audience: { actor: c.player, realms: [c.player], seen: 'there' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: targetProv.id,
        env: true,
      });
      notifyProvinceOwner(
        turnContext,
        targetProv,
        {
          kind: 'a realm learns the sea was parted at its province',
          heroName: c.name,
          castersRealmName: (G.players[c.player]?.name ?? '') || null,
          provinceName: targetProv.name,
        },
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
        fact: { kind: 'Part Sea finds no sea to part', heroName: c.name, provinceName: targetProv.name },
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
    const _hsProv = G.world.provinces[c.location] ?? prov;
    const _dead = (_hsProv.battleGraves ?? []).length;
    TM(c).holyCasts += 1; // TITLE MERIT: Hierophant
    if (_dead === 0) {
      emit(turnContext, {
        type: 'explore',
        fact: { kind: 'the Holy Symbol finds no dead to cleanse', heroName: c.name, provinceName: _hsProv.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: _hsProv.id,
      });
    } else {
      _hsProv.battleGraves = [];
      logSplit(
        turnContext,
        'explore',
        { kind: 'the Holy Symbol cleanses the graves of a province', heroName: c.name, provinceName: _hsProv.name },
        {
          kind: 'onlookers see a Holy Symbol cleanse the graves of a province',
          heroName: c.name,
          realmName: aRealmsNameOrNone(G.players, c.player),
          provinceName: _hsProv.name,
        },
        { audience: { actor: c.player }, province: _hsProv.id, hero: c.id, phase: ph },
      );
    }
    noteGraveIntel(G.players[c.player], _hsProv.id, G.turn, []); // the caster's realm now knows the ground is clean
  } else if (fn === 'white_bless_province') {
    const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => asItsGuardReadsIt(p2)?.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Bless Province is cast beyond its reach', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetProv._blessedTurn === G.turn) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a province is already blessed this turn', heroName: c.name, provinceName: targetProv.name },
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
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'a province is blessed and warded',
        heroName: c.name,
        provinceName: targetProv.name,
        blessedMultiplier: targetProv._blessedMult,
        byADivineKing: _divineKingBless,
        byADivineRealm: _divineKingdom,
        wardChance: targetProv._blessWardPct,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
      env: true,
    });
  }

  // ── PSYCHIC ──
  else if (fn === 'psychic_charm') {
    const t = targetChar;
    if (t?.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Charm finds no hero to sway in the province', provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (t.player === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "Charm cannot be used on the realm's own heroes" },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (t.isKing) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Charm cannot sway a king' },
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
        fact: { kind: 'a Charm slides off a mind lately swayed', heroName: c.name, targetName: t.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      charmBacklash(turnContext, prov, c, t, { kind: 'the mind is closed to enchantment this season' });
      return;
    }
    // every Charm that has ever taken hold leaves the mind 30% harder to sway —
    // `_charmResist` is cumulative and permanent (it survives the turn-end flag sweep like
    // _charmImmuneTurn does). Rolled here, after the cast itself has succeeded.
    if (t._charmResist !== undefined && t._charmResist > 0) {
      const _rr = d100();
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a mind's resistance to a Charm is rolled",
          targetName: t.name,
          resistance: t._charmResist,
          roll: _rr,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      if (_rr <= t._charmResist) {
        emit(turnContext, {
          type: 'system',
          fact: { kind: 'a Charm breaks against a mind swayed before', heroName: c.name, targetName: t.name },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
        if (t.player != null)
          emit(turnContext, {
            type: 'system',
            fact: { kind: 'a hero throws off an enchantment', targetName: t.name },
            audience: { actor: t.player, realms: [t.player] },
            hero: t.id,
            province: prov.id,
          });
        charmBacklash(turnContext, prov, c, t, { kind: 'the Charm was resisted' });
        return;
      }
    }
    // the enchanter learns exactly what they have taken — the charmed hero's skills and every
    // magic item they carry, reported to the CASTER only.
    const _charmIntel = (hero: AHeroAsTheCastMarksHim) => {
      const sk = ABILITIES_P.filter((k) => skillLevel(hero, k) > 0).map((k): [skill: string, level: number] => [
        k,
        skillLevel(hero, k),
      ]);
      const its = (asItsGuardReadsIt(hero.items) ?? []).filter(Boolean);
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "an enchanter reads a charmed hero's mind",
          heroName: c.name,
          targetName: hero.name,
          skills: sk,
          items: theItemsAsTheLineNamesThem(its),
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    };
    // Charm cannot reach the dead. (targetChar is already alive-filtered at resolution, so a
    // hero who fell earlier this turn never arrives here — this makes the rule explicit and
    // guards any future path that might resolve a target without the alive check.)
    if (asItsGuardReadsIt(t.alive) === false) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a Charm finds no living mind to sway', heroName: c.name, targetName: t.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // Charm sways only a LONE hero — one leading no armies (wandering OR enemy alike). A hero
    // at the head of a column is beyond a single enchanter's reach.
    if ((asItsGuardReadsIt(t.armies) ?? []).length > 0) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a Charm cannot grip a hero leading troops', heroName: c.name, targetName: t.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // Apply this player's pre-written orders for the swayed hero to phases AFTER the cast,
    // then default any remaining post-cast phase to Defend. Matched on caster+hero+player so
    // a rival's pre-orders for the same hero are ignored. Shared by both charm outcomes.
    const _applyCharmOrders = (hero: AHeroAsTheCastMarksHim) => {
      const pend = (G._pendingCharmOrders ?? []).find(
        (x) => x.heroId === hero.id && x.casterId === c.id && x.player === c.player,
      );
      const slots = G.turnOrders[hero.id] ?? [null, null, null, null, null];
      let applied = 0;
      if (pend && Array.isArray(pend.orders)) {
        pend.orders.forEach((o, pi2) => {
          if (pi2 > ph && o?.action && o.action !== 'Defend' && o.action !== 'defend') {
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
          fact: { kind: 'a Charm finds a hero just dismissed unmoved', heroName: c.name, targetName: t.name },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        return;
      }
      // The Divine/Undead gulf binds even magic: no charm sways a soul across distance 6.
      const _chWage = heroHireWage(
        (G.players[c.player]?.alignment ?? '') || 'Neutral',
        t.alignment,
        hasDisc(turnContext, c.player, 'sd31'),
        t,
      );
      if (_chWage == null) {
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "a Charm cannot sway a soul across the alignments' gulf",
            heroName: c.name,
            targetName: t.name,
            targetsAlignment: t.alignment,
            realmsAlignment: G.players[c.player]?.alignment,
          },
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
      t._charmResist = Math.min(95, (Number(t._charmResist) || 0) + 30); // +30% resistance to every later Charm, cumulative (capped 95%)
      emit(turnContext, {
        type: 'hire',
        fact: {
          kind: 'a Charm sways a wandering hero into service',
          heroName: c.name,
          targetName: t.name,
          realmName: theCastersRealmsName(player),
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      _charmIntel(t); // 2026-09-18
      const applied = _applyCharmOrders(t);
      if (applied > 0)
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: 'a hero takes up the orders his realm laid down for him',
            heroName: t.name,
            realmName: theCastersRealmsName(player),
            phasesLeft: applied,
          },
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
      t._charmResist = Math.min(95, (Number(t._charmResist) || 0) + 30); // +30% resistance to every later Charm, cumulative (capped 95%)
      t.player = c.player;
      delete t._defend;
      delete t._pursuit;
      delete t._defendReactedPhase; // drop any watch/chase set under their old lord
      if (typeof setMovePool === 'function') setMovePool(turnContext, t);
      const applied = _applyCharmOrders(t);
      emit(turnContext, {
        type: 'hire',
        fact: {
          kind: 'a Charm seizes an enemy hero until the season turns',
          heroName: c.name,
          targetName: t.name,
          realmName: theCastersRealmsName(player),
          phasesOfOrders: applied,
        },
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
        fact: { kind: 'a realm learns its hero is ensorcelled by an enemy Charm', targetName: t.name },
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
        fact: { kind: "Oratory cannot stir another realm's troops", heroName: c.name, targetName: targetChar.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    const oratoryTarget = targetChar?.player === c.player && targetChar.location === c.location ? targetChar : c;
    const _oTiers = perkTier(c, 'psychic') >= 1 ? 2 : 1; // PSYCHIC L6 (Words of Awe): +2 quality tiers instead of +1
    oratoryTarget._oratoryBoost = _oTiers; // read by armStr: +N effective quality tiers (not cumulative)
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'Oratory lifts the troops a hero leads',
        heroName: c.name,
        onTheCasterHimself: oratoryTarget === c,
        targetName: oratoryTarget.name,
        qualityLevels: _oTiers,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: c.location,
    });
  } else if (fn === 'psychic_clairvoyance') {
    if (!targetChar) {
      // The intended target may have died (targetChar only resolves living characters). If
      // so, tell the caster their quarry is dead and where the body lies.
      const deadT = (asItsGuardReadsIt(G.characters) ?? []).find((ch) => ch.id === extraId);
      if (deadT && !deadT.alive) {
        const grave = (G.heroGraveyard ?? []).find((g) => g.id === extraId);
        const theGravesPlace = asItsGuardReadsIt(grave?.location);
        const bodyLoc = theGravesPlace ?? asItsGuardReadsIt(deadT.location);
        const bp = bodyLoc != null ? G.world.provinces[bodyLoc] : null;
        emit(turnContext, {
          type: 'explore',
          fact: {
            kind: 'Clairvoyance finds its mark dead',
            heroName: c.name,
            targetName: deadT.name,
            bodyProvinceName: bp ? bp.name : null,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          spy: true,
          province: bodyLoc,
        });
        return;
      }
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Clairvoyance needs a hero to watch' },
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
        fact: {
          kind: 'Clairvoyance cannot fix on a mind that serves no crown',
          heroName: c.name,
          targetName: targetChar.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: c.location,
      });
      return;
    }
    // Only one Clairvoyance at a time — a new casting replaces the old.
    (asItsGuardReadsIt(G.characters) ?? []).forEach((ch) => {
      if (Array.isArray(ch._clairvoyantBy)) ch._clairvoyantBy = ch._clairvoyantBy.filter((pl) => pl !== c.player);
    });
    targetChar._clairvoyantBy = targetChar._clairvoyantBy ?? [];
    if (!targetChar._clairvoyantBy.includes(c.player)) targetChar._clairvoyantBy.push(c.player);
    // remember this watch so the report can surface everything that befalls the target FROM
    // THIS PHASE ONWARD, filed into the caster's Realm Events. One watch per player.
    clairWatch[c.player] = { charId: targetChar.id, fromPhase: ph };
    // the watched character is SEEN wherever they end the turn — on the map, in hero
    // sightings and the Encounter list — as if spied on, and the mind-link pierces
    // Invisibility.
    const theCastersRealm = G.players[c.player];
    if (theCastersRealm) theCastersRealm._clairCharThisTurn = targetChar.id;
    const tp = G.world.provinces[targetChar.location];
    // watching a character with Clairvoyance also reveals their full skills.
    {
      const actingP = G.players[c.player];
      const theMarksRealm = asItsGuardReadsIt(targetChar.player);
      if (actingP) {
        actingP._spiedHeroSkills = actingP._spiedHeroSkills ?? {};
        actingP._spiedHeroSkills[targetChar.id] = {
          name: targetChar.name,
          isKing: targetChar.isKing,
          alignment: targetChar.alignment || null,
          race: targetChar.race || null,
          kingdom: theMarksRealm != null ? (G.players[theMarksRealm]?.name ?? '') || null : null,
          skills: { ...targetChar.skills },
          turn: G.turn,
        };
      }
    }
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: "Clairvoyance opens the mind's eye upon a hero",
        heroName: c.name,
        targetName: targetChar.name,
        provinceName: tp ? tp.name : null,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      spy: true,
      province: targetChar.location,
    });
  } else if (fn === 'psychic_blast') {
    if (targetChar?.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Psychic Blast finds no hero in the province', provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "Psychic Blast cannot be turned on the realm's own heroes" },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // The target loses 2 skill levels, each drawn from a random owned skill (the two picks
    // may land on the same skill, in which case it drops by 2).
    const _pbDrops: string[] = [];
    for (let _k = 0; _k < 2; _k++) {
      // his skills by any name: the same object, so a level lost is lost from him
      const theSkills: Partial<Record<string, number>> = targetChar.skills;
      const owned = Object.keys(asItsGuardReadsIt(targetChar.skills) ?? {}).filter(
        (s) => (Number(theSkills[s]) || 0) > 0,
      );
      if (owned.length === 0) break;
      const sk = theOneThePickFell(owned[Math.floor(kcRng() * owned.length)]);
      theSkills[sk] = Math.max(0, (Number(theSkills[sk]) || 0) - 1);
      _pbDrops.push(sk);
    }
    if (_pbDrops.length === 0) {
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'a Psychic Blast finds no trained skills left to lose',
          heroName: c.name,
          targetName: targetChar.name,
        },
        audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        heroes: [c.id, targetChar.id].filter((v) => asItsGuardReadsIt(v) != null),
        province: prov.id,
      });
      return;
    }
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: "a Psychic Blast takes a hero's skills",
        heroName: c.name,
        targetName: targetChar.name,
        skillsLost: [..._pbDrops],
      },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      {
        kind: 'a hero reels from a Psychic Blast',
        targetName: targetChar.name,
        heroName: c.name,
        skillsLost: [..._pbDrops],
      },
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
          fact: {
            kind: "a hero's lost skill lowers his wage",
            targetName: targetChar.name,
            wage: _pbPay1,
            wageBefore: _pbPay0,
          },
          audience: { actor: targetChar.player, realms: [targetChar.player] },
          hero: targetChar.id,
          phase: ph,
        });
    }
  } else if (fn === 'psychic_storm') {
    if (targetChar?.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Telekinetic Storm finds no hero in the province', provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "Telekinetic Storm cannot be turned on the realm's own heroes" },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const armies = asItsGuardReadsIt(targetChar.armies) ?? [];
    if (armies.length === 0) {
      emit(turnContext, {
        type: 'combat',
        fact: { kind: 'a Telekinetic Storm finds no armies to scatter', targetName: targetChar.name },
        audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        heroes: [c.id, targetChar.id].filter((v) => asItsGuardReadsIt(v) != null),
        province: prov.id,
      });
      return;
    }
    const n = Math.min(spellLevelEff, armies.length);
    const picks = shuffleP(armies).slice(0, n);
    let demoted = 0,
      destroyed = 0;
    const _lines: ACompanyTheStormStrikes[] = [];
    // the loss is PERMANENT — every struck unit drops one experience level for
    // good (Elite→Crack→Veteran→Average→Green), and a Green unit disbands outright, exactly as a battle
    // demotion does (demoteOrDisband). Skeletal units never change quality by any means, so
    // the storm rattles their bones and leaves them as they were. (Was: a strength penalty
    // for the rest of the turn.)
    picks.forEach((a) => {
      if (a._isSkeletal) {
        a._disbanded = true;
        destroyed++;
        _lines.push({ kind: 'a skeletal company the storm shatters to dust', unitName: a.unitName || a.type });
        return;
      } // skeletons shatter outright
      const _q0 = a.quality;
      if (demoteOrDisband(a)) {
        destroyed++;
        _lines.push({
          kind: 'a company the storm tears apart for good',
          unitName: a.unitName || a.type,
          qualityBefore: _q0,
        });
        return;
      }
      demoted++;
      _lines.push({
        kind: 'a company the storm reduces one experience level',
        unitName: a.unitName || a.type,
        qualityBefore: _q0,
        qualityAfter: a.quality,
      });
    });
    targetChar.armies = armies.filter((a) => !a._disbanded);
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: "a Telekinetic Storm hurls a hero's troops about",
        heroName: c.name,
        targetName: targetChar.name,
        caught: n,
        destroyed: destroyed,
        demoted: demoted,
        units: [..._lines],
      },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      {
        kind: "a hero's formations are scattered by a Telekinetic Storm",
        heroName: c.name,
        targetName: targetChar.name,
        destroyed,
        demoted,
        units: [..._lines],
      },
      ph,
      'combat',
    );
  }

  // ── ILLUSORY ──
  else if (fn === 'illusory_terrain') {
    const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => asItsGuardReadsIt(p2)?.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Illusory Terrain is cast beyond its reach', heroName: c.name },
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
    fake = theOneThePickFell(fake); // three or four lands to pick from, so one is picked
    targetProv._illusoryTerrain = { caster: c.player, fake, appliedTurn: G.turn };
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'Illusory Terrain cloaks a province', heroName: c.name, provinceName: targetProv.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
    });
  } else if (fn === 'illusory_phantasmal') {
    // Target: the caster themselves, or any friendly hero in the SAME province. No longer
    // requires the target to be leading armies at cast time — the buff sits on the character
    // and is spent by the next battle they fight, so it still pays off if they pick up or
    // recruit armies in a later phase this turn.
    const t = targetChar?.player === c.player ? targetChar : c;
    if (t.id !== c.id && t.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Phantasmal Armies is cast on a hero beyond its reach', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const _realForce = (asItsGuardReadsIt<readonly (ArmyInABattle | null | undefined)[]>(t.armies) ?? []).filter(
      (a): a is ArmyInABattle => !!a && !a._phantom,
    );
    const _elig = _realForce.filter((a) => !CREATURE_ARMIES.has(a.type) && !MONSTER_ARMIES.has(a.type));
    if (_elig.length === 0) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'Phantasmal Armies finds no humanoid armies to duplicate',
          heroName: c.name,
          onTheCasterHimself: t === c,
          targetName: t.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const _n = Math.min(_elig.length, Math.max(1, Math.floor(0.1 * Math.min(spellLevel, 5) * _realForce.length))); // 10% of the host per level, capped at level 5 (was 15%)
    t._phantoms = t._phantoms ?? [];
    const theTargetsPhantoms = t._phantoms;
    shuffleP(_elig)
      .slice(0, _n)
      .forEach((orig) => {
        if (orig._phTag === undefined || orig._phTag === '')
          orig._phTag = `ph${String((G._phSeq = (Number(G._phSeq) || 0) + 1))}`;
        theTargetsPhantoms.push({
          type: orig.type,
          quality: orig.quality,
          race: orig.race,
          unitName: orig.unitName,
          _phantomOf: orig._phTag,
        });
      }); // random selection
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'Phantasmal Armies conjures duplicates of humanoid armies',
        heroName: c.name,
        duplicates: _n,
        onTheCasterHimself: t === c,
        targetName: t.name,
      },
      audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: t.location,
    });
  } else if (fn === 'illusory_hide_feature') {
    const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => asItsGuardReadsIt(p2)?.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Hide Lairs is cast beyond its reach', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const toHide = (asItsGuardReadsIt(targetProv.features) ?? []).filter((f) => !f._hidden);
    if (toHide.length === 0) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Hide Lairs finds no lairs left to hide', heroName: c.name, provinceName: targetProv.name },
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
      fact: {
        kind: "Hide Lairs veils a province's lairs",
        heroName: c.name,
        provinceName: targetProv.name,
        lairsHidden: toHide.length,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
    });
  }

  // ── ELEMENTAL ──
  // (Lightning Bolt & Fireball are combat/battle-magic spells only — no action-phase form.)
  else if (fn === 'elemental_earthquake') {
    const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => asItsGuardReadsIt(p2)?.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Earthquake is cast beyond its reach', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (blessWardNegates(turnContext, targetProv, c, 'Earthquake')) return;
    targetProv._earthquakeNoTax = G.turn;
    emit(turnContext, {
      type: 'combat',
      fact: { kind: 'an Earthquake rends a province', heroName: c.name, provinceName: targetProv.name },
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
      { kind: 'a realm learns an enemy Earthquake tore through its province', provinceName: targetProv.name },
      c.player,
      ph,
    );
  } else if (fn === 'elemental_flood') {
    const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => asItsGuardReadsIt(p2)?.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Flood is cast beyond its reach', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetProv.terrain === 'sea') {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Flood is cast on the sea', heroName: c.name },
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
      fact: { kind: 'a Flood swallows a province', heroName: c.name, provinceName: targetProv.name },
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
      { kind: 'a realm learns an enemy Flood swallowed its province', provinceName: targetProv.name },
      c.player,
      ph,
    );
  } else if (fn === 'elemental_summon') {
    if (c._elementalSummonedThisTurn) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a hero has already summoned an elemental this turn', heroName: c.name },
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
    const pick = theOneThePickFell(ELEMENTALS[Math.floor(kcRng() * ELEMENTALS.length)]);
    const elemental = {
      type: pick.type,
      quality: 'Veteran',
      race: 'Elemental',
      unitName: pick.unitName,
      _temporary: true,
      _expiresAfterPhase: -1,
    };
    c.armies = asItsGuardReadsIt(c.armies) ?? [];
    c.armies.push(elemental);
    c._elementalSummonedThisTurn = true;
    logSplit(
      turnContext,
      'explore',
      {
        kind: 'an elemental surges forth from a rift',
        heroName: c.name,
        provinceName: prov.name,
        elementalName: pick.unitName,
        elementalType: pick.type,
      },
      {
        kind: 'onlookers see an elemental surge forth from a rift',
        heroName: c.name,
        realmName: aRealmsNameOrNone(G.players, c.player),
        provinceName: prov.name,
        elementalName: pick.unitName,
        elementalType: pick.type,
      },
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
      const graves = prov.battleGraves ?? [];
      if (graves.length === 0) {
        noteGraveIntel(G.players[c.player], prov.id, G.turn, []); // seen bare — forget any stale record
        emit(turnContext, {
          type: 'explore',
          fact: { kind: 'Control Undead senses no dead in the province', heroName: c.name, provinceName: prov.name },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
      } else {
        noteGraveIntel(G.players[c.player], prov.id, G.turn, graves); // the fuller reading is kept in Graveyards known
        emit(turnContext, {
          type: 'explore',
          fact: {
            kind: 'Control Undead senses the dead of the province',
            heroName: c.name,
            provinceName: prov.name,
            graves: theGravesAsTheLineCountsThem(graves),
          },
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
          (p2) => asItsGuardReadsIt(p2)?.id != null,
        );
        const _withDead: string[] = [];
        _nbrs.forEach((nb) => {
          if ((nb.battleGraves ?? []).length > 0) {
            noteGraveIntel(_pl, nb.id, G.turn, null);
            _withDead.push(nb.name);
          } else noteGraveIntel(_pl, nb.id, G.turn, []);
        });
        if (_withDead.length > 0)
          emit(turnContext, {
            type: 'explore',
            fact: {
              kind: 'the sending finds battlefield graves in the provinces around',
              heroName: c.name,
              provinceName: prov.name,
              provincesWithDead: _withDead.sort(),
            },
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
        else if (_nbrs.length > 0)
          emit(turnContext, {
            type: 'explore',
            fact: { kind: 'the sending finds the provinces around quiet', heroName: c.name, provinceName: prov.name },
            audience: { actor: c.player, realms: [c.player] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
      }
      trySkillGain(turnContext, c, school, SKILLGAIN_STD);
      return;
    }
    if (targetChar?.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Control Undead finds no hero in the province', provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "Control Undead cannot be turned on the realm's own heroes" },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const undeadIdxs = (asItsGuardReadsIt(targetChar.armies) ?? [])
      .map((a, i) => ({ a, i }))
      .filter(
        (x) =>
          (x.a._isSkeletal ?? false) ||
          x.a.race === 'Undead' ||
          /Skelet|Bone|Wraith|Zombie|Ghoul|Lich/i.test(x.a.type || ''),
      );
    if (undeadIdxs.length === 0) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "Control Undead finds no undead among a hero's forces",
          heroName: c.name,
          targetName: targetChar.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    const pick = theOneThePickFell(undeadIdxs[Math.floor(kcRng() * undeadIdxs.length)]);
    const seized = theOneTakenOut(targetChar.armies, pick.i);
    c.armies = asItsGuardReadsIt(c.armies) ?? [];
    c.armies.push(seized);
    logSplit(
      turnContext,
      'hire',
      {
        kind: 'Control Undead wrests a company from a hero',
        heroName: c.name,
        unitName: seized.unitName || seized.type,
        targetName: targetChar.name,
        provinceName: prov.name,
      },
      {
        kind: 'onlookers see Control Undead wrest a company from a hero',
        heroName: c.name,
        realmName: aRealmsNameOrNone(G.players, c.player),
        unitName: seized.unitName || seized.type,
        targetName: targetChar.name,
        targetsRealmName: aRealmsNameOrNone(G.players, targetChar.player),
        provinceName: prov.name,
      },
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
      {
        kind: 'a hero learns Control Undead wrested a company from him',
        heroName: c.name,
        realmName: aRealmsNameOrNone(G.players, c.player),
        unitName: seized.unitName || seized.type,
        targetName: targetChar.name,
        provinceName: prov.name,
      },
      ph,
      'hire',
    );
    resolveUnitGainInProvince(turnContext, c, prov, ph);
  } else if (fn === 'necromancy_skeletal') {
    // Skeletal Armies: raise destroyed armies from this province's battlefield graves
    const graves = prov.battleGraves ?? [];
    if (graves.length === 0) {
      emit(turnContext, {
        type: 'explore',
        fact: { kind: 'Skeletal Armies finds no dead to answer', heroName: c.name, provinceName: prov.name },
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
    // the tier above each quality, by any quality
    const qualityUp: Readonly<Partial<Record<string, string>>> = KC_QUALITY_UP;
    for (let _sk = 0; _sk < _skN && (prov.battleGraves ?? []).length > 0; _sk++) {
      const grave = takeBestGrave(prov); // the most experienced dead answer first
      if (!grave) break;
      const skel = {
        type: grave.type,
        quality: _uTier ? (qualityUp[grave.quality] ?? '') || grave.quality : grave.quality,
        race: 'Undead',
        _isSkeletal: true,
        unitName: `${String(grave.unitName || armyUnitName(grave.type))} (Skeletal)`,
      };
      c.armies = asItsGuardReadsIt(c.armies) ?? [];
      c.armies.push(skel);
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'a skeletal company rises from the graves',
          heroName: c.name,
          unitName: skel.unitName,
          quality: skel.quality,
          unitType: skel.type,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [c.player], seen: 'there' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
    // the caster has just gained a unit here — if this is a neutral/enemy province, that
    // force must fight any defenders this phase, or take control if the land is undefended.
    resolveUnitGainInProvince(turnContext, c, prov, ph);
  } else if (fn === 'necromancy_curse') {
    if (targetChar?.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Curse finds no hero in the province', provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "Curse cannot be turned on the realm's own heroes" },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    // EVERY skill the target has is halved (rounded down) for the rest of the turn — was the
    // single highest skill. A second Curse the same turn halves what is left again.
    const _cursed = Object.entries(asItsGuardReadsIt(targetChar.skills) ?? {}).filter(
      (e): e is [string, number] => e[1] !== undefined && e[1] > 0,
    );
    if (!_cursed.length) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a hero has no skills to curse', targetName: targetChar.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    targetChar._curses = targetChar._curses ?? {};
    const theCurses = targetChar._curses;
    const _parts = _cursed.map(([sk, val]) => {
      const cur = Math.max(0, val - (Number(theCurses[sk]) || 0)); // what the skill IS right now, after any earlier curse
      const reduce = cur - Math.floor(cur / 2);
      theCurses[sk] = (Number(theCurses[sk]) || 0) + reduce;
      return { skill: sk, levelBefore: cur };
    });
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: "a Curse halves a hero's skills",
        heroName: c.name,
        targetName: targetChar.name,
        skills: [..._parts],
      },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      {
        kind: 'a hero learns a Curse settles over him',
        heroName: c.name,
        targetName: targetChar.name,
        skills: [..._parts],
      },
      ph,
      'combat',
    );
  }
  // (Hand of Death is a combat-only spell — no action-phase form.)
  else if (fn === 'necromancy_plague') {
    // Target the caster's province or an adjacent one.
    const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => asItsGuardReadsIt(p2)?.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Plague is cast beyond its reach', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetProv._plaguedTurn === G.turn) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a province is already stricken with plague this turn', provinceName: targetProv.name },
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
      fact: {
        kind: 'a Plague strikes a province',
        heroName: c.name,
        provinceName: targetProv.name,
        tested: res.tested,
        affected: res.affected,
      },
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
      {
        kind: 'a realm learns an enemy Plague struck its province',
        provinceName: targetProv.name,
        affected: res.affected,
      },
      c.player,
      ph,
    );
  }

  // ══ LEVEL 7 & 9 MASTERY SPELLS ════
  // WHITE
  else if (fn === 'white_sanctuary') {
    const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => asItsGuardReadsIt(p2)?.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Sanctuary is cast beyond its reach', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    targetProv._sanctuaryTurn = G.turn;
    targetProv._sanctuaryBy = c.player;
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'a Sanctuary is raised over a province', heroName: c.name, provinceName: targetProv.name },
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
    });
    notifyProvinceOwner(
      turnContext,
      targetProv,
      {
        kind: 'a realm learns a Sanctuary was raised over its province',
        heroName: c.name,
        castersRealmName: (G.players[c.player]?.name ?? '') || null,
        provinceName: targetProv.name,
      },
      c.player,
      ph,
    ); // the owner is told
  } else if (fn === 'white_judgment') {
    if (targetChar?.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Divine Judgment finds no enemy hero in the province', provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "Divine Judgment cannot be turned on the realm's own heroes" },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const dmg = 10 + spellLevelEff * 3;
    targetChar.hp = Math.max(1, (targetChar.hp || 20) - dmg);
    const src = asItsGuardReadsIt(targetChar.armies) ?? [];
    const kills = Math.min(src.length, 2 + Math.floor(spellLevelEff / 2));
    const idxs = shuffleP(src.map((_, i) => i))
      .slice(0, kills)
      .sort((a, b) => b - a);
    idxs.forEach((i) => src.splice(i, 1));
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'Divine Judgment falls on a hero',
        heroName: c.name,
        targetName: targetChar.name,
        damage: dmg,
        unitsSmitten: kills,
      },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      {
        kind: 'a hero learns Divine Judgment fell on him',
        targetName: targetChar.name,
        heroName: c.name,
        damage: dmg,
        unitsSmitten: kills,
      },
      ph,
      'combat',
    );
  }
  // PSYCHIC
  else if (fn === 'psychic_massconfusion') {
    if (targetChar?.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Mass Confusion finds no enemy hero in the province', provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "Mass Confusion cannot be turned on the realm's own heroes" },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    targetChar._massConfusedTurn = G.turn;
    emit(turnContext, {
      type: 'combat',
      fact: { kind: "Mass Confusion is sown through a hero's ranks", heroName: c.name, targetName: targetChar.name },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      { kind: 'a hero learns Mass Confusion grips him', heroName: c.name, targetName: targetChar.name },
      ph,
      'combat',
    );
  } else if (fn === 'psychic_dominate') {
    if (targetChar?.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Dominate finds no enemy hero in the province', provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "Dominate cannot be turned on the realm's own heroes" },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const src = asItsGuardReadsIt(targetChar.armies) ?? [];
    if (src.length === 0) {
      emit(turnContext, {
        type: 'combat',
        fact: { kind: 'Dominate finds no troops to turn', heroName: c.name, targetName: targetChar.name },
        audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        heroes: [c.id, targetChar.id].filter((v) => asItsGuardReadsIt(v) != null),
        province: prov.id,
      });
      return;
    }
    const take = Math.max(1, Math.floor(src.length * 0.25));
    const idxs = shuffleP(src.map((_, i) => i))
      .slice(0, take)
      .sort((a, b) => b - a);
    const seized = idxs.map((i) => theOneTakenOut(src, i));
    c.armies = (asItsGuardReadsIt(c.armies) ?? []).concat(seized);
    logSplit(
      turnContext,
      'hire',
      {
        kind: "Dominate turns a hero's companies",
        heroName: c.name,
        targetName: targetChar.name,
        provinceName: prov.name,
        seized: seized.length,
      },
      {
        kind: "onlookers see Dominate turn a hero's companies",
        heroName: c.name,
        realmName: aRealmsNameOrNone(G.players, c.player),
        targetName: targetChar.name,
        targetsRealmName: aRealmsNameOrNone(G.players, targetChar.player),
        provinceName: prov.name,
        seized: seized.length,
      },
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
      {
        kind: 'a hero learns Dominate turned his companies',
        heroName: c.name,
        realmName: aRealmsNameOrNone(G.players, c.player),
        targetName: targetChar.name,
        provinceName: prov.name,
        seized: seized.length,
      },
      ph,
      'hire',
    );
    resolveUnitGainInProvince(turnContext, c, prov, ph);
  }
  // ILLUSORY
  else if (fn === 'illusory_phantomhost') {
    const _realForceH = (asItsGuardReadsIt<readonly (ArmyInABattle | null | undefined)[]>(c.armies) ?? []).filter(
      (a): a is ArmyInABattle => !!a && !a._phantom,
    );
    const _eligH = _realForceH.filter((a) => CREATURE_ARMIES.has(a.type) || MONSTER_ARMIES.has(a.type));
    if (_eligH.length === 0) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Phantom Host finds no beasts to duplicate', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const _nH = Math.min(_eligH.length, Math.max(1, Math.floor(0.1 * Math.min(spellLevel, 5) * _realForceH.length))); // 10% of the host per level, capped at level 5 (was 15%)
    c._phantoms = c._phantoms ?? [];
    const theCastersPhantoms = c._phantoms;
    shuffleP(_eligH)
      .slice(0, _nH)
      .forEach((orig) => {
        if (orig._phTag === undefined || orig._phTag === '')
          orig._phTag = `ph${String((G._phSeq = (Number(G._phSeq) || 0) + 1))}`;
        theCastersPhantoms.push({
          type: orig.type,
          quality: orig.quality,
          race: orig.race,
          unitName: orig.unitName,
          _phantomOf: orig._phTag,
        });
      }); // random selection
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'Phantom Host conjures duplicates of beasts', heroName: c.name, duplicates: _nH },
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
        fact: { kind: 'Invisibility holds', heroName: c.name, chance: 80, roll: _ivRoll },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else
      emit(turnContext, {
        type: 'explore',
        fact: { kind: 'Invisibility fails to hold', heroName: c.name, chance: 80, roll: _ivRoll },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
  } else if (fn === 'illusory_veil') {
    c._veilTurn = G.turn;
    c._veilCastPhase = ph; // ILLUSORY L9 Veil: active THIS phase and the next (two phases)
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'a Veil of illusion is drawn over a host', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  }
  // ELEMENTAL
  else if (fn === 'elemental_chainlightning') {
    if (targetChar?.location !== c.location) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Chain Lightning finds no enemy hero in the province', provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    if (targetChar.player === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "Chain Lightning cannot be turned on the realm's own heroes" },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const src = asItsGuardReadsIt(targetChar.armies) ?? [];
    if (src.length === 0) {
      emit(turnContext, {
        type: 'combat',
        fact: { kind: 'Chain Lightning finds no troops to strike', targetName: targetChar.name },
        audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        heroes: [c.id, targetChar.id].filter((v) => asItsGuardReadsIt(v) != null),
        province: prov.id,
      });
      return;
    }
    const pool = Math.floor(src.length * 0.3);
    if (pool <= 0) {
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'Chain Lightning earths out among a handful of troops',
          heroName: c.name,
          targetName: targetChar.name,
        },
        audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        heroes: [c.id, targetChar.id].filter((v) => asItsGuardReadsIt(v) != null),
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
      fact: {
        kind: "Chain Lightning arcs through a hero's ranks",
        heroName: c.name,
        targetName: targetChar.name,
        caught: pool,
        killed: killed,
      },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    notifyTarget(
      turnContext,
      targetChar,
      {
        kind: 'a hero learns Chain Lightning tore through his ranks',
        heroName: c.name,
        targetName: targetChar.name,
        killed,
      },
      ph,
      'combat',
    );
  } else if (fn === 'elemental_cataclysm') {
    const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
    const adjIds = new Set(
      getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
        .map((p2) => asItsGuardReadsIt(p2)?.id)
        .filter((x) => x != null),
    );
    if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'Cataclysm is cast beyond its reach', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    targetProv._earthquakeNoTax = G.turn;
    targetProv.tax = 0;
    targetProv._taxDestroyed = true; // Cataclysm now ruins the tax base PERMANENTLY
    let totalDestroyed = 0;
    const _ccVictims = new Set<number>();
    (asItsGuardReadsIt(G.characters) ?? [])
      .filter(
        (ch) =>
          ch.alive &&
          ch.location === targetProv.id &&
          ch.player !== c.player &&
          (asItsGuardReadsIt(ch.armies) ?? []).length > 0,
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
      fact: {
        kind: 'a Cataclysm devastates a province',
        heroName: c.name,
        provinceName: targetProv.name,
        destroyed: totalDestroyed,
      },
      audience: { actor: c.player, realms: [..._ccVictims], seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: targetProv.id,
    });
    notifyProvinceOwner(
      turnContext,
      targetProv,
      {
        kind: 'a realm learns an enemy Cataclysm devastated its province',
        provinceName: targetProv.name,
        destroyed: totalDestroyed,
      },
      c.player,
      ph,
    );
  }
  // NECROMANCY
  else if (fn === 'necromancy_wraiths') {
    const graves = prov.battleGraves ?? [];
    if (graves.length === 0) {
      emit(turnContext, {
        type: 'explore',
        fact: { kind: 'Raise Wraiths finds no dead to answer', heroName: c.name, provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    let _wbi = 0,
      _wbs = -1;
    graves.forEach((gr, i) => {
      const st = unitBaseStrength({ type: gr.type, quality: gr.quality || 'Average' });
      if (st > _wbs) {
        _wbs = st;
        _wbi = i;
      }
    }); // raise the STRONGEST fallen unit
    const g = theOneTakenOut(graves, _wbi);
    const wraith = {
      type: g.type,
      quality: 'Elite',
      race: 'Undead',
      _isSkeletal: true,
      _isWraith: true,
      unitName: `Wraiths (${String(armyUnitName(g.type))})`,
    };
    c.armies = asItsGuardReadsIt(c.armies) ?? [];
    c.armies.push(wraith);
    logSplit(
      turnContext,
      'explore',
      { kind: 'the dead are bound into Wraiths', heroName: c.name, provinceName: prov.name, unitName: wraith.unitName },
      {
        kind: 'onlookers see the dead bound into Wraiths',
        heroName: c.name,
        realmName: aRealmsNameOrNone(G.players, c.player),
        provinceName: prov.name,
        unitName: wraith.unitName,
      },
      { audience: { actor: c.player }, hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING, province: prov.id },
    );
    resolveUnitGainInProvince(turnContext, c, prov, ph);
  } else if (fn === 'necromancy_dominion') {
    const graves = prov.battleGraves ?? [];
    if (graves.length === 0) {
      emit(turnContext, {
        type: 'explore',
        fact: { kind: "Death's Dominion finds no fallen army to raise", heroName: c.name, provinceName: prov.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    // the tier above each quality, by any quality (it holds no '', so each `??` below gives what its `||` gave)
    const QUALITY_UP: Readonly<Partial<Record<string, string>>> = { ...KC_QUALITY_UP };
    // Death's Dominion already raises the dead one tier stronger than they fell. The
    // Deathless Legion adds ITS tier on top, so an Undead realm holding its Wonder pulls them
    // up TWO tiers — Average dead rise Crack. Elite is still the ceiling.
    const _ddUp = gdActive(turnContext, c.player, 'Undead')
      ? (q: string) => QUALITY_UP[QUALITY_UP[q] ?? q] ?? QUALITY_UP[q] ?? q
      : (q: string) => QUALITY_UP[q] ?? q;
    const n = Math.min(graves.length, spellLevelEff);
    let raised = 0;
    for (let k = 0; k < n; k++) {
      const g = takeBestGrave(prov);
      if (!g) break;
      /*best first, down the line */ c.armies = asItsGuardReadsIt(c.armies) ?? [];
      c.armies.push({
        type: g.type,
        quality: _ddUp(g.quality),
        race: 'Undead',
        _isSkeletal: true,
        unitName: `${String(g.unitName || armyUnitName(g.type))} (Skeletal)`,
      });
      raised++;
    }
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: "Death's Dominion raises skeletal companies from the graves",
        heroName: c.name,
        provinceName: prov.name,
        raised: raised,
      },
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
