// The minor titles' measures find each holder as the engine did (B-06i): each title's row says how its holder is found
// (content's MINOR_TITLES), and the registry's theMeasureAHeroIsHeldToForAMinorTitle gives, for every made-up hero and
// world, what the row's own metric gave before (each old metric written here as it was in src/engine/titles/
// reckoning.ts); and computeMinorTitles gives each title to the highest living hero of a realm, the first found on a
// tie, a hero of no realm or a dead one never, and leaves a title no hero measures above 0 vacant, the holder carrying
// the title's name and perk.
// Level 1 (unit): the measure is a function on plain values and the awarding a function of the world; a static test
// can't run them, and the matrix's games may award some titles never (a Widowmaker, an Ironclad).
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { KC_UNIT_CLASS } from '../../src/content/kingdoms-call-data.ts';
import { MINOR_TITLES } from '../../src/content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import {
  theMeasureAHeroIsHeldToForAMinorTitle,
  type AHeroAsTheMinorTitlesMeasureHim,
  type TheWorldAsTheMinorTitlesMeasureAHeroInIt,
} from '../../src/engine/rules/the-registry-of-the-minor-titles-perks.ts';
import { theHighestLevelAHeroHasTrainedInAMagicSchool } from '../../src/engine/rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import {
  MINOR_CAV,
  MINOR_HEAVY,
} from '../../src/engine/rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../../src/engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { skillLevel } from '../../src/engine/titles/perks.ts';
import { computeMinorTitles } from '../../src/engine/titles/reckoning.ts';

type Hero = AHeroAsTheMinorTitlesMeasureHim;
type World = TheWorldAsTheMinorTitlesMeasureAHeroInIt;
/** Each title's metric as reckoning.ts wrote it before B-06i, by its key. */
const THE_OLD_METRICS: Readonly<Record<string, (c: Hero, st: World) => number>> = {
  duelist: (c) => skillLevel(c, 'melee'),
  marksman: (c) => skillLevel(c, 'archery'),
  strategist: (c) => skillLevel(c, 'tactical'),
  swift: (c) => skillLevel(c, 'march'),
  seawolf: (c) => skillLevel(c, 'naval'),
  shadow: (c) => skillLevel(c, 'spy'),
  cutpurse: (c) => skillLevel(c, 'thief'),
  naturalist: (c) => skillLevel(c, 'druid'),
  loreseeker: (c) => skillLevel(c, 'sage'),
  trailblazer: (c) => skillLevel(c, 'explorer'),
  colossus: (c) => c.maxHp || 20,
  widowmaker: (c) => Number(c.tm?.duelKills) || 0,
  champion: (c) => c.merits || 0,
  hostleader: (c) => (c.armies ?? []).length,
  cavalier: (c) => (c.armies ?? []).filter((a) => MINOR_CAV.has(a.type)).length,
  beastmaster: (c) => (c.armies ?? []).filter((a) => CREATURE_ARMIES.has(a.type) || MONSTER_ARMIES.has(a.type)).length,
  ironclad: (c) => (c.armies ?? []).filter((a) => MINOR_HEAVY.has(a.type)).length,
  relichunter: (c) => (c.items ?? []).length,
  castellan: (c, st) => (c.isKing ? (st.world?.provinces ?? []).filter((pv) => pv.owner === c.player).length : 0),
  warlock: (c) => theHighestLevelAHeroHasTrainedInAMagicSchool(c),
};

const SKILLS = [
  'melee',
  'archery',
  'tactical',
  'march',
  'naval',
  'spy',
  'thief',
  'druid',
  'sage',
  'explorer',
  'white',
  'psychic',
  'illusory',
  'elemental',
  'necromancy',
];
const TYPES = [...new Set(Object.values(KC_UNIT_CLASS).flat()), 'Levies', 'Not a unit'];

/** The made-up heroes and worlds, each field in turn missing, nothing, a level past 9, and values in between: hero `k`
 *  of a fixed sequence (no dice: the same heroes every run). */
function aHeroAndAWorld(k: number): [Hero, World] {
  const at = (n: number, i: number) => (k * 7 + i * 13 + ((k * i) % 5)) % n;
  const skills: Record<string, number> = {};
  SKILLS.forEach((s, i) => {
    if (at(4, i) !== 0) skills[s] = at(13, i) - 2;
  });
  const hero: Hero = {
    player: at(4, 1),
    isKing: at(3, 2) === 0,
    maxHp: at(5, 3) === 0 ? 0 : at(60, 4),
    merits: at(9, 5),
    ...(at(7, 6) === 0 ? {} : { skills }),
    ...(at(4, 7) === 0 ? {} : { tm: at(5, 8) === 0 ? {} : { duelKills: at(6, 9) } }),
    ...(at(9, 10) === 0
      ? {}
      : {
          armies: Array.from({ length: at(9, 11) }, (_, j) => ({ type: TYPES[at(TYPES.length, 12 + j)] ?? 'Levies' })),
        }),
    ...(at(8, 20) === 0 ? {} : { items: Array.from({ length: at(5, 21) }, () => ({})) }),
  };
  const world: World =
    at(11, 22) === 0
      ? {}
      : { world: { provinces: Array.from({ length: at(30, 23) }, (_, j) => ({ owner: at(5, 24 + j) || null })) } };
  return [hero, world];
}

test("each title's measure is its old metric's, for every made-up hero and world", () => {
  expect(MINOR_TITLES.map((t) => t.key)).toEqual(Object.keys(THE_OLD_METRICS));
  for (let k = 0; k < 3000; k++) {
    const [hero, world] = aHeroAndAWorld(k);
    for (const t of MINOR_TITLES) {
      const old = THE_OLD_METRICS[t.key];
      if (!old) throw new TypeError(`no old metric for ${t.key}`);
      expect(
        theMeasureAHeroIsHeldToForAMinorTitle(t.howTheHolderIsFound, hero, world),
        `${t.key}, hero ${String(k)}`,
      ).toBe(old(hero, world));
    }
  }
});

test('each kind of measure reads its own figure: a skill, his hit points, his kills, merits, companies, items, provinces, his best school', () => {
  const hero: Hero = {
    player: 1,
    isKing: true,
    maxHp: 0,
    merits: 4,
    skills: { melee: 12, druid: 3, white: 6, necromancy: 2 },
    tm: { duelKills: 2 },
    armies: [{ type: 'Free Lances' }, { type: 'Galleon Fleet' }, { type: 'Levies' }, { type: 'Great Turtles' }],
    items: [{}, {}, {}],
  };
  const world: World = { world: { provinces: [{ owner: 1 }, { owner: 0 }, { owner: 1 }, { owner: null }] } };
  const measures = Object.fromEntries(
    MINOR_TITLES.map((t) => [t.key, theMeasureAHeroIsHeldToForAMinorTitle(t.howTheHolderIsFound, hero, world)]),
  );
  expect(measures).toEqual({
    duelist: 9,
    marksman: 0,
    strategist: 0,
    swift: 0,
    seawolf: 0,
    shadow: 0,
    cutpurse: 0,
    naturalist: 3,
    loreseeker: 0,
    trailblazer: 0,
    colossus: 20,
    widowmaker: 2,
    champion: 4,
    hostleader: 4,
    cavalier: 1,
    beastmaster: 1,
    ironclad: 2,
    relichunter: 3,
    castellan: 2,
    warlock: 6,
  });
  expect(
    MINOR_TITLES.map((t) =>
      theMeasureAHeroIsHeldToForAMinorTitle(t.howTheHolderIsFound, { ...hero, isKing: false, maxHp: 31 }, world),
    ),
    'a hero who is not his realm king holds no province for the Castellan; his own hit points count',
  ).toEqual(Object.values({ ...measures, colossus: 31, castellan: 0 }));
});

test('the awarding: the highest living hero of a realm, the first found on a tie, a title no hero measures vacant', () => {
  const aHero = (id: number, player: number | null, more: object) => ({
    id,
    player,
    alive: true,
    isKing: false,
    maxHp: 0,
    merits: 0,
    skills: {},
    ...more,
  });
  const state = {
    characters: [
      aHero(1, 0, { skills: { melee: 5, march: 2 }, merits: 3 }),
      aHero(2, 1, { skills: { melee: 5, march: 3 }, merits: 3, isKing: true }),
      aHero(3, 2, { skills: { melee: 8 }, alive: false }),
      aHero(4, null, { skills: { melee: 9, march: 9 } }),
      null,
    ],
    world: { provinces: [{ owner: 1 }, { owner: 0 }] },
  };
  // (a made-up world of the fields the awarding reads, standing in for the saved one)
  const holders = computeMinorTitles(state as unknown as Parameters<typeof computeMinorTitles>[0]);
  expect(holders['duelist'], 'a tie at 5: the first found').toEqual({
    charId: 1,
    playerIndex: 0,
    name: 'The Duelist',
    perk: '+1 melee in personal combat',
  });
  expect(holders['swift']?.charId, 'the highest').toBe(2);
  expect(holders['champion']?.charId, 'a tie at 3: the first found').toBe(1);
  expect(holders['castellan']?.charId, 'the king alone').toBe(2);
  expect(holders['colossus']?.charId, 'every hero at the 20 written for none: the first found').toBe(1);
  expect(
    Object.keys(holders),
    'a title no hero measures above 0 is vacant, and the holders are in the rows order',
  ).toEqual(['duelist', 'swift', 'colossus', 'champion', 'castellan']);
});
