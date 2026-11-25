// The battle proof (tools/proof/the-battles-compared-each-staged-battle-its-lines-its-world-and-its-dice-by-stage.ts,
// npm run proof:battles), its stage list (the-stages-of-the-two-battles-and-the-lines-that-open-them.ts) and its worker
// (one-staged-battle-fought-on-a-side-in-a-fresh-process.ts):
// - a draw's stage is the last anchor above the line of the innermost frame whose file holds one there, whichever file
//   of the side's src/engine/ holds it; a helper's frame, or a line above a file's first anchor, passes to its caller;
//   so a stage moved into another file, or two stages in one file, keep their names; an anchor of two lines is
//   matched whatever its indentation;
// - a stage whose anchor a side holds nowhere, or in two places, stops the proof, and every stage of the list is found
//   once in src/ as it is now, each battle's in order;
// - two sides' battles differ on the lines, the world, the turn's log or another field of the turn's context, the dice
//   in all or one stage's dice, or a throw (both throwing alike is the same), each named by its stream;
// - the grid: every ground, both battles, the defender led and leaderless, from land, a landing and a raid on the
//   coast, every set of armies (at sea, those the sea carries);
// - three cases fought from this tree twice give the same answer, every draw in a stage; a dead commander's host is
//   leaderless, and a landing raids the coast;
// - identical on a copy whose two fortune stages moved into a file of their own (the split rows' kind of move);
// - red on three faults planted in a copy of src/: an extra draw at the end of the battle between heroes' fortune
//   stage; the fortune's swing the statistics record rounded to hundredths, not thousandths (only the turn's context
//   differs, the dice the same); and the army spells and the archery of the battle between heroes swapped (the lines
//   differ; each draw still counts under the stage whose text holds it).
// Level 1 (unit): it runs the tool's functions on made-up frames and battles, and the worker on a few cases of this
// tree and of copies. Static can't: it runs code and processes.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';
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
  theSeaCarriesBothHosts,
} from '../../tools/proof/one-staged-battle-fought-on-a-side-in-a-fresh-process.ts';
import {
  type AStageOfABattle,
  NO_STAGE,
  THE_BATTLES,
  THE_BATTLES_STAGES,
  theBattlesStagesOfASide,
  theBattlesStagesOfTheSideAt,
  theStageOfADraw,
} from '../../tools/proof/the-stages-of-the-two-battles-and-the-lines-that-open-them.ts';

const SRC = path.join(ROOT, 'src');
const WORKER = path.join(ROOT, 'tools/proof/one-staged-battle-fought-on-a-side-in-a-fresh-process.ts');

describe("a draw's stage", () => {
  const at = (f: string) => path.join(SRC, 'engine/battle', f);
  const stages: readonly AStageOfABattle[] = [
    { battle: 'against the defenders', stage: 'N0', what: '', anchors: ['export function combatVsNPC('] },
    { battle: 'against the defenders', stage: 'N1', what: '', anchors: ['// A'] },
    { battle: 'against the defenders', stage: 'N2', what: '', anchors: ['// B'] },
    { battle: 'between heroes', stage: 'H0', what: '', anchors: ['export function combatVsChar('] },
    { battle: 'between heroes', stage: 'H1', what: '', anchors: ['// C\nz();'] },
  ];
  const frame = (functionName: string, file: string, lineNumber: number) => ({
    functionName,
    scriptName: at(file),
    lineNumber,
  });
  // the base: each battle one function in its file; a helper above it
  const base = new Map([
    [
      at('npc.ts'),
      ['function helper() {}', 'export function combatVsNPC(', '  // A', '  x();', '  // B', '  y();'].join('\n'),
    ],
    [at('pvp.ts'), ['export function combatVsChar(', '  // C', '  z();'].join('\n')],
    [at('fortune.ts'), 'export function battleFortune() {}'],
  ]);
  // the branch: N1 and N2 cut into one function of a file of their own (re-indented), and H1's text into another
  const branch = new Map([
    [at('npc.ts'), ['export function combatVsNPC(', '  theCut();'].join('\n')],
    [
      at('cut/n1-and-n2.ts'),
      ['export function theCut() {', '    // A', '    x();', '    // B', '    y();', '}'].join('\n'),
    ],
    [at('pvp.ts'), ['export function combatVsChar(', '  theFirst();'].join('\n')],
    [
      at('cut/h1.ts'),
      ['function aHelperAboveIt() {}', 'export function theFirst() {', '    // C', '    z();', '}'].join('\n'),
    ],
  ]);

  test('the last anchor above the innermost line that has one; a helper passes the draw to its caller', () => {
    const side = theBattlesStagesOfASide(base, stages);
    expect(side.byFile.get(at('npc.ts'))).toEqual([
      { stage: 'N0', line: 2 },
      { stage: 'N1', line: 3 },
      { stage: 'N2', line: 5 },
    ]);
    const helper = frame('battleFortune', 'fortune.ts', 1);
    expect(theStageOfADraw([helper, frame('combatVsNPC', 'npc.ts', 4)], side)).toBe('N1');
    expect(theStageOfADraw([helper, frame('combatVsNPC', 'npc.ts', 6)], side)).toBe('N2');
    expect(theStageOfADraw([frame('helper', 'npc.ts', 1), frame('combatVsNPC', 'npc.ts', 2)], side)).toBe('N0');
    expect(theStageOfADraw([helper, frame('combatVsChar', 'pvp.ts', 3)], side)).toBe('H1');
    expect(theStageOfADraw([helper], side)).toBe(NO_STAGE);
  });

  test('a stage moved into another file, and two stages in one file, keep their names', () => {
    const side = theBattlesStagesOfASide(branch, stages);
    expect(side.byFile.get(at('cut/n1-and-n2.ts'))).toEqual([
      { stage: 'N1', line: 2 },
      { stage: 'N2', line: 4 },
    ]);
    const caller = frame('combatVsNPC', 'npc.ts', 2);
    expect(theStageOfADraw([frame('theCut', 'cut/n1-and-n2.ts', 3), caller], side)).toBe('N1');
    expect(theStageOfADraw([frame('theCut', 'cut/n1-and-n2.ts', 5), caller], side)).toBe('N2');
    const fromPvp = frame('combatVsChar', 'pvp.ts', 2);
    expect(theStageOfADraw([frame('theFirst', 'cut/h1.ts', 4), fromPvp], side)).toBe('H1');
    expect(theStageOfADraw([frame('aHelperAboveIt', 'cut/h1.ts', 1), fromPvp], side)).toBe('H0');
  });

  test('a stage whose anchor a side holds nowhere, or in two places, stops the proof; another text of it is found', () => {
    const gone = [{ battle: 'between heroes', stage: 'H9', what: '', anchors: ['// gone'] }] as const;
    expect(() => theBattlesStagesOfASide(base, gone)).toThrow(/H9's anchor "\/\/ gone" is in no file/);
    const rewritten = [{ ...gone[0], anchors: ['// gone', '// C'] }];
    expect(theBattlesStagesOfASide(base, rewritten).byFile.get(at('pvp.ts'))).toEqual([{ stage: 'H9', line: 2 }]);
    const twice = new Map([...base, [at('another.ts'), '// A']]);
    expect(() => theBattlesStagesOfASide(twice, stages)).toThrow(
      /N1's anchor is in 2 places \(npc\.ts:3, another\.ts:1\)/,
    );
  });

  test("every stage of the list is found once in this tree's src/, each battle's in its order", () => {
    const here = theBattlesStagesOfTheSideAt(SRC);
    const found = [...here.byFile.values()].flat();
    expect(found.map((s) => s.stage).sort()).toEqual(THE_BATTLES_STAGES.map((s) => s.stage).sort());
    for (const b of THE_BATTLES) {
      const listed = THE_BATTLES_STAGES.filter((s) => s.battle === b).map((s) => s.stage);
      const [file] = [...here.byFile].find(([, starts]) => starts.some((s) => s.stage === listed[0])) ?? [];
      const inTheFile = (here.byFile.get(file ?? '') ?? []).map((s) => s.stage).filter((s) => listed.includes(s));
      expect(inTheFile, `the battle ${b}'s anchors in its order`).toEqual(listed.filter((s) => inTheFile.includes(s)));
    }
  });
});

describe('two sides compared', () => {
  const fought = (over: Partial<Extract<ABattleFought, { hash: string }>> = {}): ABattleFought => ({
    lines: ['⚔ Battle for Testmoor', 'The attackers win.'],
    hash: 'a'.repeat(64),
    draws: 10,
    byStage: { N0: 1, N9: 1, N12: 8 },
    turnLog: ['{"type":"skill"}'],
    context: { battleCommanders: 'c'.repeat(64), _tel: 'd'.repeat(64) },
    ...over,
  });

  test("the lines, the world alone, the turn's log, a field of the context, one stage alone with the same total, a throw", () => {
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
    expect(whatDiffersInABattle(fought(), fought({ turnLog: ['{"type":"skill"}', '{"type":"death"}'] }))).toEqual([
      'the turn\'s log (1 → 2; entry 2:  → {"type":"death"})',
    ]);
    expect(
      whatDiffersInABattle(fought(), fought({ context: { battleCommanders: 'c'.repeat(64), _tel: 'e'.repeat(64) } })),
    ).toEqual(["the turn's context (_tel)"]);
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
  test('every ground, both battles, the defender led and not, from land, a landing and a raid, every set of armies', () => {
    const cases = theBattleCases();
    const sets = Object.entries(THE_SETS_OF_ARMIES);
    const atSea = sets.filter(([, set]) => theSeaCarriesBothHosts(set)).map(([name]) => name);
    expect(atSea, 'the sets the sea carries').toEqual([
      'corsairs',
      'whales',
      'fleets',
      'reavers',
      'flyers carrying foot at sea',
    ]);
    const onLand = sets.filter(([, set]) => set.atSeaOnly !== true).length;
    expect(onLand, 'the sets fought on land: all but flyers carrying foot at sea').toBe(sets.length - 1);
    const each = THE_BATTLES.length * THE_DEFENDERS.length * WHERE_THE_ATTACKER_COMES_FROM.length;
    expect(cases).toHaveLength(each * ((THE_GROUNDS.length - 1) * onLand + atSea.length));
    expect(cases.filter((c) => c.terrain !== 'sea' && c.armies === 'flyers carrying foot at sea')).toEqual([]);
    expect(new Set(cases.map((c) => c.key)).size).toBe(cases.length);
    expect(cases.filter((c) => c.terrain === 'sea' && !atSea.includes(c.armies))).toEqual([]);
    expect(THE_GROUNDS).toEqual(['plain', 'forest', 'mountain', 'desert', 'sea']);
    expect([THE_DEFENDERS, WHERE_THE_ATTACKER_COMES_FROM]).toEqual([
      ['led', 'leaderless'],
      ['land', 'sea', 'sea, raiding the coast'],
    ]);
    const named = ['fleets', 'flyers', 'beasts under a Druid short', 'skeletal companies', 'Monsters under Evil'];
    named.push('missiles', 'Dwarven Guard', 'corsairs', 'whales', 'reavers', 'Tactical 6 and the War Drum');
    for (const n of named)
      expect(
        sets.map(([name]) => name),
        `the set "${n}"`,
      ).toContain(n);
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
  /** New files of src/engine/battle/ (by name) the plant adds. */
  adds?: Record<string, string>;
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
  for (const [name, text] of Object.entries(plant.adds ?? {}))
    fs.writeFileSync(path.join(copy, 'src/engine/battle', name), text);
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
/** The two battles' fortune, each stage's text as it is, moved into a file of their own: one file holding two stages,
 *  each battle calling its own (an import may stand anywhere at a module's top level). */
const NPC_FORTUNE = [
  "  // Roll with variance — each side rolls 0 to 70% of the stronger side's POST-multiplier",
  '  // strength. Dice basis unified with the PvP path: both scale the random swing off the FULL',
  '  // effective strength each force brings to the field (all multipliers applied), so luck is',
  '  // proportional to what the armies are actually worth in this battle. Item 9: fortune of battle',
  '  // — one swing, applied as a pair of luck multipliers (see battleFortune).',
];
const PVP_FORTUNE = [
  "  // Dice basis unified with the NPC path: each side rolls 0 to 70% of the stronger side's",
  '  // POST-multiplier strength, so luck scales with what the armies are actually worth in battle.',
  '  // Item 9: fortune of battle — one swing, applied as a pair of luck multipliers (see',
  '  // battleFortune).',
];
const THE_FORTUNE_MOVED: APlant = {
  name: 'both fortune stages moved into a file of their own',
  edits: [
    {
      old: [...NPC_FORTUNE, '  const _fort = battleFortune();'].join('\n'),
      new: '  const _fort = theFortuneOfTheBattleAgainstTheDefenders();',
    },
    {
      // (the head of the stage the fortune's text is in, the-battle-against-the-defenders/n8-to-n10-…, since B-06bc)
      old: 'export function theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders(',
      new: "import { theFortuneOfTheBattleAgainstTheDefenders } from '../the-fortune-of-both-battles-moved.ts';\nexport function theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders(",
    },
    {
      old: [...PVP_FORTUNE, '  const _fortP = battleFortune();'].join('\n'),
      new: '  const _fortP = theFortuneOfTheBattleBetweenHeroes();',
    },
    {
      old: 'function theLineTheBattleBetweenHeroesWrites<',
      new: "import { theFortuneOfTheBattleBetweenHeroes } from './the-fortune-of-both-battles-moved.ts';\nfunction theLineTheBattleBetweenHeroesWrites<",
    },
  ],
  adds: {
    'the-fortune-of-both-battles-moved.ts': [
      "import { battleFortune } from './fortune.ts';",
      'export function theFortuneOfTheBattleAgainstTheDefenders() {',
      ...NPC_FORTUNE.map((l) => `  ${l}`),
      '    return battleFortune();',
      '}',
      'export function theFortuneOfTheBattleBetweenHeroes() {',
      ...PVP_FORTUNE.map((l) => `  ${l}`),
      '    return battleFortune();',
      '}',
      '',
    ].join('\n'),
  },
};
const PLANTS: readonly APlant[] = [
  {
    name: "an extra draw at the end of the battle between heroes' fortune",
    edits: [{ old: '  // ── STAT BLOCK ── 2026-09-23b', new: '  kcRng();\n  // ── STAT BLOCK ── 2026-09-23b' }],
  },
  {
    name: "the battle between heroes' swing in its statistics record rounded to hundredths (no draw)",
    edits: [
      {
        old: 'S: Math.round((_fortP.S || 0) * 1000) / 1000,',
        new: 'S: Math.round((_fortP.S || 0) * 100) / 100,',
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

/** The cases the copies are fought on: a battle between heroes with flyers, a Wyvern's strike and archers; two battles against the
 *  defenders; and a raid on the coast against a dead commander's host, its longships carrying Orc Berserkers. */
const THE_PLANTS_CASES: readonly ABattleCase[] = [
  { key: 'h', battle: 'between heroes', terrain: 'plain', defender: 'led', from: 'land', armies: 'flyers' },
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
  {
    key: 'r',
    battle: 'between heroes',
    terrain: 'plain',
    defender: 'leaderless',
    from: 'sea, raiding the coast',
    armies: 'reavers',
  },
];

test(
  'this tree twice gives the same answer, every draw in a stage; the same with the fortune moved; red on each of three plants',
  // four copies of src/ made and removed, and 24 cases fought in processes of their own, side by side
  timeLimitForTheWork({ everyFileReads: 8, toolRuns: 1 }),
  async () => {
    const copies = [THE_FORTUNE_MOVED, ...PLANTS].map(aPlantedCopy);
    try {
      const fight = (root: string) => Promise.all(THE_PLANTS_CASES.map((c) => aCaseFoughtAt(root, c)));
      const [first, again, ...copied] = await Promise.all([fight(ROOT), fight(ROOT), ...copies.map(fight)]);
      const what = (sides: ACaseFought[] | undefined) =>
        THE_PLANTS_CASES.map((_, i) => whatDiffersInACase(first[i] ?? { threw: '' }, sides?.[i] ?? { threw: '' }));
      const none = THE_PLANTS_CASES.map(() => []);
      expect(what(again), 'this tree against itself').toEqual(none);
      const battles = first.flatMap((c) => {
        if ('threw' in c) throw new Error(`a case threw: ${c.threw}`);
        return Object.values(c.byStream).map((b) => {
          if ('threw' in b) throw new Error(`a battle threw: ${b.threw}`);
          return b;
        });
      });
      for (const b of battles) {
        expect(Object.keys(b.byStage), 'every draw in a stage').not.toContain(NO_STAGE);
        expect(Object.values(b.byStage).reduce((x, y) => x + y, 0)).toBe(b.draws);
      }
      const raid = first[3];
      const raidLines =
        raid && 'byStream' in raid ? Object.values(raid.byStream).flatMap((b) => ('lines' in b ? b.lines : [])) : [];
      expect(
        raidLines.some((l) => l.includes("'s leaderless host")),
        "the dead commander's host is leaderless",
      ).toBe(true);
      expect(
        raidLines.some((l) => l.includes('Raid the Coast')),
        'the landing raids the coast',
      ).toBe(true);
      const [moved, extraDraw, rounded, swapped] = copied.map(what);
      const movedInto = path.join(
        fs.realpathSync(copies[0] ?? ''),
        'src/engine/battle/the-fortune-of-both-battles-moved.ts',
      );
      expect(
        theBattlesStagesOfTheSideAt(path.join(fs.realpathSync(copies[0] ?? ''), 'src')).byFile.get(movedInto),
        'the copy holds both fortune stages in the new file',
      ).toEqual([
        { stage: 'N9', line: 3 },
        { stage: 'H6', line: 11 },
      ]);
      expect(moved, `${THE_FORTUNE_MOVED.name}: every case the same, each draw in its own stage`).toEqual(none);
      expect(
        extraDraw?.[0]?.filter((w) => w.endsWith("H6's dice (1 → 2)")),
        `${PLANTS[0]?.name ?? ''}: H6's dice in every stream`,
      ).toHaveLength(THE_DICE_STREAMS.length);
      expect(extraDraw?.slice(1, 3), `${PLANTS[0]?.name ?? ''}: the battles against the defenders untouched`).toEqual([
        [],
        [],
      ]);
      const roundedOnly = rounded?.[0] ?? [];
      expect(roundedOnly.length, `${PLANTS[1]?.name ?? ''}: some stream differs`).toBeGreaterThan(0);
      expect(
        roundedOnly.filter((w) => !w.endsWith("the turn's context (_tel)")),
        `${PLANTS[1]?.name ?? ''}: only the turn's context, the lines, world and dice the same`,
      ).toEqual([]);
      expect(
        swapped?.[0]?.filter((w) => w.includes(': the lines (')).length,
        `${PLANTS[2]?.name ?? ''}: the lines differ`,
      ).toBeGreaterThan(0);
      expect(swapped?.slice(1, 3), `${PLANTS[2]?.name ?? ''}: the battles against the defenders untouched`).toEqual([
        [],
        [],
      ]);
    } finally {
      for (const copy of copies) fs.rmSync(copy, { recursive: true, force: true });
    }
  },
);
