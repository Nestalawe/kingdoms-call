// The planted-fault runner (tools/proof/a-planted-fault.ts, npm run proof:plant) and the copies it makes
// (tools/proof/copies-of-the-tree.ts), on a made-up git repository in a temporary folder:
// - a copy of the working tree holds the tracked files and the new ones git doesn't ignore, an uncommitted change too,
//   but not the ignored ones, the plan's folder or node_modules; node_modules is linked; the copy is a git repository
//   of its own with nothing uncommitted; a copy of a commit holds that commit, without the uncommitted change;
// - a patch is applied and committed; one git refuses, and one that changes nothing, stop the runner;
// - in the copy, its "balance" (a small Node script: it writes a run in the baseline's form, and every realm's reports
//   beside it, the planted ones when src/ holds the plant) is compared with the copy's committed baselines, game by
//   game: the planted game differs in the matrix (set A by its hashes, set B by its statistics) and in its reports;
//   its "test" (writing Vitest's JSON report) is red on the plant; with a patch that leaves src/ alone, nothing differs
//   and the tests are green; the copy is removed after.
// - the comparison on made-up games: a game missing from the baseline differs; set B's compares statistics only.
// Level 1 (unit): it runs the runner on a made-up repository and small scripts; no game is played. Static can't: it
// runs code and processes.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { formatBaseline, formatReports, type KeptGame, type ReportsGame } from '../../tools/balance/baseline.ts';
import { TURN_COLUMNS } from '../../tools/balance/hash.ts';
import { describeOutcome, notesIn, whatAPlantChanges, whatTheSetChanged } from '../../tools/proof/a-planted-fault.ts';
import {
  commitTheCopy,
  copyACommit,
  copyTheWorkingTree,
  linkNodeModules,
  plantAPatch,
  theFilesOfTheWorkingTree,
} from '../../tools/proof/copies-of-the-tree.ts';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kc-proof-plant-test-')));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});
const repo = path.join(tmp, 'repo');
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' });

// A made-up game: one turn line of TURN_COLUMNS hashes, all `h`, the first one `first`.
const game = (id: string, first: string, stat: number): KeptGame => ({
  id,
  turns: [[first, ...TURN_COLUMNS.slice(1).map(() => 'h')].join(' ')],
  results: 'r',
  stats: { 'battles: fought': [stat, 1] },
});
const reports = (id: string, words: string): ReportsGame => ({
  id,
  turns: [`0:p/${words} 1:p/w`],
  sections: { lastTurnLog: ['p', words] },
});
const write = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), text);
};

beforeAll(() => {
  const unplanted = [game('bots-00', 'a', 1), game('bots-01', 'b', 2)];
  const planted = [game('bots-00', 'PLANTED', 9), game('bots-01', 'b', 2)];
  const reportsOf = (words: string) => [reports('bots-00', words), reports('bots-01', 'w')];
  write('tests/balance/baseline/matrix.json', formatBaseline('A', unplanted));
  write('tests/balance/baseline/noise.json', formatBaseline('B', unplanted));
  write('tests/balance/baseline/reports.json', formatReports({ A: reportsOf('w'), B: reportsOf('w') }));
  // What the made-up balance writes: the planted run when src/ holds the plant.
  for (const set of ['A', 'B'] as const) {
    write(`runs/${set}-unplanted.json`, formatBaseline('A', unplanted));
    write(`runs/${set}-planted.json`, formatBaseline('A', planted));
    write(`runs/${set}-unplanted-every-realm.json`, formatReports({ [set]: reportsOf('w') }));
    write(`runs/${set}-planted-every-realm.json`, formatReports({ [set]: reportsOf('PLANTED') }));
  }
  write(
    'scripts/balance.js',
    `const fs = require('fs'), path = require('path');
const set = process.argv[process.argv.indexOf('--set') + 1], out = process.argv[process.argv.indexOf('--out') + 1];
const planted = fs.readFileSync('src/rule.txt', 'utf8').includes('PLANT') ? 'planted' : 'unplanted';
console.log('node_modules/a-package: ' + fs.existsSync('node_modules/a-package/index.js'));
fs.copyFileSync('runs/' + set + '-' + planted + '.json', out);
fs.copyFileSync('runs/' + set + '-' + planted + '-every-realm.json', path.join(path.dirname(out), 'every-realm.json'));
if (planted === 'planted') console.log('A leak check broke in 1 game(s), first in:');
process.exit(planted === 'planted' ? 1 : 0);
`,
  );
  write(
    'scripts/test.js',
    `const fs = require('fs');
const passed = !fs.readFileSync('src/rule.txt', 'utf8').includes('PLANT');
const out = process.argv.find((a) => a.startsWith('--outputFile.json='));
const status = passed ? 'passed' : 'failed';
const named = process.argv.includes('tests/rule.test.ts');
const report = { testResults: [{ name: process.cwd() + '/tests/rule.test.ts', status,
  assertionResults: [{ fullName: 'the rule holds' + (named ? ' (named)' : ''), status }] }] };
if (out) fs.writeFileSync(out.slice('--outputFile.json='.length), JSON.stringify(report));
process.exit(passed ? 0 : 1);
`,
  );
  write(
    'package.json',
    JSON.stringify({ private: true, scripts: { balance: 'node scripts/balance.js', test: 'node scripts/test.js' } }),
  );
  write('src/rule.txt', 'the rule\n');
  write('README.md', 'a made-up repository\n');
  write('.gitignore', 'node_modules/\nignored.txt\n');
  git(tmp, 'init', '-q', repo);
  git(repo, 'add', '-A');
  git(repo, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', 'commit', '-qm', 'made up');
  // Not committed: a change, a new file, an ignored file, the plan's folder, node_modules.
  write('README.md', 'a made-up repository, changed\n');
  write('new.txt', 'new\n');
  write('ignored.txt', 'ignored\n');
  write('plan/STATUS.md', 'private\n');
  write('node_modules/a-package/index.js', 'module.exports = 1;\n');
  write('plant.patch', diffOf('src/rule.txt', 'the rule\n', 'the rule PLANT\n'));
  write('words.patch', diffOf('README.md', 'a made-up repository, changed\n', 'a made-up repository, changed again\n'));
});

/** A `git diff` of one file from `before` to `after` (made in a scratch repository). */
function diffOf(file: string, before: string, after: string): string {
  const d = fs.mkdtempSync(path.join(tmp, 'diff-'));
  git(tmp, 'init', '-q', d);
  fs.mkdirSync(path.dirname(path.join(d, file)), { recursive: true });
  fs.writeFileSync(path.join(d, file), before);
  git(d, 'add', '-A');
  fs.writeFileSync(path.join(d, file), after);
  return git(d, 'diff');
}

describe('a copy of the tree', () => {
  test('holds the working tree as it is, not the ignored files, the plan or node_modules; it links node_modules and is committed', () => {
    expect(theFilesOfTheWorkingTree(repo)).not.toContain('plan/STATUS.md');
    const copy = path.join(tmp, 'copy-1');
    copyTheWorkingTree(repo, copy);
    linkNodeModules(repo, copy);
    commitTheCopy(copy);
    expect(fs.readFileSync(path.join(copy, 'README.md'), 'utf8')).toBe('a made-up repository, changed\n');
    expect(fs.existsSync(path.join(copy, 'new.txt'))).toBe(true);
    for (const left of ['ignored.txt', 'plan']) expect(fs.existsSync(path.join(copy, left)), left).toBe(false);
    expect(fs.lstatSync(path.join(copy, 'node_modules')).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(copy, 'node_modules', 'a-package', 'index.js'))).toBe(true);
    expect(git(copy, 'status', '--porcelain')).toBe('');
    expect(plantAPatch(copy, path.join(repo, 'plant.patch'))).toEqual(['src/rule.txt']);
    expect(fs.readFileSync(path.join(copy, 'src', 'rule.txt'), 'utf8')).toBe('the rule PLANT\n');
    expect(git(copy, 'status', '--porcelain')).toBe('');
    // the same patch again: git refuses it; an empty one changes nothing
    expect(() => plantAPatch(copy, path.join(repo, 'plant.patch'))).toThrow();
    fs.writeFileSync(path.join(tmp, 'empty.patch'), '');
    expect(() => plantAPatch(copy, path.join(tmp, 'empty.patch'))).toThrow();
  });

  test('of a commit holds that commit, without what the working tree changed since', () => {
    const copy = path.join(tmp, 'copy-2');
    copyACommit(repo, 'HEAD', copy);
    expect(fs.readFileSync(path.join(copy, 'README.md'), 'utf8')).toBe('a made-up repository\n');
    expect(fs.existsSync(path.join(copy, 'new.txt'))).toBe(false);
    expect(fs.readdirSync(copy).filter((f) => f.endsWith('.tar'))).toEqual([]);
  });
});

describe('the planted-fault runner', () => {
  test('names the games and the reports a plant changes, in both sets, and the tests it turns red', () => {
    const here = path.join(tmp, 'results-plant');
    const o = whatAPlantChanges({
      repo,
      patch: path.join(repo, 'plant.patch'),
      sets: ['A', 'B'],
      tests: { files: ['tests/rule.test.ts'], all: false },
      here,
    });
    expect(o.files).toEqual(['src/rule.txt']);
    expect(o.sets.A?.games.map((g) => g.id)).toEqual(['bots-00']);
    expect(o.sets.A?.games[0]?.how).toMatch(/^from turn 1; /);
    expect(o.sets.B?.games).toEqual([{ id: 'bots-00', how: '1 statistics' }]);
    for (const set of ['A', 'B'] as const) {
      expect(o.sets[set]?.exit, set).toBe(1);
      expect(o.sets[set]?.reports, set).toEqual([
        { id: 'bots-00', how: 'from turn 1; realm 0; report sections: lastTurnLog (words)' },
      ]);
      expect(o.sets[set]?.notes, set).toEqual(['A leak check broke in 1 game(s), first in:']);
    }
    expect(o.tests).toEqual({ exit: 1, red: ['the rule holds (named)'] });
    expect(fs.readFileSync(path.join(here, 'set-A', 'balance.log'), 'utf8')).toContain('node_modules/a-package: true');
    expect(fs.existsSync(o.copy)).toBe(false);
    expect(describeOutcome(o).join('\n')).toContain('set B: 1 game(s) differ, 1 game(s) with a report that differs');
  });

  test('finds nothing when the patch leaves the game alone', () => {
    const o = whatAPlantChanges({
      repo,
      patch: path.join(repo, 'words.patch'),
      sets: ['A', 'B'],
      tests: { files: [], all: true },
      here: path.join(tmp, 'results-words'),
    });
    expect(o.files).toEqual(['README.md']);
    for (const set of ['A', 'B'] as const)
      expect(o.sets[set], set).toEqual({ exit: 0, games: [], reports: [], notes: [] });
    expect(o.tests).toEqual({ exit: 0, red: [] });
  });

  test("compares a set's games with its baselines: one missing differs, set B by its statistics alone", () => {
    const base = [game('bots-00', 'a', 1), game('bots-01', 'b', 2)];
    const run = [game('bots-00', 'other', 1), game('bots-01', 'b', 5), game('bots-02', 'c', 1)];
    expect(whatTheSetChanged('A', base, run, [], []).games).toEqual([
      { id: 'bots-00', how: `from turn 1; ${TURN_COLUMNS[0]}` },
      { id: 'bots-01', how: '1 statistics' },
      { id: 'bots-02', how: 'not in the baseline' },
    ]);
    expect(whatTheSetChanged('B', base, run, [], []).games.map((g) => g.id)).toEqual(['bots-01', 'bots-02']);
    expect(notesIn('Compared with x: 59 of 60 games identical.\n2 game(s) failed:\n  bots-03: Error')).toEqual([
      '2 game(s) failed:',
    ]);
  });
});
