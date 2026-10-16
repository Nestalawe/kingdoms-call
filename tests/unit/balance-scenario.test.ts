// The named balance scenarios (tools/balance/scenario.ts, P1-03c): the comparison of a scenario's runs on two builds,
// paired by seed, in the balance report's words; the staging helpers that pick what a run measures; and the three
// scenarios themselves (tests/balance/scenarios/): each is there, runs 400 times, and has a label for every figure.
// Level 1 (unit): pure functions on made-up runs with a known answer. Playing the scenes is too slow for npm test
// (about a second a run); npm run balance -- <scenario> does that.
import { describe, expect, test } from 'vitest';
import type { Turn } from '../lib/scenario.js';
import { labelOf } from '../../tools/balance/labels.ts';
import { figureRange } from '../../tools/balance/paired.ts';
import {
  compareScenario,
  firstClashIn,
  measure,
  renderScenario,
  scenarioFile,
  scenarioNames,
  type Scenario,
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

describe('the named scenarios', () => {
  const load = async (name: string) => ((await import(scenarioFile(name))) as { default: Scenario }).default;

  test('the first three are there', () => {
    expect(scenarioNames()).toEqual(expect.arrayContaining(['battle', 'encounter', 'lair']));
  });

  test.for(scenarioNames())('%s: 400 runs, a title, and a plain-words label for every figure', async (name) => {
    const s = await load(name);
    expect(s.runs).toBe(400);
    expect(s.title).not.toBe('');
    expect(s.figures.length).toBeGreaterThan(0);
    expect(s.figures.filter((f) => labelOf(f) == null)).toEqual([]);
  });
});
