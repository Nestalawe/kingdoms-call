// 2026-10-13 (item 18): Research gains Perseverance, as Practice has: every Research order that fails makes the same
// hero's next Research this turn ×1.2 likelier, cumulatively; a discovery resets it, and each turn starts afresh. The
// rulebook and the player portal's order form say so. The engine's part (five Research orders with the rolls fixed) is
// unit/research-and-practice-orders-called-directly.test.ts.
//
// Level 0 (static): the rulebook as built (site/), and the player portal's words from src/ by their syntax tree
// (tests/lib/source.ts); nothing runs.
//
// Until plan P1-14f this was tests/research-persevere.test.js. Its two checks are kept as they were.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { pageText } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

test('the rulebook gives Research the same Perseverance', () => {
  const rules = readPage('kingdoms-call-rules.html');
  expect(
    /Research[^<]*<\/strong>[\s\S]{0,600}Perseverance[\s\S]{0,200}×1\.2/.test(rules) ||
      rules.includes('Perseverance applies to Research too'),
  ).toBe(true);
});

test("the order form's Research note says so", timeLimitForTheWork({ everyFileReads: 1 }), () => {
  expect(pageText('kingdoms-call-player-portal.html')).toContain(
    "Each failed Research this turn makes the hero's next one ×1.2 likelier",
  );
});
