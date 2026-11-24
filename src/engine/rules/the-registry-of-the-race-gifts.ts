// The rule registry of the race gifts (B-06, T7, the rules pulled out: the races' family, from row B-06ae). A gift is
// one row in src/content/ (its name, its race and what the turn reads for it: the-race-gifts-their-keys-races-and-
// numbers.ts) and one entry here, keyed by the same slug, naming its effect at each stage of a hook point. The hook
// points and their stages are the content effects' (one union, in the-registry-of-content-effects.ts); each stage's
// order is THE_ORDER_OF_EACH_STAGE_OF_THE_RACE_GIFTS. A runner is handed the race of the realm the rule reads (the
// company's realm, the winner's, the stamped company's) and asks, in the stage's order, the effects of the gifts that
// race holds; each effect checks the rest (its company's or its province's race, its ground, its side). No effect draws
// a die. How to add one: docs/architecture/the-rule-registry-and-the-one-source-for-shared-rules.md.
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
import type {
  ACompanyAsARaceGiftWeighsItsSpoils,
  ACompanyAsItsRealmsRaceGiftWeighsIt,
  AProvinceAsARaceGiftWeighsAWinInIt,
  HookPointName,
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
