// ── A number shown to a player, rounded down (plan P1-11a3) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
// dispFloor: every number a player is shown is rounded toward zero, and a float a hair under an integer snaps to
// it. Why, with the dice it is shown beside: fmtRoll and pctRoll, engine/dice-and-army-names.ts.
export function dispFloor(v: unknown): number {
  const n = Number(v) || 0;
  const r = Math.round(n);
  return Math.abs(n - r) < 1e-9 ? r : Math.trunc(n);
}
