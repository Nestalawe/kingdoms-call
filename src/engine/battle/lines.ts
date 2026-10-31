import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { UNIT_BASE_STR, unitTypeOf } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { theWeightsADiscoveryGivesTheLinesBehindTheFront } from '../rules/the-registry-of-discovery-effects.ts';
import type { UnitAbilitySlug } from '../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { ArmyInABattle } from '../army-tables.ts';
import {
  aUnitAsTheGridNamesIt,
  type ASideAsABattlesReportLinesNameIt,
  type AUnitAsALineNamesIt,
  type AUnitAsTheGridNamesIt,
  type TheFactOfOneOfABattlesSentences,
  type TheOwnerOfABattlesUnits,
  type WhomAUnitFaced,
  type WhomAUnitMeets,
  type WhyAUnitFacesAsItDoes,
  type WhyAUnitStandsWhereItDoes,
} from './the-facts-a-battles-lines-record.ts';
import {
  aFlyerTakesAnOpenFlankNoRiderFills,
  aRiderTakesTheFlankOnRoughGround,
  theAbilityThatHoldsAUnitHitFromTheSide,
  theAbilityThatTurnsAnAnchoredLine,
  theMarksTheEnemyLineLeavesOnMine,
  theMultiplierOfAUnitsPlaceInTheLine,
  theStrengthOfAFlyer,
  theStrengthOfAShooterOverTheLine,
  theStrengthOfAUnitBesideAndBehindOthers,
  theStrengthOfAUnitMeetingAnother,
  theTargetAShooterPicks,
  type AnAbilityAsTheLadderNamesIt,
  type ARoleInTheBattleLine,
  type AUnitInTheLine,
  type WhereTwoUnitsMeet,
} from '../rules/the-registry-of-content-effects.ts';

// ── THE GRID'S TYPES ── what battleGrid places, what battleRegrid scores and what battleFacing faces.
/** A unit's part in the line (battleRole): in the air, cavalry, ranged, or on foot (everything else). */
export type BattleRole = ARoleInTheBattleLine;
/** The place a unit stands in its side's grid (battleRegrid). */
export type GridPlaceName = 'front' | 'second' | 'reserve' | 'flank' | 'air';
/** Whom a unit fought, and how (battleFaceSide): stamped on its row as `_faced` and on its place as `face`. */
export interface GridFacing {
  m: number;
  kind: 'even' | 'faces' | 'met' | 'wraps' | 'shoots' | 'duel' | 'guards' | 'free';
  vs: BattleRow | null;
  why: WhyAUnitFacesAsItDoes;
}
/** A unit's place and multiplier in its grid (battleRegrid), stamped on its row as `_g`. */
export interface GridPlace {
  place: GridPlaceName;
  col: number;
  mult: number;
  why: WhyAUnitStandsWhereItDoes;
  face?: GridFacing;
}
/** A unit's row as the grid takes it: the unit (none on some of the bots' estimates, which say `fly` instead), its
 *  final strength (`base`), and the marks the grid stamps on the row, never on the army. */
export interface BattleRow {
  a?: ArmyInABattle | null | undefined;
  base?: number | null | undefined;
  fly?: boolean | null | undefined;
  name?: string | null | undefined;
  _g?: GridPlace;
  _faced?: GridFacing;
}
/** A placed unit: its row, its part in the line and its strength. battleGrid makes every cell, from a row it has
 *  just checked, so `r` is always there. */
export interface GridCell {
  r: BattleRow;
  role: BattleRole;
  s: number;
}
/** A unit as battleRegrid scored it: its row, its place and multiplier, and why. */
export interface GridUnit {
  row: BattleRow;
  place: GridPlaceName;
  col: number;
  mult: number;
  why: WhyAUnitStandsWhereItDoes;
}
/** A side's grid as battleGrid places it, before battleRegrid scores it: the front and second lines as cells per
 *  column (a swap exchanges two of them, battleBestSwap), the reserve, the flanks, the flyers. */
export interface BattleGridCells {
  W: number;
  terrain: string | null;
  front: (GridCell | null | undefined)[];
  second: (GridCell | null | undefined)[];
  reserve: GridCell[];
  flanks: GridCell[];
  fly: GridCell[];
  cap: number | null;
  /** battleGrid always sets them; battleRegrid falls back on BATTLE_LINE_MULTS. */
  mults?: TheLinesMultipliers | null | undefined;
  frontSet: string;
}
/** A unit as battleFaceSide faced it. */
export interface AFacedUnit {
  row: BattleRow;
  place: GridPlaceName | '?';
  s: number;
  placeMult: number;
  m: number;
  kind: GridFacing['kind'];
  vs: BattleRow | null;
  why: WhyAUnitFacesAsItDoes;
}
/** A side faced against the other (battleFaceSide): `total` is the strength the dice see. */
export interface AFacedSide {
  total: number;
  units: AFacedUnit[];
  turned: boolean;
  anchored: boolean;
  duels: number;
  guarding: number;
  free: number;
}
/** A side's grid, scored (battleRegrid adds `units` and `total`), and faced once battleFacing has run. */
export type BattleGrid = BattleGridCells & { units: GridUnit[]; total: number; face?: AFacedSide };

// ── SKELETONS AND THE CASUALTY LOOPS ────
// change quality" — skeletons cannot promote or demote — but the guard sat above the DEATH roll as
// well, so a skeletal unit was immortal: in combatVsChar (all four branches, winner and loser
// alike) it could never be destroyed at all, and in combatVsNPC it was immortal on the winning
// side. That is why skeletal hosts "hardly ever die". The guard now sits on the QUALITY branches
// only; skeletons roll for destruction at exactly the same rate as anyone else, and their line says
// their bones crumble to dust (they leave no grave — see recordBattleGraves). Deathless March (an
// all-skeletal Undead force is never cut down in FLIGHT) is untouched: that is a rout rule, not an
// immunity.

// ── BATTLE LINES — ONE source of truth for every battle site (NPC attack, NPC defence, PvP both
// sides, the stay-or-retreat estimate, and the bots' battle model). 2026-10-11 (Toby): ROWS AND
// COLUMNS. The ground allows a front of so many units, rolled fresh for each battle (plains and
// desert 6–8, forest and jungle 4–6, mountain 2–4, sea 8–10) and the same for both sides. Each side
// is placed by unit TYPE (KC_UNIT_TYPE):
//   • flanks (plains and desert only): up to Tactical+1 cavalry fight at full strength and take no
//     place in the front;
//   • front: infantry and the rest of the cavalry, strongest first; a ranged unit steps into an empty
//     front place only when nothing else can, and fights there at ×0.75;
//   • second line: a ranged unit standing behind a fighter in its own column shoots over it at FULL
//     strength; anything else in the second line fights at ×0.5;
//   • reserve: ×0.25 for the next `width` units, ×0.125 beyond (sd09 Flanking Tactics lifts the
//     ×0.5 / ×0.25 / ×0.125 steps, as it always has);
//   • the winged riders and the flying beasts (KC_UNIT_CLASS.aerial) fight from the air and take no
//     place: full strength up to the enemy's ground units in line plus their flyers (never fewer than 2),
//     and ×0.5 beyond that. (2026-10-13, the beast abilities: the flying beasts used to hold a place like
//     infantry. Archers still single out the riders only, and hit them twice as hard: FLYING_TYPES.)
// At sea the hulls and sea-beasts take the front before any carried land unit, and there are no
// flanks. Columns fill strongest-in-the-centre, so the grid a report prints is the grid that was
// scored. Who faces whom is then read off the two grids (battleFacing, below the print helpers).
/** A ground's front: the fewest and the most units it allows. */
type AGroundsFrontRange = [fewest: number, most: number];
export const BATTLE_FRONT_RANGE = {
  plain: [6, 8],
  desert: [6, 8],
  sea: [8, 10],
  forest: [4, 6],
  jungle: [4, 6],
  mountain: [2, 4],
} satisfies Record<string, AGroundsFrontRange>;
/** The same table, read by any terrain: one it doesn't hold reads the plain's. */
const FRONT_RANGE_ON: Readonly<Record<string, AGroundsFrontRange | undefined>> = BATTLE_FRONT_RANGE;
export const BATTLE_FLANK_TERRAINS: ReadonlySet<string | null> = new Set(['plain', 'desert']);
/** The multipliers of the four lines behind the flanks: the front, the second line, the reserve, the deep reserve. */
type TheLinesMultipliers = readonly [front: number, second: number, reserve: number, deepReserve: number];
export const BATTLE_LINE_MULTS: TheLinesMultipliers = [1, 0.5, 0.25, 0.125]; // front · second line (not shooting over) · reserve · deep reserve
export const BATTLE_LINE_MULTS_FLANK: TheLinesMultipliers = [1, 0.75, 0.5, 0.25]; // sd09's fallback if its data row carries no `lines`
export const BATTLE_RANGED_IN_FRONT = 0.75,
  BATTLE_FLYER_BEYOND_CAP = 0.5,
  BATTLE_FLYER_CAP_MIN = 2,
  BATTLE_FLANK_TAC_CAP = 5;
// Own copies of the three class lists the grid reads (each consumer builds its own, see the data file).
export const GRID_FLY_TYPES = new Set(KC_UNIT_CLASS.aerial),
  GRID_CAV_TYPES = new Set(KC_UNIT_CLASS.cavalry),
  GRID_SEA_TYPES = new Set(KC_UNIT_CLASS.sea);
// The width this battle's ground allows: ONE roll per battle, shared by both sides.
export function rollBattleWidth(terrain: string) {
  const r = FRONT_RANGE_ON[terrain] ?? BATTLE_FRONT_RANGE.plain;
  return r[0] + Math.floor(kcRng() * (r[1] - r[0] + 1));
}
// The middle of the range: what the bots' estimates and the Strategist's command score assume.
export function battleFrontWidth(terrain: string) {
  const r = FRONT_RANGE_ON[terrain] ?? BATTLE_FRONT_RANGE.plain;
  return Math.round((r[0] + r[1]) / 2);
}
/** A discovery's `lines` that flankLineMults takes: a list of four (its numbers are the data file's). */
function isFourLineMultipliers(l: unknown): l is TheLinesMultipliers {
  return Array.isArray(l) && l.length === 4;
}
export function flankLineMults(): TheLinesMultipliers {
  // the discoveries' registry's since plan P1-19ab: "strength: a realm's discoveries weight the lines behind the front"
  const l = theWeightsADiscoveryGivesTheLinesBehindTheFront();
  return isFourLineMultipliers(l) ? l : BATTLE_LINE_MULTS_FLANK;
}
// A row's place comes from its unit's type: 'fly' for the winged riders and the flying beasts (no place
// in the line), 'cav', 'arc' (ranged), and 'foot' for everything else — infantry, the walking and
// swimming beasts, fleets, elementals, and any type the tables have never heard of. A row with no unit on it (the
// bots' estimates) falls back on its own `fly` flag.
export function battleRole(row: BattleRow | null | undefined, terrain: string | null): BattleRole {
  const t = row?.a?.type;
  if (t == null) return row?.fly ? 'fly' : 'foot';
  if (GRID_FLY_TYPES.has(t)) return 'fly';
  if (terrain !== 'sea' && GRID_CAV_TYPES.has(t)) return 'cav'; // no horse charges at sea
  if (unitTypeOf(t) === 'ranged') return 'arc';
  return 'foot';
}
// (The grid's short unit codes, UNIT_SHORT and shortUnit, are the prose's since plan P1-12d4: src/views/prose/.)
// Place one side and score it. rows: [{a, base, fly, …}] with `base` the unit's FINAL per-unit
// strength (every modifier and this battle's pre-battle damage already in). opts: {tac, flank,
// enemy, enemyTac} — `enemy` is the other side's rows (or its placed grid), needed only for the
// flyer cap; without it flyers are uncapped (the bots' estimates). Returns the grid: the front and
// second lines as cells per column, the reserve, the flanks, the flyers, every row's place and
// multiplier (also stamped on the row as `_g`, never on the army), and `total`.
/** battleGrid's options: the side's Tactical and Flanking Tactics, and the enemy's rows (or grid) and Tactical. */
export interface BattleGridOptions {
  tac?: number | null | undefined;
  flank?: boolean | null | undefined;
  enemy?: (BattleRow | null | undefined)[] | BattleGrid | null | undefined;
  enemyTac?: number | null | undefined;
}
export function battleGrid(
  rows: readonly (BattleRow | null | undefined)[] | null | undefined,
  width: number,
  terrain: string | null,
  opts?: BattleGridOptions | null,
): BattleGrid {
  opts = opts ?? {};
  const W = Math.max(1, width | 0);
  const mults = opts.flank ? flankLineMults() : BATTLE_LINE_MULTS;
  const tac = Math.max(0, Math.min(BATTLE_FLANK_TAC_CAP, Number(opts.tac) | 0));
  const R: GridCell[] = (rows ?? [])
    .filter((r): r is BattleRow => Boolean(r))
    .map((r) => ({ r, role: battleRole(r, terrain), s: Number(r.base) || 0 }));
  const byS = (a: GridCell, b: GridCell) => b.s - a.s;
  const fly = R.filter((x) => x.role === 'fly').sort(byS);
  let cav = R.filter((x) => x.role === 'cav').sort(byS);
  // Flank slots (Unit abilities, 2026-10-11): on open ground Tactical + 1 riders; on rough ground one, and
  // only for the cavalry bred for it (the rule registry's stage "a rider takes the flank on rough ground":
  // Through the Trees, Through the Glades, Crag Charge); none at sea. On open ground a slot no rider fills
  // may be held by a flyer that leaves the air for the flank (the stage "a flyer takes an open flank no
  // rider fills": Stoop on the Horses).
  const open = BATTLE_FLANK_TERRAINS.has(terrain);
  const slots = open ? tac + 1 : terrain === 'sea' ? 0 : 1;
  let flanks: GridCell[] = [];
  if (open) {
    flanks = cav.slice(0, slots);
    cav = cav.slice(slots);
  } else if (slots) {
    const i = cav.findIndex((x) => abilityFlanksRough(x, terrain));
    const rider = cav[i];
    if (i >= 0 && rider) {
      flanks = [rider];
      cav = cav.filter((_, k) => k !== i);
    }
  }
  if (open && flanks.length < slots) {
    const eagles = fly
      .filter((x) => aFlyerTakesAnOpenFlankNoRiderFills({ theUnit: inTheLine(x), ground: terrain }))
      .slice(0, slots - flanks.length);
    eagles.forEach((e) => {
      flanks.push(e);
      fly.splice(fly.indexOf(e), 1);
    });
  }
  const seaFirst = (x: GridCell) => (terrain === 'sea' && x.r.a && GRID_SEA_TYPES.has(x.r.a.type) ? 1 : 0); // at sea the hulls hold the front
  const fighters = R.filter((x) => x.role === 'foot')
    .concat(cav)
    .sort((a, b) => seaFirst(b) - seaFirst(a) || byS(a, b));
  const arcs = R.filter((x) => x.role === 'arc').sort(byS);
  const front = fighters.slice(0, W),
    spare = fighters.slice(W);
  const back = arcs.slice(0, front.length);
  let arcLeft = arcs.slice(front.length);
  while (front.length < W && arcLeft.length) {
    const next = arcLeft.shift();
    if (!next) break; // the loop has just checked one is left
    front.push(next); // only when nothing else can
  }
  const pool = back.concat(spare, arcLeft); // ranged behind fighters first
  const second = pool.slice(0, W),
    reserve = pool.slice(W);
  // Columns: a centred block, the strongest at the most central column, alternating outwards.
  const mid = (W - 1) / 2,
    order = [...Array(W).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  const frontCells = new Array<GridCell | null | undefined>(W).fill(null),
    secondCells = new Array<GridCell | null | undefined>(W).fill(null);
  {
    const n = front.length,
      off = Math.floor((W - n) / 2);
    const occ = [...Array(n).keys()].map((k) => k + off).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
    front.forEach((x, k) => {
      const col = occ[k];
      if (col !== undefined) frontCells[col] = x; // occ holds a column for each of the front's n units
    });
  }
  {
    const a = second.filter((x) => x.role === 'arc'),
      o = second.filter((x) => x.role !== 'arc');
    order.forEach((c) => {
      const f = frontCells[c];
      if (f && f.role !== 'arc' && a.length) secondCells[c] = a.shift();
    });
    const q = a.concat(o);
    order.forEach((c) => {
      if (!secondCells[c] && q.length) secondCells[c] = q.shift();
    });
  }
  // Flyer cap: the enemy's ground units in line (front and flanks) plus their flyers, never below 2.
  let cap = Infinity,
    E = opts.enemy;
  if (E) {
    if (Array.isArray(E)) E = battleGrid(E, W, terrain, { tac: opts.enemyTac });
    cap = Math.max(BATTLE_FLYER_CAP_MIN, E.front.filter(Boolean).length + E.flanks.length + E.fly.length);
  }
  return battleRegrid({
    W,
    terrain,
    front: frontCells,
    second: secondCells,
    reserve,
    flanks,
    fly,
    cap: isFinite(cap) ? cap : null,
    mults,
    frontSet: frontCells
      .filter((x): x is GridCell => Boolean(x))
      .map((x) => x.role)
      .sort()
      .join(),
  }); // the kinds of unit the front was deployed with (battleLegal)
}
// Score a grid from its cells: every unit's place and multiplier (stamped on the row as `_g`) and the
// total. battleGrid ends here, and the line-up (battleBestSwap) calls it again after every swap.
export function battleRegrid(g: BattleGridCells): BattleGrid {
  const W = g.W,
    mults = g.mults ?? BATTLE_LINE_MULTS,
    cap = g.cap ?? Infinity;
  const units: GridUnit[] = [];
  let total = 0;
  const put = (x: GridCell, place: GridPlaceName, col: number, mult: number, why: WhyAUnitStandsWhereItDoes) => {
    const s: GridPlace = { place, col, mult, why };
    x.r._g = s;
    units.push({ row: x.r, place, col, mult, why });
    total += x.s * mult;
  };
  // A unit's own place in the line (the rule registry's stage "its place in the line": Brawling Archers in the front,
  // Colossal Bulk in the second line), else the line's own.
  const itsOwnPlace = (x: GridCell, itsLine: 'front' | 'second') =>
    theMultiplierOfAUnitsPlaceInTheLine({ theUnit: inTheLine(x), ground: g.terrain, itsLine });
  g.front.forEach((x, c) => {
    if (!x) return;
    const own = itsOwnPlace(x, 'front');
    if (own)
      put(x, 'front', c, own.multiplier, {
        kind: 'its ability gives it its place',
        ability: own.ability,
        itsLine: 'front',
      });
    else
      put(
        x,
        'front',
        c,
        x.role === 'arc' ? BATTLE_RANGED_IN_FRONT : 1,
        x.role === 'arc' ? { kind: 'a ranged unit in the front line' } : { kind: 'a unit in the front line' },
      );
  });
  g.second.forEach((x, c) => {
    if (!x) return;
    const f = g.front[c];
    if (x.role === 'arc' && f && f.role !== 'arc') {
      put(x, 'second', c, 1, {
        kind: 'a ranged unit shooting over its fighter',
        theFighter: aUnitAsTheGridNamesIt(f.r),
      });
      return;
    }
    const own = itsOwnPlace(x, 'second');
    if (own)
      put(x, 'second', c, own.multiplier, {
        kind: 'its ability gives it its place',
        ability: own.ability,
        itsLine: 'second',
      });
    else put(x, 'second', c, mults[1], { kind: 'a unit in the second line' });
  });
  g.reserve.forEach((x, k) => {
    put(
      x,
      'reserve',
      k,
      k < W ? mults[2] : mults[3],
      k < W ? { kind: 'a unit in the reserve' } : { kind: 'a unit in the deep reserve' },
    );
  });
  g.flanks.forEach((x, k) => {
    put(x, 'flank', k, 1, { kind: 'a rider on the flank' });
  });
  g.fly.forEach((x, k) => {
    put(
      x,
      'air',
      k,
      k < cap ? 1 : BATTLE_FLYER_BEYOND_CAP,
      k < cap ? { kind: 'a flyer in the air' } : { kind: 'a flyer in the air beyond the line' },
    );
  });
  return Object.assign(g, { units, total }); // the grid it was handed, with its units and total
}
// The old entry point, kept for the estimates that only need a total (the bots, the Strategist's
// command score, the stay-or-retreat test). opts as battleGrid's, plus `terrain`.
export function battleLineTotal(
  rows: readonly (BattleRow | null | undefined)[] | null | undefined,
  width: number,
  flank: boolean | null | undefined,
  opts?: (BattleGridOptions & { terrain?: string | null | undefined }) | null,
) {
  return battleGrid(rows, width, (opts?.terrain ?? '') || null, Object.assign({}, opts ?? {}, { flank })).total;
}
// ── The grid in the report ── one line names the ground, then two 📊 lines a side: cells five wide,
// "·" for an empty place, the defender's second line above its front and the attacker's below, so the
// two fronts meet in the middle. The portals draw a 📊 line that contains "│" in monospace. The lines hold the units
// each place names, copied as they are told; the prose writes the cells and the ground's words (plan P1-12d4).
export function battleWidthLine(terrain: string, W: number): TheFactOfOneOfABattlesSentences {
  return { kind: 'the ground allows a front of a width', terrain, frontWidth: W };
}
export function battleGridLines(
  label: ASideAsABattlesReportLinesNameIt | null | undefined,
  g: BattleGridCells | null | undefined,
  defender: boolean | null | undefined,
): TheFactOfOneOfABattlesSentences[] {
  if (!g) return [];
  const cell = (x: GridCell | null | undefined) => (x ? aUnitAsTheGridNamesIt(x.r) : null);
  const l1: TheFactOfOneOfABattlesSentences = {
    kind: "a side's front line in the battle grid",
    sideName: label,
    theFrontLine: g.front.map(cell),
    theFlanks: g.flanks.map((x) => aUnitAsTheGridNamesIt(x.r)),
    theAir: g.fly.map((x) => aUnitAsTheGridNamesIt(x.r)),
    theReserve: g.reserve.map((x) => aUnitAsTheGridNamesIt(x.r)),
  };
  const l2: TheFactOfOneOfABattlesSentences | null = g.second.some(Boolean)
    ? { kind: "a side's second line in the battle grid", sideName: label, theSecondLine: g.second.map(cell) }
    : null;
  const isALine = <L>(l: L | null): l is L => Boolean(l);
  return defender ? [l2, l1].filter(isALine) : [l1, l2].filter(isALine);
}
// (The ladder's Battle-lines stage, battleGridStage, is the prose's since plan P1-12d4: src/views/prose/.)
// ── WHO FACES WHOM (Battle lines II, 2026-10-11, Toby) ── Once both grids stand, each unit's place is
// read against the enemy's. A front unit fights the enemy unit in its own column, and the matchup
// counts (BATTLE_FACING.front: my role → the enemy's → multiplier). A second-line ranged unit shooting
// over its fighter hits the enemy front unit in its column (BATTLE_FACING.back). Where one front is
// wider, its units with nobody opposite wrap round the enemy line's end (×1.2) and that end unit is
// struck from the side (×0.9), unless a spare enemy flank rider guards it. Flank riders pair off in
// duels; a rider left over guards a threatened end; a rider with no duel and no end to guard rides
// free (×1.3) and, on open ground, turns the enemy's flank: their second-line ranged units fight at
// ×0.75, unless infantry anchor both ends of their line. Each effect multiplies the unit's placed
// strength; the ladder's "Who faces whom" stage names them, and every row is stamped _faced for the
// report. Both fronts are centred blocks, so a column inside the enemy's span always has an enemy in
// it. The matchup abilities of single unit types come with the Unit abilities PR.
export const BATTLE_FACING = {
  front: { cav: { arc: 1.25, foot: 0.85 }, foot: { cav: 1.15, arc: 1.25 } }, // anything unlisted is ×1 (foot v foot, cav v cav, a ranged unit caught in the front…)
  back: { foot: 1.25, cav: 0.75 }, // shooting the enemy front unit opposite; ranged v ranged ×1
  wrap: 1.2,
  sideHit: 0.9,
  freeFlank: 1.3,
  turned: 0.75,
};
/** A facing table (BATTLE_FACING.front): my role → the enemy's → the multiplier. */
type AFacingTable = Readonly<Record<string, Readonly<Record<string, number | undefined>> | undefined>>;
export const faceMult = (t: AFacingTable | null | undefined, a: string, b: string) => {
  const r = t?.[a];
  const m = r?.[b];
  return typeof m === 'number' ? m : 1;
};
/** BATTLE_FACING.back, read by any role. */
const BACK_MULT_OF: Readonly<Record<string, number | undefined>> = BATTLE_FACING.back;
export const backMult = (r: string) => {
  const m = BACK_MULT_OF[r];
  return typeof m === 'number' ? m : 1;
};
// ── UNIT ABILITIES IN THE LINE (2026-10-11, Toby) ── Every humanoid unit has a matchup ability, read here
// when a unit meets another (faces, is met by, duels, guards) or shoots over its fighter, and one more
// ability, some of which also live here (the flank slots and places above, which battleGrid and battleRegrid ask the
// rule registry; the whole line's, which battleFaceSide asks the rule
// registry: Shieldwall, Sergeants, Driven Before Them, Terror From Above, Dive on the Bowmen, Flak Gunners, …) and the
// rest in the volley, fate and end-of-turn code. Each returns the multiplier and the abilities that moved it, by their
// slugs, for the ladder and the report (the prose writes their names: plan P1-12d4). tests/abilities-* hold every one of
// them.
/** A cell's unit type: any cell, or an empty place (null). */
export const typeOfX = (
  x:
    | { readonly r?: { readonly a?: { readonly type?: string } | null | undefined } | null | undefined }
    | null
    | undefined,
) => x?.r?.a?.type;
export const abilityHas = (
  g: Partial<Pick<BattleGridCells, 'front' | 'second' | 'reserve' | 'flanks' | 'fly'>> | null | undefined,
  type: string,
) =>
  !!g &&
  (['front', 'second', 'reserve', 'flanks', 'fly'] satisfies (keyof BattleGridCells)[]).some((k) =>
    (g[k] ?? []).some((x) => x && typeOfX(x) === type),
  );
export const GRID_MONSTER_TYPES: ReadonlySet<string | undefined> = new Set(KC_UNIT_CLASS.monster);
// The cavalry that may take the one flank slot rough ground allows: the rule registry's stage "a rider takes the flank
// on rough ground" (Through the Trees and, since 2026-10-13, the beast abilities, Through the Glades in the woods; Crag
// Charge in the mountains).
export function abilityFlanksRough(x: GridCell, terrain: string | null) {
  return aRiderTakesTheFlankOnRoughGround({ theUnit: inTheLine(x), ground: terrain });
}
// x meets e (both placed cells {r, role, s}): the role matchup, then x's ability, then e's. where:
// 'front' (facing or met), 'duel' (flank riders), 'guard' (a rider guarding a line end); meIsAtk: x's side attacks.
/** A matchup's multiplier, and the abilities that moved it, as the ladder names them. */
interface AMatchup {
  m: number;
  abilities: readonly AnAbilityAsTheLadderNamesIt[];
}
export function abilityFront(
  x: GridCell,
  e: GridCell,
  terrain: string | null,
  where: WhereTwoUnitsMeet,
  meIsAtk: boolean,
): AMatchup {
  const et = typeOfX(e);
  // The unit's ability, then the one met's (the rule registry's two stages, plan P1-19b): each sets or multiplies the
  // role matchup's multiplier and names itself.
  const moved = theStrengthOfAUnitMeetingAnother(
    {
      theUnit: { unitType: typeOfX(x), role: x.role },
      theUnitItMeets: { unitType: et, role: e.role },
      theUnitItMeetsIsAMonsterOrSkeletal: GRID_MONSTER_TYPES.has(et) || !!e.r.a?._isSkeletal,
      ground: terrain,
      where,
      theUnitsSideAttacks: meIsAtk,
    },
    faceMult(BATTLE_FACING.front, x.role, e.role),
  );
  return { m: moved.multiplier, abilities: moved.abilities };
}
// x, a second-line ranged unit, shoots e, an enemy front unit: the shooter's ability, then the target's (the rule
// registry's two stages, plan P1-19b).
export function abilityBack(x: GridCell, e: GridCell): AMatchup {
  const et = typeOfX(e);
  const moved = theStrengthOfAShooterOverTheLine(
    {
      theShooter: { unitType: typeOfX(x), role: x.role },
      theTarget: { unitType: et, role: e.role },
      theTargetsBaseStrength: et !== undefined ? (UNIT_BASE_STR[et] ?? 0) : 0,
    },
    backMult(e.role),
  );
  return { m: moved.multiplier, abilities: moved.abilities };
}
/** A placed unit as the rule registry's stages read it: its type and its part in the line (none for an empty place). */
const inTheLine = (x: GridCell): AUnitInTheLine => ({ unitType: typeOfX(x), role: x.role });
const inTheLineOrNone = (x: GridCell | null | undefined): AUnitInTheLine | null => (x ? inTheLine(x) : null);
// The engagement: each side's span of the front, the columns where it overlaps the enemy's span
// (nearest the centre first), how many flank duels there are, and which overlapping enemy columns each
// side's spare riders cover (alternating sides, nearest first). Riders left after that ride free.
/** The first and last columns a side's front holds. */
type AFrontsSpan = [first: number, last: number];
/** One side's part of the engagement (battleEngage). */
export interface ASidesEngagement {
  span: AFrontsSpan | null;
  duel: number;
  /** Its front's columns beyond the enemy's span, left and right, nearest the centre first. */
  over: { L: number[]; R: number[] };
  /** The enemy's overlapping columns its spare riders cover. */
  blocking: { col: number; side: 'L' | 'R' }[];
  free: number;
}
export function battleEngage(gA: BattleGridCells, gD: BattleGridCells): Record<'A' | 'D', ASidesEngagement> {
  const span = (g: BattleGridCells): AFrontsSpan | null => {
    const i = g.front.map((x, k) => (x ? k : -1)).filter((k) => k >= 0);
    const first = i[0],
      last = i[i.length - 1];
    return first !== undefined && last !== undefined ? [first, last] : null;
  };
  const over = (me: BattleGridCells, ts: AFrontsSpan | null) => {
    const L: number[] = [],
      R: number[] = [];
    if (ts)
      me.front.forEach((x, i) => {
        if (x && i < ts[0]) L.unshift(i);
        if (x && i > ts[1]) R.push(i);
      });
    return { L, R };
  };
  const sA = span(gA),
    sD = span(gD),
    duel = Math.min(gA.flanks.length, gD.flanks.length);
  const E: Record<'A' | 'D', ASidesEngagement> = {
    A: { span: sA, duel, over: over(gA, sD), blocking: [], free: gA.flanks.length - duel },
    D: { span: sD, duel, over: over(gD, sA), blocking: [], free: gD.flanks.length - duel },
  };
  for (const [k, ko] of [
    ['A', 'D'],
    ['D', 'A'],
  ] satisfies ['A' | 'D', 'A' | 'D'][]) {
    const e = E[k];
    const o = { L: [...E[ko].over.L], R: [...E[ko].over.R] };
    let side: 'L' | 'R' = 'L';
    while (e.free > 0 && (o.L.length || o.R.length)) {
      const s = o[side].length ? side : side === 'L' ? 'R' : 'L';
      const col = o[s].shift();
      if (col === undefined) break; // the loop has just checked that side s has a column left
      e.blocking.push({ col, side: s });
      e.free--;
      side = side === 'L' ? 'R' : 'L';
    }
  }
  return E;
}
// Face one side against the other. me / them: the two grids (same W); mine / theirs: their engagement;
// meIsAtk: `me` is the attacker (Hold the Gate and Bloodthirsty belong to a defending garrison).
export function battleFaceSide(
  me: BattleGrid,
  them: BattleGrid,
  mine: ASidesEngagement,
  theirs: ASidesEngagement,
  terrain: string | null,
  meIsAtk: boolean,
): AFacedSide {
  const byRow = new Map<BattleRow, GridUnit>(me.units.map((u) => [u.row, u]));
  const units: AFacedUnit[] = [];
  let total = 0;
  const put = (
    x: GridCell,
    m: number,
    kind: GridFacing['kind'],
    vs: GridCell | null | undefined,
    why: WhyAUnitFacesAsItDoes,
  ) => {
    const u = byRow.get(x.r);
    const pm = u ? u.mult : 1;
    const f: GridFacing = { m, kind, vs: vs ? vs.r : null, why };
    if (x.r._g) x.r._g.face = f;
    x.r._faced = f;
    units.push({ row: x.r, place: u ? u.place : '?', s: x.s, placeMult: pm, m, kind, vs: f.vs, why });
    total += x.s * pm * m;
  };
  const idx = me.front.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  const guardOf = new Map<number, GridCell | undefined>(
    theirs.blocking.map((b, j) => [b.col, them.flanks[theirs.duel + j]]),
  ); // my overlapping column → the enemy rider covering it
  const myOver = new Set([...mine.over.L, ...mine.over.R]);
  const covered = new Set(mine.blocking.map((b) => b.col)); // the enemy's overlapping columns my riders cover
  const hitL = theirs.over.L.some((c) => !covered.has(c)),
    hitR = theirs.over.R.some((c) => !covered.has(c));
  const endHit = new Set<number | undefined>();
  if (idx.length) {
    if (hitL) endHit.add(idx[0]);
    if (hitR) endHit.add(idx[idx.length - 1]);
  }
  const footish = (x: GridCell | null | undefined) => !!x && x.role === 'foot';
  const firstCol = idx[0],
    lastCol = idx[idx.length - 1]; // both there exactly when the front holds a unit
  const anchored =
    firstCol !== undefined && lastCol !== undefined && footish(me.front[firstCol]) && footish(me.front[lastCol]);
  const freeRiders = them.flanks.slice(theirs.duel + theirs.blocking.length);
  // Free riders that turn even an anchored line (Battering Horns: a free Ram), by the rule registry (plan P1-19c): its
  // slug, or none.
  const horns = theAbilityThatTurnsAnAnchoredLine({ theFreeEnemyRiders: freeRiders.map(inTheLine) });
  const turned = BATTLE_FLANK_TERRAINS.has(terrain) && freeRiders.length > 0 && (!anchored || horns !== null);
  // What the enemy's line marks on mine (Terror From Above: my strongest front unit; Dive on the Bowmen: my strongest
  // shooting archer; Storm Wings: my units in the air), each applied last where the unit marked fights.
  const marks = theMarksTheEnemyLineLeavesOnMine(
    { theFront: me.front, theSecondLine: me.second, theAir: me.fly },
    (t) => abilityHas(them, t),
  );
  /** The marks on a unit, in the stage's order: its multiplier after them, and the abilities that marked it. */
  const marked = (x: GridCell, m: number): [number, AnAbilityAsTheLadderNamesIt[]] => {
    const marking: AnAbilityAsTheLadderNamesIt[] = [];
    for (const mark of marks)
      if (mark.theUnitsMarked.includes(x)) {
        m *= mark.factor;
        marking.push(mark.ability);
      }
    return [m, marking];
  };
  /** A unit as the facing names it. */
  const named = (x: GridCell): AUnitAsTheGridNamesIt => aUnitAsTheGridNamesIt(x.r);
  /** Why a unit fights as it does, with nothing more than its name. */
  const plainly = (x: GridCell): WhyAUnitFacesAsItDoes => ({
    theUnit: named(x),
    meets: null,
    itsOwnAbilities: [],
    marks: [],
  });
  const theEnemyFront = them.front.filter((y): y is GridCell => Boolean(y));
  me.front.forEach((x, c) => {
    if (!x) return;
    const e = them.front[c];
    let m = 1,
      kind: GridFacing['kind'] = 'even',
      vs: GridCell | null | undefined = null,
      meets: WhomAUnitMeets | null = null,
      atAWrappedEnd: { heldBy: UnitAbilitySlug | null } | null = null;
    if (e) {
      vs = e;
      const f = abilityFront(x, e, terrain, 'front', meIsAtk);
      m = f.m;
      kind = 'faces';
      meets = { kind: 'it faces a unit', theOther: named(e), abilities: f.abilities };
    } else if (myOver.has(c)) {
      const g = guardOf.get(c);
      if (g) {
        vs = g;
        const f = abilityFront(x, g, terrain, 'front', meIsAtk);
        m = f.m;
        kind = 'met';
        meets = { kind: 'it is met by a rider', theOther: named(g), abilities: f.abilities };
      } else {
        const ts = theirs.span;
        vs = ts ? them.front[c < ts[0] ? ts[0] : ts[1]] : null;
        m = BATTLE_FACING.wrap;
        kind = 'wraps';
        meets = { kind: "it wraps the line's end" };
      }
    }
    const unit = inTheLine(x);
    if (endHit.has(c)) {
      // Never hit from the side (Unbreakable, Rooted, Hold the Gate: the rule registry's stage), or hit.
      const held = theAbilityThatHoldsAUnitHitFromTheSide({ theUnit: unit, theUnitsSideAttacks: meIsAtk });
      if (held) atAWrappedEnd = { heldBy: held };
      else {
        m *= BATTLE_FACING.sideHit;
        atAWrappedEnd = { heldBy: null };
      }
    }
    // The units beside it and behind it (Shieldwall with Town Watch, Sergeants, Driven Before Them).
    const beside = theStrengthOfAUnitBesideAndBehindOthers(
      {
        theUnit: unit,
        theUnitsEitherSide: [inTheLineOrNone(me.front[c - 1]), inTheLineOrNone(me.front[c + 1])],
        theUnitBehind: inTheLineOrNone(me.second[c]),
      },
      m,
    );
    m = beside.multiplier;
    const [mm, marking] = marked(x, m);
    put(x, mm, kind, vs, {
      theUnit: named(x),
      meets,
      ...(atAWrappedEnd ? { atAWrappedEnd } : {}),
      itsOwnAbilities: beside.abilities,
      marks: marking,
    });
  });
  me.second.forEach((x, c) => {
    if (!x) return;
    const f = me.front[c];
    if (x.role === 'arc' && f && f.role !== 'arc') {
      let e = them.front[c];
      let m = 1,
        meets: WhomAUnitMeets;
      // A shooter that picks its target along the enemy front (Marksmen), by what each shot is worth.
      const pick = theTargetAShooterPicks(inTheLine(x), () => theEnemyFront.map((y) => abilityBack(x, y).m * y.s));
      if (pick !== null) e = theEnemyFront[pick];
      if (e) {
        const b = abilityBack(x, e);
        m = b.m;
        meets = { kind: 'it shoots a unit', theOther: named(e), abilities: b.abilities };
      } else meets = { kind: 'it shoots at an empty column' };
      let flankTurned: { byAnAbility: UnitAbilitySlug | null } | null = null;
      if (turned) {
        m *= BATTLE_FACING.turned;
        flankTurned = { byAnAbility: horns !== null && anchored ? horns : null };
      }
      const [mm, marking] = marked(x, m);
      put(x, mm, e ? 'shoots' : 'even', e ?? null, {
        theUnit: named(x),
        meets,
        ...(flankTurned ? { flankTurned } : {}),
        itsOwnAbilities: [],
        marks: marking,
      });
    } else put(x, 1, 'even', null, plainly(x));
  });
  me.reserve.forEach((x) => {
    put(x, 1, 'even', null, plainly(x));
  });
  me.flanks.forEach((x, i) => {
    if (i < mine.duel) {
      const e = them.flanks[i];
      if (!e) return; // i < duel, the fewer of the two sides' riders: there is one
      const f = abilityFront(x, e, terrain, 'duel', meIsAtk);
      put(x, f.m, 'duel', e, {
        ...plainly(x),
        meets: { kind: 'it duels a rider', theOther: named(e), abilities: f.abilities },
      });
    } else if (i < mine.duel + mine.blocking.length) {
      const block = mine.blocking[i - mine.duel];
      if (!block) return; // i < duel + blocking.length: there is one
      const e = them.front[block.col];
      const f = e ? abilityFront(x, e, terrain, 'guard', meIsAtk) : { m: 1, abilities: [] };
      put(x, f.m, 'guards', e ?? null, {
        ...plainly(x),
        meets: { kind: "it guards the line's end", theOther: e ? named(e) : null, abilities: f.abilities },
      });
    } else put(x, BATTLE_FACING.freeFlank, 'free', null, { ...plainly(x), meets: { kind: 'it rides free' } });
  });
  const enemyFlyers = them.fly.length > 0 || them.flanks.some((x) => x.role === 'fly');
  me.fly.forEach((x) => {
    // Its own ability in the air (Flak Gunners, against enemy flyers): a flyer whose ability acts faces them.
    const flyer = theStrengthOfAFlyer({ theFlyer: inTheLine(x), theEnemyHasFlyers: enemyFlyers });
    const kind: GridFacing['kind'] = flyer.abilities.length ? 'faces' : 'even';
    const [m, marking] = marked(x, flyer.multiplier);
    put(x, m, kind, null, { theUnit: named(x), meets: null, itsOwnAbilities: flyer.abilities, marks: marking });
  });
  return { total, units, turned, anchored, duels: mine.duel, guarding: mine.blocking.length, free: mine.free };
}
// Both sides at once (the engagement is shared). Stamps g.face on each grid; g.face.total is the
// strength the dice see. gA is the attacker's grid.
export function battleFacing(
  gA: BattleGrid | null | undefined,
  gD: BattleGrid | null | undefined,
  terrain: string | null,
) {
  if (!gA || !gD) return null;
  const E = battleEngage(gA, gD);
  gA.face = battleFaceSide(gA, gD, E.A, E.D, terrain, true);
  gD.face = battleFaceSide(gD, gA, E.D, E.A, terrain, false);
  return { atk: gA.face, def: gD.face };
}
// (The ladder's stage "who faces whom", battleFacingStage, is the prose's since plan P1-12d4: src/views/prose/.)
// ── WHO EACH COMPANY FOUGHT (2026-10-12, Toby: the battle reports say who beat whom) ── From a faced grid, a
// map army → whom it faced, for the clause its fate line carries: "facing X", "shooting X over the line", "in a flank
// duel with X", "guarding the end against X", "wrapping the line at X", "met at the end of the line by X", "riding
// free round the flank", "fighting from the air", "in the second line", "in the reserve", "shooting at an empty
// column", "with nobody opposite" — X the enemy company as ownedUnitName writes it (enemyOwner is that side's
// record, or the defenders': since plan P1-12d28 the clause holds the company's record, and the prose writes it). Read
// it right after the deploy, while the rows still carry the deploy's facing: the stay-or-retreat estimate faces the
// survivors afresh later. It reads the facing's kind, never its words (plan P1-12d4, P1-12's Decision 8).
export function battleFacedClauses(
  g: { readonly units?: (GridUnit | null | undefined)[] | null | undefined } | null | undefined,
  enemyOwner: TheOwnerOfABattlesUnits | null | undefined,
): Map<ArmyInABattle, WhomAUnitFaced> {
  const m = new Map<ArmyInABattle, WhomAUnitFaced>();
  if (!g || !Array.isArray(g.units)) return m;
  g.units.forEach((u) => {
    const r = u?.row,
      f = r?._faced;
    if (!u || !r?.a) return; // u is there whenever its row is
    const vs: AUnitAsALineNamesIt | null = f?.vs?.a
      ? {
          kind: 'a unit named without its quality',
          owner: enemyOwner ?? null,
          unitName: f.vs.a.unitName,
          type: f.vs.a.type,
          quality: f.vs.a.quality,
        }
      : null;
    let c: WhomAUnitFaced | null = null;
    if (vs && f)
      switch (f.kind) {
        case 'faces':
        case 'met':
        case 'wraps':
        case 'shoots':
        case 'duel':
        case 'guards':
          c = { kind: 'an enemy unit', how: f.kind, theEnemyUnit: vs };
          break;
        default:
          c = null;
      }
    if (!c) {
      const k = f ? f.kind : '',
        p = u.place;
      if (k === 'free') c = { kind: 'it rode free' };
      else if (k === 'wraps') c = { kind: "it wrapped the line's end" };
      else if (k === 'guards') c = { kind: "it guarded the line's end" };
      else if (p === 'air' || r.fly) c = { kind: 'it fought from the air' };
      else if (p === 'reserve') c = { kind: 'it stood in the reserve' };
      else if (p === 'second')
        c =
          f?.why.meets?.kind === 'it shoots at an empty column'
            ? { kind: 'it shot at an empty column' }
            : { kind: 'it stood in the second line' };
      else c = { kind: 'nobody stood opposite' };
    }
    m.set(r.a, c);
  });
  return m;
}
// ── THE SCOUT'S ADVANTAGE AND THE LINE-UP (Battle lines III, 2026-10-11, Toby) ── The side that knows
// the ground better (the higher exploration of the province; a province's own guard or garrison knows
// it fully; ties go to the defender) takes the rolled front or one wider or narrower, whichever suits
// it on the two default deployments, and lines up second: seeing the enemy's line, it may shift its own
// (up to BATTLE_LINEUP_MAX swaps). Then the commanders take turns, the side that did not scout first,
// one swap per level of Tactical (counted to 5). A swap exchanges two places in the front or the second
// line; it is legal only while the front stays one unbroken block holding the same kinds of unit it was
// deployed with, so a line can be reordered, or a unit traded for one of its own kind behind it, but
// never thinned or stiffened with archers. 2026-10-12 (Toby item 18): nor slid sideways so that the fronts
// no longer meet — the narrower front must stand wholly within the wider front's span (battleFrontsMeet), so a
// front unit stands with nobody opposite only once every enemy front unit already has someone opposite it.
// Every swap is judged with both sides faced (battleFacing), as the mover would see it, and only an improving
// swap is made. Nothing here is random.
export const BATTLE_LINEUP_MAX = 30;
export function battleScout(explAtk: number | null | undefined, explDef: number | null | undefined): 'atk' | 'def' {
  return (Number(explAtk) || 0) > (Number(explDef) || 0) ? 'atk' : 'def';
}
export function battleWidthChoices(terrain: string, roll: number) {
  const r = FRONT_RANGE_ON[terrain] ?? BATTLE_FRONT_RANGE.plain;
  return [roll - 1, roll, roll + 1].filter((w) => w >= r[0] && w <= r[1]);
}
export function battleLegal(g: BattleGridCells) {
  const occ = g.front.map(Boolean),
    f = occ.indexOf(true),
    l = occ.lastIndexOf(true);
  if (f >= 0) for (let c = f; c <= l; c++) if (!occ[c]) return false;
  return (
    g.front
      .filter((x): x is GridCell => Boolean(x))
      .map((x) => x.role)
      .sort()
      .join() === g.frontSet
  );
}
// The two fronts meet (item 18): the narrower stands within the wider's span; two fronts of one size hold the
// same columns. The deploy's centred blocks always meet; a swap that would part them is not legal.
export function battleFrontsMeet(g1: BattleGridCells, g2: BattleGridCells) {
  const sp = (g: BattleGridCells): [first: number, last: number, count: number] => {
    const o = g.front.map(Boolean);
    return [o.indexOf(true), o.lastIndexOf(true), o.filter(Boolean).length];
  };
  const [a0, a1, an] = sp(g1),
    [b0, b1, bn] = sp(g2);
  if (!an || !bn) return true;
  return an <= bn ? a0 >= b0 && a1 <= b1 : b0 >= a0 && b1 <= a1;
}
// The logarithm of (my faced strength / theirs), both grids faced afresh.
export function battleLineRatio(gA: BattleGrid, gD: BattleGrid, terrain: string | null, meIsAtk: boolean) {
  battleFacing(gA, gD, terrain);
  const atk = gA.face,
    def = gD.face;
  if (!atk || !def) throw new TypeError('battleLineRatio: battleFacing has just faced both grids');
  const r = Math.log(Math.max(atk.total, 1e-9) / Math.max(def.total, 1e-9));
  return meIsAtk ? r : -r;
}
// The best single legal swap for `me`; makes it and returns it, or returns null when none improves.
/** A place in the front or the second line: the line, and the column. */
type AGridPlace = ['front' | 'second', number];
export function battleBestSwap(me: BattleGrid, them: BattleGrid, terrain: string | null, meIsAtk: boolean) {
  const gA = meIsAtk ? me : them,
    gD = meIsAtk ? them : me;
  const base = battleLineRatio(gA, gD, terrain, meIsAtk);
  let best: [number, number] | null = null,
    gain = 1e-9;
  const cells: AGridPlace[] = [];
  for (let c = 0; c < me.W; c++) {
    cells.push(['front', c]);
    cells.push(['second', c]);
  }
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) {
      const ci = cells[i],
        cj = cells[j];
      if (!ci || !cj) continue; // i and j are below cells.length
      const [ra, ca] = ci,
        [rb, cb] = cj,
        a = me[ra][ca],
        b = me[rb][cb];
      if (!a && !b) continue;
      if (a && b?.role === a.role && a.s === b.s) continue; // nothing to gain from twins
      me[ra][ca] = b;
      me[rb][cb] = a;
      if (battleLegal(me) && battleFrontsMeet(me, them)) {
        battleRegrid(me);
        const g = battleLineRatio(gA, gD, terrain, meIsAtk) - base;
        if (g > gain) {
          gain = g;
          best = [i, j];
        }
      }
      me[ra][ca] = a;
      me[rb][cb] = b;
    }
  if (!best) {
    battleRegrid(me);
    battleFacing(gA, gD, terrain);
    return null;
  }
  const from = cells[best[0]],
    to = cells[best[1]];
  if (!from || !to) throw new TypeError('battleBestSwap: the best swap is of two of the cells');
  const [ra, ca] = from,
    [rb, cb] = to;
  const t = me[ra][ca];
  me[ra][ca] = me[rb][cb];
  me[rb][cb] = t;
  battleRegrid(me);
  battleFacing(gA, gD, terrain);
  return { from: [ra, ca], to: [rb, cb], gain };
}
// Deploy both sides. rowsA / rowsD: finished rows (finishSide). o: {terrain, roll, tacA, tacD, flankA,
// flankD, scout:'atk'|'def'}. Returns {W, gA, gD, scout, lineup, moves:{scout, other}, roll}, both grids
// faced on their final layout.
/** How both sides deploy (battleDeploy): the ground, the dice's width, each side's Tactical and Flanking Tactics, and
 *  which side scouts. */
export interface BattleDeployOptions {
  terrain: string;
  roll: number;
  tacA?: number | null | undefined;
  tacD?: number | null | undefined;
  flankA?: boolean | null | undefined;
  flankD?: boolean | null | undefined;
  scout: 'atk' | 'def';
}
/** Both sides deployed: the width chosen, both grids faced, who scouted, and how often each line shifted. */
export interface ABattlesDeployment {
  W: number;
  gA: BattleGrid;
  gD: BattleGrid;
  scout: 'atk' | 'def';
  lineup: number;
  moves: { scout: number; other: number };
  roll: number;
}
export function battleDeploy(
  rowsA: (BattleRow | null | undefined)[],
  rowsD: (BattleRow | null | undefined)[],
  o: BattleDeployOptions,
): ABattlesDeployment {
  const build = (w: number) => ({
    gA: battleGrid(rowsA, w, o.terrain, { flank: o.flankA, tac: o.tacA, enemy: rowsD, enemyTac: o.tacD }),
    gD: battleGrid(rowsD, w, o.terrain, { flank: o.flankD, tac: o.tacD, enemy: rowsA, enemyTac: o.tacA }),
  });
  const scoutAtk = o.scout === 'atk';
  let pick: { w: number; r: number; gA: BattleGrid; gD: BattleGrid } | null = null;
  for (const w of battleWidthChoices(o.terrain, o.roll)) {
    const g = build(w);
    const r = battleLineRatio(g.gA, g.gD, o.terrain, scoutAtk);
    if (!pick || r > pick.r + 1e-9) pick = { w, r, gA: g.gA, gD: g.gD };
  }
  if (!pick) {
    const g = build(o.roll);
    pick = { w: o.roll, r: 0, gA: g.gA, gD: g.gD };
  }
  const W = pick.w,
    gA = pick.gA,
    gD = pick.gD,
    me = scoutAtk ? gA : gD,
    other = scoutAtk ? gD : gA;
  let lineup = 0;
  while (lineup < BATTLE_LINEUP_MAX && battleBestSwap(me, other, o.terrain, scoutAtk)) lineup++;
  const capT = (t: number | null | undefined) => Math.max(0, Math.min(BATTLE_FLANK_TAC_CAP, Number(t) | 0));
  let mo = capT(scoutAtk ? o.tacD : o.tacA),
    ms = capT(scoutAtk ? o.tacA : o.tacD);
  const moves = { scout: 0, other: 0 };
  while (mo > 0 || ms > 0) {
    let moved = false;
    if (mo > 0) {
      mo--;
      if (battleBestSwap(other, me, o.terrain, !scoutAtk)) {
        moves.other++;
        moved = true;
      }
    }
    if (ms > 0) {
      ms--;
      if (battleBestSwap(me, other, o.terrain, scoutAtk)) {
        moves.scout++;
        moved = true;
      }
    }
    if (!moved) break;
  }
  battleFacing(gA, gD, o.terrain);
  return { W, gA, gD, scout: o.scout, lineup, moves, roll: o.roll };
}
// The report's two lines: who scouted and what front it chose; how many times each line shifted.
export function battleScoutLine(
  d: Pick<ABattlesDeployment, 'scout' | 'W' | 'roll' | 'lineup'>,
  atkName: ASideAsABattlesReportLinesNameIt,
  defName: ASideAsABattlesReportLinesNameIt,
  explAtk: number,
  explDef: number,
): TheFactOfOneOfABattlesSentences {
  const atk = d.scout === 'atk',
    s = atk ? atkName : defName,
    o = atk ? defName : atkName,
    mine = atk ? explAtk : explDef,
    theirs = atk ? explDef : explAtk;
  // 2026-10-13 (Toby, item 17): say WHICH side has explored the province more, never the figures —
  // a battle report must not tell a realm its rival's exploration of the province.
  return {
    kind: 'the scouting side chooses the front',
    scoutName: s,
    itsSideHasExploredMore: mine > theirs,
    otherSideName: o,
    scoutName2: s,
    frontWidth: d.W,
    frontTheDiceAllow: d.roll,
    adjustments: d.lineup,
  };
}
export function battleMovesLine(
  d: Pick<ABattlesDeployment, 'scout' | 'moves'>,
  atkName: ASideAsABattlesReportLinesNameIt,
  defName: ASideAsABattlesReportLinesNameIt,
): TheFactOfOneOfABattlesSentences | null {
  if (!d.moves.other && !d.moves.scout) return null;
  const atk = d.scout === 'atk',
    s = atk ? atkName : defName,
    o = atk ? defName : atkName;
  return {
    kind: 'each side shifts its battle line',
    otherSideName: o,
    otherSidesMoves: d.moves.other,
    scoutName: s,
    scoutsMoves: d.moves.scout,
  };
}
