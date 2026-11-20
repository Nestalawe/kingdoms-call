// The player portal's report screen on the values handed it (plan P1-16o2): the lines P1-16o2 changed in report.ts that
// the screen tours don't reach, or reach only in part (npm run proof:tours), each run here on the value that reaches it,
// so a fault planted in one is red: opening a realm's report (the database's refusals, a row or a report that isn't
// there, a report that is no object, the heir's saved skills, the turn buttons, the header's turn), the read-only view
// (the realm card's ledger and heroes, the provinces, the fallen, the graves, the bands, the heroes seen, the province
// reports, the spied provinces, the spies' watch, the lairs, the discoveries), a past turn (its snapshot, and the
// chronicle rebuilt from the GM's log where there is none), the diplomacy choice, the folds and the refresh.
// Level 4 (page): the file loads the page's start-up (its database client), so no lower level reaches it; the portal is
// booted in jsdom (tests/lib/boot.ts) on a fake Db at an older database, so it stops at its notice with every module
// loaded, and each case stages the screen's state as the tours do.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';
import type { ADatabaseAnswer, Db } from '../../src/db/the-db-interface-and-its-areas.ts';

const errs: string[] = [];
const warned: unknown[][] = [];
let P: PageWindow;
let doc: Document;
const call = (name: string, ...args: unknown[]): unknown => {
  const f: unknown = P[name];
  if (typeof f !== 'function') throw new Error(`the page has no function ${name}`);
  return Reflect.apply(f, undefined, args);
};
const stage = (code: string): unknown => P.eval(code);
const theElement = (id: string): HTMLElement => {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`no element ${id}`);
  return el;
};
const textOf = (id: string): string => theElement(id).textContent.replace(/\s+/g, ' ').trim();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type AnAnswer = ADatabaseAnswer<unknown>;
const ok = (data: unknown): AnAnswer => ({ data, error: null, status: 200 });
const refused = (message: string): AnAnswer => ({ data: null, error: { message }, status: 400 });

/** A realm's seat as the database holds it: its report as JSON text, and its draft orders. */
const aSeat = (turnReport: unknown, more: Record<string, unknown> = {}) => ({
  id: 'R1',
  game_id: 'G1',
  player_index: 0,
  display_name: 'Seat',
  orders: null,
  orders_submitted: false,
  turn_report: turnReport,
  ...more,
});
const aGame = (more: Record<string, unknown> = {}) => ({
  id: 'G1',
  name: 'Open Vale',
  turn: 3,
  status: 'active',
  gm_user_id: 'U9',
  max_players: 4,
  block_eliminated_msgs: false,
  ...more,
});

/** What the fake answers this case. */
const answers: Record<string, (...args: unknown[]) => AnAnswer> = {
  seat: () => ok(aSeat(JSON.stringify({}))),
  game: () => ok(aGame()),
  everyColumn: () => ok({ game_state: { characters: [] } }),
  log: () => ok([]),
};
const fresh = { ...answers };
const asked: { readonly what: string; readonly args: unknown[] }[] = [];
const theAsked = (what: string): unknown[][] => asked.filter((a) => a.what === what).map((a) => a.args);
const answering =
  (what: string) =>
  (...args: unknown[]): Promise<never> => {
    asked.push({ what, args });
    const answer = answers[what];
    if (!answer) throw new Error(`no answer for ${what}`);
    return Promise.resolve(answer(...args) as never);
  };
/** A database call the report screen makes but no case reads: refused, so the Dispatches stop there. */
const refusing = (): Promise<never> => Promise.resolve(refused('not in this test') as never);

function theFakeDb(): Db {
  const bare = makeAFakeDb(['20261010000000']).db;
  const everyCallRefused = <T extends object>(area: T): T =>
    Object.fromEntries(Object.keys(area).map((k) => [k, refusing])) as T;
  return {
    ...bare,
    thePlayersRealms: {
      ...everyCallRefused(bare.thePlayersRealms),
      thisRealm: answering('seat'),
    },
    thePlayersGames: {
      ...everyCallRefused(bare.thePlayersGames),
      thisGameForItsReport: answering('game'),
      thisGameEveryColumn: answering('everyColumn'),
    },
    theChroniclesLogs: { ...bare.theChroniclesLogs, theLogOfThisRealmInThisTurn: answering('log') },
    theDispatches: everyCallRefused(bare.theDispatches),
    theAccountsNames: everyCallRefused(bare.theAccountsNames),
  };
}

beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: theFakeDb(),
    url: 'https://example.org/p',
    setup(w) {
      w.addEventListener('error', (e) => errs.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = (...args: unknown[]) => {
        warned.push(args);
      };
      w.console.log = () => undefined;
      w['scrollTo'] = () => undefined;
      w['ResizeObserver'] = class {
        observe() {
          return undefined;
        }
      };
      w['requestAnimationFrame'] = undefined;
    },
  }).window;
  doc = P['document'] as Document;
  await new Promise((resolve) => setTimeout(resolve, 600));
  const bootErrors = errs.map((e) => e.split(' (database')[0]).join('; ');
  if (bootErrors !== 'The game is being updated. Try again in a few minutes.')
    throw new Error(`the page booted with other errors: ${bootErrors}`);
  errs.length = 0;
});
beforeEach(() => {
  Object.assign(answers, fresh);
  asked.length = 0;
  warned.length = 0;
  stage('currentUser = { id: "U1" }; currentGamePlayer = null; currentReport = null; viewingReport = null;');
  stage('viewedTurn = null; currentGamePlayerId = null; diploChoices = {};');
});
afterAll(() => {
  P.close();
});

/** Opens the report of the seat R1, as the page does (its promise awaited: what it rejects with, or nothing). */
async function theReportOpened(): Promise<unknown> {
  try {
    await call('openReport', 'R1');
    return undefined;
  } catch (e) {
    return e;
  }
}
const theMessageOf = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

describe('opening a report', () => {
  test("a refused seat or game names the database's words in the title", async () => {
    answers['seat'] = () => refused('no such realm');
    expect(await theReportOpened()).toBeUndefined();
    expect(textOf('report-title')).toBe('Error: no such realm');
    answers['seat'] = fresh['seat'] ?? answers['seat'];
    answers['game'] = () => refused('no such game');
    expect(await theReportOpened()).toBeUndefined();
    expect(textOf('report-title')).toBe('Error loading game: no such game');
  });
});

describe('opening a report: what the database holds', () => {
  test('a seat or a game the database gives as none stops the page with the TypeError of the read', async () => {
    answers['seat'] = () => ok(null);
    expect(theMessageOf(await theReportOpened())).toBe("TypeError: Cannot read properties of null (reading 'game_id')");
    expect(theAsked('game')).toEqual([]);
    answers['seat'] = () => ok(aSeat(JSON.stringify({})));
    answers['game'] = () => ok(null);
    expect(theMessageOf(await theReportOpened())).toBe("TypeError: Cannot read properties of null (reading 'turn')");
    expect(theAsked('game')).toEqual([['G1']]);
    expect(stage('currentGamePlayer.id + "/" + currentGamePlayer.games')).toBe('R1/null');
  });
  test('a report that is no object stops the page as the write on it did; a list, none and nothing open', async () => {
    const opening = async (held: unknown) => {
      answers['seat'] = () => ok(aSeat(held));
      return theMessageOf(await theReportOpened());
    };
    expect(await opening('null')).toBe("TypeError: Cannot set properties of null (setting '_liveTurn')");
    expect(await opening('5')).toBe("TypeError: Cannot create property '_liveTurn' on number '5'");
    expect(await opening(true)).toBe("TypeError: Cannot create property '_liveTurn' on boolean 'true'");
    expect(await opening('"words"')).toBe("TypeError: Cannot create property '_liveTurn' on string 'words'");
    expect(await opening('[]')).toBe('undefined');
    expect(stage('Array.isArray(currentReport) && currentReport._liveTurn')).toBe(3);
    expect(await opening(null)).toBe('undefined');
    expect(stage('JSON.stringify(currentReport)')).toBe('{"_liveTurn":3,"characters":[]}');
    expect(await opening(0)).toBe('undefined');
    expect(stage('JSON.stringify(currentReport)')).toBe('{"_liveTurn":3,"characters":[]}');
    expect(theElement('orders-column').querySelectorAll('.orders-char-block').length).toBe(1); // the realm's own block
    expect(await opening({ kingdom: { gold: 12 } })).toBe('undefined');
    expect(textOf('report-kingdom')).toContain('Treasury12g');
  });
  test("the heir's saved skills, name and temper come back from the draft; an heir with none keeps his own", async () => {
    const report = {
      characters: [
        { id: 7, _isHeir: true, skills: { melee: 2 }, name: 'Old' },
        { id: 8, _isHeir: true, skills: { archery: 1 }, name: 'Dara', temper: 'calm' },
        { id: 9, _isHeir: true, skills: { sage: 1 } },
        { id: 10, skills: { spy: 1 } },
        { id: 11, _isHeir: true },
      ],
    };
    const draft = {
      kingSkills: {
        7: { base: { melee: 2 }, skills: { melee: 3 }, pending: 1, name: 'Corin', temper: 'bold' },
        8: { base: 'ab', skills: null, pending: '2', name: '', temper: 0 },
      },
    };
    const heirs = () =>
      stage(
        'JSON.stringify(currentReport.characters.map((c) => [c.id, c._heirBase, c.skills, c._pendingSkillAllocation, c.name, c.temper]))',
      );
    answers['seat'] = () => ok(aSeat(JSON.stringify(report), { orders: JSON.stringify(draft) }));
    expect(await theReportOpened()).toBeUndefined();
    expect(heirs()).toBe(
      JSON.stringify([
        [7, { melee: 2 }, { melee: 3 }, 1, 'Corin', 'bold'],
        [8, { 0: 'a', 1: 'b' }, { archery: 1 }, null, 'Dara', 'calm'],
        [9, { sage: 1 }, { sage: 1 }, null, null, null],
        [11, {}, null, null, null, null],
        [10, null, { spy: 1 }, null, null, null],
      ]),
    );
    expect(stage('currentReport.characters[2]._heirBase !== currentReport.characters[2].skills')).toBe(true); // the order form shows heroes in its own order
    // a draft held as an object reads the same; none, or words that aren't JSON, leave every heir as crowned
    answers['seat'] = () => ok(aSeat(JSON.stringify(report), { orders: draft }));
    await theReportOpened();
    expect(stage('currentReport.characters[0].name')).toBe('Corin');
    answers['seat'] = () => ok(aSeat(JSON.stringify(report), { orders: '' }));
    await theReportOpened();
    expect(stage('JSON.stringify(currentReport.characters.map((c) => c._heirBase))')).toBe(
      JSON.stringify([{ melee: 2 }, { archery: 1 }, { sage: 1 }, {}, null]),
    );
    answers['seat'] = () => ok(aSeat(JSON.stringify(report), { orders: 'not json' }));
    expect(await theReportOpened()).toBeUndefined();
    expect(stage('JSON.stringify(currentReport.characters.map((c) => c._heirBase))')).toBe(
      '[null,null,null,null,null]',
    );
  });
  test("the header's turn, the turn buttons (the live one back to it, an older one to its snapshot) and turn 0", async () => {
    answers['seat'] = () => ok(aSeat(JSON.stringify({})));
    await theReportOpened();
    expect(textOf('report-title')).toBe('Open Vale — Turn 3');
    expect(textOf('orders-turn-num')).toBe('3');
    expect(stage('currentGamePlayer._liveTurn + "/" + currentReport._liveTurn')).toBe('3/3');
    const buttons = [...theElement('turn-nav-btns').querySelectorAll('button')];
    expect(buttons.map((b) => `${b.textContent}|${b.dataset['turn'] ?? ''}|${b.title}`)).toEqual([
      'T1|0|Turn 1 — the founding report, your starting position',
      'T2|1|Turn 2 — the report you received then',
      'T3|2|Turn 3 — the report you received then',
    ]);
    expect(theElement('turn-nav-btns').dataset['resolved']).toBe('2');
    buttons[0]?.click();
    await wait(20);
    expect(theAsked('log')[0]).toEqual(['G1', 0, 0]);
    expect(theElement('prev-report-banner').style.display).toBe('block');
    buttons[2]?.click();
    expect(theElement('prev-report-banner').style.display).toBe('none');
    expect(theElement('orders-card').style.display).toBe('block');
    expect(theAsked('log').length).toBe(2); // the older turn's snapshot, then the GM's log; none for the live one
    // a game row with no turn: Turn 1, no buttons, the live turn 1
    answers['game'] = () => ok(aGame({ turn: undefined }));
    await theReportOpened();
    expect(textOf('report-title')).toBe('Open Vale — Turn 1');
    expect(textOf('orders-turn-num')).toBe('1');
    expect(theElement('turn-nav-btns').querySelectorAll('button').length).toBe(0);
    expect(stage('currentGamePlayer._liveTurn + "/" + currentReport._liveTurn')).toBe('1/1');
    // turn 0, and a report still waiting for it: the GM is setting up
    for (const [game, report, liveTurns] of [
      [aGame({ turn: 0 }), {}, '1/1'],
      [aGame(), { waitingForTurn0: true }, '3/3'],
    ] as const) {
      answers['game'] = () => ok(game);
      answers['seat'] = () => ok(aSeat(JSON.stringify(report)));
      theElement('report-provinces').innerHTML = 'old';
      await theReportOpened();
      expect(textOf('report-kingdom')).toContain('The GM is setting up the game world.');
      expect(theElement('report-provinces').innerHTML).toBe('');
      expect(theElement('orders-card').style.display).toBe('none');
      expect(stage('currentGamePlayer._liveTurn + "/" + currentReport._liveTurn')).toBe(liveTurns);
    }
    expect(textOf('report-title')).toBe('Open Vale — Turn 3');
  });
  test('the Dispatches failing to start is only warned of; the refresh reopens the seat last opened', async () => {
    answers['seat'] = () => ok(aSeat(JSON.stringify({ diplomacy: { known: [null] } })));
    await theReportOpened();
    await wait(20);
    const warnings = warned.filter((w) => w[0] === 'Dispatches:');
    expect(warnings.length).toBe(1);
    expect(theMessageOf(warnings[0]?.[1])).toBe("TypeError: Cannot read properties of null (reading 'index')");
    answers['seat'] = fresh['seat'] ?? answers['seat'];
    stage('currentGamePlayerId = null;');
    asked.length = 0;
    call('refreshOpenReport');
    expect(theAsked('seat')).toEqual([]);
    stage('currentGamePlayerId = "R1";');
    theElement('new-turn-banner').style.display = 'block';
    call('refreshOpenReport');
    await wait(20);
    expect(theAsked('seat')).toEqual([['R1']]);
    expect(theElement('new-turn-banner').style.display).toBe('none');
  });
});

/** Draws the read-only view of the report, as the screen does for the live turn and a past one. */
function theViewOf(report: unknown): void {
  stage('viewedTurn = null;');
  call('renderReportView', report);
}
/** A hero's card, by his name. */
const theCardOf = (name: string): string =>
  [...theElement('report-kingdom').querySelectorAll('.char-card')]
    .map((c) => c.textContent.replace(/\s+/g, ' ').trim())
    .find((t) => t.includes(name)) ?? `no card for ${name}`;
const A_LEDGER = {
  gold: 0,
  taxIncome: 20,
  armyWages: 4,
  heroWages: Number.NaN,
  alignment: '',
  sageDiscG: null,
  sdRecords: 2,
  sdAgri: Number.NaN,
  interestBonus: 1,
  consecG: 4,
  taxBonus: 0,
  earthquakeReduction: 1,
  enslaveReduction: 2,
  taxBonusCutG: 3,
  taxBonusCapG: 5,
  hostLeaderG: 2,
  orcSpoilsG: 0,
  nextArmyWages: 6,
  heroWageDisc: 1,
};
const A_HEROES = [
  {
    id: 1,
    name: 'Aldric Vane',
    isKing: true,
    hp: 7,
    maxHp: 10,
    alignment: '',
    temperEff: 'calm',
    locationId: 4,
    locationName: '',
    armies: [],
    titlesHeld: [{ name: 'Warden' }],
    minorHeld: [{ name: 'Scout', perk: '+1 to spying' }],
    items: [{ name: 'Plain Ring', desc: 'old and worn' }],
  },
  {
    id: 2,
    name: 'Brand',
    hp: 4,
    maxHp: 0,
    pay: 0,
    temper: 'bold',
    temperEff: 'bold',
    effectiveSpeed: null,
    effectiveAirSpeed: 5,
    effectiveSeaSpeed: null,
    armies: [
      { type: 'Spearmen', quality: 'Green', speed: 0, moveRate: 2, moveKind: 'sea' },
      { type: 'Spearmen', quality: 'Green', speed: 4 },
      { type: 'Thunderbirds', quality: 'Green', speed: 6, moveRate: 3, moveKind: 'air' },
    ],
  },
  {
    id: 3,
    name: 'Cora Wilde',
    skills: { druid: 2 },
    effectiveSpeed: 2,
    effectiveSeaSpeed: 4,
    armies: [{ type: 'Thunderbirds', quality: 'Green', speed: 6 }],
  },
  { id: 4, name: 'Gone', alive: false },
  { id: 5, name: 'Fenn' },
];

describe('the read-only view: the realm card', () => {
  test("the ledger: none as nothing (next turn's wages of none show no next-turn line), a sum not a number as 0, the Sage's discoveries summed, the base worked out", () => {
    theViewOf({ kingdom: A_LEDGER, ownedProvinces: [{ id: 1 }, { id: 2 }] });
    const k1 = textOf('report-kingdom');
    expect(k1).toContain('⚖ Neutral Realm Your realm prizes pragmatism above all.');
    expect(k1).toContain(
      'Treasury0g Tax Income20g/turnBase province tax: 16g+4g consecrated ground+3g Sage Discoveries−3g of item tax gold above the 5g cap (5% of base tax)−1g lost to earthquake damage−2g enslaved provinces seethe',
    );
    expect(k1).toContain(
      'Army Wages4g/turnafter −2g the Host-Leadernext turn: 6g Hero Wages0g/turnafter −1g wage discounts',
    );
    expect(k1).toContain('Net Income+16g/turn Provinces2');
    theViewOf({ kingdom: { ...A_LEDGER, nextArmyWages: null, nextHeroWages: null } });
    const sameWagesNextTurn = textOf('report-kingdom');
    expect(sameWagesNextTurn).toContain(
      'Army Wages4g/turnafter −2g the Host-Leader Hero Wages0g/turnafter −1g wage discounts Net Income',
    );
    expect(sameWagesNextTurn).not.toContain('next turn:');
    theViewOf({ kingdom: { ...A_LEDGER, sageDiscG: 7, rawTaxBase: 9, alignment: 'Druidic' } });
    const k2 = textOf('report-kingdom');
    expect(k2).toContain('🌿 Druidic Realm');
    expect(k2).toContain('🌿 Druidic bonuses');
    expect(k2).toContain('Base province tax: 9g+4g consecrated ground+7g Sage Discoveries');
    theViewOf({ kingdom: { taxIncome: Number.NaN, alignment: 'Good' } });
    expect(textOf('report-kingdom')).toContain('Tax Income0g/turnBase province tax: 0gno bonuses');
    theViewOf({ kingdom: { taxIncome: 5, sageDiscG: 0, rawTaxBase: 0, sdRecords: 2 } });
    expect(textOf('report-kingdom')).toContain('Tax Income5g/turnBase province tax: 0gno bonuses');
    theViewOf({ kingdom: { alignment: 'Evil' } });
    const k3 = textOf('report-kingdom');
    expect(k3).toContain('💀 Evil Realm');
    expect(k3).toContain('[M] Monsters:');
    expect(k3).toContain('Base province tax: 0gno bonuses');
    theViewOf({ kingdom: { alignment: 'Zany', taxIncome: 3 } });
    expect(textOf('report-kingdom')).toMatch(/^Treasury0g Tax Income3g\/turnBase province tax: 3gno bonuses/);
  });
  test('the heroes: health, pace, temper, place, wage, items, titles and the armies they lead', () => {
    theViewOf({ kingdom: { color: '#3366aa' }, characters: A_HEROES });
    expect(theElement('report-kingdom').querySelectorAll('.char-card').length).toBe(4);
    expect(theCardOf('Fenn')).toContain('Move: 5 provinces/turn Pay: 1g/turn No skills Armies leadingNo armies led');
    expect(theCardOf('Aldric')).toBe(
      '👑 Aldric Vane (Your King) HP 7/10 Uninhabited · — · — (fights as calm — equipped item) HP: 7/10 📍 In Unknown Move: 5 provinces/turn No skills 🔮 Plain Ring · Weak [carried — needs no slot] (old and worn) Titles & perks🏆 Warden 🎖 Scout +1 to spying Armies leadingNo armies led — moves 5 provinces/turn on its own.',
    );
    expect(theElement('report-kingdom').querySelector('.char-hp-bar')?.getAttribute('style')).toBe('width:70%');
    const brand = theCardOf('Brand');
    expect(brand).toContain('HP 4/0 Uninhabited · — · bold HP: 4/0 📍 In Unknown Move: 3 provinces/turn Pay: 1g/turn');
    expect(brand).toContain('🛡️ 2× Spearmen, 🦅 Thunderbirds · 🏃 Land 3 · 🦅 Flying 5 ▸ show units');
    expect(brand).toContain(
      'str 4 · move 2 (sea)🛡️ Spearmen, Green, Base str 4 str 4🦅 Creature, Thunderbirds, Green, Base str 11 str 2 · move 3 (air)',
    );
    expect(brand).toContain('🏃 Move 3 provinces/turn');
    expect(theCardOf('Cora')).toContain('Move: 2 provinces/turn Pay: 1g/turn Druid: 2');
    expect(theCardOf('Cora')).toContain('🦅 Thunderbirds · 🏃 Land 2 · ⚓ Sea 4 ▸ show units');
    // a hero whose Druid leads his beasts is named by his first name; one with no name stops the card
    theViewOf({ characters: [{ id: 5, name: 'Dain Holt', skills: { druid: 4 }, armies: [{ type: 'Thunderbirds' }] }] });
    expect(theCardOf('Dain')).toContain('🌿 1 unit need Druid (Dain qualifies)');
    expect(theElement('report-kingdom').innerHTML).toContain('color:var(--ink)');
    expect(() => {
      theViewOf({ characters: [{ id: 5, skills: { druid: 4 }, armies: [{ type: 'Thunderbirds' }] }] });
    }).toThrow("Cannot read properties of undefined (reading 'split')");
    expect(() => {
      theViewOf({ characters: [{ id: 6, name: 'Eda', minorHeld: [null] }] });
    }).toThrow("Cannot read properties of null (reading 'name')");
    expect(() => {
      theViewOf({ characters: [{ id: 6, name: 'Eda', titlesHeld: [undefined] }] });
    }).toThrow("Cannot read properties of undefined (reading 'name')");
    expect(() => {
      theViewOf({ characters: [{ id: 6, name: 'Eda', items: [null] }] });
    }).toThrow("Cannot read properties of null (reading 'name')");
  });
});

const THE_OTHER_CARDS = {
  ownedProvinces: [
    {
      id: 2,
      name: 'Brackenmoor',
      terrain: 'forest',
      tax: 3,
      race: 'Human',
      explored: Number.NaN,
      features: [{ name: 'Old Den', discovered: true }, { name: 'Bone Pit', cleared: true }, { name: 'Hidden Hole' }],
      armyTypes: ['Spearmen'],
      garrisonArmies: [{ type: 'Spearmen', quality: 'Green' }],
      neutralDefenders: [{ type: 'Archers', quality: 'Veteran' }],
    },
    { id: 3, terrain: 'plains', tax: 1, explored: 40 },
    { id: 4, name: 'Ashfold', terrain: 'hills', tax: 2 },
  ],
  visibleDeadHeroes: [
    {
      name: 'Edric',
      race: 'Elf',
      alignment: '',
      locationName: 'Fen',
      killedOnTurn: 2,
      topSkill: { skill: 'melee', level: 3 },
      servedOther: false,
      inVisibleProv: true,
    },
    { name: 'Ysolde', locationName: 'Ford', killedOnTurn: 1, topSkill: { skill: 'mystery', level: 1 }, player: 1 },
    { name: 'Wynn', race: 'Human', alignment: 'Good', locationName: 'Crag', killedOnTurn: 3 },
  ],
  graveIntel: [
    null,
    { name: 'Hollow', turn: 1, detail: [] },
    { name: 'Marsh', turn: 4, detail: [{ n: 3, k: 'Spearmen' }], detailPartial: true, detailTurn: 5 },
    { name: 'Ridge', detail: [{ n: 1, k: 'Archers' }], detailTurn: 2, turn: 2 },
    { name: 'Moor', detail: [{ n: 2, k: 'Pikes' }] },
  ],
  mercIntel: [
    { id: 1, type: 'Archers', unitName: '', quality: 'Veteran', location: 'Fen' },
    { id: 2, type: 'Pikes', unitName: 'Red Band', quality: 'Green', location: 'Marsh' },
  ],
  heroSightings: [
    {
      type: 'wandering',
      name: 'Kell',
      race: 'Dwarf',
      alignment: 'Good',
      locationName: 'Fen',
      topSkill: { skill: 'archery', level: 2 },
      spiedSkills: { melee: 0, sage: 3, mystery: 1 },
      spiedTurn: 4,
      armyBand: 'a small band',
      pay: null,
      inOwnedProvince: true,
    },
    {
      type: 'wandering',
      name: 'Lio',
      race: 'Elf',
      alignment: 'Neutral',
      locationName: 'Ford',
      topSkill: { skill: 'mystery', level: 1 },
      spiedSkills: { melee: 0 },
      pay: 2,
    },
    { type: 'wandering', name: 'Mab', race: 'Human', alignment: 'Evil', locationName: 'Moor' },
    {
      type: 'neutral_guard',
      name: 'Grom',
      race: 'Orc',
      alignment: 'Evil',
      locationName: 'Crag',
      spiedSkills: { tactical: 2, mystery: 1 },
      spiedTurn: 3,
      inOwnedProvince: true,
    },
    {
      type: 'neutral_guard',
      name: 'Hask',
      race: 'Orc',
      alignment: 'Evil',
      locationName: 'Crag',
      topSkill: { skill: 'mystery', level: 2 },
      spiedSkills: { melee: 0 },
    },
    { type: 'neutral_guard', name: 'Iro', race: 'Orc', alignment: 'Evil', locationName: 'Crag' },
    {
      type: 'enemy',
      name: 'Sable',
      kingdom: 'Duskmoor',
      locationName: 'Ford',
      spiedSkills: { spy: 1, white: 4, mystery: 2 },
      spiedTurn: 2,
      inOwnedProvince: true,
    },
    {
      type: 'enemy',
      name: 'Tor',
      kingdom: 'Duskmoor',
      race: 'Human',
      locationName: 'Ford',
      topSkill: { skill: 'mystery', level: 3 },
      spiedSkills: { melee: 0 },
    },
    { type: 'enemy', name: 'Uma', kingdom: 'Duskmoor', alignment: 'Evil', locationName: 'Ford' },
  ],
  provinceEvents: [
    { provName: 'Fen', phase: 2, text: 'A flood.' },
    { provName: '', phase: null, text: 'A quake.' },
    { provName: 'Fen', phase: 0, text: 'A blessing.' },
    { provName: 'Ashfold', phase: 5, text: 'Odd lights.' },
    { text: 'A plague.', phase: 1 },
  ],
  provinceCharIntel: [
    { spied: false, provName: 'Unseen' },
    {
      spied: true,
      provName: 'Ford',
      characters: [
        { category: 'own', name: 'Mine' },
        {
          category: 'enemy',
          name: 'Sable',
          color: '#aa3333',
          isKing: true,
          kingdom: '',
          armies: [{ type: 'Pikes', quality: 'Green', unitName: 'Black Pikes' }],
          spiedSkills: { melee: 2, sage: 0, mystery: 5 },
        },
        { category: 'enemy', name: 'Tor', kingdom: 'Duskmoor', armies: [] },
        { category: 'neutral', name: 'Grom', isNeutralGuard: true, armyBand: 'no armies' },
        { category: 'wandering', name: 'Pell', armyBand: 'a few' },
        { category: 'wandering', name: 'Tam', armyCount: 1 },
        { category: 'wandering', name: 'Ula', armyCount: 2 },
        { category: 'wandering', name: 'Vix', armyCount: 0 },
        { category: 'wandering', name: 'Wyn', spiedSkills: { melee: 0 } },
      ],
    },
    { spied: true, provName: 'Empty', characters: [{ category: 'own', name: 'Mine' }] },
    { spied: true, provName: 'Bare' },
  ],
  spyActivity: [
    {
      provName: 'Ford',
      sincePhase: 1,
      lines: [{ phase: 3, text: 'Sable marched.' }, { phase: -1, text: 'A shadow.' }, { text: 'A whisper.' }],
    },
    { provName: 'Crag' },
  ],
  knownFeatures: [
    { name: 'Old Den', province: 'Fen', monster: 'Wolf', monsterCat: 'Beast', monsterPower: 'Weak' },
    { name: 'Stone Ring', province: 'Fen', ritualSite: true },
    { name: 'Bone Pit', province: '', cleared: true, monsterPower: 'Powerful' },
    {
      name: 'Wyrm Hole',
      province: 'Crag',
      monster: 'Wyrm',
      monsterPower: 'Mythic',
      isOwned: true,
      rumour: { turn: 3, gold: 40, items: [], stolen: ['Gem'], wields: ['Fire', 'Frost'] },
    },
    { name: 'Bog', province: 'Crag', monster: 'Hag', rumour: { turn: 2, gold: 5 } },
    {
      name: 'Vault',
      province: 'Crag',
      monster: 'Wolf',
      monsterPower: 'Legendary',
      rumour: { turn: 1, gold: 9, items: ['Crown'] },
    },
  ],
  knownGuardianWeaknesses: { Wolf: { name: 'Fire', desc: 'it fears flame' } },
  discoveries: [
    { category: 'Military', name: 'Drill', turnDiscovered: 2, desc: 'Better drill.' },
    { category: 'Lore', name: 'Runes', turnDiscovered: 3, desc: 'Old runes.' },
    { name: 'Stray', turnDiscovered: 1, desc: 'Unfiled.' },
    { category: 'Military', name: 'Forge', turnDiscovered: 4, desc: 'Hot iron.' },
  ],
};

describe('the read-only view: the other cards', () => {
  test('the provinces, by name (none first), with their lairs, the units they raise, their garrisons and defenders', () => {
    theViewOf(THE_OTHER_CARDS);
    expect(textOf('report-provinces')).toBe(
      'Plains Tax: 1g/turn · Uninhabited · Explored: 40% No lairs discovered yet Recruitable: none , Ashfold Hills Tax: 2g/turn · Uninhabited · Explored: 0% No lairs discovered yet Recruitable: none , Brackenmoor Forest Tax: 3g/turn · Human · Explored: 0% Known lairs: Old Den Cleared: Bone Pit Recruitable: 🛡️ Spearmen Garrisoned (unled):🛡️ Spearmen, Green, Base str 4 Defenders:🛡️ Archers, Veteran, Base str 12',
    );
    expect(theElement('report-provinces').innerHTML).toContain('color:var(--ink)');
  });
  test('the fallen, the graves, the bands and the heroes seen, in the Other Armies & Heroes card', () => {
    theViewOf(THE_OTHER_CARDS);
    const other = textOf('report-other-forces');
    for (const part of [
      'Edric (dead) (Elf) — a neutral hero, sworn to no crown when they fell — body lies in Fen (fell turn 2) renowned for Melee 💀 A hero with the Resurrect spell can raise them from this province.',
      'Ysolde (dead) — a hero of another realm when they fell — body lies in Ford (fell turn 1) renowned for mystery ⛔ Sworn to another crown in life',
      'Wynn (dead) (Human, Good) — a neutral hero, sworn to no crown when they fell — body lies in Crag (fell turn 3) No notable skills Last known location',
      '💀 Graveyards Known Marsh (seen on turn 4) The dead: at least 3× Spearmen — Grave-sight names only the crack and elite; lesser dead may lie here unseen. (read turn 5) Older knowledge',
      'Ridge (seen on turn 2) The dead: 1× Archers Older knowledge',
      'Moor (seen on turn ?) The dead: 2× Pikes Older knowledge',
      'Mercenary Bands Archers (Veteran Archers) — Fen Available for hire — use Recruit Armies in Fen. Red Band (Green Pikes) — Marsh',
      'Wandering Heroes ⚔ Kell (Dwarf, Good) — Fen 🔍 Skills (spied turn 4): Sage 3, mystery 1 · a small band · Will not serve your crown (alignment gulf) · In your province',
      '⚔ Lio (Elf, Neutral) — Ford renowned for mystery · Hire for 2g/turn ⚔ Mab (Human, Evil) — Moor No known skills · Will not serve your crown',
      'Local Chieftains 🛡 Grom (local chieftain — Orc, Evil) — Crag 🔍 Skills (spied turn 3): Tactical 2, mystery 1 · In your province 🛡 Hask (local chieftain — Orc, Evil) — Crag renowned for mystery 🛡 Iro (local chieftain — Orc, Evil) — Crag No known skills',
      'Enemy Heroes 👁 Sable of Duskmoor — Ford 🔍 Skills (spied turn 2): White Magic 4, mystery 2, Spy 1 · In your territory 👁 Tor of Duskmoor (Human) — Ford renowned for mystery 👁 Uma of Duskmoor (Evil) — Ford No known skills',
    ])
      expect(other).toContain(part);
    expect(other).not.toContain('Hollow');
  });
  test("the province reports by province and season, the spied provinces' heroes, and the spies' watch", () => {
    theViewOf(THE_OTHER_CARDS);
    expect(textOf('report-intel')).toBe(
      "Province Reports Ashfold Odd lights. Fen Spring: A blessing.Late Summer: A flood. Unknown province Early Summer: A plague.A quake. 🔍 Spied Provinces Ford Sable 👑 of an enemy realm — Black Pikes🔍 Skills: mystery 5, Melee 2Tor of DuskmoorGrom (local chieftain)Pell (wandering) — leads a fewTam (wandering) — leads 1 unitUla (wandering) — leads 2 unitsVix (wandering)Wyn (wandering) Empty No other characters present at turn's end. Bare No other characters present at turn's end. 🔍 Spy Activity Reports Ford Watched by your agent from Early Summer onward: Fall: Sable marched.A shadow.A whisper. Crag Watched by your agent from later that turn onward:",
    );
  });
  test('the lairs by province, their guardians, their weaknesses and what Hunting Rumours learned', () => {
    theViewOf(THE_OTHER_CARDS);
    expect(textOf('report-lairs')).toContain(
      '📍 Crag (3 lairs) ⭐ Wyrm Hole? Mythic Guardian: Wyrm💰 Hoard known (turn 3) — exactly 40g — its magic (Gem) was already lifted by a thief. It wields Fire, Frost against all comers. ⭐ Bog Guardian: Hag💰 Hoard known (turn 2) — exactly 5g — no magic lies there. ⭐ Vault🔥 Legendary Guardian: Wolf💥 Weakness known — Fire: it fears flame.💰 Hoard known (turn 1) — exactly 9g, and Crown. 📍 Fen (2 lairs) ⭐ Old Den🐾 Weak Guardian: Wolf (beast)💥 Weakness known — Fire: it fears flame. 🌙 Stone Ring A sacred site of the old faith — only a Pagan realm may Perform Rites here. 📍 Unknown province (1 lair) ✓ Bone Pit (cleared — no guardian)',
    );
    const wyrm = [...theElement('report-lairs').querySelectorAll('.intel-entry')].find((e) =>
      e.textContent.includes('Wyrm Hole'),
    );
    expect(wyrm?.innerHTML).toContain('color:#7a5510');
    theViewOf({ knownFeatures: [{ name: 'Bog', province: 'Crag', monster: 'Hag' }] });
    expect(textOf('report-lairs')).toContain('⭐ Bog Guardian: Hag');
    expect(textOf('report-lairs')).not.toContain('Weakness');
  });
  test('the discoveries by kind (a kind of none filed under its words), and a gap among them stops the card', () => {
    theViewOf(THE_OTHER_CARDS);
    expect(textOf('report-discoveries')).toBe(
      'Military Drill (Turn 2) Better drill. Forge (Turn 4) Hot iron. , Lore Runes (Turn 3) Old runes. , undefined Stray (Turn 1) Unfiled.',
    );
    expect(theElement('report-discoveries').innerHTML.match(/#555/g)?.length).toBe(4);
    expect(() => {
      theViewOf({ discoveries: [null] });
    }).toThrow("Cannot read properties of null (reading 'category')");
  });
  test('an empty report says so on every card; intelligence the chronicle already shows leaves the card empty', () => {
    theViewOf({});
    expect(textOf('report-log')).toContain('No events yet.');
    expect(textOf('report-kingdom')).toMatch(
      /^⚖ Neutral Realm .* Treasury0g Tax Income0g\/turnBase province tax: 0gno bonuses.*Provinces0$/,
    );
    expect(theElement('report-kingdom').querySelectorAll('.char-card').length).toBe(0);
    expect(textOf('report-provinces')).toBe('No provinces owned yet.');
    expect(textOf('report-intel')).toBe('No intelligence gathered yet. Visit or spy provinces to learn more.');
    expect(textOf('report-other-forces')).toBe('No mercenary bands or loose heroes sighted yet.');
    expect(textOf('report-lairs')).toBe('No lairs discovered yet. Explore or scout provinces to find them.');
    expect(textOf('report-discoveries')).toBe('No discoveries yet. Give Research orders to your scholars (Sage 1+).');
    theViewOf({ lastTurnLog: [{ text: '[Intelligence] A rumour from the hills.', phase: 1 }] });
    expect(theElement('report-intel').innerHTML).toBe('');
  });
});

/** Opens the past turn `turn` of the seat R1 (the game G1, the realm 0): what it rejects with, or nothing. */
async function thePastTurnOpened(turn: number): Promise<unknown> {
  try {
    await call('loadPastReport', 'G1', 0, turn);
    return undefined;
  } catch (e) {
    return e;
  }
}
/** The turn's logs: the realm's snapshot (realm 0), and the GM's whole log (-1). */
const theLogs =
  (snapshot: unknown, gmsLog: unknown = null) =>
  (...args: unknown[]): AnAnswer => {
    if (args[2] === -1) return ok(gmsLog === null ? null : [{ entries: gmsLog }]);
    return ok(snapshot === null ? [] : [{ entries: snapshot }]);
  };

describe('a past turn', () => {
  test('its snapshot, as words or as held, is shown read only; one that is no object shows as an empty report', async () => {
    theElement('orders-msg').innerHTML = 'old';
    answers['log'] = theLogs(JSON.stringify({ kingdom: { gold: 31 } }));
    expect(await thePastTurnOpened(2)).toBeUndefined();
    expect(textOf('prev-report-banner')).toBe('Viewing Turn 3 — read only. ← Current Turn');
    expect(textOf('report-kingdom')).toContain('Treasury31g');
    expect(theElement('orders-card').style.display).toBe('none');
    expect(theElement('orders-msg').innerHTML).toBe('');
    expect(theElement('save-msg').style.display).toBe('none');
    expect(stage('viewingReport.kingdom.gold')).toBe(31);
    answers['log'] = theLogs({ kingdom: { gold: 32 } });
    await thePastTurnOpened(0);
    expect(textOf('prev-report-banner')).toBe('Viewing Turn 1 (founding) — read only. ← Current Turn');
    expect(textOf('report-kingdom')).toContain('Treasury32g');
    theViewOf({});
    const cards = ['report-kingdom', 'report-provinces', 'report-other-forces', 'report-lairs', 'report-discoveries'];
    const empty = cards.map(textOf);
    for (const held of ['5', '"words"', 'true', 7]) {
      theViewOf({ kingdom: { gold: 99 } });
      answers['log'] = theLogs(held);
      expect(await thePastTurnOpened(2)).toBeUndefined();
      expect(cards.map(textOf)).toEqual(empty);
      expect(textOf('prev-report-banner')).toBe('Viewing Turn 3 — read only. ← Current Turn');
    }
  });
  test("with no snapshot, the chronicle is rebuilt from the GM's log: the lines that name this realm or its heroes", async () => {
    answers['everyColumn'] = () =>
      ok({
        game_state: {
          characters: [
            { id: 1, name: 'Aldric', player: 0, isKing: true },
            { id: 2, name: 'Brand', player: 1 },
            { id: 3, name: 'Cora', player: 0 },
            'a stray word',
            7,
          ],
        },
      });
    const gmsLog = [
      { type: 'move', text: 'L1 names the realm.', targets: [0] },
      { text: 'L2 names it in words.', targets: '0,2' },
      { text: 'L3 is the realm acting.', actor: 0 },
      { text: 'L4 names Cora.', charId: 3, phase: 2 },
      { text: 'L5 names two heroes.', charIds: [2, 1] },
      { text: 'L6 is another realm.', targets: [1], charId: 2, charIds: [2] },
      { text: 'L7 has no targets.', targets: 0, actor: 1 },
      'a line of words',
      7,
    ];
    answers['log'] = theLogs('not json {', gmsLog);
    expect(await thePastTurnOpened(2)).toBeUndefined();
    const log = textOf('report-log');
    for (const l of ['L1', 'L2', 'L3', 'L4', 'L5']) expect(log).toContain(l);
    for (const l of ['L6', 'L7']) expect(log).not.toContain(l);
    expect(textOf('prev-report-banner')).toBe(
      "Viewing Turn 3 — read only. (map history isn't available for this turn — showing the current map) ← Current Turn",
    );
    const theSectionOf = (name: string) =>
      [...theElement('report-log').querySelectorAll('.char-chronicle')].find((c) =>
        c.querySelector('.cc-head')?.textContent.includes(name),
      )?.textContent ?? '';
    expect(theSectionOf('Aldric')).toContain('L5');
    expect(theSectionOf('Cora')).toContain('L4');
    expect(theElement('report-log').querySelectorAll('.log-entry').length).toBe(5);
    // targets of no list or words, a gap in the log, a gap among the heroes: the read's TypeError
    answers['log'] = theLogs(null, [{ text: 'odd', targets: { 0: true } }]);
    expect(theMessageOf(await thePastTurnOpened(2))).toBe('TypeError: (e.targets || []).includes is not a function');
    answers['log'] = theLogs(null, [null]);
    expect(theMessageOf(await thePastTurnOpened(2))).toBe(
      "TypeError: Cannot read properties of null (reading 'targets')",
    );
    answers['everyColumn'] = () => ok({ game_state: { characters: [undefined] } });
    answers['log'] = theLogs(null, []);
    expect(theMessageOf(await thePastTurnOpened(2))).toBe(
      "TypeError: Cannot read properties of undefined (reading 'player')",
    );
  });
  test('turn 0 with no log says the realm is founded; a game or a log of none reads as empty', async () => {
    answers['everyColumn'] = () => ok(null);
    answers['log'] = theLogs(null, null);
    theElement('report-log').innerHTML = 'old';
    expect(await thePastTurnOpened(0)).toBeUndefined();
    expect(textOf('report-log')).toBe('Your realm is founded. The realm awaits your first commands.');
    answers['everyColumn'] = () => ok({ game_state: 'a state in words' });
    theElement('report-log').innerHTML = 'old';
    expect(await thePastTurnOpened(1)).toBeUndefined();
    expect(textOf('report-log')).toBe('old');
  });
});

describe('the diplomacy choice', () => {
  test('a choice is kept by the realm; none, or the words "null", takes it back; with no choices held, it stops', () => {
    stage('diploChoices = {}; currentReport = null;');
    call('setDiploChoice', 2, 'war');
    call('setDiploChoice', 3, 'ally');
    expect(stage('JSON.stringify(diploChoices)')).toBe('{"2":"war","3":"ally"}');
    call('setDiploChoice', 2, null);
    call('setDiploChoice', 3, 'null');
    call('setDiploChoice', 4, undefined);
    expect(stage('JSON.stringify(diploChoices)')).toBe('{}');
    stage('diploChoices = null;');
    const theErrorOf = (f: () => unknown): string => {
      try {
        f();
        return 'none';
      } catch (e) {
        return String(Reflect.get(Object(e), 'name'));
      }
    };
    expect(theErrorOf(() => call('setDiploChoice', 2, 'war'))).toBe('TypeError');
    expect(theErrorOf(() => call('setDiploChoice', 2, null))).toBe('TypeError');
  });
});

describe('the folds', () => {
  test("a battle's fold swaps its short and full accounts; one without both, or none, is left as it is", () => {
    const log = theElement('report-log');
    log.innerHTML =
      '<div class="battle-fold"><div class="bf-short">short</div><div class="bf-full" style="display:none">full</div><button class="bf-toggle" aria-expanded="false">a</button><button class="bf-toggle">b</button></div>';
    const btn = log.querySelector('.bf-toggle');
    call('toggleBattleFold', btn);
    expect(log.querySelector<HTMLElement>('.bf-full')?.style.display).toBe('block');
    expect(log.querySelector<HTMLElement>('.bf-short')?.style.display).toBe('none');
    expect([...log.querySelectorAll('.bf-toggle')].map((b) => b.getAttribute('aria-expanded'))).toEqual([
      'true',
      'true',
    ]);
    call('toggleBattleFold', btn);
    expect(log.querySelector<HTMLElement>('.bf-full')?.style.display).toBe('none');
    expect([...log.querySelectorAll('.bf-toggle')].map((b) => b.getAttribute('aria-expanded'))).toEqual([
      'false',
      'false',
    ]);
    log.innerHTML =
      '<div class="battle-fold"><svg class="bf-short"></svg><svg class="bf-full" style="display:none"></svg><button class="bf-toggle">a</button></div>';
    call('toggleBattleFold', log.querySelector('.bf-toggle'));
    expect(log.querySelector<SVGElement>('.bf-full')?.style.display).toBe('block');
    log.innerHTML =
      '<div class="battle-fold"><div class="bf-full">full</div><button class="bf-toggle">a</button></div>';
    call('toggleBattleFold', log.querySelector('.bf-toggle'));
    expect(log.querySelector<HTMLElement>('.bf-full')?.style.display).toBe('');
    call('toggleBattleFold', null);
    call('toggleBattleFold', log);
  });
  test('a section folds and unfolds by its button, every section of a column at once, and the chronicle at once', () => {
    theViewOf({
      lastTurnLog: [{ text: 'Aldric rests.', charId: 1, phase: 0 }],
      characters: [{ id: 1, name: 'Aldric' }],
    });
    const col = theElement('rp-report-col');
    const cards = [...col.querySelectorAll('.card')];
    const toggles = cards.map((c) => c.querySelector('h2 .sec-toggle'));
    expect(toggles.every((t) => t !== null)).toBe(true);
    call('initReportCollapsers');
    expect(cards.map((c) => c.querySelectorAll('h2 .sec-toggle').length)).toEqual(cards.map(() => 1));
    const first = cards[0];
    (toggles[0] as HTMLElement).click();
    expect(first?.classList.contains('sec-collapsed')).toBe(true);
    expect(toggles[0]?.getAttribute('aria-expanded')).toBe('false');
    expect(toggles[0]?.innerHTML).toBe('▸');
    call('toggleSection', toggles[0]);
    expect(first?.classList.contains('sec-collapsed')).toBe(false);
    expect(toggles[0]?.innerHTML).toBe('▾');
    call('collapseAllSections', '#rp-report-col', true);
    expect(cards.every((c) => c.classList.contains('sec-collapsed'))).toBe(true);
    call('collapseAllSections', '#rp-report-col', false);
    expect(cards.some((c) => c.classList.contains('sec-collapsed'))).toBe(false);
    call('collapseAllSections', '#no-such-column', true);
    call('collapseAllSections', '#orders-column', true);
    expect(theElement('orders-card').classList.contains('sec-collapsed')).toBe(false);
    const chronicle = [...theElement('report-log').querySelectorAll('.char-chronicle')];
    expect(chronicle.length).toBeGreaterThan(0);
    call('collapseAllChronicle', true);
    expect(chronicle.every((c) => c.classList.contains('sec-collapsed'))).toBe(true);
    call('collapseAllChronicle', false);
    expect(chronicle.some((c) => c.classList.contains('sec-collapsed'))).toBe(false);
    const outside = doc.createElement('button');
    call('toggleSection', outside);
  });
});
