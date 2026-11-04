// Hand-made battle lines (plan P1-14j, Decision 5): the rows a side brings to the battle grid, made by the test, and
// the grid's pure functions called on them directly (src/engine/battle/lines.ts), with no world, no turn and no battle.
// What the old scripts read off the booted GM portal (`battle-grid`, `battle-facing`, `battle-scout`), on the modules.
//
//   const g = battleGrid(rows([['Shieldwall Levies', 4], ['Yeoman Longbows', 2]]), 6, 'plain', { tac: 0 });
//   const r = fight([['Shieldwall Levies', 3]], [['Free Lances', 3]], 4, 'forest');   // both placed, then faced
//   r.me.face.total;                                                                    // the attacker's faced total
//   const width = withTheDice(plannedDice([0.5]), () => rollBattleWidth('forest'));     // the one draw it may make
//
// A row is a unit of a type at Average, named by its type, with its final strength (`base`): the facing's and the
// line-up's scenes take it from BASE_STRENGTH (8 for a type the table doesn't name), and a spec may give its own.
// Nothing here draws a die: the only random thing in the grid is the width's roll, which a test feeds with
// plannedDice, so it can't draw more than the test planned.
import './the-whole-engine.ts';
import { kcRng } from '../../src/engine/rng.ts';
import {
  battleFacing,
  battleGrid,
  type AFacedSide,
  type BattleGrid,
  type BattleRow,
} from '../../src/engine/battle/lines.ts';
import type { ASideOfABattle } from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';

/** The units' final strengths in the facing's and the line-up's scenes (the old scripts' tables, one table: neither
 *  scene uses a type the other gives another strength). */
export const BASE_STRENGTH: Readonly<Record<string, number | undefined>> = {
  'Shieldwall Levies': 8,
  'Yeoman Longbows': 8,
  'Free Lances': 10,
  'Warg Riders': 10,
  'Eagle Riders': 12,
  'Galleon Fleet': 9,
  'Dwarven Guard': 12,
};

/** The four winged riders: their rows carry `fly`, as the old scripts' did (the grid reads it only on a row with no
 *  unit). */
const WINGED_RIDERS: readonly string[] = ['Eagle Riders', 'Noble Griffons', 'Gnomish Gyrocopters', 'Wyvern Riders'];

/** A unit of `type` at Average, as a side's row: its final strength `base`, from BASE_STRENGTH unless given. */
export function aRow(type: string, base = BASE_STRENGTH[type] ?? 8): BattleRow {
  return { a: { type, quality: 'Average', race: '', unitName: type }, base, fly: WINGED_RIDERS.includes(type) };
}

/** So many units of a type, with their strength if the spec gives one. */
export type ASidesUnits = readonly (readonly [type: string, count: number, base?: number])[];

/** A side's rows, in the spec's order. */
export function rows(spec: ASidesUnits): BattleRow[] {
  return spec.flatMap(([type, n, base]) => Array.from({ length: n }, () => aRow(type, base)));
}

/** A grid battleFacing has faced: its `face` is there. */
export type AFacedGrid = BattleGrid & { face: AFacedSide };

/** The grid, once faced (it throws if battleFacing faced nothing, so a test can't pass on a grid it never faced). */
export function faced(g: BattleGrid): AFacedGrid {
  const face = g.face;
  if (!face) throw new Error('battleFacing faced no grid');
  return Object.assign(g, { face });
}

/** Both sides placed, each with the other as its enemy, and faced: `me` is the attacker's grid, `them` the
 *  defender's (the old `battle-facing`'s `fight`). */
export function fight(
  mine: ASidesUnits,
  theirs: ASidesUnits,
  W: number,
  terrain: string,
  tacMe = 0,
  tacThem = 0,
): { me: AFacedGrid; them: AFacedGrid } {
  const me = battleGrid(rows(mine), W, terrain, { tac: tacMe, enemy: rows(theirs), enemyTac: tacThem });
  const them = battleGrid(rows(theirs), W, terrain, { tac: tacThem, enemy: rows(mine), enemyTac: tacMe });
  battleFacing(me, them, terrain);
  return { me: faced(me), them: faced(them) };
}

/** A side as the report's lines take it: a hero's host, led. */
export const aSide = (heroName: string): ASideOfABattle => ({ heroName, leaderless: false });

/** Dice that give these numbers in turn, and throw on a draw past them. */
export function plannedDice(draws: readonly number[]): () => number {
  let next = 0;
  return () => {
    const d = draws[next];
    if (d === undefined) throw new Error(`a die drawn past the ${String(draws.length)} planned`);
    next++;
    return d;
  };
}

/** What `fn` returns with the game's dice drawn from `dice`, the dice put back after. */
export function withTheDice<T>(dice: () => number, fn: () => T): T {
  const was = kcRng.use(dice);
  try {
    return fn();
  } finally {
    kcRng.use(was);
  }
}
