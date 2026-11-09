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
//   2. each realm of an older save without a home given one, its first province, else its king's place (P1-15f3: until
//      then homeProvinceIdFor wrote it on its first read, which this pass made), then backfillHomeRosters: each realm's
//      home recruits its people's full land roster, and a coastal home its fleet;
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
// It writes no line, and draws no dice but an old world's lairs' renaming (its names, from the turn's dice; no save
// that has played a turn since _lairNamesV3 came lacks it). What it finds for the GM's log, it returns
// (WhatTheSavesUpgradeFound): the turn keeps it on the turn's context and tells it where it did before, and the save
// keeps none of it.
// After the six, the three old flags' passes (P1-15f1; until then the turn ran them before the bots plan, after the
// merge of the realms' orders, the lair hoards and the bots' first diplomacy; none of those reads what they change),
// with the guardians' words beside them:
//   7. an old world's lairs renamed once, each from its own guardian's pools (renameLairsThematicP, behind _lairNamesV3;
//      world generation names a new world's so and sets the flag);
//   8. an old world's guardians made 5 HP frailer once, their undamaged HP too, never below 5 (behind _guardianHpV2,
//      which world generation doesn't set: a new world's guardians are cut on its first turn, question 17, P1-23l);
//   9. every guardian's brute strength given its kind's words (P1-11e1, R-137), with no flag: a perk already in them
//      is left untouched;
//   10. the retired Library (sd30) struck from every realm's discoveries, with any gap in the list.
// Each runs on every load behind its flag, as in the turn, not as a numbered step (P1-15's Decision 2): a numbered
// step would skip a new world, and the guardians' cut would stop for new games, which is a rule's change. How many
// lairs it renamed and guardians it cut, it returns: the turn tells the GM where it did.
// After the check, the four turn-start repairs (P1-15f2; until then the turn ran them once the realms' flags were
// stamped, before the merge of the realms' orders), so the check still sees the save as loaded (a leaked hull marker
// is still named). They also mend what today's code may leave:
//   11. a hero of no realm wearing a beast's race (Monster, Creature) given a people's race, by his id;
//   12. a neutral guard who leads no companies, or stands in a realm's land, made a wanderer (normaliseStrandedGuards);
//   13. no garrison company carries a stranded hull's marker (_navalHold, a within-phase flag) into the turn;
//   14. a hero in a realm's service loses his " (wandering)" tag (normaliseOwnedNames): how many, it returns, and the
//       turn keeps the count on the save where it did (_nameRepairs), for the turn's end to tell.
// Then, after the check too (so it still names an old field), three reads that wrote an older save's missing field
// (P1-15f3; until then each reader wrote it on its first read in the turn, and now only reads):
//   15. a realm's single consecrated province (consecratedProvId) folded into its list (consecratedIds still gives a
//       realm with no list an empty one: a new game's realms hold none until then);
//   16. a realm's tally of the items it found under the retired Consumable slot folded into the Combat Item's;
//   17. a feature an older save discovered for everyone, with no list of who discovered it, known to every realm
//       (_legacyAll) and given an empty list.
// Still in the turn, not here (P1-15's second slice): the readers of older shapes. ensureAllLairHoards stays in the
// turn: it draws dice every turn.
import type { GameState } from '../../schemas/saved-game-state.ts';
import { migrateLegacyUnitNames } from '../army-tables.ts';
import { theHomeARealmWithoutOneIsGiven } from '../grand-design.ts';
import { retireCorsairPools } from './retire-the-corsair-pools.ts';
import { RACES_P, backfillHomeRosters } from '../world/tables.ts';
import { normaliseOwnedNames, normaliseStrandedGuards } from '../heroes/fame-and-consecration.ts';
import { migrateItemTiers } from '../items/equipment.ts';
import { migrateMaxHpV2, retireDiscoveries } from '../heroes/skills-and-hp.ts';
import { renameLairsThematicP } from '../names.ts';
import { GUARDIAN_PERKS_THE_REGISTRY_HOLDS } from '../../content/guardian-perks-their-kinds-numbers-and-words.ts';
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
   *  it matches. The turn's end tells the GM (views/prose/what-the-saves-check-found-in-words.ts). */
  whereTheSaveDiffersFromThisBuildsSchema: string[];
  /** How many lairs of an old world it renamed (renameLairsThematicP, behind _lairNamesV3): told to the GM before the
   *  bots plan. */
  lairsRenamed: number;
  /** How many guardians of an old world it made 5 HP frailer (behind _guardianHpV2): told to the GM before the bots
   *  plan. */
  guardiansCut: number;
  /** How many heroes in a realm's service it took the " (wandering)" tag off (normaliseOwnedNames, after the check):
   *  the turn keeps it on the save (_nameRepairs), and its end tells the GM. */
  heroesInARealmsServiceWhoseWanderingTagWasTakenOff: number;
}

/** A guardian as the guardians' cut reads it: an old world's may hold no HP, or no undamaged HP. */
interface AGuardianAsTheCutReadsIt {
  hp?: number | null | undefined;
  _hpFull?: number | null | undefined;
}
/** A save as the guardians' cut reads it: a gap among the provinces or the features is passed over. */
interface ASaveAsTheGuardiansCutReadsIt {
  readonly world?:
    | {
        readonly provinces?:
          | readonly (
              | {
                  readonly features?:
                    | readonly (
                        | {
                            readonly ritualSite?: boolean | undefined;
                            readonly monster?: AGuardianAsTheCutReadsIt | null | undefined;
                          }
                        | null
                        | undefined
                      )[]
                    | null
                    | undefined;
                }
              | null
              | undefined
            )[]
          | null
          | undefined;
      }
    | null
    | undefined;
  _guardianHpV2?: boolean | undefined;
}

/** EVERY GUARDIAN IS 5 HP FRAILER. The table was re-statted, but a live world keeps its own copy of each guardian on
 *  the feature (and `_hpFull`, the undamaged total a guardian is restored to between fights), so the table change
 *  alone would never reach a game in progress. One flagged, idempotent pass brings existing worlds into line. Floored
 *  at 5 so nothing is ever reduced to a guardian that cannot fight. A ritual site's keeper is left as it is. Returns
 *  how many guardians with HP it cut (0 once the flag is set). */
function everyGuardianOfAnOldWorldFiveHpFrailer(save: ASaveAsTheGuardiansCutReadsIt): number {
  if (save._guardianHpV2) return 0;
  let cut = 0;
  (save.world?.provinces ?? []).forEach((p) => {
    (p?.features ?? []).forEach((f) => {
      if (!f || f.ritualSite || !f.monster) return;
      if (f.monster.hp != null) {
        f.monster.hp = Math.max(5, f.monster.hp - 5);
        cut++;
      }
      if (f.monster._hpFull != null) f.monster._hpFull = Math.max(5, f.monster._hpFull - 5);
    });
  });
  save._guardianHpV2 = true;
  return cut;
}

/** A guardian's perk as the brute strength's words read it: an old save's list may hold a gap. */
interface AGuardiansPerkAsItsWordsReadIt {
  readonly fx?: unknown;
  desc?: string | undefined;
}
/** A save as the brute strength's words read it: a gap among the provinces, features or perks is passed over. */
interface ASaveAsTheBruteStrengthsWordsReadIt {
  readonly world?:
    | {
        readonly provinces?:
          | readonly (
              | {
                  readonly features?:
                    | readonly (
                        | {
                            readonly monster?:
                              | {
                                  readonly passives?:
                                    readonly (AGuardiansPerkAsItsWordsReadIt | null | undefined)[] | null | undefined;
                                }
                              | null
                              | undefined;
                          }
                        | null
                        | undefined
                      )[]
                    | null
                    | undefined;
                }
              | null
              | undefined
            )[]
          | null
          | undefined;
      }
    | null
    | undefined;
}
const BRUTE_STRENGTH = GUARDIAN_PERKS_THE_REGISTRY_HOLDS['brute-strength'];
/** A GUARDIAN'S BRUTE STRENGTH READS AS IT FIGHTS (R-137, question 34). A live world keeps its own copy of each
 *  guardian's perks, their words with them, so the kind's words changed in content reach a game in progress only here:
 *  each perk of the kind (its rider alone, a number) is given the kind's words with its number, on every load; a perk
 *  already in them is left untouched, so a new world's, which holds the table's own, is never written. Its other perks
 *  keep their words. An old save's single `passive` is not read: it is held only below the guardians' table version
 *  20, and the re-read (migrateLairGuardiansV2, in the first pass) has replaced it with the table's `passives`. */
function everyGuardiansBruteStrengthInTheWordsOfItsKind(save: ASaveAsTheBruteStrengthsWordsReadIt): void {
  const { rider } = BRUTE_STRENGTH.carriedAs;
  (save.world?.provinces ?? []).forEach((p) => {
    (p?.features ?? []).forEach((f) => {
      (f?.monster?.passives ?? []).forEach((perk) => {
        if (!perk) return;
        const fx: unknown = perk.fx;
        if (typeof fx !== 'object' || fx === null || Object.keys(fx).join() !== rider) return;
        const n: unknown = Reflect.get(fx, rider);
        if (typeof n !== 'number') return;
        const words = BRUTE_STRENGTH.itsWords.replaceAll('{N}', String(n));
        if (perk.desc !== words) perk.desc = words;
      });
    });
  });
}

/** Whether a held discovery is the retired Library (sd30). */
const isTheLibrary = (d: unknown): boolean => typeof d === 'object' && d !== null && Reflect.get(d, 'id') === 'sd30';
/** RETIRED DISCOVERIES: the Library (sd30) was removed from the game on 2026-09-09. Strike it from any realm that had
 *  already found it, so no live save keeps a dead entry on its sheet; a gap in a realm's list goes with it. */
function theLibraryStruckFromEveryRealm(save: {
  readonly players?: readonly ({ discoveries?: unknown[] | null | undefined } | null | undefined)[] | null | undefined;
}): void {
  (save.players ?? []).forEach((pl) => {
    if (pl && Array.isArray(pl.discoveries))
      pl.discoveries = pl.discoveries.filter((d) => Boolean(d) && !isTheLibrary(d));
  });
}

/** A hero as the beasts' races repair reads him: an old save's may hold no id. */
interface AHeroAsTheBeastsRaceRepairReadsHim {
  readonly id?: number | null | undefined;
  readonly player?: number | null | undefined;
  race?: string | null | undefined;
}
/** A NEUTRAL HERO WEARING A BEAST'S RACE. A defeated sea guard becomes a plain wandering hero (player null, no longer
 *  _isNeutralGuard) but keeps the 'Creature'/'Monster' pseudo-race it wore to label the beasts it once commanded, which
 *  then reads absurdly in the Wandering Heroes list ("Mira the Nomad (Monster, Neutral)"). Heroes are people; the
 *  monster class belongs to the armies. World generation gives every neutral hero a people's race, but a save made
 *  before that may hold neutral heroes, active guards included, wearing one: each is given a people's race, by his id
 *  (deterministic, so it never flickers turn to turn). The monster class stays on the armies they lead. */
function everyNeutralHeroWearingABeastsRaceGivenAPeoplesRace(save: {
  readonly characters?: readonly (AHeroAsTheBeastsRaceRepairReadsHim | null | undefined)[] | null | undefined;
}): void {
  (save.characters ?? []).forEach((c) => {
    if (c?.player === null && (c.race === 'Monster' || c.race === 'Creature')) {
      c.race = RACES_P[((((c.id ?? 0) || 0) % RACES_P.length) + RACES_P.length) % RACES_P.length];
    }
  });
}

/** THE STRANDED-HULL MARKER (2026-09-27, Toby) is a within-phase flag (see navalHeldIn). Every path that sets it clears
 *  it again, but a save written by an older build, or any future path that forgets, must not carry it into a fresh
 *  turn, where it would quietly hold units out of their own province's defence. One sweep, before the turn. */
function noGarrisonCompanyCarriesAStrandedHullsMarker(save: {
  readonly world?:
    | {
        readonly provinces?:
          | readonly (
              | {
                  readonly garrisonArmies?: readonly (object | null | undefined)[] | null | undefined;
                }
              | null
              | undefined
            )[]
          | null
          | undefined;
      }
    | null
    | undefined;
}): void {
  (save.world?.provinces ?? []).forEach((p) => {
    (p?.garrisonArmies ?? []).forEach((a) => {
      // a field the saved state's schema doesn't hold, read and taken off as it was loaded
      if (a && Reflect.get(a, '_navalHold') != null) Reflect.deleteProperty(a, '_navalHold');
    });
  });
}

/** A HOME FOR A REALM OF AN OLDER SAVE. A game saved before the home province existed holds no homeProvinceId; each
 *  such realm is given the home it would have had (theHomeARealmWithoutOneIsGiven: its first province, seeded with
 *  its capital at world generation, else its king's place), once, and then it is frozen, so the map's centre never
 *  drifts as land changes hands. A realm with neither keeps none. (Until P1-15f3 homeProvinceIdFor wrote it on its
 *  first read, which backfillHomeRosters made for every realm.) */
function everyRealmWithoutAHomeGivenOne(save: {
  readonly players?:
    | readonly (
        | { homeProvinceId?: number | null | undefined; readonly provinces?: readonly number[] | null | undefined }
        | null
        | undefined
      )[]
    | null
    | undefined;
  readonly characters?:
    | readonly { readonly player: number | null; readonly isKing: boolean; readonly location: number }[]
    | null
    | undefined;
}): void {
  (save.players ?? []).forEach((pl, pi) => {
    if (!pl || pl.homeProvinceId != null) return;
    const home = theHomeARealmWithoutOneIsGiven(save, pi);
    if (home != null) pl.homeProvinceId = home;
  });
}

/** A SINGLE CONSECRATION. A Divine realm may hold several consecrated provinces, as a list (consecratedProvIds); an
 *  older save held one, as consecratedProvId. A realm with the old field and no list has it folded into the list, and
 *  the old field taken off. (Until P1-15f3 consecratedIds folded it on its first read.) */
function theOldSingleConsecrationFoldedIntoTheList(save: {
  readonly players?:
    | readonly (
        { consecratedProvIds?: number[] | undefined; consecratedProvId?: number | null | undefined } | null | undefined
      )[]
    | null
    | undefined;
}): void {
  (save.players ?? []).forEach((pl) => {
    if (!pl || Array.isArray(pl.consecratedProvIds) || !('consecratedProvId' in pl)) return;
    pl.consecratedProvIds = pl.consecratedProvId != null ? [pl.consecratedProvId] : [];
    delete pl.consecratedProvId;
  });
}

/** THE OLD COMBAT TALLY. The Consumable slot became the Combat Item slot. An older save holds a realm's tally of the
 *  items it has found under the retired key; it is folded into the new one, so the even-distribution draw doesn't
 *  decide the realm has never found a combat item and flood it with them. (Until P1-15f3 migrateHoardTally folded it
 *  in both the tally's writer, noteItemFound, and its reader, rollMagicItemFor.) */
function theOldCombatTallyFoldedIntoTheNew(save: {
  readonly players?:
    | readonly (
        | {
            readonly _itemsFoundByCat?:
              { combat?: number | undefined; consumable?: number | undefined } | null | undefined;
          }
        | null
        | undefined
      )[]
    | null
    | undefined;
}): void {
  (save.players ?? []).forEach((pl) => {
    if (!pl?._itemsFoundByCat) return;
    const t = pl._itemsFoundByCat;
    if (t.consumable != null) {
      t.combat = (Number(t.combat) || 0) + t.consumable;
      delete t.consumable;
    }
  });
}

/** A FEATURE AN OLDER SAVE DISCOVERED FOR EVERYONE. Before discovery was kept realm by realm, a feature held
 *  `discovered` and no `discoveredBy`. Each such feature is grandfathered as known to every realm (_legacyAll) and
 *  given an empty list, so upgrading never takes knowledge away from a player. (Until P1-15f3 discoverFeat did it when
 *  a realm discovered the feature again.) */
function everyFeatureAnOlderSaveDiscoveredKnownToEveryRealm(save: {
  readonly world?:
    | {
        readonly provinces?:
          | readonly (
              | {
                  readonly features?:
                    | readonly (
                        | {
                            readonly discovered?: boolean | undefined;
                            discoveredBy?: number[] | undefined;
                            _legacyAll?: boolean | undefined;
                          }
                        | null
                        | undefined
                      )[]
                    | null
                    | undefined;
                }
              | null
              | undefined
            )[]
          | null
          | undefined;
      }
    | null
    | undefined;
}): void {
  (save.world?.provinces ?? []).forEach((p) => {
    (p?.features ?? []).forEach((f) => {
      if (f && !Array.isArray(f.discoveredBy) && f.discovered) {
        f._legacyAll = true;
        f.discoveredBy = [];
      }
    });
  });
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
  everyRealmWithoutAHomeGivenOne(save);
  backfillHomeRosters(save); // home provinces recruit the king's full racial land roster
  retireCorsairPools(save); // 2026-10-15 (D3): no province offers the retired Corsair Fleet
  retireDiscoveries(save); // strip retired Sage discovery ids (sd34) from live saves
  migrateLegacyUnitNames(save); // pre-2026.09.06 unit-type strings → current names (idempotent)
  migrateItemTiers(save); // re-stamp saved items with their tier under the four-tier scheme
  // LAIR NAMES v2: older worlds were named at random from per-terrain pools, so a guardian and its lair rarely matched
  // and 68 of 81 names were reused at different difficulties (which is what made lair and guardian show different
  // colours in the Chronicle). Re-name every lair once, from its own guardian's pools and uniquely. Idempotent: the
  // flag stops it ever running twice.
  const lairsRenamed = save._lairNamesV3 ? 0 : renameLairsThematicP(save);
  const guardiansCut = everyGuardianOfAnOldWorldFiveHpFrailer(save);
  everyGuardiansBruteStrengthInTheWordsOfItsKind(save);
  theLibraryStruckFromEveryRealm(save);
  const retiredSageDiscoveriesRemoved = save._retiredDiscoveries ?? 0;
  const heroesCarriedOverToTheEarnedHpPool = save._maxHpMigration ?? [];
  delete save._retiredDiscoveries;
  delete save._maxHpMigration;
  for (const step of THE_NUMBERED_STEPS_OF_THE_UPGRADE) {
    if (theVersionOf(save) >= step.version) continue;
    step.upgrade(save);
    save.schemaVersion = step.version;
  }
  // the check: what it finds is told; the save stays as upgraded (its parse's output is never used)
  const whereTheSaveDiffersFromThisBuildsSchema = whereASavedGameDiffersFromThisBuildsSchema(save);
  // the turn-start repairs, after the check (so it sees the save as loaded)
  everyNeutralHeroWearingABeastsRaceGivenAPeoplesRace(save);
  // any guard stranded troopless or inside a realm's province is the wanderer he really is, so the turn's move-in,
  // hire and sightings treat him so (this also heals saves carrying the pre-fix case)
  normaliseStrandedGuards(save);
  noGarrisonCompanyCarriesAStrandedHullsMarker(save);
  // the ' (wandering)' tag off anyone who now serves a crown: heals live games whose heroes were charmed or
  // resurrected into service before those paths were fixed
  const heroesInARealmsServiceWhoseWanderingTagWasTakenOff = normaliseOwnedNames(save);
  // the reads that wrote an older save's missing field (P1-15f3: the readers now only read), after the check as well
  theOldSingleConsecrationFoldedIntoTheList(save);
  theOldCombatTallyFoldedIntoTheNew(save);
  everyFeatureAnOlderSaveDiscoveredKnownToEveryRealm(save);
  return {
    retiredSageDiscoveriesRemoved,
    heroesCarriedOverToTheEarnedHpPool,
    whereTheSaveDiffersFromThisBuildsSchema,
    lairsRenamed,
    guardiansCut,
    heroesInARealmsServiceWhoseWanderingTagWasTakenOff,
  };
}
