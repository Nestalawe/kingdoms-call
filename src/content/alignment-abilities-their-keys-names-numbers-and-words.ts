// A realm's alignment's abilities (plan P1-19's alignment abilities family, row P1-19at1): one row per ability, keyed by
// its slug, giving the alignment that holds it, how it is used (always on, a king's order or a hero's order) and the
// numbers the books state for it, each with how and where the books write it. The alignment abilities' registry
// (src/engine/rules/the-registry-of-alignment-abilities.ts) has one entry for each row and no other: a row with no
// entry, or an entry with no row, fails to compile. A row's key is unique against the discoveries' names (a test reads
// it). Since P1-19aw1 the five alignment orders are rows given as an order (`consecrate`, `call-to-arms`, `broker`,
// `harvest-the-field`, `perform-rite`): each gives the key the turn dispatches it by, its name as the books and the
// order form write it, and the other names the turn reads for it; THE_ALIGNMENT_ORDERS holds them, in the order of
// ALIGNMENT_ORDER_KEYS (src/engine/army-tables.ts, built from them: a key that is no kind of order fails to compile).
// The removed orders (Awaken the Wild and Call from the Pit, 2026-10-12) have no row: the turn keeps their refusal. The
// player page reads the orders' names, alignments and king's marks through src/engine/rules-on-plain-values/the-
// alignment-orders-the-names-the-form-writes-and-who-may-give-each.ts (P1-11d7), as the resolvers' checks do. The
// words test (tests/static/each-alignment-orders-name-creed-and-numbers-are-in-the-books-as-its-row-says.test.ts)
// reads each row's numbers against the rulebook's creed section, gold paragraph and orders table, the intro's table, and the player
// page's two texts of its creed (the turn report's summary, the join form's description), and each order's name, creed
// and king's mark too. How to add an ability: docs/architecture/the-alignment-abilities-registry-its-stages-and-how-to-add-an-ability.md.
import type { KC_ALIGNMENTS, KC_QUALITY_TIERS } from './kingdoms-call-data.ts';

/** How the books write a number of an ability: as it is (2 as `2`), as a word (2 as `two`), the turns something lasts
 *  beyond this one as the turn it lasts until (1 as `the following turn`), a share as a percentage (20 as `20%`), a
 *  factor as a multiplier (1.25 as `×1.25`), how many times as a multiple (2 as `double`), or a share as a fraction
 *  (0.5 as `half`); a grade as its name. */
export type HowTheBooksWriteAnAlignmentAbilitysNumber =
  | 'as it is'
  | 'as a word'
  | 'as the turn it lasts until'
  | 'as a percentage'
  | 'as a multiplier'
  | 'as a multiple'
  | 'as a fraction';

/** A number the books state for an ability: its value, how the books write it, and the words around it where they state
 *  it (`{N}` the value as written; the words as a reader sees them, without the page's markup). */
export interface ANumberOfAnAlignmentAbility {
  readonly value: number | (typeof KC_QUALITY_TIERS)[number];
  readonly writtenAs: HowTheBooksWriteAnAlignmentAbilitysNumber;
  /** In its creed's section in the rulebook ("The Seven Alignments"): its heading or the ability's own entry. */
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
  /** The creeds of the foes it acts against, where the books name them (P1-19au2: the hosts consecrated ground
   *  weakens). */
  readonly theCreedsItActsAgainst?: readonly (typeof KC_ALIGNMENTS)[number][];
}

/** An ability given as an order: by the king alone (the books mark it "king"), or by any hero of the realm; only a
 *  realm of its alignment may give it (P1-19aw1: the five alignment orders). */
export interface AnAlignmentAbilityGivenAsAnOrder extends WhatEveryAlignmentAbilityGives {
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
  // each creed's chance of fanatical zeal: before each battle a side rolls for it, and on a success fights at the
  // strength of zeal (P1-19au1). The books state that strength once among the creeds, in the Divine entry ("zeal = your
  // force fights at ×1.30"), so the Divine row holds it, and every creed's zeal (and a realm of none) fights at it
  'zeal-of-a-divine-realm': {
    howItIsUsed: 'always on',
    alignment: 'Divine',
    theNumbers: {
      theChanceOfZeal: {
        value: 50,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'Fanatical zeal {N}',
        inTheIntrosTable: 'Divine {N}',
        inTheReportsSummary: 'Your armies fight with a {N} chance of fanatical zeal',
        inTheJoinForm: '({N} chance your host fights fanatically)',
      },
      theStrengthOfZeal: {
        value: 1.3,
        writtenAs: 'as a multiplier',
        inItsCreedsSection: 'zeal = your force fights at {N}0 for that battle',
      },
    },
  },
  'zeal-of-a-good-realm': {
    howItIsUsed: 'always on',
    alignment: 'Good',
    theNumbers: {
      theChanceOfZeal: {
        value: 40,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'Fanatical zeal {N}',
        inTheIntrosTable: 'Good {N}',
        inTheReportsSummary: 'Your armies fight with a solid {N} chance of fanaticism',
      },
    },
  },
  'zeal-of-a-druidic-realm': {
    howItIsUsed: 'always on',
    alignment: 'Druidic',
    theNumbers: {
      theChanceOfZeal: {
        value: 20,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'Fanatical zeal {N}',
        inTheIntrosTable: 'Druidic {N}',
        inTheReportsSummary: 'Your armies fight with a {N} chance of fanaticism',
      },
    },
  },
  'zeal-of-a-neutral-realm': {
    howItIsUsed: 'always on',
    alignment: 'Neutral',
    theNumbers: {
      theChanceOfZeal: {
        value: 10,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'Fanatical zeal {N}',
        inTheIntrosTable: 'Neutral {N}',
        inTheReportsSummary: 'Your armies fight with a {N} chance of fanaticism',
      },
    },
  },
  'zeal-of-a-pagan-realm': {
    howItIsUsed: 'always on',
    alignment: 'Pagan',
    theNumbers: {
      theChanceOfZeal: {
        value: 15,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'Fanatical zeal {N}',
        inTheIntrosTable: 'Pagan {N}',
        inTheReportsSummary: 'Your armies fight with a {N} chance of fanaticism',
      },
    },
  },
  'zeal-of-an-evil-realm': {
    howItIsUsed: 'always on',
    alignment: 'Evil',
    theNumbers: {
      theChanceOfZeal: {
        value: 25,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'Fanatical zeal {N}',
        inTheIntrosTable: 'Evil {N}',
        inTheReportsSummary: 'Your armies fight with a {N} base chance of fanaticism',
      },
    },
  },
  // the Undead's zeal is 0: the books write it in the creed's heading ("zeal 0%"), and its entry "No zeal roll"
  'zeal-of-an-undead-realm': {
    howItIsUsed: 'always on',
    alignment: 'Undead',
    theNumbers: {
      theChanceOfZeal: { value: 0, writtenAs: 'as a percentage', inItsCreedsSection: 'Undead — zeal {N}' },
    },
  },
  // a Divine realm's consecrated ground: a hero defending it, on a province his realm owns, rolls zeal at double the
  // chance, at most certain (P1-19au1). Gated by the consecration list, not by the alignment, as the tax is; no name in
  // the books
  'consecrated-ground-doubles-a-defenders-zeal': {
    howItIsUsed: 'always on',
    alignment: 'Divine',
    theNumbers: {
      theTimesTheChance: {
        value: 2,
        writtenAs: 'as a multiple',
        inItsCreedsSection: 'defenders there roll zeal at {N} chance',
      },
    },
  },
  // an Evil realm's savage fury: a host with any Monster in it fights at a factor, no roll (P1-19au1)
  'savage-fury': {
    howItIsUsed: 'always on',
    alignment: 'Evil',
    theNumbers: {
      theStrengthOfTheHost: {
        value: 1.25,
        writtenAs: 'as a multiplier',
        inItsCreedsSection: 'fights at {N} in every battle',
        inTheIntrosTable: 'a host with a Monster fights {N}',
        inTheReportsSummary: 'a host with any of them in it fights at {N} in every battle',
        inTheJoinForm: 'lifts the whole host to {N} in every battle',
      },
    },
  },
  // an Undead realm's skeletal fervour (its undying fanaticism): a host with any skeletal unit in it fights at a
  // factor under the king in person, and a smaller one under any other commander, no roll (P1-19au1)
  'skeletal-fervour': {
    howItIsUsed: 'always on',
    alignment: 'Undead',
    theNumbers: {
      underTheKing: {
        value: 1.5,
        writtenAs: 'as a multiplier',
        inItsCreedsSection: 'fights at {N} when the King leads it in person',
        inTheIntrosTable: '({N} under the king)',
        inTheReportsSummary: '{N} (+50%) when the king leads them in person',
      },
      underAnyOtherCommander: {
        value: 1.3,
        writtenAs: 'as a multiplier',
        inItsCreedsSection: 'and {N} under any other commander',
        inTheIntrosTable: 'Skeletal hosts fight {N}',
        inTheReportsSummary: '{N} (+30%) under any other commander',
      },
    },
  },
  // a Divine realm's consecrated ground weakens an Undead or Evil host attacking it: the host fights a share weaker
  // (P1-19au2). Gated by the consecration list, as the tax is; the attacker's creed by the row's list. No name in the
  // books (the Evil section states it too, in words no field reads)
  'consecrated-ground-weakens-an-unholy-attacker': {
    howItIsUsed: 'always on',
    alignment: 'Divine',
    theCreedsItActsAgainst: ['Undead', 'Evil'],
    theNumbers: {
      theShareWeaker: {
        value: 15,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'Undead and Evil hosts attacking it fight at −{N}',
        inTheReportsSummary: 'Undead and Evil hosts attacking it fight at −{N}',
      },
    },
  },
  // a Good realm's Righteous Defence: its defenders of a province it owns hold a share stronger (P1-19au2)
  'righteous-defence': {
    howItIsUsed: 'always on',
    alignment: 'Good',
    theNumbers: {
      theShareStronger: {
        value: 10,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'Righteous Defence: any army defending a province you own fights at +{N}',
        inTheIntrosTable: '+{N} when defending your own provinces',
        inTheReportsSummary: 'Righteous Defence: any army defending a province you own fights at +{N}',
        inTheJoinForm: '+{N} strength defending land you own',
      },
    },
  },
  // a Good realm's Banner of Fellowship: its converging columns unite more readily, by percentage points (P1-19au2)
  'banner-of-fellowship': {
    howItIsUsed: 'always on',
    alignment: 'Good',
    theNumbers: {
      thePointsMoreReadily: {
        value: 15,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'allied contingents converging on the same battle unify +{N} more readily',
        inTheReportsSummary: 'allied contingents converging on the same battle unify {N} more readily',
      },
    },
  },
  // a Druidic realm's Home of the Wild: its Creature units fight at a factor in forest and jungle, each rounded; a
  // Druidic commander brings it to any realm's Creatures he leads (P1-19au2)
  'home-of-the-wild': {
    howItIsUsed: 'always on',
    alignment: 'Druidic',
    theNumbers: {
      theStrengthOfACreature: {
        value: 1.5,
        writtenAs: 'as a multiplier',
        inItsCreedsSection: 'Home of the Wild: in forest and jungle your Creature armies fight at {N}',
        inTheIntrosTable: 'Creatures fight {N} in forest and jungle',
        inTheReportsSummary: 'your Creature armies fight at {N} strength',
        inTheJoinForm: 'Creature armies fight at {N} in forest and jungle',
      },
    },
  },
  // an Evil realm's Reign of Fear: its Monster units attacking a province its own Terror still grips fight at a factor,
  // each rounded (P1-19au2)
  'reign-of-fear': {
    howItIsUsed: 'always on',
    alignment: 'Evil',
    theNumbers: {
      theStrengthOfAMonster: {
        value: 1.5,
        writtenAs: 'as a multiplier',
        inItsCreedsSection: 'Reign of Fear: your Monsters fight at {N} when they attack a province',
        inTheIntrosTable: 'Monsters {N} attacking ground under your Terror',
        inTheReportsSummary: 'your Monsters fight at {N} when they attack a province your own Terror still grips',
        inTheJoinForm: 'your Monsters fight {N} attacking ground your Terror grips',
      },
    },
  },
  // an Undead realm's Deathless March: a beaten host of skeletons alone, with no line of retreat, stands and holds the
  // field, and takes no flight losses (P1-19au2). The books state no number for it
  'the-deathless-march': {
    howItIsUsed: 'always on',
    alignment: 'Undead',
    theNumbers: {},
  },
  // a Neutral realm's mercenary discount: a mercenary band costs it gold less than the going rate, never under 1g
  // (P1-19av1; the books give it no name of its own: it is part of the "Cheapest court")
  'the-neutral-mercenary-discount': {
    howItIsUsed: 'always on',
    alignment: 'Neutral',
    theNumbers: {
      theGoldLess: {
        value: 2,
        writtenAs: 'as it is',
        inItsCreedsSection: 'mercenary bands cost {N}g less than the going rate',
        inTheReportsSummary: 'Mercenary bands cost {N}g less to hire than the going rate',
      },
    },
  },
  // a Divine realm's blessing: its casters' Bless Province yields a share of the province's tax value more than other
  // realms' (the spell's own 60%), and its king's in person more still (P1-19av1). Each is the spell's whole yield
  // before the discoveries add theirs, `1 + 80 / 100` and `1 + 100 / 100`, exactly 1.8 and 2 as before
  'the-divine-blessing': {
    howItIsUsed: 'always on',
    alignment: 'Divine',
    theNumbers: {
      byTheRealmsCasters: {
        value: 80,
        writtenAs: 'as a percentage',
        inItsCreedsSection: "Bless Province adds {N} of a province's tax value (others 60%)",
        inTheReportsSummary: "Bless Province adds {N} of a province's tax value rather than 60%",
      },
      byTheKingInPerson: {
        value: 100,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'when the King casts it the province yields +{N}',
        inTheReportsSummary: 'the province yields a full {N} more',
      },
    },
  },
  // a Druidic realm's Creatures follow its heroes with no Druid need, as they follow a Druidic wandering hero (his own
  // creed counts: Decision G). Read by druidNeedWaivedByAlignment, in src/engine/rules-on-plain-values/ (the player
  // portal shares it), so its entry in the registry is empty (P1-19av1). The books state no number for it
  'creatures-follow-without-a-druid': {
    howItIsUsed: 'always on',
    alignment: 'Druidic',
    theNumbers: {},
  },
  // an Evil realm's Monsters follow its heroes with no Druid need, as they follow an Evil wandering hero: the mirror of
  // the Druidic one, read in the same place (P1-19av1). The books state no number for it
  'monsters-follow-without-a-druid': {
    howItIsUsed: 'always on',
    alignment: 'Evil',
    theNumbers: {},
  },
  // a Neutral realm's scholars: each Sage level adds a further share to a Research's chance of a discovery, doubling
  // the base rate (P1-19av1)
  'neutral-scholars': {
    howItIsUsed: 'always on',
    alignment: 'Neutral',
    theNumbers: {
      thePointsASageLevelAdds: {
        value: 5,
        writtenAs: 'as a percentage',
        inItsCreedsSection: 'each Sage level adds a further +{N} discovery chance',
      },
    },
  },
  // Divine grace (P1-19ax1): a Divine realm's slain heroes, its king included, spend a full turn in death and rise at
  // half health on the nearest consecrated province it holds, spending its consecration (the turn's start, 7d); a
  // waiting king is not succeeded while one stays. Gated by the realm's alignment at the death, the succession and the
  // return
  'divine-grace': {
    howItIsUsed: 'always on',
    alignment: 'Divine',
    theNumbers: {
      theFullTurnsInDeath: {
        value: 1,
        writtenAs: 'as a word',
        inItsCreedsSection: 'spends {N} full turn in death',
      },
      theShareOfHealthTheFallenRiseWith: {
        value: 0.5,
        writtenAs: 'as a fraction',
        inItsCreedsSection: 'returns to life at the start of the turn after that, at {N} health',
      },
    },
  },
  // a Divine realm's Rest heals more: the Rest's heal times its factor, rounded up (Medical Arts' full heal goes first)
  'the-divine-rest': {
    howItIsUsed: 'always on',
    alignment: 'Divine',
    theNumbers: {
      theFactorOfTheHeal: { value: 1.5, writtenAs: 'as a multiplier', inItsCreedsSection: 'Rest heals {N}' },
    },
  },
  // a Pagan victor's blood harvest: gold for each enemy unit destroyed (the discoveries add theirs to it: Skull Tithe)
  'blood-harvest': {
    howItIsUsed: 'always on',
    alignment: 'Pagan',
    theNumbers: {
      theGoldForEachFoeDestroyed: {
        value: 1,
        writtenAs: 'as it is',
        inItsCreedsSection: 'Blood Harvest: +{N}g per enemy unit',
      },
    },
  },
  // an Evil hero's conquest doctrine, set on his orders: Terror plunders a share of the province's tax (and a decisive
  // victory under it lays Terror), Enslave presses a free garrison unit and the province pays less tax for some turns
  'plunder-or-enslave': {
    howItIsUsed: 'always on',
    alignment: 'Evil',
    theNumbers: {
      theShareOfTheTaxPlundered: {
        value: 50,
        writtenAs: 'as a percentage',
        inItsCreedsSection: "Terror plunders {N} of the province's tax value",
      },
      theGradeOfTheEnslavedGarrison: {
        value: 'Green',
        writtenAs: 'as it is',
        inItsCreedsSection: 'presses the beaten folk into a free {N} garrison unit',
      },
      theTurnsTheEnslavedProvincePaysLess: {
        value: 3,
        writtenAs: 'as it is',
        inItsCreedsSection: '1g less tax for {N} turns',
      },
    },
  },
  // the five alignment orders (P1-19aw1), each given as an order: a Divine king consecrates a province
  consecrate: {
    howItIsUsed: "a king's order",
    alignment: 'Divine',
    key: 'consecrate',
    name: 'Consecrate',
    theOtherNamesTheTurnReads: ['consecrate province'],
    theNumbers: {},
  },
  'call-to-arms': {
    howItIsUsed: "a king's order",
    alignment: 'Good',
    key: 'call_to_arms',
    name: 'Call to Arms',
    theOtherNamesTheTurnReads: [],
    theNumbers: {
      // the grade a mustered company has, unless the realm's discoveries raise it (Muster Rolls)
      theGradeMustered: {
        value: 'Green',
        writtenAs: 'as it is',
        inItsCreedsSection: 'a free {N} garrison unit',
        inTheReportsSummary: 'a free {N} garrison unit',
      },
    },
  },
  broker: {
    howItIsUsed: "a king's order",
    alignment: 'Neutral',
    key: 'broker',
    name: 'Broker',
    theOtherNamesTheTurnReads: [],
    theNumbers: {
      thePriceOfWordFromAProvince: {
        value: 2,
        writtenAs: 'as it is',
        inItsCreedsSection: 'has ever seen for {N}g',
        inTheReportsSummary: 'has ever seen for {N}g',
      },
    },
  },
  'harvest-the-field': {
    howItIsUsed: "a hero's order",
    alignment: 'Undead',
    key: 'harvest_field',
    name: 'Harvest the Field',
    theOtherNamesTheTurnReads: [],
    theNumbers: {
      // the carters' price, less with the realm's discoveries (Corpse-Carters), never below nothing
      thePrice: {
        value: 2,
        writtenAs: 'as it is',
        inItsCreedsSection: 'as a Skeletal unit for {N}g',
        inTheIntrosTable: 'from a grave for {N} gold',
        inTheReportsSummary: 'as a Skeletal unit for {N}g',
        inTheJoinForm: 'raises a grave as a soldier for {N}g',
      },
    },
  },
  'perform-rite': {
    howItIsUsed: "a hero's order",
    alignment: 'Pagan',
    key: 'rite',
    name: 'Perform Rite',
    theOtherNamesTheTurnReads: [],
    theNumbers: {
      theWildHuntsBeasts: {
        value: 2,
        writtenAs: 'as a word',
        inItsCreedsSection: 'the Wild Hunt binds {N} of',
        inTheReportsSummary: 'the Wild Hunt binds {N} of',
        inTheJoinForm: 'the Wild Hunt binds {N} of',
      },
      // the turns the bound beasts serve beyond this one, more with the realm's discoveries
      theWildHuntsTurnsMore: {
        value: 1,
        writtenAs: 'as the turn it lasts until',
        inItsCreedsSection: 'serve until the end of {N}',
        inTheReportsSummary: 'as Veterans until the end of {N}',
      },
      theBloodOfferingsGrades: {
        value: 2,
        writtenAs: 'as it is',
        inItsCreedsSection: 'by +{N} quality tiers',
        inTheReportsSummary: '(+{N} quality tiers each',
      },
    },
  },
} as const satisfies Readonly<Record<string, AnAlignmentAbility>>;

/** An ability's slug: a key of the rows. */
export type AlignmentAbilitySlug = keyof typeof ALIGNMENT_ABILITIES;

/** An alignment order's slug: a key of a row given as an order. */
type AlignmentOrderSlug = {
  [S in AlignmentAbilitySlug]: (typeof ALIGNMENT_ABILITIES)[S] extends AnAlignmentAbilityGivenAsAnOrder ? S : never;
}[AlignmentAbilitySlug];

/** The alignment orders: each row given as an order, and no other (one left out, or one that isn't, fails to compile),
 *  by slug, in the order of ALIGNMENT_ORDER_KEYS. */
export const THE_ALIGNMENT_ORDERS = {
  consecrate: ALIGNMENT_ABILITIES.consecrate,
  'call-to-arms': ALIGNMENT_ABILITIES['call-to-arms'],
  broker: ALIGNMENT_ABILITIES.broker,
  'harvest-the-field': ALIGNMENT_ABILITIES['harvest-the-field'],
  'perform-rite': ALIGNMENT_ABILITIES['perform-rite'],
} satisfies { readonly [S in AlignmentOrderSlug]: (typeof ALIGNMENT_ABILITIES)[S] };

// The alignments' ladder (P1-19av2): a table beside the rows, not abilities. The rungs run down the moral spectrum from
// holiest to unholiest, and their order is data: a wandering hero's wage is set by the steps between two rungs, Divine
// and Undead (the full gulf) never serve each other, a king's starting heroes are dealt within a step of his rung (a die
// drawn by the order: reorder the rungs and every world changes), and the bots court and fight by the steps. Each rung
// gives the mercy a foe of its alignment shows a felled coward's plea (his own alignment, not his realm's: Decision G).
// Read in src/engine/rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts (the player portal shares it).

/** A number of the ladder: its value, how the books write it, and the words around it where they state it (`{N}` the
 *  value as written; the words as a reader sees them, without the page's markup); a place not given doesn't state it. */
export interface ANumberOfTheLadder {
  readonly value: number;
  readonly writtenAs: HowTheBooksWriteAnAlignmentAbilitysNumber;
  /** In the rulebook's paragraph on the alignments ("Alignment sets your battle fervour…"), where it states it. */
  readonly inTheRulebooksParagraphOnTheAlignments?: string;
  /** In the rulebook's paragraph on hiring a wandering hero ("When you hire a wandering hero…"), where it states it. */
  readonly inTheRulebooksParagraphOnHiring?: string;
  /** In the rulebook's entry on the Cowardly temper ("Cowardly — Opening Shot & Beg for Mercy"), where it states it. */
  readonly inTheRulebooksEntryOnTheCowardly?: string;
  /** A rung's number: in its creed's section in the rulebook ("The Seven Alignments"), where it states it. */
  readonly inItsCreedsSection?: string;
}

/** A rung of the ladder: an alignment, and what a foe of it does when a felled coward begs him for mercy. */
export interface ARungOfTheLadder {
  readonly alignment: (typeof KC_ALIGNMENTS)[number];
  /** The chance a foe of this alignment spares the plea (a foe of no alignment, or one the ladder doesn't hold, spares
   *  it at the resolver's own 50%). */
  readonly theChanceAFoeSparesAPlea: ANumberOfTheLadder;
  /** Whether a foe of this alignment refuses it with laughter (its words drawn by no die), not one of two lines. */
  readonly aFoesRefusalIsLaughter: boolean;
}

/** The ladder: its rungs in order, and its numbers. */
export interface TheLadderOfTheAlignments {
  readonly theRungs: readonly ARungOfTheLadder[];
  readonly theNumbers: {
    /** A wandering hero's wage at no distance (and one step), in gold a turn. */
    readonly theWageOfAHeroAtNoDistance: ANumberOfTheLadder;
    /** The steps between the hirer's rung and the hero's for each gold more. */
    readonly theStepsForEachGoldMore: ANumberOfTheLadder;
    /** The steps of the full gulf (Divine to Undead), at which a hero refuses to serve. */
    readonly theStepsOfTheGulf: ANumberOfTheLadder;
    /** The steps from his king's rung a starting hero is dealt within (the books don't state it). */
    readonly theStepsAKingsHeroesAreDealtWithin: ANumberOfTheLadder;
  };
}

const AT_75 = 'spared {N} of the time by a Good, Divine or Druidic foe';
const AT_50 = '{N} by Neutral or Pagan';
const AT_20 = '{N} by Evil or Undead';
export const THE_LADDER_OF_THE_ALIGNMENTS: TheLadderOfTheAlignments = {
  theRungs: [
    {
      alignment: 'Divine',
      theChanceAFoeSparesAPlea: { value: 75, writtenAs: 'as a percentage', inTheRulebooksEntryOnTheCowardly: AT_75 },
      aFoesRefusalIsLaughter: false,
    },
    {
      alignment: 'Good',
      theChanceAFoeSparesAPlea: {
        value: 75,
        writtenAs: 'as a percentage',
        inTheRulebooksEntryOnTheCowardly: AT_75,
        inItsCreedsSection: 'A felled Cowardly enemy who begs your mercy is spared {N} of the time',
      },
      aFoesRefusalIsLaughter: false,
    },
    {
      alignment: 'Druidic',
      theChanceAFoeSparesAPlea: { value: 75, writtenAs: 'as a percentage', inTheRulebooksEntryOnTheCowardly: AT_75 },
      aFoesRefusalIsLaughter: false,
    },
    {
      alignment: 'Neutral',
      theChanceAFoeSparesAPlea: { value: 50, writtenAs: 'as a percentage', inTheRulebooksEntryOnTheCowardly: AT_50 },
      aFoesRefusalIsLaughter: false,
    },
    {
      alignment: 'Pagan',
      theChanceAFoeSparesAPlea: { value: 50, writtenAs: 'as a percentage', inTheRulebooksEntryOnTheCowardly: AT_50 },
      aFoesRefusalIsLaughter: false,
    },
    {
      alignment: 'Evil',
      theChanceAFoeSparesAPlea: {
        value: 20,
        writtenAs: 'as a percentage',
        inTheRulebooksEntryOnTheCowardly: AT_20,
        inItsCreedsSection: 'A felled Cowardly enemy begging your mercy is spared only {N} of the time',
      },
      aFoesRefusalIsLaughter: true,
    },
    {
      alignment: 'Undead',
      theChanceAFoeSparesAPlea: { value: 20, writtenAs: 'as a percentage', inTheRulebooksEntryOnTheCowardly: AT_20 },
      aFoesRefusalIsLaughter: true,
    },
  ],
  theNumbers: {
    theWageOfAHeroAtNoDistance: {
      value: 2,
      writtenAs: 'as it is',
      inTheRulebooksParagraphOnTheAlignments: 'a wandering hero costs {N}g/turn',
      inTheRulebooksParagraphOnHiring: '{N}g for a close match',
    },
    theStepsForEachGoldMore: {
      value: 2,
      writtenAs: 'as a word',
      inTheRulebooksParagraphOnTheAlignments: '+1g for every {N} steps between your alignment and theirs',
    },
    theStepsOfTheGulf: {
      value: 6,
      writtenAs: 'as a word',
      inTheRulebooksParagraphOnTheAlignments: 'across the full gulf of {N} steps',
    },
    theStepsAKingsHeroesAreDealtWithin: { value: 1, writtenAs: 'as it is' },
  },
};
