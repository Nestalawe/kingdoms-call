// The stages of the two battles, as the battle proof counts their dice by stage (the-battles-compared-each-staged-
// battle-its-lines-its-world-and-its-dice-by-stage.ts; tools/proof/README.md, section 8): the battle against a
// province's defenders (combatVsNPC) and the battle between heroes (combatVsChar). A draw's stage is read from its call
// stack, with no mark in src/, as the world proof reads the world's making's (the-worlds-makings-stages.ts): the
// innermost frame that is a stage's own function (once a split row has moved the stage into one), or else the battle's
// own frame, whose line falls between two stages' anchors. An anchor is a line that opens its stage (a comment, mostly),
// found once in its battle's file. A helper the battle calls (the duel, the fates, fortune, a rule's effect) draws
// under the stage whose line called it.
//
// The list is kept here until each battle's own stage list is in src/ (B-06bl). The split rows (B-06az to B-06bd for
// the battle against the defenders, B-06bf to B-06bj for the battle between heroes) add each moved stage's `fn:`: a
// stage whose anchor has left the file is then known by its function. A stage found on a side by neither stops the
// proof, so a stale list can't count a stage's dice as another's.
import fs from 'node:fs';
import path from 'node:path';

/** The two battles: the function the anchors are in, and its file. */
export const THE_TWO_BATTLES = {
  'against the defenders': { file: 'src/engine/battle/battles-against-province-defenders.ts', fn: 'combatVsNPC' },
  'between heroes': { file: 'src/engine/battle/battles-between-heroes.ts', fn: 'combatVsChar' },
} as const;
export type ABattle = keyof typeof THE_TWO_BATTLES;
export const THE_BATTLES: readonly ABattle[] = ['against the defenders', 'between heroes'];

/** One stage of a battle: its id (N0… for the battle against the defenders, H0… for the battle between heroes), what
 *  it fights in game terms, and how a draw is known to be its own: the line that opens it in its battle's function, or
 *  the function it is in once a split row has moved it out (or both, while the base differs). */
export interface AStageOfABattle {
  battle: ABattle;
  stage: string;
  what: string;
  anchor?: string;
  fn?: string;
}

/** The stages of both battles, each battle's in the order it fights them. */
export const THE_BATTLES_STAGES: readonly AStageOfABattle[] = [
  {
    battle: 'against the defenders',
    stage: 'N0',
    what: 'the set-up: the negations, the tiers that fight, the deploy line, Terror',
    anchor: 'export function combatVsNPC(',
  },
  {
    battle: 'against the defenders',
    stage: 'N1',
    what: 'the duel before the battle',
    anchor: '// ── Duel before battle ──',
  },
  {
    battle: 'against the defenders',
    stage: 'N2',
    what: "the sides: a slain commander, Tactical, the defender's edge and Siege, Righteous Defence, the items at the walls, home",
    anchor: "// The attacker's side as the facts hold it (plan P1-12d23)",
  },
  {
    battle: 'against the defenders',
    stage: 'N3',
    what: "the attacker's pre-battle magic and army spells",
    anchor: '// PRE-BATTLE PHASE 1: MAGIC Hero casts first',
  },
  {
    battle: 'against the defenders',
    stage: 'N4',
    what: "the attacker's archery, Flak and Breach",
    anchor: '// PRE-BATTLE PHASE 2: ARCHERY Each attacker',
  },
  {
    battle: 'against the defenders',
    stage: 'N5',
    what: "the defenders' commander's pre-battle magic",
    anchor: '// DEFENDER PRE-BATTLE PHASES',
  },
  {
    battle: 'against the defenders',
    stage: 'N6',
    what: "the defenders' archery",
    anchor: '// DEFENDER ARCHERY — 2026-09-24',
  },
  {
    battle: 'against the defenders',
    stage: 'N7',
    what: "the defenders' army spells",
    anchor: '// DEFENDER ARMY SPELLS:',
  },
  {
    battle: 'against the defenders',
    stage: 'N8',
    what: "the terrain's notes and the battle lines, every multiplier",
    anchor: '// ── TERRAIN MODIFIER NOTES ──',
  },
  {
    battle: 'against the defenders',
    stage: 'N9',
    what: 'the fortune of battle',
    anchor: '// Roll with variance — each side rolls',
  },
  {
    battle: 'against the defenders',
    stage: 'N10',
    what: 'the stat block and the result',
    anchor: '// ── STAT BLOCK (visible to GM',
  },
  {
    battle: 'against the defenders',
    stage: 'N11',
    what: 'the casualty bands and the carry-on',
    anchor: '// ── MARGIN-BASED CASUALTY SYSTEM ──',
  },
  {
    battle: 'against the defenders',
    stage: 'N12',
    what: "the fates and the rout's three stages",
    anchor: '// UNIT ABILITIES vs NEUTRAL GUARDS',
  },
  {
    battle: 'against the defenders',
    stage: 'N13',
    what: 'the end: the spells lifted, the skills learned',
    anchor: '// Battle-magic strength reductions last only for this battle',
  },
  {
    battle: 'between heroes',
    stage: 'H0',
    what: "the set-up and the titles' merit tally",
    anchor: 'export function combatVsChar(',
  },
  {
    battle: 'between heroes',
    stage: 'H1',
    what: 'the duel before the battle',
    anchor: '// ── DUEL BEFORE BATTLE (Adventurer Kings rules) ──',
  },
  {
    battle: 'between heroes',
    stage: 'H2',
    what: "Righteous Defence, the zeal, Consecrate's seizure, home and the front",
    anchor: '// GOOD — Righteous Defence: +10% when a Good player',
  },
  {
    battle: 'between heroes',
    stage: 'H3',
    what: "both sides' pre-battle magic and army spells",
    anchor: '// PRE-BATTLE PHASE 1: MAGIC (both sides)',
  },
  {
    battle: 'between heroes',
    stage: 'H4',
    what: "both sides' archery, Flak and Breach",
    anchor: '// PRE-BATTLE PHASE 2: ARCHERY (both sides)',
  },
  {
    battle: 'between heroes',
    stage: 'H5',
    what: "Sanctuary, the mastery orders, Consecrate's sickness, Tactical and the lines",
    anchor: '// WHITE L7 — Sanctuary: enemies of the warding caster',
  },
  {
    battle: 'between heroes',
    stage: 'H6',
    what: 'the fortune of battle',
    anchor: '// Dice basis unified with the NPC path',
  },
  {
    battle: 'between heroes',
    stage: 'H7',
    what: 'the stat block and the result',
    anchor: '// ── STAT BLOCK ── 2026-09-23b',
  },
  {
    battle: 'between heroes',
    stage: 'H8',
    what: 'the casualty bands and the carry-on',
    anchor: 'const margRatioPvP = margin / totalStrPvP;',
  },
  {
    battle: 'between heroes',
    stage: 'H9',
    what: 'the fates, the rout and the aftermath',
    anchor: '// ── UNIT ABILITIES: casualty & retreat ──',
  },
  {
    battle: 'between heroes',
    stage: 'H10',
    what: 'the end: the spells lifted, the skills learned',
    anchor: '// Battle-magic strength reductions last only for this battle',
  },
];

/** The key of a draw no stage claims: made in neither battle's function nor a stage's own. */
export const NO_STAGE = 'outside';

/** One battle's stages on a side: where each starts in its battle's file, by line (1 is the first). */
export interface TheStagesOfABattlesSide {
  starts: { stage: string; line: number }[];
}
/** Both battles' stages on a side: each battle's anchored stages, and every stage known by its function. */
export interface TheBattlesStagesOfASide {
  byBattle: Record<ABattle, TheStagesOfABattlesSide>;
  byFunction: Map<string, string>;
}

/** One battle's stages as the text of its file holds them: the anchors it holds, by line. Throws on an anchor the
 *  file holds twice, and on a stage the file holds by neither anchor nor function (the list needs its row's update). */
export function theStagesOfABattle(
  battle: ABattle,
  fileText: string,
  stages: readonly AStageOfABattle[] = THE_BATTLES_STAGES,
): TheStagesOfABattlesSide {
  const lines = fileText.split('\n');
  const starts: { stage: string; line: number }[] = [];
  for (const s of stages) {
    if (s.battle !== battle || !s.anchor) continue;
    const anchor = s.anchor;
    const at = lines.flatMap((l, i) => (l.includes(anchor) ? [i + 1] : []));
    if (at.length > 1) throw new Error(`stage ${s.stage}'s anchor "${anchor}" is on ${String(at.length)} lines`);
    const line = at[0];
    if (line !== undefined) starts.push({ stage: s.stage, line });
    else if (!s.fn)
      throw new Error(
        `stage ${s.stage}'s anchor "${anchor}" isn't in ${THE_TWO_BATTLES[battle].file}, and the stage names no function: update tools/proof/the-stages-of-the-two-battles-and-the-lines-that-open-them.ts`,
      );
  }
  starts.sort((a, b) => a.line - b.line);
  return { starts };
}

/** Both battles' stages, from the texts of their files (read by `read`, a path relative to the repository). */
export function theBattlesStagesOfASide(
  read: (file: string) => string,
  stages: readonly AStageOfABattle[] = THE_BATTLES_STAGES,
): TheBattlesStagesOfASide {
  const byFunction = new Map<string, string>();
  for (const s of stages) if (s.fn) byFunction.set(s.fn, s.stage);
  const byBattle = {} as Record<ABattle, TheStagesOfABattlesSide>;
  for (const b of THE_BATTLES) byBattle[b] = theStagesOfABattle(b, read(THE_TWO_BATTLES[b].file), stages);
  return { byBattle, byFunction };
}

/** A frame of a draw's call stack, as node:util's getCallSites gives it. */
export interface AFrame {
  functionName: string;
  scriptName: string;
  lineNumber: number;
}

/** The stage a draw belongs to, from its call stack (the innermost frame first): the innermost frame of a stage's own
 *  function in `src`, or else the stage whose anchor is the last at or before its battle's frame's line; NO_STAGE when
 *  the stack holds neither. */
export function theStageOfADraw(frames: readonly AFrame[], side: TheBattlesStagesOfASide, src: string): string {
  const root = path.join(src, '..');
  for (const f of frames) {
    if (!f.scriptName.startsWith(src + path.sep)) continue;
    const name = f.functionName.split('.').pop() ?? '';
    const ownStage = side.byFunction.get(name);
    if (ownStage) return ownStage;
    for (const b of THE_BATTLES) {
      const { file, fn } = THE_TWO_BATTLES[b];
      if (name !== fn || f.scriptName !== path.join(root, file)) continue;
      let stage = NO_STAGE;
      for (const s of side.byBattle[b].starts) if (f.lineNumber >= s.line) stage = s.stage;
      return stage;
    }
  }
  return NO_STAGE;
}

/** The stages of the side whose src/ is `src`, read from its own battles' files. */
export const theBattlesStagesOfTheSideAt = (src: string): TheBattlesStagesOfASide =>
  theBattlesStagesOfASide((file) => fs.readFileSync(path.join(src, '..', file), 'utf8'));
