// Each battle is fought by the stages its list holds (src/engine/battle/the-stages-of-both-battles-in-the-order-they-run.ts,
// B-06bl), in the list's order:
// - what the battle proof reads from the list's syntax tree (tools/proof/the-stages-of-the-two-battles-and-the-lines-
//   that-open-them.ts) is the list as it runs, stage by stage, each stage's function declared in the file it is
//   imported from;
// - each battle's ids are N0, N1, … (H0, H1, …) in order, and each stage function is listed once;
// - each stage's anchor is found once in its function's file (the first stage's, the battle's own function's head, in
//   the battle's own file), each below the one before it in the same file;
// - combatVsNPC and combatVsChar take their stage functions from their list as they start, one name a function, each
//   its function's own name, in the list's order, import none from a stage's folder, and call each once in that order;
// - red on plants: a stage's anchor changed (the proof stops too), two stages swapped, two stages' anchors swapped, a
//   stage dropped from the list, two stage functions swapped in the list, two names bound swapped, two stage calls
//   swapped, and a stage call dropped.
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

/** What a battle's file does with its stages: the names its function binds from its list, in the pattern's order; the
 *  calls it makes to them, in its text's order; and what its file imports from the battle's stage folder. */
function theStagesIn(
  text: string,
  battle: ABattle,
): { bound: string[]; called: string[]; importedFromAStage: string[] } {
  const { file, fn, folder } = THE_BATTLES_FILES[battle];
  const theList = THE_BATTLES_STAGES_LIST.names[battle];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const importedFromAStage: string[] = [];
  let body: ts.Block | undefined;
  for (const s of source.statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text.startsWith(folder))
      importedFromAStage.push(s.moduleSpecifier.text);
    if (ts.isFunctionDeclaration(s) && s.name?.text === fn) body = s.body;
  }
  if (!body) throw new Error(`${file} declares no ${fn}`);
  // The binding from the list: a statement of the battle's own body (not the module's top level, read as it loads).
  const bound: string[] = [];
  for (const s of body.statements)
    if (ts.isVariableStatement(s))
      for (const d of s.declarationList.declarations) {
        if (!d.initializer || !ts.isIdentifier(d.initializer) || d.initializer.text !== theList) continue;
        if (!ts.isArrayBindingPattern(d.name)) continue;
        for (const e of d.name.elements) {
          const run =
            ts.isBindingElement(e) && ts.isObjectBindingPattern(e.name)
              ? e.name.elements.find(
                  (b) => b.propertyName && ts.isIdentifier(b.propertyName) && b.propertyName.text === 'run',
                )
              : undefined;
          bound.push(run && ts.isIdentifier(run.name) ? run.name.text : '(not { run: <a name> })');
        }
      }
  const names = new Set(bound);
  const called: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.has(n.expression.text))
      called.push(n.expression.text);
    ts.forEachChild(n, visit);
  };
  visit(body);
  return { bound, called, importedFromAStage };
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
    const theFunctions = its.map((s) => s.fn).filter((f, i, all) => i === 0 || all[i - 1] !== f);
    if (new Set(theFunctions).size !== theFunctions.length)
      parts.push(`a stage function of the battle ${battle} is listed twice: ${theFunctions.join(', ')}`);
    const here = theStagesIn(text(own.file), battle);
    if (here.bound.join() !== theFunctions.join())
      parts.push(`${own.fn} binds ${here.bound.join(', ')}, not the list's ${theFunctions.join(', ')}`);
    if (here.called.join() !== theFunctions.join())
      parts.push(`${own.fn} calls ${here.called.join(', ')}, not the list's ${theFunctions.join(', ')}`);
    if (here.importedFromAStage.length > 0)
      parts.push(`${own.file} imports ${here.importedFromAStage.join(', ')} from a stage's file`);
  }
  return parts;
}

const read = theBattlesStagesTheListsTextHolds(theListsText);

test('what the battle proof reads from the list is the list as it runs, stage by stage', () => {
  const asItRuns = (battle: ABattle, list: readonly { run: { name: string }; stages: readonly object[] }[]) =>
    list.flatMap(({ run, stages }) => stages.map((st) => ({ battle, ...st, fn: run.name })));
  const both = [
    ...asItRuns(THE_BATTLES[0], THE_BATTLE_AGAINST_THE_DEFENDERS_STAGES_IN_THE_ORDER_THEY_RUN),
    ...asItRuns(THE_BATTLES[1], THE_BATTLE_BETWEEN_HEROES_STAGES_IN_THE_ORDER_THEY_RUN),
  ];
  expect(
    read.map((s) => ({ battle: s.battle, stage: s.stage, inGameTerms: s.what, anchor: s.anchor, fn: s.fn })),
  ).toEqual(both);
});

test("each battle's ids are in order, each anchor once in its function's file below the one before, and each battle binds and calls its stage functions once each in the list's order", () => {
  expect(whereTheListAndTheCodePart(read, textOf)).toEqual([]);
});

// Each plant changes the list's text or a battle's as a row could by mistake; the check must part them on it.
const between = (text: string, from: string, to: string) => text.slice(text.indexOf(from), text.indexOf(to));
const aStage = (id: string) => `      {\n        stage: '${id}',`;
const aFunction = (fn: string) => `  {\n    run: ${fn},`;
const N3 = between(theListsText, aStage('N3'), aStage('N4'));
// (N4 is its function's last stage: its text ends where its function's stages and its entry close)
const N4 = between(
  theListsText,
  aStage('N4'),
  `    ],\n  },\n${aFunction('theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders')}`,
);
const H6 = between(theListsText, aStage('H6'), aStage('H7'));
const MAGIC = 'bothSidesPreBattleMagicAndArmySpellsInTheBattleBetweenHeroes';
const ARCHERY = 'bothSidesArcheryFlakAndBreachInTheBattleBetweenHeroes';
const SANCTUARY = 'sanctuaryTheMasteryOrdersTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroes';
const THE_MAGICS_ENTRY = between(theListsText, aFunction(MAGIC), aFunction(ARCHERY));
const THE_ARCHERYS_ENTRY = between(theListsText, aFunction(ARCHERY), aFunction(SANCTUARY));
const N3_ANCHOR = "'// PRE-BATTLE PHASE 1: MAGIC Hero casts first'";
const N4_ANCHOR = "'// PRE-BATTLE PHASE 2: ARCHERY Each attacker'";
const NPC = THE_BATTLES_FILES['against the defenders'].file;
const PVP = THE_BATTLES_FILES['between heroes'].file;
const LIST = THE_BATTLES_STAGES_LIST.file;
const THE_ATTACKERS_PHASES =
  '  const theAttackersPhases = theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders(turnContext, c, prov, theSetUp);';
const THE_DEFENDERS_PHASES_COMMENT = [
  "  // The defenders' pre-battle phases (B-06bb: the-battle-against-the-defenders/, its third stage), their commander's",
  "  // magic, their archery and Flak, their units' army spells: each strikes the attacker's host, and hands nothing on.",
];
const THE_DEFENDERS_PHASES =
  '  theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders(turnContext, c, prov, theSetUp, theAttackersPhases);';
const THE_MAGICS_CALL = `  ${MAGIC}(turnContext, atk, def, theSetUp);`;
test.for([
  {
    plant: "N6's anchor changed",
    in: LIST,
    edits: [{ old: "'// DEFENDER ARCHERY — 2026-09-24'", new: "'// DEFENDER ARCHERY — 2026-09-25'" }],
  },
  { plant: 'the stages N3 and N4 swapped', in: LIST, edits: [{ old: N3 + N4, new: N4 + N3 }] },
  {
    plant: "N3's and N4's anchors swapped, their ids kept",
    in: LIST,
    edits: [
      { old: N3_ANCHOR, new: "'(moved)'" },
      { old: N4_ANCHOR, new: N3_ANCHOR },
      { old: "'(moved)'", new: N4_ANCHOR },
    ],
  },
  { plant: 'the stage H6 dropped from the list', in: LIST, edits: [{ old: H6, new: '' }] },
  {
    plant: "the magic's and the archery's stage functions swapped in the battle between heroes' list",
    in: LIST,
    edits: [{ old: THE_MAGICS_ENTRY + THE_ARCHERYS_ENTRY, new: THE_ARCHERYS_ENTRY + THE_MAGICS_ENTRY }],
  },
  {
    plant: "combatVsChar's names for the magic and the archery bound swapped",
    in: PVP,
    edits: [
      {
        old: `    { run: ${MAGIC} },\n    { run: ${ARCHERY} },`,
        new: `    { run: ${ARCHERY} },\n    { run: ${MAGIC} },`,
      },
    ],
  },
  {
    plant: "combatVsNPC's attacker's and defenders' pre-battle phases' calls swapped",
    in: NPC,
    edits: [
      {
        old: [THE_ATTACKERS_PHASES, ...THE_DEFENDERS_PHASES_COMMENT, THE_DEFENDERS_PHASES].join('\n'),
        new: [THE_DEFENDERS_PHASES, ...THE_DEFENDERS_PHASES_COMMENT, THE_ATTACKERS_PHASES].join('\n'),
      },
    ],
  },
  { plant: "combatVsChar's magic and army spells' call dropped", in: PVP, edits: [{ old: THE_MAGICS_CALL, new: '' }] },
])('the check is red on a plant: $plant', ({ in: file, edits, plant }) => {
  let text = textOf(file);
  for (const e of edits) {
    expect(e.old.length > 0 && text.includes(e.old), `${file} holds the plant's text ${e.old.slice(0, 60)}`).toBe(true);
    text = text.replace(e.old, e.new);
  }
  const plantedText = (f: string) => (f === file ? text : textOf(f));
  const stages = theBattlesStagesTheListsTextHolds(plantedText(LIST));
  expect(whereTheListAndTheCodePart(stages, plantedText), plant).not.toEqual([]);
});

test("the proof stops on the plant whose entry's anchor changed: N6's anchor is in no file", () => {
  const planted = theBattlesStagesTheListsTextHolds(
    theListsText.replace("'// DEFENDER ARCHERY — 2026-09-24'", "'// DEFENDER ARCHERY — 2026-09-25'"),
  );
  const files = new Map([NPC, PVP, ...planted.map((s) => s.file)].map((f): [string, string] => [f, textOf(f)]));
  expect(() => theBattlesStagesOfASide(files, planted)).toThrow(/N6's anchor ".*" is in no file/);
});
