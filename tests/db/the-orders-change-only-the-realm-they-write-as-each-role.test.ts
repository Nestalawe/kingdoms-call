// The orders, an area of the page's Db (src/db/the-db-interface-and-its-areas.ts: theOrders; plan P1-17k, P2-05), on a
// supabase-js client of the local Supabase, as each role (signed out, a player, a rival, the game's GM, another GM, the
// Overlord):
// - the draft, the hero order, Revise and Submit save through the database's function submit_orders, for the game and
//   the turn the order form shows: each changes only the realm the signed-in account holds in that game (the player's,
//   the rival's), and only what it saves; the game's GM, another GM and the Overlord hold no realm there and are
//   refused, and a visitor is refused for want of a grant;
// - each save for a past turn (a form left open while the turn ran), or after the turn's deadline (staged in the game's
//   meta, a day long past), is refused with the function's words, and no realm changes; before a deadline still to come
//   (a year far ahead), it is saved.
// The refusals' words are the ones the stand-in gives (tests/lib/fake-db.ts, THE_WORDS_SUBMIT_ORDERS_REFUSES_WITH), so
// the page tests' stand-in says what the database says. Each test sets every realm's orders back through the local
// service role first.
// Level db (the access layer, against the local Supabase): the queries and the access rules together, which no lower
// level holds (pgTAP checks the function in SQL; the page tests run on the stand-in).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, test } from 'vitest';
import {
  makeTheDbFromItsClient,
  type ADatabaseAnswer,
  type Db,
  type TheDatabaseClient,
} from '../../src/db/the-db-interface-and-its-areas.ts';
import { THE_WORDS_SUBMIT_ORDERS_REFUSES_WITH as REFUSED } from '../lib/fake-db.ts';
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
const NO_GRANT: unknown = expect.stringMatching(/^permission denied for function submit_orders$/);
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
/** The realm `role` holds in the game: the player's Ashford, the rival's Brackwater, else none. */
const theRealmOf = (role: ARole): ARealmsName | null =>
  role === 'a player' ? 'Ashford' : role === 'a rival' ? 'Brackwater' : null;
/** Each role's answer to a save for the game's turn: a visitor's refusal for want of a grant, no realm held, or none. */
const theErrorFor = (role: ARole): unknown =>
  role === 'signed out' ? NO_GRANT : theRealmOf(role) === null ? REFUSED.noRealm : null;

/** A realm's orders columns, as a test reads them back. */
interface ARealmsOrders {
  readonly orders: unknown;
  readonly submitted: boolean;
  readonly submittedAt: unknown;
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
/** Stages the game's turn mode (null: none saved), through the service role. */
const stageTheTurnMode = async (turnMode: Record<string, unknown> | null): Promise<void> => {
  const { error } = await world.theServiceRole
    .from('games')
    .update({ meta: turnMode === null ? null : { turnMode } })
    .eq('id', world.theGame);
  if (error) throw new Error(`staging the turn mode: ${error.message}`);
};
/** A turn mode with its next deadline at `at`. */
const aDeadlineAt = (at: string): Record<string, unknown> => ({
  mode: 'deadline',
  time: '20:00',
  everyDays: 1,
  nextDeadlineAt: at,
});

/** The game's turn (beforeAll): not the other game's, so a save for the wrong game shows. */
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

/** The new orders `who` sends for the turn `turn` (one JSON text naming its turn, as the order form writes it). */
const theNewOrders = (who: string, turn: number = THE_GAMES_TURN): string =>
  JSON.stringify({ orders: { [`hero of ${who}`]: 'march' }, encounterPlans: {}, forTurn: turn });

/** One of the four saves: its name, whether the realms' orders are submitted before it, how the page calls it (for
 *  the game, the turn the form shows and its orders), and what it leaves of the realm it saves. */
interface ASave {
  readonly name: string;
  readonly submittedBefore: boolean;
  readonly save: (db: Db, game: string, turn: number, orders: string) => PromiseLike<ADatabaseAnswer<unknown>>;
  readonly saved: (before: ARealmsOrders, orders: string) => ARealmsOrders;
}
/** Stamped with the database's time as it saves (a time later than BEFORE). */
const STAMPED_NOW: unknown = expect.toSatisfy((at: unknown) => typeof at === 'number' && at > BEFORE);
const THE_SAVES: readonly ASave[] = [
  {
    name: 'the draft: its orders, no longer submitted',
    submittedBefore: true,
    save: (db, game, turn, orders) => db.theOrders.saveThisRealmsDraft(game, turn, orders),
    saved: (before, orders) => ({ ...before, orders, submitted: false }),
  },
  {
    name: 'the hero order: its orders alone, still submitted',
    submittedBefore: true,
    save: (db, game, turn, orders) => db.theOrders.saveThisRealmsHeroOrder(game, turn, orders),
    saved: (before, orders) => ({ ...before, orders }),
  },
  {
    name: 'Revise: no longer submitted, its orders kept',
    submittedBefore: true,
    save: (db, game, turn) => db.theOrders.reopenThisRealmsOrders(game, turn),
    saved: (before) => ({ ...before, submitted: false }),
  },
  {
    name: 'Submit: its orders, submitted, stamped with the time',
    submittedBefore: false,
    save: (db, game, turn, orders) => db.theOrders.submitThisRealmsOrders(game, turn, orders),
    saved: (_before, orders) => ({ orders, submitted: true, submittedAt: STAMPED_NOW }),
  },
];

describe('each save changes only the realm the signed-in account holds in the game, for the turn the form shows', () => {
  describe.each(THE_SAVES)('$name', (s) => {
    beforeEach(async () => {
      await setEveryRealmBack(s.submittedBefore);
    });
    test.for(THE_ROLES)('%s', async (role) => {
      const answer = await s.save(dbOf(role), world.theGame, THE_GAMES_TURN, theNewOrders(role));
      const expected = everyRealmBefore(s.submittedBefore);
      const realm = theRealmOf(role);
      if (realm !== null) expected[realm] = s.saved(expected[realm], theNewOrders(role));
      expect({ error: itsError(answer), realms: await everyRealmNow() }).toEqual({
        error: theErrorFor(role),
        realms: expected,
      });
    });
  });
});

describe("the player's save is refused for a past turn, and after the turn's deadline; saved before a deadline to come", () => {
  afterEach(async () => {
    await stageTheTurnMode(null);
  });
  describe.each(THE_SAVES)('$name', (s) => {
    beforeEach(async () => {
      await setEveryRealmBack(s.submittedBefore);
    });
    test('for a past turn (the form left open while the turn ran): refused, nothing changed', async () => {
      const past = THE_GAMES_TURN - 1;
      const answer = await s.save(dbOf('a player'), world.theGame, past, theNewOrders('a player', past));
      expect({ error: itsError(answer), realms: await everyRealmNow() }).toEqual({
        error: REFUSED.theTurn(past, THE_GAMES_TURN),
        realms: everyRealmBefore(s.submittedBefore),
      });
    });
    test("after the turn's deadline: refused, nothing changed", async () => {
      await stageTheTurnMode(aDeadlineAt('2000-01-01T20:00:00.000Z'));
      const answer = await s.save(dbOf('a player'), world.theGame, THE_GAMES_TURN, theNewOrders('a player'));
      expect({ error: itsError(answer), realms: await everyRealmNow() }).toEqual({
        error: REFUSED.late,
        realms: everyRealmBefore(s.submittedBefore),
      });
    });
    test('before a deadline still to come: saved', async () => {
      await stageTheTurnMode(aDeadlineAt('2999-01-01T20:00:00.000Z'));
      const answer = await s.save(dbOf('a player'), world.theGame, THE_GAMES_TURN, theNewOrders('a player'));
      const expected = everyRealmBefore(s.submittedBefore);
      expected.Ashford = s.saved(expected.Ashford, theNewOrders('a player'));
      expect({ error: itsError(answer), realms: await everyRealmNow() }).toEqual({ error: null, realms: expected });
    });
  });
});
