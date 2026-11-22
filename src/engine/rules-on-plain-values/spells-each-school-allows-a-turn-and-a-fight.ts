// ── How many spells of one school a hero may cast (plan P1-11a1; the Warlock's extra cast, P1-23s; the Grand
// Cathedral's free Bless, P1-23ad) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). These are the two casting limits, by the hero's effective level in the school, and the one rule
// of a school's action spells a turn with the Warlock's extra cast (R-123), which the Cast Spell order, the bots' order
// check and the order form ask (the form through src/shared/; since B-06l, T7, the extra cast is the Warlock's row's,
// and the Cast Spell order asks the minor titles' registry for it); and whether a spell costs its caster no slot at all
// (R-124), which the spells' registry and the order form ask.
import { KC_MAGIC_SCHOOLS } from '../../content/kingdoms-call-data.ts';
import {
  MINOR_TITLES,
  type AMinorTitleAsItsRowWritesIt,
  type AMinorTitlesSlug,
} from '../../content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import {
  SPELL_EFFECTS_THE_REGISTRY_HOLDS,
  type ASpellAsItsTextsWriteIt,
} from '../../content/spell-effects-their-names-numbers-and-words.ts';

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

/** The spells more of his best school a minor title's row lets its holder cast each turn (0 where its row names none). */
export function theSpellsMoreAMinorTitlesRowLetsItsHolderCastInHisBestSchool(theTitle: AMinorTitlesSlug): number {
  const theRow: AMinorTitleAsItsRowWritesIt | undefined = MINOR_TITLES.find((row) => row.key === theTitle);
  return theRow?.theSpellsMoreItsHolderMayCastInHisBestSchoolEachTurn ?? 0;
}

/** Action spells of one school a hero may cast in a turn (R-123): actionSpellsAllowedPerSchoolEachTurn at his
 *  effective level in it, and the casts his minor titles add if it is his best school (his trained level in it is his
 *  highest in any school: each school tied for it counts). The Cast Spell order hands the casts the minor titles'
 *  registry gives (the Warlock's row: one); the bots and the order form say whether he holds the Warlock
 *  (actionSpellsAHeroMayCastInASchoolEachTurn). */
export function actionSpellsAHeroMayCastInASchoolEachTurnWithTheCastsHisTitlesAdd(
  hero: AHeroAsTheWarlocksRuleReadsHim | null | undefined,
  school: string,
  hisEffectiveLevelInTheSchool: number,
  theCastsHisTitlesAddInHisBestSchool: number,
): number {
  const hisBestSchool = hisTrainedLevel(hero, school) === theHighestLevelAHeroHasTrainedInAMagicSchool(hero);
  return (
    actionSpellsAllowedPerSchoolEachTurn(hisEffectiveLevelInTheSchool) +
    (hisBestSchool ? theCastsHisTitlesAddInHisBestSchool : 0)
  );
}

/** Action spells of one school a hero may cast in a turn, as the bots and the order form ask it, saying whether he
 *  holds the Warlock's minor title: the casts added are then the Warlock's row's (the one title whose row names them: a
 *  unit case), else none. */
export function actionSpellsAHeroMayCastInASchoolEachTurn(
  hero: AHeroAsTheWarlocksRuleReadsHim | null | undefined,
  school: string,
  hisEffectiveLevelInTheSchool: number,
  heHoldsTheWarlocksTitle: boolean,
): number {
  return actionSpellsAHeroMayCastInASchoolEachTurnWithTheCastsHisTitlesAdd(
    hero,
    school,
    hisEffectiveLevelInTheSchool,
    heHoldsTheWarlocksTitle
      ? MINOR_TITLES.reduce(
          (theCasts, row) => theCasts + theSpellsMoreAMinorTitlesRowLetsItsHolderCastInHisBestSchool(row.key),
          0,
        )
      : 0,
  );
}

/** Whether the spell named costs its caster no casting slot (R-124): never counted among his casts of its school, nor
 *  ever blocked by them. So it is where its row in the content says a Grand Cathedral frees its slot
 *  (`asAnOrder.aGrandCathedralFreesItsSlot`: Bless Province) and the caster's realm's Grand Cathedral stands. A name with
 *  no row costs a slot. */
export function theSpellCostsItsCasterNoCastingSlot(
  theSpellsName: string,
  theCastersRealmHasAGrandCathedral: boolean,
): boolean {
  const everyRow: readonly ASpellAsItsTextsWriteIt[] = Object.values(SPELL_EFFECTS_THE_REGISTRY_HOLDS);
  const row = everyRow.find((r) => r.name === theSpellsName);
  return theCastersRealmHasAGrandCathedral && row?.asAnOrder?.aGrandCathedralFreesItsSlot === true;
}

/** Combat spells of one school a hero may cast in one personal combat, by his level in it: 1 at level 1, 2 at
 *  level 2 or more. */
export function combatSpellsAllowedPerSchoolEachFight(level: number): number {
  return level >= 2 ? 2 : 1;
}
