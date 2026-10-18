// The Defend watch (lifted out of resolveTurn in plan P1-08i2), called directly in the bare vm (tests/lib/engine.ts).
// Each case is staged on the middle of a bot world made by the engine: a province, its six neighbours and theirs, all
// open plain and empty but for the heroes staged there; realms 0 and 1 at war, 0 and 2 allied, 1 and 2 at peace.
// Properties (fast-check, seeded from KC_SEED) over made-up watches:
// - inDefendZone: the watch covers the province the hero stands in and its neighbours, and nothing while it is off.
// - defendBattleLocked: a hero is held only where a battle is unresolved and an armed foe (an enemy, a neutral host or
//   a leaderless one) still stands with him.
// - defendAnswerUnitGain: when an enemy raises a host in a province of a realm, the generals of that realm on watch next
//   door ride in, each once, if they lead troops, have a point of movement of the right kind, can make the crossing and
//   are held by no battle; "would he answer?" (the dry run) names the same generals and changes nothing.
// - runDefendReactions: a general rides out at most once a phase, only into a province of his realm next door that an
//   enemy column is marching into, the heaviest such threat, spending one point; one whose own province is the
//   target holds it.
// - runReinforcementArrivals: a column marching into its own province, which an enemy column will reach first, is
//   hurried in ahead of it, spending one point; a faster column is left to march as it would.
// Staged: the ride-out to a host already standing in the watch (runDefendMaterializedReactions), the lone hero's ambush
// (runDefendAmbush, the first die pinned), and what a general is told when his ride-out met no battle
// (reconcileDefendRideOuts).
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs. The balance
// matrix calls each of them, but never runs the ride-in to a raised host, the battle with a host standing in the watch,
// a column hurried in, or a ride-out that met no battle (V8 coverage, P1-08i2); here they are called directly. The page
// tests defend-once and defend-naval-overland stage some of them in whole turns.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';

interface Unit {
  type: string;
  quality: string;
  race: string;
  unitName: string;
}
interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters: number[];
  visitedBy?: number[];
  _battleUnresolved?: boolean;
  _hadBattleThisTurn?: boolean;
  _takenByUnitGain?: { turn: number; ph: number; from: number };
  [key: string]: unknown;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  isKing: boolean;
  alive: boolean;
  location: number;
  armies: Unit[];
  skills: Record<string, number>;
  _defend?: { active: boolean };
  _defendReactedPhase?: number;
  _defendRideOut?: { ph: number; provId: number; fromId: number; names: string[] };
  _attackedFrom?: number;
  _encounteredThisPhase?: number | null;
  _enteredProvThisPhase?: number;
  _leaderlessHost?: boolean;
  [key: string]: unknown;
}
interface World {
  turn: number;
  relations: Record<string, string>;
  players: { provinces: number[] }[];
  characters: Character[];
  turnOrders: Record<number, ({ action: string; target?: string } | null)[]>;
  world: { cols: number; rows: number; provinces: Province[] };
}
interface Intent {
  c: Character;
  id: number;
  player: number;
  action: string;
  fromId: number;
  toId: number | null;
  dest: Province | null;
  cancelled: boolean;
  cancelReason: string | null;
}
type Intents = Map<number, Intent>;
interface Line {
  type: string;
  text: string;
  charId: number | null;
  provinceId: number | null;
}

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const WORLD = botWorld(engine, 3, { cols: 12, rows: 8 }, { seaPct: 20 });
const PH = 2;
const inDefendZone = engineFn(engine, 'inDefendZone') as (tc: TurnContext, c: Character, P: Province | null) => boolean;
const defendBattleLocked = engineFn(engine, 'defendBattleLocked') as (
  tc: TurnContext,
  c: Character,
  here: Province,
) => boolean;
const defendAnswerUnitGain = engineFn(engine, 'defendAnswerUnitGain') as (
  tc: TurnContext,
  raiser: Character,
  prov: Province,
  ph: number,
  dryRun?: boolean,
) => Character[];
const runDefendReactions = engineFn(engine, 'runDefendReactions') as (
  tc: TurnContext,
  ph: number,
  intents: Intents,
) => void;
const reconcileDefendRideOuts = engineFn(engine, 'reconcileDefendRideOuts') as (tc: TurnContext, ph: number) => void;
const runDefendMaterializedReactions = engineFn(engine, 'runDefendMaterializedReactions') as (
  tc: TurnContext,
  ph: number,
) => void;
const runDefendAmbush = engineFn(engine, 'runDefendAmbush') as (tc: TurnContext, ph: number) => void;
const runReinforcementArrivals = engineFn(engine, 'runReinforcementArrivals') as (
  tc: TurnContext,
  ph: number,
  intents: Intents,
) => void;
const buildPhaseIntents = engineFn(engine, 'buildPhaseIntents') as (tc: TurnContext, ph: number) => Intents;
const isHostileInvasion = engineFn(engine, 'isHostileInvasion') as (tc: TurnContext, it: Intent) => boolean;
const phaseInitCompare = engineFn(engine, 'phaseInitCompare') as (
  tc: TurnContext,
  ph: number,
) => (a: Character, b: Character) => number;
const armyTotalStr = engineFn(engine, 'armyTotalStr') as (tc: TurnContext, c: Character, prov: Province) => number;
const effStat = engineFn(engine, 'effStat') as (tc: TurnContext, c: Character, stat: string) => number;
const getNeighborsP = engineFn(engine, 'getNeighborsP') as (
  p: Province,
  cols: number,
  rows: number,
  ps: Province[],
) => Province[];
const kcRng = vm.runInContext('kcRng', engine) as { use(next: () => number): () => number };

const must = <T>(x: T | undefined | null, what: string): T => {
  if (x == null) throw new Error('missing ' + what);
  return x;
};
/** Runs `body` with the first die the engine draws pinned to `first` ([0, 1)), the rest from the dice as they were. */
function firstDie<T>(first: number, body: () => T): T {
  let pinned = true;
  const was = kcRng.use(() => {
    if (!pinned) return was();
    pinned = false;
    return first;
  });
  try {
    return body();
  } finally {
    kcRng.use(was);
  }
}

// ── The board ────
let nextId = 9000;
/** A fresh turn's context in phase PH on the bot world, with its middle cleared: the province at row 4, column 5 (X),
 *  its neighbours (ring1) and theirs (ring2) are open plain, unowned, with no garrison, guard or lair; nobody stands
 *  anywhere (every character is gone) and nobody has orders. */
function board() {
  const tc = turnContext(engine, WORLD);
  tc._currentPhase = PH;
  tc._logCtx.phase = PH;
  const G = tc.G as unknown as World;
  G.relations = { '0-1': 'enemy', '0-2': 'allied', '1-2': 'peace' };
  G.characters = [];
  G.turnOrders = {};
  const ps = G.world.provinces;
  ps.forEach((p) => {
    p.characters = [];
  });
  const nbrs = (p: Province) => getNeighborsP(p, G.world.cols, G.world.rows, ps);
  const X = must(
    ps.find((p) => p.row === 4 && p.col === 5),
    'the middle province',
  );
  const ring1 = nbrs(X);
  const ring2 = [...new Set(ring1.flatMap(nbrs))].filter((p) => p !== X && !ring1.includes(p));
  const near = [X, ...ring1, ...ring2];
  near.forEach((p) =>
    Object.assign(p, {
      terrain: 'plain',
      owner: null,
      features: [],
      garrisonArmies: [],
      neutralDefenders: [],
      npcArmies: 0,
    }),
  );
  G.players.forEach((pl) => {
    pl.provinces = pl.provinces.filter((id) => !near.some((p) => p.id === id));
  });
  const own = (p: Province, pi: number | null) => {
    G.players.forEach((pl) => {
      pl.provinces = pl.provinces.filter((id) => id !== p.id);
    });
    p.owner = pi;
    if (pi != null) must(G.players[pi], 'realm ' + String(pi)).provinces.push(p.id);
  };
  const lines = () => tc.turnLog as unknown as Line[];
  return { tc, G, X, ring1, ring2, near, nbrs, own, lines };
}
type Board = ReturnType<typeof board>;

interface HeroSpec {
  player: number | null;
  at: Province;
  troops?: number;
  naval?: boolean;
  watch?: boolean;
  land?: number;
  sea?: number;
  king?: boolean;
  skills?: Record<string, number>;
}
/** Stands a new hero of `player` in `at`: `troops` companies of Men-at-Arms (with a fleet if `naval`), on a Defend watch
 *  if `watch`, with `land` and `sea` points of movement left (sea points count only with a fleet or for a hero with none,
 *  as the turn sets them). */
function hero(b: Board, s: HeroSpec): Character {
  const id = ++nextId;
  const armies: Unit[] = Array.from({ length: s.troops ?? 0 }, (_, k) => ({
    type: 'Men-at-Arms',
    quality: 'Regular',
    race: 'Human',
    unitName: `Men-at-Arms #${String(id)}.${String(k)}`,
  }));
  if (s.naval)
    armies.push({ type: 'Galleon Fleet', quality: 'Regular', race: 'Human', unitName: `Fleet #${String(id)}` });
  const c: Character = {
    id,
    name: `Hero ${String(id)}`,
    isKing: !!s.king,
    player: s.player,
    race: 'Human',
    alignment: 'Divine',
    temper: 'Cautious',
    hp: 20,
    maxHp: 20,
    skills: s.skills ?? { melee: 2, tactical: 2, march: 1 },
    aptitude: {},
    armies,
    items: [],
    location: s.at.id,
    locationName: s.at.name,
    alive: true,
    merits: 0,
    spellsUsedThisTurn: [],
    ...(s.watch ? { _defend: { active: true } } : {}),
  };
  b.G.characters.push(c);
  s.at.characters.push(id);
  const pools = b.tc as unknown as Record<string, Record<number, unknown>>;
  must(pools['movePoints'], 'movePoints')[id] = s.land ?? 1;
  must(pools['seaMovePoints'], 'seaMovePoints')[id] = s.sea ?? 0;
  must(pools['seaMoveActive'], 'seaMoveActive')[id] = !!s.naval && (s.sea ?? 0) > 0;
  must(pools['seaCap'], 'seaCap')[id] = s.naval ? 'all' : 'land';
  return c;
}
const points = (b: Board, c: Character) => {
  const pools = b.tc as unknown as Record<string, Record<number, number>>;
  return { land: pools['movePoints']?.[c.id] ?? 0, sea: pools['seaMovePoints']?.[c.id] ?? 0 };
};
const move = (b: Board, c: Character, to: Province) => {
  b.G.turnOrders[c.id] = [null, null, null, null, null];
  must(b.G.turnOrders[c.id], 'orders')[PH] = { action: 'Move', target: `prov:${String(to.id)}` };
};
const linesOf = (b: Board, c: Character) => b.lines().filter((l) => l.charId === c.id);

// ── The watch zone and the unresolved battle ────
describe('the watch zone and the battle that holds a general', () => {
  test('inDefendZone: the province the hero stands in and its neighbours, while the watch is on', () => {
    const b = board();
    const all = b.G.world.provinces;
    for (const at of b.near) {
      const c = hero(b, { player: 0, at, watch: true });
      const zone = new Set([at.id, ...b.nbrs(at).map((p) => p.id)]);
      expect(all.filter((P) => inDefendZone(b.tc, c, P)).map((P) => P.id)).toEqual(
        all.filter((P) => zone.has(P.id)).map((P) => P.id),
      );
      expect(inDefendZone(b.tc, c, null)).toBe(false);
      c._defend = { active: false };
      expect(all.some((P) => inDefendZone(b.tc, c, P))).toBe(false);
      delete c._defend;
      expect(all.some((P) => inDefendZone(b.tc, c, P))).toBe(false);
    }
  });

  const other = fc.record({
    player: fc.constantFrom<number | null>(null, 0, 1, 1, 2),
    state: fc.constantFrom('alive', 'alive', 'fallen', 'leaderless host'),
    troops: fc.nat(2),
  });
  test('defendBattleLocked: only an unresolved battle with an armed foe still standing there holds him', () => {
    const seen = { held: 0, free: 0 };
    fc.assert(
      fc.property(fc.array(other, { maxLength: 4 }), fc.boolean(), (others, unresolved) => {
        const b = board();
        const c = hero(b, { player: 0, at: b.X, troops: 1, watch: true });
        if (unresolved) b.X._battleUnresolved = true;
        const foes = others.map((o) => {
          const e = hero(b, { player: o.player, at: b.X, troops: o.troops });
          if (o.state !== 'alive') e.alive = false;
          if (o.state === 'leaderless host') e._leaderlessHost = true;
          return { e, o };
        });
        const want =
          unresolved &&
          foes.some(({ o }) => o.state !== 'fallen' && o.troops > 0 && (o.player === null || o.player === 1));
        expect(defendBattleLocked(b.tc, c, b.X)).toBe(want);
        seen[want ? 'held' : 'free']++;
      }),
    );
    expect(seen.held).toBeGreaterThan(0);
    expect(seen.free).toBeGreaterThan(0);
  });
});

// ── A host raised in the watch: the generals next door ride in at once ────
const watcher = fc.record({
  player: fc.constantFrom(0, 0, 0, 2),
  where: fc.constantFrom('ring1', 'ring1', 'ring1', 'X', 'ring2'),
  slot: fc.nat(17),
  watch: fc.constantFrom(true, true, true, false),
  troops: fc.constantFrom(0, 1, 1, 2),
  naval: fc.constantFrom(false, false, true),
  seaGround: fc.constantFrom(false, false, false, true),
  land: fc.nat(2),
  sea: fc.nat(1),
  reacted: fc.constantFrom(false, false, false, false, true),
  fledInMercy: fc.constantFrom(false, false, false, false, false, true),
  heldByBattle: fc.constantFrom(false, false, false, false, true),
});
const raising = fc.record({
  raiser: fc.constantFrom(1, 1, 1, 1, 2, 0),
  veiled: fc.constantFrom(false, false, false, false, true),
  watchers: fc.array(watcher, { minLength: 1, maxLength: 5 }),
});
type Raising = typeof raising extends fc.Arbitrary<infer T> ? T : never;
function stageRaising(r: Raising) {
  const b = board();
  b.own(b.X, 0);
  b.near
    .filter((p) => p !== b.X)
    .forEach((p) => {
      b.own(p, 0);
    });
  const raiser = hero(b, { player: r.raiser, at: b.X, troops: 2 });
  if (r.veiled) Object.assign(raiser, { _veilTurn: b.G.turn, _veilCastPhase: PH });
  const ws = r.watchers.map((w) => {
    const at =
      w.where === 'X' ? b.X : must((w.where === 'ring1' ? b.ring1 : b.ring2)[w.slot % 6], 'a province near the middle');
    if (w.seaGround) at.terrain = 'sea';
    const d = hero(b, {
      player: w.player,
      at,
      troops: w.troops,
      naval: w.naval,
      watch: w.watch,
      land: w.land,
      sea: w.sea,
    });
    if (w.reacted) d._defendReactedPhase = PH;
    if (w.fledInMercy) d['_mercyFledTurn'] = b.G.turn;
    if (w.heldByBattle) {
      at._battleUnresolved = true;
      hero(b, { player: 1, at, troops: 1 });
    }
    return d;
  });
  return { b, raiser, ws };
}

describe('a host raised in the watch (defendAnswerUnitGain)', () => {
  test('the generals next door who can answer ride in, each once; the dry run names them and changes nothing', () => {
    const seen = { rode: 0, stayed: 0 };
    fc.assert(
      fc.property(raising, (r) => {
        const { b, raiser, ws } = stageRaising(r);
        const before = JSON.stringify([b.G, b.tc['movePoints'], b.tc['seaMovePoints']]);
        const asked = defendAnswerUnitGain(b.tc, raiser, b.X, PH, true).map((d) => d.id);
        expect(JSON.stringify([b.G, b.tc['movePoints'], b.tc['seaMovePoints']])).toBe(before);
        expect(b.lines()).toEqual([]);
        // who can answer, as the rule says
        const raisable = r.raiser === 1 && !r.veiled;
        const startsAt = new Map(ws.map((d) => [d.id, must(b.G.world.provinces[d.location], 'his province')]));
        const startPts = new Map(ws.map((d) => [d.id, points(b, d)]));
        const can = ws.filter((d, i) => {
          const w = must(r.watchers[i], 'watcher');
          const here = must(startsAt.get(d.id), 'his province');
          const bySea = here.terrain === 'sea' || b.X.terrain === 'sea';
          return (
            raisable &&
            w.player === 0 &&
            w.watch &&
            w.troops + (w.naval ? 1 : 0) > 0 && // only a general leading a column rides
            (b.X.terrain === 'sea' ? w.naval : w.troops > 0) && // only a fleet takes to the sea; ships alone can't land
            w.where === 'ring1' &&
            !w.reacted &&
            !w.fledInMercy &&
            !here._battleUnresolved && // held by the battle where he stands (an enemy column is staged with it)
            !(w.naval && !bySea) && // ships never cross land
            !(here.terrain === 'sea' && !(w.naval && w.sea > 0)) && // stranded on drowned ground
            (bySea ? w.sea : w.land) > 0
          );
        });
        const rode = defendAnswerUnitGain(b.tc, raiser, b.X, PH).map((d) => d.id);
        expect(rode).toEqual(can.map((d) => d.id));
        expect(asked).toEqual(rode);
        // each rider is in the province, listed there and no longer where he stood, has spent one point of the right
        // kind and is told once; everyone else is where he was, with his points
        const told = (d: Character) => linesOf(b, d).filter((l) => l.text.startsWith(`🛡 ${d.name} is standing watch`));
        const after = (d: Character) => {
          const from = must(startsAt.get(d.id), 'his province');
          return {
            at: d.location,
            listed: [b.X.characters.filter((id) => id === d.id).length, from.characters.includes(d.id)],
            from: d._attackedFrom,
            reacted: d._defendReactedPhase,
            points: points(b, d),
            told: told(d).length,
          };
        };
        const expected = (d: Character, i: number) => {
          const from = must(startsAt.get(d.id), 'his province');
          const was = must(startPts.get(d.id), 'his points');
          const w = must(r.watchers[i], 'watcher');
          if (!rode.includes(d.id))
            return {
              at: from.id,
              listed: [from === b.X ? 1 : 0, true],
              from: undefined,
              reacted: w.reacted ? PH : undefined,
              points: was,
              told: 0,
            };
          const bySea = from.terrain === 'sea' || b.X.terrain === 'sea';
          return {
            at: b.X.id,
            listed: [1, false],
            from: from.id,
            reacted: PH,
            points: bySea ? { ...was, sea: was.sea - 1 } : { ...was, land: was.land - 1 },
            told: 1,
          };
        };
        expect(ws.map(after)).toEqual(ws.map(expected));
        expect(b.X.visitedBy?.includes(0) ?? false).toBe(rode.length > 0);
        seen.rode += rode.length;
        seen.stayed += ws.length - rode.length;
        // once each: a second call in the same phase sends nobody more
        expect(defendAnswerUnitGain(b.tc, raiser, b.X, PH)).toEqual([]);
      }),
      { numRuns: 300 },
    );
    expect(seen.rode).toBeGreaterThan(0);
    expect(seen.stayed).toBeGreaterThan(0);
  });

  test('a general with ships and troops on the sea next door answers by sea, with a sea point', () => {
    const b = board();
    b.own(b.X, 0);
    const A = must(b.ring1[0], 'A');
    A.terrain = 'sea';
    const d = hero(b, { player: 0, at: A, troops: 2, naval: true, watch: true, land: 0, sea: 1 });
    const raiser = hero(b, { player: 1, at: b.X, troops: 2 });
    expect(defendAnswerUnitGain(b.tc, raiser, b.X, PH).map((r) => r.id)).toEqual([d.id]);
    expect([d.location, points(b, d)]).toEqual([b.X.id, { land: 0, sea: 0 }]);
  });
});

// ── Columns on the march: the ride-out before the marches, and the column hurried in ────
const column = fc.record({
  player: fc.constantFrom(0, 0, 1, 1, 1, 2),
  where: fc.constantFrom('X', 'ring1', 'ring1', 'ring2'),
  slot: fc.nat(17),
  to: fc.nat(5),
  troops: fc.constantFrom(1, 1, 2, 3),
  march: fc.nat(3),
  land: fc.constantFrom(0, 1, 1, 2),
  watch: fc.constantFrom(false, false, true),
});
const marching = fc.record({
  columns: fc.array(column, { minLength: 2, maxLength: 7 }),
  owners: fc.array(fc.constantFrom<number | null>(0, 0, 0, 1, 2, null), { minLength: 25, maxLength: 25 }),
});
type Marching = typeof marching extends fc.Arbitrary<infer T> ? T : never;
/** Columns of the three realms around the middle: each on a Move to a neighbour, or on a Defend watch, standing. */
function stageMarching(m: Marching) {
  const b = board();
  b.near.forEach((p, i) => {
    b.own(p, m.owners[i % m.owners.length] ?? null);
  });
  const cs = m.columns.map((k) => {
    const at = k.where === 'X' ? b.X : must((k.where === 'ring1' ? b.ring1 : b.ring2)[k.slot % 6], 'a province');
    const c = hero(b, {
      player: k.player,
      at,
      troops: k.troops,
      watch: k.watch,
      land: k.land,
      skills: { melee: 1, tactical: 1, march: k.march },
    });
    if (!k.watch) move(b, c, must(b.nbrs(at)[k.to % b.nbrs(at).length], 'a neighbour'));
    return c;
  });
  return { b, cs };
}

describe('the ride-out before the marches (runDefendReactions)', () => {
  test('a general rides at most once, into his realm’s province next door that the heaviest enemy column enters', () => {
    const seen = { rode: 0, held: 0, stayed: 0 };
    fc.assert(
      fc.property(marching, (m) => {
        const { b, cs } = stageMarching(m);
        const intents = buildPhaseIntents(b.tc, PH);
        const invasions = [...intents.values()].filter((it) => isHostileInvasion(b.tc, it));
        const threat = new Map<number, number>();
        for (const inv of invasions)
          threat.set(
            must(inv.toId, 'a target'),
            (threat.get(inv.toId ?? -1) ?? 0) + armyTotalStr(b.tc, inv.c, must(inv.dest, 'dest')),
          );
        const start = new Map(cs.map((c) => [c.id, { at: c.location, pts: points(b, c) }]));
        runDefendReactions(b.tc, PH, intents);
        for (const c of cs) {
          const s = must(start.get(c.id), 'start');
          const here = must(b.G.world.provinces[s.at], 'his province');
          const onWatch = !!c._defend?.active;
          const hasPoint = s.pts.land > 0;
          const near = b.nbrs(here).map((p) => p.id);
          const cands = [...threat.keys()].filter((id) => {
            const P = must(b.G.world.provinces[id], 'province');
            return (
              id !== here.id &&
              near.includes(id) &&
              P.owner === c.player &&
              !invasions.some((inv) => inv.toId === id && inv.player === c.player)
            );
          });
          const heaviest = Math.max(...cands.map((id) => threat.get(id) ?? 0));
          const kind =
            !onWatch || !hasPoint || invasions.length === 0
              ? 'idle'
              : threat.has(here.id)
                ? 'holds' // his own province is the target: he holds it, and that is his reaction
                : cands.length > 0
                  ? 'rides'
                  : 'idle';
          const now = must(b.G.world.provinces[c.location], 'where he is');
          const got = {
            at:
              c.location === s.at
                ? 'where he stood'
                : cands.includes(c.location) && threat.get(c.location) === heaviest
                  ? 'the heaviest threat next door'
                  : 'elsewhere',
            reacted: c._defendReactedPhase,
            points: points(b, c),
            from: c._attackedFrom,
            rideOut: c._defendRideOut
              ? [c._defendRideOut.ph, c._defendRideOut.provId === c.location, c._defendRideOut.fromId]
              : null,
            listed: [now.characters.includes(c.id), here.characters.includes(c.id)],
            holds: linesOf(b, c).filter((l) => l.text.includes(` holds ${here.name} rather than march`)).length,
          };
          const stays = {
            at: 'where he stood',
            reacted: undefined,
            points: s.pts,
            from: undefined,
            rideOut: null,
            listed: [true, true],
            holds: 0,
          };
          const want =
            kind === 'rides'
              ? {
                  at: 'the heaviest threat next door',
                  reacted: PH,
                  points: { ...s.pts, land: s.pts.land - 1 },
                  from: s.at,
                  rideOut: [PH, true, s.at],
                  listed: [true, false],
                  holds: 0,
                }
              : kind === 'holds'
                ? { ...stays, reacted: PH, holds: 1 }
                : stays;
          expect(got).toEqual(want);
          seen[kind === 'rides' ? 'rode' : kind === 'holds' ? 'held' : 'stayed']++;
        }
      }),
      { numRuns: 400 },
    );
    expect(seen.rode).toBeGreaterThan(0);
    expect(seen.held).toBeGreaterThan(0);
    expect(seen.stayed).toBeGreaterThan(0);
  });

  test('a general on drowned ground without a fleet is told he is stranded, and stays', () => {
    const b = board();
    const [A, B] = [must(b.ring1[0], 'A'), b.X];
    b.own(B, 0);
    A.terrain = 'sea';
    const d = hero(b, { player: 0, at: A, troops: 2, watch: true, land: 1 });
    const e = hero(b, {
      player: 1,
      at: must(
        b.ring1.find((p) => b.nbrs(B).includes(p) && p !== A),
        'E',
      ),
      troops: 2,
    });
    move(b, e, B);
    runDefendReactions(b.tc, PH, buildPhaseIntents(b.tc, PH));
    expect(d.location).toBe(A.id);
    expect(linesOf(b, d).map((l) => l.text)).toEqual([
      `${d.name} is stranded by the waters covering ${A.name} — without a fleet their troops cannot march out, and hold what ground remains.`,
    ]);
  });
});

// Columns racing for the middle province: most march into it from next door, some lead no troops, and the middle is
// usually realm 0's, so a column of its own racing an enemy one is common.
const racer = fc.record({
  player: fc.constantFrom(0, 0, 1, 1, 2),
  slot: fc.nat(5),
  toMiddle: fc.constantFrom(true, true, true, false),
  to: fc.nat(5),
  troops: fc.constantFrom(0, 1, 1, 2),
  march: fc.nat(3),
  land: fc.constantFrom(0, 1, 1, 2),
});
const racing = fc.record({
  middle: fc.constantFrom<number | null>(0, 0, 0, 1, 2, null),
  racers: fc.array(racer, { minLength: 2, maxLength: 6 }),
});
function stageRacing(r: typeof racing extends fc.Arbitrary<infer T> ? T : never) {
  const b = board();
  b.own(b.X, r.middle);
  const cs = r.racers.map((k) => {
    const at = must(b.ring1[k.slot], 'a neighbour of the middle');
    const c = hero(b, {
      player: k.player,
      at,
      troops: k.troops,
      land: k.land,
      skills: { melee: 1, tactical: 1, march: k.march },
    });
    move(b, c, k.toMiddle ? b.X : must(b.nbrs(at)[k.to % b.nbrs(at).length], 'a neighbour'));
    return c;
  });
  return { b, cs };
}

describe('the column hurried in (runReinforcementArrivals)', () => {
  test('a column marching into its own province is hurried in only when an enemy column would reach it first', () => {
    const seen = { hurried: 0, faster: 0 };
    fc.assert(
      fc.property(racing, (r) => {
        const { b, cs } = stageRacing(r);
        const intents = buildPhaseIntents(b.tc, PH);
        const invasions = [...intents.values()].filter((it) => isHostileInvasion(b.tc, it));
        const cmp = phaseInitCompare(b.tc, PH);
        const start = new Map(cs.map((c) => [c.id, { at: c.location, pts: points(b, c) }]));
        const want = [...intents.values()].filter((it) => {
          if (it.action !== 'move' || !it.dest || it.c.armies.length === 0) return false;
          if (it.dest.owner !== it.player) return false;
          const racers = invasions.filter((inv) => inv.toId === it.toId && inv.player !== it.player);
          if (racers.length === 0) return false;
          if (racers.every((inv) => cmp(it.c, inv.c) < 0)) {
            seen.faster++;
            return false;
          }
          return must(start.get(it.id), 'start').pts.land > 0;
        });
        runReinforcementArrivals(b.tc, PH, intents);
        const hurried = [...intents.values()].filter((it) => it.cancelled);
        expect(hurried.map((it) => it.id)).toEqual(want.map((it) => it.id));
        // each hurried column stands in the province it marched for, its Move spent and one land point gone, and the
        // realm is told once (the line is filed under no hero's order); every other column is where it was
        const after = (it: Intent) => ({
          at: it.c.location,
          reason: it.cancelReason,
          from: it.c._attackedFrom,
          points: points(b, it.c),
          told: b.lines().filter((l) => l.text.startsWith(`${it.c.name} force-marches into `) && l.charId === null)
            .length,
        });
        const expected = (it: Intent) => {
          const s = must(start.get(it.id), 'start');
          return hurried.includes(it)
            ? { at: it.toId, reason: 'reinforced', from: s.at, points: { ...s.pts, land: s.pts.land - 1 }, told: 1 }
            : { at: s.at, reason: null, from: undefined, points: s.pts, told: 0 };
        };
        expect([...intents.values()].map(after)).toEqual([...intents.values()].map(expected));
        seen.hurried += hurried.length;
      }),
      { numRuns: 400 },
    );
    expect(seen.hurried).toBeGreaterThan(0);
    expect(seen.faster).toBeGreaterThan(0);
  });
});

// ── A host standing in the watch: the battle after every order (runDefendMaterializedReactions) ────
describe('a host standing in the watch (runDefendMaterializedReactions)', () => {
  function stageHost() {
    const b = board();
    const [A, B] = [b.X, must(b.ring1[0], 'B')];
    b.own(A, 0);
    b.own(B, 0);
    const d = hero(b, { player: 0, at: A, troops: 3, watch: true, land: 2 });
    return { b, A, B, d };
  }

  test('a general rides out to the enemy host next door in his own province, once, and gives battle', () => {
    const { b, A, B, d } = stageHost();
    const e = hero(b, { player: 1, at: B, troops: 1 });
    runDefendMaterializedReactions(b.tc, PH);
    const told = b.lines().map((l) => l.text);
    expect(told).toContain(
      `🛡 ${d.name} stands watch — word comes that an enemy host has risen in ${B.name}. They break camp and march to meet it.`,
    );
    expect(told).toContain(`⚔ ${d.name} falls upon ${e.name}'s host in ${B.name}!`);
    expect(points(b, d)).toEqual({ land: 1, sea: 0 });
    expect(d._attackedFrom).toBe(A.id);
    expect(d._defendReactedPhase).toBe(PH);
    expect(B._hadBattleThisTurn).toBe(true);
    expect(b.tc['_combatSkillProv']).toBeNull();
    // one reaction a phase: a second pass sends him nowhere and fights nothing
    const n = b.lines().length;
    const at = d.location;
    runDefendMaterializedReactions(b.tc, PH);
    expect(b.lines().length).toBe(n);
    expect(d.location).toBe(at);
  });

  test('a host where he stands is met there: no march, no point spent', () => {
    const { b, A, d } = stageHost();
    hero(b, { player: 1, at: A, troops: 1 });
    runDefendMaterializedReactions(b.tc, PH);
    expect(b.lines().map((l) => l.text)).toContain(
      `🛡 ${d.name} stands watch as an enemy host takes shape in ${A.name} — they form their line to give battle.`,
    );
    expect(points(b, d)).toEqual({ land: 2, sea: 0 });
    expect(A._hadBattleThisTurn).toBe(true);
  });

  test('he rides to the heavier of two hosts', () => {
    const { b, d } = stageHost();
    const [B, C] = [must(b.ring1[0], 'B'), must(b.ring1[3], 'C')];
    b.own(C, 0);
    hero(b, { player: 1, at: B, troops: 1 });
    const heavy = hero(b, { player: 1, at: C, troops: 3 });
    runDefendMaterializedReactions(b.tc, PH);
    expect(b.lines().map((l) => l.text)).toContain(`⚔ ${d.name} falls upon ${heavy.name}'s host in ${C.name}!`);
    expect(C._hadBattleThisTurn).toBe(true);
    expect(B._hadBattleThisTurn).toBeUndefined();
  });

  test('he never rides into a province that isn’t his, unless the host has just taken it from him', () => {
    for (const [owner, taken, rides] of [
      [2, false, false],
      [null, false, false],
      [1, false, false],
      [1, true, true],
    ] as const) {
      const { b, B, d } = stageHost();
      b.own(B, owner);
      if (taken) B._takenByUnitGain = { turn: b.G.turn, ph: PH, from: 0 };
      hero(b, { player: 1, at: B, troops: 1 });
      runDefendMaterializedReactions(b.tc, PH);
      expect([owner, taken, b.lines().length > 0, points(b, d).land]).toEqual([owner, taken, rides, rides ? 1 : 2]);
    }
  });

  test('a general held by nothing stays when the host is a friend’s, the province is contested, or he has no point left', () => {
    const cases: [string, (s: ReturnType<typeof stageHost>) => void][] = [
      [
        'an ally’s host',
        (s) => {
          hero(s.b, { player: 2, at: s.B, troops: 2 });
        },
      ],
      [
        'a realm at peace',
        (s) => {
          hero(s.b, { player: 1, at: s.B, troops: 2 });
          s.b.G.relations['0-1'] = 'peace';
        },
      ],
      [
        'a contested province',
        (s) => {
          hero(s.b, { player: 1, at: s.B, troops: 2 });
          s.B._battleUnresolved = true;
        },
      ],
      [
        'no point left',
        (s) => {
          hero(s.b, { player: 1, at: s.B, troops: 2 });
          Object.assign(must(s.b.tc['movePoints'] as Record<number, number>, 'pools'), { [s.d.id]: 0 });
        },
      ],
      [
        'reacted already',
        (s) => {
          hero(s.b, { player: 1, at: s.B, troops: 2 });
          s.d._defendReactedPhase = PH;
        },
      ],
      [
        'an enemy hero with no troops',
        (s) => {
          hero(s.b, { player: 1, at: s.B, troops: 0 });
        },
      ],
    ];
    for (const [what, set] of cases) {
      const s = stageHost();
      set(s);
      runDefendMaterializedReactions(s.b.tc, PH);
      expect([what, s.d.location, s.b.lines().length]).toEqual([what, s.A.id, 0]);
    }
  });
});

// ── The lone hero's ambush (runDefendAmbush) ────
type Foe = Omit<HeroSpec, 'at'> & { at: 'B' | 'C' | 'far'; stayed?: boolean; extra?: Record<string, unknown> };
/** A lone hero of realm 0 on watch in the middle (Spy `spy`; a king if `king`), and the foes given, in B or C (two of
 *  its neighbours) or two provinces out, each having marched this phase into the province it stands in unless
 *  `stayed`. */
function stageAmbush(spy: number, foes: Foe[], king = false) {
  const b = board();
  const where = { B: must(b.ring1[0], 'B'), C: must(b.ring1[3], 'C'), far: must(b.ring2[0], 'far') };
  const c = hero(b, { player: 0, at: b.X, watch: true, king, skills: { spy, melee: 3 } });
  const es = foes.map((f) => {
    const at = where[f.at];
    const e = hero(b, { ...f, at });
    if (!f.stayed) e._enteredProvThisPhase = at.id;
    Object.assign(e, f.extra ?? {});
    return e;
  });
  return { b, c, es, ...where };
}
const ambushOdds = (b: Board) => b.lines().filter((l) => l.text.startsWith('📊 Ambush'));

describe('the ambush of a hero with no troops on watch (runDefendAmbush)', () => {
  test('the chance is 10% and 9% a level of Spy, at most 90%, halved against a hero leading troops', () => {
    for (let spy = 0; spy <= 9; spy++)
      for (const guarded of [false, true]) {
        const s = stageAmbush(spy, [{ player: 1, at: 'B', troops: guarded ? 1 : 0 }]);
        firstDie(0.999, () => {
          runDefendAmbush(s.b.tc, PH);
        });
        const skill = effStat(s.b.tc, s.c, 'spy');
        const base = Math.min(90, 10 + skill * 9);
        const chance = guarded ? Math.floor(base / 2) : base;
        const quarry = must(s.es[0], 'foe').name;
        expect(ambushOdds(s.b).map((l) => l.text)).toEqual([
          `📊 Ambush — ${s.c.name} (Spy ${String(skill)}) lies in wait for ${quarry}${guarded ? ' (guarded — halved)' : ''}: ${String(chance)}% [roll 100 ✗]`,
        ]);
      }
  });

  test('a missed ambush spends the watch for the phase; nobody moves or fights', () => {
    const s = stageAmbush(5, [{ player: 1, at: 'B' }]);
    firstDie(0.999, () => {
      runDefendAmbush(s.b.tc, PH);
    });
    const e = must(s.es[0], 'foe');
    expect(s.b.lines().map((l) => l.text)).toContain(
      `${s.c.name} watches ${e.name} pass through ${s.B.name} but cannot find the opening to strike.`,
    );
    expect([s.c.location, s.c._defendReactedPhase, s.c._encounteredThisPhase, e._encounteredThisPhase]).toEqual([
      s.b.X.id,
      PH,
      undefined,
      undefined,
    ]);
  });

  test('a sprung ambush closes on the quarry and forces the fight; the watch is done', () => {
    const s = stageAmbush(5, [{ player: 1, at: 'B' }]);
    firstDie(0, () => {
      runDefendAmbush(s.b.tc, PH);
    });
    const e = must(s.es[0], 'foe');
    expect(s.b.lines().map((l) => l.text)).toContain(
      `⚔ ${s.c.name} springs from cover and sets upon ${e.name} in ${s.B.name}!`,
    );
    expect({
      at: s.c.location,
      listed: [s.B.characters.includes(s.c.id), s.b.X.characters.includes(s.c.id)],
      visited: s.B.visitedBy,
      fought: [s.c._encounteredThisPhase, e._encounteredThisPhase],
      reacted: s.c._defendReactedPhase,
      watching: s.c.alive && s.c._defend?.active,
      battle: s.B._hadBattleThisTurn, // a personal fight, not a battle
      skillProvince: s.b.tc['_combatSkillProv'],
    }).toEqual({
      at: s.B.id,
      listed: [true, false],
      visited: [0],
      fought: [e.id, s.c.id],
      reacted: PH,
      watching: false,
      battle: undefined,
      skillProvince: null,
    });
  });

  test('the quarry: a king only for a king, and first; then the heaviest column', () => {
    const quarry = (foes: Foe[], king = false) => {
      const s = stageAmbush(3, foes, king);
      firstDie(0.999, () => {
        runDefendAmbush(s.b.tc, PH);
      });
      const line = must(ambushOdds(s.b)[0], 'the odds line').text;
      return s.es.findIndex((e) => line.includes(` lies in wait for ${e.name}`));
    };
    const column: Foe = { player: 1, at: 'B', troops: 1 };
    expect(quarry([column, { player: 1, at: 'C', king: true }])).toBe(0);
    expect(quarry([column, { player: 1, at: 'C', king: true }], true)).toBe(1);
    expect(quarry([column, { player: 1, at: 'C', troops: 3 }])).toBe(1);
    expect(quarry([{ player: 1, at: 'C', troops: 3 }, column])).toBe(0);
  });

  test('no ambush of a hero who did not march in, is vanished, was already fought, or is not an enemy; nor by an armed one', () => {
    const cases: [string, Foe[], ((s: ReturnType<typeof stageAmbush>) => void)?][] = [
      ['stood still', [{ player: 1, at: 'B', stayed: true }]],
      ['vanished', [{ player: 1, at: 'B', extra: { _vanishTurn: 1 } }]],
      ['already fought', [{ player: 1, at: 'B', extra: { _encounteredThisPhase: 1 } }]],
      ['at peace', [{ player: 2, at: 'B' }]],
      ['a king', [{ player: 1, at: 'B', king: true }]],
      ['too far', [{ player: 1, at: 'far' }]],
      [
        'an armed watcher',
        [{ player: 1, at: 'B' }],
        (s) => {
          s.c.armies.push({ type: 'Men-at-Arms', quality: 'Regular', race: 'Human', unitName: 'Men-at-Arms #0' });
        },
      ],
      [
        'watched already',
        [{ player: 1, at: 'B' }],
        (s) => {
          s.c._defendReactedPhase = PH;
        },
      ],
    ];
    for (const [what, foes, set] of cases) {
      const s = stageAmbush(5, foes);
      set?.(s);
      firstDie(0, () => {
        runDefendAmbush(s.b.tc, PH);
      });
      expect([what, s.b.lines().length, s.c.location]).toEqual([what, 0, s.b.X.id]);
    }
  });
});

// ── What a general is told when his ride-out met no battle (reconcileDefendRideOuts) ────
describe('a ride-out that met no battle (reconcileDefendRideOuts)', () => {
  function stageRideOut() {
    const b = board();
    const [A, P] = [b.X, must(b.ring1[0], 'P')];
    b.own(A, 0);
    b.own(P, 0);
    const d = hero(b, { player: 0, at: P, troops: 2, watch: true });
    d._defendRideOut = { ph: PH, provId: P.id, fromId: A.id, names: ['Hero One'] };
    return { b, P, d };
  }
  test('no enemy came: he is told they never crossed the border', () => {
    const { b, P, d } = stageRideOut();
    reconcileDefendRideOuts(b.tc, PH);
    expect(linesOf(b, d).map((l) => l.text)).toEqual([
      `🛡 ${d.name} reaches ${P.name} in battle order, but Hero One never crossed the border — no battle is fought, and they hold ${P.name} for the rest of the season.`,
    ]);
    expect(d._defendRideOut).toBeUndefined();
  });
  test('an enemy column stands there unfought: the contest is settled next phase', () => {
    const { b, P, d } = stageRideOut();
    hero(b, { player: 1, at: P, troops: 1 });
    reconcileDefendRideOuts(b.tc, PH);
    expect(linesOf(b, d).map((l) => l.text)).toEqual([
      `🛡 ${d.name} stands in ${P.name} facing an enemy column, but no battle was joined this season — the contest will be settled next phase.`,
    ]);
  });
  test('a veiled enemy is not seen: the general reads that nobody came', () => {
    const { b, P, d } = stageRideOut();
    const e = hero(b, { player: 1, at: P, troops: 1 });
    Object.assign(e, { _veilTurn: b.G.turn, _veilCastPhase: PH });
    reconcileDefendRideOuts(b.tc, PH);
    expect(linesOf(b, d).map((l) => l.text)[0]).toContain('never crossed the border');
  });
  test('a battle was fought, the ride-out was an earlier phase’s, or he fell back: nothing is said', () => {
    const fought = stageRideOut();
    (fought.b.tc['battleCommanders'] as Record<string, number[]>)[`${String(fought.P.id)}@${String(PH)}`] = [
      fought.d.id,
    ];
    const earlier = stageRideOut();
    must(earlier.d._defendRideOut, 'ride-out').ph = PH - 1;
    const away = stageRideOut();
    away.d.location = away.b.X.id;
    for (const s of [fought, earlier, away]) {
      reconcileDefendRideOuts(s.b.tc, PH);
      expect(s.b.lines()).toEqual([]);
      expect(s.d._defendRideOut).toBeUndefined();
    }
  });
});
