// npm run proof:worlds -- --base <ref>: the world's making, the base against this branch (B-06s; tools/proof/README.md,
// section 7): for each case, the same world (the sha256 of its JSON), the same dice drawn in all and by stage (S0 to
// S17, the-worlds-makings-stages.ts; the bots' realms apart), and the same words on the console. Each world is made in
// a fresh process (the-worlds-making-worker.ts), a pool of them over the cores: once from a copy of the base (git
// archive of where this branch left it: git merge-base <ref> HEAD; node_modules linked) and once from this working
// tree, as it is now. The dice in all are not a proof on their own: a later loop that draws until a name is free can
// absorb an extra draw, so the stages' counts and the hash are compared too. It exits 1 when any case differs.
//
// The cases: each seed (40 unless --seeds says) on every map size the GM page offers, at the sea shares 20, 35, 60,
// 65, 70, 75 and 80 (the home sea cap's cuts are at 60 and 70), each seed with one of four mixes of players' realms
// (the rest are bots, drawn up as the GM page's Turn 0 does), which together hold every creed and a naval king; and
// each seed on an undersized map (five realms on the three-realm map: the 400 raw layouts' path).
//
// Options: --base REF (default main), --seeds N (default 40), --jobs N (worlds side by side; default one per core).
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../build.ts';
import { aFolderForACopy, copyACommit, linkNodeModules, removeTheCopy, theCommitOf } from './copies-of-the-tree.ts';
import type { AHumanRealm, AWorldCase, AWorldMade } from './the-worlds-making-worker.ts';

const WORKER = path.join(import.meta.dirname, 'the-worlds-making-worker.ts');

/** The map sizes the GM page offers, by their realms (src/ui/gm/turn-zero.ts's ladder; game-list.ts's agrees). */
export const THE_MAP_SIZES: readonly { size: string; realms: number; cols: number; rows: number }[] = [
  { size: 'p2', realms: 2, cols: 8, rows: 5 },
  { size: 'p3', realms: 3, cols: 8, rows: 7 },
  { size: 'p4', realms: 4, cols: 9, rows: 7 },
  { size: 'p5', realms: 5, cols: 12, rows: 7 },
  { size: 'p6', realms: 6, cols: 15, rows: 7 },
  { size: 'p7', realms: 7, cols: 16, rows: 7 },
  { size: 'p8', realms: 8, cols: 17, rows: 8 },
  { size: 'p9', realms: 9, cols: 16, rows: 11 },
  { size: 'p10', realms: 10, cols: 16, rows: 11 },
];
/** The sea shares: the GM page's control runs 20 to 80; 60 and 70 are the home sea cap's cuts. */
export const THE_SEA_SHARES: readonly number[] = [20, 35, 60, 65, 70, 75, 80];
/** The undersized map: five realms on the three-realm map, too small for any refined layout. */
export const THE_UNDERSIZED_MAP = { size: 'p3 with 5 realms', realms: 5, cols: 8, rows: 7 } as const;
/** The players' realms of each mix (a map with fewer realms takes the first): with the bots, every creed and a naval
 *  king, Divine and Undead once a game. */
export const THE_MIXES: readonly { mix: string; humans: AHumanRealm[] }[] = [
  { mix: 'every realm a bot', humans: [] },
  {
    mix: 'Divine (naval) and Pagan',
    humans: [
      { race: 'Human', alignment: 'Divine', naval: true },
      { race: 'Elven', alignment: 'Pagan', naval: false },
    ],
  },
  {
    mix: 'Undead and Druidic (naval)',
    humans: [
      { race: 'Orcish', alignment: 'Undead', naval: false },
      { race: 'Dwarven', alignment: 'Druidic', naval: true },
    ],
  },
  {
    mix: 'Good (naval), Neutral and Evil',
    humans: [
      { race: 'Human', alignment: 'Good', naval: true },
      { race: 'Dwarven', alignment: 'Neutral', naval: false },
      { race: 'Orcish', alignment: 'Evil', naval: false },
    ],
  },
];

/** Every case for `seeds` seeds (1, 2, …): each on every map size and sea share, then on the undersized map; a seed's
 *  mix is the next of THE_MIXES. */
export function theCases(seeds: number): AWorldCase[] {
  const cases: AWorldCase[] = [];
  for (let s = 1; s <= seeds; s++) {
    const { mix, humans } = THE_MIXES[(s - 1) % THE_MIXES.length] ?? { mix: '', humans: [] };
    const aCase = (size: string, realms: number, cols: number, rows: number, seaPct: number): AWorldCase => ({
      key: `seed ${String(s)}, ${size}, sea ${String(seaPct)}%, ${mix}`,
      seed: s,
      cols,
      rows,
      seaPct,
      realms,
      humans,
    });
    for (const m of THE_MAP_SIZES)
      for (const sea of THE_SEA_SHARES) cases.push(aCase(m.size, m.realms, m.cols, m.rows, sea));
    const u = THE_UNDERSIZED_MAP;
    cases.push(aCase(u.size, u.realms, u.cols, u.rows, 35));
  }
  return cases;
}

/** One case that differs: what differs, each side's. */
export interface ACaseThatDiffers {
  key: string;
  what: string[];
}

/** What differs between two sides' worlds of one case: the world, the dice in all, each stage's dice, the words, or
 *  what one side threw (a case both threw alike on is the same). */
export function whatDiffers(base: AWorldMade, branch: AWorldMade): string[] {
  if ('threw' in base || 'threw' in branch) {
    const a = 'threw' in base ? `threw "${base.threw}"` : 'made its world';
    const b = 'threw' in branch ? `threw "${branch.threw}"` : 'made its world';
    return a === b ? [] : [`the base ${a}, the branch ${b}`];
  }
  const what: string[] = [];
  if (base.hash !== branch.hash) what.push(`the world (${base.hash.slice(0, 12)} → ${branch.hash.slice(0, 12)})`);
  if (base.draws !== branch.draws) what.push(`the dice in all (${String(base.draws)} → ${String(branch.draws)})`);
  for (const stage of [...new Set([...Object.keys(base.byStage), ...Object.keys(branch.byStage)])]) {
    const a = base.byStage[stage] ?? 0;
    const b = branch.byStage[stage] ?? 0;
    if (a !== b) what.push(`${stage}'s dice (${String(a)} → ${String(b)})`);
  }
  if (base.said.join('\n') !== branch.said.join('\n'))
    what.push(`the words (${String(base.said.length)} lines → ${String(branch.said.length)})`);
  return what;
}

/** The cases whose two sides differ, and how many are the same. */
export function compareTheWorlds(
  cases: readonly AWorldCase[],
  base: ReadonlyMap<string, AWorldMade>,
  branch: ReadonlyMap<string, AWorldMade>,
): { same: number; differ: ACaseThatDiffers[] } {
  const differ: ACaseThatDiffers[] = [];
  const none: AWorldMade = { threw: 'not made' };
  for (const c of cases) {
    const what = whatDiffers(base.get(c.key) ?? none, branch.get(c.key) ?? none);
    if (what.length) differ.push({ key: c.key, what });
  }
  return { same: cases.length - differ.length, differ };
}

/** One world from the copy `side`, in a fresh process. */
function aWorldOf(side: string, c: AWorldCase): Promise<AWorldMade> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', WORKER, side, JSON.stringify(c)],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const last = stdout.trim().split('\n').pop() ?? '';
        try {
          resolve(JSON.parse(last) as AWorldMade);
        } catch {
          resolve({ threw: `the worker: ${(error?.message ?? stderr).slice(0, 300)}` });
        }
      },
    );
  });
}

/** Every case's world from each side, `jobs` worlds at a time, the biggest maps first. */
export async function theWorldsOfBothSides(
  sides: readonly string[],
  cases: readonly AWorldCase[],
  jobs: number,
): Promise<Map<string, AWorldMade>[]> {
  const made = sides.map(() => new Map<string, AWorldMade>());
  const queue = sides
    .flatMap((side, i) => cases.map((c) => ({ i, side, c })))
    .sort((a, b) => b.c.cols * b.c.rows - a.c.cols * a.c.rows);
  const next = async (): Promise<void> => {
    for (let job = queue.shift(); job; job = queue.shift())
      made[job.i]?.set(job.c.key, await aWorldOf(job.side, job.c));
  };
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, next));
  return made;
}

/** What the comparison prints: the figure, each case that differs (the first 20), and the branch's dice by stage. */
export function describeTheWorlds(
  result: { same: number; differ: ACaseThatDiffers[] },
  branch: ReadonlyMap<string, AWorldMade>,
  base: string,
): string[] {
  const total = result.same + result.differ.length;
  const out = [
    `The world's making, ${base} against this branch: ${String(result.same)} of ${String(total)} cases identical (${String(total)} worlds a side: the world's hash, its dice in all and by stage, its words).`,
  ];
  for (const d of result.differ.slice(0, 20)) out.push(`  ${d.key}: ${d.what.join('; ')}`);
  if (result.differ.length > 20) out.push(`  … and ${String(result.differ.length - 20)} more`);
  const byStage = new Map<string, number>();
  let draws = 0;
  let threw = 0;
  for (const w of branch.values()) {
    if ('threw' in w) {
      threw++;
      continue;
    }
    draws += w.draws;
    for (const [stage, n] of Object.entries(w.byStage)) byStage.set(stage, (byStage.get(stage) ?? 0) + n);
  }
  const stages = [...byStage].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  out.push(
    `The branch's dice: ${String(draws)} in all; ${stages.map(([s, n]) => `${s} ${String(n)}`).join(', ')}${threw ? `; ${String(threw)} worlds threw` : ''}.`,
  );
  return out;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: 'main' },
      seeds: { type: 'string', default: '40' },
      jobs: { type: 'string' },
    },
  });
  const t0 = performance.now();
  const cases = theCases(Number(values.seeds) || 40);
  const jobs = Number(values.jobs) || os.availableParallelism();
  const copy = aFolderForACopy('worlds-base');
  try {
    copyACommit(ROOT, theCommitOf(ROOT, values.base, { mergeBase: true }), copy);
    linkNodeModules(ROOT, copy);
    const [base = new Map(), branch = new Map()] = await theWorldsOfBothSides([copy, ROOT], cases, jobs);
    const result = compareTheWorlds(cases, base, branch);
    console.log(describeTheWorlds(result, branch, values.base).join('\n'));
    console.log(`(${String(jobs)} at a time; ${((performance.now() - t0) / 1000).toFixed(0)} s)`);
    return result.differ.length ? 1 : 0;
  } finally {
    removeTheCopy(copy);
  }
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  main().then(
    (code) => (process.exitCode = code),
    (e: unknown) => {
      console.error(e);
      process.exitCode = 1;
    },
  );
}
