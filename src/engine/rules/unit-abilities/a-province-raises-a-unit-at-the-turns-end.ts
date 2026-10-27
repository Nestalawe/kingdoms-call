// The unit abilities at the turn's end (plan P1-19k), the stage of turnEnd "a province raises a unit": Raiders' Muster.
// Early Winter (src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts) asks it for
// each province a realm holds, after the wages and before the garrison drill. Each effect is handed what its stage hands
// it (the registry's stage type) and returns the unit the province raises, or nothing; it changes nothing, and Early
// Winter names the unit, adds it to the garrison and writes the line (plan P1-19's second slice, Choice 3). No effect
// here draws a die: the unit's name is drawn by Early Winter, as before. Until P1-19k it was written inline there, by
// the unit's name.
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS as ROWS } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { UnitAbilitySlug } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

/** The orcs: the race of the province, of the realm that holds it and of the horde Raiders' Muster raises. */
const THE_ORCS = 'Orcish';

// A province raises a unit (the turn adds each unit an effect returns, in the stage's order).
export const A_PROVINCE_RAISES_A_UNIT = {
  // ORC — Raiders' Muster (2026-10-11, Toby, the unit abilities): plunder feeds the horde. An orcish province that saw
  // an orc realm win there this turn, and is still an orc realm's at the turn's end, draws one Goblin Horde (Average) to
  // its garrison for nothing; it is owed wages from next turn like any garrison unit.
  'raiders-muster': (facts) =>
    facts.anOrcRealmWonABattleThereThisTurn &&
    facts.theProvincesRace === THE_ORCS &&
    facts.theRaceOfTheRealmThatHoldsIt === THE_ORCS
      ? { type: ROWS['raiders-muster'].raises, quality: 'Average', race: THE_ORCS }
      : null,
} satisfies Partial<Record<UnitAbilitySlug, TheStagesOfEachHookPoint['turnEnd']['a province raises a unit']>>;
