// A company's wage and a realm's company wages at the turn's end (B-06, T7, the rules pulled out: its economy family,
// row B-06d): the effects of three stages of turnEnd, in the order Early Winter's wages reach them. A company's wage
// this turn (the Orcish war-spoils' half, its half golds carried), then under its leader (the Druid's half), then,
// after the upkeep discoveries (the discoveries' registry) and every company's wage, the realm's company wages under
// its Host-Leader. A skeletal company's flat wage and a company that draws none are the caller's, before these, as
// before (theWageOfACompany, aCompanyDrawsNoWage). Each is handed the facts of its stage and reads its numbers from
// its row (src/content/the-economys-rules-their-keys-names-and-numbers.ts); the runners are in
// the-registry-of-the-economys-rules.ts. Who took the war-spoils, who leads as a Druid and who holds the Host-Leader is
// the caller's to ask, as before. No effect draws a die.
import {
  THE_ECONOMYS_RULES,
  type TheEconomysRuleSlug,
} from '../../../content/the-economys-rules-their-keys-names-and-numbers.ts';
import {
  theHostLeadersCut,
  theWageABeastPaysUnderADruid,
} from '../../rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheTurnsEndsStages = TheStagesOfEachHookPoint['turnEnd'];

/** "turnEnd: a company's wage this turn": an Orcish company of an Orcish realm that won attacking this turn pays half
 *  its wage, rounded down, the half gold it leaves carried in the realm's carry; once the carry holds a whole gold (to
 *  within 1e-9), the company pays it and the carry gives it up. Across the host the total is half (rounded to the
 *  nearest gold). A company whose half falls below the least wage pays the least wage, and neither banks a half gold
 *  nor spends one. The carry's arithmetic is written exactly as Early Winter wrote it (`_orcFrac`). */
export const A_COMPANYS_WAGE_THIS_TURN = {
  'the-orcish-war-spoils-halve-a-companys-wage-this-turn': (facts) => {
    if (!facts.itTookTheWarSpoilsThisTurn) return facts.theWage;
    const { theShareOfTheWage, theLeastWage } =
      THE_ECONOMYS_RULES['the-orcish-war-spoils-halve-a-companys-wage-this-turn'].theNumbers;
    const theCarry = facts.theHalfGoldsTheWarSpoilsCarry;
    const _half = facts.theWage * theShareOfTheWage;
    let _wHalf = Math.floor(_half);
    if (_wHalf < theLeastWage) {
      // The floor bites: this company already pays MORE than half, so it neither banks a remainder nor spends one.
      // (Letting a 1g company both claim the floor and consume the carry undercharged the rest of the host by a gold
      // every time.)
      _wHalf = theLeastWage;
    } else {
      theCarry.theHalfGoldsCarried += _half - _wHalf;
      if (theCarry.theHalfGoldsCarried >= 1 - 1e-9) {
        _wHalf += 1;
        theCarry.theHalfGoldsCarried -= 1;
      }
    }
    return _wHalf;
  },
} satisfies Partial<Record<TheEconomysRuleSlug, TheTurnsEndsStages["a company's wage this turn"]>>;

/** "turnEnd: a company's wage under its leader": a beast a Druid 6 leads (or any, under the Druidic Wonder) pays half
 *  its wage, rounded down, never below the least wage (theWageABeastPaysUnderADruid, which the order form's ledger and
 *  the army card read too). */
export const A_COMPANYS_WAGE_UNDER_ITS_LEADER = {
  'a-druid-halves-a-beasts-price-and-wage': (facts) =>
    facts.itIsABeastADruidHalves ? theWageABeastPaysUnderADruid(facts.theWage) : facts.theWage,
} satisfies Partial<Record<TheEconomysRuleSlug, TheTurnsEndsStages["a company's wage under its leader"]>>;

/** "turnEnd: a realm's company wages under its Host-Leader": his row's gold less for each company he leads that draws
 *  a wage, the wages never below nothing (theHostLeadersCut, which the order form's ledger reads too). */
export const A_REALMS_COMPANY_WAGES_UNDER_ITS_HOST_LEADER = {
  'the-host-leaders-cut-of-his-companies-wages': (facts) =>
    theHostLeadersCut(facts.theCompanyWages, facts.theCompaniesHeSavesOn),
} satisfies Partial<Record<TheEconomysRuleSlug, TheTurnsEndsStages["a realm's company wages under its Host-Leader"]>>;
