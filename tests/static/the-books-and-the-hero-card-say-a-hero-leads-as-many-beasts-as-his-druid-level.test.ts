// 2026-10-12 (Toby's batch, item 24; R-103): a hero leads at most as many Creature and Monster units as his Druid
// level, and the books and the player portal say so: the rulebook's Druid skill and both crowns' sections beside their
// waiver, the intro's Druidic and Evil rows, no text left saying a crown's heroes lead beasts with no Druid training at
// all, and the hero card counting his beasts against his Druid (with countsAgainstBeastCommand, the engine's own rule,
// shared through src/shared/). What counts is unit/a-heros-beast-command-counts-his-living-creatures-and-monsters-only;
// the orders' cases are named there.
//
// Level 0 (static): the rulebooks as built (site/), and the player portal from src/ (its files as written, and its code
// in one layout: tests/lib/source.ts); nothing runs. Kept a read of the code (plan P1-14's Decision 3): the hero card
// is built inside the portal's modules, which call supabase.createClient as they load.
//
// Until plan P1-14f this was part of tests/beast-command.test.js. Its five checks are kept as they were.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { compactPage, pageSource } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const PP = 'kingdoms-call-player-portal.html';
const rules = readPage('kingdoms-call-rules.html');
const intro = readPage('kingdoms-call-rules-intro.html');

test("the rulebook's Druid skill and both crowns' sections say a hero leads at most as many beasts as his Druid level", () => {
  expect(rules, "the rulebook's Druid skill").toMatch(
    /A hero leads at most as many Creature and Monster units as his Druid level/,
  );
  expect(
    (rules.match(/a hero leads at most as many Creature and Monster units as his Druid level/g) ?? []).length,
    "…and both crowns' sections say so beside their waiver",
  ).toBeGreaterThanOrEqual(2);
});

test("the intro's Druidic and Evil rows say so", () => {
  expect((intro.match(/a hero leads as many beasts as his Druid level/g) ?? []).length).toBe(2);
});

test(
  "the player portal no longer says a crown's heroes lead beasts with no Druid training at all",
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    expect(pageSource(PP)).not.toMatch(/no Druid training at all/);
  },
);

test("the hero's card counts his beasts against his Druid", timeLimitForTheWork({ everyFileReads: 1 }), () => {
  const ppCode = compactPage(PP);
  expect(ppCode).toMatch(/arr\.filter\(countsAgainstBeastCommand\)/);
  expect(ppCode).toMatch(/🐾 beasts \$\{_bLed\}\/\$\{druLevel\}/);
});
