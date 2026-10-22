// The turn's seed, passed in (plan P1-08m): resolveTurn(state, rows, turn, seed) makes the dice of its seed
// (kcRngStream(seed), src/engine/rng.ts) once, lends them for the turn and again for the Spy-stealth step (P1-12b2: it
// was part of buildReports() until then), whose rolls carry on from the turn's, and for buildReports(), and gives back
// the dice in use before after each, also when it throws. With no seed
// (every other test's turn), the turn plays on the dice in use, as a test fixes them. Until P1-08m the shell
// (src/ui/gm/turn-shell.ts) lent the dice itself, around both calls (P1-18e); these tests hold what it did.
// One turn of the balance matrix's scripted-05 (lib/matrix-game.ts), with every hero a Spy 5 so that the Spy-stealth
// step rolls a die for each: stealth drawn from other dice than the turn's shows in who moved unseen.
// - The same seed plays the same turn, log, reports and telemetry, whatever the dice in use were; another seed plays
//   another; seed 0 plays as seed 1, as kcRngStream reads it.
// - The turn and its reports are the ones the shell played by lending the seed's dice around both calls, and the
//   stealth draws from the turn's dice where the turn stopped, whatever the page draws between the two.
// - The dice in use come back after the turn, after the stealth, after the reports, and after a turn, a stealth step
//   or reports that throw.
// - With no seed, the turn and its stealth draw from the dice in use; with one, never.
// Level 1 (unit): resolveTurn in the bare vm (lib/engine.ts). The shell's call of it is the page's: its test is in
// tests/page/turn-shell.test.ts.
import vm from 'node:vm';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { engineFn, loadEngine, quietEngineLog } from '../lib/engine.ts';
import { GAME, newWorld, slotRows } from '../lib/matrix-game.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const TURN_SEED = 0x5eed0001;

/** A new engine whose dice in use are the stream of `diceSeed` (as a page's are, from its KC_RNG_SEED). */
function engineOn(diceSeed: number): vm.Context {
  const e = loadEngine({ seed: diceSeed });
  quietEngineLog(e);
  return e;
}

/** The world of scripted-05 before its first turn, every living hero a Spy 5 (so the Spy-stealth step rolls his
 *  stealth). */
const WORLD = (() => {
  const w = JSON.parse(newWorld(engineOn(GAME.seed))) as {
    characters: ({ alive?: boolean; skills?: object } | null)[];
  };
  for (const c of w.characters) if (c?.alive) c.skills = { ...c.skills, spy: 5 };
  return JSON.stringify(w);
})();

interface Resolved {
  state: string;
  log: unknown[];
  spyStealthAndInvisibilityStampedForTheReports(): void;
  buildReports(): { reports: { gp: { player_index: unknown }; report: unknown }[]; tel: unknown };
}

/** resolveTurn on `e`: as every other test calls it (no seed), or with one. */
function resolve(e: vm.Context, seed?: number, state = WORLD): Resolved {
  const resolveTurn = engineFn(e, 'resolveTurn') as (...a: unknown[]) => Resolved;
  const rows = slotRows(e, WORLD, 1);
  return seed === undefined ? resolveTurn(state, rows, 1) : resolveTurn(state, rows, 1, seed);
}

interface Played {
  state: string;
  log: string;
  reports: string;
  tel: string;
}

/** A turn's Spy stealth and reports, as the shell has them made after the save. */
function afterTheSave(r: Resolved) {
  r.spyStealthAndInvisibilityStampedForTheReports();
  return r.buildReports();
}

/** A turn and its reports, as JSON, with `between()` run after the turn and before the stealth and the reports (the
 *  shell's save). */
function play(e: vm.Context, seed?: number, between = () => undefined as unknown): Played {
  const r = resolve(e, seed);
  between();
  const { reports, tel } = afterTheSave(r);
  return {
    state: r.state,
    log: JSON.stringify(r.log),
    reports: JSON.stringify(reports.map(({ gp, report }) => [gp.player_index, report])),
    tel: JSON.stringify(tel),
  };
}

/** The engine's dice in use, from now on, the stream of `seed`. */
const pin = (e: vm.Context, seed: number) => {
  vm.runInContext(`kcRng.use(kcRngStream(${String(seed)}))`, e);
};
/** The next number of the engine's dice in use. */
const draw = (e: vm.Context) => vm.runInContext('kcRng()', e) as number;
/** The stream of `seed`, made by the engine's own kcRngStream. */
const streamOf = (e: vm.Context, seed: number) =>
  (vm.runInContext('kcRngStream', e) as (s: number) => () => number)(seed);

/** Counted dice put in use on `e` (the stream of `seed`): how many numbers were drawn from them, and whether they are
 *  still the dice in use. */
function countedDice(e: vm.Context, seed: number): { drawn(): number; stillInUse(): boolean } {
  const box = vm.runInContext(
    `(()=>{ const s=kcRngStream(${String(seed)}); const box={n:0}; box.dice=()=>{ box.n++; return s(); }; kcRng.use(box.dice);
      box.inUse=()=>{ const now=kcRng.use(box.dice); kcRng.use(now); return now===box.dice; }; return box; })()`,
    e,
  ) as { n: number; inUse(): boolean };
  return { drawn: () => box.n, stillInUse: () => box.inUse() };
}

/** Replaces the engine's top-level function `name` by `code` (a function's source, made in the vm) for `body`'s length. */
function standIn<T>(e: vm.Context, name: string, code: string, body: () => T): T {
  const put = vm.runInContext(
    `(name, fn)=>{ const was=globalThis[name]; globalThis[name]=fn; return ()=>{ globalThis[name]=was; }; }`,
    e,
  ) as (name: string, fn: unknown) => () => void;
  const back = put(name, vm.runInContext(`(${code})`, e));
  try {
    return body();
  } finally {
    back();
  }
}

describe('the same seed plays the same turn', () => {
  const reference = play(engineOn(11), TURN_SEED);

  test('whatever the dice in use were: the world, the log, every report and the telemetry', () => {
    const e = engineOn(22);
    pin(e, 202);
    const again = play(e, TURN_SEED);
    expect(again.state === reference.state, 'the world after the turn').toBe(true);
    expect(again.log === reference.log, "the GM's log, with the stealth step's lines").toBe(true);
    expect(again.reports === reference.reports, 'every report').toBe(true);
    expect(again.tel === reference.tel, 'the telemetry').toBe(true);
  });

  test('another seed plays another turn, on the same dice in use', () => {
    const other = play(engineOn(11), TURN_SEED + 1);
    expect(other.state === reference.state, 'the world after the turn').toBe(false);
  });

  test('seed 0 plays as seed 1, as kcRngStream reads it', () => {
    expect(play(engineOn(33), 0)).toEqual(play(engineOn(44), 1));
  });

  test('the seed is read as an unsigned 32-bit integer, as kcRngStream reads it', () => {
    expect(play(engineOn(33), TURN_SEED + 2 ** 32).state === reference.state, 'past 2^32').toBe(true);
    // At 2^31 and over, against the turn on the dice of that seed, lent by the test.
    const high = 0xfeed0001;
    const lent = engineOn(44);
    pin(lent, high);
    expect(play(engineOn(55), high + 2 ** 32).state === play(lent).state, 'at 2^31 and over').toBe(true);
  });

  test('it hands back the world, the log, the Spy-stealth step and the reports, in that order', () => {
    expect(Object.keys(resolve(engineOn(55), TURN_SEED))).toEqual([
      'state',
      'log',
      'spyStealthAndInvisibilityStampedForTheReports',
      'buildReports',
    ]);
  });
});

describe('the dice the shell lent the turn and its reports until P1-08m', () => {
  // The shell's way (P1-18e): the seed's dice lent around resolveTurn, then lent again around the stealth and the
  // reports (buildReports() until P1-12b2), the page drawing its own between the two. One stream, carried on: the
  // stealth draws where the turn stopped.
  const asTheShellLentThem = (() => {
    const e = engineOn(66);
    const turnDice = vm.runInContext(
      `(()=>{ const s=kcRngStream(${String(TURN_SEED)}); const box={n:0}; box.dice=()=>{ box.n++; return s(); }; return box; })()`,
      e,
    ) as { n: number; dice: () => number };
    const lend = vm.runInContext(
      '(dice, fn)=>{ const was=kcRng.use(dice); try{ return fn(); } finally{ kcRng.use(was); } }',
      e,
    ) as <T>(dice: () => number, fn: () => T) => T;
    const r = lend(turnDice.dice, () => resolve(e));
    const turnDrew = turnDice.n;
    for (let i = 0; i < 5; i++) draw(e);
    const { reports, tel } = lend(turnDice.dice, () => afterTheSave(r));
    return {
      played: {
        state: r.state,
        log: JSON.stringify(r.log),
        reports: JSON.stringify(reports.map(({ gp, report }) => [gp.player_index, report])),
        tel: JSON.stringify(tel),
      },
      turnDrew,
      stealthDrew: turnDice.n - turnDrew,
    };
  })();

  test('the turn rolls dice, and so does its Spy stealth (every hero is a Spy)', () => {
    expect(asTheShellLentThem.turnDrew).toBeGreaterThan(100);
    expect(asTheShellLentThem.stealthDrew).toBeGreaterThan(40);
  });

  test('given the seed, the turn plays the same, and its stealth carries on from its dice, whatever the page draws between', () => {
    const e = engineOn(77);
    const played = play(e, TURN_SEED, () => {
      for (let i = 0; i < 5; i++) draw(e);
    });
    expect(played.state === asTheShellLentThem.played.state, 'the world after the turn').toBe(true);
    expect(played.log === asTheShellLentThem.played.log, "the GM's log, with the stealth step's lines").toBe(true);
    expect(played.reports === asTheShellLentThem.played.reports, 'every report').toBe(true);
    expect(played.tel === asTheShellLentThem.played.tel, 'the telemetry').toBe(true);
  });

  test('with no seed, the turn on the dice the test lent it plays the same', () => {
    const e = engineOn(88);
    pin(e, TURN_SEED);
    expect(play(e).state === asTheShellLentThem.played.state).toBe(true);
  });
});

describe('the dice in use come back', () => {
  test('after the turn, after its stealth and after its reports, as they were', () => {
    const e = engineOn(1);
    pin(e, 77);
    const page = streamOf(e, 77);
    const r = resolve(e, TURN_SEED);
    expect(draw(e), 'after the turn').toBe(page());
    r.spyStealthAndInvisibilityStampedForTheReports();
    expect(draw(e), 'after the stealth').toBe(page());
    r.buildReports();
    expect(draw(e), 'after the reports').toBe(page());
  });

  test('after a save the turn cannot read', () => {
    const e = engineOn(1);
    pin(e, 77);
    const page = streamOf(e, 77);
    expect(() => resolve(e, TURN_SEED, '{not json')).toThrow(/Could not read the saved game/);
    expect(draw(e)).toBe(page());
  });

  test('after a stage that throws, once it has rolled the turn’s dice', () => {
    const e = engineOn(1);
    pin(e, 77);
    const page = streamOf(e, 77);
    standIn(
      e,
      'afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames',
      "()=>{ kcRng(); kcRng(); kcRng(); throw new Error('a stage fails'); }",
      () => {
        expect(() => resolve(e, TURN_SEED)).toThrow('a stage fails');
      },
    );
    expect(draw(e)).toBe(page());
  });

  test('after a Spy-stealth step that throws, once it has rolled the turn’s dice, and after a second call', () => {
    const e = engineOn(1);
    pin(e, 77);
    const page = streamOf(e, 77);
    const r = resolve(e, TURN_SEED);
    expect(draw(e), 'after the turn').toBe(page());
    standIn(e, 'perkTier', "()=>{ kcRng(); kcRng(); kcRng(); throw new Error('the stealth fails'); }", () => {
      expect(() => {
        r.spyStealthAndInvisibilityStampedForTheReports();
      }).toThrow('the stealth fails');
    });
    expect(draw(e), 'after the stealth that threw').toBe(page());
    expect(() => {
      r.spyStealthAndInvisibilityStampedForTheReports();
    }).toThrow('the Spy stealth is rolled once a turn');
    expect(draw(e), 'after the second call').toBe(page());
  });

  test('after reports that throw, and after a second call', () => {
    const e = engineOn(1);
    pin(e, 77);
    const page = streamOf(e, 77);
    const r = resolve(e, TURN_SEED);
    expect(draw(e), 'after the turn').toBe(page());
    r.spyStealthAndInvisibilityStampedForTheReports();
    standIn(e, 'buildTurnReport', "()=>{ throw new Error('a report fails'); }", () => {
      expect(() => r.buildReports()).toThrow('a report fails');
    });
    expect(draw(e), 'after the reports that threw').toBe(page());
    expect(() => r.buildReports()).toThrow('buildReports() runs once a turn');
    expect(draw(e), 'after the second call').toBe(page());
  });
});

describe('with no seed, the turn plays on the dice in use', () => {
  test('the turn and its stealth draw from them, and they stay in use', () => {
    const e = engineOn(1);
    const dice = countedDice(e, 9);
    const r = resolve(e);
    const turnDrew = dice.drawn();
    expect(turnDrew, 'the turn drew from them').toBeGreaterThan(100);
    expect(dice.stillInUse(), 'still in use after the turn').toBe(true);
    r.spyStealthAndInvisibilityStampedForTheReports();
    expect(dice.drawn() - turnDrew, 'the stealth drew from them').toBeGreaterThan(40);
    expect(dice.stillInUse(), 'still in use after the stealth').toBe(true);
    r.buildReports();
    expect(dice.stillInUse(), 'still in use after the reports').toBe(true);
  });

  test('a null seed is no seed', () => {
    const e = engineOn(1);
    const dice = countedDice(e, 9);
    const resolveTurn = engineFn(e, 'resolveTurn') as (...a: unknown[]) => Resolved;
    afterTheSave(resolveTurn(WORLD, slotRows(e, WORLD, 1), 1, null));
    expect(dice.drawn()).toBeGreaterThan(140);
  });

  test('with a seed, neither the turn nor its stealth nor its reports draw from them, and they stay in use', () => {
    const e = engineOn(1);
    const dice = countedDice(e, 9);
    const r = resolve(e, TURN_SEED);
    expect(dice.drawn(), 'the turn').toBe(0);
    expect(dice.stillInUse(), 'still in use after the turn').toBe(true);
    r.spyStealthAndInvisibilityStampedForTheReports();
    expect(dice.drawn(), 'the stealth').toBe(0);
    expect(dice.stillInUse(), 'still in use after the stealth').toBe(true);
    r.buildReports();
    expect(dice.drawn(), 'the reports').toBe(0);
    expect(dice.stillInUse(), 'still in use after the reports').toBe(true);
  });
});

describe('Properties of the turn’s dice', () => {
  // Three engines, reused: a turn changes no global but the dice in use and the caches it seeds afresh
  // (tests/unit/engine-purity.test.ts). The third plays with no seed, on the seed's dice lent by the test.
  const one = engineOn(101);
  const two = engineOn(202);
  const three = engineOn(303);
  test('for any seed and any dice in use, the turn is the seed’s, and the dice in use carry on as if it had not run', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 32 - 1 }),
        fc.integer({ min: 0, max: 2 ** 32 - 1 }),
        fc.integer({ min: 0, max: 2 ** 32 - 1 }),
        (seed, inUseOne, inUseTwo) => {
          pin(one, inUseOne);
          pin(two, inUseTwo);
          const page = streamOf(one, inUseOne);
          const a = resolve(one, seed);
          expect(draw(one), 'after the turn').toBe(page());
          const b = resolve(two, seed);
          afterTheSave(a);
          expect(draw(one), 'after the stealth and the reports').toBe(page());
          afterTheSave(b);
          pin(three, seed);
          const c = resolve(three);
          afterTheSave(c);
          expect(a.state === b.state, 'the same world').toBe(true);
          expect(JSON.stringify(a.log) === JSON.stringify(b.log), 'the same log').toBe(true);
          expect(a.state === c.state, "the world on the seed's dice").toBe(true);
          expect(JSON.stringify(a.log) === JSON.stringify(c.log), "the log on the seed's dice").toBe(true);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
});
