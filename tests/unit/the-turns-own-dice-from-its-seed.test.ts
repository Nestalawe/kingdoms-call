// The turn's seed, passed in (plan P1-08m): resolveTurn(state, rows, turn, seed) makes the dice of its seed
// (kcRngStream(seed), src/engine/rng.ts) once, lends them for the turn and again for the Spy-stealth step (P1-12b2: it
// was part of buildReports() until then), whose rolls carry on from the turn's, and gives back the dice in use before
// after each, also when it throws. The reports draw no dice (P1-12b2); since P1-12b3 they are the views' (buildReports,
// on what the turn hands over for them), lent none, so they would draw from the dice in use: they draw none. With no
// seed
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
// - With no seed, the turn and its stealth draw from the dice in use; with one, never; the reports, never.
// Level 1 (unit): resolveTurn on the engine's modules, each engine a fresh set of them with its own dice (until P1-14m,
// each a bare vm, lib/engine.ts). The shell's call of it is the page's: its test is in tests/page/turn-shell.test.ts.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The turn's seed, passed in (P1-08m): one turn of `scripted-05` (`lib/matrix-game.ts`), every hero a Spy 5 so the
// Spy-stealth step rolls a die each (it was part of `buildReports()` until P1-12b2), through `resolveTurn(state, rows,
// turn, seed)` on the engine's modules (each engine a fresh set). The same seed plays the same world, log, reports and telemetry whatever the dice in
// use were; another seed another turn; seed 0 as seed 1 and the seed as an unsigned 32-bit integer, as `kcRngStream`
// reads them; the result's keys in order (the state, the log, the Spy-stealth step, `whatTheReportsRead`). The turn and
// its reports are the ones the shell played by lending the seed's dice around both calls (P1-18e), the stealth carrying
// on from the turn's dice whatever is drawn between. The dice in use come back after the turn, after the stealth, after
// the reports, and after a save it can't read, a stage that throws, a stealth step that throws, reports that throw and
// a second call of either. With no seed (or `null`) the turn and its stealth draw from the dice in use, which stay in
// use; with one, never; the reports (the views', lent no dice since P1-12b3), never. Property (fast-check): for any
// seed and dice in use, the turn is the seed's and the dice in use carry on as if it had not run. Fails on the base
// where it needs the seed (10 of 16). Planted faults: in the PR (P1-08m). Level 1: the engine alone; the shell's call
// is `turn-shell`'s. TypeScript, in `unit/`
import '../lib/the-whole-engine.ts';
import fc from 'fast-check';
import { beforeAll, describe, expect, test, vi, type MockInstance } from 'vitest';
import { GAME, newWorldOnFreshEngineModules, slotRowsJson } from '../lib/matrix-game.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const TURN_SEED = 0x5eed0001;

// The engine's console is this process's: its log is quiet for the file (emit echoes each line of the GM's log there),
// as lib/engine.ts's quietEngineLog quieted each vm's.
console.log = () => undefined;

interface Resolved {
  state: string;
  log: unknown[];
  spyStealthAndInvisibilityStampedForTheReports(): void;
  whatTheReportsRead(): unknown;
}
/** What the views' buildReports returns. */
interface Built {
  reports: { gp: { player_index: unknown }; report: unknown }[];
  tel: unknown;
}

/** A new engine whose dice in use are the stream of `diceSeed` (as a page's are, from its KC_RNG_SEED): a fresh set of
 *  the engine's modules (vi.resetModules), beside the ones made before, as each vm was its own. Each function a test
 *  stands in comes with its stand-in on its module (vi.spyOn, the function named), which reaches its calls from other
 *  files: the stage after the phases is called from run-turn.ts, perkTier in the Spy-stealth step from run-turn.ts,
 *  buildTurnReport from the views' buildReports. */
async function engineOn(diceSeed: number) {
  vi.resetModules();
  await import('../lib/the-whole-engine.ts');
  const { kcRng, kcRngStream } = await import('../../src/engine/rng.ts');
  const { resolveTurn } = await import('../../src/engine/run-turn.ts');
  const { buildReports } = await import('../../src/views/every-realms-report-and-the-lines-each-realm-reads.ts');
  const theStageAfterThePhases =
    await import('../../src/engine/turn/after-the-phases-stand-offs-the-dead-graves-couriers-mass-healing-cowards-and-location-names.ts');
  const thePerks = await import('../../src/engine/titles/perks.ts');
  const theTurnReport = await import('../../src/views/turn-report.ts');
  kcRng.seed(diceSeed);
  return {
    kcRng,
    kcRngStream,
    /** resolveTurn, handed what a test hands it (no seed, a seed, null, a save it can't read). */
    resolveTurn: resolveTurn as unknown as (...a: unknown[]) => Resolved,
    buildReports: buildReports as unknown as (whatTheReportsRead: unknown) => Built,
    standInTheStageAfterThePhases: () =>
      vi.spyOn(
        theStageAfterThePhases,
        'afterThePhasesStandOffsTheDeadGravesCouriersMassHealingCowardsAndLocationNames',
      ),
    standInPerkTier: () => vi.spyOn(thePerks, 'perkTier'),
    standInBuildTurnReport: () => vi.spyOn(theTurnReport, 'buildTurnReport'),
  };
}
type Engine = Awaited<ReturnType<typeof engineOn>>;

/** The world of scripted-05 before its first turn, every living hero a Spy 5 (so the Spy-stealth step rolls his
 *  stealth): made on fresh modules seeded GAME.seed, as the vm made it. */
const WORLD = await (async () => {
  const w = JSON.parse(await newWorldOnFreshEngineModules(GAME.seed)) as {
    characters: ({ alive?: boolean; skills?: object } | null)[];
  };
  for (const c of w.characters) if (c?.alive) c.skills = { ...c.skills, spy: 5 };
  return JSON.stringify(w);
})();

/** The slot rows of the first turn, as the shell loads them. */
const slotRows = (): unknown => JSON.parse(slotRowsJson(WORLD, 1));

/** resolveTurn on `e`: as every other test calls it (no seed), or with one. */
function resolve(e: Engine, seed?: number, state = WORLD): Resolved {
  const rows = slotRows();
  return seed === undefined ? e.resolveTurn(state, rows, 1) : e.resolveTurn(state, rows, 1, seed);
}

interface Played {
  state: string;
  log: string;
  reports: string;
  tel: string;
}

/** A turn's Spy stealth and reports, as the shell has them made after the save. */
function afterTheSave(e: Engine, r: Resolved): Built {
  r.spyStealthAndInvisibilityStampedForTheReports();
  return e.buildReports(r.whatTheReportsRead());
}

/** A turn and its reports, as JSON, with `between()` run after the turn and before the stealth and the reports (the
 *  shell's save). */
function play(e: Engine, seed?: number, between = () => undefined as unknown): Played {
  const r = resolve(e, seed);
  between();
  const { reports, tel } = afterTheSave(e, r);
  return {
    state: r.state,
    log: JSON.stringify(r.log),
    reports: JSON.stringify(reports.map(({ gp, report }) => [gp.player_index, report])),
    tel: JSON.stringify(tel),
  };
}

/** The engine's dice in use, from now on, the stream of `seed`. */
const pin = (e: Engine, seed: number) => {
  e.kcRng.use(e.kcRngStream(seed));
};
/** The next number of the engine's dice in use. */
const draw = (e: Engine) => e.kcRng();
/** The stream of `seed`, made by the engine's own kcRngStream. */
const streamOf = (e: Engine, seed: number) => e.kcRngStream(seed);

/** Counted dice put in use on `e` (the stream of `seed`): how many numbers were drawn from them, and whether they are
 *  still the dice in use. */
function countedDice(e: Engine, seed: number): { drawn(): number; stillInUse(): boolean } {
  const s = e.kcRngStream(seed);
  const box = { n: 0 };
  const dice = () => {
    box.n++;
    return s();
  };
  e.kcRng.use(dice);
  const inUse = () => {
    const now = e.kcRng.use(dice);
    e.kcRng.use(now);
    return now === dice;
  };
  return { drawn: () => box.n, stillInUse: inUse };
}

/** Stands one of the engine's functions in by `fn` (through `spyOn`, its stand-in on its module) for `body`'s length. */
function standIn<T>(spyOn: () => MockInstance, fn: () => never, body: () => T): T {
  const spy = spyOn().mockImplementation(fn);
  try {
    return body();
  } finally {
    spy.mockRestore();
  }
}

describe('the same seed plays the same turn', () => {
  let reference: Played;
  beforeAll(async () => {
    reference = play(await engineOn(11), TURN_SEED);
  });

  test('whatever the dice in use were: the world, the log, every report and the telemetry', async () => {
    const e = await engineOn(22);
    pin(e, 202);
    const again = play(e, TURN_SEED);
    expect(again.state === reference.state, 'the world after the turn').toBe(true);
    expect(again.log === reference.log, "the GM's log, with the stealth step's lines").toBe(true);
    expect(again.reports === reference.reports, 'every report').toBe(true);
    expect(again.tel === reference.tel, 'the telemetry').toBe(true);
  });

  test('another seed plays another turn, on the same dice in use', async () => {
    const other = play(await engineOn(11), TURN_SEED + 1);
    expect(other.state === reference.state, 'the world after the turn').toBe(false);
  });

  test('seed 0 plays as seed 1, as kcRngStream reads it', async () => {
    expect(play(await engineOn(33), 0)).toEqual(play(await engineOn(44), 1));
  });

  test('the seed is read as an unsigned 32-bit integer, as kcRngStream reads it', async () => {
    expect(play(await engineOn(33), TURN_SEED + 2 ** 32).state === reference.state, 'past 2^32').toBe(true);
    // At 2^31 and over, against the turn on the dice of that seed, lent by the test.
    const high = 0xfeed0001;
    const lent = await engineOn(44);
    pin(lent, high);
    expect(play(await engineOn(55), high + 2 ** 32).state === play(lent).state, 'at 2^31 and over').toBe(true);
  });

  test("it hands back the world, the log, the Spy-stealth step, what the reports read and what the save's check found, in that order", async () => {
    expect(Object.keys(resolve(await engineOn(55), TURN_SEED))).toEqual([
      'state',
      'log',
      'spyStealthAndInvisibilityStampedForTheReports',
      'whatTheReportsRead',
      // P1-15d: the places the save differs from this build's schema, for the shell's message
      'whereTheSaveDiffersFromThisBuildsSchema',
    ]);
  });
});

describe('the dice the shell lent the turn and its reports until P1-08m', () => {
  // The shell's way (P1-18e): the seed's dice lent around resolveTurn, then lent again around the stealth and the
  // reports (buildReports() until P1-12b2), the page drawing its own between the two. One stream, carried on: the
  // stealth draws where the turn stopped.
  let asTheShellLentThem: { played: Played; turnDrew: number; stealthDrew: number };
  beforeAll(async () => {
    const e = await engineOn(66);
    const s = e.kcRngStream(TURN_SEED);
    const turnDice = { n: 0, dice: () => 0 };
    turnDice.dice = () => {
      turnDice.n++;
      return s();
    };
    const lend = <T>(dice: () => number, fn: () => T): T => {
      const was = e.kcRng.use(dice);
      try {
        return fn();
      } finally {
        e.kcRng.use(was);
      }
    };
    const r = lend(turnDice.dice, () => resolve(e));
    const turnDrew = turnDice.n;
    for (let i = 0; i < 5; i++) draw(e);
    const { reports, tel } = lend(turnDice.dice, () => afterTheSave(e, r));
    asTheShellLentThem = {
      played: {
        state: r.state,
        log: JSON.stringify(r.log),
        reports: JSON.stringify(reports.map(({ gp, report }) => [gp.player_index, report])),
        tel: JSON.stringify(tel),
      },
      turnDrew,
      stealthDrew: turnDice.n - turnDrew,
    };
  });

  test('the turn rolls dice, and so does its Spy stealth (every hero is a Spy)', () => {
    expect(asTheShellLentThem.turnDrew).toBeGreaterThan(100);
    expect(asTheShellLentThem.stealthDrew).toBeGreaterThan(40);
  });

  test('given the seed, the turn plays the same, and its stealth carries on from its dice, whatever the page draws between', async () => {
    const e = await engineOn(77);
    const played = play(e, TURN_SEED, () => {
      for (let i = 0; i < 5; i++) draw(e);
    });
    expect(played.state === asTheShellLentThem.played.state, 'the world after the turn').toBe(true);
    expect(played.log === asTheShellLentThem.played.log, "the GM's log, with the stealth step's lines").toBe(true);
    expect(played.reports === asTheShellLentThem.played.reports, 'every report').toBe(true);
    expect(played.tel === asTheShellLentThem.played.tel, 'the telemetry').toBe(true);
  });

  test('with no seed, the turn on the dice the test lent it plays the same', async () => {
    const e = await engineOn(88);
    pin(e, TURN_SEED);
    expect(play(e).state === asTheShellLentThem.played.state).toBe(true);
  });
});

describe('the dice in use come back', () => {
  test('after the turn, after its stealth and after its reports, as they were', async () => {
    const e = await engineOn(1);
    pin(e, 77);
    const page = streamOf(e, 77);
    const r = resolve(e, TURN_SEED);
    expect(draw(e), 'after the turn').toBe(page());
    r.spyStealthAndInvisibilityStampedForTheReports();
    expect(draw(e), 'after the stealth').toBe(page());
    e.buildReports(r.whatTheReportsRead());
    expect(draw(e), 'after the reports').toBe(page());
  });

  test('after a save the turn cannot read', async () => {
    const e = await engineOn(1);
    pin(e, 77);
    const page = streamOf(e, 77);
    expect(() => resolve(e, TURN_SEED, '{not json')).toThrow(/Could not read the saved game/);
    expect(draw(e)).toBe(page());
  });

  test('after a stage that throws, once it has rolled the turn’s dice', async () => {
    const e = await engineOn(1);
    pin(e, 77);
    const page = streamOf(e, 77);
    standIn(
      e.standInTheStageAfterThePhases,
      () => {
        e.kcRng();
        e.kcRng();
        e.kcRng();
        throw new Error('a stage fails');
      },
      () => {
        expect(() => resolve(e, TURN_SEED)).toThrow('a stage fails');
      },
    );
    expect(draw(e)).toBe(page());
  });

  test('after a Spy-stealth step that throws, once it has rolled the turn’s dice, and after a second call', async () => {
    const e = await engineOn(1);
    pin(e, 77);
    const page = streamOf(e, 77);
    const r = resolve(e, TURN_SEED);
    expect(draw(e), 'after the turn').toBe(page());
    standIn(
      e.standInPerkTier,
      () => {
        e.kcRng();
        e.kcRng();
        e.kcRng();
        throw new Error('the stealth fails');
      },
      () => {
        expect(() => {
          r.spyStealthAndInvisibilityStampedForTheReports();
        }).toThrow('the stealth fails');
      },
    );
    expect(draw(e), 'after the stealth that threw').toBe(page());
    expect(() => {
      r.spyStealthAndInvisibilityStampedForTheReports();
    }).toThrow('the Spy stealth is rolled once a turn');
    expect(draw(e), 'after the second call').toBe(page());
  });

  test('after reports that throw, and after a second call', async () => {
    const e = await engineOn(1);
    pin(e, 77);
    const page = streamOf(e, 77);
    const r = resolve(e, TURN_SEED);
    expect(draw(e), 'after the turn').toBe(page());
    r.spyStealthAndInvisibilityStampedForTheReports();
    standIn(
      e.standInBuildTurnReport,
      () => {
        throw new Error('a report fails');
      },
      () => {
        expect(() => e.buildReports(r.whatTheReportsRead())).toThrow('a report fails');
      },
    );
    expect(draw(e), 'after the reports that threw').toBe(page());
    expect(() => e.buildReports(r.whatTheReportsRead())).toThrow('buildReports() runs once a turn');
    expect(draw(e), 'after the second call').toBe(page());
  });
});

describe('with no seed, the turn plays on the dice in use', () => {
  test('the turn and its stealth draw from them, and they stay in use', async () => {
    const e = await engineOn(1);
    const dice = countedDice(e, 9);
    const r = resolve(e);
    const turnDrew = dice.drawn();
    expect(turnDrew, 'the turn drew from them').toBeGreaterThan(100);
    expect(dice.stillInUse(), 'still in use after the turn').toBe(true);
    r.spyStealthAndInvisibilityStampedForTheReports();
    expect(dice.drawn() - turnDrew, 'the stealth drew from them').toBeGreaterThan(40);
    expect(dice.stillInUse(), 'still in use after the stealth').toBe(true);
    e.buildReports(r.whatTheReportsRead());
    expect(dice.stillInUse(), 'still in use after the reports').toBe(true);
  });

  test('a null seed is no seed', async () => {
    const e = await engineOn(1);
    const dice = countedDice(e, 9);
    afterTheSave(e, e.resolveTurn(WORLD, slotRows(), 1, null));
    expect(dice.drawn()).toBeGreaterThan(140);
  });

  test('with a seed, neither the turn nor its stealth nor its reports draw from them, and they stay in use', async () => {
    const e = await engineOn(1);
    const dice = countedDice(e, 9);
    const r = resolve(e, TURN_SEED);
    expect(dice.drawn(), 'the turn').toBe(0);
    expect(dice.stillInUse(), 'still in use after the turn').toBe(true);
    r.spyStealthAndInvisibilityStampedForTheReports();
    expect(dice.drawn(), 'the stealth').toBe(0);
    expect(dice.stillInUse(), 'still in use after the stealth').toBe(true);
    e.buildReports(r.whatTheReportsRead());
    expect(dice.drawn(), 'the reports').toBe(0);
    expect(dice.stillInUse(), 'still in use after the reports').toBe(true);
  });
});

describe('Properties of the turn’s dice', () => {
  // Three engines, reused: a turn changes no global but the dice in use and the caches it seeds afresh
  // (tests/unit/engine-purity.test.ts). The third plays with no seed, on the seed's dice lent by the test.
  let one: Engine, two: Engine, three: Engine;
  beforeAll(async () => {
    one = await engineOn(101);
    two = await engineOn(202);
    three = await engineOn(303);
  });
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
          afterTheSave(one, a);
          expect(draw(one), 'after the stealth and the reports').toBe(page());
          afterTheSave(two, b);
          pin(three, seed);
          const c = resolve(three);
          afterTheSave(three, c);
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
