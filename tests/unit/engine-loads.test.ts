// The engine stands alone (plan P1-18c): tests/lib/engine.ts loads the data file and every file under src/engine/ and
// src/views/ in a bare Node vm, with no window, document, sb or crypto, and the turn's function is there.
// - It loads, and runTurn is a function in it; the dice are seeded from the seed given, not from crypto.
// - The context is bare: none of the page's or the browser's names are in it.
// - A file that reaches the screen or the database as it loads stops the loader (a copy of src/ with one planted).
// Level 1 (unit): the engine's files run on their own, with no page around them; nothing calls into the engine yet
// (P1-18d's purity test runs a turn).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { afterAll, describe, expect, test } from 'vitest';
import { seededRandom } from '../lib/boot.js';
import { loadEngine } from '../lib/engine.ts';
import { ROOT } from '../../tools/build.ts';

const typeOf = (engine: vm.Context, name: string) => vm.runInContext(`typeof ${name}`, engine) as string;

describe('the engine loads in a bare vm', () => {
  const engine = loadEngine({ seed: 12345 });

  test('runTurn is a function in it', () => {
    expect(typeOf(engine, 'runTurn')).toBe('function');
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
  const names = path.join(copy, 'engine', 'names.js');
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
