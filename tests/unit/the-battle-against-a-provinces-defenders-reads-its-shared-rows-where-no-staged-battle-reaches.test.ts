// The battle against a province's defenders reads its shared rows' figures where no staged battle reaches (B-06be: its
// numbers moved to content's rows, src/content/kingdoms-call-data.ts, each named for its rule). The battle proof's grid
// (npm run proof:battles) never fights on a realm's home province, never under a Grand Stratagem, and never has an
// attacker lose to primal defenders with a Druid roll told, so a row's figure changed there leaves every staged battle
// the same. Here, on a free plain: the defenders of realm 0's home province, held by realm 0, fight at ×1.2 for it
// (KC_THE_DEFENDERS_EDGE_AND_A_REALMS_HOME_GROUND_IN_A_BATTLE's aRealmHoldingItsHomeProvince), beside the defenders'
// edge ×1.25; realm 0's hero retaking his home province from its neutral guard fights at ×1.5
// (aRealmRetakingItsHomeProvince); a hero who unfolds a Grand Stratagem this turn fights at ×1.2
// (KC_THE_MASTERY_ORDERS_FACTORS_IN_A_BATTLE's aGrandStratagem); each read from the battle's strength ladder, the
// force-wide modifiers it tells. And a hero beaten by a guard's primal beasts rolls for Druid at half the chance
// (KC_A_BATTLES_DECISIVE_MARGIN_ITS_TRAPPED_UNITS_AND_ITS_BEATEN_SIDES_LESSONS'
// theShareOfTheChanceTheBeatenSidesCommanderLearnsDruidAt), the guard who holds at the full chance: each experience
// roll recorded by a stand-in on trySkillGain (vi.spyOn on its module; the battle calls it from its own file), which
// calls the real one, shown reached. The figures are written here as literals, so a row's figure changed fails a case.
//
// Level 1 (unit): combatVsNPC called directly (tests/lib/a-battle-called-directly.ts) on a world the engine makes from
// KC_SEED; no turn is played. Not lower: each figure is read inside the battle, from the province, the attacker and the
// result, and told in its lines. Not higher: a whole turn adds dice and orders before the battle, and no bot order
// stages these.
import '../lib/the-whole-engine.ts';
import { afterEach, expect, test, vi } from 'vitest';
import * as experience from '../../src/engine/heroes/experience-skill-rises-and-earned-hp.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
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
  type World,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

afterEach(() => {
  vi.restoreAllMocks();
});

/** Realm `pi`'s first hero who isn't its king, with no item, a plan that fights in melee and refuses every duel. */
function aHeroOf(G: World, pi: number): Character {
  const hero = G.characters.find((c) => c.alive && c.player === pi && !c.isKing);
  if (!hero) throw new Error(`realm ${String(pi)} has no hero but its king`);
  Object.assign(hero, { items: [], hp: 40, maxHp: 40, encounterPlan: MELEE_AND_NO_DUEL() });
  return hero;
}

/** Each force-wide modifier the battle's strength ladders tell, both sides', by its reason: its factor. */
function theForceWideModifiers(narrative: readonly NarrativeLine[]): Map<string, number[]> {
  const found = new Map<string, number[]>();
  for (const line of narrative) {
    const fact = line as { kind?: string; theForceWideModifiers?: readonly { reason: string; m: number }[] };
    if (fact.kind !== "the strength ladder's force-wide modifiers") continue;
    for (const { reason, m } of fact.theForceWideModifiers ?? []) found.set(reason, [...(found.get(reason) ?? []), m]);
  }
  return found;
}

test("the defenders of a realm's home province, held by the realm, fight at ×1.2 for it, beside the defenders' ×1.25", () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  const realm0 = G.players[0] as World['players'][number] & { homeProvinceId?: number };
  realm0.homeProvinceId = field.id;
  own(G, field, 0);
  own(G, from, 1);
  field.garrisonArmies = companies('Men-at-Arms', 4, 'Veteran');
  const hero = aHeroOf(G, 1);
  hero.armies = companies('Men-at-Arms', 4, 'Veteran');
  attackFrom(G, hero, from, field);

  const { narrative } = aBattleAgainstTheProvince(tc, hero, field, null);
  const mods = theForceWideModifiers(narrative);
  expect(
    mods.get('home'),
    `the defenders fight at ×1.2 on their realm's home (the ladders: ${JSON.stringify([...mods])})`,
  ).toEqual([1.2]);
  expect(mods.get('defenders-position'), "…beside the defenders' edge, ×1.25").toEqual([1.25]);
});

test("a hero retaking his realm's home province from its guard fights at ×1.5", () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  const realm0 = G.players[0] as World['players'][number] & { homeProvinceId?: number };
  realm0.homeProvinceId = field.id;
  own(G, from, 0);
  const guard = aGuardMadeByTheTest(G, field, companies('Men-at-Arms', 4, 'Veteran'), {
    encounterPlan: MELEE_AND_NO_DUEL(),
  });
  const hero = aHeroOf(G, 0);
  hero.armies = companies('Men-at-Arms', 4, 'Veteran');
  attackFrom(G, hero, from, field);

  const { narrative } = aBattleAgainstTheProvince(tc, hero, field, guard);
  const mods = theForceWideModifiers(narrative);
  expect(
    mods.get('home-ground'),
    `the attacker fights at ×1.5 retaking his home (the ladders: ${JSON.stringify([...mods])})`,
  ).toEqual([1.5]);
  expect(mods.get('home'), "…and the guard, holding no realm's home, has no home factor").toBeUndefined();
});

test('a hero who unfolds a Grand Stratagem this turn fights the defenders at ×1.2', () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, from, 0);
  const guard = aGuardMadeByTheTest(G, field, companies('Men-at-Arms', 4, 'Veteran'), {
    encounterPlan: MELEE_AND_NO_DUEL(),
  });
  const hero = aHeroOf(G, 0);
  hero.armies = companies('Men-at-Arms', 4, 'Veteran');
  hero['_grandStratagemTurn'] = G.turn;
  attackFrom(G, hero, from, field);

  const { narrative } = aBattleAgainstTheProvince(tc, hero, field, guard);
  const mods = theForceWideModifiers(narrative);
  expect(
    mods.get('orders'),
    `the attacker's orders lift his host ×1.2 (the ladders: ${JSON.stringify([...mods])})`,
  ).toEqual([1.2]);
});

test("a hero beaten by a guard's primal beasts rolls for Druid at half the chance; the guard who holds, at the full", () => {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain: 'plain' });
  own(G, from, 0);
  const guard = aGuardMadeByTheTest(G, field, companies('Stone Giants', 8, 'Elite'), {
    encounterPlan: MELEE_AND_NO_DUEL(),
  });
  const hero = aHeroOf(G, 0);
  hero.armies = companies('Levies', 1, 'Green');
  attackFrom(G, hero, from, field);

  // every experience roll, recorded as it starts
  const rolls: { id: unknown; skill: string; share: unknown }[] = [];
  const tryOne = experience.trySkillGain;
  vi.spyOn(experience, 'trySkillGain').mockImplementation((...args: Parameters<typeof tryOne>) => {
    const [, char, skill, , , share] = args as unknown as [
      unknown,
      { id?: unknown } | null,
      string,
      number,
      unknown,
      unknown,
    ];
    rolls.push({ id: char?.id, skill, share });
    tryOne(...args);
  });

  const { won } = aBattleAgainstTheProvince(tc, hero, field, guard);
  expect(won, 'the hero is beaten').toBe(false);
  expect(rolls.length, 'the stand-in on trySkillGain is reached').toBeGreaterThan(0);
  const druid = (id: unknown) => rolls.filter((r) => r.id === id && r.skill === 'druid').map((r) => r.share);
  expect(druid(hero.id), `the beaten hero rolls for Druid at half the chance (${JSON.stringify(rolls)})`).toEqual([
    0.5,
  ]);
  expect(druid(guard.id), '…and the guard who holds, at the full chance').toEqual([1]);
});
