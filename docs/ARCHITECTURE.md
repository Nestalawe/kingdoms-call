# Architecture

How Kingdoms Call works today, at the cutover build (GM portal `2026.09.30-0038`, data file
`2026.09.29-2329`). Short on purpose: read this, then [traps.md](traps.md), then only the code you need.
Line numbers drift; search for the names given here.

## The shape in one paragraph

A static site with no build step and no server of its own. Every page is one HTML file with its
JavaScript inline. The pages talk straight to a Supabase Postgres database from the browser, using
supabase-js and the project's public (anon) key. **The turn engine runs in the GM's browser tab**: the
GM portal generates worlds, runs the bots, resolves turns and writes each realm's report. Players only
submit orders and read what they're given.

## The pages (`site/`)

| File | Size | What it is |
|---|---|---|
| `index.html` | small | Landing page; links the player portal and both rulebooks |
| `kingdoms-call-gm-portal.html` | ~27,600 lines, ~2.1 MB | GM UI, world generation, the whole turn engine (`runTurn`), bot AI, turn reports, telemetry, Stats tab, Hall-of-Fame builder, database set-up banners |
| `kingdoms-call-player-portal.html` | ~10,300 lines, ~760 KB | Sign-in, My Games, order entry, the turn report and Chronicle, the map, Dispatches (player messaging). Holds client-side projections that mirror engine rules (see [traps.md](traps.md#a-rule-written-twice-must-change-twice)) |
| `kingdoms-call-data.js` | ~410 KB | Content tables (items, monsters, lairs, discoveries, hero names, …) and the **shared rule tables** both portals read |
| `kingdoms-call-leaderboard.html` | ~780 lines | Hall of Fame: leaderboard and achievement records over finished games |
| `kingdoms-call-rules.html`, `kingdoms-call-rules-intro.html` | | The comprehensive and introductory rulebooks (prose) |

All pages sit in one folder and link each other relatively. Only `site/` is published, so URLs are the
same as before the cutover.

## How a portal boots

Order inside each portal's `<head>` and body, and why it matters:

1. **Boot-failure reporter**: a small inline script, first in `<head>`. While the loading spinner is
   still showing, the first `error` or `unhandledrejection` replaces it with the message, a hint and a
   Reload button. Without it, any top-level throw looks like "Loading…" for ever.
2. **supabase-js v2** from a CDN, with a second CDN as a fallback (`document.write`, so load order is
   kept).
3. **`kc-config.js`**: `KC_CONFIG`, which database this copy of the site talks to (address and public
   key). Every page that uses the database loads it; a staging copy of the site replaces only this file.
4. **`kingdoms-call-data.js`** (both portals; not the leaderboard).
5. **The main script.** It checks the data file before anything else (below), creates the Supabase
   client, and calls `init()`, which hides the spinner.

Everything is a classic script, so **top-level `const`/`let` from every script share one global
scope**. A name declared in two scripts is a `SyntaxError` that stops the page loading. A top-level
`const` used before its line runs is a temporal-dead-zone throw that hangs the page
([traps.md](traps.md#top-level-declaration-order-the-items_by_tier-class)).

## `kingdoms-call-data.js`: the one source for shared rules

- **Content tables** (`ALL_MAGIC_ITEMS_P`, `MONSTERS_P`, `PRIMAL_ARMY_DEFS_P`, `MASTERY_UNLOCKS`, …):
  plain literals. Nothing in the file may reference portal code.
- **Shared rule tables** (the block headed `SHARED RULE TABLES`): every `KC_*` table, e.g.
  `KC_UNIT_CLASS` (unit classes as ordered lists), `KC_DRUID_LEVELS`, `KC_UNIT_BASE_STR`, `KC_SKILLS`,
  `KC_SEASONS`, `KC_GRAND_DESIGNS`. Until 27 Sept each lived in two to eleven hand-typed copies,
  several of which had drifted. Now each portal builds its own local copy **from** these
  (`new Set(KC_UNIT_CLASS.creature)`, `KC_SEASONS.slice()`, `{...KC_SKILL_LABELS}`), so no consumer can
  mutate another's. The editing rules are at the top of that block: change a rule there; append, never
  re-sort; plain data only; `KC_` names only.
- **A few deliberate near-copies stay in the GM portal**, because the *order* is a tie-break priority
  (each is commented `NOT a copy`). Don't collapse them.

**The stamp guard.** The data file declares `KC_DATA_STAMP`. Each portal declares the oldest data file it
accepts (`KC_DATA_MIN` in the GM portal, `KC_DATA_MIN_P` in the player portal) and the full list of
tables it needs (`KC_SHARED_TABLE_NAMES` in the GM portal; an inline list in the player portal). A
missing table, a missing stamp or an older stamp stops the portal with a "data file out of date"
message. **When the data file changes, bump its stamps and both portals' minimums together**
([traps.md](traps.md#the-data-file-stamp-guard)).

## The turn engine (GM portal)

- **Game state** is one JSON value per game in `games.game_state` (hundreds of KB for a mid-game
  6-realm world). It arrives from Supabase as a **string**: always read it through
  `parseGameState(game)`.
- **Turn 0.** `runTurn0` previews the bot roster; `commitTurn0` generates the world, saves it and
  pushes each realm's first report.
- **`runTurn`** loads the full world and every slot, brings an older save up to the current tables
  ([traps.md](traps.md#live-saves-keep-copies)), merges the submitted orders, then (inside the
  resolution block) runs the bot passes, defaults missing orders to Defend and resolves the five phases
  (look for `// 4. Run all 5 phases`). Then:
  1. **saves the world with a conditional update** (`.eq('turn', n)`): if another tab already
     resolved this turn, nothing is written and `_saveConflict` is set;
  2. sets `_turnCommitted=true` on the line after that save succeeds;
  3. builds and pushes each realm's report (`buildTurnReport`), writes `turn_logs`, then telemetry.

  Steps 2–3 are **post-commit**: a failure there must never restore orders or retry the turn
  ([traps.md](traps.md#post-commit-work-in-runturn)). `runTurn` catches its own errors and **returns** an
  outcome `{ok, committed, conflict, error}`; it doesn't throw.
- **Automatic turns.** While a GM tab is open, `autoTurnTick` runs every 60 s (`AUTO_WATCH_MS`). For
  each live, non-archived game in automatic mode it checks whether all orders are in or the deadline
  has passed, and if so runs `runTurn`. A failed run parks that game for 15 minutes
  (`_autoFailUntil`, `AUTO_FAIL_COOLDOWN_MS`). This cooldown is per tab and in memory; the conditional
  save is what prevents a double resolution (a `localStorage` lease, `_autoLease`, also keeps two tabs in
  one browser from trying at once). Before running a due turn, the watcher re-fetches the
  page and the data file and reloads the tab once if either has a newer stamp, so the newest engine
  resolves it (`refreshIfNewerBuild`).
- **Bots** plan their orders inside `runTurn`, in the same tab, from the same state a human saw.
- **Engine functions are nested inside `runTurn`** (combat, terrain modifiers, …). Tests reach them by
  injecting code at exact source lines (see [tests/README.md](../tests/README.md#code-anchor-hooks)).
  Phase 1 of the roadmap lifts them out into modules.

## The database (Supabase)

The structure is in `supabase/` (since P0-15): `supabase/schemas/` is the desired state, one file per
table with its access rules, and `supabase/migrations/` the changes that build it
([supabase/README.md](../supabase/README.md)). Older features also ship their SQL in a set-up banner on
the GM portal's game list (`KC_META_SQL`, `KC_TEL_SQL`, `KC_LB_SQL`, `KC_MSG_SQL`); those banners go
with plan step P0-17, which also applies migrations automatically. Each feature probes for its table or
column first and degrades quietly while it's missing.

| Table | Holds |
|---|---|
| `profiles` | One row per account: display name |
| `games` | One row per game: settings, `turn`, `status`, `game_state` (the world), `meta` (below) |
| `game_players` | One row per realm slot: who plays it (a bot slot has no `user_id`), its orders, `orders_submitted`, its latest `turn_report` |
| `turn_logs` | Per-turn log and report snapshots (`player_index: -1` is the GM's full log) |
| `turn_events` | Telemetry: one row per realm per resolved turn (orders, before/after snapshots, outcomes) |
| `game_results` | One row per realm when a game ends |
| `game_records` | Hall of Fame: one precomputed row per finished game |
| `game_messages`, `game_message_reads` | Dispatches between players, and each realm's read markers |

**`games.meta`** is a ~1 KB summary of the world (turn mode, which realms are exempt from orders, map
size, bot set-up, archived flag, …), built by `buildGameMeta` and written by every path that writes
`game_state` (through `metaPatch`). Lists and the watcher read `meta` with light column lists
(`gamesListCols()`) instead of loading every world. That stopped a Disk IO drain in Sept 2026
([traps.md](traps.md#select-on-big-tables)).

**Telemetry, results and records** use `game_id` as text, with no foreign key, so they outlive a
deleted game unless deleted explicitly. `deleteGame` now removes them; **Archive** (`setGameArchived`)
keeps everything and hides the game from the active list and the watcher. Every telemetry hook in the
turn path is wrapped in `try/catch`, so a telemetry bug can never cost a turn.

## Hall of Fame

The leaderboard page reads only `game_records`. The rows are built in the GM portal by
`buildGameRecords`, because turning snapshots back into strengths and titles needs engine tables. It
runs at game over (inside its own `try/catch`) and on demand from the Stats tab. The builder emits
record **keys**; the leaderboard's `KC_ACH` catalogue gives them labels, and an unknown key still
renders under "Other records", so a new record can't be lost.
Each key holds a list: the best entry of every realm in that game, best first (rows built before
Oct 2026 hold one entry, the game's best; the page reads both). Searching for a realm or player on
the page narrows the lists to their own entries.

## Dispatches (player messaging)

Two tables, outside the turn path: nothing in `runTurn` or the reports touches them. The player portal
polls every 8 s while Dispatches is open (less often otherwise, never in a hidden tab). It fetches only
messages newer than the last id seen. Unread markers compare message **ids**, not timestamps. Messaging
is hidden in games with fewer than two human realms.

## Version stamps

Each page carries a New Zealand-time build stamp (`YYYY.MM.DD-HHMM`) in its footer. The GM portal also
has it in `KC_BUILD_STAMP`, which telemetry rows record. The data file carries two stamp lines: the
`// Data file v…` comment and `KC_DATA_STAMP`. Since the cutover, git history is the version record,
but the stamps still drive the data-file guard and the GM tab's auto-reload, so keep bumping them, both
copies each time ([traps.md](traps.md#the-gm-portals-two-build-stamps),
[traps.md](traps.md#the-data-file-stamp-guard)).

## Staging

A second copy of the site at <https://kingdoms-call-staging.github.io/>, with its own Supabase project and
no real players. A pull request labelled `staging` is tested, then published there with a `kc-config.js`
pointing at the staging database (`.github/workflows/staging.yml`). One pull request is on staging at a
time, and its PR comment says so.

## Tests

`npm test` boots the real pages in jsdom (and Chromium where needed) against an in-memory Supabase
stand-in, with a seeded `Math.random`. It runs whole all-bot games through the real `runTurn`.
[tests/README.md](../tests/README.md) lists every test, its level and its origin.
