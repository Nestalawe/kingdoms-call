// Diplomacy resolution and victory (plan P1-08k4: src/engine/turn/, two stages lifted out of resolveTurn's own body),
// called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/diplomacy-and-victory-in-a-whole-turn plays through a whole turn (lib/diplomacy-and-victory-cases.ts), here
// played through the two stages alone, as resolveTurn calls them once the phases are over (no phase current, every later
// line filed after the phases), with the realms' declarations, Reckoning calls and concessions put in the context as
// the merge of their orders does, but for the one only a whole turn can stage; then, with the helpers they call stood
// in (each wrapped in the vm by a recorder for the test's length), what they hand them and when; then what a whole turn
// can't stage: an Evil or Undead realm breaking an alliance with nothing before it (the war without warning comes
// first in a turn), realms and foes with no name, a realm offered peace with no record of whom it has met, hosts in a
// contested province or of a realm not party to the new war, phantom companies, a one-realm game. Properties
// (fast-check): each pair's relation after the declarations is the rule's (peace, alliance, war, a broken pact, or
// unchanged), and each realm is left exactly the overtures it was sent and didn't answer; the game ends by elimination
// exactly when one realm is left with land or a living hero, and otherwise by concession exactly when one realm is left
// that hasn't conceded, or those left are all allies, announced once with a line for every realm; the bar falls one
// step a turn exactly when it may, never below its floor.
// Level 1: two functions, called with the context resolveTurn hands them.
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import {
  DIPLOMACY_AND_VICTORY_CASES,
  LANDS,
  ALL_CONCEDED,
  RUINS,
  broken,
  byConcession,
  called,
  claim,
  collapses,
  concededBefore,
  decided,
  frontFoe,
  frontOwn,
  host,
  king,
  landless,
  overture,
  peace,
  relate,
  said,
  seatOf,
  short,
  stageCase,
  taxes,
  turnIs,
  unanswered,
  war,
  weary,
  type DiplomacyAndVictoryCase,
  type Outcome,
} from '../lib/diplomacy-and-victory-cases.ts';
import { board, must, type Board, type RealmSends } from '../lib/middle-of-a-bot-world.ts';
import { realm } from '../lib/cast-spell-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const worlds = { 3: botWorld(engine, 3, { cols: 10, rows: 8 }), 4: botWorld(engine, 4, { cols: 10, rows: 8 }) };
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const diplomacy = fn('diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings');
const victory = fn('victoryTheReckoningEliminationConcessionAndTheAnnouncement');
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

const tc = (b: Board) => b.tc as unknown as Record<string, unknown> & Board['tc'];
const G = (b: Board) => b.G as unknown as Record<string, unknown> & Board['G'];
/** What the merge of the realms' orders collects from what each sends, into the context: its declarations, its call
 *  for the Reckoning (unless it had conceded already), its concession. */
const merge = (b: Board, sends: Record<number, RealmSends>) => {
  const decl = tc(b)['diploDeclarations'] as Record<number, Record<number, string>>;
  const calls = tc(b)['reckoningCalls'] as Set<number>;
  b.G.players.forEach((pl, pi) => {
    const s = sends[pi];
    if (!s) return;
    if (s.diplomacy) decl[pi] = { ...s.diplomacy };
    if (s.callReckoning && !pl['conceded']) calls.add(pi);
    if (s.concede && !pl['conceded']) Object.assign(pl, { conceded: true, concededTurn: b.G.turn });
  });
};
/** The two stages, as resolveTurn calls them once the phases are over: no phase current, every later line filed after
 *  the phases, the log's context cleared. */
const settle = (b: Board, which: Fn[] = [diplomacy, victory]) => {
  tc(b)._currentPhase = null;
  tc(b)['_afterPhases'] = true;
  b.tc._logCtx = { charId: null, phase: null };
  withCaseDice(engine, LANDS, () => {
    which.forEach((f) => f(b.tc));
  });
};
const outcome = (b: Board): Outcome => ({ world: b.G, all: b.lines(), turn: b.G.turn });
/** A board staged as every case is (`stageCase`), with nothing more, on a world of `n` realms. */
const fresh = (n: 3 | 4 = 3) => {
  const b = board(engine, worlds[n], 4);
  stageCase(b, { name: 'fresh', stage: () => ({ orders: [], sends: {} }), check: () => ({ got: {}, want: {} }) });
  return b;
};
const name = (b: Board, pi: number) => must(b.G.players[pi], 'realm ' + String(pi)).name;
const relationOf = (b: Board, a: number, x: number) =>
  b.G.relations[`${String(Math.min(a, x))}-${String(Math.max(a, x))}`] ?? 'neutral';

const DIRECT = DIPLOMACY_AND_VICTORY_CASES.map(
  ([part, cases]) => [part, cases.filter((c) => !c.wholeTurnOnly)] as const,
).filter(([, cases]) => cases.length > 0);
describe.each(DIRECT)('%s, through the stages called directly', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c: DiplomacyAndVictoryCase) => {
    const b = board(engine, worlds[c.realms ?? 3], 4);
    const s = stageCase(b, c);
    merge(b, s.sends);
    settle(b);
    const { got, want } = c.check(outcome(b), s);
    expect(got).toEqual(want);
  });
});

// ── What the stages hand the helpers they call ───────────────────────────────────────────────────────────────────
interface Call {
  fn: string;
  args: unknown[];
  /** The lines written before the call. */
  before: number;
}
/** Runs `body` with each of `names` wrapped in the vm by a recorder that still calls it (for the body's length). */
function recorded(b: Board, names: string[], body: () => void): Call[] {
  const g = engine as unknown as Record<string, Fn>;
  const was = names.map((f) => [f, must(g[f], f)] as const);
  const calls: Call[] = [];
  for (const [f, w] of was)
    g[f] = (...args: unknown[]) => {
      calls.push({ fn: f, args, before: b.lines().length });
      return w(...args);
    };
  try {
    body();
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
  return calls;
}
const of = (calls: Call[], f: string) => calls.filter((c) => c.fn === f).map((c) => c.args);

describe('Diplomacy and victory: what they call', () => {
  test('the war fronts are looked for once for each new war, after the war is told, with the context; not for peace or a broken alliance', () => {
    const b = fresh(4);
    merge(b, {
      0: { diplomacy: { 1: 'treat', 2: 'enemy' } },
      1: { diplomacy: { 0: 'treat', 3: 'enemy' } },
      2: { diplomacy: { 3: 'enemy' } },
    });
    const calls = recorded(b, ['warFrontThreats'], () => {
      settle(b, [diplomacy]);
    });
    const texts = b.lines().map((l) => l.text);
    expect(of(calls, 'warFrontThreats')).toEqual([[b.tc], [b.tc]]);
    expect(calls.map((c) => texts[c.before - 1])).toEqual([war(name(b, 1), name(b, 3)), war(name(b, 2), name(b, 3))]);
  });

  test('each pair with a declaration is settled under its own key, earlier realms first', () => {
    const b = fresh(4);
    merge(b, { 3: { diplomacy: { 0: 'enemy' } }, 1: { diplomacy: { 2: 'enemy' } } });
    const calls = recorded(b, ['relKeyOf'], () => {
      settle(b, [diplomacy]);
    });
    expect(of(calls, 'relKeyOf')).toEqual([
      [0, 3],
      [1, 2],
    ]);
  });

  test("a Reckoning call is weighed with the whole state and the caller's index, each caller in turn until one claims; the bar from the realm count, the steps and the bloc", () => {
    const b = fresh();
    turnIs(b, 12);
    relate(b, { '0-1': 'enemy', '1-2': 'allied' });
    taxes(b, 30, 40, 30);
    king(b, 0);
    king(b, 1);
    king(b, 2);
    G(b)['reckoningDecaySteps'] = 1;
    merge(b, { 0: { callReckoning: true }, 1: { callReckoning: true }, 2: { callReckoning: true } });
    const calls = recorded(b, ['reckoningCallEligibility', 'alliedBloc', 'reckoningThresholdPct'], () => {
      settle(b, [victory]);
    });
    expect(of(calls, 'reckoningCallEligibility')).toEqual([
      [b.G, 0],
      [b.G, 1],
    ]);
    expect(calls.filter((c) => c.fn === 'alliedBloc').at(-1)?.args).toEqual([b.G, 1]);
    expect(
      of(calls, 'reckoningThresholdPct')
        .filter((a) => a[2] !== undefined)
        .at(-1),
    ).toEqual([3, 1, 2]);
    expect(G(b)['reckoning']).toEqual({ by: 1, bloc: [1, 2], calledTurn: 12, resolveAtTurn: 14, thrPct: 62 });
    expect(said(outcome(b))).toEqual([
      [[0], short(name(b, 0), 30, 45)],
      [[], called(name(b, 1), [name(b, 2)], 70, 62, 14)],
    ]);
  });

  test('a claim judged, an elimination and a concession each crown the winner from the whole state', () => {
    for (const end of ['judged', 'eliminated', 'conceded'] as const) {
      const b = fresh();
      turnIs(b, 14);
      relate(b, { '0-1': 'enemy' });
      taxes(b, 60, 20, 20);
      king(b, 0);
      if (end === 'judged') claim(b, 0, [0], 14, 50);
      if (end === 'eliminated')
        [1, 2].forEach((pi) => {
          landless(b, pi);
        });
      if (end === 'conceded')
        [1, 2].forEach((pi) => {
          concededBefore(b, pi);
        });
      const calls = recorded(b, ['reckoningWinner'], () => {
        settle(b, [victory]);
      });
      expect([end, of(calls, 'reckoningWinner')]).toEqual([end, [[b.G]]]);
    }
  });

  test('the realms left after a concession are checked for an alliance with the context, every pair both ways', () => {
    const b = fresh(4);
    relate(b, { '0-2': 'allied', '0-3': 'allied', '2-3': 'allied' });
    concededBefore(b, 1);
    const calls = recorded(b, ['areAllied'], () => {
      settle(b, [victory]);
    });
    expect(of(calls, 'areAllied')).toEqual([
      [b.tc, 0, 2],
      [b.tc, 0, 3],
      [b.tc, 2, 0],
      [b.tc, 2, 3],
      [b.tc, 3, 0],
      [b.tc, 3, 2],
    ]);
    expect(said(outcome(b))[0]).toEqual([[], byConcession(1, false)]);
  });
});

// ── What a whole turn can't stage ────────────────────────────────────────────────────────────────────────────────
describe('Diplomacy and victory: what a whole turn cannot stage', () => {
  test('an Evil realm breaking an alliance goes straight to war, both told, and the hosts on its ground warned', () => {
    const b = fresh();
    realm(b, 0)['alignment'] = 'Evil';
    const h = host(b, 2, seatOf(b, 0), 2);
    merge(b, { 0: { diplomacy: { 2: 'enemy' } } });
    settle(b, [diplomacy]);
    const t = war(name(b, 0), name(b, 2));
    expect(relationOf(b, 0, 2)).toBe('enemy');
    expect(said(outcome(b))).toEqual([
      [[0], t],
      [[2], t],
      [[2], frontOwn(h, 2, seatOf(b, 0), true, name(b, 0))],
      [[0], frontFoe(h, name(b, 2), 2, seatOf(b, 0), true)],
    ]);
  });

  test('an Undead realm breaking an alliance goes to war too, whichever of the pair it is', () => {
    const b = fresh();
    realm(b, 2)['alignment'] = 'Undead';
    merge(b, { 2: { diplomacy: { 0: 'enemy' } } });
    settle(b, [diplomacy]);
    expect(relationOf(b, 0, 2)).toBe('enemy');
    expect(said(outcome(b)).map(([, t]) => t)).toEqual([war(name(b, 0), name(b, 2)), war(name(b, 0), name(b, 2))]);
  });

  test('an Evil realm whose ally breaks with it is only at peace again', () => {
    const b = fresh();
    realm(b, 0)['alignment'] = 'Evil';
    merge(b, { 2: { diplomacy: { 0: 'enemy' } } });
    settle(b, [diplomacy]);
    expect(relationOf(b, 0, 2)).toBe('neutral');
    expect(said(outcome(b))[0]).toEqual([[0], broken(name(b, 2), false, name(b, 0), name(b, 2))]);
  });

  test('realms with no name are named by their number', () => {
    const b = fresh();
    realm(b, 0).name = '';
    realm(b, 1).name = '';
    merge(b, { 0: { diplomacy: { 1: 'treat' } }, 1: { diplomacy: { 0: 'treat' } } });
    settle(b, [diplomacy]);
    expect(said(outcome(b))[0]).toEqual([[0], peace('Realm 1', 'Realm 2')]);
  });

  test("a foe with no name is 'the enemy' in the war-front warnings", () => {
    const b = fresh();
    const h = host(b, 1, seatOf(b, 2), 1);
    const g = host(b, 2, seatOf(b, 2), 1);
    merge(b, { 1: { diplomacy: { 2: 'enemy' } } });
    realm(b, 1).name = '';
    realm(b, 2).name = '';
    settle(b, [diplomacy]);
    expect(said(outcome(b)).slice(2)).toEqual([
      [[1], frontOwn(h, 1, seatOf(b, 2), true, 'the enemy')],
      [[2], frontFoe(h, 'the enemy', 1, seatOf(b, 2), true)],
      [[2], frontOwn(g, 1, seatOf(b, 2), false, 'the enemy')],
      [[1], frontFoe(g, 'the enemy', 1, seatOf(b, 2), false)],
    ]);
  });

  test('a realm offered peace with no record of whom it has met has met the sender now', () => {
    const b = fresh();
    delete realm(b, 1)['_encountered'];
    merge(b, { 0: { diplomacy: { 1: 'treat' } } });
    settle(b, [diplomacy]);
    expect(realm(b, 1)['_encountered']).toEqual([0]);
    expect(said(outcome(b))).toEqual([
      [[1], overture(name(b, 0), 'peace', false)],
      [[0], unanswered(name(b, 0), 'peace', name(b, 1))],
    ]);
  });

  test("a host in a province already contested isn't warned: the contest resumes in Spring", () => {
    const b = fresh();
    host(b, 1, seatOf(b, 2), 2);
    seatOf(b, 2)._battleUnresolved = true;
    merge(b, { 1: { diplomacy: { 2: 'enemy' } } });
    settle(b, [diplomacy]);
    expect(said(outcome(b)).length).toBe(2);
  });

  test('a host of a realm not party to the new war is not warned of it', () => {
    const b = fresh();
    relate(b, { '0-1': 'enemy' });
    host(b, 0, seatOf(b, 1), 2);
    merge(b, { 1: { diplomacy: { 2: 'enemy' } } });
    settle(b, [diplomacy]);
    expect(said(outcome(b))).toEqual([
      [[1], war(name(b, 1), name(b, 2))],
      [[2], war(name(b, 1), name(b, 2))],
    ]);
  });

  test("a host standing on a third realm's ground is warned only when a living host of the new foe stands beside it", () => {
    const variants = ['a lone hero', 'a fallen host', 'a host elsewhere', 'a host beside'] as const;
    const got = variants.map((v) => {
      const b = fresh();
      relate(b, { '0-2': 'enemy' });
      const p = seatOf(b, 0);
      const h = host(b, 2, p, 2);
      host(b, 0, p, 1);
      const foe = host(b, 1, v === 'a host elsewhere' ? seatOf(b, 1) : p, v === 'a lone hero' ? 0 : 1);
      if (v === 'a fallen host') Object.assign(foe, { alive: false, hp: 0 });
      merge(b, { 1: { diplomacy: { 2: 'enemy' } } });
      settle(b, [diplomacy]);
      return [
        v,
        said(outcome(b))
          .filter(([, t]) => t.includes(h.name))
          .map(([to]) => to),
      ];
    });
    expect(got).toEqual([
      ['a lone hero', []],
      ['a fallen host', []],
      ['a host elsewhere', []],
      ['a host beside', [[2], [1]]],
    ]);
  });

  test('phantom companies count in the size of a host the foe is told of', () => {
    const b = fresh();
    const h = host(b, 1, seatOf(b, 2), 1);
    h.armies.push({ ...must(h.armies[0], 'a company'), unitName: 'Mirage', _phantom: true });
    merge(b, { 1: { diplomacy: { 2: 'enemy' } } });
    settle(b, [diplomacy]);
    expect(said(outcome(b))[3]).toEqual([[2], frontFoe(h, name(b, 1), 2, seatOf(b, 2), true)]);
  });

  test("a caller with no name is 'A king'; a claimant with no name is 'the claimant'", () => {
    const b = fresh();
    turnIs(b, 9);
    king(b, 0);
    realm(b, 0).name = '';
    merge(b, { 0: { callReckoning: true } });
    settle(b, [victory]);
    expect(said(outcome(b))[0]?.[1]).toMatch(/^A king calls for the Reckoning, but the throne cannot be claimed/);
    const c = fresh();
    turnIs(c, 13);
    relate(c, { '0-1': 'enemy' });
    taxes(c, 10, 45, 45);
    claim(c, 0, [0], 14, 50);
    realm(c, 0).name = '';
    settle(c, [victory]);
    expect(said(outcome(c))[0]?.[1]).toBe(collapses('the claimant', 10, 50));
  });

  test("a winner with no name is named by number; 'No-one' when there is none", () => {
    const b = fresh();
    [1, 2].forEach((pi) => {
      landless(b, pi);
    });
    realm(b, 0).name = '';
    settle(b, [victory]);
    expect(said(outcome(b))[0]?.[1]).toBe(decided('Realm 1', RUINS));
  });

  test('a claimant with no land but a living hero: his share is nothing, and the claim collapses', () => {
    const b = fresh();
    turnIs(b, 13);
    relate(b, { '0-1': 'enemy' });
    landless(b, 0);
    king(b, 0);
    claim(b, 0, [0], 14, 50);
    settle(b, [victory]);
    expect(said(outcome(b))).toEqual([[[], collapses(name(b, 0), 0, 50)]]);
  });

  test('a game of one realm never ends by elimination or concession', () => {
    const b = fresh();
    b.G.players.splice(1);
    realm(b, 0)['conceded'] = true;
    settle(b, [victory]);
    expect([G(b)['gameOver'], said(outcome(b))]).toEqual([undefined, []]);
  });

  test("a concession's standings are read by realm index", () => {
    const b = fresh();
    taxes(b, 10, 10, 30);
    concededBefore(b, 1);
    settle(b, [victory]);
    expect((G(b)['gameOver'] as Record<string, unknown>)['winner']).toBe(2);
    expect(said(outcome(b))[1]?.[1]).toBe(decided(name(b, 2), ALL_CONCEDED));
  });
});

// ── Properties ──────────────────────────────────────────────────────────────────────────────────────────────────
type Rel = 'enemy' | 'allied' | 'neutral';
const RELS: Rel[] = ['enemy', 'allied', 'neutral'];
const DECLS = ['treat', 'enemy', 'peace', null] as const;
describe('Diplomacy and victory: properties', () => {
  test("each pair's relation after the declarations is the rule's, and each realm keeps exactly the overtures it was sent and didn't answer", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<3 | 4>(3, 4),
        fc.array(fc.constantFrom(...RELS), { minLength: 6, maxLength: 6 }),
        fc.array(fc.constantFrom(...DECLS), { minLength: 16, maxLength: 16 }),
        fc.array(fc.boolean(), { minLength: 16, maxLength: 16 }),
        fc.array(fc.constantFrom('Divine', 'Evil', 'Undead', 'Neutral'), { minLength: 4, maxLength: 4 }),
        (n, rels, decls, meets, creeds) => {
          const b = fresh(n);
          const pairs: [number, number][] = [];
          for (let a = 0; a < n; a++) for (let x = a + 1; x < n; x++) pairs.push([a, x]);
          const start: Record<string, Rel> = {};
          pairs.forEach(([a, x], k) => {
            start[`${String(a)}-${String(x)}`] = must(rels[k], 'a relation');
          });
          b.G.relations = Object.fromEntries(Object.entries(start).filter(([, r]) => r !== 'neutral'));
          const d = (from: number, to: number) => decls[from * 4 + to] ?? null;
          const knows = (from: number, to: number) => from !== to && !!meets[from * 4 + to];
          b.G.players.forEach((pl, i) => {
            pl['_encountered'] = [0, 1, 2, 3].filter((k) => k < n && knows(i, k));
            pl['alignment'] = creeds[i];
          });
          const sends: Record<number, RealmSends> = {};
          for (let a = 0; a < n; a++)
            sends[a] = {
              diplomacy: Object.fromEntries(
                [0, 1, 2, 3].filter((k) => k < n && k !== a && d(a, k) !== null).map((k) => [k, d(a, k)]),
              ) as NonNullable<RealmSends['diplomacy']>,
            };
          const metBefore = b.G.players.map((pl) => [...(pl['_encountered'] as number[])]);
          merge(b, sends);
          settle(b, [diplomacy]);
          const dark = (i: number) => ['Evil', 'Undead'].includes(must(creeds[i], 'a creed'));
          const valid = (from: number, to: number, cur: Rel) => {
            const v = d(from, to);
            if (v !== 'treat' && v !== 'enemy') return null;
            if (!(metBefore[from] ?? []).includes(to)) return null;
            if (v === 'treat' && n <= 3 && cur === 'neutral') return null;
            return v;
          };
          const overtures: { from: number; kind: string }[][] = b.G.players.map(() => []);
          const met = metBefore.map((m) => new Set(m));
          pairs.forEach(([a, x]) => {
            const cur = start[`${String(a)}-${String(x)}`] ?? 'neutral';
            const da = valid(a, x, cur);
            const dx = valid(x, a, cur);
            let next: Rel = cur;
            if (da === 'enemy' || dx === 'enemy') {
              next =
                cur === 'allied'
                  ? (da === 'enemy' && dark(a)) || (dx === 'enemy' && dark(x))
                    ? 'enemy'
                    : 'neutral'
                  : 'enemy';
            } else if (da === 'treat' && dx === 'treat') {
              const would: Rel = cur === 'enemy' ? 'neutral' : 'allied';
              next = would === 'allied' && n <= 3 ? cur : would;
            }
            const mutual = da === 'treat' && dx === 'treat';
            const kind = cur === 'enemy' ? 'peace' : 'alliance';
            if (da === 'treat') {
              met[x]?.add(a);
              if (!mutual) overtures[x]?.push({ from: a, kind });
            }
            if (dx === 'treat') {
              met[a]?.add(x);
              if (!mutual) overtures[a]?.push({ from: x, kind });
            }
            expect([a, x, relationOf(b, a, x)]).toEqual([a, x, next]);
          });
          expect(b.G.players.map((pl) => pl['_overturesIn'])).toEqual(overtures);
          expect(b.G.players.map((pl) => [...(pl['_encountered'] as number[])].sort())).toEqual(
            met.map((m) => [...m].sort()),
          );
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });

  test('the game ends by elimination exactly when one realm is left with land or a living hero, else by concession when one realm still in it is left or all left are allies; announced once, every realm in the standings', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ land: fc.boolean(), hero: fc.boolean(), conceded: fc.boolean() }), {
          minLength: 4,
          maxLength: 4,
        }),
        fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
        (realms, allies) => {
          const b = fresh(4);
          const rel: Record<string, 'enemy' | 'allied'> = {};
          let k = 0;
          for (let a = 0; a < 4; a++)
            for (let x = a + 1; x < 4; x++) if (allies[k++]) rel[`${String(a)}-${String(x)}`] = 'allied';
          relate(b, rel);
          realms.forEach((r, pi) => {
            if (!r.land) landless(b, pi);
            if (r.hero) king(b, pi);
            if (r.conceded) concededBefore(b, pi);
          });
          settle(b, [victory]);
          const alive = realms.map((r) => r.land || r.hero);
          const living = alive.flatMap((x, i) => (x ? [i] : []));
          const left = living.filter((i) => !realms[i]?.conceded);
          const allAllied =
            left.length >= 2 &&
            left.every((a) => left.every((x) => a === x || rel[`${String(Math.min(a, x))}-${String(Math.max(a, x))}`]));
          const over = G(b)['gameOver'] as Record<string, unknown> | undefined;
          const lines = said(outcome(b)).map(([, t]) => t);
          const kind =
            living.length === 1
              ? 'elimination'
              : realms.some((r) => r.conceded) && (left.length <= 1 || allAllied)
                ? 'concession'
                : 'none';
          const winner = (over?.['winner'] ?? null) as number | null;
          const winners = kind === 'elimination' ? living : kind === 'concession' ? left : [];
          settle(b, [victory]);
          const again = said(outcome(b)).length - lines.length;
          const first = {
            elimination: decided(name(b, living[0] ?? 0), RUINS),
            concession: byConcession(realms.filter((r) => r.conceded).length, left.length <= 1),
            none: null,
          }[kind];
          expect({
            kind: over
              ? over['byElimination']
                ? 'elimination'
                : over['byConcession'] && over['byReckoning']
                  ? 'concession'
                  : 'other'
              : 'none',
            winner: winners.length ? winners.includes(winner as number) : winner,
            first: lines[0] ?? null,
            announced: over?.['_announced'] ?? false,
            decided: lines.filter((t) => t.startsWith('🏆')).length,
            standings: lines.filter((t) => /^ {3}\d+\. /.test(t)).length,
            again,
          }).toEqual({
            kind,
            winner: winners.length ? true : null,
            first,
            announced: kind !== 'none',
            decided: kind === 'none' ? 0 : 1,
            standings: kind === 'none' ? 0 : 4,
            again: 0,
          });
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });

  test('the bar falls one step a turn exactly when it may (no claim, no result, turn 15 on, above the floor), never below the floor', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.nat({ max: 8 }),
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom<3 | 4>(3, 4),
        (t, steps, claimed, over, n) => {
          const b = fresh(n);
          turnIs(b, t);
          relate(b, {});
          taxes(b, 60, 20, 20, 0);
          king(b, 0);
          G(b)['reckoningDecaySteps'] = steps;
          if (claimed) claim(b, 0, [0], t + 1, 25);
          if (over) G(b)['gameOver'] = { winner: 0, byElimination: true, turn: t - 1, standings: [], _announced: true };
          settle(b, [victory]);
          const base = n === 3 ? 50 : 45;
          const at = (s: number) => Math.max(25, base - 5 * s);
          const falls = !claimed && !over && t >= 15 && at(steps) > 25;
          expect(G(b)['reckoningDecaySteps']).toBe(falls ? steps + 1 : steps);
          expect(said(outcome(b))).toEqual(falls ? [[[], weary(at(steps + 1), at(steps), n === 3 ? 17 : 13)]] : []);
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });
});
