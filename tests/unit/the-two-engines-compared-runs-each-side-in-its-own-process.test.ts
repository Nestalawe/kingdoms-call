// The two-engine comparison's frame (tools/proof/the-two-engines-compared.ts, npm run proof:two-engines; its side,
// the-two-engines-side.ts; a row's cases, the-two-engines-cases.ts), on two made-up src/ folders and a made-up cases
// module in a temporary folder:
// - each side runs in a process of its own (neither this one), makes the cases for its own src/, and runs each with its
//   own dice and with each seeded dice stream;
// - run by run, it names the runs whose lines differ (and the first line that does, cut to where the two part), whose
//   world after differs, that threw on one side or threw otherwise, and that one side never ran; runs that threw alike
//   on both sides are counted, not a difference;
// - withADiceStream gives a body the stream's dice and puts the engine's dice back after, a throw too.
// Level 1 (unit): it runs the frame on made-up cases in two small processes; no game is played. Static can't: it runs
// code and processes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { afterAll, describe, expect, test } from 'vitest';
import { withADiceStream } from '../../tools/proof/the-two-engines-cases.ts';
import { compareTwoEngines, describeTheTwoEngines } from '../../tools/proof/the-two-engines-compared.ts';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kc-proof-two-engines-test-')));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const CASES = `import fs from 'node:fs';
import path from 'node:path';
export default ({ src }) => {
  const v = JSON.parse(fs.readFileSync(path.join(src, 'value.json'), 'utf8'));
  return [
    { name: 'the same', run: (dice) => ({ lines: [{ text: 'a line', dice }], world: { n: 1, dice } }) },
    { name: 'words differ', run: () => ({ lines: [{ text: 'first' }, { text: 'Realm0 pays 3g. ' + v.words + ': 18g.' }] }) },
    { name: 'the world differs', run: () => ({ lines: [{ text: 'same' }], world: { n: v.n } }) },
    { name: 'throws alike', run: () => { throw new Error('staged wrong'); } },
    { name: 'throws on one side', run: () => { if (v.throws) throw new Error('only here'); return { lines: [] }; } },
    ...(v.extra ? [{ name: 'only on the branch', run: () => ({ lines: [] }) }] : []),
  ];
};
`;

function aSrc(name: string, value: Record<string, unknown>): string {
  const src = path.join(tmp, name, 'src');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'value.json'), JSON.stringify(value));
  return src;
}

describe('the two-engine comparison', () => {
  test('runs each side in its own process on its own src/, and names every run that differs', async () => {
    const cases = path.join(tmp, 'cases.mts');
    fs.writeFileSync(cases, CASES);
    const r = await compareTwoEngines({
      base: aSrc('base', { words: 'Treasury', n: 1 }),
      branch: aSrc('branch', { words: 'Coffers', n: 2, throws: true, extra: true }),
      cases,
      streams: 2,
    });
    expect(r.pids[0]).not.toBe(r.pids[1]);
    expect(r.pids).not.toContain(process.pid);
    expect(r.runs).toBe(15);
    expect(r.threwAlike).toBe(3);
    expect(r.lines).toBe(12);
    const dice = [null, 900, 901];
    expect(r.differ).toEqual([
      ...dice.map((d) => ({
        name: 'words differ',
        dice: d,
        what: 'lines (2 → 2), first at line 2: base {"text":"Realm0 pays 3g. Treasury: 18g."} | branch {"text":"Realm0 pays 3g. Coffers: 18g."}',
      })),
      ...dice.map((d) => ({ name: 'the world differs', dice: d, what: 'the world after' })),
      ...dice.map((d) => ({ name: 'throws on one side', dice: d, what: 'threw: base "", branch "Error: only here"' })),
      ...dice.map((d) => ({ name: 'only on the branch', dice: d, what: 'not run on the base' })),
    ]);
    const printed = describeTheTwoEngines(r, 'main').join('\n');
    expect(printed).toContain('15 runs, 12 lines; 12 differ; 3 threw alike on both sides.');
    expect(printed).toContain("  words differ (dice the case's own): lines (2 → 2)");
  });

  test("withADiceStream gives the body the stream's dice, and the engine's back after, a throw too", () => {
    const engine = vm.createContext({});
    vm.runInContext(
      `var _next = () => 0.5;
       function kcRng() { return _next(); }
       kcRng.use = (fn) => { const was = _next; _next = fn; return was; };
       function kcRngStream(seed) { return () => seed / 1000; }`,
      engine,
    );
    const roll = () => vm.runInContext('kcRng()', engine) as number;
    expect(withADiceStream(engine, 900, roll)).toBe(0.9);
    expect(roll()).toBe(0.5);
    expect(withADiceStream(engine, null, roll)).toBe(0.5);
    expect(() =>
      withADiceStream(engine, 901, () => {
        throw new Error('staged wrong');
      }),
    ).toThrow('staged wrong');
    expect(roll()).toBe(0.5);
  });
});
