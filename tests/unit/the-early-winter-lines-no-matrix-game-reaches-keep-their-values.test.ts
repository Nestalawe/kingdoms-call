// The lines of src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts that plan
// P1-10b7 changed to free it of the ts-nocheck line (statements that keep every value: P1-10b's Decision 2 and Choice 1)
// and that no game of the balance matrix reaches. The matrix proves the others (both sets, every realm's report
// identical); these are proved here, each on the value it had before (worked out by the file as it was, with its
// ts-nocheck line):
// - a list the stage guards, missing (the heroes, the world's provinces, a realm's provinces or heroes, a hero's
//   companies, a garrison), reads as an empty one: the same lines and the same state, in the Charm's return, the
//   treasury, the taxes (the Merchant's Ledger, the Castellan, the Free City Charter), the wages (the Druid's half
//   wages, the Host-Leader), the lookup of a unit that disbands, a ship kept for its troops looked at again, a hero who
//   deserts, the Raiders' Muster and the garrison drill;
// - a gap among the heroes or the provinces, a province whose owner is no realm, a Raiders' Muster mark of an older
//   turn, and a hero with a Charm's mark but no hold on him;
// - an item with no effect, and a tax item with no bonus (each pays nothing); a blessing with no multiplier; a company of a quality the
//   tiers don't hold, ranked as Average when a realm can't pay; a company of a type no table prices (2g of wages, and
//   2g off the debt when it goes: only the required scenario's made-up companies meet it, which no baseline compares);
//   a skeletal ship kept for its troops, looked at again.
// Level 1 (unit): the stage is one function, called directly on the engine's modules (plan P1-14a) with a turn's
// context of its own: the state, the GM's log and the phase. The dice are fixed for each call (kcRng.use). The states
// are staged with the fields the stage reads, so their type is given by assertion, as the views' unit cases give a
// staged world's.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill } from '../../src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { ALL_MAGIC_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import type { TurnContext } from '../../src/engine/turn/context.ts';
import type { LogLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theTurnsLinesInWords } from '../../src/views/prose/the-words-of-each-line.ts';

const TURN = 7;
type Obj = Record<string, unknown>;
/** A realm of no alignment the taxes read (no neutral trade, no Grand Design), with no gold, land or heroes. */
const realm = (id: number, extra: Obj = {}): Obj => ({
  id,
  name: `Realm ${String(id)}`,
  race: 'Human',
  alignment: 'Evil',
  gold: 0,
  provinces: [],
  heroes: [],
  discoveries: [],
  ...extra,
});
/** A land province of no tax and no owner, with no garrison. */
const province = (id: number, extra: Obj = {}): Obj => ({
  id,
  name: `Province ${String(id)}`,
  owner: null,
  race: 'Human',
  terrain: 'plains',
  tax: 0,
  garrisonArmies: [],
  ...extra,
});
/** Realm 0's king, standing in province 0, leading nobody, with no items and no skills. */
const hero = (id: number, extra: Obj = {}): Obj => ({
  id,
  name: `Hero ${String(id)}`,
  player: 0,
  alive: true,
  isKing: true,
  pay: 0,
  taxBonus: 0,
  location: 0,
  race: 'Human',
  alignment: 'Evil',
  armies: [],
  items: [],
  skills: {},
  ...extra,
});
const unit = (type: string, quality = 'Green', extra: Obj = {}): Obj => ({
  type,
  quality,
  race: 'Human',
  unitName: `the Test ${type} (${quality})`,
  ...extra,
});
const world = (provinces: unknown[] | undefined): Obj =>
  provinces === undefined ? { cols: 4, rows: 4 } : { cols: 4, rows: 4, provinces };
const state = (s: Obj): Obj => ({ turn: TURN, players: [], characters: [], ...s });

/** Early Winter on `G`, every die at `die`: the words of each line of the GM's log, and the state after. */
function winter(G: Obj, die = 0.99) {
  const turnContext = {
    G,
    turnLog: [] as LogLine[],
    _logCtx: { charId: null, phase: null },
    _currentPhase: 4,
  };
  const was = kcRng.use(() => die);
  try {
    earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill(turnContext as unknown as TurnContext);
  } finally {
    kcRng.use(was);
  }
  // the lines in words, as the views write them and the GM's log stores them (since P1-12d16 they are facts)
  return { lines: theTurnsLinesInWords(turnContext.turnLog).gmLog.map((l) => l.text), G };
}
/** The state as JSON, with each list in `lists` (a path of keys, `*` for every element) written [] where it is missing,
 *  so a state staged without a list compares with one staged with it empty. */
function withTheListsFilled(G: Obj, lists: string[][]): unknown {
  const copy = JSON.parse(JSON.stringify(G)) as Obj;
  const fill = (o: unknown, path: string[]): void => {
    if (o === null || typeof o !== 'object') return;
    const [key, ...rest] = path;
    if (key === undefined) return;
    const obj = o as Obj;
    if (key === '*') {
      for (const v of Object.values(obj)) fill(v, rest);
      return;
    }
    if (rest.length === 0) {
      obj[key] ??= [];
      return;
    }
    fill(obj[key], rest);
  };
  for (const path of lists) fill(copy, path);
  return copy;
}

const items = ALL_MAGIC_ITEMS_P as readonly Obj[];
const theFirstItemWhoseStatIs = (stat: string): Obj => {
  const it = items.find((i) => (i['effect'] as Obj | undefined)?.['stat'] === stat);
  if (!it) throw new Error(`no item of the content pays ${stat}`);
  return { ...it, equipped: true };
};

// ── A list the stage guards, missing, reads as an empty one ────
interface Missing {
  name: string;
  /** The state, with each guarded list missing (true) or empty (false). */
  stage: (missing: boolean) => Obj;
  /** The lists `stage` leaves out. */
  lists: string[][];
  die?: number;
  /** A line the stage must write, so the case reaches what it names. */
  writes: RegExp;
}
const MISSING: Missing[] = [
  {
    name: 'the heroes: the treasury, the taxes and the wages of realms with no hero (one of them with no land)',
    stage: (missing) =>
      state({
        players: [realm(0, { gold: 10, provinces: [0] }), realm(1, { gold: 5 })],
        world: world([province(0, { owner: 0, tax: 4, garrisonArmies: [unit('Human Garrison')] })]),
        characters: missing ? undefined : [],
      }),
    lists: [['characters']],
    writes: /^Realm 0 collects 4g in taxes\.$/,
  },
  {
    name: "the world's provinces: the Merchant's Ledger, the Castellan, the garrisons' wages, the lookup of a company that disbands, the Muster and the drill",
    stage: (missing) =>
      state({
        players: [realm(0, { gold: 0 })],
        characters: [hero(1, { items: [theFirstItemWhoseStatIs('taxPerProv')], armies: [unit('Men-at-Arms')] })],
        _minorHolders: { castellan: { charId: 1 } },
        world: world(missing ? undefined : []),
      }),
    lists: [['world', 'provinces']],
    die: 0.5,
    writes: /\(Men-at-Arms\) disbands — Realm 0 could not pay their wages\.$/,
  },
  {
    name: "a realm's provinces: its treasury told, and its taxes",
    stage: (missing) =>
      state({
        players: [realm(0, { gold: 0, provinces: missing ? undefined : [] })],
        characters: [hero(1)],
        world: world([]),
      }),
    lists: [['players', '*', 'provinces']],
    writes: /^Realm 0 has 0g in the treasury\.$/,
  },
  {
    name: "a realm's heroes: a hero who deserts it",
    stage: (missing) =>
      state({
        players: [realm(0, { gold: 0, heroes: missing ? undefined : [] })],
        characters: [hero(1, { isKing: false, pay: 3 })],
        world: world([]),
      }),
    lists: [['players', '*', 'heroes']],
    die: 0.9,
    writes: /^Hero 1 \(wandering\) abandons Realm 0's service, unpaid and disillusioned\.$/,
  },
  {
    name: "a hero's companies: the wages, the Druid's half wages and the Host-Leader",
    stage: (missing) =>
      state({
        players: [realm(0, { gold: 100 })],
        characters: [
          hero(1, { isKing: false, skills: { druid: 6 }, armies: missing ? undefined : [] }),
          hero(2, { armies: [unit('Forest Ents', 'Veteran', { race: 'Forest Ent' })] }),
        ],
        _minorHolders: { hostleader: { charId: 1 } },
        world: world([]),
      }),
    lists: [['characters', '*', 'armies']],
    writes: /^Realm 0 pays \d+g in wages\./,
  },
  {
    name: "a hero's companies and a garrison: a ship that disbands, looked for at sea and then in the garrisons and the heroes' columns",
    stage: (missing) =>
      state({
        players: [realm(0, { gold: 0, provinces: [0] })],
        characters: [
          hero(1, { isKing: false, armies: missing ? undefined : [] }),
          hero(2, { armies: [unit('Galleon Fleet')] }),
        ],
        world: world([province(0, { owner: 0, garrisonArmies: missing ? undefined : [] })]),
      }),
    lists: [
      ['characters', '*', 'armies'],
      ['world', 'provinces', '*', 'garrisonArmies'],
    ],
    die: 0.5,
    writes: /\(Galleon Fleet\) disbands — Realm 0 could not pay their wages\.$/,
  },
  {
    name: "a hero's companies: a ship kept for its troops, looked at again once they have gone",
    stage: (missing) =>
      state({
        players: [realm(0, { gold: 0 })],
        characters: [
          hero(1, { isKing: false, armies: missing ? undefined : [] }),
          hero(2, { armies: [unit('Galleon Fleet', 'Green'), unit('Men-at-Arms', 'Veteran')] }),
        ],
        world: world([province(0, { terrain: 'sea' })]),
      }),
    lists: [['characters', '*', 'armies']],
    die: 0.5,
    writes: /the ship is no longer needed to carry them\.$/,
  },
  {
    name: 'a garrison: the Free City Charter and the drill',
    stage: (missing) =>
      state({
        players: [realm(0, { alignment: 'Good', discoveries: [{ id: 'gd' }], gold: 50, provinces: [0, 1] })],
        characters: [],
        world: world([
          province(0, { owner: 0, tax: 3, garrisonArmies: missing ? undefined : [] }),
          province(1, { owner: 0, tax: 3, garrisonArmies: [unit('Human Garrison')] }),
        ]),
      }),
    lists: [['world', 'provinces', '*', 'garrisonArmies']],
    // the Charter's +2 on the province with a garrison, none on the other
    writes: /^Realm 0 collects 8g in taxes\.$/,
  },
];

describe('a list Early Winter guards, missing, reads as an empty one', () => {
  test.each(MISSING.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const without = winter(c.stage(true), c.die);
    const empty = winter(c.stage(false), c.die);
    expect(empty.lines.some((l) => l !== null && c.writes.test(l))).toBe(true);
    expect(without.lines).toEqual(empty.lines);
    expect(withTheListsFilled(without.G, c.lists)).toEqual(withTheListsFilled(empty.G, c.lists));
  });

  test("a garrison: the Raiders' Muster draws a Goblin Horde to a province with no garrison list", () => {
    const pv = province(0, { owner: 0, race: 'Orcish', _raidersMuster: TURN, garrisonArmies: undefined });
    const { lines } = winter(state({ players: [realm(0, { race: 'Orcish' })], world: world([pv]) }));
    const garrison = pv['garrisonArmies'] as Obj[];
    expect(garrison.map((a) => [a['type'], a['quality'], a['race']])).toEqual([['Goblin Horde', 'Average', 'Orcish']]);
    expect(typeof garrison[0]?.['unitName']).toBe('string');
    expect('_raidersMuster' in pv).toBe(false);
    expect(lines.filter((l) => l?.startsWith("🥁 Raiders' Muster")).length).toBe(1);
  });
});

describe('gaps, an owner that is no realm, and the marks of other turns', () => {
  test('a gap among the heroes and the provinces is passed over (with no realm, which would read each)', () => {
    const charmed = hero(1, {
      player: 1,
      _charmTempControl: true,
      _charmOriginalPlayer: 1,
      _charmControlFrom: 2,
      _charmedByPlayer: 0,
      _charmedForPhase: 2,
    });
    const old = province(0, { _raidersMuster: TURN - 1 });
    const { lines } = winter(state({ characters: [null, charmed], world: world([null, old]) }));
    expect(
      ['_charmTempControl', '_charmControlFrom', '_charmedByPlayer', '_charmedForPhase', '_charmOriginalPlayer'].filter(
        (k) => k in charmed,
      ),
    ).toEqual([]);
    expect(charmed['player']).toBe(1);
    expect(lines.filter((l) => l?.includes('the enchantment on Hero 1 fades')).length).toBe(1);
    // a Raiders' Muster mark of an older turn is wiped, and draws nobody
    expect('_raidersMuster' in old).toBe(false);
    expect(old['garrisonArmies']).toEqual([]);
  });

  test('a province whose owner is no realm: no Muster and no drill', () => {
    const orc = province(0, { owner: 3, race: 'Orcish', _raidersMuster: TURN });
    const drilled = province(1, { owner: 3, garrisonArmies: [unit('Human Garrison')] });
    const { lines } = winter(state({ players: [realm(0)], world: world([orc, drilled]) }), 0);
    expect('_raidersMuster' in orc).toBe(false);
    expect(orc['garrisonArmies']).toEqual([]);
    expect((drilled['garrisonArmies'] as Obj[]).map((a) => a['quality'])).toEqual(['Green']);
    expect(lines.filter((l) => l !== null && (l.startsWith('🥁') || l.startsWith('🎖')))).toEqual([]);
  });

  test("a hero with a Charm's mark but no hold on him keeps it, and his lord", () => {
    const h = hero(1, { _charmOriginalPlayer: 1, _charmedByPlayer: 0, _charmedForPhase: 2 });
    const { lines } = winter(state({ players: [realm(0, { gold: 5 })], characters: [h], world: world([]) }));
    expect([h['player'], h['_charmOriginalPlayer'], h['_charmedByPlayer'], h['_charmedForPhase']]).toEqual([
      0, 1, 0, 2,
    ]);
    expect(lines.filter((l) => l?.includes('the enchantment'))).toEqual([]);
  });
});

describe('the taxes', () => {
  /** Realm 0, holding province 0 of tax `tax` (blessed this turn if `blessed`), its king holding `kingsItems`. */
  const taxes = (tax: number, kingsItems: Obj[] = [], blessed: Obj = {}) =>
    winter(
      state({
        players: [realm(0, { provinces: [0] })],
        characters: [hero(1, { items: kingsItems })],
        world: world([province(0, { owner: 0, tax, ...blessed })]),
      }),
    );
  test("an item with no effect pays nothing, and is no Merchant's Ledger", () => {
    const ring = theFirstItemWhoseStatIs('taxBonus');
    const plain = taxes(40, [ring]);
    const withIt = taxes(40, [{ name: 'A Plain Test Stone' }, ring]);
    expect(withIt.lines).toEqual(plain.lines);
    expect((withIt.G['players'] as Obj[])[0]?.['gold']).toBe((plain.G['players'] as Obj[])[0]?.['gold']);
    // the ring pays its bonus, capped at 5% of the realm's base tax (2g of 40g)
    expect(plain.lines).toContain('Realm 0 collects 42g in taxes.');
  });
  test("a tax item with no bonus pays nothing: the items' sum is not a number, which their cap reads as none", () => {
    const purse = taxes(40, [{ name: 'A Test Purse', effect: { stat: 'taxBonus' } }]);
    expect((purse.G['players'] as Obj[])[0]?.['gold']).toBe(40);
    expect(purse.lines).toEqual(taxes(40).lines);
  });
  test('a province blessed this turn with no multiplier yields 60% more', () => {
    const blessed = taxes(10, [], { _blessedTurn: TURN });
    expect(blessed.lines).toContain('Realm 0 collects 16g in taxes.');
    expect(blessed.lines).toEqual(taxes(16).lines);
  });
});

describe('a realm that cannot pay', () => {
  test("a company of a quality the tiers don't hold goes as an Average one: after the Green, before the Veteran", () => {
    const king = hero(1, {
      armies: [unit('Men-at-Arms', 'Veteran'), unit('Men-at-Arms', 'Untested'), unit('Men-at-Arms', 'Green')],
    });
    // 9g of wages, 3g in the treasury: two companies of 3g go
    const { G } = winter(
      state({ players: [realm(0, { gold: 3 })], characters: [king], world: world([province(0)]) }),
      0.5,
    );
    expect(((G['characters'] as Obj[])[0]?.['armies'] as Obj[]).map((a) => a['quality'])).toEqual(['Veteran']);
  });

  test('a company of a type no table prices is owed 2g, and pays off 2g of the debt when it goes', () => {
    const king = hero(1, {
      armies: [
        unit('Men-at-Arms', 'Veteran'),
        unit('Human Garrison', 'Average'),
        unit('Unpriced Test Infantry', 'Green'),
      ],
    });
    // 3g + 1g + 2g of wages, 3g in the treasury: the Green company of no price goes first (2g), then the Average
    // garrison company (1g), and the debt is met
    const { G, lines } = winter(
      state({ players: [realm(0, { gold: 3 })], characters: [king], world: world([province(0)]) }),
      0.5,
    );
    expect(lines).toContain('Realm 0 owes 6g wages (armies: 6g, heroes: 0g).');
    expect(((G['characters'] as Obj[])[0]?.['armies'] as Obj[]).map((a) => a['type'])).toEqual(['Men-at-Arms']);
  });

  test('a skeletal ship kept for its troops, looked at again, pays off 1g of the debt', () => {
    const ship = unit('Galleon Fleet', 'Green', { _isSkeletal: true });
    const troops = unit('Men-at-Arms', 'Veteran', { _isSkeletal: true });
    const last = unit('Human Garrison', 'Elite', { _isSkeletal: true });
    // 3g of wages (1g each), none in the treasury: the ship is reached first and kept (its troops are aboard, at sea);
    // the troops go (1g), then the ship (1g); the Elite garrison company pays the last 1g
    const pv = province(1, { owner: 0, garrisonArmies: [last] });
    const king = hero(1, { armies: [ship, troops] });
    const { G, lines } = winter(
      state({
        players: [realm(0, { provinces: [1] })],
        characters: [king],
        world: world([province(0, { terrain: 'sea' }), pv]),
      }),
      0.5,
    );
    expect((G['characters'] as Obj[])[0]?.['armies']).toEqual([]);
    expect(pv['garrisonArmies']).toEqual([]);
    expect(lines.filter((l) => l?.includes(' disbands — Realm 0 could not pay')).length).toBe(3);
  });
});
