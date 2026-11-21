// A province's tax and a realm's gold beyond it at the turn's end (B-06, T7, the rules pulled out: its economy family,
// row B-06c): the effects of five stages of turnEnd, in the order Early Winter's collection reaches them. A province's
// tax this turn (an Earthquake's and a Sabotage's nothing, a Bless's yield), then, after its consecrated ground, while a
// mark lasts (Enslave), then, after the discoveries, from the realm's Wonder (the Free City Charter); and the realm's
// gold beyond its tax, from a hero's minor title (the Cutpurse, the Champion of the People, the Castellan) and from his
// mastery (the Thief network). Each is handed the facts of its stage and reads its numbers from its row
// (src/content/the-economys-rules-their-keys-names-and-numbers.ts); the runners are in the-registry-of-the-economys-
// rules.ts. Who holds a title, a mastery or a Wonder is the caller's to ask, as before. No effect draws a die.
import {
  THE_ECONOMYS_RULES,
  type TheEconomysRuleSlug,
} from '../../../content/the-economys-rules-their-keys-names-and-numbers.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheTurnsEndsStages = TheStagesOfEachHookPoint['turnEnd'];

/** "turnEnd: a province's tax this turn": an Earthquake or a Sabotage this turn leaves nothing; a Bless this turn
 *  multiplies the tax by the blessing's own measure (its row's where it recorded none) and rounds it, as
 *  `Math.round(t * (Number(pv._blessedMult) || 1.6))` did. A mark of another turn counts for nothing. */
export const A_PROVINCES_TAX_THIS_TURN = {
  'an-earthquake-wrecks-a-provinces-tax-this-turn': (facts) =>
    facts.theProvince._earthquakeNoTax === facts.theTurn ? 0 : facts.theTax,
  'sabotage-wrecks-a-provinces-tax-this-turn': (facts) =>
    facts.theProvince._sabotagedForTurn === facts.theTurn ? 0 : facts.theTax,
  'bless-province-raises-a-provinces-tax-this-turn': (facts) =>
    facts.theProvince._blessedTurn === facts.theTurn
      ? Math.round(
          facts.theTax *
            (Number(facts.theProvince._blessedMult) ||
              THE_ECONOMYS_RULES['bless-province-raises-a-provinces-tax-this-turn'].theNumbers
                .theYieldOfABlessThatRecordedNone),
        )
      : facts.theTax,
} satisfies Partial<Record<TheEconomysRuleSlug, TheTurnsEndsStages["a province's tax this turn"]>>;

/** "turnEnd: a province's tax while a mark lasts": an enslaved province that still resents it pays its row's gold
 *  less, never below nothing. */
export const A_PROVINCES_TAX_WHILE_A_MARK_LASTS = {
  'enslave-cuts-a-provinces-tax-while-it-resents': (facts) =>
    facts.itStillResentsItsEnslavement
      ? Math.max(
          0,
          facts.theTax - THE_ECONOMYS_RULES['enslave-cuts-a-provinces-tax-while-it-resents'].theNumbers.theGoldItCuts,
        )
      : facts.theTax,
} satisfies Partial<Record<TheEconomysRuleSlug, TheTurnsEndsStages["a province's tax while a mark lasts"]>>;

/** "turnEnd: a province's tax from the realm's Wonder": while the realm's Free City Charter stands (asked first, as
 *  before), a province that keeps a garrison pays its row's gold more. */
export const A_PROVINCES_TAX_FROM_THE_REALMS_WONDER = {
  'the-free-city-charter-adds-to-a-garrisoned-provinces-tax': (facts) =>
    facts.theFreeCityCharterStands() && facts.itKeepsAGarrison
      ? facts.theTax +
        THE_ECONOMYS_RULES['the-free-city-charter-adds-to-a-garrisoned-provinces-tax'].theNumbers.theGoldItAdds
      : facts.theTax,
} satisfies Partial<Record<TheEconomysRuleSlug, TheTurnsEndsStages["a province's tax from the realm's Wonder"]>>;

/** "turnEnd: a realm's gold beyond its tax from a hero's minor title": the Cutpurse's and the Champion of the People's
 *  gold to their holder's realm; the Castellan's, a gold for every so many provinces his realm holds, rounded down, or
 *  nothing below them (the line notes none). */
export const A_REALMS_GOLD_BEYOND_ITS_TAX_FROM_A_HEROS_MINOR_TITLE = {
  'the-cutpurses-gold': (facts) =>
    facts.heHoldsTheCutpurse ? THE_ECONOMYS_RULES['the-cutpurses-gold'].theNumbers.theGold : null,
  'the-champion-of-the-peoples-gold': (facts) =>
    facts.heHoldsTheChampionOfThePeople
      ? THE_ECONOMYS_RULES['the-champion-of-the-peoples-gold'].theNumbers.theGold
      : null,
  'the-castellans-gold': (facts) => {
    if (!facts.heHoldsTheCastellan) return null;
    const theGold = Math.floor(
      facts.theProvincesHisRealmHolds() / THE_ECONOMYS_RULES['the-castellans-gold'].theNumbers.theProvincesForEachGold,
    );
    return theGold > 0 ? theGold : null;
  },
} satisfies Partial<
  Record<TheEconomysRuleSlug, TheTurnsEndsStages["a realm's gold beyond its tax from a hero's minor title"]>
>;

/** "turnEnd: a realm's gold beyond its tax from a hero's mastery": the Thief network's stipend. */
export const A_REALMS_GOLD_BEYOND_ITS_TAX_FROM_A_HEROS_MASTERY = {
  'the-thief-network': (facts) =>
    facts.heHoldsTheThiefNetwork ? THE_ECONOMYS_RULES['the-thief-network'].theNumbers.theGold : 0,
} satisfies Partial<
  Record<TheEconomysRuleSlug, TheTurnsEndsStages["a realm's gold beyond its tax from a hero's mastery"]>
>;
