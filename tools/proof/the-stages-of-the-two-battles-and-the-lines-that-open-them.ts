// The stages of the two battles, as the battle proof counts their dice by stage (the-battles-compared-each-staged-
// battle-its-lines-its-world-and-its-dice-by-stage.ts; tools/proof/README.md, section 8): the battle against a
// province's defenders (combatVsNPC) and the battle between heroes (combatVsChar). Their list is in src/
// (src/engine/battle/the-stages-of-both-battles-in-the-order-they-run.ts, the one home of their ids, names and
// anchors), read here from its syntax tree, not run, so the proof loads no engine but its worker's side's. Each side
// reads its own tree's list; a side whose tree has none (a base from before B-06bl) reads this tree's, its anchors
// found in its own files. A draw's stage is read from its call stack, with no mark in src/. Each stage's anchor (the
// text of the line that opens it) is found once in whichever file of the side's src/engine/ holds it (the list's own
// file aside), so a stage keeps its name wherever a split row moves its text. A draw belongs to the stage whose anchor
// is the last above it in the innermost frame's file; a frame whose file holds no anchor above it (a helper: the duel,
// the fates, fortune, a rule's effect, or a function above a file's first anchor) passes the draw to the frame that
// called it. So a cut function that holds three stages' text counts their draws as three stages, as one function does.
//
// An anchor of more than one line is matched line by line, each line's leading spaces aside (a moved stage is indented
// anew). A row that rewrites an anchor's own line changes its entry in src/'s list (the base's list holds the old). A
// stage whose anchor a side holds nowhere, or in two places, stops the proof, so a stale list can't count its dice as
// another's.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  identifierProperty,
  stringProperty,
  unwrapped,
} from '../the-worlds-makings-stages-read-from-their-list-in-src.ts';

/** This tree's root. */
const ROOT = path.resolve(import.meta.dirname, '../..');

/** The two battles and the function each is called by. */
export const THE_BATTLES = ['against the defenders', 'between heroes'] as const;
export type ABattle = (typeof THE_BATTLES)[number];

/** The battles' stage list's file, from a tree's src/, and each battle's constant in it. */
export const THE_BATTLES_STAGES_LIST = {
  file: 'engine/battle/the-stages-of-both-battles-in-the-order-they-run.ts',
  names: {
    'against the defenders': 'THE_BATTLE_AGAINST_THE_DEFENDERS_STAGES_IN_THE_ORDER_THEY_RUN',
    'between heroes': 'THE_BATTLE_BETWEEN_HEROES_STAGES_IN_THE_ORDER_THEY_RUN',
  },
} as const satisfies { file: string; names: Record<ABattle, string> };

/** One stage of a battle: its id (N0… for the battle against the defenders, H0… for the battle between heroes), what
 *  it fights in game terms, and its anchor: the text of the line that opens it (lines apart by "\n"). */
export interface AStageOfABattle {
  battle: ABattle;
  stage: string;
  what: string;
  anchor: string;
}
/** A stage as the list in src/ holds it: the stage, and the name of the stage function its code is in (the entry it is
 *  listed under), with that function's file (from the tree's src/). */
export interface AStageOfABattleReadFromTheList extends AStageOfABattle {
  fn: string;
  file: string;
}

/** The stages the list's text holds, each battle's in its order (the battle against the defenders' first). */
export function theBattlesStagesTheListsTextHolds(text: string): AStageOfABattleReadFromTheList[] {
  const file = THE_BATTLES_STAGES_LIST.file;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const importedFrom = new Map<string, string>();
  const lists = new Map<string, ts.ArrayLiteralExpression>();
  for (const s of source.statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier)) {
      const named = s.importClause?.namedBindings;
      if (named && ts.isNamedImports(named))
        for (const e of named.elements)
          importedFrom.set(e.name.text, path.posix.join(path.posix.dirname(file), s.moduleSpecifier.text));
    }
    if (ts.isVariableStatement(s))
      for (const d of s.declarationList.declarations) {
        const init = d.initializer && unwrapped(d.initializer);
        if (ts.isIdentifier(d.name) && init && ts.isArrayLiteralExpression(init)) lists.set(d.name.text, init);
      }
  }
  return THE_BATTLES.flatMap((battle) => {
    const name = THE_BATTLES_STAGES_LIST.names[battle];
    const list = lists.get(name);
    if (!list) throw new Error(`${file} declares no array ${name}`);
    return list.elements.flatMap((e, i) => {
      const o = ts.isObjectLiteralExpression(e) ? e : undefined;
      const fn = o && identifierProperty(o, 'run');
      const fnsFile = fn === undefined ? undefined : importedFrom.get(fn);
      const stages = o && arrayProperty(o, 'stages');
      if (fn === undefined || !fnsFile || !stages)
        throw new Error(
          `${file}, ${name}'s entry ${String(i)}: not { run: <a function imported by name>, stages: [<its stages>] }`,
        );
      return stages.elements.map((st, j) => {
        const so = ts.isObjectLiteralExpression(st) ? st : undefined;
        const stage = so && stringProperty(so, 'stage');
        const what = so && stringProperty(so, 'inGameTerms');
        const anchor = so && stringProperty(so, 'anchor');
        if (stage === undefined || what === undefined || anchor === undefined)
          throw new Error(
            `${file}, ${name}'s entry ${String(i)}, its stage ${String(j)}: not { stage: '<id>', inGameTerms: '<words>', anchor: '<text>' }`,
          );
        return { battle, stage, what, anchor, fn, file: fnsFile };
      });
    });
  });
}

/** The array an object literal's property holds, or undefined. */
function arrayProperty(o: ts.ObjectLiteralExpression, name: string): ts.ArrayLiteralExpression | undefined {
  for (const p of o.properties)
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name)
      if (ts.isArrayLiteralExpression(p.initializer)) return p.initializer;
  return undefined;
}

/** The stages the list of the tree whose src/ is `src` holds; this tree's when that tree has none (a base from before
 *  B-06bl, whose own files are searched for this list's anchors). */
export function theBattlesStagesListedAt(src: string): AStageOfABattleReadFromTheList[] {
  const own = path.join(src, THE_BATTLES_STAGES_LIST.file);
  const list = fs.existsSync(own) ? own : path.join(ROOT, 'src', THE_BATTLES_STAGES_LIST.file);
  return theBattlesStagesTheListsTextHolds(fs.readFileSync(list, 'utf8'));
}

/** The key of a draw no stage claims: made in no file that holds an anchor above it. */
export const NO_STAGE = 'outside';

/** Where each stage starts on a side: for each file that holds an anchor (by its full path), its stages by the line
 *  their anchor starts on (1 is the first), in order. */
export interface TheBattlesStagesOfASide {
  byFile: Map<string, { stage: string; line: number }[]>;
}

/** The lines (1 is the first) where `anchor` starts in `lines`: its first line within a line, each next line the start
 *  of the next line, leading spaces aside. */
function whereTheAnchorStarts(lines: readonly string[], anchor: string): number[] {
  const [first = '', ...rest] = anchor.split('\n');
  return lines.flatMap((l, i) =>
    l.includes(first) && rest.every((r, j) => (lines[i + 1 + j] ?? '').trimStart().startsWith(r.trimStart()))
      ? [i + 1]
      : [],
  );
}

/** Each stage's start on a side whose files are `files` (full path → text). Throws on a stage whose anchor the files
 *  hold nowhere, or in more than one place (the list needs its row's update). */
export function theBattlesStagesOfASide(
  files: ReadonlyMap<string, string>,
  stages: readonly AStageOfABattle[],
): TheBattlesStagesOfASide {
  const byFile = new Map<string, { stage: string; line: number }[]>();
  const lined = [...files].map(([file, text]) => ({ file, lines: text.split('\n') }));
  for (const s of stages) {
    const at = lined.flatMap(({ file, lines }) =>
      whereTheAnchorStarts(lines, s.anchor).map((line) => ({ file, line })),
    );
    const one = at[0];
    if (at.length > 1)
      throw new Error(
        `stage ${s.stage}'s anchor is in ${String(at.length)} places (${at.map((x) => `${path.basename(x.file)}:${String(x.line)}`).join(', ')})`,
      );
    if (!one)
      throw new Error(
        `stage ${s.stage}'s anchor "${s.anchor.split('\n')[0] ?? ''}" is in no file of the side's src/engine/: update its entry in src/${THE_BATTLES_STAGES_LIST.file}`,
      );
    byFile.set(one.file, [...(byFile.get(one.file) ?? []), { stage: s.stage, line: one.line }]);
  }
  for (const starts of byFile.values()) starts.sort((a, b) => a.line - b.line);
  return { byFile };
}

/** A frame of a draw's call stack, as node:util's getCallSites gives it. */
export interface AFrame {
  functionName: string;
  scriptName: string;
  lineNumber: number;
}

/** The stage a draw belongs to, from its call stack (the innermost frame first): the last anchor above the line of the
 *  innermost frame whose file holds one there; NO_STAGE when no frame does. */
export function theStageOfADraw(frames: readonly AFrame[], side: TheBattlesStagesOfASide): string {
  for (const f of frames) {
    const starts = side.byFile.get(f.scriptName);
    if (!starts) continue;
    let stage: string | undefined;
    for (const s of starts) if (f.lineNumber >= s.line) stage = s.stage;
    if (stage) return stage;
  }
  return NO_STAGE;
}

/** Every TypeScript file under `dir`, by its full path. */
const theFilesUnder = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? theFilesUnder(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [],
    );

/** The stages of the side whose src/ is `src`: its list's (or this tree's, theBattlesStagesListedAt), each found in
 *  its own src/engine/, the list's file aside (its text holds every anchor). */
export function theBattlesStagesOfTheSideAt(src: string): TheBattlesStagesOfASide {
  const theList = path.join(src, THE_BATTLES_STAGES_LIST.file);
  const files = theFilesUnder(path.join(src, 'engine')).filter((f) => f !== theList);
  return theBattlesStagesOfASide(
    new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')])),
    theBattlesStagesListedAt(src),
  );
}
