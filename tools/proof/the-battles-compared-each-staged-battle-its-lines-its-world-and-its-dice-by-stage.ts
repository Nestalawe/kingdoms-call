// npm run proof:battles -- --base <ref>: each staged battle, the base against this branch (B-06aw, B-06aw2;
// tools/proof/README.md, section 8): for each case of the grid and each of its dice streams, the same lines in words,
// the same world after (the sha256 of its JSON, with who won), the same writes to the turn's context (its log line by
// line, each other field's hash), and the same dice drawn in all and by stage (the-stages-of-the-two-battles-and-the-
// lines-that-open-them.ts, each side's stages found in its own tree). Each case is staged and fought in a fresh process
// (one-staged-battle-fought-on-a-side-in-a-fresh-process.ts), a pool of them over the cores: once from a copy of the
// base (git archive of where this branch left it: git merge-base <ref> HEAD; node_modules linked) and once from this
// working tree, as it is now. Each side stages its battles with its own tests/lib/a-battle-called-directly.ts. It exits
// 1 when any case differs.
//
// The grid: the ground (plain, forest, mountain, desert, sea) × the battle (against a province's defenders, between
// heroes) × the defender (led, leaderless) × where the attacker comes from (land, a landing, a landing that raids the
// coast) × the set of armies (THE_SETS_OF_ARMIES; at sea, only the sets whose hosts the sea carries), each fought with
// 8 dice streams.
//
// Options: --base REF (default main), --cases N (N cases spread over the grid, for a quick look; all unless given),
// --jobs N (cases side by side; default one per core).
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../build.ts';
import { aFolderForACopy, copyACommit, linkNodeModules, removeTheCopy, theCommitOf } from './copies-of-the-tree.ts';
import {
  type ABattleCase,
  type ABattleFought,
  type ACaseFought,
  THE_DICE_STREAMS,
  THE_SETS_OF_ARMIES,
  theSeaCarriesBothHosts,
} from './one-staged-battle-fought-on-a-side-in-a-fresh-process.ts';
import { THE_BATTLES } from './the-stages-of-the-two-battles-and-the-lines-that-open-them.ts';

const WORKER = path.join(import.meta.dirname, 'one-staged-battle-fought-on-a-side-in-a-fresh-process.ts');

/** The grounds of the grid: the four the matrix's land battles see most, and the sea. */
export const THE_GROUNDS: readonly string[] = ['plain', 'forest', 'mountain', 'desert', 'sea'];
export const THE_DEFENDERS: readonly ABattleCase['defender'][] = ['led', 'leaderless'];
export const WHERE_THE_ATTACKER_COMES_FROM: readonly ABattleCase['from'][] = ['land', 'sea', 'sea, raiding the coast'];

/** Every case of the grid, in its order: on a sea field, only the sets whose hosts the sea carries (each holds a ship
 *  or a sea beast). */
export function theBattleCases(): ABattleCase[] {
  const cases: ABattleCase[] = [];
  for (const terrain of THE_GROUNDS)
    for (const battle of THE_BATTLES)
      for (const defender of THE_DEFENDERS)
        for (const from of WHERE_THE_ATTACKER_COMES_FROM)
          for (const [armies, set] of Object.entries(THE_SETS_OF_ARMIES))
            if (terrain !== 'sea' || theSeaCarriesBothHosts(set))
              cases.push({
                key: `${terrain}, the battle ${battle}, the defender ${defender}, from ${from}, ${armies}`,
                battle,
                terrain,
                defender,
                from,
                armies,
              });
  return cases;
}

/** `n` cases spread evenly over `cases` (all of them when `n` is none or more). */
export function aSpreadOf(cases: readonly ABattleCase[], n: number | undefined): ABattleCase[] {
  if (!n || n >= cases.length) return [...cases];
  return Array.from({ length: n }, (_, i) => cases[Math.floor((i * cases.length) / n)]).filter(
    (c): c is ABattleCase => c !== undefined,
  );
}

/** What differs between two sides' battles of one stream: its lines, the world after, its dice in all, each stage's
 *  dice, or what one side threw (both throwing alike is the same). */
export function whatDiffersInABattle(base: ABattleFought, branch: ABattleFought): string[] {
  if ('threw' in base || 'threw' in branch) {
    const a = 'threw' in base ? `threw "${base.threw}"` : 'fought';
    const b = 'threw' in branch ? `threw "${branch.threw}"` : 'fought';
    return a === b ? [] : [`the base ${a}, the branch ${b}`];
  }
  const what: string[] = [];
  const at = base.lines.findIndex((l, i) => l !== branch.lines[i]);
  if (at >= 0 || base.lines.length !== branch.lines.length) {
    const i = at >= 0 ? at : Math.min(base.lines.length, branch.lines.length);
    what.push(
      `the lines (${String(base.lines.length)} → ${String(branch.lines.length)}; line ${String(i + 1)}: "${(base.lines[i] ?? '').slice(0, 80)}" → "${(branch.lines[i] ?? '').slice(0, 80)}")`,
    );
  }
  if (base.hash !== branch.hash) what.push(`the world (${base.hash.slice(0, 12)} → ${branch.hash.slice(0, 12)})`);
  const logAt = base.turnLog.findIndex((l, i) => l !== branch.turnLog[i]);
  if (logAt >= 0 || base.turnLog.length !== branch.turnLog.length) {
    const i = logAt >= 0 ? logAt : Math.min(base.turnLog.length, branch.turnLog.length);
    what.push(
      `the turn's log (${String(base.turnLog.length)} → ${String(branch.turnLog.length)}; entry ${String(i + 1)}: ${(base.turnLog[i] ?? '').slice(0, 80)} → ${(branch.turnLog[i] ?? '').slice(0, 80)})`,
    );
  }
  const fields = [...new Set([...Object.keys(base.context), ...Object.keys(branch.context)])];
  const changed = fields.filter((f) => base.context[f] !== branch.context[f]);
  if (changed.length) what.push(`the turn's context (${changed.join(', ')})`);
  if (base.draws !== branch.draws) what.push(`the dice in all (${String(base.draws)} → ${String(branch.draws)})`);
  for (const stage of [...new Set([...Object.keys(base.byStage), ...Object.keys(branch.byStage)])]) {
    const a = base.byStage[stage] ?? 0;
    const b = branch.byStage[stage] ?? 0;
    if (a !== b) what.push(`${stage}'s dice (${String(a)} → ${String(b)})`);
  }
  return what;
}

/** What differs between two sides' runs of one case: each stream's, named by its stream. */
export function whatDiffersInACase(base: ACaseFought, branch: ACaseFought): string[] {
  if ('threw' in base || 'threw' in branch) {
    const a = 'threw' in base ? `threw "${base.threw}"` : 'staged it';
    const b = 'threw' in branch ? `threw "${branch.threw}"` : 'staged it';
    return a === b ? [] : [`the base ${a}, the branch ${b}`];
  }
  const none: ABattleFought = { threw: 'not fought' };
  return [...new Set([...Object.keys(base.byStream), ...Object.keys(branch.byStream)])].flatMap((s) =>
    whatDiffersInABattle(base.byStream[s] ?? none, branch.byStream[s] ?? none).map((w) => `stream ${s}: ${w}`),
  );
}

/** One case that differs: what differs, stream by stream. */
export interface ABattleCaseThatDiffers {
  key: string;
  what: string[];
}

/** The cases whose two sides differ, and how many are the same. */
export function compareTheBattles(
  cases: readonly ABattleCase[],
  base: ReadonlyMap<string, ACaseFought>,
  branch: ReadonlyMap<string, ACaseFought>,
): { same: number; differ: ABattleCaseThatDiffers[] } {
  const differ: ABattleCaseThatDiffers[] = [];
  const none: ACaseFought = { threw: 'not staged' };
  for (const c of cases) {
    const what = whatDiffersInACase(base.get(c.key) ?? none, branch.get(c.key) ?? none);
    if (what.length) differ.push({ key: c.key, what });
  }
  return { same: cases.length - differ.length, differ };
}

/** One case from the copy `side`, in a fresh process. */
function aCaseOf(side: string, c: ABattleCase): Promise<ACaseFought> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', WORKER, side, JSON.stringify(c)],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const last = stdout.trim().split('\n').pop() ?? '';
        try {
          resolve(JSON.parse(last) as ACaseFought);
        } catch {
          resolve({ threw: `the worker: ${(error?.message ?? stderr).slice(0, 300)}` });
        }
      },
    );
  });
}

/** Every case from each side, `jobs` at a time. */
export async function theBattlesOfBothSides(
  sides: readonly string[],
  cases: readonly ABattleCase[],
  jobs: number,
): Promise<Map<string, ACaseFought>[]> {
  const made = sides.map(() => new Map<string, ACaseFought>());
  const queue = sides.flatMap((side, i) => cases.map((c) => ({ i, side, c })));
  const next = async (): Promise<void> => {
    for (let job = queue.shift(); job; job = queue.shift()) made[job.i]?.set(job.c.key, await aCaseOf(job.side, job.c));
  };
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, next));
  return made;
}

/** What the comparison prints: the figure, each case that differs (the first 20, three of its differences each), the
 *  cases the stager could not stage and the battles that threw, and the branch's dice by stage. */
export function describeTheBattles(
  result: { same: number; differ: ABattleCaseThatDiffers[] },
  branch: ReadonlyMap<string, ACaseFought>,
  base: string,
): string[] {
  const total = result.same + result.differ.length;
  const out = [
    `The battles, ${base} against this branch: ${String(result.same)} of ${String(total)} cases identical (each fought with ${String(THE_DICE_STREAMS.length)} dice streams: its lines in words, the world after, the turn's context, its dice in all and by stage).`,
  ];
  for (const d of result.differ.slice(0, 20))
    out.push(
      `  ${d.key}: ${d.what.slice(0, 3).join('; ')}${d.what.length > 3 ? ` (and ${String(d.what.length - 3)} more)` : ''}`,
    );
  if (result.differ.length > 20) out.push(`  … and ${String(result.differ.length - 20)} more`);
  const byStage = new Map<string, number>();
  let draws = 0;
  let battles = 0;
  const notStaged: string[] = [];
  let threw = 0;
  for (const [key, c] of branch) {
    if ('threw' in c) {
      notStaged.push(`${key} (${c.threw})`);
      continue;
    }
    for (const b of Object.values(c.byStream)) {
      if ('threw' in b) {
        threw++;
        continue;
      }
      battles++;
      draws += b.draws;
      for (const [stage, n] of Object.entries(b.byStage)) byStage.set(stage, (byStage.get(stage) ?? 0) + n);
    }
  }
  const stages = [...byStage].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  out.push(
    `The branch's battles: ${String(battles)} fought${threw ? `, ${String(threw)} threw` : ''}; their dice ${String(draws)} in all; ${stages.map(([s, n]) => `${s} ${String(n)}`).join(', ')}.`,
  );
  if (notStaged.length) {
    out.push(`Not staged on the branch (${String(notStaged.length)}):`);
    for (const n of notStaged.slice(0, 10)) out.push(`  ${n}`);
    if (notStaged.length > 10) out.push(`  … and ${String(notStaged.length - 10)} more`);
  }
  return out;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: 'main' },
      cases: { type: 'string' },
      jobs: { type: 'string' },
    },
  });
  const t0 = performance.now();
  const cases = aSpreadOf(theBattleCases(), Number(values.cases) || undefined);
  const jobs = Number(values.jobs) || os.availableParallelism();
  const copy = aFolderForACopy('battles-base');
  try {
    copyACommit(ROOT, theCommitOf(ROOT, values.base, { mergeBase: true }), copy);
    linkNodeModules(ROOT, copy);
    const [base = new Map(), branch = new Map()] = await theBattlesOfBothSides([copy, ROOT], cases, jobs);
    const result = compareTheBattles(cases, base, branch);
    console.log(describeTheBattles(result, branch, values.base).join('\n'));
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
