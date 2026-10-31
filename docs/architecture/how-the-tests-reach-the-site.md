# How the tests reach the site

- **`lib/boot.js`** is the one way to load a page from `site/`, which the run builds from `src/` before any test
  (`setup/global.ts`, `npm run build`, Vite since P1-09d; not when `KC_SITE` names another copy). A test script run on
  its own reads `site/` as last built:
  - `readPage` returns the page ready for jsdom, which runs no module script and loads no stylesheet: its bundle
    (`assets/<page>.js`) as a classic script at the end of the body, `"use strict"` first (a module runs once the page
    is parsed, after the classic scripts, in strict mode); its stylesheet inline where its `<link>` was;
    `kc-config.js` and the staging footer inlined; the supabase-js tag removed. `pageFiles` names the files it read.
    In jsdom every top-level function and `var` of the bundle is on `window`, listed in `globals.ts` or not; in
    Chromium only what `globals.ts` puts there ([traps.md](../traps.md#nothing-is-on-window-but-globalsts));
  - `bootJsdom` boots it in jsdom;
  - `serve` and `routeExternal` do the same for Chromium (Playwright): the pages are served from one
    folder, as deployed (`browser/server.ts`); `vendor/supabase-js-*.js` gets a stub and the fonts get nothing;
  - every stand-in database answers `rpc('kc_db_version')` with `DB_VERSION`, the newest migration in
    `supabase/migrations/`, so pages pass their database version guard. `bootJsdom`'s
    `opts.dbVersion` sets another answer (an older version, `null` for a missing function, `'offline'`, or a
    list used in order) and `opts.dbCalls` records the page's database calls.
- **`lib/engine.ts`** is the one way to load the engine in Node: `loadEngine({seed})` runs the engine's
  bundle (P1-09d: Vite's build of an entry that re-exports the data file and every file under `src/engine/` and
  `src/views/`, in the GM page's order, `tools/pages.ts`'s `engineEntryFiles`) in a bare `vm` context with nothing but
  the seed and `console`, and returns the context, where the bundle's top-level names are the globals. It reads
  `src/`, not the built site (`src` names another copy, built again whenever the copy changes). The run builds this
  checkout's bundle once (`setup/global.ts`, into `node_modules/.cache/kc/`, its path in `KC_ENGINE_BUNDLE`); another
  copy's is built the first time a process asks (about a second). P1-14 moves the tests to importing the engine's
  modules ("The engine's modules", next); until then the ratchet counts the test files on the loader
  (`vmLoaderTests`), which only falls.
  There the turn is `resolveTurn` (`src/engine/run-turn.ts`, P1-18d): give it the saved state (JSON), the slot rows
  and the turn, and it returns the new state, the GM's log, the Spy-stealth step and `whatTheReportsRead`, which the
  shell calls in that order after the save, then hands what the second returns to the views' `buildReports`
  (P1-12b3; in the same bundle; `unit/engine-purity.test.ts` plays a whole game this way). `runTurn`, the shell that loads, saves and writes the reports, is the page's. To play a turn on
  chosen dice, set them with `kcRng.use` around the call and give no seed; given a seed (as the shell gives one,
  P1-08m), the turn and its Spy stealth play on the seed's dice and draw nothing from yours, and the reports draw none. A helper lifted out of
  `resolveTurn` is a top-level function there: `engineFn(engine, name)` hands it back, and
  `turnContext(engine, state)` makes the turn's context it takes first, on a world parsed inside the `vm`, as
  `resolveTurn` holds it before the first phase, with everything `resolveTurn` adds to it made empty (the
  movement pools, the collectors, the battle count, the held-back skill rises, …). To see every call a helper makes to
  another top-level function, wrap it in the `vm` (`unit/xp-naval-passenger.test.ts` records each experience roll so,
  P1-08c). `botWorld(engine, realms, size, opts)` makes a new world of bot realms there, as
  JSON, and `quietEngineLog(engine)` quiets the line `emit` echoes to the console.
  **`lib/matrix-game.ts`** sets up one game of the balance matrix (`scripted-05`) for it: `newWorld(engine)` and the
  slot rows for a turn (`slotRows`, or `slotRowsJson` for a page's database), shared by `engine-purity` and
  `turn-shell`'s same-result test. **`lib/middle-of-a-bot-world.ts`** stages a case for a lifted helper on the
  middle of a bot world, cleared (open plain, nobody there; realms 0 and 1 at war, 0 and 2 allied): `board()` makes the
  context, `hero()` stands a hero there with troops and points of movement, `withDice` and `firstDie` pin the dice.
  `playTurn` plays a whole turn from the board; its third argument adds orders a realm sends under a
  key of its own (`hired_<hero>_via_<hirer>_ph<phase>`, written for a hero it means to hire). The board leaves the
  realms as the bot world dealt them, and they differ from seed to seed (creed, folk, starting discoveries, treasury,
  home): a case that leans on any of them stages it (`plainRealms` in `lib/recruit-hire-and-realm-works-order-cases.ts`
  makes them all plain).
- **The engine's modules**: how a new test, or one moved off the loader,
  reaches the engine.
  - It **imports the functions it calls from their modules**, typed (`import { generateNewGame } from
    '../../src/engine/world/generate.ts'`), and **imports `lib/the-whole-engine.ts` first**: it imports `run-turn.ts`,
    `world/generate.ts` and `clock.ts`, so every file has run its load-time set-up (as `engine/items/equipment.ts`
    re-tiers two of the content's tables), as in the bundle and on the GM page
    ([traps.md](../traps.md#a-test-on-the-engines-modules-loads-the-whole-engine-first)). `unit/engine-loads`
    checks that every export then holds what the bundle holds.
  - **Fresh modules for a test whose outcome depends on the dice:** it calls `vi.resetModules()` and imports what it
    needs (`await import(…)`, still typed) before it seeds the dice (`kcRng.seed(…)`), so its world doesn't depend on
    the tests before it and `-t "<name>"` repeats it. A file of tests on tables and pure functions imports statically
    (Vitest gives each file fresh modules).
  - **A stand-in is `vi.spyOn` on the module that exports the function** (`restoreMocks` puts it back after each
    test). It reaches calls from other files only, so the test shows its stand-in is reached; a function called
    inside its own file is staged around (the state, or `kcRng.use`), not stood in
    ([traps.md](../traps.md#a-stand-in-on-a-module-reaches-calls-from-other-files-only)).
  - **A variant of the engine's code** is a planted copy (`plantedSrc`, below) imported directly: `await
    import(path.join(copy.dir, '…'))`, after `importTheWholeEngineFrom(copy.dir)`. Its modules are its own, beside this
    checkout's.
  - **Its fail-first proof is a planted copy of the branch**, not `KC_SITE`: these tests read `src/`, as the loader
    does. Copy the branch, plant the fault in the copy's `src/`, and run the test there.
  - **`lib/a-staged-turn-on-the-engines-modules.ts`** plays one real turn on a small staged world on the modules:
    the same staging and results as `lib/scenario-in-the-vm.ts`'s `turn()` and `play()` (`S`, `S2`, `log`,
    `reports`, `collected`, `text`, `extra`, `reportEveryRealm()`), with no `W`: its `prepare(S)` calls what it needs
    from the modules, and a test stands a function in by `vi.spyOn`. Each call gives fresh modules, the dice seeded as
    asked (`scenario/battlefield-surgery-lines-sit-inside-the-battle` seeds them from `KC_SEED`).
- **`lib/source.ts`** is the one way a test reads the site's code: `src/`, by its syntax tree (TypeScript's
  parser), never by its lines or layout, so a reformat, the module switch or the `.ts` rename
  changes no answer. It gives a file's named declarations as one script (`sourceOf`, `sourceFrom`, `scriptOf`: `export`
  and types taken out), a stretch of a function (`statementsBetween`), the values a file declares (`initializersOf`,
  `pageInitializer`, `entriesOf`), the strings a file or a page holds (`stringsOf`, `pageStrings`, `pageText`: every word
  the page can show, its template's too, and the words of the lines its code imports from `views/prose/`, P1-12d1), the
  files as written (`pageSource`, for a comment), its calls (`callsTo`), and its code in one canonical layout for a
  regular expression written in the dense style (`compactOf`, `compactPage`, `compactDeclaration`, `compactCode`,
  `statementsFollowing`). And copies: `plantedSrc` (for `loadEngine({src})`) and
  `plantedSite` (a site built from it, to boot a page that fails where nothing outside can make it), with
  `plantBefore`, `plantAtStart` and `replaceInitializer` to plant by the syntax tree.
  `unit/the-source-read-by-its-syntax-tree.test.ts` checks every file reads the same as written and after Prettier.
  These read `src/`, not `KC_SITE`.
- **`lib/scenario-in-the-vm.ts`** plays one real turn on a small staged world in the engine's bare vm, as the
  shell plays it (a seed from the dice, `resolveTurn`, the Spy-stealth step, the views' `buildReports` on what the turn
  hands over), with `lib/scenario.js`'s staging; `play(state,
  rows)` plays a saved world on slot rows of the test's own, and `reportEveryRealm()` has every realm reported, bots'
  too (an all-bot game writes no report otherwise: `concede`, `report-privacy`). Its `log` (and `text()`) is the GM's
  log in words, as the views write it for the shell to save (`buildReports`' `gmLog`, P1-12c3), and so is
  `lib/a-staged-turn-on-the-engines-modules.ts`' and the board's `lines()` (`lib/middle-of-a-bot-world.ts`): a typed
  line has no words in the engine's own log. `recordTheEvents()` has
  `play` return `perception` too: each event as it was emitted (its audience, the phase and hero its line was filed
  under, whether it named that hero, and the realm he served then: P1-12c1; `emit` stood in), with its line's words as
  the views wrote them (a battle's tally place left empty is no event: P1-12c3), and the turn's sight, for the leak check's audience check (`every-realm`, `report-privacy`). Its `W` is the engine's global scope,
  where a top-level function can be stood in for the turn (`W.trySkillGain = …`): the scenario tests that used a
  code-anchor hook on the page play their turns here.
- **A page's own names**: its scripts are modules, so in a browser a test reaches only what the page
  puts on `window`: the two lists of `src/ui/<page>/globals.ts` (the names its inline handlers call, and the names its
  tests reach: functions and constants) and its declared globals (`globalThis.<name> = <value>;`: a variable its files
  or its tests share, which a copy on a list would leave stale). jsdom reaches more (above), so
  `static/page-globals.test.ts` checks the lists: a name a test reaches on a page (`W.eval('…')`, `W.name`,
  `page.evaluate(() => …)`, a screen tour's code, read as a whole `+` chain too) that isn't there fails it, and so does
  a variable reached that isn't a declared global, or a page function a test stands in (`W.f = …`: it would reach
  nothing in a browser; stage what it reads, or stand it in in the engine's `vm`, `lib/scenario-in-the-vm.ts`). Name a
  page's function as code (`typeof f`), not in a string handed to `eval`, which it can't read. `lib/page-globals.ts`
  says how it reads them.
- **`lib/scenario.js`** stages one real turn on a small world for scenario tests: it boots the GM
  portal, lets the test edit a fresh world, gives every human-held
  character its orders (Rest by default), runs `runTurn` and returns the saved world and the GM's log.
  `alignments` (and `races`) name a realm's crown by index, with the skill build a bot of that crown is dealt.
  `now` pins the page's clock; `telemetry` has the page write its statistics rows, returned as the turn's `events`
  (the named balance scenarios read them).
- **`lib/invariants.ts`** is what must hold after every turn, as pure checks on one turn: the saved state
  before and after, the GM log's lines, the telemetry and the `game_players` rows. No `NaN` or `undefined` in the state
  or the log; every character's HP from 0 to their maximum; unique ids (characters, provinces, mercenary bands,
  items); found items unique and on the ledger (`_awardedItems`; Mithril Armour, every dwarf's, is off it); every living
  character and mercenary band on the map; no line of a dead character's own after the phase they died in (battle
  lines excepted: a fallen commander's leaderless host fights on under his id, R-019); `orders_submitted` cleared.
  `turn-fuzz` and the balance matrix run `checkTurn` after every turn: the invariants, then the leak checks.
  `KNOWN_BREACHES` lets through, in exactly its form, a breach known on `main` whose fix waits (Theo, 2026-10-17: no
  engine fixes during the refactor); the fix's pull request removes its entry (plan step P1-23). Today: none.
- **Property tests** (fast-check, P1-04d; `unit/combat-properties.test.ts`, `scenario/turn-properties.test.ts`) state a
  rule and let fast-check make up the inputs: heroes, guardians, hits, small worlds, orders. Every dice roll in the
  page comes from a seed that is part of the input (the page's dice are reseeded, `kcRng.seed`, and its clock starts again,
  for each one), so an input plays the same every time. When one fails, fast-check shrinks it to the smallest input
  that still fails and prints it as "Counterexample", with its `seed` and `path`. fast-check's own seed is `KC_SEED`
  (`setup/fast-check.ts`), so the footer's command repeats it. Pin a counterexample found as an entry in that
  property's `examples` (fast-check's parameters), so every later run tries it first. A property tries 100 inputs
  unless it sets its own number (cheap ones more, whole turns fewer); `npm run test:full` tries ten times as many.
- **The nightly run** (`.github/workflows/nightly.yml`, P1-04d) runs `npm run test:full` every night with a random
  `KC_SEED`, printed first in its log and summary. A red night blocks nothing: repeat it with that seed (locally, or
  Run workflow with the seed), then add a test at the lowest level that shows the problem, or, while the refactor
  runs, ask Theo whether to park it in `KNOWN_BREACHES`.
- **`lib/report-leaks.ts`** is what no realm's report may show it, as five pure checks on one turn and its
  reports (`turn_logs` rows with `player_index` ≥ 0), run by `checkTurn` (and `checkLeaks`, the leak checks alone):
  - **another realm's private line**: a line on the `PRIVATE_LINES` list (a hit-point rise, Invisibility, moving
    unseen, Call to Arms, Resurrect, Divine Resurrection, Phantasmal Armies, Phantom Host), in any part of the report
    that holds lines (the chronicle, province events and spy activity: P1-12a1), read by a realm the hero it names
    didn't serve this turn (his realm before or after it, or a Charm's caster), or, naming none, by two realms. In spy
    activity only the hit-point rise counts (`inASpysFeedToo`): a spy who stays sees a rival's deeds, his Call to Arms
    or his Resurrect among them (R-118). Clairvoyance's scried lines are allowed (the rulebook);
  - **an unmet realm**: before the game is over, a realm's name anywhere in the report of a realm that hasn't met it
    (`_encountered`, or a hero of it in the report's sightings), but in a chronicle line the reader is a party to
    (R-046). A met realm's name that holds an unmet one is matched first;
  - **an unseen hero**: a hero who cast Invisibility this turn, in another realm's sightings (`SIGHTINGS`: the map,
    sightings, province intelligence, Encounter targets) or named in its lines from the moment he cast it. Allowed:
    Clairvoyance on him; title intelligence; and, from the phase he first acts on the reader, every line (acting on a
    realm reveals him to it: R-119, part 2). A line of the reader's own order naming him is a breach too: every order
    and reaction of another realm aimed at him finds no one (R-119);
  - **a line its audience does not admit** (P1-12b3, P1-12's Decision 12): every line a realm reads (the chronicle,
    province events, spy activity) comes from an event of the turn, with its text in its phase, whose audience admits
    it, by the audience model stated there again, apart from the views' `playerEvents`: told, its own deed, its hero
    (a line that names none, filed under the hero whose order was resolving, only when its audience reached the realm he
    served then, or he served none: P1-12c1, as `emit` files it), the world, eyes there (its own province, a hero of its own there that phase, a spy on it that phase or before), a
    battle's lines to those told; a spy's lingering sight (R-118: in a province it spied, from the next phase, a deed or
    what anyone there could see, never a kind for one realm alone or a line that excepts it); Clairvoyance (the watched hero's events from the watch's phase, and where he ends the turn); an unmet
    realm's name read as "an unknown realm". It runs only where the harness records the turn's events
    (`Turn.perception`: the matrix's every-realm half, and `report-privacy` since P1-21b). A line of a spied province
    that its audience keeps from the spy reads "through its spy";
  - **a line for one realm alone** (P1-12c4, P1-12's Decision 6): a line of a kind that is its hero's realm's alone
    (`KINDS_FOR_ONE_REALM_ALONE`, the check's own list: a hero's hit-point rise in a fight, the surgeons' word to a
    fallen duellist's realm, a hero's maximum-HP rise outside a fight, R-117, and a hero hardened after a fight outside
    one, R-118) is read by another realm than the one its fact names or one its hero served this turn,
    whatever audience the engine gave it (the recorder notes each event's kind and the realm its fact names).
    Clairvoyance's lines are allowed. It runs where the harness records the turn's events.

  What they can't see yet: in a harness that doesn't record the events (`turn-fuzz`, the page's matrix), a private line not on the list (a skill rise, say); whether the engine gave an event the right
  audience, but for the kinds for one realm alone (the audience check takes it as given: every realm's report against its baseline sees a change); the
  portal's name tables (`LOOKUP_TABLES`, for colouring names; until P2-06 trims a report to its reader); Spy stealth and the spotting roll in your own land (only Invisibility is checked); a name two heroes share.
  They read only the reports a harness has: `turn-fuzz`'s human realms, the matrix's scripted realm, every realm in
  the matrix's every-realm half and in `report-privacy`.
- **`lib/strict-schema.ts`** is the one way a test parses with the schemas of `src/schemas/`: `strictIssues(schema, value)` lists where a value fails the schema's strict version, `strictVersionOf(schema)` (in `src/schemas/the-strict-version-of-a-schema.ts` since P1-15d, which moved it there for the check of a saved game at load): the same schema with every object `z.strictObject` (the schemas' `z.object` drops a key it doesn't name; this refuses it, at any depth). A kind of schema it doesn't know stops it.
- **`lib/personal-combat.ts`** (P1-08e; on the engine's modules since P1-14b) gives a test personal combat:
  `await personalCombatEngine()` gives it fresh modules, the dice seeded (1 unless asked), and a turn's context on a
  new bot world, the world the bare `vm` made from the same seed, byte for byte. `call(name, …)` calls an engine
  function by name, with that context first if it takes one; `base`, a living hero of a realm to build heroes from;
  `MON`, the guardian table; `pinned` fixes the engine's dice (`kcRng.use`) for one call; `wordsOf(narrative)` a
  fight's lines in words, as the views write them (a personal combat's lines record facts since P1-12c4), and
  `wordsForEveryoneInTheFight(narrative)` those of the lines for everyone in it (not those for one realm alone). A table, `kcRng` or a function
  to stand in by `vi.spyOn` is imported after it (`await import(…)`), so it is the same fresh module the functions use
  (`bolt-damage` stands in `d100`; `xp-fight-win` and `xp-fled-fight`, `trySkillGain`). The context's fields come from
  `lib/the-fields-resolve-turn-adds-to-the-turns-context.ts`, the one list `lib/engine.ts`'s `turnContext` uses too.
  It replaced `lib/pc-hooks.js`, which booted the GM portal and ran a turn to take the functions from the
  `  // 4. Run all 5 phases` hook.
- **`lib/hostile.js`** and **`lib/screens.js`** are the hostile-name harness. `screens.js` has one tour per
  page: a staged world whose player-chosen strings come from `names(kind)`, the page's modes (who is looking) and its
  screens, run in jsdom (`runJsdom`) or Chromium (`runChromium`, given a browser and a server's address, or a folder
  to serve) against any copy of the site. `hostile.js` gives the
  names (`'hostile'`: every payload at once, with the field's name in front; `'ordinary'`: apostrophes, accents and
  hyphens) and `inspect(document)`, which finds a value that became an element or code, or a handler that no longer
  parses. `hostileTest(tour)` is a page's hostile-name test in jsdom; `browser/hostile-names.spec.ts` is the same in
  Chromium. Converting a page to `kcHtml` adds its tour. A tour
  may give its page longer to start (`bootWait`), and a mode with `bootError` is a page that can't start: its error is
  expected, and its screen is the boot-failure message. In jsdom, a promise the page leaves rejected is a page error (jsdom
  doesn't fire `unhandledrejection`, so Node would otherwise end the test). A step may hold the page's own short timers:
  the player portal's orders mode queues them and runs them in order at the end of each step, so no screen is caught
  halfway; every player-portal mode holds the Dispatches poll.
- **`tests/tools/same-dom.js`** (run by hand, not in `npm test`): every screen of a tour, with ordinary names, on two copies of
  the site (e.g. `main`'s and the branch's), compared as parsed DOM; a string in a handler is compared by its value, however
  it's quoted, and a footer's build line reads as the stamp it replaced. A pull request that converts a page shows its output.
- **`lib/stub-db.js`** holds every Supabase stand-in the tests use. Nothing connects to a real
  database. `makeStub()` mirrors the Game Master functions (`is_game_master`, `is_site_admin`,
  `gm_accept_offer`, `gm_decline_offer`) over its `game_masters` and `site_admins` rows; its default
  account is a Game Master. It also mirrors `get_game_slots` and the one-realm-per-number and one-per-account
  rules on `game_players`; `RULES.ownSlotsOnly` applies P0-21's read rule and records any read that asks for
  another realm's row. `RULES.ownGamesOnly` applies P2-16's read rules on `games` and `turn_logs` (a game for its GM,
  its players and the Overlord, and in setup for anyone if public, or invited if private; a log for its game's GM,
  players and the Overlord) and records any read that asks for another running or finished game, or its logs.
  `INSERT_ERRORS[table]` answers every insert into a table with a given error, as a check or
  trigger would, and `ERRORS["table.op"]` (or `ERRORS["rpc.name"]`) answers every such call with a given error, so a
  test chooses the message a screen shows. It also has `message_reports` and mirrors `gm_reported_messages`, and the Overlord's functions (`overlord_accounts`, `gm_offer`, `gm_withdraw_offer`, `gm_revoke`, `reassign_game`, `account_suspend`, `account_unsuspend`, `account_delete`; account emails, dates and suspensions from `DB.accounts`). The harnesses were written with five different stubs; each is kept exactly as it
  behaved, so moving a harness onto the shared file didn't change what it sees.
- **Fixed seed.** `npm test` sets `KC_SEED`. `boot.js` then replaces the test process's `Math.random` with a seeded
  generator (sfc32), and gives every jsdom page a seed (`KC_RNG_SEED`) before its scripts run. The page's dice,
  `kcRng()` (`src/engine/rng.ts`, P1-07), are the same generator seeded the same way; the page's `Math.random` gets
  the same seed, for anything outside `src/`. So a run's random choices repeat with the same seed. To fix dice in a
  page that has booted, use the page's own hook, never its `Math.random` (nothing in `src/` draws from it):
  `kcRng.seed(n)` starts again from seed `n` (the property tests, for each input), and `const was=kcRng.use(fn)` …
  `kcRng.use(was)` draws from `fn` for a while (`lib/personal-combat.ts`' `pinned`, `arrow-damage`, `bolt-damage`,
  `battle-faced-turn`, `abilities-beasts`, the screenshot tour) ([traps.md](../traps.md#dice-come-from-kcrng)).
  Around `runTurn` that pins only the turn's seed: each turn plays on dice of its own, made from one number of the
  page's.
  A test that cuts code out of `src/` by its syntax tree and runs it on its own gives it a `kcRng` or `kcClock` of its own
  (`home-placement`, `leaderboard-records`, `leaderboard-golden`). A page's clock (`Date`) is pinned only when a test
  asks: `bootJsdom(html, {seed, now})` gives the page its own seed and a clock that starts at `now` and moves on 1 ms at each reading, so a turn
  run that way is byte-identical every time (`deterministic-boot`; `turn-fuzz` pins it too, so the same seed plays the same games). Otherwise runs are repeatable in practice but
  not guaranteed byte-identical. The engine reads that clock through `kcClock()` (`src/engine/clock.ts`). Pages opened
  in Chromium are not seeded: their dice seed themselves from the browser's `crypto`, as on the live site
  (`chromium-boot` checks it); a browser spec's own jsdom turn is (`map-fits-panel` gives its page the seed the
  script's got).
- **Staged games are in manual turn mode** (`staged-turn-mode`). In "auto" or "deadline" mode the GM portal's
  auto-turn watcher checks the game 3 s after sign-in, then once a minute: it reads the page's clock at a moment that
  depends on load, and runs a turn by itself once every realm's orders are in.
- **`KC_SITE=<folder>`** points every test, and the browser specs' server, at another copy of the site, e.g. a
  deliberately broken one to prove a check fails. Not the tests that read `src/` (`lib/engine.ts`, `lib/source.ts`,
  the engine's modules, [above](#how-the-tests-reach-the-site)): their fail-first proof is a planted copy of the branch.
