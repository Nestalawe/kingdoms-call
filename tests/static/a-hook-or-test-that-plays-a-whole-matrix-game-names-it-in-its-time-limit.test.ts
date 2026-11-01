// A hook or test that plays a whole game of the balance matrix names that work in its time limit:
// timeLimitForTheWork({ matrixGamesPlayed: N }) (tests/lib/time-limits.ts). Vitest gives a hook 10 s and a test 5 s;
// a whole game takes up to 10.1 s on a runner (bots-32 with its reports: it failed #351 at the hook's 10 s), so a game
// played under the default limit fails on a slow runner, not on a fault.
// What plays a whole game: a `for` loop over the turns up to MAX_TURNS (tools/balance/matrix.ts), or a call of, or a
// reference to, a function that does, followed through the file's own functions and its named imports from tests/ and
// tools/balance/ (tests/lib/player-portal-copies.ts's scripted05, passed by name to `quietly`, is found so).
// What it can't see: a game played in another process (the balance matrix's workers, a test script run by
// tests/legacy.test.ts, which gives each script its own limit); a loop over the turns bounded by anything but
// MAX_TURNS; a function reached through a value (an object's method, a callback handed in from another file) or a
// re-export; and a game played at a file's top level as it loads, outside any hook or test (Vitest sets no limit
// there). It over-counts rather than under: a function that only defines a callback that would play counts as playing.
// Level 0 (static): the test files read by their syntax tree, not run; a run shows only the games that came near the
// limit on that machine, and a test file that isn't run (a project not in the job) shows nothing.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

/** Every TypeScript file a test can reach a game through: tests/ but its fixtures, quarantine and saves, and
 *  tools/balance/. By name from the repository's root, with its text. */
function theFiles(): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const name = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (!['fixtures', 'quarantine', 'node_modules'].includes(e.name)) walk(name);
      } else if (/\.m?ts$/.test(e.name) && !e.name.endsWith('.d.ts')) {
        files.set(name, fs.readFileSync(path.join(ROOT, name), 'utf8'));
      }
    }
  };
  walk('tests');
  walk('tools/balance');
  return files;
}

const HOOKS = new Set(['beforeAll', 'beforeEach', 'afterAll', 'afterEach']);
const TESTS = new Set(['test', 'it']);

/** A `for` loop over the turns up to MAX_TURNS: a whole game. */
const loopsOverTheTurns = (n: ts.Node): boolean =>
  ts.isForStatement(n) && n.condition !== undefined && /\bMAX_TURNS\b/.test(n.condition.getText());

const isAFunction = (n: ts.Node): n is ts.ArrowFunction | ts.FunctionExpression =>
  ts.isArrowFunction(n) || ts.isFunctionExpression(n);

/** A hook or a test that plays a whole game, where it is, and whether its limit names the games. */
export interface APlay {
  where: string;
  limited: boolean;
}

/** The hooks and tests in `files`' test files (`*.test.ts`) that play a whole game of the matrix. */
export function theHooksAndTestsThatPlayAGame(files: Map<string, string>): APlay[] {
  const trees = new Map<string, ts.SourceFile>();
  const tree = (file: string): ts.SourceFile | undefined => {
    const text = files.get(file);
    if (text === undefined) return undefined;
    let sf = trees.get(file);
    if (!sf) {
      sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      trees.set(file, sf);
    }
    return sf;
  };

  // A file's top-level functions (a function, or a const set to one or to a call handed one, as `lazily(() => …)`),
  // and its named imports from another file of `files`.
  const scopes = new Map<string, { defs: Map<string, ts.Node>; imports: Map<string, [string, string]> }>();
  const scopeOf = (file: string) => {
    let scope = scopes.get(file);
    if (scope) return scope;
    scope = { defs: new Map(), imports: new Map() };
    scopes.set(file, scope);
    const sf = tree(file);
    for (const st of sf?.statements ?? []) {
      if (ts.isFunctionDeclaration(st) && st.name) scope.defs.set(st.name.text, st);
      if (ts.isVariableStatement(st))
        for (const d of st.declarationList.declarations) {
          const init = d.initializer;
          if (!ts.isIdentifier(d.name) || !init) continue;
          if (isAFunction(init) || (ts.isCallExpression(init) && init.arguments.some(isAFunction)))
            scope.defs.set(d.name.text, init);
        }
      if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
        const from = path.posix.normalize(path.posix.join(path.posix.dirname(file), st.moduleSpecifier.text));
        const bindings = st.importClause?.namedBindings;
        if (!files.has(from) || !bindings || !ts.isNamedImports(bindings)) continue;
        for (const el of bindings.elements) scope.imports.set(el.name.text, [from, (el.propertyName ?? el.name).text]);
      }
    }
    return scope;
  };

  // Whether `node`, in `file`, plays a whole game: it loops over the turns, or names a function that does.
  const known = new Map<string, boolean>();
  const plays = (file: string, node: ts.Node): boolean => {
    let found = false;
    const visit = (n: ts.Node): void => {
      if (found) return;
      if (loopsOverTheTurns(n)) found = true;
      else if (ts.isIdentifier(n) && namesAValue(n) && playsByName(file, n.text)) found = true;
      else ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  };
  const playsByName = (file: string, name: string): boolean => {
    const { defs, imports } = scopeOf(file);
    const imported = imports.get(name);
    const [at, as] = defs.has(name) ? [file, name] : (imported ?? [file, name]);
    const key = `${at}#${as}`;
    const kept = known.get(key);
    if (kept !== undefined) return kept;
    const def = scopeOf(at).defs.get(as);
    if (!def) return false;
    known.set(key, false); // while it is read: a function that names itself doesn't play for it
    const result = plays(at, def);
    known.set(key, result);
    return result;
  };

  const found: APlay[] = [];
  for (const file of [...files.keys()].filter((f) => f.endsWith('.test.ts')).sort()) {
    const sf = tree(file);
    if (!sf) continue;
    const visit = (n: ts.Node): void => {
      ts.forEachChild(n, visit);
      if (!ts.isCallExpression(n)) return;
      const kind = hookOrTest(n.expression);
      if (!kind) return;
      const args = [...n.arguments];
      const body = HOOKS.has(kind) ? args[0] : args.find(isAFunction);
      if (!body || !plays(file, body)) return;
      const limits = args.filter((a) => a !== body && !(TESTS.has(kind) && a === args[0]));
      const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      const name = TESTS.has(kind) && args[0] && ts.isStringLiteralLike(args[0]) ? ` "${args[0].text}"` : '';
      found.push({ where: `${file}:${String(line)} ${kind}${name}`, limited: limits.some(namesTheGames) });
    };
    visit(sf);
  }
  return found;
}

/** `test`, `it` or a hook, as called: `test(…)`, `test.skip(…)`, `test.for(…)(…)`. */
function hookOrTest(callee: ts.Expression): string | undefined {
  if (ts.isIdentifier(callee)) return HOOKS.has(callee.text) || TESTS.has(callee.text) ? callee.text : undefined;
  if (ts.isPropertyAccessExpression(callee)) return hookOrTest(callee.expression);
  if (ts.isCallExpression(callee)) return hookOrTest(callee.expression);
  return undefined;
}

/** An identifier that names a value, not a property or a declaration. */
function namesAValue(n: ts.Identifier): boolean {
  const p = n.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === n) return false;
  if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p)) && p.name === n)
    return false;
  if ((ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isParameter(p)) && p.name === n) return false;
  return !ts.isImportSpecifier(p);
}

/** A time limit made by timeLimitForTheWork that names `matrixGamesPlayed`. */
function namesTheGames(limit: ts.Node): boolean {
  let named = false;
  const visit = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === 'timeLimitForTheWork' &&
      n.arguments.some(
        (a) =>
          ts.isObjectLiteralExpression(a) &&
          a.properties.some((p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'matrixGamesPlayed'),
      )
    )
      named = true;
    else ts.forEachChild(n, visit);
  };
  visit(limit);
  return named;
}

const READS = timeLimitForTheWork({ everyFileReads: 1 });

describe('a hook or test that plays a whole game of the matrix names it in its time limit', () => {
  const files = theFiles();
  const found = theHooksAndTestsThatPlayAGame(files);

  test('every one names it', READS, () => {
    expect(found.filter((p) => !p.limited).map((p) => p.where)).toEqual([]);
  });

  // So the check can't pass by finding none: the hooks known to play a whole game are among those it finds.
  test('it finds the reports, the player portal and the engine-purity games', READS, () => {
    const files = found.map((p) => p.where.replace(/:\d+ .*/, ''));
    expect(files).toEqual(
      expect.arrayContaining([
        'tests/unit/the-reports-are-built-on-a-world-that-cannot-be-written.test.ts',
        'tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts',
        'tests/unit/engine-purity.test.ts',
      ]),
    );
  });

  // Planted copies: a test file in tests/unit/ that plays scripted05 through an import from tests/lib/ (which hands
  // it by name to `quietly`), first with no limit, then with another work's, then with the games named.
  const PLANTED = 'tests/unit/planted.test.ts';
  const plant = (limit: string) =>
    new Map([
      ...files,
      [
        PLANTED,
        "import { beforeAll, test } from 'vitest';\n" +
          "import { theGamePlayed } from '../lib/player-portal-copies.ts';\n" +
          "import { timeLimitForTheWork } from '../lib/time-limits.ts';\n" +
          `beforeAll(() => { theGamePlayed(); }${limit});\n` +
          "test('planted', () => undefined);\n",
      ],
    ]);
  test.for([
    ['no limit', '', false],
    ["another work's limit", ', timeLimitForTheWork({ toolRuns: 1 }).timeout', false],
    ['the games named', ', timeLimitForTheWork({ matrixGamesPlayed: 1 }).timeout', true],
  ] as const)('planted: a hook that plays scripted05 through tests/lib/, with %s', READS, ([, limit, limited]) => {
    const planted = theHooksAndTestsThatPlayAGame(plant(limit)).filter((p) => p.where.startsWith(PLANTED));
    expect(planted).toEqual([{ where: `${PLANTED}:4 beforeAll`, limited }]);
  });

  test("planted: the reports test's hook without its limit", READS, () => {
    const file = 'tests/unit/the-reports-are-built-on-a-world-that-cannot-be-written.test.ts';
    const text = files.get(file) ?? '';
    const without = text.replace(/,\s*timeLimitForTheWork\(\{ matrixGamesPlayed: 1 \}\)\.timeout/, '');
    expect(without).not.toBe(text);
    const planted = theHooksAndTestsThatPlayAGame(new Map([...files, [file, without]]));
    expect(planted.filter((p) => !p.limited).map((p) => p.where.replace(/:\d+/, ''))).toEqual([`${file} beforeAll`]);
  });
});
