// ── The engine's rules the player portal shares (plan P1-11a4; beasts and Druid, P1-11b3; the sea lift, P1-11b4; the
// order form's spells, P1-11c2; the mark check, P1-11c4) ────
// The player portal's one door to the engine (plan P1-11a, Decision 2): the rules of a hero, an army, an item, a level
// or a number that the order form and the report screens use, re-exported from src/engine/rules-on-plain-values/ and
// from nowhere else. That folder imports only src/content and itself, so the player page loads no other engine file
// and runs none of the engine's set-up. The portal calls them by the engine's names (Decision 3); each name here is
// one the portal uses (the order form's spell tables since P1-11c3, its target field's mark check since P1-11c4).
// tests/static/the-player-portal-reaches-the-engine-only-through-src-shared.test.ts checks this file and the portal's
// own files.
export { gameMetaOf } from '../engine/rules-on-plain-values/a-games-settings-read-from-its-row.ts';
export { dispFloor } from '../engine/rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
export {
  alignDistP,
  heroHireWage,
} from '../engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
export {
  TAMED_FLYER_TYPES_D,
  countsAgainstBeastCommand,
  druidALeaderBringsToAUnit,
  druidLevelALeaderNeeds,
  druidLevelTheMasteryCounts,
  druidMasteryGainOver,
  druidShortfall,
  getDruidLevel,
  strengthLeftByADruidShortfall,
} from '../engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
export {
  isLegendaryItem,
  itemRaceOf,
  itemSlot,
  itemUsableBy,
} from '../engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
export {
  seaLiftOfAColumn,
  takesHalfAHullAboard,
} from '../engine/rules-on-plain-values/ships-and-flyers-that-carry-a-column-across-the-sea.ts';
export {
  ALL_SKILLS,
  skillFameLabelM,
  topSkillOf,
} from '../engine/rules-on-plain-values/skills-in-order-and-a-heros-fame-in-words.ts';
export {
  actionSpellsAllowedPerSchoolEachTurn,
  combatSpellsAllowedPerSchoolEachFight,
} from '../engine/rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
export {
  everySpellBySchool,
  theActionSpells,
  theActionSpellsAimedAtAHero,
  theActionSpellsAimedAtAProvince,
  theActionSpellsNoMasteryLevelGates,
  theCombatSpellsBySchool,
  theLevelEachMasterySpellNeeds,
  theSchoolOfEachSpell,
} from '../engine/rules-on-plain-values/spells-the-order-form-offers-each-school-aim-and-mastery-level.ts';
export { theMarkOfThisSpellMustStandInTheCastersProvince } from '../engine/rules-on-plain-values/whether-a-spells-mark-must-stand-in-the-casters-province.ts';
export { unitBaseStrength, unitTypeOf } from '../engine/rules-on-plain-values/unit-types-and-base-strength.ts';
