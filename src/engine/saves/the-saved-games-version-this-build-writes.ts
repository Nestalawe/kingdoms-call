// ── THE SAVED GAME'S VERSION (plan P1-15c, 2026-10-25) ────
// The number of the saved state's shape this build writes on a new world (src/engine/world/generate.ts) and stamps on
// an upgraded save, and the newest it can read: the version of the upgrade's last numbered step
// (src/engine/saves/upgrade-a-saved-game-and-check-it.ts; tests/unit/every-save-fixture-upgrades-parses-and-plays-a-
// turn.test.ts checks they agree, and that a fixture of each version is kept). A file of its own, importing nothing,
// so world generation reads it without loading the upgrade's passes.

/** The version of the saved state's shape this build writes, and the newest it can read. */
export const THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES = 1;
