// The rule registry holds each effect once, in the order of its stage (plan P1-19, Decisions 2 and 3): every effect an
// entry names at a stage is in that stage's order exactly once, and each order names only entries with an effect at its
// stage (an effect left out of its order would never run; one named twice would run twice). Each content row's unit,
// each unit it counts, reaches or counts as, is a unit type, and no two rows share a name. The compiler checks the rest: a content row
// with no entry, an entry with no row, and an entry on a stage or a hook point with no signature yet fail to compile
// (tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts).
// Since P1-19m the items' registry (src/engine/rules/the-registry-of-magic-item-effects.ts) is held to the same: each
// effect once in its stage's order (THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS), each order naming only entries with an
// effect there, each content row with its entry and each entry with its row; each unit a row reaches is a unit type,
// the realm it needs an alignment, and no two rows share a name. Since P1-19u the spells' registry
// (src/engine/rules/the-registry-of-spell-effects.ts) is held to the same: each effect once in its stage's order
// (THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS), each order naming only entries with an effect there, each content row with
// its entry and each entry with its row; each row's name is a spell of SPELL_DEFS_P and its fn that spell's, and no two
// rows share a name.
// Level 1 (unit): it reads the registry's values (its effects and orders), which a syntax tree can't evaluate; the
// whole engine is imported first (tests/lib/the-whole-engine.ts). Planted: an entry left out of its order, one named
// twice, an order naming an entry with no effect at its stage, a row's unit that isn't a unit type (and a unit it
// reaches, or counts as), two rows' name; in the items' registry, an entry left out of its order, an order naming an
// entry with no effect at its stage, a row with no entry, a unit reached that isn't a unit type, a realm's alignment
// that isn't one, two rows' name; in the spells' registry, an entry left out of its order, a row with no entry, a
// row's name that is no spell, a row's fn that isn't its spell's, two rows' name.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { KC_ALIGNMENTS, KC_UNIT_TYPE, SPELL_DEFS_P } from '../../src/content/kingdoms-call-data.ts';
import { SPELL_EFFECTS_THE_REGISTRY_HOLDS } from '../../src/content/spell-effects-their-names-numbers-and-words.ts';
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS } from '../../src/content/unit-abilities-their-names-numbers-and-words.ts';
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS } from '../../src/content/magic-item-effects-their-names-numbers-and-words.ts';
import {
  THE_ORDER_OF_EACH_STAGE,
  THE_REGISTRY_OF_UNIT_ABILITIES,
} from '../../src/engine/rules/the-registry-of-content-effects.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS,
  THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS,
} from '../../src/engine/rules/the-registry-of-magic-item-effects.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS,
  THE_REGISTRY_OF_SPELL_EFFECTS,
} from '../../src/engine/rules/the-registry-of-spell-effects.ts';

/** The registry as this test reads it: each entry's effects by hook point and stage, and each stage's order. */
type Entries = Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, unknown>>>>>>;
type Orders = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
/** A content row as this test reads it (a unit as any string, so a planted row may name one that isn't a unit type). */
type Rows = Readonly<
  Record<
    string,
    {
      readonly unit: string;
      readonly name: string;
      readonly counts?: readonly string[];
      readonly reaches?: string | readonly string[];
      readonly countsAs?: string;
    }
  >
>;

/** An item's effect row as this test reads it (a unit reached, or a realm, as any string, so a planted row may name one
 *  that isn't). */
type ItemRows = Readonly<
  Record<
    string,
    { readonly name: string; readonly reaches?: string | readonly string[]; readonly forARealmThatIs?: string }
  >
>;

/** A spell's row as this test reads it (its name and fn as any string, so a planted row may name one that isn't). */
type SpellRows = Readonly<Record<string, { readonly name: string; readonly fn: string }>>;

const unitTypes: ReadonlySet<string> = new Set(Object.keys(KC_UNIT_TYPE));
/** The spells' fn, by any spell's name. */
const SPELLS: Readonly<Record<string, { readonly fn: string } | undefined>> = SPELL_DEFS_P;
const alignments: ReadonlySet<string> = new Set(KC_ALIGNMENTS);

/** What a unit ability's row breaks: its unit, each unit it counts or reaches, and the unit it counts as, each a unit
 *  type. */
function whatAUnitAbilitysRowBreaks(slug: string, row: Rows[string]): string[] {
  const broken: string[] = [];
  if (!unitTypes.has(row.unit)) broken.push(`${slug}'s unit, ${row.unit}, is not a unit type`);
  for (const u of row.counts ?? []) if (!unitTypes.has(u)) broken.push(`${slug} counts ${u}, not a unit type`);
  if (typeof row.reaches === 'object')
    for (const u of row.reaches) if (!unitTypes.has(u)) broken.push(`${slug} reaches ${u}, not a unit type`);
  if (row.countsAs !== undefined && !unitTypes.has(row.countsAs))
    broken.push(`${slug} counts as ${row.countsAs}, not a unit type`);
  return broken;
}

/** What an item's effect row breaks: each unit it reaches a unit type, and the realm it needs an alignment. */
function whatAnItemEffectsRowBreaks(slug: string, row: ItemRows[string]): string[] {
  const broken: string[] = [];
  if (typeof row.reaches === 'object')
    for (const u of row.reaches) if (!unitTypes.has(u)) broken.push(`${slug} reaches ${u}, not a unit type`);
  if (row.forARealmThatIs !== undefined && !alignments.has(row.forARealmThatIs))
    broken.push(`${slug} needs a realm that is ${row.forARealmThatIs}, not an alignment`);
  return broken;
}

/** What a spell's row breaks: its name a spell of SPELL_DEFS_P, and its fn that spell's. */
function whatASpellsRowBreaks(slug: string, row: SpellRows[string]): string[] {
  const spell = SPELLS[row.name];
  if (!spell) return [`${slug}'s name, ${row.name}, is no spell`];
  return spell.fn === row.fn ? [] : [`${slug}'s fn, ${row.fn}, is not ${row.name}'s (${spell.fn})`];
}

/** What the registry breaks, one line each: an empty list when it holds each effect once in its stage's order. */
function whatTheRegistryBreaks<Row extends { readonly name: string }>(
  entries: Entries,
  orders: Orders,
  rows: Readonly<Record<string, Row>>,
  whatARowBreaks: (slug: string, row: Row) => string[],
): string[] {
  const broken: string[] = [];
  for (const [slug, hooks] of Object.entries(entries)) {
    for (const [hook, stages] of Object.entries(hooks)) {
      for (const [stage, effect] of Object.entries(stages)) {
        if (typeof effect !== 'function') broken.push(`${slug} names a ${typeof effect} at ${hook}: ${stage}`);
        const times = (orders[hook]?.[stage] ?? []).filter((s) => s === slug).length;
        if (times !== 1) broken.push(`${slug} is in the order of ${hook}: ${stage} ${String(times)} times`);
      }
    }
  }
  for (const [hook, stages] of Object.entries(orders)) {
    for (const [stage, order] of Object.entries(stages)) {
      for (const slug of new Set(order)) {
        if (typeof entries[slug]?.[hook]?.[stage] !== 'function')
          broken.push(`the order of ${hook}: ${stage} names ${slug}, which has no effect there`);
      }
    }
  }
  const names = new Map<string, string>();
  for (const [slug, row] of Object.entries(rows)) {
    broken.push(...whatARowBreaks(slug, row));
    const other = names.get(row.name);
    if (other) broken.push(`${slug} and ${other} share the name ${row.name}`);
    names.set(row.name, slug);
    if (!(slug in entries)) broken.push(`${slug} has a content row and no entry`);
  }
  for (const slug of Object.keys(entries)) if (!(slug in rows)) broken.push(`${slug} has an entry and no content row`);
  return broken;
}

const ENTRIES: Entries = THE_REGISTRY_OF_UNIT_ABILITIES;
const ORDERS: Orders = THE_ORDER_OF_EACH_STAGE;
const ROWS: Rows = UNIT_ABILITIES_THE_REGISTRY_HOLDS;
const THE_WHOLE_FORCE = THE_ORDER_OF_EACH_STAGE.strength['the whole force'];
const MEETS = THE_ORDER_OF_EACH_STAGE.strength['what a unit does to the unit it meets'];
const UNITS = (entries: Entries, orders: Orders, rows: Rows) =>
  whatTheRegistryBreaks(entries, orders, rows, whatAUnitAbilitysRowBreaks);
const ITEM_ENTRIES: Entries = THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS;
const ITEM_ORDERS: Orders = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS;
const ITEM_ROWS: ItemRows = MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS;
const THE_COMMANDERS_ITEMS = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.strength["the commander's items"];
const ITEMS = (entries: Entries, orders: Orders, rows: ItemRows) =>
  whatTheRegistryBreaks(entries, orders, rows, whatAnItemEffectsRowBreaks);
const SPELL_ENTRIES: Entries = THE_REGISTRY_OF_SPELL_EFFECTS;
const SPELL_ORDERS: Orders = THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS;
const SPELL_ROWS: SpellRows = SPELL_EFFECTS_THE_REGISTRY_HOLDS;
const SPELLS_CAST = THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS.strength['a battle spell is cast before the battle'];
const SPELLS_REGISTRY = (entries: Entries, orders: Orders, rows: SpellRows) =>
  whatTheRegistryBreaks(entries, orders, rows, whatASpellsRowBreaks);

test('the registry holds each effect once, in the order of its stage, and each content row is sound', () => {
  expect(UNITS(ENTRIES, ORDERS, ROWS)).toEqual([]);
  expect(Object.keys(ENTRIES).length).toBeGreaterThan(0);
  // Every entry acts at some stage: each is in a stage's order.
  const ordered = new Set(Object.values(ORDERS).flatMap((stages) => Object.values(stages).flat()));
  expect([...ordered].sort()).toEqual(Object.keys(ENTRIES).sort());
});

test.for([
  [
    'an entry left out of its order',
    {
      ...ORDERS,
      strength: { ...ORDERS['strength'], 'the whole force': THE_WHOLE_FORCE.filter((s) => s !== 'wyrmscale') },
    },
    ['wyrmscale is in the order of strength: the whole force 0 times'],
  ],
  [
    'an entry named twice in its order',
    { ...ORDERS, strength: { ...ORDERS['strength'], 'the whole force': [...THE_WHOLE_FORCE, 'reaver-crews'] } },
    ['reaver-crews is in the order of strength: the whole force 2 times'],
  ],
  [
    'an order naming an entry with no effect at its stage',
    {
      ...ORDERS,
      strength: { ...ORDERS['strength'], 'what a unit does to the unit it meets': [...MEETS, 'wyrmscale'] },
    },
    ['the order of strength: what a unit does to the unit it meets names wyrmscale, which has no effect there'],
  ],
] as const)('planted, %s, is found', ([, orders, found]) => {
  expect(UNITS(ENTRIES, orders, ROWS)).toEqual(found);
});

test('planted, a content row whose unit is no unit type, units reached and counted as that are none, and two rows of one name, are found', () => {
  const rows: Rows = {
    ...ROWS,
    wyrmscale: { ...UNIT_ABILITIES_THE_REGISTRY_HOLDS.wyrmscale, unit: 'Planted Wyrms' },
    'tidal-might': { ...UNIT_ABILITIES_THE_REGISTRY_HOLDS['tidal-might'], name: 'Deepwater Grasp' },
    'hold-the-gate': {
      ...UNIT_ABILITIES_THE_REGISTRY_HOLDS['hold-the-gate'],
      reaches: ['Orc Garrison', 'Planted Gate'],
    },
    'town-watch': { ...UNIT_ABILITIES_THE_REGISTRY_HOLDS['town-watch'], countsAs: 'Planted Levies' },
  };
  expect(UNITS(ENTRIES, ORDERS, rows)).toEqual([
    'deepwater-grasp and tidal-might share the name Deepwater Grasp',
    "wyrmscale's unit, Planted Wyrms, is not a unit type",
    'hold-the-gate reaches Planted Gate, not a unit type',
    'town-watch counts as Planted Levies, not a unit type',
  ]);
});

test("the items' registry holds each effect once, in the order of its stage, and each content row is sound", () => {
  expect(ITEMS(ITEM_ENTRIES, ITEM_ORDERS, ITEM_ROWS)).toEqual([]);
  expect(Object.keys(ITEM_ENTRIES).length).toBeGreaterThan(0);
  const ordered = new Set(Object.values(ITEM_ORDERS).flatMap((stages) => Object.values(stages).flat()));
  expect([...ordered].sort()).toEqual(Object.keys(ITEM_ENTRIES).sort());
});

test.for([
  [
    'an entry left out of its order',
    {
      ...ITEM_ORDERS,
      strength: {
        ...ITEM_ORDERS['strength'],
        "the commander's items": THE_COMMANDERS_ITEMS.filter((s) => s !== 'chalice-of-dawn'),
      },
    },
    ["chalice-of-dawn is in the order of strength: the commander's items 0 times"],
  ],
  [
    'an order naming an entry with no effect at its stage',
    {
      ...ITEM_ORDERS,
      strength: {
        ...ITEM_ORDERS['strength'],
        "the commander's items": [...THE_COMMANDERS_ITEMS, 'land-units-at-full-strength-at-sea'],
      },
    },
    [
      "the order of strength: the commander's items names land-units-at-full-strength-at-sea, which has no effect there",
    ],
  ],
] as const)("planted in the items' registry, %s, is found", ([, orders, found]) => {
  expect(ITEMS(ITEM_ENTRIES, orders, ITEM_ROWS)).toEqual(found);
});

test("planted in the items' registry, a row with no entry, a unit reached that is none, a realm's alignment that is none, and two rows of one name, are found", () => {
  const rows: ItemRows = {
    ...ITEM_ROWS,
    'cavalry-bonus': {
      ...MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS['cavalry-bonus'],
      reaches: ['Free Lances', 'Planted Horse'],
    },
    'chalice-of-dawn': { ...MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS['chalice-of-dawn'], forARealmThatIs: 'Planted' },
    'heavy-bonus': { ...MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS['heavy-bonus'], name: 'Golden Spur' },
    'planted-effect': { name: 'Planted Effect' },
  };
  expect(ITEMS(ITEM_ENTRIES, ITEM_ORDERS, rows)).toEqual([
    'cavalry-bonus reaches Planted Horse, not a unit type',
    'heavy-bonus and cavalry-bonus share the name Golden Spur',
    'chalice-of-dawn needs a realm that is Planted, not an alignment',
    'planted-effect has a content row and no entry',
  ]);
});

test("the spells' registry holds each effect once, in the order of its stage, and each content row is sound", () => {
  expect(SPELLS_REGISTRY(SPELL_ENTRIES, SPELL_ORDERS, SPELL_ROWS)).toEqual([]);
  expect(Object.keys(SPELL_ENTRIES).length).toBeGreaterThan(0);
  const ordered = new Set(Object.values(SPELL_ORDERS).flatMap((stages) => Object.values(stages).flat()));
  expect([...ordered].sort()).toEqual(Object.keys(SPELL_ENTRIES).sort());
});

test("planted in the spells' registry, an entry left out of its order, a row with no entry, a name that is no spell, a fn that isn't its spell's, and two rows of one name, are found", () => {
  const orders: Orders = {
    ...SPELL_ORDERS,
    strength: {
      ...SPELL_ORDERS['strength'],
      'a battle spell is cast before the battle': SPELLS_CAST.filter((s) => s !== 'curse'),
    },
  };
  const rows: SpellRows = {
    ...SPELL_ROWS,
    fireball: { ...SPELL_EFFECTS_THE_REGISTRY_HOLDS.fireball, name: 'Planted Fireball' },
    spiritwrack: { ...SPELL_EFFECTS_THE_REGISTRY_HOLDS.spiritwrack, fn: 'white_planted' },
    'holy-symbol': { ...SPELL_EFFECTS_THE_REGISTRY_HOLDS['holy-symbol'], name: 'Curse', fn: 'necromancy_curse' },
    'planted-spell': { name: 'Resurrect', fn: 'white_resurrect' },
  };
  expect(SPELLS_REGISTRY(SPELL_ENTRIES, orders, rows)).toEqual([
    'curse is in the order of strength: a battle spell is cast before the battle 0 times',
    "fireball's name, Planted Fireball, is no spell",
    'holy-symbol and curse share the name Curse',
    "spiritwrack's fn, white_planted, is not Spiritwrack's (white_spiritwrack)",
    'planted-spell has a content row and no entry',
  ]);
});
