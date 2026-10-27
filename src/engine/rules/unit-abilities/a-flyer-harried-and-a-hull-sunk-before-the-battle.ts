// The unit abilities that act on the enemy before the battle (plan P1-19i): a flyer is harried before the battle (a
// stage of strength, in applyFlakScreen, src/engine/battle/strength.ts) and a hull is sunk before the battle (a stage of
// fate, in both battles: combatVsChar's applyBreachAndSwamp, src/engine/battle/battles-between-heroes.ts, and
// combatVsNPC, src/engine/battle/battles-against-province-defenders.ts). Each is handed what its stage hands it (the
// registry's stage types), the dice among it, and returns its pick: it changes nothing, and the battle code marks the
// unit and writes the line. Its numbers come from the content's row. Each draws its dice where the battle code drew
// them before the registry took it, the same count in the same order: none when nothing is left to pick. The runners
// (the-registry-of-content-effects.ts) run them in their stages' order, each for its row's unit. Until P1-19i they were
// written inline in those functions.
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS as ROWS } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { UnitAbilitySlug } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheStrengthStages = TheStagesOfEachHookPoint['strength'];
type TheFateStages = TheStagesOfEachHookPoint['fate'];

// A flyer is harried before the battle (each runs only for its row's unit).
export const A_FLYER_IS_HARRIED_BEFORE_THE_BATTLE = {
  // DWARF — Flak Screen: each Gyrocopter harries ONE enemy winged rider (FLYING_TYPES, the battle code's pick) that no
  // gyrocopter has engaged this battle, at random, and it loses 30% of its base strength (at least 1). One die, and only
  // while a flyer is left.
  'flak-screen': (facts) => {
    const flyers = facts.theEnemyFlyersNotYetHarried;
    if (!flyers.length) return null;
    const theFlyersPlace = Math.floor(facts.theDice() * flyers.length);
    const flyer = flyers[theFlyersPlace];
    if (!flyer) return null;
    return {
      theFlyersPlace,
      theStrengthItLoses: Math.max(
        1,
        Math.round(facts.theBaseStrengthOf(flyer) * ROWS['flak-screen'].numbers.theStrengthAFlyerLoses.value),
      ),
    };
  },
} satisfies Partial<Record<UnitAbilitySlug, TheStrengthStages['a flyer is harried before the battle']>>;

// A hull is sunk before the battle (each runs only for its row's unit).
export const A_HULL_IS_SUNK_BEFORE_THE_BATTLE = {
  // PRIMAL — Breach and Swamp: a Whale Cohort rises beneath an enemy hull still afloat and rolls it over, one chance in
  // four, before either side's strength is counted. Its dice are drawn only when a hull is afloat: the chance's, then,
  // when it falls under, the hull's.
  'breach-and-swamp': (facts) => {
    const hulls = facts.theEnemyHullsAfloat;
    if (!hulls.length) return null;
    if (facts.theDice() >= ROWS['breach-and-swamp'].numbers.toSinkAHull.value) return null;
    return Math.floor(facts.theDice() * hulls.length);
  },
} satisfies Partial<Record<UnitAbilitySlug, TheFateStages['a hull is sunk before the battle']>>;
