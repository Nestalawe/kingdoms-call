// The GM page's "Forget deleted games' data" button forgets only the games that no longer exist (P0-22, rulings R-068
// and R-099), whoever runs the games that still do. Two games still exist (the test GM's and another GM's) and one was
// deleted; each has a recorded turn, a result and a Hall of Fame entry. Signed in as the Overlord (who runs no game, and
// sees every game's statistics since P0-22) or as the test GM, the button removes the deleted game's turns, results
// and entry, and nothing of the games that still exist. Until plan P1-14z the script stats-forget-deleted.
// Level 4 (page): the GM portal boots in jsdom on the fake holding the GM's world (tests/lib/fake-db.ts), signs in, and
// opens the statistics tab, as the button's GM does. The function on a stood-in Db's answers (each call it makes, the
// hundred games a check, the refusals) is the statistics tab's unit test; this checks it on the world the page reads,
// with the sign-in of each role.
import { expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage } from '../lib/boot.ts';
import { aGameMastersWorld, makeAFakeDbHoldingTheGameMastersWorld } from '../lib/fake-db.ts';

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test.each([
  ['the Overlord', 'ov1'],
  ['a GM', 'gm1'],
])(
  "signed in as %s: the deleted game's turns, results and Hall of Fame entry go, the other games' stay",
  async (_who, me) => {
    const S = aGameMastersWorld();
    S.tables.site_admins.push({ user_id: 'ov1' });
    S.tables.profiles.push({ id: 'ov1', name: 'Test Overlord' }, { id: 'gm2', name: 'Other GM' });
    for (const [id, gm] of [
      ['G-mine', 'gm1'],
      ['G-other', 'gm2'],
    ])
      S.tables.games.push({
        id,
        name: 'Game ' + String(id),
        gm_user_id: gm,
        status: 'active',
        turn: 3,
        max_players: 2,
        max_turns: 0,
        created_at: '2026-10-01T00:00:00Z',
        meta: null,
        game_state: '{}',
      });
    for (const id of ['G-mine', 'G-other', 'G-gone']) {
      S.tables.turn_events.push({ id: 'te-' + id, game_id: id, turn: 1, player_index: 0, realm: 'Realm of ' + id });
      S.tables.game_results.push({ id: 'gr-' + id, game_id: id, player_index: 0, realm: 'Realm of ' + id });
      S.tables.game_records.push({ id: 'rec-' + id, game_id: id, game_name: 'Game ' + id, gm_user_id: 'gm1' });
    }
    S.me = me;
    const { window: W } = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
      supabase: { createClient: () => ({}) },
      db: makeAFakeDbHoldingTheGameMastersWorld(DB_VERSION, S).db,
      setup(w) {
        Object.assign(w.console, { warn: () => undefined, log: () => undefined, error: () => undefined });
      },
    });
    await wait(900);
    const call = (name: string, ...args: unknown[]): unknown => {
      const f: unknown = Reflect.get(W, name);
      if (typeof f !== 'function') throw new Error('no ' + name);
      return Reflect.apply(f, W, args);
    };
    await call('openStats', true);
    await wait(100);
    await call('forgetDeletedGames');
    await wait(100);
    const left = (table: 'turn_events' | 'game_results' | 'game_records'): unknown[] =>
      S.tables[table].map((r) => r['game_id']).sort();
    expect(left('turn_events')).toEqual(['G-mine', 'G-other']);
    expect(left('game_results')).toEqual(['G-mine', 'G-other']);
    expect(left('game_records')).toEqual(['G-mine', 'G-other']);
    W.close();
  },
);
