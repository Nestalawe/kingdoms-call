// The magic items' effects at the six stages of "personalCombat" plan P1-19s wrote: when a fighter reaches for a combat
// item, what it does when used, a damaging item's blow against the kinds it names, what an item of a lair's hoard does
// for the guardian who wields it, a steal's chance and a blow's damage. Each reads the held copy's own numbers (Decision
// 2), and the content's row's where the copy carries none, or where the code wrote its own; each returns what it does,
// and personal combat applies it, draws its dice where it drew them and tells its lines. The items' runners
// (the-registry-of-magic-item-effects.ts) find which effects an item carries. Until P1-19s they were written inline in
// pcCombatItemWanted, pcUseCombatItem and pcAct (src/engine/personal-combat/tactics-combat-items-and-actions.ts),
// pcMeleeDamage (to-hit-wounds-stuns-and-courage.ts) and pcBuildGuardian (lair-guardians-and-the-odds.ts).
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS as ROWS } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type { MagicItemEffectSlug } from '../../../content/magic-item-effects-their-names-numbers-and-words.ts';
import type {
  AMomentAsAFighterWeighsACombatItem,
  TheStagesOfEachHookPoint,
} from '../the-registry-of-content-effects.ts';

type APersonalCombat = TheStagesOfEachHookPoint['personalCombat'];

/** The numbers each combat item's effect takes where a copy carries none (or 0), from its row. */
const HEALS = ROWS['combat-item-heals'].theNumbersOfACopyThatCarriesNone;
const SECOND_WIND = ROWS['combat-item-second-wind'];
const HEALS_OVER_TIME = ROWS['combat-item-heals-over-time'].theNumbersOfACopyThatCarriesNone;
const HIDES = ROWS['combat-item-hides'].theNumbersOfACopyThatCarriesNone;
const MIRROR_IMAGES = ROWS['combat-item-mirror-images'].theNumbersOfACopyThatCarriesNone;
const FLIGHT = ROWS['combat-item-flight'].theNumbersOfACopyThatCarriesNone;
const DRAINS = ROWS['combat-item-drains'].theNumbersOfACopyThatCarriesNone;
const TERRIFIES = ROWS['combat-item-terrifies'];

/** Whether he is below a share of his maximum hit points: the copy's own threshold, or the row's where it has none. */
const below = (theMoment: AMomentAsAFighterWeighsACombatItem, theCopysOwn: number | undefined, theRows: number) =>
  theMoment.theShareOfHisHpLeft < ((theCopysOwn ?? 0) || theRows);
/** Whether something lingers on him (a burn, a poison, a curse). */
const somethingLingers = (theMoment: AMomentAsAFighterWeighsACombatItem) => (theMoment.hisStatus.dot ?? []).length > 0;
/** His penalty to hit, as a number. */
const hisPenalty = (theMoment: AMomentAsAFighterWeighsACombatItem) => Number(theMoment.hisStatus.hitPenalty) || 0;
/** Whether the foe is of a kind the copy names (a bane). */
const theFoeIsOfItsKinds: APersonalCombat['a fighter reaches for a combat item'] = (theItem, theMoment) =>
  (theItem.vs ?? []).includes(theMoment.theFoesKind());
/** Always: the moment for it is any. */
const always: APersonalCombat['a fighter reaches for a combat item'] = () => true;

export const A_FIGHTER_REACHES_FOR_A_COMBAT_ITEM = {
  'combat-item-heals': (theItem, theMoment) => below(theMoment, theItem.below, HEALS.below),
  'combat-item-second-wind': (theItem, theMoment) =>
    below(theMoment, theItem.below, SECOND_WIND.theNumbersOfACopyThatCarriesNone.below) &&
    (somethingLingers(theMoment) ||
      hisPenalty(theMoment) >= SECOND_WIND.theNumbersAFighterWeighsItBy.aPenaltyWorthLifting ||
      theMoment.theShareOfHisHpLeft <
        SECOND_WIND.theNumbersAFighterWeighsItBy.belowThisShareOfHisMaximumHpWhateverLingers),
  'combat-item-heals-over-time': (theItem, theMoment) =>
    below(theMoment, theItem.below, HEALS_OVER_TIME.below) &&
    !(theMoment.hisStatus.hot && theMoment.hisStatus.hot.rounds > 0),
  'combat-item-wards': (_theItem, theMoment) =>
    theMoment.hisHp < theMoment.hisMaximumHp &&
    !(theMoment.hisStatus.absorb !== undefined && theMoment.hisStatus.absorb > 0),
  'combat-item-hides': (theItem, theMoment) =>
    below(theMoment, theItem.below, HIDES.below) &&
    !(theMoment.hisStatus.toHitReduce !== undefined && theMoment.hisStatus.toHitReduce > 0),
  'combat-item-mirror-images': (theItem, theMoment) =>
    below(theMoment, theItem.below, MIRROR_IMAGES.below) &&
    !(theMoment.hisStatus.mirrorImages !== undefined && theMoment.hisStatus.mirrorImages > 0),
  'combat-item-flight': (theItem, theMoment) =>
    below(theMoment, theItem.below, FLIGHT.below) && !theMoment.heNeverFlees,
  'combat-item-dispels': (_theItem, theMoment) =>
    somethingLingers(theMoment) ||
    hisPenalty(theMoment) >= ROWS['combat-item-dispels'].theNumbersAFighterWeighsItBy.aPenaltyWorthLifting,
  'combat-item-bane': theFoeIsOfItsKinds,
  'combat-item-bane-stun': theFoeIsOfItsKinds,
  'combat-item-strengthens': always,
  'combat-item-focuses': always,
  'combat-item-silences': (_theItem, theMoment) => theMoment.theFoeHasPowers(),
  'combat-item-stuns': always,
  'combat-item-blinds': always,
  'combat-item-weakens': always,
  'combat-item-terrifies': always,
  'combat-item-damages': always,
  'combat-item-drains': (theItem, theMoment) => below(theMoment, theItem.below, DRAINS.below),
} satisfies Partial<Record<MagicItemEffectSlug, APersonalCombat['a fighter reaches for a combat item']>>;

/** A damaging item's blows: the copy's count (or the row's), its damage range, and what rides on them. */
const itStrikesTheFoe = (slug: 'combat-item-damages' | 'combat-item-bane'): APersonalCombat['a combat item is used'] =>
  function strikes({ effect }) {
    return {
      does: 'strikes the foe',
      theTimes: (effect.times ?? 0) || ROWS[slug].theNumbersOfACopyThatCarriesNone.times,
      theDamageRange: effect.dmg,
      theLingeringHarm: effect.dot,
      thePenaltyFromTheNextRound: effect.hitPen,
      theDazeFromTheNextRound: effect.stun,
    };
  };
/** An item that holds the foe: the copy's rounds (or the row's). */
const itHoldsTheFoe = (slug: 'combat-item-stuns' | 'combat-item-bane-stun'): APersonalCombat['a combat item is used'] =>
  function holds({ effect }) {
    return { does: 'holds the foe', theRounds: (effect.stun ?? 0) || ROWS[slug].theNumbersOfACopyThatCarriesNone.stun };
  };

export const A_COMBAT_ITEM_IS_USED = {
  'combat-item-heals': ({ effect }) => ({ does: 'restores his hit points', theHp: (effect.amt ?? 0) || HEALS.amt }),
  'combat-item-heals-over-time': ({ effect }) => ({
    does: 'warms him each round',
    theHp: (effect.amt ?? 0) || HEALS_OVER_TIME.amt,
    theRounds: (effect.rounds ?? 0) || HEALS_OVER_TIME.rounds,
  }),
  'combat-item-second-wind': ({ effect }) => ({
    does: 'restores his hit points and lifts every lingering harm',
    theHp: (effect.amt ?? 0) || SECOND_WIND.theNumbersOfACopyThatCarriesNone.amt,
  }),
  'combat-item-damages': itStrikesTheFoe('combat-item-damages'),
  'combat-item-bane': itStrikesTheFoe('combat-item-bane'),
  'combat-item-drains': ({ effect }) => ({ does: 'drains the foe', theDamageRange: effect.dmg }),
  'combat-item-stuns': itHoldsTheFoe('combat-item-stuns'),
  'combat-item-bane-stun': itHoldsTheFoe('combat-item-bane-stun'),
  'combat-item-blinds': ({ desc, effect }) => ({
    does: 'blinds the foe',
    thePenalty: (effect.hitPen ?? 0) || ROWS['combat-item-blinds'].theNumbersOfACopyThatCarriesNone.hitPen,
    // an item that says "for the rest of the fight" no longer fades 5% a round
    forTheRestOfTheFight: /rest of the fight/i.test(desc ?? ''),
  }),
  'combat-item-weakens': ({ effect }) => ({ does: 'saps the foe', theMelee: effect.melee, theArchery: effect.archery }),
  'combat-item-terrifies': ({ effect }) => ({
    does: 'may send the foe fleeing',
    theChanceTheFoeFlees: TERRIFIES.numbers.theChanceTheFoeFlees.value,
    thePenaltyIfHeHolds: (effect.hitPen ?? 0) || TERRIFIES.theNumbersOfACopyThatCarriesNone.hitPen,
  }),
  'combat-item-silences': ({ effect }) => ({
    does: "binds the foe's powers",
    theRounds: (effect.rounds ?? 0) || ROWS['combat-item-silences'].theNumbersOfACopyThatCarriesNone.rounds,
  }),
  'combat-item-strengthens': ({ effect }) => ({
    does: 'strengthens him',
    theMelee: effect.melee,
    theArchery: effect.archery,
  }),
  'combat-item-focuses': ({ effect }) => ({
    does: 'sharpens his eye',
    theBonus: (effect.hitBonus ?? 0) || ROWS['combat-item-focuses'].theNumbersOfACopyThatCarriesNone.hitBonus,
  }),
  'combat-item-wards': ({ effect }) => ({
    does: 'wards him',
    theWard: (effect.absorb ?? 0) || ROWS['combat-item-wards'].theNumbersOfACopyThatCarriesNone.absorb,
    theReflect: effect.reflect,
  }),
  'combat-item-mirror-images': ({ effect }) => ({
    does: 'sends his images out',
    theImages: (effect.images ?? 0) || MIRROR_IMAGES.images,
  }),
  'combat-item-flight': ({ effect }) => ({
    does: 'readies him to break away',
    theFleeBonus: (effect.fleeBonus ?? 0) || FLIGHT.fleeBonus,
    theUnseen: effect.toHitReduce,
  }),
  'combat-item-hides': ({ effect }) => ({
    does: 'hides him',
    theUnseen: (effect.toHitReduce ?? 0) || HIDES.toHitReduce,
  }),
  'combat-item-dispels': () => ({ does: 'lifts every lingering harm' }),
} satisfies Partial<Record<MagicItemEffectSlug, APersonalCombat['a combat item is used']>>;

export const A_COMBAT_ITEMS_BLOW_LANDS = {
  // bane's double: a blow on a foe of the kinds the copy names lands twice as hard
  'combat-item-doubled-against-its-kinds': (theItem, theFoesKind) =>
    (theItem.doubleVs ?? []).includes(theFoesKind)
      ? ROWS['combat-item-doubled-against-its-kinds'].numbers.multiplier.value
      : null,
} satisfies Partial<Record<MagicItemEffectSlug, APersonalCombat["a combat item's blow lands"]>>;

export const A_GUARDIAN_WIELDS_ITS_HOARD = {
  // the Amulet of Fortitude and its kin: the copy's own bonus, in hit points (as the guardian's maximum adds it)
  'maximum-hp': (theItem) => ({ theHpItAddsAtFullHealth: Number(theItem.effect?.bonus) }),
  'warbringer-gauntlets': () => ({ itDrivesHisBlowsHome: true }),
} satisfies Partial<Record<MagicItemEffectSlug, APersonalCombat['a guardian wields its hoard']>>;

export const A_STEALS_CHANCE = {
  'lock-pick-of-legends': () => ROWS['lock-pick-of-legends'].numbers.stealChance.value,
} satisfies Partial<Record<MagicItemEffectSlug, APersonalCombat["a steal's chance"]>>;

export const A_BLOWS_DAMAGE = {
  'warbringer-gauntlets': () => ROWS['warbringer-gauntlets'].numbers.damageAdded.value,
} satisfies Partial<Record<MagicItemEffectSlug, APersonalCombat["a blow's damage"]>>;
