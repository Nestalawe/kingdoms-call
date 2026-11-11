// The player page's map symbols, popups, diplomacy panel, Move notice, succession panel and hero order on the values
// handed them (plan P1-16d): the lines P1-16d changed that the screen tours don't reach, or reach only in part (npm run
// proof:tours), each run here on the value that reaches it, so a fault planted in one is red.
// - map-symbols.ts: the terrain icons, a description as bullets, a chieftain's label, the popup's owner line, a marker
//   drawn as geometry or a glyph (in the hex and in HTML), the legend, the race badge, the lairs, the graves, the
//   garrison, the Terror, the Grand Design, the spied extras, the heroes known in a province (the dead with no province),
//   a hero's fame, a province link, a realm's colour, a dead hero's realm, and the diplomacy panel in each standing;
// - move-analysis.ts: the Move notice (no column handed, ships over land, a sea crossing short of lift, the footnote),
//   the direction a fresh Move opens on, the succession panel, the hero order (held, applied, the blocks and buttons),
//   a tactic's label and the encounter plan's rows.
// Level 1 (unit): the page's two files import in Node (P1-13e8); their functions called on plain values, the page's
// parts on a jsdom document set as the page's own. A page test would boot the whole page to reach each one.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { bootJsdom } from '../lib/boot.js';
import {
  MAP_SYM,
  _garrisonNote,
  _grandDesignNote,
  _graveNote,
  _lairName,
  _lairStar,
  _lairsClearedNote,
  _ownerLineP,
  _rebuildGraveIntelIndex,
  _renderDiplomacyInto,
  _tintForDarkTooltip,
  applyMapSymLegend,
  bulletizeDesc,
  deadHeroRealmTagP,
  grandDesignDesc,
  heroFameTextP,
  leadsArmiesP,
  makeTerrainIcon,
  mapRaceBadgeHtml,
  mapSymHtml,
  mapSymSvg,
  neutralCharLabel,
  popupKnownChars,
  provLinkHtml,
  provinceGrandDesignHTML,
  realmOptStyleP,
  reportColour,
  spiedExtraP,
  terrorNoteP,
} from '../../src/ui/player/map-symbols.ts';
import { GD_BY_ALIGNMENT, GUARD_POWER_COLORS_P } from '../../src/ui/player/items-and-heroes.ts';
import { unitEmoji } from '../../src/ui/player/order-chances.ts';
import {
  applyHeroOrderP,
  currentHeroOrderP,
  heirAddedTo,
  heirSelectorHTML,
  heirTotalAdded,
  heroGroupP,
  heroOrderFromOrdersP,
  lastMoveDirOf,
  poMoveModeNote,
  refreshEncounterPlan,
  refreshHeroMoveButtonsP,
  tacticLabel,
} from '../../src/ui/player/move-analysis.ts';

const html = (v: unknown): string => String(v);
const NS = 'http://www.w3.org/2000/svg';
let page: Document;
const g = globalThis as unknown as Record<string, unknown>;

beforeAll(() => {
  const { window } = bootJsdom('<!doctype html><html><body><div id="here"></div></body></html>');
  page = window['document'] as Document;
  Object.assign(globalThis, {
    document: page,
    HTMLInputElement: window['HTMLInputElement'],
    HTMLButtonElement: window['HTMLButtonElement'],
    HTMLSelectElement: window['HTMLSelectElement'],
  });
});
const stage = (inner: string) => {
  const here = page.getElementById('here');
  if (here) here.innerHTML = inner;
  return here;
};

describe('map-symbols.ts: the icons and the markers', () => {
  test('each terrain draws its glyph at the hex centre; another draws none', () => {
    const d = (t: string) =>
      makeTerrainIcon(NS, 100, 50, t).map((e) => e.getAttribute('d') ?? e.getAttribute('points'));
    expect(d('sea')).toEqual(['M92,49 q4,-4 8,0 q4,4 8,0', 'M94,53 q3,-3 6,0 q3,3 6,0']);
    expect(d('desert')).toEqual(['M88,52 q6,-8 12,0 q6,8 12,0']);
    expect(d('forest')[0]).toBe('91.5,53 95.5,45 99.5,53');
    expect(d('mountain')).toEqual(['90,55 96,45 102,55', '98,55 104,46 110,55']);
    const plain = makeTerrainIcon(NS, 100, 50, 'plain');
    expect(plain.length).toBe(7);
    expect([plain[1]?.getAttribute('x1'), plain[1]?.getAttribute('y2')]).toEqual(['100', '44']);
    expect(makeTerrainIcon(NS, 100, 50, 'jungle').length).toBe(6);
    expect(makeTerrainIcon(NS, 100, 50, 'tundra')).toEqual([]);
  });
  test('a description: nothing, one clause in bold, several as bullets', () => {
    expect(bulletizeDesc('')).toBe('');
    expect(html(bulletizeDesc('A **bold** move'))).toBe('A <strong>bold</strong> move');
    expect(html(bulletizeDesc('First. Second'))).toContain('<li style="margin-bottom:4px">Second.</li>');
  });
  test("a chieftain's and a wanderer's label", () => {
    expect(neutralCharLabel({ name: 'Orm (wandering)', isNeutralGuard: true })).toBe('Orm (local chieftain)');
    expect(neutralCharLabel(null)).toBe(' (wandering)');
  });
  test('a marker drawn as geometry carries the text node’s place, size and stroke', () => {
    const t = page.createElementNS(NS, 'text');
    t.setAttribute('font-size', '16');
    t.setAttribute('x', '10');
    t.setAttribute('y', '20');
    t.setAttribute('stroke', '#000');
    t.setAttribute('stroke-width', '0.8');
    t.setAttribute('opacity', '0.5');
    t.appendChild(page.createElementNS(NS, 'title'));
    const gEl = mapSymSvg(t, MAP_SYM.dead);
    expect(gEl.getAttribute('transform')).toBe('translate(10 13.6) scale(1.6)');
    expect(gEl.getAttribute('opacity')).toBe('0.5');
    const path = gEl.querySelector('path');
    expect([path?.getAttribute('stroke'), path?.getAttribute('stroke-width'), path?.getAttribute('fill')]).toEqual([
      '#000',
      '0.5',
      '#ffffff',
    ]);
    expect(gEl.querySelector('title')).not.toBeNull();
    const bare = page.createElementNS(NS, 'text');
    bare.setAttribute('stroke', 'red');
    const g2 = mapSymSvg(bare, { ...MAP_SYM.gravesFresh, box: 0 }, '#123456');
    expect(g2.getAttribute('transform')).toBe('translate(0 -3.2) scale(0.8)');
    expect(g2.querySelector('path')?.getAttribute('stroke-width')).toBe('0.37499999999999994');
    expect(g2.querySelector('path')?.getAttribute('fill')).toBe('#123456');
    const glyph = page.createElementNS(NS, 'text');
    expect(mapSymSvg(glyph, MAP_SYM.battle).getAttribute('fill')).toBe('#ff4444');
    expect(glyph.textContent).toBe('⚔︎');
  });
  test('a marker in HTML: geometry by its fill or legend, a glyph by its colour, an emoji with none', () => {
    const geo = html(
      mapSymHtml({ glyph: 'x', text: true, fill: null, legend: '#ffffff', label: '', path: 'M0', box: 0 }),
    );
    expect(geo).toContain('viewBox="-5 -5 10 10" style="width:1em;height:1em');
    expect(geo).toContain('fill="#ffffff"');
    expect(html(mapSymHtml(MAP_SYM.capital, '#ffffff', '2em'))).toBe(
      '<span style="color:#ffffff;font-family:&#39;Noto Sans Symbols 2&#39;,&#39;Noto Sans Symbols&#39;,&#39;Segoe UI Symbol&#39;,&#39;Apple Symbols&#39;,&#39;Symbola&#39;,&#39;DejaVu Sans&#39;,sans-serif;font-size:2em">♛\uFE0E</span>',
    );
    expect(html(mapSymHtml(MAP_SYM.flag))).toContain('color:');
    expect(html(mapSymHtml(MAP_SYM.wonder))).not.toContain('color:');
  });
  test('the legend fills each swatch from the table, keeps a title, and skips an unknown key', () => {
    const root = stage(
      '<span data-mapsym="battle"></span><span data-mapsym="nope"></span><span data-mapsym="flag" data-mapcolour="" data-mapsize="" title="kept"></span><span data-mapsym="capital" data-mapcolour="#ffffff" data-mapsize="2rem"></span>',
    );
    applyMapSymLegend(root);
    const spans = [...page.querySelectorAll('[data-mapsym]')];
    expect(spans[0]?.getAttribute('title')).toBe(MAP_SYM.battle.label);
    expect(spans[1]?.innerHTML).toBe('');
    expect(spans[2]?.getAttribute('title')).toBe('kept');
    expect(spans[2]?.innerHTML).toContain('font-size:1rem');
    expect(spans[3]?.innerHTML).toContain('color:#ffffff;');
    expect(spans[3]?.innerHTML).toContain('font-size:2rem');
  });
  test('a race badge, and none for an unknown race', () => {
    expect(html(mapRaceBadgeHtml('Human'))).toContain('fill="#c9a961"');
    expect(mapRaceBadgeHtml('Gnome')).toBe('');
  });
});

describe('map-symbols.ts: the popup’s lines', () => {
  test("the owner line: unclaimed, the realm's standing by index or by name, a colour of its own", () => {
    expect(_ownerLineP(null)).toBe('Unclaimed');
    g['currentReport'] = {
      diplomacy: {
        known: [
          { index: 2, name: 'Velmar', color: '#ffffff', relation: 'allied' },
          { index: 4, name: 'Osk', relation: 'odd' },
        ],
      },
    };
    expect(html(_ownerLineP({ ownerName: 'Velmar', owner: 2 }))).toBe(
      'Owned by <strong style="color:#ffffff">Velmar</strong> <span style="color:#9be07a;font-weight:600">(Allied)</span>',
    );
    expect(html(_ownerLineP({ ownerName: 'Velmar', owner: null }))).toContain('(Allied)');
    expect(html(_ownerLineP({ ownerName: 'Osk', owner: 4, ownerColor: '#eeeeee' }))).toBe(
      'Owned by <strong style="color:#eeeeee">Osk</strong>',
    );
    g['currentReport'] = null;
    expect(html(_ownerLineP({ ownerName: 'Nobody', owner: 9 }))).toBe(
      'Owned by <strong style="color:#f2e8d0">Nobody</strong>',
    );
  });
  test('a lair: its guardian’s colour, its kind unless cleared, the default brown', () => {
    expect(html(_lairStar({ name: 'Den', monsterPower: '', power: 'Weak', monsterCat: 'Beast' }))).toBe(
      `<span style="color:${_tintForDarkTooltip(GUARD_POWER_COLORS_P.Weak)}">⭐ Den <span style="font-size:.68rem;opacity:.8">(Weak)</span> <span style="font-size:.68rem;opacity:.7">beast</span></span>`,
    );
    expect(html(_lairStar({ name: 'Pit', cleared: true, monsterCat: 'Beast' }))).toBe(
      `<span style="color:${_tintForDarkTooltip('#7a5510')}">⭐ Pit</span>`,
    );
    expect(html(_lairName({ name: 'Den', power: 'Moderate' }))).toBe('<span style="color:#c8922a">Den</span>');
    expect(_lairName({ name: 'Site' })).toBe('Site');
    expect(_lairName({})).toBe('');
    expect(_lairName(null)).toBe('');
  });
  test('the lairs cleared: not mapped, none found, all cleared (one or more), one standing', () => {
    expect(_lairsClearedNote(null)).toBe('');
    expect(_lairsClearedNote({ explored: 99 })).toBe('');
    expect(html(_lairsClearedNote({ explored: 100, features: [null, { ritualSite: true }] }))).toContain(
      'no lair was ever found',
    );
    expect(html(_lairsClearedNote({ explored: 100, features: [{ cleared: true }, { cleared: true }] }))).toContain(
      'all 2 lairs have',
    );
    expect(html(_lairsClearedNote({ explored: 100, features: [{ cleared: true }] }))).toContain('its lair has');
    expect(_lairsClearedNote({ explored: 100, features: [{ cleared: true }, {}] })).toBe('');
  });
  test('no graves are read before the first report', async () => {
    vi.resetModules();
    const fresh = await import('../../src/ui/player/map-symbols.ts');
    expect(fresh._graveNote({ id: 3 })).toBe('');
  });
  test('the graves: a partial roll this turn, a bare sensing, none known', () => {
    _rebuildGraveIntelIndex({
      turnNumber: 5,
      graveIntel: [
        null,
        { provinceId: null },
        { provinceId: 3, turn: 5, detail: [{ n: 2, k: 'Pikemen' }], detailPartial: true },
        { provinceId: 4 },
      ],
    });
    const fresh = html(_graveNote({ id: 3 }));
    expect(fresh).toContain(
      'Battlefield graves: at least 2× Pikemen</span> <span style="opacity:.75">(known turn 5)</span>',
    );
    expect(fresh).toContain('Grave-sight names only');
    expect(html(_graveNote({ id: 4 }))).toContain('(known turn ?)');
    expect(html(_graveNote({ id: 4 }))).toContain('how many, and what they hold, is unknown');
    expect(_graveNote({ id: 9 })).toBe('');
    expect(_graveNote(null)).toBe('');
    _rebuildGraveIntelIndex(null);
    expect(_graveNote({ id: 3 })).toBe('');
  });
  test('the garrison: counted by kind, the owner named on live ground, nothing on the border', () => {
    expect(
      html(
        _garrisonNote({
          tier: 'live',
          ownerName: 'Velmar',
          garrisonArmies: [{ type: 'Pikemen' }, { type: 'Pikemen' }, {}, { type: '' }],
        }),
      ),
    ).toBe(
      `<br>\u{1F6E1} <span style="color:#e8d8b0">4 units garrisoned (Velmar)</span> <span style="opacity:.8;font-size:.9em">— ${unitEmoji('Pikemen')} 2× Pikemen, ${unitEmoji('unit')} 2× unit</span>`,
    );
    expect(_garrisonNote({ tier: 'border', garrisonArmies: [{ type: 'Pikemen' }] })).toBe('');
    expect(_garrisonNote({ tier: 'owned', garrisonArmies: [] })).toBe('');
  });
  test('the Terror: on the light page, of your own; none at 0', () => {
    expect(html(terrorNoteP({ terror: { pct: 20, stacks: 1, byYou: true } }, true))).toBe(
      '<br><span style="color:#701010">\u{1F480} Terror 20% — 1 stack of your own: its next defenders fight at −20% (yours are spared where you hold the ground)</span>',
    );
    expect(html(terrorNoteP({ terror: { pct: 5, stacks: 2 } }))).toContain('color:#e08a8a');
    expect(terrorNoteP({ terror: { pct: 0, stacks: 1 } })).toBe('');
    expect(terrorNoteP({ terror: {} })).toBe('');
  });
  test('the Grand Design: its words by name, a fallen builder, dormant in other hands', () => {
    const first = Object.values(GD_BY_ALIGNMENT)[0];
    expect(grandDesignDesc(first?.name)).toBe(first?.desc);
    expect(grandDesignDesc('No such wonder')).toBe('');
    expect(html(_grandDesignNote({ grandDesign: { name: 'Spire' } }))).toContain('a fallen realm</strong>, dormant');
    const card = html(provinceGrandDesignHTML({ grandDesign: { name: first?.name, ownerName: '', active: true } }));
    expect(card).toContain('Raised by <strong>a fallen realm</strong>');
    expect(card).toContain('— active');
    expect(provinceGrandDesignHTML(null)).toBe('');
  });
  test('whether a hero leads troops, and what a spy read', () => {
    expect(leadsArmiesP({ leadsArmies: false, armies: 3 })).toBe(false);
    expect(leadsArmiesP({ armies: 2 })).toBe(true);
    expect(leadsArmiesP({ armies: 0 })).toBe(false);
    expect(leadsArmiesP(null)).toBe(false);
    expect(html(spiedExtraP({ spiedItems: [], spiedArmies: [] }))).toContain('🔍 Items:</span> none');
    expect(html(spiedExtraP({ spiedItems: [], spiedArmies: [] }))).toContain('no armies');
    expect(spiedExtraP({})).toBe('');
    expect(spiedExtraP(null)).toBe('');
  });
  test('the heroes known in a province: own, enemy, wanderer, chieftain, and the dead once each', () => {
    g['currentReport'] = { playerIndex: 0, allKingdoms: [{ index: 1, name: 'Osk', color: '#ffffff' }] };
    const pd = {
      id: 7,
      characters: [
        { id: 1, name: 'Ilse', isOwn: true, isKing: true, armyCount: 1 },
        { id: 2, name: 'Grim', ownerName: 'Osk', armyBand: 'a warband' },
        { id: 3, name: 'Orm (wandering)', isWanderer: true, isNeutralGuard: true, armyBand: 'no armies' },
        { id: 4, name: 'Fell', isOwn: true, armyCount: 2 },
      ],
    };
    const out = html(
      popupKnownChars(pd, [
        { id: 4, name: 'Fell', locationId: 7, player: 1 },
        { id: 4, name: 'Fell', locationId: 7, player: 1 },
      ]),
    );
    expect(out).toContain('Ilse</span> <span style="opacity:.7">(1 unit)</span>');
    expect(out).toContain('Grim of Osk</span> <span style="opacity:.7">(a warband)</span>');
    expect(out).toContain('Orm (local chieftain)</span><br>');
    expect(out.split('Fell').length).toBe(2);
    expect(out).toContain('#e05050');
    expect(html(popupKnownChars(null, [{ id: 9, name: 'Ghost', locationId: null, player: null }]))).toContain(
      'Ghost (dead)',
    );
    expect(popupKnownChars(undefined, [{ id: 9, name: 'Ghost', locationId: null }])).toBe('');
    g['currentReport'] = null;
  });
  test("a hero's fame: his top skill read or worked out, a skill of no name", () => {
    expect(heroFameTextP({ topSkill: { skill: 'melee', level: 5 } })).toBe('legendary for Melee');
    expect(heroFameTextP({ topSkill: { skill: 'zz', level: 1 } })).toBe('renowned for zz');
    expect(heroFameTextP({ skills: {} })).toBe('no notable skills');
  });
  test("a province link, a realm's colour, a dead hero's realm", () => {
    expect(provLinkHtml(null, 'X')).toBe('X');
    expect(provLinkHtml('', 'X')).toBe('X');
    expect(html(provLinkHtml(3, 'Y', 'big'))).toContain('class="prov-link big"');
    expect(html(realmOptStyleP(2, { allKingdoms: [{ index: 2, color: '#ffffff' }] }))).toBe(
      ` style="color:${reportColour('#ffffff')};font-weight:600"`,
    );
    expect(realmOptStyleP(2, { allKingdoms: [{ index: 2 }] })).toBe('');
    const rep = { playerIndex: 0, allKingdoms: [{ index: 1, name: 'Osk', color: '#000080' }, { index: 2 }] };
    expect(deadHeroRealmTagP({ player: null }, rep)).toBe('— a neutral hero, sworn to no crown');
    expect(deadHeroRealmTagP({ player: 0 }, rep, { bare: true })).toBe('your own hero');
    expect(html(deadHeroRealmTagP({ player: 1 }, rep, { dark: true }))).toBe(
      `— a hero of <span style="color:${_tintForDarkTooltip('#000080')};font-weight:600">Osk</span>`,
    );
    expect(html(deadHeroRealmTagP({ player: 2 }, rep))).toBe(
      '— a hero of <span style="font-weight:600">another realm</span>',
    );
    g['currentReport'] = { playerIndex: 3 };
    expect(deadHeroRealmTagP({ player: 3 })).toBe('— your own hero');
    g['currentReport'] = null;
  });
});

describe('map-symbols.ts: the diplomacy panel', () => {
  const panel = (report: unknown, withControls: boolean) => {
    const el = stage('');
    _renderDiplomacyInto(el, report as Parameters<typeof _renderDiplomacyInto>[1], withControls);
    return el?.innerHTML ?? '';
  };
  test('no realm known, a report of none', () => {
    expect(panel(null, true)).toContain('You have not yet encountered another realm');
  });
  test('a realm gone (conceded, extinguished) drops its pending declaration', () => {
    g['diploChoices'] = { 1: 'enemy', 2: 'treat' };
    const out = panel(
      {
        diplomacy: {
          known: [
            { index: 1, name: 'Osk', conceded: true, concededTurn: 4 },
            { index: 2, name: 'Vor', eliminated: true },
          ],
        },
      },
      true,
    );
    expect(out).toContain('This realm has withdrawn from the game');
    expect(out).toContain('This dynasty is extinguished');
    expect(out).toContain('Conceded (turn 4)');
    expect(out).toContain('Extinguished');
    expect(g['diploChoices']).toEqual({});
  });
  test('a Safe Start withdraws the controls (and a pending declaration) until its turn', () => {
    g['diploChoices'] = { 1: 'enemy' };
    const rep = {
      _liveTurn: 0,
      turn: 3,
      diplomacy: { safeStartUntil: 6, known: [{ index: 1, name: 'Osk', relation: 'neutral' }] },
    };
    const out = panel(rep, true);
    expect(out).toContain('no Treat or declaration of war may be made until the orders for Turn 6.');
    expect(out).toContain('(this is Turn 3)');
    expect(g['diploChoices']).toEqual({});
    expect(panel(rep, false)).not.toContain('Safe Start');
    expect(panel({ ...rep, _liveTurn: 7 }, true)).toContain('Propose Alliance');
  });
  test('the report view names a pending declaration; the orders view cancels it', () => {
    g['diploChoices'] = { 1: 'enemy', 2: 'treat' };
    const rep = {
      diplomacy: {
        known: [
          { index: 1, name: 'Osk', relation: 'allied', alignment: 'Good', color: '#ffffff' },
          { index: 2, name: 'Vor', relation: 'enemy', offeredUs: 'peace' },
        ],
      },
    };
    const view = panel(rep, false);
    expect(view).toContain('Pending this turn: <strong>Break Alliance</strong>');
    expect(view).toContain('Pending this turn: <strong>Propose Peace</strong>');
    expect(view).toContain('Offered peace last turn');
    expect(view).toContain(`color:${reportColour('#ffffff')}`);
    expect(view).toContain('color:#333');
    const orders = panel(rep, true);
    expect(orders).toContain('Break Alliance — Osk</strong>');
    expect(orders).toContain('cancel</button>');
  });
  test('the declarations open to each standing, with and without alliances, an Evil crown at war at once', () => {
    g['diploChoices'] = {};
    const rep = (allow: unknown, alignment: string) => ({
      kingdom: { alignment },
      diplomacy: {
        alliancesAllowed: allow,
        known: [
          { index: 1, name: 'Osk', relation: 'neutral', offeredUs: 'alliance' },
          { index: 2, name: 'Vor', relation: 'enemy' },
          { index: 3, name: 'Ael', relation: 'allied' },
        ],
      },
    });
    const open = panel(rep(true, 'Evil'), true);
    expect(open).toContain('Propose Alliance');
    expect(open).toContain('Propose Peace');
    expect(open).toContain('Break Alliance — War');
    expect(open).toContain('Offered an alliance last turn');
    expect(open).toContain('is sealed only if');
    const none = panel(rep(false, 'Good'), true);
    expect(none).not.toContain('Propose Alliance');
    expect(none).toContain('>Break Alliance</button>');
    expect(none).toContain('no alliances</strong> may be forged');
  });
  test('the declarations held as none stop the panel, as a read on none did', () => {
    g['diploChoices'] = null;
    expect(() => panel({ diplomacy: { known: [{ index: 1, name: 'Osk', relation: 'neutral' }] } }, true)).toThrow(
      TypeError,
    );
    g['diploChoices'] = {};
  });
});

describe('move-analysis.ts: the Move notice and the direction', () => {
  test('no column handed: the hero alone rides solo; his own fleet over land is refused, named', () => {
    expect(html(poMoveModeNote({ name: 'Ilse', armies: [] }, { name: '' }, null, null))).toContain(
      '<strong>Solo ride</strong> — Ilse leads no troops into <strong>that province</strong>',
    );
    const fleet = { name: 'Ilse', armies: [{ type: 'Elven Galleys' }, { type: 'Elven Galleys', unitName: 'Swan' }] };
    const out = html(poMoveModeNote(fleet, { terrain: 'plain', name: 'B' }, null, { terrain: 'plain', name: '' }));
    expect(out).toContain(
      'ships cannot cross land.</strong> Ilse would be marching from one land province (<strong>here</strong>)',
    );
    expect(out).toContain('(Elven Galleys, Swan)');
    expect(out).not.toContain('counting your');
  });
  test('a sea crossing short of lift, the footnote of the orders this turn, and no hero to name', () => {
    const host = {
      armies: [{ type: 'Pikemen' }, { type: 'Pikemen' }],
      uncounted: ['a Recruit'],
      gained: 0,
      base: 1,
      sameFrom: ['Ilse hands over'],
    };
    const out = html(poMoveModeNote({ name: 'Ilse' }, { terrain: 'sea', name: 'Gulf' }, host, { terrain: 'plain' }));
    expect(out).toContain('Not enough lift for a sea crossing.</strong> Ilse leads 2 land units but only 0 hulls');
    expect(out).toContain('hand-overs (Ilse hands over — these resolve before any move)');
    expect(out).toContain('2 units under command by then (1 more than now)');
    expect(out).toContain('not counted:</strong> a Recruit');
    expect(() => poMoveModeNote(null, null, { armies: [], uncounted: [], gained: 0, base: 0 }, null)).toThrow(
      TypeError,
    );
  });
  test('the direction a fresh Move opens on: an earlier move named by its direction, one of none', () => {
    g['currentReport'] = { worldMeta: { provinces: [], cols: 3, rows: 3 }, characters: [] };
    stage(
      '<select id="po-action-1-0"><option value="Move" selected>Move</option></select><input id="po-target-1-0" value="dir:SE"><select id="po-action-1-1"><option value="Move" selected>Move</option></select><input id="po-target-1-1" value="dir:UP">',
    );
    expect(lastMoveDirOf(1, 1)).toBe('SE');
    expect(lastMoveDirOf(1, 2)).toBe('SE');
    expect(lastMoveDirOf(2, 2)).toBe(null);
    g['currentReport'] = { characters: [] };
    expect(lastMoveDirOf(1, 2)).toBe(null);
    g['currentReport'] = null;
    expect(lastMoveDirOf(1, 2)).toBe(null);
  });
});

describe('move-analysis.ts: the succession, the hero order and the encounter plan', () => {
  test('the heir: points added on his base, the panel with his name empty', () => {
    const heir = {
      id: 5,
      _isHeir: true,
      name: '',
      skills: { melee: 3, sage: 1, white: 2 },
      _heirBase: { melee: 2, sage: 1 },
    };
    expect(heirAddedTo(heir, 'melee')).toBe(1);
    expect(heirAddedTo(heir, 'archery')).toBe(0);
    expect(heirTotalAdded(heir)).toBe(3);
    const out = html(heirSelectorHTML([{ id: 1, _isHeir: false }, heir]));
    expect(out).toContain('<input id="heir-name" value=""');
    expect(out).toContain('<strong>1</strong> remaining skill point before');
    expect(out).toContain('allocateHeirSkill(5,&quot;melee&quot;,-1)');
    expect(out).toContain('<span class="sk-val">3</span>');
    expect(out).toContain('onmouseleave="hideSkillTip()">Melee</span>');
    expect(html(heirSelectorHTML([{ id: 6, _isHeir: true }]))).toContain('<input id="heir-name" value=""');
    expect(heirSelectorHTML(null)).toBe('');
  });
  test('the hero order held: in words or as the orders, none, or unreadable', () => {
    expect(heroOrderFromOrdersP('{"heroOrder":[1,2]}')).toEqual(['1', '2']);
    expect(heroOrderFromOrdersP({ heroOrder: ['3'] })).toEqual(['3']);
    expect(heroOrderFromOrdersP({ heroOrder: [] })).toBe(null);
    expect(heroOrderFromOrdersP('')).toBe(null);
    expect(heroOrderFromOrdersP(undefined)).toBe(null);
    expect(heroOrderFromOrdersP('null')).toBe(null);
    expect(heroOrderFromOrdersP('{')).toBe(null);
  });
  test('the hero order applied: by rank, the unranked last; else the king and the heir first', () => {
    const chars = [{ id: 1 }, { id: 2, isKing: true }, { id: 3 }, { id: 4, _isHeir: true }];
    expect(applyHeroOrderP(chars, ['3', 1]).map((c) => c.id)).toEqual([3, 1, 2, 4]);
    expect(applyHeroOrderP(chars, []).map((c) => c.id)).toEqual([2, 4, 1, 3]);
    expect(applyHeroOrderP(null, null)).toEqual([]);
  });
  test("the hero blocks: a block's group, the first ▲ and last ▼ off, the order read from the page or held", () => {
    stage(
      '<div id="orders-form"><div class="orders-char-block" data-hero="a"><button class="hero-move-up"></button><span class="hero-move-down"></span></div><div class="card"></div><div class="orders-char-block" data-hero="b"><button class="hero-move-up"></button><button class="hero-move-down"></button></div></div>',
    );
    const blocks = [...page.querySelectorAll('.orders-char-block')];
    const first = blocks[0];
    if (!first) throw new Error('no block');
    expect(heroGroupP(first).length).toBe(2);
    refreshHeroMoveButtonsP();
    const buttons = [...page.querySelectorAll('button')].map((b) => b.disabled);
    expect(buttons).toEqual([true, false, true]);
    expect(currentHeroOrderP()).toEqual(['a', 'b']);
    stage('');
    g['_heroOrder'] = ['x'];
    expect(currentHeroOrderP()).toEqual(['x']);
    g['_heroOrder'] = null;
    expect(currentHeroOrderP()).toEqual([]);
  });
  test("a tactic's label (a spell, a school, a code, an unknown one) and the plan's rows", () => {
    expect(tacticLabel('CA:Fireball')).toBe('Cast Spell — Fireball');
    expect(tacticLabel('CS:white')).toBe('Pre-battle: random White Magic spell');
    expect(tacticLabel('CS:zz')).toBe('Pre-battle: random zz spell');
    expect(tacticLabel('ME')).toContain('Melee');
    expect(tacticLabel('QQ:1')).toBe('QQ:1');
    stage('<div id="ep-list-7"></div>');
    refreshEncounterPlan(7, ['ME', 'FL']);
    expect(page.querySelectorAll('#ep-list-7 > div').length).toBe(2);
    refreshEncounterPlan(8, ['ME']);
  });
});
