// The kinds of line the spy and Clairvoyance feeds pass over (plan P1-12d36: P1-12d's Decisions of 2026-11-01,
// Decision 3; src/views/the-kinds-of-line-the-spy-and-scrying-feeds-pass-over.ts) are kept in step with the words the
// views write for them (src/views/prose/):
//   1. the roll lines (THE_KINDS_OF_A_ROLL_LINE) are exactly the kinds whose words open with 📊, and every literal in
//      the prose that opens with 📊 is such a kind's words (a case of its area's words that returns it);
//   2. the force marker (⚑FORCE⚑) opens the words of one kind alone, the force drawn up for battle
//      (THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE), and nothing else in the prose holds it.
// So a new kind whose words show a roll joins the list, and a roll line reworded leaves it, in the same change.
// Level 0 (static): the prose modules by their syntax tree (TypeScript's parser); nothing runs. A lower level doesn't
// exist; a game can't reach every kind (the matrix proves the feeds' lines in play, every realm's report identical).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import {
  THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE,
  THE_KINDS_OF_A_ROLL_LINE,
} from '../../src/views/the-kinds-of-line-the-spy-and-scrying-feeds-pass-over.ts';

const PROSE = path.join(import.meta.dirname, '../../src/views/prose');
const ROLL = '\u{1F4CA}';
const FORCE = '⚑FORCE⚑';

/** A literal's opening text: a string's, or a template's head. */
const theOpeningOf = (node: ts.Node): string | null =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : ts.isTemplateExpression(node)
      ? node.head.text
      : null;

/** The kind whose words a literal opens: the case of its area's words that returns it, as the returned words' leftmost
 *  part (`case '<kind>': return <literal> …;`, its block or not; `<literal> + …` too); else null. */
const theKindWhoseWordsItOpens = (literal: ts.Node): string | null => {
  let node = literal;
  while (
    (ts.isBinaryExpression(node.parent) &&
      node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      node.parent.left === node) ||
    ts.isParenthesizedExpression(node.parent)
  )
    node = node.parent;
  if (!ts.isReturnStatement(node.parent)) return null;
  let clause = node.parent.parent;
  if (ts.isBlock(clause)) clause = clause.parent;
  return ts.isCaseClause(clause) && ts.isStringLiteralLike(clause.expression) ? clause.expression.text : null;
};

/** Each literal in the prose opening with the mark, and the kind whose words it opens (null: none). */
const literalsOpeningWith = (mark: string) => {
  const found: { file: string; line: number; kind: string | null }[] = [];
  for (const name of fs.readdirSync(PROSE).filter((f) => f.endsWith('.ts'))) {
    const text = fs.readFileSync(path.join(PROSE, name), 'utf8');
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (theOpeningOf(node)?.startsWith(mark)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        found.push({ file: name, line, kind: theKindWhoseWordsItOpens(node) });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
};

test('the roll lines are exactly the kinds whose words open with 📊, and every 📊 in the prose opens a kind’s words', () => {
  const rolls = literalsOpeningWith(ROLL);
  expect(rolls.filter((r) => r.kind === null)).toEqual([]);
  expect(new Set(rolls.map((r) => r.kind))).toEqual(new Set(THE_KINDS_OF_A_ROLL_LINE));
  expect(rolls).toHaveLength(THE_KINDS_OF_A_ROLL_LINE.size);
});

test('the force marker opens the words of a force drawn up for battle alone', () => {
  expect(literalsOpeningWith(FORCE).map((r) => r.kind)).toEqual([THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE]);
  const holding = fs
    .readdirSync(PROSE)
    .filter((f) => f.endsWith('.ts') && fs.readFileSync(path.join(PROSE, f), 'utf8').includes(FORCE));
  expect(holding).toEqual(['the-words-of-a-battles-lines.ts']);
});
