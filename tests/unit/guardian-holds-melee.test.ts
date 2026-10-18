// 2026-10-14 (batch item 2) — a guardian with a bow no longer tries to back out of a melee to shoot.
// Its plan still carries Fire actions; once the fight is at sword's length a Fire action is simply a
// blow (no break-away roll, so no round lost to a failed one). At bow range it still shoots, and a
// hero who chooses Fire in a melee still tries to break away, as before.
// Level 1 (unit): pcAct called directly in the bare vm (tests/lib/personal-combat.ts; plan P1-08e: it was a script that
// took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal), the dice pinned.
import { expect, test } from 'vitest';
import { clone, personalCombatEngine, type Combatant, type Guardian } from '../lib/personal-combat.ts';

const { call, base, MON, pinned } = personalCombatEngine();
const st = (range: string) => ({ fledBy: null, parley: false, stoleBy: null, range, mirror: null, feature: null });
const hero = (t: string[]) => {
  const h = call('pcCharCombatant', {
    ...clone(base),
    items: [],
    skills: { ...base.skills, melee: 3, archery: 3 },
    encounterPlan: { tactics: t, duelStance: 'accept' },
  }) as Combatant;
  h.hp = h.maxHp = 40;
  return h;
};
const guardian = (m: Guardian) => call('pcMonsterCombatant', { ...clone(m), _hpFull: m.hp }) as Combatant;
const archers = MON.filter((m) => (m.archery ?? 0) > 0);
const act = (a: Combatant, f: Combatant, range: string, r: number) => {
  const n: string[] = [];
  const s = st(range);
  pinned(r, () => call('pcAct', a, f, n, s));
  return { t: n.join('\n'), s };
};

test('guardians with a bow found', () => {
  expect(archers.length).toBeGreaterThan(5);
});

test('every guardian with a bow strikes in melee instead of breaking away', () => {
  const broke: string[] = [];
  archers.forEach((m) => {
    const g = guardian(m);
    g.tactics = ['FI'];
    g.tacIdx = 0;
    const { t, s } = act(g, hero(['ME']), 'melee', 0.99);
    if (!(/attacks \(/.test(t) && !/break away/.test(t) && s.range === 'melee'))
      broke.push(`${m.name}: ${t.split('\n')[0] ?? ''}`);
  });
  expect(broke).toEqual([]);
});

test('at bow range a guardian with a bow still shoots', () => {
  const m = archers[0];
  if (!m) throw new Error('no guardian with a bow');
  const g = guardian(m);
  g.tactics = ['FI'];
  g.tacIdx = 0;
  expect(act(g, hero(['ME']), 'bow', 0.5).t, m.name).toMatch(/shoots \(/);
});

test('a hero who chooses Fire in a melee still tries to break away', () => {
  const m = MON.find((x) => !((x.archery ?? 0) > 0));
  if (!m) throw new Error('no guardian without a bow');
  expect(act(hero(['FI']), guardian(m), 'melee', 0.99).t).toMatch(/break away/);
});
