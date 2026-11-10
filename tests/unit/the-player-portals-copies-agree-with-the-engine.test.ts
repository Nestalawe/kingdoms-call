// Since P1-11e43 this test keeps only the copies tests/lib/player-portal-copies.ts loads (since P1-13e9 imported from
// their page files, those written inline run in a vm by their statements; the checks and the values in
// tests/lib/the-worlds-and-the-checks-of-the-portals-forecasts-and-copies-against-the-turn.ts): the order form's
// forecasts, ledger, Practice Skill note and order list are checked, imported with no vm, by
// tests/unit/the-order-forms-forecasts-agree-with-the-turn.test.ts; the 11 projection cases and the values' reach by
// tests/unit/the-rules-the-shared-door-hands-the-portal-answer-alike-on-the-report-and-the-state.test.ts; and the
// turn report's flying carry and druidNeedP's shortfall cases are dropped (each checked one call twice). The account
// below is of the checks as they were built, where each now runs.
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
// march-in share and the sea note agree; since P1-11d14 the Explore forecast asks the engine's rule, with what the
// report gives it). Since P1-11c1, the order form's Cast Spell tables against
// the content's spells, its target field and its casting count against the engine's Cast Spell order, and the army
// card's kin and feud against the battle's armStr. Since P1-11d1, the march: the portal's three hex steps (the engine's
// own since P1-11d6, handed through src/shared/: projection cases) against the engine's step, where the form says a hero
// will stand after his Moves and Forced Marches against where the turn leaves him, and the share marching in maps against the turn's (each known difference pinned: question 44). Since P1-11d2,
// what a hero holds: what the form says he will carry and lead, and a garrison hold, after his orders, against the turn's
// phases (each known difference pinned: question 42). Since P1-11d3, the orders: the order list's names against the
// turn's, the orders it offers a hero against those the turn lets him give, and the creed orders' fields against their
// rows and the turn (each known difference pinned: questions 36, 39 and 41). Since P1-11d4, gold and practice: the
// treasury ledger against what the turn spends and Early Winter charges, the Practice Skill note against the chance
// the turn rolls, and the comrades a hero's field counts as practising beside him against the turn's (each known
// difference pinned: question 43; the practice note's none since P1-11e28). And each engine function leaves its input
// as it was.
// Level 1 (unit): pure functions on values, from a game played with the engine's modules imported directly and a world
// staged through the report's own projection. No page is needed, and a static test can't compare what two functions
// answer.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// (Since P1-11e43 the projection cases, the march's forecast, what a hero holds, the order list, the ledger and the
// Practice Skill note are the two tests named above; the flying carry and druidNeedP's shortfall cases are dropped.)
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
// it adds the aura the report sends), and on staged heroes (two Dreamstones, a trained White 7) the level the turn
// casts at and its third cast's limit (R-135: it asks the turn's rule with the report's items and aura). P1-11b1 added the truth of the copies that read the realm, the report's shape or the world,
// on six more staged worlds for the Druid rule (realm 0 Good, Druidic or Evil, with and without Dragon Taming; a hero
// of every race, alignment and Druid level 0 to 5, beside a Crown of Command and away from it, with one unit of each
// Druid level and class, of his race and of none, alive and skeletal) and one for exploring (a hero of each Explorer
// level, the Loremaster and the Trailblazer, in every land terrain, under three realms): `druidNeedP`'s shortfall against the battle's
// `druIdPenaltyMult`, and the army card's Druid shortfall and mastery lines (read by their statements) against it and
// `druidMasteryGain`, agree, beside a Crown too (R-120: the battle counts its aura, as the portal does; since P1-11b3
// both call the engine's Druid rule through `src/shared/`, so these check the level of the hero's Druid each side feeds
// it); the Explore
// forecast (`exploreGainFor`) is what `resolveExploreOrder` maps, the Loremaster's too (R-125), in a realm with no
// discovery that adds to exploring, with The Compass and with Star Charts (since P1-11d14 both ask the folder's
// `theShareOfAProvinceAnExploreOrderMaps`, so these check what each feeds it); its march-in share
// (`exploreMoveGainBefore`, on a staged march into the capital) is what `resolveMoveOrder` maps, for a hero with no
// Traveller's Cloak, one worn and one carried as a spare (R-125: a worn one alone); the army card's sea note is
// `getSeaCapability`'s answer, a Naval 8 hero's too (R-125), and on staged columns of flyers beside too few hulls, its
// words written out (R-135: the card asks `seaLiftOfAColumn`); its upkeep, on staged columns under a Druid 6 hero and a
// Druidic Wonder, is what Early Winter charges (R-135); its strength of a unit, on staged columns under Druid 8, Druid 3
// and Necromancy 6 heroes and with items, is armStr's with no ground and no battle (R-135); with War Drums and under the
// king, the card leaves the realm's discoveries out (pinned). Every engine function leaves its input as it was (the values are frozen, so a write
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
// of a unit (`theArmyCardsFiguresOfAColumn`'s, which `renderReportView` calls) is `armStr`'s, kin and feud with it, and a Druid shortfall in the
// battle's order (R-122: taken off the unit's base first, rounded down, then kin and feud). Since P1-11c4 the target field's six lists that look in the caster's
// province ask the engine's mark check (through `src/shared/`), so a case pins the heroes each of the 13 spells aimed
// at a hero offers on the staged report. P1-11d1 (plan P1-11d; since P1-11d6 the three call the engine's hex step, so
// these are projection cases: what the portal makes of it): the portal's three hex tables (`predictedLocation`, the
// Move field's `buildTargetField` statements, `lastMoveDirOf`, each run as the page runs it on the orders staged in
// its fields) step where `neighborInDir` and `getNeighborsP` do, from every province of a staged map; on a staged
// world with no guards (`marchingWorld`), where `predictedLocation` says a hero will stand is
// where `processOrder` leaves him for a compass step, a province next door, a Forced March next door or by direction, a
// Move by a province's bare number (R-128) and his own province, and since P1-11e10 for a march the turn refuses (ships
// over land, too little lift for the sea, a neutral realm's border, the war declared this turn: then a Search Lair after
// it names where he stands) and those it lets through, and since P1-11e11 for a march past his pace (the report's pools,
// a step spending the one the turn's rule names: on land, at sea, a voyage past his land pace), and since P1-11e12 for
// one step toward a far province (the turn's route on the report's map, round a neutral or unmet realm's province, none
// for a fleet inland or Men-at-Arms to a far sea, a step past his pace; a Search Lair after it); and the share `exploreMoveGainBefore` counts a march
// as mapping is the turn's at March 6 and 0 leading companies, at Explorer 7 and for a sea sailed into, and since
// P1-11e13 for a Travelworn Drape (the share his card gives) and Naval 6's charting of the coast. P1-11d2 (plan P1-11d, before any of it is shared):
// on a staged world with no guards (`holdingWorld`, each case on its own province), what `predictedItems`,
// `projectedLedArmies` and `projectedGarrison` (with `_projRecruitUnits`) say a hero will
// carry and lead, and a garrison hold, as the season after his orders begins, is what the turn's phases leave them
// (played one at a time, its loop's four stages each): items handed over beside him, sent by courier and passed on;
// companies recruited (a band and the province's, a garrison company, into the garrison, under a comrade), handed over,
// left and taken up, taken up as a comrade leaves them, disbanded, a Mithril suit sent with "all" (it stays on him: since
// P1-11e18, R-129), a beast past a leader's beast command (recruited, handed over, taken up), a band of garrison troops
// hired, companies taken up (the turn's last first), risen dead handed to a comrade (to their graves: since P1-11e19);
// and since P1-11e20 each season's items handed over in the turn's order of its heroes (a comrade marching in first, a
// chain of hand-overs, the quicker hero first; a comrade beside him who marches away after); and pinned where it is not
// (question 42): the Philosopher's Stone used, a chain of company hand-overs in one season.
// P1-11d3 (plan P1-11d, before the creed and king check and the masteries' table are shared): each of the 46 names of the
// order list (`ACTIONS`) is the order `normaliseAction` reads it as, none read as a Defend but Defend; on staged heroes of
// realm 0 (its report as the engine builds it under each creed, and with its Wonder raised), the list `actionsFor`
// offers is what `processOrder` lets him give (no refusal the list restates): each of the 20 masteries from its level
// and not one below, the five creeds' orders to their own realm and the king's to the king, Research by the trained
// Sage, Steal by the Thief the turn counts (his gloves' too: since P1-11e21, R-130), Release Hero but by the king, the
// Grand Design until it is raised, and every order of a hero seized by a charm or hired this turn (each with the card
// the page makes him); the creed
// orders' fields (`buildTargetField`, its words and its marks) say what the rows and the turn say: Call to Arms' grade
// and company, the Broker's price, the carters' price, the Wild Hunt's beasts, grade, price and term, the Blood
// Offering's marks and grades, where a king may consecrate (his home and his limit the report's since P1-11e25), Call to
// Arms' company, the carters' grave, grade and price with Corpse-Carters, and the Wild Hunt's term with The Long Hunt
// (the turn's and the report's since P1-11e26), and the Blood Offering's rows and hint (since P1-11e27, R-133: a
// company the rite never takes is locked, and the hint names what the turn gives and raises, a side left empty too).
// P1-11d4 (plan P1-11d, before the ledger's wages, the practice chance and the co-trainer are shared): on staged heroes
// of realm 0 (its report as the engine builds it from each world), what the treasury ledger (`computeOrderLedgerP`)
// says the orders will spend and add to the wages is what the turn takes from the treasury in their phase and adds to
// Early Winter's wages (each hero who served before at his wage without them): a company of the province, two at the
// capital, a garrison company, a mercenary band, a wandering hero, Supply Depots under its cap, a Druid 5 hero's beast,
// and since P1-11e29 (R-134) a Druid 6 hero's beast (half price and half wage), a beast under a Druidic Wonder (half
// wage) and a company under the Host-Leader where the report names him (1g less), and since P1-11e30 (R-134) the upkeep
// and hero-wage discoveries' savings shared under their caps (Supply Depots past its cap, Granaries, Inspiring
// Leadership), Harvest the Field, the Wild Hunt; pinned where it can't (question 43, a forecast limit): a company under
// the Host-Leader on a report that doesn't name him (the titles not yet public); the Practice Skill note (`orderChanceNote`)
// quotes the chance `processOrder` rolls at Melee 0 to 4, for a Human hero of another realm and with the practice
// discoveries, and since P1-11e28 (R-134) for a Human of a Human realm (the turn's x1.5, which it names) and at Melee 5
// (it says no roll is made, as the turn makes none); and the
// comrades a hero's Practice Skill field counts as practising beside him (`practiceCompanionSkill`) are the turn's
// co-trainers: of his realm, alive, in his province that season (marched there or away the season before too), at the
// same skill, of any level. Since P1-21n (each red on its mutant of the 2026-11-07 session): the march-in share of an
// Explorer counting above his trained level, the Send Item field's Mithril suit greyed however its items are ticked, the
// army card's half beast wage and Druid 8 quality read from his trained Druid, and the ledger's wage of a beast mustered
// to a comrade read from the comrade's column.
// Level 1: pure functions on values; no page is needed, and a static test can't compare what two functions answer.
// Planted faults: in the PRs (P1-11a2, P1-11a4, P1-11b1, P1-11b2, P1-11b3, P1-11b4, P1-11c1, P1-11c4, P1-11d1, P1-11d2,
// P1-11d3, P1-11d4, P1-11d14)
import { beforeAll, describe, expect, test } from 'vitest';
import {
  armyCardKinAgainstTheBattle,
  armyCardMasteryAgainstTheTurn,
  armyCardSeaNoteAgainstTheEngine,
  armyCardSeaNoteOnStagedColumns,
  theArmyCardsStrengthAgainstTheTurn,
  theArmyCardsUpkeepAgainstTheTurn,
  aStagedHeroLeading,
  armyCardShortfallAgainstTheBattle,
  castingLimitAgainstTheOrder,
  effMagicLvlOnStagedHeroes,
  type Comparison,
  type Copies,
  effMagicLvlAgainstTheReport,
  exploreForecastAgainstTheOrder,
  kinWorld,
  marchInGainAgainstTheMoveOrder,
  oneUnitTypePerDruidLevelAndClass,
  sameAnswer,
  samples,
  type Samples,
  theContentsSpellTables,
  theFormsSpellTablesAgainstTheContent,
  theFormsTargetsAgainstTheMarkCheck,
  theGamePlayed,
  theHeroesEachSpellAimedAtAHeroOffers,
  THE_MARCHES_IN_THE_FORECAST_GETS_RIGHT,
  theSendItemFieldWithAMithrilSuitAgainstTheTurn,
  theSendItemFieldsMithrilBoxOn,
  theMarchInForecastAgainstTheTurn,
  theMarchInShareOfAHeroWhoseCardGivesNoShareOfHisWornItems,
  theMarchInShareOfAHeroWhoseExplorerCountsAboveHisTrainedLevel,
  theCoastBesideASeaTheReportShowsNoGroundOf,
  thePortalsHexTablesAgainstTheEngine,
  theCreedFieldsAgainstTheRowsAndTheTurn,
  THE_CREED_FIELDS_THE_TURN_AGREES_WITH,
  theCoTrainersAgainstTheTurn,
  THE_COMRADES_AT_PRACTICE,
  theWarlocksTitle,
  worldSamples,
  type WorldSamples,
} from '../lib/the-worlds-and-the-checks-of-the-portals-forecasts-and-copies-against-the-turn.ts';
import { playerPortalCopies, theOrderFormsSpells } from '../lib/player-portal-copies.ts';
import { KC_RIVAL_RACE } from '../../src/content/kingdoms-call-data.ts';
import { unitBaseStrength } from '../../src/engine/rules-on-plain-values/unit-types-and-base-strength.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

let copies: Copies;
let values: Samples;
/** `make`'s answer, made once (the P1-11b1 checks: each runs on about 90,000 Druid cases or a few hundred others). */
function lazily<T>(make: () => T): () => T {
  let kept: { value: T } | null = null;
  return () => (kept ??= { value: make() }).value;
}
const armyCardShortfall = lazily(() => armyCardShortfallAgainstTheBattle(copies, worldValues));
const armyCardMastery = lazily(() => armyCardMasteryAgainstTheTurn(copies, worldValues));
const exploreForecast = lazily(() => exploreForecastAgainstTheOrder(copies, worldValues));
const seaNote = lazily(() => armyCardSeaNoteAgainstTheEngine(copies, values));
const stagedSeaNote = lazily(() => armyCardSeaNoteOnStagedColumns(copies));
const marchIn = lazily(() => marchInGainAgainstTheMoveOrder(copies));
const theForm = lazily(() => theOrderFormsSpells());
const castingLimit = lazily(() => castingLimitAgainstTheOrder(theForm()));
const kin = lazily(() => armyCardKinAgainstTheBattle(copies, kinWorld()));
const hexSteps = lazily(() => thePortalsHexTablesAgainstTheEngine(copies));
const marchesIn = lazily(() => theMarchInForecastAgainstTheTurn(copies));
const creedFields = lazily(() => theCreedFieldsAgainstTheRowsAndTheTurn(copies));
const coTrainers = lazily(() => theCoTrainersAgainstTheTurn(copies));
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

  test('effMagicLvl is the level the turn casts at: a trained level counts to 5, two items of one name once (R-135, question 45 (c))', () => {
    // No matrix game trains a school past 5 or holds two of one item, so the heroes are staged. The form added every
    // item and took a trained 7 as 7: a Psychic 2 hero with two Dreamstones was offered a third Psychic cast the turn
    // refuses, and White 7 read "Lv7" where the turn counts 5. Since R-135 it asks the turn's own rule, with the items
    // and the aura the report counts.
    const list = effMagicLvlOnStagedHeroes(copies, theForm());
    expect(list.map((x) => x.engine)).toEqual([3, 5, 6, true]);
    expect(differences(list)).toEqual([]);
  });
});

describe('the copies that read the realm, the report’s shape or the world (P1-11b1)', () => {
  test('the values reach every Druid level and class of unit, under each realm and hero, and each pinned case', () => {
    const about = (x: { on: unknown }) => x.on as { unit: unknown[]; hero: unknown[]; realm: [unknown, unknown[]] };
    const need = armyCardShortfall();
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

  test("the army card's Druid shortfall: the strength it shows is the battle's, beside a Crown of Command too (R-120)", () => {
    const list = armyCardShortfall();
    expect(list.filter((x) => x.aura !== 0).length).toBeGreaterThan(0);
    expect(differences(list)).toEqual([]);
  });

  test("the army card's Druid mastery bonus is the turn's (druidMasteryGain), beside a Crown of Command too", () => {
    expect(differences(armyCardMastery())).toEqual([]);
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

  test("the army card's sea note pools the flyers' lift with the hulls, as the turn does (R-135, question 45 (d))", () => {
    // No matrix game leads humanoid flyers beside too few hulls, so the columns are staged, at Naval 0 and 8. The card
    // counted the hulls alone: Eagle Riders and a Galleon Fleet with two Knights read "needs 2 hulls, has 1" where the
    // turn sails them (a hull and a flyer). Since R-135 it asks the turn's seaLiftOfAColumn, as the Move note does.
    const list = stagedSeaNote();
    expect(list).toHaveLength(12);
    for (const verdict of ['sea', 'land']) expect(list.filter((x) => x.engine === verdict).length).toBeGreaterThan(1);
    expect(differences(list)).toEqual([]);
  });

  test("the army card's upkeep is the wages the turn charges: a Druid 6 leader's beasts, or a Druidic Wonder's, pay half (R-135, question 45 (b))", () => {
    // No matrix game has a Druid 6 hero leading beasts, so the columns are staged. The card summed each unit's whole
    // wage: two Thunderbirds under a Druid 6 hero read 8g where Early Winter charges 4g. Since R-135 it halves a beast's
    // wage as the turn does (e23's rule, with the report's Wonder flag); a skeleton, a summons and a Wild Hunt beast as
    // before. The figures are written out too: both sides ask the same halving.
    const list = theArmyCardsUpkeepAgainstTheTurn(copies);
    expect(differences(list)).toEqual([]);
    expect(list.map((x) => [x.column, x.copy])).toEqual([
      ['two Thunderbirds under a Druid 6 hero', 4],
      ['two Thunderbirds under a Druid 5 hero', 8],
      ['two Thunderbirds under a Druid 5 hero of a realm whose Druidic Wonder stands', 4],
      ['a Unicorn Herd under a Druid 6 hero', 2],
      ['two Men-at-Arms under a Druid 6 hero', 6],
      ['skeletal Thunderbirds under a Druid 6 hero', 1],
      ['summoned Thunderbirds under a Druid 6 hero', 0],
      ['Thunderbirds of the Wild Hunt under a Druid 6 hero', 0],
    ]);
  });

  test("the army card's strength of a unit is the turn's before the ground and the foe: Druid 8, Necromancy 6, his items (R-135, question 45 (a)); the realm's discoveries pinned", () => {
    // No matrix game has a Druid 8 hero leading beasts, a Necromancy 6 hero leading skeletons, or a hero leading with
    // items that lift his units, so the columns are staged. The card counted the unit's base strength, a Druid shortfall,
    // its kin and the Druid mastery: Thunderbirds under a Druid 8 hero read "str 40" where the battle's armStr, with no
    // ground and no battle, gives 59. Since R-135 it asks the turn's steps in armStr's order. The realm's unit-strength
    // discoveries it can't count yet (the report doesn't carry their effects, and the page holds no table of them): the
    // two columns they lift are pinned, the card's figure before them.
    const list = theArmyCardsStrengthAgainstTheTurn(copies);
    expect(list.filter((x) => x.copy !== x.engine).map((x) => [...(x.on as string[]), x.copy, x.engine])).toEqual([
      ['Men-at-Arms under a hero of a realm with War Drums', 'Men-at-Arms', 17, 18],
      ["Free Lances under the king of a realm whose discovery lifts its king's cavalry", 'Free Lances', 17, 20],
    ]);
    expect(list.map((x) => [...(x.on as string[]), x.engine])).toEqual([
      ['Thunderbirds under a Druid 8 hero', 'Thunderbirds', 59],
      ['Thunderbirds under a Druid 3 hero', 'Thunderbirds', 17],
      ['skeletal Men-at-Arms under a Necromancy 6 hero', 'Men-at-Arms', 26],
      ['Free Lances under a hero with a Golden Spur and a Battle Standard', 'Free Lances', 24],
      ['Free Lances under a hero with a Golden Spur and a Battle Standard', 'Men-at-Arms', 19],
      ['Men-at-Arms under a hero of a realm with War Drums', 'Men-at-Arms', 18],
      ['Men-at-Arms under a hero of a Divine realm with the Chalice of Dawn', 'Men-at-Arms', 20],
      ["Free Lances under the king of a realm whose discovery lifts its king's cavalry", 'Free Lances', 20],
    ]);
  });

  test("the army card's upkeep and strength read his trained Druid where the turn does: a +1 Druid item lifts neither the half wage nor the Druid 8 quality (P1-21n)", () => {
    // Early Winter halves a beast's wage under a hero of trained Druid 6, and armStr lifts a beast's quality under one
    // of trained Druid 8 (his Druid mastery reads the Druid as it counts). Two Thunderbirds (4g each) under a hero of
    // Druid 5 counting 6: 8g. Average Thunderbirds (11 × 2) under a hero of Druid 7 counting 8: his mastery's +80%, 40;
    // under a hero of trained Druid 8, lifted to Veteran (11 × 3) first, 59.
    const birds = (n: number) =>
      Array.from({ length: n }, () => ({ type: 'Thunderbirds', quality: 'Average', cost: 4 }));
    const hero = (trained: number, counting: number) => ({
      race: 'Human',
      alignment: 'Good',
      skills: { druid: trained },
      skillEff: { druid: { total: counting } },
      armies: birds(2),
    });
    const report = { kingdom: { alignment: 'Good', race: 'Human' } };
    const upkeep = (h: Record<string, unknown>) => copies.armyCardUpkeep(h['armies'], h, report);
    expect([upkeep(hero(5, 6)), upkeep(hero(6, 6))]).toEqual([8, 4]);
    const strength = (h: Record<string, unknown>) => copies.armyCardUnitStrength(birds(1)[0], h, report);
    expect([strength(hero(7, 8)), strength(hero(8, 8))]).toEqual([40, 59]);
  });

  test("the army card's sea note says what the turn's lift is, in words (R-135)", () => {
    // Both the card and the turn ask seaLiftOfAColumn, so a fault in it moves both sides of the case above: here the
    // words are written out.
    const words = (column: string[], naval: number) => {
      const hero = aStagedHeroLeading(column, naval);
      let text = String(copies.armyCardSeaNote(hero['armies'], hero));
      for (let was = ''; was !== text;) {
        was = text;
        text = text.replace(/<[^>]*>/g, '');
      }
      return text;
    };
    const knights = ['Eagle Riders', 'Galleon Fleet', 'Household Knights', 'Household Knights'];
    const levies = ['Galleon Fleet', ...Array<string>(4).fill('Shieldwall Levies')];
    expect([words(knights, 0), words(levies, 0), words(levies, 8)]).toEqual([
      ' · ⚓ Sea transport: needs 2 hulls, has 1, and the flyers carry the rest — can put to sea',
      ' · ⚓ Sea transport: needs 2 hulls, has 1 — 2 units left ashore: more fleet units or flyers to carry the whole force',
      ' · ⚓ Sea transport: needs 1 hull, has 1 — can put to sea',
    ]);
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
    // province one step that way, none off the map) and lastMoveDirOf (the direction a fresh Move opens on) each called
    // a table of the six steps by the parity of a row of their own until P1-11d6; they call the engine's hex step now
    // (src/shared/), so this is a projection case: each hands it the province, the map's size and the direction, and
    // reads its answer (a place, or null past the top or bottom row) as the turn does, which steps by neighborInDir and
    // reads a province next door by getNeighborsP. From every province of the staged map (8 by 7): its rows of each
    // parity, the top and bottom rows (a step off the map: the turn's "icy wastes", where he stays) and both ends of a
    // row (the map wraps east to west).
    const list = hexSteps();
    expect(differences(list)).toEqual([]);
    const of = (table: string) => list.filter((x) => x.table === table);
    expect([of('predictedLocation').length, of('the Move field').length, of('lastMoveDirOf').length]).toEqual([
      336, 56, 304,
    ]);
    // the note under the Move field: the icy wastes bar a way north from the top row, south from the bottom row, none
    // from the rows between (and a map of 7 rows has a row of each)
    const wastes = of('the Move field’s icy wastes');
    expect(wastes.length).toBe(56);
    expect(new Set(wastes.map((x) => JSON.stringify(x.engine)))).toEqual(
      new Set(['[true,false]', '[false,true]', '[false,false]']),
    );
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

  test('the share of a province the Explore forecast counts a march as mapping is what the turn maps: a Travelworn Drape, March 6, 5 and 0 leading companies, Explorer 7, a sea sailed into and the coast Naval 6 charts beside it, and none elsewhere or with no ships (R-128)', () => {
    // The turn adds the share his worn items add (a Travelworn Drape is a Traveller's Cloak by another name: its 20%),
    // 2% for each company led at March 6 or more (its mastery; the companies he leads as the turn begins on the form:
    // question 61), 5% a level of his Explorer as it counts (to 5), and sailing into a sea at Naval 6 with ships 5% of
    // each land province beside it (not one further off, not a sea, not with flyers alone). Since P1-11e13 the forecast
    // reads the share his card gives and charts the coast too.
    const list = marchesIn();
    expect(list.map((x) => x.kind)).toEqual([...THE_MARCHES_IN_THE_FORECAST_GETS_RIGHT]);
    expect(differences(list)).toEqual([]);
    expect(list.map((x) => x.engine)).toEqual([30, 14, 10, 10, 35, 10, 5, 0, 0, 0]);
  });

  test('a hero whose card gives no share of his worn items marches in with none on the form (a report older than the field: a forecast limit, P1-11e13)', () => {
    // A report written before the card gave the share (P1-11e8) holds no figure for it: the form counts none, as for a
    // hero with no cloak, until the next turn's report gives it.
    const { given, notGiven, noCloak } = theMarchInShareOfAHeroWhoseCardGivesNoShareOfHisWornItems(copies);
    expect([given, notGiven]).toEqual([30, noCloak]);
  });

  test('a hero whose Explorer counts above his trained level marches in with the share of his Explorer as it counts (P1-21n)', () => {
    // The turn grants 5% a level of his Explorer as it counts (an item's +2 too): trained at 1, counting at 3, a march
    // in maps 10% and 15%, not 10% and 5%.
    expect(theMarchInShareOfAHeroWhoseExplorerCountsAboveHisTrainedLevel(copies)).toBe(25);
  });

  test('a coast beside a sea the report shows no ground of is charted by no voyage on the form (a forecast limit, P1-11e13)', () => {
    // The report's unknown tier gives a province's ground as null, which the form can't tell from land: so a voyage
    // into such a sea charts nothing of the coast on the form, where the turn charts its 5%.
    expect(theCoastBesideASeaTheReportShowsNoGroundOf(copies)).toEqual({ forecast: 0, turn: 5 });
  });
});

describe('what a hero holds: what the order form says he will carry and lead, and a garrison hold (P1-11d2)', () => {
  test('the Send Item field lists a Mithril suit but lets him tick only what the turn hands over (P1-11e18, R-129)', () => {
    // A granted suit is forged to its wearer: the field still lists it (the boxes' values are places in his pack, so
    // dropping it would shift every later one) but greyed, by the turn's own check (src/shared/).
    const { listed, ticked, turn } = theSendItemFieldWithAMithrilSuitAgainstTheTurn(copies);
    expect(listed).toEqual(['Mithril Armour', ...turn]);
    expect(ticked).toEqual(turn);
    expect(turn).toHaveLength(1);
  });

  test('the Send Item field greys a Mithril suit however his items are ticked: none, the suit by its place, or all (P1-21n)', () => {
    // The turn keeps a granted suit on its wearer however the order names it, so its box is never one he may tick.
    expect(['', '0', 'all'].map((target) => theSendItemFieldsMithrilBoxOn(copies, target))).toEqual([
      { disabled: true, checked: false },
      { disabled: true, checked: false },
      { disabled: true, checked: false },
    ]);
  });
});

describe('the orders: what the order form offers a hero, and what the creed orders’ fields say (P1-11d3)', () => {
  test('the creed orders’ fields say what their rows and the turn say: Call to Arms’ grade and company, the Broker’s and the carters’ price, the grave the carters raise, the Wild Hunt’s beasts and term, the Blood Offering’s marks and grades, where a king may consecrate', () => {
    // On realm 0's report under each creed, the form's buildTargetField (its words and its marks) against the rows
    // (src/content/alignment-orders-…) and processOrder on the state: a Call to Arms in a province whose first company
    // is a garrison (a Green Human Garrison), whose first is not (the garrison all the same) and whose companies hold
    // none (its race's: an Elven Garrison), word bought from a province (2g), Harvest the Field (2g; nothing with
    // Corpse-Carters, the row's 2g on a report that names no price; the most experienced of two graves; a grade higher
    // while the realm's Wonder stands: since P1-11e26, R-131 and R-132), the Rite of the Wild Hunt (two Veteran Stone
    // Giants at the price of one, serving one turn beyond this; two with The Long Hunt, the report's; the row's one on
    // a report older than its term), a Blood Offering marked on two companies (the first given, the second raised two
    // grades), and since P1-11e27 (R-133) on a bound beast (its row locked), with nothing marked or a side left empty
    // (the hint: the turn gives the first company it may and raises the next; so does the Move note's column after it),
    // by a hero leading one it may take (no offering), a Consecrate in a province of the realm (it consecrates) and in
    // the capital (the home marches); and Consecrate's home and limit as the report gives them
    // (P1-11e25, R-131): a captured seat of tax 10 is not the home, nor is the capital once lost (the provinces beside
    // it are still the home marches), and the limit is the king's trained White and Holy Sites' one more (White 7 at
    // five, White 3 at three with Holy Sites, and White 2 under a Curse of 2 at one consecrate; White 2 at two is the
    // limit); a report older than those fields reads his trained White, and the home by its crown marker. And the Move note, the phase after a Rite of the Wild Hunt,
    // counts as many bound beasts in the column as the rite binds (P1-11d8: the row's number).
    const list = creedFields().filter((x) =>
      (THE_CREED_FIELDS_THE_TURN_AGREES_WITH as readonly string[]).includes(x.kind),
    );
    expect(list.map((x) => x.kind)).toEqual([...THE_CREED_FIELDS_THE_TURN_AGREES_WITH]);
    expect(differences(list)).toEqual([]);
    // and each number the field states is its row's
    const fromTheRows = (x: (typeof list)[number]) =>
      Object.fromEntries(Object.keys(x.rows).map((k) => [k, (x.copy as Record<string, unknown>)[k]]));
    expect(list.map((x) => [x.kind, fromTheRows(x)])).toEqual(list.map((x) => [x.kind, x.rows]));
  });
});

describe('gold and practice: what the treasury ledger and the Practice Skill note say, and who practises together (P1-11d4)', () => {
  test('a hero’s Practice Skill field counts as practising beside him the comrades the turn trains him with: of his realm, alive, in his province that season, at the same skill, of any level', () => {
    // The form's practiceCompanionSkill (the skill a comrade practises beside him, which his field opens on) against
    // the turn's co-trainers (the peers, the mentor and the pupils its line names): a comrade beside him that season (at
    // his level, above it, below it), at another skill, in another season, next door, marched to him or away the
    // season before; a fallen comrade; a hero of another realm.
    const list = coTrainers();
    expect(list.map((x) => x.kind)).toEqual([...THE_COMRADES_AT_PRACTICE]);
    expect(differences(list)).toEqual([]);
    expect(list.filter((x) => x.copy === true).map((x) => x.kind)).toEqual([
      'a comrade practising Melee beside him in the same season',
      'a comrade of a higher level practising Melee beside him',
      'a comrade of a lower level practising Melee beside him',
      'a comrade who marched to him the season before',
    ]);
  });
});

test('each engine function leaves its input as it was (the values are frozen: a write throws)', () => {
  const changed = [...armyCardShortfall(), ...armyCardMastery(), ...seaNote(), ...stagedSeaNote(), ...kin()]
    .filter((c) => c.engineChangedItsInput)
    .map((c) => `on ${JSON.stringify(c.on).slice(0, 160)}`);
  expect(changed).toEqual([]);
});
