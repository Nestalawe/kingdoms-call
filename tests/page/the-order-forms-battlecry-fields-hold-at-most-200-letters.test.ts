// A hero's battlecry holds at most 200 letters (R-183): every battlecry field of the player portal's order forms stops
// at 200, the orders form's for each hero and each pre-order card's (a hero to be raised, charmed or hired). That the
// turn keeps only the first 200 letters of a battlecry sent is the merge's cases
// (tests/lib/set-up-and-order-merge-cases.ts, "encounter plans within what the game offers").
//
// Level 4 (page): the fields are built by the booted portal's own code (buildOrdersForm on its globals
// currentGamePlayer and currentReport, then the cards' own builders), so only the page shows them: the portal booted
// in jsdom (tests/lib/boot.ts) on the fake database (tests/lib/fake-db.ts's makeAFakeDb, holding no account and no
// game), the form built for a king and a hero of realm 0, then a card for a hero to be raised, one to be charmed and
// one to be hired.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';

const errs: string[] = [];
let P: PageWindow;
const call = (name: string, ...args: unknown[]): unknown => {
  const f: unknown = P[name];
  if (typeof f !== 'function') throw new Error(`the page has no function ${name}`);
  return Reflect.apply(f, undefined, args);
};
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

test('every battlecry field of the order forms, each hero’s and each pre-order card’s, stops at 200 letters', () => {
  expect(typeof P['buildOrdersForm'], `the player portal boots (${errs.slice(0, 3).join(' | ')})`).toBe('function');
  const hero = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    player: 0,
    alive: true,
    locationId: 11,
    locationName: 'Ashford',
    hp: 20,
    maxHp: 20,
    armies: [],
    items: [],
    skills: { white: 3 },
    effectiveSpeed: 3,
    effectiveSeaSpeed: 3,
    ...extra,
  });
  const hirer = 'hired_5_via_1_ph0';
  P.eval(`currentGamePlayer={id:'gpx',orders:null};`);
  P.eval(
    `currentReport=${JSON.stringify({
      turn: 3,
      _liveTurn: 3,
      characters: [hero(1, 'Aldric', { isKing: true }), hero(2, 'Brannoc')],
      kingdom: { gold: 100, alignment: 'Good' },
      worldMeta: { provinces: [{ id: 11, name: 'Ashford' }] },
      knownDeadHeroes: [{ id: 7, name: 'Fallen Friend', race: 'Elf', locationId: 11 }],
      visibleChars: [{ id: 8, name: 'Wandering Wren', isKing: false, armies: 0, locationId: 11 }],
      provinceOrderData: { 11: { availableHeroes: [{ id: 9, name: 'Second Hire', race: 'Dwarf', skills: {} }] } },
    })};`,
  );
  (P['buildOrdersForm'] as (chars: unknown, a: boolean, b: null, turn: number) => void)(
    P.eval('currentReport.characters'),
    false,
    null,
    3,
  );
  const doc = P['document'] as Document;
  call('injectResurrectOrders', 1, 0, 7, null);
  call('injectCharmOrders', 2, 0, 8, 'charm-orders-test');
  doc.body.insertAdjacentHTML(
    'beforeend',
    `<div id="hh-test"><div id="hh-card" data-fakeid="${hirer}">
      <select id="po-action-${hirer}-1"><option value="Hire Hero" selected>Hire Hero</option></select>
      <select id="po-target-${hirer}-1"><option value="9" selected>9</option></select></div></div>`,
  );
  call('syncHiredHeroCard', hirer, 1);
  const fields = [...doc.querySelectorAll<HTMLInputElement>('input[id^="ep-notes-"]')];
  expect(
    fields.map((f) => f.id.replace(/^ep-notes-/, '')).sort(),
    'a battlecry field for each hero and each card',
  ).toEqual(['1', '2', 'charm_8_via_2_ph0', 'hired_9_via_hired_5_via_1_ph0_ph1', 'resurrect_7_via_1_ph0']);
  expect(
    fields.map((f) => f.maxLength),
    'each stops at 200 letters',
  ).toEqual(fields.map(() => 200));
  expect(errs, 'no page error').toEqual([]);
});
