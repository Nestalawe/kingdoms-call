// ── The quality a commander's Druid 8 or Necromancy 6 lifts a unit to, and the minor titles' army perks (P1-11e35) ──
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). Moved as they were from armStr (src/engine/battle/terrain-and-unit-strength.ts), so the army
// card can later ask the turn's own: the two mastery lifts of a unit's quality, and the four minor titles whose holder's
// units fight +5%. The sets of units the Cavalier and the Ironclad lift were src/engine/titles/reckoning.ts's, which
// counts its titles' holders by them. Since B-06k (T7) each title's perk is its row's (content's MINOR_TITLES), and
// its step is the effect of the minor titles' registry's stage "strength: the commander's minor titles".
import { KC_QUALITY_UP, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import {
  MINOR_TITLES,
  type AKindOfCompanyAMinorTitleCounts,
  type AMinorTitlesArmyPerk,
} from '../../content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
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

/** A minor title whose holder's companies of a kind fight stronger: one whose row has the perk (the Naturalist, the
 *  Beastmaster, the Cavalier, the Ironclad). */
type ARowWithAnArmyPerk = Extract<
  (typeof MINOR_TITLES)[number],
  { readonly theCompaniesItsHolderLeadsFightStronger: unknown }
>;
export type AMinorTitleWithAnArmyPerk = ARowWithAnArmyPerk['key'];
export type { AMinorTitlesArmyPerk };

/** Whether a company of this type is of the kind a minor title counts (its holder is found by them) or lifts (his
 *  companies of it fight stronger): any; cavalry; a Creature or a Monster; a heavy unit or a fleet. */
export function aCompanyIsOfTheKindAMinorTitleCounts(kind: AKindOfCompanyAMinorTitleCounts, unitType: string): boolean {
  switch (kind) {
    case 'any':
      return true;
    case 'cavalry':
      return MINOR_CAV.has(unitType);
    case 'creatures and monsters':
      return CREATURE_ARMIES.has(unitType) || MONSTER_ARMIES.has(unitType);
    case 'heavy units and fleets':
      return MINOR_HEAVY.has(unitType);
  }
}

/** The rows with an army perk, in the rows' order. */
const THE_ROWS_WITH_AN_ARMY_PERK: readonly ARowWithAnArmyPerk[] = MINOR_TITLES.filter(
  (row): row is ARowWithAnArmyPerk => 'theCompaniesItsHolderLeadsFightStronger' in row,
);
/** Each title's army perk, by its key, from its row. */
const THE_ARMY_PERK_OF_EACH_MINOR_TITLE: ReadonlyMap<
  AMinorTitleWithAnArmyPerk,
  ARowWithAnArmyPerk['theCompaniesItsHolderLeadsFightStronger']
> = new Map(THE_ROWS_WITH_AN_ARMY_PERK.map((row) => [row.key, row.theCompaniesItsHolderLeadsFightStronger]));

/** The titles with an army perk in the order their steps are made: the perks in the order of the first row that gives
 *  each, and a perk's titles in their rows' order (the Naturalist, the Beastmaster, the Cavalier, the Ironclad: a unit
 *  case pins it to the minor titles' registry's order of the stage "strength: the commander's minor titles"). */
export const THE_MINOR_TITLES_WITH_AN_ARMY_PERK_IN_THEIR_ORDER: readonly AMinorTitleWithAnArmyPerk[] = [
  ...new Set(THE_ROWS_WITH_AN_ARMY_PERK.map((row) => row.theCompaniesItsHolderLeadsFightStronger.thePerk)),
].flatMap((thePerk) =>
  THE_ROWS_WITH_AN_ARMY_PERK.filter((row) => row.theCompaniesItsHolderLeadsFightStronger.thePerk === thePerk).map(
    (row) => row.key,
  ),
);

/** What the stage "strength: the commander's minor titles" hands an effect (armStr, after his Druid mastery): the unit
 *  its commander leads. Whether he holds the title, the runner's caller says. */
export interface AUnitLedByAHolderOfAMinorTitle {
  readonly unitType: string;
}
/** The step a minor title's army perk makes on a unit its holder leads: the factor (the strength rounded after it), and
 *  the perk. */
export interface AStepOfAMinorTitlesArmyPerk {
  readonly multipliesBy: number;
  readonly thePerk: AMinorTitlesArmyPerk;
}

/** The step a title's army perk makes on a unit its holder leads, from its row, or nothing for a unit of another kind. */
export function theStepAMinorTitlesArmyPerkMakesOnAUnit(
  theTitle: AMinorTitleWithAnArmyPerk,
  unit: AUnitLedByAHolderOfAMinorTitle,
): AStepOfAMinorTitlesArmyPerk | null {
  const perk = THE_ARMY_PERK_OF_EACH_MINOR_TITLE.get(theTitle);
  if (!perk || !aCompanyIsOfTheKindAMinorTitleCounts(perk.ofWhichKind, unit.unitType)) return null;
  return { multipliesBy: perk.by, thePerk: perk.thePerk };
}

/** A unit's strength once its commander's minor titles' army perks have lifted it, and the perks that did, in their
 *  order: the titles handed, in the stage's order, each step rounded as it goes; a perk lifts a unit once, however many
 *  of its titles he holds (the Naturalist and the Beastmaster). `heHoldsTheMinorTitle` is asked only of a title whose
 *  perk would lift the unit and hasn't yet (a Beastmaster only if he isn't the Naturalist). */
export function theStrengthAUnitHasAfterTheStepsOfItsCommandersMinorTitles(
  theTitlesInTheStagesOrder: readonly AMinorTitleWithAnArmyPerk[],
  unit: AUnitLedByAHolderOfAMinorTitle,
  theStrengthSoFar: number,
  heHoldsTheMinorTitle: (title: AMinorTitleWithAnArmyPerk) => boolean,
): { strength: number; liftedBy: AMinorTitlesArmyPerk[] } {
  let str = theStrengthSoFar;
  const liftedBy: AMinorTitlesArmyPerk[] = [];
  for (const theTitle of theTitlesInTheStagesOrder) {
    const step = theStepAMinorTitlesArmyPerkMakesOnAUnit(theTitle, unit);
    if (!step || liftedBy.includes(step.thePerk) || !heHoldsTheMinorTitle(theTitle)) continue;
    str = Math.round(str * step.multipliesBy);
    liftedBy.push(step.thePerk);
  }
  return { strength: str, liftedBy };
}

/** A unit's strength once its commander's minor titles' army perks have lifted it, and the perks that did, in their
 *  order (each ×1.05, rounded as it goes): Naturalist or Beastmaster, a Creature or a Monster (one perk, however many
 *  of the two he holds); Cavalier, a cavalry unit; Ironclad, a heavy unit or a fleet (each title's row). The army card's
 *  (theStrengthAUnitHasBeforeTheGroundAndTheFoe); armStr asks the minor titles' registry's runner, in the stage's
 *  order. `heHoldsTheMinorTitle` is asked as theStrengthAUnitHasAfterTheStepsOfItsCommandersMinorTitles asks it. */
export function theStrengthAUnitsCommandersMinorTitlesLiftItTo(
  strength: number,
  unitType: string,
  heHoldsTheMinorTitle: (title: AMinorTitleWithAnArmyPerk) => boolean,
) {
  return theStrengthAUnitHasAfterTheStepsOfItsCommandersMinorTitles(
    THE_MINOR_TITLES_WITH_AN_ARMY_PERK_IN_THEIR_ORDER,
    { unitType },
    strength,
    heHoldsTheMinorTitle,
  );
}
