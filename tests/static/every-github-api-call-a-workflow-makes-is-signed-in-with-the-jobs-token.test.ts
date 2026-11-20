// Every call a workflow makes to GitHub's API is signed in with the job's token. Unsigned calls share a small hourly
// limit with every other job on the same runner address, so they fail at random with 403 (the staging deploy did,
// 2026-10-10). Moved from the old script tests/workflow-api-auth.test.js (P1-14z), check for check.
// Level 0 (static): it reads .github/workflows/*.yml; nothing runs, and a workflow has no code a test could call.
// - A line that isn't a comment, runs curl or wget, and names api.github.com or $GITHUB_API_URL carries
//   "Authorization: Bearer $GITHUB_TOKEN" (or "token", or ${{ github.token }}).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const THE_WORKFLOWS = path.resolve(import.meta.dirname, '..', '..', '.github', 'workflows');

/** Each line of a workflow that calls GitHub's API without the job's token, as "<file>:<line>: <the line>". */
function theUnsignedGitHubApiCallsIn(name: string, text: string): string[] {
  return text.split('\n').flatMap((line, i) => {
    if (/^\s*#/.test(line) || !/\b(curl|wget)\b/.test(line) || !/api\.github\.com|\$\{?GITHUB_API_URL/.test(line))
      return [];
    if (
      /Authorization: (Bearer|token) \$\{?GITHUB_TOKEN\b|Authorization: (Bearer|token) \$\{\{ *github\.token *\}\}/.test(
        line,
      )
    )
      return [];
    return [`${name}:${String(i + 1)}: a GitHub API call without the job's token: ${line.trim()}`];
  });
}

describe("every GitHub API call a workflow makes is signed in with the job's token", () => {
  test('a call without the token is found; a signed one, a comment and another site are not', () => {
    const made = [
      '      - run: curl -fsSL https://api.github.com/meta',
      '      - run: curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/meta',
      '      - run: wget -q --header "Authorization: token ${{ github.token }}" "$GITHUB_API_URL/repos"',
      '      # curl https://api.github.com/meta',
      '      - run: curl -fsSL https://example.com/api.json',
    ].join('\n');
    expect(theUnsignedGitHubApiCallsIn('made-up.yml', made)).toEqual([
      "made-up.yml:1: a GitHub API call without the job's token: - run: curl -fsSL https://api.github.com/meta",
    ]);
  });

  test('every call in the workflows carries the token', () => {
    const found = fs
      .readdirSync(THE_WORKFLOWS)
      .filter((f) => /\.ya?ml$/.test(f))
      .sort()
      .flatMap((name) => theUnsignedGitHubApiCallsIn(name, fs.readFileSync(path.join(THE_WORKFLOWS, name), 'utf8')));
    expect(found).toEqual([]);
  });
});
