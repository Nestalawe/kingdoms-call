// The database access layer's one interface, Db (plan P1-17, Decision 4): one object of areas, each a few functions,
// made from the page's client by makeTheDbFromItsClient. A page calls the database only through Db (its calls still on
// `sb` move here area by area, P1-17's area rows); the tests hand a page their fake of it (tests/lib/fake-db.ts,
// through the-pages-database-client.ts). A Db function sends the query the page sent before, and answers as
// supabase-js does ({ data, error } and the status), so a page's error paths stay as they are. The client and the
// tables are typed by the generated types (database.types.ts: npx supabase gen types typescript --local, then
// Prettier; never edited by hand), so a misspelt table, column or function is a compiler error.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

type TheGeneratedTables = Database['public']['Tables'];
/** A dispatch as the Dispatches panel sends it: its sender's account `null` when no account is signed in (the database
 *  then refuses it, as the column takes none). */
type ANewDispatch = Omit<TheGeneratedTables['game_messages']['Insert'], 'from_user_id'> & {
  from_user_id?: string | null;
};

/** The generated types, but for a database function's argument that takes null on purpose (the generator writes every
 *  argument as never null): account_suspend's p_until (null: until the suspension is lifted) and gm_reported_messages'
 *  p_game (null: every game's); and a dispatch's sender, which the page may send as null (`ANewDispatch`). */
export type TheDatabase = Omit<Database, 'public'> & {
  readonly public: Omit<Database['public'], 'Functions' | 'Tables'> & {
    readonly Tables: Omit<TheGeneratedTables, 'game_messages'> & {
      readonly game_messages: Omit<TheGeneratedTables['game_messages'], 'Insert'> & { Insert: ANewDispatch };
    };
    readonly Functions: Omit<Database['public']['Functions'], 'account_suspend' | 'gm_reported_messages'> & {
      readonly account_suspend: { Args: { p_user: string; p_until: string | null }; Returns: undefined };
      readonly gm_reported_messages: {
        Args: { p_game: string | null };
        Returns: Database['public']['Functions']['gm_reported_messages']['Returns'];
      };
    };
  };
};

/** The page's database client (supabase-js), typed by the generated types. */
export type TheDatabaseClient = SupabaseClient<TheDatabase>;

/** What a Db function answers, as supabase-js answers it: the data, or the error, and the HTTP status (0: no answer at
 *  all, as the version guard writes a call that threw). */
export interface ADatabaseAnswer<T> {
  readonly data: T | null;
  readonly error: { readonly message: string } | null;
  readonly status: number;
}

/** A sign-in's error, as supabase-js's sign-in (auth) hands it on: the pages read its message. */
export interface ASignInError {
  readonly message: string;
}

/** An account, as the sign-in hands it to the page: its id, its address and what it was signed up with (the name it
 *  gave, `display_name`). */
export interface TheSignedInAccount {
  readonly id: string;
  readonly email?: string | undefined;
  readonly user_metadata: Readonly<Record<string, unknown>>;
}

/** A sign-in session: the account signed in. */
export interface ASignInSession {
  readonly user: TheSignedInAccount;
}

/** What auth.getSession() answers: the session this browser keeps, or none. */
export interface TheSessionAnswer {
  readonly data: { readonly session: ASignInSession | null };
  readonly error: ASignInError | null;
}

/** What signing in or up answers: the account and its session (no session: an account still to be confirmed). */
export interface ASignInAnswer {
  readonly data: { readonly user: TheSignedInAccount | null; readonly session: ASignInSession | null };
  readonly error: ASignInError | null;
}

/** What auth.updateUser() answers: the account as changed. */
export interface AnAccountChangedAnswer {
  readonly data: { readonly user: TheSignedInAccount | null };
  readonly error: ASignInError | null;
}

/** What auth.signOut() answers. */
export interface ASignOutAnswer {
  readonly error: ASignInError | null;
}

/** An account's name, as profiles holds it (never its email: P0-31). */
export interface AnAccountsName {
  readonly id: string;
  readonly name: string | null;
}

/** An account's name and the day it joined. */
export interface AnAccountsNameAndJoiningDate extends AnAccountsName {
  readonly created_at: string | null;
}

/** The two answers to a Game Master offer (P0-32b): the database functions that give them. */
export type AnAnswerToTheGameMasterOffer = 'gm_accept_offer' | 'gm_decline_offer';

/** An account, as the Overlord's list of them gives it (overlord_accounts(), P0-32b and P0-32h): its sign-in's
 *  address, days and suspension, its name, its Game Master role ('game_master', 'offered' or 'none') and its games. */
export interface AnAccountAsTheOverlordSeesIt {
  readonly user_id: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly joined: string;
  readonly last_sign_in: string | null;
  readonly gm_status: string;
  readonly games_run: number;
  readonly games_played: number;
  readonly suspended_until: string | null;
}

/** A game, as the Overlord's list of every game gives it: its light columns, never the world. */
export type AGameAsTheOverlordListsIt = Pick<
  Database['public']['Tables']['games']['Row'],
  'id' | 'name' | 'gm_user_id' | 'status' | 'turn' | 'max_turns' | 'created_at' | 'meta'
>;

/** A realm's name in its game. */
export type ARealmsName = Pick<
  Database['public']['Tables']['game_players']['Row'],
  'game_id' | 'player_index' | 'display_name'
>;

/** A table's row, its new row and its change, as the generated types give them. */
type ARow<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
type ANewRow<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
type AChange<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

/** A Hall of Fame entry (game_records): one finished game's row, as the GM page built it. */
export type AHallOfFameEntry = ARow<'game_records'>;

/** A Hall of Fame entry's notes a Game Master keeps when the entry is built again. */
export type AHallOfFameEntrysGameMasterNotes = Pick<ARow<'game_records'>, 'note' | 'hidden' | 'game_name'>;

/** A realm's result in a finished game (game_results). */
export type AGameResult = ARow<'game_results'>;

/** A realm's turn, as a Hall of Fame entry reads it from the statistics (turn_events). */
export type ATurnRecordForTheHallOfFame = Pick<
  ARow<'turn_events'>,
  'turn' | 'player_index' | 'is_bot' | 'realm' | 'race' | 'alignment' | 'post' | 'outcomes'
>;

/** A realm's turn, as the Stats tab reads it (turn_events). */
export type ATurnRecordForTheStatsTab = Pick<
  ARow<'turn_events'>,
  | 'game_id'
  | 'turn'
  | 'player_index'
  | 'is_bot'
  | 'bot_difficulty'
  | 'realm'
  | 'race'
  | 'alignment'
  | 'orders'
  | 'pre'
  | 'post'
  | 'outcomes'
>;

/** A game, with its world and its realms, as a Hall of Fame entry is built from it. */
export type AGameForItsHallOfFameEntry = Pick<
  ARow<'games'>,
  'id' | 'name' | 'gm_user_id' | 'created_at' | 'max_turns' | 'meta' | 'game_state'
> & {
  readonly game_players: Pick<ARow<'game_players'>, 'id' | 'player_index' | 'user_id' | 'display_name'>[];
};

/** A finished game, as the Hall of Fame's rebuild lists it: its light columns, never the world. */
export type AFinishedGameForTheHallOfFame = Pick<
  ARow<'games'>,
  'id' | 'name' | 'gm_user_id' | 'created_at' | 'max_turns' | 'meta'
>;

/** A game's name, state and turn, as the Stats tab names it. */
export type AGamesNameStatusAndTurn = Pick<ARow<'games'>, 'id' | 'name' | 'status' | 'turn'>;

/** A dispatch (game_messages), as the Dispatches panel reads it: never its sender's account. */
export type ADispatch = Pick<
  ARow<'game_messages'>,
  'id' | 'turn' | 'from_index' | 'to_indexes' | 'scope' | 'body' | 'created_at'
>;

/** A dispatch's game, sender and addressees, as a game card counts its unread dispatches: never its words. */
export type ADispatchsGameAndRealms = Pick<
  ARow<'game_messages'>,
  'id' | 'game_id' | 'from_index' | 'to_indexes' | 'scope'
>;

/** A realm's read marks in a game (game_message_reads): the last dispatch it has seen in each channel. */
export type ARealmsReadMarks = Pick<ARow<'game_message_reads'>, 'game_id' | 'player_index' | 'reads'>;

/** A reported dispatch, as gm_reported_messages() answers it: the dispatch, its report and its reporter. */
export type AReportedDispatch = Database['public']['Functions']['gm_reported_messages']['Returns'][number];

/** A realm (game_players: one row a realm a game), every column, as its own player or the game's GM reads it. */
export type ARealm = ARow<'game_players'>;

/** A realm's slot in its game, as get_game_slots() answers it to anyone who may see the game: never its player. */
export type ARealmsSlot = Database['public']['Functions']['get_game_slots']['Returns'][number];

/** A game (games), every column, its world (game_state) among them. */
export type AGame = ARow<'games'>;

/** A game's light columns, as the player's game cards read them: never the world. */
export type AGameForItsCard = Pick<
  AGame,
  'id' | 'name' | 'gm_user_id' | 'status' | 'turn' | 'max_players' | 'created_at' | 'meta'
>;

/** A game's columns the report screen reads: never the world. */
export type AGameForItsReport = Pick<
  AGame,
  'id' | 'name' | 'gm_user_id' | 'status' | 'turn' | 'max_players' | 'block_eliminated_msgs'
>;

/** A turn's log (turn_logs: one row a game, turn and realm; realm -1, the GM's whole log), every column. */
export type ATurnsLog = ARow<'turn_logs'>;

/** A game in the GM page's list, its light columns and its realms' (games.meta there): never the world or a report. */
export type AGameInTheGameMastersList = Pick<
  AGame,
  'id' | 'name' | 'gm_user_id' | 'status' | 'turn' | 'max_players' | 'max_turns' | 'created_at' | 'meta'
> & {
  readonly game_players: Pick<
    ARealm,
    'id' | 'game_id' | 'user_id' | 'player_index' | 'display_name' | 'orders_submitted'
  >[];
};

/** A game, every column, with every column of its realms (the GM page's game screen; its list without games.meta). */
export type AGameWithItsRealms = AGame & { readonly game_players: ARealm[] };

/** The database, as the pages reach it: one area a row of P1-17. */
export interface Db {
  /** The version guard's (src/db/kc-db-guard.ts, P0-34). */
  readonly theDatabasesVersion: {
    /** kc_db_version(): the newest migration the database has applied, its 14-digit version. */
    readonly askTheDatabaseItsVersion: () => PromiseLike<ADatabaseAnswer<string>>;
  };
  /** Signing in, up and out, and changing the signed-in account (supabase-js's auth; the four pages). */
  readonly signingIn: {
    /** auth.getSession(): the session this browser keeps, if any. */
    readonly theSessionKeptInThisBrowser: () => PromiseLike<TheSessionAnswer>;
    /** auth.signInWithPassword(). */
    readonly signInWithEmailAndPassword: (email: string, password: string) => PromiseLike<ASignInAnswer>;
    /** auth.signUp(), the name kept with the sign-in as `display_name` (the profile's first name: handle_new_user). */
    readonly signUpWithEmailPasswordAndName: (
      email: string,
      password: string,
      name: string,
    ) => PromiseLike<ASignInAnswer>;
    /** auth.signOut(). */
    readonly signOut: () => PromiseLike<ASignOutAnswer>;
    /** auth.updateUser(): the signed-in account's new password. */
    readonly changeThePassword: (password: string) => PromiseLike<AnAccountChangedAnswer>;
    /** auth.updateUser(): the name kept with the sign-in (`display_name`), in step with the profile's. */
    readonly changeTheNameKeptWithTheSignIn: (name: string) => PromiseLike<AnAccountChangedAnswer>;
  };
  /** The accounts' names (profiles: id, name and the day it joined, never the email, a column privilege: P0-31). */
  readonly theAccountsNames: {
    /** The names of the accounts `ids`. */
    readonly theNamesOfTheseAccounts: (ids: readonly string[]) => PromiseLike<ADatabaseAnswer<AnAccountsName[]>>;
    /** The name of every account the signed-in one may read. */
    readonly theNameOfEveryAccount: () => PromiseLike<ADatabaseAnswer<AnAccountsName[]>>;
    /** The name and joining day of every account the signed-in one may read, in the names' order. */
    readonly theNameAndJoiningDateOfEveryAccountInNameOrder: () => PromiseLike<
      ADatabaseAnswer<AnAccountsNameAndJoiningDate[]>
    >;
    /** The name of the account `id`, its one row (an error when there is none). */
    readonly theNameOfThisAccount: (id: string) => PromiseLike<ADatabaseAnswer<AnAccountsName>>;
    /** Gives the account `id` the name `name`: its row made, or renamed (an account from before the profiles trigger
     *  has none). */
    readonly giveThisAccountItsName: (id: string, name: string) => PromiseLike<ADatabaseAnswer<null>>;
  };
  /** The signed-in account's roles (P0-32b): a Game Master, the Overlord, and the Game Master offer made to it. */
  readonly theRoles: {
    /** is_game_master(): an accepted offer. */
    readonly isTheSignedInAccountAGameMaster: () => PromiseLike<ADatabaseAnswer<boolean>>;
    /** is_site_admin(): the site's Overlord. */
    readonly isTheSignedInAccountTheOverlord: () => PromiseLike<ADatabaseAnswer<boolean>>;
    /** The account `id`'s Game Master offer (its game_masters row), if it has one: when it was accepted. */
    readonly theGameMasterOfferMadeToThisAccount: (
      id: string,
    ) => PromiseLike<ADatabaseAnswer<{ readonly accepted_at: string | null }>>;
    /** The signed-in account's answer to its own offer: gm_accept_offer() or gm_decline_offer(). */
    readonly answerTheGameMasterOffer: (answer: AnAnswerToTheGameMasterOffer) => PromiseLike<ADatabaseAnswer<unknown>>;
  };
  /** The Overlord's accounts (P0-32b, P0-32h): each a database function that refuses anyone but the Overlord. */
  readonly theOverlordsAccounts: {
    /** overlord_accounts(): every account, oldest first. */
    readonly everyAccountAsTheOverlordSeesIt: () => PromiseLike<ADatabaseAnswer<AnAccountAsTheOverlordSeesIt[]>>;
    /** account_suspend(): the account `user` can't sign in until `until` (null: until it is lifted). */
    readonly suspendThisAccountUntil: (user: string, until: string | null) => PromiseLike<ADatabaseAnswer<unknown>>;
    /** account_unsuspend(): the account `user` can sign in again. */
    readonly liftThisAccountsSuspension: (user: string) => PromiseLike<ADatabaseAnswer<unknown>>;
    /** account_delete(): the account `user` deleted (refused while it runs or plays in an unfinished game). */
    readonly deleteThisAccount: (user: string) => PromiseLike<ADatabaseAnswer<unknown>>;
    /** gm_offer(): Game Master offered to the account `user`. */
    readonly offerThisAccountGameMaster: (user: string) => PromiseLike<ADatabaseAnswer<unknown>>;
    /** gm_withdraw_offer(): the open offer to the account `user` withdrawn. */
    readonly withdrawTheGameMasterOfferToThisAccount: (user: string) => PromiseLike<ADatabaseAnswer<unknown>>;
    /** gm_revoke(): the account `user` no longer a Game Master (refused while it runs an unfinished game). */
    readonly revokeThisAccountsGameMaster: (user: string) => PromiseLike<ADatabaseAnswer<unknown>>;
  };
  /** The Overlord's games (P0-32e): every game, handing one over, and the realms' names of the games it lists. */
  readonly theOverlordsGames: {
    /** Every game the signed-in account may read, newest first, its rows `from` to `to` (both counted, from 0): the
     *  light columns only. */
    readonly everyGameNewestFirstFromRowToRow: (
      from: number,
      to: number,
    ) => PromiseLike<ADatabaseAnswer<AGameAsTheOverlordListsIt[]>>;
    /** reassign_game(): the game `game` run by the Game Master `gameMaster` from now on. */
    readonly handThisGameToThisGameMaster: (game: string, gameMaster: string) => PromiseLike<ADatabaseAnswer<unknown>>;
    /** The names of the realms of the games `games`, as the signed-in account may read them. */
    readonly theRealmsNamesOfTheseGames: (games: readonly string[]) => PromiseLike<ADatabaseAnswer<ARealmsName[]>>;
  };
  /** The Hall of Fame (game_records: one entry a finished game, built by the GM page; the leaderboard reads it). */
  readonly theHallOfFame: {
    /** One entry's game, if any: the probe that the table is there. */
    readonly oneEntrysGame: () => PromiseLike<ADatabaseAnswer<Pick<AHallOfFameEntry, 'game_id'>[]>>;
    /** Every entry, the newest finished first, its rows `from` to `to` (both counted, from 0). */
    readonly everyEntryNewestFinishedFirstFromRowToRow: (
      from: number,
      to: number,
    ) => PromiseLike<ADatabaseAnswer<AHallOfFameEntry[]>>;
    /** The game of every entry. */
    readonly theGameOfEveryEntry: () => PromiseLike<ADatabaseAnswer<Pick<AHallOfFameEntry, 'game_id'>[]>>;
    /** The Game Master's notes on the game `game`'s entry, if it has one. */
    readonly theGameMastersNotesOnThisGamesEntry: (
      game: string,
    ) => PromiseLike<ADatabaseAnswer<AHallOfFameEntrysGameMasterNotes>>;
    /** The entries `entries` written, each over its game's entry if there is one. */
    readonly writeTheseEntries: (entries: readonly ANewRow<'game_records'>[]) => PromiseLike<ADatabaseAnswer<null>>;
    /** The game `game`'s entry changed by `change`. */
    readonly changeThisGamesEntry: (
      game: string,
      change: AChange<'game_records'>,
    ) => PromiseLike<ADatabaseAnswer<null>>;
    /** The game `game`'s entry deleted. */
    readonly deleteThisGamesEntry: (game: string) => PromiseLike<ADatabaseAnswer<null>>;
    /** The entries of the games `games` deleted. */
    readonly deleteTheseGamesEntries: (games: readonly string[]) => PromiseLike<ADatabaseAnswer<null>>;
    /** rename_player(): the person `user` (profiles.name, on every game they played) renamed `name`; the Overlord only. */
    readonly renameThisPlayer: (user: string, name: string) => PromiseLike<ADatabaseAnswer<unknown>>;
  };
  /** The statistics (turn_events: one row a realm a turn; game_results: one a realm a finished game). */
  readonly theStatistics: {
    /** One turn record's id: the probe that turn_events is there. */
    readonly oneTurnRecordsId: () => PromiseLike<ADatabaseAnswer<Pick<ARow<'turn_events'>, 'id'>[]>>;
    /** One game result's id: the probe that game_results is there. */
    readonly oneGameResultsId: () => PromiseLike<ADatabaseAnswer<Pick<AGameResult, 'id'>[]>>;
    /** The game `game`'s results. */
    readonly theResultsOfThisGame: (game: string) => PromiseLike<ADatabaseAnswer<AGameResult[]>>;
    /** The game `game`'s turn records, as its Hall of Fame entry reads them, by turn and realm, its rows `from` to
     *  `to`. */
    readonly thisGamesTurnRecordsForItsEntryFromRowToRow: (
      game: string,
      from: number,
      to: number,
    ) => PromiseLike<ADatabaseAnswer<ATurnRecordForTheHallOfFame[]>>;
    /** The game of every result, by game and realm, its rows `from` to `to`. */
    readonly theGameOfEveryResultFromRowToRow: (
      from: number,
      to: number,
    ) => PromiseLike<ADatabaseAnswer<Pick<AGameResult, 'game_id'>[]>>;
    /** Every turn record, as the Stats tab reads it, by game, turn and realm, its rows `from` to `to`. */
    readonly everyTurnRecordFromRowToRow: (
      from: number,
      to: number,
    ) => PromiseLike<ADatabaseAnswer<ATurnRecordForTheStatsTab[]>>;
    /** Every game result, its rows `from` to `to`. */
    readonly everyResultFromRowToRow: (from: number, to: number) => PromiseLike<ADatabaseAnswer<AGameResult[]>>;
    /** The game `game`'s results deleted. */
    readonly deleteThisGamesResults: (game: string) => PromiseLike<ADatabaseAnswer<null>>;
    /** The game `game`'s turn records deleted. */
    readonly deleteThisGamesTurnRecords: (game: string) => PromiseLike<ADatabaseAnswer<null>>;
    /** The results of the games `games` deleted. */
    readonly deleteTheseGamesResults: (games: readonly string[]) => PromiseLike<ADatabaseAnswer<null>>;
    /** The turn records of the games `games` deleted. */
    readonly deleteTheseGamesTurnRecords: (games: readonly string[]) => PromiseLike<ADatabaseAnswer<null>>;
  };
  /** The games, as the Hall of Fame and the statistics read them. */
  readonly theHallOfFamesGames: {
    /** One game the Game Master `gameMaster` runs, if any (the leaderboard's GM editing). */
    readonly oneGameThisGameMasterRuns: (
      gameMaster: string,
    ) => PromiseLike<ADatabaseAnswer<Pick<ARow<'games'>, 'id'>[]>>;
    /** The game `game`, with its world and its realms, if the signed-in account may read it. */
    readonly thisGameWithItsWorldAndRealms: (game: string) => PromiseLike<ADatabaseAnswer<AGameForItsHallOfFameEntry>>;
    /** The finished games the Game Master `gameMaster` runs. */
    readonly theFinishedGamesThisGameMasterRuns: (
      gameMaster: string,
    ) => PromiseLike<ADatabaseAnswer<AFinishedGameForTheHallOfFame[]>>;
    /** Every game the signed-in account may read: its name, state and turn. */
    readonly everyGamesNameStatusAndTurn: () => PromiseLike<ADatabaseAnswer<AGamesNameStatusAndTurn[]>>;
    /** The games the Game Master `gameMaster` runs: their names, states and turns. */
    readonly theNameStatusAndTurnOfTheGamesThisGameMasterRuns: (
      gameMaster: string,
    ) => PromiseLike<ADatabaseAnswer<AGamesNameStatusAndTurn[]>>;
    /** Which of the games `games` still exist (as the signed-in account may read them). */
    readonly whichOfTheseGamesStillExist: (
      games: readonly string[],
    ) => PromiseLike<ADatabaseAnswer<Pick<ARow<'games'>, 'id'>[]>>;
  };
  /** The dispatches (game_messages: one row a dispatch; game_message_reads: one row a realm a game, its read marks). */
  readonly theDispatches: {
    /** One dispatch's id, if any: the probe that game_messages is there. */
    readonly oneDispatchsId: () => PromiseLike<ADatabaseAnswer<Pick<ADispatch, 'id'>[]>>;
    /** One read mark's game, if any: the probe that game_message_reads is there. */
    readonly oneReadMarksGame: () => PromiseLike<ADatabaseAnswer<Pick<ARealmsReadMarks, 'game_id'>[]>>;
    /** The newest `count` dispatches of the game `game` the signed-in account may read, the newest first. */
    readonly theNewestDispatchesOfThisGame: (game: string, count: number) => PromiseLike<ADatabaseAnswer<ADispatch[]>>;
    /** The first `count` dispatches of the game `game` after the dispatch `after` (by id) the signed-in account may
     *  read, the oldest first. */
    readonly theDispatchesOfThisGameAfterThisOne: (
      game: string,
      after: number,
      count: number,
    ) => PromiseLike<ADatabaseAnswer<ADispatch[]>>;
    /** The last `count` dispatches of the game `game` before the dispatch `before` (by id) the signed-in account may
     *  read, the newest first. */
    readonly theDispatchesOfThisGameBeforeThisOne: (
      game: string,
      before: number,
      count: number,
    ) => PromiseLike<ADatabaseAnswer<ADispatch[]>>;
    /** The newest 3,000 dispatches of the games `games` the signed-in account may read, the newest first: their games
     *  and realms only. */
    readonly theNewestDispatchesOfTheseGamesGamesAndRealms: (
      games: readonly string[],
    ) => PromiseLike<ADatabaseAnswer<ADispatchsGameAndRealms[]>>;
    /** The dispatch `dispatch` sent. */
    readonly sendThisDispatch: (dispatch: ANewDispatch) => PromiseLike<ADatabaseAnswer<null>>;
    /** The dispatch `id` deleted (its reports with it). */
    readonly deleteThisDispatch: (id: number) => PromiseLike<ADatabaseAnswer<null>>;
    /** The realm `realm`'s read marks in the game `game`, if it has any. */
    readonly thisRealmsReadMarksInThisGame: (
      game: string,
      realm: number,
    ) => PromiseLike<ADatabaseAnswer<Pick<ARealmsReadMarks, 'reads'>>>;
    /** The read marks of the account `account` in the games `games`. */
    readonly thisAccountsReadMarksInTheseGames: (
      games: readonly string[],
      account: string,
    ) => PromiseLike<ADatabaseAnswer<ARealmsReadMarks[]>>;
    /** The read marks `marks` written, over the realm's in that game if it has some. */
    readonly writeTheseReadMarks: (marks: ANewRow<'game_message_reads'>) => PromiseLike<ADatabaseAnswer<null>>;
  };
  /** The reported dispatches (message_reports: one row a dispatch a player reported; gm_reported_messages()). */
  readonly theReportedDispatches: {
    /** The dispatches of the game `game` the signed-in account has reported. */
    readonly theDispatchesThisAccountReportedInThisGame: (
      game: string,
    ) => PromiseLike<ADatabaseAnswer<Pick<ARow<'message_reports'>, 'message_id'>[]>>;
    /** The report `report` made. */
    readonly reportThisDispatch: (report: ANewRow<'message_reports'>) => PromiseLike<ADatabaseAnswer<null>>;
    /** gm_reported_messages(): the reported dispatches of the game `game` (null: of every game) reported to the
     *  signed-in account (the game's GM, if they play no realm in it; the Overlord, every one). */
    readonly theDispatchesReportedToThisAccount: (
      game: string | null,
    ) => PromiseLike<ADatabaseAnswer<AReportedDispatch[]>>;
  };
  /** The player's realms (game_players; get_game_slots(): every realm's slot in the games an account may see). */
  readonly thePlayersRealms: {
    /** The realms of the account `account`: their ids, games, places and whether their orders are in. */
    readonly thisAccountsRealmsAndTheirOrdersFlags: (
      account: string,
    ) => PromiseLike<ADatabaseAnswer<Pick<ARealm, 'id' | 'game_id' | 'player_index' | 'orders_submitted'>[]>>;
    /** The realms of the account `account`, every column. */
    readonly everyRealmOfThisAccount: (account: string) => PromiseLike<ADatabaseAnswer<ARealm[]>>;
    /** The games of the account `account`'s realms. */
    readonly theGamesOfThisAccountsRealms: (account: string) => PromiseLike<ADatabaseAnswer<Pick<ARealm, 'game_id'>[]>>;
    /** The realms of the account `account` in the game `game`: their ids and places. */
    readonly thisAccountsRealmsInThisGame: (
      game: string,
      account: string,
    ) => PromiseLike<ADatabaseAnswer<Pick<ARealm, 'id' | 'player_index'>[]>>;
    /** The realm `id`, every column. */
    readonly thisRealm: (id: string) => PromiseLike<ADatabaseAnswer<ARealm>>;
    /** The realm `realm` joined to its game, and its row, every column, as the database made it. */
    readonly joinWithThisRealm: (realm: ANewRow<'game_players'>) => PromiseLike<ADatabaseAnswer<ARealm>>;
    /** get_game_slots(): every realm's slot in the games `games` the signed-in account may see. */
    readonly theSlotsOfTheseGames: (games: string[]) => PromiseLike<ADatabaseAnswer<ARealmsSlot[]>>;
  };
  /** The player's games (games), as the player page lists, joins and reports them. */
  readonly thePlayersGames: {
    /** The turn and state of the games `games`. */
    readonly theTurnAndStateOfTheseGames: (
      games: readonly string[],
    ) => PromiseLike<ADatabaseAnswer<Pick<AGame, 'id' | 'turn' | 'status'>[]>>;
    /** The games `games`, their light columns (the meta column among them). */
    readonly theseGamesForTheirCards: (games: readonly string[]) => PromiseLike<ADatabaseAnswer<AGameForItsCard[]>>;
    /** The games `games`, every column (for a database without the meta column). */
    readonly theseGamesEveryColumn: (games: readonly string[]) => PromiseLike<ADatabaseAnswer<AGame[]>>;
    /** The games still in setup (open to join), every column. */
    readonly theGamesInSetup: () => PromiseLike<ADatabaseAnswer<AGame[]>>;
    /** The game `game`'s world and state. */
    readonly thisGamesWorldAndState: (
      game: string,
    ) => PromiseLike<ADatabaseAnswer<Pick<AGame, 'game_state' | 'status'>>>;
    /** The game `game`, the columns its report screen reads. */
    readonly thisGameForItsReport: (game: string) => PromiseLike<ADatabaseAnswer<AGameForItsReport>>;
    /** The game `game`, every column. */
    readonly thisGameEveryColumn: (game: string) => PromiseLike<ADatabaseAnswer<AGame>>;
  };
  /** The turns' logs (turn_logs), as the chronicle reads a past turn. */
  readonly theChroniclesLogs: {
    /** The log of the realm `realm` (-1: the GM's whole log) of the game `game` in the turn `turn`, if any. */
    readonly theLogOfThisRealmInThisTurn: (
      game: string,
      turn: number,
      realm: number,
    ) => PromiseLike<ADatabaseAnswer<ATurnsLog[]>>;
  };
  /** The orders (game_players' orders: the realm's draft or submitted orders, one JSON text), as the player writes them,
   *  and the turn they are for (games). Each writes only the realm `realm` (P2-05 later checks them in the database). */
  readonly theOrders: {
    /** Saves the draft `orders` of the realm `realm`: its orders no longer submitted. */
    readonly saveThisRealmsDraft: (realm: string, orders: string) => PromiseLike<ADatabaseAnswer<null>>;
    /** Saves the orders `orders` of the realm `realm` (its hero order merged in), whether submitted or not. */
    readonly saveThisRealmsHeroOrder: (realm: string, orders: string) => PromiseLike<ADatabaseAnswer<null>>;
    /** Revise: the realm `realm`'s orders no longer submitted, its orders kept. */
    readonly reopenThisRealmsOrders: (realm: string) => PromiseLike<ADatabaseAnswer<null>>;
    /** Submits the orders `orders` of the realm `realm`, at the time `submittedAt`. */
    readonly submitThisRealmsOrders: (
      realm: string,
      orders: string,
      submittedAt: string,
    ) => PromiseLike<ADatabaseAnswer<null>>;
    /** The turn the game `game` is on (Submit checks it has not moved on). */
    readonly theTurnOfThisGame: (game: string) => PromiseLike<ADatabaseAnswer<Pick<AGame, 'turn'>>>;
  };
  /** The GM's games (games), as the GM page lists, opens, makes, sets, archives and backfills them. */
  readonly theGameMastersGames: {
    /** One game's id and meta: whether the database has the games.meta column. */
    readonly oneGamesMeta: () => PromiseLike<ADatabaseAnswer<Pick<AGame, 'id' | 'meta'>[]>>;
    /** The games the Game Master `gameMaster` runs, newest first: their light columns and their realms'. */
    readonly theGamesThisGameMasterRunsNewestFirst: (
      gameMaster: string,
    ) => PromiseLike<ADatabaseAnswer<AGameInTheGameMastersList[]>>;
    /** The same, every column (for a database without the meta column). */
    readonly theGamesThisGameMasterRunsNewestFirstEveryColumn: (
      gameMaster: string,
    ) => PromiseLike<ADatabaseAnswer<AGameWithItsRealms[]>>;
    /** Every game, newest first, from the row `from` to the row `to`: their light columns and their realms'. */
    readonly everyGameNewestFirstFromRowToRow: (
      from: number,
      to: number,
    ) => PromiseLike<ADatabaseAnswer<AGameInTheGameMastersList[]>>;
    /** The same, every column (for a database without the meta column). */
    readonly everyGameNewestFirstFromRowToRowEveryColumn: (
      from: number,
      to: number,
    ) => PromiseLike<ADatabaseAnswer<AGameWithItsRealms[]>>;
    /** The active games the Game Master `gameMaster` runs: their light columns and their realms'. */
    readonly theActiveGamesThisGameMasterRuns: (
      gameMaster: string,
    ) => PromiseLike<ADatabaseAnswer<AGameInTheGameMastersList[]>>;
    /** The same, every column (for a database without the meta column). */
    readonly theActiveGamesThisGameMasterRunsEveryColumn: (
      gameMaster: string,
    ) => PromiseLike<ADatabaseAnswer<AGameWithItsRealms[]>>;
    /** The game `game`, every column, with every column of its realms. */
    readonly thisGameWithItsRealms: (game: string) => PromiseLike<ADatabaseAnswer<AGameWithItsRealms>>;
    /** Makes the game `game`, and answers its row, every column, as the database made it. */
    readonly makeThisGame: (game: ANewRow<'games'>) => PromiseLike<ADatabaseAnswer<AGame>>;
    /** The game `game`'s turn and world (archiving reads them). */
    readonly thisGamesTurnAndWorld: (
      game: string,
    ) => PromiseLike<ADatabaseAnswer<Pick<AGame, 'id' | 'turn' | 'game_state'>>>;
    /** The ids and worlds of the games the Game Master `gameMaster` runs that have no meta yet. */
    readonly theGamesThisGameMasterRunsWithNoMeta: (
      gameMaster: string,
    ) => PromiseLike<ADatabaseAnswer<Pick<AGame, 'id' | 'game_state'>[]>>;
    /** Changes the game `game` by `change`. */
    readonly changeThisGame: (game: string, change: AChange<'games'>) => PromiseLike<ADatabaseAnswer<null>>;
    /** Changes the game `game` by `change`, and answers its id (none if no game matched). */
    readonly changeThisGameAndAnswerItsId: (
      game: string,
      change: AChange<'games'>,
    ) => PromiseLike<ADatabaseAnswer<Pick<AGame, 'id'> | null>>;
    /** Changes the game `game` by `change` only while it is still on the turn `turn`, and answers its id (none if it
     *  has moved on). */
    readonly changeThisGameWhileOnThisTurnAndAnswerItsId: (
      game: string,
      turn: number,
      change: AChange<'games'>,
    ) => PromiseLike<ADatabaseAnswer<Pick<AGame, 'id'> | null>>;
    /** Sets whether realms that are out of the game `game` are kept from sending dispatches, and answers the setting
     *  (none if no game matched). */
    readonly keepTheRealmsThatAreOutOfThisGameFromSendingDispatches: (
      game: string,
      keep: boolean,
    ) => PromiseLike<ADatabaseAnswer<Pick<AGame, 'id' | 'block_eliminated_msgs'> | null>>;
  };
  /** The realms of the GM's games (game_players), as the GM page removes one. */
  readonly theGameMastersRealms: {
    /** Removes the realm `realm` from its game. */
    readonly removeThisRealm: (realm: string) => PromiseLike<ADatabaseAnswer<null>>;
  };
}

// The GM page's list's columns, held as the page held them (ui/gm/startup.ts's gamesListCols, until P1-17m): with the
// games.meta column, the light columns and the realms'; without it, every column of both, so a list read on a database
// without that column loses nothing. A list of columns held in a constant isn't read by the column rule (Parked).
const A_GAME_IN_THE_GAME_MASTERS_LIST =
  'id,name,gm_user_id,status,turn,max_players,max_turns,created_at,meta, game_players(id,game_id,user_id,player_index,display_name,orders_submitted)';
const EVERY_COLUMN_OF_A_GAME_IN_THE_GAME_MASTERS_LIST = '*, game_players(*)';

/** The page's Db, on its own client: each function sends the query the page sent on that client before. */
export function makeTheDbFromItsClient(client: TheDatabaseClient): Db {
  return {
    theDatabasesVersion: {
      askTheDatabaseItsVersion: () => client.rpc('kc_db_version'),
    },
    signingIn: {
      theSessionKeptInThisBrowser: () => client.auth.getSession(),
      signInWithEmailAndPassword: (email, password) => client.auth.signInWithPassword({ email, password }),
      signUpWithEmailPasswordAndName: (email, password, name) =>
        client.auth.signUp({ email, password, options: { data: { display_name: name } } }),
      signOut: () => client.auth.signOut(),
      changeThePassword: (password) => client.auth.updateUser({ password }),
      changeTheNameKeptWithTheSignIn: (name) => client.auth.updateUser({ data: { display_name: name } }),
    },
    theAccountsNames: {
      theNamesOfTheseAccounts: (ids) => client.from('profiles').select('id,name').in('id', ids),
      theNameOfEveryAccount: () => client.from('profiles').select('id,name'),
      theNameAndJoiningDateOfEveryAccountInNameOrder: () =>
        client.from('profiles').select('id,name,created_at').order('name', { ascending: true }),
      theNameOfThisAccount: (id) => client.from('profiles').select('id,name').eq('id', id).single(),
      giveThisAccountItsName: (id, name) => client.from('profiles').upsert({ id, name }, { onConflict: 'id' }),
    },
    theRoles: {
      isTheSignedInAccountAGameMaster: () => client.rpc('is_game_master'),
      isTheSignedInAccountTheOverlord: () => client.rpc('is_site_admin'),
      theGameMasterOfferMadeToThisAccount: (id) =>
        client.from('game_masters').select('accepted_at').eq('user_id', id).maybeSingle(),
      answerTheGameMasterOffer: (answer) => client.rpc(answer),
    },
    theOverlordsAccounts: {
      everyAccountAsTheOverlordSeesIt: () => client.rpc('overlord_accounts'),
      suspendThisAccountUntil: (user, until) => client.rpc('account_suspend', { p_user: user, p_until: until }),
      liftThisAccountsSuspension: (user) => client.rpc('account_unsuspend', { p_user: user }),
      deleteThisAccount: (user) => client.rpc('account_delete', { p_user: user }),
      offerThisAccountGameMaster: (user) => client.rpc('gm_offer', { p_user: user }),
      withdrawTheGameMasterOfferToThisAccount: (user) => client.rpc('gm_withdraw_offer', { p_user: user }),
      revokeThisAccountsGameMaster: (user) => client.rpc('gm_revoke', { p_user: user }),
    },
    theOverlordsGames: {
      everyGameNewestFirstFromRowToRow: (from, to) =>
        client
          .from('games')
          .select('id,name,gm_user_id,status,turn,max_turns,created_at,meta')
          .order('created_at', { ascending: false })
          .range(from, to),
      handThisGameToThisGameMaster: (game, gameMaster) =>
        client.rpc('reassign_game', { p_game: game, p_new_gm: gameMaster }),
      theRealmsNamesOfTheseGames: (games) =>
        client.from('game_players').select('game_id,player_index,display_name').in('game_id', games),
    },
    theHallOfFame: {
      oneEntrysGame: () => client.from('game_records').select('game_id').limit(1),
      everyEntryNewestFinishedFirstFromRowToRow: (from, to) =>
        client.from('game_records').select('*').order('finished_at', { ascending: false }).range(from, to),
      theGameOfEveryEntry: () => client.from('game_records').select('game_id'),
      theGameMastersNotesOnThisGamesEntry: (game) =>
        client.from('game_records').select('note,hidden,game_name').eq('game_id', game).maybeSingle(),
      writeTheseEntries: (entries) => client.from('game_records').upsert([...entries], { onConflict: 'game_id' }),
      changeThisGamesEntry: (game, change) => client.from('game_records').update(change).eq('game_id', game),
      deleteThisGamesEntry: (game) => client.from('game_records').delete().eq('game_id', game),
      deleteTheseGamesEntries: (games) => client.from('game_records').delete().in('game_id', games),
      renameThisPlayer: (user, name) => client.rpc('rename_player', { p_user: user, p_name: name }),
    },
    theStatistics: {
      oneTurnRecordsId: () => client.from('turn_events').select('id').limit(1),
      oneGameResultsId: () => client.from('game_results').select('id').limit(1),
      theResultsOfThisGame: (game) => client.from('game_results').select('*').eq('game_id', game),
      thisGamesTurnRecordsForItsEntryFromRowToRow: (game, from, to) =>
        client
          .from('turn_events')
          .select('turn,player_index,is_bot,realm,race,alignment,post,outcomes')
          .eq('game_id', game)
          .order('turn')
          .order('player_index')
          .range(from, to),
      theGameOfEveryResultFromRowToRow: (from, to) =>
        client.from('game_results').select('game_id').order('game_id').order('player_index').range(from, to),
      everyTurnRecordFromRowToRow: (from, to) =>
        client
          .from('turn_events')
          .select('game_id,turn,player_index,is_bot,bot_difficulty,realm,race,alignment,orders,pre,post,outcomes')
          .order('game_id')
          .order('turn')
          .order('player_index')
          .range(from, to),
      everyResultFromRowToRow: (from, to) => client.from('game_results').select('*').range(from, to),
      deleteThisGamesResults: (game) => client.from('game_results').delete().eq('game_id', game),
      deleteThisGamesTurnRecords: (game) => client.from('turn_events').delete().eq('game_id', game),
      deleteTheseGamesResults: (games) => client.from('game_results').delete().in('game_id', games),
      deleteTheseGamesTurnRecords: (games) => client.from('turn_events').delete().in('game_id', games),
    },
    theHallOfFamesGames: {
      oneGameThisGameMasterRuns: (gameMaster) =>
        client.from('games').select('id').eq('gm_user_id', gameMaster).limit(1),
      thisGameWithItsWorldAndRealms: (game) =>
        client
          .from('games')
          .select(
            'id,name,gm_user_id,created_at,max_turns,meta,game_state,game_players(id,player_index,user_id,display_name)',
          )
          .eq('id', game)
          .maybeSingle(),
      theFinishedGamesThisGameMasterRuns: (gameMaster) =>
        client
          .from('games')
          .select('id,name,gm_user_id,created_at,max_turns,meta')
          .eq('gm_user_id', gameMaster)
          .eq('status', 'complete'),
      everyGamesNameStatusAndTurn: () => client.from('games').select('id,name,status,turn'),
      theNameStatusAndTurnOfTheGamesThisGameMasterRuns: (gameMaster) =>
        client.from('games').select('id,name,status,turn').eq('gm_user_id', gameMaster),
      whichOfTheseGamesStillExist: (games) => client.from('games').select('id').in('id', games),
    },
    theDispatches: {
      oneDispatchsId: () => client.from('game_messages').select('id').limit(1),
      oneReadMarksGame: () => client.from('game_message_reads').select('game_id').limit(1),
      theNewestDispatchesOfThisGame: (game, count) =>
        client
          .from('game_messages')
          .select('id,turn,from_index,to_indexes,scope,body,created_at')
          .eq('game_id', game)
          .order('id', { ascending: false })
          .limit(count),
      theDispatchesOfThisGameAfterThisOne: (game, after, count) =>
        client
          .from('game_messages')
          .select('id,turn,from_index,to_indexes,scope,body,created_at')
          .eq('game_id', game)
          .gt('id', after)
          .order('id', { ascending: true })
          .limit(count),
      theDispatchesOfThisGameBeforeThisOne: (game, before, count) =>
        client
          .from('game_messages')
          .select('id,turn,from_index,to_indexes,scope,body,created_at')
          .eq('game_id', game)
          .lt('id', before)
          .order('id', { ascending: false })
          .limit(count),
      theNewestDispatchesOfTheseGamesGamesAndRealms: (games) =>
        client
          .from('game_messages')
          .select('id,game_id,from_index,to_indexes,scope')
          .in('game_id', games)
          .order('id', { ascending: false })
          .limit(3000),
      sendThisDispatch: (dispatch) => client.from('game_messages').insert(dispatch),
      deleteThisDispatch: (id) => client.from('game_messages').delete().eq('id', id),
      thisRealmsReadMarksInThisGame: (game, realm) =>
        client.from('game_message_reads').select('reads').eq('game_id', game).eq('player_index', realm).maybeSingle(),
      thisAccountsReadMarksInTheseGames: (games, account) =>
        client
          .from('game_message_reads')
          .select('game_id,player_index,reads')
          .in('game_id', games)
          .eq('user_id', account),
      writeTheseReadMarks: (marks) =>
        client.from('game_message_reads').upsert(marks, { onConflict: 'game_id,player_index' }),
    },
    theReportedDispatches: {
      theDispatchesThisAccountReportedInThisGame: (game) =>
        client.from('message_reports').select('message_id').eq('game_id', game),
      reportThisDispatch: (report) => client.from('message_reports').insert(report),
      theDispatchesReportedToThisAccount: (game) => client.rpc('gm_reported_messages', { p_game: game }),
    },
    thePlayersRealms: {
      thisAccountsRealmsAndTheirOrdersFlags: (account) =>
        client.from('game_players').select('id,game_id,player_index,orders_submitted').eq('user_id', account),
      everyRealmOfThisAccount: (account) => client.from('game_players').select('*').eq('user_id', account),
      theGamesOfThisAccountsRealms: (account) => client.from('game_players').select('game_id').eq('user_id', account),
      thisAccountsRealmsInThisGame: (game, account) =>
        client.from('game_players').select('id,player_index').eq('game_id', game).eq('user_id', account),
      thisRealm: (id) => client.from('game_players').select('*').eq('id', id).single(),
      joinWithThisRealm: (realm) => client.from('game_players').insert(realm).select().single(),
      theSlotsOfTheseGames: (games) => client.rpc('get_game_slots', { p_games: games }),
    },
    thePlayersGames: {
      theTurnAndStateOfTheseGames: (games) => client.from('games').select('id,turn,status').in('id', games),
      theseGamesForTheirCards: (games) =>
        client.from('games').select('id,name,gm_user_id,status,turn,max_players,created_at,meta').in('id', games),
      theseGamesEveryColumn: (games) => client.from('games').select('*').in('id', games),
      theGamesInSetup: () => client.from('games').select('*').eq('status', 'setup'),
      thisGamesWorldAndState: (game) => client.from('games').select('game_state,status').eq('id', game).single(),
      thisGameForItsReport: (game) =>
        client
          .from('games')
          .select('id,name,gm_user_id,status,turn,max_players,block_eliminated_msgs')
          .eq('id', game)
          .single(),
      thisGameEveryColumn: (game) => client.from('games').select('*').eq('id', game).single(),
    },
    theChroniclesLogs: {
      theLogOfThisRealmInThisTurn: (game, turn, realm) =>
        client.from('turn_logs').select('*').eq('game_id', game).eq('turn', turn).eq('player_index', realm).limit(1),
    },
    theOrders: {
      saveThisRealmsDraft: (realm, orders) =>
        client.from('game_players').update({ orders, orders_submitted: false }).eq('id', realm),
      saveThisRealmsHeroOrder: (realm, orders) => client.from('game_players').update({ orders }).eq('id', realm),
      reopenThisRealmsOrders: (realm) =>
        client.from('game_players').update({ orders_submitted: false }).eq('id', realm),
      submitThisRealmsOrders: (realm, orders, submittedAt) =>
        client
          .from('game_players')
          .update({ orders, orders_submitted: true, last_submitted_at: submittedAt })
          .eq('id', realm),
      theTurnOfThisGame: (game) => client.from('games').select('turn').eq('id', game).single(),
    },
    theGameMastersGames: {
      oneGamesMeta: () => client.from('games').select('id,meta').limit(1),
      theGamesThisGameMasterRunsNewestFirst: (gameMaster) =>
        client
          .from('games')
          .select(A_GAME_IN_THE_GAME_MASTERS_LIST)
          .eq('gm_user_id', gameMaster)
          .order('created_at', { ascending: false }),
      theGamesThisGameMasterRunsNewestFirstEveryColumn: (gameMaster) =>
        client
          .from('games')
          .select(EVERY_COLUMN_OF_A_GAME_IN_THE_GAME_MASTERS_LIST)
          .eq('gm_user_id', gameMaster)
          .order('created_at', { ascending: false }),
      everyGameNewestFirstFromRowToRow: (from, to) =>
        client
          .from('games')
          .select(A_GAME_IN_THE_GAME_MASTERS_LIST)
          .order('created_at', { ascending: false })
          .range(from, to),
      everyGameNewestFirstFromRowToRowEveryColumn: (from, to) =>
        client
          .from('games')
          .select(EVERY_COLUMN_OF_A_GAME_IN_THE_GAME_MASTERS_LIST)
          .order('created_at', { ascending: false })
          .range(from, to),
      theActiveGamesThisGameMasterRuns: (gameMaster) =>
        client
          .from('games')
          .select(A_GAME_IN_THE_GAME_MASTERS_LIST)
          .eq('gm_user_id', gameMaster)
          .eq('status', 'active'),
      theActiveGamesThisGameMasterRunsEveryColumn: (gameMaster) =>
        client
          .from('games')
          .select(EVERY_COLUMN_OF_A_GAME_IN_THE_GAME_MASTERS_LIST)
          .eq('gm_user_id', gameMaster)
          .eq('status', 'active'),
      thisGameWithItsRealms: (game) => client.from('games').select('*, game_players(*)').eq('id', game).single(),
      makeThisGame: (game) => client.from('games').insert(game).select().single(),
      thisGamesTurnAndWorld: (game) => client.from('games').select('id,turn,game_state').eq('id', game).single(),
      theGamesThisGameMasterRunsWithNoMeta: (gameMaster) =>
        client.from('games').select('id,game_state').eq('gm_user_id', gameMaster).is('meta', null),
      changeThisGame: (game, change) => client.from('games').update(change).eq('id', game),
      changeThisGameAndAnswerItsId: (game, change) =>
        client.from('games').update(change).eq('id', game).select('id').maybeSingle(),
      changeThisGameWhileOnThisTurnAndAnswerItsId: (game, turn, change) =>
        client.from('games').update(change).eq('id', game).eq('turn', turn).select('id').maybeSingle(),
      keepTheRealmsThatAreOutOfThisGameFromSendingDispatches: (game, keep) =>
        client
          .from('games')
          .update({ block_eliminated_msgs: keep })
          .eq('id', game)
          .select('id,block_eliminated_msgs')
          .maybeSingle(),
    },
    theGameMastersRealms: {
      removeThisRealm: (realm) => client.from('game_players').delete().eq('id', realm),
    },
  };
}
