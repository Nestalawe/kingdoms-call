// The stages of the world's making (generateNewGame, src/engine/world/generate.ts), as the world proof counts its dice
// by stage (the-worlds-making-compared.ts; tools/proof/README.md, section 7). A draw's stage is read from its call
// stack, with no mark in src/: the innermost frame that is a stage's own function (once a split row has moved the stage
// into one), or else generateNewGame's frame, whose line falls between two stages' anchors. An anchor is a line that
// opens its stage (a comment, mostly), found once in generateNewGame's file.
//
// The stages, their names and their functions come from their list in src/ (B-06ab: the split rows, B-06v to B-06aa,
// moved every stage into a function of its own); the anchors are kept here for a base from before the split. A stage
// found on neither side by anchor nor function stops the proof, so a stale table can't count a stage's dice as
// another's.
import fs from 'node:fs';
import path from 'node:path';
import { theStagesTheListHolds } from '../the-worlds-makings-stages-read-from-their-list-in-src.ts';

/** The function the anchors are in, and its file. */
export const THE_ANCHORED_FUNCTION = { file: 'src/engine/world/generate.ts', fn: 'generateNewGame' } as const;

/** One stage: its name (S0 to S17), what it makes, and how a draw is known to be its own: the line that opens it in
 *  generateNewGame, or the function it is in once a split row has moved it out (or both, while the base differs). */
export interface AStageOfTheWorldsMaking {
  stage: string;
  what: string;
  anchor?: string;
  fn?: string;
}

/** The line that opens each stage in generateNewGame's file on a base from before the split (B-06v to B-06aa moved
 *  every stage into a function of its own), kept so the proof still compares a tree with an older base. */
const THE_ANCHORS_AN_OLDER_BASE_HOLDS: Readonly<Record<string, string>> = {
  S0: 'export function generateNewGame(',
  S1: '// ── PHASE 1:',
  S2: '// ── PHASE 2:',
  S3: '// ── PHASE 3:',
  S4: '// Post-generation: add fleet types',
  S5: 'const FLEET_BY_RACE =',
  S6: '// Sea provinces: only non-humanoid sea armies',
  S7: '// ── UNIFIED SEA FEATURES',
  S8: '// ── Home coastal guarantee',
  S9: '// Player starts were already chosen up front',
  S10: '// ── WILD COUNTRY NEAR THE TWO CROWNS',
  S11: '// ── NEUTRAL RACE REBALANCE',
  S12: '// ── MINIMUM TAX FLOOR',
  S13: '// ── COASTAL SHIPYARDS',
  S14: '// ── NEUTRAL DEFENDER BAND AUDIT',
  S15: '// ── THE STRONGEST NEUTRAL MIX',
  S16: '// Neutral heroes — one per non-home land province',
  S17: '// ── THEMATIC NAMING PASS',
};

/** The stages, in the order generateNewGame makes them: their ids, their names in game terms and their functions read
 *  from their list in src/ (tools/the-worlds-makings-stages-read-from-their-list-in-src.ts), each with its anchor. */
export const THE_WORLDS_MAKINGS_STAGES: readonly AStageOfTheWorldsMaking[] = theStagesTheListHolds().map((s) => {
  const anchor = THE_ANCHORS_AN_OLDER_BASE_HOLDS[s.stage];
  return { stage: s.stage, what: s.inGameTerms, fn: s.fn, ...(anchor === undefined ? {} : { anchor }) };
});

/** The key a draw made while the bots' realms are drawn up (generateBotSetups, before the world) is counted under. */
export const THE_BOTS_REALMS = 'bots';
/** The key of a draw no stage claims: made in neither generateNewGame nor a stage's function. */
export const NO_STAGE = 'outside';

/** A side's stages: where each starts in generateNewGame's file, by line (1 is the first), and those known by their
 *  function. */
export interface TheStagesOfASide {
  starts: { stage: string; line: number }[];
  byFunction: Map<string, string>;
}
/** The stages as the text of generateNewGame's file holds them: the anchors it holds, by line, and the stages known by
 *  their function. Throws on an anchor the file holds twice, and on a stage the file holds by neither (the table needs
 *  its row's update). */
export function theStagesOfASide(
  anchoredFileText: string,
  stages: readonly AStageOfTheWorldsMaking[] = THE_WORLDS_MAKINGS_STAGES,
): TheStagesOfASide {
  const lines = anchoredFileText.split('\n');
  const starts: { stage: string; line: number }[] = [];
  const byFunction = new Map<string, string>();
  for (const s of stages) {
    if (s.fn) byFunction.set(s.fn, s.stage);
    if (!s.anchor) continue;
    const anchor = s.anchor;
    const at = lines.flatMap((l, i) => (l.includes(anchor) ? [i + 1] : []));
    if (at.length > 1) throw new Error(`stage ${s.stage}'s anchor "${anchor}" is on ${String(at.length)} lines`);
    const line = at[0];
    if (line !== undefined) starts.push({ stage: s.stage, line });
    else if (!s.fn)
      throw new Error(
        `stage ${s.stage}'s anchor "${anchor}" isn't in ${THE_ANCHORED_FUNCTION.file}, and the stage names no function: update tools/proof/the-worlds-makings-stages.ts`,
      );
  }
  starts.sort((a, b) => a.line - b.line);
  return { starts, byFunction };
}

/** A frame of a draw's call stack, as node:util's getCallSites gives it. */
export interface AFrame {
  functionName: string;
  scriptName: string;
  lineNumber: number;
}

/** The stage a draw belongs to, from its call stack (the innermost frame first): the innermost frame of a stage's own
 *  function in `src`, or else the stage whose anchor is the last at or before generateNewGame's frame's line; NO_STAGE
 *  when the stack holds neither. */
export function theStageOfADraw(frames: readonly AFrame[], side: TheStagesOfASide, src: string): string {
  const anchored = path.join(src, '..', THE_ANCHORED_FUNCTION.file);
  for (const f of frames) {
    if (!f.scriptName.startsWith(src + path.sep)) continue;
    const name = f.functionName.split('.').pop() ?? '';
    const ownStage = side.byFunction.get(name);
    if (ownStage) return ownStage;
    if (name === THE_ANCHORED_FUNCTION.fn && f.scriptName === anchored) {
      let stage = NO_STAGE;
      for (const s of side.starts) if (f.lineNumber >= s.line) stage = s.stage;
      return stage;
    }
  }
  return NO_STAGE;
}

/** The stages of the side whose src/ is `src`, read from its own generateNewGame's file. */
export const theStagesOfTheSideAt = (src: string): TheStagesOfASide =>
  theStagesOfASide(fs.readFileSync(path.join(src, '..', THE_ANCHORED_FUNCTION.file), 'utf8'));
