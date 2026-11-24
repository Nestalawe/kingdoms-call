# Traps

One entry per trap that still applies: its rule and what checks it (or "nothing checks it"). Read the titles first,
then the entries your work touches. Each entry's full text, its example with it, is under the same title in the topic
file of its part, under [architecture/](architecture/). A trap that cost you time goes here in the same PR, in at most
1.5 KB (`tests/the-docs-budgets.json`), and its example and detail in the topic file.

## Edit `src/`, never `site/`

`site/` is build output: git-ignored, and rewritten from `src/` by every test run, so an edit there is never
committed and the next build quietly undoes it. Change `src/` (or `public/`, copied as it is); a new file is imported
where it is read, and by the page's `page.ts` if it does something as it loads. Checks: `pages-build` fails on a file
of `src/` no page reaches; nothing stops an edit to `site/`.
Detail: [the build](architecture/the-build-from-src-to-site.md#the-build-src-becomes-site).

## A deploy keeps the files a cached page names

Never publish `site/` without the keep step (`tools/deploy/keep-the-previous-deploys-files.ts`, between
`npm run build` and the upload in both build jobs), and never rename `published-files.json` or `version.json`, or type
a version by hand. Checks: `tests/static/harness.test.ts` (the step is there, right after the build, and can't be
skipped or fail quietly) and `tests/unit/a-deploy-keeps-the-files-a-cached-page-still-names.test.ts`.
[Detail](architecture/the-build-from-src-to-site.md#a-deploy-keeps-the-files-a-cached-page-names).

## A job after a skipped job is skipped, unless its `if` says otherwise

A job after one that may be skipped says `!cancelled()` and the results it needs, as `build` and `deploy` do
(`deploy`: `!cancelled() && needs.build.result == 'success' && github.ref == 'refs/heads/main'`). A plain `if` gets
GitHub's `success()`, which reads every job before it in the `needs` chain. Checks: `tests/static/harness.test.ts`
refuses `deploy` without them, or with `always()`.

## A constant read at load time must live in a leaf module

A constant another file reads as it loads lives in a file of its own that imports nothing, and `page.ts`'s import
order is not changed. Checks: `npm run lint:arch` fails on a new import cycle (none is known now); the page test
`every-page-of-the-site-boots-in-jsdom-…` and `chromium-boot` catch a page that no longer boots.
[Detail](architecture/the-build-from-src-to-site.md#a-constant-read-at-load-time-must-live-in-a-leaf-module).

## `select('*')` on big tables

Pollers, lists and anything that runs often select named columns (`Db`'s light lists) and read summaries from
`games.meta`; the full world is loaded only when it's really needed, once. Checks: lint
(`kc/big-tables-and-profiles-are-read-by-named-columns`) refuses every column of `games`, `game_players`, `turn_logs`
or `profiles`, and `profiles`' `email`; `Db`'s answers are typed by the columns each read names, so the compiler
refuses a read of a column left out.
[Detail](architecture/the-database-and-what-it-holds.md#select-on-big-tables).

## A new column must be optional at the write site

Code that writes a new column copes while the column is missing: probe once (`probeGameMeta`), spread `{}` for the
field while it's absent (`metaPatch`); readers fall back to the old source. Checks: a test that hides the column (the
fake's `missingColumns`, `tests/lib/fake-db.ts`), as `tests/page/the-gm-page-runs-and-saves-a-turn-while-the-games-meta-column-is-missing.test.ts` does. This is why database and
site changes go in separate PRs ([supabase/README.md](../supabase/README.md#database-and-site-changes-go-separately)).

## A site change that needs a database change

A site PR that can't work without a migration raises `KC_DB_MIN` to the migration's 14-digit version in every page
that needs it, and never lowers it to get past the stop. Otherwise cope
([above](#a-new-column-must-be-optional-at-the-write-site)).
Checks: [the guard check](../tests/static/every-page-on-the-database-starts-through-its-guard-and-needs-no-unmerged-migration.test.ts) fails if a `KC_DB_MIN` is newer than the newest file in `supabase/migrations/`; [a page
test](../tests/page/each-page-that-reads-the-database-takes-the-db-a-test-hands-it.test.ts) boots each page on an older database. [Detail](architecture/the-database-and-what-it-holds.md#a-site-change-that-needs-a-database-change).

## String-anchor harness hooks

No test reads a page's source by its lines, indent or quotes, or writes to a page's function or variable from outside.
Read `src/` through `tests/lib/source.ts` (by its syntax tree); stand a function in on the engine's modules with
`vi.spyOn`, or in the engine's vm; boot a page that must fail from a planted copy (`plantedSite`). Checks:
`tests/unit/the-source-read-by-its-syntax-tree.test.ts` and `page-globals`; the ESLint rules replaced the name-picking
checks. Detail: [the tests' helpers](architecture/how-the-tests-reach-the-site.md).

## A test on the engine's modules loads the whole engine first

A test that imports the engine's functions from their modules imports
[tests/lib/the-whole-engine.ts](../tests/lib/the-whole-engine.ts) first. The modules keep state between calls (the
name pools), so a test whose outcome rests on the dice takes fresh modules (`vi.resetModules()`, `await import(…)`,
then `kcRng.seed(…)`). Checks: `tests/unit/engine-loads.test.ts` (every export holds what the bundle holds).

## A stand-in on a module reaches calls from other files only

`vi.spyOn(module, 'name')` replaces a function for the calls other files make; a call inside the function's own file
still reaches the real one. So a test that stands one in has a check that fails when it isn't reached (its planted
fault turns it red); a function called inside its own file is staged around (the state, or `kcRng.use`). Checks:
nothing but that check; `restoreMocks` (`vitest.config.mts`) puts every spy back after each test.

## A lifted helper takes the turn's context first

An engine helper that reads the turn's state takes `turnContext` as its first argument, and one passed as a value is
wrapped where it's passed: `(...a)=>effStat(turnContext,...a)`. A value the turn changes as it goes lives only in the
context: read and write `turnContext._currentPhase`, never a local copy. Checks: `no-undef` can't see it; the balance
matrix catches it in the code it runs, a direct test anywhere else. How a test calls a helper, an order or a stage:
[the turn's context](architecture/the-turns-context-and-calling-its-helpers-and-stages-from-a-test.md#a-lifted-helper-takes-the-turns-context-first).

## A line goes through `emit`

Every line of the turn enters the GM's log through `emit(turnContext, event)`
(`src/engine/turn/events-and-their-audiences.ts`), and its event says who may read it (`audience`). A line records a
fact (values, never words or a live part of the world), and `src/views/prose/` writes its words after the turn. In
full, with "Every event names its hero" and "A line for one realm alone inside a fight":
[a line of the turn](architecture/a-line-of-the-turn-emit-its-facts-and-the-reports.md). Checks: the lint rule
`kc/narrative-lines-go-through-emit` (it also refuses an event with a `text` key and a string handed to `narrate`,
`emitNarrLine`, `narrateAll` or `narrateAt`); `emit` throws on an event with no `hero` or no `phase`, or handed as
words; `emit`'s type takes a kind for one realm alone only told to that realm (B-19);
`a-lines-facts-hold-values-not-words`; the report-leak check (`tests/lib/report-leaks.ts`).

## Views never write

Building the reports reads the world and the GM's log, and writes to neither, even the same value back; a rule that
changes the world belongs to the engine, before the reports. The reports draw no dice either. Checks:
`tests/unit/the-reports-are-built-on-a-world-that-cannot-be-written.test.ts` plays a whole matrix game with every
report built on a world and a log that refuse every write, on dice that count every draw. Detail:
[a line of the turn](architecture/a-line-of-the-turn-emit-its-facts-and-the-reports.md#views-never-write).

## Nothing is on `window` but `globals.ts`

A function or constant an inline handler calls, or a test reaches, goes on a list in `src/ui/<page>/globals.ts`, and
a variable they read or write is a declared global, `globalThis.<name> = <value>;`. Checks: `page-globals` fails on a
name missing from a list, a variable that isn't a declared global, or a page stand-in.
[Detail](architecture/the-pages-how-a-portal-boots-and-how-a-page-builds-html.md#nothing-is-on-window-but-globalsts).

## `game_state` is a string

On a `games` row, `game_state` is a JSON **string**: always read it through `parseGameState(game)`, never off the row.
Before adding a new reader, grep for `game_state` reads that don't parse. Checks: nothing checks it.

## A refactor that changes a container's type needs a test that calls the consumers

When a refactor changes a type (array ↔ `Set`, object ↔ `Map`), test through the consumers, not by comparing
contents, and grep every method used on the name (`.includes`, `.has`, `.length`, `.size`, indexing) first. Checks:
the type check.

## Post-commit work in `runTurn`

After the save in `runTurn` (`src/ui/gm/turn-shell.ts`), the turn is resolved and stored: a throw there must not
restore orders, re-flag `orders_submitted` or let the watcher retry. `_turnCommitted` marks a successful save; the
reports are built only after it, never inside `resolveTurn`. `runTurn` returns `{ok, committed, conflict, error}` on
every path and never throws. Checks: `tests/page/turn-shell.test.ts` (the post-save guard plants a throw in
`buildTurnReport`; each failure's outcome). [Detail](architecture/the-turn-engine.md#post-commit-work-in-runturn).

## Hooks in the turn path must never fail a turn

Telemetry and Hall-of-Fame writes inside `runTurn` are each wrapped in `try { … } catch {}`: a statistics bug must
never cost a turn, so a broken hook is silent, and hooks are tested by the rows they write. Coerce numbers with
`Number()` and `isFinite`, not `|| 0`. Checks: page tests scan the rendered HTML for `undefined`, `NaN` and
`[object Object]`; a record for the statistics is a fact filed with `recordForTheStatistics`, in its caller's `try`,
and the lint rule refuses a write to `_tel`'s lists elsewhere
([the statistics' one door](architecture/the-database-and-what-it-holds.md#hooks-in-the-turn-path-must-never-fail-a-turn)).

## A rule written twice must change twice

Before changing a rule, grep the engine and both portals for its nouns **and its numbers**, and change every place in
the same commit; when a number moves, grep the old number in narrative strings and the rulebooks. A rule the player
portal takes through `src/shared/` is written once; it is still restated in the portal's projections (its forecasts
and the copies left), at order time and resolution time, in the balance matrix's scripted realm, and in the words
players read. Checks: `the-player-portals-copies-agree-with-the-engine`, `the-order-forms-forecasts-agree-with-the-turn`,
the scripted realm's page test and the `*-words` tests, for what they cover. Battle magic is one stage of the spells'
registry, asked by three copies with one rule (R-126) and each its own lines; the units' strikes are another, asked by
three copies that each keep their own roll. Veteran Training's +1 is one stage of the discoveries' registry, asked by
the fight (`pcCharCombatant`) and the hero's card (`extraSkillBonuses`).
[Where](architecture/adding-or-changing-content-units-orders-and-discoveries.md#a-rule-written-twice-must-change-twice).

## HTML is built only through `kcHtml`

Every name and message on screen was typed by someone, so a page builds HTML only through `kcHtml` / `kcEsc`
(`src/ui/shared/kc-safe.ts`), and markup inside a value is `kcHtml` too. Never join `kcHtml` with `+` or `.join('')`.
Checks: lint (`kc/html-is-built-only-through-kc-html`, exceptions in `HTML_EXCEPTIONS`, `eslint.config.js`) catches
most; `node tests/tools/same-dom.ts <main's site>` finds the rest on the screens a tour visits. Every mistake it can't
see: [here](architecture/the-pages-how-a-portal-boots-and-how-a-page-builds-html.md#html-is-built-only-through-kchtml).

## Order is data

`KC_*` arrays and object keys are walked for random picks, tie-breaks and dropdowns: append, never re-sort. Never
reorder a character's `items` (Send Item addresses them by index). A stage of the rule registry runs its effects in the
order of `THE_ORDER_OF_EACH_STAGE` (the items', `THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS`), not of the entries or the
content's rows: the commander's items round each step as it goes, so the Battle Standard's +2 comes before the Golden
Spur's ×1.25; the siege halves what home defence added, so the Banner of the Realm comes first; a fighter reaches for
his combat items in the stage's order, a healing before a second wind. Checks: the balance matrix, when a game meets
the order; the commander's items' unit cases, the battles' items' scenario cases, the combat items' unit case.

## An effect reads only what its hook hands it

An effect of the rule registry reads its stage's facts and its content row and returns a value; it imports only
`src/engine/rules/`, `src/engine/rules-on-plain-values/` and `src/content/`, so it can't draw a die, read the turn's
state or write a line. A set it needs is built from content or handed by the stage, and another ability is asked about
by its slug, never a unit's name; an item's effect is found by its row's key, from the items the resolver hands the
runner (`activeItems` stays the engine's), asked only where the battle code asked them (reading them tidies them); one that reads a copy's own number is handed the copy. A spell's effect is found by the spell's name and returns what it does and its line (a combat spell's, its steps); a discovery's, by its kind among the realm's discoveries, is handed one effect and returns its number; a guardian's perk's, by its row's ward or rider, takes the perk and returns what it turns or sets. The resolver draws and applies them. Hook points so far: all thirteen. Only `src/globals.d.ts` and `src/schemas/` may hold types alone
(a file only `import type` reaches is in no bundle). Checks: `npm run lint:arch`; `pages-build`. Detail: [the rule registry](architecture/the-rule-registry-and-the-one-source-for-shared-rules.md#the-rule-registry).

## Dice come from `kcRng()`

Every random number the site's code draws comes from `kcRng()` (`src/engine/rng.ts`), and the engine's time from
`kcClock()`: pass the generator (`shuffleP(list, kcRng)`); a date is `kcClock.date()`. Checks: lint refuses
`Math.random` in `src/` but `rng.ts` and `Date` in the engine's folders but `clock.ts`; `engine-purity` plays a game
with a `Date` and `Math.random` that throw. [Detail](architecture/the-turn-engine.md#dice-come-from-kcrng).

## `@ts-nocheck` checks nothing in the file

TypeScript reports no error anywhere in a file that starts with its ts-nocheck line, so a type, annotation or
`satisfies` written there is a claim nobody checks. So no file has it: lint refuses the line in every TypeScript
file, with a reason or without. A file that can't pass the compiler is typed, each error cleared with a change that
**keeps every value** (never `!` or `as`). Checks: lint (`ban-ts-comment`); `harness`. The forms that keep a value:
[freeing a file](architecture/freeing-a-file-of-its-ts-nocheck-line.md#ts-nocheck-checks-nothing-in-the-file).

## A battle-only mark is not part of the saved state

A mark a battle or a turn writes on a unit, hero or province (`_flakTargeted`, `_archeryRed`, `_oratoryBoost`, …) is
typed by `ArmyInABattle`, `HeroInABattle` or `ProvinceInABattle` (`engine/army-tables.ts`), never in the saved state's
schema, and is wiped before the save. Checks: the schemas' tests parse every state of a matrix game strictly
(`tests/lib/strict-schema.ts`), so a mark left in a save fails them.
[Detail](architecture/a-saved-game-its-version-its-upgrade-its-check.md#a-battle-only-mark-is-not-part-of-the-saved-state).

## A fixed lint finding must leave the suppressions

When you fix a finding listed in `eslint-suppressions.json`, run `npx eslint --prune-suppressions`, then
`npm run ratchet -- --update`, and commit both with the fix; never `--pass-on-unpruned-suppressions`. A new finding
fails, even of a rule the file already has suppressed. Moving code moves its findings: `npx eslint --suppress-all
<new file>`, then prune. Checks: ESLint's command line (`npm run lint`, `npm run check`, the edit hook; not its API);
the ratchet's `eslintSuppressions`.

## CodeQL reads the tests too, and any alert fails the merge

GitHub's CodeQL scans every file a pull request into `main` changes, `tests/` and `tools/` too, and an alert in a test
blocks the merge as one in `src/` does. Write test code in the form CodeQL calls safe: strip a pattern until the text
stops changing (`text = text.replace(…)` in a loop: the result must flow back into the same name), replace every match
(`/…/g`) and escape every special character, the backslash too; match a tag with the `i` flag and an end tag like
`<\/script\b[^>]*>`; resolve a path a test reads (`path.resolve(root, name)`), check it starts with `root + path.sep` in
an `if`'s condition, and read it in that branch (a check held in a variable isn't seen). Checks: the `main` ruleset's
"Require code scanning results" rule (CodeQL, every alert); the pull request's CodeQL check lists each one, and
`kc-merge` stops on any open alert, listing each.
[Detail](architecture/how-the-tests-reach-the-site.md#codeql-reads-the-tests-too-and-any-alert-fails-the-merge).

## A new army unit is a dozen tables

A unit type is keyed by its name in tables over several files, and nothing throws when one is missed. Add it to
`tests/lib/roster-decided.ts` first (a Creature or Monster: mark it `live` in `tests/lib/primal-decided.ts`), then to
`KC_UNIT_TYPE`. Checks: `tests/unit/the-engines-tables-give-each-army-unit-as-the-roster-table-decides.test.ts` and `tests/static/the-rulebooks-and-the-player-portal-give-each-army-unit-as-the-roster-table-decides.test.ts` (or the wild roster's two tests)
list every table and sentence still missing it, and `npm run typecheck` names the data file's tables that end in
`satisfies`. Every table: [here](architecture/adding-or-changing-content-units-orders-and-discoveries.md#a-new-army-unit-is-a-dozen-tables).

## A sea unit must be a carrier or a primal sea beast

A new swimmer goes in `KC_UNIT_CLASS.primalSea` (it swims, carries nothing, is raised only at sea and can't march
inland) or, if it ferries troops, in `carrier` (one berth, or its `KC_CARRIER_BERTHS` entry), never in `sea` alone:
the engine's "crosses the sea under its own power" sets (`SEA_TYPES`, the bots' `BOT_SEA_ALL`) are built from those two.
Checks: `scenario/shark-waters-are-half-the-poor-seas-and-a-realm-raises-its-shoals-there`, for the shoal.

## A beast joining a column checks its leader's Druid

A new path that puts a living beast into a hero's `armies` asks `beastCommandRoom` first: a hero leads at most as many
Creature and Monster units as his Druid level. Checks: the orders' cases marked "(item 24)" in
`tests/lib/recruit-hire-and-realm-works-order-cases.ts` and `tests/lib/item-and-army-order-cases.ts` hold the three
orders; a new path, nothing.

## Terror is spent at battle start

Anything that must know whether a province is "under Terror" for a battle reads it **before** `consumeTerror`
(`src/engine/battle/evil-terror.ts`), which runs at the start of every battle and spends the mark with the marks'
module's `spendTheTerrorOnAProvince`: `_terrorStacks`, `_terrorisedBy` and the rest are deleted. Checks:
`terror-three-stacks`, `the-marks-on-a-province-each-read-laid-lifted-and-faded` and
`an-evil-realms-report-reads-the-terror-gripping-each-province`.

## A realm's alignment's rule is a row of its abilities

A rule a realm holds by its alignment (a creed's zeal, the Neutral trade, a creed's order) is one row of
`src/content/alignment-abilities-their-keys-names-numbers-and-words.ts`, each number as the books write it, and one
entry of `src/engine/rules/the-registry-of-alignment-abilities.ts`: the resolver asks its stage's runner, never
`alignment === '…'`. A mark it leaves on a province (consecrated ground, Terror, Enslave) is laid and wiped only by
`src/engine/world/the-marks-on-a-province-consecrated-ground-terror-and-enslave.ts`. An order's row also needs its
`case`, its resolver in `src/engine/orders/alignment/`, its widget on the form and its place in `ACTION_DISPLAY_ORDER`
(a call by its slug); the GM's Statistics labels read its name from its row too (`STATS_ACTION_LABEL`, R-189). A removed
order keeps its `case` as a refusal, for saves. Checks: the ratchet's `alignmentChecksInEngine` (0: a new name fails it); the
words test (each row's numbers in the books); the registry's unit test and compile check; the static test of the
functions it has taken. [The guide](architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md);
[full text](architecture/adding-or-changing-content-units-orders-and-discoveries.md#a-realms-alignments-rule-is-a-row-of-its-abilities).

## A fate line names two companies

A new casualty (fate) line opens with the company's own reference (`unitRef`) and puts the clause about the enemy
after it, and the faced map is read once, early, and passed to `rollUnitFates` as `faced`. A new fate is counted in the
losses tally only once the tally's switch names it (`theWordsOfABattlesLossesTally` reads the fact: its owner, type
and name; lint refuses a fate it leaves out). Checks:
`tests/unit/each-companys-fate-line-names-whom-it-faced-from-its-place-in-the-battle-grid.test.ts`,
`tests/unit/a-battles-losses-tally-is-written-from-the-facts-of-its-lines.test.ts`.

## Other realms' slots come only from `get_game_slots`

The player portal reads its own `game_players` row directly, and every other realm's slot only through
`fetchGameSlots` (`rpc('get_game_slots')`); if a feature needs more than `get_game_slots` gives, that's a database
change first. Checks:
`tests/page/the-player-portal-sees-other-realms-only-through-get-game-slots-and-never-reads-another-accounts-realm.test.ts`
fails on any read of another account's realm (the fake notes each one);
`tests/db/the-players-games-realms-and-logs-answer-each-role.test.ts` checks the rule as each role.

## Another game reads as nothing

An account reads a running or finished game, and its turn logs, only if it runs the game or holds a realm in it (the
Overlord reads every game); a game in setup, if it's public or invites the account. An access rule whose subquery
reads `games` runs under the caller's own read rules: ask a `security definer` function instead, as the Hall of Fame
record rules ask `game_exists`. Checks: `tests/db/the-players-games-realms-and-logs-answer-each-role.test.ts` (the
games and the turns' logs, as each role).

## The GM page's shared files are engine paths by name

When a file of the GM page starts importing a file of `src/ui/shared/`, add that file to `ENGINE_PATHS`
(`tools/balance/engine-paths.ts`, a dangerous path) in the same pull request. Checks: `tests/static/harness.test.ts` is
red until the engine paths under `src/` are exactly the page's sources, the templates, the schemas and `src/db/`.
[Detail](architecture/the-balance-matrix.md#the-gm-pages-shared-files-are-engine-paths-by-name).

## A sort comparator must give the same answer every time

Never sort with a random or argument-less comparator: to shuffle, use `shuffleP(arr, rnd)` (Fisher-Yates); to order
randomly within ties, shuffle first, then sort by the real key alone (the sort is stable). Checks: lint
(`kc/no-random-or-argument-less-sort-comparator`), in `src/`, `public/`'s scripts and the templates' scripts.

## Retired discovery ids are never reused

Add to `RETIRED_DISCOVERY_IDS`; never remove from it or reuse an id. Checks: nothing checks a reuse.

## Live saves keep copies

A running game's save holds its own copies of content (awarded items, uncleared lairs' guardians, held discoveries,
unit names), so a change to a table reaches running games only through a migration in `upgradeGameState`, which runs
at the start of every turn and must be safe to repeat. Whether a changed item effect reaches items already held is a
ruling for the maintainers, not a code decision. Checks: `tests/unit/every-save-fixture-upgrades-parses-and-plays-a-turn.test.ts`
for the upgrade; nothing for a missed migration.
[Detail](architecture/a-saved-game-its-version-its-upgrade-its-check.md#live-saves-keep-copies).

## A change to the save's shape needs its version

A change to the save's shape changes its schema; one an older save can't meet as it is (a field renamed, moved,
retyped or now required) also bumps `schemaVersion`: a numbered step in `THE_NUMBERED_STEPS_OF_THE_UPGRADE`, the
number in `the-saved-games-version-this-build-writes.ts`, and a fixture of the new version
(`npx tsx tools/saves/make-a-save-fixture-from-a-seeded-bot-game.ts`), never edited once merged. A `refactor-only`
change retypes no field: a `z.unknown()` stays, and the code narrows the value where it reads it. Checks:
`tests/unit/every-save-fixture-upgrades-parses-and-plays-a-turn.test.ts` fails until a step mends every older fixture,
and on a version without its fixture.
[Detail](architecture/a-saved-game-its-version-its-upgrade-its-check.md#a-change-to-the-saves-shape-needs-its-version).

## The check is not the save

The turn plays, saves and returns the object it upgraded, never the output of the schema's parse, and the check names
a place by its path and kind, never its value. A place the check reports is a fix of its own (on the GM page it stops
the turn, but for a known leak), and a staged world in a test is not a save. Checks:
`tests/unit/a-save-the-check-finds-a-place-in-stops-its-turn-but-for-a-known-leak.test.ts` keeps an unknown field
through the upgrade and the turn.
[Detail](architecture/a-saved-game-its-version-its-upgrade-its-check.md#the-check-is-not-the-save).

## A package imported from `src/`

A package `src/` imports (Zod, from `src/schemas/`) is left out of a page's sources by `tools/pages.ts`'s `importsOf`
(`package-lock.json`, an engine path, says which version), and a new builder of `src/` takes the Vite plugin
`packagesFromTheRepository()` (`tools/build.ts`). Checks: `pages-build` (a package's import, planted).

## A migration waiting for approval holds every deploy

Merge a migration when the owner can approve it soon, not ahead of an urgent site fix. If it is rejected, follow quickly
with a pull request whose migration undoes it ([supabase/README.md](../supabase/README.md#how-a-migration-goes-live)).
Checks: nothing; the deploy's run shows it waiting.

## A new table is open to signed-out visitors until its migration says otherwise

A schema file for a new table, sequence or function in `public` says `REVOKE ALL … FROM "anon"` and `… FROM
"authenticated"` first, then grants what the site uses ([supabase/README.md](../supabase/README.md#changing-the-structure)).
Checks: `supabase/tests/database/00_privileges.test.sql` checks every table, sequence and function (the `db` check).

## A stacked pull request merges into its base branch, not `main`

Don't merge a pull request whose base isn't `main`; when you open a stacked one, say in its first line which pull
request must merge first ([staging.md](staging.md#a-change-that-needs-both)). Once its base is `main`, GitHub may still
test the old merge: merge `main` into the branch, and read CI's "Merge … into" line, before calling it green. Checks: the `merges-into-main` check
(`.github/workflows/merges-into-main.yml`) is red on any pull request whose base isn't `main`; nothing checks the old
merge.
