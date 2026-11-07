// The magic items' effects at the stages "strength: the commander's items" and "strength: a land unit at sea, led"
// (plan P1-19m): each item a commander carries makes its step on the strength of a unit he leads, with its numbers and
// the units it reaches from the content's row; the items' runner (the-registry-of-magic-item-effects.ts) finds which
// effects his active items carry and applies their steps, in the stage's order, inside armStr. Until P1-19m they were
// written inline in armStr (src/engine/battle/terrain-and-unit-strength.ts), in this order, each rounded as it went.
// The commander's items' steps, and the strength after them, are on plain values since plan P1-11e37
// (rules-on-plain-values/the-strength-a-unit-has-after-the-steps-of-its-commanders-items.ts), for the army card.
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

// A land unit at sea, led (each runs for every land unit at sea whose commander carries it). Tide-Caller's Horn: the
// land units he leads fight at full strength in a sea battle.
export const A_LAND_UNIT_AT_SEA_LED = {
  'land-units-at-full-strength-at-sea': () => true,
} satisfies Partial<Record<MagicItemEffectSlug, TheStagesOfEachHookPoint['strength']['a land unit at sea, led']>>;
