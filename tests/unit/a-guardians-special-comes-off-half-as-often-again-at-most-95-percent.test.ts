// 2026-10-14 (batch item 4): a guardian's special comes off half as often again. Every special's chance is ×1.5 the
// old figure, rounded, and never above 95%. Pinned on a spread of the old table (35 → 53, 45 → 68, 50 → 75, 60 → 90,
// 65 and 70 → 95), so the whole table is checked too: no special below 53% or above 95%. Running games take the new
// odds at their next turn (GUARDIAN_TABLE_VER, migrateLairGuardiansV2): that check is on the booted GM page,
// tests/page/the-gm-page-gives-a-running-games-guardian-the-new-special-odds-at-its-next-turn.test.ts, which says why.
//
// Level 1 (unit): the guardians' table (MONSTERS_P) is plain values on the engine's modules (tests/lib/the-whole-engine.ts
// first); nothing needs a page or a turn. Until plan P1-14z this was
// tests/guardian-special-odds.test.js, which booted the GM page to read the table.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { MONSTERS_P } from '../../src/content/kingdoms-call-data.ts';

/** A guardian's special, by the guardian's name and the special's: its chance, or null if there is none. */
const chanceOf = (guardian: string, special: string): number | null => {
  const m = MONSTERS_P.find((x) => x.name === guardian);
  const s = m?.spells.find((y) => y.name === special);
  return s ? s.castChance : null;
};

test('the guardian table was read', () => {
  expect(MONSTERS_P.length).toBeGreaterThan(100);
});

test.each([
  ['Crag Harpy', 'Talon Rake', 53],
  ['Goblin Skirmisher', 'Dirty Trick', 68],
  ['Dire Wolf', 'Lunging Bite', 75],
  ['Dire Rat', 'Plague Bite', 90],
  ['Elder Dragon', 'Fire Breath', 95],
  ['Bandit King', 'Battle Cry', 95],
  ['Rock Giant', 'Tremor Stomp', 60],
  ['Lich Sovereign', 'Paralyse', 83],
] as const)("%s's %s comes off %i% of the time", (guardian, special, want) => {
  expect(chanceOf(guardian, special)).toBe(want);
});

test('every special is 53–95%', () => {
  const out = MONSTERS_P.flatMap((m) => m.spells.map((s) => [m.name, s] as const)).filter(
    ([, s]) => !(s.castChance >= 53 && s.castChance <= 95),
  );
  expect(out.map(([n, s]) => `${n} ${s.name} ${String(s.castChance)}`)).toEqual([]);
});
