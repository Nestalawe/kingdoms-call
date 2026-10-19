// The bots' plan (plan P1-08l2, lifted out of resolveTurn): once a turn, before the first phase (after the move pools,
// the turn's trackers and the save's sweeps, and before every empty phase is set to Defend), the bot realms decide
// their turn in eight passes, in this order: a bot with no province left concedes; movement, handed the duel forecast
// for its hunters and each company's strength on each terrain; the muster; the economy; the idle heroes' actions; the
// Spring orders; the order hygiene; and a dominant bot king's call of the Reckoning, added to the realms' calls. Each
// pass is a top-level function of src/engine/bots/ (or titles/reckoning.js), not part of what moved: what moved is the
// calls, in order, with what each is handed, and the duel forecast (copies of the hunter and his quarry fight `n`
// times, 20 by default, with no skill rising, for the share won and the share in which the hunter fell).
// Staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), as P1-08k8's cases are: plain realms each
// holding only its seat with a living king there, every realm having met every other, realms 0 and 1 at war, 0 and 2
// allied, Safe Start over, each realm a player's but those the case makes bots'.
// scenario/the-bots-plan-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/the-bots-plan-called-directly.test.ts calls the plan once, on a context readied as resolveTurn readies it. Each
// pass is wrapped in the vm for the turn's length by a recorder that still calls it (or, where a case says so, stands
// it in), so a case reads the order of the passes and what each was handed; the movement pass's recorder also asks the
// forecast it is handed about the heroes a case names, as a hunter would. Every outcome is certain: every case fixes
// the dice for the whole turn (LANDS: every percentile roll lands, every other die at its highest).
import vm from 'node:vm';
import { engineFn } from './engine.ts';
import { must, type Board, type Character, type Line, type World } from './middle-of-a-bot-world.ts';
import { withCaseDice } from './espionage-order-cases.ts';
import { at } from './cast-spell-order-cases.ts';
import { seatOf, taxes, turnIs } from './diplomacy-and-victory-cases.ts';
import { BOT_DIPLOMACY } from './bot-diplomacy-cases.ts';
import {
  LANDS,
  STAGES,
  creed,
  kingOf,
  prepare,
  realm,
  rows,
  stageCase as stageBeforeCase,
  type BeforeCase,
  type Staged as BeforeStaged,
} from './before-the-first-phase-cases.ts';

export { LANDS, creed, kingOf, realm, seatOf, taxes, turnIs };
type Raw = Record<string, unknown>;
type Fn = (...a: unknown[]) => unknown;

/** The eight passes, in the order the plan calls them (runBotPhaseOne twice: the muster, then the Spring orders). */
export const PASSES = [
  'runBotConcessions',
  'runBotMovement',
  'runBotPhaseOne',
  'runBotEconomy',
  'runBotActions',
  'runBotOrderHygiene',
  'runBotReckoning',
] as const;
export type Pass = (typeof PASSES)[number];
export const PLAN_ORDER: Pass[] = [
  'runBotConcessions',
  'runBotMovement',
  'runBotPhaseOne',
  'runBotEconomy',
  'runBotActions',
  'runBotPhaseOne',
  'runBotOrderHygiene',
  'runBotReckoning',
];
/** The plan and the forecast, as P1-08l2 named them. */
export const PLAN = 'botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning';
export const FORECAST = 'botHuntersDuelForecastFoughtOnCopiesOfBothHeroes';

/** A forecast the movement pass's recorder asks for: of `hunter` against `quarry`, `n` fights (none: not given),
 *  with experience already muted when it is asked (`muted`), and every fight of it failing (`fails`). */
export interface Ask {
  hunter: Character;
  quarry: Character;
  n?: number;
  muted?: boolean;
  fails?: boolean;
}
export interface Staged extends BeforeStaged {
  /** The realms that are bots' (a slot row with no player and `isBot` in its report). */
  bots: number[];
  /** Forecasts the movement pass's recorder asks for, before the pass runs. */
  asks?: Ask[];
  /** Passes stood in for the turn's length (not called through), by a function handed what the pass was. */
  standIn?: Partial<Record<Pass, (...a: unknown[]) => unknown>>;
}
/** One call of a pass, as recorded: what it was handed. */
export interface PassCall {
  fn: Pass;
  /** Whether it was handed the turn's own world (the context's `G`). */
  world: boolean;
  /** The bot realms it was handed, in order; and whether they were the context's own set. */
  bots: number[];
  botsShared: boolean;
  /** What it was handed third: 'the log' (the context's), 'the calls' (the context's Reckoning calls), 'hooks' (the
   *  movement pass's: see `hooks`), a word, or 'nothing'. */
  third: unknown;
  /** How many things it was handed. */
  count: number;
}
/** One fight of a forecast, as recorded: whether experience was muted then, whether it was handed the turn's context,
 *  the two fighters (their ids and tactics) and the fight's options. */
export interface Fight {
  muted: boolean;
  context: boolean;
  a: { id: unknown; tactics: unknown };
  b: { id: unknown; tactics: unknown };
  opts: unknown;
}
export interface Asked {
  /** What the forecast gave. */
  result: unknown;
  /** Whether the hunter and his quarry were as they were after it, as JSON. */
  unchanged: boolean;
  /** Lines written while it ran. */
  lines: number;
  fights: Fight[];
  /** Whether experience was muted once it had run. */
  mutedAfter: boolean;
}
export interface Outcome {
  /** Every call of a pass, in order. */
  passes: PassCall[];
  /** The movement pass's hooks: their names, and whether the forecast and the strength figure are functions. */
  hooks: { keys: string[]; forecast: boolean; strength: boolean };
  /** The strength figure the movement pass is handed, read for every company type on every terrain against the
   *  engine's own (terrainMod × seaPenalty): how many pairs, those that differ, and how many pairs each part bites. */
  strength: { pairs: number; wrong: unknown[]; terrainBites: number; seaBites: number };
  /** The forecasts the case asked for. */
  asked: Asked[];
  /** The heroes' orders once the bots have planned (whole turn: as the default to Defend begins), by hero id. */
  orders: Record<string, unknown[]>;
  /** The realms' Reckoning calls as victory reads them (called directly: after the plan). */
  calls: number[];
  /** Each realm's concession then. */
  conceded: boolean[];
  /** Every line of the log (the whole turn's, or the plan's). */
  all: Line[];
  /** The world after the turn (or after the call). */
  world: World;
  whole: boolean;
}
export interface BotsPlanCase {
  name: string;
  /** Plays only in a whole turn (what it reads is told after the phases). */
  wholeTurnOnly?: boolean;
  stage(b: Board): Staged;
  /** What the case found, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

// ── Recording ────────────────────────────────────────────────────────────────────────────────────────────────────
const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v ?? null));
interface Recorder {
  tc: Raw | null;
  passes: PassCall[];
  hooks: Outcome['hooks'];
  strength: Outcome['strength'];
  asked: Asked[];
}
const recorder = (): Recorder => ({
  tc: null,
  passes: [],
  hooks: { keys: [], forecast: false, strength: false },
  strength: { pairs: 0, wrong: [], terrainBites: 0, seaBites: 0 },
  asked: [],
});
const third = (r: Recorder, v: unknown): unknown => {
  const tc = must(r.tc, 'the context');
  if (v === undefined) return 'nothing';
  if (v === tc['log']) return 'the log';
  if (v === tc['reckoningCalls']) return 'the calls';
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'duelSim' in v) return 'hooks';
  return Object.prototype.toString.call(v);
};
/** The strength figure `f` read on every company type and terrain, against the engine's own. */
const strengthOf = (engine: vm.Context, f: (t: string, tr: string) => number): Outcome['strength'] => {
  const { types, terrains } = vm.runInContext(
    `({ types:[...new Set([].concat(...Object.values(TERRAIN_MODS).map(Object.keys), [...SEA_TYPES], [...AERIAL_TYPES], ['Men-at-Arms']))],
        terrains:[...new Set([...Object.keys(TERRAIN_MODS), 'sea', 'plains'])] })`,
    engine,
  ) as { types: string[]; terrains: string[] };
  const terrainMod = engineFn(engine, 'terrainMod') as (t: string, tr: string) => number;
  const seaPenalty = engineFn(engine, 'seaPenalty') as (t: string, tr: string) => number;
  const out: Outcome['strength'] = { pairs: 0, wrong: [], terrainBites: 0, seaBites: 0 };
  for (const t of types)
    for (const tr of terrains) {
      out.pairs++;
      const m = terrainMod(t, tr),
        p = seaPenalty(t, tr);
      if (m !== 1 && p === 1) out.terrainBites++;
      if (p !== 1) out.seaBites++;
      const got = f(t, tr);
      if (got !== m * p) out.wrong.push([t, tr, got, m * p]);
    }
  return out;
};
/** Asks the forecast `sim` (as the movement pass is handed it) what the case's asks name, on the world `G`. */
const ask = (engine: vm.Context, r: Recorder, G: World, sim: Fn, asks: Ask[]) => {
  const g = engine;
  const tc = must(r.tc, 'the context');
  for (const a of asks) {
    const find = (c: Character) =>
      must(
        G.characters.find((x) => x.id === c.id),
        'hero ' + String(c.id),
      );
    const h = find(a.hunter),
      q = find(a.quarry);
    const before = JSON.stringify([h, q]);
    const lines = (tc['turnLog'] as unknown[]).length;
    const fights: Fight[] = [];
    const was = g['resolvePersonalCombat'] as Fn;
    g['resolvePersonalCombat'] = (t: Raw, A: Raw, B: Raw, opts: unknown) => {
      fights.push({
        muted: t['_pcSimulating'] === true,
        context: t === tc,
        a: { id: (A['ref'] as Raw)['id'], tactics: json(A['tactics']) },
        b: { id: (B['ref'] as Raw)['id'], tactics: json(B['tactics']) },
        opts: json(opts),
      });
      if (a.fails) throw new Error('a fight that fails');
      return was(t, A, B, opts);
    };
    const mutedWas = tc['_pcSimulating'];
    if (a.muted) tc['_pcSimulating'] = true;
    let result: unknown;
    try {
      result = json(a.n === undefined ? sim(h, q) : sim(h, q, a.n));
    } finally {
      g['resolvePersonalCombat'] = was;
    }
    const mutedAfter = tc['_pcSimulating'] === true;
    tc['_pcSimulating'] = mutedWas;
    r.asked.push({
      result,
      unchanged: JSON.stringify([h, q]) === before,
      lines: (tc['turnLog'] as unknown[]).length - lines,
      fights,
      mutedAfter,
    });
  }
};
/** Wraps each pass in the vm for the length of `body`: each call recorded, then called through (or stood in). */
function recording<T>(engine: vm.Context, s: Staged, r: Recorder, body: () => T): T {
  const g = engine;
  const was = PASSES.map((f) => [f, g[f] as Fn] as const);
  for (const [f, w] of was)
    g[f] = (...args: unknown[]) => {
      const tc = must(r.tc, 'the context');
      r.passes.push({
        fn: f,
        world: args[0] === tc['G'],
        bots: [...((args[1] as Iterable<number> | null) ?? [])],
        botsShared: args[1] === tc['_botPlayerIdx'],
        third: third(r, args[2]),
        count: args.length,
      });
      if (f === 'runBotMovement') {
        const hooks = (args[2] ?? {}) as Raw;
        r.hooks = {
          keys: Object.keys(hooks),
          forecast: typeof hooks['duelSim'] === 'function',
          strength: typeof hooks['terrainMult'] === 'function',
        };
        if (typeof hooks['terrainMult'] === 'function')
          r.strength = strengthOf(engine, hooks['terrainMult'] as (t: string, tr: string) => number);
        if (s.asks?.length) ask(engine, r, args[0] as World, hooks['duelSim'] as Fn, s.asks);
      }
      const stood = s.standIn?.[f];
      return stood ? stood(...args) : w(...args);
    };
  try {
    return body();
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
}
const ordersOf = (G: World) => json((G as World & Raw)['turnOrders']) as Record<string, unknown[]>;
const concessions = (G: World) => G.players.map((p) => !!(p as Raw | null)?.['conceded']);

// ── Playing a case ───────────────────────────────────────────────────────────────────────────────────────────────
/** resolveTurn's stages either side of the plan (P1-08k8's third and fourth), and victory (P1-08k4's). */
const BEFORE = STAGES[2];
const AFTER = STAGES[3];
const VICTORY = 'victoryTheReckoningEliminationConcessionAndTheAnnouncement';
/** Plays `c`, staged as `s` on `b`, through a whole turn, with every die fixed (LANDS); the context is taken as the
 *  stage before the plan begins, the heroes' orders as the stage after it begins, and the Reckoning calls as victory
 *  begins (each wrapped in the vm for the turn's length). */
export const playCase = (b: Board, _c: BotsPlanCase, s: Staged): Outcome => {
  const g = b.engine;
  const was = [BEFORE, AFTER, VICTORY].map((f) => [f, g[f] as Fn] as const);
  const r = recorder();
  const seen: { orders?: Record<string, unknown[]>; calls?: number[]; conceded?: boolean[] } = {};
  const wrap = (f: string, before: (tc: Raw) => void) => {
    const w = must(
      was.find(([n]) => n === f),
      f,
    )[1];
    g[f] = (tc: Raw, ...rest: unknown[]) => {
      before(tc);
      return w(tc, ...rest);
    };
  };
  wrap(BEFORE, (tc) => {
    r.tc = tc;
  });
  wrap(AFTER, (tc) => {
    seen.orders = ordersOf(tc['G'] as World);
    seen.conceded = concessions(tc['G'] as World);
  });
  wrap(VICTORY, (tc) => {
    seen.calls = [...(tc['reckoningCalls'] as Iterable<number>)];
  });
  const resolveTurn = engineFn(b.engine, 'resolveTurn') as (
    state: string,
    rows: unknown,
    turn: number,
  ) => { state: string; log: Line[] };
  const inVm = vm.runInContext('(j)=>JSON.parse(j)', b.engine) as (j: string) => unknown;
  try {
    const slotRows = rows(b, s);
    const state = JSON.stringify(b.G);
    return recording(b.engine, s, r, () => {
      const t = withCaseDice(b.engine, LANDS, () => resolveTurn(state, inVm(slotRows), b.G.turn));
      return {
        passes: r.passes,
        hooks: r.hooks,
        strength: r.strength,
        asked: r.asked,
        orders: must(seen.orders, 'the orders after the plan'),
        calls: must(seen.calls, 'the calls at victory'),
        conceded: must(seen.conceded, 'the concessions after the plan'),
        all: t.log,
        world: JSON.parse(t.state) as World,
        whole: true,
      };
    });
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
};
/** Readies the context on `b`, staged as `s`, as resolveTurn has it when it calls the plan: P1-08k8's `prepare` (the
 *  merge run on the slot rows, a bot's seat with no player; the bot realms set, in seat order), each bot realm's
 *  rivals met as the turn began, then the stages before the plan in turn (the research choices, the bots'
 *  declarations, war without warning, the move pools). */
export const ready = (b: Board, s: Staged) => {
  // as the turn loads them: a bot's seat has no player (so the merge reads nothing from it), and the bots are counted
  // in seat order
  const bots = [...s.bots].sort((x, y) => x - y);
  const tc = prepare(b, {
    ...s,
    bots,
    slots: { ...s.slots, ...Object.fromEntries(bots.map((i) => [i, { ...s.slots?.[i], user: null }])) },
  });
  (
    vm.runInContext(
      `(tc)=>{ const m={}; tc._botPlayerIdx.forEach(idx=>{ m[idx]=[...(((tc.G.players||[])[idx]||{})._encountered||[])]; });
      tc._botEncounteredAtStart=m; }`,
      b.engine,
    ) as (t: Raw) => void
  )(tc);
  for (const f of [STAGES[0], BOT_DIPLOMACY, STAGES[1], STAGES[2]]) (engineFn(b.engine, f) as (t: Raw) => void)(tc);
  return tc;
};
/** Calls the plan once on `b`, staged as `s` and readied as `ready` readies it, with every die fixed. */
export const directCase = (b: Board, _c: BotsPlanCase, s: Staged): Outcome =>
  withCaseDice(b.engine, LANDS, () => {
    const tc = ready(b, s);
    const r = recorder();
    r.tc = tc;
    const lines = (tc['turnLog'] as unknown[]).length;
    return recording(b.engine, s, r, () => {
      (engineFn(b.engine, PLAN) as (t: Raw) => void)(tc);
      return {
        passes: r.passes,
        hooks: r.hooks,
        strength: r.strength,
        asked: r.asked,
        orders: ordersOf(b.G),
        calls: [...(tc['reckoningCalls'] as Iterable<number>)],
        conceded: concessions(b.G),
        all: (json(tc['turnLog']) as Line[]).slice(lines),
        world: json(b.G) as World,
        whole: false,
      };
    });
  });

// ── Staging ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Stages `c` on `b` as P1-08k8's and P1-08l1's cases are (P1-08k8's `stageCase`). */
export const stageCase = (b: Board, c: BotsPlanCase): Staged => {
  let staged: Staged = { bots: [] };
  const asBefore: BeforeCase = {
    name: c.name,
    stage: (bb) => (staged = c.stage(bb)),
    check: () => ({ got: {}, want: {} }),
  };
  return { ...stageBeforeCase(b, asBefore), ...staged };
};
/** A hero of realm `pi` in its seat, of `skills`, Brave (he fights to the end), at `hp` (default 20). */
export const fighter = (b: Board, pi: number | null, skills: Record<string, number>, hp = 20) => {
  const h = at(b, { archery: 0, ...skills }, { player: pi, at: pi == null ? b.X : seatOf(b, pi), hp });
  h['temper'] = 'Brave';
  return h;
};
/** A champion: Melee 9, 60 HP, Brave. */
export const champion = (b: Board, pi: number | null) => fighter(b, pi, { melee: 9 }, 60);
/** A weakling: Melee 0, 1 HP, Brave. */
export const weakling = (b: Board, pi: number | null) => fighter(b, pi, { melee: 0 }, 1);

// ── Reading the outcome ──────────────────────────────────────────────────────────────────────────────────────────
/** The passes' names, in the order they were called. */
export const passOrder = (o: Outcome) => o.passes.map((p) => p.fn);
/** The lines whose text starts with `start`. */
export const starting = (o: Outcome, start: string) => o.all.filter((l) => l.text.startsWith(start)).map((l) => l.text);
/** The bot's concession line, as runBotConcessions writes it. */
export const concedes = (realmName: string) =>
  `\u{1F3F3} ${realmName} holds no province in all the world — the realm CONCEDES the game. Its heroes lay down their ambitions and will only defend what they have from here on.`;
/** The lines of `o` with exactly the text `text`. */
export const said = (o: Outcome, text: string) => o.all.filter((l) => l.text === text).length;
/** Realm `pi`'s name on `b`. */
export const nameOf = (b: Board, pi: number) => realm(b, pi).name;
/** The heroes of realm `pi` on `b` (by id), as staged. */
export const heroesOf = (b: Board, pi: number) => b.G.characters.filter((c) => c.alive && c.player === pi);
/** Whether every hero of realm `pi` has an order for each of the five phases once the bots have planned. */
export const planned = (o: Outcome, b: Board, pi: number) =>
  heroesOf(b, pi).map((c) => (o.orders[String(c.id)] ?? []).filter((x) => x != null).length);
/** A hero's orders once the bots have planned, as their actions. */
export const actionsOf = (o: Outcome, c: Character) =>
  (o.orders[String(c.id)] ?? []).map((x) => (x as Raw | null)?.['action'] ?? null);
/** The Reckoning called by realm `n` alone, commanding `share`% of the world, judged two turns on (P1-08k4's line). */
export const called = (n: string, share: number, bar: number, judgedAt: number) =>
  `👑 THE RECKONING IS CALLED. ${n} lay claim to the vacant Imperial throne, commanding ${String(share)}% of the world. The realms have TWO turns to contest it — drive ${n}'s bloc below ${String(bar)}% and the claim collapses. Otherwise the world is judged at the end of Turn ${String(judgedAt)}.`;
/** A hero's encounter plan of `tactics`. */
export const withPlan = (c: Character, tactics: unknown) => {
  c['encounterPlan'] = { tactics, notes: '' };
  return c;
};
const MIXED = ['PARLEY', 'ca:Fireball', 'ME', 'STEAL', 'fl', 'AR'];
const MIXED_COMBAT = ['ca:Fireball', 'ME', 'fl', 'AR'];
const ALL_ME = (n: number) => Array.from({ length: n }, () => 'ME');
const asked0 = (o: Outcome) => must(o.asked[0], 'a forecast asked');
const fight0 = (o: Outcome) => must(asked0(o).fights[0], 'a forecast fight');

// ── 1. The passes, in order, and the realms they plan for ────────────────────────────────────────────────────────
export const ORDER_CASES: BotsPlanCase[] = [
  {
    name: 'the bots plan in eight passes, in order: concessions, movement, the muster, the economy, actions, the Spring orders, hygiene, the Reckoning',
    stage: () => ({ bots: [1] }),
    check: (o) => ({ got: { order: passOrder(o) }, want: { order: PLAN_ORDER } }),
  },
  {
    name: 'every pass is handed the turn’s own world and the bot realms (the turn’s own set), for one bot',
    stage: () => ({ bots: [1] }),
    check: (o) => ({
      got: {
        world: o.passes.map((p) => p.world),
        bots: o.passes.map((p) => p.bots),
        shared: o.passes.map((p) => p.botsShared),
      },
      want: { world: PLAN_ORDER.map(() => true), bots: PLAN_ORDER.map(() => [1]), shared: PLAN_ORDER.map(() => true) },
    }),
  },
  {
    name: 'two bot realms are planned for together: every pass is handed both, in seat order',
    stage: () => ({ bots: [2, 1] }),
    check: (o) => ({ got: { bots: o.passes.map((p) => p.bots) }, want: { bots: PLAN_ORDER.map(() => [1, 2]) } }),
  },
  {
    name: 'with no bot realm every pass is still called, handed no realm',
    stage: () => ({ bots: [] }),
    check: (o) => ({
      got: { order: passOrder(o), bots: o.passes.map((p) => p.bots), shared: o.passes.map((p) => p.botsShared) },
      want: { order: PLAN_ORDER, bots: PLAN_ORDER.map(() => []), shared: PLAN_ORDER.map(() => true) },
    }),
  },
  {
    name: 'every realm a bot’s: every pass is handed all three',
    stage: () => ({ bots: [0, 1, 2] }),
    check: (o) => ({ got: { bots: o.passes.map((p) => p.bots) }, want: { bots: PLAN_ORDER.map(() => [0, 1, 2]) } }),
  },
  {
    name: 'what each pass is handed beside the world and the bots: the log, the hooks, “muster”, nothing, nothing, “order”, nothing, the realms’ calls',
    stage: () => ({ bots: [1] }),
    check: (o) => ({
      got: { third: o.passes.map((p) => p.third), count: o.passes.map((p) => p.count) },
      want: {
        third: ['the log', 'hooks', 'muster', 'nothing', 'nothing', 'order', 'nothing', 'the calls'],
        count: [3, 3, 3, 2, 2, 3, 2, 3],
      },
    }),
  },
];

// ── 2. The movement pass's hooks: the forecast and the strength figure ───────────────────────────────────────────
export const HOOK_CASES: BotsPlanCase[] = [
  {
    name: 'the movement pass is handed two hooks, the duel forecast and the strength figure, both functions',
    stage: () => ({ bots: [1] }),
    check: (o) => ({
      got: { hooks: o.hooks },
      want: { hooks: { keys: ['duelSim', 'terrainMult'], forecast: true, strength: true } },
    }),
  },
  {
    name: 'the strength figure is the engine’s own for every company type on every terrain: the terrain’s figure times the sea’s',
    stage: () => ({ bots: [1] }),
    check: (o) => ({
      got: {
        wrong: o.strength.wrong,
        many: o.strength.pairs > 100,
        terrain: o.strength.terrainBites > 0,
        sea: o.strength.seaBites > 0,
      },
      want: { wrong: [], many: true, terrain: true, sea: true },
    }),
  },
  {
    name: 'with no bot realm the movement pass is still handed both hooks',
    stage: () => ({ bots: [] }),
    check: (o) => ({
      got: { hooks: o.hooks, wrong: o.strength.wrong },
      want: { hooks: { keys: ['duelSim', 'terrainMult'], forecast: true, strength: true }, wrong: [] },
    }),
  },
];

// ── 3. The duel forecast, as the movement pass is handed it ──────────────────────────────────────────────────────
export const FORECAST_CASES: BotsPlanCase[] = [
  {
    name: 'a champion hunting a weakling wins every forecast fight and never falls',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: weakling(b, 0) }] }),
    check: (o) => ({ got: { result: asked0(o).result }, want: { result: { win: 1, felled: 0 } } }),
  },
  {
    name: 'a weakling hunting a champion loses every forecast fight and falls in each',
    stage: (b) => ({ bots: [1], asks: [{ hunter: weakling(b, 1), quarry: champion(b, 0) }] }),
    check: (o) => ({ got: { result: asked0(o).result }, want: { result: { win: 0, felled: 1 } } }),
  },
  {
    name: 'the forecast fights twenty times when not told how many',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: weakling(b, 0) }] }),
    check: (o) => ({ got: { fights: asked0(o).fights.length }, want: { fights: 20 } }),
  },
  {
    name: 'the forecast fights as many times as it is told (24, as a hunter asks)',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: weakling(b, 0), n: 24 }] }),
    check: (o) => ({
      got: { fights: asked0(o).fights.length, result: asked0(o).result },
      want: { fights: 24, result: { win: 1, felled: 0 } },
    }),
  },
  {
    name: 'told to fight no times, the forecast fights twenty',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: weakling(b, 0), n: 0 }] }),
    check: (o) => ({ got: { fights: asked0(o).fights.length }, want: { fights: 20 } }),
  },
  {
    name: 'three fights of a weakling against a champion: none won, three fallen, as shares of three',
    stage: (b) => ({ bots: [1], asks: [{ hunter: weakling(b, 1), quarry: champion(b, 0), n: 3 }] }),
    check: (o) => ({
      got: { fights: asked0(o).fights.length, result: asked0(o).result },
      want: { fights: 3, result: { win: 0, felled: 1 } },
    }),
  },
  {
    name: 'the forecast fights copies: the hunter and his quarry are just as they were after it, wounds, skills and all',
    stage: (b) => ({
      bots: [1],
      asks: [{ hunter: fighter(b, 1, { melee: 4 }, 12), quarry: fighter(b, 0, { melee: 4 }, 12), n: 6 }],
    }),
    check: (o) => ({
      got: { unchanged: asked0(o).unchanged, fights: asked0(o).fights.length },
      want: { unchanged: true, fights: 6 },
    }),
  },
  {
    name: 'the copies fight under ids of their own: the hunter as −1, his quarry as −2, in every fight',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: weakling(b, 0), n: 4 }] }),
    check: (o) => ({
      got: { ids: asked0(o).fights.map((f) => [f.a.id, f.b.id]) },
      want: {
        ids: [
          [-1, -2],
          [-1, -2],
          [-1, -2],
          [-1, -2],
        ],
      },
    }),
  },
  {
    name: 'no skill can rise in a forecast fight: experience is muted in every one, and back on afterwards',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: weakling(b, 0), n: 3 }] }),
    check: (o) => ({
      got: { muted: asked0(o).fights.map((f) => f.muted), after: asked0(o).mutedAfter },
      want: { muted: [true, true, true], after: false },
    }),
  },
  {
    name: 'a forecast asked while experience is already muted leaves it muted',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: weakling(b, 0), n: 2, muted: true }] }),
    check: (o) => ({
      got: { muted: asked0(o).fights.map((f) => f.muted), after: asked0(o).mutedAfter },
      want: { muted: [true, true], after: true },
    }),
  },
  {
    name: 'a forecast writes no line in the log',
    stage: (b) => ({
      bots: [1],
      asks: [
        { hunter: champion(b, 1), quarry: weakling(b, 0) },
        { hunter: weakling(b, 1), quarry: champion(b, 0) },
      ],
    }),
    check: (o) => ({ got: { lines: o.asked.map((a) => a.lines) }, want: { lines: [0, 0] } }),
  },
  {
    name: 'every fight is fought with the turn’s context, to twenty rounds at most',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: weakling(b, 0), n: 2 }] }),
    check: (o) => ({
      got: { context: asked0(o).fights.map((f) => f.context), opts: asked0(o).fights.map((f) => f.opts) },
      want: { context: [true, true], opts: [{ maxRounds: 20 }, { maxRounds: 20 }] },
    }),
  },
  {
    name: 'a forecast whose fight fails gives no forecast, and experience is back on',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: weakling(b, 0), fails: true }] }),
    check: (o) => ({
      got: {
        result: asked0(o).result,
        fights: asked0(o).fights.length,
        after: asked0(o).mutedAfter,
        unchanged: asked0(o).unchanged,
      },
      want: { result: null, fights: 1, after: false, unchanged: true },
    }),
  },
  {
    name: 'a forecast that fails while experience is already muted leaves it muted',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: weakling(b, 0), fails: true, muted: true }] }),
    check: (o) => ({
      got: { result: asked0(o).result, after: asked0(o).mutedAfter },
      want: { result: null, after: true },
    }),
  },
  {
    name: 'the hunter fights to the engine’s own plan, not the one he carries; only the combat tactics of it',
    stage: (b) => ({
      bots: [1],
      asks: [{ hunter: withPlan(champion(b, 1), ['AR', 'AR', 'AR']), quarry: weakling(b, 0), n: 1 }],
    }),
    check: (o) => ({ got: { a: fight0(o).a.tactics }, want: { a: ALL_ME(6) } }),
  },
  {
    name: 'a quarry with a plan of his own fights to it, only its combat tactics (a spell, a flight, whatever their case)',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: withPlan(weakling(b, 0), MIXED), n: 1 }] }),
    check: (o) => ({ got: { b: fight0(o).b.tactics }, want: { b: MIXED_COMBAT } }),
  },
  {
    name: 'a quarry whose plan holds no combat tactic fights to the plain melee',
    stage: (b) => ({
      bots: [1],
      asks: [{ hunter: champion(b, 1), quarry: withPlan(weakling(b, 0), ['PARLEY', 'STEAL']), n: 1 }],
    }),
    check: (o) => ({ got: { b: fight0(o).b.tactics }, want: { b: ['ME'] } }),
  },
  {
    name: 'a quarry whose plan is empty fights to the engine’s own plan',
    stage: (b) => ({
      bots: [1],
      asks: [{ hunter: champion(b, 1), quarry: withPlan(fighter(b, 0, { melee: 4 }), []), n: 1 }],
    }),
    check: (o) => ({ got: { b: fight0(o).b.tactics }, want: { b: ALL_ME(6) } }),
  },
  {
    name: 'a quarry whose plan’s tactics are not a list fights to the engine’s own plan',
    stage: (b) => ({
      bots: [1],
      asks: [{ hunter: champion(b, 1), quarry: withPlan(fighter(b, 0, { melee: 4 }), 'ME'), n: 1 }],
    }),
    check: (o) => ({ got: { b: fight0(o).b.tactics }, want: { b: ALL_ME(6) } }),
  },
  {
    name: 'the forecast leaves the quarry’s own plan as it was',
    stage: (b) => ({ bots: [1], asks: [{ hunter: champion(b, 1), quarry: withPlan(weakling(b, 0), MIXED), n: 2 }] }),
    check: (o) => ({ got: { unchanged: asked0(o).unchanged }, want: { unchanged: true } }),
  },
];

// ── 4. What the passes do, in game terms ─────────────────────────────────────────────────────────────────────────
export const OUTCOME_CASES: BotsPlanCase[] = [
  {
    name: 'a bot realm with no province left concedes before it plans, told to every realm',
    stage: (b) => {
      realm(b, 1)['provinces'] = [];
      seatOf(b, 1).owner = null;
      return { bots: [1], board: b };
    },
    check: (o, s) => ({
      got: { conceded: o.conceded, told: said(o, concedes(nameOf(must(s.board, 'board'), 1))) },
      want: { conceded: [false, true, false], told: 1 },
    }),
  },
  {
    name: 'a human realm with no province left is not conceded by the bots’ plan',
    stage: (b) => {
      realm(b, 0)['provinces'] = [];
      seatOf(b, 0).owner = null;
      return { bots: [1], board: b };
    },
    check: (o, s) => ({
      got: { conceded: o.conceded, told: said(o, concedes(nameOf(must(s.board, 'board'), 0))) },
      want: { conceded: [false, false, false], told: 0 },
    }),
  },
  {
    name: 'a bot realm that still holds its seat does not concede',
    stage: () => ({ bots: [1, 2] }),
    check: (o) => ({
      got: { conceded: o.conceded, told: o.all.filter((l) => l.text.includes('CONCEDES the game')).length },
      want: { conceded: [false, false, false], told: 0 },
    }),
  },
  {
    name: 'a bot realm’s heroes have an order for every phase once the bots have planned',
    stage: (b) => {
      fighter(b, 1, { melee: 3 });
      return { bots: [1], board: b };
    },
    check: (o, s) => {
      const b = must(s.board, 'board');
      return { got: { planned: planned(o, b, 1) }, want: { planned: heroesOf(b, 1).map(() => 5) } };
    },
  },
  {
    name: 'a human realm’s heroes keep the orders it sent (Resting), whatever the bots plan',
    stage: (b) => ({ bots: [1, 2], board: b }),
    check: (o, s) => {
      const b = must(s.board, 'board');
      return {
        got: { actions: heroesOf(b, 0).map((c) => actionsOf(o, c)) },
        want: { actions: heroesOf(b, 0).map(() => ['rest', 'rest', 'rest', 'rest', 'rest']) },
      };
    },
  },
  {
    name: 'a human realm’s hero sent no orders is left for the default to Defend, not planned as a bot’s',
    stage: (b) => {
      const c = fighter(b, 0, { melee: 3 });
      return { bots: [1, 2], orders: [[c, []]], hero: c };
    },
    check: (o, s) => ({
      got: { actions: actionsOf(o, must(s.hero, 'the hero')) },
      want: { actions: [] },
    }),
  },
  {
    name: 'a bot realm that concedes writes no orders: its heroes are left for the default to Defend',
    stage: (b) => {
      realm(b, 1)['provinces'] = [];
      seatOf(b, 1).owner = null;
      return { bots: [1], board: b };
    },
    check: (o, s) => {
      const b = must(s.board, 'board');
      return { got: { planned: planned(o, b, 1) }, want: { planned: heroesOf(b, 1).map(() => 0) } };
    },
  },
  {
    name: 'on turn 10 a bot king whose realm holds the bar alone calls the Reckoning: the call is counted, the claim told',
    stage: (b) => {
      turnIs(b, 10);
      taxes(b, 20, 60, 20);
      return { bots: [1], board: b };
    },
    check: (o, s) => ({
      got: { calls: o.calls, told: said(o, called(nameOf(must(s.board, 'board'), 1), 60, 50, 12)) },
      want: { calls: [1], told: o.whole ? 1 : 0 },
    }),
  },
  {
    name: 'before turn 10 the same bot king makes no call',
    stage: (b) => {
      turnIs(b, 9);
      taxes(b, 20, 60, 20);
      return { bots: [1] };
    },
    check: (o) => ({ got: { calls: o.calls }, want: { calls: [] } }),
  },
  {
    name: 'a bot king’s call joins the human realms’ calls in the one list victory reads',
    stage: (b) => {
      turnIs(b, 10);
      taxes(b, 20, 60, 20);
      return { bots: [1], sends: { 0: { callReckoning: true } } };
    },
    check: (o) => ({ got: { calls: [...o.calls].sort() }, want: { calls: [0, 1] } }),
  },
];

// ── 5. The merge's collectors, made by the merge, read by the stages after it ─────────────────────────────────────
export const COLLECTOR_CASES: BotsPlanCase[] = [
  {
    name: 'a realm’s war declaration, collected by the merge, is made at the turn’s end',
    wholeTurnOnly: true,
    stage: () => ({ bots: [], sends: { 1: { diplomacy: { 2: 'enemy' } } } }),
    check: (o) => ({ got: { relation: o.world.relations['1-2'] ?? 'neutral' }, want: { relation: 'enemy' } }),
  },
  {
    name: 'a realm’s declaration under Safe Start, set aside by the merge, is told to the realm',
    wholeTurnOnly: true,
    stage: (b) => {
      (b.G as World & Raw)['safeStart'] = true;
      turnIs(b, 2);
      return { bots: [], sends: { 1: { diplomacy: { 2: 'enemy' } } } };
    },
    check: (o) => ({
      got: { told: o.all.filter((l) => l.text.startsWith('🕊 Safe Start: no Treat')).map((l) => l.targets) },
      want: { told: [[1]] },
    }),
  },
  {
    name: 'orders sent for another turn, refused by the merge, are told to the GM',
    wholeTurnOnly: true,
    stage: (b) => ({ bots: [], sends: { 1: { forTurn: b.G.turn + 1 } }, board: b }),
    check: (o, s) => {
      const b = must(s.board, 'board');
      return {
        got: {
          told: said(
            o,
            `⚠ Ignoring stale orders from ${nameOf(b, 1)} — submitted for Turn ${String(b.G.turn + 1)}, not Turn ${String(b.G.turn)}.`,
          ),
        },
        want: { told: 1 },
      };
    },
  },
  {
    name: 'a realm’s message, collected by the merge, is delivered',
    wholeTurnOnly: true,
    stage: (b) => ({ bots: [], sends: { 1: { messages: [{ to: [2], text: 'Meet at the ford.' }] } }, board: b }),
    check: (o, s) => ({
      got: {
        told: o.all
          .filter((l) => l.text === `📨 Dispatch from ${nameOf(must(s.board, 'board'), 1)}: “Meet at the ford.”`)
          .map((l) => l.targets),
      },
      want: { told: [[2]] },
    }),
  },
  {
    name: 'a king’s call of the Reckoning, collected by the merge, is judged at victory',
    wholeTurnOnly: true,
    stage: (b) => {
      turnIs(b, 10);
      taxes(b, 60, 20, 20);
      return { bots: [], sends: { 0: { callReckoning: true } }, board: b };
    },
    check: (o, s) => ({
      got: {
        calls: o.calls,
        told: o.all.filter((l) => l.text.startsWith('👑 THE RECKONING IS CALLED. ' + nameOf(must(s.board, 'board'), 0)))
          .length,
      },
      want: { calls: [0], told: 1 },
    }),
  },
];

export const BOTS_PLAN_CASES: [string, BotsPlanCase[]][] = [
  ['the passes, in order', ORDER_CASES],
  ['the movement pass’s hooks', HOOK_CASES],
  ['the duel forecast', FORECAST_CASES],
  ['what the passes do', OUTCOME_CASES],
  ['the merge’s collectors', COLLECTOR_CASES],
];
