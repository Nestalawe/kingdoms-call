// The committed baselines (tests/balance/baseline/) and the game-by-game comparison with them.
// - matrix.json: set A on main, every game's per-turn hashes, results, report sections, scripted cases and statistics.
//   An engine change is compared with it; `npm run balance:update` rewrites it in the PR that changes play.
// - noise.json: set B (other seeds), its statistics only. Set A against set B is what chance alone does: the noise rule
//   must call it "no meaningful change" (tests/unit/balance-noise.test.ts).
// - reports.json: every realm's report (every-realm.ts, P1-12a1), sets A and B: each game's reports per turn and realm,
//   and its report sections over the game.
// Statistics are kept as one list of names and, per game, one [sum, count] per name (null where the game lacks it),
// to keep the files small. A file names its hash columns: one from before a column was added (P1-02c's `writes`) is
// read with that column NOT_KEPT, which no comparison counts as a difference.
import fs from 'node:fs';
import path from 'node:path';
import { TURN_COLUMNS, type TurnColumn } from './hash.ts';
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

/** A turn's hash in a column its baseline file doesn't have. */
export const NOT_KEPT = '?';

/** A turn's hashes from a file with `columns`, in TURN_COLUMNS order. */
function inTurnColumns(line: string, columns: readonly string[]): string {
  const cols = line.split(' ');
  return TURN_COLUMNS.map((c) => (columns.includes(c) ? (cols[columns.indexOf(c)] ?? '') : NOT_KEPT)).join(' ');
}

export function parseBaseline(text: string): { set: SeedSet; games: KeptGame[] } {
  const f = JSON.parse(text) as File;
  const same = f.columns.join() === TURN_COLUMNS.join();
  return {
    set: f.set,
    games: f.games.map((g) => {
      const stats: Stats = {};
      f.statNames.forEach((k, i) => {
        const v = g.stats[i];
        if (v) stats[k] = v;
      });
      const turns = (g.turns ?? []).map((l) => (same ? l : inTurnColumns(l, f.columns)));
      return { ...g, turns, results: g.results ?? '', stats };
    }),
  };
}

/** The hash columns `games` don't have (their baseline is from before the column was added). */
export function columnsNotKept(games: KeptGame[]): TurnColumn[] {
  const first = games.find((g) => g.turns.length)?.turns[0]?.split(' ') ?? [];
  return TURN_COLUMNS.filter((_, i) => first[i] === NOT_KEPT);
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
      if (x[i] !== y[i] && x[i] !== NOT_KEPT && y[i] !== NOT_KEPT) {
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
  const t: Cases = { encounter: 0, battleChase: 0 };
  for (const g of games) {
    if (!g.cases) continue;
    for (const k of Object.keys(t) as (keyof Cases)[]) t[k] += g.cases[k];
  }
  return t;
}

// Every realm's report (reports.json).

export const REPORTS_FILE = path.join(BASELINE_DIR, 'reports.json');

/** A game's every-realm hashes, as kept in the baseline. */
export interface ReportsGame {
  id: string;
  /** One line per turn played: each realm's report, in realm order, as `realm:play/words`. */
  turns: string[];
  /** Each report section's hashes over the game, every realm's in turn and realm order: [play, words]. */
  sections: Record<string, [string, string]>;
}

/** A game played with every realm's report: its kept hashes, and what run.ts checks beside them. */
export interface ReportsResult extends ReportsGame {
  /** Each turn's saved state, hashed as the matrix's `state` column (hash.ts's playHash). */
  states: string[];
  /** The reports built. */
  reports: number;
  /** What the leak checks found, one entry per turn that broke one (describeBreaches). */
  leaks: string[];
  ms: number;
}

const REPORTS_ABOUT =
  "Every realm's report, every turn, in the balance matrix's games played in the engine's vm (tools/balance/every-realm.ts, npm run balance): sets A and B. Rewrite with npm run balance:update in the PR that changes a report.";

/** The baseline file's text: one game per line, so a change shows game by game. */
export function formatReports(sets: Partial<Record<SeedSet, ReportsGame[]>>): string {
  const lines = (games: ReportsGame[]) =>
    games.map((g) => '      ' + JSON.stringify({ id: g.id, turns: g.turns, sections: g.sections })).join(',\n');
  const kept = (['A', 'B'] as const).flatMap((set) => {
    const games = sets[set];
    return games ? [`    "${set}": [\n${lines(games)}\n    ]`] : [];
  });
  return `{\n  "about": ${JSON.stringify(REPORTS_ABOUT)},\n  "sets": {\n${kept.join(',\n')}\n  }\n}\n`;
}

export function parseReports(text: string): Partial<Record<SeedSet, ReportsGame[]>> {
  return (JSON.parse(text) as { sets: Partial<Record<SeedSet, ReportsGame[]>> }).sets;
}

/** The committed baseline's games of `set` ([] if it has none). */
export const readReports = (set: SeedSet, file = REPORTS_FILE): ReportsGame[] =>
  fs.existsSync(file) ? (parseReports(fs.readFileSync(file, 'utf8'))[set] ?? []) : [];

/** Writes `games` as `set`'s, keeping the other set as it is. */
export function writeReports(set: SeedSet, games: ReportsGame[], file = REPORTS_FILE): void {
  const sets = fs.existsSync(file) ? parseReports(fs.readFileSync(file, 'utf8')) : {};
  sets[set] = games.map((g) => ({ id: g.id, turns: g.turns, sections: g.sections }));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, formatReports(sets));
}

/** How one game's reports differ between two runs. */
export interface ReportsDiff {
  id: string;
  /** The first turn where a report differs (1 is the first turn played), or null if every turn both played matches. */
  firstTurn: number | null;
  /** The realms whose report differs at that turn. */
  realms: number[];
  /** The two runs played a different number of turns. */
  turns: [number, number] | null;
  /** The report sections that differ over the game: `name`, or `name (words)` when only its words do. */
  sections: string[];
}

const realmOf = (entry: string) => Number(entry.split(':')[0]);

export function diffReportsGame(a: ReportsGame, b: ReportsGame): ReportsDiff | null {
  let firstTurn: number | null = null;
  let realms: number[] = [];
  for (let t = 0; t < Math.min(a.turns.length, b.turns.length) && firstTurn == null; t++) {
    const x = a.turns[t]?.split(' ') ?? [];
    const y = b.turns[t]?.split(' ') ?? [];
    if (x.join() === y.join()) continue;
    firstTurn = t + 1;
    const all = [...new Set([...x, ...y].map(realmOf))].sort((p, q) => p - q);
    realms = all.filter((r) => x.find((e) => realmOf(e) === r) !== y.find((e) => realmOf(e) === r));
  }
  const turns: [number, number] | null = a.turns.length === b.turns.length ? null : [a.turns.length, b.turns.length];
  if (turns) firstTurn ??= Math.min(a.turns.length, b.turns.length) + 1;
  const names = [...new Set([...Object.keys(a.sections), ...Object.keys(b.sections)])].sort();
  const sections = names.flatMap((k) => {
    const [p, w] = a.sections[k] ?? ['-', '-'];
    const [q, v] = b.sections[k] ?? ['-', '-'];
    if (p === q && w === v) return [];
    return [p === q ? `${k} (words)` : k];
  });
  if (firstTurn == null && !sections.length) return null;
  return { id: a.id, firstTurn, realms, turns, sections };
}

/** One game's difference in a line: "from turn 7, realm 2; 30 turns → 29; report sections: lastTurnLog (words)". */
export function describeReportsDiff(d: ReportsDiff): string {
  return [
    d.firstTurn != null ? `from turn ${String(d.firstTurn)}` : '',
    d.realms.length ? `realm${d.realms.length > 1 ? 's' : ''} ${d.realms.join(', ')}` : '',
    d.turns ? `${String(d.turns[0])} turns → ${String(d.turns[1])}` : '',
    d.sections.length > 6
      ? `${String(d.sections.length)} report sections`
      : d.sections.length
        ? `report sections: ${d.sections.join(', ')}`
        : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** The reports in a run's games. */
export const reportsIn = (games: ReportsGame[]): number =>
  games.reduce((n, g) => n + g.turns.reduce((m, line) => m + (line ? line.split(' ').length : 0), 0), 0);

/** `head`'s games against `base`'s, game by game: the games that differ, or are missing from `base`. */
export function compareReports(base: ReportsGame[], head: ReportsGame[]): ReportsDiff[] {
  const byId = new Map(base.map((g) => [g.id, g]));
  return head.flatMap((g) => {
    const b = byId.get(g.id);
    if (!b) return [{ id: g.id, firstTurn: 1, realms: [], turns: null, sections: ['not in the baseline'] }];
    const d = diffReportsGame(b, g);
    return d ? [d] : [];
  });
}
