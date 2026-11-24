// The bots' two tables by temper are keyed by content's four tempers (B-06, T7, the rules pulled out: the stack's
// review, on B-06ak): the bots name a temper only as a key of these two tables, the duel worth of a hero by his temper
// (THE_DUEL_WORTH_OF_A_HERO_BY_HIS_TEMPER, src/engine/bots/spellcraft.ts) and what a king's temper adds to the war bar
// (BOT_WAR.temper, src/engine/bots/war.ts), and a key is a name no count sees (temperChecksInEngine counts strings).
// So each table's keys are content's tempers (KC_TEMPERS), in its order: a temper dropped, misspelt or added, in a
// table or in content, turns this red.
// Level 0 (static): the two files' syntax trees and content's list of tempers as written; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import { KC_TEMPERS } from '../../src/content/kingdoms-call-data.ts';
import { ROOT } from '../../tools/build.ts';

/** The keys of an object literal, as written (quoted or not). */
const theKeysOf = (o: ts.ObjectLiteralExpression): string[] =>
  o.properties.map((p) =>
    p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : `(${String(p.kind)})`,
  );

/** The object literal a variable is declared with in a file, and, given a property, that property's object literal:
 *  each must be found once. */
function theObjectLiteral(file: string, variable: string, property?: string): ts.ObjectLiteralExpression {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(path.join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variable &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      if (property === undefined) found.push(node.initializer);
      else
        for (const p of node.initializer.properties)
          if (
            ts.isPropertyAssignment(p) &&
            ts.isIdentifier(p.name) &&
            p.name.text === property &&
            ts.isObjectLiteralExpression(p.initializer)
          )
            found.push(p.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (found.length !== 1)
    throw new Error(`${file}: ${String(found.length)} of ${variable}${property ? `.${property}` : ''}`);
  const [theOne] = found;
  if (!theOne) throw new Error(`${file}: no ${variable}`);
  return theOne;
}

test.for([
  ['src/engine/bots/spellcraft.ts', 'THE_DUEL_WORTH_OF_A_HERO_BY_HIS_TEMPER', undefined],
  ['src/engine/bots/war.ts', 'BOT_WAR', 'temper'],
] as const)("%s: %s's keys are content's four tempers", ([file, variable, property]) => {
  expect(theKeysOf(theObjectLiteral(file, variable, property)), `${variable}${property ? `.${property}` : ''}`).toEqual(
    KC_TEMPERS,
  );
});

test("content's tempers are the four the bots' weights name", () => {
  expect(KC_TEMPERS).toEqual(['Berserk', 'Brave', 'Cautious', 'Cowardly']);
});
