// The player portal's copies of the engine's rules that are left, the engine's functions it now calls in their place,
// and the values both are checked on (plan P1-11a, Decisions 5, 6 and 7). tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts
// checks them.
//
// Until P1-11a4 the player page loaded no engine file: where it needed a rule of a hero, an army, an item or a number, it
// kept its own copy (`floorNumP`, `unitBaseStrengthP`, …). P1-11a4 swapped each of the 16 copies that agreed with the
// engine's function for that function, which the portal now imports through src/shared/. So two ways of checking are
// left (Decision 7):
//   projection  the engine's function on the report's value against it on the state's value the report made it from:
//               the report hands the portal what the engine reads. For the 9 swapped rules whose value the report
//               makes from the state (the other 7 take a number, a level, an alignment or a games row: one function on
//               one value, nothing left to compare), for the beast command P1-11b3 swapped (the portal's
//               beastCommandCountP gave way to countsAgainstBeastCommand, its Druid table to the engine's), and for the
//               sea lift P1-11b4 swapped (poSeaAnalysis counts through seaLiftOfAColumn, getSeaCapability's body).
//   truth       for the copies that stay (they read the report's shape, the realm or the world): the copy on the
//               report's value, the engine's function on the state's. It says whether the portal tells the
//               player what the turn will do. P1-11b1 added the Druid a hero needs to lead a unit (druidNeedP), the
//               army card's Druid and sea-transport lines, the turn report's own flying carry and the Explore order's
//               forecast (exploreGainFor); where a copy is known to disagree (plan P1-11b's questions for Toby), the
//               difference is pinned exactly. P1-11b2 retired the turn report's copy (it calls getFlyCapability): its
//               statement that gives a column the flyers' pace is checked against the engine on the state's column.
//               Since P1-11b3 druidNeedP and the army card's Druid lines call the engine's rule (src/shared/) with the
//               portal's own level of the hero's Druid, so their truth cases check the level each side feeds it; since
//               P1-11d14 the Explore forecast asks the engine's rule of the share an Explore order maps, so its truth
//               cases check what each side feeds it (the hero's Explorer, his Trailblazer, his realm's discoveries).
//
// The copies are read from src/ui/player/ by their syntax tree (tests/lib/source.ts) and run in a context of their
// own, with the data file run beside them as a script (the content as the player page holds it, before the engine
// rewrites the item catalogue's tiers as it loads) and the names src/shared/ hands the portal, as it imports them. The
// player page's modules can't be imported here: they start the page (its database client) as they load. A copy written
// inline in a longer function is read by its statements (statementsBetween) and run as a function of what they read.
// The engine's functions are imported directly, with no vm (P1-11a1).
//
// The values (Decision 5): the balance matrix's game scripted-05 played with the engine's modules imported directly,
// its scripted realm's report after every turn and the state it was built from; and a staged world in the engine's
// shape handed through the report's own projection (buildTurnReport): every catalogue item, held by a hero of every
// race and alignment; every unit type at every quality, with the flags the engine and the report use; columns made of
// every kind of unit, led by heroes with and without the naval mastery that doubles a hull. The checks read the
// realm's own heroes, their units and their items: the values the report makes from the state. (Until P1-11a4 the swap
// cases also took every alignment pair, every level, games rows and every number the reports hold.) For the Druid
// rule, six more staged worlds (druidWorlds), for the Explore order three more (exploreWorld: a realm with no discovery
// that adds to exploring, one with The Compass and one with Star Charts, P1-11d14) and for the march-in share
// one more (marchWorld, P1-23t: the forecast's exploreMoveGainBefore against the Move order), and for the march's
// forecasts one more with no guards (marchingWorld, P1-11d1: predictedLocation and exploreMoveGainBefore against
// processOrder) and every province of a staged map (the hex tables), and for what a hero holds one more (holdingWorld,
// P1-11d2: predictedItems, projectedLedArmies and projectedGarrison against the turn's phases), and for the orders one
// more under each creed (aWorldForTheOrders, P1-11d3: actionsFor and the creed orders' fields against processOrder),
// and for gold and practice its worlds again (P1-11d4: computeOrderLedgerP, orderChanceNote and practiceCompanionSkill
// against the turn's phases and Early Winter's wages), each sized so the whole test runs in a few seconds. For the order form's Cast Spell checks and the army card's kin (P1-11c1, at the end): a
// report staged for the target field, a world of five casters and one of the kin (kinWorld).
import vm from 'node:vm';
import {
  ALL_MAGIC_ITEMS_P,
  KC_ALIGNMENTS,
  KC_CARRIER_BERTHS,
  KC_DRUID_LEVELS,
  KC_HEX_DIRS,
  KC_HUMANOID_RACES,
  KC_ITEM_RACE_ALIAS,
  KC_MAGIC_SCHOOLS,
  KC_QUALITY_TIERS,
  KC_SEASONS,
  KC_UNIT_CLASS,
  KC_UNIT_TYPE,
  LEGENDARY_ITEMS_P,
  SAGE_DISCOVERIES_P,
  SPELL_DEFS_P,
} from '../../src/content/kingdoms-call-data.ts';
import { SKILL_LABELS, type ArmyInABattle, type HeroInABattle } from '../../src/engine/army-tables.ts';
import { getSeaCapability, setMovePool } from '../../src/engine/units/movement-pools.ts';
import { seaLiftOfAColumn } from '../../src/engine/rules-on-plain-values/ships-and-flyers-that-carry-a-column-across-the-sea.ts';
import { perkTier } from '../../src/engine/titles/perks.ts';
import {
  isLegendaryItem,
  itemRaceOf,
  itemSlot,
  itemUsableBy,
} from '../../src/engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import { MITHRIL_ARMOUR } from '../../src/engine/heroes/fame-and-consecration.ts';
import {
  skillFameLabelM,
  topSkillOf,
} from '../../src/engine/rules-on-plain-values/skills-in-order-and-a-heros-fame-in-words.ts';
import { unitBaseStrength, unitTypeOf } from '../../src/engine/rules-on-plain-values/unit-types-and-base-strength.ts';
import {
  AERIAL_TYPES,
  getFlyCapability,
  isAirCarriable,
} from '../../src/engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { countsAgainstBeastCommand } from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import { beastCommandCount, druIdPenaltyMult } from '../../src/engine/world/tables.ts';
import { armStr, druidMasteryGain } from '../../src/engine/battle/terrain-and-unit-strength.ts';
import { resolveCastSpellOrder } from '../../src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts';
import { theMarkOfThisSpellMustStandInTheProvince } from '../../src/engine/rules/the-registry-of-spell-effects.ts';
import { dragonTamed } from '../../src/engine/discoveries.ts';
import { resolveExploreOrder } from '../../src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts';
import { resolveMoveOrder } from '../../src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts';
import { getNeighborsP, neighborInDir } from '../../src/engine/world/map-helpers.ts';
import { processOrder } from '../../src/engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts';
import {
  buildPhaseIntents,
  normaliseAction,
  PHASE_ACTION_MAP,
} from '../../src/engine/turn/phase-intents-and-dependency-ordering.ts';
import {
  endPhaseSkillRisesFallenCommandersAndProvinceMemory,
  pinAndReactToPhaseIntents,
  resolvePhaseOrdersInTwoTiersAroundTheDefendStep,
  startPhaseHealingSnapshotsAndStalledBattles,
} from '../../src/engine/turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.ts';
import { anItemIsTheMithrilSuit } from '../../src/engine/rules/the-registry-of-magic-item-effects.ts';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import { warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages } from '../../src/engine/turn/before-the-first-phase-war-without-warning-research-choices-messages-move-pools-and-default-defend.ts';
import { relKeyOf } from '../../src/engine/realms/relations-and-captures.ts';
import { earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill } from '../../src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts';
import { isBotRow } from '../../src/engine/bots/setup.ts';
import { THE_ALIGNMENT_ORDERS } from '../../src/content/alignment-orders-their-keys-names-creeds-numbers-and-words.ts';
import { computeMinorTitles, computeStandings } from '../../src/engine/titles/reckoning.ts';
import { TITLES_PUBLIC_FROM_TURN } from '../../src/engine/titles/perks.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { resolveTurn } from '../../src/engine/run-turn.ts';
import { buildReports } from '../../src/views/every-realms-report-and-the-lines-each-realm-reads.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { buildTurnReport } from '../../src/views/turn-report.ts';
import { playerView } from '../../src/views/what-each-realm-may-see-of-the-world.ts';
import type { GameState, Province } from '../../src/schemas/saved-game-state.ts';
import * as theRulesTheSharedDoorHandsThePortal from '../../src/shared/the-engines-rules-the-player-portal-shares.ts';
import { MAP_SIZES, MAX_TURNS, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { GAME, SETUPS, slotRowsJson } from './matrix-game.ts';
import { initializersOf, scriptOf, sourceOf, statementsBetween, type SourceOptions } from './source.ts';
import { addTheFieldsResolveTurnAdds } from './the-fields-resolve-turn-adds-to-the-turns-context.ts';

/** A value as the JSON of a save or a report holds it. */
export type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const objects = (x: unknown): Obj[] => (Array.isArray(x) ? x.filter(isObj) : []);
const copyOf = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const SCHOOLS: readonly string[] = KC_MAGIC_SCHOOLS;

// ── The copies ────

/** Where the order form says a hero will stand (predictedLocation), and since P1-11e10 what it reads: the march the
 *  turn refuses and the relation at a border, and its one answer a refresh (the report it was kept for, the answers,
 *  the fields it was worked out from); since P1-11e11 his move pools as the report gives them; since P1-11e12 the step
 *  the turn takes toward a far province. */
const THE_MARCH_FORECASTS_DECLARATIONS = [
  'hisMovePoolsAsTheReportGivesThem',
  'theRelationAMarchMeetsAtTheBorderOf',
  'aMarchTheTurnRefuses',
  'theStepTowardAFarProvinceTheTurnTakes',
  'theForecastsReport',
  'theForecastsAnswers',
  'whatTheForecastOfThePhasesBeforeReads',
  'predictedLocation',
];
/** The copies left (and the tables and helpers they read) by file, as the player portal declares them. */
const COPIES: Record<string, string[]> = {
  // (and the label of a company, which the Blood Offering's rows show: P1-11d3; and the note under an order that
  // quotes its chance, which the Practice Skill field shows: P1-11d4)
  'ui/player/order-chances.ts': ['chanceLine', 'orderChanceNote', 'ITEM_UNCAPPED_SKILLS_P', 'effMagicLvl', 'armyLabel'],
  // druidNeedP feeds the portal's level of the hero's Druid to the engine's rule (since P1-11b3; the army card reads the
  // engine's two sets of beasts, and asks its Druid mastery's guard, through src/shared/ since P1-11d12)
  'ui/player/skills-and-projections.ts': [
    'druidNeedP',
    // (the word of a unit's race on its label, and a wandering hero's wage, which the Broker's field shows: P1-11d3)
    'HUMANOID_RACES_UI',
    'PRIMAL_SUBRACE_CLASS',
    'formatRace',
    'heroHireWageOfP',
  ],
  // the Explore order's forecast (since P1-11d14 it feeds the engine's rule what the report gives: not a copy of the
  // rule, kept to run its truth cases), and the share of the province a march into it maps first (P1-23t), which reads
  // where a hero will stand; the target field of an order (P1-11d3: the creed orders' fields); and the skill a comrade
  // practises beside a hero, which his Practice Skill field opens on (P1-11d4: the co-trainers), with the order it reads
  'ui/player/order-targets.ts': [
    'exploreGainFor',
    'exploreMoveGainBefore',
    '_draftOrdersSnapshot',
    'draftOrderAt',
    'practiceCompanionSkill',
    'buildTargetField',
  ],
  // the treasury ledger at the top of the orders (P1-11d4): what the orders will spend and add to the wages
  'ui/player/orders-form.ts': ['computeOrderLedgerP'],
  // the order form's forecasts (P1-11e3: one file): the order a page's field holds (P1-11d1: the fields stood in below),
  // where a hero will stand after his orders so far (P1-11d1: the Explore forecast and the Move field read it), what he
  // will carry and lead, and a province's garrison hold (P1-11d2: the forms of the later phases read them), with the
  // units a Recruit musters and which go to the garrison; since P1-11e10 the march the turn refuses, asked on the column
  // the Move note counts, and the forecast's one answer a refresh; and since P1-11e10 the column the Move note counts
  // (P1-11d8: its beasts of the Wild Hunt are the rite's row's number), with the sea lift, the ships and the orders it
  // can't count, and a hero's skill as the report counts it (skillEff: druidNeedP, exploreGainFor and the army card
  // read it), which the march forecast reads (moved from move-analysis.ts and items-and-heroes.ts, no statement changed)
  'ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts': [
    'getOrderTarget',
    'PO_SEA_TYPES',
    'PO_CARRIER_TYPES',
    'PO_AERIAL_TYPES',
    'PO_PROJECTED_FOOT',
    'takesHalfAHullAboardOrIsYetToBeRaised',
    'poSeaAnalysis',
    'PO_UNCOUNTABLE_ACTIONS',
    'PO_UNCOUNTABLE_SPELLS',
    'projectedMoveHost',
    'effSkillP',
    ...THE_MARCH_FORECASTS_DECLARATIONS,
    'predictedItems',
    'GARRISON_UNIT_TYPES_P',
    '_isAutoGarrisonRecruit',
    '_projRecruitUnits',
    // since P1-11e17 one replay of the phases' orders, which the three read
    'theFormsReplayOfThePhasesBefore',
    'theItemsAPhasesOrdersHandOver',
    'theGarrisonTheReportShows',
    'theCompaniesAPhasesOrdersAddToEachGarrison',
    'theGarrisonAPickUpOfThePhaseSees',
    'theGarrisonsAfterAPhase',
    'theCompaniesAHeroLeadsAfterAPhase',
    'theCompaniesTheReplayGivesTheHeroOfId',
    'projectedGarrison',
    'projectedLedArmies',
  ],
  // the mastery orders' table (P1-11d3: the order list's gates read it), each order's name, skill and level its row's
  // (P1-11d10: the content's rows run beside the copies) and its target and hint the form's own
  'ui/player/l79-orders.ts': ['THE_FORMS_FIELDS_OF_EACH_MASTERY_ORDER', 'L79_ORDERS'],
  // and the order list a hero's form offers (P1-11d3), with the tables and checks it reads
  'ui/player/items-and-heroes.ts': [
    'RUMOUR_COST_BY_POWER_P',
    'DIRECTIONS',
    'ACTIONS',
    'ALIGN_ACTIONS',
    'gdAlreadyBuiltP',
    'rawSkillLvl',
    'skillsUnseenP',
    'ACTION_DISPLAY_ORDER',
    '_actionRank',
    'actionsFor',
  ],
  // (and the skills' names, which the Practice Skill note gives: P1-11d4)
  'ui/player/move-analysis.ts': ['lastMoveDirOf', 'SKILL_LABELS'],
};
const ARMY_CARD = 'ui/player/report.ts';
const TURN_REPORT = 'views/turn-report.ts';
/** The copies written inline, inside a longer function: each read by its statements (tests/lib/source.ts's
 *  statementsBetween) and run as a function of what those statements read. The army card is the "Armies leading" part
 *  of a hero's card on the player's report screen (renderReportView); the turn report's flying carry is the statement
 *  that gives a column the flyers' pace when it takes to the air (buildTurnReport: it calls getFlyCapability, since
 *  P1-11b2, where it kept a copy of it and of isAirCarriable). */
const statementCopies = (opts: SourceOptions) => `
// The army card's Druid lines for one unit \`a\` of the hero \`c\`: the strength left of a unit of 1,000 by a Druid
// shortfall (the card's own sum, rounded down as the battle rounds it: R-122), the Druid mastery bonus in percent, and
// the shortfall.
function armyCardDruidLines(a, c, report) {
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'druLevel', 'druLevel', opts)}
  let bs = 1000, druidUnits = 0, druidShort = 0;
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'creature', 'mastery', opts)}
  return { strengthOfAThousand: bs, mastery, shortfall };
}
// The army card's sea-transport note for the column \`arr\` the hero \`c\` leads, as the words the card shows.
function armyCardSeaNote(arr, c) {
  let druidUnits = 0, druidShort = 0;
  ${statementsBetween(ARMY_CARD, 'renderReportView', '_FLY_UI2', 'druNote', opts)}
  return String(_seaNote);
}
// The army card's strength for one unit \`a\` of the hero \`c\`, as its line shows it ("str …"): the unit's kin (its
// realm's king's and its leader's), a rival kin's leader, a Druid shortfall and the Druid mastery, in the battle's
// order since R-122 (plan P1-11c1): the shortfall off the unit's base strength first, then its kin, then the mastery.
function armyCardUnitStrength(a, c, report) {
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'kingdom', 'kingdom', opts)}
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'druLevel', 'druLevel', opts)}
  let totalStr = 0, druidUnits = 0, druidShort = 0;
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'bs', 'totalStr+=bs;', opts)}
  return bs;
}
// The turn report's flying carry, on the column \`armies\` as the report projects it.
function turnReportFlyingCarry(armies) {
  ${statementsBetween(TURN_REPORT, 'buildTurnReport', 'SEA_UNIT_TYPES', 'AERIAL_UNIT_TYPES', opts)}
  ${statementsBetween(TURN_REPORT, 'buildTurnReport', 'canFlyRep', 'canFlyRep', opts)}
  return { canFly: canFlyRep };
}
// exploreGainFor reads the report the page shows (its currentReport): here, the one handed in.
function exploreGainOn(report, c, terrain) {
  currentReport = report;
  try { return exploreGainFor(c, terrain); } finally { currentReport = null; }
}
// The forecasts on movement read the page's order fields (po-action-<hero>-<phase>, po-target-<hero>-<phase>): here
// they stand in for the orders staged, by hero, then by phase, each { action, target } (P1-11d1); and since P1-11d2 its
// recipient or comrade (po-extra-…, an order's extra: none read as '') and a Recruit's widget (po-target-wrap-…), which
// the projections of what a hero holds read: its ticks and its "Muster to", as the target updateRecruitTarget writes
// holds them (the ticks, then the destination unless it is the hero himself).
let theOrdersStaged = {};
function recruitWidget(target) {
  const tokens = String(target || '').split(',').map((t) => t.trim()).filter(Boolean);
  const ticked = tokens.filter((t) => !t.startsWith('to:'));
  const musterTo = tokens.find((t) => t.startsWith('to:')) || 'to:self';
  return {
    querySelector: (selector) => (selector === '.po-recruit-dest' ? { value: musterTo } : null),
    querySelectorAll: (selector) =>
      selector === 'input[type="checkbox"]:checked' ? ticked.map((value) => ({ value })) : [],
  };
}
const document = {
  getElementById: (id) => {
    const wrap = /^po-target-wrap-(.+)-(\\d+)$/.exec(id);
    if (wrap) {
      const order = (theOrdersStaged[wrap[1]] || [])[Number(wrap[2])];
      return order && order.action === 'Recruit Armies' ? recruitWidget(order.target) : null;
    }
    const field = /^po-(action|target|extra)-(.+)-(\\d+)$/.exec(id);
    const order = field ? (theOrdersStaged[field[2]] || [])[Number(field[3])] : null;
    if (!order) return null;
    return { value: field[1] === 'action' ? order.action : field[1] === 'target' ? order.target : order.extra || '' };
  },
};
function onTheOrders(report, orders, fn) {
  currentReport = report;
  theOrdersStaged = orders;
  try { return fn(); } finally { currentReport = null; theOrdersStaged = {}; }
}
// where the hero \`heroId\` will stand once his orders of the phases before \`upTo\` are carried out (its id, or null);
// since P1-11e10 with the declarations of war the form holds (by realm), if any
function predictedLocationOn(report, orders, heroId, upTo, declarations) {
  diploChoices = declarations || {};
  try {
    return onTheOrders(report, orders, () => { const at = predictedLocation(heroId, upTo); return at ? at.id : null; });
  } finally { diploChoices = {}; }
}
// the share of the province \`provId\` the hero \`c\` maps marching in, in the phases before \`upTo\`
function exploreMoveGainOn(report, orders, c, upTo, provId) {
  return onTheOrders(report, orders, () => exploreMoveGainBefore(c, upTo, provId));
}
// the compass direction a fresh Move of the phase \`ph\` opens on, from his Moves before it
function lastMoveDirOn(report, orders, heroId, ph) {
  return onTheOrders(report, orders, () => lastMoveDirOf(heroId, ph));
}
// what the hero \`heroId\` will carry once his realm's orders of the phases before \`upTo\` are carried out (P1-11d2):
// each item's name, in the order of his pack
function predictedItemsOn(report, orders, heroId, upTo) {
  return onTheOrders(report, orders, () => predictedItems(heroId, upTo).map((it) => it.name));
}
// the companies the hero \`heroId\` will lead, and those the province \`provId\` will hold unled, as each phase \`upTo\`
// begins (P1-11d2): each as the projection writes it
function projectedLedArmiesOn(report, orders, heroId, upTo) {
  return onTheOrders(report, orders, () => projectedLedArmies(heroId, upTo));
}
function projectedGarrisonOn(report, orders, provId, upTo) {
  return onTheOrders(report, orders, () => projectedGarrison(provId, upTo));
}
// the companies the Pick Up field of the hero \`heroId\` offers in the phase \`ph\` (P1-11e17): the province \`provId\`'s
// garrison as the phase begins, with what his comrades leave in it that phase
function thePickUpFieldsGarrisonOn(report, orders, provId, ph, heroId) {
  return onTheOrders(report, orders, () => projectedGarrison(provId, ph, true, heroId));
}
// The order list the form offers the hero (or the card) \`c\` (P1-11d3): each order's name, in the list's order; every
// name the list may hold (ACTIONS); and the mastery orders' table it reads, each order with its skill and its level.
function actionsForOn(report, c) {
  return onTheOrders(report, {}, () => actionsFor(c));
}
function theOrderListsNames() {
  return ACTIONS.slice();
}
function theMasteryOrdersOfTheList() {
  return Object.entries(L79_ORDERS).map(([name, o]) => ({ name, skill: o.skill, level: o.lvl }));
}
// The companies the Move note counts in the column of the hero \`heroId\` marching in the phase \`ph\` (P1-11d8): each
// by its name, those the orders before it raise or bind among them.
function theMoveNotesColumnOn(report, orders, heroId, ph) {
  return onTheOrders(report, orders, () => projectedMoveHost(heroId, ph).armies.map((a) => String(a.unitName)));
}
// The target field of the order \`saved\` ({ action, target, extra }) the hero \`c\` gives in the phase \`ph\`, as the
// form builds it, on the orders staged (P1-11d3: the creed orders' fields): its markup.
function theTargetFieldOn(report, orders, c, ph, saved) {
  return onTheOrders(report, orders, () => String(buildTargetField(c, ph, saved)));
}
// What the treasury ledger says the orders staged will spend, and add to the wages (P1-11d4): its two sums.
function theLedgerOn(report, orders) {
  return onTheOrders(report, orders, () => {
    const L = computeOrderLedgerP();
    return { spend: L.spend, 'new wages': L.newWages };
  });
}
// The note under the Practice Skill order of the hero \`c\` in the phase \`ph\`, its skill as staged (P1-11d4): its markup.
function thePracticeNoteOn(report, orders, c, ph) {
  return onTheOrders(report, orders, () => String(orderChanceNote(c, 'Practice Skill', ph)));
}
// The skill a comrade practises beside the hero \`c\` in the phase \`ph\`, as his field reads it (P1-11d4), or ''.
function thePracticeCompanionOn(report, orders, c, ph) {
  return onTheOrders(report, orders, () => practiceCompanionSkill(c, ph));
}
// The Move field's directions for the hero \`c\` in the phase \`ph\` (buildTargetField's statements, for a fresh Move):
// each option as the field writes it, its value (prov:<id>) and its words, and whether the icy wastes bar a way north
// or south (the note under the field).
function theMoveFieldsDirectionsOn(theReport, orders, c, ph) {
  return onTheOrders(theReport, orders, () => {
    const action = 'Move', target = '';
    const report = currentReport || {};
    ${statementsBetween('ui/player/order-targets.ts', 'buildTargetField', 'worldMeta_', 'dirOpts', opts)}
    return { options: dirOpts.map(String), blockedNorth, blockedSouth };
  });
}`;
/** The functions the checks call: the portal's copies, and those made of a copy's statements. */
const COPY_FUNCTIONS = [
  'effMagicLvl',
  'druidNeedP',
  'exploreGainOn',
  'exploreMoveGainOn',
  'predictedLocationOn',
  'lastMoveDirOn',
  'theMoveFieldsDirectionsOn',
  'predictedItemsOn',
  'projectedLedArmiesOn',
  'projectedGarrisonOn',
  'thePickUpFieldsGarrisonOn',
  'actionsForOn',
  'theOrderListsNames',
  'theMasteryOrdersOfTheList',
  'theMoveNotesColumnOn',
  'theTargetFieldOn',
  'theLedgerOn',
  'thePracticeNoteOn',
  'thePracticeCompanionOn',
  'armyCardDruidLines',
  'armyCardSeaNote',
  'armyCardUnitStrength',
  'turnReportFlyingCarry',
] as const;
export type CopyName = (typeof COPY_FUNCTIONS)[number];
export type Copies = Record<CopyName, (...args: unknown[]) => unknown>;

/** The player portal's copies, read from `src` (default: this checkout's src/), run with the data file, the mastery
 *  orders' rows (L79_ORDERS reads them) and kc-safe (kcHtml: the army card's notes) beside them, and the names
 *  src/shared/ hands the portal (effMagicLvl calls itemSlot and itemUsableBy). The turn report's flying carry runs
 *  beside them too: it reads the data file and getFlyCapability, which the views import from the folder (the portal no
 *  longer does, since P1-11b4). */
export function playerPortalCopies(opts: SourceOptions = {}): Copies {
  const code = [
    'let currentReport = null;',
    // the declarations of war and treaties the form holds for the turn (the page's diploChoices: none, unless a case
    // stages them)
    'let diploChoices = {};',
    scriptOf('content/kingdoms-call-data.ts', opts),
    scriptOf('content/mastery-orders-their-keys-names-skills-and-levels.ts', opts),
    scriptOf('ui/shared/kc-safe.ts', opts),
    ...Object.entries(COPIES).map(([file, names]) => sourceOf(file, names, opts)),
    statementCopies(opts),
  ].join('\n');
  const made: unknown = vm.runInNewContext(`(() => {\n${code}\nreturn { ${COPY_FUNCTIONS.join(', ')} };\n})()`, {
    ...theRulesTheSharedDoorHandsThePortal,
    getFlyCapability,
  });
  if (!isObj(made)) throw new Error('the copies did not load');
  for (const name of COPY_FUNCTIONS)
    if (typeof made[name] !== 'function') throw new Error(`the player portal has no function ${name}`);
  return made as Copies;
}

/** The order form's Cast Spell tables, as it declares them (plan P1-11c1; since P1-11c3 each is the call of the engine
 *  folder's function that makes it, and these are the answers): every school's spells, each spell's school and the
 *  mastery spells' levels (order-chances.ts, at top level), the action spells and those offered a hero of unseen levels
 *  (buildTargetField), the combat spells by school an Encounter plan offers (the Encounter's plan), and the spells
 *  aimed at a province or at a hero (spellSecondaryHtml). A Set as its list, in its order. */
export interface TheOrderFormsSpellTables {
  readonly SPELLS_BY_SCHOOL: Record<string, string[]>;
  readonly SPELL_TO_SCHOOL: Record<string, string>;
  readonly SPELL_REQ_LEVEL: Record<string, number>;
  readonly PHASE_SPELLS: string[];
  readonly _hsPhase: string[];
  readonly ENCOUNTER_VALID: Record<string, string[]>;
  readonly NEEDS_PROV: string[];
  readonly NEEDS_CHAR: string[];
}
/** A spell the form offers a caster in a phase, as its Cast Spell field builds it: whether its school's casting limit
 *  is reached, and its label. */
export interface ASpellTheFormOffers {
  readonly spell: string;
  readonly atLimit: boolean;
  readonly label: string;
}
export interface TheOrderFormsSpells {
  readonly tables: TheOrderFormsSpellTables;
  /** The spells the Cast Spell field offers the hero `c` (as his realm's `report` holds him) in phase `ph`, the form's
   *  fields (`po-action-<id>-<phase>`, `po-target-<id>-<phase>`) holding `fields`: buildTargetField's statements from
   *  the action spells through the rows it builds. */
  readonly castSpellRows: (report: Obj, c: Obj, ph: number, fields: Record<string, string>) => ASpellTheFormOffers[];
  /** The target field spellSecondaryHtml builds for the spell, the caster `c` in phase 0 of `report`'s orders, with no
   *  target chosen: its markup. */
  readonly targetField: (report: Obj, c: Obj, spell: string) => string;
}

/** The order form's Cast Spell tables, and its two functions that read them, read from `src` (default: this
 *  checkout's src/) by their statements and run beside the data file and kc-safe, with the names src/shared/ hands the
 *  portal: order-chances.ts whole (its tables, effMagicLvl and projectedMagicLevels), the spells' hints and the rows
 *  they read (P1-11d13: until then order-chances.ts held the hints), the helpers the target field
 *  calls as the portal declares them, and a stand-in for the page's fields (document.getElementById, which the form's
 *  count and getOrderTarget read). Apart from playerPortalCopies: order-chances.ts runs whole here. */
export function theOrderFormsSpells(opts: SourceOptions = {}): TheOrderFormsSpells {
  const one = (file: string, name: string) => {
    const found = initializersOf(file, name, opts);
    if (found.length !== 1) throw new Error(`${file}: ${String(found.length)} declarations of ${name}`);
    return found[0] ?? '';
  };
  const code = [
    'let currentReport = null;',
    // the page's fields, as the form reads them by id: here, the values handed in
    'let theFields = {};',
    'const document = { getElementById: (id) => (id in theFields ? { value: theFields[id] } : null) };',
    scriptOf('content/kingdoms-call-data.ts', opts),
    scriptOf('ui/shared/kc-safe.ts', opts),
    scriptOf('ui/player/order-chances.ts', opts),
    // the spells' hints, which the target field shows, and the content's rows some of them read (P1-11d13)
    scriptOf('content/spell-effects-their-names-numbers-and-words.ts', opts),
    scriptOf('ui/player/the-hints-the-order-form-shows-below-each-spell.ts', opts),
    sourceOf(
      'ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts',
      ['getOrderTarget', ...THE_MARCH_FORECASTS_DECLARATIONS],
      opts,
    ),
    sourceOf('ui/player/order-targets.ts', ['provDirectionLabel'], opts),
    sourceOf(
      'ui/player/items-and-heroes.ts',
      ['isPreOrderIdP', 'orderTargetCharsP', 'preOrderTagP', 'realmOfP', 'realmNameP', 'realmOptStyleP'],
      opts,
    ),
    sourceOf('ui/player/map-symbols.ts', ['leadsArmiesP'], opts),
    sourceOf('ui/player/move-analysis.ts', ['SKILL_LABELS'], opts),
    sourceOf('ui/player/titles.ts', ['spellSecondaryHtml'], opts),
    `function castSpellRows(report, c, ph, fields) {
      theFields = fields;
      try {
        ${statementsBetween('ui/player/order-targets.ts', 'buildTargetField', 'PHASE_SPELLS', '_spellRows', opts)}
        return _spellRows;
      } finally { theFields = {}; }
    }`,
    `function targetField(report, c, spell) {
      currentReport = report;
      try { return String(spellSecondaryHtml(report, c, 0, spell, '', spell)); } finally { currentReport = null; }
    }`,
    `const tables = JSON.parse(JSON.stringify({
      SPELLS_BY_SCHOOL, SPELL_TO_SCHOOL, SPELL_REQ_LEVEL,
      PHASE_SPELLS: [...${one('ui/player/order-targets.ts', 'PHASE_SPELLS')}],
      _hsPhase: [...${one('ui/player/order-targets.ts', '_hsPhase')}],
      ENCOUNTER_VALID: ${one('ui/player/orders-form.ts', 'ENCOUNTER_VALID')},
      NEEDS_PROV: [...${one('ui/player/titles.ts', 'NEEDS_PROV')}],
      NEEDS_CHAR: [...${one('ui/player/titles.ts', 'NEEDS_CHAR')}],
    }));`,
  ].join('\n');
  const made: unknown = vm.runInNewContext(`(() => {\n${code}\nreturn { tables, castSpellRows, targetField };\n})()`, {
    ...theRulesTheSharedDoorHandsThePortal,
  });
  if (!isObj(made) || typeof made['castSpellRows'] !== 'function' || typeof made['targetField'] !== 'function')
    throw new Error("the order form's spells did not load");
  // (the vm's values, made by the form's own statements: its tables as JSON, its rows and its markup)
  return made as unknown as TheOrderFormsSpells;
}

// ── The values ────

/** A value the report hands the portal, and the value in the state the report made it from (null: none here). */
export interface Projected {
  readonly report: Obj;
  readonly state: Obj | null;
}
export interface Samples {
  /** Every unit of the realm's heroes in the reports, with the state's unit. */
  readonly armies: Projected[];
  /** Every item of the realm's heroes in the reports, with the state's item and both its holders. */
  readonly items: (Projected & { readonly holder: Projected | null })[];
  /** Every one of the realm's heroes in the reports, with the state's hero. */
  readonly heroes: Projected[];
  /** How many reports the values come from: the game's, and the staged world's. */
  readonly reports: number;
}
/** The values of the copies that read the realm, the report's shape or the world (P1-11b1). */
export interface WorldSamples {
  /** A hero of the realm and a unit he might lead: each of his own units in the game's reports; and in the worlds
   *  staged for the Druid rule, every staged hero with every staged unit. */
  readonly druid: DruidCase[];
  /** A hero of the realm and a province he might explore: his own in the game's reports; one of every land terrain in
   *  the world staged for exploring. */
  readonly explore: ExploreCase[];
}
/** The world a case comes from: the report the portal is handed, and the state it was made from. */
export interface World {
  readonly state: Obj;
  readonly report: Obj;
}
export interface DruidCase {
  readonly world: World;
  readonly hero: Projected & { readonly state: Obj };
  readonly unit: Projected & { readonly state: Obj };
}
export interface ExploreCase {
  readonly world: World;
  readonly hero: Projected & { readonly state: Obj };
  /** The province the engine explores (its terrain is the forecast's). */
  readonly province: Obj;
}

/** Each turn of the matrix's game scripted-05, played with the engine's modules imported directly: the state after
 *  the turn (as saved) and the scripted realm's report, built from it. */
export function scripted05(): { state: Obj; report: Obj }[] {
  kcRng.seed(GAME.seed);
  const g = generateNewGame(
    copyOf(SETUPS) as Parameters<typeof generateNewGame>[0],
    copyOf(MAP_SIZES[GAME.realms]) as Parameters<typeof generateNewGame>[1],
    0,
    { seaPct: GAME.seaPct },
  ) as Obj;
  g['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
  g['botDifficulty'] = 'hard';
  g['botDiplomacy'] = GAME.diplomacy;
  let state = JSON.stringify(g);
  const turns: { state: Obj; report: Obj }[] = [];
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    if ((JSON.parse(state) as Obj)['gameOver']) break;
    const result = resolveTurn(
      state,
      JSON.parse(slotRowsJson(state, turn)),
      turn,
      Math.floor(kcRng() * 2 ** 32) || 1,
    ) as {
      state: string;
      spyStealthAndInvisibilityStampedForTheReports: () => void;
      whatTheReportsRead: () => Parameters<typeof buildReports>[0];
    };
    result.spyStealthAndInvisibilityStampedForTheReports();
    const { reports } = buildReports(result.whatTheReportsRead());
    const ours = reports.find((r) => r.gp.player_index === SCRIPTED_REALM);
    if (!ours) throw new Error(`turn ${String(turn)}: no report for the scripted realm`);
    state = result.state;
    turns.push({ state: JSON.parse(state) as Obj, report: ours.report });
  }
  return turns;
}

/** The catalogue as the engine holds it once loaded (it re-tiers the data file's lists in place, and adds the
 *  alternates): every lair item, every legendary relic, and Mithril Armour. */
const catalogue = (): Obj[] => [...objects(ALL_MAGIC_ITEMS_P), ...objects(LEGENDARY_ITEMS_P), copyOf(MITHRIL_ARMOUR)];

/** One type of each kind of unit a column can hold, for the staged columns. */
function oneOfEachKind(): string[] {
  const classes: Record<string, string[]> = KC_UNIT_CLASS;
  const kinds = ['flying', 'aerial', 'carrier', 'sea', 'cavalry', 'lightFoot', 'creature', 'monster'];
  const chosen: string[] = [];
  for (const kind of kinds) {
    const t = (classes[kind] ?? []).find((x) => !chosen.includes(x));
    if (t) chosen.push(t);
  }
  const berths = Object.keys(KC_CARRIER_BERTHS).find((t) => !chosen.includes(t));
  if (berths) chosen.push(berths); // a carrier with more than one berth
  const classed = new Set(kinds.flatMap((k) => classes[k] ?? []));
  const foot = Object.keys(KC_UNIT_TYPE).find((t) => !classed.has(t));
  if (foot) chosen.push(foot); // heavy foot: in none of those classes
  return chosen;
}

/** Every column of 1 to 3 units of those kinds (each kind as often as the size allows). No unit in it is a phantom: a
 *  spectral double joins a column only for a battle (engine/world/map-helpers.ts) and is gone before the turn is saved,
 *  so no report is made from one. */
function stagedColumns(): Obj[][] {
  const kinds = oneOfEachKind();
  const columns: Obj[][] = [];
  const grow = (from: number, column: string[]) => {
    if (column.length)
      columns.push(column.map((type, i) => ({ type, quality: 'Average', unitName: `${type} ${String(i)}` })));
    if (column.length === 3) return;
    for (let k = from; k < kinds.length; k++) grow(k, [...column, kinds[k] ?? '']);
  };
  grow(0, []);
  return columns;
}

/** A world in the engine's shape, staged, and realm 0's report on it: the values the game doesn't reach. */
export function stagedWorld(): { state: Obj; report: Obj } {
  kcRng.seed(7);
  const setups = [0, 1, 2].map((i) => ({
    id: i,
    gamePlayerId: 'gp' + String(i),
    isBot: i > 0,
    name: 'Realm' + String(i),
    kingName: 'King' + String(i),
    kingdomName: 'Realm' + String(i),
    race: ['Human', 'Elven', 'Orcish'][i],
    alignment: ['Good', 'Druidic', 'Evil'][i],
    temper: 'Brave',
    skills: { melee: 1 },
  }));
  const g = generateNewGame(
    setups as Parameters<typeof generateNewGame>[0],
    copyOf(MAP_SIZES[3]) as Parameters<typeof generateNewGame>[1],
    0,
    { seaPct: 20 },
  ) as Obj;
  const characters = objects(g['characters']);
  const king = characters.find((c) => c['player'] === 0 && c['isKing']);
  if (!king) throw new Error('the staged world has no king for realm 0');
  // Three provinces of the world: the king's, and two others. Each group of staged heroes stands in its own, so the
  // Crown of Command's aura (it lifts every skill of the bearer's realm's heroes in his province) reaches only the
  // heroes staged for it, and the report doesn't look through the catalogue's items for every hero it shows.
  const land = objects(isObj(g['world']) ? g['world']['provinces'] : [])
    .filter((p) => p['terrain'] !== 'sea' && p['id'] !== king['location'])
    .map((p) => p['id']);
  const [elsewhere, third] = land;
  if (elsewhere === undefined || third === undefined) throw new Error('the staged world has too few land provinces');
  let id = 10_000;
  const hero = (fields: Obj): Obj => {
    const h = {
      ...copyOf(king),
      isKing: false,
      items: [],
      armies: [],
      skills: { melee: 1 },
      ...fields,
      id: id++,
      name: `Staged ${String(id)}`,
    };
    characters.push(h);
    return h;
  };
  let itemId = 50_000;
  const item = (it: Obj): Obj => ({ ...copyOf(it), id: itemId++ });
  // The king holds the whole catalogue, and every unit type at every quality, plain and with each flag the engine and
  // the report read (no phantom: see stagedColumns).
  king['items'] = catalogue().map(item);
  const flags: Obj[] = [{}, { _isSkeletal: true }, { _temporary: true }, { _wildHuntUntilTurn: 3 }];
  king['armies'] = Object.keys(KC_UNIT_TYPE).flatMap((type) =>
    KC_QUALITY_TIERS.flatMap((quality) => flags.map((f) => ({ type, quality, unitName: type, ...f }))),
  );
  // A hero of every race and alignment holds every item bound to a race or an alignment, and each race-bound item as
  // an older save holds it, tagged with an old name of the race ('Elf', 'Dwarves', …: the data file's
  // KC_ITEM_RACE_ALIAS, which both read).
  const aliases: Record<string, string> = KC_ITEM_RACE_ALIAS;
  const bound = catalogue().filter((it) => it['race'] || it['alignment']);
  const oldNames = Object.entries(aliases).flatMap(([old, race]) =>
    bound.filter((it) => it['race'] === race).map((it) => ({ ...it, race: old })),
  );
  bound.push(...oldNames);
  for (const race of ['Human', 'Elven', 'Dwarven', 'Orcish'])
    for (const alignment of KC_ALIGNMENTS) hero({ race, alignment, items: bound.map(item) });
  // A hero leads each staged column, without and with the naval mastery that doubles a hull (Naval 8), elsewhere; and
  // each column with a fleet in it under a hero one level short of it (Naval 7: P1-23t), where the hulls count.
  const carriers: readonly string[] = KC_UNIT_CLASS.carrier;
  for (const armies of stagedColumns()) {
    const navals = armies.some((a) => carriers.includes(String(a['type']))) ? [0, 7, 8] : [0, 8];
    for (const naval of navals) hero({ location: elsewhere, armies: copyOf(armies), skills: { melee: 1, naval } });
  }
  // In a third province, a hero wearing the Crown of Command beside a hero of every magic school at level 2: the
  // aura the report's effective levels count, and effMagicLvl with them (R-120).
  const crown = catalogue().find((it) => isObj(it['effect']) && it['effect']['stat'] === 'aura');
  if (!crown) throw new Error('the catalogue has no item with an aura');
  hero({ location: third, items: [item(crown)] });
  hero({ location: third, skills: Object.fromEntries(SCHOOLS.map((school) => [school, 2])) });
  g['characters'] = characters;
  const state = copyOf(g);
  // (a staged world, made with the fields the report reads: a saved state's type by assertion, as the view's unit cases)
  const report: Obj = buildTurnReport(playerView(g as unknown as GameState, 0));
  return { state, report };
}

/** A new world of three realms (realm 0's king a Human of a Good realm), with a way to stage heroes of realm 0 in it
 *  as copies of its king, and its land provinces other than the king's. */
function aWorldToStageIn(): { g: Obj; king: Obj; land: Obj[]; hero: (fields: Obj) => Obj } {
  kcRng.seed(7);
  const setups = [0, 1, 2].map((i) => ({
    id: i,
    gamePlayerId: 'gp' + String(i),
    isBot: i > 0,
    name: 'Realm' + String(i),
    kingName: 'King' + String(i),
    kingdomName: 'Realm' + String(i),
    race: ['Human', 'Elven', 'Orcish'][i],
    alignment: ['Good', 'Druidic', 'Evil'][i],
    temper: 'Brave',
    skills: { melee: 1 },
  }));
  const g = generateNewGame(
    setups as Parameters<typeof generateNewGame>[0],
    copyOf(MAP_SIZES[3]) as Parameters<typeof generateNewGame>[1],
    0,
    { seaPct: 20 },
  ) as Obj;
  const characters = objects(g['characters']);
  const king = characters.find((c) => c['player'] === 0 && c['isKing']);
  if (!king) throw new Error('the staged world has no king for realm 0');
  const land = objects(isObj(g['world']) ? g['world']['provinces'] : []).filter(
    (p) => p['terrain'] !== 'sea' && p['id'] !== king['location'],
  );
  let id = 20_000;
  const hero = (fields: Obj): Obj => {
    const h: Obj = { ...copyOf(king), isKing: false, items: [], armies: [], skills: {}, ...fields, id };
    h['name'] = `Staged ${String(id++)}`;
    characters.push(h);
    return h;
  };
  g['characters'] = characters;
  return { g, king, land, hero };
}
/** The world `g` as saved, and realm 0's report on it. */
function savedAndReported(g: Obj): World {
  const state = copyOf(g);
  // (a staged world, made with the fields the report reads: a saved state's type by assertion, as stagedWorld's)
  const report: Obj = buildTurnReport(playerView(copyOf(g) as unknown as GameState, 0));
  return { state, report };
}

/** One unit type for each Druid level a unit can need (0: none) and each class the Druid rule reads: neither
 *  creature nor monster, creature, monster, and either of them a winged beast Dragon Taming tames. */
export function oneUnitTypePerDruidLevelAndClass(): string[] {
  const classes: Record<string, readonly string[]> = KC_UNIT_CLASS;
  const has = (cls: string, t: string) => (classes[cls] ?? []).includes(t);
  const classOf = (t: string) =>
    `${has('creature', t) ? 'creature' : has('monster', t) ? 'monster' : 'neither'}${has('tamedFlyer', t) ? ' tamed' : ''}`;
  const levels: Record<string, readonly string[]> = KC_DRUID_LEVELS;
  const inTheTable = new Set(Object.values(levels).flat());
  const byLevel: [string, readonly string[]][] = [
    ['0', Object.keys(KC_UNIT_TYPE).filter((t) => !inTheTable.has(t))],
    ...Object.entries(levels),
  ];
  const chosen = new Map<string, string>();
  for (const [level, types] of byLevel)
    for (const t of types) if (!chosen.has(`${level} ${classOf(t)}`)) chosen.set(`${level} ${classOf(t)}`, t);
  return [...chosen.values()];
}

/** The worlds staged for the Druid rule: realm 0 Good, Druidic or Evil, without and with Dragon Taming (sd40). In
 *  each, realm 0's king leads one unit of each type oneUnitTypePerDruidLevelAndClass gives, of his own race (Human)
 *  and of none, alive and skeletal; and a hero of every race, alignment and Druid level 0 to 5 stands in a province
 *  beside one wearing the Crown of Command (its aura lifts every skill of his realm's heroes there: the report's
 *  effective Druid counts it) and in another, away from it. */
export function druidWorlds(): World[] {
  const { g, king, land, hero } = aWorldToStageIn();
  const [besideTheCrown, away] = land;
  if (!besideTheCrown || !away) throw new Error('the staged world has too few land provinces');
  king['armies'] = oneUnitTypePerDruidLevelAndClass().flatMap((type) =>
    [{ race: 'Human' }, {}].flatMap((race) =>
      [{}, { _isSkeletal: true }].map((flag) => ({ type, quality: 'Average', unitName: type, ...race, ...flag })),
    ),
  );
  const crown = catalogue().find((it) => isObj(it['effect']) && it['effect']['stat'] === 'aura');
  if (!crown) throw new Error('the catalogue has no item with an aura');
  // (worn, as a saved game holds it once the turn has put it on: so reading his items changes nothing)
  hero({ location: besideTheCrown['id'], items: [{ ...copyOf(crown), id: 60_000, equipped: true }], skills: {} });
  for (const race of KC_HUMANOID_RACES)
    for (const alignment of KC_ALIGNMENTS)
      for (let druid = 0; druid <= 5; druid++)
        for (const where of [besideTheCrown, away]) hero({ race, alignment, location: where['id'], skills: { druid } });
  const sd40 = objects(SAGE_DISCOVERIES_P).find((d) => d['id'] === 'sd40');
  if (!sd40) throw new Error('the data file has no Dragon Taming (sd40)');
  const realm = objects(g['players'])[0];
  if (!realm) throw new Error('the staged world has no realm 0');
  return ['Good', 'Druidic', 'Evil'].flatMap((alignment) =>
    [false, true].map((tamed) => {
      realm['alignment'] = alignment;
      realm['discoveries'] = tamed ? [copyOf(sd40)] : [];
      return savedAndReported(g);
    }),
  );
}

/** The world staged for exploring: titles public (turn 10), realm 0 holding the discoveries named (none, or since
 *  P1-11d14 one that adds to exploring on every ground or on some: the forecast reads their factor from the report), and
 *  a hero of each Explorer level 0 to 5, the Loremaster (the best at Sage; Explorer 2) and the Trailblazer (the best at
 *  Explorer: 9), each standing in a province of every land terrain in turn (the forecast reads the terrain; the
 *  engine's order explores the province it is handed). */
export function exploreWorld(discoveries: readonly string[] = []): { world: World; provinces: Obj[] } {
  const { g, land, hero } = aWorldToStageIn();
  g['turn'] = 10;
  const realm = objects(g['players'])[0];
  const held = objects(SAGE_DISCOVERIES_P).filter((d) => discoveries.includes(String(d['id'])));
  if (held.length !== discoveries.length) throw new Error(`the data file lacks one of ${discoveries.join(', ')}`);
  if (realm) realm['discoveries'] = held.map(copyOf);
  for (let explorer = 0; explorer <= 5; explorer++) hero({ skills: { explorer } });
  hero({ skills: { explorer: 2, sage: 9 } });
  hero({ skills: { explorer: 9 } });
  const provinces = [...new Map(land.map((p) => [p['terrain'], p])).values()];
  return { world: savedAndReported(g), provinces };
}

/** `fn`, with the engine's echo of the GM's log to console.log (engine/turn/context.ts) quiet. */
function quietly<T>(fn: () => T): T {
  const was = console.log;
  console.log = () => undefined;
  try {
    return fn();
  } finally {
    console.log = was;
  }
}

let theGame: World[] | null = null;
/** scripted-05's turns (played once in a process: the game takes about a second). A test may play it in a hook of its
 *  own, before samples() and worldSamples() read it, so that each hook has Vitest's limit for itself. */
export const theGamePlayed = (): World[] => (theGame ??= quietly(scripted05));

let made: Samples | null = null;
/** The values the checks are made on (made once in a process). */
export function samples(): Samples {
  if (made) return made;
  const pairs = [...theGamePlayed(), quietly(stagedWorld)];
  const armies: Projected[] = [];
  const items: (Projected & { holder: Projected | null })[] = [];
  const heroes: Projected[] = [];
  for (const { state, report } of pairs) {
    const stateHeroes = new Map(objects(state['characters']).map((c) => [c['id'], c]));
    const own = objects(report['characters']);
    for (const c of own) {
      const sc = stateHeroes.get(c['id']) ?? null;
      const holder = { report: c, state: sc };
      heroes.push(holder);
      objects(c['armies']).forEach((a, i) => {
        armies.push({ report: a, state: sc ? (objects(sc['armies'])[i] ?? null) : null });
      });
      objects(c['items']).forEach((it, i) => {
        items.push({ report: it, state: sc ? (objects(sc['items'])[i] ?? null) : null, holder });
      });
    }
  }
  made = { armies, items, heroes, reports: pairs.length };
  deepFreeze(made);
  return made;
}

let madeOfTheWorld: WorldSamples | null = null;
/** The values of the copies that read the realm, the report's shape or the world (made once in a process, apart from
 *  samples(): a test builds each in its own hook, each well inside Vitest's limit for one). */
export function worldSamples(): WorldSamples {
  if (madeOfTheWorld) return madeOfTheWorld;
  const druid: DruidCase[] = [];
  const explore: ExploreCase[] = [];
  const provinceOf = (state: Obj, id: unknown) =>
    objects(isObj(state['world']) ? state['world']['provinces'] : []).find((p) => p['id'] === id) ?? null;
  // the game's: each hero of the realm with each unit he leads, and the province he stands in
  for (const world of theGamePlayed())
    for (const hero of ownHeroes(world)) {
      objects(hero.report['armies']).forEach((a, i) => {
        const unit = objects(hero.state['armies'])[i];
        if (unit) druid.push({ world, hero, unit: { report: a, state: unit } });
      });
      const province = provinceOf(world.state, hero.state['location']);
      if (province) explore.push({ world, hero, province });
    }
  // the staged worlds': every staged hero (not the king) with every unit the king leads; every staged explorer in a
  // province of every land terrain
  for (const world of quietly(druidWorlds)) {
    const heroes = ownHeroes(world);
    const king = heroes.find((h) => h.report['isKing']);
    if (!king) throw new Error('a Druid world has no king in its report');
    const units = objects(king.report['armies']).map((a, i) => ({
      report: a,
      state: objects(king.state['armies'])[i],
    }));
    for (const hero of heroes.filter((h) => !h.report['isKing']))
      for (const unit of units)
        if (unit.state) druid.push({ world, hero, unit: { report: unit.report, state: unit.state } });
  }
  // (and since P1-11d14 with The Compass, which adds to exploring on every ground, and Star Charts, on some)
  for (const discoveries of [[], ['sd24'], ['sd68']]) {
    const { world, provinces } = quietly(() => exploreWorld(discoveries));
    for (const hero of ownHeroes(world).filter((h) => !h.report['isKing']))
      for (const province of provinces) explore.push({ world, hero, province });
  }
  madeOfTheWorld = { druid, explore };
  deepFreeze(madeOfTheWorld);
  return madeOfTheWorld;
}
/** The realm's own heroes in a world's report, each with the state's hero (those the state holds). */
function ownHeroes(world: World): (Projected & { state: Obj })[] {
  const inTheState = new Map(objects(world.state['characters']).map((c) => [c['id'], c]));
  return objects(world.report['characters']).flatMap((c) => {
    const state = inTheState.get(c['id']);
    return state ? [{ report: c, state }] : [];
  });
}

// ── Comparing answers ────

/** The same answer: undefined, NaN and -0 told apart, a Set as its members. */
export function sameAnswer(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}
function canonical(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) =>
    v === undefined
      ? '(undefined)'
      : typeof v === 'number' && !Number.isFinite(v)
        ? `(${String(v)})`
        : Object.is(v, -0)
          ? '(-0)'
          : v instanceof Set
            ? [...(v as Set<unknown>)]
            : v,
  );
}
/** `x` and everything it holds, frozen: a function handed it can read it, and a write to it throws (the engine's
 *  modules are strict). Frozen once: what is frozen already is left as it is. */
export function deepFreeze<T>(x: T): T {
  if (typeof x !== 'object' || x === null || Object.isFrozen(x)) return x;
  Object.freeze(x);
  for (const v of Object.values(x)) deepFreeze(v);
  return x;
}
/** What a strict function's write to a frozen object throws (V8's words: assign, add, delete, define). */
const WRITE_TO_FROZEN = /read[- ]only|not extensible|Cannot (add|assign|delete|define|redefine)/i;
/** The engine's function on `args`, frozen, and whether it tried to change them (a write to one throws). */
function engineOn(fn: (...args: never[]) => unknown, args: unknown[]): { answer: unknown; changed: boolean } {
  for (const a of args) deepFreeze(a);
  try {
    return { answer: (fn as (...a: unknown[]) => unknown)(...args), changed: false };
  } catch (e) {
    if (e instanceof TypeError && WRITE_TO_FROZEN.test(e.message))
      return { answer: '(wrote to its input)', changed: true };
    throw e;
  }
}
const withState = <T extends { state: Obj | null }>(list: T[]) =>
  list.filter((x): x is T & { state: Obj } => x.state !== null);

// ── The projections ────

/** One value compared: the engine's answer on the report's value and on the state's value it was made from, and
 *  whether the engine's function tried to change either (the values are frozen, so a write throws: the answer is then
 *  "(wrote to its input)"). */
export interface ProjectionComparison {
  readonly on: unknown;
  readonly fromTheReport: unknown;
  readonly fromTheState: unknown;
  readonly engineChangedItsInput: boolean;
}
const project = (
  on: unknown,
  fromTheReport: { answer: unknown; changed: boolean },
  fromTheState: { answer: unknown; changed: boolean },
): ProjectionComparison => ({
  on,
  fromTheReport: fromTheReport.answer,
  fromTheState: fromTheState.answer,
  engineChangedItsInput: fromTheReport.changed || fromTheState.changed,
});

/** A rule the portal now calls the engine's function for, whose value the report makes from the state. */
export interface Projection {
  /** The engine's function, and the portal's copy P1-11a4 retired for it. */
  readonly engine: string;
  readonly retiredCopy: string;
  /** What it is handed. */
  readonly on: string;
  /** The engine's function on the report's value and on the state's. */
  readonly cases: (s: Samples) => ProjectionComparison[];
}

/** The text heroFameTextP builds when the hero carries no top skill of his own, from the engine's top skill and fame
 *  label. */
const engineFameText = (hero: unknown): { answer: unknown; changed: boolean } => {
  const top = engineOn(topSkillOf, [hero]);
  const ts = top.answer as { skill: string; level: number } | null;
  const labels = SKILL_LABELS as unknown as Record<string, string>;
  return {
    answer: ts ? `${skillFameLabelM(ts.level)} ${labels[ts.skill] ?? ts.skill}` : 'no notable skills',
    changed: top.changed,
  };
};

/** The 9 rules of the 16 P1-11a4 swapped whose value the report makes from the state, and the beast command P1-11b3
 *  swapped: their truth cases, now that the portal calls the engine's function, as projection cases (Decision 7). */
export const PROJECTIONS: Projection[] = [
  {
    engine: 'unitTypeOf',
    retiredCopy: 'unitTypeOfP',
    on: "every unit of the realm's heroes",
    cases: (s) =>
      withState(s.armies).map((a) =>
        project(a.report, engineOn(unitTypeOf, [a.report['type']]), engineOn(unitTypeOf, [a.state['type']])),
      ),
  },
  {
    engine: 'unitBaseStrength',
    retiredCopy: 'unitBaseStrengthP',
    on: "every unit of the realm's heroes",
    cases: (s) =>
      withState(s.armies).map((a) =>
        project(a.report, engineOn(unitBaseStrength, [a.report]), engineOn(unitBaseStrength, [a.state])),
      ),
  },
  {
    engine: 'isLegendaryItem',
    retiredCopy: 'isLegendaryItemP',
    on: "every item of the realm's heroes",
    cases: (s) =>
      withState(s.items).map((i) =>
        project(i.report, engineOn(isLegendaryItem, [i.report]), engineOn(isLegendaryItem, [i.state])),
      ),
  },
  {
    engine: 'itemSlot',
    retiredCopy: 'itemSlotP',
    on: "every item of the realm's heroes",
    cases: (s) =>
      withState(s.items).map((i) => project(i.report, engineOn(itemSlot, [i.report]), engineOn(itemSlot, [i.state]))),
  },
  {
    engine: 'itemRaceOf',
    retiredCopy: 'itemRaceOfP',
    on: "every item of the realm's heroes",
    cases: (s) =>
      withState(s.items).map((i) =>
        project(i.report, engineOn(itemRaceOf, [i.report]), engineOn(itemRaceOf, [i.state])),
      ),
  },
  {
    engine: 'itemUsableBy',
    retiredCopy: 'itemUsableByP',
    on: "every item of the realm's heroes, and the hero who holds it",
    cases: (s) =>
      withState(s.items).flatMap((i) =>
        i.holder?.state
          ? [
              project(
                [i.report, i.holder.report],
                engineOn(itemUsableBy, [i.report, i.holder.report]),
                engineOn(itemUsableBy, [i.state, i.holder.state]),
              ),
            ]
          : [],
      ),
  },
  {
    engine: 'topSkillOf (with skillFameLabelM)',
    retiredCopy: "heroFameTextP's top skill",
    on: "every one of the realm's heroes",
    cases: (s) => withState(s.heroes).map((h) => project(h.report, engineFameText(h.report), engineFameText(h.state))),
  },
  {
    engine: 'isAirCarriable',
    retiredCopy: 'poAirCarriable',
    on: "every unit of the realm's heroes",
    cases: (s) =>
      withState(s.armies).map((a) =>
        project(a.report, engineOn(isAirCarriable, [a.report]), engineOn(isAirCarriable, [a.state])),
      ),
  },
  {
    engine: 'getFlyCapability',
    retiredCopy: 'poFlyCapability',
    on: "every column the realm's heroes lead",
    cases: (s) =>
      withState(s.heroes).map((h) =>
        project(
          h.report['armies'],
          engineOn(getFlyCapability, [h.report['armies']]),
          engineOn(getFlyCapability, [h.state['armies']]),
        ),
      ),
  },
  {
    // The report's unit carries the names its realm sees it by (skeletal, temporary, wildHunt); the engine's,
    // _isSkeletal and the rest: beastCommandCount hands its unit through unitAsItsRealmSeesIt (P1-11b2).
    engine: 'countsAgainstBeastCommand',
    retiredCopy: 'beastCommandCountP',
    on: "every unit of the realm's heroes (the report's flags; on the state's unit, as beastCommandCount asks it)",
    cases: (s) =>
      withState(s.armies).map((a) =>
        project(a.report, engineOn(countsAgainstBeastCommand, [a.report]), engineOn(beastCommandCount, [a.state])),
      ),
  },
  {
    // The Move notice (poSeaAnalysis) counts a column through seaLiftOfAColumn (P1-11b4), whose figures it explains
    // itself by: the lift on the report's column under the report's hero against it on the state's, the leader's naval
    // mastery worked out as getSeaCapability works it out, and on the state's side getSeaCapability's own answer.
    engine: 'seaLiftOfAColumn (getSeaCapability its wrapper)',
    retiredCopy: "poSeaAnalysis's own lift",
    on: "every column the realm's heroes lead, under its leader",
    cases: (s) =>
      withState(s.heroes).map((h) =>
        project(
          [h.report['armies'], skillOf(h.report, 'naval')],
          engineOn(theSeaLiftOf, [h.report['armies'], h.report]),
          engineOn(
            (armies: unknown, hero: Obj) => ({
              ...theSeaLiftOf(armies, hero),
              answer: getSeaCapability(...([armies, hero] as unknown as Parameters<typeof getSeaCapability>)),
            }),
            [h.state['armies'], h.state],
          ),
        ),
      ),
  },
];
const hasAType = (a: Obj): a is Obj & { type: string } => typeof a['type'] === 'string';
/** A column's sea lift (seaLiftOfAColumn) under its leader, with his naval mastery as getSeaCapability works it out;
 *  the units left ashore by their type and name. */
function theSeaLiftOf(armies: unknown, hero: Obj) {
  const lift = seaLiftOfAColumn(objects(armies).filter(hasAType), perkTier(hero, 'naval') >= 3);
  return { ...lift, unitsLeftAshore: lift.unitsLeftAshore.map((a) => [a.type, a['unitName']]) };
}

// ── The copies that stay ────

/** One value compared: what the copy answers, what the engine answers, and whether the engine's function tried to
 *  change its input (a read that writes: plan P1-11a, "What the code is"). The values are frozen, so a write throws:
 *  the answer is then "(wrote to its input)". */
export interface Comparison {
  readonly on: unknown;
  readonly copy: unknown;
  readonly engine: unknown;
  readonly engineChangedItsInput: boolean;
}
const compare = (on: unknown, copy: unknown, engine: { answer: unknown; changed: boolean }): Comparison => ({
  on,
  copy,
  engine: engine.answer,
  engineChangedItsInput: engine.changed,
});

/** The copy that stays of the two P1-11a2 checked the truth of (the other, poSeaAnalysis's cap, is a projection case
 *  since P1-11b4): effMagicLvl, the level of a magic school the order form offers spells by, against the effective
 *  level the report sends (skillEff: the engine's skillBonusBreakdown, the level the turn casts at), for every school
 *  of every hero of the realm; with the aura the report says it counts. */
export function effMagicLvlAgainstTheReport(
  c: Copies,
  s: Samples,
): { hero: unknown; school: string; copy: unknown; report: number; aura: number }[] {
  return s.heroes.flatMap((h) =>
    SCHOOLS.map((school) => {
      const eff = isObj(h.report['skillEff']) ? h.report['skillEff'][school] : undefined;
      const n = (x: unknown) => (typeof x === 'number' ? x : 0);
      return {
        hero: h.report['name'],
        school,
        copy: c.effMagicLvl(h.report, school),
        report: isObj(eff) ? n(eff['total']) : 0,
        aura: isObj(eff) ? n(eff['aura']) : 0,
      };
    }),
  );
}

// ── The copies that read the realm, the report's shape or the world (P1-11b1) ────
// Truth parity (Decision 6), each a copy on the report's value against the engine's function on the state's: what
// the portal tells the player against what the turn does. Where the two are known to disagree (plan P1-11b's
// Decisions, questions 13 and 15 for Toby), the difference is pinned exactly: the check fails the day either side
// changes alone, which is when the fix rewrites it.

/** What a case is about, short enough for a line. */
const aboutTheUnit = (world: World, hero: Projected & { state: Obj }, unit: Projected) => ({
  unit: [unit.report['type'], unit.report['race'], unit.report['skeletal'] ? 'skeletal' : 'alive'],
  hero: [
    hero.report['race'],
    hero.report['alignment'],
    (isObj(hero.report['skills']) ? hero.report['skills'] : {})['druid'],
  ],
  realm: [realmOf(world, hero.state)['alignment'], objects(world.report['discoveries']).map((d) => d['id'])],
});
const realmOf = (world: World, hero: Obj): Obj => objects(world.state['players'])[Number(hero['player'])] ?? {};
/** The aura of a Crown of Command in the report's effective level of a hero's skill (0: none). */
export const auraIn = (reportHero: Obj, skill: string): number => {
  const e = isObj(reportHero['skillEff']) ? reportHero['skillEff'][skill] : undefined;
  return isObj(e) && typeof e['aura'] === 'number' ? e['aura'] : 0;
};
/** The hero with his trained level of `skill` set to `level`. */
const skillOf = (hero: Obj, skill: string): number => {
  const v = isObj(hero['skills']) ? hero['skills'][skill] : 0;
  return typeof v === 'number' ? v : 0;
};

/** The battle's Druid multiplier on a unit's strength (druIdPenaltyMult, as the battle calls it: the realm's
 *  alignment, whether its Dragon Taming tames the unit, and the state's heroes, beside whom his Druid is read). */
const battleDruidMultiplier = (world: World) => (hero: Obj, unit: Obj) =>
  // the staged world's state, hero, unit and realm's alignment, given the types the battle hands them, by assertion as
  // the staged worlds give the saved state's (dragonTamed reads the hero's realm, the unit's type and the realm's
  // discoveries; druIdPenaltyMult the unit's type and race, and takes the hero's and the state's heroes' fields as
  // they are)
  druIdPenaltyMult(
    hero,
    unit as ArmyInABattle,
    realmOf(world, hero)['alignment'] as string | undefined,
    dragonTamed({ G: world.state } as unknown as TurnContext, hero as HeroInABattle, unit as ArmyInABattle),
    objects(world.state['characters']),
  );

/** One Druid case compared, and the Crown's aura in the report's effective Druid of the hero. */
export interface DruidComparison extends Comparison {
  readonly aura: number;
}
/** The engine's answer `fn` on the state's hero and unit, with the aura beside him. */
function druidCase(on: unknown, copy: unknown, hero: Obj, unit: Obj, aura: number, fn: (h: Obj, u: Obj) => unknown) {
  return { ...compare(on, copy, engineOn(fn, [hero, unit])), aura };
}

/** The strength a Druid shortfall of `levels` leaves a unit in battle, as the rule says (each level short costs 20%,
 *  down to a tenth): what the shortfall druidNeedP answers comes to. */
const strengthLeftByAShortfall = (levels: unknown) =>
  typeof levels === 'number' ? Math.max(0.1, 1 - levels * 0.2) : levels;

/** druidNeedP (the Druid a hero needs to lead a unit, and his shortfall: the order form's Druid line and the army
 *  card read it), against the battle's druIdPenaltyMult: the strength the shortfall leaves. */
export function druidNeedAgainstTheBattle(c: Copies, w: WorldSamples): DruidComparison[] {
  return w.druid.map(({ world, hero, unit }) => {
    const need = c.druidNeedP(unit.report, hero.report, world.report);
    return druidCase(
      aboutTheUnit(world, hero, unit),
      strengthLeftByAShortfall(isObj(need) ? need['shortfall'] : need),
      hero.state,
      unit.state,
      auraIn(hero.report, 'druid'),
      battleDruidMultiplier(world),
    );
  });
}

/** The army card's Druid shortfall line, read by its statements: the strength it shows a unit of 1,000 after a
 *  shortfall, against the battle's (druIdPenaltyMult, rounded down as armStr and the card round it: R-122). */
export function armyCardShortfallAgainstTheBattle(c: Copies, w: WorldSamples): DruidComparison[] {
  return w.druid.map(({ world, hero, unit }) => {
    const card = c.armyCardDruidLines(unit.report, hero.report, world.report);
    const multiplier = battleDruidMultiplier(world);
    return druidCase(
      aboutTheUnit(world, hero, unit),
      isObj(card) ? card['strengthOfAThousand'] : card,
      hero.state,
      unit.state,
      auraIn(hero.report, 'druid'),
      (h, u) => Math.floor(1000 * multiplier(h, u)),
    );
  });
}
/** The army card's Druid mastery line, read by its statements: its bonus in percent, against the turn's
 *  (druidMasteryGain). */
export function armyCardMasteryAgainstTheTurn(c: Copies, w: WorldSamples): Comparison[] {
  return w.druid.map(({ world, hero, unit }) => {
    const card = c.armyCardDruidLines(unit.report, hero.report, world.report);
    const alignment = realmOf(world, hero.state)['alignment'];
    return compare(
      aboutTheUnit(world, hero, unit),
      isObj(card) ? card['mastery'] : card,
      engineOn(
        (h: HeroInABattle, u: ArmyInABattle, a: string | null | undefined) => {
          // (the turn's context holds only the state the report was made from: the context's type by assertion, as
          // stagedWorld's state; druidMasteryGain reads only its state)
          const turn = { G: world.state } as unknown as TurnContext;
          const gain: unknown = druidMasteryGain(turn, h, u, a);
          return isObj(gain) && typeof gain['gain'] === 'number' ? Math.round(gain['gain'] * 100) : gain;
        },
        [hero.state, unit.state, alignment],
      ),
    );
  });
}

/** The turn report's flying carry, read by its statements: whether a column takes to the air (the flyers lift every
 *  foot soldier), on the report's column, against getFlyCapability on the state's, on every column of the realm's
 *  heroes (a column all of whose units fly is not carried: the report gives it the flyers' pace apart). Until P1-11b2
 *  the report kept its own copy of getFlyCapability and of isAirCarriable, and this checked the second on every unit
 *  type too; it calls getFlyCapability now. */
export function flyingCarryAgainstTheEngine(c: Copies, s: Samples): { columns: Comparison[] } {
  const carry = (armies: unknown): Obj => {
    const answer = c.turnReportFlyingCarry(armies);
    if (!isObj(answer)) throw new Error("the turn report's flying carry gave no answer");
    return answer;
  };
  const columns = withState(s.heroes)
    .filter((h) => objects(h.report['armies']).length > 0)
    .map((h) =>
      compare(
        objects(h.report['armies']).map((a) => a['type']),
        carry(h.report['armies'])['canFly'],
        engineOn(
          (armies: Obj[]) =>
            getFlyCapability(armies as { type: string }[]) && !armies.every((a) => AERIAL_TYPES.has(String(a['type']))),
          [objects(h.state['armies'])],
        ),
      ),
    );
  return { columns };
}

/** The gain the engine's Explore order makes for the hero in the province, on a copy of the state as the next turn
 *  starts: the title holders worked out from it as the turn does before its first phase. */
function exploreOrderGain(state: Obj, heroId: unknown, provinceId: unknown): number {
  const G = copyOf(state);
  G['_titleHolders'] = {};
  G['_minorHolders'] = {};
  const turn = typeof G['turn'] === 'number' ? G['turn'] : 1;
  // (the titles' perks are live from the turn the titles go public: TITLE_PERKS_ENABLED is on)
  if (turn >= TITLES_PUBLIC_FROM_TURN) {
    const standings: unknown = computeStandings(G);
    G['_titleHolders'] = (isObj(standings) ? standings['titles'] : null) ?? {};
    G['_minorHolders'] = computeMinorTitles(G);
  }
  const c = objects(G['characters']).find((x) => x['id'] === heroId);
  const prov = objects(isObj(G['world']) ? G['world']['provinces'] : []).find((p) => p['id'] === provinceId);
  if (!c || !prov) throw new Error('the explore case has no hero or no province');
  prov['exploredBy'] = {};
  prov['explored'] = 0;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], turn), { KC_SEASONS, isBotRow });
  tc._currentPhase = 0;
  tc._logCtx = { charId: c['id'], phase: 0 };
  kcRng.seed(1);
  quietly(() => {
    // (the staged world's hero and his province, given the types the order takes, by assertion as the staged worlds
    // give the saved state's: the turn's context is made by the engine's own createTurnContext)
    resolveExploreOrder(tc as unknown as TurnContext, c as never, prov as never);
  });
  const by = prov['exploredBy'];
  const gain = isObj(by) ? by[String(c['player'])] : undefined;
  return typeof gain === 'number' ? gain : 0;
}
/** One Explore case compared, and whether the hero holds the Loremaster (in the report: the forecast reads it). */
export interface ExploreComparison extends Comparison {
  readonly loremaster: boolean;
}
/** The Explore order's forecast (exploreGainFor: the percentage of the province the order form says the order maps),
 *  against what the engine's order maps. */
export function exploreForecastAgainstTheOrder(c: Copies, w: WorldSamples): ExploreComparison[] {
  return w.explore.map(({ world, hero, province }) => ({
    ...compare(
      [
        hero.report['name'],
        province['terrain'],
        (isObj(hero.report['skills']) ? hero.report['skills'] : {})['explorer'],
      ],
      c.exploreGainOn(world.report, hero.report, province['terrain']),
      { answer: exploreOrderGain(world.state, hero.state['id'], province['id']), changed: false },
    ),
    loremaster: objects(hero.report['titlesHeld']).some((t) => String(t['name']).includes('Loremaster')),
  }));
}

/** What a staged marcher holds of a Traveller's Cloak (P1-23t). */
export type TheCloakHeHolds = 'none' | 'worn' | 'carried';
/** The world staged for a march (P1-23t): beside realm 0's capital, in a land province, a hero of realm 0 of Explorer
 *  0 and of 3 with no Traveller's Cloak, one wearing it, and one carrying it in his pack while he wears a Shadowcloak (a
 *  slot holds one item, and the turn puts an only cloak on, so a carried one is a spare). Each marches into the
 *  capital, where he meets no foe. */
export function marchWorld(): {
  world: World;
  marchers: { id: unknown; cloak: TheCloakHeHolds }[];
  to: unknown;
} {
  const { g, king, hero } = aWorldToStageIn();
  const map = isObj(g['world']) ? g['world'] : {};
  const provinces = objects(map['provinces']);
  const capital = provinces.find((p) => p['id'] === king['location']);
  const row = capital?.['row'];
  const col = capital?.['col'];
  if (typeof row !== 'number' || typeof col !== 'number') throw new Error('the staged world has no capital on its map');
  const beside = getNeighborsP({ row, col }, Number(map['cols']), Number(map['rows']), provinces).find(
    (p) => p['terrain'] !== 'sea',
  );
  if (!beside) throw new Error("the staged world's capital has no land beside it");
  const named = (name: string) => {
    const it = catalogue().find((x) => x['name'] === name);
    if (!it) throw new Error(`the catalogue has no ${name}`);
    return it;
  };
  let itemId = 61_000;
  // (as a saved game holds them once the turn has put them on: so reading his items changes nothing)
  const held = (name: string, equipped: boolean): Obj => ({ ...copyOf(named(name)), id: itemId++, equipped });
  const items: Record<TheCloakHeHolds, () => Obj[]> = {
    none: () => [],
    worn: () => [held("Traveller's Cloak", true)],
    carried: () => [held('Shadowcloak', true), held("Traveller's Cloak", false)],
  };
  const marchers = [0, 3].flatMap((explorer) =>
    (['none', 'worn', 'carried'] as const).map((cloak) => ({
      id: hero({ location: beside['id'], skills: { explorer }, items: items[cloak]() })['id'],
      cloak,
    })),
  );
  return { world: savedAndReported(g), marchers, to: king['location'] };
}
/** The share of the province `to` the engine's Move order maps as the hero marches into it, in the first phase of the
 *  next turn, on a copy of the state (the province unmapped by his realm). */
function theShareAMarchInMaps(state: Obj, heroId: unknown, to: unknown): number {
  const G = copyOf(state);
  const turn = typeof G['turn'] === 'number' ? G['turn'] : 1;
  const c = objects(G['characters']).find((x) => x['id'] === heroId);
  const provinces = objects(isObj(G['world']) ? G['world']['provinces'] : []);
  const from = provinces.find((p) => p['id'] === c?.['location']);
  const into = provinces.find((p) => p['id'] === to);
  const realm = objects(G['players'])[Number(c?.['player'])];
  if (!c || !from || !into || !realm) throw new Error('the march case has no hero, province or realm');
  into['exploredBy'] = {};
  into['explored'] = 0;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], turn), { KC_SEASONS, isBotRow });
  tc._currentPhase = 0;
  tc._logCtx = { charId: c['id'], phase: 0 };
  kcRng.seed(1);
  quietly(() => {
    // (the staged world's hero, his province and his realm, handed to the typed Move order as they are)
    resolveMoveOrder(
      ...([tc, c, 0, false, `prov:${String(to)}`, from, realm] as unknown as Parameters<typeof resolveMoveOrder>),
    );
  });
  if (c['location'] !== to) throw new Error(`the staged march of ${String(c['name'])} did not arrive`);
  const by = into['exploredBy'];
  const gain = isObj(by) ? by[String(c['player'])] : undefined;
  return typeof gain === 'number' ? gain : 0;
}
/** One march compared, and what the marcher holds of a Traveller's Cloak. */
export interface MarchComparison extends Comparison {
  readonly cloak: TheCloakHeHolds;
}
/** The share of a province the Explore forecast counts a march into it as mapping first (exploreMoveGainBefore), against
 *  what the engine's Move order maps (P1-23t), on the world staged for a march. */
export function marchInGainAgainstTheMoveOrder(c: Copies): MarchComparison[] {
  const { world, marchers, to } = quietly(marchWorld);
  const inTheReport = new Map(objects(world.report['characters']).map((h) => [h['id'], h]));
  return marchers.map(({ id, cloak }) => {
    const hero = inTheReport.get(id);
    if (!hero) throw new Error('a staged marcher is not in the report');
    return {
      ...compare(
        [hero['name'], cloak, (isObj(hero['skills']) ? hero['skills'] : {})['explorer']],
        c.exploreMoveGainOn(
          world.report,
          { [String(id)]: [{ action: 'Move', target: `prov:${String(to)}` }] },
          hero,
          1,
          to,
        ),
        { answer: theShareAMarchInMaps(world.state, id, to), changed: false },
      ),
      cloak,
    };
  });
}

// ── The march (P1-11d1) ────
// Plan P1-11d's parity cases on movement, before any of it is shared: where the order form says a hero will stand after
// his Moves and Forced Marches (predictedLocation, which every later phase's form reads), the Move field's directions,
// the direction a fresh Move opens on (lastMoveDirOf), and the share of a province marching in maps
// (exploreMoveGainBefore). Each runs as the portal's own code, on the orders staged in its fields. Where the forecast
// disagrees with the turn (question 44), the difference is pinned exactly: each case says which kind it is.

/** The compass words of the Move field (its DIRECTIONS), by the direction each names. */
const THE_MOVE_FIELDS_WORDS: Record<string, string> = {
  'North West': 'NW',
  'North East': 'NE',
  West: 'W',
  East: 'E',
  'South West': 'SW',
  'South East': 'SE',
};
/** Each option of the Move field, as [the direction its words name, its value]. */
function theMoveFieldsOptions(options: unknown): [string, string][] {
  return (Array.isArray(options) ? options : []).map((html) => {
    const option = /value="([^"]*)"[^>]*>([^<(]*)/.exec(String(html));
    const words = (option?.[2] ?? '').trim();
    return [THE_MOVE_FIELDS_WORDS[words] ?? `(words the check doesn't know: ${words})`, option?.[1] ?? '(no value)'];
  });
}
/** Which of the portal's three hex tables a case reads. */
export type TheHexTable = 'predictedLocation' | 'the Move field' | 'the Move field’s icy wastes' | 'lastMoveDirOf';
/** One hex step compared, and the table the portal read it from. */
export interface HexStepComparison extends Comparison {
  readonly table: TheHexTable;
}
/** The portal's three hex tables, each run as the page runs it (since P1-11d6 each calls the engine's hex step, so these
 *  are projection cases: what the portal makes of it), against the engine's step to a neighbour
 *  (neighborInDir, which the Move order takes for a compass step, and getNeighborsP, by which it reads a province next
 *  door), from every province of the staged world's map, each row's parity and the map's edges and its wrap with
 *  them: predictedLocation after a Move in each direction (off the map's top or bottom he stays), the Move field's
 *  directions (each the province one step that way, which the turn reads as next door; none off the map), and the
 *  direction a fresh Move opens on after a Move one step each way. */
export function thePortalsHexTablesAgainstTheEngine(c: Copies): HexStepComparison[] {
  const { g } = aWorldToStageIn();
  const world = quietly(() => savedAndReported(g));
  const map = isObj(world.state['world']) ? world.state['world'] : {};
  const [cols, rows] = [Number(map['cols']), Number(map['rows'])];
  const provinces = objects(map['provinces']);
  const tc = createTurnContext(copyOf(world.state), [], Number(world.state['turn']) || 1);
  // (the staged world's province, given the type the engine's step takes, by assertion as the saved state's)
  const step = (from: Obj, dir: string) =>
    neighborInDir(tc as unknown as TurnContext, from as unknown as Province, dir);
  const heroId = 'the marcher';
  return provinces.flatMap((from): HexStepComparison[] => {
    const report = { ...world.report, characters: [{ id: heroId, name: 'The Marcher', locationId: from['id'] }] };
    const on = (dir: string) => [from['id'], from['row'], from['col'], dir];
    const moves = (target: string) => ({ [heroId]: [{ action: 'Move', target }] });
    const afterAMove = KC_HEX_DIRS.map((dir) => ({
      table: 'predictedLocation' as const,
      ...compare(on(dir), c.predictedLocationOn(report, moves(`dir:${dir}`), heroId, 1), {
        answer: step(from, dir)?.id ?? from['id'],
        changed: false,
      }),
    }));
    // the provinces the turn's Move reads as next door (a prov:<id> of another is a far one: a step toward it)
    const nextDoor = getNeighborsP({ row: Number(from['row']), col: Number(from['col']) }, cols, rows, provinces).map(
      (p) => p['id'],
    );
    const theFieldAsMade = c.theMoveFieldsDirectionsOn(report, {}, { id: heroId }, 0);
    const fieldMade = isObj(theFieldAsMade) ? theFieldAsMade : {};
    // the note under the field says the icy wastes bar a way north (NW or NE off the map) or south (SW or SE)
    const theWastes = {
      table: 'the Move field’s icy wastes' as const,
      ...compare(on('every direction'), [fieldMade['blockedNorth'], fieldMade['blockedSouth']], {
        answer: [
          KC_HEX_DIRS.slice(0, 2).some((dir) => !step(from, dir)),
          KC_HEX_DIRS.slice(4).some((dir) => !step(from, dir)),
        ],
        changed: false,
      }),
    };
    const theField = {
      table: 'the Move field' as const,
      ...compare(on('every direction'), theMoveFieldsOptions(fieldMade['options']), {
        answer: KC_HEX_DIRS.flatMap((dir) => {
          const to = step(from, dir);
          return to && nextDoor.includes(to.id) ? [[dir, `prov:${String(to.id)}`]] : [];
        }),
        changed: false,
      }),
    };
    const opensOn = KC_HEX_DIRS.flatMap((dir) => {
      const to = step(from, dir);
      if (!to) return [];
      return [
        {
          table: 'lastMoveDirOf' as const,
          ...compare(
            [from['id'], from['row'], from['col'], `prov:${String(to.id)}`],
            c.lastMoveDirOn(report, moves(`prov:${String(to.id)}`), heroId, 1),
            { answer: dir, changed: false },
          ),
        },
      ];
    });
    return [...afterAMove, theField, theWastes, ...opensOn];
  });
}

/** The kinds of staged march: those the forecast and the turn agree on (a Forced March by direction and a Move by a
 *  province's bare number since R-128: both read their target by the turn's whatAMarchsOrderNames; one naming no
 *  province leaves him where he is; since P1-11e10 a march the turn refuses leaves him where he is too: a column with
 *  ships over land, one with too little lift to put to sea, one at a neutral realm's border, his realm's war declared
 *  this turn standing only for an Evil realm, and the marches each refusal lets through; since P1-11e11 a march past his
 *  pace stops him where his pools run out: the pools the report gives, each step spending the one the turn's rule
 *  names, a voyage the sea pool and a march over land the land pool; since P1-11e12 a far province is one step toward
 *  it, the first of a shortest route the column may take on the report's map, of a route as short over safe ground
 *  that one's, the step the turn may refuse as any other). */
export const THE_MARCHES_THE_FORECAST_GETS_RIGHT = [
  'a compass step',
  'a province next door',
  'a Forced March next door',
  'a march into his own province',
  "a Forced March's compass step",
  'a Move to a province next door by its bare number',
  'a Move naming no province on the map',
  'ships over land',
  'too little lift to put to sea',
  "a neutral realm's border",
  "a lone hero at a neutral realm's border",
  "a realm's border his own is at war with",
  "a neutral realm's border, war declared this turn by a Good realm",
  "a neutral realm's border, war declared this turn by an Evil realm",
  "a neutral realm's border, war declared this turn by an Evil realm that hasn't met it",
  'ships putting to sea',
  'a fleet putting in on a coast',
  'past his pace',
  'past his pace at sea',
  'a voyage past his pace on land',
  'a march the turn refuses, then two steps on his pace of 2',
  'a far province',
  'a far Forced March',
  'a far province, leading ships',
  "a far province round a neutral realm's province",
  'a far province round the province of a realm not yet met',
  'a far province no route reaches',
  'a far sea, with too little lift',
  'past his pace, then a far province',
] as const;
/** The kinds of staged march the turn refuses (P1-11e10): the hero stays where he is, and a Search Lair the form sends
 *  after it names the province he stands in. */
export const THE_MARCHES_THE_TURN_REFUSES = [
  'ships over land',
  'too little lift to put to sea',
  "a neutral realm's border",
  "a neutral realm's border, war declared this turn by a Good realm",
  "a neutral realm's border, war declared this turn by an Evil realm that hasn't met it",
] as const;
/** The kinds of staged march the turn lets begin and stops part way, where his pace runs out (P1-11e11): the hero stands
 *  in the province of the last step his pools pay for. */
export const THE_MARCHES_STOPPED_BY_HIS_PACE = [
  'past his pace',
  'past his pace at sea',
  'past his pace, then a far province',
] as const;
/** The kinds of staged march to a far province the turn takes one step toward (P1-11e12): the hero stands in a
 *  province next door both to where he set out and to the one his orders name. */
export const THE_MARCHES_ONE_STEP_TOWARD_A_FAR_PROVINCE = [
  'a far province',
  'a far Forced March',
  "a far province round a neutral realm's province",
  'a far province round the province of a realm not yet met',
] as const;
/** The kinds of staged march a Search Lair is staged after: each the turn refuses, and one his pace stops on land. */
/** The kinds of staged march a Search Lair is staged after: each the turn refuses, one his pace stops on land, and one
 *  step toward a far province (P1-11e12). */
export const THE_MARCHES_A_SEARCH_LAIR_FOLLOWS = [
  ...THE_MARCHES_THE_TURN_REFUSES,
  'past his pace',
  'a far province',
  "a far province round a neutral realm's province",
] as const;
export type AKindOfMarch = (typeof THE_MARCHES_THE_FORECAST_GETS_RIGHT)[number];
/** An order of a phase, as the page's fields hold it and the turn reads it. */
interface AnOrder {
  readonly action: 'Move' | 'Forced March';
  readonly target: string;
}
/** What a staged march changes of realm 0 toward realm 1, whose province is next door (P1-11e10): its creed, the two
 *  realms at war as the turn begins, a war it declares this turn (as the form holds it, and the turn's merge hands it
 *  on once the Safe Start is over), and whether realm 0 has met realm 1 (it has, unless `unmet`: the form offers no
 *  declaration then, and the turn takes none). */
export interface WhatAStagedMarchChangesOfTheRealm {
  readonly alignment?: string;
  readonly atWar?: boolean;
  readonly declaresWar?: boolean;
  readonly unmet?: boolean;
  /** A province realm 1 holds besides (P1-11e12: one next door to the start, on the shortest route toward a far one). */
  readonly theNeutralRealmHolds?: unknown;
  /** A province realm 0's own list holds besides (P1-11e12: so its report shows the ground beside it). */
  readonly itsRealmListsAlso?: unknown;
}
/** A staged march: its kind, the hero who marches (realm 0's), his orders by phase, where he sets out and where his
 *  orders name; and what it changes of his realm, if anything. */
export interface AStagedMarch {
  readonly kind: AKindOfMarch;
  readonly heroId: unknown;
  readonly orders: readonly AnOrder[];
  readonly from: unknown;
  readonly named: unknown;
  /** Where his pace stops him (a march past it, P1-11e11): the province of the last step his pools pay for. */
  readonly stopsAt?: unknown;
  readonly realm?: WhatAStagedMarchChangesOfTheRealm;
}
/** The kinds of staged march into a province whose share the march maps is read, each one the forecast and the turn
 *  agree on: since P1-11e13 (question 44, R-128) a cloak of another name (the share the report gives of his worn
 *  items) and the coast Naval 6 charts beside a sea sailed into, and an Explorer trained past 5 (both count 5). */
export const THE_MARCHES_IN_THE_FORECAST_GETS_RIGHT = [
  'a Travelworn Drape worn',
  'March 6, leading two companies',
  'March 0, leading two companies',
  'March 5, leading two companies',
  'Explorer 7 trained',
  'a sea sailed into at Naval 6, leading a fleet',
  'the coast beside the sea he sails into, charted at Naval 6',
  'a land province not beside the sea he sails into, at Naval 6',
  'the sea he sets out from, beside the sea he sails into at Naval 6',
  'the coast beside the sea he flies into at Naval 6, leading Eagle Riders and no ships',
] as const;
export type TheMarchInKind = (typeof THE_MARCHES_IN_THE_FORECAST_GETS_RIGHT)[number];
/** A staged march into a province: its kind, the hero (realm 0's), his orders by phase and the province whose share is
 *  read. */
export interface AStagedMarchIn {
  readonly kind: TheMarchInKind;
  readonly heroId: unknown;
  readonly orders: readonly AnOrder[];
  readonly mapped: unknown;
  /** What it changes of his realm (P1-11e13: the coast in its list, so its report shows the sea beside it). */
  readonly realm?: WhatAStagedMarchChangesOfTheRealm;
}
/** The world staged for marching (P1-11d1): every land province no realm holds made realm 0's, its guards and neutral
 *  heroes gone (so no march meets a battle), and one province next door to the start made realm 1's (neutral: no
 *  treaty). From one land province with the sea beside it and a road of three land provinces out of it (the second two
 *  steps away), heroes of realm 0 each march one kind: alone, or leading Men-at-Arms (a pace of 2), or Men-at-Arms and
 *  Orcish Longships (a pace of 3 at sea), or a Galleon Fleet (3 at sea). */
export function marchingWorld(): { world: World; marches: AStagedMarch[]; marchesIn: AStagedMarchIn[] } {
  const { g, hero } = aWorldToStageIn();
  const map = isObj(g['world']) ? g['world'] : {};
  const [cols, rows] = [Number(map['cols']), Number(map['rows'])];
  const provinces = objects(map['provinces']);
  const isLand = (p: Obj) => p['terrain'] !== 'sea';
  for (const p of provinces.filter(isLand)) {
    p['owner'] ??= 0;
    p['npcArmies'] = [];
    p['neutralDefenders'] = [];
  }
  // (in place: the staged heroes join this list)
  const heroes: unknown[] = Array.isArray(g['characters']) ? g['characters'] : [];
  for (let i = heroes.length - 1; i >= 0; i--) {
    const h = heroes[i];
    if (!isObj(h) || h['player'] == null) heroes.splice(i, 1);
  }
  const alive = new Set(objects(heroes).map((h) => h['id']));
  for (const p of provinces)
    p['characters'] = (Array.isArray(p['characters']) ? p['characters'] : []).filter((id) => alive.has(id));
  const nextTo = (p: Obj) => getNeighborsP({ row: Number(p['row']), col: Number(p['col']) }, cols, rows, provinces);
  const ours = (p: Obj) => isLand(p) && p['owner'] === 0;
  // the start, its sea, its road (two steps, then a third) and the province next door the neutral realm is given
  const staged = provinces.filter(ours).flatMap((start) => {
    const beside = nextTo(start);
    const sea = beside.find((p) => !isLand(p));
    // the sea beyond it, and a coast beside that
    const open = sea ? nextTo(sea).find((p) => !isLand(p)) : undefined;
    const coast = open ? nextTo(open).find(isLand) : undefined;
    return beside.filter(ours).flatMap((first) =>
      nextTo(first)
        .filter((second) => ours(second) && second !== start && !beside.includes(second))
        .flatMap((second) => {
          const third = nextTo(second).find((p) => ours(p) && p !== first && p !== start);
          const border = beside.find((p) => ours(p) && p !== first && p !== second && p !== third);
          return sea && open && coast && third && border
            ? [{ start, sea, open, coast, first, second, third, border }]
            : [];
        }),
    );
  })[0];
  if (!staged) throw new Error('the staged world has no province to march from with the sea and a road beside it');
  const { start, sea, open, coast, first, second, third, border } = staged;
  border['owner'] = 1;
  // (P1-11e12: a far province is one step toward it. The step a column of Men-at-Arms takes toward a province two steps
  // away: the first province next door in the compass directions' order on a shortest route over its own ground)
  const beside = nextTo(start);
  const theStepToward = (far: Obj) => {
    const step = beside.find((p) => ours(p) && nextTo(p).includes(far));
    if (!step) throw new Error('the staged world has no step over its own ground toward a far province');
    return step;
  };
  // (a far province round a neutral realm's province: one two steps away whose first route in that order runs through a
  // province next door the neutral realm is given (on that march alone), and a route as short over realm 0's own ground)
  const round = provinces.filter(ours).flatMap((far) => {
    if (far === start || beside.includes(far)) return [];
    const [held, ...others] = beside.filter((p) => isLand(p) && nextTo(p).includes(far));
    const safe = others.find(ours);
    return held && safe ? [{ far, held, safe }] : [];
  })[0];
  // (a far province no route reaches from the sea for a fleet: one of realm 0's, not on the coast of that sea)
  const inland = provinces.find((p) => ours(p) && !nextTo(sea).includes(p));
  if (!round || !inland) throw new Error('the staged world has no far province to march round or none inland');
  // (the start in realm 0's own list of provinces, so its report shows the provinces beside it as its border, with their
  // owners: the march forecast reads the neutral realm's border there, P1-11e10)
  const ourRealm = objects(g['players'])[0];
  if (!ourRealm) throw new Error('the staged world has no realm 0');
  const ourProvinces: unknown[] = Array.isArray(ourRealm['provinces']) ? ourRealm['provinces'] : [];
  if (!ourProvinces.includes(start['id'])) ourRealm['provinces'] = [...ourProvinces, start['id']];
  // (a far sea, with the coast beside it in realm 0's own list on that march alone, so its report shows the ground:
  // P1-11e12; ground the report shows as unknown is read as land, a forecast limit)
  const farSea = provinces.find((p) => !isLand(p) && !beside.includes(p) && nextTo(p).some(ours));
  const farCoast = farSea ? nextTo(farSea).find(ours) : undefined;
  if (!farSea || !farCoast) throw new Error('the staged world has no far sea with a coast of realm 0');
  const tc = createTurnContext(g, [], Number(g['turn']) || 1);
  // (the staged world's province, given the type the engine's step takes, by assertion as the saved state's)
  const compass = KC_HEX_DIRS.find(
    (dir) => neighborInDir(tc as unknown as TurnContext, start as unknown as Province, dir) === first,
  );
  if (!compass) throw new Error("the staged world's road has no compass step");
  const men = () => [{ type: 'Men-at-Arms', quality: 'Average', unitName: 'Men-at-Arms 0' }];
  const withShips = () => [...men(), { type: 'Orcish Longships', quality: 'Average', unitName: 'Orcish Longships 0' }];
  const fleet = () => [{ type: 'Galleon Fleet', quality: 'Average', unitName: 'Galleon Fleet 0' }];
  const id = (p: Obj) => String(p['id']);
  const move = (target: string): AnOrder => ({ action: 'Move', target });
  const forced = (target: string): AnOrder => ({ action: 'Forced March', target });
  const kinds: [AKindOfMarch, AnOrder[], Obj, Obj[], WhatAStagedMarchChangesOfTheRealm?][] = [
    ['a compass step', [move(`dir:${compass}`)], first, []],
    ['a province next door', [move(`prov:${id(first)}`)], first, men()],
    ['a Forced March next door', [forced(id(first))], first, men()],
    ['a march into his own province', [move(`prov:${id(start)}`)], start, men()],
    ["a Forced March's compass step", [forced(`dir:${compass}`)], first, men()],
    ['a Move to a province next door by its bare number', [move(id(first))], first, men()],
    ['a Move naming no province on the map', [move('prov:9999')], start, men()],
    ['ships over land', [move(`prov:${id(first)}`)], first, withShips()],
    ['too little lift to put to sea', [move(`prov:${id(sea)}`)], sea, men()],
    ["a neutral realm's border", [move(`prov:${id(border)}`)], border, men()],
    ["a lone hero at a neutral realm's border", [move(`prov:${id(border)}`)], border, []],
    ["a realm's border his own is at war with", [move(`prov:${id(border)}`)], border, men(), { atWar: true }],
    [
      "a neutral realm's border, war declared this turn by a Good realm",
      [move(`prov:${id(border)}`)],
      border,
      men(),
      { declaresWar: true },
    ],
    [
      "a neutral realm's border, war declared this turn by an Evil realm",
      [move(`prov:${id(border)}`)],
      border,
      men(),
      { alignment: 'Evil', declaresWar: true },
    ],
    [
      "a neutral realm's border, war declared this turn by an Evil realm that hasn't met it",
      [move(`prov:${id(border)}`)],
      border,
      men(),
      { alignment: 'Evil', declaresWar: true, unmet: true },
    ],
    ['ships putting to sea', [move(`prov:${id(sea)}`)], sea, withShips()],
    ['a fleet putting in on a coast', [move(`prov:${id(start)}`)], start, fleet()],
    ['past his pace', [move(`prov:${id(first)}`), move(`prov:${id(second)}`), move(`prov:${id(third)}`)], third, men()],
    // (a fleet at sea, four steps between two seas: its pace of 3 pays for three)
    ['past his pace at sea', [open, sea, open, sea].map((p) => move(`prov:${id(p)}`)), sea, fleet()],
    // (three steps at sea, past his pace of 2 on land: a voyage spends the sea pool, his 3)
    ['a voyage past his pace on land', [sea, open, sea].map((p) => move(`prov:${id(p)}`)), sea, withShips()],
    // (turned back at the border, which spends nothing of his pace of 2: then two steps)
    [
      'a march the turn refuses, then two steps on his pace of 2',
      [border, first, second].map((p) => move(`prov:${id(p)}`)),
      second,
      men(),
    ],
    ['a far province', [move(`prov:${id(second)}`)], second, men()],
    ['a far Forced March', [forced(id(second))], second, men()],
    ['a far province, leading ships', [move(`prov:${id(second)}`)], second, withShips()],
    [
      "a far province round a neutral realm's province",
      [move(`prov:${id(round.far)}`)],
      round.far,
      men(),
      { theNeutralRealmHolds: round.held['id'] },
    ],
    [
      'a far province round the province of a realm not yet met',
      [move(`prov:${id(round.far)}`)],
      round.far,
      men(),
      { theNeutralRealmHolds: round.held['id'], unmet: true },
    ],
    // (a fleet at sea: it may not enter land but from the sea next door, so no route reaches an inland province)
    ['a far province no route reaches', [move(`prov:${id(inland)}`)], inland, fleet()],
    // (Men-at-Arms, with no hull to lift them, may not enter the sea: no route reaches one)
    [
      'a far sea, with too little lift',
      [move(`prov:${id(farSea)}`)],
      farSea,
      men(),
      { itsRealmListsAlso: farCoast['id'] },
    ],
    // (two steps on his pace of 2, then a far province: the step toward it is past his pace)
    ['past his pace, then a far province', [first, second, start].map((p) => move(`prov:${id(p)}`)), start, men()],
  ];
  // (where each sets out: the start, but for a fleet at sea)
  const atSea: readonly AKindOfMarch[] = [
    'a fleet putting in on a coast',
    'past his pace at sea',
    'a far province no route reaches',
  ];
  const setsOutFrom = (kind: AKindOfMarch) => (atSea.includes(kind) ? sea : start);
  // (where his pace stops a march past it: the second step's province on land, the third's at sea; and since P1-11e12
  // where one step toward a far province takes him, or leaves him where no route reaches it)
  const stopsAt: Partial<Record<AKindOfMarch, Obj>> = {
    'past his pace': second,
    'past his pace at sea': open,
    'past his pace, then a far province': second,
    'a far province': theStepToward(second),
    'a far Forced March': theStepToward(second),
    "a far province round a neutral realm's province": round.safe,
    'a far province round the province of a realm not yet met': round.safe,
    'a far sea, with too little lift': start,
    'a far province no route reaches': sea,
    // (a column leading ships may not step from land to land: no route of the sea reaches the province two steps away)
    'a far province, leading ships': start,
  };
  const marches = kinds.map(([kind, orders, named, armies, realm]) => ({
    kind,
    ...(realm ? { realm } : {}),
    ...(stopsAt[kind] ? { stopsAt: stopsAt[kind]['id'] } : {}),
    // (March 7 for a Forced March, which the turn refuses below it; March 0 else, so a column of Men-at-Arms keeps
    // their pace of 2)
    heroId: hero({
      location: setsOutFrom(kind)['id'],
      skills: { march: orders.some((o) => o.action === 'Forced March') ? 7 : 0 },
      armies,
    })['id'],
    orders,
    from: setsOutFrom(kind)['id'],
    named: named['id'],
  }));
  const worn = (name: string) => {
    const it = catalogue().find((x) => x['name'] === name);
    if (!it) throw new Error(`the catalogue has no ${name}`);
    // (as a saved game holds it once the turn has put it on)
    return [{ ...copyOf(it), id: 62_000, equipped: true }];
  };
  const into = (p: Obj) => [move(`prov:${id(p)}`)];
  const marchesIn: [TheMarchInKind, Obj, Obj][] = [
    ['a Travelworn Drape worn', { items: worn('Travelworn Drape') }, first],
    ['March 6, leading two companies', { skills: { march: 6 }, armies: [...men(), ...men()] }, first],
    ['March 0, leading two companies', { armies: [...men(), ...men()] }, first],
    ['March 5, leading two companies', { skills: { march: 5 }, armies: [...men(), ...men()] }, first],
    ['Explorer 7 trained', { skills: { explorer: 7 } }, first],
    [
      'a sea sailed into at Naval 6, leading a fleet',
      { location: sea['id'], skills: { naval: 6 }, armies: fleet() },
      open,
    ],
  ];
  const sailed: AStagedMarchIn[] = marchesIn.map(([kind, fields, to]) => ({
    kind,
    heroId: hero({ location: start['id'], ...fields })['id'],
    orders: into(to),
    mapped: to['id'],
  }));
  // the coast beside the sea he sails into (Naval 6's charting): the province the share is read of, not the one entered;
  // the coast in his realm's list, so its report shows the sea's ground (the unknown tier's is null: P1-11e13)
  const charting = sailed.find((x) => x.kind === 'a sea sailed into at Naval 6, leading a fleet');
  if (!charting) throw new Error('the staged world has no sailor');
  const everyMarchIn: AStagedMarchIn[] = [
    ...sailed,
    {
      ...charting,
      kind: 'the coast beside the sea he sails into, charted at Naval 6',
      mapped: coast['id'],
      realm: { itsRealmListsAlso: coast['id'] },
    },
    // (and of the provinces the voyage charts none: a land province not beside the sea, the sea he set out from)
    {
      ...charting,
      kind: 'a land province not beside the sea he sails into, at Naval 6',
      mapped: start['id'],
      realm: { itsRealmListsAlso: coast['id'] },
    },
    {
      ...charting,
      kind: 'the sea he sets out from, beside the sea he sails into at Naval 6',
      mapped: sea['id'],
      realm: { itsRealmListsAlso: coast['id'] },
    },
    // (a column with no ships charts none: the Eagle Riders carry him over the sea)
    {
      kind: 'the coast beside the sea he flies into at Naval 6, leading Eagle Riders and no ships',
      heroId: hero({
        location: sea['id'],
        skills: { naval: 6 },
        armies: [{ type: 'Eagle Riders', quality: 'Average', unitName: 'Eagle Riders 0' }],
      })['id'],
      orders: into(open),
      mapped: coast['id'],
      realm: { itsRealmListsAlso: coast['id'] },
    },
  ];
  return { world: quietly(() => savedAndReported(g)), marches, marchesIn: everyMarchIn };
}
/** Where the turn leaves the hero `heroId` after `orders`, one a phase (processOrder, as the phase loop calls it), on a
 *  copy of the state (or on the state itself, `inPlace`): the id of his province. */
function whereTheTurnLeavesHim(
  state: Obj,
  heroId: unknown,
  orders: readonly AnOrder[],
  {
    inPlace = false,
    declarations = {},
  }: { inPlace?: boolean; declarations?: Record<number, Record<string, string>> } = {},
): unknown {
  return whatTheTurnDoesWithHim(state, heroId, orders, { inPlace, declarations }).location;
}
/** Where the turn leaves the hero `heroId` after `orders` (as whereTheTurnLeavesHim), and every fact its lines record:
 *  the realms' declarations of war this turn (by realm, then by the realm it is toward) taken first, as the turn's step
 *  before the first phase takes them (an Evil or Undead realm's war stands from that phase). */
function whatTheTurnDoesWithHim(
  state: Obj,
  heroId: unknown,
  orders: readonly { readonly action: string; readonly target: string; readonly prov?: unknown }[],
  {
    inPlace = false,
    declarations = {},
  }: { inPlace?: boolean; declarations?: Record<number, Record<string, string>> } = {},
): { location: unknown; facts: string[] } {
  const G = inPlace ? state : copyOf(state);
  const c = objects(G['characters']).find((h) => h['id'] === heroId);
  if (!c) throw new Error('the staged march has no hero');
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], Number(G['turn']) || 1), { KC_SEASONS, isBotRow });
  tc['diploDeclarations'] = declarations;
  kcRng.seed(1);
  quietly(() => {
    warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages(tc);
    orders.forEach((order, ph) => {
      tc._currentPhase = ph;
      // (the staged world's context, hero and order, given the types the dispatch takes, by assertion as above)
      processOrder(tc as unknown as TurnContext, c as never, { ...order } as never, ph);
    });
  });
  const facts = objects(tc.turnLog).map((line) => {
    const fact = line['fact'];
    return isObj(fact) ? String(fact['kind']) : '';
  });
  return { location: c['location'], facts };
}
/** The world `world` with realm 0 changed toward realm 1 as `realm` says (P1-11e10): its creed, the two at war, and
 *  realm 0 having met realm 1 (unless `unmet`); since P1-11e12 a province realm 1 holds besides and one realm 0's own
 *  list holds besides. The report is made again from the state changed. */
function theWorldWithTheRealmChanged(world: World, realm: WhatAStagedMarchChangesOfTheRealm): World {
  const g = copyOf(world.state);
  const realms = objects(g['players']);
  const ours = realms[0];
  if (!ours) throw new Error('the staged world has no realm 0');
  ours['_encountered'] = realm.unmet ? [] : [1];
  if (realm.alignment) ours['alignment'] = realm.alignment;
  if (realm.itsRealmListsAlso !== undefined) {
    const listed: unknown[] = Array.isArray(ours['provinces']) ? ours['provinces'] : [];
    ours['provinces'] = [...listed, realm.itsRealmListsAlso];
  }
  if (realm.theNeutralRealmHolds !== undefined) {
    const held = objects(isObj(g['world']) ? g['world']['provinces'] : []).find(
      (p) => p['id'] === realm.theNeutralRealmHolds,
    );
    if (!held) throw new Error('the staged world has no province for the neutral realm to hold');
    held['owner'] = 1;
  }
  if (realm.atWar) g['relations'] = { ...(isObj(g['relations']) ? g['relations'] : {}), [relKeyOf(0, 1)]: 'enemy' };
  return quietly(() => savedAndReported(g));
}
/** The share of the province `mapped` realm 0 has mapped once the turn has carried out the hero's `orders` (as
 *  whereTheTurnLeavesHim), on a copy of the state where his realm had mapped none of it. */
function theShareTheTurnMaps(state: Obj, heroId: unknown, orders: readonly AnOrder[], mapped: unknown): number {
  const G = copyOf(state);
  const p = objects(isObj(G['world']) ? G['world']['provinces'] : []).find((x) => x['id'] === mapped);
  if (!p) throw new Error('the staged march has no province to map');
  p['exploredBy'] = {};
  p['explored'] = 0;
  whereTheTurnLeavesHim(G, heroId, orders, { inPlace: true });
  const by = p['exploredBy'];
  const share = isObj(by) ? by['0'] : undefined;
  return typeof share === 'number' ? share : 0;
}
/** One staged march into a province compared: the share of it the Explore forecast counts the march as mapping
 *  (exploreMoveGainBefore), and the share the turn maps; with its kind. */
export interface MarchInForecastComparison extends Comparison {
  readonly kind: TheMarchInKind;
}
/** The share of a province the Explore forecast counts each staged march as mapping, against what the turn maps. */
export function theMarchInForecastAgainstTheTurn(c: Copies): MarchInForecastComparison[] {
  const { world, marchesIn } = marchingWorld();
  return marchesIn.map(({ kind, heroId, orders, mapped, realm }) => {
    const on = realm ? theWorldWithTheRealmChanged(world, realm) : world;
    const hero = objects(on.report['characters']).find((h) => h['id'] === heroId);
    return {
      ...compare(
        [kind, orders, mapped],
        c.exploreMoveGainOn(on.report, { [String(heroId)]: orders }, hero, orders.length, mapped),
        { answer: theShareTheTurnMaps(on.state, heroId, orders, mapped), changed: false },
      ),
      kind,
    };
  });
}
/** The share of the coast the Explore forecast counts the Naval 6 voyage beside it as charting, and the share the turn
 *  charts, on the staged report where the sea he sails into is of the unknown tier (its ground null: a forecast limit,
 *  P1-11e13: the form can't tell it is a sea). */
export function theCoastBesideASeaTheReportShowsNoGroundOf(c: Copies): { forecast: unknown; turn: unknown } {
  const { world, marchesIn } = marchingWorld();
  const m = marchesIn.find((x) => x.kind === 'the coast beside the sea he sails into, charted at Naval 6');
  if (!m) throw new Error('the staged world has no voyage beside a coast');
  const hero = objects(world.report['characters']).find((h) => h['id'] === m.heroId);
  return {
    forecast: c.exploreMoveGainOn(world.report, { [String(m.heroId)]: m.orders }, hero, m.orders.length, m.mapped),
    turn: theShareTheTurnMaps(world.state, m.heroId, m.orders, m.mapped),
  };
}
/** The share of the province the Explore forecast counts the march of the hero wearing a Travelworn Drape as mapping,
 *  on the staged report and on a copy of it whose card of his gives no share of his worn items (a report older than
 *  the field, P1-11e8: a forecast limit, his items then add none); with the share of a march with no cloak. */
export function theMarchInShareOfAHeroWhoseCardGivesNoShareOfHisWornItems(c: Copies): {
  given: unknown;
  notGiven: unknown;
  noCloak: unknown;
} {
  const { world, marchesIn } = marchingWorld();
  const drape = marchesIn.find((m) => m.kind === 'a Travelworn Drape worn');
  const plain = marchesIn.find((m) => m.kind === 'March 0, leading two companies');
  if (!drape || !plain) throw new Error('the staged world has no march in with a Drape');
  const ask = (report: Obj, m: AStagedMarchIn) =>
    c.exploreMoveGainOn(
      report,
      { [String(m.heroId)]: m.orders },
      objects(report['characters']).find((h) => h['id'] === m.heroId),
      m.orders.length,
      m.mapped,
    );
  const older = copyOf(world.report);
  const hero = objects(older['characters']).find((h) => h['id'] === drape.heroId);
  if (!hero) throw new Error('the staged report has no hero wearing a Drape');
  delete hero['theShareHisWornItemsAddToAMarchIn'];
  return { given: ask(world.report, drape), notGiven: ask(older, drape), noCloak: ask(world.report, plain) };
}
/** One staged march compared: the province the forecast says he stands in after his orders, and the one the turn
 *  leaves him in; with its kind, where he set out and the province his orders name. */
export interface MarchForecastComparison extends Comparison {
  readonly kind: AKindOfMarch;
  readonly from: unknown;
  readonly named: unknown;
  /** Where his pace stops him (a march past it). */
  readonly stopsAt?: unknown;
  /** The provinces next door both to where he set out and to the one his orders name (a step toward it). */
  readonly nextDoorToBoth: unknown[];
}
/** Where the order form says each staged hero will stand after his orders (predictedLocation, which every later
 *  phase's form reads), against where the turn leaves him. */
export function theMarchForecastAgainstTheTurn(c: Copies): MarchForecastComparison[] {
  const { world, marches } = marchingWorld();
  const map = isObj(world.state['world']) ? world.state['world'] : {};
  const provinces = objects(map['provinces']);
  const nextTo = (id: unknown): unknown[] => {
    const p = provinces.find((x) => x['id'] === id);
    if (!p) return [];
    const at = { row: Number(p['row']), col: Number(p['col']) };
    return getNeighborsP(at, Number(map['cols']), Number(map['rows']), provinces).map((x) => x['id']);
  };
  return marches.map(({ kind, heroId, orders, from, named, stopsAt, realm }) => {
    const on = realm ? theWorldWithTheRealmChanged(world, realm) : world;
    const declarations = realm?.declaresWar ? { 0: { 1: 'enemy' } } : {};
    return {
      ...compare(
        [kind, orders],
        c.predictedLocationOn(on.report, { [String(heroId)]: orders }, heroId, orders.length, declarations[0]),
        { answer: whereTheTurnLeavesHim(on.state, heroId, orders, { declarations }), changed: false },
      ),
      kind,
      from,
      named,
      ...(stopsAt === undefined ? {} : { stopsAt }),
      nextDoorToBoth: nextTo(from).filter((id) => nextTo(named).includes(id)),
    };
  });
}
/** Where the order form says one staged hero will stand as his orders, his realm's declarations and the report change
 *  between one ask and the next (P1-11e10: the forecast keeps each answer while what it was worked out from stands): a
 *  province next door, then a neutral realm's border, then that border with an Evil realm's war declared, without it,
 *  on the first report again, and on a report where the two realms are at war. With where his orders name. */
export function theMarchForecastAsWhatItReadsChanges(c: Copies): {
  answers: unknown[];
  start: unknown;
  first: unknown;
  border: unknown;
} {
  const { world, marches } = marchingWorld();
  const march = marches.find((m) => m.kind === "a neutral realm's border");
  const nextDoor = marches.find((m) => m.kind === 'a province next door');
  if (!march || !nextDoor) throw new Error('no staged march to the border');
  const evil = theWorldWithTheRealmChanged(world, { alignment: 'Evil' });
  const atWar = theWorldWithTheRealmChanged(world, { atWar: true });
  const ask = (report: Obj, orders: readonly AnOrder[], declarations?: Record<string, string>) =>
    c.predictedLocationOn(report, { [String(march.heroId)]: orders }, march.heroId, orders.length, declarations);
  return {
    answers: [
      ask(world.report, nextDoor.orders),
      ask(world.report, march.orders),
      ask(evil.report, march.orders, { 1: 'enemy' }),
      ask(evil.report, march.orders),
      ask(world.report, march.orders),
      ask(atWar.report, march.orders),
    ],
    start: march.from,
    first: nextDoor.named,
    border: march.named,
  };
}
/** Where the order form says the hero ordered past his pace (on land) will stand, on the report changed as the form
 *  holds a hero who joins this turn (hired, charmed or raised: in a phase of this turn, his pace the page's) and as a
 *  report that shows no pace of his (P1-11e11: neither gives the turn's pools, so neither stops him); with the province
 *  his orders name and the one his pace stops him in. */
export function theMarchPastHisPaceOfAHeroTheReportShowsNoPaceOf(c: Copies): {
  joined: unknown;
  noPace: unknown;
  named: unknown;
  stopsAt: unknown;
} {
  const { world, marches } = marchingWorld();
  const march = marches.find((m) => m.kind === 'past his pace');
  if (!march) throw new Error('no staged march past his pace');
  const ask = (change: (hero: Obj) => void) => {
    const report = copyOf(world.report);
    const hero = objects(report['characters']).find((h) => h['id'] === march.heroId);
    if (!hero) throw new Error('the staged report has no hero marching past his pace');
    change(hero);
    return c.predictedLocationOn(report, { [String(march.heroId)]: march.orders }, march.heroId, march.orders.length);
  };
  return {
    joined: ask((hero) => {
      hero['hiredInPhase'] = 0;
    }),
    noPace: ask((hero) => {
      delete hero['effectiveSpeed'];
      delete hero['effectiveSeaSpeed'];
    }),
    named: march.named,
    stopsAt: march.stopsAt,
  };
}
/** One staged march the turn refuses, with a Search Lair after it (P1-11e10; since P1-11e11 one his pace stops too):
 *  the province the Search Lair the form sends names (doSubmitOrders sends predictedLocation's), where the turn leaves
 *  the hero, and whether the turn sends him to rest because he never reached the lair's province. */
export interface ASearchLairAfterARefusedMarch {
  readonly kind: (typeof THE_MARCHES_A_SEARCH_LAIR_FOLLOWS)[number];
  readonly sent: unknown;
  readonly heStands: unknown;
  readonly heNeverReachesTheLair: boolean;
}
/** Each staged march the turn refuses, followed by a Search Lair, as the form sends it and as the turn carries it out. */
export function aSearchLairAfterEachMarchTheTurnRefuses(c: Copies): ASearchLairAfterARefusedMarch[] {
  const { world, marches } = marchingWorld();
  return THE_MARCHES_A_SEARCH_LAIR_FOLLOWS.map((kind) => {
    const march = marches.find((m) => m.kind === kind);
    if (!march) throw new Error(`no staged march of the kind ${kind}`);
    const { heroId, orders, realm } = march;
    const on = realm ? theWorldWithTheRealmChanged(world, realm) : world;
    const declarations = realm?.declaresWar ? { 0: { 1: 'enemy' } } : {};
    const sent = c.predictedLocationOn(on.report, { [String(heroId)]: orders }, heroId, orders.length, declarations[0]);
    const search = { action: 'Search Lair', target: '', prov: sent };
    const turn = whatTheTurnDoesWithHim(on.state, heroId, [...orders, search], { declarations });
    return {
      kind,
      sent,
      heStands: turn.location,
      heNeverReachesTheLair: turn.facts.includes('a hero never reaches the lair he set out for and rests instead'),
    };
  });
}
// ── What a hero holds (P1-11d2) ────
// Plan P1-11d's parity cases on what a hero will carry and lead, before any of it is shared: the items in his pack
// (predictedItems, which every later phase's Send Item, Equip Items and Use Item fields read), the companies he leads
// (projectedLedArmies, which the Leave/Transfer, Disband and Blood Offering fields and the Move note read) and those a
// province holds unled (projectedGarrison, which the Pick Up field reads), with the units a Recruit musters
// (_projRecruitUnits) and which of them go to the garrison (_isAutoGarrisonRecruit). Each runs as the portal's own code,
// on the orders staged in its fields; the turn's side is its phases, played one at a time as its loop plays them. Where
// the forecast disagrees with the turn (question 42), the difference is pinned exactly: each case says which kind it is.

/** The kinds of staged holding: those the forecast and the turn agree on, and those it is known to get wrong (question
 *  42): an item handed to a comrade who marches in that phase (the turn hands it over at once, the form sends it by courier), a chain of hand-overs in
 *  one phase (the turn hands over in its own order, the form by the heroes' order), the Philosopher's Stone used (the
 *  turn destroys it), a beast recruited, handed over or taken up past a leader's beast command (the turn puts it in
 *  the garrison or leaves it where it was), a band of garrison troops hired (the turn musters it into the garrison),
 *  companies taken up from the garrison (the turn adds them last first), and risen dead handed to a comrade of a realm
 *  that is not Undead (the turn keeps them with the giver; the form's companies carry no risen mark). */
export const THE_HOLDINGS_THE_FORECAST_GETS_RIGHT = [
  'items handed to a comrade beside him',
  'an item sent by courier to a comrade elsewhere',
  'an item handed over, then passed on',
  'a mercenary band and a company of the province recruited',
  'a garrison company recruited',
  'companies recruited into the garrison',
  "companies recruited under a comrade's banner",
  'a company handed to a comrade beside him',
  'a company left in the garrison, then taken up by a comrade next season',
  'a company taken up as a comrade leaves it, in the same phase',
  'a company disbanded',
  // (P1-11e18, R-129: a Mithril suit sent with "all" stays on its wearer, as the turn keeps it)
  'Mithril Armour sent with "all"',
  // (P1-11e17: the forecasts' replay, each red on a fault planted in it)
  'an item handed over by its name',
  'every company left in the garrison',
  'a company left in the garrison by its type',
  'every company handed to a comrade beside him',
] as const;
export const THE_HOLDINGS_THE_FORECAST_GETS_WRONG = [
  'an item handed to a comrade marching in',
  'a chain of hand-overs in one phase',
  "the Philosopher's Stone used",
  'a beast recruited past his beast command',
  'a band of garrison troops hired',
  'companies taken up from the garrison by their places',
  'the whole garrison taken up',
  'risen dead handed to a comrade',
  'a beast handed to a comrade at his beast command',
  'a beast taken up past his beast command',
] as const;
export type AKindOfHolding =
  (typeof THE_HOLDINGS_THE_FORECAST_GETS_RIGHT)[number] | (typeof THE_HOLDINGS_THE_FORECAST_GETS_WRONG)[number];
/** An order of a phase, as the page's fields hold it and the turn reads it: its action, its target and its extra (a
 *  recipient or a comrade; none, the empty field). */
interface AnOrderOfWhatAHeroHolds {
  readonly action:
    | 'Send Item'
    | 'Use Item'
    | 'Move'
    | 'Recruit Armies'
    | 'Leave/Transfer Army'
    | 'Pick Up Army'
    | 'Disband Army'
    | 'Rest';
  readonly target: string;
  readonly extra?: string;
}
/** What a staged holding reads: for each of its heroes (by his part in the case) his items or his companies, and the
 *  garrison of its province. */
export type WhatTheyHold = Record<string, string[]>;
/** A staged holding: its kind, whether it reads items or companies, its heroes by their part (realm 0's), their
 *  orders by hero then phase, and the province whose garrison it reads (or none). */
export interface AStagedHolding {
  readonly kind: AKindOfHolding;
  readonly reads: 'items' | 'companies';
  readonly heroes: Record<string, unknown>;
  readonly orders: Record<string, readonly AnOrderOfWhatAHeroHolds[]>;
  readonly province: unknown;
}
/** A company, as both sides are read: its type and quality, and "(risen)" when it is marked as risen dead. */
function aCompany(a: unknown): string {
  const u = isObj(a) ? a : {};
  return `${String(u['type'])} (${String(u['quality'])})${u['_isSkeletal'] ? ' (risen)' : ''}`;
}
/** The world staged for what a hero holds (P1-11d2): as marchingWorld's (every land province no realm holds realm 0's,
 *  its guards and neutral heroes gone), realm 0 rich enough for any Recruit, and each case on its own province (two
 *  next door for the comrade marching in), its heroes copies of realm 0's king (a Human of a Good realm, Druid 0)
 *  standing there. */
export function holdingWorld(): { world: World; holdings: AStagedHolding[] } {
  const { g, king } = aWorldToStageIn();
  const map = isObj(g['world']) ? g['world'] : {};
  const [cols, rows] = [Number(map['cols']), Number(map['rows'])];
  const provinces = objects(map['provinces']);
  const isLand = (p: Obj) => p['terrain'] !== 'sea';
  for (const p of provinces.filter(isLand)) {
    p['owner'] ??= 0;
    p['npcArmies'] = [];
    p['neutralDefenders'] = [];
  }
  // (in place: the staged heroes join this list, each at the place his id names, as the army orders read a comrade by
  // it; so the heroes no realm holds keep their places, gone from the map as marchingWorld's are: no case meets one)
  const characters: unknown[] = Array.isArray(g['characters']) ? g['characters'] : [];
  if (objects(characters).some((h, i) => h['id'] !== i))
    throw new Error("the staged world's heroes are not in id order");
  const realmless = new Set(
    objects(characters)
      .filter((h) => h['player'] == null)
      .map((h) => h['id']),
  );
  for (const h of objects(characters)) if (realmless.has(h['id'])) h['alive'] = false;
  for (const p of provinces)
    p['characters'] = (Array.isArray(p['characters']) ? p['characters'] : []).filter((id) => !realmless.has(id));
  const realm = objects(g['players'])[0];
  if (!realm) throw new Error('the staged world has no realm 0');
  realm['gold'] = 1000;
  realm['provinces'] = provinces.filter((p) => isLand(p) && p['owner'] === 0).map((p) => p['id']);
  const free = provinces.filter((p) => isLand(p) && p['owner'] === 0 && p['id'] !== king['location']);
  const take = (p: Obj) => {
    free.splice(free.indexOf(p), 1);
    p['garrisonArmies'] = [];
    return p;
  };
  const aProvince = () => {
    const p = free[0];
    if (!p) throw new Error('the staged world has too few provinces for the holdings');
    return take(p);
  };
  // the province he hands an item over in, and the one next door his comrade marches in from
  const nextTo = (p: Obj) => getNeighborsP({ row: Number(p['row']), col: Number(p['col']) }, cols, rows, provinces);
  const pair = free.flatMap((p) =>
    nextTo(p)
      .filter((q) => free.includes(q) && q !== p)
      .map((q) => [p, q]),
  )[0];
  if (!pair) throw new Error('the staged world has no two free provinces next door');
  const [meeting, nextDoor] = [take(pair[0] ?? {}), take(pair[1] ?? {})];
  const items = catalogue().filter((it) => !anItemIsTheMithrilSuit(it) && it['name'] !== "Philosopher's Stone");
  let itemId = 63_000;
  const anItem = (it: Obj | undefined) => {
    if (!it) throw new Error('the catalogue has too few items');
    return { ...copyOf(it), id: itemId++ };
  };
  const [first, second, third, fourth] = [anItem(items[0]), anItem(items[1]), anItem(items[2]), anItem(items[3])];
  // the Philosopher's Stone as an older save's copy carries it, the copy Use Item works (the relic a lair deals today
  // carries a power nothing reads: Parked "A Philosopher's Stone can never be worked")
  const stone = {
    ...anItem(catalogue().find((it) => it['name'] === "Philosopher's Stone")),
    effect: { stat: 'massPromote' },
  };
  const mithril = anItem(catalogue().find(anItemIsTheMithrilSuit));
  const classes: Record<string, readonly string[]> = KC_UNIT_CLASS;
  const beast = classes['creature']?.[0];
  const garrisonType = 'Human Garrison';
  if (!beast || !(classes['garrison'] ?? []).includes(garrisonType))
    throw new Error('the unit classes have no creature or no Human Garrison');
  let unitN = 0;
  const unit = (type: string, quality = 'Average', fields: Obj = {}): Obj => ({
    type,
    quality,
    race: 'Human',
    unitName: `${type} ${String(unitN++)}`,
    ...fields,
  });
  // the province's companies a Recruit may raise, and a band roaming it
  const offering = (p: Obj, ...types: string[]) => {
    p['armyTypes'] = types;
    return p;
  };
  const band = (p: Obj, type: string, quality: string) => {
    const m = { ...unit(type, quality), id: `merc_staged_${String(unitN)}`, location: p['id'], isSea: false };
    g['mercenaries'] = [...objects(g['mercenaries']), m];
    return m.id;
  };
  // a hero of realm 0 standing in the province: a copy of its king, his id his place in the list
  const at = (p: Obj, fields: Obj = {}): number => {
    const id = characters.length;
    const h: Obj = { ...copyOf(king), isKing: false, items: [], armies: [], skills: {}, ...fields, id };
    h['name'] = `Staged ${String(id)}`;
    h['location'] = p['id'];
    characters.push(h);
    p['characters'] = [...(Array.isArray(p['characters']) ? (p['characters'] as unknown[]) : []), id];
    return id;
  };
  const id = (x: unknown) => String(x);
  const send = (target: string, to: unknown): AnOrderOfWhatAHeroHolds => ({
    action: 'Send Item',
    target,
    extra: id(to),
  });
  const recruit = (...ticks: string[]): AnOrderOfWhatAHeroHolds => ({
    action: 'Recruit Armies',
    target: ticks.join(','),
  });
  const leave = (target: string, to = ''): AnOrderOfWhatAHeroHolds => ({
    action: 'Leave/Transfer Army',
    target,
    extra: to,
  });
  const pickUp = (target: string): AnOrderOfWhatAHeroHolds => ({ action: 'Pick Up Army', target });
  const rest: AnOrderOfWhatAHeroHolds = { action: 'Rest', target: '' };
  const holdings: AStagedHolding[] = [];
  const stage = (
    kind: AKindOfHolding,
    reads: AStagedHolding['reads'],
    province: Obj | null,
    heroes: Record<string, unknown>,
    orders: Record<string, readonly AnOrderOfWhatAHeroHolds[]>,
  ) => holdings.push({ kind, reads, heroes, orders, province: province ? province['id'] : null });
  {
    const p = aProvince();
    const [giver, comrade] = [at(p, { items: [first, second, third] }), at(p)];
    stage(
      'items handed to a comrade beside him',
      'items',
      null,
      { giver, comrade },
      { [id(giver)]: [send('0,2', comrade)] },
    );
  }
  {
    const [p, q] = [aProvince(), aProvince()];
    const [giver, comrade] = [at(p, { items: [anItem(items[0])] }), at(q)];
    stage(
      'an item sent by courier to a comrade elsewhere',
      'items',
      null,
      { giver, comrade },
      {
        [id(giver)]: [send('0', comrade)],
      },
    );
  }
  {
    const p = aProvince();
    const [giver, comrade, third_] = [
      at(p, { items: [anItem(items[0])] }),
      at(p, { items: [anItem(items[1])] }),
      at(p),
    ];
    stage(
      'an item handed over, then passed on',
      'items',
      null,
      { giver, comrade, 'the third': third_ },
      {
        [id(giver)]: [send('0', comrade)],
        [id(comrade)]: [rest, send('1', third_)],
      },
    );
  }
  {
    const p = offering(aProvince(), 'Shieldwall Levies');
    const merc = band(p, 'Men-at-Arms', 'Veteran');
    const recruiter = at(p);
    stage(
      'a mercenary band and a company of the province recruited',
      'companies',
      p,
      { recruiter },
      {
        [id(recruiter)]: [recruit('Shieldwall Levies|1', `merc:${merc}`)],
      },
    );
  }
  {
    const p = offering(aProvince(), garrisonType, 'Shieldwall Levies');
    const recruiter = at(p);
    stage(
      'a garrison company recruited',
      'companies',
      p,
      { recruiter },
      {
        [id(recruiter)]: [recruit(`${garrisonType}|1`, 'Shieldwall Levies|1')],
      },
    );
  }
  {
    const p = offering(aProvince(), 'Shieldwall Levies');
    const recruiter = at(p);
    stage(
      'companies recruited into the garrison',
      'companies',
      p,
      { recruiter },
      {
        [id(recruiter)]: [recruit('Shieldwall Levies|1', 'to:garrison')],
      },
    );
  }
  {
    const p = offering(aProvince(), 'Shieldwall Levies');
    const [recruiter, comrade] = [at(p), at(p)];
    stage(
      "companies recruited under a comrade's banner",
      'companies',
      p,
      { recruiter, comrade },
      {
        [id(recruiter)]: [recruit('Shieldwall Levies|1', `to:${id(comrade)}`)],
      },
    );
  }
  {
    const p = aProvince();
    const handed = unit('Men-at-Arms');
    const [giver, comrade] = [
      at(p, { armies: [unit('Shieldwall Levies'), handed] }),
      at(p, { armies: [unit('Longbowmen')] }),
    ];
    stage(
      'a company handed to a comrade beside him',
      'companies',
      p,
      { giver, comrade },
      {
        [id(giver)]: [leave(String(handed['unitName']), id(comrade))],
      },
    );
  }
  {
    const p = aProvince();
    p['garrisonArmies'] = [unit('Longbowmen')];
    const left = unit('Men-at-Arms');
    const [leader, comrade] = [at(p, { armies: [unit('Shieldwall Levies'), left] }), at(p)];
    stage(
      'a company left in the garrison, then taken up by a comrade next season',
      'companies',
      p,
      { leader, comrade },
      {
        [id(leader)]: [leave(String(left['unitName']))],
        [id(comrade)]: [rest, pickUp('g:1')],
      },
    );
  }
  {
    const p = aProvince();
    const left = unit('Men-at-Arms');
    // (the one who takes it up is the earlier hero: the turn's wait alone puts the one who leaves it first)
    const taker = at(p);
    const leaver = at(p, { armies: [left] });
    stage(
      'a company taken up as a comrade leaves it, in the same phase',
      'companies',
      p,
      { leaver, taker },
      {
        [id(leaver)]: [leave(String(left['unitName']))],
        [id(taker)]: [pickUp('g:0')],
      },
    );
  }
  {
    const p = aProvince();
    const gone = unit('Men-at-Arms');
    const leader = at(p, { armies: [gone, unit('Shieldwall Levies')] });
    stage(
      'a company disbanded',
      'companies',
      p,
      { leader },
      {
        [id(leader)]: [{ action: 'Disband Army', target: String(gone['unitName']) }],
      },
    );
  }
  {
    const p = aProvince();
    const [giver, comrade] = [at(p, { items: [mithril, anItem(items[0])] }), at(p)];
    stage('Mithril Armour sent with "all"', 'items', null, { giver, comrade }, { [id(giver)]: [send('all', comrade)] });
  }
  // the ones the forecast gets wrong (question 42)
  {
    const [giver, comrade] = [at(meeting, { items: [fourth] }), at(nextDoor)];
    stage(
      'an item handed to a comrade marching in',
      'items',
      null,
      { giver, comrade },
      {
        [id(giver)]: [send('0', comrade)],
        [id(comrade)]: [{ action: 'Move', target: `prov:${id(meeting['id'])}` }],
      },
    );
  }
  {
    // the first to hand over is the later hero (the form takes them in the report's order, by their ids)
    const p = aProvince();
    const [between, last] = [at(p, { items: [anItem(items[1])] }), at(p)];
    const firstToHand = at(p, { items: [anItem(items[0])] });
    stage(
      'a chain of hand-overs in one phase',
      'items',
      null,
      { 'the first to hand over': firstToHand, between, last },
      {
        [id(firstToHand)]: [send('all', between)],
        [id(between)]: [send('all', last)],
      },
    );
  }
  {
    // (a company of the realm for it to raise a tier, so it is spent)
    const p = aProvince();
    const bearer = at(p, { items: [stone], armies: [unit('Men-at-Arms')] });
    stage(
      "the Philosopher's Stone used",
      'items',
      null,
      { bearer },
      {
        [id(bearer)]: [{ action: 'Use Item', target: id(stone.id) }],
      },
    );
  }
  {
    const p = offering(aProvince(), beast);
    const recruiter = at(p);
    stage(
      'a beast recruited past his beast command',
      'companies',
      p,
      { recruiter },
      {
        [id(recruiter)]: [recruit(`${beast}|1`)],
      },
    );
  }
  {
    const p = aProvince();
    const merc = band(p, garrisonType, 'Veteran');
    const recruiter = at(p);
    stage(
      'a band of garrison troops hired',
      'companies',
      p,
      { recruiter },
      {
        [id(recruiter)]: [recruit(`merc:${merc}`)],
      },
    );
  }
  {
    const p = aProvince();
    p['garrisonArmies'] = [unit('Men-at-Arms'), unit('Shieldwall Levies')];
    const taker = at(p);
    stage(
      'companies taken up from the garrison by their places',
      'companies',
      p,
      { taker },
      {
        [id(taker)]: [pickUp('g:0,g:1')],
      },
    );
  }
  {
    const p = aProvince();
    p['garrisonArmies'] = [unit('Men-at-Arms'), unit('Shieldwall Levies')];
    const taker = at(p);
    stage('the whole garrison taken up', 'companies', p, { taker }, { [id(taker)]: [pickUp('all')] });
  }
  {
    const p = aProvince();
    const risen = unit('Men-at-Arms', 'Average', { _isSkeletal: true });
    const [giver, comrade] = [at(p, { armies: [risen] }), at(p)];
    stage(
      'risen dead handed to a comrade',
      'companies',
      p,
      { giver, comrade },
      {
        [id(giver)]: [leave(String(risen['unitName']), id(comrade))],
      },
    );
  }
  {
    const p = aProvince();
    const wild = unit(beast);
    const [giver, comrade] = [at(p, { armies: [wild] }), at(p)];
    stage(
      'a beast handed to a comrade at his beast command',
      'companies',
      p,
      { giver, comrade },
      {
        [id(giver)]: [leave(String(wild['unitName']), id(comrade))],
      },
    );
  }
  {
    const p = aProvince();
    p['garrisonArmies'] = [unit(beast)];
    const taker = at(p);
    stage('a beast taken up past his beast command', 'companies', p, { taker }, { [id(taker)]: [pickUp('g:0')] });
  }
  {
    const p = aProvince();
    const [giver, comrade] = [at(p, { items: [anItem(items[0]), anItem(items[1])] }), at(p)];
    stage(
      'an item handed over by its name',
      'items',
      null,
      { giver, comrade },
      { [id(giver)]: [send(String(items[1]?.['name']), comrade)] },
    );
  }
  {
    const p = aProvince();
    p['garrisonArmies'] = [unit('Longbowmen')];
    const leader = at(p, { armies: [unit('Shieldwall Levies'), unit('Men-at-Arms')] });
    stage('every company left in the garrison', 'companies', p, { leader }, { [id(leader)]: [leave('all')] });
  }
  {
    // (the garrison alone is read: the form keeps a company left by its type with its leader, Parked)
    const p = aProvince();
    const leader = at(p, { armies: [unit('Shieldwall Levies'), unit('Men-at-Arms')] });
    stage('a company left in the garrison by its type', 'companies', p, {}, { [id(leader)]: [leave('Men-at-Arms')] });
  }
  {
    const p = aProvince();
    const [giver, comrade] = [
      at(p, { armies: [unit('Shieldwall Levies'), unit('Men-at-Arms')] }),
      at(p, { armies: [unit('Longbowmen')] }),
    ];
    stage(
      'every company handed to a comrade beside him',
      'companies',
      p,
      { giver, comrade },
      { [id(giver)]: [leave('all', id(comrade))] },
    );
  }
  return { world: quietly(() => savedAndReported(g)), holdings };
}
/** What the heroes of `holding` and its province's garrison hold in the state `G`: each item's name, or each
 *  company. */
function whatTheyHoldIn(G: Obj, holding: AStagedHolding): WhatTheyHold {
  const heroes = new Map(objects(G['characters']).map((h) => [h['id'], h]));
  const out: WhatTheyHold = {};
  for (const [part, heroId] of Object.entries(holding.heroes)) {
    const h = heroes.get(heroId) ?? {};
    out[part] =
      holding.reads === 'items'
        ? objects(h['items']).map((it) => String(it['name']))
        : objects(h['armies']).map(aCompany);
  }
  if (holding.province != null) {
    const p = objects(isObj(G['world']) ? G['world']['provinces'] : []).find((x) => x['id'] === holding.province);
    out['the garrison'] = objects(p?.['garrisonArmies']).map(aCompany);
  }
  return out;
}
/** The phases a holding's orders fill. */
const phasesOf = (holding: AStagedHolding) => Math.max(...Object.values(holding.orders).map((list) => list.length));
/** An order of a hero, by phase, as the page's fields hold it (its extra: none, the empty field). */
interface AnOrderInItsFields {
  readonly action: string;
  readonly target: string;
  readonly extra?: string;
}
/** The state once the turn has played the phases of the orders (each hero's, by phase), one a phase, as its loop
 *  plays them (the four stages of each: its start, the heroes' intents and the reactions to them, their orders in two
 *  tiers around the Defend step, its end), on a copy of the state: its heroes' move pools set as the turn sets them
 *  first; and the facts of the lines it writes. */
function theTurnPlaysThePhases(
  state: Obj,
  orders: Readonly<Record<string, readonly AnOrderInItsFields[]>>,
): { G: Obj; facts: Obj[] } {
  const G = copyOf(state);
  G['turnOrders'] = Object.fromEntries(
    Object.entries(orders).map(([heroId, list]) => [
      heroId,
      list.map((o) => ({ action: o.action, target: o.target, extra: o.extra ?? '', desc: o.action })),
    ]),
  );
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], Number(G['turn']) || 1), { KC_SEASONS, isBotRow });
  kcRng.seed(1);
  const phases = Math.max(0, ...Object.values(orders).map((list) => list.length));
  quietly(() => {
    for (const c of objects(G['characters']).filter((h) => h['player'] != null && h['alive']))
      setMovePool(tc as unknown as TurnContext, c as never);
    for (let ph = 0; ph < phases; ph++) {
      tc._currentPhase = ph;
      const startedAt = Object.fromEntries(
        objects(G['characters']).map((h) => [String(h['id']), h['location']]),
      ) as Parameters<typeof endPhaseSkillRisesFallenCommandersAndProvinceMemory>[2];
      const theStagesContext = tc as unknown as TurnContext;
      startPhaseHealingSnapshotsAndStalledBattles(theStagesContext, ph);
      const intents = buildPhaseIntents(theStagesContext, ph);
      pinAndReactToPhaseIntents(theStagesContext, ph, intents);
      resolvePhaseOrdersInTwoTiersAroundTheDefendStep(theStagesContext, ph, intents);
      endPhaseSkillRisesFallenCommandersAndProvinceMemory(theStagesContext, ph, startedAt);
    }
  });
  return { G, facts: tc.turnLog.map((l) => (isObj(l['fact']) ? l['fact'] : {})) };
}
/** The state once the turn has played the phases of the holding's orders (theTurnPlaysThePhases). */
function theTurnPlaysTheHolding(state: Obj, holding: AStagedHolding): Obj {
  return theTurnPlaysThePhases(state, holding.orders).G;
}
/** One staged holding compared: what the forecast says its heroes and its garrison hold once its orders are carried
 *  out, and what the turn leaves them; with its kind and what they held before. */
export interface HoldingComparison extends Comparison {
  readonly kind: AKindOfHolding;
  readonly before: WhatTheyHold;
}
/** What the order form says each staged holding's heroes and garrison will hold after their orders (predictedItems,
 *  projectedLedArmies, projectedGarrison, as the phase after them begins), against what the turn leaves them. */
export function whatAHeroHoldsAgainstTheTurn(c: Copies): HoldingComparison[] {
  const { world, holdings } = holdingWorld();
  return holdings.map((holding) => {
    const upTo = phasesOf(holding);
    const forecast: WhatTheyHold = {};
    for (const [part, heroId] of Object.entries(holding.heroes)) {
      const held =
        holding.reads === 'items'
          ? c.predictedItemsOn(world.report, holding.orders, heroId, upTo)
          : c.projectedLedArmiesOn(world.report, holding.orders, heroId, upTo);
      forecast[part] = (Array.isArray(held) ? held : []).map((x) =>
        holding.reads === 'items' ? String(x) : aCompany(x),
      );
    }
    if (holding.province != null) {
      const held = c.projectedGarrisonOn(world.report, holding.orders, holding.province, upTo);
      forecast['the garrison'] = (Array.isArray(held) ? held : []).map(aCompany);
    }
    return {
      ...compare([holding.kind, holding.orders], forecast, {
        answer: whatTheyHoldIn(theTurnPlaysTheHolding(world.state, holding), holding),
        changed: false,
      }),
      kind: holding.kind,
      before: whatTheyHoldIn(world.state, holding),
    };
  });
}
/** The companies the Pick Up field offers the hero who takes up a company as a comrade leaves it, in the same phase
 *  (projectedGarrison with the leaves of its own phase: P1-11e17), and those the turn gives him. */
export function thePickUpFieldAsAComradeLeavesAgainstTheTurn(c: Copies): { field: string[]; turn: string[] } {
  const { world, holdings } = holdingWorld();
  const holding = holdings.find((h) => h.kind === 'a company taken up as a comrade leaves it, in the same phase');
  if (!holding) throw new Error('no staged holding of a company taken up as a comrade leaves it');
  const field = c.thePickUpFieldsGarrisonOn(world.report, holding.orders, holding.province, 0, holding.heroes['taker']);
  return {
    field: (Array.isArray(field) ? field : []).map(aCompany),
    turn: whatTheyHoldIn(theTurnPlaysTheHolding(world.state, holding), holding)['taker'] ?? [],
  };
}
/** What the army card's sea note tells the player, in the engine's words (getSeaCapability's answers): 'all' (every
 *  unit sails or flies on its own), 'sea' (the column can put to sea: its hulls carry it, or its flyers lift it and
 *  the card shows no note), 'land' (it needs more fleet units). */
function seaNoteVerdict(note: unknown): string {
  const words = String(note);
  if (words === '') return 'sea';
  if (words.includes('every unit sails or flies on its own')) return 'all';
  if (words.includes('can put to sea')) return 'sea';
  if (words.includes('more fleet unit')) return 'land';
  return `(a note the check doesn't know: ${words})`;
}
/** One sea case compared, and the hero's trained Naval (at 8 or more, his mastery doubles a hull). */
export interface SeaNoteComparison extends Comparison {
  readonly naval: number;
}
/** The army card's sea-transport note, read by its statements, against getSeaCapability, on every column of the
 *  realm's heroes. */
export function armyCardSeaNoteAgainstTheEngine(c: Copies, s: Samples): SeaNoteComparison[] {
  return withState(s.heroes)
    .filter((h) => objects(h.report['armies']).length > 0)
    .map((h) => {
      const armies = objects(h.state['armies']);
      return {
        ...compare(
          [objects(h.report['armies']).map((a) => a['type']), skillOf(h.state, 'naval')],
          seaNoteVerdict(c.armyCardSeaNote(h.report['armies'], h.report)),
          engineOn(getSeaCapability, [armies, h.state]),
        ),
        naval: skillOf(h.state, 'naval'),
      };
    });
}

// ── The order form's Cast Spell tables and checks, and the army card's kin and feud (P1-11c1) ────
// Plan P1-11c's parity cases, before the form takes its tables and its check from the engine's side (P1-11c2 to c5).
// The truth, as above: the form's copy on what the realm's report holds, against the content's spells (SPELL_DEFS_P)
// or the engine's function on the state. The Warlock's extra cast agrees since R-123, the army card's kin and feud since
// R-122, a Grand Cathedral's free Bless Province since R-124.

/** A spell as the content's table (SPELL_DEFS_P) writes what the order form reads of it. */
interface ASpellAsTheFormReadsIt {
  readonly school: string;
  readonly target?: string;
  readonly encounter?: boolean;
  readonly phase?: boolean;
  readonly reqLevel?: number;
}
const THE_SPELLS: [string, ASpellAsTheFormReadsIt][] = Object.entries(
  SPELL_DEFS_P as Record<string, ASpellAsTheFormReadsIt>,
);
/** The spells the content's table writes as `keep` says, in its order. */
const spellsThat = (keep: (d: ASpellAsTheFormReadsIt) => boolean | undefined) =>
  THE_SPELLS.filter(([, d]) => keep(d)).map(([name]) => name);
/** The spells named, by school, each school in the order its first spell comes, its spells in the table's order. */
function bySchool(names: readonly string[]): Record<string, string[]> {
  const schools: Record<string, string[]> = {};
  for (const name of names) {
    const school = THE_SPELLS.find(([n]) => n === name)?.[1].school ?? '(no school)';
    (schools[school] ??= []).push(name);
  }
  return schools;
}

/** How a table is compared: in its order (a list the form shows in its order), as a map (each key's value, whatever the
 *  keys' order), as a set (the form only asks whether a spell is in it), or by school as sets (each school in its order,
 *  its spells whatever their order). */
type HowATableIsCompared = 'in order' | 'as a map' | 'as a set' | 'by school, as sets';
const HOW_EACH_TABLE_IS_COMPARED: Record<keyof TheOrderFormsSpellTables, HowATableIsCompared> = {
  SPELLS_BY_SCHOOL: 'in order',
  SPELL_TO_SCHOOL: 'as a map',
  SPELL_REQ_LEVEL: 'as a map',
  PHASE_SPELLS: 'in order',
  _hsPhase: 'in order',
  ENCOUNTER_VALID: 'by school, as sets',
  NEEDS_PROV: 'as a set',
  NEEDS_CHAR: 'as a set',
};
/** A table as it is compared (`how`): the keys of a map sorted, a set's spells sorted, each school's spells sorted. */
function asCompared(how: HowATableIsCompared, table: unknown): unknown {
  const sorted = (x: unknown) => (Array.isArray(x) ? x.map(String).sort() : x);
  if (how === 'in order' || !isObj(table)) return how === 'as a set' ? sorted(table) : table;
  if (how === 'as a map') return Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : 1)));
  return Object.fromEntries(Object.entries(table).map(([school, spells]) => [school, sorted(spells)]));
}
/** The tables the content's spells (SPELL_DEFS_P) make of the order form's eight: every spell by school, each spell's
 *  school, the mastery spells' levels, the action spells, those offered a hero of unseen levels (an action spell with
 *  no mastery level), the combat spells by school, and the action spells aimed at a province and at a hero. */
export function theContentsSpellTables(): TheOrderFormsSpellTables {
  const everySpellBySchool = bySchool(spellsThat(() => true));
  return {
    SPELLS_BY_SCHOOL: everySpellBySchool,
    SPELL_TO_SCHOOL: Object.fromEntries(
      Object.entries(everySpellBySchool).flatMap(([school, spells]) => spells.map((name) => [name, school])),
    ),
    SPELL_REQ_LEVEL: Object.fromEntries(THE_SPELLS.flatMap(([name, d]) => (d.reqLevel ? [[name, d.reqLevel]] : []))),
    PHASE_SPELLS: spellsThat((d) => d.phase),
    _hsPhase: spellsThat((d) => d.phase && !d.reqLevel),
    ENCOUNTER_VALID: bySchool(spellsThat((d) => d.encounter)),
    NEEDS_PROV: spellsThat((d) => d.phase && d.target === 'province'),
    NEEDS_CHAR: spellsThat((d) => d.phase && d.target === 'character'),
  };
}
/** Each of the order form's eight Cast Spell tables, against the table the content's spells make of it, each compared
 *  as HOW_EACH_TABLE_IS_COMPARED says. */
export function theFormsSpellTablesAgainstTheContent(form: TheOrderFormsSpells): Comparison[] {
  const content = theContentsSpellTables();
  return Object.entries(HOW_EACH_TABLE_IS_COMPARED).map(([name, how]) => {
    const table = name as keyof TheOrderFormsSpellTables;
    return compare(`${table} (${how})`, asCompared(how, form.tables[table]), {
      answer: asCompared(how, content[table]),
      changed: false,
    });
  });
}

/** Where a spell's target field looks for the hero it is aimed at: in the caster's province only, anywhere, or at no
 *  hero (a spell aimed at a province, or at none). */
export type WhereTheFormLooks = "the caster's province" | 'anywhere' | 'no hero';
/** The report staged for the target field: realm 0's caster in province 100 with a hero of his realm there and one in
 *  province 200; and in each of the two provinces, a lone hero of realm 1, one of realm 1 leading armies, a lone
 *  wanderer, and the body of a fallen hero of realm 0 (every one of them seen, and every one a mark some spell may
 *  take). */
function aReportToAimSpellsIn(): {
  report: Obj;
  caster: Obj;
  whereEachStands: Map<string, number>;
  nameOfEach: Map<string, string>;
} {
  const HERE = 100;
  const caster: Obj = { id: 1, name: 'Ysolde Fen', player: 0, locationId: HERE, alive: true, skills: {} };
  const own: Obj[] = [caster];
  const others: Obj[] = [];
  const bodies: Obj[] = [];
  let id = 2;
  for (const where of [HERE, 200]) {
    const at = { locationId: where, locationName: `Province ${String(where)}`, alive: true };
    own.push({ ...at, id: id++, name: `Ally ${String(where)}`, player: 0, skills: {} });
    others.push({ ...at, id: id++, name: `Lone ${String(where)}`, player: 1, armies: 0, isKing: false });
    others.push({ ...at, id: id++, name: `Leader ${String(where)}`, player: 1, armies: 3, leadsArmies: true });
    others.push({ ...at, id: id++, name: `Wanderer ${String(where)}`, player: null, isWandering: true, armies: 0 });
    bodies.push({ id: id++, name: `Fallen ${String(where)}`, locationId: where, raisable: true, wasOwnHero: true });
  }
  const report: Obj = {
    characters: own,
    visibleChars: others,
    everSeenChars: others,
    knownDeadHeroes: bodies,
    allKingdoms: [
      { index: 0, name: 'Realm0' },
      { index: 1, name: 'Realm1' },
    ],
  };
  const whereEachStands = new Map(
    [...own, ...others, ...bodies].map((x) => [String(x['id']), Number(x['locationId'])]),
  );
  const nameOfEach = new Map([...own, ...others, ...bodies].map((x) => [String(x['id']), String(x['name'])]));
  return { report: deepFreeze(report), caster, whereEachStands, nameOfEach };
}
/** For each spell aimed at a hero (the content's), the heroes and bodies its target field offers on the staged report,
 *  by their names, in the field's order (the caster himself among them where the field offers him). Since P1-11c4 the
 *  field's lists that look in the caster's province ask the engine's mark check, so this pins what they offer. */
export function theHeroesEachSpellAimedAtAHeroOffers(form: TheOrderFormsSpells): Record<string, string[]> {
  const { report, caster, nameOfEach } = aReportToAimSpellsIn();
  return Object.fromEntries(
    theContentsSpellTables().NEEDS_CHAR.map((spell) => [
      spell,
      [...form.targetField(report, caster, spell).matchAll(/<option value="([^"]*)"/g)].flatMap((m) => {
        const name = nameOfEach.get(m[1] ?? '');
        return name === undefined ? [] : [name];
      }),
    ]),
  );
}
/** One spell's target field: where the form looks for its mark, against whether the engine's Cast Spell order holds
 *  that its mark must stand in the caster's province (the spells' registry's "a spell's mark must stand in the
 *  province", the check the order makes before the cast roll). */
export interface WhereTheMarkStandsComparison extends Comparison {
  readonly where: WhereTheFormLooks;
  /** The heroes the field offers but the caster himself, by their ids. */
  readonly othersOffered: string[];
}
/** For every spell of the content's table, the form's target field on the staged report (the heroes it offers, by the
 *  province each stands in) against the engine's check that its mark must stand in the caster's province. */
export function theFormsTargetsAgainstTheMarkCheck(form: TheOrderFormsSpells): WhereTheMarkStandsComparison[] {
  const { report, caster, whereEachStands } = aReportToAimSpellsIn();
  const here = caster['locationId'];
  return THE_SPELLS.map(([spell]) => {
    const offered = [...form.targetField(report, caster, spell).matchAll(/<option value="([^"]*)"/g)]
      .map((m) => m[1] ?? '')
      .filter((v) => whereEachStands.has(v));
    const where: WhereTheFormLooks = !offered.length
      ? 'no hero'
      : offered.every((v) => whereEachStands.get(v) === here)
        ? "the caster's province"
        : 'anywhere';
    return {
      ...compare(spell, where === "the caster's province", {
        answer: theMarkOfThisSpellMustStandInTheProvince(spell),
        changed: false,
      }),
      where,
      othersOffered: offered.filter((v) => v !== String(caster['id'])),
    };
  });
}

/** One cast compared: whether the form greys the spell out at its school's casting limit, and whether the engine's
 *  Cast Spell order blocks it there; with the engine's answer for the same cast in a realm without the Grand Cathedral
 *  (by the same hero, with or without the Warlock's title), and with neither. */
export interface CastingLimitComparison extends Comparison {
  readonly cathedral: boolean;
  readonly warlock: boolean;
  readonly engineWithoutTheWonder: unknown;
  readonly engineWithNeither: unknown;
  /** The engine's answer with neither, on the casts as the two rules leave them: under a Grand Cathedral a Bless
   *  Province is never blocked and an earlier one is not counted; for the Warlock, in his best school, one earlier cast
   *  of it is not counted (his limit one higher). */
  readonly engineAsTheTwoRulesSay: unknown;
}
/** The spells each cast and earlier cast is made of: a White spell, the White spell a Grand Cathedral frees, and a
 *  Psychic spell. */
const SPELLS_CAST = ['Holy Symbol', 'Bless Province', 'Oratory'] as const;
/** A spell's school, as the content's table writes it. */
const schoolOf = (spell: string) => THE_SPELLS.find(([n]) => n === spell)?.[1].school ?? '(no school)';
/** Every list of earlier casts of SPELLS_CAST, from none to three (the phases before the cast's). */
function earlierCasts(): string[][] {
  const lists: string[][] = [[]];
  for (let n = 1; n <= 3; n++)
    for (const list of lists.filter((l) => l.length === n - 1)) for (const s of SPELLS_CAST) lists.push([...list, s]);
  return lists;
}
/** Whether the engine's Cast Spell order (resolveCastSpellOrder, called as processOrder calls it) blocks the cast at
 *  its school's casting limit: the hero `c` (a copy, so a cast that lands and teaches him changes no other case) casts
 *  `spell` in the phase after `earlier`, his realm's orders for those phases. */
function theOrderBlocks(G: Obj, c: Obj, earlier: readonly string[], spell: string): boolean {
  const extraOf = (s: string) =>
    s === 'Bless Province' ? String(c['location']) : s === 'Oratory' ? String(c['id']) : '';
  const order = (s: string): Obj => ({ action: 'Cast Spell', target: s, extra: extraOf(s) });
  const ph = earlier.length;
  const cast = order(spell);
  G['turnOrders'] = { [String(c['id'])]: [...earlier.map(order), cast] };
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], Number(G['turn']) || 1), { KC_SEASONS, isBotRow });
  tc._currentPhase = ph;
  tc._logCtx = { charId: c['id'], phase: ph };
  const prov = objects(isObj(G['world']) ? G['world']['provinces'] : []).find((p) => p['id'] === c['location']);
  const realm = objects(G['players'])[Number(c['player'])];
  quietly(() => {
    // (the staged world's hero, his order, his province and his realm, given the types the order takes, by assertion
    // as the staged worlds give the saved state's: the turn's context is made by the engine's own createTurnContext)
    resolveCastSpellOrder(
      tc as unknown as TurnContext,
      copyOf(c) as never,
      cast as never,
      ph,
      spell,
      extraOf(spell),
      prov as never,
      realm as never,
      null,
    );
  });
  return tc.turnLog.some((l) => isObj(l['fact']) && l['fact']['kind'] === "a school's casting limit blocks a spell");
}
/** The Warlock's minor title in a staged world at the turn the titles go public, where one hero of realm 0 has trained
 *  a magic school highest: the title as the report writes it in his `minorHeld` (what the order form reads), the hero
 *  the report names holding it, the hero the turn counts as its holder (computeMinorTitles, as the turn works out
 *  `_minorHolders` before its first phase), and the mage (his id). */
export function theWarlocksTitle(): {
  asTheReportWritesIt: Obj;
  theHeroesTheReportNames: unknown[];
  theHeroTheTurnCounts: unknown;
  theMage: unknown;
} {
  const { g, hero } = aWorldToStageIn();
  g['turn'] = TITLES_PUBLIC_FROM_TURN;
  const mage = hero({ skills: { elemental: 9, white: 2 } });
  const { state, report } = quietly(() => savedAndReported(g));
  const held = (h: Obj) => objects(h['minorHeld']).filter((t) => t['key'] === 'warlock');
  const named = objects(report['characters']).filter((h) => held(h).length > 0);
  const asTheReportWritesIt = named.flatMap(held)[0];
  if (!asTheReportWritesIt) throw new Error('the staged report names no Warlock');
  const holders: unknown = computeMinorTitles(state);
  const warlock = isObj(holders) ? holders['warlock'] : null;
  return {
    asTheReportWritesIt: deepFreeze(asTheReportWritesIt),
    theHeroesTheReportNames: named.map((h) => h['id']),
    theHeroTheTurnCounts: isObj(warlock) ? warlock['charId'] : null,
    theMage: mage['id'],
  };
}
/** The form's casting count against the engine's: a hero of realm 0 (a Divine realm) of White Magic 1 to 5 and Psychic
 *  1 casts each of SPELLS_CAST after every list of earlier casts, in a realm with and without a Grand Cathedral (the
 *  form handed its realm's report as the engine builds it from each world), and holding the Warlock's title or not (the
 *  report's hero with the title as the report writes it, theWarlocksTitle; the state's `_minorHolders` naming him, as
 *  the turn sets it before its first phase). The form greys a spell out at its school's limit (its rows' `atLimit`);
 *  the engine blocks it ("a school's casting limit blocks a spell"). */
export function castingLimitAgainstTheOrder(form: TheOrderFormsSpells): CastingLimitComparison[] {
  const warlocksTitle = theWarlocksTitle().asTheReportWritesIt;
  const { g, king, hero } = aWorldToStageIn();
  const realm = objects(g['players'])[0];
  if (!realm) throw new Error('the staged world has no realm 0');
  realm['alignment'] = 'Divine';
  realm['gdProvinceId'] = null; // a Wonder raised before Wonders were sited: always on (gdActiveFor)
  const casters = [1, 2, 3, 4, 5].map((white) => hero({ location: king['location'], skills: { white, psychic: 1 } }));
  const world = quietly(() => savedAndReported(g));
  // realm 0's report with its Wonder raised (the Grand Design discovered), as the engine builds it from that world
  const discoveries = realm['discoveries'];
  realm['discoveries'] = [{ id: 'gd' }];
  const reportWithTheWonder = quietly(() => savedAndReported(g)).report;
  realm['discoveries'] = discoveries;
  const G = copyOf(world.state);
  const realmInG = objects(G['players'])[0] ?? {};
  const out: CastingLimitComparison[] = [];
  for (const caster of casters) {
    // (as saved, before any cast: a cast that lands may teach the hero in the state, which no later case may see)
    const saved = objects(world.state['characters']).find((x) => x['id'] === caster['id']);
    const reported = objects(world.report['characters']).find((x) => x['id'] === caster['id']);
    if (!saved || !reported) throw new Error('a staged caster is missing from the state or the report');
    const c = deepFreeze(copyOf(saved));
    const asReported = (warlock: boolean): Obj => ({ ...reported, minorHeld: warlock ? [warlocksTitle] : [] });
    for (const earlier of earlierCasts()) {
      const fields: Record<string, string> = {};
      earlier.forEach((s, ph) => {
        fields[`po-action-${String(c['id'])}-${String(ph)}`] = 'Cast Spell';
        fields[`po-target-${String(c['id'])}-${String(ph)}`] = s;
      });
      const rowsOf = (cathedral: boolean, warlock: boolean) =>
        form.castSpellRows(cathedral ? reportWithTheWonder : world.report, asReported(warlock), earlier.length, fields);
      const rows = [false, true].map((cathedral) => [false, true].map((warlock) => rowsOf(cathedral, warlock)));
      for (const spell of SPELLS_CAST) {
        const blocks = (cathedral: boolean, warlock: boolean) => {
          realmInG['discoveries'] = cathedral ? [{ id: 'gd' }] : [];
          G['_minorHolders'] = warlock ? { warlock: { charId: c['id'] } } : {};
          return theOrderBlocks(G, c, earlier, spell);
        };
        const engineWithNeither = blocks(false, false);
        const asTheTwoRulesSay = (cathedral: boolean, warlock: boolean) => {
          if (cathedral && spell === 'Bless Province') return false;
          const counted = cathedral ? earlier.filter((s) => s !== 'Bless Province') : [...earlier];
          const school = schoolOf(spell);
          const at = counted.findIndex((s) => schoolOf(s) === school);
          if (warlock && skillOf(c, school) === Math.max(...SCHOOLS.map((s) => skillOf(c, s))) && at >= 0)
            counted.splice(at, 1);
          realmInG['discoveries'] = [];
          G['_minorHolders'] = {};
          return theOrderBlocks(G, c, counted, spell);
        };
        for (const cathedral of [false, true])
          for (const warlock of [false, true]) {
            const row = rows[cathedral ? 1 : 0]?.[warlock ? 1 : 0]?.find((r) => r.spell === spell);
            const engineWithoutTheWonder = warlock ? blocks(false, true) : engineWithNeither;
            out.push({
              ...compare({ white: skillOf(c, 'white'), earlier, spell }, row ? row.atLimit : '(not offered)', {
                answer: cathedral ? blocks(cathedral, warlock) : engineWithoutTheWonder,
                changed: false,
              }),
              cathedral,
              warlock,
              engineWithoutTheWonder,
              engineWithNeither,
              engineAsTheTwoRulesSay: asTheTwoRulesSay(cathedral, warlock),
            });
          }
      }
    }
  }
  return out;
}

/** One unit's strength on the army card compared with the battle's, and what the battle makes of the Druid its leader
 *  falls short of: its multiplier (1: none short). */
export interface KinComparison extends Comparison {
  readonly druidMultiplier: number;
}
/** The world staged for the kin and feud: realm 0 (a Good realm whose king is a Human) with a hero of every humanoid
 *  race, of Druid 0 and 1, away from the king; the king leads a unit of every type a race can raise (neither a creature
 *  nor a monster, nor an elemental) at every quality, of every race and of none. */
export function kinWorld(): World {
  const { g, king, land, hero } = aWorldToStageIn();
  const [away] = land;
  if (!away) throw new Error('the staged world has too few land provinces');
  const classes: Record<string, readonly string[]> = KC_UNIT_CLASS;
  const has = (cls: string, t: string) => (classes[cls] ?? []).includes(t);
  const raised = Object.keys(KC_UNIT_TYPE).filter(
    (t) => !has('creature', t) && !has('monster', t) && Object.keys(classes).some((cls) => has(cls, t)),
  );
  king['armies'] = raised.flatMap((type) =>
    KC_QUALITY_TIERS.flatMap((quality) =>
      [...KC_HUMANOID_RACES, null].map((race) => ({ type, quality, unitName: type, ...(race ? { race } : {}) })),
    ),
  );
  for (const race of KC_HUMANOID_RACES)
    for (const druid of [0, 1]) hero({ race, alignment: 'Good', location: away['id'], skills: { druid } });
  return quietly(() => savedAndReported(g));
}
/** The army card's strength of each unit the king leads, under each staged hero (armyCardUnitStrength, read by its
 *  statements), against the battle's (armStr, on the ground of no terrain, with nothing of the battle around it). */
export function armyCardKinAgainstTheBattle(c: Copies, world: World): KinComparison[] {
  const G = copyOf(world.state);
  G['_titleHolders'] = {};
  G['_minorHolders'] = {};
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], Number(G['turn']) || 1), { KC_SEASONS, isBotRow });
  deepFreeze(G);
  const heroes = ownHeroes({ state: G, report: world.report });
  const king = heroes.find((h) => h.report['isKing']);
  if (!king) throw new Error('the kin world has no king in its report');
  const alignment = realmOf({ state: G, report: world.report }, king.state)['alignment'];
  const multiplier = battleDruidMultiplier({ state: G, report: world.report });
  // (the staged world's hero and unit, given the types armStr takes, by assertion as battleDruidMultiplier's)
  const battle = (h: Obj, u: Obj) =>
    armStr(tc as unknown as TurnContext, u as ArmyInABattle, h as HeroInABattle, String(alignment), null, null);
  const units = objects(king.report['armies']).map((a, i) => ({ report: a, state: objects(king.state['armies'])[i] }));
  return heroes
    .filter((h) => !h.report['isKing'])
    .flatMap((h) =>
      units.flatMap((u) => {
        if (!u.state) return [];
        return [
          {
            ...compare(
              [
                u.report['type'],
                u.report['quality'],
                u.report['race'] ?? null,
                h.report['race'],
                skillOf(h.state, 'druid'),
              ],
              c.armyCardUnitStrength(u.report, h.report, world.report),
              engineOn(battle, [h.state, u.state]),
            ),
            druidMultiplier: multiplier(h.state, u.state),
          },
        ];
      }),
    );
}

// ── The orders (P1-11d3) ────
// Plan P1-11d's parity cases on the orders a hero's form offers him, before any of it is shared (d7 to d11 share the
// creed and king check and the masteries' table): the order list (actionsFor) against the turn's own checks of each
// order (processOrder and the order's function), each name the list holds against the order the turn reads it as
// (normaliseAction), and the creed orders' target fields (buildTargetField) against their rows and what the turn does.
// Each runs as the portal's own code, on a report the engine builds; the turn's side is processOrder on a copy of the
// state the report was built from. Where the form disagrees with the turn (questions 36, 39, 40 and 41), the
// difference is pinned exactly.

/** The turn's refusals the order list restates, each by its line's kind: a creed's order outside its creed, a king's
 *  order by another hero, Steal with no Thief, Research with no Sage, a king releasing himself, a second Grand Design,
 *  and what a hero held by a charm or new to the realm will not do; and every mastery's ("a hero lacks the …
 *  mastery …", aMasteryIsLacking). Any other refusal (an order with no target, a province not his) is the order's
 *  own, which the list doesn't restate. */
export const THE_TURNS_REFUSALS_THE_ORDER_LIST_RESTATES: readonly string[] = [
  'the gods answer a consecration only from a Divine crown',
  "only a Good realm's folk answer a Call to Arms",
  'only a Neutral crown keeps brokers',
  'only Undead realms keep corpse-carters',
  'a hero who does not keep the old faith cannot perform rites',
  'only the king can consecrate ground',
  "only the king's voice carries the Call to Arms",
  "only the king commands the realm's brokers",
  'a hero with no Thief skill cannot steal',
  'a hero without Sage learning cannot research',
  'a king cannot release himself from his own service',
  'the realm has already completed its Grand Design',
  'a charmed hero will not carry out an order of his captor',
  'a hero who joined the realm this turn has no mastery to give yet',
  'a hero held by a charm this season cannot be released',
  'a charmed hero will not spend what he carries',
  'a charmed hero will part with nothing',
];
const aMasteryIsLacking = (kind: string) => /^a hero lacks the \w+ mastery /.test(kind);
/** The facts of the lines the turn writes as `heroId` gives the order `action` (with its target and extra: none, the
 *  empty field) in the first phase, as processOrder carries it out, on a copy of `state` (his move pool set as the turn
 *  sets it first); and the state it leaves. */
function theTurnPlaysTheOrder(
  state: Obj,
  heroId: unknown,
  action: string,
  target = '',
  extra = '',
): { facts: Obj[]; G: Obj } {
  const G = copyOf(state);
  const c = objects(G['characters']).find((h) => h['id'] === heroId);
  if (!c) throw new Error(`the staged state has no hero ${String(heroId)}`);
  G['turnOrders'] = { [String(heroId)]: [{ action, target, extra, desc: action }] };
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], Number(G['turn']) || 1), { KC_SEASONS, isBotRow });
  kcRng.seed(1);
  tc._currentPhase = 0;
  quietly(() => {
    setMovePool(tc as unknown as TurnContext, c as never);
    // (the staged world's hero and his order, given the types processOrder takes, by assertion as theOrderBlocks's)
    processOrder(tc as unknown as TurnContext, c as never, { action, target, extra, desc: action }, 0);
  });
  return { facts: tc.turnLog.map((l) => (isObj(l['fact']) ? l['fact'] : {})), G };
}
/** The refusal the order list restates that the turn gives `heroId` for the order `action`, or none (null). */
function theRestatedRefusal(state: Obj, heroId: unknown, action: string): string | null {
  const kinds = theTurnPlaysTheOrder(state, heroId, action).facts.map((f) => String(f['kind']));
  return kinds.find((k) => THE_TURNS_REFUSALS_THE_ORDER_LIST_RESTATES.includes(k) || aMasteryIsLacking(k)) ?? null;
}

/** Each hero's skill at 9: a hero no mastery gate can refuse. */
const EVERY_SKILL_AT_NINE: Obj = Object.fromEntries(Object.keys(SKILL_LABELS).map((k) => [k, 9]));
/** A new world staged for the orders: aWorldToStageIn's, the heroes no realm holds gone, every land province no realm
 *  holds realm 0's (its guards gone) at a tax below 10 but the capital's, realm 0 rich enough for any order; with a
 *  way to stage a hero of realm 0 in a province (a copy of its king, his id his place in the list: the army orders
 *  read a comrade by it), and the provinces next to one. */
function aWorldForTheOrders(): {
  g: Obj;
  king: Obj;
  realm: Obj;
  capital: Obj;
  land: Obj[];
  at: (p: Obj, fields?: Obj) => Obj;
  nextTo: (p: Obj) => Obj[];
} {
  const { g, king } = aWorldToStageIn();
  const map = isObj(g['world']) ? g['world'] : {};
  const [cols, rows] = [Number(map['cols']), Number(map['rows'])];
  const provinces = objects(map['provinces']);
  const characters: unknown[] = Array.isArray(g['characters']) ? g['characters'] : [];
  // (aWorldToStageIn's heroes are its realms' kings and heroes, in id order; its staged ones are none yet)
  if (objects(characters).some((h, i) => h['id'] !== i))
    throw new Error("the staged world's heroes are not in id order");
  const realmless = new Set(
    objects(characters)
      .filter((h) => h['player'] == null)
      .map((h) => h['id']),
  );
  for (const h of objects(characters)) if (realmless.has(h['id'])) h['alive'] = false;
  const capital = provinces.find((p) => p['id'] === king['location']);
  if (!capital) throw new Error("the staged world has no capital for realm 0's king");
  const land = provinces.filter((p) => p['terrain'] !== 'sea');
  for (const p of provinces) {
    p['characters'] = (Array.isArray(p['characters']) ? p['characters'] : []).filter((id) => !realmless.has(id));
    if (p['terrain'] === 'sea' || (p['owner'] != null && p['owner'] !== 0)) continue;
    p['owner'] = 0;
    p['npcArmies'] = [];
    p['neutralDefenders'] = [];
    if (p !== capital) p['tax'] = Math.min(Number(p['tax']) || 0, 9);
  }
  const realm = objects(g['players'])[0];
  if (!realm) throw new Error('the staged world has no realm 0');
  realm['gold'] = 1000;
  realm['provinces'] = land.filter((p) => p['owner'] === 0).map((p) => p['id']);
  const at = (p: Obj, fields: Obj = {}): Obj => {
    const id = characters.length;
    const h: Obj = { ...copyOf(king), isKing: false, items: [], armies: [], skills: {}, ...fields, id };
    h['name'] = `Staged ${String(id)}`;
    h['location'] = p['id'];
    characters.push(h);
    p['characters'] = [...(Array.isArray(p['characters']) ? (p['characters'] as unknown[]) : []), id];
    return h;
  };
  const nextTo = (p: Obj) => getNeighborsP({ row: Number(p['row']), col: Number(p['col']) }, cols, rows, provinces);
  g['characters'] = characters;
  return { g, king, realm, capital, land: land.filter((p) => p['owner'] === 0), at, nextTo };
}

/** What each staged case of the order list checks. */
export type AKindOfOrderListCase =
  | 'a mastery'
  | "a creed's order"
  | 'Steal'
  | 'Research'
  | 'Release Hero'
  | 'the Grand Design'
  | 'a hero under a charm, or new to the realm';
/** One order of a staged hero compared: whether the form's order list offers it, and whether the turn lets him give it
 *  (no refusal the list restates); with what the case checks, the hero, the order, and the turn's refusal (or none). */
export interface AnOrderListComparison extends Comparison {
  readonly kind: AKindOfOrderListCase;
  readonly who: string;
  readonly order: string;
  readonly refusal: string | null;
}
/** The order list's gates against the turn's, on staged heroes of realm 0 in its capital (a Good realm, but where a
 *  creed is staged): for each mastery of the form's table, a hero one level below it and one at it; the king and a
 *  hero under each of the seven creeds, for the five creeds' orders; Steal at Thief 0, 1 and 0 wearing an item of
 *  Thief +2; Research at Sage 0, 1 and 0 wearing an item of Sage +2; Release Hero by the king and a hero; the Grand
 *  Design by a Sage 9 hero before and after his realm has raised its Wonder; and every order of the list by a hero
 *  seized from an enemy by a charm and one hired this turn, each with the card the page makes him
 *  (src/ui/player/pre-orders.ts: no levels seen) and, in the state, every skill at 9. The form is
 *  handed the realm's report as the engine builds it from each world (its creed, its Wonder); the turn, a copy of the
 *  state it was built from. */
export function theOrderListAgainstTheTurn(c: Copies): AnOrderListComparison[] {
  const { g, king, realm, capital, at } = aWorldForTheOrders();
  const listed: unknown = c.theOrderListsNames();
  const everyOrder = (Array.isArray(listed) ? listed : []).map(String);
  const table: unknown = c.theMasteryOrdersOfTheList();
  interface AStagedHero {
    readonly kind: AKindOfOrderListCase;
    readonly who: string;
    readonly hero: Obj;
    readonly orders: readonly string[];
    readonly creed?: string;
    readonly wonder?: boolean;
    /** The card the page makes him (none: his report's). */
    readonly card?: Obj;
  }
  const staged: AStagedHero[] = [];
  for (const m of objects(table)) {
    const [name, skill, level] = [String(m['name']), String(m['skill']), Number(m['level'])];
    for (const l of [level - 1, level])
      staged.push({
        kind: 'a mastery',
        who: `${skill} ${String(l)}`,
        hero: at(capital, { skills: { [skill]: l } }),
        orders: [name],
      });
  }
  const aHero = at(capital, { skills: { white: 1 } });
  for (const creed of KC_ALIGNMENTS)
    for (const [who, hero] of [
      ['the king', king],
      ['a hero', aHero],
    ] as const)
      staged.push({
        kind: "a creed's order",
        who: `${who} of a ${creed} realm`,
        hero,
        orders: ['Consecrate', 'Call to Arms', 'Broker', 'Harvest the Field', 'Perform Rite'],
        creed,
      });
  let itemId = 64_000;
  const worn = (name: string): Obj[] => {
    const it = catalogue().find((x) => x['name'] === name);
    if (!it) throw new Error(`the catalogue has no ${name}`);
    return [{ ...copyOf(it), id: itemId++, equipped: true }];
  };
  const [thief, sage] = ['Gloves of the Nightcrawler', "Sage's Crown"];
  for (const [kind, skill, order, item] of [
    ['Steal', 'thief', 'Steal', thief],
    ['Research', 'sage', 'Research', sage],
  ] as const) {
    staged.push({ kind, who: `${skill} 0`, hero: at(capital, { skills: { [skill]: 0 } }), orders: [order] });
    staged.push({ kind, who: `${skill} 1`, hero: at(capital, { skills: { [skill]: 1 } }), orders: [order] });
    staged.push({
      kind,
      who: `${skill} 0, wearing ${item}`,
      hero: at(capital, { items: worn(item) }),
      orders: [order],
    });
  }
  staged.push({ kind: 'Release Hero', who: 'the king', hero: king, orders: ['Release Hero'] });
  staged.push({ kind: 'Release Hero', who: 'a hero', hero: aHero, orders: ['Release Hero'] });
  const designer = at(capital, { skills: { sage: 9 } });
  for (const wonder of [false, true])
    staged.push({
      kind: 'the Grand Design',
      who: wonder ? 'a Sage 9 hero, his realm’s Wonder raised' : 'a Sage 9 hero',
      hero: designer,
      orders: ['Grand Design'],
      wonder,
    });
  // two of the cards the page makes a hero whose levels his realm has not seen, as it writes them
  const unseen = (fields: Obj): Obj => ({ isKing: false, skills: {}, items: [], armies: [], ...fields });
  const turn = Number(g['turn']) || 1;
  for (const [who, fields, card] of [
    [
      'seized from an enemy by a charm',
      { _charmTempControl: true, _charmOriginalPlayer: 1, _charmedTurn: turn },
      unseen({ _hiddenSkills: true, _charmEnemy: true }),
    ],
    ['hired this turn', { hiredInPhase: 0 }, unseen({ _unknownSkills: true })],
  ] as const) {
    const hero = at(capital, { skills: { ...EVERY_SKILL_AT_NINE }, ...fields });
    staged.push({
      kind: 'a hero under a charm, or new to the realm',
      who,
      hero,
      orders: everyOrder,
      card: { ...card, id: hero['id'], name: hero['name'] },
    });
  }
  // realm 0's world under each creed, and with its Wonder raised (its Grand Design discovered)
  const worlds = new Map<string, World>();
  const worldOf = (creed: string, wonder: boolean): World => {
    const key = `${creed} ${String(wonder)}`;
    const kept = worlds.get(key);
    if (kept) return kept;
    const [was, discoveries] = [realm['alignment'], realm['discoveries']];
    realm['alignment'] = creed;
    if (wonder) realm['discoveries'] = [{ id: 'gd' }];
    const world = quietly(() => savedAndReported(g));
    [realm['alignment'], realm['discoveries']] = [was, discoveries];
    worlds.set(key, world);
    return world;
  };
  return staged.flatMap((s) => {
    const world = worldOf(s.creed ?? String(realm['alignment']), s.wonder ?? false);
    const card = s.card ?? objects(world.report['characters']).find((h) => h['id'] === s.hero['id']);
    if (!card) throw new Error(`the staged report has no ${s.who}`);
    const offered: unknown = c.actionsForOn(world.report, card);
    const list = Array.isArray(offered) ? offered.map(String) : [];
    return s.orders.map((order) => {
      const refusal = theRestatedRefusal(world.state, s.hero['id'], order);
      return {
        ...compare([s.who, order], list.includes(order), { answer: refusal === null, changed: false }),
        kind: s.kind,
        who: s.who,
        order,
        refusal,
      };
    });
  });
}

/** Each name the order list may hold (ACTIONS) and the order the turn reads it as (normaliseAction, on an order with
 *  that action): its kind, or "(none: read as a Defend)" when the turn's names (PHASE_ACTION_MAP) don't hold it, as the
 *  turn then reads any order. */
export function theOrderEachNameOfTheListGives(c: Copies): [string, string][] {
  const listed: unknown = c.theOrderListsNames();
  const names: Readonly<Partial<Record<string, string>>> = PHASE_ACTION_MAP;
  return (Array.isArray(listed) ? listed : [])
    .map(String)
    .map((name) => [
      name,
      names[name.toLowerCase().trim()] === undefined ? '(none: read as a Defend)' : normaliseAction({ action: name }),
    ]);
}

/** The words of a piece of markup as a reader sees them: its tags taken out (again until none is left, so no tag can
 *  be made of the pieces of two), its entities read, its spaces made one. */
function theWordsOf(markup: string): string {
  let words = markup;
  for (let was = ''; was !== words;) {
    was = words;
    words = words.replace(/<[^<>]*>/g, ' ');
  }
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" };
  return words
    .replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_m, e: string) => entities[e] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
/** The options of a field's select, each its value, its words and whether it is the one selected. */
function theOptionsOf(markup: string): { value: string; words: string; selected: boolean }[] {
  return [...markup.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map((m) => ({
    value: /value="([^"]*)"/.exec(m[1] ?? '')?.[1] ?? '',
    words: theWordsOf(m[2] ?? ''),
    selected: /\bselected\b/.test(m[1] ?? ''),
  }));
}
/** The numbers of a creed's orders as its row gives them (src/content/alignment-orders-…). */
const theRowsNumber = (order: keyof typeof THE_ALIGNMENT_ORDERS, n: string): unknown => {
  const numbers: Readonly<Record<string, { readonly value: unknown } | undefined>> =
    THE_ALIGNMENT_ORDERS[order].theNumbers;
  return numbers[n]?.value;
};

/** The creed orders' target fields the parity cases stage: those the field and the turn agree on, and those it is
 *  known to get wrong (questions 36, 39 and 41): a Consecrate in a captured seat of tax 10 (the field takes it for
 *  the home, the turn's home is the seat the realm was founded on), by a king of White 7 at five consecrations (the
 *  field counts his White to 5), Harvest the Field's price with Corpse-Carters (the field's 2g), the Wild Hunt's term
 *  with The Long Hunt (the field's next turn), a Call to Arms in a province whose first company is not a garrison (the
 *  field names that company, the turn musters a garrison), and a Blood Offering marked on companies the rite never
 *  takes (the field offers bound beasts and risen dead; the turn gives the first company it may and raises the next). */
export const THE_CREED_FIELDS_THE_TURN_AGREES_WITH = [
  'a Call to Arms in a province whose first company is a garrison',
  'Broker: word bought from a province',
  'Harvest the Field',
  'the Rite of the Wild Hunt',
  'the Move note after the Rite of the Wild Hunt',
  'a Blood Offering marked on two companies',
  'a Consecrate in a province of the realm',
  'a Consecrate in the capital',
] as const;
export const THE_CREED_FIELDS_THE_TURN_DISAGREES_WITH = [
  'a Call to Arms in a province whose first company is not a garrison',
  'Harvest the Field, with Corpse-Carters',
  'the Rite of the Wild Hunt, with The Long Hunt',
  'a Blood Offering marked on a bound beast',
  'a Consecrate in a captured seat of tax 10',
  'a Consecrate by a king of White 7 at five consecrations',
] as const;
export type AKindOfCreedField =
  (typeof THE_CREED_FIELDS_THE_TURN_AGREES_WITH)[number] | (typeof THE_CREED_FIELDS_THE_TURN_DISAGREES_WITH)[number];
/** One creed order's field compared: what the field says the order will do (read from its words and its marks), and
 *  what the turn does with it; with its kind, and the rows' numbers for what the field states (where a row has one). */
export interface ACreedFieldComparison extends Comparison {
  readonly kind: AKindOfCreedField;
  readonly rows: Obj;
}
/** What a Consecrate's field says it will do (its words: "Consecrates …" or the warning it gives), and what the turn
 *  does (its line), each in the same words: it consecrates, or the rule that refuses it (the home marches: the home and
 *  the provinces next to it; the limit: the consecrations a king may hold). */
function theFieldsConsecration(markup: string): string {
  const said = /placeholder="([^"]*)"/.exec(markup)?.[1] ?? '';
  const words = theWordsOf(said);
  if (words.startsWith('Consecrates ')) return 'it consecrates';
  if (/is your home province|borders your home province/.test(words)) return 'the home marches';
  if (words.includes('(your White limit)')) return 'the limit';
  return `(the field says: ${words})`;
}
function theTurnsConsecration(facts: readonly Obj[]): string {
  const kinds = facts.map((f) => String(f['kind']));
  if (kinds.includes('a king consecrates a province')) return 'it consecrates';
  if (kinds.includes('the home marches were anointed at the coronation')) return 'the home marches';
  if (kinds.includes('the White faith can sustain no more consecrated provinces')) return 'the limit';
  return `(the turn says: ${kinds.join('; ')})`;
}
/** The creed orders' fields (buildTargetField, on realm 0's report as the engine builds it from each world) against
 *  the rows and what the turn does with each order (processOrder, on a copy of the state the report was built from):
 *  each kind of THE_CREED_FIELDS_THE_TURN_AGREES_WITH and THE_CREED_FIELDS_THE_TURN_DISAGREES_WITH, staged in a world
 *  of its own (its creed, its discoveries, where its hero stands). */
export function theCreedFieldsAgainstTheRowsAndTheTurn(c: Copies): ACreedFieldComparison[] {
  const { g, king, capital, land, at, nextTo } = aWorldForTheOrders();
  const kingId = king['id'];
  const near = (p: Obj) => new Set([p['id'], ...nextTo(p).map((q) => q['id'])]);
  const homeMarches = near(capital);
  const free = land.filter((p) => !homeMarches.has(p['id']));
  const take = () => {
    const p = free.shift();
    if (!p) throw new Error('the staged world has too few provinces for the creed fields');
    return p;
  };
  // a Call to Arms' two provinces: one whose first company is a garrison, one whose first is not
  const [garrisonFirst, levyFirst] = [take(), take()];
  // (settled by Humans: a seeded world's races differ after another world is made in the process, as the names its
  // first draws take do; its map and its capitals don't)
  for (const [p, types] of [
    [garrisonFirst, ['Human Garrison', 'Men-at-Arms']],
    [levyFirst, ['Free Lances', 'Human Garrison']],
  ] as const) {
    p['race'] = 'Human';
    p['armyTypes'] = [...types];
  }
  // the graves Harvest the Field raises from
  const field = take();
  field['battleGraves'] = [{ type: 'Men-at-Arms', quality: 'Veteran', race: 'Human', unitName: 'The Fallen Spears' }];
  const harvester = at(field);
  // the standing stones a Pagan hero performs his rites at, in a province of beasts
  const stones = take();
  stones['features'] = [{ name: 'Staged Stones', index: 0, ritualSite: true, discovered: true }];
  stones['armyTypes'] = ['Stone Giants'];
  const hunter = at(stones);
  let unitN = 0;
  const company = (type: string, fields: Obj = {}): Obj => ({
    type,
    quality: 'Average',
    race: 'Human',
    unitName: `Staged Company ${String(unitN++)}`,
    ...fields,
  });
  const offerer = at(stones, { armies: [company('Men-at-Arms'), company('Yeoman Longbows')] });
  const turn = Number(g['turn']) || 1;
  const markedOnABeast = at(stones, {
    armies: [
      company('Men-at-Arms'),
      company('Yeoman Longbows'),
      company('Stone Giants', { quality: 'Veteran', race: 'Primal', _wildHuntUntilTurn: turn + 1 }),
    ],
  });
  // the provinces a Consecrate is given in: one of the realm's, and a captured seat of tax 10 the map lists before
  // the capital; and five more of the realm's, consecrated, none next to the first
  const consecrated = take();
  const apart = near(consecrated);
  const five = free.filter((p) => !apart.has(p['id'])).slice(0, 5);
  const seat = land.find(
    (p) =>
      Number(p['id']) < Number(capital['id']) &&
      !homeMarches.has(p['id']) &&
      ![garrisonFirst, levyFirst, field, stones, consecrated].includes(p),
  );
  if (five.length < 5 || !seat) throw new Error('the staged world has too few provinces for the Consecrate cases');
  const discovery = (id: string) => {
    const d = objects(SAGE_DISCOVERIES_P).find((x) => x['id'] === id);
    if (!d) throw new Error(`the discoveries have no ${id}`);
    return copyOf(d);
  };
  /** realm 0's world under `creed`, with `edit` made to a copy of the staged one (`G`: the copy; the king's id). */
  const realmZeroOf = (G: Obj): Obj => {
    const r = objects(G['players'])[0];
    if (!r) throw new Error('the staged world has no realm 0');
    return r;
  };
  const worldOf = (creed: string, edit: (G: Obj, theKing: Obj) => void = () => undefined): World => {
    const G = copyOf(g);
    realmZeroOf(G)['alignment'] = creed;
    const theKing = objects(G['characters']).find((h) => h['id'] === kingId) ?? {};
    edit(G, theKing);
    return quietly(() => savedAndReported(G));
  };
  const provinceIn = (G: Obj, p: Obj) =>
    objects(isObj(G['world']) ? G['world']['provinces'] : []).find((q) => q['id'] === p['id']) ?? {};
  /** The king of `G` moved to the province `p`, of White `white`. */
  const theKingIn = (G: Obj, theKing: Obj, p: Obj, white: number) => {
    const from = provinceIn(G, capital);
    from['characters'] = (Array.isArray(from['characters']) ? from['characters'] : []).filter((id) => id !== kingId);
    const to = provinceIn(G, p);
    to['characters'] = [...(Array.isArray(to['characters']) ? (to['characters'] as unknown[]) : []), kingId];
    theKing['location'] = p['id'];
    theKing['skills'] = { ...(isObj(theKing['skills']) ? theKing['skills'] : {}), white };
  };
  const reportHero = (world: World, id: unknown): Obj => {
    const h = objects(world.report['characters']).find((x) => x['id'] === id);
    if (!h) throw new Error(`the staged report has no hero ${String(id)}`);
    return h;
  };
  const field_ = (world: World, id: unknown, action: string, target = '', extra = '') =>
    String(c.theTargetFieldOn(world.report, {}, reportHero(world, id), 0, { action, target, extra }));
  const out: ACreedFieldComparison[] = [];
  const push = (kind: AKindOfCreedField, copy: unknown, engine: unknown, rows: Obj = {}) =>
    out.push({ ...compare(kind, copy, { answer: engine, changed: false }), kind, rows });
  const factOf = (facts: readonly Obj[], kind: string): Obj => facts.find((f) => f['kind'] === kind) ?? {};
  const words = (markup: string, re: RegExp) => re.exec(theWordsOf(markup))?.slice(1) ?? ['(not said)'];

  // Call to Arms: the grade and the company the field names, and the grade its note gives; what the turn musters
  const good = worldOf('Good');
  for (const [kind, p] of [
    ['a Call to Arms in a province whose first company is a garrison', garrisonFirst],
    ['a Call to Arms in a province whose first company is not a garrison', levyFirst],
  ] as const) {
    const markup = field_(good, kingId, 'Call to Arms', String(p['id']));
    const option = theOptionsOf(markup).find((o) => o.value === String(p['id']));
    const [grade, unit] = /— raises an? (\S+) (.+)$/.exec(option?.words ?? '')?.slice(1) ?? ['(not offered)', ''];
    const [noteGrade] = words(markup, /Free (\S+) garrison unit/);
    const mustered = factOf(
      theTurnPlaysTheOrder(good.state, kingId, 'Call to Arms', String(p['id'])).facts,
      'the folk answer a Call to Arms',
    );
    const row = theRowsNumber('call-to-arms', 'theGradeMustered');
    push(
      kind,
      { grade, company: unit, 'the grade its note gives': noteGrade },
      { grade: mustered['quality'], company: mustered['unitType'], 'the grade its note gives': mustered['quality'] },
      { grade: row, 'the grade its note gives': row },
    );
  }
  // Broker: the price of word from a province, in its option and its note; what the turn takes from the treasury
  {
    const neutral = worldOf('Neutral');
    const target = `spy:${String(garrisonFirst['id'])}`;
    const markup = field_(neutral, kingId, 'Broker', target);
    const option = theOptionsOf(markup).find((o) => o.value === target);
    const [inTheOption] = /\((\d+)g — full Spy result\)/.exec(option?.words ?? '')?.slice(1) ?? ['(not offered)'];
    const [inTheNote] = words(markup, /a guaranteed Spy report on any province the realm has seen — (\d+)g/);
    const goldOf = (G: Obj) => Number(realmZeroOf(G)['gold']);
    const spent = goldOf(neutral.state) - goldOf(theTurnPlaysTheOrder(neutral.state, kingId, 'Broker', target).G);
    const row = theRowsNumber('broker', 'thePriceOfWordFromAProvince');
    push(
      'Broker: word bought from a province',
      { 'in its option': Number(inTheOption), 'in its note': Number(inTheNote) },
      { 'in its option': spent, 'in its note': spent },
      { 'in its option': row, 'in its note': row },
    );
  }
  // Harvest the Field: the price its note gives; what the turn charges
  for (const [kind, discoveries] of [
    ['Harvest the Field', []],
    ['Harvest the Field, with Corpse-Carters', [discovery('az06')]],
  ] as const) {
    const undead = worldOf('Undead', (G) => {
      realmZeroOf(G)['discoveries'] = [...discoveries];
    });
    const [price] = words(field_(undead, harvester['id'], 'Harvest the Field'), /No magic required: (\d+)g raises/);
    const raised = factOf(
      theTurnPlaysTheOrder(undead.state, harvester['id'], 'Harvest the Field').facts,
      'the corpse-carters raise a skeletal company',
    );
    push(
      kind,
      { price: Number(price) },
      { price: raised['cost'] },
      { price: theRowsNumber('harvest-the-field', 'thePrice') },
    );
  }
  // the Rite of the Wild Hunt: the beasts its option binds, their grade and type, their price and the turns beyond
  // this one they serve ("until end of NEXT turn": one); what the turn binds
  for (const [kind, discoveries] of [
    ['the Rite of the Wild Hunt', []],
    ['the Rite of the Wild Hunt, with The Long Hunt', [discovery('ap08')]],
  ] as const) {
    const pagan = worldOf('Pagan', (G) => {
      realmZeroOf(G)['discoveries'] = [...discoveries];
    });
    const option = theOptionsOf(field_(pagan, hunter['id'], 'Perform Rite', 'Wild Hunt')).find(
      (o) => o.value === 'Wild Hunt',
    );
    const said = /bind (\d+) (\S+) (.+) \((\d+)g — the price of one, no wages, serve until end of (.+?) turn\)/.exec(
      option?.words ?? '',
    );
    const [beasts, grade, type, price, until] = said?.slice(1) ?? [];
    const played = theTurnPlaysTheOrder(pagan.state, hunter['id'], 'Perform Rite', 'Wild Hunt');
    const bound = objects(objects(played.G['characters']).find((h) => h['id'] === hunter['id'])?.['armies']).filter(
      (a) => a['_wildHuntUntilTurn'] != null,
    );
    const performed = factOf(played.facts, 'a hero performs the Rite of the Wild Hunt');
    const grades = [...new Set(bound.map((a) => String(a['quality'])))];
    push(
      kind,
      {
        beasts: Number(beasts),
        grade: grade ? grade.charAt(0) + grade.slice(1).toLowerCase() : '(not said)',
        type,
        price: Number(price),
        'turns beyond this one': until === 'NEXT' ? 1 : `(the field says: until end of ${String(until)} turn)`,
      },
      {
        beasts: bound.length,
        grade: grades.length === 1 ? grades[0] : grades,
        type: bound[0]?.['type'],
        price: performed['price'],
        'turns beyond this one': Math.max(...bound.map((a) => Number(a['_wildHuntUntilTurn']))) - turn,
      },
      {
        beasts: theRowsNumber('perform-rite', 'theWildHuntsBeasts'),
        'turns beyond this one': theRowsNumber('perform-rite', 'theWildHuntsTurnsMore'),
      },
    );
  }
  // the Move note's column in the phase after a Rite of the Wild Hunt: the beasts it counts bound (P1-11d8)
  {
    const pagan = worldOf('Pagan');
    const column = c.theMoveNotesColumnOn(
      pagan.report,
      { [String(hunter['id'])]: [{ action: 'Perform Rite', target: 'Wild Hunt' }] },
      hunter['id'],
      1,
    );
    const counted = (Array.isArray(column) ? column : []).filter((name) =>
      String(name).endsWith('(bound by the Wild Hunt)'),
    );
    const played = theTurnPlaysTheOrder(pagan.state, hunter['id'], 'Perform Rite', 'Wild Hunt');
    const bound = objects(objects(played.G['characters']).find((h) => h['id'] === hunter['id'])?.['armies']).filter(
      (a) => a['_wildHuntUntilTurn'] != null,
    );
    push(
      'the Move note after the Rite of the Wild Hunt',
      { beasts: counted.length },
      { beasts: bound.length },
      { beasts: theRowsNumber('perform-rite', 'theWildHuntsBeasts') },
    );
  }
  // a Blood Offering: the companies its marks give and raise, and the grades it says each rises (in its option, its
  // heading and its mark); what the turn gives and raises
  {
    const pagan = worldOf('Pagan');
    for (const [kind, hero, extra] of [
      ['a Blood Offering marked on two companies', offerer, 'S:0|E:1'],
      ['a Blood Offering marked on a bound beast', markedOnABeast, 'S:2|E:1'],
    ] as const) {
      const markup = field_(pagan, hero['id'], 'Perform Rite', 'Blood Offering', extra);
      const led = objects(reportHero(pagan, hero['id'])['armies']);
      const marks = [...markup.matchAll(/<select class="bo-sel"[^>]*data-idx="(\d+)"[^>]*>([\s\S]*?)<\/select>/g)].map(
        (m) => ({
          company: String(led[Number(m[1])]?.['unitName']),
          mark: theOptionsOf(m[2] ?? '').find((o) => o.selected)?.value ?? '',
        }),
      );
      const text = theWordsOf(markup);
      const grades = [/\(\+(\d+) tiers each\)/, /\(\+(\d+) quality tiers each/, /Empower \+(\d+)/].map((re) =>
        Number(re.exec(text)?.[1]),
      );
      const before = objects(objects(pagan.state['characters']).find((h) => h['id'] === hero['id'])?.['armies']);
      const after = objects(
        objects(
          theTurnPlaysTheOrder(pagan.state, hero['id'], 'Perform Rite', 'Blood Offering', extra).G['characters'],
        ).find((h) => h['id'] === hero['id'])?.['armies'],
      );
      const tiers: readonly string[] = KC_QUALITY_TIERS;
      const risen = after.filter((a) =>
        before.some((b) => b['unitName'] === a['unitName'] && b['quality'] !== a['quality']),
      );
      const rises = risen.map(
        (a) =>
          tiers.indexOf(String(a['quality'])) -
          tiers.indexOf(String(before.find((b) => b['unitName'] === a['unitName'])?.['quality'])),
      );
      const row = theRowsNumber('perform-rite', 'theBloodOfferingsGrades');
      push(
        kind,
        {
          given: marks.filter((m) => m.mark === 'S').map((m) => m.company),
          raised: marks.filter((m) => m.mark === 'E').map((m) => m.company),
          'the grades each rises': grades,
        },
        {
          given: before
            .filter((b) => !after.some((a) => a['unitName'] === b['unitName']))
            .map((b) => String(b['unitName'])),
          raised: risen.map((a) => String(a['unitName'])),
          'the grades each rises': grades.map(() => (rises.length === 1 ? rises[0] : rises)),
        },
        { 'the grades each rises': grades.map(() => row) },
      );
    }
  }
  // Consecrate: what its field says, and what the turn does, by the king of a Divine realm
  for (const [kind, p, white, edit] of [
    ['a Consecrate in a province of the realm', consecrated, 1, () => undefined],
    ['a Consecrate in the capital', capital, 1, () => undefined],
    [
      'a Consecrate in a captured seat of tax 10',
      seat,
      1,
      (G: Obj) => {
        const q = provinceIn(G, seat);
        q['tax'] = 10;
      },
    ],
    [
      'a Consecrate by a king of White 7 at five consecrations',
      consecrated,
      7,
      (G: Obj) => {
        realmZeroOf(G)['consecratedProvIds'] = five.map((q) => q['id']);
      },
    ],
  ] as const) {
    const divine = worldOf('Divine', (G, theKing) => {
      theKingIn(G, theKing, p, white);
      edit(G);
    });
    push(
      kind,
      theFieldsConsecration(field_(divine, kingId, 'Consecrate')),
      theTurnsConsecration(theTurnPlaysTheOrder(divine.state, kingId, 'Consecrate').facts),
    );
  }
  return out;
}

// ── Gold and practice (P1-11d4) ────
// The order form's treasury ledger (computeOrderLedgerP), the note under a Practice Skill order (orderChanceNote) and
// the comrades a hero's Practice Skill field counts as practising beside him (practiceCompanionSkill), each run as the
// page runs it on realm 0's report as the engine builds it, its fields holding the orders staged; the turn's side is its
// phases played on a copy of the state the report was built from (theTurnPlaysThePhases), and for the wages, Early
// Winter's reckoning after them. Where the form disagrees with the turn (question 43), the difference is pinned exactly.

/** The orders the ledger cases stage, each in a world of its own: those the ledger and the turn agree on, and those it
 *  is known to get wrong (question 43): the upkeep discovery's saving counted fresh for each company (the turn's is
 *  shared, to a cap), the Host-Leader's 1g a company, a Druid 6 leader's half price and half wage for a beast, and a
 *  hero-wage discovery's saving on a hero hired. */
export const THE_LEDGERS_THE_TURN_AGREES_WITH = [
  'a company of the province raised into his column',
  'two companies of one kind raised at the capital',
  'a garrison company raised',
  'a mercenary band hired',
  'a wandering hero hired',
  'a company raised by a realm with Supply Depots, under its cap',
  'a beast raised by a Druid 5 hero',
  'Harvest the Field',
  'the Rite of the Wild Hunt',
  'word bought from a province by the Broker',
  'word bought from a province, on a report that names no price',
] as const;
export const THE_LEDGERS_THE_TURN_DISAGREES_WITH = [
  'a wandering hero hired by a realm with Granaries',
  'a company raised by a realm with Supply Depots, past its cap',
  "a company raised into the Host-Leader's column",
  'a beast raised by a Druid 6 hero',
] as const;
export type AKindOfLedger =
  (typeof THE_LEDGERS_THE_TURN_AGREES_WITH)[number] | (typeof THE_LEDGERS_THE_TURN_DISAGREES_WITH)[number];
/** One staged ledger compared: what the ledger says the orders will spend and add to the wages, and what the turn
 *  takes from the treasury in their phase and adds to the wages Early Winter charges; with its kind. */
export interface ALedgerComparison extends Comparison {
  readonly kind: AKindOfLedger;
}

/** Realm 0 of a state. */
function realmZeroIn(G: Obj): Obj {
  const r = objects(G['players'])[0];
  if (!r) throw new Error('the staged world has no realm 0');
  return r;
}
/** The hero of a state with the id the hero `x` has. */
function heroIn(G: Obj, x: Obj): Obj {
  const h = objects(G['characters']).find((c) => c['id'] === x['id']);
  if (!h) throw new Error(`the staged state has no hero ${String(x['id'])}`);
  return h;
}
/** The wages Early Winter charges realm 0 (its companies' and its heroes'), on a copy of `G`. */
function theWagesEarlyWinterCharges(G: Obj): number {
  const W = copyOf(G);
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(W, [], Number(W['turn']) || 1), { KC_SEASONS, isBotRow });
  kcRng.seed(1);
  quietly(() => {
    earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill(tc as unknown as TurnContext);
  });
  const charged = realmZeroIn(W)['_lastWages'];
  if (!isObj(charged)) throw new Error('Early Winter charged realm 0 no wages');
  return Number(charged['armyWages']) + Number(charged['heroWages']);
}
/** A staged world's copy of `g` with `edit` made to it, as saved, and realm 0's report on it. */
function editedAndReported(g: Obj, edit: (G: Obj) => void): World {
  const G = copyOf(g);
  edit(G);
  return quietly(() => savedAndReported(G));
}
/** A discovery of the content, as a realm holds it. */
function aDiscovery(id: string): Obj {
  const d = objects(SAGE_DISCOVERIES_P).find((x) => x['id'] === id);
  if (!d) throw new Error(`the discoveries have no ${id}`);
  return copyOf(d);
}

/** The treasury ledger (computeOrderLedgerP, on realm 0's report as the engine builds it from each world) against the
 *  turn: what it takes from realm 0's treasury as the orders' phase is played (the treasury after the phase played
 *  without them, less the treasury after it with them), and what they add to the wages Early Winter charges (its
 *  reckoning after the phase with them, less after it without them, each hero who served before at his wage without
 *  them: the companies and heroes they bring). Each kind of THE_LEDGERS_THE_TURN_AGREES_WITH and
 *  THE_LEDGERS_THE_TURN_DISAGREES_WITH is one hero's order, in a province of his own, in a world of its own. */
export function theLedgerAgainstTheTurn(c: Copies): ALedgerComparison[] {
  const { g, king, capital, land, at } = aWorldForTheOrders();
  const free = land.filter((p) => p !== capital);
  // (settled by Humans, its garrison empty: a seeded world's races differ after another world is made in the process)
  const take = (...types: string[]): Obj => {
    const p = free.shift();
    if (!p) throw new Error('the staged world has too few provinces for the ledgers');
    p['race'] = 'Human';
    p['garrisonArmies'] = [];
    p['armyTypes'] = types;
    return p;
  };
  let unitN = 0;
  const company = (type: string): Obj => ({
    type,
    quality: 'Average',
    race: 'Human',
    unitName: `Ledger Company ${String(unitN++)}`,
  });
  const recruit = (...ticks: string[]): AnOrderInItsFields => ({ action: 'Recruit Armies', target: ticks.join(',') });
  const beast = 'Great Bears';
  if (!(KC_UNIT_CLASS as Record<string, readonly string[]>)['creature']?.includes(beast))
    throw new Error(`${beast} are no creature`);
  interface AStagedLedger {
    readonly kind: AKindOfLedger;
    readonly hero: Obj;
    readonly orders: readonly AnOrderInItsFields[];
    readonly edit?: (G: Obj) => void;
    /** a change to a copy of the report the ledger reads (an older report: the prices it names left out) */
    readonly onTheReport?: (report: Obj) => void;
  }
  const staged: AStagedLedger[] = [];
  const stage = (
    kind: AKindOfLedger,
    hero: Obj,
    orders: readonly AnOrderInItsFields[],
    edit?: (G: Obj) => void,
    onTheReport?: (report: Obj) => void,
  ) => staged.push({ kind, hero, orders, ...(edit ? { edit } : {}), ...(onTheReport ? { onTheReport } : {}) });
  stage('a company of the province raised into his column', at(take('Men-at-Arms')), [recruit('Men-at-Arms|1')]);
  // the founder's capital raises two of a kind a turn (its armyTypes staged)
  capital['armyTypes'] = ['Yeoman Longbows'];
  stage('two companies of one kind raised at the capital', at(capital), [recruit('Yeoman Longbows|2')]);
  stage('a garrison company raised', at(take('Human Garrison')), [recruit('Human Garrison|1')]);
  {
    const p = take();
    const band = { ...company('Free Lances'), id: 'merc_staged_ledger', location: p['id'], isSea: false };
    g['mercenaries'] = [...objects(g['mercenaries']), band];
    stage('a mercenary band hired', at(p), [recruit(`merc:${band.id}`)]);
  }
  // a wandering hero of the realm's creed, of some renown, in a province of his own; and the hero who hires him
  const wanderer = (p: Obj) => at(p, { player: null, alignment: 'Good', skills: { melee: 3, tactical: 2 } });
  {
    const p = take();
    const w = wanderer(p);
    stage('a wandering hero hired', at(p), [{ action: 'Hire Hero', target: String(w['id']) }]);
  }
  {
    const p = take();
    const w = wanderer(p);
    stage(
      'a wandering hero hired by a realm with Granaries',
      at(p),
      [{ action: 'Hire Hero', target: String(w['id']) }],
      (G) => {
        realmZeroIn(G)['discoveries'] = [aDiscovery('sd17')];
      },
    );
  }
  const supplyDepots = (G: Obj) => {
    realmZeroIn(G)['discoveries'] = [aDiscovery('sd55')];
  };
  stage(
    'a company raised by a realm with Supply Depots, under its cap',
    at(take('Men-at-Arms')),
    [recruit('Men-at-Arms|1')],
    supplyDepots,
  );
  {
    // in its world, a hero of the realm elsewhere leading a hundred levies: their savings fill the cap (5% of the
    // realm's base tax)
    const host = at(take());
    const levies = Array.from({ length: 100 }, () => company('Shieldwall Levies'));
    stage(
      'a company raised by a realm with Supply Depots, past its cap',
      at(take('Men-at-Arms')),
      [recruit('Men-at-Arms|1')],
      (G) => {
        supplyDepots(G);
        heroIn(G, host)['armies'] = copyOf(levies);
      },
    );
  }
  {
    const hostLeader = at(take('Men-at-Arms'));
    stage("a company raised into the Host-Leader's column", hostLeader, [recruit('Men-at-Arms|1')], (G) => {
      G['_minorHolders'] = { hostleader: { charId: hostLeader['id'] } };
    });
  }
  stage('a beast raised by a Druid 5 hero', at(take(beast), { skills: { druid: 5 } }), [recruit(`${beast}|1`)]);
  stage('a beast raised by a Druid 6 hero', at(take(beast), { skills: { druid: 6 } }), [recruit(`${beast}|1`)]);
  {
    const p = take();
    p['battleGraves'] = [{ type: 'Men-at-Arms', quality: 'Veteran', race: 'Human', unitName: 'The Fallen Spears' }];
    stage('Harvest the Field', at(p), [{ action: 'Harvest the Field', target: '' }], (G) => {
      realmZeroIn(G)['alignment'] = 'Undead';
    });
  }
  {
    const p = take('Stone Giants');
    p['features'] = [{ name: 'Staged Stones', index: 0, ritualSite: true, discovered: true }];
    stage('the Rite of the Wild Hunt', at(p), [{ action: 'Perform Rite', target: 'Wild Hunt' }], (G) => {
      realmZeroIn(G)['alignment'] = 'Pagan';
    });
  }
  {
    // the Broker buys word from a province of a Neutral realm (the king gives it): its price, from the report's
    // prices, or its row's on a report that names none (P1-11d8)
    const spy = [{ action: 'Broker', target: `spy:${String(take()['id'])}` }];
    const neutral = (G: Obj) => {
      realmZeroIn(G)['alignment'] = 'Neutral';
    };
    stage('word bought from a province by the Broker', king, spy, neutral);
    stage('word bought from a province, on a report that names no price', king, spy, neutral, (report) => {
      const prices = report['orderPrices'];
      if (isObj(prices)) delete prices['brokerSpy'];
    });
  }
  const goldOf = (G: Obj) => Number(realmZeroIn(G)['gold']);
  return staged.map((s) => {
    const world = editedAndReported(g, s.edit ?? (() => undefined));
    const orders = { [String(s.hero['id'])]: s.orders };
    const without = theTurnPlaysThePhases(world.state, {}).G;
    const withThem = theTurnPlaysThePhases(world.state, orders).G;
    // (the wage of each hero who served before, as it was without the orders: a skill he gains by them, at the dice's
    // will, raises his wage, which is no wage the orders bring)
    const served = new Map(
      objects(without['characters'])
        .filter((h) => h['player'] === 0)
        .map((h) => [h['id'], h['pay']]),
    );
    for (const h of objects(withThem['characters'])) if (served.has(h['id'])) h['pay'] = served.get(h['id']);
    const turn = {
      spend: goldOf(without) - goldOf(withThem),
      'new wages': theWagesEarlyWinterCharges(withThem) - theWagesEarlyWinterCharges(without),
    };
    const report = copyOf(world.report);
    s.onTheReport?.(report);
    return { ...compare(s.kind, c.theLedgerOn(report, orders), { answer: turn, changed: false }), kind: s.kind };
  });
}

/** The Practice Skill orders the note cases stage, each by a hero practising Melee alone in a province of his own, in a
 *  world of its own: those the note and the turn agree on, and those it is known to get wrong (question 43): a Human of
 *  a Human realm (the turn's quick learner, ×1.5) and a hero at level 5 (the turn makes no roll). */
export const THE_PRACTICE_NOTES_THE_TURN_AGREES_WITH = [
  'an Elven hero of a Human realm at Melee 0',
  'an Elven hero of a Human realm at Melee 1',
  'an Elven hero of a Human realm at Melee 2',
  'an Elven hero of a Human realm at Melee 3',
  'an Elven hero of a Human realm at Melee 4',
  'a Human hero of an Elven realm at Melee 2',
  'an Elven hero at Melee 0, his realm with Astronomical Tables',
  'an Elven hero at Melee 1, his realm with Blooded Retinues (Melee and Archery)',
  'an Elven hero at Melee 1, his realm with Tradecraft Manuals (Spy and Thief)',
] as const;
export const THE_PRACTICE_NOTES_THE_TURN_DISAGREES_WITH = [
  'a Human hero of a Human realm at Melee 2',
  'an Elven hero of a Human realm at Melee 5',
] as const;
export type AKindOfPracticeNote =
  | (typeof THE_PRACTICE_NOTES_THE_TURN_AGREES_WITH)[number]
  | (typeof THE_PRACTICE_NOTES_THE_TURN_DISAGREES_WITH)[number];
/** One staged Practice Skill order compared: the chance the note quotes and the level it names, and the chance the
 *  turn rolls against at the level it reads (none: it makes no roll); with its kind. */
export interface APracticeNoteComparison extends Comparison {
  readonly kind: AKindOfPracticeNote;
}
/** The chance a Practice Skill note quotes and the level it names ("Improvement: N% at <skill> L."), from its words. */
function theNotesChance(markup: string): Obj {
  const said = /Improvement: (\d+)% at \S+ (\d+)\./.exec(theWordsOf(markup));
  return said ? { chance: Number(said[1]), level: Number(said[2]) } : { '(the note says)': theWordsOf(markup) };
}
const THE_PRACTICE_ROLLS = ['a hero practises a skill and improves', 'a hero practises a skill but makes no progress'];
/** The chance the turn rolls a hero's practice against, and the level it reads, from the line it writes of him. */
function theTurnsChance(facts: readonly Obj[], heroName: unknown): Obj {
  const his = facts.filter((f) => f['heroName'] === heroName);
  const rolled = his.find((f) => THE_PRACTICE_ROLLS.includes(String(f['kind'])));
  if (rolled) {
    const why = isObj(rolled['theChance']) ? rolled['theChance'] : {};
    return { chance: rolled['chance'], level: why['level'] };
  }
  if (his.some((f) => f['kind'] === 'a skill is drilled as far as practice can take it'))
    return { chance: '(no roll: drilled as far as practice can take it)', level: 5 };
  return { '(the turn says)': his.map((f) => String(f['kind'])).join('; ') };
}

/** The Practice Skill note (orderChanceNote, on realm 0's report as the engine builds it from each world) against the
 *  chance the turn rolls (its phase played on a copy of the state): each kind of
 *  THE_PRACTICE_NOTES_THE_TURN_AGREES_WITH and THE_PRACTICE_NOTES_THE_TURN_DISAGREES_WITH, its race, its realm's race
 *  and its discoveries staged. */
export function thePracticeNoteAgainstTheTurn(c: Copies): APracticeNoteComparison[] {
  const { g, capital, land, at } = aWorldForTheOrders();
  const free = land.filter((p) => p !== capital);
  const take = (): Obj => {
    const p = free.shift();
    if (!p) throw new Error('the staged world has too few provinces for the practice notes');
    return p;
  };
  const realmOf =
    (race: string, discoveries: readonly string[] = []) =>
    (G: Obj) => {
      const r = realmZeroIn(G);
      r['race'] = race;
      r['discoveries'] = discoveries.map(aDiscovery);
    };
  const staged: [AKindOfPracticeNote, string, number, (G: Obj) => void][] = [
    ...[0, 1, 2, 3, 4].map((l): [AKindOfPracticeNote, string, number, (G: Obj) => void] => [
      // (each name of the list, as its level makes it)
      THE_PRACTICE_NOTES_THE_TURN_AGREES_WITH[l] ?? 'an Elven hero of a Human realm at Melee 0',
      'Elven',
      l,
      realmOf('Human'),
    ]),
    ['a Human hero of an Elven realm at Melee 2', 'Human', 2, realmOf('Elven')],
    ['an Elven hero at Melee 0, his realm with Astronomical Tables', 'Elven', 0, realmOf('Human', ['sd26'])],
    [
      'an Elven hero at Melee 1, his realm with Blooded Retinues (Melee and Archery)',
      'Elven',
      1,
      realmOf('Human', ['sd76']),
    ],
    [
      'an Elven hero at Melee 1, his realm with Tradecraft Manuals (Spy and Thief)',
      'Elven',
      1,
      realmOf('Human', ['sd61']),
    ],
    ['a Human hero of a Human realm at Melee 2', 'Human', 2, realmOf('Human')],
    ['an Elven hero of a Human realm at Melee 5', 'Elven', 5, realmOf('Human')],
  ];
  const heroes = staged.map(([, race, level]) => at(take(), { race, skills: { melee: level } }));
  return staged.map(([kind, , , edit], i) => {
    const hero = heroes[i] ?? {};
    const world = editedAndReported(g, edit);
    const card = objects(world.report['characters']).find((h) => h['id'] === hero['id']);
    if (!card) throw new Error(`the staged report has no hero for ${kind}`);
    const orders = { [String(hero['id'])]: [{ action: 'Practice Skill', target: 'melee' }] };
    const note: unknown = c.thePracticeNoteOn(world.report, orders, card, 0);
    const turn = theTurnsChance(theTurnPlaysThePhases(world.state, orders).facts, hero['name']);
    return { ...compare(kind, theNotesChance(String(note)), { answer: turn, changed: false }), kind };
  });
}

/** The comrades the co-trainer cases stage, each beside (or near) a hero practising Melee 1 in a season, in a province
 *  of his own: whether his Practice Skill field reads the comrade's Melee as the skill practised beside him, and
 *  whether the turn counts the comrade as one he practises with (a peer, a mentor or a pupil). */
export const THE_COMRADES_AT_PRACTICE = [
  'a comrade practising Melee beside him in the same season',
  'a comrade of a higher level practising Melee beside him',
  'a comrade of a lower level practising Melee beside him',
  'a comrade practising Archery beside him',
  'a comrade practising Melee beside him in another season',
  'a comrade practising Melee in the province next door',
  'a comrade who marched to him the season before',
  'a comrade who marched away the season before',
  'a fallen comrade practising Melee beside him',
  'a hero of another realm practising Melee beside him',
] as const;
export type AKindOfComradeAtPractice = (typeof THE_COMRADES_AT_PRACTICE)[number];
/** One staged comrade compared: whether the form and the turn count him as practising Melee with the hero; with its
 *  kind. */
export interface AComradeAtPracticeComparison extends Comparison {
  readonly kind: AKindOfComradeAtPractice;
}
/** Whether the turn counts the hero `comrade` as one `heroName` practises with: named among his peers, as his mentor
 *  or among his pupils, in the line it writes of his practice. */
function theTurnCountsHimBeside(facts: readonly Obj[], heroName: unknown, comrade: unknown): boolean {
  const rolled = facts.find((f) => f['heroName'] === heroName && THE_PRACTICE_ROLLS.includes(String(f['kind'])));
  if (!rolled) throw new Error(`the turn rolled no practice for ${String(heroName)}`);
  const why = isObj(rolled['theChance']) ? rolled['theChance'] : {};
  const peers: unknown[] = Array.isArray(why['peerNames']) ? why['peerNames'] : [];
  return (
    peers.includes(comrade) ||
    why['mentorName'] === comrade ||
    objects(rolled['pupils']).some((p) => p['name'] === comrade)
  );
}

/** The comrades a hero's Practice Skill field counts as practising beside him (practiceCompanionSkill, on realm 0's
 *  report as the engine builds it, its fields holding the orders staged) against the co-trainers the turn counts (its
 *  phases played on a copy of the state): each kind of THE_COMRADES_AT_PRACTICE, the hero and his comrade each in a
 *  province of their own (and the one next door). */
export function theCoTrainersAgainstTheTurn(c: Copies): AComradeAtPracticeComparison[] {
  const { g, capital, land, at, nextTo } = aWorldForTheOrders();
  const used = new Set<unknown>([capital['id']]);
  /** A province of the realm and one next door, neither used before (the heroes of another case stand there with no
   *  orders: they practise beside no one). */
  const aPair = (): [Obj, Obj] => {
    for (const p of land) {
      if (used.has(p['id'])) continue;
      const next = nextTo(p).find((q) => land.includes(q) && !used.has(q['id']));
      if (!next) continue;
      used.add(p['id']).add(next['id']);
      return [p, next];
    }
    throw new Error('the staged world has too few provinces for the co-trainers');
  };
  const practise = (skill = 'melee'): AnOrderInItsFields => ({ action: 'Practice Skill', target: skill });
  const rest: AnOrderInItsFields = { action: 'Rest', target: '' };
  const march = (to: Obj): AnOrderInItsFields => ({ action: 'Move', target: `prov:${String(to['id'])}` });
  interface AStagedComrade {
    readonly kind: AKindOfComradeAtPractice;
    readonly hero: Obj;
    readonly comrade: Obj;
    /** The season the hero practises in. */
    readonly ph: number;
    readonly orders: Record<string, readonly AnOrderInItsFields[]>;
  }
  const staged: AStagedComrade[] = [];
  const stage = (
    kind: AKindOfComradeAtPractice,
    where: (here: Obj, next: Obj) => [Obj, Obj],
    heroOrders: readonly AnOrderInItsFields[],
    comradeOrders: readonly AnOrderInItsFields[],
    comradeFields: Obj = {},
  ) => {
    const [here, next] = aPair();
    const [heroAt, comradeAt] = where(here, next);
    const hero = at(heroAt, { race: 'Elven', skills: { melee: 1, archery: 1 } });
    const comrade = at(comradeAt, { race: 'Elven', skills: { melee: 1, archery: 1 }, ...comradeFields });
    staged.push({
      kind,
      hero,
      comrade,
      ph: heroOrders.length - 1,
      orders: { [String(hero['id'])]: heroOrders, [String(comrade['id'])]: comradeOrders },
    });
  };
  const beside = (here: Obj): [Obj, Obj] => [here, here];
  const apart = (here: Obj, next: Obj): [Obj, Obj] => [here, next];
  stage('a comrade practising Melee beside him in the same season', beside, [practise()], [practise()]);
  stage('a comrade of a higher level practising Melee beside him', beside, [practise()], [practise()], {
    skills: { melee: 3 },
  });
  stage('a comrade of a lower level practising Melee beside him', beside, [practise()], [practise()], {
    skills: { melee: 0 },
  });
  stage('a comrade practising Archery beside him', beside, [practise()], [practise('archery')]);
  stage('a comrade practising Melee beside him in another season', beside, [practise()], [rest, practise()]);
  stage('a comrade practising Melee in the province next door', apart, [practise()], [practise()]);
  {
    const [here, next] = aPair();
    const hero = at(here, { race: 'Elven', skills: { melee: 1 } });
    const comrade = at(next, { race: 'Elven', skills: { melee: 1 } });
    staged.push({
      kind: 'a comrade who marched to him the season before',
      hero,
      comrade,
      ph: 1,
      orders: { [String(hero['id'])]: [rest, practise()], [String(comrade['id'])]: [march(here), practise()] },
    });
  }
  {
    const [here, next] = aPair();
    const hero = at(here, { race: 'Elven', skills: { melee: 1 } });
    const comrade = at(here, { race: 'Elven', skills: { melee: 1 } });
    staged.push({
      kind: 'a comrade who marched away the season before',
      hero,
      comrade,
      ph: 1,
      orders: { [String(hero['id'])]: [rest, practise()], [String(comrade['id'])]: [march(next), practise()] },
    });
  }
  // (fallen in the turn just played: the report still lists him, as fallen)
  stage('a fallen comrade practising Melee beside him', beside, [practise()], [practise()], {
    alive: false,
    killedThisTurn: true,
  });
  stage('a hero of another realm practising Melee beside him', beside, [practise()], [practise()], { player: 1 });
  const world = quietly(() => savedAndReported(g));
  return staged.map((s) => {
    const card = objects(world.report['characters']).find((h) => h['id'] === s.hero['id']);
    if (!card) throw new Error(`the staged report has no hero for ${s.kind}`);
    const companion: unknown = c.thePracticeCompanionOn(world.report, s.orders, card, s.ph);
    const facts = theTurnPlaysThePhases(world.state, s.orders).facts;
    return {
      ...compare(s.kind, companion === 'melee', {
        answer: theTurnCountsHimBeside(facts, s.hero['name'], s.comrade['name']),
        changed: false,
      }),
      kind: s.kind,
    };
  });
}
