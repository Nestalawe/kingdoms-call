// The player portal reaches the engine's rules only through src/shared/ (plan P1-11a4; P1-11a's Decisions 2 and 7).
// src/shared/ re-exports only from src/engine/rules-on-plain-values/, whose files import only src/content and each other
// (tests/static/rules-on-plain-values-import-only-the-content-and-each-other.test.ts). The portal's own files
// (src/ui/player/) import no engine or views file, and declare none of the copies P1-11a4 retired nor any name
// src/shared/ hands them: one function per rule, under the engine's name. So the player page loads no engine file outside
// the folder, and runs none of the engine's set-up. Every import counts: `import … from`, `export … from`, a bare
// `import '…'`, `import(…)` and `require(…)` (TypeScript's preProcessFile reads them all). Until P1-13's
// dependency-cruiser rules do the same. Level 0 (static): it reads the sources and runs nothing.
//
// It fails on its base (P1-11a3) by design: there the copies are still in the portal, and src/shared/ isn't there yet.
// The one exception to refactor-only's "new tests pass before and after" (P1-11a, Decision 7, agreed by Theo).
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The player portal reaches the engine's rules only through `src/shared/` (P1-11a, Decisions 2 and 7): `src/shared/`
// re-exports only from `src/engine/rules-on-plain-values/` (every import, of every kind, of a folder file that is
// there) and declares nothing of its own; no file of `src/ui/player/` imports an engine or a views file, or declares
// (at any depth) a copy P1-11a4, P1-11b3, P1-11b4, P1-11d12 or P1-11d14 retired (`floorNumP`, `unitBaseStrengthP`, …
// `beastCommandCountP`, `DRUID_LEVEL_OF_P`, `TAMED_FLYERS_P`, `PO_FLYING_TYPES`, `PO_LIGHT_TYPES`, `CREATURE_ARMIES_UI`,
// `MONSTER_ARMIES_UI`, `BASIC_EXPLORE_P`, and the tables only they read) or a name
// `src/shared/` hands it; the order form's eight Cast Spell tables are each declared once in the portal, as the call of
// the folder's function that makes it (P1-11c3); the order form's three hex tables (`predictedLocation`, the Move field
// in `buildTargetField`, `lastMoveDirOf`) each call the folder's `theHexNextToAProvinceInADirection`, and no portal file
// holds a table of the six steps from a hex, under any name (P1-11d6); the order list's alignment orders are the
// folder's (P1-11d7): `ACTIONS` reads their five names by slug and writes none, `ALIGN_ACTIONS` is the folder's table
// of their rows by name, `actionsFor` asks its two checks of who may give one, and `KING_ONLY_ACTIONS` is retired; the target
// widget (`buildTargetField`) asks the same two checks, and the places that state a number of an alignment order (the
// widget's words, the Move note's bound beasts, the Blood Offering's hint, the ledger's fallback) read the row's, while
// `ONCE_PER_TURN_ACTIONS` names Call to Arms by its row (P1-11d8); the mastery orders' table (`L79_ORDERS`) imports
// the content's rows, builds each order's name, skill and level from its row, writes none out, and holds the form's
// own fields of every row once (P1-11d10), each hint opening with its row's skill and level (P1-11d13); the Explore
// forecast (`exploreGainFor`) asks the folder's `theShareOfAProvinceAnExploreOrderMaps`, and no portal file reads the
// content's `KC_BASIC_EXPLORE` (P1-11d14); and the player page's modules hold no engine file outside the folder, and
// no views file.
// Level 0 (static): it reads the sources and runs nothing. Red on its base by design (the copies were there; Decision
// 7, agreed by Theo), and on 13 planted faults (in the PR, P1-11a4; P1-11b3's and P1-11b4's retired names on their own
// plants; P1-11d6's, P1-11d7's, P1-11d8's, P1-11d10's and P1-11d14's in their PRs)
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { THE_ALIGNMENT_ORDERS } from '../../src/content/alignment-orders-their-keys-names-creeds-numbers-and-words.ts';
import { THE_MASTERY_ORDERS } from '../../src/content/mastery-orders-their-keys-names-skills-and-levels.ts';
import { filesUnder, ROOT } from '../../tools/build.ts';
import { pageModules } from '../../tools/pages.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const SRC = path.join(ROOT, 'src');
const SHARED = 'shared/';
const RULES = 'engine/rules-on-plain-values/';
const PLAYER = 'ui/player/';
const PLAYER_PAGE = 'kingdoms-call-player-portal.html';

/** The player portal's copies of the engine's rules that P1-11a4, P1-11b3 and P1-11b4 swapped for the engine's
 *  functions, and the tables only they read: none may come back, under these names or any other (the names src/shared/
 *  hands the portal). */
const RETIRED = [
  'floorNumP',
  'unitTypeOfP',
  'UNIT_BASE_STR_P',
  'UNIT_Q_MULT_P',
  'unitBaseStrengthP',
  'ITEM_SLOT_OF_P',
  'isLegendaryItemP',
  'itemSlotP',
  '_ITEM_RACE_ALIAS_P',
  'itemRaceOfP',
  'itemUsableByP',
  'ALIGN_SPECTRUM_PP',
  'alignDistPP',
  'heroHireWagePP',
  'gameMetaP',
  'skillFameLabel',
  'PO_CAVALRY_TYPES',
  'PO_CREATURE_TYPES',
  'PO_MONSTER_TYPES',
  'poAirCarriable',
  'poFlyCapability',
  'actionSpellLimit',
  'combatSpellLimit',
  // P1-11b3: the beast command and the Druid table
  'beastCommandCountP',
  'DRUID_LEVEL_OF_P',
  'TAMED_FLYERS_P',
  // P1-11b4: the sea lift's tables (poSeaAnalysis counts through seaLiftOfAColumn)
  'PO_FLYING_TYPES',
  'PO_LIGHT_TYPES',
  // P1-11d6: the hex step's tables (predictedLocation, the Move field and lastMoveDirOf step by theHexNextToAProvinceInADirection)
  'HEX_DIRS',
  'HEX_DIRS_BUILD',
  'even',
  'odd',
  'EVEN_OFF',
  'ODD_OFF',
  'EV',
  'OD',
  // P1-11d7: the set of the orders the king alone gives (the rows' mark, read by aHeroMayGiveTheAlignmentOrderAsKingOrNot)
  'KING_ONLY_ACTIONS',
  // P1-11d12: the portal's two sets of beasts (the engine's CREATURE_ARMIES and MONSTER_ARMIES, through src/shared/)
  'CREATURE_ARMIES_UI',
  'MONSTER_ARMIES_UI',
  // P1-11d14: the Explore forecast's table of each ground's share (exploreGainFor asks theShareOfAProvinceAnExploreOrderMaps)
  'BASIC_EXPLORE_P',
];

/** The portal's three hex tables (P1-11d6), each as the file and the function that held a table of the six steps from
 *  a hex: they step by the folder's function now. */
const THE_THREE_HEX_TABLES: readonly (readonly [string, string])[] = [
  [
    'ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts',
    'whereAHeroStandsAfterTheOrdersBefore',
  ],
  // (since P1-13e11 the Move field's directions are a function of their own, which buildTargetField calls)
  ['ui/player/order-targets.ts', 'theMoveFieldsDirectionsFromWhereAHeroStandsInAPhase'],
  ['ui/player/move-analysis.ts', 'lastMoveDirOf'],
];

/** The order form's eight Cast Spell tables (P1-11c3), each by the name the form gives it and the folder's function
 *  that makes it (src/engine/rules-on-plain-values/spells-the-order-form-offers-each-school-aim-and-mastery-level.ts):
 *  the form declares each once, by calling the function, and writes no table of spells of its own. */
const THE_ORDER_FORMS_SPELL_TABLES: readonly (readonly [string, string])[] = [
  ['SPELLS_BY_SCHOOL', 'everySpellBySchool'],
  ['SPELL_TO_SCHOOL', 'theSchoolOfEachSpell'],
  ['SPELL_REQ_LEVEL', 'theLevelEachMasterySpellNeeds'],
  ['PHASE_SPELLS', 'theActionSpells'],
  ['_hsPhase', 'theActionSpellsNoMasteryLevelGates'],
  ['ENCOUNTER_VALID', 'theCombatSpellsBySchool'],
  ['NEEDS_PROV', 'theActionSpellsAimedAtAProvince'],
  ['NEEDS_CHAR', 'theActionSpellsAimedAtAHero'],
];
/** The order list's alignment orders (P1-11d7): the folder's two checks of who may give one, which actionsFor asks, and
 *  the function the list (ACTIONS) reads each one's name from, by its row's slug. */
const THE_TWO_CHECKS_OF_WHO_MAY_GIVE_AN_ALIGNMENT_ORDER = [
  'aRealmOfThisCreedMayGiveTheAlignmentOrder',
  'aHeroMayGiveTheAlignmentOrderAsKingOrNot',
];
const THE_NAME_OF_AN_ALIGNMENT_ORDER = 'theNameTheFormWritesOfTheAlignmentOrder';
/** The target widget's (buildTargetField's) alignment orders (P1-11d8): the creeds' orders it gates, each by the
 *  folder's creed check, and the three the king alone gives by the king check too. */
const THE_WIDGETS_CREED_ORDERS = 5;
const THE_WIDGETS_KINGS_ORDERS = 3;
/** The words the portal wrote a number of an alignment order in (P1-11d8): each is the order's row's now, so none of
 *  these may be written again: Call to Arms' grade (twice), the Broker's price (twice, and the ledger's fallback), the
 *  Wild Hunt's beasts, the Blood Offering's tiers (four), and since P1-11e26 the carters' price (the note's and the
 *  ledger's fallback: the report's, else the row's), in the files that read them (the report's and the join form's
 *  texts of the same orders are the words test's, each-alignment-orders-…-as-its-row-says.test.ts: P1-11d9). The
 *  literal that stays ("VETERAN") is not here. */
const THE_FILES_THAT_READ_THE_ROWS_NUMBERS = [
  'ui/player/order-targets.ts',
  'ui/player/pre-orders.ts',
  'ui/player/orders-form.ts',
  'ui/player/move-analysis.ts',
  // (the column the Move note counts, projectedMoveHost, since P1-11e10: the march forecast reads it)
  'ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts',
  // (the treasury ledger, since P1-11e42: in a file of its own)
  'ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts',
];
const THE_ROWS_NUMBERS_WRITTEN_OUT = [
  '— raises a Green ',
  'Free Green garrison unit',
  '(2g — full Spy result)',
  'seen — 2g.',
  'P.brokerSpy : 2',
  'P.harvest : 2',
  '2g raises',
  'bind 2 VETERAN',
  'Empower +2',
  '(+2 tiers each)',
  '(+2 quality tiers each',
  'by +2 tiers',
];
/** The mastery orders' table (P1-11d10): the content's rows, which the form's table (L79_ORDERS) is built from, and the
 *  form's own fields of each order (its target and hint), by the row's key. */
const THE_MASTERY_ORDERS_ROWS = 'content/mastery-orders-their-keys-names-skills-and-levels.ts';
const THE_MASTERY_ORDERS_TABLE = 'ui/player/l79-orders.ts';
const THE_FORMS_FIELDS_OF_EACH_MASTERY_ORDER = 'THE_FORMS_FIELDS_OF_EACH_MASTERY_ORDER';
const filesIn = (folder: string) => filesUnder(SRC).filter((f) => f.startsWith(folder));

/** Each import of `file` (relative to src/): what it names, and where that is relative to src/ (null: not a file of
 *  src/, e.g. a package or one of Node's modules). */
function importsOf(file: string): { names: string; resolved: string | null }[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  return ts.preProcessFile(text, true, true).importedFiles.map(({ fileName }) => {
    if (!fileName.startsWith('.')) return { names: fileName, resolved: null };
    const resolved = path.relative(SRC, path.resolve(path.dirname(path.join(SRC, file)), fileName));
    return { names: fileName, resolved: resolved.startsWith('..') ? null : resolved.split(path.sep).join('/') };
  });
}

/** Every name `file` declares, at any depth: functions, classes, variables (destructured too), parameters aside. */
function namesDeclaredIn(file: string): string[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names: string[] = [];
  const bound = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) names.push(name.text);
    else for (const e of name.elements) if (!ts.isOmittedExpression(e)) bound(e.name);
  };
  const visit = (node: ts.Node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) names.push(node.name.text);
    else if (ts.isVariableDeclaration(node)) bound(node.name);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return names;
}

/** What `file` declares under `name`, at any depth, each as the text of its initializer (null: none, a parameter or
 *  a bare `let`). */
function initializersDeclaredIn(file: string, name: string): (string | null)[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: (string | null)[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name)
      found.push(node.initializer ? node.initializer.getText(tree) : null);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

/** The names `fn` of `file` calls (at any depth of it), as the identifiers called. */
function namesCalledIn(file: string, fn: string): string[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const called: string[] = [];
  const inside = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) called.push(node.expression.text);
    ts.forEachChild(node, inside);
  };
  const find = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === fn) inside(node);
    else ts.forEachChild(node, find);
  };
  find(tree);
  return called;
}

/** The text of the function `fn` of `file`, as it is written. */
function textOfFunction(file: string, fn: string): string {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === fn) found.push(node.getText(tree));
    else ts.forEachChild(node, visit);
  };
  visit(tree);
  return found.join('\n');
}

/** Every property of `file` named one of `names` (at any depth) whose value is written out: a string, a number, or a
 *  number with a sign; each as `name: value`. */
function propertiesWrittenOutIn(file: string, names: readonly string[]): string[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: string[] = [];
  const isWrittenOut = (n: ts.Expression) =>
    ts.isStringLiteralLike(n) ||
    ts.isNumericLiteral(n) ||
    (ts.isPrefixUnaryExpression(n) && ts.isNumericLiteral(n.operand));
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      names.includes(node.name.text) &&
      isWrittenOut(node.initializer)
    )
      found.push(`${node.name.text}: ${node.initializer.getText(tree)}`);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

/** Every string `file` writes out (at any depth), as its value. */
function stringsWrittenOutIn(file: string): string[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node)) found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

/** Every array of `file` that is a table of steps: six elements, each an array of two steps of 0 or 1 either way (`[-1, 0]`, `[1, 1]`). */
function tablesOfSixStepsIn(file: string): string[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  // (a step is -1, 0 or 1: a hexagon's corners drawn on the map are further out)
  const isAStep = (n: ts.Expression) =>
    (ts.isNumericLiteral(n) && Number(n.text) <= 1) ||
    (ts.isPrefixUnaryExpression(n) && ts.isNumericLiteral(n.operand) && Number(n.operand.text) <= 1);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isArrayLiteralExpression(node) &&
      node.elements.length === 6 &&
      node.elements.every((e) => ts.isArrayLiteralExpression(e) && e.elements.length === 2 && e.elements.every(isAStep))
    )
      found.push(node.getText(tree).replace(/\s+/g, ' '));
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

/** The names src/shared/ hands the portal (each `export { … } from`). */
function namesSharedExports(): string[] {
  return filesIn(SHARED).flatMap((file) => {
    const text = fs.readFileSync(path.join(SRC, file), 'utf8');
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    return tree.statements.flatMap((s) =>
      ts.isExportDeclaration(s) && s.exportClause && ts.isNamedExports(s.exportClause)
        ? s.exportClause.elements.map((e) => e.name.text)
        : [],
    );
  });
}

describe('src/shared/ re-exports only from src/engine/rules-on-plain-values/', () => {
  const files = filesIn(SHARED);

  test('src/shared/ is there to check, and hands the portal some names', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(namesSharedExports().length).toBeGreaterThan(0);
  });

  test('every import a file of src/shared/ makes is of a file of the folder that is there', () => {
    const outside = files.flatMap((file) =>
      importsOf(file)
        .filter(({ resolved }) => !resolved?.startsWith(RULES))
        .map(({ names }) => `${file} imports ${names}`),
    );
    const missing = files.flatMap((file) =>
      importsOf(file)
        .filter(({ resolved }) => resolved !== null && !fs.existsSync(path.join(SRC, resolved)))
        .map(({ names }) => `${file} imports ${names}, which isn't there`),
    );
    expect([...outside, ...missing]).toEqual([]);
  });

  test('src/shared/ only re-exports: it declares nothing of its own', () => {
    expect(files.flatMap((file) => namesDeclaredIn(file).map((name) => `${file} declares ${name}`))).toEqual([]);
  });
});

describe('the player portal reaches the engine only through src/shared/', () => {
  const files = filesIn(PLAYER).filter((f) => f.endsWith('.ts'));

  test('the portal is there to check', () => {
    expect(files).toContain(`${PLAYER}page.ts`);
  });

  test('no file of the portal imports an engine or a views file', () => {
    const reaching = files.flatMap((file) =>
      importsOf(file)
        .filter(({ resolved }) => resolved !== null && /^(engine|views)\//.test(resolved))
        .map(({ names }) => `${file} imports ${names}`),
    );
    expect(reaching).toEqual([]);
  });

  test(
    'no file of the portal declares a retired copy, or a name src/shared/ hands it',
    timeLimitForTheWork({ everyFileReads: 1 }),
    () => {
      const refused = new Set([...RETIRED, ...namesSharedExports()]);
      const copies = files.flatMap((file) =>
        namesDeclaredIn(file)
          .filter((name) => refused.has(name))
          .map((name) => `${file} declares ${name}`),
      );
      expect(copies).toEqual([]);
    },
  );

  test("the order form's eight Cast Spell tables are each made by the folder's function, once, with no table of spells of its own", () => {
    // (P1-11c3) The tables were written out in four files; each is now the call of the folder's function that makes it
    // (a call with no argument), declared once in the portal: a name declared twice, or by a list, a set or an
    // object, is a table written again.
    const declared = THE_ORDER_FORMS_SPELL_TABLES.flatMap(([name]) =>
      files.flatMap((file) => initializersDeclaredIn(file, name).map((init) => [name, init] as const)),
    );
    const wanted = THE_ORDER_FORMS_SPELL_TABLES.map(([name, make]) => [name, `${make}()`]);
    expect(declared).toEqual(wanted);
    // and the functions are handed the portal, from the folder's file
    const handed = new Set(namesSharedExports());
    expect(THE_ORDER_FORMS_SPELL_TABLES.filter(([, make]) => !handed.has(make))).toEqual([]);
  });

  test("the order form's three hex tables step by the folder's function, and no file of the portal holds a table of the six steps", () => {
    // (P1-11d6) predictedLocation, the Move field (buildTargetField) and lastMoveDirOf each kept a table of the six steps
    // from a hex, by the parity of its row; each calls theHexNextToAProvinceInADirection now (the folder's: one table,
    // with the wrap and the icy wastes), handed the portal by src/shared/. A table under any name is a table again.
    expect(namesSharedExports()).toContain('theHexNextToAProvinceInADirection');
    const notCalling = THE_THREE_HEX_TABLES.filter(
      ([file, fn]) => !namesCalledIn(file, fn).includes('theHexNextToAProvinceInADirection'),
    ).map(([file, fn]) => `${fn} (${file}) doesn't call theHexNextToAProvinceInADirection`);
    expect(notCalling).toEqual([]);
    expect(files.flatMap((file) => tablesOfSixStepsIn(file).map((t) => `${file} holds the table ${t}`))).toEqual([]);
  });

  test("the Explore forecast asks the folder's rule of the share an Explore order maps, and no file of the portal reads the grounds' shares", () => {
    // (P1-11d14) exploreGainFor wrote the order's sum out, with its own table of each ground's share; it asks
    // theShareOfAProvinceAnExploreOrderMaps now (the turn's resolveExploreOrder asks it too), handed the portal by
    // src/shared/, with what the report gives. The content's table read by a portal file is the sum written again.
    expect(namesSharedExports()).toContain('theShareOfAProvinceAnExploreOrderMaps');
    expect(namesCalledIn('ui/player/order-targets.ts', 'exploreGainFor')).toContain(
      'theShareOfAProvinceAnExploreOrderMaps',
    );
    expect(files.filter((file) => fs.readFileSync(path.join(SRC, file), 'utf8').includes('KC_BASIC_EXPLORE'))).toEqual(
      [],
    );
  });

  test("the order list's alignment orders: their names, their table and their checks are the folder's", () => {
    // (P1-11d7) The list wrote the five names, a table of each one's creed and a set of the king's, and compared them
    // itself; each is the rows' now, through the folder: ACTIONS reads each name by its row's slug, ALIGN_ACTIONS is the
    // folder's table of the rows by name, and actionsFor asks the folder's two checks, as the turn's resolvers do.
    const handed = new Set(namesSharedExports());
    const theFolders = [
      ...THE_TWO_CHECKS_OF_WHO_MAY_GIVE_AN_ALIGNMENT_ORDER,
      THE_NAME_OF_AN_ALIGNMENT_ORDER,
      'theAlignmentOrdersByTheNameTheFormWrites',
    ];
    expect(theFolders.filter((name) => !handed.has(name))).toEqual([]);
    const declared = (name: string) => files.flatMap((file) => initializersDeclaredIn(file, name));
    expect(declared('ALIGN_ACTIONS')).toEqual(['theAlignmentOrdersByTheNameTheFormWrites()']);
    const theList = declared('ACTIONS')[0] ?? '';
    expect(declared('ACTIONS')).toHaveLength(1);
    const theNames = Object.values(THE_ALIGNMENT_ORDERS).map((order) => order.name);
    expect(theNames.filter((name) => theList.includes(`'${name}'`) || theList.includes(`"${name}"`))).toEqual([]);
    expect(
      Object.keys(THE_ALIGNMENT_ORDERS).filter(
        (slug) => !theList.includes(`${THE_NAME_OF_AN_ALIGNMENT_ORDER}('${slug}')`),
      ),
    ).toEqual([]);
    // (since P1-11e42 the list is the ledger's file's, on the report handed it; actionsFor is the page's name for it)
    const called = namesCalledIn(
      'ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts',
      'theOrdersTheFormOffersAHero',
    );
    expect(THE_TWO_CHECKS_OF_WHO_MAY_GIVE_AN_ALIGNMENT_ORDER.filter((check) => !called.includes(check))).toEqual([]);
  });

  test("the target widget's creed and king checks are the folder's, its numbers of the alignment orders are their rows', and the once-a-turn list names Call to Arms by its row", () => {
    // (P1-11d8) buildTargetField gated each creed order by a comparison of the realm's creed with a literal and the
    // king's three by `c.isKing`; it asks the folder's two checks now (d7's, as actionsFor does), through the row
    // ALIGN_ACTIONS holds by name. The numbers its words, the ledger's fallback, the Move note's column and the Blood
    // Offering's hint state are the rows' (read, not written again); ONCE_PER_TURN_ACTIONS names Call to Arms by its row.
    const widget = 'ui/player/order-targets.ts';
    const called = namesCalledIn(widget, 'buildTargetField');
    const [creedCheck, kingCheck] = THE_TWO_CHECKS_OF_WHO_MAY_GIVE_AN_ALIGNMENT_ORDER;
    expect(called.filter((name) => name === creedCheck)).toHaveLength(THE_WIDGETS_CREED_ORDERS);
    expect(called.filter((name) => name === kingCheck)).toHaveLength(THE_WIDGETS_KINGS_ORDERS);
    // and no comparison of the realm's creed with the name of one
    const creeds = Object.values(THE_ALIGNMENT_ORDERS).map((order) => order.creed);
    const comparing = new RegExp(`alignment[^\\n]*?!==?\\s*['"](${creeds.join('|')})['"]`);
    expect(comparing.exec(textOfFunction(widget, 'buildTargetField'))).toBeNull();
    // the numbers
    const writtenOut = THE_FILES_THAT_READ_THE_ROWS_NUMBERS.flatMap((file) => {
      const text = fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\s+/g, ' ');
      return THE_ROWS_NUMBERS_WRITTEN_OUT.filter((words) => text.includes(words)).map(
        (words) => `${file} writes ${words}`,
      );
    });
    expect(writtenOut).toEqual([]);
    // and each place that states one reads the row's number by its name
    const readsTheRow = [
      [widget, 'buildTargetField', 'theGradeMustered'],
      [widget, 'buildTargetField', 'thePriceOfWordFromAProvince'],
      [widget, 'buildTargetField', 'theWildHuntsBeasts'],
      [widget, 'buildTargetField', 'theBloodOfferingsGrades'],
      // (since P1-11e27 the Blood Offering's hint is one function, which updateBloodOffering and the field call)
      [widget, 'theBloodOfferingsHint', 'theBloodOfferingsGrades'],
      // (the ledger since P1-11e42: its file's, on the report and the orders handed it)
      [
        'ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts',
        'theTreasuryLedgerOnTheseOrders',
        'thePriceOfWordFromAProvince',
      ],
      // (since P1-11e26: the carters' price and the Wild Hunt's term, each the row's on a report that names none)
      [widget, 'buildTargetField', 'thePrice'],
      [widget, 'buildTargetField', 'theWildHuntsTurnsMore'],
      [
        'ui/player/the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts',
        'theTreasuryLedgerOnTheseOrders',
        'thePrice.value',
      ],
      [
        'ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts',
        'theColumnAHeroMarchesWithInAPhase',
        'theWildHuntsBeasts',
      ],
    ] as const;
    expect(
      readsTheRow
        .filter(([file, fn, number]) => !textOfFunction(file, fn).includes(number))
        .map(([file, fn, number]) => `${fn} (${file}) doesn't read ${number}`),
    ).toEqual([]);
    // the Wild Hunt's beasts are made once, in a loop of the row's number, not once for each
    const column = textOfFunction(
      'ui/player/the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts',
      'theColumnAHeroMarchesWithInAPhase',
    );
    expect(column.split('(bound by the Wild Hunt)')).toHaveLength(2);
    // the once-a-turn list
    const once = initializersDeclaredIn('ui/player/pre-orders.ts', 'ONCE_PER_TURN_ACTIONS').join('\n');
    expect(once).toContain(`${THE_NAME_OF_AN_ALIGNMENT_ORDER}('call-to-arms')`);
    expect(once).not.toMatch(/['"]Call to Arms['"]/);
  });

  test("the mastery orders' table: each order's name, skill and level are its content row's, and every row is in it once", () => {
    // (P1-11d10) L79_ORDERS wrote each mastery's name, skill and level; it is built from the content's rows now
    // (THE_MASTERY_ORDERS, which the turn's MASTERY_ORDER_KEYS and MASTERY_ORDER_LABEL read too): its file imports the
    // rows, writes no skill or level out and no row's name, and holds the form's own fields of each row once, by its key.
    const table = THE_MASTERY_ORDERS_TABLE;
    expect(importsOf(table).map(({ resolved }) => resolved)).toContain(THE_MASTERY_ORDERS_ROWS);
    const declared = (name: string) => files.flatMap((file) => initializersDeclaredIn(file, name));
    const [theTable, ...more] = initializersDeclaredIn(table, 'L79_ORDERS');
    expect(more).toEqual([]);
    expect(declared('L79_ORDERS')).toHaveLength(1);
    expect(theTable).toContain('THE_MASTERY_ORDERS[');
    expect(propertiesWrittenOutIn(table, ['skill', 'lvl', 'level', 'name'])).toEqual([]);
    const rows = Object.values(THE_MASTERY_ORDERS);
    const written = new Set(stringsWrittenOutIn(table));
    expect(rows.filter((row) => written.has(row.name)).map((row) => row.name)).toEqual([]);
    const fields = declared(THE_FORMS_FIELDS_OF_EACH_MASTERY_ORDER);
    expect(fields).toHaveLength(1);
    const keys = [...(fields[0] ?? '').matchAll(/\[\s*'([a-z_]+)',\s*\{/g)].map((m) => m[1]);
    expect([...keys].sort()).toEqual(rows.map((row) => row.key).sort());
  });

  test("each mastery order's hint opens with its row's skill and level", () => {
    // (P1-11d13) the form's own hint of each order opens with the skill and level it needs, written out ("Spy 7: …"):
    // its row's. Each hint is the first string after its row's key, in the table's order, that opens so.
    const strings = stringsWrittenOutIn(THE_MASTERY_ORDERS_TABLE);
    const rows = Object.values(THE_MASTERY_ORDERS);
    const opening = /^[A-Z][a-z]+ \d\b/;
    const hintOf = (key: string) => strings.slice(strings.indexOf(key) + 1).find((t) => opening.test(t)) ?? '';
    const capital = (skill: string) => skill.charAt(0).toUpperCase() + skill.slice(1);
    expect(rows.map((row) => `${row.key}: ${opening.exec(hintOf(row.key))?.[0] ?? 'none'}`)).toEqual(
      rows.map((row) => `${row.key}: ${capital(row.skill)} ${String(row.level)}`),
    );
  });

  test('the player page loads no engine file outside the folder, and no views file', () => {
    const modules = pageModules(PLAYER_PAGE);
    expect(modules.filter((f) => f.startsWith(SHARED)).length).toBeGreaterThan(0);
    expect(modules.filter((f) => /^(engine|views)\//.test(f) && !f.startsWith(RULES))).toEqual([]);
  });
});
