// The Overlord's games list reads every page of games (plan P1-21p, the mutation session over P1-13e6 to P1-16d):
// loadGames (src/ui/overlord/main.ts, on its Db since P1-17f) asks for games 200 at a time and asks again after a
// full page, so an Overlord with 201 games sees all 201; a short page is the last.
// Level 1 (unit): the page's file imports in Node once its config, the `supabase` global and a Db are handed in (the
// fake, tests/lib/fake-db.ts, under the name the page takes one by; its version never answers, so the page never
// starts); loadGames is called directly. A page test would boot the page and sign the Overlord in to reach the list.
import { beforeAll, describe, expect, test } from 'vitest';
import type { AGameAsTheOverlordListsIt, Db } from '../../src/db/the-db-interface-and-its-areas.ts';
import { THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER } from '../../src/db/the-pages-database-client.ts';
import { bootJsdom } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';

/** A made-up game, the `n`th newest. */
const aGame = (n: number): AGameAsTheOverlordListsIt => ({
  id: 'game-' + String(n),
  name: 'Made-up game ' + String(n),
  gm_user_id: 'a-made-up-gm',
  status: 'active',
  turn: 1,
  max_turns: 20,
  created_at: '2026-01-01T00:00:00Z',
  meta: {},
});
/** How many games the database holds. */
let held = 0;
const asked: [number, number][] = [];
let page: { loadGames: () => Promise<void>; GAMES: unknown[] | null };

beforeAll(async () => {
  const fake = makeAFakeDb(['20261015051826']);
  const db: Db = {
    ...fake.db,
    theDatabasesVersion: { askTheDatabaseItsVersion: () => new Promise(() => undefined) },
    theOverlordsGames: {
      ...fake.db.theOverlordsGames,
      everyGameNewestFirstFromRowToRow: (from, to) => {
        asked.push([from, to]);
        const rows = Array.from({ length: Math.max(0, Math.min(held, to + 1) - from) }, (_, i) => aGame(from + i));
        return Promise.resolve({ data: rows, error: null, status: 200 });
      },
    },
  };
  const { window } = bootJsdom('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    window,
    document: window['document'],
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => ({}) },
    [THE_NAME_A_TEST_HANDS_THE_PAGE_ITS_DB_UNDER]: db,
  });
  page = await import('../../src/ui/overlord/main.ts');
});

describe("the Overlord's games list", () => {
  test.for([
    [
      201,
      [
        [0, 199],
        [200, 399],
      ],
    ],
    [
      200,
      [
        [0, 199],
        [200, 399],
      ],
    ],
    [199, [[0, 199]]],
    [0, [[0, 199]]],
  ] as const)('%i games: all of them, asked for as %j', async ([games, pages]) => {
    held = games;
    asked.length = 0;
    await page.loadGames();
    expect(page.GAMES?.length).toBe(games);
    expect(asked).toEqual(pages);
  });
});
