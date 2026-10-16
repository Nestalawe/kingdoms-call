// The noise rule (plan P1-02, Decisions): compare two runs of the matrix game by game on the same seeds. A rule change
// touches only some games and leaves the others identical, so pairing sees a small change that two separate seed sets
// would bury in noise. For each statistic, the change and its range come from resampling whole games, 2,000 times,
// with a fixed resampling seed so the verdict repeats.
// - "clear change": the 99% range leaves out zero (chance alone would do this less than 1 time in 100);
// - "possible change": only the 95% range does;
// - "within the noise": neither does;
// - "too few to tell": too few cases to say (a thin slice: try a scenario).
//
// Many statistics are compared at once, so a few will look like a change by chance alone: of about 100, one at 99%
// and five at 95%. The overall answer (meaningfulChanges) therefore looks only at the bot games' headline statistics
// (no slices; the 12 scripted games are reported apart), and holds each to a stricter bar: with m of them, chance
// alone would move any one that far less than 1 time in 100·m, so it flags none of them by chance 99 times in 100.
import { baseOf, valueOf, type Stats } from './stats.ts';

export const RESAMPLES = 2000;
export const RESAMPLE_SEED = 20261016;
/** Fewer cases than this, in either run, is too few to tell. */
export const MIN_CASES = 20;

export type Verdict = 'clear change' | 'possible change' | 'within the noise' | 'too few to tell';

export interface Change {
  key: string;
  base: number;
  head: number;
  /** head − base */
  diff: number;
  range95: [number, number];
  range99: [number, number];
  /** The cases behind the figure (the count summed over the games), in each run. */
  cases: [number, number];
  /** The change in standard errors (the spread of the resampled changes); 0 when nothing changed. */
  z: number;
  verdict: Verdict;
}

/** mulberry32: a small seeded generator, so the verdict repeats. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const figure = (games: Stats[], key: string, pick: number[]): number => {
  let sum = 0;
  let count = 0;
  for (const i of pick) {
    const g = games[i];
    if (!g) continue;
    const [s, c] = valueOf(g, key);
    sum += s;
    count += c;
  }
  return count ? sum / count : NaN;
};

const quantile = (sorted: number[], q: number): number => sorted[Math.round(q * (sorted.length - 1))] ?? NaN;

/** Every statistic either run has, compared game by game: base[i] and head[i] are the same game (same seed). */
export function compareRuns(base: Stats[], head: Stats[]): Change[] {
  if (base.length !== head.length)
    throw new Error(`paired runs differ in size: ${String(base.length)} and ${String(head.length)}`);
  const n = base.length;
  const all = [...Array(n).keys()];
  const keys = [...new Set([...base, ...head].flatMap((g) => Object.keys(g)))].sort();
  // The same resampled games for every statistic.
  const rnd = seeded(RESAMPLE_SEED);
  const picks = Array.from({ length: RESAMPLES }, () => all.map(() => Math.floor(rnd() * n)));
  return keys.map((key) => {
    const cases: [number, number] = [0, 1].map((r) =>
      (r ? head : base).reduce((t, g) => t + valueOf(g, key)[1], 0),
    ) as [number, number];
    const b = figure(base, key, all);
    const hd = figure(head, key, all);
    const diffs = picks
      .map((p) => figure(head, key, p) - figure(base, key, p))
      .filter((d) => Number.isFinite(d))
      .sort((x, y) => x - y);
    const range95: [number, number] = [quantile(diffs, 0.025), quantile(diffs, 0.975)];
    const range99: [number, number] = [quantile(diffs, 0.005), quantile(diffs, 0.995)];
    const leavesOutZero = ([lo, hi]: [number, number]) => lo > 0 || hi < 0;
    const verdict: Verdict =
      Math.min(...cases) < MIN_CASES || diffs.length < RESAMPLES * 0.9
        ? 'too few to tell'
        : leavesOutZero(range99)
          ? 'clear change'
          : leavesOutZero(range95)
            ? 'possible change'
            : 'within the noise';
    const mean = diffs.reduce((t, d) => t + d, 0) / (diffs.length || 1);
    const se = Math.sqrt(diffs.reduce((t, d) => t + (d - mean) ** 2, 0) / Math.max(1, diffs.length - 1));
    const diff = hd - b;
    // A spread of rounding error only (every game moved alike) counts as none.
    const z =
      diff === 0 || !Number.isFinite(diff) ? 0 : se > 1e-9 * Math.abs(diff) ? diff / se : Math.sign(diff) * Infinity;
    return { key, base: b, head: hd, diff, range95, range99, cases, z, verdict };
  });
}

/** erfc(x) for x ≥ 0 (Abramowitz and Stegun 7.1.26: within 1.5e-7). */
function erfc(x: number): number {
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return poly * Math.exp(-x * x);
}
/** How often chance alone would move a figure this many standard errors or more, either way. */
export const chanceOf = (z: number): number => (Number.isFinite(z) ? erfc(Math.abs(z) / Math.SQRT2) : 0);

/** The headline statistics (no slices) that moved beyond the noise once the bar is raised for their number: empty
 *  means "no meaningful change". Give it the bot games' changes. */
export function meaningfulChanges(changes: Change[]): Change[] {
  const headline = changes.filter((c) => baseOf(c.key) === c.key && c.verdict !== 'too few to tell');
  const bar = 0.01 / Math.max(1, headline.length);
  return headline.filter((c) => chanceOf(c.z) < bar);
}
