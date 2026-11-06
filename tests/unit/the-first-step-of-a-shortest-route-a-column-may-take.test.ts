// The first step of a shortest route on plain values (plan P1-11e7 moved it out of stepTowardPath, so the order form's
// march forecast can ask the same rule on the report's map): a search, breadth first, over the map's hexes in the
// compass directions' order (NW, NE, W, E, SW, SE), into the ground the column may enter (its sea cap) and what the
// caller's filter allows; a column that leads ships never steps from land to land; at most 40 steps.
//
// Level 1 (unit): theFirstStepOfAShortestRouteAColumnMayTake
// (src/engine/rules-on-plain-values/the-first-step-of-a-shortest-route-a-column-may-take.ts) on made-up maps. A lower
// level can't run a function. Every game reaches the search, but a fault planted in a shared function moves every
// caller at once, so these cases pin its answers: a route round a sea, an edge closed to ships, the caller's filter,
// the order of the neighbours and the depth of 40. tests/unit/routes-and-distances.test.ts checks the engine's
// callers (in the vm) as properties.
import { expect, test } from 'vitest';
import { theFirstStepOfAShortestRouteAColumnMayTake } from '../../src/engine/rules-on-plain-values/the-first-step-of-a-shortest-route-a-column-may-take.ts';

interface Province {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  readonly terrain: string;
}

/** A map from its rows of ground, a letter a hex: L land, S sea. A province's id is its place in the list. */
function aMap(...theRows: string[]) {
  const cols = theRows[0]?.length ?? 0;
  const provinces: Province[] = theRows.flatMap((ground, row) =>
    Array.from({ length: cols }, (_, col) => ({
      id: row * cols + col,
      row,
      col,
      terrain: ground.charAt(col) === 'S' ? 'sea' : 'plains',
    })),
  );
  return { provinces, cols, rows: theRows.length };
}

const aLandColumn = { armies: [{ type: 'infantry' }] };
// A fleet carrying foot: the ships let it enter the sea (its sea cap 'all'), the foot the land.
const aFleetCarryingFoot = { armies: [{ type: 'warship' }, { type: 'infantry' }] };

/** The answer as ids: the first step's and the depth (the steps after the first), or null. */
function theRoute(
  theColumn: { readonly armies: readonly { readonly type: string }[]; readonly _partSeaThisPhase?: boolean },
  itsSeaCap: string,
  itLeadsShips: boolean,
  theMap: ReturnType<typeof aMap>,
  fromId: number,
  toId: number,
  extraFilter?: (p: Province) => boolean,
) {
  const from = theMap.provinces[fromId];
  if (!from) throw new TypeError('no such province on the made-up map');
  const r = theFirstStepOfAShortestRouteAColumnMayTake(
    theColumn,
    itsSeaCap,
    itLeadsShips,
    theMap,
    from,
    toId,
    extraFilter,
  );
  return r && { first: r.first.id, depth: r.depth };
}

test('a land column goes round a sea, the long way; one that may enter the sea crosses it', () => {
  // One row of eight hexes that wraps east to west (W and E only): a sea at 3.
  const ring = aMap('LLLSLLLL');
  expect({
    // From 1 to 4: east is 1, 2, the sea, 4; west is 0, 7, 6, 5, 4 (five steps).
    roundTheSea: theRoute(aLandColumn, 'land', false, ring, 1, 4),
    // From 2 the sea is the first step east: refused, so west the long way.
    theSeaTheFirstStep: theRoute(aLandColumn, 'land', false, ring, 2, 4),
    // A column whose flyers or ships carry it (its sea cap 'sea' or 'all') crosses.
    overTheSea: theRoute(aLandColumn, 'sea', false, ring, 1, 4),
    overTheSeaAll: theRoute(aLandColumn, 'all', false, ring, 2, 4),
    // Part Sea's mark of this phase opens the sea to a land column.
    partSea: theRoute({ ...aLandColumn, _partSeaThisPhase: true }, 'land', false, ring, 2, 4),
    // The sea itself is never a land column's goal.
    toTheSea: theRoute(aLandColumn, 'land', false, ring, 1, 3),
  }).toEqual({
    roundTheSea: { first: 0, depth: 4 },
    theSeaTheFirstStep: { first: 1, depth: 5 },
    overTheSea: { first: 2, depth: 2 },
    overTheSeaAll: { first: 3, depth: 1 },
    partSea: { first: 3, depth: 1 },
    toTheSea: null,
  });
});

test('a column that leads ships never steps from land to land: it puts out to sea and lands from it', () => {
  // Two rows of four, wrapping east to west: land above (0 to 3), sea below (4 to 7). Row 1's hexes lie half a hex
  // east, so sea 4 touches land 0 and 1, and sea 5 touches land 1 and 2.
  const theCoast = aMap('LLLL', 'SSSS');
  expect({
    // From land 0 to land 1, its neighbour: the edge between them is closed, so out to sea 4, then in to 1.
    fromLand: theRoute(aFleetCarryingFoot, 'all', true, theCoast, 0, 1),
    // The same column, not leading ships (its ships handed over), steps straight across.
    fromLandNoShips: theRoute(aFleetCarryingFoot, 'all', false, theCoast, 0, 1),
    // From sea 4 to land 2: landing at 1 first and walking on is closed; sailing to 5 and landing at 2 is the route.
    fromTheSea: theRoute(aFleetCarryingFoot, 'all', true, theCoast, 4, 2),
    fromTheSeaNoShips: theRoute(aFleetCarryingFoot, 'all', false, theCoast, 4, 2),
  }).toEqual({
    fromLand: { first: 4, depth: 1 },
    fromLandNoShips: { first: 1, depth: 0 },
    fromTheSea: { first: 5, depth: 1 },
    fromTheSeaNoShips: { first: 1, depth: 1 },
  });
});

test("the caller's filter closes a province, on the first step and beyond", () => {
  const ring = aMap('LLLLLLLL');
  expect({
    // From 0 to 5: west is 7, 6, 5 (three steps); with 6 refused, east is 1 to 5 (five).
    beyond: theRoute(aLandColumn, 'land', false, ring, 0, 5, (p) => p.id !== 6),
    // From 0 to 6: west is 7, 6; with 7 refused, east is 1 to 6 (six).
    theFirstStep: theRoute(aLandColumn, 'land', false, ring, 0, 6, (p) => p.id !== 7),
    noFilter: theRoute(aLandColumn, 'land', false, ring, 0, 5),
    // Every step refused: no route.
    everyStepRefused: theRoute(aLandColumn, 'land', false, ring, 0, 5, () => false),
  }).toEqual({
    beyond: { first: 1, depth: 4 },
    theFirstStep: { first: 1, depth: 5 },
    noFilter: { first: 7, depth: 2 },
    everyStepRefused: null,
  });
});

test("of two routes as short, the one whose first step comes first in the compass's order wins", () => {
  // One row of six: from 0 to 3, west (5, 4, 3) and east (1, 2, 3) are three steps each; W comes before E.
  const ring = aMap('LLLLLL');
  // Two rows of four, all land: from 0 to 5, through 1 (E) or through 4 (SE), two steps each; E comes before SE.
  const aField = aMap('LLLL', 'LLLL');
  expect({
    westBeforeEast: theRoute(aLandColumn, 'land', false, ring, 0, 3),
    eastBeforeSouthEast: theRoute(aLandColumn, 'land', false, aField, 0, 5),
  }).toEqual({
    westBeforeEast: { first: 5, depth: 2 },
    eastBeforeSouthEast: { first: 1, depth: 1 },
  });
});

test('a route of 40 steps is found; one of 41 is not', () => {
  // One row of 90: from 0, east to 40 is 40 steps (west 50); east to 41 is 41 (west 49).
  const aLongRing = aMap('L'.repeat(90));
  expect({
    fortySteps: theRoute(aLandColumn, 'land', false, aLongRing, 0, 40),
    fortyOneSteps: theRoute(aLandColumn, 'land', false, aLongRing, 0, 41),
    oneStep: theRoute(aLandColumn, 'land', false, aLongRing, 0, 1),
  }).toEqual({
    fortySteps: { first: 1, depth: 39 },
    fortyOneSteps: null,
    oneStep: { first: 1, depth: 0 },
  });
});
