// A realm's alignment's abilities (plan P1-19's alignment abilities family, row P1-19at1): one row per ability, keyed by
// its slug, giving the alignment that holds it, how it is used (always on, a king's order or a hero's order) and the
// numbers the books state for it, each with how and where the books write it. The alignment abilities' registry
// (src/engine/rules/the-registry-of-alignment-abilities.ts) has one entry for each row and no other: a row with no
// entry, or an entry with no row, fails to compile. A row's key is unique against the discoveries' names (a test reads
// it), and the five alignment orders' keys stay free for their rows (`consecrate`, `call-to-arms`, `broker`,
// `harvest-the-field`, `perform-rite`: today in alignment-orders-their-keys-names-creeds-numbers-and-words.ts). The
// words test (tests/static/each-alignment-orders-name-creed-and-numbers-are-in-the-books-as-its-row-says.test.ts)
// reads each row's numbers against the rulebook's creed section, gold paragraph and orders table, the intro's table, and the player
// page's two texts of its creed (the turn report's summary, the join form's description). How to add an ability:
// docs/architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md.
import type { KC_ALIGNMENTS } from './kingdoms-call-data.ts';

/** How the books write a number of an ability: as it is (2 as `2`), as a word (2 as `two`), the turns something lasts
 *  beyond this one as the turn it lasts until (1 as `the following turn`), or a share as a percentage (20 as `20%`). */
export type HowTheBooksWriteAnAlignmentAbilitysNumber =
  'as it is' | 'as a word' | 'as the turn it lasts until' | 'as a percentage';

/** A number the books state for an ability: its value, how the books write it, and the words around it where they state
 *  it (`{N}` the value as written; the words as a reader sees them, without the page's markup). */
export interface ANumberOfAnAlignmentAbility {
  readonly value: number;
  readonly writtenAs: HowTheBooksWriteAnAlignmentAbilitysNumber;
  /** In the ability's own entry of its creed's section in the rulebook ("The Seven Alignments"). */
  readonly inItsCreedsSection: string;
  /** In the rulebook's paragraph on gold ("Your gold comes chiefly…"), where it states it. */
  readonly inTheRulebooksParagraphOnGold?: string;
  /** In its order's row of the rulebook's orders table ("Your alignment's signature action"), where it states it. */
  readonly inTheRulebooksOrdersTable?: string;
  /** In its creed's row of the intro's table "The seven alignments", where it states it. */
  readonly inTheIntrosTable?: string;
  /** In its creed's summary on the player's turn report (the report's `ALIGNMENT_SUMMARIES`), where it states it. */
  readonly inTheReportsSummary?: string;
  /** In its creed's description on the join form (the alignment's `DESCS`, its bold marks dropped), where it states it. */
  readonly inTheJoinForm?: string;
}

/** What every row gives: the alignment whose realms hold it, and the numbers the books state for it, by what each is. */
interface WhatEveryAlignmentAbilityGives {
  readonly alignment: (typeof KC_ALIGNMENTS)[number];
  readonly theNumbers: Readonly<Record<string, ANumberOfAnAlignmentAbility>>;
}

/** An ability its realms hold without an order: it acts at its stages whenever they are reached. */
interface AnAlignmentAbilityAlwaysOn extends WhatEveryAlignmentAbilityGives {
  readonly howItIsUsed: 'always on';
}

/** An ability given as an order: by the king alone, or by any hero of the realm. No row is one yet (row P1-19aw1 moves
 *  the five alignment orders here). */
interface AnAlignmentAbilityGivenAsAnOrder extends WhatEveryAlignmentAbilityGives {
  readonly howItIsUsed: "a king's order" | "a hero's order";
  /** The key the turn dispatches the order by (an order's `action`, as the bots write it). */
  readonly key: string;
  /** Its name as the books and the order form write it. */
  readonly name: string;
  /** The other names the turn reads for it (besides its key and its name), lower case, as an older form wrote them. */
  readonly theOtherNamesTheTurnReads: readonly string[];
}

/** A row: what the turn, the report and the books read of one ability, by how it is used. */
export type AnAlignmentAbility = AnAlignmentAbilityAlwaysOn | AnAlignmentAbilityGivenAsAnOrder;

/** The alignment abilities the registry holds, by slug. */
export const ALIGNMENT_ABILITIES = {
  // a Neutral realm's trade: a share of its provinces' tax income, rounded down (the books call it its trade, or its
  // trade bonus; the turn's line "Neutral trade bonus")
  'neutral-trade': {
    howItIsUsed: 'always on',
    alignment: 'Neutral',
    theNumbers: {
      theShareOfTheProvincesIncome: {
        value: 20,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'Trade: province tax income is +{N}',
        inTheRulebooksParagraphOnGold: 'Neutral realms add a +{N} trade bonus (rounded down)',
        inTheIntrosTable: '+{N} tax',
        inTheReportsSummary: 'Province tax income flows {N} richer',
        inTheJoinForm: '+{N} tax from every province',
      },
    },
  },
  // a Divine realm's consecrated ground prospers: a province its consecration list holds pays a share more tax, rounded
  // (the books give it no name: "+50% tax"; the turn's line "from consecrated ground"). Gated by the consecration list,
  // not by the alignment: only a Divine king consecrates, so no other realm holds one
  'consecrated-ground-tax': {
    howItIsUsed: 'always on',
    alignment: 'Divine',
    theNumbers: {
      theShareMoreTax: {
        value: 50,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'Consecrated ground gives +{N} tax',
        inTheRulebooksOrdersTable: '+{N} tax, stauncher defenders',
        inTheIntrosTable: '+{N} tax and holy ground',
        inTheReportsSummary: 'Consecrated ground yields +{N} tax',
        inTheJoinForm: 'Consecrate provinces: +{N} tax',
      },
    },
  },
} as const satisfies Readonly<Record<string, AnAlignmentAbility>>;

/** An ability's slug: a key of the rows. */
export type AlignmentAbilitySlug = keyof typeof ALIGNMENT_ABILITIES;
