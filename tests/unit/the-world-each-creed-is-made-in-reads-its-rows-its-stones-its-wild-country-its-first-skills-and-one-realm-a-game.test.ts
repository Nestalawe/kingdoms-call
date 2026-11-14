// The world each creed is made in (plan P1-19's alignment abilities family, row P1-19ay1), read from its rows
// (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts) through
// src/engine/rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts:
// the ritual stones placed only with a Pagan in the game, the wild country a capital opens beside (a Pagan's ritual
// stones, a Druidic's Creatures, an Evil's Monsters), a king's (and an heir's) first skill a level more, the Undead
// king's skeletal company, the wanderers' deck of alignments and a Druidic wanderer's Druid, and the alignments one
// realm a game may hold (the join form and the bots' setup). Each reader is pinned to the literals the engine wrote
// before the row; then a seeded world of seven realms, one of each creed, and the same world with its Pagan made Good,
// read what world creation made of them with no die (so on any seed); and the bots' setup (GM turn zero with bots, which
// the balance matrix doesn't play) never deals a second Divine or Undead realm. The wild country a capital opens beside
// needs a free neighbour, which a world may not have: its readers are pinned here, its worlds by
// tests/unit/the-two-crowns-have-wild-country-within-two-provinces.test.ts, tests/two-crowns.test.js and the matrix.
//
// Level 1 (unit): the readers called directly, and generateNewGame and generateBotSetups called on the engine's
// modules, the dice seeded (kcRng), no turn played. Not lower: a static test can't build a world, and the readers'
// answers are the rows' as code reads them.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { KC_ALIGNMENTS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { BOT_UNIQUE_ALIGNS, generateBotSetups } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import {
  doTheRitualStonesStandWithARealmOf,
  doesACapitalOfTheAlignmentOpenBesideCreatures,
  doesACapitalOfTheAlignmentOpenBesideMonsters,
  doesACapitalOfTheAlignmentOpenBesideTheRitualStones,
  doesAKingOfTheAlignmentStartWithASkeletalCompany,
  theAlignmentsOnlyOneRealmAGameMayHold,
  theSkillAKingOfTheAlignmentStartsWith,
  theSkillAWandererOfTheAlignmentIsSureOf,
  theWanderingHeroesDeckOfAlignments,
} from '../../src/engine/rules-on-plain-values/the-world-each-creed-is-made-in-its-wild-country-its-first-skills-and-one-realm-a-game.ts';

type TheSetUps = Parameters<typeof generateNewGame>[0];

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** Each alignment, and what no row holds: none, an empty one, one no creed is. */
const EVERY_ALIGNMENT: readonly unknown[] = [...KC_ALIGNMENTS, null, undefined, '', 'Atheist'];

test("each reader of the world gives what the engine's literals gave before the row, for every alignment and none", () => {
  const each = (read: (a: unknown) => unknown) => EVERY_ALIGNMENT.map((a) => [a, read(a)]);
  const asBefore = (read: (a: unknown) => unknown) => EVERY_ALIGNMENT.map((a) => [a, read(a)]);
  expect(each(doTheRitualStonesStandWithARealmOf)).toEqual(asBefore((a) => a === 'Pagan'));
  expect(each(doesACapitalOfTheAlignmentOpenBesideTheRitualStones)).toEqual(asBefore((a) => a === 'Pagan'));
  expect(each(doesACapitalOfTheAlignmentOpenBesideCreatures)).toEqual(asBefore((a) => a === 'Druidic'));
  expect(each(doesACapitalOfTheAlignmentOpenBesideMonsters)).toEqual(asBefore((a) => a === 'Evil'));
  expect(each(doesAKingOfTheAlignmentStartWithASkeletalCompany)).toEqual(asBefore((a) => a === 'Undead'));
  const oldKingsSkill: Readonly<Partial<Record<string, string>>> = {
    Divine: 'white',
    Druidic: 'druid',
    Evil: 'druid',
    Pagan: 'explorer',
    Undead: 'necromancy',
  };
  expect(each(theSkillAKingOfTheAlignmentStartsWith)).toEqual(
    asBefore((a) => {
      const theSkill = typeof a === 'string' ? oldKingsSkill[a] : undefined;
      return theSkill === undefined ? undefined : { theSkill, theLevelsMore: 1 };
    }),
  );
  expect(each(theSkillAWandererOfTheAlignmentIsSureOf)).toEqual(
    asBefore((a) => (a === 'Druidic' ? 'druid' : undefined)),
  );
  expect(theWanderingHeroesDeckOfAlignments()).toEqual([
    ...Array<string>(1).fill('Divine'),
    ...Array<string>(2).fill('Good'),
    ...Array<string>(4).fill('Druidic'),
    ...Array<string>(6).fill('Neutral'),
    ...Array<string>(4).fill('Pagan'),
    ...Array<string>(2).fill('Evil'),
    ...Array<string>(1).fill('Undead'),
  ]);
  expect(theAlignmentsOnlyOneRealmAGameMayHold()).toEqual(['Divine', 'Undead']);
  expect(BOT_UNIQUE_ALIGNS).toEqual(['Divine', 'Undead']);
});

/** Seven realms, one of each creed (the Pagan's made `pagansCreed`), named Realm i, King i, Human. */
const sevenRealms = (pagansCreed: string): TheSetUps =>
  KC_ALIGNMENTS.map((alignment, i) => ({
    id: i,
    gamePlayerId: 'gp' + String(i),
    name: 'Realm' + String(i),
    kingName: 'King' + String(i),
    kingdomName: 'Kingdom' + String(i),
    race: 'Human',
    alignment: alignment === 'Pagan' ? pagansCreed : alignment,
    temper: 'Brave',
    skills: {},
  }));

test('a seeded world of every creed: the kings start with their creed’s skill and the Undead king his skeletons, the Pagan, Druidic and Evil capitals open beside their wild country, every Druidic wanderer knows the Druid’s craft, and the stones stand only with a Pagan in the game', () => {
  kcRng.seed(11);
  const w = generateNewGame(sevenRealms('Pagan'), { cols: 18, rows: 12 }, 0, { seaPct: 30 });
  kcRng.seed(11);
  const noPagan = generateNewGame(sevenRealms('Good'), { cols: 18, rows: 12 }, 0, { seaPct: 30 });
  const kingOf = (world: typeof w, alignment: string) => {
    const realm = world.players.find((p) => p.alignment === alignment);
    const king = world.characters.find((c) => c.isKing && c.player === realm?.id);
    if (!realm || !king) throw new Error(`no ${alignment} king`);
    return { realm, king };
  };
  // a king's skills: the base (melee 2, archery 1, sage 1) and his creed's a level more
  const skillsOf = (a: string) => kingOf(w, a).king.skills;
  expect(KC_ALIGNMENTS.map((a) => [a, skillsOf(a)])).toEqual([
    ['Divine', { melee: 2, archery: 1, sage: 1, white: 1 }],
    ['Good', { melee: 2, archery: 1, sage: 1 }],
    ['Druidic', { melee: 2, archery: 1, sage: 1, druid: 1 }],
    ['Neutral', { melee: 2, archery: 1, sage: 1 }],
    ['Pagan', { melee: 2, archery: 1, sage: 1, explorer: 1 }],
    ['Evil', { melee: 2, archery: 1, sage: 1, druid: 1 }],
    ['Undead', { melee: 2, archery: 1, sage: 1, necromancy: 1 }],
  ]);
  // the skeletal company: the Undead king's alone
  expect(
    KC_ALIGNMENTS.filter((a) => kingOf(w, a).king.armies.some((u) => (u as { _isSkeletal?: unknown })._isSkeletal)),
  ).toEqual(['Undead']);
  // every Druidic wanderer (a neutral province's guard) is dealt the Druid's craft; there are some
  const druidicWanderers = w.characters.filter((c) => c.player === null && c.alignment === 'Druidic');
  expect(druidicWanderers.length).toBeGreaterThan(0);
  expect(druidicWanderers.filter((c) => !c.skills['druid'])).toEqual([]);
  // the ritual stones: with a Pagan in the game, in every wild land province; with none, nowhere
  const stones = (world: typeof w) => world.world.provinces.filter((p) => p.features.some((f) => f.ritualSite)).length;
  expect(stones(w)).toBeGreaterThan(1);
  expect(stones(noPagan)).toBe(0);
});

test("the bots' setup deals no second Divine or Undead realm: none beside a human's, and one of each in a game of bots", () => {
  kcRng.seed(11);
  const withHumans = generateBotSetups([{ alignment: 'Divine' }, { alignment: 'Undead' }], 12, 2);
  expect(withHumans.filter((b) => b.alignment === 'Divine' || b.alignment === 'Undead')).toEqual([]);
  kcRng.seed(11);
  const botsAlone = generateBotSetups([], 14, 0).map((b) => b.alignment);
  expect([botsAlone.filter((a) => a === 'Divine').length, botsAlone.filter((a) => a === 'Undead').length]).toEqual([
    1, 1,
  ]);
});
