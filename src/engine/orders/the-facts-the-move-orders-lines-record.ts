// ── THE FACTS THE MOVE ORDER'S LINES RECORD (plan P1-12d10: P1-12's Decisions of 2026-10-26, Decisions 2, 6 and 7) ──
// The lines the move order writes (orders/move-order-marches-voyages-and-battles-on-arrival.ts): where the order leads
// and why a column may not go (no movement left, the icy wastes, a neutral realm's border, a blockade, a flood, too
// little shipping, a fleet on land), the march, the voyage and the landing, what a hero sees on the way in (the graves
// underfoot, the sites he spots, a veiling illusion), the contingents that join an assault or miss it, and what holds
// the province: a neutral guard, an enemy hero (the defender's allies and standing troops forming up, which the battle's
// narrative takes), a garrison, leaderless troops, nobody, or a friend; then a coastal raid's plunder. Each kind holds
// plain values: a hero's, a realm's, a province's or a unit type's name as the world holds it (null where the world has
// none: the prose writes the words for it), a direction as the order names it, a terrain, a count, a level, a chance
// and its roll, a merit, a flag for a clause chosen by it, and lists copied as the line is told (the sites a hero
// spots, the units that rally, the names of the heroes who join); the prose writes every word (src/views/prose/the-
// words-of-the-move-orders-lines.ts). Each is filed on its own, or in a battle's narrative, with the audience its event
// names (Decision 6: its event's; in a battle's narrative, the battle's): no audience, hero or province changes, so every
// realm is told exactly what it was told before.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../dice-and-army-names.ts';

/** A site a hero spots as he marches into a province, as the line names it: its name, whether it is a ritual site or
 *  its lair already cleared, and its guardian's name (null: none named; the prose says "a creature"). */
export interface ASiteSpottedOnTheMarchAsTheLineNamesIt {
  readonly name: string;
  readonly isARitualSite: boolean;
  readonly isCleared: boolean;
  readonly guardianName: string | null;
}

/** A site as the world holds it, as much of it as the line reads. */
interface ASiteAsTheWorldHoldsIt {
  readonly name: string;
  readonly ritualSite?: boolean | undefined;
  readonly cleared?: boolean | undefined;
  readonly monster?: { readonly name?: string | undefined } | null | undefined;
}

/** A site a hero spots as he marches in, copied as the line is told. */
export function aSiteSpottedOnTheMarchAsTheLineNamesIt(
  f: ASiteAsTheWorldHoldsIt,
): ASiteSpottedOnTheMarchAsTheLineNamesIt {
  return { name: f.name, isARitualSite: !!f.ritualSite, isCleared: !!f.cleared, guardianName: f.monster?.name ?? null };
}

/** The sites a hero spots as he marches in, copied as the line is told. */
export function theSitesSpottedOnTheMarchAsTheLineNamesThem(
  sites: readonly ASiteAsTheWorldHoldsIt[],
): ASiteSpottedOnTheMarchAsTheLineNamesIt[] {
  return sites.map(aSiteSpottedOnTheMarchAsTheLineNamesIt);
}

/** How far a hero's march mapped the province he moved into: his realm's share mapped before, what the march added,
 *  and the share now. */
export interface TheMappingOfAMarchAsTheLineTellsIt {
  readonly before: number;
  readonly gain: number;
  readonly now: number;
}

/** The standing troops that rally to a province's defender, as the line names them: the garrison, or a fallen hero's
 *  leaderless host, each with its units copied as the line is told. */
export type TroopsThatRallyToADefender =
  | { kind: "the province's garrison rallies"; units: AUnitAsDescribeArmyNamesIt[] }
  | { kind: "a fallen hero's leaderless host rallies"; heroName: string; units: AUnitAsDescribeArmyNamesIt[] };

/** What a line of the move order records. */
export type TheFactOfTheMoveOrdersLine =
  | { kind: 'a hero has no movement points left this turn'; heroName: string }
  | { kind: 'a march to the edge of the world finds the icy wastes'; heroName: string; direction: string }
  | { kind: 'a move names no province to march to'; heroName: string }
  | { kind: 'a hero is already in the province his move names'; heroName: string; provinceName: string }
  | {
      kind: 'a displaced column finds no route to the province it meant to reach';
      heroName: string;
      wantedProvinceName: string;
      fromProvinceName: string;
    }
  | {
      kind: 'a displaced column turns toward its province by another way';
      heroName: string;
      wantedProvinceName: string;
      viaProvinceName: string;
    }
  | {
      kind: "a column is turned back at a neutral realm's border";
      heroName: string;
      provinceName: string;
      realmName: string;
      /** The realm at peace (null: none named; the prose says "that realm"). */
      otherRealmName: string | null;
    }
  | { kind: 'a column finds the waters sealed by an enemy blockade'; heroName: string; provinceName: string }
  | { kind: 'a column is turned back at a flooded province'; heroName: string; provinceName: string }
  | {
      kind: 'a fleet cannot move between land provinces without crossing the sea';
      heroName: string;
      unitTypes: string[];
    }
  | {
      kind: 'a column has too little shipping to put to sea';
      heroName: string;
      landUnitTypes: string[];
      hullsNeeded: number;
      berths: number;
      flyers: number;
      unliftableUnitTypes: string[];
      swimmingUnitTypes: string[];
    }
  | { kind: 'a column cannot enter a flooded province without sea movement'; heroName: string; provinceName: string }
  | { kind: 'a column is stranded by a flood with no sea movement'; heroName: string; provinceName: string }
  | { kind: 'a hero has no sea movement points left this turn'; heroName: string }
  | { kind: 'a hero moves across the sea'; heroName: string; provinceName: string }
  | {
      kind: 'a land column is stranded by a flood and cannot wade ashore';
      heroName: string;
      provinceName: string;
      destinationName: string;
    }
  | { kind: 'a hero has no sea movement points left to land'; heroName: string; provinceName: string }
  | { kind: "a hero's reavers drive their longships onto the shingle"; heroName: string; provinceName: string }
  | { kind: 'a hero makes a coastal landing'; heroName: string; provinceName: string }
  | { kind: 'a column leading naval units cannot march overland'; heroName: string; navalUnitTypes: string[] }
  | { kind: 'a fleet on land can only sail to an adjacent sea province'; heroName: string; unitTypes: string[] }
  | { kind: 'a column cannot enter the terrain of a province'; heroName: string; provinceName: string; terrain: string }
  | { kind: 'a hero has no land movement points left this turn'; heroName: string }
  | { kind: 'a necromancer senses graves underfoot on the march'; heroName: string; provinceName: string }
  | { kind: "a veiling illusion clouds a hero's search on the march"; heroName: string; provinceName: string }
  | {
      kind: 'a hero spots a site as he marches into a province';
      heroName: string;
      provinceName: string;
      site: ASiteSpottedOnTheMarchAsTheLineNamesIt;
    }
  | {
      kind: 'a hero spots several sites as he marches into a province';
      heroName: string;
      provinceName: string;
      sites: ASiteSpottedOnTheMarchAsTheLineNamesIt[];
    }
  | {
      kind: "a contingent joins a hero's assault on a guarded province";
      allyName: string;
      heroName: string;
      provinceName: string;
      marchLevel: number;
      chance: number;
      roll: number;
    }
  | {
      kind: 'a contingent cannot link up in time against a guarded province';
      allyName: string;
      heroName: string;
      provinceName: string;
      marchLevel: number;
      chance: number;
      roll: number;
    }
  | {
      kind: 'a combined force goes into battle against a guarded province';
      leaderName: string;
      units: number;
      reinforcedBy: string[];
    }
  | { kind: 'a Forced March slips into a province without giving battle'; heroName: string; provinceName: string }
  | {
      kind: "a hero marches in another hero's host against a province";
      heroName: string;
      commanderName: string;
      provinceName: string;
      /** He fell in its pre-battle duel: told in the past tense. */
      fellThere: boolean;
    }
  | { kind: "a fallen guard's garrison refuses to yield"; survivors: number; provinceName: string }
  | { kind: 'a beaten guard rallies his surviving units'; guardName: string; survivors: number; provinceName: string }
  | { kind: 'the battle for a guarded province is not over'; provinceName: string; guardName: string }
  | { kind: 'a beaten guard flees to a neighbouring province'; guardName: string; destinationName: string }
  | { kind: 'a beaten guard retreats into the wilderness'; guardName: string }
  | {
      kind: 'a hero claims a guarded province';
      heroName: string;
      /** He fell in the battle: his leaderless host claims it, and earns no merit. */
      heroFell: boolean;
      provinceName: string;
      realmName: string;
      merit: number;
    }
  | { kind: "a fallen guard's garrison holds the province"; provinceName: string }
  | { kind: 'leaderless troops form up with the garrison'; provinceName: string }
  | {
      kind: "a contingent joins a hero's assault on a rival's province";
      allyName: string;
      heroName: string;
      provinceName: string;
      chance: number;
      roll: number;
    }
  | { kind: "a contingent misses the timing against a rival's province"; allyName: string; provinceName: string }
  | {
      kind: 'a defender is reinforced by the heroes beside him';
      heroName: string;
      reinforcedBy: string[];
      provinceName: string;
    }
  | {
      kind: "a province's standing troops rally to its defender";
      provinceName: string;
      defenderName: string;
      troops: TroopsThatRallyToADefender[];
    }
  | {
      kind: "a hero stands in the battle line beside his realm's defender";
      heroName: string;
      defenderName: string;
      provinceName: string;
      /** He fell in its pre-battle duel: told in the past tense. */
      fellThere: boolean;
    }
  | {
      kind: "a defender's allies fall back with him";
      allyNames: string[];
      destinationName: string;
      defenderName: string;
    }
  | {
      kind: "a province's standing troops fall back with its defender";
      provinceName: string;
      destinationName: string;
      defenderName: string;
    }
  | {
      kind: "a hero carries the field but the rival's province stays contested";
      heroName: string;
      /** He fell in the battle: his leaderless host carries it. */
      heroFell: boolean;
      provinceName: string;
    }
  | {
      kind: "a hero claims a rival's province";
      heroName: string;
      /** He lives (else his leaderless host claims it). */
      heroIsAlive: boolean;
      provinceName: string;
      realmName: string;
    }
  | { kind: "a province's standing troops fall in with its defender"; provinceName: string; defenderName: string }
  | { kind: 'a broken garrison falls back to a neighbouring province'; provinceName: string; destinationName: string }
  | { kind: 'a hero takes a province as its garrison withdraws'; heroName: string; provinceName: string }
  | { kind: 'a garrison is driven back but not broken'; provinceName: string; survivors: number }
  | { kind: 'a hero breaks through the last of the garrison'; heroName: string; provinceName: string }
  | {
      kind: "a garrison throws a hero's attack back";
      provinceName: string;
      heroName: string;
      /** He had nowhere to fall back to: the struggle goes on. */
      heroIsTrapped: boolean;
      atSea: boolean;
    }
  | {
      kind: 'a hero seizes an undefended province';
      heroName: string;
      provinceName: string;
      /** The realm it is taken from (null: none). */
      previousOwnerName: string | null;
      realmName: string;
    }
  | { kind: 'a leaderless garrison refuses to yield'; provinceName: string; survivors: number }
  | {
      kind: 'a hero overcomes the leaderless defenders';
      heroName: string;
      provinceName: string;
      realmName: string;
      merit: number;
    }
  | { kind: 'a leaderless garrison throws a hero back'; provinceName: string; heroName: string }
  | { kind: 'a hero claims an unguarded province'; heroName: string; provinceName: string; realmName: string }
  | {
      kind: 'a hero without armies ventures in to explore';
      heroName: string;
      provinceName: string;
      mapping: TheMappingOfAMarchAsTheLineTellsIt;
    }
  | {
      kind: 'a hero moves to a province';
      heroName: string;
      provinceName: string;
      mapping: TheMappingOfAMarchAsTheLineTellsIt;
    }
  | {
      kind: "a hero's coastal raid sacks a province";
      heroName: string;
      provinceName: string;
      loot: number;
      /** Taken from a realm (else from nobody). */
      fromARealm: boolean;
      /** That realm's name (null: none named; the prose says "the enemy"). */
      previousOwnerName: string | null;
    };

/** Each kind's audience: its event's (a kind filed on its own, or in a battle's narrative). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_MOVE_ORDERS_LINE: Readonly<
  Record<TheFactOfTheMoveOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a hero has no movement points left this turn': "its event's",
  'a march to the edge of the world finds the icy wastes': "its event's",
  'a move names no province to march to': "its event's",
  'a hero is already in the province his move names': "its event's",
  'a displaced column finds no route to the province it meant to reach': "its event's",
  'a displaced column turns toward its province by another way': "its event's",
  "a column is turned back at a neutral realm's border": "its event's",
  'a column finds the waters sealed by an enemy blockade': "its event's",
  'a column is turned back at a flooded province': "its event's",
  'a fleet cannot move between land provinces without crossing the sea': "its event's",
  'a column has too little shipping to put to sea': "its event's",
  'a column cannot enter a flooded province without sea movement': "its event's",
  'a column is stranded by a flood with no sea movement': "its event's",
  'a hero has no sea movement points left this turn': "its event's",
  'a hero moves across the sea': "its event's",
  'a land column is stranded by a flood and cannot wade ashore': "its event's",
  'a hero has no sea movement points left to land': "its event's",
  "a hero's reavers drive their longships onto the shingle": "its event's",
  'a hero makes a coastal landing': "its event's",
  'a column leading naval units cannot march overland': "its event's",
  'a fleet on land can only sail to an adjacent sea province': "its event's",
  'a column cannot enter the terrain of a province': "its event's",
  'a hero has no land movement points left this turn': "its event's",
  'a necromancer senses graves underfoot on the march': "its event's",
  "a veiling illusion clouds a hero's search on the march": "its event's",
  'a hero spots a site as he marches into a province': "its event's",
  'a hero spots several sites as he marches into a province': "its event's",
  "a contingent joins a hero's assault on a guarded province": "its event's",
  'a contingent cannot link up in time against a guarded province': "its event's",
  'a combined force goes into battle against a guarded province': "its event's",
  'a Forced March slips into a province without giving battle': "its event's",
  "a hero marches in another hero's host against a province": "its event's",
  "a fallen guard's garrison refuses to yield": "its event's",
  'a beaten guard rallies his surviving units': "its event's",
  'the battle for a guarded province is not over': "its event's",
  'a beaten guard flees to a neighbouring province': "its event's",
  'a beaten guard retreats into the wilderness': "its event's",
  'a hero claims a guarded province': "its event's",
  "a fallen guard's garrison holds the province": "its event's",
  'leaderless troops form up with the garrison': "its event's",
  "a contingent joins a hero's assault on a rival's province": "its event's",
  "a contingent misses the timing against a rival's province": "its event's",
  'a defender is reinforced by the heroes beside him': "its event's",
  "a province's standing troops rally to its defender": "its event's",
  "a hero stands in the battle line beside his realm's defender": "its event's",
  "a defender's allies fall back with him": "its event's",
  "a province's standing troops fall back with its defender": "its event's",
  "a hero carries the field but the rival's province stays contested": "its event's",
  "a hero claims a rival's province": "its event's",
  "a province's standing troops fall in with its defender": "its event's",
  'a broken garrison falls back to a neighbouring province': "its event's",
  'a hero takes a province as its garrison withdraws': "its event's",
  'a garrison is driven back but not broken': "its event's",
  'a hero breaks through the last of the garrison': "its event's",
  "a garrison throws a hero's attack back": "its event's",
  'a hero seizes an undefended province': "its event's",
  'a leaderless garrison refuses to yield': "its event's",
  'a hero overcomes the leaderless defenders': "its event's",
  'a leaderless garrison throws a hero back': "its event's",
  'a hero claims an unguarded province': "its event's",
  'a hero without armies ventures in to explore': "its event's",
  'a hero moves to a province': "its event's",
  "a hero's coastal raid sacks a province": "its event's",
};
