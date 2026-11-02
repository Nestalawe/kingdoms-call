// ── How many spells of one school a hero may cast (plan P1-11a1; the Warlock's extra cast, P1-23s) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). These are the two casting limits, by the hero's effective level in the school, and the one rule
// of a school's action spells a turn with the Warlock's extra cast (R-123), which the Cast Spell order, the bots' order
// check and the order form ask (the form through src/shared/).
import { KC_MAGIC_SCHOOLS } from '../../content/kingdoms-call-data.ts';

/** Action spells of one school a hero may cast in a turn, by his effective level in it: 1 at level 1 or 2, 2 at
 *  level 3, 3 at level 4 or more (AK rules). The Warlock's extra cast is actionSpellsAHeroMayCastInASchoolEachTurn's. */
export function actionSpellsAllowedPerSchoolEachTurn(level: number): number {
  return level >= 4 ? 3 : level >= 3 ? 2 : 1;
}

/** A hero as the Warlock's rule reads him: his trained level in each skill, by its name (the saved hero's `skills`, and
 *  the report's). */
export interface AHeroAsTheWarlocksRuleReadsHim {
  readonly skills?: Readonly<Record<string, number | undefined>> | null | undefined;
}
/** A hero's trained level in a skill, 0 to 9 (as the engine's skillLevel reads it). */
const hisTrainedLevel = (hero: AHeroAsTheWarlocksRuleReadsHim | null | undefined, skill: string): number =>
  Math.max(0, Math.min(9, Number(hero?.skills?.[skill]) || 0));

/** The highest level a hero has trained in any magic school (0: none): the Warlock title's measure, and the level of
 *  his best school. */
export function theHighestLevelAHeroHasTrainedInAMagicSchool(
  hero: AHeroAsTheWarlocksRuleReadsHim | null | undefined,
): number {
  return Math.max(0, ...KC_MAGIC_SCHOOLS.map((school) => hisTrainedLevel(hero, school)));
}

/** Action spells of one school a hero may cast in a turn (R-123): actionSpellsAllowedPerSchoolEachTurn at his
 *  effective level in it, and one more if he holds the Warlock's minor title and it is his best school (his trained
 *  level in it is his highest in any school: each school tied for it counts). */
export function actionSpellsAHeroMayCastInASchoolEachTurn(
  hero: AHeroAsTheWarlocksRuleReadsHim | null | undefined,
  school: string,
  hisEffectiveLevelInTheSchool: number,
  heHoldsTheWarlocksTitle: boolean,
): number {
  const hisBestSchool = hisTrainedLevel(hero, school) === theHighestLevelAHeroHasTrainedInAMagicSchool(hero);
  return (
    actionSpellsAllowedPerSchoolEachTurn(hisEffectiveLevelInTheSchool) +
    (heHoldsTheWarlocksTitle && hisBestSchool ? 1 : 0)
  );
}

/** Combat spells of one school a hero may cast in one personal combat, by his level in it: 1 at level 1, 2 at
 *  level 2 or more. */
export function combatSpellsAllowedPerSchoolEachFight(level: number): number {
  return level >= 2 ? 2 : 1;
}
