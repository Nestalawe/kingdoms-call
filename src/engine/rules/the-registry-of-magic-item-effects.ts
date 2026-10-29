// The rule registry of the magic items' effects (plan P1-19's items family, Decisions 2, 3 and 4). An item's effect is
// one row in src/content/ (the key a held copy carries it by, its numbers and the units it reaches:
// magic-item-effects-their-names-numbers-and-words.ts) and one entry here, keyed by the same slug, naming its effect at
// each stage of a hook point. The hook points and their stages are the content effects' (one union, in
// the-registry-of-content-effects.ts); within a stage the effects run in the order its list gives (THE_ORDER_OF_EACH_
// STAGE_OF_THE_ITEMS): the steps of the commander's items are each rounded as they go, so the order is the result's.
//
// A runner finds which effects a hero's items carry once a call, from the items the resolver hands it (his active
// items: activeItems stays the one gate, in src/engine/items/), by each copy's own key and base name, never by content's
// copy of the item (Decision 2: an old save's copy works as it did).
import {
  MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS,
  type AMagicItemEffectAsItsTextsWriteIt,
  type AnItemsOwnField,
  type MagicItemEffectSlug,
} from '../../content/magic-item-effects-their-names-numbers-and-words.ts';
import { _ITEM_ALT_BASE } from '../rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import {
  THE_BEATEN_FORCE_MAY_RETREAT,
  THE_COMMANDER_ADDS_VOLLEYS,
  THE_COMMANDERS_RIDERS_RUN_THE_BEATEN_DOWN_ON_ANY_GROUND,
  THE_DEFENDERS_FORTIFICATIONS,
} from './magic-items/the-commanders-items-at-the-walls-the-volley-and-the-rout.ts';
import { A_LAND_UNIT_AT_SEA_LED, THE_COMMANDERS_ITEMS } from './magic-items/the-commanders-items-in-a-battle.ts';
import type {
  ALandUnitAtSeaLed,
  AUnitLedByACommander,
  HookPointName,
  TheDefendersFortificationsAndACommandersSide,
  TheFortificationsLine,
  TheStagesOfEachHookPoint,
  TheVolleysLine,
} from './the-registry-of-content-effects.ts';

/** An entry: the item effect's effect at each stage it acts in. */
export type MagicItemEffectEntry = { readonly [H in HookPointName]?: Partial<TheStagesOfEachHookPoint[H]> };

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). */
export const THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS = {
  'army-bonus': { strength: { "the commander's items": THE_COMMANDERS_ITEMS['army-bonus'] } },
  'cavalry-bonus': { strength: { "the commander's items": THE_COMMANDERS_ITEMS['cavalry-bonus'] } },
  'infantry-bonus': { strength: { "the commander's items": THE_COMMANDERS_ITEMS['infantry-bonus'] } },
  'archer-bonus': { strength: { "the commander's items": THE_COMMANDERS_ITEMS['archer-bonus'] } },
  'heavy-bonus': { strength: { "the commander's items": THE_COMMANDERS_ITEMS['heavy-bonus'] } },
  'naval-bonus': { strength: { "the commander's items": THE_COMMANDERS_ITEMS['naval-bonus'] } },
  'fleet-strength': { strength: { "the commander's items": THE_COMMANDERS_ITEMS['fleet-strength'] } },
  'admirals-spyglass': { strength: { "the commander's items": THE_COMMANDERS_ITEMS['admirals-spyglass'] } },
  'chalice-of-dawn': { strength: { "the commander's items": THE_COMMANDERS_ITEMS['chalice-of-dawn'] } },
  'undead-bonus': { strength: { "the commander's items": THE_COMMANDERS_ITEMS['undead-bonus'] } },
  'land-units-at-full-strength-at-sea': {
    strength: { 'a land unit at sea, led': A_LAND_UNIT_AT_SEA_LED['land-units-at-full-strength-at-sea'] },
  },
  'home-defence-bonus': {
    strength: { "the defenders' fortifications": THE_DEFENDERS_FORTIFICATIONS['home-defence-bonus'] },
  },
  'siege-bonus': { strength: { "the defenders' fortifications": THE_DEFENDERS_FORTIFICATIONS['siege-bonus'] } },
  'quiver-of-the-hawk': { volley: { 'the commander adds volleys': THE_COMMANDER_ADDS_VOLLEYS['quiver-of-the-hawk'] } },
  'quiver-of-many-arrows': {
    volley: { 'the commander adds volleys': THE_COMMANDER_ADDS_VOLLEYS['quiver-of-many-arrows'] },
  },
  'war-horn-of-the-plains': {
    fate: {
      "the commander's riders run the beaten down on any ground":
        THE_COMMANDERS_RIDERS_RUN_THE_BEATEN_DOWN_ON_ANY_GROUND['war-horn-of-the-plains'],
    },
  },
  'shield-wall-rune': { fate: { 'the beaten force may retreat': THE_BEATEN_FORCE_MAY_RETREAT['shield-wall-rune'] } },
} satisfies Record<MagicItemEffectSlug, MagicItemEffectEntry>;

/** Each stage's order: the entries with an effect at the stage, each once, in the order they run (the battle code's
 *  order before the registry took them). */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS = {
  strength: {
    "the commander's items": [
      'army-bonus',
      'cavalry-bonus',
      'infantry-bonus',
      'archer-bonus',
      'heavy-bonus',
      'naval-bonus',
      'fleet-strength',
      'admirals-spyglass',
      'chalice-of-dawn',
      'undead-bonus',
    ],
    'a land unit at sea, led': ['land-units-at-full-strength-at-sea'],
    // the defender's item first: the siege halves what home defence added
    "the defenders' fortifications": ['home-defence-bonus', 'siege-bonus'],
  },
  volley: { 'the commander adds volleys': ['quiver-of-the-hawk', 'quiver-of-many-arrows'] },
  fate: {
    "the commander's riders run the beaten down on any ground": ['war-horn-of-the-plains'],
    'the beaten force may retreat': ['shield-wall-rune'],
  },
} as const satisfies {
  readonly [H in HookPointName]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly MagicItemEffectSlug[];
  };
};

const ROWS: Readonly<Record<MagicItemEffectSlug, AMagicItemEffectAsItsTextsWriteIt>> =
  MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS;
const ENTRIES: Readonly<Record<MagicItemEffectSlug, MagicItemEffectEntry>> = THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS;

/** A held copy of an item, as the registry reads it: its name, its effect's key and the fields of its own an effect is
 *  carried by (each guarded: a copy may lack any of them). */
export type AMagicItemAsTheRegistryReadsIt = {
  readonly name?: string | null;
  readonly effect?: { readonly stat?: string | null } | null;
} & Partial<Readonly<Record<AnItemsOwnField, unknown>>>;

// Built once, as the file loads, from the content: which effects a key, a field or a base name carries.
const BY_STAT = new Map<string, MagicItemEffectSlug[]>();
const BY_FIELD: [AnItemsOwnField, MagicItemEffectSlug][] = [];
const BY_ITEM_NAME = new Map<string, MagicItemEffectSlug[]>();
const SLUGS = Object.keys(ROWS).filter((slug): slug is MagicItemEffectSlug => slug in ROWS);
for (const slug of SLUGS) {
  const key = ROWS[slug].carriedAs;
  if ('stat' in key) BY_STAT.set(key.stat, [...(BY_STAT.get(key.stat) ?? []), slug]);
  else if ('field' in key) BY_FIELD.push([key.field, slug]);
  else BY_ITEM_NAME.set(key.itemName, [...(BY_ITEM_NAME.get(key.itemName) ?? []), slug]);
}

/** The effects a held copy of an item carries: by its effect's key, by a field of its own that is set, and by its base
 *  name (a second name counts as its base's, as hasItemBase reads it). */
export function theEffectsAnItemCarries(item: AMagicItemAsTheRegistryReadsIt): MagicItemEffectSlug[] {
  const stat = item.effect?.stat;
  const carried = [...((stat == null ? undefined : BY_STAT.get(stat)) ?? [])];
  for (const [field, slug] of BY_FIELD) if (item[field]) carried.push(slug);
  if (item.name) carried.push(...(BY_ITEM_NAME.get((_ITEM_ALT_BASE[item.name] ?? '') || item.name) ?? []));
  return carried;
}

/** The effects a hero's items carry, all of them, once. */
function theEffectsTheseItemsCarry(items: readonly AMagicItemAsTheRegistryReadsIt[]): ReadonlySet<MagicItemEffectSlug> {
  return new Set(items.flatMap(theEffectsAnItemCarries));
}

/** The runner of "strength: the commander's items" (armStr): the strength of a unit he leads after the steps of the
 *  effects his items carry, in the stage's order, each rounded as it goes (strength added is not rounded). */
export function theStrengthAfterTheCommandersItems(
  facts: AUnitLedByACommander,
  theCommandersItems: readonly AMagicItemAsTheRegistryReadsIt[],
  theStrengthSoFar: number,
): number {
  const carried = theEffectsTheseItemsCarry(theCommandersItems);
  let str = theStrengthSoFar;
  for (const slug of THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.strength["the commander's items"]) {
    if (!carried.has(slug)) continue;
    const step = ENTRIES[slug].strength?.["the commander's items"]?.(facts);
    if (!step) continue;
    if ('adds' in step) str += step.adds;
    else if (step.dividedBy === undefined) str = Math.round(str * step.multipliesBy);
    else str = Math.round((str * step.multipliesBy) / step.dividedBy);
  }
  return str;
}

/** The runner of "strength: a land unit at sea, led" (armStr, beside Naval's eighth level): whether an effect the
 *  commander's items carry, in the stage's order, waives the sea's penalty to the land unit he leads. */
export function theSeasPenaltyIsWaivedByTheCommandersItems(
  facts: ALandUnitAtSeaLed,
  theCommandersItems: readonly AMagicItemAsTheRegistryReadsIt[],
): boolean {
  const carried = theEffectsTheseItemsCarry(theCommandersItems);
  return THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.strength['a land unit at sea, led'].some(
    (slug) => carried.has(slug) && ENTRIES[slug].strength?.['a land unit at sea, led']?.(facts) === true,
  );
}

/** The items of each side of a battle, as the runner of the defenders' fortifications asks them: each asked only when an
 *  effect would act for that side, and once (reading a commander's items tidies them: the battle code asked them
 *  so). Against neutral guards no defender's items are handed. */
export interface TheItemsOfEachSide {
  readonly theDefendersItems?: () => readonly AMagicItemAsTheRegistryReadsIt[];
  readonly theAttackersItems: () => readonly AMagicItemAsTheRegistryReadsIt[];
}

/** The runner of "strength: the defenders' fortifications" (both battles): the defenders' bonus after the effects
 *  each side's commander's items carry, in the stage's order, from the bonus so far, and the lines the battle writes
 *  for them, in that order. */
export function theDefendersFortificationsAfterTheCommandersItems(
  facts: Pick<TheDefendersFortificationsAndACommandersSide, 'theDefendersFightAtTheirHome'>,
  theItemsOfEachSide: TheItemsOfEachSide,
  theBonusSoFar: number,
): { readonly theBonus: number; readonly theLines: readonly TheFortificationsLine[] } {
  const sides = [
    ['the defender', theItemsOfEachSide.theDefendersItems],
    ['the attacker', theItemsOfEachSide.theAttackersItems],
  ] as const;
  const carried = new Map<TheDefendersFortificationsAndACommandersSide['hisSide'], ReadonlySet<MagicItemEffectSlug>>();
  const carriedBy = (
    side: TheDefendersFortificationsAndACommandersSide['hisSide'],
    items: () => readonly AMagicItemAsTheRegistryReadsIt[],
  ) => {
    const known = carried.get(side);
    if (known) return known;
    const found = theEffectsTheseItemsCarry(items());
    carried.set(side, found);
    return found;
  };
  let theBonus = theBonusSoFar;
  const theLines: TheFortificationsLine[] = [];
  for (const slug of THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.strength["the defenders' fortifications"]) {
    for (const [hisSide, items] of sides) {
      if (!items) continue;
      const after = ENTRIES[slug].strength?.["the defenders' fortifications"]?.({ ...facts, hisSide }, theBonus);
      if (!after || !carriedBy(hisSide, items).has(slug)) continue;
      theBonus = after.theBonus;
      theLines.push(after.theLine);
    }
  }
  return { theBonus, theLines };
}

/** The runner of "volley: the commander adds volleys" (both battles' volley before the battle): the volleys each
 *  missile unit the commander leads looses (one, and those the effects his items carry add, in the stage's order),
 *  and the lines the battle's opening line records, in that order. */
export function theVolleysTheCommandersItemsLoose(theCommandersItems: readonly AMagicItemAsTheRegistryReadsIt[]): {
  readonly theVolleys: number;
  readonly theLines: readonly TheVolleysLine[];
} {
  const carried = theEffectsTheseItemsCarry(theCommandersItems);
  let theVolleys = 1;
  const theLines: TheVolleysLine[] = [];
  for (const slug of THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.volley['the commander adds volleys']) {
    if (!carried.has(slug)) continue;
    const added = ENTRIES[slug].volley?.['the commander adds volleys']?.();
    if (!added) continue;
    theVolleys += added.theVolleysAdded;
    theLines.push(added.theLine);
  }
  return { theVolleys, theLines };
}

/** The runner of "fate: the commander's riders run the beaten down on any ground" (the rout's answer, handed to Ride
 *  Them Down): whether an effect the winning commander's items carry, in the stage's order, lets the pursuit run on any
 *  ground. */
export function theCommandersItemsLetHisRidersRunTheBeatenDownOnAnyGround(
  theCommandersItems: readonly AMagicItemAsTheRegistryReadsIt[],
): boolean {
  const carried = theEffectsTheseItemsCarry(theCommandersItems);
  return THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.fate["the commander's riders run the beaten down on any ground"].some(
    (slug) =>
      carried.has(slug) &&
      ENTRIES[slug].fate?.["the commander's riders run the beaten down on any ground"]?.() === true,
  );
}

/** The runner of "fate: the beaten force may retreat" (the battle against neutral guards' retreat): whether the beaten
 *  commander's force may retreat, unless an effect his items carry, in the stage's order, refuses it. */
export function theBeatenForceMayRetreatByTheCommandersItems(
  theCommandersItems: readonly AMagicItemAsTheRegistryReadsIt[],
): boolean {
  const carried = theEffectsTheseItemsCarry(theCommandersItems);
  return THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.fate['the beaten force may retreat'].every(
    (slug) => !carried.has(slug) || ENTRIES[slug].fate?.['the beaten force may retreat']?.() !== false,
  );
}
