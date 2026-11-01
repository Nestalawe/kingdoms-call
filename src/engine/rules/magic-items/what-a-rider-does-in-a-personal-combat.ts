// The magic items' effects at the stages of "personalCombat" where a rider a fighter wears acts (plan P1-19ak): the
// aura laid on his foe as the fight opens and what it takes off the foe's chance to hit, his bonus to hit (a combat
// item's too) and to a blow's damage, his burn each melee round, and his drain as his blow lands (with a guardian's
// sustain's fade). Each reads the riders he wears (pcApplyFx's fields: each copy's own number, a guardian's perk of
// the same rider among them) or the marks they leave on his status, and returns what the fight applies, with the rider
// the line names where a line names one: personal combat applies it and tells the line. The items' runners
// (the-registry-of-magic-item-effects.ts) run them. Until P1-19ak they were written inline in resolvePersonalCombat
// (src/engine/personal-combat/resolve-personal-combat.ts), pcHitChance and pcMeleeDamage
// (to-hit-wounds-stuns-and-courage.ts), pcMeleeStrike and pcArrowHitChance (melee-flight-and-archery.ts), and
// pcUseCombatItem (tactics-combat-items-and-actions.ts).
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type WhatARiderDoes = TheStagesOfEachHookPoint['personalCombat'];

/** The hit points a fighter whose maximum is unknown counts as his maximum. */
const A_MAXIMUM_OF_NONE = 20;

export const A_FIGHTERS_AURA_AS_THE_FIGHT_OPENS = {
  // his foe −N% to hit for the whole fight: added to any aura's penalty the foe already carries
  'aura-rider': ({ theRiders, theFoesAuraPenaltySoFar }) =>
    theRiders.aura !== undefined && theRiders.aura > 0 ? ((theFoesAuraPenaltySoFar ?? 0) || 0) + theRiders.aura : null,
} satisfies Partial<Record<MagicItemEffectSlug, WhatARiderDoes["the fight opens: a fighter's aura hinders his foe"]>>;

export const THE_AURAS_PENALTY_ON_A_CHANCE_TO_HIT = {
  // the aura laid on him never fades
  'aura-rider': (theStrikersMarks) => Number(theStrikersMarks.auraPenalty) || 0,
} satisfies Partial<
  Record<MagicItemEffectSlug, WhatARiderDoes["a blow's or an arrow's chance to hit: the aura's penalty"]>
>;

export const A_STRIKERS_BONUS_TO_A_CHANCE_TO_HIT = {
  'hit-bonus-rider': (theStrikersMarks) => Number(theStrikersMarks.hitBonus) || 0,
} satisfies Partial<Record<MagicItemEffectSlug, WhatARiderDoes["a blow's or an arrow's chance to hit: his bonus"]>>;

export const A_STRIKERS_BONUS_TO_A_BLOWS_DAMAGE = {
  // none is 0 (pcMeleeDamage adds it only when set); a guardian's special multiplies the blow, this bonus with it
  // (as the rulebook reads: Toby's question 34)
  'damage-bonus-rider': (theRiders) => theRiders.dmgBonus ?? 0,
} satisfies Partial<Record<MagicItemEffectSlug, WhatARiderDoes["a blow's damage: his bonus"]>>;

export const A_FIGHTERS_BURN_IN_A_MELEE_ROUND = {
  // a foe at melee range takes N each round (never soaked)
  'burn-rider': (theRiders) =>
    theRiders.burn !== undefined && theRiders.burn > 0
      ? { theHarm: theRiders.burn, theRiderTheLineNames: ROWS['burn-rider'].carriedAs.rider }
      : null,
} satisfies Partial<Record<MagicItemEffectSlug, WhatARiderDoes['a melee round: his burn']>>;

export const A_STRIKERS_DRAIN_AS_HIS_BLOW_LANDS = {
  // he heals his share of the damage dealt, below his maximum, at the sustain's fade (a guardian's thirst fades with the
  // fight, as regeneration does), up to his maximum
  'drain-rider': ({ theRiders, theDamageDealt, hisHp, hisMaxHp, theSustainsFade }) => {
    if (!(
      theDamageDealt &&
      theRiders.drain !== undefined &&
      theRiders.drain > 0 &&
      hisHp < (hisMaxHp || A_MAXIMUM_OF_NONE)
    ))
      return null;
    const theFade = theSustainsFade(),
      theHpDrunk = Math.min(
        Math.round(theDamageDealt * theRiders.drain * theFade),
        (hisMaxHp || A_MAXIMUM_OF_NONE) - hisHp,
      );
    return theHpDrunk > 0 ? { theHpDrunk, theFade, theRiderTheLineNames: ROWS['drain-rider'].carriedAs.rider } : null;
  },
} satisfies Partial<Record<MagicItemEffectSlug, WhatARiderDoes['a blow lands: his drain']>>;

export const A_COMBAT_ITEMS_BONUS_TO_HIT = {
  // a combat item's bonus adds to his bonus so far
  'hit-bonus-rider': ({ theBonusSoFar, theBonusAdded }) => (Number(theBonusSoFar) || 0) + theBonusAdded,
} satisfies Partial<Record<MagicItemEffectSlug, WhatARiderDoes['a combat item adds to his bonus to hit']>>;
