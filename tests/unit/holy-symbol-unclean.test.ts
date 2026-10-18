// 2026-10-14 (batch item 5) — Holy Symbol bites the unclean half as hard again (×1.5, was ×2), and the
// unclean are told by their KIND, not by their name: every undead and every fiend, and nothing else.
// Before, the Dust Devil (an elemental) was doubled because its name holds "Devil", and the Chaos
// Knight (a fiend) was not. Checked on the to-hit penalty at White 5 (−40% plain, −60% unclean) for
// every guardian not weak to White Magic (a weakness doubles the effect on top).
// Level 1 (unit): pcCastCombatSpell called directly in the bare vm (tests/lib/personal-combat.ts; plan P1-08e: it was a
// script that took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal), the cast pinned to
// succeed.
import { expect, test } from 'vitest';
import { clone, personalCombatEngine, type Combatant, type Guardian } from '../lib/personal-combat.ts';

const { call, base, MON, pinned } = personalCombatEngine();
const st = () => ({ fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null });
const pen = (m: Guardian) => {
  const h = call('pcCharCombatant', {
    ...clone(base),
    items: [],
    skills: { ...base.skills, white: 5 },
    encounterPlan: { tactics: ['ME'], duelStance: 'accept' },
  }) as Combatant;
  const g = call('pcMonsterCombatant', { ...clone(m), _hpFull: m.hp }) as Combatant;
  g.status.hitPenalty = 0;
  pinned(0.01, () => call('pcCastCombatSpell', h, g, 'Holy Symbol', [], st()));
  return g.status.hitPenalty;
};
const named = (name: string) => {
  const m = MON.find((x) => x.name === name);
  if (!m) throw new Error(`no guardian named ${name}`);
  return m;
};

test('Holy Symbol at White 5: −60% to hit against undead and fiends, −40% against the rest', () => {
  const notWeak = MON.filter((m) => !(m.weak && m.weak.kind === 'school' && m.weak.key === 'white'));
  const bad: string[] = [];
  notWeak.forEach((m) => {
    const want = m.cat === 'undead' || m.cat === 'fiend' ? 60 : 40;
    const got = pen(m);
    if (got !== want) bad.push(`${m.name} (${String(m.cat)}) −${String(got)}%`);
  });
  expect(notWeak.length).toBeGreaterThan(50);
  expect(bad).toEqual([]);
});

test('the Dust Devil (an elemental) is not unclean', () => {
  expect(pen(named('Dust Devil'))).toBe(40);
});

test('the Chaos Knight (a fiend) is', () => {
  expect(pen(named('Chaos Knight'))).toBe(60);
});
