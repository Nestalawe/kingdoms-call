// The GM page's own report builder (buildTurnReport, on what a realm may see: playerView) names no realm a realm hasn't
// met, and no hero of one, in its titles (2026-09-27, the ruling R-046): one all-bot game of 6 turns, and on its last
// two turns (the titles are public from turn 5) each realm's report built by the booted page and checked by
// tests/lib/the-names-of-unmet-realms-and-their-heroes-a-realms-titles-show.ts. The page boots without an error.
//
// Level 4 (page): the GM page booted in jsdom (tests/lib/boot.ts) on the fake database (tests/lib/fake-db.ts). The
// check over whole games is the simulation test on the engine's modules
// (tests/simulation/whole-all-bot-games-pay-whole-wages-and-no-realms-titles-name-a-realm-it-has-not-met.test.ts), and
// the turns here are played there too (tests/lib/a-staged-turn-on-the-engines-modules.ts, its dice from KC_SEED); but
// these calls are the last a test makes to two names the GM page keeps for its tests (src/ui/gm/globals.ts). Without
// them tests/static/page-globals.test.ts fails, and taking the names off is a change to src/, which plan P1-14z makes
// none of. Until plan P1-14z the page's calls were tests/fuzz-advance-masking.test.js's.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, type World } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';
import {
  theTitlesAreShownMasked,
  theUnmetNamesTheTitlesShow,
  type ARealmsTitles,
  type TheWorldAsTheTitlesCheckReadsIt,
} from '../lib/the-names-of-unmet-realms-and-their-heroes-a-realms-titles-show.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const TURNS = 6;
/** The turns whose reports are checked: the titles are public from turn 5 (TITLES_PUBLIC_FROM_TURN). */
const FROM_TURN = 5;

let W: PageWindow;
const errors: string[] = [];
const leaks: string[] = [];
let reportsChecked = 0;

// Booted as the script booted it (its errors kept, its console quiet, 0.6 s); the game of 6 turns on the modules takes
// about a second on a laptop.
beforeAll(async () => {
  ({ window: W } = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb([DB_VERSION]).db,
    seed: SEED,
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.console.error = (...a: unknown[]) => {
        const t = a.map(String).join(' ');
        if (/Could not load|stub|fetch/i.test(t)) return;
        errors.push('console.error: ' + t);
      };
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }));
  await new Promise((resolve) => setTimeout(resolve, 600));
  const reportOf = W.eval('(S,pi)=>buildTurnReport(playerView(S,pi))') as (S: unknown, pi: number) => unknown;

  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { S, setup } = sc.world({ realms: 5, cols: 12, rows: 7, seaPct: 35 });
  S['botDifficulty'] = 'hard';
  S['botDiplomacy'] = 'normal';
  const rows = setup.map((sp) => ({
    id: sp.gamePlayerId,
    user_id: null,
    player_index: sp.id,
    display_name: sp.name,
    orders: null,
    orders_submitted: false,
    turn_report: JSON.stringify({ isBot: true }),
  }));
  let state: World = S;
  for (let t = 1; t <= TURNS; t++) {
    state = sc.play(state, rows).S2;
    if (state.turn < FROM_TURN) continue;
    const world = state as unknown as TheWorldAsTheTitlesCheckReadsIt;
    world.players.forEach((_, pi) => {
      // the page's report, as plain data
      const report = JSON.parse(JSON.stringify(reportOf(state, pi))) as { titles?: ARealmsTitles };
      if (!theTitlesAreShownMasked(report.titles)) return;
      reportsChecked++;
      for (const leak of theUnmetNamesTheTitlesShow(world, pi, report.titles))
        leaks.push(`turn ${String(state.turn)}: ${leak}`);
    });
  }
}, timeLimitGivenAsANumber(30_000).timeout);
afterAll(() => {
  W.close();
});

test('the GM page boots without an error', () => {
  expect(errors).toEqual([]);
});
test("the GM page's own report builder names no realm a realm hasn't met, or a hero of one, in its titles", () => {
  expect(leaks.join('\n')).toBe('');
  expect(reportsChecked, 'the titles were public in some report').toBeGreaterThan(0);
});
