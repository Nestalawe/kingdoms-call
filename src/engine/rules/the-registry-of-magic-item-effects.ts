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
  A_HEROS_ITEMS_ADD_TO_THE_REALMS_TAX,
  A_LAIR_REVEALED_WHEN_EXPLORING,
  A_MOVES_EXPLORATION,
  A_RESTS_HEAL,
  A_SPYS_SURE_SUCCESS,
  AN_ITEMS_POWER_USED,
} from './magic-items/a-heros-items-in-the-realms-tax-and-in-his-orders.ts';
import {
  THE_BEATEN_FORCE_MAY_RETREAT,
  THE_COMMANDER_ADDS_VOLLEYS,
  THE_COMMANDERS_RIDERS_RUN_THE_BEATEN_DOWN_ON_ANY_GROUND,
  THE_DEFENDERS_FORTIFICATIONS,
} from './magic-items/the-commanders-items-at-the-walls-the-volley-and-the-rout.ts';
import { A_LAND_UNIT_AT_SEA_LED, THE_COMMANDERS_ITEMS } from './magic-items/the-commanders-items-in-a-battle.ts';
import type {
  AHeroAtRest,
  ALandUnitAtSeaLed,
  AUnitLedByACommander,
  HookPointName,
  TheDefendersFortificationsAndACommandersSide,
  TheFortificationsLine,
  TheStagesOfEachHookPoint,
  ThePowerAnItemWorksWhenUsed,
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
  'tax-bonus': {
    turnEnd: { "a hero's items add to the realm's tax": A_HEROS_ITEMS_ADD_TO_THE_REALMS_TAX['tax-bonus'] },
  },
  'tax-per-province': {
    turnEnd: { "a hero's items add to the realm's tax": A_HEROS_ITEMS_ADD_TO_THE_REALMS_TAX['tax-per-province'] },
  },
  'crystal-orb': { orderOutcome: { "a spy's sure success": A_SPYS_SURE_SUCCESS['crystal-orb'] } },
  'philosophers-lens': {
    orderOutcome: { 'a lair revealed when exploring': A_LAIR_REVEALED_WHEN_EXPLORING['philosophers-lens'] },
  },
  'iron-heart-talisman': { orderOutcome: { "a rest's heal": A_RESTS_HEAL['iron-heart-talisman'] } },
  'travellers-cloak': { orderOutcome: { "a move's exploration": A_MOVES_EXPLORATION['travellers-cloak'] } },
  'philosophers-stone': { orderOutcome: { "an item's power used": AN_ITEMS_POWER_USED['philosophers-stone'] } },
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
  // the flat gold first, as Early Winter added it: the gold for each province is counted apart
  turnEnd: { "a hero's items add to the realm's tax": ['tax-bonus', 'tax-per-province'] },
  orderOutcome: {
    "a spy's sure success": ['crystal-orb'],
    'a lair revealed when exploring': ['philosophers-lens'],
    "a rest's heal": ['iron-heart-talisman'],
    "a move's exploration": ['travellers-cloak'],
    "an item's power used": ['philosophers-stone'],
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
  readonly effect?: { readonly stat?: string | null; readonly bonus?: unknown } | null;
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

/** What a realm's heroes' items add to its tax at the turn's end, before the realm's ceiling on bonus gold. */
export interface TheTaxTheHeroesItemsAdd {
  /** The gold of every item, summed hero by hero. */
  readonly theGold: number;
  /** The most any one item gives for each province the realm holds (0 when none does): counted once. */
  readonly theGoldForEachProvince: number;
}

/** The runner of "turnEnd: a hero's items add to the realm's tax" (Early Winter): handed each hero's active items, in
 *  the realm's order of its heroes; each item's effects in the stage's order. */
export function theTaxTheHeroesItemsAdd(
  theItemsOfEachHero: readonly (readonly AMagicItemAsTheRegistryReadsIt[])[],
): TheTaxTheHeroesItemsAdd {
  const order = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.turnEnd["a hero's items add to the realm's tax"];
  let theGoldForEachProvince = 0;
  const theGoldOf = (item: AMagicItemAsTheRegistryReadsIt): number => {
    const carried = theEffectsAnItemCarries(item);
    let gold = 0;
    for (const slug of order) {
      if (!carried.includes(slug)) continue;
      const added = ENTRIES[slug].turnEnd?.["a hero's items add to the realm's tax"]?.(item);
      if (!added) continue;
      if ('gold' in added) gold += added.gold;
      else theGoldForEachProvince = Math.max(theGoldForEachProvince, added.goldForEachProvince);
    }
    return gold;
  };
  const theGold = theItemsOfEachHero.reduce((s, items) => s + items.reduce((a, it) => a + theGoldOf(it), 0), 0);
  return { theGold, theGoldForEachProvince };
}

/** The runner of "orderOutcome: a spy's sure success" (resolveSpyOrder): whether an effect the spy's items carry, in the
 *  stage's order, makes his Spy order succeed without a roll. */
export function theSpysItemsMakeHisSpySure(theSpysItems: readonly AMagicItemAsTheRegistryReadsIt[]): boolean {
  const carried = theEffectsTheseItemsCarry(theSpysItems);
  return THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.orderOutcome["a spy's sure success"].some(
    (slug) => carried.has(slug) && ENTRIES[slug].orderOutcome?.["a spy's sure success"]?.() === true,
  );
}

/** The runner of "orderOutcome: a lair revealed when exploring" (resolveExploreOrder): whether an effect the explorer's
 *  items carry, in the stage's order, reveals one more lair. */
export function theExplorersItemsRevealALair(theExplorersItems: readonly AMagicItemAsTheRegistryReadsIt[]): boolean {
  const carried = theEffectsTheseItemsCarry(theExplorersItems);
  return THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.orderOutcome['a lair revealed when exploring'].some(
    (slug) => carried.has(slug) && ENTRIES[slug].orderOutcome?.['a lair revealed when exploring']?.() === true,
  );
}

/** The runner of "orderOutcome: a rest's heal" (resolveRestOrder): the hit points the effects the resting hero's items
 *  carry add, each once, in the stage's order. */
export function theHealTheRestersItemsAdd(
  facts: AHeroAtRest,
  theRestersItems: readonly AMagicItemAsTheRegistryReadsIt[],
): number {
  const carried = theEffectsTheseItemsCarry(theRestersItems);
  let heal = 0;
  for (const slug of THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.orderOutcome["a rest's heal"]) {
    if (!carried.has(slug)) continue;
    heal += ENTRIES[slug].orderOutcome?.["a rest's heal"]?.(facts) ?? 0;
  }
  return heal;
}

/** The runner of "orderOutcome: a move's exploration" (resolveMoveOrder): the share of the province the mover's items
 *  explore more, item by item in the order he holds them, each item's effects in the stage's order. */
export function theExplorationTheMoversItemsAdd(theMoversItems: readonly AMagicItemAsTheRegistryReadsIt[]): number {
  const order = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.orderOutcome["a move's exploration"];
  let share = 0;
  for (const item of theMoversItems) {
    const carried = theEffectsAnItemCarries(item);
    for (const slug of order) {
      if (!carried.includes(slug)) continue;
      share += ENTRIES[slug].orderOutcome?.["a move's exploration"]?.(item) ?? 0;
    }
  }
  return share;
}

/** The runner of "orderOutcome: an item's power used" (resolveUseItemOrder; botItemPre): the power the first effect a
 *  held item carries, in the stage's order, works when it is used, or nothing (a passive item). */
export function thePowerAnItemWorksWhenUsed(item: AMagicItemAsTheRegistryReadsIt): ThePowerAnItemWorksWhenUsed | null {
  const carried = theEffectsAnItemCarries(item);
  for (const slug of THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.orderOutcome["an item's power used"]) {
    if (!carried.includes(slug)) continue;
    const power = ENTRIES[slug].orderOutcome?.["an item's power used"]?.();
    if (power) return power;
  }
  return null;
}
