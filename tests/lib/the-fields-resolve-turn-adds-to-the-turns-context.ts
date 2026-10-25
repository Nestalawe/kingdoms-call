// The fields resolveTurn adds to the turn's context before the first phase (plan P1-08a…P1-08k7), as the tests make
// them: one list, for both ways a test reaches the engine (plan P1-14b). tests/lib/engine.ts's turnContext runs it in
// the engine's bare vm, on a context made there; tests/lib/personal-combat.ts runs it on a context made by the engine's
// modules, imported directly. It starts as resolveTurn's does: no hero's line, no phase, the phases not over, and what
// resolveTurn adds made empty, as resolveTurn declares it (tests/lib/engine.ts's turnContext says what each is).
//
// It is JavaScript statements on `tc`, which read two names of the engine, KC_SEASONS (the data file) and isBotRow
// (engine/bots/setup.ts): in the vm they are the engine's own names; on the modules they are passed in. Written once
// as text, so the vm's objects (its Maps, Sets and arrays) are made in the vm, as they always were.
import vm from 'node:vm';

/** A turn's context (src/engine/turn/context.ts), as resolveTurn holds it while a turn runs. */
export interface TurnContext {
  G: Record<string, unknown>;
  freshPlayers: unknown[];
  expectedTurnToRun: number;
  turnLog: Record<string, unknown>[];
  _logCtx: { charId: unknown; phase: unknown };
  _currentPhase: number | null;
  _afterPhases: boolean;
  [name: string]: unknown;
}

/** The statements, on the context `tc`. */
export const THE_FIELDS_RESOLVE_TURN_ADDS = `tc._logCtx={charId:null,phase:null}; tc._currentPhase=null; tc._afterPhases=false;
      tc.whatTheSavesUpgradeFound={retiredSageDiscoveriesRemoved:0, heroesCarriedOverToTheEarnedHpPool:[], whereTheSaveDiffersFromThisBuildsSchema:[]};
      tc._mercIds={n:0};
      tc._tel={pre:{}, orders:{}, battles:[], encounters:[], captures:[], deaths:[], spells:[], hires:[], recruits:[]};
      tc.battleCommanders={}; tc.fieldBattlePhase={};
      tc.movePoints={}; tc.seaMovePoints={}; tc.seaMoveActive={}; tc.seaCap={}; tc.moveMax={}; tc.seaMoveMax={};
      tc.SEASONS=KC_SEASONS.slice(); tc.recruitedThisTurn={}; tc._intrusionAcc=new Map();
      tc._combatSkillProv=null; tc._duelFoes=null; tc._battleSeq=0; tc._chieftainDuelGain=null;
      tc._deferredSkillLogs=[]; tc._pcSimulating=false; tc._elvenEscapeQueue=[];
      tc.clairWatch={}; tc.presenceByPhase=[]; tc._reports={stealthRolled:false,built:false};
      tc.enteredThisPhase={}; tc._distCache=new Map();
      tc._tier0Open=false; tc._unitGainQueue=[]; tc._warFrontAtStart=new Map(); tc._warFrontProvs=new Set();
      tc.lightLandMoves={}; tc.lightSeaMoves={}; tc.diploDeclarations={}; tc.reckoningCalls=new Set();
      tc.staleOrderWarnings=[]; tc.safeStartRefused=[]; tc.discoveryChoicePicks={}; tc.playerMessages={};
      tc._botPlayerIdx=new Set(tc.freshPlayers.filter(isBotRow).map(p=>p.player_index));
      tc._botEncounteredAtStart={};`;

/** Adds the fields to a context made by the engine's modules (createTurnContext), with the modules' KC_SEASONS and
 *  isBotRow: the same statements as in the vm, run in this realm, whose Maps and Sets the modules use. Returns the
 *  context. */
export function addTheFieldsResolveTurnAdds(
  tc: object,
  engine: { KC_SEASONS: readonly string[]; isBotRow: (row: unknown) => boolean },
): TurnContext {
  const add = vm.runInThisContext(`(tc, KC_SEASONS, isBotRow) => { ${THE_FIELDS_RESOLVE_TURN_ADDS} }`) as (
    tc: object,
    seasons: readonly string[],
    isBotRow: (row: unknown) => boolean,
  ) => void;
  add(tc, engine.KC_SEASONS, engine.isBotRow);
  return tc as TurnContext;
}
