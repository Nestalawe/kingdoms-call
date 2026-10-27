// The resolvers the rule registry has taken name no unit type (plan P1-19, Decision 7 and Choice 3): each function the
// registry's rows have taken holds no string naming a unit type of KC_UNIT_TYPE that it compares, looks up by or passes
// to has, get, includes or indexOf; its effects ask their content rows, by slug, in src/engine/rules/. Each row of
// P1-19 adds the functions it takes. Counted by syntax tree with the ratchet's helper (tools/ratchet.ts's
// unitNameChecksByFunction), which also counts the engine's checks outside the registry (unitNameChecksInEngine), so
// that count only falls. And, beside it (plan P1-19's second slice, Decision 9: P1-19f), each such function holds no
// string naming a unit type at all, whatever it does with it: a name passed to a helper of the function's own
// (isHalfOrMore(force, 'Warg Riders')), held in an array or a template, or in a function nested inside it, which the
// ratchet's helper doesn't count (it counts for the nested function, or isn't a check), counts here.
//
// Red on each row's base by design (unitAbilityMult held 9 on P1-19a's base; abilityFront 19 and abilityBack 6 on
// P1-19b's; battleFaceSide 11 on P1-19c's; rollUnitFates 4 on P1-19d's; the eight volley functions of strength.ts 14
// and applyMissileHit 3 on P1-19g's; battleGrid 1, battleRegrid 2 and abilityFlanksRough 3 on P1-19h's;
// applyFlakScreen 1 and applyBreachAndSwamp 1 on P1-19i's; on P1-19j's, by every name, rideThemDownBonus 2,
// shieldFortHolds 3, combatVsChar 10 and combatVsNPC 3; on P1-19k's, by every name,
// earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill 2 and resolveMoveOrder 1), as P1-11a4's static test was: the one exception to
// refactor-only's rule that new tests pass before and after (Theo, 2026-10-25). eyesOfTheForest, the ninth volley function on P1-19g's base, went:
// the registry's "the shooters see what hides" took its one check, and nothing else read it.
// Level 0 (static): the files' syntax trees; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { KC_UNIT_TYPE } from '../../src/content/kingdoms-call-data.ts';
import { ROOT } from '../../tools/build.ts';
import { unitNameChecksByFunction } from '../../tools/ratchet.ts';

/** Each function the registry has taken, by its file, from the row that took it. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  ['src/engine/battle/strength.ts', 'unitAbilityMult', 'P1-19a, the whole force'],
  ['src/engine/battle/lines.ts', 'abilityFront', 'P1-19b, facing'],
  ['src/engine/battle/lines.ts', 'abilityBack', 'P1-19b, facing'],
  ['src/engine/battle/lines.ts', 'battleFaceSide', 'P1-19c, the whole line'],
  ['src/engine/battle/fates.ts', 'rollUnitFates', 'P1-19d, fates'],
  ['src/engine/battle/strength.ts', 'abilityMissileUnits', 'P1-19g, the volley'],
  ['src/engine/battle/strength.ts', 'missileCap', 'P1-19g, the volley'],
  ['src/engine/battle/strength.ts', 'missileCapReached', 'P1-19g, the volley'],
  ['src/engine/battle/strength.ts', 'missileTargetPool', 'P1-19g, the volley'],
  ['src/engine/battle/strength.ts', 'archeryBlockedBy', 'P1-19g, the volley'],
  ['src/engine/battle/strength.ts', 'eyesOfTheForestLine', 'P1-19g, the volley'],
  ['src/engine/battle/strength.ts', 'missileDamageMult', 'P1-19g, the volley'],
  ['src/engine/battle/strength.ts', 'abilityVolleys', 'P1-19g, the volley'],
  ['src/engine/battle/terrain-and-unit-strength.ts', 'applyMissileHit', 'P1-19g, the volley'],
  ['src/engine/battle/lines.ts', 'battleGrid', 'P1-19h, the grid'],
  ['src/engine/battle/lines.ts', 'battleRegrid', 'P1-19h, the grid'],
  ['src/engine/battle/lines.ts', 'abilityFlanksRough', 'P1-19h, the grid'],
  ['src/engine/battle/strength.ts', 'applyFlakScreen', 'P1-19i, before the battle'],
  ['src/engine/battle/battles-between-heroes.ts', 'applyBreachAndSwamp', 'P1-19i, before the battle'],
  ['src/engine/units/movement.ts', 'rideThemDownBonus', 'P1-19j, the rout'],
  ['src/engine/units/movement.ts', 'shieldFortHolds', 'P1-19j, the rout'],
  ['src/engine/battle/battles-between-heroes.ts', 'combatVsChar', 'P1-19j, the rout'],
  ['src/engine/battle/battles-against-province-defenders.ts', 'combatVsNPC', 'P1-19j, the rout'],
  [
    'src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts',
    'earlyWinterCharmsFadeTaxesWagesRaidersMusterAndGarrisonDrill',
    "P1-19k, the turn's end",
  ],
  [
    'src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts',
    'resolveMoveOrder',
    "P1-19k, the turn's end",
  ],
];

const UNIT_TYPE_NAMES: ReadonlySet<string> = new Set(Object.keys(KC_UNIT_TYPE));

/** Whether a node declares the function named (a function or a method, or a variable an arrow or a function is given
 *  to: the ratchet's helper finds a function the same way). */
function declares(node: ts.Node, fn: string): boolean {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText() === fn;
  return (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === fn &&
    node.initializer !== undefined &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  );
}

/** Every string naming a unit type of KC_UNIT_TYPE in the function named, whatever the code does with it (a string or
 *  a template with no placeholder, in the function or in any function nested in it), in the order written; null if
 *  the file doesn't declare the function. */
function everyUnitNameIn(file: string, text: string, fn: string): string[] | null {
  let found: string[] | null = null;
  const collect = (node: ts.Node, into: string[]): void => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && UNIT_TYPE_NAMES.has(node.text))
      into.push(node.text);
    ts.forEachChild(node, (child) => {
      collect(child, into);
    });
  };
  const visit = (node: ts.Node): void => {
    if (declares(node, fn)) {
      found ??= [];
      collect(node, found);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  return found;
}

test.for(TAKEN)('%s: %s names no unit type (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = unitNameChecksByFunction(file, text);
  expect(counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn), `${fn}'s checks of a unit by its name (the ratchet's helper)`).toBe(0);
  expect(everyUnitNameIn(file, text, fn), `every string in ${fn} naming a unit type`).toEqual([]);
});

// The helper finds what it counts: every way of naming a unit planted in one function (an arrow with no name inside
// it counts for it, a named one for itself), and none of the strings that aren't a check or aren't a unit type's name.
test('the helper counts each check of a unit by its name, and nothing else', () => {
  const planted = `
    export function planted(a, t, table, set) {
      if (a.type === 'Goblin Horde' || 'Men-at-Arms' !== t || t == 'Cave Trolls' || t != 'Elder Dragons') return 1;
      switch (t) { case 'Shark Shoals': return 2; }
      const x = table['Sea Giants'] + set.has('Crimson Rocs') + set.get('Basilisk Brood');
      const y = ['Stone Giants'].includes(t) + [t].indexOf('Unicorn Herd');
      const inside = [t].some((u) => u === 'Titan Warbeasts'), nested = () => t === 'Great Bears';
      const notChecks = ['Orc Berserkers', 'Warg Riders'], label = 'Thunderbirds', notAUnit = t === 'Garrison';
      return x + y + inside + nested() + notChecks.length + label.length + notAUnit;
    }
    const nestedNamed = function named() { return 'Dread Hydras' === t; };`;
  const counts = unitNameChecksByFunction('planted.ts', planted);
  expect(Object.fromEntries(counts)).toEqual({ planted: 10, nested: 1, nestedNamed: 1 });
});

// And every string naming a unit in a taken function is found, whatever it does (Decision 9): a name passed to any
// helper, held in an array, a template with no placeholder, or in a function nested inside, named or not; a string
// that isn't a unit type's name, and a name outside the function, are not.
test('every unit name in a function is found, whatever the code does with it', () => {
  const planted = `
    const before = 'Goblin Horde';
    export function planted(force, t) {
      const half = isHalfOrMore(force, 'Warg Riders') + countType(force, \`Free Lances\`);
      const held = ['Cave Trolls'], label = { unit: 'Sea Giants' }, notAUnit = t === 'Garrison' || \`\${t} Riders\`;
      const inside = () => 'Titan Warbeasts', nested = function named() { return t === 'Great Bears'; };
      return half + held.length + label.unit + notAUnit + inside() + nested();
    }
    const after = 'Elder Dragons';`;
  expect(everyUnitNameIn('planted.ts', planted, 'planted')).toEqual([
    'Warg Riders',
    'Free Lances',
    'Cave Trolls',
    'Sea Giants',
    'Titan Warbeasts',
    'Great Bears',
  ]);
  expect(everyUnitNameIn('planted.ts', planted, 'absent')).toBeNull();
  // The ratchet's helper sees only the nested comparison, and gives it to the nested function, not to planted.
  expect(unitNameChecksByFunction('planted.ts', planted).get('planted')).toBe(0);
});
