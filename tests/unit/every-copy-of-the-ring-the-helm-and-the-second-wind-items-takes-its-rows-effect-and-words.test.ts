// Every copy of the Ring of the Unbroken Pulse, the Great Helm of the Deathless and the second-wind items already in a
// running game takes its content row's effect and words at the turn's start (R-153, question 166's answer): a copy
// made before P1-23v (#846) carried the second wind on the Ring and the Helm, and "near defeat" in the other texts.
//
// Level 1 (unit): migrateItemTiers, the save's upgrade pass that re-stamps the items by name at the head of every turn
// (src/engine/saves/upgrade-a-saved-game-and-check-it.ts), called on a staged state holding an old copy of each item
// (its effect and its words as #846's base had them) in a hero's items, a lair's hoard and a realm's vault. Not lower:
// the pass is the re-stamp. No dice.
import { describe, expect, test } from 'vitest';
import { migrateItemTiers } from '../../src/engine/items/equipment.ts';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';

/** Each item as a copy made on #846's base carried it: its effect, its desc and its lore. */
const THE_OLD_COPIES = [
  {
    name: 'Ring of the Unbroken Pulse',
    effect: { stat: 'pc', pc: { ward: 'secondWind', pct: 15 } },
    desc: '15% to shrug off a killing blow once per fight, standing at 1 HP.',
    lore: 'The stone flickers once, and you are still standing. Once per fight, 15% to survive a killing blow at 1 HP.',
  },
  {
    name: 'Great Helm of the Deathless',
    effect: { stat: 'pc', pc: { ward: 'secondWind', pct: 20 } },
    desc: '20% to shrug off a killing blow once per fight, standing at 1 HP.',
    lore: 'Its last three owners were each certain they had died in it. Once per fight, 20% to survive a killing blow at 1 HP.',
  },
  {
    name: 'Amulet of Second Breath',
    effect: { stat: 'pc', pc: { ward: 'secondWind', pct: 20 } },
    desc: 'Amulet: once per fight, when first pushed near defeat you recover 20% of your maximum HP.',
    lore: 'It warms when you are almost done. Once per fight, the first time you are driven near defeat you recover 20% of your maximum HP.',
  },
  {
    name: 'Mantle of the Second Wind',
    effect: { stat: 'pc', pc: { ward: 'secondWind', pct: 15 } },
    desc: 'Cloak: once per fight, when first pushed near defeat you recover 15% of your maximum HP.',
    lore: 'It tightens at the shoulders when the legs begin to go. Once per fight, driven near defeat, you recover 15% of your maximum HP.',
  },
  {
    name: 'Grey Mantlet',
    effect: { stat: 'pc', pc: { ward: 'secondWind', pct: 15 } },
    desc: 'Cloak: once per fight, when first pushed near defeat you recover 15% of your maximum HP.',
    lore: 'It tightens at the shoulders when the legs begin to go. Once per fight, driven near defeat, you recover 15% of your maximum HP.',
  },
  {
    name: 'Pendant of the Ten Thousand Eyes',
    effect: { stat: 'pc', pc: { ward: 'secondWind', pct: 35, hitBonus: 16 } },
    desc: 'Amulet: once per fight recover 35% of max HP when nearly spent; +16% to hit throughout.',
    lore: 'Every facet holds a watcher, and between them they miss nothing - least of all the moment you are about to fall. Once per fight, driven near defeat, you recover 35% of your maximum HP; you fight at +16% to hit.',
  },
] as const;

/** The item's row in play, by its name. */
function theRow(name: string) {
  const row = ALL_MAGIC_ITEMS_P.find((it) => it.name === name);
  if (!row) throw new Error(`${name} is not in play`);
  return row;
}

describe.for(THE_OLD_COPIES)('an old copy of the $name', (old) => {
  const row = theRow(old.name);
  test('its row in play differs from the old copy (the case has something to re-stamp)', () => {
    expect([row.desc, row.lore]).not.toEqual([old.desc, old.lore]);
  });
  for (const where of ["a hero's items", "a lair's hoard", "a realm's vault"] as const) {
    test(`in ${where}: the turn's start gives it the row's effect, desc and lore`, () => {
      const copy = { ...structuredClone(old), tier: row.tier };
      const state =
        where === "a hero's items"
          ? { characters: [{ items: [copy] }] }
          : where === "a lair's hoard"
            ? { world: { provinces: [{ features: [{ hoardItems: [copy] }] }] } }
            : { players: [{ vault: [copy] }] };
      migrateItemTiers(state);
      expect({ effect: copy.effect, desc: copy.desc, lore: copy.lore }).toEqual({
        effect: row.effect,
        desc: row.desc,
        lore: row.lore,
      });
    });
  }
});

test("a copy's effect is its own: changing the re-stamped copy leaves the row in play as it was", () => {
  const copy = { ...structuredClone(THE_OLD_COPIES[0]), tier: 3 };
  migrateItemTiers({ characters: [{ items: [copy] }] });
  expect(copy.effect).not.toBe(theRow(copy.name).effect);
  expect(copy.effect.pc).not.toBe(theRow(copy.name).effect.pc);
});

test('an item of another effect keeps its words: a copy of the Bulwark Breastplate with other words is left as it is', () => {
  const copy = { ...structuredClone(theRow('Bulwark Breastplate')), desc: 'Armour: an old text.' };
  migrateItemTiers({ characters: [{ items: [copy] }] });
  expect(copy.desc).toBe('Armour: an old text.');
});
