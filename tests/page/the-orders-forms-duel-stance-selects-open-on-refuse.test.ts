// 2026-10-13 (item 1): a hero's Duel Stance defaults to Refuse, not Accept: the player portal's orders form opens on
// Refuse for every hero. That the engine treats a hero with no stance as refusing, and that the form's markup and its
// submitted plan fall back to Refuse everywhere, is tests/unit/a-heros-duel-stance-defaults-to-refuse.test.ts.
//
// Level 4 (page): the selects are built by the booted portal's own code (buildOrdersForm, on its globals
// currentGamePlayer and currentReport), so only the page shows how they open: the portal booted in jsdom
// (tests/lib/boot.js) on the fake database (tests/lib/fake-db.ts's makeAFakeDb, holding no account and no
// game), then the form built for a king and a hero of realm 0.
//
// Until plan P1-14c this was the second half of tests/duel-refuse-default.test.js, the same boot and the same form.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';

const errs: string[] = [];
let P: PageWindow;
beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb([DB_VERSION]).db,
    setup(w) {
      w.addEventListener('error', (e) => errs.push(e.error?.stack ?? e.message));
      w.console.error = (...a: unknown[]) => {
        const t = a.map(String).join(' ');
        if (/Could not load|stub|fetch/i.test(t)) return;
        errs.push('console.error: ' + t);
      };
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }).window;
  await new Promise((resolve) => setTimeout(resolve, 400));
});
afterAll(() => {
  P.close();
});

test('every hero of the orders form has a Duel stance select, and each opens on Refuse', () => {
  expect(typeof P['buildOrdersForm'], `the player portal boots (${errs.slice(0, 3).join(' | ')})`).toBe('function');
  const hero = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    player: 0,
    locationId: 11,
    locationName: 'Ashford',
    hp: 20,
    maxHp: 20,
    armies: [],
    items: [],
    skills: {},
    effectiveSpeed: 3,
    effectiveSeaSpeed: 3,
    ...extra,
  });
  P.eval(`currentGamePlayer={id:'gpx',orders:null};`);
  P.eval(
    `currentReport=${JSON.stringify({
      turn: 3,
      _liveTurn: 3,
      characters: [hero('h1', 'Aldric', { isKing: true }), hero('h2', 'Brannoc')],
      kingdom: { gold: 100, alignment: 'Good' },
      worldMeta: { provinces: [{ id: 11, name: 'Ashford' }] },
    })};`,
  );
  (P['buildOrdersForm'] as (chars: unknown, a: boolean, b: null, turn: number) => void)(
    P.eval('currentReport.characters'),
    false,
    null,
    3,
  );
  const doc = P['document'] as Document;
  const sels = [...doc.querySelectorAll<HTMLSelectElement>('select[id^="ep-duel-"]')];
  expect(sels.length, 'every hero has a Duel stance select').toBeGreaterThanOrEqual(2);
  expect(
    sels.map((s) => s.value),
    'each one opens on Refuse',
  ).toEqual(sels.map(() => 'refuse'));
  expect(errs, 'no page error').toEqual([]);
});
