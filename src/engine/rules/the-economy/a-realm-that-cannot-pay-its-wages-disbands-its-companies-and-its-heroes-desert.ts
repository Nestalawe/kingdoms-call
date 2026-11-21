// A realm that can't pay its wages (B-06, T7, the rules pulled out: its economy family, row B-06e): the effects of
// three stages of turnEnd, in the order Early Winter reaches them once the realm can't pay. Its companies go first, in
// a line: each company's ranks (the dead last, then the least experienced first), a die each company drew breaking a
// tie; a ship carrying troops at sea is passed over, and looked at again each time a company goes. Then, while the
// shortfall lasts, its heroes desert, the best paid first, each on a die of his own; a shortfall left after the last
// is forgiven. Each effect is handed the facts of its stage and reads its numbers from its row
// (src/content/the-economys-rules-their-keys-names-and-numbers.ts); the runners are in
// the-registry-of-the-economys-rules.ts. The dice are the caller's to draw, in the same order as before, and are handed
// in: no effect draws a die. What is never disbanded for want of pay (a summons, the Wild Hunt, the dead of a Deathless
// Legion, a company that draws no wage) is the caller's to ask, as before, as are the line's order of companies and the
// heroes' order by pay.
import {
  THE_ECONOMYS_RULES,
  type TheEconomysRuleSlug,
} from '../../../content/the-economys-rules-their-keys-names-and-numbers.ts';
import { KC_QUALITY_TIERS } from '../../../content/kingdoms-call-data.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheTurnsEndsStages = TheStagesOfEachHookPoint['turnEnd'];

/** The grades in their order, the least experienced first (content's, as QUALITY_TIERS copies them: Early Winter read
 *  QUALITY_TIERS, which nothing changes). */
const THE_GRADES_IN_THEIR_ORDER: readonly string[] = KC_QUALITY_TIERS;

/** "turnEnd: a company's rank in the line to disband unpaid": the dead (a skeletal company) rank after the living;
 *  then the grades rank in their order (content's KC_QUALITY_TIERS: the least experienced first), a company of no known grade as
 *  its row's place in it (Average). */
export const A_COMPANYS_RANK_IN_THE_LINE_TO_DISBAND_UNPAID = {
  'the-dead-disband-last-for-want-of-pay': (facts) => {
    const { theRankOfTheLiving, theRankOfTheDead } =
      THE_ECONOMYS_RULES['the-dead-disband-last-for-want-of-pay'].theNumbers;
    return facts.itIsOfTheDead ? theRankOfTheDead : theRankOfTheLiving;
  },
  'the-least-experienced-disband-first-for-want-of-pay': (facts) => {
    const i = THE_GRADES_IN_THEIR_ORDER.indexOf(facts.itsGrade);
    return i < 0
      ? THE_ECONOMYS_RULES['the-least-experienced-disband-first-for-want-of-pay'].theNumbers
          .theRankOfACompanyOfNoKnownGrade
      : i;
  },
} satisfies Partial<Record<TheEconomysRuleSlug, TheTurnsEndsStages["a company's rank in the line to disband unpaid"]>>;

/** "turnEnd: a company is spared disbanding unpaid": a ship whose column is at open sea and still needs it to carry
 *  its troops is kept at the oars (asked only of a ship, as before). */
export const A_COMPANY_IS_SPARED_DISBANDING_UNPAID = {
  'a-ship-carrying-troops-at-sea-is-kept-at-the-oars-unpaid': (facts) =>
    facts.itIsAShip && facts.itCarriesTroopsAtOpenSea(),
} satisfies Partial<Record<TheEconomysRuleSlug, TheTurnsEndsStages['a company is spared disbanding unpaid']>>;

/** "turnEnd: an unpaid hero deserts": his loyalty holds on a die at or below his row's number, and he deserts on one
 *  above it. */
export const AN_UNPAID_HERO_DESERTS = {
  'an-unpaid-hero-deserts-unless-his-loyalty-holds': (facts) =>
    facts.theDie >
    THE_ECONOMYS_RULES['an-unpaid-hero-deserts-unless-his-loyalty-holds'].theNumbers.theDieHisLoyaltyHoldsAtOrBelow,
} satisfies Partial<Record<TheEconomysRuleSlug, TheTurnsEndsStages['an unpaid hero deserts']>>;
