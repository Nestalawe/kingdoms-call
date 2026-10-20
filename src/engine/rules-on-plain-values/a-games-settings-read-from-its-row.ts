// ── A game's settings, read from its games row (plan P1-11a3) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
/** A game's settings: the set-up phase's config (bots, visibility, …), marked by its version `v`. */
export type GameSettings = Readonly<Record<string, unknown>>;
/** A games row as gameMetaOf reads one: its `meta` column, JSON or already parsed. */
export interface GamesRowWithSettings {
  readonly meta?: unknown;
}
export function gameMetaOf(game: GamesRowWithSettings | null | undefined): GameSettings | null {
  if (!game || game.meta == null) return null;
  try {
    const m = typeof game.meta === 'string' ? JSON.parse(game.meta) : game.meta;
    return m && typeof m === 'object' && m.v ? m : null;
  } catch (e) {
    return null;
  }
}
