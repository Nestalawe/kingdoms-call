// The battle proof (tools/proof/the-battles-compared-each-staged-battle-its-lines-its-world-and-its-dice-by-stage.ts,
// npm run proof:battles), its stage list (the-stages-of-the-two-battles-and-the-lines-that-open-them.ts) and its worker
// (one-staged-battle-fought-on-a-side-in-a-fresh-process.ts):
// - a draw's stage is read from its call stack: the innermost frame of a stage's own function, or else its battle's
//   frame between two anchors; a frame outside the side's src/ is passed over;
// - a stage its battle's file holds by neither anchor nor function, or an anchor on two lines, stops the proof, and
//   every stage of the list is found in src/ as it is now, in order;
// - two sides' battles differ on the lines, the world, the dice in all or one stage's dice, or a throw (both throwing
//   alike is the same), each named by its stream;
// - the grid: every ground, both battles, the defender led and leaderless, from land and from sea, every set of armies;
// - two cases fought from this tree twice give the same answer, every draw in a stage;
// - red on three faults planted in a copy of src/: an extra draw at the end of the battle between heroes' fortune
//   stage, a beaten side's death chance in one casualty band changed (no draw added), and two stages swapped (the
//   army spells and the archery of the battle between heroes, the nearest swap the code allows).
// Level 1 (unit): it runs the tool's functions on made-up frames and battles, and the worker on a few cases of this
// tree and of planted copies. Static can't: it runs code and processes.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  aSpreadOf,
  compareTheBattles,
  THE_DEFENDERS,
  THE_GROUNDS,
  theBattleCases,
  WHERE_THE_ATTACKER_COMES_FROM,
  whatDiffersInABattle,
  whatDiffersInACase,
} from '../../tools/proof/the-battles-compared-each-staged-battle-its-lines-its-world-and-its-dice-by-stage.ts';
import {
  type ABattleCase,
  type ABattleFought,
  type ACaseFought,
  THE_DICE_STREAMS,
  THE_SETS_OF_ARMIES,
} from '../../tools/proof/one-staged-battle-fought-on-a-side-in-a-fresh-process.ts';
import {
  NO_STAGE,
  THE_BATTLES,
  THE_BATTLES_STAGES,
  THE_TWO_BATTLES,
  theBattlesStagesOfASide,
  theBattlesStagesOfTheSideAt,
  theStageOfADraw,
} from '../../tools/proof/the-stages-of-the-two-battles-and-the-lines-that-open-them.ts';

const SRC = path.join(ROOT, 'src');
const WORKER = path.join(ROOT, 'tools/proof/one-staged-battle-fought-on-a-side-in-a-fresh-process.ts');

describe("a draw's stage", () => {
  const npc = ['export function combatVsNPC(', '  // A', '  x();', '  // B', '  y();'].join('\n');
  const pvp = ['export function combatVsChar(', '  // C', '  z();'].join('\n');
  const stages = [
    { battle: 'against the defenders', stage: 'N0', what: '', anchor: 'export function combatVsNPC(' },
    { battle: 'against the defenders', stage: 'N1', what: '', anchor: '// A' },
    { battle: 'against the defenders', stage: 'N2', what: '', anchor: '// B', fn: 'theSecondStage' },
    { battle: 'between heroes', stage: 'H0', what: '', anchor: 'export function combatVsChar(' },
    { battle: 'between heroes', stage: 'H1', what: '', anchor: '// C' },
  ] as const;
  const texts: Record<string, string> = {
    [THE_TWO_BATTLES['against the defenders'].file]: npc,
    [THE_TWO_BATTLES['between heroes'].file]: pvp,
  };
  const side = theBattlesStagesOfASide((f) => texts[f] ?? '', stages);
  const NPC_FILE = path.join(ROOT, THE_TWO_BATTLES['against the defenders'].file);
  const PVP_FILE = path.join(ROOT, THE_TWO_BATTLES['between heroes'].file);
  const frame = (functionName: string, scriptName: string, lineNumber: number) => ({
    functionName,
    scriptName,
    lineNumber,
  });

  test("each battle's line falls between two of its own anchors; a helper's frame is passed over", () => {
    expect(side.byBattle['against the defenders'].starts).toEqual([
      { stage: 'N0', line: 1 },
      { stage: 'N1', line: 2 },
      { stage: 'N2', line: 4 },
    ]);
    const helper = frame('battleFortune', path.join(SRC, 'engine/battle/fortune.ts'), 9);
    expect(theStageOfADraw([helper, frame('combatVsNPC', NPC_FILE, 3)], side, SRC)).toBe('N1');
    expect(theStageOfADraw([helper, frame('combatVsNPC', NPC_FILE, 5)], side, SRC)).toBe('N2');
    expect(theStageOfADraw([helper, frame('combatVsChar', PVP_FILE, 3)], side, SRC)).toBe('H1');
    expect(theStageOfADraw([frame('combatVsChar', PVP_FILE, 1)], side, SRC)).toBe('H0');
  });

  test("the innermost frame of a stage's own function wins, outside src/ nothing counts", () => {
    const own = frame('Module.theSecondStage', path.join(SRC, 'engine/battle/n2.ts'), 40);
    expect(theStageOfADraw([own, frame('combatVsNPC', NPC_FILE, 3)], side, SRC)).toBe('N2');
    const elsewhere = frame('theSecondStage', path.join(ROOT, 'tools/a-copy.ts'), 40);
    expect(theStageOfADraw([elsewhere], side, SRC)).toBe(NO_STAGE);
    expect(theStageOfADraw([frame('combatVsNPC', PVP_FILE, 3)], side, SRC)).toBe(NO_STAGE);
  });

  test('a stage found by neither anchor nor function, or an anchor on two lines, stops the proof', () => {
    const gone = [{ battle: 'between heroes', stage: 'H9', what: '', anchor: '// gone' }] as const;
    expect(() => theBattlesStagesOfASide((f) => texts[f] ?? '', gone)).toThrow(
      /H9's anchor "\/\/ gone" isn't in src\/engine\/battle\/battles-between-heroes\.ts/,
    );
    const moved = [{ ...gone[0], fn: 'theNinth' }];
    expect(theBattlesStagesOfASide((f) => texts[f] ?? '', moved).byFunction).toEqual(new Map([['theNinth', 'H9']]));
    const twice = (f: string) => `${texts[f] ?? ''}\n// A\n// C`;
    expect(() => theBattlesStagesOfASide(twice, stages)).toThrow(/N1's anchor "\/\/ A" is on 2 lines/);
  });

  test("every stage of the list is found in this tree's src/, in its order", () => {
    const here = theBattlesStagesOfTheSideAt(SRC);
    for (const b of THE_BATTLES) {
      const listed = THE_BATTLES_STAGES.filter((s) => s.battle === b).map((s) => s.stage);
      const found = new Set([...here.byBattle[b].starts.map((s) => s.stage), ...here.byFunction.values()]);
      expect(
        listed.filter((s) => !found.has(s)),
        `the stages of the battle ${b} not found`,
      ).toEqual([]);
      const anchored = here.byBattle[b].starts.map((s) => s.stage);
      expect(anchored, `the battle ${b}'s anchors in its order`).toEqual(listed.filter((s) => anchored.includes(s)));
    }
    expect(new Set(THE_BATTLES_STAGES.map((s) => s.stage)).size).toBe(THE_BATTLES_STAGES.length);
  });
});

describe('two sides compared', () => {
  const fought = (over: Partial<Extract<ABattleFought, { hash: string }>> = {}): ABattleFought => ({
    lines: ['⚔ Battle for Testmoor', 'The attackers win.'],
    hash: 'a'.repeat(64),
    draws: 10,
    byStage: { N0: 1, N9: 1, N12: 8 },
    ...over,
  });

  test('the lines, the world alone, one stage alone with the same total, a throw', () => {
    expect(whatDiffersInABattle(fought(), fought())).toEqual([]);
    expect(whatDiffersInABattle(fought(), fought({ lines: ['⚔ Battle for Testmoor', 'The defenders hold.'] }))).toEqual(
      ['the lines (2 → 2; line 2: "The attackers win." → "The defenders hold.")'],
    );
    expect(whatDiffersInABattle(fought(), fought({ lines: ['⚔ Battle for Testmoor'] }))).toEqual([
      'the lines (2 → 1; line 2: "The attackers win." → "")',
    ]);
    expect(whatDiffersInABattle(fought(), fought({ hash: 'b'.repeat(64) }))).toEqual([
      'the world (aaaaaaaaaaaa → bbbbbbbbbbbb)',
    ]);
    expect(whatDiffersInABattle(fought(), fought({ byStage: { N0: 1, N9: 2, N12: 7 } }))).toEqual([
      "N9's dice (1 → 2)",
      "N12's dice (8 → 7)",
    ]);
    expect(whatDiffersInABattle(fought(), fought({ draws: 11, byStage: { N0: 1, N9: 1, N12: 8, N4: 1 } }))).toEqual([
      'the dice in all (10 → 11)',
      "N4's dice (0 → 1)",
    ]);
    expect(whatDiffersInABattle({ threw: 'x' }, { threw: 'x' })).toEqual([]);
    expect(whatDiffersInABattle(fought(), { threw: 'x' })).toEqual(['the base fought, the branch threw "x"']);
  });

  test("a case's differences are named by their stream; the cases that differ are named, one a side lacks among them", () => {
    const aCase = (b: ABattleFought): ACaseFought => ({ byStream: { '900': fought(), '901': b } });
    expect(whatDiffersInACase(aCase(fought()), aCase(fought({ hash: 'c'.repeat(64) })))).toEqual([
      'stream 901: the world (aaaaaaaaaaaa → cccccccccccc)',
    ]);
    expect(whatDiffersInACase({ threw: 'no sea' }, { threw: 'no sea' })).toEqual([]);
    const cases = theBattleCases().slice(0, 3);
    const keys = cases.map((c) => c.key);
    const base = new Map(keys.map((k) => [k, aCase(fought())]));
    const branch = new Map([
      [keys[0] ?? '', aCase(fought())],
      [keys[1] ?? '', aCase(fought({ draws: 9 }))],
    ]);
    const result = compareTheBattles(cases, base, branch);
    expect(result.same).toBe(1);
    expect(result.differ.map((d) => d.key)).toEqual([keys[1], keys[2]]);
    expect(result.differ[1]?.what).toEqual(['the base staged it, the branch threw "not staged"']);
  });
});

describe('the grid', () => {
  test('every ground, both battles, the defender led and not, from land and sea, every set of armies', () => {
    const cases = theBattleCases();
    const sets = Object.keys(THE_SETS_OF_ARMIES);
    expect(cases).toHaveLength(THE_GROUNDS.length * THE_BATTLES.length * 2 * 2 * sets.length);
    expect(new Set(cases.map((c) => c.key)).size).toBe(cases.length);
    expect(THE_GROUNDS).toEqual(['plain', 'forest', 'mountain', 'desert', 'sea']);
    expect([THE_DEFENDERS, WHERE_THE_ATTACKER_COMES_FROM]).toEqual([
      ['led', 'leaderless'],
      ['land', 'sea'],
    ]);
    for (const named of ['fleets', 'flyers', 'beasts under a Druid short', 'skeletal companies', 'Monsters under Evil'])
      expect(sets, `the set "${named}"`).toContain(named);
    for (const named of ['missiles', 'Dwarven Guard', 'corsairs', 'whales'])
      expect(sets, `the set "${named}"`).toContain(named);
    expect(THE_DICE_STREAMS).toHaveLength(8);
    const spread = aSpreadOf(cases, 40);
    expect(spread).toHaveLength(40);
    expect(new Set(spread.map((c) => c.terrain)).size).toBe(THE_GROUNDS.length);
    expect(aSpreadOf(cases, undefined)).toHaveLength(cases.length);
  });
});

/** The case `c` fought from the copy at `root`, in the worker's own process. */
function aCaseFoughtAt(root: string, c: ABattleCase): Promise<ACaseFought> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', WORKER, root, JSON.stringify(c)],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        try {
          resolve(JSON.parse(stdout.trim().split('\n').pop() ?? '') as ACaseFought);
        } catch {
          reject(new Error(`the worker: ${error?.message ?? ''} ${stderr.slice(0, 500)}`));
        }
      },
    );
  });
}

/** A fault planted in a copy of src/: each text replaced once, in whichever file of src/engine/ holds it (so the plant
 *  follows a stage a split row moves; a text no file holds, or two hold, stops the test: update the plant). */
interface APlant {
  name: string;
  edits: { old: string; new: string }[];
}
const filesUnder = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]));

/** A copy of this tree's src/ and tests/lib/ (what a worker reads), node_modules linked, with `plant` made. */
function aPlantedCopy(plant: APlant): string {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-battles-plant-'));
  for (const dir of ['src', 'tests/lib']) fs.cpSync(path.join(ROOT, dir), path.join(copy, dir), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(copy, 'package.json'));
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(copy, 'node_modules'), 'dir');
  const files = filesUnder(path.join(copy, 'src/engine')).filter((f) => f.endsWith('.ts'));
  for (const e of plant.edits) {
    const holders = files.filter((f) => fs.readFileSync(f, 'utf8').split(e.old).length === 2);
    if (holders.length !== 1 || !holders[0])
      throw new Error(`${plant.name}: "${e.old.slice(0, 60)}" is in ${String(holders.length)} files, not one`);
    const text = fs.readFileSync(holders[0], 'utf8');
    fs.writeFileSync(
      holders[0],
      text.replace(e.old, () => e.new),
    );
  }
  return copy;
}

const ARMY_SPELLS = [
  '  applyArmyBattleSpells(atk, atkArmies, defArmies, narrative);',
  '  if (!_atkLA) applyArmyBattleSpells(def, defArmies, atkArmies, narrative);',
].join('\n');
const ARCHERY = [
  '  applyPreBattleArchery(atk, atkArmies, defArmies, atkArmies.length, narrative, true);',
  '  if (!_atkLA) applyPreBattleArchery(def, defArmies, atkArmies, defArmies.length, narrative, false);',
].join('\n');
const PLANTS: readonly APlant[] = [
  {
    name: "an extra draw at the end of the battle between heroes' fortune",
    edits: [{ old: '  // ── STAT BLOCK ── 2026-09-23b', new: '  kcRng();\n  // ── STAT BLOCK ── 2026-09-23b' }],
  },
  {
    name: "a beaten side's death chance in the clear band 0.18 made 0.9",
    edits: [
      {
        old: "slug: 'clear', max: 0.3, winDeath: 0.05, loseDeath: 0.18,",
        new: "slug: 'clear', max: 0.3, winDeath: 0.05, loseDeath: 0.9,",
      },
    ],
  },
  {
    name: 'the army spells and the archery of the battle between heroes swapped',
    edits: [
      { old: ARMY_SPELLS, new: '  // the army spells, moved' },
      { old: ARCHERY, new: ARMY_SPELLS },
      { old: '  // the army spells, moved', new: ARCHERY },
    ],
  },
];

/** The cases the plants are fought on: a battle between heroes with archers on both sides, and two battles against
 *  the defenders. */
const THE_PLANTS_CASES: readonly ABattleCase[] = [
  { key: 'h', battle: 'between heroes', terrain: 'plain', defender: 'led', from: 'land', armies: 'missiles' },
  {
    key: 'n',
    battle: 'against the defenders',
    terrain: 'forest',
    defender: 'leaderless',
    from: 'land',
    armies: 'foot',
  },
  {
    key: 'o',
    battle: 'against the defenders',
    terrain: 'plain',
    defender: 'led',
    from: 'land',
    armies: 'an outmatched attacker',
  },
];

test('this tree twice gives the same answer, every draw in a stage; red on each of three planted faults', async () => {
  const copies = PLANTS.map(aPlantedCopy);
  try {
    const fight = (root: string) => Promise.all(THE_PLANTS_CASES.map((c) => aCaseFoughtAt(root, c)));
    const [first, again, ...planted] = await Promise.all([fight(ROOT), fight(ROOT), ...copies.map(fight)]);
    const what = (sides: ACaseFought[] | undefined) =>
      THE_PLANTS_CASES.map((_, i) => whatDiffersInACase(first[i] ?? { threw: '' }, sides?.[i] ?? { threw: '' }));
    expect(what(again), 'this tree against itself').toEqual([[], [], []]);
    for (const c of first) {
      if ('threw' in c) throw new Error(`a case threw: ${c.threw}`);
      for (const b of Object.values(c.byStream)) {
        if ('threw' in b) throw new Error(`a battle threw: ${b.threw}`);
        expect(Object.keys(b.byStage), 'every draw in a stage').not.toContain(NO_STAGE);
        expect(Object.values(b.byStage).reduce((x, y) => x + y, 0)).toBe(b.draws);
      }
    }
    const [extraDraw, band, swapped] = planted.map(what);
    expect(
      extraDraw?.[0]?.filter((w) => w.endsWith("H6's dice (1 → 2)")),
      `${PLANTS[0]?.name ?? ''}: H6's dice in every stream`,
    ).toHaveLength(THE_DICE_STREAMS.length);
    expect(extraDraw?.[1], `${PLANTS[0]?.name ?? ''}: the battle against the defenders untouched`).toEqual([]);
    expect(
      band?.flat().filter((w) => w.includes('the world (')).length,
      `${PLANTS[1]?.name ?? ''}: a world after differs`,
    ).toBeGreaterThan(0);
    expect(
      swapped?.[0]?.filter((w) => /H3's dice|H4's dice/.test(w)).length,
      `${PLANTS[2]?.name ?? ''}: H3's and H4's dice move`,
    ).toBeGreaterThan(0);
    expect(swapped?.slice(1), `${PLANTS[2]?.name ?? ''}: the battle against the defenders untouched`).toEqual([[], []]);
  } finally {
    for (const copy of copies) fs.rmSync(copy, { recursive: true, force: true });
  }
}, 120_000);
