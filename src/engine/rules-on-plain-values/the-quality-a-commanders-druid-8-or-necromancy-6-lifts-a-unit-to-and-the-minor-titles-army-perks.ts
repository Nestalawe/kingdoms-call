// ── The quality a commander's Druid 8 or Necromancy 6 lifts a unit to, and the minor titles' army perks (P1-11e35) ──
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). Moved as they were from armStr (src/engine/battle/terrain-and-unit-strength.ts), so the army
// card can later ask the turn's own: the two mastery lifts of a unit's quality, and the four minor titles whose holder's
// units fight +5%. The sets of units the Cavalier and the Ironclad lift were src/engine/titles/reckoning.ts's, which
// counts its titles' holders by them.
import { KC_QUALITY_UP, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { CREATURE_ARMIES, MONSTER_ARMIES } from './units-that-fly-sail-or-can-be-carried-through-the-air.ts';

// ── MINOR TITLES ── 20 honorary titles that do NOT count toward victory but each grant the holding
// character a small perk (src/engine/titles/reckoning.ts awards them). These are the units two of them lift.
export const MINOR_CAV = new Set(KC_UNIT_CLASS.cavalry); // flyers are not cavalry — matches CAVALRY_TYPES and the rulebook
export const MINOR_HEAVY = new Set([
  'Mountain Guns',
  'Dwarf Ironclads',
  'Galleon Fleet',
  'Corsair Fleet',
  'Elven Galleys',
  'Orcish Longships',
  'Whale Cohort',
  'Great Turtles',
  'Siege Towers',
]); // the ferries count (the turtles since Island Back, 2026-10-13)

/** The quality one tier above each (Elite stays Elite); a quality the table doesn't hold has none. */
const THE_QUALITY_ONE_TIER_UP: Readonly<Record<string, string | undefined>> = { ...KC_QUALITY_UP };

/** A hero's trained level of a skill, from 0 to 9, as his card or the save writes it (none is 0). */
export function theTrainedLevelOfASkill(theLevelWritten: number | null | undefined): number {
  return Math.max(0, Math.min(9, Number(theLevelWritten) || 0));
}
/** The mastery tier a trained level gives: the levels past 5 (Druid 8 is tier 3, Necromancy 6 tier 1). */
export function theMasteryTierATrainedLevelGives(theLevelWritten: number | null | undefined): number {
  return Math.max(0, theTrainedLevelOfASkill(theLevelWritten) - 5);
}

/** A unit as the two mastery lifts read it: its type, its quality, and whether it is of the risen dead. */
export interface AUnitAsTheMasteryLiftsReadIt {
  readonly unitType: string;
  readonly quality: string;
  readonly isSkeletal: boolean;
}
/** Its commander as they read him: his Druid's and his Necromancy's mastery tiers (his trained level past 5, or 0 for
 *  no commander). */
export interface ACommanderAsTheMasteryLiftsReadHim {
  readonly hisDruidMasteryTier: number;
  readonly hisNecromancyMasteryTier: number;
}

/** The quality a unit fights at once its commander's Druid 8 and Necromancy 6 have lifted it, each by one tier, and
 *  which of them did: Druid 8 (mastery tier 3) lifts a Creature or a Monster; Necromancy 6 (The Necromantic Arts,
 *  mastery tier 1) lifts a unit of the risen dead. */
export function theQualityACommandersDruid8AndNecromancy6LiftAUnitTo(
  unit: AUnitAsTheMasteryLiftsReadIt,
  commander: ACommanderAsTheMasteryLiftsReadHim,
) {
  let quality = unit.quality;
  const druid =
    commander.hisDruidMasteryTier >= 3 && (CREATURE_ARMIES.has(unit.unitType) || MONSTER_ARMIES.has(unit.unitType));
  if (druid) {
    quality = THE_QUALITY_ONE_TIER_UP[quality] ?? quality;
  } // DRUID L8: creatures & monsters fight one tier higher
  const necromancy = unit.isSkeletal && commander.hisNecromancyMasteryTier >= 1;
  if (necromancy) {
    quality = THE_QUALITY_ONE_TIER_UP[quality] ?? quality;
  } // NECROMANCY L6 (The Necromantic Arts): skeletal armies you lead fight one experience tier higher
  return { quality, liftedByDruid: druid, liftedByNecromancy: necromancy };
}

/** A minor title whose holder's units fight +5%. */
export type AMinorTitleWithAnArmyPerk = 'naturalist' | 'beastmaster' | 'cavalier' | 'ironclad';
/** The perk that lifted a unit: the Naturalist's or the Beastmaster's (one perk), the Cavalier's, the Ironclad's. */
export type AMinorTitlesArmyPerk = 'naturalist or beastmaster' | 'cavalier' | 'ironclad';

/** A unit's strength once its commander's minor titles' army perks have lifted it, and the perks that did, in their
 *  order (each ×1.05, rounded as it goes): Naturalist or Beastmaster, a Creature or a Monster (one perk, however many
 *  of the two he holds); Cavalier, a cavalry unit; Ironclad, a heavy unit or a fleet. `heHoldsTheMinorTitle` is asked
 *  in the turn's order, and only where the unit's kind leaves it a question (a Naturalist only of a Creature or a
 *  Monster, a Beastmaster only if he isn't the Naturalist). */
export function theStrengthAUnitsCommandersMinorTitlesLiftItTo(
  strength: number,
  unitType: string,
  heHoldsTheMinorTitle: (title: AMinorTitleWithAnArmyPerk) => boolean,
) {
  let str = strength;
  const liftedBy: AMinorTitlesArmyPerk[] = [];
  const _prim = CREATURE_ARMIES.has(unitType) || MONSTER_ARMIES.has(unitType);
  if (_prim && (heHoldsTheMinorTitle('naturalist') || heHoldsTheMinorTitle('beastmaster'))) {
    str = Math.round(str * 1.05);
    liftedBy.push('naturalist or beastmaster');
  }
  if (heHoldsTheMinorTitle('cavalier') && MINOR_CAV.has(unitType)) {
    str = Math.round(str * 1.05);
    liftedBy.push('cavalier');
  }
  if (heHoldsTheMinorTitle('ironclad') && MINOR_HEAVY.has(unitType)) {
    str = Math.round(str * 1.05);
    liftedBy.push('ironclad');
  }
  return { strength: str, liftedBy };
}
