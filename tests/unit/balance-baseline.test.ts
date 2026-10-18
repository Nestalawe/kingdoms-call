// The balance matrix's baselines (tools/balance/baseline.ts, P1-02a): the file form, the game-by-game comparison, and
// the committed baselines themselves: every game of the matrix, every scripted case at least once, and set A against
// set B (chance alone) called "no meaningful change" by the noise rule. Level 1 (unit): pure functions, and the
// committed files read as data (nothing is played).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  columnsNotKept,
  diffGame,
  formatBaseline,
  parseBaseline,
  readBaseline,
  totalCases,
  writeRun,
  type KeptGame,
} from '../../tools/balance/baseline.ts';
import { TURN_COLUMNS } from '../../tools/balance/hash.ts';
import { matrix } from '../../tools/balance/matrix.ts';
import { compareRuns, meaningfulChanges } from '../../tools/balance/paired.ts';

const t = (...cols: string[]) => cols.join(' ');
const game: KeptGame = {
  id: 'scripted-00',
  turns: [t('a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1'), t('a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2')],
  results: 'r',
  report: { kingdom: ['k', 'kw'], lastTurnLog: ['l', 'lw'] },
  stats: { 'battles: fought': [10, 1], 'lairs: cleared': [3, 4] },
  cases: { encounter: 1, pursue: 2, battleChase: 0 },
};

describe('the file form', () => {
  test('round-trips, one game per line', () => {
    const text = formatBaseline('A', [game, { ...game, id: 'scripted-01', stats: { 'items: gained': [1, 1] } }]);
    expect(parseBaseline(text).games).toEqual([
      game,
      { ...game, id: 'scripted-01', stats: { 'items: gained': [1, 1] } },
    ]);
    expect(text.split('\n').filter((l) => l.startsWith('    {"id":'))).toHaveLength(2);
  });

  // npm run balance -- --out <file>, as CI's balance job runs it: into a folder the checkout doesn't have.
  test("a run is written in set A's form, into a folder that doesn't exist yet", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-balance-out-'));
    try {
      const file = path.join(dir, 'balance-report', 'played.json');
      writeRun(file, [game]);
      expect(parseBaseline(fs.readFileSync(file, 'utf8'))).toEqual({ set: 'A', games: [game] });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('set B keeps only the statistics', () => {
    expect(parseBaseline(formatBaseline('B', [game])).games).toEqual([
      { id: game.id, turns: [], results: '', stats: game.stats },
    ]);
  });
});

describe('the comparison, game by game', () => {
  test('the same game: no difference', () => {
    expect(diffGame(game, structuredClone(game))).toBeNull();
  });

  test('names the first turn that differs and every column that does', () => {
    const later = { ...game, turns: [game.turns[0] ?? '', t('a2', 'b2', 'c2', 'XX', 'e2', 'f2', 'YY')] };
    expect(diffGame(game, later)).toMatchObject({ firstTurn: 2, columns: ['logText', 'reportText'], turns: null });
  });

  test('a game that ran longer differs from the turn the shorter one stopped', () => {
    const longer = { ...game, turns: [...game.turns, t('a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3')] };
    expect(diffGame(game, longer)).toMatchObject({ firstTurn: 3, columns: [], turns: [2, 3] });
  });

  test('results, report sections, statistics and scripted cases count too', () => {
    expect(diffGame(game, { ...game, results: 's' })?.results).toBe(true);
    expect(diffGame(game, { ...game, report: { ...game.report, kingdom: ['k', 'other'] } })?.sections).toEqual([
      'kingdom',
    ]);
    expect(diffGame(game, { ...game, stats: { ...game.stats, 'lairs: cleared': [2, 4] } })?.stats).toEqual([
      'lairs: cleared',
    ]);
    expect(diffGame(game, { ...game, cases: { encounter: 1, pursue: 2, battleChase: 1 } })).not.toBeNull();
  });
});

// P1-02c added the `writes` column: the base branch's baseline, read by the balance report, can be from before it.
describe('a baseline from before a column was added', () => {
  const full: KeptGame = {
    ...game,
    turns: [TURN_COLUMNS.map((c) => c + '1').join(' '), TURN_COLUMNS.map((c) => c + '2').join(' ')],
  };
  const old = parseBaseline(
    formatBaseline('A', [full])
      .replace(/,\s*"writes"\s*\]/, ']')
      .replace(/ writes\d"/g, '"'),
  ).games;

  test('reads with that column not kept, and says which; a full one has none missing', () => {
    expect(old[0]?.turns).toEqual(full.turns.map((l) => l.replace(/writes\d$/, '?')));
    expect(columnsNotKept(old)).toEqual(['writes']);
    expect(columnsNotKept([full])).toEqual([]);
  });

  test('the column it lacks is never a difference; the others still are', () => {
    expect(diffGame(old[0] ?? full, full)).toBeNull();
    const later = { ...full, turns: [full.turns[0] ?? '', full.turns[1]?.replace('state2', 'XX') ?? ''] };
    expect(diffGame(old[0] ?? full, later)).toMatchObject({ firstTurn: 2, columns: ['state'] });
  });
});

describe('the committed baselines', () => {
  const A = readBaseline('A');
  const B = readBaseline('B');

  test('hold every game of the matrix, in order', () => {
    expect(A.map((g) => g.id)).toEqual(matrix('A').map((g) => g.id));
    expect(B.map((g) => g.id)).toEqual(matrix('B').map((g) => g.id));
    for (const g of A) expect(g.turns.length, g.id).toBeGreaterThan(0);
  });

  test('have every hash column (P1-02c: writes)', () => {
    expect(columnsNotKept(A)).toEqual([]);
  });

  test('every scripted case happens at least once', () => {
    const cases = totalCases(A);
    for (const [k, n] of Object.entries(cases)) expect(n, k).toBeGreaterThan(0);
  });

  test('set A against set B, where every game differs: no meaningful change', () => {
    for (const group of ['bots', 'scripted']) {
      const pick = (games: KeptGame[]) => games.filter((g) => g.id.startsWith(group)).map((g) => g.stats);
      const changes = compareRuns(pick(A), pick(B));
      expect(changes.length, group).toBeGreaterThan(50);
      expect(
        meaningfulChanges(changes).map((c) => c.key),
        group,
      ).toEqual([]);
    }
  });
});
