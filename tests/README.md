# Tests

How to write, place, prove and run a test. Read it when you write a test; it is reference, not a first read.

- **Every test, one line each:** [every-test-its-level-and-what-it-checks.md](every-test-its-level-and-what-it-checks.md).
  A test's own header says the rest: what it checks, its level and why.
- **How a test loads a page, the engine or the site's code** (`lib/boot.js`, `lib/engine.ts`, `lib/source.ts`, the
  stand-in database, the seed): [how-the-tests-reach-the-site.md](../docs/architecture/how-the-tests-reach-the-site.md).
- **The balance matrix in full:** [the-balance-matrix.md](../docs/architecture/the-balance-matrix.md).
- **The toolchain** (TypeScript, ESLint and its rules, dependency-cruiser, knip, the hooks, the ratchet, the mutant
  scorer): [the-toolchain-the-checks-and-the-harness.md](../docs/architecture/the-toolchain-the-checks-and-the-harness.md).

Paths below without a folder in front (`lib/`, `setup/`, `browser/`, `balance/`) are under `tests/`.

## Running the tests

```sh
npm test                    # every test, by level (about 30 s)
npx playwright test         # the browser specs, in Chromium (about 20 s): see "Browser specs" below
npm run check               # the quick check of what this branch changes (about 20 s; the Stop hook runs it)
npm run ratchet             # the counts in ratchet.json: none may rise
npm run test:full           # bigger fuzz runs, and ten times the property tests' inputs (the nightly run, with a random seed)
npm run test:quarantine     # the quarantined harnesses below (expected to fail)
npm test -- -t fuzz         # only tests whose name matches "fuzz" (a regular expression)
npm test -- --project unit  # one level: static, unit, scenario, simulation or page
KC_JOBS=1 npm test          # one test at a time (default: up to one per core in each of two levels at once)
KC_SEED=123 npm test        # another seed (the default, 20261001, is set in vitest.config.mts)
KC_SEED=123 npm test -- -t "^concede$"   # repeat one failure exactly (same seed and sizes): the footer prints this
node tests/<name>.test.js   # one test script on its own (unseeded, its own default sizes)
npx playwright test -g "map"           # only browser specs whose name matches "map"
npx playwright show-trace test-results/<spec>/trace.zip   # step through a failed spec (kept on failure)
npm run balance             # the balance matrix: 60 seeded games, and every realm's report, against the baseline (about 40 s): see below
npm run balance:update      # rewrite the balance baselines, in the PR that changes play
npm run balance:report -- --base main --head <file>   # the balance report of a run (from npm run balance -- --out <file>) against main
npm run mutants -- <folder>  # score the mutant patches in <folder> (tools/mutants/run.ts): local only, never in CI
```

`npm test` is [Vitest](https://vitest.dev) (`vitest.config.mts`). It has one project per level: `static`, `unit`,
`scenario`, `simulation` and `page`. **Levels run side by side**, two at a time, slowest first; within a level, up to
one test script per core. More at once only overloads the machine.

## The levels

Each test has one level: the lowest that can express what it checks (CLAUDE.md, "Test first"). Its header names the
level and why a lower one wouldn't do.

| Level | Name | What it does |
|---|---|---|
| 0 | static | Reads files (the docs, `src/` by its syntax tree, the workflows, a build's output); nothing of the game runs |
| 1 | unit | Calls functions on plain values or a small staged world: the engine's modules, a rule, a tool's logic |
| 1d | database unit | pgTAP tests of the access rules, in `supabase/tests/`, one file per table, run by CI's `db` job ([supabase/README.md](../supabase/README.md#the-access-rule-tests)) |
| 2 | scenario | Plays one real turn on a small staged world |
| 3 | simulation | Plays whole seeded games (fuzz runs, the report-leak runs) |
| 4 | page | Boots a page in jsdom against the stand-in database; the browser specs are page tests in Chromium |

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

## Proving it fails first

A test that can't fail proves nothing (CLAUDE.md, "Fail first"). Show it red without your change, then green with it.

- **On `main`:** run the new test on a checkout of `main` (a `git worktree`, removed afterwards).
- **On a broken copy of the site:** `KC_SITE=/tmp/broken-site npm test` (and `npx playwright test`) points every test
  that opens `site/` at another copy: build the site, break the copy, run the test there.
- **Tests that read `src/`** (`lib/engine.ts`, `lib/source.ts`, the engine's modules) ignore `KC_SITE`: their proof is
  a planted copy of the branch. Copy the branch, plant the fault in the copy's `src/`, and run the test there.
- **A refactor** (label `refactor-only`): new tests pass both before and after, and CI fails if the balance baseline
  changes.
- **A stand-in must be reached:** a test that stands a function in has a check that fails when it isn't
  ([traps.md](../docs/traps.md#a-stand-in-on-a-module-reaches-calls-from-other-files-only)).

## The same answer every time

A test's outcome must not depend on luck (CLAUDE.md, "A test's outcome must not depend on luck").

- **Fixed for every run:** the run stops at once on any Node but `.nvmrc`'s (`setup/global.ts`). The time zone is UTC
  and the locale `en_US`. The seed is `KC_SEED` (default 20261001); a page's dice, `kcRng()`, and the test process's
  `Math.random` are seeded from it. A page's clock is pinned only when a test asks (`bootJsdom(html, {seed, now})`).
- **Refused:** a test set to retry or repeat fails, and so does a `.only`; ESLint refuses a `retry`, `retries` or
  `repeats` in any test file (`harness` checks both). A test that logs with `console.error` or leaves a rejected
  promise unhandled fails, unless it says it expects that with `vi.spyOn(console, 'error')` (`setup/each.ts`).
- **When a test passes only on some seeds,** restructure it: stage the state directly, or make the odds overwhelming.
  Never retries, loops, re-runs, re-seeding or a seed that happens to pass.
- **Failures say how to repeat them.** Under Vitest's report, a footer (`setup/reporter.ts`) prints the seed and, for
  each failed test, the command that repeats it.

## Time limits sized to the work, never a retry

Vitest stops a test after 5 s. A test that builds the site, builds a TypeScript program, runs a tool over the tree
(knip, dependency-cruiser, ESLint) or reads every file of `src/` gets a limit from `lib/time-limits.ts`: an allowance
for each piece of that work, about five times the longest it has taken on GitHub's runners
(`timeLimitForTheWork({ siteBuilds: 3 })`). A property test gets one from its run count
(`timeLimitForPropertyRuns(RUNS, 2.5)`), so `KC_FULL`'s ten times the runs get ten times the time. The static tests
type in no limit of their own.

## The quick check, the ratchet and CI

- **The quick check** (`npm run check`, `tools/check.ts`): the type check, ESLint and Prettier on the files this
  branch changes, the import rules over all of `src/` (`npm run lint:arch`), the ratchet, then the tests. When only
  TypeScript under `tests/` or `tools/` changed, it runs the tests that import those files (`vitest related`).
  Anything else (the site, a test script, `setup/`, a config, the docs) runs every level but page, because
  `vitest related` can't see what the test scripts load: each runs in its own process and reads `site/` (built from
  `src/`) by file name. Page and the browser specs run in CI. Claude Code runs the check before an agent finishes, and
  the type check, ESLint and Prettier after each edit (`.claude/settings.json`, `tools/hooks/`).
- **The ratchet** (`npm run ratchet`, `tools/ratchet.ts`): counts of `@ts-nocheck` (in two: `tsNocheckEngineSide`,
  the engine's side of `src/`, and `tsNocheckUi`, every other file), `@ts-ignore` and `@ts-expect-error`,
  `eslint-disable`, allowlist entries (the HTML rule's reviewed exceptions, `HTML_EXCEPTIONS` in `eslint.config.js`),
  JavaScript files, quarantined tests, test files that load `lib/stub-db.js`, test files on the engine's `vm` loader,
  ESLint's suppressed findings (`eslintSuppressions`: the counts in `eslint-suppressions.json`), the import rules' known
  violations (`knownArchitectureViolations`: the entries of `.dependency-cruiser-known-violations.json`) and what knip
  finds unused (`unusedCode`) may not rise above `ratchet.json`. When one falls, lower it in the same PR
  (`npm run ratchet -- --update` only lowers). `harness` runs the same comparison, so `npm test` fails too.
- **In CI** (`.github/workflows/ci.yml`) each part runs in its own job, side by side, each building `site/` from
  `src/` first: the static checks (type check, lint, the import rules, format, ratchet and the `static` level),
  `unit` and `scenario`, `simulation`, `page`, the browser specs, the balance matrix ([below](#the-balance-matrix-in-brief)),
  and `db`. The job named `ci` passes only when all but `db` passed; `ci` and `db` are the required checks.

## Browser specs

`npx playwright test` is [Playwright Test](https://playwright.dev) (`playwright.config.ts`). It runs the specs in
`tests/browser/*.spec.ts` in Chromium: what only a real browser shows (layout, the requests a page makes, a broken
image's `onerror` really firing). They are not part of `npm test`.

- **The site is served from one folder, as deployed**, by `browser/server.ts` (`lib/boot.js`'s `serve`), which
  Playwright starts on port 4173: `site/`, or the copy in `KC_SITE` (`KC_SITE=/tmp/broken-site npx playwright test`).
  A server already on the port is never reused. Specs open pages by path (`page.goto('/kingdoms-call-gm-portal.html')`)
  and answer supabase-js with a stand-in (`routeExternal`, `lib/stub-db.js`'s `browserSource`).
- **The same answer every time**, as in Vitest: the Node check (`setup/global.ts`), the time zone and locale
  (`setup/fixed.mts`, in Node and in the browser), `KC_SEED` with the same default. No retries, and a `.only` fails
  the run. A failing spec keeps its trace in `test-results/` (in CI, the run's `playwright-traces` download).
- **Wait for what happens, never a fixed time.** ESLint makes `waitForTimeout` an error in the specs, as well as a
  focused or skipped spec (`eslint-plugin-playwright`). A spec waits for the page to finish starting
  (`browser/started.ts`: the last thing each page's own start-up does), and checks with `expect.poll` or web-first
  assertions, which retry until they pass or time out. Where a check is "it happens promptly", the poll's timeout is
  that time (`dispatches-badge`). Code a spec runs inside the page is passed as text when it uses the page's own
  globals.
- **The hostile-name tests are in two halves:** the jsdom half is a test script (`hostile-*.test.js`), the Chromium
  half is `hostile-names.spec.ts`, one test per page and mode.

## The balance matrix in brief

`npm run balance` plays 60 seeded games in the GM portal (48 all-bot, 12 with a scripted realm that sends its orders
as the player portal does) and compares each turn's hashes and statistics with the baseline in `balance/baseline/`.
After every turn it checks the invariants (`lib/invariants.ts`), the report-leak check (`lib/report-leaks.ts`) and the
save's check. Then it plays the same games with a report for every realm. About 40 s; not part of `npm test`. CI's
`balance` job plays it when a pull request changes an engine path, and posts the balance report. `npm run
balance:update` rewrites the baselines in the PR that changes play; a `refactor-only` PR may not change them. Named
scenarios (`npm run balance -- <scenario>`, `balance/scenarios/`) answer one focused question. In full:
[the-balance-matrix.md](../docs/architecture/the-balance-matrix.md).

## Quarantined tests

**Quarantined** tests are not part of `npm test`. Each file's first line says why. They are kept unchanged, never
edited to pass. A quarantined test comes back only when the reason no longer applies: e.g. the expected tabs are
confirmed and the test is updated in its own PR.

| Test | Level | Why |
|---|---|---|
| `quarantine/dispatches-e2e.test.js` | 4 | 70 of 71 checks pass. It expects left-panel tabs Map + Dispatches; the player portal now also has a Report tab |
| `quarantine/one-source.test.js` | 4 | Needs the pre-refactor build of 27 Sept in `quarantine/before/` (or `KC_BEFORE_DIR`). A one-off proof for that refactor |
| `quarantine/one-source-chromium.test.js` | 4 | The "good" and "missing data file" cases pass; the "stale data file" case needs the same pre-refactor build |
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
