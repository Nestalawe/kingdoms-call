// The resolvers the guardian perks' registry has taken name no perk (plan P1-19's guardian perks, Decision 5): each
// function the registry's rows have taken holds no string naming a kind of perk (a perk's ward, `'meleeDR'`, or its
// rider's key, `'aura'`, as MONSTERS_P writes them), whatever the code does with it (compared, passed to a helper, held
// in a list or an object, or in a function nested inside). Its effects read a perk's ward or rider as their row writes
// it, in src/engine/rules/. Each row of the family adds the functions it takes. With them, the ratchet's count of the
// engine's checks of a guardian's perk outside the registry (tools/ratchet.ts's guardianPerkChecksInEngine, by its
// helper guardianPerkChecksByFunction: a kind compared, switched on or handed to a lookup or the lines' perk finders; a
// field of the wards a fighter wears, or a ward only a perk sets; a rider read in personal combat), so that count only
// falls: the helper counts each such check planted, and none in src/engine/rules/ or a page's code.
//
// Red on its row's base by design (monsterTraits held 3 checks and pcMonsterCombatant 2 on P1-19ai's base), as the
// unit-name, item-effect, spell and discovery tests were: the one exception to refactor-only's rule that new tests pass
// before and after (Theo, 2026-10-25; the guardian perks' Decision 5).
// Level 0 (static): the files' syntax trees and the content's perks as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  compare,
  GUARDIAN_PERK_VOCABULARY,
  guardianPerkChecksByFunction,
  guardianPerkChecksInEngine,
  readBaseline,
  theCodeFiles,
} from '../../tools/ratchet.ts';

/** Each function the guardian perks' registry has taken, by its file, from the row that took it. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  [
    'src/engine/personal-combat/lair-guardians-and-the-odds.ts',
    'monsterTraits',
    "P1-19ai, a guardian's perks: what his card turns",
  ],
  [
    'src/engine/personal-combat/speed-encounter-plans-and-combatants.ts',
    'pcMonsterCombatant',
    "P1-19ai, a guardian's perks: his grade's cap beside his own",
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

/** In the function named: every string naming a kind of perk, in the order written (a function nested inside counts);
 *  null if the file doesn't declare the function. */
function everyPerkWordIn(file: string, text: string, fn: string): string[] | null {
  let found: string[] | null = null;
  const collect = (node: ts.Node, into: string[]): void => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      GUARDIAN_PERK_VOCABULARY.has(node.text)
    )
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

test.for(TAKEN)('%s: %s names no perk (%s)', ([file, fn]) => {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const counts = guardianPerkChecksByFunction(file, text);
  expect(counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn), `${fn}'s checks of a guardian's perk (the ratchet's helper)`).toBe(0);
  expect(everyPerkWordIn(file, text, fn), `every string in ${fn} naming a kind of perk`).toEqual([]);
});

test('the vocabulary holds every kind of perk, a ward or a rider, and no other word', () => {
  for (const kind of ['meleeDR', 'arrowDR', 'spellPct', 'schoolWard', 'stunWard', 'dotWard', 'cap', 'aura', 'drain'])
    expect(GUARDIAN_PERK_VOCABULARY.has(kind), kind).toBe(true);
  expect(GUARDIAN_PERK_VOCABULARY.size).toBe(17);
  for (const word of ['ward', 'pct', 'amt', 'school', 'necromancy', 'auraPenalty', 'natureDR'])
    expect(GUARDIAN_PERK_VOCABULARY.has(word), word).toBe(false);
});

// The helper finds what it counts: each kind of check planted in one function of personal combat (an arrow with no
// name inside it counts for it, a named one for itself), and none of what isn't a check.
test("the ratchet's helper counts each check of a guardian's perk, and nothing else", () => {
  const planted = `
    export function planted(fx, cbt, foe, list, m) {
      const a = (fx.ward === 'meleeDR') + ('aura' !== fx.k) + list.includes('cap') + has('spellPct');
      const b = aFightersWardAsTheLineTellsIt(cbt, 'dotWard') + aFightersPerkNameAsTheLineTellsIt(cbt, 'stunWard');
      switch (fx.ward) { case 'thorns': break; }
      const c = cbt.arm.dodge + cbt.arm?.regen + cbt.arm['lowHp'] + m.stunWard + m.schoolWard?.psychic;
      const w = cbt.arm; const d = w.secondWind + (w.names.length);
      const e = foe.status.auraPenalty + cbt.burn + cbt['drain'] + cbt.dmgBonus;
      cbt.aura = 5; helper({ burn: cbt.burn });
      const inside = [fx].some((x) => x.ward == 'arrowDR');
      const notChecks = helper('meleeDR') + { ward: 'cap' }.ward + 'dodge' + cbt.arm.names + cbt.natureDR;
      const notAWord = (fx.ward === 'natureDR') + (fx.ward === 'pct') + has('auraPenalty');
      return a + b + c + d + e + inside + notChecks + notAWord;
    }
    const nested = function named() { return cbt.arm.cap; };`;
  expect(Object.fromEntries(guardianPerkChecksByFunction('src/engine/personal-combat/planted.ts', planted))).toEqual({
    planted: 18,
    nested: 1,
  });
  // the riders are read in personal combat only (a hero's skill aura is an `aura` elsewhere)
  expect(Object.fromEntries(guardianPerkChecksByFunction('src/engine/items/planted.ts', planted))).toEqual({
    planted: 14,
    nested: 1,
  });
});

test('every string naming a kind of perk in a function is found, a nested one too', () => {
  const planted = `
    const before = 'meleeDR';
    export function planted(fx) {
      const a = helper('dodge') + [\`aura\`].length + (fx.ward === 'cap');
      const inside = () => 'stunWard', notAWord = 'pct' || 'natureDR';
      return a + inside() + notAWord;
    }
    const after = 'drain';`;
  expect(everyPerkWordIn('planted.ts', planted, 'planted')).toEqual(['dodge', 'aura', 'cap', 'stunWard']);
  expect(everyPerkWordIn('planted.ts', planted, 'absent')).toBeNull();
});

// A check planted in a file of src/engine/ raises guardianPerkChecksInEngine by one, and the ratchet fails on it; one in
// src/engine/rules/ (the registries' effects, which read a perk's ward) or in a page's code isn't counted.
test.for([
  ['src/engine/personal-combat/x.ts', 1],
  ['src/engine/rules/x.ts', 0],
  ['src/ui/gm/x.ts', 0],
] as const)('a perk check planted in %s raises guardianPerkChecksInEngine by %i', ([file, rise]) => {
  const files = theCodeFiles();
  const asTheyAre = { ...readBaseline(), guardianPerkChecksInEngine: guardianPerkChecksInEngine(files) };
  expect(asTheyAre.guardianPerkChecksInEngine).toBe(readBaseline()['guardianPerkChecksInEngine']);
  const planted = {
    ...asTheyAre,
    guardianPerkChecksInEngine: guardianPerkChecksInEngine([
      ...files,
      [file, "export const planted = (fx: { ward?: string }): boolean => fx.ward === 'meleeDR';\n"],
    ]),
  };
  expect(planted.guardianPerkChecksInEngine).toBe(asTheyAre.guardianPerkChecksInEngine + rise);
  const { rose } = compare(asTheyAre, planted);
  expect(rose).toHaveLength(rise);
  expect(rose.filter((r) => /^guardianPerkChecksInEngine rose from \d+ to \d+\./.test(r))).toEqual(rose);
});
