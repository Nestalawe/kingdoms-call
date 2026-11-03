// 2026-10-13 (item 10): whenever a hero gains an item, the report says whether he equips it at once or has no room for
// the item (the slot already holds another, named), that the item needs no slot, or that he cannot use it. The engine settles
// the slots and records how he carries each (settleTheItemsAHeroGained, src/engine/items/equipment.ts); the views write
// the note (theWordsOfTheItemsAHeroGained, src/views/prose/the-words-of-the-items-a-hero-gained.ts). Here both are
// called on staged heroes carrying the game's own items: a free slot, a full weapon slot, an item its last owner wore,
// both ring slots full, an item with no slot, an item of another folk, two at once, and an item he does not hold.
// Every way a hero gains an item writes the note straight after its own line: the four the orders' cases reach are
// cases (Send Item by hand and by courier, lib/item-and-army-order-cases.ts; Steal and the Grand Heist,
// lib/espionage-order-cases.ts), the six others a read of the code
// (static/six-more-ways-a-hero-gains-an-item-write-how-he-carries-it-straight-after-their-line.test.ts).
//
// Level 1 (unit): the two functions called on hand-made heroes, the item table imported with the whole engine loaded
// (tests/lib/the-whole-engine.ts: equipment.ts re-tiers the table as it loads). Not lower: the note is a computed
// value.
//
// Until plan P1-14f this was part of tests/item-equip-note.test.js, which called the two functions on the booted GM
// page. Its checks are kept as they were; "the item table was read" is the import, and its length kept.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { activeItems, settleTheItemsAHeroGained } from '../../src/engine/items/equipment.ts';
import { itemRaceOf, itemSlot } from '../../src/engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { theWordsOfTheItemsAHeroGained } from '../../src/views/prose/the-words-of-the-items-a-hero-gained.ts';

interface Item {
  name: string;
  equipped?: boolean;
  race?: string;
  alignment?: string;
  [key: string]: unknown;
}
interface Hero {
  id: string;
  name: string;
  race: string;
  alignment: string;
  player: number;
  items: Item[];
}
const ITEMS: readonly Item[] = ALL_MAGIC_ITEMS_P;
const copy = (it: Item): Item => JSON.parse(JSON.stringify(it)) as Item;
const item = (name: string) => {
  const it = ITEMS.find((x) => x.name === name);
  if (!it) throw new Error('no item ' + name);
  return copy(it);
};
const note = (h: Hero, items: Item[]) => theWordsOfTheItemsAHeroGained(settleTheItemsAHeroGained(h, items));
const hero = (items: Item[] = []): Hero => ({
  id: 'h',
  name: 'Aldric',
  race: 'Human',
  alignment: 'Good',
  player: 0,
  items,
});

test('the item table was read', () => {
  expect(ITEMS.length).toBeGreaterThan(20);
});

test('a free slot: equipped at once', () => {
  const h = hero();
  const b = item('Blade of Fury');
  h.items.push(b);
  const t = note(h, [b]);
  expect(t, `free weapon slot: "${t}"`).toMatch(/^🎒 Aldric equips the Blade of Fury at once\.$/);
  expect(b.equipped, '…and the blade is worn').toBe(true);
});

test('the slot already holds a weapon: no room, and the old one stays on', () => {
  const old = item('Sword of the First Emperor');
  const h = hero([old]);
  activeItems(h);
  const b = item('Blade of Fury');
  h.items.push(b);
  const t = note(h, [b]);
  expect(t, `full weapon slot: "${t}"`).toMatch(
    /Aldric has no room to equip the Blade of Fury: the weapon slot already holds the Sword of the First Emperor, so it goes in the pack/,
  );
  expect(old.equipped === true && b.equipped === false, '…the old weapon is still worn and the new one is not').toBe(
    true,
  );
});

test('an item its last owner wore keeps no claim on the slot', () => {
  const old = item('Sword of the First Emperor');
  const h = hero([old]);
  activeItems(h);
  const b = item('Blade of Fury');
  b.equipped = true;
  // stricter than the old script, which put the blade after the sword in the pack, where the slots, filled in the
  // pack's order, gave the sword the slot whether or not the blade's old claim was dropped: first in the pack, the blade
  // would take the slot if it kept the claim
  h.items.unshift(b);
  const t = note(h, [b]);
  expect(
    t.includes('has no room to equip the Blade of Fury') && old.equipped === true,
    `a weapon taken from someone who wore it: "${t}"`,
  ).toBe(true);
});

test('two rings fill both ring slots', () => {
  const r1 = item('Ring of the Explorer');
  const r2 = item('Ring of Wealth');
  const h = hero([r1, r2]);
  activeItems(h);
  const r3 = item("Siege Master's Ring");
  h.items.push(r3);
  const t = note(h, [r3]);
  expect(t, `full ring slots: "${t}"`).toMatch(
    /both ring slots already hold the Ring of the Explorer and the Ring of Wealth/,
  );
});

test('an item with no slot works at once', () => {
  const free = ITEMS.find((x) => !itemSlot(x) && !x.race && !x.alignment);
  expect(free, 'there is an item with no slot').toBeDefined();
  if (!free) return;
  const f = copy(free);
  const t = note(hero([f]), [f]);
  expect(t, `no-slot item: "${t}"`).toMatch(/needs no slot: it works for Aldric at once/);
});

test('an item the hero cannot use', () => {
  const raced = ITEMS.find((x) => x.race && itemRaceOf(x) !== 'Human');
  expect(raced, 'there is a race-bound item').toBeDefined();
  if (!raced) return;
  const r = copy(raced);
  const t = note(hero([r]), [r]);
  expect(t, `unusable item: "${t}"`).toMatch(/Aldric cannot use the .* and carries it unused\./);
});

test('several at once, in one line', () => {
  const h = hero();
  const b = item('Blade of Fury');
  const s = item('Sword of the First Emperor');
  h.items.push(b, s);
  const t = note(h, [b, s]);
  expect(t, `two weapons at once: "${t}"`).toMatch(
    /equips the Blade of Fury at once\. Aldric has no room to equip the Sword of the First Emperor/,
  );
});

test('nothing to say for an item the hero does not hold', () => {
  expect(note(hero(), [item('Blade of Fury')])).toBe('');
});
