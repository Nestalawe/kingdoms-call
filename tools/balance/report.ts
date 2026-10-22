// The balance report (plan P1-03a): what an engine change does to the balance matrix, in game terms, for the pull
// request's comment. It compares the base branch's committed baseline with the branch's games, paired by seed.
//
// First it names the class of change, then it judges the change accordingly (Theo, 2026-10-16):
// - "no change": every game's hashes, results and statistics are identical (a pure refactor);
// - "wording only": every game played out the same (state, log structure, telemetry, results, the scripted realm's
//   report structure), and only words differ;
// - "writes only" (P1-02c): every game played out the same, with the same words, and only what the turns wrote to the
//   database differs (the `writes` column: a filter, the save's `meta`, the order of the writes). Nothing in play
//   changed, so it is judged by which games and turns wrote differently: expected only of a change to how the game
//   saves;
// - a reshape: at least RESHAPE_SHARE of the games played out differently, as when the order of the random draws
//   changes (of the games still being played at the first turn any game differs: a change from turn 18 can't reach a
//   game that ended at 15). Every game differs, so no single game can show what changed: it is judged as a whole, by the strict
//   overall answer (paired.ts's meaningfulChanges), which must say "no meaningful change";
// - a rule change: fewer games played out differently. The others are identical, so the games that changed show what
//   the rule does: it is judged by where they first differ and by every figure and slice beyond the noise, so a change
//   confined to one slice (battles between realms) still shows in the verdict.
// The pure functions are here, tested in tests/unit/balance-report.test.ts; report-run.ts plays the replays and
// writes the files.
import {
  columnsNotKept,
  compareReports,
  describeReportsDiff,
  diffGame,
  reportsIn,
  type KeptGame,
  type ReportsGame,
} from './baseline.ts';
import { WORD_COLUMNS, type TurnColumn } from './hash.ts';
import { label } from './labels.ts';
import { compareRuns, meaningfulChanges, type Change, type Verdict } from './paired.ts';
import type { LogEntry } from './play.ts';
import { isShare, valueOf } from './stats.ts';

/** At least this share of the games played out differently: a reshape, judged as a whole. */
export const RESHAPE_SHARE = 0.9;
/** The most changed games replayed on both sides to find where they first differ. */
export const MAX_REPLAYS = 12;
/** Examples shown before a "show all" section. */
const SHOWN = 3;
const SHOWN_ROWS = 10;

/** The classes of change; the comment's script (tools/github/balance-comment.ts) keeps the same list. */
export const CHANGE_CLASSES = ['no change', 'wording only', 'writes only', 'reshape', 'rule change'] as const;
export type ChangeClass = (typeof CHANGE_CLASSES)[number];

export const show = (key: string, v: number): string => (isShare(key) ? (100 * v).toFixed(1) + '%' : v.toFixed(2));
export const showDiff = (key: string, v: number): string =>
  (v >= 0 ? '+' : '−') + (isShare(key) ? (100 * Math.abs(v)).toFixed(1) : Math.abs(v).toFixed(2));
export const showRange = (key: string, [lo, hi]: [number, number]): string =>
  `${showDiff(key, lo)} to ${showDiff(key, hi)}`;

/** How one game differs between the base and the branch. */
export interface GameChange {
  id: string;
  /** It played out differently: a play hash, the number of turns, the results, the scripted cases. */
  play: boolean;
  /** Some words differ. */
  words: boolean;
  /** What a turn wrote to the database differs (the `writes` column). */
  writes: boolean;
  /** The first turn whose hashes differ (any column), or null. */
  firstTurn: number | null;
  /** Statistics whose value differs. */
  stats: string[];
}

/** Hashes of play: every column but the words and the writes. A change of play or words changes the writes too. */
const PLAY_COLUMN = (c: string) => !WORD_COLUMNS.has(c as TurnColumn) && c !== 'writes';

/** The games that differ in anything, in the branch's order. A game missing on one side counts as played out
 *  differently. */
export function compareGames(base: KeptGame[], head: KeptGame[]): GameChange[] {
  const byId = new Map(base.map((g) => [g.id, g]));
  const out: GameChange[] = [];
  for (const h of head) {
    const b = byId.get(h.id);
    if (!b) {
      out.push({ id: h.id, play: true, words: true, writes: true, firstTurn: 1, stats: Object.keys(h.stats) });
      continue;
    }
    const d = diffGame(b, h);
    if (!d) continue;
    const sections = [...new Set([...Object.keys(b.report ?? {}), ...Object.keys(h.report ?? {})])];
    const part = (g: KeptGame, k: string, i: number) => g.report?.[k]?.[i] ?? '-';
    const play =
      d.columns.some(PLAY_COLUMN) ||
      d.turns != null ||
      d.results ||
      sections.some((k) => part(b, k, 0) !== part(h, k, 0)) ||
      JSON.stringify(b.cases) !== JSON.stringify(h.cases);
    const words =
      d.columns.some((c) => WORD_COLUMNS.has(c as TurnColumn)) || sections.some((k) => part(b, k, 1) !== part(h, k, 1));
    const writes = d.columns.includes('writes');
    out.push({ id: h.id, play, words, writes, firstTurn: d.firstTurn, stats: d.stats });
  }
  const heads = new Set(head.map((g) => g.id));
  for (const b of base) {
    if (!heads.has(b.id))
      out.push({ id: b.id, play: true, words: true, writes: true, firstTurn: 1, stats: Object.keys(b.stats) });
  }
  return out;
}

/** How many games played out differently, of those still being played at the first turn any of them differs (a game
 *  that ended before it can't differ). */
export function playedShare(
  changes: GameChange[],
  base: KeptGame[],
): { played: number; running: number; from: number } {
  const played = changes.filter((c) => c.play);
  if (!played.length) return { played: 0, running: base.length, from: 1 };
  const from = Math.min(...played.map((c) => c.firstTurn ?? 1));
  return { played: played.length, running: base.filter((g) => g.turns.length >= from).length, from };
}

/** The class of change, from how many of the base's games differ and how. */
export function classify(changes: GameChange[], base: KeptGame[]): ChangeClass {
  if (!changes.length) return 'no change';
  const { played, running } = playedShare(changes, base);
  if (!played) return changes.some((c) => c.words) || !changes.some((c) => c.writes) ? 'wording only' : 'writes only';
  return played >= RESHAPE_SHARE * running ? 'reshape' : 'rule change';
}

/** The games to replay to find where they first differ: those that played out differently (or, for wording only,
 *  those whose words differ), MAX_REPLAYS at most, in matrix order. None for writes only: the GM log is the same. */
export function gamesToReplay(changes: GameChange[], cls: ChangeClass): { id: string; turn: number }[] {
  if (cls === 'writes only') return [];
  const picked = changes.filter((c) => (cls === 'wording only' ? c.words : c.play) && c.firstTurn != null);
  return picked.slice(0, MAX_REPLAYS).map((c) => ({ id: c.id, turn: c.firstTurn ?? 1 }));
}

/** What the first differing log line was about, in game terms (the log line's `type`). */
const KINDS: Readonly<Record<string, string>> = {
  combat: 'a battle',
  move: 'a move',
  explore: 'exploring',
  hire: 'hiring, recruiting or training',
  spy: 'spying',
  item: 'an item',
  message: 'a message',
  enemy: "an enemy's move",
  system: 'a roll or a notice',
};

/** A log line's `phase`, in words: the data file's KC_PHASE_NAMES (the test checks they agree). */
export const PHASES = ['Spring', 'Early Summer', 'Late Summer', 'Fall', 'Early Winter', 'End of Turn'];

/** Where one game's two runs part, within the first turn that differs. */
export interface FirstDiff {
  id: string;
  turn: number;
  /** The season the line is in ("Late Summer"), from the log's season lines. */
  season: string | null;
  /** The battle the line is part of ("Battle for Feralpeak"). */
  battle: string | null;
  /** What the line was about, in game terms (KINDS); 'no log line' if the turn's log is the same. */
  kind: string;
  /** The base branch's line and the branch's, in words; null where that run has no line there. */
  before: string | null;
  after: string | null;
  /** The words are the same but something else in the line differs: its fields. */
  detail: string[];
  /** Lines of this turn whose words alone differ. */
  reworded: number;
}

/** A log line's words as a reader sees them: the bold marks dropped, a battle's force line in short. */
export function lineText(e: LogEntry | undefined): string | null {
  if (!e) return null;
  let t = typeof e.text === 'string' ? e.text : JSON.stringify(e.text ?? '');
  if (t.startsWith('⚑FORCE⚑')) {
    try {
      const f = JSON.parse(t.slice('⚑FORCE⚑'.length)) as {
        name?: string;
        verb?: string;
        armies?: { quality?: string; type?: string }[];
      };
      const units = (f.armies ?? []).map((a) => [a.quality, a.type].filter(Boolean).join(' '));
      t = `⚔ ${f.name ?? '?'} ${f.verb ?? ''} ${units.length ? units.join(', ') : 'no armies'}`;
    } catch {
      // shown as written
    }
  }
  t = t.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 240 ? t.slice(0, 239) + '…' : t;
}

const withoutText = (e: LogEntry | undefined) => JSON.stringify({ ...e, text: undefined });

/** Where the base's and the branch's GM logs of `turn` part. */
export function firstDifference(id: string, turn: number, base: LogEntry[], head: LogEntry[]): FirstDiff {
  let i = 0;
  while (i < Math.max(base.length, head.length) && JSON.stringify(base[i]) === JSON.stringify(head[i])) i++;
  let reworded = 0;
  for (let j = 0; j < Math.min(base.length, head.length); j++) {
    if (base[j]?.text !== head[j]?.text && withoutText(base[j]) === withoutText(head[j])) reworded++;
  }
  if (i >= Math.max(base.length, head.length)) {
    return {
      id,
      turn,
      season: null,
      battle: null,
      kind: 'no log line',
      before: null,
      after: null,
      detail: [],
      reworded,
    };
  }
  const log = i < head.length ? head : base;
  const line = log[i];
  const phase = typeof line?.['phase'] === 'number' ? line['phase'] : null;
  // The battle this line is part of: the last battle heading before it in the same season.
  let battle: string | null = null;
  for (let j = 0; j <= i; j++) {
    if (log[j]?.['phase'] !== phase) continue;
    const b = /^⚔ \*\*(Battle for [^*]+)\*\*/.exec(typeof log[j]?.text === 'string' ? String(log[j]?.text) : '');
    if (b) battle = b[1] ?? null;
  }
  const season = phase == null ? null : (PHASES[phase] ?? null);
  const type = typeof line?.type === 'string' ? line.type : '';
  let before = lineText(base[i]);
  let after = lineText(head[i]);
  // Words that differ only in spacing or bold marks look the same once shown: show them as written, in quotes.
  if (before != null && before === after && base[i]?.text !== head[i]?.text) {
    before = JSON.stringify(base[i]?.text);
    after = JSON.stringify(head[i]?.text);
  }
  const detail =
    base[i] && head[i]
      ? [...new Set([...Object.keys(base[i] ?? {}), ...Object.keys(head[i] ?? {})])].filter(
          (k) => k !== 'text' && JSON.stringify(base[i]?.[k]) !== JSON.stringify(head[i]?.[k]),
        )
      : [];
  return {
    id,
    turn,
    season,
    battle: type === 'combat' ? battle : null,
    kind: KINDS[type] ?? (type || 'a log line'),
    before,
    after,
    detail,
    reworded,
  };
}

/** One figure in the report. */
export interface Line {
  key: string;
  label: string;
  base: string;
  head: string;
  diff: string;
  range95: string;
  verdict: Verdict;
  /** The games whose value of it differs. */
  games: number;
  z: number;
}

export interface Report {
  class: ChangeClass;
  /** One line, in game terms: what Toby reads first. */
  verdict: string;
  games: {
    changed: number;
    total: number;
    /** The games still being played at turn `from`, the first turn any game differs. */
    running: number;
    from: number;
    bots: [changed: number, total: number];
    scripted: [number, number];
  };
  firstDiffs: FirstDiff[];
  /** Why some replays aren't shown. */
  replayNotes: string[];
  /** The bot games' figures beyond the noise, biggest first: the headline ones and their slices apart. */
  changes: Line[];
  slices: Line[];
  /** Slices that changed with too few cases to tell. */
  tooFew: string[];
  /** The scripted games' figures beyond the noise. */
  scripted: Line[];
  /** The strict overall answer (paired.ts): the headline figures that moved once the bar is raised for their number. */
  meaningful: Line[];
  /** Statistics that changed though every game played out the same (they read the log's words: stats.ts LINES). */
  statsFromWords: string[];
  /** The branch's games differ from its committed baseline (CI fails until it's updated). */
  baselineStale: boolean;
  /** The games whose writes to the database differ, with the first turn that does (any column). */
  writes: { id: string; firstTurn: number | null }[];
  /** Hash columns the base's baseline doesn't have, so not compared (it's from before they were added). */
  notCompared: TurnColumn[];
  /** Every realm's report (every-realm.ts): the branch's, against the base's committed reports.json. */
  everyRealm: EveryRealm;
}

/** Every realm's report, as the report tells it: not played; played, with no baseline on the base to compare with; or
 *  compared, with the games that differ. */
export type EveryRealm =
  | { played: false }
  | { played: true; reports: number; games: number; compared: false }
  | { played: true; reports: number; games: number; compared: true; differ: { id: string; line: string }[] };

/** The branch's every-realm games (null: not played) against the base's (null: it has none). */
export function compareEveryRealm(base: ReportsGame[] | null, head: ReportsGame[] | null): EveryRealm {
  if (!head) return { played: false };
  const played = { played: true as const, reports: reportsIn(head), games: head.length };
  if (!base?.length) return { ...played, compared: false };
  const differ = compareReports(base, head).map((d) => ({ id: d.id, line: describeReportsDiff(d) }));
  return { ...played, compared: true, differ };
}

const moved = (c: Change) => c.verdict === 'clear change' || c.verdict === 'possible change';
const biggestFirst = (a: Line, b: Line) =>
  a.verdict === b.verdict ? Math.abs(b.z) - Math.abs(a.z) : a.verdict === 'clear change' ? -1 : 1;

function lines(base: KeptGame[], head: KeptGame[], ids: string[]): Change[] {
  const b = new Map(base.map((g) => [g.id, g.stats]));
  const h = new Map(head.map((g) => [g.id, g.stats]));
  return compareRuns(
    ids.map((id) => b.get(id) ?? {}),
    ids.map((id) => h.get(id) ?? {}),
  );
}

function toLine(c: Change, base: KeptGame[], head: KeptGame[], ids: string[]): Line {
  const b = new Map(base.map((g) => [g.id, g.stats]));
  const h = new Map(head.map((g) => [g.id, g.stats]));
  const games = ids.filter(
    (id) => valueOf(b.get(id) ?? {}, c.key).join() !== valueOf(h.get(id) ?? {}, c.key).join(),
  ).length;
  return {
    key: c.key,
    label: label(c.key),
    base: show(c.key, c.base),
    head: show(c.key, c.head),
    diff: showDiff(c.key, c.diff),
    range95: showRange(c.key, c.range95),
    verdict: c.verdict,
    games,
    z: c.z,
  };
}

const figure = (l: Line) => `${l.label}: ${l.base} → ${l.head} (${l.verdict})`;

export function buildReport(input: {
  base: KeptGame[];
  head: KeptGame[];
  firstDiffs?: FirstDiff[];
  replayNotes?: string[];
  baselineStale?: boolean;
  everyRealm?: EveryRealm;
}): Report {
  const { base, head } = input;
  const changes = compareGames(base, head);
  const cls = classify(changes, base);
  const share = playedShare(changes, base);
  const ids = (group: string) => head.filter((g) => g.id.startsWith(group)).map((g) => g.id);
  const bots = ids('bots');
  const scriptedIds = ids('scripted');
  const playedIn = (list: string[]) => changes.filter((c) => c.play && list.includes(c.id)).length;
  const played = changes.filter((c) => c.play).length;

  const botChanges = lines(base, head, bots);
  const all = botChanges.filter(moved).map((c) => toLine(c, base, head, bots));
  const isSlice = (l: Line) => l.key.includes(' | ');
  const meaningful = meaningfulChanges(botChanges).map((c) => toLine(c, base, head, bots));
  const tooFew = botChanges
    .filter((c) => c.verdict === 'too few to tell' && c.key.includes(' | ') && c.diff !== 0)
    .map((c) => label(c.key));
  const scripted = lines(base, head, scriptedIds)
    .filter(moved)
    .map((c) => toLine(c, base, head, scriptedIds))
    .sort(biggestFirst);
  const statsFromWords = cls === 'wording only' ? [...new Set(changes.flatMap((c) => c.stats))].map(label) : [];

  const total = head.length;
  let verdict: string;
  switch (cls) {
    case 'no change':
      verdict = `No change: all ${String(total)} games played out exactly as before.`;
      break;
    case 'wording only':
      verdict = `Wording only: the words changed in ${String(changes.length)} of ${String(total)} games, and every game played out exactly as before.`;
      break;
    case 'writes only':
      verdict = `Nothing in play changed, but what the game writes to the database did, in ${String(changes.length)} of ${String(total)} games. Every game played out exactly as before, in the same words.`;
      break;
    case 'reshape':
      verdict =
        (share.running === total && share.from === 1
          ? `Every game played out differently (${String(played)} of ${String(total)}), as when the order of the dice changes, `
          : `${String(played)} of the ${String(share.running)} games still being played at turn ${String(share.from)} played out differently from then on, as when the order of the dice changes, `) +
        'so the games are judged as a whole: ' +
        (meaningful.length ? `a meaningful change in ${meaningful.map(figure).join('; ')}.` : 'no meaningful change.');
      break;
    case 'rule change': {
      const top = [...all].sort(biggestFirst).slice(0, SHOWN);
      verdict =
        `Play changed in ${String(played)} of ${String(total)} games. ` +
        (top.length
          ? `Beyond the noise: ${top.map(figure).join('; ')}${all.length > SHOWN ? `; and ${String(all.length - SHOWN)} more` : ''}.`
          : 'No figure moved beyond the noise.');
      break;
    }
  }

  return {
    class: cls,
    verdict,
    games: {
      changed: cls === 'wording only' ? changes.length : played,
      total,
      running: share.running,
      from: share.from,
      bots: [playedIn(bots), bots.length],
      scripted: [playedIn(scriptedIds), scriptedIds.length],
    },
    firstDiffs: input.firstDiffs ?? [],
    replayNotes: input.replayNotes ?? [],
    changes: all.filter((l) => !isSlice(l)).sort(biggestFirst),
    slices: all.filter(isSlice).sort(biggestFirst),
    tooFew,
    scripted,
    meaningful,
    statsFromWords,
    baselineStale: input.baselineStale ?? false,
    writes: changes.filter((c) => c.writes).map((c) => ({ id: c.id, firstTurn: c.firstTurn })),
    notCompared: columnsNotKept(base),
    everyRealm: input.everyRealm ?? { played: false },
  };
}

/** A hash column in words, for a reader who doesn't know the matrix. */
const COLUMN_WORDS: Readonly<Partial<Record<TurnColumn, string>>> = {
  writes: 'what each turn writes to the database',
};

// Markdown. Log lines go in code blocks, so nothing in them is read as markup, a link or a mention.
const code = (t: string) => t.replace(/```/g, 'ʼʼʼ');

function where(d: FirstDiff): string {
  const at = [`turn ${String(d.turn)}`, d.season, d.battle].filter(Boolean).join(', ');
  return `**${d.id}**, ${at}: ${d.kind}`;
}

function diffBlock(d: FirstDiff): string[] {
  if (d.kind === 'no log line') return ["  The turn's log is the same: the first difference is in the saved game."];
  const out = ['  ```diff'];
  out.push(
    d.before == null ? '  - (no line here: the game had ended or the log was shorter)' : `  - ${code(d.before)}`,
  );
  out.push(d.after == null ? '  + (no line here: the game had ended or the log was shorter)' : `  + ${code(d.after)}`);
  out.push('  ```');
  if (d.detail.length) out.push(`  The line also differs in: ${d.detail.join(', ')}.`);
  return out;
}

function table(rows: Line[]): string[] {
  return [
    '| Figure | Before | After | Change (95% range) | How sure | Games it changed in |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (l) => `| ${l.label} | ${l.base} | ${l.head} | ${l.diff} (${l.range95}) | ${l.verdict} | ${String(l.games)} |`,
    ),
  ];
}

function capped(rows: Line[], what: string): string[] {
  if (rows.length <= SHOWN_ROWS) return table(rows);
  return [
    ...table(rows.slice(0, SHOWN_ROWS)),
    '',
    `<details><summary>Show all ${String(rows.length)} ${what}</summary>`,
    '',
    ...table(rows.slice(SHOWN_ROWS)),
    '',
    '</details>',
  ];
}

/** The games whose writes changed, and from which turn: the first few, then a "show all". */
function writesList(games: Report['writes']): string[] {
  const item = (g: Report['writes'][number]) =>
    `- **${g.id}**${g.firstTurn != null ? `, from turn ${String(g.firstTurn)}` : ''}`;
  const out = games.slice(0, SHOWN).map(item);
  if (games.length > SHOWN) {
    out.push('', `<details><summary>Show all ${String(games.length)}</summary>`, '', ...games.slice(SHOWN).map(item));
    out.push('', '</details>');
  }
  return out;
}

const count = (n: number) => n.toLocaleString('en-GB');

/** Every realm's report in one line, and the games that differ. */
function everyRealmLines(e: EveryRealm): string[] {
  if (!e.played) return ["**Every realm's report:** not played in this run.", ''];
  const reports = `${count(e.reports)} reports in ${String(e.games)} games`;
  if (!e.compared)
    return [
      `**Every realm's report:** ${reports}; the base branch has no baseline of them yet, so they weren't compared.`,
      '',
    ];
  if (!e.differ.length) return [`**Every realm's report:** identical (${reports}).`, ''];
  const item = (d: { id: string; line: string }) => `- **${d.id}**: ${d.line}`;
  const out = [
    `**Every realm's report:** differs in ${String(e.differ.length)} of ${String(e.games)} games (${reports}):`,
    '',
    ...e.differ.slice(0, SHOWN).map(item),
  ];
  if (e.differ.length > SHOWN)
    out.push(
      '',
      `<details><summary>Show all ${String(e.differ.length)}</summary>`,
      '',
      ...e.differ.slice(SHOWN).map(item),
      '',
      '</details>',
    );
  out.push('');
  return out;
}

/** The comment's text (without its marker: the posting workflow adds that). */
export function renderReport(r: Report): string {
  const out = ['## Balance report', '', `**${r.verdict}**`, '', ...everyRealmLines(r.everyRealm)];
  if (r.baselineStale) {
    out.push(
      "⚠️ These games differ from this pull request's committed baseline, so CI's balance job fails: if the change " +
        'is meant, run `npm run balance:update` and commit the baseline.',
      '',
    );
  }
  if (r.notCompared.length) {
    out.push(
      `The base branch's baseline doesn't record ${r.notCompared.map((c) => COLUMN_WORDS[c] ?? c).join(' or ')} yet, ` +
        'so that was not compared. It is compared from the next pull request on.',
      '',
    );
  }
  if (r.class === 'no change') {
    out.push('Every game of the balance matrix (60 seeded games) is identical: hashes, results and figures.');
    return out.join('\n') + '\n';
  }
  if (r.class === 'writes only') {
    out.push(
      '### What the game writes to the database',
      '',
      'Every game played out the same, so players see no difference. But in these games, at least one turn saved ' +
        'its results to the database differently: a different filter, a field added or left out, or the writes in ' +
        'another order. That is expected only of a change to how the game saves. If this pull request is not meant ' +
        'to change that, it is a mistake.',
      '',
      ...writesList(r.writes),
    );
    return out.join('\n') + '\n';
  }
  const [bc, bt] = r.games.bots;
  const [sc, st] = r.games.scripted;
  out.push(
    r.class === 'wording only'
      ? `${String(r.games.changed)} of ${String(r.games.total)} games have different words; none played out differently.`
      : `${String(r.games.changed)} of ${String(r.games.total)} games played out differently: ${String(bc)} of the ${String(bt)} computer-played games and ${String(sc)} of the ${String(st)} with a scripted realm.`,
    '',
  );
  const writesBeyondWords = r.class === 'wording only' ? r.writes.length : 0;
  if (writesBeyondWords) {
    out.push(
      `⚠️ In ${String(writesBeyondWords)} game${writesBeyondWords === 1 ? '' : 's'}, what the game writes to the ` +
        'database changed beyond the words: expected only of a change to how the game saves.',
      '',
      ...writesList(r.writes),
      '',
    );
  }
  if (r.statsFromWords.length) {
    out.push(
      `⚠️ Some figures changed though no game played out differently: ${r.statsFromWords.join('; ')}. They read the ` +
        "log's words (tools/balance/stats.ts, LINES): update the pattern there with the wording.",
      '',
    );
  }

  out.push(
    r.class === 'wording only' ? '### Words that changed' : '### Where the games first played out differently',
    '',
  );
  if (r.firstDiffs.length) {
    const groups = new Map<string, number>();
    for (const d of r.firstDiffs) groups.set(d.kind, (groups.get(d.kind) ?? 0) + 1);
    const n = r.firstDiffs.length;
    out.push(
      `Of the ${String(n)} game${n === 1 ? '' : 's'} replayed on both sides, the first difference was in ` +
        [...groups]
          .sort((a, b) => b[1] - a[1])
          .map(([k, c]) => `${k} (${String(c)})`)
          .join(', ') +
        '.' +
        (r.class === 'wording only'
          ? ` In those turns, ${String(r.firstDiffs.reduce((t, d) => t + d.reworded, 0))} log lines were reworded.`
          : ''),
      '',
    );
    const example = (d: FirstDiff) => [`- ${where(d)}`, ...diffBlock(d)];
    out.push(...r.firstDiffs.slice(0, SHOWN).flatMap(example));
    if (n > SHOWN) {
      out.push('', `<details><summary>Show all ${String(n)}</summary>`, '');
      out.push(...r.firstDiffs.slice(SHOWN).flatMap(example));
      out.push('', '</details>');
    }
  } else {
    out.push('No game was replayed.');
  }
  if (r.replayNotes.length) out.push('', ...r.replayNotes.map((n) => `- ${n}`));
  out.push('');

  if (r.class !== 'wording only') {
    if (r.class === 'reshape') {
      out.push(
        '### The figures, judged as a whole',
        '',
        r.meaningful.length
          ? 'These moved more than chance would, even with the bar raised for the number of figures compared:'
          : 'No headline figure moved more than chance would, with the bar raised for the number of figures compared.',
        '',
      );
      if (r.meaningful.length) out.push(...table(r.meaningful), '');
      if (r.changes.length + r.slices.length) {
        out.push(
          `<details><summary>${String(r.changes.length + r.slices.length)} figures beyond the noise at the usual bar (with this many, a few are expected by chance)</summary>`,
          '',
          ...table([...r.changes, ...r.slices]),
          '',
          '</details>',
          '',
        );
      }
    } else {
      out.push('### The changes, biggest first', '');
      out.push(...(r.changes.length ? capped(r.changes, 'figures') : ['No headline figure moved beyond the noise.']));
      out.push('', '### The slices that moved', '');
      out.push(...(r.slices.length ? capped(r.slices, 'slices') : ['No slice moved beyond the noise.']));
      if (r.tooFew.length) {
        out.push(
          '',
          `Too few to tell (try a scenario): ${r.tooFew.slice(0, SHOWN_ROWS).join('; ')}${r.tooFew.length > SHOWN_ROWS ? `; and ${String(r.tooFew.length - SHOWN_ROWS)} more` : ''}.`,
        );
      }
      out.push('');
    }
    out.push('### The games with a scripted realm', '');
    out.push(
      ...(r.scripted.length
        ? capped(r.scripted, 'figures')
        : [
            "No figure of the 12 games with a scripted realm moved beyond the noise (they're few: see the slices above).",
          ]),
      '',
    );
  }

  out.push(
    '<details><summary>How to read this</summary>',
    '',
    "- Each game is played twice on the same seed: once on the base branch, once on this pull request's. A rule " +
      'change leaves most games identical, so the ones that changed show what it does.',
    '- **Clear change:** chance alone would move the figure this far less than 1 time in 100. **Possible change:** ' +
      'less than 5 times in 100. **Within the noise:** more often than that. **Too few to tell:** too few cases.',
    `- When at least ${String(100 * RESHAPE_SHARE)}% of the games still being played when the first one changed play out differently (a reshape, such as a change in ` +
      'the order of the dice), every figure moves a little by chance, so only the headline figures are judged, with ' +
      'the bar raised for their number.',
    "- The figures come from the computer-played games; the scripted realm's games are shown apart.",
    '- Each turn, the matrix also checks what the game writes to the database. That can change while nothing in ' +
      'play does (**writes only**): expected only when a change is about how the game saves.',
    '',
    '</details>',
  );
  return out.join('\n') + '\n';
}
