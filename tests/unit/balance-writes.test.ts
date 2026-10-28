// The balance matrix's `writes` column (tools/balance/writes.ts, P1-02c): what the recorder sees of a turn's calls to
// the database, when it takes its copy, and what its masking leaves out. A small fake client stands in for the
// stand-in database (a new test may not use tests/lib/stub-db.js: tests/ratchet.json). Level 1 (unit): pure functions
// and a recorder over a fake; the matrix (npm run balance) plays the real turns.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The matrix's `writes` column (P1-02c), on a small fake client (not `lib/stub-db.js`): every write and `rpc` recorded
// in order with its table, operation, steps and arguments, reads not; the copy taken when the query runs; a query never
// run not recorded; the masking (stamps at a row's top level, `game_state` and `turn_report` parsed, a `turn_logs`
// snapshot's build stamp, clock readings); a field dropped from `meta`, a filter changed and two writes swapped each
// change the hash. TypeScript, in `unit/`
import { describe, expect, test } from 'vitest';
import { playHash } from '../../tools/balance/hash.ts';
import { maskPayload, recordCalls, type Call, type Client } from '../../tools/balance/writes.ts';

/** A client whose queries chain like supabase-js's and answer when awaited; `ran` lists what ran, in order. */
function fakeClient() {
  const ran: string[] = [];
  const client: Client = {
    from(table: string) {
      let op = 'select';
      const q: Record<string, unknown> = {};
      for (const name of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'in', 'order', 'maybeSingle'])
        q[name] = () => {
          if (['insert', 'upsert', 'update', 'delete'].includes(name)) op = name;
          return q;
        };
      q['then'] = (resolve: (v: unknown) => unknown) => {
        ran.push(`${table}.${op}`);
        return Promise.resolve({ data: null, error: null }).then(resolve);
      };
      return q;
    },
    rpc: (fn: string) => {
      ran.push(`rpc.${fn}`);
      return Promise.resolve({ data: [], error: null });
    },
  };
  return { client, ran };
}

/** The fake's query, as the tests chain it. */
interface Query extends PromiseLike<unknown> {
  select(cols: string): Query;
  insert(row: unknown): Query;
  upsert(rows: unknown, options?: { onConflict: string }): Query;
  update(row: unknown): Query;
  delete(): Query;
  eq(col: string, v: unknown): Query;
  in(col: string, v: unknown[]): Query;
  maybeSingle(): Query;
}
const from = (c: Client, table: string) => c.from(table) as Query;

const save = (meta: Record<string, unknown>) => ({
  game_state: JSON.stringify({ turn: 2, turnMode: { turnRanAt: '2026-10-01T12:00:00.035Z' } }),
  meta,
  turn: 2,
});

/** The calls of one made-up turn: `edit` changes one thing about them. */
async function turn(edit: { meta?: Record<string, unknown>; turnFilter?: number; swap?: boolean } = {}) {
  const { client } = fakeClient();
  const calls = recordCalls(client);
  const clear = () => from(client, 'game_players').update({ orders: null }).eq('game_id', 'G1');
  const saveIt = () =>
    from(client, 'games')
      .update(save(edit.meta ?? { v: 1, realms: 3 }))
      .eq('id', 'G1')
      .eq('turn', edit.turnFilter ?? 1)
      .select('id')
      .maybeSingle();
  for (const q of edit.swap ? [saveIt, clear] : [clear, saveIt]) await q();
  return calls;
}

describe('the recorder', () => {
  test('records each write and rpc in order: table, operation, every step and its arguments; not reads', async () => {
    const { client, ran } = fakeClient();
    const calls = recordCalls(client);
    await from(client, 'games').select('*').eq('id', 'G1');
    await from(client, 'games').update({ turn: 2 }).eq('id', 'G1').eq('turn', 1).select('id').maybeSingle();
    await from(client, 'turn_events').upsert([{ turn: 1 }], { onConflict: 'game_id,turn,player_index' });
    await client.rpc('get_game_slots', { p_games: ['G1'] });
    await from(client, 'turn_logs').delete().in('turn', [1, 2]);
    expect(ran, 'every call still reaches the client').toEqual([
      'games.select',
      'games.update',
      'turn_events.upsert',
      'rpc.get_game_slots',
      'turn_logs.delete',
    ]);
    expect(calls).toEqual<Call[]>([
      {
        call: 'games.update',
        steps: [
          ['update', [{ turn: 2 }]],
          ['eq', ['id', 'G1']],
          ['eq', ['turn', 1]],
          ['select', ['id']],
          ['maybeSingle', []],
        ],
      },
      {
        call: 'turn_events.upsert',
        steps: [['upsert', [[{ turn: 1 }], { onConflict: 'game_id,turn,player_index' }]]],
      },
      { call: 'rpc.get_game_slots', steps: [['rpc', [{ p_games: ['G1'] }]]] },
      {
        call: 'turn_logs.delete',
        steps: [
          ['delete', []],
          ['in', ['turn', [1, 2]]],
        ],
      },
    ]);
  });

  test('takes its copy when the query runs: a later change to what was sent is not seen', async () => {
    const { client } = fakeClient();
    const calls = recordCalls(client);
    const row = { gold: 4, army: { units: 2 } };
    const q = from(client, 'games').update(row).eq('id', 'G1');
    row.gold = 5; // before it runs: part of the write
    await q;
    row.army.units = 9; // after: the stand-in may keep this object, but the write was already sent
    expect(calls[0]?.steps[0]).toEqual(['update', [{ gold: 5, army: { units: 2 } }]]);
    expect(calls.splice(0)).toHaveLength(1);
    expect(calls, 'splice(0) takes one turn and leaves the list empty').toEqual([]);
  });

  test("a query built but never run isn't recorded", () => {
    const { client } = fakeClient();
    const calls = recordCalls(client);
    from(client, 'games').update({ turn: 2 }).eq('id', 'G1');
    expect(calls).toEqual([]);
  });
});

describe("the masking (the other columns', hash.ts)", () => {
  test("drops the stand-in's ids and stamps and the build stamp at a row's top level, not deeper", () => {
    expect(
      maskPayload([
        { id: 'row7', created_at: 'x', updated_at: 'y', build: 'GM 2026.10.18-2300 tel1', turn: 1, pre: { id: 3 } },
      ]),
    ).toEqual([{ turn: 1, pre: { id: 3 } }]);
  });

  test('parses the JSON held as a string: the saved world as the state column sees it, a report as the report column does', () => {
    const report = { engineStamp: '2026.10.18-2300', playerIndex: 0, kingdom: { gold: 4, id: 2 } };
    expect(
      maskPayload({ game_state: JSON.stringify({ id: 1, turn: 2 }), turn_report: JSON.stringify(report) }),
    ).toEqual({ game_state: { id: 1, turn: 2 }, turn_report: { playerIndex: 0, kingdom: { gold: 4, id: 2 } } });
    expect(maskPayload({ game_state: 'not json' })).toEqual({ game_state: 'not json' });
  });

  test("a realm's turn_logs snapshot is its report: its build stamp goes too; the GM log's lines are kept", () => {
    expect(maskPayload({ player_index: 0, entries: { engineStamp: 'x', kingdom: { gold: 1 } } })).toEqual({
      player_index: 0,
      entries: { kingdom: { gold: 1 } },
    });
    const lines = [{ type: 'move', text: 'A moves.' }];
    expect(maskPayload({ player_index: -1, entries: lines })).toEqual({ player_index: -1, entries: lines });
  });

  test('once hashed, clock readings inside the parsed save and a rebuilt stamp make no difference', async () => {
    const a = await turn();
    const { client } = fakeClient();
    const calls = recordCalls(client);
    await from(client, 'game_players').update({ orders: null }).eq('game_id', 'G1');
    const later = { ...save({ v: 1, realms: 3 }), id: 'G1', updated_at: 'now', build: 'other' };
    later.game_state = later.game_state.replace('12:00:00.035Z', '12:00:00.071Z');
    await from(client, 'games').update(later).eq('id', 'G1').eq('turn', 1).select('id').maybeSingle();
    expect(playHash(calls)).toBe(playHash(a));
  });
});

// The three faults P1-02c's Done-when plants on copies of the site, here on one made-up turn.
describe('what changes the hash', () => {
  test("a field dropped from the save's meta, a filter changed, two writes swapped", async () => {
    const base = playHash(await turn());
    expect(playHash(await turn()), 'the same turn: the same hash').toBe(base);
    expect(playHash(await turn({ meta: { v: 1 } })), 'meta.realms dropped').not.toBe(base);
    expect(playHash(await turn({ turnFilter: 2 })), 'eq(turn, 2)').not.toBe(base);
    expect(playHash(await turn({ swap: true })), 'the save before the orders are cleared').not.toBe(base);
  });
});
