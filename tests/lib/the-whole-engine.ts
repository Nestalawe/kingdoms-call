// The whole engine, imported (plan P1-14a): a test that calls the engine's functions from their modules imports this
// file first, so every file of the engine has run its load-time set-up, as in the engine's bundle (tests/lib/engine.ts)
// and on the GM page. It matters: as engine/items/equipment.ts loads, it re-tiers two of the content's tables
// (ALL_MAGIC_ITEMS_P and LEGENDARY_ITEMS_P), so a test that imports only the data file, or only the files one function
// reaches (world/generate.ts reaches 44 of the 116 files of src/engine/ and src/views/), reads them as they were before.
//
//   import '../lib/the-whole-engine.ts';                       // first, in a file of tests on tables and pure functions
//   import { generateNewGame } from '../../src/engine/world/generate.ts';
//
// run-turn.ts reaches every file of src/engine/ and src/views/ but clock.ts and world/generate.ts, so these three are
// all of it. A test whose outcome depends on the dice gives itself fresh modules instead (vi.resetModules(), then
// `await import(…)` of this file and of what it calls, then kcRng.seed(…)), so its world doesn't depend on the tests
// before it: tests/lib/a-staged-turn-on-the-engines-modules.ts does. tests/unit/engine-loads.test.ts checks that what
// the modules hold, once this is imported, is what the bundle holds.
import path from 'node:path';
import '../../src/engine/run-turn.ts';
import '../../src/engine/world/generate.ts';
import '../../src/engine/clock.ts';

/** The files that import the whole engine, relative to src/. */
export const THE_WHOLE_ENGINE = ['engine/run-turn.ts', 'engine/world/generate.ts', 'engine/clock.ts'] as const;

/** Imports the whole engine of another copy of src/ (a planted copy, tests/lib/source.ts's plantedSrc), as this file
 *  imports this checkout's: its modules are its own, beside this checkout's. */
export async function importTheWholeEngineFrom(src: string): Promise<void> {
  for (const file of THE_WHOLE_ENGINE) await import(path.join(src, file));
}
