// 2026-09-27 (Toby, item 7; R-061): the player portal's Diplomacy card shows a realm that has conceded as Conceded,
// with the turn it quit and why, and offers no treat or declare buttons against it; a declaration already pending
// against it is dropped. A live realm keeps its controls; an extinguished dynasty is shown, and can't be treated with.
// What the report carries for the card is
// unit/when-every-rival-but-one-concedes-the-reckoning-is-called-and-the-last-crown-wins.test.ts.
//
// Level 4 (page): the card is the player portal's own code (_renderDiplomacyInto, on the portal's diploChoices), in
// modules that load the portal's start-up (which calls supabase.createClient as it loads), so only the booted page
// reaches it: the portal booted in jsdom (tests/lib/boot.js) on the fake database (tests/lib/fake-db.ts's
// makeAFakeDb, holding no account and no game), the card drawn from a hand-made report.
//
// Until plan P1-14h this was the card's part of tests/concede.test.js, the same boot and the same calls. Its checks
// are kept as they were: "_renderDiplomacyInto found" as the function found on the booted page, and "player page
// errors 0" as no page error and no console.error on the page.
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

test('the Diplomacy card shows a conceded realm as such, with no controls, and an extinguished one that cannot be treated with', () => {
  expect(typeof P['_renderDiplomacyInto'], 'player portal: _renderDiplomacyInto found').toBe('function');
  const render = P['_renderDiplomacyInto'] as (el: Element, report: unknown, editable: boolean) => void;
  const evaluate = (code: string): unknown => P.eval(code);
  const el = (P['document'] as Document).createElement('div');
  const report = {
    kingdom: { alignment: 'Good' },
    diplomacy: {
      alliancesAllowed: true,
      known: [
        {
          index: 0,
          name: 'Quit Realm',
          color: '#900',
          alignment: 'Evil',
          relation: 'enemy',
          conceded: true,
          concededTurn: 7,
          eliminated: false,
        },
        {
          index: 2,
          name: 'Live Realm',
          color: '#090',
          alignment: 'Good',
          relation: 'neutral',
          conceded: false,
          eliminated: false,
        },
        {
          index: 3,
          name: 'Dead Dynasty',
          color: '#009',
          alignment: 'Neutral',
          relation: 'neutral',
          conceded: false,
          eliminated: true,
        },
      ],
    },
  };
  // a declaration already pending against the realm that quit (a top-level `let`: reached through eval)
  evaluate("diploChoices={0:'treat'};");
  render(el, report, true);
  const html = el.innerHTML;
  const block = (name: string) => {
    const i = html.indexOf(name);
    const j = html.indexOf('</div></div>', i);
    return html.slice(i, j < 0 ? html.length : j);
  };
  const quit = block('Quit Realm');
  const live = block('Live Realm');
  const dead = block('Dead Dynasty');
  expect(quit, 'item 7: the conceded realm is labelled Conceded').toMatch(/Conceded/);
  expect(quit, 'item 7: it says which turn they quit').toMatch(/turn 7/);
  expect(quit, 'item 7: no treat / declare buttons against a realm that has quit').not.toMatch(/setDiploChoice/);
  expect(quit, 'item 7: the card explains why').toMatch(/withdrawn from the game/);
  expect(evaluate('diploChoices[0]===undefined'), 'item 7: a pending declaration against them is dropped').toBe(true);
  expect(live, 'item 7: a live realm keeps its diplomacy controls').toMatch(/setDiploChoice\(2,/);
  expect(
    dead.includes('Extinguished') && !dead.includes('setDiploChoice(3,'),
    'item 7: an extinguished dynasty is shown and cannot be treated with',
  ).toBe(true);
  expect(errs, 'player page errors 0').toEqual([]);
});
