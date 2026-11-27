// A unit the pools no longer offer, and the unit that stands in for it (plan P1-15f4; the saves tranche's Decision 6): the
// Corsair Fleet left the pools on 2026-10-15 (Toby, D3; R-109), and a province of a game already running whose pool still
// offers it offers the Galleon Fleet in its place (src/engine/saves/retire-the-corsair-pools.ts reads this row, as
// migrateLegacyUnitNames reads LEGACY_UNIT_RENAMES). A Corsair company already raised fights as a plain fleet, with no
// ability of its own (R-147). Nothing on the player page reads it: its own files name no retired unit
// (tests/static/no-book-or-player-portal-text-names-the-corsairs-and-letters-of-marque-lifts-the-galleons.test.ts).

/** The retired Corsair Fleet, and the Galleon Fleet a province offers in its place. */
export const THE_CORSAIR_FLEET_RETIRED_FROM_THE_POOLS = {
  retired: 'Corsair Fleet',
  inItsPlace: 'Galleon Fleet',
} as const;
