// What a hero holds, on plain values (plan P1-11e15 moved these rules beside countsAgainstBeastCommand, so the order
// form's forecast of what a hero will hold can ask the same rules): the room a leader's beast command leaves (his
// Druid less the beasts he leads, never below none); where a company a Recruit Armies order raises or hires musters
// (the garrison, the garrison because the column it would join is full, or the column); and whether a mercenary band
// of beasts is not hired into a full column.
//
// Level 1 (unit): the functions of src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts
// on made-up columns and companies, and the engine's beastCommandRoom that asks the first. A lower level can't run a
// function. A fault planted in a shared function moves every caller at once, so these cases pin its answers;
// tests/scenario/recruit-hire-and-realm-works-orders-in-a-whole-turn.test.ts checks the Recruit Armies order that
// calls them, and the balance matrix the orders the bots give.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  aMercenaryBandIsNotHiredIntoAFullColumn,
  theRoomALeadersBeastCommandLeaves,
  unitAsItsRealmSeesIt,
  whereARecruitedCompanyMusters,
  type AUnitAsItsRealmSeesIt,
  type AUnitAsTheEngineHoldsIt,
} from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import { beastCommandRoom } from '../../src/engine/world/tables.ts';

const birds = { type: 'Thunderbirds' };
const ents = { type: 'Forest Ents' };
const trolls = { type: 'Cave Trolls' };
const foot = { type: 'Infantry' };
const deadBirds = { type: 'Thunderbirds', _isSkeletal: true };
const grove = { type: 'Forest Ents', _temporary: true };
const hunt = { type: 'Thunderbirds', _wildHuntUntilTurn: 9 };
const phantom = { type: 'Cave Trolls', _phantom: true };
type AGapOrACompany = AUnitAsTheEngineHoldsIt | null | undefined;
const seen = (a: AGapOrACompany) => a && unitAsItsRealmSeesIt(a);

describe('the room a leader’s beast command leaves', () => {
  const room = (druid: number, column: readonly AGapOrACompany[]) =>
    theRoomALeadersBeastCommandLeaves(druid, column, seen);

  test('his Druid less the beasts he leads; other companies take none', () => {
    expect(room(3, [birds, foot])).toBe(2);
    expect(room(3, [birds, ents, foot])).toBe(1);
    expect(room(3, [birds, ents, trolls, foot])).toBe(0);
    expect(room(5, [foot, foot])).toBe(5);
    expect(room(4, [])).toBe(4);
  });

  test('never below none: a leader over his command, or of Druid 0, has no room', () => {
    expect(room(2, [birds, ents, trolls])).toBe(0);
    expect(room(0, [birds])).toBe(0);
    expect(room(0, [])).toBe(0);
  });

  test('the dead, a summoned grove, Wild Hunt beasts, a phantom and a gap among his companies take no room', () => {
    expect(room(1, [deadBirds, grove, hunt, phantom, null, undefined])).toBe(1);
    expect(room(2, [deadBirds, birds, grove])).toBe(1);
  });

  test('each company is read as its realm sees it, through the reading handed in', () => {
    const asSeen: AUnitAsItsRealmSeesIt[] = [{ type: 'Thunderbirds', skeletal: true }, { type: 'Forest Ents' }];
    expect(theRoomALeadersBeastCommandLeaves(2, asSeen, (a) => a)).toBe(1);
    // the reading decides: the same column read as all beasts, or as none
    expect(theRoomALeadersBeastCommandLeaves(2, [foot, foot], () => ({ type: 'Cave Trolls' }))).toBe(0);
    expect(theRoomALeadersBeastCommandLeaves(2, [birds, ents], () => null)).toBe(2);
  });

  test('the engine’s beastCommandRoom: a hero of no realm has room without end; a realm’s hero, his Druid less his beasts', () => {
    const hero = (player: number | null, druid: number, armies: AGapOrACompany[]) => ({
      id: 1,
      name: 'Arlen of the Fens',
      alive: true,
      player,
      location: 4,
      skills: { druid },
      armies,
    });
    expect(beastCommandRoom(hero(null, 0, [birds, ents]), [])).toBe(Infinity);
    expect(beastCommandRoom(null, [])).toBe(Infinity);
    expect(beastCommandRoom(hero(0, 3, [birds, foot, deadBirds, null]), [])).toBe(2);
    expect(beastCommandRoom(hero(0, 1, [birds, ents]), [])).toBe(0);
    // Druid counts to 9 (the whole skill): a trained Druid 7 leading two beasts has room for five
    expect(beastCommandRoom(hero(0, 7, [birds, ents]), [])).toBe(5);
    // a hero with no companies, and no heroes handed to read an aura beside: his Druid alone
    expect(beastCommandRoom({ ...hero(0, 3, []), armies: undefined }, undefined)).toBe(3);
    expect(beastCommandRoom({ ...hero(0, 2, [birds]), armies: null }, null)).toBe(2);
  });
});

describe('where a recruited company musters', () => {
  const musters = (
    over: Partial<Parameters<typeof whereARecruitedCompanyMusters>[0]>,
  ): ReturnType<typeof whereARecruitedCompanyMusters> =>
    whereARecruitedCompanyMusters({
      theOrderNamesTheGarrison: false,
      itIsAGarrisonCompany: false,
      inAProvinceOfHisRealm: true,
      theCompany: { type: 'Infantry' },
      theRoomTheColumnsBeastCommandLeaves: 0,
      ...over,
    });
  const aBeast = { type: 'Thunderbirds' };

  test('the order naming the garrison sends every company there, a beast for a full column too', () => {
    expect(musters({ theOrderNamesTheGarrison: true })).toBe('the garrison');
    expect(musters({ theOrderNamesTheGarrison: true, theCompany: aBeast })).toBe('the garrison');
    expect(musters({ theOrderNamesTheGarrison: true, theRoomTheColumnsBeastCommandLeaves: 3 })).toBe('the garrison');
  });

  test('a garrison company raised in a province of his realm musters into its garrison, whatever the order names', () => {
    expect(musters({ itIsAGarrisonCompany: true, theRoomTheColumnsBeastCommandLeaves: 3 })).toBe('the garrison');
    // a garrison company hired where the province is not his realm's joins the column
    expect(musters({ itIsAGarrisonCompany: true, inAProvinceOfHisRealm: false })).toBe('the column');
  });

  test('a beast for a column whose beast command has no room left musters into the garrison of his realm’s province', () => {
    expect(musters({ theCompany: aBeast })).toBe('the garrison, the column it would join being full');
    expect(musters({ theCompany: aBeast, theRoomTheColumnsBeastCommandLeaves: -1 })).toBe(
      'the garrison, the column it would join being full',
    );
    expect(musters({ theCompany: aBeast, theRoomTheColumnsBeastCommandLeaves: 1 })).toBe('the column');
    expect(musters({ theCompany: aBeast, theRoomTheColumnsBeastCommandLeaves: Infinity })).toBe('the column');
  });

  test('where the province is not his realm’s, or the company is no beast that counts, it joins the column', () => {
    expect(musters({ theCompany: aBeast, inAProvinceOfHisRealm: false })).toBe('the column');
    expect(musters({})).toBe('the column');
    expect(musters({ theCompany: { type: 'Thunderbirds', skeletal: true } })).toBe('the column');
    expect(musters({ theCompany: { type: 'Forest Ents', temporary: true } })).toBe('the column');
  });
});

describe('a mercenary band not hired into a full column', () => {
  const notHired = (over: Partial<Parameters<typeof aMercenaryBandIsNotHiredIntoAFullColumn>[0]>) =>
    aMercenaryBandIsNotHiredIntoAFullColumn({
      theOrderNamesTheGarrison: false,
      inAProvinceOfHisRealm: false,
      theCompany: { type: 'Cave Trolls' },
      theRoomTheColumnsBeastCommandLeaves: 0,
      ...over,
    });

  test('a band of beasts, a column with no room left and no garrison to take it: not hired', () => {
    expect(notHired({})).toBe(true);
    expect(notHired({ theRoomTheColumnsBeastCommandLeaves: -1 })).toBe(true);
  });

  test('hired where the column has room, the order names the garrison, or the province is his realm’s', () => {
    expect(notHired({ theRoomTheColumnsBeastCommandLeaves: 1 })).toBe(false);
    expect(notHired({ theRoomTheColumnsBeastCommandLeaves: Infinity })).toBe(false);
    expect(notHired({ theOrderNamesTheGarrison: true })).toBe(false);
    expect(notHired({ inAProvinceOfHisRealm: true })).toBe(false);
  });

  test('a band that is no beast that counts is always hired', () => {
    expect(notHired({ theCompany: { type: 'Infantry' } })).toBe(false);
    expect(notHired({ theCompany: { type: 'Cave Trolls', wildHunt: true } })).toBe(false);
  });
});
