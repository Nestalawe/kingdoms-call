// The stages of the world's making (generateNewGame, src/engine/world/generate.ts), as the world proof counts its dice
// by stage (the-worlds-making-compared.ts; tools/proof/README.md, section 7). A draw's stage is read from its call
// stack, with no mark in src/: the innermost frame that is a stage's own function (once a split row has moved the stage
// into one), or else generateNewGame's frame, whose line falls between two stages' anchors. An anchor is a line that
// opens its stage (a comment, mostly), found once in generateNewGame's file.
//
// The split rows (B-06v to B-06aa) update this table: a row that moves a stage into a function of its own adds the
// function's name to the stage (`fn`), keeping its anchor while the row's base still has it there; the row after may
// drop an anchor no side holds. A stage found on neither side by anchor nor function stops the proof, so a stale table
// can't count a stage's dice as another's.
import fs from 'node:fs';
import path from 'node:path';

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

/** The stages, in the order generateNewGame makes them (Run 2a's scoping, section 2). */
export const THE_WORLDS_MAKINGS_STAGES: readonly AStageOfTheWorldsMaking[] = [
  {
    stage: 'S0',
    what: 'the set-up, the naming pools and their functions',
    anchor: 'export function generateNewGame(',
    fn: 'theSetUpTheMapsGridAndTheProvincesNames',
  },
  {
    stage: 'S1',
    what: 'the capitals',
    anchor: '// ── PHASE 1:',
    fn: 'theCapitalsPlacedAsFarApartAsTheMapAllows',
  },
  {
    stage: 'S2',
    what: "each home's ring",
    anchor: '// ── PHASE 2:',
    fn: 'eachHomesRingTailoredAndTheSeasFillRates',
  },
  {
    stage: 'S3',
    what: 'the provinces: tax, primal, armies, features and lairs, ritual sites',
    anchor: '// ── PHASE 3:',
    fn: 'everyProvinceMadeItsTerrainTaxArmiesAndLairs',
  },
  {
    stage: 'S4',
    what: 'the races dealt to their heartlands',
    anchor: '// Post-generation: add fleet types',
    fn: 'theRacesDealtToTheirHeartlandsInEqualShares',
  },
  {
    stage: 'S5',
    what: 'the coastal fleets',
    anchor: 'const FLEET_BY_RACE =',
    fn: 'theCoastalFleetsAHumanoidShoreOffers',
  },
  {
    stage: 'S6',
    what: 'the seas by kind',
    anchor: '// Sea provinces: only non-humanoid sea armies',
    fn: 'theSeasByKindPrimalPoorWatersAndOpenWater',
  },
  {
    stage: 'S7',
    what: 'the sea features and their guardians',
    anchor: '// ── UNIFIED SEA FEATURES',
    fn: 'theSeaFeaturesAndTheirGuardiansInEverySea',
  },
  {
    stage: 'S8',
    what: "the home's open-water sea",
    anchor: '// ── Home coastal guarantee',
    fn: 'aCoastalHomeBordersAnOpenWaterSea',
  },
  {
    stage: 'S9',
    what: "the homes: the colours, each home's tailoring, its king and two heroes",
    anchor: '// Player starts were already chosen up front',
  },
  { stage: 'S10', what: 'wild country near the two crowns', anchor: '// ── WILD COUNTRY NEAR THE TWO CROWNS' },
  { stage: 'S11', what: 'the neutral races rebalanced', anchor: '// ── NEUTRAL RACE REBALANCE' },
  { stage: 'S12', what: 'the tax floor', anchor: '// ── MINIMUM TAX FLOOR' },
  { stage: 'S13', what: 'the coastal shipyards', anchor: '// ── COASTAL SHIPYARDS' },
  { stage: 'S14', what: 'the defender band audit', anchor: '// ── NEUTRAL DEFENDER BAND AUDIT' },
  { stage: 'S15', what: 'the strongest neutral mix', anchor: '// ── THE STRONGEST NEUTRAL MIX' },
  {
    stage: 'S16',
    what: "neutral heroes and Garreth's province",
    anchor: '// Neutral heroes — one per non-home land province',
  },
  {
    stage: 'S17',
    what: 'the naming pass, turn orders, the state, mithril, the lairs, HP',
    anchor: '// ── THEMATIC NAMING PASS',
  },
];

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
