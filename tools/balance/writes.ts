// The balance matrix's `writes` column (plan P1-02c): every write and database function (rpc) a turn sends to the
// database, in order, as the calls to the page's Db (src/db/the-db-interface-and-its-areas.ts) that sent them: the
// area and function called, with its arguments. The other columns hash what the turn saved; this one hashes how it
// said it, so a change to what a call sends (a game's turn it saves on, the save's `meta`, a realm's `turn_logs`
// snapshot), a call left out or the order of the writes shows even where nothing in play changed.
//
// Since P1-17s1 the matrix plays on the typed fake (tests/lib/fake-db.ts, the GM's world), and the column is recorded at
// Db's calls (plan P1-17, Decision 9 and Open choice 6), no longer at the stand-in client's query steps: it changed
// form once. The recorder wraps the Db the page is handed, before the page boots. A call is a write when a query it
// ran on the fake is one: the fake lists each query it runs ("table.op" or "rpc.name") as it runs it, at the call,
// before the call answers. Reads aren't recorded; the database's version check never reaches the GM's world (the fake
// answers it). A write is recorded as a copy, taken as it is called: the fake keeps references to what it is sent.
// The masking is the other columns' (hash.ts): the stand-in's ids and stamps and the build stamp at the top level of a
// row or a report, and, when hashed, the prose and clock readings. JSON held as a string (a row's `game_state` or
// `turn_report`, or a report handed as a whole argument) is parsed first, so the masking reaches inside it.
import type { Db } from '../../src/db/the-db-interface-and-its-areas.ts';
import { withoutStamps } from './hash.ts';

/** One call to the Db that wrote, as recorded: the area and function called, e.g.
 *  `theTurnAsTheGameMasterRunsIt.saveThisGameWhileOnThisTurnAndAnswerItsId`, and its arguments, masked, in order. */
export interface Call {
  call: string;
  args: unknown[];
}

/** The operations of a query that make it a write. */
const WRITE_OPS = new Set(['insert', 'upsert', 'update', 'delete']);

/** Whether a query the fake ran ("table.op" or "rpc.name") is a write or a database function. */
export const aQueryThatWrites = (query: string): boolean =>
  query.startsWith('rpc.') || WRITE_OPS.has(query.slice(query.lastIndexOf('.') + 1));

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

/** One argument of a call, masked: a row or a list of rows as a payload; a string holding a JSON object (a realm's
 *  report, handed whole) parsed and masked as the `report` column masks a report; anything else kept as it is. */
export function maskArgument(arg: unknown): unknown {
  if (typeof arg !== 'string') return maskPayload(arg);
  try {
    const parsed: unknown = JSON.parse(arg);
    return isRecord(parsed) ? withoutStamps(parsed) : arg;
  } catch {
    return arg; // not JSON: kept as written
  }
}

/** A copy of the call `call` with its arguments masked, taken now. */
export function snapshot(call: string, args: readonly unknown[]): Call {
  return { call, args: structuredClone(args.map(maskArgument)) };
}

/** `db`, each of its calls that ran a query that writes (the fake lists the queries it runs in `theQueriesTheFakeRan`,
 *  as it runs them) recorded, in order, into `calls`. Empty the list (`splice(0)`) to take one turn's calls. */
export function recordTheWritesAtTheDbsCalls(
  db: Db,
  theQueriesTheFakeRan: readonly string[],
): { readonly db: Db; readonly calls: Call[] } {
  const calls: Call[] = [];
  const theAreaRecorded = (areaName: string, area: object) =>
    new Proxy(area, {
      get(target, name, receiver) {
        const value: unknown = Reflect.get(target, name, receiver);
        if (typeof value !== 'function' || typeof name !== 'string') return value;
        return (...args: unknown[]): unknown => {
          const before = theQueriesTheFakeRan.length;
          const answer: unknown = Reflect.apply(value, target, args);
          if (theQueriesTheFakeRan.slice(before).some(aQueryThatWrites))
            calls.push(snapshot(`${areaName}.${name}`, args));
          return answer;
        };
      },
    });
  const recorded = new Proxy(db, {
    get(target, name, receiver) {
      const area: unknown = Reflect.get(target, name, receiver);
      return typeof area === 'object' && area !== null && typeof name === 'string' ? theAreaRecorded(name, area) : area;
    },
  });
  return { db: recorded, calls };
}
