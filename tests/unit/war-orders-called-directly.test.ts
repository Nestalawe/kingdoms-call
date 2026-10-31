// The war orders' own functions (plan P1-08j8: src/engine/orders/, the eighth family taken out of processOrder),
// called directly in the bare vm on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases
// scenario/war-orders-in-a-whole-turn.test.ts plays through a whole turn (lib/war-order-cases.ts), here one phase at a
// time, the orders read from the turn's list as processOrder reads them, with the same dice; then what the cases leave
// to a direct call: the chase as the order sets it (with the chase itself stood in), the watch in each of its states
// (pinned, already answered, pre-set at the top of the phase, carried), each die where it falls (a blockade at one
// half, the duel's two rolls, which companies a strike cuts down), and properties of each strike. The balance matrix
// never gives Blockade, Challenge, Rampage, Rain of Arrows, Sniper's Mark, Feigned Retreat or Raid the Coast, and
// gives Grand Stratagem and Lightning Advance once a run.
// Level 1: one function, called with what processOrder hands it.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The eleven functions (`resolveEncounterCharacterOrder`, `resolveDefendOrder`, `resolveBlockadeOrder`,
// `resolveChallengeOrder`, `resolveRampageOrder`, `resolveRainOfArrowsOrder`, `resolveSnipersMarkOrder`,
// `resolveFeignedRetreatOrder`, `resolveGrandStratagemOrder`, `resolveLightningAdvanceOrder`,
// `resolveRaidTheCoastOrder`, P1-08j8), called directly on the same cases one phase at a time with the same dice, then
// what the cases leave to a direct call: the chase as Encounter sets it (with `advancePursuit` stood in: for this
// phase, after the line, the watch ended), a pair already met, a Veil by phase, a lapsed charm, kings, the quarry by
// id; the watch in each state (pinned, answered this phase or another, pre-set and ridden out or not, carried or not, a
// lone hero's); the blockade's die at one half, every sea beside him, a sea creature, no die rolled for a refusal; the
// Challenge's two rolls, HP of 20 by default, a kill credited; which companies fall at a low die; a flag marks this
// turn and nothing else; a refusal changes nothing. The balance matrix never gives Blockade, Challenge, Rampage, Rain
// of Arrows, Sniper's Mark, Feigned Retreat or Raid the Coast. Properties: the Challenge's winner and wounds; a
// strike's companies (min(companies, 6) at Melee 9, 1 + level ÷ 2 at Archery, the rest in order, a commander bloodied
// to 1 at the least); the Sniper's Mark's wounds and kill. Planted faults: in the PR (P1-08j8)
// Since P1-23e (R-119): Encounter, Challenge and Sniper's Mark find no hero of another realm whose Invisibility holds
// (the cases); a realm that watches him by Clairvoyance still hunts him (here).
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { recordExperienceRolls, withCaseDice } from '../lib/espionage-order-cases.ts';
import { companies } from '../lib/item-and-army-order-cases.ts';
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
import { LANDS, WAR_ORDER_CASES, stageCase, type WarOrderCase } from '../lib/war-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
const recording = recordExperienceRolls(engine);
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const provOf = fn('provOf');
const setMovePool = fn('setMovePool');

/** One order, as processOrder hands it over in phase `ph`: each function takes the context, then the values it reads
 *  of processOrder's (the hero, the order, the phase, the target, his province), in that order. */
const play = (b: Board, c: Character, ord: Order, ph = 0) => {
  b.tc._currentPhase = ph;
  b.tc._logCtx = { charId: c.id, phase: ph };
  const prov = provOf(b.tc, c);
  const player = c.player == null ? undefined : b.G.players[c.player];
  const { action, target } = ord;
  const call: Record<string, () => unknown> = {
    encounter: () => fn('resolveEncounterCharacterOrder')(b.tc, c, ph, target, prov),
    defend: () => fn('resolveDefendOrder')(b.tc, c, ord, ph, prov),
    blockade: () => fn('resolveBlockadeOrder')(b.tc, c, target),
    challenge: () => fn('resolveChallengeOrder')(b.tc, c, target, prov),
    rampage: () => fn('resolveRampageOrder')(b.tc, c, target, prov),
    rain_of_arrows: () => fn('resolveRainOfArrowsOrder')(b.tc, c, target, prov),
    snipers_mark: () => fn('resolveSnipersMarkOrder')(b.tc, c, target, prov),
    feigned_retreat: () => fn('resolveFeignedRetreatOrder')(b.tc, c, prov),
    grand_stratagem: () => fn('resolveGrandStratagemOrder')(b.tc, c, prov),
    lightning_advance: () => fn('resolveLightningAdvanceOrder')(b.tc, c, prov),
    raid_coast: () => fn('resolveRaidTheCoastOrder')(b.tc, c, prov),
    move: () => fn('resolveMoveOrder')(b.tc, c, ph, false, target, prov, player),
    rest: () => fn('resolveRestOrder')(b.tc, c, prov),
  };
  must(call[action], 'the order ' + action)();
  b.tc._logCtx = { charId: null, phase: null };
};
/** Runs `body` with the percentile rolls (d100) given in turn, and every other die at `die`. */
function rolls<T>(d100s: number[], body: () => T, die = 0.99999): T {
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
/** Runs `body` with the chase itself stood in (the top-level advancePursuit replaced in the vm for the test's length),
 *  recording each call as [hero, phase, his chase as it stood]. */
function chaseStoodIn(body: () => void): [unknown, unknown, unknown][] {
  const g = engine as unknown as Record<string, unknown>;
  const was = g['advancePursuit'];
  const calls: [unknown, unknown, unknown][] = [];
  g['advancePursuit'] = (_tc: unknown, c: Character, ph: number) => {
    calls.push([c.id, ph, JSON.parse(JSON.stringify(c['_pursuit'] ?? null))]);
  };
  try {
    body();
  } finally {
    g['advancePursuit'] = was;
  }
  return calls;
}
const linesOf = (b: Board, c: Character) => b.lines().filter((l: Line) => l.charId === c.id);
const textOf = (b: Board, c: Character) =>
  linesOf(b, c)
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
const at = (b: Board, skills: Record<string, number> = {}, s: Partial<HeroSpec> = {}) =>
  hero(b, { player: 0, at: b.X, skills: { melee: 2, tactical: 2, march: 1, ...skills }, ...s });
const rival = (b: Board, s: Partial<HeroSpec> = {}, skills: Record<string, number> = {}) =>
  at(b, skills, { player: 1, ...s });
const o = (action: string, target: string | number = ''): Order => ({
  action,
  target: String(target),
  extra: '',
  desc: '',
});
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const merits = (c: Character) => Number(c['merits'] ?? 0);
const names = (c: Character) => c.armies.map((u) => u.unitName);
/** A hero without the book trySkillGain keeps of his lessons this turn (`_sgLog`, `_sgPending`). */
const withoutLessonBook = (c: Character) =>
  Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(c)) as object).filter(([k]) => !k.startsWith('_sg')));

describe.each(WAR_ORDER_CASES.filter(([, cases]) => cases.some((c) => !c.wholeTurnOnly)))(
  '%s, called directly: the whole-turn cases',
  (_, cases) => {
    test.each(cases.filter((c) => !c.wholeTurnOnly).map((c) => [c.name, c] as const))(
      '%s',
      (_name, c: WarOrderCase) => {
        const b = board(engine, world, 0);
        const s = stageCase(b, c);
        b.G.turnOrders = Object.fromEntries(s.orders.map(([h, os]) => [h.id, os]));
        b.G.characters.filter((h) => h.player != null && h.alive).forEach((h) => setMovePool(b.tc, h));
        const { xp } = recording(() => {
          withCaseDice(engine, c.dice ?? LANDS, () => {
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
  },
);

// ── Encounter Character ─────────────────────────────────────────────────────────────────────────────────────────
describe('Encounter Character, called directly: the chase it sets', () => {
  test('it sets the chase on the quarry for this phase, ends any watch, says so, and only then takes the first step', () => {
    const b = fresh();
    const q = rival(b);
    const h = at(b);
    Object.assign(h, { _defend: { centre: b.X.id, active: true, setPhase: 0 } });
    const calls = chaseStoodIn(() => {
      play(b, h, o('encounter', q.id), 2);
    });
    expect({ calls, chase: h['_pursuit'], watch: h['_defend'] }).toEqual({
      calls: [[h.id, 2, { targetId: q.id, active: true, setPhase: 2 }]],
      chase: { targetId: q.id, active: true, setPhase: 2 },
      watch: undefined,
    });
    expect(linesOf(b, h).map((l) => [l.type, l.phase, l.targets, l.provinceId])).toEqual([['move', 2, [0], b.X.id]]);
  });

  test('a realm that watches him by Clairvoyance still hunts a quarry whose Invisibility holds (R-119)', () => {
    const b = fresh();
    const q = rival(b);
    Object.assign(q, { _invisTurn: b.G.turn });
    Object.assign(must(b.G.players[0], 'realm 0'), { _clairCharThisTurn: q.id });
    const h = at(b);
    const calls = chaseStoodIn(() => {
      play(b, h, o('encounter', q.id), 2);
    });
    expect({ calls, chase: h._pursuit }).toEqual({
      calls: [[h.id, 2, { targetId: q.id, active: true, setPhase: 2 }]],
      chase: { targetId: q.id, active: true, setPhase: 2 },
    });
  });

  test('a pair already met this phase: nothing at all, whichever side met the other', () => {
    for (const side of ['hunter', 'quarry'] as const) {
      const b = fresh();
      const q = rival(b);
      const h = at(b);
      if (side === 'hunter') h['_encounteredThisPhase'] = q.id;
      else q['_encounteredThisPhase'] = h.id;
      const calls = chaseStoodIn(() => {
        play(b, h, o('encounter', q.id));
      });
      expect({ side, calls, chase: h['_pursuit'], lines: linesOf(b, h).length }).toEqual({
        side,
        calls: [],
        chase: undefined,
        lines: 0,
      });
    }
  });

  test('another pair met this phase does not stop him', () => {
    const b = fresh();
    const q = rival(b);
    const h = at(b);
    h['_encounteredThisPhase'] = 12345;
    q['_encounteredThisPhase'] = 54321;
    expect(
      chaseStoodIn(() => {
        play(b, h, o('encounter', q.id));
      }).length,
    ).toBe(1);
  });

  test.each([
    [0, 0, false],
    [0, 1, false],
    [0, 2, true],
    [1, 2, false],
    [1, 3, true],
  ])('a Veil cast in phase %i hides him in phase %i: %s means the hunter sets out', (cast, ph, setsOut) => {
    const b = fresh();
    const q = rival(b);
    Object.assign(q, { _veilTurn: b.G.turn, _veilCastPhase: cast });
    const h = at(b);
    const calls = chaseStoodIn(() => {
      play(b, h, o('encounter', q.id), ph);
    });
    expect({ setsOut: calls.length === 1, cloaked: textOf(b, h).includes('they are cloaked') }).toEqual({
      setsOut,
      cloaked: !setsOut,
    });
  });

  test('a Veil cast an earlier turn, or a vanishing an earlier turn, hides nobody', () => {
    const b = fresh();
    b.G.turn = 6; // turn 5 was an earlier turn (turn 0 would read as none)
    const q = rival(b);
    Object.assign(q, { _veilTurn: 5, _veilCastPhase: 0, _vanishTurn: 5 });
    const h = at(b);
    expect(
      chaseStoodIn(() => {
        play(b, h, o('encounter', q.id));
      }).length,
    ).toBe(1);
  });

  test("a hero charmed from no realm (a wanderer won for good) may hunt anyone; one charmed from realm 1 may not hunt realm 1's", () => {
    const b = fresh();
    const q = rival(b);
    const free = at(b);
    Object.assign(free, { _charmTempControl: true, _charmOriginalPlayer: null });
    const held = at(b);
    Object.assign(held, { _charmTempControl: true, _charmOriginalPlayer: 1 });
    const lent = at(b);
    Object.assign(lent, { _charmOriginalPlayer: 1 }); // the mark of a charm that has lapsed
    const w = hero(b, { player: null, at: b.X });
    const calls = chaseStoodIn(() => {
      for (const h of [free, held, lent]) play(b, h, o('encounter', q.id));
      play(b, free, o('encounter', w.id));
    });
    expect(calls.map(([id, , chase]) => [id, (chase as { targetId: number }).targetId])).toEqual([
      [free.id, q.id],
      [lent.id, q.id],
      [free.id, w.id],
    ]);
  });

  test('a king may hunt a rival king; any hero may seek out his own king; a common hero may not hunt a rival king', () => {
    const b = fresh();
    const theirs = rival(b, { king: true });
    const ours = at(b, {}, { king: true });
    const common = at(b);
    const calls = chaseStoodIn(() => {
      play(b, ours, o('encounter', theirs.id));
      play(b, common, o('encounter', ours.id));
      play(b, common, o('encounter', theirs.id));
    });
    expect(calls.map(([id, , chase]) => [id, (chase as { targetId: number }).targetId])).toEqual([
      [ours.id, theirs.id],
      [common.id, ours.id],
    ]);
  });

  test('the quarry is named by id, as the order form writes it; a fallen hero with that id is no quarry', () => {
    const b = fresh();
    const q = rival(b);
    const h = at(b);
    const dead = rival(b);
    dead.alive = false;
    const calls = chaseStoodIn(() => {
      play(b, h, o('encounter', ` ${String(q.id)}`));
      play(b, h, o('encounter', dead.id));
    });
    expect({ calls: calls.length, noTrail: textOf(b, h).includes('finds no trail to follow') }).toEqual({
      calls: 1,
      noTrail: true,
    });
  });
});

// ── Defend ──────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Defend, called directly: the watch in each of its states', () => {
  const general = (b: Board, n = 2) => {
    const h = at(b);
    h.armies = companies(n);
    return h;
  };
  test('a move pinned by the interlock and rewritten as a Defend: nothing said, no watch set', () => {
    const b = fresh();
    const h = general(b);
    h['_defendReactedPhase'] = 0;
    play(b, h, { ...o('defend'), _pinned: true } as Order);
    expect({ lines: linesOf(b, h).length, watch: h['_defend'], reacted: h['_defendReactedPhase'] }).toEqual({
      lines: 0,
      watch: undefined,
      reacted: 0,
    });
  });

  test('a watch answered in battle this phase: told so, and the watch left as the battle left it', () => {
    const b = fresh();
    const h = general(b);
    Object.assign(h, { _defend: { centre: b.X.id, active: false, setPhase: 1 } });
    h['_defendSpent'] = { turn: b.G.turn, ph: 1 };
    play(b, h, o('defend'), 1);
    expect({ text: textOf(b, h), watch: h['_defend'] }).toEqual({
      text: `🛡 ${h.name} has met this season's threat in battle — their Defend order is done, and they set no new watch until ordered to Defend in a later season.`,
      watch: { centre: b.X.id, active: false, setPhase: 1 },
    });
  });

  test('a watch answered in an earlier phase, or an earlier turn, does not stop a new one', () => {
    for (const spent of [
      { turn: 1, ph: 0 },
      { turn: 0, ph: 1 },
    ]) {
      const b = fresh();
      const h = general(b);
      h['_defendSpent'] = { turn: b.G.turn - 1 + spent.turn, ph: spent.ph };
      play(b, h, o('defend'), 1);
      expect(textOf(b, h)).toContain(`${h.name} makes camp in ${b.X.name} and sets a watch`);
    }
  });

  test('a watch pre-set at the top of this phase that has already ridden out says no more, and keeps its marker', () => {
    const b = fresh();
    const h = general(b);
    Object.assign(h, { _defend: { centre: b.X.id, active: true, setPhase: 2, preActivated: true, carried: false } });
    h['_defendReactedPhase'] = 2;
    play(b, h, o('defend'), 2);
    expect({ lines: linesOf(b, h).length, watch: h['_defend'], reacted: h['_defendReactedPhase'] }).toEqual({
      lines: 0,
      watch: { centre: b.X.id, active: true, setPhase: 2, carried: false },
      reacted: 2,
    });
  });

  test('a watch pre-set at the top of this phase that has not ridden out is announced, and keeps its marker', () => {
    const b = fresh();
    const h = general(b);
    Object.assign(h, { _defend: { centre: b.X.id, active: true, setPhase: 2, preActivated: true, carried: false } });
    h['_defendReactedPhase'] = 1;
    play(b, h, o('defend'), 2);
    expect({ said: textOf(b, h).includes('makes camp in'), reacted: h['_defendReactedPhase'] }).toEqual({
      said: true,
      reacted: 1,
    });
  });

  test.each([
    ['pre-set an earlier phase', { active: true, setPhase: 1, preActivated: true }, 'keeps'],
    ['pre-set this phase, but broken', { active: false, setPhase: 2, preActivated: true }, 'camp'],
    ['set by an earlier order', { active: true, setPhase: 1 }, 'keeps'],
  ])(
    'a watch %s is not this phase’s pre-set watch: its ride-out marker is cleared, and it is told',
    (_w, was, says) => {
      const b = fresh();
      const h = general(b);
      Object.assign(h, { _defend: { centre: b.X.id, ...was }, _defendReactedPhase: 2 });
      play(b, h, o('defend'), 2);
      expect({
        reacted: h['_defendReactedPhase'],
        said: textOf(b, h).startsWith(
          says === 'keeps' ? `🛡 ${h.name} keeps the watch in ${b.X.name}.` : `${h.name} makes camp in ${b.X.name}`,
        ),
      }).toEqual({ reacted: undefined, said: true });
    },
  );

  test('a watch set by the order itself clears an old ride-out marker', () => {
    const b = fresh();
    const h = general(b);
    h['_defendReactedPhase'] = 1;
    play(b, h, o('defend'), 2);
    expect({ reacted: h['_defendReactedPhase'], watch: h['_defend'] }).toEqual({
      reacted: undefined,
      watch: { centre: b.X.id, active: true, setPhase: 2, carried: false },
    });
  });

  test.each([
    ['an earlier phase’s watch, still on', { active: true, setPhase: 1 }, true],
    ['this phase’s watch, carried over', { active: true, setPhase: 2, carried: true }, true],
    ['this phase’s watch, new', { active: true, setPhase: 2, preActivated: true }, false],
    ['an earlier phase’s watch, broken', { active: false, setPhase: 1, carried: true }, false],
  ])('%s: carried is %s', (_what, was, carried) => {
    const b = fresh();
    const h = general(b);
    const lone = at(b);
    Object.assign(h, { _defend: { centre: b.X.id, ...was } });
    Object.assign(lone, { _defend: { centre: b.X.id, ...was } });
    play(b, h, o('defend'), 2);
    play(b, lone, o('defend'), 2);
    expect({
      watch: h['_defend'],
      general: textOf(b, h).split('\n')[0]?.slice(0, 30),
      lone: textOf(b, lone).split('\n')[0]?.slice(0, 30),
    }).toEqual({
      watch: { centre: b.X.id, active: true, setPhase: 2, carried },
      general: (carried ? `🛡 ${h.name} keeps the watch in ${b.X.name}.` : `${h.name} makes camp in ${b.X.name}`).slice(
        0,
        30,
      ),
      lone: (carried
        ? `🛡 ${lone.name} still lies in wait about ${b.X.name}.`
        : `${lone.name} melts into the country`
      ).slice(0, 30),
    });
  });

  test('the watch is set over the province he stands in, whatever the order names', () => {
    const b = fresh();
    const h = general(b);
    play(b, h, o('defend', ring1(b, 0).id), 0);
    expect(h['_defend']).toEqual({ centre: b.X.id, active: true, setPhase: 0, carried: false });
  });
});

// ── Blockade ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Blockade, called directly: the die, the reach, the fleet', () => {
  const admiral = (b: Board, fleet: string[] = ['Galleon Fleet']) => {
    const h = at(b, { naval: 7 });
    h.armies = fleet.flatMap((t) => companies(1, t));
    return h;
  };
  test.each([
    [0.49999, true],
    [0.5, false],
  ])('a die of %f: the blockade forms is %s; a lesson either way', (die, forms) => {
    const b = fresh();
    const sea = ring1(b, 0);
    sea.terrain = 'sea';
    const h = admiral(b);
    const { xp } = recording(() => {
      withDice(engine, [die], () => {
        play(b, h, o('blockade', sea.id));
      });
    });
    expect({
      sea: [sea['_blockadeTurn'], sea['_blockadeBy']],
      lesson: xp.filter((x) => x.id === h.id).map((x) => [x.skill, x.base]),
      line: linesOf(b, h).map((l) => [l.type, l.provinceId, !!l['public']]),
    }).toEqual({
      sea: forms ? [b.G.turn, 0] : [undefined, undefined],
      lesson: [['naval', 0.1]],
      line: [['move', sea.id, forms]],
    });
  });

  test('every sea beside him may be sealed, and a sea creature is fleet enough', () => {
    const b = fresh();
    const h = admiral(b, ['Sea Giants']);
    for (const p of b.ring1) {
      p.terrain = 'sea';
      withDice(engine, [0], () => {
        play(b, h, o('blockade', p.id));
      });
    }
    expect(b.ring1.map((p) => p['_blockadeBy'])).toEqual(b.ring1.map(() => 0));
  });

  test('a land army with no ship, and a hero with none, are refused; nothing is rolled', () => {
    const b = fresh();
    const sea = ring1(b, 0);
    sea.terrain = 'sea';
    const foot = admiral(b, ['Men-at-Arms']);
    const alone = admiral(b, []);
    const dice: number[] = [];
    const kcRng = engine['kcRng'] as { use(next: () => number): () => number };
    const was = kcRng.use(() => {
      dice.push(0);
      return 0;
    });
    try {
      play(b, foot, o('blockade', sea.id));
      play(b, alone, o('blockade', sea.id));
    } finally {
      kcRng.use(was);
    }
    expect({ dice: dice.length, sea: sea['_blockadeTurn'] }).toEqual({ dice: 0, sea: undefined });
  });
});

// ── Challenge ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('Challenge, called directly: the two rolls and the wounds', () => {
  const duel = (rollA: number, rollB: number, foeSkills: Record<string, number> = {}, foeHp = 20) => {
    const b = fresh();
    const f = rival(b, {}, foeSkills);
    f.hp = foeHp;
    const h = at(b, { melee: 7 });
    rolls([rollA, rollB], () => {
      play(b, h, o('challenge', f.id));
    });
    return { b, h, f };
  };
  test('each side rolls a d100, a quarter of it counting: the challenger first', () => {
    // 35 + 100/4 = 60 against 26 + 4/4 = 27: 33 points, so 8 + 5 wounds
    const a = duel(100, 4);
    expect([a.h.hp, a.f.hp]).toEqual([20, 7]);
    // 35 + 1/4 against 26 + 100/4 = 51: 15.75 points, so 8 + 2 wounds to the challenger
    const c = duel(1, 100);
    expect([c.h.hp, c.f.hp, merits(c.h)]).toEqual([10, 20, 0]);
  });

  test('a hero with no HP recorded fights at 20, and the wounds take him to 0 at the least', () => {
    const b = fresh();
    const f = rival(b);
    delete (f as Partial<Character>).hp;
    const h = at(b, { melee: 7 });
    rolls([1, 1], () => {
      play(b, h, o('challenge', f.id));
    });
    expect(f.hp).toBe(11);
    const c = duel(100, 1, {}, 3);
    expect(c.f.hp).toBe(0);
  });

  test('a challenger slain in the duel gives his foe the kill', () => {
    const b = fresh();
    const f = rival(b, {}, { melee: 5 });
    const h = at(b, { melee: 7 });
    h.hp = 5;
    const g = engine as unknown as Record<string, unknown>;
    const was = g['awardKillXP'] as Fn;
    const kills: unknown[] = [];
    g['awardKillXP'] = (tc: unknown, killer: Character, slain: Character, ...rest: unknown[]) => {
      kills.push([killer.id, slain.id]);
      return was(tc, killer, slain, ...rest);
    };
    try {
      rolls([1, 1], () => {
        play(b, h, o('challenge', f.id));
      });
    } finally {
      g['awardKillXP'] = was;
    }
    expect({ kills, alive: h.alive }).toEqual({ kills: [[f.id, h.id]], alive: false });
  });

  test('property: one side alone takes 8 wounds and one for each 6 points of the gap; the challenger wins ties and two merits', () => {
    fc.assert(
      fc.property(
        fc.record({
          a: fc.integer({ min: 0, max: 9 }),
          aArch: fc.integer({ min: 0, max: 9 }),
          f: fc.integer({ min: 0, max: 9 }),
          fArch: fc.integer({ min: 0, max: 9 }),
          aHp: fc.integer({ min: 1, max: 30 }),
          fHp: fc.integer({ min: 1, max: 30 }),
          rA: fc.integer({ min: 1, max: 100 }),
          rB: fc.integer({ min: 1, max: 100 }),
        }),
        ({ a, aArch, f: fm, fArch, aHp, fHp, rA, rB }) => {
          const b = fresh();
          const f = rival(b, {}, { melee: fm, archery: fArch });
          f.hp = fHp;
          f['_unkillable'] = true;
          const h = at(b, { melee: Math.max(7, a), archery: aArch });
          h.hp = aHp;
          h['_unkillable'] = true;
          const eff = (n: number) => Math.min(5, n);
          const aScore = (eff(Math.max(7, a)) + eff(aArch)) * 3 + aHp + rA / 4;
          const bScore = (eff(fm) + eff(fArch)) * 3 + fHp + rB / 4;
          const win = aScore >= bScore;
          const wounds = 8 + Math.floor(Math.abs(aScore - bScore) / 6);
          rolls([rA, rB], () => {
            play(b, h, o('challenge', f.id));
          });
          const floor = (hp: number) => Math.max(1, hp - wounds);
          expect({ h: h.hp, f: f.hp, merits: merits(h) }).toEqual({
            h: win ? aHp : floor(aHp),
            f: win ? floor(fHp) : fHp,
            merits: win ? 2 : 0,
          });
        },
      ),
      { seed: Number(process.env['KC_SEED']) >>> 0 || 1, numRuns: 200 },
    );
  });
});

// ── Rampage and Rain of Arrows ──────────────────────────────────────────────────────────────────────────────────
describe('Rampage and Rain of Arrows, called directly: which companies fall', () => {
  test('at a low die the shuffle picks other companies than the first; the rest keep their order', () => {
    const b = fresh();
    const f = rival(b);
    f.armies = companies(8);
    const h = at(b, { melee: 9 });
    withDice(engine, [0], () => {
      play(b, h, o('rampage', f.id));
    });
    expect(names(f)).toEqual(['Men-at-Arms c0', 'Men-at-Arms c7']);
    const g = rival(b);
    g.armies = companies(8);
    const a = at(b, { archery: 7 });
    withDice(engine, [0], () => {
      play(b, a, o('rain_of_arrows', g.id));
    });
    expect(names(g)).toEqual(['Men-at-Arms c0', 'Men-at-Arms c5', 'Men-at-Arms c6', 'Men-at-Arms c7']);
  });

  test('property: a strike removes min(companies, 6) at Melee 9, or min(companies, 1 + level ÷ 2) at Archery; the rest in order, nothing added', () => {
    fc.assert(
      fc.property(
        fc.record({
          n: fc.integer({ min: 1, max: 12 }),
          order: fc.constantFrom('rampage', 'rain_of_arrows'),
          arch: fc.integer({ min: 7, max: 9 }),
          die: fc.double({ min: 0, max: 0.99999, noNaN: true }),
          hp: fc.integer({ min: 1, max: 30 }),
        }),
        ({ n, order: action, arch, die, hp }) => {
          const b = fresh();
          const f = rival(b);
          f.armies = companies(n);
          f.hp = hp;
          const before = names(f);
          const h = at(b, { melee: 9, archery: arch });
          withDice(engine, [die], () => {
            play(b, h, o(action, f.id));
          });
          const kills = Math.min(n, action === 'rampage' ? 6 : 1 + Math.floor(arch / 2));
          const after = names(f);
          expect({
            left: after.length,
            inOrder: after.every((x, i) => i === 0 || before.indexOf(x) > before.indexOf(after[i - 1] ?? '')),
            known: after.every((x) => before.includes(x)),
            hp: f.hp,
            merits: merits(h),
          }).toEqual({
            left: n - kills,
            inOrder: true,
            known: true,
            hp: action === 'rampage' ? Math.max(1, hp - 15) : hp,
            merits: action === 'rampage' ? 1 : 0,
          });
        },
      ),
      { seed: Number(process.env['KC_SEED']) >>> 0 || 1, numRuns: 200 },
    );
  });
});

// ── Sniper's Mark ───────────────────────────────────────────────────────────────────────────────────────────────
describe("Sniper's Mark, called directly: the wounds and the kill", () => {
  test('property: 17 wounds; he falls if they take his last HP or the roll is within 37 (22 for a king)', () => {
    fc.assert(
      fc.property(
        fc.record({ hp: fc.integer({ min: 1, max: 40 }), roll: fc.integer({ min: 1, max: 100 }), king: fc.boolean() }),
        ({ hp, roll, king }) => {
          const b = fresh();
          const f = rival(b, { king });
          f.hp = hp;
          const h = at(b, { archery: 9 });
          rolls([roll], () => {
            play(b, h, o('snipers_mark', f.id));
          });
          const slain = hp <= 17 || roll <= (king ? 22 : 37);
          const chance = hp <= 17 ? '' : ` (${String(king ? 22 : 37)}% to slay, roll ${String(roll)})`;
          expect({ alive: f.alive, hp: f.hp, merits: merits(h), line: textOf(b, h).split('\n')[0] }).toEqual({
            alive: !slain,
            hp: slain ? 0 : hp - 17,
            merits: slain ? 2 : 0,
            line: `🎯 ${h.name} takes a Sniper's Mark on ${f.name} — 17 wounds${chance}.`,
          });
        },
      ),
      { seed: Number(process.env['KC_SEED']) >>> 0 || 1, numRuns: 200 },
    );
  });

  test('a foe with no HP recorded is marked at 20', () => {
    const b = fresh();
    const f = rival(b);
    delete (f as Partial<Character>).hp;
    const h = at(b, { archery: 9 });
    rolls([100], () => {
      play(b, h, o('snipers_mark', f.id));
    });
    expect(f.hp).toBe(3);
  });

  test('the kill is credited to the archer', () => {
    const b = fresh();
    const f = rival(b);
    const h = at(b, { archery: 9 });
    const g = engine as unknown as Record<string, unknown>;
    const was = g['awardKillXP'] as Fn;
    const kills: unknown[] = [];
    g['awardKillXP'] = (tc: unknown, killer: Character, slain: Character, ...rest: unknown[]) => {
      kills.push([killer.id, slain.id]);
      return was(tc, killer, slain, ...rest);
    };
    try {
      rolls([1], () => {
        play(b, h, o('snipers_mark', f.id));
      });
    } finally {
      g['awardKillXP'] = was;
    }
    expect(kills).toEqual([[h.id, f.id]]);
  });
});

// ── The flags ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('Feigned Retreat, Grand Stratagem, Lightning Advance and Raid the Coast, called directly: the flag is this turn', () => {
  test.each([
    ['feigned_retreat', 'tactical', 7, '_feignedRetreatTurn'],
    ['grand_stratagem', 'tactical', 9, '_grandStratagemTurn'],
    ['lightning_advance', 'march', 9, '_lightningAdvanceTurn'],
    ['raid_coast', 'naval', 9, '_raidCoastTurn'],
  ])('%s at %s %i marks this turn, and nothing else on him changes', (action, skill, level, flag) => {
    const b = fresh();
    const h = at(b, { [skill]: level });
    h.armies = companies(1, 'Galleon Fleet');
    const before = JSON.parse(JSON.stringify(h)) as Record<string, unknown>;
    play(b, h, o(action));
    expect(withoutLessonBook(h)).toEqual({ ...before, [flag]: b.G.turn });
  });

  test.each([
    ['feigned_retreat', 'tactical', 6],
    ['grand_stratagem', 'tactical', 8],
    ['lightning_advance', 'march', 8],
    ['raid_coast', 'naval', 8],
  ])('%s at %s %i, one below its level, changes nothing on him', (action, skill, level) => {
    const b = fresh();
    const h = at(b, { [skill]: level });
    h.armies = companies(1, 'Galleon Fleet');
    const before = JSON.parse(JSON.stringify(h)) as unknown;
    play(b, h, o(action));
    expect(h as unknown).toEqual(before);
  });

  test('a sea creature is fleet enough to Raid the Coast', () => {
    const b = fresh();
    const h = at(b, { naval: 9 });
    h.armies = companies(1, 'Eldritch Kraken');
    play(b, h, o('raid_coast'));
    expect(h['_raidCoastTurn']).toBe(b.G.turn);
  });
});

// ── Every refusal changes nothing ───────────────────────────────────────────────────────────────────────────────
describe('the war masteries, called directly: a refusal changes nothing in the world', () => {
  test('a fallen hero beside him is no mark for any strike: his host and HP are left as they lie', () => {
    const b = fresh();
    const dead = rival(b);
    dead.armies = companies(3);
    dead.alive = false;
    for (const [action, skills] of [
      ['challenge', { melee: 7 }],
      ['rampage', { melee: 9 }],
      ['rain_of_arrows', { archery: 9 }],
      ['snipers_mark', { archery: 9 }],
    ] as const) {
      const h = at(b, skills);
      rolls([1, 1], () => {
        play(b, h, o(action, dead.id));
      });
      expect({ action, hp: dead.hp, host: names(dead).length, merits: merits(h) }).toEqual({
        action,
        hp: 20,
        host: 3,
        merits: 0,
      });
    }
  });
  const where = (b: Board): Province => ring1(b, 0);
  test.each([
    ['blockade', { naval: 6 }],
    ['challenge', { melee: 6 }],
    ['rampage', { melee: 8 }],
    ['rain_of_arrows', { archery: 6 }],
    ['snipers_mark', { archery: 8 }],
  ])('%s below its level', (action, skills) => {
    const b = fresh();
    const sea = where(b);
    sea.terrain = 'sea';
    const f = rival(b);
    f.armies = companies(3);
    const h = at(b, skills);
    h.armies = companies(1, 'Galleon Fleet');
    const before = JSON.stringify(b.G);
    const { xp } = recording(() => {
      rolls(
        [1, 1],
        () => {
          play(b, h, o(action, action === 'blockade' ? sea.id : f.id));
        },
        0,
      );
    });
    expect({ same: JSON.stringify(b.G) === before, xp: xp.length, lines: linesOf(b, h).length }).toEqual({
      same: true,
      xp: 0,
      lines: 1,
    });
  });
});
