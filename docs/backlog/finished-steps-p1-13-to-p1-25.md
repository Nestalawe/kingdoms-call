# Finished steps: P1-13 to P1-25

**A record, for looking up an id; not read for work.**

Each finished step of the plan, with the pull request that built it and that pull request's own title. A step
built in lettered rows says "done in its rows", and its rows follow it. "Done" alone: the step needed no pull
request (an account or a setting). Open steps are in [the backlog](README.md); the other finished steps:
[Phase 0, and P1-01 to P1-10](finished-steps-phase-0-and-p1-01-to-p1-10.md), [P1-11 and P1-12](finished-steps-p1-11-and-p1-12.md).

## P1-13

- P1-13: delivered in its rows, below: the architecture rules as checks (dependency-cruiser, knip, ESLint); the rest is P1-13z
- P1-13a: #180 The layers of src/ and no new import cycle, checked by dependency-cruiser; unused code counted by knip
- P1-13b: #181 Every lint rule an error, the type-aware rules on src/'s checked files, today's findings in ESLint's suppressions
- P1-13c: #182 The engine reads no page, clock or database, the dice come only from kcRng(), and the big tables are read by named columns: as lint rules
- P1-13d: #183 HTML is built only through kcHtml, as a lint rule on src/, public/ and the templates' scripts
- P1-13e: done in its rows, below
- P1-13e1: #209 The engine's four two-file import cycles, broken by moving code
- P1-13e2: #210 The engine's core import cycle, broken by moving code
- P1-13e3: #211 The bots' bottom moves into their intel file: three files leave the bots' cycle
- P1-13e4: #212 The bots' shared helpers move into their strategy file: two files leave the bots' cycle
- P1-13e5: #213 The bots' last shared helpers move into their strategy and spellcraft files: the engine has no import cycle left
- P1-13e6: #512 The player page's cycle, step 1: the order form's part
- P1-13e7: #513 The player page's cycle, step 2: the start, the lists and the chronicle
- P1-13e8: #514 The player page's cycle, step 3: the desk, the map and the messages
- P1-13e9: #515 The copies read as whole declarations become imports
- P1-13e10: #516 The army card's figures become a function the copies import
- P1-13e11: #517 The target field's Move directions and Cast Spell rows become two functions the copies import
- P1-13e12: #534 The portal copies' file and its vm retired: its test imports the copies
- P1-13e13: #543 The GM page's import cycle cut; no code cycle left
- P1-13f: #407 The words of a roll, a host and a skill shown move into the prose
- P1-13g: #408 The rest of the prose's words move into the prose
- P1-13h: #409 The titles' names, the save check's words and the tier constant move to where their readers are
- P1-13i: #410 The fortune's curve, the Hunting Rumours bands and the Terror's two numbers move onto plain values
- P1-13j: #411 A guardian's kind and its label move onto plain values
- P1-13k: #412 The corpse-carters' price and the skills' list for the report
- P1-13l: #415 The prose's and the views' import rules
- P1-13m: #414 A guard's reader and a level above nothing move onto plain values
- P1-13n: #490 The tests' code-scanning alerts fixed; any alert fails the merge
- P1-13n2: #491 The last test-code scanning alert fixed

## P1-14

- P1-14: delivered in its rows, below: tests moved down a level and into TypeScript Vitest tests; the rest is P1-14z
- P1-14a: #193 The engine's modules for tests, and two old scripts as four TypeScript tests
- P1-14b: #194 Personal combat's tests on the engine's modules, and six words scripts as TypeScript tests
- P1-14c: #388 Five battle, duel and page scripts as TypeScript tests
- P1-14d: #389 Six battle scripts as unit tests calling the two battles directly
- P1-14e: #390 Five march, Defend and sea scripts as TypeScript tests
- P1-14f: #391 Six company, item and creed-order scripts as TypeScript tests
- P1-14g: #392 Five report scripts as TypeScript tests on a staged world
- P1-14h: #393 Five warning, spying and diplomacy scripts as TypeScript tests
- P1-14i: #394 The leak fuzz and the skill-names run as TypeScript tests
- P1-14j: #404 Four battle-line scripts as TypeScript tests
- P1-14k: #405 Three fate and clause scripts as TypeScript tests
- P1-14l: #406 Four unit-ability scripts as TypeScript tests

## P1-15

- P1-15: done in its rows, below
- P1-15a: #234 The upgrade in one place: a running game's save gets its six repairs in one function before the turn
- P1-15b: #235 The schema learns what live saves hold: the portal's hero order, the GM page's fields, the marks the code keeps
- P1-15b2: #238 The schema learns what a human realm's orders save: the portal's battle plan, every mastery order's mark, the rare orders' fields
- P1-15c: #236 The version: every save says its shape, an older GM page refuses a newer save, and the made-up saves of versions 0 and 1
- P1-15d: #237 The check at load: before each turn the save is checked against its description; the turn still runs and the GM is told
- P1-15e: done in its rows, below
- P1-15e1: #241 The balance matrix fails a game on the save's check
- P1-15e2: #242 The scripted realm sends what the player portal sends
- P1-15e2b: #243 The held chase comes from a required named balance scenario
- P1-15e3: #244 The scripted realm's spare heroes give the orders the form offers them
- P1-15f: done in its rows, below
- P1-15f1: #492 The three flagged passes into the save's upgrade
- P1-15f2: #493 The four turn-start repairs into the save's upgrade
- P1-15f3: #495 The reads that write an old save's field become passes of the upgrade
- P1-15f4: #496 The Corsair pools' pass into the save's upgrade, its units from a content row
- P1-15f5: #497 Version 2: an older save's shapes mended once
- P1-15f6: #498 The readers' fallbacks for what version 2 mends dropped
- P1-15f7: #499 The War Drum's field in the saved item's schema
- P1-15f8: #504 The stop: a GM turn refused on a save the check finds a place in, but for a known leak
- P1-15f9: #505 Group (b)'s fallbacks dropped with their staged cases (merged through #509)

## P1-16

- P1-16: done in its rows, below: every page and tool typed, and lint refuses `@ts-nocheck` everywhere
- P1-16a: #524 The tours as a proof: the tours hold their timers; npm run proof:tours
- P1-16b: #525 The two forecast files freed
- P1-16c: #526 Six player and rulebook files freed; the element helper
- P1-16d: #527 map-symbols and move-analysis freed of @ts-nocheck
- P1-16e: #535 titles.ts and map.ts freed of their ts-nocheck lines; the map's one call typed as it stands
- P1-16f: #536 order-targets.ts freed of its ts-nocheck line
- P1-16g: #537 pre-orders.ts freed of its ts-nocheck line; briefing-and-submit's return types where read
- P1-16h: done in its rows, below
- P1-16h1: #538 The saved draft's types widened to what a parsed draft holds
- P1-16h2: #539 orders-form.ts freed of its ts-nocheck line; Revise's call typed as it stands
- P1-16i: #540 The tests', tools' and root config's lint suppressions to 0; tools/legacy/ deleted
- P1-16j: done in its rows, below
- P1-16j1: #566 The Hall of Fame's typed view of a game's entry and its readers
- P1-16j2: #567 The Hall of Fame's page freed of its ts-nocheck line
- P1-16k: #547 The Overlord page freed of its ts-nocheck line
- P1-16l: #551 The player page's dispatches, desk and screens freed of their ts-nocheck lines
- P1-16m: #552 The player page's game lists, join descriptions, Save and Submit freed of their ts-nocheck lines
- P1-16n: #556 The player page's join form and chronicle freed of their ts-nocheck line
- P1-16o: done in its rows, below
- P1-16o1: #557 The player page's sign-in freed of its ts-nocheck line
- P1-16o2: #623 The player page's report freed of its ts-nocheck line
- P1-16p: #565 The GM page's start-up, sign-in and turn-mode files freed of their ts-nocheck line
- P1-16q: #624 The Hall of Fame freed of its ts-nocheck line
- P1-16r: #630 The GM's statistics tab freed of its ts-nocheck line
- P1-16s: #631 The GM's game list, turn log and game detail freed of their ts-nocheck lines
- P1-16t: #633 The GM's turn screens freed of their ts-nocheck lines: every page typed
- P1-16u: #634 The reads of every column name their columns
- P1-16v: #635 Lint refuses the ts-nocheck line everywhere (P1-16 done: every page typed)

## P1-17

- P1-17a: #518 db/'s page code moves into the GM page
- P1-17b: #519 supabase-js from npm, served as a hashed file
- P1-17c: #520 The database client, Db and the fake
- P1-17d: #521 The access-layer tests in CI
- P1-17e: #522 Sign-in and accounts onto Db
- P1-17f: #523 The Overlord's accounts and games onto Db
- P1-17g: #544 The Hall of Fame and the statistics onto Db
- P1-17h: #545 The messages onto Db
- P1-17i: #546 The Overlord page's and the leaderboard's tests onto the fake
- P1-17j: #548 The player's games and realms onto Db
- P1-17k: #549 The orders onto Db, as they are
- P1-17l: #550 The player page's tests onto the fake (12 of 15; the browser specs follow in P1-17l2)
- P1-17l2: #560 The player page's three browser specs onto the fake
- P1-17m: #561 The GM's games onto Db
- P1-17n: #562 Deleting a game and reading its logs onto Db
- P1-17o: #563 The turn's shell and the statistics it writes onto Db
- P1-17p: #564 Turn 0 onto Db
- P1-17q: #568 Nine of the GM page's tests onto the fake
- P1-17q2: #569 Six more of the GM page's tests onto the fake
- P1-17q3: #626 The turn shell's page test on the typed fake
- P1-17r: #627 The tests of several pages on the typed fake (13 of them; the screen tours are P1-17t)

## P1-18

- P1-18: done in its rows, below
- P1-18a: #127 One failure path for the whole turn
- P1-18b: #128 Mercenary band ids without clock or dice
- P1-18c: #129 The engine stands alone
- P1-18d: #130 The split: resolveTurn and its shell
- P1-18e: #131 A seed per turn

## P1-19

- P1-19a: #229 The rule registry's frame: nine unit abilities of the whole force, one content row and one entry each
- P1-19b: #230 Facing: 23 unit abilities of the front line and the second line, one content row and one entry each
- P1-19c: #231 The whole line: 13 unit abilities of battleFaceSide, one content row and one entry each
- P1-19d: #232 Fates: Regenerating Hide and Knightly Example, one content row and one entry each
- P1-19e: #233 The blurbs: the player portal's 47 unit ability texts into the content file, beside their rows
- P1-19f: #250 The two tests' fixes: the words test reads each number whole, the static test sees every unit name
- P1-19g: #251 The volley: nine stages of volley and a land unit at sea in the rule registry, 14 content rows, a unit test of five
- P1-19h: #252 The grid: three stages of strength that place a unit in the registry, 5 content rows and Stoop on the Horses' flank slot
- P1-19i: #253 Before the battle: Flak Screen and Breach and Swamp handed the dice, 2 content rows, a boundary test
- P1-19j: #254 The rout: three stages of fate, 7 content rows and the Manticores' pursuit, a unit test of Ride Them Down's share
- P1-19k: #255 The turn's end: turnEnd's first stage and Raiders' Muster, Reaver Crews' landing mark by its row
- P1-19l: #256 The tables: the winged riders' strikes into content, the words test reads the strikes, Island Back and Forest Runners, the trap retired
- P1-19m: #273 The frame and the commander's items in the items' registry
- P1-19n: #274 The battles' items in the items' registry
- P1-19o: #275 The turn's and the orders' items in the items' registry
- P1-19p: #276 A hero's standing's items in the items' registry
- P1-19q: #277 What a fighter wears in the items' registry
- P1-19r: #278 What a ward does in the items' registry
- P1-19s: #279 The combat items in the items' registry
- P1-19t: #280 The treasury in the items' registry
- P1-19u: #294 Battle magic through the spells' registry: the frame, the eight battle spells and the Ember Rune
- P1-19v: #295 The pre-battle strikes through the spells' registry, and the totems through the items'
- P1-19w: #296 The combat spells that harm through the spells' registry, and the Dreamstone and the Ring through the items'
- P1-19x: #297 The other combat spells through the spells' registry, and the Mirror Shard through the items'
- P1-19y: #298 The Cast Spell order's checks before the cast through the spells' registry, and the spell charm and the Phylactery through the items'
- P1-19z: #299 The Cast Spell order's 30 spells by slug, a file per school
- P1-19aa: #326 The discoveries' registry: the frame and the army's strength
- P1-19ab: #327 The discoveries' registry: the lines and the fates
- P1-19ac: #328 The discoveries' registry: the fighter, the caster and his rise
- P1-19ad: #329 The discoveries' registry: the spies', explorers', scholars' and resters' orders
- P1-19ae: #330 The discoveries' registry: the recruits and the realm's works
- P1-19af: #331 The discoveries' registry: war's spoils and the march
- P1-19ag: #332 The discoveries' registry: the turn's end and the new turn
- P1-19ah: #333 The discoveries' registry: the bots and Messenger Birds
- P1-19ai: #345 The guardian perks' registry: the frame, the card and the grade's cap
- P1-19aj: #346 The guardian perks' own wards through the registry
- P1-19ak: #347 What a rider does in a fight, through the items' registry
- P1-19al: #348 The Mithril suit's identity through the items' registry
- P1-19am: #349 The old Cloak's hidden face through visibility
- P1-19an: #350 The bots name a spell by its row
- P1-19ao: #351 The five unit names read from three content facts
- P1-19ap: #353 The alignment orders' rows, the charmed hero's gate read from them, and their count
- P1-19aq: #354 The turn's order-name map and the dispatch read the alignment orders' rows
- P1-19ar: #355 The resolvers' creeds and the books' numbers read the alignment orders' rows
- P1-19as: #356 The bots' orders, busy list, urgency and two budgets read the alignment orders' rows
- P1-19at: done in its rows, below
- P1-19at1: #574 The alignment abilities' frame, and Neutral's trade through it
- P1-19at2: #575 The consecrated ground's +50% tax through the alignment abilities' registry
- P1-19au: done in its rows, below
- P1-19au1: #577 Zeal by alignment, the consecrated doubling and the fervours through the alignment abilities' registry
- P1-19au2: #578 The other battle factors and the Banner of Fellowship through the alignment abilities' registry
- P1-19av: done in its rows, below
- P1-19av1: #579 Prices and the Druids through the alignment abilities' registry: the mercenary discount, Bless Province's rates, the Druid waiver and Neutral scholars
- P1-19av2: #580 The alignments' ladder as a table beside the rows: hire wages and the gulf, mercy by the foe's alignment, the heroes' deal
- P1-19aw: done in its rows, below
- P1-19aw1: #581 The five alignment orders become rows of the alignment abilities' file; the old file goes
- P1-19aw2: #582 The alignment orders' refusals and outcomes: who may give each through the registry, each order in its own file
- P1-19ax: done in its rows, below
- P1-19ax1: #583 Heroes and the turn, part 1: Divine grace, the Divine Rest, the Blood Harvest and the conquest doctrine through the alignment abilities' registry
- P1-19ax2: #584 Heroes and the turn, part 2: the graves on Undead land, war without warning, a broken alliance, the risen dead and an Undead hero through the alignment abilities' registry
- P1-19ay: done in its rows, below
- P1-19ay1: #585 The world through the alignment abilities' family: the ritual stones' site, the wild country beside a capital, kings' first skills, the Undead king's skeleton, the wanderers, and one Divine and one Undead realm a game
- P1-19ay2: #586 The marks on a province through one module: consecrated ground, Terror and Enslave read, laid, lifted and faded in one place
- P1-19az: #587 The close of the alignment abilities family: its trap, the Terror trap on the marks' module, the overview and where a change goes

## P1-21

- P1-21a: #192 The mutant scorer
- P1-21b: #208 Tests for perception from the mutation session of 2026-10-24
- P1-21c: #245 Tests for the rules and battle from the mutation session of 2026-10-26
- P1-21d: #310 Tests for the stack's survivors
- P1-21e: #341 Tests for the stack's survivors
- P1-21f: #363 Tests for two faults only the balance caught (the stack's mutation session, 2026-11-02)
- P1-21g: #387 Tests for the stack's survivor (the mutation session, 2026-11-02)
- P1-21h: #413 Tests for the third tranche's mutation survivors
- P1-21i: #433 Tests for the 14-hour run's mutation survivors
- P1-21j: #437 Tests for the night run's mutation survivors
- P1-21k: #429 The scorer saves each fault's result and can carry on a stopped run
- P1-21l: #430 The scorer skips what can't change the verdict
- P1-21m: #460 Tests for the run's mutation survivors
- P1-21n: #489 Tests for the run's mutation survivors
- P1-21o: #509 Tests for the run's mutation survivors
- P1-21p: #528 Tests for the run's mutation survivors
- P1-21q: #541 Tests for the second run's mutation survivors
- P1-21r: #553 Tests for the second run's Part 2 mutation survivors
- P1-21s: #570 Tests for the third run's mutation survivors
- P1-21t: #588 Tests for the alignment family's two weak catches
- P1-21u: #628 Tests for the report and the Hall of Fame from the mutation session of 2026-11-17
- P1-21v: #636 Tests for the GM's pages and the database reads from the mutation session of 2026-11-17

## P1-23

- P1-23a: #314 A realmless hero's battle header no longer reads "(undefined)"
- P1-23b: #315 A wanderer who died earlier in the turn can no longer be hired
- P1-23c: #316 A hero's maximum-HP rise outside a fight is his own realm's alone
- P1-23d: #317 A spy who stays sees what rival heroes do there, never their realm's news
- P1-23e: #318 Invisibility hides a hero from every enemy order aimed at him
- P1-23g: #613 A battlecry holds at most 200 letters, and a battle plan and an order of heroes only what the game offers
- P1-23q: #366 The battle counts a commander's Druid as every rule does: the Crown beside him, a Curse on him (with P1-23ac)
- P1-23r: #368 The order form counts the Crown of Command in a hero's magic level
- P1-23s: #369 The order form offers the Warlock's extra cast in his best school
- P1-23t: #371 Three forecasts follow the turn: the Loremaster's Explore, a spare Traveller's Cloak, a Naval 8 hero's ships
- P1-23ac: #366 The battle counts a commander's Druid as every rule does: the Crown beside him, a Curse on him (with P1-23ac)
- P1-23ad: #370 The order form counts a Grand Cathedral's Bless Province as free
- P1-23ae: #367 The army card takes a Druid shortfall off as the battle does
- P1-23af: #372 Battle magic follows one rule in every battle: the bolt counted to 5, no storm at sea or on no Tactical

Dropped (ids are never reused): P1-23ap, on 2026-11-15, and P1-23aq, on 2026-11-15, re-planned with the new
alignment abilities (B-09); B-02, on 2026-11-15 (the batch rehearsal); B-04, on 2026-11-15, and B-05, on 2026-11-15,
re-planned in B-09.

## P1-25

- P1-25: done in its rows, below
- P1-25a: #416 Where a change goes, from an item in game terms to the files
- P1-25b: #417 The skills' check: their links, frontmatter and bytes
- P1-25c: #418 Three skills for the batches, drafted for a maintainer to move into .claude/skills
- P1-25d: #508 The description's save paragraph; the save's topic file checked against the code
- P1-25e: #572 One skill for making a change
- P1-25f: #573 The skill finds, plans and builds a tranche

## The new items (B-NN)

- B-13: #638 A runner for planted faults, several at a time
- B-14: #639 The Stop hook skips a session that changed no file
- B-15: #640 Tier 0 leaves the matrix to CI
