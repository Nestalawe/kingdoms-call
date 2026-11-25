import { KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { aForceHoldsTheSeaLanes } from '../rules/the-registry-of-content-effects.ts';
import { theBeatenForceMayRetreatByTheCommandersItems } from '../rules/the-registry-of-magic-item-effects.ts';
import {
  doesARealmsAlignmentHoldABeatenHostOnTheField,
  theConquestDoctrineOfARealmsAlignment,
} from '../rules/the-registry-of-alignment-abilities.ts';
import { QUALITY_TIERS } from '../army-tables.ts';
import { battleMarginBand, rollUnitFates } from './fates.ts';
import {
  pursuitsOfTheBeaten,
  shieldFortHolds,
  theFactorThePursuitsPutOnTheWinnersOwnDeathRolls,
  theFractionThePursuitsAdd,
} from '../units/movement.ts';
import { recordBattleGraves } from '../graves.ts';
import { demoteGuardToWanderer } from '../heroes/fame-and-consecration.ts';
import { activeItems } from '../items/equipment.ts';
import { humanXPMult } from '../units/drill-and-spoils.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { clearPhantomCopies, getNeighborsP } from '../world/map-helpers.ts';
import { perkTier } from '../titles/perks.ts';
import { discDeathMult, discPromo } from '../discoveries.ts';
import { noteBattleLoss } from '../turn/mercenary-ids-and-battle-records.ts';
import {
  bestRetreat,
  navalSplitRetreat,
  retreatOptions,
  seaTrapLine,
} from '../units/sea-lift-stranding-and-retreats.ts';
import { realCharOf } from './best-commander.ts';
import { SKILLGAIN_COMMON, SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { spreadTerror } from './evil-terror.ts';
import { bloodHarvest, ironThroneRaise } from './blood-harvest-and-iron-throne.ts';
import { THE_NUMBER_OF_VERBS_A_VICTORY_IS_TOLD_WITH } from './the-facts-a-battles-lines-record.ts';
import { narrate, recordForTheStatistics } from '../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../turn/context.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { HeroInABattle, ProvinceInABattle } from '../army-tables.ts';
import type { TheDefendersOfAProvince } from './the-facts-a-battles-lines-record.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import {
  type AUnitInTheBattleAgainstTheDefenders,
  theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders,
} from './the-battle-against-the-defenders/n0-to-n2-the-set-up-the-duel-and-the-sides-to-the-home-ground.ts';
import { theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders } from './the-battle-against-the-defenders/n3-to-n4-the-attackers-pre-battle-magic-army-spells-archery-flak-and-breach.ts';
import { theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders } from './the-battle-against-the-defenders/n5-to-n7-the-defenders-pre-battle-magic-archery-and-army-spells.ts';
import { theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders } from './the-battle-against-the-defenders/n8-to-n10-the-grounds-notes-the-lines-fortune-and-the-result.ts';

// ── BATTLES AGAINST A PROVINCE'S DEFENDERS (plan P1-08g: lifted out of resolveTurn) ────
// A host's battle against the defenders of a province that no hero of a realm holds: its neutral defenders, a local
// chieftain or wandering guard leading them, or a realm's unled garrison (combatVsNPC). It takes the turn's context
// first (src/engine/turn/context.ts). Above it, the constants both battle paths read (combatVsNPC here, combatVsChar
// in battle/battles-between-heroes.ts): the carry-on death scaling and the narrative verbs (the
// airborne-at-sea penalties: the-strength-a-host-carried-over-the-sea-by-flyers-keeps.ts).
// a battle that carries on round after round in the same province grows deadlier for BOTH sides.
// prov._carryOnRounds counts the carry-ons (0 for the opening clash); death chances scale by 1 +
// CARRYON_DEATH_STEP per round, capped at CARRYON_DEATH_CAP×: content's row
// (KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS, B-06ay1).
export const CARRYON_DEATH_STEP = KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS.theStepEachCarriedOverRoundAdds,
  CARRYON_DEATH_CAP = KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS.theMostTimesTheyScaleTo;

// Simple combat resolve
// ── ARMY BATTLE NARRATIVE ENGINE ────
// Narrative vocabulary helpers (P1-12d20: the verbs of an attack and of a defence are the prose's,
// src/views/prose/the-words-of-a-battles-lines.ts; the engine draws an attack's by its index)
export const LOSE_VERBS = ['is repulsed by', 'retreats before', 'cannot break', 'is driven back by'];

/** A province beside the beaten as the corsairs' look for water reads it (a gap among them is no water). */
type AProvinceAsTheCorsairsLookForWater = { readonly terrain: string } | null | undefined;

export function combatVsNPC(
  turnContext: TurnContext,
  c: HeroInABattle,
  prov: ProvinceInABattle,
  neutralGuardHero: HeroInABattle | null | undefined,
) {
  // The set-up, the duel and the sides (B-06az: the-battle-against-the-defenders/, its first stage), to the home ground
  // and the commander's Archery and Naval: what the later stages read, each final there.
  const theSetUp = theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders(turnContext, c, prov, neutralGuardHero);
  const { G, theAttackerAsTheGuardsReadHim, narrative, armies, defenders, theAttackersRealm, atkSide, defHero } =
    theSetUp;
  // The attacker's pre-battle phases (B-06ba: the-battle-against-the-defenders/, its second stage), his magic and army
  // spells, then his archery, Flak and Breach: what the later stages read, and the battle's state, made there.
  const theAttackersPhases = theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders(turnContext, c, prov, theSetUp);
  const { theBattlesState } = theAttackersPhases;
  // The defenders' pre-battle phases (B-06bb: the-battle-against-the-defenders/, its third stage), their commander's
  // magic, their archery and Flak, their units' army spells: each strikes the attacker's host, and hands nothing on.
  theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders(turnContext, c, prov, theSetUp, theAttackersPhases);

  // The ground's notes, the lines, fortune and the result (B-06bc: the-battle-against-the-defenders/, its fourth stage):
  // the terrain's notes and the battle lines with every multiplier, the fortune of battle, the stat block and the
  // result: what the later stages read, each final there.
  const {
    _dep,
    _facedA,
    _facedD,
    atkBaseStr,
    defBaseStr,
    _fort,
    finalAtk,
    finalDef,
    margin,
    won,
    _rollTacticalGain,
    _rollNavalGain,
    _rollDruidGain,
  } = theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders(
    turnContext,
    c,
    prov,
    neutralGuardHero,
    theSetUp,
    theAttackersPhases,
  );

  // ── MARGIN-BASED CASUALTY SYSTEM ── margRatio = how decisive the victory was (0=coin flip,
  // 1=total annihilation)
  const totalStr = Math.max(1, finalAtk + finalDef);
  const margRatio = Math.abs(margin) / totalStr;
  const _band = battleMarginBand(margRatio);
  if (!_band) throw new TypeError("Cannot read properties of undefined (reading 'max')"); // (the bands' table is never empty)
  const isDecisive = _band.max > 0.3; // decisive, crushing or annihilating
  // Severity label for narrative
  const severity = _band.slug;

  // XP tier multipliers — higher tiers harder to improve
  const xpMult = QUALITY_TIERS.map((_, i) => [1.5, 1.0, 0.6, 0.3, 0][i]);
  function xpChance(baseChance: number, quality: string) {
    const i = QUALITY_TIERS.indexOf(quality);
    return baseChance * (xpMult[i] ?? 0);
  }

  // Death chances scale with margin — and with how long the fight has ground on. A battle that
  // carries on from phase to phase (or a chain of assaults on the same province) grows bloodier
  // each round for BOTH sides: _carryMult climbs +35% per carry-on round, capped at 2.5×.
  const _carryMult = Math.min(CARRYON_DEATH_CAP, 1 + CARRYON_DEATH_STEP * (prov._carryOnRounds ?? 0));
  const winDeathChance = _band.winDeath * _carryMult;
  const loseDeathChance = _band.loseDeath * _carryMult;
  // XP gain chances
  const winXPChance = _band.winXP;
  const loseXPChance = _band.loseXP;
  // XP loss chances (loser only)
  const loseDemoteChance = _band.loseDemote;

  // Steel Armour discovery: -15% death chance
  const steelMultOf = (a: AUnitInTheBattleAgainstTheDefenders) => discDeathMult(turnContext, c.player, a, 'atk'); // per-unit deathRed discoveries (sd05 Steel Armour now one of them)
  const tacMultNPC = perkTier(c, 'tactical') >= 3 ? 0.5 : 1; // TACTICAL L8: on a LOSS, c's units half as likely to die/disband
  // Military Discipline discovery: +20% XP gain chance
  const milMultOf = (a: AUnitInTheBattleAgainstTheDefenders) => 1 + discPromo(turnContext, c.player, a); // per-unit promo discoveries (sd06 Military Discipline now one of them)

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
  const _npcCorsairs = aForceHoldsTheSeaLanes({ theForce: armies, theBattle: 'a hero against neutral guards' });
  // ORC — Run Them Down: still nothing to pursue (neutral guards do not flee the province), so
  // the wargs simply end it fast — half casualties for your own force on a win.
  const _npcOwnLosses = theFactorThePursuitsPutOnTheWinnersOwnDeathRolls(_npcPursuitsAtk);
  // DWARF — Shield Fort (replaces Hold the Line): a beaten Guard-heavy assault withdraws in good
  // order when a path exists, and holds trapped WITHOUT extra no-escape losses otherwise.
  const _npcSF = shieldFortHolds(armies, _dep.gA); // 2026-10-11: half the FRONT LINE is Guard
  // 2026-09-27 (Toby): the same for a Guard-heavy NEUTRAL GARRISON. A neutral force never retreats,
  // so the "good order withdrawal" half cannot apply to it — what it gets is the other half: the
  // attacker's Free Lances find no broken backs, and the pinned-against-their-own-ground roll does
  // not touch them. Race-converted neutral provinces really can field Dwarven Guard, so this is a
  // live case, not a theoretical one.
  const _npcSFDef = shieldFortHolds(defenders, _dep.gD);

  if (won) {
    const guardName: TheDefendersOfAProvince = defHero
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
      say: (l) => {
        narrate(narrative, l);
      },
    });
    const winSurv = _fw.survived,
      winEvents = _fw.died + _fw.promoted;
    if (winSurv > 0)
      narrate(narrative, {
        kind: "a side's other forces survive the engagement",
        someUnitsFateIsToldAbove: winEvents > 0,
      });
    c.armies = c.armies.filter((a: AUnitInTheBattleAgainstTheDefenders) => !a._died && !a._disbanded);
    // Evil: Terror effect on decisive win — battle province AND all adjacent provinces
    // demoralised (stacking)
    if (
      isDecisive &&
      c.player !== null && // (a hero of no realm has no realm's alignment)
      theConquestDoctrineOfARealmsAlignment(theAttackersRealm?.alignment) !== null && // its row (P1-19ax1)
      ((c.encounterPlan?.evilMode ?? '') || 'terror') === 'terror'
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
    const _defOwner: TheDefendersOfAProvince = defHero
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
    const _defSide2 = (guardName: string): TheDefendersOfAProvince =>
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
      theDefenders: _defSide2(defHero?.name ?? ''),
      aPlayersGarrison: prov.owner != null && !neutralGuardHero,
      atSea: prov.terrain === 'sea', // no walls at sea (2026-09-23b)
      provName: prov.name,
    });
    narrate(narrative, {
      kind: "the defender's casualties begin",
      defName: _defSide2(defHero?.name.replace(' (wandering)', '') ?? ''),
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
            owner: _defSide2(defHero?.name.replace(' (wandering)', '') ?? ''),
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
    theBattlesState._npcDefWinLost = defLost.filter(
      (a: AUnitInTheBattleAgainstTheDefenders | null | undefined) => a && !a._phantom,
    ).length;
    if (defLost.length > 0) recordBattleGraves(turnContext, prov, defLost);
    // Update guard armies if applicable
    if (defHero) defHero.armies = defSurv;
    // 2026-09-09. A guard can WIN this engagement and still lose every unit to the casualty rolls
    // above. A guard with no host is a guard no more: demote him to a plain wanderer on the spot.
    if (defHero?._isNeutralGuard && asItsGuardReadsIt(defHero.alive) !== false && defSurv.length === 0) {
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
      demoteAt: () => loseDemoteChance * tacMultNPC,
      promoteTo: (a) => loseDemoteChance + xpChance(loseXPChance, a.quality) * humanXPMult(a, c.player, G),
      shieldFort: _npcSF,
      notable: true,
      faced: _facedA,
      say: (l) => {
        narrate(narrative, l);
      },
    });

    // Retreat logic
    const adjProvs = getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces);
    // a retreat is a real move — the force can only fall back onto ground it could legally enter.
    // A land force (no fleet capacity) must NOT retreat into an owned/allied sea province.
    // 2026-09-23c: judged on the SURVIVORS (this read the pre-casualty list) via retreatOptions.
    const _retLive = (asItsGuardReadsIt(c.armies) ?? []).filter(
      (a: AUnitInTheBattleAgainstTheDefenders | null | undefined) => a && !a._died && !a._disbanded,
    );
    const friendlyAdj = retreatOptions(turnContext, c, prov, _retLive); // own/allied ground it could legally enter, or the unowned sea it sailed from
    prov._hadBattleThisTurn = true;
    // the items' registry's "fate: the beaten force may retreat" (plan P1-19n: the Shield-Wall Rune refuses it)
    const infStay = !theBeatenForceMayRetreatByTheCommandersItems(activeItems(c));
    const _npcSeaTrap = friendlyAdj.length === 0 && !infStay ? seaTrapLine(atkSide, c, prov, _retLive) : null;
    // HUMAN — Keep the Sea Lanes: a corsair-heavy force always has boats waiting, so long as
    // there is water to reach. They withdraw to the ships rather than being cut down.
    const _seaEscape = _npcCorsairs && adjProvs.some((p2: AProvinceAsTheCorsairsLookForWater) => p2?.terrain === 'sea');
    // DWARF — Shield Fort: trapped, the Guard hold contested with NO extra flight casualties;
    // with a path open they withdraw in good order (no pin — the old Hold the Line is retired).
    const _sfNPC = _npcSF && armies.some((a) => !a._died);
    const _liveNPC = armies.filter((a) => !a._died && !a._disbanded);
    const _dmNPC = doesARealmsAlignmentHoldABeatenHostOnTheField(theAttackersRealm?.alignment, {
      theCompanies: _liveNPC,
    });
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
      const fromProv = c._attackedFrom === undefined ? undefined : G.world.provinces[c._attackedFrom];
      // never retreat INTO the contested province (stale _attackedFrom guard).
      const retreatTo =
        fromProv && fromProv.id !== prov.id && friendlyAdj.some((p2) => p2.id === fromProv.id)
          ? fromProv
          : (bestRetreat(
              turnContext,
              c,
              friendlyAdj.filter((p2) => p2.id !== prov.id),
            ) ?? friendlyAdj[0]); // must be ADJACENT (and friendly, enterable) — never a stale far-off origin; with a choice, the most valuable ground wins
      if (!retreatTo) throw new TypeError("Cannot read properties of undefined (reading 'name')"); // (this branch has ground to fall back on)
      narrate(narrative, {
        kind: "the attacker's forces retreat to a province",
        cName: atkSide,
        retreatToName: retreatTo.name,
      });
      prov.characters = (asItsGuardReadsIt(prov.characters) ?? []).filter((id) => id !== c.id);
      retreatTo.characters = asItsGuardReadsIt(retreatTo.characters) ?? [];
      if (!retreatTo.characters.includes(c.id)) retreatTo.characters.push(c.id);
      c.location = retreatTo.id;
      // a forced retreat does NOT consume the character's move points.
    }

    if (armies.some((a) => !a._died && !a._notable))
      narrate(narrative, {
        kind: "a side's other forces survive the engagement",
        someUnitsFateIsToldAbove: armies.some((a) => (a._died ?? false) || a._notable),
      });
    recordBattleGraves(
      turnContext,
      prov,
      armies.filter((a) => a._died),
      c.player,
    ); // attacker's Elven units may escape home
    c.armies = c.armies.filter((a: AUnitInTheBattleAgainstTheDefenders) => !a._died && !a._disbanded);
  }

  // Battle-magic strength reductions last only for this battle — units recover afterward.
  [
    ...(asItsGuardReadsIt(c.armies) ?? []),
    ...(asItsGuardReadsIt(prov.neutralDefenders) ?? []),
    ...(neutralGuardHero?.armies ?? []),
  ].forEach((a: AUnitInTheBattleAgainstTheDefenders) => {
    delete a._tempStrReduction;
    delete a._terrorMult;
    delete a._archeryRed;
    delete a._tacUp;
    delete a._drumUp;
    delete a._laNoTerrain;
    delete a._flakTargeted;
  });
  clearPhantomCopies(c, !won, realCharOf(turnContext, c)); // remove phantom fighting-copies; if c lost, all its phantasmal armies are dismissed
  if (!won && theAttackerAsTheGuardsReadHim) noteBattleLoss(turnContext, c.id, narrative); // AK [3.15] — a beaten general stops Defending
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
  if (neutralGuardHero && asItsGuardReadsIt(neutralGuardHero.alive) !== false) {
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
  const _sumDef: TheDefendersOfAProvince = defHero
    ? { kind: 'the defenders led by their guard', guardName: defHero.name.replace(' (wandering)', '') }
    : { kind: 'the defenders of a province with no guard to lead them', provName: prov.name, capitalised: false };
  const summaryText: Extract<NarrativeLine, { kind: "the onlookers' summary of a battle" }> = {
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
  const _telAtkLost = armies.filter(
      (a: AUnitInTheBattleAgainstTheDefenders | null | undefined) => a && a._died && !a._phantom,
    ).length,
    _telDefLost =
      defenders.filter((a: AUnitInTheBattleAgainstTheDefenders | null | undefined) => a && a._died && !a._phantom)
        .length +
      theBattlesState._npcSunkLost +
      theBattlesState._npcDefWinLost;
  try {
    recordForTheStatistics(turnContext, {
      kind: 'a battle fought, for the statistics',
      record: {
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
        defPi: defHero ? (defHero.player ?? null) : prov.owner != null && prov.owner !== c.player ? prov.owner : null,
        defChar: defHero ? defHero.id : null,
        atkStr: Math.round(atkBaseStr),
        defStr: Math.round(defBaseStr),
        S: Math.round((_fort.S || 0) * 1000) / 1000,
        atkUnits: armies.filter((a: AUnitInTheBattleAgainstTheDefenders | null | undefined) => a && !a._phantom).length,
        defUnits: defenders.filter((a: AUnitInTheBattleAgainstTheDefenders | null | undefined) => a && !a._phantom)
          .length,
        won,
        atkLost: _telAtkLost,
        defLost: _telDefLost,
        carry: prov._carryOnRounds ?? 0,
      },
    });
  } catch {
    // the statistics never stop a battle
  }
  return { won, narrative, summaryText, atkLost: _telAtkLost, defLost: _telDefLost };
}
