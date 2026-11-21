// ── The price of a company of a type, and the wage a company draws before its cuts (B-06b, T7: the rules pulled out) ──
// The engine's rules of a hero, an army, an item, a level or a number, never the world, live in this folder
// (src/engine/rules-on-plain-values/): its files import only src/content and each other, so the player portal can
// share them (P1-11a). One rule each, where the turn and its copies agreed: the price of a type (the table's, or 2g
// for a type it prices at nothing or not at all) and a company's wage before its cuts (a skeletal company's flat 1g,
// else its type's price). Early Winter's wages and their disbanding, the Recruit Armies order's price and a band's,
// the report's forecast of the wages and its prices, the bots' ledger and recruits, and the order form's treasury
// ledger read them. The figures are content's (kingdoms-call-data.ts); the copies that differ keep their own code (the
// army card's upkeep, the ledger's Harvest the Field, the bots' other fallbacks).
import {
  KC_EACH_UNIT_TYPES_PRICE_AND_WAGE,
  KC_THE_PRICE_OF_A_COMPANY_THE_TABLE_PRICES_AT_NOTHING,
  KC_THE_WAGE_OF_A_SKELETAL_COMPANY,
} from '../../content/kingdoms-call-data.ts';

/** A table of prices by unit type, as the turn holds it or as a report hands it to the order form. */
type APriceByUnitType = Readonly<Partial<Record<string, number>>>;

/** The price of a company of a type (to raise it, and its wage each turn): the table's, or 2g for a type the table
 *  prices at nothing or not at all. The table is content's, unless the reader hands its own (the order form's ledger
 *  hands the report's). */
export function thePriceOfACompanyOfAType(
  type: string,
  thePrices: APriceByUnitType = KC_EACH_UNIT_TYPES_PRICE_AND_WAGE,
): number {
  return (thePrices[type] ?? 0) || KC_THE_PRICE_OF_A_COMPANY_THE_TABLE_PRICES_AT_NOTHING;
}

/** The wage a company draws before its cuts: a skeletal company's flat 1g, whatever its type, else its type's
 *  price. */
export function theWageOfACompany(company: {
  readonly type: string;
  readonly _isSkeletal?: boolean | null | undefined;
}): number {
  return company._isSkeletal ? KC_THE_WAGE_OF_A_SKELETAL_COMPANY : thePriceOfACompanyOfAType(company.type);
}
