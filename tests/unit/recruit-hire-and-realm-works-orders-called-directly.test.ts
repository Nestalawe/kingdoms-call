// The recruit, hire and realm's works orders' own functions (plan P1-08j3: src/engine/orders/, the third family taken
// out of processOrder), called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts).
// First the cases scenario/recruit-hire-and-realm-works-orders-in-a-whole-turn.test.ts plays through a whole turn
// (lib/recruit-hire-and-realm-works-order-cases.ts), here one phase at a time; then what the dice decide (fixed here),
// what the turn's end would change (a garrison drilled, a band moving on), and what the balance matrix never reaches:
// mercenaries hired by a Recruit order, a recruit's grade from a discovery or a Wonder, the Druid's rise from a beast
// raised, the orders written for a hired hero, the Broker's refusals, Holy Sites, Muster Rolls, the carters' discount
// and the Undead Wonder, and Awaken Grove, Wild Calling and Grand Design, which no bot gives. Level 1: one function,
// called with what processOrder hands it.
import vm from 'node:vm';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import {
  board,
  hero,
  must,
  withDice,
  type Board,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
  type Province,
  type Unit,
} from '../lib/middle-of-a-bot-world.ts';
import {
  RECRUIT_HIRE_AND_WORKS_ORDER_CASES,
  companies,
  plainRealms,
  stageCase,
  type RecruitHireAndWorksOrderCase,
} from '../lib/recruit-hire-and-realm-works-order-cases.ts';
import { compactDeclaration } from '../lib/source.ts';

const DISPATCH = 'engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const provOf = fn('provOf');

/** One order, as processOrder hands it over in phase `ph`: each function takes the context, then the values it reads
 *  of processOrder's (the hero, the order's name, the phase, the target, the extra, his province, his realm), in that
 *  order. */
const play = (b: Board, c: Character, o: Order, ph = 0) => {
  b.tc._currentPhase = ph;
  b.tc._logCtx = { charId: c.id, phase: ph };
  const prov = provOf(b.tc, c);
  const player = b.G.players[must(c.player, 'a realm')];
  const { action, target, extra } = o;
  const removed = () => fn('resolveRemovedAwakenTheWildAndCallFromThePitOrders')(b.tc, c, action);
  const call: Record<string, () => unknown> = {
    recruit: () => fn('resolveRecruitArmiesOrder')(b.tc, c, ph, target, extra, prov, player),
    hire: () => fn('resolveHireHeroOrder')(b.tc, c, ph, target, prov, player),
    consecrate: () => fn('resolveConsecrateOrder')(b.tc, c, prov, player),
    call_to_arms: () => fn('resolveCallToArmsOrder')(b.tc, c, target, player),
    broker: () => fn('resolveBrokerOrder')(b.tc, c, ph, target, player),
    awaken_wild: removed,
    call_pit: removed,
    harvest_field: () => fn('resolveHarvestTheFieldOrder')(b.tc, c, ph, prov, player),
    awaken_grove: () => fn('resolveAwakenGroveOrder')(b.tc, c, ph, prov),
    wild_calling: () => fn('resolveWildCallingOrder')(b.tc, c, ph, prov),
    grand_design: () => fn('resolveGrandDesignOrder')(b.tc, c, prov),
  };
  must(call[action], 'the order ' + action)();
  b.tc._logCtx = { charId: null, phase: null };
};
/** The orders a realm wrote for a hero it means to hire, as the turn holds them once read. */
interface Written {
  heroId: number;
  viaId: string;
  plannedPhase: number;
  player: number;
  orders: Order[];
}
const writtenFor = (b: Board, ...ws: Written[]) => {
  (b.G as unknown as Record<string, unknown>)['_pendingHireOrders'] = ws;
};
const linesOf = (b: Board, c: Character) => b.lines().filter((l: Line) => l.charId === c.id);
const textOf = (b: Board, c: Character) =>
  linesOf(b, c)
    .map((l) => l.text)
    .join('\n');
const fresh = () => {
  const b = board(engine, world, 0);
  plainRealms(b);
  return b;
};
const at = (b: Board, s: Partial<HeroSpec> = {}) => hero(b, { player: 0, at: b.X, ...s });
const skilled = (skills: Record<string, number>) => ({ melee: 2, tactical: 2, march: 1, spy: 0, ...skills });
const realm = (b: Board, i = 0) => must(b.G.players[i], 'realm ' + String(i));
const o = (action: string, target: string | number = '', extra = ''): Order => ({
  action,
  target: String(target),
  extra,
  desc: '',
});
const units = (us: Unit[] | undefined) => (us ?? []).map((u) => `${u.quality} ${u.type}`);
const holds = (b: Board, p: Province, armyTypes = ['Shieldwall Levies', 'Yeoman Longbows', 'Human Garrison']) => {
  p['race'] = 'Human';
  p['armyTypes'] = armyTypes;
  b.own(p, 0);
};
const wanderer = (b: Board, where: Province, alignment = 'Divine', skills: Record<string, number> = skilled({})) => {
  const w = hero(b, { player: null, at: where, skills });
  w.name = `Wanderer ${String(w.id)} (wandering)`;
  w['alignment'] = alignment;
  return w;
};
const band = (b: Board, where: Province, type = 'Free Lances') => {
  const m = { id: 'merc_test', type, quality: 'Veteran', race: 'Human', unitName: 'Test Company', location: where.id };
  must(b.G.mercenaries, 'the mercenaries').push(m);
  return m;
};
const SKILLGAIN = vm.runInContext('({std:SKILLGAIN_STD, common:SKILLGAIN_COMMON})', engine) as {
  std: number;
  common: number;
};
type Roll = { id: unknown; skill: string; base: unknown };
// every experience roll, recorded as it starts by a wrapper around the top-level trySkillGain (plan P1-08c)
vm.runInContext(
  `{ const tryOne=trySkillGain;
     trySkillGain=function(turnContext, char, skill, base){
       if(globalThis.__xp) globalThis.__xp.push({id:char&&char.id,skill,base});
       return tryOne.apply(this, arguments); }; }`,
  engine,
);
const rollsIn = (body: () => void): Roll[] => {
  const rolls: Roll[] = [];
  engine['__xp'] = rolls;
  try {
    body();
  } finally {
    engine['__xp'] = undefined;
  }
  return rolls;
};

describe.each(RECRUIT_HIRE_AND_WORKS_ORDER_CASES)('the %s order, called directly: the whole-turn cases', (_, cases) => {
  test.each(cases.filter((c) => !c.wholeTurnOnly).map((c) => [c.name, c] as const))(
    '%s',
    (_name, c: RecruitHireAndWorksOrderCase) => {
      const b = board(engine, world, 0);
      const s = stageCase(b, c);
      if (s.written && s.other)
        writtenFor(b, {
          heroId: s.other.id,
          viaId: String(s.hero.id),
          plannedPhase: s.orders.findIndex((x) => x.action === 'hire'),
          player: must(s.hero.player, 'a realm'),
          orders: s.written,
        });
      s.orders.forEach((x, ph) => {
        if (x.action !== 'rest') play(b, s.hero, x, ph);
      });
      const { got, want } = c.check({ world: b.G, lines: linesOf(b, s.hero), all: b.lines(), turn: b.G.turn }, s);
      expect(got).toEqual(want);
    },
  );
});

describe('Recruit Armies, called directly', () => {
  test('the companies raised, and the garrison mustered, are Average', () => {
    const b = fresh();
    holds(b, b.X);
    const h = at(b);
    play(b, h, o('recruit', 'Shieldwall Levies|1,Human Garrison|2'));
    expect({ led: units(h.armies), garrison: units(b.X.garrisonArmies) }).toEqual({
      led: ['Average Shieldwall Levies'],
      garrison: ['Average Human Garrison', 'Average Human Garrison'],
    });
  });

  test('Superior Forging gives each company a chance to start Veteran', () => {
    const raise = (die: number) => {
      const b = fresh();
      holds(b, b.X);
      realm(b)['discoveries'] = [{ id: 'sd01' }];
      const h = at(b);
      withDice(engine, [die], () => {
        play(b, h, o('recruit', 'Shieldwall Levies|1'));
      });
      return units(h.armies);
    };
    expect(raise(0.01)).toEqual(['Veteran Shieldwall Levies']);
    expect(raise(0.5)).toEqual(['Average Shieldwall Levies']);
  });

  test('the Druidic Wonder musters every beast Veteran, with no die', () => {
    const b = fresh();
    holds(b, b.X, ['Great Bears', 'Shieldwall Levies']);
    Object.assign(realm(b), { alignment: 'Druidic', discoveries: [{ id: 'gd' }], gdProvinceId: b.X.id });
    const h = at(b, { skills: skilled({ druid: 6 }) });
    withDice(engine, [0.99], () => {
      play(b, h, o('recruit', 'Great Bears|1,Shieldwall Levies|1'));
    });
    expect(units(h.armies)).toEqual(['Veteran Great Bears', 'Average Shieldwall Levies']);
  });

  test("a beast raised may raise the recruiter's Druid: a common chance among men, the usual one in the wild", () => {
    const rolls = (race: string, extra = '') => {
      const b = fresh();
      holds(b, b.X, ['Great Bears']);
      b.X['race'] = race;
      const h = at(b, { skills: skilled({ druid: 6 }) });
      return rollsIn(() => {
        play(b, h, o('recruit', 'Great Bears|1' + extra));
      }).map((r) => [r.id === h.id, r.skill, r.base]);
    };
    expect(rolls('Human')).toEqual([[true, 'druid', SKILLGAIN.common]]);
    expect(rolls('Primal:Bear')).toEqual([[true, 'druid', SKILLGAIN.std]]);
    expect(rolls('Primal:Bear', ',to:garrison')).toEqual([[true, 'druid', SKILLGAIN.common]]);
  });

  test('a Druid of 6 pays half for beasts only, never for men', () => {
    const b = fresh();
    holds(b, b.X, ['Great Bears', 'Shieldwall Levies']);
    const h = at(b, { skills: skilled({ druid: 6 }) });
    play(b, h, o('recruit', 'Great Bears|1,Shieldwall Levies|1'));
    expect(realm(b)['gold']).toBe(20 - 2 - 2);
    const c = fresh();
    holds(c, c.X, ['Yeoman Longbows']);
    const k = at(c, { skills: skilled({ druid: 6 }) });
    play(c, k, o('recruit', 'Yeoman Longbows|1'));
    expect(realm(c)['gold']).toBe(18);
  });

  test('the gold for companies already raised in the order counts against the next', () => {
    const b = fresh();
    holds(b, b.X);
    realm(b)['gold'] = 3;
    const h = at(b);
    play(b, h, o('recruit', 'Shieldwall Levies|1,Yeoman Longbows|1'));
    expect({ led: units(h.armies), gold: realm(b)['gold'] }).toEqual({ led: ['Average Shieldwall Levies'], gold: 1 });
    expect(textOf(b, h)).toContain('(Blocked: Yeoman Longbows (insufficient gold: need 2g more).)');
  });

  test('a band hired joins the column, leaves the roads, takes empty ground, and a band not paid for stays', () => {
    const b = fresh();
    b.X['race'] = 'Human';
    band(b, b.X);
    const h = at(b);
    play(b, h, o('recruit', 'merc:merc_test'));
    expect({ led: units(h.armies), bands: b.G.mercenaries?.length, owner: b.X.owner, gold: realm(b)['gold'] }).toEqual({
      led: ['Veteran Free Lances'],
      bands: 0,
      owner: 0,
      gold: 17,
    });
    const poor = fresh();
    realm(poor)['gold'] = 2;
    band(poor, poor.X);
    const p = at(poor);
    play(poor, p, o('recruit', 'merc:merc_test'));
    expect({ bands: poor.G.mercenaries?.map((m) => m.id), gold: realm(poor)['gold'] }).toEqual({
      bands: ['merc_test'],
      gold: 2,
    });
  });

  test('a band is named as the order form names it, or by its old id, kind or name; the Neutral discount stops at 1g', () => {
    for (const token of ['merc:merc_test', 'merc_test', 'Black Arrows', 'Test Company']) {
      const b = fresh();
      realm(b)['alignment'] = 'Neutral';
      band(b, b.X, 'Black Arrows');
      const h = at(b);
      play(b, h, o('recruit', token));
      expect({ token, led: units(h.armies), gold: realm(b)['gold'] }).toEqual({
        token,
        led: ['Veteran Black Arrows'],
        gold: 19,
      });
    }
  });

  test('Black Market takes 3g off a band of beasts (never below 1g), and nothing off men', () => {
    const hire = (type: string) => {
      const b = fresh();
      Object.assign(realm(b), { alignment: 'Evil', discoveries: [{ id: 'ae20' }] });
      // on ground of its own: a band hired on empty ground takes it, and an Evil realm loots it
      b.own(b.X, 0);
      band(b, b.X, type);
      const h = at(b, { skills: skilled({ druid: 6 }) });
      play(b, h, o('recruit', 'merc:merc_test'));
      return { led: units(h.armies), gold: realm(b)['gold'] };
    };
    expect([hire('Great Bears'), hire('Free Lances')]).toEqual([
      { led: ['Veteran Great Bears'], gold: 19 },
      { led: ['Veteran Free Lances'], gold: 17 },
    ]);
  });

  test('a band of mercenaries mustered into a garrison settles the ground for the recruiter, not a comrade', () => {
    const b = fresh();
    holds(b, b.X);
    band(b, b.X);
    const h = at(b);
    play(b, h, o('recruit', 'merc:merc_test,to:garrison'));
    expect({ led: units(h.armies), garrison: units(b.X.garrisonArmies) }).toEqual({
      led: [],
      garrison: ['Veteran Free Lances'],
    });
  });

  test('a stale mercenary token in the second list is skipped, and with nothing else there nothing is raised', () => {
    const b = fresh();
    holds(b, b.X);
    const h = at(b);
    play(b, h, o('recruit', '', 'merc:merc_gone'));
    expect({ led: units(h.armies), gold: realm(b)['gold'] }).toEqual({ led: [], gold: 20 });
    expect(textOf(b, h)).toContain('was entirely blocked: .');
  });
});

describe('Hire Hero, called directly', () => {
  test('sworn in a later phase: the phases before are his "not yet hired", the rest Defend; a pool of movement; the creed part of his wage kept', () => {
    const b = fresh();
    const w = wanderer(b, b.X, 'Evil');
    const h = at(b);
    const pools = b.tc as unknown as Record<string, Record<number, number>>;
    // the board gives every hero it stands a pool; a wanderer has none until he is sworn
    delete pools['movePoints']?.[w.id];
    play(b, h, o('hire', w.id), 2);
    expect({
      player: w.player,
      phase: w['hiredInPhase'],
      orders: (b.G.turnOrders[w.id] ?? []).map((x) => (x as { desc?: string; action: string }).desc ?? x?.action),
      pool: pools['movePoints']?.[w.id] != null,
      creedWage: w['_hireAlignWage'],
      gold: realm(b)['gold'],
    }).toEqual({
      player: 0,
      phase: 2,
      orders: ['(not yet hired)', '(not yet hired)', '(not yet hired)', 'Defend', 'Defend'],
      pool: true,
      creedWage: 4,
      gold: 15,
    });
    expect(textOf(b, h)).toContain('They may act from Fall onwards.');
  });

  test('a realm of no creed hires at the Neutral rate; one step apart is the base rate; a hero of no skills has none yet', () => {
    const b = fresh();
    delete realm(b)['alignment'];
    const w = wanderer(b, b.X);
    const h = at(b);
    play(b, h, o('hire', w.id));
    expect(textOf(b, h)).toContain('for 4g/turn (3 steps across the alignment spectrum)');
    const c = fresh();
    const v = wanderer(c, c.X, 'Good', {});
    const k = at(c);
    play(c, k, o('hire', v.id));
    expect(textOf(c, k)).toContain('for 2g/turn (close in outlook — base rate). Skills: none yet.');
  });

  test("the orders written for him land: the hirer's own card first, never a rival realm's, and only after the hire", () => {
    const b = fresh();
    const w = wanderer(b, b.X);
    const h = at(b);
    const card = (viaId: string, player: number, action: string): Written => ({
      heroId: w.id,
      viaId,
      plannedPhase: 0,
      player,
      orders: [o(action), o(action), o(action), o('Defend'), o(action)],
    });
    writtenFor(b, card('77', 0, 'rest'), card(String(h.id), 1, 'spy'), card(String(h.id), 0, 'explore'));
    play(b, h, o('hire', w.id), 1);
    expect((b.G.turnOrders[w.id] ?? []).map((x) => x?.action)).toEqual([
      'defend',
      'defend',
      'explore',
      'defend',
      'explore',
    ]);
    expect(textOf(b, w)).toContain('2 phases of this turn remain to be acted on.');
  });

  test('with no card of its own the realm’s other card lands; with none, nothing is said', () => {
    const b = fresh();
    const w = wanderer(b, b.X);
    const h = at(b);
    writtenFor(b, { heroId: w.id, viaId: '77', plannedPhase: 0, player: 0, orders: [o('rest'), o('explore')] });
    play(b, h, o('hire', w.id));
    expect((b.G.turnOrders[w.id] ?? []).map((x) => x?.action)).toEqual([
      'defend',
      'explore',
      'defend',
      'defend',
      'defend',
    ]);
    const c = fresh();
    const v = wanderer(c, c.X);
    const k = at(c);
    play(c, k, o('hire', v.id));
    expect(textOf(c, v)).not.toContain('takes up the orders');
  });

  test('the hire names the hero by his id, not his place in the list', () => {
    const b = fresh();
    const w = wanderer(b, b.X);
    const h = at(b);
    play(b, h, o('hire', String(b.G.characters.indexOf(w))));
    expect(w.player).toBe(null);
    play(b, h, o('hire', 'nobody'));
    expect(textOf(b, h)).toContain('none matching that description');
  });
});

describe('Broker, called directly', () => {
  const broker = (stage: (b: Board, w: Character) => void = () => undefined) => {
    const b = fresh();
    realm(b)['alignment'] = 'Neutral';
    b.own(b.X, 0);
    const k = at(b, { king: true });
    const w = wanderer(b, b.X);
    stage(b, w);
    return { b, k, w };
  };
  test('a brokered hero is sworn as a hired one: his phases, a pool of movement, and the orders written for him', () => {
    const { b, k, w } = broker((bb, ww) => {
      writtenFor(bb, {
        heroId: ww.id,
        viaId: '0',
        plannedPhase: 0,
        player: 0,
        orders: [o('rest'), o('rest'), o('explore')],
      });
      // the board gives every hero it stands a pool; a wanderer has none until he is sworn
      delete (bb.tc as unknown as Record<string, Record<number, number>>)['movePoints']?.[ww.id];
    });
    play(b, k, o('broker', `hire:${String(b.G.characters.indexOf(w))}`), 1);
    const pools = b.tc as unknown as Record<string, Record<number, number>>;
    expect({
      player: w.player,
      phase: w['hiredInPhase'],
      orders: (b.G.turnOrders[w.id] ?? []).map((x) => (x as { desc?: string; action: string }).desc ?? x?.action),
      pool: pools['movePoints']?.[w.id] != null,
      gold: realm(b)['gold'],
      heroes: (realm(b)['heroes'] as number[]).includes(w.id),
    }).toEqual({
      player: 0,
      phase: 1,
      orders: ['(not yet hired)', '(not yet hired)', '', 'Defend', 'Defend'],
      pool: true,
      gold: 16,
      heroes: true,
    });
    expect((b.G.turnOrders[w.id] ?? [])[2]?.action).toBe('explore');
  });

  test('a hero brokered in the last season of the turn may act from next turn', () => {
    const { b, k, w } = broker();
    play(b, k, o('broker', `hire:${String(b.G.characters.indexOf(w))}`), 4);
    expect(textOf(b, k)).toContain('They may act from next turn onwards, from where they stand.');
  });

  test('no such hero within reach: none at that place in the list, the dead, one already serving, a guard, one just driven from home', () => {
    const cases: [string, (b: Board, w: Character) => void, (b: Board, w: Character) => string][] = [
      ['nobody', () => undefined, () => 'hire:999'],
      ['dead', (_, w) => (w.alive = false), (b, w) => `hire:${String(b.G.characters.indexOf(w))}`],
      ['serving', (_, w) => (w.player = 1), (b, w) => `hire:${String(b.G.characters.indexOf(w))}`],
      ['guard', (_, w) => (w._isNeutralGuard = true), (b, w) => `hire:${String(b.G.characters.indexOf(w))}`],
      ['defeated', (_, w) => (w['_justDefeated'] = true), (b, w) => `hire:${String(b.G.characters.indexOf(w))}`],
    ];
    for (const [why, stage, target] of cases) {
      const { b, k, w } = broker(stage);
      play(b, k, o('broker', target(b, w)));
      expect({ why, told: textOf(b, k).includes('find no such hero'), gold: realm(b)['gold'] }).toEqual({
        why,
        told: true,
        gold: 20,
      });
    }
  });

  test('word bought from a province: 2g paid, and the province spied for the realm', () => {
    const { b, k } = broker();
    play(b, k, o('broker', `spy:${String(b.X.id)}`));
    expect({ gold: realm(b)['gold'], spied: realm(b)['_spiedProvincesThisTurn'] }).toEqual({
      gold: 18,
      spied: [b.X.id],
    });
  });
});

describe('Consecrate, called directly', () => {
  test('Holy Sites hold one more holy province for a king of White 3 or more', () => {
    const tryFourth = (white: number, discovered: boolean) => {
      const b = fresh();
      holds(b, b.X);
      realm(b)['consecratedProvIds'] = b.ring2.slice(0, white).map((p) => p.id);
      if (discovered) realm(b)['discoveries'] = [{ id: 'ad03' }];
      const k = at(b, { king: true, skills: skilled({ white }) });
      play(b, k, o('consecrate'));
      return (realm(b)['consecratedProvIds'] as number[]).includes(b.X.id);
    };
    expect([tryFourth(3, true), tryFourth(3, false), tryFourth(2, true)]).toEqual([true, false, false]);
  });
});

describe('Call to Arms, called directly', () => {
  const call = (stage: (b: Board, p: Province) => void = () => undefined, dice: number[] = [0.5]) => {
    const b = fresh();
    realm(b)['alignment'] = 'Good';
    const p = must(b.ring1[0], 'a neighbour');
    holds(b, p, ['Human Garrison']);
    stage(b, p);
    const k = at(b, { king: true });
    withDice(engine, dice, () => {
      play(b, k, o('call_to_arms', p.id));
    });
    return { b, p, k };
  };
  test('a Green company, free, and the realm marked as called this turn', () => {
    const { b, p } = call();
    expect({ garrison: p.garrisonArmies, gold: realm(b)['gold'], called: realm(b)['_calledToArmsTurn'] }).toEqual({
      garrison: [{ type: 'Human Garrison', quality: 'Green', race: 'Human', unitName: expect.any(String) as string }],
      gold: 20,
      called: b.G.turn,
    });
  });
  test('Muster Rolls: a chance in five of two the company is Average', () => {
    const muster = (die: number) =>
      units(
        call(
          (b) => {
            realm(b)['discoveries'] = [{ id: 'ag05' }];
          },
          [die],
        ).p.garrisonArmies,
      );
    expect([muster(0.3), muster(0.5)]).toEqual([['Average Human Garrison'], ['Green Human Garrison']]);
  });
  test("the province's own garrison company before its folk's", () => {
    const { p } = call((_, q) => {
      q['armyTypes'] = ['Shieldwall Levies', 'Dwarf Garrison'];
    });
    expect(p.garrisonArmies.map((u) => [u.type, u.race])).toEqual([['Dwarf Garrison', 'Human']]);
  });
  test('folk of no known kind raise a Human Garrison of men', () => {
    const { p } = call((_, q) => {
      delete q['race'];
      q['armyTypes'] = [];
    });
    expect(p.garrisonArmies.map((u) => [u.type, u.race])).toEqual([['Human Garrison', 'Human']]);
  });
});

describe('Harvest the Field, called directly', () => {
  const harvest = (stage: (b: Board) => void = () => undefined) => {
    const b = fresh();
    realm(b)['alignment'] = 'Undead';
    holds(b, b.X);
    b.X['battleGraves'] = [
      { type: 'Shieldwall Levies', quality: 'Green', race: 'Human', unitName: 'the Green Levy' },
      { type: 'Men-at-Arms', quality: 'Veteran', race: 'Human', unitName: 'the Old Guard' },
      { type: 'Men-at-Arms', quality: 'Average', race: 'Human', unitName: 'the Town Watch' },
    ];
    stage(b);
    const h = at(b, { skills: skilled({ necromancy: 1 }) });
    play(b, h, o('harvest_field'));
    return { b, h };
  };
  const left = (b: Board) => ((b.X['battleGraves'] ?? []) as Unit[]).map((g) => g.unitName);
  test('the best of the dead first; the rest stay in their graves; 2g paid', () => {
    const { b, h } = harvest();
    expect({ raised: units(h.armies), left: left(b), gold: realm(b)['gold'] }).toEqual({
      raised: ['Veteran Men-at-Arms'],
      left: ['the Green Levy', 'the Town Watch'],
      gold: 18,
    });
  });
  test('Corpse-Carters do it for nothing; the Undead Wonder raises the dead a grade higher', () => {
    const free = harvest((b) => {
      realm(b)['discoveries'] = [{ id: 'az06' }];
    });
    expect(realm(free.b)['gold']).toBe(20);
    expect(textOf(free.b, free.h)).toContain('(0g; upkeep 1g/turn.)');
    const wonder = harvest((b) => {
      Object.assign(realm(b), { discoveries: [{ id: 'gd' }], gdProvinceId: b.X.id });
    });
    expect(units(wonder.h.armies)).toEqual(['Crack Men-at-Arms']);
  });
  test('a grave with no name rises under its kind’s name, for a raiser who led no column, and takes ground nobody holds', () => {
    const b = fresh();
    realm(b)['alignment'] = 'Undead';
    b.X['battleGraves'] = [{ type: 'Men-at-Arms', quality: 'Average', race: 'Human' }];
    const h = at(b, { skills: skilled({ necromancy: 1 }) });
    delete (h as Partial<Character>).armies;
    play(b, h, o('harvest_field'));
    // a company's name is drawn from its kind's list
    expect({ raised: h.armies.map((u) => /^the .+ \(Skeletal\)$/.test(u.unitName)), owner: b.X.owner }).toEqual({
      raised: [true],
      owner: 0,
    });
  });
});

describe('Awaken Grove, called directly', () => {
  test('Forest Ents, Veteran, until the turn’s end, and a chance at the Druid skill; jungle wakes too', () => {
    for (const terrain of ['forest', 'jungle']) {
      const b = fresh();
      holds(b, b.X);
      b.X.terrain = terrain;
      const h = at(b, { skills: skilled({ druid: 7 }) });
      const rolls = rollsIn(() => {
        play(b, h, o('awaken_grove'));
      });
      expect({ terrain, ents: h.armies, rolls: rolls.map((r) => [r.skill, r.base]) }).toEqual({
        terrain,
        ents: [
          {
            type: 'Forest Ents',
            quality: 'Veteran',
            race: 'Forest Ent',
            unitName: 'an awakened Grove',
            _temporary: true,
            _expiresAfterPhase: -1,
          },
        ],
        rolls: [['druid', SKILLGAIN.std]],
      });
    }
  });
});

describe('Wild Calling, called directly', () => {
  const beasts = (n: number, extra: Partial<Unit> = {}) =>
    companies(n, 'Great Bears', 'Average', 'Primal').map((u) => ({ ...u, ...extra }));
  // What follows the Calling, the host gained settling the province (resolveUnitGainInProvince: a battle on ground the
  // realm doesn't hold), is stood in for: only the Calling's own code is under test, and the stand-in records the call.
  const calling = (stage: (b: Board) => void, dice: number[], leading = 0) => {
    const b = fresh();
    stage(b);
    const h = at(b, { skills: skilled({ druid: 9 }) });
    h.armies = companies(leading, 'Great Bears');
    const settled: unknown[][] = [];
    const was = vm.runInContext('resolveUnitGainInProvince', engine) as Fn;
    engine['resolveUnitGainInProvince'] = (_tc: unknown, c: Character, p: Province, ph: number) => {
      settled.push([c.id, p.id, ph]);
      return false;
    };
    try {
      const rolls = rollsIn(() => {
        withDice(engine, dice, () => {
          play(b, h, o('wild_calling'));
        });
      });
      return { b, h, rolls, settled };
    } finally {
      engine['resolveUnitGainInProvince'] = was;
    }
  };
  test('each wild beast of a neutral host answers on an even chance, and is pacified', () => {
    const { b, h, rolls, settled } = calling(
      (bb) => {
        bb.X.neutralDefenders = beasts(3);
      },
      [0.1, 0.9, 0.4],
    );
    // the host is sifted from its last company to its first: c2 answers (11), c1 does not (91), c0 does (41)
    expect({
      led: h.armies.map((u) => [u.unitName, u['_pacified']]),
      host: b.X.neutralDefenders.map((u) => u.unitName),
      rolls: rolls.map((r) => [r.skill, r.base]),
      settled,
    }).toEqual({
      led: [
        ['Great Bears c2', true],
        ['Great Bears c0', true],
      ],
      host: ['Great Bears c1'],
      rolls: [['druid', SKILLGAIN.std]],
      settled: [[h.id, b.X.id, 0]],
    });
    expect(textOf(b, h)).toContain('2 of 3 wild creatures answer and fall in behind your banner!');
  });
  test('a druid already leading as many beasts as his Druid allows calls them, and none follows', () => {
    const { b, h } = calling(
      (bb) => {
        bb.X.neutralDefenders = beasts(2);
      },
      [0.1],
      9,
    );
    expect({ led: h.armies.length, host: b.X.neutralDefenders.length }).toEqual({ led: 9, host: 2 });
    expect(textOf(b, h)).toContain('over 2 wild creatures in');
  });
  test('room for one more: the first to answer follows, and the rest are never asked', () => {
    const { b, h } = calling(
      (bb) => {
        bb.X.neutralDefenders = beasts(3);
      },
      [0.9, 0.1, 0.1],
      8,
    );
    expect({
      led: h.armies.slice(8).map((u) => u.unitName),
      host: b.X.neutralDefenders.map((u) => u.unitName),
    }).toEqual({
      led: ['Great Bears c1'],
      host: ['Great Bears c0', 'Great Bears c2'],
    });
  });
  test('an enemy’s garrison and commander here answer, and he is told; never the realm’s own, an ally’s, or a foe next door; men and the dead are deaf', () => {
    let foe: Character | undefined;
    let ally: Character | undefined;
    let own: Character | undefined;
    let away: Character | undefined;
    const { b, h } = calling(
      (bb) => {
        bb.own(bb.X, 1);
        bb.X.garrisonArmies = [
          ...beasts(1),
          ...beasts(1, { unitName: 'the Bone Bears', _isSkeletal: true }),
          ...companies(1),
        ];
        foe = hero(bb, { player: 1, at: bb.X });
        foe.armies = beasts(1, { unitName: 'the War Bears' });
        ally = hero(bb, { player: 2, at: bb.X });
        ally.armies = beasts(1);
        own = hero(bb, { player: 0, at: bb.X });
        own.armies = beasts(1);
        away = hero(bb, { player: 1, at: must(bb.ring1[0], 'a neighbour') });
        away.armies = beasts(1);
      },
      [0.1],
    );
    const f = must(foe, 'the foe');
    expect({
      led: h.armies.map((u) => u.unitName),
      garrison: b.X.garrisonArmies.map((u) => u.unitName),
      kept: [
        must(ally, 'the ally').armies.length,
        must(own, 'his comrade').armies.length,
        must(away, 'a foe next door').armies.length,
        f.armies.length,
      ],
    }).toEqual({
      led: ['Great Bears c0', 'the War Bears'],
      garrison: ['the Bone Bears', 'Men-at-Arms c0'],
      kept: [1, 1, 1, 0],
    });
    expect(textOf(b, h)).toContain(
      `2 of 2 wild creatures answer and fall in behind your banner (torn from the garrison of ${b.X.name} and ${f.name})!`,
    );
    expect(textOf(b, f)).toContain(
      `🐾 The beasts of ${f.name}'s host break their bonds and answer a Wild Calling in ${b.X.name} — 1 unit lost.`,
    );
  });
  test('an unled garrison on ground nobody holds answers too; the realm’s own garrison never does', () => {
    const open = calling(
      (bb) => {
        bb.X.garrisonArmies = beasts(1);
      },
      [0.1],
    );
    expect(open.h.armies.length).toBe(1);
    const mine = calling(
      (bb) => {
        bb.own(bb.X, 0);
        bb.X.garrisonArmies = beasts(1);
      },
      [0.1],
    );
    expect({ led: mine.h.armies.length, garrison: mine.b.X.garrisonArmies.length }).toEqual({ led: 0, garrison: 1 });
  });
  test('when not one breaks for the call, the druid is told, gains nothing, and the call still trains his Druid', () => {
    const { b, h, rolls, settled } = calling(
      (bb) => {
        bb.X.neutralDefenders = beasts(2);
      },
      [0.9],
    );
    expect({ led: h.armies.length, rolls: rolls.map((r) => [r.skill, r.base]), settled: settled.length }).toEqual({
      led: 0,
      rolls: [['druid', SKILLGAIN.std]],
      settled: 0,
    });
    expect(textOf(b, h)).toContain('over 2 wild creatures in');
  });
});

describe('Grand Design, called directly', () => {
  const design = (alignment: string | undefined) => {
    const b = fresh();
    if (alignment == null) delete realm(b)['alignment'];
    else realm(b)['alignment'] = alignment;
    const h = at(b, { skills: skilled({ sage: 9 }) });
    const rolls = rollsIn(() => {
      play(b, h, o('grand_design'));
    });
    return { b, h, rolls };
  };
  test('the Wonder of the realm’s creed, a discovery to the sage’s merit, and a chance at the Sage skill', () => {
    const { b, h, rolls } = design('Undead');
    expect({
      name: realm(b)['gdName'],
      merit: (h['tm'] as Record<string, number> | undefined)?.['discoveries'],
      rolls: rolls.map((r) => [r.skill, r.base]),
    }).toEqual({ name: 'Deathless Legion', merit: 1, rolls: [['sage', SKILLGAIN.std]] });
  });
  test('a realm of no creed raises the Neutral Wonder; a creed with none of its own, the Great Work', () => {
    expect([realm(design(undefined).b)['gdName'], realm(design('Wandering').b)['gdName']]).toEqual([
      'Grand Library',
      'The Great Work',
    ]);
  });
});

test('every order of the family is a function of its own, processOrder only calls it, and landHirePreOrders is top-level', () => {
  // processOrder is top-level since P1-08j9; read in one layout whatever the file's (tests/lib/source.ts, plan P1-09a)
  const src = compactDeclaration(DISPATCH, 'processOrder');
  const turn = compactDeclaration('engine/run-turn.ts', 'resolveTurn');
  for (const [key, name] of [
    ['recruit', 'resolveRecruitArmiesOrder'],
    ['hire', 'resolveHireHeroOrder'],
    ['consecrate', 'resolveConsecrateOrder'],
    ['call_to_arms', 'resolveCallToArmsOrder'],
    ['broker', 'resolveBrokerOrder'],
    ['call_pit', 'resolveRemovedAwakenTheWildAndCallFromThePitOrders'],
    ['harvest_field', 'resolveHarvestTheFieldOrder'],
    ['awaken_grove', 'resolveAwakenGroveOrder'],
    ['wild_calling', 'resolveWildCallingOrder'],
    ['grand_design', 'resolveGrandDesignOrder'],
  ] as const) {
    expect(typeof fn(name)).toBe('function');
    expect(src).toMatch(new RegExp(`case '${key}':${name}\\(turnContext,c[^)]*\\);break;`));
  }
  expect(src).toContain("case 'awaken_wild':case 'call_pit':resolveRemovedAwakenTheWildAndCallFromThePitOrders(");
  expect(typeof fn('landHirePreOrders')).toBe('function');
  for (const s of [src, turn]) {
    expect(s).not.toContain('function landHirePreOrders');
    expect(s).not.toContain('HUMANOID_RACES_SG=');
  }
});
