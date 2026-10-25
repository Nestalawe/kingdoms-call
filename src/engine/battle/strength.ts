import { kcRng } from '../rng.ts';
import { MISSILE_ARMIES_MASTER } from './ladder.ts';
import { FLYING_TYPES } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { ArmyInABattle } from '../army-tables.ts';
import { theStrengthOfAUnitInItsWholeForce } from '../rules/the-registry-of-content-effects.ts';

/** A unit of a force as the battle code hands it: an army, or a hole the guards skip. */
type ForceUnit = ArmyInABattle | null | undefined;
/** What armStr tells unitAbilityMult of the battle (the fields this file reads). */
export interface UnitAbilityContext {
  readonly force?: readonly ForceUnit[] | null;
  readonly enemyForce?: readonly ForceUnit[] | null;
  readonly amphibious?: boolean | null;
  readonly isAttacker?: boolean | null;
  readonly coastal?: boolean | null;
}

// ── Force-composition strength multipliers (applied inside armStr) ── The abilities are the rule registry's (plan
// P1-19a): their effects at the stage "strength: the whole force", in src/engine/rules/unit-abilities/, and their
// numbers in src/content/unit-abilities-their-names-numbers-and-words.ts.
export function unitAbilityMult(
  army: ForceUnit,
  ctx: UnitAbilityContext | null | undefined,
  terrain: string | null | undefined,
): number {
  if (!army || !ctx) return 1;
  const enemy = ctx.enemyForce ?? [];
  return theStrengthOfAUnitInItsWholeForce({
    unitType: army.type,
    itsForce: ctx.force ?? [],
    theEnemyFieldsRangedUnits: enemy.some((a) => a && MISSILE_ARMIES_MASTER.has(a.type)),
    itsSideAttacks: Boolean(ctx.isAttacker),
    landedFromLongshipsThisPhase: Boolean(ctx.amphibious),
    coastal: Boolean(ctx.coastal),
    ground: terrain,
  });
}

// ── Archery-phase ability helpers ── Which units actually loose this phase, and in what order.
export function abilityMissileUnits(
  force: readonly ArmyInABattle[] | null | undefined,
  terrain: string | null | undefined,
): ArmyInABattle[] {
  const list = (force ?? []).filter((a) => MISSILE_ARMIES_MASTER.has(a.type));
  // HUMAN — Broadside: at sea a galleon is a floating battery.
  if (terrain === 'sea')
    (force ?? []).forEach((a) => {
      if (a.type === 'Galleon Fleet') list.push(a);
    });
  // ELF — Tree Watch: in forest or jungle the Elven Garrison shoots like an archer unit.
  if (terrain === 'forest' || terrain === 'jungle')
    (force ?? []).forEach((a) => {
      if (a.type === 'Elven Garrison') list.push(a);
    });
  // DWARF — Bombardment: the guns speak first, so they get the clear shot before the cap fills.
  list.sort((a, b) => (b.type === 'Mountain Guns' ? 1 : 0) - (a.type === 'Mountain Guns' ? 1 : 0));
  return list;
}
// ELF — Loosed From Cover: Shadow Archers shoot from hiding and are not shot at in return.
// the per-unit arrow-softening cap and whether a target has reached it. Flyers soften twice as
// hard; Ironwood Crossbows punch further; Dwarf Ironclads are arrow-immune. A unit at the cap gains
// nothing from more shots, so the target pool skips it (kept in this scope so missileTargetPool
// sees it).
export const _MISSILE_CAP_FRAC = 0.4; // mirrors MISSILE_CAP_FRACTION (kept local to this module scope) — 2026-09-24: 30% → 40% (80% winged)
export function missileCap(target: ArmyInABattle, firer: ForceUnit): number {
  const baseStr = unitBaseStrength(target);
  const isFly = FLYING_TYPES.has(target.type);
  let capFraction = isFly ? _MISSILE_CAP_FRAC * 2 : _MISSILE_CAP_FRAC;
  if (firer?.type === 'Ironwood Crossbows') capFraction = isFly ? 0.9 : 0.55; // Punch Through: +15 points on the ground (was 45 vs 30); winged 90 (was 90 vs 60)
  return Math.max(1, Math.floor(baseStr * capFraction));
}
export function missileCapReached(target: ForceUnit, firer: ForceUnit): boolean {
  if (!target) return true;
  if (target.type === 'Dwarf Ironclads' || target.type === 'Great Turtles') return true; // arrow-immune (Armoured Hulls; the turtles' Shell Wall) — never worth a shot
  return (target._archeryRed ?? 0) >= missileCap(target, firer);
}
// 2026-09-24 (Toby): targets are RANDOM. Every shot picks at random among the enemy's winged riders
// still below their arrow cap; only when none is left does it pick at random among ALL the other
// enemy units below their cap (no "front row" any more). Shadow Archers stay hidden while anything
// else is visible (Loosed From Cover). `frontWidth` is ignored — kept so old callers still work.
export function missileTargetPool(
  enemyArmies: readonly ForceUnit[] | null | undefined,
  frontWidth: unknown,
  firer: ForceUnit,
  myForce: readonly ForceUnit[] | null | undefined,
): ArmyInABattle[] {
  const all = (enemyArmies ?? []).filter((a): a is ArmyInABattle => Boolean(a));
  // ELF — Eyes of the Forest: with Eagle Riders overhead nothing hides, Shadow Archers included.
  const visible = eyesOfTheForest(myForce) ? all : all.filter((a) => a.type !== 'Shadow Archers');
  const src = visible.length ? visible : all;
  const live = (u: ArmyInABattle) => !missileCapReached(u, firer);
  const fly = src.filter((u) => FLYING_TYPES.has(u.type) && live(u));
  if (fly.length) return fly;
  return src.filter((u) => live(u));
}
// ELF — Ambush: enemy archers never get a clear shot at Wardens in their own woods — unless Eagle Riders
// fly with the shooters (Eyes of the Forest, 2026-10-11): then the Wardens are seen and the volley flies.
export function eyesOfTheForest(force: readonly ForceUnit[] | null | undefined): boolean {
  return (force ?? []).some((a) => a?.type === 'Eagle Riders');
}
export function archeryBlockedBy(
  defenderForce: readonly ForceUnit[] | null | undefined,
  terrain: string | null | undefined,
  shooters: readonly ForceUnit[] | null | undefined,
): boolean {
  if (terrain !== 'forest' && terrain !== 'jungle') return false;
  if (eyesOfTheForest(shooters)) return false;
  return (defenderForce ?? []).some((a) => a?.type === 'Forest Wardens');
}
// The line the report shows when Eyes of the Forest lifts an Ambush (null when it does not apply).
export function eyesOfTheForestLine(
  defenderForce: readonly ForceUnit[] | null | undefined,
  terrain: string | null | undefined,
  shooters: readonly ForceUnit[] | null | undefined,
  shooterName: string,
) {
  if ((terrain !== 'forest' && terrain !== 'jungle') || !eyesOfTheForest(shooters)) return null;
  if (!(defenderForce ?? []).some((a) => a?.type === 'Forest Wardens')) return null;
  return { kind: 'the eagle riders mark the forest wardens and spoil the ambush', shooterName };
}
// Per-shot damage multipliers from the firing unit's ability. isAtk: the firer's side attacks.
// 2026-10-11 (Toby, the unit abilities): the Longbows' Massed Volley is retired (theirs are Bodkin Points
// and Prepared Ground); the Black Arrows' Raiders' Volley arrives.
export function missileDamageMult(
  firer: ForceUnit,
  force: unknown,
  terrain: string | null | undefined,
  target: ForceUnit,
  isAtk: boolean,
): number {
  if (!firer) return 1;
  let m = 1;
  // ELF — Woodland Volley: elven bows in elven woods.
  if (firer.type === 'Elven Bowmen' && (terrain === 'forest' || terrain === 'jungle')) m *= 2;
  // DWARF — Bombardment: siege guns are built for breaking fortifications.
  if (firer.type === 'Mountain Guns' && target && (target.type || '').includes('Garrison')) m *= 1.5;
  // ORC — Raiders' Volley: the Black Arrows loose hardest going forward.
  if (firer.type === 'Black Arrows' && isAtk) m *= 1.5;
  return m;
}
// Prepared Ground: a defending Longbow company looses two volleys. How many shots a unit fires this
// phase, before any quiver the commander carries.
export function abilityVolleys(firer: ForceUnit, isAtk: boolean): number {
  return firer?.type === 'Yeoman Longbows' && !isAtk ? 2 : 1;
}

// ── DWARF — Flak Screen ── Each Gyrocopter harries ONE enemy flying unit (-30%). A unit already
// engaged by one gyrocopter cannot be picked again in the same battle, so N gyrocopters tie up N
// distinct flyers. ── SHARED UNIT STRENGTH TABLES (MODULE TOP LEVEL — DO NOT MOVE INSIDE runTurn)
// ──
// These were declared inside runTurn, where applyFlakScreen — a TOP-LEVEL function called from
// combatVsNPC — could not see them. A top-level function's scope chain is [top level, global]; it
// never includes runTurn's locals, however deep inside runTurn the CALL happens to originate. The
// result was a hard ReferenceError that crashed the whole turn the first time a flak screen fired
// in a battle against province defenders, so it only surfaced in games that actually saw combat.
// Same trap as FLYING_TYPES and ITEMS_BY_TIER before it: shared lookup tables and the helpers that
// read them live at module top level, always.

// 2026-09-27: `_flakTargeted` marks a flyer as already engaged so two gyrocopters cannot double up
// on one target IN THE SAME BATTLE. It was set here and never cleared anywhere — not by the three
// battle-end sweeps that wipe _tempStrReduction / _terrorMult / _archeryRed / _tacUp / _drumUp /
// _laNoTerrain, and not by the snapshot copier — so it persisted on the army object, was serialised
// with game state, and a winged rider harried once was immune to Flak Screen for the rest of the
// GAME. It is now deleted alongside those flags at every one of those five sites. If a new
// battle-only flag is added, add it to all five.
export function applyFlakScreen(
  myForce: readonly ForceUnit[] | null | undefined,
  enemyForce: readonly ForceUnit[] | null | undefined,
  myName: string,
  narr: NarrativeLine[],
): void {
  const gyros = (myForce ?? []).filter((a) => a?.type === 'Gnomish Gyrocopters');
  if (!gyros.length) return;
  const flyers = (enemyForce ?? []).filter(
    (a): a is ArmyInABattle => !!a && FLYING_TYPES.has(a.type) && !a._flakTargeted,
  );
  if (!flyers.length) return;
  const pool = flyers.slice();
  let engaged = 0;
  // Item 4 FIX: build the flak lines LOCALLY. `narr` here is the SHARED battle narrative that
  // already holds the "…moves into… a battle is initiated." line, so the old
  // `narr.unshift(summary)` prepended the flyer-engage summary to the very TOP of the whole report
  // (above "battle is initiated") while the harry details pushed to the end — scattering the
  // sequence. Appending the summary then its details keeps the flak event in order, wherever this
  // pre-battle call sits.
  const lines: NarrativeLine[] = [];
  gyros.forEach(() => {
    if (!pool.length) return;
    const idx = Math.floor(kcRng() * pool.length);
    const t = pool.splice(idx, 1)[0];
    if (!t) return;
    t._flakTargeted = true;
    const red = Math.max(1, Math.round(unitBaseStrength(t) * 0.3));
    t._tempStrReduction = (Number(t._tempStrReduction) || 0) + red;
    lines.push({
      kind: 'the gyrocopters harry a flying unit off its line',
      targetUnitName: t.unitName || t.type,
      strengthLost: red,
    });
    engaged++;
  });
  if (engaged) {
    narrate(narr, {
      kind: "a side's gyrocopters climb to meet the enemy's flyers",
      sideName: myName,
      engagedCount: engaged,
    });
    lines.forEach((l) => {
      narrate(narr, l);
    });
  }
}
