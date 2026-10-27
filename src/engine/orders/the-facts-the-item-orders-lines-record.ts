// ── THE FACTS THE ITEM ORDERS' LINES RECORD (plan P1-12d6: P1-12's Decisions of 2026-10-26, Decisions 2, 6 and 7) ──
// The lines the Equip Items, Use Item and Send Item orders write (orders/item-orders-equip-use-and-send-magic-
// items.ts): what a hero wears, the Philosopher's Stone worked (its owner's account, the world's, the GM's note of the
// copies struck from the hoards) or refused, a passive item, items handed over or sent by courier, and each refusal.
// Each kind holds plain values: a hero's, an item's or a province's name as the world holds it (null where the world
// has none: the prose writes the words for it), a count, a flag, and the items a line names copied as it is told; the
// prose writes every word (src/views/prose/the-words-of-the-item-orders-lines.ts). One field holds words still: the
// equip note of a hero handed items (gainedItemNote, src/engine/items/equipment.ts, which also settles what he
// wears: the items' area, a later slice), listed by the static test. Each is filed on its own, with the audience its
// event names (Decision 6: its event's).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';

/** An item a hero wears or wields, as the line names it: its name and its slot. */
export interface AnItemWornAsTheLineNamesIt {
  readonly name: string;
  readonly slot: string;
}

/** What a line of the item orders records. */
export type TheFactOfTheItemOrdersLine =
  | { kind: 'a hero carries nothing that can be worn or wielded'; heroName: string }
  | {
      kind: 'a hero arms and dresses for the season';
      heroName: string;
      /** What he wears now, each item with its slot. */
      worn: AnItemWornAsTheLineNamesIt[];
      /** The items named that found their slot already filled, by name. */
      refused: string[];
    }
  | { kind: 'a charmed hero will not spend what he carries'; heroName: string }
  | { kind: 'a hero has no such item to use'; heroName: string }
  | { kind: 'an item has already been used'; itemName: string }
  | {
      kind: "the Philosopher's Stone finds nothing to work on and is not spent";
      heroName: string;
      stoneName: string;
      /** The realm has no units at all (else every one is already Elite). */
      theRealmHasNoUnits: boolean;
    }
  | {
      kind: "the GM's note of the undiscovered Stones struck from the lair hoards";
      /** How many copies were struck. */
      struck: number;
      stoneName: string;
    }
  | {
      kind: "the Philosopher's Stone raises the realm's units a tier and crumbles";
      heroName: string;
      stoneName: string;
      /** The units raised a tier: in all, under the realm's commanders, in its garrisons; and those already Elite. */
      raised: number;
      led: number;
      garrisoned: number;
      alreadyElite: number;
    }
  | {
      kind: "the world sees the Philosopher's Stone burned out";
      provinceName: string;
      /** The realm told is the realm whose hero worked it. */
      isTheirOwnHero: boolean;
      heroName: string;
      /** The realm whose hero worked it, as the world names it (null: no name; the prose says "a distant realm"). */
      realmName: string | null;
      stoneName: string;
    }
  | { kind: 'a passive item needs no using'; itemName: string }
  | { kind: 'a charmed hero will part with nothing'; heroName: string }
  | { kind: 'a hero cannot send items: there is no such recipient'; heroName: string }
  | { kind: 'a hero keeps the items: the recipient is held by a Charm'; heroName: string; recipientName: string }
  | {
      kind: "a hero keeps the items: the recipient is not in the realm's service";
      heroName: string;
      recipientName: string;
      recipientIsAlive: boolean;
    }
  | { kind: "items can be sent only to the realm's own living heroes"; heroName: string }
  | { kind: 'a hero cannot send items to himself'; heroName: string }
  | { kind: 'Mithril Armour is forged to its wearer and cannot be sent'; heroName: string }
  | { kind: 'a hero cannot send the item'; heroName: string }
  | { kind: 'a hero hands items to a comrade beside him'; heroName: string; itemNames: string[]; recipientName: string }
  | { kind: 'a hero receives items from a comrade'; recipientName: string; itemNames: string[]; heroName: string }
  | {
      kind: 'a hero handed items notes how he carries them';
      /** gainedItemNote's words (the items' area: a later slice). */
      gainedItemNote: string;
    }
  | {
      kind: 'a hero sends items by courier';
      heroName: string;
      itemNames: string[];
      recipientName: string;
      /** The province the recipient stands in, as the world names it; null: none (the prose says "a distant
       *  province"). */
      provinceName: string | null;
    };

/** Each kind's audience: its event's (a kind filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_ITEM_ORDERS_LINE: Readonly<
  Record<TheFactOfTheItemOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a hero carries nothing that can be worn or wielded': "its event's",
  'a hero arms and dresses for the season': "its event's",
  'a charmed hero will not spend what he carries': "its event's",
  'a hero has no such item to use': "its event's",
  'an item has already been used': "its event's",
  "the Philosopher's Stone finds nothing to work on and is not spent": "its event's",
  "the GM's note of the undiscovered Stones struck from the lair hoards": "its event's",
  "the Philosopher's Stone raises the realm's units a tier and crumbles": "its event's",
  "the world sees the Philosopher's Stone burned out": "its event's",
  'a passive item needs no using': "its event's",
  'a charmed hero will part with nothing': "its event's",
  'a hero cannot send items: there is no such recipient': "its event's",
  'a hero keeps the items: the recipient is held by a Charm': "its event's",
  "a hero keeps the items: the recipient is not in the realm's service": "its event's",
  "items can be sent only to the realm's own living heroes": "its event's",
  'a hero cannot send items to himself': "its event's",
  'Mithril Armour is forged to its wearer and cannot be sent': "its event's",
  'a hero cannot send the item': "its event's",
  'a hero hands items to a comrade beside him': "its event's",
  'a hero receives items from a comrade': "its event's",
  'a hero handed items notes how he carries them': "its event's",
  'a hero sends items by courier': "its event's",
};
