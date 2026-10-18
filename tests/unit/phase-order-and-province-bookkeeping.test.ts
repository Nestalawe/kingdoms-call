// The phase pipeline and the province bookkeeping (lifted out of resolveTurn in plan P1-08i1), called directly in the
// bare vm (tests/lib/engine.ts). Properties (fast-check, seeded from KC_SEED) over made-up phases: a few realms (0 and 1
// at war, 0 and 2 allied, 1 and 2 at peace), their heroes on a small map with orders of every kind the ordering reads.
// - normaliseAction: every order name in PHASE_ACTION_MAP gives its action, whatever its case and spacing; anything
//   else, or no order, is Defend.
// - buildPhaseIntents: one intent for each hero who may act this phase (alive, a realm's, not hired or charmed this
//   phase or later), with its order's action; only a Move has a destination, and a Move to a province is a step to a
//   neighbour (the province itself when it is next door).
// - phaseInitCompare: a consistent order (the same both ways, transitive), in tiers: orders that stay put first, then
//   Move and Encounter, then Defend.
// - orderPhaseActors: every hero who acts, once each; each dependency comes first (when they don't loop); with none,
//   the order is the comparator's.
// - isHostileInvasion and applyMoveInterlocks: an invasion is an armed Move against a realm at war with the mover;
//   only a column on a Move, leading troops and not on Defend is pinned, and only by an enemy column due to arrive
//   before it marches out, each told so in one line. A head-on swap pins the slower column, staged.
// - reconcileProvinceCharacters: each province lists exactly the characters standing in it, the fallen included.
// - settleRalliedGarrisons: no company is made or lost; each rallied company goes home to its garrison when its hero
//   won and holds the province, waits while the province is still contested, and otherwise stays with its hero.
// - noteEntered and flushIntrusionNotifications: staged cases (the one line per sighting, its seasons as a range).
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs. The matrix runs
// all of them (updateProvinceMemory too, which has no test here: what a realm remembers is the turn report's, P1-12).
import vm from 'node:vm';
import fc from 'fast-check';
import { afterAll, describe, expect, test } from 'vitest';
import { engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';

interface Unit {
  type: string;
  unitName: string;
  _garrisonOf?: number;
}
interface Province {
  id: number;
  row: number;
  col: number;
  terrain: string;
  owner: number | null;
  characters?: number[];
  garrisonArmies?: Unit[];
  _battleUnresolved?: boolean;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive: boolean;
  location: number;
  armies: Unit[];
  skills: Record<string, number>;
  hiredInPhase?: number;
  _defend?: { active: boolean };
}
interface Order {
  action: string | null;
  target?: string;
  extra?: string;
}
interface Intent {
  c: Character;
  id: number;
  player: number;
  order: Order | null;
  action: string;
  leadsArmy: boolean;
  fromId: number;
  toId: number | null;
  cancelled: boolean;
  cancelReason: string | null;
}
type Intents = Map<number, Intent>;
interface Line {
  type: string;
  text: string;
  targets: number[];
  provinceId: number | null;
  public: boolean;
}

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const normaliseAction = engineFn(engine, 'normaliseAction') as (order: Order | null) => string;
const buildPhaseIntents = engineFn(engine, 'buildPhaseIntents') as (tc: TurnContext, ph: number) => Intents;
const phaseInitCompare = engineFn(engine, 'phaseInitCompare') as (
  tc: TurnContext,
  ph: number,
) => (a: Character, b: Character) => number;
const phaseDependencies = engineFn(engine, 'phaseDependencies') as (
  tc: TurnContext,
  ph: number,
  intents: Intents,
) => [number, number][];
const orderPhaseActors = engineFn(engine, 'orderPhaseActors') as (
  tc: TurnContext,
  ph: number,
  intents: Intents,
) => Character[];
const isHostileInvasion = engineFn(engine, 'isHostileInvasion') as (tc: TurnContext, it: Intent) => boolean;
const applyMoveInterlocks = engineFn(engine, 'applyMoveInterlocks') as (
  tc: TurnContext,
  ph: number,
  intents: Intents,
) => void;
const reconcileProvinceCharacters = engineFn(engine, 'reconcileProvinceCharacters') as (tc: TurnContext) => void;
const settleRalliedGarrisons = engineFn(engine, 'settleRalliedGarrisons') as (tc: TurnContext) => void;
const noteEntered = engineFn(engine, 'noteEntered') as (
  tc: TurnContext,
  pi: number | null,
  provId: number | null,
) => void;
const flushIntrusionNotifications = engineFn(engine, 'flushIntrusionNotifications') as (tc: TurnContext) => void;
const getNeighborsP = engineFn(engine, 'getNeighborsP') as (
  p: Province,
  cols: number,
  rows: number,
  ps: Province[],
) => Province[];
const PHASE_ACTION_MAP = vm.runInContext('PHASE_ACTION_MAP', engine) as Record<string, string>;
const TIER: Record<string, number> = { move: 1, encounter: 1, defend: 2 };
const tierOf = (action: string) => TIER[action] ?? 0;

const COLS = 4,
  ROWS = 3;
const RELATIONS = { '0-1': 'enemy', '0-2': 'allied' };
const enemies = (a: number | null, b: number | null) =>
  a != null && b != null && ((a === 0 && b === 1) || (a === 1 && b === 0));

// ── A made-up phase ────
const ACTIONS = [
  'Move',
  'move',
  'Recruit',
  'Send Item',
  'Leave Army',
  'Pick Up Army',
  'Cast Spell',
  'Encounter Character',
  'Pursue',
  'Defend',
  'Search Lair',
  'a word the game does not know',
  null,
];
const heroFields = {
  player: fc.constantFrom(0, 0, 1, 1, 2),
  location: fc.nat(COLS * ROWS - 1),
  troops: fc.nat(2),
  skills: fc.record({ march: fc.nat(3), melee: fc.nat(5), tactical: fc.nat(5) }),
  alive: fc.constantFrom(true, true, true, true, false),
  hiredInPhase: fc.constantFrom(undefined, undefined, -1, 0, 1, 2, 3, 4),
  defend: fc.constantFrom(false, false, false, true),
  action: fc.constantFrom(...ACTIONS),
  // what the order names: a province (for a Move: next door or farther) or another hero (by position in the list)
  toProv: fc.nat(COLS * ROWS - 1),
  toHero: fc.nat(7),
  absolute: fc.boolean(),
};
const phaseArb = fc.record({
  heroes: fc.array(fc.record(heroFields), { minLength: 2, maxLength: 8 }),
  owner: fc.array(fc.constantFrom<number | null>(null, 0, 1, 2), { minLength: COLS * ROWS, maxLength: COLS * ROWS }),
  ph: fc.nat(4),
});
type Phase = typeof phaseArb extends fc.Arbitrary<infer T> ? T : never;
// A phase of war: realms 0 and 1 marching on each other in the top row's four provinces (each next door to the two
// beside it, the ends round the back), most of them leading troops, so columns meet and pin each other often; realm 2,
// 0's ally and at peace with 1, marches among them.
const warPhaseArb = fc.record({
  heroes: fc.array(
    fc.record({
      ...heroFields,
      player: fc.constantFrom(0, 0, 1, 1, 2),
      location: fc.nat(3),
      troops: fc.constantFrom(0, 1, 1, 2),
      action: fc.constantFrom('Move', 'Move', 'Move', 'Defend', 'Recruit'),
      toProv: fc.nat(3),
      absolute: fc.constantFrom(true, true, true, false),
    }),
    { minLength: 2, maxLength: 8 },
  ),
  owner: fc.array(fc.constantFrom<number | null>(null, 0, 1, 2), { minLength: COLS * ROWS, maxLength: COLS * ROWS }),
  ph: fc.nat(4),
});

function stage(p: Phase) {
  const provinces: Province[] = Array.from({ length: COLS * ROWS }, (_, id) => ({
    id,
    row: Math.floor(id / COLS),
    col: id % COLS,
    terrain: 'plain',
    owner: p.owner[id] ?? null,
  }));
  const characters: Character[] = p.heroes.map((h, i) => ({
    id: i + 1,
    name: 'Hero ' + String(i + 1),
    player: h.player,
    alive: h.alive,
    location: h.location,
    armies: Array.from({ length: h.troops }, (_, k) => ({
      type: 'Infantry',
      unitName: `Company ${String(i + 1)}.${String(k)}`,
    })),
    skills: h.skills,
    ...(h.hiredInPhase === undefined ? {} : { hiredInPhase: h.hiredInPhase }),
    ...(h.defend ? { _defend: { active: true } } : {}),
  }));
  const other = (h: Phase['heroes'][number]) => String((h.toHero % p.heroes.length) + 1);
  const turnOrders: Record<number, (Order | null)[]> = {};
  p.heroes.forEach((h, i) => {
    const order: Order = { action: h.action };
    if (/move/i.test(h.action ?? '')) order.target = h.absolute ? `prov:${String(h.toProv)}` : 'dir:E';
    else if (/item|army|spell/i.test(h.action ?? '')) order.extra = other(h);
    else if (/encounter|pursue/i.test(h.action ?? '')) order.target = other(h);
    const orders: (Order | null)[] = [null, null, null, null, null];
    orders[p.ph] = order;
    turnOrders[i + 1] = orders;
  });
  const tc = turnContext(engine, {
    world: { cols: COLS, rows: ROWS, provinces },
    characters,
    relations: RELATIONS,
    turnOrders,
  });
  const G = tc.G as unknown as { world: { provinces: Province[] }; characters: Character[] };
  return { tc, provinces: G.world.provinces, characters: G.characters };
}
const lines = (tc: TurnContext) => tc.turnLog as unknown as Line[];

describe('normaliseAction', () => {
  test('every order name in the map gives its action, whatever its case and spacing', () => {
    const names = Object.keys(PHASE_ACTION_MAP);
    expect(names.length).toBeGreaterThan(40);
    expect(names.map((n) => normaliseAction({ action: `  ${n.toUpperCase()} ` }))).toEqual(
      names.map((n) => PHASE_ACTION_MAP[n]),
    );
  });

  test('an order the game does not know, an empty one or none is Defend', () => {
    expect(['charge!', '', null].map((action) => normaliseAction({ action }))).toEqual(['defend', 'defend', 'defend']);
    expect(normaliseAction(null)).toBe('defend');
  });

  test('Pursue is folded into Encounter', () => {
    expect(normaliseAction({ action: 'Pursue' })).toBe('encounter');
  });
});

describe('the phase pipeline on any phase', () => {
  test('buildPhaseIntents: one intent for each hero who may act, with its action; only a Move has a destination', () => {
    const seen = { moves: 0, barred: 0 };
    fc.assert(
      fc.property(phaseArb, (p) => {
        const { tc, provinces, characters } = stage(p);
        const intents = buildPhaseIntents(tc, p.ph);
        const mayAct = characters.filter(
          (c) =>
            c.player !== null && c.alive && !(c.hiredInPhase != null && c.hiredInPhase >= 0 && p.ph <= c.hiredInPhase),
        );
        expect([...intents.keys()]).toEqual(mayAct.map((c) => c.id));
        const got = [...intents.values()].map((it) => {
          const nbrs = getNeighborsP(provinces[it.fromId] as Province, COLS, ROWS, provinces).map((n) => n.id);
          const target = it.order?.target ?? '';
          const want = target.startsWith('prov:') ? Number(target.slice(5)) : null;
          return {
            action: it.action,
            leadsArmy: it.leadsArmy,
            fromId: it.fromId,
            // a Move's destination is a neighbour, and the province named when it is one
            dest:
              it.toId == null
                ? null
                : nbrs.includes(it.toId) && (want == null || !nbrs.includes(want) || want === it.toId),
          };
        });
        expect(got).toEqual(
          mayAct.map((c, i) => {
            const it = [...intents.values()][i];
            const action = normaliseAction(it?.order ?? null);
            const target = it?.order?.target ?? '';
            const noStep = action !== 'move' || target === `prov:${String(c.location)}`;
            return { action, leadsArmy: c.armies.length > 0, fromId: c.location, dest: noStep ? null : true };
          }),
        );
        seen.moves += got.filter((g) => g.dest).length;
        seen.barred += characters.length - mayAct.length;
      }),
    );
    expect(seen.moves).toBeGreaterThan(0);
    expect(seen.barred).toBeGreaterThan(0);
  });

  test('phaseInitCompare: the same both ways, transitive, in tiers (stay put, then Move and Encounter, then Defend)', () => {
    fc.assert(
      fc.property(phaseArb, (p) => {
        const { tc, characters } = stage(p);
        const cmp = phaseInitCompare(tc, p.ph);
        const action = (c: Character) =>
          normaliseAction(((tc.G['turnOrders'] as Record<number, Order[]>)[c.id] ?? [])[p.ph] ?? null);
        const sign = (x: number) => Math.sign(x) || 0;
        const pairs = characters.flatMap((a) => characters.map((b) => [a, b] as const));
        expect(pairs.every(([a, b]) => sign(cmp(a, b)) === -sign(cmp(b, a)) && (a !== b || cmp(a, b) === 0))).toBe(
          true,
        );
        expect(
          pairs.every(([a, b]) => characters.every((c) => !(cmp(a, b) <= 0 && cmp(b, c) <= 0) || cmp(a, c) <= 0)),
        ).toBe(true);
        expect(
          pairs.every(
            ([a, b]) =>
              tierOf(action(a)) === tierOf(action(b)) ||
              sign(cmp(a, b)) === sign(tierOf(action(a)) - tierOf(action(b))),
          ),
        ).toBe(true);
      }),
    );
  });

  test('orderPhaseActors: every hero who acts, once; each dependency first when they do not loop; else initiative', () => {
    const seen = { kept: 0, plain: 0 };
    fc.assert(
      fc.property(phaseArb, (p) => {
        const { tc } = stage(p);
        const intents = buildPhaseIntents(tc, p.ph);
        const order = orderPhaseActors(tc, p.ph, intents).map((c) => c.id);
        expect([...order].sort((a, b) => a - b)).toEqual([...intents.keys()].sort((a, b) => a - b));
        const edges = phaseDependencies(tc, p.ph, intents).filter(
          ([u, v]) => intents.has(u) && intents.has(v) && u !== v,
        );
        const at = (id: number) => order.indexOf(id);
        // do the dependencies loop? (a hero who must come after himself, through the others)
        const after = (u: number): number[] => edges.filter(([a]) => a === u).map(([, b]) => b);
        const loops = [...intents.keys()].some((start) => {
          const seenIds = new Set<number>();
          const walk = (u: number): boolean =>
            after(u).some((v) => v === start || (!seenIds.has(v) && (seenIds.add(v), walk(v))));
          return walk(start);
        });
        expect(loops || edges.every(([u, v]) => at(u) < at(v))).toBe(true);
        const cmp = phaseInitCompare(tc, p.ph);
        const byInitiative = [...intents.values()]
          .map((it) => it.c)
          .sort(cmp)
          .map((c) => c.id);
        expect(edges.length > 0 || order.join() === byInitiative.join()).toBe(true);
        seen[edges.length > 0 && !loops ? 'kept' : 'plain']++;
      }),
    );
    expect(seen.kept).toBeGreaterThan(0);
    expect(seen.plain).toBeGreaterThan(0);
  });

  test('an invasion is an armed Move on a realm at war with the mover; only a column it beats out is pinned, told once', () => {
    const seen = { invasions: 0, pinned: 0 };
    fc.assert(
      fc.property(warPhaseArb, (p) => {
        const { tc, provinces, characters } = stage(p);
        const intents = buildPhaseIntents(tc, p.ph);
        const list = [...intents.values()];
        const hostile = list.filter((it) => isHostileInvasion(tc, it));
        // each invasion is an armed Move into a province held by, or holding the troops of, a realm at war with it
        const heldByFoe = (it: Intent) =>
          enemies(it.player, it.toId == null ? null : (provinces[it.toId]?.owner ?? null));
        const foeTroopsIn = (it: Intent) =>
          characters.some(
            (o) => o.alive && o.location === it.toId && o.armies.length > 0 && enemies(it.player, o.player),
          );
        expect(
          hostile.every(
            (it) => it.action === 'move' && it.leadsArmy && it.toId != null && (heldByFoe(it) || foeTroopsIn(it)),
          ),
        ).toBe(true);
        const cmp = phaseInitCompare(tc, p.ph);
        applyMoveInterlocks(tc, p.ph, intents);
        const pinned = list.filter((it) => it.cancelled);
        expect(
          pinned.every(
            (d) =>
              d.cancelReason === 'pinned' &&
              d.action === 'move' &&
              d.leadsArmy &&
              !d.c._defend?.active &&
              hostile.some(
                (inv) => inv !== d && inv.player !== d.player && inv.toId === d.fromId && cmp(inv.c, d.c) < 0,
              ),
          ),
        ).toBe(true);
        // one line each, to the pinned column's realm, in the province it stands in
        const told = lines(tc).filter((l) => l.type === 'move');
        expect(
          told.map((l) => [
            l.targets,
            l.provinceId,
            l.text.includes(' stays to defend.') || l.text.includes(' stands to defend.'),
          ]),
        ).toEqual(pinned.map((d) => [[d.player], d.fromId, true]));
        seen.invasions += hostile.length;
        seen.pinned += pinned.length;
      }),
      { numRuns: 1000 },
    );
    expect(seen.invasions).toBeGreaterThan(0);
    expect(seen.pinned).toBeGreaterThan(0);
  });

  test('a head-on swap pins the slower column, which turns about to fight on its own ground', () => {
    // realm 0's column at 0 and realm 1's at 1 (next door, at war) march into each other's province; realm 0's is faster
    const hero = {
      troops: 1,
      alive: true,
      hiredInPhase: undefined,
      defend: false,
      action: 'Move',
      toHero: 0,
      absolute: true,
    };
    const { tc } = stage({
      heroes: [
        { ...hero, player: 0, location: 0, skills: { march: 3, melee: 0, tactical: 0 }, toProv: 1 },
        { ...hero, player: 1, location: 1, skills: { march: 0, melee: 0, tactical: 0 }, toProv: 0 },
      ],
      owner: [0, 1],
      ph: 2,
    });
    const intents = buildPhaseIntents(tc, 2);
    applyMoveInterlocks(tc, 2, intents);
    expect([...intents.values()].map((it) => [it.id, it.cancelled, it.cancelReason])).toEqual([
      [1, false, null],
      [2, true, 'pinned'],
    ]);
    const told = lines(tc).map((l) => l.text);
    expect(told.length).toBe(1);
    expect(told[0]).toContain("but Hero 1's banners are already cresting the hills");
    expect(told[0]).toContain('Hero 2 turns their column about and stands to defend.');
  });
});

describe('province bookkeeping', () => {
  test('reconcileProvinceCharacters: each province lists exactly the characters standing in it, the fallen too', () => {
    fc.assert(
      fc.property(phaseArb, (p) => {
        const { tc, provinces, characters } = stage(p);
        // stale lists, as a turn's moves leave them
        provinces.forEach((pv, i) => (pv.characters = [i, 99]));
        reconcileProvinceCharacters(tc);
        expect(provinces.map((pv) => pv.characters)).toEqual(
          provinces.map((pv) => characters.filter((c) => c.location === pv.id).map((c) => c.id)),
        );
      }),
    );
  });

  test('settleRalliedGarrisons: no company made or lost; home to the garrison if its hero won and holds it, else with him', () => {
    const seen = { home: 0, waiting: 0, stays: 0 };
    fc.assert(
      fc.property(
        phaseArb,
        fc.array(fc.record({ home: fc.integer({ min: 0, max: COLS * ROWS }), contested: fc.boolean() }), {
          minLength: 1,
          maxLength: 12,
        }),
        (p, marks) => {
          const { tc, provinces, characters } = stage(p);
          // rally companies: mark each company in turn with a home (the last value names no province), and some
          // homes still contested; heroes standing at home and holding it are the winners
          const units = characters.flatMap((c) => c.armies.map((u) => [c, u] as const));
          units.forEach(([, u], i) => {
            const m = marks[i % marks.length];
            if (m && i % 3 !== 2) u._garrisonOf = m.home;
          });
          marks.forEach((m) => {
            const home = provinces[m.home];
            if (home && m.contested) home._battleUnresolved = true;
          });
          characters.forEach((c, i) => {
            const home = c.armies.find((u) => u._garrisonOf != null)?._garrisonOf;
            const pv = home == null ? undefined : provinces[home];
            if (pv && i % 2 === 0) {
              c.location = pv.id;
              pv.owner = c.player;
            }
          });
          const where = () => [
            ...characters.flatMap((c) =>
              c.armies.map((u) => [u.unitName, `hero ${String(c.id)}`, u._garrisonOf ?? null]),
            ),
            ...provinces.flatMap((pv) =>
              (pv.garrisonArmies ?? []).map((u) => [u.unitName, `garrison ${String(pv.id)}`, u._garrisonOf ?? null]),
            ),
          ];
          const want = units.map(([c, u]) => {
            const home = u._garrisonOf == null ? undefined : provinces[u._garrisonOf];
            if (u._garrisonOf == null) return [u.unitName, `hero ${String(c.id)}`, null];
            if (home?._battleUnresolved) return [u.unitName, `hero ${String(c.id)}`, u._garrisonOf];
            if (home && c.alive && c.location === home.id && home.owner === c.player)
              return [u.unitName, `garrison ${String(home.id)}`, null];
            return [u.unitName, `hero ${String(c.id)}`, null];
          });
          settleRalliedGarrisons(tc);
          const byName = (rows: unknown[][]) => [...rows].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
          expect(byName(where())).toEqual(byName(want));
          // one line for each province whose troops went home, with how many
          const homeCount = new Map<string, number>();
          want.forEach(
            (w) =>
              String(w[1]).startsWith('garrison') &&
              homeCount.set(String(w[1]), (homeCount.get(String(w[1])) ?? 0) + 1),
          );
          expect(lines(tc).map((l) => [l.provinceId, l.text.match(/\((\d+) units?\)/)?.[1]])).toEqual(
            [...homeCount]
              .sort((a, b) => Number(a[0].slice(9)) - Number(b[0].slice(9)))
              .map(([g, n]) => [Number(g.slice(9)), String(n)]),
          );
          want.forEach((w) =>
            String(w[1]).startsWith('garrison') ? seen.home++ : w[2] != null ? seen.waiting++ : seen.stays++,
          );
        },
      ),
    );
    expect(seen.home).toBeGreaterThan(0);
    expect(seen.waiting).toBeGreaterThan(0);
    expect(seen.stays).toBeGreaterThan(0);
  });

  test('noteEntered: the provinces each realm entered this phase, once each; nothing for no realm or no province', () => {
    const { tc } = stage({ heroes: [], owner: [], ph: 0 });
    noteEntered(tc, 0, 5);
    noteEntered(tc, 0, 5);
    noteEntered(tc, 0, 2);
    noteEntered(tc, 1, 5);
    noteEntered(tc, null, 3);
    noteEntered(tc, 2, null);
    const entered = tc['enteredThisPhase'] as Record<string, Set<number>>;
    expect(Object.fromEntries(Object.entries(entered).map(([pi, s]) => [pi, [...s]]))).toEqual({ 0: [5, 2], 1: [5] });
  });

  test('flushIntrusionNotifications: one line per sighting, to the realm that saw it, its seasons as a range or a list', () => {
    const { tc } = stage({ heroes: [], owner: [], ph: 0 });
    const acc = tc['_intrusionAcc'] as Map<string, unknown>;
    const make = vm.runInContext('(phases)=>new Set(phases)', engine) as (phases: number[]) => Set<number>;
    const sighting = { acName: 'Hero 1', actingName: 'Realm A', provName: 'Highmere', provId: 4 };
    acc.set('a', {
      ...sighting,
      branch: 'own',
      targetPi: 1,
      phases: make([2, 1, 3]),
      forceByPhase: { 1: 'a host', 2: 'a host', 3: 'a host' },
    });
    acc.set('b', {
      ...sighting,
      branch: 'shared',
      targetPi: 2,
      phases: make([0, 2]),
      forceByPhase: { 0: 'a host', 2: 'a great host' },
    });
    flushIntrusionNotifications(tc);
    expect(lines(tc).map((l) => [l.type, l.targets, l.provinceId, l.public, l.text])).toEqual([
      [
        'combat',
        [1],
        4,
        false,
        '[Intelligence] Hero 1 of Realm A was spotted in your province of Highmere during Early Summer–Fall. They appear to be leading a host.',
      ],
      [
        'system',
        [2],
        4,
        false,
        '[Intelligence] A hero of Realm A (Hero 1) shared Highmere with your forces during Spring, Late Summer. Their strength shifted — most recently (Late Summer) leading a great host.',
      ],
    ]);
  });
});
