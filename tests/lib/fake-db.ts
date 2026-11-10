// The fake database (plan P1-17, Decision 8): a small in-memory Db (src/db/the-db-interface-and-its-areas.ts), so the
// compiler keeps it in step with the real one. A page test hands it to the page before the page's scripts run
// (bootJsdom's opts.db, tests/lib/boot.js); a unit test calls code that takes a Db with it. It doesn't imitate the
// access rules: the access layer's tests prove those against the local database. Each of P1-17's area rows adds its
// area's functions here. Beyond the version, it holds no account: no session, a sign-in or sign-up refused, no names, no
// role and no offer.
import type { ADatabaseAnswer, Db } from '../../src/db/the-db-interface-and-its-areas.ts';

/** No answer at all (the network), as an answer the fake gives. */
export const NO_ANSWER = Symbol('no answer');

/** What the fake answers kc_db_version() with: a version (an up-to-date database answers the newest migration's),
 *  null (no such function: a database from before P0-34) or NO_ANSWER. */
export type TheFakeVersionAnswer = string | null | typeof NO_ANSWER;

/** What the fake holds, and the calls it was sent, by name (`rpc:kc_db_version`), in order. */
export interface AFakeDb {
  readonly db: Db;
  readonly calls: string[];
}

/** The answer a database gives, as supabase-js hands it on (the shapes tests/lib/boot.js's withDbVersion answers). */
function versionAnswer(answer: TheFakeVersionAnswer): ADatabaseAnswer<string> {
  if (answer === NO_ANSWER) return { data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 };
  if (answer === null)
    return {
      data: null,
      error: { message: 'Could not find the function public.kc_db_version without parameters in the schema cache' },
      status: 404,
    };
  return { data: answer, error: null, status: 200 };
}

/** What the fake's sign-in answers when it is refused, as the sign-in service words it. */
const NO_SUCH_ACCOUNT = { message: 'Invalid login credentials' };
/** What a change to the signed-in account answers with no one signed in. */
const NO_SESSION = { message: 'Auth session missing!' };

/** A fake database answering kc_db_version() with `versions` in order, the last one again from then on. */
export function makeAFakeDb(versions: readonly [TheFakeVersionAnswer, ...TheFakeVersionAnswer[]]): AFakeDb {
  const left = versions.slice();
  const calls: string[] = [];
  /** Notes the call `name`, and answers `answer`. */
  const answering =
    <A extends unknown[], T>(name: string, answer: (...args: A) => T) =>
    (...args: A): Promise<T> => {
      calls.push(name);
      return Promise.resolve(answer(...args));
    };
  const db: Db = {
    theDatabasesVersion: {
      askTheDatabaseItsVersion: () => {
        calls.push('rpc:kc_db_version');
        const answer = left.length > 1 ? left.shift() : left[0];
        return Promise.resolve(versionAnswer(answer ?? null));
      },
    },
    signingIn: {
      theSessionKeptInThisBrowser: answering('auth:getSession', () => ({ data: { session: null }, error: null })),
      signInWithEmailAndPassword: answering('auth:signInWithPassword', () => ({
        data: { user: null, session: null },
        error: NO_SUCH_ACCOUNT,
      })),
      signUpWithEmailPasswordAndName: answering('auth:signUp', () => ({
        data: { user: null, session: null },
        error: { message: 'Signups not allowed for this instance' },
      })),
      signOut: answering('auth:signOut', () => ({ error: null })),
      changeThePassword: answering('auth:updateUser', () => ({ data: { user: null }, error: NO_SESSION })),
      changeTheNameKeptWithTheSignIn: answering('auth:updateUser', () => ({ data: { user: null }, error: NO_SESSION })),
    },
    theAccountsNames: {
      theNamesOfTheseAccounts: answering('from:profiles', () => ({ data: [], error: null, status: 200 })),
      theNameOfEveryAccount: answering('from:profiles', () => ({ data: [], error: null, status: 200 })),
      theNameAndJoiningDateOfEveryAccountInNameOrder: answering('from:profiles', () => ({
        data: [],
        error: null,
        status: 200,
      })),
      theNameOfThisAccount: answering('from:profiles', () => ({
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned' },
        status: 406,
      })),
      giveThisAccountItsName: answering('from:profiles', () => ({
        data: null,
        error: { message: 'new row violates row-level security policy for table "profiles"' },
        status: 401,
      })),
    },
    theRoles: {
      isTheSignedInAccountAGameMaster: answering('rpc:is_game_master', () => ({
        data: false,
        error: null,
        status: 200,
      })),
      isTheSignedInAccountTheOverlord: answering('rpc:is_site_admin', () => ({
        data: false,
        error: null,
        status: 200,
      })),
      theGameMasterOfferMadeToThisAccount: answering('from:game_masters', () => ({
        data: null,
        error: null,
        status: 200,
      })),
      answerTheGameMasterOffer: (answer) =>
        answering(`rpc:${answer}`, () => ({
          data: null,
          error: {
            message: answer === 'gm_accept_offer' ? 'You have no offer to accept.' : 'You have no offer to decline.',
          },
          status: 400,
        }))(),
    },
  };
  return { db, calls };
}
