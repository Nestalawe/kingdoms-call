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
// - an old world's lairs are renamed once, and the upgrade returns how many (P1-15f1: the turn ran it before);
// - an old world's guardians are made 5 HP frailer once, their undamaged HP too, never below 5, and the upgrade returns
//   how many (a property: any HP, or none); a gap among the provinces or the features is passed over;
// - a guardian's brute strength in an older build's words is given its kind's words (R-137, P1-11e1); its other perks,
//   one with a second rider and one whose number is missing, keep theirs;
// - the retired Library (sd30) is struck from a realm's discoveries, with any gap in its list; a realm with no list
//   keeps none;
// - after the check, the turn-start repairs (P1-15f2: the turn ran them before): a hero of no realm wearing a beast's
//   race is given the people's race at his id (an id of 0, or below, too; a hero with no realm field keeps his); a
//   neutral guard who leads no companies, or stands in a realm's land, is made a wanderer (one leading companies on
//   unclaimed ground still guards); no garrison company keeps a stranded hull's marker, and the check, before the
//   repair, still names the leaked marker; a hero in a realm's service loses his "(wandering)" tag, and the upgrade
//   returns how many (a property: any race, realm and marker); gaps in the lists are passed over;
// - the reads that wrote an older save's field (P1-15f3: the readers wrote it in the turn before): a realm with no home
//   is given its first province, else its king's place, else none; after the check (which still names the old fields),
//   a realm's single consecrated province is folded into its list (a realm holding a list keeps it; one with neither is
//   given none), its tally of the items found under the retired Consumable slot folded into the Combat Item's, and a
//   feature an older save discovered for everyone, with no list of who discovered it, is known to every realm and given
//   an empty list (a gap among the features passed over; one discovered again is still known to all);
// - all of them at once, then the upgrade run again on what it left: the second run changes nothing and finds nothing.
// The world staged on is one that has played its first turn: its guardians already re-measured (a new world isn't:
// question 17). And a brand-new world through the upgrade changes nothing but what a known list names: each entry is a
// known defect, fixed in its own pull request, whose fix removes it (Mithril Armour is made at tier 1, and the upgrade
// raises it to its floor, tier 2; a new world's guardians are made 5 HP frailer, question 17, P1-23l), so the list only
// shrinks.
// Each staged case is certain on any world: it stages what it reads (a hero's items and his realm's discoveries, a
// home's race), so no seed can miss it. Each pass left out of the upgrade turns its cases red.
// Level 1 (unit): world generation and the upgrade, called directly on the engine's modules (plan P1-14a); no turn is
// played. Not static: it runs the passes. The turn's end telling what the upgrade found is the stages' tests
// (tests/lib/after-the-phases-cases.ts, tests/lib/new-turn-war-academy-to-the-final-reconcile-cases.ts).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `upgradeGameState` (`src/engine/saves/`), which brings a running game's save up to date before the turn reads it,
// called on a new world made by world generation (from `KC_SEED`), each old shape staged on a copy: a hero hired last
// turn with no earned-HP pool gets one and nothing is told; a save from before the pool has its heroes carried over,
// returned for the turn's end to tell, none kept on the save; guardians from an older table re-read from today's; a
// home lacking a unit of its people's roster offers it again; a pool offering the Corsair Fleet offers the Galleon (a
// Corsair company kept); a retired Sage discovery taken and counted, none kept on the save, a held one refreshed from
// the table; a company of a renamed unit renamed; an item's tier from today's tables; an old world's lairs renamed once,
// counted; its guardians 5 HP frailer once, never below 5, counted (a property), gaps passed over; a guardian's brute
// strength in an older build's words given its kind's (R-137), its other perks' kept; the Library struck
// with any gap, a realm with no list keeping none; after the check, a hero of no realm in a beast's race given the
// people's race at his id (id 0 and below too; no realm field: kept), a stranded guard made a wanderer (one guarding
// unclaimed ground kept), a garrison's stranded-hull marker taken off (the check still naming it), a crowned hero's
// "(wandering)" tag taken off, counted (a property; gaps passed over); a realm with no home given its first province,
// else its king's place; after the check (still naming them), a single consecration folded into the list, a Consumable
// tally into the Combat Item's, a feature discovered for everyone known to every realm. All at once, then again: the
// second run changes nothing and finds nothing. Four new worlds (2 to 6 realms) change only by a known list (Mithril
// Armour made at tier 1, raised to 2; the guardians 5 HP frailer, counted: known defects, whose fixes remove them). Each pass or repair left
// out turns its cases red (18 of 18). What it compares is the passes' counts: the check's findings (P1-15d) are its own test's,
// since a world made by world generation alone isn't a save the GM page wrote (Turn 0 adds the turn mode and the bots'
// settings)
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import '../lib/the-whole-engine.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { generateBotSetups } from '../../src/engine/bots/setup.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { homeProvinceIdFor } from '../../src/engine/grand-design.ts';
import {
  discoverFeat,
  featDiscovered,
} from '../../src/engine/sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { RACES_P, fullRaceLandRoster } from '../../src/engine/world/tables.ts';
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
  const setups = generateBotSetups([], realms, 0).map((b) => ({
    ...b,
    gamePlayerId: 'gp' + String(b.id),
    name: b.kingdomName,
  }));
  return JSON.parse(JSON.stringify(generateNewGame(setups, { cols, rows }, 0, {}))) as Save;
}
/** A save of a world that has played its first turn: its guardians are re-measured then (world generation doesn't mark
 *  a new world's: question 17, P1-23l), so only a case that stages an old world sees the cut. */
const WORLD = newWorld(3, 10, 8);
WORLD._guardianHpV2 = true;
/** What the upgrade's passes counted. The check's findings are left out: a world made by world generation and staged
 *  here isn't a save the GM page wrote (Turn 0 adds the turn mode and the bots' settings), so the check names those;
 *  the check has its own test (a-save-the-check-refuses-still-plays-and-the-gm-is-told.test.ts, P1-15d). */
type TheCounts = Omit<WhatTheSavesUpgradeFound, 'whereTheSaveDiffersFromThisBuildsSchema'>;
const countsOf = ({
  retiredSageDiscoveriesRemoved,
  heroesCarriedOverToTheEarnedHpPool,
  lairsRenamed,
  guardiansCut,
  heroesInARealmsServiceWhoseWanderingTagWasTakenOff,
}: WhatTheSavesUpgradeFound): TheCounts => ({
  retiredSageDiscoveriesRemoved,
  heroesCarriedOverToTheEarnedHpPool,
  lairsRenamed,
  guardiansCut,
  heroesInARealmsServiceWhoseWanderingTagWasTakenOff,
});
const NOTHING_FOUND: TheCounts = {
  retiredSageDiscoveriesRemoved: 0,
  heroesCarriedOverToTheEarnedHpPool: [],
  lairsRenamed: 0,
  guardiansCut: 0,
  heroesInARealmsServiceWhoseWanderingTagWasTakenOff: 0,
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
/** Every lair of the world with a guardian (a ritual site's keeper aside), in the map's order. */
const lairsOf = (s: Save) => s.world.provinces.flatMap((p) => p.features).filter((f) => f.monster && !f.ritualSite);
/** How many guardians of the world hold an HP (a ritual site's keeper aside). */
const guardiansWithHp = (s: Save) => lairsOf(s).filter((f) => f.monster?.hp != null).length;
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
/** A land province no realm holds. */
const unclaimed = (s: Save): Province =>
  must(
    s.world.provinces.find((p) => p.terrain !== 'sea' && p.owner == null),
    'land province no realm holds',
  );
/** A hero of no realm (a copy of realm 0's king, with an id of his own), at a land province no realm holds, leading no
 *  companies, with `extra` over him; added to the save. */
function aHeroOfNoRealm(s: Save, extra: Loose = {}): Hero {
  const king = must(
    s.characters.find((c) => c.isKing && c.player === 0),
    'king of realm 0',
  );
  const id = Math.max(...s.characters.map((c) => c.id)) + 1;
  const hero: Hero = Object.assign(copy(king), {
    id,
    player: null,
    isKing: false,
    name: 'Mira the Nomad',
    location: unclaimed(s).id,
    armies: [],
    ...extra,
  });
  s.characters.push(hero);
  return hero;
}
/** The people's race a hero of no realm wearing a beast's race is given: the race at his id, round the list. */
const theRaceAt = (id: number) => RACES_P[((id % RACES_P.length) + RACES_P.length) % RACES_P.length];
const heroOf = (s: Save, id: unknown) =>
  must(
    s.characters.find((c) => c.id === id),
    'staged hero',
  );
/** Every garrison company of the world holding a stranded hull's marker. */
const heldHulls = (s: Save) =>
  s.world.provinces.flatMap((p) => p.garrisonArmies).filter((u) => Reflect.get(u, '_navalHold') != null);
const aCompany = (s: Save) => must(s.characters.flatMap((c) => c.armies).find(Boolean), 'company led by a hero');
/** Two features of the world no realm has discovered (neither holds a list of who has). */
const undiscovered = (s: Save) => {
  const found = s.world.provinces.flatMap((p) => p.features).filter((f) => !f.discovered && !('discoveredBy' in f));
  return [must(found[0], 'an undiscovered feature'), must(found[1], 'a second undiscovered feature')];
};
const firstRename = must(Object.entries(LEGACY_UNIT_RENAMES)[0], 'renamed unit');
const aTreasuryItem = must(
  (ALL_MAGIC_ITEMS_P as Loose[]).find((it) => typeof it['tier'] === 'number' && typeof it['name'] === 'string'),
  'item in the treasury',
);
const aHeldDiscovery = must(
  Object.values(DISC_BY_ID).find((d) => d.id !== 'sd34'),
  'discovery in the table',
);

/** Each old shape a pass mends: staged on a copy of the new world, then what must be true once it is upgraded. */
interface OldShape {
  name: string;
  /** The pass that mends it. */
  pass: string;
  stage: (s: Save) => unknown;
  /** What the upgraded save holds (got) beside what it must (want). */
  mended: (s: Save, staged: unknown, found: TheCounts) => { got: unknown; want: unknown };
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
      const unit = must(fullRaceLandRoster(realm.race)[0], 'unit of the roster');
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
          held: [[aHeldDiscovery.id, aHeldDiscovery.name, aHeldDiscovery.desc]],
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
  {
    name: "an old world's lairs are renamed once, each uniquely, and the upgrade returns how many",
    pass: 'renameLairsThematicP',
    stage(s) {
      delete loose(s)['_lairNamesV3'];
      for (const f of lairsOf(s)) f.name = 'An Old Name';
    },
    mended(s, _, found) {
      const names = lairsOf(s).map((f) => f.name);
      return {
        got: {
          flag: s._lairNamesV3,
          found,
          old: names.filter((n) => n === 'An Old Name'),
          unique: new Set(names).size,
        },
        want: {
          flag: true,
          found: { ...NOTHING_FOUND, lairsRenamed: lairsOf(WORLD).length },
          old: [],
          unique: names.length,
        },
      };
    },
  },
  {
    name: "an old world's guardians are made 5 HP frailer once, never below 5, and the upgrade returns how many",
    pass: 'everyGuardianOfAnOldWorldFiveHpFrailer',
    stage(s) {
      delete loose(s)['_guardianHpV2'];
      const [a, b] = lairsOf(s).map((f) => must(f.monster, 'guardian'));
      Object.assign(must(a, 'first guardian'), { hp: 12, _hpFull: 14 });
      Object.assign(must(b, 'second guardian'), { hp: 7, _hpFull: 8 });
    },
    mended(s, _, found) {
      const [a, b] = lairsOf(s).map((f) => f.monster);
      return {
        got: { hp: [a?.hp, a?._hpFull, b?.hp, b?._hpFull], flag: s._guardianHpV2, found },
        want: { hp: [7, 9, 5, 5], flag: true, found: { ...NOTHING_FOUND, guardiansCut: guardiansWithHp(WORLD) } },
      };
    },
  },
  {
    name: "a guardian's brute strength in an older build's words reads as it fights now (R-137); its other perks' words (a second rider's, a number's gap), and a gap among them, are kept",
    pass: 'everyGuardiansBruteStrengthInTheWordsOfItsKind',
    stage(s) {
      const [a, b] = lairsOf(s).map((f) => must(f.monster, 'guardian'));
      must(a, 'first guardian').passives = [
        { name: "Titan's Strength", fx: { dmgBonus: 4 }, desc: '+4 damage on every blow and special' },
        { name: 'Stone Skin', fx: { ward: 'meleeDR', amt: 3 }, desc: 'every blow against it deals 3 less' },
      ];
      must(b, 'second guardian').passives = [
        null as never,
        { name: 'Made-up Club', fx: { dmgBonus: 1 }, desc: 'hits a little harder' },
        { name: 'Made-up Eye', fx: { hitBonus: 5 }, desc: 'sees a little better' },
        { name: 'Made-up Knack', fx: { dmgBonus: 2, hitBonus: 5 }, desc: 'hits harder and truer' },
        { name: 'Made-up Husk', fx: { dmgBonus: null }, desc: 'a husk' } as never,
      ];
    },
    mended(s, _, found) {
      const [a, b] = lairsOf(s).map((f) => f.monster);
      return {
        got: { a: a?.passives.map((p) => p.desc), b: b?.passives.map((p) => (p as Loose | null)?.['desc']), found },
        want: {
          a: ["+4 damage on every blow; a special's weight multiplies it", 'every blow against it deals 3 less'],
          b: [
            undefined,
            "+1 damage on every blow; a special's weight multiplies it",
            'sees a little better',
            'hits harder and truer',
            'a husk',
          ],
          found: NOTHING_FOUND,
        },
      };
    },
  },
  {
    name: 'the retired Library (sd30) is struck from a realm that found it, with any gap in its list; the rest kept',
    pass: 'theLibraryStruckFromEveryRealm',
    stage(s) {
      must(s.players[0], 'realm 0').discoveries = [
        { id: 'sd30', name: 'The Library' },
        { ...aHeldDiscovery },
        null,
        { id: 'sd30' },
      ] as never;
    },
    mended(s) {
      return {
        got: (must(s.players[0], 'realm 0').discoveries as (Loose | null)[]).map((d) => d?.['id']),
        want: [aHeldDiscovery.id],
      };
    },
  },
  {
    name: "a hero of no realm wearing a beast's race (Monster, Creature) is given the people's race at his id",
    pass: 'everyNeutralHeroWearingABeastsRaceGivenAPeoplesRace',
    stage(s) {
      return [aHeroOfNoRealm(s, { race: 'Monster' }).id, aHeroOfNoRealm(s, { race: 'Creature' }).id];
    },
    mended(s, ids, found) {
      const [a, b] = ids as number[];
      return {
        got: { races: [heroOf(s, a).race, heroOf(s, b).race], found },
        want: { races: [theRaceAt(Number(a)), theRaceAt(Number(b))], found: NOTHING_FOUND },
      };
    },
  },
  {
    name: "a neutral guard who leads no companies, or stands in a realm's land, is made a wanderer; one leading companies on unclaimed ground still guards",
    pass: 'normaliseStrandedGuards',
    stage(s) {
      const company = copy(aCompany(s));
      return [
        aHeroOfNoRealm(s, { _isNeutralGuard: true }).id,
        aHeroOfNoRealm(s, { _isNeutralGuard: true, armies: [company], location: homeOf(s, 1).id }).id,
        aHeroOfNoRealm(s, { _isNeutralGuard: true, armies: [company] }).id,
      ];
    },
    mended(s, ids) {
      const heroes = (ids as number[]).map((id) => heroOf(s, id));
      return {
        got: heroes.map((h) => [h._isNeutralGuard, h.name]),
        want: [
          [false, 'Mira the Nomad (wandering)'],
          [false, 'Mira the Nomad (wandering)'],
          [true, 'Mira the Nomad'],
        ],
      };
    },
  },
  {
    name: "no garrison company keeps a stranded hull's marker; the company is kept",
    pass: 'noGarrisonCompanyCarriesAStrandedHullsMarker',
    stage(s) {
      const home = homeOf(s, 0);
      home.garrisonArmies.push(
        { ...copy(aCompany(s)), _navalHold: 2 } as never,
        {
          ...copy(aCompany(s)),
          _navalHold: 0,
        } as never,
      );
      return home.garrisonArmies.length;
    },
    mended(s, length) {
      return { got: [heldHulls(s), homeOf(s, 0).garrisonArmies.length], want: [[], length] };
    },
  },
  {
    name: 'a hero in a realm\'s service loses his "(wandering)" tag, and the upgrade returns how many',
    pass: 'normaliseOwnedNames',
    stage(s) {
      const [a, b] = realmsHeroes(s);
      const first = must(a, 'a realm hero');
      const second = must(b, 'a second realm hero');
      const names = [first.name, second.name];
      first.name = `${first.name} (wandering)`;
      second.name = `${second.name} (Wandering)`;
      return [[first.id, second.id], names];
    },
    mended(s, staged, found) {
      const [ids, names] = staged as [number[], string[]];
      return {
        got: { names: ids.map((id) => heroOf(s, id).name), found },
        want: { names, found: { ...NOTHING_FOUND, heroesInARealmsServiceWhoseWanderingTagWasTakenOff: 2 } },
      };
    },
  },
  {
    name: 'a realm of an older save with no home is given its first province, once',
    pass: 'everyRealmWithoutAHomeGivenOne',
    stage(s) {
      const realm = loose(must(s.players[2], 'realm 2'));
      delete realm['homeProvinceId'];
      return must(must(s.players[2], 'realm 2').provinces[0], "realm 2's first province");
    },
    mended(s, first, found) {
      return {
        got: { home: loose(must(s.players[2], 'realm 2'))['homeProvinceId'], found },
        want: { home: first, found: NOTHING_FOUND },
      };
    },
  },
  {
    name: "a realm's single consecrated province of an older save is folded into its list, the old field taken off",
    pass: 'theOldSingleConsecrationFoldedIntoTheList',
    stage(s) {
      const one = loose(must(s.players[1], 'realm 1'));
      const none = loose(must(s.players[2], 'realm 2'));
      delete one['consecratedProvIds'];
      delete none['consecratedProvIds'];
      one['consecratedProvId'] = homeOf(s, 1).id;
      none['consecratedProvId'] = null;
      return homeOf(s, 1).id;
    },
    mended(s, id) {
      const realms = [1, 2].map((i) => loose(must(s.players[i], `realm ${String(i)}`)));
      return {
        got: realms.map((r) => [r['consecratedProvIds'], 'consecratedProvId' in r]),
        want: [
          [[id], false],
          [[], false],
        ],
      };
    },
  },
  {
    name: "a realm's tally of the items it found under the retired Consumable slot is folded into the Combat Item's",
    pass: 'theOldCombatTallyFoldedIntoTheNew',
    stage(s) {
      loose(must(s.players[1], 'realm 1'))['_itemsFoundByCat'] = { consumable: 2 };
      loose(must(s.players[2], 'realm 2'))['_itemsFoundByCat'] = { weapon: 1, combat: 3, consumable: 2 };
      return null;
    },
    mended(s) {
      return {
        got: [1, 2].map((i) => loose(must(s.players[i], `realm ${String(i)}`))['_itemsFoundByCat']),
        want: [{ combat: 2 }, { weapon: 1, combat: 5 }],
      };
    },
  },
  {
    name: 'a feature an older save discovered for everyone, with no list of who discovered it, is known to every realm and given an empty list',
    pass: 'everyFeatureAnOlderSaveDiscoveredKnownToEveryRealm',
    stage(s) {
      const [old, never] = undiscovered(s);
      const f = loose(must(old, 'an undiscovered feature'));
      f['discovered'] = true;
      delete f['discoveredBy'];
      delete f['_legacyAll'];
      return [old, never];
    },
    mended(_s, staged) {
      const [old, never] = (staged as Loose[]).map(loose);
      return {
        got: [old, never].map((f) => [f?.['discovered'], f?.['discoveredBy'], f?.['_legacyAll']]),
        want: [
          [true, [], true],
          [false, undefined, undefined],
        ],
      };
    },
  },
];

describe("a saved game's old shapes are mended before the turn (upgradeGameState)", () => {
  test.each(OLD_SHAPES.map((c) => [c.name, c] as const))('%s', (_, c) => {
    const s = copy(WORLD);
    const staged = c.stage(s);
    const { got, want } = c.mended(s, staged, countsOf(upgradeGameState(s)));
    expect(got).toEqual(want);
  });

  test('every old shape at once, then the upgrade again: the second run changes nothing and finds nothing', () => {
    const s = copy(WORLD);
    const staged = OLD_SHAPES.map((c) => c.stage(s));
    upgradeGameState(s);
    const once = copy(s);
    expect(countsOf(upgradeGameState(s))).toEqual(NOTHING_FOUND);
    expect(s).toEqual(once);
    expect(staged).toHaveLength(OLD_SHAPES.length);
  });

  test("an old world's guardians, any HP or none: each 5 HP frailer, never below 5, its undamaged HP too; only those with HP counted", () => {
    const hp = fc.option(fc.integer({ min: 0, max: 40 }), { nil: null });
    fc.assert(
      fc.property(fc.array(fc.tuple(hp, hp), { minLength: 1, maxLength: 4 }), (guards) => {
        const s = copy(WORLD);
        delete loose(s)['_guardianHpV2'];
        const lairs = lairsOf(s);
        lairs.forEach((f, i) => {
          const [h, full] = guards[i] ?? [null, null];
          const m = loose(must(f.monster, 'guardian'));
          if (h == null) delete m['hp'];
          else m['hp'] = h;
          if (full == null) delete m['_hpFull'];
          else m['_hpFull'] = full;
        });
        const found = upgradeGameState(s);
        const cut = (v: number | null) => (v == null ? null : Math.max(5, v - 5));
        const want = lairs.map((_, i) => {
          const [h, full] = guards[i] ?? [null, null];
          return [cut(h), cut(full)];
        });
        expect(lairsOf(s).map((f) => [f.monster?.hp ?? null, f.monster?._hpFull ?? null])).toEqual(want);
        expect(found.guardiansCut).toBe(guards.filter(([h]) => h != null).length);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  test("the guardians' cut passes over gaps among the provinces and the features, and marks the world done", () => {
    const s = copy(WORLD);
    delete loose(s)['_guardianHpV2'];
    const ps = s.world.provinces as unknown as (Loose | null)[];
    const bare = ps.findIndex((p) => p && !(p['features'] as unknown[] | undefined)?.length);
    ps[bare] = null;
    must(
      s.world.provinces.find((p) => p.features.length > 0),
      'province with features',
    ).features.unshift(null as never, { ritualSite: false, monster: null } as never);
    expect(countsOf(upgradeGameState(s))).toEqual({ ...NOTHING_FOUND, guardiansCut: guardiansWithHp(WORLD) });
    expect(s._guardianHpV2).toBe(true);
  });

  test('a realm with no list of discoveries keeps none', () => {
    const s = copy(WORLD);
    loose(must(s.players[1], 'realm 1'))['discoveries'] = null;
    upgradeGameState(s);
    expect(loose(must(s.players[1], 'realm 1'))['discoveries']).toBeNull();
  });

  test("a hero of no realm with an id of 0 wearing a beast's race is given the first people's race; an id below 0 counts round the list; a hero with no realm field keeps a beast's race", () => {
    const s = copy(WORLD);
    const none = aHeroOfNoRealm(s, { race: 'Monster' });
    const below = aHeroOfNoRealm(s, { race: 'Creature' });
    const unrecorded = aHeroOfNoRealm(s, { race: 'Monster' });
    loose(none)['id'] = 0;
    loose(below)['id'] = -1;
    delete loose(unrecorded)['player'];
    upgradeGameState(s);
    expect([none.race, below.race, unrecorded.race]).toEqual([RACES_P[0], RACES_P.at(-1), 'Monster']);
  });

  test("the check, before the repairs, still names a leaked stranded hull's marker; the repair then takes it off", () => {
    const s = copy(WORLD);
    const home = homeOf(s, 0);
    home.garrisonArmies.push({ ...copy(aCompany(s)), _navalHold: 3 } as never);
    const where = `world.provinces.${String(s.world.provinces.indexOf(home))}.garrisonArmies.${String(home.garrisonArmies.length - 1)}`;
    const found = upgradeGameState(s);
    expect(found.whereTheSaveDiffersFromThisBuildsSchema.filter((p) => p.startsWith(where))).toEqual([
      `${where}: a field this build doesn't know, _navalHold`,
    ]);
    expect(heldHulls(s)).toEqual([]);
  });

  test("the check, before the folds, still names an older save's single consecration and its Consumable tally; the folds then mend them", () => {
    const s = copy(WORLD);
    const realm = loose(must(s.players[1], 'realm 1'));
    delete realm['consecratedProvIds'];
    realm['consecratedProvId'] = homeOf(s, 1).id;
    realm['_itemsFoundByCat'] = { consumable: 2 };
    const found = upgradeGameState(s);
    expect(found.whereTheSaveDiffersFromThisBuildsSchema.filter((p) => p.startsWith('players.1'))).toEqual([
      "players.1._itemsFoundByCat: a field this build doesn't know, consumable",
      "players.1: a field this build doesn't know, consecratedProvId",
    ]);
    expect([realm['consecratedProvIds'], realm['_itemsFoundByCat']]).toEqual([[homeOf(s, 1).id], { combat: 2 }]);
  });

  test('the repairs pass over gaps among the provinces and the garrisons', () => {
    const s = copy(WORLD);
    const named = must(realmsHeroes(s)[0], 'a realm hero');
    const name = named.name;
    named.name = `${name} (wandering)`;
    homeOf(s, 0).garrisonArmies.push(null as never);
    const ps = s.world.provinces as unknown as (Loose | null)[];
    ps[ps.findIndex((p) => p && !(p['features'] as unknown[] | undefined)?.length)] = null;
    expect(upgradeGameState(s).heroesInARealmsServiceWhoseWanderingTagWasTakenOff).toBe(1);
    expect(named.name).toBe(name);
  });

  test("a realm of an older save with no home and no land is given its king's place; one with no king either keeps none", () => {
    const s = copy(WORLD);
    const [one, two] = [1, 2].map((i) => must(s.players[i], `realm ${String(i)}`));
    const king = must(
      s.characters.find((c) => c.isKing && c.player === 2),
      'king of realm 2',
    );
    for (const r of [one, two]) {
      delete loose(must(r, 'realm'))['homeProvinceId'];
      must(r, 'realm').provinces = [];
    }
    king.isKing = false;
    upgradeGameState(s);
    const kingOfOne = must(
      s.characters.find((c) => c.isKing && c.player === 1),
      'king of realm 1',
    );
    expect([loose(must(one, 'realm 1'))['homeProvinceId'], 'homeProvinceId' in must(two, 'realm 2')]).toEqual([
      kingOfOne.location,
      false,
    ]);
  });

  test('a realm holding a list of consecrated provinces keeps it, and the old field beside it; a realm with neither is given no list', () => {
    const s = copy(WORLD);
    const both = loose(must(s.players[1], 'realm 1'));
    const neither = loose(must(s.players[2], 'realm 2'));
    both['consecratedProvIds'] = [3];
    both['consecratedProvId'] = 4;
    delete neither['consecratedProvIds'];
    delete neither['consecratedProvId'];
    upgradeGameState(s);
    expect([both['consecratedProvIds'], both['consecratedProvId'], 'consecratedProvIds' in neither]).toEqual([
      [3],
      4,
      false,
    ]);
  });

  test('a realm with no tally, or one with no Consumable count, keeps it as it is', () => {
    const s = copy(WORLD);
    loose(must(s.players[1], 'realm 1'))['_itemsFoundByCat'] = null;
    loose(must(s.players[2], 'realm 2'))['_itemsFoundByCat'] = { combat: 3 };
    upgradeGameState(s);
    expect([1, 2].map((i) => loose(must(s.players[i], `realm ${String(i)}`))['_itemsFoundByCat'])).toEqual([
      null,
      { combat: 3 },
    ]);
  });

  test('a feature an older save discovered for everyone, once upgraded and discovered again by one realm, is still known to every realm; a gap among the features is passed over', () => {
    const s = copy(WORLD);
    const [old] = undiscovered(s);
    const f = must(old, 'an undiscovered feature');
    f.discovered = true;
    must(
      s.world.provinces.find((p) => p.features.includes(f)),
      "the feature's province",
    ).features.unshift(null as never);
    upgradeGameState(s);
    expect(discoverFeat(f, 1)).toBe(false);
    expect([0, 1, 2].map((i) => featDiscovered(f, i))).toEqual([true, true, true]);
  });

  test("the repairs, any hero's race, realm and life, any garrison's markers: a people's race on every hero of no realm who wore a beast's, every other race kept; no stranded hull's marker; every crowned hero's tag off, counted", () => {
    const heroSpec = fc.record({
      player: fc.constantFrom(null, 0, 1, 2),
      alive: fc.boolean(),
      race: fc.constantFrom('Monster', 'Creature', 'Human', 'Elven'),
      tag: fc.constantFrom('', ' (wandering)', ' (Wandering)'),
    });
    fc.assert(
      fc.property(
        fc.array(heroSpec, { maxLength: 6 }),
        fc.array(fc.option(fc.integer({ min: 0, max: 4 }), { nil: undefined }), { maxLength: 4 }),
        (specs, holds) => {
          const s = copy(WORLD);
          const heroes = specs.map((x) =>
            aHeroOfNoRealm(s, {
              player: x.player,
              alive: x.alive,
              race: x.race,
              name: 'Mira the Nomad' + x.tag,
              armies: [copy(aCompany(s))],
            }),
          );
          const home = homeOf(s, 0);
          home.garrisonArmies = holds.map((h) => ({
            ...copy(aCompany(s)),
            ...(h === undefined ? {} : { _navalHold: h }),
          }));
          const found = upgradeGameState(s);
          heroes.forEach((h, i) => {
            const x = must(specs[i], 'spec');
            const beast = x.race === 'Monster' || x.race === 'Creature';
            expect(h.race).toBe(x.player === null && beast ? theRaceAt(h.id) : x.race);
            expect(h.name).toBe(x.player === null ? 'Mira the Nomad' + x.tag : 'Mira the Nomad');
          });
          expect(heldHulls(s)).toEqual([]);
          expect(found.heroesInARealmsServiceWhoseWanderingTagWasTakenOff).toBe(
            specs.filter((x) => x.player !== null && x.tag !== '').length,
          );
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
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
  {
    what: "a new world's guardians are made 5 HP frailer on its first turn, never below 5, and the world marked so (world generation doesn't mark it: question 17, P1-23l)",
    matches: (d) =>
      d.path === '_guardianHpV2'
        ? d.was === undefined && d.is === true
        : /\.monster\.(hp|_hpFull)$/.test(d.path) && typeof d.was === 'number' && d.is === Math.max(5, d.was - 5),
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
    expect(countsOf(upgradeGameState(upgraded))).toEqual({ ...NOTHING_FOUND, guardiansCut: guardiansWithHp(world) });
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
