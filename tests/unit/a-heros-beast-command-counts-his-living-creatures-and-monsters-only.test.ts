// 2026-10-12 (Toby's batch, item 24; R-103): a hero leads at most as many Creature and Monster units as his Druid
// level. What counts (beastCommandCount, and beastsLed for a column, src/engine/world/tables.ts): every living beast,
// a Monster or a Creature; not the risen dead (the dead need no Druid), not a summoned grove or Wild Hunt beasts that
// leave at the turn's end, nor humanoid troops or winged riders.
// Where the rule bites, in the orders: a beast recruited into a full column musters into the garrison, a full column
// picks none up, a comrade handed a column takes only the beasts he has room for, and a hero already over the cap keeps
// what he leads (cases of lib/recruit-hire-and-realm-works-order-cases.ts and lib/item-and-army-order-cases.ts, "…
// (item 24)"); the books' and the hero card's words are
// static/the-books-and-the-hero-card-say-a-hero-leads-as-many-beasts-as-his-druid-level.test.ts.
//
// Level 1 (unit): the two functions called on hand-made companies and a column. Not lower: what counts is computed.
//
// Until plan P1-14f this was part of tests/beast-command.test.js, which called the two on the booted GM page. Its checks
// are kept as they were; "beastsLed and beastCommandCount are declared at module level" is the import.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { beastCommandCount, beastsLed } from '../../src/engine/world/tables.ts';

const beast = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  quality: 'Average',
  race: 'Primal',
  unitName: 'the Test ' + (type.split(' ')[0] ?? ''),
  ...extra,
});

/** A company of men or riders, as the old script wrote one. */
const troops = (type: string) => ({ type, quality: 'Average' });

test('a Monster and a Creature count', () => {
  expect(beastCommandCount(beast('Cave Trolls')) && beastCommandCount(beast('Forest Ents'))).toBe(true);
});

test('a skeletal troll does not (the dead need no Druid)', () => {
  expect(beastCommandCount(beast('Cave Trolls', { _isSkeletal: true, race: 'Undead' }))).toBe(false);
});

test('nor a summoned grove or Wild Hunt beasts', () => {
  expect(
    !beastCommandCount(beast('Forest Ents', { _temporary: true })) &&
      !beastCommandCount(beast('Great Bears', { _wildHuntUntilTurn: 9 })),
  ).toBe(true);
});

test('nor humanoid troops or winged riders', () => {
  expect(!beastCommandCount(troops('Shieldwall Levies')) && !beastCommandCount(troops('Eagle Riders'))).toBe(true);
});

test('a column of a troll, an ent, a levy and a skeletal troll leads two beasts', () => {
  expect(
    beastsLed({
      armies: [
        beast('Cave Trolls'),
        beast('Forest Ents'),
        troops('Shieldwall Levies'),
        beast('Cave Trolls', { _isSkeletal: true }),
      ],
    }),
  ).toBe(2);
});
