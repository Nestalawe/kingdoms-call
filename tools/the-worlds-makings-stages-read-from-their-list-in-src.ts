// The world's making's stages as their list in src/ holds them
// (src/engine/world/the-worlds-making/the-stages-in-the-order-they-run.ts, the one home of their order and their
// names), read from the list's syntax tree, not run: each stage's id, its name in game terms, its function's name and
// the file the list imports it from. The world proof's stage table (tools/proof/the-worlds-makings-stages.ts) and the
// world-making counts' list (tools/ratchet.ts) read their stages here, so neither loads the engine (the proof's worker
// loads only its side's src/), and a new stage is one entry in the list. Throws on an entry of another shape.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');

/** The list's file, from the repository's root, and its constant's name. */
export const THE_STAGES_LIST = {
  file: 'src/engine/world/the-worlds-making/the-stages-in-the-order-they-run.ts',
  name: 'THE_WORLDS_MAKINGS_STAGES_IN_THE_ORDER_THEY_RUN',
} as const;

/** One stage as the list holds it: its id, what it makes in game terms, its function's name, and that function's file
 *  (from the repository's root). */
export interface AStageReadFromTheList {
  stage: string;
  inGameTerms: string;
  fn: string;
  file: string;
}

/** The text of a string property of an object literal, or undefined (the battles' stage lists' reader reads with it
 *  too: tools/proof/the-stages-of-the-two-battles-and-the-lines-that-open-them.ts). */
export function stringProperty(o: ts.ObjectLiteralExpression, name: string): string | undefined {
  for (const p of o.properties)
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name)
      if (ts.isStringLiteral(p.initializer) || ts.isNoSubstitutionTemplateLiteral(p.initializer))
        return p.initializer.text;
  return undefined;
}
/** The identifier an object literal's property holds, or undefined. */
export function identifierProperty(o: ts.ObjectLiteralExpression, name: string): string | undefined {
  for (const p of o.properties)
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name)
      if (ts.isIdentifier(p.initializer)) return p.initializer.text;
  return undefined;
}
/** The expression under any `as const` and `satisfies` around it. */
export function unwrapped(e: ts.Expression): ts.Expression {
  let at = e;
  while (ts.isAsExpression(at) || ts.isSatisfiesExpression(at) || ts.isParenthesizedExpression(at)) at = at.expression;
  return at;
}

/** The stages the list's text holds, in its order (`file` is the list's path from the root, for the imports). */
export function theStagesTheListsTextHolds(text: string, file: string = THE_STAGES_LIST.file): AStageReadFromTheList[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const importedFrom = new Map<string, string>();
  let list: ts.ArrayLiteralExpression | undefined;
  for (const s of source.statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier)) {
      const named = s.importClause?.namedBindings;
      if (named && ts.isNamedImports(named))
        for (const e of named.elements)
          importedFrom.set(e.name.text, path.posix.join(path.posix.dirname(file), s.moduleSpecifier.text));
    }
    if (ts.isVariableStatement(s))
      for (const d of s.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || d.name.text !== THE_STAGES_LIST.name || !d.initializer) continue;
        const init = unwrapped(d.initializer);
        if (ts.isArrayLiteralExpression(init)) list = init;
      }
  }
  if (!list) throw new Error(`${file} declares no array ${THE_STAGES_LIST.name}`);
  return list.elements.map((e, i) => {
    const o = ts.isObjectLiteralExpression(e) ? e : undefined;
    const stage = o && stringProperty(o, 'stage');
    const inGameTerms = o && stringProperty(o, 'inGameTerms');
    const fn = o && identifierProperty(o, 'run');
    const fnsFile = fn === undefined ? undefined : importedFrom.get(fn);
    if (stage === undefined || inGameTerms === undefined || fn === undefined || fnsFile === undefined)
      throw new Error(
        `${file}, ${THE_STAGES_LIST.name}'s entry ${String(i)}: not { stage: '<id>', inGameTerms: '<words>', run: <a function imported by name> }`,
      );
    return { stage, inGameTerms, fn, file: fnsFile };
  });
}

/** The stages the list in this tree's src/ holds, in its order. */
export const theStagesTheListHolds = (): AStageReadFromTheList[] =>
  theStagesTheListsTextHolds(fs.readFileSync(path.join(ROOT, THE_STAGES_LIST.file), 'utf8'));
