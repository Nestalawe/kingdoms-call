// ── THE TURN'S CONTEXT (plan P1-08a, 2026-10-18) ────
// What the helpers lifted out of resolveTurn (src/engine/run-turn.ts) used to reach through its closure: the state
// being changed, the GM's log and its collectors, and the phase being resolved. resolveTurn makes one each turn, just
// after it parses the save, and passes it first to every lifted helper that needs it; a helper that needs none keeps
// its arguments. An object (the state, a collector) joins it by reference. A value resolveTurn changes as the turn goes
// on (_logCtx, _currentPhase, _afterPhases) is read and written as turnContext.<name> everywhere, so every reader sees
// the value as it is now. No dice and no clock: the dice are still kcRng's (plan P1-08m).
//   G                         the game's state, parsed: the working copy the turn changes
//   freshPlayers              the game's slot rows, as loaded
//   expectedTurnToRun         the turn being run
//   whatTheSavesUpgradeFound  what the save's upgrade found as the turn began (none, for a test's context)
// It is whole at birth (plan P1-10b51): every field of TurnContext holds its start value, the one resolveTurn gave it
// before the first phase, as tests/lib/the-fields-resolve-turn-adds-to-the-turns-context.ts writes them; the stages
// that make a field afresh each turn (the move pools, the merge's records) still do. The lifted code keeps
// resolveTurn's two-space indent (plan P1-08's Decisions).
// TurnContext, below the function, is the context's type (plan P1-10a2); LogLine, the type of a line of the log, is the
// events file's.
import type { Dispatch, PhaseOrder } from '../../schemas/orders-a-realm-submits.ts';
import type { Character, GameState, Province } from '../../schemas/saved-game-state.ts';
import type {
  EventButItsWords,
  LogLine,
  NarrativeLine,
  TheFactForTheStatistics,
} from './events-and-their-audiences.ts';
import type { telOrdersFor, telRealmSnapshot } from './log-line-helpers.ts';
import type { WhatTheSavesUpgradeFound } from '../saves/upgrade-a-saved-game-and-check-it.ts';
import { KC_SEASONS } from '../../content/kingdoms-call-data.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { isBotRow } from '../bots/setup.ts';

// Generic in the state it is handed (plan P1-10b37): resolveTurn hands it the parsed save, and a test the part of a
// world it stages. Its return is TurnContext, its state the one handed.
export function createTurnContext<TheState>(
  G: TheState,
  freshPlayers: TheGamesSlotRow[],
  expectedTurnToRun: number,
  whatTheSavesUpgradeFound: WhatTheSavesUpgradeFound = nothingTheSavesUpgradeFound(),
): Omit<TurnContext, 'G'> & { G: TheState } {
  const turnLog: LogLine[] = [];
  return {
    G,
    freshPlayers,
    expectedTurnToRun,
    turnLog,
    // Current character context, set by processOrder: the hero a line naming THE_HERO_WHOSE_ORDER_IS_RESOLVING is
    // filed under (when the line reaches his realm), and the phase of a line that names none
    _logCtx: { charId: null, phase: null },
    // the phase currently being resolved. _logCtx is cleared to null between characters and after
    // resolveStalledBattles, so a skill-rise earned in a phase-pipeline STAGE
    // (force-march reinforcement, defend-reaction, pursuit movement) — outside processOrder — would
    // otherwise be deferred with phase null and land under END OF TURN. This is the reliable
    // fallback.
    _currentPhase: null,
    // once the phase loop has finished, EVERY remaining line of the turn is an end-of-turn line (Mass
    // Healing, couriers, wages, de-consecration, max-HP sync …). _logCtx and _currentPhase are both
    // null by then, and a null phase was being filed under SPRING in the character sections of both
    // reports. This flag makes emit stamp phase 99 ("End of Turn") for anything emitted after the
    // pipeline, so no end-of-turn event can be reported a year early again.
    _afterPhases: false,
    // what the save's upgrade found (a retired discovery taken, a hero carried over to the earned-HP pool): the turn's
    // end tells the GM and the realms, and the save keeps none of it
    whatTheSavesUpgradeFound,
    // ── MERCENARY BAND IDS (P1-18b, 2026-10-18) ── a band made this turn is `merc_t<turn>_<n>`, counted
    // afresh each turn: no clock and no dice, so the turn's dice don't depend on how many bands it makes.
    // The `merc_` prefix is what the hire code tests for, and an older save's `merc_<ms>_<b36>` ids can't
    // meet these. The turn is the one being run (expectedTurnToRun), not G.turn, which advances mid-turn.
    _mercIds: { n: 0 },
    // ── TELEMETRY (2026-09-25) ── the situation of every realm BEFORE anything happens this turn, and
    // the facts for the statistics the turn files in its order (battles, lair fights, captures, deaths, spells:
    // recordForTheStatistics, plan P1-12d33). Written to turn_events after the save, one row per realm — see
    // writeTurnTelemetry at the end of runTurn.
    _tel: {
      pre: {},
      orders: {},
      factsInTheTurnsOrder: [],
    },
    // Which commanders fought in each battle, keyed by provinceId@phase. Every battle line carries a
    // SINGLE charId — the attacker's (via _logCtx) for a fresh fight, or the ranking live force for a
    // resumed stalled battle. This map lets that report re-file the fight under THIS player's own
    // commander who fought there.
    battleCommanders: {},
    // 2026-10-08 (Toby item 7): every character who stood in a field battle, by id → the phase it was
    // fought in. That is both leaders AND every armed character of either side standing on the ground,
    // so a general pooled in as a reinforcement counts too. ONE BATTLE PER PHASE reads it: a chase
    // already under way waits when its hunter has fought this phase — as the attacker OR the defender.
    fieldBattlePhase: {},
    // the move pools, the seasons, the recruits, the sightings, the sight and the war fronts: made afresh by the
    // stage before the bots plan (movePoolsPerTurnTrackers…, missingOrdersDefaultToDefend…), empty until then
    movePoints: {},
    seaMovePoints: {},
    seaMoveActive: {},
    seaCap: {},
    moveMax: {},
    seaMoveMax: {},
    SEASONS: KC_SEASONS.slice(),
    recruitedThisTurn: {},
    _intrusionAcc: new Map(),
    // while a battle (or its carry-on series) is resolving, this holds the contested province's id so
    // trySkillGain can cap a combat skill to ONE gain per province-battle-series (carry-on battles
    // span phases, so a per-phase cap alone isn't enough). Cleared at every loop boundary between
    // fights.
    _combatSkillProv: null,
    // 2026-10-13 (item 6, Toby): while a pre-battle duel is fought, each duellist's id → the foe's name,
    // so a skill rise earned in it can say so (resolveDuel sets it; trySkillGain reads it).
    _duelFoes: null,
    _battleSeq: 0, // 2026-09-23d: numbers each emitted battle so the player portal can fold it (emitBattle)
    // while a duel against a LOCAL CHIEFTAIN (a neutral guard) is resolving, this holds
    // {used:false}. The FIRST skill advance of that duel closes it for every skill — melee, archery and
    // thief could each roll before, so one chieftain could train three skills at once. Unlike
    // _combatSkillProv (which is per-skill) this cap is TOTAL: one advance per duel, whatever the
    // skill.
    _chieftainDuelGain: null,
    // incidental skill-rises (those NOT tied to a battle narrative) are buffered here and flushed at
    // the END of the phase, so a line like "…Explorer rises to level 1…" reads as the consequence it
    // is — reported after the move/action that earned it, not jumping ahead of it.
    _deferredSkillLogs: [],
    // set while the Hunting Rumours odds simulation runs fights in the background — no sandbox fight
    // may ever train a real skill (see simulateLairOdds).
    _pcSimulating: false,
    // Record killed armies into province grave pool for Skeletal Armies spell Elven army units of an
    // Elven KINGDOM that would fall in battle have a terrain-based chance to slip the field and make
    // for home instead of dying. The chance is decided here, at the moment of loss; the survivor is
    // DELIVERED at the end of the turn (see flushElvenEscapes), to the king's home province — or, if
    // that has been lost, the realm's wealthiest remaining province — so the destination reflects
    // final ownership. Desert/mountain 30%, plains 45%, forest/jungle 60%.
    _elvenEscapeQueue: [],
    // CLAIRVOYANCE watch snapshot. targetChar._clairvoyantBy is cleared at turn-end BEFORE the
    // per-player reports are built, so record each caster's active watch here (one per player — a new
    // casting replaces the old) to survive into report generation. { playerIndex: {charId, fromPhase}
    // }.
    clairWatch: {},
    presenceByPhase: [],
    // The shell has the reports built only once the turn is saved (_turnCommitted): the Spy-stealth step and
    // whatTheReportsRead (run-turn.ts) each run once, the stealth first.
    _reports: { stealthRolled: false, built: false },
    enteredThisPhase: {},
    _distCache: new Map(),
    // The Defend step (see flushDefendStep in the phase loop): true while the phase's non-moving orders
    // are still resolving; hosts raised meanwhile where a Defend general would answer wait in the queue.
    _tier0Open: false,
    _unitGainQueue: [],
    _warFrontAtStart: new Map(),
    _warFrontProvs: new Set(),
    lightLandMoves: {},
    lightSeaMoves: {},
    // the merge's records of what each realm sent (mergeTheRealmsSubmittedOrders…), empty until it runs
    diploDeclarations: {},
    reckoningCalls: new Set(),
    staleOrderWarnings: [],
    safeStartRefused: [],
    discoveryChoicePicks: {},
    playerMessages: {},
    // ── BOT DIPLOMACY (Phase 2) — turn-start snapshot ── the bot realms, by their slot rows; resolveTurn
    // snapshots each one's identified rivals (_encountered, driven by fog-of-war) as it stands at the START
    // of the turn, so a bot declares war on the same cadence a human would: it reacts to what it knew going
    // into the turn, the declaration is applied at end of turn, and war stands next turn — reusing the
    // existing human war tempo.
    _botPlayerIdx: new Set((asItsGuardReadsIt(freshPlayers) ?? []).filter(isBotRow).map((p) => p.player_index)),
    _botEncounteredAtStart: {},
  };
}

/** What the upgrade found in a save that needed nothing: the start value of a test's context. */
function nothingTheSavesUpgradeFound(): WhatTheSavesUpgradeFound {
  return {
    retiredSageDiscoveriesRemoved: 0,
    heroesCarriedOverToTheEarnedHpPool: [],
    whereTheSaveDiffersFromThisBuildsSchema: [],
    lairsRenamed: 0,
    guardiansCut: 0,
    heroesInARealmsServiceWhoseWanderingTagWasTakenOff: 0,
  };
}

// ── THE CONTEXT'S TYPES (plan P1-10a2) ────
// Types only: the build erases them, so the engine's files are the same with them. They are checked against the code
// that reads them in each file freed of its ts-nocheck line (P1-10a3, P1-10b); a file that keeps the line checks none
// of them. A key of a hero, a province or a realm here is a plain number (the brands are the saved state's, src/schemas/).

/** A slot row of the game (game_players) as the turn reads it: the realm's index; its player's account (a bot has
 *  none); the orders it sent, as JSON or parsed, in the form of src/schemas/orders-a-realm-submits.ts or the older form
 *  (not parsed yet: P1-17 parses rows at the edge); its last report (a row fetched without it reads as a bot's). */
export interface TheGamesSlotRow {
  player_index: number;
  user_id?: string | null | undefined;
  orders?: unknown;
  turn_report?: unknown;
}

/** A hero's order for one phase as the turn holds it (G.turnOrders, by hero, then by phase): his realm's order, or one
 *  the engine writes (a march the invasion interlock cancelled becomes a Defend, `_pinned`). */
export type TurnOrder = PhaseOrder & { _pinned?: boolean | undefined };

/** The turn's telemetry: each realm's situation and orders before anything happens (snapshots, by realm), and the
 *  facts for the statistics in the turn's order (recordForTheStatistics files them; the views build db/telemetry.ts's
 *  lists from them: src/views/the-statistics-of-the-turn.ts). */
export interface TurnTelemetry {
  pre: Record<number, ReturnType<typeof telRealmSnapshot>>;
  orders: Record<number, ReturnType<typeof telOrdersFor>>;
  factsInTheTurnsOrder: TheFactForTheStatistics[];
}

/** A hero seen where a realm will hear of it, gathered over the phases into one warning (intrusion-warnings.ts). */
export interface IntrusionSighting {
  targetPi: number;
  /** In a province the realm owns, or one it knows. */
  branch: string;
  actingName: string;
  acName: string;
  provName: string;
  provId: number;
  phases: number[];
  /** The force's rough size in each phase it was seen. */
  forceByPhase: Record<number, string>;
}

/** An Elven unit that slipped the field, delivered home at the end of the turn (graves.ts, flushElvenEscapes). Its
 *  unit's name is the one it fell with, or one drawn for it (armyUnitName's, which its type gives as `undefined` where
 *  a pool's draw misses). */
export interface ElvenEscape {
  player: number;
  unit: { type: string; quality: string; race: string; unitName: string | undefined; strength?: number | undefined };
}

/** The turn's context: createTurnContext makes every field, each its start value; resolveTurn and the helpers it calls
 *  change them as the turn goes on. Keyed by a hero's id, a province's or a realm's index where the comment says "by". */
export interface TurnContext {
  /** The game's state, parsed: the working copy the turn changes. */
  G: GameState;
  /** The game's slot rows, as loaded. */
  freshPlayers: TheGamesSlotRow[];
  /** The turn being run (G.turn moves on during the turn). */
  expectedTurnToRun: number;
  /** The GM's log of the turn, which emit() fills. */
  turnLog: LogLine[];
  /** The hero whose order is resolving, and its phase (null between orders). */
  _logCtx: { charId: number | null; phase: number | null };
  /** The phase being resolved (null before and after the phases). */
  _currentPhase: number | null;
  /** The phases are over: every later line is an end-of-turn line. */
  _afterPhases: boolean;
  /** The count behind this turn's new mercenary bands' ids. */
  _mercIds: { n: number };
  _tel: TurnTelemetry;
  /** The commanders who fought each battle, by `<province>@<phase>`. */
  battleCommanders: Record<string, number[]>;
  /** The phase each hero last stood in a field battle, by hero. */
  fieldBattlePhase: Record<number, number>;
  /** Each hero's land move points left this turn, by hero. */
  movePoints: Record<number, number>;
  /** Each hero's sea move points left this turn, by hero. */
  seaMovePoints: Record<number, number>;
  /** Whether each hero can move by sea this turn, by hero. */
  seaMoveActive: Record<number, boolean>;
  /** How each hero crosses the sea this turn, by hero. */
  seaCap: Record<number, string>;
  /** Each hero's land move points for the whole turn, by hero. */
  moveMax: Record<number, number>;
  /** Each hero's sea move points for the whole turn, by hero. */
  seaMoveMax: Record<number, number>;
  /** The five phases' names. */
  SEASONS: string[];
  /** The units recruited this turn, by `<province>:<unit type>`. */
  recruitedThisTurn: Record<string, number>;
  /** The sightings for the intrusion warnings, by `<realm>|<hero>|<province>|<branch>`. */
  _intrusionAcc: Map<string, IntrusionSighting>;
  /** The province whose battle series is resolving (a combat skill rises once a series). */
  _combatSkillProv: number | null;
  /** While a duel is fought: each duellist's foe's name, by duellist. */
  _duelFoes: Map<number, string> | null;
  /** The number of the last battle emitted. */
  _battleSeq: number;
  /** While a duel against a local chieftain is fought: whether it has trained a skill yet. */
  _chieftainDuelGain: { used: boolean } | null;
  /** Skill rises held back to the end of the phase: each line's words or fact (since P1-12d12, a hero's experience
   *  line's fact) and its place (afterBattleIn: the province of the battle it follows). */
  _deferredSkillLogs: [NarrativeLine, EventButItsWords & { afterBattleIn?: number | undefined }][];
  /** A simulated fight is running (the odds of a lair, a bot's forecast): no skill may rise. */
  _pcSimulating: boolean;
  _elvenEscapeQueue: ElvenEscape[];
  /** Each realm's Clairvoyance watch, by realm. */
  clairWatch: Record<number, { charId: number; fromPhase: number }>;
  /** The realms with a hero in each province at the start of each phase: by phase, then a Map by province. */
  presenceByPhase: Map<number, Set<number>>[];
  /** Whether the Spy-stealth step has run (it comes first, P1-12b2), and whether what the reports read has been handed
   *  over (whatTheReportsRead, once a turn). */
  _reports: { stealthRolled: boolean; built: boolean };
  /** The provinces each realm's heroes entered this phase, by realm. */
  enteredThisPhase: Record<number, Set<number>>;
  /** Distances between provinces, by `<from>:<to>`. */
  _distCache: Map<string, number>;
  /** The phase's Defend step is open: hosts raised meanwhile wait in _unitGainQueue. */
  _tier0Open: boolean;
  _unitGainQueue: { c: Character; prov: Province }[];
  /** The province each hero's host stood in on a war front when the turn began, by hero. */
  _warFrontAtStart: Map<number, number>;
  /** Those provinces. */
  _warFrontProvs: Set<number>;
  /** Land moves made while travelling light (no armies), by hero. */
  lightLandMoves: Record<number, number>;
  /** Sea moves made while travelling light, by hero. */
  lightSeaMoves: Record<number, number>;
  /** Each realm's declarations this turn ('treat', 'enemy', …), by realm, then by the realm it is toward. */
  diploDeclarations: Record<number, Record<string, string>>;
  /** The realms that called the Reckoning this turn. */
  reckoningCalls: Set<number>;
  /** Lines held until the turn's log is ready: stale orders refused, a realm's concession. */
  staleOrderWarnings: string[];
  /** The realms whose declarations the Safe Start refused this turn. */
  safeStartRefused: number[];
  /** Each realm's research choices (the pending pair's key → the lead kept), by realm. */
  discoveryChoicePicks: Record<number, Record<string, string>>;
  /** The dispatches each realm sent, by realm. */
  playerMessages: Record<number, Dispatch[]>;
  /** The bot realms. */
  _botPlayerIdx: Set<number>;
  /** The rivals each bot realm had identified when the turn began, by realm. */
  _botEncounteredAtStart: Record<number, number[]>;
  /** What the save's upgrade found as the turn began (src/engine/saves/), told at the turn's end. */
  whatTheSavesUpgradeFound: WhatTheSavesUpgradeFound;
}
