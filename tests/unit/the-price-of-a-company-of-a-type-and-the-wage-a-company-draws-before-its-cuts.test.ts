// The price of a company of a type and the wage a company draws before its cuts, on plain values (B-06b, T7: the rules
// pulled out): the table's price (to raise it, and its wage each turn), content's one table (the humanoid units' and
// the primal units', which the engine reads as ARMY_COST_MASTER, the same object), or a table its reader hands it (the
// order form's ledger hands the report's); 2g for a type the table prices at nothing or not at all; a skeletal
// company's flat 1g, whatever its type.
//
// Level 1 (unit): the functions of src/engine/rules-on-plain-values/the-price-of-a-company-of-a-type-and-the-wage-a-
// company-draws-before-its-cuts.ts on real and made-up types. A lower level can't run a function. No matrix game reaches
// the 2g (every unit a game raises has a price) nor a table handed in (the order form's ledger is the player page's),
// so these cases pin them; the matrix and every realm's report check the turn's and the report's calls in whole games.
import { describe, expect, test } from 'vitest';
import {
  KC_EACH_UNIT_TYPES_PRICE_AND_WAGE,
  KC_THE_PRICE_OF_A_COMPANY_THE_TABLE_PRICES_AT_NOTHING,
  KC_THE_WAGE_OF_A_SKELETAL_COMPANY,
  PRIMAL_ARMY_DEFS_P,
} from '../../src/content/kingdoms-call-data.ts';
import { ARMY_COST_MASTER } from '../../src/engine/army-tables.ts';
import {
  thePriceOfACompanyOfAType,
  theWageOfACompany,
} from '../../src/engine/rules-on-plain-values/the-price-of-a-company-of-a-type-and-the-wage-a-company-draws-before-its-cuts.ts';

describe('the price of a company of a type', () => {
  test("content's: Gilded Lances 4g, Human Garrison 1g, a primal unit's its row's", () => {
    expect(thePriceOfACompanyOfAType('Gilded Lances')).toBe(4);
    expect(thePriceOfACompanyOfAType('Human Garrison')).toBe(1);
    expect(thePriceOfACompanyOfAType('Elder Dragons')).toBe(PRIMAL_ARMY_DEFS_P['Elder Dragons'].cost);
  });
  test('2g for a type the table prices not at all, or at nothing', () => {
    expect(KC_THE_PRICE_OF_A_COMPANY_THE_TABLE_PRICES_AT_NOTHING).toBe(2);
    expect(thePriceOfACompanyOfAType('No Such Unit')).toBe(2);
    expect(thePriceOfACompanyOfAType('Gilded Lances', { 'Gilded Lances': 0 })).toBe(2);
  });
  test("a table handed in is read instead of content's: its price, or 2g for a type it leaves out", () => {
    expect(thePriceOfACompanyOfAType('Gilded Lances', { 'Gilded Lances': 9 })).toBe(9);
    expect(thePriceOfACompanyOfAType('Gilded Lances', {})).toBe(2);
  });
  test("the engine's table is content's, the same object, its keys the humanoid units' then the primal units'", () => {
    expect(ARMY_COST_MASTER).toBe(KC_EACH_UNIT_TYPES_PRICE_AND_WAGE);
    const theKeys = Object.keys(ARMY_COST_MASTER);
    expect(theKeys.slice(0, 2)).toEqual(['Shieldwall Levies', 'Free Lances']);
    expect(theKeys.slice(-Object.keys(PRIMAL_ARMY_DEFS_P).length)).toEqual(Object.keys(PRIMAL_ARMY_DEFS_P));
  });
});

describe('the wage a company draws before its cuts', () => {
  test("a skeletal company's flat 1g, whatever its type; else its type's price, or 2g", () => {
    expect(KC_THE_WAGE_OF_A_SKELETAL_COMPANY).toBe(1);
    expect(theWageOfACompany({ type: 'Gilded Lances', _isSkeletal: true })).toBe(1);
    expect(theWageOfACompany({ type: 'No Such Unit', _isSkeletal: true })).toBe(1);
    expect(theWageOfACompany({ type: 'Gilded Lances' })).toBe(4);
    expect(theWageOfACompany({ type: 'Gilded Lances', _isSkeletal: false })).toBe(4);
    expect(theWageOfACompany({ type: 'No Such Unit' })).toBe(2);
  });
});
