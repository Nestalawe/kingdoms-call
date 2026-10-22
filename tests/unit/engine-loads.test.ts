// The engine stands alone (plan P1-18c): tests/lib/engine.ts loads the data file and every file under src/engine/ and
// src/views/ in a bare Node vm, with no window, document, sb or crypto, and the turn's function is there.
// - It loads, and resolveTurn is a function in it, but not runTurn, the turn's shell in src/ui/gm/ (P1-18d); the dice
//   are seeded from the seed given, not from crypto.
// - The context is bare: none of the page's or the browser's names are in it.
// - A file that reaches the screen or the database as it loads stops the loader (a copy of src/ with one planted).
// - The engine's modules, imported directly with the whole engine loaded (tests/lib/the-whole-engine.ts, plan P1-14a),
//   hold what the bundle holds: every export of the data file, src/engine/ and src/views/ is the same name's value in
//   the vm (deeply; a Set or a Map by its kind, though the two are made in different realms; a function by being one).
//   While tests reach the engine both ways, this keeps the two the same: it goes when no test is left on the vm loader.
// Level 1 (unit): the engine's files run on their own, with no page around them; nothing calls into the engine here
// (unit/engine-purity.test.ts runs a turn).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { afterAll, describe, expect, test } from 'vitest';
import { seededRandom } from '../lib/boot.js';
import { DATA_FILE, loadEngine } from '../lib/engine.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';
import { ROOT } from '../../tools/build.ts';

const typeOf = (engine: vm.Context, name: string) => vm.runInContext(`typeof ${name}`, engine) as string;

describe('the engine loads in a bare vm', () => {
  const engine = loadEngine({ seed: 12345 });

  test('resolveTurn is a function in it, and the shell runTurn is not', () => {
    expect(typeOf(engine, 'resolveTurn')).toBe('function');
    expect(typeOf(engine, 'runTurn')).toBe('undefined');
  });

  test("its dice are the seed's", () => {
    const next = seededRandom(12345);
    const page = vm.runInContext('[kcRng(), kcRng(), kcRng()]', engine) as number[];
    expect(page).toEqual([next(), next(), next()]);
  });

  test("it has none of the page's or the browser's names", () => {
    const names = ['window', 'document', 'sb', 'supabase', 'crypto', 'currentUser', 'currentGame', 'kcHtml'];
    expect(names.filter((n) => typeOf(engine, n) !== 'undefined')).toEqual([]);
  });
});

describe('a file that reaches the screen or the database as it loads stops the loader', () => {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-engine-'));
  afterAll(() => {
    fs.rmSync(copy, { recursive: true, force: true });
  });
  fs.cpSync(path.join(ROOT, 'src'), copy, { recursive: true });
  const names = path.join(copy, 'engine', 'names.ts');
  const original = fs.readFileSync(names, 'utf8');

  test.each([
    ['document', 'document.title;'],
    ['sb', "sb.from('games');"],
    ['window', 'window.kcSeen=true;'],
  ])('planted %s', (name, line) => {
    fs.writeFileSync(names, `${original}${line}\n`);
    expect(() => loadEngine({ seed: 1, src: copy })).toThrow(`${name} is not defined`);
  });
});

describe("the engine's modules hold what its bundle holds", () => {
  const SRC = path.join(ROOT, 'src');
  /** A value in a form two realms can compare: a function as 'a function', a Set or a Map by its kind (instanceof
   *  doesn't cross from the vm's realm to this one), an object by its own keys in order, a value seen before (a
   *  cycle) as such. */
  const comparable = (value: unknown, seen = new Set<unknown>()): unknown => {
    if (typeof value === 'function') return 'a function';
    if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return 'seen before';
    seen.add(value);
    const kind = Object.prototype.toString.call(value);
    if (kind === '[object Map]')
      return {
        map: [...(value as Map<unknown, unknown>).entries()].map(([k, v]) => [
          comparable(k, seen),
          comparable(v, seen),
        ]),
      };
    if (kind === '[object Set]') return { set: [...(value as Set<unknown>)].map((v) => comparable(v, seen)) };
    if (Array.isArray(value)) return value.map((v) => comparable(v, seen));
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((k) => [k, comparable(record[k], seen)]),
    );
  };
  const files = [
    DATA_FILE,
    ...['engine', 'views'].flatMap((dir) =>
      fs
        .readdirSync(path.join(SRC, dir), { recursive: true })
        .map(String)
        .filter((f) => f.endsWith('.ts'))
        .sort()
        .map((f) => `${dir}/${f}`),
    ),
  ];

  test(
    'every export of the data file, src/engine/ and src/views/ is the same in the modules as in the bundle',
    timeLimitForTheWork({ everyFileReads: 1 }),
    async () => {
      await import('../lib/the-whole-engine.ts');
      const engine = loadEngine({ seed: 1 });
      const differ: string[] = [];
      let compared = 0;
      for (const file of files) {
        const exports = (await import(path.join(SRC, file))) as Record<string, unknown>;
        for (const [name, value] of Object.entries(exports)) {
          compared++;
          const there: unknown = vm.runInContext(`typeof ${name}==='undefined'?'(not in the bundle)':${name}`, engine);
          if (JSON.stringify(comparable(value)) !== JSON.stringify(comparable(there))) differ.push(`${file}: ${name}`);
        }
      }
      expect(compared, 'the exports compared').toBeGreaterThan(1000);
      expect(differ).toEqual([]);
    },
  );
});
