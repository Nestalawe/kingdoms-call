// A realm's discoveries in war's spoils and the march (plan P1-19's discoveries family, row P1-19af): the effects of the
// kinds that add to a Pagan victor's blood harvest, to the terror an Evil victory leaves and to an Evil conquest's
// plunder (stages of "fate"), and of the kinds that add to a land unit's march and help converging columns unite (the
// first stages of "movementCost"). Each is handed one effect the realm holds (its row's numbers and filters, in
// SAGE_DISCOVERIES_P) and the facts of its stage; the runners (the-registry-of-discovery-effects.ts) find the realm's
// effects of the kind and add them, as the resolvers' and the report's reads did. No effect draws a die: the resolver
// rolls where it rolled before.
import type { DiscoveryEffectSlug } from '../../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import { discUnitMatch } from '../../rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheFatesStages = TheStagesOfEachHookPoint['fate'];
type TheMarchsStages = TheStagesOfEachHookPoint['movementCost'];

/** "fate: a realm's discoveries add to a blood harvest" (`bloodHarvest`): its `gold`. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_BLOOD_HARVEST = {
  'blood-harvest': (e) => e.gold ?? 0,
} satisfies Partial<Record<DiscoveryEffectSlug, TheFatesStages["a realm's discoveries add to a blood harvest"]>>;

/** "fate: a realm's discoveries add to the terror a victory leaves" (`terror`): its `pct`. */
export const A_REALMS_DISCOVERIES_ADD_TO_THE_TERROR_A_VICTORY_LEAVES = {
  'lingering-terror': (e) => e.pct ?? 0,
} satisfies Partial<
  Record<DiscoveryEffectSlug, TheFatesStages["a realm's discoveries add to the terror a victory leaves"]>
>;

/** "fate: a realm's discoveries add to a conquest's plunder" (`plunder`): its `pct`, on any ground, or on the terrains
 *  its row names. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_CONQUESTS_PLUNDER = {
  plunder: (e, facts) => (!e.terrains || e.terrains.includes(facts.theGround) ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheFatesStages["a realm's discoveries add to a conquest's plunder"]>>;

/** "movementCost: a realm's discoveries add to a march" (`move`): its `extra`, for a unit of the types, class, race or
 *  quality it names. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_MARCH = {
  marching: (e, facts) => (discUnitMatch(e, facts.theUnit) ? (e.extra ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheMarchsStages["a realm's discoveries add to a march"]>>;

/** "movementCost: a realm's discoveries help converging columns unite" (`unify`): its `pct`, in points. */
export const A_REALMS_DISCOVERIES_HELP_CONVERGING_COLUMNS_UNITE = {
  'converging-columns': (e) => e.pct ?? 0,
} satisfies Partial<
  Record<DiscoveryEffectSlug, TheMarchsStages["a realm's discoveries help converging columns unite"]>
>;
