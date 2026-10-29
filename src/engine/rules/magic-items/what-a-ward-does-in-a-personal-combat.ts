// The magic items' effects at the stages of "personalCombat" where a ward a fighter wears acts (plan P1-19r): what each
// ward does to a blow's chance to hit him, to a hit on him (before all else, the cut, the cap, after it), to whoever
// lands a melee blow on him, as a round starts, to a stun or a terror, and to a spell's burn; and the Mithril suit on a
// hit. Each reads the wards he wears (pcArmourMerge's table: each copy's own amount, percentage or hits, a guardian's
// perk of the same ward among them), and content's numbers where the code wrote its own (Decision 2). Each returns
// what it does: personal combat applies it, rolls where it rolled and tells the line. The items' runners
// (the-registry-of-magic-item-effects.ts) run them in each stage's order. Until P1-19r they were written inline in
// pcTakeHit, pcRoundStart, pcHitChance and pcStunWard (src/engine/personal-combat/to-hit-wounds-stuns-and-courage.ts),
// pcMeleeStrike and pcArrowHitChance (melee-flight-and-archery.ts), and pcCastCombatSpell and pcMonsterSpecial
// (combat-spells-and-guardian-abilities.ts).
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type WhatAWardDoes = TheStagesOfEachHookPoint['personalCombat'];

const A_SECOND_WIND = ROWS['second-wind'].numbers;
const A_CUT_AT_LOW_HP = ROWS['damage-cut-at-low-hp'].numbers;
const A_RESIST = ROWS.resist.numbers;
const THE_MITHRIL_SUIT = ROWS['mithril-armour'].numbers;
const AN_OPEN_GUARD_OF_NONE = ROWS['open-guard'].theNumbersOfACopyThatCarriesNone;

/** Whether a harm's channel is a melee blow or an arrow. */
const aBlowOrAnArrow = (channel: string) => channel === 'melee' || channel === 'archery';

/** What the Mithril suit turns aside of a melee blow or an arrow, before a realm's Mithril Craft (pcCharCombatant). */
export const THE_DAMAGE_A_MITHRIL_SUIT_TURNS_ASIDE = THE_MITHRIL_SUIT.damageTurnedAside.value;

export const A_BLOWS_CHANCE_TO_HIT = {
  // Quicksilver Mail and kin: the best dodge worn comes off the chance
  dodge: (theWards) => Number(theWards.dodge) || 0,
} satisfies Partial<Record<MagicItemEffectSlug, WhatAWardDoes["a blow's chance to hit"]>>;

export const A_HIT_LANDS_BEFORE_ALL_ELSE = {
  // the Blood-Bound Cuirass takes the first landed hit of the fight in full
  'the-first-hit-drunk': ({ theWards, theFirstHitHasBeenDrunk }) =>
    theWards?.firstHit && !theFirstHitHasBeenDrunk ? { does: 'drinks the first hit of the fight' } : null,
  // the Tower Shield blocks one melee blow or arrow in so many
  block: ({ theWards, theChannel }) =>
    theWards?.block !== undefined && theWards.block > 0 && aBlowOrAnArrow(theChannel)
      ? { does: 'may turn it aside whole', against: 'a blow or an arrow', theChance: theWards.block }
      : null,
  'arrow-block': ({ theWards, theChannel }) =>
    theWards?.arrowBlock !== undefined && theWards.arrowBlock > 0 && theChannel === 'archery'
      ? { does: 'may turn it aside whole', against: 'an arrow', theChance: theWards.arrowBlock }
      : null,
  'spell-block': ({ theWards, theChannel }) =>
    theWards?.spellBlock !== undefined && theWards.spellBlock > 0 && theChannel === 'spell'
      ? { does: 'may turn it aside whole', against: 'a spell', theChance: theWards.spellBlock }
      : null,
  // the Shield of the Ward-Saints soaks what is left of this round's ward
  'round-ward': ({ theWards, theRoundWardLeft, theDamageSoFar }) => {
    if (!(
      theWards?.roundWard !== undefined &&
      theWards.roundWard > 0 &&
      theRoundWardLeft !== undefined &&
      theRoundWardLeft > 0 &&
      theDamageSoFar > 0
    ))
      return null;
    const theSoak = Math.min(theRoundWardLeft, theDamageSoFar);
    return { does: "soaks some with this round's ward", theSoak, theDamageAfter: theDamageSoFar - theSoak };
  },
  // Mithril turns aside its share of any melee blow or arrow that lands (a spell ignores it), never below 1: his own
  // (with a realm's Mithril Craft), or the suit's when he has none
  'mithril-armour': ({ heFightsInMithril, theChannel, theDamageSoFar, theDamageHisMithrilTurnsAside }) =>
    heFightsInMithril && aBlowOrAnArrow(theChannel) && theDamageSoFar > 1
      ? {
          does: 'turns aside some of a blow or an arrow',
          theDamageAfter: Math.max(
            1,
            theDamageSoFar - ((theDamageHisMithrilTurnsAside ?? 0) || THE_DAMAGE_A_MITHRIL_SUIT_TURNS_ASIDE),
          ),
        }
      : null,
} satisfies Partial<Record<MagicItemEffectSlug, WhatAWardDoes['a hit lands on a fighter: before all else']>>;

export const A_HIT_LANDS_HIS_WARDS_CUT_IT = {
  // flat reductions by channel, and by the striker's nature, never below 1
  'melee-damage-turned-aside': ({ theWards, theChannel, theDamageSoFar }) =>
    theChannel === 'melee' && theWards.meleeDR
      ? { theDamageAfter: Math.max(1, theDamageSoFar - theWards.meleeDR) }
      : null,
  'arrow-damage-turned-aside': ({ theWards, theChannel, theDamageSoFar }) =>
    theChannel === 'archery' && theWards.arrowDR
      ? { theDamageAfter: Math.max(1, theDamageSoFar - theWards.arrowDR) }
      : null,
  'nature-damage-turned-aside': ({ theWards, theStrikersKind, theDamageSoFar }) =>
    theWards.natureDR && (theStrikersKind === 'beast' || theStrikersKind === 'vermin' || theStrikersKind === 'dragon')
      ? { theDamageAfter: Math.max(1, theDamageSoFar - theWards.natureDR) }
      : null,
  'dark-damage-turned-aside': ({ theWards, theStrikersKind, theDamageSoFar }) =>
    theWards.darkDR && (theStrikersKind === 'undead' || theStrikersKind === 'fiend')
      ? { theDamageAfter: Math.max(1, theDamageSoFar - theWards.darkDR) }
      : null,
  // a percentage off spells
  'spell-damage-cut': ({ theWards, theChannel, theDamageSoFar }) =>
    theChannel === 'spell' && theWards.spellPct
      ? { theDamageAfter: Math.max(1, Math.round(theDamageSoFar * (1 - theWards.spellPct / 100))) }
      : null,
  // a percentage off everything while badly hurt
  'damage-cut-at-low-hp': ({ theWards, hisHp, hisMaximumHp, theDamageSoFar }) =>
    theWards.lowHp && hisHp < hisMaximumHp * A_CUT_AT_LOW_HP.belowThisShareOfHisMaximumHp.value
      ? { theDamageAfter: Math.max(1, Math.round(theDamageSoFar * (1 - theWards.lowHp / 100))) }
      : null,
  // the first hits of the fight deal the copy's share less (content's for a copy that carries none)
  'open-guard': ({ theWards, theHitsHisOpenGuardHasTaken, theDamageSoFar }) =>
    theWards.openGuardHits && theHitsHisOpenGuardHasTaken < theWards.openGuardHits
      ? {
          theDamageAfter: Math.max(
            1,
            Math.round(theDamageSoFar * (1 - ((theWards.openGuardPct ?? 0) || AN_OPEN_GUARD_OF_NONE.pct) / 100)),
          ),
          hisOpenGuardTakesIt: true,
        }
      : null,
} satisfies Partial<Record<MagicItemEffectSlug, WhatAWardDoes['a hit lands on a fighter: his wards cut it']>>;

export const A_HIT_LANDS_HIS_WARDS_CAP_IT = {
  // Abyssal Bulk and kin: no single hit deals more than the copy's share of his maximum HP
  'a-hits-damage-capped': ({ theWards, hisMaximumHp, theDamageSoFar }) => {
    if (!(theWards?.cap && theDamageSoFar > 0)) return null;
    const theCap = Math.max(1, Math.round((hisMaximumHp * theWards.cap) / 100));
    return theDamageSoFar > theCap ? { theDamageAfter: theCap, theWardTheLineNames: 'cap' } : null;
  },
} satisfies Partial<Record<MagicItemEffectSlug, WhatAWardDoes['a hit lands on a fighter: his wards cap it']>>;

export const A_HIT_LANDS_AFTER_IT = {
  // Last-Stand Plate: once a fight, the first time he drops below the row's share, he recovers the copy's share
  'second-wind': ({ theWards, hisSecondWindHasBeenUsed, hisHp, hisMaximumHp }) =>
    theWards?.secondWind &&
    !hisSecondWindHasBeenUsed &&
    hisHp > 0 &&
    hisHp < hisMaximumHp * A_SECOND_WIND.belowThisShareOfHisMaximumHp.value
      ? {
          theHp: Math.max(1, Math.round((hisMaximumHp * theWards.secondWind) / 100)),
          theWardTheLineNames: 'secondWind',
        }
      : null,
} satisfies Partial<Record<MagicItemEffectSlug, WhatAWardDoes['a hit lands on a fighter: after it']>>;

export const A_BLOW_LANDS = {
  // the Thornwood Cuirass bites back at whoever lands a melee blow
  thorns: (theWards) =>
    theWards.thorns !== undefined && theWards.thorns > 0
      ? { theHarm: theWards.thorns, theWardTheLineNames: 'thorns' }
      : null,
} satisfies Partial<Record<MagicItemEffectSlug, WhatAWardDoes['a blow lands']>>;

export const A_ROUND_STARTS = {
  // the Shield of the Ward-Saints: a fresh ward each round
  'round-ward': (theWards) =>
    theWards.roundWard !== undefined && theWards.roundWard > 0 ? { theFreshWardThisRound: theWards.roundWard } : {},
  // Ashen Plate: lingering harm never takes hold
  'lingering-harm-turned-aside': (theWards) => (theWards.dotImmune ? { everyLingeringHarmSloughsOff: true } : {}),
  // Troll-Hide: he regenerates the copy's amount
  regeneration: (theWards) =>
    theWards.regen !== undefined && theWards.regen > 0
      ? { heRegenerates: { theHp: theWards.regen, theWardTheLineNames: 'regen' } }
      : {},
  // Steadfast Harness: aim penalties fade twice as fast, and a daze is shrugged off on the row's chance
  resist: (theWards) =>
    theWards.resist ? { heHoldsSteady: { theChanceToShrugOffADaze: A_RESIST.theChanceToShrugOffADaze.value } } : {},
} satisfies Partial<Record<MagicItemEffectSlug, WhatAWardDoes['a round starts']>>;

export const A_STUN_OR_A_TERROR_TAKES_HOLD = {
  // the Dragonbone Shield and the Signet of the Sleepless Crown refuse it outright
  'stun-immunity': (theWards) => Boolean(theWards.stunImmune),
} satisfies Partial<Record<MagicItemEffectSlug, WhatAWardDoes['a stun or a terror takes hold']>>;

export const A_SPELLS_BURN_TAKES_HOLD = {
  // a spell ward cuts the burn as it cuts any spell's harm
  'spell-damage-cut': (theWards) => theWards.spellPct,
} satisfies Partial<Record<MagicItemEffectSlug, WhatAWardDoes["a spell's burn takes hold"]>>;
