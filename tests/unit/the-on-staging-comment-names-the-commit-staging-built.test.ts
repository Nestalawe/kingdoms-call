// The "On staging" comment (.github/scripts/staging.js, comment) names the commit staging built and the pull request's
// last commit. Staging runs on pull_request, so its build job builds GitHub's test merge of the pull request into its
// base (github.sha); the footers' build line names that merge, and each page's staging line names the last commit.
// #187's comment named only the last commit, so a click-list asking for "the comment's commit" in the build line would
// have failed.
// Level 1 (unit): the comment's text from a pure function, and the script run as staging.yml runs it, without the
// built commit, stopping before it reaches GitHub. Static can't: it runs code. tests/static/harness.test.ts checks
// that staging.yml passes both commits.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// The "On staging" comment (`.github/scripts/staging.js` `comment`) names the pull request's last commit (each page's
// staging line) and the commit staging built, GitHub's test merge of it into its base (the footers' build line); the
// script, run as `staging.yml` runs it, stops with an error for the job when either commit is missing, before it
// reaches GitHub. Level 1: a pure function and the script run with no network (static can't: it runs code);
// `static/harness.test.ts` checks `staging.yml` passes both. TypeScript, in `unit/`
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import staging from '../../.github/scripts/staging.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const HEAD = 'cc96062' + 'a'.repeat(33);
const MERGE = 'd3166c4' + 'b'.repeat(33);

describe('the "On staging" comment', () => {
  test("names the pull request's last commit and the commit built, each where a page shows it", () => {
    const body = staging.onStagingBody({ pr: 187, sha: HEAD, built: MERGE });
    expect(body.startsWith(staging.MARKER)).toBe(true);
    expect(body).toContain('this pull request (commit `cc96062`)');
    expect(body).toContain("built as GitHub's merge of it into its base branch, commit `d3166c4`");
    expect(body).toContain("each page's staging line names `cc96062`, and the build line names `d3166c4`");
  });

  test('the script refuses to comment without the commit built, or the last commit', () => {
    // Nothing reaches GitHub: the API's address is a closed local port.
    const run = (env: Record<string, string>) =>
      spawnSync(process.execPath, [path.join(ROOT, '.github', 'scripts', 'staging.js'), 'comment', ''], {
        encoding: 'utf8',
        env: {
          PATH: process.env['PATH'] ?? '',
          GITHUB_API_URL: 'http://127.0.0.1:9',
          GITHUB_REPOSITORY: 'example/example',
          PR_NUMBER: '187',
          ...env,
        },
      });
    const withoutBuilt = run({ PR_SHA: HEAD });
    expect(withoutBuilt.status).toBe(1);
    expect(withoutBuilt.stderr).toContain('::error title=staging::comment needs BUILT_SHA, a full commit id');
    const withoutHead = run({ BUILT_SHA: MERGE });
    expect(withoutHead.status).toBe(1);
    expect(withoutHead.stderr).toContain('::error title=staging::comment needs PR_SHA, a full commit id');
  });
});
