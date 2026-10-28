// The Move order's own function (plan P1-08j1: resolveMoveOrder, src/engine/orders/, the first order taken out of
// processOrder), called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the
// cases scenario/move-orders-in-a-whole-turn.test.ts plays through a whole turn (lib/move-order-cases.ts), here one
// phase at a time with the move points a turn starts with; then the cases the dice decide (fixed here) and the ones the
// balance matrix never reaches: Forced March slipping past a battle, a friend joining the assault, a blockade, a flood,
// the Veil, a leaderless garrison, a coastal raid's plunder, hidden lairs, Pathfinder, no road, a bad target, and a
// hero with no move points worked out yet. Level 1: one function, called with what processOrder hands it.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The Move's own function (`resolveMoveOrder`, P1-08j1), called directly on the same cases one phase at a time, then on
// what the dice decide (fixed) and what the balance matrix never reaches: Forced March slipping past a guard, a hero, a
// garrison and a leaderless garrison on a low roll (contested, no battle) and fighting on a high one; a friend marching
// on the same province joining the assault, or missing it; an enemy blockade; a flood that turns a column back or
// strands one; no road to a far target; a target that names nowhere; a hero whose move points were never worked out;
// the Veil (no battle); a leaderless neutral garrison fighting on; a coastal raid's plunder; lairs hidden by a rival's
// illusion; Pathfinder spotting one lair more. 46 planted faults in the function each turn at least one of the two
// tests red but one (its missing-pool safety net, which changes nothing: Parked)
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import {
  board,
  hero,
  must,
  type Board,
  type Character,
  type Line,
  type Order,
  type Province,
  type Unit,
  withDice,
} from '../lib/middle-of-a-bot-world.ts';
import { MOVE_ORDER_CASES } from '../lib/move-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
const resolveMoveOrder = engineFn(engine, 'resolveMoveOrder') as Fn;
const provOf = engineFn(engine, 'provOf') as Fn;
const setMovePool = engineFn(engine, 'setMovePool') as Fn;

const units = (n: number, type: string, quality = 'Regular'): Unit[] =>
  Array.from({ length: n }, (_, k) => ({ type, quality, race: 'Human', unitName: `${type} d${String(k)}` }));
/** The move points every realm's hero starts the turn with, as resolveTurn works them out. */
const startTheTurn = (b: Board) => {
  b.G.characters.filter((c) => c.player != null && c.alive).forEach((c) => setMovePool(b.tc, c));
};
/** One Move, as processOrder hands it over in phase `ph`: `fmSlip` for a Forced March. */
const move = (b: Board, c: Character, target: string | number, { ph = 0, fmSlip = false } = {}) => {
  b.tc._currentPhase = ph;
  b.tc._logCtx = { charId: c.id, phase: ph };
  resolveMoveOrder(b.tc, c, ph, fmSlip, String(target), provOf(b.tc, c), b.G.players[must(c.player, 'a realm')]);
  b.tc._logCtx = { charId: null, phase: null };
};
const linesOf = (b: Board, c: Character) => b.lines().filter((l: Line) => l.charId === c.id);
const textOf = (b: Board, c: Character) =>
  linesOf(b, c)
    .map((l) => l.text)
    .join('\n');
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const beyond = (b: Board, p: Province) =>
  must(
    b.nbrs(p).find((q) => q !== b.X && !b.ring1.includes(q)),
    'a province beyond ' + p.name,
  );
const column = (b: Board, player: number, at: Province) =>
  hero(b, { player, at, troops: 8, type: 'Heavy Infantry', quality: 'Veteran' });

describe('the Move order, called directly: the whole-turn cases', () => {
  test.each(MOVE_ORDER_CASES.filter((c) => !c.wholeTurnOnly).map((c) => [c.name, c] as const))('%s', (_, c) => {
    const b = board(engine, world, 0);
    const s = c.stage(b);
    startTheTurn(b);
    s.orders.forEach((o: Order, ph) => {
      if (o.action === 'move') move(b, s.mover, o.target, { ph });
    });
    const { got, want } = c.check({ world: b.G, lines: linesOf(b, s.mover) }, s);
    expect(got).toEqual(want);
  });
});

describe('Forced March: on a low roll the column slips in without giving battle, and the ground stays contested', () => {
  const holders: [string, (b: Board, to: Province) => void][] = [
    [
      'a neutral guard',
      (b, to) => {
        hero(b, { player: null, at: to, troops: 1, quality: 'Green' })._isNeutralGuard = true;
      },
    ],
    [
      'an enemy hero',
      (b, to) => {
        b.own(to, 1);
        b.own(beyond(b, to), 1);
        hero(b, { player: 1, at: to, troops: 1, quality: 'Green' });
      },
    ],
    [
      "an enemy realm's garrison",
      (b, to) => {
        b.own(to, 1);
        b.own(beyond(b, to), 1);
        to.garrisonArmies = units(1, 'Men-at-Arms', 'Green');
      },
    ],
    [
      'a leaderless neutral garrison',
      (b, to) => {
        to.neutralDefenders = units(1, 'Men-at-Arms', 'Green');
        to.npcArmies = 1;
        to._leaderlessDefenders = true;
      },
    ],
  ];
  test.each(holders)('held by %s', (_, hold) => {
    for (const [die, slips] of [
      [0.1, true],
      [0.9, false],
    ] as const) {
      const b = board(engine, world, 0);
      const to = ring1(b, 0);
      hold(b, to);
      const A = column(b, 0, b.X);
      startTheTurn(b);
      // every die the same: the march's own skill rolls come before the slip's
      withDice(engine, [die], () => {
        move(b, A, to.id, { fmSlip: true });
      });
      const t = textOf(b, A);
      expect({
        slipped: t.includes(`${A.name}'s Forced March filters into ${to.name} without giving battle this phase`),
        battle: t.includes(`Battle for ${to.name}`),
        stands: A.location,
        contestedIfSlipped: slips ? to._battleUnresolved : true,
      }).toEqual({ slipped: slips, battle: !slips, stands: to.id, contestedIfSlipped: true });
    }
  });
});

describe('a friend marching on the same province in the same season may join the assault', () => {
  test.each([
    ['a neutral guard', 'Contingent unify: ', 'cannot link up with'],
    ['an enemy hero', ' unifies with ', 'misses the timing'],
  ])('against %s', (holder, joins, misses) => {
    for (const [die, joined] of [
      [0, true],
      [0.995, false],
    ] as const) {
      const b = board(engine, world, 0);
      const to = ring1(b, 0);
      if (holder === 'a neutral guard')
        hero(b, { player: null, at: to, troops: 1, quality: 'Green' })._isNeutralGuard = true;
      else {
        b.own(to, 1);
        b.own(beyond(b, to), 1);
        hero(b, { player: 1, at: to, troops: 1, quality: 'Green' });
      }
      const A = column(b, 0, b.X);
      // a friend one province from the column's start (a 60% chance at March 1, 75% for a Good realm)
      const at = must(
        b.ring1.find((p) => p !== to && b.nbrs(p).includes(to)),
        'a neighbour of both',
      );
      const friend = hero(b, { player: 0, at, troops: 2 });
      b.G.turnOrders[friend.id] = [{ action: 'move', target: String(to.id) }, null, null, null, null];
      startTheTurn(b);
      // every die the same: the march's own skill rolls come before the friend's
      withDice(engine, [die], () => {
        move(b, A, to.id);
      });
      const t = textOf(b, A);
      const friendsOrder = (b.G.turnOrders[friend.id]?.[0] ?? {}) as { _unifiedWith?: number };
      expect({
        joins: t.includes(joins),
        misses: t.includes(misses),
        friendAt: friend.location,
        friendsOrderSpent: friendsOrder._unifiedWith,
      }).toEqual({
        joins: joined,
        misses: !joined,
        friendAt: joined ? to.id : at.id,
        friendsOrderSpent: joined ? A.id : undefined,
      });
    }
  });
});

describe('the ways a Move is barred', () => {
  test("an enemy blockade seals the sea: the fleet doesn't sail", () => {
    const b = board(engine, world, 0);
    const to = ring1(b, 1);
    Object.assign(to, { terrain: 'sea', _blockadeTurn: b.G.turn, _blockadeBy: 1 });
    const A = hero(b, { player: 0, at: b.X });
    A.armies = units(2, 'Galleon Fleet');
    startTheTurn(b);
    move(b, A, to.id);
    expect(A.location).toBe(b.X.id);
    expect(textOf(b, A)).toContain(`finds the waters of ${to.name} sealed by an enemy blockade`);
  });
  test('a flooded province turns a land column back; a column caught in a flood is stranded', () => {
    const b = board(engine, world, 0);
    const to = ring1(b, 0);
    Object.assign(to, { terrain: 'sea', _flood: true });
    const A = hero(b, { player: 0, at: b.X, troops: 2 });
    const stranded = ring1(b, 3);
    Object.assign(stranded, { terrain: 'sea', _flood: true });
    const B = hero(b, { player: 0, at: stranded, troops: 2 });
    startTheTurn(b);
    move(b, A, to.id);
    move(b, B, b.X.id);
    expect([A.location, B.location]).toEqual([b.X.id, stranded.id]);
    expect(textOf(b, A)).toContain(`is turned back at ${to.name}: the province has been FLOODED`);
    expect(textOf(b, B)).toContain(`is stranded in ${stranded.name}: a FLOOD has turned the province to open sea`);
  });
  test('prov:<id> with no road to it: the column holds', () => {
    const b = board(engine, world, 0);
    const far = must(b.ring2[0], 'a province two away');
    b.nbrs(far).forEach((p) => {
      p.terrain = 'sea';
    });
    const A = hero(b, { player: 0, at: b.X, troops: 2 });
    startTheTurn(b);
    move(b, A, 'prov:' + String(far.id));
    expect(A.location).toBe(b.X.id);
    expect(textOf(b, A)).toContain(
      `intended to march to ${far.name}, but from ${b.X.name} no passable route leads there`,
    );
  });
  test.each([
    ['prov:nowhere', ': invalid move target.'],
    ['', ': invalid move target.'],
    ['here', ' is already in '],
  ])('a target that names nowhere to go: %j', (target, says) => {
    const b = board(engine, world, 0);
    const A = hero(b, { player: 0, at: b.X, troops: 2 });
    startTheTurn(b);
    move(b, A, target === 'here' ? 'prov:' + String(b.X.id) : target);
    expect({ at: A.location, says: textOf(b, A).includes(says) }).toEqual({ at: b.X.id, says: true });
  });
  test('a hero whose move points were never worked out gets them before he marches', () => {
    const b = board(engine, world, 0);
    const to = ring1(b, 0);
    const A = hero(b, { player: 0, at: b.X, troops: 2 });
    const pools = b.tc as unknown as Record<string, Record<number, unknown>>;
    delete pools['movePoints']?.[A.id];
    delete pools['seaMovePoints']?.[A.id];
    move(b, A, to.id);
    expect(A.location).toBe(to.id);
    expect(pools['movePoints']?.[A.id]).toBe(1);
  });
});

describe('what a battle on arrival leaves', () => {
  test('the Veil: a veiled column slips into an enemy-held province unseen, and no battle is fought', () => {
    const b = board(engine, world, 0);
    const to = ring1(b, 0);
    b.own(to, 1);
    const D = hero(b, { player: 1, at: to, troops: 1, quality: 'Green' });
    const A = column(b, 0, b.X);
    Object.assign(A, { _veilTurn: b.G.turn, _veilCastPhase: 0 });
    startTheTurn(b);
    move(b, A, to.id);
    expect({ at: A.location, owner: to.owner, contested: !!to._battleUnresolved, defender: D.location }).toEqual({
      at: to.id,
      owner: 1,
      contested: false,
      defender: to.id,
    });
    expect(textOf(b, A)).not.toContain('Battle for');
  });
  test('a leaderless neutral garrison still fights: beaten, it yields the province, or rallies and contests it', () => {
    const b = board(engine, world, 0);
    const to = ring1(b, 0);
    to['tax'] = 2;
    to.neutralDefenders = units(1, 'Men-at-Arms', 'Green');
    to.npcArmies = 1;
    to._leaderlessDefenders = true;
    const A = column(b, 0, b.X);
    startTheTurn(b);
    move(b, A, to.id);
    const t = textOf(b, A);
    const claimed = t.includes(`overcomes the last of the leaderless defenders and claims ${to.name}`);
    const contested = t.includes(`The leaderless garrison of ${to.name} refuses to yield`);
    expect({ battle: t.includes(`Battle for ${to.name}`), oneOutcome: claimed !== contested, at: A.location }).toEqual({
      battle: true,
      oneOutcome: true,
      at: to.id,
    });
    expect(claimed ? [to.owner, A['merits'], to._leaderlessDefenders] : [to.owner, to._battleUnresolved]).toEqual(
      claimed ? [0, 2, undefined] : [null, true],
    );
  });
  test('a coastal raid that takes the province plunders its treasury from the realm that held it', () => {
    const b = board(engine, world, 0);
    b.X.terrain = 'sea';
    const to = ring1(b, 0);
    b.own(to, 1);
    to['tax'] = 5;
    const owner = must(b.G.players[1], 'realm 1');
    const raider = must(b.G.players[0], 'realm 0');
    owner['gold'] = 20;
    raider['gold'] = 0;
    raider['alignment'] = 'Good'; // an Evil crown loots a conquest too
    const A = hero(b, { player: 0, at: b.X });
    A.armies = [...units(2, 'Galleon Fleet'), ...units(2, 'Men-at-Arms')];
    A['_raidCoastTurn'] = b.G.turn;
    startTheTurn(b);
    move(b, A, to.id);
    expect({ owner: to.owner, theirs: owner['gold'], ours: raider['gold'] }).toEqual({ owner: 0, theirs: 15, ours: 5 });
    expect(textOf(b, A)).toContain(`${A.name}'s coastal raid sacks ${to.name} — 5g plundered`);
  });
});

describe('what a hero sees on the way in', () => {
  test("Hide Lairs: a rival's illusion keeps its lairs from him, and he senses it", () => {
    const b = board(engine, world, 0);
    const to = ring1(b, 0);
    to['features'] = [{ name: 'Old Barrow', monster: { name: 'Barrow Wight' }, _hidden: true, _hiddenBy: 1 }];
    to['exploredBy'] = { 0: 95 };
    const A = hero(b, { player: 0, at: b.X, troops: 1 });
    startTheTurn(b);
    move(b, A, to.id);
    expect((to['features'] as { discoveredBy?: number[] }[])[0]?.discoveredBy ?? []).toEqual([]);
    expect(textOf(b, A)).toContain(
      `Something clouds ${A.name}'s search of ${to.name} — a veiling illusion conceals lairs`,
    );
  });
  test('Pathfinder (Explorer 6): one more lair is spotted on entry, whatever the map shows', () => {
    const b = board(engine, world, 0);
    const to = ring1(b, 0);
    to['features'] = [
      { name: 'Old Barrow', monster: { name: 'Barrow Wight' } },
      { name: 'Sunken Shrine', monster: { name: 'Wyrm' } },
    ];
    to['exploredBy'] = {};
    const A = hero(b, { player: 0, at: b.X, troops: 1, skills: { melee: 2, tactical: 2, march: 1, explorer: 6 } });
    startTheTurn(b);
    move(b, A, to.id);
    const found = (to['features'] as { name: string; discoveredBy?: number[] }[]).filter((f) =>
      (f.discoveredBy ?? []).includes(0),
    );
    expect(found).toHaveLength(1);
    expect(textOf(b, A)).toContain(`Moving into ${to.name}, ${A.name} discovers the ${must(found[0], 'a lair').name}!`);
  });
});
