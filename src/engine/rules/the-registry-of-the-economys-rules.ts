// The rule registry of the economy (B-06, T7, the rules pulled out: its economy family, from row B-06c). A rule of a
// realm's gold is one row in src/content/ (its name and the numbers the turn reads for it:
// the-economys-rules-their-keys-names-and-numbers.ts) and one entry here, keyed by the same slug, naming its effect at
// each stage of a hook point. The hook points and their stages are the content effects' (one union, in
// the-registry-of-content-effects.ts); each stage's order is THE_ORDER_OF_EACH_STAGE_OF_THE_ECONOMY. A runner asks, in
// the stage's order, each effect of its stage; the caller hands it what it must ask (who holds a title, a mastery or a
// Wonder), as before. No effect draws a die. How to add one:
// docs/architecture/the-economys-registry-its-stages-and-how-to-add-a-rule-of-the-economy.md.
import { type TheEconomysRuleSlug } from '../../content/the-economys-rules-their-keys-names-and-numbers.ts';
import {
  A_PROVINCES_TAX_FROM_THE_REALMS_WONDER,
  A_PROVINCES_TAX_THIS_TURN,
  A_PROVINCES_TAX_WHILE_A_MARK_LASTS,
  A_REALMS_GOLD_BEYOND_ITS_TAX_FROM_A_HEROS_MASTERY,
  A_REALMS_GOLD_BEYOND_ITS_TAX_FROM_A_HEROS_MINOR_TITLE,
} from './the-economy/a-provinces-tax-and-a-realms-gold-beyond-it-at-the-turns-end.ts';
import {
  A_COMPANYS_WAGE_THIS_TURN,
  A_COMPANYS_WAGE_UNDER_ITS_LEADER,
  A_REALMS_COMPANY_WAGES_UNDER_ITS_HOST_LEADER,
} from './the-economy/a-companys-wage-and-a-realms-company-wages-at-the-turns-end.ts';
import type { TheHostLeadersCut } from '../rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts';
import type {
  ACompanysWageAndTheLeaderItMarchesUnder,
  ACompanysWageAndTheWarSpoilsItTookThisTurn,
  ACompanysWageThisTurnAndTheHalfGoldsCarried,
  AHeroAsTheGoldOfHisMasteriesReadsHim,
  AHeroAsTheGoldOfHisMinorTitlesReadsHim,
  AProvincesTaxAndItsMarksOfThisTurn,
  AProvincesTaxAndTheRealmsWonder,
  AProvincesTaxUnderAMarkThatLasts,
  HookPointName,
  TheCompanyWagesUnderTheHostLeader,
  TheStagesOfEachHookPoint,
} from './the-registry-of-content-effects.ts';

/** An entry: the rule's effect at each stage it acts in. */
export type EconomysRuleEntry = { readonly [H in HookPointName]?: Partial<TheStagesOfEachHookPoint[H]> };

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). */
export const THE_REGISTRY_OF_THE_ECONOMYS_RULES = {
  'an-earthquake-wrecks-a-provinces-tax-this-turn': {
    turnEnd: {
      "a province's tax this turn": A_PROVINCES_TAX_THIS_TURN['an-earthquake-wrecks-a-provinces-tax-this-turn'],
    },
  },
  'sabotage-wrecks-a-provinces-tax-this-turn': {
    turnEnd: { "a province's tax this turn": A_PROVINCES_TAX_THIS_TURN['sabotage-wrecks-a-provinces-tax-this-turn'] },
  },
  'bless-province-raises-a-provinces-tax-this-turn': {
    turnEnd: {
      "a province's tax this turn": A_PROVINCES_TAX_THIS_TURN['bless-province-raises-a-provinces-tax-this-turn'],
    },
  },
  'enslave-cuts-a-provinces-tax-while-it-resents': {
    turnEnd: {
      "a province's tax while a mark lasts":
        A_PROVINCES_TAX_WHILE_A_MARK_LASTS['enslave-cuts-a-provinces-tax-while-it-resents'],
    },
  },
  'the-free-city-charter-adds-to-a-garrisoned-provinces-tax': {
    turnEnd: {
      "a province's tax from the realm's Wonder":
        A_PROVINCES_TAX_FROM_THE_REALMS_WONDER['the-free-city-charter-adds-to-a-garrisoned-provinces-tax'],
    },
  },
  'the-cutpurses-gold': {
    turnEnd: {
      "a realm's gold beyond its tax from a hero's minor title":
        A_REALMS_GOLD_BEYOND_ITS_TAX_FROM_A_HEROS_MINOR_TITLE['the-cutpurses-gold'],
    },
  },
  'the-champion-of-the-peoples-gold': {
    turnEnd: {
      "a realm's gold beyond its tax from a hero's minor title":
        A_REALMS_GOLD_BEYOND_ITS_TAX_FROM_A_HEROS_MINOR_TITLE['the-champion-of-the-peoples-gold'],
    },
  },
  'the-castellans-gold': {
    turnEnd: {
      "a realm's gold beyond its tax from a hero's minor title":
        A_REALMS_GOLD_BEYOND_ITS_TAX_FROM_A_HEROS_MINOR_TITLE['the-castellans-gold'],
    },
  },
  'the-thief-network': {
    turnEnd: {
      "a realm's gold beyond its tax from a hero's mastery":
        A_REALMS_GOLD_BEYOND_ITS_TAX_FROM_A_HEROS_MASTERY['the-thief-network'],
    },
  },
  'the-orcish-war-spoils-halve-a-companys-wage-this-turn': {
    turnEnd: {
      "a company's wage this turn": A_COMPANYS_WAGE_THIS_TURN['the-orcish-war-spoils-halve-a-companys-wage-this-turn'],
    },
  },
  'a-druid-halves-a-beasts-price-and-wage': {
    turnEnd: {
      "a company's wage under its leader": A_COMPANYS_WAGE_UNDER_ITS_LEADER['a-druid-halves-a-beasts-price-and-wage'],
    },
  },
  'the-host-leaders-cut-of-his-companies-wages': {
    turnEnd: {
      "a realm's company wages under its Host-Leader":
        A_REALMS_COMPANY_WAGES_UNDER_ITS_HOST_LEADER['the-host-leaders-cut-of-his-companies-wages'],
    },
  },
} satisfies Record<TheEconomysRuleSlug, EconomysRuleEntry>;

/** Each stage's effects, in the order the turn runs them (not by a number: the tax so far is each effect's, and the
 *  minor titles' gold is noted on the tax line in this order, hero by hero). */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_ECONOMY = {
  turnEnd: {
    "a province's tax this turn": [
      'an-earthquake-wrecks-a-provinces-tax-this-turn',
      'sabotage-wrecks-a-provinces-tax-this-turn',
      'bless-province-raises-a-provinces-tax-this-turn',
    ],
    "a province's tax while a mark lasts": ['enslave-cuts-a-provinces-tax-while-it-resents'],
    "a province's tax from the realm's Wonder": ['the-free-city-charter-adds-to-a-garrisoned-provinces-tax'],
    "a realm's gold beyond its tax from a hero's minor title": [
      'the-cutpurses-gold',
      'the-champion-of-the-peoples-gold',
      'the-castellans-gold',
    ],
    "a realm's gold beyond its tax from a hero's mastery": ['the-thief-network'],
    "a company's wage this turn": ['the-orcish-war-spoils-halve-a-companys-wage-this-turn'],
    "a company's wage under its leader": ['a-druid-halves-a-beasts-price-and-wage'],
    "a realm's company wages under its Host-Leader": ['the-host-leaders-cut-of-his-companies-wages'],
  },
} as const satisfies {
  readonly [H in HookPointName]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly TheEconomysRuleSlug[];
  };
};

const ENTRIES: Readonly<Record<TheEconomysRuleSlug, EconomysRuleEntry>> = THE_REGISTRY_OF_THE_ECONOMYS_RULES;
const TURN_END = THE_ORDER_OF_EACH_STAGE_OF_THE_ECONOMY.turnEnd;

/** The runner of "turnEnd: a province's tax this turn" (Early Winter's collection, first of a province's tax; the
 *  report's forecast leaves this turn's marks out): the province's tax after each effect of the stage, in its order,
 *  each handed the tax the one before gave. */
export function theTaxOfAProvinceThisTurn(facts: AProvincesTaxAndItsMarksOfThisTurn): number {
  const theStage = "a province's tax this turn";
  return TURN_END[theStage].reduce(
    (theTax, slug) => ENTRIES[slug].turnEnd?.[theStage]?.({ ...facts, theTax }) ?? theTax,
    facts.theTax,
  );
}

/** The runner of "turnEnd: a province's tax while a mark lasts" (Early Winter's collection and the report's forecast,
 *  after the province's consecrated ground): its tax after each effect of the stage, in its order. */
export function theTaxOfAProvinceWhileAMarkLasts(facts: AProvincesTaxUnderAMarkThatLasts): number {
  const theStage = "a province's tax while a mark lasts";
  return TURN_END[theStage].reduce(
    (theTax, slug) => ENTRIES[slug].turnEnd?.[theStage]?.({ ...facts, theTax }) ?? theTax,
    facts.theTax,
  );
}

/** The runner of "turnEnd: a province's tax from the realm's Wonder" (Early Winter's collection and the report's
 *  forecast, after the discoveries'): its tax after each effect of the stage, in its order. */
export function theTaxOfAProvinceFromTheRealmsWonder(facts: AProvincesTaxAndTheRealmsWonder): number {
  const theStage = "a province's tax from the realm's Wonder";
  return TURN_END[theStage].reduce(
    (theTax, slug) => ENTRIES[slug].turnEnd?.[theStage]?.({ ...facts, theTax }) ?? theTax,
    facts.theTax,
  );
}

/** A minor title's gold, by the slug of its rule. */
export type AMinorTitlesGoldBeyondTheTax = TheEconomysRuleSlug &
  (typeof TURN_END)["a realm's gold beyond its tax from a hero's minor title"][number];

/** The runner of "turnEnd: a realm's gold beyond its tax from a hero's minor title" (Early Winter's collection, hero by
 *  hero, which notes each on the tax line, and the report's forecast): each effect of the stage that gives gold, with
 *  its slug and the gold, in the stage's order. */
export function theGoldAHerosMinorTitlesAddBeyondTheTax(
  facts: AHeroAsTheGoldOfHisMinorTitlesReadsHim,
): readonly (readonly [AMinorTitlesGoldBeyondTheTax, number])[] {
  const theStage = "a realm's gold beyond its tax from a hero's minor title";
  return TURN_END[theStage].flatMap((slug) => {
    const theGold = ENTRIES[slug].turnEnd?.[theStage]?.(facts) ?? null;
    return theGold === null ? [] : [[slug, theGold] as const];
  });
}

/** The runner of "turnEnd: a realm's gold beyond its tax from a hero's mastery" (Early Winter's collection and the
 *  report's forecast, hero by hero): the gold each effect of the stage gives, added. */
export function theGoldAHerosMasteriesAddBeyondTheTax(facts: AHeroAsTheGoldOfHisMasteriesReadsHim): number {
  const theStage = "a realm's gold beyond its tax from a hero's mastery";
  return TURN_END[theStage].reduce((theGold, slug) => theGold + (ENTRIES[slug].turnEnd?.[theStage]?.(facts) ?? 0), 0);
}

/** The runner of "turnEnd: a company's wage this turn" (Early Winter's wages alone: the report's forecast leaves this
 *  turn's war-spoils out): a company's wage and the half golds carried after each effect of the stage, in its order,
 *  each handed the wage and the carry the one before gave. The caller hands the carry on to the next company. */
export function theWageOfACompanyThisTurn(
  facts: ACompanysWageAndTheWarSpoilsItTookThisTurn,
): ACompanysWageThisTurnAndTheHalfGoldsCarried {
  const theStage = "a company's wage this turn";
  return TURN_END[theStage].reduce<ACompanysWageThisTurnAndTheHalfGoldsCarried>(
    (soFar, slug) => ENTRIES[slug].turnEnd?.[theStage]?.({ ...facts, ...soFar }) ?? soFar,
    { theWage: facts.theWage, theHalfGoldsCarried: facts.theHalfGoldsCarried },
  );
}

/** The runner of "turnEnd: a company's wage under its leader" (Early Winter's wages and the report's forecast, before
 *  the upkeep discoveries): a company's wage after each effect of the stage, in its order. */
export function theWageOfACompanyUnderItsLeader(facts: ACompanysWageAndTheLeaderItMarchesUnder): number {
  const theStage = "a company's wage under its leader";
  return TURN_END[theStage].reduce(
    (theWage, slug) => ENTRIES[slug].turnEnd?.[theStage]?.({ ...facts, theWage }) ?? theWage,
    facts.theWage,
  );
}

/** The runner of "turnEnd: a realm's company wages under its Host-Leader" (Early Winter's wages and the report's
 *  forecast, once every company's wage is added, only when the realm has a Host-Leader): the gold each effect of the
 *  stage saves, added, and the wages the last one leaves, each handed the wages the one before left. */
export function theCompanyWagesUnderTheHostLeader(facts: TheCompanyWagesUnderTheHostLeader): TheHostLeadersCut {
  const theStage = "a realm's company wages under its Host-Leader";
  return TURN_END[theStage].reduce<TheHostLeadersCut>(
    (theCutSoFar, slug) => {
      const theCut = ENTRIES[slug].turnEnd?.[theStage]?.({ ...facts, theCompanyWages: theCutSoFar.theWagesLeft });
      return theCut
        ? { theGoldSaved: theCutSoFar.theGoldSaved + theCut.theGoldSaved, theWagesLeft: theCut.theWagesLeft }
        : theCutSoFar;
    },
    { theGoldSaved: 0, theWagesLeft: facts.theCompanyWages },
  );
}
