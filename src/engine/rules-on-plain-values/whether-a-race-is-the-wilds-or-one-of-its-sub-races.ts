// ── Whether a race is the wild's, or one of its sub-races (B-06ac) ────
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a).
import { THE_RACE_OF_THE_WILD } from '../../content/kingdoms-call-data.ts';

/** Whether a race is the wild's (THE_RACE_OF_THE_WILD, `Primal`) or one of its sub-races (`Primal:Wolf`): any race
 *  that starts with the wild's race, exactly as each reader's `.startsWith('Primal')` gave before. A race empty or not
 *  given is not the wild's. Asked by a Call to Arms, Evil's conquest and Awaken Grove of the province's folk. */
export const isTheRaceTheWildsOrOneOfItsSubRaces = (theRace: string | null | undefined): boolean =>
  (theRace ?? '').startsWith(THE_RACE_OF_THE_WILD);
