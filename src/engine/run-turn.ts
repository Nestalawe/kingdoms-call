// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng, kcRngStream } from './rng.ts';
import { migrateLegacyUnitNames } from './army-tables.ts';
import { backfillHomeRosters, retireCorsairPools } from './grand-design.ts';
import { seedUsedHeroNames } from './names.ts';
import { ensureAllLairHoards } from './items/lair-items.ts';
import { migrateItemTiers } from './items/equipment.ts';
import { migrateMaxHpV2, retireDiscoveries } from './heroes/skills-and-hp.ts';
import { seedUsedArmyNames } from './dice-and-army-names.ts';
import { isBotRow } from './bots/setup.ts';
import { botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim } from './bots/bot-diplomacy-treats-and-wars-by-alignment-the-grudge-and-a-reckoning-claim.ts';
import { botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning } from './bots/bot-realms-plan-the-turn-concessions-movement-muster-economy-actions-hygiene-the-reckoning-and-the-duel-forecast.ts';
import { snapshotHeldItems } from './titles/perks.ts';
import { telRealmSnapshot } from '../views/turn-report.ts';
import { createTurnContext } from './turn/context.ts';
import { syncAllMaxHp } from './heroes/experience-skill-rises-and-earned-hp.ts';
import { buildReports } from './turn/realm-reports-and-spy-stealth.ts';
import { buildPhaseIntents } from './turn/phase-intents-and-dependency-ordering.ts';
import {
  everyRealmStampedBotOrHumanFromTheBotSlotRows,
  lastTurnsBattleAndDuelSwordsClearedFromTheMap,
  mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans,
  turnStartRepairsAndAFreshSlateOfOrdersForEveryHero,
} from './turn/set-up-the-turns-start-repairs-and-the-merge-of-the-realms-orders.ts';
import {
  missingOrdersDefaultToDefendTheOrdersRecordAndTheWarFrontsAtTheStart,
  movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan,
  relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks,
  warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages,
} from './turn/before-the-first-phase-war-without-warning-research-choices-messages-move-pools-and-default-defend.ts';
import {
  endPhaseSkillRisesFallenCommandersAndProvinceMemory,
  pinAndReactToPhaseIntents,
  resolvePhaseOrdersInTwoTiersAroundTheDefendStep,
  startPhaseHealingSnapshotsAndStalledBattles,
} from './turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.ts';
import { earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill } from './turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts';
import { afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames } from './turn/after-the-phases-stand-offs-the-dead-graves-couriers-mass-healing-cowards-and-location-names.ts';
import {
  diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings,
  victoryTheReckoningEliminationConcessionAndTheAnnouncement,
} from './turn/diplomacy-resolution-and-victory-the-reckoning-elimination-concession-and-the-announcement.ts';
import { newTurnCounterKingSuccessionSummonsAndSpellsEndAndTheGrandDesigns } from './turn/new-turn-counter-king-succession-summons-and-spells-end-and-the-grand-designs.ts';
import { newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile } from './turn/new-turn-war-academy-informants-divine-resurrection-graves-mercenaries-wanderers-and-the-final-reconcile.ts';
import {
  imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy,
  titleChangesTheTitlesEachRealmWonAndLostSinceLastTurn,
} from './titles/title-intel-for-each-holder-and-the-titles-won-and-lost-this-turn.ts';

// ── THE TURN ITSELF (plan P1-18d, 2026-10-18) ────
// resolveTurn works out one turn: it brings the save up to date, merges the players' orders, has the bots plan,
// resolves the five phases and the end of the turn. It is synchronous and reads no database, no screen and no clock.
// Its dice come from its seed (P1-08m, below). The shell around it is runTurn (src/ui/gm/turn-shell.ts): it loads the
// game, clears the orders, draws the seed, calls this, saves, and only then has the reports built and writes them.
//   G                 the game's saved state as loaded (games.game_state, a JSON string): parsing it is the turn's copy
//   freshPlayers      the game's slot rows as loaded (game_players), each with the orders it sent
//   expectedTurnToRun the turn being run (the games row's turn, which the save checks)
//   seed              the turn's seed, a 32-bit integer (kcRngStream reads 0 as 1); none (the tests' turns): the dice
//                     in use (kcRng, src/engine/rng.ts), as a test fixes them
// Returns {state, log, buildReports}:
//   state             the world after the turn, as JSON: what the shell saves (with its two turn-mode stamps added)
//   log               the GM's log of the turn (turnLog); buildReports adds the Spy-stealth lines to it
//   buildReports()    builds every realm's report on the working copy, once, after the save: {reports, tel}, where
//                     reports is [{gp, report}] (gp: the slot row it is for) and tel what telemetry reads
// The body keeps runTurn's two-space indent and names, so the code anchors in tests/README.md still match.
export function resolveTurn(G, freshPlayers, expectedTurnToRun, seed) {
  // ── THE TURN'S DICE (P1-08m, 2026-10-20) ── given a seed, the turn plays on dice of its own: kcRngStream(seed), made
  // once, lent (kcRng.use) for the turn and again for buildReports(), whose Spy-stealth rolls carry on from the turn's.
  // The dice in use before are given back after each, also when it throws, so nothing else the page runs between the
  // two (the save, another game's turn, the watcher) draws from the turn's. With no seed, nothing is lent.
  const turnDice = seed == null ? null : kcRngStream(seed);
  const onTheTurnsDice = (fn) => {
    if (!turnDice) return fn();
    const was = kcRng.use(turnDice);
    try {
      return fn();
    } finally {
      kcRng.use(was);
    }
  };
  return onTheTurnsDice(() => {
    try {
      G = typeof G === 'string' ? JSON.parse(G) : G;
      seedUsedArmyNames(G);
      seedUsedHeroNames(G);
      migrateMaxHpV2(G); // Sept 2026 redesign: derived max HP (one-time recompute for older saves, silent resync otherwise)
      backfillHomeRosters(G); // home provinces recruit the king's full racial land roster
      retireCorsairPools(G); // 2026-10-15 (D3): no province offers the retired Corsair Fleet
      retireDiscoveries(G); // strip retired Sage discovery ids (sd34) from live saves
      migrateLegacyUnitNames(G); // pre-2026.09.06 unit-type strings → current names (idempotent)
      snapshotHeldItems(G); // remember every pack as it stands NOW, so the report can mark what was gained this turn
      lastTurnsBattleAndDuelSwordsClearedFromTheMap(G); // the save still holds last turn's crossed swords on the map
    } catch (e) {
      // the orders are already cleared: the catch at the end of runTurn puts them back
      throw new Error(`Could not read the saved game: ${(e && e.message) || e}`);
    }
    // ── THE TURN'S CONTEXT (plan P1-08a) ── what the helpers lifted out of resolveTurn read: the state, the log
    // and its collectors, the phase being resolved. They take it first (src/engine/turn/context.ts).
    const turnContext = createTurnContext(G, freshPlayers, expectedTurnToRun);
    // ── MERCENARY BAND IDS (P1-18b, 2026-10-18) ── a band made this turn is `merc_t<turn>_<n>`, counted
    // afresh each turn: no clock and no dice, so the turn's dice don't depend on how many bands it makes.
    // The `merc_` prefix is what the hire code tests for, and an older save's `merc_<ms>_<b36>` ids can't
    // meet these. The turn is the one being run (expectedTurnToRun), not G.turn, which advances mid-turn.
    const _mercIds = { n: 0 };
    turnContext._mercIds = _mercIds;
    // ── TELEMETRY (2026-09-25) ── the situation of every realm BEFORE anything happens this turn, and
    // the collectors the hooks below fill (battles, lair fights, captures, deaths, spells). Written to
    // turn_events after the save, one row per realm — see writeTurnTelemetry at the end of runTurn.
    const _tel = {
      pre: {},
      orders: {},
      battles: [],
      encounters: [],
      captures: [],
      deaths: [],
      spells: [],
      hires: [],
      recruits: [],
    };
    turnContext._tel = _tel;
    try {
      (G.players || []).forEach((pl, pi) => {
        if (pl) _tel.pre[pi] = telRealmSnapshot(G, pi);
      });
    } catch (_te) {
      console.warn('telemetry pre-snapshot:', _te);
    }

    // ── BOT DIPLOMACY (Phase 2) — turn-start snapshot ── Snapshot each bot's identified-rivals set
    // (_encountered, driven by fog-of-war) as it stands at the START of the turn. A bot then declares
    // war (below, just before diplomacy resolution) on the same cadence a human would: it reacts to
    // what it knew going into the turn, the declaration is applied at end of turn, and war stands
    // next turn — reusing the existing human war tempo.
    const _botPlayerIdx = new Set((freshPlayers || []).filter(isBotRow).map((p) => p.player_index));
    turnContext._botPlayerIdx = _botPlayerIdx;
    everyRealmStampedBotOrHumanFromTheBotSlotRows(turnContext);
    const _botEncounteredAtStart = {};
    turnContext._botEncounteredAtStart = _botEncounteredAtStart;
    _botPlayerIdx.forEach((idx) => {
      _botEncounteredAtStart[idx] = [...(((G.players || [])[idx] || {})._encountered || [])];
    });

    turnStartRepairsAndAFreshSlateOfOrdersForEveryHero(turnContext);
    mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans(turnContext);

    // (the orders were cleared in step 2a, before the save was upgraded)

    // NOTE (Sept 2026): the bot passes and the default-to-Defend pass run inside the resolution
    // try-block, so the bot hunters' duel forecast can call the engine's personal-combat resolver,
    // whose function declarations live in that block. A bot-pass failure therefore also restores the
    // players' orders.

    migrateItemTiers(G); // re-stamp saved items with their tier under the four-tier scheme
    ensureAllLairHoards(G); // stocks any lair from a pre-hoard save (no-op afterwards)

    // 4. Run all 5 phases
    // Structured log system Each entry carries metadata so we can build accurate per-player
    // chronicles:
    // actor — player index of the character taking the action (null = NPC/system)
    // targets — array of player indices who should ALWAYS see this entry
    // province — province id where the event occurred (used for territory visibility)
    // public — if true, all players who own or have characters in this province see it
    // redact — if true, enemy army strength is shown as a rough estimate only
    const { turnLog } = turnContext;
    // CLAIRVOYANCE watch snapshot. targetChar._clairvoyantBy is cleared at turn-end BEFORE the
    // per-player reports are built, so record each caster's active watch here (one per player — a new
    // casting replaces the old) to survive into report generation. { playerIndex: {charId, fromPhase}
    // }.
    const clairWatch = {};
    turnContext.clairWatch = clairWatch;
    // Which commanders fought in each battle, keyed by provinceId@phase. Every battle line carries a
    // SINGLE charId — the attacker's (via _logCtx) for a fresh fight, or the ranking live force for a
    // resumed stalled battle. This map lets that report re-file the fight under THIS player's own
    // commander who fought there.
    const battleCommanders = {};
    turnContext.battleCommanders = battleCommanders;
    // 2026-10-08 (Toby item 7): every character who stood in a field battle, by id → the phase it was
    // fought in. That is both leaders AND every armed character of either side standing on the ground,
    // so a general pooled in as a reinforcement counts too. ONE BATTLE PER PHASE reads it: a chase
    // already under way waits when its hunter has fought this phase — as the attacker OR the defender.
    const fieldBattlePhase = {};
    turnContext.fieldBattlePhase = fieldBattlePhase;
    // Current character context — set by processOrder so all log calls get charId/phase automatically
    turnContext._logCtx = { charId: null, phase: null };
    // the phase currently being resolved. _logCtx is cleared to null between characters and after
    // resolveStalledBattles, so a skill-rise earned in a phase-pipeline STAGE
    // (force-march reinforcement, defend-reaction, pursuit movement) — outside processOrder — would
    // otherwise be deferred with phase null and land under END OF TURN. This is the reliable
    // fallback.
    turnContext._currentPhase = null;
    // once the phase loop has finished, EVERY remaining line of the turn is an end-of-turn line (Mass
    // Healing, couriers, wages, de-consecration, max-HP sync …). _logCtx and _currentPhase are both
    // null by then, and a null phase was being filed under SPRING in the character sections of both
    // reports. This flag makes emit stamp phase 99 ("End of Turn") for anything emitted after the
    // pipeline, so no end-of-turn event can be reported a year early again.
    turnContext._afterPhases = false;
    // while a battle (or its carry-on series) is resolving, this holds the contested province's id so
    // trySkillGain can cap a combat skill to ONE gain per province-battle-series (carry-on battles
    // span phases, so a per-phase cap alone isn't enough). Cleared at every loop boundary between
    // fights.
    turnContext._combatSkillProv = null;
    // 2026-10-13 (item 6, Toby): while a pre-battle duel is fought, each duellist's id → the foe's name,
    // so a skill rise earned in it can say so (resolveDuel sets it; trySkillGain reads it).
    turnContext._duelFoes = null;
    turnContext._battleSeq = 0; // 2026-09-23d: numbers each emitted battle so the player portal can fold it (emitBattle)
    // The Defend step (see flushDefendStep in the phase loop): true while the phase's non-moving orders
    // are still resolving; hosts raised meanwhile where a Defend general would answer wait in the queue.
    turnContext._tier0Open = false;
    turnContext._unitGainQueue = [];
    // while a duel against a LOCAL CHIEFTAIN (a neutral guard) is resolving, this holds
    // {used:false}. The FIRST skill advance of that duel closes it for every skill — melee, archery and
    // thief could each roll before, so one chieftain could train three skills at once. Unlike
    // _combatSkillProv (which is per-skill) this cap is TOTAL: one advance per duel, whatever the
    // skill.
    turnContext._chieftainDuelGain = null;

    relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks(turnContext);
    botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim(turnContext);
    warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages(turnContext);

    // incidental skill-rises (those NOT tied to a battle narrative) are buffered here and flushed at
    // the END of the phase, so a line like "…Explorer rises to level 1…" reads as the consequence it
    // is — reported after the move/action that earned it, not jumping ahead of it.
    turnContext._deferredSkillLogs = [];
    // set while the Hunting Rumours odds simulation runs fights in the background — no sandbox fight
    // may ever train a real skill (see simulateLairOdds).
    turnContext._pcSimulating = false;

    // Record killed armies into province grave pool for Skeletal Armies spell Elven army units of an
    // Elven KINGDOM that would fall in battle have a terrain-based chance to slip the field and make
    // for home instead of dying. The chance is decided here, at the moment of loss; the survivor is
    // DELIVERED at the end of the turn (see flushElvenEscapes), to the king's home province — or, if
    // that has been lost, the realm's wealthiest remaining province — so the destination reflects
    // final ownership. Desert/mountain 30%, plains 45%, forest/jungle 60%.
    const _elvenEscapeQueue = [];
    turnContext._elvenEscapeQueue = _elvenEscapeQueue;

    movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan(turnContext);
    // ── BOT DECISIONS + default-to-Defend ── run here, after every helper const in this block is initialised
    // (the hunters' duel forecast needs autoEncounterPlan / NPC_SPELL_BY_SCHOOL / resolvePersonalCombat).
    // 2c. BOT DECISIONS (Phase 3a) — bots write their own movement orders into G.turnOrders, using
    // the start-of-turn world state, before the default-to-Defend pass fills the rest. Bots submit no
    // orders through the portal, so this is where their turn is decided. Movement only for now
    // (expansion); economy/actions/spells and enemy-target/battle AI are staged (3b/3c/4). Sept 2026
    // (hunter tactics): a Monte-Carlo duel forecast for the bot hunters, built on the engine's own
    // personal-combat resolver. Both fighters are deep-cloned with off-roster ids (so skill gains, HP
    // loss, item transfers and mercy flags land on the clones, never the real records) and fight `n`
    // times.
    botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning(turnContext);

    missingOrdersDefaultToDefendTheOrdersRecordAndTheWarFrontsAtTheStart(turnContext);
    for (let ph = 0; ph < 5; ph++) {
      turnContext._currentPhase = ph; // reliable phase for skill-rises earned outside processOrder
      const _phaseStartLoc = {};
      (G.characters || []).forEach((c) => {
        if (c && c.alive) _phaseStartLoc[c.id] = c.location;
      }); // for noteSilentHeroes
      startPhaseHealingSnapshotsAndStalledBattles(turnContext, ph);

      // ── STAGE 1: declare intent (read-only) ──
      const intents = buildPhaseIntents(turnContext, ph);

      pinAndReactToPhaseIntents(turnContext, ph, intents);

      resolvePhaseOrdersInTwoTiersAroundTheDefendStep(turnContext, ph, intents);

      endPhaseSkillRisesFallenCommandersAndProvinceMemory(turnContext, ph, _phaseStartLoc);

      // Tax collection moved to Early Winter block below

      // Hero pay and army wages at Early Winter
      if (ph === 4) {
        earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill(turnContext);
      }
      syncAllMaxHp(turnContext); // a max-HP rise earned this phase heals into its headroom now
    }

    turnContext._currentPhase = null; // the phase loop is over — any later gain belongs to END OF TURN
    turnContext._afterPhases = true; // …and so does every later LOG LINE (emit's fallback, above)

    afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames(turnContext);

    botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim(turnContext); // bots declare BEFORE the phases now (see the pre-phase pass); a no-op here for any late-identified rival

    diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings(turnContext);

    victoryTheReckoningEliminationConcessionAndTheAnnouncement(turnContext);

    newTurnCounterKingSuccessionSummonsAndSpellsEndAndTheGrandDesigns(turnContext);

    newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile(turnContext);
    imperialTitleIntelEachHoldersReportOnRivalRealmsAndTheLoremastersCopy(turnContext);
    titleChangesTheTitlesEachRealmWonAndLostSinceLastTurn(turnContext);
    // ── THE REPORTS, BUILT AFTER THE SAVE (P1-18d, 2026-10-18) ────
    // The shell calls buildReports() only once the turn is saved (_turnCommitted), so a report that fails costs reports,
    // never the turn (docs/traps.md, "Post-commit work in runTurn"). The reports are built on the working copy, as they
    // always were: the Spy-stealth rolls in buildReports (engine/turn/realm-reports-and-spy-stealth.ts) change it, and the
    // reports read it with the turn's log and helpers.
    const _reports = { built: false };
    turnContext._reports = _reports;

    return {
      state: JSON.stringify(G),
      log: turnLog,
      buildReports: (...a) => onTheTurnsDice(() => buildReports(turnContext, ...a)),
    };
  });
}
