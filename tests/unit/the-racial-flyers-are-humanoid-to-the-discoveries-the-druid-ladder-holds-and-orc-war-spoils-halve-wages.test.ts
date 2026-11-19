// 2026-09-27 (the maintainer's batch; the ruling R-065), with 2026-10-11 (the winged riders are soldiers of their race):
// - Item 1: the four racial flyers count as humanoid for the discoveries; beasts, fleets and skeletal companies do not.
//   The winged riders are no longer Creatures or Monsters, and a race-keyed discovery reaches them.
// - Item 2: Gyrocopters need no Druid; the winged riders need Druid 1, as racial troops; the Whale Cohort keeps 3; the
//   Druid 4 and 5 rungs, and humanoid foot at Druid 1, are as they were.
// - Items 8 and 9: the Orc war-spoils halving, as the wage pass runs it (the test's own copy, orcsWageBill: KD-410): the
//   reported 16g bill pays 8g and saves 8g; and on any bill, never below the 1g floor a company, never above the
//   undiscounted bill, a whole number, and never more than a gold off an exact half (unit by unit, the floor kept).
//
// Level 1 (unit): discUnitIs, discUnitMatch and getDruidLevel called on plain values, on the engine's modules
// (tests/lib/the-whole-engine.ts first); the halving as a property test (fast-check, seeded from KC_SEED as every
// property test is: tests/setup/fast-check.ts). Not lower: each is a computed answer. The property holds on every
// bill by construction, so the outcome is the same on every seed.
//
// Until plan P1-14z this was tests/druid-and-war-spoils.test.js, which cut the three files' tables and functions out
// of src/ by their syntax tree and ran them in a vm of its own, and tried 20,000 bills drawn from an unseeded
// Math.random. Its checks are here, one for one; the property tries the same 20,000 bills' worth, seeded. Its two
// printed figures (the worst deviation seen, and the old rule's bill on the reported case) were never checked, and are
// left out.
import '../lib/the-whole-engine.ts';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { getDruidLevel } from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import {
  discUnitIs,
  discUnitMatch,
} from '../../src/engine/rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';

const FLYERS = ['Eagle Riders', 'Noble Griffons', 'Gnomish Gyrocopters', 'Wyvern Riders'];
// 2026-10-13: the three renames
const BEASTS = [
  'Stone Giants',
  'Forest Ents',
  'Thunderbirds',
  'Cave Trolls',
  'Manticore Pride',
  'Basilisk Brood',
  'Sea Giants',
  'Eldritch Kraken',
  'Elder Dragons',
  'Crimson Rocs',
  'Titan Warbeasts',
  'Dread Hydras',
  'Whale Cohort',
];
const FLEETS = [
  'Galleon Fleet',
  'Corsair Fleet',
  'Elven Galleys',
  'Dwarf Ironclads',
  'Orcish Longships',
  'Whale Cohort',
];
const FOOT = [
  'Shieldwall Levies',
  'Free Lances',
  'Yeoman Longbows',
  'Gilded Lances',
  'Human Garrison',
  'Elven Bowmen',
  'Forest Wardens',
  'Shadow Archers',
  'Elven Garrison',
  'Dwarven Guard',
  'Ironwood Crossbows',
  'Mountain Guns',
  'Dwarf Garrison',
  'Warg Riders',
  'Orc Berserkers',
  'Goblin Horde',
  'Orc Garrison',
];

describe('item 1: the racial flyers count as humanoid; beasts and fleets still do not', () => {
  test.each(FLYERS)('flyer %s is humanoid', (unit) => {
    expect(discUnitIs('humanoid', unit, true)).toBe(true);
  });
  test.each(FOOT)('foot %s is humanoid', (unit) => {
    expect(discUnitIs('humanoid', unit, true)).toBe(true);
  });
  test.each(BEASTS.filter((unit) => !FLYERS.includes(unit)))('beast %s is not humanoid', (unit) => {
    expect(discUnitIs('humanoid', unit, true)).toBe(false);
  });
  test.each(FLEETS)('fleet %s is not humanoid', (unit) => {
    expect(discUnitIs('humanoid', unit, true)).toBe(false);
  });
  test('a skeletal company is not humanoid', () => {
    expect(discUnitIs('humanoid', { type: 'Shieldwall Levies', _isSkeletal: true })).toBe(false);
  });
  // 2026-10-11 (the maintainer, the winged riders are soldiers of their race): no longer Creatures or Monsters for the
  // Druid and alignment rules (they were, from 2026-09-27 to 2026-10-11).
  test('Eagle Riders and Noble Griffons are no longer Creatures', () => {
    expect(discUnitIs('creature', 'Eagle Riders', true)).toBe(false);
    expect(discUnitIs('creature', 'Noble Griffons', true)).toBe(false);
  });
  test('Wyvern Riders are no longer a Monster', () => {
    expect(discUnitIs('monster', 'Wyvern Riders', true)).toBe(false);
  });
  test('Orcish heritage (a race-keyed effect) reaches Wyvern Riders', () => {
    expect(discUnitMatch({ race: 'Orcish' }, { type: 'Wyvern Riders', race: 'Orcish' })).toBe(true);
  });
  test('an Elven humanoid creed reaches Eagle Riders', () => {
    expect(discUnitMatch({ cls: 'humanoid', race: 'Elven' }, { type: 'Eagle Riders', race: 'Elven' })).toBe(true);
  });
});

// 2026-10-11 (the maintainer): the three winged riders moved from Druid 3 to Druid 1, with the other racial troops; the
// Whale Cohort keeps 3.
describe('item 2: the Druid ladder', () => {
  test('Gyrocopters require Druid 0', () => {
    expect(getDruidLevel('Gnomish Gyrocopters')).toBe(0);
  });
  test('the winged riders require Druid 1, as racial troops', () => {
    expect(getDruidLevel('Eagle Riders')).toBe(1);
    expect(getDruidLevel('Wyvern Riders')).toBe(1);
    expect(getDruidLevel('Noble Griffons')).toBe(1);
  });
  test('Druid 3: the Whale Cohort', () => {
    expect(getDruidLevel('Whale Cohort')).toBe(3);
  });
  test('the Druid 4 and 5 rungs are unchanged', () => {
    expect(getDruidLevel('Cave Trolls')).toBe(4);
    expect(getDruidLevel('Elder Dragons')).toBe(5);
  });
  test('humanoid foot still needs Druid 1', () => {
    expect(getDruidLevel('Shieldwall Levies')).toBe(1);
  });
});

/** The Orc war-spoils halving, exactly as the wage pass runs it: each company's wage halved and rounded down, at least
 *  1g; the halves' fractions carried, and a whole gold added when they reach one. */
function orcsWageBill(costs: readonly number[]): { total: number; saved: number } {
  let frac = 0,
    total = 0,
    saved = 0;
  for (const w0 of costs) {
    const half = w0 * 0.5;
    let w = Math.floor(half);
    if (w < 1) {
      w = 1;
    } else {
      frac += half - w;
      if (frac >= 1 - 1e-9) {
        w += 1;
        frac -= 1;
      }
    }
    total += w;
    saved += w0 - w;
  }
  return { total, saved };
}

/** As many bills as the old script tried: 1 to 12 companies, each at 1g to 8g. */
const THE_BILLS_TRIED = 20_000;
/** A bill takes microseconds; 0.5 ms each is ample on a slow runner. */
const A_LIMIT_FOR_THE_BILLS = timeLimitForPropertyRuns(THE_BILLS_TRIED, 0.5).timeout;

describe('items 8 and 9: the Orc war-spoils halving', () => {
  test('the reported case: a 16g bill pays 8g and saves 8g', () => {
    expect(orcsWageBill([3, 3, 3, 3, 4])).toEqual({ total: 8, saved: 8 });
  });

  test(
    'on any bill: never below the 1g floor a company, never above the full wages, a whole number, and within a gold of an exact half',
    () => {
      fc.assert(
        fc.property(fc.array(fc.integer({ min: 1, max: 8 }), { minLength: 1, maxLength: 12 }), (costs) => {
          const full = costs.reduce((s, x) => s + x, 0);
          const { total } = orcsWageBill(costs);
          // Exact half, unit by unit, with the 1g-a-company floor the rule has always carried.
          const ideal = costs.reduce((s, w) => s + Math.max(1, w / 2), 0);
          expect(total, 'below the 1g floor').toBeGreaterThanOrEqual(costs.length);
          expect(total, 'charged more than full wages').toBeLessThanOrEqual(full);
          expect(Number.isInteger(total), 'a bill not in whole gold').toBe(true);
          expect(Math.abs(total - ideal), 'off an exact half by more than a gold').toBeLessThanOrEqual(1 + 1e-9);
        }),
        { numRuns: THE_BILLS_TRIED },
      );
    },
    A_LIMIT_FOR_THE_BILLS,
  );
});
