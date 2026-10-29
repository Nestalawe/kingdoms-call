// The magic items' effects at the five stages of "treasury" (plan P1-19t): the role an item's effect gives it, and what
// it is worth, by its kind, its combat use, its ward and its riders. Each reads the held copy's own numbers (Decision 2),
// and its content row's where the copy carries none, and the numbers the treasury weighs it by (the row's
// theWorthOfItInTheTreasury); the items' runners (the-registry-of-magic-item-effects.ts) find which effects an item
// carries. Until P1-19t they were written inline in itemRole (its set of combat stats), itemPowerScore, _useScore,
// _wardScore and _pcScore (src/engine/items/equipment.ts), which keep the skills' items, a key the registry holds no
// effect for, and the rounding.
import { SPELL_DEFS_P } from '../../../content/kingdoms-call-data.ts';
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { AnEffectAsTheTreasuryWeighsIt, TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheTreasury = TheStagesOfEachHookPoint['treasury'];

/** A spell as an item's worth reads its level (no spell row sets one today, so every charm weighs as the row's level). */
interface ASpellAsItsLevelIsRead {
  readonly school: string;
  readonly level?: number | undefined;
  readonly lvl?: number | undefined;
  readonly minLevel?: number | undefined;
}

/** It fights: a combat item, never in a Weak lair. */
const itFights: TheTreasury["an item's role"] = () => 'combat';

export const AN_ITEMS_ROLE = {
  'maximum-hp': itFights,
  'an-item-worn-as-armour': itFights,
  'mithril-armour': itFights,
  'an-item-of-riders-alone': itFights,
  'a-combat-item': itFights,
  temper: itFights,
  'crown-of-command': itFights,
} satisfies Partial<Record<MagicItemEffectSlug, TheTreasury["an item's role"]>>;

/** Worn as armour: its ward's worth, and so much a point of its bonus. */
const itsWardAndItsBonus =
  (slug: 'an-item-worn-as-armour' | 'mithril-armour'): TheTreasury["an item's worth"] =>
  (theEffect, theWorthOfItsParts) =>
    theWorthOfItsParts.ofItsWard() +
    (Number(theEffect.bonus) || 0) * ROWS[slug].theWorthOfItInTheTreasury.aPointOfItsBonusIsWorth;
const A_SPELL_CHARM = ROWS['a-spell-charm'].theWorthOfItInTheTreasury;

export const AN_ITEMS_WORTH = {
  'a-combat-item': (_theEffect, theWorthOfItsParts) => theWorthOfItsParts.ofItsCombatUse(),
  'maximum-hp': (theEffect) =>
    (Number(theEffect.bonus) || 0) * ROWS['maximum-hp'].theWorthOfItInTheTreasury.aHitPointIsWorth,
  'an-item-worn-as-armour': itsWardAndItsBonus('an-item-worn-as-armour'),
  'mithril-armour': itsWardAndItsBonus('mithril-armour'),
  'an-item-of-riders-alone': () => ROWS['an-item-of-riders-alone'].theWorthOfItInTheTreasury.worth,
  'tax-bonus': (theEffect) => (Number(theEffect.bonus) || 0) * ROWS['tax-bonus'].theWorthOfItInTheTreasury.aGoldIsWorth,
  temper: () => ROWS.temper.theWorthOfItInTheTreasury.worth,
  // A charm that casts a spell once a turn: worth what the spell is worth, so a Resurrect charm is not filed beside a +1
  // trinket. The read of the spells is wrapped, as it was when they were declared further down one file (a const read
  // before its declaration throws, `typeof` or not).
  'a-spell-charm': (theEffect) => {
    let _sl: number;
    try {
      // the spells read by any name (a missing one reads the key "undefined", as JavaScript reads it)
      const spells: Readonly<Partial<Record<string, ASpellAsItsLevelIsRead>>> = SPELL_DEFS_P;
      const sp = spells[String(theEffect.spell)];
      _sl = Number(sp?.level) || Number(sp?.lvl) || Number(sp?.minLevel) || 0;
    } catch {
      _sl = 0;
    }
    return (
      A_SPELL_CHARM.worth +
      (_sl || A_SPELL_CHARM.theLevelOfASpellThatStatesNone) * A_SPELL_CHARM.aLevelOfItsSpellIsWorth
    );
  },
} satisfies Partial<Record<MagicItemEffectSlug, TheTreasury["an item's worth"]>>;

/** The middle of a two-number range, or 0 for none (a missing element reads as JavaScript adds it: NaN). */
const theMiddleOf = (range: readonly number[] | undefined) => (range ? (Number(range[0]) + Number(range[1])) / 2 : 0);
/** The copy's own number, or the row's where it carries none (or 0). */
const orNone = (theCopysOwn: number | undefined, theRows: number) => (theCopysOwn ?? 0) || theRows;
/** A damaging item's blows: their damage, each blow's count, the lingering harm, a stun and a penalty riding on them,
 *  and what striking a foe of its kinds alone takes off. */
const itsBlows =
  (
    slug: 'combat-item-damages' | 'combat-item-bane' | 'combat-item-bane-stun',
  ): TheTreasury["an item's worth: a combat use"] =>
  (e: AnEffectAsTheTreasuryWeighsIt) => {
    const w = ROWS[slug].theWorthOfItInTheTreasury;
    return (
      (theMiddleOf(e.dmg) / w.damageForAPoint) * orNone(e.times, ROWS[slug].theNumbersOfACopyThatCarriesNone.times) +
      (e.dot ? (Number(e.dot[0]) * Number(e.dot[1])) / w.lingeringHarmForAPoint : 0) +
      (Number(e.stun) || 0) * w.aRoundStunnedIsWorth +
      (Number(e.hitPen) || 0) / w.toHitPenaltyForAPoint +
      w.forStrikingItsKindsAlone
    );
  };
/** The numbers of a combat item's row: those a copy that carries none takes, and those the treasury weighs it by. */
const HEALS = ROWS['combat-item-heals'];
const HEALS_OVER_TIME = ROWS['combat-item-heals-over-time'];
const SECOND_WIND = ROWS['combat-item-second-wind'];
const STUNS = ROWS['combat-item-stuns'];
const BLINDS = ROWS['combat-item-blinds'];
const FOCUSES = ROWS['combat-item-focuses'];
const WARDS = ROWS['combat-item-wards'];
const MIRROR_IMAGES = ROWS['combat-item-mirror-images'];
const FLIGHT = ROWS['combat-item-flight'];
const HIDES = ROWS['combat-item-hides'];
const TERRIFIES = ROWS['combat-item-terrifies'];
const SILENCES = ROWS['combat-item-silences'];

export const A_COMBAT_USES_WORTH = {
  'combat-item-heals': (e) =>
    orNone(e.amt, HEALS.theNumbersOfACopyThatCarriesNone.amt) /
    HEALS.theWorthOfItInTheTreasury.hitPointsHealedForAPoint,
  'combat-item-heals-over-time': (e) =>
    (orNone(e.amt, HEALS_OVER_TIME.theNumbersOfACopyThatCarriesNone.amt) *
      orNone(e.rounds, HEALS_OVER_TIME.theNumbersOfACopyThatCarriesNone.rounds)) /
    HEALS_OVER_TIME.theWorthOfItInTheTreasury.hitPointsHealedForAPoint,
  'combat-item-second-wind': (e) =>
    orNone(e.amt, SECOND_WIND.theNumbersOfACopyThatCarriesNone.amt) /
      SECOND_WIND.theWorthOfItInTheTreasury.hitPointsHealedForAPoint +
    SECOND_WIND.theWorthOfItInTheTreasury.whatLiftsIsWorth,
  'combat-item-damages': itsBlows('combat-item-damages'),
  'combat-item-bane': itsBlows('combat-item-bane'),
  'combat-item-bane-stun': itsBlows('combat-item-bane-stun'),
  'combat-item-drains': (e) =>
    theMiddleOf(e.dmg) / ROWS['combat-item-drains'].theWorthOfItInTheTreasury.damageForAPoint,
  'combat-item-stuns': (e) =>
    orNone(e.stun, STUNS.theNumbersOfACopyThatCarriesNone.stun) * STUNS.theWorthOfItInTheTreasury.aRoundStunnedIsWorth,
  'combat-item-blinds': (e) =>
    orNone(e.hitPen, BLINDS.theNumbersOfACopyThatCarriesNone.hitPen) /
    BLINDS.theWorthOfItInTheTreasury.toHitPenaltyForAPoint,
  'combat-item-weakens': (e) =>
    ROWS['combat-item-weakens'].theWorthOfItInTheTreasury.aPointTakenIsWorth *
    ((Number(e.melee) || 0) + (Number(e.archery) || 0)),
  'combat-item-strengthens': (e) =>
    ROWS['combat-item-strengthens'].theWorthOfItInTheTreasury.aPointAddedIsWorth *
    ((Number(e.melee) || 0) + (Number(e.archery) || 0)),
  'combat-item-focuses': (e) =>
    orNone(e.hitBonus, FOCUSES.theNumbersOfACopyThatCarriesNone.hitBonus) /
    FOCUSES.theWorthOfItInTheTreasury.toHitBonusForAPoint,
  'combat-item-wards': (e) =>
    orNone(e.absorb, WARDS.theNumbersOfACopyThatCarriesNone.absorb) /
      WARDS.theWorthOfItInTheTreasury.damageSoakedForAPoint +
    (Number(e.reflect) || 0),
  'combat-item-mirror-images': (e) =>
    orNone(e.images, MIRROR_IMAGES.theNumbersOfACopyThatCarriesNone.images) *
    MIRROR_IMAGES.theWorthOfItInTheTreasury.anImageIsWorth,
  'combat-item-flight': (e) =>
    orNone(e.fleeBonus, FLIGHT.theNumbersOfACopyThatCarriesNone.fleeBonus) /
      FLIGHT.theWorthOfItInTheTreasury.fleeBonusForAPoint +
    (Number(e.toHitReduce) || 0) / FLIGHT.theWorthOfItInTheTreasury.toHitReducedForAPoint,
  'combat-item-hides': (e) =>
    orNone(e.toHitReduce, HIDES.theNumbersOfACopyThatCarriesNone.toHitReduce) /
    HIDES.theWorthOfItInTheTreasury.toHitReducedForAPoint,
  'combat-item-terrifies': (e) =>
    TERRIFIES.theWorthOfItInTheTreasury.worth +
    orNone(e.hitPen, TERRIFIES.theNumbersOfACopyThatCarriesNone.hitPen) /
      TERRIFIES.theWorthOfItInTheTreasury.toHitPenaltyForAPoint,
  'combat-item-silences': (e) =>
    orNone(e.rounds, SILENCES.theNumbersOfACopyThatCarriesNone.rounds) *
    SILENCES.theWorthOfItInTheTreasury.aRoundSilencedIsWorth,
  'combat-item-dispels': () => ROWS['combat-item-dispels'].theWorthOfItInTheTreasury.worth,
} satisfies Partial<Record<MagicItemEffectSlug, TheTreasury["an item's worth: a combat use"]>>;

/** A ward of an amount: so much a point of the copy's amount. */
const anAmount =
  (
    slug:
      | 'melee-damage-turned-aside'
      | 'arrow-damage-turned-aside'
      | 'nature-damage-turned-aside'
      | 'dark-damage-turned-aside'
      | 'thorns'
      | 'regeneration'
      | 'round-ward',
  ): TheTreasury["an item's worth: a ward"] =>
  (theWard) =>
    (Number(theWard.amt) || 0) * ROWS[slug].theWorthOfItInTheTreasury.aPointIsWorth;
/** A ward of a percentage: a point for so many of the copy's percentage points. */
const aPercentage =
  (
    slug:
      | 'dodge'
      | 'block'
      | 'arrow-block'
      | 'spell-block'
      | 'spell-damage-cut'
      | 'a-hits-damage-capped'
      | 'damage-cut-at-low-hp'
      | 'open-guard'
      | 'resist',
  ): TheTreasury["an item's worth: a ward"] =>
  (theWard) =>
    (Number(theWard.pct) || 0) / ROWS[slug].theWorthOfItInTheTreasury.percentagePointsForAPoint;
/** A flag: its own worth, and a point for so many of the percentage points the copy carries beside it. */
const aFlag =
  (
    slug: 'stun-immunity' | 'lingering-harm-turned-aside' | 'the-first-hit-drunk' | 'second-wind' | 'buckler',
  ): TheTreasury["an item's worth: a ward"] =>
  (theWard) => {
    const w = ROWS[slug].theWorthOfItInTheTreasury;
    const p = Number(theWard.pct) || 0;
    return w.worth + (p ? p / w.percentagePointsForAPoint : 0);
  };

export const A_WARDS_WORTH = {
  'stun-immunity': aFlag('stun-immunity'),
  'lingering-harm-turned-aside': aFlag('lingering-harm-turned-aside'),
  'the-first-hit-drunk': aFlag('the-first-hit-drunk'),
  'second-wind': aFlag('second-wind'),
  buckler: aFlag('buckler'),
  'melee-damage-turned-aside': anAmount('melee-damage-turned-aside'),
  'arrow-damage-turned-aside': anAmount('arrow-damage-turned-aside'),
  'nature-damage-turned-aside': anAmount('nature-damage-turned-aside'),
  'dark-damage-turned-aside': anAmount('dark-damage-turned-aside'),
  thorns: anAmount('thorns'),
  regeneration: anAmount('regeneration'),
  // an amount: a ward of so much a round
  'round-ward': anAmount('round-ward'),
  dodge: aPercentage('dodge'),
  block: aPercentage('block'),
  'arrow-block': aPercentage('arrow-block'),
  'spell-block': aPercentage('spell-block'),
  'spell-damage-cut': aPercentage('spell-damage-cut'),
  'a-hits-damage-capped': aPercentage('a-hits-damage-capped'),
  'damage-cut-at-low-hp': aPercentage('damage-cut-at-low-hp'),
  'open-guard': aPercentage('open-guard'),
  resist: aPercentage('resist'),
} satisfies Partial<Record<MagicItemEffectSlug, TheTreasury["an item's worth: a ward"]>>;

export const A_RIDERS_WORTH = {
  'hit-bonus-rider': (theRiders) =>
    (Number(theRiders.hitBonus) || 0) / ROWS['hit-bonus-rider'].theWorthOfItInTheTreasury.pointsForAPoint,
  'damage-bonus-rider': (theRiders) =>
    (Number(theRiders.dmgBonus) || 0) * ROWS['damage-bonus-rider'].theWorthOfItInTheTreasury.aPointIsWorth,
  'burn-rider': (theRiders) =>
    (Number(theRiders.burn) || 0) * ROWS['burn-rider'].theWorthOfItInTheTreasury.aPointIsWorth,
  'drain-rider': (theRiders) =>
    (Number(theRiders.drain) || 0) * ROWS['drain-rider'].theWorthOfItInTheTreasury.aPointIsWorth,
  'aura-rider': (theRiders) =>
    (Number(theRiders.aura) || 0) / ROWS['aura-rider'].theWorthOfItInTheTreasury.pointsForAPoint,
} satisfies Partial<Record<MagicItemEffectSlug, TheTreasury["an item's worth: a rider"]>>;
