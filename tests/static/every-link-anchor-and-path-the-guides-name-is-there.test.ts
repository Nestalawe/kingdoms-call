// Every link, anchor and path the guides name is there: the guides an agent starts from must not point at things that
// aren't. Moved from the old script tests/docs.test.js (P1-14z), check for check.
// Level 0 (static): it reads files and nothing runs; a link has no code to call, so no lower level exists.
// - Every relative link in CLAUDE.md, README.md, docs/**/*.md, tests/README.md, the list of tests, the PR template and
//   the Claude Code skills (each Markdown file under the folder tests/the-docs-budgets.json names as "skills") reaches
//   an existing file, and a #anchor into a Markdown file matches one of its headings (GitHub's anchors).
// - Every `site/…`, `src/…`, `tests/…`, `tools/…`, `docs/…`, `.github/…` or `.claude/…` path written in backticks
//   exists (site/ is built first: npm test builds it). Globs and placeholders such as `**`, `<name>` or `NNN` are
//   skipped.
// - HTML comments (the PR template's hints) and fenced code aren't read. Nothing outside the repository is fetched.
// A skill's frontmatter is checked by tests/static/a-skills-frontmatter-holds-only-its-name-and-its-description.test.ts,
// and how big the docs read first may grow by tests/static/the-docs-an-agent-reads-first-stay-within-their-budgets.test.ts.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function markdownFilesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? markdownFilesUnder(p) : entry.name.endsWith('.md') ? [p] : [];
  });
}

const BUDGETS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'the-docs-budgets.json'), 'utf8')) as {
  skills: { folder: string };
};
const THE_GUIDES = [
  'CLAUDE.md',
  'README.md',
  'tests/README.md',
  'tests/every-test-its-level-and-what-it-checks.md',
  '.github/pull_request_template.md',
]
  .map((f) => path.join(ROOT, f))
  .concat(markdownFilesUnder(path.join(ROOT, 'docs')), markdownFilesUnder(path.join(ROOT, BUDGETS.skills.folder)));

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens, repeats get -1, -2, … */
function theHeadingAnchorsOf(text: string): Set<string> {
  const seen = new Map<string, number>();
  const anchors = new Set<string>();
  let fence = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    const heading = fence ? null : /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    const base = (heading[1] ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n ? `${base}-${String(n)}` : base);
  }
  return anchors;
}

const anchorsOfFile = (file: string): Set<string> => theHeadingAnchorsOf(fs.readFileSync(file, 'utf8'));

/** A guide's text with its HTML comments removed (until none is left, so a comment inside another goes too) and
 *  its fenced code left out. */
function theProseOf(text: string): string {
  let prose = text;
  for (let previous: string | undefined; previous !== prose;) {
    previous = prose;
    prose = prose.replace(/<!--[\s\S]*?-->/g, '');
  }
  return prose.replace(/^\s*```[\s\S]*?^\s*```/gm, '');
}

interface WhatAGuideNames {
  checked: number;
  problems: string[];
}

/** What is wrong with the links and the backticked paths of one guide. */
function theBrokenLinksAndPathsOf(file: string): WhatAGuideNames {
  const shown = path.relative(ROOT, file);
  if (!fs.existsSync(file)) return { checked: 0, problems: [`${shown}: missing`] };
  const prose = theProseOf(fs.readFileSync(file, 'utf8'));
  const problems: string[] = [];
  let checked = 0;
  for (const [, target = ''] of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue; // https:, mailto:
    checked++;
    const [rel, hash] = target.split('#');
    const dest = rel ? path.resolve(path.dirname(file), rel) : file;
    if (!fs.existsSync(dest)) problems.push(`${shown}: link to ${target}: no such file`);
    else if (hash && dest.endsWith('.md') && !anchorsOfFile(dest).has(hash))
      problems.push(`${shown}: link to ${target}: no heading with that anchor`);
  }
  for (const [, p = ''] of prose.matchAll(/`((?:site|src|tests|tools|docs|\.github|\.claude)\/[^`\s]*)`/g)) {
    if (/[*<>]|NNN/.test(p)) continue;
    checked++;
    if (!fs.existsSync(path.join(ROOT, p))) problems.push(`${shown}: \`${p}\` doesn't exist`);
  }
  return { checked, problems };
}

describe('every link, anchor and path the guides name is there', () => {
  test("GitHub's anchors: punctuation dropped, spaces to hyphens, a repeat numbered, a fenced heading left out", () => {
    expect([
      ...theHeadingAnchorsOf('# The rules\n## Dice: from kcRng()\n## The rules\n```\n# not a heading\n```\n'),
    ]).toEqual(['the-rules', 'dice-from-kcrng', 'the-rules-1']);
  });

  test('a comment that a removal leaves behind and fenced code are not read', () => {
    expect(theProseOf('a <!<!-- x -->-- y --> b\n```\n[gone](nowhere.md)\n```\nc')).toBe('a  b\n\nc');
  });

  test('every relative link reaches a file and a heading, and every backticked path exists', () => {
    const found = THE_GUIDES.map(theBrokenLinksAndPathsOf);
    expect(found.flatMap((f) => f.problems)).toEqual([]);
    // The guides are read: today 258 files, 2,819 links and paths.
    expect(THE_GUIDES.length).toBeGreaterThan(200);
    expect(found.reduce((sum, f) => sum + f.checked, 0)).toBeGreaterThan(2000);
  });
});
