// The race gifts on heroes and companies (B-06, T7, the rules pulled out: the races' family, row B-06af): Quick
// learners ("experience: a race's gift quickens a hero's learning", trySkillGain and a practice), Drillmasters
// ("experience: a race's gift quickens a company's drill", humanXPMult), Iron constitution ("aHerosStanding: a race's
// gift sets a hero's hit points", hpStartOf and hpGainBand), Mithril Armour ("aHerosStanding: a race's gift suits a
// hero of its realm in mithril", mithrilQualifies and a hire's grant) and Homeward Flight ("fate: a race's gift gives a
// fallen company its chance to flee home", recordBattleGraves). Each reads its race and numbers from its row
// (src/content/the-race-gifts-their-keys-races-and-numbers.ts); the runners (the-registry-of-the-race-gifts.ts) ask
// only the gifts the realm's race holds. None draws a die.
import { RACE_GIFTS, type RaceGiftSlug } from '../../../content/the-race-gifts-their-keys-races-and-numbers.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheExperiencesStages = TheStagesOfEachHookPoint['experience'];
type TheStandingsStages = TheStagesOfEachHookPoint['aHerosStanding'];
type TheFatesStages = TheStagesOfEachHookPoint['fate'];

/** "experience: a race's gift quickens a hero's learning": a hero of the gift's race, at its row's factor. */
export const A_RACES_GIFT_QUICKENS_A_HEROS_LEARNING = {
  'quick-learners': (facts) => {
    const row = RACE_GIFTS['quick-learners'];
    return facts.theHerosRace === row.race ? row.theLearning : null;
  },
} satisfies Partial<Record<RaceGiftSlug, TheExperiencesStages["a race's gift quickens a hero's learning"]>>;

/** "experience: a race's gift quickens a company's drill": a company of the gift's race, at its row's factor. */
export const A_RACES_GIFT_QUICKENS_A_COMPANYS_DRILL = {
  drillmasters: (facts) => {
    const row = RACE_GIFTS.drillmasters;
    return facts.theCompanysRace === row.race ? row.theDrill : null;
  },
} satisfies Partial<Record<RaceGiftSlug, TheExperiencesStages["a race's gift quickens a company's drill"]>>;

/** "aHerosStanding: a race's gift sets a hero's hit points": a hero of the gift's race, his row's start and shift. */
export const A_RACES_GIFT_SETS_A_HEROS_HIT_POINTS = {
  'iron-constitution': (facts) => {
    const row = RACE_GIFTS['iron-constitution'];
    return facts.theHerosRace === row.race
      ? {
          theHitPointsAtTheStart: row.theHitPointsAtTheStart,
          theShiftOfTheHardeningsBands: row.theShiftOfTheHardeningsBands,
        }
      : null;
  },
} satisfies Partial<Record<RaceGiftSlug, TheStandingsStages["a race's gift sets a hero's hit points"]>>;

/** "aHerosStanding: a race's gift suits a hero of its realm in mithril": a hero of the gift's race. */
export const A_RACES_GIFT_SUITS_A_HERO_OF_ITS_REALM_IN_MITHRIL = {
  'mithril-armour': (facts) => facts.theHerosRace === RACE_GIFTS['mithril-armour'].race,
} satisfies Partial<Record<RaceGiftSlug, TheStandingsStages["a race's gift suits a hero of its realm in mithril"]>>;

/** "fate: a race's gift gives a fallen company its chance to flee home": a company of the gift's race, at its row's
 *  percent for the ground it fell on (the first entry that names the ground), or elsewhere's. */
export const A_RACES_GIFT_GIVES_A_FALLEN_COMPANY_ITS_CHANCE_TO_FLEE_HOME = {
  'homeward-flight': (facts) => {
    const row = RACE_GIFTS['homeward-flight'];
    if (facts.theCompanysRace !== row.race) return null;
    const { theTerrain } = facts;
    // (the rows' lists, read as names: their `as const` literals can't be asked for any string)
    const theEntry = row.theFlightHome.onTheGround.find(({ theGround }) => {
      const theNames: readonly string[] = theGround;
      return theTerrain != null && theNames.includes(theTerrain);
    });
    return theEntry?.thePercent ?? row.theFlightHome.thePercentElsewhere;
  },
} satisfies Partial<
  Record<RaceGiftSlug, TheFatesStages["a race's gift gives a fallen company its chance to flee home"]>
>;
