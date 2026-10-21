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
//   turnLog            the GM's log of the turn, which log() fills
//   log(type, text, meta)  files one line in turnLog
// resolveTurn adds the rest as it reaches them: _mercIds, _tel, battleCommanders, fieldBattlePhase, _logCtx,
// _currentPhase, _afterPhases, and more as each lifted area needs them (docs/ARCHITECTURE.md lists them). The lifted code keeps resolveTurn's two-space indent (plan P1-08's Decisions).
// TurnContext, below the function, is the context's type (plan P1-10a2), and LogLine the type of a line of the log.
import type { Dispatch } from '../../schemas/orders-a-realm-submits.ts';
import type { Character, GameState, Province } from '../../schemas/saved-game-state.ts';

export function createTurnContext(G, freshPlayers, expectedTurnToRun) {
  const turnContext = { G, freshPlayers, expectedTurnToRun, turnLog: [] };
  const log = (type, text, meta = {}) => {
    const { turnLog } = turnContext;
    turnLog.push({
      type,
      text,
      actor: meta.actor ?? null,
      targets: meta.targets || [],
      provinceId: meta.provinceId ?? null,
      public: meta.public ?? false,
      spy: meta.spy ?? false,
      system: meta.system ?? false,
      armyEstimate: meta.armyEstimate ?? null,
      charId: meta.charId ?? turnContext._logCtx.charId, // which character's action this is
      charIds: meta.charIds || null, // extra characters this entry pertains to — the
      // report files it into WHICHEVER of the viewer's own
      // characters it names (e.g. a duel shows in BOTH
      // combatants' sections, each for its own owner).
      // 2026-09-23 (Toby item 10): a line logged DURING a phase but outside any character's order
      // (the lone-defender ambush, Defend ride-outs, end-of-phase sweeps) had no phase at all, and
      // the player's Chronicle files an unphased line under SPRING. Perrin the Halved, ambushed and
      // killed at the end of LATE SUMMER, therefore read as struck down in Spring and then marching
      // on through both summers. _currentPhase is the phase being resolved, so it is the fallback.
      phase:
        meta.phase ?? turnContext._logCtx.phase ?? turnContext._currentPhase ?? (turnContext._afterPhases ? 99 : null), // which phase (0–4, or 99 = End of Turn)
      pinNotice: meta.pinNotice ?? false, // hoist to the top of the char's phase report
      env: meta.env ?? false, // environmental province event (earthquake,
      // flood, plague, blessing, part-sea …) → Province Reports
      battleId: meta.battleId ?? null, // 2026-09-23d: which battle this line belongs to (emitBattle)
      bTier: meta.bTier ?? null, // 'k' key · 'd' detail · 't' tally · 's' onlooker summary
      gameEnd: meta.gameEnd ?? false, // 2026-09-28 (Toby item 6): end-of-game announcement / standings → top of the player report
    });
    console.log(`[${type}] ${text}`);
  };
  turnContext.log = log;
  return turnContext;
}

// ── THE CONTEXT'S TYPES (plan P1-10a2) ────
// Types only: the build erases them, so the engine's files are the same with them. This file keeps its ts-nocheck
// line (its function sets fields one by one), and TypeScript checks nothing in a file with it, these types included: a
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

/** What a caller of log() may say about a line (each left out reads as log() says). */
export interface LogMeta {
  /** The realm whose hero acts (null: nobody's). */
  actor?: number | null | undefined;
  /** The realms that always see the line. */
  targets?: number[] | undefined;
  provinceId?: number | null | undefined;
  /** Everyone with a hero in the province, or owning it, sees it. */
  public?: boolean | undefined;
  spy?: boolean | undefined;
  system?: boolean | undefined;
  armyEstimate?: unknown;
  /** The hero whose action it is (else the hero whose order is resolving). */
  charId?: number | null | undefined;
  /** More heroes the line is about: it is filed under whichever of them the reader owns. */
  charIds?: number[] | null | undefined;
  /** 0 to 4, or 99 for the end of the turn (else the phase resolving). */
  phase?: number | null | undefined;
  pinNotice?: boolean | undefined;
  /** A province's own event (an earthquake, a flood, …), for the province reports. */
  env?: boolean | undefined;
  /** The battle the line belongs to (emitBattle numbers them). */
  battleId?: number | null | undefined;
  /** The line's place in a battle's report: 'k' key, 'd' detail, 't' tally, 's' an onlooker's summary. */
  bTier?: string | null | undefined;
  gameEnd?: boolean | undefined;
}

/** A line of the GM's log (turnLog): its type ('system', 'combat', 'move', …), its text, and every field of LogMeta,
 *  filled in. */
export interface LogLine {
  type: string;
  text: string;
  actor: number | null;
  targets: number[];
  provinceId: number | null;
  public: boolean;
  spy: boolean;
  system: boolean;
  armyEstimate: unknown;
  charId: number | null;
  charIds: number[] | null;
  phase: number | null;
  pinNotice: boolean;
  env: boolean;
  battleId: number | null;
  bTier: string | null;
  gameEnd: boolean;
}

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

/** The turn's context: createTurnContext makes the first four fields and log; resolveTurn and the helpers it calls add
 *  the rest as the turn reaches them (tests/lib/engine.ts's turnContext() makes them all, as resolveTurn does before
 *  the first phase). Keyed by a hero's id, a province's or a realm's index where the comment says "by". */
export interface TurnContext {
  /** The game's state, parsed: the working copy the turn changes. */
  G: GameState;
  /** The game's slot rows, as loaded. */
  freshPlayers: TheGamesSlotRow[];
  /** The turn being run (G.turn moves on during the turn). */
  expectedTurnToRun: number;
  /** The GM's log of the turn, which log() fills. */
  turnLog: LogLine[];
  /** Files one line in turnLog. */
  log: (type: string, text: string, meta?: LogMeta) => void;
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
  /** Skill rises held back to the end of the phase: each line's text and meta (afterBattleIn: the province of the
   *  battle it follows). */
  _deferredSkillLogs: [string, LogMeta & { afterBattleIn?: number | undefined }][];
  /** A simulated fight is running (the odds of a lair, a bot's forecast): no skill may rise. */
  _pcSimulating: boolean;
  _elvenEscapeQueue: ElvenEscape[];
  /** Each realm's Clairvoyance watch, by realm. */
  clairWatch: Record<number, { charId: number; fromPhase: number }>;
  /** The realms with a hero in each province at the start of each phase: by phase, then a Map by province. */
  presenceByPhase: Map<number, Set<number>>[];
  /** Whether buildReports has run. */
  _reports: { built: boolean };
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
  /** Lines held until log() is ready: stale orders refused, a realm's concession. */
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
}
