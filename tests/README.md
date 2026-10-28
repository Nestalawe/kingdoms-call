
# Tests

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
npm run mutants -- <folder>  # score the mutant patches in <folder> (tools/mutants/run.ts): local only, never in CI (docs/ARCHITECTURE.md#tests)
```

`npm test` is [Vitest](https://vitest.dev) (`vitest.config.mts`, P1-01a). It has one project per level: `static`,
`unit`, `scenario`, `simulation` and `page` (the levels are [below](every-test-its-level-and-what-it-checks.md#the-tests)).

- **New tests** are TypeScript Vitest tests in `tests/<level>/`, e.g. `tests/page/deterministic-boot.test.ts`, or,
  for what only a real browser shows, browser specs in `tests/browser/` ([below](#browser-specs)). Types for the parts
  of `lib/` they use are in `lib/*.d.ts`.
- **The test scripts** (`*.test.js`, written before Vitest) are listed in `suite.ts`, each with its level; a script
  that checks at more than one level sits at its highest. `legacy.test.ts` runs each one as a Vitest test in its own
  Node process, with the same arguments and environment as before; it passes when the script exits 0, and a failure
  shows the end of its output. They become real Vitest tests over P1-14. To add or quarantine a script, edit
  `suite.ts`.
- **The same answer every time.** The run stops at once on any Node but `.nvmrc`'s (`setup/global.ts`). The time
  zone is UTC and the locale `en_US`. A test set to retry or repeat fails, and so does a `.only`. A test that logs with
  `console.error` or leaves a rejected promise unhandled fails, unless it says it expects that with
  `vi.spyOn(console, 'error')` (`setup/each.ts`).
- **Time limits sized to the work, never a retry.** Vitest stops a test after 5 s. A test that builds the site, builds
  a TypeScript program, runs a tool over the tree (knip, dependency-cruiser, ESLint) or reads every file of `src/` gets
  a limit from `lib/time-limits.ts`: an allowance for each piece of that work, about five times the longest it has
  taken on GitHub's runners (`timeLimitForTheWork({ siteBuilds: 3 })`). A property test gets one from its run count
  (`timeLimitForPropertyRuns(RUNS, 2.5)`), so `KC_FULL`'s ten times the runs get ten times the time. The static tests
  type in no limit of their own, and ESLint refuses a `retry`, `retries` or `repeats` in any test file (`harness`).
- **Failures say how to repeat them.** Under Vitest's report, a footer (`setup/reporter.ts`) prints the seed and,
  for each failed test, the command that repeats it.
- **Levels run side by side**, two at a time, slowest first; within a level, up to one test script per core. More
  at once only overloads the machine.
- **The quick check** (`npm run check`, `tools/check.ts`, P1-01b): the type check, ESLint and Prettier on the files
  this branch changes, the import rules over all of `src/` (`npm run lint:arch`, P1-13a), the ratchet, then the tests. When only TypeScript under `tests/` or `tools/` changed, it runs
  the tests that import those files (`vitest related`). Anything else (the site, a test script, `setup/`, a config,
  the docs) runs every level but page, because `vitest related` can't see what the test scripts load: each runs in
  its own process and reads `site/` (built from `src/`) by file name. Page and the browser specs run in CI. Claude Code runs the check before an agent
  finishes, and the type check, ESLint and Prettier after each edit (`.claude/settings.json`, `tools/hooks/`).
- **The ratchet** (`npm run ratchet`, `tools/ratchet.ts`): counts of `@ts-nocheck` (in two since P1-10b1:
  `tsNocheckEngineSide`, the engine's side of `src/`, and `tsNocheckUi`, every other file), `@ts-ignore` and
  `@ts-expect-error`, `eslint-disable`, allowlist entries (the HTML rule's reviewed exceptions, `HTML_EXCEPTIONS` in `eslint.config.js`), JavaScript files, quarantined
  tests, test files that load `lib/stub-db.js`, test files on the engine's `vm` loader, ESLint's suppressed findings
  (`eslintSuppressions`: the counts in `eslint-suppressions.json`, P1-13b; ESLint's warnings on `src/`,
  `eslintWarnings`, before it), the import rules' known violations (`knownArchitectureViolations`: the entries of
  `.dependency-cruiser-known-violations.json`) and what knip finds unused (`unusedCode`, both P1-13a) may not rise
  above `ratchet.json`. When one falls, lower it in the
  same PR (`npm run ratchet -- --update` only lowers). `harness` runs the same comparison, so `npm test` fails too.
- **In CI** (`.github/workflows/ci.yml`, P1-01c) each part runs in its own job, side by side, each building `site/` from
  `src/` first (P1-05): the static checks
  (type check, lint, the import rules, format, ratchet and the `static` level), `unit` and `scenario`, `simulation`, `page`, the browser
  specs, the balance matrix ([below](../docs/architecture/the-balance-matrix.md#the-balance-matrix)), and `db`. The job named `ci` passes only when all but `db` passed; `ci` and `db` are the required checks.

## Browser specs

`npx playwright test` is [Playwright Test](https://playwright.dev) (`playwright.config.ts`, P1-01c). It runs the
specs in `tests/browser/*.spec.ts` in Chromium: what only a real browser shows (layout, the requests a page makes, a
broken image's `onerror` really firing). They are not part of `npm test`.

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
  globals, exactly as the test scripts had it.
- **The specs from the test scripts** (P1-01c) check what the scripts checked, no more and no less. Each script's
  checks became one spec's `expect`s; a fixed wait became a wait for the event it stood for. The hostile-name tests
  were split: the jsdom half stays a test script (`hostile-*.test.js`), the Chromium half is `hostile-names.spec.ts`,
  one test per page and mode.

## The balance matrix

Moved to [the-balance-matrix.md](../docs/architecture/the-balance-matrix.md).

## How the tests reach the site

Moved to [how-the-tests-reach-the-site.md](../docs/architecture/how-the-tests-reach-the-site.md).

## The tests

Moved to [every-test-its-level-and-what-it-checks.md](every-test-its-level-and-what-it-checks.md).

## Code-anchor hooks

None (plan P1-09a). Until then some tests reached inside the GM portal by matching exact lines of the built page, or
cut code out of it between exact strings. Each now calls the function in the engine's bare vm, stands one in there
(`lib/scenario-in-the-vm.ts` for a whole turn), or reads `src/` by its syntax tree (`lib/source.ts`):
[docs/traps.md](../docs/traps.md#string-anchor-harness-hooks). The table is kept, empty, so a test that adds a hook
has to say so here.

| Test | Anchor | In `src/` |
|---|---|---|
