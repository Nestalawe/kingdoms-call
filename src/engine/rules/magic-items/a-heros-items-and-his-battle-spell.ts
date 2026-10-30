// The magic items' effect at the stage "strength: a hero's items change his battle spell" (plan P1-19's spells family,
// row P1-19u): the Ember Rune's second Fireball, with its number from the content's row; the items' runner
// (the-registry-of-magic-item-effects.ts) finds whether a hero's items carry it. Until P1-19u it was read inline, as
// the item's field `emberTwo`, in applyPreBattleMagic (src/engine/battle/battles-between-heroes.ts) and in the hero's
// cast of combatVsNPC (src/engine/battle/battles-against-province-defenders.ts).
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

export const A_HEROS_ITEMS_CHANGE_HIS_BATTLE_SPELL = {
  // Ember Rune: his Fireball strikes the two strongest enemy units instead of one.
  'fireball-strikes-two': () => ({
    theStrongestUnitsAFireballStrikes: ROWS['fireball-strikes-two'].numbers.theStrongestUnitsStruck.value,
  }),
} satisfies Partial<
  Record<MagicItemEffectSlug, TheStagesOfEachHookPoint['strength']["a hero's items change his battle spell"]>
>;
