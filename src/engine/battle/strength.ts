// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng } from '../rng.ts';
import { MISSILE_ARMIES_MASTER } from './ladder.ts';
import { ORC_FOOT_TYPES } from '../units/movement.ts';
import { FLYING_TYPES } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';

// ── Force-composition strength multipliers (applied inside armStr) ──
export function unitAbilityMult(army, ctx, terrain) {
  if (!army || !ctx) return 1;
  const t = army.type,
    force = ctx.force || [],
    enemy = ctx.enemyForce || [];
  const enemyHasMissile = enemy.some((a) => a && MISSILE_ARMIES_MASTER.has(a.type));
  let m = 1;
  // 2026-10-11 (Toby, the unit abilities): Shieldwall now lives in the line (battleFaceSide: Levies with an
  // archer behind them), and the Gilded Lances' Shock of the Charge (+40% attacking) is retired; their
  // abilities are Lance Charge and Knightly Example. The Berserkers' old ratio bonus went with the
  // roster PR; theirs are Frenzy and Driven Before Them (battleFaceSide).
  // ORC — Sheer Numbers: goblins are worth little alone and a great deal in a mob — +10% per other orc
  // foot unit in the force (Goblin Hordes, Berserkers, the Orc Garrison), to +30%.
  if (t === 'Goblin Horde') {
    const others = Math.max(0, force.filter((a) => a && ORC_FOOT_TYPES.has(a.type)).length - 1);
    m *= 1 + Math.min(0.3, others * 0.1);
  }
  // ORC — Reaver Crews: troops put ashore by longships hit the beach at a run.
  if (ctx.amphibious) m *= 1.25;
  // PRIMAL — Shoal Swarm (2026-10-13, the beast abilities): sharks are worthless alone and deadly in numbers — +10% per
  // other Shark Shoals in the force, to +30% (as the goblins' Sheer Numbers).
  if (t === 'Shark Shoals') {
    const others = Math.max(0, force.filter((a) => a && a.type === 'Shark Shoals').length - 1);
    m *= 1 + Math.min(0.3, others * 0.1);
  }

  // ── PRIMAL ARMY SIGNATURE ABILITIES ────
  // Each primal beast carries one always-on battle ability, hooked into the enemy's composition or
  // attack/defend posture — the army-battle counterpart of a monster's special. Pre-battle strikes live
  // on the units' `spells` and resolve separately in the pre-battle magic phase.
  // 2026-10-13 (Toby, Creatures and Monsters I): terrain is written ONCE, in TERRAIN_MODS. The multipliers
  // that doubled a terrain row are gone — Mountain Bulwark (Stone Giants), Rooted Grove (Forest Ents),
  // Regenerating Hide's ×1.2/×1.3 (Cave Trolls) — and so is the Titans' always-on ×1.3 (Colossal Bulk's
  // place in the line comes with the beast abilities, as the humanoid units' did). Druid 4 —
  if (t === 'Manticore Pride' && ctx.isAttacker) m *= 1.25; // Relentless Hunt
  if (t === 'Basilisk Brood' && !ctx.isAttacker) m *= 1.25; // Stone Deterrent
  if (t === 'Sea Giants' && terrain !== 'sea' && ctx.coastal) m *= 1.2; // Tidal Might
  if (t === 'Eldritch Kraken' && terrain === 'sea') m *= 1.35; // Deepwater Grasp
  // Druid 5 —
  if (t === 'Elder Dragons') m *= 1.25; // Wyrmscale (unconditional)
  if (t === 'Crimson Rocs' && enemyHasMissile) m *= 1.3; // Air Superiority
  return m;
}

// ── Archery-phase ability helpers ── Which units actually loose this phase, and in what order.
export function abilityMissileUnits(force, terrain) {
  const list = (force || []).filter((a) => MISSILE_ARMIES_MASTER.has(a.type));
  // HUMAN — Broadside: at sea a galleon is a floating battery.
  if (terrain === 'sea')
    (force || []).forEach((a) => {
      if (a.type === 'Galleon Fleet') list.push(a);
    });
  // ELF — Tree Watch: in forest or jungle the Elven Garrison shoots like an archer unit.
  if (terrain === 'forest' || terrain === 'jungle')
    (force || []).forEach((a) => {
      if (a && a.type === 'Elven Garrison') list.push(a);
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
export function missileCap(target, firer) {
  const baseStr = unitBaseStrength(target);
  const isFly = FLYING_TYPES.has(target.type);
  let capFraction = isFly ? _MISSILE_CAP_FRAC * 2 : _MISSILE_CAP_FRAC;
  if (firer && firer.type === 'Ironwood Crossbows') capFraction = isFly ? 0.9 : 0.55; // Punch Through: +15 points on the ground (was 45 vs 30); winged 90 (was 90 vs 60)
  return Math.max(1, Math.floor(baseStr * capFraction));
}
export function missileCapReached(target, firer) {
  if (!target) return true;
  if (target.type === 'Dwarf Ironclads' || target.type === 'Great Turtles') return true; // arrow-immune (Armoured Hulls; the turtles' Shell Wall) — never worth a shot
  return (target._archeryRed || 0) >= missileCap(target, firer);
}
// 2026-09-24 (Toby): targets are RANDOM. Every shot picks at random among the enemy's winged riders
// still below their arrow cap; only when none is left does it pick at random among ALL the other
// enemy units below their cap (no "front row" any more). Shadow Archers stay hidden while anything
// else is visible (Loosed From Cover). `frontWidth` is ignored — kept so old callers still work.
export function missileTargetPool(enemyArmies, frontWidth, firer, myForce) {
  const all = (enemyArmies || []).filter(Boolean);
  // ELF — Eyes of the Forest: with Eagle Riders overhead nothing hides, Shadow Archers included.
  const visible = eyesOfTheForest(myForce) ? all : all.filter((a) => a.type !== 'Shadow Archers');
  const src = visible.length ? visible : all;
  const live = (u) => !missileCapReached(u, firer);
  const fly = src.filter((u) => FLYING_TYPES.has(u.type) && live(u));
  if (fly.length) return fly;
  return src.filter((u) => live(u));
}
// ELF — Ambush: enemy archers never get a clear shot at Wardens in their own woods — unless Eagle Riders
// fly with the shooters (Eyes of the Forest, 2026-10-11): then the Wardens are seen and the volley flies.
export function eyesOfTheForest(force) {
  return (force || []).some((a) => a && a.type === 'Eagle Riders');
}
export function archeryBlockedBy(defenderForce, terrain, shooters) {
  if (terrain !== 'forest' && terrain !== 'jungle') return false;
  if (eyesOfTheForest(shooters)) return false;
  return (defenderForce || []).some((a) => a && a.type === 'Forest Wardens');
}
// The line the report shows when Eyes of the Forest lifts an Ambush (null when it does not apply).
export function eyesOfTheForestLine(defenderForce, terrain, shooters, shooterName) {
  if ((terrain !== 'forest' && terrain !== 'jungle') || !eyesOfTheForest(shooters)) return null;
  if (!(defenderForce || []).some((a) => a && a.type === 'Forest Wardens')) return null;
  return `🦅 ${shooterName}'s Eagle Riders mark the Forest Wardens in the thickets — the Ambush is spoiled and the volley flies.`;
}
// Per-shot damage multipliers from the firing unit's ability. isAtk: the firer's side attacks.
// 2026-10-11 (Toby, the unit abilities): the Longbows' Massed Volley is retired (theirs are Bodkin Points
// and Prepared Ground); the Black Arrows' Raiders' Volley arrives.
export function missileDamageMult(firer, force, terrain, target, isAtk) {
  if (!firer) return 1;
  let m = 1;
  // ELF — Woodland Volley: elven bows in elven woods.
  if (firer.type === 'Elven Bowmen' && (terrain === 'forest' || terrain === 'jungle')) m *= 2;
  // DWARF — Bombardment: siege guns are built for breaking fortifications.
  if (firer.type === 'Mountain Guns' && target && /Garrison/.test(target.type || '')) m *= 1.5;
  // ORC — Raiders' Volley: the Black Arrows loose hardest going forward.
  if (firer.type === 'Black Arrows' && isAtk) m *= 1.5;
  return m;
}
// Prepared Ground: a defending Longbow company looses two volleys. How many shots a unit fires this
// phase, before any quiver the commander carries.
export function abilityVolleys(firer, isAtk) {
  return firer && firer.type === 'Yeoman Longbows' && !isAtk ? 2 : 1;
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
export function applyFlakScreen(myForce, enemyForce, myName, narr) {
  const gyros = (myForce || []).filter((a) => a && a.type === 'Gnomish Gyrocopters');
  if (!gyros.length) return;
  const flyers = (enemyForce || []).filter((a) => a && FLYING_TYPES.has(a.type) && !a._flakTargeted);
  if (!flyers.length) return;
  const pool = flyers.slice();
  let engaged = 0;
  // Item 4 FIX: build the flak lines LOCALLY. `narr` here is the SHARED battle narrative that
  // already holds the "…moves into… a battle is initiated." line, so the old
  // `narr.unshift(summary)` prepended the flyer-engage summary to the very TOP of the whole report
  // (above "battle is initiated") while the harry details pushed to the end — scattering the
  // sequence. Appending the summary then its details keeps the flak event in order, wherever this
  // pre-battle call sits.
  const lines = [];
  gyros.forEach(() => {
    if (!pool.length) return;
    const idx = Math.floor(kcRng() * pool.length);
    const t = pool.splice(idx, 1)[0];
    t._flakTargeted = true;
    const red = Math.max(1, Math.round(unitBaseStrength(t) * 0.3));
    t._tempStrReduction = (t._tempStrReduction || 0) + red;
    lines.push(`  💨 Gyrocopters harry the ${t.unitName || t.type} — driven off their line (−${red} strength).`);
    engaged++;
  });
  if (engaged) {
    narr.push(`🌀 ${myName}'s Gnomish Gyrocopters climb to meet the enemy's flyers — ${engaged} engaged.`);
    lines.forEach((l) => narr.push(l));
  }
}
