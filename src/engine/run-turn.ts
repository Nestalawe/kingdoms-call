import { kcRng, kcRngStream } from './rng.ts';
import {
  refuseASaveThatIsNotAGameInPlay,
  upgradeGameState,
  type WhatTheSavesUpgradeFound,
} from './saves/upgrade-a-saved-game-and-check-it.ts';
import type { Character, GameState } from '../schemas/saved-game-state.ts';
import { seedUsedHeroNames } from './names.ts';
import { ensureAllLairHoards } from './items/lair-items.ts';
import { d100, seedUsedArmyNames } from './dice-and-army-names.ts';
import { asItsGuardReadsIt } from './rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim } from './bots/bot-diplomacy-treats-and-wars-by-alignment-the-grudge-and-a-reckoning-claim.ts';
import { botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning } from './bots/bot-realms-plan-the-turn-concessions-movement-muster-economy-actions-hygiene-the-reckoning-and-the-duel-forecast.ts';
import { perkTier, snapshotHeldItems } from './titles/perks.ts';
import { telRealmSnapshot } from './turn/log-line-helpers.ts';
import { createTurnContext, type TheGamesSlotRow, type TurnContext } from './turn/context.ts';
import { syncAllMaxHp } from './heroes/experience-skill-rises-and-earned-hp.ts';
import { effStat } from './heroes/effective-skills-and-hidden-heroes.ts';
import { emit } from './turn/events-and-their-audiences.ts';
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
// Returns {state, log, spyStealthAndInvisibilityStampedForTheReports, whatTheReportsRead,
// whereTheSaveDiffersFromThisBuildsSchema}:
//   state             the world after the turn, as JSON: what the shell saves (with its two turn-mode stamps added)
//   log               the GM's log of the turn (turnLog): its events, a typed line with its fact and no words yet (the
//                     views write them: buildReports returns the log in words, which the shell saves, P1-12c3); the
//                     Spy-stealth step adds its lines to it
//   spyStealthAndInvisibilityStampedForTheReports()
//                     rolls each hero's Spy stealth and carries this turn's Invisibility into the reports' turn, on the
//                     working copy, once, after the save and before the reports (P1-12b2)
//   whatTheReportsRead()
//                     what the views build every realm's report from (buildReports, src/views/every-realms-report-and-
//                     the-lines-each-realm-reads.ts), once, after the stealth step (P1-12b3: the engine imports no
//                     view): the slot rows, the working copy, the turn's log, its sight and the telemetry's collectors
//   whereTheSaveDiffersFromThisBuildsSchema
//                     what the save's check found (engine/saves/, P1-15d): each place the save as loaded, upgraded,
//                     differs from this build's schema, by its path and kind; the turn ran on it as it was, and the
//                     shell's message tells the GM, as the GM's log does
// The body keeps runTurn's two-space indent and names, so the code anchors in tests/README.md still match.
export function resolveTurn(
  save: string | GameState,
  freshPlayers: TheGamesSlotRow[],
  expectedTurnToRun: number,
  seed?: number | null,
) {
  // ── THE TURN'S DICE (P1-08m, 2026-10-20) ── given a seed, the turn plays on dice of its own: kcRngStream(seed), made
  // once, lent (kcRng.use) for the turn and again for the Spy-stealth step, whose rolls carry on from the turn's. The
  // dice in use before are given back after each, also when it throws, so nothing else the page runs between them (the
  // save, another game's turn, the watcher) draws from the turn's. With no seed, nothing is lent. The reports draw no
  // dice (P1-12b2), and since P1-12b3 they are the views', which the shell calls: they are lent none.
  const turnDice = seed == null ? null : kcRngStream(seed);
  const onTheTurnsDice = <TheResult>(fn: () => TheResult): TheResult => {
    if (!turnDice) return fn();
    const was = kcRng.use(turnDice);
    try {
      return fn();
    } finally {
      kcRng.use(was);
    }
  };
  return onTheTurnsDice(() => {
    let whatTheSavesUpgradeFound: WhatTheSavesUpgradeFound;
    let G: GameState;
    try {
      const parsed: unknown = typeof save === 'string' ? JSON.parse(save) : save;
      // the upgrade's first refusal, made here too, so the turn holds the save as a game in play from its first read
      refuseASaveThatIsNotAGameInPlay(parsed);
      G = parsed;
      seedUsedArmyNames(G);
      seedUsedHeroNames(G);
      whatTheSavesUpgradeFound = upgradeGameState(G); // the save brought up to date (engine/saves/, plan P1-15a)
      snapshotHeldItems(G); // remember every pack as it stands NOW, so the report can mark what was gained this turn
      lastTurnsBattleAndDuelSwordsClearedFromTheMap(G); // the save still holds last turn's crossed swords on the map
    } catch (e) {
      // the orders are already cleared: the catch at the end of runTurn puts them back
      throw new Error(`Could not read the saved game: ${theWordsOfWhatWasThrown(e)}`, { cause: e });
    }
    // ── THE TURN'S CONTEXT (plan P1-08a) ── what the helpers lifted out of resolveTurn read: the state, the log
    // and its collectors, the phase being resolved. They take it first (src/engine/turn/context.ts).
    // It is whole at birth (plan P1-10b51): every field its start value, what the upgrade found among them.
    const turnContext: TurnContext = createTurnContext(G, freshPlayers, expectedTurnToRun, whatTheSavesUpgradeFound);
    // ── TELEMETRY (2026-09-25) ── the situation of every realm BEFORE anything happens this turn (the context's
    // _tel, which also files the facts for the statistics).
    const { _tel } = turnContext;
    try {
      // (a list: the refusal above made sure; a gap in it is passed over)
      G.players.forEach((pl: GameState['players'][number] | null | undefined, pi) => {
        if (pl) _tel.pre[pi] = telRealmSnapshot(G, pi);
      });
    } catch (_te) {
      console.warn('telemetry pre-snapshot:', _te);
    }

    // ── BOT DIPLOMACY (Phase 2) — turn-start snapshot ── Snapshot each bot's identified-rivals set
    // (_encountered, driven by fog-of-war) as it stands at the START of the turn. A bot then declares
    // war (below, just before diplomacy resolution) on the same cadence a human would: it reacts to
    // what it knew going into the turn, the declaration is applied at end of turn, and war stands
    // next turn — reusing the existing human war tempo. (The bot realms, by their slot rows: the context's
    // _botPlayerIdx.)
    const { _botPlayerIdx, _botEncounteredAtStart } = turnContext;
    everyRealmStampedBotOrHumanFromTheBotSlotRows(turnContext);
    _botPlayerIdx.forEach((idx) => {
      _botEncounteredAtStart[idx] = [...(G.players[idx]?._encountered ?? [])];
    });

    turnStartRepairsAndAFreshSlateOfOrdersForEveryHero(turnContext);
    mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans(turnContext);

    // (the orders were cleared in step 2a, before the save was upgraded)

    // NOTE (Sept 2026): the bot passes and the default-to-Defend pass run inside the resolution
    // try-block, so the bot hunters' duel forecast can call the engine's personal-combat resolver,
    // whose function declarations live in that block. A bot-pass failure therefore also restores the
    // players' orders.

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

    relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks(turnContext);
    botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim(turnContext);
    warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages(turnContext);

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
      const _phaseStartLoc: Partial<Record<number, number | null>> = {};
      G.characters.forEach((c: Character | null | undefined) => {
        if (c?.alive) _phaseStartLoc[c.id] = c.location;
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
    // The shell has the reports built only once the turn is saved (_turnCommitted), so a report that fails costs
    // reports, never the turn (docs/traps.md, "Post-commit work in runTurn"). The reports are built on the working copy,
    // as they always were, and write nothing to it (P1-12b2): the Spy-stealth rolls and the Invisibility re-stamp, which
    // change it, are a step of their own (below) that the shell calls first. The views build them (P1-12b3), from what
    // whatTheReportsRead (below) hands the shell.

    return {
      state: JSON.stringify(G),
      log: turnLog,
      spyStealthAndInvisibilityStampedForTheReports: () => {
        onTheTurnsDice(() => {
          spyStealthAndInvisibilityStampedForTheReports(turnContext);
        });
      },
      whatTheReportsRead: () => whatTheReportsRead(turnContext),
      whereTheSaveDiffersFromThisBuildsSchema: whatTheSavesUpgradeFound.whereTheSaveDiffersFromThisBuildsSchema,
    };
  });
}

/** The words of what a read of the save threw, as `${(e && e.message) || e}` wrote them: its message, else itself (an
 *  error of another realm's class too: a test's engine runs in a vm). */
function theWordsOfWhatWasThrown(e: unknown): string {
  let words: unknown = e;
  if (e) {
    const message: unknown = Reflect.get(Object(e), 'message');
    if (message) words = message;
  }
  return String(words);
}

// ── THE SPY STEALTH, ROLLED AFTER THE SAVE (plan P1-12b2: out of buildReports; P1-12b3: here from its own file) ────
// spyStealthAndInvisibilityStampedForTheReports rolls each hero's Spy stealth once and carries an Invisibility cast
// this turn into the reports' turn: the two writes to the world the reports used to make themselves. resolveTurn
// hands it to the shell beside whatTheReportsRead, wrapped with the turn's context and lent the turn's dice; the shell
// calls it once the turn is saved, just before the reports, so its rolls come where they always did: after the
// turn's, before the reports. Its line goes to the end of the GM's log, as before.
export function spyStealthAndInvisibilityStampedForTheReports(turnContext: TurnContext) {
  const { _reports, G } = turnContext;
  if (_reports.stealthRolled) throw new Error('the Spy stealth is rolled once a turn');
  _reports.stealthRolled = true;
  // ── Spy stealth — rolled ONCE per character before any report is built, so every player's
  // report reads the same result. 5% per Spy level (capped at level 5 → 25% max). A character who
  // passes is stamped _unspottedTurn and is dropped from other players' PASSIVE sightings (map
  // markers, hero-sighting lists, presence-based province intel). A deliberate Spy still finds
  // them.
  (asItsGuardReadsIt(G.characters) ?? []).forEach((c: Character | null | undefined) => {
    if (!c?.alive) return;
    // an Invisibility cast this turn was stamped BEFORE the turn counter advanced (§7); re-stamp it
    // to the report's turn so every report-time visibility check (which compares against
    // gameState.turn, like _unspottedTurn) still treats the caster as unseen. Spies do not pierce
    // it.
    if (c._invisTurn === G.turn - 1) {
      c._invisTurn = G.turn;
      c._unspottedTurn = G.turn;
    }
    const _lvl = Math.min(5, effStat(turnContext, c, 'spy'));
    const _shimmer = perkTier(c, 'illusory') >= 1; // ILLUSORY L6 (Shimmer)
    if (_lvl <= 0 && !_shimmer) return;
    // Spy grants a small chance to slip away unseen (5%/level). Shimmer makes this character HALF
    // as likely to be seen at all, so the odds of passing unnoticed rise sharply.
    let _seenPct = 100 - _lvl * 5;
    if (_shimmer) _seenPct = _seenPct * 0.5;
    if (d100() > _seenPct) {
      c._unspottedTurn = G.turn;
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a hero moves unseen this turn', heroName: c.name, byTheShimmer: _shimmer, spyLevel: _lvl },
        audience: { actor: c.player, realms: [c.player] },
        hero: c.id,
        phase: 0,
      });
    }
  });
}

// ── WHAT THE REPORTS READ, HANDED TO THE SHELL (plan P1-12b3: P1-12's Decision 10) ────
// The reports are built in src/views (buildReports, src/views/every-realms-report-and-the-lines-each-realm-reads.ts),
// which the engine doesn't import: the shell calls them with what this hands over, once the turn is saved and the Spy
// stealth rolled (it refuses before, and a second time, as buildReports did when it was the engine's): the slot rows;
// the world after the turn (G, the working copy, with the stealth's stamps); the turn's log (its events, as the GM's
// log stores them); the turn's sight, recorded as it was resolved (presenceByPhase: whose heroes stood where in each
// phase; battleCommanders: who fought in each battle; clairWatch: whom each realm watches by Clairvoyance, and from
// which phase); and the telemetry (_tel: the realms' snapshots and the facts for the statistics, P1-12d33).
export function whatTheReportsRead(turnContext: TurnContext) {
  const { _reports, freshPlayers, G, turnLog, presenceByPhase, battleCommanders, clairWatch, _tel } = turnContext;
  if (_reports.built) throw new Error('buildReports() runs once a turn');
  if (!_reports.stealthRolled) throw new Error('the Spy stealth is rolled before buildReports()');
  _reports.built = true;
  return { freshPlayers, G, turnLog, sight: { presenceByPhase, battleCommanders, clairWatch }, _tel };
}
