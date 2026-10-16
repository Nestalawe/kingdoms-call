// The noise rule (tools/balance/paired.ts, P1-02a): two runs compared game by game on the same seeds, ranges from
// resampling whole games with a fixed seed. Made-up per-game figures with a known answer. Level 1 (unit): a pure
// function.
import { describe, expect, test } from 'vitest';
import { chanceOf, compareRuns, meaningfulChanges, MIN_CASES, type Change } from '../../tools/balance/paired.ts';
import type { Stats } from '../../tools/balance/stats.ts';

// 40 games: 'battles: attacker won' is won/fought with 10 battles a game, won varying 4–8 by game.
const won = (i: number) => 4 + ((i * 7) % 5);
const base: Stats[] = Array.from({ length: 40 }, (_, i) => ({
  'battles: attacker won': [won(i), 10],
  'battles: fought': [10, 1],
  'lairs: cleared | by grade: Legendary': [i % 2, 1],
}));
const get = (changes: Change[], key: string): Change => {
  const c = changes.find((x) => x.key === key);
  if (!c) throw new Error(`no ${key}`);
  return c;
};

describe('the noise rule, paired by seed', () => {
  test('identical runs: nothing changed, every range is zero', () => {
    const changes = compareRuns(base, structuredClone(base));
    for (const c of changes) {
      expect(c.diff).toBe(0);
      expect(c.z).toBe(0);
      expect(c.verdict === 'within the noise' || c.verdict === 'too few to tell').toBe(true);
    }
    expect(meaningfulChanges(changes)).toEqual([]);
  });

  test('every game one battle fewer won: a clear change of −10 points, however the games vary', () => {
    const head = base.map((g, i) => ({ ...g, 'battles: attacker won': [won(i) - 1, 10] as [number, number] }));
    const c = get(compareRuns(base, head), 'battles: attacker won');
    expect(c.diff).toBeCloseTo(-0.1, 10);
    expect(c.range99).toEqual([expect.closeTo(-0.1, 10), expect.closeTo(-0.1, 10)]);
    expect(c.verdict).toBe('clear change');
    expect(c.z).toBe(-Infinity);
  });

  test('one game of 40 a battle fewer won: within the noise', () => {
    const head = base.map((g, i) =>
      i === 3 ? { ...g, 'battles: attacker won': [won(i) - 1, 10] as [number, number] } : g,
    );
    const c = get(compareRuns(base, head), 'battles: attacker won');
    expect(c.diff).toBeCloseTo(-1 / 400, 10);
    expect(c.range95[0]).toBeLessThan(0);
    expect(c.range95[1]).toBe(0);
    expect(c.verdict).toBe('within the noise');
  });

  test('a change in a quarter of the games: caught, and the ranges hold the change', () => {
    const head = base.map((g, i) =>
      i % 4 === 0 ? { ...g, 'battles: attacker won': [won(i) - 2, 10] as [number, number] } : g,
    );
    const c = get(compareRuns(base, head), 'battles: attacker won');
    expect(c.diff).toBeCloseTo(-0.05, 10);
    expect(c.range95[0]).toBeLessThan(c.diff);
    expect(c.range95[1]).toBeGreaterThan(c.diff);
    expect(c.range99[0]).toBeLessThan(c.range95[0]); // the 99% range is the wider
    expect(c.range99[1]).toBeLessThan(0);
    expect(c.verdict).toBe('clear change');
  });

  test('too few cases to tell: under MIN_CASES in either run', () => {
    const few = base.slice(0, MIN_CASES - 1);
    const head = few.map((g) => ({ ...g, 'battles: fought': [0, 1] as [number, number] }));
    expect(get(compareRuns(few, head), 'battles: fought').verdict).toBe('too few to tell');
  });

  test('the same answer every time: the resampling seed is fixed', () => {
    const head = base.map((g, i) =>
      i % 3 ? g : { ...g, 'battles: attacker won': [won(i) + 1, 10] as [number, number] },
    );
    expect(compareRuns(base, head)).toEqual(compareRuns(base, head));
  });

  test('the runs must pair', () => {
    expect(() => compareRuns(base, base.slice(1))).toThrow(/differ in size/);
  });
});

describe('the overall answer', () => {
  const change = (key: string, z: number): Change => ({
    key,
    base: 0,
    head: 0,
    diff: z,
    range95: [0, 0],
    range99: [0, 0],
    cases: [100, 100],
    z,
    verdict: 'clear change',
  });

  test('looks only at headline statistics, never slices', () => {
    expect(meaningfulChanges([change('battles: attacker won | by kind: pvp', 9)])).toEqual([]);
    expect(meaningfulChanges([change('battles: attacker won', 9)])).toHaveLength(1);
  });

  test('raises the bar with the number of headline statistics', () => {
    // One statistic: 1 in 100, about 2.58 standard errors. Thirty: 1 in 3,000, about 3.59.
    expect(meaningfulChanges([change('a', 2.7)])).toHaveLength(1);
    const thirty = Array.from({ length: 30 }, (_, i) => change('s' + String(i), i ? 0 : 3.4));
    expect(meaningfulChanges(thirty)).toEqual([]);
    expect(meaningfulChanges([...thirty.slice(1), change('s0', 3.7)])).toHaveLength(1);
  });

  test('chance of a move this big, either way', () => {
    expect(chanceOf(0)).toBeCloseTo(1, 6);
    expect(chanceOf(1.959964)).toBeCloseTo(0.05, 5);
    expect(chanceOf(-2.575829)).toBeCloseTo(0.01, 5);
    expect(chanceOf(Infinity)).toBe(0);
  });
});
