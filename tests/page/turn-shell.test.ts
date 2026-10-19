// The turn's shell: its one failure path (plan step P1-18a), its database writes (P1-18d) and its dice (P1-18e).
// runTurn always returns {ok, committed, conflict, error}, and a failed run puts the players' orders back only when the
// turn was not saved.
// Each test stages a small game with two human realms (one has sent its orders, one has only saved a draft) and one
// failure on the stand-in database:
// - the orders can't be cleared: the run stops, nothing changes, the orders stay in;
// - the save fails: the turn stays where it was and the orders go back exactly as they were loaded;
// - a realm's orders can't be read (malformed JSON): the same, and runTurn returns instead of throwing;
// - the save answers with an error but went through: the turn counts as saved, and the orders stay spent;
// - the save answers with an error and the game can't be read again: nothing is put back;
// - a turn report fails after the save (the post-save guard, which P1-18d kept passing): the turn stands, the
//   orders stay spent, and the GM is told the turn was saved;
// - and none: the turn's writes, in order (the clear, the save, each realm's report and its snapshot, the GM's log,
//   the telemetry), each payload agreeing with the others. P1-18d moved them into the shell; the test holds them.
// And the turn's dice (P1-18e): each turn plays from a seed of its own, drawn from the page's dice and returned, and
// the page gets its own dice back; the shell hands resolveTurn that seed (P1-08m); the turn the page plays is the one
// the engine plays alone, in the bare vm, from that seed.
// Level 4 (page): these are the GM portal's database calls, made by the turn's shell (runTurn, src/ui/gm/turn-shell.js)
// around the engine's resolveTurn; the shell runs only in the booted page, against its database.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import vm from 'node:vm';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { loadEngine } from '../lib/engine.ts';
import { GAME, newWorld, slotRows, slotRowsJson } from '../lib/matrix-game.ts';
import { makeStub, type Row, type Stub } from '../lib/stub-db.js';

const NOW = '2026-10-01T12:00:00Z';
const ERROR = { message: 'the database is unreachable' };

interface Outcome {
  ok?: boolean;
  committed?: boolean;
  conflict?: boolean;
  error?: string;
  seed?: number;
}

interface Query {
  update(payload: unknown): Query;
  then(resolve: (r: { data: unknown; error: unknown }) => unknown, reject?: (e: unknown) => unknown): Promise<unknown>;
}

interface Client {
  from(table: string): Query;
}

// The stand-in database answers with real Dates; hold the test process's clock still, as deterministic-boot does.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
});
afterEach(() => {
  vi.useRealTimers();
});

const SENT = JSON.stringify({ orders: {}, encounterPlans: {}, kingSkills: {}, forTurn: 1 });
const DRAFT = JSON.stringify({ orders: {}, encounterPlans: {}, kingSkills: {}, forTurn: 1, draft: true });

interface Staged {
  S: Stub;
  W: PageWindow;
  client: Client;
  /** What the page logged with console.error. */
  logged: string[];
  /** Runs one turn of the staged game, as the Resolve Turn button does (the GM says yes). */
  run(): Promise<Outcome>;
  game(): Row;
  players(): Row[];
  /** What the GM sees under the game. */
  message(): string;
}

// Boots the GM portal and stages Turn 1 of a two-realm game: realm 0 has sent its orders, realm 1 has saved a draft
// (any other payload counts as sent).
async function stage(orders: [string, string] = [SENT, DRAFT]): Promise<Staged> {
  return seat(await boot(), (W) => {
    W['__sp'] = [0, 1].map((i) => ({
      id: i,
      gamePlayerId: 'gp' + String(i),
      isBot: false,
      name: 'Realm' + String(i),
      kingName: 'King' + String(i),
      kingdomName: 'Realm' + String(i),
      race: ['Human', 'Elven'][i],
      alignment: ['Good', 'Neutral'][i],
      temper: 'Brave',
      skills: { melee: 1, tactical: 1, march: 1, white: 1, naval: 0, sage: 1, explorer: 1 },
    }));
    W.eval(`(function(){ const g=generateNewGame(__sp,{cols:8,rows:7},0,{seaPct:20});
      g.turnMode={mode:'manual',time:'20:00',everyDays:1,nextDeadlineAt:null,turnRanAt:new Date().toISOString()};
      window.__G=g; })()`);
    return {
      world: String(W.eval('JSON.stringify(__G)')),
      rows: orders.map((o, i) => ({
        id: 'G1gp' + String(i),
        game_id: 'G1',
        user_id: 'u' + String(i),
        player_index: i,
        display_name: 'Realm' + String(i),
        orders_submitted: o !== DRAFT,
        orders: o,
        turn_report: JSON.stringify({}),
      })),
    };
  });
}

interface Booted {
  S: Stub;
  W: PageWindow;
  logged: string[];
}

// Boots the GM portal on the stand-in database, with the page's dice seeded from `seed`.
async function boot(seed = 4321): Promise<Booted> {
  const S = makeStub();
  const logged: string[] = [];
  const dom = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
    supabase: S.supabase,
    seed,
    now: NOW,
    setup(w) {
      w.console.error = (...a) => logged.push(a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  });
  const W = dom.window;
  await new Promise((r) => setTimeout(r, 900));
  expect(logged, 'the GM portal boots without errors').toEqual([]);
  W['currentUser'] = { id: 'gm1' };
  return { S, W, logged };
}

// Puts a game on Turn 1 into the booted page's database: the world `game` makes (JSON) and its slot rows.
function seat({ S, W, logged }: Booted, game: (W: PageWindow) => { world: string; rows: Row[] }): Staged {
  const { world, rows } = game(W);
  const games = S.DB['games'] ?? [];
  const players = S.DB['game_players'] ?? [];
  W['__world'] = world;
  games.push({
    id: 'G1',
    name: 'Failure path',
    gm_user_id: 'gm1',
    status: 'active',
    turn: 1,
    max_players: rows.length,
    max_turns: 0,
    created_at: new Date().toISOString(),
    game_state: world,
    meta: W.eval('JSON.parse(JSON.stringify(buildGameMeta(JSON.parse(__world))))'),
  });
  players.push(...rows);
  const client = (S.supabase as { createClient(): Client }).createClient();
  return {
    S,
    W,
    client,
    logged,
    async run() {
      W['__game'] = structuredClone(games[0]);
      W.eval('window.confirm=()=>true;');
      const result = (await W.eval('runTurn({game:__game})')) as Outcome | undefined;
      await new Promise((r) => setTimeout(r, 30));
      return result ?? { error: 'runTurn returned ' + String(result) };
    },
    game: () => games[0] ?? {},
    players: () => players,
    message: () => String(W.eval("document.getElementById('detail-msg').textContent")),
  };
}

// Each realm's orders as the database holds them.
const ordersOf = (t: Staged) => t.players().map((p) => ({ orders: p['orders'], submitted: p['orders_submitted'] }));
const asLoaded = [
  { orders: SENT, submitted: true },
  { orders: DRAFT, submitted: false },
];
const spent = [
  { orders: null, submitted: false },
  { orders: null, submitted: false },
];

// Makes every games.update answer with an error after it has been applied (a save that timed out but landed), and,
// with `rereadFails`, every games.select after that save answer with an error too.
function saveLandsButErrs(t: Staged, rereadFails = false): void {
  const from = t.client.from.bind(t.client);
  let saved = false;
  t.client.from = (table) => {
    const q = from(table);
    if (table !== 'games') return q;
    const update = q.update.bind(q);
    let op = 'select';
    q.update = (p) => {
      op = 'update';
      return update(p);
    };
    const then = q.then.bind(q);
    q.then = (resolve, reject) =>
      then((r) => {
        if (op === 'update') {
          saved = true;
          return resolve({ data: null, error: ERROR });
        }
        if (saved && rereadFails) return resolve({ data: null, error: ERROR });
        return resolve(r);
      }, reject);
    return q;
  };
}

/** One write the page made: its table and operation, the query's filters and modifiers in order, and what was sent. */
interface Write {
  /** e.g. "games.update" */
  call: string;
  /** e.g. "eq(id,G1) eq(turn,1) select(id) maybeSingle()" */
  query: string;
  /** What was sent, copied as JSON at the call: the stand-in database keeps references to what it is sent. */
  payload: unknown;
}

const WRITE_OPS = new Set(['update', 'insert', 'upsert', 'delete']);
const QUERY_STEPS = ['eq', 'neq', 'in', 'is', 'select', 'single', 'maybeSingle', 'order', 'limit'];

// Records every write the page makes from now on, in order (reads are left out).
function recordWrites(t: Staged): Write[] {
  const writes: Write[] = [];
  const from = t.client.from.bind(t.client);
  t.client.from = (table) => {
    const q = from(table);
    const steps = q as unknown as Record<string, unknown>;
    let op = 'select';
    let payload: unknown = null;
    const query: string[] = [];
    for (const name of [...WRITE_OPS, ...QUERY_STEPS]) {
      const step = steps[name];
      if (typeof step !== 'function') continue;
      steps[name] = (...args: unknown[]) => {
        if (WRITE_OPS.has(name)) {
          op = name;
          payload = args[0] === undefined ? null : (JSON.parse(JSON.stringify(args[0])) as unknown);
          const conflict = (args[1] as { onConflict?: string } | undefined)?.onConflict;
          if (conflict) query.push(`onConflict(${conflict})`);
        } else query.push(`${name}(${args.map(String).join(',')})`);
        return (step as (...a: unknown[]) => unknown).apply(q, args);
      };
    }
    const then = q.then.bind(q);
    q.then = (resolve, reject) => {
      if (op !== 'select') writes.push({ call: `${table}.${op}`, query: query.join(' '), payload });
      return then(resolve, reject);
    };
    return q;
  };
  return writes;
}

test('the GM says no: the run stops and says so', async () => {
  const t = await stage();
  try {
    t.W.eval('window.confirm=()=>false;');
    t.W['__game'] = structuredClone(t.game());
    const result = (await t.W.eval('runTurn({game:__game})')) as Outcome | undefined;
    expect(result).toMatchObject({ ok: false, committed: false });
    expect(t.game()['turn']).toBe(1);
    expect(ordersOf(t)).toEqual(asLoaded);
  } finally {
    t.W.close();
  }
}, 30_000);

test('the orders cannot be cleared: the turn does not run, and the orders stay in', async () => {
  const t = await stage();
  try {
    t.S.ERRORS['game_players.update'] = ERROR;
    const result = await t.run();
    expect(result, 'the run reports its failure').toMatchObject({ ok: false, committed: false });
    expect(t.game()['turn'], 'the game is still on Turn 1').toBe(1);
    expect(ordersOf(t), 'the orders are still in, as sent').toEqual(asLoaded);
    expect(t.message()).toMatch(/could not be cleared/);
  } finally {
    t.W.close();
  }
}, 30_000);

test('the save fails: the turn stays, and the orders go back exactly as they were', async () => {
  const t = await stage();
  try {
    t.S.ERRORS['games.update'] = ERROR;
    const result = await t.run();
    expect(result, 'the run reports its failure').toMatchObject({ ok: false, committed: false, conflict: false });
    expect(t.game()['turn'], 'the game is still on Turn 1').toBe(1);
    expect(ordersOf(t), 'the sent orders are back, and the draft is still a draft').toEqual(asLoaded);
    expect(t.message()).toMatch(/Error saving: the database is unreachable/);
    expect(t.message()).toMatch(/orders have been restored/);
    expect(t.logged.join('\n')).toMatch(/runTurn error/);
  } finally {
    t.W.close();
  }
}, 30_000);

test("a realm's orders can't be read: runTurn returns, the turn stays, and the orders go back", async () => {
  const malformed = '{"orders":{';
  const t = await stage([malformed, DRAFT]);
  try {
    let thrown: unknown = null;
    const result = await t.run().catch((e: unknown) => {
      thrown = e;
      return {};
    });
    expect(thrown, 'runTurn returns rather than throwing').toBe(null);
    expect(result, 'the run reports its failure').toMatchObject({ ok: false, committed: false });
    expect(t.game()['turn'], 'the game is still on Turn 1').toBe(1);
    expect(ordersOf(t), 'every realm has its orders back, as loaded').toEqual([
      { orders: malformed, submitted: true },
      { orders: DRAFT, submitted: false },
    ]);
  } finally {
    t.W.close();
  }
}, 30_000);

test('the save answers with an error but went through: the turn counts as saved, and the orders stay spent', async () => {
  const t = await stage();
  try {
    saveLandsButErrs(t);
    const result = await t.run();
    expect(result, 'the run failed, but the turn was saved').toMatchObject({ ok: false, committed: true });
    expect(t.game()['turn'], 'the game is on Turn 2').toBe(2);
    expect(ordersOf(t), 'the orders were not put back').toEqual(spent);
    expect(t.message()).toMatch(/Turn 1 WAS saved/);
  } finally {
    t.W.close();
  }
}, 30_000);

test('the save answers with an error and the game cannot be read again: nothing is put back', async () => {
  const t = await stage();
  try {
    saveLandsButErrs(t, true);
    const result = await t.run();
    expect(result, 'the run reports its failure').toMatchObject({ ok: false, committed: false });
    expect(ordersOf(t), 'the orders were not put back onto a turn that may be saved').toEqual(spent);
    expect(t.message()).toMatch(/may or may not have gone through/);
  } finally {
    t.W.close();
  }
}, 30_000);

// Passes on main too: it holds today's behaviour, for P1-18d (which moves the reports after the save) to keep.
test('a turn report fails after the save: the turn stands, and the orders stay spent', async () => {
  const t = await stage();
  try {
    t.W.eval("window.buildTurnReport=()=>{ throw new Error('a report could not be built'); };");
    const result = await t.run();
    expect(result, 'the run failed after the save').toMatchObject({ ok: false, committed: true, conflict: false });
    expect(result.error).toBe('a report could not be built');
    expect(t.game()['turn'], 'the game is on Turn 2').toBe(2);
    expect(ordersOf(t), 'the orders were not put back').toEqual(spent);
    expect(t.message()).toMatch(/Turn 1 WAS resolved and saved/);
  } finally {
    t.W.close();
  }
}, 30_000);

// Passes on main too: P1-18d moved these writes from runTurn into the shell, unchanged (its PR compares every write of
// the balance matrix's games on main and on the branch, byte for byte). This holds what a later change must keep.
test("a turn's writes: the clear, the save, then each realm's report, the GM's log and the telemetry", async () => {
  const t = await stage();
  try {
    const writes = recordWrites(t);
    const result = await t.run();
    expect(result).toMatchObject({ ok: true, committed: true, turn: 2 });
    expect(
      writes.map((w) => `${w.call} ${w.query}`.trim()),
      'the writes, in order: the save comes before any report',
    ).toEqual([
      'game_players.update eq(game_id,G1)',
      'games.update eq(id,G1) eq(turn,1) select(id) maybeSingle()',
      'game_players.update eq(id,G1gp0)',
      'turn_logs.insert',
      'game_players.update eq(id,G1gp1)',
      'turn_logs.insert',
      'turn_logs.insert',
      'turn_events.upsert onConflict(game_id,turn,player_index)',
    ]);
    const [clear, save, report0, snapshot0, report1, snapshot1, gmLog, telemetry] = writes.map((w) => w.payload);
    expect(clear, 'the orders are cleared').toEqual({ orders: null, orders_submitted: false });

    // The save: the world after the turn, its summary for the game list, and the turn it now stands on.
    const saved = save as Row;
    expect(Object.keys(saved)).toEqual(['game_state', 'meta', 'turn', 'status']);
    expect(saved).toMatchObject({ turn: 2, status: 'active' });
    const world = JSON.parse(String(saved['game_state'])) as { turn: number; turnMode: Record<string, unknown> };
    expect(world.turn).toBe(2);
    expect(world.turnMode, 'the shell stamps the run').toMatchObject({ mode: 'manual', nextDeadlineAt: null });
    expect(Date.parse(String(world.turnMode['turnRanAt']))).toBeGreaterThanOrEqual(Date.parse(NOW));
    const metaOf = t.W.eval('(gs)=>JSON.stringify(buildGameMeta(gs))') as (gs: unknown) => string;
    expect(saved['meta'], 'the summary is of the world saved').toEqual(JSON.parse(metaOf(world)));

    // Each realm's report: on its own row, the same as its turn_logs snapshot, stamped with the page's build.
    const stamp = t.W.eval('KC_BUILD_STAMP') as string;
    for (const [realm, [report, snapshot]] of [
      [report0, snapshot0],
      [report1, snapshot1],
    ].entries()) {
      expect(Object.keys(report as Row)).toEqual(['turn_report']);
      const sent = JSON.parse(String((report as Row)['turn_report'])) as Row;
      expect(sent).toMatchObject({ playerIndex: realm, turnNumber: 2, engineStamp: stamp });
      expect(Object.keys(snapshot as Row)).toEqual(['game_id', 'player_index', 'turn', 'entries']);
      expect(snapshot, `realm ${String(realm)}'s snapshot is its report`).toEqual({
        game_id: 'G1',
        player_index: realm,
        turn: 1,
        entries: sent,
      });
    }

    // The GM's whole log of the turn, then one statistics row per realm.
    expect(Object.keys(gmLog as Row)).toEqual(['game_id', 'player_index', 'turn', 'entries']);
    expect(gmLog).toMatchObject({ game_id: 'G1', player_index: -1, turn: 1 });
    const lines = (gmLog as Row)['entries'] as Row[];
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((e) => typeof e['type'] === 'string' && typeof e['text'] === 'string')).toBe(true);
    expect((telemetry as Row[]).map((r) => [r['game_id'], r['turn'], r['player_index'], r['build']])).toEqual([
      ['G1', 1, 0, `GM ${stamp} tel1`],
      ['G1', 1, 1, `GM ${stamp} tel1`],
    ]);
  } finally {
    t.W.close();
  }
}, 30_000);

// Fails on main, where runTurn returns no seed and the turn draws from the page's own dice (P1-18e).
test('each turn plays from its own seed, and the page gets its dice back', async () => {
  // The page's dice pinned to a stream the test can follow (as the screenshot tour pins them, tests/lib/screens.js); the
  // test also draws the page's next number while each save is out, as other page code could.
  const followed = async () => {
    const t = await stage();
    try {
      t.W.eval('kcRng.use(kcRngStream(77));');
      const duringSave: number[] = [];
      const from = t.client.from.bind(t.client);
      t.client.from = (table) => {
        const q = from(table);
        if (table !== 'games') return q;
        const update = q.update.bind(q);
        q.update = (p) => {
          duringSave.push(t.W.eval('kcRng()') as number);
          return update(p);
        };
        return q;
      };
      const first = await t.run();
      const second = await t.run();
      expect(first, 'turn 1 was saved').toMatchObject({ ok: true, committed: true, turn: 2 });
      expect(second, 'turn 2 was saved').toMatchObject({ ok: true, committed: true, turn: 3 });
      return { seeds: [first.seed, second.seed], duringSave, after: t.W.eval('kcRng()') as number };
    } finally {
      t.W.close();
    }
  };
  const run = await followed();
  // The page's stream: each turn takes one number for its seed, and the page draws the rest.
  const page = (vm.runInContext('kcRngStream', loadEngine({ seed: 1 })) as (s: number) => () => number)(77);
  const [seed1, draw1, seed2, draw2, after] = Array.from({ length: 5 }, () => page());
  const seedOf = (x = 0) => Math.floor(x * 2 ** 32) || 1;
  for (const seed of run.seeds) {
    expect(Number.isInteger(seed), `the seed ${String(seed)} is an integer`).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(1);
    expect(seed).toBeLessThan(2 ** 32);
  }
  expect(run.duringSave, "while the save is out, the page draws from its own dice, not the turn's").toEqual([
    draw1,
    draw2,
  ]);
  expect(run.seeds, "each turn's seed is the page's next number, as a 32-bit integer").toEqual([
    seedOf(seed1),
    seedOf(seed2),
  ]);
  expect(run.seeds[0], 'two turns, two seeds').not.toBe(run.seeds[1]);
  expect(run.after, 'after the turns, the page carries on with its own dice').toBe(after);
  expect((await followed()).seeds, 'the same page dice give the same seeds').toEqual(run.seeds);
}, 60_000);

// Fails on the base of P1-08m, where the shell lent the turn its dice itself and handed resolveTurn three arguments.
// Since P1-08m resolveTurn takes the seed and lends itself the dice (tests/unit/the-turns-own-dice-from-its-seed).
test('the shell hands resolveTurn the seed it returns, each turn its own', async () => {
  const t = await stage();
  try {
    t.W.eval(`(function(){ const real=resolveTurn; window.__handed=[];
      window.resolveTurn=function(...a){ __handed.push(a.slice(3)); return real(...a); }; })()`);
    const first = await t.run();
    const second = await t.run();
    expect(first, 'turn 1 was saved').toMatchObject({ ok: true, committed: true, turn: 2 });
    expect(second, 'turn 2 was saved').toMatchObject({ ok: true, committed: true, turn: 3 });
    expect(first.seed, 'two turns, two seeds').not.toBe(second.seed);
    expect(
      JSON.parse(String(t.W.eval('JSON.stringify(__handed)'))),
      'what resolveTurn was handed after the state, the slot rows and the turn',
    ).toEqual([[first.seed], [second.seed]]);
  } finally {
    t.W.close();
  }
}, 60_000);

// The turn's output with the shell's stamps taken out, as JSON: the time of the run and the next deadline in the
// world's turn mode, and each report's engineStamp (null from the engine, the page's build on the page). The page's
// and the engine's output both go through it.
function engineOutput(state: string, log: unknown, reports: Map<unknown, string>) {
  const world = JSON.parse(state) as { turnMode?: Record<string, unknown> };
  if (world.turnMode) {
    delete world.turnMode['turnRanAt'];
    delete world.turnMode['nextDeadlineAt'];
  }
  const unstamped = (report: string) => {
    const r = JSON.parse(report) as Record<string, unknown>;
    delete r['engineStamp'];
    return JSON.stringify(r);
  };
  return {
    state: JSON.stringify(world),
    log: JSON.stringify(log),
    reports: [...reports].map(([realm, report]) => [realm, unstamped(report)]),
  };
}

// '' when the two are the same, byte for byte; else where they first differ, with a little of each.
function firstDifference(a: string, b: string): string {
  if (a === b) return '';
  let i = 0;
  while (a[i] === b[i]) i++;
  return `at ${String(i)} of ${String(a.length)}/${String(b.length)}: ${a.slice(i - 40, i + 80)} | ${b.slice(i - 40, i + 80)}`;
}

// Fails on main, where runTurn returns no seed. Level 4 (page): the page's turn, through its shell and database, is
// half of what is compared; the other half is the engine alone, in the bare vm (tests/lib/engine.ts).
test('the page plays the turn the engine plays from the seed the shell returns', async () => {
  const world = newWorld(loadEngine({ seed: GAME.seed }));
  const t = seat(await boot(GAME.seed), () => ({ world, rows: JSON.parse(slotRowsJson(world, 1)) as Row[] }));
  let page;
  let seed;
  try {
    const result = await t.run();
    expect(result, 'the page saved the turn').toMatchObject({ ok: true, committed: true, turn: 2 });
    seed = Number(result.seed);
    const logs = t.S.DB['turn_logs'] ?? [];
    page = engineOutput(
      String(t.game()['game_state']),
      logs.find((l) => l['player_index'] === -1)?.['entries'],
      new Map(
        logs
          .filter((l) => Number(l['player_index']) >= 0)
          .map((l) => {
            const row = t.players().find((p) => p['player_index'] === l['player_index']);
            return [l['player_index'], String(row?.['turn_report'])];
          }),
      ),
    );
  } finally {
    t.W.close();
  }

  // The engine alone, its dice started from the page's turn seed, on the same world and slot rows.
  // Its console quiet but for warnings and errors, which are noted, as the page's are.
  const engine = loadEngine({ seed: GAME.seed });
  const said: string[] = [];
  (
    vm.runInContext(
      `(said, seed)=>{ const tell=(how)=>(...a)=>{ said.push(how+': '+a.map(String).join(' ')); };
        globalThis.console={log(){},info(){},debug(){},warn:tell('warn'),error:tell('error')};
        kcRng.use(kcRngStream(seed)); }`,
      engine,
    ) as (said: string[], seed: number) => void
  )(said, seed);
  const resolveTurn = vm.runInContext('resolveTurn', engine) as (
    state: string,
    rows: unknown,
    turn: number,
  ) => { state: string; log: unknown; buildReports(): { reports: { gp: Row; report: unknown }[] } };
  const resolved = resolveTurn(world, slotRows(engine, world, 1), 1);
  const { reports } = resolved.buildReports();
  const alone = engineOutput(
    resolved.state,
    resolved.log,
    new Map(reports.map(({ gp, report }) => [gp['player_index'], JSON.stringify(report)])),
  );

  expect(
    page.reports.map(([realm]) => realm),
    "the scripted player's report, and no bot's",
  ).toEqual([0]);
  expect(firstDifference(page.state, alone.state), 'the world after the turn').toBe('');
  expect(firstDifference(page.log, alone.log), "the GM's log").toBe('');
  expect(page.reports, 'each report').toEqual(alone.reports);
}, 60_000);
