// The fake database (plan P1-17, Decision 8): a small in-memory Db (src/db/the-db-interface-and-its-areas.ts), so the
// compiler keeps it in step with the real one. A page test hands it to the page before the page's scripts run
// (bootJsdom's opts.db, tests/lib/boot.js); a unit test calls code that takes a Db with it. It doesn't imitate the
// access rules: the access layer's tests prove those against the local database. Each of P1-17's area rows adds its
// area's functions here. Beyond the version, it holds no account: no session, a sign-in or sign-up refused, no names, no
// role and no offer; and no game, so no realm, no slot, no turn's log, no Hall of Fame entry, no statistics, no dispatch
// and no report (a new row refused, a change or deletion matching nothing, a single row's read finding none). The
// Overlord's functions refuse, as the database refuses anyone but the Overlord. Five fakes below hold a world a test
// stages and reads back: the Overlord's page's and the Hall of Fame's (plan P1-17i), the player's (P1-17l), the GM's
// turn (P1-17q) and the GM's world (P1-17q2); the player's holds the Game Master offers and the dispatches' reports too
// when a test stages them (P1-17r). The player's saves its orders as the database's function submit_orders
// does (P2-05): that function's checks are the one rule the fake keeps, in the words the access layer's test holds the
// database to. For the screen tours (tests/lib/screens.js, P1-17t), the Hall of Fame's refuses its changes or its read
// when a tour asks, the GM's world answers the player page's functions too, on the same tables, and
// makeAFakeDbHoldingAWorldHandedAsData (at the end) makes any of four worlds from data, as Chromium's init script and
// the tours hand them.
import type {
  ADatabaseAnswer,
  AGame,
  AGameAsTheOverlordListsIt,
  AGameWithItsRealms,
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
/** submit_orders' refusals, in its words (supabase/schemas/public/functions/submit_orders.sql is their one home): the
 *  stand-in below gives them, and the access layer's test holds the database to the same words, so the two stay in step
 *  (tests/db/the-orders-change-only-the-realm-they-write-as-each-role.test.ts). */
export const THE_WORDS_SUBMIT_ORDERS_REFUSES_WITH = {
  noRealm: 'You hold no realm in this game.',
  notRunning: "This game isn't running: orders are sent only while it is.",
  theTurn: (sent: number, now: number): string =>
    `These orders are for turn ${String(sent)}, but the game is on turn ${String(now)}: reload to see the current turn.`,
  late: "This turn's deadline has passed: orders can no longer be sent or changed.",
  notThisTurn: "These orders don't name this turn: reload to see the current turn.",
} as const;
/** A function's call with no one signed in, refused for want of a grant (the anon role has none). */
const refusedAsSignedOut = (): ADatabaseAnswer<null> => ({
  data: null,
  error: { message: 'permission denied for function submit_orders' },
  status: 401,
});
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
      saveThisRealmsDraft: answering('rpc:submit_orders', refusedAsSignedOut),
      saveThisRealmsHeroOrder: answering('rpc:submit_orders', refusedAsSignedOut),
      reopenThisRealmsOrders: answering('rpc:submit_orders', refusedAsSignedOut),
      submitThisRealmsOrders: answering('rpc:submit_orders', refusedAsSignedOut),
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
 *  The changes it sends are noted in `changes`, and change nothing. With `writesRefusedWith` (plan P1-17t: the
 *  screen tour), every change and the rename are refused with those words; with `readRefusedWith`, the read of the
 *  entries is. */
export interface TheHallOfFamesWorld {
  readonly rows: () => readonly AHallOfFameEntry[];
  readonly changes: AChangeTheHallOfFameSent[];
  readonly signedIn: boolean;
  readonly me?: string;
  readonly isGm?: boolean;
  readonly isOverlord?: boolean;
  readonly names?: readonly AnAccountsName[];
  readonly writesRefusedWith?: string;
  readonly readRefusedWith?: string;
}
/** The Hall of Fame's world as a spec hands it to Chromium, as data: its entries as a list. */
export type TheHallOfFamesWorldAsData = Omit<TheHallOfFamesWorld, 'rows'> & {
  readonly rows: readonly AHallOfFameEntry[];
};

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
  /** Notes `change` and answers as the database does (no error, no row), or the refusal the world names. */
  const noted = (change: AChangeTheHallOfFameSent): ADatabaseAnswer<null> => {
    world.changes.push(change);
    const refusal = world.writesRefusedWith;
    return refusal === undefined
      ? { data: null, error: null, status: 204 }
      : { data: null, error: { message: refusal }, status: 400 };
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
      everyEntryNewestFinishedFirstFromRowToRow: answering('from:game_records', (from: number) =>
        world.readRefusedWith === undefined
          ? { data: from > 0 ? [] : world.rows().slice(), error: null, status: 200 }
          : { data: null, error: { message: world.readRefusedWith }, status: 400 },
      ),
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
/** A dispatch the player's world holds, with its game, and its sender's account when the page sent it (as the
 *  database keeps from_user_id: the account sent, else the signed-in one; a null sent is refused). */
export type ADispatchThePlayersWorldHolds = ADispatch &
  Pick<ADispatchsGameAndRealms, 'game_id'> & { readonly from_user_id?: string | null };
/** A realm's read marks the player's world holds, with the account that wrote them. */
export type ReadMarksThePlayersWorldHolds = ARealmsReadMarks & { readonly user_id: string };
/** A report of a dispatch the player's world holds (a message_reports row, as the page writes it). */
export interface AReportThePlayersWorldHolds {
  readonly id: number;
  readonly message_id: number;
  readonly game_id: string;
  readonly reporter_index: number;
  readonly reporter_user_id?: string;
  readonly reason: string | null;
  readonly created_at: string;
}
/** What the player page reads, held by the fake: who is signed in (`me`, else no one), the accounts' names, the games
 *  and their realms (a test may add one later, and reads a join back), and what a dispatch sent is refused with
 *  (`dispatchRefused`, none: sent). With `dispatches` and `readMarks` (plan P1-17l2), it holds the dispatches and the
 *  read marks too: a test may add a dispatch later, as another player's browser would, and a dispatch sent and read
 *  marks written are kept (without them, none is held). The orders are saved into `realms` as submit_orders saves them
 *  (its checks: the realm `me` holds, the game running, its turn, its deadline in the game's meta). The fake answers
 *  each read as its query asks (its filters, never the access rules), and notes in `readsOfAnotherAccountsRealms` each
 *  read of the realms that asks for an account other than `me`'s, or for a realm not `me`'s. With `offers` (plan
 *  P1-17r), it holds the Game Master offers: the page reads an account's, and `me` accepts or declines its own as
 *  gm_accept_offer and gm_decline_offer do (refused in their words when there is none to answer); with `reports`, the
 *  reports of dispatches: the page reads a game's and writes one (without them, none is held). While
 *  `dispatchesTableMissing` is true (plan P1-17, the Dispatches spec), every call on the dispatches' table
 *  (game_messages) is refused as a database without that table refuses it, in its words, as the GM's world's missing
 *  tables are. */
export interface ThePlayersWorld {
  readonly me: string | null;
  readonly names: readonly AnAccountsName[];
  readonly games: AGame[];
  readonly realms: ARealm[];
  dispatchRefused: ADispatchRefused | null;
  readonly readsOfAnotherAccountsRealms: string[];
  readonly dispatches?: ADispatchThePlayersWorldHolds[];
  readonly readMarks?: ReadMarksThePlayersWorldHolds[];
  readonly offers?: AFakeGameMasterOffer[];
  readonly reports?: AReportThePlayersWorldHolds[];
  dispatchesTableMissing?: boolean;
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
  /** The time of the next deadline the game `game`'s meta names (a meta held as JSON text read too), else none. */
  const theDeadlineOf = (game: AGame): number | null => {
    let meta: unknown = game.meta;
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = null;
      }
    }
    const mode: unknown = typeof meta === 'object' && meta !== null ? Reflect.get(meta, 'turnMode') : null;
    if (typeof mode !== 'object' || mode === null || Reflect.get(mode, 'mode') !== 'deadline') return null;
    const at: unknown = Reflect.get(mode, 'nextDeadlineAt');
    const time = typeof at === 'string' ? Date.parse(at) : Number.NaN;
    return Number.isNaN(time) ? null : time;
  };
  /** submit_orders, as the page tests need it: the realm `me` holds in the game `game` saves `orders` (null: kept) and
   *  whether they're submitted (null: kept), only while the game runs, for its turn, before its deadline, and the
   *  orders naming that turn; else refused in the function's words. Not mirrored (no page test needs them): the call
   *  with nothing to save, the longest orders, and orders of another shape than the form's. */
  const submitOrders = (
    game: string,
    turn: number,
    orders: string | null,
    submitted: boolean | null,
  ): ADatabaseAnswer<null> => {
    const refused = (message: string): ADatabaseAnswer<null> => ({ data: null, error: { message }, status: 400 });
    const words = THE_WORDS_SUBMIT_ORDERS_REFUSES_WITH;
    const at = world.realms.findIndex((r) => r.game_id === game && world.me !== null && r.user_id === world.me);
    const realm = world.realms[at];
    if (realm === undefined) return refused(words.noRealm);
    const theGame = gameOf(game);
    if (theGame?.status !== 'active') return refused(words.notRunning);
    if (turn !== theGame.turn) return refused(words.theTurn(turn, theGame.turn));
    const deadline = theDeadlineOf(theGame);
    if (deadline !== null && Date.now() >= deadline) return refused(words.late);
    if (orders !== null) {
      let sent: unknown;
      try {
        sent = JSON.parse(orders);
      } catch {
        sent = null;
      }
      const named: unknown = typeof sent === 'object' && sent !== null ? Reflect.get(sent, 'forTurn') : null;
      if (named !== turn) return refused(words.notThisTurn);
    }
    world.realms[at] = {
      ...realm,
      orders: orders ?? realm.orders,
      orders_submitted: submitted ?? realm.orders_submitted,
      last_submitted_at: submitted === true ? new Date().toISOString() : realm.last_submitted_at,
    };
    return { data: null, error: null, status: 204 };
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
    theRoles: {
      ...fake.db.theRoles,
      theGameMasterOfferMadeToThisAccount: (id: string) => {
        const offers = world.offers;
        if (offers === undefined) return fake.db.theRoles.theGameMasterOfferMadeToThisAccount(id);
        const offer = offers.find((o) => o.user_id === id);
        return answering('from:game_masters', () => ({
          data: offer === undefined ? null : { accepted_at: offer.accepted_at },
          error: null,
          status: 200,
        }))();
      },
      answerTheGameMasterOffer: (answer: Parameters<Db['theRoles']['answerTheGameMasterOffer']>[0]) => {
        const offers = world.offers;
        if (offers === undefined) return fake.db.theRoles.answerTheGameMasterOffer(answer);
        return answering(`rpc:${answer}`, () => {
          const own = offers.find((o) => world.me !== null && o.user_id === world.me);
          const refused = (message: string) => ({ data: null, error: { message }, status: 400 });
          if (answer === 'gm_accept_offer') {
            if (own === undefined) return refused('You have no offer to accept.');
            own.accepted_at ??= new Date().toISOString();
            return { data: null, error: null, status: 200 };
          }
          if (own?.accepted_at !== null) return refused('You have no offer to decline.');
          offers.splice(offers.indexOf(own), 1);
          return { data: null, error: null, status: 200 };
        })();
      },
    },
    theReportedDispatches: {
      ...fake.db.theReportedDispatches,
      theDispatchesThisAccountReportedInThisGame: (game: string) => {
        const reports = world.reports;
        if (reports === undefined)
          return fake.db.theReportedDispatches.theDispatchesThisAccountReportedInThisGame(game);
        return answering('from:message_reports', () =>
          rows(reports.filter((r) => r.game_id === game).map((r) => ({ message_id: r.message_id }))),
        )();
      },
      reportThisDispatch: (report: Parameters<Db['theReportedDispatches']['reportThisDispatch']>[0]) => {
        const reports = world.reports;
        if (reports === undefined) return fake.db.theReportedDispatches.reportThisDispatch(report);
        return answering('from:message_reports', () => {
          reports.push({
            ...report,
            id: reports.reduce((most, r) => Math.max(most, r.id), 0) + 1,
            reason: report.reason ?? null,
            created_at: report.created_at ?? new Date().toISOString(),
          });
          return { data: null, error: null, status: 201 };
        })();
      },
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
    theOrders: {
      saveThisRealmsDraft: answering('rpc:submit_orders', (game: string, turn: number, orders: string) =>
        submitOrders(game, turn, orders, false),
      ),
      saveThisRealmsHeroOrder: answering('rpc:submit_orders', (game: string, turn: number, orders: string) =>
        submitOrders(game, turn, orders, null),
      ),
      reopenThisRealmsOrders: answering('rpc:submit_orders', (game: string, turn: number) =>
        submitOrders(game, turn, null, false),
      ),
      submitThisRealmsOrders: answering('rpc:submit_orders', (game: string, turn: number, orders: string) =>
        submitOrders(game, turn, orders, true),
      ),
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
          // the sender's account is never null: sent as null, the dispatch is refused in the database's words
          if (dispatch.from_user_id === null)
            return {
              data: null,
              error: {
                message: 'null value in column "from_user_id" of relation "game_messages" violates not-null constraint',
                code: '23502',
              },
              status: 400,
            };
          const held = world.dispatches;
          if (held !== undefined)
            held.push({
              id: held.reduce((most, d) => Math.max(most, d.id), 0) + 1,
              game_id: dispatch.game_id,
              // the column's default, the signed-in account, when the page sends none
              from_user_id: dispatch.from_user_id ?? world.me,
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
  /** The call `call` on the dispatches' table, refused while the world lacks that table (relation "does not exist",
   *  the GM's world's words), else answered as above. */
  const unlessTheTableIsMissing =
    <A extends unknown[], T>(call: (...args: A) => PromiseLike<T>) =>
    (...args: A): PromiseLike<T> => {
      if (world.dispatchesTableMissing !== true) return call(...args);
      calls.push('from:game_messages');
      // the refusal as the database words it: no data, whatever the call's own answer would hold
      return Promise.resolve({
        data: null,
        error: { message: 'relation "public.game_messages" does not exist', code: '42P01' },
        status: 404,
      } as T);
    };
  const d = db.theDispatches;
  return {
    db: {
      ...db,
      theDispatches: {
        ...d,
        oneDispatchsId: unlessTheTableIsMissing(d.oneDispatchsId),
        theNewestDispatchesOfThisGame: unlessTheTableIsMissing(d.theNewestDispatchesOfThisGame),
        theDispatchesOfThisGameAfterThisOne: unlessTheTableIsMissing(d.theDispatchesOfThisGameAfterThisOne),
        theDispatchesOfThisGameBeforeThisOne: unlessTheTableIsMissing(d.theDispatchesOfThisGameBeforeThisOne),
        theNewestDispatchesOfTheseGamesGamesAndRealms: unlessTheTableIsMissing(
          d.theNewestDispatchesOfTheseGamesGamesAndRealms,
        ),
        sendThisDispatch: unlessTheTableIsMissing(d.sendThisDispatch),
        deleteThisDispatch: unlessTheTableIsMissing(d.deleteThisDispatch),
      },
    },
    calls,
  };
}

/** A change the GM page sent while it ran a turn (a row's `update`, `insert` or `upsert`, by its table, with what it
 *  sent: `val`), or a deletion (no `val`). */
export interface AChangeTheGameMastersTurnSent {
  readonly table: string;
  readonly val?: unknown;
}
/** What the GM page reads while it runs a turn, held by the fake (plan P1-17q): the one game every read of a game
 *  finds (`theGame`, read again at each call; none: no row), and the realms every read of a game's realms finds
 *  (`theRealms`). No account is signed in; every list of games, of turn logs and of statistics finds none. The
 *  changes the page sends are noted in `changes`, in order, and change nothing held: the game is saved on its turn,
 *  and the save answers its id, while the game is held. */
export interface TheGameMastersTurnsWorld {
  readonly theGame: () => AGameWithItsRealms | null;
  readonly theRealms: () => readonly ARealm[];
  readonly changes: AChangeTheGameMastersTurnSent[];
}

/** A fake database, up to date at `version`, holding the GM's turn's `world`. */
export function makeAFakeDbHoldingTheGameMastersTurn(version: string, world: TheGameMastersTurnsWorld): AFakeDb {
  const fake = makeAFakeDb([version]);
  const { calls } = fake;
  const answering =
    <A extends unknown[], T>(name: string, answer: (...args: A) => T) =>
    (...args: A): Promise<T> => {
      calls.push(name);
      return Promise.resolve(answer(...args));
    };
  const found = <T>(data: T | null): ADatabaseAnswer<T> => ({ data, error: null, status: 200 });
  /** Notes `val` sent to `table`, and answers as the database does (no error, no row). */
  const noted = (table: string, val?: unknown): ADatabaseAnswer<null> => {
    world.changes.push(val === undefined ? { table } : { table, val });
    return { data: null, error: null, status: 204 };
  };
  /** Notes `val` sent to `table`, and answers the held game's id (none once no game is held). */
  const notedAnsweringTheGamesId = (table: string, val: unknown): ADatabaseAnswer<{ id: string }> => {
    world.changes.push({ table, val });
    const game = world.theGame();
    return found(game ? { id: game.id } : null);
  };
  const db: Db = {
    ...fake.db,
    theGameMastersGames: {
      ...fake.db.theGameMastersGames,
      thisGameWithItsRealms: answering('from:games', () => found(world.theGame())),
      thisGamesTurnAndWorld: answering('from:games', () => found(world.theGame())),
      changeThisGame: answering('from:games', (_game: string, change: unknown) => noted('games', change)),
      changeThisGameAndAnswerItsId: answering('from:games', (_game: string, change: unknown) =>
        notedAnsweringTheGamesId('games', change),
      ),
      changeThisGameWhileOnThisTurnAndAnswerItsId: answering(
        'from:games',
        (_game: string, _turn: number, change: unknown) => notedAnsweringTheGamesId('games', change),
      ),
    },
    theHallOfFame: {
      ...fake.db.theHallOfFame,
      writeTheseEntries: answering('from:game_records', (entries: unknown) => noted('game_records', entries)),
    },
    theHallOfFamesGames: {
      ...fake.db.theHallOfFamesGames,
      thisGameWithItsWorldAndRealms: answering('from:games', () => found(world.theGame())),
    },
    theStatistics: {
      ...fake.db.theStatistics,
      writeTheseResults: answering('from:game_results', (results: unknown) => noted('game_results', results)),
      writeTheseTurnRecords: answering('from:turn_events', (records: unknown) => noted('turn_events', records)),
    },
    theTurnAsTheGameMasterRunsIt: {
      thisGameEveryColumn: answering('from:games', () => found(world.theGame())),
      everyRealmOfThisGame: answering('from:game_players', () => found(world.theRealms().slice())),
      clearTheOrdersOfEveryRealmOfThisGame: answering('from:game_players', () =>
        noted('game_players', { orders: null, orders_submitted: false }),
      ),
      saveThisGameWhileOnThisTurnAndAnswerItsId: answering(
        'from:games',
        (_game: string, _turn: number, change: unknown) => notedAnsweringTheGamesId('games', change),
      ),
      giveThisRealmItsTurnReport: answering('from:game_players', (_realm: string, report: string) =>
        noted('game_players', { turn_report: report }),
      ),
      writeThisLog: answering('from:turn_logs', (log: unknown) => noted('turn_logs', log)),
      theTurnOfThisGameIfItIsThere: answering('from:games', () => {
        const game = world.theGame();
        return found(game ? { turn: game.turn } : null);
      }),
      putBackThisRealmsOrders: answering('from:game_players', (_realm: string, orders: unknown, submitted: boolean) =>
        noted('game_players', { orders, orders_submitted: submitted }),
      ),
    },
  };
  return { db, calls };
}

/** A row the GM's world holds, as a test stages it (a script may stage only the columns it needs). */
export type ARowTheGameMastersWorldHolds = Record<string, unknown>;
/** The tables the GM's world holds. */
export type TheGameMastersTables = Record<
  | 'profiles'
  | 'games'
  | 'game_players'
  | 'turn_logs'
  | 'turn_events'
  | 'game_results'
  | 'game_records'
  | 'game_messages'
  | 'game_message_reads'
  | 'message_reports'
  | 'game_masters'
  | 'site_admins',
  ARowTheGameMastersWorldHolds[]
>;
/** What the GM page reads and changes, held by the fake (plan P1-17q2): who is signed in (`me`, else no one: gm1, a
 *  Game Master, unless a test says otherwise), the tables, the columns an older database lacks (`missingColumns`,
 *  "table.column") and the tables it lacks (`missingTables`), each refused in the database's words when a query names
 *  it, the calls that fail (`failing`, "table.op" or "rpc.name": that call answers that error), and every call made
 *  (`calls`, "table.op" or "rpc.name", in order). Each function answers as its query asks (its filters, order, limit
 *  and single row), never by the access rules; a change is made to the rows held. The player page's functions answer on
 *  the same tables (plan P1-17t, the player's screen tour): the Game Master offer's answer, and get_game_slots, as
 *  their functions do; submit_orders answers as done and saves nothing. */
export interface TheGameMastersWorld {
  me: string | null;
  readonly tables: TheGameMastersTables;
  readonly missingColumns: Set<string>;
  readonly missingTables: Set<string>;
  readonly failing: Record<string, { readonly message: string; readonly code?: string }>;
  readonly calls: string[];
}

/** The GM's world at its start: gm1 signed in, a Game Master named Test GM, and nothing else. */
export function aGameMastersWorld(): TheGameMastersWorld {
  return {
    me: 'gm1',
    tables: {
      profiles: [{ id: 'gm1', name: 'Test GM' }],
      games: [],
      game_players: [],
      turn_logs: [],
      turn_events: [],
      game_results: [],
      game_records: [],
      game_messages: [],
      game_message_reads: [],
      message_reports: [],
      game_masters: [
        { user_id: 'gm1', offered_at: '2026-10-01T00:00:00Z', offered_by: null, accepted_at: '2026-10-01T00:00:00Z' },
      ],
      site_admins: [],
    },
    missingColumns: new Set(),
    missingTables: new Set(),
    failing: {},
    calls: [],
  };
}

type ATableTheGameMastersWorldHolds = keyof TheGameMastersTables;
/** A filter of a query: a column, how it is compared, and the value. */
type AFilter = readonly [kind: 'eq' | 'in' | 'is' | 'gt' | 'lt', column: string, value: unknown];
/** A query a function of the GM's world sends: its table, what it does, the columns it names (its select), its
 *  filters, its order, how many rows, and the change, row or rows it sends. */
interface AQuery {
  readonly table: ATableTheGameMastersWorldHolds;
  readonly op: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  readonly columns?: string;
  readonly filters?: readonly AFilter[];
  readonly order?: readonly (readonly [column: string, ascending: boolean])[];
  readonly limit?: number;
  readonly range?: readonly [from: number, to: number];
  readonly one?: 'single' | 'maybe';
  readonly payload?: unknown;
  readonly onConflict?: string;
}

/** The GM's world as a spec hands it to Chromium, as data: its sets as lists. */
export type TheGameMastersWorldAsData = Omit<TheGameMastersWorld, 'missingColumns' | 'missingTables'> & {
  readonly missingColumns: readonly string[];
  readonly missingTables: readonly string[];
};

/** A fake database, up to date at `version`, holding the GM's `world` (plan P1-17q2). */
export function makeAFakeDbHoldingTheGameMastersWorld(version: string, world: TheGameMastersWorld): AFakeDb {
  const fake = makeAFakeDb([version]);
  const { calls } = fake;
  let next = 1;
  const clone = <T>(v: T): T => structuredClone(v);
  const isObject = (v: unknown): v is ARowTheGameMastersWorldHolds => typeof v === 'object' && v !== null;
  const same = (a: unknown, b: unknown) => String(a) === String(b);
  const compare = (a: unknown, b: unknown) =>
    typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  const matches = (row: ARowTheGameMastersWorldHolds, [kind, column, value]: AFilter) => {
    const v = row[column];
    if (kind === 'eq') return same(v, value);
    if (kind === 'in') return Array.isArray(value) && value.some((x) => same(x, v));
    if (kind === 'is') return value === null ? v == null : v === value;
    if (kind === 'gt') return Number(v) > Number(value);
    return Number(v) < Number(value);
  };
  const payloadRows = (payload: unknown): ARowTheGameMastersWorldHolds[] =>
    (Array.isArray(payload) ? payload : [payload]).filter(isObject);
  /** The first column the query names that the database lacks, or none. */
  const missingColumnOf = (q: AQuery): string | undefined => {
    const gone = [...world.missingColumns]
      .filter((k) => k.startsWith(q.table + '.'))
      .map((k) => k.slice(q.table.length + 1));
    if (!gone.length) return undefined;
    const selected = (q.columns ?? '')
      .replace(/\([^)]*\)/g, '')
      .split(',')
      .map((s) => s.trim());
    const named = [
      ...(q.op === 'select' ? selected : []),
      ...(q.filters ?? []).map((f) => f[1]),
      ...(q.order ?? []).map((o) => o[0]),
      ...payloadRows(q.payload).flatMap((p) => Object.keys(p)),
    ];
    return gone.find((c) => named.includes(c));
  };
  /** The rows the query's filters, order and limit find. */
  const found = (q: AQuery) => {
    let rows = world.tables[q.table].filter((r) => (q.filters ?? []).every((f) => matches(r, f)));
    for (const [column, ascending] of [...(q.order ?? [])].reverse())
      rows = rows.slice().sort((a, b) => (ascending ? 1 : -1) * compare(a[column], b[column]));
    if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
    if (q.limit !== undefined) rows = rows.slice(0, q.limit);
    return rows;
  };
  /** The rows found, each game with its realms when the query asks for them. */
  const shown = (q: AQuery, rows: ARowTheGameMastersWorldHolds[]) =>
    /game_players\s*\(/.test(q.columns ?? '')
      ? rows.map((g) => ({
          ...clone(g),
          game_players: clone(world.tables.game_players.filter((p) => same(p['game_id'], g['id']))),
        }))
      : clone(rows);
  const one = (q: AQuery, rows: unknown[]) => {
    if (q.one === 'single')
      return rows.length === 1
        ? { data: rows[0], error: null, status: 200 }
        : { data: null, error: { message: 'Cannot coerce the result to a single JSON object' }, status: 406 };
    if (q.one === 'maybe') return { data: rows[0] ?? null, error: null, status: 200 };
    return { data: rows, error: null, status: 200 };
  };
  /** Runs the query on the world's rows, and answers as the database does. */
  const run = (name: string, q: AQuery) => {
    calls.push(name);
    world.calls.push(q.table + '.' + q.op);
    const failure = world.failing[q.table + '.' + q.op];
    if (failure) return { data: null, error: failure, status: 400 };
    if (world.missingTables.has(q.table))
      return {
        data: null,
        error: { message: `relation "public.${q.table}" does not exist`, code: '42P01' },
        status: 404,
      };
    const missing = missingColumnOf(q);
    if (missing !== undefined)
      return q.payload === undefined
        ? { data: null, error: { message: `column ${q.table}.${missing} does not exist`, code: '42703' }, status: 400 }
        : {
            data: null,
            error: {
              message: `Could not find the '${missing}' column of '${q.table}' in the schema cache`,
              code: 'PGRST204',
            },
            status: 400,
          };
    const table = world.tables[q.table];
    if (q.op === 'select') return one(q, shown(q, found(q)));
    if (q.op === 'insert') {
      const made = payloadRows(q.payload).map((p) => {
        const row = { id: p['id'] ?? 'row' + String(next++), ...p };
        table.push(row);
        return row;
      });
      return q.one === undefined ? { data: null, error: null, status: 201 } : one(q, clone(made));
    }
    if (q.op === 'upsert') {
      const keys = (q.onConflict ?? 'id').split(',').map((s) => s.trim());
      for (const p of payloadRows(q.payload)) {
        const hit = table.find((x) => keys.every((k) => same(x[k], p[k])));
        if (hit) Object.assign(hit, p);
        else table.push({ id: 'row' + String(next++), ...p });
      }
      return { data: null, error: null, status: 201 };
    }
    if (q.op === 'update') {
      const hits = found(q);
      for (const r of hits) Object.assign(r, q.payload);
      return q.one === undefined ? { data: null, error: null, status: 204 } : one(q, clone(hits));
    }
    const doomed = new Set(found(q));
    world.tables[q.table] = table.filter((r) => !doomed.has(r));
    return { data: null, error: null, status: 204 };
  };
  const query =
    <A extends unknown[], T>(name: string, q: (...args: A) => AQuery) =>
    (...args: A): Promise<T> =>
      // handed on as the Db's type: the world holds rows as the tests stage them
      Promise.resolve(run(name, q(...args)) as T);
  const me = () => world.me;
  const rpc =
    <A extends unknown[], T>(fn: string, answer: (...args: A) => unknown) =>
    (...args: A): Promise<T> => {
      calls.push('rpc:' + fn);
      world.calls.push('rpc.' + fn);
      const failure = world.failing['rpc.' + fn];
      let answered;
      if (failure) answered = { data: null, error: failure, status: 400 };
      else
        try {
          answered = { data: answer(...args), error: null, status: 200 };
        } catch (e) {
          // a function that raises its refusal (an exception: HTTP 400, in its words)
          answered = {
            data: null,
            error: { message: e instanceof Error ? e.message : String(e), code: 'P0001' },
            status: 400,
          };
        }
      return Promise.resolve(answered as T);
    };
  const eq = (column: string, value: unknown): AFilter => ['eq', column, value];
  const inList = (column: string, value: unknown): AFilter => ['in', column, value];
  const newestFirst = [['created_at', false]] as const;
  const A_GAME_IN_THE_LIST =
    'id,name,gm_user_id,status,turn,max_players,max_turns,created_at,meta, game_players(id,game_id,user_id,player_index,display_name,orders_submitted)';
  const A_DISPATCH = 'id,turn,from_index,to_indexes,scope,body,created_at';
  const isTheOverlord = () => world.tables.site_admins.some((r) => same(r['user_id'], me()));
  const session = () => {
    const id = me();
    return id === null ? null : { user: { id, user_metadata: {} } };
  };
  const db: Db = {
    ...fake.db,
    signingIn: {
      ...fake.db.signingIn,
      theSessionKeptInThisBrowser: () => {
        calls.push('auth:getSession');
        return Promise.resolve({ data: { session: session() }, error: null });
      },
      signInWithEmailAndPassword: () => {
        calls.push('auth:signInWithPassword');
        return Promise.resolve({ data: { user: null, session: null }, error: null });
      },
      signOut: () => {
        calls.push('auth:signOut');
        return Promise.resolve({ error: null });
      },
    },
    theAccountsNames: {
      ...fake.db.theAccountsNames,
      theNamesOfTheseAccounts: query('from:profiles', (ids: readonly string[]) => ({
        table: 'profiles',
        op: 'select',
        columns: 'id,name',
        filters: [inList('id', ids)],
      })),
      theNameOfEveryAccount: query('from:profiles', () => ({ table: 'profiles', op: 'select', columns: 'id,name' })),
      theNameAndJoiningDateOfEveryAccountInNameOrder: query('from:profiles', () => ({
        table: 'profiles',
        op: 'select',
        columns: 'id,name,created_at',
        order: [['name', true]],
      })),
      theNameOfThisAccount: query('from:profiles', (id: string) => ({
        table: 'profiles',
        op: 'select',
        columns: 'id,name',
        filters: [eq('id', id)],
        one: 'single',
      })),
      giveThisAccountItsName: query('from:profiles', (id: string, name: string) => ({
        table: 'profiles',
        op: 'upsert',
        payload: { id, name },
        onConflict: 'id',
      })),
    },
    theRoles: {
      ...fake.db.theRoles,
      isTheSignedInAccountAGameMaster: rpc('is_game_master', () =>
        world.tables.game_masters.some((r) => same(r['user_id'], me()) && r['accepted_at'] != null),
      ),
      isTheSignedInAccountTheOverlord: rpc('is_site_admin', isTheOverlord),
      theGameMasterOfferMadeToThisAccount: query('from:game_masters', (id: string) => ({
        table: 'game_masters',
        op: 'select',
        columns: 'accepted_at',
        filters: [eq('user_id', id)],
        one: 'maybe',
      })),
      // as gm_accept_offer and gm_decline_offer (supabase/schemas/public/functions/), for the signed-in account
      answerTheGameMasterOffer: (answer: Parameters<Db['theRoles']['answerTheGameMasterOffer']>[0]) =>
        rpc<[], ADatabaseAnswer<null>>(answer, () => {
          const offers = world.tables.game_masters;
          const own = offers.find((r) => same(r['user_id'], me()));
          if (answer === 'gm_accept_offer') {
            if (!own) throw new Error('You have no offer to accept.');
            own['accepted_at'] ??= new Date().toISOString();
            return null;
          }
          if (!own || own['accepted_at'] != null) throw new Error('You have no offer to decline.');
          offers.splice(offers.indexOf(own), 1);
          return null;
        })(),
    },
    theReportedDispatches: {
      ...fake.db.theReportedDispatches,
      theDispatchesReportedToThisAccount: rpc('gm_reported_messages', (game: string | null) => {
        const t = world.tables;
        const mayGm = (g: unknown) =>
          t.games.some((x) => same(x['id'], g) && same(x['gm_user_id'], me())) &&
          !t.game_players.some((p) => same(p['game_id'], g) && same(p['user_id'], me()));
        return t.message_reports
          .map((r) => ({ r, m: t.game_messages.find((m) => same(m['id'], r['message_id'])) }))
          .filter(
            ({ m }) => m && (game == null || same(m['game_id'], game)) && (isTheOverlord() || mayGm(m['game_id'])),
          )
          .map(({ r, m }) => ({
            report_id: r['id'],
            message_id: m?.['id'],
            game_id: m?.['game_id'],
            turn: m?.['turn'],
            from_index: m?.['from_index'],
            to_indexes: m?.['to_indexes'],
            scope: m?.['scope'],
            body: m?.['body'],
            sent_at: m?.['created_at'],
            reporter_index: r['reporter_index'],
            reason: r['reason'],
            reported_at: r['created_at'],
          }));
      }),
      theDispatchesThisAccountReportedInThisGame: query('from:message_reports', (game: string) => ({
        table: 'message_reports',
        op: 'select',
        columns: 'message_id',
        filters: [eq('game_id', game)],
      })),
      reportThisDispatch: query('from:message_reports', (report: unknown) => ({
        table: 'message_reports',
        op: 'insert',
        payload: report,
      })),
    },
    thePlayersRealms: {
      thisAccountsRealmsAndTheirOrdersFlags: query('from:game_players', (account: string) => ({
        table: 'game_players',
        op: 'select',
        columns: 'id,game_id,player_index,orders_submitted',
        filters: [eq('user_id', account)],
      })),
      everyRealmOfThisAccount: query('from:game_players', (account: string) => ({
        table: 'game_players',
        op: 'select',
        columns: 'id,game_id,player_index,display_name,orders_submitted',
        filters: [eq('user_id', account)],
      })),
      theGamesOfThisAccountsRealms: query('from:game_players', (account: string) => ({
        table: 'game_players',
        op: 'select',
        columns: 'game_id',
        filters: [eq('user_id', account)],
      })),
      thisAccountsRealmsInThisGame: query('from:game_players', (game: string, account: string) => ({
        table: 'game_players',
        op: 'select',
        columns: 'id,player_index',
        filters: [eq('game_id', game), eq('user_id', account)],
      })),
      thisRealm: query('from:game_players', (id: string) => ({
        table: 'game_players',
        op: 'select',
        columns: 'id,game_id,player_index,orders_submitted,turn_report,orders',
        filters: [eq('id', id)],
        one: 'single',
      })),
      joinWithThisRealm: query('from:game_players', (realm: unknown) => ({
        table: 'game_players',
        op: 'insert',
        payload: realm,
        one: 'single',
      })),
      // as get_game_slots (supabase/schemas/public/functions/get_game_slots.sql): the realms of the games asked
      // about that the signed-in account runs, plays in or may join (a game in setup, public or inviting it)
      theSlotsOfTheseGames: rpc('get_game_slots', (games: readonly string[]) => {
        const t = world.tables;
        const parsed = (v: unknown): unknown => {
          if (typeof v !== 'string') return v ?? {};
          try {
            return JSON.parse(v);
          } catch {
            return {};
          }
        };
        const field = (o: unknown, key: string): unknown =>
          typeof o === 'object' && o !== null ? Reflect.get(o, key) : undefined;
        const mayRead = (g: ARowTheGameMastersWorldHolds): boolean => {
          const setup = parsed(g['game_state']);
          const invited = field(setup, 'invited');
          return (
            same(g['gm_user_id'], me()) ||
            isTheOverlord() ||
            t.game_players.some((p) => same(p['game_id'], g['id']) && same(p['user_id'], me())) ||
            (g['status'] === 'setup' &&
              (field(setup, 'visibility') !== 'private' || (Array.isArray(invited) && invited.includes(me()))))
          );
        };
        return t.games
          .filter((g) => games.some((id) => same(id, g['id'])) && mayRead(g))
          .flatMap((g) =>
            t.game_players
              .filter((p) => same(p['game_id'], g['id']))
              .map((p) => {
                const alignment = field(field(parsed(p['turn_report']), 'playerSetup'), 'alignment');
                return {
                  game_id: p['game_id'],
                  player_index: p['player_index'],
                  is_bot: !p['user_id'],
                  orders_submitted: !!p['orders_submitted'],
                  alignment:
                    g['status'] === 'setup' && typeof alignment === 'string' && alignment !== '' ? alignment : null,
                };
              }),
          );
      }),
    },
    thePlayersGames: {
      theTurnAndStateOfTheseGames: query('from:games', (games: readonly string[]) => ({
        table: 'games',
        op: 'select',
        columns: 'id,turn,status',
        filters: [inList('id', games)],
      })),
      theseGamesForTheirCards: query('from:games', (games: readonly string[]) => ({
        table: 'games',
        op: 'select',
        columns: 'id,name,gm_user_id,status,turn,max_players,created_at,meta',
        filters: [inList('id', games)],
      })),
      theseGamesEveryColumn: query('from:games', (games: readonly string[]) => ({
        table: 'games',
        op: 'select',
        columns: 'id,name,status,turn,game_state',
        filters: [inList('id', games)],
      })),
      theGamesInSetup: query('from:games', () => ({
        table: 'games',
        op: 'select',
        columns: 'id,name,gm_user_id,game_state,max_players',
        filters: [eq('status', 'setup')],
      })),
      thisGamesWorldAndState: query('from:games', (game: string) => ({
        table: 'games',
        op: 'select',
        columns: 'game_state,status',
        filters: [eq('id', game)],
        one: 'single',
      })),
      thisGameForItsReport: query('from:games', (game: string) => ({
        table: 'games',
        op: 'select',
        columns: 'id,name,gm_user_id,status,turn,max_players,block_eliminated_msgs',
        filters: [eq('id', game)],
        one: 'single',
      })),
      thisGameEveryColumn: query('from:games', (game: string) => ({
        table: 'games',
        op: 'select',
        columns: 'game_state',
        filters: [eq('id', game)],
        one: 'single',
      })),
    },
    theChroniclesLogs: {
      theLogOfThisRealmInThisTurn: query('from:turn_logs', (game: string, turn: number, realm: number) => ({
        table: 'turn_logs',
        op: 'select',
        columns: 'entries',
        filters: [eq('game_id', game), eq('turn', turn), eq('player_index', realm)],
        limit: 1,
      })),
    },
    // submit_orders answers as done and saves nothing (the screen tours, plan P1-17t; the player's world mirrors the
    // function's checks)
    theOrders: {
      saveThisRealmsDraft: rpc('submit_orders', () => null),
      saveThisRealmsHeroOrder: rpc('submit_orders', () => null),
      reopenThisRealmsOrders: rpc('submit_orders', () => null),
      submitThisRealmsOrders: rpc('submit_orders', () => null),
    },
    theDispatches: {
      ...fake.db.theDispatches,
      oneDispatchsId: query('from:game_messages', () => ({
        table: 'game_messages',
        op: 'select',
        columns: 'id',
        limit: 1,
      })),
      oneReadMarksGame: query('from:game_message_reads', () => ({
        table: 'game_message_reads',
        op: 'select',
        columns: 'game_id',
        limit: 1,
      })),
      deleteThisDispatch: query('from:game_messages', (id: number) => ({
        table: 'game_messages',
        op: 'delete',
        filters: [eq('id', id)],
      })),
      theNewestDispatchesOfThisGame: query('from:game_messages', (game: string, count: number) => ({
        table: 'game_messages',
        op: 'select',
        columns: A_DISPATCH,
        filters: [eq('game_id', game)],
        order: [['id', false]],
        limit: count,
      })),
      theDispatchesOfThisGameAfterThisOne: query(
        'from:game_messages',
        (game: string, after: number, count: number) => ({
          table: 'game_messages',
          op: 'select',
          columns: A_DISPATCH,
          filters: [eq('game_id', game), ['gt', 'id', after]],
          order: [['id', true]],
          limit: count,
        }),
      ),
      theDispatchesOfThisGameBeforeThisOne: query(
        'from:game_messages',
        (game: string, before: number, count: number) => ({
          table: 'game_messages',
          op: 'select',
          columns: A_DISPATCH,
          filters: [eq('game_id', game), ['lt', 'id', before]],
          order: [['id', false]],
          limit: count,
        }),
      ),
      theNewestDispatchesOfTheseGamesGamesAndRealms: query('from:game_messages', (games: readonly string[]) => ({
        table: 'game_messages',
        op: 'select',
        columns: 'id,game_id,from_index,to_indexes,scope',
        filters: [inList('game_id', games)],
        order: [['id', false]],
        limit: 3000,
      })),
      sendThisDispatch: query('from:game_messages', (dispatch: unknown) => ({
        table: 'game_messages',
        op: 'insert',
        payload: dispatch,
      })),
      thisRealmsReadMarksInThisGame: query('from:game_message_reads', (game: string, realm: number) => ({
        table: 'game_message_reads',
        op: 'select',
        columns: 'reads',
        filters: [eq('game_id', game), eq('player_index', realm)],
        one: 'maybe',
      })),
      thisAccountsReadMarksInTheseGames: query(
        'from:game_message_reads',
        (games: readonly string[], account: string) => ({
          table: 'game_message_reads',
          op: 'select',
          columns: 'game_id,player_index,reads',
          filters: [inList('game_id', games), eq('user_id', account)],
        }),
      ),
      writeTheseReadMarks: query('from:game_message_reads', (marks: unknown) => ({
        table: 'game_message_reads',
        op: 'upsert',
        payload: marks,
        onConflict: 'game_id,player_index',
      })),
    },
    theHallOfFame: {
      ...fake.db.theHallOfFame,
      oneEntrysGame: query('from:game_records', () => ({
        table: 'game_records',
        op: 'select',
        columns: 'game_id',
        limit: 1,
      })),
      theGameOfEveryEntry: query('from:game_records', () => ({
        table: 'game_records',
        op: 'select',
        columns: 'game_id',
      })),
      theGameMastersNotesOnThisGamesEntry: query('from:game_records', (game: string) => ({
        table: 'game_records',
        op: 'select',
        columns: 'note,hidden,game_name',
        filters: [eq('game_id', game)],
        one: 'maybe',
      })),
      writeTheseEntries: query('from:game_records', (entries: unknown) => ({
        table: 'game_records',
        op: 'upsert',
        payload: entries,
        onConflict: 'game_id',
      })),
      deleteTheseGamesEntries: query('from:game_records', (games: readonly string[]) => ({
        table: 'game_records',
        op: 'delete',
        filters: [inList('game_id', games)],
      })),
    },
    theStatistics: {
      ...fake.db.theStatistics,
      oneTurnRecordsId: query('from:turn_events', () => ({
        table: 'turn_events',
        op: 'select',
        columns: 'id',
        limit: 1,
      })),
      oneGameResultsId: query('from:game_results', () => ({
        table: 'game_results',
        op: 'select',
        columns: 'id',
        limit: 1,
      })),
      theResultsOfThisGame: query('from:game_results', (game: string) => ({
        table: 'game_results',
        op: 'select',
        columns: '*',
        filters: [eq('game_id', game)],
      })),
      thisGamesTurnRecordsForItsEntryFromRowToRow: query(
        'from:turn_events',
        (game: string, from: number, to: number) => ({
          table: 'turn_events',
          op: 'select',
          columns: 'turn,player_index,is_bot,realm,race,alignment,post,outcomes',
          filters: [eq('game_id', game)],
          order: [
            ['turn', true],
            ['player_index', true],
          ],
          range: [from, to],
        }),
      ),
      theGameOfEveryResultFromRowToRow: query('from:game_results', (from: number, to: number) => ({
        table: 'game_results',
        op: 'select',
        columns: 'game_id',
        order: [
          ['game_id', true],
          ['player_index', true],
        ],
        range: [from, to],
      })),
      everyTurnRecordFromRowToRow: query('from:turn_events', (from: number, to: number) => ({
        table: 'turn_events',
        op: 'select',
        columns: 'game_id,turn,player_index,is_bot,bot_difficulty,realm,race,alignment,orders,pre,post,outcomes',
        order: [
          ['game_id', true],
          ['turn', true],
          ['player_index', true],
        ],
        range: [from, to],
      })),
      everyResultFromRowToRow: query('from:game_results', (from: number, to: number) => ({
        table: 'game_results',
        op: 'select',
        columns: '*',
        range: [from, to],
      })),
      deleteTheseGamesResults: query('from:game_results', (games: readonly string[]) => ({
        table: 'game_results',
        op: 'delete',
        filters: [inList('game_id', games)],
      })),
      deleteTheseGamesTurnRecords: query('from:turn_events', (games: readonly string[]) => ({
        table: 'turn_events',
        op: 'delete',
        filters: [inList('game_id', games)],
      })),
      writeTheseResults: query('from:game_results', (results: unknown) => ({
        table: 'game_results',
        op: 'upsert',
        payload: results,
        onConflict: 'game_id,player_index',
      })),
      writeTheseTurnRecords: query('from:turn_events', (records: unknown) => ({
        table: 'turn_events',
        op: 'upsert',
        payload: records,
        onConflict: 'game_id,turn,player_index',
      })),
      theGamesOfTheseGamesResults: query('from:game_results', (games: readonly string[]) => ({
        table: 'game_results',
        op: 'select',
        columns: 'game_id',
        filters: [inList('game_id', games)],
      })),
    },
    theHallOfFamesGames: {
      ...fake.db.theHallOfFamesGames,
      thisGameWithItsWorldAndRealms: query('from:games', (game: string) => ({
        table: 'games',
        op: 'select',
        columns:
          'id,name,gm_user_id,created_at,max_turns,meta,game_state,game_players(id,player_index,user_id,display_name)',
        filters: [eq('id', game)],
        one: 'maybe',
      })),
      theFinishedGamesThisGameMasterRuns: query('from:games', (gameMaster: string) => ({
        table: 'games',
        op: 'select',
        columns: 'id,name,gm_user_id,created_at,max_turns,meta',
        filters: [eq('gm_user_id', gameMaster), eq('status', 'complete')],
      })),
      everyGamesNameStatusAndTurn: query('from:games', () => ({
        table: 'games',
        op: 'select',
        columns: 'id,name,status,turn',
      })),
      theNameStatusAndTurnOfTheGamesThisGameMasterRuns: query('from:games', (gameMaster: string) => ({
        table: 'games',
        op: 'select',
        columns: 'id,name,status,turn',
        filters: [eq('gm_user_id', gameMaster)],
      })),
      whichOfTheseGamesStillExist: query('from:games', (games: readonly string[]) => ({
        table: 'games',
        op: 'select',
        columns: 'id',
        filters: [inList('id', games)],
      })),
      theIdNameAndStateOfTheFinishedGamesThisGameMasterRuns: query('from:games', (gameMaster: string) => ({
        table: 'games',
        op: 'select',
        columns: 'id,name,status',
        filters: [eq('gm_user_id', gameMaster), eq('status', 'complete')],
      })),
      thisGamesIdNameAndWorldWithEveryColumnOfItsRealms: query('from:games', (game: string) => ({
        table: 'games',
        op: 'select',
        columns: 'id,name,game_state,game_players(*)',
        filters: [eq('id', game)],
        one: 'single',
      })),
    },
    theGameMastersGames: {
      ...fake.db.theGameMastersGames,
      oneGamesMeta: query('from:games', () => ({ table: 'games', op: 'select', columns: 'id,meta', limit: 1 })),
      theGamesThisGameMasterRunsNewestFirst: query('from:games', (gameMaster: string) => ({
        table: 'games',
        op: 'select',
        columns: A_GAME_IN_THE_LIST,
        filters: [eq('gm_user_id', gameMaster)],
        order: newestFirst,
      })),
      theGamesThisGameMasterRunsNewestFirstEveryColumn: query('from:games', (gameMaster: string) => ({
        table: 'games',
        op: 'select',
        columns: '*, game_players(*)',
        filters: [eq('gm_user_id', gameMaster)],
        order: newestFirst,
      })),
      everyGameNewestFirstFromRowToRow: query('from:games', (from: number, to: number) => ({
        table: 'games',
        op: 'select',
        columns: A_GAME_IN_THE_LIST,
        order: newestFirst,
        range: [from, to],
      })),
      everyGameNewestFirstFromRowToRowEveryColumn: query('from:games', (from: number, to: number) => ({
        table: 'games',
        op: 'select',
        columns: '*, game_players(*)',
        order: newestFirst,
        range: [from, to],
      })),
      theActiveGamesThisGameMasterRuns: query('from:games', (gameMaster: string) => ({
        table: 'games',
        op: 'select',
        columns: A_GAME_IN_THE_LIST,
        filters: [eq('gm_user_id', gameMaster), eq('status', 'active')],
      })),
      theActiveGamesThisGameMasterRunsEveryColumn: query('from:games', (gameMaster: string) => ({
        table: 'games',
        op: 'select',
        columns: '*, game_players(*)',
        filters: [eq('gm_user_id', gameMaster), eq('status', 'active')],
      })),
      thisGameWithItsRealms: query('from:games', (game: string) => ({
        table: 'games',
        op: 'select',
        columns: '*, game_players(*)',
        filters: [eq('id', game)],
        one: 'single',
      })),
      makeThisGame: query('from:games', (game: unknown) => ({
        table: 'games',
        op: 'insert',
        payload: game,
        one: 'single',
      })),
      thisGamesTurnAndWorld: query('from:games', (game: string) => ({
        table: 'games',
        op: 'select',
        columns: 'id,turn,game_state',
        filters: [eq('id', game)],
        one: 'single',
      })),
      theGamesThisGameMasterRunsWithNoMeta: query('from:games', (gameMaster: string) => ({
        table: 'games',
        op: 'select',
        columns: 'id,game_state',
        filters: [eq('gm_user_id', gameMaster), ['is', 'meta', null]],
      })),
      changeThisGame: query('from:games', (game: string, change: unknown) => ({
        table: 'games',
        op: 'update',
        payload: change,
        filters: [eq('id', game)],
      })),
      changeThisGameAndAnswerItsId: query('from:games', (game: string, change: unknown) => ({
        table: 'games',
        op: 'update',
        payload: change,
        filters: [eq('id', game)],
        one: 'maybe',
      })),
      changeThisGameWhileOnThisTurnAndAnswerItsId: query(
        'from:games',
        (game: string, turn: number, change: unknown) => ({
          table: 'games',
          op: 'update',
          payload: change,
          filters: [eq('id', game), eq('turn', turn)],
          one: 'maybe',
        }),
      ),
      keepTheRealmsThatAreOutOfThisGameFromSendingDispatches: query('from:games', (game: string, keep: boolean) => ({
        table: 'games',
        op: 'update',
        payload: { block_eliminated_msgs: keep },
        filters: [eq('id', game)],
        one: 'maybe',
      })),
    },
    theGameMastersRealms: {
      removeThisRealm: query('from:game_players', (realm: string) => ({
        table: 'game_players',
        op: 'delete',
        filters: [eq('id', realm)],
      })),
    },
    theGameMastersTurnLogs: {
      theWholeLogOfThisGameInThisTurn: query('from:turn_logs', (game: string, turn: number) => ({
        table: 'turn_logs',
        op: 'select',
        columns: '*',
        filters: [eq('game_id', game), eq('turn', turn), eq('player_index', -1)],
      })),
    },
    theDeletionOfAGame: {
      removeThisGamesTurnLogs: query('from:turn_logs', (game: string) => ({
        table: 'turn_logs',
        op: 'delete',
        filters: [eq('game_id', game)],
      })),
      removeThisGamesDispatches: query('from:game_messages', (game: string) => ({
        table: 'game_messages',
        op: 'delete',
        filters: [eq('game_id', game)],
      })),
      removeThisGamesReadMarks: query('from:game_message_reads', (game: string) => ({
        table: 'game_message_reads',
        op: 'delete',
        filters: [eq('game_id', game)],
      })),
      removeThisGamesTurnEvents: query('from:turn_events', (game: string) => ({
        table: 'turn_events',
        op: 'delete',
        filters: [eq('game_id', game)],
      })),
      removeThisGamesResults: query('from:game_results', (game: string) => ({
        table: 'game_results',
        op: 'delete',
        filters: [eq('game_id', game)],
      })),
      removeThisGamesHallOfFameEntry: query('from:game_records', (game: string) => ({
        table: 'game_records',
        op: 'delete',
        filters: [eq('game_id', game)],
      })),
      removeThisGamesRealms: query('from:game_players', (game: string) => ({
        table: 'game_players',
        op: 'delete',
        filters: [eq('game_id', game)],
      })),
      removeThisGame: query('from:games', (game: string) => ({
        table: 'games',
        op: 'delete',
        filters: [eq('id', game)],
      })),
    },
    theTurnAsTheGameMasterRunsIt: {
      thisGameEveryColumn: query('from:games', (game: string) => ({
        table: 'games',
        op: 'select',
        columns: '*',
        filters: [eq('id', game)],
        one: 'single',
      })),
      everyRealmOfThisGame: query('from:game_players', (game: string) => ({
        table: 'game_players',
        op: 'select',
        columns: '*',
        filters: [eq('game_id', game)],
      })),
      clearTheOrdersOfEveryRealmOfThisGame: query('from:game_players', (game: string) => ({
        table: 'game_players',
        op: 'update',
        payload: { orders: null, orders_submitted: false },
        filters: [eq('game_id', game)],
      })),
      saveThisGameWhileOnThisTurnAndAnswerItsId: query('from:games', (game: string, turn: number, change: unknown) => ({
        table: 'games',
        op: 'update',
        payload: change,
        filters: [eq('id', game), eq('turn', turn)],
        one: 'maybe',
      })),
      giveThisRealmItsTurnReport: query('from:game_players', (realm: string, report: string) => ({
        table: 'game_players',
        op: 'update',
        payload: { turn_report: report },
        filters: [eq('id', realm)],
      })),
      writeThisLog: query('from:turn_logs', (log: unknown) => ({ table: 'turn_logs', op: 'insert', payload: log })),
      theTurnOfThisGameIfItIsThere: query('from:games', (game: string) => ({
        table: 'games',
        op: 'select',
        columns: 'turn',
        filters: [eq('id', game)],
        one: 'maybe',
      })),
      putBackThisRealmsOrders: query('from:game_players', (realm: string, orders: unknown, submitted: boolean) => ({
        table: 'game_players',
        op: 'update',
        payload: { orders, orders_submitted: submitted },
        filters: [eq('id', realm)],
      })),
    },
    theTurnZeroAsTheGameMasterRunsIt: {
      everyRealmOfThisGame: query('from:game_players', (game: string) => ({
        table: 'game_players',
        op: 'select',
        columns: '*',
        filters: [eq('game_id', game)],
      })),
      removeEveryBotsRealmOfThisGame: query('from:game_players', (game: string) => ({
        table: 'game_players',
        op: 'delete',
        filters: [eq('game_id', game), ['is', 'user_id', null]],
      })),
      makeThisBotsRealm: query('from:game_players', (realm: unknown) => ({
        table: 'game_players',
        op: 'insert',
        payload: realm,
        one: 'single',
      })),
      startThisGame: query('from:games', (game: string, change: unknown) => ({
        table: 'games',
        op: 'update',
        payload: change,
        filters: [eq('id', game)],
      })),
      giveThisRealmItsFirstReport: query('from:game_players', (realm: string, report: string) => ({
        table: 'game_players',
        op: 'update',
        payload: { turn_report: report, orders: null, orders_submitted: false },
        filters: [eq('id', realm)],
      })),
      writeThisLog: query('from:turn_logs', (log: unknown) => ({ table: 'turn_logs', op: 'insert', payload: log })),
      thisGameWithItsRealms: query('from:games', (game: string) => ({
        table: 'games',
        op: 'select',
        columns: '*, game_players(*)',
        filters: [eq('id', game)],
        one: 'single',
      })),
    },
  };
  return { db, calls };
}

/** The Overlord's world as a spec hands it to Chromium, as data: the role checks that get no answer as a list. */
export type TheOverlordsWorldAsData = Omit<TheOverlordsWorld, 'failingChecks'> & {
  readonly failingChecks: readonly string[];
};
/** One of the worlds above as data (JSON brought it: a browser spec's init script, a screen tour): the player's, the
 *  GM's, the Hall of Fame's or the Overlord's. */
export type AWorldAsData =
  ThePlayersWorld | TheGameMastersWorldAsData | TheHallOfFamesWorldAsData | TheOverlordsWorldAsData;

const isAnObject = (v: unknown): v is object => typeof v === 'object' && v !== null;
const holdsLists = (world: object, keys: readonly string[]): boolean =>
  keys.every((k) => Array.isArray(Reflect.get(world, k)));
/** The list `world` holds under `key` (none: empty). */
const theListUnder = (world: object, key: string): unknown[] => {
  const list: unknown = Reflect.get(world, key);
  return Array.isArray(list) ? (list as unknown[]) : [];
};

/** A fake database, up to date at `version`, holding `world`, a world as data told apart by what it holds (the GM's:
 *  tables and the missing columns and tables as lists; the player's: names, games, realms and the reads of other
 *  accounts' realms; the Hall of Fame's: its entries and the changes sent; the Overlord's: the Overlord, the accounts
 *  and the role checks that fail), made whole (its lists made sets, its entries read through a function); none, or one
 *  of no kind: the fake holding no account. `world` is the world the fake holds, for a test or spec to stage and read
 *  back (the one handed in, made whole in place), or null. */
export function makeAFakeDbHoldingAWorldHandedAsData(
  version: string,
  handed: unknown,
): { readonly fake: AFakeDb; readonly world: object | null } {
  if (!isAnObject(handed)) return { fake: makeAFakeDb([version]), world: null };
  const tables: unknown = Reflect.get(handed, 'tables');
  if (isAnObject(tables) && holdsLists(handed, ['missingColumns', 'missingTables'])) {
    const sets = {
      missingColumns: new Set(theListUnder(handed, 'missingColumns').map(String)),
      missingTables: new Set(theListUnder(handed, 'missingTables').map(String)),
    };
    // the rest of the world as handed (its tables, `me`, `failing`, `calls`), its two lists made sets
    const world = Object.assign(handed, sets) as TheGameMastersWorld;
    return { fake: makeAFakeDbHoldingTheGameMastersWorld(version, world), world };
  }
  if (holdsLists(handed, ['names', 'games', 'realms', 'readsOfAnotherAccountsRealms'])) {
    const world = handed as ThePlayersWorld;
    return { fake: makeAFakeDbHoldingThePlayersWorld(version, world), world };
  }
  if (holdsLists(handed, ['rows', 'changes'])) {
    const data = handed as TheHallOfFamesWorldAsData;
    const world: TheHallOfFamesWorld = { ...data, rows: () => data.rows };
    return { fake: makeAFakeDbHoldingTheHallOfFame(version, world), world };
  }
  if (typeof Reflect.get(handed, 'overlord') === 'string' && holdsLists(handed, ['accounts', 'failingChecks'])) {
    const failingChecks = new Set(theListUnder(handed, 'failingChecks').map(String));
    const world = Object.assign(handed, { failingChecks }) as TheOverlordsWorld;
    return { fake: makeAFakeDbHoldingTheOverlordsWorld(version, world), world };
  }
  return { fake: makeAFakeDb([version]), world: null };
}
