// src/globals.d.ts (plan P1-09e) declares, for TypeScript, exactly the declared globals the site's code has: each
// `globalThis.<name> = <value>;` at the top of a file of src/ (P1-09b) is a `declare var <name>` there, and nothing else
// is, but the three names the pages' classic scripts and the tests give (KC_CONFIG, supabase, KC_RNG_SEED). So a new
// declared global can't go untyped, and a declaration can't outlive its variable. Level 0 (static): it parses files and
// runs nothing; a lower level has nothing to read.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { filesUnder, ROOT } from '../../tools/build.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const SRC = path.join(ROOT, 'src');
const DTS = 'globals.d.ts';
const FROM_THE_PAGE = ['KC_CONFIG', 'KC_RNG_SEED', 'supabase'];

/** The names `globalThis.<name> = …;` statements at the top of the files of `src` declare, sorted, each once. */
function declaredInTheCode(src: string): string[] {
  const names = new Set<string>();
  for (const file of filesUnder(src).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))) {
    const tree = ts.createSourceFile(file, fs.readFileSync(path.join(src, file), 'utf8'), ts.ScriptTarget.Latest);
    for (const s of tree.statements) {
      if (!ts.isExpressionStatement(s) || !ts.isBinaryExpression(s.expression)) continue;
      const { left, operatorToken } = s.expression;
      if (operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isPropertyAccessExpression(left)) continue;
      if (ts.isIdentifier(left.expression) && left.expression.text === 'globalThis') names.add(left.name.text);
    }
  }
  return [...names].sort();
}

/** The variables `text` (a .d.ts file) declares at its top, by kind: `var` ones and the others. */
function declaredInTheTypes(text: string): { vars: string[]; others: string[] } {
  const tree = ts.createSourceFile(DTS, text, ts.ScriptTarget.Latest);
  const vars: string[] = [];
  const others: string[] = [];
  for (const s of tree.statements) {
    if (!ts.isVariableStatement(s)) continue;
    const isVar = !(s.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let));
    for (const d of s.declarationList.declarations)
      if (ts.isIdentifier(d.name)) (isVar ? vars : others).push(d.name.text);
  }
  return { vars: vars.sort(), others: others.sort() };
}

/** What differs between the code's declared globals and the file's declarations. */
function differences(src: string, text: string): string[] {
  const code = declaredInTheCode(src);
  const { vars, others } = declaredInTheTypes(text);
  return [
    ...code.filter((n) => !vars.includes(n)).map((n) => `${n}: a declared global, not declared in ${DTS}`),
    ...vars.filter((n) => !code.includes(n)).map((n) => `${n}: declared in ${DTS}, but no file declares it`),
    ...(others.join() === FROM_THE_PAGE.join() ? [] : [`the page's names are ${others.join(', ')}`]),
  ];
}

const text = fs.readFileSync(path.join(SRC, DTS), 'utf8');

describe('src/globals.d.ts', () => {
  test(
    'declares exactly the declared globals of the code, and the three names the page gives',
    timeLimitForTheWork({ everyFileReads: 2 }),
    () => {
      expect(declaredInTheCode(SRC).length).toBeGreaterThan(40);
      expect(differences(SRC, text)).toEqual([]);
    },
  );

  test(
    'a declared global missing from it, or one too many, is found (planted)',
    timeLimitForTheWork({ everyFileReads: 2 }),
    () => {
      const without = text.replace(/^declare var currentGame: PageState;\n/m, '');
      expect(without).not.toBe(text);
      expect(differences(SRC, without)).toEqual([`currentGame: a declared global, not declared in ${DTS}`]);
      const extra = text + 'declare var _goneLongAgo: PageState;\n';
      expect(differences(SRC, extra)).toEqual([`_goneLongAgo: declared in ${DTS}, but no file declares it`]);
    },
  );
});
