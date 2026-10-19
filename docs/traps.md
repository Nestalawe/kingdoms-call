# Traps

Standing gotchas: mistakes that have already happened, or nearly happened, in this code. Each one says
how to avoid it. Read this before changing the portals or the tests. When a new trap costs you time,
add it here in the same PR.

## Edit `src/`, never `site/`

Since P1-05, `site/` is build output ([ARCHITECTURE.md](ARCHITECTURE.md#the-build-src-becomes-site)): git-ignored, and
rewritten from `src/` by every test run. An edit there is never committed, and the next build quietly undoes it.

- Change the file in `src/`; `src/manifest.ts` says which file makes which part of a page.
- A new file must go into its list in the manifest, at the place its code should run. The build stops otherwise.
- `node tests/<name>.test.js` and a page opened in a browser read `site/` as last built: run `npm run build` first.

## Top-level declaration order (the `ITEMS_BY_TIER` class)

Every page's scripts are classic scripts sharing one global scope. That includes the files a page is built from:
`src/manifest.ts` lists them in the order the code runs, so moving a file in a list, or code from one file to another,
can move a declaration after its first use. A top-level `const`/`let` used before
its line has run throws a temporal-dead-zone `ReferenceError`. At top level, that stops the page: the
portal hangs on its spinner (the boot-failure reporter now shows the error).

- `ITEMS_BY_TIER` and `rollMagicItem` (GM portal) must come after `ALL_MAGIC_ITEMS_P` (data file). This
  holds because the data file loads first. Keep it that way.
- Code that runs at top level calls only top-level helpers. A lifted engine helper may need the turn's context
  (`effStat(turnContext, c, stat)`; use `effSkillOf` outside a turn), and one handed to another as a value is wrapped
  with it (`(...a)=>f(turnContext,...a)`, as the bots' duel forecast is). Declare shared helpers as hoisted
  `function`s.
- Prefer building lookup tables lazily inside the function that needs them over a top-level IIFE.
- A flag read by layout code that can run early (e.g. a hash-restored view) must be declared above
  that code, not in its feature's block further down.
- Never declare the same top-level name in the data file and a portal: that's a `SyntaxError` and the
  page doesn't load at all. New shared names start `KC_`.
- Never move a table that references portal code into the data file.

`npm test`'s `boot-pages` (jsdom) and the browser spec `chromium-boot` (`npx playwright test`) catch a page that no
longer boots.

## The data-file stamp guard

Both portals refuse to start on a data file older than the one they were cut against.

- **When `kingdoms-call-data.js` changes:** bump `KC_DATA_STAMP`, the `// Data file v…` comment above
  it, `KC_DATA_MIN` (GM portal) and `KC_DATA_MIN_P` (player portal), in the same PR.
- **When you add a shared table:** add its name to `KC_SHARED_TABLE_NAMES` (GM portal) and to the
  player portal's inline list, or a stale file passes the guard and fails later with a bare
  `ReferenceError`.
- **The two stamp lines do different jobs.** The guard reads `KC_DATA_STAMP`. The GM tab's auto-reload
  before a due turn (`refreshIfNewerBuild`) reads the `// Data file v…` comment. If only one is bumped,
  one of the two silently misses the change. `npm test`'s `stamps` check fails if they differ.
- A portal-only change leaves `KC_DATA_MIN` alone.

## The GM portal's two build stamps

The GM portal carries its build stamp twice, and each copy has a different reader:
- the footer (`GM Portal v…`, in `#kc-build-stamp`): the GM tab's auto-reload before a due turn
  (`refreshIfNewerBuild`) compares the running footer with the first `GM Portal v…` in the freshly
  fetched page;
- `KC_BUILD_STAMP`: written into telemetry rows, the training export and Hall-of-Fame records.

Bump both together. If only `KC_BUILD_STAMP` changes, a pinned GM tab doesn't reload onto the new
engine. If only the footer changes, statistics are filed under the previous build. That has happened
once: in Sept 2026 a whole build's telemetry claimed to be the build before it. Don't write
`GM Portal v` followed by a stamp anywhere above the footer, or the auto-reload reads that instead.
`npm test`'s `stamps` check fails on either mistake.

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
`kcDbGuard(sb, KC_DB_MIN)` (`src/db/kc-db-guard.js`, P0-34). Before the first read, it asks the database for
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
- The GM tab's reload before a due turn (`refreshIfNewerBuild`) boots the page again, so the check runs
  again before any turn.
- Tests: every stand-in database answers with the newest migration (`DB_VERSION` in `tests/lib/boot.js`).
  `bootJsdom(..., {dbVersion})` sets another answer (an older version, `null` for a missing function, or
  `'offline'`), as `tests/db-guard.test.js` does.

## String-anchor harness hooks

Until the engine is split into modules (Phase 1), several tests reach inside the GM portal by matching
**exact source lines** of the built page and injecting code there. Each line lives in one file under `src/`
(mostly `src/engine/run-turn.js`). For example, `  // 4. Run all 5 phases` exposes the
functions nested in `resolveTurn`. The full list is in
[tests/README.md](../tests/README.md#code-anchor-hooks).

- Editing, re-indenting or moving one of those lines breaks the tests that use it. They fail with
  "anchor" or "missing" in the message. That means the hook needs updating, not that the game is
  broken.
- Update the anchor in the test in the same PR, and say so in the PR. Don't weaken what the test
  checks.
- If you add a test that needs a new anchor, add it to that table.

## A lifted helper takes the turn's context first

Since P1-08a, a helper lifted out of `resolveTurn` that reads the turn's state takes `turnContext` as its first argument
(`src/engine/turn/context.js`; [ARCHITECTURE.md](ARCHITECTURE.md#the-turn-engine-gm-portal)).

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
  given wraps it the same way: `lib/boot.js`' `reportEveryRealm` wraps `buildReports` (P1-08d), and `pursuit-one-battle` wraps
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
  `engine/turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.js`) is a function of its statements,
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
  `unit/order-dispatch-called-directly` and `unit/phase-stages-called-directly` do, but not a top-level `const`
  arrow (`defendSpentThisPhase`, `noteEntered`): a `const` isn't a property of the `vm`'s global object, so the
  engine keeps calling the original. Stage the state it reads instead. The same goes for reading one: a table declared
  with `const` (`TITLE_DEFS`, `MINOR_TITLES`, `SEA_TYPES`, `SKILL_LABELS`) is read in the `vm` with
  `vm.runInContext('JSON.stringify(TITLE_DEFS)', engine)`, not `engine['TITLE_DEFS']` (undefined).
- Reading a context value before `resolveTurn` has set it gives `undefined`; reading the old `let` before its line
  threw. P1-08a checked that nothing reads one early (a throwaway tripwire through a whole test run and the matrix), and
  P1-08b again for the objects that join partway through the turn (the movement pools, `SEASONS`,
  `recruitedThisTurn`, `_intrusionAcc`): before its join line, the old name threw; the context's reads `undefined`.
  P1-08c checked again for the six values above and `_elvenEscapeQueue`, P1-08d for `presenceByPhase`, `clairWatch` and
  `_reports`, P1-08e for `_botPlayerIdx`, P1-08i1 for `enteredThisPhase` and `_distCache`, P1-08i3 for `_tier0Open`, `_unitGainQueue`, `_warFrontAtStart` and `_warFrontProvs`. P1-08k4 and P1-08k7 for the merge's six collectors. P1-08k8 added no join and no `let` (the values it makes were joined before; their join lines moved with them), so it didn't rerun it. P1-08l1 reran it for `_botEncounteredAtStart`; P1-08l2 added none (the merge's six collectors moved into the merge with their join lines, still joined before anything reads them), so it didn't. `turnContext()` in `tests/lib/engine.ts` sets each of them, as `resolveTurn`
  does: a test of a lifted helper that reads one it doesn't set gets `undefined`, not the turn's value.

## Top-level names aren't on `window` in tests

A top-level `const`/`let` (and most of the engine) is in the page's global lexical scope, not a property
of `window`. In jsdom, `window.SAGE_DISCOVERIES_P` is `undefined`, and `undefined || []` then passes
every "X is absent" check **by accident**.

- Read them with `window.eval('NAME')` (or `vm.runInContext`).
- Assert that the table was actually read, i.e. is non-empty, before asserting anything about its
  contents.
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

The one `try` in `runTurn`, the turn's shell (`src/ui/gm/turn-shell.js`), runs from the load through `resolveTurn`
to the conditional save and on to the reports. Everything after the save (reports, `turn_logs`, telemetry) runs
after the turn is already resolved and stored. A throw there must not restore orders, re-flag `orders_submitted`,
or let the watcher retry the turn: that combination once made live games resolve themselves once a minute.

- `_turnCommitted` marks that the save succeeded. Any code added after the save must respect it.
- **The reports are built after the save, never inside `resolveTurn`** (P1-18d). `resolveTurn` returns
  `buildReports`, and the shell calls it only once `_turnCommitted` is set. A report built before the save would
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
tables now have one source, but rules are still restated:
- in the player portal's projections (forecasts, order validation, hints);
- at order time and again at resolution time in the engine;
- in the turn-report forecast versus the end-of-turn collector;
- in narrative strings, both rulebooks, join-screen blurbs and tooltips.

Before changing a rule, grep the engine and both portals for its nouns **and its numbers**, and change
every place in the same commit. When a number moves, grep the old number in narrative strings and the
rulebooks.

## HTML is built only through `kcHtml`

Every name, message and record on screen was typed by someone, so it goes into a page as text (P0-19,
[ARCHITECTURE.md](ARCHITECTURE.md#how-a-page-builds-html)). `npm test`'s `html-lint` catches most mistakes; these
ones it can't, or they cost time:

- **Markup in a value is shown as text.** In ``kcHtml`<td>${won?'<span class="pill">won</span>':''}</td>` `` the pill
  comes out as `<span…` on screen. Make the markup `kcHtml` too: ``${won?kcHtml`<span class="pill">won</span>`:''}``.
  The same goes for a helper that returns a plain string of markup, for a table of fixed text with markup in it (the
  player portal's `SKILL_INFO`: write those entries as ``kcHtml`…` ``), and for an entity written in data (`'Hosts &amp;
  armies'` now shows `&amp;`: write `&`). An attribute put in as a value breaks the same way: in
  ``kcHtml`<div${dim?' style="opacity:.8"':''}>` `` the quotes are escaped, so write ``${dim?kcHtml` style="opacity:.8"`:''}``.
  `html-lint` can't see either mistake; `same-dom.js` (below) finds it on the screens a tour visits.
- **Never join `kcHtml` with `+`, `+=` or `.join('')`.** Each makes a plain string, which the next `kcHtml` escapes,
  so the markup shows as text. Collect pieces in an array and put the array in: ``kcHtml`<ul>${rows}</ul>` ``.
  `html-lint` sees this only when `kcHtml` is written in the line: `row(a)+row(b)`, where `row` returns `kcHtml`, and
  `.join(', ')` on a list of `kcHtml` pass it, and so do `.map(…).filter(Boolean).join('')`, `.flatMap(…).join('')`
  and `Array.from(…).join('')`. In the player portal, a list with a separator goes in as `kcJoinP(list, ', ')` (the
  separator is text; write ``kcHtml`<br>` `` for markup).
- **A template with no markup of its own still needs `kcHtml` if a value in it is `kcHtml`.** In
  ``chanceLine(`Success: ${pct(n)}`)``, where `pct` returns `<strong>`, the untagged template makes a plain string and
  the bold shows as text. Tag it: ``chanceLine(kcHtml`Success: ${pct(n)}`)``. `html-lint` only looks at templates
  with markup in them.
- **A helper whose result goes straight into `innerHTML` returns `kcHtml` on every path**, even a line with no
  markup: `el.innerHTML=note(c)` reads a plain string as HTML, names and all. The orders' `exploreProjectionNote` is
  one; `html-lint` sees the sink, not what the helper returns.
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
- **`kc-safe.js` doesn't change.** Its four helpers are fixed: for a few minutes after a deploy, a browser can pair a
  new page with its cached copy of the old file. If it must change, put `?v=<stamp>` on every page's `<script src>`.
- **A test that runs a slice of a page in `vm`** (the Hall of Fame record tests do) must load `site/kc-safe.js` into
  its context first if the slice calls the helpers.
- **Show it looks the same.** Converting a page must not change it for ordinary names: run
  `node tests/tools/same-dom.js <main's site>` and put its output in the pull request.
- **An exception goes in `html-lint`'s `ALLOWED`** with a one-line reason, for Theo to review. The check is strict: no
  page may build HTML outside `kcHtml` / `kcEsc`.
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

Every random number the GM portal's own code draws comes from `kcRng()` (`src/engine/rng.js`, P1-07): one sfc32
generator per page, seeded once as the page loads, by the tests (`KC_RNG_SEED`, set by `tests/lib/boot.js`) or, on the
live site, from `crypto.getRandomValues`. Each turn rolls its own dice (P1-18e): the turn's shell draws a seed from
the page's dice and lends the turn `kcRngStream(seed)` with `kcRng.use`, once for `resolveTurn` and once for
`buildReports()`, giving the page its dice back after each. Nothing in the engine or its views reads the time (P1-18d): only the
turn's shell does, through `kcClock()` (`src/engine/clock.js`, which reads `Date.now()` when called), to stamp when
the turn ran. `engine-purity` plays a whole game in Node with a `Date` and a `Math.random` that throw.

- Don't write `Math.random` anywhere in `src/` (but `rng.js` and `vendor/`), or `Date` in `src/engine/` or
  `src/views/` (but `clock.js`): `npm test`'s `dice-and-clock` fails. Pass the generator as `kcRng` (e.g.
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
  turn). To run a turn on chosen dice, call `resolveTurn` in Node with `kcRng.use` around it (`turn-shell`'s
  same-result test).
- Never lend the dice across an `await`. Another turn (the watcher's, or the GM's button on another game) can run in
  the gap and would draw from them, and the page could be handed the wrong dice back. The shell borrows them twice,
  around two synchronous calls.
- Code a test cuts out of the page and runs on its own needs a `kcRng` or `kcClock` of its own (`home-placement`,
  `leaderboard-records`).
- Keep the generator in an object's property (`_kcRng.next`), not in a top-level `let`. With a `let`, V8 (Node 24.22)
  sometimes runs an optimised `kcRng` built against the old value: after `kcRng.seed` or `kcRng.use`, the dice quietly
  go back to the old stream. It showed in about 1 run in 20 of `rng`'s reseed test, and in 13 of 60,000 reseeds under
  stress; the property form showed none. P1-09 makes `rng` a module: keep the state in an object there too.

## A new army unit is a dozen tables

A unit type is keyed by its name in tables spread over three files, and nothing throws when one is
missed: a unit with no cost recruits for 2g, one with no speed never marches, one with no names is "the
Guard", one missing from a terrain block fights at ×1 there. When adding (or renaming) a unit, touch:

- `src/content/kingdoms-call-data.js`: `PROVINCE_ARMIES_P` (append to the cell: order is data, a king's two
  starting companies are the first two non-garrison types of his home's cell), `ARMY_UNIT_NAMES` (40
  names), `KC_UNIT_CLASS` (cavalry / missile / lightFoot / flying …), `KC_UNIT_TYPE`, `KC_DRUID_LEVELS`,
  `KC_UNIT_BASE_STR`.
- GM portal: `ARMY_COST_MASTER`, `ARMY_SPEED_MASTER`, `UNIT_SHORT`, `ARMY_RACE_OF_TYPE` (keep
  `'Orc Garrison':'Orcish'};` as its last entry: a test slices the source up to it), `DISC_CLS_SETS`,
  `TERRAIN_MODS` (`engine/battle/terrain-and-unit-strength.js`) and `armStr`'s magic items' `CAV_I` / `INF_I` / `ARCH_I` sets.
- Player portal: `UNIT_ABILITIES` and the race blurbs. Rulebook: the roster, home-roster, move-rate and
  kinds-of-unit tables and the light-foot list. The intro's list of kinds.

Add the unit to `tests/lib/roster-decided.js` first: `tests/roster.test.js` and `tests/roster-words.test.js`
then list every table and sentence that is still missing it. Running games' capitals pick a new unit up on their next
turn (`backfillHomeRosters`); other provinces keep the pool they were generated with.

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
or the cap is quietly broken. The player portal's `beastCommandCountP` mirrors what counts.
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
texts; and, for a new shared table, `KC_SHARED_TABLE_NAMES` and the player portal's `need` list. Nothing
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
- `npm test`'s `sort-comparators` check fails on a random or argument-less comparator.

## Retired discovery ids are never reused

`RETIRED_DISCOVERY_IDS` lists Sage discoveries that have been removed. `retireDiscoveries(G)` strips them
from live saves at the start of every turn. Reusing an id would hand the new power to every realm whose
save still carries the old one. Add to that set; never remove from it. Removing a discovery touches
three places: its row in the data file, its effect in the GM portal (check every branch), and anything
the player portal shows for it.

## Live saves keep copies

A running game's saved world holds its own copies of content: awarded items, the guardians in
uncleared lairs, held Sage discoveries, unit names. The engine reads those copies, so changing a table
in `kingdoms-call-data.js` changes new games only, unless a migration carries the change into running
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
