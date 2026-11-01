// The magic items' effects at the stage "visibility: a hero's items hide his face" (plan P1-19am); the items' runner
// (the-registry-of-magic-item-effects.ts) finds which effects a hero's active items carry and asks each, in the stage's
// order. Until P1-19am isHiddenChar (src/engine/heroes/), resolveSpyOrder (src/engine/orders/) and
// encounterUntargetableReason (src/engine/sight/) each named the old Cloak's key inline.
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type WhatARealmSees = TheStagesOfEachHookPoint['visibility'];

// Cloak of Many Faces (an older save's copy): his face is hidden.
export const A_HEROS_ITEMS_HIDE_HIS_FACE = {
  'cloak-of-many-faces': () => true,
} satisfies Partial<Record<MagicItemEffectSlug, WhatARealmSees["a hero's items hide his face"]>>;
