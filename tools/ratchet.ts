// npm run ratchet: the harness can only get stronger. Counts what weakens it (switched-off checks, allowlist
// entries, JavaScript not yet TypeScript (the tests' and tools', and the site's in src/, apart), quarantined tests,
// tests on the hand-written database stand-in, tests on the engine's vm loader, ESLint's warnings on the site's code)
// and fails if
// any count is above its baseline in tests/ratchet.json. When a count falls, it says so: lower the baseline in the
// same PR (npm run ratchet -- --update only ever lowers it). tests/static/harness.test.ts runs the same comparison,
// so npm test and CI fail too.
//
// It counts the files git knows, plus new ones not yet added (not git-ignored ones, nor local folders such as plan/).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
export const BASELINE_FILE = path.join(ROOT, 'tests', 'ratchet.json');

export type Counts = Record<string, number>;

// Lists of exceptions inside test files: each entry lets something through that the test would otherwise refuse.
export const ALLOWLISTS = [{ file: 'tests/html-lint.test.js', name: 'ALLOWED' }];

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

// The site's lint warnings (plan P1-09, Decision 15): what ESLint's recommended rules and typescript-eslint's strict
// set found in src/ as it became TypeScript are warnings (eslint.config.js), counted here so they only fall. ESLint runs
// in a child process (its API is asynchronous; this count isn't), with its own cache.
export function eslintWarnings(): number {
  const bin = path.join(ROOT, 'node_modules', '.bin', 'eslint');
  const cache = path.join(ROOT, 'node_modules', '.cache', 'kc', 'eslint-ratchet');
  const args = ['--format', 'json', '--cache', '--cache-location', cache, 'src'];
  let out: string;
  try {
    out = execFileSync(bin, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    // ESLint exits 1 when it finds an error: its report is still on stdout (the lint step fails on the error itself).
    const stdout = (e as { stdout?: unknown }).stdout;
    if (typeof stdout !== 'string' || !stdout.startsWith('[')) throw e;
    out = stdout;
  }
  const results = JSON.parse(out) as { warningCount: number }[];
  return results.reduce((n, r) => n + r.warningCount, 0);
}

export function measure(): Counts {
  const all = files();
  const code = all.filter((f) => CODE.test(f));
  const counts = { tsNocheck: 0, tsIgnore: 0, eslintDisable: 0, stubDbTests: 0 };
  for (const f of code) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    counts.tsNocheck += lines(text, NOCHECK);
    counts.tsIgnore += lines(text, TS_IGNORE);
    counts.eslintDisable += lines(text, ESLINT_DISABLE);
    if (f.startsWith('tests/') && !f.startsWith('tests/lib/stub-db.') && STUB_DB.test(text)) counts.stubDbTests++;
  }
  return {
    ...counts,
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
    eslintWarnings: eslintWarnings(),
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
