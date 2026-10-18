// Routes and distances (lifted out of resolveTurn in plan P1-08i1), called directly in the bare vm (tests/lib/engine.ts):
// - provSafePassageFor (the balance matrix never runs it): a province a realm's column may pass through without a
//   fight: its own, an ally's, or unowned ground with no living, armed neutral guard. Not a rival's, at war or not.
// - stepTowardPreferSafe (the matrix never runs it either: its one caller, a Move order to a far province, isn't in the
//   matrix's games): the shortest route always wins; of the shortest routes, one over safe ground is taken when there
//   is one. Staged cases, then a property (fast-check, seeded from KC_SEED) on made-up maps of land, sea and owners.
// - provDistance (property): 0 to itself, 1 to a neighbour, the same both ways, and a neighbour is at most one step
//   nearer or farther from any province.
// - stepTowardPath and stepToward (property): a land column's first step is a land neighbour on a shortest route over
//   land, and there is none when no route over land exists.
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs.
import fc from 'fast-check';
import { afterAll, describe, expect, test } from 'vitest';
import { engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';

interface Province {
  id: number;
  row: number;
  col: number;
  terrain: string;
  owner: number | null;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive: boolean;
  location: number;
  armies: { type: string }[];
  _isNeutralGuard?: boolean;
}
interface Step {
  first: Province;
  depth: number;
}

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);

const provSafePassageFor = engineFn(engine, 'provSafePassageFor') as (
  tc: TurnContext,
  p: Province | null,
  pi: number,
) => boolean;
const stepTowardPreferSafe = engineFn(engine, 'stepTowardPreferSafe') as (
  tc: TurnContext,
  c: Character,
  toId: number,
) => Province | null;
const stepToward = engineFn(engine, 'stepToward') as (tc: TurnContext, c: Character, toId: number) => Province | null;
const stepTowardPath = engineFn(engine, 'stepTowardPath') as (
  tc: TurnContext,
  c: Character,
  toId: number,
) => Step | null;
const provDistance = engineFn(engine, 'provDistance') as (
  tc: TurnContext,
  a: number | null,
  b: number | null,
) => number;
const getNeighborsP = engineFn(engine, 'getNeighborsP') as (
  p: Province,
  cols: number,
  rows: number,
  ps: Province[],
) => Province[];

// Realm 0 moves; realm 1 is its ally, realm 2 its enemy and realm 3 at peace with it (no treaty).
const RELATIONS = { '0-1': 'allied', '0-2': 'enemy' };

/** A world of `cols` × `rows` provinces, `terrain[i]` and `owner[i]` for province i, with the characters given. */
function world(cols: number, rows: number, terrain: string[], owner: (number | null)[], characters: Character[]) {
  const provinces: Province[] = Array.from({ length: cols * rows }, (_, id) => ({
    id,
    row: Math.floor(id / cols),
    col: id % cols,
    terrain: terrain[id] ?? 'plain',
    owner: owner[id] ?? null,
  }));
  const tc = turnContext(engine, {
    world: { cols, rows, provinces },
    characters,
    relations: RELATIONS,
    turnOrders: {},
  });
  const G = tc.G as unknown as { world: { provinces: Province[] }; characters: Character[] };
  return { tc, provinces: G.world.provinces, characters: G.characters };
}
const hero = (id: number, player: number | null, location: number, armies = [{ type: 'Infantry' }]): Character => ({
  id,
  name: 'Hero ' + String(id),
  player,
  alive: true,
  location,
  armies,
});
const guard = (id: number, location: number, armies = [{ type: 'Infantry' }], alive = true): Character => ({
  ...hero(id, null, location, armies),
  alive,
  _isNeutralGuard: true,
});

describe('provSafePassageFor', () => {
  // province 0 realm 0's, 1 its ally's, 2 its enemy's, 3 at peace, 4–7 unowned: 4 empty, 5 with an armed guard,
  // 6 with a guard who has no troops, 7 with a fallen guard
  const { tc, provinces } = world(
    8,
    1,
    [],
    [0, 1, 2, 3],
    [guard(10, 5), guard(11, 6, []), guard(12, 7, undefined, false)],
  );
  const safe = (id: number) => provSafePassageFor(tc, provinces[id] ?? null, 0);

  test("a realm's own land and an ally's are safe; a rival's is not, at war or at peace", () => {
    expect([safe(0), safe(1), safe(2), safe(3)]).toEqual([true, true, false, false]);
  });

  test('unowned ground is safe unless a living neutral guard with troops stands there', () => {
    expect([safe(4), safe(5), safe(6), safe(7)]).toEqual([true, false, true, true]);
  });

  test('no province is not safe passage', () => {
    expect(provSafePassageFor(tc, null, 0)).toBe(false);
  });

  test("it is a realm's own view: the enemy's land is safe for the enemy", () => {
    expect(provSafePassageFor(tc, provinces[2] ?? null, 2)).toBe(true);
    expect(provSafePassageFor(tc, provinces[0] ?? null, 2)).toBe(false);
  });
});

describe('stepTowardPreferSafe', () => {
  // Two rows of six (an even row's neighbours lean left, an odd row's right; the columns wrap). From province 0 to
  // province 3, the shortest routes over plain land take three steps: along the top row (1, 2) or by 7.
  const COLS = 6,
    ROWS = 2;
  const step = (owner: (number | null)[], from = 0, to = 3, player: number | null = 0) => {
    const { tc, characters } = world(COLS, ROWS, [], owner, [hero(1, player, from)]);
    const c = characters[0];
    if (!c) throw new Error('no hero');
    return { safe: stepTowardPreferSafe(tc, c, to)?.id ?? null, plain: stepToward(tc, c, to)?.id ?? null };
  };

  test('with nothing in the way it takes the plain shortest route', () => {
    const r = step([0]);
    expect(r.safe).toBe(r.plain);
    expect(r.safe).not.toBeNull();
  });

  test("an equally short route over its own land is taken instead of one through a rival's", () => {
    // the plain route's first step is a rival's (realm 2); the other three-step routes start over realm 0's land
    const { plain } = step([0]);
    const owner: (number | null)[] = Array.from({ length: COLS * ROWS }, () => 0);
    owner[plain ?? -1] = 2;
    const r = step(owner);
    expect(r.plain).toBe(plain);
    expect(r.safe).not.toBe(plain);
    expect(r.safe).not.toBeNull();
  });

  test('the shortest route always wins: a longer safe detour is never taken', () => {
    // every neighbour of province 0 but one is a rival's, and the one safe neighbour leads away from the target
    const { tc, provinces } = world(COLS, ROWS, [], [], []);
    const nbrs = getNeighborsP(provinces[0] as Province, COLS, ROWS, provinces).map((p) => p.id);
    const away = nbrs.find((id) => provDistance(tc, id, 3) > provDistance(tc, 0, 3) - 1);
    if (away == null) throw new Error('no neighbour leads away');
    const owner: (number | null)[] = Array.from({ length: COLS * ROWS }, () => 2);
    owner[0] = 0;
    owner[away] = 0;
    const r = step(owner);
    expect(r.safe).toBe(r.plain);
    expect(r.safe).not.toBe(away);
  });

  test("a neutral's column (no realm) takes the plain route", () => {
    const owner: (number | null)[] = Array.from({ length: COLS * ROWS }, () => 2);
    const r = step(owner, 0, 3, null);
    expect(r.safe).toBe(r.plain);
  });

  test('no route, no step; and none toward where the column already stands', () => {
    // province 3 is open sea and the column marches on foot
    const terrain = Array.from({ length: COLS * ROWS }, (_, i) => (i === 3 ? 'sea' : 'plain'));
    const { tc, characters } = world(COLS, ROWS, terrain, [], [hero(1, 0, 0)]);
    const c = characters[0] as Character;
    expect(stepTowardPreferSafe(tc, c, 3)).toBeNull();
    expect(stepTowardPreferSafe(tc, c, 0)).toBeNull();
  });
});

// ── Properties over made-up maps ────
const ownerChoice = fc.constantFrom<number | null>(null, null, 0, 1, 2, 3);
const map = fc
  // at most 40 provinces, so no route is longer than the 40 steps provDistance and stepTowardPath search to
  .record({ cols: fc.integer({ min: 2, max: 8 }), rows: fc.integer({ min: 1, max: 5 }) })
  .chain(({ cols, rows }) =>
    fc.record({
      cols: fc.constant(cols),
      rows: fc.constant(rows),
      terrain: fc.array(fc.constantFrom('plain', 'plain', 'plain', 'forest', 'mountain', 'sea'), {
        minLength: cols * rows,
        maxLength: cols * rows,
      }),
      owner: fc.array(ownerChoice, { minLength: cols * rows, maxLength: cols * rows }),
      guards: fc.array(fc.nat(cols * rows - 1), { maxLength: 4 }),
      from: fc.nat(cols * rows - 1),
      to: fc.nat(cols * rows - 1),
    }),
  );
type Map = typeof map extends fc.Arbitrary<infer T> ? T : never;

/** Steps from `from` to every province, by breadth-first search over the provinces `ok` lets a column enter. The
 *  searches below start at the target and walk back, so the column's own province is let in whatever `ok` says: a
 *  column may start on ground it couldn't enter. */
function stepsFrom(m: Map, provinces: Province[], from: number, ok: (p: Province) => boolean): number[] {
  const dist = provinces.map(() => Infinity);
  dist[from] = 0;
  let frontier = [provinces[from] as Province];
  while (frontier.length) {
    const next: Province[] = [];
    for (const p of frontier)
      for (const n of getNeighborsP(p, m.cols, m.rows, provinces))
        if (dist[n.id] === Infinity && (ok(n) || n.id === m.from)) {
          dist[n.id] = (dist[p.id] as number) + 1;
          next.push(n);
        }
    frontier = next;
  }
  return dist;
}
const staged = (m: Map) => {
  // a land column of realm 0 at `from` (standing on land), neutral guards with troops on the unowned provinces drawn
  const terrain = m.terrain.map((t, i) => (i === m.from ? 'plain' : t));
  const guards = [...new Set(m.guards)].filter((g) => m.owner[g] == null).map((g, i) => guard(100 + i, g));
  return world(m.cols, m.rows, terrain, m.owner, [hero(1, 0, m.from), ...guards]);
};

describe('provDistance', () => {
  test('0 to itself, 1 to a neighbour, the same both ways; a neighbour is at most one step nearer or farther', () => {
    fc.assert(
      fc.property(map, (m) => {
        const { tc, provinces } = staged(m);
        expect(provDistance(tc, m.from, m.from)).toBe(0);
        const d = provDistance(tc, m.from, m.to);
        expect(provDistance(tc, m.to, m.from)).toBe(d);
        // every province is on the map, so it is always reachable over the map's provinces
        expect(Number.isInteger(d)).toBe(true);
        const nbrs = getNeighborsP(provinces[m.from] as Province, m.cols, m.rows, provinces);
        expect(nbrs.map((n) => provDistance(tc, m.from, n.id))).toEqual(nbrs.map(() => 1));
        expect(nbrs.every((n) => Math.abs(provDistance(tc, n.id, m.to) - d) <= 1)).toBe(true);
      }),
    );
  });

  test('no province, no distance', () => {
    const { tc } = world(2, 1, [], [], []);
    expect(provDistance(tc, null, 1)).toBe(Infinity);
    expect(provDistance(tc, 0, null)).toBe(Infinity);
  });
});

describe('stepTowardPath, stepToward and stepTowardPreferSafe on any map', () => {
  test("a land column's first step is a land neighbour on a shortest route over land, or none when there is no route", () => {
    const seen = { routed: 0, none: 0 };
    fc.assert(
      fc.property(map, (m) => {
        const { tc, provinces, characters } = staged(m);
        const c = characters[0] as Character;
        const land = (p: Province) => p.terrain !== 'sea';
        const steps = stepsFrom(m, provinces, m.to, land); // steps from the target back: the land route's length
        const r = stepTowardPath(tc, c, m.to);
        const nbrs = getNeighborsP(provinces[m.from] as Province, m.cols, m.rows, provinces).map((p) => p.id);
        const length = steps[m.from] as number;
        const routed = m.from !== m.to && land(provinces[m.to] as Province) && length !== Infinity;
        // what the step is: whether it is a land neighbour, the route's length, the steps left after it
        const got = r && {
          neighbour: nbrs.includes(r.first.id),
          land: land(r.first),
          length: r.depth + 1,
          left: steps[r.first.id],
        };
        const want = routed ? { neighbour: true, land: true, length, left: length - 1 } : null;
        expect({ step: got, stepToward: stepToward(tc, c, m.to)?.id ?? null }).toEqual({
          step: want,
          stepToward: routed ? (r?.first.id ?? 'a step') : null,
        });
        seen[routed ? 'routed' : 'none']++;
      }),
    );
    expect(seen.routed).toBeGreaterThan(0);
    expect(seen.none).toBeGreaterThan(0);
  });

  test('stepTowardPreferSafe never takes a longer route, and takes a safe one whenever one is as short', () => {
    const seen = { safe: 0, unsafe: 0, differs: 0 };
    fc.assert(
      fc.property(map, (m) => {
        const { tc, provinces, characters } = staged(m);
        const c = characters[0] as Character;
        const land = (p: Province) => p.terrain !== 'sea';
        const safeOrTarget = (p: Province) => land(p) && (p.id === m.to || provSafePassageFor(tc, p, 0));
        const steps = stepsFrom(m, provinces, m.to, land);
        const safeSteps = stepsFrom(m, provinces, m.to, safeOrTarget);
        const r = stepTowardPreferSafe(tc, c, m.to);
        const plain = stepToward(tc, c, m.to);
        const nbrs = getNeighborsP(provinces[m.from] as Province, m.cols, m.rows, provinces).map((p) => p.id);
        // is a route as short over safe ground? Then the step is on one; if not, it is the plain route's
        const safeAsShort = safeSteps[m.from] === steps[m.from];
        const on = (dist: number[], p: Province) => (dist[p.id] as number) + 1 === dist[m.from];
        const got =
          r &&
          (safeAsShort
            ? {
                neighbour: nbrs.includes(r.id),
                shortest: on(steps, r),
                safe: safeOrTarget(r),
                safeShortest: on(safeSteps, r),
              }
            : { neighbour: nbrs.includes(r.id), shortest: on(steps, r), plain: r.id === plain?.id });
        const want = !plain
          ? null
          : safeAsShort
            ? { neighbour: true, shortest: true, safe: true, safeShortest: true }
            : { neighbour: true, shortest: true, plain: true };
        expect(got).toEqual(want);
        if (plain) seen[safeAsShort ? 'safe' : 'unsafe']++;
        if (r && plain && r.id !== plain.id) seen.differs++;
      }),
      { numRuns: 300 },
    );
    expect(seen.safe).toBeGreaterThan(0);
    expect(seen.unsafe).toBeGreaterThan(0);
    expect(seen.differs).toBeGreaterThan(0);
  });
});
