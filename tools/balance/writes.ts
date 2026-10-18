// The balance matrix's `writes` column (plan P1-02c): every write and database function (rpc) a turn sends to the
// stand-in database, in order, with its table, operation, filters, modifiers and payload. The other columns hash what
// the turn saved; this one hashes how it said it, so a change to a filter, the save's `meta`, a realm's `turn_logs`
// snapshot or the order of the writes shows even where nothing in play changed. P1-17 moves these writes: the column
// must stay the same through it.
//
// The recorder wraps the stand-in client's `from` and `rpc` once, before the page boots. Reads aren't recorded (a
// query with no write step); `rpc('kc_db_version')` never reaches the client (bootJsdom answers it). A write is
// recorded when its query runs (when it is awaited), as a copy: the stand-in keeps references to what it is sent.
// The masking is the other columns' (hash.ts): the stand-in's ids and stamps and the build stamp at the top level of a
// row or a report, and, when hashed, the prose and clock readings. Payload columns holding JSON as a string are parsed
// first, so the masking reaches inside them.
import { withoutStamps } from './hash.ts';

/** The stand-in client, as far as the recorder needs it. */
export interface Client {
  from(table: string): unknown;
  rpc(fn: string, ...args: unknown[]): unknown;
}

/** One call to the database, as recorded: `games.update` with its steps in the order called, e.g.
 *  [['update', [{…}]], ['eq', ['id', 'G1']], ['select', ['id']]], or `rpc.<name>` with [['rpc', [args]]]. */
export interface Call {
  call: string;
  steps: [string, unknown[]][];
}

/** The builder steps that make a query a write; their first argument is the payload. */
const WRITE_OPS = new Set(['insert', 'upsert', 'update', 'delete']);

/** Payload columns that hold JSON as a string, and how each is masked once parsed: the saved world as the `state`
 *  column hashes it, a realm's report as the `report` column does. */
const JSON_COLUMNS: Readonly<Record<string, (v: unknown) => unknown>> = {
  game_state: (v) => v,
  turn_report: withoutStamps,
};
/** Payload columns that hold a report as an object: a realm's `turn_logs` snapshot is its report. */
const REPORT_COLUMNS = new Set(['entries']);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A payload row without its stamps, its JSON strings parsed. */
function maskRow(row: unknown): unknown {
  if (!isRecord(row)) return row;
  const out = withoutStamps(row) as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) {
    const mask = JSON_COLUMNS[k];
    if (mask && typeof v === 'string') {
      try {
        out[k] = mask(JSON.parse(v));
      } catch {
        // not JSON: kept as written
      }
    } else if (REPORT_COLUMNS.has(k)) out[k] = withoutStamps(v);
  }
  return out;
}

/** A write's payload (one row or a list of rows), masked. */
export const maskPayload = (p: unknown): unknown => (Array.isArray(p) ? p.map(maskRow) : maskRow(p));

/** A copy of `call` with its payload masked, taken now. */
export function snapshot(call: string, steps: [string, unknown[]][]): Call {
  const masked = steps.map(([name, args]): [string, unknown[]] =>
    WRITE_OPS.has(name) && args.length ? [name, [maskPayload(args[0]), ...args.slice(1)]] : [name, args],
  );
  return { call, steps: structuredClone(masked) };
}

/** Wraps `client` so that every write and rpc it is sent is recorded, in order, into the list returned. Empty the
 *  list (`splice(0)`) to take one turn's calls. */
export function recordCalls(client: Client): Call[] {
  const calls: Call[] = [];
  const from = client.from.bind(client);
  const rpc = client.rpc.bind(client);
  client.from = (table) => {
    const q = from(table);
    if (!isRecord(q)) return q;
    const steps: [string, unknown[]][] = [];
    for (const [name, step] of Object.entries(q)) {
      if (typeof step !== 'function' || name === 'then') continue;
      q[name] = (...args: unknown[]) => {
        steps.push([name, args]);
        return (step as (...a: unknown[]) => unknown).apply(q, args);
      };
    }
    const then = q['then'];
    if (typeof then === 'function') {
      q['then'] = (...args: unknown[]) => {
        const op = steps.find(([name]) => WRITE_OPS.has(name));
        if (op) calls.push(snapshot(`${table}.${op[0]}`, steps));
        return (then as (...a: unknown[]) => unknown).apply(q, args);
      };
    }
    return q;
  };
  client.rpc = (fn, ...args) => {
    calls.push(snapshot(`rpc.${fn}`, [['rpc', args]]));
    return rpc(fn, ...args);
  };
  return calls;
}
