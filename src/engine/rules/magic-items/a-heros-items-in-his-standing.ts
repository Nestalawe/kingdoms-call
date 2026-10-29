// The magic items' effects at the three stages of "aHerosStanding" (plan P1-19p): each with its numbers from the
// content's row, or the held copy's own where the copy carries them (Decision 2); the items' runners
// (the-registry-of-magic-item-effects.ts) find which effects a hero's items carry and apply them, in each stage's order.
// Until P1-19p they were written inline in itemMaxHpBonus and skillBonusBreakdown (src/engine/heroes/skills-and-hp.ts),
// applyItemMaxHp (src/engine/personal-combat/helpers.ts) and effTemper (src/engine/items/equipment.ts).
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type AHerosStanding = TheStagesOfEachHookPoint['aHerosStanding'];

export const A_HEROS_MAXIMUM_HP = {
  // Amulet of Fortitude and its kin: the copy's own bonus, in hit points.
  'maximum-hp': (theItem) => Number(theItem.effect?.bonus) || 0,
} satisfies Partial<Record<MagicItemEffectSlug, AHerosStanding['maximum HP']>>;

export const THE_TEMPER_HE_FIGHTS_WITH = {
  // Warmask of the Red Rage and its kin: the copy's own temper, when it names one.
  temper: (theItem) => (theItem.effect?.temper ?? '') || null,
} satisfies Partial<Record<MagicItemEffectSlug, AHerosStanding['the temper he fights with']>>;

export const A_SKILLS_AURA_IN_THE_PROVINCE = {
  // Crown of Command: every skill of his realm's heroes beside him a level higher.
  'crown-of-command': () => ({
    theLevelsItAddsToEverySkill: ROWS['crown-of-command'].numbers.theLevelsItAddsToEverySkill.value,
    itsName: ROWS['crown-of-command'].name,
  }),
} satisfies Partial<Record<MagicItemEffectSlug, AHerosStanding["a skill's aura in the province"]>>;
