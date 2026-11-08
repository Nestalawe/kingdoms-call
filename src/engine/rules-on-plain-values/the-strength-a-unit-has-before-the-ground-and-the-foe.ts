// The strength of a unit a hero leads before the ground and the foe, on plain values so the army card can show it as
// the turn counts it (plan P1-11e38, R-135, question 45 (a)): armStr's own steps (src/engine/battle/
// terrain-and-unit-strength.ts) on no ground, with no foe and nothing of a battle around it, in armStr's order, each
// the rule it asks. Left out, as the card's label says, is what the ground, the foe and the battle add: the terrain and
// the sea, the Elves' woods, the Dwarves' and the Standing Stones' defence, Terror and the Reign of Fear, the volleys,
// the force's own abilities, the Home of the Wild, and what a battle or a spell of the turn marks on a unit or its
// commander (Oratory, Tactical 6, a War Drum, Phantasmal Armies).
import {
  THE_COMMANDERS_ITEMS,
  theStrengthAUnitHasAfterTheStepsOfItsCommandersItems,
  type AnEffectOfTheCommandersItems,
} from './the-strength-a-unit-has-after-the-steps-of-its-commanders-items.ts';
import { theEffectsTheseItemsCarry, type AMagicItemAsTheRegistryReadsIt } from './the-effects-a-held-item-carries.ts';
import { theFactorTheUnitStrengthDiscoveriesARealmHoldsStrengthenAUnitBy } from './the-factor-a-realms-unit-strength-discoveries-strengthen-a-unit-by.ts';
import {
  theQualityACommandersDruid8AndNecromancy6LiftAUnitTo,
  theStrengthAUnitsCommandersMinorTitlesLiftItTo,
  type AMinorTitleWithAnArmyPerk,
} from './the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts';
import {
  theStrengthAUnitsKinAndARivalKinsLeaderLeaveIt,
  type TheStrengthAUnitsKinAndARivalKinsLeaderLeaveIt,
} from './the-strength-a-units-kin-and-a-rival-kins-leader-leave-it.ts';
import { UNIT_BASE_STR, UNIT_Q_MULT } from './unit-types-and-base-strength.ts';
import type { TheEffectOfADiscovery } from '../../content/discovery-effects-their-kinds-numbers-and-words.ts';

/** A unit a hero leads: its type, its own quality, whether it is of the risen dead, and its race (none for a beast). */
export interface AUnitAHeroLeads {
  readonly unitType: string;
  readonly quality: string | undefined;
  readonly isSkeletal: boolean;
  readonly race: string | null | undefined;
}

/** The hero who leads it and his realm, as the steps before the ground and the foe read them. */
export interface AHeroAndHisRealmAsAUnitsStrengthReadsThem {
  /** His Druid's and his Necromancy's mastery tiers (his trained level past 5: theMasteryTierATrainedLevelGives). */
  readonly hisDruidMasteryTier: number;
  readonly hisNecromancyMasteryTier: number;
  /** The share of its strength his Druid shortfall leaves the unit (1 if none: strengthLeftByADruidShortfall). */
  readonly theShareHisDruidShortfallLeaves: number;
  readonly theKingsRace: string | null | undefined;
  readonly hisRace: string | null | undefined;
  /** The unit-strength effects his realm's discoveries carry (theEffectsOfAKindTheseDiscoveriesCarry, `unitStr`). */
  readonly theRealmsUnitStrengthEffects: readonly TheEffectOfADiscovery[];
  readonly heIsTheKing: boolean;
  /** The items he uses (theItemsAHeroUses). */
  readonly theItemsHeUses: readonly AMagicItemAsTheRegistryReadsIt[];
  readonly theRealmsAlignment: string | null | undefined;
  /** His Druid mastery's lift of the unit, a fraction (0 to 1, to two places: druidMasteryGainOver). */
  readonly hisDruidMasteryGain: number;
  readonly heHoldsTheMinorTitle: (title: AMinorTitleWithAnArmyPerk) => boolean;
}

/** Whether an effect a held item carries has a step at the stage "strength: the commander's items". */
function anEffectOfTheCommandersItems(slug: string): slug is AnEffectOfTheCommandersItems {
  return Object.hasOwn(THE_COMMANDERS_ITEMS, slug);
}

/** The effects with a step at "strength: the commander's items" that his items carry, in the stage's order (the
 *  steps' own: a unit case pins it to the items' registry's order of the stage). */
export function theEffectsOfTheCommandersItemsInTheirOrder(
  theItemsHeUses: readonly AMagicItemAsTheRegistryReadsIt[],
): AnEffectOfTheCommandersItems[] {
  const carried: ReadonlySet<string> = theEffectsTheseItemsCarry(theItemsHeUses);
  return Object.keys(THE_COMMANDERS_ITEMS)
    .filter(anEffectOfTheCommandersItems)
    .filter((slug) => carried.has(slug));
}

/** The strength of a unit a hero leads before the ground, the foe and the battle's tactics, in armStr's order, each
 *  step rounded as armStr rounds it: Druid 8 and Necromancy 6 lift its quality; its base strength at that quality; a
 *  Druid shortfall (rounded down); its kin and a rival kin's leader; the realm's unit-strength discoveries; his items'
 *  steps; his Druid mastery; his minor titles' army perks. With the kin it counted, for the card's tags. */
export function theStrengthAUnitHasBeforeTheGroundAndTheFoe(
  unit: AUnitAHeroLeads,
  hero: AHeroAndHisRealmAsAUnitsStrengthReadsThem,
): { readonly strength: number; readonly theKin: TheStrengthAUnitsKinAndARivalKinsLeaderLeaveIt } {
  const quality = theQualityACommandersDruid8AndNecromancy6LiftAUnitTo(
    { unitType: unit.unitType, quality: (unit.quality ?? '') || 'Average', isSkeletal: unit.isSkeletal },
    { hisDruidMasteryTier: hero.hisDruidMasteryTier, hisNecromancyMasteryTier: hero.hisNecromancyMasteryTier },
  ).quality;
  let str = (UNIT_BASE_STR[unit.unitType] ?? 4) * (UNIT_Q_MULT[quality] ?? 2);
  if (hero.theShareHisDruidShortfallLeaves < 1) str = Math.floor(str * hero.theShareHisDruidShortfallLeaves);
  const theKin = theStrengthAUnitsKinAndARivalKinsLeaderLeaveIt(
    str,
    (unit.race ?? '') || null,
    hero.theKingsRace,
    (hero.hisRace ?? '') || null,
  );
  str = theKin.strength;
  const discoveries = theFactorTheUnitStrengthDiscoveriesARealmHoldsStrengthenAUnitBy(
    hero.theRealmsUnitStrengthEffects,
    {
      theUnit: {
        type: unit.unitType,
        race: unit.race,
        _isSkeletal: unit.isSkeletal,
        ...(unit.quality === undefined ? {} : { quality: unit.quality }),
      },
      theGround: null,
      isItsSideTheAttacker: null,
      isItLedByTheKing: hero.heIsTheKing,
      hasItACommander: true,
    },
  );
  if (discoveries !== 1) str = Math.round(str * discoveries);
  str = theStrengthAUnitHasAfterTheStepsOfItsCommandersItems(
    theEffectsOfTheCommandersItemsInTheirOrder(hero.theItemsHeUses),
    {
      unitType: unit.unitType,
      quality: unit.quality,
      isSkeletal: unit.isSkeletal,
      theRealmsAlignment: hero.theRealmsAlignment,
    },
    str,
  );
  if (hero.hisDruidMasteryGain > 0) str = Math.round(str * (1 + hero.hisDruidMasteryGain));
  str = theStrengthAUnitsCommandersMinorTitlesLiftItTo(str, unit.unitType, hero.heHoldsTheMinorTitle).strength;
  return { strength: str, theKin };
}
