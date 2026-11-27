// The items that lift one kind of company a commander leads name every unit the battle lifts, and the siege items say
// the defenders' fortifications are halved, as the battle does (R-149). Before P1-23w the Golden Spur's, the
// Legionnaire's Mark's, the Eagle-Eye Pendant's and the Engineer's Blueprint's kin named fewer units (two lances of
// seven, one infantry of four) and five siege items said "Siege bonus +1"; a copy already in a running game takes its
// row's words at the turn's start (the path R-153 built, its list of effects now naming these five).
//
// Level 1 (unit): every item in play carrying the effect (the engine's load-time pass makes the list, so the whole
// engine is imported), its desc and lore, and the lore a copy without its own shows, against the units the battle
// lifts read from the same table the battle reads (each effect's row's `reaches`, read by the strength a led unit has
// after its commander's items); then migrateItemTiers, the save's upgrade pass that re-stamps the items by name at the
// head of every turn, on a staged state holding an old copy (its words before P1-23w) in a hero's items, a
// lair's hoard and an older save's vault. Not lower: the rows and the pass are the texts and the re-stamp. No dice.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../src/content/magic-item-effects-their-names-numbers-and-words.ts';
import { theEffectsAnItemCarries } from '../../src/engine/rules-on-plain-values/the-effects-a-held-item-carries.ts';
import { migrateItemTiers } from '../../src/engine/items/equipment.ts';
import { itemLore } from '../../src/engine/items/tiers-and-hoards.ts';

/** The effects that lift the units of one kind a commander leads, each read from its row as the battle reads it. */
const THE_KINDS = (['cavalry-bonus', 'infantry-bonus', 'archer-bonus', 'heavy-bonus'] as const).map((slug) => ({
  slug,
  units: ROWS[slug].reaches,
}));

/** The items in play carrying an effect. */
const theItemsCarrying = (slug: string) =>
  ALL_MAGIC_ITEMS_P.filter((item) => theEffectsAnItemCarries(item).some((s) => s === slug));

/** Each item's texts a player reads: its desc, its lore, and the lore a copy without its own shows. */
const theTextsOf = (item: (typeof ALL_MAGIC_ITEMS_P)[number]) => [
  { which: 'desc', text: item.desc },
  { which: 'lore', text: item.lore },
  { which: 'the lore a copy without its own shows', text: itemLore({ name: item.name, desc: '' }) },
];

describe('each item that lifts a kind of company names every unit the battle lifts', () => {
  test.for(THE_KINDS)('$slug', ({ slug, units }) => {
    const items = theItemsCarrying(slug);
    expect(items.length, `the items in play carrying ${slug}`).toBeGreaterThan(0);
    expect(units.length, `the units the battle lifts for ${slug}`).toBeGreaterThan(0);
    const missing = items.flatMap((item) =>
      theTextsOf(item).flatMap(({ which, text }) =>
        units.filter((unit) => !text.includes(unit)).map((unit) => `${item.name}'s ${which}: ${unit}`),
      ),
    );
    expect(missing).toEqual([]);
  });
});

describe("each siege item says the defenders' fortifications are halved when its bearer attacks", () => {
  test.for(theItemsCarrying('siege-bonus').map((item) => [item.name, item] as const))('%s', ([, item]) => {
    for (const { text } of theTextsOf(item)) {
      expect(text).toMatch(/\bhal(f|ved)\b/);
      expect(text).toMatch(/attack/);
      expect(text).not.toMatch(/Siege bonus \+1|a level stronger/);
    }
  });
});

/** Old copies with their words before P1-23w: one of each of the five effects, its effect and its words. */
const THE_OLD_COPIES = [
  {
    name: 'Golden Spur',
    effect: { stat: 'cavBonus', bonus: 1 },
    desc: 'Free Lances and Gilded Lances: +25% strength when you lead them',
    lore: 'A single gilded spur once worn by a legendary captain of horse. Free Lances and Gilded Lances you lead fight at +25% strength.',
  },
  {
    name: 'Crested Kettle-Hat',
    effect: { stat: 'infBonus', bonus: 1 },
    desc: 'Infantry you lead fight +20%.',
    lore: 'A plain iron band; the men who see it know their lines will hold and their rations will come. Shieldwall, Guard and Berserker units you lead fight at +20%.',
  },
  {
    name: 'Cap of the Master Bowman',
    effect: { stat: 'archerStr', bonus: 1 },
    desc: 'Archer units you lead fight +30%.',
    lore: 'Green felt, one hawk feather, and a way of reading the wind. Longbow, Bowmen, Shadow Archer and Crossbow units you lead fight at +30%.',
  },
  {
    name: 'Amulet of the Bombardier',
    effect: { stat: 'heavyBonus', bonus: 1 },
    desc: 'Heavy engines you lead fight +4.',
    lore: 'A powder-flask stopper on a chain, still faintly warm. Mountain Guns and Ironclads you lead fight at +4 strength.',
  },
  {
    name: 'Ring of the Sapper',
    effect: { stat: 'siegeBonus', bonus: 1 },
    desc: 'Siege bonus +1.',
    lore: 'Iron, scored with a plan of walls that are no longer standing. Your armies breach walls as if a level stronger.',
  },
] as const;

/** An item's row in play. */
function theRow(name: string) {
  const row = ALL_MAGIC_ITEMS_P.find((it) => it.name === name);
  if (!row) throw new Error(`${name} is not in play`);
  return row;
}

describe('an old copy of an item that lifts a kind of company, or of a siege item', () => {
  test.for(THE_OLD_COPIES.map((old) => [old.name, old] as const))(
    '%s: its row in play differs from the old copy (the case has something to re-stamp)',
    ([name, old]) => {
      expect([theRow(name).desc, theRow(name).lore]).not.toEqual([old.desc, old.lore]);
    },
  );
  for (const where of ["a hero's items", "a lair's hoard", "an older save's vault"] as const) {
    test.for(THE_OLD_COPIES.map((old) => [old.name, old] as const))(
      `%s in ${where}: the turn's start gives it the row's effect, desc and lore`,
      ([name, old]) => {
        const copy = { ...structuredClone(old), slot: theRow(name).slot, tier: theRow(name).tier };
        const state =
          where === "a hero's items"
            ? { characters: [{ items: [copy] }] }
            : where === "a lair's hoard"
              ? { world: { provinces: [{ features: [{ hoardItems: [copy] }] }] } }
              : { players: [{ vault: [copy] }] }; // today's save has no vault: an older save's
        migrateItemTiers(state);
        expect({ effect: copy.effect, desc: copy.desc, lore: copy.lore }).toEqual({
          effect: theRow(name).effect,
          desc: theRow(name).desc,
          lore: theRow(name).lore,
        });
      },
    );
  }
});
