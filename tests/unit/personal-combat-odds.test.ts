// The odds of personal combat, called directly (plan P1-08e lifted them out of resolveTurn):
// - The courage test against terror (pcCourageChance), which the balance matrix never runs: no guardian's ability
//   calls for it today. Its own comment's examples (a Melee 1 novice of Brave temper breaks on 40%, a Melee 9 master
//   with White 2 on 10%), the creature's stature, and, as a property, a chance from 10% to 70% whoever faces whom.
// - Properties (fast-check) of the chances every fight rolls, for any heroes and guardians and any penalties,
//   bonuses and wards on them: a melee blow lands from 5% to 80%, and never above 80% less the defender's guard
//   (pcHitChance); an arrow from 5% to 80% (pcArrowHitChance); a flight from 5% to 95% (pcFleeChance); a change of
//   range from 10% to 90% (pcMoveCheck). Each is a whole number.
// Level 1 (unit): each function is called in the bare vm (tests/lib/personal-combat.ts) on combatants built there.
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { clone, personalCombatEngine, type Combatant } from '../lib/personal-combat.ts';

const { call, value, base, MON } = personalCombatEngine();
const TEMPERS = value('TEMPERS_P') as string[];
const HIT_MIN = value('PC_HIT_MIN') as number;
const HIT_MAX = value('PC_HIT_MAX') as number;
const guardOf = (temper: unknown) =>
  Math.max(0, (value('temperOf') as (t: unknown) => { defence?: number })(temper).defence ?? 0);

/** A combatant as pcCourageChance reads it: raw skills, White Magic, temper; a guardian's stature on its `ref`. */
const foe = (melee: number, temper: string, white = 0, archery = 0) => ({
  meleeRaw: melee,
  archeryRaw: archery,
  school: { white },
  temper,
});
const creature = (power?: string) => ({ ref: power ? { power } : {} });

describe('the courage test (pcCourageChance)', () => {
  const courage = (f: object, a: object | null) => call('pcCourageChance', f, a) as number;

  test('its own examples: a Melee 1 novice of Brave temper breaks on 40%, a Melee 9 master with White 2 on 10%', () => {
    expect(courage(foe(1, 'Brave'), creature())).toBe(40);
    expect(courage(foe(9, 'Brave', 2), creature())).toBe(10);
  });

  test("nerve is the better of Melee and Archery; White counts to 2 levels; the creature's stature presses back", () => {
    expect(courage(foe(1, 'Brave', 0, 5), creature())).toBe(20); // Archery 5 is the nerve: 55 − 25 − 10
    expect(courage(foe(4, 'Cautious', 5), creature())).toBe(20); // White 5 counts as 2: 55 − 20 − 10 − 5
    expect(courage(foe(4, 'Cautious'), creature('Legendary'))).toBe(45); // 55 + 15 − 20 − 5
    expect(courage(foe(4, 'Cautious'), creature('Powerful'))).toBe(35);
    expect(courage(foe(4, 'Cautious'), creature('Moderate'))).toBe(30);
    expect(courage(foe(0, 'Cowardly'), creature('Legendary'))).toBe(70); // 80, held to 70
    expect(courage(foe(4, 'Cautious'), null)).toBe(30); // no creature: no stature
  });

  test('the chance is a whole number from 10% to 70%, whoever faces whom', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        fc.constantFrom(...TEMPERS, 'None', undefined),
        fc.constantFrom('Weak', 'Moderate', 'Powerful', 'Legendary', undefined),
        (melee, archery, white, temper, power) => {
          const c = courage({ ...foe(melee, String(temper), white, archery), temper }, creature(power));
          expect(Number.isInteger(c)).toBe(true);
          expect(c).toBeGreaterThanOrEqual(10);
          expect(c).toBeLessThanOrEqual(70);
        },
      ),
    );
  });
});

describe('the chances every fight rolls', () => {
  const level = fc.integer({ min: 0, max: 9 });
  const heroArb = fc.record({
    skills: fc.record({ melee: level, archery: level }),
    temper: fc.constantFrom(...TEMPERS),
  });
  type Hero = typeof heroArb extends fc.Arbitrary<infer H> ? H : never;
  const fighterArb = fc.oneof(
    heroArb.map((hero) => ({ hero })),
    fc.nat({ max: MON.length - 1 }).map((guardian) => ({ guardian })),
  );
  /** What a fight may have put on a combatant: penalties, bonuses, wards, flight aids. */
  const statusArb = fc.record({
    hitPenalty: fc.integer({ min: 0, max: 60 }),
    hitPenaltyFixed: fc.integer({ min: 0, max: 30 }),
    auraPenalty: fc.integer({ min: 0, max: 20 }),
    hitBonus: fc.integer({ min: 0, max: 40 }),
    toHitReduce: fc.integer({ min: 0, max: 40 }),
    dodge: fc.constantFrom(1, 0.5),
    fleeBonus: fc.integer({ min: 0, max: 40 }),
    fleePenalty: fc.integer({ min: 0, max: 40 }),
    fleeDoubled: fc.boolean(),
  });
  const fighter = (f: { hero: Hero } | { guardian: number }, status: object) => {
    let c: Combatant;
    if ('hero' in f) {
      c = call('pcCharCombatant', {
        ...clone(base),
        items: [],
        skills: { ...base.skills, ...f.hero.skills },
        temper: f.hero.temper,
      }) as Combatant;
    } else {
      const m = clone(MON[f.guardian] ?? MON[0]);
      if (!m) throw new Error('no guardian');
      c = call('pcMonsterCombatant', { ...m, _hpFull: m.hp }) as Combatant;
    }
    Object.assign(c.status, status);
    return c;
  };
  const pair = fc.tuple(fighterArb, statusArb, fighterArb, statusArb);

  test('a melee blow lands from 5% to 80%, and never above 80% less the defender’s guard', () => {
    fc.assert(
      fc.property(pair, ([a, sa, d, sd]) => {
        const A = fighter(a, sa);
        const D = fighter(d, sd);
        const c = call('pcHitChance', A, D) as number;
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(HIT_MIN);
        expect(c).toBeLessThanOrEqual(Math.max(HIT_MIN, HIT_MAX - guardOf(D['temper'])));
      }),
    );
  });

  test('an arrow lands from 5% to 80%', () => {
    fc.assert(
      fc.property(pair, ([a, sa, d, sd]) => {
        const c = call('pcArrowHitChance', fighter(a, sa), fighter(d, sd)) as number;
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(HIT_MIN);
        expect(c).toBeLessThanOrEqual(HIT_MAX);
      }),
    );
  });

  test('a flight succeeds from 5% to 95%; a change of range from 10% to 90%', () => {
    fc.assert(
      fc.property(pair, fc.constantFrom('advance', 'withdraw'), ([a, sa, d, sd], mode) => {
        const A = fighter(a, sa);
        const D = fighter(d, sd);
        const flee = call('pcFleeChance', A, D) as number;
        expect(Number.isInteger(flee)).toBe(true);
        expect(flee).toBeGreaterThanOrEqual(5);
        expect(flee).toBeLessThanOrEqual(95);
        const move = call('pcMoveCheck', A, D, mode) as number;
        expect(Number.isFinite(move)).toBe(true);
        expect(move).toBeGreaterThanOrEqual(10);
        expect(move).toBeLessThanOrEqual(90);
      }),
    );
  });
});
