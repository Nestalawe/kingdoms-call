// The bots' diplomacy (plan P1-08l1: src/engine/bots/, lifted out of resolveTurn), called directly in the bare vm on the
// middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases scenario/bot-diplomacy-in-a-whole-turn plays
// through a whole turn (lib/bot-diplomacy-cases.ts), here played through the function alone, twice, the way resolveTurn
// calls the function (the phases between aside); then where resolveTurn calls the function, and the rivals handed (each bot's, as met when
// the turn began); then, with the helpers it calls stood in (each replaced in the vm by a recorder for the test's
// length), what it hands them; then what a whole turn can't stage: a declaration from a seat that is not a realm's, a
// grudge against a seat the game lacks, a gap in the realms' list, a bot's rivals missing from the context, realms of
// no creed and a claim, a game with no turn counter. Properties (fast-check): only bots' declarations are written, each
// a Treat or a war, never toward itself, a realm not met when the turn began, a realm that has conceded or has neither
// king nor land; never war on a foe or a Treat to an ally; a Treat to a realm held in a grudge only under a truce; every
// human realm's war on a bot remembered once, after the grudges held; under Safe Start nothing at all.
// Level 1: one function, called with the context resolveTurn hands it.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import {
  BOT_DIPLOMACY,
  BOT_DIPLOMACY_CASES,
  LANDS,
  claim,
  conceded,
  creed,
  crownless,
  directCase,
  grudge,
  landless,
  ready,
  realm,
  relate,
  safeStart,
  stageCase,
  truce,
  aggressive,
  type BotDiplomacyCase,
  type Declarations,
  type Staged,
} from '../lib/bot-diplomacy-cases.ts';
import { rows } from '../lib/before-the-first-phase-cases.ts';
import { board, must, type Board } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
type Raw = Record<string, unknown>;
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const inVm = vm.runInContext('(j)=>JSON.parse(j)', engine) as (j: string) => unknown;
const botDiplomacy = (tc: unknown) => {
  (engineFn(engine, BOT_DIPLOMACY) as (t: unknown) => void)(tc);
};
const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v ?? null));

const NOTHING: BotDiplomacyCase = {
  name: 'nothing staged',
  stage: () => ({ bots: [] }),
  check: () => ({ got: {}, want: {} }),
};
/** A board staged as every case is (`stageCase`), staged further by `more`, and readied for the function. */
const fresh = (more: (b: Board) => Staged) => {
  const b = board(engine, world, 0);
  const s = stageCase(b, { ...NOTHING, stage: more });
  const tc = ready(b, s);
  return { b, tc, s };
};
const declarations = (tc: Raw) => json(tc['diploDeclarations']) as Declarations;

/** The cases a direct call can stage, by part (those about the second declarations after the phases need a turn). */
const DIRECT_CASES = BOT_DIPLOMACY_CASES.map(
  ([part, cases]) => [part, cases.filter((c) => !c.wholeTurnOnly)] as const,
).filter(([, cases]) => cases.length > 0);
describe.each(DIRECT_CASES)('%s, the function called directly', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = c.check(directCase(b, c, s), s);
    expect(got).toEqual(want);
  });
});

// ── Where resolveTurn calls it, and what it is handed ────────────────────────────────────────────────────────────
interface Call {
  fn: string;
  args: unknown[];
}
/** Runs `body` with each of `names` replaced by a recorder (in the vm, for the body's length) that calls `instead` for
 *  it if given, or the function it stands in for. */
function standIn(names: string[], body: () => void, instead: Record<string, Fn> = {}): Call[] {
  const g = engine;
  const was = names.map((f) => [f, g[f] as Fn] as const);
  const calls: Call[] = [];
  for (const [f, w] of was)
    g[f] = (...args: unknown[]) => {
      calls.push({ fn: f, args });
      return (instead[f] ?? w)(...args);
    };
  try {
    body();
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
  return calls;
}
const FIRST = 'relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks';
const WAR_WITHOUT_WARNING = 'warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages';
const AFTER_THE_PHASES = 'afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames';
const DIPLOMACY = 'diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings';
const MERGE = 'mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans';
const FIRST_PHASE = 'startPhaseHealingSnapshotsAndStalledBattles';
const playWith = (b: Board, s: Staged) => {
  const resolveTurn = engineFn(engine, 'resolveTurn') as (st: string, r: unknown, t: number) => unknown;
  withCaseDice(engine, LANDS, () => resolveTurn(JSON.stringify(b.G), inVm(rows(b, s)), b.G.turn));
};

describe('Where resolveTurn calls it', () => {
  test('twice, with the turn’s context: between the research choices and war without warning, and between the stages after the phases and diplomacy', () => {
    const b = board(engine, world, 0);
    const s = stageCase(b, { ...NOTHING, stage: () => ({ bots: [1] }) });
    const names = [MERGE, FIRST, BOT_DIPLOMACY, WAR_WITHOUT_WARNING, FIRST_PHASE, AFTER_THE_PHASES, DIPLOMACY];
    const calls = standIn(names, () => {
      playWith(b, s);
    });
    const order = calls.map((c) => c.fn).filter((f, i, a) => f !== a[i - 1]);
    expect(order).toEqual([
      MERGE,
      FIRST,
      BOT_DIPLOMACY,
      WAR_WITHOUT_WARNING,
      FIRST_PHASE,
      AFTER_THE_PHASES,
      BOT_DIPLOMACY,
      DIPLOMACY,
    ]);
    const mine = calls.filter((c) => c.fn === BOT_DIPLOMACY);
    const tc = must(calls[0], 'the merge').args[0];
    expect(mine.map((c) => c.args.length)).toEqual([1, 1]);
    expect(mine.every((c) => c.args[0] === tc)).toBe(true);
  });
  test('the rivals it is handed are each bot realm’s, as met when the turn began: a copy, made before the merge, kept for the turn', () => {
    const b = board(engine, world, 0);
    const s = stageCase(b, {
      ...NOTHING,
      stage: (bb) => {
        realm(bb, 1)['_encountered'] = [2, 0];
        realm(bb, 2)['_encountered'] = [0];
        return { bots: [1, 2] };
      },
    });
    const seen: unknown[] = [];
    const realMerge = engine[MERGE] as Fn;
    standIn(
      [MERGE, BOT_DIPLOMACY],
      () => {
        playWith(b, s);
      },
      {
        [MERGE]: (tc: unknown) => {
          const t = tc as Raw;
          seen.push(json(t['_botEncounteredAtStart']));
          // the realm's record of whom it met changes in place after the turn's start: the rivals were taken before
          const met = must((t['G'] as Board['G']).players[1], 'realm 1')['_encountered'] as number[];
          met.splice(0, met.length, 0);
          realMerge(tc);
        },
        [BOT_DIPLOMACY]: (tc: unknown) => {
          const t = tc as Raw;
          const m = t['_botEncounteredAtStart'] as Record<string, unknown[]>;
          const G = t['G'] as Board['G'];
          seen.push([json(m), m['1'] === must(G.players[1], 'realm 1')['_encountered']]);
        },
      },
    );
    expect(seen).toEqual([{ 1: [2, 0], 2: [0] }, [{ 1: [2, 0], 2: [0] }, false], [{ 1: [2, 0], 2: [0] }, false]]);
  });
  test('a human realm’s rivals are not among them', () => {
    const b = board(engine, world, 0);
    const s = stageCase(b, { ...NOTHING, stage: () => ({ bots: [2] }) });
    const seen: unknown[] = [];
    standIn(
      [BOT_DIPLOMACY],
      () => {
        playWith(b, s);
      },
      { [BOT_DIPLOMACY]: (tc: unknown) => seen.push(Object.keys((tc as Raw)['_botEncounteredAtStart'] as Raw)) },
    );
    expect(seen).toEqual([['2'], ['2']]);
  });
});

describe('What it hands the helpers it calls', () => {
  test('Safe Start is asked of the game and the turn being played, before anything else', () => {
    const { b, tc } = fresh((bb) => {
      relate(bb, {});
      return { bots: [1] };
    });
    const calls = standIn(['safeStartLocked', 'botAlignFriendly'], () => {
      botDiplomacy(tc);
    });
    expect(calls.map((c) => c.fn)).toEqual(['safeStartLocked', 'botAlignFriendly', 'botAlignFriendly']);
    const first = must(calls[0], 'the first call');
    expect(first.args[0]).toBe(b.G);
    expect(first.args[1]).toBe(b.G.turn);
  });
  test('the relations are read through the turn’s context; the creeds, strengths and the assessment from the state', () => {
    const { b, tc } = fresh((bb) => {
      relate(bb, { '1-2': 'enemy' });
      creed(bb, 2, 'Evil');
      grudge(bb, 1, 2);
      return { bots: [1] };
    });
    const calls = standIn(
      ['relationBetween', 'areAllied', 'botAlignFriendly', 'botOwnPower', 'botRivalPower', 'botWarAssess'],
      () => {
        botDiplomacy(tc);
      },
      { botOwnPower: () => 10, botRivalPower: () => 10, botWarAssess: () => ({ decision: null }) },
    );
    const byContext = new Set(['relationBetween', 'areAllied']);
    expect(calls.filter((c) => c.args[0] !== (byContext.has(c.fn) ? tc : b.G)).map((c) => c.fn)).toEqual([]);
    expect(calls.filter((c) => byContext.has(c.fn)).length).toBeGreaterThan(0);
    expect(calls.filter((c) => c.fn === 'botOwnPower').map((c) => c.args.slice(1))).toEqual([[1]]);
    expect(calls.filter((c) => c.fn === 'botRivalPower').map((c) => c.args.slice(1))).toEqual([[1, 2]]);
    expect(calls.filter((c) => c.fn === 'botAlignFriendly').map((c) => c.args.slice(1))).toEqual([
      [1, 0],
      [1, 2],
    ]);
    expect(calls.filter((c) => c.fn === 'botWarAssess').map((c) => [c.args[1], c.args[2], json(c.args[3])])).toEqual([
      [1, 2, { offeredPeace: false }],
    ]);
  });
  test('the assessment is told a peace was offered only by a Treat from that rival to that bot', () => {
    const { tc } = fresh((bb) => {
      relate(bb, { '0-1': 'enemy', '1-2': 'enemy' });
      creed(bb, 0, 'Evil');
      creed(bb, 2, 'Evil');
      return { bots: [1], sends: { 0: { diplomacy: { 2: 'treat' } }, 2: { diplomacy: { 1: 'treat' } } } };
    });
    const calls = standIn(
      ['botWarAssess'],
      () => {
        botDiplomacy(tc);
      },
      { botWarAssess: () => ({ decision: null }) },
    );
    expect(calls.map((c) => [c.args[2], json(c.args[3])])).toEqual([
      [0, { offeredPeace: false }],
      [2, { offeredPeace: true }],
    ]);
  });
  test('a war from that rival is no peace offered', () => {
    const { tc } = fresh((bb) => {
      relate(bb, { '1-2': 'enemy' });
      creed(bb, 2, 'Evil');
      return { bots: [1], sends: { 2: { diplomacy: { 1: 'enemy' } } } };
    });
    const calls = standIn(
      ['botWarAssess'],
      () => {
        botDiplomacy(tc);
      },
      { botWarAssess: () => ({ decision: null }), botOwnPower: () => 1, botRivalPower: () => 1 },
    );
    expect(calls.map((c) => json(c.args[3]))).toEqual([{ offeredPeace: false }]);
  });
});

// ── What a whole turn can't stage ────────────────────────────────────────────────────────────────────────────────
describe('What a whole turn can’t stage', () => {
  test('a declaration from a seat that is not a realm’s whole number is passed over: no grudge, no harm', () => {
    const { b, tc } = fresh(() => ({ bots: [1] }));
    (tc['diploDeclarations'] as Raw)['x'] = { 1: 'enemy' };
    (tc['diploDeclarations'] as Raw)['0.5'] = { 1: 'enemy' };
    botDiplomacy(tc);
    expect(realm(b, 1)['botGrudges']).toBeUndefined();
  });
  test('a declaration of war on a bot seat the save lacks records nothing', () => {
    const { b, tc } = fresh(() => ({ bots: [1, 5] }));
    (tc['diploDeclarations'] as Raw)['0'] = { 5: 'enemy' };
    botDiplomacy(tc);
    expect(b.G.players.map((p) => (p as Raw)['botGrudges'] ?? null)).toEqual([null, null, null]);
  });
  test('a declaration of war on a human realm records no grudge, even from another human realm', () => {
    const { b, tc } = fresh(() => ({ bots: [1] }));
    (tc['diploDeclarations'] as Raw)['0'] = { 2: 'enemy' };
    botDiplomacy(tc);
    expect(realm(b, 2)['botGrudges']).toBeUndefined();
  });
  test('a bot seat the save lacks declares nothing and stops nothing', () => {
    const { tc } = fresh((bb) => {
      relate(bb, {});
      return { bots: [1, 7] };
    });
    (tc['_botEncounteredAtStart'] as Raw)['7'] = [0, 1];
    botDiplomacy(tc);
    expect(declarations(tc)['7']).toBeUndefined();
    expect(declarations(tc)['1']).toEqual({ 0: 'treat', 2: 'treat' });
  });
  test('a gap in the realms’ list: no declaration toward it, no harm', () => {
    const { b, tc } = fresh((bb) => {
      relate(bb, {});
      return { bots: [1] };
    });
    (b.G.players as unknown[])[2] = null;
    botDiplomacy(tc);
    expect(declarations(tc)['1']).toEqual({ 0: 'treat' });
  });
  test('a bot whose rivals are missing from the context declares nothing', () => {
    const { tc } = fresh((bb) => {
      relate(bb, {});
      return { bots: [1, 2] };
    });
    delete (tc['_botEncounteredAtStart'] as Raw)['1'];
    botDiplomacy(tc);
    expect(declarations(tc)['1']).toEqual({});
    expect(declarations(tc)['2']).toEqual({ 0: 'treat', 1: 'treat' });
  });
  test('the rivals are read from the context, not from the realm’s record as it stands', () => {
    const { b, tc } = fresh((bb) => {
      relate(bb, {});
      return { bots: [1] };
    });
    realm(b, 1)['_encountered'] = [];
    botDiplomacy(tc);
    expect(declarations(tc)['1']).toEqual({ 0: 'treat', 2: 'treat' });
  });
  test('realms of no creed: a bot allied to a claimant keeps no faith with him (a creed must be named to be shared)', () => {
    const { b, tc } = fresh((bb) => {
      relate(bb, { '1-2': 'allied' });
      claim(bb, 2, [2], bb.G.turn + 2, 50);
      return { bots: [1] };
    });
    delete realm(b, 1)['alignment'];
    delete realm(b, 2)['alignment'];
    botDiplomacy(tc);
    expect(declarations(tc)['1']).toEqual({ 0: 'treat', 2: 'enemy' });
  });
  test('a claim whose claimant is not named counts for nothing', () => {
    const { b, tc } = fresh((bb) => {
      relate(bb, {});
      return { bots: [1] };
    });
    (b.G as unknown as Raw)['reckoning'] = { by: null };
    botDiplomacy(tc);
    expect(declarations(tc)['1']).toEqual({ 0: 'treat', 2: 'treat' });
  });
  test('a game with no turn counter dates a truce turn 0', () => {
    const { b, tc } = fresh((bb) => {
      relate(bb, { '1-2': 'enemy' });
      grudge(bb, 1, 2);
      return { bots: [1] };
    });
    delete (b.G as unknown as Raw)['turn'];
    standIn(
      ['botOwnPower', 'botRivalPower'],
      () => {
        botDiplomacy(tc);
      },
      { botOwnPower: () => 1, botRivalPower: () => 10 },
    );
    expect(realm(b, 1)['_botGrudgeTruce']).toEqual({ 2: 0 });
  });
  test('a truce the record already holds keeps its date while it holds', () => {
    const { b, tc } = fresh((bb) => {
      relate(bb, { '1-2': 'enemy' });
      grudge(bb, 1, 2);
      truce(bb, 1, 2, 2);
      return { bots: [1] };
    });
    standIn(
      ['botOwnPower', 'botRivalPower'],
      () => {
        botDiplomacy(tc);
      },
      { botOwnPower: () => 1, botRivalPower: () => 3 },
    );
    expect(realm(b, 1)['_botGrudgeTruce']).toEqual({ 2: 2 });
  });
  test('a truce is renewed to this turn while the human is five times the bot’s strength', () => {
    const { b, tc } = fresh((bb) => {
      relate(bb, { '1-2': 'enemy' });
      grudge(bb, 1, 2);
      truce(bb, 1, 2, 2);
      bb.G.turn = 9;
      return { bots: [1] };
    });
    standIn(
      ['botOwnPower', 'botRivalPower'],
      () => {
        botDiplomacy(tc);
      },
      { botOwnPower: () => 2, botRivalPower: () => 10 },
    );
    expect(realm(b, 1)['_botGrudgeTruce']).toEqual({ 2: 9 });
  });
  test('it writes no line to the log', () => {
    const { tc } = fresh((bb) => {
      relate(bb, {});
      aggressive(bb);
      return { bots: [1, 2], sends: { 0: { diplomacy: { 1: 'enemy' } } } };
    });
    const before = (tc['turnLog'] as unknown[]).length;
    botDiplomacy(tc);
    expect((tc['turnLog'] as unknown[]).length).toBe(before);
  });
});

// ── Properties ───────────────────────────────────────────────────────────────────────────────────────────────────
const CREEDS = ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead'];
const RELATIONS = ['enemy', 'neutral', 'allied'] as const;
const DECISIONS = [null, 'war', 'peace'] as const;
const realmSpec = fc.record({
  bot: fc.boolean(),
  creed: fc.constantFrom(...CREEDS),
  conceded: fc.boolean(),
  crownless: fc.boolean(),
  landless: fc.boolean(),
  met: fc.subarray([0, 1, 2]),
  grudges: fc.subarray([0, 1, 2]),
  truces: fc.subarray([0, 1, 2]),
  sends: fc.dictionary(fc.constantFrom('0', '1', '2'), fc.constantFrom('treat', 'enemy')),
  own: fc.integer({ min: 0, max: 60 }),
});
const worldSpec = fc.record({
  realms: fc.tuple(realmSpec, realmSpec, realmSpec),
  relations: fc.tuple(fc.constantFrom(...RELATIONS), fc.constantFrom(...RELATIONS), fc.constantFrom(...RELATIONS)),
  aggressive: fc.boolean(),
  safeStart: fc.boolean(),
  claimBy: fc.constantFrom(-1, 0, 1, 2),
  rivalPower: fc.integer({ min: 0, max: 120 }),
  decisions: fc.array(fc.constantFrom(...DECISIONS), { minLength: 9, maxLength: 9 }),
});
type WorldSpec = typeof worldSpec extends fc.Arbitrary<infer T> ? T : never;
const PAIRS = ['0-1', '0-2', '1-2'];
const stageWorld = (w: WorldSpec) =>
  fresh((bb) => {
    relate(
      bb,
      Object.fromEntries(
        PAIRS.map((k, i) => [k, w.relations[i]] as const).filter(
          (e): e is [string, 'enemy' | 'allied'] => e[1] !== 'neutral',
        ),
      ),
    );
    if (w.aggressive) aggressive(bb);
    if (w.safeStart) safeStart(bb);
    w.realms.forEach((r, pi) => {
      creed(bb, pi, r.creed);
      realm(bb, pi)['_encountered'] = r.met.filter((x) => x !== pi);
      if (r.grudges.length) grudge(bb, pi, ...r.grudges.filter((x) => x !== pi));
      r.truces
        .filter((x) => x !== pi)
        .forEach((x) => {
          truce(bb, pi, x, 1);
        });
      if (r.conceded) conceded(bb, pi);
      if (r.crownless) crownless(bb, pi);
      if (r.landless) landless(bb, pi);
    });
    if (w.claimBy >= 0) claim(bb, w.claimBy, [w.claimBy], bb.G.turn + 2, 50);
    const bots = w.realms.flatMap((r, pi) => (r.bot ? [pi] : []));
    const sends = Object.fromEntries(
      w.realms.flatMap((r, pi) =>
        r.bot
          ? []
          : [[pi, { diplomacy: Object.fromEntries(Object.entries(r.sends).filter(([k]) => k !== String(pi))) }]],
      ),
    );
    return { bots, sends };
  });
/** Plays the function once on `w`, its strengths and assessments stood in as the world says; what it wrote. */
const playWorld = (w: WorldSpec) => {
  const { b, tc, s } = stageWorld(w);
  const before = declarations(tc);
  const grudgesBefore = b.G.players.map((p) => json((p as Raw)['botGrudges'] ?? null));
  const relations = json(b.G.relations) as Record<string, string>;
  const atStart = json(tc['_botEncounteredAtStart']) as Record<string, number[]>;
  const kings = new Set(b.G.characters.filter((c) => c.alive && c.isKing && c.player != null).map((c) => c.player));
  const lands = b.G.players.map((p) => p.provinces.length > 0);
  const players = json(b.G.players) as Raw[];
  standIn(
    ['botOwnPower', 'botRivalPower', 'botWarAssess'],
    () => {
      botDiplomacy(tc);
    },
    {
      botOwnPower: (_g, pi) => must(w.realms[pi as number], 'realm').own,
      botRivalPower: () => w.rivalPower,
      botWarAssess: (_g, pi, j) => ({ decision: w.decisions[(pi as number) * 3 + (j as number)] ?? null }),
    },
  );
  return {
    b,
    s,
    before,
    after: declarations(tc),
    grudgesBefore,
    relations,
    atStart,
    kings,
    lands,
    players,
    truces: b.G.players.map((p) => json((p as Raw)['_botGrudgeTruce'] ?? {}) as Record<string, number>),
  };
};
const rel = (relations: Record<string, string>, a: number, x: number) =>
  relations[a < x ? `${String(a)}-${String(x)}` : `${String(x)}-${String(a)}`] ?? 'neutral';
/** What the function wrote: [bot, rival, what]. */
const written = (r: ReturnType<typeof playWorld>) =>
  Object.entries(r.after).flatMap(([k, d]) =>
    Object.entries(d)
      .filter(([x, v]) => (r.before[k] ?? {})[x] !== v)
      .map(([x, v]) => [Number(k), Number(x), v] as const),
  );

describe('Properties', () => {
  test('only bots’ declarations are written, each a Treat or a war, toward a realm the bot met when the turn began that stands in the game, never itself', () => {
    fc.assert(
      fc.property(worldSpec, (w) => {
        const r = playWorld(w);
        const stands = (pi: number) => {
          const p = r.players[pi];
          return !!p && !p['conceded'] && (r.kings.has(pi) || !!r.lands[pi]);
        };
        const wrong = written(r).filter(
          ([pi, x, v]) =>
            !r.s.bots.includes(pi) ||
            (v !== 'treat' && v !== 'enemy') ||
            x === pi ||
            !(r.atStart[String(pi)] ?? []).includes(x) ||
            !stands(x) ||
            !stands(pi),
        );
        expect(wrong).toEqual([]);
      }),
      { seed: SEED, numRuns: 400 },
    );
  });
  test('never war on a realm already at war with the bot, never a Treat to an ally', () => {
    fc.assert(
      fc.property(worldSpec, (w) => {
        const r = playWorld(w);
        const wrong = written(r).filter(([pi, x, v]) =>
          v === 'enemy' ? rel(r.relations, pi, x) === 'enemy' : rel(r.relations, pi, x) === 'allied',
        );
        expect(wrong).toEqual([]);
      }),
      { seed: SEED, numRuns: 400 },
    );
  });
  test('a Treat to a realm the bot holds a grudge against only while a truce holds', () => {
    fc.assert(
      fc.property(worldSpec, (w) => {
        const r = playWorld(w);
        const wrong = written(r).filter(([pi, x, v]) => {
          const held = ((realm(r.b, pi)['botGrudges'] as number[] | undefined) ?? []).includes(x);
          return v === 'treat' && held && (r.truces[pi] ?? {})[String(x)] == null;
        });
        expect(wrong).toEqual([]);
      }),
      { seed: SEED, numRuns: 400 },
    );
  });
  test('every human realm’s war on a bot is remembered once, after the grudges it already held; nothing else', () => {
    fc.assert(
      fc.property(worldSpec, (w) => {
        const r = playWorld(w);
        const locked = w.safeStart && r.b.G.turn < 6;
        const want = r.b.G.players.map((_, pi) => {
          const was = r.grudgesBefore[pi] as number[] | null;
          const fresh_ =
            !locked && r.s.bots.includes(pi)
              ? [0, 1, 2].filter((h) => !r.s.bots.includes(h) && (r.before[String(h)] ?? {})[String(pi)] === 'enemy')
              : [];
          const all = [...(was ?? []), ...fresh_.filter((h) => !(was ?? []).includes(h))];
          return was || all.length ? all : null;
        });
        expect(r.b.G.players.map((p) => json((p as Raw)['botGrudges'] ?? null))).toEqual(want);
      }),
      { seed: SEED, numRuns: 400 },
    );
  });
  test('under Safe Start nothing at all: no declaration, no grudge, no truce', () => {
    fc.assert(
      fc.property(worldSpec, (w) => {
        const r = playWorld({ ...w, safeStart: true });
        expect({
          written: written(r),
          grudges: r.b.G.players.map((p) => json((p as Raw)['botGrudges'] ?? null)),
          truces: r.truces,
        }).toEqual({
          written: [],
          grudges: r.grudgesBefore,
          truces: r.players.map((p) => p['_botGrudgeTruce'] ?? {}),
        });
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
