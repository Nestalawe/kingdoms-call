# Tests

How to write, place, prove and run a test. Read it when you write a test; it is reference, not a first read.

- **Every test, one line each:** [every-test-its-level-and-what-it-checks.md](every-test-its-level-and-what-it-checks.md).
  A test's own header says the rest: what it checks, its level and why.
- **How a test loads a page, the engine or the site's code** (`lib/boot.js`, `lib/engine.ts`, `lib/source.ts`, the
  stand-in database, the seed): [how-the-tests-reach-the-site.md](../docs/architecture/how-the-tests-reach-the-site.md).
- **The balance matrix in full:** [the-balance-matrix.md](../docs/architecture/the-balance-matrix.md).
- **The toolchain, the hooks and the ratchet:** [the-toolchain-the-checks-and-the-harness.md](../docs/architecture/the-toolchain-the-checks-and-the-harness.md).

Paths below without a folder in front (`lib/`, `setup/`, `browser/`, `balance/`) are under `tests/`.

## Running the tests

```sh
npm test                    # every test, by level (about 60 s)
npx playwright test         # the browser specs, in Chromium (about 20 s): see "Browser specs" below
npm run check               # the quick check of what this branch changes (about 20 s; the Stop hook runs it)
npm run ratchet             # the counts in ratchet.json: none may rise
npm run test:full           # bigger fuzz runs, and ten times the property tests' inputs (the nightly run, with a random seed)
npm run test:quarantine     # the quarantined harnesses below (expected to fail)
npm test -- -t fuzz         # only tests whose name matches "fuzz" (a regular expression)
npm test -- --project unit  # one level: static, unit, scenario, simulation or page
KC_JOBS=1 npm test          # one test file at a time (default: one per core, up to 8 at once)
KC_SEED=123 npm test        # another seed (the default, 20261001, is set in vitest.config.mts)
KC_SEED=123 npm test -- -t "^roster$"    # repeat one failure exactly (same seed and sizes): the footer prints this
node tests/<name>.test.js   # one test script on its own, after npm run build (unseeded, its own default sizes)
npx playwright test -g "map"           # only browser specs whose name matches "map"
npx playwright show-trace test-results/<spec>/trace.zip   # step through a failed spec (kept on failure)
npm run balance             # the balance matrix: 60 seeded games, and every realm's report, against the baseline (about 40 s): see below
npm run balance:update      # rewrite the balance baselines, in the PR that changes play
npm run balance -- battle   # a named scenario (battle, lair, encounter) on main's site and here (about 1 min)
npm run balance:report -- --base main --head <file>   # the balance report of a run (from npm run balance -- --out <file>) against main
npm run mutants -- <folder>  # score the mutant patches in <folder> (tools/mutants/run.ts): local only, never in CI
npm run mutants -- <folder> --resume  # carry on a scoring run that stopped, from its results.json
npm run dev                 # Vite's dev server of src/, against the local Supabase only (npm run dev -- config writes its kc-config.js)
npx supabase@2.120.0 test db --local supabase/tests   # the access-rule tests (local copy running; supabase/README.md)
npm run test:db             # the access layer's tests (tests/db/), against the local copy (running)
```

`npm test` is [Vitest](https://vitest.dev) (`vitest.config.mts`). It has one project per level: `static`, `unit`,
`scenario`, `simulation` and `page`. **Test files run side by side**, one per core up to 8 (the fastest count measured at
which no test came near its time limit), the slowest level first; within a file, up to one test script per core.

## The levels

Each test has one level: the lowest that can express what it checks (CLAUDE.md, "Test first"). Its header names the
level and why a lower one wouldn't do.

| Level | Name | What it does |
|---|---|---|
| 0 | static | Reads files (the docs, `src/` by its syntax tree, the workflows, a build's output); nothing of the game runs |
| 1 | unit | Calls functions on plain values or a small staged world: the engine's modules, a rule, a tool's logic |
| 1d | database unit | pgTAP tests of the access rules, in `supabase/tests/`, one file per table, run by CI's `db` job ([supabase/README.md](../supabase/README.md#the-access-rule-tests)) |
| db | access layer | Calls a `Db` function (`src/db/`) against the local Supabase as each role (`lib/made-up-accounts-in-each-role-on-the-local-supabase.ts`), in `db/`: the query and the access rules together. `npm run test:db`, not in `npm test`; run by CI's `db` job ([the database topic file](../docs/architecture/the-database-and-what-it-holds.md#the-access-layer-srcdb)) |
| 2 | scenario | Plays one real turn on a small staged world |
| 3 | simulation | Plays whole seeded games (fuzz runs, the report-leak runs) |
| 4 | page | Boots a page in jsdom against the stand-in database; the browser specs are page tests in Chromium |

## What each level is for, and what the tests don't do

- **Staging is acceptance, not validation:** it answers "is this what I meant?". A bug found there, in a simulation or
  in live play is a test missing lower down (CLAUDE.md, "When something slips through").
- **A live bug becomes a scenario:** from Toby's description (his pasted report stays in the session), the smallest
  made-up state and orders that show it, as a scenario or a unit test.
- **A system the bots never reach** gets a bot doctrine or a scripted realm in the matrix; a real game is never
  imported.
- **The nightly run** (`.github/workflows/nightly.yml`: `npm run test:full` with a random seed, printed first) blocks
  nothing. Repeat a failure with `KC_SEED=<seed> npm run test:full`, then add a test at the lowest level that shows it.
- **Deliberately not done**, because the levels cover the risk more cheaply, or it hasn't happened: real data replayed
  in CI; random streams keyed by event; bot orders recorded as inputs; old builds kept runnable to replay past turns;
  real turns exported to reproduce a bug (no live bug has needed one); pages tested against the real database (the
  local Supabase tests the access layer; pages use its fake); home-made test tools. When to think again:
  [Phase 4](../docs/the-goal-and-the-road.md#phase-4-turns-run-by-a-server).

## Writing a new test

- **New tests are TypeScript Vitest tests in `tests/<level>/`**, e.g. `tests/page/deterministic-boot.test.ts`, or,
  for what only a real browser shows, browser specs in `tests/browser/` ([below](#browser-specs)). Types for the parts
  of `lib/` they use are in `lib/*.d.ts`. Give the file a long name that says what it checks.
- **Its header says what it checks, its level and why that level.** Then add its line to
  [the list](every-test-its-level-and-what-it-checks.md): the file, the level, what it checks, at most 300 characters
  (`static/the-docs-an-agent-reads-first-stay-within-their-budgets.test.ts` fails on a test file the list doesn't name).
- **The test scripts** (`*.test.js`, written before Vitest) are listed in `suite.ts`, each with its level; a script
  that checks at more than one level sits at its highest. `legacy.test.ts` runs each one as a Vitest test in its own
  Node process, with the same arguments and environment; it passes when the script exits 0, and a failure shows the
  end of its output. To add or quarantine a script, edit `suite.ts`. Write no new ones.
- **Load the site the one way:** a page through `lib/boot.js`, the engine through `lib/engine.ts` or its modules, the
  site's code through `lib/source.ts`, the database through `lib/stub-db.js`
  ([how-the-tests-reach-the-site.md](../docs/architecture/how-the-tests-reach-the-site.md)). Tests use synthetic,
  seeded data only.
- **Stage a world where a wrong read gives another answer:** a value read off the king needs a world whose first hero
  isn't the king.

## Proving it fails first

A test that can't fail proves nothing (CLAUDE.md, "Fail first"). Show it red without your change, then green with it.

- **On `main`:** run the new test on a checkout of `main` (a `git worktree`, removed afterwards).
- **On a broken copy of the site:** `KC_SITE=/tmp/broken-site npm test` (and `npx playwright test`) points every test
  that opens `site/` at another copy: build the site, break the copy, run the test there.
- **Tests that read `src/`** (`lib/engine.ts`, `lib/source.ts`, the engine's modules) ignore `KC_SITE`: their proof is
  a planted copy of the branch. Copy the branch, plant the fault in the copy's `src/`, and run the test there.
- **A refactor** (label `refactor-only`): new tests pass both before and after, and CI fails if the balance baseline
  changes. One exception: a static test of the state the row reaches is red on its row's base by design (as
  `static/the-resolvers-the-*-has-taken-*.test.ts` and `static/every-ruling-decision-question-and-step-*`).
- **A planted fault that stays green** is staged until it is red, or the pull request says why.
- **A stand-in must be reached:** a test that stands a function in has a check that fails when it isn't
  ([traps.md](../docs/traps.md#a-stand-in-on-a-module-reaches-calls-from-other-files-only)).

## The same answer every time

A test's outcome must not depend on luck (CLAUDE.md, "A test's outcome must not depend on luck"). A fixed seed doesn't
fix the world: any change that adds or removes a random draw shifts every draw after it.

- **Fixed for every run:** the run stops at once on any Node but `.nvmrc`'s (`setup/global.ts`). The time zone is UTC
  and the locale `en_US`. The seed is `KC_SEED` (default 20261001); a page's dice, `kcRng()`, and the test process's
  `Math.random` are seeded from it. A page's clock is pinned only when a test asks (`bootJsdom(html, {seed, now})`).
- **Refused:** a test set to retry or repeat fails, and so does a `.only`; ESLint refuses a `retry`, `retries` or
  `repeats` in any test file (`harness` checks both). A test that logs with `console.error` or leaves a rejected
  promise unhandled fails, unless it says it expects that with `vi.spyOn(console, 'error')` (`setup/each.ts`).
- **When a test passes only on some seeds,** restructure it: stage the state directly, or make the odds overwhelming.
  Never retries, loops, re-runs, re-seeding or a seed that happens to pass. A branch no seeded world reaches is staged
  directly, never found by searching seeds.
- **Failures say how to repeat them.** Under Vitest's report, a footer (`setup/reporter.ts`) prints the seed and, for
  each failed test, the command that repeats it.

## Time limits sized to the work, never a retry

Vitest stops a test after 5 s, a hook after 10 s. A test or hook that builds the site, builds a TypeScript program,
runs a tool over the tree (knip, dependency-cruiser, ESLint), reads every file of `src/` or plays a whole matrix game
gets a limit from `lib/time-limits.ts`: an allowance for each piece of that work, about five times the longest it has
taken on GitHub's runners (`timeLimitForTheWork({ siteBuilds: 3 })`; a hook: `beforeAll(fn, timeLimitForTheWork({
matrixGamesPlayed: 1 }).timeout)`). A property test whose inputs grow with `KC_FULL` gets one from its run count
(`timeLimitForPropertyRuns(RUNS, 50)`), so the nightly's ten times the runs get ten times the time. `harness` and
`static/a-hook-or-test-that-plays-a-whole-matrix-game-…` check both. The static tests type in no limit of their own.
Every run's footer (`setup/reporter.ts`) names each test or hook that used more than half its limit ("Near its limit:
…, 9.4 s of 10 s"; a hook timed by `setup/hook-times.ts`), or says none did: read it on the nightly, and size the work
before it fails. It never fails a run. A test on `main` past its limit reds every pull request: size its work in a pull
request of its own, never re-run it. Profile a slow test before sizing it (`node --cpu-prof --import tsx <script>`).

## The quick check, the ratchet and CI

What each runs and counts: [the toolchain](../docs/architecture/the-toolchain-the-checks-and-the-harness.md).

- **The quick check** (`npm run check`, `tools/check.ts`): the type check, ESLint and Prettier on the files this
  branch changes, the import rules over all of `src/`, the ratchet, then the tests; page and the browser specs run in
  CI. A change of types can raise a lint finding in a file it didn't touch, so run `npx eslint .` over the whole
  tree before a push.
- **The ratchet** (`npm run ratchet`, `tools/ratchet.ts`): no count in `ratchet.json` may rise. When one falls, lower
  it in the same PR (`npm run ratchet -- --update` only lowers). `harness` runs the same comparison, so `npm test`
  fails too.
- **In CI** (`.github/workflows/ci.yml`) each part runs in its own job; `ci` and `db` are the required checks. A job
  that fails while the runner sets up (`supabase db start`, an `apt-get`) may be re-run once, said in the pull
  request; a failing test is never re-run.

## Browser specs

`npx playwright test` runs the specs in `tests/browser/*.spec.ts` in Chromium (Playwright Test, `playwright.config.ts`):
what only a real browser shows. They are not part of `npm test`, and they wait for what happens, never a fixed time.
How the site is served, kept the same every time and waited on:
[the browser specs](../docs/architecture/the-browser-specs-what-only-chromium-shows-and-how-a-spec-waits.md).

## The balance matrix in brief

`npm run balance` plays 60 seeded games in the GM portal against the baseline in `balance/baseline/`, with its checks
after every turn; about 40 s, not part of `npm test`. CI's `balance` job plays it when a pull request changes an engine
path, and posts the balance report. `npm run balance:update` rewrites the baselines in the PR that changes play; a
`refactor-only` PR may not change them. In full: [the-balance-matrix.md](../docs/architecture/the-balance-matrix.md).

## Quarantined tests

**Quarantined** tests are not part of `npm test`. Each file's first line says why. They are kept unchanged, never
edited to pass. To quarantine one, in its own commit: move it to `quarantine/` (a test script's line leaves
`suite.ts`), and give its one-line reason as its first line and in the table below.
A quarantined test comes back, in its own PR, only once its reason no longer applies: updating it to the confirmed
behaviour is fine, loosening it until it passes is not.

| Test | Level | Why |
|---|---|---|
| `quarantine/set-scan.test.js` | 0 | Report-only: always exits 0. On today's build it lists 40 suspect `Set`/array mix-ups, mostly the same name used in different places. The two `Set`-with-`.includes()` hits were checked by hand and are false positives. Needs triage before it can gate |

**A running test that can't fail on its own findings:** `home-placement` prints `FAIL` for a too-close capital but
only exits non-zero when it throws (duplicate home cell, home on an edge row). It is kept as written.

## Code-anchor hooks

None. No test reaches inside a page by matching its source lines: each calls the function on the engine's modules or
in its bare vm, stands one in there (`lib/scenario-in-the-vm.ts` for a whole turn), or reads `src/` by its syntax tree
(`lib/source.ts`): [docs/traps.md](../docs/traps.md#string-anchor-harness-hooks). The table is kept, empty, so a test
that adds a hook has to say so here.

| Test | Anchor | In `src/` |
|---|---|---|
