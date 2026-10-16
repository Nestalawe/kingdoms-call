// The scripted realm's orders (tools/balance/scripted.ts, P1-02a), written from a saved state with no randomness: war
// on the nearest neighbour, the chaser's Encounter and Pursue, the chase into an unresolved battle, Recruit and Defend.
// A tiny made-up map. Level 1 (unit): a pure function.
import { describe, expect, test } from 'vitest';
import {
  hexDistance,
  nearestNeighbour,
  scriptedOrders,
  type Character,
  type Province,
  type State,
} from '../../tools/balance/scripted.ts';

// One row of 8 provinces (the map wraps east to west). Realm 0 (scripted) holds 0–1, realm 1 holds 3, realm 2 holds 6.
const province = (id: number, owner: number | null, extra: Partial<Province> = {}): Province => ({
  id,
  row: 0,
  col: id,
  owner,
  terrain: 'plain',
  ...extra,
});
const ch = (id: number, player: number | null, location: number, extra: Partial<Character> = {}): Character => ({
  id,
  player,
  alive: true,
  location,
  ...extra,
});
const army = [{ type: 'Pikes' }];
const world = (provinces: Province[]): State['world'] => ({ cols: 8, provinces });
const base = (): State => ({
  world: world([
    province(0, 0, { armyTypes: ['Pikes', 'Bows'] }),
    province(1, 0),
    province(2, null),
    province(3, 1),
    province(4, null, { terrain: 'sea' }),
    province(5, null),
    province(6, 2),
    province(7, null),
  ]),
  players: [{ homeProvinceId: 0 }, {}, {}],
  characters: [
    ch(1, 0, 0, { isKing: true, armies: army }),
    ch(2, 0, 1),
    ch(3, 0, 1),
    ch(10, 1, 3, { isKing: true, armies: army }),
    ch(11, 1, 3),
    ch(20, 2, 6, { isKing: true }),
    ch(21, 2, 6),
  ],
  relations: {},
});

describe('the map', () => {
  test('hex distance wraps east to west', () => {
    expect(hexDistance(province(0, null), province(7, null), 8)).toBe(1);
    expect(hexDistance(province(0, null), province(3, null), 8)).toBe(3);
  });

  test('the nearest neighbour is the realm whose land is nearest the king', () => {
    expect(nearestNeighbour(base(), 0)).toBe(2); // province 6 is 2 away across the wrap, province 3 is 3 away
    const S = base();
    S.characters = S.characters.filter((c) => c.id !== 1);
    S.players[0] = { homeProvinceId: 1 };
    expect(nearestNeighbour(S, 0)).toBe(1); // no king: from home, 1 → 3 is 2, 1 → 6 is 3
  });
});

describe('a turn of orders', () => {
  test('before any war: war declared on the nearest neighbour, the king recruits, the rest defend', () => {
    const { orders, plan } = scriptedOrders(base(), 0, 4);
    expect(orders.forTurn).toBe(4);
    expect(orders.diplomacy).toEqual({ '2': 'enemy' });
    expect(Object.keys(orders.orders).sort()).toEqual(['1', '2', '3']);
    expect(orders.orders['1']?.[0]).toMatchObject({ action: 'recruit', target: 'Pikes|1' });
    expect(orders.orders['2']?.map((o) => o.action)).toEqual(['defend', 'defend', 'defend', 'defend', 'defend']);
    expect(plan).toEqual({ chaser: null, battleChases: [] });
  });

  test('at war: the armed king chases the nearest enemy, Encounter on odd turns and Pursue on even ones', () => {
    const S = base();
    S.relations = { '0-1': 'enemy' };
    const odd = scriptedOrders(S, 0, 5);
    expect(odd.orders.orders['1']?.[0]).toMatchObject({ action: 'encounter', target: '10' }); // a king may hunt a king
    expect(odd.orders.orders['1']?.slice(1).every((o) => o.action === 'defend')).toBe(true);
    expect(odd.plan.chaser).toEqual({ heroId: 1, quarryId: 10, action: 'encounter' });
    const even = scriptedOrders(S, 0, 6);
    expect(even.orders.orders['1']?.[0]).toMatchObject({ action: 'pursue', target: '10' });
  });

  test('a king without an army leaves the chase to the first hero, who may not hunt a king', () => {
    const S = base();
    S.relations = { '0-1': 'enemy' };
    S.characters = S.characters.map((c) => (c.id === 1 ? { ...c, armies: [] } : c));
    const { orders, plan } = scriptedOrders(S, 0, 5);
    expect(plan.chaser).toEqual({ heroId: 2, quarryId: 11, action: 'encounter' });
    expect(orders.orders['1']?.[0]?.action).toBe('recruit');
  });

  test('every other armed character pursues an armed quarry where a battle is unresolved: neutral, or an enemy', () => {
    const S = base();
    S.world.provinces[5] = province(5, null, { _battleUnresolved: true });
    S.characters = S.characters.map((c) => (c.id === 3 ? { ...c, armies: army } : c));
    S.characters.push(ch(29, 2, 5, { armies: army }), ch(30, null, 5, { armies: army }), ch(32, null, 5));
    const { orders, plan } = scriptedOrders(S, 0, 7);
    // No war yet, so no chaser: the armed king and the armed hero both go; realm 2's hero is at peace with us and
    // the unarmed neutral can't be fought as a host.
    expect(orders.orders['1']?.[0]).toMatchObject({ action: 'pursue', target: '30' });
    expect(orders.orders['3']?.[0]).toMatchObject({ action: 'pursue', target: '30' });
    expect(orders.orders['2']?.[0]?.action).toBe('defend');
    expect(plan.battleChases).toEqual([
      { heroId: 1, quarryId: 30, provinceId: 5 },
      { heroId: 3, quarryId: 30, provinceId: 5 },
    ]);
  });

  test('only a king may run down a king in an unresolved battle', () => {
    const S = base();
    S.world.provinces[5] = province(5, null, { _battleUnresolved: true });
    S.characters = S.characters.map((c) => (c.id === 3 ? { ...c, armies: army } : c));
    S.characters.push(ch(30, null, 5, { isKing: true, armies: army }));
    const { orders } = scriptedOrders(S, 0, 7);
    expect(orders.orders['1']?.[0]).toMatchObject({ action: 'pursue', target: '30' });
    expect(orders.orders['3']?.[0]?.action).toBe('defend');
  });

  test('the same state gives the same orders', () => {
    const S = base();
    S.relations = { '0-1': 'enemy', '0-2': 'enemy' };
    expect(scriptedOrders(S, 0, 9)).toEqual(scriptedOrders(structuredClone(S), 0, 9));
  });
});
