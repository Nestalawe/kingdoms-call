// No person is named in the docs outside the roles table: the docs say "a maintainer", "the maintainers", or "the
// owner" where only the owner holds the rights (docs/ways-of-working/who-does-what-…-the-owners-keys.md, "The roles").
// Without it a name creeps back in, and with it the habit of sending each kind of question to one person: before this
// test, the docs, CLAUDE.md, the pull request template and supabase/README.md named a person 598 times (at 990f2af2).
// Level 0 (static): it reads files and nothing runs.
// - The people are read from the roles table: the first word of each "Who" cell that gives a GitHub login, and the
//   login. So the test holds no name itself, and a maintainer added to the table is checked at once.
// - No line of a Markdown file under docs/ or .github/, of CLAUDE.md or of supabase/README.md names one (any case,
//   as a whole word), but the roles table's own rows. The site's and the repository's addresses are not names.
// - No Markdown file under docs/ has a name in its path.
// - One kind of line is let off: a heading of CLAUDE.md that a skill links to by its anchor. Edits under .claude/ are
//   refused in an agent's session, so the heading keeps its anchor until the replacement skills folder is in place;
//   then the let-off finds no link, and the heading fails here until it is renamed.
// Not checked yet: comments in code and config (`src/`, `tests/`, `tools/`, `.github/workflows/`, `.github/scripts/`,
// `.github/dependabot.yml`, `.github/dangerous-paths`): their own backlog row.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ROLES_FILE = 'docs/ways-of-working/who-does-what-the-roles-the-review-by-kind-and-the-owners-keys.md';
const SKILLS = '.claude/skills';

const exists = (file: string): boolean => fs.existsSync(path.join(ROOT, file));
const read = (file: string): string => (exists(file) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '');
const markdownUnder = (folder: string): string[] =>
  exists(folder)
    ? fs
        .readdirSync(path.join(ROOT, folder), { recursive: true, encoding: 'utf8' })
        .map((f) => `${folder}/${f.split(path.sep).join('/')}`)
        .filter((f) => f.endsWith('.md'))
        .sort()
    : [];

/** The roles table's rows: the lines of the table under "## The roles" in the roles file. */
function theRolesTablesRows(): string[] {
  const lines = read(ROLES_FILE).split('\n');
  const start = lines.findIndex((line) => line === '## The roles');
  if (start < 0) return [];
  const after = lines.slice(start + 1);
  const end = after.findIndex((line) => line.startsWith('## '));
  return (end < 0 ? after : after.slice(0, end)).filter((line) => line.startsWith('|'));
}

const ROWS = theRolesTablesRows();

/** Each person of the roles table: the first word of the "Who" cell, and the GitHub login beside it. */
const PEOPLE: { name: string; login: string }[] = ROWS.flatMap((row) => {
  const who = row.split('|')[2]?.trim() ?? '';
  const login = /GitHub `([^`]+)`/.exec(who)?.[1];
  const name = /^([A-Z][a-z]+)\b/.exec(who)?.[1];
  return login && name ? [{ name, login }] : [];
});

const escaped = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORDS = PEOPLE.flatMap((p) => [p.name, p.login]).map(escaped);
const A_NAME = new RegExp(`\\b(?:${WORDS.join('|') || '(?!)'})\\b`, 'gi');
/** The site's address (<login>.github.io/kingdoms-call) and the repository's (<login>/kingdoms-call). */
const AN_ADDRESS = new RegExp(
  `\\b(?:${PEOPLE.map((p) => escaped(p.login)).join('|') || '(?!)'})(?:\\.github\\.io)?/kingdoms-call\\b`,
  'gi',
);

/** GitHub's anchor of a heading: lower case, punctuation dropped, spaces to hyphens (as static/every-link-anchor-and-path-the-guides-name-is-there reads it). */
const anchorOf = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');

/** The anchors of CLAUDE.md that a skill links to. */
const ANCHORS_A_SKILL_LINKS_TO = new Set(
  markdownUnder(SKILLS).flatMap((f) => [...read(f).matchAll(/CLAUDE\.md#([\w-]+)/g)].map((m) => m[1] ?? '')),
);

const letOff = (file: string, line: string): boolean => {
  const heading = /^#{1,6}\s+(.*?)\s*$/.exec(line)?.[1];
  return file === 'CLAUDE.md' && heading !== undefined && ANCHORS_A_SKILL_LINKS_TO.has(anchorOf(heading));
};

const SCANNED = ['CLAUDE.md', 'supabase/README.md', ...markdownUnder('docs'), ...markdownUnder('.github')];

describe('no person is named in the docs outside the roles table', () => {
  test('the roles table is read, with at least two people (a misread table would let every name through)', () => {
    expect(exists(ROLES_FILE), ROLES_FILE).toBe(true);
    expect(PEOPLE.length).toBeGreaterThanOrEqual(2);
    expect(SCANNED.length).toBeGreaterThan(100);
  });

  test('no line names a person, but the roles table', () => {
    const rows = new Set(ROWS);
    const found = SCANNED.flatMap((file) =>
      read(file)
        .split('\n')
        .flatMap((line, i) => {
          if (file === ROLES_FILE && rows.has(line)) return [];
          if (letOff(file, line)) return [];
          const names = line.replace(AN_ADDRESS, '').match(A_NAME) ?? [];
          return names.map((n) => `${file}:${String(i + 1)} ${n}`);
        }),
    );
    expect(found, 'Write "a maintainer", "the maintainers", or "the owner" for admin rights').toEqual([]);
  });

  test('no file under docs/ has a name in its path', () => {
    expect(markdownUnder('docs').filter((f) => (f.match(A_NAME) ?? []).length > 0)).toEqual([]);
  });
});
