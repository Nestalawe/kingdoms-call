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
| `dangerous-paths` | new | 1 | ✅ pass | Which changed files count as dangerous (globs, case ignored, renames by their old name too) and what the warning comment says |
| `landing-footer` | new | 0 | ✅ pass | The landing page's footer reads "Kingdoms Call · A Strategy Game of Simultaneous Turns" |
| `boot-pages` | new | 4 | ✅ pass | Every page boots in jsdom with no error, rejection or `console.error` |
| `turn-fuzz` | `claude_turnfuzz_0927.js` | 3 | ✅ pass | Whole games through `runTurn` with random orders and live bots: no crash, failed run or stuck "orders submitted" flag. 4 games × 6 turns (full: 16 × 12) |
| `home-placement` | `claude_homeplacement_0927.js` | 1 | ✅ pass | Capitals are at least 4 hexes apart on every map size |
| `druid-and-war-spoils` | `claude_fuzz_0927b.js` | 1 | ✅ pass | Unit classes, the Druid ladder, and the Orc war-spoils halving |
| `leaderboard-records` | `claude_leaderboard_0927.js` | 1 | ✅ pass | The Hall-of-Fame record builder never throws and always gives a storable row, even on malformed input |
| `leaderboard-render` | `claude_lb_render_0927.js` | 4 | ✅ pass | The Hall of Fame renders every tab, filter and GM control from real built rows |
| `concede` | `claude_concede_0927.js` | 2 | ✅ pass | A conceded realm in the Diplomacy card; the Reckoning when all rivals but one have quit |
| `monarch-grave` | new | 1 | ✅ pass | A fallen king's body stays where it was laid at death, even after that province is captured: the Resurrect list, the older body list and the bots' raise planner all put it there |
| `guardian-melee` | new | 2 | ✅ pass | Every guardian's melee blow rolls its grade's base (Weak 1–3, Moderate 2–5, Powerful 3–7, Legendary 4–9) + ⌈Melee÷2⌉, a hero's stays 1–3 + ⌈Melee÷2⌉; a "−1 melee for next round" special lowers the hero's Melee for exactly one round |
| `guardian-traits` | new | 2 | ✅ pass | No guardian's card resists and is weak to the same thing, and no hidden category multiplier pushes against a trait on the card |
| `hit-cap` | new | 2 | ✅ pass | No single hit in personal combat takes more than half the target's maximum HP: guardian on hero, hero on guardian, hero on hero; a Legendary's tighter 20% cap still wins |
| `move-points` | new | 2 | ✅ pass | Taking an undefended enemy province costs 1 movement point; pressing on with a battle against neutral defenders costs 1 a phase while points remain |
| `overtures` | new | 2 | ✅ pass | An overture of peace or alliance makes the courted realm meet the sender and shows on its Diplomacy card; in a game of three realms or fewer an impossible alliance offer is not sent |
| `pursuit-one-battle` | new | 2 | ✅ pass | A Warg Riders chase obeys one battle per phase: a hunter who has just fought (even as the defender) holds the chase over, stays where he is, and his report says why his Move order waited. A chase battle the hunter wins takes the province (or says why it is still contested) |
| `retreat-dry-ground` | new | 1 | ✅ pass | A beaten force falls back onto a Flooded province or sea laid dry by Part Sea only when no ordinary land is open to it (foot, flyers, and the naval split's march inland) |
| `hire-price` | new | 4 | ✅ pass | A seasoned wanderer's hire price (alignment rate + skill premium) is the same in the report, the hire data, the Hire Hero dropdown, the Broker list and the order ledger |
| `wanderer-orders` | new | 2 | ✅ pass | A Charm aimed at a wanderer whom another realm hires first is not worked (no seizure, no fight); an Encounter never names a wanderer, nor a hero who was one when the turn's orders were given |
| `defend-naval-overland` | new | 2 | ✅ pass | A general on Defend whose column has ships never rides overland to a neighbouring land province, whether the enemy marches in or is already standing there |
| `defend-once` | new | 2 | ✅ pass | A Defend order is done once it has brought its general to battle (win or lose): no ride-out in a later season without a fresh Defend order, and the battle season's own Defend order does not re-arm it; a fresh Defend order for a later season does |
| `hp-wound-gain` | new | 1 | ✅ pass | After a personal fight every wounded hero who lives rolls for maximum HP, the winner rolls once (the win award, not a wound roll too), and a winner's successful roll gains +1 |
| `orders-group-by-location` | new | 4 | ✅ pass | The orders column's "Group by location" button groups heroes by province (keeping each hero's parked cards with it and remembering the order); "Collapse all" / "Expand all" fold and open every hero |
| `naval-retreat` | `claude_navalretreat_0927.js` | 2 | ✅ pass | The naval retreat split, staged cases plus 4,000 fuzzed retreats |
| `npc-parity` | `claude_npcparity_0927.js` | 2 | ✅ pass | Elf Ambush and Shield Fort fire against neutral garrisons, and only where they should |
| `report-privacy` | `claude_reportleak_0927.js` | 3 | ✅ pass | No realm's private report line reaches a second realm, over all-bot games |
| `fuzz-wages-combat` | `claude_fuzz_0927c.js` | 3 | ✅ pass | All-bot turns and personal combat: no crash, no NaN/undefined in the narrative; Orc wage discount stays a whole, non-negative number |
| `fuzz-advance-masking` | `claude_fuzz_0927d.js` | 3 | ✅ pass | Advance-and-strike combat, masking of unmet realms, archive round-trip |
| `chromium-boot` | `claude_lb_chromium_0927.js` | 4 | ✅ pass | GM portal, player portal and Hall of Fame boot in real Chromium; links and footers present |
| `orders-buttons-visible` | new | 4 | ✅ pass | In real Chromium, Save Draft and Submit Orders stay on screen over a long orders form, at the top and part-way down, on desktop windows and a phone |
| `gm-messaging-boot` | `claude_msg_gm_boot_0927.js` | 4 | ✅ pass | GM portal boots; the dispatches set-up banner appears and goes; deleting a game clears its dispatches first |
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
| `move-points` | `  const seaMovePoints={};     // separate sea move point pool (REMAINING this turn)` (exposes the movement-point pools) |
| `leaderboard-records`, `leaderboard-render` | `const _LB_SEA=new Set(` … `// Fetch this game's turn_events` |
| `home-placement` | `  const cellIdRC=(r,c)=>r*cols+c;`, `  const eligibleCells=[];` and their end lines |
| `druid-and-war-spoils` | the start and end of nine tables and functions (see the `slice(` calls) |
