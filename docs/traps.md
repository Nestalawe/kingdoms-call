# Traps

Standing gotchas: mistakes that have already happened, or nearly happened, in this code. Each one says
how to avoid it. Read this before changing the portals or the tests. When a new trap costs you time,
add it here in the same PR.

## Top-level declaration order (the `ITEMS_BY_TIER` class)

Every page's scripts are classic scripts sharing one global scope. A top-level `const`/`let` used before
its line has run throws a temporal-dead-zone `ReferenceError`. At top level, that stops the page: the
portal hangs on its spinner (the boot-failure reporter now shows the error).

- `ITEMS_BY_TIER` and `rollMagicItem` (GM portal) must come after `ALL_MAGIC_ITEMS_P` (data file). This
  holds because the data file loads first. Keep it that way.
- Code that runs at top level calls only top-level helpers. Many engine helpers are local to `runTurn`
  (e.g. `effStat`; use `effSkillOf` outside it). Declare shared helpers as hoisted `function`s.
- Prefer building lookup tables lazily inside the function that needs them over a top-level IIFE.
- A flag read by layout code that can run early (e.g. a hash-restored view) must be declared above
  that code, not in its feature's block further down.
- Never declare the same top-level name in the data file and a portal: that's a `SyntaxError` and the
  page doesn't load at all. New shared names start `KC_`.
- Never move a table that references portal code into the data file.

`npm test`'s `boot-pages` and `chromium-boot` catch a page that no longer boots.

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
- The leaderboard reads `game_records` with `*` (~16 KB a row). Fine for now; if it gets slow, give
  the list tabs a lighter select.

## A new column must be optional at the write site

Schema changes are applied by hand, so for a while the code runs against a database without the new
column. Writing an unknown column fails the whole save, which in `runTurn` is a failed turn. Probe once
(as `probeGameMeta` does), and spread `{}` instead of the field while it's absent (`metaPatch`). Readers
prefer the new column and fall back to the old source.

## String-anchor harness hooks

Until the engine is split into modules (Phase 1), several tests reach inside the GM portal by matching
**exact source lines** and injecting code there. For example, `  // 4. Run all 5 phases` exposes the
functions nested in `runTurn`. The full list is in
[tests/README.md](../tests/README.md#code-anchor-hooks).

- Editing, re-indenting or moving one of those lines breaks the tests that use it. They fail with
  "anchor" or "missing" in the message. That means the hook needs updating, not that the game is
  broken.
- Update the anchor in the test in the same PR, and say so in the PR. Don't weaken what the test
  checks.
- If you add a test that needs a new anchor, add it to that table.

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

The `try` in `runTurn` spans the conditional save. Everything after the save (reports, `turn_logs`,
telemetry) runs after the turn is already resolved and stored. A throw there must not restore orders,
re-flag `orders_submitted`, or let the watcher retry the turn: that combination once made live games
resolve themselves once a minute.

- `_turnCommitted` marks that the save succeeded. Any code added after the save must respect it.
- `runTurn` **returns** `{ok, committed, conflict, error}`; it doesn't throw. Callers must check the
  return value. A `try/catch` around the call almost never fires.
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

## Order is data

- `KC_*` arrays are iterated for random picks, tie-breaks and dropdowns, and object keys are walked.
  Append; never re-sort.
- The few GM-portal tables marked `NOT a copy` are deliberate re-orderings (tie-break priorities). Don't
  collapse them into the shared table.
- Never reorder a character's `items` array. Send Item addresses items by index.

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

- **Migrations run at the start of every turn**, on the world `runTurn` has just loaded:
  `migrateMaxHpV2` (which calls `migrateLairGuardiansV2`), `backfillHomeRosters`, `retireDiscoveries`
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
