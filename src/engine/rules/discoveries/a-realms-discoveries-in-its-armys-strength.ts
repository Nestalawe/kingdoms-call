// A realm's discoveries in its army's strength (plan P1-19's discoveries family, row P1-19aa): the effects of the kinds
// that strengthen a unit, wear down the defenders' fortifications, fortify the realm's own ground, stir a side's
// fanaticism, let a winged beast follow without its Druid (the stages of "strength"), and add to a caster's chance
// (a stage of "aHerosStanding"). Each is handed one effect the realm holds (its row's numbers and filters, in
// SAGE_DISCOVERIES_P) and the facts of its stage; the runners (the-registry-of-discovery-effects.ts) find the realm's
// effects of the kind and add, multiply or ask them, as the readers of src/engine/discoveries.ts did.
import type {
  DiscoveryEffectSlug,
  TheEffectOfADiscovery,
} from '../../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import { TAMED_FLYER_TYPES_D } from '../../rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import {
  discUnitIs,
  discUnitMatch,
  type AUnitAsTheDiscoveriesReadIt,
} from '../../rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheStrengthStages = TheStagesOfEachHookPoint['strength'];

/** "strength: a realm's discoveries strengthen a unit" (`unitStr`): the unit's type, race and quality (or risen dead),
 *  the ground, the side, led by the king, a garrison standing alone. */
export const A_REALMS_DISCOVERIES_STRENGTHEN_A_UNIT = {
  'unit-strength': (e, facts) => {
    if (!discUnitMatch(e, facts.theUnit)) return null;
    if (e.king && !facts.isItLedByTheKing) return null; // "led by your KING in person" effects
    if (e.terrain && (facts.theGround == null || !e.terrain.includes(facts.theGround))) return null;
    if (e.side === 'atk' && facts.isItsSideTheAttacker !== true) return null;
    if (e.side === 'def' && facts.isItsSideTheAttacker !== false) return null;
    if (e.led === 'garrison' && facts.hasItACommander) return null; // only a garrison standing without a commander
    return 1 + (e.pct ?? 0);
  },
} satisfies Partial<Record<DiscoveryEffectSlug, TheStrengthStages["a realm's discoveries strengthen a unit"]>>;

/** "strength: a realm's discoveries add to a siege" (`siege`): its `delta`, if it names no unit types or the attacker
 *  has one of them. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_SIEGE = {
  siegecraft: (e, facts) => {
    const withTypes = e.withTypes;
    return !withTypes || facts.theAttackersUnits.some((a) => a && withTypes.includes(a.type)) ? (e.delta ?? 0) : null;
  },
} satisfies Partial<Record<DiscoveryEffectSlug, TheStrengthStages["a realm's discoveries add to a siege"]>>;

/** "strength: a realm's discoveries fortify its own ground" (`defOwn`): its `pct`, if it asks for no home or the
 *  province is the realm's home. */
export const A_REALMS_DISCOVERIES_FORTIFY_ITS_OWN_GROUND = {
  'own-ground': (e, facts) => (!e.home || facts.isItTheRealmsHome() ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheStrengthStages["a realm's discoveries fortify its own ground"]>>;

// Does a `fanatic` effect apply? side ('atk'/'def'), terrain, withCls (force includes that class).
export function discFanaticApplies(
  e: TheEffectOfADiscovery,
  side: string | null | undefined,
  terrain: string | null | undefined,
  force: readonly (AUnitAsTheDiscoveriesReadIt | null | undefined)[] | null | undefined,
) {
  if (e.side && e.side !== side) return false;
  if (e.terrain && (terrain == null || !e.terrain.includes(terrain))) return false;
  const withCls = e.withCls;
  if (withCls && !(force ?? []).some((a) => a && discUnitIs(withCls, a))) return false;
  return true;
}

/** "strength: a realm's discoveries stir a side's fanaticism" (`fanatic`): its `pct`, if it applies to the side, the
 *  ground and the force (discFanaticApplies). */
export const A_REALMS_DISCOVERIES_STIR_A_SIDES_FANATICISM = {
  fanaticism: (e, facts) =>
    discFanaticApplies(e, facts.theSide, facts.theGround, facts.theForce) ? (e.pct ?? 0) : null,
} satisfies Partial<Record<DiscoveryEffectSlug, TheStrengthStages["a realm's discoveries stir a side's fanaticism"]>>;

/** "strength: a realm's discoveries let a beast follow without its Druid" (Dragon Taming, sd40): whether the unit is
 *  one of the winged beasts it tames. */
export const A_REALMS_DISCOVERIES_LET_A_BEAST_FOLLOW_WITHOUT_ITS_DRUID = {
  'dragon-taming': (_, facts) => TAMED_FLYER_TYPES_D.has(facts.theUnitsType),
} satisfies Partial<
  Record<DiscoveryEffectSlug, TheStrengthStages["a realm's discoveries let a beast follow without its Druid"]>
>;

/** "aHerosStanding: a realm's discoveries add to a caster's chance" (`cast`): its `pct`, if it names no school or his,
 *  and no place or where he casts. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_CASTERS_CHANCE = {
  casting: (e, facts) =>
    (!e.school || e.school === facts.theSchool) && (!e.ctx || e.ctx === facts.whereHeCasts) ? (e.pct ?? 0) : null,
} satisfies Partial<
  Record<
    DiscoveryEffectSlug,
    TheStagesOfEachHookPoint['aHerosStanding']["a realm's discoveries add to a caster's chance"]
  >
>;
