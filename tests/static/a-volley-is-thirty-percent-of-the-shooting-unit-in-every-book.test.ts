// 2026-10-11 (Toby, volleys at 30%; R-092) — the volley's size is written three times: MISSILE_SHOT_PCT in the engine,
// the rulebook's Archery text and the player portal's archery blurb. (The shot itself is checked by volley-thirty, a
// scenario.) A rule written twice must change twice (docs/traps.md).
// 2026-10-12 (the wrap-up batch): the rulebook's worked example follows the constants — a shot is round(strength ×
// MISSILE_SHOT_PCT × (1 + MISSILE_ARCH_PER_LVL × Archery)), minimum 1 (missileShotDamage): Average Longbows (8) do 2,
// Elite (20) do 6, or 9 at Archery 5 — and the engine comment beside the cap gives the cap's own figure
// (MISSILE_CAP_FRACTION, doubled for a winged rider), not the figure it had before the cap was raised.
//
// Level 0 (static): the rulebook as built (site/); the constants from their module, imported with the whole engine
// loaded (tests/lib/the-whole-engine.ts); the engine's comments from src/ and the player portal's strings by their
// syntax tree (tests/lib/source.ts); nothing runs. Until plan P1-14b this was tests/volley-thirty-words.test.js, which
// read the constants in the engine's bare vm.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import {
  MISSILE_ARCH_PER_LVL,
  MISSILE_CAP_FRACTION,
  MISSILE_SHOT_PCT,
} from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { readPage } from '../lib/boot.js';
import { pageSource, pageText } from '../lib/source.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

/** A constant of the engine, or NaN when it isn't a number. */
const value = (n: unknown) => (typeof n === 'number' ? n : NaN);
const rules = readPage('kingdoms-call-rules.html');
const pct = value(MISSILE_SHOT_PCT);
const word = `${String(Math.round(pct * 100))}% of the shooting unit`;

test(
  'the volley is 30% of the shooting unit in the engine, its comment, the rulebook and the player portal',
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    const gm = pageSource('kingdoms-call-gm-portal.html'),
      pp = pageText('kingdoms-call-player-portal.html');
    expect(!Number.isNaN(value(MISSILE_SHOT_PCT)), 'the GM portal declares MISSILE_SHOT_PCT').toBe(true);
    expect(pct === 0.3, `MISSILE_SHOT_PCT is 0.30 (got ${String(pct)})`).toBe(true);
    expect(
      gm.includes('SHOOTER, not the target: 30% of the firing unit'),
      'the engine comment beside the constant says 30%',
    ).toBe(true);
    expect(
      rules.includes(word) && !rules.includes('20% of the shooting unit'),
      `the rulebook's Archery text says "${word}" and no longer 20%`,
    ).toBe(true);
    expect(
      pp.includes(word) && !pp.includes('20% of the shooting unit'),
      `the player portal's archery blurb says "${word}" and no longer 20%`,
    ).toBe(true);
  },
);

test(
  "the rulebook's worked example and the cap's comment follow the constants",
  timeLimitForTheWork({ everyFileReads: 1 }),
  () => {
    const gm = pageSource('kingdoms-call-gm-portal.html');
    const per = value(MISSILE_ARCH_PER_LVL),
      capPct = Math.round(value(MISSILE_CAP_FRACTION) * 100);
    expect(
      !Number.isNaN(per) && !Number.isNaN(capPct),
      'the GM portal declares MISSILE_ARCH_PER_LVL and MISSILE_CAP_FRACTION',
    ).toBe(true);
    const shot = (s: number, arch: number) => Math.max(1, Math.round(s * pct * (1 + per * arch)));
    const example = `Average Yeoman Longbows (strength 8) do ${String(shot(8, 0))}; Elite Longbows (20) do ${String(shot(20, 0))}, or ${String(shot(20, 5))} at Archery 5.`;
    expect(rules.includes(example), `the rulebook's worked example follows the constants: "${example}"`).toBe(true);
    // the comment wraps between "own" and "base"
    expect(
      new RegExp(
        `What a TARGET can lose is capped: ${String(capPct)}% of its own[\\s/]+base strength \\(${String(capPct * 2)}% for a winged rider`,
      ).test(gm),
      `the engine comment beside the cap says ${String(capPct)}% (${String(capPct * 2)}% for a winged rider)`,
    ).toBe(true);
  },
);
