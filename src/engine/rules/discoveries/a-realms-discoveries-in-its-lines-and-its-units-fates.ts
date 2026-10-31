// A realm's discoveries in its battle lines and its units' fates (plan P1-19's discoveries family, row P1-19ab): the
// effects of the kinds that weight the lines behind the front (a stage of "strength"), and that cut a beaten unit's
// chance of death, add to a unit's chance of promotion, carry a fallen Elven unit home and drag a slain hero from the
// field (the stages of "fate"). Each is handed one effect the realm holds (its row's numbers and filters, in
// SAGE_DISCOVERIES_P) and the facts of its stage; the runners (the-registry-of-discovery-effects.ts) find the realm's
// effects of the kind and add or ask them, as the readers of src/engine/discoveries.ts and the resolvers did. No effect
// draws a die: the resolver rolls where it rolled before.
import type { DiscoveryEffectSlug } from '../../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import { discUnitMatch } from '../../rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheFateStages = TheStagesOfEachHookPoint['fate'];

/** "strength: a realm's discoveries weight the lines behind the front" (Flanking Tactics, `flankBonus`): its row's
 *  `lines`, as written (flankLineMults takes a list of four, or its fallback). */
export const A_REALMS_DISCOVERIES_WEIGHT_THE_LINES_BEHIND_THE_FRONT = {
  'flanking-tactics': (e) => e.lines,
} satisfies Partial<
  Record<
    DiscoveryEffectSlug,
    TheStagesOfEachHookPoint['strength']["a realm's discoveries weight the lines behind the front"]
  >
>;

/** "fate: a realm's discoveries spare a beaten unit" (`deathRed`): its `pct`, if it names no side or the unit's (a unit
 *  whose side isn't given has none), and it reaches the unit (discUnitMatch). */
export const A_REALMS_DISCOVERIES_SPARE_A_BEATEN_UNIT = {
  'a-beaten-units-death-cut': (e, facts) => {
    if (e.side && facts.theSide && e.side !== facts.theSide) return null;
    if (e.side && !facts.theSide) return null;
    return discUnitMatch(e, facts.theUnit) ? (e.pct ?? 0) : null;
  },
} satisfies Partial<Record<DiscoveryEffectSlug, TheFateStages["a realm's discoveries spare a beaten unit"]>>;

/** "fate: a realm's discoveries promote a unit" (`promo`): its `pct`, if it reaches the unit (discUnitMatch). */
export const A_REALMS_DISCOVERIES_PROMOTE_A_UNIT = {
  promotion: (e, facts) => (discUnitMatch(e, facts.theUnit) ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheFateStages["a realm's discoveries promote a unit"]>>;

/** "fate: a realm's discoveries carry a fallen unit home" (Homeward Song, `elvenEscape`): its `pct`, in points of the
 *  chance. */
export const A_REALMS_DISCOVERIES_CARRY_A_FALLEN_UNIT_HOME = {
  'homeward-flight': (e) => e.pct ?? 0,
} satisfies Partial<Record<DiscoveryEffectSlug, TheFateStages["a realm's discoveries carry a fallen unit home"]>>;

/** "fate: a realm's discoveries drag a hero from the field" (Battlefield Surgery, `nearDeathSurvival`): its `pct`, or
 *  0.2 for a row that writes none (discParam's fallback, which no row reads: Parked "discParam's fallbacks"). */
export const A_REALMS_DISCOVERIES_DRAG_A_HERO_FROM_THE_FIELD = {
  'battlefield-surgery': (e) => e.pct ?? 0.2,
} satisfies Partial<Record<DiscoveryEffectSlug, TheFateStages["a realm's discoveries drag a hero from the field"]>>;
