// The player page's order target fields on the values handed them (plan P1-16f, P1-16h1): the lines they changed in
// order-targets.ts that the screen tours don't reach, or reach only in part (npm run proof:tours), each run here on the
// value that reaches it, so a fault planted in one is red.
// Level 1 (unit): order-targets.ts imports in Node (P1-13e8); its functions called on a staged report and hero, the
// order form's fields written into a jsdom document set as the page's own. A page test would boot the whole page to
// reach each one.
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { bootJsdom } from '../lib/boot.ts';
import { theShareOfAProvinceAnExploreOrderMaps } from '../../src/shared/the-engines-rules-the-player-portal-shares.ts';
import { THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';

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
      discoveries: [{ desc: 'Your scouts map 20% more' }, { desc: 'Mountain guides map 50% more' }, { desc: '' }, {}],
    };
    const c = hero({ skills: { explorer: 3 } });
    expect(T.exploreGainFor(c, 'forest')).toBe(theShareOfAProvinceAnExploreOrderMaps('forest', 3, false, 1.2));
    expect(T.exploreGainFor(c, 'mountain')).toBe(
      theShareOfAProvinceAnExploreOrderMaps('mountain', 3, false, 1.2 * 1.5),
    );
    g['currentReport'] = { exploreDiscMult: { forest: 2 }, discoveries: [{ desc: 'Your scouts map 20% more' }] };
    expect(T.exploreGainFor(c, 'forest')).toBe(theShareOfAProvinceAnExploreOrderMaps('forest', 3, false, 2));
    const trail = hero({ skills: { explorer: 3 }, minorHeld: [{ name: 'The Trailblazer' }] });
    expect(T.exploreGainFor(trail, 'forest')).toBe(theShareOfAProvinceAnExploreOrderMaps('forest', 3, true, 2));
    expect(() => T.exploreGainFor(hero({ minorHeld: [null] }), 'forest')).toThrow();
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
        orders: { h1: [{ action: 'Recruit Armies', target: 'Militia|1, Militia |1,merc:5,to:garrison,|2' }] },
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
    g['currentReport'] = {
      characters: [hero(), ally, hero({ id: 'h3' }), hero({ id: 'h4' })],
    };
    g['_draftOrdersSnapshot'] = {
      h2: [{ action: 'Research', target: 'Arcana' }],
      h3: [{ action: 'Research', target: 'Arcana' }],
      h4: [{ action: 'Research', target: 'Lore' }],
    };
    expect(T.defaultResearchField(hero(), 0)).toBe('Arcana');
  });
});

describe("order-targets.ts: the Search Lair's default", () => {
  test('the weakest lair, by its place on a tie; a grade the ranks lack counts after Legendary', () => {
    g['currentReport'] = { characters: [hero()] };
    stage('');
    const lairs = [
      { idx: 3, monsterPower: 'Weak' },
      { idx: 1, monsterPower: 'Weak' },
      { idx: 0, monsterPower: 'Legendary' },
    ];
    expect(T.defaultLairTarget(hero(), 0, 7, lairs)).toBe('1');
    expect(
      T.defaultLairTarget(hero(), 0, 7, [
        { idx: 4, monsterPower: 'Odd' },
        { idx: 5, monsterPower: 'Legendary' },
      ]),
    ).toBe('5');
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
  test("the Use Item field offers the Philosopher's Stone a lair deals, and not a passive item", () => {
    // the Stone as a lair deals it (its power `promoteAll`, a Legendary relic), and a ring whose power is always active
    const stone = {
      id: 41,
      name: "Philosopher's Stone",
      desc: 'Once per game: instantly promote all armies',
      tier: 4,
      effect: { stat: 'promoteAll' },
    };
    const ring = {
      id: 42,
      name: 'Ring of the Explorer',
      desc: 'Explore +10%',
      tier: 1,
      effect: { stat: 'explore', bonus: 10 },
    };
    const offered = (items: unknown[]) => {
      g['currentReport'] = { characters: [hero({ items })] };
      stage('');
      const box = page.createElement('template');
      box.innerHTML = String(field({ items }, 'Use Item'));
      return [...box.content.querySelectorAll('option')].map((o) => o.getAttribute('value'));
    };
    expect({ withTheStone: offered([stone, ring]), ringAlone: offered([ring]) }).toEqual({
      withTheStone: ['41'],
      ringAlone: [],
    });
  });
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
    g['currentReport'] = report(
      [
        prov(7, { tier: 'owned' }),
        prov(9, { tier: 'owned', consecrated: true }),
        prov(11, { tier: 'owned', consecrated: true }),
      ],
      { homeProvinceId: 3, theConsecrationsItsKingMayHold: 1 },
    );
    expect(say()).toContain('You already hold 2/1 consecrated province (the most');
  });
  test("the Call to Arms field offers each owned province of a people's, none of the wild's or the sea's (B-06ak)", () => {
    // the wild's race alone (`Primal`), one of its sub-races and any race that starts with it are the wild's, as the
    // turn asks it (isTheRaceTheWildsOrOneOfItsSubRaces); a province of no race is a people's
    stage('');
    const prov = (id: number, race: string | undefined, terrain = 'plains') => ({
      id,
      name: `P${String(id)}`,
      race,
      terrain,
    });
    const king = { isKing: true };
    const offered = (provinces: unknown[]) => {
      g['currentReport'] = { characters: [hero(king)], kingdom: { alignment: 'Good' }, ownedProvinces: provinces };
      const box = page.createElement('template');
      box.innerHTML = String(field(king, 'Call to Arms'));
      return [...box.content.querySelectorAll('option')].map((o) => o.value);
    };
    expect(
      offered([
        prov(1, 'Human'),
        prov(2, 'Primal'),
        prov(3, 'Primal:Stone Giant'),
        prov(4, 'Primalish'),
        prov(5, undefined),
        prov(6, 'Elven', 'sea'),
        prov(7, 'Orcish'),
      ]),
    ).toEqual(['1', '5', '7']);
    expect(placeholderOf(field(king, 'Call to Arms'))).toBe('');
    g['currentReport'] = {
      characters: [hero(king)],
      kingdom: { alignment: 'Good' },
      ownedProvinces: [prov(2, 'Primal'), prov(3, 'Primal:Wolf')],
    };
    expect(placeholderOf(field(king, 'Call to Arms'))).toBe('No owned humanoid provinces to raise');
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
    const turns = (n: number) => {
      g['currentReport'] = {
        characters: [hero()],
        kingdom: { alignment: 'Pagan', theTurnsAWildHuntServesBeyondThisOne: n },
        provinceOrderData: { 7: { features: [{ ritualSite: true, name: 'the Grey Stones' }], wildHuntType: 'Wolves' } },
      };
      return words(field({}, 'Perform Rite'));
    };
    expect(turns(1)).toContain('serve until end of NEXT turn');
    expect(turns(3)).toContain('serve until end of 3 turns after this one');
    const box = page.createElement('template');
    box.innerHTML = String(f);
    const marks = [...box.content.querySelectorAll('select.bo-sel')].map(
      (sel) => sel.querySelector('option[selected]')?.getAttribute('value') ?? '',
    );
    expect(marks).toEqual(['S', 'E']);
  });
  test('the Hire Hero field of a realm of none prices and refuses as the alignment its row names (B-06br)', () => {
    stage('');
    const hireField = (kingdom: Record<string, unknown>) => {
      g['currentReport'] = {
        characters: [hero()],
        kingdom,
        provinceOrderData: {
          7: {
            availableHeroes: [
              { id: 21, name: 'Brother Ash', race: 'Human', alignment: 'Evil', skills: {} },
              { id: 22, name: 'Mother Fen', race: 'Elven', alignment: 'Undead', skills: {}, hireWage: null },
            ],
          },
        },
      };
      return words(field({}, 'Hire Hero'));
    };
    const asTheRow = hireField({ alignment: THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS });
    expect(asTheRow, 'the refusal names the crown').toContain(
      `will NOT serve a ${THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS} crown`,
    );
    expect(asTheRow, 'the price counts the steps from it').toContain(
      `steps from ${THE_ALIGNMENT_A_REALM_OF_NONE_READS_AS}`,
    );
    expect(hireField({}), 'a realm of no alignment').toBe(asTheRow);
    expect(hireField({ alignment: '' }), 'a realm of an empty alignment').toBe(asTheRow);
  });
  test("the Research forecast adds the Neutral scholars' points for a Neutral realm alone, its words as they were (B-06bs)", () => {
    stage('');
    // the realm's alignment and the scholar's Sage (raw, and one past the cap of 5) pinned; no field of study
    const forecast = (alignment: string | undefined, c: Record<string, unknown>) => {
      g['currentReport'] = { characters: [hero(c)], kingdom: { alignment }, researchCategories: [] };
      return words(field(c, 'Research')).split('Discoveries are permanent')[0]?.trim();
    };
    const sage3 = { skills: { sage: 3 } };
    expect(forecast('Neutral', sage3)).toBe(
      'Any field of study 📜 Rolls for a Sage discovery: about 30% (Sage 3, Neutral scholars).',
    );
    expect(forecast('Neutral', { skills: { sage: 7 } }), 'the Sage counts up to 5').toBe(
      'Any field of study 📜 Rolls for a Sage discovery: about 50% (Sage 5, Neutral scholars).',
    );
    for (const alignment of ['Good', 'Druidic', 'Evil', '', undefined])
      expect(forecast(alignment, sage3), `a realm of ${String(alignment)}`).toBe(
        'Any field of study 📜 Rolls for a Sage discovery: about 15% (Sage 3).',
      );
    const unseen = { ...sage3, _hiddenSkills: true };
    expect(forecast('Neutral', unseen), "a Neutral realm's hero of hidden skills").toBe(
      'Any field of study 📜 Rolls for a Sage discovery: 5% per Sage level (doubled for Neutral scholars) — Ser Vell’s level is hidden from you; without Sage training the search fails.',
    );
    expect(forecast('Good', unseen), "another realm's hero of hidden skills").toBe(
      'Any field of study 📜 Rolls for a Sage discovery: 5% per Sage level — Ser Vell’s level is hidden from you; without Sage training the search fails.',
    );
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
    g['currentReport'] = {
      characters: [hero()],
      provinceOrderData: { 7: { canRecruit: true, name: 'Ashmere', armyTypes: [{ type: 'Militia', maxPerTurn: 2 }] } },
    };
    const boxes = (target: string) => {
      const box = page.createElement('template');
      box.innerHTML = String(field({}, 'Recruit Armies', { target }));
      return [...box.content.querySelectorAll('input[type=checkbox]')].map(
        (b) => `${b.getAttribute('value') ?? ''}${b.hasAttribute('checked') ? '+' : ''}`,
      );
    };
    expect(boxes('Militia|1')).toEqual(['Militia|1+', 'Militia|1']);
    expect(words(field({}, 'Recruit Armies'))).toContain('1× Militia (2g)');
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
  test('the Cast Spell field opens on the saved spell where it is still castable', () => {
    const c = hero({ skills: { white: 3 } });
    g['currentReport'] = { characters: [c], kingdom: {} };
    stage('');
    const rows = T.theSpellsTheCastSpellFieldOffersAHeroInAPhase(c, 0, { kingdom: {} })._spellRows;
    const second = rows[1];
    if (!second) throw new Error('fewer than two spell rows');
    const box = page.createElement('template');
    box.innerHTML = String(T.buildTargetField(c, 0, { action: 'Cast Spell', target: second.spell }));
    expect(box.content.querySelector('option[selected]')?.getAttribute('value')).toBe(second.spell);
    box.innerHTML = String(T.buildTargetField(c, 0, { action: 'Cast Spell', target: 'No Such Spell' }));
    expect(box.content.querySelector('option[selected]')?.getAttribute('value')).toBe(rows[0]?.spell);
  });
  test("an earlier phase's Cast Spell spends its school's cast", () => {
    const c = hero({ skills: { white: 1 } });
    g['currentReport'] = { characters: [c], kingdom: {} };
    stage('');
    const first = T.theSpellsTheCastSpellFieldOffersAHeroInAPhase(c, 0, { kingdom: {} })._spellRows[0];
    if (!first) throw new Error('no spell row');
    stage(
      `<select id="po-action-h1-0"><option value="Cast Spell" selected>c</option></select><input id="po-target-h1-0" value="${first.spell}">`,
    );
    const later = T.theSpellsTheCastSpellFieldOffersAHeroInAPhase(c, 1, { kingdom: {} })._spellRows[0];
    expect(later?.label).toContain('limit reached: 1/1 this turn');
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

describe("order-targets.ts: a draft's order read before the form exists (P1-16h1)", () => {
  test('the saved phase as it was saved, and none where the draft holds no hero or no phase', () => {
    stage('');
    g['_draftOrdersSnapshot'] = { h7: [{ action: 'Move', target: 4 }, null] };
    expect(T.draftOrderAt('h7', 0)).toEqual({ action: 'Move', target: 4 });
    expect(T.draftOrderAt('h7', 1)).toEqual({ action: '', target: '' });
    expect(T.draftOrderAt('h7', 2)).toEqual({ action: '', target: '' });
    expect(T.draftOrderAt('h8', 0)).toEqual({ action: '', target: '' });
    g['_draftOrdersSnapshot'] = undefined;
    expect(T.draftOrderAt('h7', 0)).toEqual({ action: '', target: '' });
  });
});
