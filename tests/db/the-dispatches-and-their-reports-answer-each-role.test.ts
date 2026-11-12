// The dispatches and their reports, areas of the page's Db (src/db/the-db-interface-and-its-areas.ts: theDispatches,
// theReportedDispatches; plan P1-17h), on a supabase-js client of the local Supabase, as each role (signed out, a
// player, a rival, the game's GM, another GM, the Overlord):
// - the dispatches (game_messages): a realm reads what it sent, what was sent to it and what is public; the game's GM
//   the public ones and those reported to them; the Overlord every one; a visitor nothing, for want of a grant. Only
//   the realm's own player sends as it, within the send limit (10 a minute, 300 a day, in the database's words) and the
//   length check; only the game's GM and the Overlord delete one (its reports with it);
// - the read marks (game_message_reads): each account reads and writes only its own realm's;
// - the reports (message_reports, gm_reported_messages()): a player reports a dispatch they received, once, and sees
//   their own reports; the reports go to the game's GM when the GM plays no realm in the game, and to the Overlord.
// Each change is undone before the next test (the dispatches, marks and reports put back), so the world is the same for
// each; the rows are removed after (their game_id is text, not a foreign key, so they outlive a game made again).
// Level db (the access layer, against the local Supabase): the queries and the access rules together, which no lower
// level holds (pgTAP checks the rules in SQL; the page tests run on the stand-in).
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
/** A new row the access rules refuse, in their words. */
const refusedByTheRulesFor = (table: string): unknown =>
  expect.stringMatching(new RegExp(`row-level security policy for table "${table}"`));
/** The error's words a call answered, or null. */
const itsError = (answer: { readonly error: { readonly message: string } | null }): string | null =>
  answer.error?.message ?? null;
/** A field of the error a call answered (its code or its hint), or null. */
const itsErrors = (answer: ADatabaseAnswer<unknown>, field: 'code' | 'hint'): unknown =>
  answer.error && field in answer.error ? Reflect.get(answer.error, field) : null;
/** The account of `role` (signed out: none, so the player's, which the grant refuses first). */
const accountOf = (role: ARole): string => (role === 'signed out' ? world.accounts['a player'] : world.accounts[role]);

/** The made-up game's and the other GM's game's ids (beforeAll). */
let ours: readonly string[] = [];
const theGame = (): string => world.theGame;
const theOtherGame = (): string => world.theOtherGMsGame;

/** The made-up dispatches, by name, as each is made (putBackTheRows): its id, by the order they were made in. */
const THE_DISPATCHES = [
  'the player to every realm',
  'the rival to the player',
  'the player to the unheld realm',
  'the rival to the unheld realm',
  "the other game's to every realm",
] as const;
type ADispatchsName = (typeof THE_DISPATCHES)[number];
const idOf = new Map<ADispatchsName, number>();
const theIdOf = (name: ADispatchsName): number => {
  const id = idOf.get(name);
  if (id === undefined) throw new Error(`no dispatch ${name}`);
  return id;
};
/** The names of the dispatches `rows`, in their order (any not made here left out). */
const theNamesOf = (rows: readonly { readonly id: number }[] | null): string[] =>
  (rows ?? []).flatMap((row) => THE_DISPATCHES.filter((name) => idOf.get(name) === row.id));
/** Long ago: the made-up dispatches count toward no send limit. */
const LONG_AGO = '2026-01-01T00:00:00+00:00';
const THE_PLAYERS_READ_MARKS = { pub: 1 };
const THE_RIVALS_READ_MARKS = { pub: 2 };
const A_REASON = 'A made-up reason';
const ANOTHER_REASON = 'Another made-up reason';
/** The length check's refusal, in the words the page rewords (src/ui/player/dispatches.ts). */
const THE_LENGTH_CHECKS_WORDS: unknown = expect.stringMatching(/game_messages_body_len/);

/** Puts back the made-up dispatches, read marks and reports (the service role), as each test finds them. */
const putBackTheRows = async (): Promise<void> => {
  const service = world.theServiceRole;
  for (const table of ['message_reports', 'game_message_reads', 'game_messages'] as const) {
    const { error } = await service.from(table).delete().in('game_id', ours);
    if (error) throw new Error(`clearing ${table}: ${error.message}`);
  }
  const player = world.accounts['a player'];
  const rival = world.accounts['a rival'];
  const made: Record<ADispatchsName, { game: string; from: number; user: string; to: number[] }> = {
    'the player to every realm': { game: theGame(), from: 0, user: player, to: [] },
    'the rival to the player': { game: theGame(), from: 1, user: rival, to: [0] },
    'the player to the unheld realm': { game: theGame(), from: 0, user: player, to: [2] },
    'the rival to the unheld realm': { game: theGame(), from: 1, user: rival, to: [2] },
    "the other game's to every realm": { game: theOtherGame(), from: 0, user: world.accounts['another GM'], to: [] },
  };
  idOf.clear();
  // one at a time, so each id is above the one before
  for (const name of THE_DISPATCHES) {
    const { game, from, user, to } = made[name];
    const { data, error } = await service
      .from('game_messages')
      .insert({
        game_id: game,
        turn: 1,
        from_index: from,
        from_user_id: user,
        to_indexes: to,
        scope: to.length ? 'private' : 'public',
        body: `Made-up words: ${name}`,
        created_at: LONG_AGO,
      })
      .select('id')
      .single();
    if (error) throw new Error(`making the dispatch ${name}: ${error.message}`);
    idOf.set(name, data.id);
  }
  const marks = await service.from('game_message_reads').insert([
    { game_id: theGame(), player_index: 0, user_id: player, reads: THE_PLAYERS_READ_MARKS },
    { game_id: theGame(), player_index: 1, user_id: rival, reads: THE_RIVALS_READ_MARKS },
  ]);
  if (marks.error) throw new Error(`making the read marks: ${marks.error.message}`);
  const report = await service.from('message_reports').insert({
    message_id: theIdOf('the rival to the player'),
    game_id: theGame(),
    reporter_index: 0,
    reporter_user_id: player,
    reason: A_REASON,
  });
  if (report.error) throw new Error(`making the report: ${report.error.message}`);
};
/** The names of our dispatches left, as the service role reads them, by id. */
const theDispatchesLeft = async (): Promise<string[]> => {
  const { data, error } = await world.theServiceRole
    .from('game_messages')
    .select('id')
    .in('game_id', ours)
    .order('id', { ascending: true });
  if (error) throw new Error(`reading the dispatches: ${error.message}`);
  return theNamesOf(data);
};
/** Our reports left, as the service role reads them: each dispatch's name and its reporter's realm. */
const theReportsLeft = async (): Promise<string[]> => {
  const { data, error } = await world.theServiceRole
    .from('message_reports')
    .select('message_id,reporter_index')
    .in('game_id', ours);
  if (error) throw new Error(`reading the reports: ${error.message}`);
  return data.map((row) => `${theNamesOf([{ id: row.message_id }]).join('')} by ${String(row.reporter_index)}`).sort();
};
/** The read marks of the made-up game's realm `realm`, as the service role reads them. */
const theReadMarksOfRealm = async (realm: number): Promise<unknown> =>
  (
    await world.theServiceRole
      .from('game_message_reads')
      .select('reads')
      .eq('game_id', theGame())
      .eq('player_index', realm)
      .maybeSingle()
  ).data?.reads ?? null;

/** What each role reads of the made-up game's dispatches, oldest first. */
const WHAT_EACH_ROLE_READS: Record<ARole, readonly ADispatchsName[]> = {
  'signed out': [],
  'a player': ['the player to every realm', 'the rival to the player', 'the player to the unheld realm'],
  'a rival': ['the player to every realm', 'the rival to the player', 'the rival to the unheld realm'],
  // the public one, and the one reported to them
  "the game's GM": ['the player to every realm', 'the rival to the player'],
  'another GM': [],
  'the Overlord': [
    'the player to every realm',
    'the rival to the player',
    'the player to the unheld realm',
    'the rival to the unheld realm',
  ],
};
/** Each role's answer: a visitor's refusal for want of a grant, else no error. */
const theErrorFor = (role: ARole): unknown => (role === 'signed out' ? NO_GRANT : null);
/** Who reads `name` of the other game's dispatches: its GM and the Overlord. */
const readsTheOtherGames = (role: ARole): boolean => role === 'another GM' || role === 'the Overlord';

beforeAll(async () => {
  world = await makeAMadeUpWorld(local, 'dispatches');
  ours = [world.theGame, world.theOtherGMsGame];
  await putBackTheRows();
  for (const role of THE_ROLES) clients.set(role, await world.signedInAs(role));
});
afterAll(async () => {
  for (const table of ['message_reports', 'game_message_reads', 'game_messages'] as const)
    await world.theServiceRole.from(table).delete().in('game_id', ours);
  await world.removeIt();
});

describe('the dispatches: each role reads what the rules let it', () => {
  test.for(THE_ROLES)('%s: the probes find a dispatch and a read mark', async (role) => {
    const db = dbOf(role);
    const dispatch = await db.theDispatches.oneDispatchsId();
    const mark = await db.theDispatches.oneReadMarksGame();
    expect({
      errors: [itsError(dispatch), itsError(mark)],
      rows: [dispatch.data?.length, mark.data?.length],
    }).toEqual(
      role === 'signed out'
        ? { errors: [NO_GRANT, NO_GRANT], rows: [undefined, undefined] }
        : {
            errors: [null, null],
            // every account reads one of ours; only the player and the rival have read marks
            rows: [1, role === 'a player' || role === 'a rival' ? 1 : 0],
          },
    );
  });
  test.for(THE_ROLES)("%s: the game's newest dispatches, newest first, as many as asked for", async (role) => {
    const db = dbOf(role);
    const all = await db.theDispatches.theNewestDispatchesOfThisGame(theGame(), 50);
    const two = await db.theDispatches.theNewestDispatchesOfThisGame(theGame(), 2);
    const other = await db.theDispatches.theNewestDispatchesOfThisGame(theOtherGame(), 50);
    const reads = WHAT_EACH_ROLE_READS[role];
    expect({
      errors: [itsError(all), itsError(two), itsError(other)],
      all: theNamesOf(all.data),
      two: theNamesOf(two.data),
      other: theNamesOf(other.data),
      fields: Object.keys(all.data?.[0] ?? {}).sort(),
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role), theErrorFor(role)],
      all: [...reads].reverse(),
      two: [...reads].reverse().slice(0, 2),
      other: readsTheOtherGames(role) ? ["the other game's to every realm"] : [],
      fields: reads.length ? ['body', 'created_at', 'from_index', 'id', 'scope', 'to_indexes', 'turn'] : [],
    });
  });
  test.for(THE_ROLES)('%s: the dispatches after one (oldest first) and before one (newest first)', async (role) => {
    const db = dbOf(role);
    const first = theIdOf('the player to every realm');
    const last = theIdOf('the rival to the unheld realm');
    const after = await db.theDispatches.theDispatchesOfThisGameAfterThisOne(theGame(), first, 50);
    const afterOne = await db.theDispatches.theDispatchesOfThisGameAfterThisOne(theGame(), first, 1);
    const before = await db.theDispatches.theDispatchesOfThisGameBeforeThisOne(theGame(), last, 50);
    const beforeOne = await db.theDispatches.theDispatchesOfThisGameBeforeThisOne(theGame(), last, 1);
    const reads = WHAT_EACH_ROLE_READS[role];
    const afterTheFirst = reads.filter((name) => name !== 'the player to every realm');
    const beforeTheLast = reads.filter((name) => name !== 'the rival to the unheld realm').reverse();
    expect({
      errors: [after, afterOne, before, beforeOne].map(itsError),
      after: theNamesOf(after.data),
      afterOne: theNamesOf(afterOne.data),
      before: theNamesOf(before.data),
      beforeOne: theNamesOf(beforeOne.data),
    }).toEqual({
      errors: [1, 2, 3, 4].map(() => theErrorFor(role)),
      after: afterTheFirst,
      afterOne: afterTheFirst.slice(0, 1),
      before: beforeTheLast,
      beforeOne: beforeTheLast.slice(0, 1),
    });
  });
  test.for(THE_ROLES)("%s: both games' newest dispatches, their games and realms only", async (role) => {
    const answer = await dbOf(role).theDispatches.theNewestDispatchesOfTheseGamesGamesAndRealms(ours);
    const theGames = await dbOf(role).theDispatches.theNewestDispatchesOfTheseGamesGamesAndRealms([theGame()]);
    const expected = [
      ...(readsTheOtherGames(role) ? ["the other game's to every realm"] : []),
      ...[...WHAT_EACH_ROLE_READS[role]].reverse(),
    ];
    expect({
      errors: [itsError(answer), itsError(theGames)],
      names: theNamesOf(answer.data),
      theGames: theNamesOf(theGames.data),
      fields: Object.keys(answer.data?.[0] ?? {}).sort(),
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role)],
      names: expected,
      theGames: [...WHAT_EACH_ROLE_READS[role]].reverse(),
      fields: expected.length ? ['from_index', 'game_id', 'id', 'scope', 'to_indexes'] : [],
    });
  });
});

describe('the dispatches: only the realm sends as itself, within the limits; the GM and the Overlord delete', () => {
  beforeEach(putBackTheRows);
  test.for(THE_ROLES)("%s: sending a dispatch as the player's realm", async (role) => {
    const answer = await dbOf(role).theDispatches.sendThisDispatch({
      game_id: theGame(),
      turn: 3,
      from_index: 0,
      from_user_id: accountOf(role),
      to_indexes: [1],
      scope: 'private',
      body: 'A new made-up word',
    });
    const sent = (
      await world.theServiceRole
        .from('game_messages')
        .select('body,from_index,to_indexes,scope,turn')
        .eq('body', 'A new made-up word')
    ).data;
    expect({ error: itsError(answer), sent }).toEqual(
      role === 'a player'
        ? {
            error: null,
            sent: [{ body: 'A new made-up word', from_index: 0, to_indexes: [1], scope: 'private', turn: 3 }],
          }
        : { error: role === 'signed out' ? NO_GRANT : refusedByTheRulesFor('game_messages'), sent: [] },
    );
  });
  test("the send limit: the 11th dispatch in a minute is refused, in the database's words", async () => {
    const send = (n: number): PromiseLike<ADatabaseAnswer<null>> =>
      dbOf('a player').theDispatches.sendThisDispatch({
        game_id: theGame(),
        from_index: 0,
        from_user_id: world.accounts['a player'],
        scope: 'public',
        body: `Made-up word ${String(n)}`,
      });
    const answers: (string | null)[] = [];
    for (let n = 1; n <= 11; n++) answers.push(itsError(await send(n)));
    const eleventh = await send(12);
    expect({ answers, hint: itsErrors(eleventh, 'hint') }).toEqual({
      answers: [
        ...Array.from({ length: 10 }, () => null),
        "You're sending dispatches too quickly. Try again in a minute.",
      ],
      hint: 'kc_dispatch_rate',
    });
  });
  test("the send limit: the 301st dispatch in a day is refused, in the database's words", async () => {
    // 300 sent an hour ago (the service role; the trigger counts them as they come), so none counts in the minute
    const anHourAgo = new Date(Date.now() - 3600_000).toISOString();
    for (let batch = 0; batch < 3; batch++) {
      const { error } = await world.theServiceRole.from('game_messages').insert(
        Array.from({ length: 100 }, (_, n) => ({
          game_id: theGame(),
          from_index: 0,
          from_user_id: world.accounts['a player'],
          scope: 'public',
          body: `An old made-up word ${String(batch * 100 + n)}`,
          created_at: anHourAgo,
        })),
      );
      if (error) throw new Error(`making the day's dispatches: ${error.message}`);
    }
    const answer = await dbOf('a player').theDispatches.sendThisDispatch({
      game_id: theGame(),
      from_index: 0,
      from_user_id: world.accounts['a player'],
      scope: 'public',
      body: 'One too many',
    });
    expect({ error: itsError(answer), hint: itsErrors(answer, 'hint') }).toEqual({
      error: "You've sent 300 dispatches in this game today, the most allowed. Try again tomorrow.",
      hint: 'kc_dispatch_rate',
    });
  });
  test('the length check: a dispatch of 501 characters is refused, in the words the page rewords', async () => {
    const answer = await dbOf('a player').theDispatches.sendThisDispatch({
      game_id: theGame(),
      from_index: 0,
      from_user_id: world.accounts['a player'],
      scope: 'public',
      body: 'x'.repeat(501),
    });
    expect({ error: itsError(answer), code: itsErrors(answer, 'code') }).toEqual({
      error: THE_LENGTH_CHECKS_WORDS,
      code: '23514',
    });
  });
  test.for(THE_ROLES)("%s: deleting a reported dispatch, and the other game's", async (role) => {
    const db = dbOf(role);
    const reported = await db.theDispatches.deleteThisDispatch(theIdOf('the rival to the player'));
    const other = await db.theDispatches.deleteThisDispatch(theIdOf("the other game's to every realm"));
    const deletes =
      role === "the game's GM" ? 'ours' : role === 'another GM' ? 'theirs' : role === 'the Overlord' ? 'both' : 'none';
    expect({
      errors: [itsError(reported), itsError(other)],
      left: await theDispatchesLeft(),
      reports: await theReportsLeft(),
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role)],
      left: THE_DISPATCHES.filter(
        (name) =>
          !(
            (name === 'the rival to the player' && (deletes === 'ours' || deletes === 'both')) ||
            (name === "the other game's to every realm" && (deletes === 'theirs' || deletes === 'both'))
          ),
      ),
      // a deleted dispatch's reports go with it
      reports: deletes === 'ours' || deletes === 'both' ? [] : ['the rival to the player by 0'],
    });
  });
});

describe('the read marks: each account reads and writes only its own', () => {
  beforeEach(putBackTheRows);
  test.for(THE_ROLES)("%s: the player's realm's marks, and the marks of the account's own realms", async (role) => {
    const db = dbOf(role);
    const theRealms = await db.theDispatches.thisRealmsReadMarksInThisGame(theGame(), 0);
    const own = await db.theDispatches.thisAccountsReadMarksInTheseGames(ours, accountOf(role));
    const thePlayers = await db.theDispatches.thisAccountsReadMarksInTheseGames(ours, world.accounts['a player']);
    expect({
      errors: [itsError(theRealms), itsError(own), itsError(thePlayers)],
      theRealms: theRealms.data,
      own: own.data,
      thePlayers: thePlayers.data?.length,
    }).toEqual(
      role === 'signed out'
        ? { errors: [NO_GRANT, NO_GRANT, NO_GRANT], theRealms: null, own: null, thePlayers: undefined }
        : {
            errors: [null, null, null],
            theRealms: role === 'a player' ? { reads: THE_PLAYERS_READ_MARKS } : null,
            own:
              role === 'a player'
                ? [{ game_id: theGame(), player_index: 0, reads: THE_PLAYERS_READ_MARKS }]
                : role === 'a rival'
                  ? [{ game_id: theGame(), player_index: 1, reads: THE_RIVALS_READ_MARKS }]
                  : [],
            thePlayers: role === 'a player' ? 1 : 0,
          },
    );
  });
  test.for(THE_ROLES)("%s: writing the player's realm's marks, over the old ones", async (role) => {
    const answer = await dbOf(role).theDispatches.writeTheseReadMarks({
      game_id: theGame(),
      player_index: 0,
      user_id: accountOf(role),
      reads: { pub: 9 },
      updated_at: new Date().toISOString(),
    });
    expect({ error: itsError(answer), marks: await theReadMarksOfRealm(0) }).toEqual(
      role === 'a player'
        ? { error: null, marks: { pub: 9 } }
        : {
            error: role === 'signed out' ? NO_GRANT : refusedByTheRulesFor('game_message_reads'),
            marks: THE_PLAYERS_READ_MARKS,
          },
    );
  });
});

describe('the reports: a player reports a dispatch they received, once; it goes to the GM or the Overlord', () => {
  beforeEach(putBackTheRows);
  test.for(THE_ROLES)('%s: the dispatches the account has reported in the game', async (role) => {
    const answer = await dbOf(role).theReportedDispatches.theDispatchesThisAccountReportedInThisGame(theGame());
    expect({ error: itsError(answer), reported: answer.data }).toEqual(
      role === 'signed out'
        ? { error: NO_GRANT, reported: null }
        : { error: null, reported: role === 'a player' ? [{ message_id: theIdOf('the rival to the player') }] : [] },
    );
  });
  test.for(THE_ROLES)("%s: reporting the player's public dispatch, as the rival's realm, twice", async (role) => {
    const db = dbOf(role);
    const report = {
      message_id: theIdOf('the player to every realm'),
      game_id: theGame(),
      reporter_index: 1,
      reason: A_REASON,
    };
    const first = await db.theReportedDispatches.reportThisDispatch(report);
    const again = await db.theReportedDispatches.reportThisDispatch(report);
    expect({
      first: itsError(first),
      again: role === 'a rival' ? itsErrors(again, 'code') : itsError(again),
      reports: await theReportsLeft(),
    }).toEqual(
      role === 'a rival'
        ? {
            first: null,
            // the page takes the second as sent (23505: the dispatch is reported once)
            again: '23505',
            reports: ['the player to every realm by 1', 'the rival to the player by 0'],
          }
        : {
            first: role === 'signed out' ? NO_GRANT : refusedByTheRulesFor('message_reports'),
            again: role === 'signed out' ? NO_GRANT : refusedByTheRulesFor('message_reports'),
            reports: ['the rival to the player by 0'],
          },
    );
  });
  test("a player can't report their own dispatch, nor one they weren't sent", async () => {
    const db = dbOf('a player');
    const own = await db.theReportedDispatches.reportThisDispatch({
      message_id: theIdOf('the player to the unheld realm'),
      game_id: theGame(),
      reporter_index: 0,
    });
    const notSent = await db.theReportedDispatches.reportThisDispatch({
      message_id: theIdOf('the rival to the unheld realm'),
      game_id: theGame(),
      reporter_index: 0,
    });
    expect([itsError(own), itsError(notSent), await theReportsLeft()]).toEqual([
      refusedByTheRulesFor('message_reports'),
      refusedByTheRulesFor('message_reports'),
      ['the rival to the player by 0'],
    ]);
  });
  test.for(THE_ROLES)('%s: the reported dispatches of the game, and of every game', async (role) => {
    // a report in the other game too (the service role: no account holds its realm), made after the first
    const another = await world.theServiceRole.from('message_reports').insert({
      message_id: theIdOf("the other game's to every realm"),
      game_id: theOtherGame(),
      reporter_index: 1,
      reporter_user_id: world.accounts['a rival'],
      reason: ANOTHER_REASON,
    });
    if (another.error) throw new Error(`making the other report: ${another.error.message}`);
    const db = dbOf(role);
    const theGames = await db.theReportedDispatches.theDispatchesReportedToThisAccount(theGame());
    const every = await db.theReportedDispatches.theDispatchesReportedToThisAccount(null);
    const short = (
      rows: readonly { message_id: number; reporter_index: number; reason: string; body: string }[] | null,
    ) =>
      (rows ?? [])
        .filter((row) => [...idOf.values()].includes(row.message_id))
        .map((row) => [theNamesOf([{ id: row.message_id }]).join(''), row.reporter_index, row.reason, row.body]);
    const theReport = [['the rival to the player', 0, A_REASON, 'Made-up words: the rival to the player']];
    const theOtherReport = [
      ["the other game's to every realm", 1, ANOTHER_REASON, "Made-up words: the other game's to every realm"],
    ];
    const reportedTo = role === "the game's GM" || role === 'the Overlord';
    expect({
      errors: [itsError(theGames), itsError(every)],
      theGames: short(theGames.data),
      every: short(every.data),
    }).toEqual({
      errors: [theErrorFor(role), theErrorFor(role)],
      theGames: reportedTo ? theReport : [],
      // the newest report first
      every:
        role === 'the Overlord'
          ? [...theOtherReport, ...theReport]
          : role === "the game's GM"
            ? theReport
            : role === 'another GM'
              ? theOtherReport
              : [],
    });
  });
  test("a GM who plays a realm in the game isn't sent its reports; the Overlord is", async () => {
    const service = world.theServiceRole;
    const plays = await service
      .from('game_players')
      .update({ user_id: world.accounts["the game's GM"] })
      .eq('game_id', theGame())
      .eq('player_index', 2);
    if (plays.error) throw new Error(`the GM taking the unheld realm: ${plays.error.message}`);
    const gm = await dbOf("the game's GM").theReportedDispatches.theDispatchesReportedToThisAccount(theGame());
    const overlord = await dbOf('the Overlord').theReportedDispatches.theDispatchesReportedToThisAccount(theGame());
    const back = await service
      .from('game_players')
      .update({ user_id: null })
      .eq('game_id', theGame())
      .eq('player_index', 2);
    if (back.error) throw new Error(`the unheld realm given back: ${back.error.message}`);
    expect([itsError(gm), gm.data?.length, itsError(overlord), overlord.data?.length]).toEqual([null, 0, null, 1]);
  });
});
