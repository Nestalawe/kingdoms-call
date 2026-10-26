// The one way to load the engine in Node (plan P1-18c). The engine is the data file and every file under src/engine/ and
// src/views/ (tools/pages.ts's engineEntryFiles: the GM portal's order). Since its files are modules (P1-09d), Vite
// bundles them into one script, the engine's bundle (P1-09's Decision 11): an entry that re-exports every file, built
// with every export kept by its own name and no constant written in where it is read (tools/build.ts's KEEP_THE_CODE),
// its closing `export { … };` taken off. It runs in a bare vm context as a classic script, so the files' top-level names
// are the context's globals, as they were when each file ran there on its own: `vm.runInContext('typeof resolveTurn',
// engine)`, `engine.f = …` to stand in a top-level function (Rolldown writes each top-level const, let and class as a
// var, so those are the context's properties too).
//
// The context has only what the engine may read as it loads: JavaScript's own built-ins, the seed for the dice
// (KC_RNG_SEED, as tests/lib/boot.js gives a page) and console. No window, document, sb or crypto: the screen, the
// database and the browser are the page's, not the engine's. Nor structuredClone, setTimeout, performance,
// TextEncoder or fetch, which a vm context doesn't have: nothing in the engine reaches them as it loads. Keep it so;
// don't give the context more to make a file load. A file that needs more as it loads isn't engine code yet.
//
// The bundle of this checkout's src/ is built once per run, by tests/setup/global.ts, into node_modules/.cache/kc/
// (its path in KC_ENGINE_BUNDLE); one of another src (a copy with a fault planted) is built the first time a process
// asks for it, in a child process (`node tests/lib/engine.ts --bundle <src>`, about a second), and kept for the process.
// The turn is resolveTurn (src/engine/run-turn.ts, P1-18d), which reaches no screen and no database:
// tests/unit/engine-purity.test.ts plays a whole game through it here. runTurn, its shell, is the page's.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { KEEP_THE_CODE, packagesFromTheRepository, ROOT } from '../../tools/build.ts';
import { DATA_FILE, engineEntryFiles } from '../../tools/pages.ts';
import { THE_FIELDS_RESOLVE_TURN_ADDS, type TurnContext } from './the-fields-resolve-turn-adds-to-the-turns-context.ts';

export { DATA_FILE };
export type { TurnContext };

export interface EngineOptions {
  /** The dice's seed (an unsigned 32-bit integer; 0 reads as 1), as KC_RNG_SEED is a page's. */
  readonly seed: number;
  /** The source folder to load from (default: this checkout's src/), e.g. a copy with a planted fault. */
  readonly src?: string;
}

const SRC = path.join(ROOT, 'src');

/** Where the engine's bundle of `src` is kept for the run: node_modules/.cache/kc/engine-<hash of the path>.js. */
export const engineBundlePath = (src = SRC): string =>
  path.join(
    ROOT,
    'node_modules',
    '.cache',
    'kc',
    `engine-${crypto.createHash('sha256').update(path.resolve(src)).digest('hex').slice(0, 16)}.js`,
  );

/** The engine's bundle of `src`, as a classic script: Vite's build of an entry that re-exports every engine file (in
 *  engineEntryFiles' order), its closing export statement taken off. */
export async function buildEngineBundle(src = SRC): Promise<string> {
  const { build } = await import('vite');
  const ENTRY = '\0kc-engine-entry';
  const entry = engineEntryFiles(src)
    .map((f) => `export * from ${JSON.stringify(path.join(src, f))};`)
    .join('\n');
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    root: src,
    publicDir: false,
    plugins: [
      {
        name: 'kc-engine-entry',
        resolveId: (id) => (id === ENTRY ? ENTRY : null),
        load: (id) => (id === ENTRY ? entry : null),
      },
      // a planted copy of src/ outside the repository finds Zod in the repository's node_modules (P1-15d)
      packagesFromTheRepository(),
    ],
    build: {
      write: false,
      minify: false,
      target: 'esnext',
      modulePreload: false,
      rolldownOptions: {
        ...KEEP_THE_CODE,
        input: ENTRY,
        preserveEntrySignatures: 'strict',
        output: { format: 'es' },
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => ('output' in r ? r.output : []));
  const chunks = outputs.filter((o) => o.type === 'chunk');
  if (chunks.length !== 1) throw new Error(`the engine's bundle is ${String(chunks.length)} chunks, not one`);
  const code = chunks[0]?.code ?? '';
  // The entry's exports, all at the end: `export { a, b as c, … };`. A name exported under another one would mean a
  // file's name was changed in the bundle: none may be.
  const tail = /\nexport \{([^}]*)\};\s*$/.exec(code);
  if (!tail) throw new Error("the engine's bundle doesn't end with its exports");
  const renamed = (tail[1] ?? '').split(',').filter((e) => / as /.test(e));
  if (renamed.length) throw new Error(`the engine's bundle renames ${renamed.join(',')}`);
  return code.slice(0, tail.index + 1);
}

/** What the files under `dir` hold, as one hash: a copy of src/ changed between two loads is built again. */
function contentsOf(dir: string): string {
  const hash = crypto.createHash('sha256');
  const files = fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
    .sort();
  for (const f of files)
    hash
      .update(f)
      .update('\0')
      .update(fs.readFileSync(path.join(dir, f)))
      .update('\0');
  return hash.digest('hex');
}

const bundles = new Map<string, vm.Script>();
/** The engine's bundle of `src`, compiled once for this process: the run's own (KC_ENGINE_BUNDLE) for this checkout's
 *  src/, else built in a child process, again whenever what the folder holds has changed. */
function engineBundle(src: string): vm.Script {
  const dir = path.resolve(src);
  const ours = dir === path.resolve(SRC);
  const key = ours ? dir : `${dir}\0${contentsOf(dir)}`;
  const kept = bundles.get(key);
  if (kept) return kept;
  const ready = process.env['KC_ENGINE_BUNDLE'];
  const code =
    ours && ready && fs.existsSync(ready)
      ? fs.readFileSync(ready, 'utf8')
      : execFileSync(
          process.execPath,
          ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', import.meta.filename, '--bundle', dir],
          { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] },
        );
  const script = new vm.Script(code, { filename: 'engine.js' });
  bundles.set(key, script);
  return script;
}

/** Runs the engine's bundle (the data file, then the engine's files) in a new vm context, and returns the context. */
export function loadEngine({ seed, src = SRC }: EngineOptions): vm.Context {
  // Not contextified (P1-09d): the context's global object is an ordinary one, so the engine's top-level names (each a
  // var in the bundle, a property of that object) read at full speed, without an interceptor on every read.
  const engine = vm.createContext(vm.constants.DONT_CONTEXTIFY) as vm.Context & Record<string, unknown>;
  engine['KC_RNG_SEED'] = seed;
  engine['console'] = console;
  engineBundle(src).runInContext(engine);
  return engine;
}

/** A top-level function of the engine, by name (plan P1-08a): `engineFn(engine, 'areEnemies')`. A helper lifted out of
 *  resolveTurn is one; if it reads the turn's state, it takes a context (`turnContext` below) first. */
export function engineFn(engine: vm.Context, name: string): (...args: never[]) => unknown {
  const fn: unknown = vm.runInContext(`typeof ${name}==='function'?${name}:undefined`, engine);
  if (typeof fn !== 'function') throw new Error(`the engine has no function ${name}`);
  return fn as (...args: never[]) => unknown;
}

/** A turn's context on a world made inside the vm (plan P1-08a): the state is parsed there, so its objects and arrays are
 *  the engine's own, as a turn's are (P1-18d). It starts as resolveTurn's does before the first phase: no hero's line,
 *  no phase, the phases not over, and what resolveTurn adds to the context (P1-08a…P1-08e) made empty, as
 *  resolveTurn declares it: no hero has move points yet, no battle has been numbered, no skill rise is held back, no
 *  realm is watching by Clairvoyance, nobody has been seen in a phase yet, and the reports aren't built; the bot realms
 *  are the slot rows that are bots' (P1-08e); no province has been entered this phase and no distance measured
 *  (P1-08i1); the Defend step isn't open, no raised host waits for it, and no host stood on a war front (P1-08i3); no hero has travelled light (P1-08j1); no realm has declared anything or called the Reckoning (P1-08k4); no order was refused as stale, no realm's declarations refused for the Safe Start, no research choice picked and no message sent (P1-08k7); the save's upgrade found nothing to tell (P1-15a). Give it a state as an object or as JSON. */
export function turnContext(
  engine: vm.Context,
  state: object | string,
  { freshPlayers = [], turn = 1 }: { freshPlayers?: unknown[]; turn?: number } = {},
): TurnContext {
  const make = vm.runInContext(
    `(state,players,turn)=>{ const tc=createTurnContext(JSON.parse(state),JSON.parse(players),turn);
      ${THE_FIELDS_RESOLVE_TURN_ADDS}
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

/** Quiets the engine's console.log (emit echoes each line of the GM's log there) until the returned function is
 *  called. */
export function quietEngineLog(engine: vm.Context): () => void {
  const engineConsole = vm.runInContext('console', engine) as Console;
  const was = engineConsole.log;
  engineConsole.log = () => undefined;
  return () => {
    engineConsole.log = was;
  };
}

// node tests/lib/engine.ts --bundle <src>: writes the engine's bundle of <src> to standard output (engineBundle above).
// node tests/lib/engine.ts --bundle-for-the-run: writes this checkout's to engineBundlePath() and prints that path
// (tests/setup/global.ts, which puts it in KC_ENGINE_BUNDLE). No top-level await: the test scripts require() this file
// (CommonJS can't load a module that awaits as it loads).
const entry = process.argv[1];
if (entry && fs.realpathSync(entry) === fs.realpathSync(import.meta.filename)) {
  if (process.argv[2] === '--bundle')
    void buildEngineBundle(path.resolve(process.argv[3] ?? SRC)).then((code) => process.stdout.write(code));
  else if (process.argv[2] === '--bundle-for-the-run')
    void buildEngineBundle().then((code) => {
      const file = engineBundlePath();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const part = `${file}.${String(process.pid)}.tmp`;
      fs.writeFileSync(part, code);
      fs.renameSync(part, file);
      process.stdout.write(file);
    });
}
