// The magic items' effects at the stages "turnEnd: a hero's items add to the realm's tax" and the five of
// "orderOutcome" (plan P1-19o): each with its numbers from the content's row, or the held copy's own where the copy
// carries them (Decision 2); the items' runners (the-registry-of-magic-item-effects.ts) find which effects a hero's items
// carry and apply them, in each stage's order. Until P1-19o they were written inline in Early Winter
// (src/engine/turn/early-winter-charms-fade-taxes-wages-raiders-muster-and-garrison-drill.ts), in the Spy, Explore, Rest,
// Move and Use Item orders (src/engine/orders/), and in the bots' plan for their items (src/engine/bots/missions.ts).
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheTurnsEnd = TheStagesOfEachHookPoint['turnEnd'];
type AnOrdersOutcome = TheStagesOfEachHookPoint['orderOutcome'];

export const A_HEROS_ITEMS_ADD_TO_THE_REALMS_TAX = {
  // Ring of Wealth and its kin: the copy's own bonus, in gold.
  'tax-bonus': (theItem) => ({ gold: Number(theItem.effect?.bonus) }),
  // Merchant's Ledger and its kin: gold for each province the realm holds.
  'tax-per-province': () => ({ goldForEachProvince: ROWS['tax-per-province'].numbers.goldForEachProvince.value }),
} satisfies Partial<Record<MagicItemEffectSlug, TheTurnsEnd["a hero's items add to the realm's tax"]>>;

// Crystal Orb (an older save's copy): the Spy order succeeds without a roll.
export const A_SPYS_SURE_SUCCESS = {
  'crystal-orb': () => true,
} satisfies Partial<Record<MagicItemEffectSlug, AnOrdersOutcome["a spy's sure success"]>>;

// Philosopher's Lens: exploring reveals one more lair the map hasn't reached.
export const A_LAIR_REVEALED_WHEN_EXPLORING = {
  'philosophers-lens': () => true,
} satisfies Partial<Record<MagicItemEffectSlug, AnOrdersOutcome['a lair revealed when exploring']>>;

export const A_RESTS_HEAL = {
  // Iron Heart Talisman: a tenth of his maximum hit points more, rounded.
  'iron-heart-talisman': (facts) =>
    Math.round(facts.hisMaximumHp * ROWS['iron-heart-talisman'].numbers.theShareOfMaximumHpHealed.value),
} satisfies Partial<Record<MagicItemEffectSlug, AnOrdersOutcome["a rest's heal"]>>;

export const A_MOVES_EXPLORATION = {
  // Traveller's Cloak: the copy's own share of the province, explored more as he moves in.
  'travellers-cloak': (theItem) => Number(theItem.exploreMove) || 0,
} satisfies Partial<Record<MagicItemEffectSlug, AnOrdersOutcome["a move's exploration"]>>;

// Philosopher's Stone (an older save's copy): used, every unit of the realm rises a quality tier.
export const AN_ITEMS_POWER_USED = {
  'philosophers-stone': () => 'every unit of the realm rises a quality tier',
} satisfies Partial<Record<MagicItemEffectSlug, AnOrdersOutcome["an item's power used"]>>;
