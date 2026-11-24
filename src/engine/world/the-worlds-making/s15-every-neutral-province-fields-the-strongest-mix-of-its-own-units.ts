// S15 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the strongest neutral mix. Every
// neutral humanoid land province fields the most effective mix of its own units, the same number, each slot keeping
// its quality, in place on the provinces' list.
import { THE_RACE_A_COMPANY_OR_PROVINCE_OF_NO_RACE_READS_AS } from '../../../content/kingdoms-call-data.ts';
import { THE_STRONGEST_NEUTRAL_MIX } from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { isTheRaceTheWildsOrOneOfItsSubRaces } from '../../rules-on-plain-values/whether-a-race-is-the-wilds-or-one-of-its-sub-races.ts';
import { UNIT_Q_MULT } from '../../rules-on-plain-values/unit-types-and-base-strength.ts';
import { bestNeutralMix } from '../../units/drill-and-spoils.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import {
  type AProvinceAsTheWorldIsMadeIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the strongest neutral mix reads: the provinces' list. */
export interface WhatTheStrongestNeutralMixReads {
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
}

/** S15, the strongest neutral mix: each neutral humanoid land province's defenders made its best mix, in place. It
 *  returns nothing: the later stages read it from the provinces' list. */
export function everyNeutralProvinceFieldsTheStrongestMixOfItsOwnUnits({ provinces }: WhatTheStrongestNeutralMixReads) {
  // ── THE STRONGEST NEUTRAL MIX (2026-10-13, Toby item 13) ── With the count final, every neutral
  // land province fields the most effective mix of its own units (bestNeutralMix), the same number
  // of units, each slot keeping the quality it was dealt. A unit keeps its company name when its type
  // is unchanged. Primal provinces offer one beast and are left as they are.
  provinces.forEach((p) => {
    if (p.owner !== null || p.terrain === 'sea' || isTheRaceTheWildsOrOneOfItsSubRaces(p.race)) return;
    const defs = p.neutralDefenders;
    if (!defs.length) return;
    const quals = defs
      .map((d) => d.quality || 'Average')
      .sort(
        (a, b) =>
          ((UNIT_Q_MULT[b] ?? 0) || THE_STRONGEST_NEUTRAL_MIX.theWeightOfAGradeTheTableGivesNone) -
          ((UNIT_Q_MULT[a] ?? 0) || THE_STRONGEST_NEUTRAL_MIX.theWeightOfAGradeTheTableGivesNone),
      );
    const mix = bestNeutralMix(p.armyTypes, quals, p.terrain, p.race);
    if (!mix) return;
    const left = defs.slice();
    p.neutralDefenders = mix.map((t, i) => {
      const k = left.findIndex((d) => d.type === t && (d.quality || 'Average') === quals[i]);
      if (k >= 0) return theOneMadeSure(left.splice(k, 1)[0]);
      return {
        type: t,
        quality: theOneMadeSure(quals[i]),
        race: theOneMadeSure(defs[0]).race || (p.race ?? '') || THE_RACE_A_COMPANY_OR_PROVINCE_OF_NO_RACE_READS_AS,
        unitName: theOneMadeSure(armyUnitName(t)),
      };
    });
    p.npcArmies = p.neutralDefenders.length;
  });
}
