// Helpers lifted out of resolveTurn in plan P1-08b, called directly in the bare vm (tests/lib/engine.ts):
// - provName (the balance matrix never runs it) and provOf: a province's name by id ('unknown' when there is none),
//   and the province a hero stands in.
// - neighborInDir (property, fast-check): on any map, the six compass directions name exactly a province's neighbours,
//   in getNeighborsP's order, the columns wrapping round and nothing past the top or bottom row.
// - Pre-battle damage (property): whatever a unit lost before the melee, a strength of at least 1 never rises and
//   never falls below 1; from this battle's damage alone, never below a quarter of it (PREBATTLE_STR_FLOOR).
// - Recruit limits (property): a province raises a unit type until its limit for the turn (1, or 2 for garrisons,
//   humanoid fleets, Goblin Hordes and a founder's own home), then no more, and no other type or province is touched.
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Helpers lifted in P1-08b, called directly through `lib/engine.ts`: `provName` (the balance matrix never runs it)
// gives a province's name by id, `unknown` when it has none; `provOf` the province a hero stands in. As properties
// (fast-check): on any map the six directions of `neighborInDir` name exactly a province's neighbours, in
// `getNeighborsP`'s order; pre-battle damage never raises a strength of at least 1 and never takes it below 1, nor,
// from a battle's damage alone, below a quarter (`applyPrebattleDamage`); a province raises a unit type up to its limit
// for the turn (1, or 2), then no more, touching no other type or province (`getRecruitLimit`, `canRecruit`,
// `recordRecruit`). Each check fails on a planted fault. Level 1: each function is called on a context made in the test
import vm from 'node:vm';
import fc from 'fast-check';
import { afterAll, describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);

describe('provName and provOf', () => {
  const provName = engineFn(engine, 'provName') as (tc: TurnContext, id: unknown) => string;
  const provOf = engineFn(engine, 'provOf') as (tc: TurnContext, c: { location: number }) => unknown;
  const tc = turnContext(engine, {
    world: { cols: 2, rows: 1, provinces: [{ id: 0, name: 'Highmere' }, { id: 1 }] },
  });

  test("a province's name by id, and 'unknown' when it has none or there is no such province", () => {
    expect(provName(tc, 0)).toBe('Highmere');
    expect(provName(tc, 1)).toBe('unknown');
    expect(provName(tc, 7)).toBe('unknown');
    expect(provName(tc, null)).toBe('unknown');
  });

  test('the province a hero stands in', () => {
    expect(provOf(tc, { location: 0 })).toBe((tc.G['world'] as { provinces: unknown[] }).provinces[0]);
    expect(provOf(tc, { location: 5 })).toBeUndefined();
  });
});

describe('neighborInDir', () => {
  type Prov = { id: number; row: number; col: number };
  const neighborInDir = engineFn(engine, 'neighborInDir') as (tc: TurnContext, p: Prov, dir: string) => Prov | null;
  const getNeighborsP = engineFn(engine, 'getNeighborsP') as (
    p: Prov,
    cols: number,
    rows: number,
    ps: Prov[],
  ) => Prov[];
  const DIRS = vm.runInContext('HEX_DIRS.slice()', engine) as string[];
  const map = fc
    .record({ cols: fc.integer({ min: 2, max: 14 }), rows: fc.integer({ min: 1, max: 10 }) })
    .chain(({ cols, rows }) => fc.tuple(fc.constant({ cols, rows }), fc.integer({ min: 0, max: cols * rows - 1 })));

  test('the six directions are NW, NE, W, E, SW, SE', () => {
    expect(DIRS).toEqual(['NW', 'NE', 'W', 'E', 'SW', 'SE']);
  });

  test("on any map, the six directions name exactly a province's neighbours, in getNeighborsP's order", () => {
    fc.assert(
      fc.property(map, ([{ cols, rows }, at]) => {
        const provinces: Prov[] = Array.from({ length: cols * rows }, (_, id) => ({
          id,
          row: Math.floor(id / cols),
          col: id % cols,
        }));
        const tc = turnContext(engine, { world: { cols, rows, provinces } });
        const ps = (tc.G['world'] as { provinces: Prov[] }).provinces;
        const p = ps[at];
        if (!p) throw new Error('no province ' + String(at));
        const byDir = DIRS.map((d) => neighborInDir(tc, p, d));
        expect(byDir.filter(Boolean)).toEqual(getNeighborsP(p, cols, rows, ps));
        for (const [i, n] of byDir.entries()) {
          if (!n) continue;
          expect(Math.abs(n.row - p.row), `${DIRS[i] ?? ''} is a row away at most`).toBeLessThanOrEqual(1);
        }
        expect(neighborInDir(tc, p, 'N'), 'no such direction').toBeNull();
      }),
      { examples: [[[{ cols: 2, rows: 1 }, 0]], [[{ cols: 3, rows: 3 }, 4]]] },
    );
  });
});

describe('pre-battle damage', () => {
  const applyPrebattleDamage = engineFn(engine, 'applyPrebattleDamage') as (army: object, str: number) => number;
  const FLOOR = vm.runInContext('PREBATTLE_STR_FLOOR', engine) as number;
  const strength = fc.double({ min: 1, max: 500, noNaN: true });
  const loss = fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: undefined });

  test('a strength of at least 1 never rises and never falls below 1', () => {
    fc.assert(
      fc.property(strength, loss, loss, (str, battle, turn) => {
        const after = applyPrebattleDamage({ _tempStrReduction: battle, _turnStrReduction: turn }, str);
        expect(after).toBeLessThanOrEqual(str);
        expect(after).toBeGreaterThanOrEqual(1);
      }),
      { examples: [[1, 1000, 1000]] },
    );
  });

  test("from this battle's damage alone, never below a quarter of the strength", () => {
    expect(FLOOR).toBe(0.25);
    fc.assert(
      fc.property(strength, fc.double({ min: 0, max: 1000, noNaN: true }), (str, battle) => {
        const after = applyPrebattleDamage({ _tempStrReduction: battle }, str);
        expect(after).toBeGreaterThanOrEqual(Math.max(1, Math.floor(str * FLOOR)));
      }),
    );
  });

  test('no damage leaves the strength as it is', () => {
    expect(applyPrebattleDamage({}, 17.5)).toBe(17.5);
  });
});

describe('recruit limits', () => {
  type Recruit = (tc: TurnContext, armyType: string, provId: number, prov: object, pi: number) => boolean;
  const getRecruitLimit = engineFn(engine, 'getRecruitLimit') as (
    tc: TurnContext,
    armyType: string,
    prov: object,
    pi: number,
  ) => number;
  const canRecruit = engineFn(engine, 'canRecruit') as Recruit;
  const recordRecruit = engineFn(engine, 'recordRecruit') as (
    tc: TurnContext,
    armyType: string,
    provId: number,
    qty?: number,
  ) => void;
  const tc = turnContext(engine, botWorld(engine, 2, { cols: 8, rows: 6 }));
  const provinces = (tc.G['world'] as { provinces: { id: number; owner: number | null }[] }).provinces;
  const TYPES = Object.keys(vm.runInContext('ARMY_SPEED_MASTER', engine) as object).concat(['Human Garrison']);
  const homeProvinceIdFor = engineFn(engine, 'homeProvinceIdFor') as (gs: object, pi: number) => number;
  const homes = [homeProvinceIdFor(tc.G, 0), homeProvinceIdFor(tc.G, 1)];

  test('a province raises a unit type up to its limit for the turn, then no more, touching nothing else', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TYPES),
        fc.constantFrom(...provinces.map((p) => p.id)),
        fc.integer({ min: 0, max: 1 }),
        (type, provId, pi) => {
          tc['recruitedThisTurn'] = {};
          const prov = provinces[provId];
          if (!prov) throw new Error('no province ' + String(provId));
          const limit = getRecruitLimit(tc, type, prov, pi);
          expect([1, 2]).toContain(limit);
          let raised = 0;
          while (canRecruit(tc, type, provId, prov, pi) && raised < 5) {
            recordRecruit(tc, type, provId);
            raised++;
          }
          expect(raised).toBe(limit);
          expect(Object.keys(tc['recruitedThisTurn'] as object)).toEqual([`${String(provId)}:${type}`]);
        },
      ),
      { examples: [['Goblin Horde', homes[0] ?? 0, 0]] },
    );
  });

  test("two a turn of anything in a founder's own home, one elsewhere", () => {
    const home = provinces.find((p) => p.id === homes[0] && p.owner === 0);
    const other = provinces.find((p) => p.owner == null);
    if (!home || !other) throw new Error('no home or no unowned province on this map');
    expect(getRecruitLimit(tc, 'Free Lances', home, 0)).toBe(2);
    expect(getRecruitLimit(tc, 'Free Lances', other, 0)).toBe(1);
  });
});
