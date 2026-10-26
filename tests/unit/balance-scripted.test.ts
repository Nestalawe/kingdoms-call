// The scripted realm's choices (tools/balance/scripted.ts, P1-02a; P1-15e2: in the player portal's terms, sent as the
// portal sends them, tools/balance/the-orders-the-player-portal-sends.ts), written from a saved state with no
// randomness: war on the nearest realm met, the chase after the nearest enemy it sees (Encounter Character), the chase
// into an unresolved battle, Recruit Armies, the spare heroes' orders (P1-15e3: Spy, Hire Hero and its card, Search
// Lair, a mastery, Research, Practice Skill, Explore, Rest, Release Hero), a plan for every living hero, an heir's
// points, a research lead, and the payload's every field. A tiny made-up map, one case per kind of choice. Level 1 (unit): pure functions of a state.
// That the portal sends the same for the same choices is the page test's
// (tests/page/the-scripted-realm-sends-what-the-player-portal-sends.test.ts).
import { describe, expect, test } from 'vitest';
import { L79_ORDERS } from '../../src/ui/player/l79-orders.ts';
import {
  hexDistance,
  MASTERIES,
  nearestMetRealm,
  planFor,
  scriptedChoices,
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
const base = (): State => ({
  turn: 8,
  world: {
    cols: 8,
    rows: 1,
    provinces: [
      province(0, 0, { armyTypes: ['Pikes', 'Bows'] }),
      province(1, 0),
      province(2, null),
      province(3, 1),
      province(4, null, { terrain: 'sea' }),
      province(5, null),
      province(6, 2),
      province(7, null),
    ],
  },
  players: [{ homeProvinceId: 0, provinces: [0, 1], _encountered: [1, 2] }, { provinces: [3] }, { provinces: [6] }],
  characters: [
    ch(0, 0, 0, { isKing: true, armies: army }),
    ch(1, 0, 1),
    ch(2, 0, 1),
    ch(3, 1, 3, { isKing: true, armies: army }),
    ch(4, 1, 3),
    ch(5, 2, 6, { isKing: true }),
    ch(6, 2, 6),
  ],
  relations: {},
});
const atWarWith1 = (S: State): State => ({ ...S, relations: { '0-1': 'enemy' } });
/** Moves character `id` to province `to`. */
const moved = (S: State, id: number, to: number): State => ({
  ...S,
  characters: S.characters.map((c) => (c.id === id ? { ...c, location: to } : c)),
});

describe('the map', () => {
  test('hex distance wraps east to west', () => {
    expect(hexDistance(province(0, null), province(7, null), 8)).toBe(1);
    expect(hexDistance(province(0, null), province(3, null), 8)).toBe(3);
  });

  test('the nearest realm met is the one whose land is nearest the king, of the realms met and still in the game', () => {
    const S = base();
    expect(nearestMetRealm(S, 0)).toBe(2); // province 6 is 2 away across the wrap, province 3 is 3 away
    expect(nearestMetRealm({ ...S, players: [{ ...S.players[0], _encountered: [1] }, {}, {}] }, 0)).toBe(1);
    expect(nearestMetRealm({ ...S, players: [{ ...S.players[0], _encountered: [] }, {}, {}] }, 0)).toBeNull();
    const conceded = { ...S, players: [S.players[0] ?? {}, { provinces: [3] }, { provinces: [6], conceded: true }] };
    expect(nearestMetRealm(conceded, 0)).toBe(1);
    const noKing = { ...S, characters: S.characters.filter((c) => c.id !== 0) };
    noKing.players = [{ homeProvinceId: 1, provinces: [0, 1], _encountered: [1, 2] }, {}, {}];
    expect(nearestMetRealm(noKing, 0)).toBe(1); // from home: 1 → 3 is 2, 1 → 6 is 3
  });
});

describe('war', () => {
  test('declared on the nearest realm met, never on one not met', () => {
    expect(scriptedChoices(base(), 0, 8).chose.diplomacy).toEqual({ '2': 'enemy' });
    const metNone = { ...base(), players: [{ homeProvinceId: 0, provinces: [0, 1] }, {}, {}] };
    expect(scriptedChoices(metNone, 0, 8).chose.diplomacy).toEqual({});
  });

  test('not declared again on a realm already at war, nor before Safe Start ends (the orders for turn 6)', () => {
    expect(scriptedChoices({ ...base(), relations: { '0-2': 'enemy' } }, 0, 8).chose.diplomacy).toEqual({});
    const safe = { ...base(), safeStart: true };
    expect(scriptedChoices(safe, 0, 5).chose.diplomacy).toEqual({});
    expect(scriptedChoices(safe, 0, 6).chose.diplomacy).toEqual({ '2': 'enemy' });
  });
});

describe('the chase', () => {
  test('the armed king sets out after the nearest enemy his realm sees: one in its land with troops', () => {
    const S = moved(atWarWith1(base()), 3, 1); // realm 1's armed king in province 1, realm 0's land
    const { chose, plan } = scriptedChoices(S, 0, 8);
    expect(chose.orders['0']).toEqual([{ action: 'Encounter Character', target: '3' }, null, null, null, null]);
    expect(plan.chaser).toEqual({ heroId: 0, quarryId: 3 });
  });

  test('an enemy the realm doesn’t see is not chased', () => {
    const { chose, plan } = scriptedChoices(atWarWith1(base()), 0, 8); // realm 1's heroes stand in province 3, unseen
    expect(plan.chaser).toBeNull();
    expect(chose.orders['0']?.[0]?.action).toBe('Recruit Armies');
  });

  test('a hero beside one of the realm’s is seen; an Invisibility cast in the turn hides him', () => {
    const S = moved(moved(atWarWith1(base()), 1, 3), 2, 3); // realm 0's heroes 1 and 2 stand with realm 1's king and hero
    expect(scriptedChoices(S, 0, 8).plan.chaser).toEqual({ heroId: 0, quarryId: 3 });
    const hidden = { ...S, characters: S.characters.map((c) => (c.id === 3 ? { ...c, _invisTurn: 7 } : c)) };
    expect(scriptedChoices(hidden, 0, 8).plan.chaser).toEqual({ heroId: 0, quarryId: 4 });
  });

  test('a king without an army leaves the chase to the first hero, who may not hunt a king', () => {
    const S = moved(moved(atWarWith1(base()), 1, 3), 2, 3);
    S.characters = S.characters.map((c) => (c.id === 0 ? { ...c, armies: [] } : c));
    const { chose, plan } = scriptedChoices(S, 0, 8);
    expect(plan.chaser).toEqual({ heroId: 1, quarryId: 4 });
    expect(chose.orders['0']?.[0]).toEqual({ action: 'Recruit Armies', target: 'Pikes|1' });
  });

  test('every other armed hero sets out after an armed enemy he sees where a battle is unresolved, never a wanderer', () => {
    const S = moved(moved(atWarWith1(base()), 1, 3), 2, 3);
    S.world.provinces[3] = province(3, 1, { _battleUnresolved: true });
    S.characters = S.characters.map((c) => (c.id === 2 ? { ...c, armies: army } : c));
    S.characters.push(ch(9, 1, 3, { armies: army }), ch(7, null, 3, { armies: army })); // the wanderer's id first
    const { chose, plan } = scriptedChoices(S, 0, 8);
    expect(plan.chaser).toEqual({ heroId: 0, quarryId: 3 }); // the king, after the nearest: realm 1's king
    expect(plan.battleChases).toEqual([{ heroId: 2, quarryId: 9, provinceId: 3 }]); // not the king (only a king may)
    expect(chose.orders['2']?.[0]).toEqual({ action: 'Encounter Character', target: '9' });
    // unarmed, he has no battle to chase: a spare hero, who spies on the wanderer beside him
    expect(chose.orders['1']?.[0]).toEqual({ action: 'Spy', target: 'char:7' });
  });
});

describe('the king recruits', () => {
  test('one unit of the first kind the form offers, on his realm’s land only', () => {
    expect(scriptedChoices(base(), 0, 8).chose.orders['0']?.[0]).toEqual({
      action: 'Recruit Armies',
      target: 'Pikes|1',
    });
    const offItsLand = moved(base(), 0, 2);
    offItsLand.world.provinces[2] = province(2, null, { armyTypes: ['Spears'] });
    expect(scriptedChoices(offItsLand, 0, 8).chose.orders['0']?.[0]?.action).not.toBe('Recruit Armies'); // a spare hero
    const seaBeastFirst = base();
    seaBeastFirst.world.provinces[0] = province(0, 0, { armyTypes: ['Great Turtles', 'Bows'] });
    expect(scriptedChoices(seaBeastFirst, 0, 8).chose.orders['0']?.[0]?.target).toBe('Bows|1');
  });
});

describe('a plan for every living hero, varied by hero and turn', () => {
  test('tactics from the form’s own, Steal only at Thief 1; a school only of his own; each duel stance in turn', () => {
    const hero = ch(1, 0, 1, { skills: { white: 2 } });
    const plans = [6, 7, 8, 9, 10, 11].map((turn) => planFor(hero, turn, false));
    expect(new Set(plans.flatMap((p) => p.tactics))).toEqual(new Set(['ME', 'FI', 'FL']));
    expect(new Set(plans.map((p) => p.duelStance))).toEqual(new Set(['challenge', 'accept', 'refuse']));
    expect(new Set(plans.map((p) => p.school))).toEqual(new Set(['', 'white']));
    expect(plans.some((p) => p.notes !== '')).toBe(true);
    expect(plans.every((p) => p.evilMode === undefined)).toBe(true);
    const thief = ch(1, 0, 1, { skills: { thief: 1 } });
    expect([6, 7, 8, 9].flatMap((turn) => planFor(thief, turn, false).tactics)).toContain('ST');
  });

  test('an Evil realm’s heroes get each conquest doctrine in turn', () => {
    const hero = ch(1, 0, 1);
    expect(new Set([6, 7].map((turn) => planFor(hero, turn, true).evilMode))).toEqual(new Set(['terror', 'enslave']));
  });

  test('every living hero the form lists gets one; a fallen hero none', () => {
    const S = base();
    S.characters.push(ch(7, 0, 0, { alive: false, killedThisTurn: true }), ch(8, 0, 0, { alive: false }));
    expect(Object.keys(scriptedChoices(S, 0, 8).chose.plans).sort()).toEqual(['0', '1', '2']);
  });
});

describe('an heir and a research pair', () => {
  test('an heir spends his points, no more than he has', () => {
    const S = base();
    S.characters = S.characters.map((c) =>
      c.id === 1 ? { ...c, _isHeir: true, _pendingSkillAllocation: 3, skills: { melee: 1 } } : c,
    );
    expect(scriptedChoices(S, 0, 8).chose.heirPoints).toEqual({ '1': ['melee', 'tactical', 'melee'] });
    const { kingSkills } = scriptedOrders(S, 0, 8).orders;
    expect(kingSkills).toEqual({
      '1': { skills: { melee: 3, tactical: 1 }, pending: 1, name: '', temper: '', base: { melee: 1 } },
    });
  });

  test('the first lead of each pending research pair is kept', () => {
    const S = base();
    S.players[0] = {
      ...S.players[0],
      pendingDiscoveryChoices: [{ key: 'rc7_1_2', options: ['nope', 'sd31', 'sd60'] }],
    };
    expect(scriptedChoices(S, 0, 8).chose.discoveryChoices).toEqual({ rc7_1_2: 'sd31' });
  });
});

describe('the spare heroes give the orders the form offers them (P1-15e3)', () => {
  /** Base, with realm 0's king armed and recruiting, and hero `id` alone in province 2 (no one else's land). */
  const alone = (id: number, extra: Partial<Character> = {}): State => {
    const S = moved(base(), id, 2);
    S.characters = S.characters.map((c) => (c.id === id ? { ...c, ...extra } : c));
    return S;
  };
  const first = (S: State, id: number, turn = 8) => scriptedChoices(S, 0, turn).chose.orders[String(id)]?.[0];

  test('a wanderer beside him is spied on before a rival, and the line names him', () => {
    const S = alone(1);
    S.characters.push(ch(9, 1, 2, { name: 'Rival' }), ch(8, null, 2, { name: 'Wanderer', alignment: 'Divine' }));
    S.players[0] = { ...S.players[0], alignment: 'Undead' }; // a Divine wanderer won't serve an Undead crown
    expect(first(S, 1)).toEqual({ action: 'Spy', target: 'char:8' });
    expect(scriptedOrders(S, 0, 8).orders.orders['1']?.[0]?.desc).toBe('Spy — on Wanderer');
    S.characters = S.characters.filter((c) => c.id !== 8);
    expect(first(S, 1)).toEqual({ action: 'Spy', target: 'char:9' });
  });

  test('a wanderer who might have slipped by unseen (any Spy, or Illusory 6) is neither spied on nor hired', () => {
    for (const skills of [{ spy: 1 }, { illusory: 6 }]) {
      const S = alone(1);
      S.characters.push(ch(8, null, 2, { skills }));
      expect(first(S, 1)?.action).not.toMatch(/Spy|Hire Hero/);
    }
  });

  test('a wanderer who will serve is hired on even turns (by hero and turn), once, with his card and its plan', () => {
    const S = alone(1);
    S.characters.push(ch(8, null, 2, { name: 'Wanderer', alignment: 'Good' }));
    expect(first(S, 1, 9)).toEqual({ action: 'Hire Hero', target: '8' }); // k = 1 + 9, even
    expect(first(S, 1, 8)).toEqual({ action: 'Spy', target: 'char:8' }); // k odd
    const { orders } = scriptedOrders({ ...S, players: [{ ...S.players[0], alignment: 'Evil' }, {}, {}] }, 0, 9);
    expect(orders.orders['hired_8_via_1_ph0']).toEqual(
      Array.from({ length: 5 }, () => ({ action: 'Defend', target: '', extra: '', desc: '' })),
    );
    // the wanderer's plan for turn 9 (k = 8 + 9), with no conquest doctrine: a card has none, even an Evil realm's
    expect(orders.encounterPlans['hired_8_via_1_ph0']).toEqual({
      tactics: ['FL', 'ME', 'FI'],
      notes: '',
      duelStance: 'refuse',
    });
    // two heroes beside him on a turn both would hire (k even): the first hires, the other spies
    const two = { ...S, characters: [...S.characters, ch(11, 0, 2)] };
    expect(first(two, 1, 9)?.action).toBe('Hire Hero');
    expect(first(two, 11, 9)).toEqual({ action: 'Spy', target: 'char:8' });
  });

  test('Search Lair on a Weak lair his realm knows there, with the province it was planned in', () => {
    const lairs = [
      { tier: 'Weak', discoveredBy: [1] }, // another realm's find
      { tier: 'Moderate', discoveredBy: [0] },
      { tier: 'Weak', discoveredBy: [0], cleared: true },
      { tier: 'Weak', ritualSite: true, discoveredBy: [0] },
      { monster: { power: 'Weak' }, discoveredBy: [0] },
    ];
    const S = alone(1);
    S.world.provinces[2] = province(2, null, { features: lairs });
    const turns = [8, 9, 10, 11].map((turn) => first(S, 1, turn));
    expect(turns).toContainEqual({ action: 'Search Lair', target: '4' });
    expect(turns.filter((o) => o?.action === 'Search Lair').every((o) => o?.target === '4')).toBe(true);
    const turn = 8 + turns.findIndex((o) => o?.action === 'Search Lair');
    expect(scriptedOrders(S, 0, turn).orders.orders['1']?.[0]).toEqual({
      action: 'Search Lair',
      target: '4',
      extra: '',
      desc: 'Search Lair — 4',
      prov: 2,
    });
    // explored far enough, a lair is known without being found: the first of five at 20%
    S.world.provinces[2] = province(2, null, {
      features: [{ tier: 'Weak' }, ...lairs.slice(1)],
      exploredBy: { '0': 20 },
    });
    expect([8, 9, 10, 11].map((t) => first(S, 1, t))).toContainEqual({ action: 'Search Lair', target: '0' });
  });

  test('else Practice Skill, Explore and Rest in turn, and Research only at Sage 1', () => {
    const actions = (S: State) => new Set([6, 7, 8, 9, 10, 11, 12, 13].map((t) => first(S, 2, t)?.action));
    expect(actions(alone(2))).toEqual(new Set(['Practice Skill', 'Explore', 'Rest']));
    expect(actions(alone(2, { skills: { sage: 1 } }))).toEqual(
      new Set(['Research', 'Practice Skill', 'Explore', 'Rest']),
    );
    const practised = [8, 9, 10].map((t) => first(alone(2), 2, t)).find((o) => o?.action === 'Practice Skill');
    expect(practised?.target).toMatch(/^[a-z]+$/);
  });

  test('the masteries are the form’s that need no target, but the Grand Design, at the form’s levels', () => {
    const theForms = Object.entries(L79_ORDERS)
      .filter(([name, m]) => m.target === 'none' && name !== 'Grand Design')
      .map(([name, m]) => ({ name, skill: m.skill, lvl: m.lvl }));
    expect(MASTERIES).toEqual(theForms);
  });

  test('a master uses his mastery, one with no target, at its level only', () => {
    expect(first(alone(1, { skills: { tactical: 7 } }), 1)).toEqual({ action: 'Feigned Retreat', target: '' });
    expect(first(alone(1, { skills: { tactical: 6 } }), 1)?.action).not.toBe('Feigned Retreat');
    expect(first(alone(1, { skills: { sage: 9 } }), 1)).toEqual({ action: 'Research Breakthrough', target: '' });
  });

  test('once a game, in the orders for turn 6, the first unarmed hero is released if the realm has three or more', () => {
    expect(first(base(), 1, 6)).toEqual({ action: 'Release Hero', target: '' });
    expect(first(base(), 2, 6)?.action).not.toBe('Release Hero');
    expect(first(base(), 1, 7)?.action).not.toBe('Release Hero');
    const two = { ...base(), characters: base().characters.filter((c) => c.id !== 2) };
    expect(first(two, 1, 6)?.action).not.toBe('Release Hero');
    const armed = { ...base(), characters: base().characters.map((c) => (c.id === 1 ? { ...c, armies: army } : c)) };
    expect(first(armed, 2, 6)).toEqual({ action: 'Release Hero', target: '' });
  });
});

describe('the orders, as the player portal sends them', () => {
  test('every field: five orders for every hero listed, the form’s names and lines, a plan, the column, the flags', () => {
    const S = moved(atWarWith1(base()), 3, 1);
    S.characters.push(ch(7, 0, 0, { killedThisTurn: true, alive: false }));
    S.players[0] = { ...S.players[0], heroOrder: ['2', '0'] };
    const { orders } = scriptedOrders(S, 0, 8);
    const defend = { action: 'Defend', target: '', extra: '', desc: 'Defend' };
    // the two spare heroes stand with realm 1's king: each spies on him
    const spy = { action: 'Spy', target: 'char:3', extra: '', desc: 'Spy' };
    expect(orders.orders).toEqual({
      '0': [
        { action: 'Encounter Character', target: '3', extra: '', desc: 'Encounter Character — 3' },
        ...Array.from({ length: 4 }, () => defend),
      ],
      '1': [spy, ...Array.from({ length: 4 }, () => defend)],
      '2': [spy, ...Array.from({ length: 4 }, () => defend)],
      '7': Array.from({ length: 5 }, () => defend), // fallen this turn: listed, with no form
    });
    expect(Object.keys(orders.encounterPlans).sort()).toEqual(['0', '1', '2']);
    expect(orders.encounterPlans['0']).toEqual({ tactics: ['FL', 'ME', 'FI'], notes: '', duelStance: 'refuse' });
    expect(orders.heroOrder).toEqual(['2', '0', '1']); // the saved arrangement, then the rest in the world's order
    expect(orders).toMatchObject({
      kingSkills: {},
      diplomacy: { '2': 'enemy' },
      discoveryChoices: {},
      callReckoning: false,
      concede: false,
      messages: [],
      forTurn: 8,
    });
  });

  test('a plan with a school puts it last; with no arrangement saved, the king heads the column', () => {
    const S = base();
    S.characters = S.characters.map((c) => (c.id === 1 ? { ...c, skills: { psychic: 1 } } : c));
    S.characters.unshift(...S.characters.splice(0, 1).map((c) => ({ ...c, id: 9 })));
    const { orders } = scriptedOrders(S, 0, 9); // hero 1 on turn 9: k = 10
    expect(orders.encounterPlans['1']?.tactics).toEqual(['FI', 'FL', 'CS:psychic']);
    expect(orders.heroOrder?.[0]).toBe('9');
  });

  test('the same state gives the same orders', () => {
    const S = { ...base(), relations: { '0-1': 'enemy', '0-2': 'enemy' } };
    expect(scriptedOrders(S, 0, 9)).toEqual(scriptedOrders(structuredClone(S), 0, 9));
  });
});
