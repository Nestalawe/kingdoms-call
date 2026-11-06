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
// difficulty, and the intel, the guesses and the estimates on a world lacking a list or a field. Then the strategy's
// helpers on what no matrix game hands them (P1-10b41): a world, a realm, a hero, a province or a ledger lacking a list
// or a field, the musters of an admiral, a flying general and a host, a garrison, a hire and the kinds a province raises.
// Then the Spring orders pass on what no matrix game hands it (P1-10b42), with a case aimed at each fault the night
// run's mutation session found unguarded (P1-21j): the empire's width, a feint past a visiting host, the forced march
// at the second assault, a garrison raised under threat put first, and a Flood mage's pins within his casting limit.
// Last, the spellcraft on what no matrix game hands it (P1-10b43): the single best cast, the titles a realm with no
// standings chases, the ratings and a guardian weighed on a hero lacking a field, a lair, a march, a path, a quarry, a
// cast plan, the cross-training, the actions pass, a spy's target and the practice fallback on a world lacking a list.
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

describe("The strategy's helpers on what no matrix game hands them (P1-10b41)", () => {
  const fn = (name: string) => engineFn(engine, name) as unknown as Fn;
  const json = (v: unknown) => JSON.stringify(v);
  /** A world of one realm and the lists named, each other list missing; its map 2 by 1. */
  const aWorld = (lists: Record<string, unknown> = {}) => ({
    turn: 3,
    world: { cols: 2, rows: 1, ...((lists['world'] as object | undefined) ?? {}) },
    players: [{}],
    ...Object.fromEntries(Object.entries(lists).filter(([k]) => k !== 'world')),
  });
  const aProvince = (fields: Record<string, unknown> = {}) => ({
    id: 0,
    row: 0,
    col: 0,
    owner: 0,
    terrain: 'plains',
    ...fields,
  });
  const aLedger = (fields: Record<string, unknown> = {}) => ({
    budget: 40,
    upkeep: 0,
    upkeepCap: 40,
    recruitedByProv: {},
    ...fields,
  });
  const results = (calls: readonly (() => unknown)[]) =>
    json(
      calls.map((f) => {
        try {
          return f();
        } catch (e) {
          return `throws ${String(e).split(':')[0] ?? ''}`;
        }
      }),
    );
  test("the bot flag, a realm's roles and ledger, a home and a column's reach on a world that lacks its lists", () => {
    expect(
      results([
        () => fn('botIsBotPlayer')({}, 0),
        () => fn('botIsBotPlayer')({ players: [{ isBot: true }] }, 0),
        () => fn('botIsBotPlayer')({ players: [{ _isBot: false, isBot: true }, null] }, 0),
        () => fn('botIsBotPlayer')({ players: [{ _isBot: false, isBot: true }, null] }, 1),
        () => fn('botIsBotPlayer')({ players: [{ _isBot: true }] }, 0),
        () => fn('botRoles')(aWorld(), 0),
        () => fn('botLedger')(aWorld(), 0),
        () =>
          fn('botHomeId')(
            aWorld({ players: [{ homeProvinceId: 7 }], world: { provinces: [null, aProvince({ id: 1 })] } }),
            0,
          ),
        () => fn('botHomeId')(aWorld({ players: [] }), 0),
        () => fn('botLandReach')({}, null),
        () => fn('botLandReach')({ skills: {} }, ['Shieldwall Levies', 'Strange Levies']),
        () => fn('botSeaReach')({}),
        () => fn('botSeaReach')({ armies: [{ type: 'Galleon Fleet' }, null], skills: {} }),
        () => fn('botSeaReach')({ armies: [{ type: 'Whale Cohort' }] }),
        () => fn('botFleetOnly')(null),
        () => fn('botEmpireDiameter')({ world: { cols: 2 } }, 0),
        () => fn('botGeneralship')({}),
        () => fn('botGeneralship')({ race: 'Human', armies: [null, { race: 'Orcish' }] }),
        () => fn('botMagicScore')({}),
        () => fn('botDuelSkill')({}),
        () => fn('botLairRating')({}),
        () => fn('botPracticeSkill')({}),
        () => fn('botPracticeSkill')({ skills: { melee: 5, tactical: 5 } }),
        () => fn('botRoleTrainSkill')({ _botRole: 'admiral' }),
        () => fn('botRoleTrainSkill')({ _botRole: 'spy', skills: { spy: 6 } }),
        () => fn('botIsFighter')(null),
        () => fn('botIsTeach')({ action: 'practice' }),
        () => fn('botIsTeach')({ action: 'practice', desc: 'Practice Melee (teach Ser Amble)' }),
        () => fn('botMoveOrder')(9),
      ]),
    ).toBe(
      '[false,true,true,false,true,{"leaders":[],"defenders":[],"primaryId":null,"reach":3,"want":1},{"income":0,"warFooting":false,"upkeepCap":0,"upkeep":0,"budget":-3,"recruitedByProv":{},"rumourFund":0,"warChest":0,"diag":{"gold":0,"income":0,"reserve":3,"budget0":-3,"upkeep0":0,"cap":0,"calls":0,"noTypes":0,"noKin":0,"capStop":0,"budgetStop":0,"tokens":0,"holdersIdle":0,"holdersInRecruit":0,"navCap":0,"airCap":0},"defReserve":0,"navReserve":0,"airReserve":0,"nav":null,"air":null},1,"throws TypeError",5,2,0,3,5,false,0,0,-1,0,0,20,"melee","march","naval","spy",false,false,true,{"action":"move","target":"dir:undefined","extra":"","desc":"Advance"}]',
    );
  });
  test("a realm's roles, its ledger and its upkeep, its defenders and its admiral, with heroes holding no list", () => {
    expect(
      results([
        () => {
          const G = aWorld({
            world: {
              provinces: [
                aProvince({ armyTypes: ['Galleon Fleet'] }),
                aProvince({ id: 1, col: 1, terrain: 'sea', owner: null }),
              ],
            },
            players: [{ gold: 30 }],
            characters: [
              null,
              { id: 1, player: 0, alive: true, isKing: true, location: 0 },
              {
                id: 2,
                player: 0,
                alive: true,
                location: 0,
                _botRole: 'defender',
                armies: [{ type: 'Strange Levies' }, { type: 'Shieldwall Levies', _isSkeletal: true }],
              },
              {
                id: 3,
                player: 0,
                alive: true,
                location: 0,
                _botRole: 'slayer',
                skills: { naval: 2 },
                armies: [{ type: 'Strange Levies', _temporary: true }, { type: 'Strange Levies' }],
              },
              {
                id: 4,
                player: 0,
                alive: true,
                location: 0,
                skills: { naval: 3 },
                armies: [
                  { type: 'Galleon Fleet' },
                  { type: 'Shieldwall Levies' },
                  { type: 'Shieldwall Levies' },
                  { type: 'Shieldwall Levies' },
                  { type: 'Shieldwall Levies' },
                  { type: 'Shieldwall Levies' },
                ],
              },
            ],
          });
          return [fn('botRoles')(G, 0), fn('botLedger')(G, 0), fn('botUpkeep')(G, 0)];
        },
        () =>
          fn('botUpkeep')(
            {
              world: {
                provinces: [
                  null,
                  aProvince({
                    garrisonArmies: [{ type: 'Strange Garrison' }, { type: 'Human Garrison', _isSkeletal: true }],
                  }),
                  aProvince({ id: 1 }),
                ],
              },
              characters: [{ player: 0, alive: true, pay: 2 }],
            },
            0,
          ),
        () => fn('botUpkeep')({ world: {} }, 0),
        () =>
          fn('botTaxIncome')({ world: { provinces: [null, aProvince({ tax: 4 }), aProvince({ id: 1, tax: 0 })] } }, 0),
        () => fn('botTaxIncome')({ world: {} }, 0),
        () => fn('botLandCount')({ world: {} }, 0),
        () => fn('botCoastalPorts')({ world: {} }, 0),
        () => fn('botFlyerPorts')({ world: {} }, 0),
        () => fn('botHeroCap')({ world: {}, players: [] }, 0),
        () =>
          fn('botHeroCap')(
            { world: { provinces: [null, aProvince()] }, players: [{ alignment: 'Neutral', gold: 31 }] },
            0,
          ),
      ]),
    ).toBe(
      '[[{"leaders":[4,3],"defenders":[],"primaryId":4,"reach":2,"want":1},{"income":0,"warFooting":false,"upkeepCap":12,"upkeep":16,"budget":27,"recruitedByProv":{},"rumourFund":0,"warChest":0,"diag":{"gold":30,"income":0,"reserve":3,"budget0":27,"upkeep0":18,"cap":16,"calls":0,"noTypes":0,"noKin":0,"capStop":0,"budgetStop":0,"tokens":0,"holdersIdle":0,"holdersInRecruit":0,"navCap":4,"airCap":0},"defReserve":0,"navReserve":0,"airReserve":0,"nav":{"cap":4,"upkeep":2,"id":3},"air":null},18],5,0,4,0,0,[],[],4,8]',
    );
  });
  test('the enemies in sight, the defence of a province and the bodies to raise, on a world that lacks its lists', () => {
    expect(
      results([
        () => fn('botUnderAttack')(aWorld(), 0),
        () =>
          fn('botUnderAttack')(
            aWorld({
              world: { provinces: [aProvince()] },
              relations: { '0-1': 'enemy' },
              characters: [null, { id: 1, player: 1, alive: true, location: 0 }],
            }),
            0,
          ),
        () => fn('botNeedsSlayer')({}, 0),
        () => fn('botAtWar')({}, 0),
        () =>
          fn('botAtWar')(
            {
              players: [{}, null, {}],
              characters: [null, { player: 2, alive: true, isKing: true }],
              relations: { '0-2': 'enemy' },
            },
            0,
          ),
        () => fn('botMaxEnemyStack')({}, 0),
        () => fn('botFleetHullCount')({}, 0),
        () =>
          fn('botFleetHullCount')(
            {
              characters: [
                null,
                { player: 0, alive: true },
                { player: 0, alive: true, armies: [null, { type: 'Galleon Fleet' }] },
              ],
            },
            0,
          ),
        () => fn('botEnemyDefence')(aWorld(), aProvince(), 1, null),
        () =>
          fn('botEnemyDefence')(
            aWorld({
              characters: [
                null,
                {
                  id: 4,
                  player: 1,
                  alive: true,
                  race: 'Human',
                  armies: [{ type: 'Shieldwall Levies', race: 'Human', quality: 'Average' }],
                },
                { id: 5, player: 2, alive: true },
              ],
            }),
            aProvince({
              characters: [4, 5, 6],
              garrisonArmies: [{ type: 'Human Garrison', race: 'Human', quality: 'Average' }],
            }),
            1,
            null,
          ),
        () => fn('botEnemyDefence')(aWorld(), aProvince({ characters: [4] }), 1, null),
        () => fn('botDefenceNeed')(aWorld({ world: { provinces: [] } }), aProvince(), 0),
        () => fn('botDefenceNeed')(aWorld({ world: { provinces: [] } }), null, 0),
        () =>
          fn('botDefenceNeed')(
            aWorld({
              world: { provinces: [aProvince(), aProvince({ id: 1, col: 1, owner: 1 })] },
              relations: { '0-1': 'enemy' },
              characters: [
                null,
                { id: 1, player: 1, alive: true, location: 1, armies: [{ type: 'Shieldwall Levies' }] },
                { id: 2, player: 0, alive: true, location: 0 },
              ],
            }),
            aProvince({ characters: [2, 3] }),
            0,
          ),
        () => fn('botEnemyChars')(aWorld(), aProvince(), 0),
        () =>
          fn('botEnemyChars')(
            aWorld({
              world: { provinces: [aProvince()] },
              relations: { '0-1': 'enemy' },
              characters: [{ id: 1, player: 1, alive: true, location: 0, isKing: true }],
            }),
            aProvince(),
            0,
          ),
        () => fn('botEnemyHostsIn')(aWorld(), 0, aProvince()),
        () => fn('botInContact')(aWorld(), 0, {}),
        () => fn('botNearbyThreat')({ world: { provinces: [aProvince()] } }, 0, { location: 0 }),
        () => fn('botRaiseTargets')({ players: [{}] }, 0),
        () =>
          fn('botRaiseTargets')(
            {
              players: [{ knownDeadHeroIds: [4, 5] }],
              heroGraveyard: [
                null,
                { id: 4, player: 0, location: 2 },
                { id: 5, player: 0, location: 3, skills: { melee: 2 } },
              ],
              characters: [null],
            },
            0,
          ),
        () => fn('botHasMetPlayers')({ turn: 2 }, 0),
        () => fn('botEnemyIntel')({}, 0),
        () => fn('botUpdateIntel')({ turn: 4, players: [{}] }, 0),
        () =>
          fn('botUpdateIntel')(
            {
              turn: 4,
              players: [
                { _botIntel: { generals: {}, heroes: {} } },
                { _botIntel: { generals: { 7: { turn: 3, player: 2, units: 2 } } } },
                {},
              ],
              relations: { '0-1': 'allied', '0-2': 'enemy' },
              characters: [null, { id: 8, player: 2, alive: true, location: 0, isKing: true }],
              world: { cols: 2, rows: 1, provinces: [aProvince()] },
            },
            0,
          ),
        () => fn('botAssumedChar')({ players: [{}] }, 0, { id: 3, player: 1, items: [{ name: 'a ring' }] }),
      ]),
    ).toBe(
      '[false,false,true,false,true,0,0,1,0,12,0,0,0,0,{"force":0,"value":0,"hasKing":false,"units":0},{"force":0,"value":50,"hasKing":true,"units":0},[],false,false,[],[{"g":{"id":5,"player":0,"location":3,"skills":{"melee":2}},"loc":3,"val":2},{"g":{"id":4,"player":0,"location":2},"loc":2,"val":0}],false,{"generals":{},"heroes":{}},{"generals":{},"heroes":{}},{"generals":{"7":{"turn":3,"player":2,"units":2}},"heroes":{}},{"id":3,"player":1,"items":[],"skills":{"melee":3,"archery":2,"tactical":2,"elemental":2}}]',
    );
  });
  test('the musters, a garrison, a hire and the kinds a province raises, with lists and fields missing', () => {
    expect(
      results([
        () => fn('botGarrisonType')({}),
        () => {
          const prov = aProvince({ armyTypes: ['Strange Garrison'] });
          const L = aLedger();
          return [
            fn('botGarrisonOrder')(
              aWorld({ world: { provinces: [prov] }, players: [{ homeProvinceId: 0 }] }),
              0,
              prov,
              L,
            ),
            L,
          ];
        },
        () => fn('botRecruitCmdr')(aWorld(), 0, { id: 1, location: 0 }),
        () => fn('botRecruitOrder')(['Shieldwall Levies|', 'Archers'], null),
        () => fn('botRecruitOrder')(['Shieldwall Levies|2'], 4),
        () => {
          const prov = aProvince({
            armyTypes: ['Strange Levies', 'Shieldwall Levies', 'Human Garrison', 'Galleon Fleet'],
          });
          const L = aLedger();
          const c = { id: 1, player: 0, alive: true, location: 0, race: 'Human' };
          return [
            fn('botFieldRecruitTokensCore')(aWorld({ world: { provinces: [prov] }, characters: [c] }), 0, c, prov, L),
            L,
          ];
        },
        () => {
          const prov = aProvince({ armyTypes: ['Galleon Fleet', 'Shieldwall Levies'] });
          const L = aLedger({ diag: {} });
          const c = { id: 1, player: 0, alive: true, location: 0, race: 'Human', _botRole: 'admiral' };
          return [
            fn('botFieldRecruitTokensCore')(aWorld({ world: { provinces: [prov] }, characters: [c] }), 0, c, prov, L),
            L,
          ];
        },
        () => {
          const prov = aProvince({ armyTypes: ['Eagle Riders', 'Shieldwall Levies', 'Strange Levies'] });
          const L = aLedger();
          const c = { id: 1, player: 0, alive: true, location: 0, race: 'Human', _botRole: 'skygeneral' };
          return [
            fn('botFieldRecruitTokensCore')(aWorld({ world: { provinces: [prov] }, characters: [c] }), 0, c, prov, L),
            L,
          ];
        },
        () => {
          const prov = aProvince({ armyTypes: ['Shieldwall Levies'] });
          const L = aLedger({ budget: 0 });
          const c = { id: 1, player: 0, location: 0, race: 'Human' };
          return [fn('botFieldRecruitTokensCore')(aWorld({ world: { provinces: [prov] } }), 0, c, prov, L), L];
        },
        () => {
          const prov = aProvince({ armyTypes: ['Shieldwall Levies'] });
          const L = aLedger({ upkeepCap: 0 });
          const c = { id: 1, player: 0, location: 0, race: 'Human' };
          return [fn('botFieldRecruitTokensCore')(aWorld({ world: { provinces: [prov] } }), 0, c, prov, L), L];
        },
        () => {
          const prov = aProvince({ armyTypes: ['Human Garrison', 'Galleon Fleet'] });
          const L = aLedger();
          const c = { id: 1, player: 0, location: 0, race: 'Human' };
          return [fn('botFieldRecruitTokensCore')(aWorld({ world: { provinces: [prov] } }), 0, c, prov, L), L];
        },
        () => fn('botFieldRecruitTokensCore')(aWorld(), 0, { id: 1 }, aProvince({ armyTypes: undefined }), aLedger()),
        () => {
          const L = aLedger();
          const h = { id: 2, player: null, alive: true, location: 0, alignment: 'Neutral', skills: {} };
          return [
            fn('botHireOrder')(
              aWorld({ world: { provinces: [aProvince()] }, characters: [null, h] }),
              0,
              { id: 1, location: 0 },
              L,
            ),
            L,
          ];
        },
        () => fn('botRecruitableTypes')({ id: 0 }, null, null),
        () =>
          fn('botRecruitableTypes')(aProvince({ armyTypes: ['Strange Levies', 'Mountain Guns', ''] }), aWorld(), {
            player: 0,
            race: 'Human',
          }),
        () =>
          fn('botRecruitableTypes')(
            aProvince({ armyTypes: ['Shieldwall Levies'], race: null }),
            {
              players: [{ alignment: '' }],
              world: { provinces: [null, aProvince({ id: 1, col: 1, race: null, armyTypes: ['Orc Raiders'] })] },
            },
            { player: 0, race: 'Orcish' },
          ),
        () =>
          fn('botRecruitableTypes')(
            aProvince({ armyTypes: ['Shieldwall Levies'], race: 'Human' }),
            {
              world: {
                provinces: [
                  aProvince({ id: 1, col: 1, race: 'Orcish' }),
                  aProvince({ id: 2, col: 1, race: 'Orcish', armyTypes: ['', 'Goblin Horde'] }),
                ],
              },
            },
            { player: null, race: 'Orcish' },
          ),
        () => fn('botDrillOrder')({}, 0, {}),
        () =>
          fn('botDrillOrder')({ players: [{}], characters: [] }, 0, {
            armies: [{ type: 'Shieldwall Levies' }],
            skills: { tactical: 2 },
          }),
      ]),
    ).toBe(
      '[null,[{"action":"recruit","target":"Strange Garrison|1,to:garrison","extra":"","desc":"Garrison undefined (1)"},{"budget":39,"upkeep":1,"upkeepCap":40,"recruitedByProv":{"0":{"Strange Garrison":1}}}],{"id":1,"location":0},{"action":"recruit","target":"Shieldwall Levies|,Archers","extra":"","desc":"Recruit 2 units"},{"action":"recruit","target":"Shieldwall Levies|2,to:4","extra":"","desc":"Recruit 2 units"},[["Galleon Fleet|1","Strange Levies|3","Shieldwall Levies|3"],{"budget":25,"upkeep":15,"upkeepCap":40,"recruitedByProv":{"0":{"Galleon Fleet":1,"Strange Levies":1,"Shieldwall Levies":1}}}],[["Galleon Fleet|1","Shieldwall Levies|1"],{"budget":35,"upkeep":5,"upkeepCap":40,"recruitedByProv":{"0":{"Galleon Fleet":1,"Shieldwall Levies":1}},"diag":{"calls":1,"tokens":1}}],[["Eagle Riders|1","Shieldwall Levies|1"],{"budget":34,"upkeep":6,"upkeepCap":40,"recruitedByProv":{"0":{"Eagle Riders":1,"Shieldwall Levies":1}}}],[[],{"budget":0,"upkeep":0,"upkeepCap":40,"recruitedByProv":{"0":{}}}],[[],{"budget":40,"upkeep":0,"upkeepCap":0,"recruitedByProv":{"0":{}}}],[["Galleon Fleet|1"],{"budget":37,"upkeep":3,"upkeepCap":40,"recruitedByProv":{"0":{"Galleon Fleet":1}}}],[],[{"action":"hire","target":"2","extra":"","desc":"Hire undefined"},{"budget":38,"upkeep":2,"upkeepCap":40,"recruitedByProv":{},"hired":{}}],[],["Mountain Guns","Strange Levies"],["Shieldwall Levies"],["Shieldwall Levies"],null,{"action":"practice","target":"druid","extra":"","desc":"Practice Druid (lead the host cleanly)"}]',
    );
  });
  test("a hero seen beside the realm's own, a court of many heroes, a host of the grudge race, a frontier and the tables' fallbacks", () => {
    expect(
      results([
        () => {
          // realm 0's hero 1 stands in column 0 beside hero 2 of realm 1, at war, who leads no units listed
          const provinces = [aProvince({ tax: 2 }), aProvince({ id: 1, col: 1, tax: 2 })];
          const G = aWorld({
            world: { cols: 5, provinces },
            players: [{}, {}],
            relations: { '0-1': 'enemy' },
            characters: [
              { id: 1, player: 0, alive: true, location: 0 },
              { id: 2, player: 1, alive: true, location: 0, name: 'Ser Vane' },
            ],
          });
          return [
            fn('botMaxEnemyStack')(G, 0),
            fn('botNearbyThreat')(G, 0, { location: 1 }),
            fn('botEnemyHostsIn')(G, 0, provinces[0]),
            fn('botUpdateIntel')(G, 0),
          ];
        },
        () => {
          // a host of realm 1 seen in realm 0's column 1, beside realm 0's hero: column 0, with no heroes or garrison listed
          const G = aWorld({
            world: { cols: 5, provinces: [aProvince({ tax: 2 }), aProvince({ id: 1, col: 1, tax: 2 })] },
            players: [{}, {}],
            relations: { '0-1': 'enemy' },
            characters: [
              { id: 1, player: 0, alive: true, location: 1 },
              {
                id: 2,
                player: 1,
                alive: true,
                location: 1,
                armies: [{ type: 'Shieldwall Levies', race: 'Human', quality: 'Average' }],
              },
            ],
          });
          return fn('botDefenceNeed')(G, aProvince({ tax: 2 }), 0);
        },
        () => fn('botAtWar')({ players: [{}, {}] }, 0),
        () => fn('botCoastalFleetType')({}),
        () => fn('botCoastalFleetType')({ armyTypes: ['Shieldwall Levies'] }),
        () => fn('botFlyerType')(null),
        () => fn('botFlyerType')({}),
        () => fn('botHeroCap')({ world: {} }, 0),
        () => fn('botHireOrder')(aWorld(), 0, { id: 1, location: 0 }, aLedger()),
        () => fn('botRaiseTargets')({ heroGraveyard: [{ id: 4, player: 0, location: 2 }] }, 0),
        () =>
          fn('botRaiseTargets')(
            { players: [{ knownDeadHeroIds: [4] }], heroGraveyard: [{ id: 4, player: 0, location: 2 }] },
            0,
          ),
        () => fn('botUpdateIntel')({}, 0),
        () => fn('botRoleTrainSkill')({ _botRole: 'spy', skills: {} }),
        () =>
          fn('botHomeId')(
            aWorld({
              players: [{ homeProvinceId: 7 }],
              world: {
                cols: 4,
                provinces: [
                  aProvince({ tax: 0 }),
                  aProvince({ id: 1, col: 1, tax: undefined }),
                  aProvince({ id: 2, col: 2, tax: 3 }),
                  aProvince({ id: 3, col: 3, tax: 0 }),
                ],
              },
            }),
            0,
          ),
        () => {
          // realm 0 holds columns 0 and 1; column 2 is open land of no tax, column 3 the sea
          const provinces = [
            aProvince(),
            aProvince({ id: 1, col: 1 }),
            aProvince({ id: 2, col: 2, owner: null, tax: 0 }),
            aProvince({ id: 3, col: 3, owner: null, terrain: 'sea' }),
          ];
          const G = aWorld({ world: { cols: 4, provinces }, characters: [] });
          return fn('botFrontierTarget')(G, 0, provinces[0]);
        },
        () => {
          // an Orcish lord in Human land two hops from Orcish land of the realm's, past a province of it that lists no units:
          // the grudge race gives him nothing, and a muster there with no tally finds no kin
          const prov = aProvince({ race: 'Human', armyTypes: ['Shieldwall Levies'] });
          const G = aWorld({
            world: {
              cols: 4,
              provinces: [
                prov,
                aProvince({ id: 1, col: 1, race: 'Orcish' }),
                aProvince({ id: 2, col: 2, race: 'Orcish', armyTypes: ['Goblin Horde'] }),
              ],
            },
          });
          const c = { id: 1, player: 0, alive: true, location: 0, race: 'Orcish' };
          const L = aLedger();
          return [
            fn('botRecruitableTypes')(prov, G, c),
            fn('botFieldRecruitTokensCore')(G, 0, c, prov, L),
            L,
            fn('botRecruitableTypes')(prov, { world: {} }, c),
          ];
        },
        () =>
          fn('botRecruitableTypes')(
            aProvince({ armyTypes: ['Shieldwall Levies', 'Strange Levies'], race: null }),
            aWorld(),
            { player: 0, race: 'Human' },
          ),
        () =>
          fn('botRecruitableTypes')(
            aProvince({ armyTypes: ['Shieldwall Levies', 'Strange Levies'], race: '' }),
            aWorld(),
            { player: 0, race: 'Human' },
          ),
        () =>
          fn('botRecruitableTypes')(
            aProvince({ armyTypes: ['Shieldwall Levies', 'Elder Dragons'] }),
            aWorld({ players: [{ alignment: 'Good', race: 'Human', discoveries: 5 }], characters: [] }),
            { player: 0, race: 'Human', skills: {}, armies: [] },
          ),
        () =>
          fn('botRecruitableTypes')(
            aProvince({ armyTypes: ['Elder Dragons', 'Shieldwall Levies'], race: null }),
            aWorld({ players: [{ alignment: 'Good', race: 'Human', discoveries: [] }], characters: [] }),
            { player: 0, race: 'Human', skills: {}, armies: [] },
          ),
        () =>
          fn('botRecruitableTypes')(
            aProvince({ armyTypes: ['Elder Dragons', 'Shieldwall Levies'], race: '' }),
            aWorld({ players: [{ alignment: 'Good', race: 'Human', discoveries: [] }], characters: [] }),
            { player: 0, race: 'Human', skills: {}, armies: [] },
          ),
        () =>
          fn('botHomeId')(
            aWorld({
              world: {
                cols: 3,
                provinces: [
                  aProvince({ owner: 1 }),
                  aProvince({ id: 1, col: 1, tax: 0 }),
                  aProvince({ id: 2, col: 2, tax: 5 }),
                ],
              },
            }),
            0,
          ),
        () => {
          // a flying general who leads a flyer, where no flyer is raised and no tally is kept: the foot he can carry
          const prov = aProvince({ armyTypes: ['Strange Levies'] });
          const c = {
            id: 1,
            player: 0,
            alive: true,
            location: 0,
            race: 'Human',
            _botRole: 'skygeneral',
            armies: [{ type: 'Eagle Riders' }],
          };
          const L = aLedger();
          return [
            fn('botFieldRecruitTokensCore')(aWorld({ world: { provinces: [prov] }, characters: [c] }), 0, c, prov, L),
            L,
          ];
        },
        () => {
          // a court of a king and five heroes with no skills or units listed, at turn 5, holding four provinces: one defender
          const G = aWorld({
            turn: 5,
            world: { cols: 4, provinces: [0, 1, 2, 3].map((id) => aProvince({ id, col: id })) },
            characters: [
              { id: 1, player: 0, alive: true, isKing: true, location: 0, skills: { tactical: 5 }, armies: [] },
              ...[2, 3, 4, 5, 6].map((id) => ({ id, player: 0, alive: true, location: 0 })),
            ],
          });
          return [fn('botRoles')(G, 0), fn('botLedger')(G, 0)];
        },
        () => {
          // a court of five heroes who each lead three units and a king who leads none, at turn 5, where a flyer is raised:
          // the flying general is wanted, and none is free to be him
          const host = () => [1, 2, 3].map(() => ({ type: 'Shieldwall Levies' }));
          const G = aWorld({
            turn: 5,
            world: { provinces: [aProvince({ armyTypes: ['Eagle Riders'] })] },
            characters: [
              { id: 1, player: 0, alive: true, isKing: true, location: 0 },
              ...[2, 3, 4, 5, 6].map((id) => ({
                id,
                player: 0,
                alive: true,
                location: 0,
                skills: { tactical: 1 },
                armies: host(),
              })),
            ],
          });
          return fn('botRoles')(G, 0);
        },
        () => {
          // an admiral who leads no units listed
          const G = aWorld({
            world: {
              provinces: [
                aProvince({ armyTypes: ['Galleon Fleet'] }),
                aProvince({ id: 1, col: 1, terrain: 'sea', owner: null }),
              ],
            },
            players: [{ gold: 30 }],
            characters: [
              { id: 1, player: 0, alive: true, isKing: true, location: 0 },
              { id: 3, player: 0, alive: true, location: 0, skills: { naval: 2 } },
              {
                id: 4,
                player: 0,
                alive: true,
                location: 0,
                armies: [{ type: 'Galleon Fleet' }, { type: 'Shieldwall Levies' }, { type: 'Shieldwall Levies' }],
              },
              { id: 5, player: 0, alive: true, location: 0 },
            ],
          });
          return fn('botLedger')(G, 0);
        },
      ]),
    ).toBe(
      '[[0,false,[],{"generals":{},"heroes":{"2":{"turn":3,"provId":0,"units":0,"name":"Ser Vane","player":1,"isKing":false,"strength":0,"skillsKnown":false}}}],8,false,null,null,null,null,4,null,[],[{"g":{"id":4,"player":0,"location":2},"loc":2,"val":0}],null,null,2,1,[[],[],{"budget":40,"upkeep":0,"upkeepCap":40,"recruitedByProv":{"0":{}}},["Shieldwall Levies"]],["Shieldwall Levies","Strange Levies"],["Shieldwall Levies","Strange Levies"],["Elder Dragons","Shieldwall Levies"],["Shieldwall Levies","Elder Dragons"],["Shieldwall Levies","Elder Dragons"],2,[["Strange Levies|1"],{"budget":38,"upkeep":2,"upkeepCap":40,"recruitedByProv":{"0":{"Strange Levies":1}}}],[{"leaders":[1,2],"defenders":[3],"primaryId":1,"reach":5,"want":2},{"income":0,"warFooting":false,"upkeepCap":0,"upkeep":0,"budget":-3,"recruitedByProv":{},"rumourFund":0,"warChest":0,"diag":{"gold":0,"income":0,"reserve":3,"budget0":-3,"upkeep0":0,"cap":0,"calls":0,"noTypes":0,"noKin":0,"capStop":0,"budgetStop":0,"tokens":0,"holdersIdle":0,"holdersInRecruit":0,"navCap":0,"airCap":0},"defReserve":0,"navReserve":0,"airReserve":0,"nav":null,"air":null}],{"leaders":[2,3,4,5,6],"defenders":[],"primaryId":2,"reach":2,"want":5},{"income":0,"warFooting":false,"upkeepCap":12,"upkeep":7,"budget":27,"recruitedByProv":{},"rumourFund":0,"warChest":0,"diag":{"gold":30,"income":0,"reserve":3,"budget0":27,"upkeep0":7,"cap":16,"calls":0,"noTypes":0,"noKin":0,"capStop":0,"budgetStop":0,"tokens":0,"holdersIdle":0,"holdersInRecruit":0,"navCap":4,"airCap":0},"defReserve":0,"navReserve":0,"airReserve":0,"nav":{"cap":4,"upkeep":0,"id":3},"air":null}]',
    );
  });
  test("the empire's width: each province measured against every other, the next in the list too (P1-21j)", () => {
    const widthOf = (cols: readonly number[]) =>
      fn('botEmpireDiameter')(
        aWorld({ world: { cols: 10, rows: 1, provinces: cols.map((col, id) => aProvince({ id, col })) } }),
        0,
      );
    // two provinces three apart; then the widest pair next to each other in the list, a nearer one between
    expect([widthOf([0, 3]), widthOf([4, 0, 1])]).toEqual([3, 4]);
  });
});

describe('The Spring orders pass on what no matrix game hands it (P1-10b42)', () => {
  const runBotPhaseOne = engineFn(engine, 'runBotPhaseOne') as Fn;
  const step = engineFn(engine, 'botNeighbourProv') as Fn;
  const DIRS = ['NW', 'NE', 'W', 'E', 'SW', 'SE'];
  const hold = (desc = 'Hold'): Raw => ({ action: 'defend', target: '', extra: '', desc });
  /** The way from `a` to its neighbour `b`, as a march names it. */
  const way = (b: Board, from: Board['X'], to: Board['X']) =>
    DIRS[[0, 1, 2, 3, 4, 5].findIndex((i) => (step(b.G, from, i) as Board['X'] | null)?.id === to.id)] ?? '';
  /** A plan's orders in words, the heroes' numbers left out (they depend on the order the cases run in). */
  const words = (b: Board, id: number) =>
    must((b.G.turnOrders as unknown as Record<number, (Raw | null)[] | undefined>)[id], 'a plan').map((o) =>
      o === null ? '-' : `${String(o['action'])}|${String(o['target'])}|${String(o['desc'])}`.replace(/\d{4}/g, '#'),
    );
  const plans = (b: Board) => b.G.turnOrders as unknown as Record<number, Raw[]>;
  const relief = (more: (b: Board, h: Character, x: Character) => void = () => undefined) => {
    const { b } = fresh(() => ({ bots: [1] }));
    const B = b.X;
    const X = must(b.ring1[0], 'a neighbour');
    (B as unknown as Raw)['_battleUnresolved'] = true;
    const h = standAHero(b, { player: 1, at: B, troops: 2 });
    standAHero(b, { player: 0, at: B, troops: 2 });
    const x = standAHero(b, { player: 1, at: X, troops: 12 });
    plans(b)[h.id] = [hold(), hold(), hold(), hold(), hold()];
    plans(b)[x.id] = [hold(), hold(), hold(), hold(), hold()];
    more(b, h, x);
    runBotPhaseOne(b.G, new Set([1]), 'muster');
    return b.G.characters.filter((c) => c.player === 1).map((c) => words(b, c.id));
  };
  const feint = (more: (b: Board, g: Character, hero: Character) => void = () => undefined) => {
    const { b } = fresh(() => ({ bots: [1] }));
    const t1 = b.X;
    const S = must(b.ring1[0], 'a neighbour');
    const nbrsOfS = b.nbrs(S);
    const Xf = must(
      b.ring1.find((p) => p !== S && nbrsOfS.includes(p)),
      'a neighbour of both',
    );
    const A = must(
      b.ring2.find((p) => nbrsOfS.includes(p) && b.nbrs(Xf).includes(p)),
      'the ground beside both',
    );
    b.own(t1, 0);
    b.own(Xf, 0);
    b.own(A, 0);
    b.own(S, 1);
    const g = standAHero(b, { player: 1, at: S, troops: 5, skills: { melee: 2, tactical: 4, march: 1, spy: 0 } });
    const hero = standAHero(b, { player: 1, at: S });
    standAHero(b, { player: 0, at: Xf, troops: 14 });
    plans(b)[standAHero(b, { player: 1, at: Xf }).id] = [hold(), hold(), hold(), hold(), hold()]; // the realm's eyes there
    plans(b)[g.id] = [
      { action: 'move', target: 'dir:' + way(b, S, t1), extra: '', desc: 'Attack ' + t1.name },
      hold(),
      hold(),
      hold(),
      hold(),
    ];
    plans(b)[hero.id] = [hold(), hold(), hold(), hold(), hold()];
    more(b, g, hero);
    runBotPhaseOne(b.G, new Set([1]), 'order');
    return [words(b, g.id), words(b, hero.id)];
  };
  test('a host locked in battle is joined by an armed hero next door, with no list of units or plan beside him', () => {
    expect(
      JSON.stringify([
        relief(),
        relief((b, _h, x) => {
          // his march written with no words: he is marching already
          plans(b)[x.id] = [{ action: 'move', target: 'dir:NW', extra: '' }, hold(), hold(), hold(), hold()];
        }),
        relief((b) => {
          // a bystander of the realm with no list of units, and a plan
          const y = standAHero(b, { player: 1, at: must(b.ring1[1], 'a neighbour') });
          delete (y as unknown as Raw)['armies'];
          plans(b)[y.id] = [hold(), hold(), hold(), hold(), hold()];
        }),
      ]),
    ).toBe(
      '[[["-","-","-","-","-"],["defend||Hold","defend||Hold","defend||Hold","defend||Hold","defend||Hold"],["move|dir:SE|Reinforce Hero # in the battle for Wide Waters","defend||Hold","defend||Hold","defend||Hold","defend||Hold"]],[["-","-","-","-","-"],["defend||Hold","defend||Hold","defend||Hold","defend||Hold","defend||Hold"],["move|dir:NW|undefined","defend||Hold","defend||Hold","defend||Hold","defend||Hold"]],[["-","-","-","-","-"],["defend||Hold","defend||Hold","defend||Hold","defend||Hold","defend||Hold"],["move|dir:SE|Reinforce Hero # in the battle for Wide Waters","defend||Hold","defend||Hold","defend||Hold","defend||Hold"],["defend||Hold","defend||Hold","defend||Hold","defend||Hold","defend||Hold"]]]',
    );
  });
  test('a feint: a unit to a hero at the general’s side, to draw the enemy host off his target', () => {
    expect(
      JSON.stringify([
        feint(),
        feint((_b, _g, hero) => {
          delete (hero as unknown as Raw)['hp'];
        }),
        feint((b, _g, hero) => {
          // no host of the foe's beside the target: a second front, by a hero of no hit points listed
          b.G.characters
            .filter((c) => c.player === 0)
            .forEach((c) => {
              c.alive = false;
            });
          delete (hero as unknown as Raw)['hp'];
        }),
        feint((b, g) => {
          // the attack written after the hand-over's place: the feint is struck out
          plans(b)[g.id] = [hold('Watch'), ...must(plans(b)[g.id], 'his plan').slice(0, 4)];
        }),
      ]),
    ).toBe(
      '[[["leave_army|Men-at-Arms ##.0|Feint \u2014 Men-at-Arms ##.0 to Hero # to draw Hero # into Teeth Reef","move|dir:SE|Attack Wide Waters","defend||Hold","defend||Hold","defend||Hold"],["move|dir:NE|Feint on Teeth Reef (draw Hero # away from Wide Waters)","defend||Hold","defend||Hold","defend||Hold","defend||Hold"]],[["leave_army|Men-at-Arms ##.0|Feint \u2014 Men-at-Arms ##.0 to Hero # to draw Hero # into Teeth Reef","move|dir:SE|Attack Wide Waters","defend||Hold","defend||Hold","defend||Hold"],["move|dir:NE|Feint on Teeth Reef (draw Hero # away from Wide Waters)","defend||Hold","defend||Hold","defend||Hold","defend||Hold"]],[["leave_army|Men-at-Arms ##.0,Men-at-Arms ##.1|Second front \u2014 2 units to Hero # for Leviathan Abyss","move|dir:SE|Attack Wide Waters","defend||Hold","defend||Hold","defend||Hold"],["move|dir:NW|Attack Leviathan Abyss (second front)","defend||Hold Leviathan Abyss","defend||Hold Leviathan Abyss","defend||Hold Leviathan Abyss","defend||Hold Leviathan Abyss"]],[["leave_army|Men-at-Arms ##.0|Feint \u2014 Men-at-Arms ##.0 to Hero # to draw Hero # into Teeth Reef","defend||Watch","move|dir:SE|Attack Wide Waters","defend||Hold","defend||Hold"],["move|dir:NE|Feint on Teeth Reef (draw Hero # away from Wide Waters)","defend||Hold","defend||Hold","defend||Hold","defend||Hold"]]]',
    );
  });
  test('the pass on no realms and on a world that lacks its lists', () => {
    const results = (calls: readonly (() => unknown)[]) =>
      JSON.stringify(
        calls.map((f) => {
          try {
            const v = f();
            return v instanceof Map ? [...v] : v;
          } catch (e) {
            return `throws ${String(e).split(':')[0] ?? ''}`;
          }
        }),
      );
    const bare = (more: Raw = {}) => ({
      turn: 3,
      players: [{}, {}],
      relations: { '0-1': 'enemy' },
      turnOrders: {},
      ...more,
    });
    expect(
      results([
        () => runBotPhaseOne(bare({ world: { cols: 2, rows: 1, provinces: [] } }), null, 'order'),
        () => runBotPhaseOne(bare({ world: { cols: 2, rows: 1, provinces: [] } }), new Set(), 'order'),
        () => runBotPhaseOne(bare(), new Set([1]), 'order'),
        () => runBotPhaseOne(bare({ world: { cols: 2, rows: 1, provinces: [] } }), new Set([1]), 'muster'),
        () => runBotPhaseOne(bare({ world: { cols: 2, rows: 1, provinces: [] } }), new Set([1]), 'order'),
        () => (engineFn(engine, 'botPins') as Fn)(bare({ world: { cols: 2, rows: 1, provinces: [] } }), 1),
        () =>
          (engineFn(engine, 'botPins') as Fn)(
            bare({
              world: { cols: 2, rows: 1 },
              characters: [
                { id: 1, player: 0, alive: true, isKing: true, location: 0 },
                { id: 2, player: 1, alive: true, location: 0, skills: { elemental: 1 } },
              ],
            }),
            1,
          ),
        () =>
          (engineFn(engine, 'botPins') as Fn)(
            bare({
              world: { cols: 2, rows: 1, provinces: [{ id: 0, row: 0, col: 0, owner: 1, terrain: 'plains' }, null] },
              characters: [
                { id: 1, player: 0, alive: true, isKing: true, location: 0 },
                { id: 2, player: 1, alive: true, location: 0, skills: { elemental: 1 } },
              ],
            }),
            1,
          ),
      ]),
    ).toBe('[null,null,null,null,null,{},{},{}]');
  });
  test('a feint looks past a visiting host beside the target to the owner’s own (P1-21j)', () => {
    expect(
      JSON.stringify(
        feint((b) => {
          // a host of a second enemy realm stands in the foe's province, listed before the foe's own host
          b.G.relations['1-2'] = 'enemy';
          const foe = must(
            b.G.characters.find((c) => c.player === 0 && c.armies.length > 0),
            'the foe’s host',
          );
          const visitor = standAHero(b, {
            player: 2,
            at: must(b.G.world.provinces[foe.location], 'his province'),
            troops: 2,
          });
          b.G.characters = [visitor, ...b.G.characters.filter((c) => c !== visitor)];
        }),
      ),
    ).toBe(
      '[["leave_army|Men-at-Arms ##.0|Feint \u2014 Men-at-Arms ##.0 to Hero # to draw Hero # into Teeth Reef","move|dir:SE|Attack Wide Waters","defend||Hold","defend||Hold","defend||Hold"],["move|dir:NE|Feint on Teeth Reef (draw Hero # away from Wide Waters)","defend||Hold","defend||Hold","defend||Hold","defend||Hold"]]',
    );
  });
  test('a Master of March forces the second assault, never the last: of two back to back, the second; of three with a lightning strike second, none (P1-21j)', () => {
    const marchOf = (second: Raw, third: Raw = hold()) => {
      const { b } = fresh(() => ({ bots: [1] }));
      const g = standAHero(b, { player: 1, at: b.X, troops: 3, skills: { melee: 2, tactical: 2, march: 7, spy: 0 } });
      plans(b)[g.id] = [
        { action: 'move', target: 'dir:E', extra: '', desc: 'Attack the first' },
        second,
        third,
        hold(),
        hold(),
      ];
      runBotPhaseOne(b.G, new Set([1]), 'order');
      return words(b, g.id).slice(0, 3);
    };
    expect([
      marchOf({ action: 'move', target: 'dir:E', extra: '', desc: 'Attack the second' }),
      marchOf(
        { action: 'lightning_advance', target: 'dir:E', extra: '', desc: 'Lightning strike on the second' },
        { action: 'move', target: 'dir:E', extra: '', desc: 'Attack the third' },
      ),
    ]).toEqual([
      ['move|dir:E|Attack the first', 'forced_march|dir:E|Forced March \u2014 Attack the second', 'defend||Hold'],
      [
        'move|dir:E|Attack the first',
        'lightning_advance|dir:E|Lightning strike on the second',
        'move|dir:E|Attack the third',
      ],
    ]);
  });
  test('a garrison raised with an enemy host next door goes first in the year (P1-21j)', () => {
    const { b } = fresh(() => ({ bots: [1] }));
    const N = must(b.ring1[0], 'a neighbour');
    b.own(b.X, 1);
    const h = standAHero(b, { player: 1, at: b.X });
    standAHero(b, { player: 0, at: N, troops: 6 });
    plans(b)[standAHero(b, { player: 1, at: N }).id] = [hold(), hold(), hold(), hold(), hold()]; // the realm's eyes there
    plans(b)[h.id] = [
      hold(),
      hold(),
      { action: 'recruit', target: 'Men-at-Arms|2,to:garrison', extra: '', desc: 'Raise the garrison' },
      hold(),
      hold(),
    ];
    runBotPhaseOne(b.G, new Set([1]), 'order');
    expect(words(b, h.id)).toEqual([
      'recruit|Men-at-Arms|2,to:garrison|Raise the garrison',
      'defend||Hold',
      'defend||Hold',
      'defend||Hold',
      'defend||Hold',
    ]);
  });
  test('a Flood mage pins no more provinces than his school lets him cast (P1-21j)', () => {
    const { b } = fresh(() => ({ bots: [1] }));
    b.own(b.X, 1);
    const mage = standAHero(b, {
      player: 1,
      at: b.X,
      skills: { melee: 1, tactical: 1, march: 1, spy: 0, elemental: 1 },
    });
    for (const N of b.ring1.slice(0, 2)) {
      standAHero(b, { player: 0, at: N, troops: 6 });
      standAHero(b, { player: 1, at: N }); // the realm's eyes there
    }
    const pins = (engineFn(engine, 'botPins') as Fn)(b.G, 1) as Map<number, number>;
    expect([pins.size, [...pins.values()].every((id) => id === mage.id)]).toEqual([1, true]);
  });
});
describe('The spellcraft on what no matrix game hands it (P1-10b43)', () => {
  const fn = (name: string) => engineFn(engine, name) as unknown as Fn;
  const json = (v: unknown) => JSON.stringify(v);
  /** A world of one realm and the lists named, each other list missing; its map 2 by 1. */
  const aWorld = (lists: Record<string, unknown> = {}) => ({
    turn: 3,
    world: { cols: 2, rows: 1, ...((lists['world'] as object | undefined) ?? {}) },
    players: [{}],
    ...Object.fromEntries(Object.entries(lists).filter(([k]) => k !== 'world')),
  });
  const aProvince = (fields: Record<string, unknown> = {}) => ({
    id: 0,
    row: 0,
    col: 0,
    owner: 0,
    terrain: 'plains',
    name: 'Ashford',
    ...fields,
  });
  const results = (calls: readonly (() => unknown)[]) =>
    json(
      calls.map((f) => {
        try {
          const v = f();
          return v === undefined ? 'undefined' : v;
        } catch (e) {
          return `throws ${String(e).split(':')[0] ?? ''}`;
        }
      }),
    );
  test('a single best cast, read by no pass: the first of the plan, or none for a hero of no magic', () => {
    const { b } = fresh(() => ({ bots: [1] }));
    const mage = standAHero(b, { player: 1, at: b.X, skills: { psychic: 2 } });
    const plain = standAHero(b, { player: 1, at: b.X, skills: { melee: 1 } });
    standAHero(b, { player: 0, at: b.X, troops: 3 });
    standAHero(b, { player: 0, at: b.X, skills: { melee: NaN } });
    delete (standAHero(b, { player: 0, at: b.X }) as unknown as Raw)['skills'];
    const cast = (c: Character) => {
      const o = fn('botActionCast')(b.G, c) as Raw | null;
      return o === null ? null : `${String(o['action'])}|${String(o['desc'])}`.replace(/\d{4}/g, '#');
    };
    expect(results([() => cast(mage), () => cast(plain)])).toBe('["cast_spell|Cast Telekinetic Storm on Hero #",null]');
  });
  test("the titles a realm with no standings chases: by its own heroes' skills alone, each school, weapon and craft counted", () => {
    const skills = [
      { white: 3 },
      { psychic: 3 },
      { illusory: 3 },
      { elemental: 3 },
      { necromancy: 3 },
      { melee: 3, sage: 3 },
      { tactical: 3, sage: 3 },
      { march: 3, sage: 3 },
      { archery: 3, sage: 3 },
      { naval: 3 },
      { sage: 3 },
      { spy: 3 },
      { explorer: 3 },
      {},
    ];
    expect(
      results([
        ...skills.map(
          (s) => () =>
            fn('botTargetTitles')(
              aWorld({
                characters: [
                  null,
                  { id: 1, player: 0, alive: true, skills: s },
                  { id: 2, player: 1, alive: true, skills: { naval: 9 } },
                  { id: 3, player: 0 },
                ],
              }),
              0,
            ),
        ),
        () => fn('botTargetTitles')(aWorld({ players: [{ _botTitles: ['sea'] }] }), 0),
        () => fn('botTargetTitles')(aWorld(), 1),
      ]),
    ).toBe(
      '[["arch","marshal","monster"],["arch","marshal","monster"],["arch","marshal","monster"],["arch","marshal","monster"],["arch","marshal","monster"],["marshal","lore","monster"],["marshal","lore","monster"],["marshal","lore","monster"],["marshal","lore","monster"],["sea","marshal","monster"],["lore","marshal","monster"],["spy","marshal","monster"],["carto","marshal","monster"],["marshal","monster"],["sea"],[]]',
    );
  });
  test('the ratings, a title’s focus and a guardian weighed on a hero lacking his skills, his temper, his life or his things', () => {
    const G = aWorld({ characters: [] });
    const at =
      (c: Record<string, unknown>, m: unknown, ...more: unknown[]) =>
      () =>
        fn('botCanBeatGuardian')(c, m, ...more);
    expect(
      results([
        () => fn('botOffensiveMagic')({}),
        () => fn('botOffensiveMagic')({ skills: { elemental: 1, psychic: 2 } }),
        () => fn('botDuelRating')({}),
        () => fn('botDuelRating')({ maxHp: 0, temper: 'Berserk', items: [{}], skills: { melee: 1 } }),
        () => fn('botDuelRating')({ hp: 0, maxHp: 30, temper: 'Brave' }),
        () => fn('botTitleFocusSkill')({ skills: { naval: 2 } }, null),
        () =>
          fn('botTitleFocusSkill')({ skills: { naval: 2, melee: 5, sage: 1 } }, [
            'spy',
            'carto',
            'marshal',
            'lore',
            'sea',
          ]),
        () => fn('botTitleFocusSkill')({ skills: { white: 1, illusory: 3 } }, ['arch']),
        at({}, null),
        at({ maxHp: 99 }, { hp: 1 }),
        at({ skills: { melee: 2 }, maxHp: 99 }, { hp: 1 }),
        at({ id: 1 }, { hp: 10, power: 'Weak' }, G, null, { _rumourOdds: { null: { charId: 1, turn: 3, band: 200 } } }),
        at({ id: 1 }, { hp: 10, power: 'Weak' }, G, 0, { _rumourOdds: { 0: { charId: 1, turn: 3, band: 101 } } }),
        at({ id: 1 }, { hp: 10, power: 'Weak' }, G, 0, { _rumourOdds: { 0: { charId: 1, turn: 3, band: 100 } } }),
        at({ skills: { melee: 2, archery: 2 }, maxHp: 99 }, { hp: 1 }),
        at({ skills: { archery: 3 }, maxHp: 99 }, { hp: 1 }),
        at({ skills: { melee: 3 }, maxHp: 0 }, { hp: 0, power: 'Strange' }),
        at({ skills: { melee: 3 }, maxHp: 0 }, { hp: 25, power: '' }),
        at({ skills: { melee: 3 }, maxHp: 15 }, { hp: 0, power: 'Moderate' }),
        at({ skills: { melee: 3, tactical: 1, archery: 1, elemental: 1 }, maxHp: 21 }, { hp: 20, power: 'Moderate' }),
        at({ skills: { melee: 3, tactical: 1, archery: 1, elemental: 1 }, maxHp: 20 }, { hp: 20, power: 'Moderate' }),
        at({ skills: { melee: 3, necromancy: 1, psychic: 1 }, maxHp: 20 }, { hp: 20, power: 'Moderate' }),
      ]),
    ).toBe(
      '[0,3,20,35,4,null,"sage","illusory",true,false,false,true,true,false,false,true,true,true,true,true,false,false]',
    );
  });
  test('a lair to raid: none for no province or none listed; a gap, a guardian of no power and one of a power no table names', () => {
    const G = aWorld({ characters: [] });
    const lairs = aProvince({
      features: [
        null,
        { discovered: true, cleared: true, monster: null },
        { discovered: true, ritualSite: true, monster: null },
        { discovered: true, discoveredBy: [0], monster: null },
        {
          discovered: true,
          discoveredBy: [0],
          monster: { hp: 10, power: 'Strange' },
          _rumourOdds: { 0: { charId: 1, turn: 3, band: 101 } },
        },
        {
          discovered: true,
          discoveredBy: [0],
          monster: { hp: 10, power: 'Moderate' },
          _rumourOdds: { 0: { charId: 1, turn: 3, band: 101 } },
        },
      ],
    });
    expect(
      results([
        () => fn('botBeatableLairIn')(G, { id: 1, player: 0 }, null),
        () => fn('botBeatableLairIn')(G, { id: 1, player: 0 }, aProvince()),
        () => fn('botBeatableLairIn')(G, { id: 1, player: 0 }, lairs),
        () => fn('botBeatableLairIn')(G, { id: 1 }, lairs),
        () => fn('botBeatableLairIn')(G, null, lairs),
        () => fn('botBeatableLair')(aWorld({ world: { provinces: [lairs] } }), { id: 1, player: 0, location: 0 }),
      ]),
    ).toBe('[-1,-1,5,3,"throws TypeError",5]');
  });
  test('a march planned, a path and a quarry on a world lacking its lists or a hero his plan', () => {
    const P0 = aProvince();
    const P1 = aProvince({ id: 1, col: 1 });
    const G = aWorld({ world: { provinces: [P0, P1] }, turnOrders: {}, characters: [] });
    expect(
      results([
        () => fn('botPlannedAttackTarget')(G, { id: 1, location: 0 }),
        () => fn('botPlannedAttackTarget')(G, { id: 1, location: 5 }),
        () =>
          fn('botPlannedAttackTarget')(
            aWorld({
              world: { provinces: [P0, P1] },
              turnOrders: {
                1: [
                  null,
                  { action: 'defend' },
                  { action: 'move', target: 1, desc: '' },
                  { action: 'move', target: 0, desc: 'Attack Ashford' },
                ],
              },
            }),
            { id: 1, location: 0 },
          ),
        () => fn('botPathAny')(G, P0, 1, 3),
        () => fn('botPathAny')(G, P0, 0, 3),
        () => fn('botPathAny')(G, null, 1, 3),
        () => fn('botPathAny')(G, P0, null, 3),
        () => fn('botPathAny')(G, P0, 1, 0),
        () => fn('botPathLenAny')(G, P0, 1, 3),
        () => fn('botPathLenAny')(G, P0, 7, 3),
        () => fn('botHuntTarget')(G, 0, { skills: {}, location: 0 }, 3, null),
        () => fn('botHuntTarget')(G, 0, { skills: { melee: 3 }, location: 9 }, 3, null),
        () =>
          fn('botHuntTarget')(
            aWorld({ world: { provinces: [P0] } }),
            0,
            { skills: { archery: 3 }, location: 0 },
            3,
            null,
          ),
        () =>
          fn('botHuntTarget')(
            aWorld({
              turn: 0,
              world: { provinces: [P0, P1] },
              relations: { '0-1': 'enemy' },
              players: [{ _botIntel: { generals: {}, heroes: { 5: { turn: 0, provId: 1, units: 0 } } } }, {}],
              characters: [{ id: 5, player: 1, alive: true, location: 1 }],
            }),
            0,
            { id: 1, player: 0, skills: { melee: 3 }, location: 0, maxHp: 40 },
            3,
            null,
          ),
        () => fn('botRaidTarget')(aWorld(), 0, P0, 3),
        () => fn('botRaidTarget')(aWorld({ world: { provinces: [null, P1] } }), 0, P0, 3),
      ]),
    ).toBe('[null,null,0,[2],[],null,null,null,1,null,null,null,null,null,null,null]');
  });
  test('a cast plan with no choices or no province, and the cross-training on a world lacking its lists', () => {
    const P0 = aProvince();
    expect(
      results([
        () => fn('botCastPlan')(aWorld(), 0, { skills: {} }, null, null),
        () =>
          fn('botCastPlan')(
            aWorld({ world: { provinces: [P0] }, relations: {} }),
            0,
            { id: 1, skills: {}, location: 0 },
            P0,
            null,
          ),
        () =>
          fn('botCastPlan')(
            aWorld({
              world: { provinces: [P0] },
              relations: {},
              players: undefined,
              characters: [null, { id: 2, player: 0, alive: true, isKing: true, location: 0 }],
            }),
            0,
            { id: 1, skills: { white: 1 }, location: 0 },
            P0,
            { max: 0 },
          ),
        () =>
          fn('botCastPlan')(
            aWorld({
              world: { provinces: [P0] },
              relations: {},
              players: [{ alignment: 'Divine' }],
              characters: [{ id: 2, player: 0, alive: true, isKing: true, location: 0 }],
            }),
            0,
            { id: 1, skills: { white: 1 }, location: 0 },
            P0,
            null,
          ),
        () => fn('botCrossTrainSkill')(aWorld(), { id: 1, location: 0 }, 0),
        () =>
          fn('botCrossTrainSkill')(
            aWorld({
              turnOrders: {},
              characters: [
                null,
                { id: 1, player: 0, alive: true, location: 0, skills: { sage: 1 } },
                { id: 2, player: 0, alive: true, location: 0 },
              ],
            }),
            { id: 1, location: 0, skills: { sage: 1 } },
            0,
          ),
      ]),
    ).toBe(
      '[[],[],"throws TypeError",[{"action":"cast_spell","target":"Bless Province","extra":"0","desc":"Cast Bless Province on Ashford"}],null,"sage"]',
    );
  });
  test("the actions pass on no realms, on a world of no map, with no orders or a hero's life unknown", () => {
    const P0 = aProvince();
    const play = (G: Raw) => {
      fn('runBotActions')(G, new Set([0]));
      return G['turnOrders'];
    };
    expect(
      results([
        () => fn('runBotActions')(aWorld(), null),
        () => fn('runBotActions')(aWorld(), new Set()),
        () => fn('runBotActions')({ players: [{}] }, new Set([0])),
        () => play(aWorld({ world: { provinces: [P0] } })),
        () =>
          play(
            aWorld({
              world: { provinces: [P0] },
              characters: [null, { id: 1, player: 0, alive: true, location: 0, hp: 5, maxHp: 20 }],
            }),
          ),
        () =>
          play(
            aWorld({ world: { provinces: [P0] }, characters: [{ id: 1, player: 0, alive: true, location: 0, hp: 5 }] }),
          ),
        () =>
          play(
            aWorld({
              world: { provinces: [P0] },
              characters: [{ id: 1, player: 0, alive: true, location: 0, armies: [null] }],
            }),
          ),
        () =>
          play(
            aWorld({
              world: { provinces: [P0] },
              characters: [{ id: 1, player: 0, alive: true, location: 0, hp: 20, maxHp: 20 }],
            }),
          ),
        () =>
          fn('botFillOrders')(
            aWorld({ world: { provinces: [P0] }, characters: [] }),
            0,
            { id: 1, location: 0, skills: {} },
            [],
            [],
          ),
      ]),
    ).toBe(
      '["undefined","undefined","undefined",{},{"1":[{"action":"rest","target":"","extra":"","desc":"Rest & heal"},{"action":"rest","target":"","extra":"","desc":"Rest & heal"},{"action":"rest","target":"","extra":"","desc":"Rest & heal"},{"action":"rest","target":"","extra":"","desc":"Rest & heal"},{"action":"rest","target":"","extra":"","desc":"Rest & heal"}]},{"1":[{"action":"rest","target":"","extra":"","desc":"Rest & heal"},{"action":"rest","target":"","extra":"","desc":"Rest & heal"},{"action":"rest","target":"","extra":"","desc":"Rest & heal"},{"action":"rest","target":"","extra":"","desc":"Rest & heal"},{"action":"rest","target":"","extra":"","desc":"Rest & heal"}]},{"1":[{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"}]},{"1":[{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"}]},[{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"}]]',
    );
  });
  test('a spy’s target and the practice fallback on a world lacking its players’ records or a province its map', () => {
    const P0 = aProvince();
    expect(
      results([
        () => fn('botSpyTarget')(aWorld({ world: { provinces: [P0] } }), 0, { id: 1, location: 5 }, 3),
        () => fn('botSpyTarget')(aWorld({ world: { provinces: [P0] }, characters: [] }), 0, { id: 1, location: 0 }, 3),
        () =>
          fn('botSpyTarget')(
            aWorld({ world: { provinces: [P0] }, characters: [], players: undefined }),
            0,
            { id: 1, location: 0 },
            3,
          ),
        () =>
          fn('botSpyTarget')(
            aWorld({
              world: { provinces: [aProvince({ owner: 1 }), aProvince({ id: 1, col: 1 })] },
              players: [{ _botSpyMemo: { 0: 0 } }, {}],
              relations: { '0-1': 'enemy' },
              characters: [{ id: 1, player: 0, alive: true, location: 0 }],
            }),
            0,
            { id: 1, player: 0, location: 0 },
            3,
          ),
        () =>
          fn('botPracticeFallback')(aWorld({ world: { provinces: [P0] }, characters: [] }), 0, {
            id: 1,
            location: 0,
            skills: {},
          }),
        () =>
          fn('botPracticeFallback')(
            aWorld({ world: { provinces: [P0] }, characters: [] }),
            0,
            { id: 1, location: 0, skills: {} },
            { moving: true },
          ),
        () =>
          fn('botPracticeFallback')(
            aWorld({ world: { provinces: [aProvince({ exploredBy: { 0: 100 } })] }, characters: [] }),
            0,
            { id: 1, location: 0, skills: { sage: 5 } },
          ),
      ]),
    ).toBe(
      '[null,null,null,{"X":{"id":0,"row":0,"col":0,"owner":1,"terrain":"plains","name":"Ashford"},"d":0,"sc":14},{"action":"explore","target":"","extra":"","desc":"Explore Ashford"},{"action":"practice","target":"melee","extra":"","desc":"Practice Melee"},{"action":"practice","target":"melee","extra":"","desc":"Practice Melee"}]',
    );
  });
});
