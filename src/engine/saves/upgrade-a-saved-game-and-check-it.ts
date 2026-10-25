// ── A SAVED GAME BROUGHT UP TO DATE (plan P1-15a, 2026-10-25) ────
// A running game's save holds what older builds wrote: its own copies of content, and shapes the code has since moved
// on from (docs/traps.md, "Live saves keep copies"). upgradeGameState brings it up to date, in one place, before the
// turn reads it: resolveTurn (src/engine/run-turn.ts) calls it on the save it has just parsed, before the turn's
// context is made. It runs the six passes the turn ran at its start, in the order the turn ran them; each is safe to
// repeat, and runs on every turn, so it also mends what the turn before wrote (a hero hired last turn gets his
// earned-HP pool):
//   1. migrateMaxHpV2: every living hero's maximum HP from his earned pool (a hero with no pool is given one, from his
//      maximum as the old formula set it), and the lairs' guardians re-read from their table when the save's table
//      version is behind (migrateLairGuardiansV2);
//   2. backfillHomeRosters: each realm's home recruits its people's full land roster, and a coastal home its fleet;
//   3. retireCorsairPools: no province offers the retired Corsair Fleet (the Galleon Fleet in its place);
//   4. retireDiscoveries: no realm holds a retired Sage discovery, and each held one reads as its table says now;
//   5. migrateLegacyUnitNames: the units and races renamed since are called by their names now;
//   6. migrateItemTiers: every item in a pack, a hoard or a vault has its tier from the item tables (until P1-15a the
//      turn ran it after the merge of the realms' orders; nothing between reads an item's tier).
// It draws no dice and writes no line. What it finds for the GM's log, it returns (WhatTheSavesUpgradeFound): the turn
// keeps it on the turn's context and tells it at the turn's end, as before, and the save keeps none of it.
// Still in the turn, not here (P1-15's second slice): the flagged passes before the first phase, the turn-start
// repairs, the reads that write an old save's missing field, and the readers of older shapes. ensureAllLairHoards
// stays in the turn: it draws dice every turn.
import type { GameState } from '../../schemas/saved-game-state.ts';
import { migrateLegacyUnitNames } from '../army-tables.ts';
import { retireCorsairPools } from '../grand-design.ts';
import { backfillHomeRosters } from '../world/tables.ts';
import { migrateItemTiers } from '../items/equipment.ts';
import { migrateMaxHpV2, retireDiscoveries } from '../heroes/skills-and-hp.ts';

/** A hero of a save from before the earned-HP pool, carried over to it by the first upgrade: his realm is told at the
 *  turn's end. His id and his realm's index (plain numbers, as the turn's context keeps them); `old`, his maximum HP as
 *  the old formula set it; `nu`, his maximum now. */
export interface AHeroCarriedOverToTheEarnedHpPool {
  charId: number;
  player: number;
  old: number;
  nu: number;
}

/** What the upgrade found, for the GM's log at the turn's end. */
export interface WhatTheSavesUpgradeFound {
  /** How many retired Sage discoveries it took from the realms (retireDiscoveries). */
  retiredSageDiscoveriesRemoved: number;
  /** The heroes it carried over to the earned-HP pool (migrateMaxHpV2, on a save from before the pool only). */
  heroesCarriedOverToTheEarnedHpPool: AHeroCarriedOverToTheEarnedHpPool[];
}

/** The save as the passes leave it: two of them count what they mend on it, and the upgrade takes the counts off. */
type TheSaveWithThePassesCounts = GameState & {
  _retiredDiscoveries?: number | undefined;
  _maxHpMigration?: AHeroCarriedOverToTheEarnedHpPool[] | undefined;
};

/** Brings the save, as parsed, up to date, in place, and returns what it found. */
export function upgradeGameState(save: TheSaveWithThePassesCounts): WhatTheSavesUpgradeFound {
  migrateMaxHpV2(save); // Sept 2026 redesign: derived max HP (one-time recompute for older saves, silent resync otherwise)
  backfillHomeRosters(save); // home provinces recruit the king's full racial land roster
  retireCorsairPools(save); // 2026-10-15 (D3): no province offers the retired Corsair Fleet
  retireDiscoveries(save); // strip retired Sage discovery ids (sd34) from live saves
  migrateLegacyUnitNames(save); // pre-2026.09.06 unit-type strings → current names (idempotent)
  migrateItemTiers(save); // re-stamp saved items with their tier under the four-tier scheme
  const found = {
    retiredSageDiscoveriesRemoved: save._retiredDiscoveries ?? 0,
    heroesCarriedOverToTheEarnedHpPool: save._maxHpMigration ?? [],
  };
  delete save._retiredDiscoveries;
  delete save._maxHpMigration;
  return found;
}
