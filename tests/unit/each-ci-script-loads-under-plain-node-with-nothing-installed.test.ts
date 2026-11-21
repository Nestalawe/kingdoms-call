// Each CI script in TypeScript (.github/scripts/*.ts) loads under plain Node with nothing installed. The workflows run
// the CI scripts with `node` and no `npm ci` (staging.yml: "they need Node, not npm"; dangerous-paths.yml checks out
// only a few files of the base branch), so a script may hold only what Node's type stripping takes (erasable syntax:
// no enum, namespace or parameter property) and import only Node's own modules and its neighbours. Vitest, which the
// scripts' own unit tests run under, transforms TypeScript itself and finds the installed packages: it would pass an
// enum, or an import of zod, that the workflow's Node refuses.
// Level 1 (unit): runs Node on a copy of the folder, outside the repository, importing each script as a module. Static
// can't: whether Node loads a file is Node's answer, not a reading of its text. Nothing reaches GitHub, a database or
// the Supabase CLI: imported, a script's main doesn't run (import.meta.main is false), which the empty output checks.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Each of `.github/scripts/`'s TypeScript scripts (`staging.ts`, `migrations.ts`, `dangerous-paths.ts`) loads under
// the pinned Node alone, from a copy of the folder outside the repository (no packages, no transform; the repository's
// package.json above it), prints nothing (no warning from Node either: the folder's package.json says they are
// modules) and exits 0: its main doesn't run on import. Level 1: Node runs it (static can't: Node's answer). TypeScript, in `unit/`
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCRIPTS = path.join(ROOT, '.github', 'scripts');
/** The CI scripts in TypeScript; a new one joins this list. */
const THE_SCRIPTS = ['dangerous-paths.ts', 'migrations.ts', 'staging.ts'];

/**
 * What plain Node says when it imports the script from a copy of the folder outside the repository, under a copy of the
 * repository's own package.json (which has no "type"), as in the workflows' checkouts.
 */
function whatNodeSaysImporting(script: string): { status: number | null; stdout: string; stderr: string } {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-ci-scripts-'));
  try {
    const folder = path.join(copy, '.github', 'scripts');
    fs.mkdirSync(folder, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(copy, 'package.json'));
    for (const f of fs.readdirSync(SCRIPTS)) fs.copyFileSync(path.join(SCRIPTS, f), path.join(folder, f));
    const href = pathToFileURL(path.join(folder, script)).href;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(href)});`], {
      cwd: copy,
      encoding: 'utf8',
      env: { PATH: process.env['PATH'] ?? '' },
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
}

describe("each CI script loads under the workflow's plain Node", () => {
  test('the folder holds these scripts in TypeScript', () => {
    expect(
      fs
        .readdirSync(SCRIPTS)
        .filter((f) => f.endsWith('.ts'))
        .sort(),
    ).toEqual(THE_SCRIPTS);
  });

  test.each(THE_SCRIPTS)('%s loads with nothing installed, and its main does not run on import', (script) => {
    const said = whatNodeSaysImporting(script);
    expect(said.status, said.stderr).toBe(0);
    expect(said.stdout, 'its main ran').toBe('');
    // No MODULE_TYPELESS_PACKAGE_JSON: the folder's package.json says the scripts are modules, where the repository's
    // has no "type".
    expect(said.stderr, 'Node warned').toBe('');
  });
});
