// The rules the player portal takes through src/shared/ (the door: src/shared/the-engines-rules-the-player-portal-shares.ts)
// answer alike on the report's value and on the state's it was made from (plan P1-11a2, P1-11a4, P1-11b3, P1-11b4; since
// P1-11e43 apart from the copies' test): the report hands the portal what the engine reads.
// Level 1 (unit): pure functions on values, from a game played with the engine's modules imported directly and a world
// staged through the report's own projection. No page is needed, and a static test can't compare what a function
// answers on two values.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The values: the balance matrix's game scripted-05, played with the engine's modules imported directly (its scripted
// realm's report after every turn, and the state it was built from), and a staged world handed through the report's own
// projection (`buildTurnReport`): every catalogue item (and each race-bound one under the race's old name), held by a
// hero of every race and alignment; every unit type at every quality, plain, skeletal, summoned for the turn or of the
// Wild Hunt; every column of one to three units of each kind, led with and without Naval 8 (and at Naval 7). For the 9
// rules whose value the report makes from the state (`unitTypeOf`, `unitBaseStrength`, `isLegendaryItem`, `itemSlot`,
// `itemRaceOf`, `itemUsableBy`, `topSkillOf` with `skillFameLabelM`, `isAirCarriable`, `getFlyCapability`), for
// `countsAgainstBeastCommand` (P1-11b3: on the report's unit, its flags as the realm sees them, against
// `beastCommandCount` on the state's) and for `seaLiftOfAColumn` (P1-11b4: on every column under its leader, against
// `getSeaCapability` on the state's), the engine's function on the report's value and on the state's: the same answer,
// at 0 differences; the values reach every catalogue item and every unit type at every quality; and each function
// leaves its input as it was (the values are frozen, so a write throws).
import { beforeAll, describe, expect, test } from 'vitest';
import {
  type ProjectionComparison,
  PROJECTIONS,
  sameAnswer,
  samples,
  type Samples,
  theGamePlayed,
} from '../lib/the-worlds-and-the-checks-of-the-portals-forecasts-and-copies-against-the-turn.ts';
import {
  ALL_MAGIC_ITEMS_P,
  KC_QUALITY_TIERS,
  KC_UNIT_TYPE,
  LEGENDARY_ITEMS_P,
} from '../../src/content/kingdoms-call-data.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

let values: Samples;
// Each projection's comparisons, made once: by its name.
const made = new Map<string, ProjectionComparison[]>();
function once(name: string, make: () => ProjectionComparison[]): ProjectionComparison[] {
  const kept = made.get(name);
  if (kept) return kept;
  const list = make();
  made.set(name, list);
  return list;
}
const casesOf = (p: (typeof PROJECTIONS)[number]) => once(`${p.engine} projection`, () => p.cases(values));
// The values, in one hook with a whole game's limit (the game, then the samples with the staged world).
beforeAll(
  () => {
    theGamePlayed();
    values = samples();
  },
  timeLimitForTheWork({ matrixGamesPlayed: 1 }).timeout,
);

/** A value in a line short enough to read (cut to 160 characters). */
const short = (x: unknown) =>
  JSON.stringify(x, (_k, v: unknown) => (v === undefined ? '(undefined)' : v)).slice(0, 160);
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

describe('the 11 rules the portal calls the engine for whose value the report makes from the state (P1-11a4, P1-11b3, P1-11b4)', () => {
  test('there are 11', () => {
    expect(PROJECTIONS).toHaveLength(11);
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

test('each engine function leaves its input as it was (the values are frozen: a write throws)', () => {
  const changed = PROJECTIONS.flatMap((p) => casesOf(p))
    .filter((c) => c.engineChangedItsInput)
    .map((c) => `on ${JSON.stringify(c.on).slice(0, 160)}`);
  expect(changed).toEqual([]);
});
