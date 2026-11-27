// Whether a hero's Invisibility hides him now (R-158): the spell holds for the turn it was cast (its stamp, `_invisTurn`,
// names that turn), but it has no effect while he leads armies. The spell waits: the moment he leads none it hides him,
// until it would have ended; a hidden hero who takes up an army is seen from that moment. Every test of whether
// Invisibility hides a hero (the sight rule, the orders that pick a target, the warnings, the bots) reads it here.

/** A hero as this reads him: the turn his Invisibility holds for, and the companies he leads. */
export interface AHeroAsHisInvisibilityIsRead {
  readonly _invisTurn?: number | null | undefined;
  readonly armies?: readonly unknown[] | null | undefined;
}

/** Whether a hero's Invisibility hides him in `turn`: it holds for that turn and he leads no armies now. */
export function theHerosInvisibilityHidesHimNow(ch: AHeroAsHisInvisibilityIsRead, turn: number): boolean {
  return ch._invisTurn === turn && (ch.armies ?? []).length === 0;
}
