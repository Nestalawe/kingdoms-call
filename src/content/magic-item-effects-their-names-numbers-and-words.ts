// The magic items' effects the rule registry holds (plan P1-19's items family, Decision 3): one row per effect, keyed
// by its slug, with the key a held copy of an item carries it by, the numbers the code writes for it (each with how the
// item's texts write it) and the units it reaches. The items' registry (src/engine/rules/the-registry-of-magic-item-
// effects.ts) has one entry for each row and no other: a row with no entry, or an entry with no row, fails to compile.
//
// A saved item is a whole copy (its name, texts and `effect`), and the registry reads each copy's own key and base name,
// never content's copy of the item (Decision 2; docs/traps.md, "Live saves keep copies"): a row holds only what the
// code wrote inline before the registry took it, so an old save's copy works as it did. Change a number here, and the
// texts of every item that carries it: tests/unit/each-magic-item-states-the-numbers-its-effect-has.test.ts reads every
// row against the desc and lore of each item in play that carries it.
import { KC_UNIT_CLASS, type UnitType } from './kingdoms-call-data.ts';

/** How an item's texts write a number: a multiplier as the share it adds (×1.25 as `+25%`); strength added as `+2`. */
export type HowAnItemsTextsWriteANumber = 'a multiplier, as the share it adds' | 'strength added';

/** One number of an item's effect, and how the item's texts write it. */
export interface ANumberOfAnItemsEffect {
  readonly value: number;
  readonly theTextsWriteIt: HowAnItemsTextsWriteANumber;
}

/** The two effects a held copy carries on the item itself, beside its `effect` (Parked: one key per effect, later). */
export type AnItemsOwnField = 'fleetStr' | 'landFullAtSea';

/** The key a held copy of an item carries an effect by: its `effect.stat`, a field of the item's own (true when set),
 *  or the item's base name (a second name of a tier-1 or tier-2 item counts as its base's, as hasItemBase reads it). */
export type TheKeyAnItemCarriesItsEffectBy =
  { readonly stat: string } | { readonly field: AnItemsOwnField } | { readonly itemName: string };

/** A row: what the registry's effect and the items' texts read of one effect. */
export interface AMagicItemEffectAsItsTextsWriteIt {
  /** The item the code named it by, before the registry took it (the first of the items that carry it). */
  readonly name: string;
  /** The key a held copy carries it by. */
  readonly carriedAs: TheKeyAnItemCarriesItsEffectBy;
  /** Its numbers, by what each is for (none where the effect is a waiver or a step up a tier). */
  readonly numbers: Readonly<Record<string, ANumberOfAnItemsEffect>>;
  /** The units it reaches, when not every unit the bearer leads: the units named (a class of the data file is a list
   *  of strings: the registry's unit test checks that each is a unit type), or the skeletal units (a mark the raising
   *  writes on the unit, not a type). */
  readonly reaches?: readonly string[] | 'the skeletal units';
  /** The realm's alignment it needs, when it acts for one realm only. */
  readonly forARealmThatIs?: string;
}

// The cavalry, infantry, archers and heavy engines the commander's items reach (until P1-19m armStr's CAV_I, INF_I,
// ARCH_I and HEAVY_I). Each item's texts name fewer (plan NEXT.md question 21: Parked "Thirty items' texts name fewer
// units, or another rule, than the battle gives"); these are what the battle gives.
const THE_CAVALRY_THE_LANCERS_ITEMS_REACH: readonly UnitType[] = [
  'Free Lances',
  'Gilded Lances',
  'Warg Riders',
  'Eagle Riders',
  'Noble Griffons',
  'Stag Riders',
  'Ironhoof Rams',
];
const THE_INFANTRY_THE_LEGIONS_ITEMS_REACH: readonly UnitType[] = [
  'Shieldwall Levies',
  'Dwarven Guard',
  'Orc Berserkers',
  'Men-at-Arms',
];
const THE_ARCHERS_THE_BOWMANS_ITEMS_REACH: readonly UnitType[] = [
  'Yeoman Longbows',
  'Elven Bowmen',
  'Shadow Archers',
  'Ironwood Crossbows',
  'Black Arrows',
];
const THE_HEAVY_ENGINES_THE_ENGINEERS_ITEMS_REACH: readonly UnitType[] = ['Mountain Guns', 'Dwarf Ironclads'];

/** The magic items' effects the registry holds, in the order the battle code meets them: the commander's items on
 *  each unit he leads, then his items at sea (plan P1-19m). */
export const MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS = {
  // ── The commander's items (strength, in armStr: after the unit's own modifiers, before its factors from its force),
  // each step rounded as it goes. ──
  // Every army the bearer leads fights +2, whatever the item's own bonus: the two relic standards say +4 and +6 and give
  // +2 too (plan NEXT.md question 20; Parked "The two relic standards give +2, not their +4 and +6").
  'army-bonus': {
    name: 'Battle Standard',
    carriedAs: { stat: 'armyBonus' },
    numbers: { strengthAdded: { value: 2, theTextsWriteIt: 'strength added' } },
  },
  'cavalry-bonus': {
    name: 'Golden Spur',
    carriedAs: { stat: 'cavBonus' },
    numbers: { multiplier: { value: 1.25, theTextsWriteIt: 'a multiplier, as the share it adds' } },
    reaches: THE_CAVALRY_THE_LANCERS_ITEMS_REACH,
  },
  'infantry-bonus': {
    name: "Legionnaire's Mark",
    carriedAs: { stat: 'infBonus' },
    numbers: { multiplier: { value: 1.2, theTextsWriteIt: 'a multiplier, as the share it adds' } },
    reaches: THE_INFANTRY_THE_LEGIONS_ITEMS_REACH,
  },
  'archer-bonus': {
    name: 'Eagle-Eye Pendant',
    carriedAs: { stat: 'archerStr' },
    numbers: { multiplier: { value: 1.3, theTextsWriteIt: 'a multiplier, as the share it adds' } },
    reaches: THE_ARCHERS_THE_BOWMANS_ITEMS_REACH,
  },
  'heavy-bonus': {
    name: "Engineer's Blueprint",
    carriedAs: { stat: 'heavyBonus' },
    numbers: { strengthAdded: { value: 4, theTextsWriteIt: 'strength added' } },
    reaches: THE_HEAVY_ENGINES_THE_ENGINEERS_ITEMS_REACH,
  },
  // The fleets the bearer leads fight one quality tier higher (none past Elite). No item in play carries it now: the
  // relic's copy in play carries `fleetQuality`, which nothing reads (Parked); an older save's copy still may.
  'naval-bonus': {
    name: 'Kraken Figurehead',
    carriedAs: { stat: 'navalBonus' },
    numbers: {},
    reaches: KC_UNIT_CLASS.carrier,
  },
  'fleet-strength': {
    name: 'Sea Chart of the Deep',
    carriedAs: { field: 'fleetStr' },
    numbers: { strengthAdded: { value: 1, theTextsWriteIt: 'strength added' } },
    reaches: KC_UNIT_CLASS.carrier,
  },
  'admirals-spyglass': {
    name: "Admiral's Spyglass",
    carriedAs: { itemName: "Admiral's Spyglass" },
    numbers: { strengthAdded: { value: 2, theTextsWriteIt: 'strength added' } },
    reaches: KC_UNIT_CLASS.carrier,
  },
  'chalice-of-dawn': {
    name: 'Chalice of Dawn',
    carriedAs: { itemName: 'Chalice of Dawn' },
    numbers: { multiplier: { value: 1.15, theTextsWriteIt: 'a multiplier, as the share it adds' } },
    forARealmThatIs: 'Divine',
  },
  'undead-bonus': {
    name: 'Black Sceptre',
    carriedAs: { stat: 'undeadBonus' },
    numbers: { strengthAdded: { value: 4, theTextsWriteIt: 'strength added' } },
    reaches: 'the skeletal units',
  },
  // ── The commander's items at sea (strength, in armStr, where the sea's penalty would cut a land unit he leads):
  // the penalty is waived, as for a commander of Naval's eighth level. ──
  'land-units-at-full-strength-at-sea': {
    name: "Tide-Caller's Horn",
    carriedAs: { field: 'landFullAtSea' },
    numbers: {},
  },
} as const satisfies Record<string, AMagicItemEffectAsItsTextsWriteIt>;

/** The slug of an effect the registry holds. */
export type MagicItemEffectSlug = keyof typeof MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS;
