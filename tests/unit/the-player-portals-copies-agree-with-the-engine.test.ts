// The player portal's copies of the engine's rules agree with the engine, and the report hands the portal what the
// engine reads (plan P1-11a2, P1-11a4; the checks and the values in tests/lib/player-portal-copies.ts). P1-11a4 swapped
// the 16 copies that agreed for the engine's own functions (the portal imports them through src/shared/), so their
// swap cases went with them; for the 9 whose value the report makes from the state, the truth case stays as a
// projection case: the engine's function on the report's value and on the state's, the same answer (and for the beast
// command, which P1-11b3 swapped, and the sea lift, P1-11b4's). For effMagicLvl, a copy that stays, the truth: the copy
// on the report's value, against the level the report sends. For the copies that read the realm, the report's shape or
// the world (P1-11b1: the Druid a hero needs, the army card's Druid and sea lines, the turn report's flying carry, the
// Explore forecast), the truth too, with the differences known to Toby's questions pinned exactly (since P1-11b3 the Druid ones call the
// engine's rule with the portal's level of the hero's Druid). Since P1-11c1, the order form's Cast Spell tables against
// the content's spells, its target field and its casting count against the engine's Cast Spell order, and the army
// card's kin and feud against the battle's armStr, with question 28's two differences pinned. And each engine function
// leaves its input as it was.
// Level 1 (unit): pure functions on values, from a game played with the engine's modules imported directly and a world
// staged through the report's own projection. No page is needed, and a static test can't compare what two functions
// answer.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The player portal's copies of the engine's rules that are left, and the engine's functions it now calls in their
// place (P1-11a2, P1-11a4; the checks and the values in `lib/player-portal-copies.ts`). The copies are read from
// `src/ui/player/` by their syntax tree and run beside the data file as a script (the content as the player page holds
// it), with the names `src/shared/` hands the portal; the engine's functions are imported directly, with no `vm`. The
// values: the balance matrix's game scripted-05, played with the engine's modules imported directly (its scripted
// realm's report after every turn, and the state it was built from), and a staged world handed through the report's own
// projection (`buildTurnReport`): every catalogue item (and each race-bound one under the race's old name), held by a
// hero of every race and alignment; every unit type at every quality, plain, skeletal, summoned for the turn or of the
// Wild Hunt; every column of one to three units of each kind (flyers, winged beasts, fleets, sea beasts, cavalry, light
// and heavy foot, creatures, monsters), led with and without Naval 8; a hero beside one wearing the Crown of Command.
// P1-11a4 swapped the 16 copies that agreed for the engine's functions, so their swap cases went; for the 9 whose value
// the report makes from the state (`unitTypeOf`, `unitBaseStrength`, `isLegendaryItem`, `itemSlot`, `itemRaceOf`,
// `itemUsableBy`, `topSkillOf` with `skillFameLabelM`, `isAirCarriable`, `getFlyCapability`), a projection case: the
// engine's function on the report's value and on the state's, at 0 differences; P1-11b3's tenth,
// `countsAgainstBeastCommand` for the retired `beastCommandCountP` (on the report's unit, its flags as the realm sees
// them, against `beastCommandCount` on the state's); and P1-11b4's eleventh, `seaLiftOfAColumn` for `poSeaAnalysis`'s
// own lift (on every column under its leader, the mastery worked out as `getSeaCapability` does: its answer and every
// figure the Move notice reads, and on the state's side `getSeaCapability`'s answer; until P1-11b4 a truth case of
// `poSeaAnalysis`'s cap). For a copy that stays, the truth (the copy on the report's value, against what the engine
// sends): `effMagicLvl` is the report's effective level of each magic school but for the Crown of Command's aura, which
// it leaves out (Parked). P1-11b1 added the truth of the copies that read the realm, the report's shape or the world,
// on six more staged worlds for the Druid rule (realm 0 Good, Druidic or Evil, with and without Dragon Taming; a hero
// of every race, alignment and Druid level 0 to 5, beside a Crown of Command and away from it, with one unit of each
// Druid level and class, of his race and of none, alive and skeletal) and one for exploring (a hero of each Explorer
// level, the Loremaster and the Trailblazer, in every land terrain): `druidNeedP`'s shortfall against the battle's
// `druIdPenaltyMult`, and the army card's Druid shortfall and mastery lines (read by their statements) against it and
// `druidMasteryGain`, agree but beside a Crown, where the portal counts the hero's Druid exactly the aura higher
// (pinned; question 13 for Toby; since P1-11b3 both call the engine's Druid rule through `src/shared/`, so these check
// the level of the hero's Druid each side feeds it); the turn report's own flying carry (read by its statements) agrees
// with `isAirCarriable` and `getFlyCapability` (P1-11b2: the report calls `getFlyCapability` now, so its statement that
// gives a column the flyers' pace is checked on every column, and the unit types' half went with the copy); the Explore
// forecast (`exploreGainFor`) is what `resolveExploreOrder` maps but for the Loremaster, 5% more (pinned; question 15);
// the army card's sea note is `getSeaCapability`'s answer but for a Naval 8 hero, for whom it is the answer without the
// mastery (pinned; question 15). Every engine function leaves its input as it was (the values are frozen, so a write
// throws). P1-11c1 (plan P1-11c, before the form takes its tables and its check from the engine's side): the order
// form's eight Cast Spell tables (`order-chances.ts` run whole, the others read by their declarations) are the ones
// `SPELL_DEFS_P` makes, each as the form reads it (a list in its order, a map, a set), but an Encounter plan lists the
// combat spells of three schools in its own order (pinned); the target field (`spellSecondaryHtml`, on a staged report
// with a hero of each kind in the caster's province and in another) offers a hero in the caster's province alone for
// exactly the 11 spells of the spells' registry's "a spell's mark must stand in the province", and for Resurrect (its
// body's province, its own rule: pinned); the form's casting count (`buildTargetField`'s statements, the page's fields
// stood in) greys a spell out exactly where `resolveCastSpellOrder` blocks it (White Magic 1 to 5, every list of up to
// three earlier casts of Holy Symbol, Bless Province and Oratory) but in a realm with a Grand Cathedral and for the
// Warlock, where its answer is the engine's without either (pinned; question 28 (a), Parked); the army card's strength
// of a unit (`renderReportView`'s statements) is `armStr`'s, kin and feud with it, but under a leader short of Druid,
// where it is the battle's figure for a leader with Druid enough, the shortfall then taken off rounded to the nearest
// and at least 1 (pinned; question 28 (b)). Since P1-11c4 the target field's six lists that look in the caster's
// province ask the engine's mark check (through `src/shared/`), so a case pins the heroes each of the 13 spells aimed
// at a hero offers on the staged report. Level 1: pure functions on values; no page is needed, and a static test
// can't compare what two functions answer. Planted faults: in the PRs (P1-11a2, P1-11a4, P1-11b1, P1-11b2, P1-11b3,
// P1-11b4, P1-11c1, P1-11c4)
import { beforeAll, describe, expect, test } from 'vitest';
import {
  armyCardKinAgainstTheBattle,
  armyCardMasteryAgainstTheTurn,
  armyCardSeaNoteAgainstTheEngine,
  armyCardShortfallAgainstTheBattle,
  castingLimitAgainstTheOrder,
  type Comparison,
  type Copies,
  druidNeedAgainstTheBattle,
  effMagicLvlAgainstTheReport,
  exploreForecastAgainstTheOrder,
  flyingCarryAgainstTheEngine,
  kinWorld,
  oneUnitTypePerDruidLevelAndClass,
  playerPortalCopies,
  type ProjectionComparison,
  PROJECTIONS,
  sameAnswer,
  samples,
  type Samples,
  theContentsSpellTables,
  theFormsSpellTablesAgainstTheContent,
  theFormsTargetsAgainstTheMarkCheck,
  theGamePlayed,
  theHeroesEachSpellAimedAtAHeroOffers,
  theOrderFormsSpells,
  worldSamples,
  type WorldSamples,
} from '../lib/player-portal-copies.ts';
import {
  ALL_MAGIC_ITEMS_P,
  KC_QUALITY_TIERS,
  KC_RIVAL_RACE,
  KC_UNIT_TYPE,
  LEGENDARY_ITEMS_P,
} from '../../src/content/kingdoms-call-data.ts';
import { unitBaseStrength } from '../../src/engine/rules-on-plain-values/unit-types-and-base-strength.ts';

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
/** `make`'s answer, made once (the P1-11b1 checks: each runs on about 90,000 Druid cases or a few hundred others). */
function lazily<T>(make: () => T): () => T {
  let kept: { value: T } | null = null;
  return () => (kept ??= { value: make() }).value;
}
const druidNeed = lazily(() => druidNeedAgainstTheBattle(copies, worldValues));
const armyCardShortfall = lazily(() => armyCardShortfallAgainstTheBattle(copies, worldValues));
const armyCardMastery = lazily(() => armyCardMasteryAgainstTheTurn(copies, worldValues));
const flyingCarry = lazily(() => flyingCarryAgainstTheEngine(copies, values));
const exploreForecast = lazily(() => exploreForecastAgainstTheOrder(copies, worldValues));
const seaNote = lazily(() => armyCardSeaNoteAgainstTheEngine(copies, values));
const theForm = lazily(() => theOrderFormsSpells());
const castingLimit = lazily(() => castingLimitAgainstTheOrder(theForm()));
const kin = lazily(() => armyCardKinAgainstTheBattle(copies, kinWorld()));
const casesOf = (p: (typeof PROJECTIONS)[number]) => once(`${p.engine} projection`, () => p.cases(values));
let worldValues: WorldSamples;
// The values in three hooks, each with Vitest's limit for itself (a hook's 10 s; on a busy runner the three together
// can take more): the game, then the samples with the staged world, then the staged worlds of P1-11b1.
beforeAll(() => {
  copies = playerPortalCopies();
  theGamePlayed();
});
beforeAll(() => {
  values = samples();
});
beforeAll(() => {
  worldValues = worldSamples();
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

describe('a copy that stays (it reads the report’s shape)', () => {
  // poSeaAnalysis's cap, the other copy P1-11a2 checked the truth of here, counts through seaLiftOfAColumn since
  // P1-11b4: a projection case above.
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
      worldValues.explore.filter((x) => objectsOf(x.hero.report['minorHeld']).some((t) => t['key'] === 'trailblazer'))
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
    const list = armyCardShortfall();
    expect(differences(list.filter((x) => x.aura === 0))).toEqual([]);
    expect(pinnedDifferences(list.filter((x) => x.aura !== 0))).toEqual([]);
    expect(list.filter((x) => x.aura !== 0 && !sameAnswer(x.copy, x.engine)).length).toBeGreaterThan(0);
  });

  test("the army card's Druid mastery bonus is the turn's (druidMasteryGain), beside a Crown of Command too", () => {
    expect(differences(armyCardMastery())).toEqual([]);
  });

  test("the turn report's flying carry: getFlyCapability's answer on every column", () => {
    // Since P1-11b2 the report calls getFlyCapability (it kept its own copy of it, and of isAirCarriable).
    const { columns } = flyingCarry();
    expect(columns.length).toBeGreaterThan(0);
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

describe('the order form’s Cast Spell tables and checks, and the army card’s kin and feud (P1-11c1)', () => {
  test("each of the order form's eight Cast Spell tables is the one the content's spells make of it", () => {
    // Each as the form reads it: a list it shows in its order (every spell by school, the action spells, those offered
    // a hero of unseen levels), a map (each spell's school, the mastery spells' levels), a set it asks (the spells
    // aimed at a province, at a hero), and the combat spells an Encounter plan offers, by school.
    // Since P1-11c3 the form makes each by the engine folder's function (the static test names which): this case runs
    // the form's own declarations, so a table made by another function than its own reads as a difference here.
    const list = theFormsSpellTablesAgainstTheContent(theForm());
    expect(list).toHaveLength(8);
    expect(differences(list)).toEqual([]);
  });

  test('an Encounter plan lists the combat spells of three schools in an order of its own, not the content’s', () => {
    // The plan's options come in ENCOUNTER_VALID's order (Psychic Blast, Telekinetic Storm, Charm), which is not the
    // content's (Charm first) in the Psychic, Illusory and Necromancy schools: the same spells, in another order.
    const form = theForm().tables.ENCOUNTER_VALID;
    const content = theContentsSpellTables().ENCOUNTER_VALID;
    const inAnotherOrder = Object.keys(content).filter((school) => !sameAnswer(form[school], content[school]));
    expect(inAnotherOrder).toEqual(['psychic', 'illusory', 'necromancy']);
  });

  test("the target field offers a hero in the caster's province alone for the 11 spells whose mark the engine's order says must stand there, and for Resurrect", () => {
    // On a staged report: for every spell, the heroes its target field offers, by the province each stands in, against
    // the spells' registry's "a spell's mark must stand in the province" (the check the Cast Spell order makes before
    // the cast roll). Resurrect's field offers only the bodies lying in the caster's province: its own rule (the body
    // must lie there), which its spell checks itself, not this check. Clairvoyance's offers every hero once seen.
    const list = theFormsTargetsAgainstTheMarkCheck(theForm());
    expect(differences(list.filter((x) => x.on !== 'Resurrect'))).toEqual([]);
    expect(list.filter((x) => x.engine === true)).toHaveLength(11);
    const where = (spell: string) => list.find((x) => x.on === spell)?.where;
    expect([where('Resurrect'), where('Clairvoyance')]).toEqual(["the caster's province", 'anywhere']);
    expect(list.find((x) => x.on === 'Resurrect')?.engine).toBe(false);
    // every spell aimed at a hero finds one on the staged report besides the caster himself (Oratory and Phantasmal
    // Armies offer him too)
    const atAHero = theContentsSpellTables().NEEDS_CHAR;
    expect(list.filter((x) => atAHero.includes(String(x.on)) && !x.othersOffered.length).map((x) => x.on)).toEqual([]);
  });

  test('each of the 13 spells aimed at a hero offers exactly these heroes on the staged report, in the caster’s province and out of it (pinned)', () => {
    // Since P1-11c4 the field's six lists that look in the caster's province ask the engine's mark check (through
    // src/shared/), so the case above compares the check with itself there: this one pins what each list offers. The
    // staged report has the caster and a hero of each kind in province 100, and one of each in province 200. A spell
    // whose row lost its flag would offer the heroes of province 200 too.
    const here = ['Lone 100', 'Leader 100', 'Wanderer 100'];
    expect(theHeroesEachSpellAimedAtAHeroOffers(theForm())).toEqual({
      Resurrect: ['Fallen 100'],
      Charm: ['Lone 100', 'Wanderer 100'],
      Oratory: ['Ysolde Fen', 'Ally 100'],
      Clairvoyance: ['Leader 100', 'Leader 200', 'Lone 100', 'Lone 200'],
      'Psychic Blast': here,
      'Telekinetic Storm': ['Leader 100'],
      'Phantasmal Armies': ['Ysolde Fen', 'Ally 100'],
      'Control Undead': here,
      Curse: here,
      'Divine Judgment': here,
      'Mass Confusion': here,
      Dominate: here,
      'Chain Lightning': here,
    });
  });

  test("the form's casting count is the engine's, but in a realm with a Grand Cathedral and for the Warlock, where it is the engine's without either", () => {
    // The form greys a spell out when its school's casts so far this turn reach the limit; the Cast Spell order blocks
    // it there. The form counts a Grand Cathedral's free Bless Province as a cast and greys it out at the limit (the
    // engine never does: plan P1-11c, question 28 (a) for Toby), and leaves out the Warlock's extra cast in his best
    // school (Parked): in those cases its answer is the engine's for the same cast in a realm without the Wonder, by a
    // hero without the title.
    const list = castingLimit();
    const plain = list.filter((x) => !x.cathedral && !x.warlock);
    expect(differences(plain)).toEqual([]);
    expect(list.filter((x) => !sameAnswer(x.copy, x.engineWithNeither))).toEqual([]);
    // and the engine's answer is what its two rules make of the casts: the pin holds on both sides
    expect(list.filter((x) => !sameAnswer(x.engine, x.engineAsTheTwoRulesSay))).toEqual([]);
    expect(list.filter((x) => x.cathedral && !x.warlock && !sameAnswer(x.copy, x.engine)).length).toBeGreaterThan(0);
    expect(list.filter((x) => x.warlock && !x.cathedral && !sameAnswer(x.copy, x.engine)).length).toBeGreaterThan(0);
    // the values reach a cast the limit blocks and one it lets through, at every level of White Magic
    for (const blocked of [true, false])
      for (const white of [1, 2, 3, 4, 5])
        expect(
          plain.filter((x) => x.engine === blocked && (x.on as { white: number }).white === white).length,
        ).toBeGreaterThan(0);
  });

  test("the army card's strength of a unit is the battle's, its kin and a rival kin's leader with it, but where its leader falls short of Druid", () => {
    // The card's line ("str …") counts the unit's kin (its king's, its leader's: ×1.2 each) and a rival kin's leader
    // (×0.8) as the battle's armStr does, each rounded. Under a leader short of Druid, the battle floors the shortfall
    // first; the card takes it off last, rounded to the nearest and never below 1 (plan P1-11c, question 28 (b) for
    // Toby): there its figure is the battle's for a leader with Druid enough, the shortfall then taken off as the card
    // takes it. Veteran Shieldwall Levies (12) of the Elves, under a Human with no Druid: the battle 9, the card 10.
    const list = kin();
    const short = list.filter((x) => x.druidMultiplier < 1);
    expect(differences(list.filter((x) => x.druidMultiplier === 1))).toEqual([]);
    expect(
      short.filter((x) => x.copy !== Math.max(1, Math.round(Number(x.engineWithoutTheShortfall) * x.druidMultiplier))),
    ).toEqual([]);
    expect(short.filter((x) => !sameAnswer(x.copy, x.engine)).length).toBeGreaterThan(0);
    // and the battle's figure there is its own order: the shortfall floored off the unit's base strength first, then
    // its kin (×1.2 its realm's king's, a Human; ×1.2 its leader's) and a rival kin's leader (×0.8), each rounded
    const rival: Record<string, string> = KC_RIVAL_RACE;
    const floorFirst = (x: (typeof short)[number]) => {
      const [type, quality, race, leader] = x.on as [string, string, string | null, string];
      let strength = Math.floor(unitBaseStrength({ type, quality }) * x.druidMultiplier);
      if (race === 'Human') strength = Math.round(strength * 1.2);
      if (race === leader) strength = Math.round(strength * 1.2);
      if (race && rival[race] === leader) strength = Math.round(strength * 0.8);
      return strength;
    };
    expect(short.filter((x) => x.engine !== floorFirst(x))).toEqual([]);
    // the values reach each kin and feud the card and the battle count (the realm's king a Human), with a shortfall and
    // without (a leader of the unit's own race needs none)
    const kinds = new Set(
      list.map((x) => {
        const [, , race, leader] = x.on as [string, string, string | null, string];
        return JSON.stringify([
          race === 'Human',
          race === leader,
          race ? rival[race] === leader : false,
          x.druidMultiplier < 1,
        ]);
      }),
    );
    expect(kinds.size).toBe(10);
  });
});

test('each engine function leaves its input as it was (the values are frozen: a write throws)', () => {
  const changed = [
    ...PROJECTIONS.flatMap((p) => casesOf(p)),
    ...druidNeed(),
    ...armyCardShortfall(),
    ...armyCardMastery(),
    ...flyingCarry().columns,
    ...seaNote(),
    ...kin(),
  ]
    .filter((c) => c.engineChangedItsInput)
    .map((c) => `on ${JSON.stringify(c.on).slice(0, 160)}`);
  expect(changed).toEqual([]);
});
