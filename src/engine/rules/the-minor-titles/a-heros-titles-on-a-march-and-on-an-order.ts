// A hero's minor titles on a march and on an order (B-06, T7, the rules pulled out: its Reckoning and titles family,
// row B-06l): the effects of a stage of `movementCost`, one of `orderValidity` and four of `orderOutcome`.
// - "movementCost: a hero's titles add to his move points" (computeMovePoolMax): the Swift adds his levels to the land
//   pool, the Sea-Wolf to the sea pool, from his title's rows of the skills a title adds to at their point of use
//   (content's SKILL_EXTRA_MINORS, scope 'move': March for the land pool, Naval for the sea's; the rows the hero's card
//   reads too, extraSkillBonuses).
// - "orderValidity: a hero's titles add to the casts he may make in his best school" (resolveCastSpellOrder): the
//   Warlock's casts, from his title's row, on plain values so the bots and the order form share it.
// - "orderOutcome: a hero's titles keep his spying unseen" (resolveSpyOrder, both places): the Shadow.
// - "orderOutcome: a hero's titles add to his Sage in research" (resolveResearchOrder): the Loreseeker's levels, from
//   his title's rows of SKILL_EXTRA_MINORS (scope 'order', Sage).
// - "orderOutcome: a hero's titles add to a rest's heal" (resolveRestOrder): the Colossus's hit points, from his row.
// - "orderOutcome: a hero's titles multiply the share of a province he maps" (resolveExploreOrder): the Trailblazer's
//   factor, from his row, on plain values so the order form shares it.
// The runners are in the-registry-of-the-minor-titles-perks.ts. Who holds a title is the runner's caller's to say, as
// before. No effect draws a die.
import {
  MINOR_TITLES,
  SKILL_EXTRA_MINORS,
  type AMinorTitleAsItsRowWritesIt,
  type AMinorTitlesSlug,
} from '../../../content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import { theSpellsMoreAMinorTitlesRowLetsItsHolderCastInHisBestSchool } from '../../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import { theFactorAMinorTitlesRowMultipliesTheShareItsHolderMapsBy } from '../../rules-on-plain-values/the-share-of-a-province-an-explore-order-maps.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheMoveStage = TheStagesOfEachHookPoint['movementCost']["a hero's titles add to his move points"];
type TheCastsStage =
  TheStagesOfEachHookPoint['orderValidity']["a hero's titles add to the casts he may make in his best school"];
type TheOrdersOutcome = TheStagesOfEachHookPoint['orderOutcome'];

/** The skill each pool's rows of scope 'move' name: March for the land pool, Naval for the sea's. */
const THE_SKILL_EACH_POOL_GOES_BY = { land: 'march', sea: 'naval' } as const;

/** The levels a title's rows of a scope add to a skill, added (0 where none names it). */
function theLevelsATitlesRowsAdd(theTitle: AMinorTitlesSlug, theScope: string, theSkill: string): number {
  return SKILL_EXTRA_MINORS.reduce(
    (theLevels, [key, skills, delta, , scope]) =>
      key === theTitle && scope === theScope && skills.includes(theSkill) ? theLevels + delta : theLevels,
    0,
  );
}

/** A title's row, read as its type writes it (each field it may name). */
function theRowOf(theTitle: AMinorTitlesSlug): AMinorTitleAsItsRowWritesIt | undefined {
  return MINOR_TITLES.find((row) => row.key === theTitle);
}

/** "movementCost: a hero's titles add to his move points": each title's levels from its rows of scope 'move'. */
export const A_HEROS_TITLES_ADD_TO_HIS_MOVE_POINTS = {
  swift: (thePool) => theLevelsATitlesRowsAdd('swift', 'move', THE_SKILL_EACH_POOL_GOES_BY[thePool]),
  seawolf: (thePool) => theLevelsATitlesRowsAdd('seawolf', 'move', THE_SKILL_EACH_POOL_GOES_BY[thePool]),
} satisfies Partial<Record<AMinorTitlesSlug, TheMoveStage>>;

/** "orderValidity: a hero's titles add to the casts he may make in his best school": the Warlock's row's. */
export const A_HEROS_TITLES_ADD_TO_THE_CASTS_HE_MAY_MAKE_IN_HIS_BEST_SCHOOL = {
  warlock: () => theSpellsMoreAMinorTitlesRowLetsItsHolderCastInHisBestSchool('warlock'),
} satisfies Partial<Record<AMinorTitlesSlug, TheCastsStage>>;

/** "orderOutcome: a hero's titles keep his spying unseen": the Shadow's spies are never detected. */
export const A_HEROS_TITLES_KEEP_HIS_SPYING_UNSEEN = {
  shadow: () => true,
} satisfies Partial<Record<AMinorTitlesSlug, TheOrdersOutcome["a hero's titles keep his spying unseen"]>>;

/** "orderOutcome: a hero's titles add to his Sage in research": the Loreseeker's levels from his rows of scope 'order'. */
export const A_HEROS_TITLES_ADD_TO_HIS_SAGE_IN_RESEARCH = {
  loreseeker: () => theLevelsATitlesRowsAdd('loreseeker', 'order', 'sage'),
} satisfies Partial<Record<AMinorTitlesSlug, TheOrdersOutcome["a hero's titles add to his Sage in research"]>>;

/** "orderOutcome: a hero's titles add to a rest's heal": the Colossus's row's hit points. */
export const A_HEROS_TITLES_ADD_TO_A_RESTS_HEAL = {
  colossus: () => theRowOf('colossus')?.theHitPointsItsHolderRecoversMoreWhenResting ?? 0,
} satisfies Partial<Record<AMinorTitlesSlug, TheOrdersOutcome["a hero's titles add to a rest's heal"]>>;

/** "orderOutcome: a hero's titles multiply the share of a province he maps": the Trailblazer's row's factor. */
export const A_HEROS_TITLES_MULTIPLY_THE_SHARE_OF_A_PROVINCE_HE_MAPS = {
  trailblazer: () => theFactorAMinorTitlesRowMultipliesTheShareItsHolderMapsBy('trailblazer'),
} satisfies Partial<
  Record<AMinorTitlesSlug, TheOrdersOutcome["a hero's titles multiply the share of a province he maps"]>
>;
