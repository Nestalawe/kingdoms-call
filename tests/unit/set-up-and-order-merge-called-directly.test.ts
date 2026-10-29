// The set-up (plan P1-08k7: src/engine/turn/, the first two stages lifted out of resolveTurn's own body), called
// directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/set-up-and-order-merge-in-a-whole-turn plays through a whole turn (lib/set-up-and-order-merge-cases.ts), here
// played through the two stages alone, as resolveTurn calls them (the context given the slot rows and the turn run),
// reading what they leave in the world and in the context's collectors; then, with the helpers they call stood in (each
// replaced in the vm by a recorder for the test's length), what they hand them and when, and where resolveTurn calls
// them; then what the whole turn can't stage: the turn run differing from the save's turn, a slot row for a realm the
// save doesn't have, the per-turn lists missing when the merge runs, a save with no map or gaps in it. Properties
// (fast-check): the repairs leave every living hero of a realm, and only them, five empty phases, the five per-turn
// lists empty, each living hero's own realm in his record once, a people's race on every unclaimed hero who wore a
// beast's, and no stranded hull's marker; the merge writes exactly the hero orders a realm sends as lists for its own
// heroes, holds exactly
// the written orders in their lists with their numbers read, and nothing of a payload for another turn; a conceded
// realm's living heroes always hold; declarations are taken, or refused under Safe Start, exactly as the rule says.
// Level 1: two functions, called with the context resolveTurn hands them.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `turnStartRepairsAndAFreshSlateOfOrdersForEveryHero` and
// `mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans` (P1-08k7), called directly, the context given
// the slot rows and the turn run, as `resolveTurn` calls them: the whole-turn cases through the two stages alone,
// reading the world and the context's collectors (`staleOrderWarnings`, `diploDeclarations`, `safeStartRefused`,
// `discoveryChoicePicks`, `reckoningCalls`, `playerMessages`), but for the turn's record of orders (the reports');
// then, with the helpers they call stood in by recorders in the `vm`, what each is handed: the beasts' races mended
// before the stranded guards' repair, which is handed the save once, then the names' repair once (its count kept on the
// save as given), then each living realm hero's realm noted; Safe Start asked once per realm sending declarations, of
// the save and the turn run; `resolveTurn` calling the repairs, then the merge, once each with its context, before any
// line is logged and before the first phase, the six collectors in the context as the merge returns (the merge makes
// them since P1-08l2), and its later stages reading what the merge collected. Then what a whole turn can't stage: the
// turn run differing from the save's turn (stale orders, the concession's date, a research choice, Safe Start all
// judged by the turn run); a slot row for a realm the save doesn't have ("a player"'s stale orders, its order of heroes
// and concession going nowhere, its Reckoning call taken); the per-turn lists missing when the merge runs (made) or
// holding this turn's orders already (added to); the repairs leaving the lists empty and every hero's phases a list of
// his own; a save with no map, a gap among the provinces or a garrison's companies; a wanderer with id 0 or a negative
// id; a hero with no realm field at all keeping a beast's race; a gap in the realms' list not stopping the conceded
// hold; an heir named by his id as text. Properties (fast-check): the repairs leave every living realm hero, and only
// them, five empty phases, the per-turn lists empty, each living realm hero's realm in his record once, a people's race
// on every unclaimed hero who wore a beast's, no stranded hull's marker; the merge writes exactly the hero orders sent
// as lists for the realm's own heroes and holds exactly the written orders with their numbers read, in order, passing
// over the column's order; a payload for another turn writes no orders, holds none and sets no plan, one for the turn
// run or with none does, a conceded realm's living heroes hold once a row of orders read comes at or after its
// concession, concessions told before refusals; declarations taken unless Safe Start holds, under it a realm refused
// exactly when it offers a Treat or declares war, declarations that aren't a table never read. Planted faults: in the
// PR (P1-08k7)
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import {
  LANDS,
  SET_UP_CASES,
  collected,
  conceded,
  heir,
  mergeCase,
  ordersOf,
  orderedHeroes,
  payloadOf,
  raceFor,
  realmHero,
  rowsOf,
  scratch,
  stageCase,
  stale,
  wanderingAs,
  type Merged,
  type Payload,
  type SetUpCase,
  type Staged,
} from '../lib/set-up-and-order-merge-cases.ts';
import { realm } from '../lib/cast-spell-order-cases.ts';
import { board, must, order, plan, type Board, type Character } from '../lib/middle-of-a-bot-world.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
type Raw = Record<string, unknown>;
const SET_UP = 'turnStartRepairsAndAFreshSlateOfOrdersForEveryHero';
const MERGE = 'mergeTheRealmsSubmittedOrdersDeclarationsMessagesAndEncounterPlans';
const FIRST_PHASE = 'startPhaseHealingSnapshotsAndStalledBattles';
const setUp = engineFn(engine, SET_UP) as Fn;
const merge = engineFn(engine, MERGE) as Fn;
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const inVm = vm.runInContext('(j)=>JSON.parse(j)', engine) as (j: string) => unknown;

const NOTHING: SetUpCase = { name: 'nothing staged', stage: () => ({}), check: () => ({ got: {}, want: {} }) };
/** A board staged as every case is (`stageCase`): plain realms, each holding only its seat with a living king there. */
const fresh = () => {
  const b = board(engine, world, 0);
  stageCase(b, NOTHING);
  return b;
};
const tc = (b: Board) => b.tc as unknown as Raw;
const G = (b: Board) => b.G as unknown as Raw & Board['G'];
/** Hands the context the slot rows (`rows`, JSON text, made in the vm) and the turn run, as resolveTurn's does. */
const given = (b: Board, rows: string, turn = b.G.turn) => {
  tc(b)['freshPlayers'] = inVm(rows);
  tc(b)['expectedTurnToRun'] = turn;
};
const merged = (b: Board): Merged => ({ G: b.G as Merged['G'], tc: tc(b), turn: b.G.turn });

/** The cases a direct call can stage, by part (the turn's record of orders is the reports', after a whole turn). */
const DIRECT_CASES = SET_UP_CASES.map(([part, cases]) => [part, cases.filter((c) => c.merged)] as const).filter(
  ([, cases]) => cases.length > 0,
);
describe.each(DIRECT_CASES)('%s, the two stages called directly', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = stageCase(b, c);
    const { got, want } = must(c.merged, 'a direct check')(mergeCase(b, s), s);
    expect(got).toEqual(want);
  });
});

// ── What they call, and where resolveTurn calls them ─────────────────────────────────────────────────────────────
interface Call {
  fn: string;
  args: unknown[];
}
/** Runs `body` with each of `names` replaced by a recorder (in the vm, for the body's length) that still calls the
 *  helper it stands in for. */
function standIn(names: string[], body: () => void): Call[] {
  const g = engine;
  const was = names.map((f) => [f, g[f] as Fn] as const);
  const calls: Call[] = [];
  for (const [f, w] of was)
    g[f] = (...args: unknown[]) => {
      calls.push({ fn: f, args });
      return w(...args);
    };
  try {
    body();
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
  return calls;
}

describe('The set-up: what it calls', () => {
  test('the repairs mend the beasts’ races first, then hand the save to the stranded guards’ repair and the names’ repair once each, then note each living realm hero’s realm', () => {
    const b = fresh();
    const g = wanderingAs(b, 'Monster');
    Object.assign(g, { _isNeutralGuard: true, armies: [] });
    const h = realmHero(b, 1);
    realmHero(b, 2, { alive: false });
    const seen: string[] = [];
    const calls = standIn(['normaliseStrandedGuards', 'normaliseOwnedNames', 'noteServedRealm'], () => {
      const was = engine['demoteGuardToWanderer'] as Fn;
      engine['demoteGuardToWanderer'] = (c: Character) => {
        seen.push(String(c['race']));
        return was(c);
      };
      try {
        setUp(b.tc);
      } finally {
        engine['demoteGuardToWanderer'] = was;
      }
    });
    expect(calls.map((c) => c.fn)).toEqual([
      'normaliseStrandedGuards',
      'normaliseOwnedNames',
      ...b.G.characters.filter((c) => c.alive && c.player != null).map(() => 'noteServedRealm'),
    ]);
    expect(calls.slice(0, 2).map((c) => c.args.length === 1 && c.args[0] === b.G)).toEqual([true, true]);
    const noted = calls.slice(2).map((c) => [(c.args[0] as Character).id, c.args[1]]);
    expect(noted).toEqual(b.G.characters.filter((c) => c.alive && c.player != null).map((c) => [c.id, c.player]));
    expect(noted).toContainEqual([h.id, 1]);
    expect(seen).toEqual([raceFor(b, g)]);
  });

  test('the repairs keep the names’ repair count on the save, as the names’ repair gives it back', () => {
    const b = fresh();
    const g: Raw = engine;
    const was = g['normaliseOwnedNames'];
    g['normaliseOwnedNames'] = () => 5;
    try {
      setUp(b.tc);
    } finally {
      g['normaliseOwnedNames'] = was;
    }
    expect(G(b)['_nameRepairs']).toBe(5);
  });

  test('the merge asks Safe Start once for each realm that sends declarations, of the save and the turn run', () => {
    const b = fresh();
    G(b)['safeStart'] = true;
    const sends: Record<number, Payload> = { 0: { diplomacy: { 1: 'treat' } }, 2: { diplomacy: null } };
    setUp(b.tc);
    given(b, rowsOf(b, { sends }), 9);
    const calls = standIn(['safeStartLocked'], () => {
      merge(b.tc);
    });
    expect(calls.map((c) => [c.args[0] === b.G, c.args[1]])).toEqual([
      [true, 9],
      [true, 9],
    ]);
    expect(collected(merged(b), 'diploDeclarations')).toEqual({ 0: { 1: 'treat' }, 1: {} });
  });

  test('resolveTurn calls the repairs, then the merge, once each, with its context, before any line is logged and before the first phase; the merge leaves the six collectors on that context', () => {
    const b = fresh();
    const names = [SET_UP, MERGE, FIRST_PHASE];
    const g = engine;
    const was = names.map((f) => [f, g[f] as Fn] as const);
    const order_: string[] = [];
    const handed: unknown[][] = [];
    const logged: number[] = [];
    const collectors: unknown[] = [];
    for (const [f, w] of was)
      g[f] = (...a: unknown[]) => {
        const recorded = order_.length < 3;
        const t = a[0] as Raw;
        if (recorded) {
          order_.push(f);
          handed.push(a);
          logged.push((t['turnLog'] as unknown[]).length);
        }
        const r = w(...a);
        // the six collectors, as the merge leaves them on the context (it makes them since P1-08l2)
        if (recorded && f === MERGE)
          collectors.push(
            ...[
              'staleOrderWarnings',
              'diploDeclarations',
              'safeStartRefused',
              'discoveryChoicePicks',
              'reckoningCalls',
              'playerMessages',
            ].map((k) => Object.prototype.toString.call(t[k])),
          );
        return r;
      };
    const resolveTurn = engineFn(engine, 'resolveTurn') as (s: string, r: unknown, t: number) => unknown;
    try {
      withCaseDice(engine, LANDS, () => resolveTurn(JSON.stringify(b.G), inVm(rowsOf(b, {})), b.G.turn));
    } finally {
      for (const [f, w] of was) g[f] = w;
    }
    expect(order_).toEqual(names);
    expect(handed.slice(0, 2).map((a) => a.length)).toEqual([1, 1]);
    expect([handed[1]?.[0] === handed[0]?.[0], handed[2]?.[0] === handed[0]?.[0]]).toEqual([true, true]);
    expect(logged.slice(0, 2)).toEqual([0, 0]);
    expect(collectors).toEqual([
      '[object Array]',
      '[object Object]',
      '[object Array]',
      '[object Object]',
      '[object Set]',
      '[object Object]',
    ]);
  });

  test('resolveTurn’s later stages read what the merge collected from the context it handed it (a war declared is made, a concession told)', () => {
    const b = fresh();
    const s: Staged = { sends: { 1: { diplomacy: { 2: 'enemy' }, concede: true } } };
    const resolveTurn = engineFn(engine, 'resolveTurn') as (
      s: string,
      r: unknown,
      t: number,
    ) => { state: string; log: { text: string }[] };
    // the turn's lines in words, as the views write them and the GM's log stores them (theTurnsLinesInWords, P1-12c3):
    // since P1-12d15 a line the merge held is a fact, its words there alone
    const theTurnsLinesInWords = engineFn(engine, 'theTurnsLinesInWords') as (log: unknown) => {
      gmLog: { text: string }[];
    };
    const played = withCaseDice(engine, LANDS, () => resolveTurn(JSON.stringify(b.G), inVm(rowsOf(b, s)), b.G.turn));
    const r = { ...played, log: theTurnsLinesInWords(played.log).gmLog };
    const after = JSON.parse(r.state) as Board['G'];
    expect(after.relations['1-2']).toBe('enemy');
    expect(r.log.filter((l) => l.text === conceded(realm(b, 1).name)).length).toBe(1);
  });
});

// ── What only a direct call can stage ────────────────────────────────────────────────────────────────────────────
describe('The set-up: what only a direct call can stage', () => {
  test('orders are judged stale against the turn run, not the save’s turn', () => {
    const b = fresh();
    const h = realmHero(b, 1);
    setUp(b.tc);
    const s: Staged = { orders: [[h, plan(order('rest'))]] };
    given(b, rowsOf(b, s), b.G.turn + 2);
    merge(b.tc);
    expect(ordersOf(b.G, h)).toEqual([null, null, null, null, null]);
    expect(collected(merged(b), 'staleOrderWarnings')).toEqual([
      stale(realm(b, 0).name, b.G.turn, b.G.turn + 2),
      stale(realm(b, 1).name, b.G.turn, b.G.turn + 2),
      stale(realm(b, 2).name, b.G.turn, b.G.turn + 2),
    ]);
  });

  test('a concession is dated by the turn run; a research choice for the turn run is taken; Safe Start is judged by the turn run', () => {
    const b = fresh();
    G(b)['safeStart'] = true;
    setUp(b.tc);
    const s: Staged = {
      sends: { 1: { concede: true, forTurn: 7, discoveryChoices: { k: 'sd03' }, diplomacy: { 2: 'enemy' } } },
    };
    given(b, rowsOf(b, s), 7);
    merge(b.tc);
    expect(realm(b, 1)['concededTurn']).toBe(7);
    expect((collected(merged(b), 'discoveryChoicePicks') as Raw)['1']).toEqual({ k: 'sd03' });
    expect((collected(merged(b), 'diploDeclarations') as Raw)['1']).toEqual({ 2: 'enemy' });
    expect(collected(merged(b), 'safeStartRefused')).toEqual([]);
  });

  test('a research choice sent with orders for the save’s turn, while another turn is run, is not taken', () => {
    const b = fresh();
    setUp(b.tc);
    given(b, rowsOf(b, { sends: { 1: { discoveryChoices: { k: 'sd03' } } } }), b.G.turn + 1);
    merge(b.tc);
    expect((collected(merged(b), 'discoveryChoicePicks') as Raw)['1'] ?? null).toBeNull();
  });

  test('a slot row for a realm the save doesn’t have: its stale orders are told as “a player”’s; its order of heroes and concession go nowhere; its Reckoning call is taken', () => {
    const b = fresh();
    setUp(b.tc);
    const row = {
      id: 'G1gp7',
      game_id: 'G1',
      user_id: 'u7',
      player_index: 7,
      display_name: 'Realm 7',
      orders_submitted: true,
      orders: JSON.stringify({
        orders: {},
        encounterPlans: {},
        heroOrder: ['1'],
        concede: true,
        callReckoning: true,
        forTurn: b.G.turn + 1,
      }),
      turn_report: '{}',
    };
    given(b, JSON.stringify([row]));
    merge(b.tc);
    expect(collected(merged(b), 'staleOrderWarnings')).toEqual([
      `⚠ Ignoring stale orders from a player — submitted for Turn ${String(b.G.turn + 1)}, not Turn ${String(b.G.turn)}.`,
    ]);
    expect(b.G.players.length).toBe(3);
    expect(collected(merged(b), 'reckoningCalls')).toEqual([7]);
  });

  test('the merge makes the lists it holds orders and plans in when the save has none', () => {
    const b = fresh();
    setUp(b.tc);
    for (const k of ['_pendingResurrectOrders', '_pendingHireOrders', '_pendingCharmOrders', '_pendingSynthPlans'])
      Reflect.deleteProperty(G(b), k);
    const sends: Record<number, Payload> = {
      0: {
        orders: { resurrect_1_via_2_ph0: [], hired_3_via_4_ph1: [], charm_5_via_6_ph2: [] },
        encounterPlans: { hired_7_via_8_ph3: { tactics: ['FL'] } },
      },
    };
    given(b, rowsOf(b, { sends }));
    merge(b.tc);
    expect(
      ['_pendingResurrectOrders', '_pendingHireOrders', '_pendingCharmOrders', '_pendingSynthPlans'].map((k) =>
        (scratch(b.G, k) as Raw[]).map((x) => x['heroId']),
      ),
    ).toEqual([[1], [3], [5], [7]]);
  });

  test('the merge adds to orders already held this turn rather than starting the lists again', () => {
    const b = fresh();
    setUp(b.tc);
    G(b)['_pendingHireOrders'] = [{ heroId: 99 }];
    given(b, rowsOf(b, { sends: { 2: { orders: { hired_3_via_4_ph1: [] } } } }));
    merge(b.tc);
    expect((scratch(b.G, '_pendingHireOrders') as Raw[]).map((x) => x['heroId'])).toEqual([99, 3]);
  });

  test('the repairs leave the per-turn lists empty (not missing) and every list of orders a list of its own', () => {
    const b = fresh();
    const a = realmHero(b, 0);
    const c = realmHero(b, 0);
    setUp(b.tc);
    expect(
      [
        '_resurrectedThisTurn',
        '_pendingResurrectOrders',
        '_pendingCharmOrders',
        '_pendingHireOrders',
        '_pendingSynthPlans',
      ].map((k) => scratch(b.G, k)),
    ).toEqual([[], [], [], [], []]);
    const os = b.G.turnOrders as Record<string, unknown[]>;
    expect(os[String(a.id)] === os[String(c.id)]).toBe(false);
  });

  test('a save with no map, no garrisons and gaps in its lists is repaired without stopping', () => {
    const b = fresh();
    const p = must(b.G.world.provinces[b.X.id], 'the middle');
    p.garrisonArmies = [null as unknown as never];
    (b.G.world.provinces as unknown[])[1] = null;
    G(b)['_hullsGone'] = true;
    expect(() => setUp(b.tc)).not.toThrow();
    const noMap = fresh();
    Reflect.deleteProperty(G(noMap), 'world');
    expect(() => setUp(noMap.tc)).not.toThrow();
  });

  test('a wandering hero with no id wearing a beast’s race is given the first people’s race; a negative id counts round the list', () => {
    const b = fresh();
    const w = wanderingAs(b, 'Monster');
    const v = wanderingAs(b, 'Creature');
    (w as Raw)['id'] = 0;
    (v as Raw)['id'] = -1;
    setUp(b.tc);
    const rs = JSON.parse(vm.runInContext('JSON.stringify(RACES_P)', engine) as string) as string[];
    expect([w['race'], v['race']]).toEqual([rs[0], rs[rs.length - 1]]);
  });

  test('a hero whose realm the save doesn’t record at all (not even as none) keeps a beast’s race', () => {
    const b = fresh();
    const h = wanderingAs(b, 'Monster');
    Reflect.deleteProperty(h, 'player');
    setUp(b.tc);
    expect(h['race']).toBe('Monster');
  });

  test('a gap in the save’s list of realms doesn’t stop a conceded realm’s heroes being made to hold', () => {
    const b = fresh();
    const h = realmHero(b, 1);
    Object.assign(realm(b, 1), { conceded: true, concededTurn: 0 });
    setUp(b.tc);
    const rows = JSON.parse(rowsOf(b, {})) as unknown[];
    (b.G.players as unknown[])[2] = null;
    given(b, JSON.stringify(rows.slice(0, 1)));
    expect(() => merge(b.tc)).not.toThrow();
    expect(ordersOf(b.G, h)).toEqual(Array.from({ length: 5 }, () => 'defend: Hold (conceded)'));
  });

  test('an heir’s choices name him by his id as text', () => {
    const b = fresh();
    const h = heir(b, 0);
    setUp(b.tc);
    given(b, rowsOf(b, { sends: { 0: { kingSkills: { [String(h.id)]: { temper: 'Berserk' } } } } }));
    merge(b.tc);
    expect([h['temper'], h['_isHeir'] ?? false]).toEqual(['Berserk', false]);
  });
});

// ── Properties ───────────────────────────────────────────────────────────────────────────────────────────────────
const SCRATCH = [
  '_resurrectedThisTurn',
  '_pendingResurrectOrders',
  '_pendingCharmOrders',
  '_pendingHireOrders',
  '_pendingSynthPlans',
];
describe('The set-up: properties', () => {
  test('the repairs leave every living hero of a realm, and only them, five empty phases; the per-turn lists empty; each living realm hero’s realm in his record once; a people’s race on every unclaimed hero who wore a beast’s; no stranded hull’s marker', () => {
    const heroSpec = fc.record({
      player: fc.constantFrom(null, 0, 1, 2),
      alive: fc.boolean(),
      race: fc.constantFrom('Monster', 'Creature', 'Human', 'Elf'),
      served: fc.uniqueArray(fc.constantFrom(0, 1, 2), { maxLength: 3 }),
    });
    fc.assert(
      fc.property(
        fc.array(heroSpec, { maxLength: 6 }),
        fc.array(fc.option(fc.integer({ min: 0, max: 4 }), { nil: undefined }), { maxLength: 4 }),
        fc.boolean(),
        (specs, holds, leftOver) => {
          const b = fresh();
          const hs = specs.map((x) =>
            Object.assign(realmHero(b, 0), {
              player: x.player,
              alive: x.alive,
              race: x.race,
              _servedRealms: [...x.served],
            }),
          );
          const seat = must(b.G.world.provinces[b.X.id], 'the middle');
          seat.garrisonArmies = holds.map((h, i) => ({
            type: 'Men-at-Arms',
            quality: 'Average',
            race: 'Human',
            unitName: 'M' + String(i),
            ...(h === undefined ? {} : { _navalHold: h }),
          }));
          if (leftOver) {
            (b.G.turnOrders as Raw)['5'] = plan();
            SCRATCH.forEach((k) => (G(b)[k] = [{ heroId: 1 }]));
          }
          const before = b.G.characters.map((c) => ({ id: c.id, player: c.player, alive: c.alive, race: c['race'] }));
          setUp(b.tc);
          const living = b.G.characters.filter((c) => c.player !== null && c.alive);
          expect(orderedHeroes(b.G)).toEqual(living.map((c) => String(c.id)).sort());
          living.forEach((c) => {
            expect(ordersOf(b.G, c)).toEqual([null, null, null, null, null]);
            const sv = c['_servedRealms'] as number[];
            expect(sv.filter((x) => x === c.player).length).toBe(1);
          });
          expect(SCRATCH.map((k) => scratch(b.G, k))).toEqual(SCRATCH.map(() => []));
          before.forEach((x, i) => {
            const c = must(b.G.characters[i], 'hero');
            const beast = x.race === 'Monster' || x.race === 'Creature';
            expect(c['race']).toBe(x.player === null && beast ? raceFor(b, c) : x.race);
          });
          expect(hs.length).toBe(specs.length);
          expect(seat.garrisonArmies.filter((u) => '_navalHold' in u)).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('the merge writes exactly the hero orders a realm sends as lists for its own heroes, holds exactly the written orders in their lists with their numbers read, in order, and passes over the column’s order', () => {
    const entry = fc.oneof(
      fc.record({
        kind: fc.constant('hero' as const),
        id: fc.integer({ min: 1, max: 60 }),
        king: fc.option(fc.constantFrom(0, 1, 2), { nil: undefined }),
        list: fc.boolean(),
      }),
      fc.record({
        kind: fc.constantFrom('resurrect' as const, 'charm' as const),
        hero: fc.integer({ min: 0, max: 99 }),
        by: fc.integer({ min: 0, max: 99 }),
        ph: fc.integer({ min: 0, max: 4 }),
      }),
      fc.record({
        kind: fc.constant('hired' as const),
        hero: fc.integer({ min: 0, max: 99 }),
        by: fc.constantFrom('3', '12', 'hired_4_via_5_ph1'),
        ph: fc.integer({ min: 0, max: 4 }),
      }),
      fc.constant({ kind: 'column' as const }),
    );
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom(0, 1, 2), entry), { maxLength: 10 }), (sent) => {
        const b = fresh();
        setUp(b.tc);
        const sends: Record<number, { orders: Raw }> = { 0: { orders: {} }, 1: { orders: {} }, 2: { orders: {} } };
        const kingIdOf = (pi: number) =>
          String(
            must(
              b.G.characters.find((c) => c.isKing && c.player === pi),
              'king',
            ).id,
          );
        const keyOf = (e: (typeof sent)[number][1]) =>
          e.kind === 'hero'
            ? e.king === undefined
              ? String(e.id)
              : kingIdOf(e.king)
            : e.kind === 'column'
              ? 'heroOrder'
              : `${e.kind}_${String(e.hero)}_via_${String(e.by)}_ph${String(e.ph)}`;
        const last = new Map<string, [number, (typeof sent)[number][1]]>();
        sent.forEach(([pi, e]) => {
          const k = keyOf(e);
          must(sends[pi], 'realm').orders[k] = e.kind === 'hero' && !e.list ? { 0: order('rest') } : [order('rest')];
          last.set(String(pi) + ':' + k, [pi, e]);
        });
        const kings = b.G.characters.map((c) => String(c.id));
        given(b, rowsOf(b, { sends }));
        merge(b.tc);
        const itsOwn = (pi: number, k: string) => b.G.characters.some((c) => String(c.id) === k && c.player === pi);
        const written = [...last.values()]
          .filter(([pi, e]) => e.kind === 'hero' && e.list && itsOwn(pi, keyOf(e)))
          .map(([, e]) => keyOf(e));
        expect(orderedHeroes(b.G)).toEqual([...new Set([...kings, ...written])].sort());
        const want = (kind: string) =>
          [0, 1, 2].flatMap((pi) =>
            [...last.values()]
              .filter(([p, e]) => p === pi && e.kind === kind)
              .map(([, e]) =>
                e.kind === 'hired'
                  ? { heroId: e.hero, viaId: e.by, plannedPhase: e.ph, player: pi }
                  : e.kind === 'resurrect' || e.kind === 'charm'
                    ? { heroId: e.hero, casterId: e.by, castPhase: e.ph, player: pi }
                    : {},
              ),
          );
        const strip = (k: string) =>
          (scratch(b.G, k) as Raw[]).map((x) => Object.fromEntries(Object.entries(x).filter(([f]) => f !== 'orders')));
        expect(strip('_pendingResurrectOrders')).toEqual(want('resurrect'));
        expect(strip('_pendingCharmOrders')).toEqual(want('charm'));
        expect(strip('_pendingHireOrders')).toEqual(want('hired'));
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  test('a payload for another turn writes no orders, holds none and sets no plan; one for the turn run (or none) writes them; a conceded realm’s living heroes hold once a row of orders read comes at or after its concession; concessions are told before refusals', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            forTurn: fc.constantFrom<number | null | 'now'>(null, 'now', 0, 2, 3),
            concede: fc.boolean(),
            concededBefore: fc.boolean(),
          }),
          { minLength: 3, maxLength: 3 },
        ),
        (realms) => {
          const b = fresh();
          const hs = [0, 1, 2].map((pi) => realmHero(b, pi));
          realms.forEach((r, pi) => {
            if (r.concededBefore) Object.assign(realm(b, pi), { conceded: true, concededTurn: 0 });
          });
          setUp(b.tc);
          const sends: Record<number, Payload> = {};
          realms.forEach((r, pi) => {
            const h = must(hs[pi], 'hero');
            sends[pi] = {
              forTurn: r.forTurn === 'now' ? b.G.turn : r.forTurn,
              concede: r.concede,
              orders: {
                [h.id]: plan(order('move', b.ring1[0]?.id ?? 0)),
                [`hired_${String(h.id + 500)}_via_1_ph1`]: [],
              },
              encounterPlans: { [h.id]: { tactics: ['FL'] } },
            };
          });
          given(b, rowsOf(b, { sends }));
          merge(b.tc);
          const hold = Array.from({ length: 5 }, () => 'defend: Hold (conceded)');
          const warnings: string[] = [];
          // the rows are read in realm order: a realm's concession is taken from its own row on; each row whose orders
          // are read writes its own heroes' orders, then makes every realm conceded so far hold
          const ok = (pi: number) => {
            const f = must(realms[pi], 'realm').forTurn;
            return f === null || f === 'now' || f === b.G.turn;
          };
          const concededAt = realms.map((r, pi) => (r.concededBefore ? -1 : r.concede ? pi : Infinity));
          realms.forEach((r, pi) => {
            const h = must(hs[pi], 'hero');
            if (r.concede && !r.concededBefore) warnings.push(conceded(realm(b, pi).name));
            if (!ok(pi)) warnings.push(stale(realm(b, pi).name, r.forTurn as number, b.G.turn));
            const heldAfter = [0, 1, 2].some((j) => j >= pi && ok(j) && must(concededAt[pi], 'when') <= j);
            const heldBefore = !ok(pi) && [0, 1, 2].some((j) => j < pi && ok(j) && must(concededAt[pi], 'when') <= j);
            expect(ordersOf(b.G, h)).toEqual(
              heldAfter || heldBefore
                ? hold
                : ok(pi)
                  ? ['move', 'rest', 'rest', 'rest', 'rest']
                  : [null, null, null, null, null],
            );
            expect(h['encounterPlan'] ?? null).toEqual(ok(pi) ? { tactics: ['FL'] } : null);
            expect((scratch(b.G, '_pendingHireOrders') as Raw[]).some((x) => x['heroId'] === h.id + 500)).toBe(ok(pi));
          });
          expect(collected(merged(b), 'staleOrderWarnings')).toEqual(warnings);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  test('a realm’s declarations are taken unless Safe Start holds; under it, a realm is refused exactly when it offers a Treat or declares war; declarations that aren’t a table are never read', () => {
    const stance = fc.constantFrom('treat', 'enemy', 'neutral', '');
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 1, max: 8 }),
        fc.array(
          fc.oneof(
            fc.dictionary(fc.constantFrom('0', '1', '2'), stance, { maxKeys: 2 }),
            fc.constantFrom<unknown>(null, 'enemy', 3),
          ),
          { minLength: 3, maxLength: 3 },
        ),
        (safe, turn, dips) => {
          const b = fresh();
          G(b)['safeStart'] = safe;
          b.G.turn = turn;
          setUp(b.tc);
          const sends: Record<number, Payload> = {};
          dips.forEach((d, pi) => (sends[pi] = { diplomacy: d }));
          given(b, rowsOf(b, { sends }));
          merge(b.tc);
          const locked = safe && turn < 6;
          const table = (d: unknown): d is Raw => !!d && typeof d === 'object';
          expect(collected(merged(b), 'diploDeclarations')).toEqual(
            locked ? {} : Object.fromEntries(dips.flatMap((d, pi) => (table(d) ? [[String(pi), d]] : []))),
          );
          expect(collected(merged(b), 'safeStartRefused')).toEqual(
            locked
              ? dips.flatMap((d, pi) =>
                  table(d) && Object.values(d).some((v) => v === 'treat' || v === 'enemy') ? [pi] : [],
                )
              : [],
          );
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });
});

// ── The default payload, as the cases send it ────────────────────────────────────────────────────────────────────
test('the cases’ default orders: every living hero of a realm Resting, for the turn played, nothing else sent', () => {
  const b = fresh();
  const h = realmHero(b, 2);
  const p = payloadOf(b, {}, 2);
  expect(p['forTurn']).toBe(b.G.turn);
  expect(Object.keys(p['orders'] as Raw)).toEqual(
    [String(kingOf2(b)), String(h.id)].sort((x, y) => Number(x) - Number(y)),
  );
});
const kingOf2 = (b: Board) =>
  must(
    b.G.characters.find((c) => c.isKing && c.player === 2),
    'the king of realm 2',
  ).id;
