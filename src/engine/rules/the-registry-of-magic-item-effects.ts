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
  THE_STAT_OF_AN_ITEM_WORN_AS_ARMOUR,
  type AMagicItemEffectAsItsTextsWriteIt,
  type AnItemsOwnField,
  type ARiderAnItemCarries,
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
  A_HEROS_MAXIMUM_HP,
  A_SKILLS_AURA_IN_THE_PROVINCE,
  THE_TEMPER_HE_FIGHTS_WITH,
} from './magic-items/a-heros-items-in-his-standing.ts';
import {
  THE_BEATEN_FORCE_MAY_RETREAT,
  THE_COMMANDER_ADDS_VOLLEYS,
  THE_COMMANDERS_RIDERS_RUN_THE_BEATEN_DOWN_ON_ANY_GROUND,
  THE_DEFENDERS_FORTIFICATIONS,
} from './magic-items/the-commanders-items-at-the-walls-the-volley-and-the-rout.ts';
import { A_LAND_UNIT_AT_SEA_LED, THE_COMMANDERS_ITEMS } from './magic-items/the-commanders-items-in-a-battle.ts';
import {
  A_FIGHTER_IN_MITHRIL,
  A_RIDER_A_FIGHTER_WEARS,
  A_WARD_A_FIGHTER_WEARS,
} from './magic-items/what-a-fighter-wears-in-a-personal-combat.ts';
import {
  A_BLOW_LANDS,
  A_BLOWS_CHANCE_TO_HIT,
  A_HIT_LANDS_AFTER_IT,
  A_HIT_LANDS_BEFORE_ALL_ELSE,
  A_HIT_LANDS_HIS_WARDS_CAP_IT,
  A_HIT_LANDS_HIS_WARDS_CUT_IT,
  A_ROUND_STARTS,
  A_SPELLS_BURN_TAKES_HOLD,
  A_STUN_OR_A_TERROR_TAKES_HOLD,
  THE_DAMAGE_A_MITHRIL_SUIT_TURNS_ASIDE,
} from './magic-items/what-a-ward-does-in-a-personal-combat.ts';
import type {
  AFighterAsHisWardsMeetHimAfterAHit,
  AHitAsAFightersWardsCapIt,
  AHitAsAFightersWardsCutIt,
  AHitAsAFightersWardsMeetItFirst,
  AWardsCapOnAHit,
  TheHarmAWardBitesBackWith,
  TheHpAWardGivesBack,
  WhatAFightersWardsDoAsARoundStarts,
  WhatAFightersWardsLeaveOfAHit,
  WhatAWardDoesToAHitFirst,
  AHeroAtRest,
  ALandUnitAtSeaLed,
  AUnitLedByACommander,
  AWardAsTheMergeReadsIt,
  HookPointName,
  TheAuraAnItemSpreads,
  TheDefendersFortificationsAndACommandersSide,
  TheFortificationsLine,
  TheStagesOfEachHookPoint,
  ThePowerAnItemWorksWhenUsed,
  TheRidersAFighterWears,
  TheVolleysLine,
  TheWardsAFighterWears,
  TheWardsAsTheirEffectsReadThem,
  WhatAWardSets,
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
  'maximum-hp': { aHerosStanding: { 'maximum HP': A_HEROS_MAXIMUM_HP['maximum-hp'] } },
  temper: { aHerosStanding: { 'the temper he fights with': THE_TEMPER_HE_FIGHTS_WITH.temper } },
  'crown-of-command': {
    aHerosStanding: { "a skill's aura in the province": A_SKILLS_AURA_IN_THE_PROVINCE['crown-of-command'] },
  },
  'melee-damage-turned-aside': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['melee-damage-turned-aside'],
      'a hit lands on a fighter: his wards cut it': A_HIT_LANDS_HIS_WARDS_CUT_IT['melee-damage-turned-aside'],
    },
  },
  'arrow-damage-turned-aside': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['arrow-damage-turned-aside'],
      'a hit lands on a fighter: his wards cut it': A_HIT_LANDS_HIS_WARDS_CUT_IT['arrow-damage-turned-aside'],
    },
  },
  'nature-damage-turned-aside': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['nature-damage-turned-aside'],
      'a hit lands on a fighter: his wards cut it': A_HIT_LANDS_HIS_WARDS_CUT_IT['nature-damage-turned-aside'],
    },
  },
  'dark-damage-turned-aside': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['dark-damage-turned-aside'],
      'a hit lands on a fighter: his wards cut it': A_HIT_LANDS_HIS_WARDS_CUT_IT['dark-damage-turned-aside'],
    },
  },
  thorns: {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS.thorns,
      'a blow lands': A_BLOW_LANDS.thorns,
    },
  },
  regeneration: {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS.regeneration,
      'a round starts': A_ROUND_STARTS.regeneration,
    },
  },
  'spell-damage-cut': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['spell-damage-cut'],
      'a hit lands on a fighter: his wards cut it': A_HIT_LANDS_HIS_WARDS_CUT_IT['spell-damage-cut'],
      "a spell's burn takes hold": A_SPELLS_BURN_TAKES_HOLD['spell-damage-cut'],
    },
  },
  dodge: {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS.dodge,
      "a blow's chance to hit": A_BLOWS_CHANCE_TO_HIT.dodge,
    },
  },
  block: {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS.block,
      'a hit lands on a fighter: before all else': A_HIT_LANDS_BEFORE_ALL_ELSE.block,
    },
  },
  'a-hits-damage-capped': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['a-hits-damage-capped'],
      'a hit lands on a fighter: his wards cap it': A_HIT_LANDS_HIS_WARDS_CAP_IT['a-hits-damage-capped'],
    },
  },
  'second-wind': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['second-wind'],
      'a hit lands on a fighter: after it': A_HIT_LANDS_AFTER_IT['second-wind'],
    },
  },
  'damage-cut-at-low-hp': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['damage-cut-at-low-hp'],
      'a hit lands on a fighter: his wards cut it': A_HIT_LANDS_HIS_WARDS_CUT_IT['damage-cut-at-low-hp'],
    },
  },
  'the-first-hit-drunk': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['the-first-hit-drunk'],
      'a hit lands on a fighter: before all else': A_HIT_LANDS_BEFORE_ALL_ELSE['the-first-hit-drunk'],
    },
  },
  'lingering-harm-turned-aside': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['lingering-harm-turned-aside'],
      'a round starts': A_ROUND_STARTS['lingering-harm-turned-aside'],
    },
  },
  resist: {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS.resist,
      'a round starts': A_ROUND_STARTS.resist,
    },
  },
  'arrow-block': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['arrow-block'],
      'a hit lands on a fighter: before all else': A_HIT_LANDS_BEFORE_ALL_ELSE['arrow-block'],
    },
  },
  buckler: { personalCombat: { 'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS.buckler } },
  'open-guard': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['open-guard'],
      'a hit lands on a fighter: his wards cut it': A_HIT_LANDS_HIS_WARDS_CUT_IT['open-guard'],
    },
  },
  'spell-block': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['spell-block'],
      'a hit lands on a fighter: before all else': A_HIT_LANDS_BEFORE_ALL_ELSE['spell-block'],
    },
  },
  'round-ward': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['round-ward'],
      'a hit lands on a fighter: before all else': A_HIT_LANDS_BEFORE_ALL_ELSE['round-ward'],
      'a round starts': A_ROUND_STARTS['round-ward'],
    },
  },
  'stun-immunity': {
    personalCombat: {
      'what a fighter wears: a ward': A_WARD_A_FIGHTER_WEARS['stun-immunity'],
      'a stun or a terror takes hold': A_STUN_OR_A_TERROR_TAKES_HOLD['stun-immunity'],
    },
  },
  'aura-rider': { personalCombat: { 'what a fighter wears: a rider': A_RIDER_A_FIGHTER_WEARS['aura-rider'] } },
  'burn-rider': { personalCombat: { 'what a fighter wears: a rider': A_RIDER_A_FIGHTER_WEARS['burn-rider'] } },
  'drain-rider': { personalCombat: { 'what a fighter wears: a rider': A_RIDER_A_FIGHTER_WEARS['drain-rider'] } },
  'hit-bonus-rider': {
    personalCombat: { 'what a fighter wears: a rider': A_RIDER_A_FIGHTER_WEARS['hit-bonus-rider'] },
  },
  'damage-bonus-rider': {
    personalCombat: { 'what a fighter wears: a rider': A_RIDER_A_FIGHTER_WEARS['damage-bonus-rider'] },
  },
  'mithril-armour': {
    personalCombat: {
      'what a fighter wears: Mithril': A_FIGHTER_IN_MITHRIL['mithril-armour'],
      'a hit lands on a fighter: before all else': A_HIT_LANDS_BEFORE_ALL_ELSE['mithril-armour'],
    },
  },
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
  aHerosStanding: {
    'maximum HP': ['maximum-hp'],
    'the temper he fights with': ['temper'],
    "a skill's aura in the province": ['crown-of-command'],
  },
  personalCombat: {
    // a ward meets one effect, its own kind's: the order is pcArmourMerge's cases'
    'what a fighter wears: a ward': [
      'melee-damage-turned-aside',
      'arrow-damage-turned-aside',
      'nature-damage-turned-aside',
      'dark-damage-turned-aside',
      'thorns',
      'regeneration',
      'spell-damage-cut',
      'dodge',
      'block',
      'a-hits-damage-capped',
      'second-wind',
      'damage-cut-at-low-hp',
      'the-first-hit-drunk',
      'lingering-harm-turned-aside',
      'resist',
      'arrow-block',
      'buckler',
      'open-guard',
      'spell-block',
      'round-ward',
      'stun-immunity',
    ],
    // as pcApplyFx wrote them: the aura, the burn, the drain, the hit bonus, the damage bonus (each its own field)
    'what a fighter wears: a rider': [
      'aura-rider',
      'burn-rider',
      'drain-rider',
      'hit-bonus-rider',
      'damage-bonus-rider',
    ],
    'what a fighter wears: Mithril': ['mithril-armour'],
    // what each ward does in the fight (plan P1-19r), each stage in the code's order
    "a blow's chance to hit": ['dodge'],
    'a hit lands on a fighter: before all else': [
      'the-first-hit-drunk',
      'block',
      'arrow-block',
      'spell-block',
      'round-ward',
      'mithril-armour',
    ],
    'a hit lands on a fighter: his wards cut it': [
      'melee-damage-turned-aside',
      'arrow-damage-turned-aside',
      'nature-damage-turned-aside',
      'dark-damage-turned-aside',
      'spell-damage-cut',
      'damage-cut-at-low-hp',
      'open-guard',
    ],
    'a hit lands on a fighter: his wards cap it': ['a-hits-damage-capped'],
    'a hit lands on a fighter: after it': ['second-wind'],
    'a blow lands': ['thorns'],
    'a round starts': ['round-ward', 'lingering-harm-turned-aside', 'regeneration', 'resist'],
    'a stun or a terror takes hold': ['stun-immunity'],
    "a spell's burn takes hold": ['spell-damage-cut'],
  },
} as const satisfies {
  readonly [H in HookPointName]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly MagicItemEffectSlug[];
  };
};

const ROWS: Readonly<Record<MagicItemEffectSlug, AMagicItemEffectAsItsTextsWriteIt>> =
  MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS;
const ENTRIES: Readonly<Record<MagicItemEffectSlug, MagicItemEffectEntry>> = THE_REGISTRY_OF_MAGIC_ITEM_EFFECTS;

/** A held copy of an item, as the registry reads it: its name, its effect's key, its armour's ward and its riders, and
 *  the fields of its own an effect is carried by (each guarded: a copy may lack any of them). */
export type AMagicItemAsTheRegistryReadsIt = {
  readonly name?: string | null | undefined;
  readonly effect?:
    | {
        readonly stat?: string | null | undefined;
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
const BY_RIDER: [ARiderAnItemCarries, MagicItemEffectSlug][] = [];
const SLUGS = Object.keys(ROWS).filter((slug): slug is MagicItemEffectSlug => slug in ROWS);
for (const slug of SLUGS) {
  const key = ROWS[slug].carriedAs;
  if ('stat' in key) BY_STAT.set(key.stat, [...(BY_STAT.get(key.stat) ?? []), slug]);
  else if ('field' in key) BY_FIELD.push([key.field, slug]);
  else if ('itemName' in key) BY_ITEM_NAME.set(key.itemName, [...(BY_ITEM_NAME.get(key.itemName) ?? []), slug]);
  else if ('ward' in key) BY_WARD.set(key.ward, slug);
  else BY_RIDER.push([key.rider, slug]);
}
/** The effect a ward carries, by its kind, or none. */
const theEffectAWardCarries = (ward: string | null | undefined) => (ward == null ? undefined : BY_WARD.get(ward));

/** The effects a held copy of an item carries: by its effect's key, by a field of its own that is set, by its base
 *  name (a second name counts as its base's, as hasItemBase reads it), by its armour's ward and its rider's, and by
 *  each rider it carries above 0. */
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
  return carried;
}

/** Whether a held item is worn as armour: its effect is a ward, which personal combat merges into the wards its bearer
 *  wears (pcArmourOf). */
export function anItemIsWornAsArmour(item: AMagicItemAsTheRegistryReadsIt): boolean {
  return item.effect?.stat === THE_STAT_OF_AN_ITEM_WORN_AS_ARMOUR;
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

/** The runner of "aHerosStanding: maximum HP" (itemMaxHpBonus): the hit points a hero's items add to his maximum, item
 *  by item in the order he holds them, each item's effects in the stage's order; a second copy of a name that has
 *  added counts no more. */
export function theMaximumHpAHerosItemsAdd(theHerosItems: readonly AMagicItemAsTheRegistryReadsIt[]): number {
  const order = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.aHerosStanding['maximum HP'];
  const seen = new Set<string | null | undefined>();
  let hp = 0;
  for (const item of theHerosItems) {
    const carried = theEffectsAnItemCarries(item).filter((slug) => order.some((s) => s === slug));
    if (!carried.length || seen.has(item.name)) continue;
    seen.add(item.name);
    for (const slug of order)
      if (carried.includes(slug)) hp += ENTRIES[slug].aHerosStanding?.['maximum HP']?.(item) ?? 0;
  }
  return hp;
}

/** Whether a held item carries an effect at "aHerosStanding: maximum HP" (applyItemMaxHp: an item granted or lost that
 *  carries none leaves the maximum as it is). */
export function anItemChangesAHerosMaximumHp(item: AMagicItemAsTheRegistryReadsIt): boolean {
  const order: readonly MagicItemEffectSlug[] = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.aHerosStanding['maximum HP'];
  return theEffectsAnItemCarries(item).some((slug) => order.includes(slug));
}

/** The runner of "aHerosStanding: the temper he fights with" (effTemper): the temper the first of a hero's items, in
 *  the order he holds them, gives him (its first effect in the stage's order that gives one), or nothing. */
export function theTemperAHerosItemsGiveHim(theHerosItems: readonly AMagicItemAsTheRegistryReadsIt[]): string | null {
  const order = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.aHerosStanding['the temper he fights with'];
  for (const item of theHerosItems) {
    const carried = theEffectsAnItemCarries(item);
    for (const slug of order) {
      if (!carried.includes(slug)) continue;
      const temper = ENTRIES[slug].aHerosStanding?.['the temper he fights with']?.(item);
      if (temper) return temper;
    }
  }
  return null;
}

/** The runner of "aHerosStanding: a skill's aura in the province" (skillBonusBreakdown, asked of each hero of the
 *  realm in the province in turn): the aura the first effect a hero's items carry, in the stage's order, spreads, or
 *  nothing. */
export function theAuraAHerosItemsSpread(
  theHerosItems: readonly AMagicItemAsTheRegistryReadsIt[],
): TheAuraAnItemSpreads | null {
  const carried = theEffectsTheseItemsCarry(theHerosItems);
  for (const slug of THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.aHerosStanding["a skill's aura in the province"]) {
    if (!carried.has(slug)) continue;
    const aura = ENTRIES[slug].aHerosStanding?.["a skill's aura in the province"]?.();
    if (aura) return aura;
  }
  return null;
}

/** The runner of "personalCombat: what a fighter wears: a ward" (pcArmourMerge: his armour, an item's rider or a
 *  guardian's perk): what the effect of the ward's own kind sets in the wards he wears, from the wards so far, or
 *  nothing when the registry holds no effect of its kind (a guardian's perks' own wards, merged by pcArmourMerge). */
export function whatAWardSetsInTheWardsAFighterWears(
  theWard: AWardAsTheMergeReadsIt,
  theWardsSoFar: Readonly<TheWardsAFighterWears>,
): WhatAWardSets | null {
  const slug = theEffectAWardCarries(theWard.ward);
  const effect = slug === undefined ? undefined : ENTRIES[slug].personalCombat?.['what a fighter wears: a ward'];
  return effect ? effect(theWard, theWardsSoFar) : null;
}

/** The runner of "personalCombat: what a fighter wears: a rider" (pcApplyFx: an item's riders or a guardian's perk's):
 *  what the riders carried, each above 0, set in the riders he wears, from the riders so far, in the stage's order
 *  (each sets its own field: the fields none sets are left out). */
export function whatRidersSetInTheRidersAFighterWears(
  theRiders: TheRidersAFighterWears,
  theRidersSoFar: TheRidersAFighterWears,
): TheRidersAFighterWears {
  const carried = new Set(BY_RIDER.filter(([rider]) => (theRiders[rider] ?? 0) > 0).map(([, slug]) => slug));
  let set: TheRidersAFighterWears = {};
  for (const slug of THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.personalCombat['what a fighter wears: a rider']) {
    if (!carried.has(slug)) continue;
    const effect = ENTRIES[slug].personalCombat?.['what a fighter wears: a rider'];
    if (effect) set = { ...set, ...effect(theRiders, theRidersSoFar) };
  }
  return set;
}

/** The runner of "personalCombat: what a fighter wears: Mithril" (pcCharCombatant): whether an effect his items carry,
 *  in the stage's order, makes him fight in Mithril. */
export function theItemsMakeTheirBearerFightInMithril(theItems: readonly AMagicItemAsTheRegistryReadsIt[]): boolean {
  const carried = theEffectsTheseItemsCarry(theItems);
  return THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.personalCombat['what a fighter wears: Mithril'].some(
    (slug) => carried.has(slug) && ENTRIES[slug].personalCombat?.['what a fighter wears: Mithril']?.() === true,
  );
}

// ── What each ward does in the fight (plan P1-19r): a runner a stage, each running the stage's effects in its order on
// the wards the fighter wears (pcArmourMerge's table); personal combat applies what they return. ──
const THE_WARDS_STAGES = THE_ORDER_OF_EACH_STAGE_OF_THE_ITEMS.personalCombat;

/** What the Mithril suit turns aside of a melee blow or an arrow, before a realm's Mithril Craft (pcCharCombatant's
 *  mithrilDR). */
export function theDamageAMithrilSuitTurnsAside(): number {
  return THE_DAMAGE_A_MITHRIL_SUIT_TURNS_ASIDE;
}

/** The runner of "personalCombat: a blow's chance to hit" (pcHitChance, pcArrowHitChance): what the wards he wears
 *  take off a blow's or an arrow's chance to hit him, each effect's share in the stage's order (none worn: 0). */
export function whatAFightersWardsTakeOffAChanceToHitHim(
  theWards: TheWardsAsTheirEffectsReadThem | null | undefined,
): number {
  let taken = 0;
  if (!theWards) return taken;
  for (const slug of THE_WARDS_STAGES["a blow's chance to hit"]) {
    const effect = ENTRIES[slug].personalCombat?.["a blow's chance to hit"];
    if (effect) taken += effect(theWards);
  }
  return taken;
}

/** The runner of "personalCombat: a hit lands on a fighter: before all else" (pcTakeHit): what each ward does to the
 *  hit, in the stage's order, each handed the damage the ones before it left. pcTakeHit applies them in that order and
 *  stops where one ends the hit (it rolls a shield's chance where it rolled it). */
export function whatAFightersWardsDoToAHitBeforeAllElse(
  theHit: AHitAsAFightersWardsMeetItFirst,
): WhatAWardDoesToAHitFirst[] {
  const done: WhatAWardDoesToAHitFirst[] = [];
  let theDamageSoFar = theHit.theDamageSoFar;
  for (const slug of THE_WARDS_STAGES['a hit lands on a fighter: before all else']) {
    const effect = ENTRIES[slug].personalCombat?.['a hit lands on a fighter: before all else'];
    const step = effect ? effect({ ...theHit, theDamageSoFar }) : null;
    if (!step) continue;
    done.push(step);
    if ('theDamageAfter' in step) theDamageSoFar = step.theDamageAfter;
  }
  return done;
}

/** The runner of "personalCombat: a hit lands on a fighter: his wards cut it" (pcTakeHit): what the wards he wears
 *  leave of the hit, each effect cutting what the ones before it left, in the stage's order; whether his open guard
 *  took it; and the ward the line names (the harm's channel's: melee, arrow, else spell). */
export function whatAFightersWardsLeaveOfAHit(theHit: AHitAsAFightersWardsCutIt): WhatAFightersWardsLeaveOfAHit {
  let theDamageSoFar = theHit.theDamageSoFar;
  let hisOpenGuardTookIt = false;
  for (const slug of THE_WARDS_STAGES['a hit lands on a fighter: his wards cut it']) {
    const effect = ENTRIES[slug].personalCombat?.['a hit lands on a fighter: his wards cut it'];
    const cut = effect ? effect({ ...theHit, theDamageSoFar }) : null;
    if (!cut) continue;
    theDamageSoFar = cut.theDamageAfter;
    if (cut.hisOpenGuardTakesIt) hisOpenGuardTookIt = true;
  }
  const theWardTheLineNames =
    theHit.theChannel === 'melee' ? 'meleeDR' : theHit.theChannel === 'archery' ? 'arrowDR' : 'spellPct';
  return { theDamageAfter: theDamageSoFar, hisOpenGuardTookIt, theWardTheLineNames };
}

/** The runner of "personalCombat: a hit lands on a fighter: his wards cap it" (pcTakeHit): the first ward's ceiling,
 *  in the stage's order, on a hit that would bite deeper, or nothing. */
export function theCapAFightersWardsPutOnAHit(theHit: AHitAsAFightersWardsCapIt): AWardsCapOnAHit | null {
  for (const slug of THE_WARDS_STAGES['a hit lands on a fighter: his wards cap it']) {
    const cap = ENTRIES[slug].personalCombat?.['a hit lands on a fighter: his wards cap it']?.(theHit);
    if (cap) return cap;
  }
  return null;
}

/** The runner of "personalCombat: a hit lands on a fighter: after it" (pcTakeHit): the hit points the first ward, in
 *  the stage's order, gives back once the hit is dealt, or nothing. */
export function theHpAFightersWardsGiveBackAfterAHit(
  theFighter: AFighterAsHisWardsMeetHimAfterAHit,
): TheHpAWardGivesBack | null {
  for (const slug of THE_WARDS_STAGES['a hit lands on a fighter: after it']) {
    const back = ENTRIES[slug].personalCombat?.['a hit lands on a fighter: after it']?.(theFighter);
    if (back) return back;
  }
  return null;
}

/** The runner of "personalCombat: a blow lands" (pcMeleeStrike): what the first ward of the struck fighter, in the
 *  stage's order, bites back with at the striker, or nothing (none worn: nothing). */
export function whatAFightersWardsBiteBackWith(
  theWards: TheWardsAsTheirEffectsReadThem | null | undefined,
): TheHarmAWardBitesBackWith | null {
  if (!theWards) return null;
  for (const slug of THE_WARDS_STAGES['a blow lands']) {
    const bite = ENTRIES[slug].personalCombat?.['a blow lands']?.(theWards);
    if (bite) return bite;
  }
  return null;
}

/** The runner of "personalCombat: a round starts" (pcRoundStart): what the wards he wears do as the round starts, each
 *  effect's fields in the stage's order. */
export function whatAFightersWardsDoAsARoundStarts(
  theWards: TheWardsAsTheirEffectsReadThem,
): WhatAFightersWardsDoAsARoundStarts {
  let done: WhatAFightersWardsDoAsARoundStarts = {};
  for (const slug of THE_WARDS_STAGES['a round starts']) {
    const effect = ENTRIES[slug].personalCombat?.['a round starts'];
    if (effect) done = { ...done, ...effect(theWards) };
  }
  return done;
}

/** The runner of "personalCombat: a stun or a terror takes hold" (pcStunWard, pcMonsterSpecial): whether a ward he
 *  wears, in the stage's order, refuses it outright (none worn: no). */
export function aFightersWardsRefuseAStunOrATerror(
  theWards: TheWardsAsTheirEffectsReadThem | null | undefined,
): boolean {
  if (!theWards) return false;
  return THE_WARDS_STAGES['a stun or a terror takes hold'].some(
    (slug) => ENTRIES[slug].personalCombat?.['a stun or a terror takes hold']?.(theWards) === true,
  );
}

/** The runner of "personalCombat: a spell's burn takes hold" (pcCastCombatSpell's Fireball): the percentage the first
 *  ward he wears, in the stage's order, cuts the burn by (none worn, or none set: 0). */
export function theShareAFightersWardsCutASpellsBurnBy(
  theWards: TheWardsAsTheirEffectsReadThem | null | undefined,
): number {
  if (!theWards) return 0;
  for (const slug of THE_WARDS_STAGES["a spell's burn takes hold"]) {
    const cut = ENTRIES[slug].personalCombat?.["a spell's burn takes hold"]?.(theWards);
    if (cut) return cut;
  }
  return 0;
}
