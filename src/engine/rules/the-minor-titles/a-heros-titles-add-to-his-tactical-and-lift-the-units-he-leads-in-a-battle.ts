// A hero's minor titles in a battle (B-06, T7, the rules pulled out: its Reckoning and titles family, row B-06k): the
// effects of two stages of `strength`. "A hero's titles add to his Tactical": the Strategist adds his levels from his
// title's rows of the skills a title adds to at their point of use (content's SKILL_EXTRA_MINORS, scope 'battle': the
// rows the hero's card reads too, extraSkillBonuses), which commandScore and both sides of both battles ask. "The
// commander's minor titles": the Naturalist, the Beastmaster, the Cavalier and the Ironclad lift the companies of their
// kind he leads, each step from its title's row (content's MINOR_TITLES), on plain values so the army card shares it
// (rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-
// perks.ts). The runners are in the-registry-of-the-minor-titles-perks.ts. Who holds a title is the runner's caller's to
// say, as before. No effect draws a die.
import {
  SKILL_EXTRA_MINORS,
  type AMinorTitlesSlug,
} from '../../../content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import {
  theStepAMinorTitlesArmyPerkMakesOnAUnit,
  type AMinorTitleWithAnArmyPerk,
} from '../../rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheTacticalStage = TheStagesOfEachHookPoint['strength']["a hero's titles add to his Tactical"];
type TheArmyStage = TheStagesOfEachHookPoint['strength']["the commander's minor titles"];

/** The levels a title's rows of scope 'battle' add to his Tactical, added (0 where none names it). */
function theLevelsATitlesRowsAddToHisTacticalInABattle(theTitle: AMinorTitlesSlug): TheTacticalStage {
  return () =>
    SKILL_EXTRA_MINORS.reduce(
      (theLevels, [key, skills, delta, , scope]) =>
        key === theTitle && scope === 'battle' && skills.includes('tactical') ? theLevels + delta : theLevels,
      0,
    );
}

/** "strength: a hero's titles add to his Tactical": each title's levels from its rows. */
export const A_HEROS_TITLES_ADD_TO_HIS_TACTICAL = {
  strategist: theLevelsATitlesRowsAddToHisTacticalInABattle('strategist'),
} satisfies Partial<Record<AMinorTitlesSlug, TheTacticalStage>>;

/** The step a title's row makes on a unit its holder leads. */
function theStepATitlesRowMakes(theTitle: AMinorTitleWithAnArmyPerk): TheArmyStage {
  return (unit) => theStepAMinorTitlesArmyPerkMakesOnAUnit(theTitle, unit);
}

/** "strength: the commander's minor titles": each title's step from its row. */
export const THE_COMMANDERS_MINOR_TITLES_LIFT_THE_UNITS_HE_LEADS = {
  naturalist: theStepATitlesRowMakes('naturalist'),
  beastmaster: theStepATitlesRowMakes('beastmaster'),
  cavalier: theStepATitlesRowMakes('cavalier'),
  ironclad: theStepATitlesRowMakes('ironclad'),
} satisfies Record<AMinorTitleWithAnArmyPerk, TheArmyStage>;
