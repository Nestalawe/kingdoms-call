// The rule registry of the race gifts (B-06, T7, the rules pulled out: the races' family, from row B-06ae). A gift is
// one row in src/content/ (its name, its race and what the turn reads for it: the-race-gifts-their-keys-races-and-
// numbers.ts) and one entry here, keyed by the same slug, naming its effect at each stage of a hook point. The hook
// points and their stages are the content effects' (one union, in the-registry-of-content-effects.ts); each stage's
// order is THE_ORDER_OF_EACH_STAGE_OF_THE_RACE_GIFTS. A runner is handed the race of the realm the rule reads (the
// company's realm, the winner's, the stamped company's, the hero's) and asks, in the stage's order, the effects of the
// gifts that race holds; each effect checks the rest (its company's, its hero's or its province's race, its ground, its
// side). No effect draws a die. How to add one: docs/architecture/the-race-gifts-registry-its-stages-and-how-to-add-a-gift.md.
import {
  RACE_GIFTS,
  type ARaceGift,
  type RaceGiftSlug,
} from '../../content/the-race-gifts-their-keys-races-and-numbers.ts';
import {
  A_RACES_GIFT_FLAGS_A_PROVINCE_ITS_REALM_WINS_A_BATTLE_IN,
  A_RACES_GIFT_GIVES_A_COMPANY_THE_SPOILS_OF_A_BATTLE_WON_ATTACKING,
  A_RACES_GIFT_STRENGTHENS_A_COMPANY_OF_ITS_REALM,
} from './race-gifts/the-race-gifts-in-a-battle.ts';
import {
  A_RACES_GIFT_GIVES_A_FALLEN_COMPANY_ITS_CHANCE_TO_FLEE_HOME,
  A_RACES_GIFT_QUICKENS_A_COMPANYS_DRILL,
  A_RACES_GIFT_QUICKENS_A_HEROS_LEARNING,
  A_RACES_GIFT_SETS_A_HEROS_HIT_POINTS,
  A_RACES_GIFT_SUITS_A_HERO_OF_ITS_REALM_IN_MITHRIL,
} from './race-gifts/the-race-gifts-on-heroes-and-companies.ts';
import type {
  ACompanyAsARaceGiftWeighsItsDrill,
  ACompanyAsARaceGiftWeighsItsSpoils,
  ACompanyAsItsRealmsRaceGiftWeighsIt,
  AFallenCompanyAsARaceGiftWeighsItsFlight,
  AHeroAsARaceGiftWeighsHim,
  AProvinceAsARaceGiftWeighsAWinInIt,
  HookPointName,
  TheHitPointsARaceGiftGivesAHero,
  TheStagesOfEachHookPoint,
} from './the-registry-of-content-effects.ts';

/** An entry: the gift's effect at each stage it acts in. */
export type RaceGiftEntry = { readonly [H in HookPointName]?: Partial<TheStagesOfEachHookPoint[H]> };

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). */
export const THE_REGISTRY_OF_THE_RACE_GIFTS = {
  'woodland-mastery': {
    strength: {
      "a race's gift strengthens a company of its realm":
        A_RACES_GIFT_STRENGTHENS_A_COMPANY_OF_ITS_REALM['woodland-mastery'],
    },
  },
  bulwark: {
    strength: {
      "a race's gift strengthens a company of its realm": A_RACES_GIFT_STRENGTHENS_A_COMPANY_OF_ITS_REALM.bulwark,
    },
  },
  'raiders-muster': {
    fate: {
      "a race's gift flags a province its realm wins a battle in":
        A_RACES_GIFT_FLAGS_A_PROVINCE_ITS_REALM_WINS_A_BATTLE_IN['raiders-muster'],
    },
  },
  'war-spoils': {
    fate: {
      "a race's gift gives a company the spoils of a battle won attacking":
        A_RACES_GIFT_GIVES_A_COMPANY_THE_SPOILS_OF_A_BATTLE_WON_ATTACKING['war-spoils'],
    },
  },
  'quick-learners': {
    experience: {
      "a race's gift quickens a hero's learning": A_RACES_GIFT_QUICKENS_A_HEROS_LEARNING['quick-learners'],
    },
  },
  drillmasters: {
    experience: {
      "a race's gift quickens a company's drill": A_RACES_GIFT_QUICKENS_A_COMPANYS_DRILL.drillmasters,
    },
  },
  'iron-constitution': {
    aHerosStanding: {
      "a race's gift sets a hero's hit points": A_RACES_GIFT_SETS_A_HEROS_HIT_POINTS['iron-constitution'],
    },
  },
  'mithril-armour': {
    aHerosStanding: {
      "a race's gift suits a hero of its realm in mithril":
        A_RACES_GIFT_SUITS_A_HERO_OF_ITS_REALM_IN_MITHRIL['mithril-armour'],
    },
  },
  'homeward-flight': {
    fate: {
      "a race's gift gives a fallen company its chance to flee home":
        A_RACES_GIFT_GIVES_A_FALLEN_COMPANY_ITS_CHANCE_TO_FLEE_HOME['homeward-flight'],
    },
  },
} satisfies Record<RaceGiftSlug, RaceGiftEntry>;

/** Each stage's order: the entries with an effect at the stage, each once; the runner asks them in this order. */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_RACE_GIFTS = {
  strength: {
    // as armStr applied them: Woodland Mastery's step, then the Bulwark's
    "a race's gift strengthens a company of its realm": ['woodland-mastery', 'bulwark'],
  },
  fate: {
    "a race's gift flags a province its realm wins a battle in": ['raiders-muster'],
    "a race's gift gives a company the spoils of a battle won attacking": ['war-spoils'],
    "a race's gift gives a fallen company its chance to flee home": ['homeward-flight'],
  },
  experience: {
    "a race's gift quickens a hero's learning": ['quick-learners'],
    "a race's gift quickens a company's drill": ['drillmasters'],
  },
  aHerosStanding: {
    "a race's gift sets a hero's hit points": ['iron-constitution'],
    "a race's gift suits a hero of its realm in mithril": ['mithril-armour'],
  },
} as const satisfies {
  readonly [H in HookPointName]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly RaceGiftSlug[];
  };
};

const ROWS: Readonly<Record<RaceGiftSlug, ARaceGift>> = RACE_GIFTS;
const ENTRIES: Readonly<Record<RaceGiftSlug, RaceGiftEntry>> = THE_REGISTRY_OF_THE_RACE_GIFTS;
const STRENGTH = THE_ORDER_OF_EACH_STAGE_OF_THE_RACE_GIFTS.strength;
const FATE = THE_ORDER_OF_EACH_STAGE_OF_THE_RACE_GIFTS.fate;
const EXPERIENCE = THE_ORDER_OF_EACH_STAGE_OF_THE_RACE_GIFTS.experience;
const STANDING = THE_ORDER_OF_EACH_STAGE_OF_THE_RACE_GIFTS.aHerosStanding;

/** The gifts of a stage's order a realm of the race holds, in the order. */
const theGiftsOfTheStageARaceHolds = <S extends RaceGiftSlug>(
  theRealmsRace: string | null | undefined,
  theOrder: readonly S[],
): readonly S[] => theOrder.filter((slug) => ROWS[slug].race === theRealmsRace);

/** The gifts that strengthen a company (the stage's slugs: armStr's ladder names each by its own reason). */
export type ARaceGiftThatStrengthensACompany =
  (typeof STRENGTH)["a race's gift strengthens a company of its realm"][number];

/** One step a gift makes on a company's strength: the gift, and its factor. */
export interface AStepOfARaceGift {
  readonly theGift: ARaceGiftThatStrengthensACompany;
  readonly theFactor: number;
}

/** The runner of "strength: a race's gift strengthens a company of its realm" (armStr, after the ground): the steps of
 *  the gifts the realm's race holds, in the stage's order, one for each gift whose effect gives a factor. armStr
 *  applies each as its own rounded step, as before. */
export function theStepsTheGiftsOfItsRealmsRaceMakeOnACompany(
  theRealmsRace: string | null | undefined,
  facts: ACompanyAsItsRealmsRaceGiftWeighsIt,
): readonly AStepOfARaceGift[] {
  const theStage = "a race's gift strengthens a company of its realm";
  return theGiftsOfTheStageARaceHolds(theRealmsRace, STRENGTH[theStage]).flatMap((theGift) => {
    const theFactor = ENTRIES[theGift].strength?.[theStage]?.(facts) ?? null;
    return theFactor === null ? [] : [{ theGift, theFactor }];
  });
}

/** The runner of "fate: a race's gift flags a province its realm wins a battle in" (both battles, on the win): whether
 *  a gift the winning realm's race holds flags the province (Raiders' Muster's). */
export function doesTheWinnersRaceFlagTheProvinceItWonABattleIn(
  theWinningRealmsRace: string | null | undefined,
  facts: AProvinceAsARaceGiftWeighsAWinInIt,
): boolean {
  const theStage = "a race's gift flags a province its realm wins a battle in";
  return theGiftsOfTheStageARaceHolds(theWinningRealmsRace, FATE[theStage]).some(
    (slug) => ENTRIES[slug].fate?.[theStage]?.(facts) ?? false,
  );
}

/** Whether a realm's race holds a gift of "fate: a race's gift gives a company the spoils of a battle won attacking"
 *  (markOrcAttackWin stamps no company of a realm that holds none; Early Winter reads it once a realm). */
export function doesARealmsRaceTakeTheSpoilsOfABattleWonAttacking(theRealmsRace: string | null | undefined): boolean {
  return (
    theGiftsOfTheStageARaceHolds(
      theRealmsRace,
      FATE["a race's gift gives a company the spoils of a battle won attacking"],
    ).length > 0
  );
}

/** The runner of "fate: a race's gift gives a company the spoils of a battle won attacking" (markOrcAttackWin's stamp,
 *  Early Winter's half wage): whether a gift the realm's race holds gives the company its share. */
export function doesACompanyTakeItsRealmsSpoilsOfABattleWonAttacking(
  theRealmsRace: string | null | undefined,
  facts: ACompanyAsARaceGiftWeighsItsSpoils,
): boolean {
  const theStage = "a race's gift gives a company the spoils of a battle won attacking";
  return theGiftsOfTheStageARaceHolds(theRealmsRace, FATE[theStage]).some(
    (slug) => ENTRIES[slug].fate?.[theStage]?.(facts) ?? false,
  );
}

/** The runner of "experience: a race's gift quickens a hero's learning" (trySkillGain, on the chance a skill rises by
 *  experience): the factor of each gift the hero's realm's race holds that quickens him, multiplied, or 1. */
export function theFactorTheGiftsOfHisRealmsRaceQuickenAHerosLearningBy(
  theRealmsRace: string | null | undefined,
  facts: AHeroAsARaceGiftWeighsHim,
): number {
  const theStage = "a race's gift quickens a hero's learning";
  return theGiftsOfTheStageARaceHolds(theRealmsRace, EXPERIENCE[theStage]).reduce(
    (theFactor, slug) => theFactor * (ENTRIES[slug].experience?.[theStage]?.(facts) ?? 1),
    1,
  );
}

/** Whether a gift the hero's realm's race holds quickens his learning (resolvePracticeSkillOrder: a quick learner
 *  practises at his share, and his line says so). */
export function doesAGiftOfHisRealmsRaceQuickenAHerosLearning(
  theRealmsRace: string | null | undefined,
  facts: AHeroAsARaceGiftWeighsHim,
): boolean {
  const theStage = "a race's gift quickens a hero's learning";
  return theGiftsOfTheStageARaceHolds(theRealmsRace, EXPERIENCE[theStage]).some(
    (slug) => (ENTRIES[slug].experience?.[theStage]?.(facts) ?? null) !== null,
  );
}

/** The runner of "experience: a race's gift quickens a company's drill" (humanXPMult: a commander's drill, the
 *  garrison's, a battle's rise): the factor of each gift the company's realm's race holds that quickens it,
 *  multiplied, or 1. */
export function theFactorTheGiftsOfItsRealmsRaceQuickenACompanysDrillBy(
  theRealmsRace: string | null | undefined,
  facts: ACompanyAsARaceGiftWeighsItsDrill,
): number {
  const theStage = "a race's gift quickens a company's drill";
  return theGiftsOfTheStageARaceHolds(theRealmsRace, EXPERIENCE[theStage]).reduce(
    (theFactor, slug) => theFactor * (ENTRIES[slug].experience?.[theStage]?.(facts) ?? 1),
    1,
  );
}

/** The runner of "aHerosStanding: a race's gift sets a hero's hit points" (hpStartOf, hpGainBand, maxHpIsOrc): the
 *  first gift the hero's realm's race holds that sets them, or nothing (he starts as any hero does). */
export function theHitPointsTheGiftsOfHisRealmsRaceGiveAHero(
  theRealmsRace: string | null | undefined,
  facts: AHeroAsARaceGiftWeighsHim,
): TheHitPointsARaceGiftGivesAHero | null {
  const theStage = "a race's gift sets a hero's hit points";
  for (const slug of theGiftsOfTheStageARaceHolds(theRealmsRace, STANDING[theStage])) {
    const theHitPoints = ENTRIES[slug].aHerosStanding?.[theStage]?.(facts) ?? null;
    if (theHitPoints !== null) return theHitPoints;
  }
  return null;
}

/** The runner of "aHerosStanding: a race's gift suits a hero of its realm in mithril" (mithrilQualifies; a hire's and
 *  the Broker's grant): whether a gift the hero's realm's race holds suits him in mithril. */
export function doesAGiftOfHisRealmsRaceSuitAHeroInMithril(
  theRealmsRace: string | null | undefined,
  facts: AHeroAsARaceGiftWeighsHim,
): boolean {
  const theStage = "a race's gift suits a hero of its realm in mithril";
  return theGiftsOfTheStageARaceHolds(theRealmsRace, STANDING[theStage]).some(
    (slug) => ENTRIES[slug].aHerosStanding?.[theStage]?.(facts) ?? false,
  );
}

/** A fallen company's flight home, as a gift of its realm's race gives it: the chance in percent, and the race it
 *  flees home as (the gift's). */
export interface AFlightHomeARaceGiftGives {
  readonly thePercent: number;
  readonly theRace: string;
}

/** The runner of "fate: a race's gift gives a fallen company its chance to flee home" (recordBattleGraves, before the
 *  realm's discoveries add theirs): the first gift the company's realm's race holds that gives it a chance, or nothing
 *  (it leaves its grave). */
export function theFlightHomeTheGiftsOfItsRealmsRaceGiveAFallenCompany(
  theRealmsRace: string | null | undefined,
  facts: AFallenCompanyAsARaceGiftWeighsItsFlight,
): AFlightHomeARaceGiftGives | null {
  const theStage = "a race's gift gives a fallen company its chance to flee home";
  for (const slug of theGiftsOfTheStageARaceHolds(theRealmsRace, FATE[theStage])) {
    const thePercent = ENTRIES[slug].fate?.[theStage]?.(facts) ?? null;
    if (thePercent !== null) return { thePercent, theRace: ROWS[slug].race };
  }
  return null;
}
