// The sign-in and accounts area of the page's Db (src/db/the-db-interface-and-its-areas.ts: signingIn, theAccountsNames,
// theRoles; plan P1-17e), on a supabase-js client of the local Supabase, as each role (signed out, a player, a rival, the
// game's GM, another GM, the Overlord):
// - signing in: each account signs in with its address and password, a wrong password or an unknown address is refused;
//   the session kept is the account's, none signed out; signing up (a visitor) makes the account with its name, the
//   profile's too; the password and the name kept with the sign-in change for an account, never signed out; signing
//   out leaves no session;
// - the accounts' names (profiles): every signed-in account reads each account's id, name and joining day, in the names'
//   order when asked, never its email (the column privilege tests/lib/stub-db.js holds as REVOKED_COLS); a visitor reads
//   none; an account names itself, and no other;
// - the roles: is_game_master() is true for the two Game Masters, is_site_admin() for the Overlord, false for the rest,
//   refused signed out; an account reads its own Game Master offer (the Overlord every one); an open offer is accepted
//   or declined by its account, and "You have no offer to accept / decline" otherwise (the stand-in's four mirrors).
// The tests run in order: each role's client is signed in once (beforeAll, through the Db), the offer's answer after
// the roles, the password and the sign-out last.
// Level db (the access layer, against the local Supabase): the queries and the access rules together, which no lower
// level holds (pgTAP checks the rules in SQL; the page tests run on the stand-in).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
import {
  makeTheDbFromItsClient,
  type ASignInAnswer,
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
/** Each account's name, set by the service role: in the names' order as the roles are. */
const THE_NAMES: Readonly<Record<ARoleWithAnAccount, string>> = {
  'a player': 'Made-up Aldric',
  'a rival': 'Made-up Brenna',
  "the game's GM": 'Made-up Cedric',
  'another GM': 'Made-up Dorwin',
  'the Overlord': 'Made-up Elspeth',
};
const A_NEW_PASSWORD = 'another-made-up-password-for-the-local-database';
const THE_GAME_MASTERS: readonly ARole[] = ["the game's GM", 'another GM'];

const local = inject('theLocalSupabase');
let world: AMadeUpWorld;
const clients = new Map<ARole, TheDatabaseClient>();
const signIns = new Map<ARoleWithAnAccount, ASignInAnswer>();
const signedUp: string[] = [];

/** The Db on `role`'s client, signed in (beforeAll). */
const dbOf = (role: ARole): Db => {
  const client = clients.get(role);
  if (!client) throw new Error(`no client for ${role}`);
  return makeTheDbFromItsClient(client);
};
const idOf = (role: ARoleWithAnAccount): string => world.accounts[role];
/** Any string (a time the database sets). */
const A_STRING: unknown = expect.any(String);
/** What a call answered, in short: its data and its error's words. */
const inShort = (answer: { readonly data: unknown; readonly error: { readonly message: string } | null }): unknown => ({
  data: answer.data,
  error: answer.error?.message ?? null,
});
/** A refusal for want of a grant (signed out: the anon role has none), in its words. */
const NO_GRANT: unknown = expect.stringMatching(/permission denied/);
/** A call refused for want of a grant. */
const REFUSED: unknown = { data: null, error: NO_GRANT };
/** A change to the account refused for want of a session. */
const NO_SESSION: unknown = expect.stringMatching(/session missing/i);
/** The account's name, as the service role reads it. */
const theNameHeld = async (role: ARoleWithAnAccount): Promise<string | null | undefined> =>
  (await world.theServiceRole.from('profiles').select('name').eq('id', idOf(role)).single()).data?.name;

beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'signin');
  for (const role of THE_ROLES_WITH_AN_ACCOUNT) {
    const { error } = await world.theServiceRole
      .from('profiles')
      .upsert({ id: idOf(role), name: THE_NAMES[role] }, { onConflict: 'id' });
    if (error) throw new Error(`naming ${role}: ${error.message}`);
  }
  clients.set('signed out', await world.signedInAs('signed out'));
  for (const role of THE_ROLES_WITH_AN_ACCOUNT) {
    const client = await world.signedInAs('signed out');
    signIns.set(
      role,
      await makeTheDbFromItsClient(client).signingIn.signInWithEmailAndPassword(
        world.addressOf(role),
        THE_MADE_UP_PASSWORD,
      ),
    );
    clients.set(role, client);
  }
});
afterAll(async () => {
  for (const id of signedUp) await world.theServiceRole.auth.admin.deleteUser(id);
  await world.removeIt();
});

describe('signing in', () => {
  test.for(THE_ROLES_WITH_AN_ACCOUNT)('%s signs in with its address and password', (role) => {
    const answer = signIns.get(role);
    expect({
      error: answer?.error ?? null,
      user: answer?.data.user?.id,
      session: answer?.data.session?.user.id,
    }).toEqual({ error: null, user: idOf(role), session: idOf(role) });
  });

  test('a wrong password, or an address with no account, is refused', async () => {
    const db = makeTheDbFromItsClient(await world.signedInAs('signed out'));
    for (const [address, password] of [
      [world.addressOf('a player'), 'not-the-password'],
      [`kc-access-nobody-${randomUUID().slice(0, 8)}@example.test`, THE_MADE_UP_PASSWORD],
    ] as const)
      expect(inShort(await db.signingIn.signInWithEmailAndPassword(address, password))).toEqual({
        data: { user: null, session: null },
        error: 'Invalid login credentials',
      });
  });

  test.for(THE_ROLES)("%s: the session kept is the account's, none signed out", async (role) => {
    const { data, error } = await dbOf(role).signingIn.theSessionKeptInThisBrowser();
    expect({ error, account: data.session?.user.id ?? null }).toEqual({
      error: null,
      account: role === 'signed out' ? null : idOf(role),
    });
  });
});

describe("the accounts' names", () => {
  const ours = (): string[] => THE_ROLES_WITH_AN_ACCOUNT.map(idOf);
  /** Our accounts' rows of `rows`, in the order they came. */
  const oursOf = (rows: readonly { readonly id: string }[] | null): unknown[] =>
    (rows ?? []).filter((row) => ours().includes(row.id));
  /** Our accounts' rows of `rows`, in the roles' order. */
  const oursInTheRolesOrder = (rows: readonly { readonly id: string }[] | null): unknown[] =>
    (rows ?? []).filter((row) => ours().includes(row.id)).sort((a, b) => ours().indexOf(a.id) - ours().indexOf(b.id));
  const expected = (withTheDay: boolean): unknown[] =>
    THE_ROLES_WITH_AN_ACCOUNT.map((role) => ({
      id: idOf(role),
      name: THE_NAMES[role],
      ...(withTheDay ? { created_at: A_STRING } : {}),
    }));

  test.for(THE_ROLES)('%s reads the names of these accounts (none signed out)', async (role) => {
    const answer = await dbOf(role).theAccountsNames.theNamesOfTheseAccounts(ours());
    expect(
      role === 'signed out' ? inShort(answer) : { data: oursInTheRolesOrder(answer.data), error: answer.error },
    ).toEqual(role === 'signed out' ? REFUSED : { data: expected(false), error: null });
    expect(answer.data?.length ?? 0).toBe(role === 'signed out' ? 0 : 5);
  });

  test.for(THE_ROLES)("%s reads every account's name, only its id and name (none signed out)", async (role) => {
    const answer = await dbOf(role).theAccountsNames.theNameOfEveryAccount();
    expect(
      role === 'signed out' ? inShort(answer) : { data: oursInTheRolesOrder(answer.data), error: answer.error },
    ).toEqual(role === 'signed out' ? REFUSED : { data: expected(false), error: null });
  });

  test.for(THE_ROLES)(
    "%s reads every account's name and joining day, in the names' order (none signed out)",
    async (role) => {
      const answer = await dbOf(role).theAccountsNames.theNameAndJoiningDateOfEveryAccountInNameOrder();
      expect(role === 'signed out' ? inShort(answer) : { data: oursOf(answer.data), error: answer.error }).toEqual(
        role === 'signed out' ? REFUSED : { data: expected(true), error: null },
      );
    },
  );

  test.for(THE_ROLES)("%s reads one account's name, an unknown one's refused (none signed out)", async (role) => {
    const db = dbOf(role);
    const own = await db.theAccountsNames.theNameOfThisAccount(role === 'signed out' ? idOf('a player') : idOf(role));
    const unknown = await db.theAccountsNames.theNameOfThisAccount(randomUUID());
    expect({ own: inShort(own), unknown: unknown.status }).toEqual(
      role === 'signed out'
        ? { own: REFUSED, unknown: 401 }
        : { own: { data: { id: idOf(role), name: THE_NAMES[role] }, error: null }, unknown: 406 },
    );
  });

  test.for(THE_ROLES)('%s is never handed an email (REVOKED_COLS: the column privilege)', async (role) => {
    const client = clients.get(role);
    if (!client) throw new Error(`no client for ${role}`);
    expect(inShort(await client.from('profiles').select('id,email').eq('id', idOf('a player')))).toEqual(REFUSED);
  });

  test.for(THE_ROLES)('%s names itself, and no other account (none signed out)', async (role) => {
    const db = dbOf(role);
    const other: ARoleWithAnAccount = role === 'a rival' ? 'a player' : 'a rival';
    const theirs = await db.theAccountsNames.giveThisAccountItsName(idOf(other), 'Made-up Usurper');
    const own = role === 'signed out' ? null : role;
    const renamed = own === null ? '' : `${THE_NAMES[own]} the Second`;
    const ownAnswer = own === null ? null : await db.theAccountsNames.giveThisAccountItsName(idOf(own), renamed);
    expect({
      theirs: theirs.error === null ? 'renamed' : 'refused',
      theirName: await theNameHeld(other),
      own: ownAnswer?.error ?? null,
      ownName: own === null ? null : await theNameHeld(own),
    }).toEqual({ theirs: 'refused', theirName: THE_NAMES[other], own: null, ownName: own === null ? null : renamed });
    if (own !== null) await world.theServiceRole.from('profiles').update({ name: THE_NAMES[own] }).eq('id', idOf(own));
  });
});

describe('the roles', () => {
  test.for(THE_ROLES)('%s: a Game Master only if it is one (refused signed out)', async (role) => {
    expect(inShort(await dbOf(role).theRoles.isTheSignedInAccountAGameMaster())).toEqual(
      role === 'signed out' ? REFUSED : { data: THE_GAME_MASTERS.includes(role), error: null },
    );
  });

  test.for(THE_ROLES)('%s: the Overlord only if it is one (refused signed out)', async (role) => {
    expect(inShort(await dbOf(role).theRoles.isTheSignedInAccountTheOverlord())).toEqual(
      role === 'signed out' ? REFUSED : { data: role === 'the Overlord', error: null },
    );
  });

  test.for(THE_ROLES)("%s reads its own Game Master offer, and the game's GM's only as the Overlord", async (role) => {
    const db = dbOf(role);
    const own = await db.theRoles.theGameMasterOfferMadeToThisAccount(
      role === 'signed out' ? idOf('a player') : idOf(role),
    );
    const theGMs = await db.theRoles.theGameMasterOfferMadeToThisAccount(idOf("the game's GM"));
    const accepted: unknown = { accepted_at: A_STRING };
    expect({ own: inShort(own), theGMs: inShort(theGMs) }).toEqual(
      role === 'signed out'
        ? { own: REFUSED, theGMs: REFUSED }
        : {
            own: { data: THE_GAME_MASTERS.includes(role) ? accepted : null, error: null },
            theGMs: {
              data: role === 'the Overlord' || role === "the game's GM" ? accepted : null,
              error: null,
            },
          },
    );
  });
});

describe("the Game Master offer's answer", () => {
  const offerTheRivalGameMaster = async (): Promise<void> => {
    const { error } = await world.theServiceRole
      .from('game_masters')
      .insert({ user_id: idOf('a rival'), offered_by: idOf('the Overlord') });
    if (error) throw new Error(`offering: ${error.message}`);
  };
  const theRivalsOffer = async (): Promise<unknown> =>
    (await world.theServiceRole.from('game_masters').select('accepted_at').eq('user_id', idOf('a rival')).maybeSingle())
      .data;

  test('an open offer declined is gone', async () => {
    await offerTheRivalGameMaster();
    const declined = await dbOf('a rival').theRoles.answerTheGameMasterOffer('gm_decline_offer');
    expect({ error: declined.error, offer: await theRivalsOffer() }).toEqual({ error: null, offer: null });
  });

  test('an open offer accepted makes a Game Master', async () => {
    await offerTheRivalGameMaster();
    const accepted = await dbOf('a rival').theRoles.answerTheGameMasterOffer('gm_accept_offer');
    const aGameMaster = await dbOf('a rival').theRoles.isTheSignedInAccountAGameMaster();
    await world.theServiceRole.from('game_masters').delete().eq('user_id', idOf('a rival'));
    expect({ error: accepted.error, aGameMaster: aGameMaster.data }).toEqual({ error: null, aGameMaster: true });
  });

  test.for(THE_ROLES)(
    '%s, with no open offer: accepting changes nothing for a Game Master, else refused',
    async (role) => {
      const db = dbOf(role);
      const accepted = await db.theRoles.answerTheGameMasterOffer('gm_accept_offer');
      const declined = await db.theRoles.answerTheGameMasterOffer('gm_decline_offer');
      expect({ accepted: accepted.error?.message ?? null, declined: declined.error?.message ?? null }).toEqual(
        role === 'signed out'
          ? { accepted: NO_GRANT, declined: NO_GRANT }
          : {
              accepted: THE_GAME_MASTERS.includes(role) ? null : 'You have no offer to accept.',
              declined: 'You have no offer to decline.',
            },
      );
    },
  );
});

describe('changing the account, signing up and signing out', () => {
  test.for(THE_ROLES)('%s changes the name kept with its sign-in (not signed out)', async (role) => {
    const { data, error } = await dbOf(role).signingIn.changeTheNameKeptWithTheSignIn(`Made-up name of ${role}`);
    expect({
      error: error?.message ?? null,
      account: data.user?.id,
      name: data.user?.user_metadata['display_name'],
    }).toEqual(
      role === 'signed out'
        ? { error: NO_SESSION, account: undefined, name: undefined }
        : { error: null, account: idOf(role), name: `Made-up name of ${role}` },
    );
  });

  test.for(THE_ROLES)('%s changes its password (not signed out)', async (role) => {
    const { data, error } = await dbOf(role).signingIn.changeThePassword(A_NEW_PASSWORD);
    expect({ error: error?.message ?? null, account: data.user?.id }).toEqual(
      role === 'signed out' ? { error: NO_SESSION, account: undefined } : { error: null, account: idOf(role) },
    );
  });

  test('the new password signs in', async () => {
    const db = makeTheDbFromItsClient(await world.signedInAs('signed out'));
    const { data, error } = await db.signingIn.signInWithEmailAndPassword(world.addressOf('a player'), A_NEW_PASSWORD);
    expect({ error, account: data.user?.id }).toEqual({ error: null, account: idOf('a player') });
  });

  test('a visitor signs up with a name: the account, its session, and its profile by that name', async () => {
    const db = makeTheDbFromItsClient(await world.signedInAs('signed out'));
    const address = `kc-access-signup-${randomUUID().slice(0, 8)}@example.test`;
    const { data, error } = await db.signingIn.signUpWithEmailPasswordAndName(
      address,
      THE_MADE_UP_PASSWORD,
      'Made-up Fenwick',
    );
    if (data.user) signedUp.push(data.user.id);
    const profile = await world.theServiceRole
      .from('profiles')
      .select('name')
      .eq('id', data.user?.id ?? '')
      .maybeSingle();
    expect({
      error,
      address: data.user?.email,
      name: data.user?.user_metadata['display_name'],
      session: data.session?.user.id,
      profile: profile.data,
    }).toEqual({
      error: null,
      address,
      name: 'Made-up Fenwick',
      session: data.user?.id,
      profile: { name: 'Made-up Fenwick' },
    });
  });

  test.for(THE_ROLES)('%s signs out, and no session is kept', async (role) => {
    const db = dbOf(role);
    const { error } = await db.signingIn.signOut();
    const { data } = await db.signingIn.theSessionKeptInThisBrowser();
    expect({ error, session: data.session }).toEqual({ error: null, session: null });
  });
});
