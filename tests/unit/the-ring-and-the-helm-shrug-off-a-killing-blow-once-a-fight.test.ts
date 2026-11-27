// The Ring of the Unbroken Pulse and the Great Helm of the Deathless shrug off a killing blow (R-153): once a fight,
// on the item's chance (the Ring's 15%, the Helm's 20%: each copy's own, as its texts say), a blow that would leave
// the wearer at 0 HP or below leaves him standing at 1 HP instead, and the line says so. Neither gives HP back when he
// first falls below 30% of his maximum (the other second-wind items' rule, which Last-Stand Plate keeps).
//
// Level 1 (unit): pcTakeHit called directly on a staged fighter (a guardian of no perks, 20 HP, tests/lib/
// personal-combat.ts) wearing the item's row in play as a hero wears it (pcArmourOf, pcApplyFx), the dice pinned
// (pc.pinned) on each side of the chance. Not lower: the chance is drawn inside pcTakeHit, once the blow is dealt. No
// matrix game reaches a killing blow on a wearer at a known die.
import { describe, expect, test } from 'vitest';
import { clone, personalCombatEngine } from '../lib/personal-combat.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import type { AFighterInAPersonalCombat } from '../../src/engine/personal-combat/helpers.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';

const pc = await personalCombatEngine();
const tc = pc.turnContext as unknown as TurnContext;
const { pcTakeHit } = await import('../../src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts');
const { pcApplyFx, pcMonsterCombatant } =
  await import('../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts');
const { pcArmourOf } = await import('../../src/engine/personal-combat/helpers.ts');
const { ALL_MAGIC_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');

/** An item in play, by its name. */
function theItem(name: string) {
  const item = ALL_MAGIC_ITEMS_P.find((it) => it.name === name);
  if (!item) throw new Error(`${name} is not in play`);
  return item;
}
/** A plain fighter of 20 HP at `hp`, wearing the item named as a hero wears it (pcCharCombatant: his armour's wards,
 *  then each item's riders and their ward). */
function aWearer(name: string, hp: number): AFighterInAPersonalCombat {
  const item = theItem(name);
  const staged: Record<string, unknown> = {
    ...pcMonsterCombatant({ name: 'Sir Aldric', hp: 20, melee: 2 }),
    hp,
    arm: pcArmourOf([item]),
  };
  const f = staged as unknown as AFighterInAPersonalCombat;
  if (item.effect.pc) pcApplyFx(f, item.effect.pc, item.name);
  return f;
}
/** A blow of `dmg` on `target`, every die pinned at `r`: his HP after it, and the kinds of the lines. */
function aBlow(target: AFighterInAPersonalCombat, dmg: number, r: number) {
  const narrative: NarrativeLine[] = [];
  pc.pinned(r, () => pcTakeHit(tc, target, dmg, narrative, 'a foe', 'blow'));
  const kinds = narrative.map((l) => (typeof l === 'string' ? l : l.kind));
  return { hp: target.hp, kinds };
}
const STANDS = 'the target shrugs off a killing blow and stands at 1 HP';

describe.for([
  ['Ring of the Unbroken Pulse', 0.149, 0.15],
  ['Great Helm of the Deathless', 0.199, 0.2],
] as const)('%s', ([name, under, at]) => {
  test(`a killing blow at a die under its chance (${String(under)}) leaves him standing at 1 HP, and the line says so`, () => {
    const { hp, kinds } = aBlow(aWearer(name, 4), 8, under);
    expect(hp).toBe(1);
    expect(kinds).toContain(STANDS);
  });
  test(`a killing blow at a die of its chance (${String(at)}) kills him`, () => {
    const { hp, kinds } = aBlow(aWearer(name, 4), 8, at);
    expect(hp).toBeLessThanOrEqual(0);
    expect(kinds).not.toContain(STANDS);
  });
  test('once a fight: the second killing blow, at a die of 0, kills him', () => {
    const wearer = aWearer(name, 4);
    expect(aBlow(wearer, 8, 0).hp).toBe(1);
    expect(aBlow(wearer, 8, 0).hp).toBeLessThanOrEqual(0);
  });
  test('falling below 30% of his maximum (10 HP to 5 of 20) gives no HP back', () => {
    const { hp, kinds } = aBlow(aWearer(name, 10), 5, 0);
    expect(hp).toBe(5);
    expect(kinds).not.toContain('the target will not go down and restores hit points');
  });
});

test('Last-Stand Plate keeps its rule: falling below 30% of his maximum (10 HP to 5 of 20) gives back 25% of it', () => {
  expect(aBlow(aWearer('Last-Stand Plate', 10), 5, 0).hp).toBe(10);
});

test('a hero wearing the Ring (pcCharCombatant) shrugs off a killing blow at a die under 15%', () => {
  const staged = { ...clone(pc.base), items: [clone(theItem('Ring of the Unbroken Pulse'))] };
  const hero = pc.call('pcCharCombatant', staged) as AFighterInAPersonalCombat;
  hero.hp = 4;
  expect(aBlow(hero, Math.min(8, Math.floor((hero.maxHp || 20) / 2)), 0.149).hp).toBe(1);
});

test('a blow on a fighter already at 0 HP raises no one: the chance waits for a blow that strikes him down', () => {
  expect(aBlow(aWearer('Ring of the Unbroken Pulse', 0), 3, 0).hp).toBeLessThanOrEqual(0);
});
