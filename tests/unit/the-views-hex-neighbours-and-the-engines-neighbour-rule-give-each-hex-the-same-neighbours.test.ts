// The view's hex neighbours and the engine's neighbour rule give each hex the same neighbours (B-06by: the view asks
// the engine's rule). One staged map, 6 × 4, wrapping east to west, every input written here; for each of its 24
// hexes, the west and east edges and the top and bottom rows included:
// - the engine's rule (getNeighborsP, src/engine/world/map-helpers.ts) gives the neighbours it gave before, in the
//   compass directions' order;
// - the bots' copy (botNeighbourProv, src/engine/bots/intel.ts), asked in each of the six directions, gives the same;
// - the view (playerView, src/views/what-each-realm-may-see-of-the-world.ts) gives the same in each province's
//   `neighbours`, and, for a realm holding only that hex, the same provinces next to its own in each of its two sets
//   of them (next to a province it owns; next to one it owns or visited).
// A change to the engine's rule, to the bots' copy or to any of the view's three reads of the neighbours fails a case.
//
// Level 1 (unit): the functions called directly on a world made here, on the engine's modules (the whole engine
// loaded first); no turn runs and no die is cast (no seed reaches them). Not lower: the view's reads of the
// neighbours are inside playerView, which is built from the whole world.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { botNeighbourProv } from '../../src/engine/bots/intel.ts';
import { getNeighborsP } from '../../src/engine/world/map-helpers.ts';
import { playerView } from '../../src/views/what-each-realm-may-see-of-the-world.ts';
import type { GameState, Province } from '../../src/schemas/saved-game-state.ts';

const TURN = 6;
const COLS = 6;
const ROWS = 4;
const HEXES = Array.from({ length: COLS * ROWS }, (_, id) => id);

/** Each hex's neighbours on the 6 × 4 map (id = row × 6 + col), in the compass directions' order (NW, NE, W, E, SW,
 *  SE), none past the top or bottom row; west of the first column is the last. An even row's neighbours above and
 *  below lie a column west of an odd row's. */
const THE_NEIGHBOURS_OF_EACH_HEX: Readonly<Record<number, readonly number[]>> = {
  0: [5, 1, 11, 6],
  1: [0, 2, 6, 7],
  2: [1, 3, 7, 8],
  3: [2, 4, 8, 9],
  4: [3, 5, 9, 10],
  5: [4, 0, 10, 11],
  6: [0, 1, 11, 7, 12, 13],
  7: [1, 2, 6, 8, 13, 14],
  8: [2, 3, 7, 9, 14, 15],
  9: [3, 4, 8, 10, 15, 16],
  10: [4, 5, 9, 11, 16, 17],
  11: [5, 0, 10, 6, 17, 12],
  12: [11, 6, 17, 13, 23, 18],
  13: [6, 7, 12, 14, 18, 19],
  14: [7, 8, 13, 15, 19, 20],
  15: [8, 9, 14, 16, 20, 21],
  16: [9, 10, 15, 17, 21, 22],
  17: [10, 11, 16, 12, 22, 23],
  18: [12, 13, 23, 19],
  19: [13, 14, 18, 20],
  20: [14, 15, 19, 21],
  21: [15, 16, 20, 22],
  22: [16, 17, 21, 23],
  23: [17, 12, 22, 18],
};

const theNeighboursOf = (hex: number): readonly number[] => {
  const them = THE_NEIGHBOURS_OF_EACH_HEX[hex];
  if (!them) throw new Error(`no hex ${String(hex)} on the staged map`);
  return them;
};

/** A 6 × 4 world (province id = row × 6 + col; the map wraps east to west), every province plain and held by none
 *  but `held`. Realm 0 (Esterhold, Neutral) holds `held` alone; its king stands there. Every other list of the
 *  realm's is empty. */
function stagedWorld(held: number): GameState {
  const provinces = HEXES.map((id) => ({
    id,
    row: Math.floor(id / COLS),
    col: id % COLS,
    name: `Province ${String(id)}`,
    terrain: 'plain',
    tax: 5,
    race: 'Human',
    population: 1000,
    owner: id === held ? 0 : null,
    features: [] as unknown[],
    npcArmies: 0,
    neutralDefenders: [] as unknown[],
    explored: 0,
    characters: id === held ? [0] : ([] as number[]),
    armyTypes: ['Shieldwall Levies'],
    garrisonArmies: [] as unknown[],
    visitedBy: [] as number[],
    exploredBy: {},
    _hadBattleThisTurn: false,
  }));
  const king = {
    id: 0,
    name: 'Aldric',
    isKing: true,
    player: 0,
    race: 'Human',
    alignment: 'Neutral',
    temper: 'Brave',
    skills: { melee: 3 },
    armies: [] as unknown[],
    items: [],
    location: held,
    alive: true,
    pay: 2,
  };
  const players = [
    {
      id: 0,
      name: 'Esterhold',
      color: '#a00',
      alignment: 'Neutral',
      provinces: [held],
      homeProvinceId: held,
      consecratedProvIds: [],
      discoveries: [],
      _encountered: [],
    },
  ];
  const state = {
    turn: TURN,
    world: { cols: COLS, rows: ROWS, provinces },
    players,
    characters: [king],
    relations: {},
    heroGraveyard: [],
    mercenaries: [],
  };
  // made by hand with the fields the rule, the bots' copy and the view read, not a whole saved state
  return state as unknown as GameState;
}

const theProvince = (G: GameState, hex: number): Province => {
  const p = G.world.provinces[hex];
  if (!p) throw new Error(`no province ${String(hex)} on the staged map`);
  return p;
};

const sorted = (ids: readonly number[]) => [...ids].sort((a, b) => a - b);

describe('the hex neighbours of each hex of a staged map that wraps east to west', () => {
  test("the engine's neighbour rule gives each hex the neighbours it gave before, in the compass directions' order", () => {
    const G = stagedWorld(0);
    for (const hex of HEXES) {
      const them = getNeighborsP(theProvince(G, hex), COLS, ROWS, G.world.provinces).map((p) => p.id);
      expect(them, `the engine's neighbours of hex ${String(hex)}`).toEqual(theNeighboursOf(hex));
    }
  });

  test("the bots' copy gives each hex the same neighbours as the engine's rule, in the same order", () => {
    const G = stagedWorld(0);
    for (const hex of HEXES) {
      const them = [0, 1, 2, 3, 4, 5]
        .map((direction) => botNeighbourProv(G, theProvince(G, hex), direction))
        .filter((p) => p !== null && p !== undefined)
        .map((p) => p.id);
      expect(them, `the bots' neighbours of hex ${String(hex)}`).toEqual(theNeighboursOf(hex));
    }
  });

  test("the view gives each province the same neighbours as the engine's rule, in the same order", () => {
    const view = playerView(stagedWorld(0), 0);
    expect(
      view.provinces.map((p) => p.id),
      'the provinces of the view',
    ).toEqual(HEXES);
    for (const p of view.provinces) {
      expect(p.neighbours, `the view's neighbours of hex ${String(p.id)}`).toEqual(theNeighboursOf(p.id));
    }
  });

  test("for a realm holding one hex, the view's two sets of provinces next to its own are the engine's neighbours of it", () => {
    for (const held of HEXES) {
      const view = playerView(stagedWorld(held), 0);
      const nextToOwned = view.provinces.filter((p) => p.seen.nextToOwned).map((p) => p.id);
      const nextToOwnedOrVisited = view.provinces.filter((p) => p.seen.nextToOwnedOrVisited).map((p) => p.id);
      expect(nextToOwned, `next to a province it owns, holding hex ${String(held)}`).toEqual(
        sorted(theNeighboursOf(held)),
      );
      expect(nextToOwnedOrVisited, `next to a province it owns or visited, holding hex ${String(held)}`).toEqual(
        sorted(theNeighboursOf(held)),
      );
    }
  });
});
