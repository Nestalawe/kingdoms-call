// The items' index: which effects a held copy of an item carries, on plain values so the army card can share it (plan
// P1-11e37b, for P1-11e38): the maps built from the content as the file loads, the held item's type and the riders'
// type it names, moved as they were from rules/the-registry-of-magic-item-effects.ts (whose runners find the effects a
// hero's items carry here, once a call, and hand them to their stages) and rules/the-registry-of-content-effects.ts.
import {
  MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS,
  THE_STAT_OF_AN_ITEM_WORN_AS_ARMOUR,
  type AFieldOfACombatItemsEffect,
  type AMagicItemEffectAsItsTextsWriteIt,
  type AnItemsOwnField,
  type ARiderAnItemCarries,
  type MagicItemEffectSlug,
} from '../../content/magic-item-effects-their-names-numbers-and-words.ts';
import { _ITEM_ALT_BASE } from './items-slots-races-and-who-may-use-them.ts';

/** The riders a fighter wears beside his wards (pcApplyFx writes them on him, the hit bonus on his status). */
export interface TheRidersAFighterWears {
  readonly aura?: number | undefined;
  readonly burn?: number | undefined;
  readonly drain?: number | undefined;
  readonly hitBonus?: number | undefined;
  readonly dmgBonus?: number | undefined;
}

const ROWS: Readonly<Record<MagicItemEffectSlug, AMagicItemEffectAsItsTextsWriteIt>> =
  MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS;

/** A held copy of an item, as the registry reads it: its name, its effect's key, its armour's ward and its riders, and
 *  the fields of its own an effect is carried by (each guarded: a copy may lack any of them). */
export type AMagicItemAsTheRegistryReadsIt = {
  readonly name?: string | null | undefined;
  readonly effect?:
    | {
        readonly stat?: string | null | undefined;
        readonly use?: string | null | undefined;
        readonly doubleVs?: readonly string[] | null | undefined;
        readonly bonus?: unknown;
        readonly temper?: string | null | undefined;
        readonly ward?: string | null | undefined;
        readonly pc?: (TheRidersAFighterWears & { readonly ward?: string | null | undefined }) | null | undefined;
      }
    | null
    | undefined;
} & Partial<Readonly<Record<AnItemsOwnField, unknown>>>;

// Built once, as the file loads, from the content: which effects a key, a field, a base name, a ward or a rider
// carries (one effect a ward: the content's rows name each ward once).
const BY_STAT = new Map<string, MagicItemEffectSlug[]>();
const BY_FIELD: [AnItemsOwnField, MagicItemEffectSlug][] = [];
const BY_ITEM_NAME = new Map<string, MagicItemEffectSlug[]>();
const BY_WARD = new Map<string, MagicItemEffectSlug>();
export const BY_RIDER: [ARiderAnItemCarries, MagicItemEffectSlug][] = [];
const BY_USE = new Map<string, MagicItemEffectSlug>();
export const BY_EFFECT_FIELD: [AFieldOfACombatItemsEffect, MagicItemEffectSlug][] = [];
const SLUGS = Object.keys(ROWS).filter((slug): slug is MagicItemEffectSlug => slug in ROWS);
for (const slug of SLUGS) {
  const key = ROWS[slug].carriedAs;
  if ('stat' in key) BY_STAT.set(key.stat, [...(BY_STAT.get(key.stat) ?? []), slug]);
  else if ('field' in key) BY_FIELD.push([key.field, slug]);
  else if ('itemName' in key) BY_ITEM_NAME.set(key.itemName, [...(BY_ITEM_NAME.get(key.itemName) ?? []), slug]);
  else if ('ward' in key) BY_WARD.set(key.ward, slug);
  else if ('rider' in key) BY_RIDER.push([key.rider, slug]);
  else if ('use' in key) BY_USE.set(key.use, slug);
  else BY_EFFECT_FIELD.push([key.effectField, slug]);
}
/** The effect a ward carries, by its kind, or none. */
export const theEffectAWardCarries = (ward: string | null | undefined) =>
  ward == null ? undefined : BY_WARD.get(ward);
/** The effect a combat item's use carries, or none. */
export const theEffectAUseCarries = (use: string | null | undefined) => (use == null ? undefined : BY_USE.get(use));

/** The effects a held copy of an item carries: by its effect's key, by a field of its own that is set, by its base
 *  name (a second name counts as its base's, as hasItemBase reads it), by its armour's ward and its rider's, by each
 *  rider it carries above 0, by its combat use, and by a field of its effect that is set. */
export function theEffectsAnItemCarries(item: AMagicItemAsTheRegistryReadsIt): MagicItemEffectSlug[] {
  const stat = item.effect?.stat;
  const carried = [...((stat == null ? undefined : BY_STAT.get(stat)) ?? [])];
  for (const [field, slug] of BY_FIELD) if (item[field]) carried.push(slug);
  if (item.name) carried.push(...(BY_ITEM_NAME.get((_ITEM_ALT_BASE[item.name] ?? '') || item.name) ?? []));
  const worn = anItemIsWornAsArmour(item) ? theEffectAWardCarries(item.effect?.ward) : undefined;
  if (worn) carried.push(worn);
  const pc = item.effect?.pc;
  if (pc) {
    const ridden = theEffectAWardCarries(pc.ward);
    if (ridden) carried.push(ridden);
    for (const [rider, slug] of BY_RIDER) if ((pc[rider] ?? 0) > 0) carried.push(slug);
  }
  const used = theEffectAUseCarries(item.effect?.use);
  if (used) carried.push(used);
  for (const [field, slug] of BY_EFFECT_FIELD) if (item.effect?.[field]) carried.push(slug);
  return carried;
}

/** Whether a held item is worn as armour: its effect is a ward, which personal combat merges into the wards its bearer
 *  wears (pcArmourOf). */
export function anItemIsWornAsArmour(item: AMagicItemAsTheRegistryReadsIt): boolean {
  return item.effect?.stat === THE_STAT_OF_AN_ITEM_WORN_AS_ARMOUR;
}

/** The effects a hero's items carry, all of them, once. */
export function theEffectsTheseItemsCarry(
  items: readonly AMagicItemAsTheRegistryReadsIt[],
): ReadonlySet<MagicItemEffectSlug> {
  return new Set(items.flatMap(theEffectsAnItemCarries));
}
