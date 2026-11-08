// ── THE STOP: THE SAVE'S CHECK BEFORE A TURN (plan P1-15f8, P1-15's Decision 8 and Choice 1, option 1) ────
// The GM page's shell (src/ui/gm/turn-shell.ts) runs this on the save it has just loaded, before the turn: the save
// upgraded and checked on a copy (upgrade-a-saved-game-and-check-it.ts), the loaded save untouched. A place the check
// names that is not on the short known list below stops the turn before it runs: the shell puts the orders back and
// its message names each place. A known place lets the turn run, and the GM is told as before (the turn's end writes
// the `[Save check]` line, and the message says it too). resolveTurn still checks and tells (the balance matrix fails a
// game on any place), so the tests' staged worlds, which aren't whole saves, still play.
// The known list holds the Parked leaks of a battle's marks, each a field a turn of today's build can still save (none
// reported live): a garrison company's strength cuts and its dead mark after a fall-back, or on a beaten force's hulls
// left ashore; a garrison company's rally tag; a hero slain with no host and raised the same turn. Each entry names its
// Parked entry, and each leak's fix removes its entry. Not the balance matrix's list
// (tools/balance/a-game-fails-on-the-save-check.ts), which lets no leak through.
// Its dice: the upgrade renames an old world's lairs from the dice (a world without _lairNamesV3); on the copy it draws
// from dice of its own, lent for the check and given back, so the page's dice, and the seed the shell then draws for
// the turn, are as without the check.
// A save the upgrade refuses (not a game in play, from a newer build, not a save at all) gives no place here: the turn
// refuses it as before, in its own words, and the shell puts the orders back.
import { kcRng, kcRngStream } from '../rng.ts';
import { refuseASaveThatIsNotAGameInPlay, upgradeGameState } from './upgrade-a-saved-game-and-check-it.ts';

/** A place the check may find that lets the turn run, until its fix lands: `place` matches one whole place as the
 *  check names it (`<path>: <kind>`), narrowly (one path's form and one kind); `parked`, the Parked entry that fixes it. */
export interface AKnownPlaceTheSaveCheckFinds {
  place: RegExp;
  parked: string;
}

const A_GARRISON_COMPANYS = String.raw`^world\.provinces\.\d+\.garrisonArmies\.\d+: a field this build doesn't know, `;
const THE_GARRISONS_STRENGTH_CUTS = "A garrison unit can keep a battle's strength cuts in the save";
const THE_HULLS_LEFT_ASHORE = "A beaten force's hulls can carry a battle's marks into the garrison";

/** The known places: a turn runs on a save holding one, and the GM is told. Each fix removes its entry. */
export const THE_KNOWN_LEAKS_A_TURN_STILL_RUNS_ON: readonly AKnownPlaceTheSaveCheckFinds[] = [
  {
    place: new RegExp(A_GARRISON_COMPANYS + '_tempStrReduction$'),
    parked: `${THE_GARRISONS_STRENGTH_CUTS}; ${THE_HULLS_LEFT_ASHORE}`,
  },
  {
    place: new RegExp(A_GARRISON_COMPANYS + '_archeryRed$'),
    parked: `${THE_GARRISONS_STRENGTH_CUTS}; ${THE_HULLS_LEFT_ASHORE}`,
  },
  { place: new RegExp(A_GARRISON_COMPANYS + '_died$'), parked: THE_GARRISONS_STRENGTH_CUTS },
  {
    place: new RegExp(A_GARRISON_COMPANYS + '_fromGarrison$'),
    parked: 'A garrison company can keep `_fromGarrison` in the save',
  },
  {
    place: /^characters\.\d+: a field this build doesn't know, _slainBy$/,
    parked: 'A hero slain and raised in the same turn keeps who slew him in the save',
  },
];

/** Whether an entry of `known` lets `place` (one place, as the check names it) through. */
export function aPlaceOnTheList(place: string, known: readonly AKnownPlaceTheSaveCheckFinds[]): boolean {
  return known.some((k) => k.place.test(place));
}

/** What the check finds on a save before its turn: the places that stop the turn, and the known ones it is told. */
export interface WhatTheSavesCheckFindsBeforeTheTurn {
  /** Each place not on the known list, as the check names it: the turn doesn't run. */
  placesThatStopTheTurn: string[];
  /** Each place on the known list: the turn runs, and the GM is told. */
  knownPlacesTheTurnRunsOn: string[];
}

/** The save's check, on a copy of `save` as loaded (games.game_state: its JSON, or the parsed object), before the turn:
 *  the save is left as it was, and the page's dice too. A save the upgrade refuses gives no place (the turn refuses it). */
export function whatTheSavesCheckFindsBeforeTheTurn(
  save: unknown,
  known: readonly AKnownPlaceTheSaveCheckFinds[] = THE_KNOWN_LEAKS_A_TURN_STILL_RUNS_ON,
): WhatTheSavesCheckFindsBeforeTheTurn {
  const nothing: WhatTheSavesCheckFindsBeforeTheTurn = { placesThatStopTheTurn: [], knownPlacesTheTurnRunsOn: [] };
  const was = kcRng.use(kcRngStream(1));
  let places: string[];
  try {
    const copy: unknown = JSON.parse(typeof save === 'string' ? save : JSON.stringify(save));
    refuseASaveThatIsNotAGameInPlay(copy);
    places = upgradeGameState(copy).whereTheSaveDiffersFromThisBuildsSchema;
  } catch {
    return nothing; // the turn refuses it, in its own words
  } finally {
    kcRng.use(was);
  }
  return {
    placesThatStopTheTurn: places.filter((p) => !aPlaceOnTheList(p, known)),
    knownPlacesTheTurnRunsOn: places.filter((p) => aPlaceOnTheList(p, known)),
  };
}
