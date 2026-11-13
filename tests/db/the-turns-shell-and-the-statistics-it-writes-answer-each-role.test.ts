// The turn as the GM page's shell runs it, and the statistics it writes, areas of the page's Db
// (src/db/the-db-interface-and-its-areas.ts: theTurnAsTheGameMasterRunsIt, and theStatistics' and theHallOfFamesGames'
// functions for the results' backfill; plan P1-17o), on a supabase-js client of the local Supabase, as each role (signed
// out, a player, a rival, the game's GM, another GM, the Overlord):
// - the reads: Marchwood, its realms and its turn, by its GM, its players (their own realm) and the Overlord;
// - the writes: the orders cleared and put back, the world saved while on its turn, a realm's report, a log, and the
//   statistics (a turn's records, a finished game's results), each by those the access rules let change them;
// - the backfill's reads: the GM's finished games, the games that have results, one game with its world and realms.
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
/** The slots of Marchwood's realms `role` reads: every one, its own, or none. */
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
/** Each realm as put back: its orders in and submitted, no report. */
const AS_PUT_BACK = [0, 1, 2].map((slot) => [slot, ORDERS, true, null]);

/** The rows the statistics' tests leave in a table for the game `game`, as the service role reads them. */
const theStatisticsOf = async (game: string) => {
  const service = world.theServiceRole;
  const events = await service.from('turn_events').select('turn,player_index,realm').eq('game_id', game);
  const results = await service.from('game_results').select('player_index,realm').eq('game_id', game);
  if (events.error || results.error) throw new Error('reading the statistics');
  return { events: events.data.map((r) => [r.turn, r.player_index, r.realm]), results: results.data };
};
/** Removes every statistics row and log of the game `game`, through the service role. */
const removeTheStatisticsAndLogsOf = async (game: string): Promise<void> => {
  const service = world.theServiceRole;
  await service.from('turn_events').delete().eq('game_id', game);
  await service.from('game_results').delete().eq('game_id', game);
  await service.from('turn_logs').delete().eq('game_id', game);
};
/** The game's GM's finished game (beforeAll), with a result; its id. */
let westfold = '';

beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'turnshell');
  const service = world.theServiceRole;
  const realms = await service
    .from('game_players')
    .select('id,player_index')
    .eq('game_id', world.theGame)
    .order('player_index');
  if (realms.error) throw new Error(`reading Marchwood's realms: ${realms.error.message}`);
  for (const realm of realms.data) realmIds[realm.player_index] = realm.id;
  await putMarchwoodBack();
  const made = await service
    .from('games')
    .insert({ name: 'Made-up Westfold', gm_user_id: world.accounts["the game's GM"], status: 'complete', turn: 9 })
    .select('id')
    .single();
  if (made.error) throw new Error(`making Westfold: ${made.error.message}`);
  westfold = made.data.id;
  const result = await service.from('game_results').insert({ game_id: westfold, player_index: 0, realm: 'Eastmarch' });
  if (result.error) throw new Error(`making Westfold's result: ${result.error.message}`);
  for (const role of THE_ROLES) clients.set(role, await world.signedInAs(role));
});
afterAll(async () => {
  for (const game of [world.theGame, world.theOtherGMsGame, westfold]) await removeTheStatisticsAndLogsOf(game);
  await world.theServiceRole.from('games').delete().eq('id', westfold);
  await world.removeIt();
});

describe('the reads: Marchwood by its GM, its players and the Overlord; its realms by their own player too', () => {
  test.for(THE_ROLES)('%s: the game, every realm it reads, and its turn', async (role) => {
    const turn = dbOf(role).theTurnAsTheGameMasterRunsIt;
    const game = await turn.thisGameEveryColumn(world.theGame);
    const realms = await turn.everyRealmOfThisGame(world.theGame);
    const itsTurn = await turn.theTurnOfThisGameIfItIsThere(world.theGame);
    const reads = readsMarchwood(role);
    expect({
      errors: [itsError(game), itsError(realms), itsError(itsTurn)],
      game: game.data && [game.data.id === world.theGame, game.data.turn],
      realms: (realms.data ?? []).map((realm) => realm.player_index).sort(),
      turn: itsTurn.data,
    }).toEqual({
      errors: [reads ? null : role === 'signed out' ? NO_GRANT : NO_SUCH_ROW, theErrorFor(role), theErrorFor(role)],
      game: reads ? [true, 3] : null,
      realms: marchwoodsRealmsFor(role),
      turn: reads ? { turn: 3 } : null,
    });
  });
});

describe('the writes: the orders, the world, the reports and the logs, by those the rules let change them', () => {
  test.for(THE_ROLES)("%s: clears every realm's orders, then puts realm 0's back", async (role) => {
    const turn = dbOf(role).theTurnAsTheGameMasterRunsIt;
    await world.theServiceRole
      .from('game_players')
      .update({ orders: null, orders_submitted: false })
      .eq('game_id', world.theGame);
    const putBack = await turn.putBackThisRealmsOrders(realmOf(0), ORDERS, true);
    const afterPutBack = await marchwoodNow();
    await putMarchwoodBack();
    const cleared = await turn.clearTheOrdersOfEveryRealmOfThisGame(world.theGame);
    const afterClear = await marchwoodNow();
    await putMarchwoodBack();
    const changes = (slot: number): boolean => marchwoodsRealmsFor(role).includes(slot);
    expect({
      errors: [itsError(putBack), itsError(cleared)],
      afterPutBack: afterPutBack.realms,
      afterClear: afterClear.realms,
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role)],
      afterPutBack: [0, 1, 2].map((slot) => [
        slot,
        slot === 0 && changes(0) ? ORDERS : null,
        slot === 0 && changes(0),
        null,
      ]),
      afterClear: AS_PUT_BACK.map(([slot]) =>
        changes(Number(slot)) ? [slot, null, false, null] : [slot, ORDERS, true, null],
      ),
    });
  });
  test.for(THE_ROLES)('%s: saves the world while on its turn, and not once it has moved on', async (role) => {
    const turn = dbOf(role).theTurnAsTheGameMasterRunsIt;
    const onItsTurn = await turn.saveThisGameWhileOnThisTurnAndAnswerItsId(world.theGame, 3, {
      game_state: JSON.stringify({ saved: role }),
      turn: 4,
      status: 'active',
    });
    const afterOnItsTurn = await marchwoodNow();
    await putMarchwoodBack();
    const movedOn = await turn.saveThisGameWhileOnThisTurnAndAnswerItsId(world.theGame, 2, {
      game_state: JSON.stringify({ late: role }),
      turn: 3,
    });
    const afterMovedOn = await marchwoodNow();
    await putMarchwoodBack();
    const changes = runsMarchwood(role);
    expect({
      errors: [itsError(onItsTurn), itsError(movedOn)],
      answers: [onItsTurn.data, movedOn.data],
      saved: [afterOnItsTurn.world, afterOnItsTurn.turn, afterMovedOn.world, afterMovedOn.turn],
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role)],
      answers: [changes ? { id: world.theGame } : null, null],
      saved: [changes ? JSON.stringify({ saved: role }) : MARCHWOODS_WORLD, changes ? 4 : 3, MARCHWOODS_WORLD, 3],
    });
  });
  test.for(THE_ROLES)('%s: gives realm 0 and realm 1 their reports', async (role) => {
    const turn = dbOf(role).theTurnAsTheGameMasterRunsIt;
    const report = JSON.stringify({ madeUp: `a report from ${role}` });
    const answers = [
      await turn.giveThisRealmItsTurnReport(realmOf(0), report),
      await turn.giveThisRealmItsTurnReport(realmOf(1), report),
    ];
    const after = await marchwoodNow();
    await putMarchwoodBack();
    const changes = (slot: number): boolean => marchwoodsRealmsFor(role).includes(slot);
    expect({ errors: answers.map(itsError), reports: after.realms.map((r) => r[3]) }).toEqual({
      errors: answers.map(() => theErrorFor(role)),
      reports: [changes(0) ? report : null, changes(1) ? report : null, null],
    });
  });
  test.for(THE_ROLES)("%s: writes the GM's whole log and realm 0's", async (role) => {
    const turn = dbOf(role).theTurnAsTheGameMasterRunsIt;
    const answers = [
      await turn.writeThisLog({ game_id: world.theGame, player_index: -1, turn: 7, entries: [{ text: role }] }),
      await turn.writeThisLog({ game_id: world.theGame, player_index: 0, turn: 7, entries: { madeUp: role } }),
    ];
    const { data, error } = await world.theServiceRole
      .from('turn_logs')
      .select('player_index,entries')
      .eq('game_id', world.theGame)
      .eq('turn', 7)
      .order('player_index');
    if (error) throw new Error(`reading the logs: ${error.message}`);
    await world.theServiceRole.from('turn_logs').delete().eq('game_id', world.theGame).eq('turn', 7);
    const writes = runsMarchwood(role);
    expect({ errors: answers.map(itsError), logs: data.map((row) => [row.player_index, row.entries]) }).toEqual({
      errors: answers.map(() => (writes ? null : role === 'signed out' ? NO_GRANT : refusedByTheRulesFor('turn_logs'))),
      logs: writes
        ? [
            [-1, [{ text: role }]],
            [0, { madeUp: role }],
          ]
        : [],
    });
  });
});

describe("the statistics: written, and the backfill's reads, by the game's GM and the Overlord", () => {
  test.for(THE_ROLES)(
    "%s: writes a turn's records and the results, each twice (the second over the first)",
    async (role) => {
      const statistics = dbOf(role).theStatistics;
      const game = world.theGame;
      const records = (realm: string) => [
        { game_id: game, turn: 3, player_index: 0, realm },
        { game_id: game, turn: 3, player_index: 1, realm },
      ];
      const results = (realm: string) => [{ game_id: game, player_index: 0, realm }];
      const answers = [
        await statistics.writeTheseTurnRecords(records('Ashford')),
        await statistics.writeTheseTurnRecords(records('Ashford again')),
        await statistics.writeTheseResults(results('Ashford')),
        await statistics.writeTheseResults(results('Ashford again')),
      ];
      const after = await theStatisticsOf(game);
      await removeTheStatisticsAndLogsOf(game);
      const writes = runsMarchwood(role);
      const refusal = (table: string): unknown =>
        writes ? null : role === 'signed out' ? NO_GRANT : refusedByTheRulesFor(table);
      expect({ errors: answers.map(itsError), ...after }).toEqual({
        errors: [refusal('turn_events'), refusal('turn_events'), refusal('game_results'), refusal('game_results')],
        events: writes
          ? [
              [3, 0, 'Ashford again'],
              [3, 1, 'Ashford again'],
            ]
          : [],
        results: writes ? [{ player_index: 0, realm: 'Ashford again' }] : [],
      });
    },
  );
  test.for(THE_ROLES)("%s: the GM's finished games, those with results, and one game with its realms", async (role) => {
    const db = dbOf(role);
    const finished = await db.theHallOfFamesGames.theIdNameAndStateOfTheFinishedGamesThisGameMasterRuns(
      world.accounts["the game's GM"],
    );
    const withResults = await db.theStatistics.theGamesOfTheseGamesResults([westfold, world.theGame]);
    const full = await db.theHallOfFamesGames.thisGamesIdNameAndWorldWithEveryColumnOfItsRealms(world.theGame);
    const runs = runsMarchwood(role);
    const reads = readsMarchwood(role);
    expect({
      errors: [itsError(finished), itsError(withResults), itsError(full)],
      finished: (finished.data ?? []).map((g) => [g.id === westfold, g.name, g.status]),
      withResults: (withResults.data ?? []).map((r) => r.game_id === westfold),
      full: full.data && [
        full.data.id === world.theGame,
        full.data.game_state,
        full.data.game_players.map((realm) => realm.player_index).sort(),
      ],
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role), reads ? null : role === 'signed out' ? NO_GRANT : NO_SUCH_ROW],
      finished: runs ? [[true, 'Made-up Westfold', 'complete']] : [],
      withResults: runs ? [true] : [],
      full: reads ? [true, MARCHWOODS_WORLD, marchwoodsRealmsFor(role)] : null,
    });
  });
});
