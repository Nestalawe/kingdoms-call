// processOrder itself (plan P1-08j9: src/engine/orders/, lifted out of resolveTurn), called directly in the bare vm on
// the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases scenario/order-dispatch-in-a-whole-turn.test.ts
// plays through a whole turn (lib/order-dispatch-cases.ts), here one phase at a time, the heroes in the turn's own
// order of a phase (phaseInitCompare), with the same dice; then, with every order's own function stood in (each
// replaced in the vm by a recorder for the test's length), what processOrder hands each one: every order name the game
// knows reaches its own function, once, with the values it reads; and what the cases leave to a direct call: a hero
// fallen or with no order, the log's context after each refusal, the battle lock's foes one by one (a stale flag, a
// leaderless host, a wanderer, a neutral garrison), each charm refusal and each mastery's once-a-turn charge, the
// Forced March's slip, a spell item's cast, a bot's Practice read from the season's start, a bot's Search on a save
// missing his HP. Properties (fast-check): at most one order function runs for any order, and none after a refusal; a
// mastery runs at most once a turn; a bot's switched Practice never names a skill at 5.
// Level 1: one function, called with what the phase loop hands it.
import fc from 'fast-check';
import vm from 'node:vm';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls, withCaseDice } from '../lib/espionage-order-cases.ts';
import { companies } from '../lib/item-and-army-order-cases.ts';
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
} from '../lib/middle-of-a-bot-world.ts';
import { LANDS, ORDER_DISPATCH_CASES, stageCase, type OrderDispatchCase } from '../lib/order-dispatch-cases.ts';
import { plainRealms } from '../lib/recruit-hire-and-realm-works-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const processOrder = fn('processOrder');
const setMovePool = fn('setMovePool');
const PHASE_ACTION_MAP = vm.runInContext('PHASE_ACTION_MAP', engine) as Record<string, string>;
const MASTERIES = [...(vm.runInContext('MASTERY_ORDER_KEYS', engine) as Set<string>)];
const MASTERY_LABEL = vm.runInContext('MASTERY_ORDER_LABEL', engine) as Record<string, string>;
const RITES = [...(vm.runInContext('ALIGNMENT_ORDER_KEYS', engine) as Set<string>)];
const SEA_TYPES = vm.runInContext('KC_UNIT_CLASS.sea', engine) as string[];

const linesOf = (b: Board, c: Character) => b.lines().filter((l: Line) => l.charId === c.id);
const textOf = (b: Board, c: Character) => linesOf(b, c).map((l) => l.text);
const fresh = () => {
  const b = board(engine, world, 0);
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return b;
};
const at = (b: Board, skills: Record<string, number> = {}, s: Partial<HeroSpec> = {}) =>
  hero(b, { player: 0, at: b.X, skills: { melee: 2, tactical: 2, march: 1, ...skills }, ...s });
const ALL_NINE = {
  melee: 9,
  tactical: 9,
  march: 9,
  naval: 9,
  archery: 9,
  sage: 9,
  explorer: 9,
  spy: 9,
  thief: 9,
};
const o = (action: string, target: string | number = '', extra: string | number = ''): Order => ({
  action,
  target: String(target),
  extra: String(extra),
  desc: '',
});
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const bot = (b: Board, realm = 0) => {
  (b.tc as unknown as { _botPlayerIdx: Set<number> })._botPlayerIdx.add(realm);
};
/** The season's skills as the turn records them at its start (startPhase), for every hero. */
const snapshot = (b: Board) => {
  (b.G as unknown as Record<string, unknown>)['_phaseSkillSnapshot'] = Object.fromEntries(
    b.G.characters.map((c) => [c.id, { ...c.skills }]),
  );
};
/** processOrder for `c`'s order `ord` in phase `ph`, as the phase loop calls it. */
const dispatch = (b: Board, c: Character | null, ord: Order | null, ph = 0) => {
  b.tc._currentPhase = ph;
  processOrder(b.tc, c, ord, ph);
};

// ── Every order's own function, stood in ────────────────────────────────────────────────────────────────────────
/** Each value of PHASE_ACTION_MAP: the function processOrder hands it to, and what it hands it after the context. */
type Arg = 'c' | 'o' | 'ph' | 'target' | 'extra' | 'prov' | 'player' | 'fmSlip' | 'itemCast' | 'action';
const HANDED: Record<string, [string, Arg[]]> = {
  move: ['resolveMoveOrder', ['c', 'ph', 'fmSlip', 'target', 'prov', 'player']],
  explore: ['resolveExploreOrder', ['c', 'prov']],
  rite: ['resolvePerformRiteOrder', ['c', 'ph', 'target', 'extra', 'prov', 'player']],
  hunt_rumours: ['resolveHuntingRumoursOrder', ['c', 'target', 'prov', 'player']],
  search: ['resolveSearchLairOrder', ['c', 'ph', 'target', 'prov', 'player']],
  recruit: ['resolveRecruitArmiesOrder', ['c', 'ph', 'target', 'extra', 'prov', 'player']],
  hire: ['resolveHireHeroOrder', ['c', 'ph', 'target', 'prov', 'player']],
  spy: ['resolveSpyOrder', ['c', 'target', 'prov']],
  consecrate: ['resolveConsecrateOrder', ['c', 'prov', 'player']],
  call_to_arms: ['resolveCallToArmsOrder', ['c', 'target', 'player']],
  broker: ['resolveBrokerOrder', ['c', 'ph', 'target', 'player']],
  awaken_wild: ['resolveRemovedAwakenTheWildAndCallFromThePitOrders', ['c', 'action']],
  call_pit: ['resolveRemovedAwakenTheWildAndCallFromThePitOrders', ['c', 'action']],
  harvest_field: ['resolveHarvestTheFieldOrder', ['c', 'ph', 'prov', 'player']],
  // the prototype kits' orders (alignment ideas round 1, src/engine/orders/alignment-prototype-orders.ts)
  good_works: ['resolveGoodWorksOrder', ['c', 'prov']],
  grow_wild: ['resolveGrowTheWildOrder', ['c', 'prov']],
  tend_grove: ['resolveTendTheGroveOrder', ['c', 'prov']],
  trade_pact: ['resolveTradePactOrder', ['c', 'ph', 'target', 'prov', 'player']],
  lay_waste: ['resolveLayWasteOrder', ['c', 'prov', 'player']],
  despoil: ['resolveDespoilOrder', ['c', 'prov']],
  bind_bones: ['resolveBindTheBonesOrder', ['c', 'player']],
  research: ['resolveResearchOrder', ['c', 'ph', 'target', 'player']],
  practice: ['resolvePracticeSkillOrder', ['c', 'ph', 'target']],
  equip_items: ['resolveEquipItemsOrder', ['c', 'target']],
  use_item: ['resolveUseItemOrder', ['c', 'target', 'prov']],
  rest: ['resolveRestOrder', ['c', 'prov']],
  give_item: ['resolveSendItemOrder', ['c', 'ph', 'target', 'extra']],
  leave_army: ['resolveLeaveOrTransferArmyOrder', ['c', 'ph', 'target', 'extra', 'prov']],
  release: ['resolveReleaseHeroOrder', ['c', 'ph', 'prov', 'player']],
  disband_army: ['resolveDisbandArmyOrder', ['c', 'target', 'prov']],
  pickup_army: ['resolvePickUpArmyOrder', ['c', 'target', 'prov']],
  encounter: ['resolveEncounterCharacterOrder', ['c', 'ph', 'target', 'prov']],
  steal: ['resolveStealOrder', ['c', 'target', 'prov', 'player']],
  defend: ['resolveDefendOrder', ['c', 'o', 'ph', 'prov']],
  cast_spell: ['resolveCastSpellOrder', ['c', 'o', 'ph', 'target', 'extra', 'prov', 'player', 'itemCast']],
  sabotage: ['resolveSabotageOrder', ['c', 'target']],
  grand_heist: ['resolveGrandHeistOrder', ['c', 'ph', 'prov']],
  awaken_grove: ['resolveAwakenGroveOrder', ['c', 'ph', 'prov']],
  chart_unknown: ['resolveChartTheUnknownOrder', ['c', 'target', 'prov']],
  discover_ruin: ['resolveDiscoverLostRuinOrder', ['c', 'target', 'prov']],
  blockade: ['resolveBlockadeOrder', ['c', 'target']],
  research_breakthrough: ['resolveResearchBreakthroughOrder', ['c']],
  assassinate: ['resolveAssassinateOrder', ['c', 'target', 'prov']],
  vanish: ['resolveVanishOrder', ['c', 'prov']],
  challenge: ['resolveChallengeOrder', ['c', 'target', 'prov']],
  rampage: ['resolveRampageOrder', ['c', 'target', 'prov']],
  rain_of_arrows: ['resolveRainOfArrowsOrder', ['c', 'target', 'prov']],
  snipers_mark: ['resolveSnipersMarkOrder', ['c', 'target', 'prov']],
  feigned_retreat: ['resolveFeignedRetreatOrder', ['c', 'prov']],
  grand_stratagem: ['resolveGrandStratagemOrder', ['c', 'prov']],
  lightning_advance: ['resolveLightningAdvanceOrder', ['c', 'prov']],
  raid_coast: ['resolveRaidTheCoastOrder', ['c', 'prov']],
  wild_calling: ['resolveWildCallingOrder', ['c', 'ph', 'prov']],
  grand_design: ['resolveGrandDesignOrder', ['c', 'prov']],
  // a Forced March is handed over as a Move that may slip past a battle
  forced_march: ['resolveMoveOrder', ['c', 'ph', 'fmSlip', 'target', 'prov', 'player']],
};
const ORDER_FUNCTIONS = [...new Set(Object.values(HANDED).map(([f]) => f))];
interface Call {
  fn: string;
  args: unknown[];
}
/** Runs `body` with every order's own function replaced by a recorder (in the vm, for the body's length). */
function standIn(body: () => void): Call[] {
  const g = engine as unknown as Record<string, unknown>;
  const was = ORDER_FUNCTIONS.map((f) => [f, g[f]] as const);
  const calls: Call[] = [];
  for (const f of ORDER_FUNCTIONS)
    g[f] = (...args: unknown[]) => {
      calls.push({ fn: f, args });
    };
  try {
    body();
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
  return calls;
}
/** What processOrder should hand `action`'s function for `c`'s order `ord` in phase `ph`: the context, then each value. */
const handed = (
  b: Board,
  c: Character,
  ord: Order,
  ph: number,
  action: string,
  extra: Partial<Record<Arg, unknown>> = {},
) => {
  const [f, args] = must(HANDED[action], 'the order ' + action);
  const v: Record<Arg, unknown> = {
    c,
    o: ord,
    ph,
    target: ord.target || '',
    extra: ord.extra || '',
    prov: b.G.world.provinces[c.location],
    player: c.player == null ? undefined : b.G.players[c.player],
    fmSlip: action === 'forced_march',
    itemCast: null,
    action,
    ...extra,
  };
  return { fn: f, args: [b.tc, ...args.map((a) => v[a])] };
};

describe.each(ORDER_DISPATCH_CASES.filter(([, cases]) => cases.some((c) => !c.wholeTurnOnly)))(
  '%s, called directly: the whole-turn cases',
  (_, cases) => {
    test.each(cases.filter((c) => !c.wholeTurnOnly).map((c) => [c.name, c] as const))(
      '%s',
      (_name, c: OrderDispatchCase) => {
        const b = board(engine, world, 0);
        const s = stageCase(b, c);
        for (const i of c.bots ?? []) bot(b, i);
        b.G.turnOrders = Object.fromEntries(s.orders.map(([h, os]) => [h.id, os]));
        b.G.characters.filter((h) => h.player != null && h.alive).forEach((h) => setMovePool(b.tc, h));
        const phaseInitCompare = fn('phaseInitCompare');
        const { xp } = recording(() => {
          withCaseDice(engine, c.dice ?? LANDS, () => {
            for (let ph = 0; ph < 5; ph++) {
              snapshot(b);
              const inTurn = s.orders
                .map(([h]) => h)
                .sort(phaseInitCompare(b.tc, ph) as (a: Character, z: Character) => number);
              for (const h of inTurn) {
                const next = b.G.turnOrders[h.id]?.[ph];
                if (h.alive && next) dispatch(b, h, next as Order, ph);
                b.tc._logCtx = { charId: null, phase: null };
              }
            }
          });
        });
        const { got, want } = c.check({ world: b.G, lines: linesOf(b, s.hero), all: b.lines(), turn: b.G.turn, xp }, s);
        expect(got).toEqual(want);
      },
    );
  },
);

describe('what processOrder hands each order', () => {
  test.each(Object.entries(PHASE_ACTION_MAP))(
    'the order named "%s" reaches %s, once, with the values it reads',
    (name, action) => {
      const b = fresh();
      const c = at(b, ALL_NINE);
      const ord = o(name, 'T', 'E');
      const calls = standIn(() => {
        dispatch(b, c, ord, 2);
      });
      expect(calls).toEqual([handed(b, c, ord, 2, action)]);
    },
  );

  test('as the order form writes it, in capitals and with spaces about it, the name means the same', () => {
    const b = fresh();
    const c = at(b, ALL_NINE);
    const ord = o('  Rest & Heal ');
    expect(
      standIn(() => {
        dispatch(b, c, ord, 1);
      }),
    ).toEqual([handed(b, c, ord, 1, 'rest')]);
  });

  test.each([
    ['a name the game does not know', 'juggle'],
    ['an empty name', ''],
    ['no name at all', undefined],
  ])('%s is a Defend', (_, name) => {
    const b = fresh();
    const c = at(b);
    const ord = { ...o('x'), action: name } as unknown as Order;
    expect(
      standIn(() => {
        dispatch(b, c, ord);
      }),
    ).toEqual([handed(b, c, ord, 0, 'defend')]);
  });

  test("every order name the game knows has a function of its own: the switch's default is never reached", () => {
    const values = new Set(Object.values(PHASE_ACTION_MAP));
    expect([...values].filter((v) => !(v in HANDED))).toEqual([]);
  });

  test('a target or extra missing from the order is handed over as empty', () => {
    const b = fresh();
    const c = at(b);
    const ord = { action: 'give_item' } as unknown as Order;
    expect(
      standIn(() => {
        dispatch(b, c, ord);
      })[0]?.args.slice(3),
    ).toEqual(['', '']);
  });

  test('a wandering hero is handed no realm', () => {
    const b = fresh();
    const c = at(b, {}, { player: null });
    const calls = standIn(() => {
      dispatch(b, c, o('consecrate'));
    });
    expect(calls[0]?.args[3]).toBeUndefined();
  });

  test("his own lines are filed under him and the season: the log's context is his while the order runs", () => {
    const b = fresh();
    const c = at(b);
    let during: unknown = null;
    const g = engine as unknown as Record<string, unknown>;
    const was = g['resolveRestOrder'];
    g['resolveRestOrder'] = () => {
      during = JSON.parse(JSON.stringify(b.tc._logCtx));
    };
    try {
      dispatch(b, c, o('rest'), 3);
    } finally {
      g['resolveRestOrder'] = was;
    }
    // the phase loop clears it after each hero; processOrder leaves it as the order left it
    expect({ during, after: b.tc._logCtx }).toEqual({
      during: { charId: c.id, phase: 3 },
      after: { charId: c.id, phase: 3 },
    });
  });

  test('no hero, a fallen hero, or no order: nothing at all, and the log context as it was', () => {
    const b = fresh();
    const c = at(b);
    const dead = at(b);
    dead.alive = false;
    const before = { charId: 'before', phase: 'before' };
    b.tc._logCtx = before;
    const calls = standIn(() => {
      dispatch(b, null, o('rest'));
      dispatch(b, dead, o('rest'));
      dispatch(b, c, null);
    });
    expect({ calls, lines: b.lines().length, ctx: b.tc._logCtx }).toEqual({ calls: [], lines: 0, ctx: before });
  });
});

describe("superseded: a hero carried into another hero's assault this phase", () => {
  test('his order is not handed on; he is told under his name, and the log context is cleared', () => {
    const b = fresh();
    const lead = at(b);
    const c = at(b);
    const calls = standIn(() => {
      dispatch(b, c, { ...o('move', ring1(b, 0).id), _unifiedWith: lead.id } as Order, 1);
    });
    expect({
      calls,
      lines: linesOf(b, c).map((l) => [l.type, l.text, l.targets, l.phase, l.actor]),
      ctx: b.tc._logCtx,
    }).toEqual({
      calls: [],
      lines: [
        ['move', `${c.name}'s order superseded — they unified with ${lead.name}'s forces this phase.`, [0], 1, 0],
      ],
      ctx: { charId: null, phase: null },
    });
  });

  test('a leader no longer in the world is "another hero"; a mark of 0 is a hero too', () => {
    const b = fresh();
    const c = at(b);
    standIn(() => {
      dispatch(b, c, { ...o('rest'), _unifiedWith: 424242 } as Order);
      dispatch(b, c, { ...o('rest'), _unifiedWith: 0 } as Order);
    });
    expect(textOf(b, c)).toEqual([
      `${c.name}'s order superseded — they unified with another hero's forces this phase.`,
      `${c.name}'s order superseded — they unified with another hero's forces this phase.`,
    ]);
  });
});

describe('the battle lock: a Move or an Encounter out of a province whose battle is unresolved', () => {
  const locked = (c: Character, p: Province) =>
    `${c.name} is still locked in the unresolved battle for ${p.name} and cannot march away — the enemy is on the field and the fight must be seen through before the column can move on.`;
  /** A hero of realm 0 in the middle with two companies, the middle's battle flagged unresolved. */
  const standing = (b: Board, flag = true) => {
    const c = at(b);
    c.armies = companies(2);
    if (flag) b.X._battleUnresolved = true;
    return c;
  };
  const tryToLeave = (b: Board, c: Character, action = 'move') =>
    standIn(() => {
      dispatch(b, c, o(action, action === 'move' ? ring1(b, 0).id : 424242), 2);
    }).map((x) => x.fn);
  const enemy = (b: Board, s: Partial<HeroSpec> = {}) => {
    const e = at(b, {}, { player: 1, ...s });
    e.armies = companies(1);
    return e;
  };
  test.each([
    ['an enemy hero with companies', (b: Board) => enemy(b), true],
    ['a wandering hero with companies', (b: Board) => enemy(b, { player: null }), true],
    [
      "a fallen enemy's leaderless host",
      (b: Board) => Object.assign(enemy(b), { alive: false, _leaderlessHost: true }),
      true,
    ],
    ['a fallen enemy (no host left standing)', (b: Board) => Object.assign(enemy(b), { alive: false }), false],
    ['an enemy hero with no companies', (b: Board) => Object.assign(enemy(b), { armies: [] }), false],
    ['an enemy hero in another province', (b: Board) => enemy(b, { at: ring1(b, 2) }), false],
    ["an ally's hero with companies", (b: Board) => enemy(b, { player: 2 }), false],
    ['a hero of his own realm with companies', (b: Board) => enemy(b, { player: 0 }), false],
    ['nobody but himself', () => null, false],
  ] as const)('with %s on the field: held %s', (_, foe, held) => {
    for (const action of ['move', 'encounter', 'pursue']) {
      const b = fresh();
      const c = standing(b);
      foe(b);
      const calls = tryToLeave(b, c, action);
      expect({ action, calls, told: textOf(b, c).includes(locked(c, b.X)) }).toEqual({
        action,
        calls: held ? [] : [action === 'move' ? 'resolveMoveOrder' : 'resolveEncounterCharacterOrder'],
        told: held,
      });
    }
  });

  test.each([
    ['a neutral garrison on ground not his own', null, 1, true],
    ['a neutral garrison on ground another realm holds', 1, 1, true],
    ["a neutral garrison on his own realm's ground", 0, 1, false],
    ['no neutral garrison', null, 0, false],
  ] as const)('with %s: held %s', (_, owner, garrison, held) => {
    const b = fresh();
    const c = standing(b);
    if (owner != null) b.own(b.X, owner);
    b.X.neutralDefenders = companies(garrison);
    expect({ calls: tryToLeave(b, c), told: textOf(b, c).includes(locked(c, b.X)) }).toEqual({
      calls: held ? [] : ['resolveMoveOrder'],
      told: held,
    });
  });

  test('the line: under him and the season, to his realm, in the province, a pin notice; the log context cleared', () => {
    const b = fresh();
    const c = standing(b);
    enemy(b);
    tryToLeave(b, c);
    const l = must(linesOf(b, c)[0], 'the line');
    expect({
      line: [l.type, l.targets, l.provinceId, l.phase, l['pinNotice'], l.actor],
      ctx: b.tc._logCtx,
    }).toEqual({ line: ['combat', [0], b.X.id, 2, true, 0], ctx: { charId: null, phase: null } });
  });

  test('a stale flag (no armed foe), no flag, or a hero who leads no companies: not held', () => {
    const cases = [
      ['no flag', (b: Board) => (enemy(b), standing(b, false))],
      ['no companies', (b: Board) => (enemy(b), Object.assign(standing(b), { armies: [] }))],
      ['companies missing from the save', (b: Board) => (enemy(b), Object.assign(standing(b), { armies: undefined }))],
    ] as const;
    for (const [name, stage] of cases) {
      const b = fresh();
      const c = stage(b);
      expect({ name, calls: tryToLeave(b, c) }).toEqual({ name, calls: ['resolveMoveOrder'] });
    }
  });

  test.each(['rest', 'defend', 'explore', 'cast_spell', 'leave_army'])(
    'a %s in that province is carried out',
    (action) => {
      const b = fresh();
      const c = standing(b);
      enemy(b);
      expect(
        standIn(() => {
          dispatch(b, c, o(action));
        }).length,
      ).toBe(1);
    },
  );

  test('the foes are read from the world, a save missing their companies or the heroes included', () => {
    const b = fresh();
    const c = standing(b);
    const e = enemy(b);
    (e as { armies?: unknown }).armies = undefined;
    b.X.neutralDefenders = undefined as unknown as Province['neutralDefenders'];
    expect(tryToLeave(b, c)).toEqual(['resolveMoveOrder']);
    b.G.characters = undefined as unknown as Character[];
    expect(tryToLeave(b, c)).toEqual(['resolveMoveOrder']);
  });
});

describe('a charmed enemy hero: an enchantment, not an oath', () => {
  const charmed = (b: Board) => Object.assign(at(b, ALL_NINE), { _charmTempControl: true, _charmOriginalPlayer: 1 });
  const refusal = (c: Character, why: string) =>
    `${c.name} is held by an enchantment, not an oath — they will not ${why}. The order comes to nothing.`;
  const kinds: [string, string][] = [
    ['disband_army', 'break up companies that are not theirs to disband'],
    ...RITES.map((r): [string, string] => [r, 'perform the rites of a realm they do not serve']),
    ...MASTERIES.map((m): [string, string] => [m, 'spend their own mastery for a crown that merely holds their mind']),
  ];
  test.each(kinds)('%s: refused, not handed on, not spent, told to his realm', (action, why) => {
    const b = fresh();
    const c = charmed(b);
    const calls = standIn(() => {
      dispatch(b, c, o(action), 1);
    });
    expect({
      calls,
      lines: linesOf(b, c).map((l) => [l.type, l.text, l.targets, l.phase]),
      spent: c['_masteryOrderUsed'],
      ctx: b.tc._logCtx,
    }).toEqual({
      calls: [],
      lines: [['system', refusal(c, why), [0], 1]],
      spent: undefined,
      ctx: { charId: null, phase: null },
    });
  });

  test('every other order he carries out as any hero of the realm', () => {
    const b = fresh();
    const c = charmed(b);
    const others = Object.keys(HANDED).filter((a) => !kinds.some(([k]) => k === a) && a !== 'forced_march');
    const calls = standIn(() => {
      for (const a of others) dispatch(b, c, o(a));
    });
    expect(calls.length).toBe(others.length);
  });

  test('without the enchantment (a hero won over for good) he spends his masteries', () => {
    const b = fresh();
    const c = Object.assign(at(b, ALL_NINE), { _charmOriginalPlayer: 1 });
    expect(
      standIn(() => {
        dispatch(b, c, o('vanish'));
      }).map((x) => x.fn),
    ).toEqual(['resolveVanishOrder']);
  });

  test('a charmed hero who has already spent a mastery is told of the enchantment, not of the spent mastery', () => {
    const b = fresh();
    const c = charmed(b);
    c['_masteryOrderUsed'] = { vanish: b.G.turn };
    standIn(() => {
      dispatch(b, c, o('vanish'));
    });
    expect(textOf(b, c)).toEqual([refusal(c, 'spend their own mastery for a crown that merely holds their mind')]);
  });
});

describe('a mastery once a turn', () => {
  test.each(MASTERIES)('%s: charged to this turn and handed on; a second is refused, told, not handed on', (action) => {
    const b = fresh();
    const c = at(b, ALL_NINE);
    c['_masteryOrderUsed'] = { someOther: 1 };
    const first = standIn(() => {
      dispatch(b, c, o(action), 0);
    });
    const charged = JSON.parse(JSON.stringify(c['_masteryOrderUsed'])) as unknown;
    const second = standIn(() => {
      dispatch(b, c, o(action), 1);
    });
    expect({
      first: first.map((x) => x.fn),
      charged,
      second,
      told: linesOf(b, c).map((l) => [l.type, l.text, l.targets, l.phase]),
      ctx: b.tc._logCtx,
    }).toEqual({
      first: [must(HANDED[action], action)[0]],
      charged: { someOther: 1, [action]: b.G.turn },
      second: [],
      told: [
        [
          'system',
          `${c.name} has already used their ${must(MASTERY_LABEL[action], 'label')} mastery this turn — it may be commanded but once per turn.`,
          [0],
          1,
        ],
      ],
      ctx: { charId: null, phase: null },
    });
  });

  test('a hero with no record of masteries gets one; a charge from last turn is no bar', () => {
    const b = fresh();
    b.G.turn = 4;
    const c = at(b, ALL_NINE);
    const d = at(b, ALL_NINE);
    d['_masteryOrderUsed'] = { vanish: 3 };
    const calls = standIn(() => {
      dispatch(b, c, o('vanish'));
      dispatch(b, d, o('vanish'));
    });
    expect({ calls: calls.length, c: c['_masteryOrderUsed'], d: d['_masteryOrderUsed'] }).toEqual({
      calls: 2,
      c: { vanish: 4 },
      d: { vanish: 4 },
    });
  });

  test('an order that is not a mastery is not charged', () => {
    const b = fresh();
    const c = at(b, ALL_NINE);
    standIn(() => {
      for (const a of ['rest', 'move', 'cast_spell', 'consecrate']) dispatch(b, c, o(a));
    });
    expect(c['_masteryOrderUsed']).toBeUndefined();
  });

  test('every mastery has a name to be told by', () => {
    expect(MASTERIES.filter((m) => !MASTERY_LABEL[m])).toEqual([]);
  });
});

describe('Forced March', () => {
  test('at March 7: handed to the Move as a march that may slip past a battle, and charged', () => {
    const b = fresh();
    const c = at(b, { march: 7 });
    const ord = o('forced_march', ring1(b, 0).id);
    const calls = standIn(() => {
      dispatch(b, c, ord, 3);
    });
    expect({ calls, charged: c['_masteryOrderUsed'] }).toEqual({
      calls: [handed(b, c, ord, 3, 'forced_march')],
      charged: { forced_march: b.G.turn },
    });
  });

  test('a hero with no skills in the save: refused for want of March 7', () => {
    const b = fresh();
    const c = at(b);
    (c as { skills?: unknown }).skills = undefined;
    const calls = standIn(() => {
      dispatch(b, c, o('forced_march', ring1(b, 0).id));
    });
    expect({ calls, told: textOf(b, c) }).toEqual({
      calls: [],
      told: [`${c.name} lacks the March mastery (7) for a Forced March.`],
    });
  });

  test('a Move is not a Forced March: it does not slip', () => {
    const b = fresh();
    const c = at(b, { march: 9 });
    const calls = standIn(() => {
      dispatch(b, c, o('move', ring1(b, 0).id));
    });
    expect(calls[0]?.args[3]).toBe(false);
  });

  test('below March 7: refused, told, not handed on, the log context cleared, and the charge spent', () => {
    const b = fresh();
    const c = at(b, { march: 6 });
    const calls = standIn(() => {
      dispatch(b, c, o('forced_march', ring1(b, 0).id), 2);
    });
    expect({
      calls,
      told: linesOf(b, c).map((l) => [l.type, l.text, l.targets, l.phase]),
      ctx: b.tc._logCtx,
      charged: c['_masteryOrderUsed'],
    }).toEqual({
      calls: [],
      told: [['system', `${c.name} lacks the March mastery (7) for a Forced March.`, [0], 2]],
      ctx: { charId: null, phase: null },
      charged: { forced_march: b.G.turn },
    });
  });
});

describe("a spell item's Use Item", () => {
  const ITEM = 'Censer of Plenty';
  const spellItem = (b: Board) => {
    const json = vm.runInContext(
      `JSON.stringify(ALL_MAGIC_ITEMS_P.find(i=>i.name===${JSON.stringify(ITEM)}))`,
      b.engine,
    ) as string;
    return { ...(JSON.parse(json) as Record<string, unknown>), id: 7000 } as unknown as Record<string, unknown> & {
      effect: { spell: string };
    };
  };
  test.each([
    ['its id', '7000'],
    ['its id as a number in the save', 7000],
    ['its name', ITEM],
  ] as const)('named by %s: handed over as a cast of its spell', (_, target) => {
    const b = fresh();
    const c = at(b);
    const it = spellItem(b);
    c.items = [null as unknown as Record<string, unknown>, it];
    const ord = { ...o('use_item'), target } as unknown as Order;
    const calls = standIn(() => {
      dispatch(b, c, ord, 1);
    });
    expect(calls).toEqual([
      handed(b, c, ord, 1, 'cast_spell', { target, itemCast: { item: ITEM, spell: it.effect.spell } }),
    ]);
  });

  test.each([
    [
      'an item whose spell the game does not know',
      (it: Record<string, unknown>) => ({ ...it, effect: { stat: 'castSpell', spell: 'No Such Spell' } }),
    ],
    ['an item with another power', (it: Record<string, unknown>) => ({ ...it, effect: { stat: 'heal', bonus: 2 } })],
    ['an item with no power', (it: Record<string, unknown>) => ({ ...it, effect: undefined })],
    [
      'an item with another power that names a spell',
      (it: Record<string, unknown>) => ({ ...it, effect: { stat: 'ward', spell: 'Bless Province' } }),
    ],
  ] as const)('%s: used as an item', (_, change) => {
    const b = fresh();
    const c = at(b);
    c.items = [change(spellItem(b))];
    const ord = o('use_item', '7000');
    expect(
      standIn(() => {
        dispatch(b, c, ord);
      }),
    ).toEqual([handed(b, c, ord, 0, 'use_item')]);
  });

  test('an item he does not carry, or a hero with no items in the save: used as an item', () => {
    const b = fresh();
    const c = at(b);
    c.items = [spellItem(b)];
    const d = at(b);
    (d as { items?: unknown }).items = undefined;
    const calls = standIn(() => {
      dispatch(b, c, o('use_item', '7001'));
      dispatch(b, d, o('use_item', '7000'));
    });
    expect(calls.map((x) => x.fn)).toEqual(['resolveUseItemOrder', 'resolveUseItemOrder']);
  });
});

describe("a bot's Practice on a skill at 5, as the season began", () => {
  const practised = (calls: Call[]) => calls.map((x) => (x.fn === 'resolvePracticeSkillOrder' ? x.args[3] : x.fn));
  test("the skill is read as the season began (the turn's record of it), not as it stands now", () => {
    const b = fresh();
    bot(b);
    const c = at(b);
    c.skills = { melee: 4, tactical: 3, march: 1 };
    snapshot(b);
    c.skills['melee'] = 5; // risen since the season began: the season's record still says 4, so the order stands
    expect(
      practised(
        standIn(() => {
          dispatch(b, c, o('practice', 'melee'));
        }),
      ),
    ).toEqual(['melee']);
    delete (b.G as unknown as Record<string, unknown>)['_phaseSkillSnapshot'];
    expect(
      practised(
        standIn(() => {
          dispatch(b, c, o('practice', 'melee'));
        }),
      ),
    ).toEqual(['tactical']);
  });

  test("with no record of the season's skills, as they stand", () => {
    const b = fresh();
    bot(b);
    const c = at(b);
    c.skills = { melee: 5, tactical: 3, march: 1 };
    expect(
      practised(
        standIn(() => {
          dispatch(b, c, o('practice', 'melee'));
        }),
      ),
    ).toEqual(['tactical']);
    c.skills = undefined as unknown as Record<string, number>;
    expect(
      practised(
        standIn(() => {
          dispatch(b, c, o('practice', 'melee'));
        }),
      ),
    ).toEqual(['melee']);
  });

  test("a comrade's level is read as the season began too", () => {
    const b = fresh();
    bot(b);
    const c = at(b);
    c.skills = { melee: 5, tactical: 3, march: 1 };
    const t = at(b);
    t.skills = { melee: 2 };
    b.G.turnOrders = { [t.id]: [o('practice', 'melee')] };
    snapshot(b);
    t.skills['melee'] = 5; // risen since; the season's record still says 2, so he is still a pupil
    expect(
      practised(
        standIn(() => {
          dispatch(b, c, o('practice', 'melee'));
        }),
      ),
    ).toEqual(['melee']);
  });

  test('a comrade with another order that names the skill (a Rest left with its target) is no pupil', () => {
    const b = fresh();
    bot(b);
    const c = at(b);
    c.skills = { melee: 5, tactical: 3, march: 1 };
    const t = at(b);
    t.skills = { melee: 2 };
    b.G.turnOrders = { [t.id]: [o('rest', 'melee')] };
    expect(
      practised(
        standIn(() => {
          dispatch(b, c, o('practice', 'melee'));
        }),
      ),
    ).toEqual(['tactical']);
  });

  test('a fallen comrade, or one with no orders, is no pupil', () => {
    const b = fresh();
    bot(b);
    const c = at(b);
    c.skills = { melee: 5, tactical: 3, march: 1 };
    const t = at(b);
    t.skills = { melee: 2 };
    t.alive = false;
    const u = at(b);
    u.skills = { melee: 2 };
    b.G.turnOrders = { [t.id]: [o('practice', 'melee')] };
    expect(
      practised(
        standIn(() => {
          dispatch(b, c, o('practice', 'melee'));
        }),
      ),
    ).toEqual(['tactical']);
  });

  test('the order is copied, not changed: the turn keeps the order as the bot wrote it', () => {
    const b = fresh();
    bot(b);
    const c = at(b);
    c.skills = { melee: 5, tactical: 3, march: 1 };
    const ord = o('practice', 'melee');
    b.G.turnOrders = { [c.id]: [ord] };
    standIn(() => {
      dispatch(b, c, ord);
    });
    expect(ord.target).toBe('melee');
  });

  test('Naval at 5, leading a fleet drilling can still improve: he keeps to it', () => {
    const b = fresh();
    bot(b);
    const c = at(b);
    c.skills = { naval: 5, melee: 3 };
    c.armies = companies(1, must(SEA_TYPES[0], 'a ship'), 'Average');
    expect(
      practised(
        standIn(() => {
          dispatch(b, c, o('practice', 'naval'));
        }),
      ),
    ).toEqual(['naval']);
  });

  test("a player's hero, a wandering hero, or a Practice naming no skill: not changed", () => {
    for (const [player, target] of [
      [1, 'melee'],
      [null, 'melee'],
      [0, ''],
    ] as const) {
      const b = fresh();
      bot(b);
      const c = at(b, {}, { player });
      c.skills = { melee: 5, tactical: 3, march: 1 };
      expect({
        player,
        target,
        got: practised(
          standIn(() => {
            dispatch(b, c, o('practice', target));
          }),
        ),
      }).toEqual({
        player,
        target,
        got: [target],
      });
    }
  });

  test('every skill he has, and Melee, Tactical and March, at 5: a Defend', () => {
    const b = fresh();
    bot(b);
    const c = at(b);
    c.skills = { melee: 5, tactical: 6, march: 9, spy: 5 };
    expect(
      practised(
        standIn(() => {
          dispatch(b, c, o('practice', 'melee'));
        }),
      ),
    ).toEqual(['resolveDefendOrder']);
  });

  test("property: a bot's Practice is handed on with a skill below 5, or as a Defend when he has none", () => {
    const SKILLS = ['melee', 'tactical', 'march', 'naval', 'spy', 'sage'];
    fc.assert(
      fc.property(
        fc.dictionary(fc.constantFrom(...SKILLS), fc.integer({ min: 0, max: 9 }), { minKeys: 1 }),
        fc.constantFrom(...SKILLS),
        (skills, asked) => {
          const b = fresh();
          bot(b);
          const c = at(b);
          c.skills = { ...skills };
          const calls = standIn(() => {
            dispatch(b, c, o('practice', asked));
          });
          const lvl = (s: string) => skills[s] ?? 0;
          const [call] = calls;
          const canTrain =
            Object.keys(skills).some((s) => lvl(s) < 5) || ['melee', 'tactical', 'march'].some((s) => lvl(s) < 5);
          const skill = call?.fn === 'resolvePracticeSkillOrder' ? String(call.args[3]) : null;
          const below5 = skill != null && lvl(skill) < 5 ? skill : 'none below 5';
          expect({ calls: calls.length, fn: call?.fn, skill }).toEqual(
            lvl(asked) < 5
              ? { calls: 1, fn: 'resolvePracticeSkillOrder', skill: asked }
              : canTrain
                ? { calls: 1, fn: 'resolvePracticeSkillOrder', skill: below5 }
                : { calls: 1, fn: 'resolveDefendOrder', skill: null },
          );
        },
      ),
      { seed: Number(process.env['KC_SEED']) >>> 0 || 1, numRuns: 300 },
    );
  });
});

describe("a bot's Search on a save missing his HP", () => {
  const goesIn = (b: Board, c: Character, extra: Record<string, unknown>) =>
    standIn(() => {
      dispatch(b, c, { ...o('search', 0), ...extra });
    }).map((x) => x.fn);
  test.each([
    ['no HP recorded: at full health', undefined, 20, ['resolveSearchLairOrder']],
    ['no maximum recorded: out of 20 (12 is 60%)', 12, undefined, ['resolveSearchLairOrder']],
    ['no maximum recorded: out of 20 (11 is below 60%)', 11, undefined, ['resolveRestOrder']],
    ['neither recorded: at full health', undefined, undefined, ['resolveSearchLairOrder']],
  ] as const)('%s', (_, hp, maxHp, want) => {
    const b = fresh();
    const c = at(b);
    Object.assign(c, { hp, maxHp });
    expect(goesIn(b, c, { _botMinHp: 0.6 })).toEqual(want);
  });

  test('talk heard at the lower band, his HP read the same way', () => {
    const b = fresh();
    const c = at(b);
    Object.assign(c, { hp: undefined, maxHp: undefined });
    b.X['features'] = [{ name: 'Den', cleared: true, _rumourOdds: { 0: { charId: c.id, turn: b.G.turn, band: 2 } } }];
    expect(goesIn(b, c, { _botIfRumour: 3, _botIfRumourLow: 2 })).toEqual(['resolveSearchLairOrder']);
    Object.assign(c, { hp: 19 });
    expect(goesIn(b, c, { _botIfRumour: 3, _botIfRumourLow: 2 })).toEqual(['resolveSearchLairOrder']);
    Object.assign(c, { hp: 18 }); // 18 of 20 is below 95%
    expect(goesIn(b, c, { _botIfRumour: 3, _botIfRumourLow: 2 })).toEqual(['resolveRestOrder']);
  });

  test('a province with no lairs in the save, or a lair with no talk recorded: he leaves it', () => {
    const b = fresh();
    const c = at(b);
    b.X['features'] = undefined;
    expect(goesIn(b, c, { _botIfRumour: 3 })).toEqual(['resolveRestOrder']);
    b.X['features'] = [{ name: 'Den', cleared: true }];
    expect(goesIn(b, c, { _botIfRumour: 3 })).toEqual(['resolveRestOrder']);
  });

  test("a wandering hero with a bot's search: carried out as given", () => {
    const b = fresh();
    const c = at(b, {}, { player: null });
    c.hp = 2;
    expect(goesIn(b, c, { _botMinHp: 0.6, _botIfRumour: 3 })).toEqual(['resolveSearchLairOrder']);
  });
});

describe('properties', () => {
  const REFUSALS = [
    'order superseded',
    'is still locked in the unresolved battle',
    'is held by an enchantment',
    'has already used their',
    'lacks the March mastery (7) for a Forced March',
  ];
  test('at most one order function runs for any order, and none after a refusal, which clears the log context', () => {
    const names = [...Object.keys(PHASE_ACTION_MAP), 'juggle'];
    fc.assert(
      fc.property(
        fc.record({
          name: fc.constantFrom(...names),
          march: fc.integer({ min: 0, max: 9 }),
          charmed: fc.boolean(),
          spent: fc.boolean(),
          locked: fc.boolean(),
          unified: fc.boolean(),
          ph: fc.integer({ min: 0, max: 4 }),
        }),
        (r) => {
          const b = fresh();
          const c = at(b, { ...ALL_NINE, march: r.march });
          c.armies = companies(1);
          if (r.charmed) Object.assign(c, { _charmTempControl: true, _charmOriginalPlayer: 1 });
          const action = PHASE_ACTION_MAP[r.name] ?? 'defend';
          if (r.spent) c['_masteryOrderUsed'] = { [action]: b.G.turn };
          if (r.locked) {
            b.X._battleUnresolved = true;
            at(b, {}, { player: 1 }).armies = companies(1);
          }
          const ord = { ...o(r.name, 424242), ...(r.unified ? { _unifiedWith: 1 } : {}) } as Order;
          const calls = standIn(() => {
            dispatch(b, c, ord, r.ph);
          });
          const refused = textOf(b, c).some((t) => REFUSALS.some((x) => t.includes(x)));
          expect({ refused, calls: calls.length, ctx: refused ? b.tc._logCtx : null }).toEqual({
            refused,
            calls: refused ? 0 : 1,
            ctx: refused ? { charId: null, phase: null } : null,
          });
        },
      ),
      { seed: Number(process.env['KC_SEED']) >>> 0 || 1, numRuns: 500 },
    );
  });

  test('a hero runs each mastery at most once a turn, however his five seasons are given', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...MASTERIES), { minLength: 5, maxLength: 5 }), (seasons) => {
        const b = fresh();
        const c = at(b, ALL_NINE);
        const calls = standIn(() => {
          seasons.forEach((a, ph) => {
            dispatch(b, c, o(a, 424242), ph);
          });
        });
        const ran = calls.map((x) => x.fn);
        const already = textOf(b, c).filter((t) => t.includes('has already used their')).length;
        const distinct = new Set(seasons).size;
        expect({ ran: ran.length, once: new Set(ran).size, already }).toEqual({
          ran: distinct,
          once: distinct,
          already: 5 - distinct,
        });
      }),
      { seed: Number(process.env['KC_SEED']) >>> 0 || 1, numRuns: 300 },
    );
  });
});
