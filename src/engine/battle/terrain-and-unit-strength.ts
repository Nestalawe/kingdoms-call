// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { alignProto, CONDOTTIERI_MULT, CONDOTTIERI_VS_BEASTS_MULT, protoAlignOf } from '../alignment-prototypes.ts';
import { KC_QUALITY_UP, KC_RIVAL_RACE, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { battleGrid } from './lines.ts';
import { MISSILE_ARMIES_MASTER } from './ladder.ts';
import { ladderFm } from './a-multiplier-written-as-the-strength-ladder-shows-it.ts';
import {
  AERIAL_TYPES,
  CREATURE_ARMIES,
  FLYING_TYPES,
  MONSTER_ARMIES,
  SEA_TYPES,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { missileCap, unitAbilityMult } from './strength.ts';
import { UNIT_BASE_STR, UNIT_Q_MULT, unitBaseStrength } from '../rules-on-plain-values/unit-types-and-base-strength.ts';
import { druIdPenaltyMult } from '../world/tables.ts';
import {
  druidLevelTheMasteryCounts,
  druidMasteryGainOver,
  druidNeedWaivedByAlignment,
  getDruidLevel,
} from '../rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import { activeItems, hasItemBase } from '../items/equipment.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { perkTier } from '../titles/perks.ts';
import { MINOR_CAV, MINOR_HEAVY } from '../titles/reckoning.ts';
import { discUnitMult, dragonTamed, gdActive } from '../discoveries.ts';
import { charMinor } from '../titles/title-holders-and-battle-merit.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';

// ── TERRAIN, SEA AND A UNIT'S STRENGTH (plan P1-08b: lifted out of resolveTurn) ────
// What one unit is worth in a battle: the ground it fights on (terrainMod, illusory terrain, the sea penalty), arrows
// and pre-battle damage, kinship, Druid mastery and every per-unit modifier (armStr), and the rows of the strength
// ladder built from them (ladderRow, finishSide). bestCurseSkill, druidMasteryGain, armStr and ladderRow take the
// turn's context first (src/engine/turn/context.ts); the rest read no turn state.
// ── TERRAIN STRENGTH MODIFIERS ────
// Applied to individual army unit strength during battle resolution. Flyers (every KC_UNIT_CLASS.aerial
// unit: the winged riders and the flying beasts) fight at 1.0 everywhere except under the trees: ×0.75 in
// forest and jungle (2026-10-12, Toby item 19; they had been terrain-immune). Naval units: no terrain
// effect anywhere — and the Naval skill lifts them on land too.
export const TERRAIN_MODS = {
  // NAVAL UNITS FIGHT AT FULL STRENGTH IN EVERY PROVINCE, land or sea — the old ×0.60 "beached
  // fleet" penalty (×0.80 for Sea Giants) is gone; every fleet / sea-beast entry below is 1.0 and
  // terrainMod() short-circuits them like flyers. Sea Giants' Tidal Might is now a coastal-land
  // bonus (see unitAbilityMult).
  // 2026-10-11 (Toby, the army roster): human line foot and longbows ×1.1 on the plain; Forest Wardens
  // no longer suffer in the open (×1.0 plain, ×0.9 desert) and are ×1.1 rather than ×1.2 in the woods;
  // Orc Berserkers ×1.0 on the plain; Goblin Horde ×1.0 in the desert; the dwarves' mountain bonus is
  // ×1.1 (Guard, Crossbows, Guns). tests/roster holds every cell to the decided roster.
  plain: {
    'Men-at-Arms': 1.1,
    'Stag Riders': 1.1,
    'Ironhoof Rams': 1.0,
    'Black Arrows': 1.0,
    'Shieldwall Levies': 1.1,
    'Free Lances': 1.15,
    'Gilded Lances': 1.15,
    'Yeoman Longbows': 1.1,
    'Human Garrison': 1.0,
    'Elven Bowmen': 1.0,
    'Forest Wardens': 1.0,
    'Shadow Archers': 0.9,
    'Dwarven Guard': 0.9,
    'Ironwood Crossbows': 1.0,
    'Mountain Guns': 0.85,
    'Dwarf Garrison': 0.9,
    'Warg Riders': 1.1,
    'Orc Berserkers': 1.0,
    'Goblin Horde': 1.0,
    'Orc Garrison': 1.0,
    'Elven Garrison': 1.0,
    'Galleon Fleet': 1.0,
    'Corsair Fleet': 1.0,
    'Elven Galleys': 1.0,
    'Dwarf Ironclads': 1.0,
    'Orcish Longships': 1.0,
    'Whale Cohort': 1.0,
    'Shark Shoals': 1.0,
    'Noble Griffons': 1.0,
    'Stone Giants': 0.9,
    'Forest Ents': 0.9,
    'Cave Trolls': 1.0,
    'Manticore Pride': 1.0,
    'Basilisk Brood': 0.9,
    'Titan Warbeasts': 1.1,
    'Crimson Rocs': 1.0,
    'Elder Dragons': 1.0,
    'Sea Giants': 1.0,
    'Eldritch Kraken': 1.0,
    'Dread Hydras': 1.0,
    'Great Bears': 1.0,
    'Unicorn Herd': 1.1,
    'Mammoth Host': 1.1,
    'Great Turtles': 1.0,
  },
  desert: {
    'Men-at-Arms': 1.0,
    'Stag Riders': 1.0,
    'Ironhoof Rams': 0.9,
    'Black Arrows': 1.0,
    'Shieldwall Levies': 1.0,
    'Free Lances': 1.15,
    'Gilded Lances': 1.15,
    'Yeoman Longbows': 0.9,
    'Human Garrison': 0.9,
    'Elven Bowmen': 0.8,
    'Forest Wardens': 0.9,
    'Shadow Archers': 0.85,
    'Dwarven Guard': 0.9,
    'Ironwood Crossbows': 1.0,
    'Mountain Guns': 0.85,
    'Dwarf Garrison': 0.85,
    'Warg Riders': 1.1,
    'Orc Berserkers': 1.05,
    'Goblin Horde': 1.0,
    'Orc Garrison': 0.9,
    'Elven Garrison': 0.85,
    'Galleon Fleet': 1.0,
    'Corsair Fleet': 1.0,
    'Elven Galleys': 1.0,
    'Dwarf Ironclads': 1.0,
    'Orcish Longships': 1.0,
    'Whale Cohort': 1.0,
    'Shark Shoals': 1.0,
    'Noble Griffons': 1.0,
    'Stone Giants': 0.9,
    'Forest Ents': 0.75,
    'Cave Trolls': 0.85,
    'Manticore Pride': 1.0,
    'Basilisk Brood': 1.1,
    'Titan Warbeasts': 1.1,
    'Crimson Rocs': 1.0,
    'Elder Dragons': 1.0,
    'Sea Giants': 1.0,
    'Eldritch Kraken': 1.0,
    'Dread Hydras': 0.85,
    'Great Bears': 0.8,
    'Unicorn Herd': 1.0,
    'Mammoth Host': 0.85,
    'Great Turtles': 1.0,
  },
  forest: {
    'Men-at-Arms': 0.9,
    'Stag Riders': 1.1,
    'Ironhoof Rams': 0.9,
    'Black Arrows': 0.9,
    'Shieldwall Levies': 0.9,
    'Free Lances': 0.75,
    'Gilded Lances': 0.75,
    'Yeoman Longbows': 0.85,
    'Human Garrison': 1.0,
    'Elven Bowmen': 1.15,
    'Forest Wardens': 1.1,
    'Shadow Archers': 1.1,
    'Dwarven Guard': 0.9,
    'Ironwood Crossbows': 0.9,
    'Mountain Guns': 0.8,
    'Dwarf Garrison': 0.9,
    'Warg Riders': 0.9,
    'Orc Berserkers': 1.1,
    'Goblin Horde': 1.0,
    'Orc Garrison': 1.0,
    'Elven Garrison': 1.1,
    'Galleon Fleet': 1.0,
    'Corsair Fleet': 1.0,
    'Elven Galleys': 1.0,
    'Dwarf Ironclads': 1.0,
    'Orcish Longships': 1.0,
    'Whale Cohort': 1.0,
    'Shark Shoals': 1.0,
    'Noble Griffons': 0.75,
    'Stone Giants': 0.9,
    'Forest Ents': 1.15,
    'Cave Trolls': 1.1,
    'Manticore Pride': 0.75,
    'Basilisk Brood': 1.0,
    'Titan Warbeasts': 0.8,
    'Crimson Rocs': 0.75,
    'Elder Dragons': 0.75,
    'Eagle Riders': 0.75,
    'Wyvern Riders': 0.75,
    'Gnomish Gyrocopters': 0.75,
    Thunderbirds: 0.75, // item 19: flyers in the woods
    'Sea Giants': 1.0,
    'Eldritch Kraken': 1.0,
    'Dread Hydras': 1.05,
    'Great Bears': 1.1,
    'Unicorn Herd': 1.1,
    'Mammoth Host': 0.8,
    'Great Turtles': 1.0,
  },
  jungle: {
    'Men-at-Arms': 0.85,
    'Stag Riders': 1.0,
    'Ironhoof Rams': 0.85,
    'Black Arrows': 0.9,
    'Shieldwall Levies': 0.85,
    'Free Lances': 0.7,
    'Gilded Lances': 0.7,
    'Yeoman Longbows': 0.8,
    'Human Garrison': 1.0,
    'Elven Bowmen': 1.1,
    'Forest Wardens': 1.1,
    'Shadow Archers': 1.1,
    'Dwarven Guard': 0.85,
    'Ironwood Crossbows': 0.85,
    'Mountain Guns': 0.75,
    'Dwarf Garrison': 0.85,
    'Warg Riders': 0.8,
    'Orc Berserkers': 1.05,
    'Goblin Horde': 1.0,
    'Orc Garrison': 1.0,
    'Elven Garrison': 1.1,
    'Galleon Fleet': 1.0,
    'Corsair Fleet': 1.0,
    'Elven Galleys': 1.0,
    'Dwarf Ironclads': 1.0,
    'Orcish Longships': 1.0,
    'Whale Cohort': 1.0,
    'Shark Shoals': 1.0,
    'Noble Griffons': 0.75,
    'Stone Giants': 0.8,
    'Forest Ents': 1.15,
    'Cave Trolls': 1.05,
    'Manticore Pride': 0.75,
    'Basilisk Brood': 1.1,
    'Titan Warbeasts': 0.75,
    'Crimson Rocs': 0.75,
    'Elder Dragons': 0.75,
    'Eagle Riders': 0.75,
    'Wyvern Riders': 0.75,
    'Gnomish Gyrocopters': 0.75,
    Thunderbirds: 0.75, // item 19: flyers in the woods
    'Sea Giants': 1.0,
    'Eldritch Kraken': 1.0,
    'Dread Hydras': 1.1,
    'Great Bears': 1.0,
    'Unicorn Herd': 0.9,
    'Mammoth Host': 0.75,
    'Great Turtles': 1.0,
  },
  mountain: {
    'Men-at-Arms': 0.9,
    'Stag Riders': 0.85,
    'Ironhoof Rams': 1.0,
    'Black Arrows': 0.9,
    'Shieldwall Levies': 0.9,
    'Free Lances': 0.75,
    'Gilded Lances': 0.75,
    'Yeoman Longbows': 1.0,
    'Human Garrison': 1.0,
    'Elven Bowmen': 1.0,
    'Forest Wardens': 0.85,
    'Shadow Archers': 1.0,
    'Dwarven Guard': 1.1,
    'Ironwood Crossbows': 1.1,
    'Mountain Guns': 1.1,
    'Dwarf Garrison': 1.15,
    'Warg Riders': 0.8,
    'Orc Berserkers': 0.9,
    'Goblin Horde': 0.9,
    'Orc Garrison': 0.9,
    'Elven Garrison': 0.9,
    'Galleon Fleet': 1.0,
    'Corsair Fleet': 1.0,
    'Elven Galleys': 1.0,
    'Dwarf Ironclads': 1.0,
    'Orcish Longships': 1.0,
    'Whale Cohort': 1.0,
    'Shark Shoals': 1.0,
    'Noble Griffons': 1.0,
    'Stone Giants': 1.15,
    'Forest Ents': 0.9,
    'Cave Trolls': 1.15,
    'Manticore Pride': 1.0,
    'Basilisk Brood': 0.9,
    'Titan Warbeasts': 0.8,
    'Crimson Rocs': 1.0,
    'Elder Dragons': 1.0,
    'Sea Giants': 1.0,
    'Eldritch Kraken': 1.0,
    'Dread Hydras': 0.9,
    'Great Bears': 1.1,
    'Unicorn Herd': 0.85,
    'Mammoth Host': 1.0,
    'Great Turtles': 1.0,
  },
  sea: {
    // All land armies penalised in sea — ×0.75 (applied separately as seaLandPenalty) Naval units
    // are full strength. Flying at full strength. Individual modifiers here are mostly 1.0 since
    // the sea penalty is applied globally.
    'Galleon Fleet': 1.0,
    'Corsair Fleet': 1.0,
    'Elven Galleys': 1.0,
    'Dwarf Ironclads': 1.0,
    'Orcish Longships': 1.0,
    'Whale Cohort': 1.0,
    'Shark Shoals': 1.0,
    'Sea Giants': 1.0,
    'Eldritch Kraken': 1.0,
    'Great Turtles': 1.0,
    // Flying fight fine at sea
    'Eagle Riders': 1.0,
    'Wyvern Riders': 1.0,
    'Gnomish Gyrocopters': 1.0,
    'Elder Dragons': 1.0,
    'Crimson Rocs': 1.0,
    Thunderbirds: 1.0,
  },
};

// Returns terrain modifier for a given army type in given terrain
export function terrainMod(armyType, terrain) {
  // flyers read their row like anyone (×1 unless listed: ×0.75 in forest and jungle since item 19, 2026-10-12)
  if (SEA_TYPES.has(armyType)) return 1.0; // fleets and sea-beasts fight at 100% on land and sea alike
  const t = TERRAIN_MODS[terrain];
  if (!t) return 1.0;
  return t[armyType] ?? 1.0;
}

// ── ILLUSORY TERRAIN (per-unit) ────
// A non-caster force fighting in a province cloaked by Illusory Terrain is disoriented: every unit
// fights as though caught in the WORST possible ground for its kind, but always at LEAST a 15%
// reduction. Returns the per-unit multiplier (≤0.85). Worst is taken over the land terrains only —
// 'sea' is excluded (its land-army penalty is applied separately via seaPenalty, and it would
// otherwise wrongly floor naval/flying units). Flyers' worst ground is now the woods (×0.75, item 19,
// 2026-10-12), so the illusion takes them to ×0.75 (it was the 0.85 floor while they ignored terrain). Stacks on top of the real terrain penalty,
// exactly as the old flat 20% did.
export const ILLUSORY_TERRAIN_KEYS = ['plain', 'desert', 'forest', 'jungle', 'mountain'];
export function illusoryTerrainMult(armyType) {
  let worst = 1.0;
  for (const t of ILLUSORY_TERRAIN_KEYS) {
    const m = terrainMod(armyType, t);
    if (m < worst) worst = m;
  }
  return Math.min(0.85, worst);
}

// Module-level base unit strength (type × quality), independent of terrain/druid/temporary
// reductions. Used by the pre-battle missile phases to make arrow damage proportionate to the
// target and cappable. Battle-magic Curse: pick the commander's best combat-affecting skill to
// halve. Candidates are Tactical (land battles), Druid (army penalties/creature buffs) and Naval
// (sea battles).
export function bestCurseSkill(turnContext, hero) {
  // 2026-09-09e: Druid was read RAW here while Tactical and Naval were item-boosted, so a commander
  // whose Druid came from an item had the wrong skill chosen for the Curse. All three now use the
  // same stack.
  const tac = effStat(turnContext, hero, 'tactical'),
    dru = effStat(turnContext, hero, 'druid'),
    nav = effStat(turnContext, hero, 'naval');
  if (nav >= tac && nav >= dru && nav > 0) return 'naval';
  return tac >= dru ? 'tactical' : 'druid';
}
export function curseSkillLabel(stat) {
  return stat === 'naval' ? 'Naval command' : stat === 'druid' ? 'Druid mastery' : 'Tactical command';
}
// Pre-battle missile "softening" (2026-09-24, Toby: simplified). A volley's damage comes from the
// SHOOTER, not the target: 30% of the firing unit's base strength (unit strength × quality — so a
// veteran company hits harder than a green one), +10% per level of the commander's Archery,
// × the firing unit's own ability (Woodland Volley, Bombardment, Raiders' Volley), rounded, minimum 1.
// Winged riders take double and are shot first. What a TARGET can lose is capped: 40% of its own
// base strength (80% for a winged rider; Ironwood Crossbows' Punch Through lifts both to 55% / 90% — see
// missileCap). The 25% pre-battle floor below still applies on top.
export const MISSILE_SHOT_PCT = 0.3,
  MISSILE_ARCH_PER_LVL = 0.1,
  MISSILE_CAP_FRACTION = 0.4; // 2026-10-11 (Toby): volleys 20% → 30%
export function missileShotDamage(firer, archSkill, dmgMult) {
  const fs = firer ? unitBaseStrength(firer) : 10;
  return Math.max(
    1,
    Math.round(fs * MISSILE_SHOT_PCT * (1 + MISSILE_ARCH_PER_LVL * Math.max(0, archSkill || 0)) * (dmgMult || 1)),
  );
}
// PRE-BATTLE SOFTENING FLOOR. Archery is capped per-unit at MISSILE_CAP_FRACTION, but pre-battle
// MAGIC and primal army strikes pour into _tempStrReduction with no cap of their own, so a unit hit
// by several effects (e.g. Spiritwrack + Fireball + Choking Spores + arrows) could be softened to
// zero before the real fighting began. This floor guarantees every unit still enters the melee with
// at least this fraction of its (druid/terrain-adjusted) strength — no unit is ever softened away.
export const PREBATTLE_STR_FLOOR = 0.25;
// Subtract a unit's pre-battle damage from a strength figure, never below PREBATTLE_STR_FLOOR of it.
// Two steps, as before: this battle's damage, then any all-turn reduction.
export function applyPrebattleDamage(army, str) {
  if (army._tempStrReduction) {
    const f = Math.max(1, Math.floor(str * PREBATTLE_STR_FLOOR));
    str = Math.max(f, str - army._tempStrReduction);
  } // battle-only; cleared at battle end
  if (army._turnStrReduction) {
    const f2 = Math.max(1, Math.floor(str * PREBATTLE_STR_FLOOR));
    str = Math.max(f2, str - army._turnStrReduction);
  } // persists all turn
  return str;
}
export function applyMissileHit(target, archSkill, firer, opts) {
  opts = opts || {};
  // DWARF — Armoured Hulls: arrows and bolts simply do not tell against plated warships.
  if (target && target.type === 'Dwarf Ironclads')
    return { dmg: 0, isFly: false, capped: false, immune: true, why: 'armoured hull' };
  // PRIMAL — Shell Wall (2026-10-13, the beast abilities): nor against the Great Turtles' shells.
  if (target && target.type === 'Great Turtles')
    return { dmg: 0, isFly: false, capped: false, immune: true, why: 'shell' };
  const isFly = FLYING_TYPES.has(target.type);
  let dmg = missileShotDamage(firer, archSkill, opts.dmgMult); // the SHOOTER's strength decides the hit
  if (isFly) dmg = dmg * 2; // archers are especially good against winged riders — double damage
  // PRIMAL — Thick Hide: a volley at the Great Bears does half (rounded up).
  const thickHide = target.type === 'Great Bears';
  if (thickHide) dmg = Math.ceil(dmg / 2);
  // DWARF — Punch Through: heavy bolts grind a target past the point bows can manage.
  const cap = missileCap(target, firer);
  const already = target._archeryRed || 0;
  dmg = Math.max(0, Math.min(dmg, cap - already));
  if (dmg > 0) {
    target._archeryRed = already + dmg;
    target._tempStrReduction = (target._tempStrReduction || 0) + dmg;
  }
  return { dmg, isFly, capped: already + dmg >= cap, thickHide };
}

// Sea penalty for non-flying land units fighting in sea provinces ×0.75 = roughly one quality tier
// lower
export const SEA_LAND_PENALTY = 0.75;

export function isAirborneAtSea(force) {
  const f = (force || []).filter(Boolean);
  if (!f.length) return false;
  if (f.some((a) => SEA_TYPES.has(a.type))) return false;
  return f.some((a) => !FLYING_TYPES.has(a.type) && !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type));
}
// the race-affinity ("kin") bonus has always been applied inside armStr, but no battle line ever
// said so, so players could not tell it was in effect. One line per side, before the force rows.
// ownerRace = race of the OWNING king (the province owner's for a leaderless garrison).
export function kinNarrative(force, leader, ownerRace, sideName) {
  const f = (force || []).filter((a) => a && a.race);
  if (!f.length) return null;
  const lr = (leader && leader.race) || null;
  const both = f.filter((a) => ownerRace && a.race === ownerRace && lr && a.race === lr).length;
  const kingOnly = f.filter((a) => ownerRace && a.race === ownerRace && !(lr && a.race === lr)).length;
  const leadOnly = f.filter((a) => lr && a.race === lr && !(ownerRace && a.race === ownerRace)).length;
  if (!both && !kingOnly && !leadOnly) return null;
  const parts = [];
  if (both)
    parts.push(
      `${both} unit${both !== 1 ? 's' : ''} of the king's own race under a commander of that blood (+44% strength)`,
    );
  if (kingOnly) parts.push(`${kingOnly} unit${kingOnly !== 1 ? 's' : ''} of the king's race (+20%)`);
  if (leadOnly) parts.push(`${leadOnly} unit${leadOnly !== 1 ? 's' : ''} of their commander's race (+20%)`);
  return { kind: "a side's units fight beside their own kin", sideName, kinshipWords: parts.join('; ') };
}
// ownedUnitName / unitRef moved to module level beside disbandLine (2026-10-11), so rollUnitFates and the
// tests can reach them.
// a COASTAL province is a land province with at least one sea neighbour (used by Sea Giants' Tidal
// Might). Module-level so every battle path and the bot model can share it.
export function provIsCoastal(G, prov) {
  if (!G || !G.world || !prov || prov.terrain === 'sea') return false;
  return getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).some((n) => n && n.terrain === 'sea');
}
export function seaPenalty(armyType, terrain) {
  if (terrain !== 'sea') return 1.0;
  // 2026-09-23e (Toby): EVERY flyer fights normally at sea — the flying beasts (Thunderbirds,
  // Manticore Pride, Crimson Rocs, Elder Dragons: AERIAL_TYPES) included. They were caught by the
  // ×0.75 land-unit penalty because only the winged riders (FLYING_TYPES) were exempted.
  if (AERIAL_TYPES.has(armyType) || SEA_TYPES.has(armyType)) return 1.0;
  return SEA_LAND_PENALTY;
}

// DRUID MASTERY gain for one unit under one commander → {gain (0‥1), lvl, min}. runTurn scope
// (needs effStat / dragonTamed). Mirrors the player portal's "Armies leading" panel.
export function druidMasteryGain(turnContext, heroChar, army, playerAlignment) {
  const none = { gain: 0, lvl: 0, min: 0 };
  if (!heroChar || !army || army._isSkeletal) return none;
  if (!(CREATURE_ARMIES.has(army.type) || MONSTER_ARMIES.has(army.type))) return none;
  let lvl = heroChar._druidNegated ? 0 : effStat(turnContext, heroChar, 'druid') || 0;
  if (heroChar._curseHalveStat === 'druid') lvl = Math.floor(lvl / 2);
  lvl = druidLevelTheMasteryCounts(lvl);
  const waived =
    druidNeedWaivedByAlignment(army.type, playerAlignment, heroChar.alignment) ||
    !!dragonTamed(turnContext, heroChar, army);
  const min = waived ? 0 : getDruidLevel(army.type);
  let gain = druidMasteryGainOver(lvl, min);
  // PROTOTYPE Druidic (round 2): Beast-speech — mastery over the beasts grows twice as fast (still capped at +100%)
  if (gain > 0 && protoAlignOf(turnContext.G, heroChar.player) === 'Druidic') gain = Math.min(1, gain * 2);
  return { gain: Math.round(gain * 100) / 100, lvl, min };
}
export function armStr(turnContext, army, heroChar, playerAlignment, terrain, ctx, opts) {
  const { G } = turnContext;
  const ARMY_STR = UNIT_BASE_STR; // alias → master (was a stale 6th copy of the strength table)
  const Q_MULT = UNIT_Q_MULT; // alias → master
  // Strength-ladder trace (2026-09-23b): when the caller passes ctx.trace, every per-unit modifier
  // that fires is named there. Recording only — never changes the figure.
  const _tr = ctx && Array.isArray(ctx.trace) ? ctx.trace : null;
  // Oratory (Psychic): armies travelling with an inspired commander fight one quality tier
  // higher.
  const Q_UP = { ...KC_QUALITY_UP };
  let effQuality = army.quality || 'Average';
  if (heroChar && heroChar._oratoryBoost) {
    const _oN = (heroChar._oratoryBoost === true ? 1 : heroChar._oratoryBoost | 0) || 1;
    for (let _oi = 0; _oi < _oN; _oi++) effQuality = Q_UP[effQuality] || effQuality;
  } // PSYCHIC Oratory: +1 quality tier (+2 with Words of Awe, L6)
  if (
    heroChar &&
    perkTier(heroChar, 'druid') >= 3 &&
    (CREATURE_ARMIES.has(army.type) || MONSTER_ARMIES.has(army.type))
  ) {
    effQuality = Q_UP[effQuality] || effQuality;
  } // DRUID L8: creatures & monsters fight one tier higher
  if (heroChar && army._isSkeletal && perkTier(heroChar, 'necromancy') >= 1) {
    effQuality = Q_UP[effQuality] || effQuality;
  } // NECROMANCY L6 (The Necromantic Arts): skeletal armies you lead fight one experience tier higher
  if (army._tacUp || army._drumUp) {
    effQuality = Q_UP[effQuality] || effQuality;
  } // TACTICAL L6 / War Drum: fight one tier higher (rolled ONCE per battle at battle start)
  if (_tr && effQuality !== (army.quality || 'Average')) {
    const _w = [];
    if (heroChar && heroChar._oratoryBoost) _w.push('Oratory');
    if (
      heroChar &&
      perkTier(heroChar, 'druid') >= 3 &&
      (CREATURE_ARMIES.has(army.type) || MONSTER_ARMIES.has(army.type))
    )
      _w.push('Druid mastery');
    if (heroChar && army._isSkeletal && perkTier(heroChar, 'necromancy') >= 1) _w.push('Necromantic mastery');
    if (army._tacUp) _w.push('Tactical mastery');
    if (army._drumUp) _w.push('War Drum');
    _tr.push({ label: `fights as ${effQuality}${_w.length ? ` (${_w.join(' + ')})` : ''}` });
  }
  const baseStr = (ARMY_STR[army.type] || 4) * (Q_MULT[effQuality] || 2);
  // Apply Druid penalty
  let str = baseStr;
  if (heroChar) {
    const penalty = druIdPenaltyMult(heroChar, army, playerAlignment, dragonTamed(turnContext, heroChar, army));
    if (penalty < 1) {
      str = Math.floor(str * penalty);
      if (_tr) _tr.push({ label: `Druid shortfall ${ladderFm(penalty)}` });
    }
  }
  // ── RACE CONTEXT (computed once for all race modifiers) ── _unitRace: the army's kin.
  // _ownerRace: the race of the OWNING PLAYER'S KING (their chosen race), from ctx.ownerRace when
  // supplied (leaderless owned garrison) else the leader's player. _leaderRace: the leading
  // character's kin. All humanoid; the equality tests never fire for Primal/skeleton/monster.
  const _unitRace = army.race || null;
  const _ownerRace =
    ctx && ctx.ownerRace != null
      ? ctx.ownerRace
      : heroChar && heroChar.player != null
        ? G.players[heroChar.player]?.race
        : null;
  const _leaderRace = (heroChar && heroChar.race) || null;
  // ── HUMANOID RACE AFFINITY ── Two INDEPENDENT, STACKING ×1.2 base-strength boosts:
  // • King's race: units of the same race as the owning player's king. • Leader's race: units led by
  // a character (king or hero) of the same race. A king personally leading his own-race troops → ×1.44.
  // PROTOTYPE Neutral (master list): Open ranks — a Neutral kit realm's kings and heroes lead a humanoid company of any
  // race with the full kin bonus (×1.44), and never suffer the old grudges
  const _openRanks =
    heroChar &&
    heroChar.player != null &&
    protoAlignOf(G, heroChar.player) === 'Neutral' &&
    _unitRace &&
    !CREATURE_ARMIES.has(army.type) &&
    !MONSTER_ARMIES.has(army.type) &&
    !army._isSkeletal;
  if (_openRanks) {
    str = Math.round(str * 1.3); // round 22 (round 21: ×1.2; master list: ×1.44)
    if (_tr) _tr.push({ label: 'Open ranks ×1.3' });
  } else if (_unitRace) {
    if (_ownerRace && _unitRace === _ownerRace) str = Math.round(str * 1.2); // king's-race affinity
    if (_leaderRace && _unitRace === _leaderRace) str = Math.round(str * 1.2); // leader's-race affinity
    if (_tr) {
      const _k = (_ownerRace && _unitRace === _ownerRace ? 1 : 0) + (_leaderRace && _unitRace === _leaderRace ? 1 : 0);
      if (_k) _tr.push({ label: `kinship ${_k === 2 ? '×1.44' : '×1.2'}` });
    }
  }
  // ── RACIAL ANIMOSITY ── Elves & Dwarves, and Humans & Orcs, bear an ancient grudge: an army
  // led by a commander of the RIVAL kin fights at −20%. Keyed on unit-vs-leader race.
  if (_unitRace && _leaderRace && !_openRanks) {
    const _RIVAL_RACE = { ...KC_RIVAL_RACE };
    if (_RIVAL_RACE[_unitRace] === _leaderRace) {
      str = Math.round(str * 0.8);
      if (_tr) _tr.push({ label: 'racial animosity ×0.8' });
    }
  }
  // Apply terrain modifier
  if (terrain) {
    // ELF — Sea Archers: elven missile troops aboard galleys shoot from steady decks and do not
    // suffer the usual land-unit penalty at sea.
    let sp = seaPenalty(army.type, terrain);
    // AIRBORNE AT SEA. A force fighting in a sea province with NO naval hull or sea-beast among
    // it is there only because its flyers carried the foot soldiers. Those dangling land units
    // fight at QUARTER strength (×0.25, not the usual ×0.75 for troops aboard ships), and the
    // humanoid flyers doing the carrying fight at HALF strength (×0.5). Primal winged beasts
    // (AERIAL_TYPES) carry nothing and keep full strength. A pure-flyer force (nothing carried)
    // is unaffected.
    if (terrain === 'sea' && ctx && isAirborneAtSea(ctx.force)) {
      if (FLYING_TYPES.has(army.type)) sp = 0.5;
      else if (!AERIAL_TYPES.has(army.type) && !SEA_TYPES.has(army.type)) sp = 0.25;
    }
    if (
      sp < 1 &&
      terrain === 'sea' &&
      ctx &&
      (ctx.force || []).some((a) => a && a.type === 'Elven Galleys') &&
      MISSILE_ARMIES_MASTER.has(army.type)
    )
      sp = 1.0;
    if (
      sp < 1 &&
      terrain === 'sea' &&
      heroChar &&
      (perkTier(heroChar, 'naval') >= 3 || activeItems(heroChar).some((it) => it.landFullAtSea))
    )
      sp = 1.0; // NAVAL L8 / Tide-Caller's Horn: land units led at sea take no penalty
    let _tmod = terrainMod(army.type, terrain);
    if (heroChar && perkTier(heroChar, 'march') >= 3) {
      _tmod = _tmod > 1 ? 1 + (_tmod - 1) * 2 : Math.max(1, _tmod);
    } // MARCH L8: terrain bonuses doubled, no terrain penalties
    if (army._laNoTerrain && _tmod > 1) _tmod = 1; // MARCH L9 Lightning Advance: the ambushed side gets no terrain bonus
    let terrainMultFinal = _tmod * sp;
    // (Home-of-the-Wild forest/jungle ×1.5 for Creatures is applied ONCE, below, keyed on the
    // realm — a duplicate copy that lived here caused a ×2.25 double-dip for Druidic-aligned
    // commanders and has been removed.)
    str = Math.floor(str * terrainMultFinal);
    if (_tr && Math.abs(terrainMultFinal - 1) > 1e-9)
      _tr.push({ label: `${terrain} terrain ${ladderFm(terrainMultFinal)}` });
  }
  // ── ELVEN WOODLAND MASTERY ── Elven armies of an Elven realm fight +50% in forest and jungle —
  // their home ground. (Raised from +20% this session.)
  if (_unitRace === 'Elven' && _ownerRace === 'Elven' && (terrain === 'forest' || terrain === 'jungle')) {
    str = Math.round(str * 1.5);
    if (_tr) _tr.push({ label: 'Elven Woodland Mastery ×1.5' });
  }
  // ── DWARVEN BULWARK ── Dwarven armies of a Dwarven realm defend at ×1.5 in any battle
  // (per-unit; applies only on the defending side).
  if (_unitRace === 'Dwarven' && _ownerRace === 'Dwarven' && ctx && ctx.isAttacker === false) {
    str = Math.round(str * 1.5);
    if (_tr) _tr.push({ label: 'Dwarven Bulwark ×1.5' });
  }
  // GRAND DESIGN — Pagan (Standing Stones). 2026-09-14: keyed on the DEFENDING REALM, not on a
  // hero being present, so an unled garrison holding forest, jungle or mountain gets the same
  // +25% the description promises — exactly as Dwarven Bulwark already does on the line above.
  {
    const _pagPi =
      heroChar && heroChar.player != null ? heroChar.player : ctx && ctx.ownerPi != null ? ctx.ownerPi : null;
    if (
      _pagPi != null &&
      gdActive(turnContext, _pagPi, 'Pagan') &&
      ctx &&
      ctx.isAttacker === false &&
      (terrain === 'forest' || terrain === 'jungle' || terrain === 'mountain')
    ) {
      str = Math.round(str * 1.25);
      if (_tr) _tr.push({ label: 'Standing Stones ×1.25' });
    }
  }
  // race / alignment `unitStr` discoveries (per unit; owner = leader's realm, or the garrison's
  // owner).
  {
    const _dpi =
      heroChar && heroChar.player != null ? heroChar.player : ctx && ctx.ownerPi != null ? ctx.ownerPi : null;
    if (_dpi != null) {
      const _dm = discUnitMult(turnContext, _dpi, army, terrain, ctx, heroChar);
      if (_dm !== 1) {
        str = Math.round(str * _dm);
        if (_tr) _tr.push({ label: `realm unit discoveries ${ladderFm(_dm)}` });
      }
    }
  }
  // EVIL TERROR (2026-09-24): a true strength MODIFIER (×(1−x)), set by consumeTerror at battle
  // start. It used to be faked as pre-battle damage; now that damage lands after every modifier it
  // would have shrunk below the advertised −10%/stack, so it is applied here as the multiplier it is.
  if (army._terrorMult != null && army._terrorMult < 1) {
    str = Math.round(str * army._terrorMult);
    if (_tr) _tr.push({ label: `Terror ${ladderFm(army._terrorMult)}` });
  }
  // REIGN OF FEAR (2026-10-13): an Evil realm's Monsters on ground its own Terror still grips (ctx.reignOfFear,
  // read at the call site before the Terror is consumed). 2026-10-12 (Toby): only when they ATTACK there.
  if (
    ctx &&
    ctx.reignOfFear &&
    ctx.isAttacker &&
    playerAlignment === 'Evil' &&
    MONSTER_ARMIES.has(army.type) &&
    !alignProto(turnContext.G, 'Evil') // PROTOTYPE Evil: Savage Fury ×1.5 on the attack replaces Reign of Fear
  ) {
    str = Math.round(str * REIGN_OF_FEAR_MULT);
    if (_tr) _tr.push({ label: `Reign of Fear ${ladderFm(REIGN_OF_FEAR_MULT)}` });
  }
  // PRE-BATTLE DAMAGE (arrows, battle magic, primal strikes, flak). 2026-09-24 (Toby): in a battle
  // the ladder calls armStr with opts.deferDamage and subtracts the damage in ladderRow AFTER every
  // unit and command modifier — modifiers are fixed when the lines form (after the duel, before
  // magic and archery), and damage no longer gets multiplied by the target's Tactical, kinship,
  // terrain, items… Other callers (intel estimates, bot model) keep the old in-line subtraction.
  if (!(opts && opts.deferDamage)) {
    const _preTemp = str;
    str = applyPrebattleDamage(army, str);
    if (_tr && str !== _preTemp) _tr.push({ label: 'pre-battle volleys & spells', delta: str - _preTemp });
  }
  // Phantasmal Armies (Illusory): the commander's directly-led armies gain +10% per caster level.
  if (heroChar && heroChar._phantasmalBonus) {
    str = Math.round(str * (1 + heroChar._phantasmalBonus));
    if (_tr) _tr.push({ label: `Phantasmal Armies ${ladderFm(1 + heroChar._phantasmalBonus)}` });
  }
  // Magic-item army bonuses carried by the leading commander.
  const _preItems = str;
  if (heroChar && heroChar.items && heroChar.items.length) {
    const has = (st) => activeItems(heroChar).some((it) => it.effect && it.effect.stat === st);
    const CAV_I = new Set([
      'Free Lances',
      'Gilded Lances',
      'Warg Riders',
      'Eagle Riders',
      'Noble Griffons',
      'Stag Riders',
      'Ironhoof Rams',
    ]);
    const INF_I = new Set(['Shieldwall Levies', 'Dwarven Guard', 'Orc Berserkers', 'Men-at-Arms']);
    const ARCH_I = new Set(['Yeoman Longbows', 'Elven Bowmen', 'Shadow Archers', 'Ironwood Crossbows', 'Black Arrows']);
    const HEAVY_I = new Set(['Mountain Guns', 'Dwarf Ironclads']);
    const FLEET_I = new Set(KC_UNIT_CLASS.carrier);
    if (has('armyBonus')) str += 2; // Battle Standard
    if (has('cavBonus') && CAV_I.has(army.type)) str = Math.round(str * 1.25); // Golden Spur
    if (has('infBonus') && INF_I.has(army.type)) str = Math.round(str * 1.2); // Legionnaire's Mark
    if (has('archerStr') && ARCH_I.has(army.type)) str = Math.round(str * 1.3); // Eagle-Eye Pendant
    if (has('heavyBonus') && HEAVY_I.has(army.type)) str += 4; // Engineer's Blueprint
    if (has('navalBonus') && FLEET_I.has(army.type)) {
      const _ku = Q_UP[army.quality];
      if (_ku && _ku !== army.quality) str = Math.round((str * UNIT_Q_MULT[_ku]) / UNIT_Q_MULT[army.quality]);
    } // Kraken Figurehead: fleets fight one exp level higher
    if (activeItems(heroChar).some((it) => it.fleetStr) && FLEET_I.has(army.type)) str += 1; // Sea Chart of the Deep: fleets +1 strength
    if (hasItemBase(heroChar, "Admiral's Spyglass") && FLEET_I.has(army.type)) str += 2; // Admiral's Spyglass: fleets +2 strength
    if (hasItemBase(heroChar, 'Chalice of Dawn') && playerAlignment === 'Divine') str = Math.round(str * 1.15); // Chalice of Dawn: a Divine realm's armies +15%
    if (has('undeadBonus') && army._isSkeletal) str += 4; // Black Sceptre
  }
  if (_tr && str !== _preItems) _tr.push({ label: "commander's magic items", delta: str - _preItems });
  // ── UNIT ABILITIES (force composition) ──
  const abilityM = unitAbilityMult(army, ctx, terrain);
  if (abilityM !== 1) {
    str = Math.round(str * abilityM);
    if (_tr) _tr.push({ label: `${army.type} ability ${ladderFm(abilityM)}` });
  }
  // DRUIDIC — Home of the Wild: Creature armies of a Druidic realm fight ×1.5 in forest and
  // jungle (the long-advertised bonus, previously described but never implemented).
  if (
    (playerAlignment === 'Druidic' || (heroChar && heroChar.alignment === 'Druidic')) &&
    (terrain === 'forest' || terrain === 'jungle') &&
    (CREATURE_ARMIES.has(army.type) || (playerAlignment === 'Druidic' && alignProto(turnContext.G, 'Druidic'))) // PROTOTYPE Druidic: every unit of the realm
  ) {
    str = Math.round(str * 1.5);
    if (_tr) _tr.push({ label: 'Home of the Wild ×1.5' });
  }
  // PROTOTYPE Neutral (round 2): Condottieri — a mercenary company hired under the kit fights ×1.3 (round 2: ×1.5)
  if (army._merc && heroChar && protoAlignOf(turnContext.G, heroChar.player) === 'Neutral') {
    // round 10: ×1.75 against a host with a creature or monster company in it (the enemy force, when the caller names it)
    const _vsBeasts =
      ctx &&
      Array.isArray(ctx.enemyForce) &&
      ctx.enemyForce.some((e) => e && (CREATURE_ARMIES.has(e.type) || MONSTER_ARMIES.has(e.type)));
    const _cm = _vsBeasts ? CONDOTTIERI_VS_BEASTS_MULT : CONDOTTIERI_MULT;
    str = Math.round(str * _cm);
    if (_tr) _tr.push({ label: `Condottieri ×${_cm}` });
  }
  // ── LIVE TITLE PERK ── Grand Marshal (land) / Sea Lord (at sea): the title-holder's armies
  // +5%.
  if (heroChar) {
    // Grand Marshal / Sea Lord combat bonuses removed — those titles are now end-of-turn intel
    // lines.
  }
  // (2026-09-23d, Toby: the Druid "creature bond" — +5% per Druid level, to 5, on every Creature /
  // Monster unit led — is RETIRED.)
  // ── DRUID MASTERY (2026-09-24, Toby) ── A Creature or Monster unit fights +20% for every level of
  // Druid its commander holds OVER the minimum needed to lead it (the DRUID_ARMY_LEVELS_P table),
  // counting Druid all the way to 9, capped at +100%. Where the requirement is WAIVED — a Druidic
  // realm's (or personally Druidic commander's) Creatures, or sd40 Dragon Taming's winged beasts —
  // the minimum is 0, so every level counts (still capped at +100%). A neutral guard's native
  // command is NOT a waiver: his minimum stays the table level. Psychic Blast (Druid negated) and
  // Curse (Druid halved) cut it exactly as they cut the shortfall check.
  {
    const _dm = druidMasteryGain(turnContext, heroChar, army, playerAlignment);
    if (_dm.gain > 0) {
      str = Math.round(str * (1 + _dm.gain));
      if (_tr) _tr.push({ label: `Druid mastery ×${(1 + _dm.gain).toFixed(1)}` });
    }
  }
  // ── MINOR TITLE army perks ── Naturalist/Beastmaster: primal +5%; Cavalier: cavalry +5%;
  // Ironclad: heavy & fleet +5%.
  if (heroChar) {
    const _prim = CREATURE_ARMIES.has(army.type) || MONSTER_ARMIES.has(army.type);
    if (_prim && (charMinor(turnContext, heroChar, 'naturalist') || charMinor(turnContext, heroChar, 'beastmaster'))) {
      str = Math.round(str * 1.05);
      if (_tr) _tr.push({ label: 'Naturalist/Beastmaster title ×1.05' });
    }
    if (charMinor(turnContext, heroChar, 'cavalier') && MINOR_CAV.has(army.type)) {
      str = Math.round(str * 1.05);
      if (_tr) _tr.push({ label: 'Cavalier title ×1.05' });
    }
    if (charMinor(turnContext, heroChar, 'ironclad') && MINOR_HEAVY.has(army.type)) {
      str = Math.round(str * 1.05);
      if (_tr) _tr.push({ label: 'Ironclad title ×1.05' });
    }
  }
  // Evil Terror: province was terrorised last turn — defending armies -10%
  // (prov is not available in armStr — terror is applied at the call site via _tempStrReduction)
  return str;
}
// One battle row for the strength ladder: `_u` = the unit's armStr (every per-unit modifier, named
// in `_tr`), `_cmd` = the command-stage multipliers that actually applied to it, `base` = the
// unit's FINAL per-unit strength fed to battleLineTotal. The battle sites build their rows with
// this, so the ladder and the real total are the same numbers. ctx must be a real object (a bare
// {} would switch on ctx-gated unit abilities).
// 2026-09-24 (Toby): BATTLE TIMING — every unit modifier (armStr) and command multiplier is applied
// to the UNDAMAGED unit first; only then is this battle's pre-battle damage (arrows, battle magic,
// primal strikes, flak) subtracted. `_cmdS` = the figure before damage, `_dmg` = what came off.
export function ladderRow(turnContext, a, hero, align, terrain, ctx, cmd) {
  const tr = [];
  const u = ctx
    ? armStr(turnContext, a, hero, align, terrain, Object.assign({}, ctx, { trace: tr }), { deferDamage: true })
    : armStr(turnContext, a, hero, align, terrain, undefined, { deferDamage: true });
  const applied = (cmd || []).filter((c) => c && Math.abs(c.m - 1) > 1e-9);
  let s = u;
  applied.forEach((c) => {
    s *= c.m;
  });
  return { a, base: s, s, fly: FLYING_TYPES.has(a.type), _u: u, _tr: tr, _cmd: applied, _cmdS: s, _dmg: 0 };
}
// 2026-09-24 (Toby): the WHOLE-FORCE multipliers (fanaticism, discoveries, morale, the defender's
// position, home ground, orders, sanctuary, consecration) also land before any damage. Each unit's
// undamaged figure (_cmdS) is multiplied by the side's force product F, THEN this battle's pre-battle
// damage comes off (floored at 25% of that figure), THEN the battle lines weight the units. Returns
// the side's final strength; the rows keep every stage for the ladder.
// opts (2026-10-11): {terrain, tac, enemy, enemyTac, out} — the grid is built here, on the finished
// figures, and handed back through opts.out.grid for the report and the ladder.
export function finishSide(rows, width, flank, forceMods, opts) {
  const F = (forceMods || []).reduce((p, x) => p * (x && isFinite(x.m) ? x.m : 1), 1);
  rows.forEach((r) => {
    const pre = r._cmdS * F,
      post = applyPrebattleDamage(r.a, pre);
    r._F = F;
    r._fPre = pre;
    r._fPost = post;
    r._dmg = pre - post;
    r.base = post;
    r.s = post;
  });
  opts = opts || {};
  const g = battleGrid(rows, width, opts.terrain || null, {
    flank,
    tac: opts.tac,
    enemy: opts.enemy,
    enemyTac: opts.enemyTac,
  });
  if (opts.out) opts.out.grid = g;
  return g.total;
}

// REIGN OF FEAR (2026-10-13, Toby, Creatures and Monsters I): an Evil realm's Monsters fight ×1.5 in a
// province still gripped by that realm's own Terror — the mirror of the Druids' Home of the Wild, on ground
// Evil makes its own by winning. 2026-10-12 (Toby): only when they ATTACK there, never when defending it. Read at battle start, BEFORE consumeTerror
// clears the stacks (reignOfFearHere), and applied in armStr through ctx.reignOfFear.
export const REIGN_OF_FEAR_MULT = 1.5;
