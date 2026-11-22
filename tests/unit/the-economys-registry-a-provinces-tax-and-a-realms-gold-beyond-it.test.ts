// The economy's registry, a province's tax and a realm's gold beyond it (B-06c): each runner of its five stages of
// turnEnd gives what Early Winter's collection and the report's forecast wrote inline before, on every case. A
// province's tax this turn: an Earthquake or a Sabotage of this turn leaves nothing, a Bless of this turn its own
// measure (×1.6 where it recorded none, or a measure of 0), rounded, in that order, and a mark of another turn counts
// for nothing; while a mark lasts: an enslaved province that still resents it a gold less, never below nothing; from the
// realm's Wonder: 2 more on a province that keeps a garrison while the Free City Charter stands (asked once a province);
// a hero's minor titles: the Cutpurse's 2, the Champion of the People's 2, the Castellan's gold for every 5 provinces
// rounded down (none below 5, the provinces asked only of the Castellan), in that order, which title gives each asked of
// the minor titles' registry (B-06m) as the turn asks it; a hero's mastery: the Thief network's 5. Each old line is written here as it was, and the runner is compared with it.
// Level 1 (unit): the runners are functions on plain values; a static test can't run them, and Early Winter's cases
// (tests/lib/early-winter-cases.ts) and the report's (tests/unit/realm-reports.test.ts) hold the callers.
import { expect, test } from 'vitest';
import {
  theGoldAHerosMasteriesAddBeyondTheTax,
  theGoldAHerosMinorTitlesAddBeyondTheTax,
  theTaxOfAProvinceFromTheRealmsWonder,
  theTaxOfAProvinceThisTurn,
  theTaxOfAProvinceWhileAMarkLasts,
} from '../../src/engine/rules/the-registry-of-the-economys-rules.ts';
import { heHoldsAMinorTitleThatGivesHisRealmTheGold } from '../../src/engine/rules/the-registry-of-the-minor-titles-perks.ts';

const TAXES = Array.from({ length: 41 }, (_, i) => i);
const THE_TURN = 7;
const TURNS = [undefined, THE_TURN - 1, THE_TURN, THE_TURN + 1];
const MEASURES = [undefined, 0, 1.6, 1.8, 2, 2.2];

test("a province's tax this turn: an Earthquake's or a Sabotage's nothing, then a Bless's measure, rounded, as Early Winter wrote it", () => {
  for (const tax of TAXES)
    for (const _earthquakeNoTax of TURNS)
      for (const _sabotagedForTurn of TURNS)
        for (const _blessedTurn of TURNS)
          for (const _blessedMult of MEASURES) {
            const pv = { _earthquakeNoTax, _sabotagedForTurn, _blessedTurn, _blessedMult };
            let t = tax;
            if (pv._earthquakeNoTax === THE_TURN) t = 0;
            if (pv._sabotagedForTurn === THE_TURN) t = 0;
            if (pv._blessedTurn === THE_TURN) t = Math.round(t * (Number(pv._blessedMult) || 1.6));
            expect(
              theTaxOfAProvinceThisTurn({ theTax: tax, theTurn: THE_TURN, theProvince: pv }),
              `${String(tax)}, ${JSON.stringify(pv)}`,
            ).toBe(t);
          }
  expect(theTaxOfAProvinceThisTurn({ theTax: 5, theTurn: THE_TURN, theProvince: {} })).toBe(5);
  expect(theTaxOfAProvinceThisTurn({ theTax: 5, theTurn: THE_TURN, theProvince: { _blessedTurn: THE_TURN } })).toBe(8);
});

test("a province's tax while a mark lasts: an enslaved province that still resents it a gold less, never below nothing", () => {
  for (const tax of TAXES)
    for (const itStillResentsItsEnslavement of [true, false])
      expect(
        theTaxOfAProvinceWhileAMarkLasts({ theTax: tax, itStillResentsItsEnslavement }),
        `${String(tax)}, ${String(itStillResentsItsEnslavement)}`,
      ).toBe(itStillResentsItsEnslavement ? Math.max(0, tax - 1) : tax);
  expect(theTaxOfAProvinceWhileAMarkLasts({ theTax: 0, itStillResentsItsEnslavement: true })).toBe(0);
});

test("a province's tax from the realm's Wonder: 2 more on a garrisoned province while the Free City Charter stands, the Charter asked once", () => {
  for (const tax of TAXES)
    for (const itKeepsAGarrison of [true, false])
      for (const stands of [true, false]) {
        let asked = 0;
        const theFreeCityCharterStands = () => {
          asked += 1;
          return stands;
        };
        expect(
          theTaxOfAProvinceFromTheRealmsWonder({ theTax: tax, itKeepsAGarrison, theFreeCityCharterStands }),
          `${String(tax)}, garrison ${String(itKeepsAGarrison)}, the Charter ${String(stands)}`,
        ).toBe(stands && itKeepsAGarrison ? tax + 2 : tax);
        expect(asked, 'the Charter asked once, first, as gdActive was').toBe(1);
      }
});

test("a hero's minor titles: the Cutpurse's 2, the Champion of the People's 2 and the Castellan's gold for every 5 provinces, rounded down, in that order", () => {
  for (const heHoldsTheCutpurse of [true, false])
    for (const heHoldsTheChampionOfThePeople of [true, false])
      for (const heHoldsTheCastellan of [true, false])
        for (let provinces = 0; provinces <= 31; provinces += 1) {
          let asked = 0;
          const theProvincesHisRealmHolds = () => {
            asked += 1;
            return provinces;
          };
          const was: [string, number][] = [];
          if (heHoldsTheCutpurse) was.push(['the-cutpurses-gold', 2]);
          if (heHoldsTheChampionOfThePeople) was.push(['the-champion-of-the-peoples-gold', 2]);
          if (heHoldsTheCastellan) {
            const cg = Math.floor(provinces / 5);
            if (cg > 0) was.push(['the-castellans-gold', cg]);
          }
          const held: Readonly<Record<string, boolean>> = {
            cutpurse: heHoldsTheCutpurse,
            champion: heHoldsTheChampionOfThePeople,
            castellan: heHoldsTheCastellan,
          };
          const why = `${String(heHoldsTheCutpurse)}, ${String(heHoldsTheChampionOfThePeople)}, ${String(heHoldsTheCastellan)}, ${String(provinces)}`;
          expect(
            theGoldAHerosMinorTitlesAddBeyondTheTax({
              heHoldsATitleThatGivesIt: (theGold) =>
                heHoldsAMinorTitleThatGivesHisRealmTheGold(theGold, (theTitle) => held[theTitle] ?? false),
              theProvincesHisRealmHolds,
            }),
            why,
          ).toEqual(was);
          expect(asked, `the provinces asked of the Castellan alone: ${why}`).toBe(heHoldsTheCastellan ? 1 : 0);
        }
});

test("a hero's mastery: the Thief network's 5, else nothing", () => {
  expect(theGoldAHerosMasteriesAddBeyondTheTax({ heHoldsTheThiefNetwork: true })).toBe(5);
  expect(theGoldAHerosMasteriesAddBeyondTheTax({ heHoldsTheThiefNetwork: false })).toBe(0);
});
