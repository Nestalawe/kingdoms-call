// The graves and the undead of a realm's alignment (plan P1-19's alignment abilities family, row P1-19ax2): the
// abilities that keep the battlefield graves on a realm's land ("turnEnd: a realm's alignment keeps the graves on its
// land") and make a hero one of the undead in personal combat ("aHerosStanding: a hero's own alignment makes him
// undead"). Each reads its numbers from its row (src/content/alignment-abilities-their-keys-names-numbers-and-
// words.ts); the runner (the-registry-of-alignment-abilities.ts) asks those the alignment holds. No effect draws a die.
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
} from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

/** "turnEnd: a realm's alignment keeps the graves on its land": Undead land's, its row's share / 100 (exactly 0.05, as
 *  the old literal). */
export const A_REALMS_ALIGNMENT_KEEPS_THE_GRAVES_ON_ITS_LAND = {
  'graves-keep-on-undead-land': () =>
    ALIGNMENT_ABILITIES['graves-keep-on-undead-land'].theNumbers.theShareOfTheGravesThatRotEachTurn.value / 100,
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheStagesOfEachHookPoint['turnEnd']["a realm's alignment keeps the graves on its land"]>
>;

/** "aHerosStanding: a hero's own alignment makes him undead": an Undead hero. */
export const A_HEROS_OWN_ALIGNMENT_MAKES_HIM_UNDEAD = {
  'an-undead-hero-is-undead-in-personal-combat': () => true,
} satisfies Partial<
  Record<AlignmentAbilitySlug, TheStagesOfEachHookPoint['aHerosStanding']["a hero's own alignment makes him undead"]>
>;
