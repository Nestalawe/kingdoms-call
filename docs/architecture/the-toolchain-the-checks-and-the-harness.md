# Tests

`npm test` boots the real pages in jsdom against an in-memory Supabase stand-in, with seeded dice (`kcRng`) (and,
where a test asks, a pinned clock). It runs whole all-bot games through the real `runTurn`. What only a real browser
shows (layout, which requests a page makes, an image's onerror really firing) is in the browser specs:
`npx playwright test` opens the pages in Chromium, served from one folder as deployed.
[tests/README.md](../../tests/README.md) lists every test, its level and its origin.

The tools are the standard ones (P1-01): Vitest runs every test, one project per level (`vitest.config.mts`);
Playwright Test runs the browser specs in `tests/browser/` (`playwright.config.ts`); TypeScript checks the new files
strictly, and the site's since P1-09e (`npm run typecheck`, `tsconfig.json`); ESLint with typescript-eslint lints them
(`npm run lint`, `eslint.config.js`); dependency-cruiser checks the layers of `src/` and that no import cycle appears
(`npm run lint:arch`, `.dependency-cruiser.mts`), and knip finds unused code (`npm run knip`, `knip.ts`), since P1-13a
([above](../ARCHITECTURE.md#the-layers-and-the-module-map)); Prettier formats them (`npm run format`). Node is pinned exactly (`.nvmrc`, `engine-strict` in
`.npmrc`), and Dependabot proposes updates weekly (`.github/dependabot.yml`). Prettier formats the site's own
TypeScript and CSS in `src/` too (since P1-09c), and `public/`'s two scripts, but not the HTML templates, where
whitespace is content, nor `public/vendor/`. ESLint lints the site's modules (`src/**/*.ts`) in a tier of their own
(P1-09e): ESLint's recommended rules and typescript-eslint's `strict` set, which read the code, not its types. A file
of `src/` that TypeScript checks (its first line doesn't switch the check off) gets typescript-eslint's two type-aware
sets too, `strictTypeChecked` and `stylisticTypeChecked`, as the tests and tools do (P1-13b); a file TypeScript skips
doesn't, since with nothing checked every value is `any`. `eslint.config.js` reads which files are which from the
files themselves, so a file freed from the switch-off meets the type-aware sets in that same PR. Only one rule of those
sets is off: `non-nullable-type-assertion-style`, which asks for `x!` where `no-non-null-assertion` forbids it.
**Every rule is an error; none warns** (P1-13b). What the rules found when they came in (830 findings: the 346 the
site's tier found as the code became TypeScript, what the type-aware sets found, and P1-13c's 21 reads of the database) is listed in
`eslint-suppressions.json`, ESLint's own bulk suppressions, per file and rule with a count. The command line reads it
(`npm run lint`, `npm run check`, the edit hook): a new finding fails, and a listed one that no longer occurs fails too
until it is taken out of the list (`npx eslint --prune-suppressions`,
[traps.md](../traps.md#a-fixed-lint-finding-must-leave-the-suppressions)). The ratchet counts the list
(`eslintSuppressions`), so it only falls. Four rules are the site's own. `ban-ts-comment`: a
file is left unchecked only with its reason. `consistent-type-assertions` (no `as` but `as const`) and
`no-non-null-assertion` (since P1-10a1): no claim the compiler takes on trust. And `no-undef` (since P1-09d): a file
that reads a name it neither imports nor declares fails the lint, not the page that first runs it (P1-08a began it for
the engine). The engine
(`src/engine/`, `src/views/`, the data file) may read only JavaScript's own names and `console`; the rest of `src/` the
browser's names too, `KC_CONFIG` and `supabase` (the page's classic scripts'), and its declared globals, which
`eslint.config.js` works out from the files' `globalThis.<name> = …` lines.

**The engine runs on plain data, and the dice come from one place** (P1-13c). `src/engine/`, `src/views/`,
`src/content/`, `src/shared/` and `src/schemas/` may not read the page, the browser or a timer (`window`, `document`,
`localStorage`, `sessionStorage`, `fetch`, `navigator`, `location`, `setTimeout`, `setInterval`, `globalThis`), the
time (`Date`), the browser's random source (`crypto`) or the database (`supabase`, `sb`): ESLint's
`no-restricted-globals`, which catches a read behind `typeof` too. Three files are the reviewed exceptions, one name
each, which `tests/static/harness.test.ts` pins: `engine/bots/economy.ts` reads `window` (the bots' two test hooks),
`engine/rng.ts` `crypto` (the dice's seed when no test gives one), `engine/clock.ts` `Date`. `Math.random` is refused
in every file of `src/` but `engine/rng.ts`, and in the classic scripts, through `Math` (`no-restricted-properties`) or
through any object's `Math`, as `window.Math.random` (`no-restricted-syntax`). Only `src/db/` may read `supabase`, the
client's global; the four pages' `createClient` calls are in the suppressions, for P1-17's access layer.

**The project's own rules** are ESLint rules in TypeScript (`tools/eslint-rules/`, the plugin `kc`, P1-13c), each with
its RuleTester test in `tests/unit/`: `kc/no-random-or-argument-less-sort-comparator` ([traps.md](../traps.md#a-sort-comparator-must-give-the-same-answer-every-time)),
`kc/big-tables-and-profiles-are-read-by-named-columns` ([traps.md](../traps.md#select-on-big-tables)) and
`kc/html-is-built-only-through-kc-html` (P1-13d, [above](the-pages-how-a-portal-boots-and-how-a-page-builds-html.md#how-a-page-builds-html)). They run on
`src/` and on the classic scripts: `public/`'s two, which ESLint lints as classic scripts with its recommended rules
(`kc-config.js` declares `KC_CONFIG`, the global the others read), and the templates' inline scripts and `on…="…"`
handlers, which ESLint's command line doesn't read: `tests/static/the-templates-scripts-pass-the-sites-lint-rules.test.ts`
hands each to ESLint's API under the same block, a handler with its page's handler names.

The harness runs itself (P1-01b). Claude Code hooks, committed in `.claude/settings.json`, check each edited file
(`tools/hooks/after-edit.ts`: type check, ESLint, Prettier, about 1 s) and run `npm run check` before an agent may
finish (`tools/hooks/before-stop.ts`). `npm run check` (`tools/check.ts`) runs the import rules over all of `src/`
(`npm run lint:arch`) and checks what the branch changes: the
TypeScript tests that import a changed file (`vitest related`), or every level but page when anything else changed,
since the test scripts load `site/` (built from `src/`) by file name and `vitest related` can't follow that. `npm run ratchet`
(`tools/ratchet.ts`) keeps the counts in `tests/ratchet.json` from rising: switched-off checks, allowlist entries,
JavaScript files, quarantined tests, tests on `tests/lib/stub-db.js`, tests on the engine's `vm` loader
(`vmLoaderTests`, P1-09d: P1-14 moves them to the engine's modules), the engine's checks of a unit by its type's name
outside the rule registry (`unitNameChecksInEngine`, P1-19a: each row of P1-19 lowers it), ESLint's suppressed findings
(`eslintSuppressions`, P1-13b; the site's lint warnings, `eslintWarnings`, before it), the import rules' known violations (`knownArchitectureViolations`) and what knip finds unused (`unusedCode`,
both P1-13a). `tests/static/harness.test.ts` fails if any
of these settings, or the strict compiler and lint settings, is missing or weakened, and every harness file is a
dangerous path.

The balance matrix (`npm run balance`, `tools/balance/`, P1-02a) measures engine changes: 60 seeded games played in
the GM portal (48 all-bot, 12 with a realm whose orders the runner chooses and sends as the player portal sends them:
`tools/balance/scripted.ts`, `tools/balance/the-orders-the-player-portal-sends.ts`, P1-15e2), each game's per-turn hashes and
statistics compared with the committed baseline in `tests/balance/baseline/`, statistics paired by seed against the
noise of a second seed set. One of the hashes is of every write the turn sends to the stand-in database
(`tools/balance/writes.ts`, P1-02c), so a change to how a turn saves shows even when nothing in play changed. After every turn it checks the **invariants** (`tests/lib/invariants.ts`, P1-04b: no NaN or
`undefined`, HP in range, unique ids, items matching the ledger of found items, armies on the map, the dead taking no
actions, `orders_submitted` cleared), as `turn-fuzz` does, and the **report-leak check** on the scripted realm's report
(`tests/lib/report-leaks.ts`, P1-04c: another realm's private line, an unmet realm, a hero under Invisibility); a breach
fails the game. So does the **save's check** (P1-15e1, `tools/balance/a-game-fails-on-the-save-check.ts`): a
`[Save check]` line in a turn's GM log, and, after the last turn, the check of the last save, which no turn loads; a
place found on `main` whose fix waits is let through by a narrow entry in its known list, empty today. Its second
half, **every realm's report** (`tools/balance/every-realm.ts`, P1-12a1), plays the same
games in the engine's `vm` with a report for every realm every turn, bots' too, runs the leak checks on each, and
compares each report, hashed, with its own baseline (`tests/balance/baseline/reports.json`, both sets), so a change in
perception shows in every realm, not only the scripted one. It isn't part of `npm test`: about 40 s on 14 cores
([tests/README.md](the-balance-matrix.md#the-balance-matrix)).
CI's `balance` job (P1-02b) plays it when a pull request or a merge changes an engine path
(`tools/balance/engine-paths.ts`: the files in `src/` that the GM portal's page is built from, the pages' templates,
`public/`, the build itself and its page list, the balance code and baselines, the test helpers it boots the page with, and `package-lock.json` and `.nvmrc`, since a jsdom or Node
bump can change the games), and fails if any game differs from the committed baseline.
A pull request labelled `refactor-only` fails if it changes the baseline at all. On a pull request the job also
makes the **balance report** (`tools/balance/report.ts`, P1-03a): the class of change (no change, wording only, writes only, a
reshape judged as a whole, or a rule change judged by where games first differ and by its slices), in game terms. The
job can only read, so it uploads the report as data; `.github/workflows/balance-report.yml`, run when CI finishes,
posts it as one comment with the default branch's `tools/github/balance-comment.ts`, never the pull request's code.
**Named scenarios** (`npm run balance -- <scenario>`, `tools/balance/scenario.ts`, P1-03c) answer a focused question
("how often do these archers beat those guards in the hills?"): a scene staged in `tests/balance/scenarios/` through
`tests/lib/scenario.js`, played 400 times on a copy of `main`'s site and on the branch, paired by seed and judged by
the same noise rule, labels and words as the report. Run by hand, not in CI, except a scenario that **requires**
figures (P1-15e2b, `requires`): every `npm run balance` plays it first, on this site only, and fails if it misses one, so
CI's balance job plays it whenever it plays the matrix. Today one: `a-chase-held-by-an-unresolved-battle`, a chase held
by an unresolved battle, which the matrix's games meet only by luck (20 runs, about 3 s).
**The mutant scorer** (`npm run mutants -- <folder>`, `tools/mutants/run.ts`, P1-21a) measures the tests themselves:
"if the code were wrong, would we notice?". A mutant is a small fault in `src/`, written as a patch by a mutation
session (the plan's protocol), with an `Area:` and an `Imitates:` line (the real bug it imitates) before the diff. The
scorer first runs every stage on the checkout's `HEAD` with no patch (the control run; the tree must be clean, and any
red stops it), then each patch, one at a time, in a throwaway git worktree in the system's temporary folder with
`node_modules` copied in without its caches: `npm run build` (red means the patch is broken), then the compiler, lint
(with the import rules), `npm test` and the balance matrix. A mutant is **caught** when any of the four goes red or runs
past five times its control time (at least a minute), **survived** when all four are green, and **broken** (the
mutator's mistake, never "survived") when it has no header, changes a file outside `src/`, doesn't apply or doesn't
build. It prints a table and writes `results.json` and each stage's log beside the patches. About 2.3 minutes a mutant.
Local only, never in CI: it stops when `CI` is set, and `harness` checks no workflow runs it. The patches say where the
tests are weak, so they never enter this repository: the scorer refuses a folder git would commit.

CI runs it all on every pull request, in jobs side by side so the fastest failure shows first
(`.github/workflows/ci.yml`, P1-01c): the static checks (type check, lint, format, ratchet, the static tests), the
unit and scenario tests, the simulations, the page tests, the browser specs, the balance matrix, and `db` (the access-rule tests and
`supabase db lint`, which checks the database's functions). The job named `ci` passes only when every job but `db`
passed; `ci` and `db` are the checks `main` requires. `deploy.yml` runs the same workflow before it publishes.
A pull request has one CI run at a time: a push, or a label added or removed, cancels its run still going (the
workflow's `concurrency` group, keyed on the pull request's number), so read the newest run on the head commit. A
cancelled run's `ci` job fails, and staging's wait for CI reads the newest run alone. Deploy's call has a group of
its own, its run's id, so it is never cancelled.
Every night `.github/workflows/nightly.yml` (P1-04d) runs `npm run test:full` (the fuzz, the invariants, the leak check
and the property tests at full size) with a random seed it prints; a red night blocks nothing.
