// 2026-10-15 (Toby, D7; R-115): the rulebook's cast-chance lines say what the game does (Toby: the books follow the
// game): training raises the cast chance only to 80% at level 5, and trained levels past 5 do not raise it; a magic item
// that adds levels in the school does, +10% a level to 95%; no line says trained levels keep climbing; and it is the
// same roll for a hero guarding a neutral province. The figures themselves are
// tests/unit/a-guard-casts-battle-magic-at-the-odds-a-players-hero-has.test.ts.
//
// Level 0 (static): the rulebook as built (site/), its tags stripped and its white space made single; nothing runs.
//
// Until plan P1-14d these were the last four checks of tests/guard-cast-chance.test.js, kept as they were.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';

const stripTags = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};
const R = stripTags(readPage('kingdoms-call-rules.html')).replace(/\s+/g, ' ');

test("the rulebook: training raises cast chance only to 80% at level 5; an item carries it on to 95%; a guard's roll is the same", () => {
  expect(R, 'the rulebook: training raises cast chance only to 80% at level 5').toMatch(
    /80% at 5\. Trained levels past 5 do not raise it/,
  );
  expect(R, '…a magic item carries it on to 95%').toMatch(
    /a magic item that adds levels in the school does, \+10% a level to 95%/,
  );
  expect(R, '…and no line says trained levels keep climbing').not.toMatch(
    /keeps climbing \+10% a level to the 95% ceiling/,
  );
  expect(R, '…and it is the same roll for a neutral guard').toMatch(
    /the same roll for a hero guarding a neutral province/,
  );
});
