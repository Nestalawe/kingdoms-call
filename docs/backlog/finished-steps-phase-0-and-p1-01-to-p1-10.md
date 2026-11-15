# Finished steps: Phase 0, and P1-01 to P1-10

Each finished step of the plan, with the pull request that built it and that pull request's own title. A step
built in lettered rows says "done in its rows", and its rows follow it. "Done" alone: the step needed no pull
request (an account or a setting). Open steps are in [the backlog](README.md); the other finished steps:
[P1-11 and P1-12](finished-steps-p1-11-and-p1-12.md), [P1-13 to P1-25](finished-steps-p1-13-to-p1-25.md).

## Phase 0

- P0-01: done
- P0-02: done
- P0-03: done
- P0-04: done
- P0-05: done
- P0-06: #2 Add project description to README
- P0-07: done
- P0-08: #1 Cutover: git becomes the source
- P0-09: #1 Cutover: git becomes the source
- P0-10: #1 Cutover: git becomes the source
- P0-11: #1 Cutover: git becomes the source
- P0-12: #84 Toby's rulings registry
- P0-13: #17 Per-environment config, part 1: one file for the database address; #18 Staging deploys, part 2: a "staging" label puts a PR on the staging site
- P0-15: #21 Schema pull: a manual workflow that reads the live database's structure; #22 The database structure, as schema files and a baseline migration
- P0-16: #23 Access-rule tests in CI
- P0-17: #24 Migration pipeline; #25 Retire the SQL set-up banners; #26 First migration through the pipeline; #27 Database and site changes go in separate pull requests
- P0-18: #81 Serve supabase-js from the site
- P0-19: #97 Safe HTML helper, Overlord page and Hall of Fame; #98 GM portal; #99 Player portal: lobby, account and joining; #100 Player portal: report and Chronicle; #102 Player portal: orders; #103 Player portal: map and Dispatches
- P0-20: #53 Realm slots for the player portal (database); #56 The player portal sees other realms through one question (site)
- P0-21: #57 Tighten read access for realm slots
- P0-22: #63 Statistics and Hall of Fame for the game's GM and the Overlord (database); #64 Hall of Fame controls for each entry's GM and the Overlord (site)
- P0-23: #66 Dispatch limits and read markers (database); #67 Dispatches up to 500 characters, with clear limits (site)
- P0-24: #72 Reported dispatches (database, part 1 of 3); #77 Report a dispatch (site, part 2 of 3); #78 Tighten read access for dispatches (database, part 3 of 3)
- P0-25: #94 The GM's switch for eliminated realms' dispatches (database); #95 Eliminated realms and dispatches (screens)
- P0-27: #10 Replace the review check with a warning on dangerous paths
- P0-28: #29 Tighten write access for games
- P0-29: #31 Only the privileges the site uses, for the database's API roles
- P0-30: #32 Retire an unused database function
- P0-31: #59 Invitations show names, not emails (site); #61 Tighten read access for profiles
- P0-32: done in its rows, below
- P0-32a: #37 The Overlord account
- P0-32b: #47 Game Masters by offer (database)
- P0-32c: #51 The Game Master offer; the GM portal for Game Masters only
- P0-32d: #52 Only Game Masters create games
- P0-32e: #85 The Overlord as Master GM; handing a game over
- P0-32f: #87 The Overlord page
- P0-32g: #88 Master GM mode in the GM portal
- P0-32h: #91 Suspend and delete accounts (database); #92 Suspend and delete accounts (Overlord page)
- P0-32i: #93 Revoked GMs keep nothing
- P0-33: #33 Staging's footer says which pull request is on it; #34 Staging's database is rebuilt for each pull request
- P0-34: #35 The database can say which version it is; #36 Every page checks the database is new enough

Dropped (ids are never reused): P0-14, on 2026-10-14; P0-26, on 2026-10-15.

## P1-01

- P1-01: done in its rows, below
- P1-01a: #107 Pinned Node, Vitest for every test, strict TypeScript and lint settings
- P1-01b: #109 The agent's check loop, ratchets and the harness's self-test
- P1-01c: #112 Playwright Test, CI in parallel jobs, database lint
- P1-01d: #432 More test files at once, and the static job split

## P1-02

- P1-02: done in its rows, below
- P1-02a: #114 Balance matrix
- P1-02b: #115 The balance matrix in CI; #117 The lockfile and the Node pin are engine paths
- P1-02c: #132 The balance matrix hashes every database write

## P1-03

- P1-03: done in its rows, below
- P1-03a: #118 Balance report on engine PRs
- P1-03c: #120 Named balance scenarios

## P1-04

- P1-04: done in its rows, below
- P1-04a: #121 Staged games in manual turn mode
- P1-04b: #122 Invariants after every turn
- P1-04c: #123 The report-leak check
- P1-04d: #124 Property tests and the nightly random-seed run

## P1-05

- P1-05: #125 src/ becomes the source; site/ is built

## P1-06

- P1-06: done in its rows, below
- P1-06a: #184 The site is built in a job of its own, then published
- P1-06b: #185 Hashed file names, and a deploy keeps the files a cached page still names
- P1-06c: #186 Each page's footer shows its build, version.json is published, and the GM tab reloads on it; the stamps and their guards go
- P1-06d: #187 A bar tells an open page when a new version of the game is ready

## P1-07

- P1-07: #126 Seeded kcRng() and kcClock() in the source

## P1-08

- P1-08: done in its rows, below
- P1-08a: #133 Lift the core helpers out of runTurn
- P1-08b: #134 Lift terrain, sea and strength out of runTurn
- P1-08c: #135 Lift skills, experience and the battle helpers out of runTurn
- P1-08d: #136 Lift buildReports out of runTurn
- P1-08e: #138 Lift personal combat out of runTurn
- P1-08f: #139 Lift duels, encounters, lair odds and hero death out of runTurn
- P1-08g: #140 Lift combatVsNPC and the pre-battle duel out of runTurn
- P1-08h: #141 Lift combatVsChar out of runTurn
- P1-08i1: #142 Lift the phase intents, routes and province bookkeeping out of runTurn
- P1-08i2: #143 Lift the Defend watch out of runTurn
- P1-08i3: #144 Lift pursuit, stalled battles, unit gain and war fronts out of runTurn
- P1-08j1: #145 Lift the Move order out of runTurn
- P1-08j2: #146 Lift the explore and search orders out of runTurn
- P1-08j3: #147 Lift the recruit, hire and works orders out of runTurn
- P1-08j4: #148 Lift the research and practice orders out of runTurn
- P1-08j5: #149 Lift the item and army orders out of runTurn
- P1-08j6: #150 Lift espionage out of runTurn
- P1-08j7: #151 Lift Cast Spell out of runTurn
- P1-08j8: #152 Lift the war orders out of runTurn
- P1-08j9: #153 Lift processOrder, the order dispatcher, out of runTurn
- P1-08k1: #154 Lift the phase's four stages out of runTurn
- P1-08k2: #155 Lift Early Winter out of runTurn
- P1-08k3: #156 Lift after the phases out of runTurn
- P1-08k4: #157 Lift diplomacy and victory out of runTurn
- P1-08k5a: #158 Lift the new turn's first part out of runTurn
- P1-08k5b: #159 Lift the new turn's second part out of runTurn
- P1-08k6: #160 Lift the titles at the turn's end out of runTurn
- P1-08k7: #161 Lift the set-up and the order merge out of runTurn
- P1-08k8: #162 Lift before the first phase out of runTurn
- P1-08l1: #163 Lift bot diplomacy out of runTurn
- P1-08l2: #164 Lift the bots' plan out of runTurn
- P1-08m: #165 Pass the turn's seed into resolveTurn
- P1-08n: #166 The last of resolveTurn: two set-up lines named, a dead test hook removed

## P1-09

- P1-09: done in its rows, below
- P1-09a: #167 Tests off the code anchors and off the site's files
- P1-09b: #168 The module seams, still classic scripts
- P1-09c: #169 Prettier over src/'s JavaScript and CSS
- P1-09d: #170 The switch: ES modules and one Vite build per page
- P1-09e: #171 TypeScript: every file of src/ becomes .ts

## P1-10

- P1-10a: done in its rows, below
- P1-10a1: #177 The saved game state's types, from Zod schemas
- P1-10a2: #178 The content's and the turn's types: unit tables that fail to compile when a unit is missing
- P1-10a3: #179 14 engine files typed with annotations alone, checked by strict TypeScript
- P1-10b: done in its rows, below
- P1-10b1: #224 The ratchet counts the ts-nocheck line in two; no type assertion let through
- P1-10b2: #225 Army tables, movement and strength typed; the battle-only marks typed apart from the save
- P1-10b3: #226 Battle fates, the report's tiers and the losses tally typed: UnitFateOptions
- P1-10b4: #227 The battle lines typed: the grid's types and UNIT_SHORT's satisfies
- P1-10b5: #228 The six next leaves typed: fortune, the Wonders, the names, the title perks, the map's helpers, the charms
- P1-10b6: #246 Terrain and unit strength typed: ArmStrContext, TERRAIN_MODS' satisfies, the turn's marks
- P1-10b7: #247 Early Winter's stage typed: its five marks, three return types in discoveries.ts, its typed findings
- P1-10b8: #248 discoveries.ts typed: one effect type, its typed findings, a unit test of the lines no game reaches
- P1-10b9: #249 The five next leaves typed: fame and consecration, tiers and hoards, intrusion warnings, relations and captures, the blood harvest
- P1-10b10: #269 The items' rules and a hero's skills and hit points typed: equipment.ts and skills-and-hp.ts freed
- P1-10b11: #270 The fighter of a personal combat, his wards and riders typed: helpers.ts and speed-encounter-plans-and-combatants.ts freed
- P1-10b12: #271 The hit, the round and the strikes of a personal combat typed: to-hit-wounds-stuns-and-courage.ts and melee-flight-and-archery.ts freed
- P1-10b13: #272 The tactics, combat items and actions of a personal combat typed: tactics-combat-items-and-actions.ts freed
- P1-10b14: #290 `lair-guardians-and-the-odds.ts` freed of its ts-nocheck line
- P1-10b15: #291 `chances-and-lair-grades.ts`, `pre-battle-spell-choice.ts` and the order dispatch freed of their ts-nocheck line
- P1-10b16: #292 `combat-spells-and-guardian-abilities.ts` and `resolve-personal-combat.ts` freed of their ts-nocheck line
- P1-10b17: #293 `cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts` freed of its ts-nocheck line
- P1-10b18: #339 `effective-skills-and-hidden-heroes.ts` and `log-line-helpers.ts` freed of their ts-nocheck line
- P1-10b19: #340 `world/tables.ts` and `graves.ts` freed of their ts-nocheck line
- P1-10b20: #342 The recruit and hire, and realm works, order files freed of their ts-nocheck line
- P1-10b21: #343 The explore and search orders' file freed of its ts-nocheck line
- P1-10b22: #344 The espionage orders' file freed of its ts-nocheck line
- P1-10b23: #395 The best commander's and the duels' files freed of their ts-nocheck line
- P1-10b24: #396 The battle against a province's defenders freed of its ts-nocheck line
- P1-10b25: #397 The battle between two heroes' hosts freed of its ts-nocheck line
- P1-10b26: #398 A host gained, a stalled battle and a war front freed of their ts-nocheck line
- P1-10b27: #399 The Move order freed of its ts-nocheck line
- P1-10b28: #400 The army, research and practice orders freed of their ts-nocheck line
- P1-10b29: #401 The item orders freed of their ts-nocheck line
- P1-10b30: #402 The turn report freed of its ts-nocheck line
- P1-10b31: #403 Every realm's report freed of its ts-nocheck line
- P1-10b32: #419 The idioms file split; the move pools, skill rises, province bookkeeping and drill freed of their ts-nocheck line
- P1-10b33: #420 The sea lift and a hero's death freed of their ts-nocheck line
- P1-10b34: #421 The phase intents, the Defend watch and the pursuits freed of their ts-nocheck line
- P1-10b35: #422 The standings and the title intelligence freed of their ts-nocheck line
- P1-10b36: #423 The plague, the spy's learning and the lair items freed of their ts-nocheck line
- P1-10b37: #424 The turn's context, the phase stages and after the phases freed of their ts-nocheck line
- P1-10b38: #425 Diplomacy and victory, and the new turn's two stages, freed of their ts-nocheck line
- P1-10b39: #426 The world's making freed of its ts-nocheck line
- P1-10b39a: #436 The wide-sea naming case leaves out the lair stocking (from main)
- P1-10b40: #427 The bots' intel and setup freed of their ts-nocheck line
- P1-10b41: #434 bots/strategy.ts freed of its ts-nocheck line
- P1-10b42: #435 bots/phase-one.ts freed of its ts-nocheck line
- P1-10b43: #438 The bots' spellcraft typed
- P1-10b44: #439 The bots' war and diplomacy typed
- P1-10b45: #440 The bots' missions typed
- P1-10b46: #441 The bots' specialists typed
- P1-10b47: #442 The bots' march typed
- P1-10b48: #444 The bots' economy and plan typed
- P1-10b49: #445 kc-safe.ts typed
- P1-10b50: #502 The set-up and before the first phase typed
- P1-10b51: #503 run-turn.ts typed; the turn's context whole at birth (merged through #509)
