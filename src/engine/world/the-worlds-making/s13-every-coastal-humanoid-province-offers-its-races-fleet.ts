// S13 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the coastal shipyards. Every
// humanoid land province beside the sea offers its race's fleet, in place on the provinces' list.
import {
  type ACellOfTheGrid,
  type AProvinceAsTheWorldIsMadeIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the coastal shipyards read: the set-up's (S0's) provinces' list, humanoid races and neighbours of a cell, and
 *  the coastal fleets' (S5's) fleets by race and fleets' types. */
export interface WhatTheCoastalShipyardsRead {
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
  readonly humanoidRaces: ReadonlySet<string | null | undefined>;
  readonly neighbourCells: (r: number, c: number) => ACellOfTheGrid[];
  readonly fleetsByRace: Readonly<Partial<Record<string, readonly string[]>>>;
  readonly fleetTypes: ReadonlySet<string>;
}

/** S13, the coastal shipyards: a fleet added in place to each coastal humanoid province that offers none. It returns
 *  nothing: the later stages read it from the provinces' list. */
export function everyCoastalHumanoidProvinceOffersItsRacesFleet({
  provinces,
  humanoidRaces,
  neighbourCells,
  fleetsByRace,
  fleetTypes,
}: WhatTheCoastalShipyardsRead) {
  // ── COASTAL SHIPYARDS (2026-09-21, Toby) ── EVERY humanoid land province that touches the sea offers
  // its race's fleet. The earlier passes gave one to COASTAL_NAVAL_CHANCE (80%) of coasts, and the
  // race-rebalance / re-race passes rebuild pools afterwards, so this final sweep is the authority.
  provinces.forEach((p) => {
    if (p.terrain === 'sea' || !humanoidRaces.has(p.race)) return;
    const coastal = neighbourCells(p.row, p.col).some((n) => {
      const q = provinces[n.id];
      return q?.terrain === 'sea';
    });
    if (!coastal) return;
    if (p.armyTypes.some((t) => fleetTypes.has(t))) return;
    const fleet = theOneMadeSure((fleetsByRace[String(p.race)] ?? ['Galleon Fleet'])[0]);
    p.armyTypes.push(fleet);
  });
}
