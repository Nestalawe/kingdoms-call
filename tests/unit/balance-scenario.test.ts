// The named balance scenarios (tools/balance/scenario.ts, P1-03c): the comparison of a scenario's runs on two builds,
// paired by seed, in the balance report's words; the staging helpers that pick what a run measures; what a required
// scenario's runs missed, and the scripted cases the games must still meet (P1-15e2b, run.ts); and the scenarios
// themselves (tests/balance/scenarios/): each is there, runs 400 times (a required one 20), and has a label for every
// figure. Level 1 (unit): pure functions on made-up runs with a known answer. Playing the scenes is too slow for the
// tests (about a second a run); npm run balance does that for a required one, npm run balance -- <scenario> for any.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The named balance scenarios (P1-03c) on made-up runs with known answers: identical runs are "no change", with each
// side's figure, its 95% range and its cases; 40 of 400 runs losing a win is a clear change in 40 runs, named in the
// verdict; 2 of 400 is within the noise; too few cases says so; a run measures only the first clash in the staged
// province; and each scenario in `balance/scenarios/` runs 400 times (a required one 20) with a label for every figure
// and its required figures among them. What a required scenario's runs missed (P1-15e2b): a figure required in every
// run, shown in all 20 and missing from one (its count said); required in some run, shown in one and in none; a figure
// no run has; a failed run, listed first; no runs; no requirements, nothing missed. The scripted cases the games must
// meet: a set with no held chase passes (a scenario gives it), one with no Encounter Character fails; the scenario that
// gives the case is there and requires figures. TypeScript, in `unit/`
import { describe, expect, test } from 'vitest';
import type { Turn } from '../lib/scenario.js';
import { labelOf } from '../../tools/balance/labels.ts';
import { figureRange } from '../../tools/balance/paired.ts';
import { CASES_A_REQUIRED_SCENARIO_GIVES, theScriptedCasesThatNeverHappened } from '../../tools/balance/run.ts';
import {
  compareScenario,
  firstClashIn,
  measure,
  renderScenario,
  scenarioFile,
  scenarioNames,
  whatAScenariosRunsMissed,
  type Scenario,
  type ScenarioRequirement,
  type World,
} from '../../tools/balance/scenario.ts';
import type { Battle, Stats, TelemetryRow } from '../../tools/balance/stats.ts';

// 400 runs of one battle each: the attacker wins every other run.
const WON = 'battles: attacker won';
const LOST = 'battles: units lost by the attacker';
const base: Stats[] = Array.from({ length: 400 }, (_, i) => ({ [WON]: [i % 2, 1], [LOST]: [i % 3, 1] }));
/** The same runs, with the attacker's win taken away in the first `n` runs it won. */
const fewerWins = (n: number): Stats[] => base.map((s, i) => (i % 2 === 1 && i < 2 * n ? { ...s, [WON]: [0, 1] } : s));

describe('a scenario on two builds, paired by seed', () => {
  test('identical runs: no change, every figure on both sides with its own range', () => {
    const r = compareScenario([WON, LOST], base, structuredClone(base));
    expect(r.changedRuns).toBe(0);
    const won = r.rows[0];
    expect(won).toMatchObject({ label: 'Battles won by the attacker', diff: '+0.0', runs: 0 });
    expect(won?.base).toEqual(won?.head);
    expect(won?.base.value).toBe('50.0%');
    expect(won?.base.cases).toBe(400);
    expect(won?.base.range95).toMatch(/^4\d\.\d% to 5\d\.\d%$/);
    const text = renderScenario({ name: 'battle', title: 'A staged battle', base: 'main', head: 'here', result: r });
    expect(text).toContain('**No change: all 400 runs played out exactly as before.**');
  });

  test('the attacker loses 40 runs it won: a clear change, in 40 runs, named first', () => {
    const r = compareScenario([WON, LOST], base, fewerWins(40));
    expect(r.changedRuns).toBe(40);
    expect(r.rows[0]).toMatchObject({ head: { value: '40.0%' }, diff: '−10.0', verdict: 'clear change', runs: 40 });
    expect(r.rows[1]).toMatchObject({ verdict: 'within the noise', runs: 0 });
    const text = renderScenario({ name: 'battle', title: 'A staged battle', base: 'main', head: 'here', result: r });
    expect(text).toContain(
      '**40 of 400 runs played out differently. Beyond the noise: Battles won by the attacker: 50.0% → 40.0% (clear change).**',
    );
    expect(text).toContain('| Battles won by the attacker | 50.0% (');
  });

  test('2 runs of 400 changed: played out differently, but within the noise', () => {
    const r = compareScenario([WON], base, fewerWins(2));
    expect(r.rows[0]?.verdict).toBe('within the noise');
    const text = renderScenario({ name: 'battle', title: 'A staged battle', base: 'main', head: 'here', result: r });
    expect(text).toContain('**2 of 400 runs played out differently, all within the noise.**');
  });

  test('a figure with too few cases says so', () => {
    const few = base.map((s, i) => (i < 10 ? s : { [LOST]: s[LOST] ?? [0, 0] }));
    expect(compareScenario([WON], few, few).rows[0]?.verdict).toBe('too few to tell');
  });

  test("one side's figure: its value, the cases behind it, and a 95% range around it", () => {
    const f = figureRange(base, WON);
    expect(f.value).toBe(0.5);
    expect(f.cases).toBe(400);
    expect(f.range95[0]).toBeLessThan(0.5);
    expect(f.range95[1]).toBeGreaterThan(0.5);
    expect(f.range95[1] - f.range95[0]).toBeCloseTo(0.1, 1); // ±1.96 × √(0.25 / 400)
  });
});

describe('what a run measures', () => {
  const battle = (ph: number, prov: number, won: boolean): Battle => ({
    ph,
    prov,
    terrain: 'hills',
    kind: 'pvp',
    atkPi: 0,
    atkChar: 1,
    defPi: 1,
    defChar: 2,
    won,
    atkLost: 1,
    defLost: 0,
    side: 'atk',
  });
  const turn = (battles: Battle[]) =>
    ({
      S: {},
      S2: { world: { provinces: [] } },
      log: [],
      events: [
        {
          turn: 1,
          player_index: 0,
          pre: { gold: 0, provinces: 0, str: 0 },
          post: { gold: 0, provinces: 0, str: 0 },
          outcomes: {
            battles: { list: battles },
            encounters: { list: [] },
            deaths: { list: [] },
            spells: { list: [] },
            delta: { items: 0 },
          },
        } satisfies TelemetryRow,
      ],
      extra: null,
      text: () => '',
    }) as unknown as Turn<World>;

  test("the first clash only: the same battle fought again later in the turn, and a battle elsewhere, don't count", () => {
    const t = turn([battle(1, 7, false), battle(2, 7, true), battle(3, 7, true), battle(1, 8, true)]);
    const s = measure(t, firstClashIn(t, 7));
    expect(s[WON]).toEqual([0, 1]);
    expect(s['battles: fought']).toEqual([1, 1]);
  });

  test('without a filter, every battle of the turn counts, as in the matrix', () => {
    const t = turn([battle(1, 7, false), battle(2, 7, true)]);
    expect(measure(t)[WON]).toEqual([1, 2]);
  });
});

describe("what a required scenario's runs missed", () => {
  const HELD = 'chases: waited for a battle | when: in Early Summer';
  const CAUGHT = 'chases: waited for a battle | when: on the catch in Spring';
  const everyRun: ScenarioRequirement = { figure: HELD, in: 'every run', what: 'held in Early Summer' };
  const someRun: ScenarioRequirement = { figure: CAUGHT, in: 'some run', what: 'held on the catch' };
  /** 20 runs: HELD in each but those in `notHeld`, CAUGHT in those in `caught`. */
  const runs = (notHeld: number[], caught: number[]): Stats[] =>
    Array.from({ length: 20 }, (_, i) => ({
      [HELD]: [notHeld.includes(i) ? 0 : 1, 1],
      [CAUGHT]: [caught.includes(i) ? 1 : 0, 1],
    }));

  test('a figure required in every run, shown in every run: nothing missed', () => {
    expect(whatAScenariosRunsMissed({ requires: [everyRun] }, runs([], []))).toEqual([]);
  });

  test('a figure required in every run, missing from one run: missed, with how many runs showed it', () => {
    expect(whatAScenariosRunsMissed({ requires: [everyRun] }, runs([7], []))).toEqual([
      'held in Early Summer: in 19 of 20 runs (needed in every run)',
    ]);
  });

  test('a figure required in some run, shown in one run only: nothing missed', () => {
    expect(whatAScenariosRunsMissed({ requires: [someRun] }, runs([], [12]))).toEqual([]);
  });

  test('a figure required in some run, shown in none: missed', () => {
    expect(whatAScenariosRunsMissed({ requires: [everyRun, someRun] }, runs([], []))).toEqual([
      'held on the catch: in 0 of 20 runs (needed in some run)',
    ]);
  });

  test('a figure no run has at all is missed, as a 0 is', () => {
    expect(whatAScenariosRunsMissed({ requires: [someRun] }, [{}, {}])).toEqual([
      'held on the catch: in 0 of 2 runs (needed in some run)',
    ]);
  });

  test('a run that failed fails it, listed first, and counts as a run that showed nothing', () => {
    const played = runs([], [3]);
    played[3] = {}; // scenario-run.ts gives a failed run no statistics
    expect(whatAScenariosRunsMissed({ requires: [everyRun, someRun] }, played, ['run 4: could not stage: …'])).toEqual([
      'run 4: could not stage: …',
      'held in Early Summer: in 19 of 20 runs (needed in every run)',
      'held on the catch: in 0 of 20 runs (needed in some run)',
    ]);
  });

  test('no runs at all: a figure required in every run is missed', () => {
    expect(whatAScenariosRunsMissed({ requires: [everyRun] }, [])).toEqual([
      'held in Early Summer: in 0 of 0 runs (needed in every run)',
    ]);
  });

  test('a scenario with no requirements misses nothing, whatever its runs show', () => {
    expect(whatAScenariosRunsMissed({}, runs([0, 1, 2], []))).toEqual([]);
    expect(whatAScenariosRunsMissed({ requires: [] }, [{}])).toEqual([]);
  });
});

describe('the scripted cases the games must meet', () => {
  test("the games' held chase is given by a scenario: a set whose games hold no chase passes", () => {
    expect(theScriptedCasesThatNeverHappened({ encounter: 36, battleChase: 0 })).toEqual([]);
  });

  test('a set with no Encounter Character fails, held chases or not', () => {
    expect(theScriptedCasesThatNeverHappened({ encounter: 0, battleChase: 4 })).toEqual(['Encounter Character']);
    expect(theScriptedCasesThatNeverHappened({ encounter: 0, battleChase: 0 })).toEqual(['Encounter Character']);
  });
});

describe('the named scenarios', () => {
  const load = async (name: string) => ((await import(scenarioFile(name))) as { default: Scenario }).default;

  test('the first three are there, and the required one', () => {
    expect(scenarioNames()).toEqual(
      expect.arrayContaining(['battle', 'encounter', 'lair', 'a-chase-held-by-an-unresolved-battle']),
    );
  });

  test.for(scenarioNames())(
    '%s: 400 runs (a required one 20), a title, and a plain-words label for every figure',
    async (name) => {
      const s = await load(name);
      expect(s.runs).toBe(s.requires ? 20 : 400);
      expect(s.title).not.toBe('');
      expect(s.figures.length).toBeGreaterThan(0);
      expect(s.figures.filter((f) => labelOf(f) == null)).toEqual([]);
      expect((s.requires ?? []).filter((r) => !s.figures.includes(r.figure))).toEqual([]);
    },
  );

  test('each scenario that gives a scripted case is there and requires figures', async () => {
    const names = Object.values(CASES_A_REQUIRED_SCENARIO_GIVES);
    expect(names).toEqual(['a-chase-held-by-an-unresolved-battle']);
    for (const name of names) expect((await load(name)).requires?.length).toBeGreaterThan(0);
  });
});
