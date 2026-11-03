// 2026-10-15 (Toby, D7; R-115): a hero guarding a neutral province casts battle magic at the same odds as a player's
// hero: 30% + 10% a level, the school counted as for anyone (training to 5, items on top), at most 95%. Before, a guard
// cast at 30% + 15% a level, at most 90% (45/60/75/90% at levels 1 to 4, against 40/50/60/70%). So a guard casts at
// 40/50/60/70/80% at Elemental 1 to 5 and 80% at a trained 7, as castChanceFor gives realm 0's first hero, and at 95%
// when an item lifts the school to 7. And the defender's battle magic uses guardCastChance: a guard made by the test
// (Elemental 3, a plan that opens with a cast of his school) holds a free plain against realm 0's king; a stand-in on
// guardCastChance (vi.spyOn on its module; the battle calls it from its own file) calls the real one and is shown
// reached, with the guard and his school, and the cast line's chance is what it gave (60%, where the old formula gave
// 75%). The rulebook's words for the cast chance are
// tests/static/the-rulebook-says-training-stops-cast-chance-at-80-and-items-carry-it-to-95.test.ts.
//
// Level 1 (unit): guardCastChance and castChanceFor called on hand-made heroes, combatVsNPC called directly
// (tests/lib/a-battle-called-directly.ts) on a world the engine makes from KC_SEED; no turn is played. Not lower: the
// odds are computed values, and the cast is made inside the battle.
//
// Until plan P1-14d this was tests/guard-cast-chance.test.js, which booted the GM page (lib/scenario.js) to call its
// globals on a copy of a guard the world had, and read the call site from the page's source by its text (a regex for
// the call, and none for the old formula). Its checks are kept: "the GM portal declares guardCastChance" is the import;
// the call site is the battle's own call, shown by the stand-in and the cast line's value (stricter: a battle that
// read the old formula, or any other, writes another chance).
import '../lib/the-whole-engine.ts';
import { afterEach, expect, test, vi } from 'vitest';
import * as chances from '../../src/engine/chances-and-lair-grades.ts';
import {
  aBattleAgainstTheProvince,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  type Character,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  theTurnsContext,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

afterEach(() => {
  vi.restoreAllMocks();
});

type AHero = Parameters<typeof chances.guardCastChance>[0];
type TheHeroes = Parameters<typeof chances.guardCastChance>[2];
const asAHero = (c: Character) => c as unknown as AHero;

test("a guard casts at a player's hero's odds: 40% to 80% at levels 1 to 5, 80% trained past it, 95% with an item", () => {
  const G = aWorld(SEED);
  const { field } = aFieldAndTheGroundBesideIt(G);
  const guard = aGuardMadeByTheTest(G, field, companies('Militia', 1, 'Green'));
  const hero = G.characters.find((c) => c.player === 0);
  if (!hero) throw new Error('realm 0 has no hero');
  const chars = G.characters as unknown as TheHeroes;
  const at = (c: Character, elemental: number): Character => ({
    ...structuredClone(c),
    items: [],
    skills: { ...c.skills, elemental },
  });
  for (const [lvl, want] of [
    [1, 40],
    [2, 50],
    [3, 60],
    [4, 70],
    [5, 80],
    [7, 80],
  ] as const) {
    const got = chances.guardCastChance(asAHero(at(guard, lvl)), 'elemental', chars);
    expect(got, `a guard at Elemental ${String(lvl)} casts at ${String(want)}%`).toBe(want);
    const pc = chances.castChanceFor(asAHero(at(hero, lvl)), 'elemental', G.players[0], {
      chars,
    }).chance;
    expect(got, `…the same as a player's hero (${String(pc)}%)`).toBe(pc);
  }
  const withItem = at(guard, 5);
  withItem.items = [{ name: 'Test Focus', equipped: true, effect: { stat: 'elemental', bonus: 2 } }];
  expect(
    chances.guardCastChance(asAHero(withItem), 'elemental', chars),
    'a guard whose item lifts Elemental to 7 casts at 95%',
  ).toBe(95);
});

test("the defender's battle magic casts at the chance guardCastChance gives", () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const king = G.characters.find((c) => c.alive && c.player === 0 && c.isKing);
  if (!king) throw new Error('realm 0 has no king');
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, from, 0);
  const guard = aGuardMadeByTheTest(G, field, companies('Militia', 2, 'Green'), {
    skills: { elemental: 3 },
    encounterPlan: { tactics: ['CS:elemental', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' },
  });
  attackFrom(G, king, from, field);
  king.armies = companies('Men-at-Arms', 2, 'Elite');
  king.items = [];
  king.encounterPlan = MELEE_AND_NO_DUEL();
  const given: { caster: unknown; school: string; chance: number }[] = [];
  const real = chances.guardCastChance;
  vi.spyOn(chances, 'guardCastChance').mockImplementation((...args: Parameters<typeof real>) => {
    const chance = real(...args);
    given.push({ caster: args[0], school: args[1], chance });
    return chance;
  });
  const { text } = aBattleAgainstTheProvince(tc, king, field, guard);
  expect(given, 'the defender’s battle magic calls guardCastChance, for the guard and his school').toEqual([
    { caster: guard, school: 'elemental', chance: 60 },
  ]);
  expect(text, 'the cast line gives the chance it returned').toMatch(
    /✨ Defender Magic: Warden Testcairn casts .* \(Elemental Magic 3\) — 60% chance \[roll \d+ [✓✗]\]/,
  );
});
