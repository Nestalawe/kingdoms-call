// The explore and search orders' own functions (plan P1-08j2: src/engine/orders/, the second family taken out of
// processOrder), called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the
// cases scenario/explore-and-search-orders-in-a-whole-turn.test.ts plays through a whole turn
// (lib/explore-and-search-order-cases.ts), here one phase at a time; then what the dice decide (fixed here) and what the
// balance matrix never reaches: the Explorer 8 survey of richer land, Ancient Lore, the Philosopher's Lens, Battlefield
// Surgery at a lair, a thief's haul from a hoard, a beast pacified, a challenger's kit recovered, a hero beaten back, the
// Wild Hunt unpaid or on foreign ground, the Blood Offering's graves, and the rumours of a lair with no weakness or with
// its magic stolen. Level 1: one function, called with what processOrder hands it. A search's fight is the guardian's
// own (resolveEncounter); where only the outcome of the fight matters, the test stands one in (`fightEndsIn`).
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

const DISPATCH = 'engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.js';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
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
    const tel = b.tc['_tel'] as { encounters: Record<string, unknown>[] };
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

test('every order of the family is a function of its own, and processOrder only calls it', () => {
  // processOrder is top-level since P1-08j9; read in one layout whatever the file's (tests/lib/source.ts, plan P1-09a)
  const src = compactDeclaration(DISPATCH, 'processOrder');
  for (const [key, name] of [
    ['explore', 'resolveExploreOrder'],
    ['rite', 'resolvePerformRiteOrder'],
    ['hunt_rumours', 'resolveHuntingRumoursOrder'],
    ['search', 'resolveSearchLairOrder'],
    ['chart_unknown', 'resolveChartTheUnknownOrder'],
    ['discover_ruin', 'resolveDiscoverLostRuinOrder'],
  ] as const) {
    expect(typeof fn(name)).toBe('function');
    expect(src).toMatch(new RegExp(`case '${key}':${name}\\(turnContext,c[^)]*\\);break;`));
  }
});
