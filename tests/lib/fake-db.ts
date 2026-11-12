// The fake database (plan P1-17, Decision 8): a small in-memory Db (src/db/the-db-interface-and-its-areas.ts), so the
// compiler keeps it in step with the real one. A page test hands it to the page before the page's scripts run
// (bootJsdom's opts.db, tests/lib/boot.js); a unit test calls code that takes a Db with it. It doesn't imitate the
// access rules: the access layer's tests prove those against the local database. Each of P1-17's area rows adds its
// area's functions here. Beyond the version, it holds no account: no session, a sign-in or sign-up refused, no names, no
// role and no offer; and no game, so no Hall of Fame entry, no statistics, no dispatch and no report (a new row refused,
// a change or deletion matching nothing). The Overlord's functions refuse, as the database refuses anyone but the
// Overlord.
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

/** An Overlord's function's refusal, in the database's words (an exception: HTTP 400). */
const refusedAsNotTheOverlord = (message: string): ADatabaseAnswer<never> => ({
  data: null,
  error: { message },
  status: 400,
});

/** No rows: the fake holds no game, so no entry, record or result. */
const none = (): ADatabaseAnswer<never[]> => ({ data: [], error: null, status: 200 });
/** A change or deletion that matched no row (the database answers no error). */
const nothingMatched = (): ADatabaseAnswer<null> => ({ data: null, error: null, status: 204 });
/** A new row the access rules refuse (no one signed in), in the database's words. */
const refusedByTheAccessRules = (table: string): ADatabaseAnswer<null> => ({
  data: null,
  error: { message: `new row violates row-level security policy for table "${table}"` },
  status: 401,
});

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
    theOverlordsAccounts: {
      everyAccountAsTheOverlordSeesIt: answering('rpc:overlord_accounts', () =>
        refusedAsNotTheOverlord('Only the Overlord can list the accounts.'),
      ),
      suspendThisAccountUntil: answering('rpc:account_suspend', () =>
        refusedAsNotTheOverlord('Only the Overlord can suspend an account.'),
      ),
      liftThisAccountsSuspension: answering('rpc:account_unsuspend', () =>
        refusedAsNotTheOverlord('Only the Overlord can lift a suspension.'),
      ),
      deleteThisAccount: answering('rpc:account_delete', () =>
        refusedAsNotTheOverlord('Only the Overlord can delete an account.'),
      ),
      offerThisAccountGameMaster: answering('rpc:gm_offer', () =>
        refusedAsNotTheOverlord('Only the Overlord can offer Game Master.'),
      ),
      withdrawTheGameMasterOfferToThisAccount: answering('rpc:gm_withdraw_offer', () =>
        refusedAsNotTheOverlord('Only the Overlord can withdraw an offer.'),
      ),
      revokeThisAccountsGameMaster: answering('rpc:gm_revoke', () =>
        refusedAsNotTheOverlord('Only the Overlord can revoke a Game Master.'),
      ),
    },
    theOverlordsGames: {
      everyGameNewestFirstFromRowToRow: answering('from:games', () => ({ data: [], error: null, status: 200 })),
      handThisGameToThisGameMaster: answering('rpc:reassign_game', () =>
        refusedAsNotTheOverlord('Only the Overlord can hand a game over.'),
      ),
      theRealmsNamesOfTheseGames: answering('from:game_players', () => ({ data: [], error: null, status: 200 })),
    },
    theHallOfFame: {
      oneEntrysGame: answering('from:game_records', none),
      everyEntryNewestFinishedFirstFromRowToRow: answering('from:game_records', none),
      theGameOfEveryEntry: answering('from:game_records', none),
      theGameMastersNotesOnThisGamesEntry: answering('from:game_records', () => ({
        data: null,
        error: null,
        status: 200,
      })),
      writeTheseEntries: answering('from:game_records', () => refusedByTheAccessRules('game_records')),
      changeThisGamesEntry: answering('from:game_records', nothingMatched),
      deleteThisGamesEntry: answering('from:game_records', nothingMatched),
      deleteTheseGamesEntries: answering('from:game_records', nothingMatched),
      renameThisPlayer: answering('rpc:rename_player', () =>
        refusedAsNotTheOverlord('Only the Overlord renames players.'),
      ),
    },
    theStatistics: {
      oneTurnRecordsId: answering('from:turn_events', none),
      oneGameResultsId: answering('from:game_results', none),
      theResultsOfThisGame: answering('from:game_results', none),
      thisGamesTurnRecordsForItsEntryFromRowToRow: answering('from:turn_events', none),
      theGameOfEveryResultFromRowToRow: answering('from:game_results', none),
      everyTurnRecordFromRowToRow: answering('from:turn_events', none),
      everyResultFromRowToRow: answering('from:game_results', none),
      deleteThisGamesResults: answering('from:game_results', nothingMatched),
      deleteThisGamesTurnRecords: answering('from:turn_events', nothingMatched),
      deleteTheseGamesResults: answering('from:game_results', nothingMatched),
      deleteTheseGamesTurnRecords: answering('from:turn_events', nothingMatched),
    },
    theHallOfFamesGames: {
      oneGameThisGameMasterRuns: answering('from:games', none),
      thisGameWithItsWorldAndRealms: answering('from:games', () => ({ data: null, error: null, status: 200 })),
      theFinishedGamesThisGameMasterRuns: answering('from:games', none),
      everyGamesNameStatusAndTurn: answering('from:games', none),
      theNameStatusAndTurnOfTheGamesThisGameMasterRuns: answering('from:games', none),
      whichOfTheseGamesStillExist: answering('from:games', none),
    },
    theDispatches: {
      oneDispatchsId: answering('from:game_messages', none),
      oneReadMarksGame: answering('from:game_message_reads', none),
      theNewestDispatchesOfThisGame: answering('from:game_messages', none),
      theDispatchesOfThisGameAfterThisOne: answering('from:game_messages', none),
      theDispatchesOfThisGameBeforeThisOne: answering('from:game_messages', none),
      theNewestDispatchesOfTheseGamesGamesAndRealms: answering('from:game_messages', none),
      sendThisDispatch: answering('from:game_messages', () => refusedByTheAccessRules('game_messages')),
      deleteThisDispatch: answering('from:game_messages', nothingMatched),
      thisRealmsReadMarksInThisGame: answering('from:game_message_reads', () => ({
        data: null,
        error: null,
        status: 200,
      })),
      thisAccountsReadMarksInTheseGames: answering('from:game_message_reads', none),
      writeTheseReadMarks: answering('from:game_message_reads', () => refusedByTheAccessRules('game_message_reads')),
    },
    theReportedDispatches: {
      theDispatchesThisAccountReportedInThisGame: answering('from:message_reports', none),
      reportThisDispatch: answering('from:message_reports', () => refusedByTheAccessRules('message_reports')),
      theDispatchesReportedToThisAccount: answering('rpc:gm_reported_messages', none),
    },
  };
  return { db, calls };
}
