// S8 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the home's open-water sea. A home
// that borders the sea but no open water gets one of its guarded seas made open water, in place on the provinces'
// list.
import { kcRng } from '../../rng.ts';
import {
  type ACellOfTheGrid,
  type AProvinceAsTheWorldIsMadeIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the home's open-water sea reads: the capitals (S1), the set-up's (S0's) neighbours of a cell and the
 *  provinces' list. */
export interface WhatTheHomesOpenWaterSeaReads {
  readonly homeCells: readonly ACellOfTheGrid[];
  readonly neighbourCells: (r: number, c: number) => ACellOfTheGrid[];
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
}

/** S8, the home's open-water sea: for each home, at most one of its seas made open water, in place. It returns
 *  nothing: the later stages read it from the provinces' list. */
export function aCoastalHomeBordersAnOpenWaterSea({
  homeCells,
  neighbourCells,
  provinces,
}: WhatTheHomesOpenWaterSeaReads) {
  // ── Home coastal guarantee: a home that borders any sea borders at least one OPEN-WATER sea (no
  // neutral defenders), so a king's first fleet always has somewhere to sail without a fight. Sea
  // features/guardians (lairs) are untouched - they never block movement.
  homeCells.forEach((home) => {
    const seas = neighbourCells(home.r, home.c)
      .map((n) => provinces[n.id])
      .filter((p): p is AProvinceAsTheWorldIsMadeIt => p?.terrain === 'sea');
    if (!seas.length || seas.some((p) => !p.neutralDefenders.length)) return;
    const p = theOneMadeSure(seas[Math.floor(kcRng() * seas.length)]);
    p.armyTypes = [];
    p.neutralDefenders = [];
    p.npcArmies = 0;
    p.tax = 1;
    p.race = null;
  });
}
