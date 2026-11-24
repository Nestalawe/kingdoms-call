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

/** The start of each of the wild's sub-races: the wild's race and a colon (`Primal:`). */
const THE_START_OF_A_SUB_RACE_OF_THE_WILD = `${THE_RACE_OF_THE_WILD}:`;

/** The wild's sub-race of a beast's singular noun (`Stone Giant` gives `Primal:Stone Giant`): the race the world's
 *  making gives a wild province and its beasts, exactly as each maker's `'Primal:' + noun` gave before (B-06ad). */
export const theWildsSubRaceOf = (theNoun: string): string => THE_START_OF_A_SUB_RACE_OF_THE_WILD + theNoun;

/** Whether a race is one of the wild's sub-races (`Primal:Wolf`), and not the wild's race alone (`Primal`): exactly as
 *  each reader's `.startsWith('Primal:')` gave before (B-06ad). A race empty or not given is none. Asked by the world's
 *  making of a province (its name, its defenders' grade). */
export const isTheRaceOneOfTheWildsSubRaces = (theRace: string | null | undefined): boolean =>
  (theRace ?? '').startsWith(THE_START_OF_A_SUB_RACE_OF_THE_WILD);
