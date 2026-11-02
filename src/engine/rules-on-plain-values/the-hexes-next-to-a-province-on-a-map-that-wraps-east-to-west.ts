// ── The hexes next to a province, on a map that wraps east to west (plan P1-11d5) ────
// The engine's rules of a hero, an army, an item, a level or a number live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other. The map's hex step is one of
// them: it reads a province's row and column and the map's size, handed in, never the turn's world. The map is a grid
// of hexes, `cols` wide and `rows` high, each odd row's hexes half a hex east of the even rows'. A province's place in
// the map's list is its row × `cols` + its column. The columns wrap round (west of the first is the last); past the top
// and bottom rows lie the icy wastes, where no step goes. The engine's two lookups (`getNeighborsP` and
// `neighborInDir`, src/engine/world/map-helpers.ts) call this file; src/shared/ hands the player portal the step in a
// direction.
import { KC_HEX_DIRS } from '../../content/kingdoms-call-data.ts';

/** A place on the map: its row and column. */
interface APlaceOnTheMap {
  readonly row: number;
  readonly col: number;
}

/** The six steps, each a row and a column, from a hex on `row` to its neighbours, in the compass directions' order
 *  (KC_HEX_DIRS: NW, NE, W, E, SW, SE). An even row's neighbours above and below lie a column west of an odd row's. */
function theSixStepsFromAHexOnItsRow(row: number): readonly (readonly [number, number])[] {
  return row % 2 === 0
    ? [
        [-1, -1],
        [-1, 0],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
      ]
    : [
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, 0],
        [1, 1],
      ];
}

/** The place in the map's list (row × `cols` + column) of the hex `step` steps round from `prov` (0 to 5, in
 *  KC_HEX_DIRS' order), on a map `cols` wide and `rows` high: the columns wrap round; null past the top or bottom row. */
function theHexStepsRoundFromAProvince(prov: APlaceOnTheMap, step: number, cols: number, rows: number): number | null {
  const { row, col } = prov;
  const theStep = theSixStepsFromAHexOnItsRow(row)[step];
  if (!theStep) throw new TypeError('no step to a neighbour in that direction'); // never met: six directions, six steps
  const [dr, dc] = theStep;
  const nr = row + dr;
  if (nr < 0 || nr >= rows) return null;
  const nc = (((col + dc) % cols) + cols) % cols;
  return nr * cols + nc;
}

/** The place in the map's list (row × `cols` + column) of the hex next to `prov` in the compass direction `dir` (NW,
 *  NE, W, E, SW or SE), on a map `cols` wide and `rows` high: the columns wrap round; null past the top or bottom row,
 *  or for a direction that isn't one of the six. */
export function theHexNextToAProvinceInADirection(
  prov: APlaceOnTheMap,
  dir: string,
  cols: number,
  rows: number,
): number | null {
  const step = KC_HEX_DIRS.indexOf(dir);
  if (step < 0) return null;
  return theHexStepsRoundFromAProvince(prov, step, cols, rows);
}

/** The province next to `prov` in the compass direction `dir`, from the map's list `provinces` (in row order, `cols`
 *  wide and `rows` high): null past the top or bottom row, or for a direction that isn't one of the six; what the list
 *  holds there otherwise, even nothing. */
export function theProvinceNextToAProvinceInADirection<P>(
  prov: APlaceOnTheMap,
  dir: string,
  cols: number,
  rows: number,
  provinces: readonly P[],
): P | null | undefined {
  const at = theHexNextToAProvinceInADirection(prov, dir, cols, rows);
  return at === null ? null : provinces[at];
}

/** The provinces next to `prov`, from the map's list `provinces` (in row order, `cols` wide and `rows` high), in the
 *  compass directions' order (NW, NE, W, E, SW, SE): none past the top or bottom row, and none where the list holds
 *  nothing. */
export function theProvincesNextToAProvince<P>(
  prov: APlaceOnTheMap,
  cols: number,
  rows: number,
  provinces: readonly (P | null | undefined)[],
): P[] {
  return [0, 1, 2, 3, 4, 5]
    .map((step) => {
      const at = theHexStepsRoundFromAProvince(prov, step, cols, rows);
      return at === null ? null : provinces[at];
    })
    .filter((p): p is P => Boolean(p));
}
