// 2026-10-11 (the maintainer, the army roster): the roster as decided (tests/lib/roster-decided.ts): every humanoid
// unit's type, cost, base strength, move rate and terrain multipliers; the four new units (Men-at-Arms, Stag Riders,
// Ironhoof Rams, Black Arrows) in every table keyed by unit; the goblins' thrown spears and the Berserkers'
// Outnumbered and Uncaring retired. The books' words of the same roster are
// tests/static/the-rulebooks-and-the-player-portal-give-each-army-unit-as-the-roster-table-decides.test.ts.
//
// Level 1 (unit): the figures are data, in the content's tables and the engine's (ARMY_COST_MASTER, ARMY_SPEED_MASTER,
// TERRAIN_MODS, UNIT_SHORT, ARMY_RACE_OF_TYPE, DISC_CLS_SETS, and the units the magic items reach, in the items'
// registry's content rows), imported (tests/lib/the-whole-engine.ts first); one rule, unitAbilityMult, is called on
// hand-made companies. Not lower: the agreement between a dozen tables is a property of the data, not of one line of
// text, and the rule is computed.
//
// Until plan P1-14z this was tests/roster.test.js, which ran the data file in a vm, read the GM page's tables by their
// first declaration in its source, and called the rules on the booted GM and player pages. Its checks on the tables
// and on unitAbilityMult are here, as they were ("the GM portal declares <table>" and "<table> evaluates on its own"
// are the imports). Its other checks on the booted pages (each page's unitTypeOf for the new units, the player page's
// getDruidLevel, backfillHomeRosters, and each page booting) stay page checks, in
// tests/page/the-gm-and-player-pages-type-druid-strike-and-home-roster-rules-answer-as-the-rosters-decide.test.ts, which says why.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  ARMY_UNIT_NAMES,
  KC_DRUID_LEVELS,
  KC_UNIT_BASE_STR,
  KC_UNIT_CLASS,
  KC_UNIT_TYPE,
  PROVINCE_ARMIES_P,
} from '../../src/content/kingdoms-call-data.ts';
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS } from '../../src/content/magic-item-effects-their-names-numbers-and-words.ts';
import { ARMY_COST_MASTER, ARMY_SPEED_MASTER, type ArmyInABattle } from '../../src/engine/army-tables.ts';
import { unitAbilityMult } from '../../src/engine/battle/strength.ts';
import { TERRAIN_MODS } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import {
  ARMY_RACE_OF_TYPE,
  DISC_CLS_SETS,
} from '../../src/engine/rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import { UNIT_SHORT } from '../../src/views/prose/the-words-of-a-battles-lines.ts';
import {
  LAND_TERRAINS,
  NEW_UNIT_PROVINCES,
  NEW_UNITS,
  RACES,
  ROSTER,
  type ArmyRace,
  type ArmyUnitAsDecided,
  type LandTerrain,
} from '../lib/roster-decided.ts';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const UNITS = Object.keys(ROSTER);
const theRosterRow = (unit: string): ArmyUnitAsDecided => {
  const row = ROSTER[unit];
  if (!row) throw new Error(`${unit}: not in the roster table`);
  return row;
};
/** The two lists hold the same units, whatever their order. */
const sameUnits = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));
const typed = (type: string) => UNITS.filter((unit) => theRosterRow(unit).type === type);

// The content's and the engine's tables, read by any unit's name.
const THE_TYPE_OF: Readonly<Record<string, string | undefined>> = KC_UNIT_TYPE;
const THE_BASE_STRENGTH_OF: Readonly<Record<string, number | undefined>> = KC_UNIT_BASE_STR;
const THE_DRUID_LADDER: Readonly<Record<string, readonly string[] | undefined>> = KC_DRUID_LEVELS;
const THE_PROVINCE_ROSTERS: Readonly<
  Record<string, Readonly<Record<string, readonly string[] | undefined>> | undefined>
> = PROVINCE_ARMIES_P;
const THE_COMPANY_NAMES: Readonly<Record<string, readonly string[] | undefined>> = ARMY_UNIT_NAMES;
const THE_TERRAIN_MULTIPLIERS: Readonly<Record<string, Readonly<Record<string, number | undefined>> | undefined>> =
  TERRAIN_MODS;

// The province rosters before this work (PROVINCE_ARMIES_P, 2026-10-11): order is data, so a new unit joins a cell
// AFTER these, and a king's two starting companies (the first two non-garrison types of his home's cell) are the same
// as before.
const CELLS_BEFORE: Readonly<Record<LandTerrain, Readonly<Record<ArmyRace, readonly string[]>>>> = {
  plain: {
    Human: ['Shieldwall Levies', 'Free Lances', 'Yeoman Longbows', 'Gilded Lances', 'Noble Griffons', 'Human Garrison'],
    Elven: ['Elven Bowmen', 'Eagle Riders', 'Elven Garrison'],
    Dwarven: ['Dwarven Guard', 'Gnomish Gyrocopters', 'Dwarf Garrison'],
    Orcish: ['Warg Riders', 'Orc Berserkers', 'Orc Garrison'],
  },
  desert: {
    Human: ['Shieldwall Levies', 'Free Lances', 'Gilded Lances', 'Noble Griffons', 'Human Garrison'],
    Elven: ['Elven Bowmen', 'Eagle Riders', 'Elven Garrison'],
    Dwarven: ['Dwarven Guard', 'Gnomish Gyrocopters', 'Dwarf Garrison'],
    Orcish: ['Orc Berserkers', 'Warg Riders', 'Wyvern Riders', 'Orc Garrison'],
  },
  forest: {
    Human: ['Yeoman Longbows', 'Shieldwall Levies', 'Human Garrison'],
    Elven: ['Forest Wardens', 'Elven Bowmen', 'Shadow Archers', 'Eagle Riders', 'Elven Garrison'],
    Dwarven: ['Ironwood Crossbows', 'Gnomish Gyrocopters', 'Dwarf Garrison'],
    Orcish: ['Warg Riders', 'Goblin Horde', 'Wyvern Riders', 'Orc Garrison'],
  },
  jungle: {
    Human: ['Shieldwall Levies', 'Yeoman Longbows', 'Free Lances', 'Human Garrison'],
    Elven: ['Forest Wardens', 'Shadow Archers', 'Eagle Riders', 'Elven Garrison'],
    Dwarven: ['Ironwood Crossbows', 'Dwarven Guard', 'Gnomish Gyrocopters', 'Dwarf Garrison'],
    Orcish: ['Goblin Horde', 'Orc Berserkers', 'Wyvern Riders', 'Orc Garrison'],
  },
  mountain: {
    Human: ['Human Garrison', 'Shieldwall Levies', 'Noble Griffons'],
    Elven: ['Eagle Riders', 'Elven Bowmen', 'Elven Garrison'],
    Dwarven: ['Dwarven Guard', 'Ironwood Crossbows', 'Mountain Guns', 'Gnomish Gyrocopters', 'Dwarf Garrison'],
    Orcish: ['Orc Berserkers', 'Wyvern Riders', 'Orc Garrison'],
  },
};

describe('the shared data file', () => {
  describe.each(UNITS)('%s', (unit) => {
    const row = theRosterRow(unit);
    test(`KC_UNIT_TYPE is '${row.type}'`, () => {
      expect(THE_TYPE_OF[unit]).toBe(row.type);
    });
    test(`KC_UNIT_BASE_STR is ${String(row.str)}`, () => {
      expect(THE_BASE_STRENGTH_OF[unit]).toBe(row.str);
    });
    if (unit !== 'Gnomish Gyrocopters') {
      test('Druid 1 to lead (a racial troop)', () => {
        expect(THE_DRUID_LADDER[1]).toContain(unit);
      });
    }
  });

  test('Gnomish Gyrocopters (a machine) still need nobody', () => {
    expect(THE_DRUID_LADDER[1]).not.toContain('Gnomish Gyrocopters');
  });

  test('KC_UNIT_CLASS.cavalry holds every humanoid horse and only units typed cavalry', () => {
    // (2026-10-13, Creatures and Monsters IV: the Unicorn Herd, a Creature, joins the cavalry; the class must still
    // hold every humanoid horse and nothing that is not typed cavalry.)
    for (const unit of typed('cavalry')) expect(KC_UNIT_CLASS.cavalry).toContain(unit);
    expect(KC_UNIT_CLASS.cavalry.filter((unit) => THE_TYPE_OF[unit] !== 'cavalry')).toEqual([]);
  });

  test("KC_UNIT_CLASS.missile is exactly the ranged units (the goblins' spears are retired)", () => {
    expect(sameUnits(KC_UNIT_CLASS.missile, typed('ranged'))).toBe(true);
  });

  test('Goblin Horde no longer looses anything in the archery step', () => {
    expect(KC_UNIT_CLASS.missile).not.toContain('Goblin Horde');
  });

  test('KC_UNIT_CLASS.flying is exactly the winged riders, and .aerial (riders and flying beasts) holds them all', () => {
    expect(sameUnits(KC_UNIT_CLASS.flying, typed('flyer'))).toBe(true);
    for (const unit of typed('flyer')) expect(KC_UNIT_CLASS.aerial).toContain(unit);
  });

  test('every humanoid fleet is in KC_UNIT_CLASS.sea and .carrier', () => {
    for (const unit of typed('naval')) {
      expect(KC_UNIT_CLASS.sea).toContain(unit);
      expect(KC_UNIT_CLASS.carrier).toContain(unit);
    }
  });

  test('KC_UNIT_CLASS.lightFoot (half a hull) is exactly the infantry and ranged units', () => {
    const foot = UNITS.filter((unit) => ['infantry', 'ranged'].includes(theRosterRow(unit).type));
    expect({
      missing: foot.filter((unit) => !KC_UNIT_CLASS.lightFoot.includes(unit)),
      extra: KC_UNIT_CLASS.lightFoot.filter((unit) => !foot.includes(unit)),
    }).toEqual({ missing: [], extra: [] });
    expect(sameUnits(KC_UNIT_CLASS.lightFoot, foot)).toBe(true);
  });

  test('KC_UNIT_CLASS.garrison is the four garrisons', () => {
    expect(
      sameUnits(
        KC_UNIT_CLASS.garrison,
        UNITS.filter((unit) => theRosterRow(unit).garrison),
      ),
    ).toBe(true);
  });

  // Province rosters: the old cells in their old order, the new unit after them.
  describe.each(LAND_TERRAINS.flatMap((terrain) => RACES.map((race) => ({ terrain, race }))))(
    'PROVINCE_ARMIES_P, $terrain, $race',
    ({ terrain, race }) => {
      const cell = () => THE_PROVINCE_ROSTERS[terrain]?.[race] ?? [];
      const before = CELLS_BEFORE[terrain][race];
      test('keeps its old units in their old order', () => {
        expect(cell().slice(0, before.length)).toEqual(before);
      });
      test('adds the new units raised there, after the old ones', () => {
        const want = NEW_UNITS.filter(
          (unit) => theRosterRow(unit).race === race && (NEW_UNIT_PROVINCES[unit] ?? []).includes(terrain),
        );
        expect(sameUnits(cell().slice(before.length), want)).toBe(true);
      });
    },
  );

  // Company names for the new units, as the old ones have them.
  describe.each(NEW_UNITS)('%s', (unit) => {
    const names = () => THE_COMPANY_NAMES[unit] ?? [];
    test('at least 30 company names in ARMY_UNIT_NAMES', () => {
      expect(names().length).toBeGreaterThanOrEqual(30);
    });
    test('the names are distinct and read "the …"', () => {
      expect(new Set(names()).size).toBe(names().length);
      for (const name of names()) expect(name).toMatch(/^the /);
    });
  });
});

describe("the engine's own tables", () => {
  describe.each(UNITS)('%s', (unit) => {
    const row = theRosterRow(unit);
    test(`ARMY_COST_MASTER is ${String(row.cost)}`, () => {
      expect(ARMY_COST_MASTER[unit]).toBe(row.cost);
    });
    test(`ARMY_SPEED_MASTER is ${String(row.speed)}`, () => {
      expect(ARMY_SPEED_MASTER[unit]).toBe(row.speed);
    });
    if (row.type !== 'naval') {
      test(`ARMY_RACE_OF_TYPE is ${row.race}`, () => {
        // An old winged rider (a flyer the roster did not add) may name no race there.
        expect(ARMY_RACE_OF_TYPE[unit] === row.race || (!row.isNew && row.type === 'flyer')).toBe(true);
      });
    }
    // A land unit and a flyer by its terrain row; a fleet ×1 everywhere (its row names no terrain); a flyer ×0.75 in
    // the woods (item 19).
    test.each(LAND_TERRAINS)(`in %s: TERRAIN_MODS as the table decides`, (terrain) => {
      const got = THE_TERRAIN_MULTIPLIERS[terrain]?.[unit] ?? 1;
      const want = row.terr[terrain] ?? 1;
      expect(near(got, want), `${unit} in ${terrain}: ×${String(want)} (got ×${String(got)})`).toBe(true);
    });
  });

  test.each(NEW_UNITS)('%s: a UNIT_SHORT code of 3–5 letters for the grid print', (unit) => {
    expect(UNIT_SHORT[unit]).toMatch(/^[A-Za-z]{3,5}$/);
  });

  test('DISC_CLS_SETS.cavalry (discovery effects) reaches every cavalry unit, Stag Riders and Ironhoof Rams included', () => {
    for (const unit of typed('cavalry')) expect(DISC_CLS_SETS.cavalry.has(unit)).toBe(true);
  });

  test('DISC_CLS_SETS.infantry reaches Men-at-Arms beside Levies, Guard and Berserkers', () => {
    for (const unit of ['Shieldwall Levies', 'Men-at-Arms', 'Dwarven Guard', 'Orc Berserkers'])
      expect(DISC_CLS_SETS.infantry.has(unit)).toBe(true);
  });

  test('DISC_CLS_SETS.missile is the ranged units, Black Arrows in and Goblin Horde out', () => {
    for (const unit of typed('ranged')) expect(DISC_CLS_SETS.missile.has(unit)).toBe(true);
    expect(DISC_CLS_SETS.missile.has('Goblin Horde')).toBe(false);
  });

  // The units the magic items reach (Golden Spur, Legionnaire's Mark, Eagle-Eye Pendant): until P1-19m armStr's class
  // sets (CAV_I, INF_I, ARCH_I), since then their rows in the items' registry's content.
  // (The old script checked each row's reach is a list; the compiler does now.)
  const theUnitsAnItemReaches = (slug: 'cavalry-bonus' | 'infantry-bonus' | 'archer-bonus'): readonly string[] =>
    MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS[slug].reaches;

  test("the Golden Spur's cavalry (the cavalry-bonus row's reach) has every cavalry unit", () => {
    for (const unit of typed('cavalry')) expect(theUnitsAnItemReaches('cavalry-bonus')).toContain(unit);
  });

  test("the Legionnaire's Mark's infantry (the infantry-bonus row's reach) has Men-at-Arms", () => {
    expect(theUnitsAnItemReaches('infantry-bonus')).toContain('Men-at-Arms');
  });

  test("the Eagle-Eye Pendant's archers (the archer-bonus row's reach) have Black Arrows, and not Goblin Horde", () => {
    expect(theUnitsAnItemReaches('archer-bonus')).toContain('Black Arrows');
    expect(theUnitsAnItemReaches('archer-bonus')).not.toContain('Goblin Horde');
  });
});

describe("the engine's rules", () => {
  // unitAbilityMult reads only each unit's type (strength.ts, and the registry's stage "strength: the whole force").
  const aCompany = (type: string): ArmyInABattle => ({ type, quality: 'Average', race: '', unitName: type });

  test('Outnumbered and Uncaring is gone: three Berserkers against twelve enemy companies fight at ×1 (it was ×1.3)', () => {
    const berserkers = aCompany('Orc Berserkers');
    const enemy = Array.from({ length: 12 }, () => aCompany('Shieldwall Levies'));
    const force = [berserkers, aCompany('Orc Berserkers'), aCompany('Orc Berserkers')];
    expect(unitAbilityMult(berserkers, { force, enemyForce: enemy, isAttacker: true }, 'plain')).toBe(1);
  });

  test('Sheer Numbers still stands: three Goblin Hordes together fight at ×1.2', () => {
    const force = [aCompany('Goblin Horde'), aCompany('Goblin Horde'), aCompany('Goblin Horde')];
    const got = unitAbilityMult(force[0], { force, enemyForce: [aCompany('Shieldwall Levies')] }, 'plain');
    expect(near(got, 1.2), `got ×${String(got)}`).toBe(true);
  });
});
