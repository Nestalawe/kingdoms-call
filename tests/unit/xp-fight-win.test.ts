// 2026-10-14 (batch item 12) — any hero who wins a personal fight rolls for Melee experience at the
// standard rate, on top of the rolls for each blow, arrow or spell that landed. Staged with the foe
// already at 0 HP, so the hero wins without landing anything: the only Melee roll is the win's. The
// loser rolls no win roll.
// Level 1 (unit): resolvePersonalCombat called directly in the bare vm (tests/lib/personal-combat.ts; plan P1-08e: it
// was a script that took it from the "  // 4. Run all 5 phases" hook after a turn on the GM portal); every experience
// roll is recorded by a wrapper around the top-level trySkillGain.
import vm from 'node:vm';
import { expect, test } from 'vitest';
import {
  clone,
  personalCombatEngine,
  type Character,
  type Combatant,
  type FightResult,
} from '../lib/personal-combat.ts';

const { engine, call, MON, turnContext } = personalCombatEngine();
type Roll = { id: unknown; skill: string; base: unknown; mult: unknown };
// every experience roll, recorded as it starts by a wrapper around the top-level trySkillGain (plan P1-08c)
vm.runInContext(
  `{ const tryOne=trySkillGain;
     trySkillGain=function(turnContext, char, skill, base, narr, mult){
       if(globalThis.__xp) globalThis.__xp.push({id:char&&char.id,skill,base,mult});
       return tryOne.apply(this, arguments); }; }`,
  engine,
);
const recording = (fn: () => void): Roll[] => {
  const rolls: Roll[] = [];
  engine['__xp'] = rolls;
  try {
    fn();
  } finally {
    engine['__xp'] = undefined;
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
