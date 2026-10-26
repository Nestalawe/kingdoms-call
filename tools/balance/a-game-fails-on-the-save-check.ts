// A game of the balance matrix fails on the save's check (plan P1-15e1, P1-15e's Decision 3). The check of a saved game
// at load (src/engine/saves/upgrade-a-saved-game-and-check-it.ts, P1-15d) names each place a save differs from this
// build's schema, and the turn tells the GM in one line of the GM's log, `[Save check] …`. A live game still plays on
// such a save ("tell now, stop later"), but in the matrix a place the check names is something a turn wrote that the
// schema refuses, so the game fails (play.ts), in two places:
// - **after each turn, on a `[Save check]` line in its GM log:** the line reports the save the turn loaded, so the
//   turn before wrote it. The game fails with `turn N: <its places>` (the turn whose log holds the line);
// - **after the last turn, on the check of the last save:** no turn loads it, so its line would never come (a game's
//   end, `gameOver`, is written by the last turn). It is checked here, by this checkout's `upgradeGameState`, on a copy.
// With KC_SITE the line is the other copy's (its page plays the turn) and the last save's check is this checkout's
// (this file imports src/, as every realm's report does).
// Not an invariant (tests/lib/invariants.ts): checkTurn also runs in turn-fuzz, turn-properties and the fixtures test,
// whose staged worlds lack what Turn 0 adds (the turn mode, the bots' settings), so every turn there would be red.
// A place found on main whose fix waits is parked (STATUS) and let through by a narrow entry in
// KNOWN_PLACES_THE_SAVE_CHECK_FINDS, as KNOWN_BREACHES does for the invariants; its fix removes the entry.
// tests/unit/the-balance-matrix-fails-a-game-on-the-save-check.test.ts checks both checks and the list.
import '../../tests/lib/the-whole-engine.ts';
import { upgradeGameState } from '../../src/engine/saves/upgrade-a-saved-game-and-check-it.ts';

/** A place the check finds on main, let through until its fix lands: `place` matches one whole place as the check
 *  names it (`<path>: <kind>`), narrowly (one path and one kind); `parked`, the plan's STATUS entry that fixes it. */
export interface AKnownPlaceTheSaveCheckFinds {
  place: RegExp;
  parked: string;
}

/** The places known on main (none when P1-15e1 came in). Each fix removes its entry. */
export const KNOWN_PLACES_THE_SAVE_CHECK_FINDS: readonly AKnownPlaceTheSaveCheckFinds[] = [];

/** How the turn's line for the GM begins (engine/turn/new-turn-war-academy-…-the-final-reconcile.ts). */
export const THE_SAVE_CHECKS_LINE_BEGINS = '[Save check] ';

/** Where the line's list of places begins, in its words (engine/saves/what-the-saves-check-found-in-words.ts). */
const THE_LIST_BEGINS = 'Please send this list to the Kingdoms Call team: ';
/** The line's count of the places it doesn't name (more than ten). */
const AND_N_MORE = /^and \d+ more$/;

/** The places a `[Save check]` line names, as the check names them, and the count of the rest as one place ("and 2
 *  more", which no entry can let through). A line not in the words this file knows is one place, as it is. */
export function thePlacesALineNames(text: string): string[] {
  const at = text.indexOf(THE_LIST_BEGINS);
  if (at < 0) return [text];
  const list = text.slice(at + THE_LIST_BEGINS.length).replace(/\.$/, '');
  return list.split('; ');
}

/** The places of `places` no entry of `known` lets through. A count of places not named ("and 2 more") is never let
 *  through: the places it stands for can't be read. */
export function placesNotKnown(
  places: readonly string[],
  known: readonly AKnownPlaceTheSaveCheckFinds[] = KNOWN_PLACES_THE_SAVE_CHECK_FINDS,
): string[] {
  return places.filter((p) => AND_N_MORE.test(p) || !known.some((k) => k.place.test(p)));
}

/** The places the `[Save check]` lines of a turn's GM log name that no entry lets through ([] when none). */
export function whatTheSaveCheckFoundInATurnsLog(
  log: readonly { text?: unknown }[],
  known: readonly AKnownPlaceTheSaveCheckFinds[] = KNOWN_PLACES_THE_SAVE_CHECK_FINDS,
): string[] {
  return log.flatMap((line) =>
    typeof line.text === 'string' && line.text.startsWith(THE_SAVE_CHECKS_LINE_BEGINS)
      ? placesNotKnown(thePlacesALineNames(line.text), known)
      : [],
  );
}

/** The places the check finds on the last save (as the game row holds it, JSON) that no entry lets through ([] when
 *  none): this checkout's upgrade and check, on a copy. */
export function whatTheSaveCheckFindsOnTheLastSave(
  savedJson: string,
  known: readonly AKnownPlaceTheSaveCheckFinds[] = KNOWN_PLACES_THE_SAVE_CHECK_FINDS,
): string[] {
  const save = JSON.parse(savedJson) as Parameters<typeof upgradeGameState>[0];
  return placesNotKnown(upgradeGameState(save).whereTheSaveDiffersFromThisBuildsSchema, known);
}
