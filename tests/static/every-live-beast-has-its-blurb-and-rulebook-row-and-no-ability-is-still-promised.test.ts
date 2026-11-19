// The books say what the beasts do (the maintainer's decision of 2026-10-13, Creatures and Monsters V): every live
// Creature and Monster has a player-portal blurb (UNIT_ABILITIES) and a comprehensive-rulebook roster row; the
// rulebook's battle-lines text says the flying beasts fight from the air like the winged riders; no page still promises
// an ability "with the beast abilities" to come; and the unicorns' Purity breaks a Spear Hedge or a Boulder Wall in
// all three places it is written.
//
// The abilities' names and numbers are read from their content rows and tables by
// tests/static/each-unit-abilitys-name-and-numbers-are-in-both-books.test.ts, so this test names no ability but Purity.
//
// Level 0 (static): the rulebook as built (site/, or $KC_SITE's) read as text; the player portal and the data file from
// src/ by their syntax tree (tests/lib/source.ts): the blurbs as entries of the object literal, the words as the
// strings each holds. Words in a book need no lower level, and no page needs to run.
//
// Moved from the old script tests/primal-abilities-words.test.js (P1-14z): each check kept, with a guard that the
// rulebook's beast rows were read.
import fs from 'node:fs';
import { expect, test } from 'vitest';
import { sitePath } from '../lib/boot.ts';
import { LIVE } from '../lib/primal-decided.ts';
import { entriesOf, fileDeclaring, pageText, stringsOf } from '../lib/source.ts';

const PP = 'kingdoms-call-player-portal.html';
const rules = fs.readFileSync(sitePath('kingdoms-call-rules.html'), 'utf8');
const pp = pageText(PP);
const data = stringsOf('content/kingdoms-call-data.ts').join('\n');
const strip = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};
const norm = (s: string) => s.replace(/[’‘]/g, "'");
const UNITS = [
  'Whale Cohort',
  'Shark Shoals',
  'Thunderbirds',
  'Forest Ents',
  'Great Bears',
  'Stone Giants',
  'Unicorn Herd',
  'Mammoth Host',
  'Great Turtles',
  'Crimson Rocs',
  'Cave Trolls',
  'Basilisk Brood',
  'Manticore Pride',
  'Sea Giants',
  'Eldritch Kraken',
  'Titan Warbeasts',
  'Elder Dragons',
  'Dread Hydras',
];
const blurbs = Object.fromEntries(
  entriesOf(fileDeclaring(PP, 'UNIT_ABILITIES'), 'UNIT_ABILITIES').map((e) => [e.key, e.value]),
);
const ROW =
  /<tr><td><strong>([^<]+)<\/strong><\/td><td>(Creature|Monster)<\/td><td>([^<]*)<\/td>(?:<td[^>]*>[^<]*<\/td>){4}<td class="terr"[^>]*>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
const rows = new Set([...rules.matchAll(ROW)].map((m) => (m[1] ?? '').trim()));

test('every live beast is listed here', () => {
  expect(LIVE.length).toBeGreaterThan(0);
  expect(LIVE.filter((u) => !UNITS.includes(u))).toEqual([]);
});

test.each(UNITS)('%s has its player-portal blurb and its rulebook roster row', (u) => {
  expect(Object.keys(blurbs).length, 'the player portal declares UNIT_ABILITIES').toBeGreaterThan(0);
  expect(u in blurbs, `the player portal has a blurb for ${u}`).toBe(true);
  expect(rows.size, "the rulebook's beast rows were read").toBeGreaterThan(0);
  expect(rows.has(u), `the rulebook's roster has a row for ${u}`).toBe(true);
});

test('the rulebook says the flying beasts fight from the air like the winged riders', () => {
  const text = norm(strip(rules));
  expect(
    /flying beasts?[^.]{0,120}(from the air|take no place|no place in the line)/i.test(text) ||
      /(from the air|no place in the line)[^.]{0,160}flying beasts?/i.test(text),
  ).toBe(true);
  expect(text, '…and no longer says they hold a place like infantry').not.toMatch(
    /Flying BEASTS hold a place|flying beasts hold a place/i,
  );
});

test.each([
  ['rulebook', rules],
  ['player portal', pp],
  ['data file', data],
])('%s: no ability is still promised "with the beast abilities"', (_page, src) => {
  expect(norm(src)).not.toMatch(
    /comes? with the beasts?['’]? battle-line abilities|come with the beast abilities|comes with the beast abilities/i,
  );
});

// Purity breaks a Spear Hedge or a Boulder Wall (2026-10-12): the unicorns' blurb, their rulebook row and their
// data-file description say so.
test('Purity breaks a Spear Hedge or a Boulder Wall: the blurb, the rulebook row and the data file say so', () => {
  const brk = /breaks a Spear Hedge or a Boulder Wall/;
  expect(blurbs['Unicorn Herd'] ?? '', "the player portal's Unicorn Herd blurb").toMatch(brk);
  expect(/<tr><td><strong>Unicorn Herd<\/strong>[\s\S]*?<\/tr>/.exec(rules)?.[0] ?? '', "the rulebook's row").toMatch(
    brk,
  );
  expect(data, "the data file's Unicorn Herd description").toMatch(brk);
});
