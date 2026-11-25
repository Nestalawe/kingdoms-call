// The battle between two heroes' hosts (combatVsChar, src/engine/battle/battles-between-heroes.ts): the command stage's
// builders, each unit's row on the ground with its commander's Archery, Naval or Tactical and Illusory Terrain, which
// two of its stages share (H4, its archery, Flak and Breach, which makes them once Illusory Terrain's two flags are
// set, and H9's stay-or-retreat check, which combatVsChar hands them to). Moved here as they were from combatVsChar
// (B-06bh), the same statements: they read the set-up's values (each final there) and the two flags, as they did. A
// helper the stages share, in a file of its own with no anchor of the battle proof (tools/proof/README.md, section 8):
// it draws no die, and any draw below it would count under the stage that called it.
import { tacMulted } from '../../units/movement.ts';
import { SEA_TYPES } from '../../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { illusoryTerrainMult, ladderRow } from '../terrain-and-unit-strength.ts';
import type { TurnContext } from '../../turn/context.ts';
import type { ArmyInABattle, HeroInABattle } from '../../army-tables.ts';
import type { CommandMultiplier } from '../terrain-and-unit-strength.ts';
import type { WhatTheSetUpOfTheBattleBetweenHeroesHandsOn } from './h3-both-sides-pre-battle-magic-and-army-spells.ts';

/** Illusory Terrain's two flags, as H4 sets them: whether each side fights disoriented on the illusory ground. */
export interface TheIllusoryTerrainsFlagsInTheBattleBetweenHeroes {
  _atkIllActiveP: boolean;
  _defIllActiveP: boolean;
}

/** The command stage's builders of the battle between two heroes' hosts, made once Illusory Terrain's flags are set:
 *  each unit's context, its commander's multipliers and its row on the ground. They draw no die. */
export function theCommandStagesBuildersOfTheBattleBetweenHeroes(
  turnContext: TurnContext,
  atk: HeroInABattle,
  def: HeroInABattle,
  theSetUp: WhatTheSetUpOfTheBattleBetweenHeroesHandsOn,
  theIllusoryTerrainsFlags: TheIllusoryTerrainsFlagsInTheBattleBetweenHeroes,
) {
  const {
    atkTact,
    defTact,
    atkTactBonus,
    defTactBonus,
    _fearAtk,
    _fearDef,
    MISSILE_A,
    atkArch,
    atkArchBonus,
    defArch,
    defArchBonus,
    atkNav,
    atkNavBonus,
    defNav,
    defNavBonus,
    atkAlign2,
    defAlign2,
    pvpTerrain,
    pvpIsLand,
    _pvpCoastal,
  } = theSetUp;
  const { _atkIllActiveP, _defIllActiveP } = theIllusoryTerrainsFlags;
  // 2026-09-23b: pvpArmStr split into ctx + command-stage builders so the battle rows, the strength
  // ladder and the stay-or-retreat check all use ONE definition. Per unit: armStr (terrain, kin,
  // Bulwark…) × Archery (missile units) × Naval (fleets) or Tactical (land and air units — flyers
  // since 2026-09-23c; land battles only) × Illusory Terrain.
  function _pvpCtx(isAtk: boolean, force: readonly ArmyInABattle[], enemy: readonly ArmyInABattle[]) {
    return {
      force,
      enemyForce: enemy,
      isAttacker: isAtk,
      amphibious: isAtk && !!atk._amphibiousAssault,
      coastal: _pvpCoastal,
      reignOfFear: isAtk ? _fearAtk : _fearDef,
    };
  }
  function _pvpCmd(a: ArmyInABattle, isAtk: boolean) {
    const hero = isAtk ? atk : def,
      cmd: CommandMultiplier[] = [];
    const arch = isAtk ? atkArch : defArch,
      archB = isAtk ? atkArchBonus : defArchBonus;
    if (MISSILE_A.has(a.type))
      cmd.push({ key: 'arch', reason: { kind: 'archery', level: arch, multiplier: archB }, m: archB });
    const isSea = SEA_TYPES.has(a.type);
    if (isSea) {
      const nv = isAtk ? atkNav : defNav,
        nb = isAtk ? atkNavBonus : defNavBonus;
      cmd.push({ key: 'nav', reason: { kind: 'naval', level: nv, multiplier: nb }, m: nb });
    } else if (pvpIsLand) {
      const tm = tacMulted(isAtk ? atkTactBonus : defTactBonus, hero);
      cmd.push({
        key: 'tac',
        reason: { kind: 'tactical at its level', level: isAtk ? atkTact : defTact, multiplier: tm },
        m: tm,
      });
    }
    if (isAtk ? _atkIllActiveP : _defIllActiveP)
      cmd.push({
        key: 'ill',
        reason: { kind: 'illusory terrain', multiplier: illusoryTerrainMult(a.type) },
        m: illusoryTerrainMult(a.type),
      });
    return cmd;
  }
  function _pvpRow(a: ArmyInABattle, isAtk: boolean, force: readonly ArmyInABattle[], enemy: readonly ArmyInABattle[]) {
    return ladderRow(
      turnContext,
      a,
      isAtk ? atk : def,
      isAtk ? atkAlign2 : defAlign2,
      pvpTerrain,
      _pvpCtx(isAtk, force, enemy),
      _pvpCmd(a, isAtk),
    );
  }

  return { _pvpCtx, _pvpCmd, _pvpRow };
}
