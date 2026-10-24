// The player portal's copies of the engine's rules agree with the engine, and the report hands the portal what the
// engine reads (plan P1-11a2, P1-11a4; the checks and the values in tests/lib/player-portal-copies.ts). P1-11a4 swapped
// the 16 copies that agreed for the engine's own functions (the portal imports them through src/shared/), so their
// swap cases went with them; for the 9 whose value the report makes from the state, the truth case stays as a
// projection case: the engine's function on the report's value and on the state's, the same answer. For three copies
// that stay until P1-11b, the truth: the copy on the report's value, the engine's function on the state's. For the
// copies that read the realm, the report's shape or the world (P1-11b1: the Druid a hero needs, the army card's Druid
// and sea lines, the turn report's flying carry, the Explore forecast), the truth too, with the differences known to
// Toby's questions pinned exactly. And each engine function leaves its input as it was.
// Level 1 (unit): pure functions on values, from a game played with the engine's modules imported directly and a world
// staged through the report's own projection. No page is needed, and a static test can't compare what two functions
// answer.
import { beforeAll, describe, expect, test } from 'vitest';
import {
  armyCardDruidLinesAgainstTheTurn,
  armyCardSeaNoteAgainstTheEngine,
  type Comparison,
  type Copies,
  druidNeedAgainstTheBattle,
  effMagicLvlAgainstTheReport,
  exploreForecastAgainstTheOrder,
  flyingCarryAgainstTheEngine,
  oneUnitTypePerDruidLevelAndClass,
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
/** `make`'s answer, made once (the P1-11b1 checks: each runs on about 90,000 Druid cases or a few hundred others). */
function lazily<T>(make: () => T): () => T {
  let kept: { value: T } | null = null;
  return () => (kept ??= { value: make() }).value;
}
const druidNeed = lazily(() => druidNeedAgainstTheBattle(copies, values));
const armyCardDruid = lazily(() => armyCardDruidLinesAgainstTheTurn(copies, values));
const flyingCarry = lazily(() => flyingCarryAgainstTheEngine(copies, values));
const exploreForecast = lazily(() => exploreForecastAgainstTheOrder(copies, values));
const seaNote = lazily(() => armyCardSeaNoteAgainstTheEngine(copies, values));
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
/** The pinned cases whose copy is not the engine's answer for the hero trained higher by the aura, each in a line. */
function pinnedDifferences(list: { on: unknown; copy: unknown; engineWithTheAura: unknown }[]): string[] {
  return list
    .filter((c) => !sameAnswer(c.copy, c.engineWithTheAura))
    .map((c) => `on ${short(c.on)}: the copy ${short(c.copy)}, the engine with the aura ${short(c.engineWithTheAura)}`);
}
const objectsOf = (x: unknown): Record<string, unknown>[] =>
  Array.isArray(x) ? x.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null) : [];
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

describe('the copies that read the realm, the report’s shape or the world (P1-11b1)', () => {
  test('the values reach every Druid level and class of unit, under each realm and hero, and each pinned case', () => {
    const about = (x: { on: unknown }) => x.on as { unit: unknown[]; hero: unknown[]; realm: [unknown, unknown[]] };
    const need = druidNeed();
    const types = new Set(need.map((x) => about(x).unit[0]));
    expect(oneUnitTypePerDruidLevelAndClass().filter((t) => !types.has(t))).toEqual([]);
    const realms = new Set(need.map((x) => JSON.stringify(about(x).realm)));
    for (const alignment of ['Good', 'Druidic', 'Evil'])
      for (const discoveries of [[], ['sd40']]) expect(realms).toContain(JSON.stringify([alignment, discoveries]));
    const heroes = new Set(need.map((x) => JSON.stringify(about(x).hero)));
    expect(heroes.size).toBeGreaterThanOrEqual(4 * 7 * 6);
    expect(need.filter((x) => x.aura > 0).length).toBeGreaterThan(1000);
    expect(exploreForecast().filter((x) => x.loremaster).length).toBeGreaterThan(0);
    expect(
      values.explore.filter((x) => objectsOf(x.hero.report['minorHeld']).some((t) => t['key'] === 'trailblazer'))
        .length,
    ).toBeGreaterThan(0);
    expect(seaNote().filter((x) => x.naval8).length).toBeGreaterThan(0);
  });

  test("druidNeedP's shortfall leaves a unit the strength the battle's druIdPenaltyMult does, but beside a Crown of Command, where the portal counts the hero's Druid exactly the aura higher", () => {
    // The order form's Druid line and the army card read the hero's effective Druid as the report sends it (skillEff),
    // which counts the +1 of a Crown of Command worn by a hero of his realm in his province; the battle reads his
    // training and items only (plan P1-11b, question 13 for Toby). Away from a Crown the two agree; beside one, the
    // portal's answer is the battle's for the hero trained that much higher.
    const list = druidNeed();
    expect(differences(list.filter((x) => x.aura === 0))).toEqual([]);
    expect(pinnedDifferences(list.filter((x) => x.aura !== 0))).toEqual([]);
    expect(list.filter((x) => x.aura !== 0 && !sameAnswer(x.copy, x.engine)).length).toBeGreaterThan(0);
  });

  test("the army card's Druid shortfall: the strength it shows is the battle's, but beside a Crown of Command (the same aura)", () => {
    const list = armyCardDruid().shortfall;
    expect(differences(list.filter((x) => x.aura === 0))).toEqual([]);
    expect(pinnedDifferences(list.filter((x) => x.aura !== 0))).toEqual([]);
    expect(list.filter((x) => x.aura !== 0 && !sameAnswer(x.copy, x.engine)).length).toBeGreaterThan(0);
  });

  test("the army card's Druid mastery bonus is the turn's (druidMasteryGain), beside a Crown of Command too", () => {
    expect(differences(armyCardDruid().mastery)).toEqual([]);
  });

  test("the turn report's flying carry: isAirCarriable on every unit type, getFlyCapability on every column", () => {
    const { unitTypes, columns } = flyingCarry();
    expect(unitTypes.length).toBeGreaterThan(50);
    expect(differences(unitTypes)).toEqual([]);
    expect(differences(columns)).toEqual([]);
  });

  test("the Explore order's forecast is what the order maps, but for the Loremaster, whose forecast adds 5% the turn no longer gives", () => {
    // exploreGainFor multiplies by 1.05 for a holder of the Loremaster; the engine's order no longer does ("Loremaster
    // explore bonus removed"): plan P1-11b, question 15 (a) for Toby. In the staged world (no discovery that adds to
    // exploring) the forecast is the order's gain with 5% more, rounded down: Explorer 2 in desert, 78 for 75.
    const list = exploreForecast();
    expect(differences(list.filter((x) => !x.loremaster))).toEqual([]);
    const lore = list.filter((x) => x.loremaster);
    expect(lore.filter((x) => x.copy !== Math.min(100, Math.floor(Number(x.engine) * 1.05)))).toEqual([]);
    expect(lore.filter((x) => x.copy !== x.engine).length).toBeGreaterThan(0);
  });

  test("the army card's sea note is getSeaCapability's answer, but for a hero of Naval 8, for whom it is the answer without the mastery", () => {
    // The card halves the hulls a column needs when the hero's effective Naval is 8, but an effective Naval stops at 5,
    // so it never does: for a Naval 8 hero it says "needs 2 hulls, has 1" where the turn lets the column sail (plan
    // P1-11b, question 15 (c) for Toby). Its answer is the engine's for the column under a leader of Naval 7.
    const list = seaNote();
    expect(differences(list.filter((x) => !x.naval8))).toEqual([]);
    const naval8 = list.filter((x) => x.naval8);
    expect(naval8.filter((x) => !sameAnswer(x.copy, x.engineWithoutTheMastery))).toEqual([]);
    expect(naval8.filter((x) => !sameAnswer(x.copy, x.engine)).length).toBeGreaterThan(0);
  });
});

test('each engine function leaves its input as it was (the values are frozen: a write throws)', () => {
  const changed = [
    ...PROJECTIONS.flatMap((p) => casesOf(p)),
    ...STAYING.flatMap((pair) => truthOf(pair)),
    ...druidNeed(),
    ...armyCardDruid().shortfall,
    ...armyCardDruid().mastery,
    ...flyingCarry().unitTypes,
    ...flyingCarry().columns,
    ...seaNote(),
  ]
    .filter((c) => c.engineChangedItsInput)
    .map((c) => `on ${JSON.stringify(c.on).slice(0, 160)}`);
  expect(changed).toEqual([]);
});
