import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { ARMY_SPEED_MASTER } from '../army-tables.ts';
import { BATTLE_LINE_MULTS, battleLineTotal, flankLineMults } from './lines.ts';
import type { BattleGrid } from './lines.ts';
import { UNIT_BASE_STR, UNIT_Q_MULT } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import type { Army } from '../../schemas/saved-game-state.ts';
import {
  theCommandMultipliersAsTheLadderTellsThem,
  theFacingsAsTheLadderTellsThem,
  theForceWideModifiersAsTheLadderTellsThem,
  theUnitsModifiersAsTheLadderTellsThem,
  theUnitsPlacesAsTheLadderTellsThem,
  type ACommandMultiplierOfAUnit,
  type AForceWideModifierOfASide,
  type AModifierOfAUnitInTheLadder,
  type ASideAsABattlesReportLinesNameIt,
  type ASidesTacticalInTheLadder,
  type TheFactOfOneOfABattlesSentences,
} from './the-facts-a-battles-lines-record.ts';

// ── STRENGTH LADDER (2026-09-23b) ── The Battle stats block used to print one figure per side plus an
// "(incl. …)" list of SOME multipliers. Per-unit effects (kinship, terrain, Dwarven Bulwark, the Druid
// creature bond, arrows…) were folded in silently, and Tactical was listed as if it lifted the whole
// army when flyers and fleets never get it — so players could not reconcile the numbers. The ladder
// prints three exact stages per side: Units (sum of every unit's armStr, with each per-unit modifier
// named via armStr's ctx.trace) → Command & battle lines (Tactical / Archery / Naval / illusory per
// unit, then the terrain-width lines) → Whole force (fanaticism, discoveries, morale, defender…).
// Rows come from ladderRow() (inside runTurn, beside armStr) so the ladder and the real total are
// computed from the SAME figures. Module-level so every battle site can share it.
// 2026-09-24 (Toby) — the stages, in the order the battle applies them: Units (every per-unit modifier)
// → Command (Tactical / Archery / Naval / illusory per unit) → Whole force (fanaticism, discoveries,
// morale, the defender's position…) → Pre-battle damage (arrows, battle magic, primal strikes, flak —
// taken off the FINISHED figure, never multiplied) → Battle lines (every unit's place) → Who faces whom
// (each matchup, 2026-10-11) = strength.
// Rows must have been through finishSide (runTurn). A stage that changes nothing is left out, except
// Whole force, which always prints so the reader sees it was checked. Each stage's line holds its figures and what
// moved them, copied as the line is told; the prose names each modifier and groups them (plan P1-12d4).
/** A unit's row in a side's ladder: ladderRow makes it, finishSide adds the whole-force stages and the damage
 *  (battle/terrain-and-unit-strength.ts). */
export interface LadderRow {
  a: Army;
  base: number;
  fly?: boolean | undefined;
  /** The unit's own figure (every per-unit modifier), and each modifier, why it moved the figure. */
  _u?: number | null | undefined;
  _tr?: AModifierOfAUnitInTheLadder[] | undefined;
  /** The command multipliers applied, and the figure after them. */
  _cmd?: ACommandMultiplierOfAUnit[] | undefined;
  _cmdS?: number | null | undefined;
  /** The figure after the whole force's multipliers, before and after the pre-battle damage, and that damage. */
  _fPre?: number | null | undefined;
  _fPost?: number | null | undefined;
  _dmg?: number | undefined;
}
export function ladderLines(
  role: 'attacker' | 'defender',
  name: ASideAsABattlesReportLinesNameIt,
  rows: LadderRow[],
  width: number,
  flank: boolean,
  forceMods: AForceWideModifierOfASide[] | null | undefined,
  final: number,
  opt?: {
    grid?: BattleGrid | null | undefined;
    tact?: ASidesTacticalInTheLadder | null | undefined;
  } | null,
) {
  opt = opt || {};
  const nUnits = rows.length,
    r0 = (v: number) => Math.round(v);
  let base = 0,
    unitSum = 0,
    cmdSum = 0,
    preSum = 0,
    postSum = 0;
  rows.forEach((r) => {
    const a = r.a || {};
    base += (UNIT_BASE_STR[a.type] || 4) * (UNIT_Q_MULT[a.quality || 'Average'] || 2);
    unitSum += r._u != null ? r._u : r.base;
    cmdSum += r._cmdS != null ? r._cmdS : r.base;
    preSum += r._fPre != null ? r._fPre : r.base;
    postSum += r._fPost != null ? r._fPost : r.base;
  });
  const lineTot = opt.grid && isFinite(opt.grid.total) ? opt.grid.total : battleLineTotal(rows, width, flank);
  // The command stage is told when a unit took a command multiplier, or the side's Tactical lifts nobody or leaves
  // units out (the prose says which), or the figure moved. Tactical never lifts fleets or sea-beasts (they take Naval);
  // since 2026-09-23c it lifts flyers exactly as it lifts land units (Toby).
  const tact = opt.tact && opt.tact.mult > 1 ? opt.tact : null;
  const anyCommand = rows.some((r) => (r._cmd || []).length > 0);
  const fm = (forceMods || []).filter((x) => x && Math.abs(x.m - 1) > 1e-9);
  const hit = rows.filter((r) => (r._dmg || 0) > 1e-9);
  const ground = rows.filter((r) => !r.fly).length;
  const L: TheFactOfOneOfABattlesSentences[] = [
    {
      kind: "a side's strength ladder begins",
      side: role,
      sideName: name,
      unitCount: nUnits,
      strength: r0(final),
    },
  ];
  L.push({
    kind: "the strength ladder's units",
    baseStrength: r0(base),
    unitsStrength: r0(unitSum),
    theUnitsModifiers: theUnitsModifiersAsTheLadderTellsThem(rows),
  });
  if (anyCommand || tact || r0(cmdSum) !== r0(unitSum))
    L.push({
      kind: "the strength ladder's command",
      unitsStrength: r0(unitSum),
      commandStrength: r0(cmdSum),
      theCommandMultipliers: theCommandMultipliersAsTheLadderTellsThem(rows),
      theSidesTactical: tact ? { mult: tact.mult, reason: tact.reason } : null,
      unitCount: nUnits,
    });
  L.push(
    fm.length
      ? {
          kind: "the strength ladder's force-wide modifiers",
          commandStrength: r0(cmdSum),
          theForceWideModifiers: theForceWideModifiersAsTheLadderTellsThem(fm),
          wholeForceStrength: r0(preSum),
        }
      : { kind: 'the strength ladder has no force-wide modifiers', wholeForceStrength: r0(preSum) },
  );
  if (hit.length && r0(preSum - postSum) > 0)
    L.push({
      kind: "the strength ladder's pre-battle damage",
      wholeForceStrength: r0(preSum),
      preBattleDamage: r0(preSum - postSum),
      afterPreBattleDamage: r0(postSum),
      unitsHit: hit.length,
    });
  if (opt.grid) {
    const face = opt.grid.face;
    L.push({
      kind: "the strength ladder's battle lines",
      frontWidth: opt.grid.W,
      afterPreBattleDamage: r0(postSum),
      battleLinesStrength: r0(lineTot),
      whoFacesWhomFollows: Boolean(face),
      theUnitsPlaces: theUnitsPlacesAsTheLadderTellsThem(opt.grid.units),
    });
    if (face)
      L.push({
        kind: "the strength ladder's who faces whom",
        battleLinesStrength: r0(lineTot),
        facingStrength: r0(face.total),
        theFacings: theFacingsAsTheLadderTellsThem(face.units),
      });
  } else if (ground > width) {
    const m = flank ? flankLineMults() : BATTLE_LINE_MULTS;
    L.push({
      kind: "the strength ladder's units behind the front",
      afterPreBattleDamage: r0(postSum),
      battleLinesStrength: r0(lineTot),
      unitsBehindTheFront: ground - width,
      frontWidth: width,
      theLinesMultipliersBehindTheFront: m.slice(1),
    });
  }
  return L;
}
// (Declared here at TRUE module level — the block at PREBATTLE_STR_FLOOR sits inside runTurn and the bot model cannot see it.)
// ARCHERY IN ARMY BATTLES (2026-09-23b, Toby): the commander's Archery lifts every missile unit he
// leads by +5% per level (Archery 5 = +25%; items count, as with every effStat). Until today the
// rulebook and DEV_LOG said "no strength bonus" while both battle paths quietly applied +10%/level —
// the NPC path even carried a comment claiming the bonus had been removed. One constant now.
export const ARCHERY_MISSILE_PCT = 0.05;
// DRUID MASTERY (2026-09-24, Toby): its three constants are in engine/rules-on-plain-values/, with its sum (plan P1-11b2).
// UNDEAD — undying fanaticism (2026-09-23b, Toby): a host with skeletal units in it, led by the Undead
// KING in person ×1.5, by any other Undead commander ×1.3 (was ×1.3 / ×1.2). Whole force, no roll.
// Undead's own zeal roll is 0%. Where several fervours apply the strongest one counts (max, never stacked).
export const UNDEAD_SKEL_KING_FAN = 1.5,
  UNDEAD_SKEL_HERO_FAN = 1.3;
export const MISSILE_ARMIES_MASTER = new Set(KC_UNIT_CLASS.missile);

// Add primal armies to ARMY_UNIT_NAMES

export const ARMY_SPEED_R = ARMY_SPEED_MASTER; // alias → master table at top of script
