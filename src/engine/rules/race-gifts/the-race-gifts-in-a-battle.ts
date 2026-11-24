// The race gifts in a battle (B-06, T7, the rules pulled out: the races' family, row B-06ae): Woodland Mastery and the
// Bulwark ("strength: a race's gift strengthens a company of its realm", one rounded step each in armStr), Raiders'
// Muster's flag ("fate: a race's gift flags a province its realm wins a battle in", both battles) and the War-spoils
// ("fate: a race's gift gives a company the spoils of a battle won attacking", markOrcAttackWin's stamp and Early
// Winter's wage). Each reads its race and numbers from its row (src/content/the-race-gifts-their-keys-races-and-
// numbers.ts); the runners (the-registry-of-the-race-gifts.ts) ask only the gifts the realm's race holds. None draws a
// die.
import { RACE_GIFTS, type RaceGiftSlug } from '../../../content/the-race-gifts-their-keys-races-and-numbers.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheStrengthsStages = TheStagesOfEachHookPoint['strength'];
type TheFatesStages = TheStagesOfEachHookPoint['fate'];

/** "strength: a race's gift strengthens a company of its realm": a company of the gift's race, on its ground or its
 *  side, at its row's factor. */
export const A_RACES_GIFT_STRENGTHENS_A_COMPANY_OF_ITS_REALM = {
  'woodland-mastery': (facts) => {
    const row = RACE_GIFTS['woodland-mastery'];
    // (the row's list, read as names: its `as const` literals can't be asked for any string)
    const theGround: readonly string[] = row.theGround;
    return facts.theCompanysRace === row.race && facts.theTerrain != null && theGround.includes(facts.theTerrain)
      ? row.theStrength
      : null;
  },
  bulwark: (facts) => {
    const row = RACE_GIFTS.bulwark;
    return facts.theCompanysRace === row.race && facts.itsSide === row.theSide ? row.theStrength : null;
  },
} satisfies Partial<Record<RaceGiftSlug, TheStrengthsStages["a race's gift strengthens a company of its realm"]>>;

/** "fate: a race's gift flags a province its realm wins a battle in": a province of the gift's race. */
export const A_RACES_GIFT_FLAGS_A_PROVINCE_ITS_REALM_WINS_A_BATTLE_IN = {
  'raiders-muster': (facts) => facts.theProvincesRace === RACE_GIFTS['raiders-muster'].race,
} satisfies Partial<Record<RaceGiftSlug, TheFatesStages["a race's gift flags a province its realm wins a battle in"]>>;

/** "fate: a race's gift gives a company the spoils of a battle won attacking": a company of the gift's race. */
export const A_RACES_GIFT_GIVES_A_COMPANY_THE_SPOILS_OF_A_BATTLE_WON_ATTACKING = {
  'war-spoils': (facts) => facts.theCompanysRace === RACE_GIFTS['war-spoils'].race,
} satisfies Partial<
  Record<RaceGiftSlug, TheFatesStages["a race's gift gives a company the spoils of a battle won attacking"]>
>;
