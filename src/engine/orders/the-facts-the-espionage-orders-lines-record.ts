// ── THE FACTS THE ESPIONAGE ORDERS' LINES RECORD (plan P1-12d8: P1-12's Decisions of 2026-10-26, Decisions 2, 6 and 7)
// ──
// The lines the espionage orders write (orders/espionage-orders-spy-steal-sabotage-grand-heist-assassinate-and-
// vanish.ts): Spy (on a province or a hero beside him, the roll, the report, the chance a hero notices him and what
// his realm is told), Steal (from a garrison's paymaster or a hero, each outcome and what the robbed realm learns),
// Sabotage, Grand Heist (the roll, the haul, the courier waylaid, what the robbed realm learns), Assassinate and Vanish,
// each refused or carried out; and a thief caught in the act (the victim drives him off or draws steel). Each kind
// holds plain values: a hero's, a realm's, a province's or an item's name as the world holds it (null where the world
// has none: the prose writes the words for it), a level, a chance and its roll, a count, a flag for a clause chosen by
// it, a hero's skills, items and companies copied as the spy's report tells them, a rival's skill and the odds as a
// realm is shown them (theStatShownAsALineTellsIt and theOddsShownAsALineTellsIt, heroes/effective-skills-and-hidden-
// heroes.ts: what a realm has not earned is never in the fact), and what a thief was caught at and a Grand Heist's haul
// as records of their values; the prose writes every word (src/views/prose/the-words-of-the-espionage-orders-lines.ts).
// How a thief carries what he took is a record since P1-12d21 (TheItemsAHeroGained, src/engine/items/equipment.ts,
// whose settleTheItemsAHeroGained also settles what he wears). Each is filed on its own, with the audience its event
// names (Decision 6: its event's): no audience changes. A hero slain by a cornered thief or an assassin is told by
// reportHeroFall (heroes/), as a hero's death's kind "a hero is slain outside a battle", the way he fell a value
// (P1-12d11).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../dice-and-army-names.ts';
import type { TheItemsAHeroGained } from '../items/equipment.ts';
import type {
  AStatShownAsALineTellsIt,
  TheOddsShownAsALineTellsIt,
} from '../heroes/effective-skills-and-hidden-heroes.ts';

/** What a thief (or a spy) was caught at, as the victim's line tells it. */
export type WhatAThiefWasCaughtAt =
  | { kind: 'caught spying on a hero' }
  | {
      kind: "caught with a hand in a hero's strongbox or pack";
      /** He went for the gold (the strongbox), not a magic item (the pack). */
      forTheGold: boolean;
    }
  | { kind: 'caught breaking into the vaults of a province'; provinceName: string };

/** A Grand Heist's haul: the gold lifted from the vaults (none told when 0), and the item cut from a courier's satchel
 *  (null: no courier of the robbed realm was on the road). */
export interface TheHaulOfAGrandHeist {
  readonly gold: number;
  readonly courierItemName: string | null;
}

/** A company of a garrison put to the torch by Sabotage: its quality (null: none) and its type. */
export interface ACompanyPutToTheTorch {
  readonly quality: string | null;
  readonly type: string;
}

/** A spy's roll: his chance and the roll, or a success he can't miss (the Crystal Orb, else Master Spy). */
interface ASpysRoll {
  /** No roll is told: the Crystal Orb or Master Spy make it certain. */
  theSuccessIsCertain: boolean;
  /** The certainty is the Crystal Orb's (else Master Spy's). */
  byTheCrystalOrb: boolean;
  chance: number;
  roll: number;
}

/** What a line of the espionage orders records. */
export type TheFactOfTheEspionageOrdersLine =
  | {
      kind: 'a thief has already melted into the shadows when the alarm is raised';
      victimName: string;
      thiefName: string;
    }
  | {
      kind: 'a victim who wants no brawl drives a caught thief off';
      victimName: string;
      thiefName: string;
      caughtAt: WhatAThiefWasCaughtAt;
    }
  | {
      kind: 'a victim catches a thief and blades are drawn';
      victimName: string;
      thiefName: string;
      caughtAt: WhatAThiefWasCaughtAt;
    }
  | {
      kind: 'a spy finds no quarry to spy on';
      heroName: string;
      /** The hero named, as the world names him; null: no such hero (the prose says "their quarry"). */
      quarryName: string | null;
      provinceName: string;
    }
  | { kind: 'a spy cannot fix on a cloaked face'; heroName: string; targetName: string; provinceName: string }
  | ({
      kind: "a spy's roll to read a hero";
      targetName: string;
      heroName: string;
      spyLevel: number;
      provinceName: string;
    } & ASpysRoll)
  | {
      kind: "a spy's report on a hero";
      heroName: string;
      targetName: string;
      /** The realm the hero serves, as the world names it; null: he serves none. */
      targetsRealmName: string | null;
      /** His race and alignment as the world names them; null: none (the prose writes "?"). */
      race: string | null;
      alignment: string | null;
      isKing: boolean;
      /** Each skill above 0 and its level, highest first, copied as the report is told. */
      skills: [skill: string, level: number][];
      /** The names of the items he carries, copied as the report is told. */
      itemNames: string[];
      /** The companies he leads, copied as the report is told. */
      units: AUnitAsDescribeArmyNamesIt[];
    }
  | { kind: 'a spy learns nothing of a hero'; heroName: string; targetName: string; provinceName: string }
  | {
      kind: "a hero's chance to notice a spy";
      targetName: string;
      /** The hero's Spy as the spy's realm is shown it: null when it has not earned it. */
      targetsSpy: AStatShownAsALineTellsIt | null;
      heroName: string;
      /** The spy works in the land of the hero's realm. */
      inTheirOwnLand: boolean;
      /** The spy works in his own realm's land. */
      inYourLand: boolean;
      /** The chance and the roll, as the spy's realm is shown them. */
      odds: TheOddsShownAsALineTellsIt;
    }
  | {
      kind: 'a realm learns a spy was caught on its hero';
      spyName: string;
      /** The realm the spy serves, as the world names it; null: he serves none. */
      spysRealmName: string | null;
      targetName: string;
      provinceName: string;
    }
  | { kind: 'a spy slips away unseen as The Shadow'; heroName: string }
  | ({
      kind: "a spy's roll to spy out a province";
      heroName: string;
      spyLevel: number;
      provinceName: string;
    } & ASpysRoll)
  | {
      kind: "a spy's disguise is put to the test";
      heroName: string;
      provinceName: string;
      chance: number;
      roll: number;
      theDisguiseHolds: boolean;
    }
  | { kind: "a spy's espionage in a province yields little"; heroName: string; provinceName: string }
  | { kind: 'a hero with no Thief skill cannot steal'; heroName: string }
  | { kind: 'a thief finds no enemy paymaster to rob'; heroName: string; provinceName: string }
  | {
      kind: "a thief's roll to rob a garrison's paymaster";
      heroName: string;
      thiefLevel: number;
      provinceName: string;
      garrisonUnits: number;
      chance: number;
      roll: number;
    }
  | { kind: "a thief lifts gold from a garrison's paymaster"; heroName: string; gold: number; provinceName: string }
  | {
      kind: "a realm learns its garrison's paymaster was robbed";
      provinceName: string;
      gold: number;
      thiefName: string;
      thiefsRealmName: string;
    }
  | {
      kind: "a thief is caught and beaten back by a garrison's guards";
      heroName: string;
      provinceName: string;
      damage: number;
    }
  | {
      kind: "a realm learns a thief was caught at its garrison's paymaster";
      thiefName: string;
      thiefsRealmName: string;
      provinceName: string;
    }
  | { kind: "a thief's attempt on a paymaster fails unnoticed"; heroName: string; provinceName: string }
  | { kind: 'a thief finds no target to steal from'; heroName: string; provinceName: string }
  | { kind: 'a thief will not rob a comrade'; heroName: string }
  | { kind: "a thief reaches for a vanished hero's purse"; heroName: string; victimName: string }
  | { kind: 'a thief finds nothing worth stealing on a hero'; heroName: string; victimName: string }
  | {
      kind: "a thief's roll to rob a hero";
      heroName: string;
      thiefLevel: number;
      victimName: string;
      /** He goes for gold (the hero carries no magic he could lift), not a magic item. */
      forTheGold: boolean;
      chance: number;
      roll: number;
      /** The chance is halved: the hero leads companies. */
      theTargetLeadsArmies: boolean;
    }
  | { kind: "a thief picks a hero's empty purse"; heroName: string; victimName: string }
  | { kind: "a thief lifts gold from a hero's strongbox"; heroName: string; gold: number; victimName: string }
  | {
      kind: 'a realm learns a thief stole its gold';
      thiefName: string;
      thiefsRealmName: string;
      gold: number;
      victimName: string;
    }
  | { kind: "a master thief's own pockets cannot be picked"; heroName: string; victimName: string }
  | { kind: 'a thief lifts a magic item from a hero'; heroName: string; itemName: string; victimName: string }
  | {
      kind: 'a thief notes how he carries what he took';
      /** How he carries each item he gained, as the line tells it (settleTheItemsAHeroGained): null when there is
       *  nothing to say. */
      theItemsHeGained: TheItemsAHeroGained | null;
    }
  | {
      kind: 'a realm learns a thief stole a magic item';
      thiefName: string;
      thiefsRealmName: string;
      itemName: string;
      victimName: string;
    }
  | { kind: "a thief's attempt on a hero fails unnoticed"; heroName: string; victimName: string }
  | { kind: 'a hero lacks the Spy mastery to attempt Sabotage'; heroName: string }
  | { kind: 'Sabotage needs an enemy province the hero has seen'; heroName: string }
  | { kind: 'Sabotage of a province whose owner is not at war is refused'; heroName: string; provinceName: string }
  | {
      kind: "a spy's agents sabotage a province";
      heroName: string;
      provinceName: string;
      /** The company of its garrison put to the torch; null: it had none. */
      torchedCompany: ACompanyPutToTheTorch | null;
    }
  | { kind: 'a hero lacks the Thief mastery for a Grand Heist'; heroName: string }
  | { kind: 'a thief has already attempted a Grand Heist this turn'; heroName: string }
  | { kind: 'a Grand Heist needs ground a rival crown holds'; heroName: string; provinceName: string }
  | {
      kind: 'a Grand Heist on a realm not at war is refused';
      heroName: string;
      /** The realm holding the ground, as the world names it; null: none (the prose says "this realm"). */
      realmName: string | null;
    }
  | {
      kind: 'a Grand Heist needs a capital or rich country';
      heroName: string;
      provinceName: string;
      /** The tax base that makes country rich (GRAND_HEIST_RICH_TAX), and this province's. */
      richTax: number;
      tax: number;
    }
  | {
      kind: "a thief's roll to crack the vaults";
      heroName: string;
      thiefLevel: number;
      /** The province is the robbed realm's home capital (else rich country). */
      isTheEnemyCapital: boolean;
      provinceName: string;
      /** The robbed realm, as the world names it; null: none (the prose says "an enemy realm"). */
      realmName: string | null;
      chance: number;
      roll: number;
      /** The chance is halved: a garrison or a commander at the head of troops guards the vaults. */
      theVaultsAreGuarded: boolean;
    }
  | {
      kind: "a realm's courier is waylaid on the road";
      realmName: string;
      itemName: string;
      /** Who sent the parcel, as it names him; null: it names none. */
      senderName: string | null;
      /** Whom it was bound for, as the world names him; null: no such hero. */
      recipientName: string | null;
    }
  | { kind: 'a thief pulls off a Grand Heist'; heroName: string; provinceName: string; haul: TheHaulOfAGrandHeist }
  | {
      kind: 'a realm learns a Grand Heist was staged on it';
      thiefName: string;
      thiefsRealmName: string;
      provinceName: string;
      haul: TheHaulOfAGrandHeist;
    }
  | { kind: 'a Grand Heist comes to nothing unnoticed'; heroName: string; provinceName: string }
  | { kind: 'a thief is caught at the vaults and beaten back'; heroName: string; provinceName: string; damage: number }
  | {
      kind: 'a realm learns a thief was driven off its vaults';
      thiefName: string;
      thiefsRealmName: string;
      provinceName: string;
    }
  | { kind: 'a hero lacks the Spy mastery to Assassinate'; heroName: string }
  | { kind: 'a hero finds no enemy hero to assassinate'; heroName: string; provinceName: string }
  | { kind: 'an assassin stalks a vanished mark'; heroName: string; victimName: string; provinceName: string }
  | { kind: 'an assassination of a hero whose crown is not at war is refused'; heroName: string; victimName: string }
  | {
      kind: "an assassin's roll";
      heroName: string;
      spyLevel: number;
      victimName: string;
      chance: number;
      roll: number;
      /** The mark is a king: heavily guarded (his chance already lower). */
      theMarkIsAKing: boolean;
    }
  | { kind: "a realm learns an attempt was made on its hero's life"; victimName: string; theMarkIsAKing: boolean }
  | { kind: "an assassin's attempt fails"; heroName: string; victimName: string }
  | { kind: 'a hero lacks the Thief mastery to Vanish'; heroName: string }
  | { kind: 'a thief melts into the shadows'; heroName: string };

/** Each kind's audience: its event's (a kind filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_ESPIONAGE_ORDERS_LINE: Readonly<
  Record<TheFactOfTheEspionageOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a thief has already melted into the shadows when the alarm is raised': "its event's",
  'a victim who wants no brawl drives a caught thief off': "its event's",
  'a victim catches a thief and blades are drawn': "its event's",
  'a spy finds no quarry to spy on': "its event's",
  'a spy cannot fix on a cloaked face': "its event's",
  "a spy's roll to read a hero": "its event's",
  "a spy's report on a hero": "its event's",
  'a spy learns nothing of a hero': "its event's",
  "a hero's chance to notice a spy": "its event's",
  'a realm learns a spy was caught on its hero': "its event's",
  'a spy slips away unseen as The Shadow': "its event's",
  "a spy's roll to spy out a province": "its event's",
  "a spy's disguise is put to the test": "its event's",
  "a spy's espionage in a province yields little": "its event's",
  'a hero with no Thief skill cannot steal': "its event's",
  'a thief finds no enemy paymaster to rob': "its event's",
  "a thief's roll to rob a garrison's paymaster": "its event's",
  "a thief lifts gold from a garrison's paymaster": "its event's",
  "a realm learns its garrison's paymaster was robbed": "its event's",
  "a thief is caught and beaten back by a garrison's guards": "its event's",
  "a realm learns a thief was caught at its garrison's paymaster": "its event's",
  "a thief's attempt on a paymaster fails unnoticed": "its event's",
  'a thief finds no target to steal from': "its event's",
  'a thief will not rob a comrade': "its event's",
  "a thief reaches for a vanished hero's purse": "its event's",
  'a thief finds nothing worth stealing on a hero': "its event's",
  "a thief's roll to rob a hero": "its event's",
  "a thief picks a hero's empty purse": "its event's",
  "a thief lifts gold from a hero's strongbox": "its event's",
  'a realm learns a thief stole its gold': "its event's",
  "a master thief's own pockets cannot be picked": "its event's",
  'a thief lifts a magic item from a hero': "its event's",
  'a thief notes how he carries what he took': "its event's",
  'a realm learns a thief stole a magic item': "its event's",
  "a thief's attempt on a hero fails unnoticed": "its event's",
  'a hero lacks the Spy mastery to attempt Sabotage': "its event's",
  'Sabotage needs an enemy province the hero has seen': "its event's",
  'Sabotage of a province whose owner is not at war is refused': "its event's",
  "a spy's agents sabotage a province": "its event's",
  'a hero lacks the Thief mastery for a Grand Heist': "its event's",
  'a thief has already attempted a Grand Heist this turn': "its event's",
  'a Grand Heist needs ground a rival crown holds': "its event's",
  'a Grand Heist on a realm not at war is refused': "its event's",
  'a Grand Heist needs a capital or rich country': "its event's",
  "a thief's roll to crack the vaults": "its event's",
  "a realm's courier is waylaid on the road": "its event's",
  'a thief pulls off a Grand Heist': "its event's",
  'a realm learns a Grand Heist was staged on it': "its event's",
  'a Grand Heist comes to nothing unnoticed': "its event's",
  'a thief is caught at the vaults and beaten back': "its event's",
  'a realm learns a thief was driven off its vaults': "its event's",
  'a hero lacks the Spy mastery to Assassinate': "its event's",
  'a hero finds no enemy hero to assassinate': "its event's",
  'an assassin stalks a vanished mark': "its event's",
  'an assassination of a hero whose crown is not at war is refused': "its event's",
  "an assassin's roll": "its event's",
  "a realm learns an attempt was made on its hero's life": "its event's",
  "an assassin's attempt fails": "its event's",
  'a hero lacks the Thief mastery to Vanish': "its event's",
  'a thief melts into the shadows': "its event's",
};
