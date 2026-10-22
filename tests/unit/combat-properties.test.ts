// Property tests of personal combat (P1-04d, fast-check): for any heroes and guardians fast-check makes up, damage is
// never negative, and every hero leaves any fight with HP from 0 to their maximum. A hero is a real character of a
// booted world with generated skills, temper, hit points and items from the game's own item tables (the engine equips
// them); a guardian is any of the guardian table's. Every dice roll comes from a seeded generator whose seed is part of
// the input, so a failure shrinks to a small hero and one seed, and repeats.
// Level 1 (unit): each function is called directly on the engine's modules (tests/lib/personal-combat.ts), on a world the
// engine makes (plan P1-08e: they were nested inside runTurn, and the "  // 4. Run all 5 phases" hook handed them
// back after a turn on the GM portal).
import fc from 'fast-check';
import { expect, test } from 'vitest';
import { clone, personalCombatEngine, type Combatant, type Guardian } from '../lib/personal-combat.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';

const { call, base, MON } = await personalCombatEngine();
const { ALL_MAGIC_ITEMS_P, LEGENDARY_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');
const { TEMPERS_P } = await import('../../src/engine/world/tables.ts');
const { kcRng } = await import('../../src/engine/rng.ts');
/** An input takes well under a millisecond: many more than the default, so a fault in a narrow path (one ward, one
 *  size of hit) is still met. */
const RUNS = process.env['KC_FULL'] === '1' ? 20_000 : 2_000;
/** Each property's time limit, from its run count: 2.5 ms an input, so npm test's 2,000 keep Vitest's 5 s and KC_FULL's
 *  20,000 get 50 s. The slowest property, a whole fight, takes 0.07 ms an input on a laptop and took 0.48 ms on the
 *  nightly run (20,000 in 9.6 s, timing out at 5 s: tests/lib/time-limits.ts). */
const LIMIT = timeLimitForPropertyRuns(RUNS, 2.5);

const TEMPERS = TEMPERS_P;
const ITEMS = [...ALL_MAGIC_ITEMS_P, ...LEGENDARY_ITEMS_P] as Record<string, unknown>[];
/** The items that ward their wearer (armour, shields): what stands between a hit and HP. */
const ARMOUR = ITEMS.flatMap((it, i) =>
  (it['effect'] as { stat?: string } | undefined)?.stat === 'armour' ? [i] : [],
);
const RACES = ['Human', 'Elven', 'Dwarven', 'Orcish'];
const ALIGNMENTS = ['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead'];
/** What a hit can be (pcTakeHit's `kind`): the four blows, an arrow, and the spells that wound. */
const KINDS = [
  'blow',
  'free strike',
  'parting blow',
  'counterattack',
  'arrow',
  'Lightning Bolt',
  'Fireball',
  'Holy Symbol',
  'Telekinetic Storm',
  'Hand of Death',
];

/** Every dice roll the engine makes from now on comes from this seed. */
const reseed = (seed: number) => {
  kcRng.seed(seed);
};

const level = fc.integer({ min: 0, max: 9 });
const heroArb = fc.record({
  skills: fc.record({ melee: level, archery: level, white: level, psychic: level, elemental: level, druid: level }),
  temper: fc.constantFrom(...TEMPERS),
  race: fc.constantFrom(...RACES),
  alignment: fc.constantFrom(...ALIGNMENTS),
  maxHp: fc.integer({ min: 5, max: 60 }),
  /** Their HP as a share of the maximum: wounded to whole. */
  share: fc.double({ min: 0.05, max: 1, noNaN: true }),
  /** Any of the game's items, armour as often as all the rest. */
  items: fc.uniqueArray(fc.oneof(fc.constantFrom(...ARMOUR), fc.nat({ max: ITEMS.length - 1 })), { maxLength: 6 }),
  tactics: fc.array(fc.constantFrom('ME', 'FI', 'CA:Fireball', 'CA:Psychic Blast', 'CA:Lightning Bolt'), {
    minLength: 1,
    maxLength: 6,
  }),
});
type Hero = typeof heroArb extends fc.Arbitrary<infer H> ? H : never;
const guardianArb = fc.nat({ max: MON.length - 1 });
const fighterArb = fc.oneof(
  heroArb.map((hero) => ({ hero })),
  guardianArb.map((guardian) => ({ guardian })),
);
const seedArb = fc.integer({ min: 1, max: 0x7fffffff });

/** A hero: the world's character with the generated skills, temper, hit points and items, ready to fight. */
function hero(h: Hero): Combatant {
  const ch = clone(base);
  Object.assign(ch, {
    skills: { ...(ch['skills'] as object), ...h.skills },
    temper: h.temper,
    race: h.race,
    alignment: h.alignment,
    maxHp: h.maxHp,
    hp: Math.max(1, Math.round(h.maxHp * h.share)),
    items: h.items.map((i, n) => ({ ...clone(ITEMS[i]), id: 9000 + n })),
    encounterPlan: { tactics: h.tactics, duelStance: 'accept' },
  });
  return call('pcCharCombatant', ch) as Combatant;
}
function guardian(i: number): Combatant {
  const m: Partial<Guardian> = clone(MON[i] ?? {});
  return call('pcMonsterCombatant', { ...m, _hpFull: m['hp'] }) as Combatant;
}
const fighter = (f: { hero: Hero } | { guardian: number }) => ('hero' in f ? hero(f.hero) : guardian(f.guardian));

test("the engine's tables were read", () => {
  expect(TEMPERS.length).toBeGreaterThan(2);
  expect(ITEMS.length).toBeGreaterThan(50);
  expect(ARMOUR.length).toBeGreaterThan(10);
  expect(MON.length).toBeGreaterThan(20);
});

test('a blow or an arrow never does negative damage', LIMIT, () => {
  fc.assert(
    fc.property(fighterArb, fighterArb, seedArb, (a, b, seed) => {
      reseed(seed);
      const A = fighter(a);
      const B = fighter(b);
      expect(call('pcMeleeDamage', A, B)).toBeGreaterThanOrEqual(0);
      expect(call('pcArrowDamage', A)).toBeGreaterThanOrEqual(0);
    }),
    { numRuns: RUNS },
  );
});

/** What may already stand between a fighter and the next hit: mirror images, a ward that drinks blows, Melt Armour,
 *  a shield's ward for the round. */
const wardsArb = fc.record({
  mirrorImages: fc.integer({ min: 0, max: 2 }),
  absorb: fc.integer({ min: 0, max: 8 }),
  incomingDmgBonus: fc.integer({ min: 0, max: 3 }),
  roundWard: fc.integer({ min: 0, max: 3 }),
});

test('a hit taken is never negative, and takes exactly what it says from HP', LIMIT, () => {
  fc.assert(
    fc.property(
      fighterArb,
      // A hit of any size, small ones (where wards and floors meet) as often as the rest.
      fc.oneof(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 60 })),
      fc.constantFrom(...KINDS),
      wardsArb,
      seedArb,
      (f, dmg, kind, wards, seed) => {
        reseed(seed);
        const T = fighter(f);
        Object.assign(T.status, { mirrorImages: wards.mirrorImages, absorb: wards.absorb });
        T.status['incomingDmgBonus'] = wards.incomingDmgBonus;
        T['_roundWardLeft'] = wards.roundWard;
        const before = T.hp;
        const taken = call('pcTakeHit', T, dmg, [], 'a foe', kind) as number;
        expect(taken).toBeGreaterThanOrEqual(0);
        // Last-Stand Plate's second wind heals the wearer once, after the hit: only then may HP differ.
        const healed = T['_armSecondWindUsed'] === true;
        expect(healed ? before - taken : T.hp, 'HP after the hit').toBe(before - taken);
      },
    ),
    { numRuns: RUNS },
  );
});

test('after any personal fight, a hero has from 0 HP to their maximum', LIMIT, () => {
  fc.assert(
    fc.property(heroArb, fighterArb, seedArb, (h, foe, seed) => {
      reseed(seed);
      const A = hero(h);
      const B = fighter(foe);
      call('resolvePersonalCombat', A, B, {});
      for (const c of [A, B].filter((x) => x.kind === 'character')) {
        const { hp, maxHp } = c.ref ?? {};
        expect(hp, `${c.name}'s HP`).toBeGreaterThanOrEqual(0);
        expect(hp, `${c.name}'s HP`).toBeLessThanOrEqual(maxHp ?? NaN);
      }
    }),
    { numRuns: RUNS },
  );
});
