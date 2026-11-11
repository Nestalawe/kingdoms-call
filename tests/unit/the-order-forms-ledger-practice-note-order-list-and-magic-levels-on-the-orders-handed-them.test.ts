// The order form's treasury ledger, the note under an order that quotes its chance, the order list and the levels of
// magic a hero's practices may raise (plan P1-11e42), imported and called as they are, with no vm: their file reads no
// page field and no currentReport, but the report and the orders the form holds handed to it. On a staged report (a
// realm of two living heroes and a fallen one, a province with its prices, two wandering heroes and two lairs) and
// orders written as the page's snapshot holds them, each answer is pinned; then the page's side, which asks them by the
// page's old names on its own snapshot (a stand-in document): a pre-order card's own fields read though the report
// doesn't list him. Level 1: functions on plain values; a page would test the same functions through the DOM.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line): the ledger's spend and
// new wages by kind (companies at the price of the province the recruiter stands in, after an earlier march too, a
// Druid 6 recruiter's beast at half price and wage, a hire at the report's wage and at the alignment's, word from a
// province at the report's price and at its row's, the lairs' rumours by grade, Harvest the Field; a fallen hero's
// orders and a phase past the fifth not counted); the Practice Skill note's chance (a Human of a Human realm, a skill
// at 5, none chosen) and the Spy note; the order list of a hero, a king, a realm whose Wonder stands and a charmed
// card, in the display order; each school's level after the earlier practices, an item's bonus counted; a hire's wage
// with the report's figure and without; each red on a fault planted in the line it reads (P1-11e42's PR; the march
// before a recruit, P1-21o's mutation session); since P1-16b, which typed the file, the ledger's and the notes' fallbacks
// on a figure the report leaves out, a hero's wage cut by his alignment, a seized enemy hero's mastery and a hire's wage
// on a report of no creed, each red on its plant.
import { afterEach, describe, expect, test } from 'vitest';
import {
  ACTION_DISPLAY_ORDER,
  effMagicLvl,
  gdAlreadyBuiltP,
  heroHireWageOfP,
  theMagicLevelsAHerosPractisesBeforeAPhaseMayRaise,
  theNoteUnderAnOrderThatQuotesItsChance,
  theOrdersTheFormOffersAHero,
  theTreasuryLedgerOnTheseOrders,
} from '../../src/ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';
import {
  actionsFor,
  computeOrderLedgerP,
  orderChanceNote,
  projectedMagicLevels,
} from '../../src/ui/player/the-orders-the-form-holds-handed-to-its-forecasts.ts';

type AnOrder = Record<string, unknown>;
/** The field `key` of an answer (a school's level, say), or undefined. */
const at = (x: unknown, key: string): unknown =>
  typeof x === 'object' && x !== null ? (Reflect.get(x, key) as unknown) : undefined;
/** The orders as the page's snapshot holds them: by hero, his order of each phase. */
const ordersOf = (byHero: Record<string, AnOrder[]>) => ({ byHero, declarations: null });
const recruit = (target: string): AnOrder => ({
  action: 'Recruit Armies',
  target,
  recruit: { musterTo: null, ticked: target.split(',') },
});

/** A Good realm of Humans: 50g in its treasury, 12g of tax to come, 5g and 3g of wages; a province (1) whose companies
 *  and lairs it knows, with two wandering heroes (one whose wage the report gives), and one next door (2) where
 *  Spearmen cost 9g to its 6g; Aldo (Druid 7, Sage 2, his realm's king where `king`) and Brin in province 1, and Cael,
 *  who fell this turn. A fresh report each call. */
function aReport({ king = false, wonder = false } = {}) {
  const provinces = Array.from({ length: 4 }, (_, id) => ({
    id,
    row: 0,
    col: id,
    name: `Province ${String(id)}`,
    terrain: 'plains',
    owner: 0,
  }));
  return {
    playerIndex: 0,
    kingdom: { alignment: 'Good', race: 'Human', gold: 50, taxIncome: 12, nextArmyWages: 5, nextHeroWages: 3 },
    discoveries: wonder ? [{ id: 'gd' }] : [],
    orderPrices: { unitCost: { Spearmen: 3, Thunderbirds: 4 }, unitWage: { Spearmen: 2 }, brokerSpy: 4, harvest: 3 },
    worldMeta: { cols: 4, rows: 1, provinces },
    ownedProvinces: provinces.map((p) => ({ id: p.id })),
    provinceOrderData: {
      1: {
        armyTypes: [
          { type: 'Spearmen', cost: 6 },
          { type: 'Thunderbirds', cost: 8 },
        ],
        availableHeroes: [
          { id: 7, alignment: 'Good', hireWage: 5 },
          { id: 8, alignment: 'Evil' },
        ],
        features: [
          { idx: 0, monster: true, monsterPower: 'Powerful' },
          { idx: 1, monster: true, monsterPower: 'Weak' },
        ],
      },
      // the province next door, whose Spearmen cost more
      2: { armyTypes: [{ type: 'Spearmen', cost: 9 }] },
    },
    characters: [
      {
        id: 1,
        name: 'Aldo',
        isKing: king,
        race: 'Human',
        locationId: 1,
        effectiveSpeed: 2,
        effectiveSeaSpeed: 0,
        skills: { druid: 7, sage: 2 },
        items: [],
        armies: [],
      },
      {
        id: 2,
        name: 'Brin',
        locationId: 1,
        effectiveSpeed: 2,
        effectiveSeaSpeed: 0,
        skills: {},
        items: [],
        armies: [],
      },
      { id: 3, name: 'Cael', alive: false, locationId: 1, skills: {}, items: [], armies: [] },
    ],
  };
}

describe('the treasury ledger, on the orders handed in', () => {
  test('companies at the province’s price, a Druid 6 recruiter’s beast at half price and wage, two hires, word, rumours and a harvest', () => {
    const L = theTreasuryLedgerOnTheseOrders(
      aReport(),
      ordersOf({
        1: [
          recruit('Spearmen|2,Thunderbirds'),
          { action: 'Hire Hero', target: '7' },
          { action: 'Broker', target: 'hire:8' },
        ],
        2: [
          { action: 'Hunting Rumours', target: '0,1' },
          { action: 'Harvest the Field', target: '' },
          { action: 'Broker', target: 'spy:3' },
          {},
          {},
          // a sixth phase's order is not one the ledger counts
          { action: 'Hunting Rumours', target: '0' },
        ],
        // a hero who fell this turn gives no order
        3: [{ action: 'Hunting Rumours', target: '1' }],
      }),
    );
    expect(L.cats).toEqual({
      // 2 × 6g and a Thunderbird at half its 8g, then the harvest's 3g; wages 2 × 2g, the bird's 4g halved, 1g
      armies: { g: 19, n: 4, wage: 7 },
      mercs: { g: 0, n: 0, wage: 0 },
      // the report's 5g, and an Evil hero's wage to a Good realm by the alignments' table
      heroes: { g: 9, n: 2, wage: 9 },
      // a Powerful lair's rumour and a Weak one's, and word from a province at the report's 4g
      intel: { g: 8, n: 3, wage: 0 },
      other: { g: 0, n: 0, wage: 0 },
    });
    expect([L.gold, L.spend, L.left, L.tax, L.armyW, L.heroW, L.newWages, L.projected]).toEqual([
      50, 36, 14, 12, 5, 3, 16, 2,
    ]);
  });
  test('a Thunderbird mustered to a comrade who is no Druid pays its full wage there, at its recruiter’s half price', () => {
    const toBrin = recruit('Spearmen|2,Thunderbirds,to:2');
    const L = theTreasuryLedgerOnTheseOrders(aReport(), ordersOf({ 1: [toBrin] }));
    expect(L.cats.armies).toEqual({ g: 16, n: 3, wage: 8 });
  });
  test('a hero who marches next door and then recruits pays the prices of the province he has marched into', () => {
    const L = theTreasuryLedgerOnTheseOrders(
      aReport(),
      ordersOf({ 1: [{ action: 'Move', target: 'prov:2' }, recruit('Spearmen|2')] }),
    );
    // 2 × province 2's 9g (not province 1's 6g, where he stood as the turn began); wages 2 × 2g
    expect(L.cats.armies).toEqual({ g: 18, n: 2, wage: 4 });
  });
  test('word from a province and a harvest at their rows’ prices on a report that names none; no orders, no spend', () => {
    const report = aReport();
    report.orderPrices = { unitCost: {}, unitWage: {} } as typeof report.orderPrices;
    const L = theTreasuryLedgerOnTheseOrders(
      report,
      ordersOf({ 2: [{ action: 'Broker', target: 'spy:3' }, { action: 'Harvest the Field' }] }),
    );
    expect([L.cats.intel.g, L.cats.armies.g, L.cats.armies.wage]).toEqual([2, 2, 1]);
    expect(theTreasuryLedgerOnTheseOrders(aReport(), ordersOf({})).spend).toBe(0);
  });
  test('the fallbacks: a company priced nowhere at 2g, a band of no price at none, a lair of no grade at 1g, a realm of no treasury at 0g', () => {
    // (P1-16b: each `|| n` of the ledger, on a value the report leaves out)
    const report = {
      ...aReport(),
      kingdom: { alignment: 'Good', race: 'Human' },
      mercIntel: [{ id: 7, type: 'Swordsmen', unitName: 'Free Blades' }],
    };
    const lairs = report.provinceOrderData[1].features;
    lairs.push({ idx: 2, monster: true, monsterPower: 'Unheard of' });
    const L = theTreasuryLedgerOnTheseOrders(
      report,
      ordersOf({ 1: [recruit('Pikemen,merc:7')], 2: [{ action: 'Hunting Rumours', target: '2' }] }),
    );
    expect([L.cats.armies.g, L.cats.mercs.g, L.cats.mercs.n, L.cats.intel.g]).toEqual([2, 0, 1, 1]);
    expect([L.gold, L.tax, L.armyW, L.heroW]).toEqual([0, 0, 0, 0]);
  });
  test("a discovery's cut of a hero's wage is the one for the hero's alignment", () => {
    // (P1-16b: the cut read by his alignment's name)
    const report = {
      ...aReport(),
      kingdom: {
        alignment: 'Good',
        race: 'Human',
        theHeroWageDiscoveriesCutsAndTheirRoom: [
          { theGoldItCutsFromAHeroOfEachAlignment: { Evil: 1, Good: 0 }, theRoomLeftUnderItsCap: 5 },
        ],
      },
    };
    const L = theTreasuryLedgerOnTheseOrders(report, ordersOf({ 1: [{ action: 'Broker', target: 'hire:8' }] }));
    // the Evil hero's 4g, 1g less
    expect(L.cats.heroes).toEqual({ g: 4, n: 1, wage: 3 });
  });
});

describe('the note under an order that quotes its chance', () => {
  const practising = {
    id: 1,
    race: 'Human',
    skills: { sage: 2, white: 5 },
    orderChance: {
      practice: { byLevel: [25, 20, 15, 10, 5], discovery: 10 },
      spy: { chance: 47, level: 3 },
    },
  };
  const note = (c: unknown, action: string, target: string | null, report: unknown = aReport()) =>
    String(
      theNoteUnderAnOrderThatQuotesItsChance(
        ...([
          report,
          ordersOf(target === null ? {} : { 1: [{}, { action, target }] }),
          c,
          action,
          1,
        ] as unknown as Parameters<typeof theNoteUnderAnOrderThatQuotesItsChance>),
      ),
    );
  test('the Practice Skill note: the chance at his level, half again for a Human of a Human realm; no roll at 5', () => {
    // the turn's 15% at level 2 (the report's table is the note's words), +10% of the realm's discoveries, ×1.5: 37%
    expect(note(practising, 'Practice Skill', 'sage')).toContain('Improvement: <strong>37%</strong> at Sage 2.');
    expect(note(practising, 'Practice Skill', 'sage')).toContain('A Human of a Human realm learns half as fast again');
    const elsewhere = aReport();
    elsewhere.kingdom.race = 'Elf';
    expect(note(practising, 'Practice Skill', 'sage', elsewhere)).toContain(
      'Improvement: <strong>25%</strong> at Sage 2.',
    );
    expect(note(practising, 'Practice Skill', 'white')).toContain('No roll is made');
    expect(note(practising, 'Practice Skill', null)).toContain('Chance falls as mastery grows: 25% at 0, 20% at 1');
  });
  test('the Spy note of no Spy skill, the Research note at and below Sage 1, and the Assassinate note against a king', () => {
    // (P1-16b: each `|| n` of the notes, on a figure the report leaves out)
    const quoted = (orderChance: unknown, action: string) => note({ id: 1, orderChance }, action, null);
    expect(quoted({ spy: { level: 0 } }, 'Spy')).toContain('No Spy skill — <strong>20%</strong> at best.');
    expect(quoted({ research: { rawLevel: 0 } }, 'Research')).toContain('Research needs Sage 1+');
    expect(quoted({ research: { rawLevel: 1, chance: 30, level: 1 } }, 'Research')).toContain(
      'Discovery: <strong>30%</strong> (Sage 1).',
    );
    expect(quoted({ assassinate: { chance: 60, level: 7 } }, 'Assassinate')).toContain(
      'but only <strong>35%</strong> against a king',
    );
  });
  test('the Spy note, and none for a hero the report quotes no chance for', () => {
    expect(note(practising, 'Spy', null)).toContain('Success: <strong>47%</strong> (Spy 3).');
    expect(note({ id: 1 }, 'Spy', null)).toBe('');
  });
});

describe('the orders the form offers a hero', () => {
  test('in the display order: a hero’s, a king’s, once the Wonder stands, and a charmed card’s', () => {
    const aldo = (report: ReturnType<typeof aReport>) => report.characters[0];
    const hero = theOrdersTheFormOffersAHero(aReport(), aldo(aReport()));
    expect(hero).toEqual([...hero].sort((a, b) => ACTION_DISPLAY_ORDER.indexOf(a) - ACTION_DISPLAY_ORDER.indexOf(b)));
    expect(hero.slice(0, 4)).toEqual(['Awaken Grove', 'Move', 'Practice Skill', 'Research']);
    expect(hero).toContain('Release Hero');
    expect(hero).not.toContain('Call to Arms');
    const kingsReport = aReport({ king: true });
    const kings = theOrdersTheFormOffersAHero(kingsReport, aldo(kingsReport));
    expect(kings.slice(0, 2)).toEqual(['Call to Arms', 'Awaken Grove']);
    expect(kings).not.toContain('Release Hero');
    const atSage9 = { ...aldo(aReport()), skills: { sage: 9 } };
    expect(theOrdersTheFormOffersAHero(aReport(), atSage9)).toContain('Grand Design');
    expect(theOrdersTheFormOffersAHero(aReport({ wonder: true }), atSage9)).not.toContain('Grand Design');
    const charmed = { id: 'charm_9_via_1_ph0', skills: {}, _hiddenSkills: true, _charmEnemy: true };
    const offered = theOrdersTheFormOffersAHero(aReport(), charmed);
    expect(offered).toContain('Research');
    expect(offered.filter((a) => ['Send Item', 'Use Item', 'Disband Army', 'Awaken Grove'].includes(a))).toEqual([]);
    expect(gdAlreadyBuiltP(null)).toBe(false);
  });
  test('an enemy hero whose command is seized for the turn is offered no mastery, though his levels are seen', () => {
    // (P1-16b: the charm's check of the order's mastery row, read once)
    const seized = { ...aReport().characters[0], skills: { sage: 9 }, _charmEnemy: true };
    expect(theOrdersTheFormOffersAHero(aReport(), seized)).not.toContain('Grand Design');
  });
});

describe('the levels of magic a hero’s earlier practices may raise, and a hire’s wage', () => {
  test('each Practice of a school before the phase adds a level to 5; a school at 5 or more gains none; his items count', () => {
    const c = { id: 1, skills: { white: 3, psychic: 5 }, skillEff: { white: { items: 2, aura: 0 } } };
    const orders = ordersOf({
      1: [
        { action: 'Practice Skill', target: 'white' },
        { action: 'Practice Skill', target: 'psychic' },
        { action: 'Practice Skill', target: 'white' },
        { action: 'Practice Skill', target: 'white' },
      ],
    });
    const after3 = theMagicLevelsAHerosPractisesBeforeAPhaseMayRaise(orders, c, 3);
    expect([...after3.practising].sort()).toEqual(['psychic', 'white']);
    expect(after3.practice).toEqual({ white: 2, psychic: 1 });
    const { trained, projected } = after3;
    expect([at(trained, 'white'), at(trained, 'psychic'), at(projected, 'white'), at(projected, 'psychic')]).toEqual([
      5, 5, 7, 5,
    ]);
    expect(at(theMagicLevelsAHerosPractisesBeforeAPhaseMayRaise(orders, c, 1).trained, 'white')).toBe(4);
    // a third practice of White, past 5: practice trains no further
    expect(at(theMagicLevelsAHerosPractisesBeforeAPhaseMayRaise(orders, c, 4).trained, 'white')).toBe(5);
    expect(effMagicLvl(c, 'white')).toBe(5);
  });
  test('a hire’s wage is the report’s where it gives one, else the alignments’', () => {
    expect(heroHireWageOfP({ alignment: 'Evil', hireWage: 9 }, aReport())).toBe(9);
    expect(heroHireWageOfP({ alignment: 'Evil' }, aReport())).toBe(4);
    expect(heroHireWageOfP({ alignment: 'Good' }, aReport())).toBe(2);
    // (P1-16b: a report that gives no realm's creed reads it as Neutral)
    expect(heroHireWageOfP({ alignment: 'Evil' }, {})).toBe(
      heroHireWageOfP({ alignment: 'Evil' }, { kingdom: { alignment: 'Neutral' } }),
    );
    expect(heroHireWageOfP({ alignment: 'Evil' }, {})).not.toBe(
      heroHireWageOfP({ alignment: 'Evil' }, { kingdom: { alignment: 'Divine' } }),
    );
  });
});

describe('the page’s side: its old names on its own snapshot', () => {
  const theDocument: unknown = Reflect.get(globalThis, 'document');
  afterEach(() => {
    Reflect.set(globalThis, 'document', theDocument);
    Reflect.deleteProperty(globalThis, 'currentReport');
  });
  const showing = (fields: Record<string, string>) => {
    Reflect.set(globalThis, 'document', {
      getElementById: (id: string) => (id in fields ? { value: fields[id] } : null),
    });
  };
  test('the ledger and the order list read the report the page shows; a pre-order card’s own fields are read though the report doesn’t list him', () => {
    showing({
      'po-action-2-0': 'Hunting Rumours',
      'po-target-2-0': '0',
      'po-action-hired_8_via_1_ph0-1': 'Practice Skill',
      'po-target-hired_8_via_1_ph0-1': 'white',
      'po-target-hired_8_via_1_ph0-2': 'sage',
    });
    Reflect.set(globalThis, 'currentReport', aReport({ wonder: true }));
    expect(at(computeOrderLedgerP(), 'spend')).toBe(3);
    expect(actionsFor({ id: 2, skills: { sage: 9 } })).not.toContain('Grand Design');
    const card = {
      id: 'hired_8_via_1_ph0',
      race: 'Human',
      skills: { white: 1, sage: 1 },
      orderChance: { practice: { byLevel: [25, 20, 15, 10, 5] } },
    };
    expect(at(at(projectedMagicLevels(card, 2), 'trained'), 'white')).toBe(2);
    expect(String(orderChanceNote(card, 'Practice Skill', 2))).toContain(
      'Improvement: <strong>30%</strong> at Sage 1.',
    );
  });
});
