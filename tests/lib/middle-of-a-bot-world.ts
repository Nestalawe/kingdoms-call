// A small stage for tests of the turn's helpers lifted out of resolveTurn (plan P1-08i3): the middle of a bot world
// made by the engine, cleared, with heroes stood on it one by one. Each board is a fresh turn's context
// (tests/lib/engine.ts) in one phase: the province at row 4, column 5 (X), its six neighbours (ring1) and theirs
// (ring2) are open plain, unowned, with no garrison, guard or lair; nobody stands anywhere and nobody has orders.
// Realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace. playTurn (plan P1-08j1) plays a whole turn from a board
// as staged, for a scenario test (level 2) of an order.
import vm from 'node:vm';
import { engineFn, turnContext, type TurnContext } from './engine.ts';

export interface Unit {
  type: string;
  quality: string;
  race: string;
  unitName: string;
  _died?: boolean;
  _disbanded?: boolean;
  [key: string]: unknown;
}
export interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters: number[];
  garrisonArmies: Unit[];
  neutralDefenders: Unit[];
  npcArmies: number;
  visitedBy?: number[];
  _battleUnresolved?: boolean;
  _hadBattleThisTurn?: boolean;
  _leaderlessDefenders?: boolean;
  [key: string]: unknown;
}
export interface Character {
  id: number;
  name: string;
  player: number | null;
  isKing: boolean;
  alive: boolean;
  location: number;
  armies: Unit[];
  skills: Record<string, number>;
  hp: number;
  maxHp: number;
  items: Record<string, unknown>[];
  _pursuit?: { active: boolean; targetId: number; setPhase?: number };
  _foughtStalledBattlePhase?: number;
  _encounteredThisPhase?: number;
  _isNeutralGuard?: boolean;
  _leaderlessHost?: boolean;
  _defend?: { active: boolean };
  [key: string]: unknown;
}
export interface World {
  turn: number;
  relations: Record<string, string>;
  players: { name: string; provinces: number[]; [key: string]: unknown }[];
  characters: Character[];
  mercenaries?: { type: string; quality: string; location: number; id: string; [key: string]: unknown }[];
  turnOrders: Record<number, ({ action: string; target?: string } | null)[]>;
  world: { cols: number; rows: number; provinces: Province[] };
}
export interface Line {
  type: string;
  text: string;
  charId: number | null;
  provinceId: number | null;
  actor?: number | null;
  targets?: number[];
  /** The phase (0–4; 99 for the end of the turn), or null. */
  phase?: number | null;
  [key: string]: unknown;
}

const must = <T>(x: T | undefined | null, what: string): T => {
  if (x == null) throw new Error('missing ' + what);
  return x;
};
export { must };

/** Runs `body` with the dice the engine draws pinned, in turn, to `dice` (each in [0, 1)); once they run out, the
 *  last one repeats. */
export function withDice<T>(engine: vm.Context, dice: number[], body: () => T): T {
  const kcRng = vm.runInContext('kcRng', engine) as { use(next: () => number): () => number };
  let i = 0;
  const was = kcRng.use(() => must(dice[Math.min(i++, dice.length - 1)], 'a die'));
  try {
    return body();
  } finally {
    kcRng.use(was);
  }
}

/** Runs `body` with the first die the engine draws pinned to `first`, the rest from the dice as they were. */
export function firstDie<T>(engine: vm.Context, first: number, body: () => T): T {
  const kcRng = vm.runInContext('kcRng', engine) as { use(next: () => number): () => number };
  let pinned = true;
  const was = kcRng.use(() => {
    if (!pinned) return was();
    pinned = false;
    return first;
  });
  try {
    return body();
  } finally {
    kcRng.use(was);
  }
}

/** Runs `body` with every percentile roll the engine makes (the top-level d100) fixed at `roll`, 1 to 100 (plan
 *  P1-08j6). Over a whole turn, with `withDice` fixing every other die, an order's rolls are certain however many dice
 *  the turn draws before them. */
export function withRolls<T>(engine: vm.Context, roll: number, body: () => T): T {
  const was = vm.runInContext('d100', engine) as () => number;
  const set = vm.runInContext('(f)=>{ d100=f; }', engine) as (f: () => number) => void;
  set(() => roll);
  try {
    return body();
  } finally {
    set(was);
  }
}

/** A fresh board on `world` (JSON from botWorld) in phase `ph`. */
export function board(engine: vm.Context, world: string, ph: number) {
  const getNeighborsP = engineFn(engine, 'getNeighborsP') as (
    p: Province,
    cols: number,
    rows: number,
    ps: Province[],
  ) => Province[];
  const tc = turnContext(engine, world);
  tc._currentPhase = ph;
  tc._logCtx.phase = ph;
  const G = tc.G as unknown as World;
  G.relations = { '0-1': 'enemy', '0-2': 'allied', '1-2': 'peace' };
  G.characters = [];
  G.turnOrders = {};
  G.mercenaries = [];
  const ps = G.world.provinces;
  ps.forEach((p) => {
    p.characters = [];
  });
  const nbrs = (p: Province) => getNeighborsP(p, G.world.cols, G.world.rows, ps);
  const X = must(
    ps.find((p) => p.row === 4 && p.col === 5),
    'the middle province',
  );
  const ring1 = nbrs(X);
  const ring2 = [...new Set(ring1.flatMap(nbrs))].filter((p) => p !== X && !ring1.includes(p));
  const near = [X, ...ring1, ...ring2];
  near.forEach((p) =>
    Object.assign(p, {
      terrain: 'plain',
      owner: null,
      features: [],
      garrisonArmies: [],
      neutralDefenders: [],
      npcArmies: 0,
    }),
  );
  G.players.forEach((pl) => {
    pl.provinces = pl.provinces.filter((id) => !near.some((p) => p.id === id));
  });
  const own = (p: Province, pi: number | null) => {
    G.players.forEach((pl) => {
      pl.provinces = pl.provinces.filter((id) => id !== p.id);
    });
    p.owner = pi;
    if (pi != null) must(G.players[pi], 'realm ' + String(pi)).provinces.push(p.id);
  };
  // The turn's lines so far in words, as the views write them (theTurnsLinesInWords, P1-12c3).
  const inWords = engineFn(engine, 'theTurnsLinesInWords') as (log: unknown) => { gmLog: Line[] };
  const lines = () => inWords(tc.turnLog).gmLog;
  return { engine, tc, G, ph, X, ring1, ring2, near, nbrs, own, lines };
}
export type Board = ReturnType<typeof board>;

export interface HeroSpec {
  player: number | null;
  at: Province;
  /** Companies of `type` (default Men-at-Arms) of `quality` (default Regular). */
  troops?: number;
  type?: string;
  quality?: string;
  land?: number;
  sea?: number;
  king?: boolean;
  skills?: Record<string, number>;
  hp?: number;
}
let nextId = 9000;
/** Stands a new hero of `player` in `at`, leading `troops` companies, with `land` and `sea` points of movement left. */
export function hero(b: Board, s: HeroSpec): Character {
  const id = ++nextId;
  const type = s.type ?? 'Men-at-Arms';
  const armies: Unit[] = Array.from({ length: s.troops ?? 0 }, (_, k) => ({
    type,
    quality: s.quality ?? 'Regular',
    race: 'Human',
    unitName: `${type} #${String(id)}.${String(k)}`,
  }));
  const c: Character = {
    id,
    name: `Hero ${String(id)}`,
    isKing: !!s.king,
    player: s.player,
    race: 'Human',
    alignment: 'Divine',
    temper: 'Cautious',
    hp: s.hp ?? 20,
    maxHp: s.hp ?? 20,
    skills: s.skills ?? { melee: 2, tactical: 2, march: 1, spy: 0 },
    aptitude: {},
    armies,
    items: [],
    location: s.at.id,
    locationName: s.at.name,
    alive: true,
    merits: 0,
    spellsUsedThisTurn: [],
  };
  b.G.characters.push(c);
  s.at.characters.push(id);
  const pools = b.tc as unknown as Record<string, Record<number, unknown>>;
  must(pools['movePoints'], 'movePoints')[id] = s.land ?? 1;
  must(pools['seaMovePoints'], 'seaMovePoints')[id] = s.sea ?? 0;
  must(pools['seaMoveActive'], 'seaMoveActive')[id] = false;
  must(pools['seaCap'], 'seaCap')[id] = 'land';
  return c;
}
/** One phase's order, as a realm sends it. */
export interface Order {
  action: string;
  target: string;
  extra: string;
  desc: string;
}
/** An order: `order('move', 12)`. */
export const order = (action: string, target: string | number = '', extra: string | number = ''): Order => ({
  action,
  target: String(target),
  extra: String(extra),
  desc: '',
});
/** Five orders: the given ones first, then Rest. */
export const plan = (...orders: Order[]): Order[] => [
  ...orders.slice(0, 5),
  ...Array.from({ length: Math.max(0, 5 - orders.length) }, () => order('rest')),
];
/** What a realm sends with its orders beside them: its declarations (realm index → 'treat' or 'enemy'), a call for
 *  the Reckoning, a concession. */
export interface RealmSends {
  diplomacy?: Record<number, 'treat' | 'enemy'>;
  callReckoning?: boolean;
  concede?: boolean;
}
export interface PlayedTurn {
  /** The world after the turn, as saved. */
  after: World;
  /** The GM's log of the turn, in words (as the views write it: theTurnsLinesInWords, P1-12c3). */
  lines: Line[];
}
/** Plays one whole turn (resolveTurn) from the board as staged (plan P1-08j1): every realm human-held, each hero given
 *  orders here doing them, every other hero Resting, safe start over. The turn works out its own move points; the
 *  board's context isn't used. `written` adds orders a realm sends under a key of its own (plan P1-08j3: the orders
 *  written for a hero it means to hire, `hired_<hero>_via_<hirer>_ph<phase>`), by realm. The realms in `bots` are
 *  bot realms (plan P1-08j9: a slot row with no player and `isBot` in its report), which plan their own orders in the
 *  turn. `sends` gives what a realm sends with its orders beside them (plan P1-08k4: its declarations toward other
 *  realms, a call for the Reckoning, a concession), by realm; by default nothing. */
export function playTurn(
  b: Board,
  orders: Record<number, Order[]>,
  written: Record<number, Record<string, Order[]>> = {},
  bots: number[] = [],
  sends: Record<number, RealmSends> = {},
): PlayedTurn {
  const G = b.G as World & { safeStart?: boolean };
  G.safeStart = false;
  const rows = G.players.map((_, i) => ({
    id: 'G1gp' + String(i),
    game_id: 'G1',
    user_id: bots.includes(i) ? null : 'u' + String(i),
    player_index: i,
    display_name: 'Realm ' + String(i),
    orders_submitted: true,
    orders: JSON.stringify({
      orders: {
        ...Object.fromEntries(
          G.characters.filter((c) => c.alive && c.player === i).map((c) => [c.id, orders[c.id] ?? plan()]),
        ),
        ...written[i],
      },
      encounterPlans: {},
      kingSkills: {},
      diplomacy: sends[i]?.diplomacy ?? {},
      discoveryChoices: {},
      callReckoning: sends[i]?.callReckoning ?? false,
      concede: sends[i]?.concede ?? false,
      messages: [],
      heroOrder: [],
      forTurn: G.turn,
    }),
    turn_report: bots.includes(i) ? '{"isBot":true}' : '{}',
  }));
  const resolveTurn = engineFn(b.engine, 'resolveTurn') as (
    state: string,
    rows: unknown,
    turn: number,
  ) => { state: string; log: Line[] };
  const inWords = engineFn(b.engine, 'theTurnsLinesInWords') as (log: Line[]) => { gmLog: Line[] };
  const inVm = vm.runInContext('(j)=>JSON.parse(j)', b.engine) as (j: string) => unknown;
  const resolved = resolveTurn(JSON.stringify(G), inVm(JSON.stringify(rows)), G.turn);
  return { after: JSON.parse(resolved.state) as World, lines: inWords(resolved.log).gmLog };
}
/** A hero's points of movement left. */
export const points = (b: Board, c: Character) => {
  const pools = b.tc as unknown as Record<string, Record<number, number>>;
  return { land: pools['movePoints']?.[c.id] ?? 0, sea: pools['seaMovePoints']?.[c.id] ?? 0 };
};
/** A hero's own lines in the log. */
export const linesOf = (b: Board, c: Character) => b.lines().filter((l) => l.charId === c.id);
/** Every line of the log, as one string, for matching. */
export const allText = (b: Board) =>
  b
    .lines()
    .map((l) => l.text)
    .join('\n');
export type { TurnContext };
