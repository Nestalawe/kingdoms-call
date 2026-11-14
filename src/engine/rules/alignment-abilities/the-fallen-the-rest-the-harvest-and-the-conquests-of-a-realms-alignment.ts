// The fallen, the Rest, the harvest and the conquests of a realm's alignment (plan P1-19's alignment abilities family,
// row P1-19ax1): the abilities that raise a realm's fallen on holy ground ("turnStart: a realm's alignment raises its
// fallen on holy ground": Divine grace), raise a Rest's heal ("orderOutcome: a realm's alignment raises a rest's
// heal"), claim gold for each foe destroyed ("fate: a realm's alignment claims gold for each foe destroyed": the Blood
// Harvest) and conquer by a doctrine ("fate: a realm's alignment conquers by a doctrine": plunder or enslave). Each
// reads its numbers from its row (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts); the runner
// (the-registry-of-alignment-abilities.ts) asks those the realm's alignment holds. No effect draws a die.
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
} from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

/** "turnStart: a realm's alignment raises its fallen on holy ground": Divine grace, its row's turns in death and share
 *  of health. */
export const A_REALMS_ALIGNMENT_RAISES_ITS_FALLEN_ON_HOLY_GROUND = {
  'divine-grace': () => {
    const theNumbers = ALIGNMENT_ABILITIES['divine-grace'].theNumbers;
    return {
      theFullTurnsInDeath: theNumbers.theFullTurnsInDeath.value,
      theShareOfHealth: theNumbers.theShareOfHealthTheFallenRiseWith.value,
    };
  },
} satisfies Partial<
  Record<
    AlignmentAbilitySlug,
    TheStagesOfEachHookPoint['turnStart']["a realm's alignment raises its fallen on holy ground"]
  >
>;

/** "orderOutcome: a realm's alignment raises a rest's heal": the Divine Rest, its row's factor. */
export const A_REALMS_ALIGNMENT_RAISES_A_RESTS_HEAL = {
  'the-divine-rest': () => ALIGNMENT_ABILITIES['the-divine-rest'].theNumbers.theFactorOfTheHeal.value,
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheStagesOfEachHookPoint['orderOutcome']["a realm's alignment raises a rest's heal"]>
>;

/** "fate: a realm's alignment claims gold for each foe destroyed": the Blood Harvest, its row's gold. */
export const A_REALMS_ALIGNMENT_CLAIMS_GOLD_FOR_EACH_FOE_DESTROYED = {
  'blood-harvest': () => ALIGNMENT_ABILITIES['blood-harvest'].theNumbers.theGoldForEachFoeDestroyed.value,
} satisfies Partial<
  Record<
    AlignmentAbilitySlug,
    TheStagesOfEachHookPoint['fate']["a realm's alignment claims gold for each foe destroyed"]
  >
>;

/** "fate: a realm's alignment conquers by a doctrine": plunder or enslave, its row's share (`50 / 100`: exactly 0.5, as
 *  the old literal), grade and turns. */
export const A_REALMS_ALIGNMENT_CONQUERS_BY_A_DOCTRINE = {
  'plunder-or-enslave': () => {
    const theNumbers = ALIGNMENT_ABILITIES['plunder-or-enslave'].theNumbers;
    return {
      theShareOfTheTaxPlundered: theNumbers.theShareOfTheTaxPlundered.value / 100,
      theGradeOfTheEnslavedGarrison: theNumbers.theGradeOfTheEnslavedGarrison.value,
      theTurnsTheEnslavedProvincePaysLess: theNumbers.theTurnsTheEnslavedProvincePaysLess.value,
    };
  },
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheStagesOfEachHookPoint['fate']["a realm's alignment conquers by a doctrine"]>
>;
