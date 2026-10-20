// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
// ── A game's settings, read from its games row (plan P1-11a3) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
export function gameMetaOf(game) {
  if (!game || game.meta == null) return null;
  try {
    const m = typeof game.meta === 'string' ? JSON.parse(game.meta) : game.meta;
    return m && typeof m === 'object' && m.v ? m : null;
  } catch (e) {
    return null;
  }
}
