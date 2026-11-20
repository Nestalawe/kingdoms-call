// 2026-10-14 (batch item 4): a guardian's special comes off half as often again, and running games take the new odds
// at their next turn (GUARDIAN_TABLE_VER, migrateLairGuardiansV2). On the booted GM page, a running game's Dire Wolf,
// saved at an older table version with its old odds (50%), is re-read from the table: 75%. The table's figures are
// tests/unit/a-guardians-special-comes-off-half-as-often-again-at-most-95-percent.test.ts.
//
// Level 4 (page): the GM page booted in jsdom (tests/lib/boot.ts) on the fake database (tests/lib/fake-db.ts). The
// migration is the engine's module, and a unit test could call it there; but this call is the last a test makes to a
// name the GM page keeps for its tests (src/ui/gm/globals.ts: migrateLairGuardiansV2). Without it
// tests/static/page-globals.test.ts fails, and taking the name off is a change to src/, which plan P1-14z makes none
// of. When it leaves the list, this check moves down beside the table's. Nothing here reads the page's dice.
//
// Until plan P1-14z this was the last check of tests/guardian-special-odds.test.js, kept as it was, with its check
// that the page booted with no errors.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';

let GM: PageWindow;
const errors: string[] = [];

// Booted as the old script did: the errors its scripts throw are kept, its console is silenced, and it is given 0.4 s.
beforeAll(async () => {
  ({ window: GM } = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb([DB_VERSION]).db,
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }));
  await new Promise((resolve) => setTimeout(resolve, 400));
});
afterAll(() => {
  GM.close();
});

test("a running game's Dire Wolf takes the new odds at its next turn", () => {
  const castChance = GM.eval(`(function(){
    const gs={_guardiansVer:18,world:{provinces:[{features:[{monster:{name:'Dire Wolf',hp:16,spells:[{name:'Lunging Bite',castChance:50}]}}]}]}};
    migrateLairGuardiansV2(gs);
    return gs.world.provinces[0].features[0].monster.spells[0].castChance;
  })()`);
  expect(castChance).toBe(75);
});

test('no page errors', () => {
  expect(errors.map((error) => error.split('\n')[0])).toEqual([]);
});
