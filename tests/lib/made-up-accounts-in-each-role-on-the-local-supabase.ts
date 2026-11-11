// The role helper of the access layer's tests (tests/db/; plan P1-17, Decision 6): a made-up world on the local
// Supabase, made through its service role: six accounts, one in each role that matters, two games, and a client
// signed in as each. Each test file makes its own world (beforeAll) and removes it (afterAll), every row it made, so
// the local database is left as it was. Made-up names and addresses only (`@example.test`): no test reads the live
// database, and the address and keys are the local Supabase's (tests/setup/the-local-supabase.ts checks).
//
// The roles, in the made-up game ("Made-up Marchwood", three realms):
//   signed out    no account (the Hall of Fame's visitor);
//   a player      holds realm 0;
//   a rival       holds realm 1 of the same game;
//   the game's GM a Game Master, who runs it;
//   another GM    a Game Master, who runs another made-up game ("Made-up Fenmoor") and not this one;
//   the Overlord  the site's one Overlord (site_admins), who plays and runs no game.
// Realm 2 is held by no one. The Overlord is one account a database: the db project runs one file at a time.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/db/database.types.ts';
import type { TheDatabaseClient } from '../../src/db/the-db-interface-and-its-areas.ts';

/** The local Supabase, as tests/setup/the-local-supabase.ts hands it on. */
export interface TheLocalSupabase {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}

/** The roles that matter, in the order the tests check them. */
export const THE_ROLES = ['signed out', 'a player', 'a rival', "the game's GM", 'another GM', 'the Overlord'] as const;
export type ARole = (typeof THE_ROLES)[number];
/** The roles with an account. */
export type ARoleWithAnAccount = Exclude<ARole, 'signed out'>;
const THE_ROLES_WITH_AN_ACCOUNT: readonly ARoleWithAnAccount[] = THE_ROLES.filter(
  (role): role is ARoleWithAnAccount => role !== 'signed out',
);

/** A made-up world: its two games, its accounts by role, a client in each role, and how to remove it all. */
export interface AMadeUpWorld {
  /** The made-up game, run by the game's GM, played by the player and the rival. */
  readonly theGame: string;
  /** Another GM's game. */
  readonly theOtherGMsGame: string;
  /** Each account's id. */
  readonly accounts: Readonly<Record<ARoleWithAnAccount, string>>;
  /** Each account's address (its password is THE_MADE_UP_PASSWORD), for the tests that sign in themselves. */
  readonly addressOf: (role: ARoleWithAnAccount) => string;
  /** The local service role's client: it passes every access rule (only for making and checking the world). */
  readonly theServiceRole: TheDatabaseClient;
  /** A new client, signed in as `role` (signed out: none). */
  readonly signedInAs: (role: ARole) => Promise<TheDatabaseClient>;
  /** Removes every row the world made, and its accounts. */
  readonly removeIt: () => Promise<void>;
}

/** Every made-up account's password. */
export const THE_MADE_UP_PASSWORD = 'made-up-password-for-the-local-database';

/** A client on the local Supabase that keeps its session in memory only, never refreshing it. */
function aClient(local: TheLocalSupabase, key: string): TheDatabaseClient {
  return createClient<Database>(local.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** What a call answered, or throws its error with what was being done. */
function itsDataOr<T>(doing: string, answer: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (answer.error) throw new Error(`The made-up world: ${doing} failed: ${answer.error.message}`);
  if (answer.data === null || answer.data === undefined) throw new Error(`The made-up world: ${doing} gave no data`);
  return answer.data;
}

/** An account call's error, thrown with what was being done. */
function throwIfAnError(doing: string, error: { message: string } | null): void {
  if (error) throw new Error(`The made-up world: ${doing} failed: ${error.message}`);
}

/** Makes a made-up world on the local Supabase; `label` names it in its accounts' addresses (one word). */
export async function makeAMadeUpWorld(local: TheLocalSupabase, label: string): Promise<AMadeUpWorld> {
  const theServiceRole = aClient(local, local.serviceRoleKey);
  const tag = `${label}-${randomUUID().slice(0, 8)}`;
  const emailOf = (role: ARoleWithAnAccount) => `kc-access-${tag}-${role.replace(/\W+/g, '-')}@example.test`;
  const made: string[] = [];
  const games: string[] = [];
  let theOverlordIsOurs = false;

  const removeIt = async (): Promise<void> => {
    const problems: string[] = [];
    const note = (doing: string, error: { message: string } | null) => {
      if (error) problems.push(`${doing}: ${error.message}`);
    };
    if (games.length) note('deleting the games', (await theServiceRole.from('games').delete().in('id', games)).error);
    if (theOverlordIsOurs)
      note('deleting the Overlord', (await theServiceRole.from('site_admins').delete().in('user_id', made)).error);
    for (const id of made) note('deleting an account', (await theServiceRole.auth.admin.deleteUser(id)).error);
    if (problems.length) throw new Error('The made-up world was not all removed: ' + problems.join('; '));
  };

  try {
    const accounts: Partial<Record<ARoleWithAnAccount, string>> = {};
    for (const role of THE_ROLES_WITH_AN_ACCOUNT) {
      const { data, error } = await theServiceRole.auth.admin.createUser({
        email: emailOf(role),
        password: THE_MADE_UP_PASSWORD,
        email_confirm: true,
      });
      throwIfAnError(`making the account of ${role}`, error);
      if (!data.user) throw new Error(`The made-up world: the account of ${role} came back empty`);
      accounts[role] = data.user.id;
      made.push(data.user.id);
    }
    const idOf = (role: ARoleWithAnAccount): string => {
      const id = accounts[role];
      if (id === undefined) throw new Error(`The made-up world has no account for ${role}`);
      return id;
    };

    const existing = itsDataOr('reading the Overlord', await theServiceRole.from('site_admins').select('user_id'));
    if (existing.length)
      throw new Error(
        'The local database already has an Overlord, and the access tests make their own: rebuild the local copy ' +
          '(npx supabase@2.120.0 db reset --local; supabase/README.md).',
      );
    itsDataOr(
      'making the Overlord',
      await theServiceRole
        .from('site_admins')
        .insert({ user_id: idOf('the Overlord') })
        .select('user_id'),
    );
    theOverlordIsOurs = true;

    const now = new Date().toISOString();
    itsDataOr(
      'making the Game Masters',
      await theServiceRole
        .from('game_masters')
        .insert([
          { user_id: idOf("the game's GM"), accepted_at: now },
          { user_id: idOf('another GM'), accepted_at: now },
        ])
        .select('user_id'),
    );
    const aGame = async (name: string, gm: ARoleWithAnAccount): Promise<string> => {
      const { id } = itsDataOr(
        `making ${name}`,
        await theServiceRole
          .from('games')
          .insert({ name, gm_user_id: idOf(gm), status: 'active', turn: 3 })
          .select('id')
          .single(),
      );
      games.push(id);
      return id;
    };
    const theGame = await aGame('Made-up Marchwood', "the game's GM");
    const theOtherGMsGame = await aGame('Made-up Fenmoor', 'another GM');
    itsDataOr(
      'making the realms',
      await theServiceRole
        .from('game_players')
        .insert([
          { game_id: theGame, user_id: idOf('a player'), player_index: 0, display_name: 'Realm of Ashford' },
          { game_id: theGame, user_id: idOf('a rival'), player_index: 1, display_name: 'Realm of Brackwater' },
          { game_id: theGame, user_id: null, player_index: 2, display_name: 'Realm of Coldharbour' },
          { game_id: theOtherGMsGame, user_id: null, player_index: 0, display_name: 'Realm of Dunmere' },
        ])
        .select('id'),
    );

    const signedInAs = async (role: ARole): Promise<TheDatabaseClient> => {
      const client = aClient(local, local.anonKey);
      if (role === 'signed out') return client;
      const { error } = await client.auth.signInWithPassword({ email: emailOf(role), password: THE_MADE_UP_PASSWORD });
      throwIfAnError(`signing in as ${role}`, error);
      return client;
    };
    return {
      theGame,
      theOtherGMsGame,
      accounts: {
        'a player': idOf('a player'),
        'a rival': idOf('a rival'),
        "the game's GM": idOf("the game's GM"),
        'another GM': idOf('another GM'),
        'the Overlord': idOf('the Overlord'),
      },
      addressOf: emailOf,
      theServiceRole,
      signedInAs,
      removeIt,
    };
  } catch (e) {
    await removeIt();
    throw e;
  }
}
