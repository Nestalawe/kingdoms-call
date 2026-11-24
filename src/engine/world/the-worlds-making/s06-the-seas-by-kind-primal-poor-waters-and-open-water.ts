// S6 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the seas by kind. Each sea made
// primal (prosperous, a primal beast's defenders), poor waters (whale and shark waters turn about) or open water (no
// armies, tax 1), in place on the provinces' list.
import {
  KC_THE_POOR_SEAS_BEASTS_DEALT_TURN_ABOUT_WITH_THEIR_RACE_TAGS,
  KC_UNIT_CLASS,
  THE_RACE_OF_THE_WILD,
} from '../../../content/kingdoms-call-data.ts';
import { THE_SEAS_BY_KIND } from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../../rng.ts';
import { theWildsSubRaceOf } from '../../rules-on-plain-values/whether-a-race-is-the-wilds-or-one-of-its-sub-races.ts';
import { neutralDefCount, rP } from '../../units/drill-and-spoils.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import {
  type AProvinceAsTheWorldIsMadeIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the seas by kind read: the provinces' list (S3's, filled in place) and the set-up's (S0's) beasts' names by
 *  type. */
export interface WhatTheSeasByKindRead {
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
  readonly unitNamesByType: Readonly<Partial<Record<string, readonly string[]>>>;
}

/** S6, the seas by kind: each sea's army pool, race, tax and defenders set in place. It returns nothing: the later
 *  stages read it from the provinces' list. */
export function theSeasByKindPrimalPoorWatersAndOpenWater({ provinces, unitNamesByType }: WhatTheSeasByKindRead) {
  // Sea provinces: only non-humanoid sea armies — no Fleet/Corsair/Galleys/Longships Sea provinces
  // get non-humanoid sea armies only (no player fleets). Their army pool and tax are decided purely
  // by type: 20% Primal (Prosperous, tax 4-6), 20% poor waters (tax 2-3; dealt half whale waters and
  // half shark waters, turn about, so every world gets an even share — 2026-10-13, Toby: the Shark
  // Shoals are the Monsters' weak sea-beast as the Whale Cohort is the Creatures'), 60% open water
  // (no armies, tax 1).
  const POOR_SEAS = KC_THE_POOR_SEAS_BEASTS_DEALT_TURN_ABOUT_WITH_THEIR_RACE_TAGS;
  const PRIMAL_SEA_TYPES = KC_UNIT_CLASS.primalSea.filter((t) => !POOR_SEAS.some((sea) => sea.type === t)); // the prosperous seas' beasts; the Shark Shoals are the poor seas' (below)
  let _poorSeasDealt = 0;
  provinces
    .filter((p) => p.terrain === 'sea')
    .forEach((p) => {
      const r = kcRng();
      if (r < THE_SEAS_BY_KIND.theDieUnderWhichASeaIsPrimal) {
        const chosen = theOneMadeSure(PRIMAL_SEA_TYPES[Math.floor(kcRng() * PRIMAL_SEA_TYPES.length)]);
        p.armyTypes = [chosen];
        p.race = theWildsSubRaceOf(chosen.replace(/s$/, '').replace('Eldritch Kraken', 'Kraken')); // 'Primal:Sea Giant' / 'Primal:Kraken'
        // Primal seas are Prosperous waters — tax 4-6, same band as prosperous land. (Capped at 6:
        // tax 7 displays as "Rich", so the old rP(4,7) was quietly minting rich sea provinces.)
        p.tax = rP(THE_SEAS_BY_KIND.thePrimalSeasTax.theLeast, THE_SEAS_BY_KIND.thePrimalSeasTax.theMost);
        // Defender count and quality (2026-10-13: both primal sea beasts are Druid 4; the Druid-5 Leviathans
        // are gone, so no sea is guarded by Veterans alone any more).
        const defCount = neutralDefCount(p.tax); // p.tax set to 4-6 above -> Prosperous 2-3
        const defQuality = kcRng() < THE_SEAS_BY_KIND.theChanceAPrimalSeasDefendersAreVeterans ? 'Veteran' : 'Average';
        // a name once drawn here and read by nothing: its die is still drawn, for a beast with names
        if (unitNamesByType[chosen] != null) kcRng();
        p.neutralDefenders = Array.from({ length: defCount }, () => ({
          type: chosen,
          quality: defQuality,
          race: THE_RACE_OF_THE_WILD,
          unitName: theOneMadeSure(armyUnitName(chosen)),
        }));
        p.npcArmies = defCount;
        p.explored = 0;
      } else if (r < THE_SEAS_BY_KIND.theDieUnderWhichASeaIsPoorWaters) {
        // Poor waters: whale waters and shark waters, turn about.
        const poorSea = theOneMadeSure(POOR_SEAS[_poorSeasDealt % POOR_SEAS.length]);
        _poorSeasDealt++;
        const beast = poorSea.type;
        p.armyTypes = [beast];
        p.race = poorSea.raceTag;
        p.tax = rP(THE_SEAS_BY_KIND.thePoorWatersTax.theLeast, THE_SEAS_BY_KIND.thePoorWatersTax.theMost); // Poor waters — 2-3, matching the poor land band (2026-09-21: no 1-tax band province)
        const defCount = neutralDefCount(p.tax);
        p.neutralDefenders = Array.from({ length: defCount }, () => ({
          type: beast,
          quality: 'Average',
          race: THE_RACE_OF_THE_WILD,
          unitName: theOneMadeSure(armyUnitName(beast)),
        }));
        p.npcArmies = defCount;
      } else {
        // Open water — no armies, no defenders, tax exactly 1.
        p.armyTypes = [];
        p.neutralDefenders = [];
        p.npcArmies = 0;
        p.tax = 1;
      }
    });
}
