# Architecture

How Kingdoms Call works today, at the cutover build (GM portal `2026.09.30-0038`, data file
`2026.09.29-2329`). Short on purpose: read this, then [traps.md](traps.md), then only the code you need.
Line numbers drift; search for the names given here.

## The shape in one paragraph

A static site with no server of its own. Every published page is one HTML file with its JavaScript
inline, put together from the source in `src/` by a small build ([below](#the-build-src-becomes-site)). The pages talk straight to a Supabase Postgres database from the browser, using
supabase-js and the project's public (anon) key. **The turn engine runs in the GM's browser tab**: the
GM portal generates worlds, runs the bots, resolves turns and writes each realm's report. Players only
submit orders and read what they're given.

## The build: `src/` becomes `site/`

Since P1-05, `src/` is the source and `site/` is build output: git-ignored, published by the deploy, and opened by
every test. **Edit `src/`, never `site/`**: the next build overwrites it.

- **`npm run build`** (`tools/build.ts`, about 0.1 s) reads `src/manifest.ts`. For each page it lists a template and,
  for each inline block, the files that make it, in order. A template is the page with the contents of each inline
  `<script>` and `<style>` taken out and replaced by one line, `{{kc-build:<name>}}`; the build puts that block's files
  in its place, byte for byte. The other files (the data file, `kc-*.js`, `vendor/`) are copied as they are. When it
  landed, the build reproduced the committed `site/` exactly, every byte of every file.
- **Each `.js` file is a stretch of whole top-level statements**, so it parses on its own; no file ends inside a
  function (`tests/static/build.test.ts`). The GM portal's main script is 76 files; `src/engine/run-turn.js` (the turn,
  `resolveTurn`, ~13,000 lines) is being taken apart by P1-08, one area at a time (below). The player portal's is 20.
- **Folders say what most of a file is**: `engine/` (rules, bots, world generation), `views/` (the turn report,
  the statistics snapshots, what a realm can see), `db/` (which database, the version guard, telemetry and the light `meta`
  rows), `content/` (the data file), `ui/<page>/` (each page's template, styles and the rest of its code),
  `ui/shared/` (scripts every page loads), `rulebook/`, `vendor/`. Each file is still a stretch of its page, not a
  module: the page's scripts share one global scope, so the manifest's order is the order the code runs
  ([traps.md](traps.md#top-level-declaration-order-the-items_by_tier-class)). P1-09 makes them modules, renaming
  `.js` to `.ts` in place, and Vite replaces the build.
- **The engine is `engine/` and `views/`** (P1-18c): nothing in them reads the screen, the database or the page's other
  globals, and every name they read is declared in them or the data file: P1-18d moved the last exceptions, the
  turn's database and screen work and the reports' build stamp, into the turn's shell (`ui/gm/turn-shell.js`).
  `engineFiles()` in the manifest is the GM page's main list filtered to the two folders, and `tests/lib/engine.ts`
  runs them in a bare Node `vm`. The Hall of Fame's GM-side code reads the database and the screen, so it is
  `ui/gm/hall-of-fame.js`.
- **A new file goes into its list in the manifest**, where its code should run. The build stops on a file in `src/`
  that no list names, and on a marker or a block without its partner.
- **Who builds:** `npm test` and `npx playwright test` before any test (`tests/setup/global.ts`; not when `KC_SITE`
  names another copy), `npm run balance` (and the base branch's copy, with that branch's own build:
  `tools/balance/sides.ts`), every CI job that tests, the deploy just before it publishes, and staging just before it
  writes its own `kc-config.js`. Run `npm run build` yourself before opening a page or running one test script on its
  own.

## The pages (`site/`)

Built from `src/` ([above](#the-build-src-becomes-site)); `src/manifest.ts` lists where each comes from.

| File | Size | What it is |
|---|---|---|
| `index.html` | small | Landing page; links the player portal and both rulebooks |
| `kingdoms-call-gm-portal.html` | ~28,900 lines, ~2.1 MB | GM UI, world generation, the whole turn engine (`resolveTurn`, and its shell `runTurn`), bot AI, turn reports, telemetry, Stats tab, Hall-of-Fame builder, "missing from the database" messages |
| `kingdoms-call-player-portal.html` | ~10,600 lines, ~770 KB | Sign-in, My Games, order entry, the turn report and Chronicle, the map, Dispatches (player messaging). Holds client-side projections that mirror engine rules (see [traps.md](traps.md#a-rule-written-twice-must-change-twice)) |
| `kingdoms-call-data.js` | ~410 KB | Content tables (items, monsters, lairs, discoveries, hero names, …) and the **shared rule tables** both portals read |
| `kingdoms-call-leaderboard.html` | ~780 lines | Hall of Fame: leaderboard and achievement records over finished games |
| `kingdoms-call-overlord.html` | ~450 lines | The Overlord page (P0-32f): accounts (offer, withdraw and revoke GM; suspend, lift and delete: P0-32h), handing games to another GM, every game, every game's reported dispatches. For the Overlord only; not linked from any page. Its sign-in is kept apart from the portals' (its own `storageKey`). No data file |
| `kingdoms-call-rules.html`, `kingdoms-call-rules-intro.html` | | The comprehensive and introductory rulebooks (prose) |
| `kc-safe.js` | small | `kcHtml`, `kcEsc`, `kcRaw`, `kcArg`: the one way a page builds HTML from data ([below](#how-a-page-builds-html)) |
| `vendor/supabase-js-<version>.min.js` | ~210 KB | The Supabase library, a copy served with the site ([below](#supabase-js-a-copy-served-with-the-site)) |

All pages sit in one folder and link each other relatively. Only `site/` is published, so URLs are the
same as before the cutover and the build. No page loads a script from another site; the only outside requests are
Google Fonts.

### supabase-js: a copy served with the site

The pages load supabase-js from `vendor/` beside them (source: `src/vendor/`), not from a CDN (P0-18), so no outside party can change the
code that holds players' logins, and a CDN outage can't stop the portals loading.

- **Version:** 2.117.3, the package's browser build (`dist/umd/supabase.js`) copied unchanged to
  `src/vendor/supabase-js-2.117.3.min.js`, with its licence beside it (`supabase-js-LICENSE.txt`).
- **SHA-256:** `d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3`. `npm test`'s
  `vendor-supabase` check fails if the file and this line disagree.
- **Nothing watches it for updates** (Dependabot can't see a copied file). When you touch this area, check
  `npm view @supabase/supabase-js@2 version` and upgrade if it's newer. P1-17 replaces the copy with a pinned
  npm dependency.

**To upgrade**, in its own PR (it changes `src/vendor/**`, so it's a dangerous path: talk it through with
Theo):
1. In an empty folder: `npm pack @supabase/supabase-js@<version>` (npm checks the download against the
   registry's checksum), then unpack it with `tar -xzf`.
2. Copy `package/dist/umd/supabase.js` to `src/vendor/supabase-js-<version>.min.js` and `package/LICENSE` to
   `src/vendor/supabase-js-LICENSE.txt`; delete the old copy, and rename it in `src/manifest.ts`'s copies.
3. Point the `<script src="vendor/…">` tags (in the page templates under `src/ui/`) and their boot-failure hints
   at the new file name, and update the version and SHA-256 above (`shasum -a 256 <file>`).
4. Read the release notes between the two versions for anything the pages use (sign-in, `rpc`, realtime).
5. `npm test`, then try sign-in, orders and Dispatches on staging.

## How a portal boots

Order inside each portal's `<head>` and body, and why it matters:

1. **Boot-failure reporter**: a small inline script, first in `<head>`. While the loading spinner is
   still showing, the first `error` or `unhandledrejection` replaces it with the message, a hint and a
   Reload button. Without it, any top-level throw looks like "Loading…" for ever. On pages that load
   `kc-safe.js`, it puts the message and hint in as text, since it runs before the helpers exist.
2. **`kc-safe.js`**, straight after it (both portals, the Hall of Fame and the Overlord page): the HTML helpers
   ([below](#how-a-page-builds-html)).
3. **supabase-js v2**, from the site itself (`vendor/supabase-js-<version>.min.js`, [above](#supabase-js-a-copy-served-with-the-site)).
4. **`kc-config.js`**: `KC_CONFIG`, which database this copy of the site talks to (address and public
   key). Every page that uses the database loads it; a staging copy of the site replaces only this file.
5. **`kingdoms-call-data.js`** (both portals; not the leaderboard).
6. **`kc-db-guard.js`** (both portals, the leaderboard and the Overlord page), straight after `kc-config.js`: `kcDbGuard`, the
   database version guard ([traps.md](traps.md#a-site-change-that-needs-a-database-change)).
7. **The main script.** It checks the data file before anything else (below), creates the Supabase
   client, then `kcDbGuard(sb, KC_DB_MIN)`: only if the database is at least `KC_DB_MIN` does it call
   `init()` (the leaderboard: `loadAll()`), which hides the spinner. Otherwise the guard raises "The game is
   being updated" through the boot-failure reporter, and nothing is read or written. In the GM portal, a
   signed-in account is then checked (`gmPortalAllowed`: `is_game_master()` or `is_site_admin()`, P0-32c);
   anyone else, or a check that fails, sees only "You're not a Game Master" and nothing else loads. The Overlord
   gets **Master GM mode** (`_kcOverlord`, P0-32g): every game, grouped by GM, with no New Game and no automatic
   watcher; **Run turn now** on any active game, orders in or not; `?game=<id>` (the Overlord page's link) opens a game.
8. **`kc-staging-footer.js`**, last in `<body>` (every page; the landing page and rulebooks load
   `kc-config.js` just before it). On staging it adds "Staging · PR #N · abc1234" to the footer, plus
   "database <version>" on pages that use the database; on the live site, whose `kc-config.js` has no
   `deployed`, it does nothing.

Everything is a classic script, so **top-level `const`/`let` from every script share one global
scope**. A name declared in two scripts is a `SyntaxError` that stops the page loading. A top-level
`const` used before its line runs is a temporal-dead-zone throw that hangs the page
([traps.md](traps.md#top-level-declaration-order-the-items_by_tier-class)).

## How a page builds HTML

Every name and message on screen was typed by someone, so a page treats every value as text (P0-19).
`kc-safe.js` (`src/ui/shared/kc-safe.js`) gives each page four helpers:

- **`kcHtml`**, a tagged template: in ``kcHtml`<td>${realm}</td>` `` every value is escaped, unless it is itself
  `kcHtml` or `kcRaw`. A list is its items, one after another. It returns a marked value that goes into
  `innerHTML` as markup.
- **`kcEsc(v)`**: `v` as text, for the rare place that needs a plain escaped string.
- **`kcArg(v)`**: a value inside an `on…="…"` handler, e.g. ``kcHtml`<tr onclick="toggleGame(${kcArg(id)})">` ``. The
  browser unescapes an attribute before running it, so escaping alone isn't enough there.
- **`kcRaw(s)`**: markup passed through unchanged. Only for markup no player can have written; each use says why.

Engine narrative is escaped where it's shown, not where it's written: the report stores `**bold**`, and the page
turns it into `<strong>` after escaping. The player portal's Chronicle also tints each name it knows: it splits the
line's text at every bold run and every name, and wraps only those pieces in `kcHtml`, so the rest stays text. A
list of `kcHtml` pieces with a separator between them goes in through the player portal's `kcJoinP(list, sep)`. A
page whose content is mostly fixed builds elements instead (the Overlord page's `el()`), which is just as safe.

Every page builds its HTML this way. `npm test`'s `html-lint` refuses HTML built any other way, and each page that
builds HTML from data has a hostile-name test. Mistakes to avoid: [traps.md](traps.md#html-is-built-only-through-kchtml).

## `kingdoms-call-data.js`: the one source for shared rules

- **Content tables** (`ALL_MAGIC_ITEMS_P`, `MONSTERS_P`, `PRIMAL_ARMY_DEFS_P`, `MASTERY_UNLOCKS`, …):
  plain literals. Nothing in the file may reference portal code. `PRIMAL_ARMY_DEFS_P` is the one place a
  Creature's or Monster's cost, strength, move, sub-race and pre-battle strike are written; the GM master
  tables and the player portal's speeds are built from it, and `tests/lib/primal-decided.js` (the wild roster
  Toby decided on 2026-10-13) holds it, the class lists, the Druid ladder and the books to the decided figures.
- **Shared rule tables** (the block headed `SHARED RULE TABLES`): every `KC_*` table, e.g.
  `KC_UNIT_CLASS` (unit classes as ordered lists), `KC_UNIT_TYPE` (each unit's one type word: infantry,
  ranged, cavalry, flyer or naval), `KC_DRUID_LEVELS`, `KC_UNIT_BASE_STR`, `KC_SKILLS`,
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
- **A turn is two functions** (P1-18d): the engine works it out, and a shell around it does the database and
  screen work.
- **`resolveTurn(G, freshPlayers, expectedTurnToRun)`** (`src/engine/run-turn.js`) is the turn itself. It takes
  the saved state as loaded (JSON: parsing it is the turn's copy), the slot rows and the turn being run. It
  brings an older save up to the current tables ([traps.md](traps.md#live-saves-keep-copies)), merges the
  orders, runs the bot passes, defaults missing orders to Defend, and resolves the five phases (look for
  `// 4. Run all 5 phases`) and the end of the turn. It is synchronous and reads no database, no screen and
  no clock; the dice are `kcRng`'s (below). It returns `{state, log, buildReports}`: the world to save, as
  JSON; the GM's log; and `buildReports()`, which builds every realm's report on the working copy, once, and
  is called only after the save. `tests/unit/engine-purity.test.ts` plays a whole game through it in Node,
  with no page.
- **`runTurn`**, the turn's shell (`src/ui/gm/turn-shell.js`), loads the full world and every slot, checks the
  game is still on the turn the GM meant to run, then **clears the submitted orders in the database**
  (keeping a copy in memory) and stops if that fails. Only then does it call `resolveTurn`. Then it:
  1. **saves the world with a conditional update** (`.eq('turn', n)`), stamped with when the turn ran
     (`turnRanAt`, and in deadline mode `nextDeadlineAt`): if another tab already resolved this turn, nothing
     is written and `_saveConflict` is set;
  2. sets `_turnCommitted=true` on the line after that save succeeds;
  3. calls `buildReports()` and writes each realm's report, stamped with the build that wrote it
     (`engineStamp`), and its `turn_logs` snapshot, then the GM's log, then telemetry.

  Steps 2–3 are **post-commit**: a failure there must never restore orders or retry the turn
  ([traps.md](traps.md#post-commit-work-in-runturn)). Everything from the load to the save is in one `try`
  (P1-18a), so `runTurn` **returns** an outcome `{ok, committed, conflict, error}` on every path; it doesn't
  throw. A failure before the save puts the orders back as they were loaded. A save that answers with an
  error may still have landed, so the catch reads the game's turn again first: if it has moved on, the turn
  counts as committed and the orders stay spent; if it can't be read, nothing is put back.
  `tests/page/turn-shell.test.ts` stages each of these failures.
- **Automatic turns.** While a GM tab is open, `autoTurnTick` runs every 60 s (`AUTO_WATCH_MS`). Never in the
  Overlord's tab (Master GM mode, P0-32g): each game's own GM tab runs its automatic turns. For
  each live, non-archived game in automatic mode it checks whether all orders are in or the deadline
  has passed, and if so runs `runTurn`. A failed run parks that game for 15 minutes
  (`_autoFailUntil`, `AUTO_FAIL_COOLDOWN_MS`). This cooldown is per tab and in memory; the conditional
  save is what prevents a double resolution (a `localStorage` lease, `_autoLease`, also keeps two tabs in
  one browser from trying at once). Before running a due turn, the watcher re-fetches the
  page and the data file and reloads the tab once if either has a newer stamp, so the newest engine
  resolves it (`refreshIfNewerBuild`).
- **Bots** plan their orders inside `resolveTurn`, in the same tab, from the same state a human saw.
- **Battle lines** (`battleGrid` and its helpers, module level beside the strength ladder). The front the
  ground allows is rolled once per battle (`rollBattleWidth`: plains and desert 6–8, forest and jungle 4–6,
  mountain 2–4, sea 8–10); each side is placed by unit type into flanks, front, second line and reserve;
  `battleDeploy` lets the better-explored side (`battleScout`; a province's own defenders know it fully, ties
  to the defender) take the roll or one either side and line up second, then gives each commander one swap
  per Tactical level (`battleBestSwap`, every swap judged with both sides faced, and none that would part the
  two fronts: `battleFrontsMeet`); `battleFacing` reads the two
  grids against each other (matchups by unit type, wrapping, flank duels and guards, a turned flank) and its
  totals are the strengths the dice see. The units' own abilities sit on the same grid: `abilityFront` and
  `abilityBack` adjust one matchup, `battleFaceSide` the cases that read the whole line, `battleGrid` who may
  take a flank; the volley helpers (`missileDamageMult`, `abilityVolleys`, `missileTargetPool`,
  `archeryBlockedBy`) and `unitAbilityMult` carry the rest ([traps.md](traps.md#a-unit-ability-is-written-in-four-places)). Both battle paths score through deploy and facing, the stay-or-retreat
  estimate through grid and facing; the bots' estimates (`battleLineTotal`, at the middle width) through the
  grid alone. The report prints the grid as 📊 lines, which the portals draw in
  monospace, and the ladder names every place and matchup.
- **Unit fates** (`rollUnitFates`, module level beside `disbandLine`). After a battle, each unit of a player's
  force rolls once for its fate (a beaten survivor twice); the four casualty sections (the attacker winning or
  losing against a province's guard, a realm battle's winner and loser) all call it, passing their own
  thresholds and verbs, and a test passes its own dice. Each line names whom the company fought
  (`battleFacedClauses`, a map read from the deploy's grids right after the deploy, before the stay-or-retreat
  estimate faces the survivors afresh); the losses tally (`battleTallyLine`) reads a line's owner and unit
  type from the company named first in it, which is always the company's own reference.
- **Dice and the clock** (P1-07). Every random number the GM portal's code draws (dice, shuffles, bot choices, the
  world map, id suffixes) comes from `kcRng()` (`src/engine/rng.js`): one sfc32 generator, the first file of the
  page's main script, seeded once per page load from `crypto.getRandomValues`, or from the seed a test gives the page.
  Since P1-18d nothing in the engine or its views reads the clock: only the turn's shell does, through `kcClock()`
  (`src/engine/clock.js`, `Date.now()` when called), to stamp when the turn ran; the screens read `Date` as before.
  `dice-and-clock` keeps `Math.random` and `Date` out of the source, and `engine-purity` checks that a whole game
  reads neither ([traps.md](traps.md#dice-come-from-kcrng)). Each turn plays from its own seed (P1-18e): the shell
  (`runTurn`) draws a 32-bit integer from the page's dice, lends the turn the dice made from it (`kcRngStream(seed)`,
  through `kcRng.use`) for `resolveTurn` and again for `buildReports()`, gives the page its own dice back after each
  (never across an `await`), and returns the seed (`{…, seed}`), for P2-01 to record. A mercenary
  band made in a turn gets its id from `newMercId()` in `resolveTurn`: `merc_t<turn>_<n>`, counted afresh each turn,
  with no dice or clock in it (P1-18b).
- **Engine functions are lifted out of `resolveTurn` one area at a time** (P1-08). Some of the rule code is still
  nested inside it (the orders but the Move, the bots, the phase loop's own stages), and tests reach that by injecting code at exact source lines (see
  [tests/README.md](../tests/README.md#code-anchor-hooks)). A lifted helper that reads the turn's state takes **the
  turn's context** first: `turnContext`, made by `createTurnContext(G, freshPlayers, expectedTurnToRun)`
  (`src/engine/turn/context.js`) just after the save is parsed. It holds the state, `log` and the GM's log (`turnLog`),
  the collectors (`_tel`, `battleCommanders`, …), the movement pools (`movePoints`, `seaMovePoints`, …), `SEASONS`,
  `recruitedThisTurn`, `_intrusionAcc`, `_elvenEscapeQueue`, since P1-08d `presenceByPhase`, `clairWatch` and `_reports`, since P1-08e `_botPlayerIdx`, since P1-08i1 `_distCache`, since P1-08i3 `_warFrontAtStart` and `_warFrontProvs`, and since P1-08j1 `lightLandMoves` and `lightSeaMoves` (each joins by reference on the line after `resolveTurn` declares it), and the values the turn changes as it goes (`_logCtx`,
  `_currentPhase`, `_afterPhases`, since P1-08c `_combatSkillProv`, `_duelFoes`, `_battleSeq`, `_chieftainDuelGain`,
  `_deferredSkillLogs`, `_pcSimulating`, since P1-08i1 `enteredThisPhase`, and since P1-08i3 `_tier0Open` and `_unitGainQueue`), which are read and written as `turnContext._currentPhase` everywhere, in
  `resolveTurn` too. A helper that reads none keeps its own arguments. No dice and no clock in it yet (P1-08m). Lifted so
  far (P1-08a): the line helpers and the turn's records (`engine/turn/`), relations and captures
  (`engine/realms/relations-and-captures.js`), the title lookups and battle merit
  (`engine/titles/title-holders-and-battle-merit.js`), skills in play and hidden heroes
  (`engine/heroes/effective-skills-and-hidden-heroes.js`), the discovery helpers (`engine/discoveries.js`), `rng`, `pick`
  and `describeArmy` (`engine/dice-and-army-names.js`), and `pcFoeCat` (`engine/personal-combat/helpers.js`). P1-08b: terrain, sea and a unit's strength (`armStr`,
  `engine/battle/terrain-and-unit-strength.js`), sea lift, stranding and retreats
  (`engine/units/sea-lift-stranding-and-retreats.js`), the movement pools (`engine/units/movement-pools.js`), recruit
  limits (`engine/units/recruit-limits.js`), the best commander (`engine/battle/best-commander.js`), the intrusion
  warnings (`engine/turn/intrusion-warnings.js`), the Plague and the Bless ward (`engine/magic/plague-and-bless-ward.js`),
  `provName`, `provOf` and `neighborInDir` (`engine/world/map-helpers.js`), and `healFeatureMonsters`
  (`engine/chances-and-lair-grades.js`); the constants they read (`TERRAIN_MODS`, `HEX_DIRS`, `REIGN_OF_FEAR_MULT`, …)
  are top-level constants now, beside them. P1-08c: experience, skill rises and earned HP (`trySkillGain`,
  `engine/heroes/experience-skill-rises-and-earned-hp.js`, with `SKILLGAIN_STD` and `SKILLGAIN_COMMON`), battle report
  lines and force markers (`emitBattle`, `engine/battle/battle-report-lines-and-force-markers.js`), Evil Terror
  (`engine/battle/evil-terror.js`), the pre-battle spell choice (`engine/magic/pre-battle-spell-choice.js`), Blood Harvest
  and the Iron Throne (`engine/battle/blood-harvest-and-iron-throne.js`), Raid the Coast and landing parties
  (`engine/battle/raid-the-coast-and-landing-parties.js`), what a spy learns (`engine/espionage/what-a-spy-learns.js`),
  graves and fallen heroes (`engine/graves.js`), and `noteBattleLoss`
  (`engine/turn/mercenary-ids-and-battle-records.js`). P1-08d: every realm's report and the Spy-stealth rolls
  (`buildReports`, `engine/turn/realm-reports-and-spy-stealth.js`), which `resolveTurn` hands the shell wrapped with the
  turn's context. P1-08e: personal combat, the `pc*` family up to `resolvePersonalCombat`, in six files under
  `engine/personal-combat/` (speed, encounter plans and combatants; to-hit, wounds, stuns and courage; combat spells and
  guardian abilities; melee, flight and archery; tactics, combat items and each action; the fight), beside `helpers.js`;
  tests take them through `tests/lib/personal-combat.ts`. P1-08f: duels and character encounters (`resolveDuel`,
  `resolveCharVsChar`, the flee spoils, `engine/personal-combat/duels-and-character-encounters.js`), lair guardians and
  the Hunting Rumours odds (`resolveEncounter`, `pcBuildGuardian`, `simulateLairOdds`,
  `engine/personal-combat/lair-guardians-and-the-odds.js`), and hero death and leaderless hosts (`handleHeroDeath`,
  `reportHeroFall`, `disperseDeadCharArmies`, `engine/heroes/hero-death-and-leaderless-hosts.js`). P1-08g: a host's
  battle against a province's defenders with no realm's hero among them (`combatVsNPC`,
  `engine/battle/battles-against-province-defenders.js`, with the constants both battle paths read: the carry-on death
  scaling, the airborne-at-sea penalties, the narrative verbs, `BATTLE_ARMY_SPELLS`), and the duel before a battle
  (`preBattleDuel`, `engine/battle/pre-battle-duels.js`). P1-08h: the battle between two heroes' hosts (`combatVsChar`,
  `engine/battle/battles-between-heroes.js`). P1-08i1: the phase pipeline before anyone acts (`buildPhaseIntents`,
  `orderPhaseActors`, `applyMoveInterlocks`, with `PHASE_ACTION_MAP`, `engine/turn/phase-intents-and-dependency-ordering.js`),
  routes and distances (`provDistance`, `stepToward`, `stepTowardPreferSafe`, `engine/world/routes-and-distances.js`),
  the province bookkeeping and rallied garrisons (`reconcileProvinceCharacters`, `updateProvinceMemory`, `noteEntered`,
  `settleRalliedGarrisons`, `engine/world/province-bookkeeping-and-rallied-garrisons.js`), and
  `flushIntrusionNotifications` (beside the warnings it writes, `engine/turn/intrusion-warnings.js`). P1-08i2: the Defend
  watch (the ride-outs `runDefendReactions` and `runDefendMaterializedReactions`, `defendAnswerUnitGain` for a host
  raised next door, the lone hero's `runDefendAmbush`, `reconcileDefendRideOuts`, and the column hurried in,
  `runReinforcementArrivals`, `engine/units/defend-ride-outs-ambushes-and-reinforcements.js`). P1-08i3, the last phase
  helpers: stalled battles and a beaten guard's survivors (`resolveStalledBattles`, `erodeGuardSurvivors`,
  `engine/battle/stalled-battles-and-beaten-guards.js`), a host gained in a province (`resolveUnitGainInProvince`,
  `engine/battle/hosts-gained-in-a-province.js`), pursuits (`advancePursuit`, `pursuitCatchChance`, `endPursuit`,
  `engine/heroes/pursuits-and-the-catch-roll.js`), war fronts and stand-offs (`warFrontThreats`, `resolveWarFronts`,
  `flagEnemyStandoffs`, `engine/battle/war-fronts-and-enemy-stand-offs.js`), and `syncAllMaxHp` (beside the earned-HP
  helpers, `engine/heroes/experience-skill-rises-and-earned-hp.js`). P1-08j1, the first order taken out of `processOrder`
  (an extract, not a move: the case's body became a function, its own `break`s `return`s): the Move
  (`resolveMoveOrder(turnContext, c, ph, _fmSlip, target, prov, player)`,
  `engine/orders/move-order-marches-voyages-and-battles-on-arrival.js`), which takes, after the context, the values
  `processOrder` works out before its `switch` that it reads; `case 'move'` is the call and `break`. P1-08j2, the explore and search orders
  (`engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.js`), extracted the same way, each with only
  the values it reads: Explore (`resolveExploreOrder`), Perform Rite (`resolvePerformRiteOrder`), Hunting Rumours
  (`resolveHuntingRumoursOrder`), Search Lair (`resolveSearchLairOrder`), Chart the Unknown
  (`resolveChartTheUnknownOrder`) and Discover Lost Ruin (`resolveDiscoverLostRuinOrder`). P1-08j3, recruiting and
  hiring (`engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.js`: Recruit Armies,
  `resolveRecruitArmiesOrder`; Hire Hero, `resolveHireHeroOrder`; and `landHirePreOrders`, which lands the orders a realm
  wrote for a hero once he is sworn, moved out of `resolveTurn` beside them) and the realm's works
  (`engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.js`: Consecrate, Call to Arms,
  Broker, Harvest the Field, Awaken Grove, Wild Calling, Grand Design, and one function for the refusal of the removed
  Awaken the Wild and Call from the Pit, whose two `case` labels both call it). P1-08j4, research and practice
  (`engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.js`: Research, `resolveResearchOrder`;
  Practice Skill, `resolvePracticeSkillOrder`; Rest, `resolveRestOrder`; Research Breakthrough,
  `resolveResearchBreakthroughOrder`); a bot's Practice on a skill already at 5 is still switched in `processOrder`,
  before the call. P1-08j5, items and armies (`engine/orders/item-orders-equip-use-and-send-magic-items.js`: Equip
  Items, `resolveEquipItemsOrder`; Use Item, `resolveUseItemOrder`; Send Item, `resolveSendItemOrder`; and
  `engine/orders/army-orders-hand-over-garrison-disband-and-pick-up-companies-and-release-a-hero.js`: Leave/Transfer
  Army, `resolveLeaveOrTransferArmyOrder`; Release Hero, `resolveReleaseHeroOrder`; Disband Army,
  `resolveDisbandArmyOrder`; Pick Up Army, `resolvePickUpArmyOrder`); a spell item's Use Item still becomes a Cast Spell
  in `processOrder`, before the `switch`. P1-08j6, espionage
  (`engine/orders/espionage-orders-spy-steal-sabotage-grand-heist-assassinate-and-vanish.js`: Spy, `resolveSpyOrder`;
  Steal, `resolveStealOrder`; Sabotage, `resolveSabotageOrder`; Grand Heist, `resolveGrandHeistOrder`; Assassinate,
  `resolveAssassinateOrder`; Vanish, `resolveVanishOrder`; and the two helpers they share, nested in `processOrder`
  until then: `thiefCaughtScuffle` and `liftRandomItem`, each now a top-level function taking the context, then what it
  closed over of `processOrder`'s, then its own arguments). P1-08j7, Cast Spell
  (`engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.js`: `resolveCastSpellOrder`,
  the casting and every spell a hero can work as a phase order; and the helper a failed Charm calls, nested in
  `processOrder` until then: `charmBacklash`, with its constant `CHARM_BACKLASH_PCT` now top-level); the spell item's
  Use Item that `processOrder` turns into a cast arrives as its last argument (`_itemCast`). P1-08j8, the war orders
  (`engine/orders/encounter-and-defend-orders-chasing-a-hero-down-and-keeping-watch.js`: Encounter Character,
  `resolveEncounterCharacterOrder`, which sets the chase and takes its first step, the rest being `advancePursuit`'s in
  each later phase; Defend, `resolveDefendOrder`, which sets or keeps the watch the Defend family carries out; and
  `engine/orders/war-mastery-orders-challenge-rampage-volleys-tactics-blockade-and-coast-raids.js`: Blockade,
  Challenge, Rampage, Rain of Arrows, Sniper's Mark, Feigned Retreat, Grand Stratagem, Lightning Advance and Raid the
  Coast, one function each); the once-a-turn check before a mastery stays in `processOrder`. P1-08j9 moved `processOrder`
  itself out of `resolveTurn` (a move, as rows a to i3 moved functions: `processOrder(turnContext,c,o,ph)`,
  `engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.js`): the checks before any order (a hero
  carried into another's assault, the bots' Practice and Search switches, the battle lock, a charmed hero's refusals,
  a mastery once a turn, the Forced March, a spell item's cast), then the `switch` that calls each order's function;
  the phase loop calls it for each hero in each phase. P1-08k1 took the phase loop's four stages out of
  `resolveTurn` as functions of their statements, in
  `engine/turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.js`: the start of the phase
  (`startPhaseHealingSnapshotsAndStalledBattles`), intents and reactions (`pinAndReactToPhaseIntents`), the orders in
  two tiers around the Defend step (`resolvePhaseOrdersInTwoTiersAroundTheDefendStep`) and the end of the phase
  (`endPhaseSkillRisesFallenCommandersAndProvinceMemory`); the loop keeps the phase, where each hero stood as it began,
  the intents, Early Winter and the province lists' check. P1-08k2 took Early Winter out the same way, the body of the
  loop's `if(ph===4){…}`, in `engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.js`
  (`earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill`, taking only the context): a charmed hero goes home,
  then the taxes, the wages (and what a realm that can't pay loses), Raiders' Muster and the garrison drill. A lifted helper keeps `resolveTurn`'s indent. Tests call one directly in Node: `engineFn`, `turnContext` and `botWorld` in
  `tests/lib/engine.ts` ([traps.md](traps.md#a-lifted-helper-takes-the-turns-context-first)).

## The database (Supabase)

The structure is in `supabase/` (since P0-15): `supabase/schemas/` is the desired state, one file per
table with its access rules, and `supabase/migrations/` the changes that build it
([supabase/README.md](../supabase/README.md)). Merging a migration to `main` applies it to staging, then to
production once Toby approves, and only then deploys the site
([supabase/README.md](../supabase/README.md#how-a-migration-goes-live)). The GM portal carries no SQL (its
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

## Version stamps

Each page carries a New Zealand-time build stamp (`YYYY.MM.DD-HHMM`) in its footer. The GM portal also
has it in `KC_BUILD_STAMP`, which telemetry rows record. The data file carries two stamp lines: the
`// Data file v…` comment and `KC_DATA_STAMP`. Since the cutover, git history is the version record,
but the stamps still drive the data-file guard and the GM tab's auto-reload, so keep bumping them, both
copies each time ([traps.md](traps.md#the-gm-portals-two-build-stamps),
[traps.md](traps.md#the-data-file-stamp-guard)).

## Staging

A second copy of the site at <https://kingdoms-call-staging.github.io/>, with its own Supabase project and
no real players. A pull request labelled `staging` is tested; then the staging database is rebuilt for it
(emptied, `main`'s migrations, the test accounts, the made-up games of `supabase/seeds/staging.sql`, then the
pull request's own migrations and the seed again: `.github/scripts/migrations.js reset staging`); then the
site is built and published there with a `kc-config.js` pointing at the staging database
(`.github/workflows/staging.yml`). One pull request is on staging at a time, and its PR comment says so;
merging changes nothing there. That `kc-config.js` also carries `deployed: {pr, sha}`, so every page's
footer says which pull request and commit is on staging, linking to the pull request.

## Tests

`npm test` boots the real pages in jsdom against an in-memory Supabase stand-in, with seeded dice (`kcRng`) (and,
where a test asks, a pinned clock). It runs whole all-bot games through the real `runTurn`. What only a real browser
shows (layout, which requests a page makes, an image's onerror really firing) is in the browser specs:
`npx playwright test` opens the pages in Chromium, served from one folder as deployed.
[tests/README.md](../tests/README.md) lists every test, its level and its origin.

The tools are the standard ones (P1-01): Vitest runs every test, one project per level (`vitest.config.mts`);
Playwright Test runs the browser specs in `tests/browser/` (`playwright.config.ts`); TypeScript checks the new files
strictly (`npm run typecheck`, `tsconfig.json`); ESLint with typescript-eslint lints them (`npm run lint`,
`eslint.config.js`); Prettier formats them (`npm run format`). Node is pinned exactly (`.nvmrc`, `engine-strict` in
`.npmrc`), and Dependabot proposes updates weekly (`.github/dependabot.yml`). The site's own JavaScript in `src/` isn't
linted or formatted yet: P1-09 makes it TypeScript, and Prettier formats it then. The one exception is the engine's
(`src/engine/`, `src/views/`), which gets ESLint's `no-undef` (P1-08a). Its globals are worked out when ESLint starts,
from the engine's files and the data file: a helper lifted out of `resolveTurn` that still reads a name from its closure
fails the lint, not the turn that first calls it.

The harness runs itself (P1-01b). Claude Code hooks, committed in `.claude/settings.json`, check each edited file
(`tools/hooks/after-edit.ts`: type check, ESLint, Prettier, about 1 s) and run `npm run check` before an agent may
finish (`tools/hooks/before-stop.ts`). `npm run check` (`tools/check.ts`) checks what the branch changes: the
TypeScript tests that import a changed file (`vitest related`), or every level but page when anything else changed,
since the test scripts load `site/` (built from `src/`) by file name and `vitest related` can't follow that. `npm run ratchet`
(`tools/ratchet.ts`) keeps the counts in `tests/ratchet.json` from rising: switched-off checks, allowlist entries,
JavaScript files, quarantined tests and tests on `tests/lib/stub-db.js`. `tests/static/harness.test.ts` fails if any
of these settings, or the strict compiler and lint settings, is missing or weakened, and every harness file is a
dangerous path.

The balance matrix (`npm run balance`, `tools/balance/`, P1-02a) measures engine changes: 60 seeded games played in
the GM portal (48 all-bot, 12 with a realm whose orders the runner writes), each game's per-turn hashes and
statistics compared with the committed baseline in `tests/balance/baseline/`, statistics paired by seed against the
noise of a second seed set. One of the hashes is of every write the turn sends to the stand-in database
(`tools/balance/writes.ts`, P1-02c), so a change to how a turn saves shows even when nothing in play changed. After every turn it checks the **invariants** (`tests/lib/invariants.ts`, P1-04b: no NaN or
`undefined`, HP in range, unique ids, items matching the ledger of found items, armies on the map, the dead taking no
actions, `orders_submitted` cleared), as `turn-fuzz` does, and the **report-leak check** on the scripted realm's report
(`tests/lib/report-leaks.ts`, P1-04c: another realm's private line, an unmet realm, a hero under Invisibility); a breach
fails the game. It isn't part of `npm test`: about 20 s on 14 cores ([tests/README.md](../tests/README.md#the-balance-matrix)).
CI's `balance` job (P1-02b) plays it when a pull request or a merge changes an engine path
(`tools/balance/engine-paths.ts`: the files in `src/` that the GM portal's page and the scripts it loads are built
from, the build itself, the balance code and baselines, the test helpers it boots the page with, and `package-lock.json` and `.nvmrc`, since a jsdom or Node
bump can change the games), and fails if any game differs from the committed baseline.
A pull request labelled `refactor-only` fails if it changes the baseline at all. On a pull request the job also
makes the **balance report** (`tools/balance/report.ts`, P1-03a): the class of change (no change, wording only, writes only, a
reshape judged as a whole, or a rule change judged by where games first differ and by its slices), in game terms. The
job can only read, so it uploads the report as data; `.github/workflows/balance-report.yml`, run when CI finishes,
posts it as one comment with the default branch's `tools/github/balance-comment.ts`, never the pull request's code.
**Named scenarios** (`npm run balance -- <scenario>`, `tools/balance/scenario.ts`, P1-03c) answer a focused question
("how often do these archers beat those guards in the hills?"): a scene staged in `tests/balance/scenarios/` through
`tests/lib/scenario.js`, played 400 times on a copy of `main`'s site and on the branch, paired by seed and judged by
the same noise rule, labels and words as the report. Run by hand, not in CI.

CI runs it all on every pull request, in jobs side by side so the fastest failure shows first
(`.github/workflows/ci.yml`, P1-01c): the static checks (type check, lint, format, ratchet, the static tests), the
unit and scenario tests, the simulations, the page tests, the browser specs, the balance matrix, and `db` (the access-rule tests and
`supabase db lint`, which checks the database's functions). The job named `ci` passes only when every job but `db`
passed; `ci` and `db` are the checks `main` requires. `deploy.yml` runs the same workflow before it publishes.
Every night `.github/workflows/nightly.yml` (P1-04d) runs `npm run test:full` (the fuzz, the invariants, the leak check
and the property tests at full size) with a random seed it prints; a red night blocks nothing.
