// The GM's games and realms, areas of the page's Db (src/db/the-db-interface-and-its-areas.ts: theGameMastersGames,
// theGameMastersRealms; plan P1-17m), on a supabase-js client of the local Supabase, as each role (signed out, a
// player, a rival, the game's GM, another GM, the Overlord):
// - the reads (games, with their realms embedded): a game is read by its GM, its players and the Overlord, and its
//   realms by their own player, the game's GM and the Overlord; each list in its order, its columns and its rows;
// - the writes: a game is made only by a Game Master, as its own GM (never the Overlord); a game is changed by its GM
//   and the Overlord, and by no one else (no row matched, no error); a turn's guard changes nothing once the game has
//   moved on; a realm is removed by its game's GM and the Overlord.
// A visitor reads nothing, for want of a grant. The world's third game (the game's GM's, finished, with its meta;
// Marchwood has none) is made here through the local service role and removed after; each change is put back, and each
// made game removed, before the next test.
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
const REFUSED_BY_THE_RULES: unknown = expect.stringMatching(/row-level security policy (".+" )?for table "games"/);
/** The error's words a call answered, or null. */
const itsError = (answer: { readonly error: { readonly message: string } | null }): string | null =>
  answer.error?.message ?? null;
/** Each role's answer: a visitor's refusal for want of a grant, else no error. */
const theErrorFor = (role: ARole): unknown => (role === 'signed out' ? NO_GRANT : null);

/** The world's three games, by name: the made-up game, the other GM's, and the game's GM's finished one (beforeAll). */
const THE_GAMES = ['Marchwood', 'Fenmoor', 'Westfold'] as const;
type AGamesName = (typeof THE_GAMES)[number];
const gameIdOf = new Map<AGamesName, string>();
const idOfGame = (name: AGamesName): string => {
  const id = gameIdOf.get(name);
  if (id === undefined) throw new Error(`no game ${name}`);
  return id;
};
/** The names of the games of `rows`, in their order (any not made here left out). */
const theGamesOf = (rows: readonly { readonly id: string }[] | null): string[] =>
  (rows ?? []).flatMap((row) => THE_GAMES.filter((name) => gameIdOf.get(name) === row.id));
/** The sorted columns of the first of `rows`, and of the first realm any of them holds. */
const theColumnsOf = (rows: readonly object[] | null): { game: string[]; realm: string[] } => {
  const first: object = rows?.[0] ?? {};
  const realm: unknown = (rows ?? [])
    .map((row): unknown => Reflect.get(row, 'game_players'))
    .flatMap((realms): unknown[] => (Array.isArray(realms) ? realms : []))[0];
  return {
    game: Object.keys(first).sort(),
    realm: typeof realm === 'object' && realm !== null ? Object.keys(realm).sort() : [],
  };
};
/** Each game of `rows` with the slots of the realms it holds, sorted (`Marchwood 0 1 2`). */
const theRealmsOf = (
  rows: readonly { readonly id: string; readonly game_players: readonly { readonly player_index: number }[] }[] | null,
): string[] =>
  (rows ?? []).flatMap((row) =>
    theGamesOf([row]).map((name) => [name, ...row.game_players.map((realm) => realm.player_index).sort()].join(' ')),
  );

/** The columns of a game in the GM page's list, and of its realms. */
const THE_LIGHT_COLUMNS = {
  game: [
    'created_at',
    'game_players',
    'gm_user_id',
    'id',
    'max_players',
    'max_turns',
    'meta',
    'name',
    'status',
    'turn',
  ],
  realm: ['display_name', 'game_id', 'id', 'orders_submitted', 'player_index', 'user_id'],
};
/** Every column of a game and of a realm, as the service role reads them (beforeAll). */
let EVERY_COLUMN = { game: [''], realm: [''] };

/** Who reads Marchwood: its GM, its two players and the Overlord. */
const readsMarchwood = (role: ARole): boolean => role !== 'signed out' && role !== 'another GM';
/** Who reads every realm of Marchwood (its other realms than its own): its GM and the Overlord. */
const readsEveryRealm = (role: ARole): boolean => role === "the game's GM" || role === 'the Overlord';
/** Who changes Marchwood and removes its realms: its GM and the Overlord. */
const changesMarchwood = readsEveryRealm;
/** The slots of Marchwood's realms `role` reads: every one, or its own. */
const marchwoodsRealmsFor = (role: ARole): string =>
  readsEveryRealm(role) ? 'Marchwood 0 1 2' : role === 'a player' ? 'Marchwood 0' : 'Marchwood 1';

/** Marchwood's world and name as made (beforeAll), to put back after each change. */
const MARCHWOODS_WORLD = JSON.stringify({ madeUp: 'Marchwood', turnMode: { mode: 'manual' } });
/** Marchwood's world, its meta and its setting, as the service role reads them. */
const marchwoodNow = async (): Promise<{ world: unknown; meta: unknown; blocks: unknown }> => {
  const { data, error } = await world.theServiceRole
    .from('games')
    .select('game_state,meta,block_eliminated_msgs')
    .eq('id', world.theGame)
    .single();
  if (error) throw new Error(`reading Marchwood: ${error.message}`);
  return { world: data.game_state, meta: data.meta, blocks: data.block_eliminated_msgs };
};
/** Puts Marchwood back as made: its world, no meta, dispatches not blocked, turn 3. */
const putMarchwoodBack = async (): Promise<void> => {
  const { error } = await world.theServiceRole
    .from('games')
    .update({ game_state: MARCHWOODS_WORLD, meta: null, block_eliminated_msgs: false, turn: 3 })
    .eq('id', world.theGame);
  if (error) throw new Error(`putting Marchwood back: ${error.message}`);
};

beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'gmgames');
  gameIdOf.set('Marchwood', world.theGame);
  gameIdOf.set('Fenmoor', world.theOtherGMsGame);
  const service = world.theServiceRole;
  await putMarchwoodBack();
  // the game's GM's second game, made after the world's two: the newest; it has its meta (Marchwood has none)
  const westfold = await service
    .from('games')
    .insert({
      name: 'Made-up Westfold',
      gm_user_id: world.accounts["the game's GM"],
      status: 'complete',
      turn: 9,
      meta: { v: 1 },
    })
    .select('id')
    .single();
  if (westfold.error) throw new Error(`making Westfold: ${westfold.error.message}`);
  gameIdOf.set('Westfold', westfold.data.id);
  const every = await service.from('games').select('*, game_players(*)').eq('id', world.theGame).single();
  if (every.error) throw new Error(`reading Marchwood's columns: ${every.error.message}`);
  EVERY_COLUMN = theColumnsOf([every.data]);
  for (const role of THE_ROLES) clients.set(role, await world.signedInAs(role));
});
afterAll(async () => {
  await world.theServiceRole.from('games').delete().eq('id', idOfGame('Westfold'));
  await world.removeIt();
});

describe('the reads: a game by its GM, its players and the Overlord; its realms by their own player too', () => {
  test.for(THE_ROLES)('%s: one game, its id and meta (the probe)', async (role) => {
    const answer = await dbOf(role).theGameMastersGames.oneGamesMeta();
    expect({ error: itsError(answer), rows: answer.data?.length, columns: theColumnsOf(answer.data).game }).toEqual(
      role === 'signed out'
        ? { error: NO_GRANT, rows: undefined, columns: [] }
        : { error: null, rows: 1, columns: ['id', 'meta'] },
    );
  });
  /** The games of the game's GM each role reads, newest first. */
  const theGamesMastersGamesFor = (role: ARole): string[] =>
    readsEveryRealm(role) ? ['Westfold', 'Marchwood'] : readsMarchwood(role) ? ['Marchwood'] : [];
  test.for(THE_ROLES)("%s: the game's GM's games, newest first, light and every column", async (role) => {
    const db = dbOf(role);
    const gm = world.accounts["the game's GM"];
    const light = await db.theGameMastersGames.theGamesThisGameMasterRunsNewestFirst(gm);
    const every = await db.theGameMastersGames.theGamesThisGameMasterRunsNewestFirstEveryColumn(gm);
    const theirs = theGamesMastersGamesFor(role);
    const realms = theirs.map((name) => (name === 'Westfold' ? 'Westfold' : marchwoodsRealmsFor(role)));
    expect({
      errors: [itsError(light), itsError(every)],
      games: [theGamesOf(light.data), theGamesOf(every.data)],
      realms: [theRealmsOf(light.data), theRealmsOf(every.data)],
      columns: [theColumnsOf(light.data), theColumnsOf(every.data)],
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role)],
      games: [theirs, theirs],
      realms: [realms, realms],
      columns: theirs.length ? [THE_LIGHT_COLUMNS, EVERY_COLUMN] : [theColumnsOf(null), theColumnsOf(null)],
    });
  });
  test.for(THE_ROLES)('%s: every game it reads, newest first, two rows at a time', async (role) => {
    const db = dbOf(role);
    // the three games made here are the newest: the first page holds the newest two each role reads
    const light = await db.theGameMastersGames.everyGameNewestFirstFromRowToRow(0, 1);
    const every = await db.theGameMastersGames.everyGameNewestFirstFromRowToRowEveryColumn(0, 1);
    const later = await db.theGameMastersGames.everyGameNewestFirstFromRowToRow(1, 1);
    const firstTwo: Record<ARole, string[]> = {
      'signed out': [],
      'a player': ['Marchwood'],
      'a rival': ['Marchwood'],
      "the game's GM": ['Westfold', 'Marchwood'],
      'another GM': ['Fenmoor'],
      'the Overlord': ['Westfold', 'Fenmoor'],
    };
    expect({
      errors: [itsError(light), itsError(every), itsError(later)],
      games: [theGamesOf(light.data), theGamesOf(every.data)],
      atMost: [light.data?.length ?? 0, every.data?.length ?? 0, later.data?.length ?? 0].map((n) => n <= 2),
      later: theGamesOf(later.data).slice(0, 1),
      columns: [theColumnsOf(light.data).game, theColumnsOf(every.data).game],
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role), theErrorFor(role)],
      games: [firstTwo[role].slice(0, 2), firstTwo[role].slice(0, 2)],
      atMost: [true, true, true],
      later: firstTwo[role].slice(1, 2),
      columns: role === 'signed out' ? [[], []] : [THE_LIGHT_COLUMNS.game, EVERY_COLUMN.game],
    });
  });
  test.for(THE_ROLES)("%s: the game's GM's active games, light and every column", async (role) => {
    const db = dbOf(role);
    const gm = world.accounts["the game's GM"];
    const light = await db.theGameMastersGames.theActiveGamesThisGameMasterRuns(gm);
    const every = await db.theGameMastersGames.theActiveGamesThisGameMasterRunsEveryColumn(gm);
    const theirs = readsMarchwood(role) ? ['Marchwood'] : [];
    const realms = theirs.length ? [marchwoodsRealmsFor(role)] : [];
    expect({
      errors: [itsError(light), itsError(every)],
      games: [theGamesOf(light.data), theGamesOf(every.data)],
      realms: [theRealmsOf(light.data), theRealmsOf(every.data)],
      columns: [theColumnsOf(light.data), theColumnsOf(every.data)],
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role)],
      games: [theirs, theirs],
      realms: [realms, realms],
      columns: theirs.length ? [THE_LIGHT_COLUMNS, EVERY_COLUMN] : [theColumnsOf(null), theColumnsOf(null)],
    });
  });
  test.for(THE_ROLES)('%s: one game with its realms, its turn and world, and the games with no meta', async (role) => {
    const db = dbOf(role);
    const one = await db.theGameMastersGames.thisGameWithItsRealms(world.theGame);
    const other = await db.theGameMastersGames.thisGameWithItsRealms(world.theOtherGMsGame);
    const turn = await db.theGameMastersGames.thisGamesTurnAndWorld(world.theGame);
    const noMeta = await db.theGameMastersGames.theGamesThisGameMasterRunsWithNoMeta(world.accounts["the game's GM"]);
    const reads = readsMarchwood(role);
    expect({
      errors: [itsError(one), itsError(other), itsError(turn), itsError(noMeta)],
      one: one.data && theRealmsOf([one.data]),
      columns: theColumnsOf(one.data ? [one.data] : null),
      turn: turn.data,
      noMeta: [theGamesOf(noMeta.data), theColumnsOf(noMeta.data).game],
    }).toEqual({
      errors: [
        reads ? null : role === 'signed out' ? NO_GRANT : NO_SUCH_ROW,
        role === 'another GM' || role === 'the Overlord' ? null : role === 'signed out' ? NO_GRANT : NO_SUCH_ROW,
        reads ? null : role === 'signed out' ? NO_GRANT : NO_SUCH_ROW,
        theErrorFor(role),
      ],
      one: reads ? [marchwoodsRealmsFor(role)] : null,
      columns: reads ? EVERY_COLUMN : theColumnsOf(null),
      turn: reads ? { id: world.theGame, turn: 3, game_state: MARCHWOODS_WORLD } : null,
      noMeta: reads ? [['Marchwood'], ['game_state', 'id']] : [[], []],
    });
  });
});

describe('the writes: a game made by a Game Master; changed by its GM and the Overlord', () => {
  test.for(THE_ROLES)('%s: makes a game of its own', async (role) => {
    const gm = role === 'signed out' ? world.accounts["the game's GM"] : world.accounts[role];
    const answer = await dbOf(role).theGameMastersGames.makeThisGame({
      name: `Made-up Northreach of ${role}`,
      gm_user_id: gm,
      status: 'setup',
      turn: 0,
      max_players: 4,
      max_turns: 30,
      game_state: JSON.stringify({ mapSize: 'small' }),
    });
    if (answer.data) await world.theServiceRole.from('games').delete().eq('id', answer.data.id);
    const makes = role === "the game's GM" || role === 'another GM';
    expect({
      error: itsError(answer),
      made: answer.data && [answer.data.name, answer.data.gm_user_id, answer.data.status, answer.data.turn],
      columns: answer.data ? Object.keys(answer.data).sort() : null,
    }).toEqual({
      error: makes ? null : role === 'signed out' ? NO_GRANT : REFUSED_BY_THE_RULES,
      made: makes ? [`Made-up Northreach of ${role}`, gm, 'setup', 0] : null,
      columns: makes ? EVERY_COLUMN.game.filter((column) => column !== 'game_players') : null,
    });
  });
  test.for(THE_ROLES)('%s: changes a game, and the backfill writes its meta', async (role) => {
    const db = dbOf(role);
    const changed = await db.theGameMastersGames.changeThisGame(world.theGame, {
      game_state: JSON.stringify({ madeUp: role }),
    });
    const afterTheWorld = await marchwoodNow();
    const meta = await db.theGameMastersGames.changeThisGame(world.theGame, { meta: { v: 1, by: role } });
    const afterTheMeta = await marchwoodNow();
    await putMarchwoodBack();
    const changes = changesMarchwood(role);
    expect({
      errors: [itsError(changed), itsError(meta)],
      world: afterTheWorld.world,
      meta: afterTheMeta.meta,
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role)],
      world: changes ? JSON.stringify({ madeUp: role }) : MARCHWOODS_WORLD,
      meta: changes ? { v: 1, by: role } : null,
    });
  });
  test.for(THE_ROLES)('%s: changes a game and answers its id, with and without the turn guard', async (role) => {
    const db = dbOf(role);
    const plain = await db.theGameMastersGames.changeThisGameAndAnswerItsId(world.theGame, {
      game_state: JSON.stringify({ plain: role }),
    });
    const afterPlain = await marchwoodNow();
    await putMarchwoodBack();
    const onItsTurn = await db.theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId(world.theGame, 3, {
      game_state: JSON.stringify({ guarded: role }),
    });
    const afterOnItsTurn = await marchwoodNow();
    await putMarchwoodBack();
    const movedOn = await db.theGameMastersGames.changeThisGameWhileOnThisTurnAndAnswerItsId(world.theGame, 2, {
      game_state: JSON.stringify({ late: role }),
    });
    const afterMovedOn = await marchwoodNow();
    await putMarchwoodBack();
    const changes = changesMarchwood(role);
    const itsId = role === 'signed out' ? null : changes ? { id: world.theGame } : null;
    expect({
      errors: [itsError(plain), itsError(onItsTurn), itsError(movedOn)],
      answers: [plain.data, onItsTurn.data, movedOn.data],
      worlds: [afterPlain.world, afterOnItsTurn.world, afterMovedOn.world],
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role), theErrorFor(role)],
      answers: [itsId, itsId, null],
      worlds: [
        changes ? JSON.stringify({ plain: role }) : MARCHWOODS_WORLD,
        changes ? JSON.stringify({ guarded: role }) : MARCHWOODS_WORLD,
        MARCHWOODS_WORLD,
      ],
    });
  });
  test.for(THE_ROLES)(
    '%s: keeps the realms that are out from sending dispatches, and lets them again',
    async (role) => {
      const db = dbOf(role);
      const on = await db.theGameMastersGames.keepTheRealmsThatAreOutOfThisGameFromSendingDispatches(
        world.theGame,
        true,
      );
      const afterOn = await marchwoodNow();
      const off = await db.theGameMastersGames.keepTheRealmsThatAreOutOfThisGameFromSendingDispatches(
        world.theGame,
        false,
      );
      const afterOff = await marchwoodNow();
      await putMarchwoodBack();
      const changes = changesMarchwood(role);
      expect({
        errors: [itsError(on), itsError(off)],
        answers: [on.data, off.data],
        settings: [afterOn.blocks, afterOff.blocks],
      }).toEqual({
        errors: [theErrorFor(role), theErrorFor(role)],
        answers: changes
          ? [
              { id: world.theGame, block_eliminated_msgs: true },
              { id: world.theGame, block_eliminated_msgs: false },
            ]
          : [null, null],
        settings: [changes, false],
      });
    },
  );
});

describe("the realms: one removed by its game's GM and the Overlord", () => {
  /** Marchwood's realm 2 (no player), as the service role reads it; made again if a test removed it. */
  const marchwoodsThirdRealm = async (): Promise<string | null> => {
    const { data } = await world.theServiceRole
      .from('game_players')
      .select('id')
      .eq('game_id', world.theGame)
      .eq('player_index', 2)
      .maybeSingle();
    return data?.id ?? null;
  };
  test.for(THE_ROLES)("%s: removes Marchwood's third realm", async (role) => {
    const realm = await marchwoodsThirdRealm();
    if (realm === null) throw new Error('no third realm in Marchwood');
    const answer = await dbOf(role).theGameMastersRealms.removeThisRealm(realm);
    const left = await marchwoodsThirdRealm();
    if (left === null) {
      const back = await world.theServiceRole
        .from('game_players')
        .insert({ game_id: world.theGame, user_id: null, player_index: 2, display_name: 'Realm of Coldharbour' });
      if (back.error) throw new Error(`putting the third realm back: ${back.error.message}`);
    }
    expect({ error: itsError(answer), removed: left === null }).toEqual({
      error: theErrorFor(role),
      removed: changesMarchwood(role),
    });
  });
});
