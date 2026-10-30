# The toolchain, the checks and the harness

`npm test` boots the real pages in jsdom against an in-memory Supabase stand-in, with seeded dice (`kcRng`) (and,
where a test asks, a pinned clock). It runs whole all-bot games through the real `runTurn`. What only a real browser
shows (layout, which requests a page makes, an image's onerror really firing) is in the browser specs:
`npx playwright test` opens the pages in Chromium, served from one folder as deployed.
[the list of tests](../../tests/every-test-its-level-and-what-it-checks.md) gives every test, its level and what it checks;
[tests/README.md](../../tests/README.md) says how to write one.

The tools are the standard ones: Vitest runs every test, one project per level (`vitest.config.mts`);
Playwright Test runs the browser specs in `tests/browser/` (`playwright.config.ts`); TypeScript checks the new files
strictly, and the site's since P1-09e (`npm run typecheck`, `tsconfig.json`); ESLint with typescript-eslint lints them
(`npm run lint`, `eslint.config.js`); dependency-cruiser checks the layers of `src/` and that no import cycle appears
(`npm run lint:arch`, `.dependency-cruiser.mts`), and knip finds unused code (`npm run knip`, `knip.ts`), since P1-13a
([ARCHITECTURE.md](../ARCHITECTURE.md#the-layers-and-the-module-map)); Prettier formats them (`npm run format`). Node is pinned exactly (`.nvmrc`, `engine-strict` in
`.npmrc`), and Dependabot proposes updates weekly (`.github/dependabot.yml`). Prettier formats the site's own
TypeScript and CSS in `src/` too (since P1-09c), and `public/`'s two scripts, but not the HTML templates, where
whitespace is content, nor `public/vendor/`. ESLint lints the site's modules (`src/**/*.ts`) in a tier of their own: ESLint's recommended rules and typescript-eslint's `strict` set, which read the code, not its types. A file
of `src/` that TypeScript checks (its first line doesn't switch the check off) gets typescript-eslint's two type-aware
sets too, `strictTypeChecked` and `stylisticTypeChecked`, as the tests and tools do; a file TypeScript skips
doesn't, since with nothing checked every value is `any`. `eslint.config.js` reads which files are which from the
files themselves, so a file freed from the switch-off meets the type-aware sets in that same PR. Only one rule of those
sets is off: `non-nullable-type-assertion-style`, which asks for `x!` where `no-non-null-assertion` forbids it.
**Every rule is an error; none warns**. What the rules found when they came in (830 findings: the 346 the
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

**The engine runs on plain data, and the dice come from one place**. `src/engine/`, `src/views/`,
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
`kc/html-is-built-only-through-kc-html` (P1-13d, [the pages how a portal boots and how a page builds html](the-pages-how-a-portal-boots-and-how-a-page-builds-html.md#how-a-page-builds-html)). They run on
`src/` and on the classic scripts: `public/`'s two, which ESLint lints as classic scripts with its recommended rules
(`kc-config.js` declares `KC_CONFIG`, the global the others read), and the templates' inline scripts and `on…="…"`
handlers, which ESLint's command line doesn't read: `tests/static/the-templates-scripts-pass-the-sites-lint-rules.test.ts`
hands each to ESLint's API under the same block, a handler with its page's handler names.

The harness runs itself. Claude Code hooks, committed in `.claude/settings.json`, check each edited file
(`tools/hooks/after-edit.ts`: type check, ESLint, Prettier, about 1 s) and run `npm run check` before an agent may
finish (`tools/hooks/before-stop.ts`). `npm run check` (`tools/check.ts`) runs the import rules over all of `src/`
(`npm run lint:arch`) and checks what the branch changes: the
TypeScript tests that import a changed file (`vitest related`), or every level but page when anything else changed,
since the test scripts load `site/` (built from `src/`) by file name and `vitest related` can't follow that. `npm run ratchet`
(`tools/ratchet.ts`) keeps the counts in `tests/ratchet.json` from rising: switched-off checks, allowlist entries,
JavaScript files, quarantined tests, tests on `tests/lib/stub-db.js`, tests on the engine's `vm` loader
(`vmLoaderTests`, P1-09d: P1-14 moves them to the engine's modules), the engine's checks of a unit by its type's name
outside the rule registry (`unitNameChecksInEngine`, P1-19a: each row of P1-19 lowers it), and of an item's effect by
its key or an item by its name outside it (`itemEffectChecksInEngine`, P1-19m: each row of the items family lowers it), and of a
spell by its name or its `fn` outside it (`spellChecksInEngine`, P1-19u: each row of the spells family lowers it), ESLint's suppressed findings
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
CI's `balance` job plays it when a pull request or a merge changes an engine path
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
Every night `.github/workflows/nightly.yml` runs `npm run test:full` (the fuzz, the invariants, the leak check
and the property tests at full size) with a random seed it prints; a red night blocks nothing.

## String-anchor harness hooks

They are gone. Until then several tests reached inside the GM portal by matching **exact source lines**
of the built page and injecting code there, and others cut code out of a page between two exact strings, or matched
its text with a regular expression: a reformat (Prettier, P1-09c) or the module switch would have broken them,
some silently. Now no test reads a page's source by line:

- **A test that needs a piece of the site's code, or its words, asks [tests/lib/source.ts](../../tests/lib/source.ts)**,
  which reads `src/` by its syntax tree (TypeScript's parser, for `.js` and `.ts` alike): a file's named declarations
  as a script (`sourceOf`, `sourceFrom`, `scriptOf`, `statementsBetween`), the values it declares
  (`initializersOf`, `entriesOf`), the strings it holds (`stringsOf`, `pageText`), its calls (`callsTo`), or its code
  in one canonical layout for a regular expression (`compactOf`, `compactPage`, `compactDeclaration`). The answers
  are the same however the file is laid out (`tests/unit/the-source-read-by-its-syntax-tree.test.ts` checks every
  file as written and after Prettier). A comment is read as written (`pageSource`).
- **A test that must change a function's behaviour stands it in where it runs:** on the engine's modules, with
  `vi.spyOn` on the module that exports it (plan P1-14a; it reaches calls from other files only:
  [traps.md](../traps.md#a-stand-in-on-a-module-reaches-calls-from-other-files-only)), or, for the tests still on the engine's bare
  vm (`tests/lib/engine.ts`; a whole turn there with `tests/lib/scenario-in-the-vm.ts`), there, where a top-level
  function can be replaced from outside (`W.trySkillGain = …`). On a booted page it can't be, once the page's files are
  modules: a
  test that needs a page to fail where nothing outside can make it fail boots a page built from a planted copy of
  `src/` (`plantedSite`, with `plantAtStart` or `plantBefore`, found by the syntax tree too).
- Don't add a test that matches a line, an indent or a quote style of the site's code, or that writes to a page's
  function or top-level variable from outside (`W.fn = …`, `W.eval('flag=true')`): after the module switch it would
  do nothing, and the test could pass without testing anything.
- **A check that picks the site's files by their name must fail when it reads none.** When the files became `.ts`, `html-lint` and `sort-comparators`, which read every `src/**/*.js`, still passed reading only the templates:
  `html-lint`'s stale allowlist entry gave it away. Both are ESLint rules now (P1-13c and P1-13d), and
  `tests/static/harness.test.ts` checks every file of `src/` gets them. A new check of `src/` reads the pages' modules,
  or checks it does.

## A test on the engine's modules loads the whole engine first

A test that imports the engine's functions from their modules imports
[tests/lib/the-whole-engine.ts](../../tests/lib/the-whole-engine.ts) first. Some files change other files' values as they
load: `engine/items/equipment.ts` re-tiers two of the content's tables (`ALL_MAGIC_ITEMS_P` and `LEGENDARY_ITEMS_P`).
A test that imports only the data file, or only the files one function reaches (`world/generate.ts` reaches 44 of the
116 files of `src/engine/` and `src/views/`), reads those tables as they were before, which neither the GM page nor
the engine's bundle ever does. `tests/unit/engine-loads.test.ts` checks that, with the whole engine loaded, every
export of the modules holds what the bundle holds.

The modules also keep state between calls (the name pools, `_usedHeroNames` and the like): a world depends on the
worlds made before it in the same process. A test whose outcome depends on the dice gives itself fresh modules:
`vi.resetModules()`, then `await import(…)` of the whole engine and of what it calls, then `kcRng.seed(…)`
([tests/lib/a-staged-turn-on-the-engines-modules.ts](../../tests/lib/a-staged-turn-on-the-engines-modules.ts) does). Then
`-t "<name>"` repeats it. A file of tests on tables and pure functions imports statically: Vitest gives each file
fresh modules.

## A stand-in on a module reaches calls from other files only

`vi.spyOn(module, 'name')` on the module that exports a function replaces it for the calls other files make, since
Vitest reads an imported name from the exporting module each time. A call inside the function's own file goes straight
to the real one. Found in P1-14's scoping: a spy on `d100` saw 10,362 calls in eight bot turns and changed the game when
it answered 1, but `pctRoll`, in `d100`'s own file, kept calling the real `d100`. In the engine's vm a stand-in
(`W.d100 = …`) reaches every caller, so a test moved off the vm can lose its stand-in without a sound.

- Show the stand-in is reached: a test that stands one in has a check that fails when it isn't (its planted fault
  turns it red).
- A function called inside its own file is staged around (the state, or the dice with `kcRng.use`), not stood in.
- `restoreMocks` (`vitest.config.mts`) puts every spy back after each test.

## A fixed lint finding must leave the suppressions

Every lint rule is an error. What the rules found when they came in (809 findings) is listed in
`eslint-suppressions.json`: ESLint's bulk suppressions, which say, per file and rule, how many findings that file may
hold. ESLint's command line reads it (`npm run lint`, `npm run check`, the edit hook); its API (`new ESLint()`, as
`tests/static/harness.test.ts` uses) doesn't. The ratchet counts the list (`eslintSuppressions`), so it only falls.

- **A new finding fails**, even of a rule the file already has suppressed findings of. Once a file holds more than
  its count, ESLint reports every finding of that rule in the file, not only the new one: `src/db/game-meta.ts` may
  hold five unused variables, and a sixth shows all six. Fix the new one.
- **A fixed finding fails too, until it leaves the list.** Fix one of the five and lint stops with "There are
  suppressions left that do not occur anymore" (exit 2). Run `npx eslint --prune-suppressions`, which lowers the
  count, then `npm run ratchet -- --update`, and commit both with the fix. Never `--pass-on-unpruned-suppressions`.
- **Moving code moves its findings.** A function moved to another file takes its findings with it: the old file
  holds fewer (prune it), the new one more (it fails). Run `npx eslint --suppress-all <new file>` and
  `npx eslint --prune-suppressions`: the total stays the same, and the ratchet refuses a rise.

## A sort comparator must give the same answer every time

`.sort(()=>Math.random()-0.5)`, or a random tie-break like `(a,b)=>(a.d-b.d)||(Math.random()-0.5)`, is
not a shuffle. How often the engine calls the comparator, and so the order it produces and how many
random numbers it uses, is up to the JavaScript engine. So the same seed gives a different world on a
newer Node or Chrome. In Oct 2026 world generation came out different on Node 26 than on Node 24,
because of two such sorts.

- To shuffle, use `shuffleP(arr, rnd)` (Fisher-Yates; `rnd` defaults to `Math.random`).
- To order randomly within ties, shuffle first, then sort by the real key alone: the sort is stable, so
  ties keep their shuffled order.
- Lint refuses a random or argument-less comparator (`kc/no-random-or-argument-less-sort-comparator`, P1-13c), in
  `src/`, `public/`'s scripts and the templates' scripts.

## The repository's files, folder by folder

CLAUDE.md's file map gives one short row a path; this is the full map.

| Path | What |
|---|---|
| `src/` | The site's source, TypeScript modules (most files still say `// @ts-nocheck`: P1-10 and P1-16 type them). `npm run build` (Vite) builds it into `site/` (git-ignored): what is published and what every test opens ([ARCHITECTURE.md](the-build-from-src-to-site.md#the-build-src-becomes-site)). `*.html` (the pages' templates), `engine/` (the turn engine, bots, world generation; `engine/rules-on-plain-values/`: the rules of a hero, an army, an item or a number, which import only `src/content`; `engine/rules/`: the rule registry, each content effect's entry and its effects at the stages of the hook points, which import only that folder, the rules on plain values and `src/content`; `engine/saves/`: a saved game's version and its upgrade, run before every turn), `shared/` (the player portal's one door to them: it re-exports from that folder only), `views/` (every realm's turn report, the lines each realm reads, and what it may see of the world, `playerView`; the sight rules it applies are `engine/sight/`'s; `views/prose/`: the words of each line, which the engine records as a fact; with `engine/`, the engine: bundled and loaded alone in Node, `tests/lib/engine.ts`), `db/` (`kc-db-guard.ts`: the version guard; telemetry), `schemas/` (the saved state's and the submitted orders' Zod schemas, which give the world its types; imported for code only by the save's upgrade, whose check at load parses with them), `content/kingdoms-call-data.ts` and `content/unit-abilities-their-names-numbers-and-words.ts` (the rows of the abilities the registry holds, and every unit's ability blurb, `UNIT_ABILITIES`, which the player portal shows), `ui/<page>/` (each page's styles and code; `page.ts`, its entry, imports its files in order, `globals.ts`, last, what it keeps on `window`), `ui/shared/` (`kc-safe.ts`: `kcHtml`/`kcEsc`, the one way a page builds HTML, [ARCHITECTURE.md](the-pages-how-a-portal-boots-and-how-a-page-builds-html.md#how-a-page-builds-html)), `rulebook/`, `globals.d.ts` (the names the modules read without importing them). `public/`: copied as it is (`kc-config.js`: which database; `kc-staging-footer.js`; `vendor/`, supabase-js, [ARCHITECTURE.md](../ARCHITECTURE.md#supabase-js-the-copy-served-with-the-site)) |
| `supabase/` | The database: `schemas/` (the desired structure, one file per table with its access rules), `migrations/` (generated from it, then reviewed), `config.toml`, `tests/` (the access-rule tests, pgTAP). How to change it: `supabase/README.md`. `.github/workflows/schema-pull.yml` reads the live structure |
| `tests/` | `suite.ts` (every test script, with its level), `legacy.test.ts` (runs them in Vitest), `*.test.js` (the test scripts), `<level>/*.test.ts` (new tests: TypeScript, Vitest), `browser/*.spec.ts` (browser specs: Playwright Test, Chromium), `setup/` (the run's checks and footer), `lib/boot.js` (the one way to load a page), `lib/stub-db.js` (in-memory Supabase stand-in), `lib/invariants.ts` and `lib/report-leaks.ts` (what must hold after every turn; what no report may show), `fixtures/saves/` (a made-up save of each version, `version-<n>.json`), `quarantine/` (kept, not run) |
| `vitest.config.mts`, `playwright.config.ts`, `tsconfig.json`, `eslint.config.js`, `.dependency-cruiser.mts`, `knip.ts`, `.prettierrc.json`, `.nvmrc`, `.npmrc`, `.claude/settings.json` | The toolchain: tests by level, browser specs, strict TypeScript, lint (every rule an error; what the rules found when they came in is listed in `eslint-suppressions.json`), the layers and no import cycle (dependency-cruiser; what broke a rule when it came in is listed in `.dependency-cruiser-known-violations.json`), unused code (knip, `npm run knip`), formatting, the exact Node version, the Claude Code hooks |
| `tools/` | `build.ts` (`npm run build`), `dev.ts` (`npm run dev`), `pages.ts` (which files make each page), `check.ts` (`npm run check`), `hooks/` (the Claude Code hooks), `ratchet.ts` (`npm run ratchet`; baseline `tests/ratchet.json`), `module-map.ts` (the module map in `docs/ARCHITECTURE.md`), `eslint-rules/` (the project's own lint rules, the plugin `kc`), `balance/` (the balance matrix, `npm run balance`; baselines in `tests/balance/baseline/`; its report, `npm run balance:report`; named scenarios in `tests/balance/scenarios/`, `npm run balance -- <scenario>`), `mutants/` (the mutant scorer, `npm run mutants -- <folder>`: does a fault in `src/` turn a check red? Local only, never in CI), `github/` (the script that posts the balance report on a PR), `deploy/` (what the deploy's and staging's build jobs run before the upload: it keeps the files a cached page still names), `saves/` (the script that makes a save fixture from a seeded bot game), `legacy/` (older content-export tools, kept for reference; not run by the tests), `merging/kc-merge.zsh` (shell helpers to merge a PR, or a range of them one after the other, and wait for the deploy, sourced by hand: zsh, not TypeScript, since no build or test runs it; how to load it is in its first lines) |
| `.github/workflows/` | `ci.yml` (on every PR, jobs side by side: static checks, each test level, the browser specs, the balance matrix and its report when an engine path changed, the database; `ci` and `db` are the required checks; `deploy.yml` calls it), `deploy.yml` (on `main`: test, migrate production once Toby approves, then build `site/` in a job that can only read, and publish it to Pages from another), `balance-report.yml` (posts the balance report on a PR once CI finishes, and warns while "What changes in play" is missing), `dangerous-paths.yml` (warns on a PR that changes a dangerous path), `merges-into-main.yml` (red on a PR that would merge into a branch other than `main`, e.g. a stacked PR whose base hasn't merged yet), `overlord.yml` (sets the Overlord account on the live database; run by hand, Toby approves), `nightly.yml` (`npm run test:full` with a random seed every night; blocks nothing) |
| `.github/dangerous-paths`, `.github/scripts/dangerous-paths.js`, `.github/pull_request_template.md` | The dangerous-paths list and the warning's logic (see below); the PR template (fill in every section) |
| `docs/` | Architecture, traps, how to try a change on staging (`staging.md`), Toby's rulings (`rulings/`) |
