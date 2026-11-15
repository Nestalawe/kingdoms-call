// Each open question names the rulings it was checked against: a line "*Touches:*" with their ids, or "none"
// (docs/questions-for-the-maintainers.md, "How a question is written and kept").
// Without it a question can ask the maintainers to decide what a ruling already decides, or contradict one unseen:
// question 78 asked what question 55's answer, R-164, already decides, and was taken out once that was seen.
// Level 0 (static): it reads one file and nothing runs.
// - Each question (a heading "## N. …") has one paragraph that starts "*Touches:*".
// - That paragraph says "none", or names at least one ruling id (R-NNN), and each id is a file docs/rulings/R-NNN-*.md.
// Not checked: that the rulings named are all the ones the question touches; the agent who writes it checks them
// against the rulings' index.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const QUESTIONS = 'docs/questions-for-the-maintainers.md';

const RULINGS = new Set(
  fs.readdirSync(path.join(ROOT, 'docs/rulings')).flatMap((f) => /^R-(\d{3})-.*\.md$/.exec(f)?.slice(1, 2) ?? []),
);

/** Each question of the file: its number and its text, from its heading to the next heading. */
function theQuestionsIn(text: string): { number: string; body: string }[] {
  return text.split(/^(?=## )/m).flatMap((part) => {
    const number = /^## (\d+)\. /.exec(part)?.[1];
    return number ? [{ number, body: part }] : [];
  });
}

/** What is wrong with one question's "Touches:" line, or nothing. */
function whatIsWrongWithItsTouchesLine(body: string, rulings: Set<string>): string[] {
  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trimStart().startsWith('*Touches:*'));
  if (paragraphs.length !== 1) return [`${String(paragraphs.length)} "*Touches:*" lines, not 1`];
  const said = (paragraphs[0] ?? '').trim().replace(/^\*Touches:\*\s*/, '');
  if (/^none\.?$/i.test(said)) return [];
  const ids = [...said.matchAll(/\bR-(\d{3})\b/g)].map((m) => m[1] ?? '');
  if (ids.length === 0) return ['it names no ruling, and does not say "none"'];
  return ids.filter((id) => !rulings.has(id)).map((id) => `R-${id} is not a file in docs/rulings/`);
}

describe('each open question names the rulings it was checked against', () => {
  test('the check finds a missing, an empty and a wrong line (a check that finds nothing proves nothing)', () => {
    expect(RULINGS.size).toBeGreaterThan(100);
    const sample = [
      '## 1. A question with no line\n\nText.\n',
      '## 2. A question with an empty line\n\n*Touches:* \n',
      '## 3. A question naming a ruling the two lack\n\n*Touches:* R-164.\n',
      '## 4. A question checked\n\n*Touches:* [R-030](rulings/R-030-fervour.md) (a reason),\nand R-036.\n',
      '## 5. A question that touches none\n\n*Touches:* none.\n',
    ].join('\n');
    const twoRulings = new Set(['030', '036']);
    expect(theQuestionsIn(sample).map((q) => [q.number, whatIsWrongWithItsTouchesLine(q.body, twoRulings)])).toEqual([
      ['1', ['0 "*Touches:*" lines, not 1']],
      ['2', ['it names no ruling, and does not say "none"']],
      ['3', ['R-164 is not a file in docs/rulings/']],
      ['4', []],
      ['5', []],
    ]);
  });

  test('every question of the file is read (a heading the check misreads would let it through)', () => {
    const text = fs.readFileSync(path.join(ROOT, QUESTIONS), 'utf8');
    const numberedHeadings = text.split('\n').filter((line) => /^## \d/.test(line));
    expect(theQuestionsIn(text).length).toBe(numberedHeadings.length);
  });

  test('each open question has its "Touches:" line, and each ruling it names is a file', () => {
    const text = fs.readFileSync(path.join(ROOT, QUESTIONS), 'utf8');
    const wrong = theQuestionsIn(text).flatMap((q) =>
      whatIsWrongWithItsTouchesLine(q.body, RULINGS).map((why) => `question ${q.number}: ${why}`),
    );
    expect(wrong).toEqual([]);
  });
});
