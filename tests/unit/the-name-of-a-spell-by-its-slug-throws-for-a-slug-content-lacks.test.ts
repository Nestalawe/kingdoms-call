// The name of a spell, by its slug (plan P1-19an: src/engine/bots/the-name-of-a-spell-by-its-slug.ts), called directly:
// every spell of the game has a slug the lookup answers with the name SPELL_DEFS_P keys it by (so a bot's order, which
// holds that name as its `target`, is the one it had when the bot wrote the name), the fifteen spells the bots name
// among them, and a slug the content doesn't hold throws, whatever it is (one that is only a name, one of an object's
// own words). The file imports only the content, so the test imports it as it is, with no engine loaded.
// Level 1 (unit): one function of the content's tables; a bot's turn, which calls it, is run by every matrix game.
import { expect, test } from 'vitest';
import { SPELL_DEFS_P } from '../../src/content/kingdoms-call-data.ts';
import {
  ACTION_SPELLS_THE_REGISTRY_HOLDS_NO_EFFECT_FOR,
  SPELL_EFFECTS_THE_REGISTRY_HOLDS,
} from '../../src/content/spell-effects-their-names-numbers-and-words.ts';
import {
  theNameOfTheSpell,
  type ASpellsSlugInTheContent,
} from '../../src/engine/bots/the-name-of-a-spell-by-its-slug.ts';

const EVERY_ROW = { ...SPELL_EFFECTS_THE_REGISTRY_HOLDS, ...ACTION_SPELLS_THE_REGISTRY_HOLDS_NO_EFFECT_FOR };

test('every slug the content holds answers with its spell name, and every spell of the game has one', () => {
  const slugs = Object.keys(EVERY_ROW);
  expect(slugs).toHaveLength(Object.keys(SPELL_DEFS_P).length);
  for (const slug of slugs) {
    const name = theNameOfTheSpell(slug);
    expect(Object.hasOwn(SPELL_DEFS_P, name), `${slug} gives ${name}`).toBe(true);
    expect(name).toBe(EVERY_ROW[slug as ASpellsSlugInTheContent].name);
  }
  expect(new Set(slugs.map((slug) => theNameOfTheSpell(slug))).size).toBe(slugs.length);
});

test('the fifteen spells the bots name read as their names', () => {
  expect(
    Object.fromEntries(
      [
        'bless-province',
        'charm',
        'curse',
        'earthquake',
        'elemental-summon',
        'flood',
        'illusory-terrain',
        'invisibility',
        'oratory',
        'phantasmal-armies',
        'plague',
        'psychic-blast',
        'resurrect',
        'skeletal-armies',
        'telekinetic-storm',
      ].map((slug) => [slug, theNameOfTheSpell(slug)]),
    ),
  ).toEqual({
    'bless-province': 'Bless Province',
    charm: 'Charm',
    curse: 'Curse',
    earthquake: 'Earthquake',
    'elemental-summon': 'Elemental Summon',
    flood: 'Flood',
    'illusory-terrain': 'Illusory Terrain',
    invisibility: 'Invisibility',
    oratory: 'Oratory',
    'phantasmal-armies': 'Phantasmal Armies',
    plague: 'Plague',
    'psychic-blast': 'Psychic Blast',
    resurrect: 'Resurrect',
    'skeletal-armies': 'Skeletal Armies',
    'telekinetic-storm': 'Telekinetic Storm',
  });
});

test.for(['', 'Flood', 'a-spell-no-one-wrote', 'toString', 'constructor', '__proto__'])(
  'the slug "%s" is one the content lacks: it throws',
  (slug) => {
    expect(() => theNameOfTheSpell(slug as ASpellsSlugInTheContent)).toThrow(
      `The content holds no spell with the slug "${slug}".`,
    );
  },
);
