// Deleting a game and the GM's turn log, areas of the page's Db (src/db/the-db-interface-and-its-areas.ts:
// theDeletionOfAGame, theGameMastersTurnLogs; plan P1-17n), on a supabase-js client of the local Supabase, as each role
// (signed out, a player, a rival, the game's GM, another GM, the Overlord):
// - the turn log: the GM's whole log (-1) of one game and one turn, read by the game's GM, its players and the
//   Overlord;
// - the deletion: the page's 8 removals, in its order, on a game made for each test (run by the game's GM, played by
//   the player and the rival, with a row in each of the 8 tables): its GM and the Overlord remove every row; a player
//   removes only their own read marks; no one else removes any (no row matched, no error); Marchwood's rows (the same
//   GM's other game) stay whoever asks.
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
/** The error's words a call answered, or null. */
const itsError = (answer: { readonly error: { readonly message: string } | null }): string | null =>
  answer.error?.message ?? null;
/** Each role's answer: a visitor's refusal for want of a grant, else no error. */
const theErrorFor = (role: ARole): unknown => (role === 'signed out' ? NO_GRANT : null);

/** The 8 tables a game's deletion removes rows from, in the page's order. */
const THE_TABLES = [
  'turn_logs',
  'game_messages',
  'game_message_reads',
  'turn_events',
  'game_results',
  'game_records',
  'game_players',
  'games',
] as const;
type ATable = (typeof THE_TABLES)[number];
/** The rows of the game `game` in `table`, as the service role reads them (no rows: only their number). */
const theRowsOfThisGameIn = (table: ATable, game: string) => {
  const head = { count: 'exact', head: true } as const;
  const service = world.theServiceRole;
  if (table === 'games') return service.from('games').select('id', head).eq('id', game);
  if (table === 'game_players') return service.from('game_players').select('id', head).eq('game_id', game);
  if (table === 'turn_logs') return service.from('turn_logs').select('id', head).eq('game_id', game);
  return service.from(table).select('game_id', head).eq('game_id', game);
};
/** Removes the rows of the game `game` in `table`, through the service role. */
const removeTheRowsOfThisGameIn = (table: ATable, game: string) => {
  const service = world.theServiceRole;
  if (table === 'games') return service.from('games').delete().eq('id', game);
  if (table === 'game_players') return service.from('game_players').delete().eq('game_id', game);
  if (table === 'turn_logs') return service.from('turn_logs').delete().eq('game_id', game);
  return service.from(table).delete().eq('game_id', game);
};

/** Puts a row of the game `game` (named `name`) in each table but games and game_players (its realms are made with
 *  it): a log of its GM's and of realm 0, a dispatch, the player's read marks, a turn's statistics, a result and its
 *  Hall of Fame entry. */
const putARowInEachTable = async (game: string, name: string): Promise<void> => {
  const service = world.theServiceRole;
  const player = world.accounts['a player'];
  const made = await Promise.all([
    service.from('turn_logs').insert(
      [-1, 0].map((realm) => ({
        game_id: game,
        turn: 1,
        player_index: realm,
        entries: [{ text: `Made-up words of ${name}` }],
      })),
    ),
    service.from('game_messages').insert({
      game_id: game,
      turn: 1,
      from_index: 0,
      from_user_id: player,
      to_indexes: [],
      scope: 'public',
      body: `Made-up words to ${name}`,
    }),
    service.from('game_message_reads').insert({ game_id: game, player_index: 0, user_id: player, reads: {} }),
    service.from('turn_events').insert({ game_id: game, turn: 1, player_index: 0, realm: 'Realm of Ashford' }),
    service.from('game_results').insert({ game_id: game, player_index: 0, realm: 'Realm of Ashford' }),
    service.from('game_records').insert({
      game_id: game,
      game_name: name,
      gm_user_id: world.accounts["the game's GM"],
      finished_at: '2026-01-01T00:00:00Z',
      turns: 1,
    }),
  ]);
  for (const answer of made) if (answer.error) throw new Error(`making ${name}'s rows: ${answer.error.message}`);
};
/** The number of rows of the game `game` in each table, as the service role counts them. */
const theRowsOf = async (game: string): Promise<Record<ATable, number>> => {
  const counts = await Promise.all(
    THE_TABLES.map(async (table) => {
      const { count, error } = await theRowsOfThisGameIn(table, game);
      if (error) throw new Error(`counting ${table}: ${error.message}`);
      return [table, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<ATable, number>;
};
/** Every table holding `n` rows but the logs (2: the GM's and realm 0's) and the realms (2: the player's, the rival's). */
const rowsInEachTable = (logs: number, realms: number, others: number): Record<ATable, number> => ({
  turn_logs: logs,
  game_messages: others,
  game_message_reads: others,
  turn_events: others,
  game_results: others,
  game_records: others,
  game_players: realms,
  games: others,
});
/** A game as made: every row there. */
const EVERY_ROW = rowsInEachTable(2, 2, 1);
/** Removes every row of the game `game` in each table, through the service role. */
const removeEveryRowOf = async (game: string): Promise<void> => {
  for (const table of THE_TABLES) await removeTheRowsOfThisGameIn(table, game);
};

/** The games made for the deletion's tests, removed after. */
const madeForTheDeletion: string[] = [];
/** Makes a game to delete, run by the game's GM, the player in realm 0 and the rival in realm 1, a row in each table. */
const makeAGameToDelete = async (role: ARole): Promise<string> => {
  const service = world.theServiceRole;
  const name = `Made-up Doomhollow (${role})`;
  const game = await service
    .from('games')
    .insert({ name, gm_user_id: world.accounts["the game's GM"], status: 'active', turn: 2 })
    .select('id')
    .single();
  if (game.error) throw new Error(`making ${name}: ${game.error.message}`);
  madeForTheDeletion.push(game.data.id);
  const realms = await service.from('game_players').insert([
    { game_id: game.data.id, user_id: world.accounts['a player'], player_index: 0, display_name: 'Realm of Ashford' },
    { game_id: game.data.id, user_id: world.accounts['a rival'], player_index: 1, display_name: 'Realm of Brackwater' },
  ]);
  if (realms.error) throw new Error(`making ${name}'s realms: ${realms.error.message}`);
  await putARowInEachTable(game.data.id, name);
  return game.data.id;
};

beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'deletion');
  await putARowInEachTable(world.theGame, 'Made-up Marchwood');
  const logs = await world.theServiceRole.from('turn_logs').insert([
    { game_id: world.theGame, turn: 2, player_index: -1, entries: [{ text: 'The GM sees turn 2' }] },
    { game_id: world.theGame, turn: 2, player_index: 0, entries: [{ text: 'Realm 0 sees turn 2' }] },
    { game_id: world.theOtherGMsGame, turn: 2, player_index: -1, entries: [{ text: 'Fenmoor sees turn 2' }] },
  ]);
  if (logs.error) throw new Error(`making the logs: ${logs.error.message}`);
  for (const role of THE_ROLES) clients.set(role, await world.signedInAs(role));
});
afterAll(async () => {
  for (const game of [...madeForTheDeletion, world.theGame, world.theOtherGMsGame]) await removeEveryRowOf(game);
  await world.removeIt();
});

describe("the GM's whole log of a turn: read by the game's GM, its players and the Overlord", () => {
  test.for(THE_ROLES)("%s: Marchwood's GM's log of turn 2", async (role) => {
    const answer = await dbOf(role).theGameMastersTurnLogs.theWholeLogOfThisGameInThisTurn(world.theGame, 2);
    const reads = role !== 'signed out' && role !== 'another GM';
    expect({
      error: itsError(answer),
      rows: (answer.data ?? []).map((row) => [row.game_id === world.theGame, row.turn, row.player_index, row.entries]),
    }).toEqual({
      error: theErrorFor(role),
      rows: reads ? [[true, 2, -1, [{ text: 'The GM sees turn 2' }]]] : [],
    });
  });
});

describe('deleting a game: its GM and the Overlord remove its rows; a player only their own read marks', () => {
  /** The rows of the deleted game left after `role` asked for each removal. */
  const leftAfter = (role: ARole): Record<ATable, number> => {
    if (role === "the game's GM" || role === 'the Overlord') return rowsInEachTable(0, 0, 0);
    if (role === 'a player') return { ...EVERY_ROW, game_message_reads: 0 };
    return EVERY_ROW;
  };
  test.for(THE_ROLES)('%s: the 8 removals, in the page’s order', async (role) => {
    const game = await makeAGameToDelete(role);
    const marchwoodBefore = await theRowsOf(world.theGame);
    const deletion = dbOf(role).theDeletionOfAGame;
    const answers = [
      await deletion.removeThisGamesTurnLogs(game),
      await deletion.removeThisGamesDispatches(game),
      await deletion.removeThisGamesReadMarks(game),
      await deletion.removeThisGamesTurnEvents(game),
      await deletion.removeThisGamesResults(game),
      await deletion.removeThisGamesHallOfFameEntry(game),
      await deletion.removeThisGamesRealms(game),
      await deletion.removeThisGame(game),
    ];
    expect({
      errors: answers.map(itsError),
      left: await theRowsOf(game),
      marchwood: await theRowsOf(world.theGame),
    }).toEqual({
      errors: answers.map(() => theErrorFor(role)),
      left: leftAfter(role),
      marchwood: marchwoodBefore,
    });
  });
});
