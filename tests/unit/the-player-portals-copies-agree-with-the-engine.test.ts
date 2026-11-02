// The player portal's copies of the engine's rules agree with the engine, and the report hands the portal what the
// engine reads (plan P1-11a2, P1-11a4; the checks and the values in tests/lib/player-portal-copies.ts). P1-11a4 swapped
// the 16 copies that agreed for the engine's own functions (the portal imports them through src/shared/), so their
// swap cases went with them; for the 9 whose value the report makes from the state, the truth case stays as a
// projection case: the engine's function on the report's value and on the state's, the same answer (and for the beast
// command, which P1-11b3 swapped, and the sea lift, P1-11b4's). For effMagicLvl, a copy that stays, the truth: the copy
// on the report's value, against the level the report sends. For the copies that read the realm, the report's shape or
// the world (P1-11b1: the Druid a hero needs, the army card's Druid and sea lines, the turn report's flying carry, the
// Explore forecast and its march-in share), the truth too (since P1-11b3 the Druid ones call the engine's rule with the
// portal's level of the hero's Druid; since R-120 they agree beside a Crown; since R-125 the Explore forecast, the
// march-in share and the sea note agree). Since P1-11c1, the order form's Cast Spell tables against
// the content's spells, its target field and its casting count against the engine's Cast Spell order, and the army
// card's kin and feud against the battle's armStr. Since P1-11d1, the march: the portal's three hex tables against the
// engine's step, where the form says a hero will stand after his Moves and Forced Marches against where the turn leaves
// him, and the share marching in maps against the turn's (each known difference pinned: question 44). Since P1-11d2,
// what a hero holds: what the form says he will carry and lead, and a garrison hold, after his orders, against the turn's
// phases (each known difference pinned: question 42). And each engine function leaves its input as it was.
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
// and heavy foot, creatures, monsters), led with and without Naval 8 (and at Naval 7, a fleet among them); a hero beside one wearing the Crown of Command.
// P1-11a4 swapped the 16 copies that agreed for the engine's functions, so their swap cases went; for the 9 whose value
// the report makes from the state (`unitTypeOf`, `unitBaseStrength`, `isLegendaryItem`, `itemSlot`, `itemRaceOf`,
// `itemUsableBy`, `topSkillOf` with `skillFameLabelM`, `isAirCarriable`, `getFlyCapability`), a projection case: the
// engine's function on the report's value and on the state's, at 0 differences; P1-11b3's tenth,
// `countsAgainstBeastCommand` for the retired `beastCommandCountP` (on the report's unit, its flags as the realm sees
// them, against `beastCommandCount` on the state's); and P1-11b4's eleventh, `seaLiftOfAColumn` for `poSeaAnalysis`'s
// own lift (on every column under its leader, the mastery worked out as `getSeaCapability` does: its answer and every
// figure the Move notice reads, and on the state's side `getSeaCapability`'s answer; until P1-11b4 a truth case of
// `poSeaAnalysis`'s cap). For a copy that stays, the truth (the copy on the report's value, against what the engine
// sends): `effMagicLvl` is the report's effective level of each magic school, the Crown of Command's aura too (R-120:
// it adds the aura the report sends). P1-11b1 added the truth of the copies that read the realm, the report's shape or the world,
// on six more staged worlds for the Druid rule (realm 0 Good, Druidic or Evil, with and without Dragon Taming; a hero
// of every race, alignment and Druid level 0 to 5, beside a Crown of Command and away from it, with one unit of each
// Druid level and class, of his race and of none, alive and skeletal) and one for exploring (a hero of each Explorer
// level, the Loremaster and the Trailblazer, in every land terrain): `druidNeedP`'s shortfall against the battle's
// `druIdPenaltyMult`, and the army card's Druid shortfall and mastery lines (read by their statements) against it and
// `druidMasteryGain`, agree, beside a Crown too (R-120: the battle counts its aura, as the portal does; since P1-11b3
// both call the engine's Druid rule through `src/shared/`, so these check the level of the hero's Druid each side feeds
// it); the turn report's own flying carry (read by its statements) agrees
// with `isAirCarriable` and `getFlyCapability` (P1-11b2: the report calls `getFlyCapability` now, so its statement that
// gives a column the flyers' pace is checked on every column, and the unit types' half went with the copy); the Explore
// forecast (`exploreGainFor`) is what `resolveExploreOrder` maps, the Loremaster's too (R-125); its march-in share
// (`exploreMoveGainBefore`, on a staged march into the capital) is what `resolveMoveOrder` maps, for a hero with no
// Traveller's Cloak, one worn and one carried as a spare (R-125: a worn one alone); the army card's sea note is
// `getSeaCapability`'s answer, a Naval 8 hero's too (R-125). Every engine function leaves its input as it was (the values are frozen, so a write
// throws). P1-11c1 (plan P1-11c, before the form takes its tables and its check from the engine's side): the order
// form's eight Cast Spell tables (`order-chances.ts` run whole, the others read by their declarations) are the ones
// `SPELL_DEFS_P` makes, each as the form reads it (a list in its order, a map, a set), but an Encounter plan lists the
// combat spells of three schools in its own order (pinned); the target field (`spellSecondaryHtml`, on a staged report
// with a hero of each kind in the caster's province and in another) offers a hero in the caster's province alone for
// exactly the 11 spells of the spells' registry's "a spell's mark must stand in the province", and for Resurrect (its
// body's province, its own rule: pinned); the form's casting count (`buildTargetField`'s statements, the page's fields
// stood in) greys a spell out exactly where `resolveCastSpellOrder` blocks it (White Magic 1 to 5, every list of up to
// three earlier casts of Holy Symbol, Bless Province and Oratory), the Warlock's extra cast too (R-123: both ask the one
// rule, the form with the title its hero's minorHeld lists, which the report writes on the holder the turn counts), and
// in a realm with a Grand Cathedral (R-124: both ask the one rule of a spell that costs no slot, the form with the Wonder
// its realm's report says stands, the report built by the engine from a world with and without it); the army card's strength
// of a unit (`renderReportView`'s statements) is `armStr`'s, kin and feud with it, and a Druid shortfall in the
// battle's order (R-122: taken off the unit's base first, rounded down, then kin and feud). Since P1-11c4 the target field's six lists that look in the caster's
// province ask the engine's mark check (through `src/shared/`), so a case pins the heroes each of the 13 spells aimed
// at a hero offers on the staged report. P1-11d1 (plan P1-11d, before the hex step is shared): the portal's three hex
// tables (`predictedLocation`, the Move field's `buildTargetField` statements, `lastMoveDirOf`, each run as the page runs
// it on the orders staged in its fields) step where `neighborInDir` and `getNeighborsP` do, from every province of a
// staged map; on a staged world with no guards (`marchingWorld`), where `predictedLocation` says a hero will stand is
// where `processOrder` leaves him for a compass step, a province next door, a Forced March next door and his own
// province, and pinned where it is not (question 44): a column with ships over land, with too little lift for the sea,
// at a neutral realm's border, past its pace (each refused by the turn), a far province or a far Forced March (one step
// in the turn), a Forced March by direction (not read by the form); and the share `exploreMoveGainBefore` counts a march
// as mapping is the turn's at March 6 and 0 leading companies and for a sea sailed into, and pinned for a Travelworn
// Drape (10 for 30) and Naval 6's charting of the coast (0 for 5). P1-11d2 (plan P1-11d, before any of it is shared):
// on a staged world with no guards (`holdingWorld`, each case on its own province), what `predictedItems`,
// `projectedLedArmies` and `projectedGarrison` (with `_projRecruitUnits` and `_isAutoGarrisonRecruit`) say a hero will
// carry and lead, and a garrison hold, as the season after his orders begins, is what the turn's phases leave them
// (played one at a time, its loop's four stages each): items handed over beside him, sent by courier and passed on;
// companies recruited (a band and the province's, a garrison company, into the garrison, under a comrade), handed over,
// left and taken up, taken up as a comrade leaves them, disbanded; and pinned where it is not (question 42): Mithril
// sent with "all", a comrade marching in, a chain of hand-overs in one season, the Philosopher's Stone used, a beast
// past a leader's beast command (recruited, handed over, taken up), a band of garrison troops hired, companies taken up
// (the turn's last first), risen dead handed to a comrade (to their graves in the turn; no risen mark in the form).
// Level 1: pure functions on values; no page is needed, and a static test can't compare what two functions answer.
// Planted faults: in the PRs (P1-11a2, P1-11a4, P1-11b1, P1-11b2, P1-11b3, P1-11b4, P1-11c1, P1-11c4, P1-11d1, P1-11d2)
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
  marchInGainAgainstTheMoveOrder,
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
  THE_MARCHES_IN_THE_FORECAST_GETS_RIGHT,
  THE_MARCHES_IN_THE_FORECAST_GETS_WRONG,
  THE_MARCHES_THE_FORECAST_GETS_RIGHT,
  THE_MARCHES_THE_FORECAST_GETS_WRONG,
  THE_HOLDINGS_THE_FORECAST_GETS_RIGHT,
  THE_HOLDINGS_THE_FORECAST_GETS_WRONG,
  theMarchForecastAgainstTheTurn,
  theMarchInForecastAgainstTheTurn,
  thePortalsHexTablesAgainstTheEngine,
  theOrderFormsSpells,
  theWarlocksTitle,
  whatAHeroHoldsAgainstTheTurn,
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
import { timeLimitForTheWork } from '../lib/time-limits.ts';

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
const marchIn = lazily(() => marchInGainAgainstTheMoveOrder(copies));
const theForm = lazily(() => theOrderFormsSpells());
const castingLimit = lazily(() => castingLimitAgainstTheOrder(theForm()));
const kin = lazily(() => armyCardKinAgainstTheBattle(copies, kinWorld()));
const hexSteps = lazily(() => thePortalsHexTablesAgainstTheEngine(copies));
const marches = lazily(() => theMarchForecastAgainstTheTurn(copies));
const marchesIn = lazily(() => theMarchInForecastAgainstTheTurn(copies));
const holdings = lazily(() => whatAHeroHoldsAgainstTheTurn(copies));
const casesOf = (p: (typeof PROJECTIONS)[number]) => once(`${p.engine} projection`, () => p.cases(values));
let worldValues: WorldSamples;
// The values, in one hook with a whole game's limit (the game, then the samples with the staged world, then the staged
// worlds of P1-11b1: 12.1 s together on a runner, past a hook's 10 s).
beforeAll(
  () => {
    copies = playerPortalCopies();
    theGamePlayed();
    values = samples();
    worldValues = worldSamples();
  },
  timeLimitForTheWork({ matrixGamesPlayed: 1 }).timeout,
);

/** A value in a line short enough to read (cut to 160 characters). */
const short = (x: unknown) =>
  JSON.stringify(x, (_k, v: unknown) => (v === undefined ? '(undefined)' : v)).slice(0, 160);
/** The comparisons that differ, each in a line. */
function differences(list: Comparison[]): string[] {
  return list
    .filter((c) => !sameAnswer(c.copy, c.engine))
    .map((c) => `on ${short(c.on)}: the copy ${short(c.copy)}, the engine ${short(c.engine)}`);
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
  test("effMagicLvl is the report's effective level of each magic school, the Crown of Command's aura too (R-120)", () => {
    // The order form offers spells by effMagicLvl (a school's level, the hero's items and the aura the report says he
    // stands in); the turn casts at the report's skillEff, which counts the aura of a Crown of Command worn by a hero
    // of his realm in his province (a Curse too, but a Curse ends with the turn, so no report shows one). Since R-120
    // the two agree beside a Crown too.
    const list = effMagicLvlAgainstTheReport(copies, values);
    expect(list.filter((x) => x.aura !== 0).length).toBeGreaterThan(0);
    expect(list.filter((x) => x.copy !== x.report)).toEqual([]);
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
    expect(seaNote().filter((x) => x.naval >= 8).length).toBeGreaterThan(0);
  });

  test("druidNeedP's shortfall leaves a unit the strength the battle's druIdPenaltyMult does, beside a Crown of Command too (R-120)", () => {
    // The order form's Druid line and the army card read the hero's effective Druid as the report sends it (skillEff),
    // which counts the +1 of a Crown of Command worn by a hero of his realm in his province; since R-120 the battle
    // counts it too (his Druid as effStat counts it, to 5).
    const list = druidNeed();
    expect(list.filter((x) => x.aura !== 0).length).toBeGreaterThan(0);
    expect(differences(list)).toEqual([]);
  });

  test("the army card's Druid shortfall: the strength it shows is the battle's, beside a Crown of Command too (R-120)", () => {
    const list = armyCardShortfall();
    expect(list.filter((x) => x.aura !== 0).length).toBeGreaterThan(0);
    expect(differences(list)).toEqual([]);
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

  test("the Explore order's forecast is what the order maps, the Loremaster's too (R-125)", () => {
    // The turn's Explore order gives the Loremaster no more ("Loremaster explore bonus removed"); since R-125 the
    // forecast doesn't either (it added 5%: Explorer 2 in desert, 78 for 75).
    const list = exploreForecast();
    expect(list.filter((x) => x.loremaster).length).toBeGreaterThan(0);
    expect(differences(list)).toEqual([]);
  });

  test("the march-in share the Explore forecast counts is what the Move order maps, a Traveller's Cloak only when worn (R-125)", () => {
    // The Move order counts a worn item's +20% alone (activeItems); the forecast counted any Traveller's Cloak the hero
    // held, a spare in his pack too (30 for 10 at Explorer 0). Since R-125 it counts a worn one alone, by its name (a
    // cloak of another name: question 44).
    const list = marchIn();
    for (const cloak of ['none', 'worn', 'carried']) expect(list.filter((x) => x.cloak === cloak).length).toBe(2);
    expect(differences(list)).toEqual([]);
  });

  test("the army card's sea note is getSeaCapability's answer, a Naval 8 hero's too (R-125)", () => {
    // The card halved the hulls a column needs at an effective Naval of 8, which stops at 5, so it never did: a Naval 8
    // hero read "needs 2 hulls, has 1" where the turn let the column sail. Since R-125 it reads his trained Naval, as
    // the turn's mastery does.
    const list = seaNote();
    for (const naval of [7, 8]) expect(list.filter((x) => x.naval === naval).length).toBeGreaterThan(0);
    expect(differences(list)).toEqual([]);
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

  test("the report writes the Warlock's title on the hero the turn counts as its holder, as the form reads it", () => {
    // The form reads the title in its hero's minorHeld (R-123); the turn counts the holder computeMinorTitles names as
    // it starts. On a staged world at the turn the titles go public, the one hero each names is the mage.
    const warlock = theWarlocksTitle();
    expect(warlock.theHeroesTheReportNames).toEqual([warlock.theMage]);
    expect(warlock.theHeroTheTurnCounts).toBe(warlock.theMage);
    expect(warlock.asTheReportWritesIt['key']).toBe('warlock');
  });

  test("the form's casting count is the engine's, the Warlock's extra cast (R-123) and a Grand Cathedral's free Bless Province (R-124) too", () => {
    // The form greys a spell out when its school's casts so far this turn reach the limit; the Cast Spell order blocks
    // it there. Both ask the one rule of a school's casts (R-123: the Warlock's extra cast in his best school), the form
    // with the title the report writes in its hero's minorHeld; and the one rule of a spell that costs no slot (R-124: a
    // Grand Cathedral's Bless Province is never counted nor blocked), the form with the Wonder its realm's report says
    // stands, as the engine builds the report from each world.
    const list = castingLimit();
    expect(differences(list)).toEqual([]);
    // and the engine's answer is what its two rules make of the casts
    expect(list.filter((x) => !sameAnswer(x.engine, x.engineAsTheTwoRulesSay))).toEqual([]);
    // the values reach the free Bless: a cast the Wonder lets through, with the title and without
    for (const warlock of [false, true])
      expect(
        list.filter(
          (x) => x.cathedral && x.warlock === warlock && x.engine === false && x.engineWithoutTheWonder === true,
        ).length,
      ).toBeGreaterThan(0);
    const plain = list.filter((x) => !x.cathedral);
    // the values reach the Warlock's extra cast: a cast the limit lets through for him alone
    expect(plain.filter((x) => x.warlock && x.engine === false && x.engineWithNeither === true).length).toBeGreaterThan(
      0,
    );
    // the values reach a cast the limit blocks and one it lets through, at every level of White Magic
    for (const blocked of [true, false])
      for (const white of [1, 2, 3, 4, 5])
        expect(
          plain.filter((x) => x.engine === blocked && (x.on as { white: number }).white === white).length,
        ).toBeGreaterThan(0);
  });

  test("the army card's strength of a unit is the battle's: its kin, a rival kin's leader and a Druid shortfall, in the battle's order (R-122)", () => {
    // The card's line ("str …") counts the unit's kin (its king's, its leader's: ×1.2 each) and a rival kin's leader
    // (×0.8) as the battle's armStr does, each rounded. Under a leader short of Druid, it takes the shortfall off the
    // unit's base strength first, rounded down, then its kin and feud, as the battle does (R-122, Toby's answer to
    // question 28 (b)). Veteran Shieldwall Levies (12) of the Elves, under a Human with no Druid: 9 on both.
    const list = kin();
    const short = list.filter((x) => x.druidMultiplier < 1);
    expect(differences(list)).toEqual([]);
    const levies = list.find((x) => sameAnswer(x.on, ['Shieldwall Levies', 'Veteran', 'Elven', 'Human', 0]));
    expect([levies?.copy, levies?.engine]).toEqual([9, 9]);
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

describe('the march: where the order form says a hero will stand, and what marching in maps (P1-11d1)', () => {
  test("the portal's three hex tables step where the engine's does, from every province of the map", () => {
    // predictedLocation (where every later phase's form says he stands), the Move field (its six directions, each the
    // province one step that way, none off the map) and lastMoveDirOf (the direction a fresh Move opens on) each keep a
    // table of the six steps by the parity of a row; the turn steps by neighborInDir, and reads a province next door by
    // getNeighborsP. From every province of the staged map (8 by 7): its rows of each parity, the top and bottom rows
    // (a step off the map: the turn's "icy wastes", where he stays) and both ends of a row (the map wraps east to west).
    const list = hexSteps();
    expect(differences(list)).toEqual([]);
    const of = (table: string) => list.filter((x) => x.table === table);
    expect([of('predictedLocation').length, of('the Move field').length, of('lastMoveDirOf').length]).toEqual([
      336, 56, 304,
    ]);
    const on = (x: (typeof list)[number]) => x.on as [number, number, number, string];
    const stays = of('predictedLocation').filter((x) => x.engine === on(x)[0]);
    expect(new Set(stays.map((x) => on(x)[3]))).toEqual(new Set(['NW', 'NE', 'SW', 'SE']));
    const wraps = of('predictedLocation').filter(
      (x) => typeof x.engine === 'number' && Math.abs((x.engine % 8) - on(x)[2]) > 1,
    );
    expect(new Set(wraps.map((x) => on(x)[3]))).toEqual(new Set(['NW', 'NE', 'W', 'E', 'SW', 'SE']));
    for (const parity of [0, 1])
      expect(of('lastMoveDirOf').filter((x) => on(x)[1] % 2 === parity).length).toBeGreaterThan(0);
  });

  test('where the order form says a hero will stand after a march is where the turn leaves him: a compass step, a province next door, a Forced March next door, his own province', () => {
    // On a staged world (no guards, no foes on the way): a Move by direction, by a province next door (prov:<id>, as the
    // form writes it), a Forced March to a province next door (its bare number, as the form writes it) and a Move into
    // the province he stands in (the form's "Stay in", the turn's "already there").
    const list = marches().filter((x) => (THE_MARCHES_THE_FORECAST_GETS_RIGHT as readonly string[]).includes(x.kind));
    expect(list.map((x) => x.kind)).toEqual([...THE_MARCHES_THE_FORECAST_GETS_RIGHT]);
    expect(differences(list)).toEqual([]);
    expect(list.filter((x) => x.copy !== x.named)).toEqual([]);
  });

  test('the marches the forecast gets wrong are pinned: a march the turn refuses, a far province, a Forced March by direction (question 44)', () => {
    // The form follows the orders, not the turn's checks: a column with ships aboard ordered over land, one with too
    // little lift ordered to sea, one ordered over a neutral realm's border and one ordered past its pace (Men-at-Arms
    // march 2 a turn: the third Move) stay where the turn stopped them, but every later phase's form puts them where
    // the order named. A far province (prov:<id> or a Forced March's bare number: since #364 the turn reads both alike)
    // is one step toward it in the turn, and there in the form. A Forced March by direction (dir:, a bot's) the form
    // doesn't read: he stays, where the turn takes the step.
    const list = marches();
    const kind = (k: string) => {
      const x = list.find((m) => m.kind === k);
      if (!x) throw new Error(`no staged march of the kind ${k}`);
      return x;
    };
    expect(
      list.map((x) => x.kind).filter((k) => !(THE_MARCHES_THE_FORECAST_GETS_RIGHT as readonly string[]).includes(k)),
    ).toEqual([...THE_MARCHES_THE_FORECAST_GETS_WRONG]);
    for (const refused of ['ships over land', 'too little lift to put to sea', "a neutral realm's border"]) {
      const x = kind(refused);
      expect([refused, x.copy, x.engine]).toEqual([refused, x.named, x.from]);
    }
    const pace = kind('past his pace');
    const secondStep = Number(String((pace.on as [string, { target: string }[]])[1][1]?.target).slice(5));
    expect([pace.copy, pace.engine]).toEqual([pace.named, secondStep]);
    for (const far of ['a far province', 'a far Forced March']) {
      const x = kind(far);
      expect([far, x.copy, x.nextDoorToBoth.includes(x.engine)]).toEqual([far, x.named, true]);
    }
    const byDirection = kind("a Forced March's compass step");
    expect([byDirection.copy, byDirection.engine]).toEqual([byDirection.from, byDirection.named]);
  });

  test('the share of a province the Explore forecast counts a march as mapping is what the turn maps: March 6 leading companies, March 0, a sea sailed into', () => {
    // The turn adds 2% for each company led at March 6 or more (its mastery); the forecast does too.
    const list = marchesIn().filter((x) =>
      (THE_MARCHES_IN_THE_FORECAST_GETS_RIGHT as readonly string[]).includes(x.kind),
    );
    expect(list.map((x) => x.kind)).toEqual([...THE_MARCHES_IN_THE_FORECAST_GETS_RIGHT]);
    expect(differences(list)).toEqual([]);
    expect(list.map((x) => x.engine)).toEqual([14, 10, 10]);
  });

  test("the marches in the forecast gets wrong are pinned: a Traveller's Cloak of another name, Naval 6's charting of the coast (question 44)", () => {
    // A Travelworn Drape is a Traveller's Cloak by another name: the turn counts its 20% (it reads the item's
    // exploreMove), the forecast knows the cloak by its name. Sailing into a sea at Naval 6 with a fleet charts 5% of
    // each coast beside it in the turn; the forecast counts only the province entered.
    const list = marchesIn().filter((x) =>
      (THE_MARCHES_IN_THE_FORECAST_GETS_WRONG as readonly string[]).includes(x.kind),
    );
    expect(list.map((x) => [x.kind, x.copy, x.engine])).toEqual([
      ['a Travelworn Drape worn', 10, 30],
      ['the coast beside the sea he sails into, charted at Naval 6', 0, 5],
    ]);
  });
});

describe('what a hero holds: what the order form says he will carry and lead, and a garrison hold (P1-11d2)', () => {
  test('what the order form says a hero will carry and lead, and a garrison hold, after his orders is what the turn leaves them: items handed over, sent by courier and passed on, companies recruited, handed over, left, taken up and disbanded', () => {
    // On a staged world (no guards, no foes; each case on its own province, its heroes realm 0's): the form's
    // predictedItems, projectedLedArmies and projectedGarrison as the phase after the orders begins, against the turn's
    // phases played one at a time. Items handed to a comrade beside him (two, by their places: the higher first), one
    // sent by courier to a comrade elsewhere (gone from the pack, not yet in his), one handed over and passed on next
    // season; a mercenary band and a company of the province recruited (the band first, whatever the ticks' order), a
    // garrison company recruited (into the garrison, whoever is named), companies recruited into the garrison and under a
    // comrade's banner; a company handed to a comrade beside him, one left in the garrison and taken up by a comrade
    // next season by its place (behind the one there before), one taken up as a comrade leaves it in the same season (the turn makes the Pick Up wait), one
    // disbanded.
    const list = holdings().filter((x) => (THE_HOLDINGS_THE_FORECAST_GETS_RIGHT as readonly string[]).includes(x.kind));
    expect(list.map((x) => x.kind)).toEqual([...THE_HOLDINGS_THE_FORECAST_GETS_RIGHT]);
    expect(differences(list)).toEqual([]);
    // and each order changed what they hold
    expect(list.filter((x) => sameAnswer(x.engine, x.before)).map((x) => x.kind)).toEqual([]);
  });

  test('what the forecast gets wrong is pinned: Mithril with "all", a comrade marching in, a chain in one phase, the Stone, the beast command, a garrison band, Pick Up\'s order, risen dead (question 42)', () => {
    // The form replays the orders, not the turn's checks: a Mithril suit is forged to its wearer (the turn keeps it on
    // him); a comrade marching in that season is handed the item at once (the form, which places him where the season
    // began, sends it by courier); a chain of hand-overs in one season goes in the turn's order (a hero handing to a
    // comrade who hands on goes first), in the form's by the heroes' order; the Philosopher's Stone used is destroyed
    // (as an older save's copy carries it: the one Use Item works); a beast past a leader's beast command (his Druid
    // level, here 0) musters into the garrison, stays with the giver or goes back to the garrison; a band of garrison
    // troops hired musters into the garrison; companies taken up join last first; risen dead handed to a comrade of a
    // realm that is not Undead go to their graves (the form hands them over, and its companies carry no risen mark).
    const list = holdings();
    expect(
      list.map((x) => x.kind).filter((k) => !(THE_HOLDINGS_THE_FORECAST_GETS_RIGHT as readonly string[]).includes(k)),
    ).toEqual([...THE_HOLDINGS_THE_FORECAST_GETS_WRONG]);
    const kind = (k: string) => {
      const x = list.find((h) => h.kind === k);
      if (!x) throw new Error(`no staged holding of the kind ${k}`);
      return { ...x, before: x.before as Record<string, string[] | undefined> };
    };
    const one = (x: { before: Record<string, string[] | undefined> }, part: string, i = 0) =>
      x.before[part]?.[i] ?? `(no ${part} ${String(i)})`;
    const mithril = kind('Mithril Armour sent with "all"');
    expect([mithril.copy, mithril.engine]).toEqual([
      { giver: [], comrade: [one(mithril, 'giver', 1), 'Mithril Armour'] },
      { giver: ['Mithril Armour'], comrade: [one(mithril, 'giver', 1)] },
    ]);
    const marchingIn = kind('an item handed to a comrade marching in');
    expect([marchingIn.copy, marchingIn.engine]).toEqual([
      { giver: [], comrade: [] },
      { giver: [], comrade: [one(marchingIn, 'giver')] },
    ]);
    const chain = kind('a chain of hand-overs in one phase');
    const [handed, between] = [one(chain, 'the first to hand over'), one(chain, 'between')];
    expect([chain.copy, chain.engine]).toEqual([
      { 'the first to hand over': [], between: [handed], last: [between] },
      { 'the first to hand over': [], between: [], last: [handed, between] },
    ]);
    const stone = kind("the Philosopher's Stone used");
    expect([stone.copy, stone.engine]).toEqual([{ bearer: ["Philosopher's Stone"] }, { bearer: [] }]);
    const beasts = THE_HOLDINGS_THE_FORECAST_GETS_WRONG.filter((k) => k.includes('beast'));
    const beast = one(kind('a beast taken up past his beast command'), 'the garrison');
    expect(beasts.map((k) => [k, kind(k).copy, kind(k).engine])).toEqual([
      [
        'a beast recruited past his beast command',
        { recruiter: [beast], 'the garrison': [] },
        { recruiter: [], 'the garrison': [beast] },
      ],
      [
        'a beast handed to a comrade at his beast command',
        { giver: [], comrade: [beast], 'the garrison': [] },
        { giver: [beast], comrade: [], 'the garrison': [] },
      ],
      [
        'a beast taken up past his beast command',
        { taker: [beast], 'the garrison': [] },
        { taker: [], 'the garrison': [beast] },
      ],
    ]);
    const band = kind('a band of garrison troops hired');
    expect([band.copy, band.engine]).toEqual([
      { recruiter: ['Human Garrison (Veteran)'], 'the garrison': [] },
      { recruiter: [], 'the garrison': ['Human Garrison (Veteran)'] },
    ]);
    for (const k of ['companies taken up from the garrison by their places', 'the whole garrison taken up']) {
      const x = kind(k);
      const [a, b] = [one(x, 'the garrison'), one(x, 'the garrison', 1)];
      expect([k, x.copy, x.engine]).toEqual([
        k,
        { taker: [a, b], 'the garrison': [] },
        { taker: [b, a], 'the garrison': [] },
      ]);
    }
    const risen = kind('risen dead handed to a comrade');
    expect([risen.before, risen.copy, risen.engine]).toEqual([
      { giver: ['Men-at-Arms (Average) (risen)'], comrade: [], 'the garrison': [] },
      { giver: [], comrade: ['Men-at-Arms (Average)'], 'the garrison': [] },
      { giver: [], comrade: [], 'the garrison': [] },
    ]);
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
