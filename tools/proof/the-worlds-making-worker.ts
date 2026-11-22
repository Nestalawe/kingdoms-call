// One world of the world proof (the-worlds-making-compared.ts starts one such process a world, so no world sees
// another's module state): `node the-worlds-making-worker.ts <root> <the case as JSON>`. It makes the case's world from
// the copy of the repository at <root> (its own src/, imported as it is: Node strips the types, so a frame's line is
// the source's), its dice a counting stream from the case's seed (kcRng.use; no change to src/): the bots' realms as
// the GM page's Turn 0 draws them up (generateBotSetups, src/ui/gm/turn-zero.ts), then generateNewGame. It prints one
// line of JSON: the sha256 of the world's JSON, the dice drawn, the dice drawn by stage (the-worlds-makings-stages.ts),
// and what the making said on the console; or what it threw.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getCallSites } from 'node:util';
import { THE_BOTS_REALMS, theStageOfADraw, theStagesOfTheSideAt, type AFrame } from './the-worlds-makings-stages.ts';

/** A realm a player sets up as he joins (the rest of a case's realms are bots). */
export interface AHumanRealm {
  race: string;
  alignment: string;
  /** A naval king: two of his four skill points in Naval. */
  naval: boolean;
}
/** One world to make: its seed, its map, its sea share, how many realms, and the players' own (the bots fill the
 *  rest). */
export interface AWorldCase {
  key: string;
  seed: number;
  cols: number;
  rows: number;
  seaPct: number;
  realms: number;
  humans: AHumanRealm[];
}
/** What one side made of a case. */
export type AWorldMade =
  { hash: string; draws: number; byStage: Record<string, number>; said: string[] } | { threw: string };

/** A realm's set-up as generateNewGame takes it. */
interface ARealmsSetUp {
  id: number;
  gamePlayerId?: string;
  isBot: boolean;
  kingName: string;
  kingdomName: string;
  race: string;
  alignment: string;
  temper: string;
  skills: Record<string, number>;
}
/** What the worker calls in a side's src/. */
interface TheSidesMaking {
  generateNewGame(setups: unknown[], sz: { cols: number; rows: number }, maxTurns: number, opts: object): unknown;
  generateBotSetups(humans: ARealmsSetUp[], count: number, startIndex: number): ARealmsSetUp[];
  kcRng: { use(fn: () => number): () => number };
  kcRngStream(seed: number): () => number;
}

/** The players' realms of a case: made-up names, four skill points each. */
export function theHumansSetUps(c: AWorldCase): ARealmsSetUp[] {
  return c.humans.slice(0, c.realms).map((h, i) => ({
    id: i,
    gamePlayerId: `case-player-${String(i)}`,
    isBot: false,
    kingName: `Test King ${String(i + 1)}`,
    kingdomName: `Testmark ${String(i + 1)}`,
    race: h.race,
    alignment: h.alignment,
    temper: 'Brave',
    skills: h.naval ? { naval: 2, tactical: 1, melee: 1 } : { melee: 2, tactical: 1, sage: 1 },
  }));
}

/** Makes the case's world from the copy at `root` (resolved: a draw's frames name the files by their real path). */
export async function theWorldMade(root: string, c: AWorldCase): Promise<AWorldMade> {
  const real = fs.realpathSync(root);
  const src = path.join(real, 'src');
  const from = (f: string) => import(pathToFileURL(path.join(src, f)).href) as Promise<Record<string, unknown>>;
  await from('engine/run-turn.ts');
  const [world, bots, rng] = await Promise.all([
    from('engine/world/generate.ts'),
    from('engine/bots/setup.ts'),
    from('engine/rng.ts'),
  ]);
  const making = { ...world, ...bots, ...rng } as unknown as TheSidesMaking;
  const stages = theStagesOfTheSideAt(src);
  const said: string[] = [];
  for (const how of ['log', 'info', 'warn', 'error'] as const)
    console[how] = (...args: unknown[]) => said.push(`${how}: ${args.map(String).join(' ')}`);
  const byStage: Record<string, number> = {};
  let draws = 0;
  let drawingTheBots = true;
  const dice = making.kcRngStream(c.seed);
  making.kcRng.use(() => {
    draws++;
    const stage = drawingTheBots
      ? THE_BOTS_REALMS
      : theStageOfADraw(
          getCallSites(200).map((f): AFrame => ({
            functionName: f.functionName,
            scriptName: f.scriptName.startsWith('file:') ? fileURLToPath(f.scriptName) : f.scriptName,
            lineNumber: f.lineNumber,
          })),
          stages,
          src,
        );
    byStage[stage] = (byStage[stage] ?? 0) + 1;
    return dice();
  });
  try {
    const humans = theHumansSetUps(c);
    const botCount = c.realms - humans.length;
    const botsSetUps = botCount > 0 ? making.generateBotSetups(humans, botCount, humans.length) : [];
    drawingTheBots = false;
    const setups = [...humans, ...botsSetUps]
      .map((sp) => ({
        id: sp.id,
        gamePlayerId: sp.gamePlayerId ?? `case-bot-${String(sp.id)}`,
        isBot: sp.isBot,
        name: sp.kingdomName,
        kingName: sp.kingName,
        kingdomName: sp.kingdomName,
        race: sp.race,
        alignment: sp.alignment,
        temper: sp.temper,
        skills: sp.skills,
      }))
      .sort((a, b) => a.id - b.id);
    const made = making.generateNewGame(setups, { cols: c.cols, rows: c.rows }, 12, { seaPct: c.seaPct });
    const hash = crypto.createHash('sha256').update(JSON.stringify(made)).digest('hex');
    return { hash, draws, byStage, said };
  } catch (e: unknown) {
    return { threw: (e instanceof Error ? e.message : String(e)).slice(0, 300) };
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(import.meta.filename)) {
  const [root = '', job = '{}'] = process.argv.slice(2);
  const write = process.stdout.write.bind(process.stdout);
  theWorldMade(root, JSON.parse(job) as AWorldCase).then(
    (made) => write(JSON.stringify(made) + '\n'),
    (e: unknown) => {
      write(JSON.stringify({ threw: `the worker: ${String(e)}` }) + '\n');
      process.exitCode = 1;
    },
  );
}
