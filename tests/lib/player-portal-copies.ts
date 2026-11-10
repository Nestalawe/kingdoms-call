// The player portal's copies that read a page file no test can import (plan P1-11a, Decisions 5, 6 and 7; since P1-11e43
// the copies' values, worlds and checks are tests/lib/the-worlds-and-the-checks-of-the-portals-forecasts-and-copies-against-the-turn.ts's,
// and the order form's forecasts, its ledger, its notes and its order list are imported from their files there, with
// no vm). tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts checks what is loaded here.
//
// The player page's files of src/ui/player/ that start the page as they load (its database client: "kc-config.js did
// not load") can't be imported by a test: the army card (report.ts), the Druid a hero needs (skills-and-projections.ts),
// the Explore forecast, the Move field and the target field of an order (order-targets.ts), the Cast Spell tables
// (order-chances.ts, titles.ts) and the Move field's last direction (move-analysis.ts). So their copies are read here by
// their syntax tree (tests/lib/source.ts) and run in a context of their own, with the data file run beside them as a
// script (the content as the player page holds it, before the engine rewrites the item catalogue's tiers as it loads),
// the forecasts they call read the same way, and the names src/shared/ hands the portal, as it imports them. A copy
// written inline in a longer function is read by its statements (statementsBetween) and run as a function of what they
// read.
import vm from 'node:vm';
import * as theRulesTheSharedDoorHandsThePortal from '../../src/shared/the-engines-rules-the-player-portal-shares.ts';
import { getFlyCapability } from '../../src/engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { initializersOf, scriptOf, sourceOf, statementsBetween, type SourceOptions } from './source.ts';
import {
  COPY_FUNCTIONS,
  isObj,
  type Copies,
  type TheOrderFormsSpells,
} from './the-worlds-and-the-checks-of-the-portals-forecasts-and-copies-against-the-turn.ts';

// ── The copies ────

/** Where the order form says a hero will stand (predictedLocation), and since P1-11e10 what it reads: the march the
 *  turn refuses and the relation at a border, and its one answer a refresh (the report it was kept for, the answers,
 *  the fields it was worked out from); since P1-11e11 his move pools as the report gives them; since P1-11e12 the step
 *  the turn takes toward a far province. Since P1-11e41 the forecast reads the orders the page hands it (its two readers
 *  of them), as whereAHeroStandsAfterTheOrdersBefore; predictedLocation is the page's (THE_PAGES_SIDE_OF_A_FORECAST). */
const THE_MARCH_FORECASTS_DECLARATIONS = [
  'theOrderField',
  'theRecruitBoxesOf',
  'hisMovePoolsAsTheReportGivesThem',
  'theRelationAMarchMeetsAtTheBorderOf',
  'aMarchTheTurnRefuses',
  'theStepTowardAFarProvinceTheTurnTakes',
  'theForecastsReport',
  'theForecastsAnswers',
  'whatTheForecastOfThePhasesBeforeReads',
  'whereAHeroStandsAfterTheOrdersBefore',
];
/** The page's side of a forecast (P1-11e41): the order a page's field holds (getOrderTarget, moved from the forecasts'
 *  file), the snapshot of the orders the form holds, and predictedLocation, which hands both to the forecast. */
const THE_PAGES_SIDE_OF_A_FORECAST = [
  'theValueOfAField',
  'getOrderTarget',
  'theOrdersTheFormHolds',
  'predictedLocation',
];
/** The copies left (and the tables and helpers they read) by file, as the player portal declares them. */
const COPIES: Record<string, string[]> = {
  // druidNeedP feeds the portal's level of the hero's Druid to the engine's rule (since P1-11b3; the army card reads the
  // engine's two sets of beasts, and asks its Druid mastery's guard, through src/shared/ since P1-11d12)
  'ui/player/skills-and-projections.ts': [
    'druidNeedP',
    // (the word of a unit's race on its label, and a wandering hero's wage, which the Broker's field shows: P1-11d3)
    'HUMANOID_RACES_UI',
    'PRIMAL_SUBRACE_CLASS',
    'formatRace',
    // (and the label of a company, which the Blood Offering's rows show: P1-11d3; and the note under an order that
    // quotes its chance, which the Practice Skill field shows: P1-11d4)
    // (since P1-11e42 the note, its line and effMagicLvl are the ledger's file's, below)
    'armyLabel',
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
    // (since P1-11e27 the words under a Blood Offering's rows: what the turn gives and raises)
    'theBloodOfferingsHint',
    'buildTargetField',
  ],
  // the order form's forecasts (P1-11e3: one file): the order a page's field holds (P1-11d1: the fields stood in below),
  // where a hero will stand after his orders so far (P1-11d1: the Explore forecast and the Move field read it), what he
  // will carry and lead, and a province's garrison hold (P1-11d2: the forms of the later phases read them), with the
  // units a Recruit musters and which go to the garrison; since P1-11e10 the march the turn refuses, asked on the column
  // the Move note counts, and the forecast's one answer a refresh; and since P1-11e10 the column the Move note counts
  // (P1-11d8: its beasts of the Wild Hunt are the rite's row's number), with the sea lift, the ships and the orders it
  // can't count, and a hero's skill as the report counts it (skillEff: druidNeedP, exploreGainFor and the army card
  // read it), which the march forecast reads (moved from move-analysis.ts and items-and-heroes.ts, no statement changed)
  'ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts': [
    'PO_SEA_TYPES',
    'PO_CARRIER_TYPES',
    'PO_AERIAL_TYPES',
    'PO_PROJECTED_FOOT',
    'takesHalfAHullAboardOrIsYetToBeRaised',
    'poSeaAnalysis',
    'PO_UNCOUNTABLE_ACTIONS',
    'PO_UNCOUNTABLE_SPELLS',
    'theColumnAHeroMarchesWithInAPhase',
    'effSkillP',
    ...THE_MARCH_FORECASTS_DECLARATIONS,
    'whatAHeroCarriesAsAPhaseBegins',
    'GARRISON_UNIT_TYPES_P',
    '_projRecruitUnits',
    // since P1-11e19 where the companies a Recruit, a hand-over and a Pick Up move go, by the turn's rules
    'asTheReportShowsIt',
    'theCompanyAsTheFormCarriesIt',
    'theRoomHisBeastCommandLeaves',
    'whereTheCompaniesARecruitRaisesMuster',
    // (since P1-11e29 the same, asked by the treasury ledger)
    'whereTheCompaniesAHerosRecruitRaisesMusterOnTheseOrders',
    'whatAComradeTakesOfAHandOver',
    // since P1-11e17 one replay of the phases' orders, which the three read
    'theFormsReplayOfThePhasesBefore',
    // (since P1-11e20 a phase's items handed over in the turn's order of its heroes)
    'theHeroesInTheOrderTheTurnHasThemActInAPhase',
    'theItemsAPhasesOrdersHandOver',
    'theItemsAHeroHandsOver',
    'theGarrisonTheReportShows',
    'theCompaniesAPhasesOrdersAddToEachGarrison',
    'theGarrisonAPickUpOfThePhaseSees',
    'theGarrisonsAfterAPhase',
    'theCompaniesAHeroLeadsAfterAPhase',
    'theCompaniesTheReplayGivesTheHeroOfId',
    'whatAGarrisonHoldsAsAPhaseBegins',
    'whatAHeroLeadsAsAPhaseBegins',
  ],
  // the page's side of the forecasts (P1-11e41): the report and the orders its form holds, handed to each, by the names
  // the page's files ask them by
  'ui/player/the-orders-the-form-holds-handed-to-its-forecasts.ts': [
    ...THE_PAGES_SIDE_OF_A_FORECAST,
    'projectedMoveHost',
    'predictedItems',
    'projectedGarrison',
    'projectedLedArmies',
    // (since P1-11e42 the ledger, the note, the order list and the magic levels, by the page's names)
    'theOrdersTheFormHoldsForTheHero',
    'computeOrderLedgerP',
    'orderChanceNote',
    'actionsFor',
    'projectedMagicLevels',
  ],
  // the mastery orders' table (P1-11d3: the order list's gates read it), each order's name, skill and level its row's
  // (P1-11d10: the content's rows run beside the copies) and its target and hint the form's own
  'ui/player/l79-orders.ts': ['THE_FORMS_FIELDS_OF_EACH_MASTERY_ORDER', 'L79_ORDERS'],
  // and the order list a hero's form offers (P1-11d3), with the tables and checks it reads
  'ui/player/items-and-heroes.ts': [
    'DIRECTIONS',
    // (the Send Item field's list of items and its recipients: P1-11e18)
    'ITEM_TIER_NAME_P',
    'ITEM_TIER_COLOUR_P',
    'itemTierTagP',
    'isPreOrderIdP',
    'orderTargetCharsP',
    'preOrderTagP',
  ],
  'ui/player/move-analysis.ts': ['lastMoveDirOf'],
  // since P1-11e42 in a file of their own, on the report and the orders handed them: the treasury ledger at the top of
  // the orders (P1-11d4: what the orders will spend and add to the wages), the note under an order that quotes its
  // chance (the Practice Skill note, with the skills' names it gives), the order list a hero's form offers (P1-11d3)
  // with the tables and checks it reads, a wandering hero's wage (the Broker's field and the ledger), and the level of a
  // magic school the form offers spells by
  'ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts': [
    'SKILL_LABELS',
    'RUMOUR_COST_BY_POWER_P',
    'ACTIONS',
    'ALIGN_ACTIONS',
    'gdAlreadyBuiltP',
    'rawSkillLvl',
    'skillsUnseenP',
    'ACTION_DISPLAY_ORDER',
    '_actionRank',
    'theOrdersTheFormOffersAHero',
    'heroHireWageOfP',
    'theTreasuryLedgerOnTheseOrders',
    'chanceLine',
    'theNoteUnderAnOrderThatQuotesItsChance',
    'effMagicLvl',
  ],
};
const ARMY_CARD = 'ui/player/report.ts';
/** The copies written inline, inside a longer function: each read by its statements (tests/lib/source.ts's
 *  statementsBetween) and run as a function of what those statements read. The army card is the "Armies leading" part
 *  of a hero's card on the player's report screen (renderReportView). */
const statementCopies = (opts: SourceOptions) => `
// The army card's Druid lines for one unit \`a\` of the hero \`c\`: the strength left of a unit of 1,000 by a Druid
// shortfall (the card's own sum, rounded down as the battle rounds it: R-122), the Druid mastery bonus in percent, and
// the shortfall.
function armyCardDruidLines(a, c, report) {
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'druLevel', 'druLevel', opts)}
  let druidUnits = 0, druidShort = 0;
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'creature', 'mastery', opts)}
  return { strengthOfAThousand: Math.floor(1000 * theShareHisShortfallLeaves), mastery, shortfall };
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
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'creature', 'totalStr+=bs;', opts)}
  return bs;
}
// The army card's upkeep for the column \`arr\` the hero \`c\` leads, as its "💰 Upkeep" figure gives it: the wage it
// adds for each unit, after the strength statements its loop runs first (P1-11e34).
function armyCardUpkeep(arr, c, report) {
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'kingdom', 'kingdom', opts)}
  ${statementsBetween(ARMY_CARD, 'renderReportView', 'druLevel', 'druidShort', opts)}
  for (const a of arr) {
    ${statementsBetween(ARMY_CARD, 'renderReportView', 'creature', 'mast', opts)}
  }
  return totalCost;
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
/** The player portal's copies, read from `src` (default: this checkout's src/), run with the data file, the mastery
 *  orders' rows (L79_ORDERS reads them) and kc-safe (kcHtml: the army card's notes) beside them, and the names
 *  src/shared/ hands the portal (effMagicLvl calls theLevelAHerosSkillCountsAt). */
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

/** The order form's Cast Spell tables, and its two functions that read them, read from `src` (default: this
 *  checkout's src/) by their statements and run beside the data file and kc-safe, with the names src/shared/ hands the
 *  portal: order-chances.ts whole (its tables; since P1-11e42 effMagicLvl and projectedMagicLevels from the ledger's file), the spells' hints and the rows
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
      THE_MARCH_FORECASTS_DECLARATIONS,
      opts,
    ),
    sourceOf(
      'ui/player/the-orders-the-form-holds-handed-to-its-forecasts.ts',
      [...THE_PAGES_SIDE_OF_A_FORECAST, 'theOrdersTheFormHoldsForTheHero', 'projectedMagicLevels'],
      opts,
    ),
    // (since P1-11e42 the magic levels and the skills' names: the ledger's file's)
    sourceOf(
      'ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts',
      ['SKILL_LABELS', 'rawMagicLvl', 'effMagicLvl', 'theMagicLevelsAHerosPractisesBeforeAPhaseMayRaise'],
      opts,
    ),
    sourceOf(
      'ui/player/items-and-heroes.ts',
      ['provDirectionLabel', 'isPreOrderIdP', 'orderTargetCharsP', 'preOrderTagP', 'realmOfP', 'realmNameP'],
      opts,
    ),
    sourceOf('ui/player/map-symbols.ts', ['leadsArmiesP', 'realmOptStyleP'], opts),
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
