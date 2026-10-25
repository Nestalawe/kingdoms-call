# Traps

Standing gotchas: mistakes that have already happened, or nearly happened, in this code. Each one says
how to avoid it. Read this before changing the portals or the tests. When a new trap costs you time,
add it here in the same PR.

## Edit `src/`, never `site/`

Since P1-05, `site/` is build output ([ARCHITECTURE.md](ARCHITECTURE.md#the-build-src-becomes-site)): git-ignored, and
rewritten from `src/` by every test run. An edit there is never committed, and the next build quietly undoes it.

- Change the file in `src/` (or `public/`, for what is copied as it is). A page's files are what its entry
  (`src/ui/<page>/page.ts`) imports, directly or not.
- A new file is imported where it is read (and by the page's `page.ts` if it does something as it loads). A file no
  page reaches fails `pages-build`.
- `node tests/<name>.test.js` and a page opened in a browser read `site/` as last built: run `npm run build` first.
  `npm run dev` serves `src/` as it is, against the local Supabase ([ARCHITECTURE.md](ARCHITECTURE.md#the-build-src-becomes-site)).

## A deploy keeps the files a cached page names

Since P1-06b each page's bundle and stylesheet are named by their content (`assets/<page>-<hash>.js`), so a change
renames them. GitHub Pages replaces the whole site on each deploy, and its cache hands out a page for up to 10 minutes
after it: a page cached before the deploy asks for its old bundle, which the new build doesn't have. The build jobs
put the old files back ([ARCHITECTURE.md](ARCHITECTURE.md#the-build-src-becomes-site)).

- **Never publish `site/` without the keep step** (`tools/deploy/keep-the-previous-deploys-files.ts`, between
  `npm run build` and the upload in both build jobs). Without it, every page cached before the deploy breaks for up to
  10 minutes: its bundle answers 404, and the page stays on "Loading…". `tests/static/harness.test.ts` checks the
  step is there, right after the build, and that it can't be skipped or fail quietly.
- **Never rename `published-files.json`.** The next deploy reads it from the previous site to know which older files
  to keep for 24 hours. Under another name, the next deploy keeps only what the previous pages name, and a page two
  deploys old (deploys can come minutes apart) loses its files.
- **A read of the live site in the 10 minutes after a deploy can be the previous deploy**, page or file, and a query
  string doesn't help (the cache ignores it). A check by hand or a script that reads the live site waits 10 minutes.
- **Never rename `version.json`, and never type a version by hand.** The build writes each page's version into it
  (P1-06c): the footer's build line, from the marker `<!--kc-build-->`, and the metas `kc-build` and
  `kc-page-version`. Open pages read `version.json` to learn that their page has changed (the GM tab's reload before
  a due turn). A page's fingerprint is its HTML before these are filled in, so another commit alone changes none.
- **A test that compares two builds builds each from the folder that holds its `src/`.** Rolldown names each module
  in a bundle (`//#region src/…`) from the folder it runs in, so a copy of `src/` built from elsewhere differs in every
  bundle, and so in every name (`tests/unit/a-deploy-keeps-the-files-a-cached-page-still-names.test.ts`).

## A job after a skipped job is skipped, unless its `if` says otherwise

A job whose `if` names no status function (`!cancelled()`, `always()`, `success()`, `failure()`) gets GitHub's
`success()`, which reads **every** job before it in the `needs` chain, not only the ones it names. In `deploy.yml`,
`migrate-production` is skipped on every merge that adds no migration, so a job after it with a plain `if` is skipped
too, and the run still shows "success". That is how the deploys of #184 to #186 published nothing.

- **A job after one that may be skipped says `!cancelled()` and the results it needs**, as `build` and `deploy` do
  (`deploy`: `!cancelled() && needs.build.result == 'success' && github.ref == 'refs/heads/main'`).
  `tests/static/harness.test.ts` refuses `deploy` without them, or with `always()`.
- **"Success" on a run doesn't mean it published.** Check the `deploy` job, and the live `version.json`'s commit (after
  the 10-minute cache). The keep step finds the previous deploy the same way: the newest run whose `deploy` job
  succeeded.

## A constant read at load time must live in a leaf module

The site's code is ES modules (P1-09d): each file runs after the files it imports. That orders almost everything by
itself, but not a cycle: when two files import each other (the engine has none since P1-13e5; each portal's UI has one), one of
them runs first and finds the other's top-level `const`/`let` not yet set. Read as a file loads, that is a
temporal-dead-zone `ReferenceError`, and at the top level it stops the page: the portal hangs on its spinner (the
boot-failure reporter shows the error). Rolldown, the bundler, writes each top-level `const` as a `var`, so in the built
bundle the read may instead find `undefined`, silently. Inside a function, read later, a cycle is harmless.

**A new cycle fails `npm run lint:arch`** (P1-13a; CI and `npm run check` run it). The two known (the GM and player pages) are
listed in `.dependency-cruiser-known-violations.json`, and a later P1-13e row breaks each (P1-13e1 to P1-13e5 broke
the engine's six). A cycle of `import type` only is let through: types
are erased, so no code runs in its order.

- **A constant another file reads as it loads lives in a file of its own that imports nothing** (P1-09b:
  `engine/items/hoard-categories.ts`, `engine/bots/specialist-skills.ts`, `engine/bots/schools.ts`,
  `ui/player/l79-orders.ts`), re-exported from its old file. A file that imports nothing always runs first.
- **What files do as they load keeps its order through the page's entry** (`ui/<page>/page.ts` imports every file in
  the order the classic scripts ran). The engine's bundle (`tests/lib/engine.ts`) takes the same order. Don't reorder
  `page.ts`. The item tables no longer hang on it: they are built in `engine/items/tiers-and-hoards.ts` and then
  re-tiered in `engine/items/equipment.ts`, which imports them, and since P1-13e2 the tiers file imports nothing that
  reaches the equipment file, so its tables are always built first, whichever file is reached first. The no-cycle rule
  keeps it so.
- Code that runs at top level calls only top-level helpers. A lifted engine helper may need the turn's context
  (`effStat(turnContext, c, stat)`; use `effSkillOf` outside a turn), and one handed to another as a value is wrapped
  with it (`(...a)=>f(turnContext,...a)`, as the bots' duel forecast is). Declare shared helpers as hoisted
  `function`s.
- Prefer building lookup tables lazily inside the function that needs them over a top-level IIFE.
- Never declare a top-level name in two files of one page: Rolldown would rename one in the bundle, and the engine's
  bundle refuses to load (`tests/lib/engine.ts`). New shared names in the data file start `KC_`.
- Never move a table that references portal code into the data file.

`npm test`'s `boot-pages` (jsdom) and the browser spec `chromium-boot` (`npx playwright test`) catch a page that no
longer boots.

## `select('*')` on big tables

`games.game_state` is hundreds of KB per game, and `game_players.turn_report` tens of KB per realm.
Selecting `*` reads those columns from disk every time, however little of the row is used. In Sept 2026
a once-a-minute watcher doing exactly that drained the database's Disk IO budget (~810 KB per tick,
down to ~1 KB after the fix).

- Pollers, lists and anything that runs often select named columns (`gamesListCols()`) and read
  summaries from `games.meta`.
- Load the full world only when it's really needed (resolving a turn, opening one game), once.
- Before adding a big column or a new poller, grep every `.select('*')` on that table. The poller is
  the multiplier.
- Lint refuses every column of `games`, `game_players`, `turn_logs` or `profiles` (`*`, also inside an embedded
  `games(*)`, or `.select()` with no list, as after an insert), and `profiles`' `email`
  (`kc/big-tables-and-profiles-are-read-by-named-columns`, P1-13c). The 17 reads of every column that were there when
  the rule came in are in `eslint-suppressions.json`, for P1-17's access layer to take out: `db/telemetry.ts` (games
  with `game_players(*)`); the GM page's `game-detail.ts` (opening a game, `*, game_players(*)`), `game-list.ts`
  (after creating a game), `turn-log.ts` (the turn log), `turn-shell.ts` (the turn's game and its realms, 2) and
  `turn-zero.ts` (3); the player page's `game-lists.ts` (its slots, and two of `games`, 3),
  `join-and-chronicle.ts` (after joining, the chronicle's two turn logs, a game: 4) and `report.ts` (the report).
- The leaderboard reads `game_records` with `*`. Since Oct 2026 a row keeps every realm's best for each
  record, not just the game's: roughly 10–40 KB a row, growing with the number of realms. Fine for now;
  if it gets slow, give the list tabs a lighter select.

## A new column must be optional at the write site

Since P0-17 the live site deploys only after its migration, but a site pull request labelled `staging`
without the database pull request it needs (not stacked on it) meets a staging database without the
change, and old copies of the site can't be ruled out. So code can still meet a database without the new column. Writing an unknown column fails the whole save, which in `runTurn` is a failed turn. Probe once
(as `probeGameMeta` does), and spread `{}` instead of the field while it's absent (`metaPatch`). Readers
prefer the new column and fall back to the old source. Prove it with a test that hides the column
(`MISSING_COLS` in `tests/lib/stub-db.js`), as `tests/meta-missing-turn.test.js` does. This is why database
and site changes go in separate PRs ([supabase/README.md](../supabase/README.md#database-and-site-changes-go-separately)).

## A site change that needs a database change

Every page that uses the database (both portals and the Hall of Fame) declares `KC_DB_MIN`, the oldest
database version it works with (a migration's 14-digit version), and starts through
`kcDbGuard(sb, KC_DB_MIN)` (`src/db/kc-db-guard.ts`, P0-34). Before the first read, it asks the database for
its version (`kc_db_version()`, the newest migration applied). On an older database, or one without the
function, or no answer after one retry, the page stops with "The game is being updated" and nothing is read
or written.
- **Raising `KC_DB_MIN` is how a site PR says "needs migration X".** Use it when the page can't sensibly
  work without the change; otherwise cope ([above](#a-new-column-must-be-optional-at-the-write-site)).
  Raise it in every page that needs the change, not only the one you edited.
- `npm test`'s `db-min` check fails if a `KC_DB_MIN` is newer than the newest file in
  `supabase/migrations/`: the migration must be merged, or the site branch stacked on its pull request.
- Never lower `KC_DB_MIN` to get a page past the stop. It means the database is missing something the page
  relies on.
- The GM tab's reload before a due turn (`refreshIfNewerBuild`) boots a newer GM page when one is ready, so the
  check runs again before that page's first turn.
- Tests: every stand-in database answers with the newest migration (`DB_VERSION` in `tests/lib/boot.js`).
  `bootJsdom(..., {dbVersion})` sets another answer (an older version, `null` for a missing function, or
  `'offline'`), as `tests/db-guard.test.js` does.

## String-anchor harness hooks

They are gone (plan P1-09a). Until then several tests reached inside the GM portal by matching **exact source lines**
of the built page and injecting code there, and others cut code out of a page between two exact strings, or matched
its text with a regular expression: a reformat (Prettier, P1-09c) or the module switch (P1-09d) would have broken them,
some silently. Now no test reads a page's source by line:

- **A test that needs a piece of the site's code, or its words, asks [tests/lib/source.ts](../tests/lib/source.ts)**,
  which reads `src/` by its syntax tree (TypeScript's parser, for `.js` and `.ts` alike): a file's named declarations
  as a script (`sourceOf`, `sourceFrom`, `scriptOf`, `statementsBetween`), the values it declares
  (`initializersOf`, `entriesOf`), the strings it holds (`stringsOf`, `pageText`), its calls (`callsTo`), or its code
  in one canonical layout for a regular expression (`compactOf`, `compactPage`, `compactDeclaration`). The answers
  are the same however the file is laid out (`tests/unit/the-source-read-by-its-syntax-tree.test.ts` checks every
  file as written and after Prettier). A comment is read as written (`pageSource`).
- **A test that must change a function's behaviour stands it in where it runs:** on the engine's modules, with
  `vi.spyOn` on the module that exports it (plan P1-14a; it reaches calls from other files only:
  [below](#a-stand-in-on-a-module-reaches-calls-from-other-files-only)), or, for the tests still on the engine's bare
  vm (`tests/lib/engine.ts`; a whole turn there with `tests/lib/scenario-in-the-vm.ts`), there, where a top-level
  function can be replaced from outside (`W.trySkillGain = …`). On a booted page it can't be, once the page's files are
  modules: a
  test that needs a page to fail where nothing outside can make it fail boots a page built from a planted copy of
  `src/` (`plantedSite`, with `plantAtStart` or `plantBefore`, found by the syntax tree too).
- Don't add a test that matches a line, an indent or a quote style of the site's code, or that writes to a page's
  function or top-level variable from outside (`W.fn = …`, `W.eval('flag=true')`): after the module switch it would
  do nothing, and the test could pass without testing anything.
- **A check that picks the site's files by their name must fail when it reads none.** When the files became `.ts`
  (P1-09e), `html-lint` and `sort-comparators`, which read every `src/**/*.js`, still passed reading only the templates:
  `html-lint`'s stale allowlist entry gave it away. Both are ESLint rules now (P1-13c and P1-13d), and
  `tests/static/harness.test.ts` checks every file of `src/` gets them. A new check of `src/` reads the pages' modules,
  or checks it does.

## A test on the engine's modules loads the whole engine first

A test that imports the engine's functions from their modules (plan P1-14a) imports
[tests/lib/the-whole-engine.ts](../tests/lib/the-whole-engine.ts) first. Some files change other files' values as they
load: `engine/items/equipment.ts` re-tiers two of the content's tables (`ALL_MAGIC_ITEMS_P` and `LEGENDARY_ITEMS_P`).
A test that imports only the data file, or only the files one function reaches (`world/generate.ts` reaches 44 of the
116 files of `src/engine/` and `src/views/`), reads those tables as they were before, which neither the GM page nor
the engine's bundle ever does. `tests/unit/engine-loads.test.ts` checks that, with the whole engine loaded, every
export of the modules holds what the bundle holds.

The modules also keep state between calls (the name pools, `_usedHeroNames` and the like): a world depends on the
worlds made before it in the same process. A test whose outcome depends on the dice gives itself fresh modules:
`vi.resetModules()`, then `await import(…)` of the whole engine and of what it calls, then `kcRng.seed(…)`
([tests/lib/a-staged-turn-on-the-engines-modules.ts](../tests/lib/a-staged-turn-on-the-engines-modules.ts) does). Then
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

## A lifted helper takes the turn's context first

Since P1-08a, a helper lifted out of `resolveTurn` that reads the turn's state takes `turnContext` as its first argument
(`src/engine/turn/context.ts`; [ARCHITECTURE.md](ARCHITECTURE.md#the-turn-engine-gm-portal)).

- A call that leaves it out doesn't fail: every argument moves along by one, and the helper quietly reads the wrong
  thing. `no-undef` can't see it. The balance matrix catches it in the code it runs; anywhere else, a direct test.
- A helper passed as a value is wrapped where it's passed: `(...a)=>effStat(turnContext,...a)`. A test hook that hands
  one back wraps it the same way, or the test moves down and calls it directly (P1-08b moved `naval-retreat`,
  `retreat-dry-ground`, `march-one-rate` and most of `battle-tweaks` to `tests/unit/`; P1-08c `terror-three-stacks` and
  `xp-naval-passenger`; P1-08e the personal-combat tests, through `tests/lib/personal-combat.ts`, whose `call()` gives a
  helper that takes the context one on a new world; P1-08f the personal-combat fuzz, `fuzz-personal-combat`, and
  `fallen-commander-host`, out of `battle-faced-turn`; P1-08g `npc-parity`, which calls `combatVsNPC` on a fresh
  context for each staged battle; P1-08i3 `encounter-seventy`, and `battle-faced-turn`'s erosion part into
  `stalled-battles-unit-gain-and-war-fronts`). A hook that also needs a function still nested hands back the lifted ones
  wrapped, or leaves them to a test of their own. A test that only watches the calls to a lifted helper wraps the
  top-level function instead of hooking its first line: the `xp-` tests' `XP_RECORD` wraps `trySkillGain` (P1-08c); one that changes what a helper is
  given wraps it the same way: `lib/scenario-in-the-vm.ts`' `reportEveryRealm` wraps the views' `buildReports` (P1-08d, on
  the page's `lib/boot.js` until P1-09a), and `pursuit-one-battle` wraps
  `pursuitCatchChance` for a certain catch (P1-08i3). A `typeof f==='function'` guard
  stays true: a lifted helper is a top-level function.
- A value the turn changes as it goes (`_logCtx`, `_currentPhase`, `_afterPhases`, since P1-08c `_combatSkillProv`,
  `_duelFoes`, `_battleSeq`, `_chieftainDuelGain`, `_deferredSkillLogs`, `_pcSimulating`, since P1-08i1
  `enteredThisPhase`, and since P1-08i3 `_tier0Open` and `_unitGainQueue`) lives only in the context. Read and
  write `turnContext._currentPhase`, never a copy in a local, or a later reader sees an old value. A test hook that
  changes one, or swaps `G`, changes the context's too (`battle-faced-turn`'s `setG` did, until P1-08i3; `npc-parity`'s
  `setPhase` did, until P1-08g moved it down).
- An order taken out of `processOrder` (since P1-08j1: the Move, `resolveMoveOrder`; since P1-08j2 the explore and
  search orders; since P1-08j3 recruiting, hiring and the realm's works; since P1-08j4 research and practice; since P1-08j5 items and armies; since P1-08j6 espionage; since P1-08j7 Cast Spell; since P1-08j8 the war orders) takes, after the context, the values `processOrder` works out before its `switch` that the order
  reads, in the order they're declared there (the Move's `c, ph, _fmSlip, target, prov, player`; Explore's only
  `c, prov`). So the calls differ from order to order. The case is the call and `break`, and a `return` in the order
  ends it, as the case's own `break` did: nothing follows the `switch`. Keep the call in step with the function: two
  arguments swapped (`prov` and `player`, or `target` and `extra`) pass `no-undef` and every check but a test that
  plays the order (`scenario/move-orders-in-a-whole-turn`, `scenario/explore-and-search-orders-in-a-whole-turn`,
  `scenario/recruit-hire-and-realm-works-orders-in-a-whole-turn`, `scenario/research-and-practice-orders-in-a-whole-turn`,
  `scenario/item-and-army-orders-in-a-whole-turn`, `scenario/espionage-orders-in-a-whole-turn`,
  `scenario/cast-spell-order-in-a-whole-turn`, `scenario/war-orders-in-a-whole-turn`). A helper nested in `processOrder` that leaves with them takes the
  context, then the values of `processOrder`'s it closed over, then its own arguments (since P1-08j6:
  `thiefCaughtScuffle(turnContext, prov, thief, victim, what)`; since P1-08j7: `charmBacklash(turnContext, prov, caster,
  t, why)`), and a `processOrder` constant only it reads becomes a top-level constant (`CHARM_BACKLASH_PCT`). Since
  P1-08j9 `processOrder` is top-level itself (`processOrder(turnContext,c,o,ph)`), so a test can call it, or stand in an
  order's function in the `vm` to see what it is handed: `unit/order-dispatch-called-directly` checks every call's
  arguments that way.
- A stage of the phase loop taken out of `resolveTurn` (since P1-08k1: the start of the phase, intents and reactions,
  the orders in two tiers, the end of the phase, in
  `engine/turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.ts`) is a function of its statements,
  taking the context, then the loop's values it reads, in the order the loop declares them (`ph`, `_phaseStartLoc`,
  `intents`): those stay declared in the loop and are passed in. A stage that reads none of them takes the context alone
  (P1-08k2's Early Winter, the body of `if(ph===4){…}`, which keeps its `if` and its call). A stage of `resolveTurn`'s own body (P1-08k3's after the phases, from the loop's end to the bots' late
  declarations, `botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim(turnContext)` since P1-08l1) keeps its 2-space indent under a function line at 0; a test that calls it does what the turn
  does first: `turnContext._currentPhase` null, `turnContext._afterPhases` true and the log's context clear, so every
  line it writes with no phase of its own is filed after the phases (99). P1-08k4's diplomacy and victory stages read the
  realms' declarations and Reckoning calls from the context (`turnContext.diploDeclarations`, `turnContext.reckoningCalls`,
  which `turnContext()` in `tests/lib/engine.ts` makes empty): a test that calls them puts the realms' declarations
  there, as the order merge does. P1-08k5a's first part of the new turn moves the turn counter on itself: a test that
  calls it reads the turn it was played on before the call. The board has no kings (`board()` clears every hero), so a
  whole turn crowns an heir for every realm at its end unless the test stands a king in each, as `stageCase` in
  `tests/lib/new-turn-succession-and-summons-cases.ts` does. P1-08k5b's second part runs on the turn the first part
  moved on to: a test that calls it alone moves `G.turn` on by one first, or a Divine hero fallen the turn before is not
  yet due to rise. A direct call changes the staged heroes in place, so a check must compare with values kept at staging
  (a province, an id), not the staged hero's own fields. P1-08k6's two title stages (once immediately-invoked functions
  at the end of the body, named functions now: their bodies keep their 4-space indent under a function line at 2) also
  run on the turn moved on: titles are public from turn 5 as the stages see it, so a test that calls them stages turn 4
  and moves it on, and the Loremaster's "fresh" discovery is one made on the turn just played (`G.turn - 1`). On the
  shared board every realm holds a seat of equal tax and gold, so realm 0 holds the Throne and the Vaultkeeper (the
  first of equals) and its king the Colossus and the Castellan: a test of the title changes counts them, and a hero's
  wage (never under 1g) can hand the Vaultkeeper to another realm unless the realm is given gold. P1-08k7's two set-up
  stages (the turn's start repairs, the merge of the realms' orders) run before `log` is ready, so they log nothing:
  what the merge has to tell goes into the context's collectors (`staleOrderWarnings`, `diploDeclarations`,
  `safeStartRefused`, `discoveryChoicePicks`, `reckoningCalls`, `playerMessages`), which the merge itself makes afresh
  each turn and joins to the context (since P1-08l2; `resolveTurn` declared them before). A test that calls the merge
  gives the context the slot rows (`turnContext.freshPlayers`) and the turn run (`turnContext.expectedTurnToRun`, which
  may differ from `G.turn`) first, and reads what it collected from the context after the call: a collector held from
  before the call is not the one the merge filled (`turnContext()` in `tests/lib/engine.ts` makes them empty). What the
  set-up leaves in `G.turnOrders` and the per-turn lists is gone by the turn's end: a whole turn reads it as the first
  phase begins. P1-08k8's four stages before the first phase make the movement pools, `SEASONS`, the turn's trackers
  and the war fronts at the start afresh and join them to the context, so a test that calls them reads those from the
  context after the call (a value made before the call is the old one; `STALE_CONTEXT` in
  `tests/lib/before-the-first-phase-cases.ts` leaves stale ones in to show it), and a whole turn's are read from the
  context as the first phase begins: `move-points` reads the pools that way. A direct call of the four runs without the
  bots' plan between the third and the fourth (P1-08l2's, called by `resolveTurn` there), so a case about a bot's own
  pick or plan is a whole turn's, or calls the plan between them. P1-08l2's bots' plan
  (`botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning`, in `engine/bots/`)
  takes the context alone and calls the eight passes in order, each handed the context's own world and bot realms; the
  movement pass is handed the duel forecast (`botHuntersDuelForecastFoughtOnCopiesOfBothHeroes`, a top-level function
  now, so a test can stand it in) wrapped with the context. A test that calls the plan readies the context as
  `resolveTurn` has it there (`ready` in `tests/lib/the-bots-plan-cases.ts`: the merge run with a bot's seat holding no
  player, so the merge writes nothing for it, then the stages before the plan). P1-08l1's bots' diplomacy
  (`botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim`, in `engine/bots/`) takes the context alone and
  reads each bot realm's rivals from `turnContext._botEncounteredAtStart`: a copy of each bot's record of whom it had met,
  made when the turn began, before the merge, and read by both of its calls (before the first phase and after the
  phases). A test that calls it makes that copy as `resolveTurn` does (`ready` in `tests/lib/bot-diplomacy-cases.ts`);
  changing a realm's `_encountered` afterwards changes nothing. The loop is the stages' calls, the intents between
  the first two. A test that calls a stage does what the loop does first: it sets `turnContext._currentPhase`, and the
  log's context is clear (`{charId:null, phase:null}`) between phases, so a line with no phase of its own is filed under
  the phase being resolved; the board in `tests/lib/middle-of-a-bot-world.ts` leaves it on its own phase.
- A test can stand in a top-level **function** by replacing it in the `vm` (`engine.f = …`), as
  `unit/order-dispatch-called-directly` and `unit/phase-stages-called-directly` do. Don't stand in a top-level `const`
  arrow (`defendSpentThisPhase`, `noteEntered`): until P1-09d a `const` wasn't a property of the `vm`'s global object,
  so the engine kept calling the original; since then the engine's bundle writes it as a `var`, so the stand-in would
  reach it in the `vm` but not in a test that imports the module (P1-14), where a `const` can't be replaced. Stage the
  state it reads instead. A table declared with `const` (`TITLE_DEFS`, `MINOR_TITLES`, `SEA_TYPES`, `SKILL_LABELS`) is
  read in the `vm` with `vm.runInContext('JSON.stringify(TITLE_DEFS)', engine)`, which works either way.
- Reading a context value before `resolveTurn` has set it gives `undefined`; reading the old `let` before its line
  threw. P1-08a checked that nothing reads one early (a throwaway tripwire through a whole test run and the matrix), and
  P1-08b again for the objects that join partway through the turn (the movement pools, `SEASONS`,
  `recruitedThisTurn`, `_intrusionAcc`): before its join line, the old name threw; the context's reads `undefined`.
  P1-08c checked again for the six values above and `_elvenEscapeQueue`, P1-08d for `presenceByPhase`, `clairWatch` and
  `_reports`, P1-08e for `_botPlayerIdx`, P1-08i1 for `enteredThisPhase` and `_distCache`, P1-08i3 for `_tier0Open`, `_unitGainQueue`, `_warFrontAtStart` and `_warFrontProvs`. P1-08k4 and P1-08k7 for the merge's six collectors. P1-08k8 added no join and no `let` (the values it makes were joined before; their join lines moved with them), so it didn't rerun it. P1-08l1 reran it for `_botEncounteredAtStart`; P1-08l2 added none (the merge's six collectors moved into the merge with their join lines, still joined before anything reads them), so it didn't. `turnContext()` in `tests/lib/engine.ts` sets each of them, as `resolveTurn`
  does: a test of a lifted helper that reads one it doesn't set gets `undefined`, not the turn's value.

## A line goes through `emit`

Every line of the turn enters the GM's log (`turnContext.turnLog`) through `emit(turnContext, event)`, in
`src/engine/turn/events-and-their-audiences.ts` (P1-12a2). The event says what happened (its type, and its finished
text or, from P1-12c3, the fact its words are written from: below), where and when (`province`, `phase`), whom it is about (`hero`, `heroes`, `battle`), and who may read it
(`audience`: `realms` told, the `actor`, `seen` by the `'world'`, by whoever is `'there'` or by those in the `'battle'`,
and `except` the realms that never read it). A line pushed past it chooses its own audience, the way the leaks the report
check finds were made.
- The lint rule `kc/narrative-lines-go-through-emit` refuses, in all of `src/engine` and `src/views` but the events file
  (since P1-12a4; folder by folder from P1-12a2), any write to `turnLog`, a `log(…)` call (but `console.log` and
  `Math.log`; there is no `log()` helper any more) and a narrative written by hand: add a fight's line with
  `narrate(narrative, line)`: its words, or a fact (below). Lines already written move with `narrateAll` (a duel's
  narrative into a battle's, each line as it is), `narrateAt` (lines put in before a line) and `takeBackLinesFrom` (a
  blow that never landed). `emitBattle` and `emitNarrLine` write a fight's narrative out with the fight's event
  (`FightLine`: the event but its words), each line in order: a fact of a kind whose audience is its hero's realm alone
  to that realm alone (below), the rest to the fight's audience.
- **A line for one realm alone inside a fight is a kind whose audience says so** (P1-12c4; `narrateTo` and its
  `{ text, onlyPlayer, charId }` lines went). Each kind's audience is written once, beside the kind in its area's
  module, and its type says which (`THE_AUDIENCE_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE`: a kind given another is a
  compile error): the fight's, its hero's realm alone, or, for a kind filed on its own and not in a fight's narrative
  (a host gained in a province, a stalled battle: P1-12c6), its event's, the audience the event that files it names.
  Two kinds are for one realm alone: a hero's hit-point rise in a
  fight (`awardHpRoll`'s line) and the surgeons' word to a fallen duellist's own realm (`preBattleDuel`); each names its
  `realm` (and the rise its `hero`), and `emitNarrLine` files it told to that realm alone, with no heroes, under its
  hero (else the fight's). A new line the man across the field must not read is a new kind of that audience, and the
  leak check's own list of them (`KINDS_FOR_ONE_REALM_ALONE`, `tests/lib/report-leaks.ts`) gains it: the check "a line
  for one realm alone" reads every realm's report against the recorded events, whatever audience the engine gave them.
  The engine reads a fight's line by its kind, never its words: the mercy that stays a killing blow keeps a skill rise's
  words, a line for one realm alone and another area's fact, and drops the fight's own lines
  (`isAPersonalCombatsLine`, `isALineForEveryoneInTheFight`); the two searches for a battle's header find a battle
  between heroes' "Battle for …" line and its "… a battle is initiated." line by their kinds alone (P1-12c5, c6: no
  line of `battle/` is words any more, so `narrText` went). A line overwritten in place (a battle's heading, once the
  beaten side holds the field) is overwritten with a fact of another kind.
- **A line handed to a helper is an event but its words.** A helper that writes a line for its caller (`logSplit`,
  `reportHeroFall`, the skill rises held back in `_deferredSkillLogs`) takes the line's place as `EventButItsWords`
  (the event without its type and text: `{ audience, province, hero, phase, … }`), and files it with
  `emit(turnContext, { type, text, ...place })`. A line that may be words or a fact (a beaten guard's survivors' fates:
  facts, but a unit disbanding is still words from `army-tables.ts`; what `notifyTarget` and `notifyProvinceOwner` are
  handed) goes in as `...theWordsOrTheFactOfALine(line)`, which gives `emit` its `text` or its `fact`. Build it as the event's own fields, never as the old `log()` meta
  (`targets`, `provinceId`, `charId`, `public`). A line seen by those there but with no province is seen by the world
  (`seen: 'world'`), as the report reads it: where the province may be missing, say so
  (`seen: prov ? 'there' : 'world'`).
- **Every event names its hero** (P1-12c2). `hero` is a hero's id (`hero: c.id`), `null` for no hero, or
  `THE_HERO_WHOSE_ORDER_IS_RESOLVING` (a named constant in the events file) for the hero whose order is resolving
  (`turnContext._logCtx.charId`). `emit` files a line naming the constant under that hero only when the line already
  reaches his realm (it is told to it, is its deed, or is seen by the world or there; a battle's line reaches those who
  fought in it by being told), else under no hero (P1-12c1). A realm reads every line filed under one of its heroes, so
  before that a line written while Aldric's order resolved, told only to the province's owner, reached Aldric's realm
  too. A hero who serves no realm keeps his lines. `emit` throws on an event with no `hero`; the lint rule refuses
  `emit`'s event, and an event's place (an object literal with an `audience`, as handed to `logSplit`,
  `reportHeroFall` or the held-back skill rises), written without `hero` and without a spread; a spread place carries
  its own. Before P1-12c2 a `hero` left out or `null` meant the hero whose order is resolving and `'none'` meant no
  hero; the script that named every hero made the first the constant and `'none'` `null` (a line for the GM alone, the
  Philosopher's Stone's note on the hoards, says `hero: null`:
  `tests/scenario/a-line-for-the-gm-alone-reaches-no-realm.test.ts`). Where a hero's id may be missing, say what then
  (`hero: dest ? dest.id : THE_HERO_WHOSE_ORDER_IS_RESOLVING`, or `?? THE_HERO_WHOSE_ORDER_IS_RESOLVING`). The cases:
  `tests/unit/emit-writes-the-lines-log-wrote.test.ts`; the audience check (`tests/lib/report-leaks.ts`) states the
  same rule apart. The area rows of P1-12c replace the constant with the hero each fact names. The `phase` falls back
  as before: left out or `null` is the phase of that order, else the phase resolving, else 99 once the phases are over;
  `phase: 'none'` is no phase.
- **A typed line records a fact, and the views write its words** (P1-12c3). An event carries `text` (its finished
  words) or `fact` (one kind of `LineFact`, never both: `emit` throws on both). An area's kinds are typed beside its code
  (the battles': `src/engine/battle/the-facts-a-battles-lines-record.ts`, the force markers and, since P1-12c5 and c6,
  every sentence of `battle/`: a battle between heroes, the duel before a battle, a battle against a province's own
  defenders, a host gained in a province, a stalled battle, a war front, and the helpers that return a line, which
  return its fact; personal combat's:
  `src/engine/personal-combat/the-facts-a-personal-combats-lines-record.ts`, P1-12c4; one kind per sentence, one field
  per value it was written with, and a kind's name unique across the areas, since `theWordsOf` routes a fact by its
  kind), each with its fields and its audience, and `src/views/prose/` writes their words after
  the turn, one module per area (`theWordsOf` hands each fact to its area's), a `switch` over the kinds with a `never`
  default: a new kind with no words doesn't compile there. `forceMarker` returns its fact, and `narrate` takes it as it
  takes words. **`src/engine/battle/` and `src/engine/personal-combat/` write no line's words** (P1-12c6): a new line
  there is a new kind (its words in `src/views/prose/`), or a field of one where the words are a fragment (P1-12d moves
  those fields' words into the prose); the words a battle takes from another folder's helper (a unit disbanding, a sea
  trap, a naval hold, the wanderer's escape, a hero's death) are P1-12d's. So **the engine's log holds no words for a
  typed line** (its `text` is `null`, its `fact` last): read a
  line's words from the GM's log in words (`theTurnsLinesInWords(turnLog).gmLog`, `src/views/prose/the-words-of-each-
  line.ts`), never from `resolveTurn`'s `log` or `turnContext.turnLog`. `buildReports` writes them before it picks any
  realm's lines and returns them as `gmLog`, which the shell saves; every harness that plays a turn reads them
  (`tests/lib/scenario-in-the-vm.ts`, `a-staged-turn-on-the-engines-modules.ts`, the board's `lines()` in
  `middle-of-a-bot-world.ts`), and a test that reads a narrative, or a line a helper returns, writes a fact's words
  with `theWordsOf` (a personal combat's: `wordsOf` or `wordsForEveryoneInTheFight`, `tests/lib/personal-combat.ts`; on
  the booted GM portal, its `theWordsOf`: `tests/battle-grid.test.js`). A test that keeps a
  narrative's strings and drops the rest reads nothing of a typed line: read its words. In this run a
  line's words are the same for every reader (the masking of unmet realms stays on them, R-046).
- **A battle's tiers and its tally come from its words, in the views.** `emitBattle` files each line with its tier
  still to work out (`A_TIER_WORKED_OUT_FROM_THE_WORDS_OF_THE_BATTLES_LINES`) and, after them, the place of its losses
  tally (a fact with no words, filed with the fight's event, so it keeps the fight's audience, hero and place; none when
  every line is for one realm alone). The words pass gives each line its tier (`battleLineTiers`) and writes the tally
  (`battleTallyLine`, both in `src/engine/battle/fates.ts`, unchanged) where the casualty lists begin, else after the
  lines, else nowhere. Nothing in the engine may read a line's tier, or the tally, as the turn goes on: they aren't
  there yet. The cases: `tests/unit/the-views-write-each-lines-words.test.ts`.
- Nothing stored changes in P1-12a, P1-12b or this run of P1-12c: the GM's log in words is today's line forms, key for
  key and in the same order (the old `log()`'s 17 keys; `form: 'bare'`, the 14 of the lines once pushed directly;
  `notFor` last when `except` is given), with no fact in it. The stored form changes once, declared, when the last area
  is typed (P1-12's Decisions of 2026-10-24, Decision 3). The balance matrix hashes the stored log (`writes`), and every
  realm's report is compared line for line (`npm run balance`). `tests/unit/emit-writes-the-lines-log-wrote.test.ts`
  checks the forms (its oracle against copies of the old code ran from P1-12a2 to P1-12a4, until every caller was
  converted).

## Views never write

Building the reports reads the world and the GM's log, and writes to neither (P1-12b2, P1-12's Decision 9). Every
realm's report is built from the same working copy, after the save, one realm after another: a write made while one
realm's report is built changes what the next realm's report reads, and the save never holds it, so nothing shows it
but the reports.
- A rule that changes the world belongs to the engine, before the reports: the Spy-stealth rolls and the Invisibility
  re-stamp are `spyStealthAndInvisibilityStampedForTheReports` (`src/engine/run-turn.ts`), an engine step `resolveTurn`
  hands the shell beside `whatTheReportsRead`. The shell calls it after the save and before the reports, on the turn's
  dice; `whatTheReportsRead` refuses to hand anything over before it, or twice. The reports are the views'
  (`buildReports` and `playerEvents`, `src/views/every-realms-report-and-the-lines-each-realm-reads.ts`, P1-12b3), which
  the engine doesn't import: the shell calls them with what the turn hands over. A harness that plays a turn calls the
  three, in that order. Since P1-12b5 only perception reads the world (`playerEvents` and `playerView`); the report
  itself (`buildTurnReport`) reads only what those two give it.
- The reports draw no dice either: since P1-12b3 they are lent none, so a draw there would come from the page's dice
  and shift the next turn's seed (the frozen-world test below counts the draws).
- A per-turn mark is cleared at the next turn's start, not after the reports: the battle flags (`_hadBattleThisTurn`,
  `_combatPlayersThisTurn`) stay on the working copy, and `lastTurnsBattleAndDuelSwordsClearedFromTheMap` clears them
  as the next turn reads the save.
- A helper the report calls must not write either, even the same value back: `normaliseEquipment` writes only a flag
  that changes, so `activeItems` and every helper that reads items through it are reads at report time, when every
  hero's items are already in order.
- `tests/unit/the-reports-are-built-on-a-world-that-cannot-be-written.test.ts` plays a whole game of the matrix with
  every report built on a world and a log that refuse every write (each write noted, then thrown), on dice that count
  every draw, and compares every
  report with the matrix's. A new write in a report, or in anything it calls, turns it red. `_MAXHP_PLAYERS`, a global
  the turn keeps, is not the world: it is P1-10's.

## Nothing is on `window` but `globals.ts`

The site's code is ES modules (P1-09d): a module's top-level names are its own, so an inline `on…="…"` handler, a
browser spec's `page.evaluate` or a test's `W.eval` reaches only what the page puts on `window`. Each script page does
that in one file, `src/ui/<page>/globals.ts`, the last its entry imports (P1-09b).

- **A function or a constant a handler calls or a test reaches goes on a list** in `globals.ts`, the handlers' or the
  tests', with the file that declares it, and is imported there.
- **A variable a test (or a handler) reads or writes is a declared global**, `globalThis.<name> = <value>;` where it is
  declared: a list copies a value once, and a variable's copy goes stale.
- **Name it as code.** `page-globals` reads the code a test hands a page: `typeof buildGameRecords` is read, a name in a
  string (`['buildGameRecords'].map(n=>eval(n))`) isn't, and the spec then fails only in Chromium.
- **Don't stand a page function in from a test** (`W.f = …`): the page's own calls never see the stand-in, and the test
  passes without testing anything. Stage what the function reads instead (the dice, `kcRng.use(…)`; the browser's
  `fetch` or timers; a declared global's fields), stand it in in the engine's `vm` (`tests/lib/scenario-in-the-vm.ts`),
  or build a page from a planted copy (`plantedSite`, `tests/lib/source.ts`). `npm test`'s `page-globals` fails on a
  name missing from a list, a variable that isn't a declared global, or a page stand-in.
- **jsdom is looser than a browser.** `tests/lib/boot.js` runs the bundle as a classic script, so in jsdom every
  top-level function and `var` of the bundle is on `window`, listed or not: a check that passes in jsdom can fail in
  Chromium. `page-globals` is what keeps the two the same.
- **In the engine's `vm`** (`tests/lib/engine.ts`) the bundle's top-level names are the context's globals, so
  `vm.runInContext('NAME', engine)` reads any of them, and `engine.f = …` stands a top-level function in (not a
  `const`: [A lifted helper takes the turn's context first](#a-lifted-helper-takes-the-turns-context-first)). Assert that a table was actually read, i.e. is
  non-empty, before asserting anything about its contents.
- jsdom has no `innerText`; use `textContent`.

## `game_state` is a string

On a `games` row, `game_state` is a JSON **string**. Always use `parseGameState(game)`; never read fields
off it directly. A function that guards with `typeof state !== 'object'` turns a raw string into a
silent no-op. Before adding a new reader, grep for `game_state` reads that don't parse.

## A refactor that changes a container's type needs a test that calls the consumers

When the shared tables were collapsed into the data file, one table became a `Set` while five call
sites still used `.includes`. The equivalence check compared table **contents** before and after, so
it passed. Every turn report then threw.

- When a refactor changes a type (array ↔ `Set`, object ↔ `Map`), test through the **consumers**
  (e.g. build a turn report for a realm that has a fleet), not by comparing contents.
- Grep for every method used on the name (`.includes`, `.has`, `.length`, `.size`, indexing) before
  changing what it holds.

## Post-commit work in `runTurn`

The one `try` in `runTurn`, the turn's shell (`src/ui/gm/turn-shell.ts`), runs from the load through `resolveTurn`
to the conditional save and on to the reports. Everything after the save (reports, `turn_logs`, telemetry) runs
after the turn is already resolved and stored. A throw there must not restore orders, re-flag `orders_submitted`,
or let the watcher retry the turn: that combination once made live games resolve themselves once a minute.

- `_turnCommitted` marks that the save succeeded. Any code added after the save must respect it.
- **The reports are built after the save, never inside `resolveTurn`** (P1-18d). `resolveTurn` returns the Spy-stealth
  step (P1-12b2) and what the reports read (`whatTheReportsRead`, P1-12b3; the views' `buildReports` builds them from
  it: [Views never write](#views-never-write)), and the shell calls them only once `_turnCommitted` is set. A report built before the save would
  make every report bug a failed turn: the orders put back and the turn tried again after every cooldown, for as
  long as the tab stayed open. `turn-shell`'s post-save guard plants a throw in `buildTurnReport` and checks that
  the turn stays saved.
- A save that answers with an error isn't proof that nothing was saved: a request can time out after the
  database committed it. The catch reads the game's turn again before it restores anything (P1-18a).
- `runTurn` **returns** `{ok, committed, conflict, error}` on every path; it doesn't throw. Callers must
  check the return value. A `try/catch` around the call almost never fires. A new early exit returns an
  outcome too, and `tests/page/turn-shell.test.ts` holds each failure's outcome.
- A retry loop around a deterministic engine needs a cooldown, not a retry (`_autoFailUntil`).

## Hooks in the turn path must never fail a turn

Telemetry and Hall-of-Fame writes inside `runTurn` are each wrapped in `try { … } catch {}`. That's a
contract: a statistics bug must never cost a turn. The price is that a broken hook is silent, so test
hooks by checking the rows they write.

- Read hook values from the scope they're in. The NPC and player-vs-player combat paths name the same
  thing differently.
- Coerce numbers with `Number()` and `isFinite`, not `|| 0`: `NaN || 0` is `0`, but `'nonsense' || 0`
  is `'nonsense'`, which reaches the page as a literal "NaN".
- A render bug that only produces "undefined" throws nothing. Page tests scan the rendered HTML for
  `undefined`, `NaN` and `[object Object]`.

## A rule written twice must change twice

The most common root cause in this project's history is two copies of one rule disagreeing. The shared
tables now have one source, and so do the rules of a hero, an army, an item, a level or a number that the player
portal uses (P1-11a): it calls the engine's own function, in `src/engine/rules-on-plain-values/`, through
`src/shared/` ([ARCHITECTURE.md](ARCHITECTURE.md#kingdoms-call-datats-the-one-source-for-shared-rules)). Change such a
rule there, once. Rules are still restated:
- in the player portal's projections (forecasts, order validation, hints): the copies still left are the ones
  `tests/lib/player-portal-copies.ts` checks (`effMagicLvl`, the army card's sea-transport line, the
  Explore forecast `exploreGainFor`; the level of a hero's Druid that `druidNeedP` and the army card's Druid lines
  feed the engine's Druid rule; and the Naval 8 the Move notice works out from the report's skills to feed the sea
  lift, `seaLiftOfAColumn`), and the other forecasts and order checks whose engine rule is written inline (P1-11b,
  P1-19);
- at order time and again at resolution time in the engine;
- in the turn-report forecast versus the end-of-turn collector;
- in narrative strings, both rulebooks, join-screen blurbs and tooltips.

Before changing a rule, grep the engine and both portals for its nouns **and its numbers**, and change
every place in the same commit. When a number moves, grep the old number in narrative strings and the
rulebooks.

## HTML is built only through `kcHtml`

Every name, message and record on screen was typed by someone, so it goes into a page as text (P0-19,
[ARCHITECTURE.md](ARCHITECTURE.md#how-a-page-builds-html)). The lint rule `kc/html-is-built-only-through-kc-html`
(P1-13d; it replaced `html-lint`) catches most mistakes as you write them; these ones it can't, or they cost time:

- **Markup in a value is shown as text.** In ``kcHtml`<td>${won?'<span class="pill">won</span>':''}</td>` `` the pill
  comes out as `<span…` on screen. Make the markup `kcHtml` too: ``${won?kcHtml`<span class="pill">won</span>`:''}``.
  The same goes for a helper that returns a plain string of markup, for a table of fixed text with markup in it (the
  player portal's `SKILL_INFO`: write those entries as ``kcHtml`…` ``), and for an entity written in data (`'Hosts &amp;
  armies'` now shows `&amp;`: write `&`). An attribute put in as a value breaks the same way: in
  ``kcHtml`<div${dim?' style="opacity:.8"':''}>` `` the quotes are escaped, so write ``${dim?kcHtml` style="opacity:.8"`:''}``.
  The lint rule can't see either mistake; `same-dom.js` (below) finds it on the screens a tour visits.
- **Never join `kcHtml` with `+`, `+=` or `.join('')`.** Each makes a plain string, which the next `kcHtml` escapes,
  so the markup shows as text. Collect pieces in an array and put the array in: ``kcHtml`<ul>${rows}</ul>` ``.
  The lint rule sees this only when `kcHtml` is written in the expression: `row(a)+row(b)`, where `row` returns `kcHtml`, and
  `.join(', ')` on a list of `kcHtml` pass it, and so do `.map(…).filter(Boolean).join('')`, `.flatMap(…).join('')`
  and `Array.from(…).join('')`. In the player portal, a list with a separator goes in as `kcJoinP(list, ', ')` (the
  separator is text; write ``kcHtml`<br>` `` for markup).
- **A template with no markup of its own still needs `kcHtml` if a value in it is `kcHtml`.** In
  ``chanceLine(`Success: ${pct(n)}`)``, where `pct` returns `<strong>`, the untagged template makes a plain string and
  the bold shows as text. Tag it: ``chanceLine(kcHtml`Success: ${pct(n)}`)``. The lint rule only looks at templates
  with markup in them.
- **A helper whose result goes straight into `innerHTML` returns `kcHtml` on every path**, even a line with no
  markup: `el.innerHTML=note(c)` reads a plain string as HTML, names and all. The orders' `exploreProjectionNote` is
  one; the lint rule sees the sink, not what the helper returns.
- **Markup read back as a string.** Code that searches the markup it built (the Move field finds the option that
  opens selected with a regular expression) reads ``String(kcHtml`…`)``, which is the markup, escaped values and all.
- **An empty list is still true.** `html||'Nothing yet'` worked while `html` was a string; once it's an array (or
  `kcHtml`, which is always an object), the fallback never shows. The orders were full of it: `opts?select:input`,
  `if(!charOpts)`, `if(mercRows)`. Test `html.length`, and return `''` from a helper
  that has nothing to show.
- **Fixed text with bold that a helper splits.** The player portal's `bulletizeDesc` splits a description into
  sentences, so its tables write bold as `**bold**`, not `<strong>`; it shows the text as text and turns each
  `**…**` into `<strong>`.
- **In `runTurn`, `msg` may be the watcher's banner.** In an automatic run, every message given to `msg.innerHTML` is
  also put inside the watcher's `kcHtml` banner, so each one is `kcHtml`, even a fixed one: a plain string shows its tags
  there as text.
- **No `kcEsc` (or an older escaper) inside `kcHtml`.** The value is escaped twice and `&` shows as `&amp;`.
- **`kcArg` keeps a value's type.** `onclick="f('${id}')"` passed a string; `onclick="f(${kcArg(id)})"` passes `id` as
  it is, so a numeric id now arrives as a number. Write `kcArg(String(id))` where the handler compares strings.
- **`kc-safe.ts`'s four helpers are bundled into each page** (since P1-09d), so a page and its helpers are always the
  same build; since P1-06b the bundle's name follows its content, so a page always gets its own bundle.
- **A test that runs a slice of a page in `vm`** (the Hall of Fame record tests do) must load `kc-safe.ts` into its
  context first if the slice calls the helpers (`scriptOf('ui/shared/kc-safe.ts')`, `tests/lib/source.ts`).
- **Show it looks the same.** Converting a page must not change it for ordinary names: run
  `node tests/tools/same-dom.js <main's site>` and put its output in the pull request.
- **An exception goes in `HTML_EXCEPTIONS` (`eslint.config.js`)** with a one-line reason, for Theo to review: the
  file, the check and a piece of the code it refuses. The rule is strict: no page may build HTML outside `kcHtml` /
  `kcEsc`, and an exception that matches nothing fails, so the list can't go stale. The ratchet counts the list
  (`allowlistEntries`), so it only shrinks.
- **A `?:` followed by `+` adds the tail to one branch only.** In `h.innerHTML=!ok?'Why not.':'Who reads it.'+' 12 left.'`
  the tail belongs to the second branch. Converting it to ``kcHtml`${!ok?…:…} 12 left.` `` adds it to both. Keep each branch
  whole: ``!ok?kcHtml`…`:kcHtml`… 12 left.` ``. `same-dom.js` finds it when a tour reaches both branches (it did, in the player
  portal's Dispatches).

## Order is data

- `KC_*` arrays are iterated for random picks, tie-breaks and dropdowns, and object keys are walked.
  Append; never re-sort.
- The few GM-portal tables marked `NOT a copy` are deliberate re-orderings (tie-break priorities). Don't
  collapse them into the shared table.
- Never reorder a character's `items` array. Send Item addresses items by index.

## Dice come from `kcRng()`

Every random number the GM portal's own code draws comes from `kcRng()` (`src/engine/rng.ts`, P1-07): one sfc32
generator per page, seeded once as the page loads, by the tests (`KC_RNG_SEED`, set by `tests/lib/boot.js`) or, on the
live site, from `crypto.getRandomValues`. Each turn rolls its own dice (P1-18e): the turn's shell draws a seed from
the page's dice and hands it to `resolveTurn`, which lends itself `kcRngStream(seed)` with `kcRng.use`, once for the
turn and once for the Spy-stealth step, giving the dice in use back after each (P1-08m). The reports (the views'
`buildReports`, since P1-12b3) are lent none: they draw none. Nothing in the engine or its views reads the time (P1-18d): only the
turn's shell does, through `kcClock()` (`src/engine/clock.ts`, which reads `Date.now()` when called), to stamp when
the turn ran. `engine-purity` plays a whole game in Node with a `Date` and a `Math.random` that throw.

- Don't write `Math.random` anywhere in `src/` (but `rng.ts`) or in `public/`'s scripts, or `Date` in `src/engine/`,
  `src/views/`, `src/content/`, `src/shared/` or `src/schemas/` (but `clock.ts`): lint refuses it, in your editor and
  in `npm run lint` (P1-13c; `window.Math.random` too). Pass the generator as `kcRng` (e.g.
  `shuffleP(list, kcRng)`); a date is `kcClock.date()`. The page's own screens (deadlines, "x minutes ago") still read
  `Date`.
- Adding, removing or moving one draw shifts every draw after it, so every balance game changes
  ([Order is data](#order-is-data)). A pure move keeps each draw where it was.
- A test fixes dice through the page's hook, never through the page's `Math.random`: nothing in `src/` reads it, so
  such a test would pin nothing and still pass. `const was=W.kcRng.use(()=>0.5); try{ … } finally{ W.kcRng.use(was); }`
  draws from your function for a while; `W.kcRng.seed(n)` starts again from seed `n`.
- **Pinning the page's dice doesn't pin a turn's** (P1-18e). `runTurn` takes one number from them for the turn's seed
  and plays the turn on dice of its own, so a test that pins the page's dice around `runTurn` fixes only that seed. A
  test whose outcome rests on the dice is restaged instead: stage the state so that no roll decides it
  (`mercenary-ids` hires both bands back rather than leaving one in the pool, where it may retire at the end of the
  turn). To run a turn on chosen dice, call `resolveTurn` in Node with no seed and `kcRng.use` around it
  (`turn-shell`'s same-result test), or hand it the seed (`the-turns-own-dice-from-its-seed`). Given a seed, a turn
  draws nothing from the dice in use: a test's fixed dice don't reach it.
- Never lend the dice across an `await`. Another turn (the watcher's, or the GM's button on another game) can run in
  the gap and would draw from them, and the page could be handed the wrong dice back. `resolveTurn` lends them twice,
  for itself and for the Spy-stealth step, two synchronous calls, and gives them back in a `finally`.
- Code a test cuts out of the page and runs on its own needs a `kcRng` or `kcClock` of its own (`home-placement`,
  `leaderboard-records`).
- Keep the generator in an object's property (`_kcRng.next`), not in a top-level `let`. With a `let`, V8 (Node 24.22)
  sometimes runs an optimised `kcRng` built against the old value: after `kcRng.seed` or `kcRng.use`, the dice quietly
  go back to the old stream. It showed in about 1 run in 20 of `rng`'s reseed test, and in 13 of 60,000 reseeds under
  stress; the property form showed none. P1-09 makes `rng` a module: keep the state in an object there too.

## `@ts-nocheck` checks nothing in the file

124 files of `src/` still start with a `// @ts-nocheck` line, counted by the ratchet in two: `tsNocheckEngineSide`
(90: `src/engine/`, `src/views/`, `src/db/`, `src/ui/shared/`, and `src/content/`, `src/schemas/` and `src/shared/`,
which have none), which P1-10b frees, and `tsNocheckUi` (34: the UI's pages in `src/ui/`, `src/rulebook/`, and any
other file, `tests/` and `tools/` too), which P1-16 frees. Each only falls, so freeing a file on one side can't make
room for a new line on the other. TypeScript reports no error anywhere in such a file. A type,
an annotation or a `satisfies` written there is a claim nobody checks: a wrong parameter type compiles, and so does a
table with a key left out.

- **A type is checked where a file without the line reads it.** `TurnContext` and `NarrativeLine`
  (`engine/turn/context.ts`) live in a file that keeps the line; each freed file that reads them checks them. If a
  freed file's code disagrees with one, correct the type, not the code (P1-10a3 did so for a log line's `targets`).
- **A file with the line still gives its callers types.** Its parameters are `any`, but a value it builds keeps the
  type TypeScript works out: `[]` is `never[]`, and `PC_RANGES[i]` is `string | undefined`. A freed caller meets them.
  Only a `?` on a parameter its callers leave out, or a return type written from what the function does
  (`activeItems(c): Item[]`), is added to such a file for a freed caller.
- **To free a file:** delete the line, type its parameters and its empty arrays and maps, and run
  `npm run typecheck`. Type a parameter from what its callers pass and as wide as the body's own guards (a body that
  writes `(force || []).filter((a) => a && …)` takes `readonly (Army | null | undefined)[] | null | undefined`), so
  each guard stays needed. An error that only a changed statement clears is cleared by one that **keeps every
  value** (P1-10b's Decision 2), never by a `!` or an `as` (lint refuses both in `src/`): a list's or a table's
  element read into a `const` before its check (`G.players[c.player].name` after a check doesn't narrow: only a plain
  variable as the key does); a guard (`if (!x) return;`) where the code has just made `x` sure; `?? <the value it
  had>` where the left side can't be `undefined`; a type predicate for `.filter(Boolean)`; `catch (e)` read through
  `e instanceof Error ? e.message : String(e)`; a typed `const` for a literal table read by any string (P1-10b1 did
  the last three kinds for the assertions `src/engine/rules-on-plain-values/` held). A change that could change a
  value the game can meet isn't a type fix: it is its own PR. The proof is both balance sets and every realm's report
  identical **and** `npm test` green, since the matrix doesn't reach every line (no matrix game holds a unit's legacy
  name, for one): a changed statement the matrix doesn't reach gets a unit case, red on a planted fault.
- **Don't write the line's text in a comment:** the ratchet and `tests/static/harness.test.ts` count it anywhere in
  a file of `src/`. Say "its ts-nocheck line" instead.
- **A freed file meets the type-aware lint rules** in the same PR ([below](#a-fixed-lint-finding-must-leave-the-suppressions)):
  fix every finding there, and suppress none (P1-10b's Choice 1), so `eslintSuppressions` doesn't rise. Each fix keeps
  every value too: a `||` that a `0`, `''` or `false` reaches becomes an explicit check, not `??`; a guard that a
  caller still keeping its line may need stays, its parameter typed optional; a `no-unsafe-*` finding from a callee
  that keeps its line is met by typing the value where the freed file takes it. A finding that can't be fixed without
  freeing another file waits for that file.
- **What it took, file by file** (P1-10b2: `army-tables.ts`, `units/movement.ts`, `battle/strength.ts`, 34,104
  bytes): the line off, strict TypeScript reported 103 errors; about 40 annotations and 9 statements cleared them, then
  the type-aware lint found 55 findings there, all fixed (mostly `?? []` for `|| []` on a list, and `a?.type === x`
  for `a && a.type === x`). Three forms keep a value where `??` wouldn't:
  - **`x || 0` on a number that is worked out** (a skill level, a strength taken off) becomes `Number(x) || 0`, not
    `x ?? 0`: the two differ when `x` is `NaN`, which `|| 0` turns into 0. `?? 0` is right where `x` can't be `NaN`
    (a number from the data file, a field compared at once in a way `NaN` and 0 both fail).
  - **`(a && (a.unitName || a.type)) || 'unit'`**, where `''` may reach, is read into a `const` first:
    `const nameOrType = a ? a.unitName || a.type : '';`, then `nameOrType || 'unit'`.
  - **A function that reads an old save** (`migrateLegacyUnitNames`) takes the old save's shape, declared beside it
    with every field it reads optional, so each of its guards stays needed; today's `GameState` passes.
  A guard lint calls needless is dropped only where the code would already have thrown without it (in
  `abilityMissileUnits`, `a && a.type` after a filter that reads `a.type` of every unit).
- (P1-10b3: `battle/fates.ts`, 14,606 bytes): 56 errors, 30 of them a parameter with no type; then 13 typed lint
  findings, all fixed. Three more forms:
  - **A value parsed from JSON** (`battleTallyLine` reads each force's row back from its line's words) is typed
    `unknown`, and each field is read through `fieldAsJavaScriptReadsIt(value, key)`, which does what `value[key]` does
    (undefined where there is none, a `TypeError` for `null`), so a row the engine never writes still gives the tally it
    gave. Checking each field's type instead would be shorter, but it changes what such a row gives.
    `tests/unit/the-battle-fate-and-tally-lines-no-matrix-game-reaches-keep-their-values.test.ts` holds those rows.
  - **A `let` set inside a `forEach` callback and read after it** (`let best = null`) is still `null` to the compiler,
    so a property read after it fails (TS2339 on `never`). A `for … of` loop over the same list, with `continue` for the
    callback's `return`, keeps the order and lets the compiler see the assignment.
  - **A callback option a winner never calls** (`demoteAt`) is required only where it is called: `rollUnitFates`'
    options are a union on `won`, `{ won: true }` or `{ won: false; demoteAt }`, so no caller passes a dummy and no
    `?.` hides a missing one.

## A battle-only mark is not part of the saved state

A battle writes marks on its units and its commanders that last for that battle only: on a unit, `_archeryRed` (what
the arrows took off), `_tempStrReduction` (what it lost before the clash), `_flakTargeted` (a flyer a gyrocopter
harried) and `_disbanded` (forced below Green); on a hero, `_tacticalMult` (Telekinetic Storm). The battle wipes them
at its end, before the state is saved. They are typed by `ArmyInABattle` and `HeroInABattle` (`engine/army-tables.ts`),
**not** in the saved state's schema (P1-10b2).

- **Why not in the schema:** on 2026-09-27 `_flakTargeted` was never wiped, so it was saved, and a flyer harried once
  was immune to Flak Screen for the rest of the game. The schemas' tests parse every state of a matrix game strictly
  (`tests/lib/strict-schema.ts`), so a mark left on a unit in a save fails them; an optional field in `ArmySchema`
  would let it through.
- **An `Army` passes where an `ArmyInABattle` is wanted** (each mark is optional), so a caller needn't change. A
  freed function that reads or writes a mark takes `ArmyInABattle` (or `HeroInABattle`), not `Army`.
- **A new battle-only mark** goes in the type, with a line saying what it is, and is wiped at every place the others
  are (the comment above `applyFlakScreen`, `engine/battle/strength.ts`, names them).

## A fixed lint finding must leave the suppressions

Since P1-13b every lint rule is an error. What the rules found when they came in (809 findings) is listed in
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

## A new army unit is a dozen tables

A unit type is keyed by its name in tables spread over three files, and nothing throws when one is
missed: a unit with no cost recruits for 2g, one with no speed never marches, one with no names is "the
Guard", one missing from a terrain block fights at ×1 there. When adding (or renaming) a unit, touch:

- `src/content/kingdoms-call-data.ts`: `PROVINCE_ARMIES_P` (append to the cell: order is data, a king's two
  starting companies are the first two non-garrison types of his home's cell), `ARMY_UNIT_NAMES` (40
  names), `KC_UNIT_CLASS` (cavalry / missile / lightFoot / flying …), `KC_UNIT_TYPE`, `KC_DRUID_LEVELS`,
  `KC_UNIT_BASE_STR`.
- GM portal: `ARMY_COST_MASTER`, `ARMY_SPEED_MASTER`, `UNIT_SHORT`, `ARMY_RACE_OF_TYPE` (keep
  `'Orc Garrison':'Orcish'};` as its last entry: a test slices the source up to it), `DISC_CLS_SETS`,
  `TERRAIN_MODS` (`engine/battle/terrain-and-unit-strength.ts`) and `armStr`'s magic items' `CAV_I` / `INF_I` / `ARCH_I` sets.
- Player portal: `UNIT_ABILITIES` and the race blurbs. Rulebook: the roster, home-roster, move-rate and
  kinds-of-unit tables and the light-foot list. The intro's list of kinds.

Add the unit to `tests/lib/roster-decided.js` first: `tests/roster.test.js` and `tests/roster-words.test.js`
then list every table and sentence that is still missing it. Running games' capitals pick a new unit up on their next
turn (`backfillHomeRosters`); other provinces keep the pool they were generated with.

**The compiler now catches part of it** (P1-10a2). The data file's unit type is `UnitType`, the keys of `KC_UNIT_TYPE`.
`KC_UNIT_BASE_STR` (every humanoid unit and elemental) and `ARMY_UNIT_NAMES` with `PRIMAL_UNIT_NAMES` (every unit type)
end in `satisfies`, so a unit in `KC_UNIT_TYPE` that is missing from one fails `npm run typecheck` (TS1360). A unit
that `PRIMAL_ARMY_DEFS_P`, `ARMY_UNIT_NAMES` or `KC_CARRIER_BERTHS` names but `KC_UNIT_TYPE` doesn't fails too
(TS2353). Add the unit to `KC_UNIT_TYPE` first, and the compiler names the data file's tables that still need it.
Since P1-10b2 the engine's `ARMY_COST_MASTER` and `ARMY_SPEED_MASTER` (`engine/army-tables.ts`) end in `satisfies
Record<HumanoidUnitType, number>` too: a humanoid unit missing from either fails (a primal unit's cost and speed come
from `PRIMAL_ARMY_DEFS_P`). The engine's other tables (`UNIT_SHORT`, `TERRAIN_MODS`, `ARMY_RACE_OF_TYPE`, …) are
still unchecked: their files keep `@ts-nocheck`, and a `satisfies` there checks nothing
([above](#ts-nocheck-checks-nothing-in-the-file)). Each gets its `satisfies` when its file loses `@ts-nocheck`
(P1-10b: none of those files passes with annotations alone, P1-10a3). The lists above are still the whole job.

**A Creature or Monster** is the same list with its own tables. Mark it `live` in `tests/lib/primal-decided.js`
first (`tests/primal-roster.test.js` and `tests/primal-words.test.js` then list what is missing), then:
`PRIMAL_ARMY_DEFS_P` (the one place a beast's cost, strength, move, sub-race and pre-battle strike are written:
the master tables and the player portal's speeds are built from it), `PRIMAL_UNIT_NAMES` (28 names),
`KC_UNIT_CLASS` (`creature` or `monster`, plus `aerial` for a flyer, `cavalry` for a horse, `primalSea` for a
swimmer, `carrier` for a ferry), `KC_UNIT_TYPE`, `KC_DRUID_LEVELS`; the GM portal's `UNIT_SHORT`, `TERRAIN_MODS` rows, and **both** copies of the wild pools
(`CREATURE_BY_TERRAIN` / `MONSTER_BY_TERRAIN` in world generation and `CBT` / `MBT` in the alignment-neighbour
pass: `tests/new-creatures.test.js` holds the Creature pair together); the player portal's `PRIMAL_SUBRACE_CLASS`
(the `Primal:<sub-race>` string a wild province carries) and its alignment texts; the rulebook's Druid ladder
and the Druidic or Evil section. Renaming one also needs `LEGACY_UNIT_RENAMES` and `LEGACY_RACE_RENAMES`
(`migrateLegacyUnitNames` runs at the top of every turn) and the discoveries whose `effect.types` name it.

## A sea unit must be a carrier or a primal sea beast

The engine's "crosses the sea under its own power" set (`SEA_TYPES`, and the bots' `BOT_SEA_ALL`) is built from
`KC_UNIT_CLASS.carrier` plus `KC_UNIT_CLASS.primalSea`, **not** from `KC_UNIT_CLASS.sea`, which several other
consumers read. A unit listed in `sea` alone is a land unit the moment it is at sea: it needs a berth, is
stranded by `settleStrandedAtSea` and blocks the column's move. Put a new swimmer in `primalSea` (it swims,
carries nothing, is raised only at sea and cannot march inland) or, if it ferries troops, in `carrier` (one
berth, or its `KC_CARRIER_BERTHS` entry); the first run of `tests/shark-waters.test.js` showed the shoal left behind as
a garrison for exactly this reason. World generation's prosperous-seas pool is `primalSea` less the Shark Shoals.

## A unit ability is written in four places

Every humanoid land unit has two abilities: a matchup and one more. Each lives in the engine, in the
player portal's blurb, in the rulebook's roster row, and in the battle report's `why` text, and the
engine itself keeps them in several places by kind:

- a matchup on the battle grid: `abilityFront` (front line) and `abilityBack` (the second line shooting),
  with the cases that need the whole line (side hits, Shieldwall, Sergeants, Marksmen, Terror From Above,
  Dive on the Bowmen, Flak Gunners, Battering Horns) inside `battleFaceSide`;
- who takes a flank or shoots: `battleGrid` (`abilityFlanksRough`, Eagle Riders on an open flank, Black Arrows
  in front) and `abilityMissileUnits`;
- the pre-battle volley: `missileDamageMult`, `abilityVolleys`, `missileTargetPool`, `archeryBlockedBy`;
- force-wide strength: `unitAbilityMult`; fates: `rollUnitFates` (Knightly Example) and `shieldFortHolds`;
- turn hooks inside `resolveTurn`: Prepared Ground's second volley, Raiders' Muster at turn's end.

`tests/abilities-words.test.js` holds the table of names and checks both books; the four race tests
(`tests/abilities-human.test.js` and its elven, dwarven and orcish siblings) check the numbers, and
`tests/abilities-turn.test.js` the turn hooks. Add a new ability to the words table first. In the player portal's
`UNIT_ABILITIES` a unit may appear **once**: an object literal keeps the last key, so a second entry silently
replaces the first (the words test checks).

The beasts' abilities (2026-10-13) live in the same places, with `tests/primal-abilities-words.test.js` for the
names and `tests/abilities-beasts.test.js` / `tests/abilities-beasts-turn.test.js` for the numbers, plus three
more homes: a beast's always-on multiplier in `unitAbilityMult` (Relentless Hunt, Shoal Swarm, …), its pre-battle
strike on its `spells` in `PRIMAL_ARMY_DEFS_P`, and the rout in the realm battle (the Manticores' pursuit and
Feeding Frenzy beside Run Them Down). The grid's flyer set is `KC_UNIT_CLASS.aerial` (riders and flying beasts);
the archers' first-target set is still `KC_UNIT_CLASS.flying` (riders only). A missile immunity is one line in
`applyMissileHit` **and** one in `missileCapReached`, or archers keep wasting shots on the immune unit.

## A beast joining a column checks its leader's Druid

Since 2026-10-12 (item 24) a realm's hero leads at most as many Creature and Monster units as his Druid level
(`beastCommandCount`, `beastsLed`, `beastCommandRoom`, module level beside `druIdPenaltyMult`). The rule is enforced
where a beast joins a column: Recruit Armies (overflow musters into the garrison), Pick Up Army, Leave/Transfer to a
hero and Wild Calling. A new path that puts a living beast into a hero's `armies` must ask `beastCommandRoom` first,
or the cap is quietly broken. The player portal's hero card counts with the same `countsAgainstBeastCommand`
(`engine/rules-on-plain-values/`, through `src/shared/`).
`tests/beast-command.test.js` holds the three orders.

## Terror is spent at battle start

`consumeTerror` runs at the start of every battle and deletes the province's `_terrorStacks`, `_terrorisedBy` and
the rest once it has demoralised the defenders. Anything that must know whether a province is "under Terror"
for that battle (Reign of Fear reads it through `reignOfFearHere`) reads it **before** the call, in both battle
paths, and hands the answer on through the strength context (`ctx.reignOfFear`). Read it after and it is always
false. (Reign of Fear fires only for the attacker since 2026-10-12, so the defender's answer is always false.)

## An alignment order is written in a dozen places

Call from the Pit (2026-10-13; removed with Awaken the Wild on 2026-10-12, item 22) touched: the engine's `case` in the order switch, the order-name map
(`'call from the pit':'call_pit'`), `ALIGNMENT_ORDER_KEYS` (the Charmed-hero gate), the short label map, the
bots' `botSignaturePre` case and their two lists of muster-like orders; the player portal's `ACTIONS`,
`ALIGN_ACTIONS`, `ACTION_DISPLAY_ORDER`, the target widget `case`, the army projection and the gold ledger; the
rulebook's orders table and alignment section, the intro's table and the player portal's three alignment
texts. Nothing
throws when one is missed: the order is simply refused, hidden or priced wrong. Copy Harvest the Field's
occurrences (grep `harvest_field` and `Harvest the Field`) and mirror each. Removing one touches the same places;
keep its `case` as a plain refusal, so an order a save still holds is answered rather than silently dropped.

## A fate line names two companies

Since 2026-10-12 a casualty line names the enemy company too: "— Aldric's Levies (Shieldwall Levies, Average),
facing the Red Hand (Gorbash's Gnomish Gyrocopters), were annihilated in the rout!". Two readers depend on the
company's own reference coming **first**:

- the losses tally (`battleTallyLine`) reads the owner and the unit type from the first match in the line, so a
  new fate line must open with the company's own reference (`unitRef`) and put the clause after it;
- the clause comes from `battleFacedClauses`, read from the deploy's grids right after `battleDeploy`. Anything
  that faces the rows again later (the stay-or-retreat estimate does) overwrites the rows' `_faced` stamps, so
  read the map once, early, and pass it to `rollUnitFates` as `faced`.

`tests/battle-faced-lines.test.js` holds the wording of every branch and the tally's crediting.

## Other realms' slots come only from `get_game_slots`

The player portal reads its **own** `game_players` row directly, and every other realm's slot only through
`fetchGameSlots` (`rpc('get_game_slots')`, P0-20): number, bot or not, orders in or not, alignment while in
setup. From P0-21 the database answers a direct read of another realm's row with nothing, so a new feature that
reads other slots directly would quietly see only its own. If it needs more than `get_game_slots` gives, that's
a database change first. `tests/other-realms-slots.test.js` switches P0-21's rule on in the stand-in database
(`RULES.ownSlotsOnly`) and fails on any read that asks for another realm's row.

## Another game reads as nothing

From P2-16 (ruling D-10), an account reads a running or finished game, and its turn logs, only if it runs the game
or holds a realm in it; the Overlord reads every game. A game in setup is read by any signed-in account if it's
public, or by the accounts it invites if it's private. Asking for any other game gives no row and no error, so a new
feature that reads another game directly would quietly find nothing. `tests/games-for-their-players.test.js`
switches the rule on in the stand-in database (`RULES.ownGamesOnly`) and fails on any read that asks for another
game or its logs.

The same goes for **access rules that look at `games`**: a rule's subquery on another table runs under the caller's
own read rules on that table. "Is there no such game?" asked that way is also true of a game the caller can't read.
Ask a `security definer` function instead, as the Hall of Fame record rules ask `game_exists`.

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

## Retired discovery ids are never reused

`RETIRED_DISCOVERY_IDS` lists Sage discoveries that have been removed. `retireDiscoveries(G)` strips them
from live saves at the start of every turn. Reusing an id would hand the new power to every realm whose
save still carries the old one. Add to that set; never remove from it. Removing a discovery touches
three places: its row in the data file, its effect in the GM portal (check every branch), and anything
the player portal shows for it.

## Live saves keep copies

A running game's saved world holds its own copies of content: awarded items, the guardians in
uncleared lairs, held Sage discoveries, unit names. The engine reads those copies, so changing a table
in `kingdoms-call-data.ts` changes new games only, unless a migration carries the change into running
games.

- **Migrations run at the start of every turn**, on the world `resolveTurn` has just read:
  `migrateMaxHpV2` (which calls `migrateLairGuardiansV2`), `backfillHomeRosters`, `retireCorsairPools`, `retireDiscoveries`
  and `migrateLegacyUnitNames`, then `migrateItemTiers` and `ensureAllLairHoards` before the phases
  resolve. `migrateHoardTally` runs wherever the find tally is read or written. A running game picks
  up a change at its next turn.
- **Every migration runs on every turn**, not once, so it must be safe to repeat (idempotent).
- **Guardians:** `migrateLairGuardiansV2` re-stats uncleared lairs from `MONSTERS_P`, by name, only
  when `GUARDIAN_TABLE_VER` is higher than the save's `_guardiansVer`. When you change a guardian's
  stats, bump `GUARDIAN_TABLE_VER`, or running games keep the old guardian. The re-stat also heals a
  wounded guardian to its new full HP.
- **Items:** `migrateItemTiers` re-stamps only an item's tier. An item's effect stays as it was when
  awarded, so changing an effect doesn't reach items players already hold. Whether it should is a
  design decision for Toby: raise it as a ruling, don't decide it in code.

## A migration waiting for approval holds every deploy

A merge that adds a migration stops at `migrate-production` until Toby approves it, and the site deploys
only after that ([supabase/README.md](../supabase/README.md#how-a-migration-goes-live)). Deploys run one at a
time, so **every later merge waits behind it**, site-only fixes included, and ships with it once approved.
- Merge a migration when Toby can approve it soon, not ahead of an urgent site fix.
- If he rejects it, the run fails and nothing deploys; the next push to `main` asks again, because the
  migration is still new compared with the live site. So follow a rejection quickly with a pull request
  whose migration undoes it: production then gets both in order and ends up unchanged
  ([supabase/README.md](../supabase/README.md#how-a-migration-goes-live)). (Deleting the rejected migration's
  file also works, and CI allows it with a warning; staging is rebuilt for each pull request anyway.)
- Approval requests expire after 30 days.

## A new table is open to signed-out visitors until its migration says otherwise

Supabase gives every new table, sequence and function in `public` to every API role, signed-out visitors
(`anon`) included, with every privilege (`truncate` too, which ignores the access rules). A `grant` line in a
schema file doesn't take those away: the file must say `REVOKE ALL … FROM "anon"` and `… FROM
"authenticated"` first, then grant what the site uses
([supabase/README.md](../supabase/README.md#changing-the-structure)). Without the revokes, the generator
doesn't just leave a new table open: it **gives back** what an earlier migration took away, the next time
anyone generates a migration (it nearly happened in P0-29). `supabase/tests/database/00_privileges.test.sql`
checks every table, sequence and function, so either mistake turns the `db` check red.

## A stacked pull request merges into its base branch, not `main`

A site pull request stacked on its database pull request ([staging.md](staging.md#a-change-that-needs-both))
targets the database change's branch. GitHub moves it onto `main` only when that branch is **deleted**
after its merge. If the branch stays, merging the stacked pull request puts it on the leftover branch: GitHub
says "Merged", nothing deploys (P0-20's site half and P0-21 did this, and were opened again as #56 and #57).
The `merges-into-main` check (`.github/workflows/merges-into-main.yml`) is red on any pull request whose base
isn't `main`; don't merge one while it's red. When you open a stacked pull request, say in its first line
which pull request must be merged first.
