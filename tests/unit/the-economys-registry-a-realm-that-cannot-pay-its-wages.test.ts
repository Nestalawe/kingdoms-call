// The economy's registry, a realm that can't pay its wages (B-06e): each runner of its three stages of turnEnd gives
// what Early Winter wrote inline before, on every case. The line to disband: two companies compare as Early Winter's
// sort compared them (the dead after the living, then the grades in their order, a company of no known grade as
// Average, then the die each drew), over every pair of companies of every kind, grade and die; so a skeleton goes last,
// and a tie of kind and grade goes to the lower die. A company spared: a ship that still carries troops at open sea,
// and no other (whether it carries them is never asked of a company that isn't a ship). An unpaid hero deserts on a die
// above 0.4, and his loyalty holds on one at or below it. Each old line is written here as it was.
// Level 1 (unit): the runners are functions on plain values; a static test can't run them, and Early Winter's cases
// (tests/lib/early-winter-cases.ts, tests/unit/early-winter-called-directly.test.ts) hold the caller and its dice.
import { expect, test } from 'vitest';
import {
  aCompanyIsSparedDisbandingUnpaid,
  anUnpaidHeroDeserts,
  theOrderOfTwoCompaniesInTheLineToDisbandUnpaid,
  theRanksOfACompanyInTheLineToDisbandUnpaid,
} from '../../src/engine/rules/the-registry-of-the-economys-rules.ts';

const QUALITY_TIERS = ['Green', 'Average', 'Veteran', 'Crack', 'Elite'];
const GRADES = [...QUALITY_TIERS, 'Regular', ''];
const DICE = [0, 0.1, 0.4, 0.5, 0.99];

/** A company as Early Winter decorated it for its line: whether it is of the dead, its grade, its die. */
interface Company {
  readonly dead: boolean;
  readonly quality: string;
  readonly r: number;
}
const EVERY_COMPANY: Company[] = [true, false].flatMap((dead) =>
  GRADES.flatMap((quality) => DICE.map((r) => ({ dead, quality, r }))),
);

/** Early Winter's comparator, as it was written. */
function theOldOrder(x: Company, y: Company): number {
  const _qRank = (a: Company) => {
    const i = QUALITY_TIERS.indexOf(a.quality);
    return i < 0 ? 1 : i;
  }; // unknown quality ≈ Average
  const d = (a: Company) => ({ skel: a.dead ? 1 : 0, q: _qRank(a), r: a.r });
  const [dx, dy] = [d(x), d(y)];
  return dx.skel - dy.skel || dx.q - dy.q || dx.r - dy.r;
}
const decorated = (a: Company) => ({
  theRanks: theRanksOfACompanyInTheLineToDisbandUnpaid({ itIsOfTheDead: a.dead, itsGrade: a.quality }),
  theDie: a.r,
});

test("the line to disband unpaid: two companies compare as Early Winter's sort compared them, over every pair", () => {
  let pairs = 0;
  for (const x of EVERY_COMPANY)
    for (const y of EVERY_COMPANY) {
      pairs += 1;
      expect(
        theOrderOfTwoCompaniesInTheLineToDisbandUnpaid(decorated(x), decorated(y)),
        `${JSON.stringify(x)} against ${JSON.stringify(y)}`,
      ).toBe(theOldOrder(x, y));
    }
  expect(pairs).toBe(70 * 70);
  // the whole line, sorted both ways, in the same order
  const line = [...EVERY_COMPANY].reverse();
  expect(
    [...line]
      .map((a) => ({ a, ...decorated(a) }))
      .sort(theOrderOfTwoCompaniesInTheLineToDisbandUnpaid)
      .map((x) => x.a),
  ).toEqual([...line].sort(theOldOrder));
});

test('the line to disband unpaid: the dead go last, the rawest first, a company of no known grade as Average, a tie to the lower die', () => {
  const order = (x: Company, y: Company) => theOrderOfTwoCompaniesInTheLineToDisbandUnpaid(decorated(x), decorated(y));
  // a Green skeleton goes after an Elite living company, whatever their dice
  expect(order({ dead: true, quality: 'Green', r: 0 }, { dead: false, quality: 'Elite', r: 0.99 })).toBeGreaterThan(0);
  // among the living, a Green company before a Veteran one
  expect(order({ dead: false, quality: 'Green', r: 0.99 }, { dead: false, quality: 'Veteran', r: 0 })).toBeLessThan(0);
  // a company of no known grade ranks with the Average
  expect(theRanksOfACompanyInTheLineToDisbandUnpaid({ itIsOfTheDead: false, itsGrade: 'Regular' })).toEqual([0, 1]);
  expect(theRanksOfACompanyInTheLineToDisbandUnpaid({ itIsOfTheDead: true, itsGrade: 'Elite' })).toEqual([1, 4]);
  // two Green companies: the lower die goes first; the same die, neither
  expect(order({ dead: false, quality: 'Green', r: 0.1 }, { dead: false, quality: 'Green', r: 0.5 })).toBeLessThan(0);
  expect(order({ dead: false, quality: 'Green', r: 0.5 }, { dead: false, quality: 'Green', r: 0.1 })).toBeGreaterThan(
    0,
  );
  expect(order({ dead: false, quality: 'Green', r: 0.5 }, { dead: false, quality: 'Green', r: 0.5 })).toBe(0);
});

test('a company spared disbanding unpaid: a ship still carrying troops at open sea, and no other; a company that is no ship is never asked', () => {
  for (const itIsAShip of [true, false])
    for (const carries of [true, false]) {
      let asked = 0;
      const spared = aCompanyIsSparedDisbandingUnpaid({
        itIsAShip,
        itCarriesTroopsAtOpenSea: () => {
          asked += 1;
          return carries;
        },
      });
      expect(spared, `a ship ${String(itIsAShip)}, carrying ${String(carries)}`).toBe(itIsAShip && carries);
      expect(asked, `a ship ${String(itIsAShip)}: asked whether it carries`).toBe(itIsAShip ? 1 : 0);
    }
});

test('an unpaid hero deserts on a die above 0.4; his loyalty holds on one at or below it', () => {
  const dice = [
    0,
    0.1,
    0.39,
    0.3999999,
    0.4,
    0.4000001,
    0.41,
    0.6,
    0.99,
    ...Array.from({ length: 101 }, (_, i) => i / 100),
  ];
  for (const theDie of dice) expect(anUnpaidHeroDeserts({ theDie }), `the die ${String(theDie)}`).toBe(theDie > 0.4);
  expect(anUnpaidHeroDeserts({ theDie: 0.4 })).toBe(false);
  expect(anUnpaidHeroDeserts({ theDie: 0.41 })).toBe(true);
});
