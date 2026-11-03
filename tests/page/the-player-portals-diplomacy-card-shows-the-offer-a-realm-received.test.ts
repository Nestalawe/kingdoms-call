// 2026-10-08 (Toby, item 3c; R-078): the player portal's Diplomacy card shows the offer a realm received last turn:
// "offered an alliance" or "offered peace", and no badge where nothing was offered. What the report carries for the
// card is scenario/an-overture-from-a-stranger-counts-as-meeting-and-no-impossible-alliance-is-offered.test.ts.
//
// Level 4 (page): the card is the player portal's own code (_renderDiplomacyInto), in modules that load the portal's
// start-up (which calls supabase.createClient as it loads), so only the booted page reaches it: the portal booted in
// jsdom (tests/lib/boot.js) on the stand-in database (tests/lib/stub-db.js's cannedStub, which answers every read
// with nothing), the card drawn from a hand-made report.
//
// Until plan P1-14h this was the card's part of tests/overtures.test.js, the same boot and the same call. Its three
// checks are kept as they were, and "player page errors 0" as no page error and no console.error on the page
// (stricter: the old script let a console.error naming "Could not load", "stub" or "fetch" pass; none is logged).
import { afterAll, beforeAll, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { cannedStub } from '../lib/stub-db.js';

const errs: string[] = [];
let P: PageWindow;
beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => cannedStub({ rows: () => ({}), writes: [] }) },
    setup(w) {
      w.addEventListener('error', (e) => errs.push(e.error?.stack ?? e.message));
      w.console.error = (...a: unknown[]) => errs.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }).window;
  await new Promise((resolve) => setTimeout(resolve, 400));
});
afterAll(() => {
  P.close();
});

test('the Diplomacy card shows an offer of alliance or of peace, and no badge where nothing was offered', () => {
  const render = P['_renderDiplomacyInto'] as (el: Element, report: unknown, editable: boolean) => void;
  const el = (P['document'] as Document).createElement('div');
  render(
    el,
    {
      kingdom: { alignment: 'Good' },
      diplomacy: {
        alliancesAllowed: true,
        known: [
          {
            index: 0,
            name: 'Realm Offering',
            color: '#900',
            alignment: 'Good',
            relation: 'neutral',
            offeredUs: 'alliance',
          },
          { index: 2, name: 'Realm At War', color: '#090', alignment: 'Evil', relation: 'enemy', offeredUs: 'peace' },
          { index: 3, name: 'Realm Silent', color: '#009', alignment: 'Neutral', relation: 'neutral' },
        ],
      },
    },
    true,
  );
  const html = el.innerHTML;
  const block = (name: string) => {
    const i = html.indexOf(name);
    const j = html.indexOf('</div></div>', i);
    return html.slice(i, j < 0 ? html.length : j);
  };
  expect(block('Realm Offering'), '(c) the card shows "offered an alliance"').toMatch(/offered an alliance/i);
  expect(block('Realm At War'), '(c) the card shows "offered peace"').toMatch(/offered peace/i);
  expect(block('Realm Silent'), '(c) no badge where nothing was offered').not.toMatch(/offered/i);
  expect(errs, 'player page errors 0').toEqual([]);
});
