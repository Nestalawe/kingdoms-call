// 2026-10-15 (Toby, D6; R-114) — the rulebooks may hint that mastery holds more (R-005 keeps the perks secret), but
// they never name a level 6–9 perk, order or spell outright. A player's review found a few named: the Explorer's
// lair-spotting, Shimmer, a Trueshot wound, Grand Stratagem and Grand Heist. The two vague hints (Explorer finds that
// raise a province's tax; deep Druid mastery cutting the cost of beasts) stay.
//
// Level 0 (static): both rulebooks as built (site/), and the names in MASTERY_UNLOCKS from the data file's module,
// imported with the whole engine loaded (tests/lib/the-whole-engine.ts); nothing runs. Until plan P1-14b this was
// tests/mastery-hints-words.test.js, which read the table in the engine's bare vm.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { MASTERY_UNLOCKS } from '../../src/content/kingdoms-call-data.ts';
import { readPage } from '../lib/boot.js';

// a perk's name: "New order — Forced March: …", "New spell — Sanctuary: …" or "Shimmer — enemy players …"
const names = new Set<string>();
for (const v of Object.values(MASTERY_UNLOCKS as Record<string, Record<string, string>>))
  for (const t of Object.values(v)) {
    const m = /New (?:order|spell)[^—]*— ([^:(]+)/.exec(t) ?? /^([A-Z][A-Za-z' ]+) — /.exec(t);
    if (m) names.add((m[1] ?? '').trim());
  }
const COMMON = new Set(['Veil']); // an ordinary verb in the books ("Veil every lair…"), not the perk
const strip = (text: string) => {
  let t = text;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u;
    t = u;
  }
};

test("the mastery perks' names were read", () => {
  expect(names.size > 30, `the mastery perks' names were read (${String(names.size)})`).toBe(true);
});

test.for([
  ['kingdoms-call-rules.html', 'the rulebook'],
  ['kingdoms-call-rules-intro.html', 'the intro'],
] as const)('%s names no mastery perk', ([f, label]) => {
  const T = strip(readPage(f)).replace(/\s+/g, ' ');
  const named = [...names].filter(
    (n) => !COMMON.has(n) && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(T),
  );
  expect(named.length === 0, `${label} names no mastery perk (named: ${named.join(', ') || 'none'})`).toBe(true);
  expect(!T.includes('auto-spotting lairs'), `${label} does not give away the Explorer's lair-spotting`).toBe(true);
});

test('the two vague hints stay', () => {
  const R = strip(readPage('kingdoms-call-rules.html')).replace(/\s+/g, ' ');
  expect(
    R.includes("Explorer finds can permanently raise a province's tax base"),
    'the vague hint at Explorer finds stays',
  ).toBe(true);
  expect(
    R.includes('deep Druid mastery can bring the cost of Creature and Monster units down sharply'),
    'the vague hint at Druid mastery stays',
  ).toBe(true);
});
