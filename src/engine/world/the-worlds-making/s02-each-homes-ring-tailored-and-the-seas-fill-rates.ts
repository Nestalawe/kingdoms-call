// S2 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): PHASE 2, each home's ring. The home
// cell and each free cell around it tailored (a naval king's sea, a poor and a prosperous land, the rest under the home
// sea cap), and the seas' fill rates the terrain pre-pass (S3) reads.
import { EACH_HOMES_RING_AND_THE_SEAS_FILL } from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../../rng.ts';
import { shuffleP } from '../../battle/fortune.ts';
import {
  type ACellOfTheGrid,
  type ACellsTailoring,
  type ARealmAsTheSetUpHandsIt,
  type ATerrainOfTheMaking,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What each home's ring reads: the realms, the sea share (as the GM gave it and as a fraction), the capitals (S1),
 *  and the set-up's (S0's) neighbours of a cell, a realm's Naval and pickLand. */
export interface WhatEachHomesRingReads {
  readonly setupPlayers: readonly ARealmAsTheSetUpHandsIt[];
  readonly seaPct: number;
  readonly seaTarget: number;
  readonly homeCells: readonly ACellOfTheGrid[];
  readonly homeIdSet: ReadonlySet<number>;
  readonly neighbourCells: (r: number, c: number) => ACellOfTheGrid[];
  readonly navalLevelOf: (sp: ARealmAsTheSetUpHandsIt | undefined) => number;
  readonly pickLand: () => ATerrainOfTheMaking;
}

/** S2, each home's ring: each tailored cell's terrain and band by its id, and the seas' fill rates. */
export function eachHomesRingTailoredAndTheSeasFillRates({
  setupPlayers,
  seaPct,
  seaTarget,
  homeCells,
  homeIdSet,
  neighbourCells,
  navalLevelOf,
  pickLand,
}: WhatEachHomesRingReads) {
  // ── PHASE 2: tailor each king's home NEIGHBOURHOOD ── Pre-assign terrain (and a tax band) to
  // specific ring cells so every home satisfies its rules:
  // >=2 adjacent land, >=1 poor (tax 2-3) land, >=1 prosperous (tax 4-6) land, and >=1 adjacent
  // sea IF that king started with Naval>=1. Everything else is filled by the general rule.
  // constraint[id] = { terrain, taxBand:'poor'|'prosperous'|null, isHome:bool }
  const constraint: Partial<Record<number, ACellsTailoring>> = {};
  // Sea cap: a home never borders more than HOME_MAX_SEA sea provinces. Every free ring cell is
  // decided HERE (sea at the general-fill base rate while under the cap, land otherwise) rather
  // than left to the random fill, so the cap is exact. The open-water guarantee for coastal homes
  // is applied after the sea post-pass below (see "home coastal guarantee").
  // 2026-09-25: the cap rises with the sea share — 3 from 60%, 4 from 70% — or a drowned world could
  // not be built: every home ring pinned at ≥4 land held the reachable share to ~70% (measured).
  // The ring still always holds the poor AND the prosperous land the home rules demand, so ≥2 land
  // neighbours survive at any share.
  const _theMostSea = EACH_HOMES_RING_AND_THE_SEAS_FILL.theMostSeaAHomeBorders;
  const HOME_MAX_SEA =
    seaPct >= _theMostSea.fromTheHigherCut.theSeaShareFrom
      ? _theMostSea.fromTheHigherCut.theSeas
      : seaPct >= _theMostSea.fromTheLowerCut.theSeaShareFrom
        ? _theMostSea.fromTheLowerCut.theSeas
        : _theMostSea.belowBoth;
  // The fill's two rates scale with the chosen share: 0.28 / 0.55 were the old fixed figures, which
  // are exactly what a 40% target gives here (0.7× and 1.375× the share), so the shape of the seas is
  // unchanged at the old rates and simply seeds more or less water at other shares.
  const { theBaseRate, theClusterRate } = EACH_HOMES_RING_AND_THE_SEAS_FILL;
  const SEA_BASE_RATE = Math.min(theBaseRate.theMost, seaTarget * theBaseRate.theShareOfTheSeaShare),
    SEA_CLUSTER_RATE = Math.min(theClusterRate.theMost, seaTarget * theClusterRate.theShareOfTheSeaShare);
  // Ring cells roll at the fill's base rate; from 60% (where the cap opens) at its cluster rate, so a
  // drowned world's homes are island capitals rather than the one dry patch holding the share back.
  const HOME_RING_SEA_CHANCE =
    seaPct >= EACH_HOMES_RING_AND_THE_SEAS_FILL.theSeaShareFromWhichARingRollsAtTheClusterRate
      ? SEA_CLUSTER_RATE
      : SEA_BASE_RATE;
  homeCells.forEach((home, ki) => {
    constraint[home.id] = { terrain: pickLand(), taxBand: null, isHome: true }; // home is land (race/pool set later)
    const ringAll = neighbourCells(home.r, home.c).filter((n) => !homeIdSet.has(n.id));
    let seaCount = ringAll.filter((n) => constraint[n.id]?.terrain === 'sea').length; // pre-set by an overlapping ring
    const ring = ringAll.filter((n) => !constraint[n.id]); // free cells only
    const shuffled = shuffleP(ring);
    let i = 0;
    if (navalLevelOf(setupPlayers[ki]) >= 1 && i < shuffled.length && seaCount < HOME_MAX_SEA) {
      constraint[theOneMadeSure(shuffled[i]).id] = { terrain: 'sea', taxBand: null };
      i++;
      seaCount++;
    }
    if (i < shuffled.length) {
      constraint[theOneMadeSure(shuffled[i]).id] = { terrain: pickLand(), taxBand: 'poor' };
      i++;
    } // one poor land
    if (i < shuffled.length) {
      constraint[theOneMadeSure(shuffled[i]).id] = { terrain: pickLand(), taxBand: 'prosperous' };
      i++;
    } // one prosperous land
    for (; i < shuffled.length; i++) {
      if (seaCount < HOME_MAX_SEA && kcRng() < HOME_RING_SEA_CHANCE) {
        constraint[theOneMadeSure(shuffled[i]).id] = { terrain: 'sea', taxBand: null };
        seaCount++;
      } else constraint[theOneMadeSure(shuffled[i]).id] = { terrain: pickLand(), taxBand: null };
    }
  });
  return { constraint, SEA_BASE_RATE, SEA_CLUSTER_RATE };
}
