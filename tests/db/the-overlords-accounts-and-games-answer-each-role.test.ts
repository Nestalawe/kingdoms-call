// The Overlord's accounts and games, areas of the page's Db (src/db/the-db-interface-and-its-areas.ts:
// theOverlordsAccounts, theOverlordsGames; plan P1-17f), on a supabase-js client of the local Supabase, as each role
// (signed out, a player, a rival, the game's GM, another GM, the Overlord):
// - the accounts (overlord_accounts, account_suspend, account_unsuspend, account_delete, gm_offer, gm_withdraw_offer,
//   gm_revoke): only the Overlord lists every account (its address, its name, its Game Master role, its games, its
//   suspension), suspends one until a day or until lifted and lifts it, deletes one, and offers, withdraws and revokes
//   Game Master; every other account is refused in the function's words, and a visitor for want of a grant; each
//   function's own refusals (the Overlord's own account, an end that has passed, an account that runs or plays in an
//   unfinished game, an accepted offer, an account that isn't a Game Master) in its words (the stand-in's mirrors);
// - the games: every game a role may read, newest first, a page of rows at a time, its light columns only (the GM its
//   own, a player the game it plays, the Overlord every one, a visitor none); only the Overlord hands a game to another
//   Game Master (never to the Overlord or to an account that isn't one, never a game that doesn't exist: the
//   stand-in's reassign_game); the realms' names of the games asked for, as each role may read them.
// Each change is undone before the next test, so the world is the same for each.
// Level db (the access layer, against the local Supabase): the queries and the access rules together, which no lower
// level holds (pgTAP checks the rules in SQL; the page tests run on the stand-in).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
import {
  makeTheDbFromItsClient,
  type Db,
  type TheDatabaseClient,
} from '../../src/db/the-db-interface-and-its-areas.ts';
import {
  makeAMadeUpWorld,
  THE_MADE_UP_PASSWORD,
  THE_ROLES,
  type AMadeUpWorld,
  type ARole,
  type ARoleWithAnAccount,
} from '../lib/made-up-accounts-in-each-role-on-the-local-supabase.ts';

const THE_ROLES_WITH_AN_ACCOUNT = THE_ROLES.filter((role): role is ARoleWithAnAccount => role !== 'signed out');
/** Each account's name, set by the service role. */
const THE_NAMES: Readonly<Record<ARoleWithAnAccount, string>> = {
  'a player': 'Made-up Godric',
  'a rival': 'Made-up Hilda',
  "the game's GM": 'Made-up Ivo',
  'another GM': 'Made-up Jocasta',
  'the Overlord': 'Made-up Kestrel',
};
const THE_GAME_MASTERS: readonly ARole[] = ["the game's GM", 'another GM'];
const A_DAY_MS = 24 * 3600 * 1000;

const local = inject('theLocalSupabase');
let world: AMadeUpWorld;
const clients = new Map<ARole, TheDatabaseClient>();
/** Accounts a test made beyond the world's, removed after. */
const madeHere: string[] = [];

/** The Db on `role`'s client, signed in (beforeAll). */
const dbOf = (role: ARole): Db => {
  const client = clients.get(role);
  if (!client) throw new Error(`no client for ${role}`);
  return makeTheDbFromItsClient(client);
};
const idOf = (role: ARoleWithAnAccount): string => world.accounts[role];
/** Any string (a time the database sets). */
const A_STRING: unknown = expect.any(String);
/** Any number (a column's default). */
const A_NUMBER: unknown = expect.any(Number);
/** What a call answered, in short: its data and its error's words. */
const inShort = (answer: { readonly data: unknown; readonly error: { readonly message: string } | null }): unknown => ({
  data: answer.data,
  error: answer.error?.message ?? null,
});
/** A refusal for want of a grant (signed out: the anon role has none), in its words. */
const NO_GRANT: unknown = expect.stringMatching(/permission denied/);
/** The error's words `role` is answered with by an Overlord's function that refuses everyone else in `words`: none
 *  for the Overlord, `words` for any other account, no grant signed out. */
const onlyTheOverlord = (role: ARole, words: string): unknown =>
  role === 'signed out' ? NO_GRANT : role === 'the Overlord' ? null : words;
/** The error's words a call answered, or null. */
const itsError = (answer: { readonly error: { readonly message: string } | null }): string | null =>
  answer.error?.message ?? null;

/** The account `id`'s ban, as the sign-in service holds it (null: none). */
const theBanOf = async (id: string): Promise<string | null> => {
  const { data, error } = await world.theServiceRole.auth.admin.getUserById(id);
  if (error) throw new Error(`reading the ban: ${error.message}`);
  return data.user.banned_until ?? null;
};
/** Lifts the ban on the account `id` (the service role). */
const liftTheBan = async (id: string): Promise<void> => {
  const { error } = await world.theServiceRole.auth.admin.updateUserById(id, { ban_duration: 'none' });
  if (error) throw new Error(`lifting the ban: ${error.message}`);
};
/** The account `id`'s Game Master row, as the service role reads it. */
const theGameMasterRowOf = async (id: string): Promise<unknown> =>
  (await world.theServiceRole.from('game_masters').select('accepted_at,offered_by').eq('user_id', id).maybeSingle())
    .data;
/** Removes the account `id`'s Game Master row (the service role). */
const removeTheGameMasterRowOf = async (id: string): Promise<void> => {
  const { error } = await world.theServiceRole.from('game_masters').delete().eq('user_id', id);
  if (error) throw new Error(`removing the Game Master row: ${error.message}`);
};
/** Who runs the game `game`, as the service role reads it. */
const whoRuns = async (game: string): Promise<string | null | undefined> =>
  (await world.theServiceRole.from('games').select('gm_user_id').eq('id', game).single()).data?.gm_user_id;
/** A new made-up account beyond the world's, with no game, removed after. */
const aNewAccount = async (): Promise<string> => {
  const { data, error } = await world.theServiceRole.auth.admin.createUser({
    email: `kc-access-overlord-extra-${randomUUID().slice(0, 8)}@example.test`,
    password: THE_MADE_UP_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`making an account: ${error.message}`);
  madeHere.push(data.user.id);
  return data.user.id;
};
/** Whether the account `id` is still there. */
const stillThere = async (id: string): Promise<boolean> =>
  (await world.theServiceRole.auth.admin.getUserById(id)).data.user !== null;

beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'overlord');
  for (const role of THE_ROLES_WITH_AN_ACCOUNT) {
    const { error } = await world.theServiceRole
      .from('profiles')
      .upsert({ id: idOf(role), name: THE_NAMES[role] }, { onConflict: 'id' });
    if (error) throw new Error(`naming ${role}: ${error.message}`);
  }
  for (const role of THE_ROLES) clients.set(role, await world.signedInAs(role));
});
afterAll(async () => {
  for (const id of madeHere) if (await stillThere(id)) await world.theServiceRole.auth.admin.deleteUser(id);
  await world.removeIt();
});

describe("the Overlord's accounts", () => {
  test.for(THE_ROLES)('%s: only the Overlord lists every account, oldest first', async (role) => {
    const answer = await dbOf(role).theOverlordsAccounts.everyAccountAsTheOverlordSeesIt();
    const ours = THE_ROLES_WITH_AN_ACCOUNT.map(idOf);
    const oursListed = (answer.data ?? []).filter((account) => ours.includes(account.user_id));
    expect({ error: itsError(answer), ours: oursListed }).toEqual({
      error: onlyTheOverlord(role, 'Only the Overlord can list the accounts.'),
      ours:
        role === 'the Overlord'
          ? THE_ROLES_WITH_AN_ACCOUNT.map((account) => ({
              user_id: idOf(account),
              name: THE_NAMES[account],
              email: world.addressOf(account).toLowerCase(), // the sign-in keeps addresses in lower case
              joined: A_STRING,
              last_sign_in: A_STRING,
              gm_status: THE_GAME_MASTERS.includes(account) ? 'game_master' : 'none',
              games_run: THE_GAME_MASTERS.includes(account) ? 1 : 0,
              games_played: account === 'a player' || account === 'a rival' ? 1 : 0,
              suspended_until: null,
            }))
          : [],
    });
  });

  test.for(THE_ROLES)('%s: only the Overlord suspends an account for a day, and lifts it', async (role) => {
    const accounts = dbOf(role).theOverlordsAccounts;
    const until = new Date(Date.now() + A_DAY_MS).toISOString();
    const suspended = await accounts.suspendThisAccountUntil(idOf('a rival'), until);
    const banned = await theBanOf(idOf('a rival'));
    const listed = (await dbOf('the Overlord').theOverlordsAccounts.everyAccountAsTheOverlordSeesIt()).data?.find(
      (account) => account.user_id === idOf('a rival'),
    );
    if (role !== 'the Overlord')
      await dbOf('the Overlord').theOverlordsAccounts.suspendThisAccountUntil(idOf('a rival'), until);
    const lifted = await accounts.liftThisAccountsSuspension(idOf('a rival'));
    const bannedAfter = await theBanOf(idOf('a rival'));
    await liftTheBan(idOf('a rival'));
    expect({
      suspended: itsError(suspended),
      banned: banned === null ? null : Date.parse(banned),
      listed: listed?.suspended_until == null ? null : Date.parse(listed.suspended_until),
      lifted: itsError(lifted),
      bannedAfter: bannedAfter === null ? null : 'banned',
    }).toEqual({
      suspended: onlyTheOverlord(role, 'Only the Overlord can suspend an account.'),
      banned: role === 'the Overlord' ? Date.parse(until) : null,
      listed: role === 'the Overlord' ? Date.parse(until) : null,
      lifted: onlyTheOverlord(role, 'Only the Overlord can lift a suspension.'),
      bannedAfter: role === 'the Overlord' ? null : 'banned',
    });
  });

  test('the Overlord suspends an account until it is lifted: a hundred years', async () => {
    const answer = await dbOf('the Overlord').theOverlordsAccounts.suspendThisAccountUntil(idOf('a rival'), null);
    const banned = await theBanOf(idOf('a rival'));
    await liftTheBan(idOf('a rival'));
    const years = banned === null ? 0 : (Date.parse(banned) - Date.now()) / (365.25 * A_DAY_MS);
    expect({ error: itsError(answer), years: Math.round(years) }).toEqual({ error: null, years: 100 });
  });

  test("the Overlord's own account, an end that has passed and an unknown account are refused", async () => {
    const accounts = dbOf('the Overlord').theOverlordsAccounts;
    const later = new Date(Date.now() + A_DAY_MS).toISOString();
    const before = new Date(Date.now() - A_DAY_MS).toISOString();
    expect({
      suspendOwn: itsError(await accounts.suspendThisAccountUntil(idOf('the Overlord'), later)),
      liftOwn: itsError(await accounts.liftThisAccountsSuspension(idOf('the Overlord'))),
      deleteOwn: itsError(await accounts.deleteThisAccount(idOf('the Overlord'))),
      passed: itsError(await accounts.suspendThisAccountUntil(idOf('a rival'), before)),
      suspendUnknown: itsError(await accounts.suspendThisAccountUntil(randomUUID(), later)),
      liftUnknown: itsError(await accounts.liftThisAccountsSuspension(randomUUID())),
      deleteUnknown: itsError(await accounts.deleteThisAccount(randomUUID())),
      banned: await theBanOf(idOf('a rival')),
    }).toEqual({
      suspendOwn: "This doesn't work on the Overlord's own account.",
      liftOwn: "This doesn't work on the Overlord's own account.",
      deleteOwn: "This doesn't work on the Overlord's own account.",
      passed: 'A suspension must end in the future.',
      suspendUnknown: 'No such account.',
      liftUnknown: 'No such account.',
      deleteUnknown: 'No such account.',
      banned: null,
    });
  });

  test.for(THE_ROLES)('%s: only the Overlord deletes an account', async (role) => {
    const id = await aNewAccount();
    const answer = await dbOf(role).theOverlordsAccounts.deleteThisAccount(id);
    expect({ error: itsError(answer), there: await stillThere(id) }).toEqual({
      error: onlyTheOverlord(role, 'Only the Overlord can delete an account.'),
      there: role !== 'the Overlord',
    });
  });

  test('an account that runs or plays in an unfinished game is not deleted', async () => {
    const accounts = dbOf('the Overlord').theOverlordsAccounts;
    expect({
      runs: itsError(await accounts.deleteThisAccount(idOf("the game's GM"))),
      plays: itsError(await accounts.deleteThisAccount(idOf('a player'))),
      there: [await stillThere(idOf("the game's GM")), await stillThere(idOf('a player'))],
    }).toEqual({
      runs: 'That account runs an unfinished game: hand it over first.',
      plays: 'That account plays in an unfinished game: suspend it instead until the game ends.',
      there: [true, true],
    });
  });

  test.for(THE_ROLES)('%s: only the Overlord offers Game Master, and withdraws the offer', async (role) => {
    const accounts = dbOf(role).theOverlordsAccounts;
    const offered = await accounts.offerThisAccountGameMaster(idOf('a rival'));
    const theRow = await theGameMasterRowOf(idOf('a rival'));
    if (role !== 'the Overlord')
      await dbOf('the Overlord').theOverlordsAccounts.offerThisAccountGameMaster(idOf('a rival'));
    const withdrawn = await accounts.withdrawTheGameMasterOfferToThisAccount(idOf('a rival'));
    const theRowAfter = await theGameMasterRowOf(idOf('a rival'));
    await removeTheGameMasterRowOf(idOf('a rival'));
    expect({ offered: itsError(offered), theRow, withdrawn: itsError(withdrawn), theRowAfter }).toEqual({
      offered: onlyTheOverlord(role, 'Only the Overlord can offer Game Master.'),
      theRow: role === 'the Overlord' ? { accepted_at: null, offered_by: idOf('the Overlord') } : null,
      withdrawn: onlyTheOverlord(role, 'Only the Overlord can withdraw an offer.'),
      theRowAfter: role === 'the Overlord' ? null : { accepted_at: null, offered_by: idOf('the Overlord') },
    });
  });

  test('an offer to a Game Master, to the Overlord or to no account is refused; so is withdrawing none, or one accepted', async () => {
    const accounts = dbOf('the Overlord').theOverlordsAccounts;
    expect({
      offerToAGameMaster: itsError(await accounts.offerThisAccountGameMaster(idOf("the game's GM"))),
      offerToTheOverlord: itsError(await accounts.offerThisAccountGameMaster(idOf('the Overlord'))),
      offerToNoAccount: itsError(await accounts.offerThisAccountGameMaster(randomUUID())),
      withdrawNone: itsError(await accounts.withdrawTheGameMasterOfferToThisAccount(idOf('a rival'))),
      withdrawAccepted: itsError(await accounts.withdrawTheGameMasterOfferToThisAccount(idOf("the game's GM"))),
      theGMsRow: await theGameMasterRowOf(idOf("the game's GM")),
    }).toEqual({
      offerToAGameMaster: 'That account is already a Game Master.',
      offerToTheOverlord: "The Overlord can't be a Game Master.",
      offerToNoAccount: 'No such account.',
      withdrawNone: 'That account has no offer to withdraw.',
      withdrawAccepted: 'That offer has been accepted: revoke the Game Master instead.',
      theGMsRow: { accepted_at: A_STRING, offered_by: null },
    });
  });

  test.for(THE_ROLES)('%s: only the Overlord revokes a Game Master who runs no unfinished game', async (role) => {
    const made = await world.theServiceRole
      .from('game_masters')
      .insert({ user_id: idOf('a rival'), accepted_at: new Date().toISOString() });
    if (made.error) throw new Error(`making the rival a Game Master: ${made.error.message}`);
    const answer = await dbOf(role).theOverlordsAccounts.revokeThisAccountsGameMaster(idOf('a rival'));
    const theRow = await theGameMasterRowOf(idOf('a rival'));
    await removeTheGameMasterRowOf(idOf('a rival'));
    expect({ error: itsError(answer), stillAGameMaster: theRow !== null }).toEqual({
      error: onlyTheOverlord(role, 'Only the Overlord can revoke a Game Master.'),
      stillAGameMaster: role !== 'the Overlord',
    });
  });

  test("a Game Master who runs an unfinished game, or an account that isn't one, is not revoked", async () => {
    const accounts = dbOf('the Overlord').theOverlordsAccounts;
    expect({
      runs: itsError(await accounts.revokeThisAccountsGameMaster(idOf("the game's GM"))),
      notOne: itsError(await accounts.revokeThisAccountsGameMaster(idOf('a player'))),
      theGMsRow: await theGameMasterRowOf(idOf("the game's GM")),
    }).toEqual({
      runs: 'That Game Master runs an unfinished game: hand it over first.',
      notOne: "That account isn't a Game Master.",
      theGMsRow: { accepted_at: A_STRING, offered_by: null },
    });
  });
});

describe("the Overlord's games", () => {
  /** The games each role reads of the two made-up ones, newest first. */
  const theGamesOf = (role: ARole): string[] =>
    role === 'the Overlord'
      ? [world.theOtherGMsGame, world.theGame]
      : role === 'another GM'
        ? [world.theOtherGMsGame]
        : role === 'signed out'
          ? []
          : [world.theGame];
  const lightColumns = (id: string, name: string, gm: ARoleWithAnAccount): unknown => ({
    id,
    name,
    gm_user_id: idOf(gm),
    status: 'active',
    turn: 3,
    max_turns: A_NUMBER,
    created_at: A_STRING,
    meta: null,
  });

  test.for(THE_ROLES)(
    '%s reads the games it may, newest first, their light columns only (none signed out)',
    async (role) => {
      const answer = await dbOf(role).theOverlordsGames.everyGameNewestFirstFromRowToRow(0, 199);
      const ours = [world.theGame, world.theOtherGMsGame];
      expect({
        error: itsError(answer),
        ours: (answer.data ?? []).filter((game) => ours.includes(game.id)),
      }).toEqual({
        error: role === 'signed out' ? NO_GRANT : null,
        ours: theGamesOf(role).map((id) =>
          id === world.theGame
            ? lightColumns(id, 'Made-up Marchwood', "the game's GM")
            : lightColumns(id, 'Made-up Fenmoor', 'another GM'),
        ),
      });
    },
  );

  test('the games come a page of rows at a time: rows 0 to 0, then 1 to 1', async () => {
    const games = dbOf('the Overlord').theOverlordsGames;
    const first = await games.everyGameNewestFirstFromRowToRow(0, 0);
    const second = await games.everyGameNewestFirstFromRowToRow(1, 1);
    expect({ first: first.data?.map((game) => game.id), second: second.data?.map((game) => game.id) }).toEqual({
      first: [world.theOtherGMsGame],
      second: [world.theGame],
    });
  });

  test.for(THE_ROLES)('%s: only the Overlord hands a game to another Game Master', async (role) => {
    const answer = await dbOf(role).theOverlordsGames.handThisGameToThisGameMaster(world.theGame, idOf('another GM'));
    const runBy = await whoRuns(world.theGame);
    await world.theServiceRole
      .from('games')
      .update({ gm_user_id: idOf("the game's GM") })
      .eq('id', world.theGame);
    expect({ error: itsError(answer), runBy }).toEqual({
      error: onlyTheOverlord(role, 'Only the Overlord can hand a game over.'),
      runBy: role === 'the Overlord' ? idOf('another GM') : idOf("the game's GM"),
    });
  });

  test("a game is never handed to the Overlord or to an account that isn't a Game Master, nor a game that doesn't exist", async () => {
    const games = dbOf('the Overlord').theOverlordsGames;
    expect({
      toTheOverlord: itsError(await games.handThisGameToThisGameMaster(world.theGame, idOf('the Overlord'))),
      toAPlayer: itsError(await games.handThisGameToThisGameMaster(world.theGame, idOf('a player'))),
      noSuchGame: itsError(await games.handThisGameToThisGameMaster(randomUUID(), idOf('another GM'))),
      runBy: await whoRuns(world.theGame),
    }).toEqual({
      toTheOverlord: "The Overlord doesn't run games.",
      toAPlayer: "That account isn't a Game Master.",
      noSuchGame: 'No such game.',
      runBy: idOf("the game's GM"),
    });
  });

  test.for(THE_ROLES)(
    '%s reads the names of the realms it may, of the games asked for (none signed out)',
    async (role) => {
      const answer = await dbOf(role).theOverlordsGames.theRealmsNamesOfTheseGames([
        world.theGame,
        world.theOtherGMsGame,
      ]);
      const realms = {
        0: { game_id: world.theGame, player_index: 0, display_name: 'Realm of Ashford' },
        1: { game_id: world.theGame, player_index: 1, display_name: 'Realm of Brackwater' },
        2: { game_id: world.theGame, player_index: 2, display_name: 'Realm of Coldharbour' },
        other: { game_id: world.theOtherGMsGame, player_index: 0, display_name: 'Realm of Dunmere' },
      };
      const expected: Readonly<Record<ARole, unknown[]>> = {
        'signed out': [],
        'a player': [realms[0]],
        'a rival': [realms[1]],
        "the game's GM": [realms[0], realms[1], realms[2]],
        'another GM': [realms.other],
        'the Overlord': [realms[0], realms[1], realms[2], realms.other],
      };
      const inOrder = [...(answer.data ?? [])].sort(
        (a, b) =>
          Number(a.game_id !== world.theGame) - Number(b.game_id !== world.theGame) || a.player_index - b.player_index,
      );
      expect({ error: itsError(answer), realms: inOrder }).toEqual({
        error: role === 'signed out' ? NO_GRANT : null,
        realms: expected[role],
      });
    },
  );

  test('the realms of no game asked for: none', async () => {
    const answer = await dbOf('the Overlord').theOverlordsGames.theRealmsNamesOfTheseGames([randomUUID()]);
    expect(inShort(answer)).toEqual({ data: [], error: null });
  });
});
