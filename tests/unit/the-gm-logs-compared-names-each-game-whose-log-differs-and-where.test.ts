// The GM-log comparison (tools/proof/the-gm-logs-compared.ts, npm run proof:gm-logs) and its workers
// (the-gm-logs-worker.ts), on two made-up copies of the repository in a temporary folder, each with a harness of its
// own under the names the real one has (tools/balance/matrix.ts, tests/lib/matrix-game.ts, scenario-in-the-vm.ts and
// engine.ts): a "game" is two turns of one line each, from the copy's src/; the second copy writes one word otherwise
// in one game (set A's bots-03).
// - Every game of both sets is played from each copy, in worker processes, each copy with its own engine's bundle; each
//   game's log is one line an entry (`t<turn> <entry as JSON>`), kept in a file of its own.
// - Compared byte for byte: 119 of 120 the same, and bots-03 named with its first line that differs, cut to where
//   the two part; a game one side lacks or failed on differs.
// Level 1 (unit): it runs the comparison and its workers on made-up copies; no game is played. Static can't: it runs
// code and processes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import {
  compareTheGmLogs,
  describeTheComparison,
  theFirstLineThatDiffers,
  theGmLogsOfASide,
  type ASidesLog,
} from '../../tools/proof/the-gm-logs-compared.ts';
import { whereTwoTextsPart } from '../../tools/proof/where-two-texts-part.ts';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kc-proof-gm-logs-test-')));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** A made-up copy: its harness plays two turns a game, one line a turn, in the words its src/ holds. */
function aMadeUpCopy(name: string, wordsFor: Record<number, string>): string {
  const side = path.join(tmp, name);
  const files: Record<string, string> = {
    'package.json': '{ "type": "module" }',
    'src/words.json': JSON.stringify(wordsFor),
    'tools/balance/matrix.ts': 'export const MAX_TURNS = 5;\n',
    'tests/lib/matrix-game.ts': `export const PAGE_DRAWS_AS_IT_LOADS = 1;
export const newWorldOf = (_engine, spec) => JSON.stringify({ turn: 1, id: spec.id });
export const slotRowsJsonOf = () => '[]';
export const stampedAsTheShellSaves = (json) => json;
`,
    'tests/lib/scenario-in-the-vm.ts': `import fs from 'node:fs';
import path from 'node:path';
export function scenarioInTheVm({ seed, src }) {
  const words = JSON.parse(fs.readFileSync(path.join(src, 'words.json'), 'utf8'));
  let draws = 0;
  return {
    engine: {},
    W: { eval: () => { draws++; return 0; } },
    reportEveryRealm() {},
    play(state) {
      const s = JSON.parse(state);
      // each copy plays on its own engine's bundle
      if (process.env.KC_ENGINE_BUNDLE !== path.join(path.dirname(src), 'tests', 'lib', 'bundle.js'))
        throw new Error('not the bundle of this copy: ' + process.env.KC_ENGINE_BUNDLE);
      const text = 'Realm0 pays 3g. ' + (words[seed] ?? 'Treasury') + ': 18g remaining.';
      return { S2: { turn: s.turn + 1, gameOver: s.turn >= 2 }, log: [{ text, turn: s.turn, draws }] };
    },
  };
}
`,
    'tests/lib/engine.ts': `import path from 'node:path';
process.stdout.write(path.join(import.meta.dirname, 'bundle.js'));
`,
  };
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(side, f)), { recursive: true });
    fs.writeFileSync(path.join(side, f), text);
  }
  return side;
}

describe('the GM-log comparison', () => {
  test('plays every game of both sets from each copy and names the one game whose log differs, and where', async () => {
    const base = aMadeUpCopy('base', {});
    const branch = aMadeUpCopy('branch', { 1003: 'Coffers' });
    const out = path.join(tmp, 'logs');
    const [a, b] = await Promise.all([
      theGmLogsOfASide(base, ['A', 'B'], 2, path.join(out, 'base')),
      theGmLogsOfASide(branch, ['A', 'B'], 2, path.join(out, 'branch')),
    ]);
    expect(a.size).toBe(120);
    expect(b.size).toBe(120);
    const log = fs.readFileSync(path.join(out, 'base', 'A-bots-00.log'), 'utf8');
    expect(log).toBe(
      [
        't1 {"text":"Realm0 pays 3g. Treasury: 18g remaining.","turn":1,"draws":1}',
        't2 {"text":"Realm0 pays 3g. Treasury: 18g remaining.","turn":2,"draws":1}',
      ].join('\n'),
    );
    const result = compareTheGmLogs(a, b, (file) => fs.readFileSync(file, 'utf8'));
    expect(result.same).toBe(119);
    expect(result.differ).toEqual([
      {
        key: 'A/bots-03',
        lines: [2, 2],
        first: {
          line: 1,
          base: 't1 {"text":"Realm0 pays 3g. Treasury: 18g remaining.","turn":1,"draws":1}',
          branch: 't1 {"text":"Realm0 pays 3g. Coffers: 18g remaining.","turn":1,"draws":1}',
        },
      },
    ]);
    const printed = describeTheComparison(result, 'main').join('\n');
    expect(printed).toContain('119 of 120 games byte-identical');
    expect(printed).toContain('first at line 1, character 29:');
    expect(printed).toContain('branch: t1 {"text":"Realm0 pays 3g. Coffers: 18g');
  });

  test('a game one side lacks, or failed on, differs; the first line that differs is the first that parts', () => {
    const log = (hash: string): ASidesLog => ({ hash, lines: 3, file: hash });
    const result = compareTheGmLogs(
      new Map<string, ASidesLog>([
        ['A/x', log('same')],
        ['A/y', log('one')],
        ['A/z', log('z')],
        ['B/w', { error: 'it threw' }],
      ]),
      new Map<string, ASidesLog>([
        ['A/x', log('same')],
        ['A/y', log('two')],
        ['B/w', log('w')],
      ]),
      (file) => ({ one: 'a\nb\nc', two: 'a\nb\nc\nd' })[file] ?? '',
    );
    expect(result.same).toBe(1);
    expect(result.differ).toEqual([
      { key: 'A/y', lines: [3, 3], first: { line: 4, base: '', branch: 'd' } },
      { key: 'A/z', lines: [3, 0], first: null, error: 'not played on the branch' },
      { key: 'B/w', lines: [0, 3], first: null, error: 'the base failed: it threw' },
    ]);
    expect(theFirstLineThatDiffers('a\nb', 'a\nb')).toBeNull();
    expect(theFirstLineThatDiffers('a\nb\nc', 'a\nB\nc')).toEqual({ line: 2, base: 'b', branch: 'B' });
  });

  test('two long lines are shown from a little before where they part', () => {
    const a = 'x'.repeat(500) + 'Treasury' + 'y'.repeat(500);
    const b = 'x'.repeat(500) + 'Coffers' + 'y'.repeat(500);
    const part = whereTwoTextsPart(a, b);
    expect(part?.at).toBe(500);
    expect(part?.a).toBe('…' + 'x'.repeat(40) + 'Treasury' + 'y'.repeat(112) + '…');
    expect(part?.b.startsWith('…' + 'x'.repeat(40) + 'Coffers')).toBe(true);
    expect(whereTwoTextsPart('same', 'same')).toBeNull();
    expect(whereTwoTextsPart('ab', 'ac')).toEqual({ at: 1, a: 'ab', b: 'ac' });
  });
});
