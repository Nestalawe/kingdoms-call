// Master GM mode in the GM portal (P0-32g, ruling R-097), on the fake database holding the GM's world
// (tests/lib/fake-db.ts):
//   - signed in as the Overlord: every game, whoever runs it, grouped by GM and filtered by game or GM name; no New
//     Game; the automatic watcher never starts, and the sign-in backfills (meta, results) touch no one's games;
//   - opening another GM's game with orders still missing shows Run turn now (a GM still waits for every order), and
//     Run turn now resolves that game in the fake's world;
//   - Stats names every game's turns; ?game=<id> (the Overlord page's link) opens that game for the Overlord only;
//   - a Game Master's portal is as before: their own games, New Game, the watcher, the backfills on their games.
// Each part boots the page once, in beforeAll, and keeps what the page showed; each check is a test of its own. The
// game Run turn now resolves is made by the page's own generateNewGame on its dice (KC_SEED's stream for the boot):
// the checks (the turn moves on, the game stays its GM's, the GM's log is written) hold on any seed. Until plan P1-14z
// the script master-gm-mode.
// Level 4 (page): the role the sign-in finds decides the list, the watcher, the backfills and the Run turn now button
// across the GM portal's files, on the database's answers; no lower level signs in.
import { beforeAll, describe, expect, test } from 'vitest';
import { DB_VERSION } from '../lib/boot.ts';
import { aGameMastersWorld, makeAFakeDbHoldingTheGameMastersWorld, type TheGameMastersWorld } from '../lib/fake-db.ts';
import {
  bootThePageOnAFakeDatabaseKeepingItsErrors,
  type APageBootedWithItsErrorsKept,
} from '../lib/a-page-booted-in-jsdom-on-a-fake-database-with-its-errors-kept.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

const GM = 'kingdoms-call-gm-portal.html';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** How long Run turn now may take to resolve the two-bot game (the script's wait), and the hook's limit around it. */
const RUN_TURN_NOW_WAIT_MS = 30_000;

/** A made-up game: its id, name, GM, status and turn, a manual turn mode unless `extra` says otherwise. */
const aGame = (
  id: string,
  name: string,
  gm: string,
  status: string,
  turn: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  name,
  gm_user_id: gm,
  status,
  turn,
  max_players: 2,
  max_turns: 999,
  created_at: '2026-10-0' + id.slice(-1) + 'T00:00:00Z',
  meta: { v: 1, turnMode: { mode: 'manual' } },
  game_state: '{}',
  ...extra,
});

/** The GM's world with a second Game Master (gm2, five games), the Overlord (ov1) and a player. */
function stageTheWorld(S: TheGameMastersWorld): void {
  S.tables.profiles.push(
    { id: 'gm2', name: 'Warden Pell' },
    { id: 'ov1', name: 'Test Overlord' },
    { id: 'p1', name: 'Ada Thorn' },
  );
  S.tables.site_admins.push({ user_id: 'ov1' });
  S.tables.game_masters.push({
    user_id: 'gm2',
    offered_at: '2026-10-01T00:00:00Z',
    offered_by: 'ov1',
    accepted_at: '2026-10-01T00:00:00Z',
  });
  S.tables.games.push(
    aGame('G1', 'Marchwood', 'gm1', 'active', 3),
    aGame('G2', 'Fenmoor', 'gm2', 'active', 2),
    // orders still missing: p1 hasn't sent theirs
    aGame('G3', 'Hollow Reach', 'gm2', 'active', 4),
    // an automatic game with every order in: a watcher would run it
    aGame('G4', 'Saltmarsh', 'gm2', 'active', 5, { meta: { v: 1, turnMode: { mode: 'auto' } } }),
    // what the sign-in backfills look for: a game without meta, a finished game without results
    aGame('G5', 'Old Keep', 'gm2', 'active', 2, { meta: null, game_state: '{"turnMode":{"mode":"manual"}}' }),
    aGame('G6', 'Ashen Fold', 'gm2', 'complete', 9, {
      game_state: '{"gameOver":{"winner":0},"players":[{"name":"Morrowgate"}]}',
    }),
  );
  S.tables.game_players.push(
    { id: 's31', game_id: 'G3', user_id: 'p1', player_index: 0, display_name: 'Thornmere', orders_submitted: false },
    {
      id: 's32',
      game_id: 'G3',
      user_id: null,
      player_index: 1,
      display_name: 'Grimfast',
      orders_submitted: false,
      turn_report: '{"isBot":true}',
    },
    { id: 's41', game_id: 'G4', user_id: 'p1', player_index: 0, display_name: 'Thornmere', orders_submitted: true },
  );
  S.tables.turn_events.push({
    id: 1,
    game_id: 'G2',
    turn: 1,
    player_index: 0,
    realm: 'Morrowgate',
    orders: '{}',
    pre: '{}',
    post: '{}',
    outcomes: '{}',
  });
}

interface TheGmPortalBooted extends APageBootedWithItsErrorsKept {
  readonly S: TheGameMastersWorld;
}

async function bootTheGmPortal(me: string, { query = '', waitMs = 900 } = {}): Promise<TheGmPortalBooted> {
  const S = aGameMastersWorld();
  stageTheWorld(S);
  S.me = me;
  const page = await bootThePageOnAFakeDatabaseKeepingItsErrors(
    GM,
    makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, S).db,
    {
      url: 'https://example.org/' + GM + query,
      waitMs,
    },
  );
  return { ...page, S };
}

const textOf = (doc: Document, id: string): string => doc.getElementById(id)?.textContent ?? '';
const listed = (doc: Document): string =>
  [...doc.querySelectorAll('#games-list .game-card[data-game]')]
    .map((c) => c.getAttribute('data-game'))
    .sort()
    .join();
/** Whether `el` is there and neither it nor any element around it is hidden by `display: none`. */
function shown(el: HTMLElement | null): boolean {
  if (!el) return false;
  for (let e: HTMLElement | null = el; e; e = e.parentElement) if (e.style.display === 'none') return false;
  return true;
}
const writesTo = (S: TheGameMastersWorld, re: RegExp): string[] => S.calls.filter((c) => re.test(c));
const gameOf = (S: TheGameMastersWorld, id: string): Record<string, unknown> | undefined =>
  S.tables.games.find((g) => g['id'] === id);

describe("the Overlord's list", () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheGmPortal('ov1', { waitMs: 3600 }); // past the watcher's first tick (3 s)
    const { S, W, doc } = page;
    errs = page.errs;
    seen['listed'] = listed(doc);
    seen['groups'] = [...doc.querySelectorAll('#games-list .gm-group')].map((g) => g.getAttribute('data-gm')).join('|');
    seen['newGame'] = shown(doc.getElementById('new-game-btn'));
    seen['role'] = textOf(doc, 'gm-role-label');
    const filter = doc.querySelector<HTMLInputElement>('#overlord-filter');
    seen['filterShown'] = shown(filter);
    const filterBy = (value: string): string | null => {
      if (!filter) return null;
      filter.value = value;
      // `as`: the page's own Event, so the page's listeners take it
      filter.dispatchEvent(new (W['Event'] as typeof Event)('input'));
      return listed(doc);
    };
    seen['byGm'] = filterBy('pell');
    seen['byGame'] = filterBy('MARCH');
    filterBy('');
    seen['watcher'] = W.eval('_autoWatcherTimer');
    seen['g4Turn'] = gameOf(S, 'G4')?.['turn'];
    seen['gamesSaved'] = writesTo(S, /^games\.update$/);
    seen['resultsWritten'] = writesTo(S, /^game_results\.(insert|upsert)$/);
    W.close();
  });

  test('the Overlord sees every game, whoever runs it', () => {
    expect(seen['listed']).toBe('G1,G2,G3,G4,G5,G6');
  });
  test('grouped by GM, by name', () => {
    expect(seen['groups']).toBe('Test GM|Warden Pell');
  });
  test('no New Game', () => {
    expect(seen['newGame']).toBe(false);
  });
  test('the header says Overlord', () => {
    expect(seen['role']).toMatch(/Overlord/);
  });
  test('a filter shows', () => {
    expect(seen['filterShown']).toBe(true);
  });
  test('filtering by GM name', () => {
    expect(seen['byGm']).toBe('G2,G3,G4,G5,G6');
  });
  test('filtering by game name', () => {
    expect(seen['byGame']).toBe('G1');
  });
  test('the automatic watcher never starts', () => {
    expect(seen['watcher'] == null).toBe(true);
  });
  test('and no game is run or saved, an automatic one with every order in included', () => {
    expect(seen['g4Turn']).toBe(5);
    expect(seen['gamesSaved']).toEqual([]);
  });
  test("the sign-in backfills write nothing to other GMs' games", () => {
    expect(seen['resultsWritten']).toEqual([]);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe("a Game Master's portal is as before", () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheGmPortal('gm2', { waitMs: 1500 });
    const { S, W, doc } = page;
    errs = page.errs;
    seen['listed'] = listed(doc);
    seen['newGame'] = shown(doc.getElementById('new-game-btn'));
    seen['filter'] = shown(doc.getElementById('overlord-filter'));
    seen['watcher'] = W.eval('_autoWatcherTimer');
    seen['g5Meta'] = gameOf(S, 'G5')?.['meta'];
    await W.eval("openGame('G3')");
    await wait(100);
    seen['runTurnNow'] = shown(doc.getElementById('detail-run-turn-wrap'));
    W.close();
  });

  test('a GM sees only their own games', () => {
    expect(seen['listed']).toBe('G2,G3,G4,G5,G6');
  });
  test('with New Game and no filter', () => {
    expect(seen['newGame']).toBe(true);
    expect(seen['filter']).toBe(false);
  });
  test('and the watcher runs', () => {
    expect(seen['watcher'] != null).toBe(true);
  });
  test('and the backfill stamps meta on their own game', () => {
    expect(seen['g5Meta'] != null).toBe(true);
  });
  test('a GM still waits for every order before resolving', () => {
    expect(seen['runTurnNow']).toBe(false);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe("Run turn now on another GM's game", () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(async () => {
    const page = await bootTheGmPortal('ov1');
    const { W, doc } = page;
    errs = page.errs;
    await W.eval("openGame('G3')");
    await wait(100);
    seen['name'] = textOf(doc, 'detail-game-name');
    seen['runTurnNow'] = shown(doc.getElementById('detail-run-turn-wrap'));
    seen['button'] = textOf(doc, 'detail-run-turn-btn');
    seen['note'] = shown(doc.getElementById('detail-run-now-note'));
    W.close();
  });

  test("the Overlord opens another GM's game", () => {
    expect(seen['name']).toBe('Hollow Reach');
  });
  test('with orders still missing, Run turn now shows', () => {
    expect(seen['runTurnNow']).toBe(true);
    expect(seen['button']).toMatch(/Run turn now/);
  });
  test('and says a realm without orders defends', () => {
    expect(seen['note']).toBe(true);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe("Run turn now resolves another GM's game", () => {
  const seen: Record<string, unknown> = {};
  let errs: string[] = [];

  beforeAll(
    async () => {
      // a real two-bot world, run by gm2
      const page = await bootTheGmPortal('ov1');
      const { S, W, doc } = page;
      errs = page.errs;
      // a whole save, as Turn 0 writes it (the GM page's stop, P1-15f8), made by the page itself
      const made = await W.eval(`(async () => {
        const setup = generateBotSetups([], 2, 0).map((b) => ({ ...b, gamePlayerId: 'gr' + b.id, name: b.kingdomName }));
        const state = await generateNewGame(setup, { cols: 10, rows: 6 }, 999, { seaPct: 35 });
        state.botDifficulty = 'hard';
        state.botDiplomacy = 'normal';
        state.turnMode = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
        return JSON.stringify({ setup: setup.map((sp) => ({ row: sp.gamePlayerId, index: sp.id, name: sp.name })), state });
      })()`);
      // `as`: the page's own JSON, of the shape the code above writes
      const { setup, state } = JSON.parse(String(made)) as {
        setup: { row: string; index: number; name: string }[];
        state: unknown;
      };
      S.tables.games.push(aGame('G7', 'Rescue Fen', 'gm2', 'active', 1, { game_state: JSON.stringify(state) }));
      for (const realm of setup)
        S.tables.game_players.push({
          id: realm.row,
          game_id: 'G7',
          user_id: null,
          player_index: realm.index,
          display_name: realm.name,
          orders: null,
          orders_submitted: false,
          turn_report: JSON.stringify({ isBot: true }),
        });
      await W.eval("openGame('G7')");
      await wait(100);
      const run =
        doc.querySelector<HTMLElement>('#detail-run-turn-btn') ??
        doc.querySelector<HTMLElement>('#detail-run-turn-wrap button');
      if (run && shown(run)) run.click();
      const startedAt = Date.now();
      while (gameOf(S, 'G7')?.['turn'] !== 2 && Date.now() - startedAt < RUN_TURN_NOW_WAIT_MS) await wait(50);
      seen['turn'] = gameOf(S, 'G7')?.['turn'];
      seen['gm'] = gameOf(S, 'G7')?.['gm_user_id'];
      seen['gmsLog'] = S.tables.turn_logs.some((l) => l['game_id'] === 'G7' && l['player_index'] === -1);
      W.close();
    },
    timeLimitGivenAsANumber(RUN_TURN_NOW_WAIT_MS + 10_000).timeout,
  );

  test('Run turn now resolves it: it advances to Turn 2', () => {
    expect(seen['turn']).toBe(2);
  });
  test("and it is still that GM's game", () => {
    expect(seen['gm']).toBe('gm2');
  });
  test("and the GM's full log is written", () => {
    expect(seen['gmsLog']).toBe(true);
  });
  test('no page errors', () => {
    expect(errs).toEqual([]);
  });
});

describe('Stats and ?game=', () => {
  const seen: Record<string, unknown> = {};
  const errs: Record<string, string[]> = {};

  beforeAll(async () => {
    {
      const page = await bootTheGmPortal('ov1');
      const { W, doc } = page;
      errs['stats'] = page.errs;
      await W.eval('openStats(true)');
      await wait(100);
      seen['stats'] = [...doc.querySelectorAll('#stats-game option')].map((o) => o.textContent);
      W.close();
    }
    for (const me of ['ov1', 'gm1']) {
      const page = await bootTheGmPortal(me, { query: '?game=G2' });
      const { W, doc } = page;
      errs[me] = page.errs;
      seen[me] = {
        opened: doc.getElementById('sec-game-detail')?.classList.contains('section-active') ?? false,
        name: textOf(doc, 'detail-game-name'),
      };
      W.close();
    }
  });

  test("Stats names every game's turns", () => {
    expect(seen['stats']).toEqual(expect.arrayContaining([expect.stringMatching(/Fenmoor/)]));
  });
  test('Stats: no page errors', () => {
    expect(errs['stats']).toEqual([]);
  });
  test('?game=<id> opens that game for the Overlord', () => {
    expect(seen['ov1']).toEqual({ opened: true, name: 'Fenmoor' });
  });
  test('?game= (the Overlord): no page errors', () => {
    expect(errs['ov1']).toEqual([]);
  });
  test('but not for a GM', () => {
    expect(seen['gm1']).toMatchObject({ opened: false });
  });
  test('?game= (a GM): no page errors', () => {
    expect(errs['gm1']).toEqual([]);
  });
});
