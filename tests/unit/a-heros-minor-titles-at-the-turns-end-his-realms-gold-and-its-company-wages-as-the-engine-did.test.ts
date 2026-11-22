// A hero's minor titles at the turn's end, as the engine did (B-06m): Early Winter's collection and wages, and the
// report's forecast, asked by the title's key whether a hero held the Cutpurse, the Champion of the People or the
// Castellan (each paying its rule of the economy's gold) and the Host-Leader (who cuts the company wages). Which title
// gives each is now the minor titles' registry's, two stages of turnEnd, each entry naming its rule of the economy.
// - The gold: for each title a hero may hold alone (and none), each rule of the economy's stage of a minor title's gold
//   is his realm's exactly where the old lines gave it (the Cutpurse's gold for the Cutpurse, and so on), and whether
//   he holds a title is asked only of the title whose entry names the rule.
// - The cut: he cuts his realm's company wages exactly where he holds the Host-Leader, asked of the Host-Leader alone.
// - The entries: each title's gold names a rule of the economy's stage of a minor title's gold, each such rule named by
//   one title, and the Host-Leader's cut a rule of the economy's stage of the Host-Leader's cut.
// Early Winter's own cases (tests/lib/early-winter-cases.ts: the Champion of the People alone, the Host-Leader on a
// company of 1g) and the report's (tests/unit/realm-reports.test.ts: the Host-Leader of another realm, titles not yet
// public) hold the callers.
// Level 1 (unit): the runners are functions of what they are handed; a static test can't run them, and the matrix may
// never give a realm a lone Champion of the People. No die is drawn.
import { expect, test } from 'vitest';
import {
  MINOR_TITLES,
  type AMinorTitlesSlug,
} from '../../src/content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import { THE_ORDER_OF_EACH_STAGE_OF_THE_ECONOMY } from '../../src/engine/rules/the-registry-of-the-economys-rules.ts';
import {
  aHerosTitlesCutHisRealmsCompanyWages,
  heHoldsAMinorTitleThatGivesHisRealmTheGold,
  THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES,
  THE_REGISTRY_OF_THE_MINOR_TITLES_PERKS,
} from '../../src/engine/rules/the-registry-of-the-minor-titles-perks.ts';

/** The old lines: the title whose key Early Winter and the report checked for each rule of the economy's gold. */
const THE_TITLE_EACH_GOLD_WAS_CHECKED_BY: Readonly<Record<string, string>> = {
  'the-cutpurses-gold': 'cutpurse',
  'the-champion-of-the-peoples-gold': 'champion',
  'the-castellans-gold': 'castellan',
};
const THE_GOLDS =
  THE_ORDER_OF_EACH_STAGE_OF_THE_ECONOMY.turnEnd["a realm's gold beyond its tax from a hero's minor title"];
const EACH_TITLE_ALONE_OR_NONE: readonly (AMinorTitlesSlug | null)[] = [null, ...MINOR_TITLES.map((row) => row.key)];

/** Whether a hero holds a title, holding `held` alone (or none), and each title he was asked of, in order. */
const aHeroHolding = (held: AMinorTitlesSlug | null) => {
  const asked: AMinorTitlesSlug[] = [];
  return {
    asked,
    heHoldsTheTitle: (theTitle: AMinorTitlesSlug) => {
      asked.push(theTitle);
      return theTitle === held;
    },
  };
};

test("the gold: each rule of a minor title's gold is his realm's where he holds the title the old line checked, asked of that title alone", () => {
  expect(THE_GOLDS, "the economy's stage of a minor title's gold").toEqual(
    Object.keys(THE_TITLE_EACH_GOLD_WAS_CHECKED_BY),
  );
  for (const held of EACH_TITLE_ALONE_OR_NONE)
    for (const theGold of THE_GOLDS) {
      const hero = aHeroHolding(held);
      const why = `${String(held)} held, ${theGold}`;
      expect(heHoldsAMinorTitleThatGivesHisRealmTheGold(theGold, hero.heHoldsTheTitle), why).toBe(
        held === THE_TITLE_EACH_GOLD_WAS_CHECKED_BY[theGold],
      );
      expect(hero.asked, `the titles asked: ${why}`).toEqual([THE_TITLE_EACH_GOLD_WAS_CHECKED_BY[theGold]]);
    }
});

test("the cut: he cuts his realm's company wages where he holds the Host-Leader, asked of the Host-Leader alone", () => {
  for (const held of EACH_TITLE_ALONE_OR_NONE) {
    const hero = aHeroHolding(held);
    expect(aHerosTitlesCutHisRealmsCompanyWages(hero.heHoldsTheTitle), `${String(held)} held`).toBe(
      held === 'hostleader',
    );
    expect(hero.asked, `the titles asked: ${String(held)} held`).toEqual(['hostleader']);
  }
});

test("the entries: each title's gold and cut names a rule of the economy's matching stage, each gold rule named once", () => {
  const theTitlesGolds = THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES.turnEnd[
    "a hero's titles give his realm gold beyond its tax"
  ].map((slug) => [
    slug,
    THE_REGISTRY_OF_THE_MINOR_TITLES_PERKS[slug].turnEnd["a hero's titles give his realm gold beyond its tax"](),
  ]);
  expect(theTitlesGolds).toEqual(
    Object.entries(THE_TITLE_EACH_GOLD_WAS_CHECKED_BY).map(([gold, title]) => [title, gold]),
  );
  const theCuts = THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES.turnEnd[
    "a hero's titles cut his realm's company wages"
  ].map((slug) =>
    THE_REGISTRY_OF_THE_MINOR_TITLES_PERKS[slug].turnEnd["a hero's titles cut his realm's company wages"](),
  );
  expect(theCuts).toEqual(
    THE_ORDER_OF_EACH_STAGE_OF_THE_ECONOMY.turnEnd["a realm's company wages under its Host-Leader"],
  );
});
