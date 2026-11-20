// The rules the GM page and the player page hold for their tests answer as the two roster tables decide
// (tests/lib/roster-decided.ts, 2026-10-11, and tests/lib/primal-decided.ts, 2026-10-13, both the maintainer's):
// - unitTypeOf, on both pages, gives each new unit its type and answers 'infantry' for a type it doesn't know (an old
//   save or a test fixture names such types);
// - getDruidLevel, on both pages, asks Druid 1 of the three winged riders and of the four new units, as of Levies;
// - primalStrikeChance, on the GM page: a winged rider's strike lands one time in two whatever the Druid, a beast's
//   runs 30% + 10% a level to 90;
// - backfillHomeRosters, on the GM page: in a running game the new units reach a realm's capital on its next turn,
//   and every other province keeps the pool it was generated with (the ruling R-094);
// - the player page's PRIMAL_ARMY_SPEEDS and druidNeedP: each beast's move, and the two crowns' waivers.
//
// Level 4 (page): each page booted in jsdom (tests/lib/boot.ts) on the fake database (tests/lib/fake-db.ts). The rules
// are the engine's and the player portal's modules, and a unit test could call them there; but these calls are the
// last a test makes to eight names the pages keep for their tests (src/ui/gm/globals.ts: backfillHomeRosters,
// getDruidLevel, primalStrikeChance, unitTypeOf; src/ui/player/globals.ts: druidNeedP, getDruidLevel,
// PRIMAL_ARMY_SPEEDS, unitTypeOf). Without them tests/static/page-globals.test.ts fails, and taking the names off is a
// change to src/, which plan P1-14z makes none of. When they leave the lists, these checks move down beside the tables'.
//
// Until plan P1-14z these checks were the booted pages' part of four scripts: tests/flyers-soldiers.test.js,
// tests/unit-types.test.js, tests/roster.test.js and tests/primal-roster.test.js. Each is kept as it was, with the
// two scripts' "declared" checks (unitTypeOf on both pages, primalStrikeChance on the GM page). The scripts' other checks, on the tables and on
// unitAbilityMult and druIdPenaltyMult, are the unit tests
// tests/unit/the-winged-riders-are-soldiers-of-their-race-in-the-class-lists-and-the-druid-ladder.test.ts,
// tests/unit/every-unit-has-one-of-five-types-that-agree-with-the-engines-class-lists.test.ts,
// tests/unit/the-engines-tables-give-each-army-unit-as-the-roster-table-decides.test.ts and
// tests/unit/the-engines-tables-give-each-beast-as-the-wild-roster-table-decides.test.ts.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';
import { PRIMAL_ARMY_DEFS_P } from '../../src/content/kingdoms-call-data.ts';
import { LIVE, ROSTER as THE_WILD_ROSTER } from '../lib/primal-decided.ts';
import { NEW_UNITS, RACES, ROSTER, unitsOf, type ArmyRace } from '../lib/roster-decided.ts';

const THE_WINGED_RIDERS = ['Eagle Riders', 'Noble Griffons', 'Wyvern Riders'];

/** The page's function, or a throw naming it: what a test calls on a booted page. */
function aFunctionOnThePage(value: unknown, name: string): (...args: unknown[]) => unknown {
  if (typeof value !== 'function') throw new Error(`${name} is not a function on the page`);
  return (...args: unknown[]): unknown => Reflect.apply(value, undefined, args);
}

const theTypeTheRosterDecides = (unit: string) => {
  const row = ROSTER[unit];
  if (!row) throw new Error(`${unit}: not in the roster table`);
  return row.type;
};

/** Boots the page as the old scripts did: the errors its scripts throw are kept, its console is silenced, and it is
 *  given 1.2 s to start. */
async function bootThePage(page: string): Promise<{ window: PageWindow; errors: string[] }> {
  const errors: string[] = [];
  const { window } = bootJsdom(readPage(page), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb([DB_VERSION]).db,
    url: 'https://example.org/' + page,
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return { window, errors };
}

describe('the GM page', () => {
  let GM: PageWindow;
  let errors: string[] = [];
  beforeAll(async () => {
    ({ window: GM, errors } = await bootThePage('kingdoms-call-gm-portal.html'));
  });
  afterAll(() => {
    GM.close();
  });

  test('boots without an error', () => {
    expect(errors.map((error) => error.split('\n')[0])).toEqual([]);
  });

  test('declares unitTypeOf and primalStrikeChance', () => {
    expect(typeof GM['unitTypeOf']).toBe('function');
    expect(typeof GM['primalStrikeChance']).toBe('function');
  });

  describe('unitTypeOf', () => {
    const unitTypeOf = (type: unknown) => aFunctionOnThePage(GM['unitTypeOf'], 'unitTypeOf')(type);
    test("unitTypeOf('Yeoman Longbows') is 'ranged'", () => {
      expect(unitTypeOf('Yeoman Longbows')).toBe('ranged');
    });
    test("unitTypeOf('Elven Galleys') is 'naval'", () => {
      expect(unitTypeOf('Elven Galleys')).toBe('naval');
    });
    test("unitTypeOf('Light Infantry') (an unknown type) is 'infantry'", () => {
      expect(unitTypeOf('Light Infantry')).toBe('infantry');
    });
    test("unitTypeOf(undefined) is 'infantry'", () => {
      expect(unitTypeOf(undefined)).toBe('infantry');
    });
    test.each(NEW_UNITS)("unitTypeOf('%s') is the type the roster decides", (unit) => {
      expect(unitTypeOf(unit)).toBe(theTypeTheRosterDecides(unit));
    });
  });

  describe("the engine's Druid table", () => {
    const getDruidLevel = (type: string) => aFunctionOnThePage(GM['getDruidLevel'], 'getDruidLevel')(type);
    test.each(THE_WINGED_RIDERS)('asks Druid 1 of %s, as of Levies', (rider) => {
      expect(getDruidLevel(rider)).toBe(1);
    });
    test('Thunderbirds need Druid 4, Levies Druid 1, Gyrocopters none', () => {
      expect(getDruidLevel('Thunderbirds')).toBe(4);
      expect(getDruidLevel('Shieldwall Levies')).toBe(1);
      expect(getDruidLevel('Gnomish Gyrocopters')).toBe(0);
    });
  });

  describe("a unit's strike before the battle", () => {
    const chance = (...args: unknown[]) => aFunctionOnThePage(GM['primalStrikeChance'], 'primalStrikeChance')(...args);
    test("a winged rider's strike lands one time in two whatever the Druid", () => {
      expect(chance(0, null, 'Noble Griffons')).toBe(50);
      expect(chance(5, null, 'Noble Griffons')).toBe(50);
      expect(chance(0, null, 'Wyvern Riders')).toBe(50);
    });
    test("a beast's strike still runs 30% + 10% a level, capped at 90", () => {
      expect(chance(0, null, 'Thunderbirds')).toBe(30);
      expect(chance(2, null, 'Elder Dragons')).toBe(50);
      expect(chance(9, null, 'Elder Dragons')).toBe(90);
    });
    test("with no unit named, the beasts' figure", () => {
      expect(chance(0, null)).toBe(30);
    });
  });

  // Ruling R-094 (the maintainer, 2026-10-11, "Option 1 is fine, leave it capitals only"): in a running game the new
  // units reach a realm's capital on its next turn (backfillHomeRosters, which runs at the top of every turn, appends
  // every missing land type of the race); every other province keeps the pool it was generated with. The cells are
  // the province rosters of plain and forest before the new units (tests/unit/the-engines-tables-give-each-army-unit-…).
  const THE_HOME_CELL_BEFORE: Readonly<Record<ArmyRace, readonly string[]>> = {
    Human: ['Shieldwall Levies', 'Free Lances', 'Yeoman Longbows', 'Gilded Lances', 'Noble Griffons', 'Human Garrison'],
    Elven: ['Elven Bowmen', 'Eagle Riders', 'Elven Garrison'],
    Dwarven: ['Dwarven Guard', 'Gnomish Gyrocopters', 'Dwarf Garrison'],
    Orcish: ['Warg Riders', 'Orc Berserkers', 'Orc Garrison'],
  };
  const THE_OTHER_CELL_BEFORE: Readonly<Record<ArmyRace, readonly string[]>> = {
    Human: ['Yeoman Longbows', 'Shieldwall Levies', 'Human Garrison'],
    Elven: ['Forest Wardens', 'Elven Bowmen', 'Shadow Archers', 'Eagle Riders', 'Elven Garrison'],
    Dwarven: ['Ironwood Crossbows', 'Gnomish Gyrocopters', 'Dwarf Garrison'],
    Orcish: ['Warg Riders', 'Goblin Horde', 'Wyvern Riders', 'Orc Garrison'],
  };
  describe.each(RACES)('%s: backfillHomeRosters', (race) => {
    const theStateAfterTheBackfill = () => {
      const capital = { id: 0, race, terrain: 'plain', row: 0, col: 0, armyTypes: THE_HOME_CELL_BEFORE[race].slice() };
      const another = {
        id: 1,
        race,
        terrain: 'forest',
        row: 0,
        col: 1,
        armyTypes: THE_OTHER_CELL_BEFORE[race].slice(),
      };
      aFunctionOnThePage(
        GM['backfillHomeRosters'],
        'backfillHomeRosters',
      )({
        players: [{ race, homeProvinceId: 0, provinces: [0, 1] }],
        characters: [],
        world: { cols: 2, rows: 1, provinces: [capital, another] },
      });
      return { home: capital.armyTypes, other: another.armyTypes };
    };
    test("a running game's capital gains every land unit of the race, the new one included", () => {
      const got = theStateAfterTheBackfill().home;
      for (const unit of unitsOf(race, (row) => row.type !== 'naval')) expect(got).toContain(unit);
    });
    test('a province that is not the capital keeps the pool it was generated with', () => {
      expect(theStateAfterTheBackfill().other.join()).toBe(THE_OTHER_CELL_BEFORE[race].join());
    });
  });
});

describe('the player page', () => {
  let PP: PageWindow;
  let errors: string[] = [];
  beforeAll(async () => {
    ({ window: PP, errors } = await bootThePage('kingdoms-call-player-portal.html'));
  });
  afterAll(() => {
    PP.close();
  });

  test('boots without an error', () => {
    expect(errors.map((error) => error.split('\n')[0])).toEqual([]);
  });

  test('declares unitTypeOf', () => {
    expect(typeof PP['unitTypeOf']).toBe('function');
  });

  describe('unitTypeOf', () => {
    const unitTypeOf = (type: unknown) => aFunctionOnThePage(PP['unitTypeOf'], 'unitTypeOf')(type);
    test("unitTypeOf('Yeoman Longbows') is 'ranged'", () => {
      expect(unitTypeOf('Yeoman Longbows')).toBe('ranged');
    });
    test("unitTypeOf('Elven Galleys') is 'naval'", () => {
      expect(unitTypeOf('Elven Galleys')).toBe('naval');
    });
    test("unitTypeOf('Light Infantry') (an unknown type) is 'infantry'", () => {
      expect(unitTypeOf('Light Infantry')).toBe('infantry');
    });
    test("unitTypeOf(undefined) is 'infantry'", () => {
      expect(unitTypeOf(undefined)).toBe('infantry');
    });
    test.each(NEW_UNITS)("unitTypeOf('%s') is the type the roster decides", (unit) => {
      expect(unitTypeOf(unit)).toBe(theTypeTheRosterDecides(unit));
    });
  });

  test.each([...THE_WINGED_RIDERS, ...NEW_UNITS])("the player portal's Druid table says 1 for %s", (unit) => {
    expect(aFunctionOnThePage(PP['getDruidLevel'], 'getDruidLevel')(unit)).toBe(1);
  });

  test("each live beast's speed is the wild roster's", () => {
    const speeds: unknown = PP['PRIMAL_ARMY_SPEEDS'];
    if (typeof speeds !== 'object' || speeds === null) throw new Error('PRIMAL_ARMY_SPEEDS is not on the player page');
    const onThePage = new Map(Object.entries(speeds));
    // the live beasts the data file's one primal table defines (the Whale Cohort's pace is the engine's master table's)
    const theBeastsDefined = LIVE.filter((unit) => unit in PRIMAL_ARMY_DEFS_P);
    expect(theBeastsDefined.length, 'the data file defines some of the live beasts').toBeGreaterThan(0);
    for (const unit of theBeastsDefined)
      expect(onThePage.get(unit), `the player portal's speed for ${unit}`).toBe(THE_WILD_ROSTER[unit]?.speed);
  });

  describe('druidNeedP: the two crowns', () => {
    const need = (alignment: string, unit: string, druid: number) =>
      aFunctionOnThePage(PP['druidNeedP'], 'druidNeedP')(
        { type: unit, race: 'Primal' },
        { race: 'Orcish', alignment: 'Neutral', skills: { druid } },
        { kingdom: { alignment }, discoveries: [] },
      );
    test('an Evil realm needs no Druid for Cave Trolls', () => {
      expect(need('Evil', 'Cave Trolls', 0)).toMatchObject({ req: 0, shortfall: 0 });
    });
    test('…and a Druidic realm none for Forest Ents', () => {
      expect(need('Druidic', 'Forest Ents', 0)).toMatchObject({ req: 0 });
    });
    test('…and a Neutral Druid 1 hero is 3 short for Cave Trolls', () => {
      expect(need('Neutral', 'Cave Trolls', 1)).toMatchObject({ req: 4, shortfall: 3 });
    });
  });
});
