// The player's games, realms and the chronicle's logs, areas of the page's Db (src/db/the-db-interface-and-its-areas.ts:
// thePlayersRealms, thePlayersGames, theChroniclesLogs; plan P1-17j), on a supabase-js client of the local Supabase, as
// each role (signed out, a player, a rival, the game's GM, another GM, the Overlord):
// - the realms (game_players): each is read by its own player, the game's GM and the Overlord, never by a rival or
//   another GM (stub-db's RULES.ownSlotsOnly); an account joins a game only as itself, once a game (the unique index
//   game_players_one_per_user) and in a free slot (game_players_one_per_number), and the Overlord never holds one;
// - get_game_slots(): every realm's slot (never its player) in the games the account may see: its own, those it runs,
//   an open game in setup (a private one if invited) and, for the Overlord, every game; alignment only in setup;
// - the games (games): read by their GM, their players and the Overlord, and in setup by any account if public or an
//   invited one if private (RULES.ownGamesOnly);
// - the turns' logs (turn_logs): read by the game's GM, its players and the Overlord (RULES.ownGamesOnly's logs).
// A visitor reads nothing, for want of a grant. The world's two setup games and its logs are made here through the
// local service role and removed after; each join made is removed before the next test.
// Level db (the access layer, against the local Supabase): the queries and the access rules together, which no lower
// level holds (pgTAP checks the rules in SQL; the page tests run on the stand-in).
import { afterAll, afterEach, beforeAll, describe, expect, inject, test } from 'vitest';
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
const REFUSED_BY_THE_RULES: unknown = expect.stringMatching(
  /row-level security policy (".+" )?for table "game_players"/,
);
/** The error's words a call answered, or null. */
const itsError = (answer: { readonly error: { readonly message: string } | null }): string | null =>
  answer.error?.message ?? null;
/** The error's code a call answered, or null. */
const itsCode = (answer: { readonly error: { readonly message: string } | null }): unknown =>
  answer.error && 'code' in answer.error ? Reflect.get(answer.error, 'code') : null;
/** Each role's answer: a visitor's refusal for want of a grant, else no error. */
const theErrorFor = (role: ARole): unknown => (role === 'signed out' ? NO_GRANT : null);

/** The world's four games, by name (beforeAll): the made-up game, the other GM's, and two of the other GM's in setup. */
const THE_GAMES = ['Marchwood', 'Fenmoor', 'the open game', 'the private game'] as const;
type AGamesName = (typeof THE_GAMES)[number];
const gameIdOf = new Map<AGamesName, string>();
const idOfGame = (name: AGamesName): string => {
  const id = gameIdOf.get(name);
  if (id === undefined) throw new Error(`no game ${name}`);
  return id;
};
const everyGame = (): string[] => THE_GAMES.map(idOfGame);
/** The names of the games `ids`, sorted (any not made here left out). */
const theGamesNamed = (ids: readonly string[]): string[] =>
  ids.flatMap((id) => THE_GAMES.filter((name) => gameIdOf.get(name) === id)).sort();
/** The names of the games of `rows` (their `id` or their `game_id`), sorted. */
const theGamesOf = (rows: readonly ({ readonly id: string } | { readonly game_id: string })[] | null): string[] =>
  theGamesNamed((rows ?? []).map((row) => ('game_id' in row ? row.game_id : row.id)));
/** Each of `rows` as its game's name and its slot, sorted. */
const theSlotsOf = (rows: readonly { readonly game_id: string; readonly player_index: number }[] | null): string[] =>
  (rows ?? [])
    .flatMap((row) => theGamesNamed([row.game_id]).map((name) => `${name} ${String(row.player_index)}`))
    .sort();

/** The games each role reads of the four. */
const THE_GAMES_EACH_ROLE_READS: Record<ARole, readonly AGamesName[]> = {
  'signed out': [],
  // its own (Marchwood), the open game and the private game it is invited to
  'a player': ['Marchwood', 'the open game', 'the private game'],
  // its own (Marchwood and the open game, where it holds a slot)
  'a rival': ['Marchwood', 'the open game'],
  // the one it runs, and the open game
  "the game's GM": ['Marchwood', 'the open game'],
  // the three it runs
  'another GM': ['Fenmoor', 'the open game', 'the private game'],
  'the Overlord': ['Fenmoor', 'Marchwood', 'the open game', 'the private game'],
};
const theGamesEachRoleReads = (role: ARole): string[] => [...THE_GAMES_EACH_ROLE_READS[role]].sort();
/** Whether `role` reads the game `name`. */
const reads = (role: ARole, name: AGamesName): boolean => THE_GAMES_EACH_ROLE_READS[role].includes(name);

/** Who reads the player's realm (and every realm of Marchwood): the player, the game's GM and the Overlord. */
const readsThePlayersRealm = (role: ARole): boolean =>
  role === 'a player' || role === "the game's GM" || role === 'the Overlord';
/** The player's realm's id (beforeAll). */
let thePlayersRealm = '';
/** The account whose realms each role asks for: the player's. */
const thePlayer = (): string => world.accounts['a player'];

/** The words a made-up log holds, by game, turn and realm. */
const theLogsWords = (turn: number, realm: number): string =>
  `Made-up log: turn ${String(turn)}, realm ${String(realm)}`;

beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'realms');
  gameIdOf.set('Marchwood', world.theGame);
  gameIdOf.set('Fenmoor', world.theOtherGMsGame);
  const service = world.theServiceRole;
  const setupGame = async (name: AGamesName, state: object): Promise<void> => {
    const { data, error } = await service
      .from('games')
      .insert({
        name: `Made-up ${name}`,
        gm_user_id: world.accounts['another GM'],
        status: 'setup',
        turn: 0,
        game_state: JSON.stringify(state),
      })
      .select('id')
      .single();
    if (error) throw new Error(`making ${name}: ${error.message}`);
    gameIdOf.set(name, data.id);
  };
  await setupGame('the open game', { visibility: 'public' });
  await setupGame('the private game', { visibility: 'private', invited: [thePlayer()] });
  const setup = (alignment: string): string => JSON.stringify({ playerSetup: { alignment }, status: 'joined' });
  const realms = await service.from('game_players').insert([
    {
      game_id: idOfGame('the open game'),
      user_id: world.accounts['a rival'],
      player_index: 0,
      display_name: 'Realm of Eastmarch',
      turn_report: setup('Undead'),
    },
    { game_id: idOfGame('the private game'), user_id: null, player_index: 0, display_name: 'Realm of Farholt' },
  ]);
  if (realms.error) throw new Error(`making the setup games' realms: ${realms.error.message}`);
  // the player's realm in Marchwood: an alignment in its report (shown only in setup), its orders in
  const mine = await service
    .from('game_players')
    .update({ turn_report: setup('Divine'), orders_submitted: true })
    .eq('game_id', world.theGame)
    .eq('player_index', 0)
    .select('id')
    .single();
  if (mine.error) throw new Error(`reading the player's realm: ${mine.error.message}`);
  thePlayersRealm = mine.data.id;
  // two turns' logs in Marchwood, each of realms 0 and 1 and the GM's whole log (-1); one in Fenmoor
  const logs = await service.from('turn_logs').insert([
    ...[1, 2].flatMap((turn) =>
      [-1, 0, 1].map((realm) => ({
        game_id: world.theGame,
        turn,
        player_index: realm,
        entries: [{ text: theLogsWords(turn, realm) }],
      })),
    ),
    { game_id: world.theOtherGMsGame, turn: 2, player_index: 0, entries: [{ text: theLogsWords(2, 0) }] },
  ]);
  if (logs.error) throw new Error(`making the logs: ${logs.error.message}`);
  for (const role of THE_ROLES) clients.set(role, await world.signedInAs(role));
});
afterAll(async () => {
  await world.theServiceRole.from('turn_logs').delete().in('game_id', everyGame());
  await world.theServiceRole
    .from('games')
    .delete()
    .in('id', [idOfGame('the open game'), idOfGame('the private game')]);
  await world.removeIt();
});

describe("the realms: each is read by its own player, the game's GM and the Overlord", () => {
  test.for(THE_ROLES)("%s: the player's realms and their orders flags", async (role) => {
    const answer = await dbOf(role).thePlayersRealms.thisAccountsRealmsAndTheirOrdersFlags(thePlayer());
    expect({
      error: itsError(answer),
      slots: theSlotsOf(answer.data),
      flags: answer.data?.map((row) => row.orders_submitted),
      fields: Object.keys(answer.data?.[0] ?? {}).sort(),
    }).toEqual(
      readsThePlayersRealm(role)
        ? {
            error: null,
            slots: ['Marchwood 0'],
            flags: [true],
            fields: ['game_id', 'id', 'orders_submitted', 'player_index'],
          }
        : { error: theErrorFor(role), slots: [], flags: role === 'signed out' ? undefined : [], fields: [] },
    );
  });
  test.for(THE_ROLES)("%s: every column of the player's realms", async (role) => {
    const answer = await dbOf(role).thePlayersRealms.everyRealmOfThisAccount(thePlayer());
    expect({
      error: itsError(answer),
      slots: theSlotsOf(answer.data),
      names: answer.data?.map((row) => row.display_name),
      hasItsReport: answer.data?.map((row) => typeof row.turn_report === 'string'),
    }).toEqual(
      readsThePlayersRealm(role)
        ? { error: null, slots: ['Marchwood 0'], names: ['Realm of Ashford'], hasItsReport: [true] }
        : {
            error: theErrorFor(role),
            slots: [],
            names: role === 'signed out' ? undefined : [],
            hasItsReport: role === 'signed out' ? undefined : [],
          },
    );
  });
  /** The games of each role's own realms: the player's and the rival's (the GMs and the Overlord hold none). */
  const THE_GAMES_OF_EACH_ROLES_OWN_REALMS: Record<ARole, readonly AGamesName[]> = {
    'signed out': [],
    'a player': ['Marchwood'],
    'a rival': ['Marchwood', 'the open game'],
    "the game's GM": [],
    'another GM': [],
    'the Overlord': [],
  };
  test.for(THE_ROLES)("%s: the games of the player's realms, and of its own", async (role) => {
    const db = dbOf(role);
    const players = await db.thePlayersRealms.theGamesOfThisAccountsRealms(thePlayer());
    const own =
      role === 'signed out' ? null : await db.thePlayersRealms.theGamesOfThisAccountsRealms(world.accounts[role]);
    expect({
      error: itsError(players),
      players: theGamesOf(players.data),
      fields: Object.keys(players.data?.[0] ?? {}),
      own: own && theGamesOf(own.data),
    }).toEqual({
      error: theErrorFor(role),
      players: readsThePlayersRealm(role) ? ['Marchwood'] : [],
      fields: readsThePlayersRealm(role) ? ['game_id'] : [],
      own: role === 'signed out' ? null : THE_GAMES_OF_EACH_ROLES_OWN_REALMS[role],
    });
  });
  test.for(THE_ROLES)("%s: the player's realms in one game", async (role) => {
    const db = dbOf(role);
    const here = await db.thePlayersRealms.thisAccountsRealmsInThisGame(world.theGame, thePlayer());
    const elsewhere = await db.thePlayersRealms.thisAccountsRealmsInThisGame(idOfGame('the open game'), thePlayer());
    const rivals = await db.thePlayersRealms.thisAccountsRealmsInThisGame(
      idOfGame('the open game'),
      world.accounts['a rival'],
    );
    expect({
      errors: [itsError(here), itsError(elsewhere), itsError(rivals)],
      here: here.data?.map((row) => [row.id === thePlayersRealm, row.player_index]),
      fields: Object.keys(here.data?.[0] ?? {}).sort(),
      elsewhere: elsewhere.data?.length,
      rivals: rivals.data?.map((row) => row.player_index),
    }).toEqual(
      role === 'signed out'
        ? {
            errors: [NO_GRANT, NO_GRANT, NO_GRANT],
            here: undefined,
            fields: [],
            elsewhere: undefined,
            rivals: undefined,
          }
        : {
            errors: [null, null, null],
            here: readsThePlayersRealm(role) ? [[true, 0]] : [],
            fields: readsThePlayersRealm(role) ? ['id', 'player_index'] : [],
            elsewhere: 0,
            // the open game's realm: its own player, its GM (another GM) and the Overlord
            rivals: role === 'a rival' || role === 'another GM' || role === 'the Overlord' ? [0] : [],
          },
    );
  });
  test.for(THE_ROLES)("%s: the player's realm by its id", async (role) => {
    const answer = await dbOf(role).thePlayersRealms.thisRealm(thePlayersRealm);
    expect({
      error: itsError(answer),
      realm: answer.data && [theSlotsOf([answer.data]), answer.data.display_name, answer.data.orders_submitted],
    }).toEqual(
      readsThePlayersRealm(role)
        ? { error: null, realm: [['Marchwood 0'], 'Realm of Ashford', true] }
        : { error: role === 'signed out' ? NO_GRANT : NO_SUCH_ROW, realm: null },
    );
  });
});

describe('joining: an account joins as itself, once a game, in a free slot; the Overlord never', () => {
  /** The realms joined in a test, removed after it. */
  afterEach(async () => {
    const { error } = await world.theServiceRole
      .from('game_players')
      .delete()
      .eq('game_id', idOfGame('the open game'))
      .neq('player_index', 0);
    if (error) throw new Error(`removing the joined realms: ${error.message}`);
  });
  const aJoin = (account: string, slot: number) => ({
    game_id: idOfGame('the open game'),
    user_id: account,
    player_index: slot,
    display_name: 'Realm of Greywater',
    orders_submitted: false,
    turn_report: JSON.stringify({ playerSetup: { alignment: 'Good' }, status: 'joined', waitingForTurn0: true }),
  });
  /** What each role's join of the open game, as itself in slot 1, answers. */
  const THE_JOIN_AS_ITSELF: Record<ARole, { readonly error: unknown; readonly code: unknown }> = {
    'signed out': { error: NO_GRANT, code: '42501' },
    'a player': { error: null, code: null },
    // it holds the open game's slot 0 already
    'a rival': { error: expect.stringMatching(/game_players_one_per_user/), code: '23505' },
    "the game's GM": { error: null, code: null },
    'another GM': { error: null, code: null },
    'the Overlord': { error: REFUSED_BY_THE_RULES, code: '42501' },
  };
  test.for(THE_ROLES)('%s: joins the open game as itself, in a free slot', async (role) => {
    const account = role === 'signed out' ? thePlayer() : world.accounts[role];
    const answer = await dbOf(role).thePlayersRealms.joinWithThisRealm(aJoin(account, 1));
    const joined = THE_JOIN_AS_ITSELF[role].error === null;
    expect({
      error: itsError(answer),
      code: itsCode(answer),
      realm: answer.data && [
        theSlotsOf([answer.data]),
        answer.data.user_id === account,
        answer.data.display_name,
        typeof answer.data.id,
      ],
    }).toEqual({
      ...THE_JOIN_AS_ITSELF[role],
      realm: joined ? [['the open game 1'], true, 'Realm of Greywater', 'string'] : null,
    });
  });
  test.for(THE_ROLES.filter((role) => role !== 'signed out'))(
    "%s: can't join as the player, unless it is the player",
    async (role) => {
      const answer = await dbOf(role).thePlayersRealms.joinWithThisRealm(aJoin(thePlayer(), 1));
      // the player joins as itself, and the open game's GM adds realms to it (gp4); the rest are refused
      const added = role === 'a player' || role === 'another GM';
      expect({ error: itsError(answer), code: itsCode(answer) }).toEqual(
        added ? { error: null, code: null } : { error: REFUSED_BY_THE_RULES, code: '42501' },
      );
    },
  );
  test("a player can't take a slot already held, nor join a game twice", async () => {
    const db = dbOf('a player');
    const taken = await db.thePlayersRealms.joinWithThisRealm(aJoin(thePlayer(), 0));
    const twice = await db.thePlayersRealms.joinWithThisRealm({ ...aJoin(thePlayer(), 3), game_id: world.theGame });
    expect({
      taken: [itsCode(taken), itsError(taken)],
      twice: [itsCode(twice), itsError(twice)],
    }).toEqual({
      taken: ['23505', expect.stringMatching(/game_players_one_per_number/)],
      twice: ['23505', expect.stringMatching(/game_players_one_per_user/)],
    });
  });
});

describe("get_game_slots(): every realm's slot in the games an account may see, the Overlord every game", () => {
  /** Every realm's slot of the four games. */
  const THE_SLOTS: Record<AGamesName, readonly string[]> = {
    Marchwood: ['Marchwood 0', 'Marchwood 1', 'Marchwood 2'],
    Fenmoor: ['Fenmoor 0'],
    'the open game': ['the open game 0'],
    'the private game': ['the private game 0'],
  };
  test.for(THE_ROLES)('%s: the slots of the four games', async (role) => {
    const answer = await dbOf(role).thePlayersRealms.theSlotsOfTheseGames(everyGame());
    const slot = (name: string) => answer.data?.find((row) => theSlotsOf([row])[0] === name);
    expect({
      error: itsError(answer),
      slots: theSlotsOf(answer.data),
      fields: Object.keys(answer.data?.[0] ?? {}).sort(),
      // a held realm, an unheld one, the alignment only in setup, the orders flag
      marchwood0: slot('Marchwood 0') && [
        slot('Marchwood 0')?.is_bot,
        slot('Marchwood 0')?.alignment,
        slot('Marchwood 0')?.orders_submitted,
      ],
      marchwood2: slot('Marchwood 2')?.is_bot,
      open0: slot('the open game 0')?.alignment,
    }).toEqual(
      role === 'signed out'
        ? { error: NO_GRANT, slots: [], fields: [], marchwood0: undefined, marchwood2: undefined, open0: undefined }
        : {
            error: null,
            slots: THE_GAMES_EACH_ROLE_READS[role].flatMap((name) => THE_SLOTS[name]).sort(),
            fields: ['alignment', 'game_id', 'is_bot', 'orders_submitted', 'player_index'],
            marchwood0: reads(role, 'Marchwood') ? [false, null, true] : undefined,
            marchwood2: reads(role, 'Marchwood') ? true : undefined,
            open0: 'Undead',
          },
    );
  });
});

describe('the games: read by their GM, their players and the Overlord, and in setup if open or invited', () => {
  test.for(THE_ROLES)('%s: the turn and state of the four games', async (role) => {
    const answer = await dbOf(role).thePlayersGames.theTurnAndStateOfTheseGames(everyGame());
    const marchwood = answer.data?.find((row) => row.id === world.theGame);
    expect({
      error: itsError(answer),
      games: theGamesOf(answer.data),
      fields: Object.keys(answer.data?.[0] ?? {}).sort(),
      marchwood: marchwood && [marchwood.turn, marchwood.status],
    }).toEqual({
      error: theErrorFor(role),
      games: theGamesEachRoleReads(role),
      fields: role === 'signed out' ? [] : ['id', 'status', 'turn'],
      marchwood: reads(role, 'Marchwood') ? [3, 'active'] : undefined,
    });
  });
  test.for(THE_ROLES)('%s: the four games for their cards, and every column', async (role) => {
    const db = dbOf(role);
    const cards = await db.thePlayersGames.theseGamesForTheirCards(everyGame());
    const whole = await db.thePlayersGames.theseGamesEveryColumn(everyGame());
    expect({
      errors: [itsError(cards), itsError(whole)],
      cards: theGamesOf(cards.data),
      whole: theGamesOf(whole.data),
      cardsFields: Object.keys(cards.data?.[0] ?? {}).sort(),
      wholeHasTheWorld: whole.data?.map((row) => 'game_state' in row),
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role)],
      cards: theGamesEachRoleReads(role),
      whole: theGamesEachRoleReads(role),
      cardsFields:
        role === 'signed out'
          ? []
          : ['created_at', 'gm_user_id', 'id', 'max_players', 'meta', 'name', 'status', 'turn'],
      wholeHasTheWorld: role === 'signed out' ? undefined : THE_GAMES_EACH_ROLE_READS[role].map(() => true),
    });
  });
  test.for(THE_ROLES)('%s: the games in setup', async (role) => {
    const answer = await dbOf(role).thePlayersGames.theGamesInSetup();
    expect({ error: itsError(answer), games: theGamesOf(answer.data) }).toEqual({
      error: theErrorFor(role),
      games: theGamesEachRoleReads(role).filter((name) => name === 'the open game' || name === 'the private game'),
    });
  });
  test.for(THE_ROLES)("%s: the private game's world and state", async (role) => {
    const answer = await dbOf(role).thePlayersGames.thisGamesWorldAndState(idOfGame('the private game'));
    expect({
      error: itsError(answer),
      game: answer.data && [answer.data.status, typeof answer.data.game_state, Object.keys(answer.data).sort()],
    }).toEqual(
      reads(role, 'the private game')
        ? { error: null, game: ['setup', 'string', ['game_state', 'status']] }
        : { error: role === 'signed out' ? NO_GRANT : NO_SUCH_ROW, game: null },
    );
  });
  test.for(THE_ROLES)('%s: Marchwood for its report, and every column', async (role) => {
    const db = dbOf(role);
    const report = await db.thePlayersGames.thisGameForItsReport(world.theGame);
    const whole = await db.thePlayersGames.thisGameEveryColumn(world.theGame);
    const theError = role === 'signed out' ? NO_GRANT : NO_SUCH_ROW;
    expect({
      errors: [itsError(report), itsError(whole)],
      report: report.data && [report.data.name, report.data.turn, Object.keys(report.data).sort()],
      whole: whole.data && [whole.data.name, 'game_state' in whole.data],
    }).toEqual(
      reads(role, 'Marchwood')
        ? {
            errors: [null, null],
            report: [
              'Made-up Marchwood',
              3,
              ['block_eliminated_msgs', 'gm_user_id', 'id', 'max_players', 'name', 'status', 'turn'],
            ],
            whole: ['Made-up Marchwood', true],
          }
        : { errors: [theError, theError], report: null, whole: null },
    );
  });
});

describe("the turns' logs: read by the game's GM, its players and the Overlord", () => {
  test.for(THE_ROLES)("%s: a realm's log of one turn, and the GM's whole log", async (role) => {
    const db = dbOf(role);
    const asked = [
      [world.theGame, 2, 0],
      [world.theGame, 2, -1],
      [world.theGame, 1, 1],
      [world.theOtherGMsGame, 2, 0],
    ] as const;
    const answers = await Promise.all(
      asked.map(([game, turn, realm]) => db.theChroniclesLogs.theLogOfThisRealmInThisTurn(game, turn, realm)),
    );
    const marchwood = reads(role, 'Marchwood') && role !== 'signed out';
    const fenmoor = role === 'another GM' || role === 'the Overlord';
    expect(
      answers.map((answer) => ({
        error: itsError(answer),
        rows: answer.data?.map((row) => [theGamesNamed([row.game_id]), row.turn, row.player_index, row.entries]),
      })),
    ).toEqual(
      role === 'signed out'
        ? asked.map(() => ({ error: NO_GRANT, rows: undefined }))
        : [
            { error: null, rows: marchwood ? [[['Marchwood'], 2, 0, [{ text: theLogsWords(2, 0) }]]] : [] },
            { error: null, rows: marchwood ? [[['Marchwood'], 2, -1, [{ text: theLogsWords(2, -1) }]]] : [] },
            { error: null, rows: marchwood ? [[['Marchwood'], 1, 1, [{ text: theLogsWords(1, 1) }]]] : [] },
            { error: null, rows: fenmoor ? [[['Fenmoor'], 2, 0, [{ text: theLogsWords(2, 0) }]]] : [] },
          ],
    );
  });
});
