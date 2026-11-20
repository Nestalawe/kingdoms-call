// Site code must cope while its database change is missing (supabase/README.md, "Database and site changes go
// separately"). The example: the games.meta column. With it hidden in the fake database, the GM page must notice
// (probeGameMeta) and say so on its game list, and a turn must still resolve and save, because writing an unknown
// column fails the whole save (docs/traps.md, "A new column must be optional at the write site"). Copy this shape for a
// new table or column: hide it (the fake's missingColumns, tests/lib/fake-db.ts), then use the feature.
//
// Level 4 (page): the probe, the game list's notice and the save are the GM page's own shell (src/ui/gm/), run only on
// the page booted in jsdom (tests/lib/boot.ts) against the fake database; a staged turn on the engine's modules writes
// nothing to a database. The world is a small all-bot game, staged directly: any world will do, the check is that the
// save goes through; the page's dice are seeded from KC_SEED, and no check reads them.
//
// Until plan P1-14z this was tests/meta-missing-turn.test.js (labelled scenario: it plays one turn), each check kept as
// it was.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import { aGameMastersWorld, makeAFakeDbHoldingTheGameMastersWorld } from '../lib/fake-db.ts';

const S = aGameMastersWorld();
S.missingColumns.add('games.meta');
const errs: string[] = [];
let W: PageWindow;
let noticed: unknown;
let theListSays = '';
let res: unknown = null;
let thrown: string | null = null;
const pageErrors: string[] = [];

beforeAll(async () => {
  W = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, S).db,
    setup(w) {
      w.addEventListener('error', (e) =>
        errs.push(e.error?.stack !== undefined && e.error.stack !== '' ? e.error.stack : e.message),
      );
      w.onunhandledrejection = (e) => {
        const r = e.reason;
        errs.push(String(r instanceof Error && r.stack !== undefined && r.stack !== '' ? r.stack : r));
      };
      w.console.error = (...a) => errs.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }).window;
  await new Promise((r) => setTimeout(r, 900));
  W['currentUser'] = { id: 'gm1' };

  noticed = await W.eval('probeGameMeta()');
  // `as`: the page's document
  theListSays = (W['document'] as Document).getElementById('msg-games')?.innerHTML ?? '';

  // A small all-bot game, staged directly. Any world will do: the check is that the save goes through.
  W['__sp'] = Array.from({ length: 3 }, (_, i) => ({
    id: i,
    gamePlayerId: 'gp' + String(i),
    isBot: true,
    name: 'Realm' + String(i),
    kingName: 'King' + String(i),
    kingdomName: 'Realm' + String(i),
    race: ['Human', 'Elven', 'Dwarven'][i],
    alignment: ['Good', 'Neutral', 'Druidic'][i],
    temper: 'Brave',
    skills: { melee: 1, tactical: 1, march: 1, white: 1, naval: 0, sage: 1, explorer: 1 },
  }));
  // a whole save, as Turn 0 writes it (the GM page's stop, P1-15f8)
  W.eval(`(function(){ const g=generateNewGame(__sp,{cols:8,rows:7},0,{seaPct:20});
    g.turnMode={mode:'manual',time:'20:00',everyDays:1,nextDeadlineAt:null,turnRanAt:new Date().toISOString()};
    g.botDifficulty='hard'; g.botDiplomacy='normal'; window.__G=g; })()`);
  // no meta: the column isn't there
  S.tables.games.push({
    id: 'G1',
    name: 'Missing meta',
    gm_user_id: 'gm1',
    status: 'active',
    turn: 1,
    max_players: 3,
    max_turns: 0,
    created_at: new Date().toISOString(),
    game_state: String(W.eval('JSON.stringify(__G)')),
  });
  for (let i = 0; i < 3; i++)
    S.tables.game_players.push({
      id: 'gp' + String(i),
      game_id: 'G1',
      user_id: null,
      player_index: i,
      display_name: 'Realm' + String(i),
      orders_submitted: false,
      orders: null,
      turn_report: JSON.stringify({ isBot: true, playerSetup: {} }),
    });

  errs.length = 0;
  W['__game'] = JSON.parse(JSON.stringify(S.tables.games[0]));
  try {
    res = await W.eval('runTurn({auto:true,game:__game,reason:"meta-missing"})');
  } catch (e) {
    thrown = e instanceof Error && e.message !== '' ? e.message : String(e);
  }
  await new Promise((r) => setTimeout(r, 60));
  pageErrors.push(...errs);
});
afterAll(() => {
  W.close();
});

test('the page notices games.meta is missing', () => {
  expect(noticed).toBe(false);
});
test('and says so on the game list', () => {
  expect(theListSays).toMatch(/Disk-IO fix not active/);
});
test('a turn resolves and reports success', () => {
  expect(thrown).toBeNull();
  expect(res).toMatchObject({ ok: true });
});
test('and is saved: the game is on turn 2', () => {
  expect(S.tables.games[0]?.['turn']).toBe(2);
});
test('nothing wrote the missing column', () => {
  expect(S.tables.games[0] ?? {}).not.toHaveProperty('meta');
});
test('no page errors', () => {
  expect(pageErrors.map((e) => e.split('\n')[0])).toEqual([]);
});
