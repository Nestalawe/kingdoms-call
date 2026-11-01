// ── EVERY LINE OF THE TURN, AND WHO MAY READ IT (plan P1-12a, Decisions 2 to 6) ────
// The one door into the GM's log of the turn (turnContext.turnLog): emit(turnContext, event). An event says what
// happened (its type, and the fact its words are written from), where and when (its province, its phase), whom it is
// about (its hero, its heroes, its battle), and who may read it (its audience). Nothing else writes to turnLog: the
// lint rule kc/narrative-lines-go-through-emit refuses a write anywhere but here (docs/traps.md, "A line goes through
// emit").
//
// The audience, as the reports read the line today (playerEvents, src/views/every-realms-report-and-the-lines-each-
// realm-reads.ts):
//   realms   these realms are told (a wage bill, a spell that hit them)
//   actor    the realm whose deed it is
//   seen     'world': every realm (a public line with no province); 'there': whoever has eyes in the province at that
//            phase; 'battle': a battle's line, read by those who fought in it (the onlookers' summary waits for Toby)
//   except   these realms never read it (the public half of logSplit: they read their own private half)
// and a line about a hero a realm owns (hero, heroes) reaches that realm. An event with no grant is the GM's alone.
//
// Nothing stored changes in P1-12a and P1-12b (Decision 2): emit writes today's line forms, key for key and in the
// same order: the 17 keys of the lines the old `log` helper wrote; the 14 of the lines that were pushed straight
// into turnLog (form: 'bare', with no battle fields); and notFor after them when an `except` is given. P1-12c keeps it
// (its Decision 3): the stored form changes once, declared, when the last area is typed.
//
// Every event names its hero (P1-12c2; docs/traps.md, "Every event names its hero"), and the phase falls back as the
// old `log` helper's did:
//   hero   a hero's id; null: no hero; THE_HERO_WHOSE_ORDER_IS_RESOLVING: the hero whose order is resolving
//          (turnContext._logCtx.charId), but only when the line already reaches his realm (it is told to it, is its
//          deed, or is seen by the world or there; a battle's line reaches those who fought in it by being told),
//          else no hero (P1-12c1). Left out, emit throws (and the lint rule refuses an event written without it)
//   phase  left out or null: the phase of that order, else the phase resolving, else 99 once the phases are over;
//          'none': no phase (the lines that were pushed straight into turnLog, which never had the 99)
//
// A line records a fact (fact: one kind of LineFact, the union of every area's kinds, each typed in its area's module
// beside its code; src/engine/battle/the-facts-a-battles-lines-record.ts is the first), never its words: since
// P1-12d18 emit throws on an event handed as words, and the lint rule refuses one (a text key, a string narrated). The
// views write a fact's words after the turn (src/views/prose/; docs/traps.md, "A line goes through emit"), and the GM's
// log is stored with every line's words, in the form above: a fact never reaches the store. A battle's lines take their
// tiers, and its losses tally its place, from those words, in the views too (emitBattle).
//
// Each kind of fact has its audience, written once beside it in its area's module (Decision 6): the fight's, for most
// of a fight's lines; its hero's realm alone (THE_AUDIENCE_OF_EACH_KIND, which emitNarrLine reads); or, for a kind
// filed on its own and not in a fight's narrative (a host gained in a province, a stalled battle), its event's: the
// audience the event that files it names (its caller hands emit the fact).
//
// It also holds the helpers that write lines: a fight's narrative (narrate, narrateAll, narrateAt, takeBackLinesFrom;
// emitNarrLine writes it out with the fight's event, FightLine, or its hero's realm alone), a line to the hero or the province
// owner it happened to (notifyTarget, notifyProvinceOwner), a private line with a public twin (logSplit), and the
// placement of the skill rises held back to the end of the phase (writeDeferredSkillLines).
import type { TurnContext } from './context.ts';
import type { TheFactOfABattleForTheStatistics } from '../battle/the-facts-a-battles-lines-record.ts';
import type { TheFactOfAHerosDeathForTheStatistics } from '../heroes/the-facts-a-heros-death-lines-record.ts';
import type { TheFactOfAProvinceChangingHandsForTheStatistics } from '../realms/the-facts-relations-and-captures-lines-record.ts';
import type { TheFactOfASpellCastByTheOrderForTheStatistics } from '../orders/the-facts-the-cast-spell-orders-lines-record.ts';
import type { TheFactOfALairFoughtForTheStatistics } from '../orders/the-facts-the-explore-and-search-orders-lines-record.ts';
import type { TheFactOfASpellWorkedInAFightForTheStatistics } from './log-line-helpers.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_BATTLES_LINE,
  type TheFactOfABattlesLine,
} from '../battle/the-facts-a-battles-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE,
  type TheFactOfAFightsLineForItsHerosRealmAlone,
  type TheFactOfAPersonalCombatsLine,
} from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_SEA_LIFTS_BATTLE_LINE,
  type TheFactOfASeaLiftsBattleLine,
} from '../units/the-facts-the-sea-lifts-battle-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_DEATHS_LINE,
  type TheFactOfAHerosDeathsLine,
} from '../heroes/the-facts-a-heros-death-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_WANDERERS_ESCAPE,
  type TheFactOfTheWanderersEscape,
} from '../the-facts-the-wanderers-escape-line-records.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_CHASES_LINE,
  type TheFactOfAChasesLine,
} from '../heroes/the-facts-a-chases-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_EXPERIENCE_LINE,
  type TheFactOfAHerosExperienceLine,
} from '../heroes/the-facts-a-heros-experience-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_TITLE_INTELLIGENCE_LINE,
  type TheFactOfATitleIntelligenceLine,
} from '../titles/the-facts-the-title-intelligence-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_DEFEND_WATCHS_LINE,
  type TheFactOfADefendWatchsLine,
} from '../units/the-facts-the-defend-watchs-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_STRANDING_AT_SEAS_LINE,
  type TheFactOfAStrandingAtSeasLine,
} from '../units/the-facts-a-stranding-at-seas-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_WAR_SPOILS_LINE,
  type TheFactOfTheWarSpoilsLine,
} from '../units/the-facts-the-war-spoils-line-records.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_LINE_BEFORE_THE_FIRST_PHASE,
  type TheFactOfALineBeforeTheFirstPhase,
} from './the-facts-the-lines-before-the-first-phase-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_NEW_TURNS_LINE,
  type TheFactOfANewTurnsLine,
} from './the-facts-the-new-turns-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_PHASES_LINE,
  type TheFactOfAPhasesLine,
} from './the-facts-a-phases-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_AN_INTRUSION_WARNINGS_LINE,
  type TheFactOfAnIntrusionWarningsLine,
} from './the-facts-the-intrusion-warnings-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_DEFEND_WATCH_MET_IN_BATTLES_LINE,
  type TheFactOfADefendWatchMetInBattlesLine,
} from './the-facts-a-defend-watch-met-in-battle-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_SILENT_HEROS_SEASON_LINE,
  type TheFactOfASilentHerosSeasonLine,
} from './the-facts-a-silent-heros-season-line-records.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_LINE_AFTER_THE_PHASES,
  type TheFactOfALineAfterThePhases,
} from './the-facts-the-lines-after-the-phases-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_DIPLOMACY_OR_VICTORY_LINE,
  type TheFactOfADiplomacyOrVictoryLine,
} from './the-facts-diplomacy-and-victorys-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_AN_EARLY_WINTERS_LINE,
  type TheFactOfAnEarlyWintersLine,
} from './the-facts-early-winters-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_AN_ENCOUNTER_OR_DEFEND_ORDERS_LINE,
  type TheFactOfAnEncounterOrDefendOrdersLine,
} from '../orders/the-facts-the-encounter-and-defend-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_ORDER_DISPATCHS_LINE,
  type TheFactOfTheOrderDispatchsLine,
} from '../orders/the-facts-the-order-dispatchs-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_ITEM_ORDERS_LINE,
  type TheFactOfTheItemOrdersLine,
} from '../orders/the-facts-the-item-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_RESEARCH_AND_PRACTICE_ORDERS_LINE,
  type TheFactOfTheResearchAndPracticeOrdersLine,
} from '../orders/the-facts-the-research-and-practice-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_RECRUIT_AND_HIRE_ORDERS_LINE,
  type TheFactOfTheRecruitAndHireOrdersLine,
} from '../orders/the-facts-the-recruit-and-hire-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_ARMY_ORDERS_LINE,
  type TheFactOfTheArmyOrdersLine,
} from '../orders/the-facts-the-army-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_REALM_WORKS_ORDERS_LINE,
  type TheFactOfTheRealmWorksOrdersLine,
} from '../orders/the-facts-the-realm-works-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_WAR_MASTERY_ORDERS_LINE,
  type TheFactOfTheWarMasteryOrdersLine,
} from '../orders/the-facts-the-war-mastery-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_ESPIONAGE_ORDERS_LINE,
  type TheFactOfTheEspionageOrdersLine,
} from '../orders/the-facts-the-espionage-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_EXPLORE_AND_SEARCH_ORDERS_LINE,
  type TheFactOfTheExploreAndSearchOrdersLine,
} from '../orders/the-facts-the-explore-and-search-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_CAST_SPELL_ORDERS_LINE,
  type TheFactOfTheCastSpellOrdersLine,
} from '../orders/the-facts-the-cast-spell-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_MOVE_ORDERS_LINE,
  type TheFactOfTheMoveOrdersLine,
} from '../orders/the-facts-the-move-orders-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_WHAT_A_SPY_LEARNS_LINE,
  type TheFactOfWhatASpyLearnsLine,
} from '../espionage/the-facts-what-a-spy-learns-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_RELATIONS_AND_CAPTURES_LINE,
  type TheFactOfARelationsAndCapturesLine,
} from '../realms/the-facts-relations-and-captures-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_PLAGUE_OR_BLESS_WARD_LINE,
  type TheFactOfAPlagueOrBlessWardLine,
} from '../magic/the-facts-plague-and-bless-ward-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_RALLIED_GARRISON_OR_WRAITHS_TOUCH_LINE,
  type TheFactOfARalliedGarrisonOrWraithsTouchLine,
} from '../world/the-facts-rallied-garrisons-and-wraiths-touch-lines-record.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_A_BOTS_CONCESSION_LINE,
  type TheFactOfABotsConcessionLine,
} from '../bots/the-facts-a-bots-concession-line-records.ts';
import {
  THE_AUDIENCE_OF_EACH_KIND_OF_THE_SPY_STEALTH_LINE,
  type TheFactOfTheSpyStealthLine,
} from './the-facts-the-spy-stealth-line-records.ts';

/** An event's hero when the line is the deed of the hero whose order is resolving, whoever he is: emit files it under
 *  him only when the line already reaches his realm, else under no hero. The area rows of P1-12c replace it with the
 *  hero each fact names. */
export const THE_HERO_WHOSE_ORDER_IS_RESOLVING = 'the hero whose order is resolving';

/** Each area's facts, one per area, each typed beside its code (P1-12's Decisions of 2026-10-26, Decision 6): a
 *  battle's, personal combat's, the sea lift's in a battle, a hero's death's, the wanderer's escape's; since P1-12d6
 *  the Encounter and Defend orders', the order dispatch's, the item orders', the Research and Practice orders' and the
 *  Recruit and Hire orders'; since P1-12d7 the army orders', the realm works orders' and the war mastery orders'; since
 *  P1-12d8 the espionage orders' and the explore and search orders'; since P1-12d9 the Cast Spell order's; since
 *  P1-12d10 the move order's; since P1-12d12 a chase's and a hero's experience and hit points'; since P1-12d13 the
 *  title intelligence's; since P1-12d14 the Defend watch's, a stranding at sea's and the war-spoils'; since P1-12d15 the
 *  lines before the first phase, the new turn's, a phase's, the intrusion warnings', a Defend watch met in battle's and
 *  a silent hero's season's; since P1-12d16 the lines after the phases, diplomacy's and victory's, and Early Winter's;
 *  since P1-12d17 the other folders': what a spy learns, relations and captures, the Plague and the Bless ward, a
 *  rallied garrison and Wraith's Touch, a bot's concession, and the Spy stealth's line. */
type TheFactsOfEachArea = [
  TheFactOfABattlesLine,
  TheFactOfAPersonalCombatsLine,
  TheFactOfASeaLiftsBattleLine,
  TheFactOfAHerosDeathsLine,
  TheFactOfTheWanderersEscape,
  TheFactOfAnEncounterOrDefendOrdersLine,
  TheFactOfTheOrderDispatchsLine,
  TheFactOfTheItemOrdersLine,
  TheFactOfTheResearchAndPracticeOrdersLine,
  TheFactOfTheRecruitAndHireOrdersLine,
  TheFactOfTheArmyOrdersLine,
  TheFactOfTheRealmWorksOrdersLine,
  TheFactOfTheWarMasteryOrdersLine,
  TheFactOfTheEspionageOrdersLine,
  TheFactOfTheExploreAndSearchOrdersLine,
  TheFactOfTheCastSpellOrdersLine,
  TheFactOfTheMoveOrdersLine,
  TheFactOfAChasesLine,
  TheFactOfAHerosExperienceLine,
  TheFactOfATitleIntelligenceLine,
  TheFactOfADefendWatchsLine,
  TheFactOfAStrandingAtSeasLine,
  TheFactOfTheWarSpoilsLine,
  TheFactOfALineBeforeTheFirstPhase,
  TheFactOfANewTurnsLine,
  TheFactOfAPhasesLine,
  TheFactOfAnIntrusionWarningsLine,
  TheFactOfADefendWatchMetInBattlesLine,
  TheFactOfASilentHerosSeasonLine,
  TheFactOfALineAfterThePhases,
  TheFactOfADiplomacyOrVictoryLine,
  TheFactOfAnEarlyWintersLine,
  TheFactOfWhatASpyLearnsLine,
  TheFactOfARelationsAndCapturesLine,
  TheFactOfAPlagueOrBlessWardLine,
  TheFactOfARalliedGarrisonOrWraithsTouchLine,
  TheFactOfABotsConcessionLine,
  TheFactOfTheSpyStealthLine,
];

/** What a typed line records, of every area's kinds; the views write its words (src/views/prose/). */
export type LineFact = TheFactsOfEachArea[number];

/** The kinds two of the areas both declare: none, for a kind belongs to one area, whose prose writes its words (the
 *  views' route, theWordsOf). */
type TheKindsInTwoAreas<Areas extends readonly { kind: string }[]> = Areas extends readonly [
  infer First extends { kind: string },
  ...infer Rest extends { kind: string }[],
]
  ? (First['kind'] & Rest[number]['kind']) | TheKindsInTwoAreas<Rest>
  : never;

/** Who may read a kind of line, as its area's module says beside the kind: the fight's audience (whoever the fight's
 *  lines are written for), its hero's realm alone (a line that names the realm: a hero's hit-point rise in a fight,
 *  what the man across the field must not learn), or its event's (a kind filed on its own: the audience its event
 *  names; in a fight's narrative, the fight's). */
export type TheAudienceOfAKindOfLine = "the fight's" | "its hero's realm alone" | "its event's";

/** Each kind's audience, of every area's kinds, while each kind is in one area; else a table that names the kinds in
 *  two (and has no audiences), so a kind declared in two areas is a compile error. */
type TheAudienceOfEachKindIfEachIsInOneArea = [TheKindsInTwoAreas<TheFactsOfEachArea>] extends [never]
  ? Readonly<Record<LineFact['kind'], TheAudienceOfAKindOfLine>>
  : { readonly 'these kinds are declared in two areas': TheKindsInTwoAreas<TheFactsOfEachArea> };

/** Each kind's audience, of every area's kinds (each kind in one area). */
const THE_AUDIENCE_OF_EACH_KIND: TheAudienceOfEachKindIfEachIsInOneArea = {
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_BATTLES_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_PERSONAL_COMBATS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_SEA_LIFTS_BATTLE_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_DEATHS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_WANDERERS_ESCAPE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_AN_ENCOUNTER_OR_DEFEND_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_ORDER_DISPATCHS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_ITEM_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_RESEARCH_AND_PRACTICE_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_RECRUIT_AND_HIRE_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_ARMY_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_REALM_WORKS_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_WAR_MASTERY_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_ESPIONAGE_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_EXPLORE_AND_SEARCH_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_CAST_SPELL_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_MOVE_ORDERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_CHASES_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_EXPERIENCE_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_TITLE_INTELLIGENCE_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_DEFEND_WATCHS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_STRANDING_AT_SEAS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_WAR_SPOILS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_LINE_BEFORE_THE_FIRST_PHASE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_NEW_TURNS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_PHASES_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_AN_INTRUSION_WARNINGS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_DEFEND_WATCH_MET_IN_BATTLES_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_SILENT_HEROS_SEASON_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_LINE_AFTER_THE_PHASES,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_DIPLOMACY_OR_VICTORY_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_AN_EARLY_WINTERS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_WHAT_A_SPY_LEARNS_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_RELATIONS_AND_CAPTURES_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_PLAGUE_OR_BLESS_WARD_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_RALLIED_GARRISON_OR_WRAITHS_TOUCH_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_A_BOTS_CONCESSION_LINE,
  ...THE_AUDIENCE_OF_EACH_KIND_OF_THE_SPY_STEALTH_LINE,
};

/** Whether a fight's line is for its hero's realm alone, by its kind's audience. */
function isForItsHerosRealmAlone(fact: LineFact): fact is TheFactOfAFightsLineForItsHerosRealmAlone {
  return THE_AUDIENCE_OF_EACH_KIND[fact.kind] === "its hero's realm alone";
}

/** Whether a line of a fight's narrative is for everyone in the fight: a fact of a kind whose audience is the fight's
 *  (not its hero's realm alone). */
export function isALineForEveryoneInTheFight(line: NarrativeLine): boolean {
  return !isForItsHerosRealmAlone(line);
}

/** A battle's line whose tier ('k' key or 'd' detail) the views work out from the words of the battle's lines, as
 *  emitBattle did before P1-12c3 (theTurnsLinesInWords, src/views/prose/the-words-of-each-line.ts). The GM's log is
 *  stored with the tier in its place. */
export const A_TIER_WORKED_OUT_FROM_THE_WORDS_OF_THE_BATTLES_LINES = "worked out from the words of the battle's lines";

/** Who may read a line (each left out grants nothing). */
export interface LineAudience {
  /** These realms are told (callers pass `[c.player]`, which is null for a hero who serves no realm). */
  realms?: (number | null)[] | undefined;
  /** The realm whose deed it is (null: nobody's). */
  actor?: number | null | undefined;
  /** Seen by the world, by whoever has eyes in the province at that phase, or by those in the battle. */
  seen?: 'world' | 'there' | 'battle' | undefined;
  /** These realms never read it. */
  except?: number[] | undefined;
}

/** An event but its type and its words: who may read a line, where and when, whom it is about. A caller that files
 *  several lines alike, or hands a helper the line's place (logSplit, reportHeroFall, the skill rises held back),
 *  builds it once: emit(turnContext, { type, text, ...place }). */
export interface EventButItsWords {
  audience: LineAudience;
  province?: number | null | undefined;
  /** 0 to 4, or 99 for the end of the turn; left out or null: the phase resolving; 'none': no phase. */
  phase?: number | null | 'none' | undefined;
  /** The hero whose deed it is; null: no hero; THE_HERO_WHOSE_ORDER_IS_RESOLVING: the hero whose order is resolving,
   *  when the line already reaches his realm (else no hero). Every event names it: emit throws on one left out. */
  hero: number | null | typeof THE_HERO_WHOSE_ORDER_IS_RESOLVING;
  /** More heroes it is about: it is filed under whichever of them the reader owns. */
  heroes?: number[] | null | undefined;
  /** The battle it belongs to (emitBattle numbers them), and its place there: 'k' key, 'd' detail, 't' tally, 's' an
   *  onlooker's summary. */
  battle?: { id?: number | null | undefined; tier?: string | null | undefined } | undefined;
  /** Hoisted to the top of the hero's phase. */
  pinNotice?: boolean | undefined;
  /** A province's own event (an earthquake, a flood, …), for the province reports. */
  env?: boolean | undefined;
  /** The game's end and its standings, at the top of the report. */
  gameEnd?: boolean | undefined;
  spy?: boolean | undefined;
  system?: boolean | undefined;
  armyEstimate?: unknown;
  /** 'bare': the 14-key form of the lines that were pushed straight into turnLog (no battle fields). */
  form?: 'full' | 'bare' | undefined;
}

/** What every line of a fight is, but its words: its type, its audience (those who fought in it), its province,
 *  phase, heroes and battle. emitNarrLine files each line of the fight's narrative with it. */
export interface FightLine extends EventButItsWords {
  /** 'system', 'combat', 'move', 'hire', 'explore', 'message', … */
  type: string;
}

/** Something that happened this turn: the fact its words are written from (the views write them, src/views/prose/),
 *  never its words (emit throws on an event handed as words). */
export type TurnEvent = FightLine & { fact: LineFact };

/** A line of the GM's log (turnLog), as emit writes it: today's stored form, but that a line recording a fact has no
 *  words yet (text null, its fact last) and a battle's line its tier still to work out from the words; the views write
 *  them (theTurnsLinesInWords, src/views/prose/the-words-of-each-line.ts), and the GM's log is stored with them. */
export interface LogLine {
  type: string;
  text: string | null;
  actor: number | null;
  targets: (number | null)[];
  provinceId: number | null;
  public: boolean;
  spy: boolean;
  system: boolean;
  armyEstimate: unknown;
  charId: number | null;
  charIds: number[] | null;
  phase: number | null;
  pinNotice: boolean;
  env: boolean;
  /** The full form's three (not on a 'bare' line). */
  battleId?: number | null;
  bTier?: string | null;
  gameEnd?: boolean;
  /** The realms that never read it (audience.except). */
  notFor?: number[];
  /** What a typed line records, until the views write its words (never stored). */
  fact?: LineFact;
}

/** A line of a battle's or a duel's narrative: the fact its words are written from. emitNarrLine writes each
 *  into the GM's log in order, for everyone in the fight or, by its kind, for its hero's realm alone. */
export type NarrativeLine = LineFact;

/** The hero a line naming THE_HERO_WHOSE_ORDER_IS_RESOLVING is filed under: that hero, but only when the line already
 *  reaches his realm by its audience (told to it, its deed, seen by the world or seen there; a battle's line reaches
 *  those who fought in it by being told). Otherwise no hero, so that filing it under him never shows his realm a line
 *  its audience keeps from it (playerEvents gives a realm every line filed under one of its heroes). A hero who serves
 *  no realm has no realm to reach: the line is filed under him as before. */
function theHeroWhoseOrderIsResolvingIfTheLineReachesHisRealm(
  turnContext: TurnContext,
  audience: LineAudience,
): number | null {
  const resolving = turnContext._logCtx.charId;
  if (resolving == null) return null;
  const hisRealm = turnContext.G.characters.find((c) => c.id === resolving)?.player;
  if (hisRealm == null) return resolving;
  const reachesHisRealm =
    audience.actor === hisRealm ||
    (audience.realms ?? []).includes(hisRealm) ||
    audience.seen === 'world' ||
    audience.seen === 'there';
  return reachesHisRealm ? resolving : null;
}

/** Files an event in the GM's log of the turn: the one way a line enters it. */
export function emit(turnContext: TurnContext, event: TurnEvent): void {
  const { audience } = event;
  // Read as the engine may hand it: most callers are not type-checked yet (P1-10 and P1-16 type them).
  const heroAsHanded: unknown = event.hero;
  // Read as the engine may hand it, too: an event records a fact, never words (P1-12d18), as its text or in its fact's
  // place (a fight's line handed to emitNarrLine as a string).
  const factAsHanded: unknown = event.fact;
  const wordsAsHanded: unknown = 'text' in event ? event.text : undefined;
  const isAFact = typeof factAsHanded === 'object' && factAsHanded !== null;
  const wordsOrFact = isAFact ? `recording "${event.fact.kind}"` : `"${String(factAsHanded ?? wordsAsHanded)}"`;
  if (heroAsHanded === undefined)
    throw new Error(
      `emit: the event ${wordsOrFact} names no hero. Every event names its hero: a hero's id, null for no hero, or ` +
        'THE_HERO_WHOSE_ORDER_IS_RESOLVING (docs/traps.md, "Every event names its hero").',
    );
  if (!isAFact)
    throw new Error(
      `emit: the event ${wordsOrFact} is handed as words. A line records a fact, and the views write its words ` +
        '(docs/traps.md, "A line goes through emit").',
    );
  if (wordsAsHanded !== undefined)
    throw new Error(`emit: the event ${wordsOrFact} has words as well: the views write a fact's words.`);
  const line: LogLine = {
    type: event.type,
    text: null,
    actor: audience.actor ?? null,
    targets: audience.realms ?? [],
    provinceId: event.province ?? null,
    public: audience.seen !== undefined,
    spy: event.spy ?? false,
    system: event.system ?? false,
    armyEstimate: event.armyEstimate ?? null,
    charId:
      event.hero === THE_HERO_WHOSE_ORDER_IS_RESOLVING
        ? theHeroWhoseOrderIsResolvingIfTheLineReachesHisRealm(turnContext, audience)
        : event.hero,
    charIds: event.heroes ?? null,
    // 2026-09-23 (Toby item 10): a line logged DURING a phase but outside any character's order (the lone-defender
    // ambush, Defend ride-outs, end-of-phase sweeps) had no phase at all, and the player's Chronicle files an unphased
    // line under SPRING. _currentPhase is the phase being resolved, so it is the fallback; 99 is the End of Turn.
    phase:
      event.phase === 'none'
        ? null
        : (event.phase ??
          turnContext._logCtx.phase ??
          turnContext._currentPhase ??
          (turnContext._afterPhases ? 99 : null)),
    pinNotice: event.pinNotice ?? false,
    env: event.env ?? false,
  };
  if (event.form !== 'bare') {
    line.battleId = event.battle?.id ?? null;
    line.bTier = event.battle?.tier ?? null;
    line.gameEnd = event.gameEnd ?? false;
  }
  if (audience.except !== undefined) line.notFor = audience.except;
  line.fact = event.fact;
  turnContext.turnLog.push(line);
  console.log(`[${event.type}] ${event.fact.kind}`);
}

// ── THE TURN'S STATISTICS: THEIR ONE DOOR (plan P1-12d33: P1-12d's last slice, Decision 1) ────
// What the turn's statistics record (db/telemetry.ts writes it into turn_events, and the balance matrix hashes those
// rows) is a fact of its own, typed in its area's module: a battle fought, a hero's death, a province changing hands, a
// spell worked in a fight or cast by the order, a lair fought. Not a line: no audience, no words, no hero it is filed
// under, never in the GM's log. recordForTheStatistics files each in the turn's order (turnContext._tel's
// factsInTheTurnsOrder), and the views build the writer's lists from them after the turn (theStatisticsOfTheTurn,
// src/views/the-statistics-of-the-turn.ts). Each caller keeps its own try: a statistics bug never costs a turn. The
// lint rule kc/narrative-lines-go-through-emit refuses a write to _tel's lists anywhere but here (the realms'
// snapshots, pre and orders, are written where they are taken).

/** Each area's facts for the statistics, one per area, each typed beside its code. */
type TheFactsForTheStatisticsOfEachArea = [
  TheFactOfABattleForTheStatistics,
  TheFactOfAHerosDeathForTheStatistics,
  TheFactOfAProvinceChangingHandsForTheStatistics,
  TheFactOfASpellWorkedInAFightForTheStatistics,
  TheFactOfASpellCastByTheOrderForTheStatistics,
  TheFactOfALairFoughtForTheStatistics,
];

/** What the turn's statistics record, of every area's kinds. */
export type TheFactForTheStatistics = TheFactsForTheStatisticsOfEachArea[number];

/** Files a fact for the turn's statistics, in the turn's order: the one way a record reaches them. */
export function recordForTheStatistics(turnContext: Pick<TurnContext, '_tel'>, fact: TheFactForTheStatistics): void {
  turnContext._tel.factsInTheTurnsOrder.push(fact);
}

// ── A FIGHT'S NARRATIVE ────
// A battle's or a duel's narrative is an ordered list of lines (it is spliced, searched and counted by index), written
// out in order once the fight is over (emitBattle, emitNarrLine). narrate adds a line: the fact its words are written
// from. A fact of a kind whose audience is its hero's realm alone (a hero's hit points rising: what the man
// across the field must not learn) is written for that realm alone, filed under its hero; every other line is for
// everyone in the fight. Lines already written move only through narrateAll, narrateAt and takeBackLinesFrom, each
// line as it is, so a line for one realm stays that realm's.

/** Adds a line to the fight: the fact its words are written from. */
export function narrate(narrative: NarrativeLine[], line: NarrativeLine): void {
  narrative.push(line);
}

/** Adds lines already written for a fight, each as it is (for everyone, or for one realm alone): a duel's narrative
 *  inside a battle's, a battle's grid and ladder rows. */
export function narrateAll(narrative: NarrativeLine[], lines: readonly NarrativeLine[]): void {
  narrative.push(...lines);
}

/** Adds lines to the fight before the line at `index` (a host's forming-up before "Battle for …", a plea before the
 *  blow it begged against). */
export function narrateAt(narrative: NarrativeLine[], index: number, lines: readonly NarrativeLine[]): void {
  narrative.splice(index, 0, ...lines);
}

/** Takes the lines from `index` on out of a fight's narrative (a killing blow that never landed), and returns them. */
export function takeBackLinesFrom(narrative: NarrativeLine[], index: number): NarrativeLine[] {
  return narrative.splice(index);
}

// ── PRIVATE LINES INSIDE A SHARED NARRATIVE ────
// A battle or duel narrative is written once and then shown to EVERY participant — that is the
// whole point of a blow-by-blow. But a handful of lines in it belong to one realm alone: a hero's
// hit points rising in the fight, the surgeons' word to a fallen duellist's own realm. An enemy
// commander has no way of knowing that the man across the field just got harder to kill, and
// reading it told them for free.
//
// So such a line is a fact whose kind's audience is its hero's realm alone (P1-12c4; each area's
// module says so beside the kind), naming that realm and, if it has one, its hero. Every consumer of
// a narrative array routes each entry through emitNarrLine(), which files such a line to that realm
// alone (told to it alone, seen by nobody else, no heroes spill), under its hero (else the fight's),
// and every other line with the fight's own event (FightLine: its audience, province, phase, heroes,
// battle). Because it is filed in sequence with the rest of the narrative, the owner still reads it
// exactly where it happened in the fight. A splice point (a battle's header) is found by its kind: every line of
// battle/ is a fact (P1-12c5, c6).
export function emitNarrLine(turnContext: TurnContext, line: NarrativeLine, fight: FightLine): void {
  if (!isForItsHerosRealmAlone(line)) {
    emit(turnContext, { ...fight, fact: line });
    return;
  }
  emit(turnContext, {
    ...fight,
    fact: line,
    audience: { realms: [line.realm], actor: null },
    heroes: null,
    hero: ('hero' in line ? line.hero : undefined) ?? fight.hero,
  });
}

// ── TARGET NOTIFICATIONS ────
// When something happens TO a character that they'd know about — receiving items, armies mustered
// to them, a spell cast on them (friendly or hostile) — file a line in THAT character's own
// Chronicle section for the phase it happened. charId routes it into their section; targets makes
// sure their player sees it even when the actor was an enemy. This never leaks to anyone else.
export function notifyTarget(
  turnContext: TurnContext,
  targetChar: { id: number; player: number | null; location: number | null } | null | undefined,
  line: NarrativeLine,
  ph?: number | null,
  type?: string,
): void {
  if (!targetChar) return;
  const _ph = ph ?? turnContext._logCtx.phase ?? turnContext._currentPhase;
  emit(turnContext, {
    type: type ?? 'system',
    fact: line,
    audience: { actor: null, realms: targetChar.player != null ? [targetChar.player] : [] },
    hero: targetChar.id,
    phase: _ph,
    province: targetChar.location ?? null,
  });
}

// ── Task 9(b): PROVINCE / KINGDOM NOTIFICATIONS ────
// When something is done TO one of a player's PROVINCES that they'd learn of — an enemy Flood,
// Earthquake, Plague, Cataclysm, Part Sea, etc. — file a line in that owner's KINGDOM EVENTS feed
// (charId null so it is NOT a character section, and env:false so it is NOT diverted to the quieter
// Province Reports stream). No-op if the caster IS the owner (they already know) or the land is
// unowned. targets makes the owner see it even though the caster was an enemy.
// ── ONE EVENT, TWO AUDIENCES ────
// A cast that raises troops is written for the caster ("…to fight under your command") but is
// also public, so an onlooker — the owner of the province, a spy, a hero standing there — read
// the same second-person sentence with no province in it. `logSplit` writes the caster's line
// privately and a third-person line for everyone else who can see the province (notFor keeps the
// caster from reading it twice). Both carry the province so the report can place them. Each half is the fact its words
// are written from (since P1-12d7, Awaken Grove's and Wild Calling's; since P1-12d18, every line's).
export function logSplit(
  turnContext: TurnContext,
  type: string,
  privText: NarrativeLine,
  pubText: NarrativeLine,
  place: EventButItsWords & { alsoNotFor?: (number | null)[] | undefined },
): void {
  const { alsoNotFor, ...line } = place;
  const actor = line.audience.actor ?? null;
  // The private half: told to the realms named, else to the actor's own; seen by nobody else.
  emit(turnContext, {
    ...line,
    type,
    fact: privText,
    audience: {
      realms: line.audience.realms?.length ? line.audience.realms : [actor].filter((x) => x != null),
      actor: line.audience.actor,
    },
  });
  // The public half: no hero, in the bare form.
  emit(turnContext, {
    type,
    fact: pubText,
    audience: {
      actor: null,
      realms: [],
      seen: 'there',
      except: [actor].concat(alsoNotFor ?? []).filter((x) => x != null),
    },
    province: line.province,
    hero: null,
    phase: line.phase,
    form: 'bare',
  });
}
export function notifyProvinceOwner(
  turnContext: TurnContext,
  prov: { id: number; owner: number | null } | null | undefined,
  line: NarrativeLine,
  casterPlayer: number | null | undefined,
  ph?: number | null,
): void {
  if (prov?.owner == null || prov.owner === casterPlayer) return;
  const _ph = ph ?? turnContext._logCtx.phase ?? turnContext._currentPhase;
  // No hero (never the casting character's), so it files under the owner's KINGDOM EVENTS; and no phase but the one
  // worked out here (the bare form never had the End of Turn's 99).
  emit(turnContext, {
    type: 'system',
    fact: line,
    audience: { actor: null, realms: [prov.owner] },
    province: prov.id,
    hero: null,
    phase: _ph ?? 'none',
    form: 'bare',
  });
}

// ── THE SKILL RISES HELD BACK TO THE END OF THE PHASE ────
// a character who dies later in the phase must not have a skill rise reported AFTER the fight
// that killed them ("📈 … March rises to level 1" trailing a duel death). The rise was real —
// earned on the march that carried them INTO the battle — so at the moment of death every
// deferred line of theirs is written out at once, i.e. before the battle narrative is emitted,
// exactly where the march sits in the sequence of events.
// Write out deferred skill lines. 2026-10-13 (item 6, Toby): a line earned in a battle
// (meta.afterBattleIn = that province) is placed straight after the last line of the most recent
// battle report there in the same phase, rather than after everything else the phase brought —
// the lines of one rise stay together and in order. With `inPlace` (a hero falling, whose battle
// is not yet written) every line is simply logged where it stands.
export function writeDeferredSkillLines(
  turnContext: TurnContext,
  list: TurnContext['_deferredSkillLogs'] | null | undefined,
  inPlace?: boolean,
): void {
  const { turnLog } = turnContext;
  const blocks = new Map<string, { p: number; ph: TurnEvent['phase']; ents: LogLine[] }>();
  (list ?? []).forEach(([msg, place]) => {
    const { afterBattleIn: p, ...line } = place;
    emit(turnContext, { ...line, type: 'system', fact: msg });
    if (p == null || inPlace) return;
    const k = String(p) + '|' + String(line.phase);
    let block = blocks.get(k);
    if (!block) {
      block = { p, ph: line.phase, ents: [] };
      blocks.set(k, block);
    }
    const held = turnLog.pop();
    if (held) block.ents.push(held);
  });
  blocks.forEach(({ p, ph, ents }) => {
    let at = -1;
    for (let i = turnLog.length - 1; i >= 0; i--) {
      const x = turnLog[i];
      if (x?.battleId != null && x.provinceId === p && x.phase === ph) {
        at = i;
        break;
      }
    }
    if (at < 0) turnLog.push(...ents);
    else turnLog.splice(at + 1, 0, ...ents);
  });
}
