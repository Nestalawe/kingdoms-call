// The battle grid (R-089, battle lines I: rows and columns; plan P1-14j, the old `battle-grid` script): where each unit
// stands and at what multiplier, on rows made by the test (tests/lib/hand-made-battle-lines.ts).
//   • battleRole: the four winged riders and the flying beasts fight from the air, cavalry are cavalry (but foot at
//     sea), ranged units are ranged, everything else is foot, and a row with no unit falls back on its `fly` flag;
//   • battleGrid: ranged units behind a fighter shoot over it at ×1, in an empty front place at ×0.75; the second line
//     otherwise ×0.5, the reserve ×0.25 then ×0.125 (Flanking Tactics' lines when `flank`); Tactical + 1 cavalry ride
//     the flanks on plains and desert only (Tactical counted to 5); winged riders are capped at the enemy's units in
//     line and in the air, never below 2, ×0.5 beyond; at sea the hulls hold the front and there is no flank; every
//     row is stamped `_g`, its army is not;
//   • rollBattleWidth stays inside the ground's range (each width from its band of the die, and 300 rolls on dice from
//     KC_SEED reach every width); battleFrontWidth is the middle of it;
//   • battleGridLines and battleGridStage print the grid and the ladder's stage; battleWidthLine's words name the
//     ground; battleLineTotal (the bots' entry point) is the grid's total.
// The old script booted the GM portal to call these as its globals; "the GM portal boots" and "X() is declared at
// module level" are the imports now, and "no page errors" is this file throwing nothing (an unexpected console.error
// fails it: tests/setup/each.ts).
// Level 1 (unit): pure functions of the rows, the width and the ground, called on the engine's modules. Not static: it
// runs the placing. Not a scenario: a battle would only add its dice on top.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The battle grid (R-089; `battleGrid`, `src/engine/battle/lines.ts`, on hand-made rows): roles by unit type; ranged
// units behind a fighter shoot over it at ×1 and fill an empty front place at ×0.75; spare units ×0.5 / ×0.25 / ×0.125
// (Flanking Tactics lifts them, to exactly 57 for eight Levies); Tactical + 1 cavalry on the flanks of plains and
// desert only; winged riders capped at the enemy's units in line and in the air, never below 2; hulls hold a sea front
// and there is no flank; the width roll stays in its ground's range (planned dice and 300 seeded rolls) and
// `battleFrontWidth` is the middle; the grid print, the ladder stage and the width line's words. Level 1: pure
// functions of the rows; a battle would only add its dice
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { kcRngStream } from '../../src/engine/rng.ts';
import {
  BATTLE_FRONT_RANGE,
  battleFrontWidth,
  battleGrid,
  battleGridLines,
  battleLineTotal,
  battleRole,
  battleWidthLine,
  rollBattleWidth,
  type BattleGrid,
} from '../../src/engine/battle/lines.ts';
import { battleGridStage } from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { aRow, aSide, plannedDice, rows, withTheDice } from '../lib/hand-made-battle-lines.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** The grid print of a side, in words (a side as the lines take it: a record since P1-12d30). */
const lines = (heroName: string, g: BattleGrid, defender: boolean) =>
  battleGridLines(aSide(heroName), g, defender).map(theWordsOf);
const typeOf = (u: BattleGrid['units'][number]) => u.row.a?.type;

describe("battleRole: a unit's part in the line", () => {
  test('ranged, cavalry (foot at sea), the winged riders and the flying beasts, the walking beasts and the rest', () => {
    expect(battleRole(aRow('Yeoman Longbows'), 'plain'), 'Yeoman Longbows are ranged').toBe('arc');
    expect(battleRole(aRow('Free Lances'), 'plain'), 'Free Lances are cavalry on land').toBe('cav');
    expect(battleRole(aRow('Free Lances'), 'sea'), '…and foot at sea').toBe('foot');
    expect(battleRole(aRow('Eagle Riders'), 'forest'), 'Eagle Riders fly').toBe('fly');
    // 2026-10-13, the beast abilities: the flying beasts held a place like foot before.
    expect(battleRole(aRow('Crimson Rocs'), 'plain'), 'Crimson Rocs (a flying beast) fight from the air').toBe('fly');
    expect(battleRole(aRow('Forest Ents'), 'plain'), 'Forest Ents (a walking beast) hold a place like foot').toBe(
      'foot',
    );
    expect(battleRole(aRow('Goblin Horde'), 'plain'), 'Goblins are foot').toBe('foot');
    expect(battleRole(aRow('Human Garrison'), 'plain'), 'garrisons are foot').toBe('foot');
    expect(battleRole(aRow('Galleon Fleet'), 'sea'), 'fleets are foot').toBe('foot');
    expect(battleRole(aRow('Light Infantry'), 'plain'), 'an unknown type is foot').toBe('foot');
  });

  test('a row with no unit uses its fly flag', () => {
    expect(battleRole({ fly: true, base: 5 }, 'plain')).toBe('fly');
    expect(battleRole({ fly: false, base: 5 }, 'plain')).toBe('foot');
  });
});

describe('ranged units behind a fighter shoot over it at full; in an empty front place at ×0.75', () => {
  test('4 Levies and 2 Longbows, a front of 6: every unit at ×1, the Longbows in the second line', () => {
    const g = battleGrid(
      rows([
        ['Shieldwall Levies', 4],
        ['Yeoman Longbows', 2],
      ]),
      6,
      'plain',
      { tac: 0 },
    );
    expect(g.total).toBeCloseTo(48, 6);
    const bows = g.units.filter((u) => typeOf(u) === 'Yeoman Longbows');
    expect(bows).toHaveLength(2);
    for (const u of bows) expect([u.place, u.mult], 'both Longbows in the second line at ×1').toEqual(['second', 1]);
    g.second.forEach((x, c) => {
      if (!x) return;
      const fighter = g.front[c];
      expect(fighter, `the archer in column ${String(c)} has a fighter in front of it`).toBeTruthy();
      expect(fighter?.role).not.toBe('arc');
    });
  });

  test('2 Levies and 4 Longbows: two shoot over at ×1, two fill the front at ×0.75 → 44', () => {
    const g = battleGrid(
      rows([
        ['Shieldwall Levies', 2],
        ['Yeoman Longbows', 4],
      ]),
      6,
      'plain',
      { tac: 0 },
    );
    expect(g.total).toBeCloseTo(44, 6);
    expect(g.units.filter((u) => u.place === 'front' && u.mult === 0.75)).toHaveLength(2);
  });
});

describe('spare units: the second line ×0.5, the reserve ×0.25, the deep reserve ×0.125; Flanking Tactics lifts them', () => {
  test('8 Levies, a front of 6: 6 at ×1 and 2 at ×0.5 = 56', () => {
    expect(battleGrid(rows([['Shieldwall Levies', 8]]), 6, 'plain', { tac: 0 }).total).toBeCloseTo(56, 6);
  });

  test('with Flanking Tactics the two behind fight at more than ×0.5 (its second line, ×0.5625: 57)', () => {
    const t = battleGrid(rows([['Shieldwall Levies', 8]]), 6, 'plain', { tac: 0, flank: true }).total;
    expect(t).toBeGreaterThan(56);
    expect(t).toBeLessThan(60);
    expect(t, "exactly the data file's second line (stricter than the old script's range)").toBeCloseTo(57, 6);
  });

  test('20 Levies: 48 + 24 + 12 + 2 = 86; six in the reserve at ×0.25 and two deeper at ×0.125', () => {
    const g = battleGrid(rows([['Shieldwall Levies', 20]]), 6, 'plain', { tac: 0 });
    expect(g.total).toBeCloseTo(86, 6);
    expect(g.reserve).toHaveLength(8);
    expect(g.units.filter((u) => u.place === 'reserve' && u.mult === 0.125)).toHaveLength(2);
  });
});

describe('the flanks: Tactical + 1 cavalry on open ground only, Tactical counted to 5', () => {
  const lancesAndLevies = () =>
    rows([
      ['Free Lances', 3, 10],
      ['Shieldwall Levies', 4, 8],
    ]);

  test('Tactical 1 on plains: two Free Lances on the flanks, one in the front → 62; the riders take no front place', () => {
    const g = battleGrid(lancesAndLevies(), 6, 'plain', { tac: 1 });
    expect(g.flanks).toHaveLength(2);
    expect(g.total).toBeCloseTo(62, 6);
    expect(g.front.filter(Boolean), 'five in the front').toHaveLength(5);
  });

  test('in forest no flank: six in the front and one Levy behind at ×0.5 → 58', () => {
    const g = battleGrid(lancesAndLevies(), 6, 'forest', { tac: 5 });
    expect(g.flanks).toHaveLength(0);
    expect(g.total).toBeCloseTo(58, 6);
  });

  test('Tactical is counted to 5 (six flank places at most); Tactical 0 or none still has one', () => {
    expect(battleGrid(rows([['Free Lances', 8, 10]]), 6, 'desert', { tac: 9 }).flanks).toHaveLength(6);
    expect(battleGrid(rows([['Free Lances', 8, 10]]), 6, 'plain', { tac: -3 }).flanks).toHaveLength(1);
  });
});

describe("winged riders: capped at the enemy's units in line and in the air, never below 2", () => {
  const eagles = () => rows([['Eagle Riders', 6, 12]]);

  test('6 Eagles against 2 Levies: one on the open flank at ×1, cap 2 for the five in the air → 54', () => {
    // 2026-10-11 (Toby, the unit abilities: Stoop on the Horses): on open ground an Eagle holds a flank slot no rider
    // fills, at ×1 and outside the cap; the cap still counts the enemy's units in line and in the air.
    const g = battleGrid(eagles(), 6, 'plain', { enemy: rows([['Shieldwall Levies', 2]]) });
    expect(g.cap).toBe(2);
    expect(g.flanks).toHaveLength(1);
    expect(g.flanks[0]?.role).toBe('fly');
    expect(g.total).toBeCloseTo(54, 6);
  });

  test('in forest no Eagle takes a flank: cap 2, two at ×1 and four at ×0.5 → 48', () => {
    const g = battleGrid(eagles(), 6, 'forest', { enemy: rows([['Shieldwall Levies', 2]]) });
    expect(g.flanks).toHaveLength(0);
    expect(g.total).toBeCloseTo(48, 6);
  });

  test("the cap is never below 2; against 6 Eagles all six fight at ×1; the enemy's flank riders count", () => {
    expect(battleGrid(eagles(), 6, 'plain', { enemy: rows([['Shieldwall Levies', 1]]) }).cap).toBe(2);
    const even = battleGrid(eagles(), 6, 'plain', { enemy: rows([['Eagle Riders', 6, 12]]) });
    expect(even.cap).toBe(6);
    expect(even.total).toBeCloseTo(72, 6);
    const withRiders = battleGrid(eagles(), 6, 'plain', {
      enemy: rows([
        ['Shieldwall Levies', 3],
        ['Free Lances', 2, 10],
      ]),
      enemyTac: 1,
    });
    expect(withRiders.cap, '3 in line + 2 on the flanks').toBe(5);
  });

  test('with no enemy known (the bots) flyers are uncapped; flyers take no place in the front', () => {
    expect(battleGrid(eagles(), 6, 'plain', {}).total).toBeCloseTo(72, 6);
    const g = battleGrid(
      rows([
        ['Eagle Riders', 2, 12],
        ['Shieldwall Levies', 6],
      ]),
      6,
      'plain',
      {},
    );
    expect(g.front.filter(Boolean)).toHaveLength(6);
  });
});

describe('at sea: the hulls first in the front, no flanks, cavalry fight as foot', () => {
  test('three in the front, no flanks → 27; the hull holds the centre', () => {
    const g = battleGrid(
      rows([
        ['Shieldwall Levies', 1, 8],
        ['Free Lances', 1, 10],
        ['Galleon Fleet', 1, 9],
      ]),
      8,
      'sea',
      { tac: 5 },
    );
    expect(g.flanks).toHaveLength(0);
    expect(g.front.filter(Boolean)).toHaveLength(3);
    expect(g.total).toBeCloseTo(27, 6);
    const centre = g.units
      .filter((u) => u.place === 'front')
      .sort((a, b) => Math.abs(a.col - 3.5) - Math.abs(b.col - 3.5))[0];
    expect(centre && typeOf(centre)).toBe('Galleon Fleet');
  });
});

describe("the stamps, an unknown type, and the bots' entry point", () => {
  test('an unknown type holds the front; the row carries _g, the army does not', () => {
    const g = battleGrid(rows([['Light Infantry', 2, 8]]), 4, 'mountain', {});
    expect(g.units).toHaveLength(2);
    for (const u of g.units) {
      expect([u.place, u.mult]).toEqual(['front', 1]);
      expect(u.row._g?.place).toBe('front');
      expect(u.row.a && '_g' in u.row.a, 'the army carries no _g').toBe(false);
    }
  });

  test("battleLineTotal is the grid's total", () => {
    expect(battleLineTotal(rows([['Shieldwall Levies', 8]]), 6, false, { terrain: 'plain' })).toBeCloseTo(56, 6);
  });
});

describe("the width's roll and the middle", () => {
  const RANGES = {
    plain: [6, 8],
    desert: [6, 8],
    sea: [8, 10],
    forest: [4, 6],
    jungle: [4, 6],
    mountain: [2, 4],
  } as const;

  test('each width of the range comes from its band of the die, and the roll is one draw', () => {
    for (const [ground, [low, high]] of Object.entries(RANGES)) {
      const n = high - low + 1;
      for (let k = 0; k < n; k++) {
        expect(
          withTheDice(plannedDice([(k + 0.5) / n]), () => rollBattleWidth(ground)),
          `${ground}, band ${String(k)}`,
        ).toBe(low + k);
      }
      expect(
        withTheDice(plannedDice([0]), () => rollBattleWidth(ground)),
        `${ground}: the lowest die`,
      ).toBe(low);
      expect(
        withTheDice(plannedDice([0.999999]), () => rollBattleWidth(ground)),
        `${ground}: the highest`,
      ).toBe(high);
    }
  });

  test("300 rolls on the seed's dice stay within each range and reach every width", () => {
    const dice = kcRngStream(SEED);
    for (const [ground, [low, high]] of Object.entries(RANGES)) {
      const seen = new Set<number>();
      withTheDice(dice, () => {
        for (let i = 0; i < 300; i++) seen.add(rollBattleWidth(ground));
      });
      const widths = [...seen].sort((a, b) => a - b);
      expect(widths, `${ground}: 300 rolls`).toEqual(Array.from({ length: high - low + 1 }, (_, k) => low + k));
    }
  });

  test("the tables' ranges are the ones above", () => {
    expect(BATTLE_FRONT_RANGE).toEqual(RANGES);
  });

  test('battleFrontWidth is the middle of each range (7 / 5 / 3 / 9)', () => {
    expect(battleFrontWidth('plain')).toBe(7);
    expect(battleFrontWidth('forest')).toBe(5);
    expect(battleFrontWidth('mountain')).toBe(3);
    expect(battleFrontWidth('sea')).toBe(9);
  });
});

describe("the grid's print, the ladder's stage and the width line", () => {
  const g = () =>
    battleGrid(
      rows([
        ['Shieldwall Levies', 4],
        ['Yeoman Longbows', 2],
        ['Free Lances', 1, 10],
        ['Eagle Riders', 1, 12],
      ]),
      6,
      'plain',
      { tac: 0 },
    );

  test('two 📊 grid lines a side; the attacker prints 1st then 2nd, the defender 2nd then 1st, so the fronts meet', () => {
    const grid = g();
    const L = lines('Aldric the Bold', grid, false);
    const D = lines('Gorbash', grid, true);
    expect(L).toHaveLength(2);
    for (const l of L) {
      expect(l.startsWith('📊')).toBe(true);
      expect(l).toContain('│');
    }
    expect(L[0], 'labelled by the first word of the name').toMatch(/^📊 Aldric {3}1st │/);
    expect(L[1]).toMatch(/^📊 Aldric {3}2nd │/);
    expect(D[0]).toMatch(/2nd/);
    expect(D[1]).toMatch(/1st/);
    expect(L[0], 'flank riders and flyers are named on the front line').toMatch(/flanks: FreeL/);
    expect(L[0]).toMatch(/air: Eagl/);
    expect(L[1], 'the Longbows appear in the second line').toMatch(/Bow/);
    expect(L[0], '…not the front').not.toMatch(/Bow/);
  });

  test('the ladder stage groups every unit by place and multiplier', () => {
    const s = battleGridStage(g());
    expect(s).toMatch(/front ×1: /);
    expect(s).toMatch(/second ×1: Bow, Bow/);
    expect(s).toMatch(/flank ×1: FreeL/);
  });

  test('the width line names the ground and the front; mountains and open water have their own words', () => {
    expect(theWordsOf(battleWidthLine('forest', 7))).toMatch(/the forest allows a front of 7/);
    expect(theWordsOf(battleWidthLine('plain', 8))).toMatch(/the open ground allows a front of 8/);
    expect(theWordsOf(battleWidthLine('mountain', 3))).toMatch(/the mountains allow a front of 3/);
    expect(theWordsOf(battleWidthLine('sea', 9))).toMatch(/the open water allows a front of 9/);
  });
});
