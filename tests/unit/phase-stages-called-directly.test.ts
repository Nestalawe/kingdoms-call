// The four stages of a phase (plan P1-08k1: src/engine/turn/, lifted out of resolveTurn's phase loop), called directly
// in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/phase-stages-in-a-whole-turn.test.ts plays through a whole turn (lib/phase-stage-cases.ts), here played
// through the four stages one phase at a time, as the loop calls them; then, with the helpers each stage calls stood in
// (each replaced in the vm by a recorder for the test's length), what each stage hands them and in what order; then
// what the cases leave to a direct call: Herbal Lore's sums, who stands where and every hero's skills as the phase
// begins, the marks cleared, phantom companies stripped; the lock's conditions one by one, the order written for a
// cancelled march, a Defend's watch from the season's start; the Defend step's place among the actors, a chase, a
// coward, a fallen hero; skill rises told, a watch ended, a fallen commander's host kept while its battle lasts.
// Properties (fast-check): Herbal Lore mends at least 1 and never past the maximum; the Defend step runs once a phase,
// before the first march or Defend and after every order before it, and every other actor's order is handed over once,
// in turn; every march cancelled in the second stage leaves a Defend in its place.
// Level 1: four functions, called with what the phase loop hands them.
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls, withCaseDice } from '../lib/espionage-order-cases.ts';
import { companies } from '../lib/item-and-army-order-cases.ts';
import {
  board,
  hero,
  must,
  order,
  type Board,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
} from '../lib/middle-of-a-bot-world.ts';
import {
  LANDS,
  PHASE_STAGE_CASES,
  SEASONS,
  herbalLore,
  stageCase,
  type PhaseStageCase,
} from '../lib/phase-stage-cases.ts';
import { plainRealms } from '../lib/recruit-hire-and-realm-works-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const START = 'startPhaseHealingSnapshotsAndStalledBattles';
const REACT = 'pinAndReactToPhaseIntents';
const ORDERS = 'resolvePhaseOrdersInTwoTiersAroundTheDefendStep';
const END = 'endPhaseSkillRisesFallenCommandersAndProvinceMemory';
const start = fn(START);
const react = fn(REACT);
const orders = fn(ORDERS);
const end = fn(END);
const buildPhaseIntents = fn('buildPhaseIntents');
const setMovePool = fn('setMovePool');
const warFrontThreats = fn('warFrontThreats');

interface Intent {
  c: Character;
  id: number;
  player: number | null;
  order: Order | null;
  action: string;
  leadsArmy: boolean;
  fromId: number;
  toId: number | null;
  dest: unknown;
  cancelled: boolean;
  cancelReason: string | null;
}
type Intents = Map<number, Intent>;

const fresh = () => {
  const b = board(engine, world, 0);
  b.tc._logCtx = { charId: null, phase: null }; // as the loop leaves it between phases
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return b;
};
const at = (b: Board, skills: Record<string, number> = {}, s: Partial<HeroSpec> = {}) =>
  hero(b, { player: 0, at: b.X, skills: { melee: 2, tactical: 2, march: 1, ...skills }, ...s });
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const G = (b: Board) => b.G as unknown as Record<string, unknown> & Board['G'];
const tc = (b: Board) => b.tc as unknown as Record<string, unknown> & Board['tc'];
const textOf = (b: Board) => b.lines().map((l) => l.text);
/** The context, with the phase being resolved set to `ph`, as the loop sets it before the stages. */
const inPhase = (b: Board, ph: number) => {
  tc(b)._currentPhase = ph;
  return b.tc;
};
/** The orders given, by hero, five each (Rest after the ones given). */
const give = (b: Board, ...os: [Character, Order[]][]) => {
  b.G.turnOrders = Object.fromEntries(
    os.map(([h, list]) => [h.id, [...list, ...Array.from({ length: 5 - list.length }, () => order('rest'))]]),
  );
};
/** What the turn sets up before its first phase that the stages read: every hero's move points, and the hosts on a
 *  war front as the turn begins (resolveTurn's own lines, before the loop). */
const setUp = (b: Board) => {
  b.G.characters.filter((h) => h.player != null && h.alive).forEach((h) => setMovePool(b.tc, h));
  const atStart = tc(b)['_warFrontAtStart'] as Map<number, number>;
  (warFrontThreats(b.tc) as { c: Character; prov: { id: number; _battleUnresolved?: boolean } }[]).forEach(
    ({ c, prov }) => {
      if (!prov._battleUnresolved) atStart.set(c.id, prov.id);
    },
  );
  const provs = tc(b)['_warFrontProvs'] as Set<number>;
  atStart.forEach((p) => provs.add(p));
};
/** One phase, as the loop plays it: the phase set, where every hero stands, the four stages, the intents between. */
const playPhase = (b: Board, ph: number) => {
  tc(b)._currentPhase = ph;
  const startLoc: Record<number, number> = {};
  b.G.characters.forEach((c) => {
    if (c.alive) startLoc[c.id] = c.location;
  });
  start(inPhase(b, ph), ph);
  const intents = buildPhaseIntents(b.tc, ph);
  react(inPhase(b, ph), ph, intents);
  orders(inPhase(b, ph), ph, intents);
  end(inPhase(b, ph), ph, startLoc);
};

describe.each(PHASE_STAGE_CASES.filter(([, cases]) => cases.some((c) => !c.wholeTurnOnly)))(
  '%s, through the four stages one phase at a time',
  (_, cases) => {
    test.each(cases.filter((c) => !c.wholeTurnOnly).map((c) => [c.name, c] as const))(
      '%s',
      (_name, c: PhaseStageCase) => {
        const b = board(engine, world, 0);
        const s = stageCase(b, c);
        give(b, ...s.orders);
        setUp(b);
        const { xp } = recording(() => {
          withCaseDice(engine, c.dice ?? LANDS, () => {
            for (let ph = 0; ph < 5; ph++) playPhase(b, ph);
          });
        });
        const lines = b.lines();
        const { got, want } = c.check(
          { world: b.G, lines: lines.filter((l: Line) => l.charId === s.hero.id), all: lines, turn: b.G.turn, xp },
          s,
        );
        expect(got).toEqual(want);
      },
    );
  },
);

// ── What each stage hands the helpers it calls ───────────────────────────────────────────────────────────────────
interface Call {
  fn: string;
  args: unknown[];
  /** The log's context and the battle series' province as the call was made. */
  logCtx: unknown;
  series: unknown;
}
/** Runs `body` with each of `names` replaced by a recorder (in the vm, for the body's length); `returns` gives what a
 *  recorder hands back, by name. */
function standIn(b: Board, names: string[], body: () => void, returns: Record<string, Fn> = {}): Call[] {
  const g = engine as unknown as Record<string, unknown>;
  const was = names.map((f) => [f, g[f]] as const);
  const calls: Call[] = [];
  for (const f of names)
    g[f] = (...args: unknown[]) => {
      calls.push({ fn: f, args, logCtx: { ...(b.tc._logCtx as object) }, series: tc(b)['_combatSkillProv'] });
      return returns[f]?.(...args);
    };
  try {
    body();
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
  return calls;
}
const named = (calls: Call[]) => calls.map((c) => c.fn);
const NO_CTX = { charId: null, phase: null };

describe('the start of the phase: what it calls', () => {
  const HELPERS = [
    'flagEnemyStandoffs',
    'resolveStalledBattles',
    'settleRalliedGarrisons',
    'settleStrandedAtSea',
    'spreadPlagues',
  ];
  test.each([0, 1, 4])(
    'in season %i: the stand-offs, the stalled battles, the rallied garrisons, the stranded, the Plague, in that order',
    (ph) => {
      const b = fresh();
      at(b);
      tc(b)['_combatSkillProv'] = 7;
      b.tc._logCtx = { charId: 9, phase: 3 };
      const calls = standIn(b, HELPERS, () => start(inPhase(b, ph), ph));
      expect(calls.map((c) => [c.fn, ...c.args])).toEqual([
        ['flagEnemyStandoffs', b.tc, ph === 0 ? tc(b)['_warFrontProvs'] : null],
        ['resolveStalledBattles', b.tc, ph],
        ['settleRalliedGarrisons', b.tc],
        ['settleStrandedAtSea', b.tc, ph],
        ['spreadPlagues', b.tc, ph],
      ]);
      // the battles' context is cleared before the Plague spreads, and stays cleared
      expect(calls.at(-1)?.logCtx).toEqual(NO_CTX);
      expect(calls.at(-1)?.series).toBeNull();
      expect(b.tc._logCtx).toEqual(NO_CTX);
    },
  );

  test("the season's line opens the phase, before the stalled battles", () => {
    const b = fresh();
    at(b);
    let before: string[] = [];
    standIn(b, HELPERS, () => start(inPhase(b, 3), 3), {
      resolveStalledBattles: () => {
        before = textOf(b);
      },
    });
    expect(before).toEqual([`— ${must(SEASONS[3], 'Fall')} —`]);
    expect(b.lines()[0]).toMatchObject({ type: 'system', phase: 3, charId: null, targets: [], public: false });
  });
});

// ── The start of the phase: what it does itself ─────────────────────────────────────────────────────────────────
const quiet = [
  'flagEnemyStandoffs',
  'resolveStalledBattles',
  'settleRalliedGarrisons',
  'settleStrandedAtSea',
  'spreadPlagues',
];
/** The first stage, its helpers stood in: only its own statements run. */
const startOnly = (b: Board, ph: number) => standIn(b, quiet, () => start(inPhase(b, ph), ph));
const herbalist = (b: Board, i = 0) => {
  must(b.G.players[i], 'realm')['discoveries'] = [{ id: 'sd29' }];
};
const woundedNow = (b: Board, hp: number, max: number, atStart: number | null, s: Partial<HeroSpec> = {}) => {
  const h = at(b, {}, { hp: max, ...s });
  h.hp = hp;
  h['_hpAtPhaseStart'] = atStart;
  return h;
};

describe('Herbal Lore, as the phase opens', () => {
  test.each([
    // [hp, max, atStart, healed]: 60% of the damage (the data file's figure), rounded, at least 1, to the maximum
    [10, 20, 20, 6],
    [19, 20, 20, 1],
    [18, 20, 30, 2],
    [15, 20, 18, 2],
    [14, 20, 19, 3],
    [1, 30, 30, 17],
  ])('%i of %i HP, %i as last season began: +%i', (hp, max, atStart, healed) => {
    const b = fresh();
    herbalist(b);
    const h = woundedNow(b, hp, max, atStart);
    startOnly(b, 2);
    expect(h.hp).toBe(hp + healed);
    expect(h['_hpAtPhaseStart']).toBe(hp + healed);
    const l = b.lines().find((x) => x.text.startsWith('🌿'));
    expect(l).toMatchObject({
      type: 'system',
      text: herbalLore(h, atStart - hp, healed, hp + healed, max),
      actor: 0,
      targets: [0],
      charId: h.id,
      phase: 2,
      provinceId: b.X.id,
    });
  });

  test("the line is his and the phase's, whatever the log's context was left on", () => {
    const b = fresh();
    herbalist(b);
    const h = woundedNow(b, 10, 20, 20);
    b.tc._logCtx = { charId: 77, phase: 1 };
    startOnly(b, 3);
    expect(b.lines().find((l) => l.text.startsWith('🌿'))).toMatchObject({ charId: h.id, phase: 3 });
  });

  test('the line comes before any other of the phase but its opening', () => {
    const b = fresh();
    herbalist(b);
    woundedNow(b, 10, 20, 20);
    startOnly(b, 0);
    expect(textOf(b)[1]?.startsWith('🌿 Herbal Lore')).toBe(true);
  });

  test.each([
    ['a realm without it', (b: Board) => woundedNow(b, 10, 20, 20, { player: 1 })],
    ['a wandering hero', (b: Board) => woundedNow(b, 10, 20, 20, { player: null })],
    [
      'a fallen hero',
      (b: Board) => {
        const h = woundedNow(b, 10, 20, 20);
        h.alive = false;
        return h;
      },
    ],
    [
      'a hero with no HP recorded',
      (b: Board) => {
        const h = woundedNow(b, 10, 20, 20);
        delete (h as Partial<Character>).hp;
        return h;
      },
    ],
    ['no HP recorded as last season began', (b: Board) => woundedNow(b, 10, 20, null)],
    ['no weaker than last season', (b: Board) => woundedNow(b, 12, 20, 12)],
    ['stronger than last season', (b: Board) => woundedNow(b, 14, 20, 12)],
    ['at his maximum', (b: Board) => woundedNow(b, 20, 20, 25)],
    ['above his maximum', (b: Board) => woundedNow(b, 21, 20, 25)],
  ])('nothing for %s', (_, stage) => {
    const b = fresh();
    herbalist(b);
    const h = stage(b);
    const hp = h.hp;
    startOnly(b, 1);
    expect(h.hp).toBe(hp);
    expect(textOf(b).filter((t) => t.startsWith('🌿'))).toEqual([]);
  });

  test('a hero with no maximum recorded counts 20 as his maximum', () => {
    const b = fresh();
    herbalist(b);
    const h = woundedNow(b, 18, 20, 30);
    delete (h as Partial<Character>).maxHp;
    startOnly(b, 0);
    expect(h.hp).toBe(20);
    expect(textOf(b)).toContain(herbalLore(h, 12, 2, 20, 20));
  });

  test("every hero's HP is recorded as the phase opens, for the next; a fallen hero's or one with none as none", () => {
    const b = fresh();
    const a = woundedNow(b, 13, 20, null);
    const fallen = woundedNow(b, 4, 20, 9);
    fallen.alive = false;
    const none = woundedNow(b, 10, 20, 9, { player: null });
    delete (none as Partial<Character>).hp;
    const wanderer = woundedNow(b, 7, 20, 3, { player: null });
    startOnly(b, 0);
    expect([a, fallen, none, wanderer].map((h) => h['_hpAtPhaseStart'])).toEqual([13, null, null, 7]);
  });

  test('property: it mends at least 1, never past the maximum, 60% of the damage rounded otherwise', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 40 }),
        fc.integer({ min: 0, max: 40 }),
        fc.integer({ min: 0, max: 60 }),
        (max, hp0, atStart) => {
          const hp = Math.min(hp0, max + 5);
          const b = fresh();
          herbalist(b);
          const h = woundedNow(b, hp, max, atStart);
          startOnly(b, 0);
          const wounded = hp < atStart && hp < max;
          const want = wounded ? Math.min(Math.max(1, Math.round((atStart - hp) * 0.6)), max - hp) : 0;
          expect([h.hp - hp, !wounded || h.hp <= max]).toEqual([want, true]);
        },
      ),
      { seed: Number(process.env['KC_SEED']) >>> 0 || 1, numRuns: 200 },
    );
  });
});

describe('who stands where, and every skill, as the phase opens', () => {
  test("presence: each province with a living realm hero in it, and the realms there; a wanderer's, a fallen hero's or one nowhere don't count", () => {
    const b = fresh();
    at(b);
    at(b, {}, { player: 1 });
    at(b, {}, { player: 1 });
    at(b, {}, { player: 2, at: ring1(b, 0) });
    at(b, {}, { player: null, at: ring1(b, 1) });
    const fallen = at(b, {}, { at: ring1(b, 2) });
    fallen.alive = false;
    const nowhere = at(b, {}, { at: ring1(b, 3) });
    (nowhere as unknown as { location: null }).location = null;
    startOnly(b, 3);
    const presence = (tc(b)['presenceByPhase'] as Map<number, Set<number>>[])[3];
    expect([...must(presence, 'the snapshot')].map(([p, s]) => [p, [...s].sort()])).toEqual([
      [b.X.id, [0, 1]],
      [ring1(b, 0).id, [2]],
    ]);
  });

  test("each phase's presence is its own: an earlier phase's is kept", () => {
    const b = fresh();
    const h = at(b);
    startOnly(b, 0);
    h.location = ring1(b, 0).id;
    startOnly(b, 1);
    const presence = tc(b)['presenceByPhase'] as Map<number, Set<number>>[];
    expect(presence.map((m) => [...m.keys()])).toEqual([[b.X.id], [ring1(b, 0).id]]);
  });

  test("the skills as the phase opens: a copy of every hero's, fallen or not; none for a hero with no skills", () => {
    const b = fresh();
    const a = at(b, { sage: 3 });
    const fallen = at(b, { spy: 4 });
    fallen.alive = false;
    const bare = at(b);
    delete (bare as Partial<Character>).skills;
    G(b)['_phaseSkillSnapshot'] = { 1: { melee: 9 } };
    startOnly(b, 2);
    const snap = G(b)['_phaseSkillSnapshot'] as Record<number, Record<string, number>>;
    expect(snap).toEqual({ [a.id]: { ...a.skills }, [fallen.id]: { ...fallen.skills }, [bare.id]: {} });
    expect(snap[a.id]).not.toBe(a.skills);
    a.skills['sage'] = 4;
    expect(snap[a.id]?.['sage']).toBe(3);
  });

  test('the marks of a season gone are cleared, for every hero, fallen or not; the provinces entered this phase start afresh', () => {
    const b = fresh();
    const a = at(b);
    const fallen = at(b);
    fallen.alive = false;
    for (const h of [a, fallen])
      Object.assign(h, {
        _encounteredThisPhase: 5,
        _amphibiousAssault: true,
        _foughtStalledBattlePhase: 0,
        _enteredProvThisPhase: 3,
        _kept: 1,
      });
    tc(b)['enteredThisPhase'] = { 3: true };
    startOnly(b, 0);
    for (const h of [a, fallen])
      expect(
        Object.keys(h).filter(
          (k) => k.endsWith('ThisPhase') || k.startsWith('_amph') || k.startsWith('_fought') || k === '_kept',
        ),
      ).toEqual(['_kept']);
    expect(tc(b)['enteredThisPhase']).toEqual({});
  });

  test('phantom companies are stripped from every hero, fallen or not; real ones stay, in order', () => {
    const b = fresh();
    const a = at(b);
    a.armies = [
      ...companies(1, 'Men-at-Arms', 'Average', 'A'),
      { ...companies(1)[0], _phantom: true } as never,
      ...companies(1, 'Men-at-Arms', 'Average', 'B'),
    ];
    const fallen = at(b);
    fallen.alive = false;
    fallen.armies = [{ ...companies(1)[0], _phantom: true } as never];
    const none = at(b);
    delete (none as Partial<Character>).armies;
    startOnly(b, 0);
    expect(a.armies.map((u) => u.unitName)).toEqual(['A c0', 'B c0']);
    expect(fallen.armies).toEqual([]);
    expect(none.armies).toBeUndefined();
  });

  test('a hero hired this phase is told he waits, once, filed under the phase; not a wanderer, a fallen hero, or one hired in another phase', () => {
    const b = fresh();
    const hired = at(b);
    hired['hiredInPhase'] = 2;
    const other = at(b);
    other['hiredInPhase'] = 1;
    const wanderer = at(b, {}, { player: null });
    wanderer['hiredInPhase'] = 2;
    const fallen = at(b);
    fallen['hiredInPhase'] = 2;
    fallen.alive = false;
    startOnly(b, 2);
    const told = b.lines().filter((l) => l.text.includes('was hired this phase'));
    expect(told).toEqual([
      expect.objectContaining({
        type: 'hire',
        text: `${hired.name} was hired this phase and will be ready to act from the next phase.`,
        actor: 0,
        targets: [0],
        phase: 2,
        charId: null,
      }) as unknown as Line,
    ]);
  });
});

// ── Intents and reactions ───────────────────────────────────────────────────────────────────────────────────────
const intentsFor = (b: Board, ph: number) => buildPhaseIntents(b.tc, ph) as Intents;
const intentOf = (intents: Intents, c: Character) => must(intents.get(c.id), 'his intent');
const REACT_HELPERS = ['applyMoveInterlocks', 'runReinforcementArrivals'];
/** The second stage with the interlocks and the reinforcements stood in: only its own statements run. */
const reactOnly = (b: Board, ph: number, intents: Intents) =>
  standIn(b, REACT_HELPERS, () => react(inPhase(b, ph), ph, intents));
/** A column of realm 0 in the middle, ordered `action` this phase (2), leading `n` companies. */
const column = (b: Board, action: Order, n = 2) => {
  const h = at(b);
  h.armies = companies(n);
  give(b, [h, [order('rest'), order('rest'), action]]);
  setMovePool(b.tc, h);
  return h;
};
const lockedLine = (c: Character, p: { name: string }) =>
  `${c.name} is still locked in the unresolved battle for ${p.name} and cannot march away — the fight must be seen through before they can move on.`;
const foughtLine = (c: Character) =>
  `${c.name} has already fought a battle this phase and cannot march on to start another — one battle per phase.`;

describe('intents and reactions: what it calls', () => {
  test('the interlocks, then the reinforcements, each handed the phase and the intents', () => {
    const b = fresh();
    const h = column(b, order('move', ring1(b, 0).id));
    const intents = intentsFor(b, 2);
    const calls = standIn(b, REACT_HELPERS, () => react(inPhase(b, 2), 2, intents));
    expect(calls.map((c) => [c.fn, ...c.args])).toEqual([
      ['applyMoveInterlocks', b.tc, 2, intents],
      ['runReinforcementArrivals', b.tc, 2, intents],
    ]);
    expect(intentOf(intents, h).cancelled).toBe(false);
  });
});

describe('the battle lock, as the phase opens', () => {
  const contested = (b: Board) => {
    b.X._battleUnresolved = true;
  };
  test.each([
    ['a Move', order('move', 1)],
    ['an Encounter', order('encounter', 1)],
    ['an old Pursue', order('pursue', 1)],
  ])('%s out of a province still contested: held, told, and his order a Defend', (_, ord) => {
    const b = fresh();
    contested(b);
    const h = column(b, ord);
    const intents = intentsFor(b, 2);
    reactOnly(b, 2, intents);
    expect(intentOf(intents, h)).toMatchObject({
      cancelled: true,
      cancelReason: 'battleLocked',
      action: 'defend',
      toId: null,
      dest: null,
    });
    expect(b.lines()).toEqual([
      expect.objectContaining({
        type: 'combat',
        text: lockedLine(h, b.X),
        actor: 0,
        targets: [0],
        provinceId: b.X.id,
        public: false,
        charId: h.id,
        phase: 2,
        pinNotice: true,
      }) as unknown as Line,
    ]);
    expect(b.G.turnOrders[h.id]?.[2]).toEqual({
      action: 'defend',
      target: '',
      extra: '',
      desc: 'Locked in ongoing battle',
      _pinned: true,
    });
  });

  test("the line is his and the phase's, whatever the log's context was left on", () => {
    const b = fresh();
    contested(b);
    const h = column(b, order('move', 1));
    const intents = intentsFor(b, 2);
    b.tc._logCtx = { charId: 77, phase: 1 };
    reactOnly(b, 2, intents);
    expect(b.lines()[0]).toMatchObject({ charId: h.id, phase: 2 });
  });

  test('a column that fought again this phase, its province no longer contested: held, with its own line', () => {
    const b = fresh();
    const h = column(b, order('move', 1));
    h._foughtStalledBattlePhase = 2;
    const intents = intentsFor(b, 2);
    reactOnly(b, 2, intents);
    expect(textOf(b)).toEqual([foughtLine(h)]);
    expect(b.G.turnOrders[h.id]?.[2]).toMatchObject({ desc: 'Locked in ongoing battle', _pinned: true });
  });

  test('both at once: the contested line', () => {
    const b = fresh();
    contested(b);
    const h = column(b, order('move', 1));
    h._foughtStalledBattlePhase = 2;
    reactOnly(b, 2, intentsFor(b, 2));
    expect(textOf(b)).toEqual([lockedLine(h, b.X)]);
  });

  test.each([
    ['a hero with no companies', (b: Board) => column(b, order('move', 1), 0)],
    ['a Rest', (b: Board) => column(b, order('rest'))],
    ['a Defend', (b: Board) => column(b, order('defend'))],
    [
      'a column that fought in an earlier phase',
      (b: Board) => {
        const h = column(b, order('move', 1));
        h._foughtStalledBattlePhase = 1;
        b.X._battleUnresolved = false;
        return h;
      },
    ],
  ])('not held: %s', (_, stage) => {
    const b = fresh();
    const h = stage(b);
    if (b.X._battleUnresolved !== false) b.X._battleUnresolved = true;
    if (h._foughtStalledBattlePhase === 1) b.X._battleUnresolved = false;
    const intents = intentsFor(b, 2);
    reactOnly(b, 2, intents);
    expect(intentOf(intents, h).cancelled).toBe(false);
    expect(textOf(b).filter((t) => t.includes('cannot march'))).toEqual([]);
  });

  test('a march already cancelled is not held again: no line', () => {
    const b = fresh();
    contested(b);
    const h = column(b, order('move', 1));
    const intents = intentsFor(b, 2);
    Object.assign(intentOf(intents, h), { cancelled: true, cancelReason: 'other' });
    reactOnly(b, 2, intents);
    expect(textOf(b)).toEqual([]);
    expect(b.G.turnOrders[h.id]?.[2]).toMatchObject({ desc: 'Defend (held in place)', _pinned: true });
  });

  test('a province not on the map holds nobody', () => {
    const b = fresh();
    const h = column(b, order('move', 1));
    const intents = intentsFor(b, 2);
    intentOf(intents, h).fromId = 9999;
    reactOnly(b, 2, intents);
    expect(intentOf(intents, h).cancelled).toBe(false);
  });
});

describe('a march cancelled by the interlocks or a reinforcement becomes a Defend', () => {
  test.each([
    ['held by the interlocks', 'pinned', 'Defend (held in place)'],
    ['arrived early', 'reinforced', 'Defend (arrived early)'],
  ])('%s: his order this phase a pinned Defend, the intent a Defend going nowhere', (_, reason, desc) => {
    const b = fresh();
    const h = column(b, order('move', ring1(b, 0).id));
    const other = column(b, order('move', ring1(b, 1).id));
    give(
      b,
      [h, [order('rest'), order('rest'), order('move', ring1(b, 0).id)]],
      [other, [order('rest'), order('rest'), order('move', ring1(b, 1).id)]],
    );
    const intents = intentsFor(b, 2);
    const helper = reason === 'pinned' ? 'applyMoveInterlocks' : 'runReinforcementArrivals';
    standIn(b, REACT_HELPERS, () => react(inPhase(b, 2), 2, intents), {
      [helper]: () => {
        Object.assign(intentOf(intents, h), { cancelled: true, cancelReason: reason });
      },
    });
    expect(b.G.turnOrders[h.id]?.[2]).toEqual({ action: 'defend', target: '', extra: '', desc, _pinned: true });
    expect(intentOf(intents, h)).toMatchObject({ action: 'defend', toId: null, dest: null });
    // the others' orders, and his other phases', are as they were
    expect(b.G.turnOrders[h.id]?.[3]).toMatchObject({ action: 'rest' });
    expect(b.G.turnOrders[other.id]?.[2]).toMatchObject({ action: 'move' });
    expect(intentOf(intents, other)).toMatchObject({ action: 'move', toId: ring1(b, 1).id });
  });

  test('a hero with no orders at all gets a row of his own for the Defend', () => {
    const b = fresh();
    const h = column(b, order('move', ring1(b, 0).id));
    const intents = intentsFor(b, 2);
    b.G.turnOrders = {};
    standIn(b, REACT_HELPERS, () => react(inPhase(b, 2), 2, intents), {
      applyMoveInterlocks: () => {
        Object.assign(intentOf(intents, h), { cancelled: true, cancelReason: 'pinned' });
      },
    });
    expect(b.G.turnOrders[h.id]).toEqual([
      null,
      null,
      { action: 'defend', target: '', extra: '', desc: 'Defend (held in place)', _pinned: true },
      null,
      null,
    ]);
  });

  test("a reinforcement's row too, and a cancelled march for another reason is left to the first rewrite", () => {
    const b = fresh();
    const h = column(b, order('move', ring1(b, 0).id));
    const intents = intentsFor(b, 2);
    b.G.turnOrders = {};
    standIn(b, REACT_HELPERS, () => react(inPhase(b, 2), 2, intents), {
      runReinforcementArrivals: () => {
        Object.assign(intentOf(intents, h), { cancelled: true, cancelReason: 'reinforced' });
      },
    });
    expect(b.G.turnOrders[h.id]?.[2]).toMatchObject({ desc: 'Defend (arrived early)' });
  });
});

describe("a Defend given this phase keeps watch from the phase's start", () => {
  const defending = (b: Board) => column(b, order('defend'));
  test('a watch set where he stands, this phase, ready; a reaction already spent is forgotten', () => {
    const b = fresh();
    const h = defending(b);
    h['_defendReactedPhase'] = 1;
    reactOnly(b, 2, intentsFor(b, 2));
    expect(h._defend).toEqual({ centre: b.X.id, active: true, setPhase: 2, preActivated: true, carried: false });
    expect(h['_defendReactedPhase']).toBeUndefined();
  });

  test('a watch kept from an earlier phase continues: carried', () => {
    const b = fresh();
    const h = defending(b);
    h._defend = { active: true, centre: ring1(b, 0).id, setPhase: 0 } as never;
    reactOnly(b, 2, intentsFor(b, 2));
    expect(h._defend).toEqual({ centre: b.X.id, active: true, setPhase: 2, preActivated: true, carried: true });
  });

  test.each([
    [
      'a watch already set this phase',
      (b: Board, h: Character) => {
        h._defend = { active: true, centre: 7, setPhase: 2 } as never;
        h['_defendReactedPhase'] = 2;
      },
    ],
    [
      'a hero on a live chase',
      (b: Board, h: Character) => {
        h._pursuit = { active: true, targetId: 1, setPhase: 1 };
      },
    ],
    [
      'a hero whose watch has met its battle this phase',
      (b: Board, h: Character) => {
        h['_defendSpent'] = { turn: b.G.turn, ph: 2 };
      },
    ],
    [
      'a pinned Defend',
      (b: Board, h: Character) => {
        (b.G.turnOrders[h.id]?.[2] as Record<string, unknown>)['_pinned'] = true;
      },
    ],
    [
      'a fallen hero',
      (b: Board, h: Character) => {
        h.alive = false;
      },
    ],
    [
      'a wandering hero',
      (b: Board, h: Character) => {
        h.player = null;
      },
    ],
  ])('not for %s', (_, change) => {
    const b = fresh();
    const h = defending(b);
    const intents = intentsFor(b, 2);
    change(b, h);
    const before = JSON.stringify(h._defend ?? null);
    reactOnly(b, 2, intents);
    expect(JSON.stringify(h._defend ?? null)).toBe(before);
  });

  test('not for a hero with no order this phase (a Defend in name only), nor an order cancelled', () => {
    const b = fresh();
    const h = defending(b);
    const g = defending(b);
    give(b, [g, [order('rest'), order('rest'), order('defend')]]);
    const intents = intentsFor(b, 2);
    intentOf(intents, h).order = null;
    intentOf(intents, g).cancelled = true;
    reactOnly(b, 2, intents);
    expect([h._defend, g._defend]).toEqual([undefined, undefined]);
  });

  test.each([
    ['in an earlier phase', (b: Board) => ({ turn: b.G.turn, ph: 1 })],
    ['in an earlier turn', (b: Board) => ({ turn: b.G.turn - 1, ph: 2 })],
  ])('a watch that met its battle %s is set again', (_, spent) => {
    const b = fresh();
    const h = defending(b);
    h['_defendSpent'] = spent(b);
    reactOnly(b, 2, intentsFor(b, 2));
    expect(h._defend).toMatchObject({ active: true, setPhase: 2 });
  });
});

describe('property: every march cancelled in the second stage leaves a pinned Defend in its place', () => {
  test('whatever the interlocks and reinforcements cancel', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kind: fc.constantFrom('move', 'rest', 'defend', 'encounter'),
            cancel: fc.constantFrom(null, 'pinned', 'reinforced'),
          }),
          {
            minLength: 1,
            maxLength: 6,
          },
        ),
        fc.boolean(),
        (spec, contested) => {
          const b = fresh();
          b.X._battleUnresolved = contested;
          const hs = spec.map(({ kind }) => {
            const h = at(b);
            h.armies = companies(1);
            return [h, kind] as const;
          });
          give(
            b,
            ...hs.map(([h, kind]): [Character, Order[]] => [
              h,
              [order('rest'), order('rest'), order(kind, ring1(b, 0).id)],
            ]),
          );
          hs.forEach(([h]) => setMovePool(b.tc, h));
          const intents = intentsFor(b, 2);
          standIn(b, REACT_HELPERS, () => react(inPhase(b, 2), 2, intents), {
            applyMoveInterlocks: () => {
              hs.forEach(([h], i) => {
                if (spec[i]?.cancel === 'pinned')
                  Object.assign(intentOf(intents, h), { cancelled: true, cancelReason: 'pinned' });
              });
            },
            runReinforcementArrivals: () => {
              hs.forEach(([h], i) => {
                const it = intentOf(intents, h);
                if (spec[i]?.cancel === 'reinforced' && !it.cancelled)
                  Object.assign(it, { cancelled: true, cancelReason: 'reinforced' });
              });
            },
          });
          const got = hs.map(([h]) => {
            const it = intentOf(intents, h);
            const o = b.G.turnOrders[h.id]?.[2] as Record<string, unknown> | undefined;
            return [it.cancelled, it.cancelled ? it.action : '-', o?.['action'], !!o?.['_pinned']];
          });
          expect(got).toEqual(
            hs.map(([h, kind]) => {
              const it = intentOf(intents, h);
              return [it.cancelled, it.cancelled ? 'defend' : '-', it.cancelled ? 'defend' : kind, it.cancelled];
            }),
          );
        },
      ),
      { seed: Number(process.env['KC_SEED']) >>> 0 || 1, numRuns: 200 },
    );
  });
});

// ── The orders in two tiers ─────────────────────────────────────────────────────────────────────────────────────
const ORDER_HELPERS = [
  'orderPhaseActors',
  'runDefendReactions',
  'resolveUnitGainInProvince',
  'advancePursuit',
  'processOrder',
  'settleStrandedAtSea',
  'resolveWarFronts',
  'runDefendMaterializedReactions',
  'runDefendAmbush',
  'reconcileDefendRideOuts',
];
/** The third stage with every helper stood in, the actors in the order given. */
const ordersWith = (
  b: Board,
  ph: number,
  actors: Character[],
  intents: Intents = new Map(),
  more: Record<string, Fn> = {},
) => standIn(b, ORDER_HELPERS, () => orders(inPhase(b, ph), ph, intents), { orderPhaseActors: () => actors, ...more });
/** Heroes of realm 0 in the middle, each with the order given in every phase. */
const actorsWith = (b: Board, ...kinds: (string | null)[]) => {
  const hs = kinds.map(() => at(b));
  b.G.turnOrders = Object.fromEntries(
    hs.map((h, i) => {
      const k = kinds[i];
      return [h.id, Array.from({ length: 5 }, () => (k == null ? null : order(k)))];
    }),
  );
  return hs;
};

describe('the orders in two tiers: what it calls', () => {
  test("the actors in the phase's order, each order handed over in turn, the stranded settled after each; the Defend step before the first march; then the watches' answers, the ambushes, the ride-outs explained", () => {
    const b = fresh();
    const [r, m, d] = actorsWith(b, 'rest', 'move', 'defend');
    const intents = intentsFor(b, 2);
    const calls = ordersWith(b, 2, [must(r, 'r'), must(m, 'm'), must(d, 'd')], intents);
    expect(calls.map((c) => [c.fn, ...c.args])).toEqual([
      ['orderPhaseActors', b.tc, 2, intents],
      ['processOrder', b.tc, r, b.G.turnOrders[must(r, 'r').id]?.[2], 2],
      ['settleStrandedAtSea', b.tc, 2],
      ['runDefendReactions', b.tc, 2, intents],
      ['processOrder', b.tc, m, b.G.turnOrders[must(m, 'm').id]?.[2], 2],
      ['settleStrandedAtSea', b.tc, 2],
      ['processOrder', b.tc, d, b.G.turnOrders[must(d, 'd').id]?.[2], 2],
      ['settleStrandedAtSea', b.tc, 2],
      ['runDefendMaterializedReactions', b.tc, 2],
      ['runDefendAmbush', b.tc, 2],
      ['reconcileDefendRideOuts', b.tc, 2],
    ]);
  });

  test('in Spring, the war fronts after the Defend step and before the watches answer', () => {
    const b = fresh();
    const [r] = actorsWith(b, 'rest');
    const calls = ordersWith(b, 0, [must(r, 'r')]);
    expect(named(calls)).toEqual([
      'orderPhaseActors',
      'processOrder',
      'settleStrandedAtSea',
      'runDefendReactions',
      'resolveWarFronts',
      'runDefendMaterializedReactions',
      'runDefendAmbush',
      'reconcileDefendRideOuts',
    ]);
    expect(calls[4]?.args).toEqual([b.tc, 0]);
  });

  test.each([
    ['a Move', 'move'],
    ['an Encounter', 'encounter'],
    ['an old Pursue', 'pursue'],
    ['a Defend', 'defend'],
    ['a Defend named as the order form writes it', 'Defend'],
  ])('the Defend step comes before %s, once', (_, kind) => {
    const b = fresh();
    const [a, z] = actorsWith(b, 'rest', kind, 'move');
    const calls = ordersWith(b, 1, [must(a, 'a'), must(z, 'z'), must(z, 'z')]);
    expect(named(calls).filter((f) => f === 'runDefendReactions' || f === 'processOrder')).toEqual([
      'processOrder',
      'runDefendReactions',
      'processOrder',
      'processOrder',
    ]);
  });

  test('before a hero on a live chase, even with an order that does not march', () => {
    const b = fresh();
    const [a, z] = actorsWith(b, 'rest', 'rest');
    must(z, 'z')._pursuit = { active: true, targetId: 1, setPhase: 2 };
    const calls = ordersWith(b, 2, [must(a, 'a'), must(z, 'z')]);
    expect(named(calls).slice(1, 6)).toEqual([
      'processOrder',
      'settleStrandedAtSea',
      'runDefendReactions',
      'processOrder',
      'settleStrandedAtSea',
    ]);
  });

  test('with no march, chase or Defend, after every order: still once', () => {
    const b = fresh();
    const [a, z] = actorsWith(b, 'rest', 'explore');
    const calls = ordersWith(b, 3, [must(a, 'a'), must(z, 'z')]);
    expect(named(calls)).toEqual([
      'orderPhaseActors',
      'processOrder',
      'settleStrandedAtSea',
      'processOrder',
      'settleStrandedAtSea',
      'runDefendReactions',
      'runDefendMaterializedReactions',
      'runDefendAmbush',
      'reconcileDefendRideOuts',
    ]);
  });

  test('with nobody to act at all, the Defend step still comes', () => {
    const b = fresh();
    expect(named(ordersWith(b, 3, []))).toEqual([
      'orderPhaseActors',
      'runDefendReactions',
      'runDefendMaterializedReactions',
      'runDefendAmbush',
      'reconcileDefendRideOuts',
    ]);
  });

  test("the Defend step's own context: the battle series and the log cleared before the general rides out, and after", () => {
    const b = fresh();
    const [a] = actorsWith(b, 'move');
    tc(b)['_combatSkillProv'] = 4;
    b.tc._logCtx = { charId: 5, phase: 1 };
    let after: unknown[] = [];
    const calls = ordersWith(b, 2, [must(a, 'a')], new Map(), {
      runDefendReactions: () => {
        tc(b)['_combatSkillProv'] = 8;
        b.tc._logCtx = { charId: 6, phase: 2 };
      },
      processOrder: () => {
        after = [tc(b)['_combatSkillProv']];
      },
    });
    const ride = must(
      calls.find((c) => c.fn === 'runDefendReactions'),
      'the Defend step',
    );
    expect([ride.logCtx, ride.series]).toEqual([NO_CTX, null]);
    expect(after).toEqual([null]);
  });

  test("each host raised is settled with no battle series running, and the next order is handed over with the log's context cleared", () => {
    const b = fresh();
    const [a] = actorsWith(b, 'move');
    const one = at(b, {}, { player: 1 });
    one.armies = companies(1);
    const two = at(b, {}, { player: 1 });
    two.armies = companies(1);
    const calls = ordersWith(b, 2, [must(a, 'a')], new Map(), {
      runDefendReactions: () => {
        tc(b)['_unitGainQueue'] = [
          { c: one, prov: b.X },
          { c: two, prov: b.X },
        ];
        tc(b)['_combatSkillProv'] = 8;
      },
      resolveUnitGainInProvince: () => {
        tc(b)['_combatSkillProv'] = 9;
      },
    });
    expect(calls.filter((c) => c.fn === 'resolveUnitGainInProvince').map((c) => c.series)).toEqual([null, null]);
    const handed = must(
      calls.find((c) => c.fn === 'processOrder'),
      'his order',
    );
    expect([handed.logCtx, handed.series]).toEqual([NO_CTX, null]);
  });

  test("in Spring, the war fronts come with no battle series running after the Defend step's last host", () => {
    const b = fresh();
    const [r] = actorsWith(b, 'rest');
    const raiser = at(b, {}, { player: 1 });
    raiser.armies = companies(1);
    const calls = ordersWith(b, 0, [must(r, 'r')], new Map(), {
      processOrder: () => {
        tc(b)['_unitGainQueue'] = [{ c: raiser, prov: b.X }];
      },
      resolveUnitGainInProvince: () => {
        tc(b)['_combatSkillProv'] = 9;
        b.tc._logCtx = { charId: raiser.id, phase: 0 };
      },
    });
    const fronts = must(
      calls.find((c) => c.fn === 'resolveWarFronts'),
      'the war fronts',
    );
    expect([fronts.series, fronts.logCtx]).toEqual([null, NO_CTX]);
  });

  test('the hosts raised in a watch are settled at the Defend step, after the ride-outs, each under its own hero, in the order raised; a host gone is skipped', () => {
    const b = fresh();
    const [a] = actorsWith(b, 'move');
    const raiser = at(b, {}, { player: 1 });
    raiser.armies = companies(1);
    const gone = at(b, {}, { player: 1 });
    gone.armies = [];
    const moved = at(b, {}, { player: 1 });
    moved.armies = companies(1);
    const fallen = at(b, {}, { player: 1 });
    fallen.armies = companies(1);
    const second = at(b, {}, { player: 2, at: ring1(b, 0) });
    second.armies = companies(1);
    const calls = ordersWith(b, 2, [must(a, 'a')], new Map(), {
      runDefendReactions: () => {
        tc(b)['_unitGainQueue'] = [
          { c: raiser, prov: b.X },
          { c: gone, prov: b.X },
          { c: moved, prov: ring1(b, 2) },
          { c: fallen, prov: b.X },
          { c: second, prov: ring1(b, 0) },
        ];
        fallen.alive = false;
      },
    });
    const settled = calls.filter((c) => c.fn === 'resolveUnitGainInProvince');
    expect(settled.map((c) => [c.args, c.logCtx, c.series])).toEqual([
      [[b.tc, raiser, b.X, 2], { charId: raiser.id, phase: 2 }, null],
      [[b.tc, second, ring1(b, 0), 2], { charId: second.id, phase: 2 }, null],
    ]);
    expect(named(calls).indexOf('resolveUnitGainInProvince')).toBeLessThan(named(calls).indexOf('processOrder'));
    expect(tc(b)['_unitGainQueue']).toEqual([]);
  });

  test('the Defend step opens the phase closed: a host raised after it is not held back', () => {
    const b = fresh();
    const [a, z] = actorsWith(b, 'move', 'rest');
    const open: unknown[] = [];
    ordersWith(b, 2, [must(a, 'a'), must(z, 'z')], new Map(), {
      processOrder: () => {
        open.push(tc(b)['_tier0Open']);
      },
    });
    expect(open).toEqual([false, false]);
  });

  test('before the Defend step, the orders run with the step open, and the queue empty at the start', () => {
    const b = fresh();
    const [a] = actorsWith(b, 'rest');
    tc(b)['_unitGainQueue'] = [{ c: a, prov: b.X }];
    tc(b)['_tier0Open'] = false;
    const seen: unknown[] = [];
    ordersWith(b, 2, [must(a, 'a')], new Map(), {
      processOrder: () => {
        seen.push(tc(b)['_tier0Open'], (tc(b)['_unitGainQueue'] as unknown[]).length);
      },
    });
    expect(seen).toEqual([true, 0]);
  });
});

describe('the orders in two tiers: each actor', () => {
  test('a hero on a live chase set in an earlier phase: the chase is advanced under his name, the stranded settled, and his order not handed over', () => {
    const b = fresh();
    const [h] = actorsWith(b, 'explore');
    must(h, 'h')._pursuit = { active: true, targetId: 1, setPhase: 1 };
    const calls = ordersWith(b, 2, [must(h, 'h')]);
    const chase = must(
      calls.find((c) => c.fn === 'advancePursuit'),
      'the chase',
    );
    expect([chase.args, chase.logCtx]).toEqual([[b.tc, h, 2], { charId: must(h, 'h').id, phase: 2 }]);
    expect(named(calls).slice(named(calls).indexOf('advancePursuit'))).toEqual([
      'advancePursuit',
      'settleStrandedAtSea',
      'runDefendMaterializedReactions',
      'runDefendAmbush',
      'reconcileDefendRideOuts',
    ]);
    expect(b.tc._logCtx).toEqual(NO_CTX);
  });

  test.each([
    ['set this phase', { active: true, targetId: 1, setPhase: 2 }],
    ['over', { active: false, targetId: 1, setPhase: 1 }],
  ])('a chase %s: his order is handed over', (_, chase) => {
    const b = fresh();
    const [h] = actorsWith(b, 'explore');
    must(h, 'h')._pursuit = chase;
    expect(named(ordersWith(b, 2, [must(h, 'h')]))).toContain('processOrder');
  });

  test("a chase over doesn't open the Defend step: his order that doesn't march resolves before it", () => {
    const b = fresh();
    const [h] = actorsWith(b, 'explore');
    must(h, 'h')._pursuit = { active: false, targetId: 1, setPhase: 1 };
    expect(named(ordersWith(b, 2, [must(h, 'h')])).slice(1, 4)).toEqual([
      'processOrder',
      'settleStrandedAtSea',
      'runDefendReactions',
    ]);
  });

  test('a fallen hero on a chase is not advanced: his orders go unanswered', () => {
    const b = fresh();
    const [h] = actorsWith(b, 'explore');
    Object.assign(must(h, 'h'), {
      alive: false,
      killedThisTurn: true,
      _pursuit: { active: true, targetId: 1, setPhase: 1 },
    });
    const calls = ordersWith(b, 2, [must(h, 'h')]);
    expect(named(calls)).not.toContain('advancePursuit');
    expect(textOf(b)).toEqual([
      `${must(h, 'h').name} has fallen — their remaining orders for this turn go unanswered.`,
    ]);
  });

  test.each([
    ['a coward who begged for mercy', (b: Board, h: Character) => (h['_mercyFledTurn'] = b.G.turn)],
    ['a hero who has fallen', (b: Board, h: Character) => Object.assign(h, { alive: false, killedThisTurn: true })],
  ])("after %s, the next hero's order is handed over with the log's context cleared", (_, change) => {
    const b = fresh();
    const [h, next] = actorsWith(b, 'explore', 'explore');
    change(b, must(h, 'h'));
    b.tc._logCtx = { charId: 3, phase: 2 };
    const calls = ordersWith(b, 2, [must(h, 'h'), must(next, 'next')]);
    const handed = calls.filter((c) => c.fn === 'processOrder');
    expect(handed.map((c) => [c.args[1], c.logCtx])).toEqual([[next, NO_CTX]]);
  });

  test("a coward who begged for mercy this turn does nothing, and the log's context is cleared; one from an earlier turn acts", () => {
    const b = fresh();
    const [h, old] = actorsWith(b, 'explore', 'explore');
    must(h, 'h')['_mercyFledTurn'] = b.G.turn;
    must(old, 'old')['_mercyFledTurn'] = b.G.turn - 1;
    b.tc._logCtx = { charId: 3, phase: 2 };
    const handed: unknown[] = [];
    ordersWith(b, 2, [must(h, 'h'), must(old, 'old')], new Map(), {
      processOrder: (_t, c) => {
        handed.push(c);
      },
      runDefendReactions: () => {
        handed.push(JSON.stringify(b.tc._logCtx));
      },
    });
    expect(handed).toEqual([old, JSON.stringify(NO_CTX)]);
  });

  test('a fallen hero with an order: told once, under his name, in the phase; not again; not one fallen in an earlier turn; not one with no order', () => {
    const b = fresh();
    const [h, earlier, none] = actorsWith(b, 'explore', 'explore', null);
    Object.assign(must(h, 'h'), { alive: false, killedThisTurn: true });
    Object.assign(must(earlier, 'e'), { alive: false });
    Object.assign(must(none, 'n'), { alive: false, killedThisTurn: true });
    b.tc._logCtx = { charId: 3, phase: 1 };
    const calls = ordersWith(b, 2, [must(h, 'h'), must(earlier, 'e'), must(none, 'n')]);
    b.G.turnOrders[must(h, 'h').id] = [null, null, null, order('rest'), null];
    ordersWith(b, 3, [must(h, 'h')]);
    expect(named(calls)).not.toContain('processOrder');
    expect(b.lines()).toEqual([
      expect.objectContaining({
        type: 'system',
        text: `${must(h, 'h').name} has fallen — their remaining orders for this turn go unanswered.`,
        actor: 0,
        targets: [0],
        charId: must(h, 'h').id,
        phase: 2,
      }) as unknown as Line,
    ]);
    expect(b.tc._logCtx).toEqual(NO_CTX);
  });

  test("each order handed over with the battle series cleared, and the log's context cleared after it", () => {
    const b = fresh();
    const [a, z] = actorsWith(b, 'rest', 'rest');
    const seen: unknown[] = [];
    ordersWith(b, 2, [must(a, 'a'), must(z, 'z')], new Map(), {
      processOrder: () => {
        seen.push(tc(b)['_combatSkillProv']);
        tc(b)['_combatSkillProv'] = 9;
        b.tc._logCtx = { charId: 2, phase: 2 };
      },
      settleStrandedAtSea: () => {
        seen.push(JSON.stringify(b.tc._logCtx));
      },
    });
    expect(seen).toEqual([null, JSON.stringify(NO_CTX), null, JSON.stringify(NO_CTX)]);
  });

  test('a hero with no order this phase: nothing handed over', () => {
    const b = fresh();
    const [a] = actorsWith(b, null);
    expect(named(ordersWith(b, 2, [must(a, 'a')]))).not.toContain('processOrder');
    b.G.turnOrders = {};
    expect(named(ordersWith(b, 2, [must(a, 'a')]))).not.toContain('processOrder');
  });

  test('property: the Defend step runs once, before the first march, chase or Defend (no order is a Defend) and after every order before it; every other order handed over once, in turn', () => {
    const KINDS = ['rest', 'explore', 'move', 'defend', 'encounter', 'chase', 'coward', 'none'] as const;
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...KINDS), { maxLength: 8 }),
        fc.integer({ min: 0, max: 4 }),
        (kinds, ph) => {
          const b = fresh();
          const hs = kinds.map((k) => {
            const h = at(b);
            b.G.turnOrders[h.id] = [null, null, null, null, null];
            const row = must(b.G.turnOrders[h.id], 'row');
            if (k === 'chase') {
              h._pursuit = { active: true, targetId: 1, setPhase: ph - 1 };
              row[ph] = order('rest');
            } else if (k === 'coward') {
              h['_mercyFledTurn'] = b.G.turn;
              row[ph] = order('move');
            } else if (k !== 'none') row[ph] = order(k);
            return h;
          });
          const calls = ordersWith(b, ph, hs);
          const seq = calls.filter((c) => ['runDefendReactions', 'processOrder', 'advancePursuit'].includes(c.fn));
          expect(seq.filter((c) => c.fn === 'runDefendReactions')).toHaveLength(1);
          const step = seq.findIndex((c) => c.fn === 'runDefendReactions');
          // a march, a chase or a Defend opens the step: a coward's Move too (the step is checked before his mercy),
          // and no order at all, which is a Defend
          const first = kinds.findIndex((k) => !['rest', 'explore'].includes(k));
          const before = hs
            .slice(0, first < 0 ? hs.length : first)
            .filter((_, i) => ['rest', 'explore'].includes(must(kinds[i], 'k')));
          expect(seq.slice(0, step).map((c) => c.args[1])).toEqual(before);
          const handed = seq.filter((c) => c.fn === 'processOrder').map((c) => c.args[1]);
          expect(handed).toEqual(
            hs.filter((_, i) => ['rest', 'explore', 'move', 'defend', 'encounter'].includes(must(kinds[i], 'k'))),
          );
          expect(seq.filter((c) => c.fn === 'advancePursuit').map((c) => c.args[1])).toEqual(
            hs.filter((_, i) => kinds[i] === 'chase'),
          );
        },
      ),
      { seed: Number(process.env['KC_SEED']) >>> 0 || 1, numRuns: 300 },
    );
  });
});

// ── The end of the phase ────────────────────────────────────────────────────────────────────────────────────────
const END_HELPERS = [
  'resolveAllPendingSkillGains',
  'writeDeferredSkillLines',
  'generateIntrusionNotifications',
  'settleStrandedAtSea',
  'disperseDeadCharArmies',
  'reconcileProvinceCharacters',
  'noteSilentHeroes',
  'updateProvinceMemory',
];
const endWith = (b: Board, ph: number, startLoc: Record<number, number> = {}, more: Record<string, Fn> = {}) =>
  standIn(b, END_HELPERS, () => end(inPhase(b, ph), ph, startLoc), more);

describe('the end of the phase: what it calls', () => {
  test("the skill rises settled, the intrusions told, the stranded settled, the map's lists rebuilt, silent heroes told, each realm's view taken, in that order", () => {
    const b = fresh();
    at(b);
    const startLoc = { 1: 2 };
    const calls = endWith(b, 3, startLoc);
    expect(calls.map((c) => [c.fn, ...c.args])).toEqual([
      ['resolveAllPendingSkillGains', b.tc],
      ['generateIntrusionNotifications', b.tc, 3],
      ['settleStrandedAtSea', b.tc, 3],
      ['reconcileProvinceCharacters', b.tc],
      ['noteSilentHeroes', b.tc, 3, startLoc],
      ['updateProvinceMemory', b.tc, 3],
    ]);
  });

  test('the skill-rise lines held back are written after the rises are settled, then forgotten', () => {
    const b = fresh();
    const held = [{ a: 1 }];
    tc(b)['_deferredSkillLogs'] = held;
    const calls = endWith(
      b,
      1,
      {},
      {
        resolveAllPendingSkillGains: () => {
          (tc(b)['_deferredSkillLogs'] as unknown[]).push({ b: 2 });
        },
      },
    );
    expect(calls.slice(0, 2).map((c) => [c.fn, ...c.args])).toEqual([
      ['resolveAllPendingSkillGains', b.tc],
      ['writeDeferredSkillLines', b.tc, held],
    ]);
    expect(held).toEqual([{ a: 1 }, { b: 2 }]);
    expect(tc(b)['_deferredSkillLogs']).toEqual([]);
  });

  test('the provinces entered this phase are forgotten after each realm’s view is taken', () => {
    const b = fresh();
    tc(b)['enteredThisPhase'] = { 4: true };
    let seen: unknown = null;
    endWith(
      b,
      1,
      {},
      {
        updateProvinceMemory: () => {
          seen = { ...(tc(b)['enteredThisPhase'] as object) };
        },
      },
    );
    expect([seen, tc(b)['enteredThisPhase']]).toEqual([{ 4: true }, {}]);
  });
});

describe('the end of the phase: a watch, and the fallen commanders', () => {
  test.each([
    ['a Move', 'move', false],
    ['an Encounter', 'encounter', false],
    ['an old Pursue', 'pursue', false],
    ['a Move named as the order form writes it', 'Move', false],
    ['a Rest', 'rest', true],
    ['a Defend', 'defend', true],
  ])('%s ordered for next phase: the standing watch kept, %s', (_, kind, kept) => {
    const b = fresh();
    const h = at(b);
    h._defend = { active: true };
    b.G.turnOrders[h.id] = [null, null, order(kind), null, null];
    endWith(b, 1);
    expect(h._defend.active).toBe(kept);
  });

  test('no order next phase, none at all, or the last phase: the watch kept', () => {
    const b = fresh();
    const [x, y, z] = [at(b), at(b), at(b)];
    for (const h of [x, y, z]) h._defend = { active: true };
    b.G.turnOrders[x.id] = [null, null, null, null, null];
    b.G.turnOrders[z.id] = [null, null, null, null, order('rest')];
    endWith(b, 1);
    endWith(b, 4);
    expect([x, y, z].map((h) => h._defend?.active)).toEqual([true, true, true]);
  });

  test("a fallen commander's host, its battle over, is dispersed, and the leaderless mark taken off", () => {
    const b = fresh();
    const d = at(b);
    Object.assign(d, { alive: false, armies: companies(2), _leaderlessHost: true });
    const calls = endWith(b, 2);
    expect(calls.filter((c) => c.fn === 'disperseDeadCharArmies').map((c) => c.args)).toEqual([[b.tc, d]]);
    expect(d._leaderlessHost).toBeUndefined();
    expect(named(calls).indexOf('disperseDeadCharArmies')).toBeGreaterThan(named(calls).indexOf('settleStrandedAtSea'));
    expect(named(calls).indexOf('disperseDeadCharArmies')).toBeLessThan(
      named(calls).indexOf('reconcileProvinceCharacters'),
    );
  });

  test("while its battle is unresolved, a fallen commander's host is kept, marked leaderless", () => {
    const b = fresh();
    const d = at(b);
    Object.assign(d, { alive: false, armies: companies(2) });
    b.X._battleUnresolved = true;
    const calls = endWith(b, 2);
    expect(named(calls)).not.toContain('disperseDeadCharArmies');
    expect([d._leaderlessHost, d.armies.length]).toEqual([true, 2]);
  });

  test('nothing for a living commander, a fallen one with no host, or one nowhere on the map', () => {
    const b = fresh();
    const living = at(b);
    living.armies = companies(1);
    const empty = at(b);
    Object.assign(empty, { alive: false, armies: [] });
    const bare = at(b);
    bare.alive = false;
    delete (bare as Partial<Character>).armies;
    const nowhere = at(b);
    Object.assign(nowhere, { alive: false, armies: companies(1), location: 9999 });
    const calls = endWith(b, 0);
    expect(calls.filter((c) => c.fn === 'disperseDeadCharArmies').map((c) => c.args[1])).toEqual([nowhere]);
  });
});
