// The database access layer's one interface, Db (plan P1-17, Decision 4): one object of areas, each a few functions,
// made from the page's client by makeTheDbFromItsClient. A page calls the database only through Db (its calls still on
// `sb` move here area by area, P1-17's area rows); the tests hand a page their fake of it (tests/lib/fake-db.ts,
// through the-pages-database-client.ts). A Db function sends the query the page sent before, and answers as
// supabase-js does ({ data, error } and the status), so a page's error paths stay as they are. The client and the
// tables are typed by the generated types (database.types.ts: npx supabase gen types typescript --local, then
// Prettier; never edited by hand), so a misspelt table, column or function is a compiler error.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

/** The generated types, but for a database function's argument that takes null on purpose (the generator writes every
 *  argument as never null): account_suspend's p_until (null: until the suspension is lifted). */
export type TheDatabase = Omit<Database, 'public'> & {
  readonly public: Omit<Database['public'], 'Functions'> & {
    readonly Functions: Omit<Database['public']['Functions'], 'account_suspend'> & {
      readonly account_suspend: { Args: { p_user: string; p_until: string | null }; Returns: undefined };
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
}

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
  };
}
