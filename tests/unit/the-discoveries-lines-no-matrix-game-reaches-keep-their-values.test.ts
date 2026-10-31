// The lines of src/engine/discoveries.ts that plan P1-10b8 changed to free it of the ts-nocheck line (statements that
// keep every value: P1-10b's Decision 2 and Choice 1) and that no game of the balance matrix reaches. The matrix proves
// the others (both sets, every realm's report identical); these are proved here, each on the value it had before
// (worked out by the file as it was, with its ts-nocheck line):
// - a value the code guards, missing: no realm, no state, world or province, a realm with no list of discoveries or of
//   provinces, a gap in a list, a pair awaiting a choice with no options, an id no row holds, no hero, no unit, a unit
//   with no type, race or quality, no ground, no force, no list of held plans, no tax ceiling given (the tax, upkeep and
//   hero wage discoveries then capped by their rows' own `max`), no income, no base tax, no item bonus, no recruit price;
// - a row whose effect lacks the number its hook reads (`pct`, `bonus`, `delta`, `amount`, `mult`, a summed field), or
//   that has no effect: the content writes none, so each is planted in the table for its case and taken out after;
// - a unit's type asked of a unit and a unit asked as a type (discUnitIs and discUnitMatch, whose types now say which
//   their callers pass: no caller passes the other), and a class no set holds.
// Since P1-19aa discUnitIs and discUnitMatch are in src/engine/rules-on-plain-values/, discFanaticApplies and the rule of
// discEffectsOf (and the table of the discoveries by id, which the cases plant rows in) in the discoveries' registry,
// moved as they were; discUnitMult and dragonTamed ask the registry's runners. The cases call them where they are.
// Since P1-19ag discEffectsOf, discParam, discSumOf and discTaxMatch are gone with their last callers: their cases ask
// the registry's finder (theEffectsOfAKindARealmHolds), the fallbacks the effects keep (Taxation Records' 99g, War
// Academy's 50%, Herbal Lore's 40%), discTaxAdd (the tax effect's filters) and discMaxHpFor (a row with no `hp`).
// Level 1 (unit): each is a plain function on staged values, called directly on the engine's modules (plan P1-14a). The
// staged values carry only the fields each reads, so their type is given by assertion (`as never`), as the views' unit
// cases give a staged world's.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  DISC_BY_ID,
  applyPendingSynthPlan,
  capItemTaxGold,
  discBlockedIds,
  discDeathMult,
  discEligible,
  discExploreMult,
  discHeroWage,
  discMaxHpFor,
  discPromo,
  discProvCoastal,
  discTaxAdd,
  discUnitMult,
  discUpkeepWage,
  dragonTamed,
  hasDisc,
  realmBaseTax,
  realmRecruitCost,
  taxBonusCap,
  taxRecordsGold,
} from '../../src/engine/discoveries.ts';
import {
  discUnitIs,
  discUnitMatch,
} from '../../src/engine/rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import { discFanaticApplies } from '../../src/engine/rules/discoveries/a-realms-discoveries-in-its-armys-strength.ts';
import {
  theChanceARealmsDiscoveriesPromoteTheCapitalsArmies,
  theEffectsOfAKindARealmHolds,
  theShareARealmsDiscoveriesDressAFightersWoundsBy,
} from '../../src/engine/rules/the-registry-of-discovery-effects.ts';

type Obj = Record<string, unknown>;

/** Runs `fn` with rows planted in the discoveries' table (each id `test-<key>`, its effect as given), and a realm that
 *  holds them; the rows are taken out after. */
function withPlantedRows<T>(effects: Record<string, Obj | undefined>, fn: (realm: Obj) => T): T {
  const ids = Object.keys(effects).map((k) => `test-${k}`);
  Object.entries(effects).forEach(([k, effect]) => {
    const row: Obj = { id: `test-${k}`, name: k, category: 'Test', desc: '' };
    if (effect) row['effect'] = effect;
    Reflect.set(DISC_BY_ID, `test-${k}`, row);
  });
  try {
    return fn({ race: 'Human', alignment: 'Good', discoveries: ids.map((id) => ({ id })) });
  } finally {
    ids.forEach((id) => Reflect.deleteProperty(DISC_BY_ID, id));
  }
}
/** A loose call: the arguments as an untyped caller may give them, which the types refuse. */
const looselyCalled =
  (fn: unknown) =>
  (...args: unknown[]): unknown =>
    (fn as (...a: unknown[]) => unknown)(...args);

describe("the discoveries' lines no matrix game reaches keep their values", () => {
  test('the ids withheld from the rolls: no realm, a gap among the pairs, a pair with no options, ids made strings', () => {
    expect([...discBlockedIds(undefined)]).toEqual([]);
    expect([...discBlockedIds(null)]).toEqual([]);
    expect([...discBlockedIds({})]).toEqual([]);
    const realm = { forgottenDiscoveries: ['sd01', 7], pendingDiscoveryChoices: [null, {}, { options: ['sd02', 3] }] };
    expect([...discBlockedIds(realm)]).toEqual(['sd01', '7', 'sd02', '3']);
  });

  test("a discovery of a race or an alignment, asked with no realm, isn't open to it", () => {
    expect(discEligible({ race: 'Elven' }, undefined)).toBe(false);
    expect(discEligible({ alignment: 'Evil' }, null)).toBe(false);
    expect(discEligible({}, undefined)).toBe(true);
    expect(discEligible(undefined, {})).toBe(false);
  });

  test("a realm's effects: no list of discoveries, a gap among them, an id no row holds, a row with no effect", () => {
    expect(theEffectsOfAKindARealmHolds({}, 'tax')).toEqual([]);
    const taxRow = Object.values(DISC_BY_ID).find((d) => d.effect?.kind === 'tax');
    if (!taxRow) throw new Error('no tax discovery in the table');
    const held = { discoveries: [null, { id: 'sd34' }, { id: 'no-such-row' }, { id: taxRow.id }] };
    const effects = theEffectsOfAKindARealmHolds(held, 'tax');
    expect(effects).toHaveLength(1);
    expect(effects[0]).toBe(taxRow.effect);
    expect(
      withPlantedRows({ bare: undefined }, (realm) => theEffectsOfAKindARealmHolds(realm as never, 'tax')),
    ).toEqual([]);
  });

  test("a number a discovery's row doesn't set: War Academy's 50%, Herbal Lore's 40%; none with no such row held", () => {
    const got = withPlantedRows({ academy: { kind: 'homePromotion' }, herbs: { kind: 'autoHeal' } }, (realm) => [
      theChanceARealmsDiscoveriesPromoteTheCapitalsArmies(realm as never),
      theShareARealmsDiscoveriesDressAFightersWoundsBy(realm as never),
    ]);
    expect(got).toEqual([0.5, 0.4]);
    expect(
      withPlantedRows({ bare: undefined }, (realm) => [
        theChanceARealmsDiscoveriesPromoteTheCapitalsArmies(realm as never),
        theShareARealmsDiscoveriesDressAFightersWoundsBy(realm as never),
      ]),
    ).toEqual([null, null]);
  });

  test('Taxation Records with no ceiling given (its fixed 99g) and with no income', () => {
    expect(taxRecordsGold(1000, null)).toBe(50);
    expect(taxRecordsGold(5000, undefined)).toBe(99);
    expect(taxRecordsGold(undefined, 10)).toBe(0);
    expect(taxRecordsGold(Number.NaN, 10)).toBe(0);
  });

  test("a realm's base tax: no state, no world, no list of provinces, a gap among them", () => {
    expect(realmBaseTax(undefined, 1)).toBe(0);
    expect(realmBaseTax({}, 1)).toBe(0);
    expect(realmBaseTax({ world: {} }, 1)).toBe(0);
    const provinces = [null, { owner: 1, tax: 3 }, { owner: 1, tax: 0 }, { owner: 2, tax: 5 }, undefined];
    expect(realmBaseTax({ world: { provinces } } as never, 1)).toBe(3);
  });

  test('the ceiling of one tax source: no base tax, a base that is no number', () => {
    expect(taxBonusCap(undefined)).toBe(1);
    expect(taxBonusCap(null)).toBe(1);
    expect(taxBonusCap(Number.NaN)).toBe(1);
    expect(taxBonusCap(200)).toBe(10);
  });

  test("the items' tax gold under one ceiling: no flat bonus, no per-province bonus", () => {
    expect(capItemTaxGold(undefined, null, 5)).toEqual({ taxBonus: 0, perProvBonus: 0, cut: 0 });
    expect(capItemTaxGold(7, undefined, 5)).toEqual({ taxBonus: 5, perProvBonus: 0, cut: 2 });
    expect(capItemTaxGold(null, 4, 3)).toEqual({ taxBonus: 0, perProvBonus: 3, cut: 1 });
  });

  test('a tax discovery that asks for a garrison, on a province with no garrison list', () => {
    const province = { id: 0, row: 0, col: 0, tax: 2, terrain: 'plains', race: 'Human' };
    const garrisoned = { ...province, garrisonArmies: [{}] };
    const paid = withPlantedRows({ held: { kind: 'tax', bonus: 1, garrisoned: true } }, (realm) => [
      discTaxAdd(realm, province as never, undefined, 0, new Map<unknown, number>(), 10),
      discTaxAdd(realm, garrisoned as never, undefined, 0, new Map<unknown, number>(), 10),
    ]);
    expect(paid).toEqual([0, 1]);
  });

  test('a coastal province asked with no state, no world or no province', () => {
    const province = { row: 0, col: 0, terrain: 'plains' };
    expect(discProvCoastal(undefined, province)).toBe(false);
    expect(discProvCoastal({}, province)).toBe(false);
    expect(discProvCoastal({ world: null }, province)).toBe(false);
    expect(discProvCoastal({ world: { cols: 1, rows: 1, provinces: [] } }, null)).toBe(false);
  });

  test("the tax discoveries' gold: no ceiling given (a row's own max, or none), a fixed max beside the ceiling, no bonus", () => {
    const province = { id: 0, row: 0, col: 0, tax: 2, terrain: 'plains', race: 'Human' };
    const paid = withPlantedRows(
      { capped: { kind: 'tax', bonus: 3, max: 2 }, uncapped: { kind: 'tax', bonus: 4 }, noBonus: { kind: 'tax' } },
      (realm) => {
        const acc = new Map<unknown, number>();
        const first = discTaxAdd(realm, province as never, undefined, 0, acc, null);
        const second = discTaxAdd(realm, province as never, undefined, 0, acc, undefined);
        // with a ceiling, the lower of it and a row's own max
        const capped = discTaxAdd(realm, province as never, undefined, 0, new Map<unknown, number>(), 10);
        return [first, second, capped];
      },
    );
    expect(paid).toEqual([6, 4, 6]);
  });

  test("the upkeep discoveries: no ceiling given (the row's own max), no delta, no realm, no unit, a skeleton", () => {
    const unit = { type: 'Free Lances', quality: 'Average', race: 'Human' };
    const wages = withPlantedRows(
      { cut: { kind: 'upkeep', delta: -2, max: 1 }, noDelta: { kind: 'upkeep' } },
      (realm) => {
        const acc = new Map<unknown, number>();
        return [
          discUpkeepWage(realm, unit, 5, acc, null),
          discUpkeepWage(realm, unit, 5, acc, undefined),
          discUpkeepWage(realm, unit, 5, new Map<unknown, number>(), 4),
          discUpkeepWage(undefined, unit, 5, acc, null),
          discUpkeepWage(realm, null, 5, acc, null),
          discUpkeepWage(realm, { ...unit, _isSkeletal: true }, 5, acc, null),
        ];
      },
    );
    expect(wages).toEqual([4, 5, 3, 5, 5, 5]);
  });

  test("the hero wage discoveries: no ceiling given (the rows' own max), no amount", () => {
    const hero = { alignment: 'Good' };
    const wages = withPlantedRows(
      {
        cut: { kind: 'heroWage', amount: 3, max: 1 },
        noAmount: { kind: 'heroWage' },
        ceiling: { kind: 'heroWageCap', cap: 2, max: 1 },
      },
      (realm) => {
        const acc = new Map<unknown, number>();
        return [
          discHeroWage(realm, hero, 6, acc, null),
          discHeroWage(realm, hero, 6, acc, undefined),
          discHeroWage(realm, hero, 6, new Map<unknown, number>(), 10),
        ];
      },
    );
    expect(wages).toEqual([4, 6, 2]);
  });

  test('the hit points a discovery adds to a hero with no skills, and to one with the skill', () => {
    const hp = withPlantedRows({ melee: { kind: 'maxHp', hp: 4, skill: 'melee' } }, (realm) => [
      discMaxHpFor(realm as never, { isKing: true }),
      discMaxHpFor(realm as never, { isKing: true, skills: null }),
      discMaxHpFor(realm as never, { isKing: false, skills: { melee: 1 } }),
      discMaxHpFor(realm as never, { skills: { melee: 0 } }),
    ]);
    expect(hp).toEqual([0, 0, 4, 0]);
  });

  test('an exploration discovery with no multiplier; a summed field a row does not set', () => {
    expect(
      withPlantedRows({ explore: { kind: 'explore' } }, (realm) => discExploreMult(realm as never, 'forest')),
    ).toBe(1);
    expect(
      withPlantedRows({ sum: { kind: 'maxHp' } }, (realm) => discMaxHpFor(realm as never, { isKing: false })),
    ).toBe(0);
    expect(
      withPlantedRows({ sum: { kind: 'maxHp', hp: 2 } }, (realm) => discMaxHpFor(realm as never, { isKing: false })),
    ).toBe(2);
  });

  test("a unit's class: no unit, a unit with no type, a skeleton asked of a type, a class no set holds", () => {
    expect(discUnitIs('cavalry', null)).toBe(false);
    expect(discUnitIs('primal', undefined)).toBe(false);
    expect(discUnitIs('humanoid', null)).toBe(true);
    expect(discUnitIs('skeletal', undefined)).toBe(false);
    expect(discUnitIs('humanoid', { type: '' })).toBe(true);
    expect(discUnitIs('cavalry', { type: '' })).toBe(false);
    expect(discUnitIs('skeletal', 'Shieldwall Levies', true)).toBe(false);
    expect(discUnitIs('dragons', { type: 'Free Lances' })).toBe(false);
    expect(discUnitIs('dragons', 'Free Lances', true)).toBe(false);
  });

  test("a unit's class asked loosely: a type's name without typeOnly, a unit with typeOnly", () => {
    const is = looselyCalled(discUnitIs);
    expect(is('cavalry', 'Free Lances')).toBe(false);
    expect(is('humanoid', 'Free Lances')).toBe(true);
    expect(is('humanoid', '')).toBe(true);
    expect(is('cavalry', { type: 'Free Lances' }, true)).toBe(false);
    expect(is('humanoid', { type: 'Galleon Fleet', _isSkeletal: true }, true)).toBe(false);
    expect(is('humanoid', { type: 'Shieldwall Levies', _isSkeletal: true }, true)).toBe(false);
    expect(is('humanoid', { type: 'Shieldwall Levies' }, true)).toBe(true);
  });

  test('a unit-filtered effect: no effect, no unit, a unit with no type, race or quality, a quality asked of a type', () => {
    expect(discUnitMatch(null, { type: 'Free Lances' })).toBe(false);
    expect(discUnitMatch({ types: ['Free Lances'] }, null)).toBe(false);
    expect(discUnitMatch({ race: 'Human' }, undefined)).toBe(false);
    expect(discUnitMatch({ quality: ['Average'] }, null)).toBe(true);
    expect(discUnitMatch({ cls: 'humanoid' }, null)).toBe(true);
    expect(discUnitMatch({}, null)).toBe(true);
    expect(discUnitMatch({ types: ['Free Lances'] }, { type: '' })).toBe(false);
    expect(discUnitMatch({ race: 'Human' }, { type: 'Free Lances' })).toBe(false);
    expect(discUnitMatch({ race: 'Human' }, { type: 'Free Lances', race: '' })).toBe(false);
    expect(discUnitMatch({ quality: ['Average'] }, { type: 'Free Lances' })).toBe(true);
    expect(discUnitMatch({ quality: ['Green'] }, { type: 'Free Lances', quality: '' })).toBe(false);
    expect(discUnitMatch({ quality: ['Average'] }, 'Free Lances', true)).toBe(true);
    expect(discUnitMatch({ quality: ['Veteran'] }, 'Free Lances', true)).toBe(false);
    expect(discUnitMatch({ race: 'Human' }, 'Stone Giants', true)).toBe(false);
    expect(discUnitMatch({ race: 'Human' }, 'Free Lances', true)).toBe(true);
  });

  test('a unit-filtered effect asked loosely: a type without typeOnly, a unit with typeOnly', () => {
    const match = looselyCalled(discUnitMatch);
    expect(match({ types: ['Free Lances'] }, 'Free Lances')).toBe(false);
    expect(match({ race: 'Human' }, 'Free Lances')).toBe(false);
    expect(match({ types: ['Free Lances'] }, { type: 'Free Lances' }, true)).toBe(false);
    expect(match({ race: 'Human' }, { type: 'Free Lances', race: 'Human' }, true)).toBe(false);
  });

  test("a realm's recruit price with no base price", () => {
    expect(realmRecruitCost({}, 'Free Lances', undefined)).toBe(2);
    expect(realmRecruitCost({}, 'Free Lances', 0)).toBe(2);
    expect(realmRecruitCost({}, 'Free Lances', Number.NaN)).toBe(2);
    expect(realmRecruitCost({}, 'Free Lances', 5)).toBe(5);
  });

  test('a plan held for a hired hero: no state, no hero, no list of plans, a gap among them', () => {
    const hero: Obj = { id: 5 };
    expect(applyPendingSynthPlan(undefined, hero, 1)).toBe(false);
    expect(applyPendingSynthPlan({}, null, 1)).toBe(false);
    expect(applyPendingSynthPlan({}, hero, 1)).toBe(false);
    expect(applyPendingSynthPlan({ _pendingSynthPlans: 'none' }, hero, 1)).toBe(false);
    expect(hero['encounterPlan']).toBeUndefined();
    const plan = { tactics: ['ME'] };
    const G = {
      _pendingSynthPlans: [null, { heroId: 5, player: 2, plan: { tactics: ['AR'] } }, { heroId: 5, player: 1, plan }],
    };
    expect(applyPendingSynthPlan(G, hero, 1)).toBe(true);
    expect(hero['encounterPlan']).toBe(plan);
  });

  test('a discovery asked of no realm; Dragon Taming asked with no hero or a hero of no realm', () => {
    const turn = { G: { players: [{ discoveries: [{ id: 'sd40' }] }] } } as never;
    expect(hasDisc(turn, 3, 'sd40')).toBe(false);
    expect(hasDisc(turn, 0, 'sd40')).toBe(true);
    expect(dragonTamed(turn, undefined, { type: 'Elder Dragons' })).toBe(false);
    expect(dragonTamed(turn, { player: null }, { type: 'Elder Dragons' })).toBe(false);
  });

  test("a unit's strength from discoveries: a king's effect with no hero, a ground's with no ground, no pct", () => {
    const unit = { type: 'Free Lances', quality: 'Average', race: 'Human' };
    const mults = withPlantedRows(
      {
        king: { kind: 'unitStr', pct: 0.1, king: true },
        forest: { kind: 'unitStr', pct: 0.2, terrain: ['forest'] },
        attack: { kind: 'unitStr', pct: 0.1, side: 'atk' },
        noPct: { kind: 'unitStr' },
      },
      (realm) => {
        const turn = { G: { players: [realm] } } as never;
        return [
          discUnitMult(turn, 0, unit, undefined, undefined, undefined),
          discUnitMult(turn, 0, unit, null, { isAttacker: true }, { isKing: true }),
          discUnitMult(turn, 0, unit, 'forest', null, null),
        ];
      },
    );
    expect(mults[0]).toBe(1);
    expect(mults[1]).toBeCloseTo(1.1 * 1.1, 12);
    expect(mults[2]).toBeCloseTo(1.2, 12);
  });

  test('promotion and death discoveries with no pct', () => {
    const unit = { type: 'Free Lances', quality: 'Average', race: 'Human' };
    const got = withPlantedRows({ promo: { kind: 'promo' }, death: { kind: 'deathRed' } }, (realm) => {
      const turn = { G: { players: [realm] } } as never;
      return [discPromo(turn, 0, unit), discDeathMult(turn, 0, unit, 'atk'), discDeathMult(turn, 0, unit, null)];
    });
    expect(got).toEqual([0, 1, 1]);
  });

  test("a fanatic's effect: a ground asked with none given, a class asked of no force, a gap in the force", () => {
    expect(discFanaticApplies({ terrain: ['forest'] }, 'atk', undefined, [])).toBe(false);
    expect(discFanaticApplies({ terrain: ['forest'] }, 'atk', 'forest', [])).toBe(true);
    expect(discFanaticApplies({ withCls: 'creature' }, 'atk', 'plains', undefined)).toBe(false);
    expect(discFanaticApplies({ withCls: 'creature' }, 'atk', 'plains', [null, { type: 'Stone Giants' }])).toBe(true);
    expect(discFanaticApplies({ withCls: 'creature' }, 'atk', 'plains', [null, { type: 'Free Lances' }])).toBe(false);
  });
});
