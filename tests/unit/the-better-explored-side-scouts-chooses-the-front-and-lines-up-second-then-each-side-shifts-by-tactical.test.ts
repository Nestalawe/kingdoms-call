// The scout's advantage and the line-up (R-091, battle lines III; plan P1-14j, the old `battle-scout` script), on rows
// made by the test (tests/lib/hand-made-battle-lines.ts).
//   • battleScout: the higher exploration scouts; a tie goes to the defender.
//   • battleWidthChoices: the roll and one either side, clipped to the ground's range.
//   • battleDeploy: the scout takes the width that suits it best; it lines up second (free improving swaps); then the
//     commanders take turns, the other side first, one swap per Tactical level, and no swap is made that does not
//     help. A swap keeps the front one block of the same kinds (battleLegal), and since item 18 (2026-10-12) a
//     defender can no longer slide its line along to wrap an end (the-two-front-lines-always-face-each-other-…).
//   • the report's two lines (since item 17, 2026-10-13, the Scouting line names the better-explored side without any
//     exploration figure); the same inputs give the same line-up; twenty deploys of 12 against 12 stay under 4 s.
// 2026-10-11 (Toby, the unit abilities, R-095): the line-up scene's units bring their abilities to its figures:
// Shieldwall (a Levy with the Longbow behind it ×1.25, wrapping or not), Bodkin Points (the Longbow shoots cavalry at
// ×1) and Spear Hedge (the Free Lance facing a Levy at ×0.75). The choices the deploy makes are the same; each
// expectation shows the sum. The old script booted the GM portal to call these as its globals; "the GM portal boots"
// and "X() is declared at module level" are the imports now, and "no page errors" is this file throwing nothing (an
// unexpected console.error fails it: tests/setup/each.ts).
// Level 1 (unit): who scouts, which width it picks and how the lines shift are pure functions of the two finished
// sides, the ground and the roll, called on the engine's modules, with no dice. Not a scenario: a battle would only
// add its dice on top.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The scout's advantage and the line-up (R-091; `battleDeploy`, `src/engine/battle/lines.ts`, on hand-made rows): the
// higher exploration scouts (ties to the defender); the width on offer is the roll and one either side within the
// ground's range; the scout takes the width that suits it; it lines up second with improving swaps; the commanders
// then take turns, the other side first, one swap per Tactical level; a legal swap keeps the front one block of the
// same kinds, and a defender can't slide its line along to wrap an end; the two report lines (the Scouting line names
// the better-explored side without any exploration figure); the same inputs give the same line-up; twenty deploys of
// 12 v 12 stay under 4 s. Level 1: pure functions of the two sides; a battle would only add its dice
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  battleDeploy,
  battleGrid,
  battleLegal,
  battleMovesLine,
  battleScout,
  battleScoutLine,
  battleWidthChoices,
  type ABattlesDeployment,
  type BattleGrid,
} from '../../src/engine/battle/lines.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { aSide, rows, type ASidesUnits } from '../lib/hand-made-battle-lines.ts';

type AScoutingSidesDeployment = Pick<ABattlesDeployment, 'scout' | 'W' | 'roll' | 'lineup'>;
const scoutLine = (d: AScoutingSidesDeployment, atk: string, def: string, explAtk: number, explDef: number) =>
  theWordsOf(battleScoutLine(d, aSide(atk), aSide(def), explAtk, explDef));
const movesLine = (d: Pick<ABattlesDeployment, 'scout' | 'moves'>, atk: string, def: string) => {
  const line = battleMovesLine(d, aSide(atk), aSide(def));
  return line === null ? null : theWordsOf(line);
};
/** The front's units by the last word of their type, '·' for an empty place. */
const front = (g: BattleGrid) => g.front.map((x) => (x ? (x.r.a?.type.split(' ').pop() ?? '?') : '·')).join(' ');
/** A grid's faced total. */
const total = (g: BattleGrid) => {
  if (!g.face) throw new Error('the deploy faced no grid');
  return g.face.total;
};

describe('who scouts, and which widths are on offer', () => {
  test('the higher exploration scouts; a tie goes to the defender', () => {
    expect(battleScout(60, 20)).toBe('atk');
    expect(battleScout(20, 60)).toBe('def');
    expect(battleScout(50, 50)).toBe('def');
    expect(battleScout(0, 0)).toBe('def');
  });

  test("the roll and one either side, clipped to the ground's range", () => {
    expect(battleWidthChoices('plain', 6)).toEqual([6, 7]);
    expect(battleWidthChoices('plain', 7)).toEqual([6, 7, 8]);
    expect(battleWidthChoices('mountain', 4)).toEqual([3, 4]);
    expect(battleWidthChoices('sea', 10)).toEqual([9, 10]);
    expect(battleWidthChoices('forest', 4)).toEqual([4, 5]);
  });
});

describe('the width: eight Levies against four on the plains, roll 7', () => {
  const eightAgainstFour = (scout: 'atk' | 'def') =>
    battleDeploy(rows([['Shieldwall Levies', 8]]), rows([['Shieldwall Levies', 4]]), {
      terrain: 'plain',
      roll: 7,
      tacA: 0,
      tacD: 0,
      scout,
    });

  test('the wider attacker, scouting, widens the front to 8: four Levies wrap the ends, 70.4 against 30.4', () => {
    const d = eightAgainstFour('atk');
    expect(d.W).toBe(8);
    expect(total(d.gA)).toBeCloseTo(70.4, 6);
    expect(total(d.gD)).toBeCloseTo(30.4, 6);
    expect([d.lineup, d.moves.scout, d.moves.other], 'identical units have nothing to gain from a swap').toEqual([
      0, 0, 0,
    ]);
  });

  test('the narrower defender, scouting, narrows the front to 6: two Levies wrap, two stand behind at ×0.5 → 59.2', () => {
    const d = eightAgainstFour('def');
    expect(d.W).toBe(6);
    expect(total(d.gA)).toBeCloseTo(59.2, 6);
  });
});

describe('lining up second: the archer moves to shoot the infantry, not the horse (forest, roll 4, no flanks)', () => {
  const A: ASidesUnits = [
    ['Shieldwall Levies', 2],
    ['Yeoman Longbows', 1],
  ];
  const D: ASidesUnits = [
    ['Free Lances', 1],
    ['Shieldwall Levies', 1],
  ];
  const deploy = (scout: 'atk' | 'def', tacA: number) =>
    battleDeploy(rows(A), rows(D), { terrain: 'forest', roll: 4, tacA, tacD: 0, scout });

  test('the scouting attacker keeps the roll and shifts its Longbow behind the Levy that faces the enemy Levy: 29.2 v 15.5', () => {
    const d = deploy('atk', 0);
    expect(d.W, 'a front of 4 and 5 serve the attacker alike, so the roll stands').toBe(4);
    // That Levy's Shieldwall 10 + the ×1.25 shot 10 + the Levy facing the horse 9.2 = 29.2 (behind the other it would
    // be 11.5 + 8 + 8), against 15.5 (Spear Hedge 7.5 + 8).
    expect(d.lineup).toBeGreaterThanOrEqual(1);
    expect(total(d.gA)).toBeCloseTo(29.2, 6);
    expect(total(d.gD)).toBeCloseTo(15.5, 6);
    const bow = d.gA.units.find((u) => u.row.a?.type === 'Yeoman Longbows');
    expect(bow?.place, 'the Longbow stands in the second line').toBe('second');
    expect(bow && d.gD.front[bow.col]?.r.a?.type, '…in the column of the enemy Levy').toBe('Shieldwall Levies');
    expect(bow?.row._faced?.kind, 'the stamps are those of the final layout').toBe('shoots');
  });

  // The same armies with the defender scouting. Before 2026-10-12 it slid its two units one place along, so its Free
  // Lance wrapped the attacker's end while an attacking Levy stood with nobody opposite; since Toby's item 18 the
  // fronts must meet, so it holds its line, and the attacker spends its one Tactical move on the Longbow.
  test('the defender may not slide its line along: it holds, both fronts in the same columns', () => {
    const d = deploy('def', 1);
    expect(d.lineup).toBe(0);
    expect(d.gA.front.map(Boolean)).toEqual(d.gD.front.map(Boolean));
    expect(total(d.gD)).toBeCloseTo(15.5, 6);
  });

  test('the attacker answers with its Tactical move, the Longbow behind the Levy that faces the enemy Levy: 27.5 → 29.2', () => {
    const d = deploy('def', 1);
    expect(d.moves).toEqual({ other: 1, scout: 0 });
    expect(total(d.gA)).toBeCloseTo(29.2, 6);
  });

  test('without Tactical the attacker cannot answer (27.5), and the report has no Tactics line', () => {
    const d = deploy('def', 0);
    expect(d.lineup).toBe(0);
    expect(d.moves.other).toBe(0);
    expect(total(d.gA)).toBeCloseTo(27.5, 6);
    expect(movesLine(d, 'Aldric', 'Gorbash')).toBeNull();
  });

  test('the same inputs give the same line-up', () => {
    expect(front(deploy('def', 0).gA)).toBe(front(deploy('def', 0).gA));
  });
});

describe('what a legal swap is', () => {
  test('a fresh grid is legal; a gap in the front is not; the whole block may shift; an archer may not take a fighter’s place', () => {
    const g = battleGrid(
      rows([
        ['Shieldwall Levies', 3],
        ['Yeoman Longbows', 1],
      ]),
      4,
      'plain',
      { tac: 0 },
    );
    const swap = (a: 'front' | 'second', b: number, c: 'front' | 'second', d: number) => {
      const t = g[a][b];
      g[a][b] = g[c][d];
      g[c][d] = t;
    };
    expect(battleLegal(g), 'a fresh grid').toBe(true);
    swap('front', 2, 'front', 3);
    expect(battleLegal(g), 'a gap in the front').toBe(false);
    swap('front', 2, 'front', 3);
    swap('front', 0, 'front', 3);
    expect(battleLegal(g), 'the whole block shifted along').toBe(true);
    swap('front', 0, 'front', 3);
    const bowCol = g.second.findIndex(Boolean);
    expect(bowCol).toBeGreaterThanOrEqual(0);
    swap('front', 0, 'second', bowCol);
    expect(battleLegal(g), "an archer in a fighter's place").toBe(false);
    swap('front', 0, 'second', bowCol);
    expect(battleLegal(g), '…and the grid is as it was').toBe(true);
  });
});

describe("the report's lines", () => {
  // 2026-10-13 (item 17, Toby): the line names the better-explored side but never the exploration figures: a realm
  // must not learn its rival's exploration of the province from a battle report.
  const quiet = { lineup: 0, moves: { scout: 0, other: 0 } };

  test('the scouting line: who, why, the width and the adjustments', () => {
    expect(scoutLine({ scout: 'atk', W: 7, roll: 6, lineup: 2 }, 'Aldric', 'Gorbash', 60, 20)).toBe(
      "📊 Scouting — Aldric knows the ground better (Aldric's side has explored more of it than Gorbash's): Aldric widens the front from 6 to 7 and lines up second (2 adjustments).",
    );
  });

  test("a tie: the defender's claim stands", () => {
    expect(scoutLine({ scout: 'def', W: 5, roll: 5, ...quiet }, 'Aldric', 'Gorbash', 50, 50)).toBe(
      "📊 Scouting — Gorbash knows the ground as well as the enemy (neither side has explored more of it), and the defender's claim stands: Gorbash takes the front of 5 the dice allow and lines up second.",
    );
  });

  test('no exploration figure appears in the line, whoever scouts', () => {
    for (const [a, b] of [
      [60, 20],
      [20, 60],
      [50, 50],
      [100, 99.6],
      [0, 0],
    ] as const) {
      const line = scoutLine({ scout: a > b ? 'atk' : 'def', W: 5, roll: 5, ...quiet }, 'Aldric', 'Gorbash', a, b);
      expect(line, `${String(a)} against ${String(b)}`).not.toMatch(/\d+%|explored \d/);
    }
  });

  test('…or narrows it', () => {
    expect(scoutLine({ scout: 'def', W: 3, roll: 4, lineup: 1 }, 'Aldric', 'Gorbash', 10, 100)).toMatch(
      /narrows the front from 4 to 3/,
    );
  });

  test('the Tactics line: the other side first; and a side that could not improve its line', () => {
    expect(movesLine({ scout: 'atk', moves: { scout: 1, other: 2 } }, 'Aldric', 'Gorbash')).toBe(
      '📊 Tactics — Gorbash shifts the line twice; Aldric shifts the line once.',
    );
    expect(movesLine({ scout: 'def', moves: { scout: 3, other: 0 } }, 'Aldric', 'Gorbash')).toBe(
      '📊 Tactics — Aldric holds the line as it stands; Gorbash shifts the line 3 times.',
    );
  });
});

describe('the cost: a deploy of two mixed hosts with Tactical 3 each stays cheap', () => {
  test('twenty deploys of 12 against 12 with Tactical 3 each take under 4 s, and both grids come back faced', () => {
    const big = rows([
      ['Shieldwall Levies', 5],
      ['Yeoman Longbows', 3],
      ['Free Lances', 2],
      ['Eagle Riders', 2],
    ]);
    const foe = rows([
      ['Dwarven Guard', 4],
      ['Warg Riders', 3],
      ['Yeoman Longbows', 3],
      ['Shieldwall Levies', 2],
    ]);
    const t0 = performance.now();
    let last: ABattlesDeployment | null = null;
    for (let i = 0; i < 20; i++)
      last = battleDeploy(big, foe, { terrain: 'plain', roll: 7, tacA: 3, tacD: 3, scout: 'atk' });
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(4000);
    expect(last?.gA.face).toBeTruthy();
    expect(last?.gD.face).toBeTruthy();
    expect(last?.gA.units.length).toBe(12);
    for (const u of last?.gA.units ?? []) expect(u.row._faced, 'each of the attacker’s rows is faced').toBeTruthy();
  });
});
