// The battle between two heroes' hosts (combatVsChar, src/engine/battle/battles-between-heroes.ts), its third stage,
// B-06bh: both sides' archery, Flak and Breach (the battle proof's H4: the Flak Screens, each side's volleys, the whale
// cohorts' hulls sunk and the sunk removed, then the ground's notes, Illusory Terrain's flags, each side's rows and
// lines, the Druid's shortfall, the discoveries' bonus and the illusory ground's lines), moved here as they were, the
// same statements in the same order. combatVsChar calls it where they stood, after the magic and army spells
// (h3-…), and hands it what the set-up returned, as it is, and the front's width the set-up rolled (only H5's deploy
// changes it, after this). It returns what the later stages read, each final here: the lines' flanking, each side's
// rows, the discoveries' bonus and the command stage's builders' `_pvpRow` (made here, read by H9). It writes no `let`
// of the table in h0-to-h2-…; the titles' merit tally, the battle's state, it writes through `_tallyLost`, as before.
// The battle proof (tools/proof/README.md, section 8) finds H4's anchor in this file; nothing above it draws a die.
import { kcRng } from '../../rng.ts';
import { theHullAUnitSinksBeforeTheBattle } from '../../rules/the-registry-of-content-effects.ts';
import { theVolleysTheCommandersItemsLoose } from '../../rules/the-registry-of-magic-item-effects.ts';
import { battleLineTotal } from '../lines.ts';
import {
  AERIAL_TYPES,
  SEA_TYPES,
} from '../../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import {
  abilityMissileUnits,
  abilityVolleys,
  applyFlakScreen,
  archeryBlockedBy,
  eyesOfTheForestLine,
  missileDamageMult,
  missileTargetPool,
} from '../strength.ts';
import { recordBattleGraves } from '../../graves.ts';
import { activeItems } from '../../items/equipment.ts';
import {
  doARealmsDiscoveriesWeightTheLinesBehindTheFront,
  whatARealmsDiscoveriesAddToTheWholeArmy,
} from '../../rules/the-registry-of-discovery-effects.ts';
import { effStat } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import { SEA_LAND_PENALTY, applyMissileHit, isAirborneAtSea } from '../terrain-and-unit-strength.ts';
import { druidShortfallLine, terrainNoteList } from '../battle-report-lines-and-force-markers.ts';
import {
  SEA_AIRBORNE_FLYER_PENALTY,
  SEA_AIRBORNE_LAND_PENALTY,
} from '../the-strength-a-host-carried-over-the-sea-by-flyers-keeps.ts';
import { narrate } from '../../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../../turn/context.ts';
import type { NarrativeLine } from '../../turn/events-and-their-audiences.ts';
import type { ArmyInABattle, HeroInABattle, ProvinceInABattle } from '../../army-tables.ts';
import type { WhatTheSetUpOfTheBattleBetweenHeroesHandsOn } from './h3-both-sides-pre-battle-magic-and-army-spells.ts';
import { theCommandStagesBuildersOfTheBattleBetweenHeroes } from './the-command-stages-builders-each-units-row-with-its-commanders-skills-and-the-illusory-terrain.ts';

/** The third stage of the battle between two heroes' hosts: both sides' archery, Flak and Breach, then the ground's
 *  notes and each side's rows and lines, to the illusory ground's lines. */
export function bothSidesArcheryFlakAndBreachInTheBattleBetweenHeroes(
  turnContext: TurnContext,
  atk: HeroInABattle,
  def: HeroInABattle,
  prov: ProvinceInABattle,
  theSetUp: WhatTheSetUpOfTheBattleBetweenHeroesHandsOn,
  pvpFront: number,
) {
  const {
    theAttackerAsTheGuardsReadHim,
    theDefenderAsTheGuardsReadHim,
    narrative,
    _atkLA,
    atkArmies,
    defArmies,
    theAttackersRealm,
    theDefendersRealm,
    _tallyLost,
    atkSide,
    defSide,
    atkAlign2,
    defAlign2,
    pvpTerrain,
    pvpIsLand,
  } = theSetUp;
  // ════
  // PRE-BATTLE PHASE 2: ARCHERY (both sides)
  // ════
  // (`myCount`, each side's count of units, is read by nothing)
  function applyPreBattleArchery(
    heroChar: HeroInABattle,
    myForce: readonly ArmyInABattle[],
    enemyArmies: readonly ArmyInABattle[],
    myCount: unknown,
    narr: NarrativeLine[],
    isAtk: boolean,
  ) {
    // ELF — Ambush: Forest Wardens defending their own woods deny the enemy an archery phase — unless
    // Eagle Riders fly with the shooters (Eyes of the Forest).
    {
      const _eyes = eyesOfTheForestLine(enemyArmies, pvpTerrain, myForce, {
        heroName: heroChar.name,
        leaderless: false,
      });
      if (_eyes) narrate(narr, _eyes);
    }
    if (archeryBlockedBy(enemyArmies, pvpTerrain, myForce)) {
      narrate(narr, {
        kind: "the hero's archers find no target among the forest wardens",
        heroName: { heroName: heroChar.name, leaderless: false },
      });
      return;
    }
    const myMissile = abilityMissileUnits(myForce, pvpTerrain);
    if (!myMissile.length || !enemyArmies.length) return;
    const archLvl = effStat(turnContext, heroChar, 'archery');
    // the items' registry's "volley: the commander adds volleys" (plan P1-19n: the Quivers)
    const _itemVolleys = theVolleysTheCommandersItemsLoose(activeItems(heroChar));
    const hasQ = _itemVolleys.theLines.includes('each missile unit looses two volleys instead of one');
    const _manyQ = _itemVolleys.theLines.includes('each missile unit looses one more shot');
    const volleys = _itemVolleys.theVolleys;
    const _prepared = myMissile.some((a) => abilityVolleys(a, isAtk) > 1); // HUMAN — Prepared Ground: defending Longbows loose twice
    narrate(narr, {
      kind: "the hero's archery volley begins",
      heroName: heroChar.name,
      missileUnitCount: myMissile.length,
      doubleVolleys: hasQ,
      oneMoreShot: _manyQ,
      preparedGround: _prepared,
    });
    myMissile.forEach((a) => {
      for (let v = 0; v < volleys + abilityVolleys(a, isAtk) - 1; v++) {
        const pool = missileTargetPool(enemyArmies, 0, a, myForce); // winged riders first, else any random target; firer passed for Punch Through's cap; the force for Eyes of the Forest
        if (!pool.length) break;
        const t = pool[Math.floor(kcRng() * pool.length)];
        if (!t) throw new TypeError('a volley loosed at no target'); // (the pool has just been found not empty)
        const dmgMult = missileDamageMult(a, myForce, pvpTerrain, t, isAtk);
        const hit = applyMissileHit(t, archLvl, a, { dmgMult });
        if (hit.immune)
          narrate(narr, {
            kind: "a unit's shot glances off its target",
            shooterName: a.unitName || a.type,
            targetUnitName: t.unitName || t.type,
            whyTheShotGlances: hit.why,
          });
        else if (hit.dmg > 0)
          narrate(narr, {
            kind: "a unit's shot weakens its target",
            shooterName: a.unitName || a.type,
            targetUnitName: t.unitName || t.type,
            damage: hit.dmg,
            againstAFlyer: hit.isFly,
            thickHideHalvesIt: hit.thickHide,
            shootersUnitType: a.type,
            shootersAbilityMultiplier: dmgMult,
            softenedToTheLimit: hit.capped,
          });
        else
          narrate(narr, {
            kind: "a unit's target is already softened as far as arrows allow",
            shooterName: a.unitName || a.type,
            targetUnitName: t.unitName || t.type,
          });
      }
    });
  }
  // DWARF — Flak Screen runs before the arrows fly.
  applyFlakScreen(atkArmies, defArmies, { heroName: atk.name, leaderless: false }, narrative);
  applyFlakScreen(_atkLA ? [] : defArmies, atkArmies, { heroName: def.name, leaderless: false }, narrative); // Lightning Advance stops it, as against guards (R-162)
  applyPreBattleArchery(atk, atkArmies, defArmies, atkArmies.length, narrative, true);
  if (!_atkLA) applyPreBattleArchery(def, defArmies, atkArmies, defArmies.length, narrative, false);

  // ── PRIMAL — Breach and Swamp ── Whale Cohorts rise beneath a hull and roll it over. 25% per
  // cohort to sink one enemy fleet unit outright, before either side's strength is counted. The rule
  // registry's "fate: a hull is sunk before the battle" picks the hull, with the dice it is handed
  // (plan P1-19i); this sinks it and writes the line (the side whose hull sinks: the enemy's role, plan P1-12d35).
  function applyBreachAndSwamp(
    myForce: readonly (ArmyInABattle | null | undefined)[] | null | undefined,
    enemyForce: readonly (ArmyInABattle | null | undefined)[] | null | undefined,
    myName: string,
    theEnemysRole: 'attacker' | 'defender',
    narr: NarrativeLine[],
  ) {
    (myForce ?? []).forEach((a) => {
      if (!a) return;
      const hulls = (enemyForce ?? []).filter((e): e is ArmyInABattle =>
        Boolean(e && SEA_TYPES.has(e.type) && !e._died),
      );
      const at = theHullAUnitSinksBeforeTheBattle({ unitType: a.type, theEnemyHullsAfloat: hulls, theDice: kcRng });
      if (at === null) return;
      const t = hulls[at];
      if (!t) throw new TypeError('a hull sunk that is not afloat'); // (the registry picks one of the hulls handed)
      t._died = true;
      narrate(narr, {
        kind: "a side's whale cohort sinks an enemy ship",
        sideName: myName,
        targetUnitName: t.unitName || t.type,
        targetUnitType: t.type,
        theSideWhoseShipSinks: theEnemysRole,
      });
    });
  }
  applyBreachAndSwamp(atkArmies, defArmies, atk.name, 'defender', narrative);
  applyBreachAndSwamp(defArmies, atkArmies, def.name, 'attacker', narrative);
  // Remove anything sunk before strengths are counted.
  if (atkArmies.some((a) => a._died) || defArmies.some((a) => a._died)) {
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
    ); // Elven escape per side
    _tallyLost(); // splices in place below — count the sunk before they are gone
    // (a gap in either list has thrown in the filters above, so each is a unit here)
    for (let i = atkArmies.length - 1; i >= 0; i--) if (atkArmies[i]?._died) atkArmies.splice(i, 1);
    for (let i = defArmies.length - 1; i >= 0; i--) if (defArmies[i]?._died) defArmies.splice(i, 1);
    atk.armies = atkArmies;
    def.armies = defArmies;
  }

  // Terrain notes for PvP
  {
    const _ta = terrainNoteList(atkArmies, pvpTerrain),
      _td = terrainNoteList(defArmies, pvpTerrain); // 2026-09-23d: per side, one format
    if (_ta || _td)
      narrate(narrative, {
        kind: "the terrain's effect on each side",
        terrain: pvpTerrain,
        atkName: atkSide,
        unitsTheTerrainMarksOfTheAttacker: _ta,
        defName: defSide,
        unitsTheTerrainMarksOfTheDefender: _td,
      });
  }
  if (
    !pvpIsLand &&
    (atkArmies.some((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type)) ||
      defArmies.some((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type)))
  ) {
    // 2026-09-23e: flying beasts excluded
    const _airA = isAirborneAtSea(atkArmies),
      _airD = isAirborneAtSea(defArmies);
    if (_airA || _airD)
      narrate(narrative, {
        kind: 'hosts airborne over open water fight at a penalty',
        attackersHostIsAirborne: _airA,
        defendersHostIsAirborne: _airD,
        atkName: atkSide,
        defName: defSide,
        seaAirborneLandPenalty: SEA_AIRBORNE_LAND_PENALTY,
        seaAirborneFlyerPenalty: SEA_AIRBORNE_FLYER_PENALTY,
      });
    if (
      (atkArmies.some((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type)) && !_airA) ||
      (defArmies.some((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type)) && !_airD)
    )
      narrate(narrative, { kind: 'land units fight at sea at a penalty', seaLandPenalty: SEA_LAND_PENALTY });
  }

  // Battle lines for PvP — front-line width (pvpFront) is declared above as the single source of
  // truth.

  // Illusory Terrain (per-unit): a side that did NOT cast the illusion is disoriented — each unit
  // fights as though caught in the worst terrain for its kind (min −15%), folded into its
  // strength.
  const _illCasterP = prov._illusoryTerrain ? prov._illusoryTerrain.caster : null;
  const _atkIllActiveP = _illCasterP != null && atk.player !== _illCasterP;
  const _defIllActiveP = _illCasterP != null && def.player !== _illCasterP;
  // the command stage's builders, made once the two flags are set (B-06bh: a file of their own, read by H9 too)
  const { _pvpRow } = theCommandStagesBuildersOfTheBattleBetweenHeroes(turnContext, atk, def, theSetUp, {
    _atkIllActiveP,
    _defIllActiveP,
  });
  // PvP battle lines: sort by strength desc (flying first), strongest in front row. 2026-09-11:
  // each side's OWN Flanking Tactics.
  const atkFlankPvp = doARealmsDiscoveriesWeightTheLinesBehindTheFront(theAttackersRealm),
    defFlankPvp = doARealmsDiscoveriesWeightTheLinesBehindTheFront(theDefendersRealm);
  const atkSorted = [...atkArmies]
    .map((a) => _pvpRow(a, true, atkArmies, defArmies))
    .sort((x, y) => Number(y.fly) - Number(x.fly) || y.s - x.s);
  const defSorted = [...defArmies]
    .map((a) => _pvpRow(a, false, defArmies, atkArmies))
    .sort((x, y) => Number(y.fly) - Number(x.fly) || y.s - x.s);
  // Ground units fill four terrain-width lines (×1 / ×0.5 / ×0.25 / ×0.125); flyers always front.
  // `s` is the final per-unit strength — renamed into `base` once, so the totals AND the
  // narrative sort on the same figure.
  const atkRows = atkSorted.map((x) => ({ ...x, base: x.s })),
    defRows = defSorted.map((x) => ({ ...x, base: x.s }));
  battleLineTotal(atkRows, pvpFront, atkFlankPvp); // undamaged, before whole-force (2026-09-24); its total read by nothing, the call kept as it was
  battleLineTotal(defRows, pvpFront, defFlankPvp); // (the same)

  // (2026-09-23d: the standalone Archery / Naval notes are retired — the Battle-stats ladder names
  // "Archery N ×m on K units" and "Naval N ×m on K units" exactly where they apply.)

  // Druid shortfall warnings — only when a penalty actually applies (skeletal/exempt units are
  // free)
  // 2026-09-23d: one line per side (was one per unit).
  {
    const _dl = druidShortfallLine(turnContext, atkSide, atk, atkArmies, atkAlign2);
    if (_dl) narrate(narrative, _dl);
    const _dd = druidShortfallLine(turnContext, defSide, def, defArmies, defAlign2);
    if (_dd) narrate(narrative, _dd);
  }

  // Discovery bonus
  const atkDiscBonus = 1 + whatARealmsDiscoveriesAddToTheWholeArmy();
  const defDiscBonus = 1 + whatARealmsDiscoveriesAddToTheWholeArmy();
  if (atkDiscBonus > 1)
    narrate(narrative, {
      kind: "a side's realm discoveries strengthen its army",
      sideName: atkSide,
      discoveriesBonus: atkDiscBonus,
    });
  if (defDiscBonus > 1)
    narrate(narrative, {
      kind: "a side's realm discoveries strengthen its army",
      sideName: defSide,
      discoveriesBonus: defDiscBonus,
    });

  // (Illusory Terrain is applied per-unit above, folded into each side's strength.)
  if (_atkIllActiveP)
    narrate(narrative, {
      kind: "the illusory ground of the province confuses a side's forces",
      provName: prov.name,
      sideName: atkSide,
    });
  if (_defIllActiveP)
    narrate(narrative, {
      kind: "the illusory ground of the province confuses a side's forces",
      provName: prov.name,
      sideName: defSide,
    });
  return { atkFlankPvp, defFlankPvp, atkRows, defRows, atkDiscBonus, defDiscBonus, _pvpRow };
}
