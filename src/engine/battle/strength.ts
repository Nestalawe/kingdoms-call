import { kcRng } from '../rng.ts';
import { MISSILE_ARMIES_MASTER } from './ladder.ts';
import { FLYING_TYPES } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { ArmyInABattle } from '../army-tables.ts';
import {
  theFactorOnAShotsDamage,
  theShooterShootsFirst,
  theShootersSeeWhatHides,
  theSofteningLimitOfAShooter,
  theStrengthOfAUnitInItsWholeForce,
  theUnitsThatShootThoughNoRangedUnits,
  theVolleyIsStopped,
  theVolleysAShooterLooses,
  whyAUnitMayNotBeShotAt,
} from '../rules/the-registry-of-content-effects.ts';
import type { WhyAShotGlancesOffAUnit } from '../rules/the-registry-of-content-effects.ts';

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

// ── Archery-phase ability helpers ── Which units actually loose this phase, and in what order. The abilities are the
// rule registry's (plan P1-19g): their effects at the stages of "volley", in
// src/engine/rules/unit-abilities/the-volley-before-the-battle.ts, and their numbers in
// src/content/unit-abilities-their-names-numbers-and-words.ts.
export function abilityMissileUnits(
  force: readonly ArmyInABattle[] | null | undefined,
  terrain: string | null | undefined,
): ArmyInABattle[] {
  const list = (force ?? []).filter((a) => MISSILE_ARMIES_MASTER.has(a.type));
  // Who shoots, though it is no ranged unit (Broadside at sea, Tree Watch in the woods), after the ranged units.
  list.push(...theUnitsThatShootThoughNoRangedUnits(force ?? [], terrain));
  // Who shoots first (Bombardment: the guns get the clear shot before the cap fills); the sort keeps the rest's order.
  list.sort((a, b) => (theShooterShootsFirst(b.type) ? 1 : 0) - (theShooterShootsFirst(a.type) ? 1 : 0));
  return list;
}
// The per-unit arrow-softening cap and whether a target has reached it. Flyers soften twice as hard; a shooter's
// ability may push the limit (Punch Through: the registry's "the softening limit"); a unit immune to volleys (Armoured
// Hulls, Shell Wall: "may be shot at") is never worth a shot. A unit at the cap gains nothing from more shots, so the
// target pool skips it (kept in this scope so missileTargetPool sees it).
export const _MISSILE_CAP_FRAC = 0.4; // mirrors MISSILE_CAP_FRACTION (kept local to this module scope) — 2026-09-24: 30% → 40% (80% winged)
export function missileCap(target: ArmyInABattle, firer: ForceUnit): number {
  const baseStr = unitBaseStrength(target);
  const isFly = FLYING_TYPES.has(target.type);
  const capFraction =
    theSofteningLimitOfAShooter({ theShootersType: firer?.type, theTargetFlies: isFly }) ??
    (isFly ? _MISSILE_CAP_FRAC * 2 : _MISSILE_CAP_FRAC);
  return Math.max(1, Math.floor(baseStr * capFraction));
}
/** Why every shot glances off a unit (its immunity to volleys, whatever the shooters see), or null: the one answer
 *  missileCapReached and applyMissileHit both ask the registry's "may be shot at" for. */
export function whyEveryShotGlancesOff(unitType: string): WhyAShotGlancesOffAUnit | null {
  const why = whyAUnitMayNotBeShotAt({ theTargetsType: unitType, theShootersSeeWhatHides: true });
  return why === null || why === 'hidden' ? null : why.immune;
}
export function missileCapReached(target: ForceUnit, firer: ForceUnit): boolean {
  if (!target) return true;
  if (whyEveryShotGlancesOff(target.type) !== null) return true; // immune to volleys — never worth a shot
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
  // A unit that hides from these shooters (Loosed From Cover) stays hidden, unless they see what hides (Eyes of the
  // Forest): the registry's "may be shot at" and "the shooters see what hides".
  const seeWhatHides = theShootersSeeWhatHides(myForce ?? []);
  const visible = all.filter(
    (a) => whyAUnitMayNotBeShotAt({ theTargetsType: a.type, theShootersSeeWhatHides: seeWhatHides }) !== 'hidden',
  );
  const src = visible.length ? visible : all;
  const live = (u: ArmyInABattle) => !missileCapReached(u, firer);
  const fly = src.filter((u) => FLYING_TYPES.has(u.type) && live(u));
  if (fly.length) return fly;
  return src.filter((u) => live(u));
}
// Whether the force shot at stops the volley altogether (Ambush: Forest Wardens in their own woods), unless the
// shooters see what hides (Eyes of the Forest, 2026-10-11): the registry's "stops the volley".
export function archeryBlockedBy(
  defenderForce: readonly ForceUnit[] | null | undefined,
  terrain: string | null | undefined,
  shooters: readonly ForceUnit[] | null | undefined,
): boolean {
  return theVolleyIsStopped({
    theForceTheVolleyIsShotAt: defenderForce ?? [],
    ground: terrain,
    theShootersSeeWhatHides: theShootersSeeWhatHides(shooters ?? []),
  });
}
// The line the report shows when the shooters see what hides and so lift a volley the force shot at would stop (Eyes
// of the Forest lifts an Ambush; null when it does not apply).
export function eyesOfTheForestLine(
  defenderForce: readonly ForceUnit[] | null | undefined,
  terrain: string | null | undefined,
  shooters: readonly ForceUnit[] | null | undefined,
  shooterName: string,
) {
  if (!theShootersSeeWhatHides(shooters ?? [])) return null;
  const stoppedIfUnseen = theVolleyIsStopped({
    theForceTheVolleyIsShotAt: defenderForce ?? [],
    ground: terrain,
    theShootersSeeWhatHides: false,
  });
  if (!stoppedIfUnseen) return null;
  return { kind: 'the eagle riders mark the forest wardens and spoil the ambush', shooterName };
}
// Per-shot damage multipliers from the firing unit's ability (Woodland Volley, Bombardment, Raiders' Volley: the
// registry's "a shot's damage"). isAtk: the firer's side attacks.
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
  return theFactorOnAShotsDamage({
    theShootersType: firer.type,
    theTargetsType: target ? target.type : null,
    ground: terrain,
    theShootersSideAttacks: isAtk,
  });
}
// How many shots a unit fires this phase, before any quiver the commander carries (Prepared Ground: a defending
// Longbow company looses two volleys; the registry's "how many volleys").
export function abilityVolleys(firer: ForceUnit, isAtk: boolean): number {
  return firer ? theVolleysAShooterLooses({ theShootersType: firer.type, theShootersSideAttacks: isAtk }) : 1;
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
