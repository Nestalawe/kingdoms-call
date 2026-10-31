// The espionage orders' own functions (plan P1-08j6: src/engine/orders/, the sixth family taken out of processOrder),
// called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/espionage-orders-in-a-whole-turn.test.ts plays through a whole turn (lib/espionage-order-cases.ts), here one
// phase at a time, the orders read from the turn's list as processOrder reads them, with the same dice; then what the
// cases leave to a direct call: each die where it falls (a spy who misses and is caught, a thief at the edge of slipping
// away, which item a thief's hand closes on, which company burns, which parcel is cut), the gold and merit counted
// exactly, The Shadow (titles start at turn 5), a Grand Heist already spent, a Mithril suit kept; the two helpers the
// orders share, nested in processOrder until this row (a thief caught in the act, with the duel's outcome stood in; an
// item lifted); and properties of each order. The balance matrix never gives Sabotage, Assassinate or Vanish.
// Level 1: one function, called with what processOrder hands it.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The six functions (`resolveSpyOrder`, `resolveStealOrder`, `resolveSabotageOrder`, `resolveGrandHeistOrder`,
// `resolveAssassinateOrder`, `resolveVanishOrder`, P1-08j6), called directly on the same cases one phase at a time with
// the same dice, then each die where it falls (a spy who misses and is caught, the 5 and 95 bounds on the catch and the
// read, a disguise at 65/66, a thief's escape at Thief × 20 up to 95, which item a hand closes on by weight, which
// company burns, which parcel is cut and which ride on, a blade at 79/80), the gold and merits exact, The Shadow
// (titles start at turn 5), Watchmen at a capital only, a Grand Heist already spent, a Mithril suit kept, a beating
// floored at 1 HP; the two helpers that were nested in `processOrder` (`thiefCaughtScuffle`, with the duel stood in:
// Vanish, a refusal, combat tactics only, either side cut down or escaping the end, a wanderer's HP; `liftRandomItem`).
// The balance matrix never gives Sabotage, Assassinate or Vanish. Properties: Steal and the Grand Heist make and lose
// no gold or item and never move Mithril; a caught thief or a realm's victim keeps at least 1 HP; Assassinate kills
// exactly within the chance; Sabotage burns at most one company, only where it is aimed. Planted faults: in the PR
// (P1-08j6)
// Since P1-23e (R-119): Spy on a hero, Steal and Assassinate aimed at another realm's hero whose Invisibility holds find
// no one (no roll, a line naming no one); a realm that watches him by Clairvoyance, his own realm and last turn's
// Invisibility are passed through.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import {
  ESPIONAGE_ORDER_CASES,
  oldCloakOfManyFaces,
  oldCrystalOrb,
  recordExperienceRolls,
  stageCase,
  withCaseDice,
  type EspionageOrderCase,
} from '../lib/espionage-order-cases.ts';
import { companies, item, type Item } from '../lib/item-and-army-order-cases.ts';
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
} from '../lib/middle-of-a-bot-world.ts';
import { plainRealms } from '../lib/recruit-hire-and-realm-works-order-cases.ts';
import type { LineFact } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const provOf = fn('provOf');

/** One order, as processOrder hands it over in phase `ph`: each function takes the context, then the values it reads
 *  of processOrder's (the hero, the phase, the target, his province, his realm), in that order. */
const play = (b: Board, c: Character, o: Order, ph = 0) => {
  b.tc._currentPhase = ph;
  b.tc._logCtx = { charId: c.id, phase: ph };
  const prov = provOf(b.tc, c);
  const player = c.player == null ? undefined : b.G.players[c.player];
  const { action, target, extra } = o;
  const call: Record<string, () => unknown> = {
    spy: () => fn('resolveSpyOrder')(b.tc, c, target, prov),
    steal: () => fn('resolveStealOrder')(b.tc, c, target, prov, player),
    sabotage: () => fn('resolveSabotageOrder')(b.tc, c, target),
    grand_heist: () => fn('resolveGrandHeistOrder')(b.tc, c, ph, prov),
    assassinate: () => fn('resolveAssassinateOrder')(b.tc, c, target, prov),
    vanish: () => fn('resolveVanishOrder')(b.tc, c, prov),
    give_item: () => fn('resolveSendItemOrder')(b.tc, c, ph, target, extra),
    rest: () => fn('resolveRestOrder')(b.tc, c, prov),
  };
  must(call[action], 'the order ' + action)();
  b.tc._logCtx = { charId: null, phase: null };
};
/** Runs `body` with the percentile rolls (d100) given in turn, and every other die at `die`. */
function rolls<T>(d100s: number[], body: () => T, die = 0.5): T {
  const g = engine as unknown as Record<string, unknown>;
  const was = g['d100'];
  let i = 0;
  g['d100'] = () => must(d100s[i++], 'a d100 roll');
  try {
    return withDice(engine, [die], body);
  } finally {
    g['d100'] = was;
  }
}
/** A line of the duel the stand-in fights, as the fact it is (P1-12d18: every line is a fact). */
const THE_FIRST_BLOW = { kind: 'one fighter has the initiative', firstName: 'Brann' } as const;

/** Runs `body` with personal combat stood in by `end` (the top-level resolveCharVsChar replaced in the vm for the
 *  test's length), recording the plans each side fought on. */
function duelEndsIn<T>(
  end: { atkHp: number; defHp: number; atkKilled?: boolean; defKilled?: boolean; narrative?: LineFact[] },
  body: (plans: string[][][]) => T,
): T {
  const g = engine as unknown as Record<string, unknown>;
  const was = g['resolveCharVsChar'];
  const plans: string[][][] = [];
  g['resolveCharVsChar'] = (_tc: unknown, _a: unknown, _d: unknown, atkPlan: string[], defPlan: string[]) => {
    plans.push([[...atkPlan], [...defPlan]]);
    return { narrative: end.narrative ?? [], atkKilled: false, defKilled: false, ...end };
  };
  try {
    return body(plans);
  } finally {
    g['resolveCharVsChar'] = was;
  }
}
/** Runs `body`, recording each kill credited (the top-level awardKillXP wrapped in the vm for the test's length) as
 *  [killer, slain]. */
function killsIn(body: () => void): [unknown, unknown][] {
  const g = engine as unknown as Record<string, unknown>;
  const was = g['awardKillXP'] as Fn;
  const kills: [unknown, unknown][] = [];
  g['awardKillXP'] = (tc: unknown, killer: Character, slain: Character, ...rest: unknown[]) => {
    kills.push([killer.id, slain.id]);
    return was(tc, killer, slain, ...rest);
  };
  try {
    body();
  } finally {
    g['awardKillXP'] = was;
  }
  return kills;
}
const linesOf = (b: Board, c: Character) => b.lines().filter((l: Line) => l.charId === c.id);
const textOf = (b: Board, c: Character) =>
  linesOf(b, c)
    .map((l) => l.text)
    .join('\n');
const allText = (b: Board) =>
  b
    .lines()
    .map((l) => l.text)
    .join('\n');
const fresh = () => {
  const b = board(engine, world, 0);
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return b;
};
const realm = (b: Board, i = 0) => must(b.G.players[i], 'realm ' + String(i));
const at = (b: Board, skills: Record<string, number> = {}, s: Partial<HeroSpec> = {}) =>
  hero(b, { player: 0, at: b.X, skills: { melee: 2, tactical: 2, march: 1, spy: 0, ...skills }, ...s });
const rival = (b: Board, s: Partial<HeroSpec> = {}, skills: Record<string, number> = {}) =>
  at(b, skills, { player: 1, ...s });
const o = (action: string, target: string | number = '', extra: string | number = ''): Order => ({
  action,
  target: String(target),
  extra: String(extra),
  desc: '',
});
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const pack = (c: Character) => c.items.map((i) => String(i['name']));
const gold = (b: Board, i: number) => Number(realm(b, i)['gold'] ?? 0);
const merits = (c: Character) => Number(c['merits'] ?? 0);
const spyActions = (c: Character) => (c['tm'] as { spyActions?: number } | undefined)?.spyActions ?? 0;
const accepts = (c: Character) => {
  c['encounterPlan'] = { tactics: ['ME'], duelStance: 'accept' };
  return c;
};
const tiered = (b: Board, name: string, tier: number): Item => ({ ...item(b, name), tier });
const G_ = (b: Board) => b.G as unknown as Record<string, unknown>;

describe.each(ESPIONAGE_ORDER_CASES)('the %s order, called directly: the whole-turn cases', (_, cases) => {
  test.each(cases.filter((c) => !c.wholeTurnOnly).map((c) => [c.name, c] as const))(
    '%s',
    (_name, c: EspionageOrderCase) => {
      const b = board(engine, world, 0);
      const s = stageCase(b, c);
      b.G.turnOrders = Object.fromEntries(s.orders.map(([h, os]) => [h.id, os]));
      const { xp } = recording(() => {
        withCaseDice(engine, c.dice, () => {
          for (let ph = 0; ph < 5; ph++)
            for (const [h] of s.orders) {
              const next = b.G.turnOrders[h.id]?.[ph];
              if (h.alive && next) play(b, h, next as Order, ph);
            }
        });
      });
      const { got, want } = c.check({ world: b.G, lines: linesOf(b, s.hero), all: b.lines(), turn: b.G.turn, xp }, s);
      expect(got).toEqual(want);
    },
  );
});

// ── Spy ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Spy, called directly: the dice, The Shadow and the odds', () => {
  test('a spy who misses a hero may still be caught: his realm is told, and he learns nothing', () => {
    const b = fresh();
    const m = rival(b);
    const h = at(b, { spy: 1 });
    rolls([100, 1], () => {
      play(b, h, o('spy', `char:${String(m.id)}`));
    });
    const t = textOf(b, h);
    expect(t).toContain(`${h.name} watches ${m.name} closely`);
    expect(t).toContain(`📊 Detection — ${m.name} noticing ${h.name}: [✓]`);
    expect(allText(b)).toContain(`was caught spying on ${m.name}`);
    expect(realm(b, 0)['_spiedHeroSkills']).toBeUndefined();
  });

  test.each([
    [5, 'caught'],
    [6, 'not caught'],
  ])('a Master Spy is still caught one time in twenty: a detection roll of %i is %s', (roll, outcome) => {
    const b = fresh();
    const m = rival(b);
    const h = at(b, { spy: 6 });
    // the read's roll is drawn even when it needs none
    rolls([100, roll], () => {
      play(b, h, o('spy', `char:${String(m.id)}`));
    });
    expect(textOf(b, h)).toContain(`noticing ${h.name}: 5% [roll ${String(roll)} ${roll <= 5 ? '✓' : '✗'}]`);
    expect(allText(b).includes('was caught spying')).toBe(outcome === 'caught');
  });

  test('the chance to read a hero stops at 95', () => {
    const b = fresh();
    realm(b, 0)['discoveries'] = [{ id: 'sd62' }];
    const m = rival(b);
    const h = at(b, { spy: 5 });
    rolls([1, 100], () => {
      play(b, h, o('spy', `char:${String(m.id)}`));
    });
    expect(textOf(b, h)).toContain(`📊 Spy on ${m.name} — ${h.name} (Spy 5) in ${b.X.name}: 95% [roll 1 ✓]`);
  });

  test('the chance to catch a spy stops at 95', () => {
    const b = fresh();
    b.own(b.X, 1);
    realm(b, 1)['discoveries'] = [{ id: 'sd63' }];
    const m = rival(b, {}, { spy: 9 });
    const h = at(b, { spy: 0 });
    h.items = [oldCrystalOrb(b)];
    rolls([100, 100], () => {
      play(b, h, o('spy', `char:${String(m.id)}`));
    });
    expect(textOf(b, h)).toContain(
      `📊 Detection — ${m.name} (Spy 5) noticing ${h.name} in their own land: 95% [roll 100 ✗]`,
    );
  });

  test('a hero of no Spy reads a hero on 25% (the floor of 5 is never reached: nothing takes from the chance)', () => {
    for (const [roll, lands] of [
      [25, true],
      [26, false],
    ] as const) {
      const b = fresh();
      const m = rival(b);
      const h = at(b, { spy: 0 });
      rolls([roll, 100], () => {
        play(b, h, o('spy', `char:${String(m.id)}`));
      });
      expect(textOf(b, h)).toContain(`(Spy 0) in ${b.X.name}: 25% [roll ${String(roll)} ${lands ? '✓' : '✗'}]`);
      expect(textOf(b, h).includes('🔍')).toBe(lands);
    }
  });

  test('The Shadow is never caught spying on a hero, and no detection is rolled', () => {
    const b = fresh();
    const m = rival(b);
    const h = at(b, { spy: 1 });
    G_(b)['_minorHolders'] = { shadow: { charId: h.id } };
    rolls([1], () => {
      play(b, h, o('spy', `char:${String(m.id)}`));
    });
    expect(textOf(b, h)).toContain(`${h.name} slips away unseen. (The Shadow)`);
    expect(textOf(b, h)).not.toContain('Detection');
  });

  test('The Shadow spies out a province under a false face: no alarm, and no Disguise roll', () => {
    const b = fresh();
    b.own(b.X, 1);
    realm(b, 0)['discoveries'] = [{ id: 'sd23' }];
    const h = at(b, { spy: 1 });
    G_(b)['_minorHolders'] = { shadow: { charId: h.id } };
    rolls([1], () => {
      play(b, h, o('spy', b.X.id));
    });
    expect(h['_spyDisguised']).toBe(true);
    expect(allText(b)).not.toContain('Counter-intelligence');
    expect(textOf(b, h)).not.toContain('Disguise Techniques');
  });

  test('a disguise roll at the edge: 65 holds, 66 slips', () => {
    for (const [roll, holds] of [
      [65, true],
      [66, false],
    ] as const) {
      const b = fresh();
      b.own(b.X, 1);
      realm(b, 0)['discoveries'] = [{ id: 'sd23' }];
      const h = at(b, { spy: 6 });
      rolls([1, roll], () => {
        play(b, h, o('spy', b.X.id));
      });
      expect(h['_spyDisguised']).toBe(holds);
      expect(allText(b).includes('Counter-intelligence')).toBe(!holds);
    }
  });

  test.each([
    [40, true],
    [41, false],
  ])('Spy 1 spies out a province at a chance of 40: a roll of %i lands (%s)', (roll, lands) => {
    const b = fresh();
    const h = at(b, { spy: 1 });
    rolls([roll], () => {
      play(b, h, o('spy', b.X.id));
    });
    expect(textOf(b, h).includes(`${h.name} spies on ${b.X.name}`)).toBe(lands);
  });

  test('his own realm’s Cipher Scripts don’t hinder him on its ground', () => {
    const b = fresh();
    b.own(b.X, 0);
    realm(b, 0)['discoveries'] = [{ id: 'sd19' }];
    const h = at(b, { spy: 1 });
    rolls([1], () => {
      play(b, h, o('spy', b.X.id));
    });
    expect(textOf(b, h)).toContain(`(Spy 1) in ${b.X.name}: 40% [roll 1 ✓]`);
  });

  test('Forgery Arts add 40 to reading a hero too (Spy 1: 75%), and an older Crystal Orb is named on a read', () => {
    const b = fresh();
    realm(b, 0)['discoveries'] = [{ id: 'sd21' }];
    const m = rival(b);
    const h = at(b, { spy: 1 });
    rolls([1, 100], () => {
      play(b, h, o('spy', `char:${String(m.id)}`), 0);
    });
    expect(textOf(b, h)).toContain(`📊 Spy on ${m.name} — ${h.name} (Spy 1) in ${b.X.name}: 75% [roll 1 ✓]`);
    h.items = [oldCrystalOrb(b)];
    rolls([100, 100], () => {
      play(b, h, o('spy', `char:${String(m.id)}`), 1);
    });
    expect(textOf(b, h)).toContain(
      `📊 Spy on ${m.name} — ${h.name} (Spy 1) in ${b.X.name}: automatic success (Crystal Orb)`,
    );
  });

  test('a read keeps a copy: the hero’s later skill rises don’t change what was learned', () => {
    const b = fresh();
    const m = rival(b, {}, { spy: 2 });
    const h = at(b, { spy: 6 });
    rolls([100, 100], () => {
      play(b, h, o('spy', `char:${String(m.id)}`));
    });
    m.skills['spy'] = 4;
    const kept = (realm(b, 0)['_spiedHeroSkills'] as Record<string, { skills: Record<string, number> }>)[String(m.id)];
    expect(kept?.skills['spy']).toBe(2);
  });

  test('a Spy that lands is counted for the Spymaster, a province’s and a hero’s alike; a miss is not', () => {
    const b = fresh();
    const m = rival(b);
    const h = at(b, { spy: 6 });
    rolls([100, 100, 100], () => {
      play(b, h, o('spy', b.X.id), 0);
      play(b, h, o('spy', `char:${String(m.id)}`), 1);
    });
    expect(spyActions(h)).toBe(2);
    const h2 = at(b, { spy: 1 });
    rolls([100, 100], () => {
      play(b, h2, o('spy', b.X.id), 2);
    });
    expect(spyActions(h2)).toBe(0);
  });

  test('Watchmen guard only their realm’s capital: 60 off a Spy there, nothing in its other provinces', () => {
    const b = fresh();
    b.own(b.X, 1);
    const far = ring1(b, 0);
    b.own(far, 1);
    realm(b, 1)['discoveries'] = [{ id: 'ag17' }];
    realm(b, 1)['homeProvinceId'] = b.X.id;
    const h = at(b, { spy: 3 });
    rolls([1], () => {
      play(b, h, o('spy', b.X.id), 0);
    });
    expect(textOf(b, h)).toContain(`(Spy 3) in ${b.X.name}: 20% [roll 1 ✓]`);
    // the province named, not the one he stands in, decides which discoveries count
    rolls([1], () => {
      play(b, h, o('spy', far.id), 1);
    });
    expect(textOf(b, h)).toContain(`(Spy 3) in ${b.X.name}: 80% [roll 1 ✓]`);
  });

  test('a read keeps the hero’s skills as they stand, and his realm’s name', () => {
    const b = fresh();
    const m = rival(b, { king: true }, { spy: 2, thief: 4 });
    m.items = [item(b, 'Tome of Tactics')];
    const h = at(b, { spy: 6 });
    rolls([100, 100], () => {
      play(b, h, o('spy', `char:${String(m.id)}`));
    });
    const kept = (realm(b, 0)['_spiedHeroSkills'] as Record<string, Record<string, unknown>>)[String(m.id)];
    expect(kept).toEqual({
      name: m.name,
      isKing: true,
      alignment: 'Divine',
      race: 'Human',
      kingdom: realm(b, 1).name,
      skills: { melee: 2, tactical: 2, march: 1, spy: 2, thief: 4 },
      items: ['Tome of Tactics'],
      armies: [],
      turn: b.G.turn,
    });
    expect(textOf(b, h)).toContain(`(Human, Divine, king): skills — Thief 4, Melee 2, Tactical 2, Spy 2, March 1.`);
  });

  test('an older save’s Cloak of Many Faces hides its wearer from a read; an older Crystal Orb needs no roll', () => {
    const b = fresh();
    const m = rival(b);
    m.items = [oldCloakOfManyFaces(b)];
    const h = at(b, { spy: 1 });
    h.items = [oldCrystalOrb(b)];
    rolls([100, 100], () => {
      play(b, h, o('spy', `char:${String(m.id)}`), 0);
      play(b, h, o('spy', b.X.id), 1);
    });
    expect(textOf(b, h)).toContain('(Cloak of Many Faces)');
    expect(textOf(b, h)).toContain(`(Spy 1) in ${b.X.name}: automatic success (Crystal Orb)`);
  });
});

// ── Steal ───────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Steal, called directly: the dice, the gold and the merits', () => {
  test('gold: 5% of the realm’s treasury moves from it to the thief’s realm, and the thief earns a merit', () => {
    const b = fresh();
    realm(b, 1)['gold'] = 200;
    realm(b, 0)['gold'] = 7;
    const m = rival(b);
    const h = at(b, { thief: 1 });
    rolls([1], () => {
      play(b, h, o('steal', m.id));
    });
    expect([gold(b, 0), gold(b, 1), merits(h)]).toEqual([17, 190, 1]);
  });

  test('an item: two merits, and the item’s maximum HP moves with it', () => {
    const b = fresh();
    const m = rival(b);
    const h = at(b, { thief: 1 });
    const hpItems = JSON.parse(
      vm.runInContext(
        'JSON.stringify(ALL_MAGIC_ITEMS_P.filter(i=>i.effect&&i.effect.stat==="maxHp").map(i=>i.name))',
        engine,
      ) as string,
    ) as string[];
    const hpItem = must(hpItems[0], 'an item of maximum HP');
    m.items = [item(b, hpItem)];
    fn('applyItemMaxHp')(m, m.items[0]);
    const before = [m.maxHp, h.maxHp];
    rolls([1], () => {
      play(b, h, o('steal', m.id));
    });
    expect(merits(h)).toBe(2);
    expect(m.maxHp).toBeLessThan(must(before[0], 'his maximum HP'));
    expect(h.maxHp).toBeGreaterThan(must(before[1], 'the thief’s maximum HP'));
  });

  test('the garrison’s pay: gold moves from the province’s realm, and a merit; none when there is no gold', () => {
    const b = fresh();
    b.own(b.X, 1);
    b.X.garrisonArmies = companies(4);
    realm(b, 1)['gold'] = 3;
    realm(b, 0)['gold'] = 0;
    const h = at(b, { thief: 1 });
    rolls([1], () => {
      play(b, h, o('steal', 'garrison'));
    });
    expect([gold(b, 0), gold(b, 1), merits(h)]).toEqual([3, 0, 1]);
    rolls([1], () => {
      play(b, h, o('steal', 'garrison'), 1);
    });
    expect([gold(b, 0), gold(b, 1), merits(h)]).toEqual([3, 0, 1]);
  });

  test.each([
    [2, 0.39, 'slips away'],
    [2, 0.4, 'is caught'],
    [5, 0.9499, 'slips away'],
    [5, 0.95, 'is caught'],
    [9, 0.95, 'is caught'],
  ])('a thief of Thief %i who misses, with the escape die at %f, %s (Thief × 20, at most 95)', (n, die, outcome) => {
    const b = fresh();
    const m = rival(b);
    m.items = [item(b, 'Tome of Tactics')];
    const h = at(b, { thief: n });
    rolls(
      [100],
      () => {
        play(b, h, o('steal', m.id));
      },
      die,
    );
    expect(allText(b).includes('wants no part in a brawl')).toBe(outcome === 'is caught');
    expect(textOf(b, h).includes('slips away undetected')).toBe(outcome === 'slips away');
  });

  test('the guards’ beating leaves a thief at 1 HP at least', () => {
    const b = fresh();
    b.own(b.X, 1);
    b.X.garrisonArmies = companies(1);
    const h = at(b, { thief: 1 }, { hp: 20 });
    h.hp = 2;
    rolls(
      [100],
      () => {
        play(b, h, o('steal', 'garrison'));
      },
      0.99,
    );
    expect(h.hp).toBe(1);
    expect(textOf(b, h)).toContain('4 damage taken');
  });

  test('a Mithril suit stays with its wearer when a thief goes for his purse', () => {
    const b = fresh();
    realm(b, 1)['gold'] = 100;
    const m = rival(b);
    m.items = [item(b, 'Mithril Armour')];
    const h = at(b, { thief: 1 });
    rolls([1], () => {
      play(b, h, o('steal', m.id));
    });
    expect([pack(m), pack(h)]).toEqual([['Mithril Armour'], []]);
  });

  test.each([
    [60, true],
    [61, false],
  ])('Thief 1 steals at a chance of 60: a roll of %i lands (%s)', (roll, lands) => {
    const b = fresh();
    const m = rival(b);
    m.items = [item(b, 'Tome of Tactics')];
    const h = at(b, { thief: 1 });
    rolls(
      [roll],
      () => {
        play(b, h, o('steal', m.id));
      },
      0,
    );
    expect(pack(h)).toEqual(lands ? ['Tome of Tactics'] : []);
  });

  test.each([
    [30, true],
    [31, false],
  ])('Thief 1 robs the paymaster at a chance of 30: a roll of %i lands (%s)', (roll, lands) => {
    const b = fresh();
    b.own(b.X, 1);
    b.X.garrisonArmies = companies(2);
    realm(b, 1)['gold'] = 10;
    const h = at(b, { thief: 1 });
    rolls(
      [roll],
      () => {
        play(b, h, o('steal', 'garrison'));
      },
      0,
    );
    expect(gold(b, 1)).toBe(lands ? 8 : 10);
  });

  test('a target named by an id that isn’t a hero’s finds nobody', () => {
    const b = fresh();
    const h = at(b, { thief: 1 });
    rolls([1], () => {
      play(b, h, o('steal', 'nobody'));
    });
    expect(textOf(b, h)).toContain(`finds no suitable target to steal from in ${b.X.name}`);
  });

  test('"garrison" is read whatever its case and spacing', () => {
    const b = fresh();
    const h = at(b, { thief: 1 });
    rolls([1], () => {
      play(b, h, o('steal', ' Garrison '));
    });
    expect(textOf(b, h)).toContain('finds no enemy paymaster to rob');
  });
});

describe('the item lifted (liftRandomItem, nested in processOrder until P1-08j6)', () => {
  const lift = fn('liftRandomItem');
  const victim = (b: Board) => {
    const m = rival(b);
    m.items = [
      tiered(b, 'Tome of Tactics', 1),
      tiered(b, 'Kingsteel Longsword', 2),
      tiered(b, 'Sundered Greatsword', 3),
      tiered(b, 'Crystal Orb', 4),
    ];
    return m;
  };
  test.each([
    [0, 'Tome of Tactics'],
    [7.99 / 15, 'Tome of Tactics'],
    [8 / 15, 'Kingsteel Longsword'],
    [11.99 / 15, 'Kingsteel Longsword'],
    [12 / 15, 'Sundered Greatsword'],
    [13.99 / 15, 'Sundered Greatsword'],
    [14 / 15, 'Crystal Orb'],
    [0.99999, 'Crystal Orb'],
  ])('the hand closes by weight, Weak 8 : Moderate 4 : Powerful 2 : Legendary 1 (die %f: the %s)', (die, name) => {
    const b = fresh();
    const m = victim(b);
    const h = at(b, { thief: 1 });
    const got = withDice(engine, [die], () => lift(b.tc, h, m)) as Item;
    expect(got.name).toBe(name);
    expect(pack(h)).toEqual([name]);
    expect(pack(m)).not.toContain(name);
    expect(got['_stolenTurn']).toBe(b.G.turn);
  });
  test.each([
    [7.99 / 12, 'Tome of Tactics'],
    [0.9, 'Kingsteel Longsword'],
  ])('an item with no tier weighs as a Weak one (die %f: the %s)', (die, name) => {
    const b = fresh();
    const m = rival(b);
    const untiered = { ...item(b, 'Tome of Tactics') };
    delete untiered['tier'];
    m.items = [untiered, tiered(b, 'Kingsteel Longsword', 2)];
    const h = at(b, { thief: 1 });
    expect((withDice(engine, [die], () => lift(b.tc, h, m)) as Item).name).toBe(name);
  });
  test('nothing to lift but Mithril is nothing; a master thief’s pack is guarded', () => {
    const b = fresh();
    const m = rival(b);
    m.items = [item(b, 'Mithril Armour')];
    const h = at(b, { thief: 1 });
    expect(lift(b.tc, h, m)).toBeNull();
    const master = rival(b, {}, { thief: 8 });
    master.items = [item(b, 'Tome of Tactics')];
    expect(lift(b.tc, h, master)).toEqual({ guarded: true });
    expect(pack(master)).toEqual(['Tome of Tactics']);
    const seven = rival(b, {}, { thief: 7 });
    seven.items = [item(b, 'Kingsteel Longsword')];
    expect((lift(b.tc, h, seven) as Item).name).toBe('Kingsteel Longsword');
  });
});

// ── A thief caught in the act ───────────────────────────────────────────────────────────────────────────────────
describe('a thief caught in the act (thiefCaughtScuffle, nested in processOrder until P1-08j6)', () => {
  const scuffle = fn('thiefCaughtScuffle');
  const stage = () => {
    const b = fresh();
    const thief = at(b, { thief: 3 });
    const victim = accepts(rival(b));
    return { b, thief, victim };
  };
  test('a vanished thief is never brought to bay', () => {
    const { b, thief, victim } = stage();
    thief['_vanishTurn'] = b.G.turn;
    duelEndsIn({ atkHp: 0, defHp: 20, atkKilled: true }, (plans) => {
      scuffle(b.tc, b.X, thief, victim, 'red-handed');
      expect(plans).toEqual([]);
    });
    expect(allText(b)).toContain(
      `${victim.name} raises the alarm, but ${thief.name} has already melted into the shadows. (Vanish)`,
    );
    expect(thief.alive).toBe(true);
  });
  test('a victim who refuses a brawl drives him off', () => {
    const { b, thief, victim } = stage();
    victim['encounterPlan'] = { tactics: ['ME'], duelStance: 'refuse' };
    duelEndsIn({ atkHp: 0, defHp: 20, atkKilled: true }, (plans) => {
      scuffle(b.tc, b.X, thief, victim, 'red-handed');
      expect(plans).toEqual([]);
    });
    expect(allText(b)).toContain(`${victim.name} catches ${thief.name} red-handed, but wants no part in a brawl`);
  });
  test('the duel is fought on each side’s combat tactics only (Melee if none), its lines told, the field marked', () => {
    const { b, thief, victim } = stage();
    thief['encounterPlan'] = { tactics: ['FL', 'AR:2'], duelStance: 'accept' };
    victim['encounterPlan'] = { tactics: ['XX', 'CA:Bless'], duelStance: 'accept' };
    duelEndsIn({ atkHp: 7, defHp: 9, narrative: [THE_FIRST_BLOW] }, (plans) => {
      scuffle(b.tc, b.X, thief, victim, 'red-handed');
      expect(plans).toEqual([[['FL', 'AR:2'], ['CA:Bless']]]);
    });
    expect(allText(b)).toContain(`⚔ ${victim.name} catches ${thief.name} red-handed — blades are drawn!`);
    expect(allText(b)).toContain(theWordsOf(THE_FIRST_BLOW));
    expect([thief.hp, victim.hp]).toEqual([7, 9]);
    expect(b.X['_combatPlayersThisTurn']).toEqual([0, 1]);
  });
  test('a victim with no plan is given one, and fights on it', () => {
    const { b, thief } = stage();
    const wanderer = rival(b, { player: null }, { archery: 5, melee: 0 });
    duelEndsIn({ atkHp: 7, defHp: 9 }, (plans) => {
      scuffle(b.tc, b.X, thief, wanderer, 'red-handed');
      const made = (wanderer['encounterPlan'] as { tactics: string[] } | undefined)?.tactics;
      expect(made).toBeDefined();
      expect(plans[0]?.[1]).toEqual(
        must(made, 'his plan').filter((t) =>
          ['ME', 'MELEE', 'AR', 'ARCHERY', 'FI', 'FIRE', 'ARROW', 'CA', 'SPELL', 'FL', 'FLEE'].includes(
            t.split(':')[0]?.toUpperCase() ?? '',
          ),
        ),
      );
    });
  });
  test('a plan of no combat tactics fights on Melee, on either side', () => {
    const { b, thief, victim } = stage();
    thief['encounterPlan'] = { tactics: ['XX'], duelStance: 'accept' };
    victim['encounterPlan'] = { tactics: ['FLEE_NOT', 'YY'], duelStance: 'accept' };
    duelEndsIn({ atkHp: 7, defHp: 9 }, (plans) => {
      scuffle(b.tc, b.X, thief, victim, 'red-handed');
      expect(plans).toEqual([[['ME'], ['ME']]]);
    });
  });
  test('a thief cut down dies, and the victim is credited the kill', () => {
    const { b, thief, victim } = stage();
    const kills = killsIn(() => {
      duelEndsIn({ atkHp: 0, defHp: 12, atkKilled: true }, () => scuffle(b.tc, b.X, thief, victim, 'red-handed'));
    });
    expect(kills).toEqual([[victim.id, thief.id]]);
    expect(allText(b)).toContain(`${thief.name} is cut down — a thief's end.`);
    expect([thief.alive, victim.alive]).toEqual([false, true]);
    expect((victim['tm'] as Record<string, number> | undefined)?.['duelKills']).toBe(1);
  });
  test('a victim slain by the cornered thief dies, and the thief is credited the kill', () => {
    const { b, thief, victim } = stage();
    const kills = killsIn(() => {
      duelEndsIn({ atkHp: 5, defHp: 0, defKilled: true }, () => scuffle(b.tc, b.X, thief, victim, 'red-handed'));
    });
    expect(kills).toEqual([[thief.id, victim.id]]);
    expect(allText(b)).toContain(`${victim.name} is slain by the cornered thief!`);
    expect([thief.alive, victim.alive]).toEqual([true, false]);
    expect((thief['tm'] as Record<string, number> | undefined)?.['duelKills']).toBe(1);
  });
  test('a hero who can’t be killed escapes the end at 1 HP, on either side', () => {
    const { b, thief, victim } = stage();
    thief['_unkillable'] = true;
    victim['_unkillable'] = true;
    duelEndsIn({ atkHp: 0, defHp: 0, atkKilled: true, defKilled: true }, () =>
      scuffle(b.tc, b.X, thief, victim, 'red-handed'),
    );
    expect([thief.alive, victim.alive, thief.hp, victim.hp]).toEqual([true, true, 1, 1]);
    // the escape is told to both realms, as the scuffle tells it (a death that doesn't take tells it to none)
    expect(
      b
        .lines()
        .filter((l) => l.text.startsWith('🍀'))
        .map((l) => l.targets),
    ).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });
  test('a wandering victim’s HP is left as the duel left it', () => {
    const { b, thief } = stage();
    const wanderer = rival(b, { player: null });
    wanderer.hp = 13;
    duelEndsIn({ atkHp: 4, defHp: 6 }, () => scuffle(b.tc, b.X, thief, wanderer, 'red-handed'));
    expect([thief.hp, wanderer.hp]).toEqual([4, 13]);
  });
});

// ── Sabotage ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Sabotage, called directly', () => {
  test.each([
    [0, 'Torch c0'],
    [0.34, 'Torch c1'],
    [0.99, 'Torch c2'],
  ])('the die picks the company that burns (die %f: %s)', (die, burnt) => {
    const b = fresh();
    const p = ring1(b, 0);
    b.own(p, 1);
    p.garrisonArmies = companies(3, 'Men-at-Arms', 'Average', 'Torch');
    const h = at(b, { spy: 7 });
    withDice(engine, [die], () => {
      play(b, h, o('sabotage', p.id));
    });
    expect(p.garrisonArmies.map((u) => u.unitName)).toEqual(
      ['Torch c0', 'Torch c1', 'Torch c2'].filter((n) => n !== burnt),
    );
  });
  test('a province beyond his own lands, far off, can be sabotaged', () => {
    const b = fresh();
    const far = must(
      b.G.world.provinces.find((p) => !b.near.includes(p) && p.terrain !== 'sea'),
      'a far province',
    );
    b.own(far, 1);
    const h = at(b, { spy: 7 });
    play(b, h, o('sabotage', far.id));
    expect(far['_sabotagedForTurn']).toBe(b.G.turn);
  });
});

// ── Grand Heist ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('Grand Heist, called directly', () => {
  const stage = (thief = 7, gold0 = 100) => {
    const b = fresh();
    b.own(b.X, 1);
    b.X['tax'] = 7;
    realm(b, 1)['gold'] = gold0;
    realm(b, 0)['gold'] = 5;
    return { b, h: at(b, { thief }) };
  };
  test('the gold moves from the robbed realm to the thief’s, with two merits', () => {
    const { b, h } = stage(7, 101);
    rolls([1], () => {
      play(b, h, o('grand_heist'), 1);
    });
    expect([gold(b, 0), gold(b, 1), merits(h)]).toEqual([30, 76, 2]);
  });
  test('a master thief’s doubled take still leaves the realm what is over', () => {
    const { b, h } = stage(8, 101);
    rolls([1], () => {
      play(b, h, o('grand_heist'), 1);
    });
    expect([gold(b, 0), gold(b, 1)]).toEqual([55, 51]);
  });
  test('an attempt already spent this turn is refused (processOrder’s once-a-turn check comes first in a turn)', () => {
    const { b, h } = stage();
    h['_grandHeistTurn'] = b.G.turn;
    rolls([1], () => {
      play(b, h, o('grand_heist'), 1);
    });
    expect(textOf(b, h)).toContain(
      `${h.name} has already attempted a Grand Heist this turn — one great job a season is all the nerves will bear.`,
    );
    expect(gold(b, 1)).toBe(100);
  });
  test('the dice pick a parcel among those bound for the robbed realm’s heroes, then an item in it; the others ride on', () => {
    const { b, h } = stage(7, 0);
    const a = rival(b, { at: ring1(b, 0) });
    const c = rival(b, { at: ring1(b, 1) });
    const ally = rival(b, { at: ring1(b, 1), player: 2 });
    const parcel = (to: Character, ...names: string[]) => ({
      toId: to.id,
      items: names.map((n) => item(b, n)),
      fromName: 'A Sender',
    });
    G_(b)['_itemDeliveries'] = [
      parcel(ally, 'Bronze Buckler'),
      parcel(a, 'Tome of Tactics', 'Kingsteel Longsword'),
      { toId: c.id, items: [], fromName: 'An Empty Hand' },
      parcel(c, 'Sundered Greatsword'),
      { toId: 424242, items: [item(b, 'Ring of the Explorer')], fromName: 'Nobody' },
    ];
    // the parcels bound for realm 1's heroes, with something in them: [a's, c's]; die 0.6 → c's, then its only item
    rolls(
      [1],
      () => {
        play(b, h, o('grand_heist'), 1);
      },
      0.6,
    );
    expect(pack(h)).toEqual(['Sundered Greatsword']);
    expect(allText(b)).toContain(
      `📦 A courier of ${realm(b, 1).name} is waylaid on the road — Sundered Greatsword, sent by A Sender and bound for ${c.name}, never arrives.`,
    );
    const left = (G_(b)['_itemDeliveries'] as { items: Item[] }[]).map((d) => d.items.map((i) => i.name));
    expect(left).toEqual([
      ['Bronze Buckler'],
      ['Tome of Tactics', 'Kingsteel Longsword'],
      [],
      [],
      ['Ring of the Explorer'],
    ]);
  });
  test('the parcel’s line names its sender and addressee only when it knows them', () => {
    const { b, h } = stage(7, 0);
    G_(b)['_itemDeliveries'] = [{ toId: rival(b, { at: ring1(b, 0) }).id, items: [item(b, 'Tome of Tactics')] }];
    rolls(
      [1],
      () => {
        play(b, h, o('grand_heist'), 1);
      },
      0,
    );
    expect(allText(b)).toMatch(/is waylaid on the road — Tome of Tactics and bound for Hero \d+, never arrives\./u);
  });
  test.each([
    [0.9499, 'slips away'],
    [0.95, 'is caught'],
  ])('Thief 7 slips away from a failed heist unless the die is at least 95 (die %f: %s)', (die, outcome) => {
    const { b, h } = stage();
    rolls(
      [100],
      () => {
        play(b, h, o('grand_heist'), 1);
      },
      die,
    );
    expect(textOf(b, h).includes('slips away undetected')).toBe(outcome === 'slips away');
    expect(textOf(b, h).includes('beaten back by the guards')).toBe(outcome === 'is caught');
  });
  test.each([
    [70, true],
    [71, false],
  ])('Thief 7 cracks the vaults at a chance of 70: a roll of %i lands (%s)', (roll, lands) => {
    const { b, h } = stage();
    rolls(
      [roll],
      () => {
        play(b, h, o('grand_heist'), 1);
      },
      0,
    );
    expect(gold(b, 1)).toBe(lands ? 75 : 100);
  });

  test('the dice pick an item within the parcel, and its maximum HP comes with it', () => {
    const { b, h } = stage(7, 0);
    const hpItems = JSON.parse(
      vm.runInContext(
        'JSON.stringify(ALL_MAGIC_ITEMS_P.filter(i=>i.effect&&i.effect.stat==="maxHp").map(i=>i.name))',
        engine,
      ) as string,
    ) as string[];
    const hpItem = must(hpItems[0], 'an item of maximum HP');
    G_(b)['_itemDeliveries'] = [
      {
        toId: rival(b, { at: ring1(b, 0) }).id,
        items: [item(b, 'Tome of Tactics'), item(b, hpItem)],
        fromName: 'A Sender',
      },
    ];
    const before = h.maxHp;
    rolls(
      [1],
      () => {
        play(b, h, o('grand_heist'), 1);
      },
      0.6,
    );
    expect(pack(h)).toEqual([hpItem]);
    expect(h.maxHp).toBeGreaterThan(before);
  });

  test('a hero of the robbed realm elsewhere neither guards the vaults nor gives chase', () => {
    const { b, h } = stage();
    const away = rival(b, { at: ring1(b, 0) });
    away.armies = companies(1);
    accepts(away);
    rolls(
      [100],
      () => {
        play(b, h, o('grand_heist'), 1);
      },
      0.99,
    );
    expect(textOf(b, h)).toContain('70% [roll 100 ✗]');
    expect(textOf(b, h)).toContain('beaten back by the guards');
  });

  test('the vaults’ guards leave a thief at 1 HP at least', () => {
    const { b, h } = stage();
    h.hp = 3;
    rolls(
      [100],
      () => {
        play(b, h, o('grand_heist'), 1);
      },
      0.99,
    );
    expect(h.hp).toBe(1);
  });
  test('a hero of another realm standing there neither guards the vaults nor gives chase', () => {
    const { b, h } = stage();
    const stranger = rival(b, { player: 2 });
    stranger.armies = companies(1);
    rolls(
      [100],
      () => {
        play(b, h, o('grand_heist'), 1);
      },
      0.99,
    );
    expect(textOf(b, h)).toContain('70% [roll 100 ✗]');
    expect(textOf(b, h)).toContain('beaten back by the guards');
  });
});

// ── Assassinate ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('Assassinate, called directly', () => {
  test('a blade that lands: the mark dies, two merits and the kill to the assassin, and the roll line is his realm’s alone', () => {
    const b = fresh();
    const m = rival(b);
    const h = at(b, { spy: 9 });
    rolls([79], () => {
      play(b, h, o('assassinate', m.id));
    });
    expect([m.alive, merits(h) >= 2, spyActions(h)]).toEqual([false, true, 1]);
    const roll = b.lines().find((l) => l.text.startsWith('📊 Assassination'));
    expect(roll?.targets).toEqual([0]);
    expect(roll?.text).toContain('79% (roll 79 ✓)');
  });
  test('a roll of 80 misses Spy 9 (79%)', () => {
    const b = fresh();
    const m = rival(b);
    const h = at(b, { spy: 9 });
    rolls([80], () => {
      play(b, h, o('assassinate', m.id));
    });
    expect(m.alive).toBe(true);
  });
  test('a mark who can’t be killed: no merits, no Spymaster credit', () => {
    const b = fresh();
    const m = rival(b);
    m['_unkillable'] = true;
    const h = at(b, { spy: 9 });
    rolls([1], () => {
      play(b, h, o('assassinate', m.id));
    });
    expect([m.alive, merits(h), spyActions(h)]).toEqual([true, 0, 0]);
  });
  test('a target that names no hero finds no mark', () => {
    const b = fresh();
    const h = at(b, { spy: 9 });
    play(b, h, o('assassinate', 'nobody'));
    expect(textOf(b, h)).toContain('finds no enemy hero to assassinate');
  });
});

// ── Invisibility (R-119) ────────────────────────────────────────────────────────────────────────────────────────
describe('a hero whose Invisibility holds (R-119): another realm’s Spy, Steal or Assassinate finds no one', () => {
  /** A rival at the spy's side, his Invisibility holding this turn. */
  const unseen = (b: Board) => {
    const m = rival(b);
    m['_invisTurn'] = b.G.turn;
    return m;
  };
  /** The order, with no d100 to draw: one drawn throws. */
  const noRoll = (b: Board, h: Character, order: Order) => {
    rolls([], () => {
      play(b, h, order);
    });
  };
  test('Spy on a hero: the spy looks for his quarry and finds no one, and the line names no one', () => {
    const b = fresh();
    const m = unseen(b);
    const h = at(b, { spy: 3 });
    noRoll(b, h, o('spy', `char:${String(m.id)}`));
    expect(textOf(b, h)).toBe(
      `${h.name} looks for their quarry in ${b.X.name}, but they are not to be found here — the spying comes to nothing.`,
    );
    expect(realm(b, 0)['_spiedHeroSkills']).toBeUndefined();
  });
  test('Steal: the thief finds no target, and the rival’s pack and purse are untouched', () => {
    const b = fresh();
    const m = unseen(b);
    m.items = [item(b, 'Tome of Tactics')];
    const h = at(b, { thief: 3 });
    noRoll(b, h, o('steal', m.id));
    expect(textOf(b, h)).toBe(`${h.name} finds no suitable target to steal from in ${b.X.name}.`);
    expect([pack(m), pack(h)]).toEqual([['Tome of Tactics'], []]);
  });
  test('Assassinate: the assassin finds no enemy hero, and the mark lives', () => {
    const b = fresh();
    const m = unseen(b);
    const h = at(b, { spy: 9 });
    noRoll(b, h, o('assassinate', m.id));
    expect(textOf(b, h)).toBe(`${h.name} finds no enemy hero to assassinate in ${b.X.name} this phase.`);
    expect(m.alive).toBe(true);
  });
  test('a realm that watches him by Clairvoyance still finds him; his own realm’s thief knows a comrade; last turn’s Invisibility hides no one', () => {
    const watched = fresh();
    const m = unseen(watched);
    realm(watched, 0)['_clairCharThisTurn'] = m.id;
    rolls([79], () => {
      play(watched, at(watched, { spy: 9 }), o('assassinate', m.id));
    });
    expect(m.alive).toBe(false);
    const own = fresh();
    const friend = at(own);
    friend['_invisTurn'] = own.G.turn;
    const thief = at(own, { thief: 3 });
    noRoll(own, thief, o('steal', friend.id));
    expect(textOf(own, thief)).toBe(`${thief.name} will not rob a comrade.`);
    const stale = fresh();
    const s = rival(stale);
    s['_invisTurn'] = stale.G.turn - 1;
    rolls([79], () => {
      play(stale, at(stale, { spy: 9 }), o('assassinate', s.id));
    });
    expect(s.alive).toBe(false);
  });
});

// ── Properties ──────────────────────────────────────────────────────────────────────────────────────────────────
const seed = Number(process.env['KC_SEED']) >>> 0 || 1;
describe('properties of the espionage orders', () => {
  const ITEMS = ['Tome of Tactics', 'Kingsteel Longsword', 'Mithril Armour', 'Bronze Buckler'];
  test('Steal makes and loses no gold and no item: what one side loses the other gains', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        fc.subarray(ITEMS),
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 1, max: 100 }),
        fc.double({ min: 0, max: 0.99999, noNaN: true }),
        fc.boolean(),
        (thief, items, purse, roll, die, leading) => {
          const b = fresh();
          realm(b, 1)['gold'] = purse;
          realm(b, 0)['gold'] = 10;
          const m = rival(b);
          m.items = items.map((n) => item(b, n));
          if (leading) m.armies = companies(1);
          const h = at(b, { thief });
          const before = { gold: gold(b, 0) + gold(b, 1), items: [...pack(h), ...pack(m)].sort() };
          rolls(
            [roll],
            () => {
              play(b, h, o('steal', m.id));
            },
            die,
          );
          const after = { gold: gold(b, 0) + gold(b, 1), items: [...pack(h), ...pack(m)].sort() };
          expect(after).toEqual(before);
          expect(pack(h)).not.toContain('Mithril Armour');
          expect(h.hp).toBeGreaterThanOrEqual(1);
        },
      ),
      { seed, numRuns: 60 },
    );
  });
  test('a Grand Heist makes no gold and no item, and never leaves a treasury below 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 7, max: 9 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 100 }),
        fc.double({ min: 0, max: 0.99999, noNaN: true }),
        (thief, purse, parcels, roll, die) => {
          const b = fresh();
          b.own(b.X, 1);
          b.X['tax'] = 9;
          realm(b, 1)['gold'] = purse;
          realm(b, 0)['gold'] = 0;
          const to = rival(b, { at: ring1(b, 0) });
          G_(b)['_itemDeliveries'] = Array.from({ length: parcels }, () => ({
            toId: to.id,
            items: [item(b, 'Tome of Tactics')],
          }));
          const h = at(b, { thief });
          const count = () =>
            pack(h).length + (G_(b)['_itemDeliveries'] as { items: Item[] }[]).reduce((n, d) => n + d.items.length, 0);
          const before = { gold: gold(b, 0) + gold(b, 1), items: count() };
          rolls(
            [roll],
            () => {
              play(b, h, o('grand_heist'), 1);
            },
            die,
          );
          expect({ gold: gold(b, 0) + gold(b, 1), items: count() }).toEqual(before);
          expect(gold(b, 1)).toBeGreaterThanOrEqual(0);
          expect(pack(h).length).toBeLessThanOrEqual(1);
        },
      ),
      { seed, numRuns: 60 },
    );
  });
  test('a thief caught in the act never leaves a living thief or a realm’s victim below 1 HP, whoever can’t be killed', () => {
    const scuffle = fn('thiefCaughtScuffle');
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 20 }),
        fc.integer({ min: -5, max: 20 }),
        fc.boolean(),
        fc.boolean(),
        (atkHp, defHp, thiefUnkillable, victimUnkillable) => {
          const b = fresh();
          const thief = at(b, { thief: 3 });
          const victim = accepts(rival(b));
          if (thiefUnkillable) thief['_unkillable'] = true;
          if (victimUnkillable) victim['_unkillable'] = true;
          duelEndsIn({ atkHp, defHp }, () => scuffle(b.tc, b.X, thief, victim, 'red-handed'));
          expect([thief, victim].filter((c) => c.alive && c.hp < 1)).toEqual([]);
        },
      ),
      { seed, numRuns: 80 },
    );
  });
  test('Assassinate kills the mark exactly when the roll is within the chance', () => {
    fc.assert(
      fc.property(fc.integer({ min: 9, max: 9 }), fc.integer({ min: 1, max: 100 }), fc.boolean(), (spy, roll, king) => {
        const b = fresh();
        const m = rival(b, { king });
        const h = at(b, { spy });
        rolls([roll], () => {
          play(b, h, o('assassinate', m.id));
        });
        expect(m.alive).toBe(roll > (king ? 54 : 79));
      }),
      { seed, numRuns: 60 },
    );
  });
  test('Sabotage takes at most one company, and only from the province named', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4 }), fc.double({ min: 0, max: 0.99999, noNaN: true }), (n, die) => {
        const b = fresh();
        const p: Province = ring1(b, 0);
        const q: Province = ring1(b, 1);
        b.own(p, 1);
        b.own(q, 1);
        p.garrisonArmies = companies(n);
        q.garrisonArmies = companies(2);
        const h = at(b, { spy: 7 });
        withDice(engine, [die], () => {
          play(b, h, o('sabotage', p.id));
        });
        expect([p.garrisonArmies.length, q.garrisonArmies.length]).toEqual([Math.max(0, n - 1), 2]);
      }),
      { seed, numRuns: 40 },
    );
  });
});
