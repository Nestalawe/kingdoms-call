// The economy's registry, a company's wage and a realm's company wages (B-06d): each runner of its three wage stages
// of turnEnd gives what Early Winter's wages and the report's forecast wrote inline before, on every case. A company's
// wage this turn: an Orcish company that took the war-spoils pays half, rounded down, the half golds carried from
// company to company and paid once a whole gold builds up (to within 1e-9), 1 at the least (a company the floor bites
// neither banks nor spends a half gold), and one that took none pays its wage and leaves the carry alone; under its
// leader: a beast a Druid halves pays half, rounded down, 1 at the least; under the Host-Leader: a gold less for each
// company he saves on, the wages never below nothing, the gold saved no more than the wages. Each old line is written
// here as it was, and the runner is compared with it, the carry company by company over every host of up to four
// companies of 1g to 8g.
// Level 1 (unit): the runners are functions on plain values; a static test can't run them, and Early Winter's cases
// (tests/lib/early-winter-cases.ts) and the report's (tests/unit/realm-reports.test.ts) hold the callers.
import { expect, test } from 'vitest';
import {
  theCompanyWagesUnderTheHostLeader,
  theWageOfACompanyThisTurn,
  theWageOfACompanyUnderItsLeader,
} from '../../src/engine/rules/the-registry-of-the-economys-rules.ts';

const WAGES = Array.from({ length: 41 }, (_, i) => i);

/** Every host of one to four companies, each of 1g to 8g, each taking the war-spoils or not. */
function everyHost(): (readonly [wage: number, tookTheSpoils: boolean])[][] {
  const companies = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [[w, true] as const, [w, false] as const]);
  const hosts: (readonly [number, boolean])[][] = companies.map((c) => [c]);
  for (let n = 2; n <= 4; n++)
    for (const host of hosts.filter((h) => h.length === n - 1)) for (const c of companies) hosts.push([...host, c]);
  return hosts;
}

test("a company's wage this turn: the Orcish war-spoils' half, its half golds carried company by company, as Early Winter wrote it", () => {
  let hosts = 0;
  for (const host of everyHost()) {
    hosts += 1;
    let _orcFrac = 0;
    const theCarry = { theHalfGoldsCarried: 0 };
    host.forEach(([price, tookTheSpoils], i) => {
      let w = price;
      if (tookTheSpoils) {
        const _w0 = w,
          _half = _w0 * 0.5;
        let _wHalf = Math.floor(_half);
        if (_wHalf < 1) {
          _wHalf = 1;
        } else {
          _orcFrac += _half - _wHalf;
          if (_orcFrac >= 1 - 1e-9) {
            _wHalf += 1;
            _orcFrac -= 1;
          }
        }
        w = _wHalf;
      }
      const got = theWageOfACompanyThisTurn({
        theWage: price,
        itTookTheWarSpoilsThisTurn: tookTheSpoils,
        theHalfGoldsTheWarSpoilsCarry: theCarry,
      });
      expect(got, `${JSON.stringify(host)}: company ${String(i)}'s wage`).toBe(w);
      expect(theCarry.theHalfGoldsCarried, `${JSON.stringify(host)}: the carry after company ${String(i)}`).toBe(
        _orcFrac,
      );
    });
  }
  expect(hosts).toBe(16 + 16 ** 2 + 16 ** 3 + 16 ** 4);
  // the reported case (2026-09-27): four 3g companies and a 4g one, 16g, pay 8g
  const theCarry = { theHalfGoldsCarried: 0 };
  const paid = [3, 3, 3, 3, 4].map((theWage) =>
    theWageOfACompanyThisTurn({ theWage, itTookTheWarSpoilsThisTurn: true, theHalfGoldsTheWarSpoilsCarry: theCarry }),
  );
  expect(paid).toEqual([1, 2, 1, 2, 2]);
  // a 1g company pays 1 and leaves the carry as it was
  const theHalfGold = { theHalfGoldsCarried: 0.5 };
  expect(
    theWageOfACompanyThisTurn({
      theWage: 1,
      itTookTheWarSpoilsThisTurn: true,
      theHalfGoldsTheWarSpoilsCarry: theHalfGold,
    }),
  ).toBe(1);
  expect(theHalfGold.theHalfGoldsCarried).toBe(0.5);
});

test("a company's wage under its leader: a beast a Druid halves pays half, rounded down, 1 at the least", () => {
  for (const wage of WAGES)
    for (const itIsABeastADruidHalves of [true, false])
      expect(
        theWageOfACompanyUnderItsLeader({ theWage: wage, itIsABeastADruidHalves }),
        `${String(wage)}, a beast a Druid halves ${String(itIsABeastADruidHalves)}`,
      ).toBe(itIsABeastADruidHalves ? Math.max(1, Math.floor(wage * 0.5)) : wage);
  expect(theWageOfACompanyUnderItsLeader({ theWage: 7, itIsABeastADruidHalves: true })).toBe(3);
  expect(theWageOfACompanyUnderItsLeader({ theWage: 1, itIsABeastADruidHalves: true })).toBe(1);
});

test("a realm's company wages under its Host-Leader: a gold less for each company he saves on, never below nothing", () => {
  for (const wages of WAGES)
    for (let led = 0; led <= 12; led++)
      expect(
        theCompanyWagesUnderTheHostLeader({ theCompanyWages: wages, theCompaniesHeSavesOn: led }),
        `${String(wages)}g, ${String(led)} companies`,
      ).toEqual({ theGoldSaved: Math.min(wages, led), theWagesLeft: Math.max(0, wages - led) });
  expect(theCompanyWagesUnderTheHostLeader({ theCompanyWages: 10, theCompaniesHeSavesOn: 3 })).toEqual({
    theGoldSaved: 3,
    theWagesLeft: 7,
  });
  expect(theCompanyWagesUnderTheHostLeader({ theCompanyWages: 2, theCompaniesHeSavesOn: 5 })).toEqual({
    theGoldSaved: 2,
    theWagesLeft: 0,
  });
});
