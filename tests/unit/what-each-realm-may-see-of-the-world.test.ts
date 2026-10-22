// playerView (src/views/what-each-realm-may-see-of-the-world.ts, plan P1-12b4: P1-12's Decision 11, part 1): what one
// realm may see of the world, the province sections of its report read only this. One case for each sight rule the
// view applies, on a small world made here, so each rule is pinned on its own (the balance matrix's every-realm half
// checks the report built from the view, whole games, every realm):
// - its own provinces, whole; a province it once visited (as it is now, its owner named met or not: the known breach);
//   the ring next to those (the order forms' facts); a hero of its own there (the sight rule: Invisibility hides);
//   spied (the garrison's units, not their race); next to a spied one (the map's glance, not the hiring list's); next
//   to its own land (who holds it, the capital's crown); remembered; watched by Clairvoyance; unseen (its place only);
// - the features it knows; what its lines of the turn show (spied by its lines, battles witnessed, province events);
//   an Evil realm's Terror; the heroes of its own provinces, seen or not (the other known breach); Illusory Terrain;
// - and it writes nothing to the world.
// Level 1 (unit): the function is called on a world made in the test, on the engine's modules; no turn runs.
// refactor-only: P1-12b4 adds the function (the base has none), and each case is red on a sight fault planted in it.
import { describe, expect, test } from 'vitest';
import type { GameState } from '../../src/schemas/saved-game-state.ts';
import {
  playerView,
  type PlayerView,
  type ProvinceAsSeen,
  type WhatItsLinesShow,
} from '../../src/views/what-each-realm-may-see-of-the-world.ts';

const TURN = 4;
const COLS = 6;
const ROWS = 4;
const army = (type = 'Shieldwall Levies') => ({ type, quality: 'Average', race: 'Human', unitName: 'Old Guard' });
const lair = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  monster: { name: 'Cave Troll', cat: 'giant', power: 'Strong' },
  discovered: false,
  cleared: false,
  treasure: 50,
  ...extra,
});
const hero = (id: number, player: number | null, location: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Hero ${String(id)}`,
  isKing: false,
  player,
  race: 'Human',
  alignment: 'Neutral',
  temper: 'Brave',
  skills: { melee: 3, spy: 1 },
  armies: [],
  items: [],
  location,
  alive: true,
  pay: 2,
  ...extra,
});

/** A 6 × 4 world. Realm 0 (Esterhold, Good) holds 7, its capital, where its king stands, with an Invisible hero of realm
 *  1 beside him; it once visited 3 (realm 1's); its hero stands in 16 (Illusory Terrain cast by realm 1 there) beside
 *  realm 1's hero leading three units, an Invisible one and a wanderer; it spied 21 (realm 1's); a wanderer stands in
 *  22, next to it; it remembers 10; it watches realm 1's hero in 19 by Clairvoyance. Realm 1 (Varn, Evil) holds 3, 8
 *  (its capital, next to realm 0's land) and 21; a Terror grips 5; battles were fought in 18 and 23. */
function world() {
  const provinces = Array.from({ length: COLS * ROWS }, (_, id) => ({
    id,
    row: Math.floor(id / COLS),
    col: id % COLS,
    name: `Province ${String(id)}`,
    terrain: 'plain',
    tax: 5,
    race: 'Human',
    population: 1000,
    owner: null as number | null,
    features: [] as unknown[],
    npcArmies: 0,
    neutralDefenders: [] as unknown[],
    explored: 0,
    characters: [] as number[],
    armyTypes: ['Shieldwall Levies'],
    garrisonArmies: [] as unknown[],
    visitedBy: [] as number[],
    exploredBy: {},
    _hadBattleThisTurn: false,
  }));
  const at = (id: number) => {
    const p = provinces[id];
    if (!p) throw new Error(`no province ${String(id)}`);
    return p;
  };
  const characters = [
    hero(0, 0, 7, { isKing: true, armies: [army()] }), // realm 0's king, at home
    hero(1, 0, 16), // realm 0's hero, abroad
    hero(2, 1, 16, { armies: [army(), army(), army()] }), // realm 1's hero beside him
    hero(3, 1, 16, { _invisTurn: TURN }), // realm 1's hero under Invisibility
    hero(4, 1, 7, { _invisTurn: TURN }), // realm 1's Invisible hero in realm 0's capital
    hero(5, null, 22, { alignment: 'Good' }), // a wanderer next to the spied province
    hero(6, null, 16, { alignment: 'Good', skills: { melee: 2, archery: 4 } }), // a wanderer beside realm 0's hero
    hero(7, 1, 19), // realm 1's hero, watched by realm 0's Clairvoyance
    hero(8, 1, 14, { armies: [army(), army()] }), // realm 1's hero in a province realm 0 spied by its lines
  ];
  for (const c of characters) at(c.location).characters.push(c.id);
  Object.assign(at(7), { owner: 0, garrisonArmies: [army()] });
  at(7).features = [
    lair('Standing Stones', { ritualSite: true, monster: null }),
    lair('Troll Den', { discoveredBy: [0] }),
    lair('Hidden Den'),
  ];
  Object.assign(at(3), {
    owner: 1,
    visitedBy: [0],
    exploredBy: { '0': 60 },
    garrisonArmies: [army()],
    neutralDefenders: [army(), army()],
  });
  at(3).features = [lair('Old Barrow'), lair('Moon Ring', { ritualSite: true })];
  Object.assign(at(8), { owner: 1, garrisonArmies: [army()] });
  Object.assign(at(21), { owner: 1, garrisonArmies: [army()] });
  Object.assign(at(16), { terrain: 'forest', _illusoryTerrain: { caster: 1, fake: 'desert', appliedTurn: TURN } });
  Object.assign(at(5), { _terrorStacks: 2, _terrorTurn: TURN, _terrorisedBy: 1 });
  Object.assign(at(18), { _hadBattleThisTurn: true });
  Object.assign(at(23), { _hadBattleThisTurn: true });
  const memory = {
    turn: 2,
    phase: 3,
    name: 'Province 10',
    terrain: 'hills',
    race: 'Elven',
    tax: 3,
    armyTypes: [],
    features: [],
    owner: null,
    ownerName: null,
    ownerColor: null,
    isHomeCapitalOfOwner: false,
  };
  const players = [
    {
      id: 0,
      name: 'Esterhold',
      color: '#a00',
      alignment: 'Good',
      provinces: [7],
      homeProvinceId: 7,
      _encountered: [],
      consecratedProvIds: [],
      _spiedProvincesThisTurn: [21],
      _provMemory: { '10': memory },
      _clairCharThisTurn: 7,
      discoveries: [],
    },
    {
      id: 1,
      name: 'Varn',
      color: '#00a',
      alignment: 'Evil',
      provinces: [3, 8, 21],
      homeProvinceId: 8,
      _encountered: [],
      consecratedProvIds: [],
      discoveries: [],
    },
  ];
  const state = { turn: TURN, world: { cols: COLS, rows: ROWS, provinces }, players, characters, relations: {} };
  // made by hand with the fields the view reads, not a whole saved state
  return { state: state as unknown as GameState, memory };
}

/** What realm 0's lines of the turn show: it spied 14 from phase 2, read a line of 18's battle, stood on 16 at some
 *  phase, and reads a province event of 12. */
const itsLines: WhatItsLinesShow = {
  spiedProvincesAndTheirFirstPhase: { '14': 2 },
  provincesWithABattleLineItRead: new Set([18]),
  provincesItStoodOnAtSomePhase: new Set([16]),
  provinceEvents: [{ provinceId: 12 }],
};
const viewOf = (realm = 0): PlayerView => playerView(world().state, realm, itsLines);
const province = (view: PlayerView, id: number): ProvinceAsSeen => {
  const p = view.provinces[id];
  if (!p) throw new Error(`no province ${String(id)} in the view`);
  return p;
};
const ids = (list: { id: unknown }[] | undefined) => (list ?? []).map((h) => h.id);

describe('what realm 0 sees of each province, by the sight rule that shows it', () => {
  const view = viewOf();

  test('its own province: whole, its founding capital, its garrison with each unit’s race and march', () => {
    const p = province(view, 7);
    expect(p.seen).toMatchObject({ owned: true, heroThere: true, visited: false });
    expect(p).toMatchObject({ name: 'Province 7', population: 1000, foundedByThisRealm: true, owner: 0 });
    expect(p.garrison).toHaveLength(1);
    expect(p.garrison?.[0]).toMatchObject({ type: 'Shieldwall Levies', race: 'Human' });
    expect(p.garrison?.[0]?.movement).toMatchObject({ moveKind: 'land' });
    expect(p.neutralGuard).toEqual({ leader: null, armyCount: 0, armies: [] });
  });

  test('a province it once visited: as it is now, its owner named whether met or not (the known breach), its guard counted', () => {
    const p = province(view, 3);
    expect(p.seen).toMatchObject({ visited: true, owned: false, spied: false });
    expect(p).toMatchObject({ name: 'Province 3', terrain: 'plain', owner: 1 });
    expect(p.knownBreachTheOwnersNameThoughItMayBeUnmet).toBe('Varn');
    expect('ownerRealmName' in p).toBe(false); // the map doesn't show it now
    expect(p.garrison).toEqual([expect.objectContaining({ race: 'Human' })]);
    // not spied: how many defend it, not who
    expect(p.neutralGuard).toEqual({ leader: null, armyCount: 2, armies: null });
    expect(province(view, 7).knownBreachTheOwnersNameThoughItMayBeUnmet).toBeUndefined();
  });

  test('next to one it owns or visited: what its order forms list, not who holds it or its garrison', () => {
    const p = province(view, 9);
    expect(p.seen).toMatchObject({ nextToOwnedOrVisited: true, nextToOwned: false, visited: false });
    expect(p).toMatchObject({ name: 'Province 9', terrain: 'plain', race: 'Human', tax: 5 });
    expect(p.armyTypes).toEqual(['Shieldwall Levies']);
    for (const key of ['owner', 'garrison', 'ownerRealmName', 'neutralGuard']) expect(key in p, key).toBe(false);
  });

  test('a hero of its own there: the heroes the sight rule shows (a rough size for another realm’s), never one under Invisibility', () => {
    const p = province(view, 16);
    expect(p.seen.heroThere).toBe(true);
    expect(ids(p.heroesOnTheMap)).toEqual([1, 2, 6]);
    const theirs = p.heroesOnTheMap?.find((h) => h.id === 2);
    expect(theirs).toMatchObject({ realmName: 'Varn', armyCount: null, armyBand: 'a modest band' });
    expect(p.heroesOnTheMap?.find((h) => h.id === 1)).toMatchObject({ armyCount: 0, armyBand: null });
    expect(ids(p.wanderersItCouldHire)).toEqual([6]);
    expect(p.wanderersItCouldHire[0]).toMatchObject({ topSkill: { skill: 'archery', level: 4 } });
    expect(p.wanderersItCouldHire[0]?.hireWage).toEqual(expect.any(Number));
  });

  test('spied: its garrison’s units, not their race', () => {
    const p = province(view, 21);
    expect(p.seen).toMatchObject({ spied: true, visited: false, owned: false });
    expect(p.garrison).toEqual([{ type: 'Shieldwall Levies', quality: 'Average', unitName: 'Old Guard' }]);
  });

  test('next to a spied one: the map’s glance shows its heroes, the hiring list doesn’t', () => {
    const p = province(view, 22);
    expect(p.seen).toMatchObject({ nextToSpied: true, spied: false, heroThere: false });
    expect(ids(p.heroesOnTheMap)).toEqual([5]);
    expect(p.wanderersItCouldHire).toEqual([]);
  });

  test('next to its own land: who holds it and its capital’s crown, not its garrison', () => {
    const p = province(view, 8);
    expect(p.seen).toMatchObject({ nextToOwned: true, visited: false });
    expect(p).toMatchObject({ ownerRealmName: 'Varn', ownerRealmColor: '#00a', isHomeCapitalOfOwner: true });
    expect('garrison' in p).toBe(false);
  });

  test('remembered: as one of its heroes last saw it, and nothing of it now', () => {
    const p = province(view, 10);
    expect(p.remembered).toEqual(world().memory);
    expect('name' in p).toBe(false);
  });

  test('watched by Clairvoyance: the hero, wherever he ends the turn', () => {
    expect(view.watchedByClairvoyance).toMatchObject({ hero: { id: 7, realmName: 'Varn' }, location: 19 });
    const p = province(view, 19);
    expect(p.seen.watchedHeroThere).toBe(true);
    expect(p.name).toBe('Province 19');
  });

  test('a province it doesn’t see: its place on the map, and nothing of it', () => {
    const p = province(view, 0);
    expect(Object.values(p.seen).some(Boolean)).toBe(false);
    expect(Object.keys(p).sort()).toEqual(
      [
        'id',
        'row',
        'col',
        'neighbours',
        'seen',
        'remembered',
        'explored',
        'ownArmyHere',
        'thisRealmFoughtHere',
        'features',
        'wanderersItCouldHire',
      ].sort(),
    );
    expect(p).toMatchObject({ remembered: null, features: [], wanderersItCouldHire: [], neighbours: [5, 1, 11, 6] });
  });

  test('the features it knows: discovered (with its treasure), explored far enough (without), a ritual site in its own land', () => {
    const own = province(view, 7).features;
    expect(own.map((f) => [f.index, f.name, f.discovered, f.treasure])).toEqual([
      [0, 'Standing Stones', false, null],
      [1, 'Troll Den', true, 50],
    ]);
    expect(own[1]).toMatchObject({ monsterName: 'Cave Troll', monsterPower: 'Strong', monsterCat: 'Giant' });
    // 60% explored: the first of two features (50%), not the second (100%), and no treasure; a ritual site elsewhere is not known
    expect(province(view, 3).features.map((f) => [f.index, f.revealedByExploring, f.discovered, f.treasure])).toEqual([
      [0, true, false, null],
    ]);
  });

  test('what its lines of the turn show: the heroes where it spied by them, the battles it witnessed, where its province events were', () => {
    const spiedByLines = province(view, 14);
    expect(spiedByLines.seen.spiedByItsLines).toBe(true);
    expect(ids(spiedByLines.heroesInItsProvinceIntelligence)).toEqual([8]);
    expect(spiedByLines.heroesInItsProvinceIntelligence?.[0]).toMatchObject({
      armyBand: 'a small escort (a few units)',
    });
    expect(spiedByLines.heroesInItsProvinceIntelligence?.[0]?.armies).toEqual([
      { type: 'Shieldwall Levies', quality: 'Average', unitName: 'Old Guard' },
      { type: 'Shieldwall Levies', quality: 'Average', unitName: 'Old Guard' },
    ]);
    // beside its own hero, but not spied: the province intelligence lists the heroes, not their units
    expect(province(view, 16).heroesInItsProvinceIntelligence?.find((h) => h.id === 2)?.armies).toBeNull();
    expect(province(view, 18)).toMatchObject({ seen: { witnessedABattle: true }, hadBattleThisTurn: true });
    expect(province(view, 16).seen.witnessedABattle).toBe(true);
    expect('hadBattleThisTurn' in province(view, 23)).toBe(false); // a battle it didn't witness, off its map
    expect(province(view, 12)).toMatchObject({
      seen: { aProvinceEventItReadsHappenedHere: true },
      name: 'Province 12',
    });
    // a report built with no turn (Turn 0): none of it
    const noTurn = playerView(world().state, 0);
    expect('heroesInItsProvinceIntelligence' in province(noTurn, 14)).toBe(false);
    expect('hadBattleThisTurn' in province(noTurn, 18)).toBe(false);
    expect('name' in province(noTurn, 12)).toBe(false);
  });

  test('its own provinces list every hero there, seen or not (the known breach); the map shows only those it sees', () => {
    const p = province(view, 7);
    expect(ids(p.knownBreachEveryHeroThereSeenOrNot)).toEqual([0, 4]);
    expect(p.knownBreachEveryHeroThereSeenOrNot?.find((h) => h.id === 4)).toMatchObject({ armyCount: 0 });
    expect(ids(p.heroesOnTheMap)).toEqual([0]);
    expect('knownBreachEveryHeroThereSeenOrNot' in province(view, 3)).toBe(false);
  });

  test('Illusory Terrain cast by another realm fools its map, not its order forms (as the report has it)', () => {
    expect(province(view, 16)).toMatchObject({ terrainAsItLooks: 'desert', terrain: 'forest' });
    expect(province(viewOf(1), 16).terrainAsItLooks).toBe('forest'); // the caster sees the land as it is
  });

  test('an Evil realm sees the Terror that grips every province; no other realm does', () => {
    expect(province(viewOf(1), 5).terror).toMatchObject({ _terrorStacks: 2, _terrorTurn: TURN, _terrorisedBy: 1 });
    expect(province(view, 5).terror).toBeUndefined();
  });
});

test('it writes nothing to the world', () => {
  const { state } = world();
  const before = JSON.stringify(state);
  const freeze = (v: unknown): void => {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) {
      Object.freeze(v);
      Object.values(v).forEach(freeze);
    }
  };
  freeze(state);
  expect(() => playerView(state, 0, itsLines)).not.toThrow();
  expect(JSON.stringify(state)).toBe(before);
});
