// The strings a function of the code holds, read from the file's syntax tree on its own, apart from the ratchet's
// helpers: the second witness of the static tests that hold the functions a family's rows have taken at 0 (the races,
// the tempers, the relations and the portal's alignments, B-06's Run 3). Level 0: it reads a file's text, nothing runs.
import ts from 'typescript';

/** The top level of a file: what no function holds. */
export const TOP = '(top)';

/** A function's or a method's declaration, or a variable's arrow or function, and its name (as the ratchet's helpers
 *  find a function). */
function aFunctionsName(node: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText();
  return ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer !== undefined &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ? node.name.text
    : null;
}

/** In the function named (or the file's top level, outside every named function): every string that is the count's
 *  word, in the order written, a literal type's too (a function nested inside with no name counts); null if the file
 *  doesn't declare the function. */
export function everyStringIn(
  file: string,
  text: string,
  fn: string,
  isTheWord: (word: string) => boolean,
): string[] | null {
  let found: string[] | null = fn === TOP ? [] : null;
  const collect = (node: ts.Node, into: string[], atTheTop: boolean): void => {
    if (atTheTop && aFunctionsName(node) !== null) return;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isTheWord(node.text))
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
