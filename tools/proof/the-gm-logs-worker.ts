// One of the GM-log comparison's worker processes (the-gm-logs-compared.ts starts one per core for each side): it plays
// each matrix game it is sent from one copy of the repository (its own src/ and its own harness, tests/lib/), as every
// realm's report plays them (tools/balance/every-realm.ts: the engine's vm, the scripted realm's orders, the shell's
// work around each turn), and sends back the game's GM log, as the shell saves it: one line per entry, `t<turn> <the
// entry as JSON>`. The engine's bundle is the copy's own, built once for the side (KC_ENGINE_BUNDLE).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { GameSpec, SeedSet } from '../balance/matrix.ts';

/** A game to play: the copy to play it from, the set and the game. */
export interface GmLogJob {
  side: string;
  set: SeedSet;
  spec: GameSpec;
}
export type GmLogReply =
  { ok: true; set: SeedSet; id: string; log: string } | { ok: false; set: SeedSet; id: string; error: string };

interface Harness {
  MAX_TURNS: number;
  PAGE_DRAWS_AS_IT_LOADS: number;
  newWorldOf(engine: unknown, spec: GameSpec): string;
  slotRowsJsonOf(spec: GameSpec, state: string, turn: number): string;
  stampedAsTheShellSaves(json: string): string;
  scenarioInTheVm(opts: { seed?: number; src?: string }): {
    engine: unknown;
    W: { eval(code: string): unknown };
    reportEveryRealm(): void;
    play(state: string, rows: unknown[]): { S2: unknown; log: unknown[] };
  };
}

const harnesses = new Map<string, Promise<Harness>>();
/** The copy's own harness: its matrix's turn limit, its shell's steps, its vm. */
function harnessOf(side: string): Promise<Harness> {
  const load = async (): Promise<Harness> => {
    const from = (f: string) => import(pathToFileURL(path.join(side, f)).href) as Promise<Record<string, unknown>>;
    const [m, g, s] = await Promise.all([
      from('tools/balance/matrix.ts'),
      from('tests/lib/matrix-game.ts'),
      from('tests/lib/scenario-in-the-vm.ts'),
    ]);
    return { ...m, ...g, ...s } as unknown as Harness;
  };
  const kept = harnesses.get(side) ?? load();
  harnesses.set(side, kept);
  return kept;
}

/** Plays `spec` from the copy `side` and returns its GM log, line by line. */
export async function theGmLogOf(side: string, spec: GameSpec): Promise<string> {
  const H = await harnessOf(side);
  const sc = H.scenarioInTheVm({ seed: spec.seed, src: path.join(side, 'src') });
  sc.reportEveryRealm();
  for (let i = 0; i < H.PAGE_DRAWS_AS_IT_LOADS; i++) sc.W.eval('kcRng()');
  let state = H.newWorldOf(sc.engine, spec);
  const lines: string[] = [];
  for (let t = 1; t <= H.MAX_TURNS; t++) {
    const before = JSON.parse(state) as { gameOver?: unknown; turn: number };
    if (before.gameOver) break;
    const played = sc.play(state, JSON.parse(H.slotRowsJsonOf(spec, state, before.turn)) as unknown[]);
    state = H.stampedAsTheShellSaves(JSON.stringify(played.S2));
    for (const entry of played.log) lines.push(`t${String(t)} ${JSON.stringify(entry)}`);
  }
  return lines.join('\n');
}

const reply = (r: GmLogReply) => process.send?.(r);
process.on('message', (job: GmLogJob) => {
  theGmLogOf(job.side, job.spec).then(
    (log) => reply({ ok: true, set: job.set, id: job.spec.id, log }),
    (e: unknown) =>
      reply({
        ok: false,
        set: job.set,
        id: job.spec.id,
        error: e instanceof Error ? (e.stack ?? e.message) : String(e),
      }),
  );
});
