// npm run ratchet: the harness can only get stronger. Counts what weakens it (switched-off checks, allowlist
// entries, JavaScript not yet TypeScript (the tests' and tools', and the site's in src/, apart), quarantined tests,
// tests on the hand-written database stand-in, tests on the engine's vm loader, the engine's checks of a unit by its
// type's name, ESLint's suppressed findings, the import rules' known violations and what knip finds unused) and fails if
// any count is above its baseline in tests/ratchet.json. When a count falls, it says so: lower the baseline in the
// same PR (npm run ratchet -- --update only ever lowers it). tests/static/harness.test.ts runs the same comparison,
// so npm test and CI fail too.
//
// It counts the files git knows, plus new ones not yet added (not git-ignored ones, nor local folders such as plan/).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { z } from 'zod';
import { KC_UNIT_TYPE } from '../src/content/kingdoms-call-data.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
export const BASELINE_FILE = path.join(ROOT, 'tests', 'ratchet.json');

export type Counts = Record<string, number>;

// Lists of reviewed exceptions: each entry lets something through that a check would otherwise refuse. The one today
// is kc/html-is-built-only-through-kc-html's option, in eslint.config.js (plan P1-13, Decision 8).
export const ALLOWLISTS = [{ file: 'eslint.config.js', name: 'HTML_EXCEPTIONS' }];

const CODE = /\.(ts|mts|cts|js|mjs|cjs|html)$/;
// Built from parts, so this file doesn't count itself.
const NOCHECK = new RegExp('@ts-' + 'nocheck');
const TS_IGNORE = new RegExp('@ts-' + '(ignore|expect-error)');
const ESLINT_DISABLE = new RegExp('eslint-' + 'disable');
const STUB_DB = /['"][^'"]*\/stub-db(\.js)?['"]/;

function files(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT });
  return [...new Set(out.toString().split('\0').filter(Boolean))]
    .filter((f) => fs.existsSync(path.join(ROOT, f)))
    .sort();
}

const lines = (text: string, re: RegExp) => text.split('\n').filter((l) => re.test(l)).length;

// The ts-nocheck line is counted in two (plan P1-10, Decision 9; P1-10b's Decision 5), so that the engine's side can
// reach 0 (P1-10b) before the UI's (P1-16): tsNocheckEngineSide, the files of the folders below, which the engine runs
// on or the player portal shares; tsNocheckUi, every other file (src/ui/'s pages, src/rulebook/, tests/, tools/).
export const ENGINE_SIDE_FOLDERS = [
  'src/engine/',
  'src/views/',
  'src/db/',
  'src/ui/shared/',
  'src/content/',
  'src/schemas/',
  'src/shared/',
] as const;
const onTheEngineSide = (file: string) => ENGINE_SIDE_FOLDERS.some((folder) => file.startsWith(folder));

/** The counts read from the code files' text (the ts-nocheck lines in their two counts, the other switch-offs, and the
 *  tests on the database stand-in), for the files given as [path from the repository's root, text]. */
export function countsFromTheCodeFiles(codeFiles: readonly (readonly [file: string, text: string])[]): Counts {
  const counts = { tsNocheckEngineSide: 0, tsNocheckUi: 0, tsIgnore: 0, eslintDisable: 0, stubDbTests: 0 };
  for (const [f, text] of codeFiles) {
    if (!CODE.test(f)) continue;
    if (onTheEngineSide(f)) counts.tsNocheckEngineSide += lines(text, NOCHECK);
    else counts.tsNocheckUi += lines(text, NOCHECK);
    counts.tsIgnore += lines(text, TS_IGNORE);
    counts.eslintDisable += lines(text, ESLINT_DISABLE);
    if (f.startsWith('tests/') && !f.startsWith('tests/lib/stub-db.') && STUB_DB.test(text)) counts.stubDbTests++;
  }
  return counts;
}

/** The code files git knows, each with its text, as countsFromTheCodeFiles reads them. */
export function theCodeFiles(all = files()): [file: string, text: string][] {
  return all.filter((f) => CODE.test(f)).map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
}

// The engine's loader (plan P1-09, Decision 11): the engine's bundle run in a vm. P1-14 moves its tests to importing
// the engine's modules directly, so the number of test files that reach it, themselves or through a helper of
// tests/, only falls.
const ENGINE_LOADER = 'tests/lib/engine.ts';
/** The test files (tests/**\/*.test.{js,ts}, not the quarantine) whose relative imports and requires reach the
 *  engine's loader. */
export function vmLoaderTests(all: string[]): number {
  const known = new Set(all);
  const importsOf = (f: string): string[] =>
    [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/(?:\bfrom\s+|\brequire\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)]
      .map((m) => path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1] ?? '')))
      .flatMap((t) =>
        ['', '.ts', '.js']
          .map((x) => t + x)
          .filter((x) => known.has(x))
          .slice(0, 1),
      );
  const memo = new Map<string, boolean>();
  const reaches = (f: string, seen: Set<string>): boolean => {
    const kept = memo.get(f);
    if (kept !== undefined) return kept;
    if (seen.has(f)) return false;
    seen.add(f);
    const r = importsOf(f).some((g) => g === ENGINE_LOADER || reaches(g, seen));
    memo.set(f, r);
    return r;
  };
  return all.filter((f) => /^tests\/(?!quarantine\/).*\.test\.[jt]s$/.test(f) && reaches(f, new Set())).length;
}

// The engine's checks of a unit by its type's name (plan P1-19, Decision 7): a string naming a unit type of
// KC_UNIT_TYPE that the code compares (===, !==, ==, !=, a case), looks up by (a table's ['…']) or passes to has,
// get, includes or indexOf, counted by syntax tree in the files of src/engine/ outside src/engine/rules/. The rule
// registry takes them out family by family (an effect asks its content row, by slug), so the count only falls.
// tests/static/the-resolvers-the-registry-has-taken-name-no-unit-type.test.ts counts the functions the registry has
// taken, with unitNameChecksByFunction, at 0 each.
const UNIT_TYPE_NAMES: ReadonlySet<string> = new Set(Object.keys(KC_UNIT_TYPE));
const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);
const LOOKUPS = new Set(['has', 'get', 'includes', 'indexOf']);
/** Whether a string literal is a check of a unit by its type's name (above). */
function isAUnitNameCheck(node: ts.StringLiteral): boolean {
  if (!UNIT_TYPE_NAMES.has(node.text)) return false;
  const p = node.parent;
  return (
    (ts.isBinaryExpression(p) && COMPARISONS.has(p.operatorToken.kind)) ||
    ts.isCaseClause(p) ||
    (ts.isElementAccessExpression(p) && p.argumentExpression === node) ||
    (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && LOOKUPS.has(p.expression.name.text))
  );
}
/** The name a function is declared by (a function or a method, or a variable an arrow or a function is given to). */
function nameOfAFunction(node: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText();
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  )
    return node.name.text;
  return null;
}
/** Each function of a file, by its name, with the unit-name checks in it (0 for a function with none); a check
 *  inside a nested function that has no name counts for the named one around it, and one outside any function for
 *  '(top)'. */
export function unitNameChecksByFunction(file: string, text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: ts.Node, inside: string): void => {
    const named = nameOfAFunction(node);
    if (named) counts.set(named, counts.get(named) ?? 0);
    const fn = named ?? inside;
    if (ts.isStringLiteral(node) && isAUnitNameCheck(node)) counts.set(fn, (counts.get(fn) ?? 0) + 1);
    ts.forEachChild(node, (child) => {
      visit(child, fn);
    });
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), '(top)');
  return counts;
}
/** The files whose unit-name checks unitNameChecksInEngine counts. */
export const countsUnitNameChecks = (file: string): boolean =>
  file.startsWith('src/engine/') && !file.startsWith('src/engine/rules/') && file.endsWith('.ts');
/** The unit-name checks in the files of src/engine/ outside src/engine/rules/, for the files given as [path from the
 *  repository's root, text]. */
export function unitNameChecksInEngine(codeFiles: readonly (readonly [file: string, text: string])[]): number {
  let n = 0;
  for (const [file, text] of codeFiles) {
    if (!countsUnitNameChecks(file)) continue;
    for (const count of unitNameChecksByFunction(file, text).values()) n += count;
  }
  return n;
}

// The number of entries in the array (or new Set([...])) a top-level `const <name> =` holds.
export function allowlistLength(file: string, name: string): number {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const d of statement.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== name || !d.initializer) continue;
      let init = d.initializer;
      if (ts.isNewExpression(init) && init.arguments?.[0]) init = init.arguments[0];
      if (ts.isArrayLiteralExpression(init)) return init.elements.length;
    }
  }
  throw new Error(`${file}: no "const ${name} = [...]" found. The ratchet counts its entries: update ALLOWLISTS.`);
}

// ESLint's suppressed findings (plan P1-13, Decisions 4 and 13): every rule is an error (eslint.config.js), and what
// the rules found when they came in is listed in ESLint's bulk suppressions, per file and rule with a count, which the
// command line reads (a new finding fails; a suppressed one that no longer occurs fails until it is pruned). Counted
// here, the sum of the counts, so the list only shrinks (the one rise allowed is plan P1-13's Decision 5: a file freed
// from the type check's switch-off may add its own typed findings, listed in its PR).
export const ESLINT_SUPPRESSIONS_FILE = 'eslint-suppressions.json';
// ESLint's own format: file, then rule, then how many of that rule's findings the file may hold.
const Suppressions = z.record(z.string(), z.record(z.string(), z.strictObject({ count: z.int().positive() })));
export function eslintSuppressions(): number {
  const list = Suppressions.parse(JSON.parse(fs.readFileSync(path.join(ROOT, ESLINT_SUPPRESSIONS_FILE), 'utf8')));
  return Object.values(list)
    .flatMap((rules) => Object.values(rules))
    .reduce((n, entry) => n + entry.count, 0);
}

// The import rules' known violations (plan P1-13, Decision 4): what broke a rule of .dependency-cruiser.cjs when it came
// in, listed in this file and let through by npm run lint:arch (--ignore-known). Counted here, so the list only shrinks;
// a finding fixed leaves it in the same PR (tests/static/the-architecture-rules-refuse-planted-imports-cycles-and-
// unused-code.test.ts fails on an entry that no longer occurs).
export const KNOWN_ARCHITECTURE_VIOLATIONS_FILE = '.dependency-cruiser-known-violations.json';
export function knownArchitectureViolations(): number {
  const list: unknown = JSON.parse(fs.readFileSync(path.join(ROOT, KNOWN_ARCHITECTURE_VIOLATIONS_FILE), 'utf8'));
  if (!Array.isArray(list)) throw new Error(`${KNOWN_ARCHITECTURE_VIOLATIONS_FILE} is not a list of violations.`);
  return list.length;
}

// What knip finds (plan P1-13, Decision 4; knip.ts): unused files, exports, types and dependencies, and the rest of its
// kinds. knip keeps no list of known findings, so their number is counted here and only falls. It runs in a child
// process (its API is asynchronous; this count isn't) and exits 1 when it finds anything: its report is still on stdout.
export function unusedCode(root = ROOT): number {
  const bin = path.join(ROOT, 'node_modules', '.bin', 'knip');
  let out: string;
  try {
    out = execFileSync(bin, ['--reporter', 'json', '--no-progress'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    const stdout = (e as { stdout?: unknown }).stdout;
    if (typeof stdout !== 'string' || !stdout.startsWith('{')) throw e;
    out = stdout;
  }
  const report = JSON.parse(out) as { issues: Record<string, unknown>[] };
  let n = 0;
  for (const issue of report.issues) {
    for (const found of Object.values(issue)) if (Array.isArray(found)) n += found.length;
  }
  return n;
}

export function measure(): Counts {
  const all = files();
  const codeFiles = theCodeFiles(all);
  return {
    ...countsFromTheCodeFiles(codeFiles),
    allowlistEntries: ALLOWLISTS.reduce((n, a) => n + allowlistLength(a.file, a.name), 0),
    javascriptFiles: all.filter((f) => /\.(js|mjs|cjs)$/.test(f) && !/^(src|public)\//.test(f)).length,
    // The site's own code, inline in its pages until P1-05 split it into src/ (so it wasn't counted before then). Since
    // P1-09e src/ is all TypeScript, so what is left is public/'s two classic scripts, copied as they are (kc-config.js,
    // which staging overwrites, and the staging footer: P1-09d moved them from src/), counted so that no other joins
    // them. The supabase-js copy in public/vendor/ (src/vendor/ until P1-09d) isn't the site's code.
    sourceJavascriptFiles: all.filter(
      (f) => /\.js$/.test(f) && /^(src|public)\//.test(f) && !/^(src|public)\/vendor\//.test(f),
    ).length,
    quarantinedTests: all.filter((f) => f.startsWith('tests/quarantine/') && /\.test\.[jt]s$/.test(f)).length,
    vmLoaderTests: vmLoaderTests(all),
    unitNameChecksInEngine: unitNameChecksInEngine(codeFiles),
    eslintSuppressions: eslintSuppressions(),
    knownArchitectureViolations: knownArchitectureViolations(),
    unusedCode: unusedCode(),
  };
}

export function readBaseline(): Counts {
  const json = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as { counts: Counts };
  return json.counts;
}

// What rose (fails), what fell (lower the baseline), and any count the baseline lacks (fails: add it).
export function compare(baseline: Counts, now: Counts): { rose: string[]; fell: string[] } {
  const rose: string[] = [];
  const fell: string[] = [];
  for (const [key, n] of Object.entries(now)) {
    const was = baseline[key];
    if (was === undefined) rose.push(`${key}: ${String(n)}, but tests/ratchet.json has no baseline for it. Add it.`);
    else if (n > was)
      rose.push(
        `${key} rose from ${String(was)} to ${String(n)}. Take the new one out rather than raise the baseline.`,
      );
    else if (n < was) fell.push(`${key} fell from ${String(was)} to ${String(n)}.`);
  }
  for (const key of Object.keys(baseline)) {
    if (!(key in now)) rose.push(`${key} is in tests/ratchet.json but no longer counted (tools/ratchet.ts).`);
  }
  return { rose, fell };
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  const baseline = readBaseline();
  const now = measure();
  const { rose, fell } = compare(baseline, now);
  for (const [key, n] of Object.entries(now)) console.log(`${key}: ${String(n)} (baseline ${String(baseline[key])})`);
  if (fell.length && process.argv.includes('--update')) {
    const lowered = Object.fromEntries(Object.entries(baseline).map(([k, v]) => [k, Math.min(v, now[k] ?? v)]));
    const json = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Record<string, unknown>;
    fs.writeFileSync(BASELINE_FILE, JSON.stringify({ ...json, counts: lowered }, null, 2) + '\n');
    console.log('\nLowered tests/ratchet.json: commit it with this change.');
  } else if (fell.length) {
    console.log(`\n${fell.join('\n')}\nGood: lower the baseline in this PR with  npm run ratchet -- --update`);
  }
  if (rose.length) {
    console.log(`\nThe ratchet failed:\n${rose.join('\n')}`);
    process.exitCode = 1;
  }
}
