// A realm's discoveries at the turn's end and the new turn (plan P1-19's discoveries family, row P1-19ag): the effects of
// the kinds that add to a province's tax and the realm's, earn interest, cut a unit's or a hero's wage or cap it, heal
// the wounded, keep the graves and promote the capital's armies (stages of "turnEnd"), dress a fighter's wounds as a
// phase begins ("turnStart"), add to a hero's maximum HP ("aHerosStanding"), and name an unseen captain or chart a
// province ("visibility"). Each is handed one effect the realm holds (its row's numbers and filters, in
// SAGE_DISCOVERIES_P) and the facts of its stage; the runners (the-registry-of-discovery-effects.ts) find the realm's
// effects of the kind and fold them, as the resolvers' and the report's reads did. No effect draws a die: the resolver
// rolls where it rolled before. A number a row may not write falls back as discParam's did (War Academy's 50%, Herbal
// Lore's 40%, Taxation Records' 5% and 99g): no row reads a fallback (Parked "discParam's fallbacks").
import type { DiscoveryEffectSlug } from '../../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import { discUnitMatch } from '../../rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheTurnsEndsStages = TheStagesOfEachHookPoint['turnEnd'];
type TheNewPhasesStages = TheStagesOfEachHookPoint['turnStart'];
type AHerosStandingsStages = TheStagesOfEachHookPoint['aHerosStanding'];
type TheSightsStages = TheStagesOfEachHookPoint['visibility'];

/** "turnEnd: a realm's discoveries add to a province's tax" (`tax`): its `bonus` and its own `max`, on a province whose
 *  tax, ground, folk, coast, garrison and home are as its row names (each filter in turn, a question asked only once
 *  the filters before it hold). */
export const A_REALMS_DISCOVERIES_ADD_TO_A_PROVINCES_TAX = {
  'province-tax': (e, facts) => {
    const t = facts.theTax;
    if (e.minTax != null && t < e.minTax) return null;
    if (e.maxTax != null && t > e.maxTax) return null;
    if (e.terrains && !e.terrains.includes(facts.theGround)) return null;
    if (e.race && facts.theFolk !== e.race) return null;
    if (e.ownRace && !(facts.theFolk && facts.theFolk === facts.theRealmsRace)) return null;
    if (e.foreign && !(facts.theFolk && facts.theFolk !== facts.theRealmsRace)) return null;
    if (e.coastal && !facts.isItCoastal()) return null;
    if (e.garrisoned && !facts.isItGarrisoned) return null;
    if (e.home && !facts.isItTheRealmsHome()) return null;
    return { theGold: e.bonus ?? 0, itsOwnCeiling: e.max };
  },
} satisfies Partial<Record<DiscoveryEffectSlug, TheTurnsEndsStages["a realm's discoveries add to a province's tax"]>>;

/** "turnEnd: a realm's discoveries add to the realm's tax" (Taxation Records): its `pct` (5% if its row writes none) of
 *  the income, as whole percentage points, rounded down, never above the ceiling (or, given none, its own `max`, else
 *  99g). */
export const A_REALMS_DISCOVERIES_ADD_TO_THE_REALMS_TAX = {
  'taxation-records': (e, facts) => {
    const pc = Math.round((e.pct ?? 0.05) * 100);
    const raw = Math.floor(((Number(facts.theIncome) || 0) * pc) / 100);
    return Math.min(facts.theCeiling ?? e.max ?? 99, raw);
  },
} satisfies Partial<Record<DiscoveryEffectSlug, TheTurnsEndsStages["a realm's discoveries add to the realm's tax"]>>;

/** "turnEnd: a realm's discoveries earn interest" (`interest`): its `pct` of the treasury, rounded down, never above the
 *  ceiling. */
export const A_REALMS_DISCOVERIES_EARN_INTEREST = {
  interest: (e, facts) => Math.min(facts.theCeiling, Math.floor(facts.theTreasury * (e.pct ?? 0))),
} satisfies Partial<Record<DiscoveryEffectSlug, TheTurnsEndsStages["a realm's discoveries earn interest"]>>;

/** "turnEnd: a realm's discoveries cut a unit's wage" (`upkeep`): its `delta` (a cut is less than 0) and its own `max`,
 *  for a unit of the types, class, race or quality it names. */
export const A_REALMS_DISCOVERIES_CUT_A_UNITS_WAGE = {
  'a-units-wage-cut': (e, facts) =>
    discUnitMatch(e, facts.theUnit) ? { theGold: -(e.delta ?? 0), itsOwnCeiling: e.max } : null,
} satisfies Partial<Record<DiscoveryEffectSlug, TheTurnsEndsStages["a realm's discoveries cut a unit's wage"]>>;

/** "turnEnd: a realm's discoveries cut a hero's wage" (`heroWage`): its `amount` and its own `max`, for a hero of the
 *  alignments it names, or any. */
export const A_REALMS_DISCOVERIES_CUT_A_HEROS_WAGE = {
  'a-heros-wage-cut': (e, facts) =>
    e.heroAlign && !e.heroAlign.includes(facts.theHerosAlignment)
      ? null
      : { theGold: e.amount ?? 0, itsOwnCeiling: e.max },
} satisfies Partial<Record<DiscoveryEffectSlug, TheTurnsEndsStages["a realm's discoveries cut a hero's wage"]>>;

/** "turnEnd: a realm's discoveries cap a hero's wage" (`heroWageCap`): its `cap` and its own `max`, or nothing if its
 *  row writes no cap. */
export const A_REALMS_DISCOVERIES_CAP_A_HEROS_WAGE = {
  'a-heros-wage-ceiling': (e) => (e.cap == null ? null : { theWagesCeiling: e.cap, itsOwnCeiling: e.max }),
} satisfies Partial<Record<DiscoveryEffectSlug, TheTurnsEndsStages["a realm's discoveries cap a hero's wage"]>>;

/** "turnEnd: a realm's discoveries heal the wounded" (`regen`): its `hp`, for the king only if its row says so. */
export const A_REALMS_DISCOVERIES_HEAL_THE_WOUNDED = {
  'healing-the-wounded': (e, facts) => (!e.king || facts.isHeTheKing ? (e.hp ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheTurnsEndsStages["a realm's discoveries heal the wounded"]>>;

/** "turnEnd: a realm's discoveries keep the graves" (`graveDecay`): its `rate`, or nothing if its row writes none. */
export const A_REALMS_DISCOVERIES_KEEP_THE_GRAVES = {
  'grave-keeping': (e) => e.rate ?? null,
} satisfies Partial<Record<DiscoveryEffectSlug, TheTurnsEndsStages["a realm's discoveries keep the graves"]>>;

/** "turnEnd: a realm's discoveries promote the capital's armies" (War Academy): its `pct`, or 50% if its row writes
 *  none. */
export const A_REALMS_DISCOVERIES_PROMOTE_THE_CAPITALS_ARMIES = {
  'war-academy': (e) => e.pct ?? 0.5,
} satisfies Partial<
  Record<DiscoveryEffectSlug, TheTurnsEndsStages["a realm's discoveries promote the capital's armies"]>
>;

/** "turnStart: a realm's discoveries dress a fighter's wounds" (Herbal Lore): its `pct`, or 40% if its row writes
 *  none. */
export const A_REALMS_DISCOVERIES_DRESS_A_FIGHTERS_WOUNDS = {
  'herbal-lore': (e) => e.pct ?? 0.4,
} satisfies Partial<Record<DiscoveryEffectSlug, TheNewPhasesStages["a realm's discoveries dress a fighter's wounds"]>>;

/** "aHerosStanding: a realm's discoveries add to maximum HP" (`maxHp`): its `hp`, for the king only, the heroes only,
 *  or a hero with at least one level of the skill, as its row names. */
export const A_REALMS_DISCOVERIES_ADD_TO_MAXIMUM_HP = {
  'maximum-hp': (e, facts) =>
    (!e.king || facts.isHeTheKing) &&
    (!e.heroOnly || !facts.isHeTheKing) &&
    (!e.skill || (facts.theLevelsOfHisSkills[e.skill] ?? 0) >= 1)
      ? (e.hp ?? 0)
      : null,
} satisfies Partial<Record<DiscoveryEffectSlug, AHerosStandingsStages["a realm's discoveries add to maximum HP"]>>;

/** "visibility: a realm's discoveries name an unseen captain" (Informant Network): it does. */
export const A_REALMS_DISCOVERIES_NAME_AN_UNSEEN_CAPTAIN = {
  'informant-network': () => true,
} satisfies Partial<Record<DiscoveryEffectSlug, TheSightsStages["a realm's discoveries name an unseen captain"]>>;

/** "visibility: a realm's discoveries chart a province" (Arcane Observatory): it does. */
export const A_REALMS_DISCOVERIES_CHART_A_PROVINCE = {
  'arcane-observatory': () => true,
} satisfies Partial<Record<DiscoveryEffectSlug, TheSightsStages["a realm's discoveries chart a province"]>>;
