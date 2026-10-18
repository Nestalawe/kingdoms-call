// 2026-10-14 (item 20) — an arrow does 1–3 damage plus ⌈Archery ÷ 2⌉ (the base was 2–5), for a hero
// and a guardian alike. The dice are pinned (lowest, then highest), so the test reads the exact range.
// The rulebook (twice) and the Archery hover text say 1–3.
// Level 1 (unit): pcArrowDamage called directly in the bare vm (tests/lib/personal-combat.ts; plan P1-08e: it was a
// script that took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal). The pages are read as
// built.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { clone, personalCombatEngine, type Combatant } from '../lib/personal-combat.ts';

const { call, base, MON, pinned } = personalCombatEngine();
const range = (c: Combatant) => [
  pinned(0, () => call('pcArrowDamage', c)),
  pinned(0.999999, () => call('pcArrowDamage', c)),
];

test.for([0, 1, 3, 5, 8])('a hero with Archery %i: an arrow does 1–3 + ⌈Archery÷2⌉', (arch) => {
  const h = call('pcCharCombatant', {
    ...clone(base),
    items: [],
    skills: { ...base.skills, archery: arch },
  }) as Combatant;
  const sk = Math.ceil(arch / 2);
  expect(range(h)).toEqual([1 + sk, 3 + sk]);
});

test("a guardian's arrow is 1–3 + ⌈Archery÷2⌉ too", () => {
  const archers = MON.filter((m) => (m.archery ?? 0) > 0);
  expect(archers.length, 'some guardians shoot').toBeGreaterThan(0);
  const bad: string[] = [];
  archers.forEach((m) => {
    const g = call('pcMonsterCombatant', { ...m, _hpFull: m.hp }) as Combatant;
    const raw = g['archeryRaw'] ?? g['archery'] ?? 0;
    const sk = Math.ceil(Number(raw) / 2);
    const [lo, hi] = range(g);
    if (lo !== 1 + sk || hi !== 3 + sk) bad.push(`${m.name}: ${String(lo)}–${String(hi)}`);
  });
  expect(bad).toEqual([]);
});

test('the rulebook says 1–3 in both places', () => {
  const rules = readPage('kingdoms-call-rules.html');
  expect(rules).toMatch(/Arrow damage: 1–3 plus ⌈your raw Archery ÷ 2⌉/);
  expect(rules).toMatch(/<strong>Arrows<\/strong> do 1–3 plus half the archer's Archery level/);
});

test('the Archery hover text says 1–3', () => {
  const pp = readPage('kingdoms-call-player-portal.html');
  expect(pp).toMatch(/for 1–3 damage plus half your Archery/);
  expect(pp).not.toMatch(/2–5 damage plus half your Archery/);
});
