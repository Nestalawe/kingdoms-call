// Turn 0 as the GM page runs it, an area of the page's Db (src/db/the-db-interface-and-its-areas.ts:
// theTurnZeroAsTheGameMasterRunsIt; plan P1-17p), on a supabase-js client of the local Supabase, as each role (signed
// out, a player, a rival, the game's GM, another GM, the Overlord):
// - the reads: Marchwood's realms, and Marchwood with its realms, by its GM, its players (their own realm) and the
//   Overlord;
// - the bots' realms: one made, and every bot's realm of the game removed (no player's, no other game's), by its GM and
//   the Overlord;
// - the start: the world saved, each realm's first report with its orders cleared, a realm's turn-0 log, each by those
//   the access rules let change them.
// A visitor is refused for want of a grant. Every row is made here through the local service role and removed after.
// Level db (the access layer, against the local Supabase): the queries and the access rules together, which no lower
// level holds (pgTAP checks the rules in SQL; the page tests run on the stand-in).
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
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
/** A row the access rules refuse to add, in their words (a restrictive rule names itself). */
const refusedByTheRulesFor = (table: string): unknown =>
  expect.stringMatching(new RegExp(`row-level security policy (".+" )?for table "${table}"`));
/** The error's words a call answered, or null. */
const itsError = (answer: { readonly error: { readonly message: string } | null }): string | null =>
  answer.error?.message ?? null;
/** Each role's answer: a visitor's refusal for want of a grant, else no error. */
const theErrorFor = (role: ARole): unknown => (role === 'signed out' ? NO_GRANT : null);

/** Who reads Marchwood: its GM, its two players and the Overlord. */
const readsMarchwood = (role: ARole): boolean => role !== 'signed out' && role !== 'another GM';
/** Who reads and changes every realm of Marchwood, and changes the game: its GM and the Overlord. */
const runsMarchwood = (role: ARole): boolean => role === "the game's GM" || role === 'the Overlord';
/** The slots of Marchwood's realms `role` reads and changes: every one, its own, or none. */
const marchwoodsRealmsFor = (role: ARole): number[] =>
  runsMarchwood(role) ? [0, 1, 2] : role === 'a player' ? [0] : role === 'a rival' ? [1] : [];

/** Marchwood's world as made here, to put back after each change. */
const MARCHWOODS_WORLD = JSON.stringify({ madeUp: 'Marchwood' });
/** The made-up orders each realm holds before a test (one JSON text, as the page writes it). */
const ORDERS = JSON.stringify({ orders: { 'the hero': 'hold' } });
/** The ids of Marchwood's realms, by slot (beforeAll). */
const realmIds: string[] = [];
const realmOf = (slot: number): string => {
  const id = realmIds[slot];
  if (id === undefined) throw new Error(`no realm ${String(slot)}`);
  return id;
};
/** Puts Marchwood back as made: its world, turn 3, each realm's orders in and submitted, no report. */
const putMarchwoodBack = async (): Promise<void> => {
  const service = world.theServiceRole;
  const game = await service.from('games').update({ game_state: MARCHWOODS_WORLD, turn: 3 }).eq('id', world.theGame);
  if (game.error) throw new Error(`putting Marchwood back: ${game.error.message}`);
  const realms = await service
    .from('game_players')
    .update({ orders: ORDERS, orders_submitted: true, turn_report: null })
    .eq('game_id', world.theGame);
  if (realms.error) throw new Error(`putting Marchwood's realms back: ${realms.error.message}`);
};
/** Marchwood's world and turn, and each realm's orders, flag and report by slot, as the service role reads them. */
const marchwoodNow = async () => {
  const service = world.theServiceRole;
  const game = await service.from('games').select('game_state,turn').eq('id', world.theGame).single();
  if (game.error) throw new Error(`reading Marchwood: ${game.error.message}`);
  const realms = await service
    .from('game_players')
    .select('player_index,orders,orders_submitted,turn_report')
    .eq('game_id', world.theGame)
    .order('player_index');
  if (realms.error) throw new Error(`reading Marchwood's realms: ${realms.error.message}`);
  return {
    world: game.data.game_state,
    turn: game.data.turn,
    realms: realms.data.map((r) => [r.player_index, r.orders, r.orders_submitted, r.turn_report]),
  };
};
/** The slots of the game `game`'s realms, as the service role reads them. */
const theSlotsOf = async (game: string): Promise<number[]> => {
  const { data, error } = await world.theServiceRole
    .from('game_players')
    .select('player_index')
    .eq('game_id', game)
    .order('player_index');
  if (error) throw new Error(`reading the slots: ${error.message}`);
  return data.map((r) => r.player_index);
};
/** Marchwood's bot (Coldharbour, slot 2) and the other GM's game's bot (Dunmere, slot 0), as made (beforeAll). */
let coldharbour = '';
let dunmere = '';
/** A bot's realm a test adds to Marchwood, in a slot no made-up realm holds. */
const EASTWICK_SLOT = 7;
const eastwick = (game: string) => ({
  game_id: game,
  user_id: null,
  player_index: EASTWICK_SLOT,
  display_name: 'Realm of Eastwick',
  orders_submitted: false,
  turn_report: JSON.stringify({ isBot: true, status: 'bot', waitingForTurn0: true }),
});
/** Puts the bots back as made: Eastwick gone; Coldharbour and Dunmere there, with their ids. */
const putTheBotsBack = async (): Promise<void> => {
  const service = world.theServiceRole;
  await service.from('game_players').delete().eq('game_id', world.theGame).eq('player_index', EASTWICK_SLOT);
  const bots = [
    { id: coldharbour, game_id: world.theGame, user_id: null, player_index: 2, display_name: 'Realm of Coldharbour' },
    { id: dunmere, game_id: world.theOtherGMsGame, user_id: null, player_index: 0, display_name: 'Realm of Dunmere' },
  ];
  const { error } = await service.from('game_players').upsert(bots, { onConflict: 'id' });
  if (error) throw new Error(`putting the bots back: ${error.message}`);
};

beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'turnzero');
  const service = world.theServiceRole;
  const realms = await service
    .from('game_players')
    .select('id,player_index')
    .eq('game_id', world.theGame)
    .order('player_index');
  if (realms.error) throw new Error(`reading Marchwood's realms: ${realms.error.message}`);
  for (const realm of realms.data) realmIds[realm.player_index] = realm.id;
  coldharbour = realmOf(2);
  const other = await service.from('game_players').select('id').eq('game_id', world.theOtherGMsGame).single();
  if (other.error) throw new Error(`reading Dunmere: ${other.error.message}`);
  dunmere = other.data.id;
  await putMarchwoodBack();
  for (const role of THE_ROLES) clients.set(role, await world.signedInAs(role));
});
afterAll(async () => {
  await world.theServiceRole.from('turn_logs').delete().eq('game_id', world.theGame);
  await world.removeIt();
});

describe('the reads: Marchwood by its GM, its players and the Overlord; its realms by their own player too', () => {
  test.for(THE_ROLES)('%s: every realm it reads, and the game with its realms', async (role) => {
    const turnZero = dbOf(role).theTurnZeroAsTheGameMasterRunsIt;
    const realms = await turnZero.everyRealmOfThisGame(world.theGame);
    const game = await turnZero.thisGameWithItsRealms(world.theGame);
    const reads = readsMarchwood(role);
    expect({
      errors: [itsError(realms), itsError(game)],
      realms: (realms.data ?? []).map((realm) => realm.player_index).sort(),
      game: game.data && [
        game.data.id === world.theGame,
        game.data.turn,
        game.data.game_players.map((realm) => realm.player_index).sort(),
      ],
    }).toEqual({
      errors: [theErrorFor(role), reads ? null : role === 'signed out' ? NO_GRANT : NO_SUCH_ROW],
      realms: marchwoodsRealmsFor(role),
      game: reads ? [true, 3, marchwoodsRealmsFor(role)] : null,
    });
  });
});

describe("the bots' realms: made, and removed, by Marchwood's GM and the Overlord", () => {
  test.for(THE_ROLES)("%s: makes Eastwick, a bot's realm, and answers it", async (role) => {
    const made = await dbOf(role).theTurnZeroAsTheGameMasterRunsIt.makeThisBotsRealm(eastwick(world.theGame));
    const slots = await theSlotsOf(world.theGame);
    await putTheBotsBack();
    const makes = runsMarchwood(role);
    expect({
      error: itsError(made),
      answer: made.data && [made.data.game_id === world.theGame, made.data.player_index, made.data.display_name],
      slots,
    }).toEqual({
      error: makes ? null : role === 'signed out' ? NO_GRANT : refusedByTheRulesFor('game_players'),
      answer: makes ? [true, EASTWICK_SLOT, 'Realm of Eastwick'] : null,
      slots: makes ? [0, 1, 2, EASTWICK_SLOT] : [0, 1, 2],
    });
  });
  test.for(THE_ROLES)("%s: removes every bot's realm of Marchwood, no player's and no other game's", async (role) => {
    const added = await world.theServiceRole.from('game_players').insert(eastwick(world.theGame));
    if (added.error) throw new Error(`adding Eastwick: ${added.error.message}`);
    const removed = await dbOf(role).theTurnZeroAsTheGameMasterRunsIt.removeEveryBotsRealmOfThisGame(world.theGame);
    const slots = [await theSlotsOf(world.theGame), await theSlotsOf(world.theOtherGMsGame)];
    await putTheBotsBack();
    expect({ error: itsError(removed), slots }).toEqual({
      error: theErrorFor(role),
      slots: [runsMarchwood(role) ? [0, 1] : [0, 1, 2, EASTWICK_SLOT], [0]],
    });
  });
});

describe('the start: the world, the first reports and the logs, by those the rules let change them', () => {
  test.for(THE_ROLES)('%s: starts Marchwood: its world saved, on turn 1', async (role) => {
    const started = await dbOf(role).theTurnZeroAsTheGameMasterRunsIt.startThisGame(world.theGame, {
      status: 'active',
      turn: 1,
      game_state: JSON.stringify({ started: role }),
    });
    const after = await marchwoodNow();
    await putMarchwoodBack();
    const changes = runsMarchwood(role);
    expect({ error: itsError(started), saved: [after.world, after.turn] }).toEqual({
      error: theErrorFor(role),
      saved: changes ? [JSON.stringify({ started: role }), 1] : [MARCHWOODS_WORLD, 3],
    });
  });
  test.for(THE_ROLES)('%s: gives realm 0 and realm 1 their first reports, their orders cleared', async (role) => {
    const turnZero = dbOf(role).theTurnZeroAsTheGameMasterRunsIt;
    const report = JSON.stringify({ madeUp: `a first report from ${role}` });
    const answers = [
      await turnZero.giveThisRealmItsFirstReport(realmOf(0), report),
      await turnZero.giveThisRealmItsFirstReport(realmOf(1), report),
    ];
    const after = await marchwoodNow();
    await putMarchwoodBack();
    const changes = (slot: number): boolean => slot < 2 && marchwoodsRealmsFor(role).includes(slot);
    expect({ errors: answers.map(itsError), realms: after.realms }).toEqual({
      errors: answers.map(() => theErrorFor(role)),
      realms: [0, 1, 2].map((slot) => (changes(slot) ? [slot, null, false, report] : [slot, ORDERS, true, null])),
    });
  });
  test.for(THE_ROLES)("%s: writes realm 0's turn-0 log", async (role) => {
    const answer = await dbOf(role).theTurnZeroAsTheGameMasterRunsIt.writeThisLog({
      game_id: world.theGame,
      player_index: 0,
      turn: 0,
      entries: { madeUp: role },
    });
    const { data, error } = await world.theServiceRole
      .from('turn_logs')
      .select('player_index,turn,entries')
      .eq('game_id', world.theGame);
    if (error) throw new Error(`reading the logs: ${error.message}`);
    await world.theServiceRole.from('turn_logs').delete().eq('game_id', world.theGame);
    const writes = runsMarchwood(role);
    expect({ error: itsError(answer), logs: data.map((row) => [row.player_index, row.turn, row.entries]) }).toEqual({
      error: writes ? null : role === 'signed out' ? NO_GRANT : refusedByTheRulesFor('turn_logs'),
      logs: writes ? [[0, 0, { madeUp: role }]] : [],
    });
  });
});
