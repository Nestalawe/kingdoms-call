// The rule registry holds each effect once, in the order of its stage (plan P1-19, Decisions 2 and 3): every effect an
// entry names at a stage is in that stage's order exactly once, and each order names only entries with an effect at its
// stage (an effect left out of its order would never run; one named twice would run twice). Each content row's unit,
// each unit it counts, reaches or counts as, is a unit type, and no two rows share a name. The compiler checks the rest: a content row
// with no entry, an entry with no row, and an entry on a stage or a hook point with no signature yet fail to compile
// (tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts).
// Since P1-19m the items' registry (src/engine/rules/the-registry-of-magic-item-effects.ts) is held to the same: each
// effect once in its stage's order (THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS), each order naming only entries with an
// effect there, each content row with its entry and each entry with its row; each unit a row reaches is a unit type,
// the realm it needs an alignment, and no two rows share a name. Since P1-19u the spells' registry
// (src/engine/rules/the-registry-of-spell-effects.ts) is held to the same: each effect once in its stage's order
// (THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS), each order naming only entries with an effect there, each content row with
// its entry and each entry with its row; each row's name is a spell of SPELL_DEFS_P and its fn that spell's, and no two
// rows share a name. Since P1-19y each stage of "orderValidity" (the Cast Spell order's checks) holds the spells whose
// row sets its flag (`asAnOrder`), and no other, so a flag and its entry can't part. Since P1-19aa the discoveries'
// registry (src/engine/rules/the-registry-of-discovery-effects.ts) is held to the same: each effect once in its stage's
// order (THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES), each order naming only entries with an effect there, each content
// row (a kind of effect) with its entry and each entry with its row; each row's kind is a kind of an effect of
// SAGE_DISCOVERIES_P, and no two rows share a kind; and every kind of SAGE_DISCOVERIES_P has its row or is listed as
// not yet taken (THE_KINDS_NOT_YET_TAKEN, which each row of the family shortens, to none), so a kind added to content
// with no entry is found. Since P1-19ai the guardian perks' registry (src/engine/rules/the-registry-of-guardian-perks.ts)
// is held to the same: each effect once in its stage's order (THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS), each order
// naming only entries with an effect there, each content row (a kind of perk) with its entry and each entry with its
// row; each row's kind is a kind of a perk of MONSTERS_P, no two rows share a kind, and every kind of MONSTERS_P has its
// row; a row names the items' effect of its own ward or rider exactly when an item carries it; and an entry with no
// stage is a kind whose row names the items' effect, or one listed as still read inline (THE_PERKS_STILL_READ_INLINE,
// which P1-19aj emptied), and no listed kind has a stage. Since P1-19at1 the alignment abilities' registry
// (src/engine/rules/the-registry-of-alignment-abilities.ts) is held to the same: each effect once in its stage's order
// (THE_ORDER_OF_EACH_STAGE_OF_THE_ALIGNMENT_ABILITIES), each order naming only entries with an effect there, each
// content row with its entry and each entry with its row; each row's alignment is one, its key, read as words, is no
// discovery's name and no discovery effect's slug, and the five alignment orders' keys are its rows given as an order
// (since P1-19aw1; their entries have no stage). Its
// runner of "turnEnd: a realm's alignment adds to its tax" gives a Neutral realm a fifth of its provinces' income,
// rounded down, and any other realm nothing, as neutralTradeGold (which Early Winter and the report ask) did before.
// Since P1-19at2 its runner of "turnEnd: a realm's consecrated ground raises a province's tax" gives a province's tax
// ×1.5, rounded to the nearest gold, as Early Winter and the report wrote it, whatever realm holds the ground (it is
// handed no alignment: the consecration list gates it). Since P1-19au1 its runners of the battles' zeal and fervour give
// what both battles wrote before: each creed's chance of zeal as the old table (0.1 for an alignment none holds), the
// defender's chance on consecrated ground doubled after the discoveries' share, at most 1, and the strongest of zeal's
// ×1.3, the skeletal legions' ×1.5 under the king or ×1.3 under another, and savage fury's ×1.25 (old Math.max).
// Since P1-19au2 its runners of the other battle factors and the Banner give what the engine wrote before: 0.85 to an
// Undead or Evil attacker on consecrated ground (1 to any other), Righteous Defence's 1.1, Home of the Wild's 1.5 to a
// Creature in forest or jungle (the realm's or the commander's creed), the Reign of Fear's 1.5 to a Monster, the
// Deathless March to a host of skeletons alone, and the Banner's 15 points, each to its creed alone. Since P1-19av1
// its runners of the prices and the scholars, and the Druid waiver (read in rules-on-plain-values), give what the
// engine wrote before: Neutral's 2g off a mercenary band, Divine's Bless at 2 by the king and 1.8 by another (the
// spell's own 1.6 for any other creed), Neutral's Sage level × 5, and no Druid need for a Creature under a Druidic realm
// or leader, or a Monster under an Evil one. Since P1-19aw2 its runner of who may give an alignment order refuses as
// each resolver did: Consecrate the king before the creed, Call to Arms and Broker the creed first, the others the creed.
// Since P1-19ax1 its runners of Divine grace, the Divine Rest, the Blood Harvest and the conquest doctrine give each
// creed what the engine's checks gave: Divine one turn in death and half health, Divine ×1.5 rounded up, Pagan 1g a
// foe, Evil 0.5 of the tax, a Green unit and 3 turns; null for every other creed and for none.
// Since P1-19ax2 the graves on Undead land (0.05, else 0.1), an Undead hero as undead in personal combat, and the
// shared readers of war without warning, a broken alliance, the doctrine and the risen dead's hand-over, as the
// engine's and the page's checks gave them.
// Level 1 (unit): it reads the registry's values (its effects and orders), which a syntax tree can't evaluate; the
// whole engine is imported first (tests/lib/the-whole-engine.ts). Planted: an entry left out of its order, one named
// twice, an order naming an entry with no effect at its stage, a row's unit that isn't a unit type (and a unit it
// reaches, or counts as), two rows' name; in the items' registry, an entry left out of its order, an order naming an
// entry with no effect at its stage, a row with no entry, a unit reached that isn't a unit type, a realm's alignment
// that isn't one, two rows' name; in the spells' registry, an entry left out of its order, a row with no entry, a
// row's name that is no spell, a row's fn that isn't its spell's, two rows' name, a flag of the order's checks with
// no entry and an entry with no flag; in the discoveries' registry, an entry left out of its order, a row with no
// entry, a row's kind no discovery has, two rows of one kind, a kind of content with no row and not listed, and a kind
// listed that has a row; in the guardian perks', an entry left out of its order, a row with no entry, a kind no perk
// has, two rows of one kind, a row naming another kind's item effect, a shared kind naming none, an own kind naming
// one, a kind of content with no row, an entry with no stage unlisted, and a kind listed with a stage; in the alignment
// abilities', an entry left out of its order, a row with no entry, an alignment that isn't one, a key that is a
// discovery's name or an effect's slug, and one of the orders' keys taken.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import {
  KC_ALIGNMENTS,
  KC_UNIT_TYPE,
  MONSTERS_P,
  SAGE_DISCOVERIES_P,
  SPELL_DEFS_P,
} from '../../src/content/kingdoms-call-data.ts';
import { GUARDIAN_PERKS_THE_REGISTRY_HOLDS } from '../../src/content/guardian-perks-their-kinds-numbers-and-words.ts';
import { DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS } from '../../src/content/discovery-effects-their-kinds-numbers-and-words.ts';
import { SPELL_EFFECTS_THE_REGISTRY_HOLDS } from '../../src/content/spell-effects-their-names-numbers-and-words.ts';
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS } from '../../src/content/unit-abilities-their-names-numbers-and-words.ts';
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS } from '../../src/content/magic-item-effects-their-names-numbers-and-words.ts';
import {
  THE_ORDER_OF_EACH_STAGE,
  THE_REGISTRY_OF_UNIT_ABILITIES,
} from '../../src/engine/rules/the-registry-of-content-effects.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS,
  THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS,
} from '../../src/engine/rules/the-registry-of-magic-item-effects.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS,
  THE_REGISTRY_OF_SPELL_EFFECTS,
} from '../../src/engine/rules/the-registry-of-spell-effects.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES,
  THE_REGISTRY_OF_DISCOVERY_EFFECTS,
} from '../../src/engine/rules/the-registry-of-discovery-effects.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS,
  THE_REGISTRY_OF_GUARDIAN_PERKS,
} from '../../src/engine/rules/the-registry-of-guardian-perks.ts';
import {
  ALIGNMENT_ABILITIES,
  THE_ALIGNMENT_ORDERS,
} from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  THE_ORDER_OF_EACH_STAGE_OF_THE_ALIGNMENT_ABILITIES,
  theCheckAnAlignmentOrderRefusesAHeroOn,
  THE_REGISTRY_OF_ALIGNMENT_ABILITIES,
  theChanceOfZealARealmsAlignmentGivesASide,
  theChanceOfZealOfADefenderOnConsecratedGround,
  theFervourOfASide,
  theTaxOfAProvinceOnConsecratedGround,
  whatARealmsAlignmentAddsToItsTax,
  doesARealmsAlignmentHoldABeatenHostOnTheField,
  theFactorARealmsAlignmentStrengthensAUnitByItsReignOfFear,
  theFactorARealmsAlignmentStrengthensAUnitInTheWildBy,
  theFactorARealmsAlignmentStrengthensItsDefenceOfItsOwnGroundBy,
  theFactorConsecratedGroundWeakensAnAttackersHostBy,
  whatARealmsAlignmentAddsToConvergingColumnsChanceToUnite,
  theGoldARealmsAlignmentCutsFromAMercenaryBandsPrice,
  theYieldOfABlessARealmsAlignmentGives,
  whatARealmsAlignmentAddsToResearch,
  theReturnARealmsAlignmentGivesItsFallen,
  theFactorARealmsAlignmentRaisesARestsHealBy,
  theGoldARealmsAlignmentClaimsForEachFoeDestroyed,
  theConquestDoctrineOfARealmsAlignment,
  theRateARealmsAlignmentLetsTheGravesOnItsLandRotAt,
  isAHeroOfTheAlignmentUndeadInPersonalCombat,
} from '../../src/engine/rules/the-registry-of-alignment-abilities.ts';
import {
  doesAnAlignmentBreakAnAllianceIntoWar,
  doesAnAlignmentConquerByADoctrine,
  doesAnAlignmentDeclareWarWithoutWarning,
} from '../../src/engine/rules-on-plain-values/the-creeds-that-war-without-warning-break-an-alliance-into-war-and-conquer-by-a-doctrine.ts';
import { theRisenDeadFollowAHandOverTo } from '../../src/engine/rules-on-plain-values/the-items-a-send-item-hands-over-and-the-companies-a-hand-over-or-a-pick-up-moves.ts';
import { druidNeedWaivedByAlignment } from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import {
  A_REALMS_ALIGNMENT_ADDS_TO_ITS_TAX,
  A_REALMS_CONSECRATED_GROUND_RAISES_A_PROVINCES_TAX,
} from '../../src/engine/rules/alignment-abilities/a-realms-alignment-at-the-turns-end.ts';
import { neutralTradeGold } from '../../src/engine/grand-design.ts';

/** The registry as this test reads it: each entry's effects by hook point and stage, and each stage's order. */
type Entries = Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, unknown>>>>>>;
type Orders = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
/** A content row as this test reads it (a unit as any string, so a planted row may name one that isn't a unit type). */
type Rows = Readonly<
  Record<
    string,
    {
      readonly unit: string;
      readonly name: string;
      readonly counts?: readonly string[];
      readonly reaches?: string | readonly string[];
      readonly countsAs?: string;
    }
  >
>;

/** An item's effect row as this test reads it (a unit reached, or a realm, as any string, so a planted row may name one
 *  that isn't). */
type ItemRows = Readonly<
  Record<
    string,
    { readonly name: string; readonly reaches?: string | readonly string[]; readonly forARealmThatIs?: string }
  >
>;

/** A spell's row as this test reads it (its name and fn as any string, so a planted row may name one that isn't). */
type SpellRows = Readonly<Record<string, { readonly name: string; readonly fn: string }>>;

const unitTypes: ReadonlySet<string> = new Set(Object.keys(KC_UNIT_TYPE));
/** The spells' fn, by any spell's name. */
const SPELLS: Readonly<Record<string, { readonly fn: string } | undefined>> = SPELL_DEFS_P;
const alignments: ReadonlySet<string> = new Set(KC_ALIGNMENTS);

/** What a unit ability's row breaks: its unit, each unit it counts or reaches, and the unit it counts as, each a unit
 *  type. */
function whatAUnitAbilitysRowBreaks(slug: string, row: Rows[string]): string[] {
  const broken: string[] = [];
  if (!unitTypes.has(row.unit)) broken.push(`${slug}'s unit, ${row.unit}, is not a unit type`);
  for (const u of row.counts ?? []) if (!unitTypes.has(u)) broken.push(`${slug} counts ${u}, not a unit type`);
  if (typeof row.reaches === 'object')
    for (const u of row.reaches) if (!unitTypes.has(u)) broken.push(`${slug} reaches ${u}, not a unit type`);
  if (row.countsAs !== undefined && !unitTypes.has(row.countsAs))
    broken.push(`${slug} counts as ${row.countsAs}, not a unit type`);
  return broken;
}

/** What an item's effect row breaks: each unit it reaches a unit type, and the realm it needs an alignment. */
function whatAnItemEffectsRowBreaks(slug: string, row: ItemRows[string]): string[] {
  const broken: string[] = [];
  if (typeof row.reaches === 'object')
    for (const u of row.reaches) if (!unitTypes.has(u)) broken.push(`${slug} reaches ${u}, not a unit type`);
  if (row.forARealmThatIs !== undefined && !alignments.has(row.forARealmThatIs))
    broken.push(`${slug} needs a realm that is ${row.forARealmThatIs}, not an alignment`);
  return broken;
}

/** What a spell's row breaks: its name a spell of SPELL_DEFS_P, and its fn that spell's. */
function whatASpellsRowBreaks(slug: string, row: SpellRows[string]): string[] {
  const spell = SPELLS[row.name];
  if (!spell) return [`${slug}'s name, ${row.name}, is no spell`];
  return spell.fn === row.fn ? [] : [`${slug}'s fn, ${row.fn}, is not ${row.name}'s (${spell.fn})`];
}

/** What the registry breaks, one line each: an empty list when it holds each effect once in its stage's order. */
function whatTheRegistryBreaks<Row extends { readonly name: string }>(
  entries: Entries,
  orders: Orders,
  rows: Readonly<Record<string, Row>>,
  whatARowBreaks: (slug: string, row: Row) => string[],
): string[] {
  const broken: string[] = [];
  for (const [slug, hooks] of Object.entries(entries)) {
    for (const [hook, stages] of Object.entries(hooks)) {
      for (const [stage, effect] of Object.entries(stages)) {
        if (typeof effect !== 'function') broken.push(`${slug} names a ${typeof effect} at ${hook}: ${stage}`);
        const times = (orders[hook]?.[stage] ?? []).filter((s) => s === slug).length;
        if (times !== 1) broken.push(`${slug} is in the order of ${hook}: ${stage} ${String(times)} times`);
      }
    }
  }
  for (const [hook, stages] of Object.entries(orders)) {
    for (const [stage, order] of Object.entries(stages)) {
      for (const slug of new Set(order)) {
        if (typeof entries[slug]?.[hook]?.[stage] !== 'function')
          broken.push(`the order of ${hook}: ${stage} names ${slug}, which has no effect there`);
      }
    }
  }
  const names = new Map<string, string>();
  for (const [slug, row] of Object.entries(rows)) {
    broken.push(...whatARowBreaks(slug, row));
    const other = names.get(row.name);
    if (other) broken.push(`${slug} and ${other} share the name ${row.name}`);
    names.set(row.name, slug);
    if (!(slug in entries)) broken.push(`${slug} has a content row and no entry`);
  }
  for (const slug of Object.keys(entries)) if (!(slug in rows)) broken.push(`${slug} has an entry and no content row`);
  return broken;
}

const ENTRIES: Entries = THE_REGISTRY_OF_UNIT_ABILITIES;
const ORDERS: Orders = THE_ORDER_OF_EACH_STAGE;
const ROWS: Rows = UNIT_ABILITIES_THE_REGISTRY_HOLDS;
const THE_WHOLE_FORCE = THE_ORDER_OF_EACH_STAGE.strength['the whole force'];
const MEETS = THE_ORDER_OF_EACH_STAGE.strength['what a unit does to the unit it meets'];
const UNITS = (entries: Entries, orders: Orders, rows: Rows) =>
  whatTheRegistryBreaks(entries, orders, rows, whatAUnitAbilitysRowBreaks);
const ITEM_ENTRIES: Entries = THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS;
const ITEM_ORDERS: Orders = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS;
const ITEM_ROWS: ItemRows = MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS;
const THE_COMMANDERS_ITEMS = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.strength["the commander's items"];
const ITEMS = (entries: Entries, orders: Orders, rows: ItemRows) =>
  whatTheRegistryBreaks(entries, orders, rows, whatAnItemEffectsRowBreaks);
const SPELL_ENTRIES: Entries = THE_REGISTRY_OF_SPELL_EFFECTS;
const SPELL_ORDERS: Orders = THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS;
const SPELL_ROWS: SpellRows = SPELL_EFFECTS_THE_REGISTRY_HOLDS;
const SPELLS_CAST = THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS.strength['a battle spell is cast before the battle'];
const SPELLS_REGISTRY = (entries: Entries, orders: Orders, rows: SpellRows) =>
  whatTheRegistryBreaks(entries, orders, rows, whatASpellsRowBreaks);

test('the registry holds each effect once, in the order of its stage, and each content row is sound', () => {
  expect(UNITS(ENTRIES, ORDERS, ROWS)).toEqual([]);
  expect(Object.keys(ENTRIES).length).toBeGreaterThan(0);
  // Every entry acts at some stage: each is in a stage's order.
  const ordered = new Set(Object.values(ORDERS).flatMap((stages) => Object.values(stages).flat()));
  expect([...ordered].sort()).toEqual(Object.keys(ENTRIES).sort());
});

test.for([
  [
    'an entry left out of its order',
    {
      ...ORDERS,
      strength: { ...ORDERS['strength'], 'the whole force': THE_WHOLE_FORCE.filter((s) => s !== 'wyrmscale') },
    },
    ['wyrmscale is in the order of strength: the whole force 0 times'],
  ],
  [
    'an entry named twice in its order',
    { ...ORDERS, strength: { ...ORDERS['strength'], 'the whole force': [...THE_WHOLE_FORCE, 'reaver-crews'] } },
    ['reaver-crews is in the order of strength: the whole force 2 times'],
  ],
  [
    'an order naming an entry with no effect at its stage',
    {
      ...ORDERS,
      strength: { ...ORDERS['strength'], 'what a unit does to the unit it meets': [...MEETS, 'wyrmscale'] },
    },
    ['the order of strength: what a unit does to the unit it meets names wyrmscale, which has no effect there'],
  ],
] as const)('planted, %s, is found', ([, orders, found]) => {
  expect(UNITS(ENTRIES, orders, ROWS)).toEqual(found);
});

test('planted, a content row whose unit is no unit type, units reached and counted as that are none, and two rows of one name, are found', () => {
  const rows: Rows = {
    ...ROWS,
    wyrmscale: { ...UNIT_ABILITIES_THE_REGISTRY_HOLDS.wyrmscale, unit: 'Planted Wyrms' },
    'tidal-might': { ...UNIT_ABILITIES_THE_REGISTRY_HOLDS['tidal-might'], name: 'Deepwater Grasp' },
    'hold-the-gate': {
      ...UNIT_ABILITIES_THE_REGISTRY_HOLDS['hold-the-gate'],
      reaches: ['Orc Garrison', 'Planted Gate'],
    },
    'town-watch': { ...UNIT_ABILITIES_THE_REGISTRY_HOLDS['town-watch'], countsAs: 'Planted Levies' },
  };
  expect(UNITS(ENTRIES, ORDERS, rows)).toEqual([
    'deepwater-grasp and tidal-might share the name Deepwater Grasp',
    "wyrmscale's unit, Planted Wyrms, is not a unit type",
    'hold-the-gate reaches Planted Gate, not a unit type',
    'town-watch counts as Planted Levies, not a unit type',
  ]);
});

test("the items' registry holds each effect once, in the order of its stage, and each content row is sound", () => {
  expect(ITEMS(ITEM_ENTRIES, ITEM_ORDERS, ITEM_ROWS)).toEqual([]);
  expect(Object.keys(ITEM_ENTRIES).length).toBeGreaterThan(0);
  const ordered = new Set(Object.values(ITEM_ORDERS).flatMap((stages) => Object.values(stages).flat()));
  expect([...ordered].sort()).toEqual(Object.keys(ITEM_ENTRIES).sort());
});

test.for([
  [
    'an entry left out of its order',
    {
      ...ITEM_ORDERS,
      strength: {
        ...ITEM_ORDERS['strength'],
        "the commander's items": THE_COMMANDERS_ITEMS.filter((s) => s !== 'chalice-of-dawn'),
      },
    },
    ["chalice-of-dawn is in the order of strength: the commander's items 0 times"],
  ],
  [
    'an order naming an entry with no effect at its stage',
    {
      ...ITEM_ORDERS,
      strength: {
        ...ITEM_ORDERS['strength'],
        "the commander's items": [...THE_COMMANDERS_ITEMS, 'land-units-at-full-strength-at-sea'],
      },
    },
    [
      "the order of strength: the commander's items names land-units-at-full-strength-at-sea, which has no effect there",
    ],
  ],
] as const)("planted in the items' registry, %s, is found", ([, orders, found]) => {
  expect(ITEMS(ITEM_ENTRIES, orders, ITEM_ROWS)).toEqual(found);
});

test("planted in the items' registry, a row with no entry, a unit reached that is none, a realm's alignment that is none, and two rows of one name, are found", () => {
  const rows: ItemRows = {
    ...ITEM_ROWS,
    'cavalry-bonus': {
      ...MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS['cavalry-bonus'],
      reaches: ['Free Lances', 'Planted Horse'],
    },
    'chalice-of-dawn': { ...MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS['chalice-of-dawn'], forARealmThatIs: 'Planted' },
    'heavy-bonus': { ...MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS['heavy-bonus'], name: 'Golden Spur' },
    'planted-effect': { name: 'Planted Effect' },
  };
  expect(ITEMS(ITEM_ENTRIES, ITEM_ORDERS, rows)).toEqual([
    'cavalry-bonus reaches Planted Horse, not a unit type',
    'heavy-bonus and cavalry-bonus share the name Golden Spur',
    'chalice-of-dawn needs a realm that is Planted, not an alignment',
    'planted-effect has a content row and no entry',
  ]);
});

test("the spells' registry holds each effect once, in the order of its stage, and each content row is sound", () => {
  expect(SPELLS_REGISTRY(SPELL_ENTRIES, SPELL_ORDERS, SPELL_ROWS)).toEqual([]);
  expect(Object.keys(SPELL_ENTRIES).length).toBeGreaterThan(0);
  const ordered = new Set(Object.values(SPELL_ORDERS).flatMap((stages) => Object.values(stages).flat()));
  expect([...ordered].sort()).toEqual(Object.keys(SPELL_ENTRIES).sort());
});

test("planted in the spells' registry, an entry left out of its order, a row with no entry, a name that is no spell, a fn that isn't its spell's, and two rows of one name, are found", () => {
  const orders: Orders = {
    ...SPELL_ORDERS,
    strength: {
      ...SPELL_ORDERS['strength'],
      'a battle spell is cast before the battle': SPELLS_CAST.filter((s) => s !== 'curse'),
    },
  };
  const rows: SpellRows = {
    ...SPELL_ROWS,
    fireball: { ...SPELL_EFFECTS_THE_REGISTRY_HOLDS.fireball, name: 'Planted Fireball' },
    spiritwrack: { ...SPELL_EFFECTS_THE_REGISTRY_HOLDS.spiritwrack, fn: 'white_planted' },
    'holy-symbol': { ...SPELL_EFFECTS_THE_REGISTRY_HOLDS['holy-symbol'], name: 'Curse', fn: 'necromancy_curse' },
    'planted-spell': { name: 'Resurrect', fn: 'white_resurrect' },
  };
  expect(SPELLS_REGISTRY(SPELL_ENTRIES, orders, rows)).toEqual([
    'curse is in the order of strength: a battle spell is cast before the battle 0 times',
    "fireball's name, Planted Fireball, is no spell",
    'holy-symbol and curse share the name Curse',
    "spiritwrack's fn, white_planted, is not Spiritwrack's (white_spiritwrack)",
    'planted-spell has a content row and no entry',
  ]);
});

/** Each stage of the Cast Spell order's checks, by the flag of a spell's row (`asAnOrder`) it reads (plan P1-19y). */
const THE_FLAG_OF_EACH_CHECK = {
  'a charmed hero will not turn it on his lord': 'aCharmedHeroWillNotTurnItOnHisLord',
  'a spell that costs no casting slot': 'aGrandCathedralFreesItsSlot',
  "a spell's mark must stand in the province": 'itsMarkMustStandInTheProvince',
  'a cloaked mark is shielded from it': 'aCloakedMarkIsShieldedFromIt',
  'a Bless ward may turn it aside': 'aBlessWardMayTurnItAside',
} as const;
/** A spell's row as the order's checks read it (its flags by any name, so a planted row may set one or not). */
type ARowsFlags = Readonly<
  Record<string, { readonly name: string; readonly asAnOrder?: Readonly<Partial<Record<string, true>>> }>
>;
/** Where a stage of the order's checks and the rows' flags part: a spell whose row sets the flag and is not in the
 *  stage's order, or one in the order whose row doesn't set it. */
const whereTheChecksAndTheFlagsPart = (orders: Orders, rows: ARowsFlags) =>
  Object.entries(THE_FLAG_OF_EACH_CHECK).flatMap(([stage, flag]) => {
    const ordered = orders['orderValidity']?.[stage] ?? [];
    const flagged = Object.keys(rows).filter((slug) => rows[slug]?.asAnOrder?.[flag] === true);
    return [
      ...flagged.filter((slug) => !ordered.includes(slug)).map((slug) => `${slug} sets ${flag}, not in ${stage}`),
      ...ordered.filter((slug) => !flagged.includes(slug)).map((slug) => `${slug} is in ${stage}, not setting ${flag}`),
    ];
  });

test("each of the Cast Spell order's checks holds the spells whose row sets its flag, and no other", () => {
  expect(Object.keys(SPELL_ORDERS['orderValidity'] ?? {}).sort()).toEqual(Object.keys(THE_FLAG_OF_EACH_CHECK).sort());
  expect(whereTheChecksAndTheFlagsPart(SPELL_ORDERS, SPELL_EFFECTS_THE_REGISTRY_HOLDS)).toEqual([]);
});

test("planted, a flag of the order's checks with no entry, and an entry with no flag, are found", () => {
  const rows: ARowsFlags = {
    ...SPELL_EFFECTS_THE_REGISTRY_HOLDS,
    flood: { name: 'Flood', asAnOrder: {} },
    oratory: {
      name: 'Oratory',
      asAnOrder: { itsMarkMustStandInTheProvince: true, aCloakedMarkIsShieldedFromIt: true },
    },
  };
  expect(whereTheChecksAndTheFlagsPart(SPELL_ORDERS, rows)).toEqual([
    'oratory sets aCloakedMarkIsShieldedFromIt, not in a cloaked mark is shielded from it',
    'flood is in a Bless ward may turn it aside, not setting aBlessWardMayTurnItAside',
  ]);
});

/** A kind of discovery effect's row as this test reads it (its kind as any string, so a planted row may name one that
 *  no discovery has). */
type DiscoveryRows = Readonly<Record<string, { readonly kind: string }>>;

/** Every kind of effect SAGE_DISCOVERIES_P's rows name (`effect` and `effect2`). */
const THE_KINDS_IN_CONTENT: ReadonlySet<string> = new Set(
  SAGE_DISCOVERIES_P.flatMap((d): readonly { readonly kind?: string }[] => [
    ...('effect' in d ? [d.effect] : []),
    ...('effect2' in d ? [d.effect2] : []),
  ]).flatMap((e) => (e.kind === undefined ? [] : [e.kind])),
);

/** The kinds of SAGE_DISCOVERIES_P the discoveries' registry hasn't taken yet: each row of the family took its own off
 *  (plan P1-19's discoveries family, rows ab to ah), to none. */
const THE_KINDS_NOT_YET_TAKEN: readonly string[] = [];

/** What a kind's row breaks: its kind a kind of an effect of SAGE_DISCOVERIES_P. */
function whatADiscoveryKindsRowBreaks(slug: string, row: { readonly name: string }): string[] {
  return THE_KINDS_IN_CONTENT.has(row.name) ? [] : [`${slug}'s kind, ${row.name}, is no discovery's`];
}

/** Where the kinds of content and the rows part: a kind with no row that isn't listed as not yet taken, and a kind
 *  listed that has a row. */
const whereTheKindsAndTheRowsPart = (rows: DiscoveryRows, notYetTaken: readonly string[]) => {
  const taken = new Set(Object.values(rows).map((row) => row.kind));
  return [
    ...[...THE_KINDS_IN_CONTENT]
      .filter((kind) => !taken.has(kind) && !notYetTaken.includes(kind))
      .map((kind) => `${kind} has no row and isn't listed as not yet taken`),
    ...notYetTaken.filter((kind) => taken.has(kind)).map((kind) => `${kind} is listed as not yet taken, and has a row`),
  ];
};

const DISCOVERY_ENTRIES: Entries = THE_REGISTRY_OF_DISCOVERY_EFFECTS;
const DISCOVERY_ORDERS: Orders = THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES;
const DISCOVERY_ROWS: DiscoveryRows = DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS;
/** The registry's rows by their kind, as the shared check reads a row's name (no two may share one). */
const byTheirKind = (rows: DiscoveryRows) =>
  Object.fromEntries(Object.entries(rows).map(([slug, row]) => [slug, { name: row.kind }]));
const DISCOVERIES_REGISTRY = (entries: Entries, orders: Orders, rows: DiscoveryRows) =>
  whatTheRegistryBreaks(entries, orders, byTheirKind(rows), whatADiscoveryKindsRowBreaks);

test("the discoveries' registry holds each effect once, in the order of its stage, and each content row is sound", () => {
  expect(DISCOVERIES_REGISTRY(DISCOVERY_ENTRIES, DISCOVERY_ORDERS, DISCOVERY_ROWS)).toEqual([]);
  expect(Object.keys(DISCOVERY_ENTRIES).length).toBeGreaterThan(0);
  const ordered = new Set(Object.values(DISCOVERY_ORDERS).flatMap((stages) => Object.values(stages).flat()));
  expect([...ordered].sort()).toEqual(Object.keys(DISCOVERY_ENTRIES).sort());
});

test("every kind of the discoveries' effects has its row in the registry's content, or is listed as not yet taken", () => {
  expect(THE_KINDS_IN_CONTENT.size).toBe(58);
  expect(whereTheKindsAndTheRowsPart(DISCOVERY_ROWS, THE_KINDS_NOT_YET_TAKEN)).toEqual([]);
});

test("planted in the discoveries' registry, an entry left out of its order, a row with no entry, a kind no discovery has, two rows of one kind, a kind with no row unlisted, and a kind listed with a row, are found", () => {
  const orders: Orders = {
    ...DISCOVERY_ORDERS,
    strength: { ...DISCOVERY_ORDERS['strength'], "a realm's discoveries add to a siege": [] },
  };
  // every kind has its row since P1-19ah, so a row with no entry whose kind is a discovery's is Messenger Birds' row
  // under another slug (its entry left with no row), and the planted list names its kind
  const withoutMessengerBirds: DiscoveryRows = Object.fromEntries(
    Object.entries(DISCOVERY_ROWS).filter(([slug]) => slug !== 'messenger-birds'),
  );
  const rows: DiscoveryRows = {
    ...withoutMessengerBirds,
    fanaticism: { kind: 'plantedFervour' },
    casting: { kind: 'siege' },
    'planted-kind': { kind: 'extendedIntel' },
  };
  expect(DISCOVERIES_REGISTRY(DISCOVERY_ENTRIES, orders, rows)).toEqual([
    "siegecraft is in the order of strength: a realm's discoveries add to a siege 0 times",
    "fanaticism's kind, plantedFervour, is no discovery's",
    'casting and siegecraft share the name siege',
    'planted-kind has a content row and no entry',
    'messenger-birds has an entry and no content row',
  ]);
  expect(whereTheKindsAndTheRowsPart(rows, ['extendedIntel'])).toEqual([
    "cast has no row and isn't listed as not yet taken",
    "fanatic has no row and isn't listed as not yet taken",
    'extendedIntel is listed as not yet taken, and has a row',
  ]);
  // a kind's row taken away, and the kind left off the list
  expect(whereTheKindsAndTheRowsPart(withoutMessengerBirds, THE_KINDS_NOT_YET_TAKEN)).toEqual([
    "extendedIntel has no row and isn't listed as not yet taken",
  ]);
});

/** A kind of perk's row as this test reads it (its ward or rider and the items' effect it names as any string, so a
 *  planted row may name one no perk has, or another kind's effect). */
type PerkRows = Readonly<
  Record<
    string,
    {
      readonly carriedAs: { readonly ward: string } | { readonly rider: string };
      readonly theItemsEffectItReaches?: string;
    }
  >
>;

/** A kind of perk as MONSTERS_P writes it: its `fx.ward`, or its rider's key. */
const aPerksKind = (fx: Readonly<Record<string, unknown>>): string =>
  typeof fx['ward'] === 'string' ? fx['ward'] : (Object.keys(fx)[0] ?? '');
/** A row's kind: its ward, or its rider. */
const aRowsKind = (carriedAs: PerkRows[string]['carriedAs']): string =>
  'ward' in carriedAs ? carriedAs.ward : carriedAs.rider;

/** Every kind of perk MONSTERS_P's guardians carry. */
const THE_PERKS_KINDS_IN_CONTENT: ReadonlySet<string> = new Set(
  MONSTERS_P.flatMap((guardian) => guardian.passives.map((perk) => aPerksKind(perk.fx))),
);

/** The items' effects by the ward or rider they are carried as (the items' rows' `carriedAs`). */
const THE_ITEMS_EFFECT_OF_EACH_WARD_AND_RIDER: ReadonlyMap<string, string> = new Map(
  Object.entries(MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS).flatMap(([slug, row]): [string, string][] => {
    const carriedAs: Readonly<Record<string, unknown>> = row.carriedAs;
    const key = carriedAs['ward'] ?? carriedAs['rider'];
    return typeof key === 'string' ? [[key, slug]] : [];
  }),
);

/** The kinds of perk whose effect is still read inline, with no stage in the registry and no items' effect: none since
 *  P1-19aj took the guardian's own wards (the stun ward, the lingering-harm ward, the ward against one school). */
const THE_PERKS_STILL_READ_INLINE: readonly string[] = [];

/** What a perk kind's row breaks: its kind a kind of a perk of MONSTERS_P, and the items' effect it names that of its
 *  own ward or rider, exactly when an item carries it. */
function whatAPerkKindsRowBreaks(rows: PerkRows) {
  return (slug: string, row: { readonly name: string }): string[] => {
    const broken = THE_PERKS_KINDS_IN_CONTENT.has(row.name) ? [] : [`${slug}'s kind, ${row.name}, is no perk's`];
    const named = rows[slug]?.theItemsEffectItReaches;
    const itsOwn = THE_ITEMS_EFFECT_OF_EACH_WARD_AND_RIDER.get(row.name);
    if (named !== itsOwn) broken.push(`${slug} names ${named ?? 'no item effect'}, not ${itsOwn ?? 'none'}`);
    return broken;
  };
}

/** Where the entries with no stage and the list part: an entry with no stage whose row names no items' effect and that
 *  isn't listed, and a kind listed that has a stage or names an items' effect. Then every kind of content with no row. */
const whereTheStagesAndTheListPart = (entries: Entries, rows: PerkRows, stillInline: readonly string[]) => [
  ...Object.entries(entries)
    .filter(
      ([slug, hooks]) =>
        Object.keys(hooks).length === 0 &&
        rows[slug]?.theItemsEffectItReaches === undefined &&
        !stillInline.includes(slug),
    )
    .map(([slug]) => `${slug} has no stage, names no item effect, and isn't listed as still read inline`),
  ...stillInline
    .filter((slug) => Object.keys(entries[slug] ?? {}).length > 0 || rows[slug]?.theItemsEffectItReaches !== undefined)
    .map((slug) => `${slug} is listed as still read inline, and has a stage or an item effect`),
  ...[...THE_PERKS_KINDS_IN_CONTENT]
    .filter((kind) => !Object.values(rows).some((row) => aRowsKind(row.carriedAs) === kind))
    .map((kind) => `${kind} has no row`),
];

const PERK_ENTRIES: Entries = THE_REGISTRY_OF_GUARDIAN_PERKS;
const PERK_ORDERS: Orders = THE_ORDER_OF_EACH_STAGE_OF_THE_GUARDIAN_PERKS;
const PERK_ROWS: PerkRows = GUARDIAN_PERKS_THE_REGISTRY_HOLDS;
const PERKS_REGISTRY = (entries: Entries, orders: Orders, rows: PerkRows) =>
  whatTheRegistryBreaks(
    entries,
    orders,
    Object.fromEntries(Object.entries(rows).map(([slug, row]) => [slug, { name: aRowsKind(row.carriedAs) }])),
    whatAPerkKindsRowBreaks(rows),
  );

test("the guardian perks' registry holds each effect once, in the order of its stage, and each content row is sound", () => {
  expect(PERKS_REGISTRY(PERK_ENTRIES, PERK_ORDERS, PERK_ROWS)).toEqual([]);
  expect(Object.keys(PERK_ENTRIES)).toHaveLength(17);
});

test("every kind of the guardians' perks has its row, and an entry with no stage names the items' effect or is listed as still read inline", () => {
  expect(THE_PERKS_KINDS_IN_CONTENT.size).toBe(17);
  expect(whereTheStagesAndTheListPart(PERK_ENTRIES, PERK_ROWS, THE_PERKS_STILL_READ_INLINE)).toEqual([]);
});

test("planted in the guardian perks' registry, an entry left out of its order, a row with no entry, a kind no perk has, two rows of one kind, a wrong item effect, and the list's two partings, are found", () => {
  const orders: Orders = {
    ...PERK_ORDERS,
    personalCombat: { ...PERK_ORDERS['personalCombat'], "a guardian's perks: what his card turns": ['a-tough-hide'] },
  };
  const withoutThorns: PerkRows = Object.fromEntries(Object.entries(PERK_ROWS).filter(([slug]) => slug !== 'thorns'));
  const rows: PerkRows = {
    ...withoutThorns,
    'hard-to-hit': { carriedAs: { ward: 'plantedDodge' } },
    'a-dread-aura': { carriedAs: { rider: 'burn' }, theItemsEffectItReaches: 'burn-rider' },
    'a-keen-eye': { carriedAs: { rider: 'hitBonus' }, theItemsEffectItReaches: 'damage-bonus-rider' },
    'a-stun-ward': { carriedAs: { ward: 'stunWard' }, theItemsEffectItReaches: 'stun-immunity' },
    'planted-perk': { carriedAs: { ward: 'thorns' } },
  };
  expect(PERKS_REGISTRY(PERK_ENTRIES, orders, rows)).toEqual([
    "spell-resistance is in the order of personalCombat: a guardian's perks: what his card turns 0 times",
    "arrow-proof is in the order of personalCombat: a guardian's perks: what his card turns 0 times",
    'a-stun-ward names stun-immunity, not none',
    "hard-to-hit's kind, plantedDodge, is no perk's",
    'a-keen-eye names damage-bonus-rider, not hit-bonus-rider',
    'a-fire-or-frost-aura and a-dread-aura share the name burn',
    'planted-perk names no item effect, not thorns',
    'planted-perk has a content row and no entry',
    'thorns has an entry and no content row',
  ]);
  // the guardian's own wards' stages taken away again, as before P1-19aj
  const withTheOwnWardsInline: Entries = {
    ...PERK_ENTRIES,
    'a-ward-against-one-school': {},
    'a-lingering-harm-ward': {},
  };
  expect(whereTheStagesAndTheListPart(withTheOwnWardsInline, rows, ['a-stun-ward', 'a-tough-hide'])).toEqual([
    "a-ward-against-one-school has no stage, names no item effect, and isn't listed as still read inline",
    "a-lingering-harm-ward has no stage, names no item effect, and isn't listed as still read inline",
    "hard-to-hit has no stage, names no item effect, and isn't listed as still read inline",
    // its row taken away (above)
    "thorns has no stage, names no item effect, and isn't listed as still read inline",
    'a-stun-ward is listed as still read inline, and has a stage or an item effect',
    'a-tough-hide is listed as still read inline, and has a stage or an item effect',
    'dodge has no row',
    'aura has no row',
  ]);
});

/** An alignment ability's row as this test reads it (its alignment as any string, so a planted row may name one that
 *  isn't). */
type AbilityRows = Readonly<Record<string, { readonly alignment: string; readonly howItIsUsed?: string }>>;

/** The discoveries' names and their effects' slugs, lower case, which no ability's key, read as words, may be. */
const THE_DISCOVERIES_NAMES: ReadonlySet<string> = new Set([
  ...SAGE_DISCOVERIES_P.map((d) => d.name.toLowerCase()),
  ...Object.keys(DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS).map((slug) => slug.replace(/-/g, ' ')),
]);
/** The five alignment orders' keys, each a row given as an order (plan P1-19's alignment abilities family, row
 *  P1-19aw1). */
const THE_ORDERS_KEYS = ['consecrate', 'call-to-arms', 'broker', 'harvest-the-field', 'perform-rite'];
/** Whether a row is given as an order (a king's or a hero's), not always on. */
const isGivenAsAnOrder = (row: { readonly howItIsUsed?: string | undefined }): boolean =>
  row.howItIsUsed === "a king's order" || row.howItIsUsed === "a hero's order";

/** What an ability's row breaks: its alignment an alignment, its key no discovery's name or effect's slug, and an
 *  order's key a row given as an order. */
function whatAnAlignmentAbilitysRowBreaks(
  slug: string,
  row: { readonly name: string; readonly alignment: string; readonly howItIsUsed?: string | undefined },
): string[] {
  const broken: string[] = [];
  if (!alignments.has(row.alignment)) broken.push(`${slug}'s alignment, ${row.alignment}, is not an alignment`);
  if (THE_DISCOVERIES_NAMES.has(slug.replace(/-/g, ' '))) broken.push(`${slug} reads as a discovery's name or slug`);
  if (THE_ORDERS_KEYS.includes(slug) && !isGivenAsAnOrder(row))
    broken.push(`${slug} is an alignment order's key, on a row not given as an order`);
  return broken;
}

const ABILITY_ENTRIES: Entries = THE_REGISTRY_OF_ALIGNMENT_ABILITIES;
const ABILITY_ORDERS: Orders = THE_ORDER_OF_EACH_STAGE_OF_THE_ALIGNMENT_ABILITIES;
const ABILITY_ROWS: AbilityRows = ALIGNMENT_ABILITIES;
/** The rows with their slug as the name the shared check reads (an ability has no name unless it is an order). */
const ABILITIES_REGISTRY = (entries: Entries, orders: Orders, rows: AbilityRows) =>
  whatTheRegistryBreaks(
    entries,
    orders,
    Object.fromEntries(
      Object.entries(rows).map(([slug, row]) => [
        slug,
        { name: slug, alignment: row.alignment, howItIsUsed: row.howItIsUsed },
      ]),
    ),
    whatAnAlignmentAbilitysRowBreaks,
  );

/** The abilities read in src/engine/rules-on-plain-values/, which the player portal shares and which may import only
 *  src/content, so their entries have no stage (P1-19av1: the Druid waiver, druidNeedWaivedByAlignment; P1-19ax2: war
 *  without warning, a broken alliance, the risen dead's hand-over). */
const THE_ABILITIES_READ_IN_THE_RULES_THE_PORTAL_SHARES: readonly string[] = [
  'creatures-follow-without-a-druid',
  'monsters-follow-without-a-druid',
  'war-without-warning-of-an-evil-realm',
  'war-without-warning-of-an-undead-realm',
  'a-broken-alliance-means-war-for-an-evil-realm',
  'a-broken-alliance-means-war-for-an-undead-realm',
  'the-risen-dead-follow-only-the-undead',
];

test("the alignment abilities' registry holds each effect once, in the order of its stage, and each content row is sound", () => {
  expect(ABILITIES_REGISTRY(ABILITY_ENTRIES, ABILITY_ORDERS, ABILITY_ROWS)).toEqual([]);
  expect(Object.keys(ABILITY_ENTRIES).length).toBeGreaterThan(0);
  const ordered = new Set(Object.values(ABILITY_ORDERS).flatMap((stages) => Object.values(stages).flat()));
  // (the orders' entries have one stage, who may give each, P1-19aw2: in the rows' order)
  const theOrders = Object.keys(ABILITY_ROWS).filter((slug) => isGivenAsAnOrder(ABILITY_ROWS[slug] ?? {}));
  expect(theOrders).toEqual(THE_ORDERS_KEYS);
  expect(ABILITY_ORDERS['orderValidity']).toEqual({ 'who may give an alignment order': THE_ORDERS_KEYS });
  for (const slug of theOrders)
    expect(Object.keys(ABILITY_ENTRIES[slug] ?? {}), `${slug}'s entry`).toEqual(['orderValidity']);
  expect([...ordered].sort()).toEqual(
    Object.keys(ABILITY_ENTRIES)
      .filter((slug) => !THE_ABILITIES_READ_IN_THE_RULES_THE_PORTAL_SHARES.includes(slug))
      .sort(),
  );
  // each one listed is an entry with no stage, and none in any stage's order
  for (const slug of THE_ABILITIES_READ_IN_THE_RULES_THE_PORTAL_SHARES)
    expect(ABILITY_ENTRIES[slug], `${slug}'s entry`).toEqual({});
});

test("planted in the alignment abilities' registry, an entry left out of its order, a row with no entry, an alignment that isn't one, a discovery's name or slug as a key, and an order's key on a row not given as an order, are found", () => {
  const orders: Orders = {
    ...ABILITY_ORDERS,
    turnEnd: { ...ABILITY_ORDERS['turnEnd'], "a realm's alignment adds to its tax": [] },
  };
  const rows: AbilityRows = {
    ...ABILITY_ROWS,
    tithes: { alignment: 'Divine' },
    'province-tax': { alignment: 'Neutral' },
    broker: { alignment: 'Neutral' },
    'planted-ability': { alignment: 'Mercantile' },
  };
  expect(ABILITIES_REGISTRY(ABILITY_ENTRIES, orders, rows)).toEqual([
    "neutral-trade is in the order of turnEnd: a realm's alignment adds to its tax 0 times",
    "broker is an alignment order's key, on a row not given as an order",
    "tithes reads as a discovery's name or slug",
    'tithes has a content row and no entry',
    "province-tax reads as a discovery's name or slug",
    'province-tax has a content row and no entry',
    "planted-ability's alignment, Mercantile, is not an alignment",
    'planted-ability has a content row and no entry',
  ]);
});

/** Incomes as Early Winter's collection and the report's forecast may hand them: whole sums, and what a guard reads as
 *  none. */
const INCOMES: readonly (number | null | undefined)[] = [
  ...Array.from({ length: 301 }, (_, i) => i),
  null,
  undefined,
  Number.NaN,
];

test('neutralTradeGold gives a Neutral realm a fifth of its income, rounded down, and any other realm, or none, nothing', () => {
  for (const alignment of [...KC_ALIGNMENTS, undefined])
    for (const income of INCOMES)
      expect(neutralTradeGold({ alignment }, income), `${String(alignment)}, ${String(income)}`).toBe(
        alignment === 'Neutral' ? Math.floor((Number(income) || 0) / 5) : 0,
      );
  expect([
    neutralTradeGold(null, 10),
    neutralTradeGold(undefined, 10),
    neutralTradeGold({ alignment: 'Neutral' }, 10),
  ]).toEqual([0, 0, 2]);
});

test('the runner of "a realm\'s alignment adds to its tax" and the Neutral trade\'s effect give what neutralTradeGold gives', () => {
  for (const alignment of [...KC_ALIGNMENTS, undefined, null])
    for (const income of INCOMES) {
      const theGold = whatARealmsAlignmentAddsToItsTax(alignment, { theIncome: income });
      expect(theGold, `${String(alignment)}, ${String(income)}`).toBe(
        neutralTradeGold({ alignment: alignment ?? undefined }, income),
      );
    }
  expect(INCOMES.map((income) => A_REALMS_ALIGNMENT_ADDS_TO_ITS_TAX['neutral-trade']({ theIncome: income }))).toEqual(
    INCOMES.map((income) => neutralTradeGold({ alignment: 'Neutral' }, income)),
  );
});

test('the runner of "a realm\'s consecrated ground raises a province\'s tax" and its effect give the tax ×1.5, rounded, as before', () => {
  const taxes = Array.from({ length: 301 }, (_, i) => i);
  expect(taxes.map((theTax) => theTaxOfAProvinceOnConsecratedGround({ theTax }))).toEqual(
    taxes.map((t) => Math.round(t * 1.5)),
  );
  expect(
    taxes.map((theTax) => A_REALMS_CONSECRATED_GROUND_RAISES_A_PROVINCES_TAX['consecrated-ground-tax']({ theTax })),
  ).toEqual(taxes.map((t) => Math.round(t * 1.5)));
  // a half rounds up, as Math.round does: 1 → 2, 3 → 5, 5 → 8
  expect([1, 3, 5].map((theTax) => theTaxOfAProvinceOnConsecratedGround({ theTax }))).toEqual([2, 5, 8]);
});

test('the runner of "a realm\'s alignment gives a side its chance of zeal" gives each creed\'s chance as the old table did, and 0.1 to any other', () => {
  const theOldTable: Readonly<Record<string, number>> = {
    Divine: 0.5,
    Good: 0.4,
    Druidic: 0.2,
    Neutral: 0.1,
    Pagan: 0.15,
    Evil: 0.25,
    Undead: 0.0,
  };
  for (const alignment of KC_ALIGNMENTS)
    expect(theChanceOfZealARealmsAlignmentGivesASide(alignment), alignment).toBe(theOldTable[alignment]);
  // a realm of none, or none given, fights as Neutral; an alignment none holds, at the old `?? 0.1`
  expect([null, undefined, '', 'Mercantile'].map((a) => theChanceOfZealARealmsAlignmentGivesASide(a))).toEqual([
    0.1, 0.1, 0.1, 0.1,
  ]);
});

test('the runner of "consecrated ground stirs a defender\'s zeal" doubles the chance so far, at most 1, as before', () => {
  const chances = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.4, 0.45, 0.5, 0.55, 0.7, 0.8, 1, 1.3];
  expect(chances.map((theChance) => theChanceOfZealOfADefenderOnConsecratedGround({ theChance }))).toEqual(
    chances.map((c) => Math.min(1, c * 2)),
  );
});

test('the runner of "a realm\'s alignment stirs a side\'s fervour" gives the strongest of zeal and the fervours, as the old Math.max did', () => {
  const forces = {
    'no skeleton and no Monster': [{ type: 'Men-at-Arms' }],
    'a skeletal unit': [{ type: 'Men-at-Arms' }, { type: 'Men-at-Arms', _isSkeletal: true }],
    'a Monster': [{ type: 'Men-at-Arms' }, { type: 'Cave Trolls' }],
    'a skeletal unit and a Monster': [{ type: 'Cave Trolls' }, { type: 'Men-at-Arms', _isSkeletal: true }],
    'no unit': [],
  };
  for (const alignment of [...KC_ALIGNMENTS, null, undefined])
    for (const [what, theForce] of Object.entries(forces))
      for (const isItLedByTheKing of [true, false])
        for (const isItSeizedByZeal of [true, false]) {
          const align = (alignment ?? '') || 'Neutral';
          const skeletal = theForce.some((a) => '_isSkeletal' in a && a._isSkeletal);
          const monster = theForce.some((a) => a.type === 'Cave Trolls');
          const skelKing = align === 'Undead' && isItLedByTheKing && skeletal;
          const skelHero = align === 'Undead' && !isItLedByTheKing && skeletal;
          const evilMonster = align === 'Evil' && monster;
          const fervour = theFervourOfASide(alignment, { isItSeizedByZeal, isItLedByTheKing, theForce });
          const said = `${String(alignment)}, ${what}, king ${String(isItLedByTheKing)}, zeal ${String(isItSeizedByZeal)}`;
          expect(fervour.theFactor, said).toBe(
            Math.max(1, isItSeizedByZeal ? 1.3 : 1, skelKing ? 1.5 : 1, evilMonster ? 1.25 : 1, skelHero ? 1.3 : 1),
          );
          expect(fervour.theAbilitiesThatStirredIt, said).toEqual([
            ...(skelKing || skelHero ? ['skeletal-fervour'] : []),
            ...(evilMonster ? ['savage-fury'] : []),
          ]);
        }
});

test("the runners of the other battle factors and the Banner give each creed what the engine's checks gave before", () => {
  const creeds = [...KC_ALIGNMENTS, 'Neutral', null, undefined] as const;
  for (const a of creeds) {
    const said = String(a);
    // consecrated ground: `(atkAlign === 'Undead' || atkAlign === 'Evil') ? 0.85 : 1`
    // (the battles hand it the alignment the side fights under: a string, Neutral for a realm of none)
    expect(theFactorConsecratedGroundWeakensAnAttackersHostBy({ theAttackersAlignment: a ?? 'Neutral' }), said).toBe(
      a === 'Undead' || a === 'Evil' ? 0.85 : 1,
    );
    // Righteous Defence: `alignment === 'Good'`, then `defBonus *= 1.1`
    expect(theFactorARealmsAlignmentStrengthensItsDefenceOfItsOwnGroundBy(a), said).toBe(a === 'Good' ? 1.1 : null);
    // the Reign of Fear: `playerAlignment === 'Evil' && MONSTER_ARMIES.has(army.type)`, then ×1.5
    for (const theUnitType of ['Cave Trolls', 'Forest Ents', 'Men-at-Arms'])
      expect(theFactorARealmsAlignmentStrengthensAUnitByItsReignOfFear(a, { theUnitType }), said).toBe(
        a === 'Evil' && theUnitType === 'Cave Trolls' ? 1.5 : null,
      );
    // the Deathless March: `armies.length > 0 && armies.every((a) => a._isSkeletal) && alignment === 'Undead'`
    for (const theCompanies of [[], [{ _isSkeletal: true }], [{ _isSkeletal: true }, {}], [{ _isSkeletal: false }]])
      expect(doesARealmsAlignmentHoldABeatenHostOnTheField(a, { theCompanies }), said).toBe(
        theCompanies.length > 0 && theCompanies.every((c) => c._isSkeletal === true) && a === 'Undead',
      );
    // the Banner of Fellowship: `alignment === 'Good' ? 15 : 0`
    expect(whatARealmsAlignmentAddsToConvergingColumnsChanceToUnite(a), said).toBe(a === 'Good' ? 15 : 0);
    // Home of the Wild: `(realm === 'Druidic' || commander === 'Druidic') && forest or jungle && a Creature`, then ×1.5
    for (const b of creeds)
      for (const theTerrain of ['forest', 'jungle', 'plain', null])
        for (const theUnitType of ['Forest Ents', 'Cave Trolls'])
          expect(
            theFactorARealmsAlignmentStrengthensAUnitInTheWildBy(a, b, { theUnitType, theTerrain }),
            `${said}, ${String(b)}, ${String(theTerrain)}, ${theUnitType}`,
          ).toBe(
            (a === 'Druidic' || b === 'Druidic') &&
              (theTerrain === 'forest' || theTerrain === 'jungle') &&
              theUnitType === 'Forest Ents'
              ? 1.5
              : null,
          );
  }
});

test("the runners of the prices and the scholars, and the Druid waiver, give each creed what the engine's checks gave before", () => {
  const creeds = [...KC_ALIGNMENTS, null, undefined] as const;
  for (const a of creeds) {
    const said = String(a);
    // the mercenary discount: `baseMercCost - (alignment === 'Neutral' ? 2 : 0) + …`
    expect(theGoldARealmsAlignmentCutsFromAMercenaryBandsPrice(a), said).toBe(a === 'Neutral' ? 2 : 0);
    // Bless Province: `(isKing && divine ? 2.0 : divine ? 1.8 : 1.6) + the discoveries'` (the same float, bit for bit)
    for (const isTheCasterTheKing of [true, false])
      for (const theDiscoveries of [0, 0.2])
        expect(
          (theYieldOfABlessARealmsAlignmentGives(a, { isTheCasterTheKing }) ?? 1.6) + theDiscoveries,
          `${said}, ${String(isTheCasterTheKing)}, ${String(theDiscoveries)}`,
        ).toBe((isTheCasterTheKing && a === 'Divine' ? 2.0 : a === 'Divine' ? 1.8 : 1.6) + theDiscoveries);
    expect(theYieldOfABlessARealmsAlignmentGives(a, { isTheCasterTheKing: false }) !== null, said).toBe(a === 'Divine');
    // the Neutral scholars: `alignment === 'Neutral' ? sageLevel * 5 : 0`
    for (const theSageLevel of [0, 1, 2, 3, 4, 5, Number.NaN])
      expect(whatARealmsAlignmentAddsToResearch(a, { theSageLevel }), `${said}, ${String(theSageLevel)}`).toBe(
        a === 'Neutral' ? theSageLevel * 5 : 0,
      );
    // the Druid waiver: `(Creature && (realm === 'Druidic' || leader === 'Druidic')) || (Monster && (… 'Evil'))`
    for (const b of creeds)
      for (const unitType of ['Forest Ents', 'Cave Trolls', 'Men-at-Arms'])
        expect(druidNeedWaivedByAlignment(unitType, a, b), `${said}, ${String(b)}, ${unitType}`).toBe(
          (unitType === 'Forest Ents' && (a === 'Druidic' || b === 'Druidic')) ||
            (unitType === 'Cave Trolls' && (a === 'Evil' || b === 'Evil')),
        );
  }
});

test("the runners of Divine grace, the Divine Rest, the Blood Harvest and the conquest doctrine give each creed what the engine's checks gave before", () => {
  for (const a of [...KC_ALIGNMENTS, null, undefined] as const) {
    const said = String(a);
    // Divine grace: `alignment === 'Divine'` at the death, 7a-bis, 7b and 7d; then `killedOnTurn + 2` and
    // `Math.floor(maxHp * 0.5) || 8`
    const theReturn = theReturnARealmsAlignmentGivesItsFallen(a);
    expect(theReturn, said).toEqual(a === 'Divine' ? { theFullTurnsInDeath: 1, theShareOfHealth: 0.5 } : null);
    // the Divine Rest: `isDivineKingdom ? Math.ceil(baseHeal * 1.5) : baseHeal`
    const f = theFactorARealmsAlignmentRaisesARestsHealBy(a);
    expect(f !== null, said).toBe(a === 'Divine');
    for (let baseHeal = 1; baseHeal <= 60; baseHeal++)
      expect(f !== null ? Math.ceil(baseHeal * f) : baseHeal, `${said}, ${String(baseHeal)}`).toBe(
        a === 'Divine' ? Math.ceil(baseHeal * 1.5) : baseHeal,
      );
    // the Blood Harvest: `alignment !== 'Pagan'` returns; then `destroyed * (BLOOD_HARVEST_PER_UNIT (1) + the discoveries')`
    expect(theGoldARealmsAlignmentClaimsForEachFoeDestroyed(a), said).toBe(a === 'Pagan' ? 1 : null);
    // the conquest doctrine: `alignment !== 'Evil'` returns; then `tax * (0.5 + the discoveries')`, a 'Green' garrison
    // unit and `G.turn + 3` (both battles' Terror: `alignment === 'Evil'`)
    expect(theConquestDoctrineOfARealmsAlignment(a), said).toEqual(
      a === 'Evil'
        ? {
            theShareOfTheTaxPlundered: 0.5,
            theGradeOfTheEnslavedGarrison: 'Green',
            theTurnsTheEnslavedProvincePaysLess: 3,
          }
        : null,
    );
  }
  // a Divine realm's return, as the old literals gave it
  const theDivineReturn = theReturnARealmsAlignmentGivesItsFallen('Divine') ?? {
    theFullTurnsInDeath: 0,
    theShareOfHealth: 0,
  };
  for (const [killedOnTurn, maxHp] of [
    [0, 1],
    [3, 15],
    [7, 31],
    [12, 0],
  ] as const) {
    expect(killedOnTurn + theDivineReturn.theFullTurnsInDeath + 1).toBe(killedOnTurn + 2);
    expect(Math.floor(maxHp * theDivineReturn.theShareOfHealth) || 8).toBe(Math.floor(maxHp * 0.5) || 8);
  }
});

test("the graves, the undead, war without warning, a broken alliance, the doctrine and the risen dead give each creed what the engine's and the page's checks gave before", () => {
  for (const a of [...KC_ALIGNMENTS, null, undefined, '', 'Mercantile'] as const) {
    const said = String(a);
    // the graves: `owner != null && alignment === 'Undead' ? 0.05 : 0.1`
    expect(theRateARealmsAlignmentLetsTheGravesOnItsLandRotAt(a) ?? 0.1, said).toBe(a === 'Undead' ? 0.05 : 0.1);
    // personal combat: `isUndead: ch.alignment === 'Undead'`
    expect(isAHeroOfTheAlignmentUndeadInPersonalCombat(a), said).toBe(a === 'Undead');
    // the turn's and the forecast's `['Evil', 'Undead'].includes(alignment)`, the reckoning's and the card's too
    expect(doesAnAlignmentDeclareWarWithoutWarning(a), said).toBe(['Evil', 'Undead'].includes(String(a)));
    expect(doesAnAlignmentBreakAnAllianceIntoWar(a), said).toBe(['Evil', 'Undead'].includes(String(a)));
    // the order form's `report.kingdom?.alignment === 'Evil'`
    expect(doesAnAlignmentConquerByADoctrine(a), said).toBe(a === 'Evil');
    // the hand-over: `!recipient || recipient.alignment === 'Undead' || recipient.hisRealmsAlignment === 'Undead'`
    for (const b of [...KC_ALIGNMENTS, null, undefined] as const)
      expect(theRisenDeadFollowAHandOverTo({ alignment: a, hisRealmsAlignment: b }), `${said}, ${String(b)}`).toBe(
        a === 'Undead' || b === 'Undead',
      );
  }
  expect(theRisenDeadFollowAHandOverTo(null)).toBe(true);
  // a value the page may hold that is no string: none of them
  for (const v of [0, Number.NaN, {}, ['Evil']])
    expect([doesAnAlignmentDeclareWarWithoutWarning(v), doesAnAlignmentBreakAnAllianceIntoWar(v)]).toEqual([
      false,
      false,
    ]);
});

test('the runner of "who may give an alignment order" refuses as each resolver\'s own checks did, in its own order', () => {
  // each resolver before P1-19aw2: Consecrate `if (!isKing) …; if (alignment !== 'Divine') …`; Call to Arms and Broker
  // the creed, then the king; Harvest the Field and Perform Rite the creed alone
  const theOldChecks = {
    consecrate: ['king', 'Divine'],
    'call-to-arms': ['Good', 'king'],
    broker: ['Neutral', 'king'],
    'harvest-the-field': ['Undead'],
    'perform-rite': ['Pagan'],
  } as const;
  for (const [slug, theChecks] of Object.entries(theOldChecks))
    for (const theAlignmentOfHisRealm of [...KC_ALIGNMENTS, null, undefined])
      for (const isHeTheKing of [true, false, null, undefined]) {
        const theOldRefusal =
          theChecks
            .map((check) =>
              check === 'king'
                ? isHeTheKing === true
                  ? null
                  : 'he is not the king'
                : theAlignmentOfHisRealm === check
                  ? null
                  : 'his realm is not of its creed',
            )
            .find((r) => r !== null) ?? null;
        const theRow = Object.entries(THE_ALIGNMENT_ORDERS).find(([s]) => s === slug)?.[1];
        if (theRow === undefined) throw new TypeError(`no row ${slug}`);
        expect(
          theCheckAnAlignmentOrderRefusesAHeroOn(theRow, { isHeTheKing, theAlignmentOfHisRealm }),
          `${slug}, ${String(theAlignmentOfHisRealm)}, king ${String(isHeTheKing)}`,
        ).toBe(theOldRefusal);
      }
});
