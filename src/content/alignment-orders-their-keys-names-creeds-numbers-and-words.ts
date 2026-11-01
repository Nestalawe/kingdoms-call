// The alignment orders (plan P1-19's alignment orders, Decision 2): one row per order, keyed by its slug, in the order
// of ALIGNMENT_ORDER_KEYS (src/engine/army-tables.ts, built from these rows): the key the turn dispatches it by, its
// name as the books and the order form write it, the other names the turn reads for it, its creed, whether the king
// alone gives it, and the numbers the books state for it, each with how and where the books write it. No registry entry:
// an alignment order is an order, not an effect at a hook point; its resolver is its rule, and reads its row. The
// engine checks each row's key is a kind of order (army-tables.ts). The words test
// (tests/static/each-alignment-orders-name-creed-and-numbers-are-in-the-books-as-its-row-says.test.ts) reads each row
// against the rulebook's orders table and creed sections and the intro's table. The removed orders (Awaken the Wild and
// Call from the Pit, 2026-10-12) have no row: the turn keeps their refusal. The player page doesn't import this file.
import type { KC_ALIGNMENTS, KC_QUALITY_TIERS } from './kingdoms-call-data.ts';

/** How the books write a number of an order: as it is (2 as `2`, a grade as its name), as a word (2 as `two`), or the
 *  turns something lasts beyond this one as the turn it lasts until (1 as `the following turn`). */
export type HowTheBooksWriteAnOrdersNumber = 'as it is' | 'as a word' | 'as the turn it lasts until';

/** A number the books state for an order: its value, how the books write it, and the words around it where they
 *  state it (`{N}` the value as written; the words as a reader sees them, without the page's markup). */
export interface ANumberOfAnAlignmentOrder {
  readonly value: number | (typeof KC_QUALITY_TIERS)[number];
  readonly writtenAs: HowTheBooksWriteAnOrdersNumber;
  /** In the order's own entry of its creed's section in the rulebook ("The Seven Alignments"). */
  readonly inItsCreedsSection: string;
  /** In the order's cell of the intro's table "The seven alignments", where it states the number. */
  readonly inTheIntrosTable?: string;
}

/** A row: what the turn, the bots, the report and the books read of one alignment order. */
export interface AnAlignmentOrder {
  /** The key the turn dispatches the order by (an order's `action`, as the bots write it). */
  readonly key: string;
  /** Its name as the books and the order form write it. */
  readonly name: string;
  /** The other names the turn reads for it (besides its key and its name), lower case, as an older form wrote them. */
  readonly theOtherNamesTheTurnReads: readonly string[];
  /** The creed whose realms alone may give it. */
  readonly creed: (typeof KC_ALIGNMENTS)[number];
  /** Whether the king alone gives it (the books mark it "king"). */
  readonly theKingAlone: boolean;
  /** The numbers the books state for it, by what each is. */
  readonly theNumbers: Readonly<Record<string, ANumberOfAnAlignmentOrder>>;
}

/** The alignment orders, by slug, in the order of ALIGNMENT_ORDER_KEYS. */
export const THE_ALIGNMENT_ORDERS = {
  consecrate: {
    key: 'consecrate',
    name: 'Consecrate',
    theOtherNamesTheTurnReads: ['consecrate province'],
    creed: 'Divine',
    theKingAlone: true,
    theNumbers: {},
  },
  'call-to-arms': {
    key: 'call_to_arms',
    name: 'Call to Arms',
    theOtherNamesTheTurnReads: [],
    creed: 'Good',
    theKingAlone: true,
    theNumbers: {
      // the grade a mustered company has, unless the realm's discoveries raise it (Muster Rolls)
      theGradeMustered: { value: 'Green', writtenAs: 'as it is', inItsCreedsSection: 'a free {N} garrison unit' },
    },
  },
  broker: {
    key: 'broker',
    name: 'Broker',
    theOtherNamesTheTurnReads: [],
    creed: 'Neutral',
    theKingAlone: true,
    theNumbers: {
      thePriceOfWordFromAProvince: { value: 2, writtenAs: 'as it is', inItsCreedsSection: 'has ever seen for {N}g' },
    },
  },
  'harvest-the-field': {
    key: 'harvest_field',
    name: 'Harvest the Field',
    theOtherNamesTheTurnReads: [],
    creed: 'Undead',
    theKingAlone: false,
    theNumbers: {
      // the carters' price, less with the realm's discoveries (Corpse-Carters), never below nothing
      thePrice: {
        value: 2,
        writtenAs: 'as it is',
        inItsCreedsSection: 'as a Skeletal unit for {N}g',
        inTheIntrosTable: 'from a grave for {N} gold',
      },
    },
  },
  'perform-rite': {
    key: 'rite',
    name: 'Perform Rite',
    theOtherNamesTheTurnReads: [],
    creed: 'Pagan',
    theKingAlone: false,
    theNumbers: {
      theWildHuntsBeasts: { value: 2, writtenAs: 'as a word', inItsCreedsSection: 'the Wild Hunt binds {N} of' },
      // the turns the bound beasts serve beyond this one, more with the realm's discoveries
      theWildHuntsTurnsMore: {
        value: 1,
        writtenAs: 'as the turn it lasts until',
        inItsCreedsSection: 'serve until the end of {N}',
      },
      theBloodOfferingsGrades: { value: 2, writtenAs: 'as it is', inItsCreedsSection: 'by +{N} quality tiers' },
    },
  },
} as const satisfies Readonly<Record<string, AnAlignmentOrder>>;
