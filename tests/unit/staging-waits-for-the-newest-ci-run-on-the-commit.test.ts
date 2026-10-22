// Staging waits for CI's newest run on the commit (.github/scripts/staging.js, wait-ci). CI keeps one run per pull
// request (ci.yml's concurrency group): the "staging" label starts staging's run and a new CI run at the same moment,
// and the new CI run cancels the one still going, whose "ci" job then fails at once. Its own "ci" starts only once its
// other jobs are done, minutes later. Read across every run on the commit, that failed "ci" stopped staging; read from
// the newest run alone, staging waits for it, then goes.
// Level 1 (unit): pure functions of the script, on made-up runs and jobs; nothing is fetched. Static can't: it runs
// code.
import { describe, expect, test } from 'vitest';
import staging from '../../.github/scripts/staging.js';

interface Job {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
}
const job = (id: number, name: string, status: string, conclusion: string | null = null): Job => ({
  id,
  name,
  status,
  conclusion,
});

// Run 101 began on "opened" and was cancelled by run 102 ("labeled"): its jobs stopped, its "ci" ran and failed.
// Run 102 is still going: its db job has passed, its "ci" hasn't started.
const cancelled = [
  job(1, 'static checks', 'completed', 'cancelled'),
  job(2, 'db', 'completed', 'cancelled'),
  job(9, 'ci', 'completed', 'failure'),
];
const going = [job(5, 'static checks', 'in_progress'), job(6, 'db', 'completed', 'success')];
const passed = [
  job(5, 'static checks', 'completed', 'success'),
  job(6, 'db', 'completed', 'success'),
  job(12, 'ci', 'completed', 'success'),
];
const runs = [{ id: 101 }, { id: 102 }];

describe("staging reads CI's newest run on the commit", () => {
  test('a run cancelled by a newer one is not read: staging waits for the newer run, then goes', async () => {
    const asked: number[] = [];
    const jobs = await staging.newestRunsJobs({
      runs,
      jobsOf: (id: number) => {
        asked.push(id);
        return Promise.resolve(id === 102 ? going : cancelled);
      },
    });
    expect(asked).toEqual([102]);
    expect(staging.ciVerdict(jobs).state).toBe('wait');
    // Every job named ci or db on the commit, the cancelled run's with the rest (as the commit's check runs were
    // read): the cancelled run's failed ci is the only ci, and it would stop staging.
    expect(staging.ciVerdict([...cancelled, ...going]).state).toBe('fail');
  });

  test('the newest run is the one with the highest id, whatever the order the list comes in', async () => {
    const jobs = await staging.newestRunsJobs({
      runs: [{ id: 102 }, { id: 101 }],
      jobsOf: (id: number) => Promise.resolve(id === 102 ? passed : cancelled),
    });
    expect(staging.ciVerdict(jobs).state).toBe('go');
  });

  test('no run yet: no jobs, and staging waits', async () => {
    const jobs = await staging.newestRunsJobs({ runs: [], jobsOf: () => Promise.reject(new Error('not asked')) });
    expect(jobs).toEqual([]);
    expect(staging.ciVerdict(jobs).state).toBe('wait');
  });

  test('waiting through the cancelled run: wait, wait, then go', async () => {
    const seen: { runs: { id: number }[]; jobs: Record<number, Job[]> }[] = [
      { runs: [{ id: 101 }], jobs: { 101: going } },
      { runs, jobs: { 101: cancelled, 102: going } },
      { runs, jobs: { 101: cancelled, 102: passed } },
    ];
    let polls = 0;
    let now = 0;
    const log: string[] = [];
    const verdict = await staging.waitForCi({
      fetchRuns: () => {
        const at = seen[Math.min(polls++, seen.length - 1)];
        return staging.newestRunsJobs({
          runs: at?.runs ?? [],
          jobsOf: (id: number) => Promise.resolve(at?.jobs[id] ?? []),
        });
      },
      sleep: (ms: number) => {
        now += ms;
        return Promise.resolve();
      },
      now: () => now,
      log: (m: string) => log.push(m),
    });
    expect(verdict.state).toBe('go');
    expect(polls).toBe(3);
  });
});
