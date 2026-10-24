// ── The beasts a hero may lead, and the Druid each unit needs (plan P1-11b2) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). These read a unit as its realm sees it (the report's names: skeletal, temporary, wildHunt) and
// the levels and alignments each side works out for itself: the engine hands its own unit through
// unitAsItsRealmSeesIt, and works out the leader's Druid from his skills and items (P1-11b, Decisions 2 and 3).
import { KC_DRUID_LEVELS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { CREATURE_ARMIES, MONSTER_ARMIES } from './units-that-fly-sail-or-can-be-carried-through-the-air.ts';

/** A unit as its realm sees it (the turn report's projection names): its type, and whether it is a skeleton, summoned
 *  for a while (a grove, an elemental), a Wild Hunt beast, or a spectral double (a phantom, in a battle only). */
export interface AUnitAsItsRealmSeesIt {
  readonly type: string;
  readonly skeletal?: boolean | undefined;
  readonly temporary?: boolean | undefined;
  readonly wildHunt?: boolean | undefined;
  readonly phantom?: boolean | undefined;
}
/** A unit as the engine holds it: the fields unitAsItsRealmSeesIt reads. */
export interface AUnitAsTheEngineHoldsIt {
  readonly type: string;
  readonly _isSkeletal?: boolean | undefined;
  readonly _temporary?: boolean | undefined;
  readonly _wildHuntUntilTurn?: number | null | undefined;
  readonly _phantom?: boolean | undefined;
}
/** The engine's unit in the names its realm sees it by. */
export function unitAsItsRealmSeesIt(a: AUnitAsTheEngineHoldsIt): AUnitAsItsRealmSeesIt {
  return {
    type: a.type,
    skeletal: !!a._isSkeletal,
    temporary: !!a._temporary,
    wildHunt: a._wildHuntUntilTurn != null,
    phantom: !!a._phantom,
  };
}

// ── BEAST COMMAND (2026-10-12, Toby item 24) ── A hero may lead only as many Creature and Monster units as his Druid
// level. Counted: every living beast in the column — not skeletons (the dead need no Druid), nor a summoned grove,
// Wild Hunt beasts or phantoms, which leave at the turn's end. A realm's own heroes only (a province's chieftain
// commands its own beasts). The rule bites where a beast would JOIN a column (Recruit Armies, Pick Up Army,
// Leave/Transfer to a hero, Wild Calling): a hero already over it keeps what he leads and takes on no more.
export const BEAST_CMD_TYPES = new Set([...KC_UNIT_CLASS.creature, ...KC_UNIT_CLASS.monster]);
/** Whether the unit counts against its hero's beast command: a living Creature or Monster that stays. */
export function countsAgainstBeastCommand(a: AUnitAsItsRealmSeesIt | null | undefined): boolean {
  return !!a && BEAST_CMD_TYPES.has(a.type) && !a.skeletal && !a.temporary && !a.wildHunt && !a.phantom;
}

// DRUID ARMY LEVEL TABLE — a commander's Druid must be >= a unit's level, or it fights at −20% per
// level short. A commander leads his OWN race's units as if he had Druid 1.
// 2026-09-27 (Toby: collapse to one source): this table used to exist THREE times — here and twice
// in the player portal — and the player-portal copies had drifted (they lacked level 1, so a
// foreign-race unit under a Druid-0 commander showed no penalty while the engine applied −20%).
// The ONE copy is now KC_DRUID_LEVELS in kingdoms-call-data.ts; this builds the engine's Sets
// from it, in the same level order (getDruidLevel walks the levels ascending).
export const DRUID_ARMY_LEVELS_P = Object.fromEntries(
  Object.entries(KC_DRUID_LEVELS).map(([lvl, types]) => [lvl, new Set(types)]),
);
// Returns the Druid level required to lead a given army type
export function getDruidLevel(armyType: string): number {
  for (const [lvl, armies] of Object.entries(DRUID_ARMY_LEVELS_P)) {
    if (armies.has(armyType)) return parseInt(lvl);
  }
  return 0; // own race / unknown defaults to 0
}

// sd40 Dragon Taming: the winged beasts a realm with the discovery leads without any Druid penalty
// (Gnomish Gyrocopters are machines, not beasts, and are deliberately NOT tamed).
export const TAMED_FLYER_TYPES_D = new Set(KC_UNIT_CLASS.tamedFlyer);

/** Whether a unit of this type follows its leader whatever his Druid, for his realm's alignment or his own.
 *  Druidic alignment: no Druid penalty for Creature armies (they follow willingly). Keyed on the KINGDOM's alignment —
 *  NOT the commander's personal alignment — so EVERY character of a Druidic realm (king and heroes alike) leads
 *  Creatures freely, even though a Druidic king's heroes are seeded with a randomised personal alignment near his own
 *  (Good/Druidic/Neutral) and so are usually NOT personally Druidic. A personally-Druidic wandering hero (no realm, so
 *  no realm alignment) also qualifies by his own. Evil alignment (2026-10-13, Toby, Creatures and Monsters I): the
 *  mirror — no Druid penalty for Monster armies under an Evil realm (or a personally Evil wandering commander). They
 *  are driven, not led. (sd40 Dragon Taming's winged beasts are waived too: the caller knows the realm's discoveries,
 *  so it passes that on its own, to druidLevelALeaderNeeds.) */
export function druidNeedWaivedByAlignment(
  unitType: string,
  realmAlignment: string | null | undefined,
  leaderAlignment: string | null | undefined,
): boolean {
  return (
    (CREATURE_ARMIES.has(unitType) && (realmAlignment === 'Druidic' || leaderAlignment === 'Druidic')) ||
    (MONSTER_ARMIES.has(unitType) && (realmAlignment === 'Evil' || leaderAlignment === 'Evil'))
  );
}
/** The Druid a leader needs to lead a unit of this type at full strength, the waivers counted: none where his realm's
 *  alignment or his own waives it, or where the unit is a winged beast his realm has tamed (`tamed`: sd40 Dragon
 *  Taming); else the unit's level in the table. (A skeleton needs none either: each caller leaves it out first.) */
export function druidLevelALeaderNeeds(
  unitType: string,
  realmAlignment: string | null | undefined,
  leaderAlignment: string | null | undefined,
  tamed: boolean,
): number {
  if (druidNeedWaivedByAlignment(unitType, realmAlignment, leaderAlignment)) return 0;
  if (tamed) return 0;
  return getDruidLevel(unitType);
}
// ── SAME-RACE RULE ── Every commander (king or hero) can lead troops of their OWN race as if
// they had at least Druid level 1 for that race — no Druid training is needed to command your own
// people. Leading other races or exotic creatures still requires the appropriate Druid skill.
// (Note: a unit's race is the race of the province it was raised in, so troops recruited in a
// conquered province of another race count as that race and are led cross-race unless the
// commander shares it.)
/** The Druid a leader brings to a unit: his own, or at least 1 for a unit of his own race. */
export function druidALeaderBringsToAUnit(druidLevel: number, unitOfHisOwnRace: boolean): number {
  return unitOfHisOwnRace ? Math.max(1, druidLevel) : druidLevel;
}
/** The levels of Druid a leader is short of a unit's need (0: none). */
export function druidShortfall(levelNeeded: number, levelBrought: number): number {
  return Math.max(0, levelNeeded - levelBrought);
}
/** The share of its strength a unit keeps in battle when its leader is `shortfall` levels of Druid short of its need:
 *  20% less a level, never below a tenth. */
export function strengthLeftByADruidShortfall(shortfall: number): number {
  if (shortfall === 0) return 1.0;

  // 20% strength penalty per level of shortfall
  return Math.max(0.1, 1 - shortfall * 0.2);
}

// DRUID MASTERY (2026-09-24, Toby): +20% per Druid level over the minimum to lead a Creature/Monster,
// Druid counted to 9, gain capped at +100%. Applied in armStr via druidMasteryGain.
export const DRUID_MASTERY_PER_LVL = 0.2,
  DRUID_MASTERY_CAP = 1.0,
  DRUID_MASTERY_MAX_LVL = 9;
/** A leader's Druid as the mastery counts it: from 0 to 9. */
export function druidLevelTheMasteryCounts(druidLevel: number): number {
  return Math.max(0, Math.min(DRUID_MASTERY_MAX_LVL, druidLevel));
}
/** The Druid mastery's gain on a Creature or Monster unit (0 to 1: +20% a level the leader holds over the unit's need,
 *  to +100%), from the level the mastery counts (druidLevelTheMasteryCounts) and the unit's need (0 where waived). */
export function druidMasteryGainOver(levelCounted: number, levelNeeded: number): number {
  return Math.min(DRUID_MASTERY_CAP, DRUID_MASTERY_PER_LVL * Math.max(0, levelCounted - levelNeeded));
}
