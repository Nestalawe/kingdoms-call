// 2026-10-13 (Toby, Creatures and Monsters VI; R-106): Island Back on the player portal. Its Move notice reads the
// column through poSeaAnalysis, which counts through the rule the engine shares (seaLiftOfAColumn): two berths on a
// turtle, three heavy units one too many, four under a leader of Naval 8 (two under Naval 7, two short); and a unit the
// player's earlier orders will raise, whose type can't be known yet ('__projected foot__', the notice's stand-in),
// takes half a hull, as light foot do: a galleon carries two. The rule itself is
// tests/unit/island-back-the-great-turtles-carry-two-units-a-hull.test.ts.
//
// Level 4 (page): poSeaAnalysis is the portal's own code, in a module that loads the portal's start-up (which calls
// supabase.createClient as it loads), so only the booted page reaches it: the portal booted in jsdom (tests/lib/boot.js)
// on the fake database (tests/lib/fake-db.ts's makeAFakeDb, holding no account and no game).
//
// Until plan P1-14e this was the Move notice's part of tests/island-back.test.js, the same boot and the same calls; its
// six checks are kept as they were.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';

interface Analysis {
  cap: string;
  hullCap: number;
  navalL8: boolean;
  short: number;
}
const errs: string[] = [];
let P: PageWindow;
beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb([DB_VERSION]).db,
    url: 'https://example.org/pp',
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

const u = (type: string, n = 1) =>
  Array.from({ length: n }, (_, i) => ({ type, quality: 'Average', unitName: `${type} ${String(i + 1)}` }));

test("the Move notice counts a turtle's two berths, doubled under Naval 8, and a grave still to be raised as light foot", () => {
  expect(typeof P['poSeaAnalysis'], `the player portal boots (${errs.slice(0, 3).join(' | ')})`).toBe('function');
  const an = (armies: unknown[], naval = 0) =>
    (P['poSeaAnalysis'] as (armies: unknown[], naval: number) => Analysis)(armies, naval);
  const two = an([...u('Great Turtles'), ...u('Gilded Lances', 2)]);
  expect({ cap: two.cap, hullCap: two.hullCap }, 'the move analysis counts two berths on a turtle').toEqual({
    cap: 'sea',
    hullCap: 2,
  });
  expect(
    an([...u('Great Turtles'), ...u('Gilded Lances', 3)]).cap,
    '…and reads three heavy units as one too many',
  ).toBe('land');
  const four = (naval: number) => an([...u('Great Turtles'), ...u('Gilded Lances', 4)], naval);
  expect(
    { cap: four(8).cap, hullCap: four(8).hullCap, navalL8: four(8).navalL8 },
    '…under a leader of Naval 8 a turtle carries four',
  ).toEqual({ cap: 'sea', hullCap: 4, navalL8: true });
  expect({ cap: four(7).cap, hullCap: four(7).hullCap, short: four(7).short }, '…and under Naval 7 two').toEqual({
    cap: 'land',
    hullCap: 2,
    short: 2,
  });
  const graves = an([
    ...u('Galleon Fleet'),
    ...[1, 2].map((i) => ({
      type: '__projected foot__',
      quality: 'Average',
      unitName: `a grave ${String(i)}`,
      _projected: true,
    })),
  ]);
  expect(
    { cap: graves.cap, short: graves.short },
    "…and two graves still to be raised take one galleon's berth",
  ).toEqual({
    cap: 'sea',
    short: 0,
  });
  expect(errs, 'no page error').toEqual([]);
});
