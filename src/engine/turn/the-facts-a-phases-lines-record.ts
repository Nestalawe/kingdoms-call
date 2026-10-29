// ── THE FACTS A PHASE'S LINES RECORD (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines a phase's stages and its intents write (turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-
// and-end.ts, turn/phase-intents-and-dependency-ordering.ts): the phase's heading, Herbal Lore dressing a hero's wounds,
// a hero hired this phase, a march cancelled because the hero is locked in an unresolved battle or has fought one this
// phase, a fallen hero's orders unanswered, and a march pinned by an enemy force entering first (head-on, or before the
// column clears the gates). Each kind holds plain values: a hero's or a province's name as the world holds it (null
// where the line falls back: the prose writes "the province"), the season's name as the turn names it, and the hit
// points. The prose writes every word (src/views/prose/the-words-of-a-phases-lines.ts). Each is filed on its own, with
// the audience its event names (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from './events-and-their-audiences.ts';

/** What a line of a phase's stages and intents records. */
export type TheFactOfAPhasesLine =
  | {
      kind: 'a phase begins';
      /** The phase's name, as the turn names its seasons. */
      seasonName: string;
    }
  | {
      kind: "Herbal Lore dresses a hero's wounds from the previous season";
      heroName: string;
      /** The damage taken in the previous season's fight, and the part mended. */
      damage: number;
      healed: number;
      hp: number;
      maxHp: number;
    }
  | {
      kind: 'a hero hired this phase will act from the next';
      heroName: string;
    }
  | {
      kind: 'a march is cancelled while the hero is locked in an unresolved battle';
      heroName: string;
      provinceName: string;
    }
  | {
      kind: 'a march is cancelled because the hero has fought a battle this phase';
      heroName: string;
    }
  | {
      kind: "a fallen hero's remaining orders go unanswered";
      heroName: string;
    }
  | {
      kind: "a march is pinned head-on by an enemy column marching into the hero's province";
      heroName: string;
      destinationName: string;
      foeName: string;
      /** Null where the line says "the province". */
      provinceName: string | null;
    }
  | {
      kind: "a march is pinned by an enemy force entering the hero's province first";
      heroName: string;
      destinationName: string;
      provinceName: string | null;
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_PHASES_LINE: Readonly<
  Record<TheFactOfAPhasesLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a phase begins': "its event's",
  "Herbal Lore dresses a hero's wounds from the previous season": "its event's",
  'a hero hired this phase will act from the next': "its event's",
  'a march is cancelled while the hero is locked in an unresolved battle': "its event's",
  'a march is cancelled because the hero has fought a battle this phase': "its event's",
  "a fallen hero's remaining orders go unanswered": "its event's",
  "a march is pinned head-on by an enemy column marching into the hero's province": "its event's",
  "a march is pinned by an enemy force entering the hero's province first": "its event's",
};
