// The player portal's order form on the values handed it (plan P1-16h2): the lines P1-16h2 changed in orders-form.ts that
// the screen tours don't reach, or reach only in part (npm run proof:tours), each run here on the value that reaches it,
// so a fault planted in one is red: the treasury ledger's refresh, the read-only view of orders sent (a pre-order card's
// hero named), a draft that can't be read, the encounter plan's pickers and tactics (cleared, a spell confirmed, moved,
// dragged and removed), a spell field for a hero the report doesn't hold, and the heir's points taken back.
// Level 4 (page): orders-form.ts loads the page's start-up (its database client), so no lower level reaches it; the
// portal is booted in jsdom (tests/lib/boot.js) on the fake Db at an older database, so it stops at its notice with
// every module loaded and the orders column in the page.
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';

const errs: string[] = [];
const alerts: string[] = [];
let P: PageWindow;
let doc: Document;
const call = (name: string, ...args: unknown[]): unknown => {
  const f: unknown = P[name];
  if (typeof f !== 'function') throw new Error(`the page has no function ${name}`);
  return Reflect.apply(f, undefined, args);
};
const stage = (code: string): unknown => P.eval(code);
const theValueOf = (id: string): string => {
  const el = doc.getElementById(id);
  if (!el || !('value' in el) || typeof el.value !== 'string') throw new Error(`no field ${id}`);
  return el.value;
};
const settle = (ms = 150): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const here = (html: string): void => {
  doc.getElementById('of-test')?.remove();
  doc.body.insertAdjacentHTML('beforeend', `<div id="of-test">${html}</div>`);
};
/** A drag's data, as the page's drag events carry it. */
const aDrag = () => {
  const held: Record<string, string> = {};
  return {
    preventDefault: () => undefined,
    dataTransfer: {
      effectAllowed: '',
      setData: (k: string, v: string) => {
        held[k] = v;
      },
      getData: (k: string) => held[k] ?? '',
    },
  };
};

beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb(['20261010000000']).db,
    url: 'https://example.org/p',
    setup(w) {
      w.addEventListener('error', (e) => errs.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
      w['alert'] = (m: unknown) => {
        alerts.push(String(m));
      };
    },
  }).window;
  doc = P['document'] as Document;
  await settle(600);
  const bootErrors = errs.map((e) => e.split(' (database')[0]).join('; ');
  if (bootErrors !== 'The game is being updated. Try again in a few minutes.')
    throw new Error(`the page booted with other errors: ${bootErrors}`);
  errs.length = 0;
});
afterEach(() => {
  alerts.length = 0;
  doc.getElementById('of-test')?.remove();
});
afterAll(() => {
  P.close();
});

const aHero = { id: 1, name: 'Ser Test', alive: true, skills: { melee: 2 }, armies: [], items: [], locationId: 3 };

describe('the treasury ledger', () => {
  test('a change inside the orders column redraws it; one elsewhere, or not on an element, does not', async () => {
    stage(`currentReport = ${JSON.stringify({ kingdom: { gold: 40 }, characters: [aHero] })};`);
    call('buildOrdersForm', [aHero], false, '{}', 1);
    await settle(800);
    const ledger = doc.getElementById('orders-ledger');
    if (!ledger) throw new Error('no ledger');
    ledger.style.display = 'none';
    ledger.innerHTML = '';
    here('<input id="of-outside">');
    stage("document.getElementById('of-outside').dispatchEvent(new Event('change', { bubbles: true }))");
    stage("document.dispatchEvent(new Event('input', { bubbles: true }))");
    await settle(200);
    expect(ledger.style.display).toBe('none');
    const inside = `document.querySelector('#orders-form select[id^="po-action-"]')`;
    stage(`${inside}.dispatchEvent(new Event('change', { bubbles: true }))`);
    await settle(200);
    expect(ledger.style.display).toBe('block');
    expect(ledger.textContent).toContain('Treasury 40g');
    ledger.innerHTML = '';
    stage(`${inside}.dispatchEvent(new Event('input', { bubbles: true }))`);
    await settle(200);
    expect(ledger.textContent).toContain('Treasury 40g');
  });
  test('with no kingdom in the report it is hidden', () => {
    stage(`currentReport = ${JSON.stringify({ characters: [aHero] })};`);
    call('renderOrderLedgerP');
    expect(doc.getElementById('orders-ledger')?.style.display).toBe('none');
  });
});

describe('the orders sent, read-only', () => {
  test("a pre-order card's hero is named from the heroes seen, for hire, or fallen, else 'Hero'", () => {
    stage(
      `currentReport = ${JSON.stringify({
        characters: [aHero],
        visibleChars: [{ id: 21, name: 'Seen One' }],
        provinceOrderData: { 3: { availableHeroes: [{ id: 22, name: 'For Hire' }] } },
        graveyard: [{ id: 23, name: 'Fallen One' }],
      })};`,
    );
    const orders = {
      orders: {
        1: [{ action: 'Move', target: 4 }, null, { action: 'Defend' }],
        charm_21_via_1_ph0: [null, { action: 'Move', target: 5 }],
        hired_22_via_1_ph0: [],
        resurrect_23_via_1_ph3: [],
        hired_24_via_1_ph1: [],
      },
    };
    call('buildOrdersForm', [aHero], true, JSON.stringify(orders), 1);
    const text = doc.getElementById('orders-form')?.textContent ?? '';
    expect(text).toContain('Seen One');
    expect(text).toContain('(if charmed)');
    expect(text).toContain('For Hire');
    expect(text).toContain('(newly hired)');
    expect(text).toContain('Fallen One');
    expect(text).toContain('(if raised)');
    expect(text).toMatch(/⚔ Hero/);
    expect(text).toMatch(/Move — 4/);
    expect(text).toMatch(/Move — 5/);
  });
  test('orders saved for a hero as anything but a list stop the view, as before', () => {
    stage(`currentReport = ${JSON.stringify({ characters: [aHero] })};`);
    expect(() => call('buildOrdersForm', [aHero], true, JSON.stringify({ orders: { 1: 'Move' } }), 1)).toThrow(
      /not a function/,
    );
  });
});

describe('a draft that cannot be read', () => {
  test('a draft that is not JSON starts the form fresh; one that is null stops it, as before', () => {
    stage(`currentReport = ${JSON.stringify({ characters: [aHero] })};`);
    call('buildOrdersForm', [aHero], false, '{not json', 1);
    expect(theValueOf('po-action-1-0')).toBe('');
    expect(() => call('buildOrdersForm', [aHero], false, 'null', 1)).toThrow(/Cannot read properties of null/);
  });
  test("a saved tactic that isn't words stops the form with a TypeError, as before", () => {
    stage(`currentReport = ${JSON.stringify({ characters: [aHero] })};`);
    let thrown = 'nothing';
    try {
      call('buildOrdersForm', [aHero], false, JSON.stringify({ encounterPlans: { 1: { tactics: [5] } } }), 1);
    } catch (e) {
      thrown = String(e);
    }
    expect(thrown).toMatch(/^TypeError: /);
  });
  test('a call for the Reckoning saved in the draft is kept', () => {
    stage(`currentReport = ${JSON.stringify({ characters: [aHero] })}; reckoningCall = false;`);
    call('buildOrdersForm', [aHero], false, JSON.stringify({ callReckoning: true }), 1);
    expect(stage('reckoningCall')).toBe(true);
  });
});

describe("the encounter plan's controls", () => {
  test('clearing the pre-battle magic empties its field and closes the picker', () => {
    here(
      '<input id="ep-preschool-h1" value="white"><div id="ep-preschool-display-h1"></div><div id="ep-school-picker-h1"></div>',
    );
    call('clearPreSchool', 'h1');
    expect(theValueOf('ep-preschool-h1')).toBe('');
    expect(doc.getElementById('ep-school-picker-h1')).toBeNull();
  });
  test('a confirmed spell joins the plan, but not twice, not past its school limit, and not past six', () => {
    stage(`currentReport = ${JSON.stringify({ characters: [aHero] })};`);
    const [a, b] = ['Resurrect', 'Part Sea']; // two of the White school's spells
    here('<div id="ep-spell-picker-h1"></div><input id="ep-tactics-h1" value="ME"><div id="ep-list-h1"></div>');
    call('confirmEPSpell', 'h1', a, 'white', 1, 1);
    expect(theValueOf('ep-tactics-h1')).toBe(`ME,CA:${a}`);
    expect(doc.getElementById('ep-spell-picker-h1')).toBeNull();
    call('confirmEPSpell', 'h1', a, 'white', 1, 1);
    expect(alerts.pop()).toMatch(/already in your encounter plan/);
    call('confirmEPSpell', 'h1', b, 'white', null, 1);
    expect(alerts.pop()).toMatch(/^White Magic: you can cast at most 1 combat spell of this school/);
    call('confirmEPSpell', 'h1', b, 'white', 1, Number.NaN);
    expect(alerts.pop()).toMatch(/^White Magic Lv1: you can cast at most 1 combat spell of/);
    call('confirmEPSpell', 'h1', b, 'white', 2, undefined);
    expect(theValueOf('ep-tactics-h1')).toBe(`ME,CA:${a},CA:${b}`);
    here('<input id="ep-tactics-h1" value="ME,ME,ME,ME,ME,ME">');
    call('confirmEPSpell', 'h1', a, 'white', 1, 1);
    expect(alerts.pop()).toMatch(/Maximum 6 tactics/);
    expect(alerts).toEqual([]);
  });
  test('a tactic moves up or down, and not past either end', () => {
    here('<input id="ep-tactics-h1" value="ME,AR,ST"><div id="ep-list-h1"></div>');
    call('epMoveTactic', 'h1', 0, 1);
    expect(theValueOf('ep-tactics-h1')).toBe('AR,ME,ST');
    call('epMoveTactic', 'h1', 2, 1);
    call('epMoveTactic', 'h1', 0, -1);
    expect(theValueOf('ep-tactics-h1')).toBe('AR,ME,ST');
    expect(doc.getElementById('ep-list-h1')?.children.length).toBe(3);
  });
  test('a tactic dragged onto another row, or onto the list, moves there; not to another hero', () => {
    here(
      '<input id="ep-tactics-h1" value="ME,AR,ST"><div id="ep-list-h1"></div><input id="ep-tactics-h2" value="AR,ME">',
    );
    const drag = aDrag();
    call('epDragStart', drag, 'h1', 2);
    expect(drag.dataTransfer.effectAllowed).toBe('move');
    call('epDropTactic', drag, 'h1', 0);
    expect(theValueOf('ep-tactics-h1')).toBe('ST,ME,AR');
    call('epDragStart', drag, 'h1', 0);
    call('epDropTactic', drag, 'h1');
    expect(theValueOf('ep-tactics-h1')).toBe('ME,AR,ST');
    call('epDropTactic', drag, 'h2', 1);
    call('epDragStart', drag, 'h1', 1);
    call('epDropTactic', drag, 'h1', 1);
    call('epDragStart', drag, 'h1', 5);
    call('epDropTactic', drag, 'h1', 0);
    call('epDropTactic', { preventDefault: () => undefined, dataTransfer: null }, 'h1', 0);
    expect(theValueOf('ep-tactics-h1')).toBe('ME,AR,ST');
    expect(theValueOf('ep-tactics-h2')).toBe('AR,ME');
    expect(doc.getElementById('ep-list-h1')?.textContent).toContain('Melee');
  });
  test('a tactic is removed by its place', () => {
    here('<input id="ep-tactics-h1" value="ME,AR,ST"><div id="ep-list-h1"></div>');
    call('removeEncounterTactic', 'h1', 1);
    expect(theValueOf('ep-tactics-h1')).toBe('ME,ST');
  });
  test('a school confirmed goes into the pre-battle magic field', () => {
    here(
      '<div id="ep-school-picker-h1"></div><input id="ep-preschool-h1" value=""><div id="ep-preschool-display-h1"></div>',
    );
    call('confirmEPSchool', 'h1', 'necromancy');
    expect(theValueOf('ep-preschool-h1')).toBe('necromancy');
    expect(doc.getElementById('ep-school-picker-h1')).toBeNull();
  });
  test("the spell picker for a hero whose training isn't known offers every school, at the limit of one", () => {
    const hire = { id: 'hired_5_via_1_ph0', name: 'New Hire', _unknownSkills: true, skills: {}, armies: [], items: [] };
    stage(`currentReport = ${JSON.stringify({ characters: [hire] })};`);
    here(`<input id="ep-tactics-${hire.id}" value="ME"><div id="ep-list-${hire.id}"></div>`);
    call('addEncounterTactic', hire.id, 'CA');
    const picker = doc.getElementById(`ep-spell-picker-${hire.id}`);
    expect(picker?.textContent).toContain('New Hire’s training is not known to you');
    expect(picker?.textContent).toMatch(/White Magic 0\/1/);
  });
});

describe('the Steal tactic', () => {
  test("a hero with no Thief skill can't take it; one whose training isn't known can", () => {
    const hire = { id: 'hired_6_via_1_ph0', name: 'New Hire', _unknownSkills: true, skills: {}, armies: [], items: [] };
    stage(`currentReport = ${JSON.stringify({ characters: [aHero, hire] })};`);
    here(
      `<input id="ep-tactics-1" value="ME"><div id="ep-list-1"></div><input id="ep-tactics-${hire.id}" value="ME"><div id="ep-list-${hire.id}"></div>`,
    );
    call('addEncounterTactic', 1, 'ST');
    expect(alerts.pop()).toMatch(/no Thief skill/);
    expect(theValueOf('ep-tactics-1')).toBe('ME');
    call('addEncounterTactic', hire.id, 'ST');
    expect(theValueOf(`ep-tactics-${hire.id}`)).toBe('ME,ST');
    expect(alerts).toEqual([]);
  });
});

describe('a spell changed for a hero the report holds none of', () => {
  test('builds the spell field with no id (none written)', () => {
    stage(`currentReport = ${JSON.stringify({ characters: [aHero] })};`);
    here('<div id="po-target-wrap-ghost-0"></div>');
    call('onSpellChange', 'ghost', 0, 'Heal');
    expect(doc.getElementById('po-target-wrap-ghost-0')?.innerHTML).toContain('id="po-target--0"');
  });
});

describe("the heir's points", () => {
  test('a point taken back lowers the skill, and one back to the crowned base goes; none below it, none for another hero', () => {
    stage(
      `currentGamePlayer = null; currentReport = ${JSON.stringify({
        characters: [
          { id: 'h', _isHeir: true, skills: { melee: 3, sage: 1 }, _heirBase: { melee: 2 } },
          { id: 'k', skills: { melee: 3 }, _heirBase: { melee: 1 } },
        ],
      })};`,
    );
    void (call('allocateHeirSkill', 'h', 'melee', -1) as Promise<void>).catch(() => undefined);
    expect(stage('JSON.stringify(currentReport.characters[0].skills)')).toBe('{"melee":2,"sage":1}');
    void (call('allocateHeirSkill', 'h', 'melee', -1) as Promise<void>).catch(() => undefined);
    void (call('allocateHeirSkill', 'h', 'sage', -1) as Promise<void>).catch(() => undefined);
    expect(stage('JSON.stringify(currentReport.characters[0].skills)')).toBe('{"melee":2}');
    expect(stage('currentReport.characters[0]._pendingSkillAllocation')).toBe(4);
    void (call('allocateHeirSkill', 'k', 'melee', -1) as Promise<void>).catch(() => undefined);
    expect(stage('JSON.stringify(currentReport.characters[1].skills)')).toBe('{"melee":3}');
  });
});
