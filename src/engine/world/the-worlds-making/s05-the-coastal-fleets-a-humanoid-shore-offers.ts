// S5 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): the coastal fleets. A humanoid land
// province beside the sea may offer its race's fleet; the fleets by race and the fleets' types are handed on to the
// coastal shipyards (S13).
import { THE_FLEETS_A_HUMANOID_RACE_BUILDS_ON_A_COAST } from '../../../content/the-worlds-making-its-name-pools-sea-features-wild-beasts-fleets-skill-pools-and-the-bots-realms.ts';
import { kcRng } from '../../rng.ts';
import { COASTAL_NAVAL_CHANCE, HUMANOID_FLEET_TYPES } from '../tables.ts';
import {
  type AProvinceAsTheWorldIsMadeIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** What the coastal fleets read: the set-up's (S0's) map size, provinces' list, humanoid races and the hex grid's
 *  neighbour offsets for even and odd rows. */
export interface WhatTheCoastalFleetsRead {
  readonly cols: number;
  readonly rows: number;
  readonly provinces: AProvinceAsTheWorldIsMadeIt[];
  readonly humanoidRaces: ReadonlySet<string | null | undefined>;
  readonly offEven: readonly (readonly [number, number])[];
  readonly offOdd: readonly (readonly [number, number])[];
}

/** S5, the coastal fleets: a fleet added in place to a coastal humanoid province's army pool, and the fleets by race
 *  and the fleets' types, which the coastal shipyards (S13) read. */
export function theCoastalFleetsAHumanoidShoreOffers({
  cols,
  rows,
  provinces,
  humanoidRaces,
  offEven,
  offOdd,
}: WhatTheCoastalFleetsRead) {
  const FLEET_BY_RACE = THE_FLEETS_A_HUMANOID_RACE_BUILDS_ON_A_COAST; // Corsair Fleet retired (was Human alt); coastal Humans now build Galleon Fleet only
  const fleetsByRace: Readonly<Partial<Record<string, readonly string[]>>> = FLEET_BY_RACE; // by any race's name
  const fleetTypes: ReadonlySet<string> = HUMANOID_FLEET_TYPES; // looked up by any unit's type
  provinces.forEach((p) => {
    if (p.terrain === 'sea') return; // sea handled separately below
    // Naval units are a HUMANOID shipbuilding tradition.
    if (!humanoidRaces.has(p.race)) return;
    // Check if any neighbour is sea
    const offsets = p.row % 2 === 0 ? offEven : offOdd;
    const adjSea = offsets.some(([dr, dc]) => {
      const nr = p.row + dr;
      if (nr < 0 || nr >= rows) return false;
      const nc = (((p.col + dc) % cols) + cols) % cols;
      const nb = provinces[nr * cols + nc];
      return nb?.terrain === 'sea';
    });
    if (adjSea && kcRng() < COASTAL_NAVAL_CHANCE) {
      // share of coastal humanoid provinces with a fleet option
      const fleets = fleetsByRace[(p.race ?? '') || 'Human'] ?? ['Galleon Fleet'];
      const fleet = theOneMadeSure(fleets[Math.floor(kcRng() * fleets.length)]);
      if (!p.armyTypes.includes(fleet)) p.armyTypes.push(fleet);
    }
  });
  return { fleetsByRace, fleetTypes };
}
