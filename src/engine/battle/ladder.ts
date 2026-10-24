import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { ARMY_SPEED_MASTER } from '../army-tables.ts';
import { BATTLE_LINE_MULTS, battleFacingStage, battleGridStage, battleLineTotal, flankLineMults } from './lines.ts';
import { UNIT_BASE_STR, UNIT_Q_MULT } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import type { Army } from '../../schemas/saved-game-state.ts';
import { ladderFm } from './a-multiplier-written-as-the-strength-ladder-shows-it.ts';

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
// Whole force, which always prints so the reader sees it was checked.
/** A unit's row in a side's ladder: ladderRow makes it, finishSide adds the whole-force stages and the damage
 *  (battle/terrain-and-unit-strength.ts). */
export interface LadderRow {
  a: Army;
  base: number;
  fly?: boolean | undefined;
  /** The unit's own figure (every per-unit modifier), and each modifier named. */
  _u?: number | null | undefined;
  _tr?: { label: string; delta?: number | null | undefined }[] | undefined;
  /** The command multipliers applied, and the figure after them. */
  _cmd?: { label: string; key?: string | undefined; m: number }[] | undefined;
  _cmdS?: number | null | undefined;
  /** The figure after the whole force's multipliers, before and after the pre-battle damage, and that damage. */
  _fPre?: number | null | undefined;
  _fPost?: number | null | undefined;
  _dmg?: number | undefined;
}
export function ladderLines(
  role: string,
  name: string,
  rows: LadderRow[],
  width: number,
  flank: boolean,
  forceMods: { m: number; label: string }[] | null | undefined,
  final: number,
  opt?: {
    grid?: { total: number; W: number; face?: { total: number } | null | undefined } | null | undefined;
    tact?: { mult: number; label: string } | null | undefined;
  } | null,
) {
  opt = opt || {};
  const nUnits = rows.length,
    pl = (n: number, w: string) => `${n} ${w}${n !== 1 ? 's' : ''}`,
    r0 = (v: number) => Math.round(v);
  let base = 0,
    unitSum = 0,
    cmdSum = 0,
    preSum = 0,
    postSum = 0;
  const agg = new Map<string, { label: string; n: number; d: number; delta: boolean }>(),
    cagg = new Map<string, { label: string; key: string | undefined; n: number }>();
  rows.forEach((r) => {
    const a = r.a || {};
    base += (UNIT_BASE_STR[a.type] || 4) * (UNIT_Q_MULT[a.quality || 'Average'] || 2);
    unitSum += r._u != null ? r._u : r.base;
    cmdSum += r._cmdS != null ? r._cmdS : r.base;
    preSum += r._fPre != null ? r._fPre : r.base;
    postSum += r._fPost != null ? r._fPost : r.base;
    (r._tr || []).forEach((e) => {
      const g = agg.get(e.label) || { label: e.label, n: 0, d: 0, delta: e.delta != null };
      g.n++;
      if (e.delta != null) g.d += e.delta;
      agg.set(e.label, g);
    });
    (r._cmd || []).forEach((c) => {
      const g = cagg.get(c.label) || { label: c.label, key: c.key, n: 0 };
      g.n++;
      cagg.set(c.label, g);
    });
  });
  const unitMods = [...agg.values()]
    .filter((g) => !g.delta || Math.round(g.d) !== 0)
    .map((g) =>
      g.delta ? `${g.label} ${g.d >= 0 ? '+' : '−'}${Math.abs(Math.round(g.d))}` : `${g.label} (${pl(g.n, 'unit')})`,
    );
  const lineTot = opt.grid && isFinite(opt.grid.total) ? opt.grid.total : battleLineTotal(rows, width, flank);
  const cmd = [...cagg.values()].map((g) => `${g.label} on ${pl(g.n, g.key === 'tac' ? 'land/air unit' : 'unit')}`);
  // Tactical never lifts fleets or sea-beasts (they take Naval) — say so whenever it leaves units
  // out. Since 2026-09-23c it lifts flyers exactly as it lifts land units (Toby).
  if (opt.tact && opt.tact.mult > 1) {
    const tg = [...cagg.values()].find((g) => g.key === 'tac');
    const left = nUnits - (tg ? tg.n : 0);
    if (!tg) cmd.push(`${opt.tact.label} — no land or air units to command (fleets gain nothing from Tactical)`);
    else if (left > 0) cmd.push(`fleets gain nothing from Tactical (${pl(left, 'unit')})`);
  }
  const fm = (forceMods || []).filter((x) => x && Math.abs(x.m - 1) > 1e-9);
  const hit = rows.filter((r) => (r._dmg || 0) > 1e-9);
  const ground = rows.filter((r) => !r.fly).length;
  const L = [`  ${role} (${name}): ${pl(nUnits, 'unit')} — strength **${r0(final)}**`];
  L.push(`    · Units: base ${r0(base)} → ${r0(unitSum)}${unitMods.length ? ` (${unitMods.join('; ')})` : ''}`);
  if (cmd.length || r0(cmdSum) !== r0(unitSum))
    L.push(`    · Command: ${r0(unitSum)} → ${r0(cmdSum)}${cmd.length ? ` (${cmd.join('; ')})` : ''}`);
  L.push(
    fm.length
      ? `    · Whole force: ${r0(cmdSum)} ${fm.map((x) => `× ${x.label} ${ladderFm(x.m)}`).join(' ')} = ${r0(preSum)}`
      : `    · Whole force: no force-wide modifiers — ${r0(preSum)}`,
  );
  if (hit.length && r0(preSum - postSum) > 0)
    L.push(
      `    · Pre-battle volleys & spells: ${r0(preSum)} − ${r0(preSum - postSum)} = ${r0(postSum)} (${pl(hit.length, 'unit')} hit; taken off the finished figures)`,
    );
  if (opt.grid) {
    const face = opt.grid.face;
    L.push(
      `    · Battle lines (front of ${opt.grid.W}): ${r0(postSum)} → ${face ? r0(lineTot) : '**' + r0(lineTot) + '**'} (${battleGridStage(opt.grid)})`,
    );
    if (face) L.push(`    · Who faces whom: ${r0(lineTot)} → **${r0(face.total)}** (${battleFacingStage(opt.grid)})`);
  } else if (ground > width) {
    const m = flank ? flankLineMults() : BATTLE_LINE_MULTS;
    L.push(
      `    · Battle lines: ${r0(postSum)} → **${r0(lineTot)}** (${pl(ground - width, 'unit')} behind the ${width}-unit front at ${m
        .slice(1)
        .map((x) => '×' + x)
        .join(' / ')})`,
    );
  }
  return L;
}
// (Declared here at TRUE module level — the block at PREBATTLE_STR_FLOOR sits inside runTurn and the bot model cannot see it.)
// ARCHERY IN ARMY BATTLES (2026-09-23b, Toby): the commander's Archery lifts every missile unit he
// leads by +5% per level (Archery 5 = +25%; items count, as with every effStat). Until today the
// rulebook and DEV_LOG said "no strength bonus" while both battle paths quietly applied +10%/level —
// the NPC path even carried a comment claiming the bonus had been removed. One constant now.
export const ARCHERY_MISSILE_PCT = 0.05;
// DRUID MASTERY (2026-09-24, Toby): +20% per Druid level over the minimum to lead a Creature/Monster,
// Druid counted to 9, gain capped at +100%. Applied in armStr via druidMasteryGain.
export const DRUID_MASTERY_PER_LVL = 0.2,
  DRUID_MASTERY_CAP = 1.0,
  DRUID_MASTERY_MAX_LVL = 9;
// UNDEAD — undying fanaticism (2026-09-23b, Toby): a host with skeletal units in it, led by the Undead
// KING in person ×1.5, by any other Undead commander ×1.3 (was ×1.3 / ×1.2). Whole force, no roll.
// Undead's own zeal roll is 0%. Where several fervours apply the strongest one counts (max, never stacked).
export const UNDEAD_SKEL_KING_FAN = 1.5,
  UNDEAD_SKEL_HERO_FAN = 1.3;
export function aAn(w: string | null | undefined) {
  return /^[aeiou]/i.test(String(w || '')) ? 'an' : 'a';
} // "an annihilating battle"
export const MISSILE_ARMIES_MASTER = new Set(KC_UNIT_CLASS.missile);

// Add primal armies to ARMY_UNIT_NAMES

export const ARMY_SPEED_R = ARMY_SPEED_MASTER; // alias → master table at top of script
