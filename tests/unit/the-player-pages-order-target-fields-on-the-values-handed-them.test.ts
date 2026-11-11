// The player page's order target fields on the values handed them (plan P1-16f): the lines P1-16f changed in
// order-targets.ts that the screen tours don't reach, or reach only in part (npm run proof:tours), each run here on the
// value that reaches it, so a fault planted in one is red.
// Level 1 (unit): order-targets.ts imports in Node (P1-13e8); its functions called on a staged report and hero, the
// order form's fields written into a jsdom document set as the page's own. A page test would boot the whole page to
// reach each one.
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { bootJsdom } from '../lib/boot.js';

type TheFile = typeof import('../../src/ui/player/order-targets.ts');
let page: Document;
let T: TheFile;
const g = globalThis as unknown as Record<string, unknown>;

beforeAll(async () => {
  const { window } = bootJsdom('<!doctype html><html><body><div id="here"></div></body></html>');
  page = window['document'] as Document;
  Object.assign(globalThis, {
    window,
    document: page,
    HTMLInputElement: window['HTMLInputElement'],
    HTMLSelectElement: window['HTMLSelectElement'],
    HTMLElement: window['HTMLElement'],
    Element: window['Element'],
    Node: window['Node'],
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => ({}) },
  });
  T = await import('../../src/ui/player/order-targets.ts');
});
afterEach(() => {
  vi.useRealTimers();
  g['currentReport'] = null;
  g['currentGamePlayer'] = null;
  g['_draftOrdersSnapshot'] = {};
});
const stage = (inner: string) => {
  const here = page.getElementById('here');
  if (here) here.innerHTML = inner;
};
const words = (v: unknown) => {
  const box = page.createElement('template');
  box.innerHTML = String(v);
  return box.content.textContent.replace(/\s+/g, ' ');
};
const placeholderOf = (v: unknown) => {
  const box = page.createElement('template');
  box.innerHTML = String(v);
  return box.content.querySelector('input')?.getAttribute('placeholder') ?? '';
};
/** A made-up hero standing in the province `at` (named `where`). */
const hero = (more: Record<string, unknown> = {}) => ({
  id: 'h1',
  name: 'Ser Vell',
  player: 0,
  locationId: 7,
  locationName: 'Ashmere',
  skills: {},
  ...more,
});

describe('order-targets.ts: the explore forecast', () => {
  test("an Explore's gain reads the discoveries' words where the report gives no multiplier, and a mountain one only on mountains", () => {
    g['currentReport'] = {
      discoveries: [{ desc: 'Your scouts map 20% more' }, { desc: 'Mountain guides map 50% more' }, { desc: '' }],
    };
    const plain = T.exploreGainFor(hero({ skills: { explorer: 3 } }), 'forest');
    const onMountains = T.exploreGainFor(hero({ skills: { explorer: 3 } }), 'mountain');
    g['currentReport'] = {};
    const none = T.exploreGainFor(hero({ skills: { explorer: 3 } }), 'forest');
    expect(plain).toBeGreaterThan(none);
    expect(onMountains).toBeGreaterThan(plain);
    g['currentReport'] = { discoveries: [null] };
    expect(() => T.exploreGainFor(hero(), 'forest')).toThrow();
  });
  test('the note for a province whose ground is unknown names it, or "the province" for none', () => {
    g['currentReport'] = { characters: [hero({ locationName: '' })] };
    expect(words(T.exploreProjectionNote(hero({ locationName: '' }), 0))).toContain(
      'Explores the province — its ground is still unknown',
    );
    g['currentReport'] = { characters: [hero()] };
    expect(words(T.exploreProjectionNote(hero(), 0))).toContain('Explores Ashmere — its ground is still unknown');
  });
});

describe('order-targets.ts: the recruits counted this turn', () => {
  test("a saved draft's recruits are counted by province and type; bands and the muster's place aren't", () => {
    g['currentReport'] = { characters: [hero()] };
    g['currentGamePlayer'] = {
      orders: JSON.stringify({
        orders: { h1: [{ action: 'Recruit Armies', target: 'Militia|1, Militia|1,merc:5,to:garrison,|2' }] },
      }),
    };
    stage('');
    expect(T.getAlreadyRecruitedThisTurn('h1', 1)).toEqual({ '7:Militia': 2 });
    g['currentGamePlayer'] = { orders: { h1: [{ action: 'Recruit Armies', target: 'Archers|1' }] } };
    expect(T.getAlreadyRecruitedThisTurn('h1', 1)).toEqual({ '7:Archers': 1 });
    g['currentGamePlayer'] = { orders: 'not json' };
    expect(T.getAlreadyRecruitedThisTurn('h1', 1)).toEqual({});
  });
  test('a saved target that is not words throws, as its split did', () => {
    g['currentReport'] = { characters: [hero()] };
    g['currentGamePlayer'] = { orders: { h1: [{ action: 'Recruit Armies', target: 5 }] } };
    stage('');
    expect(() => T.getAlreadyRecruitedThisTurn('h1', 1)).toThrow(TypeError);
  });
});

describe("order-targets.ts: the defaults read off a companion's draft", () => {
  test("a companion's Practice Skill here this phase is the default, words the skills don't name are not", () => {
    stage('');
    const ally = hero({ id: 'h2', name: 'Ser Ally' });
    g['currentReport'] = { characters: [hero(), ally] };
    g['_draftOrdersSnapshot'] = { h2: [{ action: 'Practice Skill', target: 'spy' }] };
    expect(T.practiceCompanionSkill(hero(), 0)).toBe('spy');
    g['_draftOrdersSnapshot'] = { h2: [{ action: 'Practice Skill', target: 'nonsense' }] };
    expect(T.practiceCompanionSkill(hero(), 0)).toBe('');
    g['_draftOrdersSnapshot'] = { h1: [{ action: 'Practice Skill', target: 'sage' }] };
    expect(T.practiceOwnEarlierSkill(hero(), 1)).toBe('sage');
    g['_draftOrdersSnapshot'] = { h2: [{ action: 'Research', target: 'Arcana' }] };
    expect(T.defaultResearchField(hero(), 0)).toBe('Arcana');
  });
});

describe('order-targets.ts: the Blood Offering hint', () => {
  test("sides that don't match say so, with both counts", () => {
    const army = [{ type: 'Militia' }, { type: 'Archers' }, { type: 'Knights' }];
    expect(T.theBloodOfferingsHint(army, [0], [1, 2]).words).toContain("The sides don't match (1 and 2)");
  });
});

describe('order-targets.ts: the target field', () => {
  const field = (c: Record<string, unknown>, action: string, more: Record<string, unknown> = {}, ph = 0) =>
    T.buildTargetField(hero(c), ph, { action, ...more });
  test('a Grand Heist on poor ground with no name, and Steal with nothing to take', () => {
    g['currentReport'] = {
      characters: [hero()],
      worldMeta: undefined,
      diplomacy: { known: [{ index: 1, relation: 'enemy' }] },
    };
    stage('');
    expect(placeholderOf(field({}, 'Steal'))).toContain('Nothing to steal from in Ashmere');
  });
  test("the Consecrate field's refusals, each in its words", () => {
    stage('');
    const prov = (id: number, more: Record<string, unknown> = {}) => ({
      id,
      row: 0,
      col: id,
      terrain: 'plains',
      name: `P${String(id)}`,
      ...more,
    });
    const report = (provinces: unknown[], kingdom: Record<string, unknown> = {}) => ({
      characters: [hero({ isKing: true, skills: { white: 1 } })],
      kingdom: { alignment: 'Divine', ...kingdom },
      worldMeta: { cols: 20, rows: 10, provinces },
    });
    const say = () => placeholderOf(field({ isKing: true, skills: { white: 1 } }, 'Consecrate'));
    g['currentReport'] = { ...report([prov(7)]), characters: [] };
    expect(say()).toContain('Province unknown this phase.');
    g['currentReport'] = report([prov(7, { tier: 'enemy' })]);
    expect(say()).toContain('is not yours this phase');
    g['currentReport'] = report([prov(7, { tier: 'owned' })], { homeProvinceId: 7 });
    expect(say()).toContain('is your home province');
    g['currentReport'] = report([prov(7, { tier: 'owned' }), prov(8, { neighbors: [7, 'x'] })], { homeProvinceId: 8 });
    expect(say()).toContain('borders your home province');
    g['currentReport'] = report(
      [prov(7, { tier: 'owned', neighbors: [9] }), prov(9, { tier: 'owned', consecrated: true })],
      { homeProvinceId: 3 },
    );
    expect(say()).toContain('borders one of your consecrated provinces');
    g['currentReport'] = report([prov(7, { tier: 'owned' }), prov(9, { tier: 'owned', consecrated: true })], {
      homeProvinceId: 3,
      theConsecrationsItsKingMayHold: 1,
    });
    expect(say()).toContain('You already hold 1/1 consecrated province (the most');
  });
  test("the Perform Rite field: no site, and a saved offering's marks", () => {
    stage('');
    g['currentReport'] = {
      characters: [hero({ armies: [{ type: 'Militia' }, { type: 'Archers' }] })],
      kingdom: { alignment: 'Pagan', theTurnsAWildHuntServesBeyondThisOne: 2 },
      provinceOrderData: {},
    };
    expect(placeholderOf(field({}, 'Perform Rite'))).toContain('No known ritual site in Ashmere');
    g['currentReport'] = {
      characters: [hero({ armies: [{ type: 'Militia' }, { type: 'Archers' }] })],
      kingdom: { alignment: 'Pagan', theTurnsAWildHuntServesBeyondThisOne: 2 },
      provinceOrderData: { 7: { features: [{ ritualSite: true, name: 'the Grey Stones' }], wildHuntType: 'Wolves' } },
    };
    const f = field({ armies: [{ type: 'Militia' }, { type: 'Archers' }] }, 'Perform Rite', { extra: 'S:0|E:1' });
    expect(words(f)).toContain('serve until end of the turn after next');
    expect(String(f)).toMatch(/data-idx="0"[^>]*>[\s\S]*?<option value="S" selected>/);
    expect(String(f)).toMatch(/data-idx="1"[^>]*>[\s\S]*?<option value="E" selected>/);
  });
  test("the Recruit field's refusals: not his ground, no native troops, the most raised", () => {
    stage('');
    const rep = (pd: Record<string, unknown>) => ({ characters: [hero()], provinceOrderData: { 7: pd } });
    g['currentReport'] = rep({ canRecruit: false, armyTypes: [] });
    expect(placeholderOf(field({}, 'Recruit Armies'))).toBe('Ashmere is not your territory — cannot recruit here');
    g['currentReport'] = rep({ canRecruit: true, armyTypes: [], name: 'Ashmere' });
    expect(placeholderOf(field({}, 'Recruit Armies'))).toBe('No native recruitable armies in Ashmere');
    g['currentReport'] = { ...rep({ canRecruit: false, armyTypes: [] }), mercIntel: [] };
    g['currentReport'] = {
      characters: [hero()],
      provinceOrderData: { 7: { canRecruit: false, armyTypes: [] } },
      mercIntel: [{ id: 3, type: 'Pikes', quality: 'Veteran', unitName: '', locationId: 7, cost: 4 }],
    };
    const m = field({}, 'Recruit Armies');
    expect(words(m)).toContain('Pikes (Veteran Pikes, 4g)');
    expect(String(m)).toContain('value="merc:3"');
  });
  test('the Cast Spell rows of a school he practises this turn say so', () => {
    stage(
      '<select id="po-action-h1-0"><option value="Practice Skill" selected>p</option></select><input id="po-target-h1-0" value="white">',
    );
    const c = hero({ skills: { white: 0 } });
    g['currentReport'] = { characters: [c], kingdom: {} };
    const rows = T.theSpellsTheCastSpellFieldOffersAHeroInAPhase(c, 1, { kingdom: {} })._spellRows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.label).toMatch(/practising, may unlock: Lv1, 0\/1 used\)$/);
  });
});

describe("order-targets.ts: the checkboxes' hidden fields", () => {
  test('a leave list writes the boxes ticked, "all" clears them, and a recruit list adds the muster place', () => {
    vi.useFakeTimers();
    stage(`<div id="po-target-wrap-inner-h1-0"><div>
      <input type="checkbox" id="po-leave-all-h1-0" value="all" checked>
      <input type="checkbox" value="Militia" checked><input type="checkbox" value="Archers">
      <input type="hidden" id="po-target-h1-0" value=""></div>
      <select class="po-recruit-dest"><option value="to:h2" selected>x</option></select></div>`);
    T.updateLeaveTarget('h1', 0);
    const hidden = () => (page.getElementById('po-target-h1-0') as HTMLInputElement | null)?.value;
    expect(hidden()).toBe('Militia');
    expect((page.getElementById('po-leave-all-h1-0') as HTMLInputElement | null)?.checked).toBe(false);
    T.leaveToggleAll('h1', 0, true);
    expect(hidden()).toBe('all');
    T.leaveToggleAll('h1', 0, false);
    expect(hidden()).toBe('');
    page.querySelector<HTMLInputElement>('input[value=Archers]')?.click();
    T.updateRecruitTarget('h1', 0);
    expect(hidden()).toBe('Archers,to:h2');
  });
});
