// The strength a host carried over the sea by its flyers keeps, read by both battle paths (the battle against a
// province's defenders' lines, the-battle-against-the-defenders/n8-to-n10-…, and the battle between heroes' archery,
// the-battle-between-heroes/h4-both-sides-archery-flak-and-breach.ts), moved here as it was from combatVsNPC's file (B-06bc) once a stage file read it:
// combatVsNPC's file imports its stages, so a stage can't import it back. It draws no die; this file holds no stage's
// anchor (tools/proof/README.md, section 8).
import { KC_THE_STRENGTH_A_UNIT_KEEPS_AFTER_THE_PRE_BATTLE_DAMAGE_AT_SEA_AND_UNDER_ILLUSORY_TERRAIN } from '../../content/kingdoms-call-data.ts';

// a force at sea is AIRBORNE when it contains at least one land unit
// (neither flying nor naval) and NO naval unit at all — the land units can only be there because the
// flyers carried them. Carried land units then fight at ×0.25 and the carrying humanoid flyers at
// ×0.5
// (applied in armStr). Module-level so both battle paths and the narrative lines can share it. Content's row
// (B-06ay2).
export const SEA_AIRBORNE_LAND_PENALTY =
    KC_THE_STRENGTH_A_UNIT_KEEPS_AFTER_THE_PRE_BATTLE_DAMAGE_AT_SEA_AND_UNDER_ILLUSORY_TERRAIN.aLandUnitCarriedAtSeaByFlyers,
  SEA_AIRBORNE_FLYER_PENALTY =
    KC_THE_STRENGTH_A_UNIT_KEEPS_AFTER_THE_PRE_BATTLE_DAMAGE_AT_SEA_AND_UNDER_ILLUSORY_TERRAIN.aHumanoidFlyerCarryingThem;
