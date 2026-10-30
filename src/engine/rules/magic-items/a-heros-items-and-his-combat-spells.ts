// The magic items' effect at the stage "personalCombat: a hero's items change his combat spell" (plan P1-19's spells
// family, row P1-19w): the Dreamstone's round more to his Psychic Blast's stun, and the Death's Finger Ring's ×1.1 to his
// Hand of Death's bite, each with its number from the content's row; the items' runner (the-registry-of-magic-item-
// effects.ts) finds whether a hero's items carry them, by the item's base name. Until P1-19w each was read inline, by
// hasItemBase, in pcCastCombatSpell (src/engine/personal-combat/combat-spells-and-guardian-abilities.ts).
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

export const A_HEROS_ITEMS_CHANGE_HIS_COMBAT_SPELL = {
  dreamstone: () => ({ theRoundsHisPsychicBlastStunsLonger: ROWS.dreamstone.numbers.theRoundsAdded.value }),
  'deaths-finger-ring': () => ({
    theMultiplierOfHisHandOfDeathsBite: ROWS['deaths-finger-ring'].numbers.multiplier.value,
  }),
} satisfies Partial<
  Record<MagicItemEffectSlug, TheStagesOfEachHookPoint['personalCombat']["a hero's items change his combat spell"]>
>;
