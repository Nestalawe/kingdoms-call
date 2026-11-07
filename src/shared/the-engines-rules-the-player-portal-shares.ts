// ── The engine's rules the player portal shares (plan P1-11a4; beasts and Druid, P1-11b3; the sea lift, P1-11b4; the
// order form's spells, P1-11c2; the mark check, P1-11c4; kin and feud, P1-11c5; the Warlock's extra cast, P1-23s; the
// Grand Cathedral's free Bless, P1-23ad; the hex step, P1-11d5 and d6; the alignment orders, P1-11d7; the beasts' two
// sets and the Druid mastery's guard, P1-11d12; the Explore gain, P1-11d14; what a march's order names,
// P1-11e9; where a column may step, P1-11e10; the pool a step spends, P1-11e11; the step toward a far province,
// P1-11e12; the items a Send Item hands over, P1-11e18; the companies a Recruit, a hand-over and a Pick Up move,
// P1-11e19; the order a season's heroes act in, P1-11e20) ────
// The player portal's one door to the engine (plan P1-11a, Decision 2): the rules of a hero, an army, an item, a level
// or a number that the order form and the report screens use, re-exported from src/engine/rules-on-plain-values/ and
// from nowhere else. That folder imports only src/content and itself, so the player page loads no other engine file
// and runs none of the engine's set-up. The portal calls them by the engine's names (Decision 3); each name here is
// one the portal uses (the order form's spell tables since P1-11c3, its target field's mark check since P1-11c4, the
// army card's kin and feud since P1-11c5, the hex step since P1-11d6: the order form's three hex tables call it; the
// alignment orders' names and the two checks of who may give one since P1-11d7: the order list reads them; the Creature
// and Monster sets and the units the Druid mastery lifts since P1-11d12: the army card and the unit labels read them; the
// share of a province an Explore order maps since P1-11d14: the Explore forecast asks it; what a march's order names since
// P1-11e9: the march forecast reads a Move's and a Forced March's target by it; where a column may step since P1-11e10:
// the march forecast asks whether the turn refuses a march; the pool a step spends since P1-11e11: the march forecast
// spends his pace by it; the step toward a far province since P1-11e12: the march forecast takes it as the turn does;
// the items a Send Item hands over since P1-11e18: the forecasts' replay hands them over, the Send Item field greys the
// Mithril suit; the companies a Recruit, a hand-over and a Pick Up move since P1-11e19: the forecasts' replay musters,
// hands over and takes them up by them, the beast command's room, the risen dead and the garrison's places; the order a
// season's heroes act in since P1-11e20: the forecasts' replay hands over a season's items in it, with the kind of
// order each name reads as; the company a Call to Arms musters since P1-11e26: its choice names it).
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
  theDruidMasteryLiftsAUnitOfThisType,
  aMercenaryBandIsNotHiredIntoAFullColumn,
  theRoomALeadersBeastCommandLeaves,
  whereARecruitedCompanyMusters,
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
  actionSpellsAHeroMayCastInASchoolEachTurn,
  combatSpellsAllowedPerSchoolEachFight,
  theSpellCostsItsCasterNoCastingSlot,
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
export {
  aHeroMayGiveTheAlignmentOrderAsKingOrNot,
  aRealmOfThisCreedMayGiveTheAlignmentOrder,
  theAlignmentOrdersByTheNameTheFormWrites,
  theNameTheFormWritesOfTheAlignmentOrder,
} from '../engine/rules-on-plain-values/the-alignment-orders-the-names-the-form-writes-and-who-may-give-each.ts';
export {
  theCompanyACallToArmsMusters,
  whyAKingMayNotConsecrateAProvince,
} from '../engine/rules-on-plain-values/the-company-a-call-to-arms-musters-a-blood-offerings-companies-and-a-consecrations-checks.ts';
export {
  aProvinceIsSafePassageForARealmsColumn,
  theFirstStepOfAShortestRouteAColumnMayTake,
  theStepAColumnTakesTowardAFarProvince,
} from '../engine/rules-on-plain-values/the-first-step-of-a-shortest-route-a-column-may-take.ts';
export {
  anItemIsTheMithrilSuitGrantedToItsWearer,
  theCompaniesALeaderTakesUpToHisBeastCommandsRoom,
  theGarrisonPlacesAPickUpTakes,
  theItemsASendItemOrderHandsOver,
  theRisenDeadFollowAHandOverTo,
  whereAHandOversRisenDeadGo,
} from '../engine/rules-on-plain-values/the-items-a-send-item-hands-over-and-the-companies-a-hand-over-or-a-pick-up-moves.ts';
export { normaliseAction } from '../engine/rules-on-plain-values/the-kind-of-order-each-name-of-an-order-reads-as.ts';
export {
  theHeroesWhoMustActFirstInAPhase,
  theOrderTheHeroesActInAPhase,
} from '../engine/rules-on-plain-values/the-order-the-heroes-act-in-a-phase-and-who-must-act-first.ts';
export { theMovePoolAStepSpends } from '../engine/rules-on-plain-values/the-move-pools-a-column-marches-and-sails-by-and-the-pool-a-step-spends.ts';
export { theHexNextToAProvinceInADirection } from '../engine/rules-on-plain-values/the-hexes-next-to-a-province-on-a-map-that-wraps-east-to-west.ts';
export { theShareOfAProvinceAnExploreOrderMaps } from '../engine/rules-on-plain-values/the-share-of-a-province-an-explore-order-maps.ts';
export {
  aProvinceBesideTheSeaIsACoastAVoyageCharts,
  theShareAVoyageChartsOfEachCoastBesideTheSea,
  theShareOfAProvinceAMarchIntoItMaps,
} from '../engine/rules-on-plain-values/the-share-a-march-into-a-province-maps-and-the-coast-a-voyage-charts.ts';
export { theStrengthAUnitsKinAndARivalKinsLeaderLeaveIt } from '../engine/rules-on-plain-values/the-strength-a-units-kin-and-a-rival-kins-leader-leave-it.ts';
export { theMarkOfThisSpellMustStandInTheCastersProvince } from '../engine/rules-on-plain-values/whether-a-spells-mark-must-stand-in-the-casters-province.ts';
export { unitBaseStrength, unitTypeOf } from '../engine/rules-on-plain-values/unit-types-and-base-strength.ts';
export { whatAMarchsOrderNames } from '../engine/rules-on-plain-values/what-a-marchs-order-names.ts';
export {
  aColumnIsTurnedBackAtANeutralRealmsBorder,
  aColumnLeadingShipsMayNotStepFromLandToLand,
  canEnterTerrain,
} from '../engine/rules-on-plain-values/where-a-column-may-step-the-ground-a-neutral-realms-border-and-ships-over-land.ts';
export {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
