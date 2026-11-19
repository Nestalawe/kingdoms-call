// The balance matrix's `writes` column (tools/balance/writes.ts, P1-02c; recorded at Db's calls since P1-17s1): what
// the recorder sees of a turn's calls to the page's Db, when it takes its copy, and what its masking leaves out. The
// calls go to the fake the matrix plays on (tests/lib/fake-db.ts, the GM's world). Level 1 (unit): pure functions and a
// recorder over the fake; the matrix (npm run balance) plays the real turns.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The matrix's `writes` column (P1-02c), recorded at the calls to the page's Db, on the fake of the GM's world: every
// call that writes or calls a database function recorded in order, with its area, function and arguments, reads not,
// and every call still reaching the fake with its answer; the copy taken as the call is made; a write the fake refuses
// still recorded; the masking (stamps at a row's top level, `game_state` and `turn_report` parsed, a report handed
// whole as a string parsed, a `turn_logs` snapshot's build stamp, clock readings); a field dropped from `meta`, a turn
// changed, two writes swapped and one row left out each change the hash. TypeScript, in `unit/`
import { describe, expect, test } from 'vitest';
import { DB_VERSION } from '../lib/boot.ts';
import { aGameMastersWorld, makeAFakeDbHoldingTheGameMastersWorld } from '../lib/fake-db.ts';
import { playHash } from '../../tools/balance/hash.ts';
import {
  aQueryThatWrites,
  maskArgument,
  maskPayload,
  recordTheWritesAtTheDbsCalls,
  type Call,
} from '../../tools/balance/writes.ts';

/** The GM's world holding one game, G1, on turn 1, with one realm; its Db recorded. */
function aRecordedFake() {
  const world = aGameMastersWorld();
  world.tables.games.push({ id: 'G1', name: 'Matrix', gm_user_id: 'gm1', status: 'active', turn: 1, meta: {} });
  world.tables.game_players.push({ id: 'G1gp0', game_id: 'G1', player_index: 0, orders: '{}', orders_submitted: true });
  const fake = makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, world);
  return { world, fake, ...recordTheWritesAtTheDbsCalls(fake.db, world.calls) };
}

const save = (meta: Record<string, unknown>) => ({
  game_state: JSON.stringify({ turn: 2, turnMode: { turnRanAt: '2026-10-01T12:00:00.035Z' } }),
  meta,
  turn: 2,
});

/** The calls of one made-up turn: `edit` changes one thing about them. */
async function turn(
  edit: { meta?: Record<string, unknown>; turn?: number; swap?: boolean; rowLeftOut?: boolean } = {},
) {
  const { db, calls } = aRecordedFake();
  const theTurn = db.theTurnAsTheGameMasterRunsIt;
  const clear = () => theTurn.clearTheOrdersOfEveryRealmOfThisGame('G1');
  const saveIt = () =>
    theTurn.saveThisGameWhileOnThisTurnAndAnswerItsId('G1', edit.turn ?? 1, save(edit.meta ?? { v: 1 }));
  const realms = [0, 1, 2].filter((i) => !(edit.rowLeftOut && i === 2));
  const records = () =>
    db.theStatistics.writeTheseTurnRecords(
      realms.map((i) => ({ game_id: 'G1', turn: 1, player_index: i, is_bot: true, build: 'GM 2026.10.18-2300' })),
    );
  for (const q of edit.swap ? [saveIt, clear, records] : [clear, saveIt, records]) await q();
  return calls;
}

describe('the recorder', () => {
  test('records each call that writes or calls a database function, in order: its area, function and arguments; not reads', async () => {
    const { db, calls, world } = aRecordedFake();
    const theTurn = db.theTurnAsTheGameMasterRunsIt;
    expect((await theTurn.thisGameEveryColumn('G1')).data, 'a read still answers').toMatchObject({ turn: 1 });
    await theTurn.everyRealmOfThisGame('G1');
    expect(await theTurn.saveThisGameWhileOnThisTurnAndAnswerItsId('G1', 1, { turn: 2 }), 'a write too').toMatchObject({
      data: { id: 'G1' },
    });
    await theTurn.clearTheOrdersOfEveryRealmOfThisGame('G1');
    await db.thePlayersRealms.theSlotsOfTheseGames(['G1']);
    await db.theHallOfFame.deleteTheseGamesEntries(['G1']);
    expect((await theTurn.theTurnOfThisGameIfItIsThere('G1')).data, 'a read after the writes').toMatchObject({
      turn: 2,
    });
    expect(world.calls, 'every call still reaches the fake').toEqual([
      'games.select',
      'game_players.select',
      'games.update',
      'game_players.update',
      'rpc.get_game_slots',
      'game_records.delete',
      'games.select',
    ]);
    expect(world.tables.games[0]?.['turn'], 'and changes what it holds').toBe(2);
    expect(calls).toEqual<Call[]>([
      { call: 'theTurnAsTheGameMasterRunsIt.saveThisGameWhileOnThisTurnAndAnswerItsId', args: ['G1', 1, { turn: 2 }] },
      { call: 'theTurnAsTheGameMasterRunsIt.clearTheOrdersOfEveryRealmOfThisGame', args: ['G1'] },
      { call: 'thePlayersRealms.theSlotsOfTheseGames', args: [['G1']] },
      { call: 'theHallOfFame.deleteTheseGamesEntries', args: [['G1']] },
    ]);
  });

  test('takes its copy as the call is made: a later change to what was sent is not seen', async () => {
    const { db, calls } = aRecordedFake();
    const change = { turn: 2, meta: { realms: 3 } };
    const sent = db.theTurnAsTheGameMasterRunsIt.saveThisGameWhileOnThisTurnAndAnswerItsId('G1', 1, change);
    change.meta.realms = 9; // after the call: the fake may keep this object, but the write was already sent
    await sent;
    expect(calls[0]?.args).toEqual(['G1', 1, { turn: 2, meta: { realms: 3 } }]);
    expect(calls.splice(0)).toHaveLength(1);
    expect(calls, 'splice(0) takes one turn and leaves the list empty').toEqual([]);
  });

  test('a write the fake refuses is still recorded: it was sent', async () => {
    const { db, calls, world } = aRecordedFake();
    world.failing['turn_logs.insert'] = { message: 'refused' };
    const log = { game_id: 'G1', player_index: -1, turn: 1, entries: [] };
    expect((await db.theTurnAsTheGameMasterRunsIt.writeThisLog(log)).error).toEqual({ message: 'refused' });
    expect(calls).toEqual<Call[]>([{ call: 'theTurnAsTheGameMasterRunsIt.writeThisLog', args: [log] }]);
  });

  test('a query is a write by its operation, or a database function', () => {
    expect(
      ['games.insert', 'games.upsert', 'games.update', 'games.delete', 'rpc.get_game_slots'].map(aQueryThatWrites),
    ).toEqual([true, true, true, true, true]);
    expect(['games.select', 'game_players.select'].map(aQueryThatWrites)).toEqual([false, false]);
  });
});

describe("the masking (the other columns', hash.ts)", () => {
  test("drops the fake's ids and stamps and the build stamp at a row's top level, not deeper", () => {
    expect(
      maskPayload([
        { id: 'row7', created_at: 'x', updated_at: 'y', build: 'GM 2026.10.18-2300 tel1', turn: 1, pre: { id: 3 } },
      ]),
    ).toEqual([{ turn: 1, pre: { id: 3 } }]);
  });

  test('parses the JSON held as a string: the saved world as the state column sees it, a report as the report column does', () => {
    const report = { engineStamp: '2026.10.18-2300', playerIndex: 0, kingdom: { gold: 4, id: 2 } };
    expect(
      maskPayload({ game_state: JSON.stringify({ id: 1, turn: 2 }), turn_report: JSON.stringify(report) }),
    ).toEqual({ game_state: { id: 1, turn: 2 }, turn_report: { playerIndex: 0, kingdom: { gold: 4, id: 2 } } });
    expect(maskPayload({ game_state: 'not json' })).toEqual({ game_state: 'not json' });
  });

  test("a realm's report handed whole as a string is parsed and masked as the report column masks it; ids, turns and other strings are kept", async () => {
    const report = { engineStamp: '2026.10.18-2300', playerIndex: 0, kingdom: { gold: 4, id: 2 } };
    expect(maskArgument(JSON.stringify(report))).toEqual({ playerIndex: 0, kingdom: { gold: 4, id: 2 } });
    expect([maskArgument('G1gp0'), maskArgument('2'), maskArgument('[1]'), maskArgument(2)]).toEqual([
      'G1gp0',
      '2',
      '[1]',
      2,
    ]);
    const { db, calls } = aRecordedFake();
    await db.theTurnAsTheGameMasterRunsIt.giveThisRealmItsTurnReport('G1gp0', JSON.stringify(report));
    expect(calls).toEqual<Call[]>([
      {
        call: 'theTurnAsTheGameMasterRunsIt.giveThisRealmItsTurnReport',
        args: ['G1gp0', { playerIndex: 0, kingdom: { gold: 4, id: 2 } }],
      },
    ]);
  });

  test("a realm's turn_logs snapshot is its report: its build stamp goes too; the GM log's lines are kept", () => {
    expect(maskPayload({ player_index: 0, entries: { engineStamp: 'x', kingdom: { gold: 1 } } })).toEqual({
      player_index: 0,
      entries: { kingdom: { gold: 1 } },
    });
    const lines = [{ type: 'move', text: 'A moves.' }];
    expect(maskPayload({ player_index: -1, entries: lines })).toEqual({ player_index: -1, entries: lines });
  });

  test('once hashed, clock readings inside the parsed save and a rebuilt stamp make no difference', async () => {
    const a = await turn();
    const { db, calls } = aRecordedFake();
    const theTurn = db.theTurnAsTheGameMasterRunsIt;
    await theTurn.clearTheOrdersOfEveryRealmOfThisGame('G1');
    const later = { ...save({ v: 1 }), id: 'G1', updated_at: 'now', build: 'other' };
    later.game_state = later.game_state.replace('12:00:00.035Z', '12:00:00.071Z');
    await theTurn.saveThisGameWhileOnThisTurnAndAnswerItsId('G1', 1, later);
    await db.theStatistics.writeTheseTurnRecords(
      [0, 1, 2].map((i) => ({ game_id: 'G1', turn: 1, player_index: i, is_bot: true, build: 'GM 2026.11.17-0900' })),
    );
    expect(playHash(calls)).toBe(playHash(a));
  });
});

// The three faults P1-02c's Done-when plants on copies of the site, and P1-17s1's (one row left out), on one made-up
// turn.
describe('what changes the hash', () => {
  test("a field dropped from the save's meta, a turn changed, two writes swapped, one row left out", async () => {
    const base = playHash(await turn({ meta: { v: 1, realms: 3 } }));
    expect(playHash(await turn({ meta: { v: 1, realms: 3 } })), 'the same turn: the same hash').toBe(base);
    expect(playHash(await turn({ meta: { v: 1 } })), 'meta.realms dropped').not.toBe(base);
    expect(playHash(await turn({ meta: { v: 1, realms: 3 }, turn: 2 })), 'saved while on turn 2').not.toBe(base);
    expect(
      playHash(await turn({ meta: { v: 1, realms: 3 }, swap: true })),
      'the save before the orders are cleared',
    ).not.toBe(base);
    expect(
      playHash(await turn({ meta: { v: 1, realms: 3 }, rowLeftOut: true })),
      "a realm's turn record left out",
    ).not.toBe(base);
  });
});
