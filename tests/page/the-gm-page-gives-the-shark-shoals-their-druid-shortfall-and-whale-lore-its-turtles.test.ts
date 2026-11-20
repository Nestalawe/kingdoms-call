// 2026-10-13 (the maintainers, Creatures and Monsters III and IV), on the booted GM page:
//   - the one function that applies the Druid shortfall (druIdPenaltyMult) waives it for an Evil realm leading Shark
//     Shoals, charges a Neutral commander at Druid 0 three levels (×0.4), and lets him lead them in full at Druid 3;
//   - Whale Lore (the discovery au20, SAGE_DISCOVERIES_P) lifts the Whale Cohort and the Great Turtles;
//   - each prosperous sea beast's race in PRIMAL_ARMY_DEFS_P is the race the sea pass gives its waters ('Primal:Sea
//     Giant', 'Primal:Kraken', 'Primal:Great Turtle'): the half of the old prosperous-seas check that read the table on
//     the page; the worlds' half is
//     tests/scenario/the-new-creatures-are-dealt-by-terrain-and-the-turtles-are-raised-in-their-own-sea.test.ts.
//
// Level 4 (page): the GM page booted in jsdom (tests/lib/boot.ts) on the fake database (tests/lib/fake-db.ts). The rules
// and tables are the engine's modules, and a unit test could read them there; but these calls are the last a test
// makes to three names the GM page keeps for its tests (src/ui/gm/globals.ts: druIdPenaltyMult, PRIMAL_ARMY_DEFS_P,
// SAGE_DISCOVERIES_P). Without them tests/static/page-globals.test.ts fails, and taking the names off is a change to
// src/, which plan P1-14z makes none of. When they leave the list, these checks move down beside the tables'
// (tests/unit/the-engines-tables-give-each-beast-as-the-wild-roster-table-decides.test.ts). Nothing here reads the
// page's dice.
//
// Until plan P1-14z these were checks of tests/shark-waters.test.js and tests/new-creatures.test.js on the booted GM
// page, each kept as it was, with the scripts' page-errors check.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';
import { ROSTER } from '../lib/primal-decided.ts';

let W: PageWindow;
const errors: string[] = [];
const pen = (align: string, druid: number): unknown =>
  W.eval(
    `druIdPenaltyMult({race:'Orcish',alignment:'Neutral',skills:{druid:${String(druid)}},items:[]},{type:'Shark Shoals',race:'Primal'},${JSON.stringify(align)},false,[])`,
  );

// Booted as the scripts' scenario helper booted it: the errors its scripts throw are kept, its console is silenced, and
// it is given 0.5 s.
beforeAll(async () => {
  ({ window: W } = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb([DB_VERSION]).db,
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }));
  await new Promise((resolve) => setTimeout(resolve, 500));
});
afterAll(() => {
  W.close();
});

test('an Evil realm leads Shark Shoals with no Druid', () => {
  expect(pen('Evil', 0)).toBe(1);
});
test(`a Neutral commander at Druid 0 is ${String(ROSTER['Shark Shoals']?.druid)} levels short of the Shark Shoals: ×0.4`, () => {
  const got = Number(pen('Neutral', 0));
  expect(Math.abs(got - 0.4) < 1e-9, `got ×${String(got)}`).toBe(true);
});
test('…and at Druid 3 leads them in full', () => {
  expect(pen('Neutral', 3)).toBe(1);
});
test('Whale Lore lifts the Whale Cohort and the Great Turtles', () => {
  const lore = W.eval("((SAGE_DISCOVERIES_P.find(d=>d.id==='au20')||{}).effect||{}).types||[]");
  expect(Array.isArray(lore)).toBe(true);
  expect(lore).toEqual(expect.arrayContaining(['Whale Cohort', 'Great Turtles']));
});
test.each([
  ['Sea Giants', 'Primal:Sea Giant'],
  ['Eldritch Kraken', 'Primal:Kraken'],
  ['Great Turtles', 'Primal:Great Turtle'],
])("%s: the page's PRIMAL_ARMY_DEFS_P race is the one its waters carry, %s", (beast, race) => {
  expect('Primal:' + String(W.eval(`PRIMAL_ARMY_DEFS_P[${JSON.stringify(beast)}].race`))).toBe(race);
});
test('no page errors', () => {
  expect(errors.map((error) => error.split('\n')[0])).toEqual([]);
});
