// The battle between two heroes' hosts (combatVsChar, src/engine/battle/battles-between-heroes.ts), its fifth and last
// stage, B-06bj: the casualty bands and the carry-on (the battle proof's H8), the fates, the rout and the aftermath
// (H9: the pursuits, the sea lanes, the Shield Fort, the stay-or-retreat check and each side's retreat), and the end
// (H10: the spells lifted, the Phantasmal Armies cleared, the skills learned and the statistics' record), moved here as
// they were, the same statements in the same order. combatVsChar calls it where they stood, after Sanctuary, the
// mastery orders, the lines, fortune and the result (h5-to-h7-…), and hands it what the set-up, H4 and H5 to H7
// returned, as they are; it returns what combatVsChar returns. It reads the battle's state (its type and table in
// h0-to-h2-…) through it, and calls `_tallyLost` (made in H0), which writes it, before H10 reads both loss counts. The
// lets it declares (`_stayLo`, `_stayWi`, `_heldField`, `defFriendlyAdj`, `atkFriendlyAdj`) are written and read here
// alone, so the state gains no field. The battle proof (tools/proof/README.md, section 8) finds H8's, H9's and H10's
// anchors in this file; nothing above H8's draws a die.
import {
  KC_A_BATTLES_DECISIVE_MARGIN_ITS_TRAPPED_UNITS_AND_ITS_BEATEN_SIDES_LESSONS,
  KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE,
  KC_THE_CHANCE_A_BEATEN_HOST_STILL_THE_STRONGER_STAYS_ON_THE_FIELD,
  KC_THE_FACTOR_EACH_QUALITY_TIER_GIVES_A_UNITS_CHANCE_TO_GAIN_EXPERIENCE_IN_A_BATTLE,
} from '../../../content/kingdoms-call-data.ts';
import { ALIGNMENT_ABILITIES } from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { kcRng } from '../../rng.ts';
import { aForceHoldsTheSeaLanes } from '../../rules/the-registry-of-content-effects.ts';
import {
  doesARealmsAlignmentHoldABeatenHostOnTheField,
  theConquestDoctrineOfARealmsAlignment,
} from '../../rules/the-registry-of-alignment-abilities.ts';
import { QUALITY_TIERS } from '../../army-tables.ts';
import { battleMarginBand, rollUnitFates } from '../fates.ts';
import { battleFacing, battleGrid } from '../lines.ts';
import { UNDEAD_SKEL_HERO_FAN, UNDEAD_SKEL_KING_FAN } from '../ladder.ts';
import { pursuitsOfTheBeaten, shieldFortHolds, theFractionThePursuitsAdd } from '../../units/movement.ts';
import { recordBattleGraves } from '../../graves.ts';
import { theLinesOfThePursuitsOfTheBeaten } from '../battle-report-lines-and-force-markers.ts';
import { humanXPMult } from '../../units/drill-and-spoils.ts';
import { clearPhantomCopies, getNeighborsP } from '../../world/map-helpers.ts';
import { perkTier } from '../../titles/perks.ts';
import { discDeathMult, discPromo } from '../../discoveries.ts';
import { completeDefendWatches, noteBattleLoss } from '../../turn/mercenary-ids-and-battle-records.ts';
import {
  bestRetreat,
  navalSplitRetreat,
  retreatOptions,
  seaTrapLine,
} from '../../units/sea-lift-stranding-and-retreats.ts';
import { getSeaCapability } from '../../units/movement-pools.ts';
import { realCharOf } from '../best-commander.ts';
import { SKILLGAIN_COMMON, SKILLGAIN_STD, trySkillGain } from '../../heroes/experience-skill-rises-and-earned-hp.ts';
import { spreadTerror } from '../evil-terror.ts';
import { bloodHarvest, ironThroneRaise } from '../blood-harvest-and-iron-throne.ts';
import {
  CARRYON_DEATH_CAP,
  CARRYON_DEATH_STEP,
} from '../the-death-chances-a-battle-carried-on-round-after-round-scales-by.ts';
import { narrate, recordForTheStatistics } from '../../turn/events-and-their-audiences.ts';
import {
  THE_NUMBER_OF_VERBS_A_VICTORY_IS_TOLD_WITH,
  theUnitsAsTheLineNamesThem,
} from '../the-facts-a-battles-lines-record.ts';
import type { TurnContext } from '../../turn/context.ts';
import type { NarrativeLine } from '../../turn/events-and-their-audiences.ts';
import type { ArmyInABattle, HeroInABattle, ProvinceInABattle } from '../../army-tables.ts';
import type { ABattleIsDecided } from '../the-facts-a-battles-lines-record.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { WhatTheSetUpOfTheBattleBetweenHeroesHandsOn } from './h3-both-sides-pre-battle-magic-and-army-spells.ts';
import type {
  WhatTheArcheryFlakAndBreachOfTheBattleBetweenHeroesHandOn,
  sanctuaryTheMasteryOrdersTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroes,
} from './h5-to-h7-sanctuary-the-mastery-orders-the-lines-fortune-and-the-result.ts';

/** What Sanctuary, the mastery orders, the lines, fortune and the result hand on to the last stage, as they returned
 *  it. */
export type WhatTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroesHandOn = ReturnType<
  typeof sanctuaryTheMasteryOrdersTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroes
>;

/** The battle's outcome at its place in the narrative: the head line, written there just before the casualties, which
 *  the battle rewrites in place when the beaten side holds the field; for any other line, a TypeError. (It and the
 *  test it reads moved as they were from combatVsChar's file, B-06bj: only this stage reads them.) */
function theOutcomeLineAt(narrative: readonly NarrativeLine[], at: number): ABattleIsDecided {
  const theLine = narrative[at];
  if (!aBattleIsDecided(theLine)) throw new TypeError(`the line at ${String(at)} is not the battle's outcome`);
  return theLine;
}
function aBattleIsDecided(line: NarrativeLine | undefined): line is ABattleIsDecided {
  return line?.kind === 'a battle is decided';
}

/** The fifth and last stage of the battle between two heroes' hosts: the casualty bands and the carry-on, the fates,
 *  the rout and the aftermath, and the end. It returns what the battle returns. */
export function theCasualtiesTheRoutAndTheEndOfTheBattleBetweenHeroes(
  turnContext: TurnContext,
  atk: HeroInABattle,
  def: HeroInABattle,
  prov: ProvinceInABattle,
  theSetUp: WhatTheSetUpOfTheBattleBetweenHeroesHandsOn,
  theArcheryFlakAndBreach: WhatTheArcheryFlakAndBreachOfTheBattleBetweenHeroesHandOn,
  theLinesTheFortuneAndTheResult: WhatTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroesHandOn,
) {
  const {
    G,
    theAttackerAsTheGuardsReadHim,
    theDefenderAsTheGuardsReadHim,
    _fieldIds,
    narrative,
    atkArmies,
    defArmies,
    theAttackersRealm,
    theDefendersRealm,
    theBattlesState,
    _tallyLost,
    atkTact,
    defTact,
    atkMorale,
    defMorale,
    atkSide,
    defSide,
    atkHomeBonusP,
    defBonus,
    atkSkelFanatic,
    defSkelFanatic,
    atkSkelHero,
    defSkelHero,
    atkEvilMonster,
    defEvilMonster,
    pvpTerrain,
  } = theSetUp;
  const { atkFlankPvp, defFlankPvp, atkDiscBonus, defDiscBonus, _pvpRow } = theArcheryFlakAndBreach;
  const {
    atkSanct,
    defSanct,
    atkOrd,
    defOrd,
    _consecPenalty,
    pvpFront,
    _dep,
    _facedA,
    _facedD,
    atkBaseStr,
    defBaseStr,
    _fortP,
    won,
    _rollTacticalGainPvP,
    _rollNavalGainPvP,
    _rollDruidGainPvP,
    margin,
    totalStrPvP,
  } = theLinesTheFortuneAndTheResult;
  const margRatioPvP = margin / totalStrPvP;
  const _bandPvP = battleMarginBand(margRatioPvP);
  if (!_bandPvP) throw new TypeError("Cannot read properties of undefined (reading 'max')"); // (the bands' table is never empty)
  const isDecisivePvP =
    _bandPvP.max >
    KC_A_BATTLES_DECISIVE_MARGIN_ITS_TRAPPED_UNITS_AND_ITS_BEATEN_SIDES_LESSONS.theMarginABattleIsDecisiveAbove;
  const severity = _bandPvP.slug;
  narrate(narrative, {
    kind: "the battle's outcome and its margin",
    winnerName: won ? atk.name : def.name,
    severity,
    margRatio: margRatioPvP,
  });
  // Evil: a decisive victory by an Evil commander terrorises the battle province and all adjacent
  // provinces (stacking).
  const _pvpWinner = won ? atk : def;
  if (
    isDecisivePvP &&
    _pvpWinner.player !== null &&
    theConquestDoctrineOfARealmsAlignment(G.players[_pvpWinner.player]?.alignment) !== null && // its row (P1-19ax1)
    ((_pvpWinner.encounterPlan?.evilMode ?? '') || 'terror') === 'terror'
  ) {
    spreadTerror(turnContext, prov, _pvpWinner.player, narrative);
  }

  const tiers = QUALITY_TIERS.slice();
  const xpMultPvP: readonly number[] =
    KC_THE_FACTOR_EACH_QUALITY_TIER_GIVES_A_UNITS_CHANCE_TO_GAIN_EXPERIENCE_IN_A_BATTLE;
  function xpChancePvP(base: number, quality: string) {
    return base * (xpMultPvP[tiers.indexOf(quality)] ?? 0);
  }

  // Margin-based chances
  const _carryMultPvP = Math.min(CARRYON_DEATH_CAP, 1 + CARRYON_DEATH_STEP * (prov._carryOnRounds ?? 0)); // item 3
  const winDeathPvP = _bandPvP.winDeath * _carryMultPvP;
  const loseDeathPvP = _bandPvP.loseDeath * _carryMultPvP;
  const winXPPvP = _bandPvP.winXP;
  const loseXPPvP = _bandPvP.loseXP;
  const loseDemotePvP = _bandPvP.loseDemote;
  const atkSteelMultOf = (a: ArmyInABattle) => discDeathMult(turnContext, atk.player, a, 'atk'); // per-unit deathRed discoveries (sd05 now one of them)
  const defSteelMultOf = (a: ArmyInABattle) => discDeathMult(turnContext, def.player, a, 'def');
  const atkTacMult =
    perkTier(atk, 'tactical') >=
    KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE.theMasteryTierOfTacticalThatSparesALosingHost
      ? KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE.theShareOfALosingUnitsChancesToDieOrDisbandItLeaves
      : 1; // TACTICAL L8: on a LOSS, atk's units half as likely to die/disband
  const defTacMult =
    perkTier(def, 'tactical') >=
    KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE.theMasteryTierOfTacticalThatSparesALosingHost
      ? KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE.theShareOfALosingUnitsChancesToDieOrDisbandItLeaves
      : 1;
  // ── UNIT ABILITIES: casualty & retreat ── The rule registry's three stages of the rout (plan P1-19j): the pursuits
  // each force would make of the beaten as the winner ("fate: the winner runs the beaten down"), whether it holds the
  // sea lanes ("a force holds the sea lanes") and whether it holds when beaten ("the beaten force holds",
  // shieldFortHolds). This adds each pursuit's fraction to each beaten unit's death roll and writes the lines.
  // HUMAN — Ride Them Down: light horse are murder on a broken enemy, in open country (the War-Horn of the Plains carries
  // them onto rough ground); ORC — Run Them Down (2026-10-09, Toby item 7): a warg-heavy victor runs the beaten army
  // down ON THE FIELD, on any ground — instead of the old automatic chase after the beaten commander, which marched the
  // victor off in later phases on orders nobody gave (there is no follow-up move or pursuit now); PRIMAL (2026-10-13,
  // the beast abilities): the Manticores hunt a broken foe down on any ground, and at sea the sharks tear into beaten
  // crews. A Shield Fort withdrawal is immune to each.
  const _pursuitsAtk = pursuitsOfTheBeaten(atkArmies, pvpTerrain, atk, 'between heroes');
  const _pursuitsDef = pursuitsOfTheBeaten(defArmies, pvpTerrain, def, 'between heroes');
  for (const [_ps, _side] of [
    [_pursuitsAtk, atkSide],
    [_pursuitsDef, defSide],
  ] as const)
    for (const p of _ps)
      if (p.onTheGround === 'by the war-horn of the plains')
        narrate(narrative, {
          kind: "a side's war-horn of the plains lets its free lances ride in rough country",
          sideName: _side,
          terrain: pvpTerrain,
        });
  for (const [_ps, _side] of [
    [_pursuitsAtk, atkSide],
    [_pursuitsDef, defSide],
  ] as const)
    for (const p of _ps)
      if (p.onTheGround === 'it finds no room')
        narrate(narrative, { kind: "a side's free lances find no room to ride", sideName: _side, terrain: pvpTerrain });
  // HUMAN — Cut the Line: a corsair-heavy victor leaves no line of retreat by sea.
  const _cutAtk = aForceHoldsTheSeaLanes({ theForce: atkArmies, theBattle: 'between heroes' });
  const _cutDef = aForceHoldsTheSeaLanes({ theForce: defArmies, theBattle: 'between heroes' });
  // DWARF — Shield Fort (replaces Hold the Line): a Guard-heavy force never routs — it conducts a
  // FIGHTING WITHDRAWAL behind locked shields. Retreat path available: it withdraws in good order
  // (immune to Ride Them Down and to demotion-in-retreat). Trapped: it holds its ground contested
  // WITHOUT the no-escape extra casualties. The old unconditional pin is gone — a beaten Guard
  // force no longer chains itself to a lost field.
  const _sfAtk = shieldFortHolds(atkArmies, _dep.gA); // 2026-10-11 (Toby): half the FRONT LINE is Guard, a Dwarf Garrison counting
  const _sfDef = shieldFortHolds(defArmies, _dep.gD);
  // (The Eagle Riders' Skyward Retreat was retired with the unit abilities, 2026-10-11.)
  const _noEscapeRoll = (force: readonly ArmyInABattle[] | null | undefined, name: string, narr: NarrativeLine[]) => {
    (force ?? []).forEach((a) => {
      if (
        kcRng() <
        KC_A_BATTLES_DECISIVE_MARGIN_ITS_TRAPPED_UNITS_AND_ITS_BEATEN_SIDES_LESSONS.theChanceEachUnitWithNowhereToRetreatIsCutDown
      ) {
        a._died = true;
        narrate(narr, {
          kind: "a unit's fate in the battle",
          itsSideWon: false,
          fate: 'is cut down with no escape',
          inTheRout: false,
          theUnit: {
            kind: 'a unit named without its quality',
            owner: { heroName: name, leaderless: false },
            unitName: a.unitName,
            type: a.type,
            quality: a.quality,
          },
        });
      }
    });
  };
  const atkMilMultOf = (a: ArmyInABattle) => 1 + discPromo(turnContext, atk.player, a); // per-unit promo discoveries
  const defMilMultOf = (a: ArmyInABattle) => 1 + discPromo(turnContext, def.player, a);

  prov._hadBattleThisTurn = true;
  // a beaten force that still has a road home normally retreats — but if it ends the fight
  // STRONGER than the victor (its surviving units outweigh theirs, so it could expect to win a
  // rematch), it may instead hold the field and fight on. Chance scales with how much stronger it
  // is, capped at 75%. "Stay" leaves the province contested (_battleUnresolved), and the
  // stalled-battle resolver grinds the carry-on each following phase until it breaks one way or
  // the other.
  // 2026-09-23b ROOT CAUSE FIX: _survStr summed BARE armStr (no ctx, no Tactical, no defender
  // bonus, no discoveries), so two Elven eagle units (≈39) "outweighed" an Elite Dwarven Guard (32
  // bare) that actually fights at ≈120 (Bulwark ×1.5, Tactical ×2.0, defender ×1.25) — and the
  // beaten eagles were told they were "still the stronger host" and kept in a hopeless carry-on.
  // Survivors are now valued exactly as the battle values a unit (ladder rows: ctx, Archery /
  // Naval / Tactical, battle lines) × every force-wide multiplier that would carry into a rematch.
  // Left out: this battle's arrows/spells (_tempStrReduction — cleared at battle end), the random
  // Tactical-L6 / War-Drum tier-ups and the random fanaticism roll (all re-rolled next round).
  const _atkFanDet = Math.max(
    1,
    atkSkelFanatic ? UNDEAD_SKEL_KING_FAN : 1,
    atkEvilMonster ? ALIGNMENT_ABILITIES['savage-fury'].theNumbers.theStrengthOfTheHost.value : 1,
    atkSkelHero ? UNDEAD_SKEL_HERO_FAN : 1,
  );
  const _defFanDet = Math.max(
    1,
    defSkelFanatic ? UNDEAD_SKEL_KING_FAN : 1,
    defEvilMonster ? ALIGNMENT_ABILITIES['savage-fury'].theNumbers.theStrengthOfTheHost.value : 1,
    defSkelHero ? UNDEAD_SKEL_HERO_FAN : 1,
  );
  const _survStr = (isAtk: boolean) => {
    const clean = (f: readonly (ArmyInABattle | null | undefined)[] | null | undefined) =>
      (f ?? [])
        .filter((a): a is ArmyInABattle => Boolean(a && !a._died && !a._disbanded))
        .map((a) => {
          const c = { ...a };
          delete c._tempStrReduction;
          delete c._terrorMult;
          delete c._archeryRed;
          delete c._tacUp;
          delete c._drumUp;
          delete c._flakTargeted;
          return c;
        });
    const mine = clean(isAtk ? atk.armies : def.armies),
      foe = clean(isAtk ? def.armies : atk.armies);
    if (!mine.length) return 0;
    const rows = mine.map((a) => _pvpRow(a, isAtk, mine, foe)),
      foeRows = foe.map((a) => _pvpRow(a, !isAtk, foe, mine));
    // Both grids and who faces whom, exactly as a rematch would place them (2026-10-11).
    const myFlank = isAtk ? atkFlankPvp : defFlankPvp,
      foeFlank = isAtk ? defFlankPvp : atkFlankPvp,
      myTac = isAtk ? atkTact : defTact,
      foeTac = isAtk ? defTact : atkTact;
    const gMe = battleGrid(rows, pvpFront, pvpTerrain, {
      flank: myFlank,
      tac: myTac,
      enemy: foeRows,
      enemyTac: foeTac,
    });
    const gFoe = battleGrid(foeRows, pvpFront, pvpTerrain, {
      flank: foeFlank,
      tac: foeTac,
      enemy: rows,
      enemyTac: myTac,
    });
    battleFacing(isAtk ? gMe : gFoe, isAtk ? gFoe : gMe, pvpTerrain);
    // (battleFacing has just faced both grids)
    const theFace = gMe.face;
    if (!theFace) throw new TypeError("Cannot read properties of undefined (reading 'total')");
    const tot = theFace.total;
    return isAtk
      ? tot * _atkFanDet * atkDiscBonus * atkMorale * _consecPenalty * atkSanct * atkOrd * atkHomeBonusP
      : tot * _defFanDet * defBonus * defMorale * defDiscBonus * defSanct * defOrd;
  };
  let _stayLo = 0,
    _stayWi = 0;
  const _wantsToStay = (loserForce: readonly ArmyInABattle[] | null | undefined, loserCh: HeroInABattle) => {
    if (!loserForce || loserForce.length === 0) return false;
    const loIsAtk = loserCh === atk;
    const lo = _survStr(loIsAtk),
      wi = _survStr(!loIsAtk);
    _stayLo = lo;
    _stayWi = wi;
    if (lo <= wi) return false; // not actually the stronger host — retreat
    const stayChance = Math.max(
      0,
      Math.min(KC_THE_CHANCE_A_BEATEN_HOST_STILL_THE_STRONGER_STAYS_ON_THE_FIELD.theMost, lo / Math.max(1, wi) - 1),
    );
    return kcRng() < stayChance;
  };
  let _heldField = false; // the beaten side stays on the field (stay / trapped / Deathless / Shield Fort)
  // 2026-09-23b: a casualty section with no line at all (the victor's lone unit came through
  // untouched) printed a bare header. Any unit that got no line of its own is reported as surviving
  // — same wording as combatVsNPC. (Each unit writes at most one line in these loops.)
  const survLine = (force: readonly (ArmyInABattle | null | undefined)[] | null | undefined, n0: number) => {
    const f = (force ?? []).filter(Boolean),
      got = narrative.length - n0;
    if (got < f.length)
      narrate(narrative, {
        kind: "a side's other forces survive the engagement",
        someUnitsFateIsToldAbove: got > 0,
      });
    else if (!f.length && got === 0) narrate(narrative, { kind: 'no units were left on the field to count' });
  };
  if (won) {
    const _winVerbIndex = Math.floor(kcRng() * THE_NUMBER_OF_VERBS_A_VICTORY_IS_TOLD_WITH),
      _headIdx = narrative.length;
    narrate(narrative, {
      kind: 'a battle is decided',
      battle: 'between two hosts',
      winnersRole: 'the attacker',
      whatBecomesOfTheProvince: 'seized',
      severity,
      winVerbIndex: _winVerbIndex,
      attackersSide: atkSide,
      defendersSide: defSide,
      provName: prov.name,
    });
    narrate(narrative, { kind: "the attacker's casualties begin", atkName: atkSide }); // Winning attacker
    const _cas0 = narrative.length;
    rollUnitFates(atkArmies, {
      owner: atkSide,
      won: true,
      dieAt: (a) => winDeathPvP * atkSteelMultOf(a),
      promoteTo: (a) =>
        winDeathPvP * atkSteelMultOf(a) +
        xpChancePvP(winXPPvP * atkMilMultOf(a), a.quality) * humanXPMult(a, atk.player, G),
      faced: _facedA,
      say: (l) => {
        narrate(narrative, l);
      },
    });
    survLine(atkArmies, _cas0);
    narrate(narrative, { kind: "the defender's casualties begin", defName: defSide });
    const _rideAtkEff = _sfDef ? 0 : theFractionThePursuitsAdd(_pursuitsAtk);
    theLinesOfThePursuitsOfTheBeaten(_pursuitsAtk, _sfDef, atkSide, defSide, narrative);
    // Losing defender
    const _cas1 = narrative.length;
    rollUnitFates(defArmies, {
      owner: defSide,
      won: false,
      dieAt: (a) => loseDeathPvP * defSteelMultOf(a) * defTacMult + _rideAtkEff,
      demoteAt: () => loseDemotePvP * defTacMult,
      promoteTo: (a) =>
        loseDemotePvP + xpChancePvP(loseXPPvP * defMilMultOf(a), a.quality) * humanXPMult(a, def.player, G),
      shieldFort: _sfDef,
      faced: _facedD,
      say: (l) => {
        narrate(narrative, l);
      },
    });
    survLine(defArmies, _cas1);
    recordBattleGraves(
      turnContext,
      prov,
      atkArmies.filter((a) => a._died),
      theAttackerAsTheGuardsReadHim?.player,
    );
    recordBattleGraves(
      turnContext,
      prov,
      defArmies.filter((a) => a._died),
      theDefenderAsTheGuardsReadHim?.player,
    );
    bloodHarvest(turnContext, atk, defArmies.filter((a) => a._died).length, narrative);
    ironThroneRaise(
      turnContext,
      atk,
      defArmies.filter((a) => a._died),
      narrative,
    ); // GRAND DESIGN — Evil
    atk.armies = atkArmies.filter((a) => !a._died && !a._disbanded);
    def.armies = defArmies.filter((a) => !a._died && !a._disbanded);
    // Losing defender retreat
    getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces); // its provinces read by nothing, the call kept as it was
    getSeaCapability(asItsGuardReadsIt(def.armies) ?? [], def); // (the same) only ground the beaten force could legally enter
    let defFriendlyAdj = retreatOptions(turnContext, def, prov, asItsGuardReadsIt(def.armies) ?? []); // own/allied ground it could legally enter, or the unowned sea it sailed from (2026-09-23c)
    // HUMAN — Cut the Line: corsairs close the sea lanes behind a beaten enemy.
    if (_cutAtk && defFriendlyAdj.length > 0) {
      const overland = defFriendlyAdj.filter((p2) => p2.terrain !== 'sea');
      if (overland.length < defFriendlyAdj.length) {
        narrate(narrative, {
          kind: "the winner's corsairs close the sea lanes to the loser",
          winnerName: atkSide,
          loserName: defSide,
        });
        defFriendlyAdj = overland;
      }
    }
    // DWARF — Shield Fort: trapped, the Guard hold contested WITHOUT extra no-escape losses; with
    // a path open, they withdraw in good order (mechanics applied above) — no pin.
    const _dmDef = doesARealmsAlignmentHoldABeatenHostOnTheField(theDefendersRealm?.alignment, {
      theCompanies: def.armies,
    });
    // 2026-09-27 (Toby item 3): the naval split. Evaluated once, ahead of the branch chain, so a
    // mixed column whose hulls can still sail is never filed as "nowhere to retreat". A host that
    // is still the stronger and means to fight on (_wantsToStay) keeps that choice, and a dead
    // commander never retreats — both are checked first. Cut the Line closes the water to it too.
    // (the winner's force and the winner, handed here once, are read by nothing)
    const _defStays = defFriendlyAdj.length > 0 && _wantsToStay(def.armies, def);
    const _navalDef =
      _defStays || asItsGuardReadsIt(def.alive) === false || def.killedThisTurn
        ? ''
        : navalSplitRetreat(turnContext, def, prov, def.armies, narrative, defSide, _cutAtk);
    if (_navalDef) {
      if (_navalDef === 'stay') {
        prov._battleUnresolved = true;
        _heldField = true;
      }
    } else if (defFriendlyAdj.length === 0) {
      {
        const _st = seaTrapLine(defSide, def, prov, def.armies);
        if (_st) narrate(narrative, _st);
      }
      if (_dmDef) {
        // UNDEAD — Deathless March: the dead do not panic. A trapped all-skeletal force takes no
        // flight casualties; it simply stands among the living's fear, contesting the ground.
        narrate(narrative, {
          kind: "the loser's skeletal host stands its ground in a deathless march",
          loserName: defSide,
          provName: prov.name,
        });
        prov._battleUnresolved = true;
        _heldField = true;
      } else if (_sfDef && def.armies.length > 0) {
        narrate(narrative, {
          kind: "the loser's dwarven guard hold a shield fort with no road out",
          loserName: defSide,
          provName: prov.name,
        });
        prov._battleUnresolved = true;
        _heldField = true;
      } else {
        narrate(narrative, { kind: 'the defender has nowhere to retreat', defName: defSide });
        _noEscapeRoll(def.armies, def.name, narrative);
        def.armies = def.armies.filter((a: ArmyInABattle) => !a._died && !a._disbanded);
        if (def.armies.length > 0) prov._battleUnresolved = true;
        _heldField = true; // trapped survivors fight again next phase
      }
    } else if (_defStays) {
      // still the stronger host — the defender refuses to yield and fights on.
      narrate(narrative, {
        kind: 'a battle is decided',
        battle: 'between two hosts',
        winnersRole: 'the attacker',
        whatBecomesOfTheProvince: 'the beaten host stays, still the stronger',
        attackersSide: atkSide,
        defendersSide: defSide,
        stayingHostStrength: _stayLo,
        victorsStrength: _stayWi,
        provName: prov.name,
      });
      prov._battleUnresolved = true;
      _heldField = true;
    } else if (asItsGuardReadsIt(def.alive) === false || def.killedThisTurn) {
      // the commander is already dead (e.g. slain in the pre-battle duel) — a corpse does not
      // retreat, and a force wiped to the last has nothing left to fall back with. Any leaderless
      // survivors are dispersed after the battle by disperseDeadCharArmies (which logs where they
      // go), so we say nothing about a retreat here.
      if ((asItsGuardReadsIt(def.armies) ?? []).length === 0)
        narrate(narrative, { kind: "the loser's force is destroyed to the last", loserName: defSide });
    } else {
      if (_sfDef && def.armies.length > 0)
        narrate(narrative, { kind: "the loser's dwarven guard withdraw behind a shield fort", loserName: defSide });
      const defFromProv = def._attackedFrom === undefined ? undefined : G.world.provinces[def._attackedFrom];
      // never retreat INTO the contested province (stale _attackedFrom guard).
      const defRetreatTo =
        defFromProv && defFromProv.id !== prov.id && defFriendlyAdj.some((p2) => p2.id === defFromProv.id)
          ? defFromProv
          : (bestRetreat(
              turnContext,
              def,
              defFriendlyAdj.filter((p2) => p2.id !== prov.id),
            ) ?? defFriendlyAdj[0]); // adjacent only; with a choice, the most valuable ground wins
      if (!defRetreatTo) throw new TypeError("Cannot read properties of undefined (reading 'name')"); // (this branch has ground to fall back on)
      narrate(narrative, {
        kind: 'the loser retreats to a province',
        loserName: defSide,
        retreatToName: defRetreatTo.name,
      });
      const defSurvivors2 = asItsGuardReadsIt(def.armies) ?? [];
      if (defSurvivors2.length > 0)
        narrate(narrative, {
          kind: "the loser's surviving forces",
          loserName: defSide,
          survivingForces: theUnitsAsTheLineNamesThem(defSurvivors2),
        });
      else
        narrate(narrative, {
          kind: "the loser's forces are completely destroyed and he retreats alone",
          loserName: defSide,
        });
      prov.characters = (asItsGuardReadsIt(prov.characters) ?? []).filter((id) => id !== def.id);
      defRetreatTo.characters = asItsGuardReadsIt(defRetreatTo.characters) ?? [];
      if (!defRetreatTo.characters.includes(def.id)) defRetreatTo.characters.push(def.id);
      def.location = defRetreatTo.id; // a forced retreat does NOT consume the character's move points.
    }
    if (_heldField) theOutcomeLineAt(narrative, _headIdx).whatBecomesOfTheProvince = "held by the defender's survivors";
  } else {
    const _headIdx = narrative.length;
    narrate(narrative, {
      kind: 'a battle is decided',
      battle: 'between two hosts',
      winnersRole: 'the defender',
      whatBecomesOfTheProvince: 'the attacker is driven out',
      severity,
      attackersSide: atkSide,
      defendersSide: defSide,
      provName: prov.name,
    });
    narrate(narrative, { kind: "the attacker's casualties begin", atkName: atkSide }); // Losing attacker
    const _rideDefEff = _sfAtk ? 0 : theFractionThePursuitsAdd(_pursuitsDef);
    theLinesOfThePursuitsOfTheBeaten(_pursuitsDef, _sfAtk, defSide, atkSide, narrative);
    const _cas2 = narrative.length;
    rollUnitFates(atkArmies, {
      owner: atkSide,
      won: false,
      inTheRout: true,
      dieAt: (a) => loseDeathPvP * atkSteelMultOf(a) * atkTacMult + _rideDefEff,
      demoteAt: () => loseDemotePvP * atkTacMult,
      promoteTo: (a) =>
        loseDemotePvP + xpChancePvP(loseXPPvP * atkMilMultOf(a), a.quality) * humanXPMult(a, atk.player, G),
      shieldFort: _sfAtk,
      faced: _facedA,
      say: (l) => {
        narrate(narrative, l);
      },
    });
    survLine(atkArmies, _cas2);
    narrate(narrative, { kind: "the defender's casualties begin", defName: defSide });
    // Winning defender — small death chance, good XP chance
    const _cas3 = narrative.length;
    rollUnitFates(defArmies, {
      owner: defSide,
      won: true,
      hardenedByVictory: true,
      dieAt: (a) => winDeathPvP * defSteelMultOf(a),
      promoteTo: (a) =>
        winDeathPvP * defSteelMultOf(a) +
        xpChancePvP(winXPPvP * defMilMultOf(a), a.quality) * humanXPMult(a, def.player, G),
      faced: _facedD,
      say: (l) => {
        narrate(narrative, l);
      },
    });
    survLine(defArmies, _cas3);
    recordBattleGraves(
      turnContext,
      prov,
      atkArmies.filter((a) => a._died),
      theAttackerAsTheGuardsReadHim?.player,
    );
    recordBattleGraves(
      turnContext,
      prov,
      defArmies.filter((a) => a._died),
      theDefenderAsTheGuardsReadHim?.player,
    );
    bloodHarvest(turnContext, def, atkArmies.filter((a) => a._died).length, narrative);
    ironThroneRaise(
      turnContext,
      def,
      atkArmies.filter((a) => a._died),
      narrative,
    ); // GRAND DESIGN — Evil
    atk.armies = atkArmies.filter((a) => !a._died && !a._disbanded);
    def.armies = defArmies.filter((a) => !a._died && !a._disbanded);
    // Losing attacker retreat
    getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces); // its provinces read by nothing, the call kept as it was
    getSeaCapability(asItsGuardReadsIt(atk.armies) ?? [], atk); // (the same) only ground the beaten force could legally enter
    let atkFriendlyAdj = retreatOptions(turnContext, atk, prov, asItsGuardReadsIt(atk.armies) ?? []); // own/allied ground it could legally enter, or the unowned sea it sailed from (2026-09-23c)
    // HUMAN — Cut the Line: corsairs close the sea lanes behind a beaten enemy.
    if (_cutDef && atkFriendlyAdj.length > 0) {
      const overland = atkFriendlyAdj.filter((p2) => p2.terrain !== 'sea');
      if (overland.length < atkFriendlyAdj.length) {
        narrate(narrative, {
          kind: "the winner's corsairs close the sea lanes to the loser",
          winnerName: defSide,
          loserName: atkSide,
        });
        atkFriendlyAdj = overland;
      }
    }
    // DWARF — Shield Fort: trapped, the Guard hold contested WITHOUT extra no-escape losses; with
    // a path open, they withdraw in good order (mechanics applied above) — no pin.
    const _dmAtk = doesARealmsAlignmentHoldABeatenHostOnTheField(theAttackersRealm?.alignment, {
      theCompanies: atk.armies,
    });
    // 2026-09-27 (Toby item 3): the naval split — see the defender's block above for the reasoning.
    // (the winner's force and the winner, handed here once, are read by nothing)
    const _atkStays = atkFriendlyAdj.length > 0 && _wantsToStay(atk.armies, atk);
    const _navalAtk =
      _atkStays || asItsGuardReadsIt(atk.alive) === false || atk.killedThisTurn
        ? ''
        : navalSplitRetreat(turnContext, atk, prov, atk.armies, narrative, atkSide, _cutDef);
    if (_navalAtk) {
      if (_navalAtk === 'stay') {
        prov._battleUnresolved = true;
        _heldField = true;
      }
    } else if (atkFriendlyAdj.length === 0) {
      {
        const _st = seaTrapLine(atkSide, atk, prov, atk.armies);
        if (_st) narrate(narrative, _st);
      }
      if (_dmAtk) {
        narrate(narrative, {
          kind: "the loser's skeletal host stands its ground in a deathless march",
          loserName: atkSide,
          provName: prov.name,
        });
        prov._battleUnresolved = true;
        _heldField = true;
      } else if (_sfAtk && atk.armies.length > 0) {
        narrate(narrative, {
          kind: "the loser's dwarven guard hold a shield fort with no road out",
          loserName: atkSide,
          provName: prov.name,
        });
        prov._battleUnresolved = true;
        _heldField = true;
      } else {
        narrate(narrative, {
          kind: 'the attacker has nowhere to retreat',
          atkName: atkSide,
          atSea: prov.terrain === 'sea',
        });
        _noEscapeRoll(atk.armies, atk.name, narrative);
        atk.armies = atk.armies.filter((a: ArmyInABattle) => !a._died && !a._disbanded);
        if (atk.armies.length > 0) prov._battleUnresolved = true;
        _heldField = true; // trapped survivors fight again next phase
      }
    } else if (_atkStays) {
      // still the stronger host — the attacker refuses to break off and fights on.
      narrate(narrative, {
        kind: 'a battle is decided',
        battle: 'between two hosts',
        winnersRole: 'the defender',
        whatBecomesOfTheProvince: 'the beaten host stays, still the stronger',
        attackersSide: atkSide,
        defendersSide: defSide,
        stayingHostStrength: _stayLo,
        victorsStrength: _stayWi,
        provName: prov.name,
      });
      prov._battleUnresolved = true;
      _heldField = true;
    } else if (asItsGuardReadsIt(atk.alive) === false || atk.killedThisTurn) {
      // commander already slain — a corpse does not retreat; a force wiped to the last has
      // nothing to fall back with. Leaderless survivors are dispersed after the battle.
      if ((asItsGuardReadsIt(atk.armies) ?? []).length === 0)
        narrate(narrative, { kind: "the loser's force is destroyed to the last", loserName: atkSide });
    } else {
      if (_sfAtk && atk.armies.length > 0)
        narrate(narrative, { kind: "the loser's dwarven guard withdraw behind a shield fort", loserName: atkSide });
      const fromProv = atk._attackedFrom === undefined ? undefined : G.world.provinces[atk._attackedFrom];
      // never retreat INTO the contested province (stale _attackedFrom guard).
      const retreatTo =
        fromProv && fromProv.id !== prov.id && atkFriendlyAdj.some((p2) => p2.id === fromProv.id)
          ? fromProv
          : (bestRetreat(
              turnContext,
              atk,
              atkFriendlyAdj.filter((p2) => p2.id !== prov.id),
            ) ?? atkFriendlyAdj[0]); // adjacent only; with a choice, the most valuable ground wins
      if (!retreatTo) throw new TypeError("Cannot read properties of undefined (reading 'name')"); // (this branch has ground to fall back on)
      narrate(narrative, {
        kind: 'the loser retreats to a province',
        loserName: atkSide,
        retreatToName: retreatTo.name,
      });
      // Summarise surviving attacker armies
      const atkSurvivors = asItsGuardReadsIt(atk.armies) ?? [];
      if (atkSurvivors.length > 0)
        narrate(narrative, {
          kind: "the loser's surviving forces",
          loserName: atkSide,
          survivingForces: theUnitsAsTheLineNamesThem(atkSurvivors),
        });
      else
        narrate(narrative, {
          kind: "the loser's forces are completely destroyed and he retreats alone",
          loserName: atkSide,
        });
      prov.characters = (asItsGuardReadsIt(prov.characters) ?? []).filter((id) => id !== atk.id);
      retreatTo.characters = asItsGuardReadsIt(retreatTo.characters) ?? [];
      if (!retreatTo.characters.includes(atk.id)) retreatTo.characters.push(atk.id);
      atk.location = retreatTo.id; // a forced retreat does NOT consume the character's move points.
    }
    if (_heldField) theOutcomeLineAt(narrative, _headIdx).whatBecomesOfTheProvince = 'the attacker is not driven out';
  }

  // Battle-magic strength reductions last only for this battle — units recover afterward.
  [...(asItsGuardReadsIt(atk.armies) ?? []), ...(asItsGuardReadsIt(def.armies) ?? [])].forEach((a: ArmyInABattle) => {
    delete a._tempStrReduction;
    delete a._terrorMult;
    delete a._archeryRed;
    delete a._tacUp;
    delete a._drumUp;
    delete a._laNoTerrain;
    delete a._flakTargeted;
  });
  clearPhantomCopies(atk, !won, realCharOf(turnContext, atk));
  clearPhantomCopies(def, won, realCharOf(turnContext, def)); // remove phantom fighting-copies; the beaten side loses all its phantasmal armies

  // AK [3.15]: "A character's Defend order is canceled if he loses a battle, to prevent further
  // needless defeats." atk/def are pooled copies, so resolve back to the real character by id.
  noteBattleLoss(turnContext, won ? def.id : atk.id, narrative);
  completeDefendWatches(turnContext, _fieldIds, narrative); // item 15: a watch that has fought is done, win or lose
  if (_rollTacticalGainPvP) trySkillGain(turnContext, won ? atk : def, 'tactical', SKILLGAIN_STD, narrative); // Tactical: won a land battle
  if (_rollNavalGainPvP) trySkillGain(turnContext, won ? atk : def, 'naval', SKILLGAIN_STD, narrative); // Naval: won a sea battle
  trySkillGain(
    turnContext,
    won ? def : atk,
    prov.terrain === 'sea' ? 'naval' : 'tactical',
    SKILLGAIN_COMMON,
    narrative,
  ); // batch item 11: the beaten general who lives learns a little
  if (_rollDruidGainPvP) {
    trySkillGain(turnContext, won ? atk : def, 'druid', SKILLGAIN_STD, narrative);
    trySkillGain(
      turnContext,
      won ? def : atk,
      'druid',
      SKILLGAIN_STD,
      narrative,
      KC_A_BATTLES_DECISIVE_MARGIN_ITS_TRAPPED_UNITS_AND_ITS_BEATEN_SIDES_LESSONS.theShareOfTheChanceTheBeatenSidesCommanderLearnsDruidAt,
    );
  } // Druid: winner full, loser half
  // onlooker summary (see combatVsNPC). atkName/defName reflect a slain commander's leaderless
  // host.
  const summaryText: Extract<NarrativeLine, { kind: "the onlookers' summary of a battle" }> = {
    kind: "the onlookers' summary of a battle",
    provName: prov.name,
    won,
    attackersName: atkSide,
    defendersName: defSide,
    betweenTwoHeroesHosts: true,
  };
  _tallyLost();
  try {
    recordForTheStatistics(turnContext, {
      kind: 'a battle fought, for the statistics',
      record: {
        ph: turnContext._logCtx.phase ?? turnContext._currentPhase,
        prov: prov.id,
        terrain: prov.terrain,
        kind: 'pvp',
        atkPi: atk.player,
        atkChar: atk.id,
        defPi: def.player,
        defChar: def.id,
        atkStr: Math.round(atkBaseStr),
        defStr: Math.round(defBaseStr),
        S: Math.round((_fortP.S || 0) * 1000) / 1000,
        atkUnits:
          (asItsGuardReadsIt(atk.armies) ?? []).filter((a: ArmyInABattle | null | undefined) => a && !a._phantom)
            .length + theBattlesState._mAtkLost,
        defUnits:
          (asItsGuardReadsIt(def.armies) ?? []).filter((a: ArmyInABattle | null | undefined) => a && !a._phantom)
            .length + theBattlesState._mDefLost,
        won,
        atkLost: theBattlesState._mAtkLost,
        defLost: theBattlesState._mDefLost,
        carry: prov._carryOnRounds ?? 0,
      },
    });
  } catch {
    // the statistics never stop a battle
  }
  return { won, narrative, summaryText, atkLost: theBattlesState._mAtkLost, defLost: theBattlesState._mDefLost };
}
