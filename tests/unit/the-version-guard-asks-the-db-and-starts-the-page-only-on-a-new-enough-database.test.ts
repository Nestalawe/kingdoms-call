// The database version guard (P0-34; src/db/kc-db-guard.ts), called directly with the fake Db (tests/lib/fake-db.ts):
// it asks the database its version through the Db (kc_db_version()), and
// - up to date: settles with the version, keeps it in <html data-kc-db>, and announces it ("kc-db-version");
// - older than the page's minimum, no kc_db_version, a version that isn't 14 digits, no answer twice, or a call that
//   throws twice: never settles (the page's init() never runs), raising "The game is being updated…" as an error event
//   that says why;
// - no answer once (or a throw once), then up to date: asks once more, and settles.
// Level 1 (unit): the guard is a function of its Db and the page's window; tests/db-guard.test.js boots each page on a
// stand-in client for the same cases (level 4), and this file adds the answers no page test gives (a version that isn't
// 14 digits, a call that throws), with the error event's exact words.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { kcDbGuard } from '../../src/db/kc-db-guard.ts';
import type { Db } from '../../src/db/the-db-interface-and-its-areas.ts';
import { makeAFakeDb, NO_ANSWER } from '../lib/fake-db.ts';

const MIN = '20261015062128';
const NEWER = '20261015233047';
const OLDER = '20261010000000';

/** The page's window and document as the guard reads them: the error events, the attribute and the announcements. */
interface ThePage {
  errors: string[];
  attributes: Record<string, string>;
  announced: unknown[];
}
let page: ThePage;

class ErrorEventStandIn extends Event {
  readonly message: string;
  constructor(type: string, init: { message: string }) {
    super(type);
    this.message = init.message;
  }
}

beforeEach(() => {
  page = { errors: [], attributes: {}, announced: [] };
  const window = new EventTarget();
  window.addEventListener('error', (e) => {
    if (e instanceof ErrorEventStandIn) page.errors.push(e.message);
  });
  vi.stubGlobal('window', window);
  vi.stubGlobal('ErrorEvent', ErrorEventStandIn);
  vi.stubGlobal('document', {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        page.attributes[name] = value;
      },
    },
    dispatchEvent: (e: Event) => {
      if (e instanceof CustomEvent) page.announced.push([e.type, e.detail]);
      return true;
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** What the guard did once every answer it was given has come: settled with a version, or still waiting. Each fake
 *  answer is a resolved promise, so a macrotask after the call comes after all of them. */
async function guard(db: Db): Promise<{ settled: string }> {
  const settled = await Promise.race([
    kcDbGuard(db, MIN),
    new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve('still waiting');
      }, 0);
    }),
  ]);
  return { settled };
}

const stopped = (why: string) => [
  `The game is being updated. Try again in a few minutes. (${why}; this page needs ${MIN})`,
];

describe('the version guard, on the fake Db', () => {
  test('up to date: it settles with the version, keeps it on the page and announces it, asking once', async () => {
    const fake = makeAFakeDb([NEWER]);
    expect(await guard(fake.db)).toEqual({ settled: NEWER });
    expect(fake.calls).toEqual(['rpc:kc_db_version']);
    expect(page).toEqual({ errors: [], attributes: { 'data-kc-db': NEWER }, announced: [['kc-db-version', NEWER]] });
  });

  test('the page minimum itself is new enough', async () => {
    expect(await guard(makeAFakeDb([MIN]).db)).toEqual({ settled: MIN });
  });

  test.for([
    ['older than the minimum', [OLDER], `database ${OLDER}`, 1],
    ['no kc_db_version (a database from before P0-34)', [null], 'no version check in the database', 1],
    ['a version that is not 14 digits', ['2026'], 'database unknown', 1],
    ['no answer twice', [NO_ANSWER], "the database didn't answer", 2],
  ] as const)('%s: it never settles, and says why', async ([, answers, why, asked]) => {
    const fake = makeAFakeDb(answers);
    expect(await guard(fake.db)).toEqual({ settled: 'still waiting' });
    expect(fake.calls.length).toBe(asked);
    expect(page).toEqual({ errors: stopped(why), attributes: {}, announced: [] });
  });

  test('no answer once, then up to date: it asks once more and settles', async () => {
    const fake = makeAFakeDb([NO_ANSWER, NEWER]);
    expect(await guard(fake.db)).toEqual({ settled: NEWER });
    expect(fake.calls).toEqual(['rpc:kc_db_version', 'rpc:kc_db_version']);
    expect(page.errors).toEqual([]);
  });

  /** A Db whose version call throws `thrown` the first `times` times, then answers `then`. */
  const throwing = (thrown: unknown, times: number): { db: Db; asked: () => number } => {
    let asked = 0;
    const answers = makeAFakeDb([NEWER]);
    return {
      db: {
        ...answers.db,
        theDatabasesVersion: {
          askTheDatabaseItsVersion: () => {
            asked++;
            if (asked <= times) throw thrown;
            return answers.db.theDatabasesVersion.askTheDatabaseItsVersion();
          },
        },
      },
      asked: () => asked,
    };
  };
  test.for([
    ['an Error', new Error('Failed to fetch')],
    ['a string', 'Failed to fetch'],
    ['an object with no message', { reason: 'down' }],
    ['undefined', undefined],
  ] as const)('a call that throws %s is no answer: twice, it stops; once, it asks again', async ([, thrown]) => {
    const twice = throwing(thrown, 2);
    expect(await guard(twice.db)).toEqual({ settled: 'still waiting' });
    expect(twice.asked()).toBe(2);
    expect(page.errors).toEqual(stopped("the database didn't answer"));
    page.errors = [];
    const once = throwing(thrown, 1);
    expect(await guard(once.db)).toEqual({ settled: NEWER });
    expect(once.asked()).toBe(2);
    expect(page.errors).toEqual([]);
  });
});
