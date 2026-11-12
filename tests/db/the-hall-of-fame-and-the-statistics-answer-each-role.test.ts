// The Hall of Fame and the statistics, areas of the page's Db (src/db/the-db-interface-and-its-areas.ts: theHallOfFame,
// theStatistics, theHallOfFamesGames; plan P1-17g), on a supabase-js client of the local Supabase, as each role (signed
// out, a player, a rival, the game's GM, another GM, the Overlord):
// - the Hall of Fame (game_records): every role reads every entry (the probe, the newest finished first a page of rows
//   at a time, every entry's game, a Game Master's notes); only the game's GM and the Overlord write, change or delete
//   its entry (another account's change or deletion matches nothing; a new entry is refused; a visitor for want of a
//   grant); only the Overlord renames a player (rename_player, in its words);
// - the statistics (turn_events, game_results): only the game's GM and the Overlord read or delete a game's records and
//   results (each other account reads none and deletes nothing; a visitor for want of a grant), in the orders and
//   pages the page asks for;
// - the games: one game a Game Master runs, a game with its world and its realms, a Game Master's finished games, the
//   games' names, states and turns, and which games still exist, each as the role may read the games.
// Each change is undone before the next test (the entries, records and results put back), so the world is the same for
// each; the rows are removed after (their game_id is text, not a foreign key, so they outlive the games).
// Level db (the access layer, against the local Supabase): the queries and the access rules together, which no lower
// level holds (pgTAP checks the rules in SQL; the page tests run on the stand-in).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, test } from 'vitest';
import {
  makeTheDbFromItsClient,
  type ADatabaseAnswer,
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
/** A new entry the access rules refuse, in their words. */
const REFUSED_BY_THE_RULES: unknown = expect.stringMatching(/row-level security policy for table "game_records"/);
/** The error's words a call answered, or null. */
const itsError = (answer: { readonly error: { readonly message: string } | null }): string | null =>
  answer.error?.message ?? null;
/** Whether `role` runs the made-up game or is the Overlord: who reads and writes its statistics and its entry. */
const runsTheGameOrIsTheOverlord = (role: ARole): boolean => role === "the game's GM" || role === 'the Overlord';

/** The made-up game's and the other GM's game's ids (beforeAll). */
let ours: readonly string[] = [];
const theGame = (): string => world.theGame;
const theOtherGame = (): string => world.theOtherGMsGame;
/** Only the rows of our two games, in the order they came. */
const onlyOurs = <R extends { readonly game_id: string }>(rows: readonly R[] | null): R[] =>
  (rows ?? []).filter((row) => ours.includes(row.game_id));

const THE_GAMES_FINISH = '2026-01-02T00:00:00+00:00';
const THE_OTHER_GAMES_FINISH = '2026-01-03T00:00:00+00:00';
const A_NOTE = 'A made-up note on the made-up game';

/** Puts back the made-up entries, records and results (the service role), as each test finds them. */
const putBackTheRows = async (): Promise<void> => {
  const service = world.theServiceRole;
  for (const table of ['game_records', 'game_results', 'turn_events'] as const) {
    const { error } = await service.from(table).delete().in('game_id', ours);
    if (error) throw new Error(`clearing ${table}: ${error.message}`);
  }
  const records = await service.from('game_records').insert([
    {
      game_id: theGame(),
      game_name: 'Made-up Marchwood',
      gm_user_id: world.accounts["the game's GM"],
      finished_at: THE_GAMES_FINISH,
      note: A_NOTE,
      turns: 3,
    },
    {
      game_id: theOtherGame(),
      game_name: 'Made-up Fenmoor',
      gm_user_id: world.accounts['another GM'],
      finished_at: THE_OTHER_GAMES_FINISH,
      turns: 2,
    },
  ]);
  if (records.error) throw new Error(`making the entries: ${records.error.message}`);
  const results = await service.from('game_results').insert([
    { game_id: theGame(), player_index: 1, realm: 'Realm of Brackwater' },
    { game_id: theOtherGame(), player_index: 0, realm: 'Realm of Dunmere' },
    { game_id: theGame(), player_index: 0, realm: 'Realm of Ashford' },
  ]);
  if (results.error) throw new Error(`making the results: ${results.error.message}`);
  // made out of order, so the reads' order is the query's
  const events = await service.from('turn_events').insert([
    { game_id: theGame(), turn: 2, player_index: 1, realm: 'Realm of Brackwater' },
    { game_id: theGame(), turn: 1, player_index: 1, realm: 'Realm of Brackwater' },
    { game_id: theOtherGame(), turn: 1, player_index: 0, realm: 'Realm of Dunmere' },
    { game_id: theGame(), turn: 2, player_index: 0, realm: 'Realm of Ashford' },
    { game_id: theGame(), turn: 1, player_index: 0, realm: 'Realm of Ashford' },
  ]);
  if (events.error) throw new Error(`making the turn records: ${events.error.message}`);
};
/** Our rows of `table` as the service role reads them, in short: each game and realm (and turn), sorted. */
const whatIsLeftIn = async (table: 'game_records' | 'game_results' | 'turn_events'): Promise<string[]> => {
  const { data, error } = await world.theServiceRole.from(table).select('*').in('game_id', ours);
  if (error) throw new Error(`reading ${table}: ${error.message}`);
  return data
    .map((row) =>
      [row.game_id === theGame() ? 'the game' : 'the other game', 'player_index' in row ? row.player_index : '']
        .concat('turn' in row ? [row.turn] : [])
        .join(':'),
    )
    .sort();
};
/** The made-up game's entry, as the service role reads it. */
const theGamesEntry = async (): Promise<{ note: string | null; hidden: boolean } | null> =>
  (await world.theServiceRole.from('game_records').select('note,hidden').eq('game_id', theGame()).maybeSingle()).data;

beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'halloffame');
  ours = [world.theGame, world.theOtherGMsGame];
  const finished = await world.theServiceRole.from('games').update({ status: 'complete' }).eq('id', world.theGame);
  if (finished.error) throw new Error(`finishing the game: ${finished.error.message}`);
  await putBackTheRows();
  for (const role of THE_ROLES) clients.set(role, await world.signedInAs(role));
});
afterAll(async () => {
  for (const table of ['game_records', 'game_results', 'turn_events'] as const)
    await world.theServiceRole.from(table).delete().in('game_id', ours);
  await world.removeIt();
});

describe('the Hall of Fame: every role reads it', () => {
  test.for(THE_ROLES)('%s: the probe finds an entry', async (role) => {
    const answer = await dbOf(role).theHallOfFame.oneEntrysGame();
    expect({ error: itsError(answer), rows: answer.data?.length }).toEqual({ error: null, rows: 1 });
  });
  test.for(THE_ROLES)('%s: every entry, the newest finished first, a page of rows at a time', async (role) => {
    const db = dbOf(role);
    const answer = await db.theHallOfFame.everyEntryNewestFinishedFirstFromRowToRow(0, 999);
    const onePage = await db.theHallOfFame.everyEntryNewestFinishedFirstFromRowToRow(0, 0);
    expect({
      error: itsError(answer),
      ours: onlyOurs(answer.data).map((entry) => [entry.game_id, entry.game_name, entry.finished_at, entry.note]),
      onePage: onePage.data?.length,
    }).toEqual({
      error: null,
      ours: [
        [theOtherGame(), 'Made-up Fenmoor', THE_OTHER_GAMES_FINISH, null],
        [theGame(), 'Made-up Marchwood', THE_GAMES_FINISH, A_NOTE],
      ],
      onePage: 1,
    });
  });
  test.for(THE_ROLES)("%s: every entry's game, and a Game Master's notes on one", async (role) => {
    const db = dbOf(role);
    const games = await db.theHallOfFame.theGameOfEveryEntry();
    const notes = await db.theHallOfFame.theGameMastersNotesOnThisGamesEntry(theGame());
    const none = await db.theHallOfFame.theGameMastersNotesOnThisGamesEntry('no-such-game');
    expect({
      error: itsError(games),
      ours: onlyOurs(games.data)
        .map((entry) => entry.game_id)
        .sort(),
      notes: notes.data,
      none: [none.data, itsError(none)],
    }).toEqual({
      error: null,
      ours: [...ours].sort(),
      notes: { note: A_NOTE, hidden: false, game_name: 'Made-up Marchwood' },
      none: [null, null],
    });
  });
});

describe("the Hall of Fame: only the game's GM and the Overlord change its entry", () => {
  beforeEach(putBackTheRows);
  test.for(THE_ROLES)('%s: writing the entry over the old one', async (role) => {
    const answer = await dbOf(role).theHallOfFame.writeTheseEntries([
      { game_id: theGame(), game_name: 'Made-up Marchwood', note: 'Written again', hidden: true },
    ]);
    expect({ error: itsError(answer), entry: await theGamesEntry() }).toEqual(
      role === 'signed out'
        ? { error: NO_GRANT, entry: { note: A_NOTE, hidden: false } }
        : runsTheGameOrIsTheOverlord(role)
          ? { error: null, entry: { note: 'Written again', hidden: true } }
          : {
              error: REFUSED_BY_THE_RULES,
              entry: { note: A_NOTE, hidden: false },
            },
    );
  });
  test.for(THE_ROLES)("%s: changing the entry (the leaderboard's edit and its hiding)", async (role) => {
    const db = dbOf(role);
    const edit = await db.theHallOfFame.changeThisGamesEntry(theGame(), { note: 'Edited' });
    const hide = await db.theHallOfFame.changeThisGamesEntry(theGame(), { hidden: true });
    const other = await db.theHallOfFame.changeThisGamesEntry(theOtherGame(), { note: 'Edited' });
    const theOther = (
      await world.theServiceRole.from('game_records').select('note').eq('game_id', theOtherGame()).single()
    ).data;
    expect({
      errors: [itsError(edit), itsError(hide)],
      entry: await theGamesEntry(),
      theOtherGamesNote: theOther?.note,
    }).toEqual(
      role === 'signed out'
        ? { errors: [NO_GRANT, NO_GRANT], entry: { note: A_NOTE, hidden: false }, theOtherGamesNote: null }
        : runsTheGameOrIsTheOverlord(role)
          ? {
              errors: [null, null],
              entry: { note: 'Edited', hidden: true },
              theOtherGamesNote: role === 'the Overlord' ? 'Edited' : null,
            }
          : {
              errors: [null, null],
              entry: { note: A_NOTE, hidden: false },
              theOtherGamesNote: role === 'another GM' ? 'Edited' : null,
            },
    );
    expect(itsError(other)).toEqual(role === 'signed out' ? NO_GRANT : null);
  });
  test.for(THE_ROLES)('%s: deleting the entry, and the entries of both games', async (role) => {
    const db = dbOf(role);
    const one = await db.theHallOfFame.deleteThisGamesEntry(theGame());
    const afterOne = await whatIsLeftIn('game_records');
    await putBackTheRows();
    const both = await db.theHallOfFame.deleteTheseGamesEntries(ours);
    const afterBoth = await whatIsLeftIn('game_records');
    const runs = runsTheGameOrIsTheOverlord(role);
    expect({ errors: [itsError(one), itsError(both)], afterOne, afterBoth }).toEqual(
      role === 'signed out'
        ? {
            errors: [NO_GRANT, NO_GRANT],
            afterOne: ['the game:', 'the other game:'],
            afterBoth: ['the game:', 'the other game:'],
          }
        : {
            errors: [null, null],
            afterOne: runs ? ['the other game:'] : ['the game:', 'the other game:'],
            afterBoth:
              role === 'the Overlord'
                ? []
                : role === "the game's GM"
                  ? ['the other game:']
                  : role === 'another GM'
                    ? ['the game:']
                    : ['the game:', 'the other game:'],
          },
    );
  });
  test.for(THE_ROLES)('%s: only the Overlord renames a player', async (role) => {
    const player = world.accounts['a player'];
    const before = await world.theServiceRole.from('profiles').upsert({ id: player, name: 'Made-up Godric' });
    if (before.error) throw new Error(`naming the player: ${before.error.message}`);
    const answer = await dbOf(role).theHallOfFame.renameThisPlayer(player, '  Made-up Godwin  ');
    const name = (await world.theServiceRole.from('profiles').select('name').eq('id', player).single()).data?.name;
    expect({ error: itsError(answer), name }).toEqual(
      role === 'signed out'
        ? { error: NO_GRANT, name: 'Made-up Godric' }
        : role === 'the Overlord'
          ? { error: null, name: 'Made-up Godwin' }
          : { error: 'Only the Overlord renames players.', name: 'Made-up Godric' },
    );
  });
});

describe("the statistics: only the game's GM and the Overlord read them", () => {
  /** Who reads the other GM's game's statistics: its GM and the Overlord. */
  const readsTheOtherGame = (role: ARole): boolean => role === 'another GM' || role === 'the Overlord';
  /** What `role` is answered when it reads statistics: no grant signed out, else no error. */
  const theReadsError = (role: ARole): unknown => (role === 'signed out' ? NO_GRANT : null);
  test.for(THE_ROLES)('%s: the probes find a record and a result where the role reads one', async (role) => {
    const db = dbOf(role);
    const a = await db.theStatistics.oneTurnRecordsId();
    const b = await db.theStatistics.oneGameResultsId();
    const seesSome =
      role === 'signed out' ? undefined : runsTheGameOrIsTheOverlord(role) || readsTheOtherGame(role) ? 1 : 0;
    expect({ errors: [itsError(a), itsError(b)], rows: [a.data?.length, b.data?.length] }).toEqual({
      errors: [theReadsError(role), theReadsError(role)],
      rows: [seesSome, seesSome],
    });
  });
  test.for(THE_ROLES)(
    "%s: a game's results, and its turn records by turn and realm, a page at a time",
    async (role) => {
      const db = dbOf(role);
      const results = await db.theStatistics.theResultsOfThisGame(theGame());
      const all = await db.theStatistics.thisGamesTurnRecordsForItsEntryFromRowToRow(theGame(), 0, 499);
      const page = await db.theStatistics.thisGamesTurnRecordsForItsEntryFromRowToRow(theGame(), 1, 2);
      const runs = runsTheGameOrIsTheOverlord(role);
      expect({
        errors: [itsError(results), itsError(all), itsError(page)],
        results: (results.data ?? []).map((row) => [row.game_id === theGame(), row.player_index, row.realm]).sort(),
        all: all.data?.map((row) => [row.turn, row.player_index, row.realm]),
        page: page.data?.map((row) => [row.turn, row.player_index]),
      }).toEqual({
        errors: [theReadsError(role), theReadsError(role), theReadsError(role)],
        results: runs
          ? [
              [true, 0, 'Realm of Ashford'],
              [true, 1, 'Realm of Brackwater'],
            ]
          : [],
        all:
          role === 'signed out'
            ? undefined
            : runs
              ? [
                  [1, 0, 'Realm of Ashford'],
                  [1, 1, 'Realm of Brackwater'],
                  [2, 0, 'Realm of Ashford'],
                  [2, 1, 'Realm of Brackwater'],
                ]
              : [],
        page:
          role === 'signed out'
            ? undefined
            : runs
              ? [
                  [1, 1],
                  [2, 0],
                ]
              : [],
      });
    },
  );
  test.for(THE_ROLES)('%s: every result and every turn record, in their orders, a page at a time', async (role) => {
    const db = dbOf(role);
    const games = await db.theStatistics.theGameOfEveryResultFromRowToRow(0, 999);
    const records = await db.theStatistics.everyTurnRecordFromRowToRow(0, 999);
    const results = await db.theStatistics.everyResultFromRowToRow(0, 999);
    const pages = await Promise.all([
      db.theStatistics.theGameOfEveryResultFromRowToRow(0, 0),
      db.theStatistics.everyTurnRecordFromRowToRow(0, 0),
      db.theStatistics.everyResultFromRowToRow(0, 0),
    ]);
    const runs = runsTheGameOrIsTheOverlord(role);
    const other = readsTheOtherGame(role);
    const name = (game: string): string => (game === theGame() ? 'the game' : 'the other game');
    /** Our two games in the order of their ids (the reads' first order). */
    const byId = [...ours].sort();
    const read = (game: string): boolean => (game === theGame() ? runs : other);
    expect({
      errors: [itsError(games), itsError(records), itsError(results)],
      games: onlyOurs(games.data).map((row) => name(row.game_id)),
      records: onlyOurs(records.data).map((row) => [name(row.game_id), row.turn, row.player_index]),
      results: onlyOurs(results.data)
        .map((row) => [name(row.game_id), String(row.player_index), String(row.realm)].join(':'))
        .sort(),
      pages: pages.map((page) => page.data?.length),
    }).toEqual({
      errors: [theReadsError(role), theReadsError(role), theReadsError(role)],
      games: byId.filter(read).flatMap((game) => (game === theGame() ? ['the game', 'the game'] : ['the other game'])),
      records: byId.filter(read).flatMap((game) =>
        game === theGame()
          ? [
              ['the game', 1, 0],
              ['the game', 1, 1],
              ['the game', 2, 0],
              ['the game', 2, 1],
            ]
          : [['the other game', 1, 0]],
      ),
      results: [
        ...(runs ? ['the game:0:Realm of Ashford', 'the game:1:Realm of Brackwater'] : []),
        ...(other ? ['the other game:0:Realm of Dunmere'] : []),
      ],
      pages: role === 'signed out' ? [undefined, undefined, undefined] : runs || other ? [1, 1, 1] : [0, 0, 0],
    });
  });
});

describe("the statistics: only the game's GM and the Overlord delete them", () => {
  beforeEach(putBackTheRows);
  test.for(THE_ROLES)("%s: deleting a game's results and turn records", async (role) => {
    const db = dbOf(role);
    const answers = [
      await db.theStatistics.deleteThisGamesResults(theGame()),
      await db.theStatistics.deleteThisGamesTurnRecords(theGame()),
    ];
    const left = [await whatIsLeftIn('game_results'), await whatIsLeftIn('turn_events')];
    const all = {
      game_results: ['the game:0', 'the game:1', 'the other game:0'],
      turn_events: ['the game:0:1', 'the game:0:2', 'the game:1:1', 'the game:1:2', 'the other game:0:1'],
    };
    expect({ errors: answers.map(itsError), left }).toEqual(
      role === 'signed out'
        ? { errors: [NO_GRANT, NO_GRANT], left: [all.game_results, all.turn_events] }
        : runsTheGameOrIsTheOverlord(role)
          ? { errors: [null, null], left: [['the other game:0'], ['the other game:0:1']] }
          : { errors: [null, null], left: [all.game_results, all.turn_events] },
    );
  });
  test.for(THE_ROLES)("%s: deleting both games' results and turn records", async (role) => {
    const db = dbOf(role);
    const answers = [
      await db.theStatistics.deleteTheseGamesResults(ours),
      await db.theStatistics.deleteTheseGamesTurnRecords(ours),
    ];
    const left = [await whatIsLeftIn('game_results'), await whatIsLeftIn('turn_events')];
    const theGames = {
      game_results: ['the game:0', 'the game:1'],
      turn_events: ['the game:0:1', 'the game:0:2', 'the game:1:1', 'the game:1:2'],
    };
    const theOthers = { game_results: ['the other game:0'], turn_events: ['the other game:0:1'] };
    const keeps = (game: 'the game' | 'the other game'): boolean =>
      role === 'signed out' ||
      (game === 'the game' ? !runsTheGameOrIsTheOverlord(role) : role !== 'another GM' && role !== 'the Overlord');
    expect({ errors: answers.map(itsError), left }).toEqual({
      errors: role === 'signed out' ? [NO_GRANT, NO_GRANT] : [null, null],
      left: [
        [
          ...(keeps('the game') ? theGames.game_results : []),
          ...(keeps('the other game') ? theOthers.game_results : []),
        ],
        [...(keeps('the game') ? theGames.turn_events : []), ...(keeps('the other game') ? theOthers.turn_events : [])],
      ],
    });
  });
});

describe('the games, as the Hall of Fame and the statistics read them', () => {
  /** Whether `role` reads the made-up game: its GM, its players and the Overlord. */
  const readsTheGame = (role: ARole): boolean => role !== 'signed out' && role !== 'another GM';
  /** Whether `role` reads the other GM's game: its GM and the Overlord. */
  const readsTheOtherGame = (role: ARole): boolean => role === 'another GM' || role === 'the Overlord';
  const theError = (role: ARole): unknown => (role === 'signed out' ? NO_GRANT : null);
  /** The games of `answer` among ours, by name, sorted. */
  const ourGames = (answer: ADatabaseAnswer<{ readonly id: string }[]>): string[] | undefined =>
    answer.data
      ?.filter((game) => ours.includes(game.id))
      .map((game) => (game.id === theGame() ? 'the game' : 'the other game'))
      .sort();
  /** What `role` reads of our games, among `games`. */
  const asItReads = (role: ARole, games: readonly ('the game' | 'the other game')[]): string[] | undefined =>
    role === 'signed out'
      ? undefined
      : games.filter((game) => (game === 'the game' ? readsTheGame(role) : readsTheOtherGame(role)));
  test.for(THE_ROLES)('%s: one game a Game Master runs', async (role) => {
    const answer = await dbOf(role).theHallOfFamesGames.oneGameThisGameMasterRuns(world.accounts["the game's GM"]);
    expect({ error: itsError(answer), games: ourGames(answer) }).toEqual({
      error: theError(role),
      games: asItReads(role, ['the game']),
    });
  });
  test.for(THE_ROLES)('%s: the game with its world and its realms', async (role) => {
    const answer = await dbOf(role).theHallOfFamesGames.thisGameWithItsWorldAndRealms(theGame());
    const realms = answer.data?.game_players.map((realm) => [realm.player_index, realm.display_name]).sort();
    const theRealms = [
      [0, 'Realm of Ashford'],
      [1, 'Realm of Brackwater'],
      [2, 'Realm of Coldharbour'],
    ];
    expect({
      error: itsError(answer),
      game: answer.data ? [answer.data.id, answer.data.name, answer.data.gm_user_id] : answer.data,
      realms,
    }).toEqual({
      error: theError(role),
      game: readsTheGame(role) ? [theGame(), 'Made-up Marchwood', world.accounts["the game's GM"]] : null,
      realms:
        role === 'a player'
          ? [theRealms[0]]
          : role === 'a rival'
            ? [theRealms[1]]
            : readsTheGame(role)
              ? theRealms
              : undefined,
    });
  });
  test.for(THE_ROLES)("%s: a Game Master's finished games", async (role) => {
    const db = dbOf(role);
    const mine = await db.theHallOfFamesGames.theFinishedGamesThisGameMasterRuns(world.accounts["the game's GM"]);
    const theOthers = await db.theHallOfFamesGames.theFinishedGamesThisGameMasterRuns(world.accounts['another GM']);
    expect({ errors: [itsError(mine), itsError(theOthers)], games: [ourGames(mine), ourGames(theOthers)] }).toEqual({
      errors: [theError(role), theError(role)],
      // the other GM's game is still being played
      games: [asItReads(role, ['the game']), asItReads(role, [])],
    });
  });
  test.for(THE_ROLES)("%s: the games' names, states and turns: every game, and a Game Master's", async (role) => {
    const db = dbOf(role);
    const every = await db.theHallOfFamesGames.everyGamesNameStatusAndTurn();
    const theGMs = await db.theHallOfFamesGames.theNameStatusAndTurnOfTheGamesThisGameMasterRuns(
      world.accounts["the game's GM"],
    );
    const theGamesRow = every.data?.find((game) => game.id === theGame());
    expect({
      errors: [itsError(every), itsError(theGMs)],
      games: [ourGames(every), ourGames(theGMs)],
      row: theGamesRow,
    }).toEqual({
      errors: [theError(role), theError(role)],
      games: [asItReads(role, ['the game', 'the other game']), asItReads(role, ['the game'])],
      row: readsTheGame(role) ? { id: theGame(), name: 'Made-up Marchwood', status: 'complete', turn: 3 } : undefined,
    });
  });
  test.for(THE_ROLES)('%s: which games still exist (a deleted game: an id no game has)', async (role) => {
    const answer = await dbOf(role).theHallOfFamesGames.whichOfTheseGamesStillExist([...ours, randomUUID()]);
    expect({ error: itsError(answer), games: ourGames(answer) }).toEqual({
      error: theError(role),
      games: asItReads(role, ['the game', 'the other game']),
    });
  });
});
