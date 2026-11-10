// The database-call recorder, for the proof of P1-17's area rows (plan P1-17, Decision 12; tools/proof/README.md,
// section 6): with KC_RECORD_DATABASE_CALLS=<folder>, every client a page makes in jsdom (bootJsdom, tests/lib/boot.js:
// the page tests, the old page scripts and the screen tours) records every call the page sends it, reads too, with its
// steps and their arguments, one line a call, appended to <folder>/<process id>.jsonl. A query (from, rpc) is recorded
// when the page awaits it, with every step called on it by then; any other call (auth.…, channel and its steps) when it
// is made. A row that moves calls onto Db gives the lines, sorted, the same with KC_SITE the base's site and the row's.
// Without the variable boot.js never loads this file, so the balance matrix, which boots through boot.js too, plays
// without it. Times in the arguments (ISO stamps, milliseconds since 1970) read as <time>: the tests' clocks aren't all
// pinned. The browser specs (Chromium) aren't recorded.
import fs from 'node:fs';
import path from 'node:path';

type Step = [string, unknown[]];

const STAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g;
const MILLISECONDS = /\b1\d{12}\b/g;
const A_TIME_IN_MILLISECONDS = /^1\d{12}$/;

/** One call as a line of JSON: its name and steps, functions named, times masked (a number of them read as the word,
 *  so the line stays JSON). */
function line(call: string, steps: readonly Step[]): string {
  const json = JSON.stringify({ call, steps }, (_key, value: unknown) =>
    typeof value === 'function'
      ? '<function>'
      : value === undefined
        ? '<undefined>'
        : typeof value === 'number' && A_TIME_IN_MILLISECONDS.test(String(value))
          ? '<time>'
          : value,
  );
  return json.replace(STAMP, '<time>').replace(MILLISECONDS, '<time>');
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  (typeof v === 'object' || typeof v === 'function') && v !== null;

/** Wraps `client` (made with `made`, createClient's arguments) when KC_RECORD_DATABASE_CALLS names a folder; else
 *  hands it back as it is. */
export function recordEveryDatabaseCall<T>(client: T, made: readonly unknown[]): T {
  const folder = process.env['KC_RECORD_DATABASE_CALLS'];
  if (!folder || !isObject(client)) return client;
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${String(process.pid)}.jsonl`);
  const write = (call: string, steps: readonly Step[]): void => {
    fs.appendFileSync(file, line(call, steps) + '\n');
  };
  write('createClient', [['createClient', [...made]]]);

  /** A query (the builder from or rpc gives): each step recorded on it, the whole written when it is awaited. */
  const query = (call: string, steps: Step[], builder: unknown): unknown => {
    if (!isObject(builder)) return builder;
    return new Proxy(builder, {
      get(target, key, receiver) {
        const value: unknown = Reflect.get(target, key, receiver);
        if (typeof key !== 'string' || typeof value !== 'function') return value;
        if (key === 'then')
          return (...args: unknown[]): unknown => {
            write(call, steps);
            return Reflect.apply(value, target, args);
          };
        return (...args: unknown[]): unknown => {
          steps.push([key, args]);
          const next: unknown = Reflect.apply(value, target, args);
          return next === target ? query(call, steps, target) : isThenableQuery(next) ? query(call, steps, next) : next;
        };
      },
    });
  };
  const isThenableQuery = (v: unknown): boolean => isObject(v) && !(v instanceof Promise) && 'then' in v;

  /** Any other part of the client (auth, a channel): each call written when it is made. */
  const part = (name: string, target: Record<string, unknown>): unknown =>
    new Proxy(target, {
      get(t, key, receiver) {
        const value: unknown = Reflect.get(t, key, receiver);
        if (typeof key !== 'string') return value;
        const call = `${name}.${key}`;
        if (typeof value !== 'function') return isObject(value) && name === 'client' ? part(key, value) : value;
        return (...args: unknown[]): unknown => {
          if (name === 'client' && (key === 'from' || key === 'rpc')) {
            const steps: Step[] = [[key, args]];
            const result: unknown = Reflect.apply(value, t, args);
            if (isThenableQuery(result)) return query(`${key}.${String(args[0])}`, steps, result);
            write(`${key}.${String(args[0])}`, steps);
            return result;
          }
          write(call, [[key, args]]);
          const result: unknown = Reflect.apply(value, t, args);
          return isObject(result) && !(result instanceof Promise) ? part(call, result) : result;
        };
      },
    });
  // The proxy answers every property as the client does: it stands for the client.
  return part('client', client) as T;
}
