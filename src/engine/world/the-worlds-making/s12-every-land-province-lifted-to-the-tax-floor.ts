// S12 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the tax floor. Every land province
// below the floor lifted to it, in place on the provinces' list. It lifts none today: every land tax is rolled at the
// floor or more (KD-454).
import { THE_TAX_FLOOR } from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import type { AProvinceAsTheWorldIsMadeIt } from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the tax floor reads: the provinces' list. */
export interface WhatTheTaxFloorReads {
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
}

/** S12, the tax floor: each land province's tax at least the floor, in place. It returns nothing. */
export function everyLandProvinceLiftedToTheTaxFloor({ provinces }: WhatTheTaxFloorReads) {
  // ── MINIMUM TAX FLOOR (2026-09-21) ── No LAND province may be worth 1 tax. The Poor band is
  // 2-3 everywhere it is rolled above, but terrain rolls, re-racing and future tailoring passes all
  // touch tax independently, so this single sweep is the authority: every land province is lifted to
  // at least 2 before garrisons are sized off its FINAL tax. Sea is deliberately exempt — open water
  // is pinned at tax 1 as the "worthless ocean" marker the home-coastal guarantee relies on.
  provinces.forEach((p) => {
    if (p.terrain !== 'sea' && (p.tax || 0) < THE_TAX_FLOOR.theLeastTaxOfALandProvince)
      p.tax = THE_TAX_FLOOR.theLeastTaxOfALandProvince;
  });
}
