// The game's dice and the engine's clock (P1-07): src/engine/rng.js and src/engine/clock.js, each run on its own in a
// fresh sandbox, as the GM portal runs them first of all its scripts (each a module that imports nothing, run as a
// classic script: tests/lib/source.ts's scriptOf takes its `export` keywords off).
// - kcRng() given a seed plays exactly the sequence of the tests' seededRandom (tests/lib/boot.js) for that seed, so
//   every seeded test and balance game plays as it did when the page's dice were Math.random.
// - Given no seed (the live site), it seeds itself once from crypto.getRandomValues.
// - kcRng.seed(n) starts again from seed n; kcRng.use(fn) draws from fn and hands back the stream it replaced, which
//   then carries on where it stopped.
// - kcClock() reads Date.now() when it is called, so a pinned Date (bootJsdom's opts.now) pins it; kcClock.date() is
//   one reading, as new Date() is.
// Level 1 (unit): each file's code runs alone, with no page around it.
import vm from 'node:vm';
import { describe, expect, test } from 'vitest';
import { pinnedDate, seededRandom, type KcRng } from '../lib/boot.js';
import { importsOf } from '../../tools/pages.ts';
import { scriptOf } from '../lib/source.ts';

const RNG = scriptOf('engine/rng.js');
const CLOCK = scriptOf('engine/clock.js');

/** Runs rng.js in a new sandbox with `globals` (e.g. KC_RNG_SEED, crypto) and returns its kcRng. */
function loadRng(globals: Record<string, unknown>): KcRng {
  const sandbox = vm.createContext({ ...globals });
  vm.runInContext(RNG, sandbox);
  return vm.runInContext('kcRng', sandbox) as KcRng;
}
const draws = (f: () => number, n: number) => Array.from({ length: n }, () => f());
/** A crypto that answers getRandomValues with `value`, and records each call's array length. */
function fixedCrypto(value: number, calls: number[]) {
  return {
    getRandomValues(a: Uint32Array) {
      calls.push(a.length);
      a[0] = value;
      return a;
    },
  };
}

describe('kcRng', () => {
  // 0 (read as 1, as seededRandom does), small, the npm test default, a default stream above 2^32 (boot.js adds
  // 0x10000 per page booted), and the largest.
  const seeds = [0, 1, 1234, 20261001, 20261001 + 0x10000 * 70000, 0xffffffff];
  test.for(seeds)('seed %i plays the same 2,000 numbers as the tests’ seededRandom', (seed) => {
    const kcRng = loadRng({ KC_RNG_SEED: seed, crypto: fixedCrypto(1, []) });
    expect(draws(kcRng, 2000)).toEqual(draws(seededRandom(seed), 2000));
  });

  test('seeds that differ play different numbers, each in [0, 1)', () => {
    const a = draws(loadRng({ KC_RNG_SEED: 1, crypto: null }), 500);
    const b = draws(loadRng({ KC_RNG_SEED: 2, crypto: null }), 500);
    expect(a).not.toEqual(b);
    for (const x of [...a, ...b]) expect(x >= 0 && x < 1, String(x)).toBe(true);
  });

  test('given no seed, it seeds itself once from crypto.getRandomValues (the live site)', () => {
    const calls: number[] = [];
    const kcRng = loadRng({ crypto: fixedCrypto(987654321, calls) });
    expect(calls, 'one call, for one 32-bit number').toEqual([1]);
    expect(draws(kcRng, 100)).toEqual(draws(seededRandom(987654321), 100));
    draws(kcRng, 100);
    expect(calls, 'and never again').toEqual([1]);
  });

  test('given a seed, it never asks crypto', () => {
    const calls: number[] = [];
    loadRng({ KC_RNG_SEED: 5, crypto: fixedCrypto(1, calls) });
    expect(calls).toEqual([]);
  });

  test('with the real crypto and no seed, it draws numbers in [0, 1)', () => {
    const kcRng = loadRng({ crypto: globalThis.crypto });
    for (const x of draws(kcRng, 200)) expect(x >= 0 && x < 1, String(x)).toBe(true);
  });

  test('kcRng.seed(n) starts again from seed n', () => {
    const kcRng = loadRng({ KC_RNG_SEED: 77, crypto: null });
    draws(kcRng, 37);
    kcRng.seed(4242);
    expect(draws(kcRng, 300)).toEqual(draws(seededRandom(4242), 300));
  });

  test('kcRng.use(fn) draws from fn, and the stream it hands back carries on where it stopped', () => {
    const kcRng = loadRng({ KC_RNG_SEED: 9, crypto: null });
    const expected = draws(seededRandom(9), 20);
    const first = draws(kcRng, 10);
    let i = 0;
    const was = kcRng.use(() => [0.25, 0.5][i++ % 2] ?? 0);
    expect(draws(kcRng, 4)).toEqual([0.25, 0.5, 0.25, 0.5]);
    kcRng.use(was);
    expect([...first, ...draws(kcRng, 10)]).toEqual(expected);
  });
});

describe('kcClock', () => {
  /** Runs clock.js in a new sandbox whose Date is `D`, and returns the sandbox. */
  function loadClock(D: DateConstructor) {
    const sandbox = vm.createContext({ Date: D });
    vm.runInContext(CLOCK, sandbox);
    return sandbox as { kcClock: (() => number) & { date: () => Date }; Date: DateConstructor };
  }

  test('reads the Date it finds when it is called, one reading at a time', () => {
    const at = Date.parse('2026-10-01T12:00:00Z');
    const page = loadClock(pinnedDate(Date, at));
    expect(page.kcClock()).toBe(at);
    expect(page.kcClock()).toBe(at + 1);
    const d = page.kcClock.date();
    expect(d.toISOString()).toBe('2026-10-01T12:00:00.002Z');
    expect(page.kcClock(), 'kcClock.date() read the clock once').toBe(at + 3);
    // A test that pins the page's clock later (turn-properties does, for each input) pins kcClock too.
    page.Date = pinnedDate(Date, '2030-01-01T00:00:00Z');
    expect(page.kcClock.date().toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });

  test('on an ordinary clock, it is the time now', () => {
    const page = loadClock(Date);
    const before = Date.now();
    const t = page.kcClock();
    expect(t >= before && t <= Date.now()).toBe(true);
  });
});

test('the dice and the clock import nothing, so each runs on its own, first on the page', () => {
  expect(importsOf('engine/rng.js')).toEqual([]);
  expect(importsOf('engine/clock.js')).toEqual([]);
});
