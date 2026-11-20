// March and Naval have one rate of advance (2026-10-13, item 14): the old "slow column" ladder, +0/+0/+1/+1/+2/+3 at
// levels 0–5, for every unit whatever its base move. The "fast column" ladder (+0/+1/+1/+2/+2/+2) is gone. Flyers
// (every winged unit, the riders and the flying beasts) gain nothing from March. Checked in the four places the rate is
// worked out: the engine's move pools (computeMovePoolMax), the Naval helper (navalSpeedBonus), the turn report's
// per-unit move rates (buildTurnReport, which the orders form shows) and the bots' reach (botLandReach, botSeaReach);
// and no page still quotes the fast-column ladder.
// Level 1 (unit): computeMovePoolMax (src/engine/units/movement-pools.ts, plan P1-08b) and the others are called
// directly on a world the engine makes on its modules (since P1-14m; the bare vm before); the words are read from the
// built pages.
// It was tests/march-one-rate.test.js, which ran one turn on the GM portal for the anchor hook to hand
// computeMovePoolMax back; the checks are the same.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 14 (2026-10-13): March and Naval have one rate of advance, +0/+0/+1/+1/+2/+3 at levels 0–5 for every unit
// whatever its base move (the fast-column ladder is gone), and no flyer, rider or winged beast, gains from March.
// Checked in the engine's move pools (`computeMovePoolMax`), `navalSpeedBonus`, the turn report's per-unit move rates
// and the bots' reach; no page quotes the old ladder and the rulebook's Free Lances example says 7.
// `unit/march-one-rate.test.ts`: `computeMovePoolMax` called directly on the engine's modules (P1-14m; the bare `vm`
// from P1-08b; before, a code-anchor test)
import '../lib/the-whole-engine.ts';
import { afterAll, describe, expect, test } from 'vitest';
import { readPage } from '../lib/boot.ts';
import {
  aFreshTurnsContextOnTheWorld,
  botWorld,
  loadTheEngineOnItsModules,
  must,
  quietEngineLog,
} from '../lib/the-middle-of-a-bot-world-in-a-turn-on-the-engines-modules.ts';
import { pageText } from '../lib/source.ts';

const LADDER = [0, 0, 1, 1, 2, 3];
const engine = await loadTheEngineOnItsModules({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const world = botWorld(engine, 2, { cols: 10, rows: 6 }, { seaPct: 20 });
const tc = aFreshTurnsContextOnTheWorld(engine, world);
interface Pools {
  land: number;
  sea: number;
  seaActive: boolean;
  cap: string;
}
// (the engine's own modules, fresh with it)
const thePools = await import('../../src/engine/units/movement-pools.ts');
const computeMovePoolMax = thePools.computeMovePoolMax as unknown as (t: typeof tc, c: object) => Pools;
const theMovement = await import('../../src/engine/units/movement.ts');
const navalSpeedBonus = theMovement.navalSpeedBonus as unknown as (baseSpeed: number, level: number) => number;
const theBotsStrategy = await import('../../src/engine/bots/strategy.ts');
const botLandReach = theBotsStrategy.botLandReach as unknown as (c: object) => number;
const botSeaReach = theBotsStrategy.botSeaReach as unknown as (c: object) => number;
const { ARMY_SPEED_MASTER } = await import('../../src/engine/army-tables.ts');
const theTurnReport = await import('../../src/views/turn-report.ts');
const buildTurnReport = theTurnReport.buildTurnReport as unknown as (view: unknown) => {
  characters: { id: unknown; armies?: { type: string; moveRate?: unknown }[] }[];
};
const theRealmsView = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
const playerView = theRealmsView.playerView as unknown as (state: unknown, realm: number) => unknown;

// A hero with no items, titles or discoveries: his pools are his column's base move plus the ladder.
const hero = (types: string[], skills: Record<string, number>) => ({
  id: 'tst',
  name: 'Tester',
  player: null,
  alive: true,
  skills: { march: 0, naval: 0, ...skills },
  items: [],
  armies: types.map((t) => ({ type: t, quality: 'Average', unitName: 'the ' + t })),
});

test('the base moves this test relies on: Free Lances 4, Levies 2, Galleons 3, Thunderbirds 5', () => {
  const SPEED = ARMY_SPEED_MASTER;
  expect([SPEED['Free Lances'], SPEED['Shieldwall Levies'], SPEED['Galleon Fleet'], SPEED['Thunderbirds']]).toEqual([
    4, 2, 3, 5,
  ]);
});

describe.each([0, 1, 2, 3, 4, 5])('March or Naval %i', (lv) => {
  const step = LADDER[lv] ?? NaN;
  test(`Free Lances (base 4) march at ${String(4 + step)}`, () => {
    expect(computeMovePoolMax(tc, hero(['Free Lances'], { march: lv })).land).toBe(4 + step);
  });
  test(`Levies (base 2) march at ${String(2 + step)}`, () => {
    expect(computeMovePoolMax(tc, hero(['Shieldwall Levies'], { march: lv })).land).toBe(2 + step);
  });
  test(`a Galleon Fleet (base 3) sails at ${String(3 + step)}`, () => {
    expect(computeMovePoolMax(tc, hero(['Galleon Fleet'], { naval: lv })).sea).toBe(3 + step);
  });
  test(`navalSpeedBonus is +${String(step)} for fast and slow hulls alike`, () => {
    expect([navalSpeedBonus(4, lv), navalSpeedBonus(2, lv)]).toEqual([step, step]);
  });
});

test('March 5 speeds no flyer: Thunderbirds (a flying beast) and Eagle Riders stay at 5', () => {
  expect(computeMovePoolMax(tc, hero(['Thunderbirds'], { march: 5 })).land).toBe(5);
  expect(computeMovePoolMax(tc, hero(['Eagle Riders'], { march: 5 })).land).toBe(5);
});

test("the turn report (what the orders form shows): each unit's move rate at March 5", () => {
  const report = (w: string): [unknown, unknown] => {
    const S = JSON.parse(w) as {
      characters: { id: unknown; alive: boolean; player: number | null; isKing?: boolean; [k: string]: unknown }[];
    };
    const king = must(
      S.characters.find((c) => c.alive && c.player === 0 && c.isKing),
      'the king of realm 0',
    );
    (king['skills'] as Record<string, number>)['march'] = 5;
    king['items'] = [];
    king['armies'] = [
      { type: 'Free Lances', quality: 'Average', unitName: 'the Test Lances' },
      { type: 'Thunderbirds', quality: 'Average', unitName: 'the Test Wing' },
    ];
    const kr = buildTurnReport(playerView(S, 0)).characters.find((c) => c.id === king.id);
    const rate = (t: string) => (kr?.armies ?? []).find((x) => x.type === t)?.moveRate;
    return [rate('Free Lances'), rate('Thunderbirds')];
  };
  expect(report(world)).toEqual([4 + (LADDER[5] ?? NaN), 5]);
});

test('the bots plan with the same ladder', () => {
  expect(botLandReach({ armies: [{ type: 'Free Lances' }], skills: { march: 1 } }), 'Free Lances at March 1').toBe(4);
  expect(botLandReach({ armies: [{ type: 'Shieldwall Levies' }], skills: { march: 5 } }), 'Levies at March 5').toBe(5);
  expect(botSeaReach({ armies: [{ type: 'Galleon Fleet' }], skills: { naval: 1 } }), 'Galleons at Naval 1').toBe(3);
});

test('no page still quotes the fast-column ladder, and the rulebook example uses the one rate', () => {
  const rules = readPage('kingdoms-call-rules.html'),
    pp = pageText('kingdoms-call-player-portal.html'); // its words, from src/ (tests/lib/source.ts, plan P1-09a)
  expect(rules + pp).not.toMatch(
    /Fast column|Fast \(base move 3\+\)|\+1\/\+1\/\+2\/\+2\/\+2|\+0\/\+1\/\+1\/\+2\/\+2\/\+2/,
  );
  const ex = /leading base-4 Free Lances, at <strong>(\d)<\/strong>/.exec(rules);
  expect(ex?.[1], "the rulebook's March-5 Free Lances example").toBe(String(4 + (LADDER[5] ?? NaN)));
});
