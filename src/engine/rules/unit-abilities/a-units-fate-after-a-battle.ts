// The unit abilities at the two stages of a unit's fate after a battle (plan P1-19d), in rollUnitFates
// (src/engine/battle/fates.ts): a beaten unit fails its death roll, and a beaten unit fails its demotion roll. Each is
// handed what its stage hands it (the registry's stage types) and returns a value: the fate by which the unit is spared
// (plan P1-12d27: a slug of a unit's fate in the battle), or nothing; its numbers come from the content's row. The runners (the-registry-of-content-effects.ts) run them in
// their stages' order. Until P1-19d they were written inline in rollUnitFates.
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS as ROWS } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { UnitAbilitySlug } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheFateStages = TheStagesOfEachHookPoint['fate'];

// A beaten unit fails its death roll (each runs only for its row's unit).
export const A_BEATEN_UNIT_FAILS_ITS_DEATH_ROLL = {
  // PRIMAL — Regenerating Hide (2026-10-13, the beast abilities): a Cave Trolls company that fails its death roll after a
  // LOST battle shrugs it off three times in ten (the rulebook's "regenerating" brutes, now real). Not in a victory: the
  // hide knits in flight, not in the press of the win. Its die is drawn only after a lost battle, as before the registry
  // took it. The call's chance overrides the row's (o.regen: the tests feed the dice).
  'regenerating-hide': (facts) =>
    !facts.itsSideWon &&
    facts.theDice() <
      (facts.theChanceOfRegeneratingHideTheCallGives ?? ROWS['regenerating-hide'].numbers.afterALostBattle.value)
      ? 'is cut down and rises again by its regenerating hide'
      : null,
} satisfies Partial<Record<UnitAbilitySlug, TheFateStages['a beaten unit fails its death roll']>>;

// A beaten unit fails its demotion roll (each runs only for the units its row reaches).
export const A_BEATEN_UNIT_FAILS_ITS_DEMOTION_ROLL = {
  // HUMAN — Knightly Example (2026-10-11, Toby): with a Gilded Lances unit (its row's unit) in the force, the Levies and
  // the Men-at-Arms (its reach) never lose a tier in defeat: they hold, as under a Shield Fort. The call's knightly
  // overrides it (o.knightly).
  'knightly-example': (facts) =>
    (facts.theKnightlyExampleTheCallGives ?? facts.itsForce.some((u) => u?.type === ROWS['knightly-example'].unit))
      ? 'keeps its nerve under the knightly example'
      : null,
} satisfies Partial<Record<UnitAbilitySlug, TheFateStages['a beaten unit fails its demotion roll']>>;
