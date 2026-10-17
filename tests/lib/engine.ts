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
