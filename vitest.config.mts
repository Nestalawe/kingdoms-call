// Vitest runs every test (npm test). One project per test level (tests/README.md#the-levels, the list in
// tests/setup/the-test-levels.mts); each runs its level's tests from tests/<level>/. The quarantine project runs only
// in npm run test:quarantine (tests/quarantine/, empty today), and the db project's tests (the access layer's, against
// the local Supabase) only in npm run test:db.
//
// The same answer every time: Node pinned (tests/setup/global.ts), time zone and locale fixed, the seed fixed
// (KC_SEED; the default in tests/setup/fixed.mts; fast-check's too, tests/setup/fast-check.ts), no retries and no .only. A test that logs console.error fails
// (tests/setup/each.ts). The footer prints the seed, how to repeat each failure, and each test or hook that used more
// than half its time limit (tests/setup/reporter.ts; the hooks timed by tests/setup/hook-times.ts).
//
// This file is .mts and imports only types, constants and one pure check (tests/lib/the-coverage-runs-ceiling.mts) from
// tests/: package.json has no "type" (eslint.config.js and .github/scripts/ are CommonJS), so this is how Node and
// Vite load the config as an ES module without warnings.
import os from 'node:os';
import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';
import { DEFAULT_SEED, FIXED } from './tests/setup/fixed.mts';
import { LEVELS, type Level } from './tests/setup/the-test-levels.mts';
import { aCoverageRun, THE_COVERAGE_RUNS_CEILING_MS } from './tests/lib/the-coverage-runs-ceiling.mts';

// Set here as well as in `env`, so the worker processes start with them (the locale is read at start-up).
Object.assign(process.env, FIXED, { KC_SEED: (process.env['KC_SEED'] ?? '') || DEFAULT_SEED });
// How many test files run at once (maxWorkers): two fewer than the cores, at least 2 (no more than the cores) and at
// most 8; within a file, up to one concurrent test per core (maxConcurrency). Measured (P1-01d, 2026-11-06, npm test three
// times each on an idle 14-core laptop, 291 files and 8,668 tests, the same names and results every run): 2 at once
// 189 s, 4 101 s, 8 62 s, 14 59 s; at 14 a page test used more than half its time limit in every run, at 8 none did.
// On CI's 4-core runners 4 at once failed 4 tests at their time limits (#432's first run), so CI keeps 2.
// KC_JOBS=N runs N files at once, and up to N concurrent tests in each: KC_JOBS=1 runs one at a time.
const jobs = Number(process.env['KC_JOBS']) || os.availableParallelism();
const cores = os.availableParallelism();
const files = Number(process.env['KC_JOBS']) || Math.min(8, Math.max(2, cores - 2), cores);

// The coverage limits (plan P1-10z): how much of src/engine, src/views and src/shared the unit and scenario tests run,
// as Vitest's own coverage (@vitest/coverage-v8) measures it, folder by folder. Coverage is off in npm test. CI runs
// the unit and scenario tests a second time with it on, in two halves of their own, and the job after them joins the
// halves and checks these limits (.github/workflows/ci.yml, unit-scenario-coverage-half and unit-scenario-coverage). Each limit is the folder's figure when it was set, rounded
// down to a whole percent, for all four measures (lines, statements, functions, branches): a test dropped or a new
// file left untested shows as a fall in any of them. Raise a limit by hand, in a pull request, when coverage grows;
// never lower one. Vitest never rewrites them: thresholds.autoUpdate stays unset, as this file is a dangerous path.
// src/shared holds only re-exports today, which have no lines to count, and Vitest reads that as 100%: code added
// there needs its tests. Measure with npx vitest run --project unit --project scenario --coverage; a folder below its
// limit is named with its figure (tests/README.md#the-coverage-limits says how to read and raise them).
const THE_COVERAGE_LIMITS = {
  'src/engine/**': { lines: 87, statements: 85, functions: 90, branches: 75 },
  'src/views/**': { lines: 72, statements: 72, functions: 91, branches: 64 },
  'src/shared/**': { lines: 100, statements: 100, functions: 100, branches: 100 },
};
// A half of a run (--shard) measures only its own tests, so its limits would fail: a half keeps its coverage for the
// join (--reporter=blob), and the limits are checked there, on the whole.
const aHalfOfTheRun = process.argv.some((a) => a.startsWith('--shard'));

const project = (level: Level | 'quarantine'): TestProjectInlineConfiguration => ({
  extends: true,
  test: {
    name: level,
    include: [`tests/${level}/**/*.test.ts`],
  },
});

// The access layer's tests (plan P1-17, Decision 6): tests/db/, against the local Supabase, so never in npm test (the
// project has no files without KC_DB=1, and then its setup never runs); CI's db job runs them beside pgTAP. Its own
// setup finds the local Supabase (tests/setup/the-local-supabase.ts), after the run's (the Node pin, the build). One
// file at a time: each makes its own made-up accounts, and a database has one Overlord.
const theAccessLayersProject: TestProjectInlineConfiguration = {
  extends: true,
  test: {
    name: 'db',
    include: process.env['KC_DB'] === '1' ? ['tests/db/**/*.test.ts'] : [],
    globalSetup: ['tests/setup/the-local-supabase.ts'],
    fileParallelism: false,
  },
};

export default defineConfig({
  test: {
    retry: 0,
    allowOnly: false,
    restoreMocks: true,
    env: { ...FIXED, KC_SEED: process.env['KC_SEED'] },
    globalSetup: ['tests/setup/global.ts'],
    setupFiles: ['tests/setup/hook-times.ts', 'tests/setup/each.ts', 'tests/setup/fast-check.ts'],
    reporters: ['default', './tests/setup/reporter.ts'],
    maxConcurrency: jobs,
    maxWorkers: files,
    // CI's coverage run (KC_COVERAGE_RUN=1) judges no test's time: Vitest's own limits (5 s a test, 10 s a hook) are
    // the one ceiling there, as every sized limit is (tests/lib/the-coverage-runs-ceiling.mts says why).
    ...(aCoverageRun() ? { testTimeout: THE_COVERAGE_RUNS_CEILING_MS, hookTimeout: THE_COVERAGE_RUNS_CEILING_MS } : {}),
    coverage: {
      provider: 'v8',
      include: Object.keys(THE_COVERAGE_LIMITS),
      reporter: ['text-summary'],
      ...(aHalfOfTheRun ? {} : { thresholds: THE_COVERAGE_LIMITS }),
    },
    projects: [
      ...LEVELS.map(project),
      ...(process.env['KC_QUARANTINE'] === '1' ? [project('quarantine')] : []),
      theAccessLayersProject,
    ],
  },
});
