# Traps

One entry per trap that still applies: the rule, one example, and what checks it (or "nothing checks it"). Read the
titles first, then the entries your work touches. Each entry's full text is under the same title in the topic file of
its part, under [architecture/](architecture/). A trap that cost you time goes here in the same PR, in at most 1.5 KB
(`tests/the-docs-budgets.json`), and its detail in the topic file.

## Edit `src/`, never `site/`

`site/` is build output: git-ignored, and rewritten from `src/` by every test run, so an edit there is never
committed and the next build quietly undoes it. Change `src/` (or `public/`, copied as it is); a new file is imported
where it is read, and by the page's `page.ts` if it does something as it loads. Example: `node tests/<name>.test.js`
and a page opened by hand read `site/` as last built, so run `npm run build` first (`npm run dev` serves `src/` as it
is). Checks: `pages-build` fails on a file of `src/` no page reaches; nothing stops an edit to `site/`.
Detail: [the build](architecture/the-build-from-src-to-site.md#the-build-src-becomes-site).

## A deploy keeps the files a cached page names

Never publish `site/` without the keep step (`tools/deploy/keep-the-previous-deploys-files.ts`, between
`npm run build` and the upload in both build jobs), and never rename `published-files.json` or `version.json`, or type
a version by hand. Example: a page GitHub Pages cached before a deploy (for up to 10 minutes) asks for its old,
content-named bundle; without the step it gets 404 and stays on "Loading…". Checks: `tests/static/harness.test.ts` (the step is
there, right after the build, and can't be skipped or fail quietly) and
`tests/unit/a-deploy-keeps-the-files-a-cached-page-still-names.test.ts`. [Detail](architecture/the-build-from-src-to-site.md#a-deploy-keeps-the-files-a-cached-page-names).

## A job after a skipped job is skipped, unless its `if` says otherwise

A job after one that may be skipped says `!cancelled()` and the results it needs, as `build` and `deploy` do
(`deploy`: `!cancelled() && needs.build.result == 'success' && github.ref == 'refs/heads/main'`). A plain `if` gets
GitHub's `success()`, which reads every job before it in the `needs` chain. Example: `migrate-production` is skipped
on every merge that adds no migration, so a job after it with a plain `if` is skipped too and the run still shows
"success": the deploys of #184 to #186 published nothing. Checks: `tests/static/harness.test.ts` refuses
`deploy` without them, or with `always()`.

## A constant read at load time must live in a leaf module

A constant another file reads as it loads lives in a file of its own that imports nothing, and `page.ts`'s import
order is not changed. Example: when two files import each other, one runs first and finds the other's top-level `const`
unset: a temporal-dead-zone `ReferenceError` stops the page on its spinner, or, in the bundle (Rolldown writes each
`const` as a `var`), the read quietly finds `undefined`. Checks: `npm run lint:arch` fails on a new import cycle (the
pages' two known ones are listed in `.dependency-cruiser-known-violations.json`); `boot-pages` and `chromium-boot`
catch a page that no longer boots. [Detail](architecture/the-build-from-src-to-site.md#a-constant-read-at-load-time-must-live-in-a-leaf-module).

## `select('*')` on big tables

Pollers, lists and anything that runs often select named columns (`gamesListCols()`) and read summaries from
`games.meta`; the full world is loaded only when it's really needed, once. Example: `games.game_state` is hundreds of
KB per game; in Sept 2026 a once-a-minute watcher selecting `*` drained the database's Disk IO budget (~810 KB a tick,
~1 KB after the fix). Checks: lint
(`kc/big-tables-and-profiles-are-read-by-named-columns`) refuses every column of `games`, `game_players`, `turn_logs`
or `profiles`, and `profiles`' `email`; the reads there when it came in are in `eslint-suppressions.json`.
[Detail](architecture/the-database-and-what-it-holds.md#select-on-big-tables).

## A new column must be optional at the write site

Code that writes a new column copes while the column is missing. Example: a site pull request labelled `staging`
without the database pull request it needs meets a staging database without the column, and old copies of the site
can't be ruled out; writing an unknown column fails the whole save, which in `runTurn` is a failed turn. Probe once
(`probeGameMeta`), spread `{}` for the field while it's absent (`metaPatch`); readers fall back to the old source. Checks: a test that hides the column (`MISSING_COLS` in `tests/lib/stub-db.js`),
as `tests/meta-missing-turn.test.js` does. This is why database and site changes go in separate PRs
([supabase/README.md](../supabase/README.md#database-and-site-changes-go-separately)).

## A site change that needs a database change

A site PR that can't work without a migration raises `KC_DB_MIN` to the migration's 14-digit version in every page
that needs it, and never lowers it to get past the stop. Example: each page that uses the database starts through
`kcDbGuard(sb, KC_DB_MIN)` (`src/db/kc-db-guard.ts`); on an older database, one without `kc_db_version()`, or no
answer after one retry, it stops with "The game is being updated" and reads or writes nothing. Otherwise cope
([above](#a-new-column-must-be-optional-at-the-write-site)).
Checks: `db-min` fails if a `KC_DB_MIN` is newer than the newest file in `supabase/migrations/`; `db-guard` boots each
page on an older database. [Detail](architecture/the-database-and-what-it-holds.md#a-site-change-that-needs-a-database-change).

## String-anchor harness hooks

No test reads a page's source by its lines, indent or quotes, or writes to a page's function or variable from outside.
Example: a test that matched an exact line of the built page broke, some silently, when the code was reformatted, and
`W.fn = …` on a module page does nothing, so the test passes without testing anything. Read `src/` through
`tests/lib/source.ts` (by its syntax tree); stand a function in on the engine's modules with `vi.spyOn`, or in the
engine's vm; boot a page that must fail from a planted copy (`plantedSite`). Checks: `tests/unit/the-source-read-by-its-syntax-tree.test.ts` and
`page-globals`; the ESLint rules replaced the name-picking checks. Detail: [the tests' helpers](architecture/how-the-tests-reach-the-site.md).

## A test on the engine's modules loads the whole engine first

A test that imports the engine's functions from their modules imports
[tests/lib/the-whole-engine.ts](../tests/lib/the-whole-engine.ts) first. Example: `engine/items/equipment.ts` re-tiers
two of the content's tables (`ALL_MAGIC_ITEMS_P`, `LEGENDARY_ITEMS_P`) as it loads, so a test that imports only the
files one function reaches reads them as neither the GM page nor the engine's bundle ever does. The modules keep
state between calls (the name pools), so a test whose outcome rests on the dice takes fresh modules (`vi.resetModules()`,
`await import(…)`, then `kcRng.seed(…)`).
Checks: `tests/unit/engine-loads.test.ts` (every export holds what the bundle holds).

## A stand-in on a module reaches calls from other files only

`vi.spyOn(module, 'name')` replaces a function for the calls other files make; a call inside the function's own file
still reaches the real one. Example: a spy on `d100` changed the game when it answered 1, but `pctRoll`, in `d100`'s
own file, kept calling the real `d100`. A test moved off the engine's vm, where a stand-in reaches every caller, can
lose its stand-in without a sound. So a test that stands one in has a check that fails when it isn't reached (its
planted fault turns it red); a function called inside its own file is staged around (the state, or `kcRng.use`).
Checks: nothing but that check; `restoreMocks` (`vitest.config.mts`) puts every spy back after each test.

## A lifted helper takes the turn's context first

An engine helper that reads the turn's state takes `turnContext` as its first argument, and one passed as a value is
wrapped where it's passed: `(...a)=>effStat(turnContext,...a)`. Example: a call that leaves the context out doesn't
fail: every argument moves along by one and the helper quietly reads the wrong thing. A value the turn changes as it
goes lives only in the context: read and write `turnContext._currentPhase`, never a local copy. Checks: `no-undef`
can't see it; the balance matrix catches it in the code it runs, a direct test anywhere else. How a test calls a
helper, an order or a stage: [the turn's context](architecture/the-turns-context-and-calling-its-helpers-and-stages-from-a-test.md#a-lifted-helper-takes-the-turns-context-first).

## A line goes through `emit`

Every line of the turn enters the GM's log through `emit(turnContext, event)`
(`src/engine/turn/events-and-their-audiences.ts`), and its event says who may read it (`audience`). A line records a
fact (values, never words or a live part of the world), and `src/views/prose/` writes its words after the turn. Example: a line pushed past `emit` chooses its own audience, which is how the leaks the report check finds were
made. In full, with "Every event names its hero" and "A line for one realm alone inside a fight":
[a line of the turn](architecture/a-line-of-the-turn-emit-its-facts-and-the-reports.md). Checks: the lint rule `kc/narrative-lines-go-through-emit` (it also refuses an
event with a `text` key and a string handed to `narrate`, `emitNarrLine`, `narrateAll` or `narrateAt`); `emit` throws
on an event with no `hero` or handed as words; `a-lines-facts-hold-values-not-words`; the report-leak check (`tests/lib/report-leaks.ts`).

## Views never write

Building the reports reads the world and the GM's log, and writes to neither, even the same value back; a rule that
changes the world belongs to the engine, before the reports. Example: every realm's report is built from the same
working copy after the save, so a write made while one realm's report is built changes what the next realm's reads,
and only the reports show it. The reports draw no dice either. Checks:
`tests/unit/the-reports-are-built-on-a-world-that-cannot-be-written.test.ts` plays a whole matrix game with every
report built on a world and a log that refuse every write, on dice that count every draw. Detail:
[a line of the turn](architecture/a-line-of-the-turn-emit-its-facts-and-the-reports.md#views-never-write).

## Nothing is on `window` but `globals.ts`

A function or constant an inline handler calls, or a test reaches, goes on a list in `src/ui/<page>/globals.ts`, and
a variable they read or write is a declared global, `globalThis.<name> = <value>;`. Example: the site's code is ES
modules, so `on…="…"`, a spec's `page.evaluate` or a test's `W.eval` reaches only what the page puts on `window`; jsdom
is looser (every top-level name of the bundle is on `window`), so a check that passes in jsdom can fail in Chromium.
Checks: `page-globals` fails on a name missing from a list, a
variable that isn't a declared global, or a page stand-in. [Detail](architecture/the-pages-how-a-portal-boots-and-how-a-page-builds-html.md#nothing-is-on-window-but-globalsts).

## `game_state` is a string

On a `games` row, `game_state` is a JSON **string**: always read it through `parseGameState(game)`, never off the row.
Example: a function that guards with `typeof state !== 'object'` turns a raw string into a silent no-op. Before adding a
new reader, grep for `game_state` reads that don't parse. Checks: nothing checks it.

## A refactor that changes a container's type needs a test that calls the consumers

When a refactor changes a type (array ↔ `Set`, object ↔ `Map`), test through the consumers, not by comparing
contents, and grep every method used on the name (`.includes`, `.has`, `.length`, `.size`, indexing) first. Example:
when the shared tables moved into the data file, one became a `Set` while five call sites still used `.includes`; the
check compared contents, so it passed, and every turn report then threw. Checks: the type check, in a file it checks;
nothing in a file that keeps its ts-nocheck line.

## Post-commit work in `runTurn`

After the save in `runTurn` (`src/ui/gm/turn-shell.ts`), the turn is resolved and stored: a throw there must not
restore orders, re-flag `orders_submitted` or let the watcher retry. Example: that combination once made live games
resolve themselves once a minute. `_turnCommitted` marks a successful save; the reports are built only after it, never
inside `resolveTurn`.
`runTurn` returns `{ok, committed, conflict, error}` on every path and never throws. Checks: `tests/page/turn-shell.test.ts`
(the post-save guard plants a throw in `buildTurnReport`; each failure's outcome). [Detail](architecture/the-turn-engine.md#post-commit-work-in-runturn).

## Hooks in the turn path must never fail a turn

Telemetry and Hall-of-Fame writes inside `runTurn` are each wrapped in `try { … } catch {}`: a statistics bug must
never cost a turn, so a broken hook is silent, and hooks are tested by the rows they write. Example: coerce numbers with
`Number()` and `isFinite`, not `|| 0`: `'nonsense' || 0` is `'nonsense'`, which reaches the page as "NaN". Checks:
page tests scan the rendered HTML for `undefined`, `NaN` and `[object Object]`.

## A rule written twice must change twice

Before changing a rule, grep the engine and both portals for its nouns **and its numbers**, and change every place in
the same commit; when a number moves, grep the old number in narrative strings and the rulebooks. Example: the most
common root cause in this project's history is two copies of one rule disagreeing. A rule the player portal takes
through `src/shared/` is written once; it is still restated in the portal's projections (the copies
`tests/lib/player-portal-copies.ts` checks), at order time and resolution time, in the balance matrix's scripted realm,
and in the words players read. Checks: `the-player-portals-copies-agree-with-the-engine`, the scripted realm's page
test and the `*-words` tests, for what they cover. Battle magic is one stage of the spells' registry, asked by three
copies that keep two rules apart (Parked: a guards' commander's Lightning Bolt, a storm at sea); the units' strikes are
another, asked by three copies that each keep their own roll. Veteran Training's +1 is one stage of the discoveries'
registry, asked by the fight (`pcCharCombatant`) and the hero's card (`extraSkillBonuses`). [Where](architecture/adding-or-changing-content-units-orders-and-discoveries.md#a-rule-written-twice-must-change-twice).

## HTML is built only through `kcHtml`

Every name and message on screen was typed by someone, so a page builds HTML only through `kcHtml` / `kcEsc`
(`src/ui/shared/kc-safe.ts`), and markup inside a value is `kcHtml` too. Example: in
``kcHtml`<td>${won?'<span class="pill">won</span>':''}</td>` `` the pill shows on screen as `<span…`; write
``${won?kcHtml`<span class="pill">won</span>`:''}``. Never join `kcHtml` with `+` or `.join('')`. Checks: lint (`kc/html-is-built-only-through-kc-html`, exceptions in `HTML_EXCEPTIONS`,
`eslint.config.js`) catches most; `node tests/tools/same-dom.js <main's site>` finds the rest on the screens a tour
visits. Every mistake it can't see: [here](architecture/the-pages-how-a-portal-boots-and-how-a-page-builds-html.md#html-is-built-only-through-kchtml).

## Order is data

`KC_*` arrays and object keys are walked for random picks, tie-breaks and dropdowns: append, never re-sort. Never
reorder a character's `items` (Send Item addresses them by index). A stage of the rule registry runs its effects in the
order of `THE_ORDER_OF_EACH_STAGE` (the items', `THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS`), not of the entries or the
content's rows: the commander's items round each step as it goes, so the Battle Standard's +2 comes before the Golden
Spur's ×1.25; the siege halves what home defence added, so the Banner of the Realm comes first; a fighter reaches for
his combat items in the stage's order, a healing before a second wind. Example: moving Shieldwall after Sergeants in
that list changed 9 of the matrix's 60 games. Checks: the balance matrix, when a game meets the order; the commander's
items' unit cases, the battles' items' scenario cases, the combat items' unit case.

## An effect reads only what its hook hands it

An effect of the rule registry reads its stage's facts and its content row and returns a value; it imports only
`src/engine/rules/`, `src/engine/rules-on-plain-values/` and `src/content/`, so it can't draw a die, read the turn's
state or write a line. A set it needs is built from content or handed by the stage, and another ability is asked about
by its slug, never a unit's name; an item's effect is found by its row's key, from the items the resolver hands the
runner (`activeItems` stays the engine's), asked only where the battle code asked them (reading them tidies them); one that reads a copy's own number is handed the copy. A spell's effect is found by the spell's name and returns what it does and its line (a combat spell's, its steps); a discovery's, by its kind among the realm's discoveries, is handed one effect and returns its number. The resolver draws and applies them. Hook points so far: all but `movementCost` and `turnStart`. Example: whether
the enemy fields ranged units comes from the stage (the ladder's missile set), never from an import of `battle/`. Only `src/globals.d.ts` and `src/schemas/` may hold types alone
(a file only `import type` reaches is in no bundle). Checks: `npm run lint:arch`; `pages-build`. Detail: [the rule registry](architecture/the-rule-registry-and-the-one-source-for-shared-rules.md#the-rule-registry).

## Dice come from `kcRng()`

Every random number the site's code draws comes from `kcRng()` (`src/engine/rng.ts`), and the engine's time from
`kcClock()`: pass the generator (`shuffleP(list, kcRng)`); a date is `kcClock.date()`. Example: adding, removing or
moving one draw shifts every draw after it, so every balance game changes; and a test that fixes dice through the
page's `Math.random` pins nothing. Pinning the page's dice doesn't pin a turn's: each turn plays on dice of its own,
from a seed. Checks: lint refuses `Math.random` in `src/` but `rng.ts` and
`Date` in the engine's folders but `clock.ts`; `engine-purity` plays a game with a `Date` and `Math.random` that
throw. [Detail](architecture/the-turn-engine.md#dice-come-from-kcrng).

## `@ts-nocheck` checks nothing in the file

TypeScript reports no error anywhere in a file that starts with its ts-nocheck line, so a type, annotation or
`satisfies` written there is a claim nobody checks. Example: a wrong parameter type compiles there, and so does a table
with a key left out. A type is checked where a file without the line reads it. To free a file: delete the line, type
it, and clear each error with a change that **keeps every value** (never `!` or `as`). Don't write the line's text in a comment. Checks: the ratchet counts the line (`tsNocheckEngineSide`,
`tsNocheckUi`), so it only falls; `harness`. How to free a file, form by form: [freeing a file](architecture/freeing-a-file-of-its-ts-nocheck-line.md#ts-nocheck-checks-nothing-in-the-file).

## A battle-only mark is not part of the saved state

A mark a battle or a turn writes on a unit, hero or province (`_flakTargeted`, `_archeryRed`, `_oratoryBoost`, …) is
typed by `ArmyInABattle`, `HeroInABattle` or `ProvinceInABattle` (`engine/army-tables.ts`), never in the saved state's
schema, and is wiped before the save. Example: on 2026-09-27 `_flakTargeted` was never wiped, so it was saved, and a
flyer harried once was immune to Flak Screen for the rest of the game. Checks: the schemas' tests parse every state of a matrix game strictly
(`tests/lib/strict-schema.ts`), so a mark left in a save fails them. [Detail](architecture/a-saved-game-its-version-its-upgrade-its-check.md#a-battle-only-mark-is-not-part-of-the-saved-state).

## A fixed lint finding must leave the suppressions

When you fix a finding listed in `eslint-suppressions.json`, run `npx eslint --prune-suppressions`, then
`npm run ratchet -- --update`, and commit both with the fix; never `--pass-on-unpruned-suppressions`. Example: fix one
of `src/db/game-meta.ts`'s five unused variables and lint stops with "There are suppressions left that do not occur
anymore". A new finding fails, even of a rule the file already has suppressed. Moving code moves its findings: `npx eslint --suppress-all <new file>`, then prune.
Checks: ESLint's command line (`npm run lint`, `npm run check`, the edit hook; not its API); the ratchet's
`eslintSuppressions`.

## A new army unit is a dozen tables

A unit type is keyed by its name in tables over several files, and nothing throws when one is missed. Example: a unit
with no cost recruits for 2g, one with no speed never marches, one missing from a terrain block fights at ×1 there.
Add it to `tests/lib/roster-decided.js` first (a Creature or Monster: mark it `live` in `tests/lib/primal-decided.js`),
then to `KC_UNIT_TYPE`. Checks: `tests/roster.test.js` and `tests/roster-words.test.js` (or `primal-roster`,
`primal-words`) list every table and sentence still missing it, and `npm run typecheck` names the data file's tables
that end in `satisfies`. Every table: [here](architecture/adding-or-changing-content-units-orders-and-discoveries.md#a-new-army-unit-is-a-dozen-tables).

## A sea unit must be a carrier or a primal sea beast

A new swimmer goes in `KC_UNIT_CLASS.primalSea` (it swims, carries nothing, is raised only at sea and can't march
inland) or, if it ferries troops, in `carrier` (one berth, or its `KC_CARRIER_BERTHS` entry), never in `sea` alone:
the engine's "crosses the sea under its own power" sets (`SEA_TYPES`, the bots' `BOT_SEA_ALL`) are built from those two.
Example: a unit in `sea` alone is a land unit at sea: it needs a berth, is stranded by `settleStrandedAtSea` and blocks
the column's move, as the first run of `tests/shark-waters.test.js` showed. Checks: `shark-waters`, for the shoal.

## A beast joining a column checks its leader's Druid

A new path that puts a living beast into a hero's `armies` asks `beastCommandRoom` first: a hero leads at most as many
Creature and Monster units as his Druid level. Example: Recruit Armies (overflow musters into the garrison), Pick Up
Army, Leave/Transfer to a hero and Wild Calling all ask; a path that doesn't quietly breaks the cap. Checks:
`tests/beast-command.test.js` holds the three orders; a new path, nothing.

## Terror is spent at battle start

Anything that must know whether a province is "under Terror" for a battle reads it **before** `consumeTerror`, which
runs at the start of every battle and deletes `_terrorStacks`, `_terrorisedBy` and the rest. Example: Reign of Fear
reads it through `reignOfFearHere` before the call, in both battle paths, and hands the answer on in the strength
context (`ctx.reignOfFear`); read after, it is always false. Checks: `terror-three-stacks` and `terror-visible`.

## An alignment order is written in a dozen places

Adding or removing an alignment order touches the engine's `case` in the order switch, the order-name map,
`ALIGNMENT_ORDER_KEYS`, the short label map, the bots' `botSignaturePre` case and muster-like lists; the player portal's
`ACTIONS`, `ALIGN_ACTIONS`, `ACTION_DISPLAY_ORDER`, the target widget, the army projection and the gold ledger; both
rulebooks and the portal's alignment texts. Copy Harvest the Field's occurrences (grep `harvest_field`). A removed
order keeps its `case` as a plain refusal, so an order a save still holds is answered. Example: a missed place
refuses, hides or misprices the order, and throws nothing. Checks: nothing checks every place.

## A fate line names two companies

A new casualty (fate) line opens with the company's own reference (`unitRef`) and puts the clause about the enemy
after it, and the faced map is read once, early, and passed to `rollUnitFates` as `faced`. Example: "— Aldric's Levies
(Shieldwall Levies, Average), facing the Red Hand (Gorbash's Gnomish Gyrocopters), were annihilated in the rout!": the
losses tally (`battleTallyLine`) reads the owner and type from the first match, and anything that faces the rows again
(the stay-or-retreat estimate) overwrites their `_faced` stamps. Checks: `tests/battle-faced-lines.test.js`.

## Other realms' slots come only from `get_game_slots`

The player portal reads its own `game_players` row directly, and every other realm's slot only through
`fetchGameSlots` (`rpc('get_game_slots')`). Example: the database answers a direct read of another realm's row with
nothing, so a new feature that reads other slots directly quietly sees only its own; if it needs more than
`get_game_slots` gives, that's a database change first. Checks: `tests/other-realms-slots.test.js` switches the rule
on in the stand-in database (`RULES.ownSlotsOnly`) and fails on any read of another realm's row.

## Another game reads as nothing

An account reads a running or finished game, and its turn logs, only if it runs the game or holds a realm in it (the
Overlord reads every game); a game in setup, if it's public or invites the account. Example: asking for any other game
gives no row and no error, so a new feature that reads another game directly finds nothing. An access rule whose
subquery reads `games` runs under the caller's own read rules: ask a `security definer` function instead, as the Hall
of Fame record rules ask `game_exists`. Checks: `tests/games-for-their-players.test.js` (`RULES.ownGamesOnly`).

## A sort comparator must give the same answer every time

Never sort with a random or argument-less comparator: to shuffle, use `shuffleP(arr, rnd)` (Fisher-Yates); to order
randomly within ties, shuffle first, then sort by the real key alone (the sort is stable). Example: how often the
JavaScript engine calls a comparator is up to it, so `.sort(()=>Math.random()-0.5)` gave a different world on Node 26
than on Node 24 for the same seed. Checks: lint (`kc/no-random-or-argument-less-sort-comparator`), in `src/`,
`public/`'s scripts and the templates' scripts.

## Retired discovery ids are never reused

Add to `RETIRED_DISCOVERY_IDS`; never remove from it or reuse an id. Example: `retireDiscoveries(G)` strips those ids
from live saves every turn, so a reused id would hand the new power to every realm whose save still holds the old one. Checks: nothing checks a reuse.

## Live saves keep copies

A running game's save holds its own copies of content (awarded items, uncleared lairs' guardians, held discoveries,
unit names), so a change to a table reaches running games only through a migration in `upgradeGameState`, which runs
at the start of every turn and must be safe to repeat. Example: change a guardian's stats without bumping
`GUARDIAN_TABLE_VER` and running games keep the old guardian. Whether a changed item effect reaches items already held
is a ruling for Toby, not a code decision: the items' registry reads each held copy's own key and numbers, and its
content rows hold only the numbers the code wrote inline (P1-19m–t), so a held copy acts, fights and is weighed (its
role, its tier's floor) by what it carries. Checks: `tests/unit/every-save-fixture-upgrades-parses-and-plays-a-turn.test.ts`
for the upgrade; nothing for a missed migration. [Detail](architecture/a-saved-game-its-version-its-upgrade-its-check.md#live-saves-keep-copies).

## A change to the save's shape needs its version

A change to the save's shape changes its schema; one an older save can't meet as it is (a field renamed, moved,
retyped or now required) also bumps `schemaVersion`: a numbered step in `THE_NUMBERED_STEPS_OF_THE_UPGRADE`, the
number in `the-saved-games-version-this-build-writes.ts`, and a fixture of the new version
(`npx tsx tools/saves/make-a-save-fixture-from-a-seeded-bot-game.ts`), never edited once merged. Example: a field renamed with no step: every live
save keeps the old name, which the new code never reads. Checks:
`tests/unit/every-save-fixture-upgrades-parses-and-plays-a-turn.test.ts` fails until a step mends every older fixture,
and on a version without its fixture. [Detail](architecture/a-saved-game-its-version-its-upgrade-its-check.md#a-change-to-the-saves-shape-needs-its-version).

## The check is not the save

The turn plays, saves and returns the object it upgraded, never the output of the schema's parse, and the check names
a place by its path and kind, never its value. Example: Zod's `z.object` returns a copy without the keys it doesn't
name, so a turn that played the parse's copy would drop a field only live play writes from every live game for good.
A place the check reports is a fix of its own, and a staged world in a test is not a save. Checks:
`tests/unit/a-save-the-check-refuses-still-plays-and-the-gm-is-told.test.ts` keeps an unknown field through the upgrade
and the turn. [Detail](architecture/a-saved-game-its-version-its-upgrade-its-check.md#the-check-is-not-the-save).

## A package imported from `src/`

A package `src/` imports (Zod, from `src/schemas/`) is left out of a page's sources by `tools/pages.ts`'s `importsOf`
(`package-lock.json`, an engine path, says which version), and a new builder of `src/` takes the Vite plugin
`packagesFromTheRepository()` (`tools/build.ts`). Example: Node looks for `node_modules` from the importing file's
folder up, so a test's planted copy of `src/` in a temporary folder finds none without the plugin; a copy of the whole
repository links `node_modules` in instead. Checks: `pages-build` (a package's import, planted).

## A migration waiting for approval holds every deploy

Merge a migration when Toby can approve it soon, not ahead of an urgent site fix. Example: a merge that adds a
migration stops at `migrate-production` until Toby approves it, deploys run one at a time, so every later merge waits
behind it and ships with it. If he rejects it, follow quickly with a pull request whose migration undoes it
([supabase/README.md](../supabase/README.md#how-a-migration-goes-live)). Approval
requests expire after 30 days. Checks: nothing; the deploy's run shows it waiting.

## A new table is open to signed-out visitors until its migration says otherwise

A schema file for a new table, sequence or function in `public` says `REVOKE ALL … FROM "anon"` and `… FROM
"authenticated"` first, then grants what the site uses ([supabase/README.md](../supabase/README.md#changing-the-structure)).
Example: Supabase gives every new object to every API role with every privilege, and without the revokes the generator
also gives back what an earlier migration took away, the next time anyone generates a migration. Checks:
`supabase/tests/database/00_privileges.test.sql` checks every table, sequence and function (the `db` check).

## A stacked pull request merges into its base branch, not `main`

Don't merge a pull request whose base isn't `main`; when you open a stacked one, say in its first line which pull
request must merge first ([staging.md](staging.md#a-change-that-needs-both)). Example: GitHub moves a stacked pull
request onto `main` only when its base branch is deleted after its merge; if the branch stays, merging puts it on the
leftover branch, GitHub says "Merged" and nothing deploys (it happened twice, reopened as #56 and #57). Checks: the
`merges-into-main` check (`.github/workflows/merges-into-main.yml`) is red on any pull request whose base isn't `main`.
