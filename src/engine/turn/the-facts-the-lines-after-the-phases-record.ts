// ── THE FACTS THE LINES AFTER THE PHASES RECORD (plan P1-12d16: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines the turn writes once its five phases are played (turn/after-the-phases-stand-offs-the-dead-graves-couriers-
// mass-healing-cowards-and-location-names.ts): skeletal companies crumbling with no necromancer to hold them, a
// necromancer sensing graves underfoot, a neutral hero's lesson, a consecration broken, a courier's parcel delivered or
// lost (and the equip note of the hero it reaches), Elven companies that slipped a lost battle reaching home or
// scattering, Mass Healing, a save's one-time note on the earned-HP pool, and a coward spared on the field making his
// way home. Each kind holds plain values: a hero's, a realm's, a province's, an item's or a company's name as the world
// holds it (null where the line falls back: the prose writes "the realm", "safety"), counts and hit points, the
// companies that crumbled (each a record of where: under a hero, or left to garrison a province), and a flag for each
// clause the line chooses, and how the hero a parcel reaches carries each item (since P1-12d21 a record,
// TheItemsAHeroGained). One field holds words still: a neutral hero's lesson, written by heroes/charms-and-
// neutrals.ts (progressNeutralHeroes hands its words to the turn through a parameter, and a case pins them: Parked).
// The prose writes every other word (src/views/prose/the-words-of-the-lines-after-the-phases.ts). Each is filed on its
// own, with the audience its event names (its event's): no audience changes.
import type { TheAudienceOfAKindOfLine } from './events-and-their-audiences.ts';
import type { TheItemsAHeroGained } from '../items/equipment.ts';

/** Skeletal companies that crumbled, as the line tells each: under a hero with no Necromancy, or left to garrison a
 *  province with no one to command them. */
export type SkeletalCompaniesThatCrumbled =
  | {
      kind: 'skeletal companies crumble under a hero with no Necromancy';
      unitCount: number;
      heroName: string;
      /** The province he stands in (null where the world has none there: the line names none). */
      provinceName: string | null;
    }
  | {
      kind: 'skeletal companies left to garrison a province crumble';
      unitCount: number;
      provinceName: string;
    };

/** What a line after the phases records. */
export type TheFactOfALineAfterThePhases =
  | {
      kind: 'skeletal companies crumble with no necromancer to hold them';
      /** Each hero's and each garrison's companies that crumbled, in the order found. */
      crumbled: SkeletalCompaniesThatCrumbled[];
    }
  | {
      kind: 'a necromancer senses graves underfoot';
      heroName: string;
      provinceName: string;
    }
  | {
      kind: 'a neutral hero learns a skill';
      /** The lesson's words, as progressNeutralHeroes writes them (heroes/charms-and-neutrals.ts: words handed in
       *  through a parameter, Parked). */
      words: string;
    }
  | {
      kind: 'a consecration is broken as its province passes from the realm';
      provinceName: string;
      realmName: string;
    }
  | {
      kind: "a courier's parcel finds no one left to receive it";
      /** The parcel's items, by name (the prose joins them). */
      itemNames: string[];
      /** Who sent it (null where the parcel names no sender). */
      senderName: string | null;
    }
  | {
      kind: "a courier's parcel reaches its hero as the season closes";
      heroName: string;
      itemNames: string[];
      senderName: string | null;
    }
  | {
      kind: "a hero a courier's parcel reaches notes how he carries it";
      /** How he carries each item he gained, as the line tells it (settleTheItemsAHeroGained). */
      theItemsHeGained: TheItemsAHeroGained;
    }
  | {
      kind: 'Elven companies that slipped a battle scatter with no land to return to';
      unitCount: number;
      /** The realm (null where it has no name: the prose writes "the realm"). */
      realmName: string | null;
    }
  | {
      kind: 'Elven companies that slipped a battle find their way home';
      /** Each company, by its name, else its type (the prose joins them). */
      unitNames: string[];
      provinceName: string;
    }
  | {
      kind: "a master's Mass Healing mends a friend's wounds";
      healerName: string;
      healedName: string;
      /** The healer mends his own wounds ("them", "their"). */
      healsHimself: boolean;
      hpGained: number;
      hp: number;
      maxHp: number;
    }
  | {
      kind: "a hero's maximum hit points are now earned in battle";
      heroName: string;
      oldMaxHp: number;
      newMaxHp: number;
    }
  | {
      kind: 'a coward spared on the field makes his way home';
      heroName: string;
      /** The province he reaches (null where it has no name: the prose writes "safety"). */
      provinceName: string | null;
    };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_LINE_AFTER_THE_PHASES: Readonly<
  Record<TheFactOfALineAfterThePhases['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'skeletal companies crumble with no necromancer to hold them': "its event's",
  'a necromancer senses graves underfoot': "its event's",
  'a neutral hero learns a skill': "its event's",
  'a consecration is broken as its province passes from the realm': "its event's",
  "a courier's parcel finds no one left to receive it": "its event's",
  "a courier's parcel reaches its hero as the season closes": "its event's",
  "a hero a courier's parcel reaches notes how he carries it": "its event's",
  'Elven companies that slipped a battle scatter with no land to return to': "its event's",
  'Elven companies that slipped a battle find their way home': "its event's",
  "a master's Mass Healing mends a friend's wounds": "its event's",
  "a hero's maximum hit points are now earned in battle": "its event's",
  'a coward spared on the field makes his way home': "its event's",
};
