# The database and what it holds

## The database (Supabase)

The structure is in `supabase/` (since P0-15): `supabase/schemas/` is the desired state, one file per
table with its access rules, and `supabase/migrations/` the changes that build it
([supabase/README.md](../../supabase/README.md)). Merging a migration to `main` applies it to staging, then to
production once Toby approves, and only then deploys the site
([supabase/README.md](../../supabase/README.md#how-a-migration-goes-live)). The GM portal carries no SQL (its
set-up banners went in plan step P0-17). Each feature probes for its table or column first, degrades
quietly while it's missing, and says so on the game list (`kcMissingMsg`).

| Table | Holds |
|---|---|
| `profiles` | One row per account: display name |
| `games` | One row per game: settings, `turn`, `status`, `game_state` (the world), `meta` (below), `block_eliminated_msgs` (the GM's switch "Block eliminated realms from sending dispatches", P0-25; off by default). Created only by a Game Master, in their own name; never by the Overlord (P0-32d). The Overlord reads, saves and deletes any game, as Master GM (P0-32e); no save changes a game's GM: only `reassign_game` (Overlord only, to a Game Master) hands a game over |
| `game_players` | One row per realm slot: who plays it (a bot slot has no `user_id`), its orders, `orders_submitted`, its latest `turn_report`. No slot is ever the Overlord's (P0-32d), but the Overlord reads, changes and removes any slot and adds bot slots, as Master GM (P0-32e); one realm per slot number in a game (P0-20). Other realms' slots are meant to be seen only through `get_game_slots()` (number, bot or not, orders in or not, alignment while in setup), never read directly (Unit B) |
| `turn_logs` | Per-turn log and report snapshots (`player_index: -1` is the GM's full log). Written by the game's GM or the Overlord (P0-32e) |
| `turn_events` | Telemetry: one row per realm per resolved turn (orders, before/after snapshots, outcomes) |
| `game_results` | One row per realm when a game ends |
| `game_records` | Hall of Fame: one precomputed row per finished game |
| `site_admins` | The Overlord (P0-32a): at most one account, above all others. No API role can read or change it; rules ask `is_site_admin()`. Set only by `kc_set_overlord()`, through `.github/workflows/overlord.yml` (live) or the staging seed. The GM portal asks `is_site_admin()` after sign-in (P0-32c) |
| `game_masters` | Game Masters by offer (P0-32b): one row per account the Overlord has offered GM to, open (`accepted_at` null) or accepted. Written only by the `gm_*` functions; an account reads its own row, the Overlord reads all. Rules ask `is_game_master()`: creating a game needs it (P0-32d), and so does every GM write (P0-32i). The player portal reads the account's own row for the offer banner (Accept / No thanks call `gm_accept_offer` / `gm_decline_offer`); the GM portal lets in only a Game Master or the Overlord (P0-32c). The Overlord offers, withdraws and revokes GM on the Overlord page (P0-32f) |
| `game_messages`, `game_message_reads`, `message_reports` | Dispatches between players, each realm's read markers, and the dispatches players have reported (P0-24) |

### Where a rule is enforced: access rules or database functions

There's no server: every page talks straight to the database with the public key, so any rule that stops a
player doing something must be enforced **inside the database**. Two tools do that (a third, Supabase Edge
Functions, would add a server runtime and deploy path, and isn't used):

- **Access rules** (row-level security) on the table, with the page reading or writing it directly. Use them
  for **plain reads and writes of a row**: who may see which rows, who may insert, update or delete their own.
  Most tables work this way. Rules are normally permissive: a write is allowed if any one allows it. A
  **restrictive** rule is ANDed with them instead, so it narrows a write without rewriting the others ("only
  Game Masters create games" on `games`, "the Overlord holds no realm" on `game_players`, P0-32d; "a save keeps the game's GM" on `games`, P0-32e; "GM writes need a Game Master" on every table a GM writes but players don't, P0-32i: a revoked GM keeps no write to their finished games).
- **Database functions** that the page calls by name (`rpc`), on a table no API role may write. Use them for
  **actions with conditions**, which rules express badly:
  - the check spans other tables (`gm_revoke` is refused while that GM runs an unfinished game);
  - only one column may change, once, and nothing else (`gm_accept_offer` fills in your own `accepted_at`;
    rules can't limit *which* columns an update touches without column grants plus a trigger);
  - the refusal needs to say why. A rule's refusal is always the same "violates row-level security policy";
    a function can say "That Game Master runs an unfinished game: hand it over first", which the page can show;
  - it reads what the site otherwise can't (`overlord_accounts()` reads accounts' emails, for the Overlord
    only);
  - it writes what no API role may: `account_suspend()`, `account_unsuspend()` and `account_delete()` change Supabase
    Auth's own `auth.users` (its `banned_until`, or the account itself), for the Overlord only (P0-32h). A suspended
    account can't sign in or refresh its session; one already open lasts until its token expires (up to an hour).

  One function per action keeps each rule in one place to read and test, and leaves the table no other way
  in. The examples are the Game Master functions (P0-32b) and `kc_set_overlord()` (P0-32a).

**The price of functions.** They're `security definer`: they run with the owner's rights and bypass the
access rules, so **each must check its caller itself** (`is_site_admin()`, `auth.uid()`), set
`search_path TO ''`, revoke Supabase's default grants and grant `execute` only to the roles that need it
(`supabase/README.md`). A missed check is a real hole, so each has access-rule tests from every point of view
in `supabase/tests/database/`. Their logic is SQL (plpgsql), not JavaScript, and lives in
`supabase/schemas/public/functions/`.

**`games.meta`** is a ~1 KB summary of the world (turn mode, which realms are exempt from orders, map
size, bot set-up, archived flag, …), built by `buildGameMeta` and written by every path that writes
`game_state` (through `metaPatch`). Lists and the watcher read `meta` with light column lists
(`gamesListCols()`) instead of loading every world. That stopped a Disk IO drain in Sept 2026
([traps.md](../traps.md#select-on-big-tables)).

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

Three tables, outside the turn path: nothing in `runTurn` or the reports touches them. The player portal
polls every 8 s while Dispatches is open (less often otherwise, never in a hidden tab). It fetches only
messages newer than the last id seen. Unread markers compare message **ids**, not timestamps. Messaging
is hidden in games with fewer than two human realms.

A dispatch is at most 500 characters, 10 a minute and 300 a day per player per game (P0-23, enforced in the
database). A private dispatch is read by the realms in the conversation and the Overlord. A player can
**⚑ Report** a dispatch they received (`message_reports`); the game's GM sees reports on the game's screen
(`gm_reported_messages`), unless the GM plays in that game, when only the Overlord does (P0-24).

Until the game is over, a realm that has conceded or been extinguished sends no private dispatches, and none at
all while the game's `block_eliminated_msgs` switch is on (P0-25, R-075). The player portal decides this from the
realm's own turn report (`kingdom.conceded`, `kingdom.eliminated`) and the game's light row (`status`,
`block_eliminated_msgs`); the database doesn't check it yet, because who is out lives in `game_state` (P2-04).

## Versions

Each page's version is in its HTML, filled in by `tools/build.ts` after Vite (P1-06c):
- **The build line**, in the footer of the four pages that use the database (the GM portal, the player portal, the
  Hall of Fame, the Overlord page), where the template has `<!--kc-build-->`: `build <7-character commit> · <date and
  time, New Zealand>`, e.g. "Kingdoms Call — GM Portal · build 3f2a9c1 · 22 Oct 2026, 10:15". The commit is git's
  (`git log -1` beside `src/`), its time the commit's, so the same commit always builds the same bytes;
  `KC_BUILD_COMMIT` and `KC_BUILD_TIME` override them. With no git (a copy of `src/` elsewhere) it says "build
  unknown"; `npm run dev`, "build dev". The two rulebooks keep their typed footers until Toby rules on them.
- **Two metas**, on every page: `kc-build` (the commit) and `kc-page-version` (the page's fingerprint: the first 12 hex
  digits of the SHA-256 of its HTML before the build line and the metas are filled in). The HTML names its hashed
  files, so the fingerprint changes exactly when the page or one of its files does; the bundles never hold the commit.
- **`version.json`**, beside the pages: `{ "commit", "time", "pages": { "<page>.html": "<fingerprint>", … } }`.
- **Who reads them.** `KC_BUILD_STAMP` (`ui/gm/startup.ts`) and `runningBuildStamp()` (`ui/gm/auto-turn.ts`) are the
  meta's commit, 7 characters: telemetry rows (`GM 3f2a9c1 tel3`), Hall of Fame records (`lb3`), the Stats export and
  each report's `engineStamp` carry it. `src/ui/shared/a-newer-version-of-this-page.ts` compares this page's
  fingerprint with the one `version.json` names for it: another one counts once this page has known of it for 10
  minutes (GitHub's cache can hand out the old page for 10 minutes after a deploy). The decision itself is a function
  on plain values (`whatVersionJsonSaysOf`). The GM tab's reload before a due turn asks it
  ([above](the-turn-engine.md#the-turn-engine-gm-portal)), and so does the reload banner.
- **The reload banner** (P1-06d, `src/ui/shared/the-reload-banner.ts`), on the four pages that read the database: each
  page's entry (`page.ts`) imports it, which starts the watch as the page loads. It reads `version.json` then, every 5
  minutes, and when the tab is shown again (at most once a minute), never from the browser's cache; a failed read is no
  news, and where `version.json` can't be read (`file://`, jsdom without a `fetch`) it watches nothing. Once a newer
  version of the page counts, a bar at the top says "A new version of Kingdoms Call is ready. Save what you're doing,
  then reload.", with a **Reload** button: 10 to 15 minutes after a deploy that changed the page, never after one that
  didn't. It never reloads by itself, since a player may be writing orders. The rulebooks and the landing page have no
  data to go stale and have no banner.

## Staging

A second copy of the site at <https://kingdoms-call-staging.github.io/>, with its own Supabase project and
no real players. A pull request labelled `staging` is tested; then the staging database is rebuilt for it
(emptied, `main`'s migrations, the test accounts, the made-up games of `supabase/seeds/staging.sql`, then the
pull request's own migrations and the seed again: `.github/scripts/migrations.js reset staging`); then the
site, built from the pull request by a job of its own that may only read, is published there with a `kc-config.js`
pointing at the staging database (`.github/workflows/staging.yml`: its `build` job, then its `staging` job). One pull request is on staging at a time, and its PR comment says so;
merging changes nothing there. That `kc-config.js` also carries `deployed: {pr, sha}`, so every page's
footer says which pull request and commit is on staging, linking to the pull request.

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
and site changes go in separate PRs ([supabase/README.md](../../supabase/README.md#database-and-site-changes-go-separately)).

## A site change that needs a database change

Every page that uses the database (both portals and the Hall of Fame) declares `KC_DB_MIN`, the oldest
database version it works with (a migration's 14-digit version), and starts through
`kcDbGuard(sb, KC_DB_MIN)` (`src/db/kc-db-guard.ts`, P0-34). Before the first read, it asks the database for
its version (`kc_db_version()`, the newest migration applied). On an older database, or one without the
function, or no answer after one retry, the page stops with "The game is being updated" and nothing is read
or written.
- **Raising `KC_DB_MIN` is how a site PR says "needs migration X".** Use it when the page can't sensibly
  work without the change; otherwise cope ([above](../traps.md#a-new-column-must-be-optional-at-the-write-site)).
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

## `game_state` is a string

On a `games` row, `game_state` is a JSON **string**. Always use `parseGameState(game)`; never read fields
off it directly. A function that guards with `typeof state !== 'object'` turns a raw string into a
silent no-op. Before adding a new reader, grep for `game_state` reads that don't parse.

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

## A migration waiting for approval holds every deploy

A merge that adds a migration stops at `migrate-production` until Toby approves it, and the site deploys
only after that ([supabase/README.md](../../supabase/README.md#how-a-migration-goes-live)). Deploys run one at a
time, so **every later merge waits behind it**, site-only fixes included, and ships with it once approved.
- Merge a migration when Toby can approve it soon, not ahead of an urgent site fix.
- If he rejects it, the run fails and nothing deploys; the next push to `main` asks again, because the
  migration is still new compared with the live site. So follow a rejection quickly with a pull request
  whose migration undoes it: production then gets both in order and ends up unchanged
  ([supabase/README.md](../../supabase/README.md#how-a-migration-goes-live)). (Deleting the rejected migration's
  file also works, and CI allows it with a warning; staging is rebuilt for each pull request anyway.)
- Approval requests expire after 30 days.

## A new table is open to signed-out visitors until its migration says otherwise

Supabase gives every new table, sequence and function in `public` to every API role, signed-out visitors
(`anon`) included, with every privilege (`truncate` too, which ignores the access rules). A `grant` line in a
schema file doesn't take those away: the file must say `REVOKE ALL … FROM "anon"` and `… FROM
"authenticated"` first, then grant what the site uses
([supabase/README.md](../../supabase/README.md#changing-the-structure)). Without the revokes, the generator
doesn't just leave a new table open: it **gives back** what an earlier migration took away, the next time
anyone generates a migration (it nearly happened in P0-29). `supabase/tests/database/00_privileges.test.sql`
checks every table, sequence and function, so either mistake turns the `db` check red.

## A stacked pull request merges into its base branch, not `main`

A site pull request stacked on its database pull request ([staging.md](../staging.md#a-change-that-needs-both))
targets the database change's branch. GitHub moves it onto `main` only when that branch is **deleted**
after its merge. If the branch stays, merging the stacked pull request puts it on the leftover branch: GitHub
says "Merged", nothing deploys (P0-20's site half and P0-21 did this, and were opened again as #56 and #57).
The `merges-into-main` check (`.github/workflows/merges-into-main.yml`) is red on any pull request whose base
isn't `main`; don't merge one while it's red. When you open a stacked pull request, say in its first line
which pull request must be merged first.
