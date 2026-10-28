// 2026-10-14 (batch item 12) — any hero who wins a personal fight rolls for Melee experience at the
// standard rate, on top of the rolls for each blow, arrow or spell that landed. Staged with the foe
// already at 0 HP, so the hero wins without landing anything: the only Melee roll is the win's. The
// loser rolls no win roll.
// Level 1 (unit): resolvePersonalCombat called directly on the engine's modules (tests/lib/personal-combat.ts; plan P1-08e: it
// was a script that took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal); every experience
// roll is recorded by a stand-in for trySkillGain on its module.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 12: a hero who wins a personal fight (`resolvePersonalCombat`, the foe staged at 0 HP so no blow lands) rolls
// once for Melee at the standard rate; in a duel the winner rolls and the fallen loser does not (batch 2026-10-14).
// `unit/xp-fight-win.test.ts`: `resolvePersonalCombat` called directly on the engine's modules
// (`lib/personal-combat.ts`; P1-08e: it was a code-anchor test that ran a turn on the GM portal first); every roll is
// recorded by a stand-in for `trySkillGain` on its module (`vi.spyOn`), which calls the real one
import { expect, test, vi } from 'vitest';
import {
  clone,
  personalCombatEngine,
  type Character,
  type Combatant,
  type FightResult,
} from '../lib/personal-combat.ts';

const { call, MON, turnContext } = await personalCombatEngine();
const experience = await import('../../src/engine/heroes/experience-skill-rises-and-earned-hp.ts');
type Roll = { id: unknown; skill: string; base: unknown; mult: unknown };
// every experience roll, recorded as it starts by a stand-in for trySkillGain on its module (plan P1-14b; until then a
// wrapper around it in the bare vm), which calls the real one: the calls from personal combat's files reach it
const recording = (fn: () => void): Roll[] => {
  const rolls: Roll[] = [];
  const tryOne = experience.trySkillGain;
  const spy = vi
    .spyOn(experience, 'trySkillGain')
    .mockImplementation(
      (turnContext, char: { id?: unknown } | null, skill: string, base: unknown, narr, mult: unknown) => {
        rolls.push({ id: char?.id, skill, base, mult });
        tryOne(turnContext, char, skill, base, narr, mult);
      },
    );
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  return rolls;
};
const live = (turnContext.G['characters'] as Character[]).filter((c) => c.alive && c.player != null);
const hero = (c: Character) => {
  const h = call('pcCharCombatant', c) as Combatant;
  h.hp = h.maxHp = 40;
  return h;
};
const owlbear = () => {
  const m = MON.find((x) => x.name === 'Owlbear');
  if (!m) throw new Error('no Owlbear in the guardian table');
  return call('pcMonsterCombatant', { ...clone(m), _hpFull: m.hp }) as Combatant;
};
const [first, second] = live;

test('two living heroes in the world', () => {
  expect(live.length).toBeGreaterThanOrEqual(2);
});

test('the hero who wins rolls once for Melee at the standard rate', () => {
  if (!first) throw new Error('no hero');
  const A = hero(first);
  const B = owlbear();
  B.hp = 0;
  let res: FightResult | undefined;
  const rolls = recording(() => {
    res = call('resolvePersonalCombat', A, B, { maxRounds: 20 }) as FightResult;
  });
  expect(res?.winner === A, 'the hero wins (the guardian was staged at 0 HP)').toBe(true);
  const mine = rolls.filter((x) => x.id === first.id && x.skill === 'melee');
  expect(mine.length === 1 && mine[0]?.base === 0.1, JSON.stringify(mine)).toBe(true);
});

test('in a duel the winner rolls for Melee, and the fallen loser takes no win roll', () => {
  if (!first || !second) throw new Error('no two heroes');
  const A = hero(first);
  const B = hero(second);
  A.hp = 0;
  let res: FightResult | undefined;
  const rolls = recording(() => {
    res = call('resolvePersonalCombat', A, B, { maxRounds: 20 }) as FightResult;
  });
  expect(res?.winner === B, 'in a duel the second hero wins').toBe(true);
  expect(
    rolls.some((x) => x.id === second.id && x.skill === 'melee' && x.base === 0.1),
    'the winner rolls for Melee',
  ).toBe(true);
  expect(
    rolls.some((x) => x.id === first.id && x.skill === 'melee' && x.base === 0.1),
    'the fallen loser takes no win roll',
  ).toBe(false);
});
