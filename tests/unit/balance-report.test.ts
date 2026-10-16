// The balance report (tools/balance/report.ts, labels.ts; P1-03a): the class of change, where two runs first differ,
// the verdict, and every statistic's plain-words label. Made-up games with a known answer. Level 1 (unit): pure
// functions on small data; playing real games (the matrix, in CI) can't stage a reshape or a slice-only change on
// demand.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import type { KeptGame } from '../../tools/balance/baseline.ts';
import { TURN_COLUMNS, type TurnColumn } from '../../tools/balance/hash.ts';
import { BASE_LABELS, labelOf } from '../../tools/balance/labels.ts';
import type { LogEntry } from '../../tools/balance/play.ts';
import {
  buildReport,
  classify,
  compareGames,
  firstDifference,
  gamesToReplay,
  MAX_REPLAYS,
  PHASES,
  renderReport,
  RESHAPE_SHARE,
} from '../../tools/balance/report.ts';
import { PER_GAME, type Stats } from '../../tools/balance/stats.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

// 60 games, as in the matrix: 48 bot games and 12 with the scripted realm, five turns each.
const IDS = [
  ...Array.from({ length: 48 }, (_, i) => `bots-${String(i).padStart(2, '0')}`),
  ...Array.from({ length: 12 }, (_, i) => `scripted-${String(i).padStart(2, '0')}`),
];
const PVP = 'battles: attacker won | by kind: pvp';
const stats = (pvpWon = 3): Stats => ({
  'battles: attacker won': [6, 10],
  [PVP]: [pvpWon, 5],
  'battles: fought': [10, 1],
});
const game = (id: string, s: Stats = stats()): KeptGame => ({
  id,
  turns: Array.from({ length: 5 }, (_, t) => TURN_COLUMNS.map((c) => `${c}${String(t)}`).join(' ')),
  results: 'r',
  stats: s,
});
/** `g` with the hashes of `cols` changed from turn `from` on. */
const alter = (g: KeptGame, cols: TurnColumn[], from = 1): KeptGame => ({
  ...g,
  turns: g.turns.map((line, t) =>
    t + 1 < from
      ? line
      : line
          .split(' ')
          .map((h, i) => (cols.includes(TURN_COLUMNS[i] ?? 'state') ? h + 'x' : h))
          .join(' '),
  ),
});
const BASE = IDS.map((id) => game(id));

describe('the class of change', () => {
  test('identical games: no change', () => {
    expect(compareGames(BASE, structuredClone(BASE))).toEqual([]);
    expect(classify([], 60)).toBe('no change');
    expect(buildReport({ base: BASE, head: structuredClone(BASE) }).verdict).toBe(
      'No change: all 60 games played out exactly as before.',
    );
  });

  test('only the words differ (the state prose, the log text, the report text): wording only', () => {
    const head = BASE.map((g) => alter(g, ['prose', 'logText', 'reportText']));
    const changes = compareGames(BASE, head);
    expect(changes).toHaveLength(60);
    expect(changes.every((c) => c.words && !c.play)).toBe(true);
    expect(classify(changes, 60)).toBe('wording only');
  });

  test('any play hash, the length, the results, the scripted cases or a report section played: a change to play', () => {
    const one = (head: KeptGame) => compareGames([game('bots-00')], [head])[0];
    for (const c of ['state', 'log', 'telemetry', 'report'] as const) {
      expect(one(alter(game('bots-00'), [c], 3)), c).toMatchObject({ play: true, firstTurn: 3 });
    }
    expect(one({ ...game('bots-00'), turns: game('bots-00').turns.slice(0, 4) })).toMatchObject({ play: true });
    expect(one({ ...game('bots-00'), results: 'other' })).toMatchObject({ play: true });
    const scripted = { ...game('bots-00'), cases: { encounter: 1, pursue: 1, battleChase: 0 } };
    const withReport = { ...scripted, report: { lastTurnLog: ['p', 'w'] as [string, string] } };
    expect(
      compareGames([withReport], [{ ...withReport, cases: { encounter: 2, pursue: 1, battleChase: 0 } }])[0],
    ).toMatchObject({
      play: true,
    });
    expect(compareGames([withReport], [{ ...withReport, report: { lastTurnLog: ['p', 'w2'] } }])[0]).toMatchObject({
      play: false,
      words: true,
    });
    expect(compareGames([withReport], [{ ...withReport, report: { lastTurnLog: ['p2', 'w'] } }])[0]).toMatchObject({
      play: true,
    });
  });

  test(`a reshape is at least ${String(100 * RESHAPE_SHARE)}% of the games played out differently; fewer is a rule change`, () => {
    const changed = (n: number) => BASE.map((g, i) => (i < n ? alter(g, ['state']) : g));
    expect(classify(compareGames(BASE, changed(54)), 60)).toBe('reshape');
    expect(classify(compareGames(BASE, changed(53)), 60)).toBe('rule change');
    expect(classify(compareGames(BASE, changed(1)), 60)).toBe('rule change');
    // Words changing in the other games don't make it a reshape.
    const head = changed(10).map((g, i) => (i >= 10 ? alter(g, ['logText']) : g));
    expect(classify(compareGames(BASE, head), 60)).toBe('rule change');
  });

  test('a game missing on either side counts as played out differently', () => {
    expect(compareGames(BASE, BASE.slice(1))).toMatchObject([{ id: 'bots-00', play: true }]);
    expect(compareGames(BASE.slice(1), BASE)).toMatchObject([{ id: 'bots-00', play: true }]);
  });
});

// The same slice moves in both: battles between realms won by the attacker drop in 10 bot games, and no headline
// figure moves. Only the class of change differs.
describe('the class decides how the change is judged', () => {
  const sliceMoved = (g: KeptGame, i: number) => (i < 10 ? { ...g, stats: stats(1) } : g);

  test('a rule change (10 of 60 games changed): judged by its slices, so the slice is in the verdict', () => {
    const head = BASE.map((g, i) => (i < 10 ? alter(sliceMoved(g, i), ['state', 'log', 'telemetry'], 3) : g));
    const r = buildReport({ base: BASE, head });
    expect(r.class).toBe('rule change');
    expect(r.games).toMatchObject({ changed: 10, total: 60, bots: [10, 48], scripted: [0, 12] });
    expect(r.meaningful).toEqual([]);
    expect(r.slices.map((l) => l.key)).toEqual([PVP]);
    expect(r.slices[0]).toMatchObject({ base: '60.0%', head: '51.7%', verdict: 'clear change', games: 10 });
    expect(r.verdict).toBe(
      'Play changed in 10 of 60 games. Beyond the noise: Battles won by the attacker, against an enemy commander: ' +
        '60.0% → 51.7% (clear change).',
    );
  });

  test('a reshape (every game changed): judged as a whole by the strict answer, so the slice alone is no meaningful change', () => {
    const head = BASE.map((g, i) => alter(sliceMoved(g, i), ['state', 'log', 'telemetry']));
    const r = buildReport({ base: BASE, head });
    expect(r.class).toBe('reshape');
    expect(r.meaningful).toEqual([]);
    expect(r.verdict).toBe(
      'Every game played out differently (60 of 60), as when the order of the dice changes, so the games are judged ' +
        'as a whole: no meaningful change.',
    );
    // Still listed, apart, for the reader.
    expect(renderReport(r)).toContain('figures beyond the noise at the usual bar');
  });

  test('a reshape that moves a headline figure is a meaningful change', () => {
    const head = BASE.map((g) => alter({ ...g, stats: { ...g.stats, 'battles: attacker won': [3, 10] } }, ['state']));
    const r = buildReport({ base: BASE, head });
    expect(r.meaningful.map((l) => l.key)).toEqual(['battles: attacker won']);
    expect(r.verdict).toContain('a meaningful change in Battles won by the attacker: 60.0% → 30.0% (clear change)');
  });
});

describe('where two runs first differ', () => {
  const line = (text: string, extra: Partial<LogEntry> = {}): LogEntry => ({
    type: 'combat',
    text,
    phase: 1,
    provinceId: 4,
    ...extra,
  });
  const log = (outcome: string) => [
    line('— Early Summer —', { type: 'system' }),
    line('⚔ **Battle for Oakvale**'),
    line(`📊 Outcome: **${outcome}** wins — narrow (margin 2% of combined strength after fortune)`),
  ];

  test('a flipped battle: the season, the battle, and the line before and after', () => {
    expect(firstDifference('bots-03', 7, log('Aldric'), log('Brenna'))).toEqual({
      id: 'bots-03',
      turn: 7,
      season: 'Early Summer',
      battle: 'Battle for Oakvale',
      kind: 'a battle',
      before: '📊 Outcome: Aldric wins — narrow (margin 2% of combined strength after fortune)',
      after: '📊 Outcome: Brenna wins — narrow (margin 2% of combined strength after fortune)',
      detail: [],
      reworded: 1,
    });
  });

  test('words that differ only in spacing are shown as written, in quotes', () => {
    const d = firstDifference('bots-00', 1, [line('A line.')], [line('A line. ')]);
    expect([d.before, d.after]).toEqual(['"A line."', '"A line. "']);
    expect(d.reworded).toBe(1);
  });

  test('the same words with another field changed: the field is named', () => {
    const d = firstDifference('bots-00', 1, [line('Moves.')], [line('Moves.', { provinceId: 9 })]);
    expect(d).toMatchObject({ before: 'Moves.', after: 'Moves.', detail: ['provinceId'], reworded: 0 });
  });

  test("a line one run doesn't have, and a turn whose log is the same", () => {
    expect(firstDifference('bots-00', 2, log('Aldric'), log('Aldric').slice(0, 2))).toMatchObject({
      before: expect.stringContaining('Aldric') as unknown,
      after: null,
    });
    expect(firstDifference('bots-00', 2, log('Aldric'), log('Aldric'))).toMatchObject({ kind: 'no log line' });
  });

  test("a battle's force line shows its units", () => {
    const force = (q: string) =>
      line(
        '⚑FORCE⚑' +
          JSON.stringify({ name: 'King0', verb: 'storms Oakvale with', armies: [{ quality: q, type: 'Free Lances' }] }),
      );
    expect(firstDifference('bots-00', 1, [force('Veteran')], [force('Green')])).toMatchObject({
      before: '⚔ King0 storms Oakvale with Veteran Free Lances',
      after: '⚔ King0 storms Oakvale with Green Free Lances',
    });
  });

  test(`at most ${String(MAX_REPLAYS)} games are replayed, in matrix order, each to its first differing turn`, () => {
    const head = BASE.map((g, i) => (i < 30 ? alter(g, ['state'], 1 + (i % 5)) : g));
    const picked = gamesToReplay(compareGames(BASE, head), 'rule change');
    expect(picked).toHaveLength(MAX_REPLAYS);
    expect(picked.slice(0, 3)).toEqual([
      { id: 'bots-00', turn: 1 },
      { id: 'bots-01', turn: 2 },
      { id: 'bots-02', turn: 3 },
    ]);
  });

  test("the season names are the data file's", () => {
    const data = fs.readFileSync(path.join(ROOT, 'site', 'kingdoms-call-data.js'), 'utf8');
    const names = /const KC_PHASE_NAMES=(\[[^\]]*\]);/.exec(data)?.[1] ?? '';
    expect(JSON.parse(names.replace(/'/g, '"'))).toEqual(PHASES);
  });
});

describe('the comment', () => {
  test('log lines go in code blocks that a line cannot close', () => {
    const head = BASE.map((g, i) => (i === 0 ? alter(g, ['state']) : g));
    const firstDiffs = [
      firstDifference('bots-00', 1, [{ type: 'move', text: 'a ```b' }], [{ type: 'move', text: 'c' }]),
    ];
    const md = renderReport(buildReport({ base: BASE, head, firstDiffs }));
    expect(md).toContain('  - a ʼʼʼb');
    expect(md.match(/```/g)).toHaveLength(2);
  });

  test('no change: one line and nothing else to read', () => {
    const md = renderReport(buildReport({ base: BASE, head: BASE }));
    expect(md).toContain('**No change: all 60 games played out exactly as before.**');
    expect(md).not.toContain('###');
  });
});

describe('the labels', () => {
  const names = ['matrix.json', 'noise.json'].flatMap(
    (f) =>
      (
        JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'balance', 'baseline', f), 'utf8')) as {
          statNames: string[];
        }
      ).statNames,
  );

  test('every statistic in the committed baselines has one, and no two share one', () => {
    const all = [...new Set(names)];
    expect(all.length).toBeGreaterThan(100);
    expect(all.filter((k) => labelOf(k) == null)).toEqual([]);
    const labels = all.map((k) => labelOf(k));
    expect(new Set(labels).size).toBe(labels.length);
  });

  test('every count per game is a base with a label', () => {
    expect([...PER_GAME].filter((k) => !(k in BASE_LABELS))).toEqual([]);
  });

  test('an unknown statistic or slice has none (the test above then fails)', () => {
    expect(labelOf('battles: attacker won | by moon: full')).toBeUndefined();
    expect(labelOf('dragons: hatched')).toBeUndefined();
  });
});
