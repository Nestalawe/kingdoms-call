// A small stage for tests of the turn's helpers lifted out of resolveTurn (plan P1-08i3): the middle of a bot world
// made by the engine, cleared, with heroes stood on it one by one. Each board is a fresh turn's context
// (tests/lib/engine.ts) in one phase: the province at row 4, column 5 (X), its six neighbours (ring1) and theirs
// (ring2) are open plain, unowned, with no garrison, guard or lair; nobody stands anywhere and nobody has orders.
// Realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace. playTurn (plan P1-08j1) plays a whole turn from a board
// as staged, for a scenario test (level 2) of an order. Its types, `hero`, `playTurn` and the members a case reaches
// the engine through are tests/lib/the-board-a-case-is-staged-on-either-way.ts's, which the case files import instead.
import vm from 'node:vm';
import { engineFn, turnContext } from './engine.ts';
import {
  must,
  type AFunctionOfTheEngines,
  type AFunctionOrTableOfTheEngines,
  type Board as TheBoardACaseIsStagedOn,
  type Dice,
  type ExperienceRoll,
  type Line,
  type Order,
  type Province,
  type World,
} from './the-board-a-case-is-staged-on-either-way.ts';

// The shared types and the functions that go through the board a case is handed: one home, both boards
// (tests/lib/the-board-a-case-is-staged-on-either-way.ts).
export {
  allText,
  hero,
  linesOf,
  must,
  order,
  plan,
  playTurn,
  points,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
  type PlayedTurn,
  type Province,
  type RealmSends,
  type TurnContext,
  type Unit,
  type World,
} from './the-board-a-case-is-staged-on-either-way.ts';

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
  // What the board gives a case that reaches its engine (the-board-a-case-is-staged-on-either-way.ts): the vm's own
  // names, and its realm's JSON, Sets and Maps.
  const inTheVm = (code: string): unknown => vm.runInContext(code, engine);
  const reach = {
    withDice: <T>(dice: number[], body: () => T): T => withDice(engine, dice, body),
    firstDie: <T>(first: number, body: () => T): T => firstDie(engine, first, body),
    withRolls: <T>(roll: number, body: () => T): T => withRolls(engine, roll, body),
    theEnginesFunctionOrTable: (name: AFunctionOrTableOfTheEngines): unknown => inTheVm(name),
    standInForTheEnginesFunction: (
      name: AFunctionOrTableOfTheEngines,
      insteadOf: (was: AFunctionOfTheEngines) => (...args: never[]) => unknown,
    ) => {
      const was = engine[name] as AFunctionOfTheEngines;
      engine[name] = insteadOf(was);
      return () => {
        engine[name] = was;
      };
    },
    parsedInTheEnginesRealm: (json: string): unknown => (inTheVm('(j)=>JSON.parse(j)') as (j: string) => unknown)(json),
    aSetMadeInTheEnginesRealm: (json: string): unknown =>
      (inTheVm('(a)=>new Set(JSON.parse(a))') as (a: string) => unknown)(json),
    aMapMadeInTheEnginesRealm: (json: string): unknown =>
      (inTheVm('(a)=>new Map(JSON.parse(a))') as (a: string) => unknown)(json),
  };
  const b = { engine, tc, G, ph, X, ring1, ring2, near, nbrs, own, lines, ...reach };
  return b satisfies TheBoardACaseIsStagedOn;
}
export type Board = ReturnType<typeof board>;

// ── What the tests that call the engine themselves hand the vm, until they leave it ─────────────────────────────────
/** Runs `body` with the case's dice, if it fixes them (the-board-a-case-is-staged-on-either-way.ts' withCaseDice, on
 *  the vm `engine` itself). */
export const withCaseDice = <T>(engine: vm.Context, dice: Dice | undefined, body: () => T): T =>
  dice ? withDice(engine, [dice.die], () => withRolls(engine, dice.roll, body)) : body();

/** Records every experience roll the engine starts, by wrapping the top-level trySkillGain (plan P1-08c), into the
 *  list `recordExperienceRolls` hands back for the length of `body`. Wrap once per engine. */
export const recordExperienceRolls = (engine: vm.Context) => {
  vm.runInContext(
    `{ const tryOne=trySkillGain;
       trySkillGain=function(turnContext, char, skill, base){
         if(globalThis.__xp) globalThis.__xp.push({id:char&&char.id,skill,base});
         return tryOne.apply(this, arguments); }; }`,
    engine,
  );
  return <T>(body: () => T): { result: T; xp: ExperienceRoll[] } => {
    const xp: ExperienceRoll[] = [];
    engine['__xp'] = xp;
    try {
      return { result: body(), xp };
    } finally {
      engine['__xp'] = undefined;
    }
  };
};

/** Writes the orders `writes` gives (by hero) into the turn after the bots have planned theirs, by wrapping the
 *  top-level runBotOrderHygiene (the bots' last pass) in the vm, for the length of a body. Wrap once per engine. */
export const asTheBotsPlan = (engine: vm.Context) => {
  vm.runInContext(
    `{ const lastPass=runBotOrderHygiene;
       runBotOrderHygiene=function(G, botIdxSet){
         const r=lastPass.apply(this, arguments); const w=globalThis.__botWrites;
         if(w) Object.keys(w).forEach(id=>{ G.turnOrders[id]=JSON.parse(JSON.stringify(w[id])); });
         return r; }; }`,
    engine,
  );
  return <T>(writes: Record<number, Order[]> | undefined, body: () => T): T => {
    engine['__botWrites'] = writes;
    try {
      return body();
    } finally {
      engine['__botWrites'] = undefined;
    }
  };
};
