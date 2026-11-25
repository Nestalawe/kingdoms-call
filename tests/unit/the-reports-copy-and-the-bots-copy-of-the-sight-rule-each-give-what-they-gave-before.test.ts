// The report's copy and the bots' copy of the sight rule each give what they gave before (B-06bw: the parts both copies
// work out the same way are one rule in src/engine/sight/, read by both; each copy keeps its own parts as they were).
// One staged world, two realms with made-up names, every input written here; on it, each copy's province sets and
// heroes are asserted as each gave them on the base, in the order each set holds them:
// - the report's copy: what realm 0 may see (playerView, src/views/what-each-realm-may-see-of-the-world.ts), its sets,
//   each province's flags, the heroes it lists and the dead it knows of;
// - the bots' copy: what a bot realm knows (botIntel, src/engine/bots/intel.ts), its sets, the context its hero rule
//   reads, and the heroes it accounts for.
// A change to either copy, or to the rule both read, fails a case.
//
// Level 1 (unit): the two functions called directly on a world made here, on the engine's modules (the whole engine
// loaded first); no turn runs and no die is cast (no seed reaches them). Not lower: each set is worked out from the
// whole world.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { botIntel, botSeesChar } from '../../src/engine/bots/intel.ts';
import { playerView } from '../../src/views/what-each-realm-may-see-of-the-world.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';

const TURN = 6;
const COLS = 6;
const ROWS = 4;

const hero = (id: number, player: number | null, location: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Hero ${String(id)}`,
  isKing: false,
  player,
  race: 'Human',
  alignment: 'Neutral',
  temper: 'Brave',
  skills: { melee: 3, spy: 1 },
  armies: [] as unknown[],
  items: [],
  location,
  alive: true,
  pay: 2,
  ...extra,
});
const army = () => ({ type: 'Shieldwall Levies', quality: 'Average', race: 'Human', unitName: 'Old Guard' });

/** A 6 × 4 world (province id = row × 6 + col; the map wraps east to west). Realm 0 (Esterhold) lists 7 as its own
 *  and is named owner of 7 and of 2; its king stands in 7, a hero of its own in 12 (on the west edge), another fell
 *  long ago in 22; it once visited 3; it remembers 10; its record of spied provinces holds 14 this turn and 21 last
 *  turn; it watches realm 1's hero in 19 by Clairvoyance. Realm 1 (Varn) holds 3 and 21; its heroes stand in 19, 13,
 *  15, 20 and 23; a wanderer stands in 17. The two realms are at war; five graves lie in 7, 12, 14, 21 and 0. */
function stagedWorld(): GameState {
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
    hero(0, 0, 7, { isKing: true, armies: [army()] }),
    hero(1, 0, 12),
    hero(2, 0, 22, { alive: false }),
    hero(3, 1, 19),
    hero(4, 1, 13, { armies: [army()] }),
    hero(5, 1, 15),
    hero(6, 1, 20),
    hero(7, 1, 23),
    hero(8, null, 17, { alignment: 'Good' }),
  ];
  for (const c of characters) at(c.location).characters.push(c.id);
  Object.assign(at(7), { owner: 0, garrisonArmies: [army()] });
  Object.assign(at(2), { owner: 0 });
  Object.assign(at(3), { owner: 1, visitedBy: [0] });
  Object.assign(at(21), { owner: 1 });
  const memory = {
    turn: 2,
    phase: 3,
    name: 'Province 10',
    terrain: 'hills',
    race: 'Human',
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
      _spiedProvincesThisTurn: [14],
      _spiedProvincesLastTurn: [21],
      _provMemory: { '10': memory },
      _clairCharThisTurn: 3,
      discoveries: [],
      _encountered: [1],
    },
    {
      id: 1,
      name: 'Varn',
      color: '#00a',
      alignment: 'Neutral',
      provinces: [3, 21],
      homeProvinceId: 3,
      consecratedProvIds: [],
      discoveries: [],
      _encountered: [0],
    },
  ];
  const grave = (id: number, location: number) => ({
    id,
    name: `Grave ${String(id)}`,
    player: 1,
    race: 'Human',
    alignment: 'Neutral',
    temper: 'Brave',
    skills: { melee: 4 },
    isKing: false,
    killedOnTurn: 2,
    location,
    served: [1],
    _releasedBy: null,
  });
  const state = {
    turn: TURN,
    world: { cols: COLS, rows: ROWS, provinces },
    players,
    characters,
    relations: { '0-1': 'war' },
    heroGraveyard: [grave(30, 7), grave(31, 12), grave(32, 14), grave(33, 21), grave(34, 0)],
    mercenaries: [],
  };
  // made by hand with the fields the two copies read, not a whole saved state
  return state as unknown as GameState;
}

/** The province ids whose flag is true, in the world's order. */
function whereTrue(
  view: ReturnType<typeof playerView>,
  flag: keyof ReturnType<typeof playerView>['provinces'][number]['seen'],
) {
  return view.provinces.filter((p) => p.seen[flag]).map((p) => p.id);
}

describe("the report's copy of the sight rule", () => {
  test("the report's copy gives the sets it gave before, in the same order", () => {
    const view = playerView(stagedWorld(), 0);
    expect(
      {
        owned: [...view.sight.owned],
        visited: [...view.sight.visited],
        heroThere: [...view.sight.heroThere],
        spied: [...view.sight.spied],
        nextToSpied: [...view.sight.nextToSpied],
      },
      "the report's sets",
    ).toEqual({
      owned: [7],
      visited: [3],
      heroThere: [7, 12],
      spied: [14],
      nextToSpied: [7, 8, 13, 15, 19, 20],
    });
  });

  test("the report's copy gives each province the flags it gave before", () => {
    const view = playerView(stagedWorld(), 0);
    const flags = [
      'owned',
      'visited',
      'nextToOwnedOrVisited',
      'heroThere',
      'spied',
      'nextToSpied',
      'nextToOwned',
      'watchedHeroThere',
    ] as const;
    expect(Object.fromEntries(flags.map((f) => [f, whereTrue(view, f)])), "the report's flags").toEqual({
      owned: [7],
      visited: [3],
      nextToOwnedOrVisited: [1, 2, 4, 6, 8, 9, 13, 14],
      heroThere: [7, 12],
      spied: [14],
      nextToSpied: [7, 8, 13, 15, 19, 20],
      nextToOwned: [1, 2, 6, 8, 13, 14],
      watchedHeroThere: [19],
    });
  });

  test("the report's copy gives the heroes and the dead it gave before", () => {
    const view = playerView(stagedWorld(), 0);
    expect(
      {
        heroesItSees: view.heroesItSees.map((h) => h.id),
        heroesBesideItsOwn: view.heroesBesideItsOwn.map((h) => h.id),
        theDeadItKnowsOf: view.theDeadItKnowsOf.map((g) => g.id),
      },
      "the report's heroes and dead",
    ).toEqual({ heroesItSees: [3, 4, 5, 6], heroesBesideItsOwn: [], theDeadItKnowsOf: [30, 31, 32] });
  });
});

describe("the bots' copy of the sight rule", () => {
  test("the bots' copy gives the sets it gave before, in the same order", () => {
    const I = botIntel(stagedWorld(), 0);
    expect(
      {
        owned: [...I.owned],
        occupied: [...I.occupied],
        spied: [...I.spied],
        sight: [...I.sight],
        border: [...I.border],
        remembered: [...I.remembered],
        visited: [...I.visited],
        known: [...I.known],
      },
      "the bots' sets",
    ).toEqual({
      owned: [2, 7],
      occupied: [7, 12],
      spied: [21],
      sight: [2, 7, 12, 21],
      border: [1, 3, 8, 6, 13, 14, 11, 17, 23, 18, 15, 16, 20, 22],
      remembered: [10, 3],
      visited: [3],
      known: [2, 7, 12, 21, 1, 3, 8, 6, 13, 14, 11, 17, 23, 18, 15, 16, 20, 22, 10],
    });
  });

  test("the bots' copy gives the context its hero rule reads as before, the same sets", () => {
    const I = botIntel(stagedWorld(), 0);
    expect(
      {
        ownedProvIds: [...I.ctx.ownedProvIds],
        ownCharLocs: [...I.ctx.ownCharLocs],
        spiedThisTurn: [...I.ctx.spiedThisTurn],
        nearSpied: [...(I.ctx.nearSpied ?? [])],
      },
      "the bots' context",
    ).toEqual({ ownedProvIds: [2, 7], ownCharLocs: [7, 12], spiedThisTurn: [21], nearSpied: [15, 16, 20, 22] });
    expect(I.ctx.ownedProvIds, 'the owned set itself').toBe(I.owned);
    expect(I.ctx.ownCharLocs, 'the occupied set itself').toBe(I.occupied);
    expect(I.ctx.spiedThisTurn, 'the spied set itself').toBe(I.spied);
  });

  test("the bots' copy accounts for the heroes it accounted for before", () => {
    const G = stagedWorld();
    expect(
      G.characters.filter((c) => botSeesChar(G, 0, c)).map((c) => c.id),
      "the heroes the bots' copy accounts for",
    ).toEqual([0, 1, 3, 5, 6]);
  });
});
