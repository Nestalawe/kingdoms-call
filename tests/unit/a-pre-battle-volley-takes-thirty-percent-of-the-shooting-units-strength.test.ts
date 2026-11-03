// 2026-10-11 (Toby, volleys at 30%; R-092): a pre-battle shot does 30% of the shooting unit's base strength. One Elite
// Yeoman Longbow company (base 4 × 5 = 20) under a hero with no Archery attacks a guard holding one Elite Dwarven Guard
// (base 30, so the 40% cap of 12 is not reached): the report's shot takes 6 (it took 4 at 20%). The guard has no
// archers, no skill and no item, so nothing fires back and no spell is cast, and the one target makes the volley the
// rule's whatever the dice do. The words of the rule in every book are
// tests/static/a-volley-is-thirty-percent-of-the-shooting-unit-in-every-book.test.ts.
//
// Level 1 (unit): combatVsNPC called directly (tests/lib/a-battle-called-directly.ts) on a world the engine makes from
// KC_SEED, a guard made by the test on a free plain; no turn is played. Not lower: the shot is made inside the battle,
// from the companies on the field (missileShotDamage is the battle's own).
//
// Until plan P1-14d this was tests/volley-thirty.test.js, a turn on the GM page (lib/scenario.js) that searched the map
// for a guard the world had; its four checks are kept as they were, and "no page errors" is "throws nothing" (an
// unexpected console.error fails the test: setup/each.ts).
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import {
  aBattleAgainstTheProvince,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  theTurnsContext,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

test("a pre-battle shot takes 30% of the shooting company's base strength", () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const H = G.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
  if (!H) throw new Error('realm 0 has no hero but its king');
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, from, 0);
  const guard = aGuardMadeByTheTest(G, field, companies('Dwarven Guard', 1, 'Elite'));
  attackFrom(G, H, from, field);
  H.armies = companies('Yeoman Longbows', 1, 'Elite');
  H.skills = { ...H.skills, archery: 0 };
  H.items = [];
  H.encounterPlan = MELEE_AND_NO_DUEL();
  const { text } = aBattleAgainstTheProvince(tc, H, field, guard);
  expect(text, 'the Longbow company fires in the archery phase').toMatch(
    /Pre-battle Archery Phase\*\* — 1 ranged unit/,
  );
  const shot = /Yeoman Longbows 1 fires at Dwarven Guard 1: −(\d+) strength/.exec(text);
  expect(shot, 'the report names the shot and its damage').not.toBeNull();
  expect(Number(shot?.[1]), "the shot takes 6 strength, 30% of the company's 20").toBe(6);
  expect(text, 'the archery total is 6').toMatch(/Archery phase total: −6 strength/);
});
