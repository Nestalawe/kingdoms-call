// ── THE FACTS THE ORDER DISPATCH'S LINES RECORD (plan P1-12d6: P1-12's Decisions of 2026-10-26, Decisions 2, 6 and 7) ──
// The lines processOrder writes before it hands a hero's order to its family (orders/order-dispatch-the-checks-before-a-
// hero-order-and-the-switch.ts): an order superseded by a unified battle, a bot's Search that turns to a Rest (too hurt,
// a rumour too thin, the lair out of reach), a hero locked in an unresolved battle, a charmed hero's refusal, a mastery
// already spent this turn, a Forced March without the mastery. Each kind holds plain values: a hero's, a province's or
// a lair's name as the world holds it (null where the world has none: the prose writes the words for it), and the
// order's action as the order names it (a slug); the prose writes every word (src/views/prose/the-words-of-the-order-
// dispatchs-lines.ts). Each is filed on its own, with the audience its event names (Decision 6: its event's).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** What a line of the order dispatch records. */
export type TheFactOfTheOrderDispatchsLine =
  | {
      kind: "a hero's order is superseded: he joined another hero's battle";
      heroName: string;
      /** The hero whose battle he joined, as the world names him (null: not found, or no name; the prose says "another
       *  hero"). */
      joinedHeroName: string | null;
    }
  | { kind: 'a hero too badly hurt to face another guardian rests instead'; heroName: string }
  | {
      kind: 'a hero weighs the rumour of a lair and leaves it for another day';
      heroName: string;
      /** The lair's name as the world holds it; null: no such lair (the prose says "lair"). */
      lairName: string | null;
    }
  | {
      kind: 'a hero never reaches the lair he set out for and rests instead';
      heroName: string;
      /** The province the lair is in, as the world names it; null: no such province (no clause). */
      provinceName: string | null;
    }
  | { kind: 'a hero locked in an unresolved battle cannot march away'; heroName: string; provinceName: string }
  | {
      kind: 'a charmed hero will not carry out an order of his captor';
      heroName: string;
      /** The order's action (a slug): disbanding companies, an alignment's rite, or a mastery. */
      action: string;
    }
  | {
      kind: 'a hero has already used a mastery this turn';
      heroName: string;
      /** The order's action (a slug): the prose names its mastery. */
      action: string;
    }
  | { kind: 'a hero lacks the March mastery for a Forced March'; heroName: string };

/** Each kind's audience: its event's (a kind filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_ORDER_DISPATCHS_LINE: Readonly<
  Record<TheFactOfTheOrderDispatchsLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  "a hero's order is superseded: he joined another hero's battle": "its event's",
  'a hero too badly hurt to face another guardian rests instead': "its event's",
  'a hero weighs the rumour of a lair and leaves it for another day': "its event's",
  'a hero never reaches the lair he set out for and rests instead': "its event's",
  'a hero locked in an unresolved battle cannot march away': "its event's",
  'a charmed hero will not carry out an order of his captor': "its event's",
  'a hero has already used a mastery this turn': "its event's",
  'a hero lacks the March mastery for a Forced March': "its event's",
};
