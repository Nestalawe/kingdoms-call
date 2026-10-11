# Tests

```sh
npm test                    # standard run (about a minute)
npm run test:full           # bigger fuzz runs
npm run test:quarantine     # the quarantined harnesses below (expected to fail)
npm test -- --only fuzz     # only tests whose name contains "fuzz"
npm test -- --seed 123      # another fixed seed (the default is printed at the start)
npm test -- --only concede --seed 123   # reproduce one failure exactly (same seed and sizes)
node tests/<name>.test.js   # one test on its own (unseeded, its own default sizes)
```

`tests/run.js` runs each test as its own Node process; a test passes when it exits 0. On a failure
it prints the end of that test's output and the seed to repeat it with.

## How the tests reach the site

- **`lib/boot.js`** is the one way to load a page from `site/`:
  - `readPage` returns the page with `kingdoms-call-data.js` inlined and the Supabase CDN tag removed;
  - `bootJsdom` boots it in jsdom;
  - `serve` and `routeExternal` do the same for Chromium (Playwright): the pages are served from one
    folder, as deployed; the CDN gets a stub and the fonts get nothing.
  - every stand-in database answers `rpc('kc_db_version')` with `DB_VERSION`, the newest migration in
    `supabase/migrations/`, so pages pass their database version guard (P0-34). `bootJsdom`'s
    `opts.dbVersion` sets another answer (an older version, `null` for a missing function, `'offline'`, or a
    list used in order) and `opts.dbCalls` records the page's database calls.
- **`lib/scenario.js`** stages one real turn on a small world for scenario tests: it boots the GM
  portal (with any code-anchor hooks), lets the test edit a fresh world, gives every human-held
  character its orders (Rest by default), runs `runTurn` and returns the saved world and the GM's log.
- **`lib/stub-db.js`** holds every Supabase stand-in the tests use. Nothing connects to a real
  database. The harnesses were written with five different stubs; each is kept exactly as it
  behaved, so moving a harness onto the shared file didn't change what it sees.
- **Fixed seed.** `run.js` sets `KC_SEED`. `boot.js` then replaces `Math.random` with a seeded
  generator (sfc32), both in the test process and in every jsdom page. So a run's random choices
  repeat with the same seed. Time (`Date`) is not pinned yet, so runs are repeatable in practice but
  not guaranteed byte-identical. The Chromium tests are not seeded.
- **`KC_SITE=<folder>`** points every test at another copy of the site, e.g. a deliberately broken
  one to prove a check fails.

## The tests

Level is from the testing strategy: 0 static, 1 unit, 1d database unit (pgTAP, from P0-16), 2 scenario,
3 simulation, 4 page.

The level-1d tests aren't in this folder or in `run.js`: they're in `supabase/tests/`, one file per
table, and run in CI's `db` job ([supabase/README.md](../supabase/README.md#the-access-rule-tests)).

The original files are the harnesses kept in the claude.ai Project on 27 Sept 2026. When they moved
here, only their plumbing changed:
- file paths now point at `site/`;
- the Supabase stub comes from `lib/stub-db.js`;
- pages are booted through `lib/boot.js`;
- Chromium is Playwright's own build, and servers use free ports.

None of their checks changed. Every one gave the same pass or fail before and after the move.

| Test | From | Level | Status | Checks |
|---|---|---|---|---|
| `syntax` | new | 0 | ✅ pass | Every inline script in every page, and `kingdoms-call-data.js`, parses |
| `docs` | new | 0 | ✅ pass | Every relative link and heading anchor in `CLAUDE.md`, `README.md`, `docs/`, this file and the PR template resolves; every `site/`, `tests/`, `tools/` or `.github/` path they name exists; `CLAUDE.md` stays under 200 lines |
| `stamps` | new | 0 | ✅ pass | The stamps written twice agree: the data file's `// Data file v…` comment and `KC_DATA_STAMP`; the GM portal's footer and `KC_BUILD_STAMP`, with no other `GM Portal v…` above the footer |
| `config` | new | 0 | ✅ pass | The database address and public key live only in `site/kc-config.js`; no page types them in, and every page that creates the database client loads `kc-config.js` first |
| `db-min` | new | 0 | ✅ pass | Every page that uses the database declares `KC_DB_MIN`, loads `kc-db-guard.js` and starts through `kcDbGuard(sb, KC_DB_MIN)`; no `KC_DB_MIN` is newer than the newest migration (P0-34) |
| `sql-banners` | new | 0 | ✅ pass | The GM portal carries no SQL for the GM to paste: no `KC_*_SQL` string, no "SQL Editor" instruction, no paste box (P0-17: the database changes only through migrations) |
| `workflow-api-auth` | new | 0 | ✅ pass | Every call a workflow makes to GitHub's API is signed in with the job's token (unsigned calls share a small hourly limit and fail at random with 403, as the staging deploy did on 2026-10-10) |
| `sort-comparators` | new | 0 | ✅ pass | No `.sort(...)` in the site uses a random or argument-less comparator (its result, and how many random numbers it uses, would depend on the browser's JavaScript engine); shuffles go through `shuffleP` |
| `dangerous-paths` | new | 1 | ✅ pass | Which changed files count as dangerous (globs, case ignored, renames by their old name too) and what the warning comment says |
| `staging` | new | 1 | ✅ pass | The staging deploy's logic: the `kc-config.js` it writes (staging address only, never the live one, no stray characters; the pull request number and full commit it deploys, refused unless they're exactly that), its "on staging" / "replaced by" comments, and the test accounts (made up, on a reserved domain; signed up then signed in with the shared password; one that exists is skipped; a failure stops the deploy without printing the password; the staging seed uses only their addresses) |
| `staging-footer` | new | 4 | ✅ pass | With the staging deploy's `kc-config.js`, every page's footer says "Staging · PR #21 · abcdef1", linking to the pull request (in the page's `<footer>`, or a small fixed stamp where it has none); with the live one, nothing shows; on a page that uses the database it also names the database's version; a malformed `deployed` shows nothing and injects no markup |
| `migrations` | new | 1 | ✅ pass | The migration pipeline's logic: a merged migration never changes and new ones are named and ordered; a pull request never changes both the database and the site; each database gets only the migrations Toby was shown before approving (anything else is refused); a database that predates the pipeline has its baseline recorded, never run; an empty one is refused; the summary Toby reads (production, then the site: staging isn't migrated on a merge); a failed CLI call never prints the database password; a staging rebuild (`reset staging`) refuses any target but staging, the live project however it's named, and any database that isn't the staging project; a connection failure says the free project may have paused; its summary; and the whole rebuild run against a stand-in CLI giving the real CLI's answers (JSON, except `DO` for the seed), every step in order |
| `landing-footer` | new | 0 | ✅ pass | The landing page's footer reads "Kingdoms Call · A Strategy Game of Simultaneous Turns" |
| `unit-type-words` | new | 0 | ✅ pass | The five unit-type words (infantry, ranged, cavalry, flyer, naval) are the ones players read: every roster row's Type cell in the rulebook, a row for every recruitable unit, the roles table and the intro's list use them; the player portal's blurbs, the archery-phase report lines and the Hall of Fame say "ranged", not "missile"; the four rulebook slips of 2026-10-11 stay fixed (Gilded Lances' ride-down, Gyrocopters' Druid, Levies' Shieldwall, Wardens as infantry) |
| `battle-lines-words` | new | 0 | ✅ pass | The front the ground allows is written three times and must agree: every width a rulebook (comprehensive and intro) claims for a terrain is that terrain's range in the engine's `BATTLE_FRONT_RANGE`, every terrain is claimed, and the old fixed-width wording (6 / 4 / 3, "four lines", flyers "always … from the front") is gone; every facing multiplier in `BATTLE_FACING` appears in the rulebook's "Who faces whom" step and the intro says units fight the enemy opposite; both rulebooks say the better-explored side lines up second and the rulebook's "The line-up" step ties the swaps to Tactical |
| `volley-thirty-words` | new | 0 | ✅ pass | The volley's size is written three times and must agree: `MISSILE_SHOT_PCT` is 0.30 in the GM portal's source, and the rulebook's Archery text and the player portal's archery blurb say "30% of the shooting unit" (the constant sits inside `runTurn`, so no unit test can read it) |
| `volley-thirty` | new | 2 | ✅ pass | In a real battle, one Elite Longbow company (base 20) under a hero with no Archery shoots a neutral guard's lone Elite Dwarven Guard for 6, 30% of its strength (it was 4 at 20%); the archery total says the same |
| `unit-types` | new | 1 | ✅ pass | `KC_UNIT_TYPE` names one of the five types for every unit with a base strength and agrees with the engine's class lists (cavalry, sea → naval, aerial → flyer, missile → ranged with Goblin Horde as infantry, garrison → infantry); both portals demand the table from the data file and their `unitTypeOf` helpers answer `infantry` for an unknown type |
| `battle-grid` | new | 1 | ✅ pass | The battle grid (`battleGrid`, module level): roles by unit type (winged riders fly, cavalry, ranged, everything else foot); ranged units behind a fighter shoot over it at ×1 and fill an empty front place at ×0.75; spare units ×0.5 / ×0.25 / ×0.125 (sd09 lifts them); Tactical+1 cavalry on the flanks of plains and desert only; winged riders capped at the enemy's units in line and in the air, never below 2; hulls hold a sea front and no flank exists there; the width roll stays in its terrain's range and `battleFrontWidth` is the middle; the grid print and the ladder stage |
| `battle-facing` | new | 1 | ✅ pass | Who faces whom (`battleFacing`, module level): a front unit against the enemy opposite by role (cavalry v ranged ×1.25, cavalry v infantry ×0.85, infantry v cavalry ×1.15, infantry v ranged-in-front ×1.25); a second-line ranged unit shoots the unit opposite (infantry ×1.25, cavalry ×0.75); a wider front wraps the ends ×1.2 and the wrapped ends are hit from the side ×0.9; flank duels, a spare rider guarding an end, a free rider ×1.3 turning an unanchored line on open ground (second-line ranged ×0.75); no front to face; the sea; the `_faced` stamps and the ladder stage |
| `battle-scout` | new | 1 | ✅ pass | The scout's advantage and the line-up (`battleDeploy`, module level): the higher exploration scouts (ties to the defender); the width on offer is the roll and one either side within the terrain's range; the scout takes the width that suits it; it lines up second with improving swaps; the commanders then take turns, the other side first, one swap per Tactical level; a legal swap keeps the front one block of the same kinds; the two report lines; determinism; twenty deploys of 12 v 12 stay under 4 s |
| `boot-pages` | new | 4 | ✅ pass | Every page boots in jsdom with no error, rejection or `console.error` |
| `db-guard` | new | 4 | ✅ pass | Both portals and the Hall of Fame ask the database its version before anything else: up to date → they boot; older than `KC_DB_MIN`, no `kc_db_version`, or no answer twice → they stop with "The game is being updated" and a Reload button, having made no other database call; no answer once → they ask again and boot (P0-34) |
| `meta-missing-turn` | new | 2 | ✅ pass | With the `games.meta` column hidden in the in-memory database, the GM portal notices, says so, and a turn still resolves and saves without writing it. The example to copy for site code that must cope without its database change ([supabase/README.md](../supabase/README.md#database-and-site-changes-go-separately)) |
| `turn-fuzz` | `claude_turnfuzz_0927.js` | 3 | ✅ pass | Whole games through `runTurn` with random orders and live bots: no crash, failed run or stuck "orders submitted" flag. 4 games × 6 turns (full: 16 × 12) |
| `home-placement` | `claude_homeplacement_0927.js` | 1 | ✅ pass | Capitals are at least 4 hexes apart on every map size |
| `druid-and-war-spoils` | `claude_fuzz_0927b.js` | 1 | ✅ pass | Unit classes, the Druid ladder, and the Orc war-spoils halving |
| `flyers-soldiers` | new | 1 | ✅ pass | The winged riders are soldiers of their race: Eagle Riders, Noble Griffons and Wyvern Riders are in no Creature, Monster, tamed-flyer or Awaken-the-Wild table, sit at Druid 1 with the other racial troops (`getDruidLevel` and the player portal's `DRUID_LEVEL_OF_P` say 1), and `primalStrikeChance` gives their strikes a flat 50% while a beast's still runs 30% + 10% a level to 90 |
| `flyers-soldiers-words` | new | 0 | ✅ pass | The rulebook's roster gives the three riders their race and no Druid; its Druid ladder, mastery example, strike sentence and Druidic creed name no rider; the player portal's Druidic text, Creature key and the Griffon and Wyvern blurbs agree |
| `roster` | new | 1 | ✅ pass | The army roster as decided (`tests/lib/roster-decided.js`): every humanoid unit's type, cost, base strength, move rate and terrain multipliers, read from the data file and from the GM portal's own tables (`ARMY_COST_MASTER`, `ARMY_SPEED_MASTER`, `TERRAIN_MODS` and the item class sets, sliced from the source); the four new units (Men-at-Arms, Stag Riders, Ironhoof Rams, Black Arrows) in every table keyed by unit, with their company names and province cells appended after the old ones; the goblins' spears gone from the missile list and the Berserkers' Outnumbered and Uncaring gone from `unitAbilityMult` (booted portal); both portals type and Druid-rate the new units |
| `roster-words` | new | 0 | ✅ pass | The rulebooks say what the tables say: the roster rows (race, type, cost, strength, move, terrain cell), the home-roster and move-rate tables, the kinds-of-unit examples, the light-foot list, the March example and the recruit-cap sentences in both books, all against the same decided table; the player portal names the new units; no page keeps a retired rule |
| `goblins-two-a-turn` | new | 2 | ✅ pass | A province that raises Goblin Hordes turns out two in one turn and refuses a third; Orc Berserkers there stay at one; the order form's `maxPerTurn` (`buildTurnReport`) says the same. Level 2 because `getRecruitLimit` and the recruit order live inside `runTurn` |
| `leaderboard-records` | `claude_leaderboard_0927.js` | 1 | ✅ pass | The Hall-of-Fame record builder never throws and always gives a storable row, even on malformed input (since 2026-10-09 each record is a list with one entry per realm, as Toby confirmed) |
| `leaderboard-render` | `claude_lb_render_0927.js` | 4 | ✅ pass | The Hall of Fame renders every tab, filter and GM control from real built rows |
| `leaderboard-events-paging` | new | 1 | ✅ pass | A game's Hall-of-Fame record is built from every one of its turn rows, read in pages in a fixed order (none skipped or read twice); a page that fails stops the build, saves nothing and shows the error |
| `leaderboard-realm-bests` | new | 1 + 4 | ✅ pass | Every realm's own best for each record is kept (not only the game's best), best first; a hero who fell that turn still counts for his peaks; a title held and then lost is recorded; on the board (jsdom), searching a realm shows only that realm's entries |
| `battle-spells-recorded` | new | 2 | ✅ pass | A spell worked in a battle reaches the turn's spell statistics; a hero who fell this turn is in his realm's end-of-turn snapshot, not among the living; every title holder's snapshot carries the title |
| `concede` | `claude_concede_0927.js` | 2 | ✅ pass | A conceded realm in the Diplomacy card; the Reckoning when all rivals but one have quit |
| `monarch-grave` | new | 1 | ✅ pass | A fallen king's body stays where it was laid at death, even after that province is captured: the Resurrect list, the older body list and the bots' raise planner all put it there |
| `guardian-melee` | new | 2 | ✅ pass | Every guardian's melee blow rolls its grade's base (Weak 1–3, Moderate 2–5, Powerful 3–7, Legendary 4–9) + ⌈Melee÷2⌉, a hero's stays 1–3 + ⌈Melee÷2⌉; a "−1 melee for next round" special lowers the hero's Melee for exactly one round |
| `guardian-traits` | new | 2 | ✅ pass | No guardian's card resists and is weak to the same thing, and no hidden category multiplier pushes against a trait on the card |
| `hit-cap` | new | 2 | ✅ pass | No single hit in personal combat takes more than half the target's maximum HP: guardian on hero, hero on guardian, hero on hero; a Legendary's tighter 20% cap still wins |
| `move-points` | new | 2 | ✅ pass | Taking an undefended enemy province costs 1 movement point; pressing on with a battle against neutral defenders costs 1 a phase while points remain |
| `overtures` | new | 2 | ✅ pass | An overture of peace or alliance makes the courted realm meet the sender and shows on its Diplomacy card; in a game of three realms or fewer an impossible alliance offer is not sent |
| `pursuit-one-battle` | new | 2 | ✅ pass | A chase (Encounter) obeys one battle per phase: a hunter attacked by his quarry first holds the chase over and stays where he is. A chase battle the hunter wins takes the province (or says why it is still contested) |
| `warg-run-down` | new | 2 | ✅ pass | Warg Riders' Run Them Down: a warg-heavy victor's beaten foe takes +15% rout losses, no chase follows, and the general obeys his own next order |
| `battle-lines-report` | new | 2 | ✅ pass | In a real turn, a realm battle and a province battle each report the front the ground allows (within the terrain's range), draw a 📊 grid line per side with the attacker's Longbows behind its Levies and its cavalry on the flank of open ground, and give the ladder its Battle-lines and Who-faces-whom stages, the latter ending on the strength the header names; each report says who scouted and that the front it chose is the one drawn; no undefined/NaN |
| `retreat-dry-ground` | new | 1 | ✅ pass | A beaten force never falls back into a Flooded province, and onto sea laid dry by Part Sea only when no ordinary land is open to it (foot, flyers, and the naval split's march inland) |
| `hire-price` | new | 4 | ✅ pass | A seasoned wanderer's hire price (alignment rate + skill premium) is the same in the report, the hire data, the Hire Hero dropdown, the Broker list and the order ledger |
| `defend-naval-overland` | new | 2 | ✅ pass | A general on Defend whose column has ships never rides overland to a neighbouring land province, whether the enemy marches in or is already standing there |
| `defend-once` | new | 2 | ✅ pass | A Defend order is done once it has brought its general to battle (win or lose): no ride-out in a later season without a fresh Defend order, and the battle season's own Defend order does not re-arm it; a fresh Defend order for a later season does |
| `hp-wound-gain` | new | 1 | ✅ pass | After a personal fight every wounded hero who lives rolls for maximum HP, the winner rolls once (the win award, not a wound roll too) and gains the roll +1, and every roll gains (even past 50 HP) |
| `hero-every-phase` | new | 2 | ✅ pass | A hero pulled into a friendly hero's Fall assault on a neutral-guarded province (Contingent unify) has a Fall line of his own pointing at the battle; every living hero has at least one line in every season of his realm's report |
| `orders-group-by-location` | new | 4 | ✅ pass | The orders column's "Group by location" button groups heroes by province (keeping each hero's parked cards with it and remembering the order); "Collapse all" / "Expand all" fold and open every hero |
| `naval-retreat` | `claude_navalretreat_0927.js` | 2 | ✅ pass | The naval retreat split, staged cases plus 4,000 fuzzed retreats |
| `npc-parity` | `claude_npcparity_0927.js` | 2 | ✅ pass | Elf Ambush and Shield Fort fire against neutral garrisons, and only where they should |
| `report-privacy` | `claude_reportleak_0927.js` | 3 | ✅ pass | No realm's private report line reaches a second realm, over all-bot games |
| `fuzz-wages-combat` | `claude_fuzz_0927c.js` | 3 | ✅ pass | All-bot turns and personal combat: no crash, no NaN/undefined in the narrative; Orc wage discount stays a whole, non-negative number |
| `fuzz-advance-masking` | `claude_fuzz_0927d.js` | 3 | ✅ pass | Advance-and-strike combat, masking of unmet realms, archive round-trip |
| `chromium-boot` | `claude_lb_chromium_0927.js` | 4 | ✅ pass | GM portal, player portal and Hall of Fame boot in real Chromium; links and footers present |
| `orders-buttons-visible` | new | 4 | ✅ pass | In real Chromium, Save Draft and Submit Orders stay on screen over a long orders form, at the top and part-way down, on desktop windows and a phone |
| `map-fits-panel` | new | 4 | ✅ pass | In real Chromium, an 8×7 map fits whole inside the desktop map panel (after switching the panel to Report and back), the legend stays inside the panel, and the zoomed (desktop) or phone map scrolls both ways down to its bottom row |
| `dispatches-badge` | new | 4 | ✅ pass | In real Chromium, the unread count on the left panel's ✉ Dispatches tab appears as soon as the player switches view (Map → Report) or comes back to the browser tab, and clears once Dispatches is opened |
| `gm-messaging-boot` | `claude_msg_gm_boot_0927.js` | 4 | ✅ pass | GM portal boots; while the dispatches tables are missing, a plain error message (no SQL to paste, since P0-17) appears, and it goes once they exist; deleting a game clears its dispatches first |
| `quarantine/dispatches-e2e` | `claude_msg_e2e_0927.js` | 4 | ⏸ quarantined | 70 of 71 checks pass. It expects left-panel tabs Map + Dispatches; the player portal now also has a Report tab |
| `quarantine/one-source` | `claude_onesource_0927.js` (+ `claude_onesource_manifest_0927.json`) | 4 | ⏸ quarantined | Needs the pre-refactor build of 27 Sept in `quarantine/before/` (or `KC_BEFORE_DIR`). A one-off proof for that refactor |
| `quarantine/one-source-chromium` | `claude_chromium_onesource_0927.js` | 4 | ⏸ quarantined | The "good" and "missing data file" cases pass; the "stale data file" case needs the same pre-refactor build |
| `quarantine/set-scan` | `claude_setscan_0927.js` | 0 | ⏸ quarantined | Report-only: always exits 0. On today's build it lists 40 suspect `Set`/array mix-ups, mostly the same name used in different places. The two `Set`-with-`.includes()` hits were checked by hand and are false positives. Needs triage before it can gate |

**Quarantined** tests are not part of `npm test`. Each file's first line says why. They are kept
unchanged, never edited to pass. A quarantined test comes back only when the reason no longer
applies: e.g. the expected tabs are confirmed and the test is updated in its own PR.

**Two harnesses can't fail on their own findings.** `set-scan` always exits 0. `home-placement`
prints `FAIL` for a too-close capital but only exits non-zero when it throws (duplicate home cell,
home on an edge row). Both are kept as written.

**Not brought over as tests:**
- `claude_stub_db_0927.js` and `stub_supabase_0927.js` are now part of `lib/stub-db.js`.
- `claude_jsdomboot_0927.js` became `lib/boot.js`.
- `claude_unitexport_0927.js` and two Python scripts are content tools, now in `tools/legacy/`.
- Two SQL scripts from the same source are not included; database tests come later.

## Code-anchor hooks

Until the engine is split into modules, some tests reach inside the GM portal by matching exact
lines of its source. If one of these lines changes, the test fails with "anchor" or "missing" in its
message. That means the hook needs updating, not that the game is broken.

| Test | Anchor in `kingdoms-call-gm-portal.html` |
|---|---|
| `fuzz-wages-combat`, `fuzz-advance-masking`, `naval-retreat`, `npc-parity`, `guardian-melee`, `guardian-traits`, `hit-cap`, `retreat-dry-ground`, `hp-wound-gain` | `  // 4. Run all 5 phases` (exposes nested `runTurn` functions) |
| `concede`, `report-privacy`, `overtures` | `const activePlayers=freshPlayers.filter(p=>p.user_id);` (writes reports for bot realms too) |
| `pursuit-one-battle` | `    const chance=pursuitCatchChance(c,quarry);` (stages a certain catch) |
| `move-points` | `  const seaMovePoints={};     // separate sea move point pool (REMAINING this turn)` (exposes the movement-point pools) |
| `battle-spells-recorded` | `  const _tel={pre:{}, orders:{}, battles:[], encounters:[], captures:[], deaths:[], spells:[], hires:[], recruits:[]};` (exposes the turn's statistics collector) |
| `leaderboard-records`, `leaderboard-render`, `leaderboard-realm-bests` | `const _LB_SEA=new Set(` … `// Fetch this game's turn_events` |
| `home-placement` | `  const cellIdRC=(r,c)=>r*cols+c;`, `  const eligibleCells=[];` and their end lines |
| `druid-and-war-spoils` | the start and end of nine tables and functions (see the `slice(` calls) |
