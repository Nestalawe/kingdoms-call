// ── THE FACTS A DEFEND WATCH MET IN BATTLE'S LINES RECORD (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines the turn's battle records write when a battle ends a hero's Defend watch (turn/mercenary-ids-and-battle-
// records.ts): his Defend order fulfilled, once the threat has been met in battle (completeDefendWatches), or his watch
// broken by a defeat (noteBattleLoss). Each kind holds the hero's name as the world holds it; the prose writes the words
// (src/views/prose/the-words-of-a-defend-watch-met-in-battle-lines.ts). Each is told in the battle's narrative when the
// battle hands one (as the words were: the battle's tiers read the same words; its audience there is the fight's), else
// filed on its own, with the audience its event names: its event's. No audience changes.
import type { TheAudienceOfAKindOfLine, TheTierOfAKindOfABattlesLine } from './events-and-their-audiences.ts';

/** What a line of a Defend watch met in battle records. */
export type TheFactOfADefendWatchMetInBattlesLine =
  | {
      kind: "a defender's Defend order is fulfilled once the threat is met in battle";
      heroName: string;
    }
  | {
      kind: "a defender's watch is broken by a defeat";
      heroName: string;
    };

/** Each kind's audience: its event's (in a battle's narrative, the fight's). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_DEFEND_WATCH_MET_IN_BATTLES_LINE: Readonly<
  Record<TheFactOfADefendWatchMetInBattlesLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  "a defender's Defend order is fulfilled once the threat is met in battle": "its event's",
  "a defender's watch is broken by a defeat": "its event's",
};

/** Each kind's tier in a battle's lines (plan P1-12d34): the short account's, as their words gave when the views read
 *  the tiers from them. */
export const THE_TIER_OF_EACH_KIND_OF_A_DEFEND_WATCH_MET_IN_BATTLES_LINE: Readonly<
  Record<TheFactOfADefendWatchMetInBattlesLine['kind'], Extract<TheTierOfAKindOfABattlesLine, 'k'>>
> = {
  "a defender's Defend order is fulfilled once the threat is met in battle": 'k',
  "a defender's watch is broken by a defeat": 'k',
};
