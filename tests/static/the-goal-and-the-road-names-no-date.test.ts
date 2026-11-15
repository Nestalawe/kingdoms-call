// The goal and the road names no date: it gives the outcomes in order, each met or not, and when the work happens is
// the backlog's order, not the road's (docs/the-goal-and-the-road.md, its first paragraph).
// Without it a date creeps back in, goes stale within days, and reads as a plan or a gate: before this test, the road
// gave dates in 27 lines (at 7f8795ea), among them the days the next pieces of work were to start.
// Level 0 (static): it reads one file and nothing runs.
// - No line of docs/the-goal-and-the-road.md holds a month's name ("May" only beside a number, since "may" is a word),
//   a day's name, a year (19xx or 20xx standing alone) or a date written in digits (2026-11-15, 15/11).
// Not checked: words that point at a time ("today", "next week"). The agent who writes the road keeps those out.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ROAD = 'docs/the-goal-and-the-road.md';

const MONTHS = 'January|February|March|April|June|July|August|September|Sept|October|November|December';
const DAYS = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';
const A_DATE: readonly RegExp[] = [
  new RegExp(`\\b(?:${MONTHS})\\b`),
  /\bMay \d|\d May\b/,
  new RegExp(`\\b(?:${DAYS})\\b`),
  /(?<![\w.#-])(?:19|20)\d\d(?![\w-])/,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}\b/,
];

/** Whether a line holds a date. */
const holdsADate = (line: string): boolean => A_DATE.some((re) => re.test(line));

describe('the goal and the road names no date', () => {
  test('the check finds each kind of date, and lets ids and words through (a check that finds nothing proves nothing)', () => {
    const dated = [
      'Met on 10 November.',
      'The changes start on Thursday.',
      'Planned in 2026.',
      'Decided 2026-11-15.',
      'Started 15/11.',
      'Due 3 May.',
    ];
    expect(dated.filter((line) => !holdsADate(line))).toEqual([]);
    const undated = [
      'A maintainer may decide it ([R-177](rulings/R-177-x.md)), and P1-24 waits (#2026).',
      'The renames (P1-24) and the reshapes (P1-20) wait.',
      'Met.',
    ];
    expect(undated.filter(holdsADate)).toEqual([]);
  });

  test('no line of the road names a date', () => {
    const dated = fs
      .readFileSync(path.join(ROOT, ROAD), 'utf8')
      .split('\n')
      .flatMap((line, i) => (holdsADate(line) ? [`${ROAD}:${String(i + 1)}: ${line}`] : []));
    expect(dated).toEqual([]);
  });
});
