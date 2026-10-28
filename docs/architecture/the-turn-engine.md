# The turn engine (GM portal)

- **Game state** is one JSON value per game in `games.game_state` (hundreds of KB for a mid-game
  6-realm world). It arrives from Supabase as a **string**: always read it through
  `parseGameState(game)`.
- **Turn 0.** `runTurn0` previews the bot roster; `commitTurn0` generates the world, saves it and
  pushes each realm's first report.
- **A turn is two functions** (P1-18d): the engine works it out, and a shell around it does the database and
  screen work.
- **`resolveTurn(G, freshPlayers, expectedTurnToRun, seed)`** (`src/engine/run-turn.ts`) is the turn itself. It takes
  the saved state as loaded (JSON: parsing it is the turn's copy), the slot rows, the turn being run and the turn's
  seed (P1-08m). It
  brings an older save up to the current tables ([traps.md](../traps.md#live-saves-keep-copies)), merges the
  orders, runs the bot passes, defaults missing orders to Defend, and resolves the five phases (look for
  `// 4. Run all 5 phases`) and the end of the turn. It is synchronous and reads no database, no screen and
  no clock; its dice are the seed's (below), or, given no seed, the dice in use (as a test fixes them). It returns
  `{state, log, spyStealthAndInvisibilityStampedForTheReports, whatTheReportsRead}`: the world to save, as JSON; the
  GM's log, before its words are written (a typed line has its fact and no words yet, below); the Spy-stealth step, which rolls each hero's Spy stealth and carries this turn's Invisibility into the
  reports' turn, on the working copy, once, on the turn's dice (P1-12b2); and `whatTheReportsRead()`, which hands over,
  once, after the stealth step, what the reports are built from: the slot rows, the working copy, the turn's log, the
  turn's sight (whose heroes stood where in each phase, who fought in each battle, whom each realm watches by
  Clairvoyance) and the telemetry's collectors (P1-12b3). Both are called only after the save. The engine imports no
  view: the reports are the views' (below). `tests/unit/engine-purity.test.ts` plays a whole game through it in Node,
  with no page.
- **Every realm's report** is built in `src/views/every-realms-report-and-the-lines-each-realm-reads.ts` (P1-12b3):
  `buildReports(whatTheReportsRead)` first writes every line's words (`theTurnsLinesInWords`, `src/views/prose/`,
  P1-12c3): a typed line records a fact, not words (its kind and fields; the kinds of an area are typed beside its code,
  the battles' in `engine/battle/the-facts-a-battles-lines-record.ts`, personal combat's in
  `engine/personal-combat/the-facts-a-personal-combats-lines-record.ts`, the sea lift's lines in a battle in
  `engine/units/the-facts-the-sea-lifts-battle-lines-record.ts`, a hero's death's in
  `engine/heroes/the-facts-a-heros-death-lines-record.ts`, the wanderer's escape's in
  `engine/the-facts-the-wanderers-escape-line-records.ts`, and since P1-12d6 the small order families' in
  `engine/orders/`, each beside its family's file (`the-facts-the-encounter-and-defend-orders-lines-record.ts`,
  `-order-dispatchs-`, `-item-orders-`, `-research-and-practice-orders-`, `-recruit-and-hire-orders-`; since P1-12d7
  `-army-orders-`, `-realm-works-orders-`, `-war-mastery-orders-`; since P1-12d8 `-espionage-orders-`,
  `-explore-and-search-orders-`; since P1-12d9 `-cast-spell-orders-`; since P1-12d10 `-move-orders-`), all of them in
  `LineFact`, each with its
  audience: the fight's, its hero's realm alone, or for a kind filed on its own the audience its event names), and the
  views write its words, one module per area, a `switch` over the kinds with a `never` default, so a kind with no words
  is a compile error. **The route by kind** (P1-12d5): `theWordsOf` reads, for a fact's kind, its area's words, from a
  table built from the areas' audience tables (each lists every kind its area has); a kind belongs to one area, and one
  declared in two is a compile error where `LineFact` is (`engine/turn/events-and-their-audiences.ts`). A new area adds
  its facts to `LineFact`'s list there, its audience table to the route and its words module beside the others. A battle's lines take their tiers (key or detail) and its losses tally its place from those words,
  as `emitBattle` did before. The result is the GM's log in words, in the form it was always stored in: `buildReports`
  returns it as `gmLog`, and the shell saves it. Since P1-12c6, `engine/battle/` and `engine/personal-combat/` write no
  line's words: every line they tell is a kind (the force markers, personal combat, a battle between heroes and the duel
  before it, a battle against a province's own defenders, a host gained in a province, a stalled battle, a war front,
  and the helpers that return a line: the kinship, Druid and command lines, the ladder and grid rows, the units' fates),
  and since P1-12d5 the lines a battle took as words from another folder's helper are kinds too (a unit disbanding, a
  battle's; a sea trap, a naval hold and the naval split, the sea lift's; a hero's death, its own; the wanderer's
  escape, his, whose die stays in the engine and the fact holds which sentence); since P1-12d6 the lines of five of
  `orders/`' families are kinds too (Encounter and Defend, the order dispatch's checks, the item orders, Research and
  Practice, Recruit and Hire: every line they write), since P1-12d7 three more (the army orders, the realm works, the
  war masteries), since P1-12d8 two more (espionage, explore and search), since P1-12d9 the Cast Spell order (every
  spell's line, with what the realm whose hero or province it touches is told: each keeps its audience) and since
  P1-12d10 the move order (every line of a march, a voyage and the battle on arrival it writes, the defence's forming-up
  that the battle's narrative takes among them): `orders/` hands no line's words of its own (personal combat's lines
  it passes on are that area's; the slain line `reportHeroFall` takes is still words its callers hand, Parked). A word helper that reads the world and still has an engine caller elsewhere is split in two where it is: a copy
  as the line tells it and its words on that copy alone, which the prose imports (`theSkillInPlayAsALineTellsIt` and
  `theWordsOfASkillInPlay` beside `skillInPlayNote`; since P1-12d8 `theStatShownAsALineTellsIt` and
  `theWordsOfAStatShown` beside `statNote`, `theOddsShownAsALineTellsIt` and `theWordsOfTheOddsShown` beside `oddsNote`:
  the copy holds only what the realm told may know, so a spy's Detection line's fact never holds a rival's hidden
  skill); once
  its last engine caller goes, its words move into the prose and the copy stays (`theBeastCommandAsALineTellsIt` in
  `world/tables.ts`, its words `theWordsOfABeastCommand` in the army orders' prose since P1-12d7). `logSplit`'s two
  halves, a line for the realm and its twin for onlookers, may each be words or a fact (P1-12d7).
  **A fact holds values, never words** (P1-12d; personal combat's since
  P1-12d2, a battle's since P1-12d3, the strength ladder's and the grid's since P1-12d4): a number, a flag, an id or a
  slug, a name as the world or the content holds it, and a copy of what a line's words read of the world (a fighter's
  skill or ward, a list of items, a hit-point rise, the units a battle's line names, its fortune), made as the line is told by a
  named function beside the kind; never a part of the world, and never a clause, a plural, a mark (✓, ✗), a join or a
  number formatted for reading, which the views write. A word helper the engine no longer calls moved into the prose
  (`pcSkillLabel`, `pcWardWord`, `pcPerkWord`, `pcWardIcon`; a battle's `aAn`, `n0`, `curseSkillLabel`,
  `fortuneNarrative` and the verbs a victory is told with, whose die stays in the engine: the fact holds which; the
  ladder's `ladderFm`, the grid's `shortUnit`, `UNIT_SHORT`, `GROUND_WORDS`, `battleGridStage` and `battleFacingStage`;
  a unit's `disbandLine` and `theClauseOfWhomAUnitFaced`; the wanderer's sentences, `_GARRETH_ESCAPES`);
  one it
  still calls (`fmtRoll`, `monsterCatLabel`, `hpGainLine`, `describeArmy`, `strandLabel`) the prose imports from the engine, on plain
  values, and a unit ability's name comes from its content row. `tests/static/a-lines-facts-hold-values-not-words.test.ts`
  checks each area done (its list grows a row at a time), but the labels it lists (P1-12d's next slice). The
  rest of the engine's lines still carry their words (P1-12d), and in this run a line's words are the same for every
  reader. Then it works out, for each played
  slot, the lines the realm reads (from the lines in words) and what it may see of the world, and builds its report
  from those two alone: **perception** comes first, in two functions, and the report
  reads nothing else (P1-12b5). `playerEvents(turnLog, G, realm, sight)` works out the lines: its own deeds, the lines
  sent to it or about its heroes, the world's announcements and what happened where it had eyes at the time, unmet
  realms left nameless, its spies' lingering sight and its Clairvoyance feed. `playerView(G, realm, itsLines)`
  (`views/what-each-realm-may-see-of-the-world.ts`, P1-12b4 and P1-12b5) is what the realm may see of the world, with
  the sight rules applied in that one place: the realm itself, the map's grid, and each province as it sees it (its
  own, a hero of its own there, spied, next to a spied one, next to its land, once visited, next to one it holds or
  visited, remembered, or not at all), with only what that sight shows, the features it knows and the heroes it sees
  there; its own heroes whole; the other heroes it sees (by the map's sight rule) and those beside its own; the dead
  it knows of; the mercenaries where it sees; the realms (named once met); the titles, worked out from the whole world
  and public from turn 5; its books (what its tax forecast and wages need of the world); and the player portal's
  lookup tables of every name's colour, untrimmed until P2-06. A figure that needs the whole world (a title, the
  discoveries' tax gold, a Wonder's blessing) is worked out there, by the engine's own function. Then
  `buildTurnReport(view, itsLines)` (`views/turn-report.ts`) builds the report from the view, and from the lines its
  chronicle, battle markers, province intelligence, spy activity and province events; it takes no state, so lint's
  `no-undef` refuses a read of the world there. Turn 0 and the tests' staged worlds build it from the view alone
  (`buildTurnReport(playerView(state, realm))`). They write nothing and draw no dice
  ([traps.md](../traps.md#views-never-write)).
- **`runTurn`**, the turn's shell (`src/ui/gm/turn-shell.ts`), loads the full world and every slot, checks the
  game is still on the turn the GM meant to run, then **clears the submitted orders in the database**
  (keeping a copy in memory) and stops if that fails. Only then does it draw the turn's seed and call `resolveTurn`.
  Then it:
  1. **saves the world with a conditional update** (`.eq('turn', n)`), stamped with when the turn ran
     (`turnRanAt`, and in deadline mode `nextDeadlineAt`): if another tab already resolved this turn, nothing
     is written and `_saveConflict` is set;
  2. sets `_turnCommitted=true` on the line after that save succeeds;
  3. calls the Spy-stealth step, then the views' `buildReports(resolved.whatTheReportsRead())`, and writes each realm's
     report, stamped with the build that
     wrote it (`engineStamp`), and its `turn_logs` snapshot, then the GM's log in words, as the views wrote it
     (`buildReports`' `gmLog`, with the stealth step's lines at its end), then telemetry.

  Steps 2–3 are **post-commit**: a failure there must never restore orders or retry the turn
  ([traps.md](../traps.md#post-commit-work-in-runturn)). Everything from the load to the save is in one `try`
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
  one browser from trying at once). Before running a due turn, the watcher reads `version.json` afresh
  and reloads the tab once (per game and turn) if it names another fingerprint for the GM page, first seen
  at least 10 minutes before, so the newest engine resolves it (`refreshIfNewerBuild`, [Versions](the-database-and-what-it-holds.md#versions)).
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
  `archeryBlockedBy`) and `unitAbilityMult` carry the rest, each asking the rule registry ([The rule registry](the-rule-registry-and-the-one-source-for-shared-rules.md#the-rule-registry)). Both battle paths score through deploy and facing, the stay-or-retreat
  estimate through grid and facing; the bots' estimates (`battleLineTotal`, at the middle width) through the
  grid alone. The report prints the grid as 📊 lines, which the portals draw in
  monospace, and the ladder names every place and matchup. **The ladder's and the grid's words are the prose's**
  (P1-12d4): `armStr`'s trace, the command multipliers, the whole force's multipliers, each unit's place
  (`battleRegrid`) and facing (`battleFaceSide`) record why a figure moved as a typed record (the records in
  `the-facts-a-battles-lines-record.ts`), and the rule registry's effects name an ability by its slug (with the key of
  its row's `wordsInTheLadder`, or the factor its words show); the ladder's lines hold copies of them, and
  `src/views/prose/the-words-of-a-battles-lines.ts` writes every label, each ability's name from its content row, and
  groups them as the ladder did.
- **Unit fates** (`rollUnitFates`, module level beside `disbandLine`). After a battle, each unit of a player's
  force rolls once for its fate (a beaten survivor twice); the four casualty sections (the attacker winning or
  losing against a province's guard, a realm battle's winner and loser) all call it, passing their own
  thresholds and verbs, and a test passes its own dice. Each line names whom the company fought
  (`battleFacedClauses`, a map read from the deploy's grids right after the deploy, before the stay-or-retreat
  estimate faces the survivors afresh: whom it faced as a record, read from the facing's kind, never its words; the
  line holds it beside the company's reference, and `theClauseOfWhomAUnitFaced` writes the clause); the losses tally (`battleTallyLine`) reads a line's owner and unit
  type from the company named first in it, which is always the company's own reference.
- **Dice and the clock** (P1-07). Every random number the GM portal's code draws (dice, shuffles, bot choices, the
  world map, id suffixes) comes from `kcRng()` (`src/engine/rng.ts`): one sfc32 generator, the first file of the
  page's main script, seeded once per page load from `crypto.getRandomValues`, or from the seed a test gives the page.
  Since P1-18d nothing in the engine or its views reads the clock: only the turn's shell does, through `kcClock()`
  (`src/engine/clock.ts`, `Date.now()` when called), to stamp when the turn ran; the screens read `Date` as before.
  Lint keeps `Math.random` and `Date` out of the source (P1-13c, below), and `engine-purity` checks that a whole game
  reads neither ([traps.md](../traps.md#dice-come-from-kcrng)). Each turn plays from its own seed (P1-18e): the shell
  (`runTurn`) draws a 32-bit integer from the page's dice, hands it to `resolveTurn`, and returns it (`{…, seed}`), for
  P2-01 to record. Since P1-08m the turn takes its seed: `resolveTurn` makes the dice of it (`kcRngStream(seed)`)
  once, lends them to itself (`kcRng.use`) and again to the Spy-stealth step, whose rolls carry on from the turn's, and
  gives back the dice in use before after each, also when it throws, so they are never lent across the
  shell's `await`s (P1-18e had the shell lend them; `tests/unit/the-turns-own-dice-from-its-seed.test.ts`). A mercenary
  band made in a turn gets its id from `newMercId()` in `resolveTurn`: `merc_t<turn>_<n>`, counted afresh each turn,
  with no dice or clock in it (P1-18b).
- **The engine's functions are modules by area; `resolveTurn` holds no rule of the game.** It is the save's parse
  and upgrades, the turn's context and its start values, the stages' calls, the phase loop calling its stages, and the
  reports. Find a function with the module map ([ARCHITECTURE.md](../ARCHITECTURE.md#the-layers-and-the-module-map))
  and a search for its name: the stages of the set-up, the phase loop, Early Winter, the turn's end and the new turn are
  in `engine/turn/` (and the titles' in `engine/titles/`); each order family's `resolve<Order>Order` is in
  `engine/orders/`, called by `processOrder(turnContext, c, o, ph)`
  (`engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts`: the checks before any order, then
  the `switch`); battles in `engine/battle/`, personal combat in `engine/personal-combat/`, heroes in `engine/heroes/`,
  the bots in `engine/bots/`, the map in `engine/world/`.
- **A helper that reads the turn's state takes the turn's context first**: `turnContext`, made by
  `createTurnContext(G, freshPlayers, expectedTurnToRun)` (`src/engine/turn/context.ts`, whose `TurnContext` is its
  type) just after the save is parsed. It holds the state and the GM's log (`turnLog`, which only `emit` writes: every
  line enters through it with its audience, in `engine/turn/events-and-their-audiences.ts`; there is no `log()`;
  [traps.md](../traps.md#a-line-goes-through-emit)), the collectors (`_tel`, `battleCommanders`, …), the movement
  pools (`movePoints`, `seaMovePoints`, …), `SEASONS`, `recruitedThisTurn`, `_intrusionAcc`, `_elvenEscapeQueue`,
  `presenceByPhase`, `clairWatch`, `_reports`, `_botPlayerIdx`, `_distCache`, `_warFrontAtStart`, `_warFrontProvs`,
  `lightLandMoves`, `lightSeaMoves`, `diploDeclarations`, `reckoningCalls`, `staleOrderWarnings`, `safeStartRefused`,
  `discoveryChoicePicks`, `playerMessages`, `_botEncounteredAtStart` and `whatTheSavesUpgradeFound` (what the save's
  upgrade found, [a saved game](a-saved-game-its-version-its-upgrade-its-check.md)), and the values the turn changes as
  it goes (`_logCtx`, `_currentPhase`, `_afterPhases`, `_combatSkillProv`, `_duelFoes`, `_battleSeq`,
  `_chieftainDuelGain`, `_deferredSkillLogs`, `_pcSimulating`, `enteredThisPhase`, `_tier0Open`, `_unitGainQueue`),
  read and written as `turnContext._currentPhase` everywhere, in `resolveTurn` too. Each joins on the line after
  `resolveTurn` declares it, or is made and joined by the stage before the first phase that first needs it (the
  movement pools, `lightLandMoves`, `lightSeaMoves`, `SEASONS`, `recruitedThisTurn`, `presenceByPhase`,
  `_intrusionAcc`, `_distCache`, `_warFrontAtStart` and `_warFrontProvs`). A helper that reads none keeps its own
  arguments. No dice and no clock in the context: the turn's dice are lent for its length.
- **The rules on plain values** (`engine/rules-on-plain-values/`: the rules of a hero, an army, an item, a level or a
  number) import only `src/content` and each other, so the player portal shares them through `src/shared/`
  ([the shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md#kingdoms-call-datats-the-one-source-for-shared-rules));
  the static test `rules-on-plain-values-import-only-the-content-and-each-other` refuses any other import there. The
  engine's callers import them there too. Where the portal still feeds in its own figure (the report's level of a
  hero's Druid, which counts a Crown of Command; the army card's own sea note), it is an open question for Toby.
- A lifted helper keeps `resolveTurn`'s indent. Tests call one directly in Node: `engineFn`, `turnContext` and
  `botWorld` in `tests/lib/engine.ts`, or on the engine's modules
  ([traps.md](../traps.md#a-lifted-helper-takes-the-turns-context-first)).

## Post-commit work in `runTurn`

The one `try` in `runTurn`, the turn's shell (`src/ui/gm/turn-shell.ts`), runs from the load through `resolveTurn`
to the conditional save and on to the reports. Everything after the save (reports, `turn_logs`, telemetry) runs
after the turn is already resolved and stored. A throw there must not restore orders, re-flag `orders_submitted`,
or let the watcher retry the turn: that combination once made live games resolve themselves once a minute.

- `_turnCommitted` marks that the save succeeded. Any code added after the save must respect it.
- **The reports are built after the save, never inside `resolveTurn`**. `resolveTurn` returns the Spy-stealth
  step and what the reports read (`whatTheReportsRead`, P1-12b3; the views' `buildReports` builds them from
  it: [Views never write](../traps.md#views-never-write)), and the shell calls them only once `_turnCommitted` is set. A report built before the save would
  make every report bug a failed turn: the orders put back and the turn tried again after every cooldown, for as
  long as the tab stayed open. `turn-shell`'s post-save guard plants a throw in `buildTurnReport` and checks that
  the turn stays saved.
- A save that answers with an error isn't proof that nothing was saved: a request can time out after the
  database committed it. The catch reads the game's turn again before it restores anything.
- `runTurn` **returns** `{ok, committed, conflict, error}` on every path; it doesn't throw. Callers must
  check the return value. A `try/catch` around the call almost never fires. A new early exit returns an
  outcome too, and `tests/page/turn-shell.test.ts` holds each failure's outcome.
- A retry loop around a deterministic engine needs a cooldown, not a retry (`_autoFailUntil`).

## Dice come from `kcRng()`

Every random number the GM portal's own code draws comes from `kcRng()` (`src/engine/rng.ts`, P1-07): one sfc32
generator per page, seeded once as the page loads, by the tests (`KC_RNG_SEED`, set by `tests/lib/boot.js`) or, on the
live site, from `crypto.getRandomValues`. Each turn rolls its own dice: the turn's shell draws a seed from
the page's dice and hands it to `resolveTurn`, which lends itself `kcRngStream(seed)` with `kcRng.use`, once for the
turn and once for the Spy-stealth step, giving the dice in use back after each. The reports (the views'
`buildReports`, since P1-12b3) are lent none: they draw none. Nothing in the engine or its views reads the time: only the
turn's shell does, through `kcClock()` (`src/engine/clock.ts`, which reads `Date.now()` when called), to stamp when
the turn ran. `engine-purity` plays a whole game in Node with a `Date` and a `Math.random` that throw.

- Don't write `Math.random` anywhere in `src/` (but `rng.ts`) or in `public/`'s scripts, or `Date` in `src/engine/`,
  `src/views/`, `src/content/`, `src/shared/` or `src/schemas/` (but `clock.ts`): lint refuses it, in your editor and
  in `npm run lint` (P1-13c; `window.Math.random` too). Pass the generator as `kcRng` (e.g.
  `shuffleP(list, kcRng)`); a date is `kcClock.date()`. The page's own screens (deadlines, "x minutes ago") still read
  `Date`.
- Adding, removing or moving one draw shifts every draw after it, so every balance game changes
  ([Order is data](../traps.md#order-is-data)). A pure move keeps each draw where it was.
- A test fixes dice through the page's hook, never through the page's `Math.random`: nothing in `src/` reads it, so
  such a test would pin nothing and still pass. `const was=W.kcRng.use(()=>0.5); try{ … } finally{ W.kcRng.use(was); }`
  draws from your function for a while; `W.kcRng.seed(n)` starts again from seed `n`.
- **Pinning the page's dice doesn't pin a turn's**. `runTurn` takes one number from them for the turn's seed
  and plays the turn on dice of its own, so a test that pins the page's dice around `runTurn` fixes only that seed. A
  test whose outcome rests on the dice is restaged instead: stage the state so that no roll decides it
  (`mercenary-ids` hires both bands back rather than leaving one in the pool, where it may retire at the end of the
  turn). To run a turn on chosen dice, call `resolveTurn` in Node with no seed and `kcRng.use` around it
  (`turn-shell`'s same-result test), or hand it the seed (`the-turns-own-dice-from-its-seed`). Given a seed, a turn
  draws nothing from the dice in use: a test's fixed dice don't reach it.
- Never lend the dice across an `await`. Another turn (the watcher's, or the GM's button on another game) can run in
  the gap and would draw from them, and the page could be handed the wrong dice back. `resolveTurn` lends them twice,
  for itself and for the Spy-stealth step, two synchronous calls, and gives them back in a `finally`.
- Code a test cuts out of the page and runs on its own needs a `kcRng` or `kcClock` of its own (`home-placement`,
  `leaderboard-records`).
- Keep the generator in an object's property (`_kcRng.next`), not in a top-level `let`. With a `let`, V8 (Node 24.22)
  sometimes runs an optimised `kcRng` built against the old value: after `kcRng.seed` or `kcRng.use`, the dice quietly
  go back to the old stream. It showed in about 1 run in 20 of `rng`'s reseed test, and in 13 of 60,000 reseeds under
  stress; the property form showed none. P1-09 makes `rng` a module: keep the state in an object there too.
