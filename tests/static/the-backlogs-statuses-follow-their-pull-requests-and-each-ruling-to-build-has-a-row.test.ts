// The backlog's statuses follow its pull requests, and each ruling to build has its row (docs/backlog/README.md,
// "How to read a row"; docs/rulings/README.md, "Status": building a ruling "Decided, not built" is a row of the
// backlog).
// Without it a row's status goes stale unseen, and a decided ruling waits with no row to build it: before this test,
// nine rows listed merged pull requests and still read "not started", and 23 rulings decided on 2 to 15 November had
// no row (at bf2e300f).
// Level 0 (static): it reads files and nothing runs.
// - The rows are every table row under a header that starts "| Id |", in each file of docs/backlog/ but the finished
//   lists. Each table has an Id, a Status and a PR column.
// - A row whose PR column names a pull request (#N) isn't ⬜ (not started).
// - Each ruling whose file says "**Status:** Decided, not built" is named (R-NNN) in a row.
// Not checked: that a pull request named is merged (that needs GitHub); the agent who updates the row checks it.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BACKLOG = 'docs/backlog';
const RULINGS = 'docs/rulings';

interface Row {
  file: string;
  id: string;
  status: string;
  pr: string;
  text: string;
}

/** The rows of every table whose header starts "| Id |" in one file's text, read by the header's column names. */
function theRowsIn(file: string, text: string): { rows: Row[]; tablesMissingAColumn: string[] } {
  const rows: Row[] = [];
  const tablesMissingAColumn: string[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i] ?? '';
    if (!header.startsWith('| Id |')) continue;
    const names = header.split('|').map((c) => c.trim());
    const at = { id: names.indexOf('Id'), status: names.indexOf('Status'), pr: names.indexOf('PR') };
    if (at.status < 0 || at.pr < 0) tablesMissingAColumn.push(`${file}:${String(i + 1)}`);
    for (let j = i + 2; j < lines.length && (lines[j] ?? '').startsWith('|'); j++) {
      const line = lines[j] ?? '';
      const cells = line.split('|').map((c) => c.trim());
      rows.push({
        file,
        id: cells[at.id] ?? '',
        status: cells[at.status] ?? '',
        pr: cells[at.pr] ?? '',
        text: line,
      });
    }
  }
  return { rows, tablesMissingAColumn };
}

/** Each row that lists a pull request but reads "not started". */
const notStartedWithAPullRequest = (rows: Row[]): string[] =>
  rows.filter((r) => /#\d+/.test(r.pr) && r.status.includes('⬜')).map((r) => `${r.file} ${r.id}`);

/** Each ruling to build that no row names. */
const rulingsToBuildWithNoRow = (rulingsToBuild: string[], rows: Row[]): string[] =>
  rulingsToBuild.filter((id) => !rows.some((r) => new RegExp(`\\b${id}\\b`).test(r.text)));

const backlogFiles = fs
  .readdirSync(path.join(ROOT, BACKLOG))
  .filter((f) => f.endsWith('.md') && !f.startsWith('finished-steps-'))
  .sort()
  .map((f) => `${BACKLOG}/${f}`);
const read = backlogFiles.map((f) => theRowsIn(f, fs.readFileSync(path.join(ROOT, f), 'utf8')));
const ROWS = read.flatMap((r) => r.rows);

const RULINGS_TO_BUILD = fs
  .readdirSync(path.join(ROOT, RULINGS))
  .filter((f) => /^R-\d{3}-.*\.md$/.test(f))
  .filter((f) =>
    /^- \*\*Status:\*\* Decided, not built\s*$/m.test(fs.readFileSync(path.join(ROOT, RULINGS, f), 'utf8')),
  )
  .map((f) => f.slice(0, 5))
  .sort();

describe("the backlog's statuses follow their pull requests, and each ruling to build has a row", () => {
  test('the check finds a stale status and a ruling with no row (a check that finds nothing proves nothing)', () => {
    const sample = [
      '| Id | What | Status | PR |',
      '|---|---|---|---|',
      '| P1-01 | Started, and says so | 🟦 | #12 |',
      '| P1-02 | Merged a part, and says not started | ⬜ | #13–#20, its rows |',
      '| P1-03 | Builds [R-101](x.md) | ⬜ | |',
      '',
      'Prose after the table: | not a row |',
    ].join('\n');
    const { rows, tablesMissingAColumn } = theRowsIn('sample.md', sample);
    expect(tablesMissingAColumn).toEqual([]);
    expect(rows.map((r) => r.id)).toEqual(['P1-01', 'P1-02', 'P1-03']);
    expect(notStartedWithAPullRequest(rows)).toEqual(['sample.md P1-02']);
    expect(rulingsToBuildWithNoRow(['R-101', 'R-102'], rows)).toEqual(['R-102']);
    expect(theRowsIn('old.md', '| Id | What | State |\n|---|---|---|\n').tablesMissingAColumn).toEqual(['old.md:1']);
  });

  test('the backlog and the rulings are read (a file the check misreads would let every row through)', () => {
    expect(backlogFiles).toContain(`${BACKLOG}/README.md`);
    expect(read.flatMap((r) => r.tablesMissingAColumn)).toEqual([]);
    expect(ROWS.length).toBeGreaterThan(40);
    expect(RULINGS_TO_BUILD.length).toBeGreaterThan(0);
  });

  test('no row that lists a pull request reads "not started"', () => {
    expect(notStartedWithAPullRequest(ROWS)).toEqual([]);
  });

  test('each ruling "Decided, not built" is named in a row of the backlog', () => {
    expect(rulingsToBuildWithNoRow(RULINGS_TO_BUILD, ROWS)).toEqual([]);
  });
});
