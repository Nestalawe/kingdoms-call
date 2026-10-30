// The magic items' effects at the stage "strength: a commander's items add to a strike's chance" (plan P1-19's spells
// family, row P1-19v): the totems' bonus to the pre-battle strikes of the units their bearer leads, each the held
// copy's own number (Decision 2 of the items family: an old save's copy works as it did); the items' runner
// (the-registry-of-magic-item-effects.ts) adds every item's. Until P1-19v they were read inline in primalStrikeItemBonus
// (src/engine/chances-and-lair-grades.ts), which asks the runner now.
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

export const A_COMMANDERS_ITEMS_ADD_TO_A_STRIKES_CHANCE = {
  // Totem of the Thunderhead and its kin: the copy's effect's own bonus, in percentage points.
  'strike-chance-bonus': (theItem) => Number(theItem.effect?.bonus) || 0,
  // Beastcaller's Warhorn: the copy's own field, in percentage points.
  'strike-chance-field': (theItem) => Number(theItem.primalStrike) || 0,
} satisfies Partial<
  Record<MagicItemEffectSlug, TheStagesOfEachHookPoint['strength']["a commander's items add to a strike's chance"]>
>;
