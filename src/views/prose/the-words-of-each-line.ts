// ── THE WORDS OF EACH LINE OF THE TURN (plan P1-12c3: P1-12's Decisions of 2026-10-24, Decisions 2 and 3) ────
// The engine files each line of the turn with its finished words or with the fact they are written from (emit,
// src/engine/turn/events-and-their-audiences.ts). The views write every line's words here, after the turn and before
// any realm's lines are picked (buildReports), one module per area (a battle's, personal combat's, the sea lift's in a
// battle, a hero's death's, the wanderer's escape's, and twelve order families': Encounter and Defend, the order
// dispatch, the item orders, Research and Practice, Recruit and Hire, the army orders, the realm works, the war
// masteries, espionage, explore and search, Cast Spell, the move order; and since P1-12d12 a chase's and a hero's
// experience and hit points', since P1-12d13 the title intelligence's, since P1-12d14 the Defend watch's, a stranding
// at sea's and the war-spoils', since P1-12d15 the lines before the first phase, the new turn's, a phase's, the intrusion
// warnings', a Defend watch met in battle's and a silent hero's season's, since P1-12d16 the lines after the phases,
// diplomacy's and victory's, and Early Winter's, since P1-12d17 the other folders': what a spy learns, relations and
// captures, the Plague and the Bless ward, a rallied garrison and Wraith's Touch, a bot's concession, the Spy
// stealth's), each kind routed to its area's (theWordsOf, below). A battle's
// lines take their tiers ('k' key: the short account and the full report; 'd' detail: the full report only) from their
// kinds, each area's table beside its audience table (since P1-12d34; theTiersOfABattlesLines, below), and its losses
// tally ('t': the short account only) its place where its casualty lists begin; since P1-12d35 the tally is written from
// the facts of the battle's lines (theWordsOfABattlesLossesTally, the-words-of-a-battles-losses-tally.ts); the onlookers'
// one-line summary is 's' (shown only to a realm with nothing else of the battle). The result is the GM's log
// as it is stored (turn_logs, player index −1), in the same form as before, key for key: the shell saves it, and the
// GM page and the player page's fallback read an old turn's lines and a new one's alike. Beside it, each stored line's
// kind, never stored (since P1-12d36: the spy and Clairvoyance feeds pass over a line by its kind). In this run a line's
// words are the same for every reader.
import {
  A_TIER_WORKED_OUT_FROM_THE_WORDS_OF_THE_BATTLES_LINES,
  type LineFact,
  type LogLine,
  type TheAudienceOfAKindOfLine,
  type TheTierOfAKindOfABattlesLine,
} from '../../engine/turn/events-and-their-audiences.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_BATTLES_LINE,
  THE_TIER_OF_EACH_KIND_OF_A_BATTLES_LINE,
} from '../../engine/battle/the-facts-a-battles-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE,
  THE_TIER_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE,
} from '../../engine/personal-combat/the-facts-a-personal-combats-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_SEA_LIFTS_BATTLE_LINE,
  THE_TIER_OF_EACH_KIND_OF_A_SEA_LIFTS_BATTLE_LINE,
} from '../../engine/units/the-facts-the-sea-lifts-battle-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_DEATHS_LINE,
  THE_TIER_OF_EACH_KIND_OF_A_HEROS_DEATHS_LINE,
} from '../../engine/heroes/the-facts-a-heros-death-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_WANDERERS_ESCAPE,
  THE_TIER_OF_EACH_KIND_OF_THE_WANDERERS_ESCAPE,
} from '../../engine/the-facts-the-wanderers-escape-line-records.ts';
import { theWordsOfABattlesLine } from './the-words-of-a-battles-lines.ts';
import { theWordsOfABattlesLossesTally } from './the-words-of-a-battles-losses-tally.ts';
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
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_CAST_SPELL_ORDERS_LINE } from '../../engine/orders/the-facts-the-cast-spell-orders-lines-record.ts';
import { theWordsOfTheCastSpellOrdersLine } from './the-words-of-the-cast-spell-orders-lines.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_MOVE_ORDERS_LINE,
  THE_TIER_OF_EACH_KIND_OF_THE_MOVE_ORDERS_LINE_A_BATTLE_TELLS,
} from '../../engine/orders/the-facts-the-move-orders-lines-record.ts';
import { theWordsOfTheMoveOrdersLine } from './the-words-of-the-move-orders-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_CHASES_LINE } from '../../engine/heroes/the-facts-a-chases-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_EXPERIENCE_LINE } from '../../engine/heroes/the-facts-a-heros-experience-lines-record.ts';
import { theWordsOfAChasesLine } from './the-words-of-a-chases-lines.ts';
import { theWordsOfAHerosExperienceLine } from './the-words-of-a-heros-experience-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_TITLE_INTELLIGENCE_LINE } from '../../engine/titles/the-facts-the-title-intelligence-lines-record.ts';
import { theWordsOfATitleIntelligenceLine } from './the-words-of-the-title-intelligence-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_DEFEND_WATCHS_LINE } from '../../engine/units/the-facts-the-defend-watchs-lines-record.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_STRANDING_AT_SEAS_LINE } from '../../engine/units/the-facts-a-stranding-at-seas-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_WAR_SPOILS_LINE,
  THE_TIER_OF_EACH_KIND_OF_THE_WAR_SPOILS_LINE,
} from '../../engine/units/the-facts-the-war-spoils-line-records.ts';
import { theWordsOfADefendWatchsLine } from './the-words-of-the-defend-watchs-lines.ts';
import { theWordsOfAStrandingAtSeasLine } from './the-words-of-a-stranding-at-seas-lines.ts';
import { theWordsOfTheWarSpoilsLine } from './the-words-of-the-war-spoils-line.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_LINE_BEFORE_THE_FIRST_PHASE } from '../../engine/turn/the-facts-the-lines-before-the-first-phase-record.ts';
import { theWordsOfALineBeforeTheFirstPhase } from './the-words-of-the-lines-before-the-first-phase.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_NEW_TURNS_LINE } from '../../engine/turn/the-facts-the-new-turns-lines-record.ts';
import { theWordsOfANewTurnsLine } from './the-words-of-the-new-turns-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_PHASES_LINE } from '../../engine/turn/the-facts-a-phases-lines-record.ts';
import { theWordsOfAPhasesLine } from './the-words-of-a-phases-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_AN_INTRUSION_WARNINGS_LINE } from '../../engine/turn/the-facts-the-intrusion-warnings-lines-record.ts';
import { theWordsOfAnIntrusionWarningsLine } from './the-words-of-the-intrusion-warnings-lines.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_DEFEND_WATCH_MET_IN_BATTLES_LINE,
  THE_TIER_OF_EACH_KIND_OF_A_DEFEND_WATCH_MET_IN_BATTLES_LINE,
} from '../../engine/turn/the-facts-a-defend-watch-met-in-battle-lines-record.ts';
import { theWordsOfADefendWatchMetInBattlesLine } from './the-words-of-a-defend-watch-met-in-battle-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_SILENT_HEROS_SEASON_LINE } from '../../engine/turn/the-facts-a-silent-heros-season-line-records.ts';
import { theWordsOfASilentHerosSeasonLine } from './the-words-of-a-silent-heros-season-line.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_LINE_AFTER_THE_PHASES } from '../../engine/turn/the-facts-the-lines-after-the-phases-record.ts';
import { theWordsOfALineAfterThePhases } from './the-words-of-the-lines-after-the-phases.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_DIPLOMACY_OR_VICTORY_LINE } from '../../engine/turn/the-facts-diplomacy-and-victorys-lines-record.ts';
import { theWordsOfADiplomacyOrVictoryLine } from './the-words-of-diplomacy-and-victorys-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_AN_EARLY_WINTERS_LINE } from '../../engine/turn/the-facts-early-winters-lines-record.ts';
import { theWordsOfAnEarlyWintersLine } from './the-words-of-early-winters-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_WHAT_A_SPY_LEARNS_LINE } from '../../engine/espionage/the-facts-what-a-spy-learns-lines-record.ts';
import { theWordsOfWhatASpyLearnsLine } from './the-words-of-what-a-spy-learns-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_RELATIONS_AND_CAPTURES_LINE } from '../../engine/realms/the-facts-relations-and-captures-lines-record.ts';
import { theWordsOfARelationsAndCapturesLine } from './the-words-of-relations-and-captures-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_PLAGUE_OR_BLESS_WARD_LINE } from '../../engine/magic/the-facts-plague-and-bless-ward-lines-record.ts';
import { theWordsOfAPlagueOrBlessWardLine } from './the-words-of-plague-and-bless-ward-lines.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_RALLIED_GARRISON_OR_WRAITHS_TOUCH_LINE,
  THE_TIER_OF_EACH_KIND_OF_A_RALLIED_GARRISON_OR_WRAITHS_TOUCH_LINE_A_BATTLE_TELLS,
} from '../../engine/world/the-facts-rallied-garrisons-and-wraiths-touch-lines-record.ts';
import { theWordsOfARalliedGarrisonOrWraithsTouchLine } from './the-words-of-rallied-garrisons-and-wraiths-touch-lines.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_A_BOTS_CONCESSION_LINE } from '../../engine/bots/the-facts-a-bots-concession-line-records.ts';
import { theWordsOfABotsConcessionLine } from './the-words-of-a-bots-concession-line.ts';
import { THE_AUDIENCE_OF_EACH_KIND_OF_THE_SPY_STEALTH_LINE } from '../../engine/turn/the-facts-the-spy-stealth-line-records.ts';
import { theWordsOfTheSpyStealthLine } from './the-words-of-the-spy-stealth-line.ts';

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
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_CAST_SPELL_ORDERS_LINE, theWordsOfTheCastSpellOrdersLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_MOVE_ORDERS_LINE, theWordsOfTheMoveOrdersLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_CHASES_LINE, theWordsOfAChasesLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_EXPERIENCE_LINE, theWordsOfAHerosExperienceLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_TITLE_INTELLIGENCE_LINE, theWordsOfATitleIntelligenceLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_DEFEND_WATCHS_LINE, theWordsOfADefendWatchsLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_STRANDING_AT_SEAS_LINE, theWordsOfAStrandingAtSeasLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_WAR_SPOILS_LINE, theWordsOfTheWarSpoilsLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_LINE_BEFORE_THE_FIRST_PHASE, theWordsOfALineBeforeTheFirstPhase),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_NEW_TURNS_LINE, theWordsOfANewTurnsLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_PHASES_LINE, theWordsOfAPhasesLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_AN_INTRUSION_WARNINGS_LINE, theWordsOfAnIntrusionWarningsLine),
  ...theRouteToAnArea(
    THE_AUDIENCE_OF_EACH_KIND_OF_A_DEFEND_WATCH_MET_IN_BATTLES_LINE,
    theWordsOfADefendWatchMetInBattlesLine,
  ),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_SILENT_HEROS_SEASON_LINE, theWordsOfASilentHerosSeasonLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_LINE_AFTER_THE_PHASES, theWordsOfALineAfterThePhases),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_DIPLOMACY_OR_VICTORY_LINE, theWordsOfADiplomacyOrVictoryLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_AN_EARLY_WINTERS_LINE, theWordsOfAnEarlyWintersLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_WHAT_A_SPY_LEARNS_LINE, theWordsOfWhatASpyLearnsLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_RELATIONS_AND_CAPTURES_LINE, theWordsOfARelationsAndCapturesLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_PLAGUE_OR_BLESS_WARD_LINE, theWordsOfAPlagueOrBlessWardLine),
  ...theRouteToAnArea(
    THE_AUDIENCE_OF_EACH_KIND_OF_A_RALLIED_GARRISON_OR_WRAITHS_TOUCH_LINE,
    theWordsOfARalliedGarrisonOrWraithsTouchLine,
  ),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_A_BOTS_CONCESSION_LINE, theWordsOfABotsConcessionLine),
  ...theRouteToAnArea(THE_AUDIENCE_OF_EACH_KIND_OF_THE_SPY_STEALTH_LINE, theWordsOfTheSpyStealthLine),
]);

/** The words of a fact, of any area: its kind's area writes them. */
export function theWordsOf(fact: LineFact): string {
  const words = THE_WORDS_OF_EACH_KIND.get(fact.kind);
  if (!words) throw new Error(`no area's prose writes the words of "${fact.kind}"`);
  return words(fact);
}

/** The GM's log of the turn with every line's words, as it is stored and as the realms' lines are read from it; the
 *  kind of each of its lines, in its order, beside it and never stored (null: a line with no fact; plan P1-12d36: the
 *  spy and Clairvoyance feeds pass over a line by its kind); and the words of each line of the engine's log, in its
 *  order (null: a battle's tally place left empty, which is no line). */
export interface TheTurnsLinesInWords {
  gmLog: LogLine[];
  theKindOfEachStoredLine: (LineFact['kind'] | null)[];
  wordsOfEachLine: (string | null)[];
}

// ── A BATTLE'S TIERS, BY KIND (plan P1-12d34: P1-12d's Decisions of 2026-11-01, Decision 2) ──
// Each kind a battle's lines may hold has its tier in its area's table, beside its audience table: a battle's, personal
// combat's (a duel before the battle, a chase fought as one), the sea lift's, a hero's death's and the wanderer's escape's
// (the duel before the battle), a Defend watch met in battle's, the war-spoils', and the kinds of the move order's and of
// Wraith's Touch a battle tells. Each is what the kind's words gave when the tiers were read from them, for the names a
// game writes.

/** Each kind's tier in a battle's lines, by its area's table. */
const THE_TIER_OF_EACH_KIND: ReadonlyMap<string, TheTierOfAKindOfABattlesLine> = new Map<
  string,
  TheTierOfAKindOfABattlesLine
>([
  ...Object.entries(THE_TIER_OF_EACH_KIND_OF_A_BATTLES_LINE),
  ...Object.entries(THE_TIER_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE),
  ...Object.entries(THE_TIER_OF_EACH_KIND_OF_A_SEA_LIFTS_BATTLE_LINE),
  ...Object.entries(THE_TIER_OF_EACH_KIND_OF_A_HEROS_DEATHS_LINE),
  ...Object.entries(THE_TIER_OF_EACH_KIND_OF_THE_WANDERERS_ESCAPE),
  ...Object.entries(THE_TIER_OF_EACH_KIND_OF_A_DEFEND_WATCH_MET_IN_BATTLES_LINE),
  ...Object.entries(THE_TIER_OF_EACH_KIND_OF_THE_WAR_SPOILS_LINE),
  ...Object.entries(THE_TIER_OF_EACH_KIND_OF_THE_MOVE_ORDERS_LINE_A_BATTLE_TELLS),
  ...Object.entries(THE_TIER_OF_EACH_KIND_OF_A_RALLIED_GARRISON_OR_WRAITHS_TOUCH_LINE_A_BATTLE_TELLS),
]);

/** A battle's lines' tiers ('k' key, 'd' detail), each its kind's (a kind no table lists, or a line with no fact: 'k'),
 *  and where its casualty lists begin: the first casualty list's header (-1: none). A line of the casualty lists is
 *  'd' once a header is before it, else 'k'; the fortune of the battle is 'd' when a side brings no strength. */
export function theTiersOfABattlesLines(lines: readonly LogLine[]): {
  tiers: ('k' | 'd')[];
  whereTheCasualtyListsBegin: number;
} {
  let whereTheCasualtyListsBegin = -1;
  const tiers = lines.map((line, k): 'k' | 'd' => {
    const fact = line.fact;
    if (fact === undefined) return 'k';
    const tier = THE_TIER_OF_EACH_KIND.get(fact.kind) ?? 'k';
    switch (tier) {
      case 'k':
      case 'd':
        return tier;
      case "a casualty list's header: 'd', and the casualty lists begin":
        if (whereTheCasualtyListsBegin < 0) whereTheCasualtyListsBegin = k;
        return 'd';
      case "'d' once the casualty lists have begun, 'k' before":
        return whereTheCasualtyListsBegin >= 0 ? 'd' : 'k';
      case "the fortune's: 'k', but 'd' when a side brings no strength":
        if (fact.kind !== 'the fortune of the battle') throw new Error(`"${fact.kind}" has the fortune's tier`);
        return fact.defBase > 0 && fact.atkBase > 0 ? 'k' : 'd';
    }
  });
  return { tiers, whereTheCasualtyListsBegin };
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
  const theKindOfEachStoredLine: (LineFact['kind'] | null)[] = [];
  const stored = (line: LogLine, text: string | null, tier?: string) => {
    gmLog.push(asStored(line, text, tier));
    theKindOfEachStoredLine.push(line.fact?.kind ?? null);
  };
  const wordsOfEachLine: (string | null)[] = turnLog.map(() => null);
  const wordsOfLine = (line: LogLine): string | null => (line.fact === undefined ? line.text : theWordsOf(line.fact));
  // A battle's lines, as emitBattle files them one after the other, each with its index in the engine's log.
  let battlesLines: { at: number; line: LogLine }[] = [];
  const theBattlesLinesWritten = (tallysPlace: { at: number; line: LogLine } | null) => {
    if (!battlesLines.length && !tallysPlace) return;
    const texts = battlesLines.map(({ line }) => wordsOfLine(line));
    const { tiers, whereTheCasualtyListsBegin } = theTiersOfABattlesLines(battlesLines.map(({ line }) => line));
    const tally = tallysPlace ? theWordsOfABattlesLossesTally(battlesLines.map(({ line }) => line.fact)) : null;
    let tallyWritten = false;
    const theTally = () => {
      if (!tallysPlace || !tally || tallyWritten) return;
      stored(tallysPlace.line, tally, 't');
      wordsOfEachLine[tallysPlace.at] = tally;
      tallyWritten = true;
    };
    battlesLines.forEach(({ at, line }, k) => {
      if (k === whereTheCasualtyListsBegin) theTally();
      const words = texts[k] ?? null;
      stored(line, words, tiers[k]);
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
      theKindOfEachStoredLine.push(null);
      wordsOfEachLine[at] = line.text;
      return;
    }
    const words = theWordsOf(line.fact);
    stored(line, words);
    wordsOfEachLine[at] = words;
  });
  theBattlesLinesWritten(null);
  return { gmLog, theKindOfEachStoredLine, wordsOfEachLine };
}
