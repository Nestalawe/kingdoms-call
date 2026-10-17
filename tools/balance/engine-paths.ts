// The engine paths (plan P1-02, Decisions): the files whose change can change how the balance matrix plays. Listed once,
// here, for CI's balance job and for the runner (run.ts checks that every file its page loads is on the list).
//
// Run as a script, it is the balance job's first step (.github/workflows/ci.yml): it compares this commit with the one
// before (a pull request: its base, HEAD^1 of GitHub's merge commit; a merge into main, from deploy.yml: the commit
// before the push) and writes play=true or play=false to $GITHUB_OUTPUT. With play=false the job ends there, in
// seconds. It fails if the pull request is labelled refactor-only and changes the balance baseline.
//
// It runs before npm ci, in plain Node: keep it to erasable TypeScript (types only: no enum, namespace or parameter
// property) and import nothing but Node's own modules (tests/unit/balance-engine-paths.test.ts checks both).
//
// Environment: EVENT (github.event_name), BEFORE (github.event.before, for a push), REFACTOR_ONLY ('true' when the
// pull request has the label), GITHUB_OUTPUT.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** One glob per entry: "**" matches across folders, "*" within one. Paths as git names them, from the repository's
 *  root. The site is built from src/ (P1-05): these are the files the GM portal's page and the scripts it loads are
 *  built from (src/manifest.ts), and the build. tests/static/harness.test.ts checks they are exactly those. */
export const ENGINE_PATHS: readonly string[] = [
  // The engine and its content, the GM portal's other code (its page is one scope: any of it can change a game), and
  // the scripts the page loads with it, which the matrix loads too (tests/lib/boot.js's readPage).
  'src/engine/**',
  'src/views/**',
  'src/db/**',
  'src/content/**',
  'src/ui/gm/**',
  'src/ui/shared/**',
  // The build: which files make the page, and in what order.
  'src/manifest.ts',
  'tools/build.ts',
  // The matrix itself, its baselines, the named scenarios, and the test helpers they boot the page with.
  'tools/balance/**',
  'tests/balance/**',
  'tests/lib/boot.js',
  'tests/lib/stub-db.js',
  'tests/lib/scenario.js',
  'tests/lib/invariants.ts',
  'tests/lib/report-leaks.ts',
  // The tools it runs on: a jsdom or Node bump can change the games, so a Dependabot PR plays them (Theo, 2026-10-16).
  'package-lock.json',
  '.nvmrc',
];

/** The committed baselines: a refactor-only pull request may not change them. */
export const BASELINE_DIR = 'tests/balance/baseline/';

const globToRegExp = (glob: string) =>
  new RegExp(
    '^' +
      glob
        .split('**')
        .map((part) =>
          part
            .split('*')
            .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
            .join('[^/]*'),
        )
        .join('.*') +
      '$',
  );
const PATTERNS = ENGINE_PATHS.map(globToRegExp);

export const isEnginePath = (file: string): boolean => PATTERNS.some((re) => re.test(file));
export const enginePathsIn = (files: readonly string[]): string[] => files.filter(isEnginePath);

export interface Decision {
  /** Play the matrix (npm ci, then npm run balance). */
  play: boolean;
  /** Fail the job now. */
  fail: boolean;
  /** What to print, in the job's log. */
  lines: string[];
}

const MAX_LISTED = 20;
const list = (files: string[]) =>
  files
    .slice(0, MAX_LISTED)
    .map((f) => '  ' + f)
    .concat(files.length > MAX_LISTED ? [`  …and ${String(files.length - MAX_LISTED)} more`] : []);

/** `base` is the commit compared with (null: none, so the matrix is always played); `changed`, the files changed since
 *  it (a renamed file under both names). */
export function decide(input: { base: string | null; changed: readonly string[]; refactorOnly: boolean }): Decision {
  if (input.base == null) {
    return { play: true, fail: false, lines: ['No commit to compare with (a run by hand): the matrix is played.'] };
  }
  const baseline = input.changed.filter((f) => f.startsWith(BASELINE_DIR));
  if (input.refactorOnly && baseline.length) {
    return {
      play: false,
      fail: true,
      lines: [
        'This pull request is labelled refactor-only, but it changes the balance baseline:',
        ...list(baseline),
        'A refactor must leave every game of the matrix identical. Undo the change to play; or, if the change is meant',
        'to change play, remove the refactor-only label.',
      ],
    };
  }
  const engine = enginePathsIn(input.changed);
  if (!engine.length) {
    return {
      play: false,
      fail: false,
      lines: ['No engine path changed: the balance matrix is not played (tools/balance/engine-paths.ts).'],
    };
  }
  return {
    play: true,
    fail: false,
    lines: [
      `${String(engine.length)} engine path(s) changed: the balance matrix is played.`,
      ...list(engine),
      ...(input.refactorOnly
        ? ['Labelled refactor-only: the baseline is unchanged, so every game must be identical.']
        : []),
    ],
  };
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const hasCommit = (ref: string) => {
  try {
    git('cat-file', '-e', ref + '^{commit}');
    return true;
  } catch {
    return false;
  }
};

/** The commit to compare with, from the event; null if there is none. */
function baseOf(env: NodeJS.ProcessEnv): string | null {
  if (env['EVENT'] === 'pull_request') return git('rev-parse', 'HEAD^1');
  const before = env['BEFORE'] ?? '';
  if (env['EVENT'] !== 'push' || !/^[0-9a-f]{40}$/.test(before) || /^0+$/.test(before)) return null;
  // The checkout keeps two commits. A push of several commits needs the one before them too.
  if (!hasCommit(before)) git('fetch', '--no-tags', '--depth=1', 'origin', before);
  return before;
}

function main(env: NodeJS.ProcessEnv): number {
  const base = baseOf(env);
  const changed = base ? git('diff', '--name-only', '--no-renames', base, 'HEAD').split('\n').filter(Boolean) : [];
  const d = decide({ base, changed, refactorOnly: env['REFACTOR_ONLY'] === 'true' });
  if (base) console.log(`Compared with ${base} (${env['EVENT'] === 'push' ? 'before the push' : 'the base branch'}).`);
  console.log(d.lines.join('\n'));
  if (env['GITHUB_OUTPUT']) fs.appendFileSync(env['GITHUB_OUTPUT'], `play=${String(d.play)}\n`);
  return d.fail ? 1 : 0;
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = main(process.env);
