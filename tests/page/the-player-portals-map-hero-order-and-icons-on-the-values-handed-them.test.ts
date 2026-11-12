// The player portal's map, its popup, its icons and zoom, and the hero order (plan P1-16e): the lines P1-16e changed in
// map.ts that the screen tours don't reach, or reach only in part (npm run proof:tours), each run here on the value that
// reaches it, so a fault planted in one is red: the fullscreen map of a staged report (a province two realms share, a
// battle still raging and a duel, a capital as last seen, graves read on an earlier turn, a province with no place),
// the popup held open and closed, a province lit from the report, an icon kind hidden, the zoom, and the hero order
// moved, grouped and written into the orders the seat holds.
// Level 4 (page): map.ts loads the page's start-up (its database client), so no lower level reaches it; the portal is
// booted in jsdom (tests/lib/boot.js) on the fake Db at an older database, so it stops at its notice with every
// module loaded, and its client is one that records the hero order's write.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';

const writes: { table: string; val: unknown; eq: unknown[] }[] = [];
const errs: string[] = [];
let P: PageWindow;
let doc: Document;
const call = (name: string, ...args: unknown[]): unknown => {
  const f: unknown = P[name];
  if (typeof f !== 'function') throw new Error(`the page has no function ${name}`);
  return Reflect.apply(f, undefined, args);
};
const stage = (code: string): unknown => P.eval(code);

beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: {
      createClient: () => ({
        from: (table: string) => ({
          update: (val: unknown) => ({
            eq: (...eq: unknown[]) => {
              writes.push({ table, val, eq });
              return Promise.resolve({ error: null });
            },
          }),
        }),
      }),
    },
    db: makeAFakeDb(['20261010000000']).db,
    url: 'https://example.org/p',
    setup(w) {
      w.addEventListener('error', (e) => errs.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }).window;
  doc = P['document'] as Document;
  await new Promise((resolve) => setTimeout(resolve, 600));
  // the one error the boot gives: the older database's notice, where the page stops
  const bootErrors = errs.map((e) => e.split(' (database')[0]).join('; ');
  if (bootErrors !== 'The game is being updated. Try again in a few minutes.')
    throw new Error(`the page booted with other errors: ${bootErrors}`);
  errs.length = 0;
});
afterAll(() => {
  P.close();
});

const REPORT = {
  turn: 5,
  turnNumber: 5,
  kingdom: { color: '#123456' },
  playerIndex: 0,
  ownedProvinces: [{ id: 1, name: 'Home Vale', tax: 9, characters: [{ id: 'own-only', isOwn: true }] }],
  visitedProvinceIds: [2, 3],
  visibleDeadHeroes: [{ id: 'd1', name: 'Fallen', locationId: 3 }],
  graveIntel: [{ provinceId: 3, turn: 2, detail: [{ n: 1, k: 'Infantry' }] }],
  worldMeta: {
    cols: 3,
    rows: 2,
    centreCol: 1,
    provinces: [
      {
        id: 1,
        row: 0,
        col: 0,
        terrain: 'plain',
        name: 'Home Vale',
        tier: 'owned',
        characters: [{ id: 'k', isOwn: true, isKing: true, armyCount: 2 }],
        garrisonArmies: [{ type: 'Infantry' }],
      },
      {
        id: 2,
        row: 0,
        col: 1,
        terrain: 'forest',
        name: 'Shared Wood',
        tier: 'live',
        ownerName: 'Red Realm',
        ownerColor: '#a03030',
        isHomeCapitalOfOwner: true,
        battleUnresolved: true,
        hadCombat: true,
        characters: [
          { id: 'r', ownerColor: '#a03030', ownerName: 'Red Realm' },
          { id: 'b', ownerColor: '#3030a0', ownerName: 'Blue Realm' },
          { id: 'b2', ownerColor: '#3030a0', ownerName: 'Blue Realm' },
        ],
      },
      {
        id: 3,
        row: 1,
        col: 0,
        terrain: 'hill',
        name: 'Grave Hill',
        tier: 'remembered',
        ownerName: 'Red Realm',
        ownerColor: '#a03030',
        isHomeCapitalOfOwner: true,
        hadBattle: true,
        hadCombat: true,
        features: [{ name: 'Old Stones', ritualSite: true }],
        grandDesign: { name: 'A Wonder' },
      },
      { id: 4, row: 1, terrain: 'sea', name: 'No Column' },
    ],
  },
};

describe('map.ts: the fullscreen map of a staged report', () => {
  test('the markers, their places and titles, and the map sized from its view box', () => {
    stage(`viewingReport = null; currentReport = ${JSON.stringify(REPORT)};`);
    call('showFullscreenMap');
    const svg = doc.querySelector('#map-fullscreen-modal svg');
    expect(svg?.getAttribute('viewBox')).toBe('-11 -11 184.25 121.44');
    const style = svg?.getAttribute('style') ?? '';
    expect(style).toContain('width: 1500px');
    expect(style).toContain('height: 989px');
    const hexes = [...doc.querySelectorAll('#map-fullscreen-modal g[data-prov]')].map((g) =>
      g.getAttribute('data-prov'),
    );
    expect(hexes, 'a province with no column is not drawn').toEqual(['1', '2', '3']);
    const titles = [...doc.querySelectorAll('#map-fullscreen-modal title')].map((t) => t.textContent);
    expect(titles).toContain('Garrison: 1 unit holding this province');
    expect(titles).toContain('Battle still raging here — it will carry on next turn');
    expect(titles).toContain('Battle fought here this turn');
    expect(titles.filter((t) => t.startsWith('Personal combat fought here this turn'))).toHaveLength(2);
    expect(titles).toContain("Red Realm's home capital");
    expect(titles).toContain("Red Realm's home capital — as last seen");
    expect(titles).toContain(
      'Battlefield graves were here as of turn 2 — they may since have been raised or rotted away.',
    );
    const wedges = [...doc.querySelectorAll('#map-fullscreen-modal .sym-char path')]
      .map((p) => p.getAttribute('d') ?? '')
      .filter((d) => d.includes(' A'));
    expect(wedges).toEqual([
      'M71.5,12 L71.50,7.50 A4.5,4.5 0 0,1 71.50,16.50 Z',
      'M71.5,12 L71.50,16.50 A4.5,4.5 0 0,1 71.50,7.50 Z',
    ]);
    const at = (cls: string) =>
      [...doc.querySelectorAll(`#map-fullscreen-modal .${cls}`)].map(
        (n) => `${n.getAttribute('x') ?? n.getAttribute('transform') ?? ''},${n.getAttribute('y') ?? ''}`,
      );
    expect(at('sym-battle')).toEqual(['60.5,12', '41.25,45.44']);
    expect(at('sym-combat')).toEqual(['72.5,12', '53.25,45.44']);
    expect(at('sym-capital')).toEqual(['46.86,18.81', '27.61,52.25']);
    expect(
      doc.querySelector('#map-fullscreen-modal .sym-capital text, #map-fullscreen-modal text.sym-capital'),
    ).not.toBeNull();
    const own = doc.querySelector('#map-fullscreen-modal polygon[stroke="#123456"]');
    expect(own?.getAttribute('stroke-width'), "the realm's own outline in its colour").toBe('2.5');
    const markers = [...doc.querySelectorAll('#map-fullscreen-modal .sym-char')].map((m) =>
      m.getAttribute('transform'),
    );
    expect(markers).toEqual([
      'translate(33 12) scale(0.75) translate(-33 -12)',
      'translate(71.5 12) scale(0.75) translate(-71.5 -12)',
    ]);
    expect(errs).toEqual([]);
  });

  test('a report with no map, and one with no provinces, draw only the notice or nothing', () => {
    stage(`currentReport = ${JSON.stringify({ worldMeta: null })};`);
    call('showFullscreenMap');
    expect(doc.querySelector('#map-fullscreen-modal svg text')?.textContent).toBe(
      'Map not available — awaiting Turn 0',
    );
    stage(`currentReport = ${JSON.stringify({ worldMeta: { cols: 2, rows: 1, provinces: [] } })};`);
    call('showFullscreenMap');
    expect(doc.querySelector('#map-fullscreen-modal svg')?.childNodes.length).toBe(0);
    stage(
      `currentReport = ${JSON.stringify({ worldMeta: { cols: 0, rows: 1, provinces: [{ id: 9, row: 0, col: 0, terrain: 'plain' }] } })};`,
    );
    call('showFullscreenMap');
    expect(doc.querySelectorAll('#map-fullscreen-modal g[data-prov]').length).toBe(1);
    stage('currentReport = null; viewingReport = null;');
    call('showFullscreenMap');
    expect(doc.querySelector('#map-fullscreen-modal svg')?.getAttribute('style')).toContain('height: 688px');
  });

  test('the popup: held open by a tap, kept on leaving, closed by a tap outside, Escape and its button', () => {
    stage(`currentReport = ${JSON.stringify(REPORT)};`);
    call('showFullscreenMap');
    const hex = doc.querySelector('#map-fullscreen-modal g[data-prov="2"]');
    const tt = doc.getElementById('map-tooltip');
    const MouseEv = P['MouseEvent'] as typeof MouseEvent;
    hex?.dispatchEvent(new MouseEv('click', { bubbles: true, clientX: 10, clientY: 20 }));
    expect(tt?.style.display).toBe('block');
    expect(tt?.style.pointerEvents).toBe('auto');
    expect(tt?.textContent).toContain('Shared Wood');
    expect(tt?.textContent, 'its ground and an unknown wealth').toContain('Forest · ?');
    hex?.dispatchEvent(new MouseEv('mouseleave'));
    expect(tt?.style.display, 'a popup held open stays on leaving').toBe('block');
    tt?.dispatchEvent(new MouseEv('click', { bubbles: true }));
    expect(tt?.style.display, 'a tap inside keeps it').toBe('block');
    doc.body.dispatchEvent(new MouseEv('click', { bubbles: true }));
    expect(tt?.style.display, 'a tap outside closes it').toBe('none');
    hex?.dispatchEvent(new MouseEv('mousemove', { clientX: 1, clientY: 2 }));
    expect(tt?.style.display).toBe('block');
    hex?.dispatchEvent(new MouseEv('mouseleave'));
    expect(tt?.style.display, 'a hover popup hides on leaving').toBe('none');
    hex?.dispatchEvent(new MouseEv('click', { bubbles: true }));
    doc.dispatchEvent(new (P['KeyboardEvent'] as typeof KeyboardEvent)('keydown', { key: 'Escape' }));
    expect(tt?.style.display).toBe('none');
    hex?.dispatchEvent(new MouseEv('click', { bubbles: true }));
    call('_closeMapTip');
    expect(tt?.style.display).toBe('none');
    expect(tt?.style.pointerEvents).toBe('none');
    hex?.dispatchEvent(new MouseEv('click', { bubbles: true }));
    doc.body.dispatchEvent(new (P['Event'] as typeof Event)('click', { bubbles: true }));
    expect(tt?.style.display).toBe('none');
  });

  test("the own-army banner: where the realm's own hero leads an army, never where only a rival's does", () => {
    // Province 1 is held, with no hero list on the map: the held province's own list is read, as the view writes it
    // (each hero's army count, a rival's too). Province 2's own hero leads an army.
    const flagged = {
      kingdom: { color: '#123456' },
      playerIndex: 0,
      ownedProvinces: [
        {
          id: 1,
          name: 'Held Vale',
          characters: [{ id: 'rival', isOwn: false, ownerName: 'Red Realm', ownerColor: '#a03030', armyCount: 3 }],
        },
        { id: 2, name: 'Home Wood' },
      ],
      worldMeta: {
        cols: 2,
        rows: 1,
        centreCol: 0,
        provinces: [
          { id: 1, row: 0, col: 0, terrain: 'plain', name: 'Held Vale', tier: 'owned' },
          {
            id: 2,
            row: 0,
            col: 1,
            terrain: 'forest',
            name: 'Home Wood',
            tier: 'owned',
            characters: [{ id: 'own', isOwn: true, armyCount: 2 }],
          },
        ],
      },
    };
    stage(`viewingReport = null; currentReport = ${JSON.stringify(flagged)};`);
    call('showFullscreenMap');
    const flags = [...doc.querySelectorAll('#map-fullscreen-modal .sym-flag')].map((f) => f.getAttribute('x'));
    expect(flags, "one banner, at the bottom left of the own hero's province").toEqual(['8']);
    expect(errs).toEqual([]);
  });

  test("a province lit from the report: its hex's outline, and taken off again", () => {
    stage(`currentReport = ${JSON.stringify(REPORT)};`);
    call('showFullscreenMap');
    call('highlightMapProv', 2, true);
    const lit = [...doc.querySelectorAll('.prov-hl')];
    expect(lit).toHaveLength(1);
    const hexPoly = doc.querySelector('#map-fullscreen-modal g[data-prov="2"] polygon');
    expect(lit[0]?.getAttribute('points')).toBe(hexPoly?.getAttribute('points'));
    expect(lit[0]?.getAttribute('stroke')).toBe('#ffe27a');
    expect(lit[0]?.parentNode).toBe(doc.querySelector('#map-fullscreen-modal svg'));
    call('highlightMapProv', 2, false);
    expect(doc.querySelectorAll('.prov-hl')).toHaveLength(0);
    call('highlightMapProv', 99, true);
    expect(doc.querySelectorAll('.prov-hl')).toHaveLength(0);
  });
});

describe('map.ts: the icons and the zoom', () => {
  test('an icon kind hidden and shown again, its button dimmed and struck through', () => {
    const bar = doc.getElementById('map-icon-toggles');
    if (bar) bar.innerHTML = '<button data-icon="battle"></button><button data-icon="flag"></button>';
    call('toggleMapIcon', 'battle');
    expect(doc.getElementById('map-icon-style')?.textContent).toBe('.sym-battle{display:none!important;}');
    const [battle, flag] = [...doc.querySelectorAll('#map-icon-toggles button')].filter(
      (b) => b instanceof (P['HTMLElement'] as typeof HTMLElement),
    );
    expect(battle?.getAttribute('style')).toContain('opacity: 0.4');
    expect(battle?.getAttribute('style')).toContain('line-through');
    expect(flag?.getAttribute('style')).toContain('opacity: 1');
    call('toggleMapIcon', 'battle');
    expect(doc.getElementById('map-icon-style')?.textContent).toBe('');
    expect(battle?.getAttribute('style')).toContain('text-decoration: none');
  });

  test('the zoom sizes the map’s wrapper by the container, and 0 sets it back', () => {
    call('mapZoom', 1);
    const wrap = doc.getElementById('report-map-zoomwrap');
    expect(wrap?.style.width).toBe('616px');
    expect(wrap?.style.height).toBe('616px');
    call('mapZoom', 5);
    expect(wrap?.style.width).toBe('1232px');
    call('mapZoom', 0);
    expect(wrap?.style.width).toBe('100%');
    call('mapZoom', -1);
    expect(wrap?.style.width).toBe('100%');
  });
});

describe('map.ts: the hero order', () => {
  const blocks = () =>
    [...doc.querySelectorAll('#orders-form > .orders-char-block[data-hero]')].map((b) => b.getAttribute('data-hero'));
  const stageForm = () => {
    const form = doc.getElementById('orders-form');
    if (form)
      form.innerHTML =
        '<div class="orders-char-block" data-hero="h1"></div><div class="orders-char-block" data-hero="h2"></div><div id="under-h2"></div><div class="orders-char-block" data-hero="h3"></div>';
  };
  const lastWrite = () => {
    const w = writes.at(-1);
    const val = w?.val;
    const orders: unknown = val && typeof val === 'object' ? Reflect.get(val, 'orders') : undefined;
    return {
      table: w?.table,
      eq: w?.eq,
      orders: typeof orders === 'string' ? (JSON.parse(orders) as unknown) : orders,
    };
  };

  test('moved down and up, each card with its hero, the arrangement written into the orders the seat holds', async () => {
    stageForm();
    stage(
      `currentReport = { _liveTurn: 7, turn: 6 }; currentGamePlayer = { id: 'gp1', orders: ${JSON.stringify(JSON.stringify({ orders: { h1: [1] }, forTurn: 4 }))} };`,
    );
    call('moveHeroBlock', 'h1', 1);
    expect(blocks()).toEqual(['h2', 'h1', 'h3']);
    expect(doc.getElementById('under-h2')?.previousElementSibling?.getAttribute('data-hero')).toBe('h2');
    expect(stage('_heroOrder.join()')).toBe('h2,h1,h3');
    expect(lastWrite()).toEqual({
      table: 'game_players',
      eq: ['id', 'gp1'],
      orders: { orders: { h1: [1] }, forTurn: 4, encounterPlans: {}, heroOrder: ['h2', 'h1', 'h3'] },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stage('typeof currentGamePlayer.orders')).toBe('string');
    stage('currentGamePlayer.orders = { orders: { h2: [] }, encounterPlans: { h2: 1 } };');
    call('moveHeroBlock', 'h3', -1);
    expect(blocks()).toEqual(['h2', 'h3', 'h1']);
    expect(lastWrite().orders).toEqual({
      orders: { h2: [] },
      encounterPlans: { h2: 1 },
      forTurn: 7,
      heroOrder: ['h2', 'h3', 'h1'],
    });
    stage("currentGamePlayer.orders = 'not json'; currentReport = { _liveTurn: 0, turn: 6 };");
    call('moveHeroBlock', 'h2', 1);
    expect(lastWrite().orders).toEqual({ orders: {}, encounterPlans: {}, forTurn: 6, heroOrder: ['h3', 'h2', 'h1'] });
    stage("currentGamePlayer.orders = ''; currentReport = null;");
    call('moveHeroBlock', 'h1', -1);
    expect(lastWrite().orders).toEqual({ orders: {}, encounterPlans: {}, forTurn: 1, heroOrder: ['h3', 'h1', 'h2'] });
    stage('currentGamePlayer.orders = 5;');
    call('moveHeroBlock', 'h2', -1);
    expect(lastWrite().orders).toEqual({ orders: {}, encounterPlans: {}, forTurn: 1, heroOrder: ['h3', 'h2', 'h1'] });
    stage('currentGamePlayer.orders = [];');
    call('moveHeroBlock', 'h3', 1);
    expect(lastWrite().orders).toEqual([]);
    const before = writes.length;
    call('moveHeroBlock', 'h1', 1);
    call('moveHeroBlock', 'nobody', 1);
    expect(blocks(), 'no move past the end, or of a hero not listed').toEqual(['h2', 'h3', 'h1']);
    stage("currentGamePlayer = { id: '' };");
    call('moveHeroBlock', 'h1', -1);
    stage("currentGamePlayer = { id: 'gp1' }; document.getElementById('prev-report-banner').style.display = 'block';");
    call('moveHeroBlock', 'h1', -1);
    stage("document.getElementById('prev-report-banner').style.display = '';");
    expect(writes.length, 'no write with no seat, or while a past report shows').toBe(before);
    expect(blocks()).toEqual(['h1', 'h2', 'h3']);
  });

  test('grouped by province, first seen first; none held where nothing moves', () => {
    stageForm();
    stage(
      `currentGamePlayer = { id: 'gp2', orders: null }; currentReport = { turn: 3, characters: [{ id: 'h1', locationId: 11 }, { id: 'h2', locationName: 'Fen' }, { id: 'h3', locationId: 11 }] };`,
    );
    call('groupHeroesByLocation');
    expect(blocks()).toEqual(['h1', 'h3', 'h2']);
    expect(doc.getElementById('under-h2')?.previousElementSibling?.getAttribute('data-hero')).toBe('h2');
    expect(lastWrite()).toEqual({
      table: 'game_players',
      eq: ['id', 'gp2'],
      orders: { orders: {}, encounterPlans: {}, forTurn: 3, heroOrder: ['h1', 'h3', 'h2'] },
    });
    const before = writes.length;
    call('groupHeroesByLocation');
    stage(
      "currentReport = { characters: [{ id: 'h1', locationName: '' }, { id: 'h3' }, { id: 'h2', locationId: 11 }] };",
    );
    call('groupHeroesByLocation');
    expect(blocks(), 'heroes with no province all stand at "?"').toEqual(['h1', 'h3', 'h2']);
    stage('currentReport = null;');
    call('groupHeroesByLocation');
    expect(writes.length).toBe(before);
    expect(errs).toEqual([]);
  });
});
