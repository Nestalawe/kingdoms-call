// Lairs stay as hard as they were made, and the rulebooks' readiness advice says so (the maintainer's choice of
// 2026-10-14, batch item 14: "option 1"). A hero of a grade's own measure no longer wins "about 19 fights in 20"
// above Weak: both books drop that promise; the comprehensive rulebook calls the readiness table the least to send,
// says the next grade's hero is the one who clears a lair reliably, and says Hunting Rumours' odds are the ones to
// trust; the intro says the same.
//
// Level 0 (static): both rulebooks as built (site/, or $KC_SITE's), their tags stripped; nothing runs. Words in a book
// need no lower level.
//
// Moved from the old script tests/lair-readiness-words.test.js (P1-14z): each check kept, with a guard that both books
// were read.
import fs from 'node:fs';
import { expect, test } from 'vitest';
import { sitePath } from '../lib/boot.ts';

const stripTags = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};
const strip = (page: string) => stripTags(fs.readFileSync(sitePath(page), 'utf8'));
const R = strip('kingdoms-call-rules.html');
const I = strip('kingdoms-call-rules-intro.html');

test('both rulebooks were read', () => {
  expect(R.length).toBeGreaterThan(100_000);
  expect(I.length).toBeGreaterThan(20_000);
});

test('neither book promises 19 fights in 20 at every grade', () => {
  expect(R, 'the rulebook').not.toMatch(
    /Send a hero of the grade's own measure and the hardest guardian of that grade falls to them about 19 fights in 20/,
  );
  expect(I, 'the intro').not.toMatch(/A hero of the right measure wins about 19 fights in 20/);
});

test("the rulebook calls the table the least to send, names the next grade's hero, and points to Hunting Rumours' odds", () => {
  expect(R, 'the least to send').toMatch(/the least you should send/i);
  expect(R, "the next grade's hero clears a lair reliably").toMatch(/next grade's measure/i);
  expect(R, "Hunting Rumours' odds are the ones to trust").toMatch(/Hunting Rumours[^.]*trust them/i);
});

test('the intro says the same', () => {
  expect(I).toMatch(/next grade's measure/i);
});
