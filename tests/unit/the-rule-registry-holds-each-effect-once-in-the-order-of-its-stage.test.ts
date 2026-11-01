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
// rows share a name. Since P1-19y each stage of "orderValidity" (the Cast Spell order's checks) holds the spells whose
// row sets its flag (`asAnOrder`), and no other, so a flag and its entry can't part. Since P1-19aa the discoveries'
// registry (src/engine/rules/the-registry-of-discovery-effects.ts) is held to the same: each effect once in its stage's
// order (THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES), each order naming only entries with an effect there, each content
// row (a kind of effect) with its entry and each entry with its row; each row's kind is a kind of an effect of
// SAGE_DISCOVERIES_P, and no two rows share a kind; and every kind of SAGE_DISCOVERIES_P has its row or is listed as
// not yet taken (THE_KINDS_NOT_YET_TAKEN, which each row of the family shortens, to none), so a kind added to content
// with no entry is found. Since P1-19ai the guardian perks' registry (src/engine/rules/the-registry-of-guardian-perks.ts)
// is held to the same: each effect once in its stage's order (THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS), each order
// naming only entries with an effect there, each content row (a kind of perk) with its entry and each entry with its
// row; each row's kind is a kind of a perk of MONSTERS_P, no two rows share a kind, and every kind of MONSTERS_P has its
// row; a row names the items' effect of its own ward or rider exactly when an item carries it; and an entry with no
// stage is a kind whose row names the items' effect, or one listed as still read inline (THE_PERKS_STILL_READ_INLINE,
// which P1-19aj emptied), and no listed kind has a stage.
// Level 1 (unit): it reads the registry's values (its effects and orders), which a syntax tree can't evaluate; the
// whole engine is imported first (tests/lib/the-whole-engine.ts). Planted: an entry left out of its order, one named
// twice, an order naming an entry with no effect at its stage, a row's unit that isn't a unit type (and a unit it
// reaches, or counts as), two rows' name; in the items' registry, an entry left out of its order, an order naming an
// entry with no effect at its stage, a row with no entry, a unit reached that isn't a unit type, a realm's alignment
// that isn't one, two rows' name; in the spells' registry, an entry left out of its order, a row with no entry, a
// row's name that is no spell, a row's fn that isn't its spell's, two rows' name, a flag of the order's checks with
// no entry and an entry with no flag; in the discoveries' registry, an entry left out of its order, a row with no
// entry, a row's kind no discovery has, two rows of one kind, a kind of content with no row and not listed, and a kind
// listed that has a row; in the guardian perks', an entry left out of its order, a row with no entry, a kind no perk
// has, two rows of one kind, a row naming another kind's item effect, a shared kind naming none, an own kind naming
// one, a kind of content with no row, an entry with no stage unlisted, and a kind listed with a stage.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import {
  KC_ALIGNMENTS,
  KC_UNIT_TYPE,
  MONSTERS_P,
  SAGE_DISCOVERIES_P,
  SPELL_DEFS_P,
} from '../../src/content/kingdoms-call-data.ts';
import { GUARDIAN_PERKS_THE_REGISTRY_HOLDS } from '../../src/content/guardian-perks-their-kinds-numbers-and-words.ts';
import { DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS } from '../../src/content/discovery-effects-their-kinds-numbers-and-words.ts';
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
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES,
  THE_REGISTRY_OF_DISCOVERY_EFFECTS,
} from '../../src/engine/rules/the-registry-of-discovery-effects.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS,
  THE_REGISTRY_OF_GUARDIAN_PERKS,
} from '../../src/engine/rules/the-registry-of-guardian-perks.ts';

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

/** Each stage of the Cast Spell order's checks, by the flag of a spell's row (`asAnOrder`) it reads (plan P1-19y). */
const THE_FLAG_OF_EACH_CHECK = {
  'a charmed hero will not turn it on his lord': 'aCharmedHeroWillNotTurnItOnHisLord',
  'a spell that costs no casting slot': 'aGrandCathedralFreesItsSlot',
  "a spell's mark must stand in the province": 'itsMarkMustStandInTheProvince',
  'a cloaked mark is shielded from it': 'aCloakedMarkIsShieldedFromIt',
  'a Bless ward may turn it aside': 'aBlessWardMayTurnItAside',
} as const;
/** A spell's row as the order's checks read it (its flags by any name, so a planted row may set one or not). */
type ARowsFlags = Readonly<
  Record<string, { readonly name: string; readonly asAnOrder?: Readonly<Partial<Record<string, true>>> }>
>;
/** Where a stage of the order's checks and the rows' flags part: a spell whose row sets the flag and is not in the
 *  stage's order, or one in the order whose row doesn't set it. */
const whereTheChecksAndTheFlagsPart = (orders: Orders, rows: ARowsFlags) =>
  Object.entries(THE_FLAG_OF_EACH_CHECK).flatMap(([stage, flag]) => {
    const ordered = orders['orderValidity']?.[stage] ?? [];
    const flagged = Object.keys(rows).filter((slug) => rows[slug]?.asAnOrder?.[flag] === true);
    return [
      ...flagged.filter((slug) => !ordered.includes(slug)).map((slug) => `${slug} sets ${flag}, not in ${stage}`),
      ...ordered.filter((slug) => !flagged.includes(slug)).map((slug) => `${slug} is in ${stage}, not setting ${flag}`),
    ];
  });

test("each of the Cast Spell order's checks holds the spells whose row sets its flag, and no other", () => {
  expect(Object.keys(SPELL_ORDERS['orderValidity'] ?? {}).sort()).toEqual(Object.keys(THE_FLAG_OF_EACH_CHECK).sort());
  expect(whereTheChecksAndTheFlagsPart(SPELL_ORDERS, SPELL_EFFECTS_THE_REGISTRY_HOLDS)).toEqual([]);
});

test("planted, a flag of the order's checks with no entry, and an entry with no flag, are found", () => {
  const rows: ARowsFlags = {
    ...SPELL_EFFECTS_THE_REGISTRY_HOLDS,
    flood: { name: 'Flood', asAnOrder: {} },
    oratory: {
      name: 'Oratory',
      asAnOrder: { itsMarkMustStandInTheProvince: true, aCloakedMarkIsShieldedFromIt: true },
    },
  };
  expect(whereTheChecksAndTheFlagsPart(SPELL_ORDERS, rows)).toEqual([
    'oratory sets aCloakedMarkIsShieldedFromIt, not in a cloaked mark is shielded from it',
    'flood is in a Bless ward may turn it aside, not setting aBlessWardMayTurnItAside',
  ]);
});

/** A kind of discovery effect's row as this test reads it (its kind as any string, so a planted row may name one that
 *  no discovery has). */
type DiscoveryRows = Readonly<Record<string, { readonly kind: string }>>;

/** Every kind of effect SAGE_DISCOVERIES_P's rows name (`effect` and `effect2`). */
const THE_KINDS_IN_CONTENT: ReadonlySet<string> = new Set(
  SAGE_DISCOVERIES_P.flatMap((d): readonly { readonly kind?: string }[] => [
    ...('effect' in d ? [d.effect] : []),
    ...('effect2' in d ? [d.effect2] : []),
  ]).flatMap((e) => (e.kind === undefined ? [] : [e.kind])),
);

/** The kinds of SAGE_DISCOVERIES_P the discoveries' registry hasn't taken yet: each row of the family took its own off
 *  (plan P1-19's discoveries family, rows ab to ah), to none. */
const THE_KINDS_NOT_YET_TAKEN: readonly string[] = [];

/** What a kind's row breaks: its kind a kind of an effect of SAGE_DISCOVERIES_P. */
function whatADiscoveryKindsRowBreaks(slug: string, row: { readonly name: string }): string[] {
  return THE_KINDS_IN_CONTENT.has(row.name) ? [] : [`${slug}'s kind, ${row.name}, is no discovery's`];
}

/** Where the kinds of content and the rows part: a kind with no row that isn't listed as not yet taken, and a kind
 *  listed that has a row. */
const whereTheKindsAndTheRowsPart = (rows: DiscoveryRows, notYetTaken: readonly string[]) => {
  const taken = new Set(Object.values(rows).map((row) => row.kind));
  return [
    ...[...THE_KINDS_IN_CONTENT]
      .filter((kind) => !taken.has(kind) && !notYetTaken.includes(kind))
      .map((kind) => `${kind} has no row and isn't listed as not yet taken`),
    ...notYetTaken.filter((kind) => taken.has(kind)).map((kind) => `${kind} is listed as not yet taken, and has a row`),
  ];
};

const DISCOVERY_ENTRIES: Entries = THE_REGISTRY_OF_DISCOVERY_EFFECTS;
const DISCOVERY_ORDERS: Orders = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES;
const DISCOVERY_ROWS: DiscoveryRows = DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS;
/** The registry's rows by their kind, as the shared check reads a row's name (no two may share one). */
const byTheirKind = (rows: DiscoveryRows) =>
  Object.fromEntries(Object.entries(rows).map(([slug, row]) => [slug, { name: row.kind }]));
const DISCOVERIES_REGISTRY = (entries: Entries, orders: Orders, rows: DiscoveryRows) =>
  whatTheRegistryBreaks(entries, orders, byTheirKind(rows), whatADiscoveryKindsRowBreaks);

test("the discoveries' registry holds each effect once, in the order of its stage, and each content row is sound", () => {
  expect(DISCOVERIES_REGISTRY(DISCOVERY_ENTRIES, DISCOVERY_ORDERS, DISCOVERY_ROWS)).toEqual([]);
  expect(Object.keys(DISCOVERY_ENTRIES).length).toBeGreaterThan(0);
  const ordered = new Set(Object.values(DISCOVERY_ORDERS).flatMap((stages) => Object.values(stages).flat()));
  expect([...ordered].sort()).toEqual(Object.keys(DISCOVERY_ENTRIES).sort());
});

test("every kind of the discoveries' effects has its row in the registry's content, or is listed as not yet taken", () => {
  expect(THE_KINDS_IN_CONTENT.size).toBe(58);
  expect(whereTheKindsAndTheRowsPart(DISCOVERY_ROWS, THE_KINDS_NOT_YET_TAKEN)).toEqual([]);
});

test("planted in the discoveries' registry, an entry left out of its order, a row with no entry, a kind no discovery has, two rows of one kind, a kind with no row unlisted, and a kind listed with a row, are found", () => {
  const orders: Orders = {
    ...DISCOVERY_ORDERS,
    strength: { ...DISCOVERY_ORDERS['strength'], "a realm's discoveries add to a siege": [] },
  };
  // every kind has its row since P1-19ah, so a row with no entry whose kind is a discovery's is Messenger Birds' row
  // under another slug (its entry left with no row), and the planted list names its kind
  const withoutMessengerBirds: DiscoveryRows = Object.fromEntries(
    Object.entries(DISCOVERY_ROWS).filter(([slug]) => slug !== 'messenger-birds'),
  );
  const rows: DiscoveryRows = {
    ...withoutMessengerBirds,
    fanaticism: { kind: 'plantedFervour' },
    casting: { kind: 'siege' },
    'planted-kind': { kind: 'extendedIntel' },
  };
  expect(DISCOVERIES_REGISTRY(DISCOVERY_ENTRIES, orders, rows)).toEqual([
    "siegecraft is in the order of strength: a realm's discoveries add to a siege 0 times",
    "fanaticism's kind, plantedFervour, is no discovery's",
    'casting and siegecraft share the name siege',
    'planted-kind has a content row and no entry',
    'messenger-birds has an entry and no content row',
  ]);
  expect(whereTheKindsAndTheRowsPart(rows, ['extendedIntel'])).toEqual([
    "cast has no row and isn't listed as not yet taken",
    "fanatic has no row and isn't listed as not yet taken",
    'extendedIntel is listed as not yet taken, and has a row',
  ]);
  // a kind's row taken away, and the kind left off the list
  expect(whereTheKindsAndTheRowsPart(withoutMessengerBirds, THE_KINDS_NOT_YET_TAKEN)).toEqual([
    "extendedIntel has no row and isn't listed as not yet taken",
  ]);
});

/** A kind of perk's row as this test reads it (its ward or rider and the items' effect it names as any string, so a
 *  planted row may name one no perk has, or another kind's effect). */
type PerkRows = Readonly<
  Record<
    string,
    {
      readonly carriedAs: { readonly ward: string } | { readonly rider: string };
      readonly theItemsEffectItReaches?: string;
    }
  >
>;

/** A kind of perk as MONSTERS_P writes it: its `fx.ward`, or its rider's key. */
const aPerksKind = (fx: Readonly<Record<string, unknown>>): string =>
  typeof fx['ward'] === 'string' ? fx['ward'] : (Object.keys(fx)[0] ?? '');
/** A row's kind: its ward, or its rider. */
const aRowsKind = (carriedAs: PerkRows[string]['carriedAs']): string =>
  'ward' in carriedAs ? carriedAs.ward : carriedAs.rider;

/** Every kind of perk MONSTERS_P's guardians carry. */
const THE_PERKS_KINDS_IN_CONTENT: ReadonlySet<string> = new Set(
  MONSTERS_P.flatMap((guardian) => guardian.passives.map((perk) => aPerksKind(perk.fx))),
);

/** The items' effects by the ward or rider they are carried as (the items' rows' `carriedAs`). */
const THE_ITEMS_EFFECT_OF_EACH_WARD_AND_RIDER: ReadonlyMap<string, string> = new Map(
  Object.entries(MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS).flatMap(([slug, row]): [string, string][] => {
    const carriedAs: Readonly<Record<string, unknown>> = row.carriedAs;
    const key = carriedAs['ward'] ?? carriedAs['rider'];
    return typeof key === 'string' ? [[key, slug]] : [];
  }),
);

/** The kinds of perk whose effect is still read inline, with no stage in the registry and no items' effect: none since
 *  P1-19aj took the guardian's own wards (the stun ward, the lingering-harm ward, the ward against one school). */
const THE_PERKS_STILL_READ_INLINE: readonly string[] = [];

/** What a perk kind's row breaks: its kind a kind of a perk of MONSTERS_P, and the items' effect it names that of its
 *  own ward or rider, exactly when an item carries it. */
function whatAPerkKindsRowBreaks(rows: PerkRows) {
  return (slug: string, row: { readonly name: string }): string[] => {
    const broken = THE_PERKS_KINDS_IN_CONTENT.has(row.name) ? [] : [`${slug}'s kind, ${row.name}, is no perk's`];
    const named = rows[slug]?.theItemsEffectItReaches;
    const itsOwn = THE_ITEMS_EFFECT_OF_EACH_WARD_AND_RIDER.get(row.name);
    if (named !== itsOwn) broken.push(`${slug} names ${named ?? 'no item effect'}, not ${itsOwn ?? 'none'}`);
    return broken;
  };
}

/** Where the entries with no stage and the list part: an entry with no stage whose row names no items' effect and that
 *  isn't listed, and a kind listed that has a stage or names an items' effect. Then every kind of content with no row. */
const whereTheStagesAndTheListPart = (entries: Entries, rows: PerkRows, stillInline: readonly string[]) => [
  ...Object.entries(entries)
    .filter(
      ([slug, hooks]) =>
        Object.keys(hooks).length === 0 &&
        rows[slug]?.theItemsEffectItReaches === undefined &&
        !stillInline.includes(slug),
    )
    .map(([slug]) => `${slug} has no stage, names no item effect, and isn't listed as still read inline`),
  ...stillInline
    .filter((slug) => Object.keys(entries[slug] ?? {}).length > 0 || rows[slug]?.theItemsEffectItReaches !== undefined)
    .map((slug) => `${slug} is listed as still read inline, and has a stage or an item effect`),
  ...[...THE_PERKS_KINDS_IN_CONTENT]
    .filter((kind) => !Object.values(rows).some((row) => aRowsKind(row.carriedAs) === kind))
    .map((kind) => `${kind} has no row`),
];

const PERK_ENTRIES: Entries = THE_REGISTRY_OF_GUARDIAN_PERKS;
const PERK_ORDERS: Orders = THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS;
const PERK_ROWS: PerkRows = GUARDIAN_PERKS_THE_REGISTRY_HOLDS;
const PERKS_REGISTRY = (entries: Entries, orders: Orders, rows: PerkRows) =>
  whatTheRegistryBreaks(
    entries,
    orders,
    Object.fromEntries(Object.entries(rows).map(([slug, row]) => [slug, { name: aRowsKind(row.carriedAs) }])),
    whatAPerkKindsRowBreaks(rows),
  );

test("the guardian perks' registry holds each effect once, in the order of its stage, and each content row is sound", () => {
  expect(PERKS_REGISTRY(PERK_ENTRIES, PERK_ORDERS, PERK_ROWS)).toEqual([]);
  expect(Object.keys(PERK_ENTRIES)).toHaveLength(17);
});

test("every kind of the guardians' perks has its row, and an entry with no stage names the items' effect or is listed as still read inline", () => {
  expect(THE_PERKS_KINDS_IN_CONTENT.size).toBe(17);
  expect(whereTheStagesAndTheListPart(PERK_ENTRIES, PERK_ROWS, THE_PERKS_STILL_READ_INLINE)).toEqual([]);
});

test("planted in the guardian perks' registry, an entry left out of its order, a row with no entry, a kind no perk has, two rows of one kind, a wrong item effect, and the list's two partings, are found", () => {
  const orders: Orders = {
    ...PERK_ORDERS,
    personalCombat: { ...PERK_ORDERS['personalCombat'], "a guardian's perks: what his card turns": ['a-tough-hide'] },
  };
  const withoutThorns: PerkRows = Object.fromEntries(Object.entries(PERK_ROWS).filter(([slug]) => slug !== 'thorns'));
  const rows: PerkRows = {
    ...withoutThorns,
    'hard-to-hit': { carriedAs: { ward: 'plantedDodge' } },
    'a-dread-aura': { carriedAs: { rider: 'burn' }, theItemsEffectItReaches: 'burn-rider' },
    'a-keen-eye': { carriedAs: { rider: 'hitBonus' }, theItemsEffectItReaches: 'damage-bonus-rider' },
    'a-stun-ward': { carriedAs: { ward: 'stunWard' }, theItemsEffectItReaches: 'stun-immunity' },
    'planted-perk': { carriedAs: { ward: 'thorns' } },
  };
  expect(PERKS_REGISTRY(PERK_ENTRIES, orders, rows)).toEqual([
    "spell-resistance is in the order of personalCombat: a guardian's perks: what his card turns 0 times",
    "arrow-proof is in the order of personalCombat: a guardian's perks: what his card turns 0 times",
    'a-stun-ward names stun-immunity, not none',
    "hard-to-hit's kind, plantedDodge, is no perk's",
    'a-keen-eye names damage-bonus-rider, not hit-bonus-rider',
    'a-fire-or-frost-aura and a-dread-aura share the name burn',
    'planted-perk names no item effect, not thorns',
    'planted-perk has a content row and no entry',
    'thorns has an entry and no content row',
  ]);
  // the guardian's own wards' stages taken away again, as before P1-19aj
  const withTheOwnWardsInline: Entries = {
    ...PERK_ENTRIES,
    'a-ward-against-one-school': {},
    'a-lingering-harm-ward': {},
  };
  expect(whereTheStagesAndTheListPart(withTheOwnWardsInline, rows, ['a-stun-ward', 'a-tough-hide'])).toEqual([
    "a-ward-against-one-school has no stage, names no item effect, and isn't listed as still read inline",
    "a-lingering-harm-ward has no stage, names no item effect, and isn't listed as still read inline",
    "hard-to-hit has no stage, names no item effect, and isn't listed as still read inline",
    // its row taken away (above)
    "thorns has no stage, names no item effect, and isn't listed as still read inline",
    'a-stun-ward is listed as still read inline, and has a stage or an item effect',
    'a-tough-hide is listed as still read inline, and has a stage or an item effect',
    'dodge has no row',
    'aura has no row',
  ]);
});
