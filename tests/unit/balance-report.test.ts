// The balance report (tools/balance/report.ts, labels.ts; P1-03a): the class of change, where two runs first differ,
// the verdict, and every statistic's plain-words label; the class for a change in the database writes alone (P1-02c);
// the line on every realm's report (P1-12a1); the published report's counts of GM-log lines, and its headline telling
// play from the log's fields. Made-up games with a known answer. Level 1 (unit): pure
// functions on small data; playing real games (the matrix, in CI) can't stage a reshape or a slice-only change on
// demand.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The balance report (P1-03a) on made-up games: the class of change (identical: no change; words only: wording only;
// the database writes alone: writes only, never a reshape, while the writes beside play or words are classed as before,
// and a base baseline without the column is compared on the rest (P1-02c); any play hash, length, results, scripted
// case or report section: a change to play; 54 of 60 changed: a reshape, 53: a rule change; counted over the games
// still being played at the first turn any differs, so 50 of the 52 still played at turn 18 is a reshape); the same
// slice-only change judged both ways (a rule change names the slice in its verdict; a reshape is "no meaningful
// change"; a reshape that moves a headline figure is a meaningful change); where two logs first differ (a flipped
// battle with its season and battle, spacing shown in quotes, another field named, a missing line, a force line's
// units); at most 12 replays; the season names are the data file's; in the report with the lines, log lines can't
// close their code block; the published report (the comment, CI's files, summary and log) gives each replayed game's
// turn and counts of its lines (each side's, those whose words differ, those whose fields alone do), and holds no
// line's words, field names, kind, season or battle, while the report with the lines, written only outside CI, quotes
// them; a game whose saved state is the same at every turn, while its GM log, telemetry or report differs, is not play
// in the headline ("Nothing in play changed", or counted apart beside games whose state changed, and never taken for a
// reshape), while the state, the length, the results or the scripted cases are; every
// statistic in the baselines has its own label; the comment's script knows every class; every realm's report in one
// line under the verdict (identical, with its count; where it differs, game by game; not compared when the base has no
// baseline of it; not played) (P1-12a1). TypeScript, in `unit/`
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, test } from 'vitest';
import { formatBaseline, parseBaseline, type KeptGame, type ReportsGame } from '../../tools/balance/baseline.ts';
import { TURN_COLUMNS, type TurnColumn } from '../../tools/balance/hash.ts';
import { BASE_LABELS, labelOf } from '../../tools/balance/labels.ts';
import type { LogEntry } from '../../tools/balance/play.ts';
import { CLASSES } from '../../tools/github/balance-comment.ts';
import {
  buildReport,
  CHANGE_CLASSES,
  classify,
  compareEveryRealm,
  compareGames,
  firstDifference,
  gamesToReplay,
  MAX_REPLAYS,
  PHASES,
  renderReport,
  RESHAPE_SHARE,
  theReportsOutputs,
} from '../../tools/balance/report.ts';
import { PER_GAME, type Stats } from '../../tools/balance/stats.ts';
import { sourceOf } from '../lib/source.ts';

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
    expect(classify([], BASE)).toBe('no change');
    expect(buildReport({ base: BASE, head: structuredClone(BASE) }).verdict).toBe(
      'No change: all 60 games played out exactly as before.',
    );
  });

  test('only the words differ (the state prose, the log text, the report text): wording only', () => {
    const head = BASE.map((g) => alter(g, ['prose', 'logText', 'reportText']));
    const changes = compareGames(BASE, head);
    expect(changes).toHaveLength(60);
    expect(changes.every((c) => c.words && !c.play)).toBe(true);
    expect(classify(changes, BASE)).toBe('wording only');
  });

  test('any play hash, the length, the results, the scripted cases or a report section played: a change to play', () => {
    const one = (head: KeptGame) => compareGames([game('bots-00')], [head])[0];
    for (const c of ['state', 'log', 'telemetry', 'report'] as const) {
      expect(one(alter(game('bots-00'), [c], 3)), c).toMatchObject({ play: true, firstTurn: 3 });
    }
    expect(one({ ...game('bots-00'), turns: game('bots-00').turns.slice(0, 4) })).toMatchObject({ play: true });
    expect(one({ ...game('bots-00'), results: 'other' })).toMatchObject({ play: true });
    const scripted = { ...game('bots-00'), cases: { encounter: 1, battleChase: 0 } };
    const withReport = { ...scripted, report: { lastTurnLog: ['p', 'w'] as [string, string] } };
    expect(compareGames([withReport], [{ ...withReport, cases: { encounter: 2, battleChase: 0 } }])[0]).toMatchObject({
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
    expect(classify(compareGames(BASE, changed(54)), BASE)).toBe('reshape');
    expect(classify(compareGames(BASE, changed(53)), BASE)).toBe('rule change');
    expect(classify(compareGames(BASE, changed(1)), BASE)).toBe('rule change');
    // Words changing in the other games don't make it a reshape.
    const head = changed(10).map((g, i) => (i >= 10 ? alter(g, ['logText']) : g));
    expect(classify(compareGames(BASE, head), BASE)).toBe('rule change');
  });

  // A reshape from a late turn (one more dice roll from turn 18) can't change a game that ended before it: the share
  // counts the games still being played at the first turn any game differs.
  test('the share counts the games still being played when the first difference appeared', () => {
    const long = (g: KeptGame, i: number): KeptGame =>
      i < 8 ? g : { ...g, turns: Array.from({ length: 20 }, (_, t) => `t${String(t)} ${'x '.repeat(6)}`.trim()) };
    const base = BASE.map(long);
    // 8 games of 5 turns ended long before; 50 of the other 52 change from turn 18.
    const late = base.map((g, i) => (i >= 10 ? alter(g, ['state'], 18) : g));
    expect(classify(compareGames(base, late), base)).toBe('reshape');
    const r = buildReport({ base, head: late });
    expect(r.games).toMatchObject({ changed: 50, total: 60, running: 52, from: 18 });
    expect(r.verdict).toMatch(
      /^50 of the 52 games still being played at turn 18 played out differently from then on, as when the order of the dice changes,/,
    );
    // The same 50 games changing from turn 4, when all 60 were being played: a rule change.
    const early = base.map((g, i) => (i >= 10 ? alter(g, ['state'], 4) : g));
    expect(classify(compareGames(base, early), base)).toBe('rule change');
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
    expect(r.games).toMatchObject({ changed: 10, total: 60, running: 60, from: 3, bots: [10, 48], scripted: [0, 12] });
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
      lines: { before: 3, after: 3, words: 1, fields: 0 },
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
    // the value the data file declares, read from src/ by its syntax tree (tests/lib/source.ts; until plan P1-09a it was
    // matched in site/'s copy of the file)
    const names: unknown = vm.runInNewContext(
      sourceOf('content/kingdoms-call-data.ts', ['KC_PHASE_NAMES']) + ';KC_PHASE_NAMES',
    );
    expect(JSON.parse(JSON.stringify(names))).toEqual(PHASES);
  });
});

describe('the comment', () => {
  test('in the report with the lines, log lines go in code blocks that a line cannot close', () => {
    const head = BASE.map((g, i) => (i === 0 ? alter(g, ['state']) : g));
    const firstDiffs = [
      firstDifference('bots-00', 1, [{ type: 'move', text: 'a ```b' }], [{ type: 'move', text: 'c' }]),
    ];
    const md = renderReport(buildReport({ base: BASE, head, firstDiffs }), 'with the lines');
    expect(md).toContain('  - a ʼʼʼb');
    expect(md.match(/```/g)).toHaveLength(2);
  });

  test('no change: one line and nothing else to read', () => {
    const md = renderReport(buildReport({ base: BASE, head: BASE }));
    expect(md).toContain('**No change: all 60 games played out exactly as before.**');
    expect(md).not.toContain('###');
  });
});

// The comment, the job's summary, its log and the uploaded report give each replayed game's GM-log lines as counts. The
// lines themselves are only in the report written for whoever runs npm run balance:report outside CI.
describe("the comment counts each replayed game's GM-log lines", () => {
  const line = (text: string, extra: Partial<LogEntry> = {}): LogEntry => ({
    type: 'combat',
    text,
    phase: 1,
    ...extra,
  });
  const battle = (outcome: string) => [
    line('— Early Summer —', { type: 'system' }),
    line('⚔ **Battle for Oakvale**'),
    line(`📊 Outcome: **${outcome}** wins`),
  ];
  const head = BASE.map((g, i) => (i < 3 ? alter(g, ['state', 'log']) : g));
  const firstDiffs = [
    firstDifference('bots-00', 7, battle('Aldric'), battle('Brenna')),
    firstDifference(
      'bots-01',
      3,
      [line('Moves north.', { type: 'move', charId: 4 }), line('Rests.')],
      [line('Moves north.', { type: 'move', charId: 9 }), line('Rests.'), line('Sings.')],
    ),
    firstDifference('bots-02', 2, battle('Aldric'), battle('Aldric')),
  ];
  const report = buildReport({ base: BASE, head, firstDiffs });
  const QUOTED = ['Aldric', 'Brenna', 'Oakvale', 'Moves north', 'Rests', 'Sings', 'Early Summer', 'charId', 'a battle'];

  test("the comment holds no line's words, nor its fields' names, its kind, its season or its battle", () => {
    const md = renderReport(report);
    for (const quoted of QUOTED) expect(md, quoted).not.toContain(quoted);
    expect(md).not.toContain('```');
  });

  test('per game, its turn and counts: how many lines each side has, and how many differ in their words or fields', () => {
    expect(firstDiffs.map((d) => d.lines)).toEqual([
      { before: 3, after: 3, words: 1, fields: 0 },
      { before: 2, after: 3, words: 0, fields: 1 },
      { before: 3, after: 3, words: 0, fields: 0 },
    ]);
    const md = renderReport(report);
    expect(md).toContain(
      '| Game | Turn | GM-log lines, before → after | Lines whose words differ | Lines that differ only in their fields |\n' +
        '|---|---|---|---|---|\n' +
        '| bots-00 | 7 | 3 → 3 | 1 | 0 |\n' +
        '| bots-01 | 3 | 2 → 3 | 0 | 1 |\n' +
        '| bots-02 | 2 | 3 → 3 | 0 | 0 |',
    );
    for (const quoted of QUOTED) expect(md, quoted).not.toContain(quoted);
    expect(md).not.toContain('```');
  });

  test('the report with the lines still quotes them, for whoever runs it', () => {
    const md = renderReport(report, 'with the lines');
    for (const quoted of ['Brenna', 'Moves north', 'charId', 'a battle']) expect(md, quoted).toContain(quoted);
  });

  test("on CI, the files it uploads, the job's summary and its log hold the counts; the lines are written only outside CI", () => {
    const onCi = theReportsOutputs(report, { onCi: true });
    expect(onCi.withTheLines).toBeNull();
    for (const text of [onCi.published, onCi.log]) {
      expect(text).toContain('| bots-01 | 3 | 2 → 3 | 0 | 1 |');
      for (const quoted of QUOTED) expect(text, quoted).not.toContain(quoted);
    }
    const local = theReportsOutputs(report, { onCi: false });
    expect(local.published).toBe(onCi.published);
    expect(local.withTheLines).toContain('Brenna');
    expect(local.log).toContain('Brenna');
  });
});

// A game whose saved state is the same at every turn, while its GM log's lines differ in their fields (the hero a line
// is filed under, say): nothing in play changed, and the headline says so.
describe("the headline tells a change to play from a change to the GM log's fields alone", () => {
  test('only the GM log differs, beside the writes: its fields changed, not play', () => {
    const head = BASE.map((g, i) => (i < 26 ? alter(g, ['log', 'writes'], 2) : g));
    const changes = compareGames(BASE, head);
    expect(changes[0]).toMatchObject({ play: true, state: false, besideTheState: ['log'] });
    const r = buildReport({ base: BASE, head });
    expect(r.games).toMatchObject({ changed: 26, stateChanged: 0 });
    expect(r.verdict).toBe(
      "Nothing in play changed: every game's saved state is the same as before, turn by turn. Only the GM log's " +
        'fields changed, in 26 of 60 games. No figure moved beyond the noise.',
    );
    expect(renderReport(r)).toContain(
      "26 of 60 games differ beyond their words, but in none of them did the saved state: only the GM log's fields changed.",
    );
  });

  test('a change to play beside it: each counted apart', () => {
    const head = BASE.map((g, i) => (i < 10 ? alter(g, ['state', 'log']) : i < 26 ? alter(g, ['log']) : g));
    expect(compareGames(BASE, head)[0]).toMatchObject({ play: true, state: true });
    const r = buildReport({ base: BASE, head });
    expect(r.games).toMatchObject({ changed: 26, stateChanged: 10 });
    expect(r.verdict).toBe(
      "Play changed in 10 of 60 games; in 16 more, only the GM log's fields changed. No figure moved beyond the noise.",
    );
    expect(renderReport(r)).toContain(
      '26 of 60 games differ beyond their words (26 of the 48 computer-played games and 0 of the 12 with a scripted ' +
        "realm): in 10, play changed; in 16, only the GM log's fields changed, not the saved state.",
    );
  });

  test('every game, the telemetry and the report too: still not play, and not taken for a change in the dice', () => {
    const head = BASE.map((g) => alter(g, ['log', 'telemetry', 'report']));
    const r = buildReport({ base: BASE, head });
    expect(r.verdict).toBe(
      "Nothing in play changed: every game's saved state is the same as before, turn by turn. Only the GM log's " +
        "fields, the telemetry and the scripted realm's report changed, in 60 of 60 games. Judged as a whole: no " +
        'meaningful change.',
    );
  });

  test('the saved state, the length, the results or the scripted cases: play', () => {
    const one = (h: KeptGame, b: KeptGame = game('bots-00')) => compareGames([b], [h])[0];
    expect(one(alter(game('bots-00'), ['state']))).toMatchObject({ state: true });
    expect(one({ ...game('bots-00'), turns: game('bots-00').turns.slice(0, 4) })).toMatchObject({ state: true });
    expect(one({ ...game('bots-00'), results: 'other' })).toMatchObject({ state: true });
    const scripted = { ...game('bots-00'), cases: { encounter: 1, battleChase: 0 } };
    expect(one({ ...scripted, cases: { encounter: 2, battleChase: 0 } }, scripted)).toMatchObject({ state: true });
    expect(compareGames(BASE, BASE.slice(1))).toMatchObject([{ id: 'bots-00', state: true }]);
  });
});

// P1-12a1: every realm's report, the branch's run against the base's committed reports.json, in one line under the
// verdict (P1-12's Decision 1).
describe("every realm's report", () => {
  const reports = (id: string, turns = ['0:a/b 1:c/d 2:e/f', '0:g/h 1:i/j 2:k/l']): ReportsGame => ({
    id,
    turns,
    sections: { lastTurnLog: ['l', 'w'] },
  });
  const games = IDS.map((id) => reports(id));
  const line = (head: ReportsGame[] | null, base: ReportsGame[] | null = games) =>
    renderReport(buildReport({ base: BASE, head: BASE, everyRealm: compareEveryRealm(base, head) }))
      .split('\n')
      .filter((l) => l.startsWith("**Every realm's report:**") || l.startsWith('- **'))
      .join('\n');

  test('identical: one line, with the number of reports', () => {
    expect(line(structuredClone(games))).toBe("**Every realm's report:** identical (360 reports in 60 games).");
  });

  test('where it differs: the games, each with its first turn, realms and sections', () => {
    const head = games.map((g, i) =>
      i === 4 || i === 50
        ? {
            ...reports(g.id, ['0:a/b 1:c/d 2:e/f', '0:g/h 1:i/j 2:k/X']),
            sections: { lastTurnLog: ['l', 'W'] as [string, string] },
          }
        : g,
    );
    expect(line(head)).toBe(
      "**Every realm's report:** differs in 2 of 60 games (360 reports in 60 games):\n" +
        '- **bots-04**: from turn 2; realm 2; report sections: lastTurnLog (words)\n' +
        '- **scripted-02**: from turn 2; realm 2; report sections: lastTurnLog (words)',
    );
  });

  test('a base with no baseline of them, and a run that did not play them', () => {
    expect(line(games, null)).toBe(
      "**Every realm's report:** 360 reports in 60 games; the base branch has no baseline of them yet, so they weren't compared.",
    );
    expect(line(null)).toBe("**Every realm's report:** not played in this run.");
  });
});

// P1-02c: the `writes` column. A change of play or words changes the writes too; only a change in the writes alone is
// "writes only". P1-17 moves these writes: its pull requests must come out "no change".
describe('the database writes', () => {
  test('only the writes differ: writes only, judged by which games and turns, with nothing replayed', () => {
    const head = BASE.map((g, i) => (i === 3 || i === 50 ? alter(g, ['writes'], 4) : g));
    const changes = compareGames(BASE, head);
    expect(changes).toEqual([
      expect.objectContaining({ id: 'bots-03', play: false, words: false, writes: true, firstTurn: 4 }),
      expect.objectContaining({ id: 'scripted-02', play: false, words: false, writes: true, firstTurn: 4 }),
    ]);
    expect(classify(changes, BASE)).toBe('writes only');
    expect(gamesToReplay(changes, 'writes only')).toEqual([]);
    const r = buildReport({ base: BASE, head });
    expect(r.verdict).toBe(
      'Nothing in play changed, but what the game writes to the database did, in 2 of 60 games. Every game played out exactly as before, in the same words.',
    );
    const md = renderReport(r);
    expect(md).toContain('### What the game writes to the database');
    expect(md).toContain('- **bots-03**, from turn 4\n- **scripted-02**, from turn 4');
    expect(md).not.toContain('### The changes');
  });

  test('the writes changing every game is still writes only, not a reshape', () => {
    expect(
      classify(
        compareGames(
          BASE,
          BASE.map((g) => alter(g, ['writes'])),
        ),
        BASE,
      ),
    ).toBe('writes only');
  });

  test('play or words changed with the writes: classed as before', () => {
    const rule = BASE.map((g, i) => (i < 5 ? alter(g, ['state', 'writes']) : g));
    expect(classify(compareGames(BASE, rule), BASE)).toBe('rule change');
    const reshape = BASE.map((g) => alter(g, ['state', 'log', 'writes']));
    expect(classify(compareGames(BASE, reshape), BASE)).toBe('reshape');
    expect(
      classify(
        compareGames(
          BASE,
          BASE.map((g) => alter(g, ['logText'])),
        ),
        BASE,
      ),
    ).toBe('wording only');
  });

  // The writes hash leaves the words out (hash.ts's playJson), so a rewording alone leaves it as it was.
  test('wording only with the writes changed too: the report says so', () => {
    const head = BASE.map((g, i) => alter(g, i === 7 ? ['logText', 'writes'] : ['logText']));
    const r = buildReport({ base: BASE, head });
    expect(r.class).toBe('wording only');
    expect(renderReport(r)).toContain(
      '⚠️ In 1 game, what the game writes to the database changed beyond the words: expected only of a change to how the game saves.\n\n- **bots-07**, from turn 1',
    );
    expect(renderReport(buildReport({ base: BASE, head: BASE.map((g) => alter(g, ['logText'])) }))).not.toContain('⚠️');
  });

  // The pull request that adds the column (P1-02c) compares with a base whose baseline doesn't have it.
  test("a base baseline without the writes column: the rest is compared, and the report says the writes weren't", () => {
    const old = parseBaseline(
      formatBaseline('A', BASE)
        .replace(/,\s*"writes"\s*\]/, ']')
        .replace(/ writes\d"/g, '"'),
    ).games;
    expect(old[0]?.turns[0]?.split(' ').at(-1)).toBe('?');
    expect(compareGames(old, BASE)).toEqual([]);
    const r = buildReport({ base: old, head: BASE });
    expect(r).toMatchObject({ class: 'no change', notCompared: ['writes'] });
    const md = renderReport(r);
    expect(md).toContain('**No change: all 60 games played out exactly as before.**');
    expect(md).toContain(
      "The base branch's baseline doesn't record what each turn writes to the database yet, so that was not compared.",
    );
    expect(renderReport(buildReport({ base: BASE, head: BASE }))).not.toContain("doesn't record");
    // A change of play still shows.
    expect(buildReport({ base: old, head: BASE.map((g, i) => (i ? g : alter(g, ['state']))) }).class).toBe(
      'rule change',
    );
  });

  test("the comment's script knows every class (it runs from main, apart from this code)", () => {
    expect([...CLASSES]).toEqual([...CHANGE_CLASSES]);
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
