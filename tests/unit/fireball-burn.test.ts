// 2026-10-14 (batch item 6) — Fireball burns 10% of the target's maximum HP a round plus 2% a level of
// Elemental (counted to 5: 12% at Elemental 1, 20% at 5), for three rounds; it was 3% + 1% a level.
// A guardian's spell resistance now cuts the burn as it cuts any spell's harm (a 40% ward: 20% → 12%);
// a weakness to Elemental doubles it, as before.
// Level 1 (unit): pcCastCombatSpell called directly in the bare vm (tests/lib/personal-combat.ts; plan P1-08e: it was a
// script that took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal), the cast pinned to
// succeed.
import { expect, test } from 'vitest';
import { clone, personalCombatEngine, type Combatant } from '../lib/personal-combat.ts';

const { call, base, MON, pinned } = personalCombatEngine();
const st = () => ({ fledBy: null, parley: false, stoleBy: null, range: 'melee', mirror: null, feature: null });
const plainM = MON.find((m) => m.name === 'Owlbear');
if (!plainM) throw new Error('no Owlbear in the guardian table');
const burn = (lvl: number, setup?: (g: Combatant) => void): [number, number] => {
  const h = call('pcCharCombatant', {
    ...clone(base),
    items: [],
    skills: { ...base.skills, elemental: lvl },
    encounterPlan: { tactics: ['ME'], duelStance: 'accept' },
  }) as Combatant;
  const g = call('pcMonsterCombatant', { ...clone(plainM), _hpFull: plainM.hp }) as Combatant;
  g.arm = null;
  g.weak = null;
  g.hp = g.maxHp = 100;
  if (setup) setup(g);
  pinned(0.01, () => call('pcCastCombatSpell', h, g, 'Fireball', [], st()));
  const d = (g.status.dot ?? []).find((x) => /Fireball/.test(x.label ?? ''));
  return d ? [d.dmg, d.rounds] : [0, 0];
};

test.for([
  [1, 12],
  [3, 16],
  [5, 20],
  [7, 20],
])('Elemental %i: a 100 HP guardian burns %i a round for 3 rounds', ([lvl, pct]) => {
  expect(burn(lvl ?? 0)).toEqual([pct, 3]);
});

test('a 40% spell ward cuts the Elemental 5 burn from 20 to 12', () => {
  const [d] = burn(5, (g) => {
    g.arm = call('pcArmourMerge', null, { ward: 'spellPct', pct: 40 }, 'Nightmare Veil') as Combatant['arm'];
  });
  expect(d).toBe(12);
});

test('a guardian weak to Elemental burns twice as hard', () => {
  const [d] = burn(5, (g) => {
    g.weak = { kind: 'school', key: 'elemental', name: 'Test', desc: 'test' };
  });
  expect(d).toBe(40);
});
