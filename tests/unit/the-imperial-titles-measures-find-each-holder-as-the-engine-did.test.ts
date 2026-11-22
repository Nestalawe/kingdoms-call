// The Imperial Titles' measures find each holder as the engine did (B-06n): each title's row says how its holder is
// found (content's TITLE_DEFS, `howTheHolderIsFound`), and _charTitleMerit gives, for every made-up hero, what the old
// one gave (written here as it was in src/engine/titles/reckoning.ts), its keys in the same order; computeStandings
// gives the Throne to the realm of the largest tax base and the Vaultkeeper to the richest (the lowest seat on a tie,
// its king named, a figure of 0 vacant), and each hero's title to the highest living hero of a realm (the first found
// on a tie, a merit of 0 vacant); titleRaceFor reads each realm's figure from its row; creditBattle credits a battle
// ashore to the Grand Marshal's count and one at sea to the Sea Lord's (the winner gains the loser's losses, the loser
// is docked his own); and a fallen hero keeps content's share of each count of his merit, rounded.
// Level 1 (unit): the measures and the standings are functions of a hero and a world, and creditBattle and
// handleHeroDeath are called directly on the engine's modules on a world the engine makes; a static test can't run
// them, and the matrix's games may meet some of these never (a tie at the Throne, a fallen hero's negative merit).
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import {
  ALL_MAGIC_ITEMS_P,
  KC_THE_SHARE_OF_HIS_TITLE_MERIT_A_FALLEN_HERO_KEEPS,
  TITLE_DEFS,
} from '../../src/content/kingdoms-call-data.ts';
import { _skillItem, activeItems } from '../../src/engine/items/equipment.ts';
import { asItsGuardReadsIt } from '../../src/engine/rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { theDeedsABattlesMeritIsCreditedTo } from '../../src/engine/rules-on-plain-values/the-merit-a-hero-or-the-figure-a-realm-holds-an-imperial-title-by-as-its-row-measures-it.ts';
import { _MAGIC_SCHOOLS } from '../../src/engine/titles/perks.ts';
import { _charTitleMerit, computeStandings, titleRaceFor } from '../../src/engine/titles/reckoning.ts';
import {
  aFreshTurnsContextOnTheWorld,
  botWorld,
  loadTheEngineOnItsModules,
  quietEngineLog,
} from '../lib/the-middle-of-a-bot-world-in-a-turn-on-the-engines-modules.ts';

type Hero = Parameters<typeof _charTitleMerit>[0];
type World = Parameters<typeof computeStandings>[0];

/** _charTitleMerit as reckoning.ts wrote it before B-06n. */
function theOldMerit(c: Hero) {
  const tm: Partial<NonNullable<Hero['tm']>> = c.tm ?? {};
  const magic = _MAGIC_SCHOOLS.reduce((s, sc) => s + _skillItem(c, sc), 0);
  const schools: readonly (string | undefined)[] = _MAGIC_SCHOOLS;
  const spellItems = activeItems(c).filter((it) => schools.includes(asItsGuardReadsIt(it.effect)?.stat)).length;
  return {
    marshal: (Number(tm.marshal) || 0) + _skillItem(c, 'tactical'),
    sea: (Number(tm.sea) || 0) + _skillItem(c, 'naval'),
    monster: Number(tm.monster) || 0,
    lore: _skillItem(c, 'sage') + (Number(tm.discoveries) || 0),
    arch: magic + spellItems,
    hiero: _skillItem(c, 'white') + (Number(tm.holyCasts) || 0),
    necro: _skillItem(c, 'necromancy') + (Number(tm.darkCasts) || 0),
    spy: _skillItem(c, 'spy') + (Number(tm.spyActions) || 0),
    carto: _skillItem(c, 'explorer') + Math.floor((Number(tm.explored) || 0) / 10),
    beast: Number(tm.monsterHost) || 0,
    wild: Number(tm.wildHost) || 0,
  };
}

const SKILLS = [
  'tactical',
  'naval',
  'sage',
  'white',
  'psychic',
  'illusory',
  'elemental',
  'necromancy',
  'spy',
  'explorer',
  'melee',
];
const DEEDS = [
  'marshal',
  'sea',
  'monster',
  'holyCasts',
  'darkCasts',
  'featuresFound',
  'discoveries',
  'spyActions',
  'explored',
  'monsterHost',
  'wildHost',
] as const;
/** Items that raise a skill a title counts (a magic school's of every tier among them), and one that raises none. */
const ITEMS = ALL_MAGIC_ITEMS_P.filter((it) => {
  const stat: unknown = (it.effect as { stat?: unknown } | undefined)?.stat;
  return typeof stat === 'string' && SKILLS.includes(stat);
});
const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish'];

/** Made-up hero `k` of a fixed sequence (no dice: the same heroes every run): each skill missing, below nothing, past 9
 *  or in between; his deeds missing, none, negative or many (his mapped ground not in tens); his items none to five. */
function aHero(k: number): Hero {
  const at = (n: number, i: number) => (k * 7 + i * 13 + ((k * i) % 5)) % n;
  const skills: Record<string, number> = {};
  SKILLS.forEach((s, i) => {
    if (at(4, i) !== 0) skills[s] = at(13, i) - 2;
  });
  const tm: Partial<Record<(typeof DEEDS)[number], number>> = {};
  DEEDS.forEach((d, i) => {
    if (at(3, 20 + i) !== 0) tm[d] = at(57, 30 + i) - 9;
  });
  const items = Array.from({ length: at(6, 50) }, (_, j) => structuredClone(ITEMS[at(ITEMS.length, 51 + j)]));
  return {
    id: k,
    name: `Hero ${String(k)}`,
    player: at(3, 60),
    alive: true,
    isKing: false,
    race: RACES[at(RACES.length, 61)],
    ...(at(7, 62) === 0 ? {} : { skills }),
    ...(at(5, 63) === 0 ? {} : { tm }),
    ...(at(6, 64) === 0 ? {} : { items }),
  } as unknown as Hero; // (a made-up hero of the fields the measures read, standing in for the saved one)
}

test("each Imperial Title's measure of a hero is the old one's, in the same order, for every made-up hero", () => {
  expect(ITEMS.length).toBeGreaterThan(20);
  for (let k = 0; k < 3000; k++) {
    const hero = aHero(k);
    // (each measured on his own copy: reading a hero's items tidies them)
    expect(Object.entries(_charTitleMerit(structuredClone(hero))), `hero ${String(k)}`).toEqual(
      Object.entries(theOldMerit(structuredClone(hero))),
    );
  }
});

test("each kind of measure reads its own figures: a skill and the deeds, the Cartographer's in tens, the deeds alone, the schools", () => {
  const hero = {
    id: 1,
    name: 'Aldric',
    player: 0,
    alive: true,
    skills: { tactical: 3, naval: 12, sage: 2, white: 4, psychic: 1, necromancy: 1, spy: 5, explorer: 2 },
    tm: {
      marshal: -2,
      sea: 4,
      monster: 30,
      holyCasts: 2,
      darkCasts: 0,
      featuresFound: 6,
      discoveries: 3,
      spyActions: 1,
      explored: 39,
      monsterHost: 2,
      wildHost: 0,
    },
    items: [],
  } as unknown as Hero;
  expect(_charTitleMerit(hero)).toEqual({
    marshal: 1,
    sea: 13,
    monster: 30,
    lore: 5,
    arch: 6,
    hiero: 6,
    necro: 1,
    spy: 6,
    carto: 5,
    beast: 2,
    wild: 0,
  });
  const theItem = ITEMS.find((it) => (it.effect as { stat?: unknown }).stat === 'white');
  if (!theItem) throw new TypeError('no item raises White');
  const bonus = Number((theItem.effect as { bonus?: unknown }).bonus);
  expect(
    _charTitleMerit({ ...hero, items: [structuredClone(theItem)] } as unknown as Hero)['arch'],
    "an item that raises White: its levels, and one for the item, any tier (the Archmage's)",
  ).toBe(Math.min(9, 4 + bonus) + 1 + 0 + 0 + 1 + 1);
  expect(Object.keys(_charTitleMerit({ id: 2, player: 0, alive: true } as unknown as Hero))).toEqual(
    TITLE_DEFS.filter((t) => !t.kingdomLevel).map((t) => t.key),
  );
});

/** A made-up world: three realms, the heroes given, and provinces of the taxes and owners given. */
function aWorld(heroes: object[], provinces: [owner: number | null, tax: number][], gold: number[]): World {
  return {
    players: gold.map((g, i) => ({ name: `Realm ${String(i)}`, color: null, alignment: 'Neutral', gold: g })),
    characters: heroes,
    world: { provinces: provinces.map(([owner, tax]) => ({ owner, tax })) },
  } as unknown as World; // (a made-up world of the fields the standings read, standing in for the saved one)
}
const aRealmsHero = (id: number, player: number | null, more: object = {}) => ({
  id,
  name: `Hero ${String(id)}`,
  player,
  alive: true,
  isKing: false,
  skills: {},
  items: [],
  ...more,
});

test('the Throne and the Vaultkeeper: the largest figure, the lowest seat on a tie, its king named, a figure of 0 vacant', () => {
  const heroes = [aRealmsHero(10, 0, { isKing: true }), aRealmsHero(11, 1), aRealmsHero(12, 2, { isKing: true })];
  const st = computeStandings(
    aWorld(
      heroes,
      [
        [0, 4],
        [2, 7],
        [0, 3],
        [null, 5],
        [1, 2],
      ],
      [5, 9, 9],
    ),
  );
  expect(st.titles['throne'], 'a tie at 7: the lowest seat, its king named').toEqual({
    playerIndex: 0,
    charId: 10,
    merit: 7,
    prize: 20,
    name: 'The Throne',
  });
  expect(st.titles['vault'], 'a tie at 9: the lowest seat; a realm with no king named holds it with none').toEqual({
    playerIndex: 1,
    charId: null,
    merit: 9,
    prize: 10,
    name: 'The Vaultkeeper',
  });
  const poor = computeStandings(aWorld(heroes, [[0, 0]], [0, 0, 0]));
  expect([poor.titles['throne']?.playerIndex, poor.titles['vault']?.playerIndex], 'every figure 0: vacant').toEqual([
    null,
    null,
  ]);

  const race = titleRaceFor({ characters: heroes } as never, st, 2);
  expect(race['throne'], "realm 2's place: the holder's figure its own, in whole percent").toEqual({
    charName: 'Hero 12',
    vacant: false,
    mine: false,
    pct: 100,
    leadPct: null,
    unchallenged: false,
  });
  expect(race['vault']?.pct, "the Vaultkeeper's race reads the treasuries").toBe(100);
  const lead = titleRaceFor({ characters: heroes } as never, { ...st, taxByPlayer: [8, 2, 6] }, 0);
  expect(lead['throne'], "the holder's lead over the closest rival's tax base").toMatchObject({
    mine: true,
    pct: null,
    leadPct: 100 - Math.floor((6 / 7) * 100),
  });
  const noTreasuries = { ...st, goldByPlayer: undefined };
  expect(
    titleRaceFor({ characters: heroes } as never, noTreasuries, 0)['vault'],
    'standings with no treasuries: none',
  ).toMatchObject({ pct: 0, leadPct: null });
});

test("a hero's title: the highest living hero of a realm, the first found on a tie, a merit of 0 vacant", () => {
  const heroes = [
    aRealmsHero(20, 1, { skills: { tactical: 5 } }),
    aRealmsHero(21, 0, { skills: { tactical: 5, explorer: 1 }, tm: { explored: 19 } }),
    aRealmsHero(22, 2, { skills: { tactical: 9, explorer: 9 }, alive: false }),
    aRealmsHero(23, null, { skills: { tactical: 9 } }),
    aRealmsHero(24, 2, { skills: { explorer: 1 }, tm: { explored: 29 } }),
  ];
  const st = computeStandings(aWorld(heroes, [[0, 1]], [1, 1, 1]));
  expect(st.titles['marshal'], 'a tie at 5: the first found; the dead and a hero of no realm count for none').toEqual({
    playerIndex: 1,
    charId: 20,
    merit: 5,
    prize: 10,
    name: 'The Grand Marshal',
  });
  expect(st.titles['carto'], "the Cartographer's mapped ground in tens: 1 + 2 beats 1 + 1").toMatchObject({
    charId: 24,
    merit: 3,
  });
  expect(st.titles['monster'], 'no hero above 0: vacant').toEqual({
    playerIndex: null,
    charId: null,
    merit: 0,
    prize: 10,
    name: 'The Monster-Bane',
  });
});

test("a battle's merit: ashore the Grand Marshal's count, at sea the Sea Lord's; a title row that counts none fails", () => {
  expect(theDeedsABattlesMeritIsCreditedTo('on land')).toBe('marshal');
  expect(theDeedsABattlesMeritIsCreditedTo('at sea')).toBe('sea');
  expect(() => theDeedsABattlesMeritIsCreditedTo('at sea', TITLE_DEFS.slice(0, 3))).toThrow(
    'no Imperial Title counts the merit of a battle fought at sea',
  );
});

const engine = await loadTheEngineOnItsModules({ seed: 1 });
quietEngineLog(engine);
const tc = aFreshTurnsContextOnTheWorld(engine, botWorld(engine, 2, { cols: 10, rows: 6 }, { seaPct: 10 }));
// (the engine's own modules, fresh with it)
const { creditBattle } = await import('../../src/engine/titles/title-holders-and-battle-merit.ts');
const { handleHeroDeath } = await import('../../src/engine/heroes/hero-death-and-leaderless-hosts.ts');
type ACharacter = Parameters<typeof creditBattle>[1];
const counts = (more: object = {}) => ({
  marshal: 0,
  sea: 0,
  monster: 0,
  holyCasts: 0,
  darkCasts: 0,
  featuresFound: 0,
  discoveries: 0,
  spyActions: 0,
  explored: 0,
  monsterHost: 0,
  wildHost: 0,
  ...more,
});
const aFighter = (id: number, player: number) =>
  ({
    id,
    name: `Fighter ${String(id)}`,
    player,
    alive: true,
    armies: [],
    tm: counts(),
  }) as unknown as NonNullable<ACharacter>;

test('creditBattle: the winner gains the loser’s losses and the loser is docked his own, ashore and at sea', () => {
  const ashore = { id: 1, terrain: 'plains', owner: 1 } as never,
    atSea = { id: 2, terrain: 'sea', owner: null } as never;
  const a = aFighter(9301, 0),
    d = aFighter(9302, 1);
  creditBattle(tc as never, a, d, { won: true, atkLost: 2, defLost: 5 }, ashore);
  expect([a.tm?.marshal, d.tm?.marshal, a.tm?.sea, d.tm?.sea], 'won ashore').toEqual([5, -5, 0, 0]);
  creditBattle(tc as never, a, d, { won: false, atkLost: 3, defLost: 1 }, atSea);
  expect([a.tm?.marshal, d.tm?.marshal, a.tm?.sea, d.tm?.sea], 'lost at sea').toEqual([5, -5, -3, 3]);
  creditBattle(tc as never, a, null, { won: true, atkLost: 0, defLost: 4 }, null);
  expect(a.tm?.marshal, 'no province: ashore').toBe(9);
});

test("a fallen hero keeps content's share of each count of his merit, the Widowmaker's kills too, each rounded", () => {
  expect(KC_THE_SHARE_OF_HIS_TITLE_MERIT_A_FALLEN_HERO_KEEPS).toBe(0.75);
  const G = tc.G as unknown as { characters: object[]; world: { provinces: { id: number; terrain: string }[] } };
  const where = G.world.provinces.find((p) => p.terrain !== 'sea');
  if (!where) throw new TypeError('the world has no land');
  const fallen = {
    ...aFighter(9401, 0),
    hp: 0,
    maxHp: 15,
    race: 'Human',
    temper: 'Brave',
    skills: {},
    items: [],
    location: where.id,
    tm: counts({ marshal: 5, sea: -3, monster: 1, explored: 2, discoveries: 7, duelKills: 3 }),
  };
  G.characters = G.characters.concat([fallen]);
  handleHeroDeath(tc as never, fallen as never, null, { noSave: true });
  expect(fallen.alive).toBe(false);
  expect(fallen.tm).toEqual(counts({ marshal: 4, sea: -2, monster: 1, explored: 2, discoveries: 5, duelKills: 2 }));
});
