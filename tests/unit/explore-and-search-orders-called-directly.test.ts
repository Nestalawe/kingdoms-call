// The explore and search orders' own functions (plan P1-08j2: src/engine/orders/, the second family taken out of
// processOrder), called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the
// cases scenario/explore-and-search-orders-in-a-whole-turn.test.ts plays through a whole turn
// (lib/explore-and-search-order-cases.ts), here one phase at a time; then what the dice decide (fixed here) and what the
// balance matrix never reaches: the Explorer 8 survey of richer land, Ancient Lore, the Philosopher's Lens, Battlefield
// Surgery at a lair, a thief's haul from a hoard, a beast pacified, a challenger's kit recovered, a hero beaten back, the
// Wild Hunt unpaid or on foreign ground, the Blood Offering's graves, and the rumours of a lair with no weakness or with
// its magic stolen. Level 1: one function, called with what processOrder hands it. A search's fight is the guardian's
// own (resolveEncounter); where only the outcome of the fight matters, the test stands one in (`fightEndsIn`).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The explore and search orders' own functions (`resolveExploreOrder`, `resolvePerformRiteOrder`,
// `resolveHuntingRumoursOrder`, `resolveSearchLairOrder`, `resolveChartTheUnknownOrder`,
// `resolveDiscoverLostRuinOrder`, P1-08j2), called directly on the same cases one phase at a time, then on what the
// dice decide (fixed) and what the balance matrix never reaches: the Explorer 8 survey of richer land (an even chance,
// once a province, the tax base never above 10), Ancient Lore, the Philosopher's Lens (a site known or glamoured passed
// over, its die's pick), an unlisted terrain and a nameless guardian; the Blood Offering's graves, borrowed and skeletal
// companies, the Wild Hunt unpaid or on ground not the hero's own (the empty province taken); rumours paid by grade until
// the purse runs dry, a guardian of no grade or of one no price lists, an order naming no lair, a guardian with no
// weakness, a hoard a thief has stripped; and what follows a fight at a lair, the fight stood in for (`fightEndsIn`): a
// thief's haul and relic, an emptied or bare hoard (a realm that knew it bare kept), a beast pacified, a guardian of no
// grade counted at his lair's, the challengers' kit, a hero beaten back or fled, Battlefield Surgery, and the fight's
// statistics record; a search naming no lair past a gap in the list; Discover Lost Ruin's empty order, a guardian of no
// grade, two sites in one province; and an older save's lair stocked when first read (a clearer's gold from its
// guardian's band, its items before hoards, one item rolled). 96 planted faults in the six functions, their calls and
// `processOrder`'s checks each turn at least one of the two tests red, and every test goes red for at least one of them
// (plan P1-08j2); P1-10b21's cases are each red on a fault planted in the line they guard.
import vm from 'node:vm';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import {
  EXPLORE_AND_SEARCH_ORDER_CASES,
  companies,
  lair,
  magicItem,
  ritualSite,
  type Feature,
} from '../lib/explore-and-search-order-cases.ts';
import {
  board,
  hero,
  must,
  type Board,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
  type Province,
  withDice,
} from '../lib/middle-of-a-bot-world.ts';
import { compactDeclaration } from '../lib/source.ts';

const DISPATCH = 'engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
/** The turn's statistics as the writer reads them, built by the views from the facts the turn filed (P1-12d33). */
const theStatisticsOfTheTurn = engineFn(engine, 'theStatisticsOfTheTurn') as (telemetry: unknown) => {
  encounters: Record<string, unknown>[];
};
const provOf = fn('provOf');

/** One order, as processOrder hands it over in phase `ph`: each function takes the context, then the values it reads
 *  of processOrder's (the hero, the phase, the target, the extra, his province, his realm), in that order. */
const play = (b: Board, c: Character, o: Order, ph = 0) => {
  b.tc._currentPhase = ph;
  b.tc._logCtx = { charId: c.id, phase: ph };
  const prov = provOf(b.tc, c);
  const player = b.G.players[must(c.player, 'a realm')];
  const { target, extra } = o;
  const call: Record<string, () => unknown> = {
    explore: () => fn('resolveExploreOrder')(b.tc, c, prov),
    rite: () => fn('resolvePerformRiteOrder')(b.tc, c, ph, target, extra, prov, player),
    hunt_rumours: () => fn('resolveHuntingRumoursOrder')(b.tc, c, target, prov, player),
    search: () => fn('resolveSearchLairOrder')(b.tc, c, ph, target, prov, player),
    chart_unknown: () => fn('resolveChartTheUnknownOrder')(b.tc, c, target, prov),
    discover_ruin: () => fn('resolveDiscoverLostRuinOrder')(b.tc, c, target, prov),
  };
  must(call[o.action], 'the order ' + o.action)();
  b.tc._logCtx = { charId: null, phase: null };
};
const linesOf = (b: Board, c: Character) => b.lines().filter((l: Line) => l.charId === c.id);
const textOf = (b: Board, c: Character) =>
  linesOf(b, c)
    .map((l) => l.text)
    .join('\n');
const at = (b: Board, s: Partial<HeroSpec> = {}) => hero(b, { player: 0, at: b.X, ...s });
const skilled = (skills: Record<string, number>) => ({ melee: 2, tactical: 2, march: 1, spy: 0, ...skills });
const realm0 = (b: Board) => must(b.G.players[0], 'realm 0');
const guardianOf = (f: Feature) => must(f.monster, 'a guardian');
const features = (p: Province) => (p['features'] ?? []) as Feature[];
const withFeatures = (p: Province, ...fs: Feature[]) => {
  p['features'] = fs;
  p['exploredBy'] = {};
  p['explored'] = 0;
};
const mapped = (p: Province) => ((p['exploredBy'] ?? {}) as Record<number, number | undefined>)[0] ?? 0;
const o = (action: string, target = '', extra = ''): Order => ({ action, target, extra, desc: '' });

describe.each(EXPLORE_AND_SEARCH_ORDER_CASES)('the %s order, called directly: the whole-turn cases', (_, cases) => {
  test.each(cases.filter((c) => !c.wholeTurnOnly).map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const b = board(engine, world, 0);
    const s = c.stage(b);
    s.orders.forEach((x, ph) => {
      if (x.action !== 'rest') play(b, s.hero, x, ph);
    });
    const { got, want } = c.check({ world: b.G, lines: linesOf(b, s.hero), turn: b.G.turn }, s);
    expect(got).toEqual(want);
  });
});

describe('Explore, called directly', () => {
  test('an Explorer 8 survey finds richer land on an even chance, once a province, the tax base never above 10', () => {
    const survey = (die: number, tax: number, surveyed = false) => {
      const b = board(engine, world, 0);
      withFeatures(b.X);
      b.X['tax'] = tax;
      if (surveyed) b.X['_richSurveyed'] = true;
      const h = at(b, { skills: skilled({ explorer: 8 }) });
      withDice(engine, [die], () => {
        play(b, h, o('explore'));
      });
      return { tax: b.X['tax'], surveyed: b.X['_richSurveyed'] === true, told: textOf(b, h).includes('richer land') };
    };
    expect(survey(0.4, 5)).toEqual({ tax: 7, surveyed: true, told: true });
    expect(survey(0.6, 5)).toEqual({ tax: 5, surveyed: false, told: false });
    expect(survey(0.4, 9)).toEqual({ tax: 10, surveyed: true, told: true });
    expect(survey(0.4, 10)).toEqual({ tax: 10, surveyed: true, told: false });
    expect(survey(0.4, 5, true)).toEqual({ tax: 5, surveyed: true, told: false });
  });

  test('Ancient Lore maps a quarter of each neighbouring province too', () => {
    const b = board(engine, world, 0);
    withFeatures(b.X);
    b.ring1.forEach((p) => {
      withFeatures(p);
    });
    must(b.ring1[0], 'a neighbour')['exploredBy'] = { 0: 90 };
    realm0(b)['discoveries'] = [{ id: 'sd32' }];
    play(b, at(b), o('explore'));
    expect(b.ring1.map(mapped)).toEqual(b.ring1.map((_, i) => (i === 0 ? 100 : 25)));
  });

  test("the Philosopher's Lens shows one more lair the map hasn't reached, and is told", () => {
    const b = board(engine, world, 0);
    withFeatures(b.X, lair('Drowned Mill', 'Weak'), lair('Old Sluice', 'Weak'));
    const h = at(b);
    h.items = [{ ...magicItem(b, "Philosopher's Lens"), equipped: true }];
    play(b, h, o('explore'));
    // 35% of two lairs reaches neither by the map alone
    expect(features(b.X).filter((f) => (f.discoveredBy ?? []).includes(0)).length).toBe(1);
    expect(textOf(b, h)).toContain("The Philosopher's Lens shows");
  });

  test("the Philosopher's Lens passes over a site his realm knows and one a rival's glamour hides; its die picks among the rest", () => {
    for (const [die, shown] of [
      [0.1, 'Old Sluice'],
      [0.9, 'Reed Barrow'],
    ] as const) {
      const b = board(engine, world, 0);
      withFeatures(
        b.X,
        { ...lair('Drowned Mill', 'Weak'), discoveredBy: [0] },
        { ...lair('Hidden Fen', 'Weak'), _hidden: true, _hiddenBy: 1 },
        lair('Old Sluice', 'Weak'),
        lair('Reed Barrow', 'Weak'),
      );
      b.X.terrain = 'jungle'; // 15% of four sites reaches none by the map alone
      const h = at(b);
      h.items = [{ ...magicItem(b, "Philosopher's Lens"), equipped: true }];
      h['_sgLog'] = { turn: b.G.turn, turnSkills: { explorer: 1 } }; // risen this turn: no Explorer rise is rolled
      withDice(engine, [die], () => {
        play(b, h, o('explore'));
      });
      expect(features(b.X).map((f) => (f.discoveredBy ?? []).includes(0))).toEqual([true, false, die < 0.5, die > 0.5]);
      expect(textOf(b, h)).toContain(`shows ${h.name} what the ground itself hides — the ${shown}.`);
    }
  });

  test('a terrain the table does not list is explored at 15%; a lair whose guardian has no name is guarded by "a creature"', () => {
    const b = board(engine, world, 0);
    const nameless = lair('Drowned Mill', 'Weak');
    nameless.monster = { ...must(nameless.monster, 'a guardian'), name: '' };
    // two lairs: 90% of the map reaches the first
    withFeatures(b.X, nameless, lair('Old Sluice', 'Weak'));
    b.X.terrain = 'marsh';
    delete b.X['exploredBy'];
    const h = at(b, { skills: skilled({ explorer: 6 }) });
    play(b, h, o('explore'));
    expect(mapped(b.X)).toBe(90);
    expect(textOf(b, h)).toContain('Legend says it is guarded by a creature.');
  });
});

describe('Perform Rite, called directly', () => {
  const pagan = (b: Board) => {
    realm0(b)['alignment'] = 'Pagan';
    b.own(b.X, 0);
    withFeatures(b.X, ritualSite());
  };

  test('the Blood Offering leaves a grave for each company given', () => {
    const b = board(engine, world, 0);
    pagan(b);
    const h = at(b);
    h.armies = companies(3);
    play(b, h, o('rite', '', 'S:2|E:0'));
    expect(((b.X['battleGraves'] ?? []) as { unitName: string }[]).map((g) => g.unitName)).toEqual(['Men-at-Arms c2']);
  });

  test('borrowed and skeletal companies can be neither given nor raised; a nameless company is told by its kind', () => {
    const b = board(engine, world, 0);
    pagan(b);
    const h = at(b);
    const [a, c] = companies(2);
    h.armies = [
      { ...must(a, 'a company'), _temporary: true, unitName: 'Borrowed' },
      { ...must(c, 'a company'), _isSkeletal: true, unitName: 'Bones' },
      ...companies(2).map((u) => ({ ...u, unitName: '' })),
    ];
    play(b, h, o('rite', '', 'S:0,1|E:1,0'));
    expect(h.armies.map((u) => [u.unitName, u.quality])).toEqual([
      ['Borrowed', 'Average'],
      ['Bones', 'Average'],
      ['', 'Crack'],
    ]);
    expect(textOf(b, h)).toContain('— Men-at-Arms (1 unit) are given to the old gods');
  });

  test("the Wild Hunt unpaid: a realm without a beast's price is refused, and nothing is bound", () => {
    const b = board(engine, world, 0);
    pagan(b);
    b.X['armyTypes'] = ['Mammoth Host'];
    realm0(b)['gold'] = 4;
    const h = at(b);
    play(b, h, o('rite', 'wild'));
    expect({ armies: h.armies.length, gold: realm0(b)['gold'], rite: b.X['_riteTurn'] }).toEqual({
      armies: 0,
      gold: 4,
      rite: undefined,
    });
    expect(textOf(b, h)).toContain('cannot afford the Wild Hunt offerings (5g).');
  });

  test("the Wild Hunt at stones found in a province not his own: the beasts are bound, of the wilds' own race, and the empty province is taken", () => {
    const b = board(engine, world, 0);
    realm0(b)['alignment'] = 'Pagan';
    withFeatures(b.X, { ...ritualSite(), discoveredBy: [0] });
    b.X['armyTypes'] = ['Mammoth Host'];
    delete b.X['race'];
    realm0(b)['gold'] = 9;
    const h = at(b);
    play(b, h, o('rite', 'wild'));
    expect({
      bound: h.armies.map((u) => [u.type, u.race, u.quality]),
      gold: realm0(b)['gold'],
      owner: b.X.owner,
    }).toEqual({
      bound: [
        ['Mammoth Host', 'Primal', 'Veteran'],
        ['Mammoth Host', 'Primal', 'Veteran'],
      ],
      gold: 4,
      owner: 0,
    });
  });
});

describe('Hunting Rumours, called directly', () => {
  test('each lair costs by its grade, paid in the order named; when the purse runs dry the rest are left', () => {
    const b = board(engine, world, 0);
    const known = (f: Feature) => ({ ...f, discoveredBy: [0] });
    withFeatures(b.X, known(lair('Drowned Mill', 'Moderate')), known(lair('Old Sluice', 'Legendary')));
    realm0(b)['gold'] = 5;
    const h = at(b);
    play(b, h, o('hunt_rumours', '0,1'));
    expect(realm0(b)['gold']).toBe(3);
    expect(textOf(b, h)).toContain('2g buys the talk of the Drowned Mill');
    expect(textOf(b, h)).toContain(
      "cannot afford the 4g the Old Sluice's rumours would cost (3g in the treasury) — the rest of the hunt is abandoned.",
    );
  });

  test("a guardian of no grade is priced by his lair's, else as Weak; a grade the prices don't list costs 1g", () => {
    const b = board(engine, world, 0);
    const graded = (name: string, power: string, tier?: string) => {
      const f = { ...lair(name, 'Weak'), discoveredBy: [0], monster: { ...guardianOf(lair(name, 'Weak')), power } };
      if (tier === undefined) delete f.tier;
      else f.tier = tier;
      return f;
    };
    withFeatures(
      b.X,
      graded('Drowned Mill', '', 'Moderate'),
      graded('Old Sluice', ''),
      graded('Reed Barrow', 'Mythic'),
    );
    realm0(b)['gold'] = 9;
    const h = at(b);
    play(b, h, o('hunt_rumours', '0,1,2'));
    expect(realm0(b)['gold']).toBe(5);
    const t = textOf(b, h);
    expect(t).toContain('2g buys the talk of the Drowned Mill — Marsh Rat (Vermin), a moderate guardian.');
    expect(t).toContain('1g buys the talk of the Old Sluice — Marsh Rat (Vermin), a weak guardian.');
    expect(t).toContain('1g buys the talk of the Reed Barrow — Marsh Rat (Vermin), a mythic guardian.');
  });

  test('an order that names no lair asks after none, and costs nothing', () => {
    const b = board(engine, world, 0);
    withFeatures(b.X, { ...lair('Drowned Mill', 'Weak'), discoveredBy: [0] });
    realm0(b)['gold'] = 9;
    const h = at(b);
    play(b, h, o('hunt_rumours', ''));
    expect({ gold: realm0(b)['gold'], bought: textOf(b, h).includes('buys the talk') }).toEqual({
      gold: 9,
      bought: false,
    });
  });

  test('a guardian with no weakness, a hoard a thief has stripped, and one he has robbed of part of it', () => {
    const b = board(engine, world, 0);
    const bare = { ...lair('Drowned Mill', 'Weak'), discoveredBy: [0], _stolenItems: ['Old Lamp'] };
    delete must(bare.monster, 'a guardian').weak;
    const robbed = {
      ...lair('Old Sluice', 'Weak', { items: [magicItem(b, 'Boots of the Wind')] }),
      discoveredBy: [0],
      _stolenItems: ['Old Lamp'],
    };
    withFeatures(b.X, bare, robbed);
    realm0(b)['gold'] = 9;
    const h = at(b);
    play(b, h, o('hunt_rumours', '0,1'));
    const t = textOf(b, h);
    expect(t).toContain('Its weakness: none that anyone knows of — the Marsh Rat has no exploitable flaw.');
    expect(t).toContain('sits on exactly 6g — its magic (Old Lamp) has already been lifted by a thief.');
    expect(t).toContain('(a thief has already made off with Old Lamp).');
  });
});

/** Stands in for the fight at a lair (resolveEncounter) while `body` runs: the fight ends as `end` says, the hero left
 *  on `hpAfter`; `stole` marks the guardian robbed, as a Steal that worked does. */
function fightEndsIn<T>(
  end: { won?: boolean; fled?: boolean; pacified?: boolean; stole?: boolean; hpAfter?: number; damage?: number },
  body: () => T,
): T {
  const g = engine as unknown as Record<string, unknown>;
  const was = g['resolveEncounter'];
  g['resolveEncounter'] = (_tc: unknown, c: Character, f: Feature): Record<string, unknown> => {
    if (end.stole) must(f.monster, 'a guardian')['_treasureStolen'] = true;
    const hp = end.hpAfter ?? c.hp;
    c.hp = Math.max(0, hp);
    return {
      won: !!end.won,
      fled: !!end.fled || !!end.stole,
      pacified: !!end.pacified,
      damageToHero: end.damage ?? 0,
      heroHpAfter: Math.max(0, hp),
      heroKilled: hp <= 0,
      narrative: [],
    };
  };
  try {
    return body();
  } finally {
    g['resolveEncounter'] = was;
  }
}

describe('Search Lair, called directly: what follows the fight', () => {
  const searchOne = (f: Feature, s: Partial<HeroSpec> = {}, before?: (b: Board, h: Character) => void) => {
    const b = board(engine, world, 0);
    withFeatures(b.X, f);
    realm0(b)['gold'] = 0;
    const h = at(b, s);
    before?.(b, h);
    return { b, h, f: must(features(b.X)[0], 'the lair') };
  };

  test("a thief's haul: a tenth of the hoard as it first stood for each Thief level, never more than is left", () => {
    const { b, h, f } = searchOne(lair('Drowned Mill', 'Weak', { gold: 30 }), { skills: skilled({ thief: 2 }) });
    f['_hoardGoldOrig'] = 40;
    fightEndsIn({ stole: true }, () => {
      play(b, h, o('search', '0'));
    });
    expect({ gold: realm0(b)['gold'], left: f.treasure, merits: h['merits'] }).toEqual({
      gold: 8,
      left: 22,
      merits: 8,
    });
    expect(textOf(b, h)).toContain('escapes with 8g lifted from the Drowned Mill');
    expect(textOf(b, h)).toContain('(~22g still hidden here.)');
    expect(f['monster']).not.toHaveProperty('_treasureStolen');
  });

  test('a thief who empties the hoard, and one who finds it already empty: both leave the realm knowing it is bare', () => {
    for (const [gold, says] of [
      [3, 'They have cleaned out the last of it'],
      [0, 'the hoard is already picked clean'],
    ] as const) {
      const { b, h, f } = searchOne(lair('Drowned Mill', 'Weak', { gold }), { skills: skilled({ thief: 5 }) });
      f['_hoardGoldOrig'] = 10;
      fightEndsIn({ stole: true }, () => {
        play(b, h, o('search', '0'));
      });
      expect({ left: f.treasure, known: f['_pickedCleanBy'], said: textOf(b, h).includes(says) }).toEqual({
        left: 0,
        known: [0],
        said: true,
      });
    }
  });

  test("a lair whose guardian has no grade is counted cleared at its lair's grade", () => {
    const noGrade = {
      ...lair('Drowned Mill', 'Moderate'),
      monster: { ...guardianOf(lair('Drowned Mill', 'Weak')), power: '' },
    };
    const { b, h } = searchOne(noGrade);
    fightEndsIn({ won: true }, () => {
      play(b, h, o('search', '0'));
    });
    expect(h['_botLairKills']).toEqual({ Moderate: 1 });
  });

  test('a realm that knew a hoard was bare keeps knowing it; another realm learns it beside it', () => {
    for (const gold of [3, 0]) {
      const { b, h, f } = searchOne(lair('Drowned Mill', 'Weak', { gold }), { skills: skilled({ thief: 5 }) });
      f['_hoardGoldOrig'] = 10;
      f['_pickedCleanBy'] = [1];
      fightEndsIn({ stole: true }, () => {
        play(b, h, o('search', '0'));
      });
      expect(f['_pickedCleanBy']).toEqual([1, 0]);
    }
  });

  test('a search that names no lair, its first site a gap in the list: the first lair standing, else the first lair, else nothing', () => {
    // (a save the schema reads holds no gap; the fallbacks are what the search keeps for one)
    const searchWithAGap = (...sites: Feature[]) => {
      const b = board(engine, world, 0);
      withFeatures(b.X);
      b.X['features'] = [null, ...sites];
      realm0(b)['gold'] = 0;
      const h = at(b);
      fightEndsIn({ won: true }, () => {
        play(b, h, o('search', ''));
      });
      return { b, h, t: textOf(b, h) };
    };
    const cleared = () => ({ ...lair('Drowned Mill', 'Weak'), cleared: true });
    const first = searchWithAGap(cleared(), ritualSite(), lair('Old Sluice', 'Weak', { gold: 7 }));
    expect({ gold: realm0(first.b)['gold'], revisits: first.t.includes('revisits') }).toEqual({
      gold: 7,
      revisits: false,
    });
    expect(searchWithAGap(ritualSite(), cleared()).t).toContain('revisits the cleared Drowned Mill');
    expect(searchWithAGap(ritualSite()).t).toBe('');
  });

  test("a thief lifts one of the hoard's relics on a low roll, not on a high one, and never a Legendary one", () => {
    const steal = (die: number, legendary = false) => {
      const relic = legendary ? { name: 'Crown of Ages', desc: 'a crown', tier: 4, legendary: true } : null;
      const { b, h, f } = searchOne(lair('Drowned Mill', 'Weak', { gold: 10 }), { skills: skilled({ thief: 1 }) });
      f.hoardItems = [relic ?? magicItem(b, 'Boots of the Wind')];
      withDice(engine, [die], () => {
        fightEndsIn({ stole: true }, () => {
          play(b, h, o('search', '0'));
        });
      });
      return {
        carried: h.items.map((i) => i['name']),
        hoard: (f.hoardItems ?? []).map((i) => i['name']),
        t: textOf(b, h),
      };
    };
    const low = steal(0.1);
    expect([low.carried, low.hoard]).toEqual([['Boots of the Wind'], []]);
    expect(low.t).toContain('also slips the Boots of the Wind');
    const high = steal(0.9);
    expect([high.carried, high.hoard]).toEqual([[], ['Boots of the Wind']]);
    expect(high.t).toContain("eyes the hoard's magic but cannot get near it.");
    const legend = steal(0.1, true);
    expect([legend.carried, legend.hoard]).toEqual([[], ['Crown of Ages']]);
    expect(legend.t).toContain('a Legendary treasure is not something that can be spirited away');
  });

  test('a beast pacified gives up its hoard, but the hero earns no hit points by it', () => {
    const { b, h, f } = searchOne(lair('Drowned Mill', 'Weak', { gold: 7 }), { hp: 20 });
    fightEndsIn({ won: true, pacified: true }, () => {
      play(b, h, o('search', '0'));
    });
    expect({ cleared: f.cleared, gold: realm0(b)['gold'], maxHp: h.maxHp, earned: h['hpEarned'] ?? 0 }).toEqual({
      cleared: true,
      gold: 7,
      maxHp: 20,
      earned: 0,
    });
  });

  test("every fight at a lair is kept in the turn's statistics (written inside a try, so a slip there would be silent)", () => {
    const { b, h } = searchOne(lair('Drowned Mill', 'Weak'));
    fightEndsIn({ won: true }, () => {
      play(b, h, o('search', '0'));
    });
    const tel = theStatisticsOfTheTurn(b.tc['_tel']);
    expect(tel.encounters.map((e) => [e['charId'], e['feature'], e['guardian'], e['won']])).toEqual([
      [h.id, 'Drowned Mill', 'Marsh Rat', true],
    ]);
  });

  test('the kit of challengers the guardian slew is recovered with the hoard; a hoard with no magic says a thief came first', () => {
    const kit = searchOne(lair('Drowned Mill', 'Weak', { gold: 7 }), {}, (b) => {
      must(features(b.X)[0], 'the lair')['lairItems'] = [magicItem(b, 'Boots of the Wind')];
    });
    // a hoard's lairItems join its hoardItems as soon as it is settled (ensureLairHoard): the clearer gets them
    fightEndsIn({ won: true }, () => {
      play(kit.b, kit.h, o('search', '0'));
    });
    expect(kit.h.items.map((i) => i['name'])).toEqual(['Boots of the Wind']);
    const robbed = searchOne({ ...lair('Drowned Mill', 'Weak', { gold: 7 }), _stolenItems: ['Old Lamp'] });
    fightEndsIn({ won: true }, () => {
      play(robbed.b, robbed.h, o('search', '0'));
    });
    expect(textOf(robbed.b, robbed.h)).toContain(
      'though the lair holds no magic — a thief got here first and lifted Old Lamp.',
    );
  });

  test('a hero beaten back but not slain is wounded, never below 1 HP; one who flees comes away with nothing', () => {
    const beaten = searchOne(lair('Drowned Mill', 'Weak'), { hp: 20 });
    fightEndsIn({ hpAfter: 12, damage: 30 }, () => {
      play(beaten.b, beaten.h, o('search', '0'));
    });
    expect(beaten.h.hp).toBe(1);
    expect(textOf(beaten.b, beaten.h)).toContain('is forced to retreat from the Drowned Mill, wounded. HP: 1/20');
    const fled = searchOne(lair('Drowned Mill', 'Weak', { gold: 7 }), { hp: 20 });
    fightEndsIn({ fled: true, hpAfter: 15 }, () => {
      play(fled.b, fled.h, o('search', '0'));
    });
    expect({ hp: fled.h.hp, gold: realm0(fled.b)['gold'], cleared: fled.f.cleared, left: fled.f.treasure }).toEqual({
      hp: 15,
      gold: 0,
      cleared: false,
      left: 7,
    });
  });

  test("Battlefield Surgery saves a hero struck down at a lair, and he keeps every item; the surgeons too late, they're the guardian's", () => {
    const fall = (die: number) => {
      const { b, h, f } = searchOne(lair('Drowned Mill', 'Weak'), {}, (bb, hh) => {
        hh.items = [{ ...magicItem(bb, 'Boots of the Wind'), equipped: true }];
        realm0(bb)['discoveries'] = [{ id: 'sd36' }];
      });
      withDice(engine, [die], () => {
        fightEndsIn({ hpAfter: 0 }, () => {
          play(b, h, o('search', '0'));
        });
      });
      return {
        alive: h.alive,
        carried: h.items.map((i) => i['name']),
        hoard: (f.hoardItems ?? []).map((i) => i['name']),
      };
    };
    expect(fall(0.01)).toEqual({ alive: true, carried: ['Boots of the Wind'], hoard: [] });
    expect(fall(0.99)).toEqual({ alive: false, carried: [], hoard: ['Boots of the Wind'] });
  });
});

// A lair stocked at world generation holds its hoard already (every matrix game's): an older save's lair is stocked the
// first time it is read, its gold from its guardian's band and its one item rolled then (plan P1-10b19).
describe("an older save's lair, stocked when it is first read (encounterClearGold, ensureLairHoard)", () => {
  const encounterClearGold = fn('encounterClearGold');
  const ensureLairHoard = fn('ensureLairHoard');
  const goldOf = (monster: Record<string, unknown> | null, die: number) => {
    const f: Record<string, unknown> = { name: 'Old Barrow', monster, treasure: 0, cleared: false };
    return { gold: withDice(engine, [die], () => encounterClearGold(f)), f };
  };

  test("a clearer's gold is rolled once from the guardian's band (Weak with no guardian, 1 to 5 for a power no band has)", () => {
    expect(goldOf(null, 0).gold).toBe(5);
    expect(goldOf(null, 0.99).gold).toBe(8);
    expect(goldOf({ power: 'Mythic' }, 0.99).gold).toBe(5);
    const { gold, f } = goldOf({ power: 'Moderate' }, 0.5);
    expect(gold).toBe(15);
    expect(withDice(engine, [0.99], () => encounterClearGold(f))).toBe(15);
  });

  test('its hoard takes the items it held before hoards, then rolls one item no other lair holds, with the next id', () => {
    const names = JSON.parse(
      vm.runInContext('JSON.stringify(ALL_MAGIC_ITEMS_P.map((i) => i.name))', engine) as string,
    ) as string[];
    const b = board(engine, world, 0);
    const older = { name: 'Old Lamp', id: 7000 }; // an item a lair held before hoards (made up)
    const f: Record<string, unknown> = {
      name: 'Old Barrow',
      monster: { power: 'Weak' },
      treasure: 0,
      cleared: false,
      lairItems: [older],
    };
    const awarded = names.filter((n) => n !== 'Boots of the Wind');
    const gs = { _awardedItems: awarded, nextItemId: 7 };
    withDice(engine, [0.5], () => ensureLairHoard(f, gs));
    const hoard = f['hoardItems'] as Record<string, unknown>[];
    expect(hoard.map((i) => [i['name'], i['id']])).toEqual([
      ['Old Lamp', 7000],
      ['Boots of the Wind', 7],
    ]);
    expect([f['lairItems'], f['treasure'], f['_hoardGoldOrig'], f['_hoardV2']]).toEqual([[], 7, 7, true]);
    expect(gs._awardedItems).toBe(awarded);
    expect(awarded.slice(-1)).toEqual(['Boots of the Wind']);
    expect(gs.nextItemId).toBe(8);
    const theRow = magicItem(b, 'Boots of the Wind');
    expect(must(hoard[1], 'the item rolled')['effect']).toEqual(theRow['effect']);
    const rowsEffect: unknown = vm.runInContext(
      "ALL_MAGIC_ITEMS_P.find((i) => i.name === 'Boots of the Wind').effect",
      engine,
    );
    expect(must(hoard[1], 'the item rolled')['effect']).not.toBe(rowsEffect);
  });
});

describe('Chart the Unknown, called directly', () => {
  test('a target that names no province, or his own, charts where he stands; ground nobody has mapped is charted too', () => {
    for (const target of ['', 'here', 'x9']) {
      const b = board(engine, world, 0);
      withFeatures(b.X);
      delete b.X['exploredBy'];
      const h = at(b, { skills: skilled({ explorer: 7 }) });
      play(b, h, o('chart_unknown', target === 'here' ? String(b.X.id) : target));
      expect(mapped(b.X)).toBe(100);
    }
  });
});

describe('Discover Lost Ruin, called directly', () => {
  const layBare = (target: string, ...sites: Feature[]) => {
    const b = board(engine, world, 0);
    withFeatures(b.X, ...sites);
    b.ring1.forEach((p) => {
      withFeatures(p);
    });
    const h = at(b, { skills: skilled({ explorer: 9 }) });
    play(b, h, o('discover_ruin', target));
    return { known: features(b.X).map((f) => (f.discoveredBy ?? []).includes(0)), t: textOf(b, h), here: b.X.name };
  };

  test('an empty order reads as Weak, and a guardian of no grade is a Weak lair', () => {
    const noGrade = {
      ...lair('Reed Barrow', 'Weak'),
      monster: { ...guardianOf(lair('Reed Barrow', 'Weak')), power: '' },
    };
    expect(layBare('', lair('Drowned Mill', 'Weak'), lair('Old Sluice', 'Moderate')).known).toEqual([true, false]);
    expect(layBare('Weak', noGrade).known).toEqual([true]);
  });

  test("two sites of the class in one province are named together, under the province's name", () => {
    const { t, here } = layBare('Weak', lair('Drowned Mill', 'Weak'), lair('Old Sluice', 'Weak'));
    expect(t).toContain(`lays bare 2 sites across 1 province — Drowned Mill, Old Sluice in ${here}.`);
  });
});

/** A case's text as written, for a pattern (each character a pattern reads otherwise, escaped). */
const asWritten = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('every order of the family is a function of its own, and processOrder only calls it', () => {
  // processOrder is top-level since P1-08j9; read in one layout whatever the file's (tests/lib/source.ts, plan P1-09a)
  const src = compactDeclaration(DISPATCH, 'processOrder');
  for (const [theCase, name] of [
    ["'explore'", 'resolveExploreOrder'],
    ["THE_ALIGNMENT_ORDERS['perform-rite'].key", 'resolvePerformRiteOrder'],
    ["'hunt_rumours'", 'resolveHuntingRumoursOrder'],
    ["'search'", 'resolveSearchLairOrder'],
    ["'chart_unknown'", 'resolveChartTheUnknownOrder'],
    ["'discover_ruin'", 'resolveDiscoverLostRuinOrder'],
  ] as const) {
    expect(typeof fn(name)).toBe('function');
    expect(src).toMatch(new RegExp(`case ${asWritten(theCase)}:${name}\\(turnContext,c[^)]*\\);break;`));
  }
});
