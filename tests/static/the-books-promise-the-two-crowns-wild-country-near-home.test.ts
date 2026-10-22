// 2026-10-13 (item 12): the books promise what world generation guarantees: a Druidic king has at least one land
// Creature province within two provinces of home, and an Evil king a land Monster province. The rulebook says so in
// both crowns' entries, and the player portal's Druidic and Evil blurbs say the same.
//
// Level 0 (static): the books' words, read, not run (the rulebook as built, the player portal's strings from src/ by
// their syntax tree: tests/lib/source.ts). The guarantee itself is checked on generated worlds by
// tests/unit/the-two-crowns-have-wild-country-within-two-provinces.test.ts. Until plan P1-14a these were the last two
// checks of tests/crown-wild-near.test.js.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { pageStrings } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

test('the rulebook promises both crowns their wild country within two provinces', () => {
  const rules = readPage('kingdoms-call-rules.html');
  expect(
    rules.match(/always at least one (Creature|Monster) province within two provinces of your home/g) ?? [],
  ).toHaveLength(2);
});

test("the player portal's Druidic and Evil blurbs say the same", timeLimitForTheWork({ everyFileReads: 1 }), () => {
  const portal = pageStrings('kingdoms-call-player-portal.html').join('\n');
  expect(portal).toMatch(/Creature province within two provinces of your home/);
  expect(portal).toMatch(
    /Monster province you can lead from turn one, and there is always at least one within two provinces/,
  );
});
