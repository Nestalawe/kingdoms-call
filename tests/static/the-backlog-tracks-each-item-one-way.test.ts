// The backlog tracks each item one way: one row format, one row an item, three statuses (docs/backlog/README.md,
// "How to read a row").
// Without it a second way of tracking grows back unseen: before this check, the backlog's tables had two headers (eight
// columns and nine), five statuses where three are used, and three steps (P1-16, P1-17, P1-23) had a row of their own
// beside their lettered rows, whose What said only that its rows follow (at a8287b37).
// Level 0 (static): it reads files and nothing runs.
// - The tables are every run of lines starting "|" in each file of docs/backlog/ but the finished lists. Each has the
//   same header, THE_HEADER.
// - An open row's Status is one of ⬜, 🟦 and ⏸.
// - No id is an open row twice, or an open row and in a finished list ("- P1-13a: …", or dropped: "B-02, on 2026-…").
// - No open row is a parent beside its own open rows (P1-16 beside P1-16q), and no row's What says only that its rows
//   follow: such a step is a group, a heading, not a row.
// Not checked: that a row's status is the right one (the backlog's statuses test checks it against its PR column).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BACKLOG = 'docs/backlog';

const THE_HEADER = '| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |';
const THE_STATUSES = ['⬜', '🟦', '⏸'];

interface Row {
  file: string;
  line: number;
  id: string;
  what: string;
  status: string;
}

/** A row's cells, split at each "|" that isn't escaped ("\|" inside a cell). */
const cellsOf = (line: string): string[] => line.split(/(?<!\\)\|/).map((c) => c.trim());

/** Each table's header that isn't THE_HEADER, and every row under a header, in one file's text. */
function theTablesIn(file: string, text: string): { wrongHeaders: string[]; rows: Row[] } {
  const wrongHeaders: string[] = [];
  const rows: Row[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!(lines[i] ?? '').startsWith('|') || (lines[i - 1] ?? '').startsWith('|')) continue;
    if ((lines[i] ?? '').trimEnd() !== THE_HEADER) wrongHeaders.push(`${file}:${String(i + 1)}`);
    for (let j = i + 2; j < lines.length && (lines[j] ?? '').startsWith('|'); j++) {
      const cells = cellsOf(lines[j] ?? '');
      rows.push({ file, line: j + 1, id: cells[1] ?? '', what: cells[2] ?? '', status: cells[7] ?? '' });
    }
  }
  return { wrongHeaders, rows };
}

/** The ids a finished list holds: "- P1-13a: #180 …", and the dropped ones, "P0-14, on 2026-10-14". */
function theFinishedIdsIn(text: string): string[] {
  const id = String.raw`P\d-\d{2}[a-z0-9]*|B-\d{2}|KD-\d{3}`;
  return text
    .split('\n')
    .flatMap((line) => [
      ...(new RegExp(`^- (${id}):`).exec(line)?.slice(1, 2) ?? []),
      ...[...line.matchAll(new RegExp(String.raw`\b(${id}), on \d{4}-\d{2}-\d{2}\b`, 'g'))].map((m) => m[1] ?? ''),
    ]);
}

/** Whether `child` is one of `parent`'s own rows: P1-16 → P1-16q, P1-16o2; P1-16o → P1-16o2; P1-23a ↛ P1-23aa. */
function isOneOfItsRows(parent: string, child: string): boolean {
  if (child === parent || !child.startsWith(parent)) return false;
  const rest = child.slice(parent.length);
  if (/^P\d-\d{2}$/.test(parent)) return /^[a-z]/.test(rest);
  return /[a-z]$/.test(parent) && /^\d/.test(rest);
}

/** Each way the rows break "one way of tracking", as "file:line id: what". */
function theBreaches(rows: Row[], finished: Set<string>): string[] {
  const at = (r: Row): string => `${r.file}:${String(r.line)} ${r.id}`;
  return [
    ...rows.filter((r) => !THE_STATUSES.includes(r.status)).map((r) => `${at(r)}: status "${r.status}"`),
    ...rows.filter((r, i) => rows.findIndex((s) => s.id === r.id) !== i).map((r) => `${at(r)}: an open row twice`),
    ...rows.filter((r) => finished.has(r.id)).map((r) => `${at(r)}: open and finished`),
    ...rows
      .filter((r) => rows.some((s) => isOneOfItsRows(r.id, s.id)))
      .map((r) => `${at(r)}: a parent beside its own rows`),
    ...rows
      .filter((r) => /\b(?:its|tranche's|step's) rows (?:follow|are in)\b/i.test(r.what))
      .map((r) => `${at(r)}: its rows follow`),
  ];
}

const files = fs.readdirSync(path.join(ROOT, BACKLOG)).filter((f) => f.endsWith('.md'));
const read = (f: string): string => fs.readFileSync(path.join(ROOT, BACKLOG, f), 'utf8');
const TABLES = files
  .filter((f) => !f.startsWith('finished-steps-'))
  .sort()
  .map((f) => theTablesIn(`${BACKLOG}/${f}`, read(f)));
const ROWS = TABLES.flatMap((t) => t.rows);
const FINISHED = new Set(
  files.filter((f) => f.startsWith('finished-steps-')).flatMap((f) => theFinishedIdsIn(read(f))),
);

describe('the backlog tracks each item one way', () => {
  test('the check finds each kind of breach (a check that finds nothing proves nothing)', () => {
    const sample = [
      THE_HEADER,
      '|---|---|---|---|---|---|---|---|---|',
      '| P1-16 | The UI typed; its rows follow | – | Phase 1 | Large | – | 🟦 | #1 | |',
      '| P1-16q | A page freed, \\| a pipe in a cell | – | Phase 1 | Large | – | ⬜ | | |',
      '| P1-23a | A row | – | Phase 1 | Small | – | 👀 | | |',
      '| P1-23aa | Not a row of P1-23a | – | Phase 1 | Small | – | ⏸ | | |',
      '| KD-001 | A defect | – | – | – | – | ⬜ | | |',
      '| KD-001 | The same defect again | – | – | – | – | ⬜ | | |',
      '| B-02 | Dropped, and still open | – | – | – | – | ⬜ | | |',
      '',
      '| Id | What | Status | PR |',
      '|---|---|---|---|',
    ].join('\n');
    const { wrongHeaders, rows } = theTablesIn('sample.md', sample);
    expect(wrongHeaders).toEqual(['sample.md:11']);
    expect(rows.map((r) => r.id)).toEqual(['P1-16', 'P1-16q', 'P1-23a', 'P1-23aa', 'KD-001', 'KD-001', 'B-02']);
    expect(rows[1]?.status).toBe('⬜');
    const finished = new Set(theFinishedIdsIn('- P1-13a: #180 A title\nDropped: B-02, on 2026-11-15 (a rehearsal).'));
    expect([...finished]).toEqual(['P1-13a', 'B-02']);
    expect(theBreaches(rows, finished)).toEqual([
      'sample.md:5 P1-23a: status "👀"',
      'sample.md:8 KD-001: an open row twice',
      'sample.md:9 B-02: open and finished',
      'sample.md:3 P1-16: a parent beside its own rows',
      'sample.md:3 P1-16: its rows follow',
    ]);
  });

  test('the backlog and its finished lists are read (a file the check misreads would let every row through)', () => {
    expect(TABLES.length).toBeGreaterThan(10);
    expect(ROWS.length).toBeGreaterThan(300);
    expect(FINISHED.size).toBeGreaterThan(400);
    expect(FINISHED.has('P0-14') && FINISHED.has('B-02')).toBe(true);
  });

  test('every backlog table has the same header', () => {
    expect(TABLES.flatMap((t) => t.wrongHeaders)).toEqual([]);
  });

  test('each item is one open row, with one of the three statuses, and no parent sits beside its own rows', () => {
    expect(theBreaches(ROWS, FINISHED)).toEqual([]);
  });
});
