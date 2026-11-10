// The database-call recorder (tools/proof/every-database-call-a-page-makes.ts; plan P1-17, Decision 12), on a small
// stand-in client: without KC_RECORD_DATABASE_CALLS it hands the client back as it is; with it, it writes the client's
// making, then one line a call to <folder>/<process id>.jsonl: a query (from, rpc) once it is awaited, with every step
// called on it and their arguments; an auth or channel call when it is made, its steps too; functions as <function>,
// times (ISO stamps, milliseconds since 1970) as <time>. And the client still answers as it did.
// Level 1 (unit): the recorder is a function of a client and the environment; the area rows' proofs run it over every
// page test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { recordEveryDatabaseCall } from '../../tools/proof/every-database-call-a-page-makes.ts';

interface AStandInQuery extends PromiseLike<{ data: unknown; error: null }> {
  select: (columns: string) => AStandInQuery;
  eq: (column: string, value: unknown) => AStandInQuery;
  gte: (column: string, value: unknown) => AStandInQuery;
}
interface AStandInClient {
  from: (table: string) => AStandInQuery;
  rpc: (fn: string, args?: object) => Promise<{ data: unknown; error: null }>;
  auth: { getSession: () => Promise<{ data: { session: null } }> };
  channel: (name: string) => { on: (event: string, filter: object, then: () => void) => { subscribe: () => string } };
}

/** A client whose queries answer `rows` and whose calls do nothing else. */
function aStandInClient(rows: unknown): AStandInClient {
  const query: AStandInQuery = {
    select: () => query,
    eq: () => query,
    gte: () => query,
    then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
  };
  return {
    from: () => query,
    rpc: (fn) => Promise.resolve({ data: fn, error: null }),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    channel: () => ({ on: () => ({ subscribe: () => 'subscribed' }) }),
  };
}

let folder: string;
const before = process.env['KC_RECORD_DATABASE_CALLS'];
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-recorder-'));
});
afterEach(() => {
  if (before === undefined) delete process.env['KC_RECORD_DATABASE_CALLS'];
  else process.env['KC_RECORD_DATABASE_CALLS'] = before;
  fs.rmSync(folder, { recursive: true, force: true });
});
/** The lines written so far, each parsed. */
const theLines = (): unknown[] => {
  const file = path.join(folder, `${String(process.pid)}.jsonl`);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .trimEnd()
    .split('\n')
    .map((l): unknown => JSON.parse(l));
};

describe('the database-call recorder', () => {
  test('without KC_RECORD_DATABASE_CALLS, it hands the client back as it is and writes nothing', () => {
    delete process.env['KC_RECORD_DATABASE_CALLS'];
    const client = aStandInClient([]);
    expect(recordEveryDatabaseCall(client, ['url', 'key'])).toBe(client);
    expect(fs.readdirSync(folder)).toEqual([]);
  });

  test("with it, a query is written once it is awaited, with its steps; the answer is the client's", async () => {
    process.env['KC_RECORD_DATABASE_CALLS'] = folder;
    const client = recordEveryDatabaseCall(aStandInClient([{ id: 'g1' }]), ['http://127.0.0.1:54321', 'key']);
    expect(theLines()).toEqual([
      { call: 'createClient', steps: [['createClient', ['http://127.0.0.1:54321', 'key']]] },
    ]);
    const query = client.from('games').select('id, turn').eq('id', 'g1');
    expect(theLines()).toHaveLength(1);
    expect(await query).toEqual({ data: [{ id: 'g1' }], error: null });
    expect(theLines()[1]).toEqual({
      call: 'from.games',
      steps: [
        ['from', ['games']],
        ['select', ['id, turn']],
        ['eq', ['id', 'g1']],
      ],
    });
  });

  test('an rpc that answers at once, an auth call and a channel are written when made, with their steps', async () => {
    process.env['KC_RECORD_DATABASE_CALLS'] = folder;
    const client = recordEveryDatabaseCall(aStandInClient([]), []);
    expect(await client.rpc('kc_db_version')).toEqual({ data: 'kc_db_version', error: null });
    await client.auth.getSession();
    expect(
      client
        .channel('turns')
        .on('postgres_changes', { table: 'games' }, () => undefined)
        .subscribe(),
    ).toBe('subscribed');
    expect(theLines().slice(1)).toEqual([
      { call: 'rpc.kc_db_version', steps: [['rpc', ['kc_db_version']]] },
      { call: 'auth.getSession', steps: [['getSession', []]] },
      { call: 'client.channel', steps: [['channel', ['turns']]] },
      { call: 'client.channel.on', steps: [['on', ['postgres_changes', { table: 'games' }, '<function>']]] },
      { call: 'client.channel.on.subscribe', steps: [['subscribe', []]] },
    ]);
  });

  test("times in a call's arguments read as <time>", async () => {
    process.env['KC_RECORD_DATABASE_CALLS'] = folder;
    const client = recordEveryDatabaseCall(aStandInClient([]), []);
    await client.from('turn_events').select('*').gte('at', '2026-11-10T05:00:00.000Z').eq('ms', 1762750800000);
    expect(theLines()[1]).toEqual({
      call: 'from.turn_events',
      steps: [
        ['from', ['turn_events']],
        ['select', ['*']],
        ['gte', ['at', '<time>']],
        ['eq', ['ms', '<time>']],
      ],
    });
  });
});
