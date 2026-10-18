// 2026-10-14 (batch item 11) — failing still teaches a little: a hero who loses a personal fight and lives (beaten and
// spared, or fled) rolls for Melee at the small (frequent-action) rate; the one left standing takes no small roll.
// The other parts of item 11 (a failed Spy, Steal or Cast Spell, a lost battle) are tests/xp-small-chances.test.js.
// Level 1 (unit): resolvePersonalCombat called directly in the bare vm (tests/lib/personal-combat.ts), with the
// flight made certain; every experience roll is recorded by a wrapper around the top-level trySkillGain. Plan P1-08e:
// this was xp-small-chances' last part, which took the function from the "  // 4. Run all 5 phases" hook after a turn
// on the GM portal.
import vm from 'node:vm';
import { expect, test } from 'vitest';
import { personalCombatEngine, type Character, type Combatant, type FightResult } from '../lib/personal-combat.ts';

const { engine, call, pinned, turnContext } = personalCombatEngine();
type Roll = { id: unknown; skill: string; base: unknown; mult: unknown };
// every experience roll, recorded as it starts by a wrapper around the top-level trySkillGain (plan P1-08c)
vm.runInContext(
  `{ const tryOne=trySkillGain;
     trySkillGain=function(turnContext, char, skill, base, narr, mult){
       if(globalThis.__xp) globalThis.__xp.push({id:char&&char.id,skill,base,mult});
       return tryOne.apply(this, arguments); }; }`,
  engine,
);
const [stays, runs] = (turnContext.G['characters'] as Character[]).filter((c) => c.alive && c.player != null);
const mk = (c: Character, t: string[]) => {
  const h = call('pcCharCombatant', {
    ...c,
    encounterPlan: { tactics: t, duelStance: 'accept' },
    temper: 'Cowardly',
  }) as Combatant;
  h.hp = h.maxHp = 40;
  return h;
};

test('a hero who flees a fight has a small chance at Melee; the one left standing takes no small roll', () => {
  if (!stays || !runs) throw new Error('no two heroes');
  const A = mk(stays, ['ME', 'ME', 'ME']);
  const R = mk(runs, ['FL', 'FL', 'FL']);
  const rolls: Roll[] = [];
  engine['__xp'] = rolls;
  let res: FightResult;
  try {
    res = pinned(0.01, () => call('resolvePersonalCombat', A, R, { maxRounds: 3 }) as FightResult);
  } finally {
    engine['__xp'] = undefined;
  }
  expect(res.fledBy === R, 'the runner flees the fight').toBe(true);
  expect(
    rolls.some((x) => x.id === runs.id && x.skill === 'melee' && x.base === 0.04),
    '…and has a small chance at Melee',
  ).toBe(true);
  expect(
    rolls.some((x) => x.id === stays.id && x.skill === 'melee' && x.base === 0.04),
    'the one left standing takes no small roll',
  ).toBe(false);
});
