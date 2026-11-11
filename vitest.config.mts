// Vitest runs every test (npm test). One project per test level (tests/README.md#the-levels); each runs its level's
// test scripts through tests/legacy.test.ts and its new tests from tests/<level>/. The quarantine project runs only
// in npm run test:quarantine, and the db project's tests (the access layer's, against the local Supabase) only in
// npm run test:db.
//
// The same answer every time: Node pinned (tests/setup/global.ts), time zone and locale fixed, the seed fixed
// (KC_SEED; the default in tests/setup/fixed.mts; fast-check's too, tests/setup/fast-check.ts), no retries and no .only. A test that logs console.error fails
// (tests/setup/each.ts). The footer prints the seed, how to repeat each failure, and each test or hook that used more
// than half its time limit (tests/setup/reporter.ts; the hooks timed by tests/setup/hook-times.ts).
//
// This file is .mts and imports only types and constants from tests/: package.json has no "type" (the test scripts
// are CommonJS), so this is how Node and Vite load the config as an ES module without warnings.
import os from 'node:os';
import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';
import type { Level } from './tests/suite.ts';
import { DEFAULT_SEED, FIXED } from './tests/setup/fixed.mts';

// The levels, slowest first so the longest script starts at once. tests/legacy.test.ts checks that they are the
// levels in tests/suite.ts, so no script is left without a project to run it.
const LEVELS: Level[] = ['page', 'simulation', 'scenario', 'unit', 'static'];
// Set here as well as in `env`, so the worker processes start with them (the locale is read at start-up).
Object.assign(process.env, FIXED, { KC_SEED: process.env['KC_SEED'] || DEFAULT_SEED });
// How many test files run at once (maxWorkers): two fewer than the cores, at least 2 (no more than the cores) and at
// most 8; within a file, up to one test script per core (maxConcurrency). Measured (P1-01d, 2026-11-06, npm test three
// times each on an idle 14-core laptop, 291 files and 8,668 tests, the same names and results every run): 2 at once
// 189 s, 4 101 s, 8 62 s, 14 59 s; at 14 a page test used more than half its time limit in every run, at 8 none did.
// On CI's 4-core runners 4 at once failed 4 tests at their time limits (#432's first run), so CI keeps 2.
// KC_JOBS=N runs N files at once, and up to N scripts in each: KC_JOBS=1 runs one at a time.
const jobs = Number(process.env['KC_JOBS']) || os.availableParallelism();
const cores = os.availableParallelism();
const files = Number(process.env['KC_JOBS']) || Math.min(8, Math.max(2, cores - 2), cores);

const project = (level: Level | 'quarantine'): TestProjectInlineConfiguration => ({
  extends: true,
  test: {
    name: level,
    include:
      level === 'quarantine' ? ['tests/legacy.test.ts'] : ['tests/legacy.test.ts', `tests/${level}/**/*.test.ts`],
    provide: { level, levels: LEVELS },
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
    projects: [
      ...LEVELS.map(project),
      ...(process.env['KC_QUARANTINE'] === '1' ? [project('quarantine')] : []),
      theAccessLayersProject,
    ],
  },
});
