// A realm's discoveries in its recruits and its works (plan P1-19's discoveries family, row P1-19ae): the effects of the
// kind that waives the ban on hiring across the gulf between Divine and Undead (a stage of "orderValidity"), and of
// the kinds that add to the consecrations a crown may hold, raise a Call to Arms' company, change the corpse-carters'
// cost, a mercenary band's price and a unit's, raise a recruit's grade, and add to a Bless (the stages of
// "orderOutcome"). Each is handed one effect the realm holds (its row's numbers and filters, in SAGE_DISCOVERIES_P) and
// the facts of its stage; the runners (the-registry-of-discovery-effects.ts) find the realm's effects of the kind and
// add, fold or ask them, as the resolvers' and the readers' reads did. No effect draws a die: the resolver rolls where
// it rolled before.
import type {
  DiscoveryEffectSlug,
  TheEffectOfADiscovery,
} from '../../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import {
  discUnitIs,
  discUnitMatch,
} from '../../rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheChecksStages = TheStagesOfEachHookPoint['orderValidity'];
type TheOrdersStages = TheStagesOfEachHookPoint['orderOutcome'];

/** "orderValidity: a realm's discoveries waive the hiring ban" (Diplomatic Protocols, `alignmentHire`). */
export const A_REALMS_DISCOVERIES_WAIVE_THE_HIRING_BAN = {
  'diplomatic-protocols': () => true,
} satisfies Partial<Record<DiscoveryEffectSlug, TheChecksStages["a realm's discoveries waive the hiring ban"]>>;

/** The White skill a consecration effect needs: its row's `minWhite`, or 1 where it writes none or 0 (the old
 *  `minWhite || 1`). */
function theWhiteSkillItNeeds(e: TheEffectOfADiscovery): number {
  return (e.minWhite ?? 0) || 1;
}

/** "orderOutcome: a realm's discoveries add to the consecrations a crown may hold" (`consecrate`): its `cap`, for a
 *  consecrator of the White skill it needs. */
export const A_REALMS_DISCOVERIES_ADD_TO_THE_CONSECRATIONS_A_CROWN_MAY_HOLD = {
  consecrations: (e, facts) => (facts.theConsecratorsWhiteSkill >= theWhiteSkillItNeeds(e) ? (e.cap ?? 0) : null),
} satisfies Partial<
  Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to the consecrations a crown may hold"]>
>;

/** "orderOutcome: a realm's discoveries raise a call to arms' quality" (`ctaQuality`): its `quality` and its chance,
 *  `pct`, as its row writes them. */
export const A_REALMS_DISCOVERIES_RAISE_A_CALL_TO_ARMS_QUALITY = {
  'muster-rolls': (e) => ({ theChance: e.pct, theQuality: e.quality }),
} satisfies Partial<
  Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries raise a call to arms' quality"]>
>;

/** "orderOutcome: a realm's discoveries cut the corpse-carters' cost" (`harvestCost`): its `delta`. */
export const A_REALMS_DISCOVERIES_CUT_THE_CORPSE_CARTERS_COST = {
  'corpse-carters': (e) => e.delta ?? 0,
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries cut the corpse-carters' cost"]>>;

/** "orderOutcome: a realm's discoveries cut a company's price" (`merc`): its `delta`, for a band of any unit or of the
 *  class it names. */
export const A_REALMS_DISCOVERIES_CUT_A_COMPANYS_PRICE = {
  mercenaries: (e, facts) => (!e.cls || discUnitIs(e.cls, facts.theUnitsType, true) ? (e.delta ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries cut a company's price"]>>;

/** "orderOutcome: a realm's discoveries cut a unit's price" (`recruitCost`): for a unit of the types or class it names,
 *  the price so far with its `delta` added, then multiplied by its `factor` and rounded up. */
export const A_REALMS_DISCOVERIES_CUT_A_UNITS_PRICE = {
  'recruit-cost': (e, facts) => {
    if (!discUnitMatch(e, facts.theUnitsType, true)) return null;
    let c = facts.thePriceSoFar;
    if (e.delta) c += e.delta;
    if (e.factor) c = Math.ceil(c * e.factor);
    return c;
  },
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries cut a unit's price"]>>;

/** "orderOutcome: a realm's discoveries raise a recruit's quality" (`recruitQ`): its `pct`, for a unit of the types or
 *  class it names. */
export const A_REALMS_DISCOVERIES_RAISE_A_RECRUITS_QUALITY = {
  'recruit-quality': (e, facts) => (discUnitMatch(e, facts.theUnitsType, true) ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries raise a recruit's quality"]>>;

/** "orderOutcome: a realm's discoveries add to a Bless" (`bless`): its `pct`. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_BLESS = {
  'rites-of-plenty': (e) => e.pct ?? 0,
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to a Bless"]>>;
