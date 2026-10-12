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
`kcDbGuard(sb, KC_DB_MIN)` (`site/kc-db-guard.js`, P0-34). Before the first read, it asks the database for
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

## A new army unit is a dozen tables

A unit type is keyed by its name in tables spread over three files, and nothing throws when one is
missed: a unit with no cost recruits for 2g, one with no speed never marches, one with no names is "the
Guard", one missing from a terrain block fights at ×1 there. When adding (or renaming) a unit, touch:

- `site/kingdoms-call-data.js`: `PROVINCE_ARMIES_P` (append to the cell: order is data, a king's two
  starting companies are the first two non-garrison types of his home's cell), `ARMY_UNIT_NAMES` (40
  names), `KC_UNIT_CLASS` (cavalry / missile / lightFoot / flying …), `KC_UNIT_TYPE`, `KC_DRUID_LEVELS`,
  `KC_UNIT_BASE_STR`.
- GM portal: `ARMY_COST_MASTER`, `ARMY_SPEED_MASTER`, `UNIT_SHORT`, `ARMY_RACE_OF_TYPE` (keep
  `'Orc Garrison':'Orcish'};` as its last entry: a test slices the source up to it), `DISC_CLS_SETS`,
  `TERRAIN_MODS` (inside `runTurn`) and the magic items' `CAV_I` / `INF_I` / `ARCH_I` sets.
- Player portal: `UNIT_ABILITIES` and the race blurbs. Rulebook: the roster, home-roster, move-rate and
  kinds-of-unit tables and the light-foot list. The intro's list of kinds.

Add the unit to `tests/lib/roster-decided.js` first: `tests/roster.test.js` and `tests/roster-words.test.js`
then list every table and sentence that is still missing it. Running games' capitals pick a new unit up on their next
turn (`backfillHomeRosters`); other provinces keep the pool they were generated with.

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
- turn hooks inside `runTurn`: Prepared Ground's second volley, Raiders' Muster at turn's end.

`tests/abilities-words.test.js` holds the table of names and checks both books; the four race tests
(`tests/abilities-human.test.js` and its elven, dwarven and orcish siblings) check the numbers, and
`tests/abilities-turn.test.js` the turn hooks. Add a new ability to the words table first. In the player portal's
`UNIT_ABILITIES` a unit may appear **once**: an object literal keeps the last key, so a second entry silently
replaces the first (the words test checks).

## Terror is spent at battle start

`consumeTerror` runs at the start of every battle and deletes the province's `_terrorStacks`, `_terrorisedBy` and
the rest once it has demoralised the defenders. Anything that must know whether a province is "under Terror"
for that battle (Reign of Fear reads it through `reignOfFearHere`) reads it **before** the call, in both battle
paths, and hands the answer on through the strength context (`ctx.reignOfFear`). Read it after and it is always
false. The order code (Call from the Pit) reads the stamps directly: no battle has run in that phase yet.

## An alignment order is written in a dozen places

Call from the Pit (2026-10-13) touched: the engine's `case` in the order switch, the order-name map
(`'call from the pit':'call_pit'`), `ALIGNMENT_ORDER_KEYS` (the Charmed-hero gate), the short label map, the
bots' `botSignaturePre` case and their two lists of muster-like orders; the player portal's `ACTIONS`,
`ALIGN_ACTIONS`, `ACTION_DISPLAY_ORDER`, the target widget `case`, the army projection and the gold ledger; the
rulebook's orders table and alignment section, the intro's table and the player portal's three alignment
texts; and, for a new shared table, `KC_SHARED_TABLE_NAMES` and the player portal's `need` list. Nothing
throws when one is missed: the order is simply refused, hidden or priced wrong. Copy Awaken the Wild's
occurrences (grep `awaken_wild` and `Awaken the Wild`) and mirror each.

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
