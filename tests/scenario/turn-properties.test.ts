// Property tests of a whole turn (P1-04d, fast-check): for any small world and any orders fast-check makes up, no
// hero ends a phase in two provinces, and no realm's report names a realm it hasn't met. The world, its realms (2 to
// 4, some left to the bots) and every human-held hero's five orders are the input; every dice roll comes from a
// seeded generator whose seed is part of it, and the page's clock starts again at each turn, so a failure shrinks to
// a small world and few orders, and repeats.
//
// A hero stands where his `location` says, and each province keeps its own list of the heroes in it (`characters`):
// every move, retreat and flight updates both by hand. "In two provinces" is a hero named in two lists, or in a list
// other than his own province's. They are read at the end of each phase: the last thing a phase does is
// syncAllMaxHp(turnContext), which the turn calls once more after the phases (with no phase set), so standing it in
// with a reader that runs after it, while a phase is set, reads them five times a turn. "Met" is the leak check's rule
// (lib/report-leaks.ts), with its parked breaches (lib/invariants.ts).
// Level 2 (scenario): one real turn on a small staged world, played in the engine's bare vm
// (lib/scenario-in-the-vm.ts); the lists are checked between phases, inside the turn, and the reports are put together
// there too. The engine reads no clock (unit/engine-purity.test.ts), so nothing pins one. Until plan P1-09a the turn
// was played on the GM portal, with its clock pinned, and a code-anchor hook on syncAllMaxHp's line in the phase loop
// read the lists.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Properties of a whole turn (fast-check, P1-04d), over made-up small worlds (2 to 4 realms, some left to the bots) and
// any orders for the human-held heroes, as `turn-fuzz` gives them: no hero ends a phase in two provinces (at the end of
// each phase, every living character is named in exactly one province's list of heroes, his own: the lists are rebuilt
// from where each stands once a phase, and nothing else may disagree); no realm's report names a realm it hasn't met
// (the leak check's rule, `lib/report-leaks.ts`, with its parked breaches). 50 turns each (500 in full). Level 2: one
// real turn on a small staged world, in the bare `vm`; the lists are read between phases inside `resolveTurn`
// (`syncAllMaxHp`, the phase's last call, stood in with a reader after it; P1-09a: it was a code-anchor hook on the GM
// portal), where the reports are put together too. TypeScript, in `scenario/`
import fc from 'fast-check';
import { expect, test } from 'vitest';
import type { KcRng } from '../lib/boot.js';
import { checkLeaks, describeBreaches, type SavedState } from '../lib/invariants.ts';
import { scenarioInTheVm, type Order } from '../lib/scenario-in-the-vm.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';

const full = process.env['KC_FULL'] === '1';
/** A turn takes about 80 ms: half the default inputs (about 4 s a property). */
const RUNS = full ? 500 : 50;
/** 1.2 s an input: 60 s for npm test's 50, 600 s for KC_FULL's 500. */
const TIMEOUT = timeLimitForPropertyRuns(RUNS, 1_200).timeout;

const sc = scenarioInTheVm({ seed: 1 });
const W = sc.W;
type PhaseEnd = (ph: number, G: World) => void;
let phaseEnd: PhaseEnd | null = null;
const syncAllMaxHp = W['syncAllMaxHp'] as (tc: { _currentPhase: number | null; G: World }) => unknown;
W['syncAllMaxHp'] = (tc: { _currentPhase: number | null; G: World }) => {
  const r = syncAllMaxHp(tc);
  if (phaseEnd && tc._currentPhase != null) phaseEnd(tc._currentPhase, tc.G);
  return r;
};

interface World {
  characters: { id: number; name: string; alive?: boolean; location?: number; player?: number | null }[];
  world: { provinces: { id: number; characters?: number[] }[] };
}

/** Every living character named in two provinces' lists, or in none, or in another province's than his own. */
function inTwoPlaces(G: World): string[] {
  const lists = new Map<number, number[]>();
  for (const p of G.world.provinces)
    for (const id of p.characters ?? []) lists.set(id, [...(lists.get(id) ?? []), p.id]);
  return G.characters
    .filter((c) => c.alive !== false)
    .flatMap((c) => {
      const where = lists.get(c.id) ?? [];
      if (where.length === 1 && where[0] === c.location) return [];
      const listed = where.length ? `the lists of provinces ${where.join(', ')}` : 'no province';
      return [`${c.name} (id ${String(c.id)}) stands in province ${String(c.location)}, named in ${listed}`];
    });
}

const DIRS = ['NW', 'NE', 'W', 'E', 'SW', 'SE'];
const SKILLS = ['melee', 'archery', 'tactical', 'march', 'sage'];
const order = (action: string, target = ''): Order => ({ action, target, extra: '', desc: '' });
/** One order, as turn-fuzz gives them. Rest first: it is what a failing order shrinks to. */
const orderArb = fc.oneof(
  fc.constantFrom('rest', 'defend', 'recruit', 'research', 'search', 'explore').map((a) => order(a)),
  fc.constantFrom(...DIRS).map((d) => order('move', 'dir:' + d)),
  fc.constantFrom(...SKILLS).map((s) => order('practice', s)),
);
const turnArb = fc.integer({ min: 2, max: 4 }).chain((realms) =>
  fc.record({
    realms: fc.constant(realms),
    cols: fc.integer({ min: 2 * realms + 4, max: 2 * realms + 7 }),
    rows: fc.integer({ min: 5, max: 7 }),
    seaPct: fc.constantFrom(20, 35, 50),
    bots: fc.subarray([...Array(realms).keys()], { maxLength: realms - 1 }),
    /** Each human-held hero's five orders, given out in turn. */
    plans: fc.array(fc.array(orderArb, { minLength: 5, maxLength: 5 }), { minLength: 1, maxLength: 10 }),
    seed: fc.integer({ min: 1, max: 0x7fffffff }),
  }),
);
type Input = typeof turnArb extends fc.Arbitrary<infer T> ? T : never;

/** Plays one turn of `input`, with `onPhaseEnd` called at the end of each phase. */
function play(input: Input, onPhaseEnd: PhaseEnd) {
  (W['kcRng'] as KcRng).seed(input.seed);
  phaseEnd = onPhaseEnd;
  try {
    return sc.turn({
      realms: input.realms,
      cols: input.cols,
      rows: input.rows,
      seaPct: input.seaPct,
      bots: input.bots,
      orders: (staged) => {
        const S = staged as unknown as World;
        const heroes = S.characters.filter(
          (c) => c.alive !== false && c.player != null && !input.bots.includes(c.player),
        );
        return Object.fromEntries(heroes.map((c, i) => [c.id, input.plans[i % input.plans.length] ?? []]));
      },
    });
  } finally {
    phaseEnd = null;
  }
}

test(
  'no hero ends a phase in two provinces',
  () => {
    fc.assert(
      fc.property(turnArb, (input) => {
        const found: string[] = [];
        const r = play(input, (ph, G) => {
          for (const line of inTwoPlaces(G)) found.push(`at the end of phase ${String(ph)}: ${line}`);
        });
        expect(inTwoPlaces(r.S as unknown as World), 'the staged world').toEqual([]);
        expect(found.join('\n')).toBe('');
        expect(sc.errs).toEqual([]);
      }),
      { numRuns: RUNS },
    );
  },
  TIMEOUT,
);

test(
  "no realm's report names a realm it hasn't met",
  () => {
    fc.assert(
      fc.property(turnArb, (input) => {
        const r = play(input, () => undefined);
        const broke = checkLeaks({
          before: r.S as unknown as SavedState,
          after: r.S2 as unknown as SavedState,
          gmLog: r.log,
          telemetry: [],
          players: [],
          reports: Object.entries(r.reports).map(([realm, report]) => ({ realm: Number(realm), report })),
        }).filter((b) => b.check === 'an unmet realm');
        expect(describeBreaches('the turn', broke)).toBe('');
        expect(sc.errs).toEqual([]);
      }),
      { numRuns: RUNS },
    );
  },
  TIMEOUT,
);
