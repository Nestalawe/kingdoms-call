// March and Naval have one rate of advance (2026-10-13, item 14): the old "slow column" ladder, +0/+0/+1/+1/+2/+3 at
// levels 0–5, for every unit whatever its base move. The "fast column" ladder (+0/+1/+1/+2/+2/+2) is gone. Flyers
// (every winged unit, the riders and the flying beasts) gain nothing from March. Checked in the four places the rate is
// worked out: the engine's move pools (computeMovePoolMax), the Naval helper (navalSpeedBonus), the turn report's
// per-unit move rates (buildTurnReport, which the orders form shows) and the bots' reach (botLandReach, botSeaReach);
// and no page still quotes the fast-column ladder.
// Level 1 (unit): computeMovePoolMax (src/engine/units/movement-pools.js, plan P1-08b) and the others are called
// directly on a world the engine makes in the bare vm (tests/lib/engine.ts); the words are read from the built pages.
// It was tests/march-one-rate.test.js, which ran one turn on the GM portal for the anchor hook to hand
// computeMovePoolMax back; the checks are the same.
import vm from 'node:vm';
import { afterAll, describe, expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext } from '../lib/engine.ts';

const LADDER = [0, 0, 1, 1, 2, 3];
const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const world = botWorld(engine, 2, { cols: 10, rows: 6 }, { seaPct: 20 });
const tc = turnContext(engine, world);
type Pools = { land: number; sea: number; seaActive: boolean; cap: string };
const computeMovePoolMax = engineFn(engine, 'computeMovePoolMax') as (t: typeof tc, c: object) => Pools;
const navalSpeedBonus = engineFn(engine, 'navalSpeedBonus') as (baseSpeed: number, level: number) => number;
const botLandReach = engineFn(engine, 'botLandReach') as (c: object) => number;
const botSeaReach = engineFn(engine, 'botSeaReach') as (c: object) => number;

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
  const SPEED = vm.runInContext('ARMY_SPEED_MASTER', engine) as Record<string, number>;
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
  const report = vm.runInContext(
    `(world)=>{ const S=JSON.parse(world); const king=S.characters.find(c=>c.alive&&c.player===0&&c.isKing);
      king.skills.march=5; king.items=[];
      king.armies=[{type:'Free Lances',quality:'Average',unitName:'the Test Lances'},{type:'Thunderbirds',quality:'Average',unitName:'the Test Wing'}];
      const kr=buildTurnReport(S,0).characters.find(c=>c.id===king.id);
      const rate=t=>((kr&&kr.armies||[]).find(x=>x.type===t)||{}).moveRate;
      return [rate('Free Lances'), rate('Thunderbirds')]; }`,
    engine,
  ) as (world: string) => [unknown, unknown];
  expect(report(world)).toEqual([4 + (LADDER[5] ?? NaN), 5]);
});

test('the bots plan with the same ladder', () => {
  expect(botLandReach({ armies: [{ type: 'Free Lances' }], skills: { march: 1 } }), 'Free Lances at March 1').toBe(4);
  expect(botLandReach({ armies: [{ type: 'Shieldwall Levies' }], skills: { march: 5 } }), 'Levies at March 5').toBe(5);
  expect(botSeaReach({ armies: [{ type: 'Galleon Fleet' }], skills: { naval: 1 } }), 'Galleons at Naval 1').toBe(3);
});

test('no page still quotes the fast-column ladder, and the rulebook example uses the one rate', () => {
  const rules = readPage('kingdoms-call-rules.html'),
    pp = readPage('kingdoms-call-player-portal.html');
  expect(rules + pp).not.toMatch(
    /Fast column|Fast \(base move 3\+\)|\+1\/\+1\/\+2\/\+2\/\+2|\+0\/\+1\/\+1\/\+2\/\+2\/\+2/,
  );
  const ex = /leading base-4 Free Lances, at <strong>(\d)<\/strong>/.exec(rules);
  expect(ex?.[1], "the rulebook's March-5 Free Lances example").toBe(String(4 + (LADDER[5] ?? NaN)));
});
