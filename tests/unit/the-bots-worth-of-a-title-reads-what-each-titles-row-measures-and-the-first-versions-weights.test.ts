// The bots' worth of a title reads what each title's row measures, and the first version's weights (B-06r, T7: the
// rules pulled out, the bots' worth of a title). The titles a realm chases (botTargetTitles), the skill a hero trains
// towards them (botTitleFocusSkill), the specialists a chased title wants (botSpecialistRoles) and the Warlock's cast
// (botCastLimit), on what no matrix game is sure to hand them: from the standings, a title the realm holds, a rival's
// title its best hero nearly reaches or doesn't, a vacant one, and the three it holds most; with none worth chasing, each
// title the bots train towards, alone and tied with the next in the bots' order; a title's skill for each title, none
// for a title the bots don't train towards or a key with no row; each chased title's specialist; the Warlock's cast in
// his best school, in another, and held by another hero. Each figure is the one the bots chose before T7.
//
// Level 1 (unit): the bots' functions are called on small worlds made here; a lower level can't run them.
import { expect, test } from 'vitest';
import { botCastLimit } from '../../src/engine/bots/economy.ts';
import { botTurnCache } from '../../src/engine/bots/intel.ts';
import { botSpecialistRoles } from '../../src/engine/bots/specialists.ts';
import { botTargetTitles, botTitleFocusSkill } from '../../src/engine/bots/spellcraft.ts';
import type { Character, GameState } from '../../src/schemas/saved-game-state.ts';

/** A living hero of the realm seated at `player`, of the skills given. */
const aHero = (id: number, player: number, skills: Readonly<Record<string, number>>, more: object = {}) => ({
  id,
  player,
  alive: true,
  name: `Hero ${String(id)}`,
  skills,
  items: [],
  ...more,
});

/** A world of two realms and the heroes given, with no map (no tax, no treasury: the titles of the realm are vacant). */
function aWorld(heroes: readonly object[], more: object = {}): GameState {
  // `as`: a world made of the few fields the bots' reading of the titles reads, as each reads them
  return {
    turn: 5,
    players: [{ name: 'Realm A' }, { name: 'Realm B' }],
    characters: heroes,
    world: { provinces: [] },
    ...more,
  } as unknown as GameState;
}

/** A rival of realm B, highest by far in every skill a title measures, so that no title of his is worth chasing. */
const theRival = aHero(9, 1, {
  tactical: 9,
  naval: 9,
  sage: 9,
  white: 9,
  necromancy: 9,
  spy: 9,
  explorer: 9,
  elemental: 9,
  psychic: 9,
  illusory: 9,
});

test("from the standings: a title the realm holds first, then a rival's its best hero reaches 60% of; never a vacant one", () => {
  const titles = (heroes: readonly object[]) => botTargetTitles(aWorld(heroes), 0);
  expect({
    'holds the Grand Marshal': titles([aHero(1, 0, { tactical: 3 }), aHero(2, 1, { naval: 9 })]),
    'reaches 6 of the Sea Lord’s 9': titles([aHero(1, 0, { naval: 6 }), aHero(2, 1, { naval: 9 })]),
    'reaches 5 of the Sea Lord’s 9': titles([aHero(1, 0, { naval: 5 }), aHero(2, 1, { naval: 9 })]),
    'holds four: the first three in the rows’ order': titles([
      aHero(1, 0, { tactical: 3, naval: 3, sage: 3, white: 3 }),
      aHero(2, 1, {}),
    ]),
    'holds one, and reaches 8 of a rival’s 9': titles([aHero(1, 0, { sage: 3, naval: 8 }), aHero(2, 1, { naval: 9 })]),
    'every title vacant but a rival’s': titles([aHero(1, 0, {}), aHero(2, 1, { tactical: 3 })]),
  }).toEqual({
    'holds the Grand Marshal': ['marshal'],
    'reaches 6 of the Sea Lord’s 9': ['sea'],
    'reaches 5 of the Sea Lord’s 9': ['sea', 'marshal', 'monster'],
    'holds four: the first three in the rows’ order': ['marshal', 'sea', 'lore'],
    'holds one, and reaches 8 of a rival’s 9': ['lore', 'sea'],
    'every title vacant but a rival’s': ['marshal', 'monster'],
  });
});

test('with none worth chasing: each title the bots train towards by its skills, a tie going to the first in their order', () => {
  const titles = (skills: Readonly<Record<string, number>>) =>
    botTargetTitles(aWorld([aHero(1, 0, skills), theRival]), 0);
  const courts: readonly (readonly [string, Readonly<Record<string, number>>])[] = [
    ['no skill', {}],
    ['Melee 2', { melee: 2 }],
    ['Tactical 1, March 1, Archery 1', { tactical: 1, march: 1, archery: 1 }],
    ['White 2', { white: 2 }],
    ['Necromancy 1, Psychic 1, Illusory 1, Elemental 1', { necromancy: 1, psychic: 1, illusory: 1, elemental: 1 }],
    ['Sage 2', { sage: 2 }],
    ['Naval 2', { naval: 2 }],
    ['Spy 2', { spy: 2 }],
    ['Explorer 2', { explorer: 2 }],
    ['Sage 2, Naval 2', { sage: 2, naval: 2 }],
    ['Spy 2, Explorer 2', { spy: 2, explorer: 2 }],
    ['White 1, Sage 1', { white: 1, sage: 1 }],
    ['Sage 3, Naval 3, Spy 3, Explorer 3', { sage: 3, naval: 3, spy: 3, explorer: 3 }],
    ['Melee 1, White 3', { melee: 1, white: 3 }],
    ['Thief 4, Druid 4', { thief: 4, druid: 4 }],
  ];
  expect(Object.fromEntries(courts.map(([name, skills]) => [name, titles(skills)]))).toEqual({
    'no skill': ['marshal', 'monster'],
    'Melee 2': ['marshal', 'monster'],
    'Tactical 1, March 1, Archery 1': ['marshal', 'monster'],
    'White 2': ['marshal', 'arch', 'monster'],
    'Necromancy 1, Psychic 1, Illusory 1, Elemental 1': ['arch', 'marshal', 'monster'],
    'Sage 2': ['marshal', 'lore', 'monster'],
    'Naval 2': ['marshal', 'sea', 'monster'],
    'Spy 2': ['marshal', 'spy', 'monster'],
    'Explorer 2': ['marshal', 'carto', 'monster'],
    'Sage 2, Naval 2': ['marshal', 'lore', 'sea'],
    'Spy 2, Explorer 2': ['marshal', 'spy', 'carto'],
    'White 1, Sage 1': ['marshal', 'monster', 'arch'],
    'Sage 3, Naval 3, Spy 3, Explorer 3': ['lore', 'sea', 'spy'],
    'Melee 1, White 3': ['marshal', 'arch', 'monster'],
    'Thief 4, Druid 4': ['marshal', 'monster'],
  });
});

test('with none worth chasing, the titles chased before are kept', () => {
  const G = aWorld([aHero(1, 0, { sage: 2 }), theRival]);
  const [realmA] = G.players;
  if (!realmA) throw new Error('no realm A');
  realmA._botTitles = ['carto', 'a title of no row'];
  expect(botTargetTitles(G, 0)).toEqual(['carto', 'a title of no row']);
});

test("a title's skill: the highest a hero has trained (1 to 4) of those the bots train towards it, the first title giving one", () => {
  const focus = (skills: Readonly<Record<string, number>>, titles: readonly string[]) =>
    botTitleFocusSkill(aHero(1, 0, skills) as unknown as Character, titles);
  expect({
    marshal: focus({ melee: 1, tactical: 2, march: 2, archery: 1 }, ['marshal']),
    monster: focus({ melee: 2, archery: 3 }, ['monster']),
    'arch, tied': focus({ white: 2, elemental: 2, necromancy: 2 }, ['arch']),
    'arch, Necromancy ahead of Psychic': focus({ psychic: 2, necromancy: 2, illusory: 1 }, ['arch']),
    lore: focus({ sage: 1 }, ['lore']),
    sea: focus({ naval: 4 }, ['sea']),
    spy: focus({ spy: 3 }, ['spy']),
    carto: focus({ explorer: 2 }, ['carto']),
    'each other title, and a key of no row': focus(
      { tactical: 2, naval: 2, white: 2, necromancy: 2, sage: 2, spy: 2, explorer: 2, melee: 2 },
      ['throne', 'vault', 'hiero', 'necro', 'beast', 'wild', 'explore'],
    ),
    'a skill at 5 or untrained: the next title': focus({ sage: 5, naval: 0, spy: 1 }, ['lore', 'sea', 'spy']),
    'the first title giving one': focus({ melee: 1, sage: 3 }, ['hiero', 'monster', 'lore']),
    'no titles': focus({ melee: 2 }, []),
  }).toEqual({
    marshal: 'tactical',
    monster: 'archery',
    'arch, tied': 'elemental',
    'arch, Necromancy ahead of Psychic': 'necromancy',
    lore: 'sage',
    sea: 'naval',
    spy: 'spy',
    carto: 'explorer',
    'each other title, and a key of no row': null,
    'a skill at 5 or untrained: the next title': 'spy',
    'the first title giving one': 'melee',
    'no titles': null,
  });
});

test('a chased title wants one specialist more, of the role whose work earns its deeds', () => {
  const want = (titles: string[]) => {
    const G = aWorld([], { world: { cols: 3, rows: 1, provinces: [] } });
    const cache = botTurnCache(G);
    cache.titles = { 0: titles };
    return botSpecialistRoles(G, 0).want;
  };
  const none = want([]);
  /** The specialists wanted with none chased, and one more of each role named. */
  const andOneMore = (...roles: readonly string[]) =>
    Object.fromEntries(Object.entries(none).map(([role, n]) => [role, roles.includes(role) ? n + 1 : n]));
  expect({
    monster: want(['monster']),
    lore: want(['lore']),
    spy: want(['spy']),
    carto: want(['carto']),
    'the others, and a key of no row': want([
      'throne',
      'vault',
      'marshal',
      'sea',
      'arch',
      'hiero',
      'necro',
      'beast',
      'wild',
      'explore',
    ]),
    'all four': want(['monster', 'lore', 'spy', 'carto']),
  }).toEqual({
    monster: andOneMore('slayer'),
    lore: andOneMore('scholar'),
    spy: andOneMore('spy'),
    carto: andOneMore('scout'),
    'the others, and a key of no row': none,
    'all four': andOneMore('slayer', 'scholar', 'spy', 'scout'),
  });
});

test("the Warlock's cast: one more in his best school, none in another, none for a hero who doesn't hold it", () => {
  const theWarlock = aHero(1, 0, { psychic: 3, white: 1 });
  const another = aHero(2, 0, { psychic: 3, white: 1 });
  const G = aWorld([theWarlock, another], { _minorHolders: { warlock: { charId: 1 } } });
  const limit = (hero: object, school: string) => botCastLimit(G, hero as unknown as Character, school);
  expect({
    'his best school': limit(theWarlock, 'psychic'),
    'another school': limit(theWarlock, 'white'),
    'another hero': limit(another, 'psychic'),
    'no holders worked out': botCastLimit(aWorld([theWarlock]), theWarlock as unknown as Character, 'psychic'),
  }).toEqual({ 'his best school': 3, 'another school': 1, 'another hero': 2, 'no holders worked out': 2 });
});
