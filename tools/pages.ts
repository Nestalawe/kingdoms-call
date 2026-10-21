// The site's pages and the files each is made of (plan P1-09d), read from src/ as Vite reads it: every src/*.html is a
// page; its <script type="module" src> and <link rel="stylesheet" href> tags name its entries; a module's static
// imports name the rest. For the tests and the balance runner, which need the answer at once (Vite's own build is
// asynchronous): tests/static/pages-build.test.ts checks that it names exactly the files Vite's build of each page holds.
//
//   pageNames(src)              the pages, by their published names ('kingdoms-call-gm-portal.html'), sorted
//   pageEntries(page, src)      the page's module entries and stylesheets, relative to src/
//   pageModules(page, src)      every module of the page, in the order they run (each file after the files it imports,
//                               in the order it imports them, from the page's entries)
//   pageFiles(page, src)        the page's template, its stylesheets and its modules: the files under src/ it is built
//                               from
//   importsOf(file, src)        the files a module imports for its code, in its order, relative to src/ (an `import type`
//                               or `export type … from` brings no code, so it isn't one)
//   engineEntryFiles(src)       the files of the engine (plan P1-18c): the data file, then the files under engine/ and
//                               views/ the GM portal's entry imports, in its order, then any other file there
//
// It imports nothing but Node's own modules and TypeScript (its parser reads a file's imports).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const SRC = path.join(ROOT, 'src');

/** The data file, the engine's tables (plan P1-09, Decision 4). */
export const DATA_FILE = 'content/kingdoms-call-data.ts';

/** The pages: every .html file at the top of src/ (Vite's convention: an entry at the root is a published page). */
export function pageNames(src = SRC): string[] {
  return fs
    .readdirSync(src)
    .filter((f) => f.endsWith('.html'))
    .sort();
}

/** The local paths a template's tags name with `attribute` (relative to src/), for tags matching `tag`. */
function tagsIn(template: string, tag: RegExp, attribute: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(new RegExp(tag.source, 'g'))) {
    const value = new RegExp(`\\b${attribute}="([^"]+)"`).exec(m[0])?.[1];
    if (value && !/^[a-z]+:|^\/\//i.test(value)) out.push(path.posix.normalize(value.replace(/^\.\//, '')));
  }
  return out;
}

/** The page's module entries (its `<script type="module" src>` tags) and its stylesheets (`<link rel="stylesheet">` to
 *  a file of the site), relative to src/. */
export function pageEntries(page: string, src = SRC): { modules: string[]; styles: string[] } {
  const template = fs.readFileSync(path.join(src, page), 'utf8');
  return {
    modules: tagsIn(template, /<script\b[^>]*\btype="module"[^>]*>/, 'src'),
    styles: tagsIn(template, /<link\b[^>]*\brel="stylesheet"[^>]*>/, 'href'),
  };
}

/** The files the module `file` imports for its code (static imports, re-exports and `import()`), in its order, relative
 *  to src/. A type-only import or re-export (`import type`, `export type … from`) is left out (plan P1-10a2): the build
 *  erases it, so no bundle holds the file for it (src/schemas/ is reached only so). `import { type X } from` is kept:
 *  with verbatimModuleSyntax the build leaves a bare import of the file. */
export function importsOf(file: string, src = SRC): string[] {
  const text = fs.readFileSync(path.join(src, file), 'utf8');
  return namesImportedForCode(text).map((name) =>
    path.posix.normalize(path.posix.join(path.posix.dirname(file), name)),
  );
}

/** The module names a file's text imports for its code, by the text: the parse is the slow part (the data file is
 *  15,000 lines), and the tests ask for the same files again and again. */
const namesByText = new Map<string, readonly string[]>();
function namesImportedForCode(text: string): readonly string[] {
  const known = namesByText.get(text);
  if (known) return known;
  const tree = ts.createSourceFile('module.ts', text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const named: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const typeOnly = ts.isImportDeclaration(node)
        ? node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword
        : node.isTypeOnly;
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !typeOnly)
        named.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [specifier] = node.arguments;
      if (specifier && ts.isStringLiteralLike(specifier)) named.push(specifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  namesByText.set(text, named);
  return named;
}

/** Every module of the page, in the order they run: depth first from each entry, each file after the files it imports,
 *  in the order it imports them, each once. */
export function pageModules(page: string, src = SRC): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const imported of importsOf(file, src)) visit(imported);
    order.push(file);
  };
  for (const entry of pageEntries(page, src).modules) visit(entry);
  return order;
}

/** The files under src/ the page is built from: its template, its stylesheets, its modules. */
export function pageFiles(page: string, src = SRC): string[] {
  return [page, ...pageEntries(page, src).styles, ...pageModules(page, src)];
}

/** The files under `dir` (relative to it, "/" between folders), sorted. */
function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

/** The GM portal's entry: the page that runs the turns, whose engine the tests load (tests/lib/engine.ts). */
export const GM_PAGE = 'kingdoms-call-gm-portal.html';

/** The GM portal's entry, which imports its files in the order they ran as classic scripts until P1-09d. */
export const GM_ENTRY = 'ui/gm/page.ts';

/** The engine's files (plan P1-18c, P1-09's Decision 11): the data file, then each file the GM portal's entry imports
 *  from engine/ or views/, in its order (the order the page ran them as classic scripts: engineFiles() of P1-05's
 *  manifest), then any other file under those two folders (none today: tests/static/pages-build.test.ts checks that
 *  every file under src/ is in a page). So what the files do as they load (the item tables built, then re-tiered)
 *  happens in the same order in the engine's bundle as on the page. */
export function engineEntryFiles(src = SRC): string[] {
  const isEngine = (f: string) => /^(engine|views)\//.test(f) && /\.[cm]?[jt]s$/.test(f);
  const fromPage = importsOf(GM_ENTRY, src).filter(isEngine);
  const rest = ['engine', 'views']
    .flatMap((dir) => filesUnder(path.join(src, dir)).map((f) => `${dir}/${f}`))
    .filter((f) => isEngine(f) && !fromPage.includes(f));
  return [DATA_FILE, ...fromPage, ...rest];
}
