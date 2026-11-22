// S1 of the world's making (generateNewGame, src/engine/world/generate.ts; the stages: docs/architecture/
// the-worlds-making-its-stages-their-files-and-how-a-stage-is-moved-into-one.md): PHASE 1, the capitals. Each king's
// home cell, off the top and bottom rows, as far apart as the map allows.
import { THE_CAPITALS } from '../../../content/the-worlds-making-its-numbers-by-stage-the-sea-the-capitals-the-taxes-the-lairs-the-seas-the-homes-and-the-heroes.ts';
import { kcRng } from '../../rng.ts';
import {
  type ACellOfTheGrid,
  type ARealmAsTheSetUpHandsIt,
  theOneMadeSure,
} from './what-every-stage-shares-the-shapes-it-hands-on-and-its-two-checks.ts';

/** A home layout's score: the closest pair's distance, how many pairs sit at it (taken from 0), each home's distance
 *  to its nearest summed. */
type ALayoutsScore = readonly [closest: number, pairsAtTheClosest: number, nearestSummed: number];
/** What the capitals' placement reads: the realms, the map's size, and the set-up's (S0's) two grid helpers. */
export interface WhatTheCapitalsPlacementReads {
  readonly setupPlayers: readonly ARealmAsTheSetUpHandsIt[];
  readonly cols: number;
  readonly rows: number;
  readonly cellIdRC: (r: number, c: number) => number;
  readonly cellDistRC: (a: ACellOfTheGrid, b: ACellOfTheGrid) => number;
}

/** S1, the capitals: each realm's home cell, in the realms' order, and the set of their ids. */
export function theCapitalsPlacedAsFarApartAsTheMapAllows({
  setupPlayers,
  cols,
  rows,
  cellIdRC,
  cellDistRC,
}: WhatTheCapitalsPlacementReads) {
  // ── PHASE 1: choose each king's HOME CELL first, as equidistant as possible ── Placing homes
  // before any terrain is decided lets us control player spacing directly rather than leaving it to
  // chance. Eligible cells exclude the top and bottom rows, so no king ever starts on the north or
  // south edge of the world. We build several candidate layouts by farthest-point placement and
  // keep the most spread-out one, so spacing is reliable (the player caps per map size assume this
  // — see MAP_MAX_PLAYERS in the setup form).
  const eligibleCells: ACellOfTheGrid[] = [];
  for (let r = 1; r <= rows - 2; r++) for (let c = 0; c < cols; c++) eligibleCells.push({ r, c, id: cellIdRC(r, c) });
  const buildLayout = () => {
    const hc: (ACellOfTheGrid | undefined)[] = [eligibleCells[Math.floor(kcRng() * eligibleCells.length)]]; // first king: random
    while (hc.length < setupPlayers.length) {
      // Farthest-point: pick the eligible cell whose NEAREST chosen king is as far away as
      // possible. Collect ALL cells that tie for the best distance and choose one at random.
      // Without this the scan order (row-first) always breaks ties toward the same rows, which —
      // combined with the horizontal map wrap — jams every king onto the top and bottom eligible
      // rows.
      let bestCells: ACellOfTheGrid[] = [],
        bestMin = -1;
      for (const cell of eligibleCells) {
        if (hc.some((h) => theOneMadeSure(h).id === cell.id)) continue;
        let minD = Infinity;
        for (const h of hc) {
          const d = cellDistRC(cell, theOneMadeSure(h));
          if (d < minD) minD = d;
        }
        if (minD > bestMin) {
          bestMin = minD;
          bestCells = [cell];
        } else if (minD === bestMin) {
          bestCells.push(cell);
        }
      }
      hc.push(
        bestCells.length
          ? bestCells[Math.floor(kcRng() * bestCells.length)]
          : eligibleCells[Math.floor(kcRng() * eligibleCells.length)],
      );
    }
    return hc;
  };
  const layoutMinDist = (hc: readonly (ACellOfTheGrid | undefined)[]) => {
    let ms = Infinity;
    for (let a = 0; a < hc.length; a++)
      for (let b = a + 1; b < hc.length; b++) {
        const d = cellDistRC(theOneMadeSure(hc[a]), theOneMadeSure(hc[b]));
        if (d < ms) ms = d;
      }
    return hc.length < 2 ? Infinity : ms;
  };
  // HARD FLOOR: a minimum spacing of 4 hexes — i.e. at least 3 empty ("neutral") provinces between
  // every pair of capitals. The map ladder (sizemap) is sized so this is reliably achievable at
  // each player count.
  const KING_MIN_SPACING = THE_CAPITALS.theLeastHexesBetweenTwoCapitals; // >=3 neutral hexes between capitals
  // 2026-09-27 (Toby item 1): capitals are now placed as FAR APART AS THE MAP ALLOWS, not merely
  // "far enough". The previous pass drew up to 1,200 farthest-point layouts, kept every one that
  // reached the floor of 4, and then chose among them AT RANDOM — so a world that could have seated
  // its kings 6 hexes apart routinely seated them at 4, and the spread was uneven because only the
  // single tightest pair was ever looked at. Three changes:
  //   1. SCORED, not merely floor-tested. `layoutScore` is a lexicographic triple —
  //      [minimum pairwise distance, −(number of pairs sitting at that minimum), Σ each king's
  //      nearest-neighbour distance]. The first term is the guarantee, the second breaks up
  //      crowding, and the third rewards an even spread once the tight pairs are settled.
  //   2. REFINED by hill-climbing (`refineLayout`): each king in turn is offered every free
  //      eligible cell and moved wherever the score improves, sweeping until nothing improves.
  //      Farthest-point placement is greedy and its random first seed routinely costs it a hex or
  //      two; the climb recovers that, and it is what makes the result even rather than merely
  //      spread. Sweeps are capped so world gen stays quick.
  //   3. The BEST-scoring refined layout wins, with a random draw only among EXACT ties — row
  //      variety is kept without paying for it in spacing.
  // `cellDistRC` is a lower bound on the true hex distance (max(|dc|,|dr|,(|dc|+|dr|)/2) on the
  // wrapped offset grid), so a layout accepted here is never closer than the floor in reality.
  const layoutScore = (hc: readonly (ACellOfTheGrid | undefined)[]): ALayoutsScore => {
    const n = hc.length;
    if (n < 2) return [Infinity, 0, Infinity];
    let mn = Infinity,
      nAtMin = 0;
    const near: number[] = new Array<number>(n).fill(Infinity);
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        const d = cellDistRC(theOneMadeSure(hc[a]), theOneMadeSure(hc[b]));
        if (d < Number(near[a])) near[a] = d;
        if (d < Number(near[b])) near[b] = d;
        if (d < mn) {
          mn = d;
          nAtMin = 1;
        } else if (d === mn) nAtMin++;
      }
    let nnSum = 0;
    for (let i = 0; i < n; i++) nnSum += Number(near[i]);
    return [mn, -nAtMin, nnSum];
  };
  const scoreCmp = (x: ALayoutsScore, y: ALayoutsScore) => {
    for (let i = 0; i < x.length; i++) {
      const xi = Number(x[i]),
        yi = Number(y[i]);
      if (xi !== yi) return xi < yi ? -1 : 1;
    }
    return 0;
  };
  const HOME_REFINE_SWEEPS = THE_CAPITALS.theSweepsThatRefineALayout;
  const refineLayout = (
    hc: readonly (ACellOfTheGrid | undefined)[],
  ): readonly [cells: (ACellOfTheGrid | undefined)[], score: ALayoutsScore] => {
    const cur = hc.slice();
    let curS = layoutScore(cur);
    if (cur.length < 2) return [cur, curS];
    for (let sweep = 0; sweep < HOME_REFINE_SWEEPS; sweep++) {
      let moved = false;
      for (let k = 0; k < cur.length; k++) {
        const taken = new Set(cur.map((h) => theOneMadeSure(h).id));
        let bestCell: ACellOfTheGrid | null = null,
          bestS = curS;
        for (const cell of eligibleCells) {
          if (taken.has(cell.id)) continue;
          const keep = cur[k];
          cur[k] = cell;
          const s = layoutScore(cur);
          cur[k] = keep;
          if (scoreCmp(s, bestS) > 0) {
            bestS = s;
            bestCell = cell;
          }
        }
        if (bestCell) {
          cur[k] = bestCell;
          curS = bestS;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return [cur, curS];
  };
  // Seeds: a handful of refined layouts is worth far more than a thousand raw ones, but on an
  // undersized custom map keep drawing (raw, unrefined, which is cheap) until something reaches the
  // floor before spending the refinement budget.
  const HOME_SEEDS = THE_CAPITALS.theLayoutsRefined;
  const _cands: (readonly [cells: (ACellOfTheGrid | undefined)[], score: ALayoutsScore])[] = [];
  for (let att = 0; att < HOME_SEEDS; att++) _cands.push(refineLayout(buildLayout()));
  if (!_cands.some((x) => isFinite(x[1][0]) && x[1][0] >= KING_MIN_SPACING)) {
    for (let att = 0; att < THE_CAPITALS.theRawLayoutsTriedWhenNoneKeepsTheSpacing; att++) {
      const raw = buildLayout();
      if (layoutMinDist(raw) >= KING_MIN_SPACING) {
        _cands.push(refineLayout(raw));
        break;
      }
    }
  }
  const _best = _cands.reduce<ALayoutsScore | null>((b, x) => (b == null || scoreCmp(x[1], b) > 0 ? x[1] : b), null);
  const _acceptable = _cands.filter((x) => _best !== null && scoreCmp(x[1], _best) === 0);
  const _pick = theOneMadeSure(_acceptable.length ? _acceptable[Math.floor(kcRng() * _acceptable.length)] : _cands[0]);
  const homeCells = _pick[0].map(theOneMadeSure),
    homeMin = _pick[1][0];
  if (!(homeMin >= KING_MIN_SPACING))
    console.warn(
      `World gen: no home layout on a ${String(cols)}x${String(rows)} map keeps ${String(KING_MIN_SPACING)} hexes between all ${String(setupPlayers.length)} capitals (best ${String(homeMin)}) — the map is too small for this many realms.`,
    );
  const homeIdSet = new Set(homeCells.map((h) => h.id));
  return { homeCells, homeIdSet };
}
