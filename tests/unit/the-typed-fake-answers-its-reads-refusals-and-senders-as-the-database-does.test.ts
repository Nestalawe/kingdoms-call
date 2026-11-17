// The typed fake (tests/lib/fake-db.ts) answers as the database does, in the cases no screen tour or page test reaches
// (plan P1-21, the mutation session of 2026-11-17 over P1-17t to P1-17s2). The tours and the Dispatches spec
// stage worlds too small to tell these apart: one page of dispatches, no private game, no refused rename.
// Level 1 (unit): each world is made and asked directly, through the Db the fake answers with; a page test would boot a
// page to reach one call, and its outcome would hang on what the page shows.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// - the GM's world: with more dispatches than a page holds, the newest page answers the newest first, the read after a
//   dispatch the next ones oldest first, the read before it the earlier ones newest first, each of its game only;
//   get_game_slots on a private game in setup answers nothing to an account it doesn't invite, and answers the invited
//   one;
// - the Hall of Fame's world with its changes refused: the rename is refused in the same words as a change and a
//   deletion;
// - a GM's world handed as data with a missing table and no missing column: a read of that table is refused as missing;
// - the player's world: a dispatch sent with no sender (null) while someone is signed in is refused in the database's
//   words and not kept; one sent with another account as its sender keeps that account; one sent without a sender
//   keeps the signed-in one; with the dispatches' table missing, a dispatch sent is refused as missing and not kept.
// TypeScript, in `unit/`
import { describe, expect, test } from 'vitest';
import { DB_VERSION } from '../lib/boot.js';
import {
  aGameMastersWorld,
  makeAFakeDbHoldingAWorldHandedAsData,
  makeAFakeDbHoldingTheGameMastersWorld,
  makeAFakeDbHoldingTheHallOfFame,
  makeAFakeDbHoldingThePlayersWorld,
  type TheGameMastersWorldAsData,
  type TheHallOfFamesWorld,
  type ThePlayersWorld,
} from '../lib/fake-db.ts';

/** The words and code of a read or write of a table the database lacks. */
const MISSING_DISPATCHES_TABLE = { message: 'relation "public.game_messages" does not exist', code: '42P01' };

/** A made-up dispatch of the game `game`, its id `id`. */
const aDispatch = (id: number, game: string) => ({
  id,
  game_id: game,
  turn: 1,
  from_index: 0,
  to_indexes: [1],
  scope: 'public',
  body: 'Made-up dispatch ' + String(id),
  created_at: '2026-10-01T00:00:00Z',
});

describe("the GM's world", () => {
  /** Seven dispatches of Glenmarsh (ids 1 to 7), one of another game between them. */
  const aWorldWithMoreDispatchesThanAPage = () => {
    const world = aGameMastersWorld();
    world.tables.game_messages.push(
      ...[1, 2, 3].map((id) => aDispatch(id, 'glenmarsh')),
      aDispatch(8, 'another-game'),
      ...[4, 5, 6, 7].map((id) => aDispatch(id, 'glenmarsh')),
    );
    return makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, world).db.theDispatches;
  };
  const ids = (answer: { data: { id: number }[] | null }) => answer.data?.map((d) => d.id);

  test('the newest page of dispatches answers the newest first, of its game only', async () => {
    const dispatches = aWorldWithMoreDispatchesThanAPage();
    expect(ids(await dispatches.theNewestDispatchesOfThisGame('glenmarsh', 3))).toEqual([7, 6, 5]);
  });

  test('the dispatches after one answer the next ones, the oldest first', async () => {
    const dispatches = aWorldWithMoreDispatchesThanAPage();
    expect(ids(await dispatches.theDispatchesOfThisGameAfterThisOne('glenmarsh', 4, 2))).toEqual([5, 6]);
  });

  test('the dispatches before one answer the earlier ones, the newest first', async () => {
    const dispatches = aWorldWithMoreDispatchesThanAPage();
    expect(ids(await dispatches.theDispatchesOfThisGameBeforeThisOne('glenmarsh', 4, 2))).toEqual([3, 2]);
  });

  /** A private game in setup, run by gm1, inviting the account `invited`, with one realm taken by gm1's bot. */
  const aPrivateGameInSetupInviting = (invited: string, me: string) => {
    const world = aGameMastersWorld();
    world.me = me;
    world.tables.games.push({
      id: 'thornfield',
      name: 'Thornfield',
      gm_user_id: 'gm1',
      status: 'setup',
      turn: 0,
      game_state: JSON.stringify({ visibility: 'private', invited: [invited] }),
    });
    world.tables.game_players.push({
      id: 'thornfield-0',
      game_id: 'thornfield',
      user_id: null,
      player_index: 0,
      orders_submitted: false,
      turn_report: '{}',
    });
    return makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, world).db.thePlayersRealms;
  };

  test("a private game's realms are answered to no account it doesn't invite", async () => {
    const realms = aPrivateGameInSetupInviting('invited-player', 'uninvited-player');
    expect((await realms.theSlotsOfTheseGames(['thornfield'])).data).toEqual([]);
  });

  test("a private game's realms are answered to the account it invites", async () => {
    const realms = aPrivateGameInSetupInviting('invited-player', 'invited-player');
    expect((await realms.theSlotsOfTheseGames(['thornfield'])).data).toEqual([
      { game_id: 'thornfield', player_index: 0, is_bot: true, orders_submitted: false, alignment: null },
    ]);
  });
});

describe("the Hall of Fame's world, its changes refused", () => {
  test('a rename is refused in the same words as a change and a deletion', async () => {
    const world: TheHallOfFamesWorld = {
      rows: () => [],
      changes: [],
      signedIn: true,
      me: 'an-overlord',
      isOverlord: true,
      writesRefusedWith: 'Made-up refusal',
    };
    const hall = makeAFakeDbHoldingTheHallOfFame(DB_VERSION, world).db.theHallOfFame;
    const refused = { data: null, error: { message: 'Made-up refusal' } };
    expect(await hall.changeThisGamesEntry('glenmarsh', { hidden: true })).toMatchObject(refused);
    expect(await hall.deleteThisGamesEntry('glenmarsh')).toMatchObject(refused);
    expect(await hall.renameThisPlayer('a-player', 'A New Name')).toMatchObject(refused);
  });
});

describe("a GM's world handed as data", () => {
  test('a table it lacks, with no column missing, is refused as missing when read', async () => {
    const asData: TheGameMastersWorldAsData = {
      ...aGameMastersWorld(),
      missingColumns: [],
      missingTables: ['game_messages'],
    };
    const { fake, world } = makeAFakeDbHoldingAWorldHandedAsData(DB_VERSION, structuredClone(asData));
    expect(world).not.toBeNull();
    expect(await fake.db.theDispatches.theNewestDispatchesOfThisGame('glenmarsh', 10)).toMatchObject({
      data: null,
      error: MISSING_DISPATCHES_TABLE,
    });
  });
});

describe("the player's world", () => {
  /** The player's world, `me` signed in, holding the dispatches sent (none yet). */
  const aPlayersWorld = (me: string, tableMissing = false): ThePlayersWorld => ({
    me,
    names: [],
    games: [],
    realms: [],
    dispatchRefused: null,
    readsOfAnotherAccountsRealms: [],
    dispatches: [],
    readMarks: [],
    dispatchesTableMissing: tableMissing,
  });
  const aNewDispatch = { game_id: 'glenmarsh', from_index: 0, to_indexes: [1], body: 'Made-up words' };

  test('a dispatch with no sender is refused in the database words, while someone is signed in, and not kept', async () => {
    const world = aPlayersWorld('a-player');
    const db = makeAFakeDbHoldingThePlayersWorld(DB_VERSION, world).db;
    expect(await db.theDispatches.sendThisDispatch({ ...aNewDispatch, from_user_id: null })).toMatchObject({
      data: null,
      error: {
        message: 'null value in column "from_user_id" of relation "game_messages" violates not-null constraint',
        code: '23502',
      },
    });
    expect(world.dispatches).toEqual([]);
  });

  test('a dispatch sent with another account as its sender keeps the account sent', async () => {
    const world = aPlayersWorld('a-player');
    const db = makeAFakeDbHoldingThePlayersWorld(DB_VERSION, world).db;
    expect(await db.theDispatches.sendThisDispatch({ ...aNewDispatch, from_user_id: 'another-player' })).toMatchObject({
      error: null,
    });
    expect(world.dispatches?.map((d) => d.from_user_id)).toEqual(['another-player']);
  });

  test('a dispatch sent without a sender keeps the signed-in account', async () => {
    const world = aPlayersWorld('a-player');
    const db = makeAFakeDbHoldingThePlayersWorld(DB_VERSION, world).db;
    await db.theDispatches.sendThisDispatch(aNewDispatch);
    expect(world.dispatches?.map((d) => d.from_user_id)).toEqual(['a-player']);
  });

  test("with the dispatches' table missing, a dispatch sent is refused as missing and not kept", async () => {
    const world = aPlayersWorld('a-player', true);
    const db = makeAFakeDbHoldingThePlayersWorld(DB_VERSION, world).db;
    expect(await db.theDispatches.sendThisDispatch({ ...aNewDispatch, from_user_id: 'a-player' })).toMatchObject({
      data: null,
      error: MISSING_DISPATCHES_TABLE,
    });
    expect(world.dispatches).toEqual([]);
  });
});
