// The tests' one way to read the site's code by its syntax tree, never by its lines or its layout (plan P1-09a). A test
// that needs a piece of a src/ file, the text a page shows, or a copy of src/ with something planted, asks here: the
// answer is the same however the file is laid out (Prettier, P1-09c), whether its declarations are exported (the
// module switch, P1-09d), and whether it is a .js or a .ts file (P1-09e). TypeScript's own parser reads both kinds;
// the types are stripped with its transpileModule. Every file's answers are checked, as written and after Prettier, by
// tests/unit/the-source-read-by-its-syntax-tree.test.ts.
//
//   sourceOf(file, names)        the named top-level declarations of a file, as one script (its order, `export` gone)
//   topLevelNames(file)          the names a file declares at top level, in order
//   sourceFrom(file, first, last)   the top-level declarations from the one named `first` through `last`
//   scriptOf(file)               the whole file as a classic script: imports gone, `export` gone, types gone
//   statementsBetween(file, fn, first, last)   the statements of a function from the one declaring `first` through
//                                the one declaring `last` (or reading `last`), in one block; compactCode(code) lays them out
//   initializersOf(file, name)   the source of every value `name` is declared with, at any depth (`const need=[…]`)
//   pageInitializer(page, name)  the first of those in a page's scripts
//   entriesOf(file, name)        the keys and values of the object literal `name` is declared with
//   compactOf(file), compactPage(page), compactDeclaration(file, name)
//                                a file's (a page's, a declaration's) code in one canonical layout, for a regular expression
//   stringsOf(file)              every string a file holds (each literal's value; a template's text with ${…}), not keys
//   pageScripts(page), pageStrings(page), pageText(page)
//                                the script files under src/ that make a published page, their strings, and those with
//                                the page's template: every word the page can show
//   pageSource(page)             the files that make a page (template, styles, scripts) as written: comments too
//   fileDeclaring(page, name)    the one script file of a page that declares `name` at top level
//   statementsFollowing(page, re, count)   the statement holding a matching message and the next `count`
//   callsTo(file, name)          every call of `name` in a file: the function it is in, and its arguments' source
//   plantBefore(code, file, fn, name, text), plantAtStart(code, file, fn, text),
//   replaceInitializer(code, file, fn, name, value)
//                                `code` (the text of `file`) with `text` put before the statement declaring `name` in
//                                function `fn`, or first in its body, or that declaration's value replaced
//   plantedSrc(edits), plantedSite(edits)   a temporary copy of src/ with those edits made (for loadEngine({src})),
//                                and a site built from it (for a page that must fail where nothing outside can make it)
//
// A file is named relative to src/ ('engine/world/generate.js'), or by a full path; `src` names another copy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { build, ROOT, sourcesOf } from '../../tools/build.ts';

export const SRC = path.join(ROOT, 'src');

export interface SourceOptions {
  /** The source folder (default: this checkout's src/), e.g. a copy with a planted fault. */
  readonly src?: string;
}

const fullPath = (file: string, src = SRC) => (path.isAbsolute(file) ? file : path.join(src, file));
const isTypeScript = (file: string) => /\.[cm]?ts$/.test(file);

// The trees already made in this process, by file and text: a test that reads the same files many times parses each
// once.
const trees = new Map<string, { text: string; tree: ts.SourceFile }>();

/** The syntax tree of `text`, as the file `file` (JavaScript or TypeScript by its name). Throws on a syntax error, so a
 *  file that no longer parses can't read as one with nothing in it. */
function treeOf(file: string, text: string): ts.SourceFile {
  const kept = trees.get(file);
  if (kept && kept.text === text) return kept.tree;
  const tree = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    isTypeScript(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
  // The parser's own errors: what it records as it reads the file (the program's syntactic diagnostics, without
  // making a program).
  const errors = (tree as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;
  if (!Array.isArray(errors))
    throw new Error('tests/lib/source.ts: this TypeScript no longer records parseDiagnostics');
  const first = errors.find((d) => d.category === ts.DiagnosticCategory.Error);
  if (first) {
    const where = first.start != null ? tree.getLineAndCharacterOfPosition(first.start) : null;
    throw new Error(
      `${file}: does not parse (${ts.flattenDiagnosticMessageText(first.messageText, ' ')}` +
        (where ? `, line ${String(where.line + 1)})` : ')'),
    );
  }
  trees.set(file, { text, tree });
  return tree;
}

/** A file's text and its syntax tree. */
function read(file: string, opts: SourceOptions = {}): { file: string; text: string; tree: ts.SourceFile } {
  const text = fs.readFileSync(fullPath(file, opts.src), 'utf8');
  return { file, text, tree: treeOf(fullPath(file, opts.src), text) };
}

/** `code` (a piece of `file`) as JavaScript: its types stripped if `file` is TypeScript, else as it is. */
function asJavaScript(file: string, code: string): string {
  if (!isTypeScript(file)) return code;
  return ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: false },
  }).outputText;
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);

/** A declaration's text without its `export` (and `default`) keyword. */
function withoutExport(node: ts.Node, tree: ts.SourceFile): string {
  const modifiers = ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
  const exportKeywords = modifiers.filter(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DefaultKeyword,
  );
  const last = exportKeywords[exportKeywords.length - 1];
  if (!last) return node.getText(tree);
  // the export keywords come first; what follows them (async, const, function, …) stays
  return tree.text.slice(last.getEnd(), node.getEnd()).trimStart();
}

const keywordOf = (list: ts.VariableDeclarationList) =>
  list.flags & ts.NodeFlags.Const ? 'const' : list.flags & ts.NodeFlags.Let ? 'let' : 'var';

interface TopLevel {
  name: string;
  /** The declaration as a statement of its own: `function f(){…}`, `const X=…;`. */
  code: string;
}

/** Every name a file declares at top level (functions, classes, each variable of a declaration), in order, each with
 *  its declaration as a statement of its own. `export` is dropped; types are kept (asJavaScript strips them). */
function topLevel(file: string, opts: SourceOptions = {}): TopLevel[] {
  const { tree } = read(file, opts);
  const out: TopLevel[] = [];
  for (const statement of tree.statements) {
    if (hasModifier(statement, ts.SyntaxKind.DeclareKeyword)) continue;
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
      out.push({ name: statement.name.text, code: withoutExport(statement, tree) });
    } else if (ts.isVariableStatement(statement)) {
      const keyword = keywordOf(statement.declarationList);
      for (const d of statement.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) out.push({ name: d.name.text, code: `${keyword} ${d.getText(tree)};` });
      }
    }
  }
  return out;
}

/** The names `file` declares at top level, in the file's order. */
export function topLevelNames(file: string, opts: SourceOptions = {}): string[] {
  return topLevel(file, opts).map((d) => d.name);
}

/** The top-level declarations of `file` named in `names` (functions, classes, constants, tables), in the file's order,
 *  as one classic script: `export` dropped, types stripped. Each name must be declared there exactly once. */
export function sourceOf(file: string, names: readonly string[], opts: SourceOptions = {}): string {
  const all = topLevel(file, opts);
  for (const name of names) {
    const found = all.filter((d) => d.name === name).length;
    if (found !== 1) throw new Error(`${file}: ${found ? 'declares ' + name + ' more than once' : 'no ' + name}`);
  }
  const wanted = new Set(names);
  return asJavaScript(
    file,
    all
      .filter((d) => wanted.has(d.name))
      .map((d) => d.code)
      .join('\n'),
  );
}

/** The top-level declarations of `file` from the one named `first` through the one named `last`, in its order, as
 *  sourceOf gives them: for a test that runs a run of a file's declarations on its own. */
export function sourceFrom(file: string, first: string, last: string, opts: SourceOptions = {}): string {
  const names = topLevelNames(file, opts);
  const [a, b] = [names.indexOf(first), names.indexOf(last)];
  if (a < 0 || b < 0 || b < a) throw new Error(`${file}: no run of declarations from ${first} to ${last}`);
  return sourceOf(file, [...new Set(names.slice(a, b + 1))], opts);
}

/** The whole of `file` as a classic script, to run on its own in a vm or a page: its import declarations dropped,
 *  `export` dropped from its declarations (an `export { … }` list goes too), types stripped. */
export function scriptOf(file: string, opts: SourceOptions = {}): string {
  const js = asJavaScript(file, read(file, opts).text);
  const tree = treeOf(file.replace(/\.[cm]?ts$/, '.js'), js);
  const cuts: [number, number][] = [];
  for (const statement of tree.statements) {
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
      cuts.push([statement.getFullStart(), statement.getEnd()]);
    } else if (ts.isExportAssignment(statement)) {
      throw new Error(`${file}: an export default can't run as a classic script`);
    } else if (ts.canHaveModifiers(statement)) {
      for (const m of ts.getModifiers(statement) ?? []) {
        if (m.kind === ts.SyntaxKind.DefaultKeyword)
          throw new Error(`${file}: an export default can't run as a script`);
        if (m.kind === ts.SyntaxKind.ExportKeyword) cuts.push([m.getStart(tree), m.getEnd()]);
      }
    }
  }
  let out = js;
  for (const [from, to] of cuts.sort((a, b) => b[0] - a[0])) out = out.slice(0, from) + out.slice(to);
  return out;
}

/** Every node of the tree under `node`, depth first, in source order. */
function* nodesUnder(node: ts.Node): Generator<ts.Node> {
  const stack: ts.Node[] = [node];
  while (stack.length) {
    const n = stack.pop();
    if (!n) break;
    yield n;
    const children: ts.Node[] = [];
    ts.forEachChild(n, (c) => {
      children.push(c);
    });
    for (let i = children.length - 1; i >= 0; i--) {
      const c = children[i];
      if (c) stack.push(c);
    }
  }
}

/** The function named `name` (a declaration, at any depth) in the tree. */
function functionNamed(tree: ts.SourceFile, name: string, file: string): ts.FunctionDeclaration {
  const found = [...nodesUnder(tree)].filter(
    (n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === name,
  );
  if (found.length !== 1)
    throw new Error(`${file}: ${found.length ? 'more than one function ' : 'no function '}${name}`);
  const [fn] = found;
  if (!fn?.body) throw new Error(`${file}: function ${name} has no body`);
  return fn;
}

/** Does the binding `b` (a name, or a destructuring pattern: `const {turnLog}=…`) bind `name`? */
function bindsName(b: ts.BindingName, name: string): boolean {
  if (ts.isIdentifier(b)) return b.text === name;
  return b.elements.some((e) => !ts.isOmittedExpression(e) && bindsName(e.name, name));
}

/** Does `statement` declare `name` (a variable of it, or a function or class of that name)? */
function declares(statement: ts.Node, name: string): boolean {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some((d) => bindsName(d.name, name));
  }
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) return statement.name?.text === name;
  return false;
}

/** The statement declaring `name` inside function `fn`'s body, at any depth there, in the tree. */
function declarationIn(tree: ts.SourceFile, fn: string, name: string, file: string): ts.Statement {
  const body = functionNamed(tree, fn, file).body;
  const found = body ? [...nodesUnder(body)].filter((n): n is ts.Statement => n !== body && declares(n, name)) : [];
  if (found.length !== 1) throw new Error(`${file}: ${found.length ? 'more than one ' : 'no '}${name} in ${fn}`);
  const [statement] = found;
  if (!statement) throw new Error(`${file}: no ${name} in ${fn}`);
  return statement;
}

/** A stretch of a function's code, as source (types stripped): in function `fn` (top-level, or nested at any depth),
 *  the statements from the one declaring `first` through `last`, in the same block: `last` is the statement declaring
 *  that name, or the statement whose code reads `last` in compact's canonical layout
 *  ('report.provinceCharIntel=provinceCharIntel;'). For a test that runs (or reads) a stretch of a long function on
 *  its own. `first` must be declared once in `fn`, and `last` must come after it. */
export function statementsBetween(
  file: string,
  fn: string,
  first: string,
  last: string,
  opts: SourceOptions = {},
): string {
  const { tree, text } = read(file, opts);
  const start = declarationIn(tree, fn, first, file);
  const block = start.parent;
  const statements: readonly ts.Statement[] = ts.isBlock(block) || ts.isSourceFile(block) ? block.statements : [];
  const a = statements.indexOf(start);
  const b = statements.findIndex((s, i) => i >= a && (declares(s, last) || compactCode(s.getText(tree)) === last));
  const [from, to] = [statements[a], statements[b]];
  if (a < 0 || !from || !to) throw new Error(`${file}: in ${fn}, no ${last} after ${first} in the same block`);
  return asJavaScript(file, text.slice(from.getStart(tree), to.getEnd()));
}

// The operators whose chains read the same however they are grouped: a || (b || c) and (a || b) || c.
const LOGICAL = new Set([
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);
// The canonical trees already made in this process, by the JavaScript they were made from.
const canonicalTrees = new Map<string, ts.SourceFile>();

/** The tree of `js` (JavaScript) with its brackets made canonical: every bracket around an expression is taken out,
 *  and TypeScript's own printer puts back those the grouping needs (`(a||[]).length`, `(function(){})()`), and only
 *  those. So a bracket a formatter adds for clarity (`(a && b) || c`) or takes out (`return (x);`) doesn't count. The
 *  A chain of one logical operator is grouped from the left (a || (b || c) reads as a || b || c: the same values,
 *  read in the same order; Prettier writes it so). The tree is the printed code's, parsed again; comments are gone.
 *  compact reads it. */
function canonicalTree(js: string): ts.SourceFile {
  const kept = canonicalTrees.get(js);
  if (kept) return kept;
  const tree = treeOf('canonical.js', js);
  const result = ts.transform(tree, [
    (context) => (root) => {
      const { factory } = context;
      const visit = (n: ts.Node): ts.Node => {
        if (ts.isParenthesizedExpression(n)) return visit(n.expression);
        const out = ts.visitEachChild(n, visit, context);
        if (!ts.isBinaryExpression(out) || !LOGICAL.has(out.operatorToken.kind)) return out;
        // a || (b || c) is (a || b) || c: the same values, read in the same order (Prettier writes it so)
        // (the factory puts back a bracket it thinks the right side needs: look inside it)
        const inner = (e: ts.Expression) => (ts.isParenthesizedExpression(e) ? e.expression : e);
        const op = out.operatorToken.kind;
        let left = out.left;
        let right = inner(out.right);
        if (!ts.isBinaryExpression(right) || right.operatorToken.kind !== op) return out;
        while (ts.isBinaryExpression(right) && right.operatorToken.kind === op) {
          left = factory.createBinaryExpression(left, op, inner(right.left));
          right = inner(right.right);
        }
        return factory.createBinaryExpression(left, op, right);
      };
      return visit(root) as ts.SourceFile;
    },
  ]);
  const [transformed] = result.transformed;
  if (!transformed) throw new Error('tests/lib/source.ts: the transform gave no tree');
  const printed = ts.createPrinter({ removeComments: true }).printFile(transformed);
  result.dispose();
  const out = ts.createSourceFile('canonical.js', printed, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  canonicalTrees.set(js, out);
  return out;
}

/** The canonical tree (canonicalTree) of `file`, its types stripped first. */
const canonicalTreeOf = (file: string, opts: SourceOptions = {}) =>
  canonicalTree(asJavaScript(file, read(file, opts).text));

/** `code` (JavaScript) in compact's canonical layout. */
export function compactCode(code: string): string {
  const tree = canonicalTree(code);
  return compact(tree, tree);
}

/** The source of the value `name` is declared with, for every variable named `name` in `file`, at any depth, in the
 *  file's order (types stripped): `const need=[…]` inside a function, say. */
export function initializersOf(file: string, name: string, opts: SourceOptions = {}): string[] {
  const { tree } = read(file, opts);
  return [...nodesUnder(tree)]
    .filter(
      (n): n is ts.VariableDeclaration & { initializer: ts.Expression } =>
        ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && !!n.initializer,
    )
    .map((d) =>
      asJavaScript(file, `(${d.initializer.getText(tree)})`)
        .trim()
        .replace(/;$/, ''),
    );
}

/** Is `n` an object literal's key, or a method's or class member's name (`'Great Turtles':`, `name:`)? Whether a key
 *  is quoted is layout (Prettier unquotes keys that need no quotes), so stringsOf leaves keys out; entriesOf reads
 *  them. */
const isKey = (n: ts.Node) =>
  (ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isIdentifier(n)) &&
  (ts.isPropertyAssignment(n.parent) ||
    ts.isMethodDeclaration(n.parent) ||
    ts.isPropertyDeclaration(n.parent) ||
    ts.isGetAccessorDeclaration(n.parent) ||
    ts.isSetAccessorDeclaration(n.parent)) &&
  n.parent.name === n;

/** Every string `file` holds, in its order: each string literal's value and each template literal's text with `${…}`
 *  where each expression stands; not an object's keys (entriesOf has them). The words a page can show, whatever quotes,
 *  escapes or line breaks the file is written with. */
export function stringsOf(file: string, opts: SourceOptions = {}): string[] {
  const { tree } = read(file, opts);
  const out: string[] = [];
  for (const n of nodesUnder(tree)) {
    if (isKey(n)) continue;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n))
      out.push(n.head.text + n.templateSpans.map((s) => '${…}' + s.literal.text).join(''));
  }
  return out;
}

/** One entry of an object literal, as entriesOf reads it. */
export interface Entry {
  /** The key, quoted or not (`'Great Turtles'` and `Weak` alike). */
  key: string;
  /** The value: a string literal's or a plain template literal's text, else its source in compact's layout. */
  value: string;
}

/** The entries of the object literal `name` is declared with in `file` (`const UNIT_ABILITIES={…}`, at top level or
 *  deeper; it must be declared once), in their order, duplicates kept: in an object literal the last one wins, and
 *  a test may want to know there was one. Spread entries and methods are left out. */
export function entriesOf(file: string, name: string, opts: SourceOptions = {}): Entry[] {
  const tree = canonicalTreeOf(file, opts);
  const found = [...nodesUnder(tree)].filter(
    (n): n is ts.VariableDeclaration =>
      ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && !!n.initializer,
  );
  if (found.length !== 1) throw new Error(`${file}: ${found.length ? 'more than one ' : 'no '}${name}`);
  let value = found[0]?.initializer;
  while (value && ts.isParenthesizedExpression(value)) value = value.expression;
  if (!value || !ts.isObjectLiteralExpression(value)) throw new Error(`${file}: ${name} is not an object literal`);
  return value.properties.filter(ts.isPropertyAssignment).map((p) => {
    const v = p.initializer;
    const text = ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v) ? v.text : compact(v, tree);
    const key =
      ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name)
        ? p.name.text
        : compact(p.name, tree);
    return { key, value: text };
  });
}

/** The script files under src/ that make the published page `page` (e.g. 'kingdoms-call-gm-portal.html'), in its
 *  order: its own code, not the data file or kc-safe.js, which it loads beside it. */
export function pageScripts(page: string): string[] {
  return sourcesOf(page).filter((f) => /\.[cm]?[jt]s$/.test(f));
}

/** Every string the page's scripts hold (stringsOf each of pageScripts), in order. */
export function pageStrings(page: string, opts: SourceOptions = {}): string[] {
  return pageScripts(page).flatMap((f) => stringsOf(f, opts));
}

/** The one script file of the page `page` that declares `name` at top level: `fileDeclaring(PLAYER, 'UNIT_ABILITIES')`.
 *  Throws if none does, or more than one. */
export function fileDeclaring(page: string, name: string, opts: SourceOptions = {}): string {
  const found = pageScripts(page).filter((f) => topLevelNames(f, opts).includes(name));
  if (found.length !== 1)
    throw new Error(`${page}: ${found.length ? 'more than one file declares' : 'no file declares'} ${name}`);
  return found[0] ?? '';
}

/** Every file under src/ that makes the page `page`, as written, one after another, a line between files: its
 *  template, its styles and its scripts (not the data file or kc-safe.js, which it loads beside it), as the built page
 *  held them until the module switch (P1-09d). For a test that counts a word wherever the page's own files hold it,
 *  comments included (Prettier keeps comments' words; what a comment says is only in the source). */
export function pageSource(page: string, opts: SourceOptions = {}): string {
  return sourcesOf(page)
    .map((f) => fs.readFileSync(fullPath(f, opts.src), 'utf8'))
    .join('\n');
}

/** The source of the value `name` is first declared with in the page's scripts (initializersOf, in the page's file
 *  order), or null: `pageInitializer(GM, 'TERRAIN_MODS')`, to evaluate beside the tables it reads. */
export function pageInitializer(page: string, name: string, opts: SourceOptions = {}): string | null {
  for (const f of pageScripts(page)) {
    const [first] = initializersOf(f, name, opts);
    if (first !== undefined) return first;
  }
  return null;
}

/** Every word the page can show: its template under src/ (the HTML as written) and every string its scripts hold
 *  (pageStrings), one after another, a line between each. What a words test reads, the same whatever the scripts'
 *  layout, quotes or escapes. */
export function pageText(page: string, opts: SourceOptions = {}): string {
  const template = sourcesOf(page)[0];
  if (!template) throw new Error(`${page}: no template`);
  return [fs.readFileSync(fullPath(template, opts.src), 'utf8'), ...pageStrings(page, opts)].join('\n');
}

/** One call of a function, as callsTo finds it. */
export interface Call {
  /** The function declaration the call is in (the innermost named one), or null at top level. */
  within: string | null;
  /** Each argument's source, with no white space and no comments, string literals in single quotes. */
  args: string[];
}

// Statements a semicolon ends: one left to automatic insertion is put in, as a formatter puts it in.
const ENDS_WITH_SEMICOLON = new Set([
  ts.SyntaxKind.ExpressionStatement,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.ReturnStatement,
  ts.SyntaxKind.BreakStatement,
  ts.SyntaxKind.ContinueStatement,
  ts.SyntaxKind.ThrowStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.DebuggerStatement,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ExportAssignment,
  ts.SyntaxKind.PropertyDeclaration,
]);
// A word's characters, and a (canonical, single) quote: a word and a string beside each other are spaced as people
// write them (`case 'explore':`, `return 'refuse'`), as two words must be (`const x`).
const WORD = /[\p{L}\p{N}_$\\']/u;
/** Would `a` then `b`, written with nothing between, read as other tokens, or as a word run into a string? (`const`
 *  `x`, `+` `+x`, `case` `'x'`.) */
const mustSpace = (a: string, b: string) => {
  const [x, y] = [a.slice(-1), b.slice(0, 1)];
  return (WORD.test(x) && WORD.test(y)) || (x === '+' && y === '+') || (x === '-' && y === '-');
};

/** The source of `node` in one canonical layout: its tokens with a space only between two words (or a word and a
 *  string), no comments, every string literal in single quotes (by its value: escapes and quotes as written don't
 *  count), every number by its value, a quoted key that needs no quotes unquoted, no brackets around a lone arrow
 *  parameter, `()` after a `new` without them, a semicolon ending every statement that takes one, no empty statement
 *  and no trailing comma. Read off a canonical tree (canonicalTree: only the brackets the grouping needs), as
 *  compactOf, compactDeclaration, compactCode, callsTo and entriesOf do, the same code reads the same in any layout
 *  (as written, after Prettier, after a bundler), so a test may match it with a regular expression written in the
 *  dense style: `/function handleHeroDeath\(/`, `/case 'explore':resolveExploreOrder\(turnContext,c/`. */
export function compact(node: ts.Node, tree: ts.SourceFile): string {
  const parts: string[] = [];
  const push = (t: string) => {
    // a trailing comma (a comma token right before the bracket that closes its list) goes
    if ((t === ')' || t === ']' || t === '}') && parts[parts.length - 1] === ',') parts.pop();
    const last = parts[parts.length - 1];
    if (last !== undefined && mustSpace(last, t)) parts.push(' ');
    parts.push(t);
  };
  const isLoneParameter = (n: ts.ArrowFunction) => {
    const [p] = n.parameters;
    return (
      n.parameters.length === 1 && !!p && ts.isIdentifier(p.name) && !p.type && !p.initializer && !p.dotDotDotToken
    );
  };
  const leaves = (n: ts.Node): void => {
    if (ts.isJSDoc(n) || n.kind === ts.SyntaxKind.EmptyStatement) return;
    if (ts.isStringLiteral(n)) {
      if (isKey(n) && /^[A-Za-z_$][\w$]*$/.test(n.text)) push(n.text);
      else push(`'${n.text.replace(/['\\]/g, '\\$&').replace(/\n/g, '\\n')}'`);
      return;
    }
    if (ts.isNumericLiteral(n)) {
      push(String(Number(n.text.replace(/_/g, ''))));
      return;
    }
    const children = n.getChildren(tree);
    if (!children.length) {
      push(n.getText(tree));
      return;
    }
    if (ts.isArrowFunction(n) && isLoneParameter(n)) {
      // `(o) =>`, `(o,) =>` and `o =>` alike: the parameter alone, then the rest from the arrow on
      for (const m of ts.getModifiers(n) ?? []) leaves(m);
      const [p] = n.parameters;
      if (p) leaves(p);
      for (const c of children.slice(children.findIndex((x) => x.kind === ts.SyntaxKind.EqualsGreaterThanToken)))
        leaves(c);
      return;
    }
    for (const c of children) leaves(c);
    if (ts.isNewExpression(n) && !n.arguments) parts.push('()');
    if (ENDS_WITH_SEMICOLON.has(n.kind) && n.getLastToken(tree)?.kind !== ts.SyntaxKind.SemicolonToken) parts.push(';');
  };
  leaves(node);
  return parts.join('');
}

/** The whole of `file` in compact's canonical layout, its types stripped first. */
export function compactOf(file: string, opts: SourceOptions = {}): string {
  const tree = canonicalTreeOf(file, opts);
  return compact(tree, tree);
}

/** The top-level declaration `name` of `file` (a function, a class, a variable) in compact's canonical layout, its
 *  types stripped first: `compactDeclaration('engine/run-turn.js', 'resolveTurn')`. */
export function compactDeclaration(file: string, name: string, opts: SourceOptions = {}): string {
  const tree = canonicalTreeOf(file, opts);
  const found = tree.statements.filter((s) => declares(s, name));
  if (found.length !== 1)
    throw new Error(`${file}: ${found.length ? 'declares ' + name + ' more than once' : 'no ' + name}`);
  const [statement] = found;
  if (!statement) throw new Error(`${file}: no ${name}`);
  return compact(statement, tree);
}

/** The page's scripts (pageScripts) in compact's canonical layout, one after another, a line between files. */
export function compactPage(page: string, opts: SourceOptions = {}): string {
  return pageScripts(page)
    .filter((f) => !f.endsWith('.css'))
    .map((f) => compactOf(f, opts))
    .join('\n');
}

/** Every call of the function `name` in `file` (`name(…)`), in order: the function it is made in and its arguments. */
export function callsTo(file: string, name: string, opts: SourceOptions = {}): Call[] {
  const tree = canonicalTreeOf(file, opts);
  const out: Call[] = [];
  const visit = (node: ts.Node, within: string | null) => {
    const here = ts.isFunctionDeclaration(node) && node.name ? node.name.text : within;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) {
      out.push({ within: here, args: node.arguments.map((a) => compact(a, tree)) });
    }
    ts.forEachChild(node, (c) => {
      visit(c, here);
    });
  };
  visit(tree, null);
  return out;
}

/** Where the page's scripts first hold a string or template literal whose code (in compact's layout, a template's
 *  `${…}` parts as written) matches `re`, in the pages' file order: that file, and the code of the statement holding it
 *  and of the `count` statements that come next in the file (each statement once, in the order they start; a block's
 *  braces are not one), in compact's layout, a line between each. Null if no literal matches. For a test that a call
 *  follows a message closely, whatever the lines: `statementsFollowing(GM, /hauls out/, 4)`. */
export function statementsFollowing(
  page: string,
  re: RegExp,
  count: number,
  opts: SourceOptions = {},
): { file: string; text: string } | null {
  for (const file of pageScripts(page)) {
    const tree = canonicalTreeOf(file, opts);
    const all = [...nodesUnder(tree)];
    const literal = all.find(
      (n) =>
        (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) &&
        re.test(compact(n, tree)),
    );
    if (!literal) continue;
    const statements = all.filter((n): n is ts.Statement => isStatement(n) && !ts.isBlock(n));
    let holder: ts.Node = literal;
    while (!statements.includes(holder as ts.Statement) && !ts.isSourceFile(holder)) holder = holder.parent;
    const at = statements.indexOf(holder as ts.Statement);
    if (at < 0) continue;
    return {
      file,
      text: statements
        .slice(at, at + count + 1)
        .map((n) => compact(n, tree))
        .join('\n'),
    };
  }
  return null;
}

/** Is `n` a statement (of any kind)? */
const isStatement = (n: ts.Node): n is ts.Statement =>
  ts.isExpressionStatement(n) ||
  ts.isVariableStatement(n) ||
  ts.isIfStatement(n) ||
  ts.isReturnStatement(n) ||
  ts.isForStatement(n) ||
  ts.isForOfStatement(n) ||
  ts.isForInStatement(n) ||
  ts.isWhileStatement(n) ||
  ts.isDoStatement(n) ||
  ts.isSwitchStatement(n) ||
  ts.isTryStatement(n) ||
  ts.isThrowStatement(n) ||
  ts.isBreakStatement(n) ||
  ts.isContinueStatement(n) ||
  ts.isFunctionDeclaration(n) ||
  ts.isClassDeclaration(n) ||
  ts.isBlock(n) ||
  ts.isLabeledStatement(n);

/** `code`, the text of `file`, with `text` put on a line of its own just before the statement declaring `name` inside
 *  function `fn`: for a planted copy of src/ that must still plant in the same place once the file is reformatted. */
export function plantBefore(code: string, file: string, fn: string, name: string, text: string): string {
  const tree = treeOf(file, code);
  const at = declarationIn(tree, fn, name, file).getStart(tree);
  return `${code.slice(0, at)}${text}\n${code.slice(at)}`;
}

/** `code`, the text of `file`, with `text` put first in the body of function `fn` (a declaration, at any depth): for a
 *  planted copy of src/ whose function throws, or records what it is handed, the moment it is called. */
export function plantAtStart(code: string, file: string, fn: string, text: string): string {
  const tree = treeOf(file, code);
  const body = functionNamed(tree, fn, file).body;
  if (!body) throw new Error(`${file}: function ${fn} has no body`);
  const at = body.getStart(tree) + 1;
  return `${code.slice(0, at)}\n${text}\n${code.slice(at)}`;
}

/** `code`, the text of `file`, with the value `name` is declared with inside function `fn` replaced by `value`. */
export function replaceInitializer(code: string, file: string, fn: string, name: string, value: string): string {
  const tree = treeOf(file, code);
  const statement = declarationIn(tree, fn, name, file);
  if (!ts.isVariableStatement(statement)) throw new Error(`${file}: ${name} in ${fn} is not a variable`);
  const d = statement.declarationList.declarations.find((x) => ts.isIdentifier(x.name) && x.name.text === name);
  if (!d?.initializer) throw new Error(`${file}: ${name} in ${fn} has no value`);
  return code.slice(0, d.initializer.getStart(tree)) + value + code.slice(d.initializer.getEnd());
}

/** A copy of src/ in a new temporary folder, with each file named in `edits` (relative to src/) rewritten by its
 *  function (plantBefore and replaceInitializer are made for it). `loadEngine({ src: dir })` loads it; `build(out, dir)`
 *  (tools/build.ts) builds a site from it. `remove()` deletes the copy. */
export function plantedSrc(edits: Record<string, (code: string, file: string) => string>): {
  dir: string;
  remove(): void;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-planted-src-'));
  fs.cpSync(SRC, dir, { recursive: true });
  for (const [file, edit] of Object.entries(edits)) {
    const full = path.join(dir, file);
    fs.writeFileSync(full, edit(fs.readFileSync(full, 'utf8'), file));
  }
  return {
    dir,
    remove: () => {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A site built (tools/build.ts's build) from a copy of src/ with `edits` made (plantedSrc), in a new temporary folder:
 *  `readPage(path.join(site.dir, 'kingdoms-call-gm-portal.html'))` boots its page, as a KC_SITE proof does. For a test
 *  that needs a page that fails somewhere it can't be made to fail from outside (a page's own functions can't be
 *  stood in once its files are modules, plan P1-09d). `remove()` deletes the copy and the site. */
export function plantedSite(edits: Record<string, (code: string, file: string) => string>): {
  dir: string;
  remove(): void;
} {
  const src = plantedSrc(edits);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-planted-site-'));
  build(dir, src.dir);
  return {
    dir,
    remove: () => {
      src.remove();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
