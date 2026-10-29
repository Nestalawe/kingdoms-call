// One side of the two-engine comparison, in its own process (the-two-engines-compared.ts starts one for the base and
// one for the branch): `node --import tsx the-two-engines-side.ts <src> <cases module> <streams> <out.json>`. It makes
// the row's cases for `src` (the module's default export, the-two-engines-cases.ts), runs each with its own dice and
// with each of the seeded dice streams 900, 901, … (as many as `streams`), and writes every run: its lines, each as
// JSON, the world's hash, and what it threw.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { TwoEngineCases } from './the-two-engines-cases.ts';

/** The first stream's seed; the others follow it. */
export const FIRST_STREAM = 900;

/** One run of a case on one side. */
export interface ASidesRun {
  name: string;
  dice: number | null;
  lines: string[];
  world: string | null;
  threw: string;
}
/** What a side writes. */
export interface ASidesRuns {
  pid: number;
  src: string;
  runs: ASidesRun[];
}

const hashOf = (x: unknown) =>
  x === undefined ? null : crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

/** Every run of every case the module at `casesFile` makes for `src`. */
export async function runTheCases(src: string, casesFile: string, streams: number): Promise<ASidesRuns> {
  const made = (await import(pathToFileURL(casesFile).href)) as { default: TwoEngineCases };
  const cases = await made.default({ src });
  const dice = [null, ...Array.from({ length: streams }, (_, i) => FIRST_STREAM + i)];
  const runs: ASidesRun[] = [];
  for (const c of cases)
    for (const d of dice) {
      try {
        const r = c.run(d);
        runs.push({
          name: c.name,
          dice: d,
          lines: r.lines.map((l) => JSON.stringify(l)),
          world: hashOf(r.world),
          threw: '',
        });
      } catch (e: unknown) {
        runs.push({ name: c.name, dice: d, lines: [], world: null, threw: String(e).slice(0, 300) });
      }
    }
  return { pid: process.pid, src, runs };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(import.meta.filename)) {
  const [src = '', casesFile = '', streams = '0', out = ''] = process.argv.slice(2);
  runTheCases(src, casesFile, Number(streams)).then(
    (r) => {
      fs.writeFileSync(out, JSON.stringify(r));
    },
    (e: unknown) => {
      console.error(e);
      process.exitCode = 1;
    },
  );
}
