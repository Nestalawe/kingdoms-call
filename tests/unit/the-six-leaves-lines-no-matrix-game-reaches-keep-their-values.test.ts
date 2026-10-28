// The lines of the six files plan P1-10b5 freed of the ts-nocheck line (src/engine/battle/fortune.ts, grand-design.ts,
// names.ts, titles/perks.ts, world/map-helpers.ts, heroes/charms-and-neutrals.ts) that it changed to type them
// (statements that keep every value: P1-10b's Decision 2 and Choice 1) and that no game of the balance matrix reaches.
// The matrix proves the others (both sets, every realm's report identical); these are proved here, each on the value it
// had before (worked out by the files as they were, with their ts-nocheck line):
// - the Wonder's and the home province's reads on a realm or a state with a part missing (no realm, no discoveries, a
//   gap among them, a Wonder that is sited, no home province, no land, a home province with no column);
// - a spy who serves no realm, a march that leaves no figure, an item with no id, a hero with no pack;
// - an order that names no hero or a pre-order card, a charm read with no state;
// - a neutral hero's lesson when a hero has no skills or no name, or his teacher's province is missing;
// - Wraith's Touch (no matrix game raises Wraiths), a province's name lookup;
// - the names' fallbacks: an alignment, a category or a guardian the tables don't name, a name or a category that is
//   missing or '', the heroes' safety net once every name is taken, a lair's last resort, a map with a gap.
// Level 1 (unit): pure functions called directly on the engine's modules (plan P1-14a), with no turn played. None of
// them depends on the dice: a draw is from a list of one, or the dice are given.
import '../lib/the-whole-engine.ts';
import { afterEach, describe, expect, test } from 'vitest';
import { HERO_NAME_PARTS, LAIR_POOLS_CAT_P } from '../../src/content/kingdoms-call-data.ts';
import { gdActiveFor, homeProvinceIdFor, mapCentreColFor } from '../../src/engine/grand-design.ts';
import {
  _garrethEscapeLine,
  _pickUnusedNamePart,
  _toRoman,
  _usedHeroEpithets,
  _usedHeroFirsts,
  _usedHeroNames,
  ALL_HERO_EPITHETS,
  ALL_HERO_FIRSTS,
  lairBaseNameP,
  monsterCat,
  nextHeroName,
  pickLairNameP,
  renameLairsThematicP,
  seedUsedHeroNames,
} from '../../src/engine/names.ts';
import { creditMapped, itemKeyOf, noteEspionage, snapshotHeldItems } from '../../src/engine/titles/perks.ts';
import { theWordsOfTheWanderersEscape } from '../../src/views/prose/the-words-of-the-wanderers-escape.ts';
import {
  isCharmedNow,
  isPreOrderRef,
  orderCharRef,
  progressNeutralHeroes,
} from '../../src/engine/heroes/charms-and-neutrals.ts';
import { applyWraithTouch, provName } from '../../src/engine/world/map-helpers.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';

/** A unit, as a force holds it. */
const unit = (quality: string, extra: Record<string, unknown> = {}) => ({
  type: 'Shieldwall Levies',
  quality,
  race: 'Human',
  unitName: `the ${quality} Levies`,
  ...extra,
});
/** A hero's title-merit counters, all at zero. */
const counters = () => ({
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
});

describe("the Wonder's and the home province's reads, on a realm or a state with a part missing", () => {
  test('gdActiveFor: no state or realm, no discoveries or a gap among them, and a Wonder that is sited', () => {
    expect(gdActiveFor(null, 0, undefined)).toBe(false);
    expect(gdActiveFor({ players: [] }, 0, undefined)).toBe(false);
    expect(gdActiveFor({ players: [{}] }, 0, undefined)).toBe(false);
    expect(gdActiveFor({ players: [{ discoveries: [null] }] }, 0, undefined)).toBe(false);
    expect(gdActiveFor({ players: [{ discoveries: [null, { id: 'gd' }] }] }, 0, undefined)).toBe(true);
    const sited = (owner: number | null, world = true) => ({
      players: [{ discoveries: [{ id: 'gd' }], gdProvinceId: 1 }],
      ...(world
        ? {
            world: {
              provinces: [
                { id: 0, tax: 1, owner: 0 },
                { id: 1, tax: 1, owner },
              ],
            },
          }
        : {}),
    });
    expect(gdActiveFor(sited(0), 0, undefined)).toBe(true);
    expect(gdActiveFor(sited(1), 0, undefined)).toBe(false);
    expect(gdActiveFor(sited(0, false), 0, undefined)).toBe(false);
  });
  test('homeProvinceIdFor: no home province yet, from the first land held, or else the king, then frozen', () => {
    const byLand = { players: [{ provinces: [5, 6] }] };
    expect(homeProvinceIdFor(byLand, 0)).toBe(5);
    expect(byLand.players[0]).toEqual({ provinces: [5, 6], homeProvinceId: 5 });
    const byKing = {
      players: [{ provinces: [] }],
      characters: [
        { player: 0, isKing: false, location: 3 },
        { player: 0, isKing: true, location: 7 },
      ],
    };
    expect(homeProvinceIdFor(byKing, 0)).toBe(7);
    expect(byKing.players[0]).toEqual({ provinces: [], homeProvinceId: 7 });
    const nowhere = { players: [{ provinces: [] }] };
    expect(homeProvinceIdFor(nowhere, 0)).toBe(null);
    expect(nowhere.players[0]).toEqual({ provinces: [] });
    expect(homeProvinceIdFor({}, 0)).toBe(null);
  });
  test('mapCentreColFor: a home province with no column, or none on the map', () => {
    expect(mapCentreColFor({ players: [{ homeProvinceId: 0 }], world: { provinces: [{ id: 0, tax: 1 }] } }, 0)).toBe(
      null,
    );
    expect(mapCentreColFor({ players: [{ homeProvinceId: 4 }], world: { provinces: [] } }, 0)).toBe(null);
    expect(
      mapCentreColFor({ players: [{ homeProvinceId: 0 }], world: { provinces: [{ id: 0, tax: 1, col: 3 }] } }, 0),
    ).toBe(3);
  });
});

describe("the title merit's and the item photograph's reads", () => {
  test('noteEspionage: an agent who serves no realm is noted by null, and the ledger is begun', () => {
    const G: NonNullable<Parameters<typeof noteEspionage>[0]> = {};
    noteEspionage(G, { player: null, id: 4, name: 'Vesta the Grey' }, 2, 'spied out the province');
    expect(G._espionageLedger).toEqual([
      { byPi: null, charId: 4, charName: 'Vesta the Grey', isKing: false, provId: 2, kind: 'spied out the province' },
    ]);
  });
  test('creditMapped: a march that leaves no figure, or one that is not a number, adds nothing', () => {
    const c = { tm: counters() };
    creditMapped(c, undefined, 30);
    expect(c.tm.explored).toBe(30);
    creditMapped(c, 20, undefined);
    creditMapped(c, 0, null);
    creditMapped(c, 0, NaN);
    expect(c.tm.explored).toBe(30);
  });
  test('itemKeyOf: by id where there is one, else by name, else the bare mark', () => {
    expect(itemKeyOf({ id: 0, name: 'Sword' })).toBe('#0');
    expect(itemKeyOf({ name: 'Sword' })).toBe('@Sword');
    expect(itemKeyOf({})).toBe('@');
    expect(itemKeyOf(null)).toBe('@');
  });
  test('snapshotHeldItems: a hero with no pack holds nothing; a gap in a pack is skipped', () => {
    const gs = {
      characters: [null, { items: null }, {}, { items: [null, { id: 3, name: 'Ring' }, { name: 'Cloak' }] }],
    };
    snapshotHeldItems(gs);
    expect(gs.characters.slice(1)).toEqual([
      { items: null, _itemsAtTurnStart: [] },
      { _itemsAtTurnStart: [] },
      { items: [null, { id: 3, name: 'Ring' }, { name: 'Cloak' }], _itemsAtTurnStart: ['#3', '@Cloak'] },
    ]);
  });
});

describe('an order that names a hero, and a charm read with no state', () => {
  const G = { characters: [null, { id: 2, name: 'Odric' }, { id: 7, name: 'Morwen' }] };
  test('isPreOrderRef and orderCharRef: no name, a pre-order card, a plain id, a hero not there', () => {
    expect(isPreOrderRef(null)).toBe(false);
    expect(isPreOrderRef(undefined)).toBe(false);
    expect(isPreOrderRef(' hired_2_via_9_ph1 ')).toBe(true);
    expect(orderCharRef(G, null)).toBe(null);
    expect(orderCharRef(G, undefined)).toBe(null);
    expect(orderCharRef(G, 'resurrect_7_via_9_ph2')?.name).toBe('Morwen');
    expect(orderCharRef(G, ' 2 ')?.name).toBe('Odric');
    expect(orderCharRef(G, 5)).toBe(null);
    expect(orderCharRef(null, 2)).toBe(null);
  });
  test('isCharmedNow: with no state, a hero with no charm turn is charmed when the state is undefined, as it was', () => {
    expect(isCharmedNow(null, {})).toBe(false);
    expect(isCharmedNow(undefined, {})).toBe(true);
    expect(isCharmedNow(undefined, { _charmedTurn: 3 })).toBe(false);
    expect(isCharmedNow({ turn: 3 }, { _charmedTurn: 3 })).toBe(true);
  });
});

describe("a neutral hero's lesson, on heroes with parts missing", () => {
  // Dice that always roll 0: the idle roll lands, the first of each list is picked, and the best skill is chosen.
  const zero = () => 0;
  const world = (provinces: { id: number; row: number; col: number; name: string }[]) => ({
    rows: 2,
    cols: 2,
    provinces,
  });
  const plain = [
    { id: 0, row: 0, col: 0, name: 'Karnholt' },
    { id: 1, row: 0, col: 1, name: 'Runedrift' },
  ];
  test('a hero with no skills is given none and learns nothing alone; a teacher with no skills teaches nothing', () => {
    const alone = { id: 1, alive: true, player: null, location: 0 };
    const gs = { turn: 5, characters: [alone, { id: 2, alive: true, player: null, location: 0 }], world: world(plain) };
    expect(progressNeutralHeroes(gs, null, zero)).toEqual([]);
    expect(alone).toEqual({ id: 1, alive: true, player: null, location: 0, skills: {} });
  });
  test("the lesson's line: a hero and a teacher with no name, a teacher whose province is missing", () => {
    const lines: [string, unknown][] = [];
    const gs = {
      turn: 5,
      characters: [
        { id: 1, alive: true, player: null, location: 9, skills: { melee: 1 } },
        { id: 2, alive: true, player: null, location: 9, skills: { archery: 3 } },
      ],
      world: world(plain),
    };
    const gains = progressNeutralHeroes(gs, (line, where) => lines.push([line, where]), zero);
    // each learns the other's best skill, from the start-of-sweep levels
    expect(gains).toEqual([
      { id: 1, skill: 'archery', from: 0, to: 1, teacher: 2, nearby: false },
      { id: 2, skill: 'melee', from: 0, to: 1, teacher: 1, nearby: false },
    ]);
    expect(lines).toEqual([
      ['📜  learns from  — Archery rises to 1.', undefined],
      ['📜  learns from  — Melee rises to 1.', undefined],
    ]);
  });
  test('a teacher one province away, named, in a province that is there', () => {
    const lines: string[] = [];
    const gs = {
      turn: 6,
      characters: [
        { id: 1, name: 'Ilsa (wandering)', alive: true, player: null, location: 0, skills: { melee: 1 } },
        { id: 2, name: 'Bram', alive: true, player: null, location: 1, skills: { sage: 2 } },
      ],
      world: world(plain),
    };
    progressNeutralHeroes(gs, (line) => lines.push(line), zero);
    expect(lines).toEqual([
      '📜 Ilsa in Karnholt rides out to Bram in Runedrift to learn — Sage rises to 1.',
      '📜 Bram in Runedrift rides out to Ilsa in Karnholt to learn — Melee rises to 1.',
    ]);
  });
  test("a teacher one province away, on ground the map's list doesn't hold: his line names no province", () => {
    const lines: string[] = [];
    const gs = {
      turn: 5,
      characters: [
        { id: 1, name: 'Ilsa', alive: true, player: null, location: 0, skills: { melee: 1 } },
        { id: 2, name: 'Bram', alive: true, player: null, location: 2, skills: { sage: 2 } },
      ],
      world: world(plain),
    };
    progressNeutralHeroes(gs, (line) => lines.push(line), zero);
    expect(lines).toEqual([
      '📜 Ilsa in Karnholt rides out to Bram to learn — Sage rises to 1.',
      '📜 Bram hones their craft — Sage rises to 3.',
    ]);
  });
});

describe("Wraith's Touch, and a province's name by id", () => {
  test("the enemy's best unit is set back one tier, and the force's line says so", () => {
    const narr: NarrativeLine[] = [];
    const enemy = [null, unit('Green'), unit('Veteran'), unit('Elite')];
    applyWraithTouch([unit('Elite', { _isWraith: true })], enemy, narr);
    expect(enemy.map((a) => a?.quality)).toEqual([undefined, 'Green', 'Veteran', 'Crack']);
    expect(narr).toEqual(["  ☠ Wraith's Touch withers the Elite Levies — permanently reduced from Elite to Crack."]);
  });
  test('no wraith, or no enemy above Green: nothing happens', () => {
    const narr: NarrativeLine[] = [];
    const greens = [unit('Green'), null];
    applyWraithTouch([unit('Elite'), null], [unit('Elite')], narr);
    applyWraithTouch([unit('Elite', { _isWraith: true })], greens, narr);
    expect(narr).toEqual([]);
    expect(greens).toEqual([unit('Green'), null]);
  });
  test("provName: a province's name, or 'unknown' where it has none or isn't there", () => {
    const tc = { G: { world: { provinces: [{ name: '' }, { name: 'Karnholt' }] } } };
    const of = (id: number) => provName(tc as unknown as TurnContext, id); // provName reads only the world's provinces
    expect([of(0), of(1), of(5)]).toEqual(['unknown', 'Karnholt', 'unknown']);
  });
});

describe("the names' fallbacks", () => {
  afterEach(() => {
    seedUsedHeroNames({ characters: [] });
  });
  test('_pickUnusedNamePart with no preferred pool draws from the master list', () => {
    expect(_pickUnusedNamePart(null, ['Aldwin', 'Brenna'], new Set(['Aldwin']))).toBe('Brenna');
    expect(_pickUnusedNamePart(undefined, ['Aldwin'], new Set(['Aldwin']))).toBe(null);
  });
  test("Garreth's escape names him, or 'The wanderer' where he has no name", () => {
    // The escape is a fact since plan P1-12d5: its words are the prose's.
    const words = (ch: { name?: string } | null) => theWordsOfTheWanderersEscape(_garrethEscapeLine(ch));
    expect(words(null).startsWith('\u{1F340} The wanderer ')).toBe(true);
    expect(words({ name: '' }).startsWith('\u{1F340} The wanderer ')).toBe(true);
    expect(words({ name: 'Garreth' }).startsWith('\u{1F340} Garreth ')).toBe(true);
  });
  test('_toRoman, past its tables too', () => {
    expect([2, 14, 1999, 4000].map(_toRoman)).toEqual(['II', 'XIV', 'XCMXCIX', 'undefined']);
  });
  test('nextHeroName: an alignment the table does not name draws from the Neutral pools', () => {
    const [lastFirst, ...otherFirsts] = [...HERO_NAME_PARTS.Neutral.firsts].reverse();
    const [lastEpithet, ...otherEpithets] = [...HERO_NAME_PARTS.Neutral.epithets].reverse();
    otherFirsts.forEach((x) => _usedHeroFirsts.add(x));
    otherEpithets.forEach((x) => _usedHeroEpithets.add(x));
    expect(nextHeroName('Starborn')).toBe(`${String(lastFirst)} ${String(lastEpithet)}`);
  });
  test('nextHeroName: once every given name and descriptor is taken, a numbered one, then a numbered name', () => {
    ALL_HERO_FIRSTS.forEach((x) => _usedHeroFirsts.add(x));
    ALL_HERO_EPITHETS.forEach((x) => _usedHeroEpithets.add(x));
    const f = String(ALL_HERO_FIRSTS[0]),
      e = String(ALL_HERO_EPITHETS[0]);
    _usedHeroNames.add(`${f} II ${e} II`);
    expect(nextHeroName('Neutral')).toBe(`${f} II ${e} II II`);
    expect(nextHeroName('Neutral')).toBe(`${f} III ${e} III`);
  });
  test('lairBaseNameP with no name, or a numbered, place-qualified one', () => {
    expect(lairBaseNameP(null, 'Karnholt')).toBe('');
    expect(lairBaseNameP(undefined, null)).toBe('');
    expect(lairBaseNameP('Wolf Den beneath Karnholt (2)', 'Karnholt')).toBe('Wolf Den');
  });
  test("pickLairNameP: no guardian, a category that is '' or the tables don't name, read the beasts' names", () => {
    const first = LAIR_POOLS_CAT_P.beast.land[0];
    for (const monster of [null, undefined, {}, { cat: '' }, { cat: null }, { cat: 'starborn' }, { cat: 'beast' }])
      expect(pickLairNameP(monster, 'plain', new Set(), 'Karnholt', () => 0, null)).toBe(first);
    expect(pickLairNameP({ cat: 'starborn' }, 'sea', new Set(), 'Karnholt', () => 0)).toBe(
      LAIR_POOLS_CAT_P.beast.sea[0],
    );
  });
  test("pickLairNameP's last resort: every name taken and no province named, a number", () => {
    const every = new Set(Object.values(LAIR_POOLS_CAT_P).flatMap((p) => p.land));
    const first = String(LAIR_POOLS_CAT_P.beast.land[0]);
    expect(pickLairNameP(null, 'plain', new Set(every), null, () => 0, every)).toBe(`${first} (2)`);
    expect(pickLairNameP(null, 'plain', new Set([...every, `${first} (2)`]), null, () => 0, every)).toBe(
      `${first} (3)`,
    );
    expect(pickLairNameP(null, 'plain', new Set(every), 'Karnholt', () => 0, every)).toBe(`${first} of Karnholt`);
  });
  test('renameLairsThematicP: no state or world, a map that is not a list, and a gap in the map', () => {
    expect(renameLairsThematicP(null)).toBe(0);
    expect(renameLairsThematicP({ world: null })).toBe(0);
    expect(renameLairsThematicP({ world: {} })).toBe(0);
    const gs = {
      world: {
        provinces: [
          null,
          { name: 'Karnholt', terrain: 'plain', features: [null, { name: 'Old Den', monster: { cat: 'beast' } }] },
        ],
      },
    };
    expect(renameLairsThematicP(gs)).toBe(1);
    expect(gs).toMatchObject({ _lairNamesV2: true, _lairNamesV3: true });
    expect(LAIR_POOLS_CAT_P.beast.land).toContain(gs.world.provinces[1]?.features[1]?.name);
  });
  test("monsterCat: a guardian with no category, by its name, or 'beast' with no name", () => {
    expect(monsterCat({ name: 'Ancient Lich' })).toBe('undead');
    expect(monsterCat({ cat: '', name: 'Hill Giant' })).toBe('giant');
    expect([monsterCat({}), monsterCat(null), monsterCat(undefined), monsterCat({ cat: '' })]).toEqual(
      Array(4).fill('beast'),
    );
  });
});
