// The rule registry holds each effect once, in the order of its stage (plan P1-19, Decisions 2 and 3): every effect an
// entry names at a stage is in that stage's order exactly once, and each order names only entries with an effect at its
// stage (an effect left out of its order would never run; one named twice would run twice). Each content row's unit,
// each unit it counts, reaches or counts as, is a unit type, and no two rows share a name. The compiler checks the rest: a content row
// with no entry, an entry with no row, and an entry on a stage or a hook point with no signature yet fail to compile
// (tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts).
// Level 1 (unit): it reads the registry's values (its effects and orders), which a syntax tree can't evaluate; the
// whole engine is imported first (tests/lib/the-whole-engine.ts). Planted: an entry left out of its order, one named
// twice, an order naming an entry with no effect at its stage, a row's unit that isn't a unit type (and a unit it
// reaches, or counts as), two rows' name.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { KC_UNIT_TYPE } from '../../src/content/kingdoms-call-data.ts';
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS } from '../../src/content/unit-abilities-their-names-numbers-and-words.ts';
import {
  THE_ORDER_OF_EACH_STAGE,
  THE_REGISTRY_OF_UNIT_ABILITIES,
} from '../../src/engine/rules/the-registry-of-content-effects.ts';

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

/** What the registry breaks, one line each: an empty list when it holds each effect once in its stage's order. */
function whatTheRegistryBreaks(entries: Entries, orders: Orders, rows: Rows): string[] {
  const broken: string[] = [];
  const unitTypes = new Set(Object.keys(KC_UNIT_TYPE));
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
    if (!unitTypes.has(row.unit)) broken.push(`${slug}'s unit, ${row.unit}, is not a unit type`);
    for (const u of row.counts ?? []) if (!unitTypes.has(u)) broken.push(`${slug} counts ${u}, not a unit type`);
    if (typeof row.reaches === 'object')
      for (const u of row.reaches) if (!unitTypes.has(u)) broken.push(`${slug} reaches ${u}, not a unit type`);
    if (row.countsAs !== undefined && !unitTypes.has(row.countsAs))
      broken.push(`${slug} counts as ${row.countsAs}, not a unit type`);
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

test('the registry holds each effect once, in the order of its stage, and each content row is sound', () => {
  expect(whatTheRegistryBreaks(ENTRIES, ORDERS, ROWS)).toEqual([]);
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
  expect(whatTheRegistryBreaks(ENTRIES, orders, ROWS)).toEqual(found);
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
  expect(whatTheRegistryBreaks(ENTRIES, ORDERS, rows)).toEqual([
    'deepwater-grasp and tidal-might share the name Deepwater Grasp',
    "wyrmscale's unit, Planted Wyrms, is not a unit type",
    'hold-the-gate reaches Planted Gate, not a unit type',
    'town-watch counts as Planted Levies, not a unit type',
  ]);
});
