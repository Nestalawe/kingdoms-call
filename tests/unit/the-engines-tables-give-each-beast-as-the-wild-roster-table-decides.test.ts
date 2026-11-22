// 2026-10-13 (the maintainer, Creatures and Monsters I): the wild roster as decided (tests/lib/primal-decided.ts):
// every live Creature and Monster's family, type, cost, base strength, move rate, Druid level and terrain multipliers,
// read from the content's tables and the engine's; terrain written once (the always-on terrain multipliers of Stone
// Giants, Forest Ents, Cave Trolls and the Titans' Colossal Bulk are gone from unitAbilityMult, the others stay); the
// two crowns' waivers in the one function that applies the Druid shortfall (Evil leads Monsters free, as Druidic leads
// Creatures); the player portal's mirror of it, and its speeds built from the one primal table. (The summoning tier
// tables went with Awaken the Wild and Call from the Pit on 2026-10-12, item 22:
// tests/scenario/call-from-the-pit-and-awaken-the-wild-given-in-a-turn-… checks they are gone.) The books' words of the
// same roster are tests/static/the-rulebooks-and-the-player-portal-give-each-beast-as-the-wild-roster-table-decides.test.ts.
// With them (until plan P1-14z the plain-value checks of the scripts shark-waters and new-creatures): the Shark Shoals
// a primal sea beast and no hull, shark waters named from their own pool; the Creature bank (content's, one list since
// B-06t) dealing the new land beasts by terrain, and the Great Turtles' and the Unicorn Herd's classes. The shortfall on
// the shoals and Whale Lore stay on the booted GM page, in
// tests/page/the-gm-page-gives-the-shark-shoals-their-druid-shortfall-and-whale-lore-its-turtles.test.ts, which says
// why. Their worlds and turns are tests/scenario/shark-waters-are-half-the-poor-seas-and-a-realm-raises-its-shoals-there.test.ts and
// tests/scenario/the-new-creatures-are-dealt-by-terrain-and-the-turtles-are-raised-in-their-own-sea.test.ts.
//
// Level 1 (unit): the figures are data, in the content's tables and the engine's (ARMY_COST_MASTER, ARMY_SPEED_MASTER,
// TERRAIN_MODS), imported (tests/lib/the-whole-engine.ts first); two rules, unitAbilityMult and druIdPenaltyMult, are
// called on plain values. Not lower: the agreement between the tables is a property of the data, not of one line of
// text, and the rules are computed.
//
// Until plan P1-14z this was tests/primal-roster.test.js, which ran the data file in a vm, read TERRAIN_MODS by its
// first declaration in the GM page's source, and called the rules on the booted GM and player pages. Its checks on
// the tables, unitAbilityMult and druIdPenaltyMult are here, as they were ("the GM portal declares TERRAIN_MODS" and
// "TERRAIN_MODS evaluates on its own" are the import). Its checks on the booted player page (PRIMAL_ARMY_SPEEDS,
// druidNeedP, and each page booting) stay page checks, in
// tests/page/the-gm-and-player-pages-type-druid-strike-and-home-roster-rules-answer-as-the-rosters-decide.test.ts, which says why.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  KC_DRUID_LEVELS,
  KC_UNIT_BASE_STR,
  KC_UNIT_CLASS,
  KC_UNIT_TYPE,
  PRIMAL_ARMY_DEFS_P,
} from '../../src/content/kingdoms-call-data.ts';
import { ARMY_COST_MASTER, ARMY_SPEED_MASTER, type ArmyInABattle } from '../../src/engine/army-tables.ts';
import { unitAbilityMult } from '../../src/engine/battle/strength.ts';
import { TERRAIN_MODS } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { druIdPenaltyMult } from '../../src/engine/world/tables.ts';
import {
  THE_HALVES_OF_A_SEAS_NAME_BY_THE_KIND_OF_SEA,
  THE_WILD_CREATURES_BY_TERRAIN,
} from '../../src/content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import { compactOf } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';
import { COMING, isLand, LAND_TERRAINS, LIVE, RENAMED, ROSTER, type WildUnitAsDecided } from '../lib/primal-decided.ts';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const theRosterRow = (unit: string): WildUnitAsDecided => {
  const row = ROSTER[unit];
  if (!row) throw new Error(`${unit}: not in the wild roster table`);
  return row;
};

// The content's and the engine's tables, read by any unit's name.
const THE_TYPE_OF: Readonly<Record<string, string | undefined>> = KC_UNIT_TYPE;
const THE_BASE_STRENGTH_OF: Readonly<Record<string, number | undefined>> = KC_UNIT_BASE_STR;
const THE_DRUID_LADDER: Readonly<Record<string, readonly string[] | undefined>> = KC_DRUID_LEVELS;
const THE_PRIMAL_DEFINITIONS: Readonly<Record<string, { readonly cost: number; readonly speed: number } | undefined>> =
  PRIMAL_ARMY_DEFS_P;
const THE_TERRAIN_MULTIPLIERS: Readonly<Record<string, Readonly<Record<string, number | undefined>> | undefined>> =
  TERRAIN_MODS;

/** The Druid level the data file's ladder asks of the unit (0 if it is on no rung). */
const druidOf = (unit: string) => {
  for (const [level, units] of Object.entries(THE_DRUID_LADDER)) if (units?.includes(unit)) return Number(level);
  return 0;
};

describe('the shared data file', () => {
  describe.each(LIVE)('%s', (unit) => {
    const row = theRosterRow(unit);
    test(`KC_UNIT_TYPE is '${row.type}'`, () => {
      expect(THE_TYPE_OF[unit]).toBe(row.type);
    });
    test(`base strength ${String(row.str)}`, () => {
      expect(THE_BASE_STRENGTH_OF[unit]).toBe(row.str);
    });
    // (The Whale Cohort's price and pace live in the engine's master tables, checked below; every other beast's are
    // written once in PRIMAL_ARMY_DEFS_P.)
    if (unit !== 'Whale Cohort') {
      test(`cost ${String(row.cost)} and move ${String(row.speed)} in PRIMAL_ARMY_DEFS_P`, () => {
        expect(THE_PRIMAL_DEFINITIONS[unit]?.cost).toBe(row.cost);
        expect(THE_PRIMAL_DEFINITIONS[unit]?.speed).toBe(row.speed);
      });
    }
    test(`Druid ${String(row.druid)} to lead`, () => {
      expect(druidOf(unit)).toBe(row.druid);
    });
    test(`a ${row.family} in KC_UNIT_CLASS`, () => {
      const family = KC_UNIT_CLASS.creature.includes(unit)
        ? 'Creature'
        : KC_UNIT_CLASS.monster.includes(unit)
          ? 'Monster'
          : 'neither';
      expect(family).toBe(row.family);
    });
  });

  test.each(COMING)('%s is not in the tables yet (it arrives in its own PR)', (unit) => {
    expect(unit in KC_UNIT_BASE_STR).toBe(false);
    expect(unit in KC_UNIT_TYPE).toBe(false);
  });

  test.each(Object.entries(RENAMED))('%s is out of the tables (it is %s now)', (unit) => {
    expect(unit in KC_UNIT_BASE_STR).toBe(false);
    expect(unit in KC_UNIT_TYPE).toBe(false);
  });
});

describe("the engine's own tables", () => {
  describe.each(LIVE)('%s', (unit) => {
    const row = theRosterRow(unit);
    // A land unit and a flyer by its terrain row (a flyer: ×0.75 in the woods, item 19); a sea beast ×1 everywhere.
    test.each(LAND_TERRAINS)('in %s: TERRAIN_MODS as the table decides', (terrain) => {
      const got = THE_TERRAIN_MULTIPLIERS[terrain]?.[unit] ?? 1;
      const want = isLand(row) || row.type === 'flyer' ? (row.terr[terrain] ?? 1) : 1;
      expect(near(got, want), `${unit} in ${terrain}: ×${String(want)} (got ×${String(got)})`).toBe(true);
    });
    test(`ARMY_COST_MASTER is ${String(row.cost)}`, () => {
      expect(ARMY_COST_MASTER[unit]).toBe(row.cost);
    });
    test(`ARMY_SPEED_MASTER is ${String(row.speed)}`, () => {
      expect(ARMY_SPEED_MASTER[unit]).toBe(row.speed);
    });
  });
});

describe("the engine's rules", () => {
  // unitAbilityMult reads only each unit's type (strength.ts, and the registry's stage "strength: the whole force").
  const aCompany = (type: string): ArmyInABattle => ({ type, quality: 'Average', race: '', unitName: type });
  const mult = (type: string, terrain: string, extra: { isAttacker?: boolean; coastal?: boolean } = {}) =>
    unitAbilityMult(
      aCompany(type),
      { force: [aCompany(type)], enemyForce: [aCompany('Shieldwall Levies')], ...extra },
      terrain,
    );

  // Terrain written once: the always-on multipliers that doubled a terrain row are gone; the posture and
  // enemy-composition ones stay.
  test('Stone Giants in the mountains: no Mountain Bulwark on top of the terrain row', () => {
    expect(mult('Stone Giants', 'mountain')).toBe(1);
  });

  test('Forest Ents in the woods: no Rooted Grove on top of the terrain row', () => {
    expect(mult('Forest Ents', 'forest')).toBe(1);
    expect(mult('Forest Ents', 'jungle')).toBe(1);
  });

  test('Cave Trolls: no always-on Regenerating Hide multiplier', () => {
    expect(mult('Cave Trolls', 'plain')).toBe(1);
    expect(mult('Cave Trolls', 'mountain')).toBe(1);
  });

  test('Titan Warbeasts: no always-on ×1.3', () => {
    expect(mult('Titan Warbeasts', 'plain')).toBe(1);
  });

  test('Stone Deterrent still ×1.25 defending only', () => {
    expect(near(mult('Basilisk Brood', 'plain', { isAttacker: false }), 1.25)).toBe(true);
    expect(mult('Basilisk Brood', 'plain', { isAttacker: true })).toBe(1);
  });

  test('Relentless Hunt still ×1.25 attacking only', () => {
    expect(near(mult('Manticore Pride', 'plain', { isAttacker: true }), 1.25)).toBe(true);
    expect(mult('Manticore Pride', 'plain', { isAttacker: false })).toBe(1);
  });

  test('Wyrmscale still ×1.25', () => {
    expect(near(mult('Elder Dragons', 'plain'), 1.25)).toBe(true);
  });

  test('Tidal Might still ×1.2 on a coast and not at sea', () => {
    expect(near(mult('Sea Giants', 'plain', { coastal: true }), 1.2)).toBe(true);
    expect(mult('Sea Giants', 'sea', { coastal: true })).toBe(1);
  });

  test('Air Superiority still ×1.3 against ranged', () => {
    const rocs = unitAbilityMult(
      { type: 'Crimson Rocs', quality: 'Average', race: '', unitName: 'Crimson Rocs' },
      { force: [], enemyForce: [aCompany('Yeoman Longbows')] },
      'plain',
    );
    expect(near(rocs, 1.3), `got ×${String(rocs)}`).toBe(true);
  });

  // The two crowns, in the one function that applies the Druid shortfall.
  const pen = (realmsAlignment: string | null, druid: number, unit: string, herosAlignment = 'Neutral') =>
    druIdPenaltyMult(
      { race: 'Orcish', alignment: herosAlignment, skills: { druid }, items: [] },
      { type: unit, race: 'Primal' },
      realmsAlignment,
      false,
      [],
    );

  test('an Evil realm leads Cave Trolls with no Druid', () => {
    expect(pen('Evil', 0, 'Cave Trolls')).toBe(1);
  });

  test('…and Elder Dragons (Druid 5) too', () => {
    expect(pen('Evil', 0, 'Elder Dragons')).toBe(1);
  });

  test('a Druidic realm still leads Creatures free', () => {
    expect(pen('Druidic', 0, 'Forest Ents')).toBe(1);
  });

  test('an Evil realm gets no waiver for a Creature: Ents at Druid 0 fight ×0.2', () => {
    expect(near(pen('Evil', 0, 'Forest Ents'), 0.2)).toBe(true);
  });

  test('a Druidic realm gets no waiver for a Monster', () => {
    expect(near(pen('Druidic', 0, 'Cave Trolls'), 0.2)).toBe(true);
  });

  test('a Neutral Druid 1 hero leads Cave Trolls at ×0.4', () => {
    expect(near(pen('Neutral', 1, 'Cave Trolls'), 0.4)).toBe(true);
  });

  test('a personally Evil wandering hero (no realm) leads Monsters free, as a personally Druidic one leads Creatures', () => {
    expect(pen(null, 0, 'Cave Trolls', 'Evil')).toBe(1);
  });
});

// The sea beasts and the new Creatures (2026-10-13, Creatures and Monsters III and IV). Until plan P1-14z these were the
// plain-value checks of tests/shark-waters.test.js and tests/new-creatures.test.js, on the booted GM page; each is kept
// as it was. The sea names' choice is read by its syntax tree (tests/lib/source.ts) from the world's making's set-up
// (S0, which makes the naming functions since B-06v), as the scripts read it from the GM page's code; the sea names'
// pools and the Creature bank are content's, imported (B-06t).
describe('the sea beasts and the new Creatures', () => {
  test('the Shark Shoals are a primal sea beast (they swim, carry nothing, and are raised only at sea) and no hull', () => {
    expect(KC_UNIT_CLASS.primalSea).toContain('Shark Shoals');
    expect(KC_UNIT_CLASS.sea).toContain('Shark Shoals');
    expect(KC_UNIT_CLASS.carrier).not.toContain('Shark Shoals');
  });
  // compactOf reads the set-up's file by its syntax tree; the test keeps the allowance it had when it read every file
  // of the GM page's code
  test(
    'shark waters are named from their own pool (THE_HALVES_OF_A_SEAS_NAME_BY_THE_KIND_OF_SEA.shark, chosen for the race Primal:Shark)',
    timeLimitForTheWork({ everyFileReads: 1 }),
    () => {
      const gm = compactOf('engine/world/the-worlds-making/s00-the-set-up-the-maps-grid-and-the-provinces-names.ts');
      expect(THE_HALVES_OF_A_SEAS_NAME_BY_THE_KIND_OF_SEA.shark.pre.length).toBeGreaterThan(0);
      expect(gm).toMatch(/NAME_SEA_BY_TYPE=THE_HALVES_OF_A_SEAS_NAME_BY_THE_KIND_OF_SEA;/);
      expect(gm).toMatch(/race==='Primal:Shark'\)\s*kind='shark'/);
    },
  );

  // the Creature bank, by terrain (one list: the province pass, the creed's neighbour and the wild country read it)
  const POOL: Readonly<Record<string, readonly string[] | undefined>> = THE_WILD_CREATURES_BY_TERRAIN;
  const NEW_LAND: Record<string, string[]> = {
    'Great Bears': ['forest', 'mountain'],
    'Unicorn Herd': ['plain', 'forest'],
    'Mammoth Host': ['plain', 'desert'],
  };
  const dealt = Object.entries(NEW_LAND).flatMap(([u, terrs]) =>
    Object.keys(POOL).map((t) => [u, t, terrs.includes(t)] as const),
  );
  test("the pool has each new beast's terrains", () => {
    for (const [u, terrs] of Object.entries(NEW_LAND))
      for (const t of terrs) expect(Object.keys(POOL), `${u}: ${t}`).toContain(t);
  });
  test.each(dealt)('%s: dealt to %s provinces, %s', (u, t, yes) => {
    expect((POOL[t] ?? []).includes(u)).toBe(yes);
  });
  test('no land pool holds the Great Turtles', () => {
    expect(Object.values(POOL).some((l) => l?.includes('Great Turtles'))).toBe(false);
  });
  test('no land pool holds the Whale Cohort', () => {
    expect(Object.values(POOL).some((l) => l?.includes('Whale Cohort'))).toBe(false);
  });
  test('the Great Turtles are a primal sea beast (they swim and are raised only at sea)', () => {
    expect(KC_UNIT_CLASS.primalSea).toContain('Great Turtles');
    expect(KC_UNIT_CLASS.sea).toContain('Great Turtles');
  });
  test('the Unicorn Herd is cavalry; the bears and mammoths are not', () => {
    expect(KC_UNIT_CLASS.cavalry).toContain('Unicorn Herd');
    expect(KC_UNIT_CLASS.cavalry).not.toContain('Great Bears');
    expect(KC_UNIT_CLASS.cavalry).not.toContain('Mammoth Host');
  });
  test('the Great Turtles are a Creature among the sea-beasts', () => {
    expect(KC_UNIT_CLASS.creature).toContain('Great Turtles');
    expect(KC_UNIT_CLASS.monster).not.toContain('Great Turtles');
  });
});
