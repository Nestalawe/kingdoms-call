// The reporter's footer (tests/setup/reporter.ts) names each test or hook that used more than half its time limit, so
// one creeping towards its limit on a slow runner is seen before it fails (#351's hook failed at 10 s with no warning
// on the runs before), or says that none did. It never fails a run.
// - The deciding: theLinesNearTheirLimits on made-up times: past half named, half exactly not, the nearest first, none
//   named when none is past half, and a part with no limit (0) never named.
// - The times: this file's own hooks are timed where they run, with the limit Vitest holds for each (its own, or the
//   default), by tests/setup/hook-times.ts, and handed on in the file's meta, where the reporter reads them. Vitest's
//   reporter API says when a suite's hooks start and end, but not how long each took nor its limit.
// Level 1 (unit): a pure function on values, and this file's own run read from its meta; no game, no page.
import { beforeAll, describe, expect, test } from 'vitest';
import { theLinesNearTheirLimits } from '../setup/reporter.ts';

/** Waits `ms` milliseconds without yielding: the hook takes at least that long, whatever the machine. */
const busyFor = (ms: number) => {
  const start = performance.now();
  while (performance.now() - start < ms);
};

describe('the lines', () => {
  test('none past half: one line says so', () => {
    expect(theLinesNearTheirLimits([])).toEqual(['No test or hook used more than half its time limit.']);
    expect(theLinesNearTheirLimits([{ where: 'a › b', ms: 2_500, limit: 5_000 }])).toEqual([
      'No test or hook used more than half its time limit.',
    ]);
  });

  test('past half: named, with its time and its limit', () => {
    expect(
      theLinesNearTheirLimits([{ where: '[unit] tests/unit/x.test.ts › beforeAll', ms: 9_412, limit: 10_000 }]),
    ).toEqual(['Near its limit: [unit] tests/unit/x.test.ts › beforeAll, 9.4 s of 10 s']);
  });

  test('the nearest first; a part with no limit never named', () => {
    expect(
      theLinesNearTheirLimits([
        { where: 'a', ms: 3_000, limit: 5_000 },
        { where: 'b', ms: 49_000, limit: 50_000 },
        { where: 'c', ms: 2_000, limit: 5_000 },
        { where: 'd', ms: 90_000, limit: 0 },
      ]),
    ).toEqual(['Near its limit: b, 49 s of 50 s', 'Near its limit: a, 3 s of 5 s']);
  });
});

describe('the times', () => {
  beforeAll(() => {
    busyFor(30);
  }, 1_234);

  test("this file's hooks are timed, each with the limit Vitest holds for it", ({ task }) => {
    const times = task.file.meta.hookTimes ?? [];
    const mine = times.find((h) => h.limit === 1_234);
    expect(mine).toMatchObject({ suite: 'the times', hook: 'beforeAll' });
    expect(mine?.ms).toBeGreaterThanOrEqual(30);
    // each.ts's beforeEach, at the file's level, with a hook's default limit
    expect(times).toContainEqual(expect.objectContaining({ suite: '', hook: 'beforeEach', limit: 10_000 }));
  });
});
