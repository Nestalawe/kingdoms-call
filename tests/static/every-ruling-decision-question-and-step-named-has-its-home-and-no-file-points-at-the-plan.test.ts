// Every ruling, decision, question and step the repository names has its one home in docs/, and no public file
// points at the private plan's files (CLAUDE.md, "Where documentation goes": one home a fact; elsewhere a link).
// Without it a reference goes stale unseen: before this test, 27 lines of the public files pointed at the plan's
// NEXT.md, PARKED.md or files under plan/, which a reader of the public repository can't open.
// Level 0 (static): it reads files and nothing runs.
// - Each R-NNN named in docs/, src/, tests/, tools/, CLAUDE.md and the skills is a file docs/rulings/R-NNN-*.md.
// - Each D-NN (and D-NNa) is a decision of docs/decisions/README.md.
// - Each question number ("question 21", "questions 36, 39 and 41") is open in docs/questions-for-the-maintainers.md, or named
//   by a ruling (its source: the ruling is the answered question's home).
// - Each step id (P1-16, P1-11e29) is a row of docs/backlog/README.md, or in its finished list (a finished step, or
//   one dropped: "P0-14, on 2026-10-14").
// - No backlog row is done or dropped (those leave it for the finished list), and none is in the finished list too.
// - No file git keeps names NEXT.md, PARKED.md or STATUS.md, or a path inside plan/ (naming the folder itself, as
//   .gitignore and the copies of the tree do, is fine). One file is let off, with its reason (THE_PLANS_FOLDER_ON_PURPOSE).
// Not checked yet: a code comment's `Parked "<title>"` names a known defect by its title; those titles get their home
// in docs/backlog/ with Tranche B of the docs' move, and this test checks them then.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const THIS_FILE = path
  .relative(ROOT, import.meta.filename)
  .split(path.sep)
  .join('/');

// A home that is missing reads as empty, so the first test below says so, and every reference to it fails.
const read = (file: string): string =>
  fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '';
const filesIn = (folder: string): string[] =>
  fs.existsSync(path.join(ROOT, folder))
    ? fs
        .readdirSync(path.join(ROOT, folder))
        .filter((f) => f.endsWith('.md'))
        .map((f) => `${folder}/${f}`)
    : [];

const TEXT = /\.(md|ts|mts|js|mjs|cjs|json|sql|ya?ml|html|css|toml|txt|sh)$|^\.gitignore$|dangerous-paths$/;

/** The files git keeps (and new ones it doesn't ignore): what the public repository holds. */
const THE_PUBLIC_FILES: string[] = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: ROOT, encoding: 'utf8' },
)
  .split('\0')
  .filter((f) => f !== '' && TEXT.test(path.basename(f)) && fs.existsSync(path.join(ROOT, f)))
  .sort();

/** Where a reference is read: the docs, the code, the tests, the tools, CLAUDE.md and the skills. */
const READ_FOR_REFERENCES = THE_PUBLIC_FILES.filter(
  (f) =>
    f !== THIS_FILE &&
    !f.startsWith('tests/fixtures/') &&
    (/^(docs|src|tests|tools|\.claude)\//.test(f) || f === 'CLAUDE.md'),
);

/** A file that names a path inside plan/ on purpose, and why. */
const THE_PLANS_FOLDER_ON_PURPOSE: Record<string, string> = {
  'tests/unit/a-planted-fault-names-the-games-reports-and-tests-it-changes.test.ts':
    'it writes a file into a copy of the plan folder to check that a copy of the tree leaves the plan out',
};

// ─── The homes ───

const RULINGS = new Set(filesIn('docs/rulings').flatMap((f) => /\/R-(\d{3})-[^/]*\.md$/.exec(f)?.slice(1, 2) ?? []));

const DECISIONS = new Set(
  read('docs/decisions/README.md')
    .split('\n')
    .flatMap((line) => /^- \*\*D-(\d{2})\b/.exec(line)?.slice(1, 2) ?? []),
);

/** The numbers a "question" or "questions" names: "question 45 (a)", "questions 17 (…) and 31", "questions 36, 39 and 41". */
function questionNumbersIn(text: string): { number: string; at: number }[] {
  const found: { number: string; at: number }[] = [];
  const start = /\b[Qq]uestions? (\d+)\b/g;
  for (let m = start.exec(text); m; m = start.exec(text)) {
    found.push({ number: m[1] ?? '', at: m.index });
    const more = /^(?:\s*\([^)]*\))?\s*(?:,|and|or)\s*(\d{1,3})\b(?![-–.:/]\d)/;
    let rest = text.slice(m.index + m[0].length);
    for (let n = more.exec(rest); n; n = more.exec(rest)) {
      found.push({ number: n[1] ?? '', at: m.index });
      rest = rest.slice(n[0].length);
    }
  }
  return found;
}

const OPEN_QUESTIONS = new Set(
  read('docs/questions-for-the-maintainers.md')
    .split('\n')
    .flatMap((line) => /^## (\d+)\. /.exec(line)?.slice(1, 2) ?? []),
);
const ANSWERED_QUESTIONS = new Set(
  filesIn('docs/rulings')
    .filter((f) => /\/R-\d{3}-/.test(f))
    .flatMap((f) => questionNumbersIn(read(f)).map((q) => q.number)),
);

const BACKLOG = 'docs/backlog/README.md';
const FINISHED_LISTS = filesIn('docs/backlog').filter((f) => f.includes('/finished-steps-'));
const STEP = /\bP\d-\d{2}[a-z0-9]*\b/g;

/** The backlog's open rows: each id with its status cell. */
const OPEN_ROWS: { id: string; status: string }[] = read(BACKLOG)
  .split('\n')
  .filter((line) => /^\| P\d-/.test(line))
  .map((line) => {
    const cells = line.split('|').map((c) => c.trim());
    return { id: cells[1] ?? '', status: cells[7] ?? '' };
  });

/** The finished list: "- P1-13a: #180 …", and the dropped ids, "P0-14, on 2026-10-14". */
const FINISHED_STEPS = new Set(
  FINISHED_LISTS.flatMap((f) =>
    read(f)
      .split('\n')
      .flatMap((line) => [
        ...(/^- (P\d-\d{2}[a-z0-9]*):/.exec(line)?.slice(1, 2) ?? []),
        ...[...line.matchAll(/\b(P\d-\d{2}[a-z0-9]*), on \d{4}-\d{2}-\d{2}\b/g)].map((m) => m[1] ?? ''),
      ]),
  ),
);
const STEPS = new Set([...OPEN_ROWS.map((r) => r.id), ...FINISHED_STEPS]);

// ─── The references ───

interface Reference {
  file: string;
  line: number;
  name: string;
}

function referencesIn(find: (text: string) => { name: string; at: number }[]): Reference[] {
  return READ_FOR_REFERENCES.flatMap((file) => {
    const text = read(file);
    return find(text).map(({ name, at }) => ({ file, line: text.slice(0, at).split('\n').length, name }));
  });
}

const matchesOf =
  (pattern: RegExp, name: (m: RegExpMatchArray) => string) =>
  (text: string): { name: string; at: number }[] =>
    [...text.matchAll(pattern)].map((m) => ({ name: name(m), at: m.index }));

/** Each reference as "file:line name", the name after what it is ("R-", "D-", "question "). */
const shown = (refs: Reference[], what = ''): string[] =>
  refs.map((r) => `${r.file}:${String(r.line)} ${what}${r.name}`);

describe('every fact the repository names has its home in docs/', () => {
  test('the homes are read (a home the test misreads would let every reference through, or none)', () => {
    expect(RULINGS.size).toBeGreaterThan(100);
    expect(DECISIONS.has('01') && DECISIONS.has('13')).toBe(true);
    expect(OPEN_ROWS.length).toBeGreaterThan(20);
    expect(FINISHED_STEPS.size).toBeGreaterThan(100);
    expect(FINISHED_STEPS.has('P0-14')).toBe(true);
    expect(ANSWERED_QUESTIONS.size).toBeGreaterThan(20);
    expect(
      questionNumbersIn('Questions 17 (of 2026-10-31) and 31 (2026-11-02); question 45 (a), 2026').map((q) => q.number),
    ).toEqual(['17', '31', '45']);
  });

  test('each ruling named is a file in docs/rulings/', () => {
    const refs = referencesIn(matchesOf(/\bR-(\d{3})\b/g, (m) => m[1] ?? ''));
    expect(
      shown(
        refs.filter((r) => !RULINGS.has(r.name)),
        'R-',
      ),
    ).toEqual([]);
  });

  test('each decision named is in docs/decisions/README.md', () => {
    const refs = referencesIn(matchesOf(/\bD-(\d{2})[a-h]?\b/g, (m) => m[1] ?? ''));
    expect(
      shown(
        refs.filter((r) => !DECISIONS.has(r.name)),
        'D-',
      ),
    ).toEqual([]);
  });

  test('each question named is open in docs/questions-for-the-maintainers.md, or answered by a ruling', () => {
    const refs = referencesIn((text) => questionNumbersIn(text).map((q) => ({ name: q.number, at: q.at })));
    expect(
      shown(
        refs.filter((r) => !OPEN_QUESTIONS.has(r.name) && !ANSWERED_QUESTIONS.has(r.name)),
        'question ',
      ),
    ).toEqual([]);
  });

  test('each step named is a row of the backlog, or in its finished list', () => {
    const refs = referencesIn(matchesOf(STEP, (m) => m[0]));
    expect(shown(refs.filter((r) => !STEPS.has(r.name)))).toEqual([]);
  });

  test('no backlog row is done or dropped, and none is in the finished list too', () => {
    expect(OPEN_ROWS.filter((r) => /✅|✖/.test(r.status)).map((r) => `${r.id} ${r.status}`)).toEqual([]);
    expect(OPEN_ROWS.filter((r) => FINISHED_STEPS.has(r.id)).map((r) => r.id)).toEqual([]);
  });
});

describe('no public file points at the private plan', () => {
  test("no file names the plan's NEXT.md, PARKED.md or STATUS.md, or a path inside plan/", () => {
    const pointer = /\b(?:NEXT|PARKED|STATUS)\.md\b|(?<![\w/-])plan\/[\w<.-]/g;
    const found = THE_PUBLIC_FILES.filter((f) => f !== THIS_FILE && !(f in THE_PLANS_FOLDER_ON_PURPOSE)).flatMap(
      (file) =>
        read(file)
          .split('\n')
          .flatMap((line, i) => (line.match(pointer) ?? []).map((m) => `${file}:${String(i + 1)} ${m}`)),
    );
    expect(found).toEqual([]);
  });

  test('each file let off still names a path inside plan/', () => {
    for (const file of Object.keys(THE_PLANS_FOLDER_ON_PURPOSE)) expect(read(file), file).toMatch(/plan\/[\w<.-]/);
  });
});
