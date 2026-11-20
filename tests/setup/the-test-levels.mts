// The test levels (tests/README.md#the-levels), the one list of them. vitest.config.mts makes a project of each, in this
// order (slowest first), and runs its tests from tests/<level>/; tests/static/harness.test.ts checks that CI runs each
// level in exactly one job, and the rulings' test looks for a ruling's test in each level's folder. It is .mts, like
// fixed.mts, so the config loads it as an ES module.
export const LEVELS = ['page', 'simulation', 'scenario', 'unit', 'static'] as const;
export type Level = (typeof LEVELS)[number];
