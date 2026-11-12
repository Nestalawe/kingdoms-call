// The orders, an area of the page's Db (src/db/the-db-interface-and-its-areas.ts: theOrders; plan P1-17k), on a
// supabase-js client of the local Supabase, as each role (signed out, a player, a rival, the game's GM, another GM, the
// Overlord):
// - the draft, the hero order, Revise and Submit (game_players): each changes only the realm it writes, and only the
//   columns it names; a realm is changed by its own player, the game's GM and the Overlord, never by a rival or another
//   GM (no row matched, no error), and a visitor is refused for want of a grant;
// - the turn check (games): the turn of the game, read by its GM, its players and the Overlord.
// The orders are written today as they are (P1-17's Open choice 3); P2-05 later checks them in the database.
// Each test sets every realm's orders back through the local service role first.
// Level db (the access layer, against the local Supabase): the queries and the access rules together, which no lower
// level holds (pgTAP checks the rules in SQL; the page tests run on the stand-in).
import { afterAll, beforeAll, beforeEach, describe, expect, inject, test } from 'vitest';
import {
  makeTheDbFromItsClient,
  type Db,
  type TheDatabaseClient,
} from '../../src/db/the-db-interface-and-its-areas.ts';
import {
  makeAMadeUpWorld,
  THE_ROLES,
  type AMadeUpWorld,
  type ARole,
} from '../lib/made-up-accounts-in-each-role-on-the-local-supabase.ts';

const local = inject('theLocalSupabase');
let world: AMadeUpWorld;
const clients = new Map<ARole, TheDatabaseClient>();

/** The Db on `role`'s client, signed in (beforeAll). */
const dbOf = (role: ARole): Db => {
  const client = clients.get(role);
  if (!client) throw new Error(`no client for ${role}`);
  return makeTheDbFromItsClient(client);
};
/** A refusal for want of a grant (signed out: the anon role has none), in its words. */
const NO_GRANT: unknown = expect.stringMatching(/permission denied/);
/** A single row's read that found none (or one it may not read), in the database's words. */
const NO_SUCH_ROW: unknown = expect.stringMatching(/^Cannot coerce the result to a single JSON object$/);
/** The error's words a call answered, or null. */
const itsError = (answer: { readonly error: { readonly message: string } | null }): string | null =>
  answer.error?.message ?? null;

/** The world's four realms, by name: three in Marchwood (the player's, the rival's, a bot's) and a bot's in Fenmoor. */
const THE_REALMS = ['Ashford', 'Brackwater', 'Coldharbour', 'Dunmere'] as const;
type ARealmsName = (typeof THE_REALMS)[number];
const realmIdOf = new Map<ARealmsName, string>();
const idOfRealm = (name: ARealmsName): string => {
  const id = realmIdOf.get(name);
  if (id === undefined) throw new Error(`no realm ${name}`);
  return id;
};
/** The two realms a test writes: the player's and the rival's. */
const THE_REALMS_WRITTEN = ['Ashford', 'Brackwater'] as const;
/** Who changes each realm written: its own player, the game's GM and the Overlord. */
const changes = (role: ARole, realm: (typeof THE_REALMS_WRITTEN)[number]): boolean =>
  role === (realm === 'Ashford' ? 'a player' : 'a rival') || role === "the game's GM" || role === 'the Overlord';
/** Each role's answer to a write: a visitor's refusal for want of a grant, else no error (none matched, or one). */
const theErrorFor = (role: ARole): unknown => (role === 'signed out' ? NO_GRANT : null);

/** A realm's orders columns, as a test reads them back. */
interface ARealmsOrders {
  readonly orders: unknown;
  readonly submitted: boolean;
  readonly submittedAt: number | null;
}
/** The time every realm's orders were last submitted, before a test. */
const BEFORE = Date.parse('2026-01-02T03:04:05.000Z');
/** The made-up orders each realm holds before a test (one JSON text, as the page writes it). */
const theOrdersBefore = (name: ARealmsName): string => JSON.stringify({ orders: { [`hero of ${name}`]: 'hold' } });
/** Every realm's orders as before a test, each submitted or not (`submitted`). */
const everyRealmBefore = (submitted: boolean): Record<ARealmsName, ARealmsOrders> => {
  const entries = THE_REALMS.map((name) => [name, { orders: theOrdersBefore(name), submitted, submittedAt: BEFORE }]);
  return Object.fromEntries(entries) as Record<ARealmsName, ARealmsOrders>;
};
/** Sets every realm's orders back (each submitted or not), through the service role. */
const setEveryRealmBack = async (submitted: boolean): Promise<void> => {
  for (const name of THE_REALMS) {
    const { error } = await world.theServiceRole
      .from('game_players')
      .update({
        orders: theOrdersBefore(name),
        orders_submitted: submitted,
        last_submitted_at: new Date(BEFORE).toISOString(),
      })
      .eq('id', idOfRealm(name));
    if (error) throw new Error(`setting ${name} back: ${error.message}`);
  }
};
/** Every realm's orders, read through the service role. */
const everyRealmNow = async (): Promise<Record<ARealmsName, ARealmsOrders>> => {
  const { data, error } = await world.theServiceRole
    .from('game_players')
    .select('id,orders,orders_submitted,last_submitted_at')
    .in('id', THE_REALMS.map(idOfRealm));
  if (error) throw new Error(`reading the realms: ${error.message}`);
  const now = THE_REALMS.map((name) => {
    const row = data.find((each) => each.id === idOfRealm(name));
    if (!row) throw new Error(`no row for ${name}`);
    const at = row.last_submitted_at;
    return [
      name,
      { orders: row.orders, submitted: row.orders_submitted, submittedAt: at === null ? null : Date.parse(at) },
    ];
  });
  return Object.fromEntries(now) as Record<ARealmsName, ARealmsOrders>;
};

/** The game's turn (beforeAll): not the other game's, so a read of the wrong game shows. */
const THE_GAMES_TURN = 4;

beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'orders');
  const service = world.theServiceRole;
  const { data, error } = await service
    .from('game_players')
    .select('id,game_id,player_index')
    .in('game_id', [world.theGame, world.theOtherGMsGame]);
  if (error) throw new Error(`reading the realms: ${error.message}`);
  const byPlace = (game: string, index: number): string => {
    const row = data.find((each) => each.game_id === game && each.player_index === index);
    if (!row) throw new Error(`no realm ${String(index)}`);
    return row.id;
  };
  realmIdOf.set('Ashford', byPlace(world.theGame, 0));
  realmIdOf.set('Brackwater', byPlace(world.theGame, 1));
  realmIdOf.set('Coldharbour', byPlace(world.theGame, 2));
  realmIdOf.set('Dunmere', byPlace(world.theOtherGMsGame, 0));
  const turn = await service.from('games').update({ turn: THE_GAMES_TURN }).eq('id', world.theGame);
  if (turn.error) throw new Error(`setting the game's turn: ${turn.error.message}`);
  for (const role of THE_ROLES) clients.set(role, await world.signedInAs(role));
});
afterAll(async () => {
  await world.removeIt();
});

/** Each role and each realm it writes. */
const EACH_ROLE_AND_REALM = THE_ROLES.flatMap((role) => THE_REALMS_WRITTEN.map((realm) => [role, realm] as const));
/** The new orders a test writes into `realm`. */
const theNewOrders = (realm: ARealmsName): string =>
  JSON.stringify({ orders: { [`hero of ${realm}`]: 'march' }, forTurn: THE_GAMES_TURN });

describe("each write changes only the realm it writes, if the role may change it: its player, the game's GM, the Overlord", () => {
  describe('the draft: its orders, no longer submitted', () => {
    beforeEach(async () => {
      await setEveryRealmBack(true);
    });
    test.for(EACH_ROLE_AND_REALM)('%s, %s', async ([role, realm]) => {
      const answer = await dbOf(role).theOrders.saveThisRealmsDraft(idOfRealm(realm), theNewOrders(realm));
      const expected = everyRealmBefore(true);
      if (changes(role, realm)) expected[realm] = { ...expected[realm], orders: theNewOrders(realm), submitted: false };
      expect({ error: itsError(answer), realms: await everyRealmNow() }).toEqual({
        error: theErrorFor(role),
        realms: expected,
      });
    });
  });
  describe('the hero order: its orders alone, still submitted', () => {
    beforeEach(async () => {
      await setEveryRealmBack(true);
    });
    test.for(EACH_ROLE_AND_REALM)('%s, %s', async ([role, realm]) => {
      const answer = await dbOf(role).theOrders.saveThisRealmsHeroOrder(idOfRealm(realm), theNewOrders(realm));
      const expected = everyRealmBefore(true);
      if (changes(role, realm)) expected[realm] = { ...expected[realm], orders: theNewOrders(realm) };
      expect({ error: itsError(answer), realms: await everyRealmNow() }).toEqual({
        error: theErrorFor(role),
        realms: expected,
      });
    });
  });
  describe('Revise: no longer submitted, its orders kept', () => {
    beforeEach(async () => {
      await setEveryRealmBack(true);
    });
    test.for(EACH_ROLE_AND_REALM)('%s, %s', async ([role, realm]) => {
      const answer = await dbOf(role).theOrders.reopenThisRealmsOrders(idOfRealm(realm));
      const expected = everyRealmBefore(true);
      if (changes(role, realm)) expected[realm] = { ...expected[realm], submitted: false };
      expect({ error: itsError(answer), realms: await everyRealmNow() }).toEqual({
        error: theErrorFor(role),
        realms: expected,
      });
    });
  });
  describe('Submit: its orders, submitted, at its time', () => {
    beforeEach(async () => {
      await setEveryRealmBack(false);
    });
    const SUBMITTED_AT = '2026-03-04T05:06:07.000Z';
    test.for(EACH_ROLE_AND_REALM)('%s, %s', async ([role, realm]) => {
      const answer = await dbOf(role).theOrders.submitThisRealmsOrders(
        idOfRealm(realm),
        theNewOrders(realm),
        SUBMITTED_AT,
      );
      const expected = everyRealmBefore(false);
      if (changes(role, realm))
        expected[realm] = { orders: theNewOrders(realm), submitted: true, submittedAt: Date.parse(SUBMITTED_AT) };
      expect({ error: itsError(answer), realms: await everyRealmNow() }).toEqual({
        error: theErrorFor(role),
        realms: expected,
      });
    });
  });
});

describe("the turn check: the game's turn, read by its GM, its players and the Overlord", () => {
  /** Who reads the game's turn. */
  const readsTheGame = (role: ARole): boolean =>
    role === 'a player' || role === 'a rival' || role === "the game's GM" || role === 'the Overlord';
  test.for(THE_ROLES)('%s', async (role) => {
    const answer = await dbOf(role).theOrders.theTurnOfThisGame(world.theGame);
    expect({ error: itsError(answer), data: answer.data }).toEqual(
      readsTheGame(role)
        ? { error: null, data: { turn: THE_GAMES_TURN } }
        : { error: role === 'signed out' ? NO_GRANT : NO_SUCH_ROW, data: null },
    );
  });
});
