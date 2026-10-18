// Property tests of a whole turn (P1-04d, fast-check): for any small world and any orders fast-check makes up, no
// hero ends a phase in two provinces, and no realm's report names a realm it hasn't met. The world, its realms (2 to
// 4, some left to the bots) and every human-held hero's five orders are the input; every dice roll comes from a
// seeded generator whose seed is part of it, and the page's clock starts again at each turn, so a failure shrinks to
// a small world and few orders, and repeats.
//
// A hero stands where his `location` says, and each province keeps its own list of the heroes in it (`characters`):
// every move, retreat and flight updates both by hand. "In two provinces" is a hero named in two lists, or in a list
// other than his own province's. The hook at the end of each phase (`    syncAllMaxHp(turnContext); // a max-HP
// rise…`) reads them. "Met" is the leak check's rule (lib/report-leaks.ts), with its parked breaches (lib/invariants.ts).
// Level 2 (scenario): one real turn on a small staged world; the lists are checked between phases, inside runTurn,
// and the reports are put together there too.
import fc from 'fast-check';
import { expect, test } from 'vitest';
import { pinnedDate, type KcRng, type PageWindow } from '../lib/boot.js';
import { checkLeaks, describeBreaches, type SavedState } from '../lib/invariants.ts';
import { bootScenario, type Order } from '../lib/scenario.js';

const PHASE_END = '    syncAllMaxHp(turnContext); // a max-HP rise earned this phase heals into its headroom now\n';
const NOW = '2026-10-01T12:00:00Z';
const full = process.env['KC_FULL'] === '1';
/** A turn takes about 80 ms: half the default inputs (about 4 s a property). */
const RUNS = full ? 500 : 50;
const TIMEOUT = (full ? 600 : 60) * 1000;

const sc = await bootScenario({
  now: NOW,
  inject: [[PHASE_END, PHASE_END + '    if(window.__phaseEnd) window.__phaseEnd(ph,G);\n']],
});
const W = sc.W as unknown as PageWindow;
const RealDate = W.eval('Object.getPrototypeOf(new Date(0)).constructor') as DateConstructor;

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
async function play(input: Input, onPhaseEnd: (ph: number, G: World) => void) {
  (W['kcRng'] as KcRng).seed(input.seed);
  W['Date'] = pinnedDate(RealDate, NOW);
  W['__phaseEnd'] = onPhaseEnd;
  try {
    return await sc.turn<World>({
      realms: input.realms,
      cols: input.cols,
      rows: input.rows,
      seaPct: input.seaPct,
      bots: input.bots,
      orders: (S) => {
        const heroes = S.characters.filter(
          (c) => c.alive !== false && c.player != null && !input.bots.includes(c.player),
        );
        return Object.fromEntries(heroes.map((c, i) => [c.id, input.plans[i % input.plans.length] ?? []]));
      },
    });
  } finally {
    W['__phaseEnd'] = null;
  }
}

test(
  'no hero ends a phase in two provinces',
  async () => {
    await fc.assert(
      fc.asyncProperty(turnArb, async (input) => {
        const found: string[] = [];
        const r = await play(input, (ph, G) => {
          for (const line of inTwoPlaces(G)) found.push(`at the end of phase ${String(ph)}: ${line}`);
        });
        expect(inTwoPlaces(r.S), 'the staged world').toEqual([]);
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
  async () => {
    await fc.assert(
      fc.asyncProperty(turnArb, async (input) => {
        const r = await play(input, () => undefined);
        const broke = checkLeaks({
          before: r.S,
          after: r.S2 as SavedState,
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
