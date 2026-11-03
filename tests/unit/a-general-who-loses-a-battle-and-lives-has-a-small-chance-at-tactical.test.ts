// 2026-10-14 (batch item 11): failing still teaches a little. A general who loses a battle and lives rolls for Tactical
// at the small (frequent-action) rate, SKILLGAIN_COMMON (0.04). The battle is staged hopeless: realm 0's first hero
// (not its king; no item, 40 hit points, a plan that fights in melee and refuses every duel) at the head of one Green
// company of Levies, against a guard made by the test holding eight Elite companies of Men-at-Arms on a free plain.
// Every experience roll is recorded by a stand-in on trySkillGain (vi.spyOn on its module; the battle calls it from
// its own file), which calls the real one; the stand-in is shown reached.
// The other parts of item 11: a fizzled Cast Spell is tests/scenario/cast-spell-order-in-a-whole-turn.test.ts, a failed
// Spy or Steal tests/scenario/espionage-orders-in-a-whole-turn.test.ts, a fled fight tests/unit/xp-fled-fight.test.ts.
//
// Level 1 (unit): combatVsNPC called directly (tests/lib/a-battle-called-directly.ts) on a world the engine makes from
// KC_SEED; no turn is played. Not lower: the roll is made inside the battle, once its outcome is known.
//
// Until plan P1-14d this was tests/xp-small-chances.test.js, a turn in the engine's bare vm (seed 1 only) that searched
// the map for a province with defenders and wrapped trySkillGain there by eval; its three checks are kept, and "no page
// errors" is "throws nothing" (an unexpected console.error fails the test: setup/each.ts).
import '../lib/the-whole-engine.ts';
import { afterEach, expect, test, vi } from 'vitest';
import * as experience from '../../src/engine/heroes/experience-skill-rises-and-earned-hp.ts';
import {
  aBattleAgainstTheProvince,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  MELEE_AND_NO_DUEL,
  own,
  theTurnsContext,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

afterEach(() => {
  vi.restoreAllMocks();
});

test('a general who loses a battle and lives has a small chance at Tactical', () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const G2 = G.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
  if (!G2) throw new Error('realm 0 has no hero but its king');
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, from, 0);
  const guard = aGuardMadeByTheTest(
    G,
    field,
    Array.from({ length: 8 }, (_, i) => ({ type: 'Men-at-Arms', quality: 'Elite', unitName: `Wall ${String(i)}` })),
    { encounterPlan: MELEE_AND_NO_DUEL() },
  );
  attackFrom(G, G2, from, field);
  Object.assign(G2, { items: [], hp: 40, maxHp: 40, encounterPlan: MELEE_AND_NO_DUEL() });
  G2.armies = [{ type: 'Levies', quality: 'Green', unitName: 'the Last Hope' }];

  // every experience roll, recorded as it starts
  const rolls: { id: unknown; skill: string; base: number }[] = [];
  const tryOne = experience.trySkillGain;
  vi.spyOn(experience, 'trySkillGain').mockImplementation((...args: Parameters<typeof tryOne>) => {
    const [, char, skill, base] = args as unknown as [unknown, { id?: unknown } | null | undefined, string, number];
    rolls.push({ id: char?.id, skill, base });
    tryOne(...args);
  });

  const { text } = aBattleAgainstTheProvince(tc, G2, field, guard);
  expect(text, 'the general loses the battle').toMatch(/repelled|hold against|retreat/i);
  expect(
    G.characters.find((c) => c.id === G2.id)?.alive,
    `…and lives (his rolls: ${rolls.map((x) => `${x.skill}@${String(x.base)}`).join(', ')})`,
  ).toBe(true);
  expect(rolls.length, 'the stand-in on trySkillGain is reached').toBeGreaterThan(0);
  expect(
    rolls.some((x) => x.id === G2.id && x.skill === 'tactical' && x.base === 0.04),
    `…and has a small chance at Tactical (${rolls
      .filter((x) => x.id === G2.id)
      .map((x) => `${x.skill}@${String(x.base)}`)
      .join(', ')})`,
  ).toBe(true);
});
