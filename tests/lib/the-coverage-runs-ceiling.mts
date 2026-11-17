// The coverage run's ceiling: one time limit for every test and hook in CI's coverage run (plan P1-10z). Its own .mts
// file, with no import, so vitest.config.mts can load it as an ES module without Node's warning (as
// tests/setup/fixed.mts is); tests/lib/time-limits.ts gives it to the sized limits.
/** The coverage run's ceiling (plan P1-10z). CI's coverage halves (.github/workflows/ci.yml, unit-scenario-coverage-
 *  half) run the unit and scenario tests again with Vitest's coverage on, which slows the code it watches 1.6 to 3.4
 *  times on a laptop and more on a runner, so a limit sized for a run without it fails there by the runner's speed:
 *  luck. That run measures coverage and judges no test's time (the halves without coverage do, at these limits), so
 *  there every limit, Vitest's own (vitest.config.mts) and each one tests/lib/time-limits.ts sizes, is this one
 *  ceiling, or the sized limit if that is longer. Five minutes: far beyond any test's time, and well under the job's 15 minutes, which still stops
 *  a run that hangs. The coverage halves alone set KC_COVERAGE_RUN=1; tests/static/harness.test.ts checks it. */
export const THE_COVERAGE_RUNS_CEILING_MS = 300_000;

/** Whether this is CI's coverage run (KC_COVERAGE_RUN=1), where the ceiling above is every limit. */
export const aCoverageRun = (): boolean => process.env['KC_COVERAGE_RUN'] === '1';
