// ── THE FACTS THE ARMY ORDERS' LINES RECORD (plan P1-12d7: P1-12's Decisions of 2026-10-26, Decisions 2, 6 and 7) ──
// The lines the Leave/Transfer Army, Release Hero, Disband Army and Pick Up Army orders write (orders/army-orders-hand-
// over-garrison-disband-and-pick-up-companies-and-release-a-hero.ts): companies handed to a comrade or left in a
// garrison (or why not), a hero let go a wanderer (or why not), companies disbanded into mercenary bands, companies
// taken up from the garrison or a comrade, and the beasts and the units a column cannot take. Each kind holds plain
// values: a name as the world holds it, a count, a flag, the units a line names copied as it is told
// (theUnitsAsTheLineNamesThem, battle/the-facts-a-battles-lines-record.ts), a commander's beast command as its line
// tells it (theBeastCommandAsALineTellsIt, world/tables.ts), and why a hand-over at sea is refused as a record of its
// values; the prose writes every word (src/views/prose/the-words-of-the-army-orders-lines.ts). Each is filed on its
// own, with the audience its event names (Decision 6: its event's).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../dice-and-army-names.ts';
import type { ABeastCommandAsALineTellsIt } from '../world/tables.ts';

/** Why companies cannot be handed over or left out on open water: the ships that stay with the giver would be too few
 *  to carry the rest of his column, or the recipient's ships could not carry them. */
export type WhyAHandOverAtSeaIsRefused =
  | { kind: "the giver's remaining ships would be too few to carry his column" }
  | { kind: "the recipient's ships could not carry the companies"; recipientName: string };

/** What a line of the army orders records. */
export type TheFactOfTheArmyOrdersLine =
  | { kind: 'a hero has no companies to hand over'; heroName: string }
  | {
      kind: 'the comrade named to take the companies had already marched on';
      heroName: string;
      recipientName: string;
      /** Where the comrade marched to. */
      provinceName: string;
    }
  | {
      kind: 'companies can be handed only to a comrade of the realm standing here';
      heroName: string;
      provinceName: string;
    }
  | {
      kind: 'a hero cannot garrison companies in a province his realm does not hold';
      heroName: string;
      provinceName: string;
    }
  | { kind: 'the companies named to hand over are not in the column'; heroName: string }
  | {
      kind: 'a hand-over out on open water is refused';
      heroName: string;
      units: AUnitAsDescribeArmyNamesIt[];
      /** The comrade they were to be handed to (null: they were to be left in the garrison). */
      recipientName: string | null;
      provinceName: string;
      why: WhyAHandOverAtSeaIsRefused;
    }
  | { kind: 'risen dead refuse to follow a commander who is not Undead'; units: AUnitAsDescribeArmyNamesIt[] }
  | {
      kind: "beasts beyond the recipient's beast command stay with the giver";
      beastCommand: ABeastCommandAsALineTellsIt;
      units: AUnitAsDescribeArmyNamesIt[];
      heroName: string;
    }
  | {
      kind: 'a hero hands companies to a comrade';
      heroName: string;
      units: AUnitAsDescribeArmyNamesIt[];
      recipientName: string;
    }
  | {
      kind: 'a comrade takes command of companies handed to him';
      recipientName: string;
      units: AUnitAsDescribeArmyNamesIt[];
      heroName: string;
      provinceName: string;
    }
  | {
      kind: 'a hero leaves companies in the garrison';
      heroName: string;
      /** Each company's type, as the line names it. */
      unitTypes: string[];
      provinceName: string;
    }
  | {
      kind: 'a hero who left every company behind travels light';
      heroName: string;
      provinceName: string;
      landMovePoints: number;
      seaMovePoints: number;
    }
  | { kind: 'a king cannot release himself from his own service'; heroName: string }
  | { kind: 'a hero leading companies cannot be released'; heroName: string; companies: number }
  | {
      kind: "a hero is released from the realm's service";
      heroName: string;
      /** The realm he served (null: none known; the prose says "the realm"). */
      realmName: string | null;
      provinceName: string;
      /** The names of what he carries, one for each item (an item with no name: null, left unsaid). */
      itemNames: (string | null)[];
    }
  | { kind: 'a hero has no companies to disband'; heroName: string }
  | { kind: 'the companies named to disband are not in the column'; heroName: string }
  | { kind: 'risen dead cannot be disbanded as mercenaries'; units: AUnitAsDescribeArmyNamesIt[] }
  | {
      kind: 'a hero disbands a company into a mercenary band';
      heroName: string;
      unitName: string;
      unitType: string;
      quality: string;
      provinceName: string;
    }
  | {
      kind: 'a hero who disbanded every company travels light';
      heroName: string;
      landMovePoints: number;
      seaMovePoints: number;
    }
  | { kind: 'a hero finds no garrison companies to take up'; heroName: string; provinceName: string }
  | { kind: 'a hero takes command of the whole garrison'; heroName: string; companies: number; provinceName: string }
  | { kind: 'mercenaries are not taken up with a Pick Up order'; heroName: string }
  | { kind: 'a hero finds no matching garrison companies to take up'; heroName: string; provinceName: string }
  | {
      kind: 'a hero takes command of companies chosen from the garrison';
      heroName: string;
      units: AUnitAsDescribeArmyNamesIt[];
      provinceName: string;
    }
  | { kind: "a hero cannot take up a comrade's company"; heroName: string }
  | {
      kind: "a hero takes command of a comrade's company";
      heroName: string;
      unitName: string;
      unitType: string;
      quality: string;
      comradeName: string;
    }
  | {
      kind: 'a hero takes up a company from the garrison';
      heroName: string;
      unitName: string;
      unitType: string;
      quality: string;
      provinceName: string;
    }
  | {
      kind: "beasts taken up beyond the leader's beast command go back";
      beastCommand: ABeastCommandAsALineTellsIt;
      units: AUnitAsDescribeArmyNamesIt[];
      /** The comrade they were taken from (null: the garrison). */
      comradeName: string | null;
      provinceName: string;
    }
  | {
      kind: "units the leader's ships cannot carry on open water stay behind";
      units: AUnitAsDescribeArmyNamesIt[];
      heroName: string;
      /** The comrade they were taken from (null: the garrison). */
      comradeName: string | null;
      provinceName: string;
    }
  | {
      kind: 'a hero now leads his column';
      heroName: string;
      companies: number;
      landMovePoints: number;
      seaMovePoints: number;
    };

/** Each kind's audience: its event's (a kind filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_ARMY_ORDERS_LINE: Readonly<
  Record<TheFactOfTheArmyOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a hero has no companies to hand over': "its event's",
  'the comrade named to take the companies had already marched on': "its event's",
  'companies can be handed only to a comrade of the realm standing here': "its event's",
  'a hero cannot garrison companies in a province his realm does not hold': "its event's",
  'the companies named to hand over are not in the column': "its event's",
  'a hand-over out on open water is refused': "its event's",
  'risen dead refuse to follow a commander who is not Undead': "its event's",
  "beasts beyond the recipient's beast command stay with the giver": "its event's",
  'a hero hands companies to a comrade': "its event's",
  'a comrade takes command of companies handed to him': "its event's",
  'a hero leaves companies in the garrison': "its event's",
  'a hero who left every company behind travels light': "its event's",
  'a king cannot release himself from his own service': "its event's",
  'a hero leading companies cannot be released': "its event's",
  "a hero is released from the realm's service": "its event's",
  'a hero has no companies to disband': "its event's",
  'the companies named to disband are not in the column': "its event's",
  'risen dead cannot be disbanded as mercenaries': "its event's",
  'a hero disbands a company into a mercenary band': "its event's",
  'a hero who disbanded every company travels light': "its event's",
  'a hero finds no garrison companies to take up': "its event's",
  'a hero takes command of the whole garrison': "its event's",
  'mercenaries are not taken up with a Pick Up order': "its event's",
  'a hero finds no matching garrison companies to take up': "its event's",
  'a hero takes command of companies chosen from the garrison': "its event's",
  "a hero cannot take up a comrade's company": "its event's",
  "a hero takes command of a comrade's company": "its event's",
  'a hero takes up a company from the garrison': "its event's",
  "beasts taken up beyond the leader's beast command go back": "its event's",
  "units the leader's ships cannot carry on open water stay behind": "its event's",
  'a hero now leads his column': "its event's",
};
