// Each battle is fought by the stages its list holds (src/engine/battle/the-stages-of-both-battles-in-the-order-they-run.ts,
// B-06bl), in the list's order:
// - what the battle proof reads from the list's syntax tree (tools/proof/the-stages-of-the-two-battles-and-the-lines-
//   that-open-them.ts) is the list as it runs, entry by entry, each entry's function declared in the file it is
//   imported from;
// - each battle's ids are N0, N1, … (H0, H1, …) in order;
// - each entry's anchor is found once in its function's file (the first stage's, the battle's own function's head, in
//   the battle's own file), each below the one before it in the same file;
// - combatVsNPC and combatVsChar call the stage functions of their folders each once, in the list's order;
// - red on plants: an entry's anchor changed (the proof stops too), two entries swapped, a stage's anchors swapped, a
//   stage dropped from the list, a battle's two stage calls swapped, and a stage call dropped.
// Level 1 (unit): it imports the list to compare its functions' names with what the proof reads and the battles' text.
// Static alone can't: the functions' names are only known by running the list's module.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import '../lib/the-whole-engine.ts';
import {
  THE_BATTLE_AGAINST_THE_DEFENDERS_STAGES_IN_THE_ORDER_THEY_RUN,
  THE_BATTLE_BETWEEN_HEROES_STAGES_IN_THE_ORDER_THEY_RUN,
} from '../../src/engine/battle/the-stages-of-both-battles-in-the-order-they-run.ts';
import { ROOT } from '../../tools/build.ts';
import {
  type ABattle,
  type AStageOfABattleReadFromTheList,
  THE_BATTLES,
  THE_BATTLES_STAGES_LIST,
  theBattlesStagesOfASide,
  theBattlesStagesTheListsTextHolds,
} from '../../tools/proof/the-stages-of-the-two-battles-and-the-lines-that-open-them.ts';

const SRC = path.join(ROOT, 'src');
/** Each battle: its own file (from src/), its function, the folder of its stage functions, and its ids' letter. */
const THE_BATTLES_FILES: Record<ABattle, { file: string; fn: string; folder: string; letter: string }> = {
  'against the defenders': {
    file: 'engine/battle/battles-against-province-defenders.ts',
    fn: 'combatVsNPC',
    folder: './the-battle-against-the-defenders/',
    letter: 'N',
  },
  'between heroes': {
    file: 'engine/battle/battles-between-heroes.ts',
    fn: 'combatVsChar',
    folder: './the-battle-between-heroes/',
    letter: 'H',
  },
};

const textOf = (file: string): string => fs.readFileSync(path.join(SRC, file), 'utf8');
const theListsText = textOf(THE_BATTLES_STAGES_LIST.file);

/** The lines (1 is the first) where an anchor starts in a text, as the proof matches it. */
function whereItStarts(text: string, anchor: string): number[] {
  const side = theBattlesStagesOfASide(new Map([['f', text]]), [
    { battle: 'between heroes', stage: 'x', what: '', anchor },
  ]);
  return (side.byFile.get('f') ?? []).map((s) => s.line);
}
/** The lines where an anchor starts, or none (the proof throws on an anchor found twice or nowhere). */
function theAnchorsLines(text: string, anchor: string): number[] {
  try {
    return whereItStarts(text, anchor);
  } catch (e: unknown) {
    const twice = e instanceof Error && / is in (\d+) places/.exec(e.message);
    return twice ? Array.from({ length: Number(twice[1]) }, () => 0) : [];
  }
}

/** The stage functions a battle's function calls, in its text's order: each call of a name its file imports from the
 *  battle's stage folder. */
function theStageCallsIn(text: string, battle: ABattle): string[] {
  const { file, fn, folder } = THE_BATTLES_FILES[battle];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const fromTheFolder = new Set<string>();
  let body: ts.Block | undefined;
  for (const s of source.statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text.startsWith(folder))
      for (const e of s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings)
        ? s.importClause.namedBindings.elements
        : [])
        fromTheFolder.add(e.name.text);
    if (ts.isFunctionDeclaration(s) && s.name?.text === fn) body = s.body;
  }
  if (!body) throw new Error(`${file} declares no ${fn}`);
  const called: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && fromTheFolder.has(n.expression.text))
      called.push(n.expression.text);
    ts.forEachChild(n, visit);
  };
  visit(body);
  return called;
}

/** Where the list and the code part: each a line naming the stage or the battle; none when they agree. */
function whereTheListAndTheCodePart(
  stages: readonly AStageOfABattleReadFromTheList[],
  text: (file: string) => string,
): string[] {
  const parts: string[] = [];
  for (const battle of THE_BATTLES) {
    const own = THE_BATTLES_FILES[battle];
    const its = stages.filter((s) => s.battle === battle);
    const ids = its.map((s) => s.stage);
    const inOrder = its.map((_, i) => `${own.letter}${String(i)}`);
    if (ids.join() !== inOrder.join())
      parts.push(`the ids of the battle ${battle}, ${ids.join()}, are not ${inOrder.join()}`);
    let before: { file: string; line: number } | undefined;
    its.forEach((s, i) => {
      if (!text(s.file).includes(`export function ${s.fn}(`)) parts.push(`${s.stage}: ${s.file} declares no ${s.fn}`);
      const where = i === 0 ? own.file : s.file;
      const lines = theAnchorsLines(text(where), s.anchor);
      const [line] = lines;
      if (lines.length !== 1 || line === undefined)
        parts.push(`${s.stage}'s anchor is in ${where} ${String(lines.length)} times, not once`);
      else {
        if (before?.file === where && line <= before.line) parts.push(`${s.stage}'s anchor is above the one before it`);
        before = { file: where, line };
      }
    });
    const theFunctions = its.map((s) => s.fn).filter((f, i, all) => all.indexOf(f) === i);
    const called = theStageCallsIn(text(own.file), battle);
    if (called.join() !== theFunctions.join())
      parts.push(`${own.fn} calls ${called.join(', ')}, not the list's ${theFunctions.join(', ')}`);
  }
  return parts;
}

const read = theBattlesStagesTheListsTextHolds(theListsText);

test('what the battle proof reads from the list is the list as it runs, entry by entry', () => {
  const asItRuns = [
    ...THE_BATTLE_AGAINST_THE_DEFENDERS_STAGES_IN_THE_ORDER_THEY_RUN.map((s) => ({ ...s, battle: THE_BATTLES[0] })),
    ...THE_BATTLE_BETWEEN_HEROES_STAGES_IN_THE_ORDER_THEY_RUN.map((s) => ({ ...s, battle: THE_BATTLES[1] })),
  ];
  expect(read.map((s) => [s.battle, s.stage, s.what, s.anchor, s.fn])).toEqual(
    asItRuns.map((s) => [s.battle, s.stage, s.inGameTerms, s.anchor, s.heldIn.name]),
  );
});

test("each battle's ids are in order, each anchor once in its function's file below the one before, and each battle calls its stages' functions once each in the list's order", () => {
  expect(whereTheListAndTheCodePart(read, textOf)).toEqual([]);
});

// Each plant changes the list's text or a battle's as a row could by mistake; the check must part them on it.
const N3 = theListsText.slice(
  theListsText.indexOf("  {\n    stage: 'N3',"),
  theListsText.indexOf("  {\n    stage: 'N4',"),
);
const N4 = theListsText.slice(
  theListsText.indexOf("  {\n    stage: 'N4',"),
  theListsText.indexOf("  {\n    stage: 'N5',"),
);
const H6 = theListsText.slice(
  theListsText.indexOf("  {\n    stage: 'H6',"),
  theListsText.indexOf("  {\n    stage: 'H7',"),
);
const NPC = THE_BATTLES_FILES['against the defenders'].file;
const PVP = THE_BATTLES_FILES['between heroes'].file;
const THE_ATTACKERS_PHASES =
  '  const theAttackersPhases = theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders(turnContext, c, prov, theSetUp);';
const THE_DEFENDERS_PHASES_COMMENT = [
  "  // The defenders' pre-battle phases (B-06bb: the-battle-against-the-defenders/, its third stage), their commander's",
  "  // magic, their archery and Flak, their units' army spells: each strikes the attacker's host, and hands nothing on.",
];
const THE_DEFENDERS_PHASES =
  '  theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders(turnContext, c, prov, theSetUp, theAttackersPhases);';
const THE_MAGIC = '  bothSidesPreBattleMagicAndArmySpellsInTheBattleBetweenHeroes(turnContext, atk, def, theSetUp);';
test.for([
  {
    plant: "N6's anchor changed",
    in: THE_BATTLES_STAGES_LIST.file,
    old: "'// DEFENDER ARCHERY — 2026-09-24'",
    new: "'// DEFENDER ARCHERY — 2026-09-25'",
  },
  { plant: 'the entries N3 and N4 swapped', in: THE_BATTLES_STAGES_LIST.file, old: N3 + N4, new: N4 + N3 },
  {
    plant: "N3's and N4's anchors swapped, their ids kept",
    in: THE_BATTLES_STAGES_LIST.file,
    old: "'// PRE-BATTLE PHASE 1: MAGIC Hero casts first',\n    heldIn: theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders,\n  },\n  {\n    stage: 'N4',\n    inGameTerms: \"the attacker's archery, Flak and Breach\",\n    anchor: '// PRE-BATTLE PHASE 2: ARCHERY Each attacker',",
    new: "'// PRE-BATTLE PHASE 2: ARCHERY Each attacker',\n    heldIn: theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders,\n  },\n  {\n    stage: 'N4',\n    inGameTerms: \"the attacker's archery, Flak and Breach\",\n    anchor: '// PRE-BATTLE PHASE 1: MAGIC Hero casts first',",
  },
  { plant: 'the stage H6 dropped from the list', in: THE_BATTLES_STAGES_LIST.file, old: H6, new: '' },
  {
    plant: "combatVsNPC's attacker's and defenders' pre-battle phases' calls swapped",
    in: NPC,
    old: [THE_ATTACKERS_PHASES, ...THE_DEFENDERS_PHASES_COMMENT, THE_DEFENDERS_PHASES].join('\n'),
    new: [THE_DEFENDERS_PHASES, ...THE_DEFENDERS_PHASES_COMMENT, THE_ATTACKERS_PHASES].join('\n'),
  },
  { plant: "combatVsChar's magic and army spells' call dropped", in: PVP, old: THE_MAGIC, new: '' },
])('the check is red on a plant: $plant', ({ in: file, old, new: planted, plant }) => {
  const text = textOf(file);
  expect(old.length > 0 && text.includes(old), `${file} holds the plant's text`).toBe(true);
  const plantedText = (f: string) => (f === file ? text.replace(old, planted) : textOf(f));
  const stages = theBattlesStagesTheListsTextHolds(plantedText(THE_BATTLES_STAGES_LIST.file));
  expect(whereTheListAndTheCodePart(stages, plantedText), plant).not.toEqual([]);
});

test("the proof stops on the plant whose entry's anchor changed: N6's anchor is in no file", () => {
  const planted = theBattlesStagesTheListsTextHolds(
    theListsText.replace("'// DEFENDER ARCHERY — 2026-09-24'", "'// DEFENDER ARCHERY — 2026-09-25'"),
  );
  const files = new Map([NPC, PVP, ...planted.map((s) => s.file)].map((f): [string, string] => [f, textOf(f)]));
  expect(() => theBattlesStagesOfASide(files, planted)).toThrow(/N6's anchor ".*" is in no file/);
});
