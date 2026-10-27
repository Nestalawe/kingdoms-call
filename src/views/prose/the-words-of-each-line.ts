// ── THE WORDS OF EACH LINE OF THE TURN (plan P1-12c3: P1-12's Decisions of 2026-10-24, Decisions 2 and 3) ────
// The engine files each line of the turn with its finished words or with the fact they are written from (emit,
// src/engine/turn/events-and-their-audiences.ts). The views write every line's words here, after the turn and before
// any realm's lines are picked (buildReports), one module per area (a battle's, personal combat's, the sea lift's in a
// battle, a hero's death's, the wanderer's escape's, and ten order families': Encounter and Defend, the order
// dispatch, the item orders, Research and Practice, Recruit and Hire, the army orders, the realm works, the war
// masteries, espionage, explore and search), each kind routed to its area's (theWordsOf, below). A battle's
// lines take their tiers ('k' key, 'd' detail) and its losses tally its place from those words, as emitBattle did
// before (battleLineTiers and battleTallyLine, src/engine/battle/fates.ts, unchanged). The result is the GM's log
// as it is stored (turn_logs, player index −1), in the same form as before, key for key: the shell saves it, and the
// GM page and the player page's fallback read an old turn's lines and a new one's alike. In this run a line's words are
// the same for every reader.
import { battleLineTiers, battleTallyLine } from '../../engine/battle/fates.ts';
import {
  A_TIER_WORKED_OUT_FROM_THE_WORDS_OF_THE_BATTLES_LINES,
  type LineFact,
  type LogLine,
  type TheAudienceOfAKindOfLine,
} from '../../engine/turn/events-and-their-audiences.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_BATTLES_LINE } from '../../engine/battle/the-facts-a-battles-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE } from '../../engine/personal-combat/the-facts-a-personal-combats-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_SEA_LIFTS_BATTLE_LINE } from '../../engine/units/the-facts-the-sea-lifts-battle-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_DEATHS_LINE } from '../../engine/heroes/the-facts-a-heros-death-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_WANDERERS_ESCAPE } from '../../engine/the-facts-the-wanderers-escape-line-records.ts';
import { theWordsOfABattlesLine } from './the-words-of-a-battles-lines.ts';
import { theWordsOfAPersonalCombatsLine } from './the-words-of-a-personal-combats-lines.ts';
import { theWordsOfASeaLiftsBattleLine } from './the-words-of-the-sea-lifts-battle-lines.ts';
import { theWordsOfAHerosDeathsLine } from './the-words-of-a-heros-deaths-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_AN_ENCOUNTER_OR_DEFEND_ORDERS_LINE } from '../../engine/orders/the-facts-the-encounter-and-defend-orders-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_ORDER_DISPATCHS_LINE } from '../../engine/orders/the-facts-the-order-dispatchs-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_ITEM_ORDERS_LINE } from '../../engine/orders/the-facts-the-item-orders-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_RESEARCH_AND_PRACTICE_ORDERS_LINE } from '../../engine/orders/the-facts-the-research-and-practice-orders-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_RECRUIT_AND_HIRE_ORDERS_LINE } from '../../engine/orders/the-facts-the-recruit-and-hire-orders-lines-record.ts';
import { theWordsOfTheWanderersEscape } from './the-words-of-the-wanderers-escape.ts';
import { theWordsOfAnEncounterOrDefendOrdersLine } from './the-words-of-the-encounter-and-defend-orders-lines.ts';
import { theWordsOfTheOrderDispatchsLine } from './the-words-of-the-order-dispatchs-lines.ts';
import { theWordsOfTheItemOrdersLine } from './the-words-of-the-item-orders-lines.ts';
import { theWordsOfTheResearchAndPracticeOrdersLine } from './the-words-of-the-research-and-practice-orders-lines.ts';
import { theWordsOfTheRecruitAndHireOrdersLine } from './the-words-of-the-recruit-and-hire-orders-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_ARMY_ORDERS_LINE } from '../../engine/orders/the-facts-the-army-orders-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_REALM_WORKS_ORDERS_LINE } from '../../engine/orders/the-facts-the-realm-works-orders-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_WAR_MASTERY_ORDERS_LINE } from '../../engine/orders/the-facts-the-war-mastery-orders-lines-record.ts';
import { theWordsOfTheArmyOrdersLine } from './the-words-of-the-army-orders-lines.ts';
import { theWordsOfTheRealmWorksOrdersLine } from './the-words-of-the-realm-works-orders-lines.ts';
import { theWordsOfTheWarMasteryOrdersLine } from './the-words-of-the-war-mastery-orders-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_ESPIONAGE_ORDERS_LINE } from '../../engine/orders/the-facts-the-espionage-orders-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_EXPLORE_AND_SEARCH_ORDERS_LINE } from '../../engine/orders/the-facts-the-explore-and-search-orders-lines-record.ts';
import { theWordsOfTheEspionageOrdersLine } from './the-words-of-the-espionage-orders-lines.ts';
import { theWordsOfTheExploreAndSearchOrdersLine } from './the-words-of-the-explore-and-search-orders-lines.ts';

// ── THE ROUTE BY KIND (plan P1-12d5: P1-12's Decisions of 2026-10-26, Decision 6) ──
// Each area's kinds are typed beside its code, each with its audience (its audience table lists every kind it has), and
// its words are written in its own module here. The route reads, for a fact's kind, its area's words: built from the
// areas' audience tables, so a kind belongs to one area (one declared in two is a compile error where LineFact is,
// src/engine/turn/events-and-their-audiences.ts).

/** An area's words, as the route reads them: for each of its kinds (by its audience table), the words of its facts. */
function theRouteToAnArea<Fact extends LineFact>(
  audienceOfEachKind: Readonly<Record<Fact['kind'], TheAudienceOfAKindOfLine>>,
  wordsOf: (fact: Fact) => string,
): [string, (fact: LineFact) => string][] {
  const isOneOfItsKinds = (fact: LineFact): fact is Fact => Object.hasOwn(audienceOfEachKind, fact.kind);
  const words = (fact: LineFact): string => {
    if (!isOneOfItsKinds(fact)) throw new Error(`the route took "${fact.kind}" to an area that has no such kind`);
    return wordsOf(fact);
  };
  return Object.keys(audienceOfEachKind).map((kind) => [kind, words]);
}

/** Each kind's words, by its area. */
const THE_WORDS_OF_EACH_KIND: ReadonlyMap<string, (fact: LineFact) => string> = new Map([
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_BATTLES_LINE, theWordsOfABattlesLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE, theWordsOfAPersonalCombatsLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_SEA_LIFTS_BATTLE_LINE, theWordsOfASeaLiftsBattleLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_DEATHS_LINE, theWordsOfAHerosDeathsLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_WANDERERS_ESCAPE, theWordsOfTheWanderersEscape),
  ...theRouteToAnArea(
    THE_AUDIENCE_OF_EACH_KIND_OF_AN_ENCOUNTER_OR_DEFEND_ORDERS_LINE,
    theWordsOfAnEncounterOrDefendOrdersLine,
  ),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_ORDER_DISPATCHS_LINE, theWordsOfTheOrderDispatchsLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_ITEM_ORDERS_LINE, theWordsOfTheItemOrdersLine),
  ...theRouteToAnArea(
    THE_AUDIENCE_OF_EACH_KIND_OF_THE_RESEARCH_AND_PRACTICE_ORDERS_LINE,
    theWordsOfTheResearchAndPracticeOrdersLine,
  ),
  ...theRouteToAnArea(
    THE_AUDIENCE_OF_EACH_KIND_OF_THE_RECRUIT_AND_HIRE_ORDERS_LINE,
    theWordsOfTheRecruitAndHireOrdersLine,
  ),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_ARMY_ORDERS_LINE, theWordsOfTheArmyOrdersLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_REALM_WORKS_ORDERS_LINE, theWordsOfTheRealmWorksOrdersLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_WAR_MASTERY_ORDERS_LINE, theWordsOfTheWarMasteryOrdersLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_ESPIONAGE_ORDERS_LINE, theWordsOfTheEspionageOrdersLine),
  ...theRouteToAnArea(
    THE_AUDIENCE_OF_EACH_KIND_OF_THE_EXPLORE_AND_SEARCH_ORDERS_LINE,
    theWordsOfTheExploreAndSearchOrdersLine,
  ),
]);

/** The words of a fact, of any area: its kind's area writes them. */
export function theWordsOf(fact: LineFact): string {
  const words = THE_WORDS_OF_EACH_KIND.get(fact.kind);
  if (!words) throw new Error(`no area's prose writes the words of "${fact.kind}"`);
  return words(fact);
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
