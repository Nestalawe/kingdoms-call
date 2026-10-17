// The turn's shell: its one failure path (plan step P1-18a) and its database writes (P1-18d). runTurn always returns
// {ok, committed, conflict, error}, and a failed run puts the players' orders back only when the turn was not saved.
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
// Level 4 (page): these are the GM portal's database calls, made by the turn's shell (runTurn, src/ui/gm/turn-shell.js)
// around the engine's resolveTurn; the shell runs only in the booted page, against its database.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { makeStub, type Row, type Stub } from '../lib/stub-db.js';

const NOW = '2026-10-01T12:00:00Z';
const ERROR = { message: 'the database is unreachable' };

interface Outcome {
  ok?: boolean;
  committed?: boolean;
  conflict?: boolean;
  error?: string;
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
  const S = makeStub();
  const logged: string[] = [];
  const dom = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
    supabase: S.supabase,
    seed: 4321,
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
  const games = S.DB['games'] ?? [];
  const players = S.DB['game_players'] ?? [];
  games.push({
    id: 'G1',
    name: 'Failure path',
    gm_user_id: 'gm1',
    status: 'active',
    turn: 1,
    max_players: 2,
    max_turns: 0,
    created_at: new Date().toISOString(),
    game_state: W.eval('JSON.stringify(__G)'),
    meta: W.eval('JSON.parse(JSON.stringify(buildGameMeta(__G)))'),
  });
  orders.forEach((o, i) => {
    players.push({
      id: 'G1gp' + String(i),
      game_id: 'G1',
      user_id: 'u' + String(i),
      player_index: i,
      display_name: 'Realm' + String(i),
      orders_submitted: o !== DRAFT,
      orders: o,
      turn_report: JSON.stringify({}),
    });
  });
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
