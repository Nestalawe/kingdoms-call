// The runner of a row's planted faults (tools/proof/many-planted-faults-on-their-tests.ts, npm run proof:plants), on a
// made-up repository in a temporary folder whose `vitest` is a small Node script: it is red when the planted file holds
// RED, times out on SLOW, can't compile on BROKEN, never ends on HANG, and runs no test when its test file is missing.
// - each plant gets its verdict (red, GREEN, missing, broken, timed out), in the plants' order, from copies working
//   side by side; each plant's file is put back before the next plant in its copy, so a plant never sees another's
//   change; a run that never ends is stopped at the limit; the working tree is left as it was, and the copies removed;
// - the plants file: shared tests, a plant's own tests winning, and every fault named;
// - a plant's text replaced at the occurrence named, and the verdict read from Vitest's JSON report.
// Level 1 (unit): it runs the runner on a made-up repository and a small script; no real test runs. Static can't: it
// runs code and processes.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  planted,
  runThePlants,
  summaryOf,
  thePlantsIn,
  verdictOf,
  type APlant,
} from '../../tools/proof/many-planted-faults-on-their-tests.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kc-proof-plants-test-')));
const repo = path.join(tmp, 'repo');
const runsLog = path.join(tmp, 'runs.log');
const RULE = 'export const rule = 1;\nexport const other = 1;\n';
const before = process.env['KC_FAKE_VITEST_LOG'];
afterAll(() => {
  if (before === undefined) delete process.env['KC_FAKE_VITEST_LOG'];
  else process.env['KC_FAKE_VITEST_LOG'] = before;
  fs.rmSync(tmp, { recursive: true, force: true });
});
const write = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), text);
};

// The made-up `vitest run <files> --maxWorkers=N --reporter=json --outputFile.json=FILE`: a report in Vitest's shape.
const FAKE_VITEST = `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const out = args.find((a) => a.startsWith('--outputFile.json=')).slice('--outputFile.json='.length);
const files = args.filter((a) => a.startsWith('tests/') && fs.existsSync(a));
const src = fs.readFileSync('src/rule.js', 'utf8');
fs.appendFileSync(process.env.KC_FAKE_VITEST_LOG, process.cwd() + '\\n');
const report = (status, assertionResults, message) => ({ testResults: files.map((f) => ({
  name: path.join(process.cwd(), f), status, message, assertionResults })) });
const done = (r, code) => { fs.writeFileSync(out, JSON.stringify(r)); process.exit(code); };
const one = (status, failureMessages) => [{ fullName: 'the rule holds', status, failureMessages }];
if (src.includes('HANG')) setInterval(() => {}, 1000);
else if (!files.length) done({ testResults: [] }, 1);
else if (src.includes('BROKEN')) done(report('failed', [], 'Transform failed with 1 error:\\nsrc/rule.js:1:5: ERROR'), 1);
else if (src.includes('SLOW')) done(report('failed', one('failed', ['Error: Test timed out in 5000ms.\\nIf this is'])), 1);
else if (src.includes('RED')) done(report('failed', one('failed', ['AssertionError: expected 2 to be 1'])), 1);
else done(report('passed', one('passed', [])), 0);
`;

beforeAll(() => {
  write('src/rule.js', RULE);
  write('tests/rule.test.ts', '// the made-up test\n');
  write('package.json', JSON.stringify({ private: true }));
  write('.gitignore', 'node_modules/\n');
  write('node_modules/.bin/vitest', FAKE_VITEST);
  fs.chmodSync(path.join(repo, 'node_modules/.bin/vitest'), 0o755);
  execFileSync('git', ['init', '-q', repo]);
  process.env['KC_FAKE_VITEST_LOG'] = runsLog;
});

const plant = (name: string, old: string, replacement: string, extra: Partial<APlant> = {}): APlant => ({
  name,
  file: 'src/rule.js',
  old,
  new: replacement,
  occurrence: 0,
  tests: ['tests/rule.test.ts'],
  ...extra,
});

describe('the runner', () => {
  test(
    'gives each plant its verdict from copies side by side, each plant on its own, a run that never ends stopped, and the tree left as it was',
    timeLimitForTheWork({ toolRuns: 1 }),
    async () => {
      const plants = [
        plant('a guarded line', 'rule = 1', 'rule = 1 /* RED */'),
        plant('an unguarded line', 'other = 1', 'other = 2'),
        plant('a text not there', 'nowhere', 'x'),
        plant('the second occurrence', '= 1', '= 1 /* RED */', { occurrence: 1 }),
        plant('a third occurrence', '= 1', '= 2', { occurrence: 2 }),
        plant('a file not there', 'rule', 'x', { file: 'src/gone.js' }),
        plant('a plant that breaks the file', 'rule = 1', 'rule = BROKEN'),
        plant('only a time limit failed', 'rule = 1', 'rule = SLOW'),
        plant('a run that never ends', 'rule = 1', 'rule = HANG'),
        plant('the tests named are not there', 'rule = 1', 'rule = 2', { tests: ['tests/nothing.test.ts'] }),
        plant('another unguarded line', 'rule = 1', 'rule = 3'),
      ];
      const here = path.join(tmp, 'results');
      const heard: string[] = [];
      const { results, copies } = await runThePlants({
        repo,
        plants,
        here,
        jobs: 2,
        limitS: 2,
        onResult: (r) => heard.push(r.name),
      });
      expect(results.map((r) => [r.name, r.verdict])).toEqual([
        ['a guarded line', 'red'],
        ['an unguarded line', 'GREEN'],
        ['a text not there', 'missing'],
        ['the second occurrence', 'red'],
        ['a third occurrence', 'missing'],
        ['a file not there', 'missing'],
        ['a plant that breaks the file', 'broken'],
        ['only a time limit failed', 'timed out'],
        ['a run that never ends', 'timed out'],
        ['the tests named are not there', 'broken'],
        ['another unguarded line', 'GREEN'],
      ]);
      expect(results[0]?.red).toEqual(['the rule holds']);
      expect(results[8]?.note).toBe('stopped at the limit');
      expect(results[9]?.note).toMatch(/^no test ran/);
      expect([...heard].sort()).toEqual(plants.map((p) => p.name).sort());
      // two copies did the work, side by side; both are gone, and the working tree is as it was
      const cwds = new Set(fs.readFileSync(runsLog, 'utf8').trim().split('\n'));
      expect(copies).toHaveLength(2);
      // (by folder name: the system's temporary folder can be reached by two paths, /var and /private/var on macOS)
      expect([...cwds].map((c) => path.basename(c)).sort()).toEqual(copies.map((c) => path.basename(c)).sort());
      for (const copy of copies) expect(fs.existsSync(copy)).toBe(false);
      expect(fs.readFileSync(path.join(repo, 'src/rule.js'), 'utf8')).toBe(RULE);
      expect(fs.readdirSync(here).filter((f) => f.endsWith('.log'))).toHaveLength(8);
      expect(summaryOf(results).split('\n')[0]).toBe('red 2 of 11');
    },
  );
});

describe('the plants file', () => {
  test('takes shared tests, a plant’s own winning, and the first occurrence unless named', () => {
    const text = JSON.stringify({
      tests: ['tests/a.test.ts'],
      plants: [
        { name: 'one', file: 'src/a.ts', old: 'x', new: 'y' },
        { name: 'two', file: 'src/a.ts', old: 'x', new: 'z', occurrence: 2, tests: ['tests/b.test.ts'] },
      ],
    });
    expect(thePlantsIn(text)).toEqual([
      { name: 'one', file: 'src/a.ts', old: 'x', new: 'y', occurrence: 0, tests: ['tests/a.test.ts'] },
      { name: 'two', file: 'src/a.ts', old: 'x', new: 'z', occurrence: 2, tests: ['tests/b.test.ts'] },
    ]);
  });

  test('names every fault: no tests, a name twice, a file outside the repository, a plant that changes nothing', () => {
    const text = JSON.stringify([
      { name: 'one', file: 'src/a.ts', old: 'x', new: 'y' },
      { name: 'one', file: '../a.ts', old: 'x', new: 'x', tests: ['tests/a.test.ts'] },
    ]);
    expect(() => thePlantsIn(text)).toThrow(
      /one: no tests named[\s\S]*one: named twice[\s\S]*isn't inside the repository[\s\S]*its new text is its old text/,
    );
    expect(() => thePlantsIn('[]')).toThrow(/no plants/);
  });

  test('replaces the occurrence named, or none when the text is not there that many times', () => {
    expect(planted('a b a b a', 'a', 'X', 0)).toBe('X b a b a');
    expect(planted('a b a b a', 'a', 'X', 2)).toBe('a b a b X');
    expect(planted('a b a b a', 'a', 'X', 3)).toBeNull();
    expect(planted('a b', 'c', 'X', 0)).toBeNull();
  });
});

describe('the verdict from a run', () => {
  const file = (status: string, assertions: { status: string; failureMessages?: string[] }[], message?: string) =>
    JSON.stringify({
      testResults: [
        {
          name: '/copy/tests/a.test.ts',
          status,
          ...(message == null ? {} : { message }),
          assertionResults: assertions.map((a, i) => ({ fullName: `case ${String(i)}`, ...a })),
        },
      ],
    });
  test('red on a failed assertion, a time limit beside it noted; timed out when only limits failed', () => {
    const mixed = file('failed', [
      { status: 'failed', failureMessages: ['AssertionError: expected 1 to be 2'] },
      { status: 'failed', failureMessages: ['Error: Test timed out in 5000ms.'] },
    ]);
    expect(verdictOf(mixed, 1, false, '/copy')).toEqual({ verdict: 'red', red: ['case 0'], note: '1 timed out too' });
    const limits = file('failed', [{ status: 'failed', failureMessages: ['Error: Hook timed out in 10000ms.'] }]);
    expect(verdictOf(limits, 1, false, '/copy').verdict).toBe('timed out');
  });

  test('red when the file fails to load for another reason; broken when it does not compile or nothing reports', () => {
    expect(verdictOf(file('failed', [], 'Error: the rule threw at load'), 1, false, '/copy')).toEqual({
      verdict: 'red',
      red: ['tests/a.test.ts: Error: the rule threw at load'],
      note: '',
    });
    expect(verdictOf(file('failed', [], 'SyntaxError: Unexpected token'), 1, false, '/copy').verdict).toBe('broken');
    expect(verdictOf(null, 1, false, '/copy').verdict).toBe('broken');
    expect(verdictOf('not json', 1, false, '/copy').verdict).toBe('broken');
    expect(verdictOf(file('passed', [{ status: 'passed' }]), 1, false, '/copy')).toEqual({
      verdict: 'broken',
      red: [],
      note: 'exit 1 with every test passing: see its log',
    });
  });

  test('GREEN when every test passed; timed out when the runner stopped it', () => {
    expect(verdictOf(file('passed', [{ status: 'passed' }]), 0, false, '/copy').verdict).toBe('GREEN');
    expect(verdictOf(null, 1, true, '/copy')).toEqual({ verdict: 'timed out', red: [], note: 'stopped at the limit' });
  });
});
