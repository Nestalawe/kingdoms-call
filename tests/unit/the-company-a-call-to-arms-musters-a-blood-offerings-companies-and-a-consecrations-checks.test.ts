// The orders' rules, on plain values (plan P1-11e22 moved these out of their resolvers, so the order form's notes can
// later ask the turn's own): the company a Call to Arms musters (the province's first garrison type, else its race's,
// else Human; its race, else Human); the companies a Blood Offering may take (no borrowed company, Wild Hunt beast or
// skeleton) and the ones it gives and raises (the marks read, each once, none both, the longer side cut; with a side
// empty, the first it may take given and the second raised; fewer than two, none); why a king may not consecrate a
// province (his realm's, not the home marches, not holy already, beside no holy province, White known, fewer held than
// he may), each fact asked only once the checks before it pass; the consecrations a king may hold (his White and Holy
// Sites) and the turns a Wild Hunt serves beyond this one (its row's and The Long Hunt), engine side; and the hexes'
// symmetry, so the home test reads the same from the home's neighbours (the turn's) or the province's (the form's).
//
// Level 1 (unit): the functions of src/engine/rules-on-plain-values/the-company-a-call-to-arms-musters-a-blood-
// offerings-companies-and-a-consecrations-checks.ts on made-up provinces, companies and facts, and the two engine-side
// functions beside their resolvers. A lower level can't run a function. A fault planted in a shared function moves
// every caller at once, so these cases pin its answers; the resolvers' own cases (tests/lib/recruit-hire-and-realm-works-
// order-cases.ts, tests/lib/explore-and-search-order-cases.ts) check the engine's calls in whole turns.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  aBloodOfferingMayTakeTheCompany,
  theCompaniesABloodOfferingGivesAndRaises,
  theCompanyACallToArmsMusters,
  whyAKingMayNotConsecrateAProvince,
  type TheFactsAConsecrationsChecksRead,
} from '../../src/engine/rules-on-plain-values/the-company-a-call-to-arms-musters-a-blood-offerings-companies-and-a-consecrations-checks.ts';
import {
  unitAsItsRealmSeesIt,
  type AUnitAsItsRealmSeesIt,
} from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import { theConsecrationsAKingMayHold } from '../../src/engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts';
import { theTurnsAWildHuntServesBeyondThisOne } from '../../src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts';
import { WILD_HUNT_TURNS } from '../../src/engine/items/tiers-and-hoards.ts';
import { getNeighborsP } from '../../src/engine/world/map-helpers.ts';

describe('the company a Call to Arms musters', () => {
  test("the first garrison type of the province's own pool, whatever its case, and the province's race", () => {
    expect(
      theCompanyACallToArmsMusters({
        armyTypes: ['Elven Bowmen', 'Sylvan GARRISON', 'Elven Garrison'],
        race: 'Elven',
      }),
    ).toEqual({ type: 'Sylvan GARRISON', race: 'Elven' });
  });
  test("with no garrison type in its pool, its race's garrison", () => {
    const of = (race: string) => theCompanyACallToArmsMusters({ armyTypes: ['Shieldwall Levies'], race }).type;
    expect([of('Human'), of('Elven'), of('Dwarven'), of('Orcish')]).toEqual([
      'Human Garrison',
      'Elven Garrison',
      'Dwarf Garrison',
      'Orc Garrison',
    ]);
  });
  test('a race with no garrison of its own musters a plain levy, of its own race', () => {
    expect(theCompanyACallToArmsMusters({ armyTypes: [], race: 'Gnomish' })).toEqual({
      type: 'Human Garrison',
      race: 'Gnomish',
    });
  });
  test('a province with no pool and no race musters a Human levy', () => {
    expect(theCompanyACallToArmsMusters({})).toEqual({ type: 'Human Garrison', race: 'Human' });
    expect(theCompanyACallToArmsMusters({ armyTypes: null, race: null })).toEqual({
      type: 'Human Garrison',
      race: 'Human',
    });
    expect(theCompanyACallToArmsMusters({ armyTypes: [], race: '' })).toEqual({
      type: 'Human Garrison',
      race: 'Human',
    });
  });
});

/** A company as its realm sees it, of the type given. */
const company = (type: string, seen: Partial<AUnitAsItsRealmSeesIt> = {}): AUnitAsItsRealmSeesIt => ({ type, ...seen });
const asItIs = (a: AUnitAsItsRealmSeesIt) => a;

describe('the companies a Blood Offering may take', () => {
  test('a company of his own; not one borrowed for a while, a Wild Hunt beast or a skeleton', () => {
    expect(aBloodOfferingMayTakeTheCompany(company('Spearmen'))).toBe(true);
    expect(aBloodOfferingMayTakeTheCompany(company('Spearmen', { phantom: true }))).toBe(true);
    expect(aBloodOfferingMayTakeTheCompany(company('Ents', { temporary: true }))).toBe(false);
    expect(aBloodOfferingMayTakeTheCompany(company('Wolves', { wildHunt: true }))).toBe(false);
    expect(aBloodOfferingMayTakeTheCompany(company('Skeletons', { skeletal: true }))).toBe(false);
  });
  test("the engine's companies, as their realm sees them", () => {
    const takes = (a: Parameters<typeof unitAsItsRealmSeesIt>[0]) =>
      aBloodOfferingMayTakeTheCompany(unitAsItsRealmSeesIt(a));
    expect(takes({ type: 'Spearmen', _wildHuntUntilTurn: null })).toBe(true);
    expect(takes({ type: 'Wolves', _wildHuntUntilTurn: 0 })).toBe(false);
    expect(takes({ type: 'Ents', _temporary: true })).toBe(false);
    expect(takes({ type: 'Skeletons', _isSkeletal: true })).toBe(false);
  });
});

describe('the companies a Blood Offering gives and raises', () => {
  const five = ['A', 'B', 'C', 'D', 'E'].map((t) => company(t));
  const gives = (army: readonly (AUnitAsItsRealmSeesIt | null | undefined)[], extra: string) =>
    theCompaniesABloodOfferingGivesAndRaises(army, extra, (a: AUnitAsItsRealmSeesIt | null | undefined) =>
      a == null ? company('a gap') : asItIs(a),
    );
  test('the ones the marks name, in the order named', () => {
    expect(gives(five, 'S:3,0|E:4,1')).toEqual({ given: [3, 0], raised: [4, 1] });
    expect(gives(five, '  S:0|E:1  ')).toEqual({ given: [0], raised: [1] });
  });
  test('each once; none both given and raised (given first)', () => {
    expect(gives(five, 'S:0,0,2|E:2,1,1,3')).toEqual({ given: [0, 2], raised: [1, 3] });
  });
  test('the longer side cut to the shorter: one raised for each given', () => {
    expect(gives(five, 'S:0,1,2|E:3')).toEqual({ given: [0], raised: [3] });
    expect(gives(five, 'S:0|E:1,2,3')).toEqual({ given: [0], raised: [1] });
  });
  test('a mark of a company it may not take, or of none, or an empty one, is passed over', () => {
    const army = [company('A'), company('B', { skeletal: true }), company('C'), company('D', { wildHunt: true })];
    expect(gives(army, 'S:1,0,9|E:,3,2,')).toEqual({ given: [0], raised: [2] });
  });
  test('with a side named empty, or no marks, the first company it may take is given and the second raised', () => {
    const army = [company('A', { temporary: true }), company('B'), company('C', { skeletal: true }), company('D')];
    expect(gives(army, 'S:1|E:')).toEqual({ given: [1], raised: [3] });
    expect(gives(army, 'S:|E:3')).toEqual({ given: [1], raised: [3] });
    expect(gives(army, 'S:0|E:2')).toEqual({ given: [1], raised: [3] });
    expect(gives(army, '')).toEqual({ given: [1], raised: [3] });
    expect(gives(army, 'the old form')).toEqual({ given: [1], raised: [3] });
  });
  test('a gap in the column is never taken', () => {
    expect(gives([undefined, company('B'), undefined, company('D')], 'S:0|E:2')).toEqual({ given: [1], raised: [3] });
    expect(gives([undefined, company('B'), undefined, company('D')], 'S:1|E:3')).toEqual({ given: [1], raised: [3] });
    expect(gives([null, company('B'), null, company('D')], 'S:0|E:2')).toEqual({ given: [1], raised: [3] });
  });
  test('fewer than two companies it may take: no offering', () => {
    expect(gives([company('A'), company('B', { temporary: true })], '')).toBeNull();
    expect(gives([company('A'), company('B', { temporary: true })], 'S:0|E:1')).toBeNull();
    expect(gives([company('A')], 'S:0|E:0')).toBeNull();
    expect(gives([], '')).toBeNull();
  });
});

/** The facts of a consecration that passes every check, with any given; a fact a check before it refuses is never
 *  asked (it throws if it is). */
function consecration(
  given: Partial<TheFactsAConsecrationsChecksRead<number[]>> = {},
): TheFactsAConsecrationsChecksRead<number[]> {
  return {
    theProvinceId: 20,
    itIsHisRealms: true,
    theHomeMarches: () => ({ theHomeId: 0, theProvincesBesideIt: [1, 2, 10] }),
    theConsecrated: () => [40],
    theProvincesBesideIt: () => [19, 21, 30],
    theConsecrationsHeMayHold: () => 2,
    ...given,
  };
}
const neverAsked = () => {
  throw new Error('a fact asked after a check refused');
};

describe('why a king may not consecrate a province', () => {
  test('he may: the list he holds (the same list, for the turn to add to) and his limit', () => {
    const list = [40];
    const answer = whyAKingMayNotConsecrateAProvince(consecration({ theConsecrated: () => list }));
    expect(answer).toEqual({ refused: null, theConsecrated: [40], theLimit: 2 });
    expect(answer.refused === null && answer.theConsecrated).toBe(list);
  });
  test('a province not of his realm, before any other fact is asked', () => {
    expect(
      whyAKingMayNotConsecrateAProvince({
        theProvinceId: 20,
        itIsHisRealms: false,
        theHomeMarches: neverAsked,
        theConsecrated: neverAsked,
        theProvincesBesideIt: neverAsked,
        theConsecrationsHeMayHold: neverAsked,
      }),
    ).toEqual({ refused: 'it is not a province of his realm' });
  });
  test('his home, or a province beside it, before the list is asked; a realm with no home has no marches', () => {
    const marches = (id: number, theHomeId: number | null) =>
      whyAKingMayNotConsecrateAProvince(
        consecration({
          theProvinceId: id,
          theHomeMarches: () => ({ theHomeId, theProvincesBesideIt: theHomeId === null ? [] : [1, 2, 10] }),
          theConsecrated: () => [99],
          theProvincesBesideIt: neverAsked,
          theConsecrationsHeMayHold: neverAsked,
        }),
      ).refused;
    expect([marches(0, 0), marches(10, 0), marches(2, 0)]).toEqual([
      'it lies in the home marches',
      'it lies in the home marches',
      'it lies in the home marches',
    ]);
    expect(
      whyAKingMayNotConsecrateAProvince(
        consecration({ theProvinceId: 0, theHomeMarches: () => ({ theHomeId: null, theProvincesBesideIt: [] }) }),
      ).refused,
    ).toBe(null);
  });
  test('ground holy already, before its neighbours are asked; the home marches first', () => {
    expect(
      whyAKingMayNotConsecrateAProvince(
        consecration({
          theConsecrated: () => [40, 20],
          theProvincesBesideIt: neverAsked,
          theConsecrationsHeMayHold: neverAsked,
        }),
      ),
    ).toEqual({ refused: 'it is consecrated already' });
    expect(
      whyAKingMayNotConsecrateAProvince(consecration({ theProvinceId: 10, theConsecrated: () => [10] })).refused,
    ).toBe('it lies in the home marches');
  });
  test('a holy province beside it, the first of the list that is, before his limit is asked', () => {
    expect(
      whyAKingMayNotConsecrateAProvince(
        consecration({
          theConsecrated: () => [40, 30, 19],
          theConsecrationsHeMayHold: neverAsked,
        }),
      ),
    ).toEqual({ refused: 'a consecrated province lies beside it', theNeighbourId: 30 });
    expect(
      whyAKingMayNotConsecrateAProvince(consecration({ theConsecrated: () => [0], theProvincesBesideIt: () => [0] })),
    ).toEqual({ refused: 'a consecrated province lies beside it', theNeighbourId: 0 });
  });
  test('no White known: none may be held', () => {
    expect(whyAKingMayNotConsecrateAProvince(consecration({ theConsecrationsHeMayHold: () => 0 }))).toEqual({
      refused: 'he knows no White',
    });
    expect(whyAKingMayNotConsecrateAProvince(consecration({ theConsecrationsHeMayHold: () => -1 })).refused).toBe(
      'he knows no White',
    );
  });
  test('as many held as he may: refused with the list and the limit; one fewer, allowed', () => {
    expect(
      whyAKingMayNotConsecrateAProvince(
        consecration({ theConsecrated: () => [40, 50], theConsecrationsHeMayHold: () => 2 }),
      ),
    ).toEqual({ refused: 'he holds as many as he may', theConsecrated: [40, 50], theLimit: 2 });
    expect(
      whyAKingMayNotConsecrateAProvince(
        consecration({ theConsecrated: () => [40, 50, 60], theConsecrationsHeMayHold: () => 2 }),
      ).refused,
    ).toBe('he holds as many as he may');
    expect(
      whyAKingMayNotConsecrateAProvince(consecration({ theConsecrated: () => [], theConsecrationsHeMayHold: () => 1 })),
    ).toEqual({ refused: null, theConsecrated: [], theLimit: 1 });
  });
});

describe("the consecrations a king may hold, and a Wild Hunt's term (engine side: the discoveries' registry)", () => {
  const holySites = { discoveries: [{ id: 'ad03' }] };
  test('his White; Holy Sites one more from White 3', () => {
    const limit = (white: number, realm: { discoveries: { id: string }[] } | undefined) =>
      theConsecrationsAKingMayHold({ skills: { white } }, realm);
    expect([limit(0, undefined), limit(2, undefined), limit(3, { discoveries: [] }), limit(12, undefined)]).toEqual([
      0, 2, 3, 9,
    ]);
    expect([limit(0, holySites), limit(2, holySites), limit(3, holySites), limit(5, holySites)]).toEqual([0, 2, 4, 6]);
  });
  test("the Wild Hunt's beasts serve its row's turns beyond this one, and The Long Hunt's more", () => {
    expect(WILD_HUNT_TURNS).toBe(1);
    expect(theTurnsAWildHuntServesBeyondThisOne(undefined)).toBe(1);
    expect(theTurnsAWildHuntServesBeyondThisOne({ discoveries: [] })).toBe(1);
    expect(theTurnsAWildHuntServesBeyondThisOne({ discoveries: [{ id: 'ap08' }] })).toBe(2);
    expect(theTurnsAWildHuntServesBeyondThisOne(holySites)).toBe(1);
  });
});

describe("the hexes' symmetry: the home test reads the same from either side", () => {
  test('on every map from 3 by 3 to 24 by 24, a province is beside each of its neighbours', () => {
    let pairs = 0;
    for (let cols = 3; cols <= 24; cols++)
      for (let rows = 3; rows <= 24; rows++) {
        const provinces = Array.from({ length: cols * rows }, (_, id) => ({
          id,
          row: Math.floor(id / cols),
          col: id % cols,
        }));
        const beside = provinces.map((p) => new Set(getNeighborsP(p, cols, rows, provinces).map((x) => x.id)));
        for (const p of provinces)
          for (const q of beside[p.id] ?? []) {
            pairs++;
            expect(beside[q]?.has(p.id), `${String(cols)}×${String(rows)}: ${String(p.id)} and ${String(q)}`).toBe(
              true,
            );
          }
      }
    expect(pairs).toBeGreaterThan(100_000);
  });
});
