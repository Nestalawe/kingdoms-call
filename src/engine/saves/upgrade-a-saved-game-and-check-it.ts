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
// Then the save's version (P1-15c): a save holds its shape's number at its top level, schemaVersion (a save without
// one is version 0: every save from before P1-15c). A save from a newer build is refused first, before anything
// changes (an open GM page of an older build mustn't run a turn on a shape it doesn't know); then, after the six
// passes, each numbered step whose version is above the save's runs once, and the save is stamped with its version.
// World generation writes the version this build writes on a new world (src/engine/world/generate.ts), so a new
// world needs no step; the number is in a file of its own (the-saved-games-version-this-build-writes.ts).
// A save that isn't a game in play (no provinces, no realms, no list of heroes: the new game's settings, before Turn
// 0, say) is refused first too, before anything changes.
// Then the check (P1-15d, Decision 4): the save, upgraded, parsed against the saved state's schema made strict
// (src/schemas/where-a-saved-game-differs-from-this-builds-schema.ts), which names each place it differs by its path
// and its kind, never a value. The check is not the save: the turn plays the save as upgraded, every key kept, never
// the parse's output (docs/traps.md). A save that differs still plays (Theo's Choice 1, "tell now, stop later"): the
// turn's end tells the GM in the GM's log alone, and the turn's message (src/ui/gm/turn-shell.ts) says it too.
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
import { THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES } from './the-saved-games-version-this-build-writes.ts';
import { whereASavedGameDiffersFromThisBuildsSchema } from '../../schemas/where-a-saved-game-differs-from-this-builds-schema.ts';

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
  /** Where the save, upgraded, differs from the saved state's schema made strict (the check): one line each, its path
   *  and its kind, never a value (`characters.17.armies.2: a field this build doesn't know, _flakTargeted`); none if
   *  it matches. The turn's end tells the GM (what-the-saves-check-found-in-words.ts). */
  whereTheSaveDiffersFromThisBuildsSchema: string[];
}

/** The save as the passes leave it: two of them count what they mend on it, and the upgrade takes the counts off. */
type TheSaveWithThePassesCounts = GameState & {
  _retiredDiscoveries?: number | undefined;
  _maxHpMigration?: AHeroCarriedOverToTheEarnedHpPool[] | undefined;
};

/** A numbered step of the upgrade: it mends a save below its version into that version's shape, once. Each stays safe
 *  to repeat, as the passes are. */
interface ANumberedStepOfTheUpgrade {
  /** The version a save is at once the step has run. */
  version: number;
  /** Mends the save, in place, from the shape of the version before into this one's. */
  upgrade: (save: GameState) => void;
}

/** The numbered steps, in order, the last one's version THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES: a change to the saved state's shape that an older save can't meet as it is (a field
 *  renamed, moved, retyped, or now required) adds one, with a fixture of its version (tests/fixtures/saves/, made by
 *  tools/saves/make-a-save-fixture-from-a-seeded-bot-game.ts) and the schema's change (CLAUDE.md, "Changes"). */
export const THE_NUMBERED_STEPS_OF_THE_UPGRADE: readonly ANumberedStepOfTheUpgrade[] = [
  // Version 1 (P1-15c, 2026-10-25): the shape the six passes leave, which every save had when the version came in.
  // The step is the stamp alone.
  { version: 1, upgrade: () => undefined },
];

/** The version a save says it is at: 0 for a save from before the version came in, which holds none. */
const theVersionOf = (save: { readonly schemaVersion?: number | undefined }): number => save.schemaVersion ?? 0;

/** Whether `save` holds a list at `key` with something in it (or, with `mayBeEmpty`, a list at all). */
function holdsAList(holder: unknown, key: string, mayBeEmpty = false): boolean {
  if (typeof holder !== 'object' || holder === null) return false;
  const list: unknown = Reflect.get(holder, key);
  return Array.isArray(list) && (mayBeEmpty || list.length > 0);
}

/** Throws, before anything changes, on a save that isn't a game in play: no provinces, no realms, or no list of heroes
 *  (the new game's settings, before Turn 0; a save cut short). Read as it was loaded, whatever its type says. */
function refuseASaveThatIsNotAGameInPlay(save: unknown): void {
  const world: unknown = typeof save === 'object' && save !== null ? Reflect.get(save, 'world') : undefined;
  if (!holdsAList(world, 'provinces') || !holdsAList(save, 'players') || !holdsAList(save, 'characters', true))
    throw new Error(
      "This game's save holds no game in play (no provinces, realms or list of heroes), so no turn can run on it. " +
        'Nothing was changed.',
    );
}

/** Throws, before anything changes, on a save from a newer build than this one: its shape is one this build doesn't
 *  know (the turn's shell puts the realms' orders back, as for any save it can't read). */
function refuseASaveFromANewerBuild(save: GameState): void {
  const version = theVersionOf(save);
  if (version > THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES)
    throw new Error(
      `This game was saved by a newer version of Kingdoms Call (save version ${String(version)}; this page knows ` +
        `${String(THE_SAVED_GAMES_VERSION_THIS_BUILD_WRITES)}). Reload this page.`,
    );
}

/** Brings the save, as parsed, up to date, in place, checks it, and returns what it found. Throws on a save that
 *  isn't a game in play or is from a newer build, before anything changes. */
export function upgradeGameState(save: TheSaveWithThePassesCounts): WhatTheSavesUpgradeFound {
  refuseASaveThatIsNotAGameInPlay(save);
  refuseASaveFromANewerBuild(save);
  migrateMaxHpV2(save); // Sept 2026 redesign: derived max HP (one-time recompute for older saves, silent resync otherwise)
  backfillHomeRosters(save); // home provinces recruit the king's full racial land roster
  retireCorsairPools(save); // 2026-10-15 (D3): no province offers the retired Corsair Fleet
  retireDiscoveries(save); // strip retired Sage discovery ids (sd34) from live saves
  migrateLegacyUnitNames(save); // pre-2026.09.06 unit-type strings → current names (idempotent)
  migrateItemTiers(save); // re-stamp saved items with their tier under the four-tier scheme
  const retiredSageDiscoveriesRemoved = save._retiredDiscoveries ?? 0;
  const heroesCarriedOverToTheEarnedHpPool = save._maxHpMigration ?? [];
  delete save._retiredDiscoveries;
  delete save._maxHpMigration;
  for (const step of THE_NUMBERED_STEPS_OF_THE_UPGRADE) {
    if (theVersionOf(save) >= step.version) continue;
    step.upgrade(save);
    save.schemaVersion = step.version;
  }
  // the check, last: what it finds is told; the save stays as upgraded (its parse's output is never used)
  const whereTheSaveDiffersFromThisBuildsSchema = whereASavedGameDiffersFromThisBuildsSchema(save);
  return { retiredSageDiscoveriesRemoved, heroesCarriedOverToTheEarnedHpPool, whereTheSaveDiffersFromThisBuildsSchema };
}
