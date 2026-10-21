// The player portal's copies of the engine's rules agree with the engine, and the report hands the portal what the
// engine reads (plan P1-11a2, P1-11a4; the checks and the values in tests/lib/player-portal-copies.ts). P1-11a4 swapped
// the 16 copies that agreed for the engine's own functions (the portal imports them through src/shared/), so their
// swap cases went with them; for the 9 whose value the report makes from the state, the truth case stays as a
// projection case: the engine's function on the report's value and on the state's, the same answer. For three copies
// that stay until P1-11b, the truth: the copy on the report's value, the engine's function on the state's. And each
// engine function leaves its input as it was.
// Level 1 (unit): pure functions on values, from a game played with the engine's modules imported directly and a world
// staged through the report's own projection. No page is needed, and a static test can't compare what two functions
// answer.
import { beforeAll, describe, expect, test } from 'vitest';
import {
  type Comparison,
  type Copies,
  effMagicLvlAgainstTheReport,
  playerPortalCopies,
  type ProjectionComparison,
  PROJECTIONS,
  sameAnswer,
  samples,
  type Samples,
  STAYING,
} from '../lib/player-portal-copies.ts';
import {
  ALL_MAGIC_ITEMS_P,
  KC_QUALITY_TIERS,
  KC_UNIT_TYPE,
  LEGENDARY_ITEMS_P,
} from '../../src/content/kingdoms-call-data.ts';

let copies: Copies;
let values: Samples;
// Each check's comparisons, made once: by its name.
const made = new Map<string, Comparison[] | ProjectionComparison[]>();
function once<T extends Comparison[] | ProjectionComparison[]>(name: string, make: () => T): T {
  const kept = made.get(name);
  if (kept) return kept as T;
  const list = make();
  made.set(name, list);
  return list;
}
const truthOf = (pair: (typeof STAYING)[number]) => once(`${pair.copy} truth`, () => pair.truth(copies, values));
const casesOf = (p: (typeof PROJECTIONS)[number]) => once(`${p.engine} projection`, () => p.cases(values));
beforeAll(() => {
  copies = playerPortalCopies();
  values = samples();
});

/** A value in a line short enough to read (cut to 160 characters). */
const short = (x: unknown) =>
  JSON.stringify(x, (_k, v: unknown) => (v === undefined ? '(undefined)' : v)).slice(0, 160);
/** The comparisons that differ, each in a line. */
function differences(list: Comparison[]): string[] {
  return list
    .filter((c) => !sameAnswer(c.copy, c.engine))
    .map((c) => `on ${short(c.on)}: the copy ${short(c.copy)}, the engine ${short(c.engine)}`);
}
/** The projection cases that differ, each in a line. */
function projectionDifferences(list: ProjectionComparison[]): string[] {
  return list
    .filter((c) => !sameAnswer(c.fromTheReport, c.fromTheState))
    .map(
      (c) =>
        `on ${short(c.on)}: on the report's value ${short(c.fromTheReport)}, on the state's ${short(c.fromTheState)}`,
    );
}

test("the values reach every catalogue item and every unit type at every quality, each with the state's value", () => {
  const names = (list: unknown) =>
    new Set((Array.isArray(list) ? list : []).map((it: unknown) => (it as { name?: unknown }).name));
  const itemNames = new Set(values.items.filter((i) => i.state).map((i) => i.report['name']));
  const catalogue = [...names(ALL_MAGIC_ITEMS_P), ...names(LEGENDARY_ITEMS_P), 'Mithril Armour'];
  expect(catalogue.filter((n) => !itemNames.has(n))).toEqual([]);
  const units = new Set(
    values.armies.filter((a) => a.state).map((a) => `${String(a.report['type'])} ${String(a.report['quality'])}`),
  );
  const every = Object.keys(KC_UNIT_TYPE).flatMap((t) => KC_QUALITY_TIERS.map((q) => `${t} ${q}`));
  expect(every.filter((u) => !units.has(u))).toEqual([]);
  // the game's reports (scripted-05, one a turn until it ends) and the staged world's
  expect(values.reports).toBeGreaterThan(10);
  expect(values.heroes.filter((h) => h.state).length).toBeGreaterThan(500);
});

describe('the 9 rules the portal calls the engine for whose value the report makes from the state (P1-11a4)', () => {
  test('there are 9', () => {
    expect(PROJECTIONS).toHaveLength(9);
  });
  test.each(PROJECTIONS.map((p) => [`${p.engine} (for ${p.retiredCopy})`, p] as const))(
    "%s: the engine's function on the report's value and on the state's: the same answer",
    (_name, projection) => {
      const list = casesOf(projection);
      expect(list.length).toBeGreaterThan(0);
      expect(projectionDifferences(list)).toEqual([]);
    },
  );
});

describe('three copies that stay until P1-11b (they read the report’s shape)', () => {
  test.each(STAYING.map((p) => [`${p.copy} and ${p.engine}`, p] as const))(
    "%s: the copy on the report's value, the engine's function on the state's: the same answer",
    (_name, pair) => {
      const list = truthOf(pair);
      expect(list.length).toBeGreaterThan(0);
      expect(differences(list)).toEqual([]);
    },
  );

  test("effMagicLvl is the report's effective level of each magic school, but for the Crown of Command's aura", () => {
    // The order form offers spells by effMagicLvl (a school's level and the hero's items); the turn casts at the
    // report's skillEff, which also counts the aura of a Crown of Command worn by a hero of his realm in his province
    // (a Curse too, but a Curse ends with the turn, so no report shows one). Where there is no aura the two agree;
    // where there is, the form's level is one lower (STATUS, Parked: the Warlock's extra cast; P1-11b).
    const list = effMagicLvlAgainstTheReport(copies, values);
    const withAura = list.filter((x) => x.aura !== 0);
    expect(list.filter((x) => x.aura === 0 && x.copy !== x.report)).toEqual([]);
    expect(withAura.length).toBeGreaterThan(0);
    expect(withAura.filter((x) => x.copy !== x.report - x.aura)).toEqual([]);
  });
});

test('each engine function leaves its input as it was (the values are frozen: a write throws)', () => {
  const changed = [...PROJECTIONS.flatMap((p) => casesOf(p)), ...STAYING.flatMap((pair) => truthOf(pair))]
    .filter((c) => c.engineChangedItsInput)
    .map((c) => `on ${JSON.stringify(c.on).slice(0, 160)}`);
  expect(changed).toEqual([]);
});
