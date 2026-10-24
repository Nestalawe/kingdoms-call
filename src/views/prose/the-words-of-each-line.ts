// ── THE WORDS OF EACH LINE OF THE TURN (plan P1-12c3: P1-12's Decisions of 2026-10-24, Decisions 2 and 3) ────
// The engine files each line of the turn with its finished words or with the fact they are written from (emit,
// src/engine/turn/events-and-their-audiences.ts). The views write every line's words here, after the turn and before
// any realm's lines are picked (buildReports), one module per area (the-words-of-a-battles-lines.ts the first). A
// battle's lines take their tiers ('k' key, 'd' detail) and its losses tally its place from those words, as emitBattle
// did before (battleLineTiers and battleTallyLine, src/engine/battle/fates.ts, unchanged). The result is the GM's log
// as it is stored (turn_logs, player index −1), in the same form as before, key for key: the shell saves it, and the
// GM page and the player page's fallback read an old turn's lines and a new one's alike. In this run a line's words are
// the same for every reader.
import { battleLineTiers, battleTallyLine } from '../../engine/battle/fates.ts';
import {
  A_TIER_WORKED_OUT_FROM_THE_WORDS_OF_THE_BATTLES_LINES,
  type LineFact,
  type LogLine,
} from '../../engine/turn/events-and-their-audiences.ts';
import { theWordsOfABattlesLine } from './the-words-of-a-battles-lines.ts';

/** The words of a fact, of any area. */
export function theWordsOf(fact: LineFact): string {
  return theWordsOfABattlesLine(fact);
}

/** The GM's log of the turn with every line's words, as it is stored and as the realms' lines are read from it; and
 *  the words of each line of the engine's log, in its order (null: a battle's tally place left empty, which is no
 *  line). */
export interface TheTurnsLinesInWords {
  gmLog: LogLine[];
  wordsOfEachLine: (string | null)[];
}

/** A line as the GM's log stores it: its words in place of its fact, and its tier when it is a battle's. */
function asStored(line: LogLine, text: string | null, tier?: string): LogLine {
  const stored: LogLine = { ...line, text };
  if (tier !== undefined) stored.bTier = tier;
  delete stored.fact;
  return stored;
}

/** Every line of the turn with its words, in order; a battle's lines with their tiers, and its losses tally where its
 *  casualty lists begin (else after its lines, or nowhere when there is none to tally). */
export function theTurnsLinesInWords(turnLog: readonly LogLine[]): TheTurnsLinesInWords {
  const gmLog: LogLine[] = [];
  const wordsOfEachLine: (string | null)[] = turnLog.map(() => null);
  const wordsOfLine = (line: LogLine): string | null => (line.fact === undefined ? line.text : theWordsOf(line.fact));
  // A battle's lines, as emitBattle files them one after the other, each with its index in the engine's log.
  let battlesLines: { at: number; line: LogLine }[] = [];
  const theBattlesLinesWritten = (tallysPlace: { at: number; line: LogLine } | null) => {
    if (!battlesLines.length && !tallysPlace) return;
    const texts = battlesLines.map(({ line }) => wordsOfLine(line));
    const { t: tiers, casIdx } = battleLineTiers(texts);
    // Each tier as battleLineTiers gives it ('k' or 'd'), else 'k'.
    const tierOf = (k: number): string => {
      const tier: unknown = tiers[k];
      return typeof tier === 'string' && tier !== '' ? tier : 'k';
    };
    let tally: string | null = null;
    if (tallysPlace) {
      try {
        tally = battleTallyLine(texts);
      } catch {
        tally = null;
      }
    }
    let tallyWritten = false;
    const theTally = () => {
      if (!tallysPlace || !tally || tallyWritten) return;
      gmLog.push(asStored(tallysPlace.line, tally, 't'));
      wordsOfEachLine[tallysPlace.at] = tally;
      tallyWritten = true;
    };
    battlesLines.forEach(({ at, line }, k) => {
      if (k === casIdx) theTally();
      const words = texts[k] ?? null;
      gmLog.push(asStored(line, words, tierOf(k)));
      wordsOfEachLine[at] = words;
    });
    theTally();
    battlesLines = [];
  };
  turnLog.forEach((line, at) => {
    const ofTheSameBattle = battlesLines[0]?.line.battleId === line.battleId;
    if (line.bTier === A_TIER_WORKED_OUT_FROM_THE_WORDS_OF_THE_BATTLES_LINES) {
      if (!ofTheSameBattle) theBattlesLinesWritten(null);
      battlesLines.push({ at, line });
      return;
    }
    if (line.fact?.kind === "a battle's losses, tallied from its lines") {
      if (!ofTheSameBattle) theBattlesLinesWritten(null);
      theBattlesLinesWritten({ at, line });
      return;
    }
    theBattlesLinesWritten(null);
    if (line.fact === undefined) {
      gmLog.push(line);
      wordsOfEachLine[at] = line.text;
      return;
    }
    const words = theWordsOf(line.fact);
    gmLog.push(asStored(line, words));
    wordsOfEachLine[at] = words;
  });
  theBattlesLinesWritten(null);
  return { gmLog, wordsOfEachLine };
}
