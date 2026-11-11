// The player portal's pre-order cards, the heir's fields and the order form's rebuilds (plan P1-16g): the lines P1-16g
// changed in pre-orders.ts that the screen tours don't reach, or reach only in part (npm run proof:tours), each run here
// on the value that reaches it, so a fault planted in one is red: the heir's name and temper, the Blood Offering's
// choices, Resubmit, a target field rebuilt, a field built for a hero the report doesn't hold, a raised hero's card
// moved to its earlier caster with its orders carried over, and the card of a hero hired by a hero hired this turn.
// Level 4 (page): pre-orders.ts loads the page's start-up (its database client), so no lower level reaches it; the
// portal is booted in jsdom (tests/lib/boot.js) on the fake Db at an older database, so it stops at its notice with
// every module loaded.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';

const errs: string[] = [];
let P: PageWindow;
let doc: Document;
const call = (name: string, ...args: unknown[]): unknown => {
  const f: unknown = P[name];
  if (typeof f !== 'function') throw new Error(`the page has no function ${name}`);
  return Reflect.apply(f, undefined, args);
};
const stage = (code: string): unknown => P.eval(code);
const field = (id: string): HTMLInputElement | HTMLSelectElement => {
  const el = doc.getElementById(id);
  if (!el || !('value' in el)) throw new Error(`no field ${id}`);
  return el as HTMLInputElement | HTMLSelectElement;
};
const settle = (ms = 150): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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
    },
  }).window;
  doc = P['document'] as Document;
  await settle(600);
  const bootErrors = errs.map((e) => e.split(' (database')[0]).join('; ');
  if (bootErrors !== 'The game is being updated. Try again in a few minutes.')
    throw new Error(`the page booted with other errors: ${bootErrors}`);
  errs.length = 0;
});
afterAll(() => {
  P.close();
});

describe("the heir's fields", () => {
  test('the name is kept to 40 letters, and only an heir takes one', () => {
    stage(
      `currentGamePlayer = null; currentReport = ${JSON.stringify({
        characters: [
          { id: 'h', _isHeir: true, name: 'Old' },
          { id: 'k', name: 'King' },
        ],
      })};`,
    );
    call('setHeirName', 'h', 'A'.repeat(45));
    expect(stage('currentReport.characters[0].name')).toBe('A'.repeat(40));
    call('setHeirName', 'h', '');
    expect(stage('currentReport.characters[0].name')).toBe('');
    call('setHeirName', 'k', 'Usurper');
    expect(stage('currentReport.characters[1].name')).toBe('King');
  });
  test('the temper is one of the tempers, and only an heir takes one', () => {
    stage(
      `currentReport = ${JSON.stringify({
        characters: [
          { id: 'h', _isHeir: true, temper: 'Brave' },
          { id: 'k', temper: 'Brave' },
        ],
      })};`,
    );
    call('setHeirTemper', 'h', 'Cautious');
    expect(stage('currentReport.characters[0].temper')).toBe('Cautious');
    call('setHeirTemper', 'h', 'Sleepy');
    expect(stage('currentReport.characters[0].temper')).toBe('Cautious');
    call('setHeirTemper', 'k', 'Cautious');
    expect(stage('currentReport.characters[1].temper')).toBe('Brave');
  });
});

describe("the Blood Offering's choices", () => {
  test("each unit's choice goes into the hidden field, and another rite empties it", () => {
    stage(`currentReport = ${JSON.stringify({ characters: [{ id: 'b', armies: [] }] })};`);
    doc.body.insertAdjacentHTML(
      'beforeend',
      `<div id="bo-test"><select id="po-target-b-1"><option value="Blood Offering" selected>Blood Offering</option><option value="Other">Other</option></select>
      <div id="bo-block-b-1" style="display:none"></div><input id="po-extra-b-1" value="x"><div id="bo-hint-b-1"></div>
      <select class="bo-sel" data-cid="b" data-ph="1" data-idx="0"><option value="S" selected>S</option></select>
      <select class="bo-sel" data-cid="b" data-ph="1" data-idx="2"><option value="E" selected>E</option></select>
      <select class="bo-sel" data-cid="b" data-ph="1" data-idx="1"><option value="K" selected>K</option></select>
      <select class="bo-sel" data-cid="b" data-ph="1" data-idx="3"><option value="S" selected>S</option></select>
      <select class="bo-sel" data-cid="b" data-ph="2" data-idx="4"><option value="S" selected>S</option></select></div>`,
    );
    call('updateBloodOffering', 'b', 1);
    expect(field('po-extra-b-1').value).toBe('S:0,3|E:2');
    expect(doc.getElementById('bo-block-b-1')?.style.display).toBe('block');
    expect(doc.getElementById('bo-hint-b-1')?.textContent).not.toBe('');
    field('po-target-b-1').value = 'Other';
    call('updateBloodOffering', 'b', 1);
    expect(field('po-extra-b-1').value).toBe('');
    expect(doc.getElementById('bo-block-b-1')?.style.display).toBe('none');
    doc.getElementById('bo-test')?.remove();
  });
});

describe('Resubmit', () => {
  test('every field of the form is open again but the leave-all box, and the message says so', () => {
    stage(`currentGamePlayer = { id: 1, orders: null };`);
    doc.body.insertAdjacentHTML(
      'beforeend',
      `<div id="rs-test"><div id="orders-form"><select id="rs-a" disabled></select><input id="rs-b" disabled><button id="rs-c" disabled></button><input id="po-leave-all-x" disabled></div></div>`,
    );
    call('resubmitOrders');
    expect(
      ['rs-a', 'rs-b', 'rs-c', 'po-leave-all-x'].map((id) => doc.getElementById(id)?.hasAttribute('disabled')),
    ).toEqual([false, false, false, true]);
    expect(doc.getElementById('orders-msg')?.textContent).toContain('Update your orders below and hit Resubmit');
    doc.getElementById('rs-test')?.remove();
  });
});

describe('a target field built again', () => {
  test("Practice Skill's field is rebuilt for the hero the report holds, and nothing for one it doesn't", () => {
    stage(
      `currentReport = ${JSON.stringify({ characters: [{ id: 'p', name: 'Pupil', skills: { melee: 1 }, armies: [], items: [] }] })};`,
    );
    doc.body.insertAdjacentHTML(
      'beforeend',
      `<div id="tw-test"><select id="po-action-p-0"><option value="Practice Skill" selected>Practice Skill</option></select><div id="po-target-wrap-p-0">old</div>
      <div id="po-target-wrap-q-0">old</div></div>`,
    );
    call('rebuildTargetWrap', 'p', 0);
    expect(doc.getElementById('po-target-wrap-p-0')?.innerHTML).toContain('id="po-target-p-0"');
    expect(doc.getElementById('po-target-wrap-p-0')?.innerHTML).toContain('rebuildTargetWrap(');
    call('rebuildTargetWrap', 'q', 0);
    expect(doc.getElementById('po-target-wrap-q-0')?.innerHTML).toBe('old');
    doc.getElementById('tw-test')?.remove();
  });
  test('an action changed for a hero the report holds none of builds his field with no id (none written)', () => {
    stage(`currentReport = ${JSON.stringify({ characters: [] })};`);
    doc.body.insertAdjacentHTML(
      'beforeend',
      `<div id="ac-test"><select id="po-action-ghost-0"><option value="Move" selected>Move</option></select><div id="po-target-wrap-ghost-0"></div></div>`,
    );
    call('onActionChange', 'ghost', 0, 99);
    expect(doc.getElementById('po-target-wrap-ghost-0')?.innerHTML).toContain('id="po-target--0"');
    doc.getElementById('ac-test')?.remove();
  });
});

describe("a raised hero's card", () => {
  test('moves to his earlier caster, its orders carried over', async () => {
    stage(
      `currentReport = ${JSON.stringify({
        characters: [{ id: 1, name: 'Healer', alive: true, skills: { white: 3 }, armies: [], items: [] }],
        knownDeadHeroes: [{ id: 7, name: 'Fallen Friend', race: 'Elf', locationId: 3 }],
      })};`,
    );
    doc.body.insertAdjacentHTML(
      'beforeend',
      `<div id="rz-test"><div class="orders-char-block" id="rz-block">
        <select id="po-action-1-0"><option value="Cast Spell" selected>Cast Spell</option></select>
        <select id="po-target-1-0"><option value="Resurrect" selected>Resurrect</option></select>
        <select id="po-extra-1-0"><option value="7" selected>7</option></select></div>
      <div id="resurrect-orders-7" data-heroid="7" data-firstph="2" data-anchor="1" data-fakeid="resurrect_7_via_1_ph2">
        <input id="ep-tactics-resurrect_7_via_1_ph2" value="ME,AR"><input id="ep-notes-resurrect_7_via_1_ph2" value="Carried over">
        <select id="ep-duel-resurrect_7_via_1_ph2"><option value="refuse">refuse</option><option value="accept" selected>accept</option></select></div></div>`,
    );
    call('syncResurrectCard');
    const card = doc.getElementById('resurrect-orders-7');
    expect(card?.getAttribute('data-firstph')).toBe('0');
    expect(card?.getAttribute('data-fakeid')).toBe('resurrect_7_via_1_ph0');
    expect(field('ep-notes-resurrect_7_via_1_ph0').value).toBe('Carried over');
    expect(field('ep-tactics-resurrect_7_via_1_ph0').value).toBe('ME,AR');
    expect(field('ep-duel-resurrect_7_via_1_ph0').value).toBe('accept');
    expect(card?.textContent).toContain('Raised by Healer (Spring).');
    expect(stage('currentReport.characters.map((c) => c.id).join()')).toBe('1,resurrect_7_via_1_ph0');
    doc.getElementById('rz-test')?.remove();
    await settle(0);
  });
});

describe('a hero hired by a hero hired this turn', () => {
  test("his card follows the hirer's own card, and shows his best skill", async () => {
    const hirer = 'hired_5_via_1_ph0';
    stage(
      `currentReport = ${JSON.stringify({
        characters: [{ id: hirer, name: 'First Hire', hiredInPhase: 0, skills: {}, armies: [], items: [] }],
        provinceOrderData: {
          3: {
            availableHeroes: [
              { id: 9, name: 'Second Hire', race: 'Dwarf', alignment: 'Good', skills: { melee: 2, sage: 4, spy: 0 } },
            ],
          },
        },
      })};`,
    );
    doc.body.insertAdjacentHTML(
      'beforeend',
      `<div id="hh-test"><div id="hh-card" data-fakeid="${hirer}">
        <select id="po-action-${hirer}-1"><option value="Hire Hero" selected>Hire Hero</option></select>
        <select id="po-target-${hirer}-1"><option value="9" selected>9</option></select></div></div>`,
    );
    call('syncHiredHeroCard', hirer, 1);
    const card = doc.getElementById(`hired-hero-orders-${hirer}-1`);
    expect(card?.previousElementSibling?.id).toBe('hh-card');
    expect(card?.textContent).toContain('Race: Dwarf');
    const best = card?.querySelector('span[style*="forest"]')?.textContent ?? '';
    expect(best).toMatch(/Sage/);
    expect(best).not.toMatch(/Melee/);
    doc.getElementById('hh-test')?.remove();
    await settle(0);
  });
});

describe('a hero hired by a hero hired this turn, his first phases still to come', () => {
  test("his card follows the block of the hirer's first phase that has an order", async () => {
    const hirer = 'hired_6_via_1_ph1';
    stage(
      `currentReport = ${JSON.stringify({
        characters: [{ id: hirer, name: 'Late Hire', hiredInPhase: 1, skills: {}, armies: [], items: [] }],
        provinceOrderData: { 3: { availableHeroes: [{ id: 11, name: 'Third Hire', race: 'Orc', skills: {} }] } },
      })};`,
    );
    doc.body.insertAdjacentHTML(
      'beforeend',
      `<div id="hn-test"><div class="orders-char-block" id="hn-block">
        <select id="po-action-${hirer}-2"><option value="Hire Hero" selected>Hire Hero</option></select>
        <select id="po-target-${hirer}-2"><option value="11" selected>11</option></select></div></div>`,
    );
    call('syncHiredHeroCard', hirer, 2);
    const card = doc.getElementById(`hired-hero-orders-${hirer}-2`);
    expect(card?.previousElementSibling?.id).toBe('hn-block');
    expect(card?.textContent).toContain('No notable skills');
    doc.getElementById('hn-test')?.remove();
    await settle(0);
  });
});
