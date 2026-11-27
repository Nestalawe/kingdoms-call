// The Crown of Command's texts say it helps its wearer's own realm's characters in his province, as the turn does
// (R-143, R-120): rivals beside him gain nothing. Before P1-23u its desc said "All characters in the same province"
// and the lore a copy without its own falls back to said "friend or foe"; a copy already in a running game takes its
// row's words at the turn's start (the path R-153 built, its list of effects now naming the Crown's).
//
// Level 1 (unit): the Crown's row in play and itemLore (the lore the player page shows), then migrateItemTiers, the
// save's upgrade pass that re-stamps the items by name at the head of every turn
// (src/engine/saves/upgrade-a-saved-game-and-check-it.ts), on a staged state holding an old copy (its words as #862's
// base had them) in a hero's items, a lair's hoard and an older save's vault. Not lower: the row and the pass are the
// texts and the re-stamp. No dice.
import { describe, expect, test } from 'vitest';
import { migrateItemTiers } from '../../src/engine/items/equipment.ts';
import { itemLore } from '../../src/engine/items/tiers-and-hoards.ts';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';

/** The Crown as a copy dealt on #862's base carried it: its effect, its desc and its lore. */
const THE_OLD_COPY = {
  name: 'Crown of Command',
  slot: 'helm',
  effect: { stat: 'aura', bonus: 1 },
  desc: 'All characters in the same province gain +1 to all skills for the duration',
  lore: 'The iron crown of a king nobody now names, whose word could not be disobeyed. Every character standing with you fights and works one level better in every skill.',
} as const;

/** The Crown's row in play. */
function theRow() {
  const row = ALL_MAGIC_ITEMS_P.find((it) => it.name === 'Crown of Command');
  if (!row) throw new Error('The Crown of Command is not in play');
  return row;
}

describe("the Crown of Command's texts say your realm's characters, and that rivals gain nothing", () => {
  const texts = [
    { which: "its row's desc", text: theRow().desc },
    { which: "its row's lore", text: theRow().lore },
    { which: 'the lore a copy without its own shows', text: itemLore({ name: 'Crown of Command', desc: '' }) },
  ];
  test.for(texts)('$which', ({ text }) => {
    expect(text).toMatch(/your realm/);
    expect(text).toMatch(/rivals .*gain nothing/i);
    expect(text).not.toMatch(/friend or foe|^All characters|Every character standing with you/);
  });
});

describe('an old copy of the Crown of Command', () => {
  test('its row in play differs from the old copy (the case has something to re-stamp)', () => {
    expect([theRow().desc, theRow().lore]).not.toEqual([THE_OLD_COPY.desc, THE_OLD_COPY.lore]);
  });
  for (const where of ["a hero's items", "a lair's hoard", "an older save's vault"] as const) {
    test(`in ${where}: the turn's start gives it the row's effect, desc and lore`, () => {
      const copy = { ...structuredClone(THE_OLD_COPY), tier: theRow().tier };
      const state =
        where === "a hero's items"
          ? { characters: [{ items: [copy] }] }
          : where === "a lair's hoard"
            ? { world: { provinces: [{ features: [{ hoardItems: [copy] }] }] } }
            : { players: [{ vault: [copy] }] }; // today's save has no vault: an older save's
      migrateItemTiers(state);
      expect({ effect: copy.effect, desc: copy.desc, lore: copy.lore }).toEqual({
        effect: theRow().effect,
        desc: theRow().desc,
        lore: theRow().lore,
      });
    });
  }
});
