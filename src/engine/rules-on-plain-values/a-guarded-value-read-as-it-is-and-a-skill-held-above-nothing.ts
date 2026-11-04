// ── A guarded value read as it is, and a skill held above nothing (plan P1-13m) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). Two one-line readers the engine's orders, battles and fights and the reports' views all use:
// the first leaves a value as it is for a guard that may find it missing; the second keeps a hero's skills held above
// 0 (the hire's line, the espionage orders' skill lists and the reports' skill lines).

/** A value where the code guards it as if it may be missing (a narrative, a foe or a status no caller leaves out
 *  today), read as it is: the guard stays, and the value keeps its type where the code reads it unguarded. */
export function asItsGuardReadsIt<Value>(value: Value): Value | null | undefined {
  return value;
}

/** A skill held above 0, as the hire's line copies it (`v > 0`, as before: a level missing is not). */
export function aLevelAboveNothing(skill: [string, number | undefined]): skill is [string, number] {
  return Number(skill[1]) > 0;
}
