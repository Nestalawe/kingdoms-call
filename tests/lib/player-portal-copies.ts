// The player portal's copies of the engine's rules, as the checks call them (plan P1-11a, Decisions 5, 6 and 7; since
// P1-11e43 the copies' values, worlds and checks are tests/lib/the-worlds-and-the-checks-of-the-portals-forecasts-and-copies-against-the-turn.ts's,
// and the order form's forecasts, its ledger, its notes and its order list are imported from their files there).
// tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts checks what is loaded here.
//
// Since P1-13e9 every copy written as a whole declaration is imported from its page file (src/ui/player/: the files
// below the page's start, which import in Node since P1-13e8), and the page's globals it reads are staged on
// globalThis as the page holds them: the report it shows (currentReport), the declarations of war its form holds
// (diploChoices) and a stand-in for its fields (document.getElementById), each put back after the call. Since
// P1-13e10 the army card's figures are skills-and-projections.ts's two functions, which report.ts's renderReportView
// calls. A copy written inline in a longer function (the Move field's directions and the Cast Spell rows in
// order-targets.ts's buildTargetField; the spells aimed at a province or a hero in titles.ts's spellSecondaryHtml) is
// read by its statements (tests/lib/source.ts's statementsBetween) and run in a vm as a function of what they read,
// beside the names its file imports, as the page imports them.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as theData from '../../src/content/kingdoms-call-data.ts';
import * as theSharedDoor from '../../src/shared/the-engines-rules-the-player-portal-shares.ts';
import * as kcSafe from '../../src/ui/shared/kc-safe.ts';
import * as kcJoin from '../../src/ui/player/a-list-of-kchtml-pieces-joined-by-a-separator.ts';
import * as itemsAndHeroes from '../../src/ui/player/items-and-heroes.ts';
import * as l79Orders from '../../src/ui/player/l79-orders.ts';
import * as mapSymbols from '../../src/ui/player/map-symbols.ts';
import * as moveAnalysis from '../../src/ui/player/move-analysis.ts';
import * as orderChances from '../../src/ui/player/order-chances.ts';
import * as orderTargets from '../../src/ui/player/order-targets.ts';
import * as skillsAndProjections from '../../src/ui/player/skills-and-projections.ts';
import * as theSpellsHints from '../../src/ui/player/the-hints-the-order-form-shows-below-each-spell.ts';
import * as theForecasts from '../../src/ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import * as theLedger from '../../src/ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';
import * as thePagesSide from '../../src/ui/player/the-orders-the-form-holds-handed-to-its-forecasts.ts';
import * as titles from '../../src/ui/player/titles.ts';
import { initializersOf, SRC, statementsBetween } from './source.ts';
import {
  COPY_FUNCTIONS,
  isObj,
  type Copies,
  type Obj,
  type TheOrderFormsSpells,
} from './the-worlds-and-the-checks-of-the-portals-forecasts-and-copies-against-the-turn.ts';

// ── The page's files a test imports ────

/** The modules the copies' files import that a test can import, by their file under src/. */
const IMPORTABLE: ReadonlyMap<string, Obj> = new Map<string, Obj>([
  ['content/kingdoms-call-data.ts', theData],
  ['shared/the-engines-rules-the-player-portal-shares.ts', theSharedDoor],
  ['ui/shared/kc-safe.ts', kcSafe],
  ['ui/player/a-list-of-kchtml-pieces-joined-by-a-separator.ts', kcJoin],
  ['ui/player/items-and-heroes.ts', itemsAndHeroes],
  ['ui/player/l79-orders.ts', l79Orders],
  ['ui/player/map-symbols.ts', mapSymbols],
  ['ui/player/move-analysis.ts', moveAnalysis],
  ['ui/player/order-chances.ts', orderChances],
  ['ui/player/order-targets.ts', orderTargets],
  ['ui/player/skills-and-projections.ts', skillsAndProjections],
  ['ui/player/the-hints-the-order-form-shows-below-each-spell.ts', theSpellsHints],
  ['ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts', theForecasts],
  [
    'ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts',
    theLedger,
  ],
  ['ui/player/the-orders-the-form-holds-handed-to-its-forecasts.ts', thePagesSide],
  ['ui/player/titles.ts', titles],
]);

/** The names `file` (under src/) imports for its code from the modules a test can import, each as its module exports
 *  it: what a stretch of the file's statements reads. A name from a module no test can import (report.ts's database
 *  client, its screens) is left out, so a stretch that read one would throw. */
function theNamesItImports(file: string): Obj {
  const tree = ts.createSourceFile(file, fs.readFileSync(path.join(SRC, file), 'utf8'), ts.ScriptTarget.Latest);
  const names: Obj = {};
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    if (!clause || clause.phaseModifier === ts.SyntaxKind.TypeKeyword || !bindings || !ts.isNamedImports(bindings))
      continue;
    const from = path.posix.normalize(path.posix.join(path.posix.dirname(file), statement.moduleSpecifier.text));
    const module = IMPORTABLE.get(from);
    if (!module) continue;
    for (const element of bindings.elements)
      if (!element.isTypeOnly) names[element.name.text] = module[(element.propertyName ?? element.name).text];
  }
  return names;
}

/** The function `name` of the module `module` (a page file's export), to call on any values. */
function aFunctionOf(module: Obj, name: string): (...args: unknown[]) => unknown {
  const found = module[name];
  if (typeof found !== 'function') throw new Error(`the player portal has no function ${name}`);
  return (...args) => {
    const answer: unknown = Reflect.apply(found, undefined, args);
    return answer;
  };
}

// ── The page's globals, staged ────

/** The globals the page's files read as they run: the report the page shows, the declarations of war its form holds
 *  (by realm) and its fields, each a property of globalThis, as items-and-heroes.ts declares the first two. */
interface ThePagesGlobals {
  readonly currentReport: unknown;
  readonly diploChoices?: unknown;
  readonly document: unknown;
}

/** `fn`'s answer with the page's globals set to `globals`, each put back as it was after (a global that wasn't there
 *  is taken away again). */
function withThePagesGlobals<T>(globals: ThePagesGlobals, fn: () => T): T {
  const names = Object.keys(globals);
  const before = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  Object.assign(globalThis, globals);
  try {
    return fn();
  } finally {
    for (const [name, was] of before)
      if (was) Object.defineProperty(globalThis, name, was);
      else Reflect.deleteProperty(globalThis, name);
  }
}

/** The orders staged for a check: by hero, then by phase, each { action, target } and since P1-11d1 its recipient or
 *  comrade (`extra`). */
type TheOrdersStaged = Readonly<Record<string, unknown>>;

/** The staged order of the hero `heroId` in the phase `phase`, if any. */
function theOrderStaged(orders: TheOrdersStaged, heroId: string, phase: string): Obj | null {
  const his = orders[heroId];
  const order: unknown = Array.isArray(his) ? his[Number(phase)] : undefined;
  return isObj(order) ? order : null;
}

/** A Recruit's widget (po-target-wrap-…), as the projections of what a hero holds read it: its ticks and its "Muster
 *  to", as the target updateRecruitTarget writes holds them (the ticks, then the destination unless it is the hero
 *  himself). */
function aRecruitsWidget(target: unknown) {
  const tokens = (typeof target === 'string' ? target : '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const ticked = tokens.filter((t) => !t.startsWith('to:'));
  const musterTo = tokens.find((t) => t.startsWith('to:')) ?? 'to:self';
  return {
    querySelector: (selector: string) => (selector === '.po-recruit-dest' ? { value: musterTo } : null),
    querySelectorAll: (selector: string) =>
      selector === 'input[type="checkbox"]:checked' ? ticked.map((value) => ({ value })) : [],
  };
}

/** The page's fields (po-action-<hero>-<phase>, po-target-…, po-extra-…, po-target-wrap-…) standing in for the orders
 *  staged: an order's extra none read as '', a Recruit's widget, and no field for a phase with no order staged. */
function theFieldsOfTheOrders(orders: TheOrdersStaged) {
  return {
    getElementById: (id: string) => {
      const wrap = /^po-target-wrap-(.+)-(\d+)$/.exec(id);
      if (wrap) {
        const order = theOrderStaged(orders, wrap[1] ?? '', wrap[2] ?? '');
        return order?.['action'] === 'Recruit Armies' ? aRecruitsWidget(order['target']) : null;
      }
      const field = /^po-(action|target|extra)-(.+)-(\d+)$/.exec(id);
      const order = field ? theOrderStaged(orders, field[2] ?? '', field[3] ?? '') : null;
      if (!field || !order) return null;
      return {
        value:
          field[1] === 'action'
            ? order['action']
            : field[1] === 'target'
              ? order['target']
              : ([order['extra']].find(Boolean) ?? ''),
      };
    },
  };
}

/** `fn`'s answer on the report `report` and the orders staged, the form holding the declarations of war
 *  `declarations` (none: {}, as the page's diploChoices starts). */
function onTheOrders<T>(report: unknown, orders: unknown, fn: () => T, declarations?: unknown): T {
  const staged: TheOrdersStaged = isObj(orders) ? orders : {};
  return withThePagesGlobals(
    {
      currentReport: report,
      diploChoices: [declarations].find(Boolean) ?? {},
      document: theFieldsOfTheOrders(staged),
    },
    fn,
  );
}
/** `fn`'s answer with no report shown and no order staged: the page's globals as it starts. */
const atRest = <T>(fn: () => T): T => onTheOrders(null, {}, fn);

// ── The copies written inline, read by their statements ────

const TARGET_FIELD = 'ui/player/order-targets.ts';
const SPELL_TARGETS = 'ui/player/titles.ts';

/** `code` run in a vm beside the names `file` imports (and `more`): what its statements read. */
function runBesideItsImports(file: string, code: string, more: Obj = {}): Obj {
  const made: unknown = vm.runInNewContext(`(() => {\n${code}\n})()`, { ...theNamesItImports(file), ...more });
  if (!isObj(made)) throw new Error(`${file}: its statements did not load`);
  return made;
}

/** The army card's figures of the column `arr` the hero `c` leads, on the report `report`
 *  (skills-and-projections.ts's theArmyCardsFiguresOfAColumn, which renderReportView calls): the column's, and each
 *  unit's (`units`). */
function theArmyCardsFigures(arr: unknown, c: unknown, report: unknown): Obj {
  const figures = aFunctionOf(skillsAndProjections, 'theArmyCardsFiguresOfAColumn')(arr, c, report);
  if (!isObj(figures)) throw new Error('the army card has no figures');
  return figures;
}

/** The army card's figures of the one unit `a` the hero `c` leads, on the report `report`. */
function theArmyCardsFiguresOfAUnit(a: unknown, c: unknown, report: unknown): Obj {
  const units = theArmyCardsFigures([a], c, report)['units'];
  const unit: unknown = Array.isArray(units) ? units[0] : undefined;
  if (!isObj(unit)) throw new Error('the army card has no figures for the unit');
  return unit;
}

/** The target field's two stretches (buildTargetField's statements) and its two action spell tables, beside
 *  order-targets.ts's imports and its own names, its fields read through the page's (the globalThis.document staged). */
function theTargetFieldsStatements(): Obj {
  const theFields = {
    getElementById: (id: unknown) => {
      const page: unknown = Reflect.get(globalThis, 'document');
      return aFunctionOf(isObj(page) ? page : {}, 'getElementById')(id);
    },
  };
  return runBesideItsImports(
    TARGET_FIELD,
    `
// The Move field's directions for the hero \`c\` in the phase \`ph\` (buildTargetField's statements, for a fresh Move):
// each option as the field writes it, its value (prov:<id>) and its words, and whether the icy wastes bar a way north
// or south (the note under the field).
function theMoveFieldsDirections(theReport, c, ph) {
  const action = 'Move', target = '';
  const report = theReport || {};
  ${statementsBetween(TARGET_FIELD, 'buildTargetField', 'worldMeta_', 'dirOpts')}
  return { options: dirOpts.map(String), blockedNorth, blockedSouth };
}
// The spells the Cast Spell field offers the hero \`c\` in the phase \`ph\` (buildTargetField's statements from the
// action spells through the rows it builds).
function castSpellRows(report, c, ph) {
  ${statementsBetween(TARGET_FIELD, 'buildTargetField', 'PHASE_SPELLS', '_spellRows')}
  return _spellRows;
}
const tables = {
  PHASE_SPELLS: [...${theOneInitializer(TARGET_FIELD, 'PHASE_SPELLS')}],
  _hsPhase: [...${theOneInitializer(TARGET_FIELD, '_hsPhase')}],
};
return { theMoveFieldsDirections, castSpellRows, tables };`,
    { ...orderTargets, document: theFields },
  );
}

/** The value `name` is declared with in `file` (inside a function), as source: it must be declared there once. */
function theOneInitializer(file: string, name: string): string {
  const found = initializersOf(file, name);
  if (found.length !== 1) throw new Error(`${file}: ${String(found.length)} declarations of ${name}`);
  return found[0] ?? '';
}

// ── The copies ────

/** The player portal's copies, under the checks' names: each page function imported, called on the report and the
 *  orders handed in with the page's globals staged, and the inline copies run by their statements. */
export function playerPortalCopies(): Copies {
  const field = theTargetFieldsStatements();
  const call = aFunctionOf;
  const made: Record<string, (...args: unknown[]) => unknown> = {
    // the level of a magic school the form offers spells by (it feeds the engine's theLevelAHerosSkillCountsAt)
    effMagicLvl: (c, school) => atRest(() => call(theLedger, 'effMagicLvl')(c, school)),
    // exploreGainFor reads the report the page shows (its currentReport): here, the one handed in
    exploreGainOn: (report, c, terrain) =>
      onTheOrders(report, {}, () => call(orderTargets, 'exploreGainFor')(c, terrain)),
    // the share of the province `provId` the hero `c` maps marching in, in the phases before `upTo`
    exploreMoveGainOn: (report, orders, c, upTo, provId) =>
      onTheOrders(report, orders, () => call(orderTargets, 'exploreMoveGainBefore')(c, upTo, provId)),
    // where the hero `heroId` will stand once his orders of the phases before `upTo` are carried out (its id, or
    // null); since P1-11e10 with the declarations of war the form holds (by realm), if any
    predictedLocationOn: (report, orders, heroId, upTo, declarations) =>
      onTheOrders(
        report,
        orders,
        () => {
          const at = call(thePagesSide, 'predictedLocation')(heroId, upTo);
          return isObj(at) ? at['id'] : null;
        },
        declarations,
      ),
    // the compass direction a fresh Move of the phase `ph` opens on, from his Moves before it
    lastMoveDirOn: (report, orders, heroId, ph) =>
      onTheOrders(report, orders, () => call(moveAnalysis, 'lastMoveDirOf')(heroId, ph)),
    theMoveFieldsDirectionsOn: (report, orders, c, ph) =>
      onTheOrders(report, orders, () => call(field, 'theMoveFieldsDirections')(report, c, ph)),
    // what the hero `heroId` will carry once his realm's orders of the phases before `upTo` are carried out (P1-11d2):
    // each item's name, in the order of his pack
    predictedItemsOn: (report, orders, heroId, upTo) =>
      onTheOrders(report, orders, () => {
        const items = call(thePagesSide, 'predictedItems')(heroId, upTo);
        return (Array.isArray(items) ? items : []).map((it: unknown) => (isObj(it) ? it['name'] : undefined));
      }),
    // the companies the hero `heroId` will lead, and those the province `provId` will hold unled, as each phase `upTo`
    // begins (P1-11d2): each as the projection writes it
    projectedLedArmiesOn: (report, orders, heroId, upTo) =>
      onTheOrders(report, orders, () => call(thePagesSide, 'projectedLedArmies')(heroId, upTo)),
    projectedGarrisonOn: (report, orders, provId, upTo) =>
      onTheOrders(report, orders, () => call(thePagesSide, 'projectedGarrison')(provId, upTo)),
    // the companies the Pick Up field of the hero `heroId` offers in the phase `ph` (P1-11e17): the province
    // `provId`'s garrison as the phase begins, with what his comrades leave in it that phase
    thePickUpFieldsGarrisonOn: (report, orders, provId, ph, heroId) =>
      onTheOrders(report, orders, () => call(thePagesSide, 'projectedGarrison')(provId, ph, true, heroId)),
    // The order list the form offers the hero (or the card) `c` (P1-11d3): each order's name, in the list's order;
    // every name the list may hold (ACTIONS); and the mastery orders' table it reads, each order with its skill and
    // its level.
    actionsForOn: (report, c) => onTheOrders(report, {}, () => call(thePagesSide, 'actionsFor')(c)),
    theOrderListsNames: () => theLedger.ACTIONS.slice(),
    theMasteryOrdersOfTheList: () =>
      Object.entries(l79Orders.L79_ORDERS).map(([name, o]) => ({ name, skill: o.skill, level: o.lvl })),
    // The companies the Move note counts in the column of the hero `heroId` marching in the phase `ph` (P1-11d8):
    // each by its name, those the orders before it raise or bind among them.
    theMoveNotesColumnOn: (report, orders, heroId, ph) =>
      onTheOrders(report, orders, () => {
        const host = call(thePagesSide, 'projectedMoveHost')(heroId, ph);
        const armies = isObj(host) ? host['armies'] : null;
        return (Array.isArray(armies) ? armies : []).map((a: unknown) => String(isObj(a) ? a['unitName'] : a));
      }),
    // The target field of the order `saved` ({ action, target, extra }) the hero `c` gives in the phase `ph`, as the
    // form builds it, on the orders staged (P1-11d3: the creed orders' fields): its markup.
    theTargetFieldOn: (report, orders, c, ph, saved) =>
      onTheOrders(report, orders, () => String(call(orderTargets, 'buildTargetField')(c, ph, saved))),
    // What the treasury ledger says the orders staged will spend, and add to the wages (P1-11d4): its two sums.
    theLedgerOn: (report, orders) =>
      onTheOrders(report, orders, () => {
        const ledger = call(thePagesSide, 'computeOrderLedgerP')();
        return isObj(ledger) ? { spend: ledger['spend'], 'new wages': ledger['newWages'] } : null;
      }),
    // The note under the Practice Skill order of the hero `c` in the phase `ph`, its skill as staged (P1-11d4): its
    // markup.
    thePracticeNoteOn: (report, orders, c, ph) =>
      onTheOrders(report, orders, () => String(call(thePagesSide, 'orderChanceNote')(c, 'Practice Skill', ph))),
    // The skill a comrade practises beside the hero `c` in the phase `ph`, as his field reads it (P1-11d4), or ''.
    thePracticeCompanionOn: (report, orders, c, ph) =>
      onTheOrders(report, orders, () => call(orderTargets, 'practiceCompanionSkill')(c, ph)),
    // the army card's four (skills-and-projections.ts's figures, which renderReportView calls), with the page's
    // globals as it starts. Its Druid lines for one unit: the strength left of a unit of 1,000 by a Druid shortfall
    // (the card's own sum, rounded down as the battle rounds it: R-122), the Druid mastery bonus in percent, and the
    // shortfall.
    armyCardDruidLines: (a, c, report) =>
      atRest(() => {
        const unit = theArmyCardsFiguresOfAUnit(a, c, report);
        const strengthOfAThousand = Math.floor(1000 * Number(unit['theShareHisShortfallLeaves']));
        return { strengthOfAThousand, mastery: unit['mastery'], shortfall: unit['shortfall'] };
      }),
    // its sea-transport note for the column `arr` the hero `c` leads, as the words the card shows
    armyCardSeaNote: (arr, c) =>
      atRest(() => {
        const notes = call(skillsAndProjections, 'theArmyCardsAirAndSeaNotesOfAColumn')(arr, c);
        return String(isObj(notes) ? notes['_seaNote'] : undefined);
      }),
    // its strength for one unit `a` of the hero `c`, as its line shows it ("str …"): the unit's kin (its realm's
    // king's and its leader's), a rival kin's leader, a Druid shortfall and the Druid mastery, in the battle's order
    // since R-122 (plan P1-11c1): the shortfall off the unit's base strength first, then its kin, then the mastery
    armyCardUnitStrength: (a, c, report) => atRest(() => theArmyCardsFiguresOfAUnit(a, c, report)['bs']),
    // its upkeep for the column `arr` the hero `c` leads, as its "💰 Upkeep" figure gives it: the wage it adds for
    // each unit (P1-11e34)
    armyCardUpkeep: (arr, c, report) => atRest(() => theArmyCardsFigures(arr, c, report)['totalCost']),
  };
  for (const name of COPY_FUNCTIONS)
    if (typeof made[name] !== 'function') throw new Error(`the player portal has no function ${name}`);
  return made as Copies;
}

/** The order form's Cast Spell tables, and its two functions that read them: order-chances.ts's three tables and
 *  move-analysis.ts's ENCOUNTER_VALID imported, the action spells (buildTargetField's) and the spells aimed at a
 *  province or a hero (spellSecondaryHtml's) by their statements; the Cast Spell rows read the page's fields (a
 *  stand-in for document.getElementById, which the form's count and getOrderTarget read), with no report shown. */
export function theOrderFormsSpells(): TheOrderFormsSpells {
  const field = theTargetFieldsStatements();
  const aimed = runBesideItsImports(
    SPELL_TARGETS,
    `return {
      NEEDS_PROV: [...${theOneInitializer(SPELL_TARGETS, 'NEEDS_PROV')}],
      NEEDS_CHAR: [...${theOneInitializer(SPELL_TARGETS, 'NEEDS_CHAR')}],
    };`,
  );
  const actionSpells = isObj(field['tables']) ? field['tables'] : {};
  const tables: unknown = JSON.parse(
    JSON.stringify({
      SPELLS_BY_SCHOOL: orderChances.SPELLS_BY_SCHOOL,
      SPELL_TO_SCHOOL: orderChances.SPELL_TO_SCHOOL,
      SPELL_REQ_LEVEL: orderChances.SPELL_REQ_LEVEL,
      PHASE_SPELLS: actionSpells['PHASE_SPELLS'],
      _hsPhase: actionSpells['_hsPhase'],
      ENCOUNTER_VALID: moveAnalysis.ENCOUNTER_VALID,
      NEEDS_PROV: aimed['NEEDS_PROV'],
      NEEDS_CHAR: aimed['NEEDS_CHAR'],
    }),
  );
  // the page's fields, as the form reads them by id: here, the values handed in
  const theFieldsHeld = (fields: unknown) => ({
    getElementById: (id: string) => (isObj(fields) && id in fields ? { value: fields[id] } : null),
  });
  const made = {
    tables,
    castSpellRows: (report: unknown, c: unknown, ph: unknown, fields: unknown) =>
      withThePagesGlobals({ currentReport: null, document: theFieldsHeld(fields) }, () =>
        aFunctionOf(field, 'castSpellRows')(report, c, ph),
      ),
    targetField: (report: unknown, c: unknown, spell: unknown) =>
      withThePagesGlobals({ currentReport: report, document: theFieldsHeld({}) }, () =>
        String(aFunctionOf(titles, 'spellSecondaryHtml')(report, c, 0, spell, '', spell)),
      ),
  };
  // (the form's own values: its tables as JSON, its rows and its markup)
  return made as unknown as TheOrderFormsSpells;
}
