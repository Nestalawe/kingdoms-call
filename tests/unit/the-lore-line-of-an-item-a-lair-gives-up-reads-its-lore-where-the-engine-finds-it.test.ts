// The line a hero's report gives each item a lair gives up ("📜 The Sword of Wrath — …"), from its fact to its words
// (plan P1-13z): the fact copies the item as the line is told, and the prose writes the line. The item's lore is found
// in order: the item's own, the lore of the item of its name (an item in an older save may carry none, and an item under
// another name has its base's), the Mithril Armour's, and its short description; a Legendary relic is marked so.
// Level 1 (unit): two plain functions on staged items, called directly on the engine's modules; a static check can't
// run them, and the balance matrix reaches only the items its games happen to find, never an older save's.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { theItemsAsTheirLoreIsTold } from '../../src/engine/orders/the-facts-the-explore-and-search-orders-lines-record.ts';
import { theWordsOfTheExploreAndSearchOrdersLine } from '../../src/views/prose/the-words-of-the-explore-and-search-orders-lines.ts';
import { MITHRIL_ARMOUR } from '../../src/engine/heroes/fame-and-consecration.ts';
import { itemLore } from '../../src/engine/items/tiers-and-hoards.ts';

/** The line for these items, as the engine records it and the prose writes it. */
function theLoreLineOf(items: readonly NonNullable<Parameters<typeof itemLore>[0]>[]): string {
  return theWordsOfTheExploreAndSearchOrdersLine({
    kind: 'the lore of the items a lair gave up',
    items: theItemsAsTheirLoreIsTold(items, itemLore),
  });
}

const THE_BLADE_OF_FURYS_LORE =
  'A sword that hums with barely held anger; those who bear it strike faster and harder than their training alone allows. Melee skill counts as 2 levels higher in personal combat.';

describe('the lore line of an item a lair gives up reads its lore where the engine finds it', () => {
  test("an item's own lore", () => {
    expect(theLoreLineOf([{ name: 'Ring of Testing', lore: 'Its own words.', desc: 'Melee +1', tier: 1 }])).toBe(
      '📜 The Ring of Testing — Its own words.',
    );
  });

  test('an item with no lore of its own, under its own name and under another: the lore of its name', () => {
    expect(theLoreLineOf([{ name: 'Blade of Fury', desc: 'Melee +2', tier: 2 }])).toBe(
      `📜 The Blade of Fury — ${THE_BLADE_OF_FURYS_LORE}`,
    );
    expect(theLoreLineOf([{ name: 'Sword of Wrath', lore: '', desc: 'Melee +2', tier: 2 }])).toBe(
      `📜 The Sword of Wrath — ${THE_BLADE_OF_FURYS_LORE}`,
    );
  });

  test("the Mithril Armour, with no lore of its own: the suit's", () => {
    expect(theLoreLineOf([{ name: 'Mithril Armour', effect: { stat: 'mithrilArmour' } }])).toBe(
      `📜 The Mithril Armour — ${MITHRIL_ARMOUR.lore}`,
    );
  });

  test('an item no table knows, with no lore: its short description, else nothing', () => {
    expect(theLoreLineOf([{ name: 'No Such Item', desc: 'Plain words', effect: null }])).toBe(
      '📜 The No Such Item — Plain words',
    );
    expect(theLoreLineOf([{ name: 'No Such Item', effect: { stat: 'melee' } }])).toBe('📜 The No Such Item — ');
  });

  test('a Legendary relic is marked, and two items are two lines', () => {
    expect(
      theLoreLineOf([
        { name: 'Relic of Testing', lore: 'Older than the Empire.', tier: 4, effect: { stat: 'melee' } },
        { name: 'Ring of Testing', lore: 'Its own words.', tier: 1 },
      ]),
    ).toBe('📜 The Relic of Testing (LEGENDARY) — Older than the Empire.\n📜 The Ring of Testing — Its own words.');
  });

  test('no items: no line', () => {
    expect(theLoreLineOf([])).toBe('');
  });
});
