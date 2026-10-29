// The matrix's coverage (tools/proof/the-matrixs-coverage.ts, npm run proof:coverage) and the list of the changed lines
// no game reaches (tools/proof/the-changed-lines-no-game-reaches.ts, npm run proof:unreached), on small made-up inputs:
// - a made-up engine file (TypeScript, one function called, one never, a `??` whose right the call never takes) is
//   turned into a script with its source map, run in a vm in a Node process V8's coverage watches (NODE_V8_COVERAGE),
//   and the tool's c8 step counts its lines: the never-called function's lines 0, the called one's above 0, the `??`
//   line "partly reached", the comments and blank lines left out;
// - a process's coverage file keeps only the engine's script, renamed to its file;
// - `git diff -U0`'s hunks become the lines changed (a hunk of one line, of several, a part that only takes lines out,
//   a file deleted), and those are sorted into not reached, partly reached, reached and no code;
// - the engine's bundle the coverage plays is tests/lib/engine.ts's (from its command line), code for code, its source
//   map naming src/'s files.
// Level 1 (unit): it runs the tools' functions on made-up files and one small Node process; no game is played. Static
// can't: it runs code.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { transformWithOxc } from 'vite';
import { ROOT } from '../../tools/build.ts';
import {
  changedLinesOf,
  describeUnreached,
  theChangedLinesNoGameReaches,
} from '../../tools/proof/the-changed-lines-no-game-reaches.ts';
import {
  linesFromV8Coverage,
  linesOf,
  summaryOf,
  theEnginesBundleWithItsSourceMap,
  theEnginesCoverageIn,
  THE_ENGINES_SCRIPT,
} from '../../tools/proof/the-matrixs-coverage.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kc-proof-coverage-test-')));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

// The made-up engine file: its line numbers are what the test reads.
const SOURCE = [
  '// A made-up engine file.', // 1
  'interface Shape { n: number }', // 2
  '', // 3
  'function called(x: number | null): number {', // 4
  '  const y = x ?? 7;', // 5
  '  return y + 1;', // 6
  '}', // 7
  '', // 8
  '/** Never called. */', // 9
  'function neverCalled(s: Shape): number {', // 10
  '  const doubled = s.n * 2;', // 11
  '  return doubled;', // 12
  '}', // 13
  '', // 14
].join('\n');

describe("the matrix's coverage counts each line of a made-up engine file as the games ran it", () => {
  test('a function never called is 0, a called one above 0, a `??` never taken partly, comments left out', async () => {
    const file = path.join(tmp, 'src', 'engine', 'made-up.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, SOURCE);
    const out = path.join(tmp, 'out');
    const v8Dir = path.join(out, 'v8');
    fs.mkdirSync(v8Dir, { recursive: true });
    const { code, map } = await transformWithOxc(SOURCE, file, { lang: 'ts', sourcemap: true });
    const bundle = path.join(out, THE_ENGINES_SCRIPT);
    fs.writeFileSync(bundle, `${code}\n//# sourceMappingURL=${THE_ENGINES_SCRIPT}.map\n`);
    fs.writeFileSync(`${bundle}.map`, JSON.stringify({ ...map, sources: [file], file: THE_ENGINES_SCRIPT }));
    // Run as tests/lib/engine.ts runs the bundle: a vm script named engine.js; only called(1), so `?? 7` never runs.
    const run = spawnSync(
      process.execPath,
      [
        '-e',
        `const vm=require('vm'),fs=require('fs');const c=vm.createContext({});
         new vm.Script(fs.readFileSync(${JSON.stringify(bundle)},'utf8'),{filename:${JSON.stringify(THE_ENGINES_SCRIPT)}}).runInContext(c);
         vm.runInContext('called(1); called(2);',c);`,
      ],
      { env: { ...process.env, NODE_V8_COVERAGE: v8Dir }, encoding: 'utf8' },
    );
    expect(run.stderr).toBe('');
    const files = await linesFromV8Coverage(v8Dir, bundle, out, tmp);
    expect(Object.keys(files)).toEqual(['src/engine/made-up.ts']);
    const { counts, partly } = files['src/engine/made-up.ts'] ?? { counts: {}, partly: [] };
    expect(counts['5']).toBe(2);
    expect(counts['6']).toBe(2);
    expect(counts['11']).toBe(0);
    expect(counts['12']).toBe(0);
    expect(partly).toEqual([5]);
    for (const noCode of ['1', '3', '8', '9', '14']) expect(counts[noCode], `line ${noCode}`).toBeUndefined();
    expect(fs.existsSync(path.join(out, 'report', 'index.html'))).toBe(true);
    expect(summaryOf(files)[0]).toMatch(/^src\/engine\/: \d+ of \d+ lines reached \(\d+\.\d%\), 1 of them in part$/);
  });

  test("a process's coverage file keeps only the engine's script, renamed to the file that holds it", () => {
    const fn = { functionName: '', ranges: [{ startOffset: 0, endOffset: 9, count: 1 }], isBlockCoverage: true };
    const v8 = {
      result: [
        { scriptId: '1', url: 'node:internal/x', functions: [fn] },
        { scriptId: '2', url: THE_ENGINES_SCRIPT, functions: [fn] },
        { scriptId: '3', url: 'file:///elsewhere/engine.js', functions: [fn] },
      ],
      'source-map-cache': {},
    };
    expect(theEnginesCoverageIn(v8, '/tmp/out/engine.js')).toEqual({
      result: [{ scriptId: '2', url: 'file:///tmp/out/engine.js', functions: [fn] }],
    });
    expect(theEnginesCoverageIn({ result: [v8.result[0]] }, '/tmp/out/engine.js')).toBeNull();
    expect(theEnginesCoverageIn({}, '/tmp/out/engine.js')).toBeNull();
  });

  test("istanbul's lines become counts on the lines with code, and the reached lines a block never run starts on", () => {
    const st = (line: number) => ({ start: { line }, end: { line } });
    const br = (from: number, to: number) => ({ loc: { start: { line: from }, end: { line: to } } });
    const files = linesOf(
      {
        '/r/src/views/v.ts': {
          statementMap: { 0: st(1), 1: st(2), 2: st(3), 3: st(4), 4: st(5) },
          s: { 0: 3, 1: 3, 2: 0, 3: 3, 4: 1 },
          // a block never run from line 2 to 3; one that ran; one never run on a line never run
          branchMap: { 0: br(2, 3), 1: br(4, 4), 2: br(3, 3) },
          b: { 0: [0], 1: [3], 2: [0] },
        },
        '/r/src/ui/u.ts': { statementMap: { 0: st(1) }, s: { 0: 0 }, branchMap: {}, b: {} },
      },
      '/r',
      () => 'a();\nif (b) {\n  c();\n}\n// a comment',
    );
    expect(files).toEqual({ 'src/views/v.ts': { counts: { 1: 3, 2: 3, 3: 0, 4: 3 }, partly: [2] } });
  });
});

describe('the changed lines no game reaches', () => {
  const DIFF = [
    'diff --git a/src/engine/a.ts b/src/engine/a.ts',
    'index 1111111..2222222 100644',
    '--- a/src/engine/a.ts',
    '+++ b/src/engine/a.ts',
    '@@ -3 +3 @@ function f() {',
    '-  return x || 1;',
    '+  return x ?? 1;',
    '@@ -10,2 +10,3 @@',
    '-  old();',
    '-  older();',
    '+  one();',
    '+  two();',
    '+  three();',
    '@@ -20,2 +20,0 @@',
    '-  gone();',
    '-  gone too();',
    'diff --git a/src/views/gone.ts b/src/views/gone.ts',
    'deleted file mode 100644',
    '--- a/src/views/gone.ts',
    '+++ /dev/null',
    '@@ -1,2 +0,0 @@',
    '-a',
    '-b',
    'diff --git a/src/views/b.ts b/src/views/b.ts',
    '--- a/src/views/b.ts',
    '+++ b/src/views/b.ts',
    '@@ -0,0 +1,2 @@',
    '+// new',
    '+x();',
    '',
  ].join('\n');

  test("git diff -U0's hunks become the new side's lines, and the parts that only take lines out", () => {
    expect(changedLinesOf(DIFF)).toEqual({
      lines: { 'src/engine/a.ts': [3, 10, 11, 12], 'src/views/b.ts': [1, 2] },
      takenOut: { 'src/engine/a.ts': [20] },
    });
  });

  test('each changed line with code is not reached, partly reached or reached; the rest is no code', () => {
    const texts: Record<string, string> = {
      'src/engine/a.ts': Array.from({ length: 12 }, (_, i) => `line ${String(i + 1)}`).join('\n'),
      'src/views/b.ts': '// new\nx();',
    };
    const u = theChangedLinesNoGameReaches(
      {
        lines: { ...changedLinesOf(DIFF).lines, 'src/views/c.ts': [1], 'src/ui/d.ts': [1] },
        takenOut: { 'src/engine/a.ts': [20], 'src/ui/d.ts': [4] },
      },
      {
        'src/engine/a.ts': { counts: { 3: 5, 10: 0, 11: 4, 12: 4 }, partly: [3] },
        'src/views/b.ts': { counts: { 2: 1 }, partly: [] },
      },
      (file) => texts[file] ?? '',
    );
    expect(u).toEqual({
      notReached: [{ file: 'src/engine/a.ts', line: 10, text: 'line 10' }],
      partlyReached: [{ file: 'src/engine/a.ts', line: 3, text: 'line 3' }],
      reached: 3,
      noCode: 1,
      notInTheCoverage: ['src/views/c.ts'],
      takenOut: [{ file: 'src/engine/a.ts', after: 20 }],
    });
    const printed = describeUnreached(u, 'main').join('\n');
    expect(printed).toContain('1 not reached, 1 partly reached, 3 reached (and 1 with no code)');
    expect(printed).toContain('  src/engine/a.ts:10  line 10');
    expect(printed).toContain('  src/engine/a.ts: after line 20');
  });
});

describe("the engine's bundle the coverage plays", () => {
  test(
    "is tests/lib/engine.ts's, code for code, and its source map names src/'s own files",
    { ...timeLimitForTheWork({ siteBuilds: 2 }) },
    async () => {
      const mine = await theEnginesBundleWithItsSourceMap();
      // tests/lib/engine.ts's own bundle, from its command line (as it builds a copy's), so this test isn't one more
      // on the engine's vm loader (the ratchet's vmLoaderTests)
      const theTests = execFileSync(
        process.execPath,
        [
          '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
          path.join(ROOT, 'tests', 'lib', 'engine.ts'),
          '--bundle',
          path.join(ROOT, 'src'),
        ],
        { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
      );
      expect(mine.code === theTests, "the coverage's bundle isn't tests/lib/engine.ts's").toBe(true);
      const src = path.join(ROOT, 'src') + path.sep;
      const outside = mine.map.sources.filter(
        (s) => !s.includes(`${path.sep}node_modules${path.sep}`) && (!s.startsWith(src) || !fs.existsSync(s)),
      );
      expect(outside).toEqual([]);
      expect(mine.map.sources).toContain(path.join(ROOT, 'src', 'engine', 'run-turn.ts'));
    },
  );
});
