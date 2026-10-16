// Deterministic boot (P1-01a): the GM portal booted with the same seed and the same clock (bootJsdom's `seed` and
// `now`) plays the same all-bot turn byte for byte: the saved world, every realm's report and the turn's log rows.
// A different seed plays a different turn, so the seed is what decides it. Level 4 (page): the turn runs inside the
// booted page (runTurn), and the clock it reads is the page's own Date.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { bootJsdom, readPage } from '../lib/boot.js';
import { makeStub } from '../lib/stub-db.js';

const NOW = '2026-10-01T12:00:00Z';
const REALMS = 4;

// The stand-in database stamps rows with the test process's own clock; hold it still so only the page's clock
// can make two runs differ.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
});
afterEach(() => {
  vi.useRealTimers();
});

// Boots the GM portal, makes a world where every realm is a bot, runs one turn, and returns what was saved.
async function oneTurn(seed: number, now: string): Promise<string> {
  const S = makeStub();
  const errors: string[] = [];
  const dom = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
    supabase: S.supabase,
    seed,
    now,
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.onunhandledrejection = (e) => errors.push(String(e.reason));
      w.console.error = (...a) => errors.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  });
  const W = dom.window;
  try {
    await new Promise((r) => setTimeout(r, 900));
    expect(errors, 'the GM portal boots without errors').toEqual([]);
    W['currentUser'] = { id: 'gm1' };
    W['__sp'] = Array.from({ length: REALMS }, (_, i) => ({
      id: i,
      gamePlayerId: 'gp' + String(i),
      isBot: true,
      name: 'Realm' + String(i),
      kingName: 'King' + String(i),
      kingdomName: 'Realm' + String(i),
      race: ['Human', 'Elven', 'Dwarven', 'Orcish'][i],
      alignment: ['Good', 'Druidic', 'Neutral', 'Evil'][i],
      temper: 'Brave',
      skills: { melee: 1, tactical: 1, march: 1, white: 1, naval: 0, sage: 1, explorer: 1 },
    }));
    W.eval(`(function(){ const g=generateNewGame(__sp,{cols:9,rows:7},0,{seaPct:35});
      g.turnMode={mode:'manual',time:'20:00',everyDays:1,nextDeadlineAt:null,turnRanAt:new Date().toISOString()};
      g.botDifficulty='hard'; g.botDiplomacy='normal'; window.__G=g; })()`);
    const games = S.DB['games'] ?? [];
    const players = S.DB['game_players'] ?? [];
    games.push({
      id: 'G1',
      name: 'Determinism',
      gm_user_id: 'gm1',
      status: 'active',
      turn: 1,
      max_players: REALMS,
      max_turns: 0,
      created_at: new Date().toISOString(),
      game_state: W.eval('JSON.stringify(__G)'),
      meta: W.eval('JSON.parse(JSON.stringify(buildGameMeta(__G)))'),
    });
    for (let i = 0; i < REALMS; i++) {
      players.push({
        id: 'G1gp' + String(i),
        game_id: 'G1',
        user_id: null,
        player_index: i,
        display_name: 'Realm' + String(i),
        orders_submitted: false,
        orders: null,
        turn_report: JSON.stringify({ isBot: true, playerSetup: {} }),
      });
    }
    W['__game'] = structuredClone(games[0]);
    const result = (await W.eval('runTurn({auto:true,game:__game,reason:"determinism"})')) as { ok?: boolean } | null;
    await new Promise((r) => setTimeout(r, 60));
    expect(errors, 'the turn runs without errors').toEqual([]);
    expect(result?.ok, 'the turn resolves').not.toBe(false);
    expect(games[0]?.['turn'], 'the turn moved on').toBe(2);
    return JSON.stringify({
      games: S.DB['games'],
      players: S.DB['game_players'],
      logs: S.DB['turn_logs'],
      events: S.DB['turn_events'],
    });
  } finally {
    W.close();
  }
}

// Where two runs' saved bytes first part, with a little of each around it, for the failure message.
function firstDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return 'no difference';
  return `they differ at byte ${String(i)}: …${a.slice(Math.max(0, i - 80), i + 80)}… against …${b.slice(Math.max(0, i - 80), i + 80)}…`;
}

test('the same seed and clock play the same turn, byte for byte; another seed plays another', async () => {
  const first = await oneTurn(1234, NOW);
  const second = await oneTurn(1234, NOW);
  const other = await oneTurn(5678, NOW);
  expect(second === first, firstDifference(first, second)).toBe(true);
  expect(other === first, 'a run with another seed saved the same bytes').toBe(false);
}, 60_000);
