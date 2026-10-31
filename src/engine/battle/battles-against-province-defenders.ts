// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_UNIT_CLASS, PRIMAL_ARMY_DEFS_P, SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { aForceHoldsTheSeaLanes, theHullAUnitSinksBeforeTheBattle } from '../rules/the-registry-of-content-effects.ts';
import {
  theBeatenForceMayRetreatByTheCommandersItems,
  theDefendersFortificationsAfterTheCommandersItems,
  theStrongestUnitsAHerosItemsLetHisFireballStrike,
  theVolleysTheCommandersItemsLoose,
} from '../rules/the-registry-of-magic-item-effects.ts';
import {
  whatABattleSpellDoesBeforeTheBattle,
  whatAUnitsStrikeMayDoBeforeTheBattle,
} from '../rules/the-registry-of-spell-effects.ts';
import { BATTLE_MAGIC_SPELL_NAMES, FANATIC_CHANCE_BY_ALIGN, QUALITY_TIERS, SKILL_LABELS } from '../army-tables.ts';
import { battleMarginBand, rollUnitFates } from './fates.ts';
import {
  battleDeploy,
  battleFacedClauses,
  battleGridLines,
  battleLineTotal,
  battleMovesLine,
  battleScout,
  battleScoutLine,
  battleWidthLine,
  rollBattleWidth,
} from './lines.ts';
import { ARCHERY_MISSILE_PCT, UNDEAD_SKEL_HERO_FAN, UNDEAD_SKEL_KING_FAN, ladderLines } from './ladder.ts';
import {
  pursuitsOfTheBeaten,
  shieldFortHolds,
  tacMulted,
  theFactorThePursuitsPutOnTheWinnersOwnDeathRolls,
  theFractionThePursuitsAdd,
} from '../units/movement.ts';
import {
  AERIAL_TYPES,
  FLYING_TYPES,
  MONSTER_ARMIES,
  SEA_TYPES,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import {
  abilityMissileUnits,
  abilityVolleys,
  applyFlakScreen,
  archeryBlockedBy,
  eyesOfTheForestLine,
  missileDamageMult,
  missileTargetPool,
} from './strength.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { homeFounderOf } from '../grand-design.ts';
import { battleFortune, shuffleP } from './fortune.ts';
import { recordBattleGraves } from '../graves.ts';
import { demoteGuardToWanderer, isConsecrated } from '../heroes/fame-and-consecration.ts';
import { activeItems } from '../items/equipment.ts';
import { humanXPMult } from '../units/drill-and-spoils.ts';
import { d100, rng } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { applyWraithTouch, clearPhantomCopies, getNeighborsP, injectPhantoms } from '../world/map-helpers.ts';
import { perkTier } from '../titles/perks.ts';
import {
  SPELL_CAST_BASE,
  guardCastChance,
  magicL8CastBonus,
  primalStrikeItemBonus,
} from '../chances-and-lair-grades.ts';
import { discDeathMult, discPromo } from '../discoveries.ts';
import {
  doARealmsDiscoveriesWeightTheLinesBehindTheFront,
  theShareARealmsDiscoveriesFortifyItsOwnGroundBy,
  whatARealmsDiscoveriesAddToACastersChance,
  whatARealmsDiscoveriesAddToASidesFanaticism,
  whatARealmsDiscoveriesAddToASiege,
  whatARealmsDiscoveriesAddToTheWholeArmy,
} from '../rules/the-registry-of-discovery-effects.ts';
import { telSpell } from '../turn/log-line-helpers.ts';
import { noteBattleLoss } from '../turn/mercenary-ids-and-battle-records.ts';
import { charMinor } from '../titles/title-holders-and-battle-merit.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import {
  MISSILE_CAP_FRACTION,
  REIGN_OF_FEAR_MULT,
  SEA_LAND_PENALTY,
  applyMissileHit,
  armStr,
  bestCurseSkill,
  finishSide,
  illusoryTerrainMult,
  isAirborneAtSea,
  kinNarrative,
  ladderRow,
  provIsCoastal,
} from './terrain-and-unit-strength.ts';
import {
  bestRetreat,
  navalSplitRetreat,
  retreatOptions,
  seaTrapLine,
} from '../units/sea-lift-stranding-and-retreats.ts';
import { realCharOf } from './best-commander.ts';
import { SKILLGAIN_COMMON, SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { druidShortfallLine, forceMarker, terrainNoteList } from './battle-report-lines-and-force-markers.ts';
import { consumeTerror, reignOfFearHere, spreadTerror } from './evil-terror.ts';
import { battleSpellUseful, pickBattleSpell } from '../magic/pre-battle-spell-choice.ts';
import { bloodHarvest, ironThroneRaise } from './blood-harvest-and-iron-throne.ts';
import { raidLandedHere } from './raid-the-coast-and-landing-parties.ts';
import { ensureEncounterPlan } from '../personal-combat/speed-encounter-plans-and-combatants.ts';
import { magicItemsLine } from '../personal-combat/duels-and-character-encounters.ts';
import { preBattleDuel } from './pre-battle-duels.ts';
import {
  THE_NUMBER_OF_VERBS_A_VICTORY_IS_TOLD_WITH,
  THE_NUMBER_OF_VERBS_AN_ATTACK_IS_TOLD_WITH,
  THE_VERB_A_PROVINCES_DEFENDERS_STAND_WITH,
  theFortuneAsTheLineTellsIt,
} from './the-facts-a-battles-lines-record.ts';
import { narrateAll, narrate } from '../turn/events-and-their-audiences.ts';

// ── BATTLES AGAINST A PROVINCE'S DEFENDERS (plan P1-08g: lifted out of resolveTurn) ────
// A host's battle against the defenders of a province that no hero of a realm holds: its neutral defenders, a local
// chieftain or wandering guard leading them, or a realm's unled garrison (combatVsNPC). It takes the turn's context
// first (src/engine/turn/context.ts). Above it, the constants both battle paths read (combatVsNPC here, combatVsChar
// in battle/battles-between-heroes.ts): the carry-on death scaling, the airborne-at-sea penalties, the narrative verbs
// and the battle spells of special units.
// a battle that carries on round after round in the same province grows deadlier for BOTH sides.
// prov._carryOnRounds counts the carry-ons (0 for the opening clash); death chances scale by 1 +
// CARRYON_DEATH_STEP per round, capped at CARRYON_DEATH_CAP×.
export const CARRYON_DEATH_STEP = 0.35,
  CARRYON_DEATH_CAP = 2.5;

// a force at sea is AIRBORNE when it contains at least one land unit
// (neither flying nor naval) and NO naval unit at all — the land units can only be there because the
// flyers carried them. Carried land units then fight at ×0.25 and the carrying humanoid flyers at
// ×0.5
// (applied in armStr). Module-level so both battle paths and the narrative lines can share it.
export const SEA_AIRBORNE_LAND_PENALTY = 0.25,
  SEA_AIRBORNE_FLYER_PENALTY = 0.5;

// Simple combat resolve
// ── ARMY BATTLE NARRATIVE ENGINE ────
// Narrative vocabulary helpers (P1-12d20: the verbs of an attack and of a defence are the prose's,
// src/views/prose/the-words-of-a-battles-lines.ts; the engine draws an attack's by its index)
export const LOSE_VERBS = ['is repulsed by', 'retreats before', 'cannot break', 'is driven back by'];

export function combatVsNPC(turnContext, c, prov, neutralGuardHero) {
  const { G, _tel } = turnContext;
  turnContext._combatSkillProv = prov && prov.id != null ? prov.id : null; // battle-series key (cleared at each loop boundary)
  // a resumed battle is another carry-on round (deadlier); a fresh clash resets the count.
  if (prov) {
    if (c && c._resumeBattle && !c._openingClash) prov._carryOnRounds = (prov._carryOnRounds || 0) + 1;
    else prov._carryOnRounds = 0;
  }
  const narrative = [];
  // Battle-scoped psychic negations start clear each battle (set by pre-battle magic below).
  if (c) {
    c._druidNegated = false;
    c._tacticalNegated = false;
    c._tacticalHalved = false;
    c._tacticalMult = 1;
    c._curseHalveStat = null;
    if (c._massConfusedTurn === G.turn) c._tacticalNegated = true;
  }
  if (neutralGuardHero) {
    neutralGuardHero._druidNegated = false;
    neutralGuardHero._tacticalNegated = false;
    neutralGuardHero._tacticalHalved = false;
    neutralGuardHero._tacticalMult = 1;
    neutralGuardHero._curseHalveStat = null;
  }
  // TACTICAL L6 (10%/unit) & War Drum (20%/unit) — decide ONCE, here, which of c's units fight a
  // tier higher this battle.
  if (c && Array.isArray(c.armies)) {
    const _tac = perkTier(c, 'tactical') > 0,
      _drum = activeItems(c).some((it) => it && it.drumTierUp);
    c.armies.forEach((a) => {
      if (a) {
        a._tacUp = _tac && kcRng() < 0.1;
        a._drumUp = _drum && kcRng() < 0.2;
      }
    });
  }
  const _cLA = !!(c && c._lightningAdvanceTurn === G.turn); // MARCH L9 Lightning Advance: defenders fight with no terrain / magic / archery this battle
  const armies = c.armies || [];
  const defenders = prov.neutralDefenders || [];
  injectPhantoms(c, realCharOf(turnContext, c)); // PHANTASMAL/PHANTOM HOST: spectral doubles join the fight (removed at battle end)

  // Setup — the deployment is described BEFORE the challenge is issued, so a commander slain in
  // the pre-battle duel is not narrated "standing firm" after they have already fallen. frame HOW
  // the battle began — who advanced, into whose ground — so the report doesn't jump straight into
  // combat with no context. Item: an enemy-OWNED province defended only by its garrison (no
  // commander) must not read like a neutral fight — name the crown that holds it and colour its
  // garrison as theirs.
  const _npcOwnerName = prov.owner != null && G.players[prov.owner] ? G.players[prov.owner].name || null : null;
  const _npcHeldBy = neutralGuardHero
    ? { kind: 'the defenders led by their guard', guardName: neutralGuardHero.name.replace(' (wandering)', '') }
    : _npcOwnerName
      ? { kind: "a realm's garrison with no guard to lead it", ownerName: _npcOwnerName }
      : { kind: 'neutral defenders with no guard to lead them' }; // the prose writes the label (plan P1-12d23)
  // Items 6 & 11: the "moves into … a battle is initiated" line is ALWAYS the first line of a
  // battle report — before terror, flak or any other pre-battle note.
  if (!c._resumeBattle)
    narrate(narrative, {
      kind: 'the attacker moves into a province held by its defenders and a battle is initiated',
      cName: c.name,
      aRealmsHero: c.player != null,
      attackersRealmName: G.players[c.player]?.name,
      provName: prov.name,
      heldByName: _npcHeldBy,
    }); // same opener as PvP
  // Evil Terror: if this province was terrorised on a previous turn, demoralise its defenders
  // (stacking). Reign of Fear is read first: the attacker's Monsters fight ×1.5 on ground its Terror grips.
  const _fearAtk = reignOfFearHere(prov, c.player);
  consumeTerror(prov, defenders, narrative);
  if (
    _fearAtk &&
    (c.player != null ? G.players[c.player]?.alignment : null) === 'Evil' &&
    armies.some((a) => a && MONSTER_ARMIES.has(a.type))
  )
    narrate(narrative, {
      kind: 'the province still cowers under a reign of fear',
      provName: prov.name,
      terrorHeroName: c.name,
      reignOfFearMultiplier: REIGN_OF_FEAR_MULT,
    });
  narrate(narrative, { kind: 'the battle for a province begins', provName: prov.name });
  {
    const _ic = magicItemsLine(c);
    if (_ic) narrate(narrative, _ic);
  } // commander's magic items in play
  {
    const _kA = kinNarrative(armies, c, c.player != null ? G.players[c.player]?.race : null, {
      kind: "a hero's host in the battle",
      heroName: c.name,
    });
    if (_kA) narrate(narrative, _kA); // item 7
    const _kD = kinNarrative(
      defenders,
      neutralGuardHero || null,
      prov.owner != null ? G.players[prov.owner]?.race : null,
      { kind: "a province's defenders, whoever leads them", provName: prov.name },
    );
    if (_kD) narrate(narrative, _kD);
  }
  {
    const _aS = Math.round(
      (armies || []).reduce(
        (t, a) =>
          t +
          (a && !a._phantom
            ? armStr(turnContext, a, c, c.player != null ? G.players[c.player]?.alignment : null, prov.terrain, {
                force: armies,
                enemyForce: defenders,
                isAttacker: true,
                amphibious: !!c._amphibiousAssault,
                coastal: provIsCoastal(G, prov),
                reignOfFear: _fearAtk,
              })
            : 0),
        0,
      ),
    ); // 2026-09-18 · 2026-09-23b: same ctx as the battle rows
    narrate(
      narrative,
      forceMarker(
        turnContext,
        {
          kind: 'a hero, with the realm he serves',
          heroName: c.name,
          servesARealm: c.player != null,
          realmName: G.players[c.player]?.name,
        },
        c.player,
        'attacker',
        armies,
        {
          itsVerbs: 'an attack',
          verbIndex: Math.floor(kcRng() * THE_NUMBER_OF_VERBS_AN_ATTACK_IS_TOLD_WITH),
          provName: prov.name,
          armyStrength: _aS,
          tacticalLevel: null,
        },
      ),
    ); // realm named, as in PvP
    // 2026-09-24 (Toby item 2): the defending side's header carries its own post-modifier strength
    // in the SAME format as the attacker's (and as PvP) — terrain, kinship, abilities and the
    // chieftain's own bonuses all counted, before Tactical / battle lines / dice.
    const _dS = Math.round(
      (defenders || []).reduce(
        (t, a) =>
          t +
          (a && !a._phantom
            ? armStr(
                turnContext,
                a,
                neutralGuardHero || null,
                prov.owner != null ? G.players[prov.owner]?.alignment : null,
                prov.terrain,
                { force: defenders, enemyForce: armies, isAttacker: false, coastal: provIsCoastal(G, prov) },
              )
            : 0),
        0,
      ),
    );
    if (neutralGuardHero) {
      narrate(
        narrative,
        forceMarker(
          turnContext,
          { kind: "a province's guard at the head of its force", guardName: neutralGuardHero.name },
          null,
          'defender',
          defenders,
          {
            itsVerbs: 'a defence',
            verbIndex: THE_VERB_A_PROVINCES_DEFENDERS_STAND_WITH,
            provName: prov.name,
            armyStrength: _dS,
            tacticalLevel: null,
          },
          { guard: true },
        ),
      );
    } else {
      narrate(
        narrative,
        forceMarker(
          turnContext,
          _npcOwnerName
            ? { kind: "a realm's garrison at a province", ownerName: _npcOwnerName, provName: prov.name }
            : { kind: "a province's own defenders with no one to lead them", provName: prov.name },
          prov.owner != null ? prov.owner : null,
          'defender',
          defenders,
          {
            itsVerbs: 'a defence',
            verbIndex: THE_VERB_A_PROVINCES_DEFENDERS_STAND_WITH,
            provName: prov.name,
            armyStrength: _dS,
            tacticalLevel: null,
          },
        ),
      );
    }
  }

  // ── Duel before battle ── Only when the province has a commander to answer for it; leaderless
  // garrisons have nobody to ride out. The guardian's stance comes from their Temper. 2026-09-13:
  // a duel with the local chieftain may advance ONE skill, no more. Scoped with try/finally so a
  // throw inside the duel can never leave the cap latched on for the rest of the turn.
  let _npcDuel;
  turnContext._chieftainDuelGain = neutralGuardHero && neutralGuardHero._isNeutralGuard ? { used: false } : null;
  try {
    _npcDuel = preBattleDuel(turnContext, c, neutralGuardHero, narrative);
  } finally {
    turnContext._chieftainDuelGain = null;
  }
  const _npcAtkMorale = _npcDuel.atkMorale,
    _npcDefMorale = _npcDuel.defMorale;
  // `|| c.alive===false` — the commander may have been killed in an EARLIER phase (duel,
  // encounter, pursuit, spell) while pinned in this contested province. His host fights on, and
  // must fight on exactly as it would after a pre-battle duel death: no Tactical, Archery, Naval,
  // Druid or spellcraft.
  const atkCmdrSlain = !!_npcDuel.atkSlain || c.alive === false,
    defCmdrSlain = !!_npcDuel.defSlain;
  if (defCmdrSlain)
    narrate(narrative, {
      kind: 'the guard is slain before his host, and a sergeant of the garrison takes up the banner',
      guardName: neutralGuardHero.name.replace(' (wandering)', ''),
    });
  if (atkCmdrSlain)
    narrate(narrative, {
      kind: 'the attacker is cut down before the lines join, and the eldest captain takes command',
      cName: c.name,
    });
  // below the duel, an attacker slain in single combat is spoken of as the stand-in who took
  // command, not the fallen leader — the setup lines and the death notice above keep the name.
  const cName = atkCmdrSlain ? `${c.name}'s leaderless host` : c.name; // slain → the host acts, not the dead commander
  // The attacker's side as the facts hold it (plan P1-12d23): the record the label above is written from; the prose
  // writes the label (theLabelOfASide). Since P1-12d30 the battle's report lines take it too, since P1-12d31 the lines
  // before the volleys, and since P1-12d32 the sea lift's.
  const atkSide = { heroName: c.name, leaderless: atkCmdrSlain };
  // A slain commander's skills die with them: the stand-in provides no Tactical, Archery, Naval,
  // Druid or spellcraft for the rest of this battle.
  const defHero = defCmdrSlain ? null : neutralGuardHero || null;
  let tactSkill =
    atkCmdrSlain || c._tacticalNegated
      ? 0
      : effStat(turnContext, c, 'tactical') + (charMinor(turnContext, c, 'strategist') ? 1 : 0);
  if (c._curseHalveStat === 'tactical') tactSkill = Math.floor(tactSkill / 2); // LEVEL 6+ PERK — Grand Tactician
  const tactBonus = Math.min(2.0, 1 + tactSkill * 0.2); // Tactical battle bonus hard-capped at ×2.0 (incl. titles)
  // Tactical only applies to land armies (not flying or naval) per AK 4.1.1 Tactical only applies
  // in land provinces AND to land units
  const isLandBattle = prov.terrain !== 'sea';
  const LAND_TYPES_TACT = isLandBattle ? armies.filter((a) => !FLYING_TYPES.has(a.type) && !SEA_TYPES.has(a.type)) : [];
  // 2026-09-23d: the "📊 X commands: Tactical N (×m to K land units)" line is gone — the Battle-stats
  // ladder names Tactical on the units it reaches, and this line still counted only ground units
  // (flyers take Tactical since 2026-09-23c), so the two disagreed.
  void LAND_TYPES_TACT;
  if (tactSkill > 0 && !isLandBattle)
    narrate(narrative, { kind: "the attacker's Tactical command does not apply at sea", cName: atkSide });
  const effectiveTactBonus = isLandBattle ? tactBonus : 1;

  // Terrain and defender bonus sd03 Siege Engines: attacker with this discovery reduces defender
  // bonus
  let defBonus = 1.25; // sd03 Siege Engines is now an ordinary `siege` effect (below)
  {
    const _sg = whatARealmsDiscoveriesAddToASiege(G.players[c.player], { theAttackersUnits: c.armies || [] });
    if (_sg > 0) {
      defBonus = Math.max(1, defBonus - _sg);
      narrate(narrative, {
        kind: "the attacker's siegecraft wears down the defenders' fortifications",
        atkName: atkSide,
        siegecraft: _sg,
      });
    }
  } // rd09 / ro10
  // GOOD — Righteous Defence: a Good realm's own soil is defended with quiet, unshakable
  // conviction (+10% to the defence of any province the Good player OWNS).
  if (prov.owner != null && prov.owner !== c.player && G.players[prov.owner]?.alignment === 'Good') {
    defBonus *= 1.1;
    narrate(narrative, { kind: 'the defenders of a province defend ground held justly', provName: prov.name });
  }
  // The attacker's items at the defenders' fortifications: the items' registry's "strength: the defenders'
  // fortifications" (plan P1-19n: his siege mastery). Against neutral guards no defender's items are read.
  {
    const _fort = theDefendersFortificationsAfterTheCommandersItems(
      { theDefendersFightAtTheirHome: false },
      { theAttackersItems: () => activeItems(c) },
      defBonus,
    );
    defBonus = _fort.theBonus;
    for (const _line of _fort.theLines)
      if (_line === "the attacker's siege mastery halves the defenders' fortifications")
        narrate(narrative, {
          kind: "the attacker's siege mastery halves the defenders' fortifications",
          atkName: atkSide,
        });
  }
  // (The Wyverns' cut to a neutral defence's bonus, Dread's stand-in here, was retired with the unit
  // abilities, 2026-10-11: Terror From Above bears on the strongest front unit, in battleFaceSide.)
  // home ground belongs ONLY to the province's founding owner — their own garrison defending it
  // (×1.2, i.e. ×1.5 total with the defender's edge), or the founder attacking to win their
  // captured capital back (×1.5). Any other holder gets nothing.
  const _founderN = homeFounderOf(G, prov.id);
  const isHome = _founderN != null && prov.owner === _founderN;
  const atkHome = _founderN != null && c.player === _founderN && prov.owner !== _founderN;
  if (isHome) narrate(narrative, { kind: 'the defenders fight on home soil' });
  if (atkHome)
    narrate(narrative, {
      kind: "the attacker fights to win back his realm's capital",
      atkName: atkSide,
      provName: prov.name,
    });
  {
    const _dOwn =
      prov.owner != null && prov.owner !== c.player
        ? theShareARealmsDiscoveriesFortifyItsOwnGroundBy(G.players[prov.owner], {
            isItTheRealmsHome: () => homeFounderOf(G, prov.id) === prov.owner,
          })
        : 0;
    if (_dOwn > 0) {
      defBonus *= 1 + _dOwn;
      narrate(narrative, {
        kind: "the defender's realm holds its own ground the harder",
        defName: { kind: 'the realm that holds the province', realmName: G.players[prov.owner]?.name },
        ownGroundDefencePct: dispFloor(_dOwn * 100),
      });
    }
  } // defOwn discoveries
  const homeBonus = isHome ? 1.2 : 1;
  const atkHomeBonus = atkHome ? 1.5 : 1;

  // Calculate strengths with some narrative
  const MISSILE_ARMIES = new Set(KC_UNIT_CLASS.missile);
  const archSkillAtk = atkCmdrSlain ? 0 : effStat(turnContext, c, 'archery');
  const archMissileBonus = 1 + archSkillAtk * ARCHERY_MISSILE_PCT; // 2026-09-23b (Toby): Archery lifts missile units +5%/level · sd07 Fire Arrows is a `unitStr` missile effect (armStr)
  let navalSkillAtk = atkCmdrSlain ? 0 : effStat(turnContext, c, 'naval');
  if (c._curseHalveStat === 'naval') navalSkillAtk = Math.floor(navalSkillAtk / 2); // Curse (battle magic) can wither Naval command
  const navalFleetBonus = 1 + navalSkillAtk * 0.2;
  const _provCoastal = provIsCoastal(G, prov); // Sea Giants' Tidal Might
  const playerAlign = G.players[c.player]?.alignment || 'Neutral';
  // ════
  // PRE-BATTLE PHASE 1: MAGIC Hero casts first CA: spell from their encounter plan that is
  // relevant to army combat (hits provinces/armies)
  // ════
  const BATTLE_MAGIC_SPELLS = new Set(BATTLE_MAGIC_SPELL_NAMES);
  applyWraithTouch(armies, defenders, narrative);
  applyWraithTouch(defenders, armies, narrative); // Wraith's Touch
  if (c) ensureEncounterPlan(turnContext, c); // bots/NPCs get an auto battle-magic plan so they cast when attacking
  const heroTactics = c.encounterPlan?.tactics || [];
  const heroPick = pickBattleSpell(turnContext, heroTactics, c, defHero, defenders);
  if (heroPick && !atkCmdrSlain) {
    const spellName = heroPick.spellName;
    const school = heroPick.school;
    const spellLvl = effStat(turnContext, c, school);
    if (spellLvl >= 1) {
      const castChance = Math.min(
        95,
        SPELL_CAST_BASE +
          spellLvl * 10 +
          magicL8CastBonus(c) +
          whatARealmsDiscoveriesAddToACastersChance(G.players[c.player], { theSchool: school, whereHeCasts: 'battle' }),
      ); // cast discoveries · 2026-09-11: base 30
      const castRoll = d100();
      telSpell(turnContext, c, spellName, school, spellLvl, castChance, castRoll, 'battle');
      narrate(narrative, {
        kind: 'the attacker casts a spell before the battle against the defenders',
        cName: atkSide,
        spellName,
        schoolLabel: SKILL_LABELS[school] || school,
        spellLevel: spellLvl,
        castChance,
        castRoll,
      });
      if (castRoll <= castChance) {
        // pre-battle magic no longer trains the school. Casting into a battle is not the same
        // test as casting in a duel, and it was the cheapest experience in the game — one order,
        // no risk, a roll every battle. In-duel casting (pcCastCombatSpell) still trains.
        // What the spell does is the spells' registry's (plan P1-19u); this copy draws where it drew, applies it and
        // writes its line.
        const done = whatABattleSpellDoesBeforeTheBattle(spellName, {
          theCopy: 'a hero against the guards',
          theCastersLevel: spellLvl,
          theEnemysUnits: defenders.map((d) => ({
            type: d.type || '',
            race: d.race,
            isSkeletal: !!d._isSkeletal,
            baseStrength: unitBaseStrength(d),
            isAMissileUnit: MISSILE_ARMIES.has(d.type),
          })),
          theEnemyCommander: defHero
            ? {
                tactical: effStat(turnContext, defHero, 'tactical'),
                theSkillACurseWithers: bestCurseSkill(turnContext, defHero),
              }
            : null,
          atSea: prov.terrain === 'sea',
          theStrongestUnitsTheCastersItemsLetAFireballStrike: c
            ? theStrongestUnitsAHerosItemsLetHisFireballStrike(activeItems(c))
            : null,
        });
        const strike = (s) => {
          const d = defenders[s.theUnit];
          d._tempStrReduction = (d._tempStrReduction || 0) + s.theStrengthItLoses;
        };
        switch (done?.kind) {
          case 'the strongest units lose strength':
            done.theUnitsStruck.forEach(strike);
            narrate(narrative, {
              kind: done.theLine,
              fireballHitUnitNames: done.theUnitsStruck.map(
                (s) => defenders[s.theUnit].unitName || defenders[s.theUnit].type,
              ),
            });
            break;
          case 'units drawn at random lose strength': {
            const theLoss = new Map(defenders.map((d, i) => [d, done.theStrengthEachWouldLose[i]]));
            const picks = shuffleP(defenders).slice(0, done.howMany);
            picks.forEach((d) => {
              d._tempStrReduction = (d._tempStrReduction || 0) + theLoss.get(d);
            });
            narrate(narrative, { kind: done.theLine, unitCount: done.howMany });
            break;
          }
          case 'the undead lose strength':
            done.theUnitsStruck.forEach(strike);
            narrate(narrative, { kind: done.theLine, undeadUnitCount: done.theUnitsStruck.length });
            break;
          case 'the missile units lose strength':
            done.theUnitsStruck.forEach(strike);
            narrate(narrative, { kind: done.theLine, missileUnitCount: done.theUnitsStruck.length });
            break;
          case "the enemy commander's Tactical is cut":
            defHero._tacticalHalved = true;
            defHero._tacticalMult = done.theMultiplier;
            narrate(narrative, {
              kind: done.theLine,
              enemyCommanderName: { heroName: defHero.name, leaderless: false },
            });
            break;
          case "the enemy commander's Druid is negated":
            defHero._druidNegated = true;
            narrate(narrative, {
              kind: done.theLine,
              enemyCommanderName: { heroName: defHero.name, leaderless: false },
            });
            break;
          case "the enemy commander's skill is withered":
            defHero._curseHalveStat = done.theSkill;
            narrate(narrative, {
              kind: done.theLine,
              enemyCommanderName: { heroName: defHero.name, leaderless: false },
              cursedSkill: defHero._curseHalveStat,
            });
            break;
          case 'an undead unit drawn at random defects': {
            const pick = done.theUndead[Math.floor(kcRng() * done.theUndead.length)];
            const unit = defenders.splice(pick, 1)[0];
            armies.push(unit);
            const rc = G.characters[c.id];
            if (rc) {
              rc.armies = rc.armies || [];
              rc.armies.push(unit);
            }
            narrate(narrative, {
              kind: done.theLine,
              turnedUnitName: unit.unitName || unit.type,
              cName: atkSide,
            });
            break;
          }
          case 'nothing to strike':
            if (done.theLine) narrate(narrative, { kind: done.theLine });
            break;
        }
        // NOTE: the magic-school skill-up is handled ONCE by trySkillGain(c, school, …, narrative)
        // above.
      } else {
        narrate(narrative, { kind: "the attacker's spell before the battle fizzles" });
      }
    }
  }

  // Pre-battle magic: special army spells (Wyvern Riders, etc. + all primal armies)
  const druIdLvlMag = atkCmdrSlain ? 0 : effStat(turnContext, c, 'druid');
  armies.forEach((atk) => {
    // What the unit's strike may do is the spells' registry's (plan P1-19v): its strikes are its type's, in the
    // content's tables; its chance 30% + 10% per Druid level (the winged riders' one in two). This copy draws where it
    // drew, rolls its chance, applies the blow and writes its lines.
    const may = whatAUnitsStrikeMayDoBeforeTheBattle({
      theCopy: "a hero's units against the guards",
      theUnitsType: atk.type,
      theEnemyHasAUnit: defenders.length > 0,
      theDruidLevel: Number(druIdLvlMag) || 0,
      whatTheCommandersItemsAdd: () => primalStrikeItemBonus(atkCmdrSlain ? null : c),
    });
    if (!may) return;
    const sp = may.theStrikes[Math.floor(kcRng() * may.theStrikes.length)];
    const armySpellChance = may.theChance;
    const armySpellRoll = d100();
    if (armySpellRoll > armySpellChance && may.theLineIfItMisses) {
      narrate(narrative, {
        kind: may.theLineIfItMisses,
        unitName: atk.unitName || atk.type,
        powerName: sp.name,
        strikeChancePct: armySpellChance,
        druidLevel: druIdLvlMag,
      });
    }
    if (armySpellRoll <= armySpellChance) {
      narrate(narrative, {
        kind: may.theLineIfItStrikes,
        unitName: atk.unitName || atk.type,
        powerName: sp.name,
        powerFlavour: sp.flavour,
      });
      if (sp.theBlow.reaches === 'every enemy unit') {
        const dmg = rng(sp.theBlow.theDamage[0], sp.theBlow.theDamage[1]);
        defenders.forEach((d) => {
          d._tempStrReduction = (d._tempStrReduction || 0) + dmg;
        });
        narrate(narrative, {
          kind: sp.theBlow.theLine,
          powerName: sp.name,
          unitCount: defenders.length,
          damage: dmg,
        });
      } else {
        const d = defenders[Math.floor(kcRng() * defenders.length)];
        const dmg = rng(sp.theBlow.theDamage[0], sp.theBlow.theDamage[1]);
        d._tempStrReduction = (d._tempStrReduction || 0) + dmg;
        narrate(narrative, {
          kind: sp.theBlow.theLine,
          powerName: sp.name,
          struckUnitName: d.unitName || d.type,
          damage: dmg,
        });
      }
    }
  });

  // Neutral guard hero tactical skill adds to their defense (declared here, used in rawDefStr
  // below)
  let defTactLvl = defHero
    ? defHero._tacticalNegated
      ? 0
      : effStat(turnContext, defHero, 'tactical') + (charMinor(turnContext, defHero, 'strategist') ? 1 : 0)
    : 0;
  if (defHero && defHero._curseHalveStat === 'tactical') defTactLvl = Math.floor(defTactLvl / 2); // LEVEL 6+ PERK — Grand Tactician
  const defTactBonus = defTactLvl > 0 ? Math.min(2.0, 1 + defTactLvl * 0.2) : 1; // cap ×2.0
  // Army / defender counts (needed by archery and battle lines)
  const atkCount = armies.length;
  const defCount = (prov.neutralDefenders || []).length;

  // ════
  // PRE-BATTLE PHASE 2: ARCHERY Each attacker missile unit fires at a random defender Quiver of
  // Many Arrows = 2 volleys per unit
  // ════
  // the items' registry's "volley: the commander adds volleys" (plan P1-19n: the Quivers)
  const _itemVolleys = theVolleysTheCommandersItemsLoose(activeItems(c));
  const hasQuiver = _itemVolleys.theLines.includes('each missile unit looses two volleys instead of one');
  const _manyArrows = _itemVolleys.theLines.includes('each missile unit looses one more shot'); // one extra shot per missile unit
  applyFlakScreen(armies, defenders, { heroName: c.name, leaderless: false }, narrative);
  // PRIMAL — Breach and Swamp: whale cohorts roll a hull over before a shot is fired. The rule registry's
  // "fate: a hull is sunk before the battle" picks the hull, with the dice it is handed (plan P1-19i).
  // 2026-09-23d: defenders lost OUTSIDE the `_died` flag — hulls sunk here (spliced out of the list)
  // and units a WINNING garrison loses (`_defDied`, cleared before return) — are counted into
  // these so the returned defLost is the true figure (it pays merit when the attacker wins).
  let _npcSunkLost = 0,
    _npcDefWinLost = 0;
  (function () {
    (armies || []).forEach((a) => {
      if (!a) return;
      const hulls = (defenders || []).filter((d) => d && SEA_TYPES.has(d.type) && !d._sunk);
      const at = theHullAUnitSinksBeforeTheBattle({ unitType: a.type, theEnemyHullsAfloat: hulls, theDice: kcRng });
      if (at === null) return;
      const t = hulls[at];
      t._sunk = true;
      narrate(narrative, {
        kind: 'a whale cohort sinks a defending ship before a shot is fired',
        targetUnitName: t.unitName || t.type,
      });
    });
    if (defenders.some((a) => a._sunk)) {
      const lost = defenders.filter((a) => a._sunk);
      _npcSunkLost += lost.filter((a) => a && !a._phantom).length; // 2026-09-23d: spliced out below, so counted here for defLost
      recordBattleGraves(turnContext, prov, lost);
      for (let i = defenders.length - 1; i >= 0; i--) if (defenders[i]._sunk) defenders.splice(i, 1);
      if (defHero) defHero.armies = (defHero.armies || []).filter((a) => !a._sunk);
      prov.neutralDefenders = (prov.neutralDefenders || []).filter((a) => !a._sunk);
    }
  })();
  {
    const _eyes = eyesOfTheForestLine(defenders, prov.terrain, armies, atkSide);
    if (_eyes) narrate(narrative, _eyes);
  } // ELF — Eyes of the Forest
  const missileAtk = archeryBlockedBy(defenders, prov.terrain, armies) ? [] : abilityMissileUnits(armies, prov.terrain);
  if (archeryBlockedBy(defenders, prov.terrain, armies) && armies.some((a) => MISSILE_ARMIES.has(a.type)))
    narrate(narrative, { kind: "the hero's archers find no target among the forest wardens", heroName: atkSide });
  if (missileAtk.length > 0 && defenders.length > 0) {
    narrate(narrative, {
      kind: "the attacker's archery volley begins",
      missileUnitCount: missileAtk.length,
      doubleVolleys: hasQuiver,
      oneMoreShot: _manyArrows,
    });
    const volleys = _itemVolleys.theVolleys;
    let totalArrowDmg = 0;
    missileAtk.forEach((atk) => {
      for (let v = 0; v < volleys; v++) {
        // Archers loose at the enemy's flyers first if any are present (double damage vs flyers);
        // otherwise they target a random front-row defender.
        const pool = missileTargetPool(defenders, 0, atk, armies); // winged riders first, else any random target not yet at its cap (Eyes of the Forest reads the shooters' force)
        if (!pool.length) break;
        const target = pool[Math.floor(kcRng() * pool.length)];
        const dmgMult = missileDamageMult(atk, armies, prov.terrain, target, true);
        const hit = applyMissileHit(target, archSkillAtk, atk, { dmgMult });
        totalArrowDmg += hit.dmg;
        if (hit.immune)
          narrate(narrative, {
            kind: 'a unit fires at its target and the shot glances off',
            shooterName: atk.unitName || atk.type,
            targetUnitName: target.unitName || target.type,
            whyTheShotGlances: hit.why,
          });
        else if (hit.dmg > 0)
          narrate(narrative, {
            kind: 'a unit fires at its target and weakens it',
            shooterName: atk.unitName || atk.type,
            targetUnitName: target.unitName || target.type,
            damage: hit.dmg,
            againstAFlyer: hit.isFly,
            thickHideHalvesIt: hit.thickHide,
            shootersUnitType: atk.type,
            shootersAbilityMultiplier: dmgMult,
            softenedToTheLimit: hit.capped,
          });
        else
          narrate(narrative, {
            kind: "an attacking unit's target is already softened as far as arrows allow",
            shooterName: atk.unitName || atk.type,
            targetUnitName: target.unitName || target.type,
          });
      }
    });
    narrate(narrative, {
      kind: "the attacker's archery volley's total",
      totalDamage: totalArrowDmg,
      arrowSofteningCapPct: dispFloor(MISSILE_CAP_FRACTION * 100),
    });
  }

  // ════
  // DEFENDER PRE-BATTLE PHASES — neutral guard heroes and their armies fight back with magic,
  // army spells, and missile fire (reduces ATTACKER strength)
  // ════
  if (defHero) {
    // DEFENDER MAGIC: guard casts a battle spell from their encounter plan (school or specific),
    // or picks one they know
    ensureEncounterPlan(turnContext, defHero);
    const defTactics = defHero.encounterPlan?.tactics || [];
    let defSpellName = null;
    // First: honour an explicit school ('CS:') or spell ('CA:') choice from the plan
    const defPick = pickBattleSpell(turnContext, defTactics, defHero, atkCmdrSlain ? null : c, armies);
    if (defPick) defSpellName = defPick.spellName;
    // Otherwise: auto-pick a battle spell the guard has the school skill for — preferring one
    // that actually has a valid target/effect on this field, so the cast is not wasted.
    if (!defSpellName) {
      for (const sname of BATTLE_MAGIC_SPELLS) {
        const sdef = SPELL_DEFS_P[sname];
        if (
          sdef &&
          effStat(turnContext, defHero, sdef.school) > 0 &&
          battleSpellUseful(turnContext, sname, atkCmdrSlain ? null : c, armies)
        ) {
          defSpellName = sname;
          break;
        }
      }
    }
    if (!defSpellName) {
      for (const sname of BATTLE_MAGIC_SPELLS) {
        const sdef = SPELL_DEFS_P[sname];
        if (sdef && effStat(turnContext, defHero, sdef.school) > 0) {
          defSpellName = sname;
          break;
        }
      }
    }
    if (defSpellName && armies.length > 0) {
      const sdef = SPELL_DEFS_P[defSpellName];
      const school = sdef?.school || 'elemental';
      const defSpellLvl = effStat(turnContext, defHero, school);
      if (defSpellLvl > 0) {
        const castChance = guardCastChance(defHero, school, G.characters); // D7: the same odds as a player's hero
        const castRoll = d100();
        telSpell(turnContext, defHero, defSpellName, school, defSpellLvl, castChance, castRoll, 'battle');
        narrate(narrative, {
          kind: 'the defender casts a spell before the battle',
          casterName: defHero.name,
          spellName: defSpellName,
          schoolLabel: SKILL_LABELS[school] || school,
          spellLevel: defSpellLvl,
          castChance,
          castRoll,
        });
        if (castRoll <= castChance) {
          // no school gain from pre-battle magic — see the attacker's cast above.
          // What the spell does is the spells' registry's (plan P1-19u); this copy draws where it drew, applies it and
          // writes its line.
          const done = whatABattleSpellDoesBeforeTheBattle(defSpellName, {
            theCopy: "the guards' commander",
            theCastersLevel: defSpellLvl,
            theEnemysUnits: armies.map((a) => ({
              type: a.type || '',
              race: a.race,
              isSkeletal: !!a._isSkeletal,
              baseStrength: unitBaseStrength(a),
              isAMissileUnit: MISSILE_ARMIES.has(a.type),
            })),
            theEnemyCommander: c
              ? { tactical: effStat(turnContext, c, 'tactical'), theSkillACurseWithers: bestCurseSkill(turnContext, c) }
              : null,
            atSea: prov.terrain === 'sea',
            theStrongestUnitsTheCastersItemsLetAFireballStrike: null,
          });
          const strike = (s) => {
            const a = armies[s.theUnit];
            a._tempStrReduction = (a._tempStrReduction || 0) + s.theStrengthItLoses;
          };
          switch (done?.kind) {
            case 'the strongest units lose strength': {
              const [hit] = done.theUnitsStruck;
              strike(hit);
              narrate(narrative, {
                kind: done.theLine,
                targetUnitName: armies[hit.theUnit].unitName || armies[hit.theUnit].type,
                strengthLost: hit.theStrengthItLoses,
              });
              break;
            }
            case 'units drawn at random lose strength': {
              const theLoss = new Map(armies.map((a, i) => [a, done.theStrengthEachWouldLose[i]]));
              shuffleP(armies)
                .slice(0, done.howMany)
                .forEach((a) => {
                  a._tempStrReduction = (a._tempStrReduction || 0) + theLoss.get(a);
                });
              narrate(narrative, { kind: done.theLine, unitCount: done.howMany });
              break;
            }
            case 'the undead lose strength':
              done.theUnitsStruck.forEach(strike);
              narrate(narrative, { kind: done.theLine, undeadUnitCount: done.theUnitsStruck.length });
              break;
            case 'the missile units lose strength':
              done.theUnitsStruck.forEach(strike);
              narrate(narrative, { kind: done.theLine, missileUnitCount: done.theUnitsStruck.length });
              break;
            case "the enemy commander's Tactical is cut":
              c._tacticalHalved = true;
              c._tacticalMult = done.theMultiplier;
              narrate(narrative, { kind: done.theLine, enemyCommanderName: atkSide });
              break;
            case "the enemy commander's Druid is negated":
              c._druidNegated = true;
              narrate(narrative, { kind: done.theLine, enemyCommanderName: atkSide });
              break;
            case "the enemy commander's skill is withered":
              c._curseHalveStat = done.theSkill;
              narrate(narrative, {
                kind: done.theLine,
                enemyCommanderName: atkSide,
                cursedSkill: c._curseHalveStat,
              });
              break;
            case 'an undead unit drawn at random defects': {
              const pick = done.theUndead[Math.floor(kcRng() * done.theUndead.length)];
              const unit = armies.splice(pick, 1)[0];
              defHero.armies = defHero.armies || [];
              defHero.armies.push(unit);
              const rc = G.characters[defHero.id];
              if (rc && rc !== defHero) {
                rc.armies = rc.armies || [];
                rc.armies.push(unit);
              }
              narrate(narrative, {
                kind: done.theLine,
                turnedUnitName: unit.unitName || unit.type,
                casterName: defHero.name,
              });
              break;
            }
            case 'nothing to strike':
              if (done.theLine) narrate(narrative, { kind: done.theLine });
              break;
          }
        } else {
          narrate(narrative, { kind: "the defender's spell before the battle fizzles" });
        }
      }
    }
  }

  // DEFENDER ARCHERY — 2026-09-24 (Toby): moved OUT of the if(defHero) block, so a garrison with no
  // commander still shoots back (at Archery 0). The Lightning Advance line and the defenders' Flak
  // Screen came out with it — both had also been skipped for a leaderless garrison.
  // DEFENDER ARCHERY: defending missile units fire at the attackers
  if (_cLA) {
    (defenders || []).forEach((d) => {
      if (d) d._laNoTerrain = true;
    });
    narrate(narrative, { kind: "the attacker's lightning advance catches the defenders unready", cName: c.name });
  }
  // The defenders as the lines before the volleys name them (plan P1-12d31: a record; the prose writes the label): their
  // guard, or "The defenders" with no guard (or a guard with no name) to name them.
  const _defSideBeforeTheVolleys = defHero?.name
    ? { kind: 'the defenders led by their guard', guardName: defHero.name }
    : { kind: "a province's defenders with no guard to name them, as the lines before the volleys name them" };
  applyFlakScreen(_cLA ? [] : defenders, armies, _defSideBeforeTheVolleys, narrative);
  // ELF — Ambush, the other direction (2026-09-27, Toby): only the ATTACKER's volley was gated here,
  // so Forest Wardens marching on a neutral garrison did not silence its archers, while the very
  // same Wardens attacking another PLAYER did (the PvP path tests the OTHER side's force whichever
  // way round it is). Both paths now agree: a force facing Wardens in forest or jungle loses its
  // volley, attacking or defending.
  if (!_cLA) {
    const _eyes = eyesOfTheForestLine(armies, prov.terrain, defenders, _defSideBeforeTheVolleys);
    if (_eyes) narrate(narrative, _eyes);
  } // ELF — Eyes of the Forest
  const _defArchBlocked = !_cLA && archeryBlockedBy(armies, prov.terrain, defenders);
  if (_defArchBlocked && defenders.some((a) => MISSILE_ARMIES.has(a.type)))
    narrate(narrative, {
      kind: "the defenders' archers find no target among the attacker's forest wardens",
      cName: atkSide,
    });
  const missileDef = _cLA || _defArchBlocked ? [] : abilityMissileUnits(defenders, prov.terrain);
  if (missileDef.length > 0 && armies.length > 0) {
    const defArchSkill = defHero ? effStat(turnContext, defHero, 'archery') : 0; // a leaderless garrison shoots at Archery 0
    const _prepared = missileDef.some((d) => abilityVolleys(d, false) > 1); // HUMAN — Prepared Ground: defending Longbows loose twice
    narrate(narrative, {
      kind: "the defenders' archery volley begins",
      missileUnitCount: missileDef.length,
      preparedGround: _prepared,
    });
    let totalDefArrow = 0;
    missileDef.forEach((def) => {
      for (let v = 0; v < abilityVolleys(def, false); v++) {
        // winged riders first (a random one each shot), else any random attacker not yet at its cap
        const pool = missileTargetPool(armies, 0, def, defenders);
        if (!pool.length) break;
        const target = pool[Math.floor(kcRng() * pool.length)];
        const dmgMult = missileDamageMult(def, defenders, prov.terrain, target, false);
        const hit = applyMissileHit(target, defArchSkill, def, { dmgMult });
        totalDefArrow += hit.dmg;
        if (hit.immune)
          narrate(narrative, {
            kind: 'a unit fires at its target and the shot glances off',
            shooterName: def.unitName || def.type,
            targetUnitName: target.unitName || target.type,
            whyTheShotGlances: hit.why,
          });
        else if (hit.dmg > 0)
          narrate(narrative, {
            kind: 'a unit fires at its target and weakens it',
            shooterName: def.unitName || def.type,
            targetUnitName: target.unitName || target.type,
            damage: hit.dmg,
            againstAFlyer: hit.isFly,
            thickHideHalvesIt: hit.thickHide,
            shootersUnitType: def.type,
            shootersAbilityMultiplier: dmgMult,
            softenedToTheLimit: hit.capped,
          });
        else
          narrate(narrative, {
            kind: "a defending unit's target is already softened as far as arrows allow",
            unitName: def.unitName || def.type,
            targetUnitName: target.unitName || target.type,
          });
      }
    });
    narrate(narrative, {
      kind: "the defenders' archery volley's total",
      totalDamage: totalDefArrow,
      arrowSofteningCapPct: dispFloor(MISSILE_CAP_FRACTION * 100),
    });
  }

  // DEFENDER ARMY SPELLS: primal/special defending units cast their innate battle spells. MOVED
  // OUT of the if(defHero) guard: commanderless defenders (garrisons, guardian-less primal
  // provinces, leaderless survivors) previously never rolled their strikes AT ALL — a Basilisk
  // Brood defending without a hero was silently inert. No commander = druid 0 (20% base chance).
  const defDruIdLvl = defHero && !defHero._druidNegated ? effStat(turnContext, defHero, 'druid') : 0;
  (_cLA ? [] : defenders).forEach((def) => {
    // the spells' registry's "strength: a unit strikes before the battle" (plan P1-19v); this copy rolls as it rolled
    const may = whatAUnitsStrikeMayDoBeforeTheBattle({
      theCopy: "the guards' units against a hero",
      theUnitsType: def.type,
      theEnemyHasAUnit: armies.length > 0,
      theDruidLevel: Number(defDruIdLvl) || 0,
      whatTheCommandersItemsAdd: () => primalStrikeItemBonus(defHero && !defHero._druidNegated ? defHero : null),
    });
    if (!may) return;
    const sp = may.theStrikes[Math.floor(kcRng() * may.theStrikes.length)];
    const armySpellChance = may.theChance;
    if (kcRng() * 100 < armySpellChance) {
      narrate(narrative, {
        kind: may.theLineIfItStrikes,
        unitName: def.unitName || def.type,
        powerName: sp.name,
        powerFlavour: sp.flavour,
      });
      if (sp.theBlow.reaches === 'every enemy unit') {
        const dmg = rng(sp.theBlow.theDamage[0], sp.theBlow.theDamage[1]);
        armies.forEach((a) => {
          a._tempStrReduction = (a._tempStrReduction || 0) + dmg;
        });
        narrate(narrative, {
          kind: sp.theBlow.theLine,
          powerName: sp.name,
          unitCount: armies.length,
          damage: dmg,
        });
      } else {
        const a = armies[Math.floor(kcRng() * armies.length)];
        const dmg = rng(sp.theBlow.theDamage[0], sp.theBlow.theDamage[1]);
        a._tempStrReduction = (a._tempStrReduction || 0) + dmg;
        narrate(narrative, {
          kind: sp.theBlow.theLine,
          powerName: sp.name,
          struckUnitName: a.unitName || a.type,
          damage: dmg,
        });
      }
    } else if (may.theLineIfItMisses) {
      // Primal strikes now announce a miss (standard units stay quiet to keep reports lean).
      narrate(narrative, {
        kind: may.theLineIfItMisses,
        unitName: def.unitName || def.type,
        powerName: sp.name,
        strikeChancePct: armySpellChance,
        druidLevel: defDruIdLvl,
      });
    }
  });

  // ── TERRAIN MODIFIER NOTES ──
  {
    const _tn = terrainNoteList(armies, prov.terrain);
    if (_tn)
      narrate(narrative, {
        kind: "the terrain's effect on the attacker's units",
        terrain: prov.terrain,
        cName: atkSide,
        unitsTheTerrainMarks: _tn,
      });
  } // 2026-09-23d: shared formatter
  if (!isLandBattle && armies.some((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type))) {
    // 2026-09-23e: flying beasts are not "land units at sea"
    if (isAirborneAtSea(armies))
      narrate(narrative, {
        kind: 'hosts airborne over open water fight at a penalty against the defenders',
        seaAirborneLandPenalty: SEA_AIRBORNE_LAND_PENALTY,
        seaAirborneFlyerPenalty: SEA_AIRBORNE_FLYER_PENALTY,
      });
    else
      narrate(narrative, {
        kind: 'land units fight at sea at a penalty against the defenders',
        seaLandPenalty: SEA_LAND_PENALTY,
      });
  }

  // ── BATTLE LINES ──
  // (The old count-based "N flanking units" line is gone — it described a mechanic that no longer existed.)
  const atkFlankDisc = doARealmsDiscoveriesWeightTheLinesBehindTheFront(G.players[c.player]);
  const terrainFront = rollBattleWidth(prov.terrain); // 2026-10-11: rolled once per battle, shared by both sides; the scout may take one wider or narrower (battleDeploy)
  let lineWidth = terrainFront;
  void atkCount;
  void defCount;
  // Illusory Terrain: if this province is cloaked by an enemy's illusion, the attacker is
  // disoriented — each unit fights as though caught in the worst ground for its kind (min −15%).
  const _illCasterN = prov._illusoryTerrain ? prov._illusoryTerrain.caster : null;
  const _atkIllActive = _illCasterN != null && c.player !== _illCasterN;
  if (_atkIllActive)
    narrate(narrative, {
      kind: "the illusory ground of the province confuses a side's forces",
      provName: prov.name,
      sideName: atkSide,
    });
  // 2026-09-23b: rows built by ladderRow so the Battle-stats ladder names every modifier and
  // reconciles with rawAtkStr exactly. Same multipliers as before, same order-independent product.
  const armiesWithStr = armies
    .map((a) => {
      const cmd = [];
      if (MISSILE_ARMIES.has(a.type))
        cmd.push({
          key: 'arch',
          reason: { kind: 'archery', level: archSkillAtk, multiplier: archMissileBonus },
          m: archMissileBonus,
        });
      if (SEA_TYPES.has(a.type))
        cmd.push({
          key: 'nav',
          reason: { kind: 'naval', level: navalSkillAtk, multiplier: navalFleetBonus },
          m: navalFleetBonus,
        }); // Naval lifts fleets on land AND sea
      else
        cmd.push({
          key: 'tac',
          reason: { kind: 'tactical', multiplier: tacMulted(effectiveTactBonus, c) },
          m: tacMulted(effectiveTactBonus, c),
        }); // land AND air units (flyers since 2026-09-23c)
      if (_atkIllActive)
        cmd.push({
          key: 'ill',
          reason: { kind: 'illusory terrain', multiplier: illusoryTerrainMult(a.type) },
          m: illusoryTerrainMult(a.type),
        });
      return ladderRow(
        turnContext,
        a,
        c,
        playerAlign,
        prov.terrain,
        {
          force: armies,
          enemyForce: defenders,
          isAttacker: true,
          amphibious: !!c._amphibiousAssault,
          coastal: _provCoastal,
          reignOfFear: _fearAtk,
        },
        cmd,
      );
    })
    .sort((x, y) => y.fly - x.fly || y.base - x.base); // flying first, then strongest

  const rawAtkStr = battleLineTotal(armiesWithStr, lineWidth, atkFlankDisc); // undamaged, before whole-force (2026-09-24)
  // (2026-09-23b: the old comment here said the Archery strength bonus had never been applied — it
  // was, via archMissileBonus above. Archery is now +5%/level on missile units by design, and the
  // Battle-stats ladder names it on the units it reached.) Show Druid shortfall warnings
  const druIdLvl = effStat(turnContext, c, 'druid');
  {
    const _dl = druidShortfallLine(turnContext, atkSide, c, armies, playerAlign);
    if (_dl) narrate(narrative, _dl);
  } // 2026-09-23d: one line, not one per unit
  void druIdLvl;
  // (2026-09-23d: the standalone "Naval N grants +x%" line is retired — the ladder names it.)
  // Defender missile bonus — mirrors the attacker's. If the defending force has a commander
  // (defHero — a leaderless garrison passes null), their Archery lifts the garrison's bow and
  // crossbow units by +10% per level, exactly as it does for an attacker.
  const archSkillDef = defHero ? effStat(turnContext, defHero, 'archery') : 0;
  const defArchMissileBonus = 1 + archSkillDef * ARCHERY_MISSILE_PCT; // +5%/level (2026-09-23b) · sd07 Fire Arrows now via armStr
  // the defending commander's Naval lifts the fleets / sea-beasts they lead — land or sea —
  // exactly as the attacker's does.
  let navalSkillDef = defHero ? effStat(turnContext, defHero, 'naval') : 0;
  if (defHero && defHero._curseHalveStat === 'naval') navalSkillDef = Math.floor(navalSkillDef / 2);
  const defNavalFleetBonus = 1 + navalSkillDef * 0.2;
  let defLineWidth = terrainFront;
  // the defenders' Flanking Tactics come from the province OWNER (a player garrison) or the
  // defending commander's realm — previously hard-coded ×0.5 whatever discoveries they held.
  const defFlankDisc =
    (prov.owner != null && doARealmsDiscoveriesWeightTheLinesBehindTheFront(G.players[prov.owner])) ||
    (!!defHero &&
      defHero.player != null &&
      doARealmsDiscoveriesWeightTheLinesBehindTheFront(G.players[defHero.player]));
  const defsWithStr = (prov.neutralDefenders || [])
    .map((a) => {
      const cmd = [];
      if (MISSILE_ARMIES.has(a.type))
        cmd.push({
          key: 'arch',
          reason: { kind: 'archery', level: archSkillDef, multiplier: defArchMissileBonus },
          m: defArchMissileBonus,
        });
      if (SEA_TYPES.has(a.type))
        cmd.push({
          key: 'nav',
          reason: { kind: 'naval', level: navalSkillDef, multiplier: defNavalFleetBonus },
          m: defNavalFleetBonus,
        }); // defender's Naval, land or sea
      const landUnit = !SEA_TYPES.has(a.type); // land AND air units — flyers take Tactical since 2026-09-23c
      if (landUnit && prov.terrain !== 'sea')
        cmd.push({
          key: 'tac',
          reason: { kind: 'tactical', multiplier: tacMulted(defTactBonus, defHero) },
          m: tacMulted(defTactBonus, defHero),
        });
      return ladderRow(
        turnContext,
        a,
        defHero,
        null,
        prov.terrain,
        {
          force: defenders,
          enemyForce: armies,
          isAttacker: false,
          ownerRace: prov.owner != null ? G.players[prov.owner]?.race : null,
          ownerPi: prov.owner != null ? prov.owner : null,
          coastal: _provCoastal,
        },
        cmd,
      );
    })
    .sort((x, y) => y.fly - x.fly || y.base - x.base);
  // the defender's half of the same phantom bonus, removed for the same reason.
  // (2026-09-23d: the defender's standalone Naval line is retired likewise.)
  // Tactical on every land unit of a land battle — the same scope the attacker and both PvP sides
  // use.
  const rawDefStr = battleLineTotal(defsWithStr, defLineWidth, defFlankDisc); // undamaged, before whole-force (2026-09-24)
  // (Illusory Terrain is applied per-unit above, folded into each attacker's strength.)
  // L7/L9 MASTERY ORDER battle modifiers vs an NPC garrison (c is always the attacker here;
  // Feigned Retreat is purely defensive and correctly has no place on an attack).
  let atkOrdN = 1,
    defOrdN = 1;
  if (c._grandStratagemTurn === G.turn) {
    atkOrdN *= 1.2;
    narrate(narrative, { kind: 'the attacker unfolds a grand stratagem against the defenders', cName: atkSide });
  }
  if (raidLandedHere(turnContext, c, prov)) {
    atkOrdN *= 1.25;
    narrate(narrative, {
      kind: 'the attacker storms ashore in a raid on the coast against the defenders',
      cName: atkSide,
    });
  } // 2026-09-23e: only a coast attacked from the sea
  const atkStr = rawAtkStr * _npcAtkMorale * atkOrdN * atkHomeBonus;
  const defStr = rawDefStr * defBonus * homeBonus * _npcDefMorale * defOrdN;
  // Phantasmal Armies lasts only until the end of the next battle the hero is in — clear it now.
  {
    const _rc = G.characters[c.id];
    if (_rc) delete _rc._phantasmalBonus;
    if (c) delete c._phantasmalBonus;
  }

  // Fanaticism check
  const align = G.players[c.player]?.alignment || 'Neutral';
  const FANATIC_CHANCE = { ...FANATIC_CHANCE_BY_ALIGN };
  const fanatic =
    kcRng() <
    (FANATIC_CHANCE[align] ?? 0.1) +
      whatARealmsDiscoveriesAddToASidesFanaticism(G.players[c.player], {
        theSide: 'atk',
        theGround: prov.terrain,
        theForce: armies,
      }); // fanatic discoveries
  // Skeletal armies are always fanatical ONLY when led by the Undead king in person — other
  // heroes serving the Undead realm do not inspire the same undying zeal.
  const skeletalFanatic = align === 'Undead' && c.isKing && armies.some((a) => a._isSkeletal);
  // Undead skeletal legions never waver under ANY of the realm's commanders — the king's presence
  // merely sharpens it (×1.3 king-led, ×1.2 hero-led). Honours the long-advertised "fight with
  // 100% fanaticism in every battle" rather than the old king-only rule.
  const skelHeroFanatic = align === 'Undead' && !c.isKing && armies.some((a) => a._isSkeletal);
  // Evil: Monster armies get +25% fanaticism on top of base. (The Druidic mirror, Wild Ferocity — ×1.25
  // for a host with any Creature — was retired on 2026-10-13 (Toby, Creatures and Monsters I): the Druidic
  // crown keeps its waiver, Home of the Wild and mastery.)
  const evilMonsterFanatic = align === 'Evil' && armies.some((a) => MONSTER_ARMIES.has(a.type));
  const fanMult = Math.max(
    1,
    fanatic ? 1.3 : 1,
    skeletalFanatic ? UNDEAD_SKEL_KING_FAN : 1,
    evilMonsterFanatic ? 1.25 : 1,
    skelHeroFanatic ? UNDEAD_SKEL_HERO_FAN : 1,
  ); // strongest counts (2026-09-23b)
  if (evilMonsterFanatic && !fanatic)
    narrate(narrative, { kind: "the attacker's monsters are driven to savage fury", cName: atkSide });
  if (fanatic && !skeletalFanatic && !skelHeroFanatic)
    narrate(narrative, { kind: "the attacker's troops fight with fanatical zeal", cName: atkSide });
  if (skeletalFanatic)
    narrate(narrative, {
      kind: "a side's skeletal legions fight with fanaticism under their undead king",
      sideName: atkSide,
      undeadKingFanaticismPct: Math.round((UNDEAD_SKEL_KING_FAN - 1) * 100),
    });
  if (skelHeroFanatic)
    narrate(narrative, {
      kind: "a side's skeletal legions know no fear",
      sideName: atkSide,
      undeadHeroFanaticismPct: Math.round((UNDEAD_SKEL_HERO_FAN - 1) * 100),
    });
  const discArmyBonus = 1 + whatARealmsDiscoveriesAddToTheWholeArmy();
  if (discArmyBonus > 1)
    narrate(narrative, {
      kind: "the attacker's realm discoveries strengthen his army",
      discoveriesArmyBonus: discArmyBonus,
    });

  // Apply discovery bonuses to final attack str
  const finalAtkMod = discArmyBonus;
  // DIVINE — Consecrate: an Undead/Evil realm assaulting consecrated ground fights at −15%.
  const _consecNPC =
    prov.owner != null &&
    prov.owner !== c.player &&
    isConsecrated(G.players[prov.owner], prov.id) &&
    (align === 'Undead' || align === 'Evil');
  if (_consecNPC)
    narrate(narrative, {
      kind: "the consecrated ground of the province weakens the attacker's host",
      provName: prov.name,
      atkName: atkSide,
      attackersAlignment: align,
    });
  // Post-multiplier base strengths — every battle-level multiplier (fanaticism, discoveries,
  // morale, home/defensive bonus, illusory, consecrate) folded in, BEFORE the dice.
  void atkStr;
  void defStr;
  void rawAtkStr;
  void rawDefStr;
  // 2026-09-24 (Toby): whole-force multipliers per unit BEFORE pre-battle damage (finishSide). These
  // lists are the single source of each side's force product — the ladder prints them as they are.
  const _nAtkFM = [
    { reason: 'morale', m: _npcAtkMorale },
    { reason: 'orders', m: atkOrdN },
    { reason: 'home-ground', m: atkHomeBonus },
    { reason: 'fanaticism', m: fanMult },
    { reason: 'discoveries', m: finalAtkMod },
    { reason: 'consecrated-ground', m: _consecNPC ? 0.85 : 1 },
  ];
  const _nDefFM = [
    { reason: 'defenders-position', m: defBonus },
    { reason: 'home', m: homeBonus },
    { reason: 'morale', m: _npcDefMorale },
    { reason: 'orders', m: defOrdN },
  ];
  const _gA = {},
    _gD = {};
  finishSide(armiesWithStr, lineWidth, atkFlankDisc, _nAtkFM, {
    terrain: prov.terrain,
    tac: tactSkill,
    enemy: defsWithStr,
    enemyTac: defTactLvl,
    out: _gA,
  });
  finishSide(defsWithStr, defLineWidth, defFlankDisc, _nDefFM, {
    terrain: prov.terrain,
    tac: defTactLvl,
    enemy: armiesWithStr,
    enemyTac: tactSkill,
    out: _gD,
  });
  // 2026-10-11 Battle lines III: the better-explored side picks the width and lines up second; the
  // commanders then shift their lines, one swap per Tactical level. The ground's own defenders (a
  // neutral guard, a standing garrison) know it fully. finishSide's grids are replaced by the deploy's.
  const _explA = (prov.exploredBy || {})[c.player] || 0,
    _explD = 100;
  const _dep = battleDeploy(armiesWithStr, defsWithStr, {
    terrain: prov.terrain,
    roll: terrainFront,
    tacA: tactSkill,
    tacD: defTactLvl,
    flankA: atkFlankDisc,
    flankD: defFlankDisc,
    scout: battleScout(_explA, _explD),
  });
  _gA.grid = _dep.gA;
  _gD.grid = _dep.gD;
  lineWidth = defLineWidth = _dep.W;
  // Who each company fought, for the fate lines (2026-10-12, Toby): read now, while the rows carry the deploy's facing.
  // Each enemy side as the clauses name it (plan P1-12d28: a record; the prose writes the label): the defenders (their
  // guard, " (wandering)" cut, else the realm's garrison of the province or its defenders), and the attacker by his
  // plain name, " (wandering)" cut, never "X's leaderless host".
  const _facedDefNm = defHero
    ? { kind: 'the defenders led by their guard', guardName: defHero.name.replace(' (wandering)', '') }
    : prov.owner != null && !neutralGuardHero
      ? { kind: "a realm's garrison of a province with no guard to lead it", provName: prov.name }
      : { kind: 'the defenders of a province with no guard to lead them', provName: prov.name, capitalised: false };
  const _facedA = battleFacedClauses(_dep.gA, _facedDefNm),
    _facedD = battleFacedClauses(_dep.gD, {
      heroName: String(c.name || cName || '').replace(' (wandering)', ''),
      leaderless: false,
    });
  const atkBaseStr = _gA.grid.face.total,
    defBaseStr = _gD.grid.face.total;
  // The defenders as the report lines name them (plan P1-12d30: a record; the prose writes the label): their guard, or
  // the defenders of the province with no guard to lead them; the grid names a side with no guard "Guards".
  const _defSideStat = defHero
    ? { kind: 'the defenders led by their guard', guardName: defHero.name }
    : { kind: 'the defenders of a province with no guard to lead them', provName: prov.name, capitalised: false };
  narrate(narrative, battleWidthLine(prov.terrain, lineWidth));
  narrate(narrative, battleScoutLine(_dep, atkSide, _defSideStat, _explA, _explD));
  {
    const _mv = battleMovesLine(_dep, atkSide, _defSideStat);
    if (_mv) narrate(narrative, _mv);
  }
  narrateAll(narrative, [
    ...battleGridLines(
      defHero
        ? { kind: 'the defenders led by their guard', guardName: defHero.name }
        : { kind: "a province's guards with no guard to name them" },
      _gD.grid,
      true,
    ),
    ...battleGridLines(atkSide, _gA.grid, false),
  ]);
  // Roll with variance — each side rolls 0 to 70% of the stronger side's POST-multiplier
  // strength. Dice basis unified with the PvP path: both scale the random swing off the FULL
  // effective strength each force brings to the field (all multipliers applied), so luck is
  // proportional to what the armies are actually worth in this battle. Item 9: fortune of battle
  // — one swing, applied as a pair of luck multipliers (see battleFortune).
  const _fort = battleFortune();
  const atkRoll = _fort.atk,
    defRoll = _fort.def;
  const finalAtk = atkBaseStr * atkRoll;
  const finalDef = defBaseStr * defRoll;

  // (Battle-line width is applied above in the strength calculations, using the
  // terrain-based front width. No separate cosmetic line needed here.)

  // ── STAT BLOCK (visible to GM; included in player chronicle) ── the summary now reports the
  // EFFECTIVE strength (every multiplier already folded in — tactical is baked into the raw sum,
  // not applied again) plus the dice, so the numbers reconcile: effective + roll = final. The
  // "(incl. …)" note lists the multipliers already applied, for context — it is not a formula to
  // re-multiply. (Per-factor lines above give the full breakdown.)
  // 2026-09-23b: strength LADDER per side (see ladderLines) replaces the one-line "(incl. …)"
  // summary. The Whole-force lists MUST mirror atkBaseStr / defBaseStr above.
  const _nAtkTm = tacMulted(effectiveTactBonus, c),
    _nDefTm = tacMulted(defTactBonus, defHero);
  narrate(narrative, { kind: "the battle's statistics begin" });
  narrateAll(
    narrative,
    ladderLines('attacker', atkSide, armiesWithStr, lineWidth, atkFlankDisc, _nAtkFM, atkBaseStr, {
      grid: _gA.grid,
      tact: isLandBattle && _nAtkTm > 1 ? { mult: _nAtkTm, reason: { kind: 'tactical', multiplier: _nAtkTm } } : null,
    }),
  );
  narrateAll(
    narrative,
    ladderLines('defender', _defSideStat, defsWithStr, defLineWidth, defFlankDisc, _nDefFM, defBaseStr, {
      grid: _gD.grid,
      tact:
        prov.terrain !== 'sea' && _nDefTm > 1
          ? { mult: _nDefTm, reason: { kind: 'tactical', multiplier: _nDefTm } }
          : null,
    }),
  );
  narrate(narrative, {
    kind: 'the fortune of the battle',
    atkLabel: atkSide,
    defLabel: _defSideStat,
    atkBase: atkBaseStr,
    defBase: defBaseStr,
    fortune: theFortuneAsTheLineTellsIt(_fort),
  });

  // Combat result narrative
  const margin = finalAtk - finalDef;
  const won = margin >= 0;
  // ORC — Raiders' Muster (2026-10-11, Toby): an orc realm's win in an orcish province (the end-of-turn pass reads the flag).
  if (won && prov.race === 'Orcish' && G.players[c.player] && G.players[c.player].race === 'Orcish')
    prov._raidersMuster = G.turn;
  // Tactical gain for winning a land battle is rolled AT THE END of the battle (just before the
  // return) so the 📈 line closes the battle report instead of preceding it in the chronicle.
  const _rollTacticalGain = won && prov.terrain !== 'sea';
  const _rollNavalGain = won && prov.terrain === 'sea'; // winning a SEA battle trains Naval (the sea-combat skill), mirroring Tactical on land
  // DRUID (2026-09-21, Toby): any battle with primal (Creature/Monster) units on EITHER side trains
  // Druid — full chance for the winner, half for the loser. Read before casualties are removed.
  const _primalInBattle = [
    ...(c.armies || []),
    ...(prov.neutralDefenders || []),
    ...((neutralGuardHero && neutralGuardHero.armies) || []),
  ].some((a) => a && PRIMAL_ARMY_DEFS_P[a.type]);
  const _rollDruidGain = _primalInBattle;

  // Closeness of battle affects retreat/stay and casualties
  const closenessRatio = Math.min(finalAtk, finalDef) / Math.max(finalAtk, finalDef);
  const isClose = closenessRatio > 0.8; // very close = might stay/not retreat

  // ── MARGIN-BASED CASUALTY SYSTEM ── margRatio = how decisive the victory was (0=coin flip,
  // 1=total annihilation)
  const totalStr = Math.max(1, finalAtk + finalDef);
  const margRatio = Math.abs(margin) / totalStr;
  const _band = battleMarginBand(margRatio);
  const isNarrow = _band.max <= 0.1; // pyrrhic or narrow (kept for existing consumers)
  const isDecisive = _band.max > 0.3; // decisive, crushing or annihilating
  // Severity label for narrative
  const severity = _band.slug;

  // XP tier multipliers — higher tiers harder to improve
  const xpMult = QUALITY_TIERS.map((_, i) => [1.5, 1.0, 0.6, 0.3, 0][i]);
  function xpChance(baseChance, quality) {
    const i = QUALITY_TIERS.indexOf(quality);
    return baseChance * (xpMult[i] ?? 0);
  }

  // Death chances scale with margin — and with how long the fight has ground on. A battle that
  // carries on from phase to phase (or a chain of assaults on the same province) grows bloodier
  // each round for BOTH sides: _carryMult climbs +35% per carry-on round, capped at 2.5×.
  const _carryMult = Math.min(CARRYON_DEATH_CAP, 1 + CARRYON_DEATH_STEP * (prov._carryOnRounds || 0));
  const winDeathChance = _band.winDeath * _carryMult;
  const loseDeathChance = _band.loseDeath * _carryMult;
  // XP gain chances
  const winXPChance = _band.winXP;
  const loseXPChance = _band.loseXP;
  // XP loss chances (loser only)
  const loseDemoteChance = _band.loseDemote;

  // Steel Armour discovery: -15% death chance
  const steelMultOf = (a) => discDeathMult(turnContext, c.player, a, 'atk'); // per-unit deathRed discoveries (sd05 Steel Armour now one of them)
  const tacMultNPC = perkTier(c, 'tactical') >= 3 ? 0.5 : 1; // TACTICAL L8: on a LOSS, c's units half as likely to die/disband
  // Military Discipline discovery: +20% XP gain chance
  const milMultOf = (a) => 1 + discPromo(turnContext, c.player, a); // per-unit promo discoveries (sd06 Military Discipline now one of them)

  const tiers = QUALITY_TIERS.slice();

  // ════
  // UNIT ABILITIES vs NEUTRAL GUARDS
  // ════
  // Neutral defenders never retreat and are wiped out entirely when they lose, so the abilities
  // built around routing and pursuit have nothing to bite on. Each gets a simple equivalent that
  // keeps the same flavour: Free Lances still add to enemy losses, corsairs still control the
  // line of withdrawal, wargs still finish a fight quickly, wyverns still unnerve the defence.
  const _npcTerrain = prov.terrain;
  // The rule registry's three stages of the rout (plan P1-19j), as in a battle between heroes, against neutral guards:
  // "fate: the winner runs the beaten down", "a force holds the sea lanes" and "the beaten force holds"
  // (shieldFortHolds).
  // HUMAN — Ride Them Down. Neutral defenders now take the same casualty rolls as a beaten
  // player, so this works exactly as it does in a player battle: the winner's Free Lances add to
  // the LOSER's destruction chance. Symmetric — neutral defenders can field Free Lances too, and
  // when they win, theirs bite on your force. Open country only. (Against neutral guards it is the
  // one pursuit that adds to the beaten's losses.)
  const _npcPursuitsAtk = pursuitsOfTheBeaten(armies, _npcTerrain, c, 'a hero against neutral guards');
  const _npcRideAtk = theFractionThePursuitsAdd(_npcPursuitsAtk);
  const _npcRideDef = theFractionThePursuitsAdd(
    pursuitsOfTheBeaten(defenders, _npcTerrain, defHero, 'neutral guards against a hero'),
  );
  for (const p of _npcPursuitsAtk)
    if (p.onTheGround === 'by the war-horn of the plains')
      narrate(narrative, {
        kind: "a side's war-horn of the plains lets its free lances ride in rough country",
        sideName: atkSide,
        terrain: _npcTerrain,
      });
  for (const p of _npcPursuitsAtk)
    if (p.onTheGround === 'it finds no room')
      narrate(narrative, {
        kind: "the attacker's free lances find no room to ride",
        cName: atkSide,
        terrain: _npcTerrain,
      });
  // HUMAN — Cut the Line becomes Keep the Sea Lanes. Neutral guards still never withdraw, so
  // there is no enemy line of retreat to sever; a corsair-heavy force instead guarantees its OWN
  // escape back to the ships.
  const _npcCorsairs = aForceHoldsTheSeaLanes({ theForce: armies ?? [], theBattle: 'a hero against neutral guards' });
  // ORC — Run Them Down: still nothing to pursue (neutral guards do not flee the province), so
  // the wargs simply end it fast — half casualties for your own force on a win.
  const _npcOwnLosses = theFactorThePursuitsPutOnTheWinnersOwnDeathRolls(_npcPursuitsAtk);
  // DWARF — Shield Fort (replaces Hold the Line): a beaten Guard-heavy assault withdraws in good
  // order when a path exists, and holds trapped WITHOUT extra no-escape losses otherwise.
  const _npcSF = shieldFortHolds(armies, _dep && _dep.gA); // 2026-10-11: half the FRONT LINE is Guard
  // 2026-09-27 (Toby): the same for a Guard-heavy NEUTRAL GARRISON. A neutral force never retreats,
  // so the "good order withdrawal" half cannot apply to it — what it gets is the other half: the
  // attacker's Free Lances find no broken backs, and the pinned-against-their-own-ground roll does
  // not touch them. Race-converted neutral provinces really can field Dwarven Guard, so this is a
  // live case, not a theoretical one.
  const _npcSFDef = shieldFortHolds(defenders, _dep && _dep.gD);

  if (won) {
    const guardName = defHero
      ? { kind: 'the defenders led by their guard', guardName: defHero.name }
      : { kind: 'the defenders of a province with no guard to lead them', provName: prov.name, capitalised: false };
    // 2026-09-23b ROOT CAUSE of the empty defender section: pre-battle effects can remove the LAST
    // defender before the clash (Breach and Swamp sinks a lone defending hull; Control Undead turns
    // the last undead defender). The fight then ran against 0 strength, reported an "annihilating
    // engagement" and printed a defender casualty header with nothing under it.
    const _noDefLeft = defenders.length === 0;
    if (_noDefLeft)
      narrate(narrative, {
        kind: 'a battle is decided',
        battle: "against a province's defenders",
        winnersRole: 'the attacker',
        whatBecomesOfTheProvince: 'swept into, with no one left to stand',
        attackersSide: atkSide,
        theDefenders: guardName,
        provName: prov.name,
      });
    else
      narrate(narrative, {
        kind: 'a battle is decided',
        battle: "against a province's defenders",
        winnersRole: 'the attacker',
        whatBecomesOfTheProvince: 'the defenders are beaten',
        severity,
        margRatio,
        winVerbIndex: Math.floor(kcRng() * THE_NUMBER_OF_VERBS_A_VICTORY_IS_TOLD_WITH),
        attackersSide: atkSide,
        theDefenders: guardName,
        provName: prov.name,
      });
    narrate(narrative, { kind: "the attacker's casualties begin", atkName: atkSide });
    for (const p of _npcPursuitsAtk)
      if (p.line === "the warg riders halve the winner's losses")
        narrate(narrative, { kind: "the attacker's warg riders halve his losses", cName: atkSide });
    // (Run Them Down halves the death roll only; the promotion window keeps the unhalved figure, as it always has.)
    const _fw = rollUnitFates(armies, {
      owner: atkSide,
      won: true,
      dieAt: (a) => winDeathChance * steelMultOf(a) * _npcOwnLosses,
      promoteTo: (a) =>
        winDeathChance * steelMultOf(a) + xpChance(winXPChance * milMultOf(a), a.quality) * humanXPMult(a, c.player, G),
      faced: _facedA,
      say: (l) => narrate(narrative, l),
    });
    const winSurv = _fw.survived,
      winEvents = _fw.died + _fw.promoted;
    if (winSurv > 0)
      narrate(narrative, {
        kind: "a side's other forces survive the engagement",
        someUnitsFateIsToldAbove: winEvents > 0,
      });
    c.armies = c.armies.filter((a) => !a._died && !a._disbanded);
    // Evil: Terror effect on decisive win — battle province AND all adjacent provinces
    // demoralised (stacking)
    if (
      isDecisive &&
      G.players[c.player]?.alignment === 'Evil' &&
      (c.encounterPlan?.evilMode || 'terror') === 'terror'
    ) {
      spreadTerror(turnContext, prov, c.player, narrative);
    }
    recordBattleGraves(
      turnContext,
      prov,
      armies.filter((a) => a._died),
      c.player,
    ); // attacker's Elven units may escape home

    // They now roll unit-by-unit at the same rate a beaten player would, plus the extra no-escape
    // roll a trapped player takes — because neutrals genuinely cannot retreat. Survivors stay in
    // the province and contest it again next phase.
    // The units' owner as their lines' facts hold him (plan P1-12d25): his guard, " (wandering)" cut, or "The defenders
    // of <province>"; the prose writes the label (theLabelOfAUnit).
    const _defOwner = defHero
      ? { kind: 'the defenders led by their guard', guardName: defHero.name.replace(' (wandering)', '') }
      : { kind: 'the defenders of a province with no guard to lead them', provName: prov.name, capitalised: true };
    narrate(narrative, {
      kind: "the defender's casualties begin",
      defName: defHero
        ? { kind: 'the defenders led by their guard', guardName: defHero.name.replace(' (wandering)', '') }
        : { kind: 'the defenders of a province with no guard to lead them', provName: prov.name, capitalised: true },
    });
    if (_noDefLeft) narrate(narrative, { kind: 'every defending unit was lost before the lines closed' });
    // DWARF — Shield Fort on the DEFENDING side (2026-09-27, Toby): a Guard-heavy garrison gives no
    // broken backs to ride down.
    const _npcRideAtkEff = _npcSFDef ? 0 : _npcRideAtk;
    if (_npcRideAtk > 0 && _npcSFDef)
      narrate(narrative, {
        kind: "the defenders' dwarven guard leave the attacker's free lances no broken backs",
        cName: atkSide,
      });
    else if (_npcRideAtk > 0)
      narrate(narrative, {
        kind: "the attacker's free lances ride down the defenders' broken companies",
        cName: atkSide,
        extraLossesPct: dispFloor(_npcRideAtk * 100),
      });
    defenders.forEach((a) => {
      if (kcRng() < loseDeathChance * steelMultOf(a) + _npcRideAtkEff) {
        a._died = true;
        const _fc = _facedD.get(a); // whom they fought (2026-10-12)
        narrate(narrative, {
          kind: "a unit's fate in the battle",
          itsSideWon: false,
          fate: 'dies',
          theUnit: {
            kind: 'a unit named with its quality',
            owner: _defOwner,
            unitName: a.unitName,
            type: a.type,
            quality: a.quality,
          },
          whomItFaced: _fc ?? null,
          inTheRout: false,
          itsBonesCrumble: false,
        });
      }
    });
    const _trapped = defenders.filter((a) => !a._died);
    if (_trapped.length > 0) {
      // Shield Fort: locked shields take NO pinned-against-the-ground losses, exactly as a trapped
      // Guard-heavy player force does. Announced instead of the "further losses" line, which would
      // otherwise promise casualties that never come.
      if (_npcSFDef) {
        narrate(narrative, {
          kind: 'the defenders have nowhere to retreat and hold a shield fort',
          provName: prov.name,
        });
      } else {
        narrate(narrative, {
          kind: 'the defenders have nowhere to retreat and take further losses',
          provName: prov.name,
        });
        _trapped.forEach((a) => {
          // (Skyward Retreat retired with the unit abilities, 2026-10-11: the Eagles roll like anyone.)
          if (kcRng() < 0.15) {
            a._died = true;
            narrate(narrative, {
              kind: "a unit's fate in the battle",
              itsSideWon: false,
              fate: 'is cut down with no escape',
              inTheRout: false,
              theUnit: {
                kind: 'a unit named by its name or type alone',
                owner: null,
                unitName: a.unitName,
                type: a.type,
                quality: a.quality,
              },
            });
          }
        });
      }
    }
    const _defFallen = defenders.filter((a) => a._died);
    if (_defFallen.length > 0) recordBattleGraves(turnContext, prov, _defFallen);
    bloodHarvest(turnContext, c, _defFallen.length, narrative);
    ironThroneRaise(turnContext, c, _defFallen, narrative); // GRAND DESIGN — Evil
    const _defLeft = defenders.filter((a) => !a._died && !a._disbanded);
    // (No "all other defenders hold their ground" line here: the CALLER runs erodeGuardSurvivors
    // immediately after this returns, and that decides each survivor's fate individually — rally,
    // demote, disband or flee as mercenaries. Announcing that they held the ground first flatly
    // contradicted the very next lines of the same report.)
    prov.neutralDefenders = _defLeft;
    prov.npcArmies = _defLeft.length;
    if (defHero) defHero.armies = _defLeft;
    if (_defLeft.length > 0) prov._battleUnresolved = true; // unbeaten survivors contest it again
  } else {
    // The defenders as the facts hold them (plan P1-12d23): their guard, by his name as each line hands it, else the
    // realm's garrison or the province's defenders; the prose writes the label (theLabelOfTheDefenders). Since P1-12d25
    // the units' lines hold the record too (theLabelOfAUnit).
    const _defSide2 = (guardName) =>
      defHero
        ? { kind: 'the defenders led by their guard', guardName }
        : prov.owner != null && !neutralGuardHero
          ? { kind: "a realm's garrison of a province with no guard to lead it", provName: prov.name }
          : { kind: 'the defenders of a province with no guard to lead them', provName: prov.name, capitalised: false };
    // combatVsNPC also fights a PLAYER's unled garrison — that garrison holds its walls; it is
    // not a neutral band, so the 'neutral defenders never retreat' tag is wrong there.
    narrate(narrative, {
      kind: 'a battle is decided',
      battle: "against a province's defenders",
      winnersRole: 'the defender',
      whatBecomesOfTheProvince: 'held by its defenders',
      severity,
      margRatio,
      attackersSide: atkSide,
      theDefenders: _defSide2(defHero?.name),
      aPlayersGarrison: prov.owner != null && !neutralGuardHero,
      atSea: prov.terrain === 'sea', // no walls at sea (2026-09-23b)
      provName: prov.name,
    });
    narrate(narrative, {
      kind: "the defender's casualties begin",
      defName: _defSide2(defHero?.name.replace(' (wandering)', '')),
    });
    // Log fate of each defender (some may have died in the fighting even in a win)
    defenders.forEach((a) => {
      if (kcRng() < winDeathChance * 0.5) {
        // defenders take lighter casualties when they win
        a._defDied = true;
        const _fc = _facedD.get(a); // whom they fought (2026-10-12)
        narrate(narrative, {
          kind: "a unit's fate in the battle",
          itsSideWon: true,
          fate: 'dies',
          theUnit: {
            kind: 'a unit named with its quality',
            owner: _defSide2(defHero?.name.replace(' (wandering)', '')),
            unitName: a.unitName,
            type: a.type,
            quality: a.quality,
          },
          whomItFaced: _fc ?? null,
          inTheRout: false,
          itsBonesCrumble: false,
        }); // item 8
      }
    });
    if (defenders.some((a) => !a._defDied))
      narrate(narrative, {
        kind: "a side's other forces survive the engagement",
        someUnitsFateIsToldAbove: defenders.some((a) => a._defDied),
      });
    const defSurv = defenders.filter((a) => !a._defDied);
    const defLost = defenders.filter((a) => a._defDied);
    _npcDefWinLost = defLost.filter((a) => a && !a._phantom).length;
    if (defLost.length > 0) recordBattleGraves(turnContext, prov, defLost);
    // Update guard armies if applicable
    if (defHero) defHero.armies = defSurv;
    // 2026-09-09. A guard can WIN this engagement and still lose every unit to the casualty rolls
    // above. A guard with no host is a guard no more: demote him to a plain wanderer on the spot.
    if (defHero && defHero._isNeutralGuard && defHero.alive !== false && defSurv.length === 0) {
      demoteGuardToWanderer(defHero);
      narrate(narrative, {
        kind: "the guard's host is destroyed and he is a masterless hero",
        guardName: defHero.name.replace(' (wandering)', ''),
        provName: prov.name,
      });
    }
    // Sync the province's defender array too. Callers re-read prov.neutralDefenders to restore
    // the guard's army after the battle — without this line a defender who died holding the
    // ground was silently restored to life by that resync (graves recorded, unit still marching).
    prov.neutralDefenders = defSurv;
    prov.npcArmies = defSurv.length;
    // Clean up flag
    defenders.forEach((a) => delete a._defDied);

    narrate(narrative, { kind: "the attacker's casualties begin", atkName: atkSide });
    // DWARF — Shield Fort, the GOOD-ORDER half (2026-09-27, Toby): this block never consulted
    // _npcSF, so a beaten Guard-heavy force attacking a neutral garrison still took the defenders'
    // Ride Them Down losses and still demoted — under a narrative line a few dozen lines below
    // saying it had withdrawn in good order. Now mirrors the PvP branch exactly: no Ride Them Down
    // against it, and a demotion roll becomes an orderly fall-back instead of a loss of quality.
    const _npcRideDefEff = _npcSF ? 0 : _npcRideDef;
    if (_npcRideDef > 0 && _npcSF)
      narrate(narrative, {
        kind: "the attacker's dwarven guard leave the defenders' free lances no broken backs",
        cName: atkSide,
      });
    else if (_npcRideDef > 0)
      narrate(narrative, {
        kind: "the defenders' free lances ride down the attacker's broken companies",
        cName: atkSide,
        extraLossesPct: dispFloor(_npcRideDef * 100),
      });
    rollUnitFates(armies, {
      owner: atkSide,
      won: false,
      inTheRout: true,
      dieAt: (a) => loseDeathChance * steelMultOf(a) * tacMultNPC + _npcRideDefEff,
      demoteAt: (a) => loseDemoteChance * tacMultNPC,
      promoteTo: (a) => loseDemoteChance + xpChance(loseXPChance, a.quality) * humanXPMult(a, c.player, G),
      shieldFort: _npcSF,
      notable: true,
      faced: _facedA,
      say: (l) => narrate(narrative, l),
    });

    // Retreat logic
    const adjProvs = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces);
    // a retreat is a real move — the force can only fall back onto ground it could legally enter.
    // A land force (no fleet capacity) must NOT retreat into an owned/allied sea province.
    // 2026-09-23c: judged on the SURVIVORS (this read the pre-casualty list) via retreatOptions.
    const _retLive = (c.armies || []).filter((a) => a && !a._died && !a._disbanded);
    const friendlyAdj = retreatOptions(turnContext, c, prov, _retLive); // own/allied ground it could legally enter, or the unowned sea it sailed from
    prov._hadBattleThisTurn = true;
    // the items' registry's "fate: the beaten force may retreat" (plan P1-19n: the Shield-Wall Rune refuses it)
    const infStay = !theBeatenForceMayRetreatByTheCommandersItems(activeItems(c));
    const _npcSeaTrap = friendlyAdj.length === 0 && !infStay ? seaTrapLine(atkSide, c, prov, _retLive) : null;
    // HUMAN — Keep the Sea Lanes: a corsair-heavy force always has boats waiting, so long as
    // there is water to reach. They withdraw to the ships rather than being cut down.
    const _seaEscape = _npcCorsairs && adjProvs.some((p2) => p2 && p2.terrain === 'sea');
    // DWARF — Shield Fort: trapped, the Guard hold contested with NO extra flight casualties;
    // with a path open they withdraw in good order (no pin — the old Hold the Line is retired).
    const _sfNPC = _npcSF && armies.some((a) => !a._died);
    const _liveNPC = armies.filter((a) => !a._died && !a._disbanded);
    const _dmNPC =
      _liveNPC.length > 0 && _liveNPC.every((a) => a._isSkeletal) && G.players[c.player]?.alignment === 'Undead';
    // 2026-09-27 (Toby item 3): a beaten force with SHIPS on a coastal shore splits — the fleet
    // makes for friendly water with the hero and all it can lift, the rest falls back overland or
    // holds the ground. Tried before the trapped branch, because a mixed column that cannot carry
    // itself reads as "nowhere to retreat" to retreatOptions while its hulls could still sail.
    // The Shield-Wall Rune (infStay) refuses every retreat, so it is honoured first.
    const _navalSplitNPC = infStay ? '' : navalSplitRetreat(turnContext, c, prov, _retLive, narrative, atkSide);
    if (_navalSplitNPC) {
      /* handled above — no further retreat or rout */
    } else if (friendlyAdj.length === 0 || infStay) {
      if (_npcSeaTrap) narrate(narrative, _npcSeaTrap);
      if (_dmNPC && !infStay) {
        narrate(narrative, {
          kind: "the loser's skeletal host stands its ground in a deathless march",
          loserName: atkSide,
          provName: prov.name,
        });
        prov._battleUnresolved = true;
      } else if (_sfNPC && !infStay) {
        narrate(narrative, {
          kind: "the loser's dwarven guard hold a shield fort with no road out",
          loserName: atkSide,
          provName: prov.name,
        });
        prov._battleUnresolved = true;
      } else if (_seaEscape && !infStay) {
        narrate(narrative, { kind: "the attacker's corsairs take his beaten force back to the ships", cName: atkSide });
      } else {
        // Routed in place — no retreat available (or Shield-Wall Rune: the line will not break)
        narrate(
          narrative,
          infStay
            ? { kind: "the attacker's shield-wall holds and the infantry stand their ground", cName: atkSide }
            : { kind: 'the attacker has nowhere to retreat and takes further losses', cName: atkSide },
        );
        armies
          .filter((a) => !a._died)
          .forEach((a) => {
            // (The Eagle Riders' Skyward Retreat was retired with the unit abilities, 2026-10-11: theirs are
            // Stoop on the Horses and Eyes of the Forest.)
            if (kcRng() < 0.15) {
              narrate(narrative, {
                kind: "a unit's fate in the battle",
                itsSideWon: false,
                fate: 'is cut down with no escape',
                inTheRout: true,
                theUnit: {
                  kind: 'a unit named by its name or type alone',
                  owner: null,
                  unitName: a.unitName,
                  type: a.type,
                  quality: a.quality,
                },
                itsBonesCrumble: a._isSkeletal,
              });
              a._died = true;
            }
          });
      }
    } else {
      // Retreat to the province they attacked from if possible, else closest friendly
      if (_sfNPC)
        narrate(narrative, { kind: "the loser's dwarven guard withdraw behind a shield fort", loserName: atkSide });
      const fromProv = G.world.provinces[c._attackedFrom];
      // never retreat INTO the contested province (stale _attackedFrom guard).
      const retreatTo =
        fromProv && fromProv.id !== prov.id && friendlyAdj.some((p2) => p2.id === fromProv.id)
          ? fromProv
          : bestRetreat(
              turnContext,
              c,
              friendlyAdj.filter((p2) => p2.id !== prov.id),
            ) || friendlyAdj[0]; // must be ADJACENT (and friendly, enterable) — never a stale far-off origin; with a choice, the most valuable ground wins
      narrate(narrative, {
        kind: "the attacker's forces retreat to a province",
        cName: atkSide,
        retreatToName: retreatTo.name,
      });
      prov.characters = (prov.characters || []).filter((id) => id !== c.id);
      retreatTo.characters = retreatTo.characters || [];
      if (!retreatTo.characters.includes(c.id)) retreatTo.characters.push(c.id);
      c.location = retreatTo.id;
      // a forced retreat does NOT consume the character's move points.
    }

    if (armies.some((a) => !a._died && !a._notable))
      narrate(narrative, {
        kind: "a side's other forces survive the engagement",
        someUnitsFateIsToldAbove: armies.some((a) => a._died || a._notable),
      });
    recordBattleGraves(
      turnContext,
      prov,
      armies.filter((a) => a._died),
      c.player,
    ); // attacker's Elven units may escape home
    c.armies = c.armies.filter((a) => !a._died && !a._disbanded);
  }

  // Battle-magic strength reductions last only for this battle — units recover afterward.
  [
    ...(c.armies || []),
    ...(prov.neutralDefenders || []),
    ...((neutralGuardHero && neutralGuardHero.armies) || []),
  ].forEach((a) => {
    delete a._tempStrReduction;
    delete a._terrorMult;
    delete a._archeryRed;
    delete a._tacUp;
    delete a._drumUp;
    delete a._laNoTerrain;
    delete a._flakTargeted;
  });
  clearPhantomCopies(c, !won, realCharOf(turnContext, c)); // remove phantom fighting-copies; if c lost, all its phantasmal armies are dismissed
  if (!won && c) noteBattleLoss(turnContext, c.id, narrative); // AK [3.15] — a beaten general stops Defending
  if (_rollTacticalGain) trySkillGain(turnContext, c, 'tactical', SKILLGAIN_STD, narrative); // Tactical: won a land battle
  // 2026-10-14 (batch item 11, Toby): a general who LOSES a battle but lives to tell of it learns
  // too — Tactical (Naval at sea) at the small frequent-action rate. A general slain in it learns nothing.
  if (!won) trySkillGain(turnContext, c, prov.terrain === 'sea' ? 'naval' : 'tactical', SKILLGAIN_COMMON, narrative);
  if (_rollNavalGain) trySkillGain(turnContext, c, 'naval', SKILLGAIN_STD, narrative); // Naval: won a sea battle
  if (_rollDruidGain) trySkillGain(turnContext, c, 'druid', SKILLGAIN_STD, narrative, won ? 1 : 0.5); // Druid: fought beside or against primal armies (loser at half chance)
  // 2026-09-26 (Toby): the NEUTRAL commander takes the mirror of those rolls — a chieftain who
  // holds his province learns Tactical (or Naval at sea) exactly as a player's general would, and
  // Druid on the same winner-full / loser-half terms. `won` is the ATTACKER's result, so the
  // defender's win is `!won`. trySkillGain screens neutrals to battle context on its own.
  if (neutralGuardHero && neutralGuardHero.alive !== false) {
    if (!won && prov.terrain !== 'sea')
      trySkillGain(turnContext, neutralGuardHero, 'tactical', SKILLGAIN_STD, narrative);
    if (!won && prov.terrain === 'sea') trySkillGain(turnContext, neutralGuardHero, 'naval', SKILLGAIN_STD, narrative);
    if (won)
      trySkillGain(
        turnContext,
        neutralGuardHero,
        prov.terrain === 'sea' ? 'naval' : 'tactical',
        SKILLGAIN_COMMON,
        narrative,
      ); // a beaten chieftain who lives (batch item 11)
    if (_rollDruidGain) trySkillGain(turnContext, neutralGuardHero, 'druid', SKILLGAIN_STD, narrative, !won ? 1 : 0.5);
  }
  // a one-line result that onlookers (a char present but not fighting) may see instead of the
  // full blow-by-blow. The caller can override with a fuller "seized/held" line where it knows
  // more.
  const _sumDef = defHero
    ? { kind: 'the defenders led by their guard', guardName: defHero.name.replace(' (wandering)', '') }
    : { kind: 'the defenders of a province with no guard to lead them', provName: prov.name, capitalised: false };
  const summaryText = {
    kind: "the onlookers' summary of a battle",
    provName: prov.name,
    won,
    attackersName: atkSide,
    defendersName: _sumDef,
    betweenTwoHeroesHosts: false,
  }; // same shape as PvP
  // report casualties so a fight against an enemy realm's GARRISON can pay Grand Marshal / Sea
  // Lord merit too. `armies` / `defenders` still hold the fallen (the branches above rebuild
  // c.armies with a filter rather than mutating these).
  const _telAtkLost = (armies || []).filter((a) => a && a._died && !a._phantom).length,
    _telDefLost = (defenders || []).filter((a) => a && a._died && !a._phantom).length + _npcSunkLost + _npcDefWinLost;
  try {
    _tel.battles.push({
      ph: turnContext._logCtx.phase ?? turnContext._currentPhase,
      prov: prov.id,
      terrain: prov.terrain,
      kind: defHero
        ? defHero.player != null
          ? 'pvp'
          : 'guard'
        : prov.owner != null && prov.owner !== c.player
          ? 'garrison'
          : 'neutral',
      atkPi: c.player,
      atkChar: c.id,
      defPi: defHero
        ? defHero.player != null
          ? defHero.player
          : null
        : prov.owner != null && prov.owner !== c.player
          ? prov.owner
          : null,
      defChar: defHero ? defHero.id : null,
      atkStr: Math.round(atkBaseStr),
      defStr: Math.round(defBaseStr),
      S: Math.round((_fort.S || 0) * 1000) / 1000,
      atkUnits: (armies || []).filter((a) => a && !a._phantom).length,
      defUnits: (defenders || []).filter((a) => a && !a._phantom).length,
      won,
      atkLost: _telAtkLost,
      defLost: _telDefLost,
      carry: prov._carryOnRounds || 0,
    });
  } catch (_te) {}
  return { won, narrative, summaryText, atkLost: _telAtkLost, defLost: _telDefLost };
}
