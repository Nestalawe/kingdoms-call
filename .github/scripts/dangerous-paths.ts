// The dangerous-paths warning (decision D-07, amended 2026-10-09), run by
// .github/workflows/dangerous-paths.yml.
//
// A pull request that changes a path listed in .github/dangerous-paths (a renamed file counts by its old
// name too) gets one comment asking to talk the change through with Theo before merging. Later runs update
// that comment in place; when nothing dangerous is left, it says so. It never blocks a merge: any problem
// is logged as a warning and the job still succeeds.
//
// match() and commentBody() are pure and unit-tested in
// tests/unit/a-pull-request-that-changes-a-dangerous-path-gets-one-warning-naming-its-files.test.ts. main() only
// reads the PR through the REST API and writes the one comment; it never fetches or runs the PR's code.
//
// Local dry run (read-only, prints instead of commenting):
//   GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=Nestalawe/kingdoms-call PR_NUMBER=1 DRY_RUN=1 \
//   node .github/scripts/dangerous-paths.ts
//
// Plain Node runs it, with nothing installed (the workflow checks out only a few files of the base branch): erasable
// TypeScript only, and only node: imports. It imports no other script, so its checkout needs only this file and its
// package.json. GitHub's answers are read through the guards below.
import fs from 'node:fs';
import path from 'node:path';

export const MARKER = '<!-- dangerous-paths -->';
const MAX_FILES = 3000; // the most changed files the API lists for one PR
const MAX_LISTED = 20; // files named in the comment; the rest are counted

// One glob per line. "#" starts a comment line; blank lines are skipped.
export function parsePaths(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

// "**" matches across folders, "*" within one folder, "?" one character. Everything else is literal.
// Case is ignored: on a Mac or Windows checkout "Supabase/" and "supabase/" are the same folder.
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob.charAt(i);
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$', 'i');
}

export function isDangerous(filename: string, globs: readonly string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(filename));
}

/** A changed file as GitHub's API lists it; a renamed one carries its old name. */
export interface AChangedFile {
  filename: string;
  previous_filename?: string | undefined;
}

// files are shaped as the REST API returns them. Returns the dangerous names, each once, in order.
export function match(files: readonly AChangedFile[], globs: readonly string[]): string[] {
  return [
    ...new Set(
      files
        .flatMap((f) => [f.filename, f.previous_filename])
        .filter((n): n is string => n !== undefined && n !== '' && isDangerous(n, globs)),
    ),
  ];
}

export function commentBody(matched: readonly string[]): string {
  if (!matched.length) return `${MARKER}\n**Dangerous paths:** this pull request no longer changes any of them.`;
  const shown = matched
    .slice(0, MAX_LISTED)
    .map((n) => `- \`${n}\``)
    .join('\n');
  const more = matched.length > MAX_LISTED ? `\n- …and ${String(matched.length - MAX_LISTED)} more` : '';
  return (
    `${MARKER}\n**⚠️ Dangerous paths.** This pull request changes database, workflow or third-party code, ` +
    `so talk it through with Theo before merging:\n${shown}${more}\n\n` +
    `_This is a warning, not a check: it doesn't block the merge. The list is in \`.github/dangerous-paths\`._`
  );
}

/** A field of a JSON answer, read as JavaScript reads `answer.name` (undefined when there is none). */
function fieldOf(answer: unknown, name: string): unknown {
  return typeof answer === 'object' && answer !== null ? Reflect.get(answer, name) : undefined;
}

/** A value, or the fallback when it is missing or empty (as `value || fallback` reads a string). */
function orWhenEmpty(value: string | undefined, fallback: string): string {
  return value === undefined || value === '' ? fallback : value;
}

async function api(url: string, token: string | undefined, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${String(res.status)} for ${orWhenEmpty(init.method, 'GET')} ${url}`);
  return res.json();
}

async function apiAll(url: string, token: string | undefined): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let page = 1; ; page++) {
    const batch = await api(`${url}?per_page=100&page=${String(page)}`, token);
    if (!Array.isArray(batch)) throw new Error(`GitHub API: ${url} page ${String(page)} isn't a list`);
    const listed: unknown[] = batch;
    all.push(...listed);
    if (listed.length < 100) return all;
  }
}

/** A changed file as GitHub's API lists it (an old name that isn't a name counts as none), or a stop naming what isn't one. */
function aChangedFileIn(answer: unknown): AChangedFile {
  const filename = fieldOf(answer, 'filename'),
    previous = fieldOf(answer, 'previous_filename');
  if (typeof filename !== 'string')
    throw new Error(`GitHub API: a changed file without a name: ${JSON.stringify(answer)}`);
  return { filename, previous_filename: typeof previous === 'string' ? previous : undefined };
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, PR_NUMBER: number, DRY_RUN: dry } = process.env;
  if (!repo || !number) throw new Error('GITHUB_REPOSITORY and PR_NUMBER must be set');
  const root = `${orWhenEmpty(process.env['GITHUB_API_URL'], 'https://api.github.com')}/repos/${repo}`;
  const globs = parsePaths(fs.readFileSync(path.join(import.meta.dirname, '..', 'dangerous-paths'), 'utf8'));

  const pr = await api(`${root}/pulls/${number}`, token);
  const changed = fieldOf(pr, 'changed_files');
  let matched;
  if (typeof changed === 'number' && changed > MAX_FILES)
    matched = [`(more than ${String(MAX_FILES)} files changed: too many to check, so treat it as dangerous)`];
  else matched = match((await apiAll(`${root}/pulls/${number}/files`, token)).map(aChangedFileIn), globs);

  const comments = await apiAll(`${root}/issues/${number}/comments`, token);
  const mine = comments.find((c) => {
    const text = fieldOf(c, 'body');
    return typeof text === 'string' && text.startsWith(MARKER);
  });
  console.log(matched.length ? `Dangerous paths changed: ${matched.join(', ')}` : 'No dangerous paths changed.');

  if (!matched.length && !mine) return; // nothing to say, and nothing said before
  const body = commentBody(matched);
  if (mine && fieldOf(mine, 'body') === body) return; // already up to date
  if (dry) {
    console.log(`DRY_RUN: would ${mine ? 'update' : 'post'} this comment:\n${body}`);
    return;
  }
  if (mine)
    await api(`${root}/issues/comments/${String(fieldOf(mine, 'id'))}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    });
  else await api(`${root}/issues/${number}/comments`, token, { method: 'POST', body: JSON.stringify({ body }) });
  console.log(mine ? 'Updated the warning comment.' : 'Posted the warning comment.');
}

if (import.meta.main)
  main().catch((e: unknown) => {
    console.log(
      `::warning title=dangerous-paths::Couldn't post the warning (it never blocks the merge): ${e instanceof Error ? e.message : String(e)}`,
    );
  });
