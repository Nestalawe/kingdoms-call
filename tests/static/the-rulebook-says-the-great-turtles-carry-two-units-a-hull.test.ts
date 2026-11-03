// 2026-10-13 (Toby, Creatures and Monsters VI; R-106): Island Back in the rulebook. Its Naval kinds-of-unit row names
// the Great Turtles among the ferries, two units a hull; the turtles' own row names Island Back and no longer says they
// carry nothing; and the Sea-beasts row makes the turtles the exception to "they carry nothing". The rule itself, the
// data file's words and the player portal's blurb are tests/unit/island-back-the-great-turtles-carry-two-units-a-hull.test.ts.
//
// Level 0 (static): the rulebook as built (site/), each row read from its markup, its tags stripped, its curly
// quotes made straight and its white space made single; nothing runs.
//
// Until plan P1-14e these were three checks of tests/island-back.test.js, kept as they were but the last, made stricter:
// it passed on any Sea-beasts row that named the turtles and said they "carry nothing".
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';

const rules = readPage('kingdoms-call-rules.html');
const stripTags = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};
const norm = (s: string) => stripTags(s).replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
/** The rulebook's table row headed `name` (its second cell starting `lead`), in words. */
const row = (name: string, lead = '') =>
  norm(new RegExp(`<tr><td><strong>${name}</strong></td><td>${lead}[\\s\\S]*?</tr>`).exec(rules)?.[0] ?? '');

test('the rulebook: the Naval row, the turtles’ row and the Sea-beasts row say the turtles carry two units a hull', () => {
  const naval = row('Naval', 'Warships');
  expect(
    naval.includes('Great Turtles') && naval.includes('two'),
    `the rulebook's Naval kinds-of-unit row names the Great Turtles among the ferries, two units a hull — "${naval.slice(0, 160)}…"`,
  ).toBe(true);
  const turtles = row('Great Turtles');
  expect(
    turtles.includes('Island Back') && turtles.includes('two') && !/carries? nothing|carry nothing/.test(turtles),
    `the turtle row names Island Back and no longer says they carry nothing — "${turtles.slice(-200)}"`,
  ).toBe(true);
  const beasts = row('Sea-beasts');
  // stricter than the old script's check, which any row naming the turtles and saying "carry nothing" passed: the
  // turtles themselves carry (or ferry) two, in one sentence
  expect(
    /turtles[^.;]*?\b(carr(y|ies)|ferr(y|ies)) two\b/i.test(beasts),
    `the Sea-beasts row makes the turtles the exception to 'they carry nothing' — "${beasts.slice(0, 300)}"`,
  ).toBe(true);
});
