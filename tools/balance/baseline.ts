// The committed baselines (tests/balance/baseline/) and the game-by-game comparison with them.
// - matrix.json: set A on main, every game's per-turn hashes, results, report sections, scripted cases and statistics.
//   An engine change is compared with it; `npm run balance:update` rewrites it in the PR that changes play.
// - noise.json: set B (other seeds), its statistics only. Set A against set B is what chance alone does: the noise rule
//   must call it "no meaningful change" (tests/unit/balance-noise.test.ts).
// Statistics are kept as one list of names and, per game, one [sum, count] per name (null where the game lacks it),
// to keep the files small.
import fs from 'node:fs';
import path from 'node:path';
import { TURN_COLUMNS } from './hash.ts';
import type { SeedSet } from './matrix.ts';
import type { Cases, GameResult } from './play.ts';
import type { Stat, Stats } from './stats.ts';

export const BASELINE_DIR = path.resolve(import.meta.dirname, '..', '..', 'tests', 'balance', 'baseline');
export const BASELINE_FILE: Record<SeedSet, string> = {
  A: path.join(BASELINE_DIR, 'matrix.json'),
  B: path.join(BASELINE_DIR, 'noise.json'),
};

/** A game as kept in a baseline: a GameResult without its time. Set B keeps only `id` and `stats`. */
export type KeptGame = Omit<GameResult, 'ms'>;

interface File {
  about: string;
  set: SeedSet;
  columns: readonly string[];
  statNames: string[];
  // Set B's games have only `id` and `stats`.
  games: (Partial<Omit<KeptGame, 'stats'>> & { id: string; stats: (Stat | null)[] })[];
}

const ABOUT: Record<SeedSet, string> = {
  A: 'The balance matrix on main, set A (tools/balance/, npm run balance). Rewrite with npm run balance:update in the PR that changes play.',
  B: 'The noise baseline: the balance matrix on main, set B (other seeds), statistics only. Rewritten by npm run balance:update.',
};

/** The baseline file's text: one game per line, so a change shows game by game. */
export function formatBaseline(set: SeedSet, games: KeptGame[]): string {
  const statNames = [...new Set(games.flatMap((g) => Object.keys(g.stats)))].sort();
  const kept = games.map((g) => {
    const stats = statNames.map((k) => g.stats[k] ?? null);
    return set === 'A' ? { ...g, stats } : { id: g.id, stats };
  });
  const head = { about: ABOUT[set], set, columns: TURN_COLUMNS, statNames };
  const top = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  return `${top},\n  "games": [\n${kept.map((g) => '    ' + JSON.stringify(g)).join(',\n')}\n  ]\n}\n`;
}

export function parseBaseline(text: string): { set: SeedSet; games: KeptGame[] } {
  const f = JSON.parse(text) as File;
  return {
    set: f.set,
    games: f.games.map((g) => {
      const stats: Stats = {};
      f.statNames.forEach((k, i) => {
        const v = g.stats[i];
        if (v) stats[k] = v;
      });
      return { ...g, turns: g.turns ?? [], results: g.results ?? '', stats };
    }),
  };
}

export const readBaseline = (set: SeedSet): KeptGame[] =>
  parseBaseline(fs.readFileSync(BASELINE_FILE[set], 'utf8')).games;

export function writeBaseline(set: SeedSet, games: KeptGame[]): void {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  fs.writeFileSync(BASELINE_FILE[set], formatBaseline(set, games));
}

/** A run in set A's form (npm run balance -- --out FILE), its folder made if missing. */
export function writeRun(file: string, games: KeptGame[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, formatBaseline('A', games));
}

/** How one game differs between two runs; null if it doesn't. */
export interface GameDiff {
  id: string;
  /** The first turn whose hashes differ (1 is the first turn played), or null if every turn both played matches. */
  firstTurn: number | null;
  /** The hash columns that differ in any turn. */
  columns: string[];
  /** The two runs played a different number of turns. */
  turns: [number, number] | null;
  results: boolean;
  /** Report sections whose play or words differ. */
  sections: string[];
  /** Statistics whose value differs. */
  stats: string[];
}

export function diffGame(a: KeptGame, b: KeptGame): GameDiff | null {
  let firstTurn: number | null = null;
  const columns = new Set<string>();
  for (let t = 0; t < Math.min(a.turns.length, b.turns.length); t++) {
    const x = a.turns[t]?.split(' ') ?? [];
    const y = b.turns[t]?.split(' ') ?? [];
    TURN_COLUMNS.forEach((c, i) => {
      if (x[i] !== y[i]) {
        columns.add(c);
        firstTurn ??= t + 1;
      }
    });
  }
  const turns: [number, number] | null = a.turns.length === b.turns.length ? null : [a.turns.length, b.turns.length];
  if (turns) firstTurn ??= Math.min(a.turns.length, b.turns.length) + 1;
  const sectionNames = [...new Set([...Object.keys(a.report ?? {}), ...Object.keys(b.report ?? {})])].sort();
  const sections = sectionNames.filter((k) => a.report?.[k]?.join() !== b.report?.[k]?.join());
  const statNames = [...new Set([...Object.keys(a.stats), ...Object.keys(b.stats)])].sort();
  const stats = statNames.filter((k) => a.stats[k]?.join() !== b.stats[k]?.join());
  const results = a.results !== b.results;
  const cases = JSON.stringify(a.cases) !== JSON.stringify(b.cases);
  if (firstTurn == null && !results && !sections.length && !stats.length && !cases) return null;
  return { id: a.id, firstTurn, columns: TURN_COLUMNS.filter((c) => columns.has(c)), turns, results, sections, stats };
}

/** The scripted cases summed over games. */
export function totalCases(games: { cases?: Cases }[]): Cases {
  const t: Cases = { encounter: 0, pursue: 0, battleChase: 0 };
  for (const g of games) {
    if (!g.cases) continue;
    for (const k of Object.keys(t) as (keyof Cases)[]) t[k] += g.cases[k];
  }
  return t;
}
