// The magic items' effects at the three stages of "personalCombat: what a fighter wears" (plan P1-19q): each ward's
// merge into the wards a fighter wears (an amount adds, a percentage takes the best, a flag is set), each rider's, and
// the Mithril suit; each with the held copy's own amount, percentage or hits (Decision 2), and content's numbers where
// the code wrote its own (the buckler's, the open guard's for a copy that carries none). The items' runners
// (the-registry-of-magic-item-effects.ts) find the effect a ward or a rider carries and apply them, in each stage's
// order. A guardian's perk of the same ward or rider reaches the same effect. Until P1-19q they were written inline in
// pcArmourMerge (src/engine/personal-combat/helpers.ts), pcApplyFx and pcCharCombatant
// (src/engine/personal-combat/speed-encounter-plans-and-combatants.ts).
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type WhatAFighterWears = TheStagesOfEachHookPoint['personalCombat'];

const BUCKLER = ROWS.buckler.numbers;
const AN_OPEN_GUARD_OF_NONE = ROWS['open-guard'].theNumbersOfACopyThatCarriesNone;

export const A_WARD_A_FIGHTER_WEARS = {
  // flat reductions and amounts add
  'melee-damage-turned-aside': (theWard, a) => ({ meleeDR: (Number(a.meleeDR) || 0) + (theWard.amt ?? 0) }),
  'arrow-damage-turned-aside': (theWard, a) => ({ arrowDR: (Number(a.arrowDR) || 0) + (theWard.amt ?? 0) }),
  'nature-damage-turned-aside': (theWard, a) => ({ natureDR: (Number(a.natureDR) || 0) + (theWard.amt ?? 0) }),
  'dark-damage-turned-aside': (theWard, a) => ({ darkDR: (Number(a.darkDR) || 0) + (theWard.amt ?? 0) }),
  thorns: (theWard, a) => ({ thorns: (Number(a.thorns) || 0) + (theWard.amt ?? 0) }),
  regeneration: (theWard, a) => ({ regen: (Number(a.regen) || 0) + (theWard.amt ?? 0) }),
  // percentages take the best
  'spell-damage-cut': (theWard, a) => ({ spellPct: Math.max(Number(a.spellPct) || 0, theWard.pct ?? 0) }),
  dodge: (theWard, a) => ({ dodge: Math.max(Number(a.dodge) || 0, theWard.pct ?? 0) }),
  block: (theWard, a) => ({ block: Math.max(Number(a.block) || 0, theWard.pct ?? 0) }),
  'a-hits-damage-capped': (theWard, a) => ({ cap: Math.max(Number(a.cap) || 0, theWard.pct ?? 0) }),
  'second-wind': (theWard, a) => ({ secondWind: Math.max(Number(a.secondWind) || 0, theWard.pct ?? 0) }),
  'damage-cut-at-low-hp': (theWard, a) => ({ lowHp: Math.max(Number(a.lowHp) || 0, theWard.pct ?? 0) }),
  // flags are set
  'the-first-hit-drunk': () => ({ firstHit: true }),
  'lingering-harm-turned-aside': () => ({ dotImmune: true }),
  resist: () => ({ resist: true }),
  // shields, second batch
  'arrow-block': (theWard, a) => ({ arrowBlock: Math.max(Number(a.arrowBlock) || 0, theWard.pct ?? 0) }),
  // its own numbers, whatever the copy carries: 1 off a melee blow, and the best dodge worn or 5
  buckler: (_theWard, a) => ({
    meleeDR: (Number(a.meleeDR) || 0) + BUCKLER.meleeDamageTurnedAside.value,
    dodge: Math.max(Number(a.dodge) || 0, BUCKLER.dodge.value),
  }),
  // the copy's hits and percentage, or content's for a copy that carries none (a 0 is none)
  'open-guard': (theWard, a) => ({
    openGuardHits: Math.max(Number(a.openGuardHits) || 0, (theWard.hits ?? 0) || AN_OPEN_GUARD_OF_NONE.hits),
    openGuardPct: Math.max(Number(a.openGuardPct) || 0, (theWard.pct ?? 0) || AN_OPEN_GUARD_OF_NONE.pct),
  }),
  'spell-block': (theWard, a) => ({ spellBlock: Math.max(Number(a.spellBlock) || 0, theWard.pct ?? 0) }),
  'round-ward': (theWard, a) => ({ roundWard: (Number(a.roundWard) || 0) + (theWard.amt ?? 0) }),
  'stun-immunity': () => ({ stunImmune: true }),
} satisfies Partial<Record<MagicItemEffectSlug, WhatAFighterWears['what a fighter wears: a ward']>>;

export const A_RIDER_A_FIGHTER_WEARS = {
  // his foes −N% to hit for the whole fight (status.auraPenalty): the best
  'aura-rider': (theRiders, soFar) => ({ aura: Math.max(Number(soFar.aura) || 0, theRiders.aura ?? 0) }),
  // a foe at melee range takes N each round: they add
  'burn-rider': (theRiders, soFar) => ({ burn: (Number(soFar.burn) || 0) + (theRiders.burn ?? 0) }),
  // he heals this share of the melee damage he deals: the best
  'drain-rider': (theRiders, soFar) => ({ drain: Math.max(Number(soFar.drain) || 0, theRiders.drain ?? 0) }),
  'hit-bonus-rider': (theRiders, soFar) => ({
    hitBonus: (Number(soFar.hitBonus) || 0) + (theRiders.hitBonus ?? 0),
  }),
  'damage-bonus-rider': (theRiders, soFar) => ({
    dmgBonus: (Number(soFar.dmgBonus) || 0) + (theRiders.dmgBonus ?? 0),
  }),
} satisfies Partial<Record<MagicItemEffectSlug, WhatAFighterWears['what a fighter wears: a rider']>>;

export const A_FIGHTER_IN_MITHRIL = {
  // a dwarven birthright: what the suit turns aside is the fight's (mithrilDR)
  'mithril-armour': () => true,
} satisfies Partial<Record<MagicItemEffectSlug, WhatAFighterWears['what a fighter wears: Mithril']>>;
