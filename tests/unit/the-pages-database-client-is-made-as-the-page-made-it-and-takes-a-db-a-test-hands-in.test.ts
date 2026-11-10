// Each page's database client and its Db (plan P1-17, Decisions 3 and 8; src/db/the-pages-database-client.ts):
// - the client is made from the `supabase` global with the page's own arguments, exactly (no options argument when the
//   page has none; the Overlord page's options, the same object);
// - the page's Db, made on that client, sends the query the page sent before: rpc('kc_db_version'), and hands back its
//   answer unchanged;
// - a Db a test sets on the page's window under its name before the page's scripts run is the page's Db instead (the
//   client is still made: every call not yet on Db is on it); a value without the version guard's area isn't taken.
// Level 1 (unit): the function reads only its arguments and two globals, stood in here.
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  makeThePagesDatabase,
  THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER,
} from '../../src/db/the-pages-database-client.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const URL = 'http://database.test';
const KEY = 'a-test-key';

/** A stand-in `supabase` global: what each createClient call was given, and what each client's rpc was sent. */
function standInSupabase(): { made: unknown[][]; sent: unknown[][]; answer: object } {
  const made: unknown[][] = [];
  const sent: unknown[][] = [];
  const answer = { data: '20261015233047', error: null, status: 200 };
  vi.stubGlobal('supabase', {
    createClient: (...args: unknown[]) => {
      made.push(args);
      return {
        rpc: (...rpcArgs: unknown[]) => {
          sent.push(rpcArgs);
          return answer;
        },
      };
    },
  });
  return { made, sent, answer };
}

describe("the page's database client", () => {
  test('a page with no options: createClient gets its address and key, and nothing else', () => {
    const supabase = standInSupabase();
    makeThePagesDatabase(URL, KEY);
    expect(supabase.made).toEqual([[URL, KEY]]);
    expect(supabase.made[0]?.length).toBe(2);
  });

  test("the Overlord page's options: createClient gets the same object", () => {
    const supabase = standInSupabase();
    const options = { auth: { storageKey: 'kc-overlord-auth' } };
    makeThePagesDatabase(URL, KEY, options);
    expect(supabase.made).toEqual([[URL, KEY, options]]);
    expect(supabase.made[0]?.[2]).toBe(options);
  });

  test("the page's Db asks the client rpc('kc_db_version') and hands back its answer", async () => {
    const supabase = standInSupabase();
    const { db } = makeThePagesDatabase(URL, KEY);
    expect(supabase.sent).toEqual([]);
    const answer = await db.theDatabasesVersion.askTheDatabaseItsVersion();
    expect(supabase.sent).toEqual([['kc_db_version']]);
    expect(answer).toBe(supabase.answer);
  });

  test("a Db a test hands in is the page's Db, and the client is still made", async () => {
    const supabase = standInSupabase();
    const fake = makeAFakeDb(['20261015233047']);
    vi.stubGlobal(THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER, fake.db);
    const made = makeThePagesDatabase(URL, KEY);
    expect(made.db).toBe(fake.db);
    expect(supabase.made).toEqual([[URL, KEY]]);
    await made.db.theDatabasesVersion.askTheDatabaseItsVersion();
    expect(fake.calls).toEqual(['rpc:kc_db_version']);
    expect(supabase.sent).toEqual([]);
  });

  test.for([
    ['an empty object', {}],
    ['a string', 'a Db'],
    ['null', null],
  ] as const)('a value handed in that is no Db (%s) is not taken', async ([, handed]) => {
    const supabase = standInSupabase();
    vi.stubGlobal(THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER, handed);
    const { db } = makeThePagesDatabase(URL, KEY);
    await db.theDatabasesVersion.askTheDatabaseItsVersion();
    expect(supabase.sent).toEqual([['kc_db_version']]);
  });
});
