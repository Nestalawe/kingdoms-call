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
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
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
import { board, must, type Board, type Character } from '../lib/middle-of-a-bot-world.ts';

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
  test('the concessions are handed the GM’s log itself, and the Reckoning the realms’ calls themselves', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const [calls] = standIn(PASSES, () => plan(tc), QUIET);
    const third = (f: string) => calls.find((c) => c.fn === f)?.args[2];
    expect(third('runBotConcessions')).toBe(tc['log']);
    expect(third('runBotReckoning')).toBe(tc['reckoningCalls']);
  });
  test('a pass that writes to what it is handed writes to the turn’s own: the log’s lines and a call added are the turn’s', () => {
    const { tc } = fresh(() => ({ bots: [1] }));
    const lines = (tc['turnLog'] as unknown[]).length;
    standIn(PASSES, () => plan(tc), {
      ...QUIET,
      runBotConcessions: (_G: unknown, _set: unknown, log: unknown) => {
        (log as Fn)('system', 'a line', { actor: null, targets: [], system: true });
      },
      runBotReckoning: (_G: unknown, _set: unknown, calls: unknown) => (calls as Set<number>).add(2),
    });
    expect((json(tc['turnLog']) as { text: string }[]).slice(lines).map((l) => l.text)).toEqual(['a line']);
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
