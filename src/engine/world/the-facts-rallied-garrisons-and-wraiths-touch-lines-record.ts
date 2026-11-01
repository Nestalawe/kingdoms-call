// ── THE FACTS THE LINES OF A RALLIED GARRISON AND WRAITH'S TOUCH RECORD (plan P1-12d17: P1-12's Decisions of
// 2026-10-30, Decision 2) ──
// The lines src/engine/world/ writes: a held province's standing troops, rallied to its defender, resuming their post
// as its garrison (world/province-bookkeeping-and-rallied-garrisons.ts), and Wraith's Touch withering the enemy's best
// unit at a battle's start (world/map-helpers.ts, applyWraithTouch). Each kind holds plain values: a province's name
// as the world holds it and the count of units (the prose writes the plural); a unit's name (else its type) and its
// quality before and after. The prose writes every word (src/views/prose/the-words-of-rallied-garrisons-and-wraiths-
// touch-lines.ts). The garrison's line is filed on its own, with the audience its event names (its event's); Wraith's
// Touch is told in a battle's narrative, as its words were (the fight's): no audience changes.
import type { TheAudienceOfAKindOfLine, TheTierOfAKindOfABattlesLine } from '../turn/events-and-their-audiences.ts';

/** What a line of a rallied garrison or of Wraith's Touch records. */
export type TheFactOfARalliedGarrisonOrWraithsTouchLine =
  | {
      readonly kind: "a held province's standing troops resume their post as its garrison";
      readonly provinceName: string;
      readonly units: number;
    }
  | {
      readonly kind: "Wraith's Touch withers the enemy's best unit";
      /** The unit's name (else its type), as the world holds it. */
      readonly unitName: string;
      /** Its quality before the touch, and after. */
      readonly was: string;
      readonly quality: string;
    };

/** Each kind's audience: the garrison's line its event's (it is filed on its own), Wraith's Touch the fight's (it is
 *  told in a battle's narrative). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_RALLIED_GARRISON_OR_WRAITHS_TOUCH_LINE: {
  readonly "a held province's standing troops resume their post as its garrison": Extract<
    TheAudienceOfAKindOfLine,
    "its event's"
  >;
  readonly "Wraith's Touch withers the enemy's best unit": Extract<TheAudienceOfAKindOfLine, "the fight's">;
} = {
  "a held province's standing troops resume their post as its garrison": "its event's",
  "Wraith's Touch withers the enemy's best unit": "the fight's",
};

/** The tier of the kind a battle's lines tell (Wraith's Touch, at the battle's start; plan P1-12d34): the full
 *  report's, as its words gave when the views read the tiers from them. */
export const THE_TIER_OF_EACH_KIND_OF_A_RALLIED_GARRISON_OR_WRAITHS_TOUCH_LINE_A_BATTLE_TELLS: Readonly<
  Record<
    Extract<TheFactOfARalliedGarrisonOrWraithsTouchLine['kind'], "Wraith's Touch withers the enemy's best unit">,
    Extract<TheTierOfAKindOfABattlesLine, 'd'>
  >
> = {
  "Wraith's Touch withers the enemy's best unit": 'd',
};
