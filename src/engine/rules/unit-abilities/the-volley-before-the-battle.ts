// The unit abilities at the nine stages of the volley before the battle (plan P1-19g), in the volley's helpers
// (src/engine/battle/strength.ts) and applyMissileHit (src/engine/battle/terrain-and-unit-strength.ts): who shoots,
// though it is no ranged unit; who shoots first; whether the shooters see what hides; what stops the volley; whether a
// unit may be shot at; how many volleys a shooter looses; a shot's damage; what the target does to a shot; and the
// softening limit. Each is handed what its stage hands it (the registry's stage types) and returns a value; its numbers
// come from the content's row. The runners (the-registry-of-content-effects.ts) run them in their stages' order. Until
// P1-19g they were written inline in those functions, in this order.
import { KC_UNIT_CLASS } from '../../../content/kingdoms-call-data.ts';
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS as ROWS } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { UnitAbilitySlug } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { AUnitOfAForce, TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheVolleyStages = TheStagesOfEachHookPoint['volley'];

/** Whether the battle's ground is one the ability acts on. */
const onItsGround = (
  slug: 'broadside' | 'tree-watch' | 'ambush' | 'woodland-volley',
  ground: string | null | undefined,
) => ROWS[slug].onTheGround.some((g) => g === ground);
/** Whether a force holds a unit of the ability's own unit. */
const inTheForce = (slug: UnitAbilitySlug, force: readonly (AUnitOfAForce | null | undefined)[]) =>
  force.some((a) => a?.type === ROWS[slug].unit);

// Who shoots, though it is no ranged unit (each runs only for its row's unit, the units of each in the force's order).
export const WHO_SHOOTS = {
  // HUMAN — Broadside: at sea a galleon is a floating battery.
  broadside: (facts) => onItsGround('broadside', facts.ground),
  // ELF — Tree Watch: in forest or jungle the Elven Garrison shoots like an archer unit.
  'tree-watch': (facts) => onItsGround('tree-watch', facts.ground),
} satisfies Partial<Record<UnitAbilitySlug, TheVolleyStages['who shoots']>>;

// Who shoots first. DWARF — Bombardment: the guns speak first, so they get the clear shot before the cap fills.
export const WHO_SHOOTS_FIRST = {
  bombardment: () => true,
} satisfies Partial<Record<UnitAbilitySlug, TheVolleyStages['who shoots first']>>;

// The shooters see what hides. ELF — Eyes of the Forest (2026-10-11): with Eagle Riders flying with the shooters,
// nothing hides, Shadow Archers included, and an Ambush is spoiled.
export const THE_SHOOTERS_SEE_WHAT_HIDES = {
  'eyes-of-the-forest': (facts) => inTheForce('eyes-of-the-forest', facts.theShootersForce),
} satisfies Partial<Record<UnitAbilitySlug, TheVolleyStages['the shooters see what hides']>>;

// Stops the volley. ELF — Ambush: enemy archers never get a clear shot at Wardens in their own woods, unless the
// shooters see what hides.
export const STOPS_THE_VOLLEY = {
  ambush: (facts) =>
    onItsGround('ambush', facts.ground) &&
    !facts.theShootersSeeWhatHides &&
    inTheForce('ambush', facts.theForceTheVolleyIsShotAt),
} satisfies Partial<Record<UnitAbilitySlug, TheVolleyStages['stops the volley']>>;

// May be shot at (each runs only for its row's unit, the target).
export const MAY_BE_SHOT_AT = {
  // ELF — Loosed From Cover: Shadow Archers shoot from hiding and are not shot at in return, unless the shooters see
  // what hides.
  'loosed-from-cover': (facts) => (facts.theShootersSeeWhatHides ? null : 'hidden'),
  // DWARF — Armoured Hulls: arrows and bolts simply do not tell against plated warships.
  'armoured-hulls': () => ({ immune: 'armoured hull' }),
  // PRIMAL — Shell Wall (2026-10-13, the beast abilities): nor against the Great Turtles' shells.
  'shell-wall': () => ({ immune: 'shell' }),
} satisfies Partial<Record<UnitAbilitySlug, TheVolleyStages['may be shot at']>>;

// How many volleys. HUMAN — Prepared Ground: a defending Longbow company looses two.
export const HOW_MANY_VOLLEYS = {
  'prepared-ground': (facts) =>
    facts.theShootersSideAttacks ? null : ROWS['prepared-ground'].numbers.volleysDefending.value,
} satisfies Partial<Record<UnitAbilitySlug, TheVolleyStages['how many volleys']>>;

// The four garrisons, Bombardment's targets.
const GARRISONS = new Set<string>(KC_UNIT_CLASS.garrison);

// A shot's damage: the shooter's factor (1 where it doesn't act), the runner multiplies them in the stage's order.
export const A_SHOTS_DAMAGE = {
  // ELF — Woodland Volley: elven bows in elven woods.
  'woodland-volley': (facts) =>
    onItsGround('woodland-volley', facts.ground) ? ROWS['woodland-volley'].numbers.inTheWoods.value : 1,
  // DWARF — Bombardment: siege guns are built for breaking fortifications.
  bombardment: (facts) =>
    facts.theTargetsType !== null && GARRISONS.has(facts.theTargetsType)
      ? 1 + ROWS.bombardment.numbers.againstAGarrison.value
      : 1,
  // ORC — Raiders' Volley: the Black Arrows loose hardest going forward.
  'raiders-volley': (facts) => (facts.theShootersSideAttacks ? ROWS['raiders-volley'].numbers.attacking.value : 1),
} satisfies Partial<Record<UnitAbilitySlug, TheVolleyStages["a shot's damage"]>>;

// What the target does to a shot. PRIMAL — Thick Hide: a volley at the Great Bears does half, rounded up.
export const WHAT_THE_TARGET_DOES_TO_A_SHOT = {
  'thick-hide': (_facts, theDamageSoFar) => Math.ceil(theDamageSoFar * ROWS['thick-hide'].numbers.aShotsDamage.value),
} satisfies Partial<Record<UnitAbilitySlug, TheVolleyStages['what the target does to a shot']>>;

// The softening limit. DWARF — Punch Through: heavy bolts grind a target past the point bows can manage.
export const THE_SOFTENING_LIMIT = {
  'punch-through': (facts) => {
    const { aTargetOnTheGround, aWingedRider } = ROWS['punch-through'].numbers;
    return facts.theTargetFlies ? aWingedRider.value : aTargetOnTheGround.value;
  },
} satisfies Partial<Record<UnitAbilitySlug, TheVolleyStages['the softening limit']>>;
