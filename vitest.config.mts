// Vitest runs every test (npm test). One project per test level (tests/README.md#the-levels); each runs its level's
// test scripts through tests/legacy.test.ts and its new tests from tests/<level>/. The quarantine project runs only
// in npm run test:quarantine.
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
// How many test files run at once: one per core, up to 8 (maxWorkers); within a file, up to one test script per core
// (maxConcurrency). Measured (P1-01d, 2026-11-06, npm test three times each on an idle 14-core laptop, 291 files and
// 8,668 tests, the same names and results every run): 2 at once 189 s, 4 101 s, 8 62 s, 14 59 s; at 14 a page test
// used more than half its time limit in every run, at 8 none did. On CI's 4-core runners this is 4: see the PR for its
// jobs' times. KC_JOBS=1 runs one file and one script at a time.
const jobs = Number(process.env['KC_JOBS']) || os.availableParallelism();

const project = (level: Level | 'quarantine'): TestProjectInlineConfiguration => ({
  extends: true,
  test: {
    name: level,
    include:
      level === 'quarantine' ? ['tests/legacy.test.ts'] : ['tests/legacy.test.ts', `tests/${level}/**/*.test.ts`],
    provide: { level, levels: LEVELS },
  },
});

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
    maxWorkers: Math.min(8, jobs),
    projects: [...LEVELS.map(project), ...(process.env['KC_QUARANTINE'] === '1' ? [project('quarantine')] : [])],
  },
});
