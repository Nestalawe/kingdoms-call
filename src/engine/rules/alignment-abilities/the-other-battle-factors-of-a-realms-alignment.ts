// The other battle factors of a realm's alignment (plan P1-19's alignment abilities family, row P1-19au2): consecrated
// ground weakening an Undead or Evil attacker ("strength: consecrated ground weakens an attacker's host"), Righteous
// Defence ("strength: a realm's alignment strengthens its defence of its own ground"), Home of the Wild and the Reign of
// Fear (two stages, each one rounded step of a unit's strength at its own point of armStr), the Deathless March ("fate:
// a realm's alignment holds a beaten host on the field") and the Banner of Fellowship ("movementCost: a realm's
// alignment helps converging columns unite"). Each reads its numbers from its row
// (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts); the runners
// (the-registry-of-alignment-abilities.ts) ask those the alignment handed holds. None draws a die.
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
} from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheStrengthsStages = TheStagesOfEachHookPoint['strength'];

/** The creeds a row acts against, as a list of names. */
const theCreedsItActsAgainst = (theCreeds: readonly string[]): readonly string[] => theCreeds;

/** "strength: consecrated ground weakens an attacker's host": an attacker of a creed the row names fights at 1 less
 *  its share, as (100 − 15) / 100, exactly the 0.85 it was. */
export const CONSECRATED_GROUND_WEAKENS_AN_ATTACKERS_HOST = {
  'consecrated-ground-weakens-an-unholy-attacker': (facts) => {
    const row = ALIGNMENT_ABILITIES['consecrated-ground-weakens-an-unholy-attacker'];
    return theCreedsItActsAgainst(row.theCreedsItActsAgainst).includes(facts.theAttackersAlignment)
      ? (100 - row.theNumbers.theShareWeaker.value) / 100
      : null;
  },
} satisfies Partial<Record<AlignmentAbilitySlug, TheStrengthsStages["consecrated ground weakens an attacker's host"]>>;

/** "strength: a realm's alignment strengthens its defence of its own ground": 1 and its share, as 1 + 10 / 100,
 *  exactly the 1.1 it was. */
export const A_REALMS_ALIGNMENT_STRENGTHENS_ITS_DEFENCE_OF_ITS_OWN_GROUND = {
  'righteous-defence': () => 1 + ALIGNMENT_ABILITIES['righteous-defence'].theNumbers.theShareStronger.value / 100,
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheStrengthsStages["a realm's alignment strengthens its defence of its own ground"]>
>;

/** "strength: a realm's alignment strengthens a unit in the wild": a Creature unit in forest or jungle, at its row's
 *  factor. */
export const A_REALMS_ALIGNMENT_STRENGTHENS_A_UNIT_IN_THE_WILD = {
  'home-of-the-wild': (facts) =>
    (facts.theTerrain === 'forest' || facts.theTerrain === 'jungle') && CREATURE_ARMIES.has(facts.theUnitType)
      ? ALIGNMENT_ABILITIES['home-of-the-wild'].theNumbers.theStrengthOfACreature.value
      : null,
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheStrengthsStages["a realm's alignment strengthens a unit in the wild"]>
>;

/** "strength: a realm's alignment strengthens a unit by its reign of fear": a Monster unit, at its row's factor (the
 *  caller asks only for an attacker on ground its realm's Terror grips). */
export const A_REALMS_ALIGNMENT_STRENGTHENS_A_UNIT_BY_ITS_REIGN_OF_FEAR = {
  'reign-of-fear': (facts) =>
    MONSTER_ARMIES.has(facts.theUnitType)
      ? ALIGNMENT_ABILITIES['reign-of-fear'].theNumbers.theStrengthOfAMonster.value
      : null,
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheStrengthsStages["a realm's alignment strengthens a unit by its reign of fear"]>
>;

/** "fate: a realm's alignment holds a beaten host on the field": a host of skeletons alone (at least one company). */
export const A_REALMS_ALIGNMENT_HOLDS_A_BEATEN_HOST_ON_THE_FIELD = {
  'the-deathless-march': (facts) =>
    facts.theCompanies.length > 0 && facts.theCompanies.every((company) => company._isSkeletal),
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheStagesOfEachHookPoint['fate']["a realm's alignment holds a beaten host on the field"]>
>;

/** "movementCost: a realm's alignment helps converging columns unite": its row's points. */
export const A_REALMS_ALIGNMENT_HELPS_CONVERGING_COLUMNS_UNITE = {
  'banner-of-fellowship': () => ALIGNMENT_ABILITIES['banner-of-fellowship'].theNumbers.thePointsMoreReadily.value,
} satisfies Partial<
  Record<
    AlignmentAbilitySlug,
    TheStagesOfEachHookPoint['movementCost']["a realm's alignment helps converging columns unite"]
  >
>;
