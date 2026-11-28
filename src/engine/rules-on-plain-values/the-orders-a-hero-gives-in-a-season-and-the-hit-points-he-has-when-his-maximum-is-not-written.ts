// ── The orders a hero gives in a season, and the hit points he has when his maximum is not written ────
// Two plain numbers the bots (and the engine's own code) write as bare literals. One home each, in a leaf module
// (it imports nothing), so the engine and the bots can both import them.

/** A hero gives five orders a season, one a phase: the length of every order list, and the phases a plan fills. */
export const THE_ORDERS_A_HERO_GIVES_IN_A_SEASON = 5;

/** The phases of a season, by index: 0 to the last. */
export const THE_PHASES_OF_A_SEASON: readonly number[] = Array.from(
  { length: THE_ORDERS_A_HERO_GIVES_IN_A_SEASON },
  (_, phase) => phase,
);

/** The hit points a hero has when no maximum is written on him (`maxHp` missing or 0): 20 is the bots' and the
 *  engine's fallback today, pending question 178 (a new hero starts at 15). */
export const THE_HIT_POINTS_A_HERO_HAS_WHEN_HIS_MAXIMUM_IS_NOT_WRITTEN = 20;
