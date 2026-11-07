// The factor a realm's unit-strength discoveries (`unitStr`) strengthen a unit by, on plain values so the army card can
// share it (plan P1-11e36, for P1-11e38): the kind's effect, moved as it was from the discoveries' registry's
// "strength: a realm's discoveries strengthen a unit" (rules/discoveries/a-realms-discoveries-in-its-armys-strength.ts,
// whose entry names it), and its runner's product and ceiling (rules/the-registry-of-discovery-effects.ts, which finds
// the effects the realm holds and hands them in, in the order it holds them).
import {
  DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS,
  type TheEffectOfADiscovery,
} from '../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import {
  discUnitMatch,
  type AUnitAsTheDiscoveriesReadIt,
} from './units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';

/** A unit a realm's discoveries may strengthen, and its battle (discUnitMult, which armStr asks: plan P1-19aa). */
export interface AUnitARealmsDiscoveriesMayStrengthen {
  readonly theUnit: AUnitAsTheDiscoveriesReadIt;
  /** The ground it fights on, or none given. */
  readonly theGround: string | null | undefined;
  /** Whether its side attacks (true), defends (false), or neither is given. */
  readonly isItsSideTheAttacker: boolean | null | undefined;
  /** Whether the realm's king leads it in person. */
  readonly isItLedByTheKing: boolean;
  /** Whether a commander leads it (a garrison standing alone has none). */
  readonly hasItACommander: boolean;
}

/** "strength: a realm's discoveries strengthen a unit" (`unitStr`): the factor one effect gives the unit, `1 + pct`,
 *  or nothing if it doesn't reach the unit's type, race and quality (or risen dead), the ground, the side, the king's
 *  own command or a garrison standing alone. */
export function theFactorAUnitStrengthDiscoveryGivesAUnit(
  e: TheEffectOfADiscovery,
  facts: AUnitARealmsDiscoveriesMayStrengthen,
): number | null {
  if (!discUnitMatch(e, facts.theUnit)) return null;
  if (e.king && !facts.isItLedByTheKing) return null; // "led by your KING in person" effects
  if (e.terrain && (facts.theGround == null || !e.terrain.includes(facts.theGround))) return null;
  if (e.side === 'atk' && facts.isItsSideTheAttacker !== true) return null;
  if (e.side === 'def' && facts.isItsSideTheAttacker !== false) return null;
  if (e.led === 'garrison' && facts.hasItACommander) return null; // only a garrison standing without a commander
  return 1 + (e.pct ?? 0);
}

/** The product of the factors of the unit-strength effects a realm holds that reach the unit, capped at the kind's
 *  ceiling (×1.30), however many it stacks (Toby, 2026-09-21). */
export function theFactorTheUnitStrengthDiscoveriesARealmHoldsStrengthenAUnitBy(
  theEffects: readonly TheEffectOfADiscovery[],
  facts: AUnitARealmsDiscoveriesMayStrengthen,
): number {
  let m = 1;
  for (const e of theEffects) {
    const factor = theFactorAUnitStrengthDiscoveryGivesAUnit(e, facts);
    if (factor !== null) m *= factor;
  }
  return Math.min(DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS['unit-strength'].numbers.theCeiling.value, m);
}
