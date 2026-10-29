// ── THE FACT THE WAR-SPOILS LINE RECORDS (plan P1-12d14: P1-12's Decisions of 2026-10-29, Decision 3) ──
// When an Orcish realm's attacking force wins a battle, its Orcish units plunder the field and their wages are halved
// this turn (units/drill-and-spoils.ts, markOrcAttackWin): a closing line in the battle's narrative says how many. The
// fact holds the commander's name as the world holds it (the prose drops its "(wandering)") and the count of units (the
// prose writes the plurals); the prose writes the words (src/views/prose/the-words-of-the-war-spoils-line.ts). It is
// told in the battle's narrative, as the words were (the battle's tiers read the same words): its audience is the
// fight's.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** What the war-spoils line records. */
export interface TheFactOfTheWarSpoilsLine {
  readonly kind: 'Orcish units plunder the field of a battle won attacking';
  readonly heroName: string;
  readonly units: number;
}

/** Each kind's audience: the fight's (it is told in a battle's narrative). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_WAR_SPOILS_LINE: Readonly<
  Record<TheFactOfTheWarSpoilsLine['kind'], Extract<TheAudienceOfAKindOfLine, "the fight's">>
> = {
  'Orcish units plunder the field of a battle won attacking': "the fight's",
};
