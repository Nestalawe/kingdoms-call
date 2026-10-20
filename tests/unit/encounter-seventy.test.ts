// 2026-10-13 (item 11): Encounter Character corners its quarry at 70% base (was 50%), +5% per level of the hunter's
// Spy, −5% per level of the quarry's, clamped 5–100%; a quarry of one's own realm is always met. The rulebook (twice)
// and the order form's hint say the same.
// Level 1 (unit): pursuitCatchChance (src/engine/heroes/pursuits-and-the-catch-roll.ts, plan P1-08i3) is called
// directly in the bare vm (tests/lib/engine.ts); the words are read from the built pages. It was
// tests/encounter-seventy.test.js, which ran one turn on the GM portal for the "  // 4. Run all 5 phases" hook to hand
// pursuitCatchChance back; the checks are the same.
import { afterAll, expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';
import { pageText } from '../lib/source.ts';

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const tc = turnContext(engine, botWorld(engine, 2, { cols: 10, rows: 6 }, { seaPct: 20 }));
const pursuitCatchChance = engineFn(engine, 'pursuitCatchChance') as (t: TurnContext, c: object, q: object) => number;
const ch = (player: number, spy: number) => ({
  id: 'x' + String(player) + String(spy),
  name: 'X',
  player,
  skills: { spy },
  items: [],
});
const cc = (h: number, q: number) => pursuitCatchChance(tc, ch(0, h), ch(1, q));

test('70% base, +5% per level of the hunter’s Spy, −5% per level of the quarry’s', () => {
  expect(cc(0, 0), 'Spy 0 against Spy 0').toBe(70);
  expect(cc(2, 0), 'Spy 2 against Spy 0').toBe(80);
  expect(cc(0, 3), 'Spy 0 against Spy 3').toBe(55);
  expect(cc(5, 0), 'Spy 5 against Spy 0').toBe(95);
});

test('a quarry of one’s own realm is always met', () => {
  expect(pursuitCatchChance(tc, ch(0, 0), ch(0, 5))).toBe(100);
});

test('the rulebook says 70% both times it states the chance, and the Encounter Character hint states it', () => {
  const rules = readPage('kingdoms-call-rules.html');
  const pp = pageText('kingdoms-call-player-portal.html'); // its words, from src/ (tests/lib/source.ts, plan P1-09a)
  const said = rules.match(/<strong>(\d+)%, \+5% per level of your Spy, −5% per level of theirs<\/strong>/g) ?? [];
  expect(said.length).toBe(2);
  expect(said.every((x) => />70%/.test(x))).toBe(true);
  expect(pp).toMatch(/corner them each phase[^<]*70%, \+5% per level of your Spy, −5% per level of theirs/);
});
