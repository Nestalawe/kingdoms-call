// The database access layer's one interface, Db (plan P1-17, Decision 4): one object of areas, each a few functions,
// made from the page's client by makeTheDbFromItsClient. A page calls the database only through Db (its calls still on
// `sb` move here area by area, P1-17's area rows); the tests hand a page their fake of it (tests/lib/fake-db.ts,
// through the-pages-database-client.ts). A Db function sends the query the page sent before, and answers as
// supabase-js does ({ data, error } and the status), so a page's error paths stay as they are. The client and the
// tables are typed by the generated types (database.types.ts: npx supabase gen types typescript --local, then
// Prettier; never edited by hand), so a misspelt table, column or function is a compiler error.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

/** The page's database client (supabase-js), typed by the generated types. */
export type TheDatabaseClient = SupabaseClient<Database>;

/** What a Db function answers, as supabase-js answers it: the data, or the error, and the HTTP status (0: no answer at
 *  all, as the version guard writes a call that threw). */
export interface ADatabaseAnswer<T> {
  readonly data: T | null;
  readonly error: { readonly message: string } | null;
  readonly status: number;
}

/** The database, as the pages reach it: one area a row of P1-17. */
export interface Db {
  /** The version guard's (src/db/kc-db-guard.ts, P0-34). */
  readonly theDatabasesVersion: {
    /** kc_db_version(): the newest migration the database has applied, its 14-digit version. */
    readonly askTheDatabaseItsVersion: () => PromiseLike<ADatabaseAnswer<string>>;
  };
}

/** The page's Db, on its own client: each function sends the query the page sent on that client before. */
export function makeTheDbFromItsClient(client: TheDatabaseClient): Db {
  return {
    theDatabasesVersion: {
      askTheDatabaseItsVersion: () => client.rpc('kc_db_version'),
    },
  };
}
