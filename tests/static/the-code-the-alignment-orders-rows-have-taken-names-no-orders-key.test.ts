// The code the alignment orders' rows have taken names no order's key (plan P1-19's alignment orders, Decision 4): each
// function (or file's top level) the content's rows (src/content/alignment-orders-their-keys-names-creeds-numbers-and-
// words.ts) have taken holds no string naming an alignment order's key (`'consecrate'`, `'harvest_field'`), whatever
// the code does with it (compared, a `case`, a lookup, an order written, a list, a map's value, a literal type, or in a
// function nested inside), but the literal types its entry lists as left (OrderKind's, in the order-name map's file).
// It reads a row's key instead. Each row of the family adds what it takes. With them, the
// ratchet's count of the keys the engine names outside src/engine/rules/ (tools/ratchet.ts's
// alignmentOrderChecksInEngine, by its helper alignmentOrderChecksByFunction: a key anywhere but a literal type), so that
// count only falls: the helper counts each key planted, and none in src/engine/rules/ or a page's code.
//
// Red on its row's base by design (army-tables.ts' top level held 5 keys on P1-19ap's base: ALIGNMENT_ORDER_KEYS; the
// order-name map's file's top level 9 and processOrder 5 on P1-19aq's: PHASE_ACTION_MAP and the switch's cases), as
// the unit-name, item-effect, spell, discovery and perk tests were: the one exception to refactor-only's rule that new
// tests pass before and after (Theo, 2026-10-25; the alignment orders' Decision 4). The five resolvers (P1-19ar's) held
// no key on their base: they compare a realm's creed, and their entries keep it so now they read their rows.
// The bots' five functions (P1-19as's) held the last 11 keys: the orders they write, the busy list, urgency's two.
// Level 0 (static): the files' syntax trees and the content's rows as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  ALIGNMENT_ORDER_VOCABULARY,
  alignmentOrderChecksByFunction,
  alignmentOrderChecksInEngine,
  compare,
  readBaseline,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** The top level of a file: what no function holds. */
const TOP = '(top)';

/** OrderKind's literal types, the only strings naming a key left at the top level of the turn's order-name map's file
 *  (the plan's Decision 5: P1-10 derives or checks them), in the order written. */
const ORDER_KINDS_LITERAL_TYPES = ['consecrate', 'call_to_arms', 'broker', 'harvest_field', 'rite'];

/** The file of the realm's works: four of the five resolvers. */
const REALM_WORKS = 'src/engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts';

/** The bots' file of missions: three of the five functions the bots' row has taken. */
const BOTS_MISSIONS = 'src/engine/bots/missions.ts';

/** Each function (or a file's top level) the alignment orders' rows have taken, by its file, from the row that took it,
 *  and the strings naming a key it still holds (a literal type's, which the ratchet's helper doesn't count). */
const TAKEN: readonly (readonly [file: string, fn: string, row: string, left: readonly string[]])[] = [
  ['src/engine/army-tables.ts', TOP, "P1-19ap, the rows: ALIGNMENT_ORDER_KEYS, the charmed hero's gate", []],
  [
    'src/engine/turn/phase-intents-and-dependency-ordering.ts',
    TOP,
    "P1-19aq, the turn's order-name map: PHASE_ACTION_MAP",
    ORDER_KINDS_LITERAL_TYPES,
  ],
  [
    'src/engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts',
    'processOrder',
    "P1-19aq, the dispatch: the switch's five cases",
    [],
  ],
  [REALM_WORKS, 'resolveConsecrateOrder', 'P1-19ar, Consecrate: its creed and the king, from its row', []],
  [REALM_WORKS, 'resolveCallToArmsOrder', "P1-19ar, Call to Arms: its creed, the king, the muster's grade", []],
  [REALM_WORKS, 'resolveBrokerOrder', 'P1-19ar, the Broker: its creed, the king, the price of word', []],
  [REALM_WORKS, 'resolveHarvestTheFieldOrder', "P1-19ar, Harvest the Field: its creed, the carters' price", []],
  [
    'src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts',
    'resolvePerformRiteOrder',
    "P1-19ar, Perform Rite: its creed, the Blood Offering's grades",
    [],
  ],
  [BOTS_MISSIONS, 'botSignaturePre', "P1-19as, the bots' orders: each creed's order written, the two prices", []],
  [BOTS_MISSIONS, 'botRitePre', "P1-19as, the bots' Perform Rite: the order written twice", []],
  [BOTS_MISSIONS, 'botRunSlayerSchool', "P1-19as, the bots' busy list: Consecrate", []],
  ['src/engine/bots/movement.ts', 'runBotMovement', "P1-19as, the bots' march to consecrate: the order written", []],
  ['src/engine/bots/phase-one.ts', 'urgency', "P1-19as, the bots' urgency: Harvest the Field and the Rite", []],
];

/** A function's or a method's declaration, or a variable's arrow or function, and its name (as the ratchet's helper
 *  finds a function). */
function aFunctionsName(node: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText();
  return ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer !== undefined &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ? node.name.text
    : null;
}

/** In the function named (or the file's top level, outside every named function): every string naming an alignment
 *  order's key, in the order written, a literal type's too (a function nested inside with no name counts); null if the
 *  file doesn't declare the function. */
function everyOrdersKeyIn(file: string, text: string, fn: string): string[] | null {
  let found: string[] | null = fn === TOP ? [] : null;
  const collect = (node: ts.Node, into: string[], atTheTop: boolean): void => {
    if (atTheTop && aFunctionsName(node) !== null) return;
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      ALIGNMENT_ORDER_VOCABULARY.has(node.text)
    )
      into.push(node.text);
    ts.forEachChild(node, (child) => {
      collect(child, into, atTheTop);
    });
  };
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  if (found) {
    collect(source, found, true);
    return found;
  }
  const visit = (node: ts.Node): void => {
    if (aFunctionsName(node) === fn) {
      found ??= [];
      collect(node, found, false);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test.for(TAKEN)("%s: %s names no alignment order's key (%s)", ([file, fn, , left]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = alignmentOrderChecksByFunction(file, text);
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s keys of an alignment order (the ratchet's helper)`).toBe(0);
  expect(everyOrdersKeyIn(file, text, fn), `every string in ${fn} naming an alignment order's key`).toEqual(left);
});

test("the vocabulary holds the five orders' keys, and no other word", () => {
  expect([...ALIGNMENT_ORDER_VOCABULARY]).toEqual(['consecrate', 'call_to_arms', 'broker', 'harvest_field', 'rite']);
});

// The helper finds what it counts: each form of a key planted in one function of the engine (an arrow with no name
// inside it counts for it, a named one for itself; one outside every function for the top level), and none of what
// isn't a key or is a literal type.
test("the ratchet's helper counts each alignment order's key, a literal type's aside", () => {
  const planted = `
    type Kind = 'consecrate' | 'rite';
    const MAP = { 'perform rite': 'rite', harvest_field: 'harvest_field' };
    export function planted(o: { action: string }, list: string[]) {
      const a = (o.action === 'broker') + list.includes('call_to_arms') + ['consecrate'].length;
      switch (o.action) { case 'rite': break; }
      const order = { action: \`harvest_field\` };
      const inside = [o].some((x) => x.action !== 'broker');
      const notKeys = 'Broker' + 'perform rite' + 'call to arms' + 'awaken_wild' + 'call_pit' + 'harvest';
      return a + order.action + inside + notKeys;
    }
    const nested = function named() { return 'consecrate'; };`;
  expect(Object.fromEntries(alignmentOrderChecksByFunction('src/engine/planted.ts', planted))).toEqual({
    [TOP]: 2,
    planted: 6,
    nested: 1,
  });
});

test('every string naming an alignment order’s key in a function, or at the top level, is found', () => {
  const planted = `
    type Kind = 'consecrate';
    const before = 'broker';
    export function planted(o) {
      const a = helper('rite') + [\`harvest_field\`].length + (o.action === 'call_to_arms');
      const inside = () => 'consecrate', notAKey = 'Broker' || 'awaken_wild';
      return a + inside() + notAKey;
    }
    const after = 'rite';`;
  expect(everyOrdersKeyIn('planted.ts', planted, 'planted')).toEqual([
    'rite',
    'harvest_field',
    'call_to_arms',
    'consecrate',
  ]);
  expect(everyOrdersKeyIn('planted.ts', planted, TOP)).toEqual(['consecrate', 'broker', 'rite']);
  expect(everyOrdersKeyIn('planted.ts', planted, 'absent')).toBeNull();
});

// A key planted in a file of src/engine/ raises alignmentOrderChecksInEngine by one, and the ratchet fails on it; one in
// src/engine/rules/ or in a page's code isn't counted.
test.for([
  ['src/engine/bots/x.ts', 1],
  ['src/engine/rules/x.ts', 0],
  ['src/ui/gm/x.ts', 0],
] as const)('a key planted in %s raises alignmentOrderChecksInEngine by %i', ([file, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), alignmentOrderChecksInEngine: alignmentOrderChecksInEngine(files) };
  expect(asTheyAre.alignmentOrderChecksInEngine).toBe(readBaseline()['alignmentOrderChecksInEngine']);
  const planted = {
    ...asTheyAre,
    alignmentOrderChecksInEngine: alignmentOrderChecksInEngine([
      ...files,
      [file, "export const planted = (o: { action: string }): boolean => o.action === 'broker';\n"],
    ]),
  };
  expect(planted.alignmentOrderChecksInEngine).toBe(asTheyAre.alignmentOrderChecksInEngine + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => /^alignmentOrderChecksInEngine rose from \d+ to \d+\./.test(r))).toEqual(rose);
});
