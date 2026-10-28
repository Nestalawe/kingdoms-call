// 2026-10-08 (item 2) — guardian melee.
//   (A) A guardian's melee blow rolls a base that grows with its tier — Weak 1–3, Moderate 2–5,
//       Powerful 3–7, Legendary 4–9 — then adds +1 per level of its Melee (2026-10-14, Toby item 20:
//       it was ⌈Melee ÷ 2⌉, as a hero's blow still is). Heroes keep 1–3 + ⌈Melee ÷ 2⌉.
//   (B) "hero −1 melee for next round" (Grave Chill, Earthshake, Chilling Touch, Hex of Weakness,
//       Withering Touch) really lowers the hero's Melee — to-hit and damage — for the next round only.
// Level 1 (unit): the combat functions called directly on the engine's modules (tests/lib/personal-combat.ts; plan P1-08e: it
// was a scenario-level script that took them from the "  // 4. Run all 5 phases" hook after a turn on the GM portal).
// Each blow is sampled 600 times from the seeded dice, as before.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Every guardian's melee blow rolls its grade's base (Weak 1–3, Moderate 2–5, Powerful 3–7, Legendary 4–9) + its Melee
// (+1 a level since item 20, 2026-10-14; it was ⌈Melee÷2⌉), a hero's stays 1–3 + ⌈Melee÷2⌉; a "−1 melee for next round"
// special lowers the hero's Melee for exactly one round. `unit/guardian-melee.test.ts`: `pcMeleeDamage`, `pcHitSkill`,
// `pcMonsterSpecial` and `pcRoundStart` called directly on the engine's modules (`lib/personal-combat.ts`; P1-08e: it
// was a code-anchor test that ran a turn on the GM portal first)
import { expect, test } from 'vitest';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { personalCombatEngine, type Character, type Combatant } from '../lib/personal-combat.ts';

const { call, MON, turnContext, wordsOf } = await personalCombatEngine({ realms: 3, opts: { seaPct: 30 } });
const BASE: Record<string, [number, number]> = { Weak: [1, 3], Moderate: [2, 5], Powerful: [3, 7], Legendary: [4, 9] };
const dummy = () => ({ kind: 'character', name: 'Dummy', hp: 999, maxHp: 999, status: {}, temper: 'None' });
const blow = (c: Combatant) => call('pcMeleeDamage', c, dummy()) as number;

// (A) Sample every guardian's blow and compare the observed range with the rule.
test('the guardian table was read', () => {
  expect(MON.length).toBeGreaterThan(50);
});

test("every guardian's blow rolls its tier's base + its Melee", () => {
  let checked = 0;
  const bad: string[] = [];
  MON.forEach((m) => {
    const g = call('pcMonsterCombatant', { ...m, _hpFull: m.hp }) as Combatant;
    if (g['dmgBonus'] || g['gauntlets']) return; // a flat bonus on top: checked by its own passive
    const [lo, hi] = BASE[m.power] ?? [NaN, NaN];
    const sk = m.melee || 1; // +1 a Melee level (item 20, 2026-10-14)
    let mn = 1e9;
    let mx = -1;
    for (let i = 0; i < 600; i++) {
      const v = blow(g);
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
    }
    checked++;
    if (mn !== lo + sk || mx !== hi + sk)
      bad.push(
        `${m.name} (${m.power}, Melee ${String(m.melee)}): ${String(mn)}–${String(mx)}, expected ${String(lo + sk)}–${String(hi + sk)}`,
      );
  });
  expect(checked, 'most guardians checked').toBeGreaterThan(40);
  expect(bad).toEqual([]);
});

test('all four tiers were sampled', () => {
  const tiers = new Set(
    MON.filter((m) => !(call('pcMonsterCombatant', { ...m }) as Combatant)['dmgBonus']).map((m) => m.power),
  );
  expect(['Weak', 'Moderate', 'Powerful', 'Legendary'].every((t) => tiers.has(t as never))).toBe(true);
});

// A hero still rolls 1–3 + ⌈Melee÷2⌉.
const characters = turnContext.G['characters'] as Character[];
const ch = characters.find((c) => c.alive && !c.isKing) ?? characters.find((c) => c.alive);
if (!ch) throw new Error('the world has no living character');
const hero = call('pcCharCombatant', ch) as Combatant;
hero['temper'] = 'None';
hero.hp = hero.maxHp = 999;
hero['melee'] = 4;
hero['meleeRaw'] = 4; // a known, lowerable Melee
const maxDmg = () => {
  let mx = -1;
  for (let i = 0; i < 400; i++) mx = Math.max(mx, blow(hero));
  return mx;
};

test("a hero's blow is still 1–3 + ⌈Melee÷2⌉", () => {
  const hsk = Math.ceil(Number(hero['meleeRaw'] ?? hero['melee']) / 2);
  let hmn = 1e9;
  let hmx = -1;
  for (let i = 0; i < 600; i++) {
    const v = blow(hero);
    hmn = Math.min(hmn, v);
    hmx = Math.max(hmx, v);
  }
  const gb = (ch.items as { name?: string }[]).some((it) => /Warbringer/.test(it.name ?? '')) ? 2 : 0;
  expect([hmn, hmx]).toEqual([1 + hsk + gb, 3 + hsk + gb]);
});

// (B) Grave Chill: −1 Melee for the next round, and only that round.
test('Grave Chill: −1 Melee for the next round, and only that round', () => {
  const wight = MON.find((m) => m.name === 'Barrow Wight');
  const chill = (wight?.spells ?? []).find((s) => /-1 melee/i.test(s.effect ?? ''));
  expect(chill, 'Barrow Wight has a "-1 melee" special').toBeTruthy();
  if (!wight) return;
  const g = call('pcMonsterCombatant', { ...wight, _hpFull: wight.hp }) as Combatant;
  const before = call('pcHitSkill', hero, 'melee') as number;
  const dmgBefore = maxDmg();
  const narr: NarrativeLine[] = [];
  call('pcMonsterSpecial', g, hero, chill, narr, { range: 'melee' });
  call('pcRoundStart', hero, narr); // the next round: the chill bites
  const during = call('pcHitSkill', hero, 'melee') as number;
  const dmgDuring = maxDmg();
  expect(before, 'the hero has a Melee to lower').toBeGreaterThan(0);
  expect(during, `the next round the hero fights at Melee ${String(before - 1)} for to-hit`).toBe(before - 1);
  expect(dmgDuring, 'and their blows are rolled from the lowered Melee').toBe(
    before % 2 === 0 ? dmgBefore : dmgBefore - 1,
  );
  call('pcRoundStart', hero, narr); // the round after: gone
  expect(call('pcHitSkill', hero, 'melee'), `the round after, Melee is back to ${String(before)}`).toBe(before);
  expect(
    wordsOf(narr).some((l) => /Melee/.test(l)),
    'the battle report mentions the chill',
  ).toBe(true);
});
