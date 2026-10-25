// A running game's save holds what older builds wrote. Before the turn reads it, upgradeGameState
// (src/engine/saves/upgrade-a-saved-game-and-check-it.ts, plan P1-15a) brings it up to date with the six passes the
// turn ran at its start. Here, on a new world made by world generation (seeded from KC_SEED), each old shape a pass
// mends is staged on a copy, and the upgrade called:
// - a hero hired last turn, with no earned-HP pool yet, gets one, and nothing is told; a save from before the pool has
//   its heroes carried over, and the upgrade returns them for the turn's end to tell (the save keeps no note);
// - lairs' guardians from an older guardian table are re-read from today's;
// - a realm's home that lacks a unit of its people's roster offers it again;
// - a pool offering the retired Corsair Fleet offers the Galleon Fleet instead (a Corsair company already raised is
//   kept);
// - a retired Sage discovery is taken from the realm, and the upgrade returns the count (the save keeps none); a held
//   discovery reads as the table says now;
// - a company of a unit renamed since is called by its name now;
// - an item whose tier was stamped by an older table has today's;
// - all of them at once, then the upgrade run again on what it left: the second run changes nothing and finds nothing.
// And a brand-new world through the upgrade changes nothing but what a known list names: each entry is a known defect,
// fixed in its own pull request, whose fix removes it (Mithril Armour is made at tier 1, and the upgrade raises it to
// its floor, tier 2), so the list only shrinks.
// Each staged case is certain on any world: it stages what it reads (a hero's items and his realm's discoveries, a
// home's race), so no seed can miss it. Each pass left out of the upgrade turns its cases red.
// Level 1 (unit): world generation and the upgrade, called directly on the engine's modules (plan P1-14a); no turn is
// played. Not static: it runs the passes. The turn's end telling what the upgrade found is the stages' tests
// (tests/lib/after-the-phases-cases.ts, tests/lib/new-turn-war-academy-to-the-final-reconcile-cases.ts).
import { describe, expect, test } from 'vitest';
import '../lib/the-whole-engine.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { generateBotSetups } from '../../src/engine/bots/setup.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { homeProvinceIdFor } from '../../src/engine/grand-design.ts';
import { fullRaceLandRoster } from '../../src/engine/world/tables.ts';
import { LEGACY_UNIT_RENAMES } from '../../src/engine/army-tables.ts';
import { GUARDIAN_TABLE_VER } from '../../src/engine/heroes/skills-and-hp.ts';
import { DISC_BY_ID } from '../../src/engine/discoveries.ts';
import { MITHRIL_ARMOUR } from '../../src/engine/heroes/fame-and-consecration.ts';
import { ALL_MAGIC_ITEMS_P, MONSTERS_P } from '../../src/content/kingdoms-call-data.ts';
import {
  upgradeGameState,
  type WhatTheSavesUpgradeFound,
} from '../../src/engine/saves/upgrade-a-saved-game-and-check-it.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** A save as the upgrade takes it. */
type Save = Parameters<typeof upgradeGameState>[0];
type Hero = Save['characters'][number];
type Province = Save['world']['provinces'][number];
/** Any object of a save, read or written by a field an older save may hold, or a test stages. */
type Loose = Record<string, unknown>;
const loose = (o: object) => o as Loose;
const copy = <T>(o: T): T => structuredClone(o);
const must = <T>(v: T | undefined | null, what: string): T => {
  if (v == null) throw new Error(`the new world has no ${what}`);
  return v;
};

/** A new world of `realms` bot realms on a map of `cols` by `rows`, from the seed. */
function newWorld(realms: number, cols: number, rows: number, seed = SEED): Save {
  kcRng.seed(seed);
  const setups = (generateBotSetups([], realms, 0) as Loose[]).map((b) => ({
    ...b,
    gamePlayerId: 'gp' + String(b['id']),
    name: b['kingdomName'],
  }));
  return JSON.parse(JSON.stringify(generateNewGame(setups, { cols, rows }, 0, {}))) as Save;
}
const WORLD = newWorld(3, 10, 8);
const NOTHING_FOUND: WhatTheSavesUpgradeFound = {
  retiredSageDiscoveriesRemoved: 0,
  heroesCarriedOverToTheEarnedHpPool: [],
};

const realmsHeroes = (s: Save) => s.characters.filter((c) => c.alive && c.player != null);
/** Realm 0's king, his pack emptied and his realm's discoveries cleared, so his maximum HP is his earned pool alone. */
function aKingWithNothingToAdd(s: Save): Hero {
  const king = must(
    s.characters.find((c) => c.isKing && c.player === 0),
    'king of realm 0',
  );
  king.items = [];
  must(s.players[0], 'realm 0').discoveries = [];
  return king;
}
const aLairGuardian = (s: Save) =>
  must(
    s.world.provinces.flatMap((p) => p.features).find((f) => f.monster && !f.cleared),
    'uncleared lair with a guardian',
  );
const homeOf = (s: Save, realm: number): Province =>
  must(s.world.provinces[must(homeProvinceIdFor(s, realm), `home of realm ${String(realm)}`)], 'home province');
/** A land province no realm calls home. */
const notAHome = (s: Save): Province =>
  must(
    s.world.provinces.find(
      (p) =>
        p.terrain !== 'sea' &&
        Array.isArray(p.armyTypes) &&
        s.players.every((_, i) => homeProvinceIdFor(s, i) !== p.id),
    ),
    'land province that is no home',
  );
const aCompany = (s: Save) => must(s.characters.flatMap((c) => c.armies).find(Boolean), 'company led by a hero');
const firstRename = must(Object.entries(LEGACY_UNIT_RENAMES)[0], 'renamed unit');
const aTreasuryItem = must(
  (ALL_MAGIC_ITEMS_P as Loose[]).find((it) => typeof it['tier'] === 'number' && typeof it['name'] === 'string'),
  'item in the treasury',
);
const aHeldDiscovery = must(
  Object.values(DISC_BY_ID as Record<string, Loose>).find((d) => d['id'] !== 'sd34'),
  'discovery in the table',
);

/** Each old shape a pass mends: staged on a copy of the new world, then what must be true once it is upgraded. */
interface OldShape {
  name: string;
  /** The pass that mends it. */
  pass: string;
  stage: (s: Save) => unknown;
  /** What the upgraded save holds (got) beside what it must (want). */
  mended: (s: Save, staged: unknown, found: WhatTheSavesUpgradeFound) => { got: unknown; want: unknown };
}
const OLD_SHAPES: OldShape[] = [
  {
    name: 'a hero hired last turn has no earned-HP pool yet: he is given one, and nothing is told',
    pass: 'migrateMaxHpV2',
    stage(s) {
      const hero = aKingWithNothingToAdd(s);
      delete loose(hero)['hpEarned'];
      return hero.id;
    },
    mended(s, id, found) {
      const hero = must(
        s.characters.find((c) => c.id === id),
        'staged hero',
      );
      return {
        got: { pool: typeof hero.hpEarned, max: hero.maxHp, found },
        want: { pool: 'number', max: WORLD.characters.find((c) => c.id === id)?.maxHp, found: NOTHING_FOUND },
      };
    },
  },
  {
    name: 'a save from before the earned-HP pool: its heroes are carried over, and the upgrade returns them to be told',
    pass: 'migrateMaxHpV2',
    stage(s) {
      delete loose(s)['_maxHpV2'];
      delete loose(s)['_maxHpV3'];
      const hero = aKingWithNothingToAdd(s);
      delete loose(hero)['hpEarned'];
      hero.maxHp = 80;
      hero.hp = 80;
      return hero.id;
    },
    mended(s, id, found) {
      const hero = must(
        s.characters.find((c) => c.id === id),
        'staged hero',
      );
      return {
        got: { hp: [hero.maxHp, hero.hp, s._maxHpV3], found, kept: '_maxHpMigration' in s },
        want: {
          hp: [60, 60, true],
          found: { ...NOTHING_FOUND, heroesCarriedOverToTheEarnedHpPool: [{ charId: id, player: 0, old: 80, nu: 60 }] },
          kept: false,
        },
      };
    },
  },
  {
    name: "guardians from an older guardian table are re-read from today's",
    pass: 'migrateMaxHpV2',
    stage(s) {
      s._guardiansVer = GUARDIAN_TABLE_VER - 1;
      const lair = aLairGuardian(s);
      const guardian = must(lair.monster, 'guardian');
      guardian.hp = 999;
      loose(guardian)['passive'] = { name: 'An old perk', fx: 'old' };
      delete loose(guardian)['passives'];
      return lair.name;
    },
    mended(s, name) {
      const guardian = must(
        s.world.provinces.flatMap((p) => p.features).find((f) => f.name === name)?.monster,
        'guardian',
      );
      const table = must(
        (MONSTERS_P as Loose[]).find((m) => m['name'] === guardian.name),
        'guardian in the table',
      );
      return {
        got: [guardian.hp, 'passive' in guardian, guardian.passives, s._guardiansVer],
        want: [table['hp'], false, table['passives'], GUARDIAN_TABLE_VER],
      };
    },
  },
  {
    name: "a realm's home that lacks a unit of its people's roster offers it again",
    pass: 'backfillHomeRosters',
    stage(s) {
      const realm = must(s.players[0], 'realm 0');
      const home = homeOf(s, 0);
      home.race = realm.race;
      const unit = must((fullRaceLandRoster(realm.race) as string[])[0], 'unit of the roster');
      home.armyTypes = home.armyTypes.filter((t) => t !== unit);
      return unit;
    },
    mended(s, unit) {
      return { got: homeOf(s, 0).armyTypes.includes(String(unit)), want: true };
    },
  },
  {
    name: 'a pool offering the retired Corsair Fleet offers the Galleon Fleet instead; a Corsair company is kept',
    pass: 'retireCorsairPools',
    stage(s) {
      const p = notAHome(s);
      p.armyTypes = [...p.armyTypes.filter((t) => t !== 'Galleon Fleet'), 'Corsair Fleet'];
      aCompany(s).type = 'Corsair Fleet';
      return p.id;
    },
    mended(s, id) {
      const p = must(s.world.provinces[Number(id)], 'staged province');
      return {
        got: [p.armyTypes.includes('Corsair Fleet'), p.armyTypes.at(-1), aCompany(s).type],
        want: [false, 'Galleon Fleet', 'Corsair Fleet'],
      };
    },
  },
  {
    name: 'a retired Sage discovery is taken from the realm and counted for the GM; a held one reads as the table says',
    pass: 'retireDiscoveries',
    stage(s) {
      must(s.players[0], 'realm 0').discoveries = [
        { id: 'sd34', name: 'Mounted Couriers' },
        { ...aHeldDiscovery, name: 'An older name', desc: 'An older text' },
      ] as never;
    },
    mended(s, _, found) {
      const held = (must(s.players[0], 'realm 0').discoveries as Loose[]).map((d) => [d['id'], d['name'], d['desc']]);
      return {
        got: { held, found, kept: '_retiredDiscoveries' in s },
        want: {
          held: [[aHeldDiscovery['id'], aHeldDiscovery['name'], aHeldDiscovery['desc']]],
          found: { ...NOTHING_FOUND, retiredSageDiscoveriesRemoved: 1 },
          kept: false,
        },
      };
    },
  },
  {
    name: `a company of a unit renamed since (${firstRename[0]}) is called by its name now (${firstRename[1]})`,
    pass: 'migrateLegacyUnitNames',
    stage(s) {
      aCompany(s).type = firstRename[0];
    },
    mended(s) {
      return { got: aCompany(s).type, want: firstRename[1] };
    },
  },
  {
    name: "an item whose tier an older table stamped has today's",
    pass: 'migrateItemTiers',
    stage(s) {
      const tier = Number(aTreasuryItem['tier']);
      aKingWithNothingToAdd(s).items = [{ ...aTreasuryItem, tier: (tier % 4) + 1 }] as never;
    },
    mended(s) {
      const king = must(
        s.characters.find((c) => c.isKing && c.player === 0),
        'king',
      );
      return {
        got: king.items.map((it) => [it.name, it.tier]),
        want: [[aTreasuryItem['name'], aTreasuryItem['tier']]],
      };
    },
  },
];

describe("a saved game's old shapes are mended before the turn (upgradeGameState)", () => {
  test.each(OLD_SHAPES.map((c) => [c.name, c] as const))('%s', (_, c) => {
    const s = copy(WORLD);
    const staged = c.stage(s);
    const { got, want } = c.mended(s, staged, upgradeGameState(s));
    expect(got).toEqual(want);
  });

  test('every old shape at once, then the upgrade again: the second run changes nothing and finds nothing', () => {
    const s = copy(WORLD);
    const staged = OLD_SHAPES.map((c) => c.stage(s));
    upgradeGameState(s);
    const once = copy(s);
    expect(upgradeGameState(s)).toEqual(NOTHING_FOUND);
    expect(s).toEqual(once);
    expect(staged).toHaveLength(OLD_SHAPES.length);
  });
});

/** A difference between a new world and the same world upgraded: where, what it was, what it is. */
interface Difference {
  path: string;
  was: unknown;
  is: unknown;
  /** The object holding the field. */
  holder: Loose;
}
function differences(was: unknown, is: unknown, path = '', holder: Loose = {}): Difference[] {
  if (JSON.stringify(was) === JSON.stringify(is)) return [];
  if (was && is && typeof was === 'object' && typeof is === 'object') {
    const keys = new Set([...Object.keys(was), ...Object.keys(is)]);
    return [...keys].flatMap((k) => differences(loose(was)[k], loose(is)[k], path ? `${path}.${k}` : k, loose(is)));
  }
  return [{ path, was, is, holder }];
}
/** What the upgrade may change on a brand-new world: each a known defect, fixed in its own pull request, which removes
 *  its entry. */
const KNOWN: { what: string; matches: (d: Difference) => boolean }[] = [
  {
    what: 'Mithril Armour is made at tier 1; the upgrade raises it to its floor, tier 2',
    matches: (d) => d.path.endsWith('.tier') && d.holder['name'] === MITHRIL_ARMOUR.name && d.was === 1 && d.is === 2,
  },
];

describe('a brand-new world through the upgrade', () => {
  const WORLDS: [number, number, number][] = [
    [2, 8, 5],
    [3, 10, 8],
    [4, 12, 8],
    [6, 16, 10],
  ];
  test.each(WORLDS)('%i realms on %i by %i: nothing changes but what the known list names', (realms, cols, rows) => {
    const world = newWorld(realms, cols, rows);
    const upgraded = copy(world);
    expect(upgradeGameState(upgraded)).toEqual(NOTHING_FOUND);
    const unknown = differences(world, upgraded).filter((d) => !KNOWN.some((k) => k.matches(d)));
    expect(unknown.map((d) => `${d.path}: ${JSON.stringify(d.was)} → ${JSON.stringify(d.is)}`)).toEqual([]);
  });

  test('each known entry is still so: Mithril Armour as it is made is raised to tier 2 (its fix removes the entry)', () => {
    const s = copy(WORLD);
    aKingWithNothingToAdd(s).items = [{ ...MITHRIL_ARMOUR }] as never;
    expect(MITHRIL_ARMOUR.tier).toBe(1);
    upgradeGameState(s);
    expect(
      must(
        s.characters.find((c) => c.isKing && c.player === 0),
        'king',
      ).items.map((it) => it.tier),
    ).toEqual([2]);
  });

  test('a new world holds every realm hero with an earned-HP pool, so the upgrade carries nobody over', () => {
    expect(realmsHeroes(WORLD).every((c) => typeof c.hpEarned === 'number')).toBe(true);
  });
});
