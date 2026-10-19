// The one way to load the engine in Node (plan P1-18c), until P1-09 makes it modules that a test imports. The engine is
// the GM portal's files under src/engine/ and src/views/ (engineFiles() in src/manifest.ts), run in page order in a
// bare vm context after the data file, as the page runs them after its data file's script tag.
//
// The context has only what the engine may read as it loads: JavaScript's own built-ins, the seed for the dice
// (KC_RNG_SEED, as tests/lib/boot.js gives a page) and console. No window, document, sb or crypto: the screen, the
// database and the browser are the page's, not the engine's. Nor structuredClone, setTimeout, performance,
// TextEncoder or fetch, which a vm context doesn't have: nothing in the engine reaches them as it loads. Keep it so;
// don't give the context more to make a file load. A file that needs more as it loads isn't engine code yet.
//
// The files' top-level names are the context's globals, as they are the page's: `vm.runInContext('typeof resolveTurn',
// engine)`. The turn is resolveTurn (src/engine/run-turn.js, P1-18d), which reaches no screen and no database:
// tests/unit/engine-purity.test.ts plays a whole game through it here. runTurn, its shell, is the page's.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { engineFiles } from '../../src/manifest.ts';
import { ROOT } from '../../tools/build.ts';

export const DATA_FILE = 'content/kingdoms-call-data.js';

export interface EngineOptions {
  /** The dice's seed (an unsigned 32-bit integer; 0 reads as 1), as KC_RNG_SEED is a page's. */
  readonly seed: number;
  /** The source folder to load from (default: this checkout's src/), e.g. a copy with a planted fault. */
  readonly src?: string;
}

/** Runs the data file, then the engine's files, in a new vm context, and returns the context. */
export function loadEngine({ seed, src = path.join(ROOT, 'src') }: EngineOptions): vm.Context {
  const engine = vm.createContext({ KC_RNG_SEED: seed, console });
  for (const file of [DATA_FILE, ...engineFiles()]) {
    vm.runInContext(fs.readFileSync(path.join(src, file), 'utf8'), engine, { filename: `src/${file}` });
  }
  return engine;
}

/** A top-level function of the engine, by name (plan P1-08a): `engineFn(engine, 'areEnemies')`. A helper lifted out of
 *  resolveTurn is one; if it reads the turn's state, it takes a context (`turnContext` below) first. */
export function engineFn(engine: vm.Context, name: string): (...args: never[]) => unknown {
  const fn: unknown = vm.runInContext(`typeof ${name}==='function'?${name}:undefined`, engine);
  if (typeof fn !== 'function') throw new Error(`the engine has no function ${name}`);
  return fn as (...args: never[]) => unknown;
}

/** A turn's context (src/engine/turn/context.js), as resolveTurn holds it while a turn runs. */
export interface TurnContext {
  G: Record<string, unknown>;
  freshPlayers: unknown[];
  expectedTurnToRun: number;
  turnLog: Record<string, unknown>[];
  log(type: string, text: string, meta?: Record<string, unknown>): void;
  _logCtx: { charId: unknown; phase: unknown };
  _currentPhase: number | null;
  _afterPhases: boolean;
  [name: string]: unknown;
}

/** A turn's context on a world made inside the vm (plan P1-08a): the state is parsed there, so its objects and arrays are
 *  the engine's own, as a turn's are (P1-18d). It starts as resolveTurn's does before the first phase: no hero's line,
 *  no phase, the phases not over, and what resolveTurn adds to the context (P1-08a…P1-08e) made empty, as
 *  resolveTurn declares it: no hero has move points yet, no battle has been numbered, no skill rise is held back, no
 *  realm is watching by Clairvoyance, nobody has been seen in a phase yet, and the reports aren't built; the bot realms
 *  are the slot rows that are bots' (P1-08e); no province has been entered this phase and no distance measured
 *  (P1-08i1); the Defend step isn't open, no raised host waits for it, and no host stood on a war front (P1-08i3); no hero has travelled light (P1-08j1); no realm has declared anything or called the Reckoning (P1-08k4); no order was refused as stale, no realm's declarations refused for the Safe Start, no research choice picked and no message sent (P1-08k7). Give it a state as an object or as JSON. */
export function turnContext(
  engine: vm.Context,
  state: object | string,
  { freshPlayers = [], turn = 1 }: { freshPlayers?: unknown[]; turn?: number } = {},
): TurnContext {
  const make = vm.runInContext(
    `(state,players,turn)=>{ const tc=createTurnContext(JSON.parse(state),JSON.parse(players),turn);
      tc._logCtx={charId:null,phase:null}; tc._currentPhase=null; tc._afterPhases=false;
      tc._mercIds={n:0};
      tc._tel={pre:{}, orders:{}, battles:[], encounters:[], captures:[], deaths:[], spells:[], hires:[], recruits:[]};
      tc.battleCommanders={}; tc.fieldBattlePhase={};
      tc.movePoints={}; tc.seaMovePoints={}; tc.seaMoveActive={}; tc.seaCap={}; tc.moveMax={}; tc.seaMoveMax={};
      tc.SEASONS=KC_SEASONS.slice(); tc.recruitedThisTurn={}; tc._intrusionAcc=new Map();
      tc._combatSkillProv=null; tc._duelFoes=null; tc._battleSeq=0; tc._chieftainDuelGain=null;
      tc._deferredSkillLogs=[]; tc._pcSimulating=false; tc._elvenEscapeQueue=[];
      tc.clairWatch={}; tc.presenceByPhase=[]; tc._reports={built:false}; tc.enteredThisPhase={}; tc._distCache=new Map();
      tc._tier0Open=false; tc._unitGainQueue=[]; tc._warFrontAtStart=new Map(); tc._warFrontProvs=new Set();
      tc.lightLandMoves={}; tc.lightSeaMoves={}; tc.diploDeclarations={}; tc.reckoningCalls=new Set();
      tc.staleOrderWarnings=[]; tc.safeStartRefused=[]; tc.discoveryChoicePicks={}; tc.playerMessages={};
      tc._botPlayerIdx=new Set(tc.freshPlayers.filter(isBotRow).map(p=>p.player_index));
      return tc; }`,
    engine,
  ) as (state: string, players: string, turn: number) => TurnContext;
  return make(typeof state === 'string' ? state : JSON.stringify(state), JSON.stringify(freshPlayers), turn);
}

/** A new world of bot realms, made by the engine itself (plan P1-08b), as JSON: `realms` bot setups
 *  (generateBotSetups), on a map of `size`, with the world options `opts` (e.g. `{ seaPct: 45 }`). */
export function botWorld(
  engine: vm.Context,
  realms: number,
  size: { cols: number; rows: number },
  opts: Record<string, unknown> = {},
): string {
  const make = vm.runInContext(
    `(realms,size,opts)=>{ const setup=generateBotSetups([],realms,0).map(b=>({...b,gamePlayerId:'gp'+b.id,name:b.kingdomName}));
      return JSON.stringify(generateNewGame(setup,JSON.parse(size),999,JSON.parse(opts))); }`,
    engine,
  ) as (realms: number, size: string, opts: string) => string;
  return make(realms, JSON.stringify(size), JSON.stringify(opts));
}

/** Quiets the engine's console.log (log() echoes each line of the GM's log there) until the returned function is
 *  called. */
export function quietEngineLog(engine: vm.Context): () => void {
  const engineConsole = vm.runInContext('console', engine) as Console;
  const was = engineConsole.log;
  engineConsole.log = () => undefined;
  return () => {
    engineConsole.log = was;
  };
}
