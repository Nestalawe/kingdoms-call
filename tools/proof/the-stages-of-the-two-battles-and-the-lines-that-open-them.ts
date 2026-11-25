// The stages of the two battles, as the battle proof counts their dice by stage (the-battles-compared-each-staged-
// battle-its-lines-its-world-and-its-dice-by-stage.ts; tools/proof/README.md, section 8): the battle against a
// province's defenders (combatVsNPC) and the battle between heroes (combatVsChar). A draw's stage is read from its call
// stack, with no mark in src/. Each stage has an anchor: the text of the line that opens it (a comment, mostly), found
// once in whichever file of the side's src/engine/ holds it, so each side reads its own tree and a stage keeps its name
// wherever a split row moves its text. A draw belongs to the stage whose anchor is the last above it in the innermost
// frame's file; a frame whose file holds no anchor above it (a helper: the duel, the fates, fortune, a rule's effect, or
// a function above a file's first anchor) passes the draw to the frame that called it. So a cut function that holds
// three stages' text counts their draws as three stages, as the base's one function does.
//
// An anchor of more than one line is matched line by line, each line's leading spaces aside (a moved stage is indented
// anew). A row that rewrites an anchor's own line adds its new text to `anchors` (the base still holds the old). A stage
// whose anchor a side holds nowhere, or in two places, stops the proof, so a stale list can't count its dice as
// another's. The list is kept here until each battle's own stage list is in src/ (B-06bl).
import fs from 'node:fs';
import path from 'node:path';

/** The two battles and the function each is called by. */
export const THE_BATTLES = ['against the defenders', 'between heroes'] as const;
export type ABattle = (typeof THE_BATTLES)[number];

/** One stage of a battle: its id (N0… for the battle against the defenders, H0… for the battle between heroes), what
 *  it fights in game terms, and its anchor: the text of the line that opens it (lines apart by "\n"), with any other
 *  text the line has had on a side. */
export interface AStageOfABattle {
  battle: ABattle;
  stage: string;
  what: string;
  anchors: readonly string[];
}

/** The stages of both battles, each battle's in the order it fights them. */
export const THE_BATTLES_STAGES: readonly AStageOfABattle[] = [
  {
    battle: 'against the defenders',
    stage: 'N0',
    what: 'the set-up: the negations, the tiers that fight, the deploy line, Terror',
    anchors: ['export function combatVsNPC('],
  },
  {
    battle: 'against the defenders',
    stage: 'N1',
    what: 'the duel before the battle',
    anchors: ['// ── Duel before battle ──'],
  },
  {
    battle: 'against the defenders',
    stage: 'N2',
    what: "the sides: a slain commander, Tactical, the defender's edge and Siege, Righteous Defence, the items at the walls, home",
    anchors: ["// The attacker's side as the facts hold it (plan P1-12d23)"],
  },
  {
    battle: 'against the defenders',
    stage: 'N3',
    what: "the attacker's pre-battle magic and army spells",
    anchors: ['// PRE-BATTLE PHASE 1: MAGIC Hero casts first'],
  },
  {
    battle: 'against the defenders',
    stage: 'N4',
    what: "the attacker's archery, Flak and Breach",
    anchors: ['// PRE-BATTLE PHASE 2: ARCHERY Each attacker'],
  },
  {
    battle: 'against the defenders',
    stage: 'N5',
    what: "the defenders' commander's pre-battle magic",
    anchors: ['// DEFENDER PRE-BATTLE PHASES'],
  },
  {
    battle: 'against the defenders',
    stage: 'N6',
    what: "the defenders' archery",
    anchors: ['// DEFENDER ARCHERY — 2026-09-24'],
  },
  {
    battle: 'against the defenders',
    stage: 'N7',
    what: "the defenders' army spells",
    anchors: ['// DEFENDER ARMY SPELLS:'],
  },
  {
    battle: 'against the defenders',
    stage: 'N8',
    what: "the terrain's notes and the battle lines, every multiplier",
    anchors: ['// ── TERRAIN MODIFIER NOTES ──'],
  },
  {
    battle: 'against the defenders',
    stage: 'N9',
    what: 'the fortune of battle',
    anchors: ['// Roll with variance — each side rolls'],
  },
  {
    battle: 'against the defenders',
    stage: 'N10',
    what: 'the stat block and the result',
    anchors: ['// ── STAT BLOCK (visible to GM'],
  },
  {
    battle: 'against the defenders',
    stage: 'N11',
    what: 'the casualty bands and the carry-on',
    anchors: ['// ── MARGIN-BASED CASUALTY SYSTEM ──'],
  },
  {
    battle: 'against the defenders',
    stage: 'N12',
    what: "the fates and the rout's three stages",
    anchors: ['// UNIT ABILITIES vs NEUTRAL GUARDS'],
  },
  {
    battle: 'against the defenders',
    stage: 'N13',
    what: 'the end: the spells lifted, the skills learned',
    anchors: [
      '// Battle-magic strength reductions last only for this battle\n[\n...(asItsGuardReadsIt(c.armies) ?? []),',
    ],
  },
  {
    battle: 'between heroes',
    stage: 'H0',
    what: "the set-up and the titles' merit tally",
    anchors: ['export function combatVsChar('],
  },
  {
    battle: 'between heroes',
    stage: 'H1',
    what: 'the duel before the battle',
    anchors: ['// ── DUEL BEFORE BATTLE (Adventurer Kings rules) ──'],
  },
  {
    battle: 'between heroes',
    stage: 'H2',
    what: "Righteous Defence, the zeal, Consecrate's seizure, home and the front",
    anchors: ['// GOOD — Righteous Defence: +10% when a Good player'],
  },
  {
    battle: 'between heroes',
    stage: 'H3',
    what: "both sides' pre-battle magic and army spells",
    anchors: ['// PRE-BATTLE PHASE 1: MAGIC (both sides)'],
  },
  {
    battle: 'between heroes',
    stage: 'H4',
    what: "both sides' archery, Flak and Breach",
    anchors: ['// PRE-BATTLE PHASE 2: ARCHERY (both sides)'],
  },
  {
    battle: 'between heroes',
    stage: 'H5',
    what: "Sanctuary, the mastery orders, Consecrate's sickness, Tactical and the lines",
    anchors: ['// WHITE L7 — Sanctuary: enemies of the warding caster'],
  },
  {
    battle: 'between heroes',
    stage: 'H6',
    what: 'the fortune of battle',
    anchors: ['// Dice basis unified with the NPC path'],
  },
  {
    battle: 'between heroes',
    stage: 'H7',
    what: 'the stat block and the result',
    anchors: ['// ── STAT BLOCK ── 2026-09-23b'],
  },
  {
    battle: 'between heroes',
    stage: 'H8',
    what: 'the casualty bands and the carry-on',
    anchors: ['const margRatioPvP = margin / totalStrPvP;'],
  },
  {
    battle: 'between heroes',
    stage: 'H9',
    what: 'the fates, the rout and the aftermath',
    anchors: ['// ── UNIT ABILITIES: casualty & retreat ──'],
  },
  {
    battle: 'between heroes',
    stage: 'H10',
    what: 'the end: the spells lifted, the skills learned',
    anchors: [
      '// Battle-magic strength reductions last only for this battle\n[...(asItsGuardReadsIt(atk.armies) ?? []), ...(asItsGuardReadsIt(def.armies) ?? [])]',
    ],
  },
];

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

/** Each stage's start on a side whose files are `files` (full path → text). Throws on a stage whose anchors the files
 *  hold nowhere, or in more than one place (the list needs its row's update). */
export function theBattlesStagesOfASide(
  files: ReadonlyMap<string, string>,
  stages: readonly AStageOfABattle[] = THE_BATTLES_STAGES,
): TheBattlesStagesOfASide {
  const byFile = new Map<string, { stage: string; line: number }[]>();
  const lined = [...files].map(([file, text]) => ({ file, lines: text.split('\n') }));
  for (const s of stages) {
    const at = lined.flatMap(({ file, lines }) =>
      s.anchors.flatMap((a) => whereTheAnchorStarts(lines, a).map((line) => ({ file, line }))),
    );
    const one = at[0];
    if (at.length > 1)
      throw new Error(
        `stage ${s.stage}'s anchor is in ${String(at.length)} places (${at.map((x) => `${path.basename(x.file)}:${String(x.line)}`).join(', ')})`,
      );
    if (!one)
      throw new Error(
        `stage ${s.stage}'s anchor "${(s.anchors[0] ?? '').split('\n')[0] ?? ''}" is in no file of the side's src/engine/: update tools/proof/the-stages-of-the-two-battles-and-the-lines-that-open-them.ts`,
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

/** The stages of the side whose src/ is `src`, read from its own src/engine/. */
export function theBattlesStagesOfTheSideAt(src: string): TheBattlesStagesOfASide {
  const files = theFilesUnder(path.join(src, 'engine'));
  return theBattlesStagesOfASide(new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')])));
}
