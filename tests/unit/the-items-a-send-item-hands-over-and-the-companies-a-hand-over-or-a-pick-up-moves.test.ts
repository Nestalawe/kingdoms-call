// What a hero holds, on plain values (plan P1-11e14 moved these rules out of the item orders' Send Item and the army
// orders' Leave/Transfer and Pick Up, so the order form's forecast of what a hero will hold can ask the same rules):
// the places in his pack a Send Item hands over (highest first) and the Mithril suit that stays; whether risen dead
// follow a hand-over, and where they go if not; which companies a leader takes under his beast command's room; the
// places in a garrison a Pick Up takes ("all" and "g:N", the last first).
//
// Level 1 (unit): the functions of
// src/engine/rules-on-plain-values/the-items-a-send-item-hands-over-and-the-companies-a-hand-over-or-a-pick-up-moves.ts
// on made-up packs, columns and garrisons. A lower level can't run a function. A fault planted in a shared function
// moves every caller at once, so these cases pin its answers; tests/unit/item-and-army-orders-called-directly.test.ts
// checks the orders that call them (in the vm), and the balance matrix the orders the bots give.
import { describe, expect, test } from 'vitest';
import { unitAsItsRealmSeesIt } from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import {
  anItemIsTheMithrilSuitGrantedToItsWearer,
  theCompaniesALeaderTakesUpToHisBeastCommandsRoom,
  theGarrisonPlacesAPickUpTakes,
  theItemsASendItemOrderHandsOver,
  theRisenDeadFollowAHandOverTo,
  whereAHandOversRisenDeadGo,
} from '../../src/engine/rules-on-plain-values/the-items-a-send-item-hands-over-and-the-companies-a-hand-over-or-a-pick-up-moves.ts';

const sword = { id: 11, name: 'Sword of Embers', effect: { stat: 'armyBonus' } };
const ring = { id: 12, name: '3 Rings of Dawn', effect: { stat: 'infBonus' } };
const cloak = { id: 13, name: 'Travelworn Drape', effect: null };
const mithril = { id: 14, name: 'Mithril Armour', effect: { stat: 'mithrilArmour' } };

describe('the Mithril suit, granted to its wearer', () => {
  test('an item whose effect carries the mithril-armour row’s key is the suit, by its effect and not its name', () => {
    expect(anItemIsTheMithrilSuitGrantedToItsWearer(mithril)).toBe(true);
    expect(anItemIsTheMithrilSuitGrantedToItsWearer({ name: 'Mithril Armour', effect: { stat: 'armyBonus' } })).toBe(
      false,
    );
    expect(anItemIsTheMithrilSuitGrantedToItsWearer(sword)).toBe(false);
    expect(anItemIsTheMithrilSuitGrantedToItsWearer(cloak)).toBe(false);
    expect(anItemIsTheMithrilSuitGrantedToItsWearer({ name: 'A plain stone' })).toBe(false);
    expect(anItemIsTheMithrilSuitGrantedToItsWearer(null)).toBe(false);
    expect(anItemIsTheMithrilSuitGrantedToItsWearer(undefined)).toBe(false);
  });
});

describe('the items a Send Item order hands over', () => {
  const pack = [sword, ring, cloak];
  const places = (held: Parameters<typeof theItemsASendItemOrderHandsOver>[0], target: string | number | null) =>
    theItemsASendItemOrderHandsOver(held, target).places;

  test('“all”, whatever its case and spaces, names every item, the highest place first', () => {
    expect(places(pack, 'all')).toEqual([2, 1, 0]);
    expect(places(pack, '  ALL ')).toEqual([2, 1, 0]);
    expect(places([], 'all')).toEqual([]);
  });

  test('places in the pack, each once, the highest first; a place out of the pack names none', () => {
    expect(places(pack, '0,2')).toEqual([2, 0]);
    expect(places(pack, ' 2 , 0 ,, 1 ')).toEqual([2, 1, 0]);
    expect(places(pack, '1,1')).toEqual([1]);
    expect(places(pack, '3')).toEqual([]);
    expect(places(pack, '-1')).toEqual([]);
    // the pack's length is past its last place: such a token names an item by its id
    expect(places([sword, ring, { id: 2, name: 'Horn' }, { id: 4, name: 'Orb' }], '4')).toEqual([3]);
  });

  test('an item’s id or name names it where no place does; a name that begins with a number is a name', () => {
    expect(places(pack, '13')).toEqual([2]);
    expect(places(pack, 'Sword of Embers')).toEqual([0]);
    expect(places(pack, '3 Rings of Dawn')).toEqual([1]);
    expect(places(pack, '12,0')).toEqual([1, 0]);
    expect(places(pack, '1,12')).toEqual([1]);
    expect(places(pack, 'no such item')).toEqual([]);
  });

  test('a place in range is a place, even where another item has that number for its id', () => {
    const numbered = [
      { id: 2, name: 'Orb' },
      { id: 0, name: 'Wand' },
      { id: 1, name: 'Horn' },
    ];
    expect(places(numbered, '2')).toEqual([2]);
    expect(places(numbered, '0')).toEqual([0]);
  });

  test('a gap in the pack is no item: a name or id passes over it', () => {
    expect(places([null, sword, undefined, ring], 'Sword of Embers,12')).toEqual([3, 1]);
    expect(places([null, sword], '0')).toEqual([0]);
  });

  test('no target, an empty one, or a number 0 (an older save’s) names nothing; another number is a place', () => {
    expect(places(pack, null)).toEqual([]);
    expect(places(pack, '')).toEqual([]);
    expect(places(pack, 0)).toEqual([]);
    expect(places(pack, 2)).toEqual([2]);
  });

  test('a Mithril suit named stays with its wearer, and says so; the rest are handed over', () => {
    const suited = [sword, mithril, ring];
    expect(theItemsASendItemOrderHandsOver(suited, 'all')).toEqual({ places: [2, 0], theMithrilSuitStays: true });
    expect(theItemsASendItemOrderHandsOver(suited, '1')).toEqual({ places: [], theMithrilSuitStays: true });
    expect(theItemsASendItemOrderHandsOver(suited, 'Mithril Armour,0')).toEqual({
      places: [0],
      theMithrilSuitStays: true,
    });
    expect(theItemsASendItemOrderHandsOver(suited, '0,2')).toEqual({ places: [2, 0], theMithrilSuitStays: false });
    expect(theItemsASendItemOrderHandsOver(pack, 'all')).toEqual({ places: [2, 1, 0], theMithrilSuitStays: false });
  });
});

describe('whether risen dead follow a hand-over', () => {
  test('into a garrison always; to a comrade who is Undead or serves an Undead realm; to no other', () => {
    expect(theRisenDeadFollowAHandOverTo(null)).toBe(true);
    expect(theRisenDeadFollowAHandOverTo({ alignment: 'Undead', hisRealmsAlignment: 'Good' })).toBe(true);
    expect(theRisenDeadFollowAHandOverTo({ alignment: 'Neutral', hisRealmsAlignment: 'Undead' })).toBe(true);
    expect(theRisenDeadFollowAHandOverTo({ alignment: 'Evil', hisRealmsAlignment: 'Evil' })).toBe(false);
    expect(theRisenDeadFollowAHandOverTo({ alignment: undefined, hisRealmsAlignment: null })).toBe(false);
  });
});

describe('where a hand-over’s risen dead go', () => {
  const foot = { type: 'Infantry' };
  const bones = { type: 'Infantry', _isSkeletal: true };
  const horse = { type: 'Cavalry' };
  const moreBones = { type: 'Archers', _isSkeletal: true };

  test('where they refuse to follow, the skeletal companies go to their graves, the rest handed, in their order', () => {
    const r = whereAHandOversRisenDeadGo([foot, bones, horse, moreBones], false, unitAsItsRealmSeesIt);
    expect(r.handed).toEqual([foot, horse]);
    expect(r.handed[1]).toBe(horse);
    expect(r.toTheirGraves).toEqual([bones, moreBones]);
    expect(r.toTheirGraves[0]).toBe(bones);
  });

  test('where they follow, every company is handed and none goes to its grave', () => {
    const r = whereAHandOversRisenDeadGo([foot, bones, horse], true, unitAsItsRealmSeesIt);
    expect(r.handed).toEqual([foot, bones, horse]);
    expect(r.toTheirGraves).toEqual([]);
  });

  test('with no risen dead, every company is handed, whoever takes them', () => {
    expect(whereAHandOversRisenDeadGo([foot, horse], false, unitAsItsRealmSeesIt)).toEqual({
      handed: [foot, horse],
      toTheirGraves: [],
    });
    expect(whereAHandOversRisenDeadGo([bones], false, unitAsItsRealmSeesIt)).toEqual({
      handed: [],
      toTheirGraves: [bones],
    });
  });

  test('a company is read as its realm sees it: the report’s skeletal mark, through the identity', () => {
    const seen = { type: 'Infantry', skeletal: true };
    expect(whereAHandOversRisenDeadGo([seen, foot], false, (a) => a).toTheirGraves).toEqual([seen]);
  });
});

describe('the companies a leader takes up to his beast command’s room', () => {
  const birds = { type: 'Thunderbirds' };
  const ents = { type: 'Forest Ents' };
  const trolls = { type: 'Cave Trolls' };
  const foot = { type: 'Infantry' };
  const deadBirds = { type: 'Thunderbirds', _isSkeletal: true };
  const grove = { type: 'Forest Ents', _temporary: true };
  const hunt = { type: 'Thunderbirds', _wildHuntUntilTurn: 9 };
  const takes = (joining: readonly object[], room: number) =>
    theCompaniesALeaderTakesUpToHisBeastCommandsRoom(
      joining.map((a) => ({ type: 'Infantry', ...a })),
      room,
      unitAsItsRealmSeesIt,
    );
  const types = (r: { readonly taken: readonly { type: string }[]; readonly left: readonly { type: string }[] }) => ({
    taken: r.taken.map((a) => a.type),
    left: r.left.map((a) => a.type),
  });

  test('beasts in their order while the room lasts; past it they are left; other companies always taken', () => {
    expect(types(takes([birds, foot, ents, trolls], 1))).toEqual({
      taken: ['Thunderbirds', 'Infantry'],
      left: ['Forest Ents', 'Cave Trolls'],
    });
    expect(types(takes([birds, foot, ents, trolls], 2))).toEqual({
      taken: ['Thunderbirds', 'Infantry', 'Forest Ents'],
      left: ['Cave Trolls'],
    });
    expect(types(takes([birds, foot, ents, trolls], 0))).toEqual({
      taken: ['Infantry'],
      left: ['Thunderbirds', 'Forest Ents', 'Cave Trolls'],
    });
  });

  test('a leader of no realm (room without end) takes every beast; with room to spare, all are taken', () => {
    expect(types(takes([birds, ents, trolls], Infinity)).left).toEqual([]);
    expect(types(takes([birds, ents], 5))).toEqual({ taken: ['Thunderbirds', 'Forest Ents'], left: [] });
  });

  test('the dead, a summoned grove and Wild Hunt beasts take no room', () => {
    expect(types(takes([deadBirds, grove, hunt, birds], 1))).toEqual({
      taken: ['Thunderbirds', 'Forest Ents', 'Thunderbirds', 'Thunderbirds'],
      left: [],
    });
    expect(types(takes([deadBirds, birds, ents], 1))).toEqual({
      taken: ['Thunderbirds', 'Thunderbirds'],
      left: ['Forest Ents'],
    });
  });

  test('each company comes back as it came, the joining list untouched', () => {
    const joining = [birds, foot, ents];
    const r = theCompaniesALeaderTakesUpToHisBeastCommandsRoom(joining, 1, unitAsItsRealmSeesIt);
    expect(r.taken[0]).toBe(birds);
    expect(r.taken[1]).toBe(foot);
    expect(r.left[0]).toBe(ents);
    expect(joining).toEqual([birds, foot, ents]);
  });
});

describe('the places in a garrison a Pick Up takes', () => {
  test('“all”, whatever its case and spaces, takes every company, the last first', () => {
    expect(theGarrisonPlacesAPickUpTakes('all', 3)).toEqual([2, 1, 0]);
    expect(theGarrisonPlacesAPickUpTakes(' All ', 4)).toEqual([3, 2, 1, 0]);
    expect(theGarrisonPlacesAPickUpTakes('all', 1)).toEqual([0]);
    expect(theGarrisonPlacesAPickUpTakes('all', 0)).toEqual([]);
  });

  test('each “g:N” a place in the garrison, once, the highest first', () => {
    expect(theGarrisonPlacesAPickUpTakes('g:0,g:2', 3)).toEqual([2, 0]);
    expect(theGarrisonPlacesAPickUpTakes('g:1,g:0,g:2', 3)).toEqual([2, 1, 0]);
    expect(theGarrisonPlacesAPickUpTakes('g:2,g:0,g:2', 3)).toEqual([2, 0]);
    expect(theGarrisonPlacesAPickUpTakes('G:1', 3)).toEqual([1]);
    expect(theGarrisonPlacesAPickUpTakes(' g:1 , ,g:0 ', 3)).toEqual([1, 0]);
  });

  test('a place out of the garrison, or a token that is not “g:N”, names none', () => {
    expect(theGarrisonPlacesAPickUpTakes('g:3,g:1', 3)).toEqual([1]);
    expect(theGarrisonPlacesAPickUpTakes('g:5', 3)).toEqual([]);
    expect(theGarrisonPlacesAPickUpTakes('g:0', 0)).toEqual([]);
    expect(theGarrisonPlacesAPickUpTakes('g:-1,g:x,1,merc:0,g:1:2', 3)).toEqual([]);
    expect(theGarrisonPlacesAPickUpTakes('g:0,2', 3)).toEqual([0]);
  });
});
