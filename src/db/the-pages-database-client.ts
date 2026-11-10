// Each page's database client and its Db (plan P1-17, Decision 3): the four pages' createClient calls are this one
// function, each page's arguments kept (the Overlord page's own storageKey among them). Only src/db/ reads `supabase`,
// the client's global (supabase-js's browser build, assets/supabase-js-<hash>.js: tools/build.ts), and ESLint refuses
// it anywhere else (eslint.config.js); dependency-cruiser refuses an import of the package outside src/db/, which
// imports only its types.
//
// The way in for the tests (plan P1-17, Decision 8): a test that sets a Db on the page's window under
// THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER before the page's scripts run (jsdom's beforeParse: tests/lib/boot.js's
// opts.db) gets that Db as the page's own, its fake (tests/lib/fake-db.ts) in place of the database. It is the trust the
// page already gives the `supabase` global, which the tests replace. Only src/db/ reads it
// (tests/static/only-src-db-reads-the-db-a-test-hands-the-page.test.ts). The client is still made from the global:
// every call not yet on Db is on it.
import type { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import { makeTheDbFromItsClient, type Db, type TheDatabaseClient } from './the-db-interface-and-its-areas.ts';

declare global {
  /** The `supabase` global's type (src/globals.d.ts declares the global): supabase-js's createClient, typed by the
   *  generated database types. Declared here so that only src/db/ names the package and the types. */
  interface TheSupabaseGlobal {
    readonly createClient: typeof createClient<Database>;
  }
}

/** The name, on the page's window, of the Db a test hands the page. */
export const THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER = 'kcTheDbATestHandsThePage';

/** A page's client and its Db. */
export interface ThePagesDatabase {
  readonly client: TheDatabaseClient;
  readonly db: Db;
}

/** A value a test handed in, taken as a Db when it has the version guard's area (the first area: every page has it). */
function isADbHandedIn(handed: unknown): handed is Db {
  return typeof handed === 'object' && handed !== null && 'theDatabasesVersion' in handed;
}

/** The page's client, made as the page made it (with its options only when it has some), and its Db: the one a test
 *  handed in, else the one on this client. */
export function makeThePagesDatabase(
  url: string,
  key: string,
  options?: SupabaseClientOptions<'public'>,
): ThePagesDatabase {
  const client = options === undefined ? supabase.createClient(url, key) : supabase.createClient(url, key, options);
  const handed: unknown = Reflect.get(globalThis, THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER);
  return { client, db: isADbHandedIn(handed) ? handed : makeTheDbFromItsClient(client) };
}
