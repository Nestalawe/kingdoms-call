// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
// ── THE TURN'S CONTEXT (plan P1-08a, 2026-10-18) ────
// What the helpers lifted out of resolveTurn (src/engine/run-turn.ts) used to reach through its closure: the state
// being changed, the GM's log and its collectors, and the phase being resolved. resolveTurn makes one each turn, just
// after it parses the save, and passes it first to every lifted helper that needs it; a helper that needs none keeps
// its arguments. An object (the state, a collector) joins it by reference. A value resolveTurn changes as the turn goes
// on (_logCtx, _currentPhase, _afterPhases) is read and written as turnContext.<name> everywhere, so every reader sees
// the value as it is now. No dice and no clock: the dice are still kcRng's (plan P1-08m).
//   G                  the game's state, parsed: the working copy the turn changes
//   freshPlayers       the game's slot rows, as loaded
//   expectedTurnToRun  the turn being run
//   turnLog            the GM's log of the turn, which emit() fills (events-and-their-audiences.ts: the one door)
// resolveTurn adds the rest as it reaches them: whatTheSavesUpgradeFound, _mercIds, _tel, battleCommanders,
// fieldBattlePhase, _logCtx, _currentPhase, _afterPhases, and more as each lifted area needs them (docs/ARCHITECTURE.md lists them). The lifted code keeps resolveTurn's two-space indent (plan P1-08's Decisions).
// TurnContext, below the function, is the context's type (plan P1-10a2); LogLine, the type of a line of the log, is the
// events file's.
import type { Dispatch, PhaseOrder } from '../../schemas/orders-a-realm-submits.ts';
import type { Character, GameState, Province } from '../../schemas/saved-game-state.ts';
import type { EventButItsWords, LogLine, NarrativeLine } from './events-and-their-audiences.ts';
import type { WhatTheSavesUpgradeFound } from '../saves/upgrade-a-saved-game-and-check-it.ts';

export function createTurnContext(G, freshPlayers, expectedTurnToRun) {
  return { G, freshPlayers, expectedTurnToRun, turnLog: [] };
}

// ── THE CONTEXT'S TYPES (plan P1-10a2) ────
// Types only: the build erases them, so the engine's files are the same with them. This file keeps its ts-nocheck
// line (its function's arguments are untyped), and TypeScript checks nothing in a file with it, these types included: a
// file that loses its ts-nocheck line (P1-10a3, P1-10b) is where they are first checked against the code that reads
// them. A key of a hero, a province or a realm here is a plain number (the brands are the saved state's, src/schemas/).

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

/** The turn's telemetry: each realm's situation and orders before anything happens, and what the turn's hooks
 *  collect (db/telemetry.ts writes it; its entries are its own shapes). */
export interface TurnTelemetry {
  pre: Record<number, unknown>;
  orders: Record<number, unknown>;
  battles: unknown[];
  encounters: unknown[];
  captures: unknown[];
  deaths: unknown[];
  spells: unknown[];
  hires: unknown[];
  recruits: unknown[];
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

/** An Elven unit that slipped the field, delivered home at the end of the turn (graves.ts, flushElvenEscapes). */
export interface ElvenEscape {
  player: number;
  unit: { type: string; quality: string; race: string; unitName: string; strength?: number | undefined };
}

/** The turn's context: createTurnContext makes the first four fields; resolveTurn and the helpers it calls add
 *  the rest as the turn reaches them (tests/lib/engine.ts's turnContext() makes them all, as resolveTurn does before
 *  the first phase). Keyed by a hero's id, a province's or a realm's index where the comment says "by". */
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
