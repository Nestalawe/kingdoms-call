// The world proof (tools/proof/the-worlds-making-compared.ts, npm run proof:worlds), its stage table
// (the-worlds-makings-stages.ts) and its worker (the-worlds-making-worker.ts):
// - a draw's stage is read from its call stack: the innermost frame of a stage's own function, or else generateNewGame's
//   frame between two anchors; a frame outside the side's src/ is passed over;
// - a stage the anchored file holds by neither anchor nor function, or an anchor on two lines, stops the proof, and
//   every stage of the table is found in src/ as it is now, in order;
// - two sides' worlds differ on the hash alone, on one stage's dice alone (the same total), on the words, or on a throw
//   (both throwing alike is the same);
// - the cases: every map size and sea share for each seed and the undersized map; the mixes hold every creed, Divine
//   and Undead once each, and a naval king;
// - one world made from this tree in the worker's own process: every draw is placed in a stage, the bots' apart.
// Level 1 (unit): it runs the tool's functions on made-up frames and worlds, and the worker on one small world. Static
// can't: it runs code and a process.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  compareTheWorlds,
  THE_MAP_SIZES,
  THE_MIXES,
  THE_SEA_SHARES,
  theCases,
  whatDiffers,
} from '../../tools/proof/the-worlds-making-compared.ts';
import type { AWorldCase, AWorldMade } from '../../tools/proof/the-worlds-making-worker.ts';
import {
  NO_STAGE,
  THE_ANCHORED_FUNCTION,
  THE_BOTS_REALMS,
  THE_WORLDS_MAKINGS_STAGES,
  theStageOfADraw,
  theStagesOfASide,
  theStagesOfTheSideAt,
} from '../../tools/proof/the-worlds-makings-stages.ts';

const SRC = path.join(ROOT, 'src');
const ANCHORED = path.join(ROOT, THE_ANCHORED_FUNCTION.file);

describe("a draw's stage", () => {
  const text = ['export function generateNewGame(', '  // A', '  x();', '  // B', '  y();'].join('\n');
  const stages = [
    { stage: 'S0', what: '', anchor: 'export function generateNewGame(' },
    { stage: 'S1', what: '', anchor: '// A' },
    { stage: 'S2', what: '', anchor: '// B', fn: 'theSecondStage' },
  ];
  const side = theStagesOfASide(text, stages);
  const frame = (functionName: string, scriptName: string, lineNumber: number) => ({
    functionName,
    scriptName,
    lineNumber,
  });

  test("generateNewGame's line falls between two anchors; a helper's frame is passed over", () => {
    expect(side.starts).toEqual([
      { stage: 'S0', line: 1 },
      { stage: 'S1', line: 2 },
      { stage: 'S2', line: 4 },
    ]);
    const helper = frame('rP', path.join(SRC, 'engine/dice-helpers.ts'), 9);
    expect(theStageOfADraw([helper, frame('generateNewGame', ANCHORED, 3)], side, SRC)).toBe('S1');
    expect(theStageOfADraw([helper, frame('generateNewGame', ANCHORED, 5)], side, SRC)).toBe('S2');
    expect(theStageOfADraw([frame('generateNewGame', ANCHORED, 1)], side, SRC)).toBe('S0');
  });

  test("the innermost frame of a stage's own function wins, outside src/ nothing counts", () => {
    const own = frame('Module.theSecondStage', path.join(SRC, 'engine/world/s2.ts'), 40);
    expect(theStageOfADraw([own, frame('generateNewGame', ANCHORED, 3)], side, SRC)).toBe('S2');
    const elsewhere = frame('theSecondStage', path.join(ROOT, 'tools/a-copy.ts'), 40);
    expect(theStageOfADraw([elsewhere], side, SRC)).toBe(NO_STAGE);
    expect(theStageOfADraw([frame('generateNewGame', path.join(SRC, 'other.ts'), 3)], side, SRC)).toBe(NO_STAGE);
  });

  test('a stage found by neither anchor nor function, or an anchor on two lines, stops the proof', () => {
    expect(() => theStagesOfASide(text, [{ stage: 'S9', what: '', anchor: '// gone' }])).toThrow(
      /S9's anchor "\/\/ gone" isn't in src\/engine\/world\/generate\.ts/,
    );
    expect(theStagesOfASide(text, [{ stage: 'S9', what: '', anchor: '// gone', fn: 'theNinth' }]).byFunction).toEqual(
      new Map([['theNinth', 'S9']]),
    );
    expect(() => theStagesOfASide(`${text}\n// A`, stages)).toThrow(/S1's anchor "\/\/ A" is on 2 lines/);
  });

  test("every stage of the table is found in this tree's src/, in its order", () => {
    const here = theStagesOfTheSideAt(SRC);
    const found = new Set([...here.starts.map((s) => s.stage), ...here.byFunction.values()]);
    expect(THE_WORLDS_MAKINGS_STAGES.filter((s) => !found.has(s.stage)).map((s) => s.stage)).toEqual([]);
    const order = THE_WORLDS_MAKINGS_STAGES.map((s) => s.stage).filter((s) => here.starts.some((t) => t.stage === s));
    expect(here.starts.map((s) => s.stage)).toEqual(order);
  });
});

describe('two sides compared', () => {
  const made = (over: Partial<Extract<AWorldMade, { hash: string }>> = {}): AWorldMade => ({
    hash: 'a'.repeat(64),
    draws: 10,
    byStage: { bots: 2, S1: 3, S3: 5 },
    said: [],
    ...over,
  });

  test('the hash alone, one stage alone with the same total, the words, a throw', () => {
    expect(whatDiffers(made(), made())).toEqual([]);
    expect(whatDiffers(made(), made({ hash: 'b'.repeat(64) }))).toEqual(['the world (aaaaaaaaaaaa → bbbbbbbbbbbb)']);
    expect(whatDiffers(made(), made({ byStage: { bots: 2, S1: 4, S3: 4 } }))).toEqual([
      "S1's dice (3 → 4)",
      "S3's dice (5 → 4)",
    ]);
    expect(whatDiffers(made(), made({ draws: 11, byStage: { bots: 2, S1: 3, S3: 5, S13: 1 } }))).toEqual([
      'the dice in all (10 → 11)',
      "S13's dice (0 → 1)",
    ]);
    expect(whatDiffers(made(), made({ said: ['warn: a map too small'] }))).toEqual(['the words (0 lines → 1)']);
    expect(whatDiffers({ threw: 'x' }, { threw: 'x' })).toEqual([]);
    expect(whatDiffers(made(), { threw: 'x' })).toEqual(['the base made its world, the branch threw "x"']);
  });

  test('the cases that differ are named, a case one side lacks among them', () => {
    const cases = theCases(1).slice(0, 3);
    const keys = cases.map((c) => c.key);
    const base = new Map(keys.map((k) => [k, made()]));
    const branch = new Map([
      [keys[0] ?? '', made()],
      [keys[1] ?? '', made({ hash: 'c'.repeat(64) })],
    ]);
    const result = compareTheWorlds(cases, base, branch);
    expect(result.same).toBe(1);
    expect(result.differ.map((d) => d.key)).toEqual([keys[1], keys[2]]);
    expect(result.differ[1]?.what).toEqual(['the base made its world, the branch threw "not made"']);
  });
});

describe('the cases', () => {
  test('every map size and sea share for each seed, and the undersized map', () => {
    const cases = theCases(40);
    expect(cases).toHaveLength(40 * (THE_MAP_SIZES.length * THE_SEA_SHARES.length + 1));
    expect(new Set(cases.map((c) => c.key)).size).toBe(cases.length);
    expect(THE_MAP_SIZES.map((m) => m.size)).toEqual(['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']);
    const undersized = cases.filter((c) => c.realms === 5 && c.cols * c.rows === 8 * 7);
    expect(undersized.map((c) => c.seed)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });

  test('the mixes hold every creed and a naval king, Divine and Undead once each', () => {
    const creeds = THE_MIXES.flatMap((m) => m.humans.map((h) => h.alignment));
    expect(new Set(creeds)).toEqual(new Set(['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead']));
    const once = (m: (typeof THE_MIXES)[number]) =>
      m.humans.filter((h) => h.alignment === 'Divine' || h.alignment === 'Undead').length < 2;
    expect(THE_MIXES.filter((m) => !once(m)).map((m) => m.mix)).toEqual([]);
    expect(THE_MIXES.filter((m) => m.humans.length && !m.humans.some((h) => h.naval)).map((m) => m.mix)).toEqual([]);
  });
});

test("one world made from this tree: every draw is placed in a stage, the bots' apart", () => {
  const c: AWorldCase = {
    key: 'one',
    seed: 3,
    cols: 8,
    rows: 5,
    seaPct: 35,
    realms: 2,
    humans: [{ race: 'Human', alignment: 'Pagan', naval: true }],
  };
  const out = execFileSync(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      path.join(ROOT, 'tools/proof/the-worlds-making-worker.ts'),
      ROOT,
      JSON.stringify(c),
    ],
    { encoding: 'utf8' },
  );
  const made = JSON.parse(out.trim().split('\n').pop() ?? '') as AWorldMade;
  if ('threw' in made) throw new Error(`the worker threw: ${made.threw}`);
  const { hash, said, draws, byStage } = made;
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  expect(said).toEqual([]);
  expect(Object.keys(byStage)).not.toContain(NO_STAGE);
  expect(byStage[THE_BOTS_REALMS], "the bot's realm drew its dice").toBeGreaterThan(0);
  expect(byStage['S16'], "the neutral heroes' dice").toBeGreaterThan(0);
  expect(Object.values(byStage).reduce((a, b) => a + b, 0)).toBe(draws);
  expect(fs.existsSync(ANCHORED)).toBe(true);
});
