// Home placement (the rulings R-018 and R-057): the stretch of generateNewGame (src/engine/world/generate.ts) that picks
// each king's home cell, run on its own many times on each map size, from 2 realms to 10. On every layout each king has
// a cell of their own, and no home is on the top or bottom row (both hold by construction: the eligible cells leave out
// the edge rows, and a cell taken is never offered again). It prints, for each size, the closest pair of capitals
// (least, mean and most over the runs), the pairs at that distance, the mean distance to a king's nearest neighbour,
// and the layouts closer than 4 hexes, then "ALL OK" or "FAIL: n layouts below the floor".
//
// A layout closer than 4 hexes is printed, not failed, as the old script did (tests/README.md, "A running test that
// can't fail on its own findings"; KD-268 and KD-276 are the change that makes it fail, each its own pull request).
//
// Level 1 (unit): the statements from the one declaring cellIdRC through the one declaring cellDistRC, and from
// eligibleCells through homeCells, cut out of generateNewGame by their syntax tree (tests/lib/source.ts) and run as one
// function. Not lower: the layouts are computed. Not on a whole world: generateNewGame makes the whole map after the
// homes, and the runs (200 a size, or 1,000 under KC_FULL, in npm run test:full) would take minutes. The cut code
// draws its dice from a kcRng stream of its own (src/engine/rng.ts's kcRngStream), seeded from KC_SEED, so a run
// repeats from its seed.
//
// Until plan P1-14z this was tests/home-placement.test.js, which drew its dice from an unseeded Math.random and took
// its run count from the old runner's list (RUNS). Its checks and its printed table are here, as they were.
import vm from 'node:vm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { THE_CAPITALS } from '../../src/content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRngStream } from '../../src/engine/rng.ts';
import { statementsBetween } from '../lib/source.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const RUNS = process.env['KC_FULL'] === '1' ? 1000 : 200;
/** Columns, rows and realms, a map size each. */
const SIZES: Readonly<Record<string, readonly [cols: number, rows: number, realms: number]>> = {
  p2: [8, 5, 2],
  p3: [8, 7, 3],
  p4: [9, 7, 4],
  p5: [12, 7, 5],
  p6: [15, 7, 6],
  p7: [16, 7, 7],
  p8: [17, 8, 8],
  p9: [16, 11, 9],
  p10: [16, 11, 10],
};
/** The floor the rulings set: 4 hexes, three empty provinces, between every pair of capitals. */
const THE_FLOOR = 4;
/** One layout of 10 realms on a 16×11 map takes about 13 ms on a laptop; 75 ms each leaves room for a slow runner. */
const A_LIMIT_FOR_A_SIZE = timeLimitForPropertyRuns(RUNS, 75).timeout;

interface ACell {
  readonly r: number;
  readonly c: number;
  readonly id: number;
}
/** What the cut-out stretch hands back: the home cells, and its distance between two cells. */
interface ThePlacement {
  readonly homeCells: readonly ACell[];
  readonly cellDistRC: (a: ACell, b: ACell) => number;
}

const isACell = (value: unknown): value is ACell =>
  typeof value === 'object' && value !== null && 'r' in value && 'c' in value && 'id' in value;
const isThePlacement = (value: unknown): value is ThePlacement =>
  typeof value === 'object' &&
  value !== null &&
  'homeCells' in value &&
  Array.isArray(value.homeCells) &&
  value.homeCells.every(isACell) &&
  'cellDistRC' in value &&
  typeof value.cellDistRC === 'function';

/** The stretch cut out of generateNewGame, as one function of the capitals' numbers (content's THE_CAPITALS, which it
 *  reads), the dice and the map's size (set up before the tests, so a fault in it fails the tests, not the file's
 *  collection). */
let placeTheHomes: (...args: unknown[]) => unknown = () => null;
beforeAll(() => {
  const theGridsHelpers = statementsBetween('engine/world/generate.ts', 'generateNewGame', 'cellIdRC', 'cellDistRC');
  const thePlacement = statementsBetween('engine/world/generate.ts', 'generateNewGame', 'eligibleCells', 'homeCells');
  const compiled = vm.compileFunction(
    `const setupPlayers=new Array(nPlayers).fill(0).map((_,i)=>({id:i}));
${theGridsHelpers}
${thePlacement}
return {homeCells,homeMin,cellDistRC};`,
    ['THE_CAPITALS', 'kcRng', 'cols', 'rows', 'nPlayers'],
  );
  placeTheHomes = (...args) => Reflect.apply(compiled, undefined, [THE_CAPITALS, ...args]);
});
const kcRng = kcRngStream(SEED);

/** The homes of one layout of `realms` kings on a `cols`×`rows` map. */
function aLayout(cols: number, rows: number, realms: number): ThePlacement {
  const placed = placeTheHomes(kcRng, cols, rows, realms);
  if (!isThePlacement(placed)) throw new Error('the cut-out stretch handed back no home cells');
  return placed;
}

const average = (values: readonly number[]) => (values.reduce((s, x) => s + x, 0) / values.length).toFixed(2);
const theTable: string[] = [
  'map      cols x rows  realms  runs  minDist: min/avg/max   pairsAtMin avg   nnAvg   <4 fails  t/run(ms)',
];
let belowTheFloor = 0;

afterAll(() => {
  theTable.push(
    belowTheFloor === 0
      ? 'ALL OK — every layout keeps >=4 hexes (3 empty provinces) between every pair of capitals'
      : `FAIL: ${String(belowTheFloor)} layouts below the floor`,
  );
  console.log(theTable.join('\n'));
});

describe.each(Object.entries(SIZES))('%s', (size, [cols, rows, realms]) => {
  test(
    `${String(RUNS)} layouts of ${String(realms)} realms on a ${String(cols)}×${String(rows)} map: each king a cell of their own, none on an edge row`,
    () => {
      const closest: number[] = [],
        nearestMean: number[] = [],
        pairsAtTheClosest: number[] = [];
      let bad = 0;
      const t0 = performance.now();
      for (let i = 0; i < RUNS; i++) {
        const { homeCells, cellDistRC } = aLayout(cols, rows, realms);
        let least = Infinity,
          pairs = 0;
        const nearest = new Array<number>(realms).fill(Infinity);
        for (let a = 0; a < realms; a++)
          for (let b = a + 1; b < realms; b++) {
            const cellA = homeCells[a],
              cellB = homeCells[b];
            if (!cellA || !cellB) throw new Error(`layout ${String(i)}: fewer than ${String(realms)} homes`);
            const d = cellDistRC(cellA, cellB);
            nearest[a] = Math.min(nearest[a] ?? Infinity, d);
            nearest[b] = Math.min(nearest[b] ?? Infinity, d);
            if (d < least) {
              least = d;
              pairs = 1;
            } else if (d === least) pairs++;
          }
        closest.push(least);
        pairsAtTheClosest.push(pairs);
        nearestMean.push(nearest.reduce((s, x) => s + x, 0) / realms);
        if (least < THE_FLOOR) bad++;
        expect(new Set(homeCells.map((h) => h.id)).size, `layout ${String(i)}: a duplicate home cell`).toBe(realms);
        expect(
          homeCells.filter((h) => h.r < 1 || h.r > rows - 2),
          `layout ${String(i)}: a home on an edge row`,
        ).toEqual([]);
      }
      const msARun = (performance.now() - t0) / RUNS;
      belowTheFloor += bad;
      theTable.push(
        `${size.padEnd(8)} ${String(cols).padStart(4)} x ${String(rows).padStart(2)}  ${String(realms).padStart(6)} ${String(RUNS).padStart(5)}   ${String(Math.min(...closest))}/${average(closest)}/${String(Math.max(...closest))}          ${average(pairsAtTheClosest).padStart(6)}        ${average(nearestMean).padStart(5)}   ${String(bad).padStart(6)}   ${msARun.toFixed(1)}`,
      );
    },
    A_LIMIT_FOR_A_SIZE,
  );
});
