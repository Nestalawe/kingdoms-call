// The death chances a battle carried on round after round scales by, read by both battle paths (the battle against a
// province's defenders' casualties, the-battle-against-the-defenders/n11-to-n13-…, and combatVsChar in
// battle/battles-between-heroes.ts), moved here as they were from combatVsNPC's file (B-06bd) once a stage file read
// them: combatVsNPC's file imports its stages, so a stage can't import it back. It draws no die; this file holds no
// stage's anchor (tools/proof/README.md, section 8).
import { KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS } from '../../content/kingdoms-call-data.ts';

// a battle that carries on round after round in the same province grows deadlier for BOTH sides.
// prov._carryOnRounds counts the carry-ons (0 for the opening clash); death chances scale by 1 +
// CARRYON_DEATH_STEP per round, capped at CARRYON_DEATH_CAP×: content's row
// (KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS, B-06ay1).
export const CARRYON_DEATH_STEP = KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS.theStepEachCarriedOverRoundAdds,
  CARRYON_DEATH_CAP = KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS.theMostTimesTheyScaleTo;
