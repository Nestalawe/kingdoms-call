// The player portal's copies of the engine's rules agree with the engine (plan P1-11a2; the pairs and the values in
// tests/lib/player-portal-copies.ts). For each of the 16 copies P1-11a swaps for the engine's function: the swap (the
// copy and the engine's function on what the portal is handed) and, where the report makes that value from the state,
// the truth (the copy on the report's value, the engine's function on the state's). For three copies that stay until
// P1-11b, the truth alone. And each engine function leaves its input as it was. P1-11a4 swaps the 16: their swap cases
// go then, their truth cases stay as projection cases.
// Level 1 (unit): pure functions on values, from a game played with the engine's modules imported directly and a world
// staged through the report's own projection. No page is needed, and a static test can't compare what two functions
// answer.
import { beforeAll, describe, expect, test } from 'vitest';
import {
  type Comparison,
  type Copies,
  effMagicLvlAgainstTheReport,
  PAIRS,
  playerPortalCopies,
  sameAnswer,
  samples,
  type Samples,
  STAYING,
} from '../lib/player-portal-copies.ts';
import {
  ALL_MAGIC_ITEMS_P,
  KC_ALIGNMENTS,
  KC_QUALITY_TIERS,
  KC_UNIT_TYPE,
  LEGENDARY_ITEMS_P,
} from '../../src/content/kingdoms-call-data.ts';

let copies: Copies;
let values: Samples;
// Each pair's comparisons, made once: by the pair's name and the way ('swap' or 'truth').
const made = new Map<string, Comparison[]>();
const comparisons = (name: string, way: 'swap' | 'truth', make: (c: Copies, s: Samples) => Comparison[]) => {
  const key = `${name} ${way}`;
  const kept = made.get(key);
  if (kept) return kept;
  const list = make(copies, values);
  made.set(key, list);
  return list;
};
beforeAll(() => {
  copies = playerPortalCopies();
  values = samples();
});

/** The comparisons that differ, each in a line short enough to read (the value cut to 160 characters). */
function differences(list: Comparison[]): string[] {
  const short = (x: unknown) =>
    JSON.stringify(x, (_k, v: unknown) => (v === undefined ? '(undefined)' : v)).slice(0, 160);
  return list
    .filter((c) => !sameAnswer(c.copy, c.engine))
    .map((c) => `on ${short(c.on)}: the copy ${short(c.copy)}, the engine ${short(c.engine)}`);
}

test('the values reach every catalogue item, every unit type at every quality, every alignment pair and level', () => {
  const names = (list: unknown) =>
    new Set((Array.isArray(list) ? list : []).map((it: unknown) => (it as { name?: unknown }).name));
  const itemNames = new Set(values.items.map((i) => i.report['name']));
  const catalogue = [...names(ALL_MAGIC_ITEMS_P), ...names(LEGENDARY_ITEMS_P), 'Mithril Armour'];
  expect(catalogue.filter((n) => !itemNames.has(n))).toEqual([]);
  const units = new Set(values.armies.map((a) => `${String(a.report['type'])} ${String(a.report['quality'])}`));
  const every = Object.keys(KC_UNIT_TYPE).flatMap((t) => KC_QUALITY_TIERS.map((q) => `${t} ${q}`));
  expect(every.filter((u) => !units.has(u))).toEqual([]);
  expect(values.alignmentPairs).toHaveLength((KC_ALIGNMENTS.length + 2) ** 2);
  expect(values.levels).toEqual(expect.arrayContaining([-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  // the game's reports (scripted-05, one a turn until it ends) and the staged world's
  expect(values.reports).toBeGreaterThan(10);
  expect(values.heroes.filter((h) => h.state).length).toBeGreaterThan(500);
});

describe('the 16 copies P1-11a swaps for the engine’s function', () => {
  test('there are 16', () => {
    expect(PAIRS).toHaveLength(16);
  });
  describe.each(PAIRS.map((p) => [`${p.copy} and ${p.engine}`, p] as const))('%s', (_name, pair) => {
    test(`swap: the same answer on ${pair.on}`, () => {
      const list = comparisons(pair.copy, 'swap', pair.swap);
      expect(list.length).toBeGreaterThan(0);
      expect(differences(list)).toEqual([]);
    });
    if (pair.truth) {
      const truth = pair.truth;
      test("truth: the copy on the report's value, the engine's function on the state's: the same answer", () => {
        const list = comparisons(pair.copy, 'truth', truth);
        expect(list.length).toBeGreaterThan(0);
        expect(differences(list)).toEqual([]);
      });
    }
  });
});

describe('three copies that stay until P1-11b (they read the report’s shape)', () => {
  test.each(STAYING.map((p) => [`${p.copy} and ${p.engine}`, p] as const))(
    "%s: the copy on the report's value, the engine's function on the state's: the same answer",
    (_name, pair) => {
      const list = comparisons(pair.copy, 'truth', pair.truth);
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
  const changed = [
    ...PAIRS.flatMap((pair) => [
      ...comparisons(pair.copy, 'swap', pair.swap),
      ...(pair.truth ? comparisons(pair.copy, 'truth', pair.truth) : []),
    ]),
    ...STAYING.flatMap((pair) => comparisons(pair.copy, 'truth', pair.truth)),
  ]
    .filter((c) => c.engineChangedItsInput)
    .map((c) => `on ${JSON.stringify(c.on).slice(0, 160)}`);
  expect(changed).toEqual([]);
});
