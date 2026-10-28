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
- **Engine functions are lifted out of `resolveTurn` one area at a time** (P1-08, done in P1-08n). It is the save's
  parse and upgrades, the turn's context and its start values, the stages' calls, the phase loop calling its stages and
  the reports: no rule of the game is written in it. No test reaches inside it by a source line any more (P1-09a): a
  test stands a top-level function in, in the engine's bare vm, or reads `src/` by its syntax tree
  ([traps.md](../traps.md#string-anchor-harness-hooks)). A lifted helper that reads the turn's state takes **the
  turn's context** first: `turnContext`, made by `createTurnContext(G, freshPlayers, expectedTurnToRun)`
  (`src/engine/turn/context.ts`, whose `TurnContext` is its type since P1-10a2) just after the save is parsed. It holds the state and the GM's log (`turnLog`, which only `emit` writes, since P1-12a2: every line enters through it with its audience, in `engine/turn/events-and-their-audiences.ts`; since P1-12a4 there is no `log()`; [traps.md](../traps.md#a-line-goes-through-emit)),
  the collectors (`_tel`, `battleCommanders`, …), the movement pools (`movePoints`, `seaMovePoints`, …), `SEASONS`,
  `recruitedThisTurn`, `_intrusionAcc`, `_elvenEscapeQueue`, since P1-08d `presenceByPhase`, `clairWatch` and `_reports`, since P1-08e `_botPlayerIdx`, since P1-08i1 `_distCache`, since P1-08i3 `_warFrontAtStart` and `_warFrontProvs`, since P1-08j1 `lightLandMoves` and `lightSeaMoves`, since P1-08k4 `diploDeclarations` and `reckoningCalls`, since P1-08k7 `staleOrderWarnings`, `safeStartRefused`, `discoveryChoicePicks` and `playerMessages`, since P1-08l1 `_botEncounteredAtStart`, and since P1-15a `whatTheSavesUpgradeFound` (what the save's upgrade found, [below](a-saved-game-its-version-its-upgrade-its-check.md#a-saved-game-its-version-its-upgrade-its-check)) (each joins by reference on the line after `resolveTurn` declares it; since P1-08k8 the movement pools, `lightLandMoves`, `lightSeaMoves`, `SEASONS`, `recruitedThisTurn`, `presenceByPhase`, `_intrusionAcc`, `_distCache`, `_warFrontAtStart` and `_warFrontProvs` are made, and joined, by the stage before the first phase that first needs them), and the values the turn changes as it goes (`_logCtx`,
  `_currentPhase`, `_afterPhases`, since P1-08c `_combatSkillProv`, `_duelFoes`, `_battleSeq`, `_chieftainDuelGain`,
  `_deferredSkillLogs`, `_pcSimulating`, since P1-08i1 `enteredThisPhase`, and since P1-08i3 `_tier0Open` and `_unitGainQueue`), which are read and written as `turnContext._currentPhase` everywhere, in
  `resolveTurn` too. A helper that reads none keeps its own arguments. No dice and no clock in it: the turn's dice are
  lent for its length (P1-08m: passing them through the helpers would touch nearly every engine file for no change in
  play; revisit at P1-09). Lifted so
  far (P1-08a): the line helpers and the turn's records (`engine/turn/`), relations and captures
  (`engine/realms/relations-and-captures.ts`), the title lookups and battle merit
  (`engine/titles/title-holders-and-battle-merit.ts`), skills in play and hidden heroes
  (`engine/heroes/effective-skills-and-hidden-heroes.ts`), the discovery helpers (`engine/discoveries.ts`), `rng`, `pick`
  and `describeArmy` (`engine/dice-and-army-names.ts`), and `pcFoeCat` (`engine/personal-combat/helpers.ts`; in `engine/titles/perks.ts` since P1-13e2, to break a cycle). P1-08b: terrain, sea and a unit's strength (`armStr`,
  `engine/battle/terrain-and-unit-strength.ts`), sea lift, stranding and retreats
  (`engine/units/sea-lift-stranding-and-retreats.ts`), the movement pools (`engine/units/movement-pools.ts`), recruit
  limits (`engine/units/recruit-limits.ts`), the best commander (`engine/battle/best-commander.ts`), the intrusion
  warnings (`engine/turn/intrusion-warnings.ts`), the Plague and the Bless ward (`engine/magic/plague-and-bless-ward.ts`),
  `provName`, `provOf` and `neighborInDir` (`engine/world/map-helpers.ts`), and `healFeatureMonsters`
  (`engine/chances-and-lair-grades.ts`); the constants they read (`TERRAIN_MODS`, `HEX_DIRS`, `REIGN_OF_FEAR_MULT`, …)
  are top-level constants now, beside them. P1-08c: experience, skill rises and earned HP (`trySkillGain`,
  `engine/heroes/experience-skill-rises-and-earned-hp.ts`, with `SKILLGAIN_STD` and `SKILLGAIN_COMMON`), battle report
  lines and force markers (`emitBattle`, `engine/battle/battle-report-lines-and-force-markers.ts`), Evil Terror
  (`engine/battle/evil-terror.ts`), the pre-battle spell choice (`engine/magic/pre-battle-spell-choice.ts`), Blood Harvest
  and the Iron Throne (`engine/battle/blood-harvest-and-iron-throne.ts`), Raid the Coast and landing parties
  (`engine/battle/raid-the-coast-and-landing-parties.ts`), what a spy learns (`engine/espionage/what-a-spy-learns.ts`),
  graves and fallen heroes (`engine/graves.ts`), and `noteBattleLoss`
  (`engine/turn/mercenary-ids-and-battle-records.ts`). P1-08d: every realm's report and the Spy-stealth rolls
  (`buildReports`, then in `engine/turn/realm-reports-and-spy-stealth.ts`; since P1-12b2 the rolls are a step of their
  own, `spyStealthAndInvisibilityStampedForTheReports`, in `run-turn.ts` since P1-12b3, when the reports moved into
  `src/views/every-realms-report-and-the-lines-each-realm-reads.ts`). P1-08e: personal combat, the `pc*` family up to `resolvePersonalCombat`, in six files under
  `engine/personal-combat/` (speed, encounter plans and combatants; to-hit, wounds, stuns and courage; combat spells and
  guardian abilities; melee, flight and archery; tactics, combat items and each action; the fight), beside `helpers.ts`;
  tests take them through `tests/lib/personal-combat.ts` (from their modules, imported directly, since P1-14b). P1-08f: duels and character encounters (`resolveDuel`,
  `resolveCharVsChar`, the flee spoils, `engine/personal-combat/duels-and-character-encounters.ts`), lair guardians and
  the Hunting Rumours odds (`resolveEncounter`, `pcBuildGuardian`, `simulateLairOdds`,
  `engine/personal-combat/lair-guardians-and-the-odds.ts`), and hero death and leaderless hosts (`handleHeroDeath`,
  `reportHeroFall`, `disperseDeadCharArmies`, `engine/heroes/hero-death-and-leaderless-hosts.ts`). P1-08g: a host's
  battle against a province's defenders with no realm's hero among them (`combatVsNPC`,
  `engine/battle/battles-against-province-defenders.ts`, with the constants both battle paths read: the carry-on death
  scaling, the airborne-at-sea penalties, the narrative verbs; `BATTLE_ARMY_SPELLS`, the winged riders' strikes, is in content since P1-19l), and the duel before a battle
  (`preBattleDuel`, `engine/battle/pre-battle-duels.ts`). P1-08h: the battle between two heroes' hosts (`combatVsChar`,
  `engine/battle/battles-between-heroes.ts`). P1-08i1: the phase pipeline before anyone acts (`buildPhaseIntents`,
  `orderPhaseActors`, `applyMoveInterlocks`, with `PHASE_ACTION_MAP`, `engine/turn/phase-intents-and-dependency-ordering.ts`),
  routes and distances (`provDistance`, `stepToward`, `stepTowardPreferSafe`, `engine/world/routes-and-distances.ts`),
  the province bookkeeping and rallied garrisons (`reconcileProvinceCharacters`, `updateProvinceMemory`, `noteEntered`,
  `settleRalliedGarrisons`, `engine/world/province-bookkeeping-and-rallied-garrisons.ts`), and
  `flushIntrusionNotifications` (beside the warnings it writes, `engine/turn/intrusion-warnings.ts`). P1-08i2: the Defend
  watch (the ride-outs `runDefendReactions` and `runDefendMaterializedReactions`, `defendAnswerUnitGain` for a host
  raised next door, the lone hero's `runDefendAmbush`, `reconcileDefendRideOuts`, and the column hurried in,
  `runReinforcementArrivals`, `engine/units/defend-ride-outs-ambushes-and-reinforcements.ts`). P1-08i3, the last phase
  helpers: stalled battles and a beaten guard's survivors (`resolveStalledBattles`, `erodeGuardSurvivors`,
  `engine/battle/stalled-battles-and-beaten-guards.ts`), a host gained in a province (`resolveUnitGainInProvince`,
  `engine/battle/hosts-gained-in-a-province.ts`, where `erodeGuardSurvivors` moved in P1-13e1, to break a cycle), pursuits (`advancePursuit`, `pursuitCatchChance`, `endPursuit`,
  `engine/heroes/pursuits-and-the-catch-roll.ts`), war fronts and stand-offs (`warFrontThreats`, `resolveWarFronts`,
  `flagEnemyStandoffs`, `engine/battle/war-fronts-and-enemy-stand-offs.ts`), and `syncAllMaxHp` (beside the earned-HP
  helpers, `engine/heroes/experience-skill-rises-and-earned-hp.ts`). P1-08j1, the first order taken out of `processOrder`
  (an extract, not a move: the case's body became a function, its own `break`s `return`s): the Move
  (`resolveMoveOrder(turnContext, c, ph, _fmSlip, target, prov, player)`,
  `engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts`), which takes, after the context, the values
  `processOrder` works out before its `switch` that it reads; `case 'move'` is the call and `break`. P1-08j2, the explore and search orders
  (`engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts`), extracted the same way, each with only
  the values it reads: Explore (`resolveExploreOrder`), Perform Rite (`resolvePerformRiteOrder`), Hunting Rumours
  (`resolveHuntingRumoursOrder`), Search Lair (`resolveSearchLairOrder`), Chart the Unknown
  (`resolveChartTheUnknownOrder`) and Discover Lost Ruin (`resolveDiscoverLostRuinOrder`). P1-08j3, recruiting and
  hiring (`engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.ts`: Recruit Armies,
  `resolveRecruitArmiesOrder`; Hire Hero, `resolveHireHeroOrder`; and `landHirePreOrders`, which lands the orders a realm
  wrote for a hero once he is sworn, moved out of `resolveTurn` beside them) and the realm's works
  (`engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts`: Consecrate, Call to Arms,
  Broker, Harvest the Field, Awaken Grove, Wild Calling, Grand Design, and one function for the refusal of the removed
  Awaken the Wild and Call from the Pit, whose two `case` labels both call it). P1-08j4, research and practice
  (`engine/orders/research-and-practice-orders-discoveries-skill-drills-and-rest.ts`: Research, `resolveResearchOrder`;
  Practice Skill, `resolvePracticeSkillOrder`; Rest, `resolveRestOrder`; Research Breakthrough,
  `resolveResearchBreakthroughOrder`); a bot's Practice on a skill already at 5 is still switched in `processOrder`,
  before the call. P1-08j5, items and armies (`engine/orders/item-orders-equip-use-and-send-magic-items.ts`: Equip
  Items, `resolveEquipItemsOrder`; Use Item, `resolveUseItemOrder`; Send Item, `resolveSendItemOrder`; and
  `engine/orders/army-orders-hand-over-garrison-disband-and-pick-up-companies-and-release-a-hero.ts`: Leave/Transfer
  Army, `resolveLeaveOrTransferArmyOrder`; Release Hero, `resolveReleaseHeroOrder`; Disband Army,
  `resolveDisbandArmyOrder`; Pick Up Army, `resolvePickUpArmyOrder`); a spell item's Use Item still becomes a Cast Spell
  in `processOrder`, before the `switch`. P1-08j6, espionage
  (`engine/orders/espionage-orders-spy-steal-sabotage-grand-heist-assassinate-and-vanish.ts`: Spy, `resolveSpyOrder`;
  Steal, `resolveStealOrder`; Sabotage, `resolveSabotageOrder`; Grand Heist, `resolveGrandHeistOrder`; Assassinate,
  `resolveAssassinateOrder`; Vanish, `resolveVanishOrder`; and the two helpers they share, nested in `processOrder`
  until then: `thiefCaughtScuffle` and `liftRandomItem`, each now a top-level function taking the context, then what it
  closed over of `processOrder`'s, then its own arguments). P1-08j7, Cast Spell
  (`engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts`: `resolveCastSpellOrder`,
  the casting and every spell a hero can work as a phase order; and the helper a failed Charm calls, nested in
  `processOrder` until then: `charmBacklash`, with its constant `CHARM_BACKLASH_PCT` now top-level); the spell item's
  Use Item that `processOrder` turns into a cast arrives as its last argument (`_itemCast`). P1-08j8, the war orders
  (`engine/orders/encounter-and-defend-orders-chasing-a-hero-down-and-keeping-watch.ts`: Encounter Character,
  `resolveEncounterCharacterOrder`, which sets the chase and takes its first step, the rest being `advancePursuit`'s in
  each later phase; Defend, `resolveDefendOrder`, which sets or keeps the watch the Defend family carries out; and
  `engine/orders/war-mastery-orders-challenge-rampage-volleys-tactics-blockade-and-coast-raids.ts`: Blockade,
  Challenge, Rampage, Rain of Arrows, Sniper's Mark, Feigned Retreat, Grand Stratagem, Lightning Advance and Raid the
  Coast, one function each); the once-a-turn check before a mastery stays in `processOrder`. P1-08j9 moved `processOrder`
  itself out of `resolveTurn` (a move, as rows a to i3 moved functions: `processOrder(turnContext,c,o,ph)`,
  `engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts`): the checks before any order (a hero
  carried into another's assault, the bots' Practice and Search switches, the battle lock, a charmed hero's refusals,
  a mastery once a turn, the Forced March, a spell item's cast), then the `switch` that calls each order's function;
  the phase loop calls it for each hero in each phase. P1-08k1 took the phase loop's four stages out of
  `resolveTurn` as functions of their statements, in
  `engine/turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.ts`: the start of the phase
  (`startPhaseHealingSnapshotsAndStalledBattles`), intents and reactions (`pinAndReactToPhaseIntents`), the orders in
  two tiers around the Defend step (`resolvePhaseOrdersInTwoTiersAroundTheDefendStep`) and the end of the phase
  (`endPhaseSkillRisesFallenCommandersAndProvinceMemory`); the loop keeps the phase, where each hero stood as it began,
  the intents, Early Winter and the province lists' check. P1-08k2 took Early Winter out the same way, the body of the
  loop's `if(ph===4){…}`, in `engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts`
  (`earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill`, taking only the context): a charmed hero goes home,
  then the taxes, the wages (and what a realm that can't pay loses), Raiders' Muster and the garrison drill. P1-08k3 took the
  first stage out of `resolveTurn`'s own body, what the turn settles once the loop is over, in
  `engine/turn/after-the-phases-stand-offs-the-dead-graves-couriers-mass-healing-cowards-and-location-names.ts`
  (`afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames`, taking only the context): a last
  stand-off flagged, the dead without a master crumbling, graves sensed, neutral heroes learning, lost consecrations,
  couriers, Elven escapes, fallen commanders' hosts, intrusions told once, lair guardians healed, Mass Healing, maximum
  HP, spared cowards going home and location names. P1-08k4 took the next two stages out, in
  `engine/turn/diplomacy-resolution-and-victory-the-reckoning-elimination-concession-and-the-announcement.ts`:
  diplomacy resolution (`diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings`: overtures told, peace,
  alliances and wars made or broken, war-front warnings) and victory
  (`victoryTheReckoningEliminationConcessionAndTheAnnouncement`: the Reckoning, elimination, concession, the result
  announced), each taking only the context; the realms' declarations and Reckoning calls, collected where their orders
  are merged, join the context for them. P1-08k5a took the first part of the new turn out, in
  `engine/turn/new-turn-counter-king-succession-summons-and-spells-end-and-the-grand-designs.ts`
  (`newTurnCounterKingSuccessionSummonsAndSpellsEndAndTheGrandDesigns`, taking only the context): the turn counter, a
  Divine king's lost return, an heir crowned, summons and one-turn spells ending, and the Grand Designs' skeleton rises
  and Grand Library. P1-08k5b took the rest of the new turn out, in
  `engine/turn/new-turn-war-academy-informants-divine-resurrection-graves-mercenaries-wanderers-and-the-final-reconcile.ts`
  (`newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile`, taking only the
  context): the War Academy's drills, the gardens' mending, the Informant Network and the Arcane Observatory, the
  Divine return, graves rotting, the mercenary bands, the clean-up and the save's repair lines, wandering heroes'
  drift, the turn's orders cleared, the final reconcile and the stranded guards. P1-08k6 took the last two stages
  out, the titles at the turn's end, once immediately-invoked functions and named functions now, in
  `engine/titles/title-intel-for-each-holder-and-the-titles-won-and-lost-this-turn.ts`
  (`imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy` and
  `titleChangesTheTitlesEachRealmWonAndLostSinceLastTurn`, each taking only the context): each title holder's intel of
  the realms it has met, from turn 5, and the titles each realm won and lost since last turn. P1-08k7 took the
  set-up's first two stages out, in `engine/turn/set-up-the-turns-start-repairs-and-the-merge-of-the-realms-orders.ts`
  (`turnStartRepairsAndAFreshSlateOfOrdersForEveryHero` and
  `mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans`, each taking only the context): the save's
  repairs at the turn's start and every hero's orders cleared, then the realms' submitted orders, declarations,
  research choices, Reckoning calls, messages, concessions, encounter plans and heirs' skills merged in; the merge's
  collectors join the context for it. P1-08k8 took the four stages before the first phase out, in
  `engine/turn/before-the-first-phase-war-without-warning-research-choices-messages-move-pools-and-default-defend.ts`
  (`relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks`,
  `warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages`,
  `movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan` and
  `missingOrdersDefaultToDefendTheOrdersRecordAndTheWarFrontsAtTheStart`, each taking only the context): last turn's
  research choices settled; war without warning, the titles held, the merge's lines, the GM's removals and the
  messages; the move pools, the turn's trackers and the save's sweeps; and, after the bots' passes, every empty phase
  Defend, the record of orders and the war fronts at the start. `resolveTurn` keeps between them the bots' code
  (P1-08l) and the turn's start values. P1-08l1 took the bots' diplomacy out, the first of the bots'
  code, in `engine/bots/bot-diplomacy-treats-and-wars-by-alignment-the-grudge-and-a-reckoning-claim.ts`
  (`botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim`, taking only the context): each bot realm's Treat or war on each
  rival it had met when the turn began (`_botEncounteredAtStart`, which joins the context for it), by alignment, the
  grudge and a Reckoning claim; `resolveTurn` calls it before the first phase and again just before diplomacy is
  resolved. P1-08l2 took the bots' plan out, in
  `engine/bots/bot-realms-plan-the-turn-concessions-movement-muster-economy-actions-hygiene-the-reckoning-and-the-duel-forecast.ts`
  (`botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning`, taking only the
  context, and `botHuntersDuelForecastFoughtOnCopiesOfBothHeroes(turnContext, hunter, quarry, n)`): the eight passes
  in which the bot realms decide their turn, between the move pools and the default to Defend, and the duel forecast
  the movement pass is handed; and it moved the merge's six collectors into the merge, which makes them each turn.
  P1-08n made the last two lines of set-up rules named functions in the set-up's file, beside the stages they come
  before: `lastTurnsBattleAndDuelSwordsClearedFromTheMap(G)` (as the save is read, with its upgrades: the map's
  crossed swords the save still holds from last turn) and `everyRealmStampedBotOrHumanFromTheBotSlotRows`, taking only
  the context (each realm's bot flag, from the slot rows); and removed a test hook nothing read (`window._kcTest`).
  P1-11a1 gave the two casting limits one function each, in
  `engine/rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts`:
  `actionSpellsAllowedPerSchoolEachTurn(level)` (the Cast Spell order and the bots call it; the Warlock's extra cast is
  added beside the call) and `combatSpellsAllowedPerSchoolEachFight(level)` (personal combat calls it). It is the
  first file of `engine/rules-on-plain-values/`, the rules of a hero, an army, an item, a level or a number, whose files
  import only `src/content` and each other, so the player portal can share them (P1-11a).
  P1-11a3 moved into it the 14 engine functions the player portal restates, with the tables and helpers they read, in
  seven files by topic: `a-number-shown-to-a-player-rounded-down.ts` (`dispFloor`), `unit-types-and-base-strength.ts`
  (`unitTypeOf`, `unitBaseStrength`, `UNIT_BASE_STR`, `UNIT_Q_MULT`),
  `units-that-fly-sail-or-can-be-carried-through-the-air.ts` (`isAirCarriable`, `getFlyCapability` and the unit-class
  sets `FLYING_TYPES`, `AERIAL_TYPES`, `CREATURE_ARMIES`, `MONSTER_ARMIES`, `CARRIER_TYPES`, `PRIMAL_SEA_TYPES`,
  `SEA_TYPES`, `CAVALRY_TYPES`), `items-slots-races-and-who-may-use-them.ts` (`isLegendaryItem`, `itemSlot`,
  `itemRaceOf`, `itemUsableBy` and their tables), `alignments-and-a-wandering-heros-hire-wage.ts` (`ALIGNMENTS_P`,
  `alignDistP`, `heroSkillTotal`, `heroSkillWage`, `heroHireWage`), `skills-in-order-and-a-heros-fame-in-words.ts`
  (`ALL_SKILLS`, `skillFameLabelM`, `topSkillOf`) and `a-games-settings-read-from-its-row.ts` (`gameMetaOf`). Every
  caller, in the engine, the views, the GM portal and `src/db/`, imports them there; the static test
  `rules-on-plain-values-import-only-the-content-and-each-other` refuses any other import in the folder. The move
  changed the order in which some engine files run as a page loads (a file runs where its first importer pulls it in),
  but every table holds the same values once the page has loaded. P1-11a4 swapped the player portal's 16 copies of
  them for these functions, which it imports through `src/shared/`
  ([above](the-rule-registry-and-the-one-source-for-shared-rules.md#kingdoms-call-datats-the-one-source-for-shared-rules)).
  P1-11b2 added `beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts`: which units count against a hero's beast
  command (`countsAgainstBeastCommand`, on a unit as its realm sees it: `skeletal`, `temporary`, `wildHunt`, as the
  turn report names them; `unitAsItsRealmSeesIt` makes that shape from the engine's unit), the Druid table
  (`DRUID_ARMY_LEVELS_P`, `getDruidLevel`), the tamed flyers (`TAMED_FLYER_TYPES_D`), the waivers once
  (`druidNeedWaivedByAlignment`, `druidLevelALeaderNeeds`), the same-race rule, the shortfall and the strength it
  leaves (`strengthLeftByADruidShortfall`), and the Druid mastery's constants and sum. The engine's
  `beastCommandCount`, `druIdPenaltyMult` and `druidMasteryGain` call them, each working out the leader's Druid
  itself (from his skills and items). The turn report asks `getFlyCapability` whether a column takes to the air,
  where it kept its own copy. P1-11b3 swapped the player portal's beast count and Druid table for them: the army card
  counts beasts with `countsAgainstBeastCommand` and works out its Druid lines with the shortfall's and the mastery's
  functions, and `druidNeedP` asks `druidLevelALeaderNeeds`, each feeding in the portal's own level of the hero's Druid
  (the report's, which counts a Crown of Command: question 13 for Toby).
  P1-11b4 added `ships-and-flyers-that-carry-a-column-across-the-sea.ts`: the berths a unit offers (`carrierBerths`,
  moved from `engine/units/movement.ts`), which units take half a hull (`takesHalfAHullAboard`), and whether a column
  can put to sea with the figures the answer comes from (`seaLiftOfAColumn`: its berths, with the leader's Naval 8
  mastery, its land units, the units that must sail, its humanoid flyers, the hulls' room left and the units left
  ashore). That was `getSeaCapability`'s body; `getSeaCapability` (`engine/units/movement-pools.ts`) is now its
  wrapper, which works out the leader's mastery from his skills. The player portal's Move notice (`poSeaAnalysis`)
  counts through it, handing in the mastery from the report's skills and counting a unit it can't type in advance as
  light foot; the army card's own sea note stays as it is (question 15 for Toby).
  A lifted helper keeps `resolveTurn`'s indent. Tests call one directly in Node: `engineFn`, `turnContext` and `botWorld` in
  `tests/lib/engine.ts` ([traps.md](../traps.md#a-lifted-helper-takes-the-turns-context-first)).
