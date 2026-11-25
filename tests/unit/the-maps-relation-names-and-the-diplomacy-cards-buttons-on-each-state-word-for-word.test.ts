// The map's relation names and the Diplomacy card's buttons on each state, word for word (B-06bu): the player portal
// names how two realms stand through content's relation rows (the three states, the Treat, and the map's name for each
// state), and writes the same words it wrote when it held them as text. A province's popup names its owner's standing
// (Neutral, Allied, Enemy, each in its colour); the Diplomacy card shows each realm's badge, the buttons open to its
// standing (each sending its declaration: the Treat, or war), and a pending declaration's name in the report's view
// and the orders'.
// Level 1 (unit): map-symbols.ts imports in Node; its two functions called on made-up reports, the card on a jsdom
// document set as the page's own. No world, dice or seeded input: each report names every value the words read (the
// realm's creed, its standing, alliances allowed, the declaration pending).
import { beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom } from '../lib/boot.ts';
import {
  THE_NAME_THE_MAP_GIVES_EACH_STATE_TWO_REALMS_STAND_IN,
  THE_STATES_TWO_REALMS_STAND_IN,
  THE_TREAT_DECLARATION,
} from '../../src/content/the-relations-between-two-realms-the-three-states-a-pair-stands-in-and-the-treat-declaration.ts';
import { _ownerLineP, _renderDiplomacyInto } from '../../src/ui/player/map-symbols.ts';

let page: Document;
const g = globalThis as unknown as Record<string, unknown>;

beforeAll(() => {
  const { window } = bootJsdom('<!doctype html><html><body><div id="here"></div></body></html>');
  page = window['document'] as Document;
  Object.assign(globalThis, { document: page });
});

const THE_REALMS = [
  { index: 1, name: 'Osk', relation: 'neutral' },
  { index: 2, name: 'Vor', relation: 'allied' },
  { index: 3, name: 'Ael', relation: 'enemy' },
] as const;

test("content's relation rows: the three states, the Treat, and the map's name for each state", () => {
  expect(THE_STATES_TWO_REALMS_STAND_IN).toEqual({ atWar: 'enemy', allied: 'allied', neutral: 'neutral' });
  expect(THE_TREAT_DECLARATION).toBe('treat');
  expect(THE_NAME_THE_MAP_GIVES_EACH_STATE_TWO_REALMS_STAND_IN).toEqual({
    neutral: 'Neutral',
    allied: 'Allied',
    enemy: 'Enemy',
  });
});

describe("the popup's owner line names the standing", () => {
  test.for([
    [1, 'neutral', '#e8d8b0', 'Neutral'],
    [2, 'allied', '#9be07a', 'Allied'],
    [3, 'enemy', '#ff7a6a', 'Enemy'],
  ] as const)('realm %i, %s: (%s) in %s', ([owner, , colour, name]) => {
    g['currentReport'] = { diplomacy: { known: THE_REALMS.map((r) => ({ ...r, color: '#ffffff' })) } };
    expect(String(_ownerLineP({ ownerName: 'Velmar', owner })), `the owner line of realm ${String(owner)}`).toBe(
      `Owned by <strong style="color:#ffffff">Velmar</strong> <span style="color:${colour};font-weight:600">(${name})</span>`,
    );
    g['currentReport'] = null;
  });

  test('a word that is no state names no standing', () => {
    g['currentReport'] = { diplomacy: { known: [{ index: 4, name: 'Tam', color: '#ffffff', relation: 'Neutral' }] } };
    expect(String(_ownerLineP({ ownerName: 'Tam', owner: 4 }))).toBe(
      'Owned by <strong style="color:#ffffff">Tam</strong>',
    );
    g['currentReport'] = null;
  });
});

const BADGE = {
  neutral: '<span class="pill" style="background:#efe6cc;color:#3a2e18">🕊 Neutral</span>',
  allied: '<span class="pill" style="background:#dff0d8;color:#1d541d">🤝 Allied</span>',
  enemy: '<span class="pill" style="background:#f7d7d7;color:#701010">⚔ At war</span>',
} as const;
const button = (index: number, declaration: string, colour: string, words: string): string =>
  `<button onclick="setDiploChoice(${String(index)},&quot;${declaration}&quot;)" style="font-family:'Cinzel',serif;font-size:.68rem;padding:5px 10px;border:1px solid ${colour};background:transparent;color:${colour};border-radius:2px;cursor:pointer">${words}</button>`;
const GREEN = '#2d6a2d';
const RED = '#8a1c1c';

/** Each realm's entry on the card, by its name: its badge and its controls, as the page holds them. */
const theCard = (
  creed: string,
  alliancesAllowed: boolean,
  choices: Record<number, string>,
  withControls: boolean,
): Record<string, { badge: string; controls: string }> => {
  g['diploChoices'] = { ...choices };
  const el = page.getElementById('here');
  _renderDiplomacyInto(
    el,
    { kingdom: { alignment: creed }, diplomacy: { alliancesAllowed, known: THE_REALMS.map((r) => ({ ...r })) } },
    withControls,
  );
  const entries: Record<string, { badge: string; controls: string }> = {};
  for (const entry of Array.from(el?.children ?? [])) {
    const name = entry.querySelector('strong')?.textContent ?? '';
    const header = entry.children[0];
    const controls = entry.children[1];
    if (!header || !controls) continue;
    entries[name] = { badge: header.querySelector('.pill')?.outerHTML ?? '', controls: controls.innerHTML };
  }
  return entries;
};

describe("the Diplomacy card's badges and buttons on each standing", () => {
  test('alliances allowed, a Good crown: Neutral may propose an alliance or declare war; at war, propose peace; allied, break it', () => {
    const card = theCard('Good', true, {}, true);
    expect(card['Osk'], 'Neutral').toEqual({
      badge: BADGE.neutral,
      controls: `${button(1, 'treat', GREEN, 'Propose Alliance')} ${button(1, 'enemy', RED, 'Declare War')}`,
    });
    expect(card['Vor'], 'Allied').toEqual({ badge: BADGE.allied, controls: button(2, 'enemy', RED, 'Break Alliance') });
    expect(card['Ael'], 'at war').toEqual({ badge: BADGE.enemy, controls: button(3, 'treat', GREEN, 'Propose Peace') });
  });

  test('no alliances, an Evil crown: Neutral may only declare war; breaking an alliance is war', () => {
    const card = theCard('Evil', false, {}, true);
    expect(card['Osk'], 'Neutral').toEqual({ badge: BADGE.neutral, controls: button(1, 'enemy', RED, 'Declare War') });
    expect(card['Vor'], 'Allied').toEqual({
      badge: BADGE.allied,
      controls: button(2, 'enemy', RED, 'Break Alliance — War'),
    });
    expect(card['Ael'], 'at war').toEqual({ badge: BADGE.enemy, controls: button(3, 'treat', GREEN, 'Propose Peace') });
  });

  test.for([
    [{ 1: 'enemy', 2: 'enemy', 3: 'treat' }, ['Declare War', 'Break Alliance', 'Propose Peace']],
    [{ 1: 'treat', 2: 'treat', 3: 'enemy' }, ['Propose Alliance', 'Propose Alliance', 'Declare War']],
  ] as const)('a declaration pending, %o: named %o in the report and the orders', ([choices, names]) => {
    const view = theCard('Good', true, choices, false);
    const orders = theCard('Good', true, choices, true);
    THE_REALMS.forEach((realm, i) => {
      const words = names[i] ?? '';
      expect(view[realm.name], `${realm.name}, the report's view`).toEqual({
        badge: BADGE[realm.relation],
        controls: `<div style="font-size:.78rem;color:#7a1c1c">Pending this turn: <strong>${words}</strong> <span style="color:#3a3224">(change it at the top of your Orders)</span></div>`,
      });
      expect(orders[realm.name], `${realm.name}, the orders' view`).toEqual({
        badge: BADGE[realm.relation],
        controls: `<div style="font-size:.8rem;color:#7a1c1c">Pending this turn: <strong>${words} — ${realm.name}</strong> &nbsp;<button onclick="setDiploChoice(${String(realm.index)},null)" style="font-size:.66rem;padding:2px 8px;border:1px solid #999;background:#eee;border-radius:2px;cursor:pointer">cancel</button></div>`,
      });
    });
  });

  test('a declaration of no kind names none', () => {
    const view = theCard('Good', true, { 1: 'peace' }, false);
    expect(view['Osk']?.controls).toBe(
      '<div style="font-size:.78rem;color:#7a1c1c">Pending this turn: <strong></strong> <span style="color:#3a3224">(change it at the top of your Orders)</span></div>',
    );
  });
});
