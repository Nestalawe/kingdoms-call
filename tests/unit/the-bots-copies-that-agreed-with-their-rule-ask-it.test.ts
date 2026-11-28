// The bots' copies of three rules that agreed with them (the practice chance by level, whether a host can fly, the hex
// distance with the map's east-west wrap) are gone: the bots ask the rule. Each case below holds the old copy's answer
// as a literal oracle (the table the copy restated, its walk over the flyers, its distance formula) and checks the
// bots' calls against it, on every input the bots can pass.
//
// Level 1 (unit): `theSoloChanceAt`, `botAirStrike` and `botEmpireDiameter` are called directly on the engine's
// modules (no world, no vm loader, no dice). A rule the bots no longer copy can't drift from them, but a call that
// is dropped or given the wrong world does: each case reads red on a fault planted in its call. Seed-free: it
// holds under any KC_SEED.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { theSoloChanceAt } from '../../src/engine/bots/economy.ts';
import { botAirStrike } from '../../src/engine/bots/missions.ts';
import { botEmpireDiameter } from '../../src/engine/bots/strategy.ts';

// the table the bots restated (case 'practice'): the solo chance by level, read from level 4 for every level above
const THE_OLD_COPYS_TABLE = [0.25, 0.2, 0.15, 0.1, 0.05];

describe("the practice chance the bots plan on is the turn's table", () => {
  test("every level the bots pass gives the old copy's figure, and a level below 0 gives none (NaN)", () => {
    for (const level of [0, 1, 2, 3, 4, 5, 6, 9]) {
      expect(theSoloChanceAt(level), `level ${String(level)}`).toBe(Number(THE_OLD_COPYS_TABLE[Math.min(4, level)]));
    }
    expect(theSoloChanceAt(-1), 'level -1').toBeNaN();
  });
});

describe("whether a host can fly is the rule's answer, asked in the air strike", () => {
  // A column that can't take to the air leaves at once; one that can goes on to read the world, which this case
  // leaves out, so the call throws there: that tells the two apart without a world.
  const strike = (armies: readonly { type: string }[]) => () =>
    botAirStrike({} as never, 0, { armies } as never, {} as never, 10, {} as never, 3);
  test('a column of two winged riders and a foot company flies, and goes on to read the world', () => {
    expect(strike([{ type: 'Eagle Riders' }, { type: 'Eagle Riders' }, { type: 'Shieldwall Levies' }])).toThrow();
  });
  test('a column of a winged rider and two foot companies is too heavy: the strike is none', () => {
    expect(
      strike([{ type: 'Eagle Riders' }, { type: 'Shieldwall Levies' }, { type: 'Shieldwall Levies' }])(),
    ).toBeNull();
  });
  test('a column with a cavalry company is grounded, and with no companies it does not fly', () => {
    expect(strike([{ type: 'Eagle Riders' }, { type: 'Free Lances' }])()).toBeNull();
    expect(strike([])()).toBeNull();
  });
});

describe("the hex distance is the map's, with the east-west wrap", () => {
  const province = (id: number, col: number, row: number) => ({ id, col, row, owner: 0, terrain: 'plain' });
  // the old copy's formula, as the oracle
  const oracle = (cols: number, a: [number, number], b: [number, number]) => {
    let dc = Math.abs(a[0] - b[0]);
    dc = Math.min(dc, cols - dc);
    const dr = Math.abs(a[1] - b[1]);
    return Math.max(dc, dr, (dc + dr) >> 1);
  };
  // a realm of two provinces: its diameter is the distance between them
  const distance = (cols: number, a: [number, number], b: [number, number]) =>
    botEmpireDiameter({ world: { cols, provinces: [province(0, ...a), province(1, ...b)] } } as never, 0);
  test("two provinces on the map's two edges are one hex apart", () => {
    expect(distance(10, [0, 2], [9, 2])).toBe(1);
  });
  test("every pair on a small map gives the old copy's distance", () => {
    const cols = 7;
    for (let c1 = 0; c1 < cols; c1++)
      for (let r1 = 0; r1 < 4; r1++)
        for (let c2 = 0; c2 < cols; c2++)
          for (let r2 = 0; r2 < 4; r2++)
            expect(
              distance(cols, [c1, r1], [c2, r2]),
              `(${String(c1)},${String(r1)}) to (${String(c2)},${String(r2)})`,
            ).toBe(oracle(cols, [c1, r1], [c2, r2]));
  });
});
