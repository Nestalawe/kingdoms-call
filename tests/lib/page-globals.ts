// What each page must keep on `window` once its scripts are ES modules (plan P1-09, Decision 7), read from the code by
// its syntax tree. A module's top-level names are its own: nothing outside it (an inline on…="…" handler, a test's
// W.eval, a browser spec's page.evaluate) can reach one unless the page puts it on `window`. Each script page does
// that in one reviewed file, src/ui/<page>/globals.ts, the last file its entry (page.ts) imports: two
// Object.assign(window, { … }) lists, the names its inline handlers call and the names its tests reach. A variable that
// changes after the page has loaded can't go on a list (the list copies its value once, and the copy goes stale): it is
// a declared global instead, `globalThis.<name> = <value>;` where it was declared, read and written by its bare name as
// before.
// tests/static/page-globals.test.ts checks the lists against what this module finds:
//
//   pageDeclarations(page)       every top-level name of the files that become the page's modules, with its file and kind
//   declaredGlobals(page)        the page's declared globals: name → file
//   handlerNames(page)           the page's names an inline handler calls, in its template or in its scripts' strings
//   namesTestsReachOnPages()     for each page, the names the tests and tools read and write on it, and where
//   globalsLists(page)           the two lists in the page's globals.ts, each name with the file its comment names
//
// What counts as reaching a page (only in a file that opens one: it boots a page with bootJsdom, bootScenario, JSDOM,
// playGame or page.goto, and the pages are the ones it names, or the GM portal for bootScenario and playGame):
// - the code handed to `.eval(…)`, `.evaluate(…)`, `.evaluateHandle(…)`, `.waitForFunction(…)` or `.addInitScript(…)`
//   on anything but `vm`: a string, a template (each `${…}` read as a name of its own), a function, a constant of the file holding one
//   of those, or the argument of a one-argument wrapper of the file that hands its parameter on (`ev=x=>w.eval(x)`);
// - in tests/lib/screens.js, which builds its screen tours as code, every string or template that parses as code;
// - `W.name`, `W['name']`, and their assignments, where W is a page's window: an identifier named like one (W, w, win,
//   window, P, PP…, GM…) that isn't the engine's vm (tests/lib/scenario-in-the-vm.ts, loadEngine), or `<x>.window`.
// Inside the code, a name read or assigned by its bare name counts, and so does `window.name`. A name the code declares
// itself doesn't. Level 0: it reads files and runs nothing.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { filesUnder, ROOT } from '../../tools/build.ts';
import { pageModules } from '../../tools/pages.ts';

const SRC = path.join(ROOT, 'src');

/** The four pages with scripts of their own (the landing page has none; the rulebooks' table of contents calls no
 *  name from outside), and each one's folder. */
export const SCRIPT_PAGES = {
  'kingdoms-call-gm-portal.html': 'ui/gm',
  'kingdoms-call-player-portal.html': 'ui/player',
  'kingdoms-call-leaderboard.html': 'ui/leaderboard',
  'kingdoms-call-overlord.html': 'ui/overlord',
} as const;
export type ScriptPage = keyof typeof SCRIPT_PAGES;
export const SCRIPT_PAGE_NAMES = Object.keys(SCRIPT_PAGES) as ScriptPage[];

/** The page's globals file, relative to src/. */
export const globalsFileOf = (page: ScriptPage): string => `${SCRIPT_PAGES[page]}/globals.ts`;

export interface Declaration {
  /** The file that declares it, relative to src/. */
  file: string;
  /** 'global' for a declared global (`globalThis.<name> = …;`). */
  kind: 'function' | 'class' | 'const' | 'let' | 'var' | 'global';
}

/** What a template's `${…}` is read as: a name no page declares, which parses wherever a value or a name can stand
 *  (`f(${x})`, `${x}.concat(…)`, `{${k}:1}`); where a statement can start (after `;`, `{` or `}`, or first), a
 *  statement of its own (`…;${moreCode}next();`), so the code after it is read as written. */
const INTERPOLATION = '__interpolated';
/** Pieces of code with an unknown value (null: a `${…}`, or a piece of a `+` chain that isn't a string) between them,
 *  joined as INTERPOLATION says. */
function joinPieces(pieces: readonly (string | null)[]): string {
  let out = '';
  for (const piece of pieces) out += piece ?? (/(^|[;{}])\s*$/.test(out) ? `${INTERPOLATION};` : INTERPOLATION);
  return out;
}
const templateText = (n: ts.TemplateExpression): string =>
  joinPieces([n.head.text, ...n.templateSpans.flatMap((s) => [null, s.literal.text])]);

const parsed = new Map<string, ts.SourceFile>();
function treeOf(file: string, text: string, kind: ts.ScriptKind): ts.SourceFile {
  const key = `${file}\0${text}`;
  const kept = parsed.get(key);
  if (kept) return kept;
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  parsed.set(key, tree);
  return tree;
}

/** The parser's own errors for `tree` (as tests/lib/source.ts reads them). */
function parseErrors(tree: ts.SourceFile): number {
  const errors = (tree as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;
  if (!Array.isArray(errors))
    throw new Error('tests/lib/page-globals.ts: this TypeScript no longer records parseDiagnostics');
  return errors.filter((d) => d.category === ts.DiagnosticCategory.Error).length;
}

const kindOf = (file: string) => (/\.[cm]?ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
const sourceTree = (file: string, src = SRC) =>
  treeOf(file, fs.readFileSync(path.join(src, file), 'utf8'), kindOf(file));

/** The page's modules (tools/pages.ts): the files under src/ its entry imports, directly or not, in the order they run. */
export function pageModuleFiles(page: ScriptPage, src = SRC): string[] {
  return pageModules(page, src);
}

/** The page's entry: src/ui/<page>/page.ts, which imports its files in the order they ran as classic scripts. */
export const entryOf = (page: ScriptPage): string => `${SCRIPT_PAGES[page]}/page.ts`;

/** The classic scripts the page keeps, as their code, each with where it is: the inline ones in its template (the
 *  boot-failure reporter), and those its template loads by a <script src> tag from public/, which is copied as it is
 *  (kc-config.js, kc-staging-footer.js; not supabase-js, which isn't the site's code). */
export function pageClassicScripts(page: ScriptPage, src = SRC): { where: string; code: string }[] {
  const template = fs.readFileSync(path.join(src, page), 'utf8');
  const out: { where: string; code: string }[] = [];
  for (const m of template.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    const attributes = m[1] ?? '';
    if (/\btype="module"/.test(attributes)) continue;
    const named = /\bsrc="([^"]+)"/.exec(attributes)?.[1];
    if (named === undefined) out.push({ where: `${page} (inline)`, code: m[2] ?? '' });
    else if (!named.startsWith('vendor/')) {
      const file = path.join(src, '..', 'public', named);
      const kept = fs.existsSync(file) ? file : path.join(ROOT, 'public', named);
      out.push({ where: `public/${named}`, code: fs.readFileSync(kept, 'utf8') });
    }
  }
  return out;
}

/** The page's module names its classic scripts read: name → the scripts that do. */
export function namesClassicScriptsRead(page: ScriptPage, src = SRC): Map<string, string[]> {
  const names = pageDeclarations(page, src);
  const out = new Map<string, string[]>();
  for (const { where, code } of pageClassicScripts(page, src)) {
    const reach = reachOf(code, ts.ScriptKind.JS);
    if (!reach) throw new Error(`${where}: does not parse`);
    for (const name of reach.reads) if (names.has(name)) out.set(name, [...(out.get(name) ?? []), where]);
  }
  return out;
}

/** Every name a statement declares at the top of a script. */
function topLevelOf(tree: ts.SourceFile): [string, Declaration['kind']][] {
  const out: [string, Declaration['kind']][] = [];
  const bind = (b: ts.BindingName, kind: Declaration['kind']) => {
    if (ts.isIdentifier(b)) out.push([b.text, kind]);
    else for (const e of b.elements) if (!ts.isOmittedExpression(e)) bind(e.name, kind);
  };
  for (const s of tree.statements) {
    if (ts.isFunctionDeclaration(s) && s.name) out.push([s.name.text, 'function']);
    else if (ts.isClassDeclaration(s) && s.name) out.push([s.name.text, 'class']);
    else if (ts.isVariableStatement(s)) {
      const flags = s.declarationList.flags;
      const kind = flags & ts.NodeFlags.Const ? 'const' : flags & ts.NodeFlags.Let ? 'let' : 'var';
      for (const d of s.declarationList.declarations) bind(d.name, kind);
    } else {
      const name = declaredGlobalOf(s);
      if (name) out.push([name, 'global']);
    }
  }
  return out;
}

/** Every top-level name of the page's module files: name → its file and kind. */
export function pageDeclarations(page: ScriptPage, src = SRC): Map<string, Declaration> {
  const names = new Map<string, Declaration>();
  for (const file of pageModuleFiles(page, src))
    for (const [name, kind] of topLevelOf(sourceTree(file, src))) names.set(name, { file, kind });
  return names;
}

/** `globalThis.<name> = …;` as a statement at the top of a file: the name, or null. */
function declaredGlobalOf(s: ts.Statement): string | null {
  if (!ts.isExpressionStatement(s) || !ts.isBinaryExpression(s.expression)) return null;
  const { left, operatorToken } = s.expression;
  if (operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isPropertyAccessExpression(left)) return null;
  return ts.isIdentifier(left.expression) && left.expression.text === 'globalThis' ? left.name.text : null;
}

/** The page's declared globals (`globalThis.<name> = <value>;` at the top of one of its module files): name → file. */
export function declaredGlobals(page: ScriptPage, src = SRC): Map<string, string> {
  return new Map([...pageDeclarations(page, src)].filter(([, d]) => d.kind === 'global').map(([n, d]) => [n, d.file]));
}

/** What a piece of code reads and assigns by its bare name (or as `window.<name>`), leaving out what it declares. */
interface Reach {
  reads: Set<string>;
  writes: Set<string>;
}

const ASSIGNMENTS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);
function isAssigned(node: ts.Node): boolean {
  const p = node.parent;
  if (ts.isBinaryExpression(p)) return p.left === node && ASSIGNMENTS.has(p.operatorToken.kind);
  if (ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p))
    return p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken;
  return false;
}
const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self']);

/** Whether a string that parses is code that does something (a call, an assignment, a `new`, a declaration), and not
 *  a word that happens to parse ('ME', a tactic's code, reads as a name). */
function doesSomething(code: string): boolean {
  const tree = treeOf('string.js', code, ts.ScriptKind.JS);
  if (parseErrors(tree)) return false;
  let found = false;
  const visit = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) ||
      ts.isNewExpression(n) ||
      ts.isVariableStatement(n) ||
      ts.isFunctionDeclaration(n) ||
      (ts.isBinaryExpression(n) && ASSIGNMENTS.has(n.operatorToken.kind))
    )
      found = true;
    if (!found) ts.forEachChild(n, visit);
  };
  visit(tree);
  return found;
}

/** What `code` reaches; null if it isn't code (it doesn't parse). */
function reachOf(code: string, kind: ts.ScriptKind): Reach | null {
  const tree = treeOf(kind === ts.ScriptKind.TS ? 'reach.ts' : 'reach.js', code, kind);
  if (parseErrors(tree)) return null;
  const reads = new Set<string>();
  const writes = new Set<string>();
  const declared = new Set<string>();
  const note = (name: string, node: ts.Node) => {
    reads.add(name);
    if (isAssigned(node)) writes.add(name);
  };
  const visit = (n: ts.Node): void => {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name))
      declared.add(n.name.text);
    if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isClassDeclaration(n)) && n.name)
      declared.add(n.name.text);
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && GLOBAL_OBJECTS.has(n.expression.text))
      note(n.name.text, n);
    if (
      ts.isElementAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      GLOBAL_OBJECTS.has(n.expression.text) &&
      ts.isStringLiteralLike(n.argumentExpression)
    )
      note(n.argumentExpression.text, n);
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const named =
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        ((ts.isPropertyAssignment(p) ||
          ts.isMethodDeclaration(p) ||
          ts.isPropertyDeclaration(p) ||
          ts.isGetAccessorDeclaration(p) ||
          ts.isSetAccessorDeclaration(p)) &&
          p.name === n) ||
        ts.isLabeledStatement(p) ||
        ts.isBreakOrContinueStatement(p) ||
        ts.isTypeReferenceNode(p) ||
        ts.isQualifiedName(p);
      if (!named) note(n.text, n);
    }
    ts.forEachChild(n, visit);
  };
  visit(tree);
  for (const d of declared) {
    reads.delete(d);
    writes.delete(d);
  }
  return { reads, writes };
}

/** The code inside every on…="…" (or on…='…') attribute of `text`. An attribute cut off by the end of `text` (a string
 *  joined with `+` to the rest of it) gives what there is of it. */
function handlerCodeIn(text: string): string[] {
  const out: string[] = [];
  const attribute = /\bon[a-z]+=(["'])/g;
  for (let m = attribute.exec(text); m; m = attribute.exec(text)) {
    const quote = m[1] ?? '"';
    const start = m.index + m[0].length;
    const end = text.indexOf(quote, start);
    out.push(text.slice(start, end < 0 ? text.length : end));
    if (end < 0) break;
    attribute.lastIndex = end + quote.length;
  }
  return out;
}

/** Every string a script holds, as the page gets it: each literal's value, and each template's text with every `${…}`
 *  read as a name of its own (a template inside one is a string of its own). */
function stringsIn(tree: ts.SourceFile): string[] {
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteralLike(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n)) out.push(templateText(n));
    ts.forEachChild(n, visit);
  };
  visit(tree);
  return out;
}

/** The bare names in a piece of a handler that doesn't parse on its own (cut off by a `+`): every word not after a dot
 *  and not inside quotes. More than the code reads, never less. */
const wordsOf = (code: string): string[] =>
  code.replace(/(["'])(?:\\.|(?!\1).)*\1/g, "''").match(/(?<![.\w$])[A-Za-z_$][\w$]*/g) ?? [];

/** The page's names its inline handlers call or read: name → the files whose handlers do. In the page's template and in
 *  its scripts' strings (the kcHtml strings), as code. A handler whose name is built (`on…="${fn}()"`) can't be read:
 *  none does today. */
export function handlerNames(page: ScriptPage, src = SRC): Map<string, string[]> {
  const names = pageDeclarations(page, src);
  const out = new Map<string, string[]>();
  for (const file of [page, ...pageModuleFiles(page, src)]) {
    const texts = /\.html$/.test(file)
      ? [fs.readFileSync(path.join(src, file), 'utf8')]
      : stringsIn(sourceTree(file, src));
    for (const code of texts.flatMap(handlerCodeIn)) {
      const reach = reachOf(code, ts.ScriptKind.JS);
      for (const name of reach ? reach.reads : wordsOf(code))
        if (names.has(name)) out.set(name, [...new Set([...(out.get(name) ?? []), file])]);
    }
  }
  return out;
}

// ---- The tests' side

/** The test and tool files that may reach a page: under tests/ and tools/, not the quarantine, the balance baselines,
 *  or tools/legacy/ (older content-export tools, not run). Relative to the repository. */
export function testAndToolFiles(root = ROOT): string[] {
  return ['tests', 'tools']
    .flatMap((dir) => filesUnder(path.join(root, dir)).map((f) => `${dir}/${f}`))
    .filter((f) => /\.[cm]?[jt]s$/.test(f) && !/\.d\.ts$/.test(f))
    .filter((f) => !/^(tests\/quarantine|tests\/balance\/baseline|tools\/legacy)\//.test(f));
}

const OPENS_A_PAGE = /\b(bootJsdom|bootScenario|JSDOM|playGame)\s*\(|\.goto\s*\(/;
const OPENS_THE_GM_PAGE = /\b(bootScenario|playGame)\s*\(/;
const EVALUATES = new Set(['eval', 'evaluate', 'evaluateHandle', 'waitForFunction', 'addInitScript']);
const LIKE_A_WINDOW = /^(W|w|win|window|P|PP\w*|GM\w*|pw|pageWindow)$/;
const THE_VM = /\b(scenarioInTheVm|loadEngine|createContext)\b/;
const CODE_IN_EVERY_STRING = new Set(['tests/lib/screens.js']);

/** The pages a test file opens itself (see the top of this file); none if it opens no page. */
export function pagesOpenedBy(text: string): ScriptPage[] {
  if (!OPENS_A_PAGE.test(text)) return [];
  const named = SCRIPT_PAGE_NAMES.filter((p) => text.includes(p) || text.includes(p.replace(/\.html$/, '')));
  if (named.length) return named;
  return OPENS_THE_GM_PAGE.test(text) ? ['kingdoms-call-gm-portal.html'] : [];
}

/** The test and tool files `file` imports or requires by a relative path (with or without its extension). */
function localImportsOf(file: string, text: string, files: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?:\brequire\(\s*|\bfrom\s+|\bimport\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1] ?? ''));
    const found = ['', '.js', '.ts', '.mjs', '.cjs'].map((ext) => target + ext).find((f) => files.has(f));
    if (found) out.push(found);
  }
  return out;
}

/** The pages each test and tool file reaches: those it opens itself, and for a helper that opens none, those the files
 *  importing it open (a browser spec's helper is handed the spec's page). */
export function pagesReachedByFile(texts: ReadonlyMap<string, string>): Map<string, ScriptPage[]> {
  const files = new Set(texts.keys());
  const importers = new Map<string, string[]>();
  for (const [file, text] of texts)
    for (const imported of localImportsOf(file, text, files))
      importers.set(imported, [...(importers.get(imported) ?? []), file]);
  const out = new Map<string, ScriptPage[]>();
  const reached = (file: string, seen: Set<string>): ScriptPage[] => {
    const own = pagesOpenedBy(texts.get(file) ?? '');
    if (own.length || seen.has(file)) return own;
    seen.add(file);
    return [...new Set((importers.get(file) ?? []).flatMap((f) => reached(f, seen)))];
  };
  for (const file of files) out.set(file, reached(file, new Set()));
  return out;
}

/** How a name reached in a screen tour's code is noted: TOUR and the tour's page. */
export const TOUR = 'tour of ';

/** The page of the screen tour (`{page: '<page>.html', …}` in tests/lib/screens.js) that `node` is inside, or null. */
function tourPageOf(node: ts.Node): ScriptPage | null {
  for (let n: ts.Node = node.parent; !ts.isSourceFile(n); n = n.parent)
    if (ts.isObjectLiteralExpression(n))
      for (const prop of n.properties)
        if (
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === 'page' &&
          ts.isStringLiteralLike(prop.initializer)
        ) {
          const page = prop.initializer.text;
          if (page in SCRIPT_PAGES) return page as ScriptPage;
        }
  return null;
}

/** A `+` expression. */
const isPlus = (n: ts.Node): n is ts.BinaryExpression =>
  ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken;
/** The pieces of a `+` chain, in order (`a + b + c` is `(a + b) + c`). */
const plusPieces = (n: ts.Expression): ts.Expression[] => (isPlus(n) ? [...plusPieces(n.left), n.right] : [n]);

/** Each name a file's code reaches on a page, with how ("eval", "W.", "tour of <page>", …). */
export interface FileReach {
  reads: Map<string, Set<string>>;
  writes: Map<string, Set<string>>;
  /** Calls whose code couldn't be read (a variable built elsewhere): reported, not guessed. */
  unread: string[];
}

/** What one test file's code reaches on a page (whichever page: pagesOpenedBy says which it opens). */
export function reachOfTestFile(file: string, text: string): FileReach {
  const tree = treeOf(file, text, kindOf(file));
  const result: FileReach = { reads: new Map(), writes: new Map(), unread: [] };
  const add = (into: Map<string, Set<string>>, name: string, how: string) => {
    into.set(name, (into.get(name) ?? new Set()).add(how));
  };
  const addReach = (reach: Reach | null, how: string) => {
    if (!reach) return;
    for (const n of reach.reads) add(result.reads, n, how);
    for (const n of reach.writes) add(result.writes, n, how);
  };
  // The file's own constants and its one-parameter wrappers of an evaluating call.
  const constants = new Map<string, ts.Expression>();
  const initializers = new Map<string, string>();
  const wrappers = new Set<string>();
  const collect = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      constants.set(n.name.text, n.initializer);
      initializers.set(n.name.text, n.initializer.getText(tree));
    }
    ts.forEachChild(n, collect);
  };
  collect(tree);
  const isVm = (e: ts.Expression): boolean => {
    if (!ts.isIdentifier(e)) return false;
    const seen = new Set<string>();
    let name: string | undefined = e.text;
    while (name && !seen.has(name)) {
      seen.add(name);
      const init = initializers.get(name);
      if (init === undefined) return false;
      if (THE_VM.test(init)) return true;
      name = /^(\w+)\.\w+$/.exec(init)?.[1]; // const W = sc.W: what sc is
    }
    return false;
  };
  const isPageWindow = (e: ts.Expression): boolean =>
    (ts.isIdentifier(e) && LIKE_A_WINDOW.test(e.text) && !isVm(e)) ||
    (ts.isPropertyAccessExpression(e) && e.name.text === 'window');
  const codeOf = (a: ts.Expression | undefined, depth = 0): [string, ts.ScriptKind] | null => {
    if (!a || depth > 4) return null;
    if (ts.isStringLiteralLike(a)) return [a.text, ts.ScriptKind.JS];
    if (ts.isTemplateExpression(a)) return [templateText(a), ts.ScriptKind.JS];
    if (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) return [`(${a.getText(tree)})`, kindOf(file)];
    if (ts.isParenthesizedExpression(a)) return codeOf(a.expression, depth + 1);
    if (ts.isIdentifier(a)) return codeOf(constants.get(a.text), depth + 1);
    if (isPlus(a)) return [joinPieces(plusPieces(a).map((p) => codeOf(p, depth + 1)?.[0] ?? null)), ts.ScriptKind.JS];
    return null;
  };
  /** The name an evaluating call's enclosing one-parameter function is bound to, if it hands that parameter on. */
  const wrapperName = (call: ts.CallExpression): string | null => {
    const arg = call.arguments[0];
    if (!arg || !ts.isIdentifier(arg)) return null;
    for (let n: ts.Node = call.parent; !ts.isSourceFile(n); n = n.parent) {
      if (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n)) {
        const [param] = n.parameters;
        if (!param || !ts.isIdentifier(param.name) || param.name.text !== arg.text) return null;
        if (ts.isFunctionDeclaration(n)) return n.name?.text ?? null;
        const p = n.parent;
        if ((ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p)) && ts.isIdentifier(p.name)) return p.name.text;
        return null;
      }
    }
    return null;
  };
  const evaluating = (n: ts.Node): n is ts.CallExpression & { expression: ts.PropertyAccessExpression } =>
    ts.isCallExpression(n) &&
    ts.isPropertyAccessExpression(n.expression) &&
    EVALUATES.has(n.expression.name.text) &&
    !(ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'vm') &&
    !isVm(n.expression.expression);
  const findWrappers = (n: ts.Node): void => {
    if (evaluating(n) && !codeOf(n.arguments[0])) {
      const name = wrapperName(n);
      if (name) wrappers.add(name);
      else result.unread.push(n.getText(tree).slice(0, 80));
    }
    ts.forEachChild(n, findWrappers);
  };
  findWrappers(tree);
  const everyString = CODE_IN_EVERY_STRING.has(file);
  const visit = (n: ts.Node): void => {
    if (evaluating(n)) {
      const code = codeOf(n.arguments[0]);
      if (code) addReach(reachOf(...code), 'eval');
    }
    if (ts.isCallExpression(n) && wrappers.size) {
      const callee = n.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : '';
      if (wrappers.has(name)) {
        const code = codeOf(n.arguments[0]);
        if (code) addReach(reachOf(...code), 'eval');
      }
    }
    // In the tours, every string, and every whole `+` chain of them (a step's code is often joined from pieces that
    // don't parse on their own).
    const wholeChain = isPlus(n) && !(isPlus(n.parent) && n.parent.left === n);
    if (everyString && (ts.isStringLiteralLike(n) || ts.isTemplateExpression(n) || wholeChain)) {
      const code = codeOf(n);
      if (code && doesSomething(code[0])) addReach(reachOf(...code), `${TOUR}${tourPageOf(n) ?? ''}`);
    }
    if (ts.isPropertyAccessExpression(n) && isPageWindow(n.expression)) {
      add(result.reads, n.name.text, 'W.');
      if (isAssigned(n)) add(result.writes, n.name.text, 'W.');
    }
    if (ts.isElementAccessExpression(n) && isPageWindow(n.expression) && ts.isStringLiteralLike(n.argumentExpression)) {
      add(result.reads, n.argumentExpression.text, "W['']");
      if (isAssigned(n)) add(result.writes, n.argumentExpression.text, "W['']");
    }
    ts.forEachChild(n, visit);
  };
  visit(tree);
  return result;
}

/** Whether a name reached in these ways is reached on `page`: a name reached only in screen tours, only on theirs. */
const onThisPage = (how: ReadonlySet<string>, page: ScriptPage): boolean =>
  ![...how].every((h) => h.startsWith(TOUR)) || how.has(TOUR + page);

/** For one page: each of its names the tests read (or write) on it → the files that do, with how. */
export interface PageReach {
  reads: Map<string, string[]>;
  writes: Map<string, string[]>;
}

/** What the tests and tools reach on each page: the names of the page's module files that a file opening the page
 *  reads or writes there. Also the calls whose code couldn't be read, by file. */
export function namesTestsReachOnPages(
  root = ROOT,
  src = SRC,
): { pages: Record<ScriptPage, PageReach>; unread: Record<string, string[]> } {
  const declarations = Object.fromEntries(SCRIPT_PAGE_NAMES.map((p) => [p, pageDeclarations(p, src)])) as Record<
    ScriptPage,
    Map<string, Declaration>
  >;
  const pages = Object.fromEntries(
    SCRIPT_PAGE_NAMES.map((p) => [p, { reads: new Map(), writes: new Map() }]),
  ) as Record<ScriptPage, PageReach>;
  const unread: Record<string, string[]> = {};
  const texts = new Map(testAndToolFiles(root).map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]));
  const pagesOf = pagesReachedByFile(texts);
  for (const [file, text] of texts) {
    const opened = pagesOf.get(file) ?? [];
    if (!opened.length) continue;
    const reach = reachOfTestFile(file, text);
    if (reach.unread.length) unread[file] = reach.unread;
    for (const page of opened)
      for (const [kind, names] of [
        ['reads', reach.reads],
        ['writes', reach.writes],
      ] as const)
        for (const [name, how] of names)
          if (declarations[page].has(name) && onThisPage(how, page)) {
            const into = pages[page][kind];
            into.set(name, [...(into.get(name) ?? []), `${file} (${[...how].join(', ')})`]);
          }
  }
  return { pages, unread };
}

/** One name on a globals.ts list, and the file its comment names. */
export interface ListedName {
  name: string;
  /** The file named in the comment after it (`// ui/gm/turn-shell.ts`), or '' if none. */
  file: string;
}

/** The page's globals.ts: its two Object.assign(window, { … }) lists, in order, handlers first. Throws if the file isn't
 *  two such statements (and the imports of the names they list, and comments) and nothing else. */
export function globalsLists(page: ScriptPage, src = SRC): { handlers: ListedName[]; tests: ListedName[] } {
  const file = globalsFileOf(page);
  const text = fs.readFileSync(path.join(src, file), 'utf8');
  const tree = treeOf(file, text, ts.ScriptKind.JS);
  if (parseErrors(tree)) throw new Error(`${file}: does not parse`);
  const lists = tree.statements
    .filter((s) => !ts.isImportDeclaration(s))
    .map((s) => {
      const call = ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) ? s.expression : null;
      const [target, names] = call?.arguments ?? [];
      if (
        !call ||
        call.getText(tree).slice(0, 'Object.assign('.length) !== 'Object.assign(' ||
        call.arguments.length !== 2 ||
        !target ||
        !ts.isIdentifier(target) ||
        target.text !== 'window' ||
        !names ||
        !ts.isObjectLiteralExpression(names)
      )
        throw new Error(
          `${file}: a statement that isn't Object.assign(window, { … }): ${s.getText(tree).slice(0, 60)}`,
        );
      return names.properties.map((prop): ListedName => {
        if (!ts.isShorthandPropertyAssignment(prop))
          throw new Error(`${file}: ${prop.getText(tree)}: each entry is a bare name`);
        const after = text.slice(prop.end).match(/^,?[ \t]*\/\/[ \t]*(\S+)/);
        return { name: prop.name.text, file: after?.[1] ?? '' };
      });
    });
  if (lists.length !== 2) throw new Error(`${file}: ${String(lists.length)} lists, not two`);
  return { handlers: lists[0] ?? [], tests: lists[1] ?? [] };
}
