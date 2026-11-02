// The alignment orders: the names the order form writes, and who may give each (plan P1-11d7: src/engine/rules-on-
// plain-values/the-alignment-orders-the-names-the-form-writes-and-who-may-give-each.ts), called directly on the content's
// rows. A realm of the order's creed alone may give it (Consecrate Divine, Call to Arms Good, the Broker Neutral,
// Harvest the Field Undead, Perform Rite Pagan: Druidic and Evil have none), and the king alone gives Consecrate, Call
// to Arms and the Broker. The turn's five resolvers and the order form's list (actionsFor) both ask these two checks, so
// a creed or a king's mark planted wrong in a row moves both sides of the parity test (the-player-portals-copies-agree-
// with-the-engine, "the order list offers a hero exactly the orders the turn lets him give …") alike: these cases
// write each order's creed and mark out as the books state them, and go red. The file imports only the content, so
// the test imports it as it is, with no engine loaded.
// Level 1 (unit): two functions of a row and a creed or a rank, and the form's names.
import { expect, test } from 'vitest';
import { KC_ALIGNMENTS } from '../../src/content/kingdoms-call-data.ts';
import { THE_ALIGNMENT_ORDERS } from '../../src/content/alignment-orders-their-keys-names-creeds-numbers-and-words.ts';
import {
  aHeroMayGiveTheAlignmentOrderAsKingOrNot,
  aRealmOfThisCreedMayGiveTheAlignmentOrder,
  theAlignmentOrdersByTheNameTheFormWrites,
  theNameTheFormWritesOfTheAlignmentOrder,
} from '../../src/engine/rules-on-plain-values/the-alignment-orders-the-names-the-form-writes-and-who-may-give-each.ts';

const slugs = Object.keys(THE_ALIGNMENT_ORDERS) as (keyof typeof THE_ALIGNMENT_ORDERS)[];

test('a realm of the order’s creed alone may give it, and a realm of no known creed none', () => {
  const mayGive = Object.fromEntries(
    slugs.map((slug) => [
      slug,
      KC_ALIGNMENTS.filter((creed) => aRealmOfThisCreedMayGiveTheAlignmentOrder(THE_ALIGNMENT_ORDERS[slug], creed)),
    ]),
  );
  expect(mayGive).toEqual({
    consecrate: ['Divine'],
    'call-to-arms': ['Good'],
    broker: ['Neutral'],
    'harvest-the-field': ['Undead'],
    'perform-rite': ['Pagan'],
  });
  for (const slug of slugs)
    expect(aRealmOfThisCreedMayGiveTheAlignmentOrder(THE_ALIGNMENT_ORDERS[slug], undefined)).toBe(false);
});

test('the king alone gives Consecrate, Call to Arms and the Broker; any hero the other two', () => {
  const whoMayGive = (isKing: boolean | null | undefined) =>
    slugs.filter((slug) => aHeroMayGiveTheAlignmentOrderAsKingOrNot(THE_ALIGNMENT_ORDERS[slug], isKing));
  expect(whoMayGive(true)).toEqual(['consecrate', 'call-to-arms', 'broker', 'harvest-the-field', 'perform-rite']);
  // a hero who isn't the king, and one the order form holds no rank for (a card with no hero, or none read)
  for (const isKing of [false, null, undefined])
    expect(whoMayGive(isKing)).toEqual(['harvest-the-field', 'perform-rite']);
});

test('the names the order form writes: each by its slug, and the orders by their names, in the rows’ order', () => {
  expect(slugs.map((slug) => theNameTheFormWritesOfTheAlignmentOrder(slug))).toEqual([
    'Consecrate',
    'Call to Arms',
    'Broker',
    'Harvest the Field',
    'Perform Rite',
  ]);
  const byName = theAlignmentOrdersByTheNameTheFormWrites();
  expect(Object.entries(byName).map(([name, order]) => [name, order.key, order.creed, order.theKingAlone])).toEqual([
    ['Consecrate', 'consecrate', 'Divine', true],
    ['Call to Arms', 'call_to_arms', 'Good', true],
    ['Broker', 'broker', 'Neutral', true],
    ['Harvest the Field', 'harvest_field', 'Undead', false],
    ['Perform Rite', 'rite', 'Pagan', false],
  ]);
  // a new table each time: a caller that changes its own leaves the next one as the rows are
  delete byName['Broker'];
  expect(Object.keys(theAlignmentOrdersByTheNameTheFormWrites())).toContain('Broker');
});
