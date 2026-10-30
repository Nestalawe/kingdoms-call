// The resolvers the spells' registry has taken name no spell (plan P1-19's spells family, Decision 5): each function
// the registry's rows have taken holds no string naming a spell (a key of SPELL_DEFS_P) or its `fn`
// (`'white_resurrect'`), whatever the code does with it (compared, switched on, passed to a helper, held in a list, or
// in a function nested inside). Its effects find a spell's row by the name the battle or the order holds, in
// src/engine/rules/. Each row of the family adds the functions it takes. With them, the ratchet's count of the engine's
// checks of a spell outside the registry (tools/ratchet.ts's spellChecksInEngine, by its helper spellChecksByFunction:
// a string of the vocabulary compared, switched on, or passed to has, includes, indexOf or get), so that count only
// falls: the helper counts each such check planted, and none in src/engine/rules/ or a page's code.
//
// Red on its row's base by design (applyPreBattleMagic held 8 checks, combatVsNPC 16 and battleSpellUseful 6 on
// P1-19u's base; P1-19w's two functions, which take pcCastCombatSpell's 7 cases of the spells that harm, didn't exist
// on its base), as the unit-name and item-effect tests were: the one exception to refactor-only's rule that new tests
// pass before and after (Theo, 2026-10-25; the spells family's Decision 5).
// Level 0 (static): the files' syntax trees and the content's spells as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  readBaseline,
  SPELL_VOCABULARY,
  spellChecksByFunction,
  spellChecksInEngine,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** Each function the spells' registry has taken, by its file, from the row that took it. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  ['src/engine/battle/battles-between-heroes.ts', 'applyPreBattleMagic', 'P1-19u, battle magic between heroes'],
  [
    'src/engine/battle/battles-against-province-defenders.ts',
    'combatVsNPC',
    "P1-19u, battle magic against the guards and the guards' commander's",
  ],
  [
    'src/engine/magic/pre-battle-spell-choice.ts',
    'battleSpellUseful',
    'P1-19u, a battle spell has something to strike',
  ],
  [
    'src/engine/personal-combat/combat-spells-and-guardian-abilities.ts',
    'applyTheStepsOfACombatSpell',
    'P1-19w, the steps of the combat spells that harm (pcCastCombatSpell itself joins with P1-19x)',
  ],
  [
    'src/engine/personal-combat/combat-spells-and-guardian-abilities.ts',
    'writeTheLineOfACombatSpellsHit',
    "P1-19w, a combat spell's hit's line",
  ],
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

/** In the function named: every string naming a spell or its `fn`, in the order written (a function nested inside
 *  counts); null if the file doesn't declare the function. */
function everySpellWordIn(file: string, text: string, fn: string): string[] | null {
  let found: string[] | null = null;
  const collect = (node: ts.Node, into: string[]): void => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && SPELL_VOCABULARY.has(node.text))
      into.push(node.text);
    ts.forEachChild(node, (child) => {
      collect(child, into);
    });
  };
  const visit = (node: ts.Node): void => {
    if (aFunctionsName(node) === fn) {
      found ??= [];
      collect(node, found);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  return found;
}

test.for(TAKEN)('%s: %s names no spell (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = spellChecksByFunction(file, text);
  expect(counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn), `${fn}'s checks of a spell (the ratchet's helper)`).toBe(0);
  expect(everySpellWordIn(file, text, fn), `every string in ${fn} naming a spell or its fn`).toEqual([]);
});

test("the vocabulary holds every spell's name and fn, and no school or other word", () => {
  for (const word of ['Fireball', 'Holy Symbol', 'Bless Province', 'elemental_fireball', 'white_resurrect'])
    expect(SPELL_VOCABULARY.has(word), word).toBe(true);
  for (const word of ['fireball', 'elemental', 'white', 'Breath of Fire', 'battle'])
    expect(SPELL_VOCABULARY.has(word), word).toBe(false);
});

// The helper finds what it counts: each kind of check planted in one function (an arrow with no name inside it counts
// for it, a named one for itself), and none of the strings that aren't a check or aren't in the vocabulary.
test("the ratchet's helper counts each check of a spell by its name or fn, and nothing else", () => {
  const planted = `
    export function planted(sp, set, list, map) {
      if (sp === 'Fireball' || 'Curse' !== sp || sp == 'Lightning Bolt' || sp != 'elemental_fireball') return 1;
      switch (sp) { case 'Holy Symbol': return 2; case 'white_resurrect': return 3; }
      const x = set.has('Spiritwrack') + list.includes('Charm') + list.indexOf('Flood') + map.get('Plague');
      const y = has('Invisibility') + includes('Oratory');
      const inside = [sp].some((s) => s === 'Earthquake'), nested = () => sp === 'Resurrect';
      const notChecks = ['Psychic Blast', 'Curse'], label = 'Fireball', other = helper('Control Undead');
      const notAWord = sp === 'fireball' || sp === 'elemental' || other || label || notChecks || set.add('Veil');
      return x + y + inside + nested() + notAWord;
    }
    const nestedNamed = function named() { return sp === 'Dominate'; };`;
  expect(Object.fromEntries(spellChecksByFunction('planted.ts', planted))).toEqual({
    planted: 13,
    nested: 1,
    nestedNamed: 1,
  });
});

test('every string naming a spell or its fn in a function is found, a nested one too', () => {
  const planted = `
    const before = 'Fireball';
    export function planted(sp) {
      const a = helper('Holy Symbol') + [\`Curse\`].length + (sp === 'white_spiritwrack');
      const inside = () => 'Spiritwrack', notAWord = sp === 'fireball' || 'elemental';
      return a + inside() + notAWord;
    }
    const after = 'Lightning Bolt';`;
  expect(everySpellWordIn('planted.ts', planted, 'planted')).toEqual([
    'Holy Symbol',
    'Curse',
    'white_spiritwrack',
    'Spiritwrack',
  ]);
  expect(everySpellWordIn('planted.ts', planted, 'absent')).toBeNull();
});

// A check planted in a file of src/engine/ raises spellChecksInEngine by one, and the ratchet fails on it; one in
// src/engine/rules/ (the registries' effects, which find a spell's effect by its row) or in a page's code isn't counted.
test.for([
  ['src/engine/battle/x.ts', 1],
  ['src/engine/rules/x.ts', 0],
  ['src/ui/gm/x.ts', 0],
] as const)('a spell check planted in %s raises spellChecksInEngine by %i', ([file, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), spellChecksInEngine: spellChecksInEngine(files) };
  expect(asTheyAre.spellChecksInEngine).toBe(readBaseline()['spellChecksInEngine']);
  const planted = {
    ...asTheyAre,
    spellChecksInEngine: spellChecksInEngine([
      ...files,
      [file, "export const planted = (spell: string): boolean => spell === 'Fireball';\n"],
    ]),
  };
  expect(planted.spellChecksInEngine).toBe(asTheyAre.spellChecksInEngine + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => /^spellChecksInEngine rose from \d+ to \d+\./.test(r))).toEqual(rose);
});
