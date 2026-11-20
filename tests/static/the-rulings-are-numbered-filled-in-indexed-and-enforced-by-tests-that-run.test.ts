// The rulings are numbered, filled in, indexed and enforced by tests that run: docs/rulings/ is where the maintainers'
// rulings live (CLAUDE.md says so), and it stays in step with itself. Moved from the old script tests/rulings.test.js
// (P1-14z), check for check.
// Level 0 (static): it reads files and nothing runs; a ruling's file has no code to call, so no lower level exists.
// - Files are R-NNN-short-name.md, numbered 1…N with no gaps or repeats, each titled "# R-NNN: …".
// - Each gives Decided (a date), Status (Confirmed, Decided, not built, To confirm or Superseded), Source and Enforced
//   by; a Superseded ruling names the ruling that replaced it.
// - A ruling is "Decided, not built" exactly when its Note says "not yet built": an answer becomes a ruling at once,
//   and the pull request that builds it sets "Confirmed" (docs/rulings/README.md, "Status").
// - Enforced by is "no test yet" or links, and every linked test exists and runs in npm test: a test script of
//   tests/suite.ts, a Vitest test in tests/<level>/ (vitest.config.mts runs each level's), or an access-rule test file
//   in supabase/tests/database/. The levels and the scripts are tests/suite.ts's own (LEVELS and suite()), read as
//   the old script read its text, until P1-14z's last row deletes that file.
// - The index in docs/rulings/README.md lists every ruling once, with the file's status, flagged "(open question)"
//   exactly when the file has an Open point. CLAUDE.md points at docs/rulings/.
// - No public file (CLAUDE.md, docs/, src/, tests/ but this one) points at the private plan's questions or decisions
//   in so many words: a reader of the public repository can't open the plan, so a ruling's source states the question
//   in one line, then the answer.
// Links themselves are checked by tests/static/every-link-anchor-and-path-the-guides-name-is-there.test.ts.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// `docs/rulings/` stays in step: files R-001… with no gaps, each with its four fields; "Decided, not built" exactly
// when the Note says not yet built; a Superseded ruling names its successor; each test named exists and runs; the index
// lists each ruling once with its status and open flag; CLAUDE.md points at it; no public file points at the plan's
// questions or decisions
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { LEVELS, suite } from '../suite.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIR = path.join(ROOT, 'docs', 'rulings');
const README = path.join(DIR, 'README.md');
const INDEX = fs.existsSync(README) ? fs.readFileSync(README, 'utf8') : '';
const STATUSES = ['Confirmed', 'Decided, not built', 'To confirm', 'Superseded'];

/** The test scripts npm test runs (tests/suite.ts), each as its file. */
const THE_SCRIPTS = new Set(suite().map((script) => script.file));
const aScript = (name: string): string | undefined =>
  THE_SCRIPTS.has(`tests/${name}.test.js`) ? `tests/${name}.test.js` : undefined;
/** A Vitest test is tests/<level>/<name>.test.ts. */
const aVitestFile = (name: string): string | undefined =>
  LEVELS.map((level) => `tests/${level}/${name}.test.ts`).find((f) => fs.existsSync(path.join(ROOT, f)));

const THE_RULINGS = fs
  .readdirSync(DIR)
  .filter((f) => f !== 'README.md' && f.endsWith('.md'))
  .sort();

/** What is wrong with one ruling's file (its name, fields, tests and index row), and its number when it has one. */
function whatIsWrongWithARuling(f: string): { number: number | null; problems: string[] } {
  const m = /^R-(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.exec(f);
  if (!m) return { number: null, problems: [`${f}: not named R-NNN-short-name.md`] };
  const digits = m[1] ?? '';
  const id = `R-${digits}`;
  const problems: string[] = [];
  const text = fs.readFileSync(path.join(DIR, f), 'utf8');
  const field = (k: string): string | null => {
    const x = new RegExp(`^- \\*\\*${k}:\\*\\* (.+)$`, 'm').exec(text);
    return x ? (x[1] ?? '').trim() : null;
  };
  if (!text.startsWith(`# ${id}: `)) problems.push(`${f}: the first line should be "# ${id}: <title>"`);
  const decided = field('Decided');
  const status = field('Status');
  const source = field('Source');
  const enforced = field('Enforced by');
  if (!decided || !/^\d{4}-\d{2}-\d{2}\b/.test(decided))
    problems.push(`${f}: Decided should start with a date (YYYY-MM-DD)`);
  if (status === null || !STATUSES.includes(status))
    problems.push(`${f}: Status is "${String(status)}", not one of ${STATUSES.join(', ')}`);
  if (!source) problems.push(`${f}: no Source`);
  const notBuilt = /^\*\*Note:\*\*.*\bnot yet built\b/m.test(text);
  if (notBuilt !== (status === 'Decided, not built'))
    problems.push(
      `${f}: Status is "${String(status)}", but its Note ${notBuilt ? 'says' : "doesn't say"} "not yet built" (the one goes with the other)`,
    );
  if (status === 'Superseded' && !/R-\d{3}/.test(text.split('\n').slice(1).join('\n')))
    problems.push(`${f}: Superseded, but names no ruling that replaced it`);
  if (!enforced) problems.push(`${f}: no Enforced by`);
  else if (enforced !== 'no test yet') {
    const links = [...enforced.matchAll(/\[`([^`]+)`\]\(([^)]+)\)/g)];
    if (!links.length) problems.push(`${f}: Enforced by is neither "no test yet" nor a list of linked tests`);
    for (const [, name = '', href = ''] of links) {
      const sql = name.endsWith('.sql');
      if (sql) {
        if (!fs.existsSync(path.join(ROOT, 'supabase', 'tests', 'database', name)))
          problems.push(`${f}: no access-rule test ${name}`);
      } else if (!aScript(name) && !aVitestFile(name))
        problems.push(`${f}: ${name} is not a test npm test runs (tests/suite.ts, or tests/<level>/${name}.test.ts)`);
      const target = sql ? name : (aScript(name) ?? aVitestFile(name) ?? `tests/${name}.test.js`);
      if (!href.endsWith(target)) problems.push(`${f}: the link for ${name} points at ${href}`);
    }
  }
  const rows = INDEX.split('\n').filter((l) => l.startsWith(`| [${id}](${f}) |`));
  if (rows.length !== 1)
    return {
      number: Number(digits),
      problems: [...problems, `${f}: listed ${String(rows.length)} times in the README index (should be once)`],
    };
  const cells = (rows[0] ?? '').split('|').map((c) => c.trim());
  const open = /^\*\*Open:\*\*/m.test(text);
  const want = `${String(status)}${open ? ' (open question)' : ''}`;
  if (cells[4] !== want) problems.push(`${f}: the index says "${String(cells[4])}", the file says "${want}"`);
  return { number: Number(digits), problems };
}

// The words that point at the private plan's questions and decisions, in every public file but this one.
const THE_PLANS_WORDS = /\bplan (?:questions?|decisions?)\b/gi;
const walk = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    : [];
const THE_PUBLIC_FILES = [
  path.join(ROOT, 'CLAUDE.md'),
  ...['docs', 'src', 'tests'].flatMap((d) => walk(path.join(ROOT, d))),
].filter((f) => f !== import.meta.filename && /\.(md|ts|mts|js|mjs|cjs|json|html|css|sql|txt)$/.test(f));

describe('the rulings are numbered, filled in, indexed and enforced by tests that run', () => {
  test('docs/rulings/README.md is there, the levels are read, and no old script is left', () => {
    expect(fs.existsSync(README), 'docs/rulings/README.md is missing').toBe(true);
    expect(LEVELS.length, 'tests/suite.ts: no LEVELS').toBeGreaterThan(0);
    // every script has become a Vitest test (plan P1-14z): a ruling's test is one of tests/<level>/
    expect([...THE_SCRIPTS]).toEqual([]);
  });

  test('each ruling is named, titled and filled in, its tests run, and the index lists it once with its status', () => {
    const found = THE_RULINGS.map(whatIsWrongWithARuling);
    const numbers = found.flatMap((r) => (r.number === null ? [] : [r.number]));
    const numbering = numbers.flatMap((n, i) =>
      n === i + 1
        ? []
        : [`numbering: expected R-${String(i + 1).padStart(3, '0')}, found R-${String(n).padStart(3, '0')}`],
    );
    const listed = (INDEX.match(/^\| \[R-\d{3}\]/gm) ?? []).length;
    const theCount =
      listed === THE_RULINGS.length
        ? []
        : [`the README index lists ${String(listed)} rulings; there are ${String(THE_RULINGS.length)} files`];
    expect([...found.flatMap((r) => r.problems), ...numbering, ...theCount]).toEqual([]);
    // Today 184 rulings.
    expect(THE_RULINGS.length).toBeGreaterThan(150);
  });

  test('CLAUDE.md points at docs/rulings/', () => {
    expect(fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8')).toContain('docs/rulings/');
  });

  test("no public file points at the plan's questions or decisions", () => {
    const found = THE_PUBLIC_FILES.flatMap((f) =>
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          (line.match(THE_PLANS_WORDS) ?? []).map(
            (m) =>
              `${path.relative(ROOT, f)}:${String(i + 1)} says "${m}": state the question in one line, then the answer`,
          ),
        ),
    );
    expect(found).toEqual([]);
  });
});
