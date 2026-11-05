// The bots' plan and their duel forecast (plan P1-08l2: src/engine/bots/, lifted out of resolveTurn), called directly
// in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/the-bots-plan-in-a-whole-turn plays through a whole turn (lib/the-bots-plan-cases.ts), here played through
// the plan alone, once, on a context readied as resolveTurn readies it; then where resolveTurn calls the plan; then,
// with the passes stood in (each replaced in the vm by a recorder for the test's length), what the plan hands them and
// what its two hooks do; then the forecast called directly, with the three helpers it fights with stood in, for what
// it hands them and how it counts. Properties (fast-check): the forecast leaves any two heroes as they were, writes no
// line, gives experience back as it found it, and gives two shares of its fights, never more than all of them
// together; for any bot realms, every pass is handed exactly those, in the plan's order.
// Level 1: two functions, called with the context resolveTurn hands them.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The bots' plan and their duel forecast (P1-08l2), called directly with the context `resolveTurn` hands them: the
// whole-turn cases through the plan alone (but those about the merge's collectors); `resolveTurn` calling the plan once
// with its context, after the move pools and before the default to Defend, the forecast fought only by the movement
// pass; with the passes stood in by recorders in the `vm`, the order whatever a pass does, the turn's context and the
// realms' calls themselves (a line and a call written to them are the turn's), the forecast handed being the top-level
// one with the context first, the strength figure asking the terrain and sea figures each time and multiplying them, no
// line or return of its own; the forecast with its three helpers stood in: the shares won and fallen (a fall only at no
// HP and without a win), twenty fights by default and for none, the two shares only, the order of the calls in each
// fight, the copies' ids, plans (automatic, no lessons kept), a quarry's own plan kept, the tactics filtered (any case,
// a spell named, the plain melee for none, every tactic the combat knows), deep copies; experience muted and given back
// (off or on), a failure in any helper or a hero who can't be copied giving no forecast; a real forecast on the board.
// Properties (fast-check): a forecast leaves any two heroes as they were, writes no line, gives experience back and
// gives two shares of its fights, never more than all; for any bot realms every pass is handed exactly those, in the
// plan's order. Planted faults: in the PR (P1-08l2). Then the Spring orders pass (`runBotPhaseOne`) called directly: a
// bot host in contact ranks Harvest the Field and Perform Rite, by the order's key, ahead of slower orders (P1-21f).
// Then the intel and the setup on what no matrix game hands them (P1-10b40): a game's slot and setup as the GM's page
// reads them, a realm's name once its pool is used, the alignments' spread beside humans, the weights for any
// difficulty, and the intel, the guesses and the estimates on a world lacking a list or a field.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import {
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../../src/engine/turn/events-and-their-audiences.ts';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import {
  BOTS_PLAN_CASES,
  FORECAST,
  LANDS,
  PASSES,
  PLAN,
  PLAN_ORDER,
  champion,
  directCase,
  fighter,
  ready,
  stageCase,
  weakling,
  type BotsPlanCase,
  type Staged,
} from '../lib/the-bots-plan-cases.ts';
import { STAGES, rows } from '../lib/before-the-first-phase-cases.ts';
import { board, hero as standAHero, must, type Board, type Character } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
type Raw = Record<string, unknown>;
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const inVm = vm.runInContext('(j)=>JSON.parse(j)', engine) as (j: string) => unknown;
const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v ?? null));
const plan = (tc: unknown): unknown => (engineFn(engine, PLAN) as Fn)(tc);
const forecast = (tc: unknown, ...a: unknown[]) => (engineFn(engine, FORECAST) as Fn)(tc, ...a);

const NOTHING: BotsPlanCase = {
  name: 'nothing staged',
  stage: () => ({ bots: [] }),
  check: () => ({ got: {}, want: {} }),
};
/** A board staged as every case is (`stageCase`), staged further by `more`, and readied for the plan. */
const fresh = (more: (b: Board) => Staged) => {
  const b = board(engine, world, 0);
  const s = stageCase(b, { ...NOTHING, stage: more });
  const tc = ready(b, s);
  return { b, tc, s };
};

/** The cases a direct call can stage, by part (those about the merge's collectors need a turn). */
const DIRECT_CASES = BOTS_PLAN_CASES.map(
  ([part, cases]) => [part, cases.filter((c) => !c.wholeTurnOnly)] as const,
).filter(([, cases]) => cases.length > 0);
describe.each(DIRECT_CASES)('%s, the plan called directly', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(directCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});

// ── Standing in ──────────────────────────────────────────────────────────────────────────────────────────────────
interface Call {
  fn: string;
  args: unknown[];
}
/** Runs `body` with each of `names` replaced by a recorder (in the vm, for the body's length) that calls `instead` for
 *  it if given, or the function it stands in for. */
function standIn<T>(names: readonly string[], body: () => T, instead: Record<string, Fn> = {}): [Call[], T] {
  const g = engine;
  const was = names.map((f) => [f, g[f] as Fn] as const);
  const calls: Call[] = [];
  for (const [f, w] of was)
    g[f] = (...args: unknown[]) => {
      calls.push({ fn: f, args });
      return (instead[f] ?? w)(...args);
    };
  try {
    return [calls, body()];
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
}
const nothing = () => undefined;
const QUIET = Object.fromEntries(PASSES.map((f) => [f, nothing]));
const playWith = (b: Board, s: Staged) => {
  const resolveTurn = engineFn(engine, 'resolveTurn') as (st: string, r: unknown, t: number) => unknown;
  return withCaseDice(engine, LANDS, () => resolveTurn(JSON.stringify(b.G), inVm(rows(b, s)), b.G.turn));
};

// ── Where resolveTurn calls the plan ─────────────────────────────────────────────────────────────────────────────
describe('Where resolveTurn calls it', () => {
  test('once a turn, with the turn’s context and nothing else: after the move pools and before the default to Defend, the passes inside it', () => {
    const b = board(engine, world, 0);
    const s = stageCase(b, { ...NOTHING, stage: () => ({ bots: [1] }) });
    const [calls] = standIn([STAGES[2], PLAN, ...PASSES, STAGES[3], FORECAST], () => playWith(b, s));
    const order = calls.map((c) => c.fn).filter((f) => f !== FORECAST);
    expect(order).toEqual([STAGES[2], PLAN, ...PLAN_ORDER, STAGES[3]]);
    const mine = calls.filter((c) => c.fn === PLAN);
    expect(mine.map((c) => c.args.length)).toEqual([1]);
    expect(mine[0]?.args[0]).toBe(must(calls[0], 'the move pools').args[0]);
  });
  test('the forecast is asked only by the movement pass: with the passes doing nothing, it is never fought', () => {
    const b = board(engine, world, 0);
    const s = stageCase(b, {
      ...NOTHING,
      stage: (bb) => ({ bots: [1], asks: [{ hunter: champion(bb, 1), quarry: weakling(bb, 0) }] }),
    });
    const [calls] = standIn([FORECAST, 'resolvePersonalCombat'], () => standIn(PASSES, () => playWith(b, s), QUIET));
    expect(calls.filter((c) => c.fn === FORECAST)).toEqual([]);
  });
});

// ── What the plan hands the passes ───────────────────────────────────────────────────────────────────────────────
describe('What the plan hands the passes', () => {
  test('each pass, stood in by one that does nothing, is still called in order: the plan doesn’t depend on what a pass does', () => {
    const { tc } = fresh(() => ({ bots: [1, 2] }));
    const [calls] = standIn(PASSES, () => plan(tc), QUIET);
    expect(calls.map((c) => c.fn)).toEqual(PLAN_ORDER);
    expect(calls.every((c) => c.args[0] === tc['G'] && c.args[1] === tc['_botPlayerIdx'])).toBe(true);
  });
  test('the concessions are handed the turn’s context itself (whose GM’s log they write), and the Reckoning the realms’ calls themselves', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [calls] = standIn(PASSES, () => plan(tc), QUIET);
    const third = (f: string) => calls.find((c) => c.fn === f)?.args[2];
    expect(third('runBotConcessions')).toBe(tc);
    expect(third('runBotReckoning')).toBe(tc['reckoningCalls']);
  });
  test('a pass that writes to what it is handed writes to the turn’s own: the log’s lines and a call added are the turn’s', () => {
    // A line is a fact (P1-12d18): one of a kind that holds no values.
    const A_LINE = { kind: "a battle's losses, tallied from its lines" };
    const { tc } = fresh(() => ({ bots: [1] }));
    const lines = (tc['turnLog'] as unknown[]).length;
    standIn(PASSES, () => plan(tc), {
      ...QUIET,
      runBotConcessions: (_G: unknown, _set: unknown, turnContext: unknown) => {
        (engineFn(engine, 'emit') as Fn)(turnContext, {
          type: 'system',
          fact: A_LINE,
          audience: { actor: null, realms: [] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          system: true,
        });
      },
      runBotReckoning: (_G: unknown, _set: unknown, calls: unknown) => (calls as Set<number>).add(2),
    });
    expect((json(tc['turnLog']) as { fact: unknown }[]).slice(lines).map((l) => l.fact)).toEqual([A_LINE]);
    expect([...(tc['reckoningCalls'] as Set<number>)]).toEqual([2]);
  });
  test('the duel forecast handed to the movement pass is the top-level one, asked with the turn’s context first and the hunter’s question after it', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [calls] = standIn(PASSES, () => plan(tc), QUIET);
    const hooks = must(
      calls.find((c) => c.fn === 'runBotMovement'),
      'the movement pass',
    ).args[2] as Raw;
    const marker = { win: 0.5, felled: 0.25 };
    const [asked, results] = standIn(
      [FORECAST],
      () => [(hooks['duelSim'] as Fn)('h', 'q', 24), (hooks['duelSim'] as Fn)('h2', 'q2')],
      { [FORECAST]: () => marker },
    );
    expect(results).toEqual([marker, marker]);
    expect(asked.map((c) => c.args)).toEqual([
      [tc, 'h', 'q', 24],
      [tc, 'h2', 'q2'],
    ]);
  });
  test('the strength figure asks the engine’s terrain and sea figures each time, and multiplies them', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [calls] = standIn(PASSES, () => plan(tc), QUIET);
    const hooks = must(
      calls.find((c) => c.fn === 'runBotMovement'),
      'the movement pass',
    ).args[2] as Raw;
    const [asked, got] = standIn(
      ['terrainMod', 'seaPenalty'],
      () => (hooks['terrainMult'] as Fn)('Knights', 'forest'),
      { terrainMod: () => 3, seaPenalty: () => 0.5 },
    );
    expect(got).toBe(1.5);
    expect(asked.map((c) => [c.fn, ...c.args])).toEqual([
      ['terrainMod', 'Knights', 'forest'],
      ['seaPenalty', 'Knights', 'forest'],
    ]);
  });
  test('the plan writes no line of its own and returns nothing', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const lines = (tc['turnLog'] as unknown[]).length;
    const [, r] = standIn(PASSES, () => (engineFn(engine, PLAN) as (t: unknown) => unknown)(tc), QUIET);
    expect([r, (tc['turnLog'] as unknown[]).length - lines]).toEqual([undefined, 0]);
  });
});

// ── The forecast, called directly ────────────────────────────────────────────────────────────────────────────────
const HELPERS = ['autoEncounterPlan', 'pcCharCombatant', 'resolvePersonalCombat'] as const;
/** The forecast asked of `h` and `q` (`n` fights if given), its three helpers stood in: the engine's own plan is
 *  `auto` (or, by hero id, `autoBy`), a combatant is a record of the copy it was made of, and each fight's result comes
 *  from `results` in turn (a winner of 'A', 'B' or null, and the hunter's HP after). */
const scripted = (
  tc: unknown,
  h: Raw,
  q: Raw,
  n: number | undefined,
  results: [string | null, number][],
  more: { auto?: unknown; fails?: string } = {},
) => {
  let i = 0;
  const instead: Record<string, Fn> = {
    autoEncounterPlan: () => {
      if (more.fails === 'autoEncounterPlan') throw new Error('no plan');
      return more.auto === undefined ? ['ME', 'AR'] : more.auto;
    },
    pcCharCombatant: (_t: unknown, ch: unknown) => {
      if (more.fails === 'pcCharCombatant') throw new Error('no combatant');
      return { ref: ch, tactics: ['XX'] };
    },
    resolvePersonalCombat: (_t: unknown, A: unknown, B: unknown) => {
      const [w, aHp] = must(results[Math.min(i++, results.length - 1)], 'a result');
      return { winner: w === 'A' ? A : w === 'B' ? B : null, aHp };
    },
  };
  return standIn(HELPERS, () => (n === undefined ? forecast(tc, h, q) : forecast(tc, h, q, n)), instead);
};
const hero = (id: number, extra: Raw = {}): Raw => ({
  id,
  name: 'Hero ' + String(id),
  skills: { melee: 3 },
  items: [],
  ...extra,
});

describe('The forecast: how it counts', () => {
  test('the share of fights won, and the share in which the hunter fell without winning', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [, r] = scripted(tc, hero(1), hero(2), 8, [
      ['A', 5],
      ['B', 0],
      ['B', 3],
      [null, -2],
      ['A', 0],
      [null, 4],
      ['B', -1],
      ['A', 7],
    ]);
    expect(r).toEqual({ win: 3 / 8, felled: 3 / 8 });
  });
  test('a fall counts only at no HP left: one HP is no fall, nor is a win at none', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [, r] = scripted(tc, hero(1), hero(2), 4, [
      ['B', 1],
      ['A', 0],
      ['A', -3],
      ['B', 0],
    ]);
    expect(r).toEqual({ win: 2 / 4, felled: 1 / 4 });
  });
  test('twenty fights when not told how many, and when told none', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    for (const n of [undefined, 0]) {
      const [calls, r] = scripted(tc, hero(1), hero(2), n, [['A', 5]]);
      expect([calls.filter((c) => c.fn === 'resolvePersonalCombat').length, r]).toEqual([20, { win: 1, felled: 0 }]);
    }
  });
  test('it gives the two shares and nothing else', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [, r] = scripted(tc, hero(1), hero(2), 1, [['B', 0]]);
    expect(Object.keys(r as Raw)).toEqual(['win', 'felled']);
  });
});

describe('The forecast: what it hands the helpers', () => {
  test('each fight: the engine’s plan for the hunter’s copy, then the quarry’s copy when it lacks one, then both made combatants, then the fight', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [calls] = scripted(tc, hero(1), hero(2), 2, [['A', 5]]);
    expect(calls.map((c) => [c.fn, (c.args[1] as Raw | undefined)?.['id'] ?? null])).toEqual([
      ['autoEncounterPlan', -1],
      ['autoEncounterPlan', -2],
      ['pcCharCombatant', -1],
      ['pcCharCombatant', -2],
      ['resolvePersonalCombat', null],
      ['autoEncounterPlan', -1],
      ['autoEncounterPlan', -2],
      ['pcCharCombatant', -1],
      ['pcCharCombatant', -2],
      ['resolvePersonalCombat', null],
    ]);
    expect(calls.every((c) => c.args[0] === tc)).toBe(true);
  });
  test('the fight is the hunter’s copy against the quarry’s, to twenty rounds', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [calls] = scripted(tc, hero(1), hero(2), 1, [['A', 5]]);
    const f = must(
      calls.find((c) => c.fn === 'resolvePersonalCombat'),
      'the fight',
    );
    expect([((f.args[1] as Raw)['ref'] as Raw)['id'], ((f.args[2] as Raw)['ref'] as Raw)['id'], f.args[3]]).toEqual([
      -1,
      -2,
      { maxRounds: 20 },
    ]);
  });
  test('the copies carry the engine’s plan as an automatic one, and no record of last fights’ lessons', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [calls] = scripted(tc, hero(1, { _sgLog: { melee: 1 } }), hero(2, { _sgLog: { melee: 2 } }), 1, [['A', 5]]);
    const made = calls.filter((c) => c.fn === 'pcCharCombatant').map((c) => c.args[1] as Raw);
    expect(made.map((m) => [m['encounterPlan'], '_sgLog' in m])).toEqual([
      [{ tactics: ['ME', 'AR'], notes: '', _auto: true }, false],
      [{ tactics: ['ME', 'AR'], notes: '', _auto: true }, false],
    ]);
  });
  test('a quarry who carries a plan with tactics keeps it; the hunter never does', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const own = { tactics: ['AR', 'FL'], notes: 'mine' };
    const [calls] = scripted(tc, hero(1, { encounterPlan: own }), hero(2, { encounterPlan: own }), 1, [['A', 5]]);
    expect(calls.filter((c) => c.fn === 'autoEncounterPlan').map((c) => (c.args[1] as Raw)['id'])).toEqual([-1]);
    const made = calls.filter((c) => c.fn === 'pcCharCombatant').map((c) => (c.args[1] as Raw)['encounterPlan']);
    expect(made).toEqual([{ tactics: ['ME', 'AR'], notes: '', _auto: true }, own]);
  });
  test('the combatants fight to the combat tactics of their plans, in any case and with a spell named; with none, the plain melee', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const quarryPlan = { tactics: ['parley', 'Ca:Fireball', 'STEAL', 'arrow', 'MELEE'], notes: '' };
    const [calls] = scripted(tc, hero(1), hero(2, { encounterPlan: quarryPlan }), 1, [['A', 5]], { auto: ['PARLEY'] });
    const f = must(
      calls.find((c) => c.fn === 'resolvePersonalCombat'),
      'the fight',
    );
    expect([(f.args[1] as Raw)['tactics'], (f.args[2] as Raw)['tactics']]).toEqual([
      ['ME'],
      ['Ca:Fireball', 'arrow', 'MELEE'],
    ]);
  });
  test('an engine’s plan of nothing at all is the plain melee', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [calls] = scripted(tc, hero(1), hero(2), 1, [['A', 5]], { auto: null });
    const f = must(
      calls.find((c) => c.fn === 'resolvePersonalCombat'),
      'the fight',
    );
    expect([(f.args[1] as Raw)['tactics'], (f.args[2] as Raw)['tactics']]).toEqual([['ME'], ['ME']]);
  });
  test('every tactic the combat knows is kept, and nothing else', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const known = vm.runInContext('[...COMBAT_ONLY_TACTICS]', engine) as string[];
    const all = [...known, 'PARLEY', 'STEAL', 'YIELD', 'HIDE', 'XX'];
    const [calls] = scripted(tc, hero(1), hero(2), 1, [['A', 5]], { auto: all });
    const f = must(
      calls.find((c) => c.fn === 'resolvePersonalCombat'),
      'the fight',
    );
    expect((f.args[1] as Raw)['tactics']).toEqual(known);
  });
  test('the copies are the heroes’ own, deep: what a fight does to a copy never reaches the hero', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const h = hero(1, { items: [{ name: 'Blade' }], hp: 9 }),
      q = hero(2, { items: [{ name: 'Shield' }], hp: 7 });
    const before = JSON.stringify([h, q]);
    standIn(HELPERS, () => forecast(tc, h, q, 3), {
      autoEncounterPlan: () => ['ME'],
      pcCharCombatant: (_t: unknown, ch: unknown) => {
        const c = ch as Raw;
        (c['items'] as unknown[]).push({ name: 'Taken' });
        c['hp'] = 0;
        (c['skills'] as Raw)['melee'] = 9;
        return { ref: c, tactics: [] };
      },
      resolvePersonalCombat: () => ({ winner: null, aHp: 0 }),
    });
    expect(JSON.stringify([h, q])).toBe(before);
  });
});

describe('The forecast: experience, and a forecast that fails', () => {
  test('experience is muted for every fight and given back as it was, off or on', () => {
    for (const was of [false, true]) {
      const { tc } = fresh(() => ({ bots: [1] }));
      tc['_pcSimulating'] = was;
      const seen: unknown[] = [];
      standIn(HELPERS, () => forecast(tc, hero(1), hero(2), 2), {
        autoEncounterPlan: () => {
          seen.push(tc['_pcSimulating']);
          return ['ME'];
        },
        pcCharCombatant: (_t: unknown, ch: unknown) => ({ ref: ch, tactics: [] }),
        resolvePersonalCombat: () => {
          seen.push(tc['_pcSimulating']);
          return { winner: null, aHp: 3 };
        },
      });
      expect([seen.every((x) => x === true), seen.length, tc['_pcSimulating']]).toEqual([true, 6, was]);
    }
  });
  test.each(['autoEncounterPlan', 'pcCharCombatant', 'resolvePersonalCombat'])(
    'a failure in %s gives no forecast, and experience is given back',
    (where) => {
      for (const was of [false, true]) {
        const { tc } = fresh(() => ({ bots: [1] }));
        tc['_pcSimulating'] = was;
        const [, r] = standIn(HELPERS, () => forecast(tc, hero(1), hero(2), 3), {
          autoEncounterPlan: () => {
            if (where === 'autoEncounterPlan') throw new Error('x');
            return ['ME'];
          },
          pcCharCombatant: (_t: unknown, ch: unknown) => {
            if (where === 'pcCharCombatant') throw new Error('x');
            return { ref: ch, tactics: [] };
          },
          resolvePersonalCombat: () => {
            throw new Error('x');
          },
        });
        expect([r, tc['_pcSimulating']]).toEqual([null, was]);
      }
    },
  );
  test('a hero who can’t be copied gives no forecast, and experience is given back', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const h = hero(1);
    h['self'] = h;
    expect([forecast(tc, h, hero(2), 2), tc['_pcSimulating']]).toEqual([null, false]);
  });
  test('a forecast on two real heroes fights for real: the engine’s own combat, on the board', () => {
    const { b, tc } = fresh(() => ({ bots: [1] }));
    const h = champion(b, 1),
      q = weakling(b, 0);
    const r = withCaseDice(engine, LANDS, () => forecast(tc, h, q, 5));
    expect(r).toEqual({ win: 1, felled: 0 });
  });
});

// ── The Spring orders pass: what a host in contact does first ────────────────────────────────────────────────────
// runBotPhaseOne's Spring stage ranks each hero's orders before his first march by urgency: a host in contact with an
// enemy puts Harvest the Field and Perform Rite ahead of slower orders. It compares the order's key (what the realm
// sends: 'harvest_field', 'rite'), never the row's name; no game of the matrix makes a test red when it does not.
describe('The Spring orders pass: what a host in contact does first', () => {
  const runBotPhaseOne = engineFn(engine, 'runBotPhaseOne') as Fn;
  const hold = (): Raw => ({ action: 'defend', target: '', extra: '', desc: 'Hold' });
  test.for([
    ['Harvest the Field', 'harvest_field'],
    ['Perform Rite', 'rite'],
  ] as const)('a bot host on enemy ground puts its %s ahead of the orders written before it', ([, key]) => {
    const { b } = fresh(() => ({ bots: [1] }));
    b.own(b.X, 0); // realm 0's land, and realms 0 and 1 are at war: the host is in contact
    const h = standAHero(b, { player: 1, at: b.X, troops: 1 });
    const orders = b.G.turnOrders as unknown as Record<number, Raw[]>;
    orders[h.id] = [hold(), hold(), { action: key, target: '', extra: '', desc: '' }, hold(), hold()];
    runBotPhaseOne(b.G, new Set([1]), 'order');
    expect(must(orders[h.id], 'his orders').map((o) => o['action'])).toEqual([
      key,
      'defend',
      'defend',
      'defend',
      'defend',
    ]);
  });
});

// ── Properties ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('Properties of the plan and the forecast', () => {
  test('a forecast leaves any two heroes as they were, writes no line, gives experience back, and gives two shares of its fights that together are at most all of them', () => {
    const b = board(engine, world, 0);
    const s = stageCase(b, { ...NOTHING, stage: () => ({ bots: [1] }) });
    const tc = ready(b, s);
    const raw = (c: Character) => c as unknown as Raw;
    fc.assert(
      fc.property(
        fc.record({
          melee: fc.integer({ min: 0, max: 9 }),
          archery: fc.integer({ min: 0, max: 9 }),
          hp: fc.integer({ min: 1, max: 40 }),
          temper: fc.constantFrom('Brave', 'Cautious', 'Berserker', 'Coward'),
        }),
        fc.record({
          melee: fc.integer({ min: 0, max: 9 }),
          archery: fc.integer({ min: 0, max: 9 }),
          hp: fc.integer({ min: 1, max: 40 }),
          temper: fc.constantFrom('Brave', 'Cautious', 'Berserker', 'Coward'),
        }),
        fc.integer({ min: 1, max: 5 }),
        fc.boolean(),
        fc.double({ min: 0, max: 0.99999, noNaN: true }),
        (x, y, n, muted, die) => {
          const h = fighter(b, 1, { melee: x.melee, archery: x.archery }, x.hp),
            q = fighter(b, 0, { melee: y.melee, archery: y.archery }, y.hp);
          raw(h)['temper'] = x.temper;
          raw(q)['temper'] = y.temper;
          tc['_pcSimulating'] = muted;
          const before = JSON.stringify([h, q]);
          const lines = (tc['turnLog'] as unknown[]).length;
          const r = withCaseDice(engine, { roll: Math.floor(die * 100) + 1, die }, () => forecast(tc, h, q, n)) as {
            win: number;
            felled: number;
          };
          const whole = (v: number) => Math.abs(v * n - Math.round(v * n)) < 1e-9;
          expect(JSON.stringify([h, q])).toBe(before);
          expect((tc['turnLog'] as unknown[]).length).toBe(lines);
          expect(tc['_pcSimulating']).toBe(muted);
          expect(Object.keys(r)).toEqual(['win', 'felled']);
          expect([whole(r.win), whole(r.felled), r.win >= 0, r.felled >= 0, r.win + r.felled <= 1 + 1e-9]).toEqual([
            true,
            true,
            true,
            true,
            true,
          ]);
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });
  test('for any bot realms, every pass is handed exactly those, the turn’s own world and set, in the plan’s order', () => {
    fc.assert(
      fc.property(fc.subarray([0, 1, 2]), (bots) => {
        const { tc } = fresh(() => ({ bots }));
        const [calls] = standIn(PASSES, () => plan(tc), QUIET);
        expect(calls.map((c) => c.fn)).toEqual(PLAN_ORDER);
        expect(calls.map((c) => [...(c.args[1] as Set<number>)])).toEqual(PLAN_ORDER.map(() => bots));
        expect(calls.every((c) => c.args[0] === tc['G'] && c.args[1] === tc['_botPlayerIdx'])).toBe(true);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});

// The intel's and the setup's lines no matrix game reaches (plan P1-10b40): a game's slot and setup read by the GM's
// page, a realm's name drawn from a pool all used, the alignments' spread for humans, and the intel, the guesses and the
// estimates on a world that lacks a list or a field.
describe('The intel and the setup on what no matrix game hands them', () => {
  const fn = (name: string) => engineFn(engine, name) as unknown as Fn;
  const json = (v: unknown) => JSON.stringify(v);
  const thrown = (f: () => unknown) => {
    try {
      f();
      return 'no error';
    } catch (e) {
      return String(e).split(':')[0];
    }
  };
  test("a slot is a bot's with no user and a report that says so, as JSON or parsed, or with no report at all", () => {
    const isBotRow = fn('isBotRow');
    const slots = [
      null,
      0,
      { user_id: 'u1', turn_report: { isBot: true } },
      { user_id: null },
      { user_id: null, turn_report: '{"isBot":true}' },
      { user_id: null, turn_report: { isBot: true } },
      { user_id: null, turn_report: '{"isBot":1}' },
      { user_id: null, turn_report: 'not JSON' },
      { user_id: null, turn_report: null },
      { user_id: null, turn_report: 5 },
      { turn_report: 'null' },
    ];
    expect(slots.map((p) => isBotRow(p))).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
  test("a game's bots and its visibility, from its settings or from its setup's game state, JSON or parsed", () => {
    const botConfigFor = fn('botConfigFor');
    const gameVisibility = fn('gameVisibility');
    const games = [
      { max_players: 4, meta: json({ v: 1, botCount: '2' }), game_state: { allBot: true } },
      { max_players: 4, game_state: json({ botCount: 9 }) },
      { max_players: 4, game_state: { allBot: true } },
      { game_state: { botCount: 2 } },
      { max_players: 4, game_state: 'not JSON' },
      { max_players: 4, game_state: 0 },
      { max_players: 4 },
      { max_players: 0, game_state: { botCount: 3 } },
      { max_players: 4, game_state: { botCount: '3 bots' } },
      { max_players: 4, game_state: { visibility: 'private', invited: ['Ysolde'] } },
      { max_players: 4, game_state: { visibility: 'private', invited: 'Ysolde' } },
      { max_players: 4, game_state: { invited: ['Ysolde'] } },
      { max_players: 4, meta: { v: 1, visibility: 'private', invited: ['Corwin'] } },
      { max_players: 4, game_state: json({ visibility: 'private', invited: ['Ysolde'] }) },
    ];
    expect(json(games.map((g) => [botConfigFor(g), gameVisibility(g)]))).toBe(
      json([
        [
          { botCount: 2, allBot: false },
          { private: false, invited: [] },
        ],
        [
          { botCount: 4, allBot: false },
          { private: false, invited: [] },
        ],
        [
          { botCount: 4, allBot: true },
          { private: false, invited: [] },
        ],
        [
          { botCount: 0, allBot: false },
          { private: false, invited: [] },
        ],
        [
          { botCount: 0, allBot: false },
          { private: false, invited: [] },
        ],
        [
          { botCount: 0, allBot: false },
          { private: false, invited: [] },
        ],
        [
          { botCount: 0, allBot: false },
          { private: false, invited: [] },
        ],
        [
          { botCount: 0, allBot: false },
          { private: false, invited: [] },
        ],
        [
          { botCount: 3, allBot: false },
          { private: false, invited: [] },
        ],
        [
          { botCount: 0, allBot: false },
          { private: true, invited: ['Ysolde'] },
        ],
        [
          { botCount: 0, allBot: false },
          { private: true, invited: [] },
        ],
        [
          { botCount: 0, allBot: false },
          { private: false, invited: [] },
        ],
        [
          { botCount: 0, allBot: false },
          { private: true, invited: ['Corwin'] },
        ],
        [
          { botCount: 0, allBot: false },
          { private: true, invited: ['Ysolde'] },
        ],
      ]),
    );
    // a setup whose game state is JSON's null is read as JavaScript reads a field of null
    expect([
      thrown(() => botConfigFor({ game_state: 'null' })),
      thrown(() => gameVisibility({ game_state: 'null' })),
    ]).toEqual(['TypeError', 'TypeError']);
  });
  test("a bot realm's name: its race's pool, Free Lances' for a race of none, each name once, then a numeral", () => {
    const botKingdomName = fn('botKingdomName');
    const pool = vm.runInContext("ARMY_UNIT_NAMES['Free Lances'].slice()", engine) as string[];
    const elven = vm.runInContext("ARMY_UNIT_NAMES['Elven Bowmen'].slice()", engine) as string[];
    const used = vm.runInContext('[..._usedBotKingdomNames]', engine) as string[];
    vm.runInContext('_usedBotKingdomNames.clear()', engine);
    const capped = (n: string) => n.replace(/^the\b/, 'The');
    const names = pool.map(() => botKingdomName('Nonesuch') as string);
    const more = [botKingdomName('Nonesuch'), botKingdomName('Nonesuch')] as string[];
    const anElf = botKingdomName('Elven') as string;
    vm.runInContext(`_usedBotKingdomNames.clear(); ${json(used)}.forEach((n) => _usedBotKingdomNames.add(n))`, engine);
    expect([...names].sort()).toEqual(pool.map(capped).sort());
    expect(more.map((n) => / (II|III)$/.test(n) && pool.map(capped).includes(n.replace(/ (II|III)$/, '')))).toEqual([
      true,
      true,
    ]);
    expect(more[0]).not.toBe(more[1]);
    expect(elven.map(capped)).toContain(anElf);
  });
  test('the alignments: an unused one first, never a second Divine or Undead, the fewest taken among ties', () => {
    const pick = fn('pickBotAlignment');
    const all = ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead'];
    const counts = (n: number, but: Record<string, number> = {}) =>
      Object.fromEntries(all.map((a) => [a, but[a] ?? n]));
    expect(pick(counts(1, { Undead: 0 }))).toBe('Undead');
    expect(pick(counts(1, { Divine: 0 }))).toBe('Divine');
    const many = Array.from({ length: 30 }, () => pick(counts(1, { Good: 2 })) as string);
    expect([...new Set(many)].every((a) => ['Druidic', 'Neutral', 'Pagan', 'Evil'].includes(a))).toBe(true);
    expect(all).toContain(pick({}));
  });
  test("the alignments for humans: each human's shorter column first, friends as the spectrum reads them", () => {
    const balanced = fn('pickBotAlignmentBalanced');
    const friendsOfGood = ['Divine', 'Good', 'Druidic'];
    const picks = (taken: object, humans: unknown, friends: unknown, foes: unknown) =>
      [...new Set(Array.from({ length: 30 }, () => balanced(taken, humans, friends, foes) as string))].sort();
    expect(picks({}, ['Good'], [1], [0])).toEqual(['Evil', 'Neutral', 'Pagan', 'Undead']);
    expect(picks({}, ['Good'], [], [5])).toEqual(['Divine', 'Druidic', 'Good']);
    expect(picks({ Divine: 1 }, ['Good'], [0], [1])).toEqual(['Druidic', 'Good']);
    expect(picks({ Good: 1 }, ['Good'], [0], [1])).toEqual(['Divine', 'Druidic']);
    expect(picks({ Divine: 0 }, ['Good'], [0], [1])).toEqual(['Divine', 'Druidic', 'Good']);
    expect(friendsOfGood).toContain(picks({}, ['Good'], [0], [1])[0]);
    // no human: the plain spread
    expect(
      picks(
        Object.fromEntries(['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil'].map((a) => [a, 1])),
        [],
        [],
        [],
      ),
    ).toEqual(['Undead']);
    expect(picks({ Undead: 1, Divine: 1, Good: 1, Druidic: 1, Neutral: 1, Pagan: 1 }, null, [], [])).toEqual(['Evil']);
  });
  test("the bots' setups beside humans: their seats after the humans', no second Divine or Undead, half friends and half foes", () => {
    const setups = fn('generateBotSetups');
    const bots = setups([{ alignment: 'Divine' }, { alignment: 'Undead' }, {}, { alignment: null }], 3, 4) as {
      id: number;
      isBot: boolean;
      alignment: string;
      race: string;
      temper: string;
      skills: object;
    }[];
    const builds = vm.runInContext('BOT_SKILL_BUILD', engine) as Record<string, object>;
    expect(bots.map((b) => [b.id, b.isBot])).toEqual([
      [4, true],
      [5, true],
      [6, true],
    ]);
    expect(bots.some((b) => b.alignment === 'Divine' || b.alignment === 'Undead')).toBe(false);
    expect(bots.every((b) => json(b.skills) === json(builds[b.alignment]))).toBe(true);
    expect(bots.every((b) => ['Human', 'Elven', 'Dwarven', 'Orcish'].includes(b.race))).toBe(true);
    expect(bots.every((b) => ['Berserk', 'Brave', 'Cautious', 'Cowardly'].includes(b.temper))).toBe(true);
    const alignDistP = fn('alignDistP');
    for (let k = 0; k < 10; k++) {
      const two = setups([{ alignment: 'Good' }], 2, 1) as { alignment: string }[];
      expect(two.map((b) => Number(alignDistP(b.alignment, 'Good')) <= 1).sort()).toEqual([false, true]);
    }
    expect((setups(null, 2, 0) as unknown[]).length).toBe(2);
    // a gap among the humans' setups is read as JavaScript reads a field of null
    expect(thrown(() => setups([null], 1, 0))).toBe('TypeError');
  });
  test('the weights for a game: the hard ones for any difficulty, none or no realm; the realm’s alignment and race overlays', () => {
    const botTuning = fn('botTuning');
    const hard = json(botTuning(null, null));
    expect([
      json(botTuning({ botDifficulty: 'easy', players: [] }, 0)),
      json(botTuning({ botDifficulty: '', players: [] }, 0)),
      json(botTuning({ botDifficulty: 'nightmare', players: [] }, null)),
      json(botTuning({ botDifficulty: 'hard' }, 0)),
    ]).toEqual([hard, hard, hard, hard]);
    const T = (pl: object) => botTuning({ botDifficulty: 'hard', players: [pl] }, 0) as Record<string, number>;
    const h = JSON.parse(hard) as Record<string, number>;
    expect(T({ alignment: 'Divine', consecratedProvIds: [3] })['kingAttackMargin']).toBeCloseTo(
      Number(h['kingAttackMargin']) * 0.9,
      12,
    );
    expect(T({ alignment: 'Divine', consecratedProvIds: [] })['kingAttackMargin']).toBe(h['kingAttackMargin']);
    expect(T({ alignment: 'Divine', consecratedProvId: 3 })['kingAttackMargin']).toBeCloseTo(
      Number(h['kingAttackMargin']) * 0.9,
      12,
    );
  });
  test('a step to a neighbour in a seventh direction, and a gap among the units an estimate counts, throw as the reads did', () => {
    const G = { world: { cols: 4, rows: 4, provinces: [] } };
    expect(thrown(() => fn('botNeighbourProv')(G, { row: 1, col: 1 }, 6))).toBe('TypeError');
    expect(thrown(() => fn('botForceStrength')([{ type: 'Free Lances', quality: 'Average' }, null]))).toBe('TypeError');
    expect(fn('botForceStrength')(null)).toBe(0);
  });
  test('on a world that lacks its lists: the intel knows nothing, the guesses and estimates count none', () => {
    const G = { turn: 3, world: { cols: 2, rows: 1 } };
    const intel = fn('botIntel')(G, 0) as Record<string, unknown>;
    expect(
      ['owned', 'occupied', 'spied', 'sight', 'border', 'remembered', 'visited', 'known'].map(
        (k) => (intel[k] as Set<number>).size,
      ),
    ).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(json([intel['mem'], intel['graves']])).toBe('[{},{}]');
    const c = { id: 9, player: 0, alive: true, race: 'Human' };
    expect([
      fn('botVisibleCharsIn')(G, 0, { id: 0 }),
      fn('botKnownFeatures')(G, 0, undefined),
      fn('botKnownSkills')(G, 0, { id: 7, player: 1 }),
      fn('botKnownSkills')(G, 0, { id: 7, player: 0 }),
      fn('botEffForce')(G, c, null),
      fn('botBattleForce')(G, c, null, 'plains', null),
      fn('botDruidShortfall')(G, c, null),
      fn('botFervourMult')(G, c, [], false),
      fn('botRaceTerrainMult')(G, null, { type: 'Free Lances' }, null, false, null),
      fn('botStallTurns')(G, 0),
      fn('botMarginFor')(G, 0, { isKing: true }, { kingAttackMargin: 2, heroAttackMargin: 1 }),
      fn('botAlignOf')(G, 0),
      fn('botMutualFoe')(G, 0, 1),
      fn('botConceded')(G, 0),
      fn('botRelationRaw')(G, 0, 1),
      fn('botNoteLand')(G, 0),
    ]).toEqual([[], [], null, {}, 0, 0, 0, 1, 1, 0, 2, 'Neutral', false, false, 'neutral', undefined]);
    // a hero of none, a fallen one, and one standing where the world lists no province (the sight's read throws: the
    // intel's own sight answers)
    const seesChar = fn('botSeesChar');
    expect([
      seesChar(G, 0, null),
      seesChar(G, 0, { alive: false, player: 0 }),
      seesChar(G, 0, { alive: true, player: 0 }),
      seesChar(G, 0, { alive: true, player: 1, location: 0 }),
    ]).toEqual([false, false, true, false]);
    const prov = {};
    fn('markProvinceCombat')(prov, null);
    expect(json(prov)).toBe('{"_combatPlayersThisTurn":[]}');
  });
  test("a realm's own ground and its memory with no units listed, a walked province with no guard or defenders listed, a spy's report with no turn", () => {
    const G = {
      turn: 3,
      world: {
        cols: 3,
        rows: 1,
        provinces: [
          { id: 0, row: 0, col: 0, owner: 0, terrain: 'plains', tax: 3, visitedBy: [0] },
          { id: 1, row: 0, col: 1, owner: null, terrain: 'forest', tax: 2 },
          { id: 2, row: 0, col: 2, owner: null, terrain: 'hills', tax: 5, visitedBy: [0] },
        ],
      },
      players: [
        {
          _provMemory: { 2: { terrain: 'hills', owner: null, tax: 5 } },
          _spiedHeroSkills: { 7: { skills: { melee: 4 } }, 8: {} },
          _graveIntel: { 2: { turn: 1 } },
        },
      ],
      characters: [],
    };
    const belief = fn('botBelief');
    expect(json([belief(G, 0, G.world.provinces[0]), belief(G, 0, G.world.provinces[2])])).toBe(
      json([
        { id: 0, row: 0, col: 0, terrain: 'plains', owner: 0, tax: 3, armyTypes: [], live: true },
        { id: 2, row: 0, col: 2, terrain: 'hills', owner: null, tax: 5, armyTypes: [], live: true },
      ]),
    );
    expect(fn('botGuessDefence')(G, 0, G.world.provinces[2])).toBe(0);
    expect(fn('botTargetDefence')(G, 0, G.world.provinces[0])).toBe(0);
    expect([
      fn('botKnownSkills')(G, 0, { id: 7, player: 1 }),
      fn('botKnownSkills')(G, 0, { id: 8, player: 1 }),
    ]).toEqual([{ melee: 4 }, {}]);
    expect([fn('botKnowsGraves')(G, 0, 2), fn('botKnowsGraves')(G, 0, 1)]).toEqual([true, false]);
  });

  test("ground beyond the border known from memory alone, a walked province's guard listed nowhere, a seen hero of no realm with no units", () => {
    const prov = (id: number, more: object = {}) => ({
      id,
      row: 0,
      col: id,
      owner: null,
      terrain: 'plains',
      tax: 2,
      ...more,
    });
    const world = (provinces: object[]) => ({ cols: 5, rows: 1, provinces });
    // realm 0 holds column 0: columns 1 and 4 are its border, column 3 it remembers only
    const G = {
      turn: 4,
      world: world([prov(0, { owner: 0 }), prov(1), prov(2), prov(3), prov(4)]),
      players: [{ _provMemory: { 3: { terrain: 'hills', owner: 1, tax: 6 } } }],
      characters: [],
    };
    expect(json(fn('botBelief')(G, 0, G.world.provinces[3]))).toBe(
      json({ id: 3, row: 0, col: 3, terrain: 'hills', owner: 1, tax: 6, armyTypes: [], live: false }),
    );
    // a walked neutral province whose guard the world doesn't list, or lists with no units: its defenders are counted
    const walked = prov(1, {
      visitedBy: [0],
      characters: [2],
      neutralDefenders: [{ type: 'Free Lances' }, { type: 'Free Lances' }],
    });
    const guess = fn('botGuessDefence');
    const noHeroes = { ...G, characters: undefined, world: world([prov(0, { owner: 0 }), walked]) };
    const aGuardOfNone = {
      ...G,
      characters: [{ id: 2, alive: true, player: null }],
      world: world([prov(0, { owner: 0 }), walked]),
    };
    expect([guess(noHeroes, 0, walked), guess(aGuardOfNone, 0, walked)]).toEqual([15, 15]);
    // a neutral province one of the realm's heroes stands in, beside a hero of no realm with no units listed and no
    // defenders listed: nothing defends it
    const seen = {
      turn: 4,
      world: world([prov(0, { owner: 0 }), prov(1)]),
      players: [{}],
      characters: [
        { id: 1, player: 0, alive: true, location: 1 },
        { id: 2, player: null, alive: true, location: 1 },
      ],
    };
    expect(fn('botTargetDefence')(seen, 0, seen.world.provinces[1])).toBe(0);
    // the land counted on a world that lists no provinces
    const noLand = { turn: 2, world: {}, players: [{}] };
    fn('botNoteLand')(noLand, 0);
    expect(json(noLand.players[0])).toBe('{"_botLandPrev":0,"_botLandSeenTurn":2}');
    // a spy's report read on a state with no turn
    expect(
      fn('botKnownSkills')({ players: [{ _spiedHeroSkills: { 7: { turn: 1, skills: { melee: 2 } } } }] }, 0, {
        id: 7,
        player: 1,
      }),
    ).toEqual({
      melee: 2,
    });
  });
  test("the alignments for humans whose foes' column is shorter than the list, and humans of no alignment or an empty one", () => {
    const balanced = fn('pickBotAlignmentBalanced');
    const picks = [...new Set(Array.from({ length: 30 }, () => balanced({}, ['Good'], [5], []) as string))].sort();
    expect(picks).toEqual(['Evil', 'Neutral', 'Pagan', 'Undead']);
    const setups = fn('generateBotSetups');
    const alignDistP = fn('alignDistP');
    for (let k = 0; k < 10; k++) {
      const two = setups([{ alignment: '' }, { alignment: null }, { alignment: 'Good' }], 2, 3) as {
        alignment: string;
      }[];
      expect(two.map((b) => Number(alignDistP(b.alignment, 'Good')) <= 1).sort()).toEqual([false, true]);
    }
  });
  test('an estimate whose Druid check fails counts the unit whole; a terrain figure that fails leaves it as it is', () => {
    const dragon = [{ type: 'Elder Dragons', race: 'Primal', quality: 'Average' }];
    const c = { player: 0, race: 'Human', skills: {}, armies: [] };
    // a realm's discoveries held as no list: the Druid check's runner throws, and the unit counts whole
    const G = { players: [{ alignment: 'Good', race: 'Human', discoveries: 5 }], characters: [], turn: -2 };
    expect([fn('botEffForce')(G, c, dragon), fn('botDruidShortfall')(G, c, dragon)]).toEqual([38, 0]);
    // a unit whose race can't be read the first time: the battle's estimate's Druid check fails, the unit counts whole
    let reads = 0;
    const aStrangeDragon = {
      type: 'Elder Dragons',
      quality: 'Average',
      get race() {
        reads++;
        if (reads === 1) throw new Error('unreadable');
        return 'Primal';
      },
    };
    const plain = { players: [{ alignment: 'Good', race: 'Human', discoveries: [] }], characters: [], turn: -2 };
    expect(fn('botBattleForce')(plain, c, [aStrangeDragon], 'plains', {})).toBeCloseTo(38, 9);
    // the engine's terrain figure, handed in by the turn: a figure that fails leaves the unit's multiplier as it is
    const terrainMult = fn('botRaceTerrainMult');
    const withAFigure = (figure: Fn) => {
      const W = { turn: 1 };
      (fn('botTurnCache')(W) as Record<string, unknown>)['terrainMult'] = figure;
      return terrainMult(W, null, { type: 'Free Lances' }, 'forest', false, null);
    };
    expect([
      withAFigure(() => 2),
      withAFigure(() => {
        throw new Error('no figure');
      }),
    ]).toEqual([2, 1]);
  });
});
