// ── The chance a practice alone raises a skill, and the price and wage a Druid or the Host-Leader cuts (plan P1-11e23) ──
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). Moved as they were, so the order form's practice note and gold ledger can later ask the turn's
// own: the chance a Practice Skill order raises a skill when he practises alone (src/engine/orders/research-and-
// practice-orders-…ts; the report's table of chances reads its levels); a Druid 6 recruiter's half price for a beast
// (src/engine/orders/recruit-and-hire-orders-…ts); and the wages Early Winter charges after each cut that reads no
// registry (src/engine/turn/early-winter-…ts, and the report's forecast of them in src/views/turn-report.ts): the
// companies that draw none, a beast's half wage under a Druid 6 leader or a Druidic Wonder, and the Host-Leader's 1g a
// company he leads. The upkeep discoveries' cut reads the discoveries' registry, so it stays engine side
// (discUpkeepWage). Since B-06d the Druid's and the Host-Leader's numbers are their rows in the economy's rules
// (src/content/the-economys-rules-their-keys-names-and-numbers.ts), and Early Winter and the forecast ask these through
// the economy's registry; the order form's ledger and the army card ask them here.
import { THE_ECONOMYS_RULES } from '../../content/the-economys-rules-their-keys-names-and-numbers.ts';
import { RACE_GIFTS } from '../../content/the-race-gifts-their-keys-races-and-numbers.ts';
import { CREATURE_ARMIES, MONSTER_ARMIES } from './units-that-fly-sail-or-can-be-carried-through-the-air.ts';

/** The Druid's half and the Host-Leader's cut: their numbers, from their rows in the economy's rules (B-06d). */
const THE_DRUIDS_HALF = THE_ECONOMYS_RULES['a-druid-halves-a-beasts-price-and-wage'].theNumbers;
const THE_HOST_LEADERS_CUT = THE_ECONOMYS_RULES['the-host-leaders-cut-of-his-companies-wages'].theNumbers;

/** The chance, in percent, a practice alone raises a skill from each level below mastery: 25% at level 0 down to 5%
 *  at level 4 (the report's table of chances shows these). */
export const THE_PERCENT_CHANCE_A_PRACTICE_ALONE_RAISES_A_SKILL_FROM_EACH_LEVEL: readonly number[] = [
  25, 20, 15, 10, 5,
];

/** Whether a skill at this level is past what practice can raise (level 5 or more): no roll is made. */
export function aSkillAtThisLevelIsPractisedNoFurther(theLevelHeHolds: number): boolean {
  return theLevelHeHolds >= 5;
}

/** The base chance (0 to 1) a practice alone raises a skill from the level he holds at the phase's start (a level of
 *  4 or more reads level 4's). */
export function theBaseChanceAPracticeAloneRaisesASkill(theLevelHeHolds: number): number {
  return Number(THE_PERCENT_CHANCE_A_PRACTICE_ALONE_RAISES_A_SKILL_FROM_EACH_LEVEL[Math.min(theLevelHeHolds, 4)]) / 100;
}

/** Perseverance: each practice he failed this turn multiplies his next practice's chance by 1.2. */
export function thePerseveranceOfAHeroWhoFailedPracticesThisTurn(thePracticesHeFailedThisTurn: number): number {
  return Math.pow(1.2, thePracticesHeFailedThisTurn);
}

/** Quick learners: a Human of a Human realm practises at ×1.5 (its row of the race gifts, B-06af). */
export function theShareAQuickLearnerPractisesAt(isHeAHumanOfAHumanRealm: boolean): number {
  return isHeAHumanOfAHumanRealm ? RACE_GIFTS['quick-learners'].theLearning : 1;
}

/** Whether a hero is a quick learner: he and his realm are both of Quick learners' race (its row of the race gifts).
 *  The order form's practice note asks it (B-06ak); the turn asks the race gifts' runner
 *  (doesAGiftOfHisRealmsRaceQuickenAHerosLearning, src/engine/rules/the-registry-of-the-race-gifts.ts), which reads
 *  the same row, and a unit test holds the two to the same answer over every pair of races. */
export function isAHeroAQuickLearnerByHisRaceAndHisRealms(
  theHerosRace: string | null | undefined,
  theRealmsRace: string | null | undefined,
): boolean {
  const theGift = RACE_GIFTS['quick-learners'];
  return theHerosRace === theGift.race && theRealmsRace === theGift.race;
}

/** The chance (0 to 1) a hero practising alone raises his skill: the base by the level he holds, plus what his realm's
 *  discoveries add, times his perseverance and his quick learners' share. Peers and a mentor work on top of it. */
export function theChanceAHeroPractisingAloneRaisesHisSkill(
  theLevelHeHolds: number,
  whatHisRealmsDiscoveriesAdd: number,
  thePracticesHeFailedThisTurn: number,
  isHeAHumanOfAHumanRealm: boolean,
): number {
  return (
    (theBaseChanceAPracticeAloneRaisesASkill(theLevelHeHolds) + whatHisRealmsDiscoveriesAdd) *
    thePerseveranceOfAHeroWhoFailedPracticesThisTurn(thePracticesHeFailedThisTurn) *
    theShareAQuickLearnerPractisesAt(isHeAHumanOfAHumanRealm)
  );
}

/** Whether a company of this type is a beast whose price and wage a Druid halves (a creature or a monster). */
export function aCompanyIsABeastADruidHalves(theType: string): boolean {
  return CREATURE_ARMIES.has(theType) || MONSTER_ARMIES.has(theType);
}

/** The price a Druid 6 recruiter pays for a beast: half (his row's share), rounded down. */
export function thePriceADruidPaysForABeast(thePrice: number): number {
  return Math.floor(thePrice * THE_DRUIDS_HALF.theShareOfThePriceAndTheWage);
}

/** Whether a leader's beasts pay half wages: he holds Druid 6, or his realm has built the Druidic Wonder (asked only
 *  when he doesn't, as the turn asks it). */
export function aLeadersBeastsPayHalfWages(
  heHoldsDruidSix: boolean,
  hisRealmHasBuiltTheDruidicWonder: () => boolean,
): boolean {
  return heHoldsDruidSix || hisRealmHasBuiltTheDruidicWonder();
}

/** The wage a beast pays under a Druid: half (his row's share), rounded down, at least his row's least wage (1g). */
export function theWageABeastPaysUnderADruid(theWage: number): number {
  return Math.max(THE_DRUIDS_HALF.theLeastWage, Math.floor(theWage * THE_DRUIDS_HALF.theShareOfThePriceAndTheWage));
}

/** A company as the wages read it: one borrowed for a while (summoned), and a Wild Hunt beast's last turn. */
export interface ACompanyAsTheWagesReadIt {
  readonly _temporary?: unknown;
  readonly _wildHuntUntilTurn?: number | null | undefined;
}

/** Whether a company draws no wage: one borrowed for a while (a summoned elemental) or a Wild Hunt beast. */
export function aCompanyDrawsNoWage(theCompany: ACompanyAsTheWagesReadIt): boolean {
  return Boolean(theCompany._temporary) || theCompany._wildHuntUntilTurn != null;
}

/** The companies the Host-Leader saves 1g on: those he leads that draw a wage. */
export function theCompaniesTheHostLeaderSavesOn(theCompaniesHeLeads: readonly ACompanyAsTheWagesReadIt[]): number {
  return theCompaniesHeLeads.filter((a) => !aCompanyDrawsNoWage(a)).length;
}

/** The Host-Leader's cut of a realm's company wages: his row's 1g a company he saves on, the wages never below 0. */
export interface TheHostLeadersCut {
  readonly theGoldSaved: number;
  readonly theWagesLeft: number;
}
/** The Host-Leader's cut: the gold saved (his row's gold on each company, no more than the wages) and the wages
 *  left. */
export function theHostLeadersCut(theCompanyWages: number, theCompaniesHeSavesOn: number): TheHostLeadersCut {
  const theGoldHeCuts = theCompaniesHeSavesOn * THE_HOST_LEADERS_CUT.theGoldOnEachCompany;
  return {
    theGoldSaved: Math.min(theCompanyWages, theGoldHeCuts),
    theWagesLeft: Math.max(0, theCompanyWages - theGoldHeCuts),
  };
}
