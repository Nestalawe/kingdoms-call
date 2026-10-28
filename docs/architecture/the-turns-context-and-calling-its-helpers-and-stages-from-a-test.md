# The turn's context, and calling its helpers and stages from a test

What a helper, an order or a stage of the turn takes, and what a test that calls one directly does first. The trap in brief: [traps.md](../traps.md#a-lifted-helper-takes-the-turns-context-first). Where each area lives: [the turn engine](the-turn-engine.md).

## What `resolveTurn` calls, in order

`resolveTurn` (`src/engine/run-turn.ts`) is the stages' calls. Between them it keeps only the bots' calls and the
turn's start values. Each stage takes the context, and the phase loop's stages also take the loop's values they read.
Search a name to find its file. In order:

1. **As the save is read**, with its upgrades: `lastTurnsBattleAndDuelSwordsClearedFromTheMap(G)` clears the map's
   crossed swords from last turn, and `everyRealmStampedBotOrHumanFromTheBotSlotRows` stamps each realm's bot flag
   from the slot rows.
2. **The set-up** (`engine/turn/set-up-…`): `turnStartRepairsAndAFreshSlateOfOrdersForEveryHero` (the save's repairs,
   every hero's orders cleared), then `mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans` (orders,
   declarations, research choices, Reckoning calls, messages, concessions, encounter plans and heirs' skills).
3. **Before the first phase** (`engine/turn/before-the-first-phase-…`):
   - `relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks`;
   - the bots' diplomacy, `botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim`;
   - `warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages`;
   - `movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan`;
   - the bots' plan, between the move pools and the default to Defend:
     `botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning` (eight passes);
   - `missingOrdersDefaultToDefendTheOrdersRecordAndTheWarFrontsAtTheStart` (every empty phase Defend, the record of
     orders, the war fronts at the start).
4. **The phase loop**, five phases (`engine/turn/phase-stages-…`). The loop keeps the phase, where each hero stood as
   it began, and the intents (`buildPhaseIntents`, between the first two stages). Each phase runs:
   - `startPhaseHealingSnapshotsAndStalledBattles`;
   - `pinAndReactToPhaseIntents`;
   - `resolvePhaseOrdersInTwoTiersAroundTheDefendStep`, which calls `processOrder` for each hero;
   - `endPhaseSkillRisesFallenCommandersAndProvinceMemory`;
   - in the last phase, Early Winter, `earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill`: a charmed hero
     goes home, then the taxes, the wages (and what a realm that can't pay loses), Raiders' Muster and the garrison
     drill;
   - then `syncAllMaxHp`.
5. **After the phases:** `afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames`, then the
   bots' diplomacy again (for a rival met late).
6. **Diplomacy and victory:** `diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings`, then
   `victoryTheReckoningEliminationConcessionAndTheAnnouncement`.
7. **The new turn, in two parts:**
   - `newTurnCounterKingSuccessionSummonsAndSpellsEndAndTheGrandDesigns` (the turn counter, a Divine king's lost
     return, an heir crowned, summons and one-turn spells ending, the Grand Designs);
   - `newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile` (drills, informants,
     the Divine return, graves, mercenaries, the clean-up and the save's repair lines, wanderers, the turn's orders
     cleared, the final reconcile and the stranded guards).
8. **The titles at the turn's end** (`engine/titles/`): `imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy`
   (each holder's intel, from turn 5), then `titleChangesTheTitlesEachRealmWonAndLostSinceLastTurn`.

**`processOrder(turnContext, c, o, ph)`** (`engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts`)
makes the checks that come before any order. In order:
- a hero carried into another's battle this phase is superseded;
- a bot's Practice on a skill already at 5 switches skill, and a bot's Search that can't go ahead becomes a Rest;
- a Move or an Encounter out of an unresolved battle is refused;
- a charmed enemy hero won't disband, perform the rites or spend a mastery;
- a mastery is charged once a turn;
- a Forced March becomes a Move that may slip past a battle;
- a spell item's Use Item becomes a Cast Spell, handed to `resolveCastSpellOrder` as its last argument (`_itemCast`).

Then the `switch` hands the order to its own function in `engine/orders/`. Which function and which module each
order's is: the module map and a search for `resolve<Order>Order`.

## A lifted helper takes the turn's context first

A helper lifted out of `resolveTurn` that reads the turn's state takes `turnContext` as its first argument
(`src/engine/turn/context.ts`; [the turn engine](the-turn-engine.md#the-turn-engine-gm-portal)).

- A call that leaves it out doesn't fail: every argument moves along by one, and the helper quietly reads the wrong
  thing. `no-undef` can't see it. The balance matrix catches it in the code it runs; anywhere else, a direct test.
- A helper passed as a value is wrapped where it's passed: `(...a)=>effStat(turnContext,...a)`. A test hook that hands
  one back wraps it the same way, or the test moves down and calls it directly (P1-08b moved `naval-retreat`,
  `retreat-dry-ground`, `march-one-rate` and most of `battle-tweaks` to `tests/unit/`; P1-08c `terror-three-stacks` and
  `xp-naval-passenger`; P1-08e the personal-combat tests, through `tests/lib/personal-combat.ts`, whose `call()` gives a
  helper that takes the context one on a new world; P1-08f the personal-combat fuzz, `fuzz-personal-combat`, and
  `fallen-commander-host`, out of `battle-faced-turn`; P1-08g `npc-parity`, which calls `combatVsNPC` on a fresh
  context for each staged battle; P1-08i3 `encounter-seventy`, and `battle-faced-turn`'s erosion part into
  `stalled-battles-unit-gain-and-war-fronts`). A hook that also needs a function still nested hands back the lifted ones
  wrapped, or leaves them to a test of their own. A test that only watches the calls to a lifted helper wraps the
  top-level function instead of hooking its first line: the `xp-` tests' `XP_RECORD` wraps `trySkillGain`; one that changes what a helper is
  given wraps it the same way: `lib/scenario-in-the-vm.ts`' `reportEveryRealm` wraps the views' `buildReports` (P1-08d, on
  the page's `lib/boot.js` until P1-09a), and `pursuit-one-battle` wraps
  `pursuitCatchChance` for a certain catch. A `typeof f==='function'` guard
  stays true: a lifted helper is a top-level function.
- A value the turn changes as it goes (`_logCtx`, `_currentPhase`, `_afterPhases`, since P1-08c `_combatSkillProv`,
  `_duelFoes`, `_battleSeq`, `_chieftainDuelGain`, `_deferredSkillLogs`, `_pcSimulating`, since P1-08i1
  `enteredThisPhase`, and since P1-08i3 `_tier0Open` and `_unitGainQueue`) lives only in the context. Read and
  write `turnContext._currentPhase`, never a copy in a local, or a later reader sees an old value. A test hook that
  changes one, or swaps `G`, changes the context's too (`battle-faced-turn`'s `setG` did, until P1-08i3; `npc-parity`'s
  `setPhase` did, until P1-08g moved it down).
- An order taken out of `processOrder` (since P1-08j1: the Move, `resolveMoveOrder`; since P1-08j2 the explore and
  search orders; since P1-08j3 recruiting, hiring and the realm's works; since P1-08j4 research and practice; since P1-08j5 items and armies; since P1-08j6 espionage; since P1-08j7 Cast Spell; since P1-08j8 the war orders) takes, after the context, the values `processOrder` works out before its `switch` that the order
  reads, in the order they're declared there (the Move's `c, ph, _fmSlip, target, prov, player`; Explore's only
  `c, prov`). So the calls differ from order to order. The case is the call and `break`, and a `return` in the order
  ends it, as the case's own `break` did: nothing follows the `switch`. Keep the call in step with the function: two
  arguments swapped (`prov` and `player`, or `target` and `extra`) pass `no-undef` and every check but a test that
  plays the order (`scenario/move-orders-in-a-whole-turn`, `scenario/explore-and-search-orders-in-a-whole-turn`,
  `scenario/recruit-hire-and-realm-works-orders-in-a-whole-turn`, `scenario/research-and-practice-orders-in-a-whole-turn`,
  `scenario/item-and-army-orders-in-a-whole-turn`, `scenario/espionage-orders-in-a-whole-turn`,
  `scenario/cast-spell-order-in-a-whole-turn`, `scenario/war-orders-in-a-whole-turn`). A helper nested in `processOrder` that leaves with them takes the
  context, then the values of `processOrder`'s it closed over, then its own arguments (since P1-08j6:
  `thiefCaughtScuffle(turnContext, prov, thief, victim, what)`; since P1-08j7: `charmBacklash(turnContext, prov, caster,
  t, why)`), and a `processOrder` constant only it reads becomes a top-level constant (`CHARM_BACKLASH_PCT`). Since
  P1-08j9 `processOrder` is top-level itself (`processOrder(turnContext,c,o,ph)`), so a test can call it, or stand in an
  order's function in the `vm` to see what it is handed: `unit/order-dispatch-called-directly` checks every call's
  arguments that way.
- A stage of the phase loop taken out of `resolveTurn` (since P1-08k1: the start of the phase, intents and reactions,
  the orders in two tiers, the end of the phase, in
  `engine/turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.ts`) is a function of its statements,
  taking the context, then the loop's values it reads, in the order the loop declares them (`ph`, `_phaseStartLoc`,
  `intents`): those stay declared in the loop and are passed in. A stage that reads none of them takes the context alone
  (P1-08k2's Early Winter, the body of `if(ph===4){…}`, which keeps its `if` and its call). A stage of `resolveTurn`'s own body (P1-08k3's after the phases, from the loop's end to the bots' late
  declarations, `botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim(turnContext)` since P1-08l1) keeps its 2-space indent under a function line at 0; a test that calls it does what the turn
  does first: `turnContext._currentPhase` null, `turnContext._afterPhases` true and the log's context clear, so every
  line it writes with no phase of its own is filed after the phases (99). P1-08k4's diplomacy and victory stages read the
  realms' declarations and Reckoning calls from the context (`turnContext.diploDeclarations`, `turnContext.reckoningCalls`,
  which `turnContext()` in `tests/lib/engine.ts` makes empty): a test that calls them puts the realms' declarations
  there, as the order merge does. P1-08k5a's first part of the new turn moves the turn counter on itself: a test that
  calls it reads the turn it was played on before the call. The board has no kings (`board()` clears every hero), so a
  whole turn crowns an heir for every realm at its end unless the test stands a king in each, as `stageCase` in
  `tests/lib/new-turn-succession-and-summons-cases.ts` does. P1-08k5b's second part runs on the turn the first part
  moved on to: a test that calls it alone moves `G.turn` on by one first, or a Divine hero fallen the turn before is not
  yet due to rise. A direct call changes the staged heroes in place, so a check must compare with values kept at staging
  (a province, an id), not the staged hero's own fields. P1-08k6's two title stages (once immediately-invoked functions
  at the end of the body, named functions now: their bodies keep their 4-space indent under a function line at 2) also
  run on the turn moved on: titles are public from turn 5 as the stages see it, so a test that calls them stages turn 4
  and moves it on, and the Loremaster's "fresh" discovery is one made on the turn just played (`G.turn - 1`). On the
  shared board every realm holds a seat of equal tax and gold, so realm 0 holds the Throne and the Vaultkeeper (the
  first of equals) and its king the Colossus and the Castellan: a test of the title changes counts them, and a hero's
  wage (never under 1g) can hand the Vaultkeeper to another realm unless the realm is given gold. P1-08k7's two set-up
  stages (the turn's start repairs, the merge of the realms' orders) run before `log` is ready, so they log nothing:
  what the merge has to tell goes into the context's collectors (`staleOrderWarnings`, `diploDeclarations`,
  `safeStartRefused`, `discoveryChoicePicks`, `reckoningCalls`, `playerMessages`), which the merge itself makes afresh
  each turn and joins to the context (since P1-08l2; `resolveTurn` declared them before). A test that calls the merge
  gives the context the slot rows (`turnContext.freshPlayers`) and the turn run (`turnContext.expectedTurnToRun`, which
  may differ from `G.turn`) first, and reads what it collected from the context after the call: a collector held from
  before the call is not the one the merge filled (`turnContext()` in `tests/lib/engine.ts` makes them empty). What the
  set-up leaves in `G.turnOrders` and the per-turn lists is gone by the turn's end: a whole turn reads it as the first
  phase begins. P1-08k8's four stages before the first phase make the movement pools, `SEASONS`, the turn's trackers
  and the war fronts at the start afresh and join them to the context, so a test that calls them reads those from the
  context after the call (a value made before the call is the old one; `STALE_CONTEXT` in
  `tests/lib/before-the-first-phase-cases.ts` leaves stale ones in to show it), and a whole turn's are read from the
  context as the first phase begins: `move-points` reads the pools that way. A direct call of the four runs without the
  bots' plan between the third and the fourth (P1-08l2's, called by `resolveTurn` there), so a case about a bot's own
  pick or plan is a whole turn's, or calls the plan between them. P1-08l2's bots' plan
  (`botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning`, in `engine/bots/`)
  takes the context alone and calls the eight passes in order, each handed the context's own world and bot realms; the
  movement pass is handed the duel forecast (`botHuntersDuelForecastFoughtOnCopiesOfBothHeroes`, a top-level function
  now, so a test can stand it in) wrapped with the context. A test that calls the plan readies the context as
  `resolveTurn` has it there (`ready` in `tests/lib/the-bots-plan-cases.ts`: the merge run with a bot's seat holding no
  player, so the merge writes nothing for it, then the stages before the plan). P1-08l1's bots' diplomacy
  (`botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim`, in `engine/bots/`) takes the context alone and
  reads each bot realm's rivals from `turnContext._botEncounteredAtStart`: a copy of each bot's record of whom it had met,
  made when the turn began, before the merge, and read by both of its calls (before the first phase and after the
  phases). A test that calls it makes that copy as `resolveTurn` does (`ready` in `tests/lib/bot-diplomacy-cases.ts`);
  changing a realm's `_encountered` afterwards changes nothing. The loop is the stages' calls, the intents between
  the first two. A test that calls a stage does what the loop does first: it sets `turnContext._currentPhase`, and the
  log's context is clear (`{charId:null, phase:null}`) between phases, so a line with no phase of its own is filed under
  the phase being resolved; the board in `tests/lib/middle-of-a-bot-world.ts` leaves it on its own phase.
- A test can stand in a top-level **function** by replacing it in the `vm` (`engine.f = …`), as
  `unit/order-dispatch-called-directly` and `unit/phase-stages-called-directly` do. Don't stand in a top-level `const`
  arrow (`defendSpentThisPhase`, `noteEntered`): until P1-09d a `const` wasn't a property of the `vm`'s global object,
  so the engine kept calling the original; since then the engine's bundle writes it as a `var`, so the stand-in would
  reach it in the `vm` but not in a test that imports the module, where a `const` can't be replaced. Stage the
  state it reads instead. A table declared with `const` (`TITLE_DEFS`, `MINOR_TITLES`, `SEA_TYPES`, `SKILL_LABELS`) is
  read in the `vm` with `vm.runInContext('JSON.stringify(TITLE_DEFS)', engine)`, which works either way.
- Reading a context value before `resolveTurn` has set it gives `undefined`; reading the old `let` before its line
  threw. P1-08a checked that nothing reads one early (a throwaway tripwire through a whole test run and the matrix), and
  P1-08b again for the objects that join partway through the turn (the movement pools, `SEASONS`,
  `recruitedThisTurn`, `_intrusionAcc`): before its join line, the old name threw; the context's reads `undefined`.
  P1-08c checked again for the six values above and `_elvenEscapeQueue`, P1-08d for `presenceByPhase`, `clairWatch` and
  `_reports`, P1-08e for `_botPlayerIdx`, P1-08i1 for `enteredThisPhase` and `_distCache`, P1-08i3 for `_tier0Open`, `_unitGainQueue`, `_warFrontAtStart` and `_warFrontProvs`. P1-08k4 and P1-08k7 for the merge's six collectors. P1-08k8 added no join and no `let` (the values it makes were joined before; their join lines moved with them), so it didn't rerun it. P1-08l1 reran it for `_botEncounteredAtStart`; P1-08l2 added none (the merge's six collectors moved into the merge with their join lines, still joined before anything reads them), so it didn't. `turnContext()` in `tests/lib/engine.ts` sets each of them, as `resolveTurn`
  does: a test of a lifted helper that reads one it doesn't set gets `undefined`, not the turn's value.
