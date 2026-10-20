// ── How many spells of one school a hero may cast (plan P1-11a1) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). These are the two casting limits, by the hero's effective level in the school.

/** Action spells of one school a hero may cast in a turn, by his effective level in it: 1 at level 1 or 2, 2 at
 *  level 3, 3 at level 4 or more (AK rules). The Warlock's extra cast in his best school is added by the caller. */
export function actionSpellsAllowedPerSchoolEachTurn(level: number): number {
  return level >= 4 ? 3 : level >= 3 ? 2 : 1;
}

/** Combat spells of one school a hero may cast in one personal combat, by his level in it: 1 at level 1, 2 at
 *  level 2 or more. */
export function combatSpellsAllowedPerSchoolEachFight(level: number): number {
  return level >= 2 ? 2 : 1;
}
