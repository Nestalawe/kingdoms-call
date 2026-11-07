// The order form's forecasts (plan P1-11e41) imported and called as they are, with no vm: the forecasts' file reads no
// page field and no currentReport, but the report and the orders the form holds handed to it. On a staged report (a map
// of eight provinces, two heroes of one realm) and orders written as the page's snapshot holds them, each forecast's
// answer is pinned: where a hero will stand (a Move by province and by direction, his pace, a neutral border and a war
// the form declares, an answer that follows the orders, not the last one kept), what he will lead (a hand-over, a Recruit
// mustered to a comrade by its boxes), what a garrison will hold (a leave, as the phase begins and in it), what he will
// carry (a Send Item), the column the Move note counts; then the page's snapshot of its fields (a stand-in document).
// Level 1: functions on plain values; a page would test the same functions through the DOM.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line): each forecast of
// src/ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts on the report and the orders
// handed in, its answer pinned, each red on a fault planted in the line it reads (P1-11e41's PR); since P1-21n an Undead
// realm's war without warning, a comrade's hand-over from another province left out of the Move note, a leave to the
// garrison of companies recruited the phase before, beasts mustered to a comrade by his beast command's room, and an
// earlier Blood Offering's company read as the offering began (each red on its mutant of the 2026-11-07 session); and
// theOrdersTheFormHolds (the page's side) reading each field, a Recruit's boxes and the form's declarations, a field the
// form doesn't show absent.
import { afterEach, describe, expect, test } from 'vitest';
import {
  theColumnAHeroMarchesWithInAPhase,
  whatAGarrisonHoldsAsAPhaseBegins,
  whatAHeroCarriesAsAPhaseBegins,
  whatAHeroLeadsAsAPhaseBegins,
  whereAHeroStandsAfterTheOrdersBefore,
  whereTheCompaniesAHerosRecruitRaisesMusterOnTheseOrders,
} from '../../src/ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import { theOrdersTheFormHolds } from '../../src/ui/player/the-orders-the-form-holds-handed-to-its-forecasts.ts';

type AnOrder = Record<string, unknown>;
/** The orders as the page's snapshot holds them: by hero, his order of each phase. */
const ordersOf = (byHero: Record<string, AnOrder[]>, declarations: unknown = null) => ({ byHero, declarations });

/** A map four provinces wide and two high (id = row × 4 + column), all plains of the realm 0, but province 2 of the
 *  realm 1 where `neutralAt2`; two heroes of the realm in province 1, the first leading two companies and carrying a
 *  sword. A fresh report each call (the forecast keeps its answers for one report). */
function aReport({ neutralAt2 = false, alignment = 'Good' } = {}) {
  const provinces = Array.from({ length: 8 }, (_, id) => ({
    id,
    row: Math.floor(id / 4),
    col: id % 4,
    name: `Province ${String(id)}`,
    terrain: 'plains',
    owner: neutralAt2 && id === 2 ? 1 : 0,
  }));
  return {
    playerIndex: 0,
    kingdom: { alignment },
    diplomacy: { known: [{ index: 1, relation: 'neutral' }] },
    worldMeta: { cols: 4, rows: 2, provinces },
    ownedProvinces: provinces.filter((p) => p.owner === 0).map((p) => ({ id: p.id })),
    provinceOrderData: { 1: { garrisonArmies: [{ type: 'Militia', quality: 'Average', unitName: 'Town Watch' }] } },
    characters: [
      {
        id: 1,
        name: 'Aldo',
        locationId: 1,
        locationName: 'Province 1',
        effectiveSpeed: 2,
        effectiveSeaSpeed: 0,
        skills: {},
        items: [{ id: 'i1', name: 'Sword' }],
        armies: [
          { type: 'Spearmen', quality: 'Average', unitName: 'First Spears' },
          { type: 'Archers', quality: 'Average', unitName: 'Bowmen' },
        ],
      },
      {
        id: 2,
        name: 'Brin',
        locationId: 1,
        locationName: 'Province 1',
        effectiveSpeed: 2,
        effectiveSeaSpeed: 0,
        skills: {},
        items: [],
        armies: [],
      },
    ],
  };
}
const where = (report: unknown, orders: unknown, heroId: number, upTo: number): unknown => {
  const at: unknown = whereAHeroStandsAfterTheOrdersBefore(report, orders, heroId, upTo);
  return typeof at === 'object' && at !== null && 'id' in at ? at.id : at;
};
const names = (companies: unknown): unknown[] =>
  (Array.isArray(companies) ? companies : []).map((a: unknown) =>
    typeof a === 'object' && a !== null && 'unitName' in a ? a.unitName : a,
  );

describe('where a hero will stand, on the orders handed in', () => {
  test('a Move by province or by direction takes him next door; no order, or before the phase, leaves him', () => {
    expect(where(aReport(), ordersOf({ 1: [{ action: 'Move', target: 'prov:2' }] }), 1, 1)).toBe(2);
    expect(where(aReport(), ordersOf({ 1: [{ action: 'Move', target: 'dir:E' }] }), 1, 1)).toBe(2);
    expect(where(aReport(), ordersOf({ 1: [{ action: 'Move', target: 'prov:2' }] }), 1, 0)).toBe(1);
    expect(where(aReport(), ordersOf({}), 1, 1)).toBe(1);
    // the form shows no action field: no march
    expect(where(aReport(), ordersOf({ 1: [{ target: 'prov:2' }] }), 1, 1)).toBe(1);
  });
  test('his pace is spent a step at a time: two Moves at a pace of 1 take him one step', () => {
    const report = aReport();
    const aldo = report.characters[0];
    if (aldo) aldo.effectiveSpeed = 1;
    const twoMoves = ordersOf({
      1: [
        { action: 'Move', target: 'prov:2' },
        { action: 'Move', target: 'prov:3' },
      ],
    });
    expect(where(report, twoMoves, 1, 2)).toBe(2);
    expect(where(aReport(), twoMoves, 1, 2)).toBe(3);
  });
  test("a neutral realm's border turns his column back, unless his Evil realm declares war on the form", () => {
    const march = { 1: [{ action: 'Move', target: 'prov:2' }] };
    expect(where(aReport({ neutralAt2: true, alignment: 'Evil' }), ordersOf(march), 1, 1)).toBe(1);
    expect(where(aReport({ neutralAt2: true, alignment: 'Evil' }), ordersOf(march, { 1: 'enemy' }), 1, 1)).toBe(2);
    expect(where(aReport({ neutralAt2: true, alignment: 'Good' }), ordersOf(march, { 1: 'enemy' }), 1, 1)).toBe(1);
  });
  test("an Undead realm's war declared on the form lets his column through the border at once, as an Evil realm's does", () => {
    // war without warning: the turn lets an Evil or an Undead realm's declaration stand from the first phase
    const march = { 1: [{ action: 'Move', target: 'prov:2' }] };
    expect(where(aReport({ neutralAt2: true, alignment: 'Undead' }), ordersOf(march), 1, 1)).toBe(1);
    expect(where(aReport({ neutralAt2: true, alignment: 'Undead' }), ordersOf(march, { 1: 'enemy' }), 1, 1)).toBe(2);
  });
  test('on one report, an answer follows the war the form declares, not the one kept before', () => {
    const report = aReport({ neutralAt2: true, alignment: 'Evil' });
    const march = { 1: [{ action: 'Move', target: 'prov:2' }] };
    expect(where(report, ordersOf(march), 1, 1)).toBe(1);
    expect(where(report, ordersOf(march, { 1: 'enemy' }), 1, 1)).toBe(2);
  });
  test('on one report, an answer follows the orders handed in, not the one kept before', () => {
    const report = aReport();
    expect(where(report, ordersOf({ 1: [{ action: 'Move', target: 'prov:2' }] }), 1, 1)).toBe(2);
    expect(where(report, ordersOf({}), 1, 1)).toBe(1);
    expect(where(report, ordersOf({ 1: [{ action: 'Move', target: 'prov:0' }] }), 1, 1)).toBe(0);
  });
});

describe('what a hero will lead and carry, and a garrison hold, on the orders handed in', () => {
  test('a hand-over moves the company named to the comrade named in its extra', () => {
    const orders = ordersOf({ 1: [{ action: 'Leave/Transfer Army', target: 'First Spears', extra: '2' }] });
    expect(names(whatAHeroLeadsAsAPhaseBegins(aReport(), orders, 1, 1))).toEqual(['Bowmen']);
    expect(names(whatAHeroLeadsAsAPhaseBegins(aReport(), orders, 2, 1))).toEqual(['First Spears']);
    expect(names(whatAHeroLeadsAsAPhaseBegins(aReport(), orders, 1, 0))).toEqual(['First Spears', 'Bowmen']);
  });
  test("a Recruit mustered to a comrade by its boxes joins the comrade's column, not the recruiter's", () => {
    const orders = ordersOf({
      1: [
        {
          action: 'Recruit Armies',
          target: 'Spearmen,to:2',
          recruit: { musterTo: 'to:2', ticked: ['Spearmen'] },
        },
      ],
    });
    const types = (companies: unknown) =>
      (Array.isArray(companies) ? companies : []).map((a: unknown) =>
        typeof a === 'object' && a !== null && 'type' in a ? a.type : a,
      );
    expect(types(whatAHeroLeadsAsAPhaseBegins(aReport(), orders, 1, 1))).toEqual(['Spearmen', 'Archers']);
    expect(types(whatAHeroLeadsAsAPhaseBegins(aReport(), orders, 2, 1))).toEqual(['Spearmen']);
  });
  test('a mercenary band ticked joins as the report shows it, a band out of view as a hired band', () => {
    const report = {
      ...aReport(),
      mercIntel: [{ id: 7, type: 'Swordsmen', quality: 'Veteran', unitName: 'Free Blades' }],
    };
    const orders = ordersOf({
      1: [
        {
          action: 'Recruit Armies',
          target: 'merc:7,merc:8',
          recruit: { musterTo: 'to:self', ticked: ['merc:7', 'merc:8'] },
        },
      ],
    });
    expect(names(whatAHeroLeadsAsAPhaseBegins(report, orders, 1, 1))).toEqual([
      'First Spears',
      'Bowmen',
      'Free Blades',
      'a hired band',
    ]);
  });
  test('a leave to the garrison: the garrison holds it once the phase is over, and in it but for the leaver', () => {
    const orders = ordersOf({ 1: [{ action: 'Leave/Transfer Army', target: 'Bowmen', extra: '-1' }] });
    expect(names(whatAGarrisonHoldsAsAPhaseBegins(aReport(), orders, 1, 1, false, undefined))).toEqual([
      'Town Watch',
      'Bowmen',
    ]);
    expect(names(whatAGarrisonHoldsAsAPhaseBegins(aReport(), orders, 1, 0, false, undefined))).toEqual(['Town Watch']);
    expect(names(whatAGarrisonHoldsAsAPhaseBegins(aReport(), orders, 1, 0, true, 2))).toEqual(['Town Watch', 'Bowmen']);
    expect(names(whatAGarrisonHoldsAsAPhaseBegins(aReport(), orders, 1, 0, true, 1))).toEqual(['Town Watch']);
  });
  test('a Send Item hands the item to the comrade beside him', () => {
    const orders = ordersOf({ 1: [{ action: 'Send Item', target: '0', extra: '2' }] });
    const carried = (heroId: number) => names(whatAHeroCarriesAsAPhaseBegins(aReport(), orders, heroId, 1));
    const itemNames = (heroId: number): unknown[] => {
      const items: unknown = whatAHeroCarriesAsAPhaseBegins(aReport(), orders, heroId, 1);
      return (Array.isArray(items) ? items : []).map((it: unknown) =>
        typeof it === 'object' && it !== null && 'name' in it ? it.name : it,
      );
    };
    expect(carried(1)).toEqual([]);
    expect(itemNames(2)).toEqual(['Sword']);
  });
  test("the column the Move note counts holds a comrade's hand-over of the same phase", () => {
    const orders = ordersOf({
      1: [{ action: 'Move', target: 'prov:2' }],
      2: [{ action: 'Leave/Transfer Army', target: 'all', extra: '1' }],
    });
    const report = aReport();
    report.characters[1]?.armies.push({ type: 'Spearmen', quality: 'Average', unitName: 'Second Spears' });
    const column: unknown = theColumnAHeroMarchesWithInAPhase(report, orders, 1, 0);
    const armies = typeof column === 'object' && column !== null && 'armies' in column ? column.armies : null;
    expect(names(armies)).toEqual(['First Spears', 'Bowmen', 'Second Spears']);
  });
});

describe('what the later phases read of the earlier ones, on the orders handed in', () => {
  /** Each company by its name, or its type where it has none (a recruit). */
  const labels = (companies: unknown): unknown[] =>
    (Array.isArray(companies) ? companies : []).map((a: unknown) =>
      typeof a === 'object' && a !== null && 'unitName' in a && a.unitName !== undefined
        ? a.unitName
        : typeof a === 'object' && a !== null && 'type' in a
          ? a.type
          : a,
    );
  const theColumn = (report: unknown, orders: unknown, heroId: number, ph: number) => {
    const column: unknown = theColumnAHeroMarchesWithInAPhase(report, orders, heroId, ph);
    return {
      armies: labels(typeof column === 'object' && column !== null && 'armies' in column ? column.armies : null),
      sameFrom: typeof column === 'object' && column !== null && 'sameFrom' in column ? column.sameFrom : null,
    };
  };
  test('the Move note counts no hand-over of the same phase from a comrade in another province (the turn refuses it)', () => {
    const report = aReport();
    const brin = report.characters[1];
    if (!brin) throw new Error('the staged report has no second hero');
    brin.locationId = 5;
    brin.locationName = 'Province 5';
    brin.armies.push({ type: 'Spearmen', quality: 'Average', unitName: 'Second Spears' });
    const orders = ordersOf({
      1: [{ action: 'Move', target: 'prov:2' }],
      2: [{ action: 'Leave/Transfer Army', target: 'all', extra: '1' }],
    });
    expect(theColumn(report, orders, 1, 0)).toEqual({ armies: ['First Spears', 'Bowmen'], sameFrom: [] });
  });
  test('a leave to the garrison takes the companies he leads as its phase begins: those he recruited the phase before too', () => {
    const orders = ordersOf({
      1: [
        { action: 'Recruit Armies', target: 'Spearmen', recruit: { musterTo: null, ticked: ['Spearmen'] } },
        { action: 'Leave/Transfer Army', target: 'all', extra: '-1' },
      ],
    });
    expect(labels(whatAGarrisonHoldsAsAPhaseBegins(aReport(), orders, 1, 2, false, undefined))).toEqual([
      'Town Watch',
      'First Spears',
      'Bowmen',
      'Spearmen',
    ]);
    expect(labels(whatAHeroLeadsAsAPhaseBegins(aReport(), orders, 1, 2))).toEqual([]);
  });
  test("beasts recruited into a comrade's column take the room of the comrade's beast command, not the recruiter's", () => {
    // Aldo (no Druid) musters two Great Bears to Brin (Druid 1, leading no beast), in a province of his realm: one joins
    // Brin, the one past his beast command the garrison
    const report = aReport();
    const brin = report.characters[1];
    if (!brin) throw new Error('the staged report has no second hero');
    brin.skills = { druid: 1 };
    const ticks = ['Great Bears', 'Great Bears', 'to:2'];
    const orders = ordersOf({
      1: [{ action: 'Recruit Armies', target: ticks.join(','), recruit: { musterTo: 'to:2', ticked: ticks } }],
    });
    const musters: unknown = whereTheCompaniesAHerosRecruitRaisesMusterOnTheseOrders(
      report,
      orders,
      report.characters[0],
      0,
      ticks,
    );
    const part = (key: string) =>
      labels(typeof musters === 'object' && musters !== null && key in musters ? Reflect.get(musters, key) : null);
    expect([part('toTheColumn'), part('toTheGarrison')]).toEqual([['Great Bears'], ['Great Bears']]);
    expect(labels(whatAHeroLeadsAsAPhaseBegins(aReport(), orders, 2, 1))).toEqual([]);
    expect(labels(whatAHeroLeadsAsAPhaseBegins(report, orders, 2, 1))).toEqual(['Great Bears']);
  });
  test('the Move note takes out the company an earlier Blood Offering gave, read from his column as the offering began', () => {
    // Spring: he gives his third company to raise his first; Early Summer: he disbands the first; Late Summer: he marches
    const report = aReport();
    report.characters[0]?.armies.push({ type: 'Spearmen', quality: 'Average', unitName: 'Third Spears' });
    const orders = ordersOf({
      1: [
        { action: 'Perform Rite', target: 'Blood Offering', extra: 'S:2|E:0' },
        { action: 'Disband Army', target: 'First Spears' },
        { action: 'Move', target: 'prov:2' },
      ],
    });
    expect(labels(whatAHeroLeadsAsAPhaseBegins(report, orders, 1, 2))).toEqual(['Bowmen', 'Third Spears']);
    expect(theColumn(report, orders, 1, 2).armies).toEqual(['Bowmen']);
  });
});

describe("the page's snapshot of the orders its form holds", () => {
  const theDocument: unknown = Reflect.get(globalThis, 'document');
  afterEach(() => {
    Reflect.set(globalThis, 'document', theDocument);
  });
  test('each field the form shows, a Recruit’s boxes and its "Muster to"; a field the form doesn’t show is absent', () => {
    const fields: Record<string, string> = {
      'po-action-1-0': 'Recruit Armies',
      'po-target-1-0': 'Spearmen,to:2',
      'po-extra-2-3': '1',
    };
    const box = (value: string) => ({ value });
    Reflect.set(globalThis, 'document', {
      getElementById: (id: string) => {
        if (id === 'po-target-wrap-1-0')
          return {
            querySelector: (s: string) => (s === '.po-recruit-dest' ? box('to:2') : null),
            querySelectorAll: (s: string) => (s === 'input[type="checkbox"]:checked' ? [box('Spearmen')] : []),
          };
        return id in fields ? box(fields[id] ?? '') : null;
      },
    });
    const orders = theOrdersTheFormHolds(aReport());
    expect(orders.declarations).toBeNull();
    Reflect.set(globalThis, 'diploChoices', { 1: 'enemy' });
    expect(theOrdersTheFormHolds(aReport()).declarations).toEqual({ 1: 'enemy' });
    Reflect.deleteProperty(globalThis, 'diploChoices');
    expect(orders.byHero['1']?.[0]).toEqual({
      action: 'Recruit Armies',
      target: 'Spearmen,to:2',
      recruit: { musterTo: 'to:2', ticked: ['Spearmen'] },
    });
    expect(orders.byHero['2']?.[3]).toEqual({ extra: '1' });
    expect(orders.byHero['2']?.[0]).toEqual({});
    expect(orders.byHero['1']).toHaveLength(6);
  });
});
