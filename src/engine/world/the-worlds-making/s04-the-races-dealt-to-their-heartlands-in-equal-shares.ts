// S4 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the races dealt to their heartlands.
// Each humanoid land province's race dealt again, in equal shares to within one, leaning to each race's own terrain;
// its army pool and its neutral defenders made again for the race it gets, in place on the provinces' list.
import { kcRng } from '../../rng.ts';
import { RACES_P, SIGNATURE_TERRAIN_P, SIGNATURE_WEIGHT_P, buildHumanoidPool, provincePoolSize } from '../tables.ts';
import { shuffleP } from '../../battle/fortune.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import {
  type AProvinceAsTheWorldIsMadeIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the races' deal reads: the provinces' list (S3's, filled in place) and the set-up's (S0's) humanoid races. */
export interface WhatTheRacesDealReads {
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
  readonly humanoidRaces: ReadonlySet<string | null | undefined>;
}

/** S4, the races dealt to their heartlands: each humanoid land province's race, army pool and defenders changed in
 *  place. It returns nothing: the later stages read it from the provinces' list. */
export function theRacesDealtToTheirHeartlandsInEqualShares({ provinces, humanoidRaces }: WhatTheRacesDealReads) {
  // Post-generation: add fleet types to coastal provinces (land adjacent to sea) Whale Cohorts are
  // NOT an Elven unit — they are wild primal sea-beasts, raised only in the whale waters that
  // generate them, by any realm with the Druid skill to command them. ── Race allocation: weighted
  // towards each race's heartland, balanced to equal totals ── Two requirements pull against each
  // other. Races should cluster in their signature terrain
  // (Humans on plains, Elves in forest, Dwarves in mountains, Orcs in desert), but the four races
  // must also hold equal numbers of provinces — and terrain is NOT evenly distributed, so a plain
  // weighted draw would hand whichever race owns the commonest terrain a permanent advantage.
  //
  // Resolved by giving each race a hard quota of floor(n/4) provinces (the remainder spread at
  // random) and then, for each province in random order, drawing among the races that still have
  // quota left, weighted by SIGNATURE_WEIGHT_P for a terrain match and by each race's REMAINING
  // quota. The quota term is what keeps it balanced: a race that has been getting its way falls
  // back automatically as its allowance runs down. Totals are exact to within one province.
  {
    const humanoidProvs = provinces.filter((p) => p.terrain !== 'sea' && humanoidRaces.has(p.race));
    const n = humanoidProvs.length;
    const quota: Partial<Record<string, number>> = {};
    RACES_P.forEach((r) => {
      quota[r] = Math.floor(n / 4);
    });
    shuffleP(RACES_P)
      .slice(0, n - Math.floor(n / 4) * 4)
      .forEach((r) => {
        quota[r] = Number(quota[r]) + 1;
      });
    for (const p of shuffleP(humanoidProvs)) {
      const pool = RACES_P.filter((r) => Number(quota[r]) > 0);
      const cands = pool.length ? pool : [...RACES_P];
      const weights = cands.map(
        (r) => (SIGNATURE_TERRAIN_P[r] === p.terrain ? SIGNATURE_WEIGHT_P : 1) * Math.max(1, Number(quota[r])),
      );
      let roll = kcRng() * weights.reduce((a, b) => a + b, 0),
        pick = theOneMadeSure(cands[cands.length - 1]);
      for (let i = 0; i < cands.length; i++) {
        roll -= Number(weights[i]);
        if (roll <= 0) {
          pick = theOneMadeSure(cands[i]);
          break;
        }
      }
      quota[pick] = Number(quota[pick]) - 1;
      p.race = pick;
      // Rebuild everything downstream of race: the recruitable pool and the neutral garrison that
      // was rolled from it. Province count, wealth, terrain and features are untouched.
      const hp = buildHumanoidPool(p.terrain, pick, provincePoolSize(kcRng), kcRng); // item 15: 2 (75%) or 3 (25%)
      p.armyTypes = [...hp.types, ...hp.garrison];
      const drawPool = hp.types.length ? hp.types : p.armyTypes;
      p.neutralDefenders.forEach((d) => {
        d.type = theOneMadeSure(drawPool[Math.floor(kcRng() * drawPool.length)]);
        d.race = pick;
        d.unitName = theOneMadeSure(armyUnitName(d.type));
      });
    }
  }
}
