// 2026-10-13 (the maintainer, Creatures and Monsters II): three of the wild units are renamed or replaced: Giant Eagles
// become Thunderbirds (a different flying Creature: the elves already ride eagles), Kraken Tentacles become Eldritch
// Kraken, and Leviathan Pods become Dread Hydras (a land Monster of the same power). On the tables:
// - the data file's: each new name in PRIMAL_ARMY_DEFS_P at its strength, price and move (tests/lib/primal-decided.ts),
//   with at least 28 company names and one strike before the battle; the Thunderbirds fly and can be tamed, the Kraken
//   are a primal sea beast, the Hydras walk; and no old name is in any table;
// - the discoveries that named them (Angelic Hosts, Sky Kin, Whale Lore, Dragon Taming) are reworded and re-keyed, and
//   no discovery names an old one;
// - the engine's: a grid code for each new name and none for the old (UNIT_SHORT); no terrain row for an old name
//   (TERRAIN_MODS); both copies of the world's land pools (CREATURE_BY_TERRAIN and its copy CBT, MONSTER_BY_TERRAIN and
//   MBT) put the Thunderbirds where the Giant Eagles were and the Hydras in jungle and forest; the sea pass keys nothing
//   on the Leviathans, and a Kraken sea is still the race "Primal:Kraken".
//
// Level 1 (unit): the content's and the engine's tables imported (tests/lib/the-whole-engine.ts first); the land pools,
// which are local to generateNewGame, read from the GM page's source by their syntax tree (tests/lib/source.ts) and
// evaluated on their own; the sea pass read in the source's one layout. Not lower: the tables' agreement with the
// decided roster is a property of the data, and the pools are values. Nothing here reads the dice.
//
// Until plan P1-14z these were the table checks of tests/primal-renames.test.js, which ran the data file in a vm of its
// own. Each is here, or in its twin: each new name's type, Druid level, family and terrain row are checked for every
// live beast by tests/unit/the-engines-tables-give-each-beast-as-the-wild-roster-table-decides.test.ts. The script's
// checks on the booted GM page (the migration of a running game, the abilities, the master tables) are
// tests/page/the-gm-page-renames-a-running-games-wild-units-and-holds-their-abilities-and-prices.test.ts, which says why
// they stay there.
import '../lib/the-whole-engine.ts';
import vm from 'node:vm';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  KC_DRUID_LEVELS,
  KC_UNIT_BASE_STR,
  KC_UNIT_CLASS,
  KC_UNIT_TYPE,
  PRIMAL_ARMY_DEFS_P,
  PRIMAL_UNIT_NAMES,
  SAGE_DISCOVERIES_P,
} from '../../src/content/kingdoms-call-data.ts';
import { TERRAIN_MODS } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { UNIT_SHORT } from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import { LAND_TERRAINS, RENAMED, ROSTER, type WildUnitAsDecided } from '../lib/primal-decided.ts';
import { compactPage, pageInitializer } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const GM = 'kingdoms-call-gm-portal.html';
const OLD = Object.keys(RENAMED);
const NEW = [...new Set(Object.values(RENAMED))];

const theRosterRow = (unit: string): WildUnitAsDecided => {
  const row = ROSTER[unit];
  if (!row) throw new Error(`${unit}: not in the wild roster table`);
  return row;
};

// The content's and the engine's tables, read by any unit's name.
interface APrimalDefinition {
  readonly str: number;
  readonly cost: number;
  readonly speed: number;
  readonly spells?: readonly { readonly dmg: readonly number[] }[];
}
const THE_PRIMAL_DEFINITIONS: Readonly<Record<string, APrimalDefinition | undefined>> = PRIMAL_ARMY_DEFS_P;
const THE_COMPANY_NAMES: Readonly<Record<string, readonly string[] | undefined>> = PRIMAL_UNIT_NAMES;
const THE_CLASS_LISTS: Readonly<Record<string, readonly string[]>> = KC_UNIT_CLASS;
const THE_DRUID_LADDER: Readonly<Record<string, readonly string[] | undefined>> = KC_DRUID_LEVELS;
const THE_GRID_CODES: Readonly<Record<string, string | undefined>> = UNIT_SHORT;
const THE_TERRAIN_MULTIPLIERS: Readonly<Record<string, Readonly<Record<string, number | undefined>> | undefined>> =
  TERRAIN_MODS;
interface ADiscovery {
  readonly id: string;
  readonly desc?: string;
  readonly effect?: { readonly types?: readonly string[] };
}
const THE_DISCOVERIES: readonly ADiscovery[] = SAGE_DISCOVERIES_P;

/** The Druid level the data file's ladder asks of the unit (0 if it is on no rung). */
const druidOf = (unit: string) => {
  for (const [level, units] of Object.entries(THE_DRUID_LADDER)) if (units?.includes(unit)) return Number(level);
  return 0;
};

describe('the data file', () => {
  describe.each(NEW)('%s', (unit) => {
    const row = theRosterRow(unit);
    test(`in PRIMAL_ARMY_DEFS_P at ${String(row.cost)}g, strength ${String(row.str)}, move ${String(row.speed)}`, () => {
      const definition = THE_PRIMAL_DEFINITIONS[unit];
      expect(definition && { str: definition.str, cost: definition.cost, speed: definition.speed }).toEqual({
        str: row.str,
        cost: row.cost,
        speed: row.speed,
      });
    });
    test('at least 28 distinct company names, each reading "the …"', () => {
      const names = THE_COMPANY_NAMES[unit] ?? [];
      expect(names.length).toBeGreaterThanOrEqual(28);
      expect(new Set(names).size).toBe(names.length);
      expect(names.filter((name) => !name.startsWith('the '))).toEqual([]);
    });
    test('carries one strike before the battle', () => {
      const spells = THE_PRIMAL_DEFINITIONS[unit]?.spells ?? [];
      expect(spells.length).toBe(1);
      expect(spells[0]?.dmg[1]).toBeGreaterThan(0);
    });
  });

  test('Thunderbirds cross the sea on the wing and can be tamed; Giant Eagles no longer', () => {
    expect(KC_UNIT_CLASS.aerial).toContain('Thunderbirds');
    expect(KC_UNIT_CLASS.tamedFlyer).toContain('Thunderbirds');
    expect(KC_UNIT_CLASS.aerial).not.toContain('Giant Eagles');
    expect(KC_UNIT_CLASS.tamedFlyer).not.toContain('Giant Eagles');
  });

  test('the primal seas are Sea Giants and Eldritch Kraken', () => {
    expect(KC_UNIT_CLASS.primalSea.slice(0, 2)).toEqual(['Sea Giants', 'Eldritch Kraken']);
    expect(KC_UNIT_CLASS.sea).toContain('Eldritch Kraken');
    expect(KC_UNIT_CLASS.sea).not.toContain('Leviathan Pods');
  });

  test('Dread Hydras walk: neither a sea unit nor a flyer', () => {
    expect(KC_UNIT_CLASS.sea).not.toContain('Dread Hydras');
    expect(KC_UNIT_CLASS.primalSea).not.toContain('Dread Hydras');
    expect(KC_UNIT_CLASS.aerial).not.toContain('Dread Hydras');
  });

  test.each(OLD)('%s is in no table', (unit) => {
    const stillIn = [
      ...Object.entries(THE_CLASS_LISTS)
        .filter(([, units]) => units.includes(unit))
        .map(([list]) => list),
      ...(unit in KC_UNIT_TYPE ? ['KC_UNIT_TYPE'] : []),
      ...(unit in KC_UNIT_BASE_STR ? ['KC_UNIT_BASE_STR'] : []),
      ...(unit in PRIMAL_ARMY_DEFS_P ? ['PRIMAL_ARMY_DEFS_P'] : []),
      ...(unit in PRIMAL_UNIT_NAMES ? ['PRIMAL_UNIT_NAMES'] : []),
      ...(druidOf(unit) !== 0 ? ['KC_DRUID_LEVELS'] : []),
    ];
    expect(stillIn).toEqual([]);
  });
});

describe('the discoveries that named them', () => {
  const discovery = (id: string): ADiscovery => THE_DISCOVERIES.find((d) => d.id === id) ?? { id };
  const typesOf = (d: ADiscovery) => d.effect?.types ?? [];
  const textOf = (d: ADiscovery) => d.desc ?? '';

  test('the discoveries were read (more than 50)', () => {
    expect(THE_DISCOVERIES.length).toBeGreaterThan(50);
  });

  test('Angelic Hosts lifts Noble Griffons and Thunderbirds', () => {
    expect(typesOf(discovery('ad13')).join()).toBe('Noble Griffons,Thunderbirds');
    expect(textOf(discovery('ad13'))).toMatch(/Thunderbirds/);
    expect(textOf(discovery('ad13'))).not.toMatch(/Giant Eagles/);
  });

  test('Sky Kin lifts Thunderbirds and Crimson Rocs', () => {
    expect(typesOf(discovery('au13')).join()).toBe('Thunderbirds,Crimson Rocs');
    expect(textOf(discovery('au13'))).toMatch(/Thunderbirds/);
  });

  test('Whale Lore lifts the Whale Cohort and no Leviathan (the Great Turtles join it in Creatures and Monsters IV)', () => {
    expect(typesOf(discovery('au20'))).toContain('Whale Cohort');
    expect(typesOf(discovery('au20'))).not.toContain('Leviathan Pods');
    expect(textOf(discovery('au20'))).not.toMatch(/Leviathan/);
  });

  test('Dragon Taming names the Thunderbirds among the winged beasts', () => {
    expect(textOf(discovery('sd40'))).toMatch(/Thunderbirds/);
    expect(textOf(discovery('sd40'))).not.toMatch(/Giant Eagles/);
  });

  test('no discovery names an old name, in its effect or its text', () => {
    const naming = THE_DISCOVERIES.flatMap((d) =>
      OLD.filter((unit) => typesOf(d).includes(unit) || textOf(d).includes(unit)).map((unit) => `${d.id}: ${unit}`),
    );
    expect(naming).toEqual([]);
  });
});

describe("the engine's tables", () => {
  test('UNIT_SHORT has a grid code for each new name and none for the old', () => {
    for (const unit of NEW) expect(THE_GRID_CODES[unit], unit).toMatch(/^[A-Za-z]{3,5}$/);
    for (const unit of OLD) expect(unit in UNIT_SHORT, unit).toBe(false);
  });

  test.each(OLD)('TERRAIN_MODS has no row for %s', (unit) => {
    expect(LAND_TERRAINS.filter((terrain) => Object.hasOwn(THE_TERRAIN_MULTIPLIERS[terrain] ?? {}, unit))).toEqual([]);
  });
});

describe("the world's land pools, both copies, and the sea pass", () => {
  type APool = Readonly<Record<string, readonly string[] | undefined>>;
  const isAPool = (value: unknown): value is APool =>
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((units) => Array.isArray(units) && units.every((u) => typeof u === 'string'));
  /** The value the GM page's code first declares `name` with, evaluated on its own, or null if it doesn't. */
  const thePool = (name: string): APool | null => {
    const source = pageInitializer(GM, name);
    if (source === null) return null;
    const value: unknown = vm.runInNewContext(source);
    return isAPool(value) ? value : null;
  };
  const pools = new Map<string, APool | null>();
  let theGmPagesCode = '';
  // Every script of the GM page read by its syntax tree, twice (the initializers, and the one layout).
  beforeAll(
    () => {
      for (const name of ['CREATURE_BY_TERRAIN', 'CBT', 'MONSTER_BY_TERRAIN', 'MBT']) pools.set(name, thePool(name));
      theGmPagesCode = compactPage(GM);
    },
    timeLimitForTheWork({ everyFileReads: 2 }).timeout,
  );

  test.each(['CREATURE_BY_TERRAIN', 'CBT'])(
    '%s: Thunderbirds where the Giant Eagles were (plain, desert, forest, mountain), Giant Eagles nowhere',
    (name) => {
      const pool = pools.get(name);
      expect(pool, `${name} evaluates`).toBeTruthy();
      expect(Object.values(pool ?? {}).flat()).not.toContain('Giant Eagles');
      for (const terrain of ['plain', 'desert', 'forest', 'mountain'])
        expect(pool?.[terrain] ?? [], terrain).toContain('Thunderbirds');
    },
  );

  test.each(['MONSTER_BY_TERRAIN', 'MBT'])('%s: Dread Hydras in jungle and forest', (name) => {
    const pool = pools.get(name);
    expect(pool, `${name} evaluates`).toBeTruthy();
    expect(pool?.['jungle'] ?? []).toContain('Dread Hydras');
    expect(pool?.['forest'] ?? []).toContain('Dread Hydras');
    expect(Object.values(pool ?? {}).flat()).not.toContain('Leviathan Pods');
  });

  test('the sea pass no longer keys its Veteran guard on Leviathan Pods', () => {
    expect(theGmPagesCode.length).toBeGreaterThan(10_000);
    expect(theGmPagesCode).not.toMatch(/isTier5=chosen==='Leviathan Pods'/);
  });

  test('a Kraken sea is still the race "Primal:Kraken"', () => {
    const afterTheSeaTypes = theGmPagesCode.slice(theGmPagesCode.indexOf('PRIMAL_SEA_TYPES.slice()'));
    expect(
      theGmPagesCode.includes("replace('Eldritch Kraken','Kraken')") || afterTheSeaTypes.includes("'Primal:Kraken'"),
    ).toBe(true);
  });
});
