// The unit abilities at the stage "strength: the whole force" (plan P1-19a): each returns the unit's factor from its
// force and the battle's facts, with its numbers from the content's row; the runner (the-registry-of-content-effects.ts)
// multiplies them, in the stage's order, inside armStr (through unitAbilityMult). Until P1-19a they were written inline
// in unitAbilityMult (src/engine/battle/strength.ts), in this order. And, before them in armStr, the stage "strength: a
// land unit at sea" (plan P1-19g): whether the unit's force waives the sea's penalty (until P1-19g inline in armStr).
//
// 2026-10-11 (Toby, the unit abilities): Shieldwall now lives in the line (battleFaceSide: Levies with an archer behind
// them), and the Gilded Lances' Shock of the Charge (+40% attacking) is retired; their abilities are Lance Charge and
// Knightly Example. The Berserkers' old ratio bonus went with the roster PR; theirs are Frenzy and Driven Before Them
// (battleFaceSide).
//
// ── PRIMAL ARMY SIGNATURE ABILITIES ── Each primal beast carries one always-on battle ability, hooked into the enemy's
// composition or attack/defend posture: the army-battle counterpart of a monster's special. Pre-battle strikes live on
// the units' `spells` and resolve separately in the pre-battle magic phase. 2026-10-13 (Toby, Creatures and Monsters I):
// terrain is written ONCE, in TERRAIN_MODS. The multipliers that doubled a terrain row are gone (Mountain Bulwark (Stone
// Giants), Rooted Grove (Forest Ents), Regenerating Hide's ×1.2/×1.3 (Cave Trolls)), and so is the Titans' always-on
// ×1.3 (Colossal Bulk's place in the line comes with the beast abilities, as the humanoid units' did).
import { KC_UNIT_CLASS } from '../../../content/kingdoms-call-data.ts';
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS as ROWS } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { UnitAbilitySlug } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { AUnitInItsForce, TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheWholeForceEffect = TheStagesOfEachHookPoint['strength']['the whole force'];

// The ranged units (the data file's class: MISSILE_ARMIES_MASTER's), which Sea Archers reaches.
const RANGED_UNITS = new Set<string>(KC_UNIT_CLASS.missile);

// A land unit at sea (each runs for every land unit at sea). ELF — Sea Archers: the ranged units of a force with Elven
// Galleys shoot from steady decks and do not suffer the usual land-unit penalty at sea.
export const A_LAND_UNIT_AT_SEA = {
  'sea-archers': (facts) =>
    facts.itsForce.some((a) => a?.type === ROWS['sea-archers'].unit) && RANGED_UNITS.has(facts.unitType),
} satisfies Partial<Record<UnitAbilitySlug, TheStagesOfEachHookPoint['strength']['a land unit at sea']>>;

/** How many other units of its force are of the types given: the units of those types, less the one it is. */
function othersInItsForce(facts: AUnitInItsForce, types: ReadonlySet<string>): number {
  return Math.max(0, facts.itsForce.filter((a) => a && types.has(a.type)).length - 1);
}

// The orc foot that count for Sheer Numbers, and the shoals for Shoal Swarm.
const ORC_FOOT = new Set<string>(ROWS['sheer-numbers'].counts);
const SHOALS = new Set<string>(ROWS['shoal-swarm'].counts);

export const THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE = {
  // ORC — Sheer Numbers: goblins are worth little alone and a great deal in a mob — +10% per other orc foot unit in
  // the force (Goblin Hordes, Berserkers, the Orc Garrison), to +30%.
  'sheer-numbers': (facts) => {
    const { perOtherOrcFootUnit, atMost } = ROWS['sheer-numbers'].numbers;
    return 1 + Math.min(atMost.value, othersInItsForce(facts, ORC_FOOT) * perOtherOrcFootUnit.value);
  },
  // ORC — Reaver Crews: troops put ashore by longships hit the beach at a run (every unit of the force).
  'reaver-crews': (facts) =>
    facts.landedFromLongshipsThisPhase ? 1 + ROWS['reaver-crews'].numbers.theForceTheyLand.value : 1,
  // PRIMAL — Shoal Swarm (2026-10-13, the beast abilities): sharks are worthless alone and deadly in numbers — +10% per
  // other Shark Shoals in the force, to +30% (as the goblins' Sheer Numbers).
  'shoal-swarm': (facts) => {
    const { perOtherShoal, atMost } = ROWS['shoal-swarm'].numbers;
    return 1 + Math.min(atMost.value, othersInItsForce(facts, SHOALS) * perOtherShoal.value);
  },
  // Druid 4 —
  'relentless-hunt': (facts) => (facts.itsSideAttacks ? ROWS['relentless-hunt'].numbers.attacking.value : 1),
  'stone-deterrent': (facts) => (!facts.itsSideAttacks ? ROWS['stone-deterrent'].numbers.defending.value : 1),
  'tidal-might': (facts) =>
    facts.ground !== 'sea' && facts.coastal ? ROWS['tidal-might'].numbers.inACoastalLandProvince.value : 1,
  'deepwater-grasp': (facts) => (facts.ground === 'sea' ? ROWS['deepwater-grasp'].numbers.atSea.value : 1),
  // Druid 5 —
  wyrmscale: () => ROWS.wyrmscale.numbers.inEveryBattle.value, // unconditional
  'air-superiority': (facts) =>
    facts.theEnemyFieldsRangedUnits ? ROWS['air-superiority'].numbers.whenTheEnemyFieldsRangedUnits.value : 1,
} satisfies Partial<Record<UnitAbilitySlug, TheWholeForceEffect>>;
