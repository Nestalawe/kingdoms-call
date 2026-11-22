// ── The merit a hero holds an Imperial Title by, and the figure a realm holds one by, as its row measures them (B-06n,
// T7, the rules pulled out: its Reckoning and titles family) ────
// Each Imperial Title's row (content's TITLE_DEFS) says how its holder is found: a realm by its figure (the Throne its
// tax base, the Vaultkeeper its treasury), or a hero by his merit (a skill and a count of his deeds, the deeds alone,
// or the magic schools and the items that raise one; the Cartographer's mapped ground in tens). The standings
// (computeStandings, src/engine/titles/reckoning.ts), the title race (titleRaceFor) and the merit each battle credits
// (creditBattle) read them here, so none of them names a title. No hook point of the rule registry: a measure is the
// row's data, read by one function, as a minor title's is (`howTheHolderIsFound`); no title's measure is an effect of
// its own. The hero's skill levels and items are handed in (the engine's `_skillItem` and `activeItems` read them).
import {
  KC_MAGIC_SCHOOLS,
  TITLE_DEFS,
  type AHerosDeedsAnImperialTitleCounts,
  type AnImperialTitleAsItsRowWritesIt,
  type HowAHerosMeritTowardsAnImperialTitleIsMeasured,
  type TheFigureAnImperialTitleOfTheRealmIsHeldBy,
} from '../../content/kingdoms-call-data.ts';

/** A hero as the Imperial Titles measure him: his level of a skill as the titles count it (trained and raised by the
 *  items he uses, 0 to 9), the counts of his deeds (a count not yet written is none), and the number of items he uses
 *  that raise a magic school (each asked only by a title whose measure reads it). */
export interface AHeroAsTheImperialTitlesMeasureHim {
  readonly hisLevelOf: (theSkill: string) => number;
  readonly hisDeeds: Readonly<Partial<Record<AHerosDeedsAnImperialTitleCounts, number>>>;
  readonly theItemsHeUsesThatRaiseAMagicSchool: () => number;
}

/** A hero's merit towards an Imperial Title, as its row measures it: his skill's level plus his deeds (in tens where
 *  the row divides them, rounded down), his deeds alone, or his levels in the five magic schools, in their order, plus
 *  the items he uses that raise one. */
export function theMeritAHeroHasTowardsAnImperialTitle(
  how: HowAHerosMeritTowardsAnImperialTitleIsMeasured,
  him: AHeroAsTheImperialTitlesMeasureHim,
): number {
  switch (how.theMeasure) {
    case 'his level of a skill and his deeds': {
      const theDeeds = Number(him.hisDeeds[how.theDeeds]) || 0;
      return (
        him.hisLevelOf(how.theSkill) +
        (how.theDeedsAreDividedBy === undefined ? theDeeds : Math.floor(theDeeds / how.theDeedsAreDividedBy))
      );
    }
    case 'his deeds':
      return Number(him.hisDeeds[how.theDeeds]) || 0;
    case 'his levels in the magic schools and the items he uses that raise one':
      return (
        KC_MAGIC_SCHOOLS.reduce((theLevels, theSchool) => theLevels + him.hisLevelOf(theSchool), 0) +
        him.theItemsHeUsesThatRaiseAMagicSchool()
      );
  }
}

/** The figures (one for each realm, at its seat) an Imperial Title of the realm is held by, of the two handed: the
 *  realms' tax bases or their treasuries. */
export function theFiguresAnImperialTitleOfTheRealmIsHeldBy<TheFigures>(
  theFigure: TheFigureAnImperialTitleOfTheRealmIsHeldBy,
  figures: { readonly theTaxBases: TheFigures; readonly theTreasuries: TheFigures },
): TheFigures {
  switch (theFigure) {
    case 'its tax base':
      return figures.theTaxBases;
    case 'its treasury':
      return figures.theTreasuries;
  }
}

/** The count of deeds a battle's merit is credited to (creditBattle: the winner gains the loser's losses, the loser is
 *  docked his own), by where it is fought: the first title's, in the rows' order, whose measure counts the battles
 *  fought there. */
export function theDeedsABattlesMeritIsCreditedTo(
  where: 'on land' | 'at sea',
  titles: readonly AnImperialTitleAsItsRowWritesIt[] = TITLE_DEFS,
): AHerosDeedsAnImperialTitleCounts {
  for (const t of titles) {
    const how = t.howTheHolderIsFound;
    if (
      how.theHolder === 'a hero' &&
      how.theMeasure === 'his level of a skill and his deeds' &&
      how.theBattlesItsDeedsCount === where
    )
      return how.theDeeds;
  }
  throw new TypeError(`no Imperial Title counts the merit of a battle fought ${where}`);
}
