// The magic items' effects at the stages "strength: the defenders' fortifications", "volley: the commander adds
// volleys", "fate: the commander's riders run the beaten down on any ground" and "fate: the beaten force may retreat"
// (plan P1-19n): each with its numbers from the content's row; the items' runners (the-registry-of-magic-item-
// effects.ts) find which effects a commander's active items carry and apply them, in each stage's order. Until P1-19n
// they were written inline in the two battles (src/engine/battle/battles-between-heroes.ts and battles-against-
// province-defenders.ts) and in the rout's handed answer (src/engine/units/movement.ts), in this order.
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

export const THE_DEFENDERS_FORTIFICATIONS = {
  // Banner of the Realm: the defenders' position ×1.25, when the bearer defends his founding home and holds it.
  'home-defence-bonus': (facts, theBonusSoFar) =>
    facts.hisSide === 'the defender' && facts.theDefendersFightAtTheirHome
      ? {
          theBonus: theBonusSoFar * ROWS['home-defence-bonus'].numbers.multiplier.value,
          theLine: "the defender's banner rallies the home defence",
        }
      : null,
  // Siege Master's Ring: when the bearer attacks, the defenders' fortifications beyond the bare ×1 are halved.
  'siege-bonus': (facts, theBonusSoFar) =>
    facts.hisSide === 'the attacker'
      ? {
          theBonus: 1 + (theBonusSoFar - 1) * ROWS['siege-bonus'].numbers.theShareOfTheFortificationsLeft.value,
          theLine: "the attacker's siege mastery halves the defenders' fortifications",
        }
      : null,
} satisfies Partial<Record<MagicItemEffectSlug, TheStagesOfEachHookPoint['strength']["the defenders' fortifications"]>>;

export const THE_COMMANDER_ADDS_VOLLEYS = {
  // Quiver of the Hawk: each missile unit he leads looses two volleys instead of one.
  'quiver-of-the-hawk': () => ({
    theVolleysAdded: ROWS['quiver-of-the-hawk'].numbers.volleys.value - 1,
    theLine: 'each missile unit looses two volleys instead of one',
  }),
  // Quiver of Many Arrows: each missile unit he leads looses one more shot.
  'quiver-of-many-arrows': () => ({
    theVolleysAdded: ROWS['quiver-of-many-arrows'].numbers.extraShots.value,
    theLine: 'each missile unit looses one more shot',
  }),
} satisfies Partial<Record<MagicItemEffectSlug, TheStagesOfEachHookPoint['volley']['the commander adds volleys']>>;

// War-Horn of the Plains: the Free Lances he leads ride the beaten down on any ground, at the full share.
export const THE_COMMANDERS_RIDERS_RUN_THE_BEATEN_DOWN_ON_ANY_GROUND = {
  'war-horn-of-the-plains': () => true,
} satisfies Partial<
  Record<
    MagicItemEffectSlug,
    TheStagesOfEachHookPoint['fate']["the commander's riders run the beaten down on any ground"]
  >
>;

// Shield-Wall Rune: the force he leads, beaten by neutral guards, never retreats: it stands.
export const THE_BEATEN_FORCE_MAY_RETREAT = {
  'shield-wall-rune': () => false,
} satisfies Partial<Record<MagicItemEffectSlug, TheStagesOfEachHookPoint['fate']['the beaten force may retreat']>>;
