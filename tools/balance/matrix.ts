// The balance matrix (plan P1-02, Decisions): 48 all-bot games and 12 with a scripted realm, each a fixed set-up and
// seed. Set A is the baseline every engine change is measured against; set B is the same matrix on other seeds, the
// noise baseline (what chance alone does to the figures).

/** The GM portal's map ladder (its `sizemap`, in the new-game form): one rung per number of realms. */
export const MAP_SIZES: Record<number, { cols: number; rows: number }> = {
  3: { cols: 8, rows: 7 },
  4: { cols: 9, rows: 7 },
  5: { cols: 12, rows: 7 },
  6: { cols: 15, rows: 7 },
};
const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish'];
const ALIGNMENTS = ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead'];
/** Games stop here if the Reckoning hasn't ended them: 94–96% have ended by then (P1-02, Decisions). */
export const MAX_TURNS = 30;
/** The page's clock at the start of every game. */
export const START = '2026-10-01T12:00:00Z';
/** The realm the runner holds in a scripted game. */
export const SCRIPTED_REALM = 0;

export type SeedSet = 'A' | 'B' | 'C' | 'D' | 'E';
/** A and B have baselines (tests/balance/baseline/); C to E are extra seed sets for bigger runs, compared with nothing. */
export type BaselineSet = 'A' | 'B';
const SEED_BASE: Record<SeedSet, number> = { A: 1000, B: 2000, C: 3000, D: 4000, E: 5000 };
export const SEED_SETS: readonly SeedSet[] = ['A', 'B', 'C', 'D', 'E'];

export interface GameSpec {
  /** 'bots-07', 'scripted-03': the same game in both seed sets has the same id, so they pair. */
  id: string;
  group: 'bots' | 'scripted';
  seed: number;
  realms: number;
  seaPct: number;
  diplomacy: 'normal' | 'hostile';
  races: string[];
  alignments: string[];
}

const rotate = (list: string[], k: number) => list.map((_, j) => list[(j + k) % list.length] ?? '');
const pad = (n: number) => String(n).padStart(2, '0');

/** The 60 games of one seed set, bot games first. */
export function matrix(set: SeedSet): GameSpec[] {
  const base = SEED_BASE[set];
  const games: GameSpec[] = [];
  // 4 sizes × sea 20% or 50% × normal or hostile bots × 3 seeds.
  for (let i = 0; i < 48; i++) {
    games.push({
      id: 'bots-' + pad(i),
      group: 'bots',
      seed: base + i,
      realms: 3 + (i % 4),
      seaPct: [20, 50][(i >> 2) % 2] ?? 20,
      diplomacy: (i >> 3) % 2 ? 'hostile' : 'normal',
      races: rotate(RACES, i),
      alignments: rotate(ALIGNMENTS, i),
    });
  }
  // Each size three times, with sea and diplomacy rotating.
  for (let j = 0; j < 12; j++) {
    const i = 48 + j;
    games.push({
      id: 'scripted-' + pad(j),
      group: 'scripted',
      seed: base + i,
      realms: 3 + (j % 4),
      seaPct: [20, 50][(j + (j >> 2)) % 2] ?? 20,
      diplomacy: ((j >> 1) + (j >> 2)) % 2 ? 'hostile' : 'normal',
      races: rotate(RACES, i),
      alignments: rotate(ALIGNMENTS, i),
    });
  }
  return games;
}
