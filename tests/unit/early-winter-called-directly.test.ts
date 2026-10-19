// Early Winter (plan P1-08k2: src/engine/turn/, lifted out of resolveTurn's phase loop), called directly in the bare vm
// on the middle of a bot world (lib/middle-of-a-bot-world.ts). First the cases scenario/early-winter-in-a-whole-turn
// plays through a whole turn (lib/early-winter-cases.ts), here played through the stage alone, as the loop calls it
// after the last season's four stages; then, with the helpers it calls stood in (each replaced in the vm by a recorder
// for the test's length), what it hands them and when; then what the whole turn can't stage: a phantom or summoned
// company in garrison (the season's start strips phantoms, the turn's end dissolves summons), a fallen hero's companies
// (the season's end garrisons them), two ships kept, a garrison of a realm that isn't, the Charm's lasting marks.
// Properties (fast-check): Orcish war-spoils halve a host's wages exactly (half the 2g-and-up wages, rounded down, and
// 1 for each 1g company); a realm that can pay loses nothing, one that can't loses its companies in order (the living
// before the dead, the rawest first, field before garrison within a grade) until the debt is met, and no more; a
// garrison company rises at most one grade, never past Elite.
// Level 1: one function, called with what the phase loop hands it.
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { withCaseDice } from '../lib/espionage-order-cases.ts';
import {
  EARLY_WINTER_CASES,
  LANDS,
  TAX_HEADER,
  accounts,
  cannotPay,
  disbands,
  drills,
  fades,
  has,
  holdsOnly,
  king,
  owes,
  paid,
  pays,
  shipsKept,
  stageCase,
  unit,
  type EarlyWinterCase,
  type Outcome,
} from '../lib/early-winter-cases.ts';
import { board, must, withDice, type Board, type Character, type Unit } from '../lib/middle-of-a-bot-world.ts';
import { plainRealms } from '../lib/recruit-hire-and-realm-works-order-cases.ts';
import { holding } from '../lib/cast-spell-order-cases.ts';
import { item } from '../lib/item-and-army-order-cases.ts';

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const world = botWorld(engine, 3, { cols: 10, rows: 8 });
type Fn = (...a: unknown[]) => unknown;
const fn = (name: string) => engineFn(engine, name) as Fn;
const STAGE = 'earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill';
const earlyWinter = fn(STAGE);
const computeMinorTitles = fn('computeMinorTitles');
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

const G = (b: Board) => b.G as unknown as Record<string, unknown> & Board['G'];
const tc = (b: Board) => b.tc as unknown as Record<string, unknown> & Board['tc'];
/** What the turn sets before its first season that the stage reads: the minor titles held going into the turn (none
 *  before turn 5). */
const setUp = (b: Board) => {
  G(b)['_minorHolders'] = b.G.turn >= 5 ? computeMinorTitles(b.G) : {};
};
/** The stage, as the loop calls it in the last season: the phase set, the log's context cleared between the stages. */
const winter = (b: Board) => {
  tc(b)._currentPhase = 4;
  b.tc._logCtx = { charId: null, phase: null };
  earlyWinter(b.tc);
};
const outcome = (b: Board): Outcome => ({ world: b.G, all: b.lines(), turn: b.G.turn });
const fresh = () => {
  const b = board(engine, world, 4);
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return b;
};
const realm = (b: Board, pi = 0) => must(b.G.players[pi], 'realm ' + String(pi));
const nameOf = (b: Board, pi = 0) => realm(b, pi).name;
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
/** The stage on `b` with the dice `die` (every die) and every percentile roll at 1. */
const settle = (b: Board, die = LANDS.die) => {
  setUp(b);
  withCaseDice(engine, { roll: 1, die }, () => {
    winter(b);
  });
  return outcome(b);
};

describe.each(EARLY_WINTER_CASES)('%s, through the stage called directly', (_, cases) => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c: EarlyWinterCase) => {
    const b = board(engine, world, 4);
    const s = stageCase(b, c);
    setUp(b);
    withCaseDice(engine, c.dice ?? LANDS, () => {
      winter(b);
    });
    const { got, want } = c.check(outcome(b), s);
    expect(got).toEqual(want);
  });
});

// ── What the stage hands the helpers it calls ────────────────────────────────────────────────────────────────────
interface Call {
  fn: string;
  args: unknown[];
  /** The lines written before the call. */
  before: number;
}
/** Runs `body` with each of `names` replaced by a recorder (in the vm, for the body's length); `returns` gives what a
 *  recorder hands back, by name (by default nothing). */
function standIn(b: Board, names: string[], body: () => void, returns: Record<string, Fn> = {}): Call[] {
  const g = engine as unknown as Record<string, unknown>;
  const was = names.map((f) => [f, g[f]] as const);
  const calls: Call[] = [];
  for (const f of names)
    g[f] = (...args: unknown[]) => {
      calls.push({ fn: f, args, before: b.lines().length });
      return returns[f]?.(...args);
    };
  try {
    body();
  } finally {
    for (const [f, w] of was) g[f] = w;
  }
  return calls;
}
const CAUSE = 'too few hulls left to carry the whole column';

describe('Early Winter: what it calls', () => {
  test('a charmed hero going home has his movement worked out afresh under his own lord; one already home does not', () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    const away = paid(b, 1);
    const home = paid(b, 1);
    Object.assign(away, { player: 1, _charmTempControl: true, _charmOriginalPlayer: 0 });
    Object.assign(home, { player: 0, _charmTempControl: true, _charmOriginalPlayer: 0 });
    let lordThen: unknown = null;
    const calls = standIn(b, ['setMovePool', 'settleStrandedAtSea'], () => settle(b), {
      setMovePool: (_t, c) => {
        lordThen = (c as Character).player;
      },
    });
    const pools = calls.filter((c) => c.fn === 'setMovePool');
    expect(pools.map((c) => c.args)).toEqual([[b.tc, away]]);
    expect(lordThen).toBe(0);
    expect(pools[0]?.before).toBe(0); // before his line, and before the taxes
  });

  test('the stranded are settled once, last, after the drill, for the last season', () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    b.X.garrisonArmies = [unit('Raw', 'Human Garrison', 'Green')];
    const calls = standIn(b, ['settleStrandedAtSea'], () => settle(b, 0));
    expect(calls.map((c) => [c.fn, ...c.args])).toEqual([['settleStrandedAtSea', b.tc, 4, CAUSE]]);
    expect(calls[0]?.before).toBe(b.lines().length);
    expect(b.lines().at(-1)?.text).toBe(drills(b.X, 'Raw (Human Garrison) Green → **Average**'));
  });
});

// ── What the whole turn can't stage ─────────────────────────────────────────────────────────────────────────────
describe('Early Winter: what only a direct call can stage', () => {
  test("a fallen hero's companies and pay draw no wage", () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    const fallen = paid(b, 7, [unit('Orphans', 'Men-at-Arms')]);
    fallen.alive = false;
    king(b, [unit('Guard', 'Men-at-Arms')]);
    const o = settle(b);
    const n = nameOf(b);
    expect(accounts(o)).toEqual([has(n, 20), owes(n, 3, 3, 0), pays(n, 3, 17)]);
  });

  test("a fallen hero's tax items and Thief skill pay nothing", () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 100]);
    const fallen = holding(paid(b, 1, [], { skills: { thief: 6 } }), item(b, 'Ring of Wealth'));
    fallen.alive = false;
    const o = settle(b);
    const n = nameOf(b);
    expect(accounts(o)[1]).toBe(`${n} collects 100g in taxes.`);
  });

  test('phantom and summoned companies in garrison never drill, whatever the die', () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 10]);
    b.X.garrisonArmies = [
      unit('Ghosts', 'Human Garrison', 'Green', 'Human', { _phantom: true }),
      unit('Summoned', 'Human Garrison', 'Green', 'Human', { _temporary: true }),
    ];
    const o = settle(b, 0);
    expect(o.all.some((l) => l.text.includes('Garrison drills'))).toBe(false);
    expect(b.X.garrisonArmies.map((u) => u.quality)).toEqual(['Green', 'Green']);
  });

  test("a garrison held by a realm index the world doesn't have never drills, and draws no muster", () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    const p = ring1(b, 0);
    p.owner = 7;
    Object.assign(p, { race: 'Orcish', _raidersMuster: b.G.turn });
    p.garrisonArmies = [unit('Lost', 'Human Garrison', 'Green')];
    const o = settle(b, 0);
    expect(o.all.some((l) => l.text.includes('Garrison drills') || l.text.includes('Muster'))).toBe(false);
    expect(p.garrisonArmies.map((u) => `${u.unitName} ${u.quality}`)).toEqual(['Lost Green']);
    expect(p['_raidersMuster']).toBeUndefined();
  });

  test('two ships still carrying troops at sea when the debt is met: both kept, the realm told in the plural', () => {
    const b = fresh();
    const sea = ring1(b, 0);
    sea.terrain = 'sea';
    holdsOnly(b, 0, [b.X, 0]);
    realm(b)['gold'] = 13; // 16 owed: short by the Watch's wage
    const watch = unit('Watch', 'Men-at-Arms');
    b.X.garrisonArmies = [watch];
    paid(b, 1, [unit('Galleon A', 'Galleon Fleet', 'Green'), unit('Marines A', 'Men-at-Arms', 'Elite')], {
      at: sea,
      king: true,
    });
    paid(b, 1, [unit('Galleon B', 'Galleon Fleet', 'Green'), unit('Marines B', 'Men-at-Arms', 'Elite')], {
      at: sea,
    });
    const o = settle(b);
    const n = nameOf(b);
    expect(accounts(o).slice(-2)).toEqual([disbands(watch, n), shipsKept(2)]);
  });

  test("an Orcish company of a realm that isn't Orcish pays in full, though it won attacking", () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    king(b, [unit('Wargs', 'Warg Riders', 'Average', 'Orcish', { _orcAtkWinTurn: b.G.turn })]);
    const o = settle(b);
    expect(accounts(o)).toEqual([has(nameOf(b), 20), owes(nameOf(b), 3, 3, 0), pays(nameOf(b), 3, 17)]);
  });

  test('a hero carrying an old lord on record, but held by no Charm, stays with his realm, the record untouched', () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    const h = paid(b, 1);
    Object.assign(h, { player: 1, _charmOriginalPlayer: 0 });
    const o = settle(b);
    expect([h.player, h['_charmOriginalPlayer']]).toEqual([1, 0]);
    expect(o.all.some((l) => l.text.includes('the enchantment on'))).toBe(false);
  });

  test("a deserter whose name already says he wanders isn't marked twice", () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    realm(b)['gold'] = 0;
    const h = paid(b, 3);
    h.name = 'Old Rover (wandering)';
    settle(b);
    expect([h.player, h.name]).toEqual([null, 'Old Rover (wandering)']);
  });

  test("the Charm's lasting marks stay: the turn it struck and his closed mind next turn", () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    const h = paid(b, 1);
    Object.assign(h, {
      player: 1,
      _charmTempControl: true,
      _charmOriginalPlayer: 0,
      _charmedTurn: b.G.turn,
      _charmImmuneTurn: b.G.turn + 1,
    });
    settle(b);
    expect([h['_charmedTurn'], h['_charmImmuneTurn']]).toEqual([b.G.turn, b.G.turn + 1]);
    expect(b.lines().findIndex((l) => l.text === fades(h))).toBeLessThan(
      b.lines().findIndex((l) => l.text === TAX_HEADER),
    );
  });

  test('within one grade the die chooses who goes, across field and garrison: each company is drawn a die in turn, the lowest goes first', () => {
    for (const [dice, first] of [
      [[0.9, 0.5, 0.1], 'Gate'],
      [[0.1, 0.5, 0.9], 'Left'],
      [[0.5, 0.1, 0.9], 'Right'],
    ] as const) {
      const b = fresh();
      holdsOnly(b, 0, [b.X, 0]);
      realm(b)['gold'] = 6;
      king(b, [unit('Left', 'Men-at-Arms', 'Green'), unit('Right', 'Men-at-Arms', 'Green')]);
      b.X.garrisonArmies = [unit('Gate', 'Men-at-Arms', 'Green')];
      setUp(b);
      withDice(engine, [...dice], () => {
        winter(b);
      });
      const gone = accounts(outcome(b)).filter((t) => t.includes(' disbands — '));
      expect(gone).toEqual([disbands(unit(first, 'Men-at-Arms'), nameOf(b))]);
    }
  });

  test('a realm that owes and cannot pay is warned with what it had, and the warning goes before any company leaves', () => {
    const b = fresh();
    holdsOnly(b, 0, [b.X, 0]);
    realm(b)['gold'] = 2;
    const raw = unit('Raw', 'Men-at-Arms', 'Green');
    king(b, [raw]);
    const o = settle(b);
    const n = nameOf(b);
    expect(accounts(o)).toEqual([has(n, 2), owes(n, 3, 3, 0), cannotPay(n, 3, 2), disbands(raw, n)]);
    expect(realm(b)['gold']).toBe(0);
  });
});

// ── Properties ──────────────────────────────────────────────────────────────────────────────────────────────────
const ORC_WAGES: [string, number][] = [
  ['Orc Garrison', 1],
  ['Goblin Horde', 2],
  ['Warg Riders', 3],
  ['Wyvern Riders', 4],
];
const QUALITIES = ['Green', 'Average', 'Veteran', 'Crack', 'Elite'];
const lastWages = (b: Board) => realm(b)['_lastWages'] as { armyWages: number; orcSpoilsG: number };

describe('Early Winter: properties', () => {
  test('Orcish war-spoils: a host pays half its 2g-and-up wages (rounded down) and 1 for each 1g company', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 9 }), (kinds) => {
        const b = fresh();
        holdsOnly(b, 0, [b.X, 0]);
        realm(b)['race'] = 'Orcish';
        realm(b)['gold'] = 100;
        const wages = kinds.map((k) => must(ORC_WAGES[k], 'a wage'));
        king(
          b,
          wages.map(([type], i) => unit('O' + String(i), type, 'Average', 'Orcish', { _orcAtkWinTurn: b.G.turn })),
        );
        settle(b);
        const full = wages.reduce((s, [, w]) => s + w, 0);
        const ones = wages.filter(([, w]) => w === 1).length;
        const half = Math.floor((full - ones) / 2) + ones;
        expect([lastWages(b).armyWages, lastWages(b).orcSpoilsG]).toEqual([half, full - half]);
      }),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('unpaid wages: nothing leaves a realm that can pay; one that cannot loses companies in order until the debt is met, and no more', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ q: fc.integer({ min: 0, max: 4 }), dead: fc.boolean(), garrisoned: fc.boolean() }), {
          minLength: 1,
          maxLength: 8,
        }),
        fc.integer({ min: 0, max: 25 }),
        (spec, purse) => {
          const b = fresh();
          holdsOnly(b, 0, [b.X, 0]);
          realm(b)['gold'] = purse;
          const us: Unit[] = spec.map((x, i) =>
            unit(
              'U' + String(i),
              'Men-at-Arms',
              must(QUALITIES[x.q], 'a grade'),
              'Human',
              x.dead ? { _isSkeletal: true } : {},
            ),
          );
          const field = us.filter((_, i) => !spec[i]?.garrisoned);
          const kept = us.filter((_, i) => spec[i]?.garrisoned);
          king(b, [...field]);
          b.X.garrisonArmies = [...kept];
          const owed = us.reduce((s, u) => s + (u['_isSkeletal'] ? 1 : 3), 0);
          // the order the wages pass takes them in: the living first, the rawest first, the field before the garrison
          const queue = [...field, ...kept]
            .map((u, i) => ({ u, i }))
            .sort(
              (x, y) =>
                (x.u['_isSkeletal'] ? 1 : 0) - (y.u['_isSkeletal'] ? 1 : 0) ||
                QUALITIES.indexOf(x.u.quality) - QUALITIES.indexOf(y.u.quality) ||
                x.i - y.i,
            )
            .map((x) => x.u);
          const o = settle(b);
          const gone = accounts(o)
            .filter((t) => t.includes(' disbands — '))
            .map((t) => t.split(' (')[0]);
          const want: string[] = [];
          let debt = owed - purse;
          for (const u of queue) {
            if (debt <= 0) break;
            want.push(u.unitName);
            debt -= u['_isSkeletal'] ? 1 : 3;
          }
          expect(gone).toEqual(owed <= purse ? [] : want);
          expect(realm(b)['gold']).toBe(owed <= purse ? purse - owed : 0);
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });

  test('garrison drill: a company rises at most one grade, never past Elite, and only in a realm-held garrison', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 6 }),
        fc.double({ min: 0, max: 0.99999, noNaN: true }),
        fc.boolean(),
        (grades, die, held) => {
          const b = fresh();
          const p = ring1(b, 0);
          holdsOnly(b, 0, [b.X, 100], ...(held ? ([[p, 0]] as [typeof p, number][]) : []));
          p.garrisonArmies = grades.map((q, i) =>
            unit('D' + String(i), 'Human Garrison', must(QUALITIES[q], 'a grade')),
          );
          settle(b, die);
          p.garrisonArmies.forEach((u, i) => {
            const was = must(grades[i], 'a grade');
            const now = QUALITIES.indexOf(u.quality);
            expect(now - was).toBeGreaterThanOrEqual(0);
            expect(now - was).toBeLessThanOrEqual(held && was < 4 ? 1 : 0);
          });
        },
      ),
      { seed: SEED, numRuns: 150 },
    );
  });
});
