// The board of tests/lib/middle-of-a-bot-world.ts (plan P1-08i3), on the engine's modules, imported directly, with no
// vm (P1-14m): the same names, the same members on the board and the same staging, so a test moved off the vm changes
// its imports and the engine it passes, never its cases or its checks.
//
//   const engine = await loadTheEngineOnItsModules({ seed });   // fresh modules, the dice seeded `seed`
//   quietEngineLog(engine);
//   const world = botWorld(engine, 3, { cols: 10, rows: 8 });   // the vm's botWorld at the same seed, byte for byte
//   const { resolveMoveOrder } = await import('../../src/engine/orders/move-order-….ts');   // after the engine
//   const b = board(engine, world, 0);
//   const A = hero(b, { player: 0, at: b.X, troops: 2 });
//   withDice(engine, [0.1], () => resolveMoveOrder(b.tc, …));
//
// Each board is a fresh turn's context in one phase, on the world's JSON: the province at row 4, column 5 (X), its six
// neighbours (ring1) and theirs (ring2) are open plain, unowned, with no garrison, guard or lair; nobody stands anywhere
// and nobody has orders. Realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace. playTurn plays a whole turn
// from a board as staged. The context's fields come from lib/the-fields-resolve-turn-adds-to-the-turns-context.ts, the
// one list lib/engine.ts's turnContext uses too.
//
// Fresh modules (docs/architecture/how-the-tests-reach-the-site.md, "The engine's modules"): loadTheEngineOnItsModules
// calls vi.resetModules() and imports the whole engine again before it seeds the dice, as lib/engine.ts's loadEngine
// seeds a new vm. A module the test imports after it (`await import(…)`: a function to call, or one to stand in with
// vi.spyOn) is the same fresh one the board and the turn use. withDice and firstDie pin the modules' kcRng; withRolls
// fixes the modules' d100 (and pctRoll, which calls d100 inside its own file, where a stand-in doesn't reach).
//
// tests/lib/the-middle-of-a-bot-world-on-the-engines-modules.ts (aBotBoard) is the bots' board: no turn's context, a
// world made on each call, and its own types; this file is the turn's board the vm board's users move to.
import { vi } from 'vitest';
import type { TheGamesSlotRow } from '../../src/engine/turn/context.ts';
import { addTheFieldsResolveTurnAdds, type TurnContext } from './the-fields-resolve-turn-adds-to-the-turns-context.ts';

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

/** The engine's modules, fresh, with the dice seeded `seed`: lib/engine.ts's loadEngine({ seed }), on the modules. It
 *  holds what the board, the dice and the turn call; a test imports the rest after it (`await import(…)`). */
export async function loadTheEngineOnItsModules({ seed }: { seed: number }) {
  vi.resetModules();
  await import('./the-whole-engine.ts');
  const { kcRng } = await import('../../src/engine/rng.ts');
  const theDiceModule = await import('../../src/engine/dice-and-army-names.ts');
  const { KC_SEASONS } = await import('../../src/content/kingdoms-call-data.ts');
  const { generateBotSetups, isBotRow } = await import('../../src/engine/bots/setup.ts');
  const { generateNewGame } = await import('../../src/engine/world/generate.ts');
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const { createTurnContext } = await import('../../src/engine/turn/context.ts');
  const { resolveTurn } = await import('../../src/engine/run-turn.ts');
  const { theTurnsLinesInWords } = await import('../../src/views/prose/the-words-of-each-line.ts');
  kcRng.seed(seed);
  return {
    /** The console the modules log to (emit echoes each line of the GM's log there): this process's, as the vm's was. */
    console,
    kcRng,
    theDiceModule,
    KC_SEASONS,
    generateBotSetups,
    isBotRow,
    generateNewGame,
    getNeighborsP,
    createTurnContext,
    resolveTurn,
    theTurnsLinesInWords,
  };
}
export type TheEngineOnItsModules = Awaited<ReturnType<typeof loadTheEngineOnItsModules>>;

/** A new world of bot realms, made by the engine itself, as JSON: lib/engine.ts's botWorld, on the modules. `realms`
 *  bot setups (generateBotSetups), on a map of `size`, with the world options `opts` (e.g. `{ seaPct: 45 }`). */
export function botWorld(
  engine: TheEngineOnItsModules,
  realms: number,
  size: { cols: number; rows: number },
  opts: Record<string, unknown> = {},
): string {
  const setup = engine
    .generateBotSetups([], realms, 0)
    .map((b) => ({ ...b, gamePlayerId: 'gp' + String(b.id), name: b.kingdomName }));
  const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  return JSON.stringify(engine.generateNewGame(setup, copy(size), 999, copy(opts)));
}

/** Quiets the engine's console.log (emit echoes each line of the GM's log there) until the returned function is
 *  called: lib/engine.ts's quietEngineLog. */
export function quietEngineLog(engine: TheEngineOnItsModules): () => void {
  const was = engine.console.log;
  engine.console.log = () => undefined;
  return () => {
    engine.console.log = was;
  };
}

/** Runs `body` with the dice the engine draws pinned, in turn, to `dice` (each in [0, 1)); once they run out, the
 *  last one repeats. */
export function withDice<T>(engine: TheEngineOnItsModules, dice: number[], body: () => T): T {
  let i = 0;
  const was = engine.kcRng.use(() => must(dice[Math.min(i++, dice.length - 1)], 'a die'));
  try {
    return body();
  } finally {
    engine.kcRng.use(was);
  }
}

/** Runs `body` with the first die the engine draws pinned to `first`, the rest from the dice as they were. */
export function firstDie<T>(engine: TheEngineOnItsModules, first: number, body: () => T): T {
  let pinned = true;
  const was = engine.kcRng.use(() => {
    if (!pinned) return was();
    pinned = false;
    return first;
  });
  try {
    return body();
  } finally {
    engine.kcRng.use(was);
  }
}

/** Runs `body` with every percentile roll the engine makes (d100) fixed at `roll`, 1 to 100 (plan P1-08j6). Over a
 *  whole turn, with `withDice` fixing every other die, an order's rolls are certain however many dice the turn draws
 *  before them. d100 is stood in on its module, for its calls from other files; pctRoll, which calls it inside that
 *  file, is stood in too, playing as it is on dice of its own that make its d100 roll `roll` and draw nothing from the
 *  turn's: the vm's withRolls replaced the one global d100 every call reached, and drew no die. */
export function withRolls<T>(engine: TheEngineOnItsModules, roll: number, body: () => T): T {
  const dice = engine.theDiceModule;
  const pctRoll = dice.pctRoll;
  const theD100 = vi.spyOn(dice, 'd100').mockImplementation(() => roll);
  const thePctRoll = vi.spyOn(dice, 'pctRoll').mockImplementation((chance) => {
    // d100 is ⌊die × 100⌋ + 1: this die makes it `roll`
    const was = engine.kcRng.use(() => (roll - 0.5) / 100);
    try {
      return pctRoll(chance);
    } finally {
      engine.kcRng.use(was);
    }
  });
  try {
    return body();
  } finally {
    thePctRoll.mockRestore();
    theD100.mockRestore();
  }
}

/** A fresh board on `world` (JSON from botWorld) in phase `ph`. */
export function board(engine: TheEngineOnItsModules, world: string, ph: number) {
  const getNeighborsP = engine.getNeighborsP as unknown as (
    p: Province,
    cols: number,
    rows: number,
    ps: Province[],
  ) => Province[];
  // lib/engine.ts's turnContext: the context made on the state parsed, no fresh players, turn 1
  const tc = addTheFieldsResolveTurnAdds(engine.createTurnContext(JSON.parse(world), [], 1), engine);
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
  const inWords = engine.theTurnsLinesInWords as unknown as (log: unknown) => { gmLog: Line[] };
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
/** Plays one whole turn (resolveTurn) from the board as staged: every realm human-held, each hero given orders here
 *  doing them, every other hero Resting, safe start over. The turn works out its own move points; the board's context
 *  isn't used. `written` adds orders a realm sends under a key of its own (the orders written for a hero it means to
 *  hire, `hired_<hero>_via_<hirer>_ph<phase>`), by realm. The realms in `bots` are bot realms (a slot row with no player
 *  and `isBot` in its report), which plan their own orders in the turn. `sends` gives what a realm sends with its
 *  orders beside them (its declarations toward other realms, a call for the Reckoning, a concession), by realm; by
 *  default nothing. No seed is given: the turn draws from the engine's dice, as the vm board's did. */
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
  // (the rows as the test stages them, a copy as the vm's was parsed there)
  const slotRows = JSON.parse(JSON.stringify(rows)) as TheGamesSlotRow[];
  const resolved = b.engine.resolveTurn(JSON.stringify(G), slotRows, G.turn);
  const inWords = b.engine.theTurnsLinesInWords as unknown as (log: unknown) => { gmLog: Line[] };
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
