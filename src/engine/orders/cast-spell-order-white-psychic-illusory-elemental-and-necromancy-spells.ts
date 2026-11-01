import { SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { actionSpellsAllowedPerSchoolEachTurn } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import {
  aCharmedHeroWillNotTurnThisSpellOnHisLord,
  aCloakedMarkIsShieldedFromThisSpell,
  theMarkOfThisSpellMustStandInTheProvince,
  theSpellCostsNoCastingSlot,
} from '../rules/the-registry-of-spell-effects.ts';
import { theCastersItemsMakeHisCastSure } from '../rules/the-registry-of-magic-item-effects.ts';
import { activeItems } from '../items/equipment.ts';
import { d100 } from '../dice-and-army-names.ts';
import { TM, skillLevel } from '../titles/perks.ts';
import { isPreOrderRef, orderCharRef } from '../heroes/charms-and-neutrals.ts';
import { castChanceFor } from '../chances-and-lair-grades.ts';
import { _BEST_SCHOOL } from '../titles/reckoning.ts';
import { gdActive } from '../discoveries.ts';
import {
  emit,
  recordForTheStatistics,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { charMinor } from '../titles/title-holders-and-battle-merit.ts';
import {
  effStat,
  isHiddenByInvisibilityFrom,
  isHiddenChar,
  isVanished,
  isVeiled,
} from '../heroes/effective-skills-and-hidden-heroes.ts';
import { SKILLGAIN_COMMON, SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { normaliseAction } from '../turn/phase-intents-and-dependency-ordering.ts';
import { asItsGuardReadsIt } from '../personal-combat/to-hit-wounds-stuns-and-courage.ts';
import type { Realm } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';
import { theWorkOfTheActionSpell } from './spells/the-action-spells-the-cast-spell-order-works-by-slug.ts';
import { servesARealm } from './spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type {
  AHeroAsTheCastMarksHim,
  AProvinceAsTheCastMarksIt,
  AnOrderAsTheCastMarksIt,
  TheStateAsTheCastReadsIt,
  ASpellAsTheCastReadsIt,
} from './spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';

// ── THE CAST SPELL ORDER (plan P1-08j7: the seventh family taken out of processOrder in resolveTurn) ──
// A hero works a spell as a phase order: the casting limits (a school's casts a turn, a mastery spell once a turn), the
// cast chance and its roll, then the spell itself, school by school: White Magic (Resurrect, Part Sea, Holy Symbol,
// Bless Province, Sanctuary, Divine Judgment), Psychic (Charm, Oratory, Clairvoyance, Psychic Blast, Telekinetic Storm,
// Mass Confusion, Dominate), Illusory (Illusory Terrain, Phantasmal Armies, Hide Lairs, Phantom Host, Invisibility,
// Veil), Elemental (Earthquake, Flood, Summon Elemental, Chain Lightning, Cataclysm) and Necromancy (Control Undead,
// Skeletal Armies, Curse, Plague, Raise Wraiths, Death's Dominion). A spell item used through Use Item arrives here as
// a cast (processOrder turns it into one). Each spell's work is in src/engine/orders/spells/, a file a school, found by
// the spell's slug in a typed table (plan P1-19z); the Charm's backlash is there too, with the psychic spells. The order
// takes the turn's context first (src/engine/turn/context.ts), then the values processOrder worked out before it that it
// reads, in the order processOrder declares them.
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
  const { G, clairWatch }: Pick<TurnContext, 'clairWatch'> & { readonly G: TheStateAsTheCastReadsIt } = turnContext;
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
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (!spellDef.phase) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a spell cannot be worked as a phase order', heroName: c.name, spellName: spellName },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  // a seized ENEMY hero will not turn hostile magic on their own lord's characters (the same
  // rule as Encounter) — refused BEFORE the cast is even attempted, so it costs no casting
  // slot. Other realms' heroes: as normal. Which spells: the spells' registry (plan P1-19y).
  if (c._charmTempControl && c._charmOriginalPlayer != null && aCharmedHeroWillNotTurnThisSpellOnHisLord(spellName)) {
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
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
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
    const _divCath = gdActive(turnContext, c.player, 'Divine'); // GRAND DESIGN — Divine (Grand Cathedral): Bless uses no casting slot (the spells' registry, plan P1-19y)
    // NORMALISE the saved action: the player portal writes "Cast Spell", the bots write
    // "cast_spell". Comparing the raw string counted only the bots' casts, so a human caster
    // had NO per-turn limit at all (a Psychic 1 hero could work five action spells a season).
    // The spell key is "Bless Province", never "Bless" — the old test never matched, so a
    // Grand Cathedral's free Bless was not free either. An order the engine REFUSED before it
    // was ever worked (_castNotWorked) costs no slot.
    const _castsSoFar = (G.turnOrders[c.id] ?? []).slice(0, ph).filter((o) => {
      if (!o || normaliseAction(o) !== 'cast_spell') return false;
      if (o._castNotWorked) return false; // never left the caster's lips
      if (theSpellCostsNoCastingSlot(o.target, { theCastersRealmHasAGrandCathedral: _divCath })) return false; // a Grand Cathedral's Bless never consumes a slot
      return spellDefs[o.target]?.school === _school;
    }).length;
    if (
      _castsSoFar >= _limit &&
      _lvl > 0 &&
      !theSpellCostsNoCastingSlot(spellName, { theCastersRealmHasAGrandCathedral: _divCath })
    ) {
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
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
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
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
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
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
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
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
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
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return;
    }
    c._masterySpellUsed[spellName] = G.turn;
  }

  // Cast chance — computed by the shared castChanceFor() so the player's order form can quote
  // exactly what will be rolled here (see the helper beside MAGIC_L8_SCHOOLS). Wailing
  // Phylactery: the first Necromancy spell each turn cannot fail (the items' registry, plan P1-19y).
  const necroAuto = theCastersItemsMakeHisCastSure(
    { theSpellsSchool: school, hisSureCastIsSpentThisTurn: !!c._necroAutoUsed },
    () => activeItems(c),
  );
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
  if (theMarkOfThisSpellMustStandInTheProvince(spellName)) {
    const _tid = parseInt(String(extra));
    const _t = Number.isInteger(_tid)
      ? (asItsGuardReadsIt<readonly (AHeroAsTheCastMarksHim | null | undefined)[]>(G.characters) ?? []).find(
          (ch) => ch?.alive && ch.id === _tid,
        )
      : null;
    // R-119: a mark whose Invisibility holds is found by no other realm's spell: refused before the roll, as a mark
    // gone from the province is, with a line that names no one (nor where he stands)
    if (_t && isHiddenByInvisibilityFrom(turnContext, _t, c.player)) {
      o._castNotWorked = true; // costs no casting slot for the rest of the turn
      emit(turnContext, {
        type: 'system',
        fact: { kind: "a spell's mark is nowhere to be found", heroName: c.name, spellName: spellName },
        audience: { actor: c.player, realms: [c.player] },
        province: prov.id,
        hero: c.id,
        phase: ph,
      });
      return;
    }
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
    recordForTheStatistics(turnContext, {
      kind: 'a spell cast by the Cast Spell order, for the statistics',
      record: {
        ph,
        pi: c.player,
        charId: c.id,
        spell: spellName,
        school,
        lvl: spellLevel,
        chance: castChance,
        ok: castRoll <= castChance,
        item: !!_itemCast,
      },
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
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
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
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: prov.id,
  });

  if (castRoll > castChance) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a spell fizzles without effect', heroName: c.name, spellName: spellName },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    if (!_itemCast) trySkillGain(turnContext, c, school, SKILLGAIN_COMMON); // batch item 11: a failed attempt is a small chance to learn (an item's cast teaches nothing when it fails)
    // a fizzled Charm may bring its intended victim down on the caster.
    theWorkOfTheActionSpell(spellDef.fn)?.whenItFizzles?.({ turnContext, G, c, extra, prov });
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
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
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
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  // Cloak of Many Faces: shields the wearer from hostile Psychic Blast / Curse (which spells: the spells' registry).
  if (
    targetChar &&
    targetChar.player !== c.player &&
    isHiddenChar(turnContext, targetChar) &&
    aCloakedMarkIsShieldedFromThisSpell(spellName)
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
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }

  // The spell itself: its work, found by its slug in the table (src/engine/orders/spells/; plan P1-19z). A work that ends
  // the cast returns false, and the skill gain below is skipped.
  const theSpellsWork = theWorkOfTheActionSpell(fn);
  if (
    theSpellsWork &&
    !theSpellsWork.worked({
      turnContext,
      G,
      c,
      ph,
      extra,
      prov,
      player,
      clairWatch,
      school,
      spellLevel,
      spellLevelEff,
      extraId,
      targetProv,
      targetChar,
    })
  )
    return;

  // Magic school skill gain on a successful action cast
  trySkillGain(turnContext, c, school, SKILLGAIN_STD);
  return;
}
