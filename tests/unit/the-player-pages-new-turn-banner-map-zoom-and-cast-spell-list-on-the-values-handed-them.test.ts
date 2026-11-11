// The player page's new-turn banner, map zoom and Cast Spell list on the values handed them (plan P1-21p, the mutation
// session over P1-13e6 to P1-16d): three lines its moves carried that no test read, each run here so a fault in it is
// red. The banner's refresh hides the banner (report.ts, refreshOpenReport); each zoom click sizes the map by the level
// it sets, not the one before (map.ts, mapZoom); a hero whose level in a school is just the level a mastery spell needs
// is offered it, and one level short is not (order-targets.ts, theSpellsTheCastSpellFieldOffersAHeroInAPhase).
// Level 1 (unit): the page's files import in Node (P1-13e8) once its config and the `supabase` global are stood in; the
// functions are called on a jsdom document set as the page's own. A page test would boot the whole page to reach each.
import { beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom } from '../lib/boot.js';

interface TheSpellRows {
  _spellRows: { spell: string }[];
}
let page: Document;
let refreshOpenReport: () => void;
let mapZoom: (delta: number) => void;
let spellRows: (
  c: { readonly id: string; readonly skills: Readonly<Record<string, number>> },
  ph: number,
  report: { readonly kingdom: Readonly<Record<string, never>> },
) => TheSpellRows;
let theLevelEachMasterySpellNeeds: () => Record<string, number>;
let theSchoolOfEachSpell: () => Record<string, string>;

beforeAll(async () => {
  const { window } = bootJsdom('<!doctype html><html><body><div id="here"></div></body></html>');
  page = window['document'] as Document;
  Object.assign(globalThis, {
    window,
    document: page,
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => ({}) },
  });
  ({ refreshOpenReport } = await import('../../src/ui/player/report.ts'));
  ({ mapZoom } = await import('../../src/ui/player/map.ts'));
  const targets = await import('../../src/ui/player/order-targets.ts');
  spellRows = targets.theSpellsTheCastSpellFieldOffersAHeroInAPhase;
  ({ theLevelEachMasterySpellNeeds, theSchoolOfEachSpell } =
    await import('../../src/engine/rules-on-plain-values/spells-the-order-form-offers-each-school-aim-and-mastery-level.ts'));
});
const stage = (inner: string) => {
  const here = page.getElementById('here');
  if (here) here.innerHTML = inner;
};
const byId = (id: string): HTMLElement => {
  const found = page.getElementById(id);
  if (!found) throw new Error(`no #${id}`);
  return found;
};

describe("the new-turn banner's refresh", () => {
  test('hides the banner (no report open, so none is reopened)', () => {
    stage('<div id="new-turn-banner" style="display:block">A new turn is waiting</div>');
    Reflect.set(globalThis, 'currentGamePlayerId', null);
    refreshOpenReport();
    expect(byId('new-turn-banner').style.display).toBe('none');
  });
});

describe("the map's zoom on a desktop width", () => {
  test('one + click sizes the map at twice the panel, the reset at the panel', () => {
    Reflect.set(window, 'innerWidth', 1280);
    stage('<div id="report-map-container"><div id="report-map-zoomwrap"><svg id="report-map-svg"></svg></div></div>');
    Object.defineProperty(byId('report-map-container'), 'clientWidth', { value: 412 });
    Object.defineProperty(byId('report-map-container'), 'clientHeight', { value: 312 });
    mapZoom(1);
    expect(byId('report-map-zoomwrap').style.width).toBe(String((412 - 12) * 2) + 'px');
    expect(byId('report-map-zoomwrap').style.height).toBe(String((312 - 12) * 2) + 'px');
    mapZoom(0);
    expect(byId('report-map-zoomwrap').style.width).toBe('100%');
  });
});

describe('the Cast Spell list and the level a mastery spell needs', () => {
  const offered = (level: number, spell: string, school: string): boolean => {
    stage('');
    const hero = { id: 'h-made-up', skills: { [school]: level } };
    return spellRows(hero, 0, { kingdom: {} })._spellRows.some((r) => r.spell === spell);
  };
  test.for([7, 9])('the first spell needing level %i: offered at that level, not one level short', (need) => {
    const entry = Object.entries(theLevelEachMasterySpellNeeds()).find(([, n]) => n === need);
    if (!entry) throw new Error('no mastery spell needs level ' + String(need));
    const [spell] = entry;
    const school = theSchoolOfEachSpell()[spell] ?? '';
    expect(school).not.toBe('');
    expect(offered(need, spell, school)).toBe(true);
    expect(offered(need - 1, spell, school)).toBe(false);
  });
});
