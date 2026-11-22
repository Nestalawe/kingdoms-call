// A hero's minor titles add to his skills in a personal combat (B-06, T7, the rules pulled out: its Reckoning and titles
// family, row B-06j): the effects of the stage "personalCombat: a hero's titles add to his skills", which
// pcCharCombatant asks for his Melee and his Archery (their raw levels too). The Duelist adds to his Melee, the Marksman
// to his Archery, the Widowmaker and the Relic-Hunter to both. Each reads its levels from its title's rows of the skills
// a title adds to at their point of use (content's SKILL_EXTRA_MINORS, scope 'combat': the rows the hero's card reads
// too, extraSkillBonuses); the runner is in the-registry-of-the-minor-titles-perks.ts. Who holds a title is the
// runner's caller's to say, as before. No effect draws a die.
import {
  SKILL_EXTRA_MINORS,
  type AMinorTitlesSlug,
} from '../../../content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheStage = TheStagesOfEachHookPoint['personalCombat']["a hero's titles add to his skills"];

/** The levels a title's rows of scope 'combat' add to the skill, added (0 where none names it). */
function theLevelsATitlesRowsAddInAPersonalCombat(theTitle: AMinorTitlesSlug): TheStage {
  return (theSkill) =>
    SKILL_EXTRA_MINORS.reduce(
      (theLevels, [key, skills, delta, , scope]) =>
        key === theTitle && scope === 'combat' && skills.includes(theSkill) ? theLevels + delta : theLevels,
      0,
    );
}

/** "personalCombat: a hero's titles add to his skills": each title's levels from its rows. */
export const A_HEROS_TITLES_ADD_TO_HIS_SKILLS = {
  duelist: theLevelsATitlesRowsAddInAPersonalCombat('duelist'),
  marksman: theLevelsATitlesRowsAddInAPersonalCombat('marksman'),
  widowmaker: theLevelsATitlesRowsAddInAPersonalCombat('widowmaker'),
  relichunter: theLevelsATitlesRowsAddInAPersonalCombat('relichunter'),
} satisfies Partial<Record<AMinorTitlesSlug, TheStage>>;
