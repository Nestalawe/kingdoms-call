// ── THE FACTS A BATTLE'S LINES RECORD (plan P1-12c3, c5 and c6: P1-12's Decisions of 2026-10-24, Decisions 2, 5 and 6) ──
// A typed line records a fact, and the views write its words after perception (src/views/prose/the-words-of-a-
// battles-lines.ts): the engine no longer writes those words itself. Each kind below is one sentence's sense, with the
// fields its words are made from, and its audience (Decision 6: THE_AUDIENCE_OF_EACH_KIND_OF_A_BATTLES_LINE, which
// emitNarrLine reads). Rows c4 to c6 add the rest of the fights' lines: c5 every sentence of a battle between two
// heroes' hosts and of the duel before a battle (battle/battles-between-heroes.ts, battle/pre-battle-duels.ts), c6 every
// other sentence of battle/ (a battle against a province's own defenders, a host gained in a province, a stalled
// battle, a war front, terror, the blood harvest, and the helpers that return a line: the kinship, Druid, eagle and
// command lines, the ladder and grid rows, the scouting and tactics lines, the units' fates, the battlecries), one
// kind per sentence, one field per value the sentence was written with, worked out where the line is told and in the
// sentence's order, so the words are the same by construction (TheFactOfOneOfABattlesSentences). P1-12d3 (P1-12's
// Decisions of 2026-10-26, Decisions 2 to 5) moved the words its fields held into the prose: a field holds plain values
// (a number, a flag, a name as the world or the content holds it, a slug, and lists copied as the line is told by the
// functions below), never a clause, a plural, a mark, a join or a number formatted for reading. What still holds words,
// listed by the static test (tests/static/a-lines-facts-hold-values-not-words.test.ts): a side's, a guard's or a unit's
// label (Decision 2: the facts-by-sense slice names a side). Since P1-12d20 no caller hands words in: a unit's fate's
// verb is a flag, a force's header's verb its values, a battle's severity its band's slug.
// P1-12d4 moved the strength ladder's and the grid's words into the prose too: their lines hold each modifier's reason,
// each unit's place and facing, and whom a unit faced, as the records below (the registry's effects name an ability by
// its slug, and the prose writes its name from the content's row). P1-12d5 made the lines a battle took as words from
// another folder's helper kinds: a unit disbanding is a battle's (below; disbandLine moved into the prose), a sea trap,
// a naval hold and the naval split the sea lift's (units/the-facts-the-sea-lifts-battle-lines-record.ts), a hero's
// death its own area's (heroes/the-facts-a-heros-death-lines-record.ts), the wanderer's escape his
// (the-facts-the-wanderers-escape-line-records.ts).
// LineFact (src/engine/turn/events-and-their-audiences.ts) is the union of every area's kinds; a kind with no words in
// src/views/prose/ is a compile error there.
import type { TheAudienceOfAKindOfLine, TheTierOfAKindOfABattlesLine } from '../turn/events-and-their-audiences.ts';
import type { AValueInALinesWords } from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../dice-and-army-names.ts';
import type { AnAbilityAsTheLadderNamesIt, WhyAShotGlancesOffAUnit } from '../rules/the-registry-of-content-effects.ts';
import type { UnitAbilitySlug } from '../../content/unit-abilities-their-names-numbers-and-words.ts';

// ── WHAT A BATTLE'S LINES READ, COPIED AS THE LINE IS TOLD (plan P1-12d3) ──
// A fact holds a copy of the world's values, never a part of it: the units a line names change after it is told (they
// die, rise a tier, leave), and its words are written at the turn's end.

/** The units a line names (a beaten host's survivors, a garrison), copied as the line is told: describeArmy's words. */
export function theUnitsAsTheLineNamesThem(units: readonly AUnitAsDescribeArmyNamesIt[]): AUnitAsDescribeArmyNamesIt[] {
  return units.map((a) => ({ unitName: a.unitName, type: a.type, quality: a.quality, _phantom: a._phantom }));
}

/** A unit short of its commander's Druid, as the shortfall's line tells it: its type and its strength's multiplier. */
export interface AUnitsDruidShortfall {
  readonly unitType: string;
  readonly penalty: number;
}

/** A unit the ground marks (its strength's multiplier below 0.85 or above 1.05), as the terrain's line tells it. */
export interface AUnitTheTerrainMarks {
  readonly unitType: string;
  readonly multiplier: number;
}

/** A battle's fortune, as its line tells it: the dice's swing and the two luck multipliers it gives. */
export interface TheFortuneAsTheLineTellsIt {
  readonly S: number;
  readonly atk: number;
  readonly def: number;
}

/** A battle's fortune, copied as the line is told. */
export function theFortuneAsTheLineTellsIt(fortune: TheFortuneAsTheLineTellsIt): TheFortuneAsTheLineTellsIt {
  return { S: fortune.S, atk: fortune.atk, def: fortune.def };
}

// ── WHAT THE STRENGTH LADDER AND THE BATTLE GRID RECORD (plan P1-12d4: P1-12's Decisions of 2026-10-26, Decisions 2, 5
// and 8, Choice 2) ── each reason a figure moved, and each unit a grid line or the ladder names, as plain values: a
// slug, a number, a unit's type or name, copied as the line is told. The prose writes the words (the labels a battle
// used to compose for them: armStr's, the commands', the whole force's, the grid's and the facing's).

/** A unit as the battle grid names it (shortUnit, in the prose): its type, or its row's name where it has no unit (the
 *  bots' estimates). */
export interface AUnitAsTheGridNamesIt {
  readonly a?: { readonly type: string } | null | undefined;
  readonly name?: string | null | undefined;
}

/** A unit as the battle grid names it, copied from its row as the line is told. */
export function aUnitAsTheGridNamesIt(row: AUnitAsTheGridNamesIt | null | undefined): AUnitAsTheGridNamesIt {
  return { a: row?.a ? { type: row.a.type } : null, name: row?.name };
}

/** Why a unit stands where it does in its side's grid, and fights at that place's multiplier (battleRegrid). */
export type WhyAUnitStandsWhereItDoes =
  | {
      readonly kind: 'its ability gives it its place';
      readonly ability: AnAbilityAsTheLadderNamesIt;
      readonly itsLine: 'front' | 'second';
    }
  | { readonly kind: 'a ranged unit in the front line' }
  | { readonly kind: 'a unit in the front line' }
  | { readonly kind: 'a ranged unit shooting over its fighter'; readonly theFighter: AUnitAsTheGridNamesIt }
  | { readonly kind: 'a unit in the second line' }
  | { readonly kind: 'a unit in the reserve' }
  | { readonly kind: 'a unit in the deep reserve' }
  | { readonly kind: 'a rider on the flank' }
  | { readonly kind: 'a flyer in the air' }
  | { readonly kind: 'a flyer in the air beyond the line' };

/** Whom a unit meets in the battle line, and how (battleFaceSide), with the abilities that moved its matchup. */
export type WhomAUnitMeets =
  | {
      readonly kind: 'it faces a unit' | 'it is met by a rider' | 'it shoots a unit' | 'it duels a rider';
      readonly theOther: AUnitAsTheGridNamesIt;
      readonly abilities: readonly AnAbilityAsTheLadderNamesIt[];
    }
  | {
      readonly kind: "it guards the line's end";
      readonly theOther: AUnitAsTheGridNamesIt | null;
      readonly abilities: readonly AnAbilityAsTheLadderNamesIt[];
    }
  | { readonly kind: "it wraps the line's end" }
  | { readonly kind: 'it shoots at an empty column' }
  | { readonly kind: 'it rides free' };

/** Why a unit fights at its facing's multiplier (battleFaceSide), as the ladder's stage "who faces whom" names it, in
 *  the order its words take: the unit, whom it meets, a wrapped end, a turned flank, its own abilities (beside and
 *  behind it in the front line, or in the air), and the marks the enemy's line leaves on it. */
export interface WhyAUnitFacesAsItDoes {
  readonly theUnit: AUnitAsTheGridNamesIt;
  readonly meets: WhomAUnitMeets | null;
  /** At a wrapped end of its front: held by an ability (its slug), or hit from the side (null). */
  readonly atAWrappedEnd?: { readonly heldBy: UnitAbilitySlug | null };
  /** Its flank turned by free riders: the ability that turned an anchored line, or none. */
  readonly flankTurned?: { readonly byAnAbility: UnitAbilitySlug | null };
  readonly itsOwnAbilities: readonly AnAbilityAsTheLadderNamesIt[];
  readonly marks: readonly AnAbilityAsTheLadderNamesIt[];
}

/** Whom a unit faced, as its fate's line tells it (battleFacedClauses): an enemy unit by its record (since plan
 *  P1-12d28 the record ownedUnitName's form is written from, its owner the enemy's side or the defenders) and how it met
 *  it, or where it stood. */
export type WhomAUnitFaced =
  | {
      readonly kind: 'an enemy unit';
      readonly how: 'faces' | 'met' | 'wraps' | 'shoots' | 'duel' | 'guards';
      readonly theEnemyUnit: AUnitAsALineNamesIt;
    }
  | { readonly kind: 'it rode free' }
  | { readonly kind: "it wrapped the line's end" }
  | { readonly kind: "it guarded the line's end" }
  | { readonly kind: 'it fought from the air' }
  | { readonly kind: 'it stood in the reserve' }
  | { readonly kind: 'it shot at an empty column' }
  | { readonly kind: 'it stood in the second line' }
  | { readonly kind: 'nobody stood opposite' };

/** A unit's place and its multiplier, as the ladder's stage "battle lines" names it (battleGridStage, in the prose). */
export interface AUnitsPlaceAsTheLadderTellsIt {
  readonly place: string;
  readonly mult: number;
  readonly row: AUnitAsTheGridNamesIt;
}

/** Every unit's place in a side's grid, copied as the ladder's line is told. */
export function theUnitsPlacesAsTheLadderTellsThem(
  units: readonly { readonly place: string; readonly mult: number; readonly row: AUnitAsTheGridNamesIt }[],
): AUnitsPlaceAsTheLadderTellsIt[] {
  return units.map((u) => ({ place: u.place, mult: u.mult, row: aUnitAsTheGridNamesIt(u.row) }));
}

/** A unit's facing, as the ladder's stage "who faces whom" names it (battleFacingStage, in the prose): its multiplier
 *  and why. */
export interface AFacingAsTheLadderTellsIt {
  readonly m: number;
  readonly why: WhyAUnitFacesAsItDoes;
}

/** Every unit's facing in a side's grid, copied as the ladder's line is told (battleFaceSide makes each why afresh). */
export function theFacingsAsTheLadderTellsThem(
  units: readonly { readonly m: number; readonly why: WhyAUnitFacesAsItDoes }[],
): AFacingAsTheLadderTellsIt[] {
  return units.map((u) => ({ m: u.m, why: u.why }));
}

/** What lifts a unit's quality for a battle, as the ladder's units stage names it. */
export type WhatLiftsAUnitsQuality = 'oratory' | 'druid' | 'necromancy' | 'tactical' | 'war-drum';

/** A modifier of a unit's own figure (armStr), as the ladder's units stage names it: the values its words are written
 *  from. */
export type AUnitsModifierInTheLadder =
  | {
      readonly kind: 'it fights at another quality';
      readonly quality: string;
      readonly liftedBy: readonly WhatLiftsAUnitsQuality[];
    }
  | { readonly kind: "its commander's Druid falls short"; readonly multiplier: number }
  | { readonly kind: 'its kin'; readonly bothTheKingsAndTheLeaders: boolean }
  | { readonly kind: 'a racial animosity' }
  | { readonly kind: 'the ground'; readonly terrain: string; readonly multiplier: number }
  | { readonly kind: 'elven woodland mastery' }
  | { readonly kind: 'the dwarven bulwark' }
  | { readonly kind: 'the standing stones' }
  | { readonly kind: "the realm's unit discoveries"; readonly multiplier: number }
  | { readonly kind: 'terror'; readonly multiplier: number }
  | { readonly kind: 'the reign of fear'; readonly multiplier: number }
  | { readonly kind: 'the pre-battle volleys and spells' }
  | { readonly kind: 'phantasmal armies'; readonly multiplier: number }
  | { readonly kind: "the commander's magic items" }
  | { readonly kind: "the unit's ability"; readonly unitType: string; readonly multiplier: number }
  | { readonly kind: 'the home of the wild' }
  | { readonly kind: "the commander's druid mastery"; readonly multiplier: number }
  | { readonly kind: "a naturalist's or beastmaster's title" }
  | { readonly kind: "a cavalier's title" }
  | { readonly kind: "an ironclad's title" };

/** One modifier of a unit's figure in a side's ladder: why, and, for one that adds or takes strength, by how much. */
export interface AModifierOfAUnitInTheLadder {
  readonly reason: AUnitsModifierInTheLadder;
  readonly delta?: number | null | undefined;
}

/** A multiplier of the command stage (the commander's Archery, Naval or Tactical, or illusory ground), as the ladder
 *  names it. */
export type ACommandMultiplierInTheLadder =
  | { readonly kind: 'archery'; readonly level: number; readonly multiplier: number }
  | { readonly kind: 'naval'; readonly level: number; readonly multiplier: number }
  | { readonly kind: 'tactical'; readonly multiplier: number }
  | { readonly kind: 'tactical at its level'; readonly level: number; readonly multiplier: number }
  | { readonly kind: 'illusory terrain'; readonly multiplier: number };

/** A command multiplier that applied to a unit (ladderRow): why, its kind of command, and the multiplier. */
export interface ACommandMultiplierOfAUnit {
  readonly reason: ACommandMultiplierInTheLadder;
  readonly key?: string | undefined;
  readonly m: number;
}

/** A side's Tactical, as the ladder's command stage weighs it against the units it reached. */
export interface ASidesTacticalInTheLadder {
  readonly mult: number;
  readonly reason: ACommandMultiplierInTheLadder;
}

/** A multiplier of the whole force, as the ladder names it. */
export type AForceWideModifierInTheLadder =
  | 'morale'
  | 'orders'
  | 'home-ground'
  | 'fanaticism'
  | 'discoveries'
  | 'consecrated-ground'
  | 'defenders-position'
  | 'home'
  | 'duel-morale'
  | 'sanctuary-wards';

/** A multiplier of the whole force that moved it, and why. */
export interface AForceWideModifierOfASide {
  readonly reason: AForceWideModifierInTheLadder;
  readonly m: number;
}

/** Every modifier of each unit's own figure in a side's ladder, in the units' order, copied as the line is told. */
export function theUnitsModifiersAsTheLadderTellsThem(
  rows: readonly { readonly _tr?: readonly AModifierOfAUnitInTheLadder[] | undefined }[],
): AModifierOfAUnitInTheLadder[] {
  return rows.flatMap((r) => (r._tr ?? []).map((e) => ({ reason: e.reason, delta: e.delta })));
}

/** Every command multiplier that applied to each unit of a side, in the units' order, copied as the line is told. */
export function theCommandMultipliersAsTheLadderTellsThem(
  rows: readonly { readonly _cmd?: readonly ACommandMultiplierOfAUnit[] | undefined }[],
): ACommandMultiplierOfAUnit[] {
  return rows.flatMap((r) => (r._cmd ?? []).map((c) => ({ reason: c.reason, key: c.key, m: c.m })));
}

/** The multipliers that moved a side's whole force, copied as the line is told. */
export function theForceWideModifiersAsTheLadderTellsThem(
  modifiers: readonly AForceWideModifierOfASide[],
): AForceWideModifierOfASide[] {
  return modifiers.map((x) => ({ reason: x.reason, m: x.m }));
}

/** How many verbs a victory is told with (the prose's WIN_VERBS): the engine draws which, the prose writes it
 *  (Decision 4: a die drawn for words stays where it is drawn, and the fact holds which). */
export const THE_NUMBER_OF_VERBS_A_VICTORY_IS_TOLD_WITH = 5;

/** How many verbs an attack on a province's defenders is told with (the prose's verbs of an attack): the engine draws
 *  which, where it drew the verb before (Decision 4: a die drawn for words stays where it is drawn, and the fact holds
 *  which). */
export const THE_NUMBER_OF_VERBS_AN_ATTACK_IS_TOLD_WITH = 6;
/** The verb a hero's host attacks another hero's with, by its index in the verbs of an attack ("attacks"). */
export const THE_VERB_A_HERO_ATTACKS_A_HEROS_HOST_WITH = 3;
/** The verb a hero holds a province against another hero's host with, by its index in the verbs of a defence ("holds
 *  the line in"). */
export const THE_VERB_A_HERO_HOLDS_A_PROVINCE_WITH = 0;
/** The verb a province's own defenders stand with against an attacker, by its index in the verbs of a defence ("stands
 *  firm in"). */
export const THE_VERB_A_PROVINCES_DEFENDERS_STAND_WITH = 1;

/** How a force comes on, as its header's verb tells it (P1-12d20; the battle handed these words in before): the verb,
 *  by its index in an attack's verbs or a defence's, the province, the force's strength, and its commander's Tactical
 *  level where the header names it. The prose writes "storms Highmoor — army strength 40, with". */
export interface HowAForceComesOnInItsHeader {
  /** Which verbs its verb is one of: an attack's or a defence's. */
  itsVerbs: 'an attack' | 'a defence';
  /** Its verb, by its index in those verbs. */
  verbIndex: number;
  provName: string;
  /** The force's strength, as its header gives it (rounded by the battle). */
  armyStrength: number;
  /** Its commander's Tactical level (a battle between heroes' header names it above 0), or null where the header never
   *  names it (a battle against a province's defenders). */
  tacticalLevel: number | null;
}

/** A side of a battle between heroes, as its label is written from (plan P1-12d22: the battle slice's Decision 6): its
 *  commander's name as the world holds it, and whether he fell before the lines joined, which makes the side "<name>'s
 *  leaderless host". Since P1-12d24 a host in a stalled battle and a hero's newly gathered host too. The prose writes
 *  the label (theLabelOfASide). */
export interface ASideOfABattle {
  readonly heroName: string;
  readonly leaderless: boolean;
}

/** The defenders of a province, as a battle against them names them (plan P1-12d23: the battle slice's Decision 6):
 *  led by their guard (his name as each place hands it, " (wandering)" cut or not: "Ulric", "Ulric and their forces",
 *  "Ulric and the local defenders"), or with no guard to lead them (none, or he fell before the lines joined): "the
 *  defenders of Highmoor" ("The defenders of Highmoor" where the place writes it so), "the garrison of Highmoor" (a
 *  realm's unled garrison), "Westmarch's garrison", "its neutral defenders"; or the realm that holds the province, by
 *  its name as the world holds it. Since P1-12d24 a stalled battle's defenders with no guard ("the leaderless garrison")
 *  and a beaten guard's with no name to give ("the defenders"). The prose writes the label (theLabelOfTheDefenders). */
export type TheDefendersOfAProvince =
  | { readonly kind: 'the defenders led by their guard'; readonly guardName: string }
  | {
      readonly kind: 'the defenders of a province with no guard to lead them';
      readonly provName: string;
      readonly capitalised: boolean;
    }
  | { readonly kind: "a realm's garrison of a province with no guard to lead it"; readonly provName: string }
  | { readonly kind: "a realm's garrison with no guard to lead it"; readonly ownerName: string }
  | { readonly kind: 'neutral defenders with no guard to lead them' }
  | { readonly kind: 'a leaderless garrison' }
  | { readonly kind: 'defenders with no guard to name them' }
  | { readonly kind: 'the realm that holds the province'; readonly realmName: string | undefined };

/** The owner of a battle's units, as their lines name him (plan P1-12d28: rollUnitFates' owner and battleFacedClauses'
 *  enemy owner): a side of the battle, or a province's defenders. */
export type TheOwnerOfABattlesUnits = ASideOfABattle | TheDefendersOfAProvince;

/** A side as a battle's report lines name it (plan P1-12d30: the battle slice's Decision 6 of 2026-10-31; the battle
 *  handed these helpers its label in words before): a side (ASideOfABattle), a province's defenders
 *  (TheDefendersOfAProvince), or a form only these lines write: a hero's host ("Aldric's host": the kinship line), a
 *  province's defenders whoever leads them ("the defenders of Highmoor": the kinship line), a province's guards with no
 *  guard to name them ("Guards": the battle grid). Since P1-12d31 the lines before the volleys too (Flak Screen and Eyes
 *  of the Forest), and their form for a province's defenders with no guard to name them ("The defenders"). The prose
 *  writes the label (theLabelOfASideAsTheReportLinesNameIt). */
export type ASideAsABattlesReportLinesNameIt =
  | ASideOfABattle
  | TheDefendersOfAProvince
  | { readonly kind: "a hero's host in the battle"; readonly heroName: string }
  | { readonly kind: "a province's defenders, whoever leads them"; readonly provName: string }
  | { readonly kind: "a province's guards with no guard to name them" }
  | { readonly kind: "a province's defenders with no guard to name them, as the lines before the volleys name them" };

/** The values a unit's label is written from: its owner as the line names him (a side, the defenders, or none), and its
 *  name, type and quality as the world holds them as the line is told. */
interface TheValuesAUnitIsNamedFrom {
  readonly owner: TheOwnerOfABattlesUnits | null;
  readonly unitName: string;
  readonly type: string;
  readonly quality: string;
}

/** A unit as a line names it (plan P1-12d25: the battle slice's Decision 6), by which form names it: with its quality
 *  ("Aldric's Veteran Free Lances", "the Red Hand (Aldric's Free Lances, Veteran)": unitRef), without it ("Aldric's
 *  Free Lances": ownedUnitName), or by its name, else its type, alone. The prose writes the label (theLabelOfAUnit). */
export type AUnitAsALineNamesIt =
  | ({ readonly kind: 'a unit named with its quality' } & TheValuesAUnitIsNamedFrom)
  | ({ readonly kind: 'a unit named without its quality' } & TheValuesAUnitIsNamedFrom)
  | ({ readonly kind: 'a unit named by its name or type alone' } & TheValuesAUnitIsNamedFrom);

/** How hard a battle was won: the margin band's slug (BATTLE_MARGIN_BANDS, battle/fates.ts), which the prose writes
 *  ("a pyrrhic battle", "an annihilating engagement"). */
export type TheSeverityOfABattle = 'pyrrhic' | 'narrow' | 'clear' | 'decisive' | 'crushing' | 'annihilating';

// ── A BATTLE'S OUTCOME, ONE KIND FOR EACH AUDIENCE (plan P1-12d26: P1-12's Decisions of 2026-10-31, Decision 2) ──
// A battle's outcome was 22 kinds, one for each sentence; it is two, merged by sense within one audience: a battle is
// decided (the fight's: a battle between two hosts or against a province's defenders, told in the fight's narrative)
// and a contest for a province is decided (its event's: a hero's newly gathered host, a stalled battle, each filed on
// its own). Each holds which battle or contest it was, its sides, the winner's role or what becomes of the province, as
// slugs, and the values its sentence is written from; the prose switches on them to the same 22 sentences
// (theWordsOfABattleDecided, theWordsOfAContestForAProvinceDecided). A reader of the outcome reads one kind for each
// audience.

/** A battle between two hosts or against a province's defenders is decided, as the fight's narrative tells it: which
 *  battle, the two sides (the attacker's, and the defender's or the defenders), the winner's role, and what becomes of
 *  the province: seized, held by the defender's survivors (the head line rewritten in place when the beaten side holds
 *  the field), the attacker driven out or not, the beaten host staying on as the stronger (a line of its own after the
 *  casualties), the attacker sweeping in with no one left to stand, the defenders beaten (what becomes of the province
 *  is told after), the defenders holding their ground. Its audience: the fight's. */
export type ABattleIsDecided = { kind: 'a battle is decided' } & (
  | {
      battle: 'between two hosts';
      winnersRole: 'the attacker';
      whatBecomesOfTheProvince: 'seized' | "held by the defender's survivors";
      severity: TheSeverityOfABattle;
      winVerbIndex: number;
      attackersSide: ASideOfABattle;
      defendersSide: ASideOfABattle;
      provName: string;
    }
  | {
      battle: 'between two hosts';
      winnersRole: 'the defender';
      whatBecomesOfTheProvince: 'the attacker is driven out' | 'the attacker is not driven out';
      severity: TheSeverityOfABattle;
      attackersSide: ASideOfABattle;
      defendersSide: ASideOfABattle;
      provName: string;
    }
  | {
      battle: 'between two hosts';
      winnersRole: 'the attacker' | 'the defender';
      whatBecomesOfTheProvince: 'the beaten host stays, still the stronger';
      attackersSide: ASideOfABattle;
      defendersSide: ASideOfABattle;
      stayingHostStrength: number;
      victorsStrength: number;
      provName: string;
    }
  | {
      battle: "against a province's defenders";
      winnersRole: 'the attacker';
      whatBecomesOfTheProvince: 'swept into, with no one left to stand';
      attackersSide: ASideOfABattle;
      theDefenders: TheDefendersOfAProvince;
      provName: string;
    }
  | {
      battle: "against a province's defenders";
      winnersRole: 'the attacker';
      whatBecomesOfTheProvince: 'the defenders are beaten';
      severity: TheSeverityOfABattle;
      margRatio: number;
      winVerbIndex: number;
      attackersSide: ASideOfABattle;
      theDefenders: TheDefendersOfAProvince;
      provName: string;
    }
  | {
      battle: "against a province's defenders";
      winnersRole: 'the defender';
      whatBecomesOfTheProvince: 'held by its defenders';
      severity: TheSeverityOfABattle;
      margRatio: number;
      attackersSide: ASideOfABattle;
      theDefenders: TheDefendersOfAProvince;
      aPlayersGarrison: boolean;
      atSea: boolean;
      provName: string;
    }
);

/** A contest for a province is decided, as a line filed on its own tells it: which contest (a hero's newly gathered
 *  host in the province, a stalled battle against its defenders, a stalled battle between two hosts), and what becomes
 *  of the province: taken with no one to defend it (on a war front, or with fresh troops), still held (by its guard, by
 *  leaderless defenders, by enemy forces, by its garrison), claimed, the attacker breaking off and retreating, secured
 *  by the winner, secured unopposed. Its audience: its event's. */
export type AContestForAProvinceIsDecided = { kind: 'a contest for a province is decided' } & (
  | {
      contest: 'a host gathered in the province';
      whatBecomesOfTheProvince: 'taken with no one to defend it';
      onAWarFront: boolean;
      cName: string;
      provName: string;
      playerName: string;
    }
  | {
      contest: 'a host gathered in the province';
      whatBecomesOfTheProvince: 'still held';
      heldBy: 'its guard';
      theHost: ASideOfABattle;
      provName: string;
      guardName: string;
      guardUnitCount: number;
    }
  | {
      contest: 'a host gathered in the province';
      whatBecomesOfTheProvince: 'still held';
      heldBy: 'leaderless defenders';
      theHost: ASideOfABattle;
      provName: AValueInALinesWords;
      leaderlessUnitCount: number;
    }
  | {
      contest: 'a host gathered in the province';
      whatBecomesOfTheProvince: 'still held';
      heldBy: 'enemy forces';
      theHost: ASideOfABattle;
      provName: string;
    }
  | {
      contest: 'a host gathered in the province';
      whatBecomesOfTheProvince: 'still held';
      heldBy: 'its garrison';
      theHost: ASideOfABattle;
      provName: AValueInALinesWords;
      atSea: boolean;
    }
  | {
      contest: 'a host gathered in the province';
      whatBecomesOfTheProvince: 'claimed';
      theHost: ASideOfABattle;
      provName: string;
      playerName: string;
    }
  | {
      contest: "a stalled battle against a province's defenders";
      whatBecomesOfTheProvince: 'still held';
      heldBy: 'its guard';
      guardName: string;
      provName: string;
    }
  | {
      contest: "a stalled battle against a province's defenders";
      whatBecomesOfTheProvince: 'still held';
      heldBy: 'leaderless defenders';
      leaderlessUnitCount: number;
      provName: AValueInALinesWords;
    }
  | {
      contest: "a stalled battle against a province's defenders";
      whatBecomesOfTheProvince: 'claimed';
      theHost: ASideOfABattle;
      provName: string;
    }
  | {
      contest: "a stalled battle against a province's defenders";
      whatBecomesOfTheProvince: 'the attacker breaks off and retreats';
      theHost: ASideOfABattle;
      retreatToName: AValueInALinesWords;
    }
  | {
      contest: 'a stalled battle between two hosts';
      whatBecomesOfTheProvince: 'secured by the winner' | 'secured unopposed';
      theHost: ASideOfABattle;
      provName: string;
    }
);

// ── A UNIT'S FATE, ONE KIND FOR EACH AUDIENCE (plan P1-12d27: P1-12's Decisions of 2026-10-31, Decision 4) ──
// A unit's fate was 15 kinds, one for each sentence: 12 of the fight's (rollUnitFates' 6 and the 2 the rule registry
// names, and the 4 a battle writes itself: a defending unit destroyed in the rout or in the fighting, a unit cut down
// with no escape, an attacking unit cut down in the rout) and a beaten guard's surviving unit's 3 of its event's, beside
// the disbanding it shared with rollUnitFates. It is two, merged by sense within one audience: a unit's fate in the
// battle (the fight's, told in the fight's narrative) and a beaten guard's surviving unit's fate (its event's: its
// callers file it on its own; the disbanding goes with it). Each holds the unit's record, its fate as a slug and the
// values its sentence is written from; the prose switches on them to the sentences the 15 kinds had
// (theWordsOfAUnitsFateInTheBattle, theWordsOfABeatenGuardsSurvivingUnitsFate). A reader of the fates reads one kind for
// each audience.

/** A unit's fate in a battle, as the fight's narrative tells it: the unit's record at its quality before its fate,
 *  whether its side won, what becomes of it, whom it faced (a clause after its name), and the values its sentence is
 *  written from. It dies (annihilated in the rout, destroyed in the fighting or in the rout, its bones crumbling; the
 *  defenders' own rolls in a battle against them never tell the bones), is cut down with no escape (trapped, or in the
 *  rout, its bones crumbling), is cut down and rises again by its regenerating hide, rises a tier (hardened by victory,
 *  earned, or despite defeat), falls back behind the shield wall in good order, keeps its nerve under the knightly
 *  example, loses heart and falls a tier, or has had enough and disbands (its owner, name and type: the disbanding's
 *  own form of its label). Its audience: the fight's. */
export type AUnitsFateInTheBattle = { kind: "a unit's fate in the battle"; itsSideWon: boolean } & (
  | {
      fate: 'dies';
      theUnit: AUnitAsALineNamesIt;
      whomItFaced: WhomAUnitFaced | null;
      /** The rout a beaten host's companies die in (a battle's loser that fled the field), told as an annihilation. */
      inTheRout: boolean;
      itsBonesCrumble: boolean | undefined;
    }
  | { fate: 'is cut down with no escape'; inTheRout: false; theUnit: AUnitAsALineNamesIt }
  | {
      fate: 'is cut down with no escape';
      inTheRout: true;
      theUnit: AUnitAsALineNamesIt;
      itsBonesCrumble: boolean | undefined;
    }
  | {
      fate:
        | 'is cut down and rises again by its regenerating hide'
        | 'falls back behind the shield wall in good order'
        | 'keeps its nerve under the knightly example';
      theUnit: AUnitAsALineNamesIt;
      whomItFaced: WhomAUnitFaced | null;
    }
  | {
      fate: 'rises a tier';
      theUnit: AUnitAsALineNamesIt;
      whomItFaced: WhomAUnitFaced | null;
      /** A victorious defender's company, told as hardened by victory; else it earns its promotion (a winner's) or
       *  improves despite defeat (a beaten side's). */
      hardenedByVictory: boolean;
      itsQualityAfter: string;
    }
  | {
      fate: 'loses heart and falls a tier';
      theUnit: AUnitAsALineNamesIt;
      whomItFaced: WhomAUnitFaced | null;
      itsQualityAfter: string;
    }
  | {
      fate: 'has had enough and disbands';
      /** The units' owner, as the battle names him (a side's record or the defenders'); null: none named. */
      theUnitsOwner: TheOwnerOfABattlesUnits | null;
      unitName: string | null | undefined;
      unitType: string;
      whomItFaced: WhomAUnitFaced | null;
    }
);

/** A beaten guard's surviving unit's fate, as a line filed on its own tells it (erodeGuardSurvivors): the unit's record
 *  at its quality before its fate, and what becomes of it: it breaks ranks and flees as mercenaries near the province,
 *  loses heart and falls a tier, holds its ground unbroken (both rallying around the guard), or has had enough and
 *  disbands (the guard, its name and type: the disbanding's own form of its label). The victor's name, " (wandering)"
 *  cut: the prose writes "<name>'s host"; null for none. Its audience: its event's. */
export type ABeatenGuardsSurvivingUnitsFate = { kind: "a beaten guard's surviving unit's fate" } & (
  | {
      fate: 'breaks ranks and flees as mercenaries';
      theUnit: AUnitAsALineNamesIt;
      victorsHost: string | null;
      provName: string;
    }
  | {
      fate: 'loses heart and falls a tier';
      theUnit: AUnitAsALineNamesIt;
      itsQualityAfter: string;
      victorsHost: string | null;
      theGuard: TheDefendersOfAProvince;
    }
  | {
      fate: 'holds its ground unbroken';
      theUnit: AUnitAsALineNamesIt;
      victorsHost: string | null;
      theGuard: TheDefendersOfAProvince;
    }
  | {
      fate: 'has had enough and disbands';
      theGuard: TheDefendersOfAProvince;
      unitName: string | null | undefined;
      unitType: string;
    }
);

/** One unit of a force drawn up for battle, as its header row shows it. */
export interface AUnitOfAForceDrawnUp {
  type: string;
  quality: string;
  unitName: string;
  race: string | null;
  phantom: boolean;
  skeletal: boolean;
  wildHunt: boolean;
  wildHuntUntil: number | null;
}

/** The force a battle's header names, as its name is written from (plan P1-12d29: the battle slice's Decision 5): a
 *  hero, with the realm he serves in brackets only when he serves one ("Aldric (Westmarch)", "Aldric": P1-23a), a
 *  province's guard ("The Chieftain of Greyford"), a realm's garrison at a province ("Westmarch's garrison at
 *  Greyford"), or a province's own defenders with no one to lead them ("The defenders of Greyford"). The prose writes
 *  the name (theNameOfTheForceAHeaderNames); the engine keeps a copy of its words for the leaderless check alone
 *  (theNameAForcesHeaderIsCheckedBy, battle-report-lines-and-force-markers.ts). */
export type TheForceABattlesHeaderNames =
  | {
      readonly kind: 'a hero, with the realm he serves';
      readonly heroName: string;
      readonly servesARealm: boolean;
      /** The realm's name as the world holds it: read only when he serves one. */
      readonly realmName: string | undefined;
    }
  | { readonly kind: "a province's guard at the head of its force"; readonly guardName: string }
  | { readonly kind: "a realm's garrison at a province"; readonly ownerName: string; readonly provName: string }
  | { readonly kind: "a province's own defenders with no one to lead them"; readonly provName: string };

/** A side's force as a battle begins: its header (its name, its owner's colour, how it comes on) and one row per unit
 *  (forceMarker, battle-report-lines-and-force-markers.ts). Its words are the header's machine form, which the player
 *  page and the GM page draw as the force's rows. Its audience: the fight's. */
export interface AForceDrawnUpForBattle {
  kind: 'a force drawn up for battle';
  /** The force its header names (plan P1-12d29). */
  theForce: TheForceABattlesHeaderNames;
  /** The commander who fell earlier in the battle series and whose host this is (forceMarker's leaderless check: his
   *  name, " (wandering)" cut), or null: the header then names "<his name>'s leaderless host" (2026-09-23, Toby's
   *  item 10). */
  fallenCommandersName: string | null;
  color: string | null;
  neutral: boolean;
  guard: boolean;
  role: string;
  /** How it comes on, as its header's verb tells it: null for none (the header's verb is then empty). */
  howItComesOn: HowAForceComesOnInItsHeader | null;
  armies: AUnitOfAForceDrawnUp[];
}

/** Where a battle's losses tally goes (emitBattle files it after the battle's lines): the views work the tally out from
 *  the words of the battle's lines, and put it where the casualty lists begin, or leave it out when there is none to
 *  tally. It has no words of its own. Its audience: the fight's. */
export interface ABattlesLossesTalliedFromItsLines {
  kind: "a battle's losses, tallied from its lines";
}

/** What a shot that weakens its target adds to its line: double against a flyer, Thick Hide's half, the shooters' own
 *  ability's multiplier, a target softened to the limit. */
export interface TheClausesOfAShotThatWeakensItsTarget {
  againstAFlyer: boolean;
  thickHideHalvesIt: boolean | undefined;
  shootersUnitType: string;
  shootersAbilityMultiplier: number;
  softenedToTheLimit: boolean;
}

/** Why a commander's force is demoralised by the duel before a battle (preBattleDuel's demoralise; P1-12d11): a slug
 *  the prose reads. */
export type WhyACommandersForceIsDemoralised =
  'he refused the challenge' | 'he was driven from the field' | 'he fell in single combat' | 'he broke off the duel';

/** One sentence of a battle's lines, each with its kind: one kind per sentence, one field per value it was written
 *  with. Their audience: the fight's, or for those filed on their own (not in a fight's narrative), their event's. */
export type TheFactOfOneOfABattlesSentences =
  | ABattleIsDecided
  | AContestForAProvinceIsDecided
  | AUnitsFateInTheBattle
  | ABeatenGuardsSurvivingUnitsFate
  | {
      kind: "the attacker's lightning advance catches the defender unready";
      atkName: AValueInALinesWords;
      defName: AValueInALinesWords;
    }
  | {
      kind: 'the attacker moves into the province and a battle is initiated';
      atkName: string;
      /** None when the attacker serves no realm: the words then name no realm. */
      attackersRealmName: string | undefined;
      provName: string;
      heldByName: string;
    }
  | { kind: 'the battle for a province begins'; provName: string }
  | {
      kind: 'the province still cowers under a reign of fear';
      provName: string;
      terrorHeroName: string;
      reignOfFearMultiplier: number;
    }
  | { kind: 'the attacker is cut down before the lines join, and a captain takes command'; atkName: string }
  | { kind: 'the defender is slain before his army, and a veteran takes command'; defName: string }
  | { kind: "the attacker fights to win back his realm's capital"; atkName: ASideOfABattle; provName: string }
  | {
      kind: "the attacker's siegecraft wears down the defenders' fortifications";
      atkName: ASideOfABattle;
      siegecraft: number;
    }
  | { kind: "the defender's host defends ground held justly"; defName: ASideOfABattle }
  | {
      kind: "the defender's realm holds its own ground the harder";
      defName: ASideOfABattle | TheDefendersOfAProvince;
      ownGroundDefencePct: number;
    }
  | { kind: "the defender's banner of the realm rallies the home defence"; defName: ASideOfABattle }
  | { kind: "the attacker's siege mastery halves the defenders' fortifications"; atkName: ASideOfABattle }
  | { kind: 'the defenders fight on home ground' }
  | {
      kind: "a side's skeletal legions fight with fanaticism under their undead king";
      sideName: ASideOfABattle;
      undeadKingFanaticismPct: number;
    }
  | { kind: "a side's monsters are driven to savage fury"; sideName: ASideOfABattle }
  | { kind: "a side's skeletal legions know no fear"; sideName: ASideOfABattle; undeadHeroFanaticismPct: number }
  | { kind: "the attacker's forces fight with fanatical zeal"; atkName: ASideOfABattle }
  | { kind: 'the defenders fight with fanatical zeal on consecrated ground'; provName: string; defName: ASideOfABattle }
  | { kind: "the defender's forces fight with fanatical zeal"; defName: ASideOfABattle }
  | {
      kind: 'the caster casts a spell before the battle';
      casterName: string;
      spellName: string;
      schoolLabel: string;
      spellLevel: number;
      castChance: number;
      castRoll: number;
    }
  | { kind: 'the spell before the battle fizzles' }
  | {
      kind: "a fireball halves the enemy's strongest units";
      fireballHitUnitNames: string[];
    }
  | { kind: "a telekinetic storm scatters the enemy commander's formations"; enemyCommanderName: ASideOfABattle }
  | { kind: 'a telekinetic storm finds no tactical command to disrupt'; enemyCommanderName: ASideOfABattle }
  | { kind: "a psychic blast severs the enemy commander's bond with his beasts"; enemyCommanderName: ASideOfABattle }
  | { kind: 'a lightning bolt weakens enemy units'; unitCount: number }
  | {
      kind: "a curse withers the enemy commander's skill";
      enemyCommanderName: ASideOfABattle;
      cursedSkill: string | null | undefined;
    }
  | {
      kind: "control undead turns an enemy undead unit to the caster's side";
      turnedUnitName: string;
      casterName: string;
    }
  | { kind: 'control undead finds no enemy undead to turn' }
  | { kind: 'a holy symbol weakens enemy undead units'; undeadUnitCount: number }
  | { kind: 'a holy symbol finds no enemy undead to smite' }
  | { kind: 'spiritwrack halves enemy missile units'; missileUnitCount: number }
  | { kind: 'spiritwrack finds no enemy missile troops' }
  | {
      kind: "a unit's power gathers but never strikes";
      unitName: string;
      powerName: string;
      strikeChancePct: number;
      druidLevel: number;
    }
  | { kind: 'a unit uses its power in battle'; unitName: string; powerName: string; powerFlavour: string }
  | { kind: "a unit's power hits all enemy units"; enemyUnitCount: number; damage: number }
  | { kind: "a unit's power hits one enemy unit"; struckUnitName: string; damage: number }
  | { kind: "the hero's archers find no target among the forest wardens"; heroName: ASideOfABattle }
  | {
      kind: "the hero's archery volley begins";
      heroName: string;
      missileUnitCount: number;
      doubleVolleys: boolean;
      oneMoreShot: boolean;
      preparedGround: boolean;
    }
  | {
      kind: "a unit's shot glances off its target";
      shooterName: AValueInALinesWords;
      targetUnitName: AValueInALinesWords;
      whyTheShotGlances: WhyAShotGlancesOffAUnit | undefined;
    }
  | ({
      kind: "a unit's shot weakens its target";
      shooterName: string;
      targetUnitName: string;
      damage: number;
    } & TheClausesOfAShotThatWeakensItsTarget)
  | {
      kind: "a unit's target is already softened as far as arrows allow";
      shooterName: AValueInALinesWords;
      targetUnitName: AValueInALinesWords;
    }
  | {
      kind: "a side's whale cohort sinks an enemy ship";
      sideName: AValueInALinesWords;
      targetUnitName: AValueInALinesWords;
      /** The sunk hull's type (the losses tally counts it). */
      targetUnitType: string;
      /** The side whose hull sinks: the other side's whale cohort sinks it (the losses tally counts it there). */
      theSideWhoseShipSinks: 'attacker' | 'defender';
    }
  | {
      kind: "the terrain's effect on each side";
      terrain: string;
      atkName: ASideOfABattle;
      unitsTheTerrainMarksOfTheAttacker: AUnitTheTerrainMarks[] | null;
      defName: ASideOfABattle;
      unitsTheTerrainMarksOfTheDefender: AUnitTheTerrainMarks[] | null;
    }
  | {
      kind: 'hosts airborne over open water fight at a penalty';
      attackersHostIsAirborne: boolean;
      defendersHostIsAirborne: boolean;
      atkName: ASideOfABattle;
      defName: ASideOfABattle;
      seaAirborneLandPenalty: number;
      seaAirborneFlyerPenalty: number;
    }
  | { kind: 'land units fight at sea at a penalty'; seaLandPenalty: number }
  | {
      kind: "a side's realm discoveries strengthen its army";
      sideName: ASideOfABattle;
      discoveriesBonus: number;
    }
  | { kind: "the illusory ground of the province confuses a side's forces"; provName: string; sideName: ASideOfABattle }
  | {
      kind: "the sanctuary wards of the province sap a side's attackers";
      provName: AValueInALinesWords;
      sideName: ASideOfABattle;
    }
  | { kind: 'the attacker unfolds a grand stratagem'; atkName: ASideOfABattle }
  | { kind: 'the defender unfolds a grand stratagem'; defName: ASideOfABattle }
  | { kind: "the defender's feigned retreat springs shut"; defName: ASideOfABattle }
  | { kind: 'the attacker storms ashore in a raid on the coast'; atkName: ASideOfABattle }
  | {
      kind: "the consecrated ground of the province weakens the attacker's host";
      provName: string;
      atkName: ASideOfABattle;
      attackersAlignment: string;
    }
  | { kind: "the battle's statistics begin" }
  | {
      kind: 'the fortune of the battle';
      atkLabel: ASideOfABattle;
      defLabel: ASideOfABattle | TheDefendersOfAProvince;
      atkBase: number;
      defBase: number;
      fortune: TheFortuneAsTheLineTellsIt;
    }
  | {
      kind: "the battle's outcome and its margin";
      winnerName: string;
      severity: TheSeverityOfABattle;
      margRatio: number;
    }
  | {
      kind: "a side's war-horn of the plains lets its free lances ride in rough country";
      sideName: ASideOfABattle;
      terrain: AValueInALinesWords;
    }
  | { kind: "a side's free lances find no room to ride"; sideName: ASideOfABattle; terrain: string }
  | {
      kind: "the loser's dwarven guard leave the manticore pride nothing to hunt";
      loserName: ASideOfABattle;
      winnerName: ASideOfABattle;
    }
  | {
      kind: "the winner's manticore pride hunt the broken companies";
      winnerName: ASideOfABattle;
      runThemDownPct: number;
      loserName: ASideOfABattle;
    }
  | {
      kind: "the loser's dwarven guard leave the shark shoals nothing in the water";
      loserName: ASideOfABattle;
      winnerName: ASideOfABattle;
    }
  | {
      kind: "the winner's shark shoals tear into the beaten crews";
      winnerName: ASideOfABattle;
      loserName: ASideOfABattle;
      runThemDownPct: AValueInALinesWords;
      loserName2: ASideOfABattle;
    }
  | { kind: "a side's other forces survive the engagement"; someUnitsFateIsToldAbove: boolean }
  | { kind: 'no units were left on the field to count' }
  | { kind: "the attacker's casualties begin"; atkName: ASideOfABattle }
  | { kind: "the defender's casualties begin"; defName: ASideOfABattle | TheDefendersOfAProvince }
  | {
      kind: "the loser's dwarven guard leave the free lances no broken backs";
      loserName: ASideOfABattle;
      winnerName: ASideOfABattle;
    }
  | {
      kind: "the winner's free lances ride down the broken companies";
      winnerName: ASideOfABattle;
      rideDownPct: number;
      loserName: ASideOfABattle;
    }
  | {
      kind: "the loser's dwarven guard leave the warg riders no broken backs";
      loserName: ASideOfABattle;
      winnerName: ASideOfABattle;
    }
  | {
      kind: "the winner's warg riders run down the broken companies";
      winnerName: ASideOfABattle;
      runThemDownPct: number;
      loserName: ASideOfABattle;
    }
  | {
      kind: "the winner's corsairs close the sea lanes to the loser";
      winnerName: ASideOfABattle;
      loserName: ASideOfABattle;
    }
  | {
      kind: "the loser's skeletal host stands its ground in a deathless march";
      loserName: ASideOfABattle;
      provName: string;
    }
  | {
      kind: "the loser's dwarven guard hold a shield fort with no road out";
      loserName: ASideOfABattle;
      provName: string;
    }
  | { kind: 'the defender has nowhere to retreat'; defName: ASideOfABattle }
  | { kind: "the loser's force is destroyed to the last"; loserName: ASideOfABattle }
  | { kind: "the loser's dwarven guard withdraw behind a shield fort"; loserName: ASideOfABattle }
  | { kind: 'the loser retreats to a province'; loserName: ASideOfABattle; retreatToName: string }
  | { kind: "the loser's surviving forces"; loserName: ASideOfABattle; survivingForces: AUnitAsDescribeArmyNamesIt[] }
  | { kind: "the loser's forces are completely destroyed and he retreats alone"; loserName: ASideOfABattle }
  | { kind: 'the attacker has nowhere to retreat'; atkName: ASideOfABattle; atSea: boolean }
  | { kind: "a commander's force is demoralised"; commanderName: string; why: WhyACommandersForceIsDemoralised }
  | {
      kind: 'a commander rides out and challenges the other to single combat';
      challengerName: string;
      challengedName: string;
    }
  | { kind: 'the challenged commander will not answer the call'; challengedName: string }
  | { kind: 'a personal duel before the battle begins'; challengerName: string; challengedName: string }
  | { kind: "the duel's loser falls at death's door but is not slain"; loserName: string }
  | { kind: "the duel's loser is slain"; loserName: string }
  | { kind: 'the duel ends inconclusively' }
  | {
      kind: 'a hero cries out his battlecry to his foe';
      heroName: AValueInALinesWords;
      foeName: AValueInALinesWords;
      battlecry: AValueInALinesWords;
    }
  | {
      kind: "a side's Druid cannot fully command its units";
      sideName: ASideAsABattlesReportLinesNameIt;
      unitCount: number;
      shortfalls: AUnitsDruidShortfall[];
    }
  | {
      kind: 'the attacker moves into a province held by its defenders and a battle is initiated';
      cName: string;
      aRealmsHero: boolean;
      attackersRealmName: string | undefined;
      provName: string;
      heldByName: TheDefendersOfAProvince;
    }
  | {
      kind: 'the guard is slain before his host, and a sergeant of the garrison takes up the banner';
      guardName: AValueInALinesWords;
    }
  | { kind: 'the attacker is cut down before the lines join, and the eldest captain takes command'; cName: string }
  | { kind: "the attacker's Tactical command does not apply at sea"; cName: ASideOfABattle }
  | { kind: 'the defenders of a province defend ground held justly'; provName: string }
  | { kind: 'the defenders fight on home soil' }
  | {
      kind: 'the attacker casts a spell before the battle against the defenders';
      cName: ASideOfABattle;
      spellName: string;
      schoolLabel: string;
      spellLevel: number;
      castChance: number;
      castRoll: number;
    }
  | {
      kind: "a fireball engulfs the defenders' strongest units";
      fireballHitUnitNames: string[];
    }
  | { kind: 'a telekinetic storm finds no command among leaderless defenders' }
  | { kind: 'a psychic blast finds no commander among the defenders' }
  | { kind: 'a lightning bolt sears the defending units'; unitCount: number }
  | { kind: 'a curse finds no commander among leaderless defenders' }
  | {
      kind: "control undead turns a defending undead unit to the attacker's side";
      turnedUnitName: string;
      cName: ASideOfABattle;
    }
  | { kind: 'control undead finds no undead among the defenders' }
  | { kind: 'a holy symbol sears the defending undead'; undeadUnitCount: number }
  | { kind: 'a holy symbol finds no undead among the defenders' }
  | { kind: "spiritwrack halves the defenders' missile units"; missileUnitCount: number }
  | { kind: 'spiritwrack finds no missile troops among the defenders' }
  | { kind: "the attacker's spell before the battle fizzles" }
  | { kind: "a unit's power hits every defending unit"; powerName: string; unitCount: number; damage: number }
  | {
      kind: "a unit's power hits one unit of the other side";
      powerName: string;
      struckUnitName: string;
      damage: number;
    }
  | {
      kind: 'a whale cohort sinks a defending ship before a shot is fired';
      targetUnitName: string;
      /** The sunk hull's type (the losses tally counts it, the defender's). */
      targetUnitType: string;
    }
  | {
      kind: "the attacker's archery volley begins";
      missileUnitCount: number;
      doubleVolleys: boolean;
      oneMoreShot: boolean;
    }
  | {
      kind: 'a unit fires at its target and the shot glances off';
      shooterName: AValueInALinesWords;
      targetUnitName: AValueInALinesWords;
      whyTheShotGlances: WhyAShotGlancesOffAUnit | undefined;
    }
  | ({
      kind: 'a unit fires at its target and weakens it';
      shooterName: string;
      targetUnitName: string;
      damage: number;
    } & TheClausesOfAShotThatWeakensItsTarget)
  | {
      kind: "an attacking unit's target is already softened as far as arrows allow";
      shooterName: AValueInALinesWords;
      targetUnitName: AValueInALinesWords;
    }
  | { kind: "the attacker's archery volley's total"; totalDamage: number; arrowSofteningCapPct: number }
  | {
      kind: 'the defender casts a spell before the battle';
      casterName: string;
      spellName: string;
      schoolLabel: string;
      spellLevel: number;
      castChance: number;
      castRoll: number;
    }
  | { kind: "a fireball halves the attackers' strongest unit"; targetUnitName: string; strengthLost: number }
  | { kind: 'a lightning bolt sears the attacking units'; unitCount: number }
  | { kind: 'control undead finds no undead among the attackers' }
  | { kind: 'a holy symbol sears the attacking undead'; undeadUnitCount: number }
  | { kind: 'a holy symbol finds no undead among the attackers' }
  | { kind: "spiritwrack halves the attackers' missile units"; missileUnitCount: number }
  | { kind: 'spiritwrack finds no missile troops among the attackers' }
  | { kind: "the defender's spell before the battle fizzles" }
  | { kind: "the attacker's lightning advance catches the defenders unready"; cName: AValueInALinesWords }
  | { kind: "the defenders' archers find no target among the attacker's forest wardens"; cName: ASideOfABattle }
  | {
      kind: "the defenders' archery volley begins";
      missileUnitCount: number;
      preparedGround: boolean;
    }
  | {
      kind: "a defending unit's target is already softened as far as arrows allow";
      unitName: AValueInALinesWords;
      targetUnitName: AValueInALinesWords;
    }
  | { kind: "the defenders' archery volley's total"; totalDamage: number; arrowSofteningCapPct: number }
  | { kind: 'a defending unit uses its power in battle'; unitName: string; powerName: string; powerFlavour: string }
  | { kind: "a unit's power hits every attacking unit"; powerName: string; unitCount: number; damage: number }
  | {
      kind: "the terrain's effect on the attacker's units";
      terrain: string;
      cName: ASideOfABattle;
      unitsTheTerrainMarks: AUnitTheTerrainMarks[];
    }
  | {
      kind: 'hosts airborne over open water fight at a penalty against the defenders';
      seaAirborneLandPenalty: number;
      seaAirborneFlyerPenalty: number;
    }
  | { kind: 'land units fight at sea at a penalty against the defenders'; seaLandPenalty: number }
  | { kind: 'the attacker unfolds a grand stratagem against the defenders'; cName: ASideOfABattle }
  | { kind: 'the attacker storms ashore in a raid on the coast against the defenders'; cName: ASideOfABattle }
  | { kind: "the attacker's monsters are driven to savage fury"; cName: ASideOfABattle }
  | { kind: "the attacker's troops fight with fanatical zeal"; cName: ASideOfABattle }
  | { kind: "the attacker's realm discoveries strengthen his army"; discoveriesArmyBonus: number }
  | { kind: "the attacker's free lances find no room to ride"; cName: ASideOfABattle; terrain: string }
  | { kind: "the attacker's warg riders halve his losses"; cName: ASideOfABattle }
  | { kind: 'every defending unit was lost before the lines closed' }
  | { kind: "the defenders' dwarven guard leave the attacker's free lances no broken backs"; cName: ASideOfABattle }
  | {
      kind: "the attacker's free lances ride down the defenders' broken companies";
      cName: ASideOfABattle;
      extraLossesPct: number;
    }
  | { kind: 'the defenders have nowhere to retreat and hold a shield fort'; provName: string }
  | { kind: 'the defenders have nowhere to retreat and take further losses'; provName: string }
  | { kind: "the guard's host is destroyed and he is a masterless hero"; guardName: string; provName: string }
  | { kind: "the attacker's dwarven guard leave the defenders' free lances no broken backs"; cName: ASideOfABattle }
  | {
      kind: "the defenders' free lances ride down the attacker's broken companies";
      cName: ASideOfABattle;
      extraLossesPct: number;
    }
  | { kind: "the attacker's corsairs take his beaten force back to the ships"; cName: ASideOfABattle }
  | { kind: "the attacker's shield-wall holds and the infantry stand their ground"; cName: ASideOfABattle }
  | { kind: 'the attacker has nowhere to retreat and takes further losses'; cName: ASideOfABattle }
  | { kind: "the attacker's forces retreat to a province"; cName: ASideOfABattle; retreatToName: string }
  | {
      kind: "the onlookers' summary of a battle";
      provName: string;
      won: boolean;
      attackersName: ASideOfABattle;
      defendersName: ASideOfABattle | TheDefendersOfAProvince;
      betweenTwoHeroesHosts: boolean;
    }
  | {
      kind: 'the most seasoned captain takes command of the combined host';
      leaderName: string;
      provName: string;
      previousCommanderName: string;
    }
  | {
      kind: 'the blood harvest claims offerings from the fallen enemy units';
      fallenUnitCount: number;
      offeringsGold: number;
    }
  | { kind: "the iron throne of skulls raises the enemy's fallen as skeletons"; raisedCount: AValueInALinesWords }
  | {
      kind: 'terror radiates from a province after an evil victory';
      provName: string;
      surroundingLands: string[];
      terrorPctPerStack: number;
    }
  | {
      kind: 'terror lingers in a province and its defenders fight demoralised';
      provName: string;
      terrorPct: number;
      terrorStacks: number;
    }
  | {
      kind: "a hero not at war with the province's realm gains a host inside it";
      cName: string;
      realmTag: string | null;
      unitCount: number;
      provName: string;
      theRealmsAreAllied: boolean;
      provName2: string;
    }
  | { kind: "a hero's new host is still forming up in a province"; cName: string; provName: string }
  | {
      kind: 'the hero turns a newly gathered host on a province and a battle is initiated';
      cName: string;
      realmTag: string | null;
      provName: string;
      heldByName: string;
    }
  | {
      kind: 'the defenders riding in were keeping watch and are already in the line';
      ridersNames: string[];
      provName: string;
      cName: string;
      onAWarFront: boolean | undefined;
      provName2: string;
    }
  | {
      kind: 'the defender is reinforced by other heroes in the defence of a province';
      defenderName: string;
      reinforcementsNames: string[];
      provName: string;
    }
  | {
      kind: "the province's standing troops rally to the defender";
      provName: string;
      leaderName: string;
      garrisonUnitCount: number;
      garrison: AUnitAsDescribeArmyNamesIt[];
    }
  | {
      kind: 'a hero fell in the battle line beside the commander of the defence';
      heroName: AValueInALinesWords;
      leaderName: AValueInALinesWords;
      provName: AValueInALinesWords;
      leaderName2: AValueInALinesWords;
    }
  | {
      kind: 'a hero stands in the battle line beside the commander of the defence';
      heroName: string;
      leaderName: string;
      provName: string;
      leaderName2: string;
    }
  | {
      kind: "the province's standing troops fall back with the defender";
      provName: AValueInALinesWords;
      fellBackToName: AValueInALinesWords;
      defenderName: AValueInALinesWords;
    }
  | {
      kind: "the province's standing troops fall in with the defender as the battle continues";
      provName: string;
      defenderName: string;
    }
  | {
      kind: "the province's garrison is overwhelmed as the province falls";
      provName: string;
      overrunUnits: AUnitAsDescribeArmyNamesIt[];
    }
  | {
      kind: "the province's owner learns his defenders still hold against the hero";
      cName: string;
      realmTag: string | null;
      provName: string;
      provName2: string;
      heroFell: boolean;
      unitCount: number;
    }
  | {
      kind: "the province's owner learns the hero was beaten back";
      cName: string;
      realmTag: string | null;
      provName: string;
      provName2: string;
    }
  | {
      kind: "a side's strength ladder begins";
      side: 'attacker' | 'defender';
      sideName: ASideAsABattlesReportLinesNameIt;
      unitCount: number;
      strength: number;
    }
  | {
      kind: "the strength ladder's units";
      baseStrength: number;
      unitsStrength: number;
      theUnitsModifiers: AModifierOfAUnitInTheLadder[];
    }
  | {
      kind: "the strength ladder's command";
      unitsStrength: number;
      commandStrength: number;
      theCommandMultipliers: ACommandMultiplierOfAUnit[];
      theSidesTactical: ASidesTacticalInTheLadder | null;
      unitCount: number;
    }
  | {
      kind: "the strength ladder's force-wide modifiers";
      commandStrength: number;
      theForceWideModifiers: AForceWideModifierOfASide[];
      wholeForceStrength: number;
    }
  | { kind: 'the strength ladder has no force-wide modifiers'; wholeForceStrength: number }
  | {
      kind: "the strength ladder's pre-battle damage";
      wholeForceStrength: number;
      preBattleDamage: number;
      afterPreBattleDamage: number;
      unitsHit: number;
    }
  | {
      kind: "the strength ladder's battle lines";
      frontWidth: number;
      afterPreBattleDamage: number;
      battleLinesStrength: number;
      whoFacesWhomFollows: boolean;
      theUnitsPlaces: AUnitsPlaceAsTheLadderTellsIt[];
    }
  | {
      kind: "the strength ladder's who faces whom";
      battleLinesStrength: number;
      facingStrength: number;
      theFacings: AFacingAsTheLadderTellsIt[];
    }
  | {
      kind: "the strength ladder's units behind the front";
      afterPreBattleDamage: number;
      battleLinesStrength: number;
      unitsBehindTheFront: number;
      frontWidth: number;
      theLinesMultipliersBehindTheFront: number[];
    }
  | { kind: 'the ground allows a front of a width'; terrain: string; frontWidth: number }
  | {
      kind: "a side's front line in the battle grid";
      sideName: ASideAsABattlesReportLinesNameIt | null | undefined;
      theFrontLine: (AUnitAsTheGridNamesIt | null)[];
      theFlanks: AUnitAsTheGridNamesIt[];
      theAir: AUnitAsTheGridNamesIt[];
      theReserve: AUnitAsTheGridNamesIt[];
    }
  | {
      kind: "a side's second line in the battle grid";
      sideName: ASideAsABattlesReportLinesNameIt | null | undefined;
      theSecondLine: (AUnitAsTheGridNamesIt | null)[];
    }
  | {
      kind: 'the scouting side chooses the front';
      scoutName: ASideAsABattlesReportLinesNameIt;
      itsSideHasExploredMore: boolean;
      otherSideName: ASideAsABattlesReportLinesNameIt;
      scoutName2: ASideAsABattlesReportLinesNameIt;
      frontWidth: number;
      frontTheDiceAllow: number;
      adjustments: number;
    }
  | {
      kind: 'each side shifts its battle line';
      otherSideName: ASideAsABattlesReportLinesNameIt;
      otherSidesMoves: number;
      scoutName: ASideAsABattlesReportLinesNameIt;
      scoutsMoves: number;
    }
  | {
      kind: "an unfinished battle against a province's defenders resumes";
      provName: string;
      attackersHostName: ASideOfABattle;
      defendersName: TheDefendersOfAProvince;
    }
  | {
      kind: 'the attacker is pinned in a province with no way out';
      attackersHostName: ASideOfABattle;
      provName: string;
    }
  | {
      kind: 'a contest for a province lapses as the realms are no longer at war';
      provName: string;
      attackersRealmName: string | undefined;
      defendersRealmName: string | undefined;
    }
  | {
      kind: "war comes to a province two realms' hosts share";
      provName: AValueInALinesWords;
      attackersHostName: ASideOfABattle;
      attackersRealmTag: string | null;
      defendersHostName: ASideOfABattle;
      defendersRealmTag: string | null;
      seasonName: AValueInALinesWords;
    }
  | {
      kind: 'an unfinished battle between two hosts resumes';
      provName: string;
      attackersHostName: ASideOfABattle;
      defendersHostName: ASideOfABattle;
    }
  | {
      kind: 'the eagle riders mark the forest wardens and spoil the ambush';
      shooterName: ASideAsABattlesReportLinesNameIt;
    }
  | { kind: 'the gyrocopters harry a flying unit off its line'; targetUnitName: string; strengthLost: number }
  | {
      kind: "a side's gyrocopters climb to meet the enemy's flyers";
      sideName: ASideAsABattlesReportLinesNameIt;
      engagedCount: number;
    }
  | {
      kind: "a side's units fight beside their own kin";
      sideName: ASideAsABattlesReportLinesNameIt;
      unitsOfTheKingsRaceUnderACommanderOfThatBlood: number;
      unitsOfTheKingsRace: number;
      unitsOfTheirCommandersRace: number;
    }
  | {
      kind: "a hero's host turns on a province it has shared with a realm at war";
      attackersRealmName: string | undefined;
      ownersRealmName: string | null;
      cName: string;
      realmTag: string | null;
      unitCount: number;
      provName: string;
      seasonName: string;
    };

/** The facts a battle's lines record. */
export type TheFactOfABattlesLine =
  AForceDrawnUpForBattle | ABattlesLossesTalliedFromItsLines | TheFactOfOneOfABattlesSentences;

/** The place of a battle's losses tally, as emitBattle files it. */
export const THE_PLACE_OF_A_BATTLES_LOSSES_TALLY: ABattlesLossesTalliedFromItsLines = {
  kind: "a battle's losses, tallied from its lines",
};

/** Each kind's audience: the fight's, or its event's for a kind filed on its own (its type says so, so a kind given
 *  its hero's realm alone is a compile error). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_BATTLES_LINE: Readonly<
  Record<TheFactOfABattlesLine['kind'], Extract<TheAudienceOfAKindOfLine, "the fight's" | "its event's">>
> = {
  'a force drawn up for battle': "the fight's",
  'a battle is decided': "the fight's",
  'a contest for a province is decided': "its event's",
  "a unit's fate in the battle": "the fight's",
  "a beaten guard's surviving unit's fate": "its event's",
  "a battle's losses, tallied from its lines": "the fight's",
  "the attacker's lightning advance catches the defender unready": "the fight's",
  'the attacker moves into the province and a battle is initiated': "the fight's",
  'the battle for a province begins': "the fight's",
  'the province still cowers under a reign of fear': "the fight's",
  'the attacker is cut down before the lines join, and a captain takes command': "the fight's",
  'the defender is slain before his army, and a veteran takes command': "the fight's",
  "the attacker fights to win back his realm's capital": "the fight's",
  "the attacker's siegecraft wears down the defenders' fortifications": "the fight's",
  "the defender's host defends ground held justly": "the fight's",
  "the defender's realm holds its own ground the harder": "the fight's",
  "the defender's banner of the realm rallies the home defence": "the fight's",
  "the attacker's siege mastery halves the defenders' fortifications": "the fight's",
  'the defenders fight on home ground': "the fight's",
  "a side's skeletal legions fight with fanaticism under their undead king": "the fight's",
  "a side's monsters are driven to savage fury": "the fight's",
  "a side's skeletal legions know no fear": "the fight's",
  "the attacker's forces fight with fanatical zeal": "the fight's",
  'the defenders fight with fanatical zeal on consecrated ground': "the fight's",
  "the defender's forces fight with fanatical zeal": "the fight's",
  'the caster casts a spell before the battle': "the fight's",
  'the spell before the battle fizzles': "the fight's",
  "a fireball halves the enemy's strongest units": "the fight's",
  "a telekinetic storm scatters the enemy commander's formations": "the fight's",
  'a telekinetic storm finds no tactical command to disrupt': "the fight's",
  "a psychic blast severs the enemy commander's bond with his beasts": "the fight's",
  'a lightning bolt weakens enemy units': "the fight's",
  "a curse withers the enemy commander's skill": "the fight's",
  "control undead turns an enemy undead unit to the caster's side": "the fight's",
  'control undead finds no enemy undead to turn': "the fight's",
  'a holy symbol weakens enemy undead units': "the fight's",
  'a holy symbol finds no enemy undead to smite': "the fight's",
  'spiritwrack halves enemy missile units': "the fight's",
  'spiritwrack finds no enemy missile troops': "the fight's",
  "a unit's power gathers but never strikes": "the fight's",
  'a unit uses its power in battle': "the fight's",
  "a unit's power hits all enemy units": "the fight's",
  "a unit's power hits one enemy unit": "the fight's",
  "the hero's archers find no target among the forest wardens": "the fight's",
  "the hero's archery volley begins": "the fight's",
  "a unit's shot glances off its target": "the fight's",
  "a unit's shot weakens its target": "the fight's",
  "a unit's target is already softened as far as arrows allow": "the fight's",
  "a side's whale cohort sinks an enemy ship": "the fight's",
  "the terrain's effect on each side": "the fight's",
  'hosts airborne over open water fight at a penalty': "the fight's",
  'land units fight at sea at a penalty': "the fight's",
  "a side's realm discoveries strengthen its army": "the fight's",
  "the illusory ground of the province confuses a side's forces": "the fight's",
  "the sanctuary wards of the province sap a side's attackers": "the fight's",
  'the attacker unfolds a grand stratagem': "the fight's",
  'the defender unfolds a grand stratagem': "the fight's",
  "the defender's feigned retreat springs shut": "the fight's",
  'the attacker storms ashore in a raid on the coast': "the fight's",
  "the consecrated ground of the province weakens the attacker's host": "the fight's",
  "the battle's statistics begin": "the fight's",
  'the fortune of the battle': "the fight's",
  "the battle's outcome and its margin": "the fight's",
  "a side's war-horn of the plains lets its free lances ride in rough country": "the fight's",
  "a side's free lances find no room to ride": "the fight's",
  "the loser's dwarven guard leave the manticore pride nothing to hunt": "the fight's",
  "the winner's manticore pride hunt the broken companies": "the fight's",
  "the loser's dwarven guard leave the shark shoals nothing in the water": "the fight's",
  "the winner's shark shoals tear into the beaten crews": "the fight's",
  "a side's other forces survive the engagement": "the fight's",
  'no units were left on the field to count': "the fight's",
  "the attacker's casualties begin": "the fight's",
  "the defender's casualties begin": "the fight's",
  "the loser's dwarven guard leave the free lances no broken backs": "the fight's",
  "the winner's free lances ride down the broken companies": "the fight's",
  "the loser's dwarven guard leave the warg riders no broken backs": "the fight's",
  "the winner's warg riders run down the broken companies": "the fight's",
  "the winner's corsairs close the sea lanes to the loser": "the fight's",
  "the loser's skeletal host stands its ground in a deathless march": "the fight's",
  "the loser's dwarven guard hold a shield fort with no road out": "the fight's",
  'the defender has nowhere to retreat': "the fight's",
  "the loser's force is destroyed to the last": "the fight's",
  "the loser's dwarven guard withdraw behind a shield fort": "the fight's",
  'the loser retreats to a province': "the fight's",
  "the loser's surviving forces": "the fight's",
  "the loser's forces are completely destroyed and he retreats alone": "the fight's",
  'the attacker has nowhere to retreat': "the fight's",
  "a commander's force is demoralised": "the fight's",
  'a commander rides out and challenges the other to single combat': "the fight's",
  'the challenged commander will not answer the call': "the fight's",
  'a personal duel before the battle begins': "the fight's",
  "the duel's loser falls at death's door but is not slain": "the fight's",
  "the duel's loser is slain": "the fight's",
  'the duel ends inconclusively': "the fight's",
  'a hero cries out his battlecry to his foe': "the fight's",
  "a side's Druid cannot fully command its units": "the fight's",
  'the attacker moves into a province held by its defenders and a battle is initiated': "the fight's",
  'the guard is slain before his host, and a sergeant of the garrison takes up the banner': "the fight's",
  'the attacker is cut down before the lines join, and the eldest captain takes command': "the fight's",
  "the attacker's Tactical command does not apply at sea": "the fight's",
  'the defenders of a province defend ground held justly': "the fight's",
  'the defenders fight on home soil': "the fight's",
  'the attacker casts a spell before the battle against the defenders': "the fight's",
  "a fireball engulfs the defenders' strongest units": "the fight's",
  'a telekinetic storm finds no command among leaderless defenders': "the fight's",
  'a psychic blast finds no commander among the defenders': "the fight's",
  'a lightning bolt sears the defending units': "the fight's",
  'a curse finds no commander among leaderless defenders': "the fight's",
  "control undead turns a defending undead unit to the attacker's side": "the fight's",
  'control undead finds no undead among the defenders': "the fight's",
  'a holy symbol sears the defending undead': "the fight's",
  'a holy symbol finds no undead among the defenders': "the fight's",
  "spiritwrack halves the defenders' missile units": "the fight's",
  'spiritwrack finds no missile troops among the defenders': "the fight's",
  "the attacker's spell before the battle fizzles": "the fight's",
  "a unit's power hits every defending unit": "the fight's",
  "a unit's power hits one unit of the other side": "the fight's",
  'a whale cohort sinks a defending ship before a shot is fired': "the fight's",
  "the attacker's archery volley begins": "the fight's",
  'a unit fires at its target and the shot glances off': "the fight's",
  'a unit fires at its target and weakens it': "the fight's",
  "an attacking unit's target is already softened as far as arrows allow": "the fight's",
  "the attacker's archery volley's total": "the fight's",
  'the defender casts a spell before the battle': "the fight's",
  "a fireball halves the attackers' strongest unit": "the fight's",
  'a lightning bolt sears the attacking units': "the fight's",
  'control undead finds no undead among the attackers': "the fight's",
  'a holy symbol sears the attacking undead': "the fight's",
  'a holy symbol finds no undead among the attackers': "the fight's",
  "spiritwrack halves the attackers' missile units": "the fight's",
  'spiritwrack finds no missile troops among the attackers': "the fight's",
  "the defender's spell before the battle fizzles": "the fight's",
  "the attacker's lightning advance catches the defenders unready": "the fight's",
  "the defenders' archers find no target among the attacker's forest wardens": "the fight's",
  "the defenders' archery volley begins": "the fight's",
  "a defending unit's target is already softened as far as arrows allow": "the fight's",
  "the defenders' archery volley's total": "the fight's",
  'a defending unit uses its power in battle': "the fight's",
  "a unit's power hits every attacking unit": "the fight's",
  "the terrain's effect on the attacker's units": "the fight's",
  'hosts airborne over open water fight at a penalty against the defenders': "the fight's",
  'land units fight at sea at a penalty against the defenders': "the fight's",
  'the attacker unfolds a grand stratagem against the defenders': "the fight's",
  'the attacker storms ashore in a raid on the coast against the defenders': "the fight's",
  "the attacker's monsters are driven to savage fury": "the fight's",
  "the attacker's troops fight with fanatical zeal": "the fight's",
  "the attacker's realm discoveries strengthen his army": "the fight's",
  "the attacker's free lances find no room to ride": "the fight's",
  "the attacker's warg riders halve his losses": "the fight's",
  'every defending unit was lost before the lines closed': "the fight's",
  "the defenders' dwarven guard leave the attacker's free lances no broken backs": "the fight's",
  "the attacker's free lances ride down the defenders' broken companies": "the fight's",
  'the defenders have nowhere to retreat and hold a shield fort': "the fight's",
  'the defenders have nowhere to retreat and take further losses': "the fight's",
  "the guard's host is destroyed and he is a masterless hero": "the fight's",
  "the attacker's dwarven guard leave the defenders' free lances no broken backs": "the fight's",
  "the defenders' free lances ride down the attacker's broken companies": "the fight's",
  "the attacker's corsairs take his beaten force back to the ships": "the fight's",
  "the attacker's shield-wall holds and the infantry stand their ground": "the fight's",
  'the attacker has nowhere to retreat and takes further losses': "the fight's",
  "the attacker's forces retreat to a province": "the fight's",
  "the onlookers' summary of a battle": "the fight's",
  'the most seasoned captain takes command of the combined host': "its event's",
  'the blood harvest claims offerings from the fallen enemy units': "the fight's",
  "the iron throne of skulls raises the enemy's fallen as skeletons": "the fight's",
  'terror radiates from a province after an evil victory': "the fight's",
  'terror lingers in a province and its defenders fight demoralised': "the fight's",
  "a hero not at war with the province's realm gains a host inside it": "its event's",
  "a hero's new host is still forming up in a province": "its event's",
  'the hero turns a newly gathered host on a province and a battle is initiated': "the fight's",
  'the defenders riding in were keeping watch and are already in the line': "the fight's",
  'the defender is reinforced by other heroes in the defence of a province': "the fight's",
  "the province's standing troops rally to the defender": "the fight's",
  'a hero fell in the battle line beside the commander of the defence': "its event's",
  'a hero stands in the battle line beside the commander of the defence': "its event's",
  "the province's standing troops fall back with the defender": "its event's",
  "the province's standing troops fall in with the defender as the battle continues": "its event's",
  "the province's garrison is overwhelmed as the province falls": "its event's",
  "the province's owner learns his defenders still hold against the hero": "its event's",
  "the province's owner learns the hero was beaten back": "its event's",
  "a side's strength ladder begins": "the fight's",
  "the strength ladder's units": "the fight's",
  "the strength ladder's command": "the fight's",
  "the strength ladder's force-wide modifiers": "the fight's",
  'the strength ladder has no force-wide modifiers': "the fight's",
  "the strength ladder's pre-battle damage": "the fight's",
  "the strength ladder's battle lines": "the fight's",
  "the strength ladder's who faces whom": "the fight's",
  "the strength ladder's units behind the front": "the fight's",
  'the ground allows a front of a width': "the fight's",
  "a side's front line in the battle grid": "the fight's",
  "a side's second line in the battle grid": "the fight's",
  'the scouting side chooses the front': "the fight's",
  'each side shifts its battle line': "the fight's",
  "an unfinished battle against a province's defenders resumes": "its event's",
  'the attacker is pinned in a province with no way out': "its event's",
  'a contest for a province lapses as the realms are no longer at war': "its event's",
  "war comes to a province two realms' hosts share": "its event's",
  'an unfinished battle between two hosts resumes': "its event's",
  'the eagle riders mark the forest wardens and spoil the ambush': "the fight's",
  'the gyrocopters harry a flying unit off its line': "the fight's",
  "a side's gyrocopters climb to meet the enemy's flyers": "the fight's",
  "a side's units fight beside their own kin": "the fight's",
  "a hero's host turns on a province it has shared with a realm at war": "its event's",
};

/** Each kind's tier in a battle's lines (plan P1-12d34; TheTierOfAKindOfABattlesLine, src/engine/turn/events-and-their-
 *  audiences.ts): what each kind's words gave when the views read the tiers from them, for the names a game writes.
 *  Every kind but the place of the losses tally, which takes its own ('t'). */
export const THE_TIER_OF_EACH_KIND_OF_A_BATTLES_LINE: Readonly<
  Record<
    Exclude<TheFactOfABattlesLine['kind'], ABattlesLossesTalliedFromItsLines['kind']>,
    TheTierOfAKindOfABattlesLine
  >
> = {
  'a force drawn up for battle': 'k',
  'a battle is decided': 'k',
  'a contest for a province is decided': 'k',
  "a unit's fate in the battle": "'d' once the casualty lists have begun, 'k' before",
  "a beaten guard's surviving unit's fate": "'d' once the casualty lists have begun, 'k' before",
  "the attacker's lightning advance catches the defender unready": 'k',
  'the attacker moves into the province and a battle is initiated': 'k',
  'the battle for a province begins': 'k',
  'the province still cowers under a reign of fear': 'k',
  'the attacker is cut down before the lines join, and a captain takes command': 'k',
  'the defender is slain before his army, and a veteran takes command': 'k',
  "the attacker fights to win back his realm's capital": 'k',
  "the attacker's siegecraft wears down the defenders' fortifications": 'd',
  "the defender's host defends ground held justly": 'k',
  "the defender's realm holds its own ground the harder": 'd',
  "the defender's banner of the realm rallies the home defence": 'd',
  "the attacker's siege mastery halves the defenders' fortifications": 'd',
  'the defenders fight on home ground': 'k',
  "a side's skeletal legions fight with fanaticism under their undead king": 'k',
  "a side's monsters are driven to savage fury": 'k',
  "a side's skeletal legions know no fear": 'k',
  "the attacker's forces fight with fanatical zeal": 'k',
  'the defenders fight with fanatical zeal on consecrated ground': 'k',
  "the defender's forces fight with fanatical zeal": 'k',
  'the caster casts a spell before the battle': 'k',
  'the spell before the battle fizzles': 'd',
  "a fireball halves the enemy's strongest units": 'd',
  "a telekinetic storm scatters the enemy commander's formations": 'd',
  'a telekinetic storm finds no tactical command to disrupt': 'd',
  "a psychic blast severs the enemy commander's bond with his beasts": 'd',
  'a lightning bolt weakens enemy units': 'd',
  "a curse withers the enemy commander's skill": 'd',
  "control undead turns an enemy undead unit to the caster's side": 'd',
  'control undead finds no enemy undead to turn': 'd',
  'a holy symbol weakens enemy undead units': 'd',
  'a holy symbol finds no enemy undead to smite': 'd',
  'spiritwrack halves enemy missile units': 'd',
  'spiritwrack finds no enemy missile troops': 'd',
  "a unit's power gathers but never strikes": 'd',
  'a unit uses its power in battle': 'd',
  "a unit's power hits all enemy units": 'd',
  "a unit's power hits one enemy unit": 'd',
  "the hero's archers find no target among the forest wardens": 'k',
  "the hero's archery volley begins": 'd',
  "a unit's shot glances off its target": 'd',
  "a unit's shot weakens its target": 'd',
  "a unit's target is already softened as far as arrows allow": 'd',
  "a side's whale cohort sinks an enemy ship": 'k',
  "the terrain's effect on each side": 'd',
  'hosts airborne over open water fight at a penalty': 'd',
  'land units fight at sea at a penalty': 'd',
  "a side's realm discoveries strengthen its army": 'k',
  "the illusory ground of the province confuses a side's forces": 'd',
  "the sanctuary wards of the province sap a side's attackers": 'd',
  'the attacker unfolds a grand stratagem': 'd',
  'the defender unfolds a grand stratagem': 'd',
  "the defender's feigned retreat springs shut": 'd',
  'the attacker storms ashore in a raid on the coast': 'd',
  "the consecrated ground of the province weakens the attacker's host": 'k',
  "the battle's statistics begin": 'd',
  'the fortune of the battle': "the fortune's: 'k', but 'd' when a side brings no strength",
  "the battle's outcome and its margin": 'd',
  "a side's war-horn of the plains lets its free lances ride in rough country": 'k',
  "a side's free lances find no room to ride": 'd',
  "the loser's dwarven guard leave the manticore pride nothing to hunt": 'k',
  "the winner's manticore pride hunt the broken companies": 'k',
  "the loser's dwarven guard leave the shark shoals nothing in the water": 'k',
  "the winner's shark shoals tear into the beaten crews": 'k',
  "a side's other forces survive the engagement": "'d' once the casualty lists have begun, 'k' before",
  'no units were left on the field to count': "'d' once the casualty lists have begun, 'k' before",
  "the attacker's casualties begin": "a casualty list's header: 'd', and the casualty lists begin",
  "the defender's casualties begin": "a casualty list's header: 'd', and the casualty lists begin",
  "the loser's dwarven guard leave the free lances no broken backs": 'k',
  "the winner's free lances ride down the broken companies": 'k',
  "the loser's dwarven guard leave the warg riders no broken backs": 'k',
  "the winner's warg riders run down the broken companies": 'k',
  "the winner's corsairs close the sea lanes to the loser": 'k',
  "the loser's skeletal host stands its ground in a deathless march": 'k',
  "the loser's dwarven guard hold a shield fort with no road out": 'k',
  'the defender has nowhere to retreat': 'k',
  "the loser's force is destroyed to the last": 'd',
  "the loser's dwarven guard withdraw behind a shield fort": 'k',
  'the loser retreats to a province': 'k',
  "the loser's surviving forces": 'd',
  "the loser's forces are completely destroyed and he retreats alone": 'k',
  'the attacker has nowhere to retreat': 'k',
  "a commander's force is demoralised": 'k',
  'a commander rides out and challenges the other to single combat':
    "'d' once the casualty lists have begun, 'k' before",
  'the challenged commander will not answer the call': 'k',
  'a personal duel before the battle begins': 'k',
  "the duel's loser falls at death's door but is not slain": 'k',
  "the duel's loser is slain": 'k',
  'the duel ends inconclusively': 'k',
  'a hero cries out his battlecry to his foe': 'k',
  "a side's Druid cannot fully command its units": 'd',
  'the attacker moves into a province held by its defenders and a battle is initiated': 'k',
  'the guard is slain before his host, and a sergeant of the garrison takes up the banner': 'k',
  'the attacker is cut down before the lines join, and the eldest captain takes command': 'k',
  "the attacker's Tactical command does not apply at sea": 'd',
  'the defenders of a province defend ground held justly': 'k',
  'the defenders fight on home soil': 'k',
  'the attacker casts a spell before the battle against the defenders': 'k',
  "a fireball engulfs the defenders' strongest units": 'd',
  'a telekinetic storm finds no command among leaderless defenders': 'd',
  'a psychic blast finds no commander among the defenders': 'd',
  'a lightning bolt sears the defending units': 'd',
  'a curse finds no commander among leaderless defenders': 'd',
  "control undead turns a defending undead unit to the attacker's side": 'd',
  'control undead finds no undead among the defenders': 'd',
  'a holy symbol sears the defending undead': 'd',
  'a holy symbol finds no undead among the defenders': 'd',
  "spiritwrack halves the defenders' missile units": 'd',
  'spiritwrack finds no missile troops among the defenders': 'd',
  "the attacker's spell before the battle fizzles": 'd',
  "a unit's power hits every defending unit": 'd',
  "a unit's power hits one unit of the other side": 'd',
  'a whale cohort sinks a defending ship before a shot is fired': 'k',
  "the attacker's archery volley begins": 'd',
  'a unit fires at its target and the shot glances off': 'd',
  'a unit fires at its target and weakens it': 'd',
  "an attacking unit's target is already softened as far as arrows allow": 'd',
  "the attacker's archery volley's total": 'd',
  'the defender casts a spell before the battle': 'k',
  "a fireball halves the attackers' strongest unit": 'd',
  'a lightning bolt sears the attacking units': 'd',
  'control undead finds no undead among the attackers': 'd',
  'a holy symbol sears the attacking undead': 'd',
  'a holy symbol finds no undead among the attackers': 'd',
  "spiritwrack halves the attackers' missile units": 'd',
  'spiritwrack finds no missile troops among the attackers': 'd',
  "the defender's spell before the battle fizzles": 'd',
  "the attacker's lightning advance catches the defenders unready": 'k',
  "the defenders' archers find no target among the attacker's forest wardens": 'k',
  "the defenders' archery volley begins": 'd',
  "a defending unit's target is already softened as far as arrows allow": 'd',
  "the defenders' archery volley's total": 'd',
  'a defending unit uses its power in battle': 'd',
  "a unit's power hits every attacking unit": 'd',
  "the terrain's effect on the attacker's units": 'd',
  'hosts airborne over open water fight at a penalty against the defenders': 'd',
  'land units fight at sea at a penalty against the defenders': 'd',
  'the attacker unfolds a grand stratagem against the defenders': 'd',
  'the attacker storms ashore in a raid on the coast against the defenders': 'd',
  "the attacker's monsters are driven to savage fury": 'k',
  "the attacker's troops fight with fanatical zeal": 'k',
  "the attacker's realm discoveries strengthen his army": 'k',
  "the attacker's free lances find no room to ride": 'd',
  "the attacker's warg riders halve his losses": 'k',
  'every defending unit was lost before the lines closed': 'k',
  "the defenders' dwarven guard leave the attacker's free lances no broken backs": 'k',
  "the attacker's free lances ride down the defenders' broken companies": 'k',
  'the defenders have nowhere to retreat and hold a shield fort': 'k',
  'the defenders have nowhere to retreat and take further losses': 'k',
  "the guard's host is destroyed and he is a masterless hero": 'k',
  "the attacker's dwarven guard leave the defenders' free lances no broken backs": 'k',
  "the defenders' free lances ride down the attacker's broken companies": 'k',
  "the attacker's corsairs take his beaten force back to the ships": 'k',
  "the attacker's shield-wall holds and the infantry stand their ground": 'k',
  'the attacker has nowhere to retreat and takes further losses': 'k',
  "the attacker's forces retreat to a province": 'k',
  "the onlookers' summary of a battle": 'k',
  'the most seasoned captain takes command of the combined host': 'k',
  'the blood harvest claims offerings from the fallen enemy units': 'k',
  "the iron throne of skulls raises the enemy's fallen as skeletons": 'k',
  'terror radiates from a province after an evil victory': 'k',
  'terror lingers in a province and its defenders fight demoralised': 'k',
  "a hero not at war with the province's realm gains a host inside it": 'k',
  "a hero's new host is still forming up in a province": 'k',
  'the hero turns a newly gathered host on a province and a battle is initiated': 'k',
  'the defenders riding in were keeping watch and are already in the line': 'k',
  'the defender is reinforced by other heroes in the defence of a province': 'k',
  "the province's standing troops rally to the defender": 'k',
  'a hero fell in the battle line beside the commander of the defence': 'k',
  'a hero stands in the battle line beside the commander of the defence': 'k',
  "the province's standing troops fall back with the defender": 'k',
  "the province's standing troops fall in with the defender as the battle continues": 'k',
  "the province's garrison is overwhelmed as the province falls": 'k',
  "the province's owner learns his defenders still hold against the hero": 'k',
  "the province's owner learns the hero was beaten back": 'k',
  "a side's strength ladder begins": 'd',
  "the strength ladder's units": 'd',
  "the strength ladder's command": 'd',
  "the strength ladder's force-wide modifiers": 'd',
  'the strength ladder has no force-wide modifiers': 'd',
  "the strength ladder's pre-battle damage": 'd',
  "the strength ladder's battle lines": 'd',
  "the strength ladder's who faces whom": 'd',
  "the strength ladder's units behind the front": 'd',
  'the ground allows a front of a width': 'd',
  "a side's front line in the battle grid": 'd',
  "a side's second line in the battle grid": 'd',
  'the scouting side chooses the front': 'd',
  'each side shifts its battle line': 'd',
  "an unfinished battle against a province's defenders resumes": 'k',
  'the attacker is pinned in a province with no way out': 'k',
  'a contest for a province lapses as the realms are no longer at war': 'k',
  "war comes to a province two realms' hosts share": 'k',
  'an unfinished battle between two hosts resumes': 'k',
  'the eagle riders mark the forest wardens and spoil the ambush': 'k',
  'the gyrocopters harry a flying unit off its line': 'd',
  "a side's gyrocopters climb to meet the enemy's flyers": 'k',
  "a side's units fight beside their own kin": 'd',
  "a hero's host turns on a province it has shared with a realm at war": 'k',
};

// ── A BATTLE, FOR THE STATISTICS (plan P1-12d33: P1-12d's last slice, Decision 1) ──
// Not a line: the record the turn's statistics keep of each battle (db/telemetry.ts writes it into turn_events, and the
// balance matrix hashes those rows). Both battles file it through recordForTheStatistics
// (turn/events-and-their-audiences.ts), never into the GM's log: it has no audience and no words.

/** A battle fought, as the statistics record it: its phase, province and ground; its kind ('pvp' a realm's hero
 *  defending, 'guard' a province's guard, 'garrison' a realm's garrison, 'neutral' a province's own defenders); each
 *  side's realm and commander (none for the defenders with no realm), base strength (rounded) and units; the fortune
 *  (to three places); who won, each side's companies lost, and the rounds the battle carried on. */
export interface ABattleAsTheStatisticsRecordIt {
  ph: number | null;
  prov: number;
  terrain: string;
  kind: 'pvp' | 'guard' | 'garrison' | 'neutral';
  atkPi: number | null;
  atkChar: number;
  defPi: number | null;
  defChar: number | null;
  atkStr: number;
  defStr: number;
  S: number;
  atkUnits: number;
  defUnits: number;
  won: boolean;
  atkLost: number;
  defLost: number;
  carry: number;
}

/** A battle fought, for the statistics: the record, as it was kept before it was a fact. */
export interface TheFactOfABattleForTheStatistics {
  kind: 'a battle fought, for the statistics';
  record: ABattleAsTheStatisticsRecordIt;
}
