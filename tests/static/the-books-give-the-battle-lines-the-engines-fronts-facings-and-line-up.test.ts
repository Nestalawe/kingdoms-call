// 2026-10-11 (Toby, battle lines I: rows and columns) — the front the ground allows is written in three places: the
// engine's BATTLE_FRONT_RANGE table and the two rulebooks. In every rulebook sentence about the front, each width
// claimed for a terrain must be that terrain's range in the engine's table ("6–8 on plains or desert"), every terrain
// must be claimed somewhere, and the old fixed-width wording (6 / 4 / 3, "four lines", flyers "always ... from the
// front") must be gone. Battle lines II: every facing multiplier in BATTLE_FACING must appear in the rulebook's "Who
// faces whom" step. Battle lines III: both rulebooks say the better-explored side lines up second. A rule written
// twice must change twice (docs/traps.md).
//
// Level 0 (static): the rulebooks as built (site/), and the engine's tables from their module (src/engine/battle/
// lines.ts), imported with the whole engine loaded (tests/lib/the-whole-engine.ts); nothing runs. Until plan P1-14b
// this was tests/battle-lines-words.test.js, which read the tables in the engine's bare vm.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { BATTLE_FACING, BATTLE_FRONT_RANGE } from '../../src/engine/battle/lines.ts';
import { readPage } from '../lib/boot.js';

const RANGE = BATTLE_FRONT_RANGE as Record<string, number[] | undefined>;
const TERRAINS = ['plain', 'desert', 'forest', 'jungle', 'mountain', 'sea'];
const want = (t: string) => {
  const r = RANGE[t];
  return r ? `${String(r[0])}–${String(r[1])}` : null;
};

// Width claims: "6–8 on plains or desert", "4–6 in forest or jungle", "2–4 in mountains", "8–10 at sea", read only
// from sentences that speak of the front. The look-behind keeps "×1.15 in forest" out of it.
const TERR: Record<string, string> = {
  plains: 'plain',
  plain: 'plain',
  desert: 'desert',
  forest: 'forest',
  jungle: 'jungle',
  mountains: 'mountain',
  mountain: 'mountain',
  sea: 'sea',
};
const WORD = '(?:plains?|desert|forest|jungle|mountains?|sea)';
const CLAIM = new RegExp(
  `(?<![\\d.×x+−-])(\\d+(?:–\\d+)?) (?:units? )?(?:on|in|at) ((?:(?:the )?${WORD}(?:, | or |, or )?)+)`,
  'g',
);
const strip = (h: string) => {
  let out = h,
    prev;
  do {
    prev = out;
    out = out.replace(/<[^>]+>/g, '');
  } while (out !== prev);
  return out.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
};
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter((s) => /\bfront\b/i.test(s));

test('the GM portal declares BATTLE_FRONT_RANGE, with a low–high range for every terrain', () => {
  expect(BATTLE_FRONT_RANGE, 'the GM portal declares BATTLE_FRONT_RANGE').toBeTypeOf('object');
  expect(BATTLE_FRONT_RANGE, 'the GM portal declares BATTLE_FRONT_RANGE').not.toBeNull();
  expect(
    TERRAINS.every((t) => {
      const r = RANGE[t];
      return Array.isArray(r) && r.length === 2 && (r[0] ?? 0) <= (r[1] ?? 0);
    }),
    'the table gives every terrain a low–high range',
  ).toBe(true);
});

test.for([
  ['rulebook', 'kingdoms-call-rules.html'],
  ['intro', 'kingdoms-call-rules-intro.html'],
] as const)('the %s claims for every terrain the front the engine allows, and no old wording', ([name, file]) => {
  const text = strip(readPage(file));
  const claims: { width: string; terrains: string[] }[] = [];
  for (const s of sentences(text))
    for (const c of s.matchAll(CLAIM))
      claims.push({
        width: c[1] ?? '',
        terrains: [...(c[2] ?? '').matchAll(new RegExp(WORD, 'g'))].map((x) => TERR[x[0]] ?? ''),
      });
  const seen = new Set<string>(),
    wrong = new Set<string>();
  for (const c of claims)
    for (const t of c.terrains) {
      seen.add(t);
      if (want(t) && c.width !== want(t)) wrong.add(`${c.width} for ${t} (engine: ${String(want(t))})`);
    }
  expect(claims.length > 0, `the ${name} says what front the ground allows`).toBe(true);
  expect(
    wrong.size === 0,
    `every width the ${name} claims is the engine's range` + (wrong.size ? ' — not: ' + [...wrong].join('; ') : ''),
  ).toBe(true);
  const missing = TERRAINS.filter((t) => !seen.has(t));
  expect(
    missing.length === 0,
    `the ${name} names a front for every terrain` + (missing.length ? ' — missing: ' + missing.join(', ') : ''),
  ).toBe(true);
  const old =
    /four lines|always fight from the front|never take a line slot|rear-line reduction|always take the front line|front line, terrain-proof/.exec(
      text,
    );
  expect(!old, `the ${name} has dropped the old fixed-width wording` + (old ? ` — still says "${old[0]}"` : '')).toBe(
    true,
  );
});

const rules = readPage('kingdoms-call-rules.html');

test('the rulebook\'s "How a battle is fought" has its "The battle lines" step', () => {
  expect(rules.includes('<li><strong>The battle lines.</strong>')).toBe(true);
});

// Battle lines II: the facing multipliers are written in the engine's BATTLE_FACING and in the rulebook's "Who faces
// whom" step; every multiplier must appear there as ×n.
test('every facing multiplier in BATTLE_FACING appears in the rulebook\'s "Who faces whom" step', () => {
  const FACING = BATTLE_FACING;
  expect(FACING, 'the GM portal declares BATTLE_FACING').toBeTypeOf('object');
  expect(FACING, 'the GM portal declares BATTLE_FACING').not.toBeNull();
  const stepAt = rules.indexOf('<li><strong>Who faces whom.</strong>'),
    step = stepAt < 0 ? '' : rules.slice(stepAt, rules.indexOf('</li>', stepAt));
  expect(stepAt >= 0, 'the rulebook\'s "How a battle is fought" has its "Who faces whom" step').toBe(true);
  const nums: unknown[] = [
    FACING.front.cav.arc,
    FACING.front.cav.foot,
    FACING.front.foot.cav,
    FACING.front.foot.arc,
    FACING.back.foot,
    FACING.back.cav,
    FACING.wrap,
    FACING.sideHit,
    FACING.freeFlank,
    FACING.turned,
  ];
  const missing = [...new Set(nums)].filter((n) => !step.includes('×' + String(n)));
  expect(
    nums.every((n) => typeof n === 'number') && missing.length === 0,
    'every facing multiplier appears in that step' +
      (missing.length ? ' — missing: ' + missing.map((n) => '×' + String(n)).join(', ') : ''),
  ).toBe(true);
});

test('the intro says each unit fights the enemy opposite it', () => {
  expect(/\bopposite\b/.test(strip(readPage('kingdoms-call-rules-intro.html')))).toBe(true);
});

// Battle lines III: both rulebooks say the better-explored side lines up second, and the comprehensive one's "The
// line-up" step ties the swaps to Tactical.
test('both rulebooks say the better-explored side lines up second (one swap per level of Tactical)', () => {
  const lineAt = rules.indexOf('<li><strong>The line-up.</strong>'),
    lineStep = lineAt < 0 ? '' : rules.slice(lineAt, rules.indexOf('</li>', lineAt));
  expect(
    lineAt >= 0 && lineStep.includes('lines up second') && lineStep.includes('Tactical'),
    'the rulebook\'s "How a battle is fought" has its "The line-up" step (lines up second; one swap per level of Tactical)',
  ).toBe(true);
  expect(
    strip(readPage('kingdoms-call-rules-intro.html')).includes('lines up second'),
    'the intro says the better-explored side lines up second',
  ).toBe(true);
});
