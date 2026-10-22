// How long a test may take before Vitest stops it: a limit sized to the work the test does (P1-13c's rule for the
// tests that build the site, made one helper for every test that needs one).
//
// Vitest's own limit, 5 s, suits a test that reads a few files or calls a function, or asks ESLint for one file's
// config or lints one file without types: under a second even on GitHub's runners. A test that builds the site, builds a
// TypeScript program, runs a tool over the tree or reads every file of src/ takes longer: on a runner, with the other
// tests of its job beside it, several times what it takes on a laptop. So it gets an allowance for each piece of that
// work, about five times the longest the piece has taken on GitHub's runners (each figure below), so a slow runner still
// passes and a test that hangs still stops. A property test gets an allowance for each input it tries, so KC_FULL's ten
// times the inputs get ten times the time.
//
// A limit, never a retry, a re-run or a smaller run instead (tests/README.md): a test passes the first time or fails.
// eslint.config.js refuses a `retry`, `retries` or `repeats` in any test file, and tests/setup/each.ts fails a test set
// to retry or repeat; tests/static/harness.test.ts checks both.

/** Each piece of work a test may do, and its allowance in milliseconds. */
export const ALLOWANCE_MS = {
  /** One build of the site with Vite (tools/build.ts), in the test's process or its own: three took 6.4 s on a runner
   *  (#182), about 2 s each. */
  siteBuilds: 10_000,
  /** One TypeScript program built: ts.createProgram, or ESLint's type-aware rules on a file TypeScript checks (ESLint
   *  builds its program first): up to 6.3 s on a runner. */
  typeScriptPrograms: 30_000,
  /** One run of a tool over the tree: knip, dependency-cruiser or ESLint's command line in its own process, ESLint's
   *  config for every file it lints, or the ratchet's count (which runs knip): up to 4.6 s on a runner (three of ESLint's
   *  command line side by side took 13.7 s on the nightly run). */
  toolRuns: 20_000,
  /** Every file of src/ (or of a copy of it, of a page, or of the tests) copied, or read by its syntax tree: up to 3.2 s
   *  on a runner. */
  everyFileReads: 15_000,
} as const;

/** What a test does: how many of each piece of work. */
export type TheWork = { [piece in keyof typeof ALLOWANCE_MS]?: number };

/** A test's options for `work`: its time limit, the sum of its pieces' allowances. Only a limit. */
export function timeLimitForTheWork(work: TheWork): { timeout: number } {
  const timeout =
    (work.siteBuilds ?? 0) * ALLOWANCE_MS.siteBuilds +
    (work.typeScriptPrograms ?? 0) * ALLOWANCE_MS.typeScriptPrograms +
    (work.toolRuns ?? 0) * ALLOWANCE_MS.toolRuns +
    (work.everyFileReads ?? 0) * ALLOWANCE_MS.everyFileReads;
  if (!(timeout > 0))
    throw new Error('A test given a time limit names the work it does: Vitest keeps 5 s for the rest.');
  return { timeout };
}

/** A property test's options: its time limit, `msEachRun` for each of the `runs` inputs it tries. */
export function timeLimitForPropertyRuns(runs: number, msEachRun: number): { timeout: number } {
  if (!(runs > 0 && msEachRun > 0)) throw new Error('A property test tries some inputs, each in some time.');
  return { timeout: Math.ceil(runs * msEachRun) };
}
