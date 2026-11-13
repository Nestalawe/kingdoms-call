// The fake database (plan P1-17, Decision 8): a small in-memory Db (src/db/the-db-interface-and-its-areas.ts), so the
// compiler keeps it in step with the real one. A page test hands it to the page before the page's scripts run
// (bootJsdom's opts.db, tests/lib/boot.js); a unit test calls code that takes a Db with it. It doesn't imitate the
// access rules: the access layer's tests prove those against the local database. Each of P1-17's area rows adds its
// area's functions here. Beyond the version, it holds no account: no session, a sign-in or sign-up refused, no names, no
// role and no offer; and no game, so no realm, no slot, no turn's log, no Hall of Fame entry, no statistics, no dispatch
// and no report (a new row refused, a change or deletion matching nothing, a single row's read finding none). The
// Overlord's functions refuse, as the database refuses anyone but the Overlord. Three fakes below hold a world a test
// stages and reads back: the Overlord's page's and the Hall of Fame's (plan P1-17i), and the player's (P1-17l).
import type {
  ADatabaseAnswer,
  AGame,
  AGameAsTheOverlordListsIt,
  AHallOfFameEntry,
  AnAccountsName,
  ADispatch,
  ADispatchsGameAndRealms,
  ARealm,
  ARealmsName,
  ARealmsReadMarks,
  ARealmsSlot,
  Db,
} from '../../src/db/the-db-interface-and-its-areas.ts';

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
/** One row asked for, and none there (the local database's words for a single row's read that matched none). */
const noSuchRow = (): ADatabaseAnswer<never> => ({
  data: null,
  error: { message: 'Cannot coerce the result to a single JSON object' },
  status: 406,
});
/** At most one row asked for (maybeSingle), and none there: no row and no error. */
const noneMatchedOfOne = (): ADatabaseAnswer<null> => ({ data: null, error: null, status: 200 });
/** A new row the access rules refuse (no one signed in), in the database's words. */
const refusedByTheAccessRules = (table: string): ADatabaseAnswer<never> => ({
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
      writeTheseResults: answering('from:game_results', () => refusedByTheAccessRules('game_results')),
      writeTheseTurnRecords: answering('from:turn_events', () => refusedByTheAccessRules('turn_events')),
      theGamesOfTheseGamesResults: answering('from:game_results', none),
    },
    theHallOfFamesGames: {
      oneGameThisGameMasterRuns: answering('from:games', none),
      thisGameWithItsWorldAndRealms: answering('from:games', () => ({ data: null, error: null, status: 200 })),
      theFinishedGamesThisGameMasterRuns: answering('from:games', none),
      everyGamesNameStatusAndTurn: answering('from:games', none),
      theNameStatusAndTurnOfTheGamesThisGameMasterRuns: answering('from:games', none),
      whichOfTheseGamesStillExist: answering('from:games', none),
      theIdNameAndStateOfTheFinishedGamesThisGameMasterRuns: answering('from:games', none),
      thisGamesIdNameAndWorldWithEveryColumnOfItsRealms: answering('from:games', noSuchRow),
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
    thePlayersRealms: {
      thisAccountsRealmsAndTheirOrdersFlags: answering('from:game_players', none),
      everyRealmOfThisAccount: answering('from:game_players', none),
      theGamesOfThisAccountsRealms: answering('from:game_players', none),
      thisAccountsRealmsInThisGame: answering('from:game_players', none),
      thisRealm: answering('from:game_players', noSuchRow),
      joinWithThisRealm: answering('from:game_players', () => refusedByTheAccessRules('game_players')),
      theSlotsOfTheseGames: answering('rpc:get_game_slots', none),
    },
    thePlayersGames: {
      theTurnAndStateOfTheseGames: answering('from:games', none),
      theseGamesForTheirCards: answering('from:games', none),
      theseGamesEveryColumn: answering('from:games', none),
      theGamesInSetup: answering('from:games', none),
      thisGamesWorldAndState: answering('from:games', noSuchRow),
      thisGameForItsReport: answering('from:games', noSuchRow),
      thisGameEveryColumn: answering('from:games', noSuchRow),
    },
    theChroniclesLogs: {
      theLogOfThisRealmInThisTurn: answering('from:turn_logs', none),
    },
    theOrders: {
      saveThisRealmsDraft: answering('from:game_players', nothingMatched),
      saveThisRealmsHeroOrder: answering('from:game_players', nothingMatched),
      reopenThisRealmsOrders: answering('from:game_players', nothingMatched),
      submitThisRealmsOrders: answering('from:game_players', nothingMatched),
      theTurnOfThisGame: answering('from:games', noSuchRow),
    },
    theGameMastersGames: {
      oneGamesMeta: answering('from:games', none),
      theGamesThisGameMasterRunsNewestFirst: answering('from:games', none),
      theGamesThisGameMasterRunsNewestFirstEveryColumn: answering('from:games', none),
      everyGameNewestFirstFromRowToRow: answering('from:games', none),
      everyGameNewestFirstFromRowToRowEveryColumn: answering('from:games', none),
      theActiveGamesThisGameMasterRuns: answering('from:games', none),
      theActiveGamesThisGameMasterRunsEveryColumn: answering('from:games', none),
      thisGameWithItsRealms: answering('from:games', noSuchRow),
      makeThisGame: answering('from:games', () => refusedByTheAccessRules('games')),
      thisGamesTurnAndWorld: answering('from:games', noSuchRow),
      theGamesThisGameMasterRunsWithNoMeta: answering('from:games', none),
      changeThisGame: answering('from:games', nothingMatched),
      changeThisGameAndAnswerItsId: answering('from:games', noneMatchedOfOne),
      changeThisGameWhileOnThisTurnAndAnswerItsId: answering('from:games', noneMatchedOfOne),
      keepTheRealmsThatAreOutOfThisGameFromSendingDispatches: answering('from:games', noneMatchedOfOne),
    },
    theGameMastersRealms: {
      removeThisRealm: answering('from:game_players', nothingMatched),
    },
    theGameMastersTurnLogs: {
      theWholeLogOfThisGameInThisTurn: answering('from:turn_logs', none),
    },
    theDeletionOfAGame: {
      removeThisGamesTurnLogs: answering('from:turn_logs', nothingMatched),
      removeThisGamesDispatches: answering('from:game_messages', nothingMatched),
      removeThisGamesReadMarks: answering('from:game_message_reads', nothingMatched),
      removeThisGamesTurnEvents: answering('from:turn_events', nothingMatched),
      removeThisGamesResults: answering('from:game_results', nothingMatched),
      removeThisGamesHallOfFameEntry: answering('from:game_records', nothingMatched),
      removeThisGamesRealms: answering('from:game_players', nothingMatched),
      removeThisGame: answering('from:games', nothingMatched),
    },
    theTurnAsTheGameMasterRunsIt: {
      thisGameEveryColumn: answering('from:games', noSuchRow),
      everyRealmOfThisGame: answering('from:game_players', none),
      clearTheOrdersOfEveryRealmOfThisGame: answering('from:game_players', nothingMatched),
      saveThisGameWhileOnThisTurnAndAnswerItsId: answering('from:games', noneMatchedOfOne),
      giveThisRealmItsTurnReport: answering('from:game_players', nothingMatched),
      writeThisLog: answering('from:turn_logs', () => refusedByTheAccessRules('turn_logs')),
      theTurnOfThisGameIfItIsThere: answering('from:games', noneMatchedOfOne),
      putBackThisRealmsOrders: answering('from:game_players', nothingMatched),
    },
    theTurnZeroAsTheGameMasterRunsIt: {
      everyRealmOfThisGame: answering('from:game_players', none),
      removeEveryBotsRealmOfThisGame: answering('from:game_players', nothingMatched),
      makeThisBotsRealm: answering('from:game_players', () => refusedByTheAccessRules('game_players')),
      startThisGame: answering('from:games', nothingMatched),
      giveThisRealmItsFirstReport: answering('from:game_players', nothingMatched),
      writeThisLog: answering('from:turn_logs', () => refusedByTheAccessRules('turn_logs')),
      thisGameWithItsRealms: answering('from:games', noSuchRow),
    },
  };
  return { db, calls };
}

/** A made-up account the fake holds: its name (null once it has none), and what the Overlord's list shows of it. */
export interface AFakeAccount {
  readonly id: string;
  name: string | null;
  email?: string;
  joined?: string;
  last_sign_in?: string;
  banned_until?: string | null;
}
/** A Game Master offer the fake holds (accepted, or still open). */
export interface AFakeGameMasterOffer {
  readonly user_id: string;
  readonly offered_at: string;
  readonly offered_by: string | null;
  accepted_at: string | null;
}
/** A made-up game the fake holds (what the Overlord's list reads of it). */
export interface AFakeGame extends Omit<AGameAsTheOverlordListsIt, 'gm_user_id'> {
  gm_user_id: string | null;
}
/** A made-up realm the fake holds, and the account playing it (null once that account is deleted). */
export interface AFakeRealm extends ARealmsName {
  readonly id: string;
  user_id: string | null;
}
/** A made-up dispatch the fake holds. */
export interface AFakeDispatch {
  readonly id: number;
  readonly game_id: string;
  readonly turn: number;
  readonly from_index: number;
  readonly to_indexes: number[];
  readonly scope: string;
  readonly body: string;
  readonly created_at?: string;
}
/** A made-up report of a dispatch the fake holds. */
export interface AFakeReport {
  readonly id: number;
  readonly message_id: number;
  readonly game_id: string;
  readonly reporter_index: number;
  readonly reason: string;
  readonly created_at: string;
}
/** What the Overlord's page reads and changes, held by the fake: the signed-in account, every account, the Overlord,
 *  the Game Master offers, the games, their realms, the dispatches and their reports. A test stages it, then reads what
 *  the page changed in it. `failingChecks` names the role checks that get no answer (`is_site_admin`). */
export interface TheOverlordsWorld {
  signedIn: string | null;
  accounts: AFakeAccount[];
  readonly overlord: string;
  offers: AFakeGameMasterOffer[];
  readonly games: AFakeGame[];
  readonly realms: AFakeRealm[];
  dispatches: AFakeDispatch[];
  readonly reports: AFakeReport[];
  readonly failingChecks: Set<string>;
}

/** The answer of one of the Overlord's functions: none, or its refusal (an exception: HTTP 400) in the database's words. */
const doneOrRefused = (refusal: string | null): ADatabaseAnswer<null> =>
  refusal === null ? { data: null, error: null, status: 200 } : refusedAsNotTheOverlord(refusal);

/** A fake database, up to date at `version`, holding `world`, the Overlord's functions on it as
 *  supabase/schemas/public/functions/ define them for the signed-in account (the same refusals, in their words). */
export function makeAFakeDbHoldingTheOverlordsWorld(version: string, world: TheOverlordsWorld): AFakeDb {
  const fake = makeAFakeDb([version]);
  const { calls } = fake;
  const answering =
    <A extends unknown[], T>(name: string, answer: (...args: A) => T) =>
    (...args: A): Promise<T> => {
      calls.push(name);
      return Promise.resolve(answer(...args));
    };
  const isTheOverlord = (): boolean => world.signedIn === world.overlord;
  const accountOf = (id: string): AFakeAccount | undefined => world.accounts.find((a) => a.id === id);
  const offerTo = (id: string): AFakeGameMasterOffer | undefined => world.offers.find((r) => r.user_id === id);
  const unfinished = (game: AFakeGame | undefined): boolean => game !== undefined && game.status !== 'complete';
  const gameOf = (id: string): AFakeGame | undefined => world.games.find((g) => g.id === id);
  /** Runs `change` as the Overlord: refused with `refusal` for anyone else, else with what `change` refuses. */
  const asTheOverlord =
    <A extends unknown[]>(refusal: string, change: (...args: A) => string | null) =>
    (...args: A): ADatabaseAnswer<null> =>
      doneOrRefused(isTheOverlord() ? change(...args) : refusal);
  const notTheOverlordsOwn = (user: string): string | null =>
    user === world.overlord ? "This doesn't work on the Overlord's own account." : null;
  const db: Db = {
    ...fake.db,
    signingIn: {
      ...fake.db.signingIn,
      theSessionKeptInThisBrowser: answering('auth:getSession', () => ({
        data: { session: world.signedIn === null ? null : { user: { id: world.signedIn, user_metadata: {} } } },
        error: null,
      })),
    },
    theRoles: {
      ...fake.db.theRoles,
      isTheSignedInAccountTheOverlord: answering('rpc:is_site_admin', () =>
        world.failingChecks.has('is_site_admin')
          ? { data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 }
          : { data: isTheOverlord(), error: null, status: 200 },
      ),
    },
    theOverlordsAccounts: {
      everyAccountAsTheOverlordSeesIt: answering('rpc:overlord_accounts', () => {
        if (!isTheOverlord()) return refusedAsNotTheOverlord('Only the Overlord can list the accounts.');
        const data = world.accounts.map((a) => {
          const offer = offerTo(a.id);
          const bannedUntil = a.banned_until ?? null;
          return {
            user_id: a.id,
            name: a.name,
            email: a.email ?? null,
            joined: a.joined ?? '',
            last_sign_in: a.last_sign_in ?? null,
            gm_status: offer === undefined ? 'none' : offer.accepted_at === null ? 'offered' : 'game_master',
            games_run: world.games.filter((g) => g.gm_user_id === a.id).length,
            games_played: new Set(world.realms.filter((s) => s.user_id === a.id).map((s) => s.game_id)).size,
            suspended_until: bannedUntil !== null && new Date(bannedUntil) > new Date() ? bannedUntil : null,
          };
        });
        return { data, error: null, status: 200 };
      }),
      suspendThisAccountUntil: answering(
        'rpc:account_suspend',
        asTheOverlord('Only the Overlord can suspend an account.', (user: string, until: string | null) => {
          const account = accountOf(user);
          const own = notTheOverlordsOwn(user);
          if (own !== null) return own;
          if (account === undefined) return 'No such account.';
          if (until !== null && new Date(until) <= new Date()) return 'A suspension must end in the future.';
          account.banned_until = until ?? new Date(Date.now() + 100 * 365.25 * 864e5).toISOString();
          return null;
        }),
      ),
      liftThisAccountsSuspension: answering(
        'rpc:account_unsuspend',
        asTheOverlord('Only the Overlord can lift a suspension.', (user: string) => {
          const account = accountOf(user);
          const own = notTheOverlordsOwn(user);
          if (own !== null) return own;
          if (account === undefined) return 'No such account.';
          account.banned_until = null;
          return null;
        }),
      ),
      deleteThisAccount: answering(
        'rpc:account_delete',
        asTheOverlord('Only the Overlord can delete an account.', (user: string) => {
          const own = notTheOverlordsOwn(user);
          if (own !== null) return own;
          if (accountOf(user) === undefined) return 'No such account.';
          if (world.games.some((g) => g.gm_user_id === user && unfinished(g)))
            return 'That account runs an unfinished game: hand it over first.';
          if (world.realms.some((s) => s.user_id === user && unfinished(gameOf(s.game_id))))
            return 'That account plays in an unfinished game: suspend it instead until the game ends.';
          world.accounts = world.accounts.filter((a) => a.id !== user);
          world.offers = world.offers.filter((r) => r.user_id !== user);
          for (const g of world.games) if (g.gm_user_id === user) g.gm_user_id = null;
          for (const s of world.realms) if (s.user_id === user) s.user_id = null;
          return null;
        }),
      ),
      offerThisAccountGameMaster: answering(
        'rpc:gm_offer',
        asTheOverlord('Only the Overlord can offer Game Master.', (user: string) => {
          if (user === world.overlord) return "The Overlord can't be a Game Master.";
          if (accountOf(user) === undefined) return 'No such account.';
          const offer = offerTo(user);
          if (offer !== undefined && offer.accepted_at !== null) return 'That account is already a Game Master.';
          if (offer === undefined)
            world.offers.push({
              user_id: user,
              offered_at: new Date().toISOString(),
              offered_by: world.signedIn,
              accepted_at: null,
            });
          return null;
        }),
      ),
      withdrawTheGameMasterOfferToThisAccount: answering(
        'rpc:gm_withdraw_offer',
        asTheOverlord('Only the Overlord can withdraw an offer.', (user: string) => {
          const offer = offerTo(user);
          if (offer === undefined) return 'That account has no offer to withdraw.';
          if (offer.accepted_at !== null) return 'That offer has been accepted: revoke the Game Master instead.';
          world.offers = world.offers.filter((r) => r !== offer);
          return null;
        }),
      ),
      revokeThisAccountsGameMaster: answering(
        'rpc:gm_revoke',
        asTheOverlord('Only the Overlord can revoke a Game Master.', (user: string) => {
          const offer = offerTo(user);
          if (offer === undefined || offer.accepted_at === null) return "That account isn't a Game Master.";
          if (world.games.some((g) => g.gm_user_id === user && unfinished(g)))
            return 'That Game Master runs an unfinished game: hand it over first.';
          world.offers = world.offers.filter((r) => r !== offer);
          return null;
        }),
      ),
    },
    theOverlordsGames: {
      everyGameNewestFirstFromRowToRow: answering('from:games', (from: number, to: number) => ({
        data: world.games
          .slice()
          .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
          .slice(from, to + 1),
        error: null,
        status: 200,
      })),
      handThisGameToThisGameMaster: answering(
        'rpc:reassign_game',
        asTheOverlord('Only the Overlord can hand a game over.', (game: string, gameMaster: string) => {
          if (gameMaster === world.overlord) return "The Overlord doesn't run games.";
          const offer = offerTo(gameMaster);
          if (offer === undefined || offer.accepted_at === null) return "That account isn't a Game Master.";
          const g = gameOf(game);
          if (g === undefined) return 'No such game.';
          g.gm_user_id = gameMaster;
          return null;
        }),
      ),
      theRealmsNamesOfTheseGames: answering('from:game_players', (games: readonly string[]) => ({
        data: world.realms
          .filter((s) => games.includes(s.game_id))
          .map((s) => ({ game_id: s.game_id, player_index: s.player_index, display_name: s.display_name })),
        error: null,
        status: 200,
      })),
    },
    theDispatches: {
      ...fake.db.theDispatches,
      deleteThisDispatch: answering('from:game_messages', (id: number) => {
        world.dispatches = world.dispatches.filter((m) => m.id !== id);
        return { data: null, error: null, status: 204 };
      }),
    },
    theReportedDispatches: {
      ...fake.db.theReportedDispatches,
      theDispatchesReportedToThisAccount: answering('rpc:gm_reported_messages', (game: string | null) => ({
        data: world.reports.flatMap((r) => {
          const m = world.dispatches.find((d) => d.id === r.message_id);
          if (m === undefined || (game !== null && m.game_id !== game) || !isTheOverlord()) return [];
          return [
            {
              report_id: r.id,
              message_id: m.id,
              game_id: m.game_id,
              turn: m.turn,
              from_index: m.from_index,
              to_indexes: m.to_indexes,
              scope: m.scope,
              body: m.body,
              sent_at: m.created_at ?? '',
              reporter_index: r.reporter_index,
              reason: r.reason,
              reported_at: r.created_at,
            },
          ];
        }),
        error: null,
        status: 200,
      })),
    },
  };
  return { db, calls };
}

/** A change the Hall of Fame's page sent (a table's `update` or `delete`, with its change), or a function it called
 *  (`rpc`, with its arguments as the database takes them): what a test reads back. */
export interface AChangeTheHallOfFameSent {
  readonly table?: string;
  readonly op?: 'update' | 'delete';
  readonly payload?: unknown;
  readonly rpc?: string;
  readonly args?: Readonly<Record<string, unknown>>;
}
/** What the Hall of Fame's page reads, held by the fake: its entries (`rows`, read again at each call), who is signed in
 *  (`me`, when `signedIn`), whether they run a game (`isGm`) or are the Overlord (`isOverlord`), and the accounts' names.
 *  The changes it sends are noted in `changes`, and change nothing. */
export interface TheHallOfFamesWorld {
  readonly rows: () => readonly AHallOfFameEntry[];
  readonly changes: AChangeTheHallOfFameSent[];
  readonly signedIn: boolean;
  readonly me?: string;
  readonly isGm?: boolean;
  readonly isOverlord?: boolean;
  readonly names?: readonly AnAccountsName[];
}

/** A fake database, up to date at `version`, holding the Hall of Fame's `world`. */
export function makeAFakeDbHoldingTheHallOfFame(version: string, world: TheHallOfFamesWorld): AFakeDb {
  const fake = makeAFakeDb([version]);
  const { calls } = fake;
  const me = world.me ?? 'gm-1';
  const answering =
    <A extends unknown[], T>(name: string, answer: (...args: A) => T) =>
    (...args: A): Promise<T> => {
      calls.push(name);
      return Promise.resolve(answer(...args));
    };
  /** Notes `change` and answers as the database does (no error, no row). */
  const noted = (change: AChangeTheHallOfFameSent): ADatabaseAnswer<null> => {
    world.changes.push(change);
    return { data: null, error: null, status: 204 };
  };
  const db: Db = {
    ...fake.db,
    signingIn: {
      ...fake.db.signingIn,
      theSessionKeptInThisBrowser: answering('auth:getSession', () => ({
        data: { session: world.signedIn ? { user: { id: me, user_metadata: {} } } : null },
        error: null,
      })),
    },
    theRoles: {
      ...fake.db.theRoles,
      isTheSignedInAccountTheOverlord: answering('rpc:is_site_admin', () => {
        world.changes.push({ rpc: 'is_site_admin' });
        return { data: world.signedIn && world.isOverlord === true, error: null, status: 200 };
      }),
    },
    theAccountsNames: {
      ...fake.db.theAccountsNames,
      theNameOfEveryAccount: answering('from:profiles', () => ({
        data: (world.names ?? []).slice(),
        error: null,
        status: 200,
      })),
    },
    theHallOfFamesGames: {
      ...fake.db.theHallOfFamesGames,
      oneGameThisGameMasterRuns: answering('from:games', () => ({
        data: world.isGm === true ? [{ id: 'g0' }] : [],
        error: null,
        status: 200,
      })),
    },
    theHallOfFame: {
      ...fake.db.theHallOfFame,
      everyEntryNewestFinishedFirstFromRowToRow: answering('from:game_records', (from: number) => ({
        data: from > 0 ? [] : world.rows().slice(),
        error: null,
        status: 200,
      })),
      changeThisGamesEntry: answering('from:game_records', (_game: string, change: unknown) =>
        noted({ table: 'game_records', op: 'update', payload: change }),
      ),
      deleteThisGamesEntry: answering('from:game_records', () => noted({ table: 'game_records', op: 'delete' })),
      renameThisPlayer: answering('rpc:rename_player', (user: string, name: string) =>
        noted({ rpc: 'rename_player', args: { p_user: user, p_name: name } }),
      ),
    },
    theStatistics: {
      ...fake.db.theStatistics,
      deleteThisGamesResults: answering('from:game_results', () => noted({ table: 'game_results', op: 'delete' })),
      deleteThisGamesTurnRecords: answering('from:turn_events', () => noted({ table: 'turn_events', op: 'delete' })),
    },
  };
  return { db, calls };
}

/** A dispatch refused, as the database words it (a check or a trigger: its code, hint and details beside its words). */
export interface ADispatchRefused {
  readonly message: string;
  readonly code: string;
  readonly hint: string | null;
  readonly details: string | null;
}
/** A dispatch the player's world holds, with its game. */
export type ADispatchThePlayersWorldHolds = ADispatch & Pick<ADispatchsGameAndRealms, 'game_id'>;
/** A realm's read marks the player's world holds, with the account that wrote them. */
export type ReadMarksThePlayersWorldHolds = ARealmsReadMarks & { readonly user_id: string };
/** What the player page reads, held by the fake: who is signed in (`me`, else no one), the accounts' names, the games
 *  and their realms (as makeStub, in tests/lib/stub-db.js, held them: a test may add one later, and reads a join
 *  back), and what a dispatch sent is refused with (`dispatchRefused`, none: sent). With `dispatches` and `readMarks`
 *  (plan P1-17l2), it holds the dispatches and the read marks too: a test may add a dispatch later, as another
 *  player's browser would, and a dispatch sent and read marks written are kept (without them, none is held). The fake
 *  answers each read as its query asks (its filters, never the access rules), and notes in
 *  `readsOfAnotherAccountsRealms` each read of the realms that asks for an account other than `me`'s, or for a realm
 *  not `me`'s. */
export interface ThePlayersWorld {
  readonly me: string | null;
  readonly names: readonly AnAccountsName[];
  readonly games: AGame[];
  readonly realms: ARealm[];
  dispatchRefused: ADispatchRefused | null;
  readonly readsOfAnotherAccountsRealms: string[];
  readonly dispatches?: ADispatchThePlayersWorldHolds[];
  readonly readMarks?: ReadMarksThePlayersWorldHolds[];
}

/** A fake database, up to date at `version`, holding the player's `world`. */
export function makeAFakeDbHoldingThePlayersWorld(version: string, world: ThePlayersWorld): AFakeDb {
  const fake = makeAFakeDb([version]);
  const { calls } = fake;
  const answering =
    <A extends unknown[], T>(name: string, answer: (...args: A) => T) =>
    (...args: A): Promise<T> => {
      calls.push(name);
      return Promise.resolve(answer(...args));
    };
  /** A copy of the held rows, so the page's changes to what it read change nothing held. */
  const copies = <T>(rows: readonly T[]): T[] => rows.map((r) => structuredClone(r));
  const rows = <T>(data: T[]): ADatabaseAnswer<T[]> => ({ data, error: null, status: 200 });
  /** One row asked for: it, else the local database's words for a single row's read that matched none. */
  const oneRow = <T>(found: T | undefined): ADatabaseAnswer<T> =>
    found === undefined ? noSuchRow() : { data: structuredClone(found), error: null, status: 200 };
  /** The realms of the account `account`, noting a read that asks for another's. */
  const realmsOf = (name: string, account: string): ARealm[] => {
    if (account !== world.me) world.readsOfAnotherAccountsRealms.push(name);
    return copies(world.realms.filter((r) => r.user_id === account));
  };
  const gamesAmong = (ids: readonly string[]): AGame[] => copies(world.games.filter((g) => ids.includes(g.id)));
  /** The dispatches held of the games `games`, by id, the newest or the oldest first. */
  const dispatchesOf = (
    games: readonly string[],
    order: 'newest first' | 'oldest first',
  ): ADispatchThePlayersWorldHolds[] =>
    copies((world.dispatches ?? []).filter((d) => games.includes(d.game_id))).sort((a, b) =>
      order === 'newest first' ? b.id - a.id : a.id - b.id,
    );
  /** A dispatch as the page reads it: its columns, without its game. */
  const asRead = (d: ADispatchThePlayersWorldHolds): ADispatch => ({
    id: d.id,
    turn: d.turn,
    from_index: d.from_index,
    to_indexes: d.to_indexes,
    scope: d.scope,
    body: d.body,
    created_at: d.created_at,
  });
  const gameOf = (id: string): AGame | undefined => world.games.find((g) => g.id === id);
  /** A realm's setup in a game still in setup (its turn report's playerSetup), as get_game_slots reads it. */
  const alignmentInSetup = (realm: ARealm): string | null => {
    let report: unknown = realm.turn_report;
    if (typeof report === 'string') {
      try {
        report = JSON.parse(report);
      } catch {
        report = null;
      }
    }
    const setup: unknown = typeof report === 'object' && report !== null ? Reflect.get(report, 'playerSetup') : null;
    const alignment: unknown = typeof setup === 'object' && setup !== null ? Reflect.get(setup, 'alignment') : null;
    return typeof alignment === 'string' && alignment !== '' ? alignment : null;
  };
  const db: Db = {
    ...fake.db,
    signingIn: {
      ...fake.db.signingIn,
      theSessionKeptInThisBrowser: answering('auth:getSession', () => ({
        data: { session: world.me === null ? null : { user: { id: world.me, user_metadata: {} } } },
        error: null,
      })),
    },
    theAccountsNames: {
      ...fake.db.theAccountsNames,
      theNamesOfTheseAccounts: answering('from:profiles', (ids: readonly string[]) =>
        rows(copies(world.names.filter((n) => ids.includes(n.id)))),
      ),
      theNameOfThisAccount: answering('from:profiles', (id: string) => oneRow(world.names.find((n) => n.id === id))),
    },
    thePlayersRealms: {
      thisAccountsRealmsAndTheirOrdersFlags: answering('from:game_players', (account: string) =>
        rows(realmsOf('thisAccountsRealmsAndTheirOrdersFlags', account)),
      ),
      everyRealmOfThisAccount: answering('from:game_players', (account: string) =>
        rows(realmsOf('everyRealmOfThisAccount', account)),
      ),
      theGamesOfThisAccountsRealms: answering('from:game_players', (account: string) =>
        rows(realmsOf('theGamesOfThisAccountsRealms', account)),
      ),
      thisAccountsRealmsInThisGame: answering('from:game_players', (game: string, account: string) =>
        rows(realmsOf('thisAccountsRealmsInThisGame', account).filter((r) => r.game_id === game)),
      ),
      thisRealm: answering('from:game_players', (id: string) => {
        const realm = world.realms.find((r) => r.id === id);
        if (realm !== undefined && realm.user_id !== world.me) world.readsOfAnotherAccountsRealms.push('thisRealm');
        return oneRow(realm);
      }),
      joinWithThisRealm: answering(
        'from:game_players',
        (realm: Parameters<Db['thePlayersRealms']['joinWithThisRealm']>[0]) => {
          // the unique indexes game_players_one_per_number (P0-20) and game_players_one_per_user
          const inTheGame = world.realms.filter((r) => r.game_id === realm.game_id);
          const clash = inTheGame.some((r) => r.player_index === realm.player_index)
            ? 'game_players_one_per_number'
            : realm.user_id != null && inTheGame.some((r) => r.user_id === realm.user_id)
              ? 'game_players_one_per_user'
              : null;
          if (clash !== null)
            return {
              data: null,
              error: { message: `duplicate key value violates unique constraint "${clash}"` },
              status: 409,
            };
          const made: ARealm = {
            id: realm.id ?? `realm-${String(world.realms.length)}`,
            game_id: realm.game_id,
            user_id: realm.user_id ?? null,
            player_index: realm.player_index,
            display_name: realm.display_name,
            orders_submitted: realm.orders_submitted ?? false,
            turn_report: realm.turn_report ?? null,
            orders: realm.orders ?? null,
            created_at: realm.created_at ?? null,
            invite_code: realm.invite_code ?? null,
            last_submitted_at: realm.last_submitted_at ?? null,
          };
          world.realms.push(made);
          return { data: structuredClone(made), error: null, status: 201 };
        },
      ),
      theSlotsOfTheseGames: answering('rpc:get_game_slots', (games: string[]) =>
        rows(
          world.realms
            .filter((r) => games.includes(r.game_id) && gameOf(r.game_id) !== undefined)
            .map((r): ARealmsSlot => ({
              game_id: r.game_id,
              player_index: r.player_index,
              is_bot: r.user_id === null,
              orders_submitted: r.orders_submitted,
              // the database answers null where the fake answers '': the generated types write a function's
              // columns as never null, and the page reads the alignment only through filter(Boolean)
              alignment: (gameOf(r.game_id)?.status === 'setup' ? alignmentInSetup(r) : null) ?? '',
            })),
        ),
      ),
    },
    thePlayersGames: {
      ...fake.db.thePlayersGames,
      theTurnAndStateOfTheseGames: answering('from:games', (ids: readonly string[]) => rows(gamesAmong(ids))),
      theseGamesForTheirCards: answering('from:games', (ids: readonly string[]) => rows(gamesAmong(ids))),
      theseGamesEveryColumn: answering('from:games', (ids: readonly string[]) => rows(gamesAmong(ids))),
      theGamesInSetup: answering('from:games', () => rows(copies(world.games.filter((g) => g.status === 'setup')))),
      thisGamesWorldAndState: answering('from:games', (id: string) => oneRow(gameOf(id))),
      thisGameForItsReport: answering('from:games', (id: string) => oneRow(gameOf(id))),
      thisGameEveryColumn: answering('from:games', (id: string) => oneRow(gameOf(id))),
    },
    theDispatches: {
      ...fake.db.theDispatches,
      theNewestDispatchesOfThisGame: answering('from:game_messages', (game: string, count: number) =>
        rows(dispatchesOf([game], 'newest first').slice(0, count).map(asRead)),
      ),
      theDispatchesOfThisGameAfterThisOne: answering(
        'from:game_messages',
        (game: string, after: number, count: number) =>
          rows(
            dispatchesOf([game], 'oldest first')
              .filter((d) => d.id > after)
              .slice(0, count)
              .map(asRead),
          ),
      ),
      theDispatchesOfThisGameBeforeThisOne: answering(
        'from:game_messages',
        (game: string, before: number, count: number) =>
          rows(
            dispatchesOf([game], 'newest first')
              .filter((d) => d.id < before)
              .slice(0, count)
              .map(asRead),
          ),
      ),
      theNewestDispatchesOfTheseGamesGamesAndRealms: answering('from:game_messages', (games: readonly string[]) =>
        rows(
          dispatchesOf(games, 'newest first')
            .slice(0, 3000)
            .map((d): ADispatchsGameAndRealms => ({
              id: d.id,
              game_id: d.game_id,
              from_index: d.from_index,
              to_indexes: d.to_indexes,
              scope: d.scope,
            })),
        ),
      ),
      sendThisDispatch: answering(
        'from:game_messages',
        (dispatch: Parameters<Db['theDispatches']['sendThisDispatch']>[0]) => {
          if (world.dispatchRefused !== null) return { data: null, error: world.dispatchRefused, status: 400 };
          const held = world.dispatches;
          if (held !== undefined)
            held.push({
              id: held.reduce((most, d) => Math.max(most, d.id), 0) + 1,
              game_id: dispatch.game_id,
              turn: dispatch.turn ?? null,
              from_index: dispatch.from_index,
              to_indexes: dispatch.to_indexes ?? [],
              scope: dispatch.scope ?? 'public',
              body: dispatch.body,
              created_at: new Date().toISOString(),
            });
          return { data: null, error: null, status: 201 };
        },
      ),
      thisRealmsReadMarksInThisGame: answering('from:game_message_reads', (game: string, realm: number) => {
        const marks = (world.readMarks ?? []).find((m) => m.game_id === game && m.player_index === realm);
        return { data: marks === undefined ? null : { reads: structuredClone(marks.reads) }, error: null, status: 200 };
      }),
      thisAccountsReadMarksInTheseGames: answering(
        'from:game_message_reads',
        (games: readonly string[], account: string) =>
          rows(
            (world.readMarks ?? [])
              .filter((m) => games.includes(m.game_id) && m.user_id === account)
              .map((m): ARealmsReadMarks => ({
                game_id: m.game_id,
                player_index: m.player_index,
                reads: structuredClone(m.reads),
              })),
          ),
      ),
      writeTheseReadMarks: answering(
        'from:game_message_reads',
        (marks: Parameters<Db['theDispatches']['writeTheseReadMarks']>[0]) => {
          const held = world.readMarks;
          if (held === undefined) return refusedByTheAccessRules('game_message_reads');
          // upserted on (game_id, player_index), as the page's query asks; reads' default is the column's, {}
          const written: ReadMarksThePlayersWorldHolds = {
            game_id: marks.game_id,
            player_index: marks.player_index,
            user_id: marks.user_id,
            reads: structuredClone(marks.reads ?? {}),
          };
          const i = held.findIndex((m) => m.game_id === marks.game_id && m.player_index === marks.player_index);
          if (i === -1) held.push(written);
          else held[i] = written;
          return { data: null, error: null, status: 201 };
        },
      ),
    },
  };
  return { db, calls };
}
