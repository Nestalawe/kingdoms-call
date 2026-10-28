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
// label (Decision 2: the facts-by-sense slice names a side), and words a caller hands in (a unit's fate's verb).
// P1-12d4 moved the strength ladder's and the grid's words into the prose too: their lines hold each modifier's reason,
// each unit's place and facing, and whom a unit faced, as the records below (the registry's effects name an ability by
// its slug, and the prose writes its name from the content's row). Words a battle takes from another
// folder's helper (a unit disbanding, a sea trap, a naval hold, the wanderer's escape, a hero's death) stay words until
// P1-12d5.
// LineFact (src/engine/turn/events-and-their-audiences.ts) is the union of every area's kinds; a kind with no words in
// src/views/prose/ is a compile error there.
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
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

/** Whom a unit faced, as its fate's line tells it (battleFacedClauses): an enemy unit by its label (ownedUnitName: a
 *  unit's label stays words in this slice, Decision 2) and how it met it, or where it stood. */
export type WhomAUnitFaced =
  | {
      readonly kind: 'an enemy unit';
      readonly how: 'faces' | 'met' | 'wraps' | 'shoots' | 'duel' | 'guards';
      readonly theEnemyUnit: string;
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

/** A side's force as a battle begins: its header (its name, its owner's colour, how it comes on) and one row per unit
 *  (forceMarker, battle-report-lines-and-force-markers.ts). Its words are the header's machine form, which the player
 *  page and the GM page draw as the force's rows. Its audience: the fight's. */
export interface AForceDrawnUpForBattle {
  kind: 'a force drawn up for battle';
  name: string;
  color: string | null;
  neutral: boolean;
  guard: boolean;
  role: string;
  verb: string;
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

/** One sentence of a battle's lines, each with its kind: one kind per sentence, one field per value it was written
 *  with. Their audience: the fight's, or for those filed on their own (not in a fight's narrative), their event's. */
export type TheFactOfOneOfABattlesSentences =
  | {
      kind: "the attacker's lightning advance catches the defender unready";
      atkName: AValueInALinesWords;
      defName: AValueInALinesWords;
    }
  | {
      kind: 'the attacker moves into the province and a battle is initiated';
      atkName: string;
      attackersRealmName: string;
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
  | { kind: "the attacker fights to win back his realm's capital"; atkName: string; provName: string }
  | {
      kind: "the attacker's siegecraft wears down the defenders' fortifications";
      atkName: string;
      siegecraft: number;
    }
  | { kind: "the defender's host defends ground held justly"; defName: string }
  | { kind: "the defender's realm holds its own ground the harder"; defName: string; ownGroundDefencePct: number }
  | { kind: "the defender's banner of the realm rallies the home defence"; defName: string }
  | { kind: "the attacker's siege mastery halves the defenders' fortifications"; atkName: AValueInALinesWords }
  | { kind: 'the defenders fight on home ground' }
  | {
      kind: "a side's skeletal legions fight with fanaticism under their undead king";
      sideName: string;
      undeadKingFanaticismPct: number;
    }
  | { kind: "a side's monsters are driven to savage fury"; sideName: string }
  | { kind: "a side's skeletal legions know no fear"; sideName: string; undeadHeroFanaticismPct: number }
  | { kind: "the attacker's forces fight with fanatical zeal"; atkName: string }
  | { kind: 'the defenders fight with fanatical zeal on consecrated ground'; provName: string; defName: string }
  | { kind: "the defender's forces fight with fanatical zeal"; defName: string }
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
  | { kind: "a telekinetic storm scatters the enemy commander's formations"; enemyCommanderName: string }
  | { kind: 'a telekinetic storm finds no tactical command to disrupt'; enemyCommanderName: string }
  | { kind: "a psychic blast severs the enemy commander's bond with his beasts"; enemyCommanderName: string }
  | { kind: 'a lightning bolt weakens enemy units'; unitCount: number }
  | {
      kind: "a curse withers the enemy commander's skill";
      enemyCommanderName: string;
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
  | { kind: "the hero's archers find no target among the forest wardens"; heroName: string }
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
    }
  | {
      kind: "the terrain's effect on each side";
      terrain: string;
      atkName: string;
      unitsTheTerrainMarksOfTheAttacker: AUnitTheTerrainMarks[] | null;
      defName: string;
      unitsTheTerrainMarksOfTheDefender: AUnitTheTerrainMarks[] | null;
    }
  | {
      kind: 'hosts airborne over open water fight at a penalty';
      attackersHostIsAirborne: boolean;
      defendersHostIsAirborne: boolean;
      atkName: string;
      defName: string;
      seaAirborneLandPenalty: number;
      seaAirborneFlyerPenalty: number;
    }
  | { kind: 'land units fight at sea at a penalty'; seaLandPenalty: number }
  | {
      kind: "a side's realm discoveries strengthen its army";
      sideName: AValueInALinesWords;
      discoveriesBonus: number;
    }
  | { kind: "the illusory ground of the province confuses a side's forces"; provName: string; sideName: string }
  | {
      kind: "the sanctuary wards of the province sap a side's attackers";
      provName: AValueInALinesWords;
      sideName: AValueInALinesWords;
    }
  | { kind: 'the attacker unfolds a grand stratagem'; atkName: string }
  | { kind: 'the defender unfolds a grand stratagem'; defName: AValueInALinesWords }
  | { kind: "the defender's feigned retreat springs shut"; defName: AValueInALinesWords }
  | { kind: 'the attacker storms ashore in a raid on the coast'; atkName: AValueInALinesWords }
  | {
      kind: "the consecrated ground of the province weakens the attacker's host";
      provName: string;
      atkName: string;
      attackersAlignment: string;
    }
  | { kind: "the battle's statistics begin" }
  | {
      kind: 'the fortune of the battle';
      atkLabel: string;
      defLabel: string;
      atkBase: number;
      defBase: number;
      fortune: TheFortuneAsTheLineTellsIt;
    }
  | { kind: "the battle's outcome and its margin"; winnerName: string; severity: string; margRatio: number }
  | {
      kind: "a side's war-horn of the plains lets its free lances ride in rough country";
      sideName: AValueInALinesWords;
      terrain: AValueInALinesWords;
    }
  | { kind: "a side's free lances find no room to ride"; sideName: string; terrain: string }
  | {
      kind: "the loser's dwarven guard leave the manticore pride nothing to hunt";
      loserName: string;
      winnerName: string;
    }
  | {
      kind: "the winner's manticore pride hunt the broken companies";
      winnerName: string;
      runThemDownPct: number;
      loserName: string;
    }
  | {
      kind: "the loser's dwarven guard leave the shark shoals nothing in the water";
      loserName: AValueInALinesWords;
      winnerName: AValueInALinesWords;
    }
  | {
      kind: "the winner's shark shoals tear into the beaten crews";
      winnerName: AValueInALinesWords;
      loserName: AValueInALinesWords;
      runThemDownPct: AValueInALinesWords;
      loserName2: AValueInALinesWords;
    }
  | { kind: 'a unit is cut down with no escape'; unitName: string }
  | { kind: "a side's other forces survive the engagement"; someUnitsFateIsToldAbove: boolean }
  | { kind: 'no units were left on the field to count' }
  | {
      kind: 'the attacker wins the battle and seizes the province';
      severity: string;
      atkName: string;
      winVerbIndex: number;
      defName: string;
      provName: string;
    }
  | { kind: "the attacker's casualties begin"; atkName: string }
  | { kind: "the defender's casualties begin"; defName: string }
  | { kind: "the loser's dwarven guard leave the free lances no broken backs"; loserName: string; winnerName: string }
  | {
      kind: "the winner's free lances ride down the broken companies";
      winnerName: string;
      rideDownPct: number;
      loserName: string;
    }
  | { kind: "the loser's dwarven guard leave the warg riders no broken backs"; loserName: string; winnerName: string }
  | {
      kind: "the winner's warg riders run down the broken companies";
      winnerName: string;
      runThemDownPct: number;
      loserName: string;
    }
  | {
      kind: "the winner's corsairs close the sea lanes to the loser";
      winnerName: AValueInALinesWords;
      loserName: AValueInALinesWords;
    }
  | { kind: "the loser's skeletal host stands its ground in a deathless march"; loserName: string; provName: string }
  | { kind: "the loser's dwarven guard hold a shield fort with no road out"; loserName: string; provName: string }
  | { kind: 'the defender has nowhere to retreat'; defName: string }
  | {
      kind: "the defender's stronger host is pushed back but stays";
      defName: string;
      stayingHostStrength: number;
      victorsStrength: number;
      provName: string;
    }
  | { kind: "the loser's force is destroyed to the last"; loserName: string }
  | { kind: "the loser's dwarven guard withdraw behind a shield fort"; loserName: string }
  | { kind: 'the loser retreats to a province'; loserName: string; retreatToName: string }
  | { kind: "the loser's surviving forces"; loserName: string; survivingForces: AUnitAsDescribeArmyNamesIt[] }
  | { kind: "the loser's forces are completely destroyed and he retreats alone"; loserName: string }
  | {
      kind: "the attacker wins the battle but the defender's survivors hold the province";
      severity: string;
      atkName: string;
      winVerbIndex: number;
      defName: string;
      defName2: string;
      provName: string;
    }
  | {
      kind: "the attacker's assault is repelled and driven from the province";
      atkName: string;
      severity: string;
      defName: string;
      provName: string;
    }
  | { kind: 'the attacker has nowhere to retreat'; atkName: string; atSea: boolean }
  | {
      kind: "the attacker's stronger host is thrown back but stays";
      atkName: string;
      stayingHostStrength: number;
      victorsStrength: number;
      provName: string;
    }
  | {
      kind: "the attacker's assault is repelled but not driven from the province";
      atkName: string;
      severity: string;
      defName: string;
      provName: string;
    }
  | { kind: "a commander's force is demoralised"; commanderName: string; why: string }
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
      sideName: string;
      unitCount: number;
      shortfalls: AUnitsDruidShortfall[];
    }
  | {
      kind: 'the attacker moves into a province held by its defenders and a battle is initiated';
      cName: string;
      aRealmsHero: boolean;
      attackersRealmName: string | undefined;
      provName: string;
      heldByName: string;
    }
  | {
      kind: 'the guard is slain before his host, and a sergeant of the garrison takes up the banner';
      guardName: AValueInALinesWords;
    }
  | { kind: 'the attacker is cut down before the lines join, and the eldest captain takes command'; cName: string }
  | { kind: "the attacker's Tactical command does not apply at sea"; cName: string }
  | { kind: 'the defenders of a province defend ground held justly'; provName: string }
  | { kind: 'the defenders fight on home soil' }
  | {
      kind: 'the attacker casts a spell before the battle against the defenders';
      cName: string;
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
      cName: string;
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
  | { kind: 'a whale cohort sinks a defending ship before a shot is fired'; targetUnitName: string }
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
  | { kind: "the defenders' archers find no target among the attacker's forest wardens"; cName: string }
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
      cName: string;
      unitsTheTerrainMarks: AUnitTheTerrainMarks[];
    }
  | {
      kind: 'hosts airborne over open water fight at a penalty against the defenders';
      seaAirborneLandPenalty: number;
      seaAirborneFlyerPenalty: number;
    }
  | { kind: 'land units fight at sea at a penalty against the defenders'; seaLandPenalty: number }
  | { kind: 'the attacker unfolds a grand stratagem against the defenders'; cName: AValueInALinesWords }
  | { kind: 'the attacker storms ashore in a raid on the coast against the defenders'; cName: AValueInALinesWords }
  | { kind: "the attacker's monsters are driven to savage fury"; cName: string }
  | { kind: "the attacker's troops fight with fanatical zeal"; cName: string }
  | { kind: "the attacker's realm discoveries strengthen his army"; discoveriesArmyBonus: number }
  | { kind: "the attacker's free lances find no room to ride"; cName: string; terrain: string }
  | {
      kind: 'the attacker sweeps into a province with no one left to stand against him';
      cName: string;
      provName: string;
    }
  | {
      kind: 'the attacker wins the battle against the defenders';
      severity: string;
      margRatio: number;
      cName: string;
      winVerbIndex: number;
      guardName: string;
    }
  | { kind: "the attacker's warg riders halve his losses"; cName: string }
  | { kind: 'every defending unit was lost before the lines closed' }
  | { kind: "the defenders' dwarven guard leave the attacker's free lances no broken backs"; cName: string }
  | {
      kind: "the attacker's free lances ride down the defenders' broken companies";
      cName: string;
      extraLossesPct: number;
    }
  | { kind: 'a defending unit is destroyed in the rout'; defendingUnitName: string; whomItFaced: WhomAUnitFaced | null }
  | { kind: 'the defenders have nowhere to retreat and hold a shield fort'; provName: string }
  | { kind: 'the defenders have nowhere to retreat and take further losses'; provName: string }
  | {
      kind: 'the attacker is repelled by the defenders';
      cName: string;
      severity: string;
      margRatio: number;
      defName2: string;
      aPlayersGarrison: boolean;
      atSea: boolean;
    }
  | {
      kind: 'a defending unit is destroyed in the fighting';
      defendingUnitName: string;
      whomItFaced: WhomAUnitFaced | null;
    }
  | { kind: "the guard's host is destroyed and he is a masterless hero"; guardName: string; provName: string }
  | { kind: "the attacker's dwarven guard leave the defenders' free lances no broken backs"; cName: string }
  | {
      kind: "the defenders' free lances ride down the attacker's broken companies";
      cName: string;
      extraLossesPct: number;
    }
  | { kind: "the attacker's corsairs take his beaten force back to the ships"; cName: AValueInALinesWords }
  | { kind: "the attacker's shield-wall holds and the infantry stand their ground"; cName: string }
  | { kind: 'the attacker has nowhere to retreat and takes further losses'; cName: string }
  | {
      kind: 'an attacking unit is cut down in the rout with no escape';
      unitName: string;
      itsBonesCrumble: boolean | undefined;
    }
  | { kind: "the attacker's forces retreat to a province"; cName: string; retreatToName: string }
  | {
      kind: "the onlookers' summary of a battle";
      provName: string;
      won: boolean;
      attackersName: string;
      defendersName: string;
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
      kind: 'a unit is cut down and rises again by its regenerating hide';
      unitReference: string;
      whomItFaced: WhomAUnitFaced | null;
    }
  | {
      kind: 'a unit dies in the battle';
      unitReference: string;
      whomItFaced: WhomAUnitFaced | null;
      diedVerb: string | null | undefined;
      itsSideWon: boolean;
      itsBonesCrumble: boolean | undefined;
    }
  | {
      kind: 'a unit is promoted after the battle';
      unitReferenceAtItsOldQuality: string;
      whomItFaced: WhomAUnitFaced | null;
      promoteVerb: string | null | undefined;
      unitQuality: string;
    }
  | {
      kind: 'a unit falls back behind the shield wall in good order';
      unitReference: string;
      whomItFaced: WhomAUnitFaced | null;
    }
  | {
      kind: 'a unit keeps its nerve under the knightly example';
      unitReference: string;
      whomItFaced: WhomAUnitFaced | null;
    }
  | {
      kind: 'a unit loses heart in defeat and is reduced a tier';
      unitReferenceAtItsOldQuality: string;
      whomItFaced: WhomAUnitFaced | null;
      unitQuality: string;
    }
  | {
      kind: 'a unit improves a tier despite defeat';
      unitReferenceAtItsOldQuality: string;
      whomItFaced: WhomAUnitFaced | null;
      unitQuality: string;
    }
  | {
      kind: "a hero not at war with the province's realm gains a host inside it";
      cName: string;
      realmTag: string;
      unitCount: number;
      provName: string;
      theRealmsAreAllied: boolean;
      provName2: string;
    }
  | { kind: "a hero's new host is still forming up in a province"; cName: string; provName: string }
  | {
      kind: 'no one stands to defend a province and the hero takes control of it';
      provName: string;
      cName: string;
      playerName: string;
    }
  | {
      kind: 'with fresh troops the hero takes control of a province';
      cName: string;
      provName: string;
      playerName: string;
    }
  | {
      kind: 'the hero turns a newly gathered host on a province and a battle is initiated';
      cName: string;
      realmTag: string;
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
      kind: 'the hero has the better of the fighting but the guard still holds the field';
      hostName: string;
      provName: string;
      guardName: string;
      guardUnitCount: number;
    }
  | {
      kind: 'the hero has the better of the fighting but leaderless defenders still hold the field';
      hostName: AValueInALinesWords;
      provName: AValueInALinesWords;
      leaderlessUnitCount: number;
    }
  | {
      kind: 'the hero has the better of the fighting but enemy forces still hold their ground';
      hostName: string;
      provName: string;
    }
  | {
      kind: "the hero has the better of the fighting but the province's garrison still holds";
      hostName: AValueInALinesWords;
      provName: AValueInALinesWords;
      atSea: boolean;
    }
  | {
      kind: 'the hero overcomes the defenders and claims the province for his realm';
      hostName: string;
      provName: string;
      playerName: string;
    }
  | {
      kind: "the province's owner learns his defenders still hold against the hero";
      cName: string;
      realmTag: string;
      provName: string;
      provName2: string;
      heroFell: boolean;
      unitCount: number;
    }
  | {
      kind: "the province's owner learns the hero was beaten back";
      cName: string;
      realmTag: string;
      provName: string;
      provName2: string;
    }
  | {
      kind: "a beaten guard's surviving unit breaks ranks and flees as mercenaries";
      unitName: string;
      victorsHost: string | null;
      provName: string;
    }
  | {
      kind: "a beaten guard's surviving unit loses heart and is reduced a tier";
      unitNameAtItsOldQuality: string;
      unitQuality: string;
      victorsHost: string | null;
      guardName: string;
    }
  | {
      kind: "a beaten guard's surviving unit holds its ground unbroken";
      unitName: string;
      victorsHost: string | null;
      guardName: string;
    }
  | {
      kind: "a side's strength ladder begins";
      side: 'attacker' | 'defender';
      sideName: string;
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
      sideName: string | null | undefined;
      theFrontLine: (AUnitAsTheGridNamesIt | null)[];
      theFlanks: AUnitAsTheGridNamesIt[];
      theAir: AUnitAsTheGridNamesIt[];
      theReserve: AUnitAsTheGridNamesIt[];
    }
  | {
      kind: "a side's second line in the battle grid";
      sideName: string | null | undefined;
      theSecondLine: (AUnitAsTheGridNamesIt | null)[];
    }
  | {
      kind: 'the scouting side chooses the front';
      scoutName: string;
      itsSideHasExploredMore: boolean;
      otherSideName: string;
      scoutName2: string;
      frontWidth: number;
      frontTheDiceAllow: number;
      adjustments: number;
    }
  | {
      kind: 'each side shifts its battle line';
      otherSideName: string;
      otherSidesMoves: number;
      scoutName: string;
      scoutsMoves: number;
    }
  | {
      kind: "an unfinished battle against a province's defenders resumes";
      provName: string;
      attackersHostName: string;
      defendersName: string;
    }
  | { kind: 'the guard still holds a contested province with survivors'; guardName: string; provName: string }
  | {
      kind: 'commanderless survivors still contest a province';
      survivingUnitCount: number;
      provName: AValueInALinesWords;
    }
  | {
      kind: 'the attacker finally overcomes the defenders and claims a province';
      attackersHostName: string;
      provName: string;
    }
  | {
      kind: 'the attacker breaks off a stalled battle and retreats';
      attackersHostName: AValueInALinesWords;
      retreatToName: AValueInALinesWords;
    }
  | { kind: 'the attacker is pinned in a province with no way out'; attackersHostName: string; provName: string }
  | {
      kind: 'a contest for a province lapses as the realms are no longer at war';
      provName: string;
      attackersRealmName: string | undefined;
      defendersRealmName: string | undefined;
    }
  | {
      kind: "war comes to a province two realms' hosts share";
      provName: AValueInALinesWords;
      attackersHostName: AValueInALinesWords;
      attackersRealmTag: AValueInALinesWords;
      defendersHostName: AValueInALinesWords;
      defendersRealmTag: AValueInALinesWords;
      seasonName: AValueInALinesWords;
    }
  | {
      kind: 'an unfinished battle between two hosts resumes';
      provName: string;
      attackersHostName: string;
      defendersHostName: string;
    }
  | { kind: 'the winner of a stalled battle secures a province'; winnersHostName: string; provName: string }
  | { kind: 'a host holds a province unopposed and secures it'; hostName: string; provName: string }
  | { kind: 'the eagle riders mark the forest wardens and spoil the ambush'; shooterName: string }
  | { kind: 'the gyrocopters harry a flying unit off its line'; targetUnitName: string; strengthLost: number }
  | { kind: "a side's gyrocopters climb to meet the enemy's flyers"; sideName: string; engagedCount: number }
  | {
      kind: "a side's units fight beside their own kin";
      sideName: string;
      unitsOfTheKingsRaceUnderACommanderOfThatBlood: number;
      unitsOfTheKingsRace: number;
      unitsOfTheirCommandersRace: number;
    }
  | {
      kind: "a hero's host turns on a province it has shared with a realm at war";
      attackersRealmName: string | undefined;
      ownersRealmName: string | null;
      cName: string;
      realmTag: string;
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
  'a unit is cut down with no escape': "the fight's",
  "a side's other forces survive the engagement": "the fight's",
  'no units were left on the field to count': "the fight's",
  'the attacker wins the battle and seizes the province': "the fight's",
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
  "the defender's stronger host is pushed back but stays": "the fight's",
  "the loser's force is destroyed to the last": "the fight's",
  "the loser's dwarven guard withdraw behind a shield fort": "the fight's",
  'the loser retreats to a province': "the fight's",
  "the loser's surviving forces": "the fight's",
  "the loser's forces are completely destroyed and he retreats alone": "the fight's",
  "the attacker wins the battle but the defender's survivors hold the province": "the fight's",
  "the attacker's assault is repelled and driven from the province": "the fight's",
  'the attacker has nowhere to retreat': "the fight's",
  "the attacker's stronger host is thrown back but stays": "the fight's",
  "the attacker's assault is repelled but not driven from the province": "the fight's",
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
  'the attacker sweeps into a province with no one left to stand against him': "the fight's",
  'the attacker wins the battle against the defenders': "the fight's",
  "the attacker's warg riders halve his losses": "the fight's",
  'every defending unit was lost before the lines closed': "the fight's",
  "the defenders' dwarven guard leave the attacker's free lances no broken backs": "the fight's",
  "the attacker's free lances ride down the defenders' broken companies": "the fight's",
  'a defending unit is destroyed in the rout': "the fight's",
  'the defenders have nowhere to retreat and hold a shield fort': "the fight's",
  'the defenders have nowhere to retreat and take further losses': "the fight's",
  'the attacker is repelled by the defenders': "the fight's",
  'a defending unit is destroyed in the fighting': "the fight's",
  "the guard's host is destroyed and he is a masterless hero": "the fight's",
  "the attacker's dwarven guard leave the defenders' free lances no broken backs": "the fight's",
  "the defenders' free lances ride down the attacker's broken companies": "the fight's",
  "the attacker's corsairs take his beaten force back to the ships": "the fight's",
  "the attacker's shield-wall holds and the infantry stand their ground": "the fight's",
  'the attacker has nowhere to retreat and takes further losses': "the fight's",
  'an attacking unit is cut down in the rout with no escape': "the fight's",
  "the attacker's forces retreat to a province": "the fight's",
  "the onlookers' summary of a battle": "the fight's",
  'the most seasoned captain takes command of the combined host': "its event's",
  'the blood harvest claims offerings from the fallen enemy units': "the fight's",
  "the iron throne of skulls raises the enemy's fallen as skeletons": "the fight's",
  'terror radiates from a province after an evil victory': "the fight's",
  'terror lingers in a province and its defenders fight demoralised': "the fight's",
  'a unit is cut down and rises again by its regenerating hide': "the fight's",
  'a unit dies in the battle': "the fight's",
  'a unit is promoted after the battle': "the fight's",
  'a unit falls back behind the shield wall in good order': "the fight's",
  'a unit keeps its nerve under the knightly example': "the fight's",
  'a unit loses heart in defeat and is reduced a tier': "the fight's",
  'a unit improves a tier despite defeat': "the fight's",
  "a hero not at war with the province's realm gains a host inside it": "its event's",
  "a hero's new host is still forming up in a province": "its event's",
  'no one stands to defend a province and the hero takes control of it': "its event's",
  'with fresh troops the hero takes control of a province': "its event's",
  'the hero turns a newly gathered host on a province and a battle is initiated': "the fight's",
  'the defenders riding in were keeping watch and are already in the line': "the fight's",
  'the defender is reinforced by other heroes in the defence of a province': "the fight's",
  "the province's standing troops rally to the defender": "the fight's",
  'a hero fell in the battle line beside the commander of the defence': "its event's",
  'a hero stands in the battle line beside the commander of the defence': "its event's",
  "the province's standing troops fall back with the defender": "its event's",
  "the province's standing troops fall in with the defender as the battle continues": "its event's",
  "the province's garrison is overwhelmed as the province falls": "its event's",
  'the hero has the better of the fighting but the guard still holds the field': "its event's",
  'the hero has the better of the fighting but leaderless defenders still hold the field': "its event's",
  'the hero has the better of the fighting but enemy forces still hold their ground': "its event's",
  "the hero has the better of the fighting but the province's garrison still holds": "its event's",
  'the hero overcomes the defenders and claims the province for his realm': "its event's",
  "the province's owner learns his defenders still hold against the hero": "its event's",
  "the province's owner learns the hero was beaten back": "its event's",
  "a beaten guard's surviving unit breaks ranks and flees as mercenaries": "its event's",
  "a beaten guard's surviving unit loses heart and is reduced a tier": "its event's",
  "a beaten guard's surviving unit holds its ground unbroken": "its event's",
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
  'the guard still holds a contested province with survivors': "its event's",
  'commanderless survivors still contest a province': "its event's",
  'the attacker finally overcomes the defenders and claims a province': "its event's",
  'the attacker breaks off a stalled battle and retreats': "its event's",
  'the attacker is pinned in a province with no way out': "its event's",
  'a contest for a province lapses as the realms are no longer at war': "its event's",
  "war comes to a province two realms' hosts share": "its event's",
  'an unfinished battle between two hosts resumes': "its event's",
  'the winner of a stalled battle secures a province': "its event's",
  'a host holds a province unopposed and secures it': "its event's",
  'the eagle riders mark the forest wardens and spoil the ambush': "the fight's",
  'the gyrocopters harry a flying unit off its line': "the fight's",
  "a side's gyrocopters climb to meet the enemy's flyers": "the fight's",
  "a side's units fight beside their own kin": "the fight's",
  "a hero's host turns on a province it has shared with a realm at war": "its event's",
};
