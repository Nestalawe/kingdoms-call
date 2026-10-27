// The balance matrix's baselines (tools/balance/baseline.ts, P1-02a): the file form, the game-by-game comparison, and
// the committed baselines themselves: every game of the matrix, every scripted case at least once, and set A against
// set B (chance alone) called "no meaningful change" by the noise rule. And every realm's report (reports.json,
// P1-12a1): its file form, the comparison that names the game, turn, realms and sections, and the committed file:
// every game of both sets, a report for every realm every turn, as many turns as the page's games. Level 1 (unit): pure
// functions, and the committed files read as data (nothing is played: npm run balance plays them).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  columnsNotKept,
  compareReports,
  describeReportsDiff,
  diffGame,
  diffReportsGame,
  formatBaseline,
  formatReports,
  parseBaseline,
  parseReports,
  readBaseline,
  readReports,
  REPORTS_FILE,
  reportsIn,
  totalCases,
  writeReports,
  writeRun,
  type KeptGame,
  type ReportsGame,
} from '../../tools/balance/baseline.ts';
import { TURN_COLUMNS } from '../../tools/balance/hash.ts';
import { matrix } from '../../tools/balance/matrix.ts';
import { compareRuns, meaningfulChanges } from '../../tools/balance/paired.ts';
import { theScriptedCasesThatNeverHappened } from '../../tools/balance/run.ts';

const t = (...cols: string[]) => cols.join(' ');
const game: KeptGame = {
  id: 'scripted-00',
  turns: [t('a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1'), t('a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2')],
  results: 'r',
  report: { kingdom: ['k', 'kw'], lastTurnLog: ['l', 'lw'] },
  stats: { 'battles: fought': [10, 1], 'lairs: cleared': [3, 4] },
  cases: { encounter: 1, battleChase: 0 },
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
    expect(diffGame(game, { ...game, cases: { encounter: 1, battleChase: 1 } })).not.toBeNull();
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

  test('every scripted case happens at least once, but one a required scenario gives (P1-15e2b)', () => {
    // the run's own check (run.ts): the held chase is required of its named scenario, no longer of the games
    expect(theScriptedCasesThatNeverHappened(totalCases(A))).toEqual([]);
  });

  test('set A against set B, where every game differs: no meaningful change', () => {
    const pick = (games: KeptGame[], group: string) => games.filter((g) => g.id.startsWith(group)).map((g) => g.stats);
    for (const group of ['bots', 'scripted'])
      expect(compareRuns(pick(A, group), pick(B, group)).length, group).toBeGreaterThan(50);
    // the overall answer, as the run and the report give it (paired.ts): the bot games' changes only, the rule being
    // set for their 48; 12 scripted games are too few for its bar (P1-15e3, Theo 2026-10-27)
    expect(meaningfulChanges(compareRuns(pick(A, 'bots'), pick(B, 'bots'))).map((c) => c.key)).toEqual([]);
  });
});

describe("every realm's report (reports.json)", () => {
  const reports: ReportsGame = {
    id: 'bots-00',
    turns: ['0:p0/w0 1:p1/w1 2:p2/w2', '0:q0/v0 1:q1/v1 2:q2/v2'],
    sections: { lastTurnLog: ['l', 'lw'], kingdom: ['k', 'kw'] },
  };
  /** `g` with realm `realm`'s report at turn `turn` (1 the first) changed, in its play or only its words. */
  const changed = (g: ReportsGame, turn: number, realm: number, words = false): ReportsGame => ({
    ...g,
    turns: g.turns.map((line, t) =>
      t + 1 === turn
        ? line
            .split(' ')
            .map((e) => (e.startsWith(`${String(realm)}:`) ? (words ? e + 'x' : e.replace('/', 'x/')) : e))
            .join(' ')
        : line,
    ),
  });

  test('round-trips, one game per line, and rewriting one set keeps the other', () => {
    const text = formatReports({ A: [reports], B: [{ ...reports, id: 'bots-01' }] });
    expect(parseReports(text)).toEqual({ A: [reports], B: [{ ...reports, id: 'bots-01' }] });
    expect(text.split('\n').filter((l) => l.startsWith('      {"id":'))).toHaveLength(2);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-reports-'));
    try {
      const file = path.join(dir, 'reports.json');
      writeReports('A', [reports], file);
      writeReports('B', [{ ...reports, id: 'bots-01' }], file);
      writeReports('A', [{ ...reports, id: 'bots-02' }], file);
      expect(readReports('A', file).map((g) => g.id)).toEqual(['bots-02']);
      expect(readReports('B', file).map((g) => g.id)).toEqual(['bots-01']);
      expect(readReports('A', path.join(dir, 'none.json'))).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the same game: no difference; the reports counted', () => {
    expect(diffReportsGame(reports, structuredClone(reports))).toBeNull();
    expect(reportsIn([reports, reports])).toBe(12);
  });

  test('names the first turn that differs, the realms whose report does, and the sections', () => {
    const later = {
      ...changed(changed(changed(reports, 2, 1), 2, 2), 1, 0, true),
      sections: {
        ...reports.sections,
        kingdom: ['k2', 'kw2'] as [string, string],
        lastTurnLog: ['l', 'lw2'] as [string, string],
      },
    };
    const d = diffReportsGame(reports, later);
    expect(d).toEqual({
      id: 'bots-00',
      firstTurn: 1,
      realms: [0],
      turns: null,
      sections: ['kingdom', 'lastTurnLog (words)'],
    });
    expect(diffReportsGame(reports, changed(reports, 2, 1))).toMatchObject({ firstTurn: 2, realms: [1], sections: [] });
    expect(d && describeReportsDiff(d)).toBe('from turn 1; realm 0; report sections: kingdom, lastTurnLog (words)');
  });

  test('a game that ran longer, a realm missing, a game missing from the baseline', () => {
    const longer = { ...reports, turns: [...reports.turns, '0:r0/u0 1:r1/u1'] };
    expect(diffReportsGame(reports, longer)).toMatchObject({ firstTurn: 3, realms: [], turns: [2, 3] });
    const fewer = { ...reports, turns: [reports.turns[0] ?? '', '0:q0/v0 1:q1/v1'] };
    expect(diffReportsGame(reports, fewer)).toMatchObject({ firstTurn: 2, realms: [2] });
    expect(compareReports([reports], [reports, { ...reports, id: 'bots-01' }]).map((d) => d.id)).toEqual(['bots-01']);
  });

  describe('the committed baseline', () => {
    const file = fs.readFileSync(REPORTS_FILE, 'utf8');

    test('is written as formatReports writes it', () => {
      expect(formatReports(parseReports(file))).toBe(file);
    });

    test.each(['A', 'B'] as const)(
      'set %s: every game of the matrix, in order, with a report for every realm every turn',
      (set) => {
        const games = readReports(set);
        expect(games.map((g) => g.id)).toEqual(matrix(set).map((g) => g.id));
        for (const [i, spec] of matrix(set).entries()) {
          const g = games[i];
          expect(g?.turns.length, spec.id).toBeGreaterThan(0);
          for (const line of g?.turns ?? [])
            expect(
              line.split(' ').map((e) => e.split(':')[0]),
              spec.id,
            ).toEqual(Array.from({ length: spec.realms }, (_, r) => String(r)));
          expect(Object.keys(g?.sections ?? {}), spec.id).toContain('lastTurnLog');
        }
      },
    );

    test("set A: each game as many turns as the page's (matrix.json)", () => {
      expect(readReports('A').map((g) => [g.id, g.turns.length])).toEqual(
        readBaseline('A').map((g) => [g.id, g.turns.length]),
      );
    });
  });
});
