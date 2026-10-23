// playerView (src/views/what-each-realm-may-see-of-the-world.ts, plan P1-12b4: P1-12's Decision 11, part 1): what one
// realm may see of the world, the province sections of its report read only this. One case for each sight rule the
// view applies, on a small world made here, so each rule is pinned on its own (the balance matrix's every-realm half
// checks the report built from the view, whole games, every realm):
// - its own provinces, whole; a province it once visited (as it is now, its owner named only once met: R-046);
//   the ring next to those (the order forms' facts); a hero of its own there (the sight rule: Invisibility hides);
//   spied (the garrison's units, not their race); next to a spied one (the map's glance, not the hiring list's); next
//   to its own land (who holds it, the capital's crown); remembered; watched by Clairvoyance; unseen (its place only);
// - the features it knows; what its lines of the turn show (spied by its lines, battles witnessed, province events);
//   an Evil realm's Terror; the heroes of its own provinces (those it sees there, as its map does); Illusory Terrain;
// - and it writes nothing to the world;
// - (P1-12b5) its own heroes, alive or fallen this turn, and where they stand named; the heroes it sees (the map's
//   sight rule, a wanderer's public facts, why a hero can't be encountered) and those beside its own (the hiring list's
//   sight, the Charm card); the heroes it has ever seen still alive in a realm's service; the dead it knows of; the
//   mercenaries where it sees; the realms (named once met, its diplomacy only with those it has encountered, every
//   realm named once the game is over); the titles (hidden before turn 5, then worked out from the whole world; last
//   turn's minor titles of its own heroes only, and the bonuses they give); its books; the portal's lookup tables.
// Level 1 (unit): the function is called on a world made in the test, on the engine's modules; no turn runs.
// refactor-only: P1-12b4 adds the function (the base has none), and P1-12b5 its second part; each case is red on a
// sight fault planted in it.
import { describe, expect, test } from 'vitest';
import type { GameState } from '../../src/schemas/saved-game-state.ts';
import {
  playerView,
  type PlayerView,
  type ProvinceAsSeen,
  type WhatItsLinesShow,
} from '../../src/views/what-each-realm-may-see-of-the-world.ts';
import { buildTurnReport } from '../../src/views/turn-report.ts';

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
 *  (its capital, next to realm 0's land) and 21; a Terror grips 5; battles were fought in 18 and 23.
 *  (P1-12b5) Realm 0's hero fell this turn in 23, another long ago; realm 1's cloaked hero stands in 2; realm 0 owns 2
 *  by the province's record only; five graves, four mercenaries; realm 0 is at war with realm 1, which it hasn't met
 *  (`encountered`: it has); last turn's Swift is realm 0's hero 1, its Sea-Wolf realm 1's hero 2. */
function world({ turn = TURN, encountered = [] as number[], gameOver = false } = {}) {
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
    // a wanderer beside realm 0's hero, charmed last turn
    hero(6, null, 16, { alignment: 'Good', skills: { melee: 2, archery: 4 }, _charmImmuneTurn: turn }),
    hero(7, 1, 19), // realm 1's hero, watched by realm 0's Clairvoyance
    hero(8, 1, 14, { armies: [army(), army()] }), // realm 1's hero in a province realm 0 spied by its lines
    hero(9, 0, 23, { alive: false, killedThisTurn: true }), // realm 0's hero, fallen this turn where it doesn't see
    hero(10, 0, 0, { alive: false }), // realm 0's hero, fallen long ago
    hero(11, 1, 2, { items: [{ name: 'Veil', slot: 'cloak', effect: { stat: 'hidden', bonus: 1 }, equipped: true }] }),
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
  Object.assign(at(7), { _enslavedUntil: TURN + 2, _earthquakeTax: 1 });
  Object.assign(at(2), { owner: 0, tax: 3, garrisonArmies: [army('Hill Archers')] }); // its own by the record, not its list
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
      consecratedProvIds: [],
      _spiedProvincesThisTurn: [21],
      _provMemory: { '10': memory },
      _clairCharThisTurn: 7,
      discoveries: [],
      _encountered: encountered,
      // it has seen realm 1's hero 2 (alive), its hero 10 (fallen) and the wanderer 5 (serving no realm)
      seenCharIntel: { '2': { id: 2 }, '10': { id: 10 }, '5': { id: 5 } },
      knownDeadHeroIds: [23],
      seenDeadHeroIds: [24],
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
  const grave = (id: number, player: number | null, location: number) => ({
    id,
    name: `Grave ${String(id)}`,
    player,
    race: 'Human',
    alignment: 'Neutral',
    temper: 'Brave',
    skills: { melee: 4 },
    isKing: false,
    killedOnTurn: 2,
    location,
    served: player == null ? [] : [player],
    _releasedBy: null,
  });
  const heroGraveyard = [
    grave(20, 0, 0), // its own, where it doesn't see
    grave(21, 1, 21), // realm 1's, in the province it spied
    grave(22, 1, 3), // realm 1's, in one it once visited: not seen now
    grave(23, 1, 0), // realm 1's, which it has known of
    grave(24, null, 0), // a wanderer's, whose fall it saw this turn
  ];
  const merc = (id: string, location: number) => ({ ...army(), id, location, isSea: false });
  const mercenaries = [merc('m1', 7), merc('m2', 21), merc('m3', 22), merc('m4', 3)];
  const state = {
    turn,
    world: { cols: COLS, rows: ROWS, provinces },
    players,
    characters,
    relations: { '0-1': 'war' },
    heroGraveyard,
    mercenaries,
    _minorHolders: { swift: { charId: 1, playerIndex: 0 }, seawolf: { charId: 2, playerIndex: 1 } },
    ...(gameOver ? { gameOver: { winner: 1, standings: [] } } : {}),
  };
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
const viewOf = (realm = 0, options: Parameters<typeof world>[0] = {}): PlayerView =>
  playerView(world(options).state, realm, itsLines);
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

  test('a province it once visited: as it is now, its guard counted', () => {
    const p = province(view, 3);
    expect(p.seen).toMatchObject({ visited: true, owned: false, spied: false });
    expect(p).toMatchObject({ name: 'Province 3', terrain: 'plain', owner: 1 });
    expect('ownerRealmName' in p).toBe(false); // the map doesn't show it now
    expect(p.garrison).toEqual([expect.objectContaining({ race: 'Human' })]);
    // not spied: how many defend it, not who
    expect(p.neutralGuard).toEqual({ leader: null, armyCount: 2, armies: null });
    expect('theOwnersNameOnceItHasMetThem' in province(view, 7)).toBe(false);
  });

  test('a province it once visited, held by a realm it has not met: nothing in it names that realm (R-046)', () => {
    const p = province(view, 3);
    expect(view.realms[1]?.met).toBe(false);
    expect(p.theOwnersNameOnceItHasMetThem).toBeNull();
    expect(JSON.stringify(p)).not.toContain('Varn');
  });

  test('a province it once visited, held by a realm it has met, or once the game is over: the owner is named', () => {
    expect(province(viewOf(0, { encountered: [1] }), 3).theOwnersNameOnceItHasMetThem).toBe('Varn');
    expect(province(viewOf(0, { gameOver: true }), 3).theOwnersNameOnceItHasMetThem).toBe('Varn');
  });

  test('its report: a province it once visited is held by “an unknown realm” until it meets the owner (R-046)', () => {
    const intel = (v: PlayerView): unknown[] => buildTurnReport(v).intel;
    expect(intel(view)).toContain('Province 3 (plain): controlled by an unknown realm.');
    // its lines of that province (its heroes see realm 1's elsewhere, which names that realm: R-046's meeting)
    expect(
      intel(view)
        .filter((line) => String(line).startsWith('Province 3'))
        .join(' '),
    ).not.toContain('Varn');
    expect(intel(viewOf(0, { encountered: [1] }))).toContain('Province 3 (plain): controlled by Varn.');
    expect(intel(viewOf(0, { gameOver: true }))).toContain('Province 3 (plain): controlled by Varn.');
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

  test('its own provinces list the heroes it sees there, as its map does: not one under Invisibility', () => {
    const p = province(view, 7);
    expect(ids(p.heroesOnTheMap)).toEqual([0]);
    expect(ids(p.heroesItSeesInItsOwnProvince)).toEqual([0]);
    expect(p.heroesItSeesInItsOwnProvince?.[0]).toMatchObject({ armyCount: 1 }); // its king, and the units he leads
    expect('heroesItSeesInItsOwnProvince' in province(view, 3)).toBe(false);
  });

  test('its own provinces list a hero it sees there, and not a wanderer slipping by unspotted', () => {
    const { state } = world();
    const realm1sHero = state.characters[4];
    if (!realm1sHero) throw new Error('no hero 4');
    delete realm1sHero._invisTurn; // realm 1's hero in its capital, seen beside its king
    state.characters.push({ ...hero(12, null, 7), _unspottedTurn: TURN } as unknown as (typeof state.characters)[0]);
    state.world.provinces[7]?.characters.push(12);
    const p = province(playerView(state, 0, itsLines), 7);
    expect(ids(p.heroesOnTheMap)).toEqual([0, 4]);
    expect(ids(p.heroesItSeesInItsOwnProvince)).toEqual([0, 4]);
  });

  test('its report: its own provinces list only the heroes it sees there', () => {
    const heroesOfItsCapital = (v: PlayerView): unknown[] =>
      (buildTurnReport(v).ownedProvinces as { id: number; characters: { id: unknown }[] }[])
        .filter((p) => p.id === 7)
        .flatMap((p) => p.characters.map((c) => c.id));
    expect(heroesOfItsCapital(view)).toEqual([0]);
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

describe('what realm 0 sees of the heroes and the realms (P1-12b5)', () => {
  const view = viewOf();

  test('its own heroes, whole: alive, or fallen this turn (and where he fell named), not one fallen long ago', () => {
    expect(ids(view.ownHeroes)).toEqual([0, 1, 9]);
    // whole: the world's own record of him, every field
    const { state } = world();
    const own = playerView(state, 0, itsLines).ownHeroes;
    expect(own[0]).toBe(state.characters[0]);
    expect(view.ownHeroes[2]).toMatchObject({ alive: false, killedThisTurn: true, location: 23 });
    const fell = province(view, 23);
    expect(Object.values(fell.seen).some(Boolean)).toBe(false);
    expect(fell.name).toBe('Province 23');
  });

  test('the heroes it sees, by the map’s sight rule: a wanderer’s public facts, why a realm’s hero can’t be encountered', () => {
    // 3 and 4 are under Invisibility, 8 stands where only its lines spied, 11 where it doesn't see
    expect(ids(view.heroesItSees)).toEqual([2, 5, 6, 7]);
    const [theirs, wanderer] = view.heroesItSees;
    expect(theirs).toMatchObject({
      realmName: 'Varn',
      leadsArmies: true,
      armyBand: 'a modest band',
      untargetable: null,
    });
    for (const key of ['race', 'alignment', 'temper', 'topSkill', 'hireWage'])
      expect(key in (theirs ?? {}), key).toBe(false);
    expect(wanderer).toMatchObject({
      race: 'Human',
      alignment: 'Good',
      temper: 'Brave',
      topSkill: { skill: 'melee', level: 3 },
    });
    expect(wanderer?.hireWage).toEqual(expect.any(Number));
    expect('untargetable' in (wanderer ?? {})).toBe(false);
    expect('skills' in (wanderer ?? {})).toBe(false); // the sightings never send a wanderer's whole skills
  });

  test('the heroes beside its own: the hiring list’s sight (not the next-door glance), the Charm card of an unarmed wanderer', () => {
    // 5 stands next to the spied province, not beside its hero
    expect(ids(view.heroesBesideItsOwn)).toEqual([2, 6]);
    const [theirs, wanderer] = view.heroesBesideItsOwn;
    expect(theirs).toMatchObject({ charmImmune: false, leadsArmies: true });
    for (const key of ['race', 'skills', 'hp']) expect(key in (theirs ?? {}), key).toBe(false);
    expect(wanderer).toMatchObject({ charmImmune: true, race: 'Human', skills: { melee: 2, archery: 4 }, pay: 2 });
    // a wanderer leading units: no Charm card (his race and alignment still public)
    const { state } = world();
    Object.assign(state.characters[6] ?? {}, { armies: [army()] });
    const armed = playerView(state, 0, itsLines).heroesBesideItsOwn[1];
    expect(armed).toMatchObject({ id: 6, race: 'Human', leadsArmies: true });
    for (const key of ['skills', 'temper', 'hp', 'pay']) expect(key in (armed ?? {}), key).toBe(false);
  });

  test('the heroes it has ever seen, alive and serving a realm now (the Clairvoyance list)', () => {
    expect([...view.heroesItHasSeenAliveAndServingARealm]).toEqual([2]);
  });

  test('the dead it knows of: its own, one it has known of, one whose fall it saw, one lying where it sees now', () => {
    expect(ids(view.theDeadItKnowsOf)).toEqual([20, 21, 23, 24]);
    expect(view.theDeadItKnowsOf[0]).toMatchObject({
      locationName: 'Province 0',
      servedOther: false,
      skills: { melee: 4 },
    });
    expect(view.theDeadItKnowsOf[1]).toMatchObject({ locationName: 'Province 21', servedOther: true });
  });

  test('the mercenaries where it sees now: its own land and the province it spied, not next to it or once visited', () => {
    expect(view.mercenariesItSees.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(view.mercenariesItSees[1]).toEqual({
      id: 'm2',
      type: 'Shieldwall Levies',
      quality: 'Average',
      unitName: 'Old Guard',
      race: 'Human',
      location: 21,
      isSea: false,
    });
  });

  test('the realms: named once met, its diplomacy only with one it has encountered, every realm named once the game is over', () => {
    expect(view.realms).toEqual([
      { index: 0, met: true, name: 'Esterhold', color: '#a00' },
      { index: 1, met: false, name: null, color: null },
    ]);
    expect(viewOf(0, { encountered: [1] }).realms[1]).toEqual({
      index: 1,
      met: true,
      name: 'Varn',
      color: '#00a',
      alignment: 'Evil',
      conceded: undefined,
      concededTurn: undefined,
      eliminated: undefined,
      relation: 'war',
    });
    const over = viewOf(0, { gameOver: true });
    expect(over.realms[1]).toEqual({ index: 1, met: true, name: 'Varn', color: '#00a' });
    expect(over.gameOver).toMatchObject({ winner: 1 });
    expect(view.gameOver).toBeNull();
  });

  test('the titles: hidden before turn 5, then worked out from the whole world, with the names of the heroes holding them', () => {
    expect(view.titles).toMatchObject({ public: false, holders: null, standings: null, minor: null, race: null });
    expect(view.titles.heroNames.size).toBe(0);
    expect(view.titles.eligibility).toMatchObject({ ok: false });
    const shown = viewOf(0, { turn: 5 }).titles;
    expect(shown.public).toBe(true);
    expect(shown.holders).toMatchObject({ throne: { playerIndex: 1 } }); // the most tax: realm 1's
    expect(shown.standings).toMatchObject([{ index: 0 }, { index: 1 }]);
    expect(shown.heroNames.size).toBeGreaterThan(0);
    for (const [id, name] of shown.heroNames) expect(name).toBe(`Hero ${String(id)}`);
    expect(viewOf(0, { gameOver: true }).titles.public).toBe(true);
  });

  test('last turn’s minor titles: its own heroes’ only, and the bonus each gives them before the titles are public', () => {
    expect(view.titles.lastTurnsMinorHoldersOfItsHeroes).toEqual({ swift: { charId: 1, playerIndex: 0 } });
    expect(view.extraSkillBonusesOfItsHeroes['1']).toEqual({
      march: [expect.objectContaining({ label: 'The Swift' })],
    });
    expect(view.extraSkillBonusesOfItsHeroes['0']).toEqual({});
  });

  test('its books: the tax and the units of the provinces whose record names it their owner, its own provinces’ burdens', () => {
    expect(view.books).toMatchObject({
      baseTax: 8, // 7 and 2
      discoveryTaxGoldOfEachOfItsProvinces: [0],
      wonderBlesses: { Good: false, Druidic: false },
      provincesItHoldsByTheirRecord: 2,
    });
    expect(view.books.unitsGarrisonedInTheProvincesItHolds.map((a) => a.type)).toEqual([
      'Hill Archers',
      'Shieldwall Levies',
    ]);
    expect(province(view, 7)).toMatchObject({ _enslavedUntil: TURN + 2, _earthquakeTax: 1 });
    expect('_enslavedUntil' in province(view, 3)).toBe(false);
  });

  test('the portal’s lookup tables: every realm, and every named hero alive or fallen this turn but the cloaked', () => {
    expect(view.lookupTables.realms).toEqual([
      { name: 'Esterhold', color: '#a00' },
      { name: 'Varn', color: '#00a' },
    ]);
    expect(view.lookupTables.heroes.map((h) => h.name)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => `Hero ${String(id)}`),
    );
    expect(view.lookupTables.heroes[2]).toEqual({
      name: 'Hero 2',
      player: 1,
      realmColor: '#00a',
      isNeutralGuard: undefined,
    });
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
