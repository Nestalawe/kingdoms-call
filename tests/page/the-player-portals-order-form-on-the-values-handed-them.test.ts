// The player portal's order form on the values handed it (plan P1-16h2): the lines P1-16h2 changed in orders-form.ts that
// the screen tours don't reach, or reach only in part (npm run proof:tours), each run here on the value that reaches it,
// so a fault planted in one is red: the treasury ledger's refresh, the read-only view of orders sent (a pre-order card's
// hero named), a draft that can't be read, the encounter plan's pickers and tactics (cleared, a spell confirmed, moved,
// dragged and removed), a spell field for a hero the report doesn't hold, and the heir's points taken back. With them
// (until plan P1-14z the script cast-practice-projection), the Cast Spell field as the live form builds it: each
// earlier Practice Skill on a school counted as a success, rebuilt when an earlier order changes, the Warlock's extra
// spell (R-123) and a Grand Cathedral's free Bless (R-124), and (until plan P1-14z the page half of the script
// cast-practice-assumed) the encounter plan's combat-spell picker counting a practice the same way; the copies test
// (tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts) compares the form's count with the engine's.
// Level 4 (page): orders-form.ts loads the page's start-up (its database client), so no lower level reaches it; the
// portal is booted in jsdom (tests/lib/boot.ts) on the fake Db at an older database, so it stops at its notice with
// every module loaded and the orders column in the page.
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.ts';
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

describe('a draft stamped for its turn (P1-21q)', () => {
  test("Revise hands the form the report's turn, which an engine report doesn't carry: the draft for the live turn is kept", () => {
    // openReport stamps the live turn on the report (_liveTurn); a report the engine wrote has turnNumber, not turn, so
    // reviseOrders hands the form 1.
    stage(
      `currentReport = ${JSON.stringify({ turnNumber: 4, _liveTurn: 5, characters: [aHero] })}; reckoningCall = false;`,
    );
    call('buildOrdersForm', [aHero], false, JSON.stringify({ forTurn: 5, callReckoning: true }), 1);
    expect(stage('reckoningCall')).toBe(true);
    expect(doc.getElementById('orders-msg')?.textContent ?? '').not.toContain('set aside');
  });
  test('a draft stamped for an earlier turn is set aside, saying so', () => {
    stage(
      `currentReport = ${JSON.stringify({ turnNumber: 4, _liveTurn: 5, characters: [aHero] })}; reckoningCall = false;`,
    );
    call('buildOrdersForm', [aHero], false, JSON.stringify({ forTurn: 4, callReckoning: true }), 1);
    expect(stage('reckoningCall')).toBe(false);
    expect(doc.getElementById('orders-msg')?.textContent).toContain(
      'Your saved draft was written for Turn 4 and has been set aside',
    );
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

// The Cast Spell field counts every Practice Skill order on a school in an earlier phase as a success (until plan
// P1-14z the script cast-practice-projection): the level it quotes, and the number of spells it lets the hero cast
// from that school, are the ones the hero may have reached by that phase, and an earlier Practice or Cast changed
// rebuilds the later fields at once. With them the Warlock's extra spell (R-123) and a Grand Cathedral's free Bless
// (R-124). Made-up heroes; the steps run once, in beforeAll, in the order a player takes them; each check is a test.
describe('the Cast Spell field counts earlier practices, the Warlock and a Grand Cathedral', () => {
  const seen: Record<string, unknown> = {};
  /** An option's state as the field shows it: closed or not, and its words. */
  const options: Record<string, { readonly off: boolean | undefined; readonly text: string }> = {};
  /** Whether Summer's field offers a priest a spell, and its words (or the field's placeholder). */
  const offers: Record<string, { readonly open: boolean; readonly text: string | null | undefined }> = {};
  let noTitle: { offered: boolean; off: boolean | undefined; placeholder: string | null | undefined } | undefined;
  const errorsHere: string[] = [];
  const field = (id: string): HTMLSelectElement | null => doc.querySelector<HTMLSelectElement>(`#${id}`);
  /** The option for `spell` in a hero's spell field in phase `ph`, if the field is a list that holds it. */
  const optionOf = (hero: string, ph: number, spell: string): HTMLOptionElement | undefined => {
    const s = field(`po-target-${hero}-${String(ph)}`);
    return s?.options ? [...s.options].find((o) => o.value === spell) : undefined;
  };
  const textOfOption = (hero: string, ph: number, spell: string): string =>
    optionOf(hero, ph, spell)?.textContent ?? '';
  /** An order picked in a phase, as the player picks it; one the phase doesn't offer stops the steps. */
  const act = (hero: string, ph: number, action: string): void => {
    const s = field(`po-action-${hero}-${String(ph)}`);
    if (!s || ![...s.options].some((o) => o.value === action))
      throw new Error(`phase ${String(ph)} offers no ${action}`);
    s.value = action;
    call('onActionChange', hero, ph, 0);
  };
  /** A spell, or a school to practise, picked in a phase's target field. */
  const aim = (hero: string, ph: number, value: string, how: 'spell' | 'school'): void => {
    const s = field(`po-target-${hero}-${String(ph)}`);
    if (!s) throw new Error(`no target field in phase ${String(ph)}`);
    s.value = value;
    if (how === 'spell') call('onSpellChange', hero, ph, value);
    else call('rebuildTargetWrap', hero, ph);
  };
  /** The form built for `heroes` on a report of turn `turn`, its kingdom as given. */
  const theFormFor = async (heroes: unknown[], turn: number, kingdom: unknown): Promise<void> => {
    const report = {
      turn,
      _liveTurn: turn,
      characters: heroes,
      kingdom,
      worldMeta: { provinces: [{ id: 11, name: 'Ashford' }] },
    };
    stage(`currentReport = ${JSON.stringify(report)};`);
    call('buildOrdersForm', stage('currentReport.characters'), false, null, turn);
    await settle(50);
  };
  const aHeroOf = (id: string, name: string, skills: Record<string, number>, more = {}) => ({
    id,
    name,
    player: 0,
    locationId: 11,
    locationName: 'Ashford',
    hp: 20,
    maxHp: 20,
    armies: [],
    items: [],
    skills,
    effectiveSpeed: 3,
    effectiveSeaSpeed: 3,
    isKing: false,
    ...more,
  });
  const psy = 'Charm';
  const ele = 'Earthquake';

  beforeAll(async () => {
    const errorsBefore = errs.length;
    // the page's console.error lines count as its errors here, as they did in the script
    const quiet = P.console.error;
    P.console.error = (...a) => errorsHere.push(`console.error: ${a.map(String).join(' ')}`);
    try {
      stage("currentGamePlayer = { id: 'gpx', orders: null };");
      // Psychic 2 casts one spell a turn; Psychic 3 casts two. Elemental 5 is as far as practice goes.
      await theFormFor([aHeroOf('h1', 'Maelis', { psychic: 2, elemental: 5 }, { isKing: true })], 3, {
        gold: 100,
        alignment: 'Good',
      });
      act('h1', 1, 'Cast Spell');
      seen['noPractice'] = textOfOption('h1', 1, psy);
      act('h1', 0, 'Practice Skill');
      aim('h1', 0, 'psychic', 'school');
      seen['afterAPractice'] = textOfOption('h1', 1, psy);
      aim('h1', 1, psy, 'spell');
      act('h1', 2, 'Cast Spell');
      options['secondInAutumn'] = { off: optionOf('h1', 2, psy)?.disabled, text: textOfOption('h1', 2, psy) };
      seen['atFive'] = textOfOption('h1', 2, ele);
      act('h1', 3, 'Practice Skill');
      aim('h1', 3, 'psychic', 'school');
      act('h1', 4, 'Cast Spell');
      seen['twoPractices'] = textOfOption('h1', 4, psy);
      aim('h1', 4, ele, 'spell');
      const winterProvince = (): HTMLSelectElement | null => field('po-extra-h1-4');
      seen['ashfordOffered'] = [...(winterProvince()?.options ?? [])].some((o) => o.value === '11');
      const province = winterProvince();
      if (seen['ashfordOffered'] && province) province.value = '11';
      act('h1', 3, 'Rest');
      act('h1', 3, 'Practice Skill');
      aim('h1', 3, 'psychic', 'school');
      seen['winterAfterARebuild'] = [field('po-target-h1-4')?.value, winterProvince()?.value];
      act('h1', 0, 'Rest');
      options['withoutThePractice'] = { off: optionOf('h1', 2, psy)?.disabled, text: textOfOption('h1', 2, psy) };
      act('h1', 0, 'Practice Skill');
      aim('h1', 0, 'psychic', 'school');
      seen['practiceBack'] = optionOf('h1', 2, psy)?.disabled;
      aim('h1', 0, 'elemental', 'school');
      seen['reAimed'] = optionOf('h1', 2, psy)?.disabled;

      // R-123: two heroes at Elemental 4 cast Earthquake in Spring, Summer and Autumn; in Winter the Warlock (the minor
      // title, in the report's minorHeld) is offered a fourth.
      const warlockTitle = {
        key: 'warlock',
        name: 'The Warlock',
        perk: '+1 spell of your best school/turn',
        req: 'Highest single magic-school level.',
      };
      const mage = (id: string, minorHeld: unknown[], skills: Record<string, number> = { elemental: 4 }) =>
        aHeroOf(id, `Mage ${id}`, skills, { minorHeld });
      await theFormFor([mage('w1', [warlockTitle]), mage('w2', [])], 6, { gold: 100, alignment: 'Good' });
      for (const id of ['w1', 'w2']) {
        for (let ph = 0; ph < 4; ph++) act(id, ph, 'Cast Spell');
        for (let ph = 0; ph < 3; ph++) aim(id, ph, ele, 'spell');
      }
      options['warlocksFourth'] = { off: optionOf('w1', 3, ele)?.disabled, text: textOfOption('w1', 3, ele) };
      const w2s = field('po-target-w2-3');
      noTitle = {
        offered: !!optionOf('w2', 3, ele),
        off: w2s?.disabled,
        placeholder: w2s?.getAttribute('placeholder'),
      };
      // His best school is read from the levels he may have trained by then: at Elemental 4 and Psychic 4, a Psychic
      // practice in Spring makes Psychic 5 his best, so Winter's fourth Elemental spell is closed.
      await theFormFor([mage('w3', [warlockTitle], { elemental: 4, psychic: 4 })], 6, { gold: 100, alignment: 'Good' });
      act('w3', 0, 'Practice Skill');
      aim('w3', 0, 'psychic', 'school');
      for (let ph = 1; ph < 5; ph++) act('w3', ph, 'Cast Spell');
      for (let ph = 1; ph < 4; ph++) aim('w3', ph, ele, 'spell');
      options['notHisBest'] = { off: optionOf('w3', 4, ele)?.disabled, text: textOfOption('w3', 4, ele) };
      options['hisBest'] = { off: optionOf('w3', 4, psy)?.disabled, text: textOfOption('w3', 4, psy) };

      // R-124: two priests at White 1 (one White spell a turn) in a Divine realm: one blesses in Spring, the other casts
      // Holy Symbol; then Summer's field is read, with the Grand Cathedral standing (its report's kingdom says so) and not.
      for (const stands of [true, false]) {
        const kingdom = { gold: 100, alignment: 'Divine', ...(stands ? { itsGrandCathedralStands: true } : {}) };
        await theFormFor(
          [aHeroOf('p1', 'Priest p1', { white: 1 }), aHeroOf('p2', 'Priest p2', { white: 1 })],
          6,
          kingdom,
        );
        act('p1', 0, 'Cast Spell');
        aim('p1', 0, 'Bless Province', 'spell');
        act('p1', 1, 'Cast Spell');
        act('p2', 0, 'Cast Spell');
        aim('p2', 0, 'Holy Symbol', 'spell');
        act('p2', 1, 'Cast Spell');
        const offered = (id: string, spell: string) => {
          const o = optionOf(id, 1, spell);
          return {
            open: !!o && !o.disabled,
            text: o ? o.textContent : field(`po-target-${id}-1`)?.getAttribute('placeholder'),
          };
        };
        const when = stands ? 'withTheCathedral' : 'without';
        offers[`${when}AfterBless`] = offered('p1', 'Holy Symbol');
        offers[`${when}BlessAtTheLimit`] = offered('p2', 'Bless Province');
      }
      seen['formHtml'] = doc.getElementById('orders-form')?.innerHTML ?? '';
    } finally {
      P.console.error = quiet;
      errorsHere.push(...errs.slice(errorsBefore));
    }
  });

  test('no practice: Psychic shows Lv2, 0/1', () => {
    expect(seen['noPractice']).toMatch(/Lv2 — 0\/1 used/);
  });
  test("after a Psychic practice in Spring, Summer's dropdown refreshes to Lv2→3, 0/2", () => {
    expect(seen['afterAPractice']).toMatch(/Lv2→3 if practice succeeds — 0\/2 used/);
  });
  test('with the practice, a second Psychic spell is open in Autumn', () => {
    expect(options['secondInAutumn']?.off).toBe(false);
    expect(options['secondInAutumn']?.text).toMatch(/1\/2 used/);
  });
  test('a school at 5 projects no rise', () => {
    expect(seen['atFive']).toMatch(/Elemental Magic Lv5 — 0\/3 used/);
  });
  test('two practices project Lv4 and three spells', () => {
    expect(seen['twoPractices']).toMatch(/Lv2→4 if practice succeeds — 2\/3 used/);
  });
  test('Earthquake in Winter offers Ashford as its target', () => {
    expect(seen['ashfordOffered']).toBe(true);
  });
  test('after an earlier order changes, Winter still casts Earthquake at Ashford', () => {
    expect(seen['winterAfterARebuild']).toEqual([ele, '11']);
  });
  test("without the practice Autumn's Psychic spell is closed again", () => {
    expect(options['withoutThePractice']?.off).toBe(true);
    expect(options['withoutThePractice']?.text).toMatch(/limit reached: 1\/1/);
  });
  test('Spring back to a Psychic practice reopens it', () => {
    expect(seen['practiceBack']).toBe(false);
  });
  test("re-aiming Spring's practice at Elemental closes it again", () => {
    expect(seen['reAimed']).toBe(true);
  });
  test('the Warlock at Elemental 4 is offered a fourth Elemental spell', () => {
    expect(options['warlocksFourth']?.off).toBe(false);
    expect(options['warlocksFourth']?.text).toMatch(/Lv4 — 3\/4 used/);
  });
  test('a hero without the title is not: his field says the limits are reached', () => {
    expect(noTitle?.offered).toBe(false);
    expect(noTitle?.off).toBe(true);
    expect(noTitle?.placeholder).toMatch(/casting limits reached/);
  });
  test("after a Psychic practice, Elemental is not his best: Winter's fourth Elemental spell is closed", () => {
    expect(options['notHisBest']?.off).toBe(true);
    expect(options['notHisBest']?.text).toMatch(/limit reached: 3\/3/);
  });
  test('and Psychic, his best, may cast four', () => {
    expect(options['hisBest']?.off).toBe(false);
    expect(options['hisBest']?.text).toMatch(/0\/4 used/);
  });
  test("with the Cathedral, a Bless in Spring spends no slot: Summer's Holy Symbol is open", () => {
    expect(offers['withTheCathedralAfterBless']?.open).toBe(true);
    expect(offers['withTheCathedralAfterBless']?.text).toMatch(/0\/1 used/);
  });
  test("with the Cathedral, Bless is open in Summer after Spring's Holy Symbol", () => {
    expect(offers['withTheCathedralBlessAtTheLimit']?.open, offers['withTheCathedralBlessAtTheLimit']?.text ?? '').toBe(
      true,
    );
  });
  test("without it, Spring's Bless spends the slot: Summer's Holy Symbol is closed", () => {
    expect(offers['withoutAfterBless']?.open, offers['withoutAfterBless']?.text ?? '').toBe(false);
  });
  test("without it, Bless is closed in Summer after Spring's Holy Symbol", () => {
    expect(offers['withoutBlessAtTheLimit']?.open, offers['withoutBlessAtTheLimit']?.text ?? '').toBe(false);
  });
  test('no undefined / NaN in the orders form', () => {
    expect(seen['formHtml']).not.toMatch(/undefined|NaN|\[object Object\]/);
  });
  test('no page errors', () => {
    expect(errorsHere).toEqual([]);
  });
});

// The encounter plan's combat-spell picker counts a Practice Skill on the school earlier in the turn as a success
// (item 16, 2026-10-13; until plan P1-14z the page half of the script cast-practice-assumed): a Psychic 1 hero
// practising Psychic is offered two combat spells of the school, Psychic 2's allowance, and adding the second is
// accepted rather than refused at the current level's one. The bots' side is
// tests/unit/the-bots-order-check-counts-each-earlier-practice-as-a-level-before-a-cast.test.ts. The picks run once, in
// beforeAll, in the order a player makes them; each check is a test.
describe("the encounter plan's combat spells count a practice earlier in the turn", () => {
  const offered: Record<string, boolean> = {};
  let thePlan = '';
  const alertsHere: string[] = [];
  const errorsHere: string[] = [];
  /** Opens the picker for a combat spell and picks `spell` if it is offered; else closes it. Whether it was offered. */
  const add = (spell: string): boolean => {
    P.eval("addEncounterTactic('h1','CA')");
    const pk = doc.getElementById('ep-spell-picker-h1');
    const b = pk
      ? [...pk.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(spell) && !x.disabled)
      : undefined;
    if (!b) {
      if (pk) pk.remove();
      return false;
    }
    b.click();
    return true;
  };

  beforeAll(async () => {
    const errorsBefore = errs.length;
    const ph = {
      id: 'h1',
      name: 'Maelis',
      player: 0,
      locationId: 11,
      locationName: 'Ashford',
      hp: 20,
      maxHp: 20,
      armies: [],
      items: [],
      skills: { psychic: 1 },
      effectiveSpeed: 3,
      effectiveSeaSpeed: 3,
      isKing: true,
    };
    stage("currentGamePlayer={id:'gpx',orders:null};");
    stage(
      `currentReport=${JSON.stringify({ turn: 3, _liveTurn: 3, characters: [ph], kingdom: { gold: 100, alignment: 'Good' }, worldMeta: { provinces: [{ id: 11, name: 'Ashford' }] } })};`,
    );
    const drafts = {
      h1: [
        { action: 'Practice Skill', target: 'psychic', extra: '' },
        { action: 'Rest' },
        { action: 'Rest' },
        { action: 'Rest' },
        { action: 'Rest' },
      ],
    };
    P.eval(`buildOrdersForm(currentReport.characters,false,${JSON.stringify(drafts)},3)`);
    await settle(80);
    offered['Psychic Blast'] = add('Psychic Blast');
    offered['Charm'] = add('Charm');
    thePlan = doc.getElementById('ep-tactics-h1') ? theValueOf('ep-tactics-h1') : '';
    alertsHere.push(...alerts);
    offered['Telekinetic Storm'] = add('Telekinetic Storm');
    errorsHere.push(...errs.slice(errorsBefore));
  });

  test('the picker offers Psychic Blast', () => {
    expect(offered['Psychic Blast']).toBe(true);
  });
  test('with Psychic practised this turn, a second Psychic combat spell is still offered', () => {
    expect(offered['Charm']).toBe(true);
  });
  test('and adding it is accepted', () => {
    expect(thePlan).toMatch(/CA:Psychic Blast/);
    expect(thePlan).toMatch(/CA:Charm/);
  });
  test('no refusal pops up', () => {
    expect(alertsHere).toEqual([]);
  });
  test('a third Psychic combat spell is not offered (Psychic 2 allows two)', () => {
    expect(offered['Telekinetic Storm']).toBe(false);
  });
  test('no page errors while the plan is made', () => {
    expect(errorsHere).toEqual([]);
  });
});
