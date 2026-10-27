// The unit abilities at the three stages of the rout after a battle (plan P1-19j), each a stage of fate: the beaten
// force holds (Shield Fort, with Deep Halls: shieldFortHolds, src/engine/units/movement.ts), the winner runs the beaten
// down (Ride Them Down, Run Them Down, the Manticores' pursuit and Feeding Frenzy, in the battle code's order:
// pursuitsOfTheBeaten and rideThemDownBonus, the same file, for the rout of combatVsChar,
// src/engine/battle/battles-between-heroes.ts, and combatVsNPC, src/engine/battle/battles-against-province-defenders.ts),
// and a force holds the sea lanes (the Corsair Fleet's Cut the Line, between heroes, and Keep the Sea Lanes, against
// neutral guards: both battles' retreat). Each is handed what its stage hands it (the registry's stage types) and
// returns a value: whether the force holds, its pursuit, or whether it holds the sea lanes; it changes nothing, and the
// battle code applies it and writes the lines. Its numbers come from the content's row. No effect here draws a die. The
// runners (the-registry-of-content-effects.ts) run them in their stages' order, each looking for its row's unit in the
// force. Until P1-19j they were written inline in those functions, by the units' names.
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS as ROWS } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type { UnitAbilitySlug } from '../../../content/unit-abilities-their-names-numbers-and-words.ts';
import type {
  ABeatenForceAndItsFrontLine,
  APursuitOfTheBeaten,
  AUnitOfAForce,
  HowTheGroundLetsAPursuitRun,
  TheStagesOfEachHookPoint,
  ThePursuitsLine,
} from '../the-registry-of-content-effects.ts';

type TheFateStages = TheStagesOfEachHookPoint['fate'];

/** Whether the units of the type given are at least the share given of a force's places (its holes counted, as the
 *  battle code counts them), and the force has a place. */
function atLeastAShareOf(force: readonly (AUnitOfAForce | null | undefined)[], type: string, share: number): boolean {
  const n = force.length;
  return n > 0 && force.filter((a) => a?.type === type).length >= share * n;
}

/** Whether a Shield Fort holds: at least its share of the front line placed is of the types given (one at least), or,
 *  with no line placed (an estimate), at least its share of the force is Shield Fort's own unit. */
function aShieldFortHolds(facts: ABeatenForceAndItsFrontLine, theFrontLineCounts: readonly string[]): boolean {
  const { unit, numbers } = ROWS['shield-fort'];
  if (facts.theFrontLine) {
    const n = facts.theFrontLine.filter((t) => theFrontLineCounts.some((u) => u === t)).length;
    return n > 0 && n >= numbers.theFrontLineAtLeast.value * facts.theFrontLine.length;
  }
  return atLeastAShareOf(facts.theForce, unit, numbers.theFrontLineAtLeast.value);
}

// The beaten force holds (each looks for its row's unit in the force; the force holds if one says so).
export const THE_BEATEN_FORCE_HOLDS = {
  // DWARF — Shield Fort (2026-10-11, Toby: the unit abilities): at least half the FRONT LINE is Dwarven Guard. Without a
  // placed grid (an estimate) it reads half the force, as it did before.
  'shield-fort': (facts) => aShieldFortHolds(facts, [ROWS['shield-fort'].unit]),
  // DWARF — Deep Halls: in a front line placed, a Dwarf Garrison counts as Guard (its row's countsAs) for Shield Fort.
  'deep-halls': (facts) =>
    facts.theFrontLine !== null && aShieldFortHolds(facts, [ROWS['deep-halls'].countsAs, ROWS['deep-halls'].unit]),
} satisfies Partial<Record<UnitAbilitySlug, TheFateStages['the beaten force holds']>>;

/** A pursuit with its line and the fraction it adds; the winner's own death rolls as they are unless given. */
const aPursuit = (
  line: ThePursuitsLine,
  fraction: number,
  onTheGround: HowTheGroundLetsAPursuitRun = 'it runs',
  theFactorOnTheWinnersOwnDeathRolls = 1,
): APursuitOfTheBeaten => ({
  line,
  theFractionAddedToEachBeatenUnitsDeathRoll: fraction,
  theFactorOnTheWinnersOwnDeathRolls,
  onTheGround,
});

// The winner runs the beaten down (each looks for its row's unit in the winning force), in the battle code's order.
export const THE_WINNER_RUNS_THE_BEATEN_DOWN = {
  // HUMAN — Ride Them Down: light horse are murder on a broken enemy. Each Free Lances company in the winning force adds
  // +6% to each beaten unit's destruction roll, to +18%, in open country only (in woods, jungle or mountains the
  // survivors scatter into cover). The commander's War-Horn of the Plains: its Free Lances always pursue, on any ground,
  // at the full +18% (asked only when the force has Free Lances). The same in every battle, either side.
  'ride-them-down': (facts) => {
    const { unit, numbers, onTheGround } = ROWS['ride-them-down'];
    const companies = facts.theWinningForce.filter((a) => a?.type === unit).length;
    if (companies === 0) return null;
    const line = 'the free lances ride the beaten down';
    const onItsGround = onTheGround.some((g) => g === facts.ground);
    if (facts.itsCommanderCarriesTheWarHornOfThePlains())
      return aPursuit(line, numbers.atMost.value, onItsGround ? 'it runs' : 'by the war-horn of the plains');
    if (!onItsGround) return aPursuit(line, 0, 'it finds no room');
    return aPursuit(line, Math.min(numbers.atMost.value, numbers.perCompany.value * companies));
  },
  // ORC — Run Them Down (2026-10-09, Toby item 7): when at least half the winning force are Warg Riders, each beaten
  // unit's chance of being destroyed in the rout rises by 15%, on any ground. Against neutral guards, who never flee,
  // the wargs end the fight fast instead: the winner's own death rolls are halved. Neutral guards' own wargs don't run
  // a beaten hero down.
  'run-them-down': (facts) => {
    const { unit, numbers } = ROWS['run-them-down'];
    if (facts.theBattle === 'neutral guards against a hero') return null;
    if (!atLeastAShareOf(facts.theWinningForce, unit, numbers.theWinningForceAtLeast.value)) return null;
    return facts.theBattle === 'a hero against neutral guards'
      ? aPursuit(
          "the warg riders halve the winner's losses",
          0,
          'it runs',
          numbers.theWinnersOwnLossesAgainstNeutralGuards.value,
        )
      : aPursuit('the warg riders run the beaten down', numbers.eachBeatenUnitMoreLikelyToBeDestroyed.value);
  },
  // PRIMAL (2026-10-13, the beast abilities) — Relentless Hunt's pursuit: the Manticores hunt a broken foe down on any
  // ground, +15% to each beaten unit's death roll, when at least half the winning force are theirs. Between heroes only.
  'relentless-hunt': (facts) => {
    const { unit, numbers } = ROWS['relentless-hunt'];
    return facts.theBattle === 'between heroes' &&
      atLeastAShareOf(facts.theWinningForce, unit, numbers.theWinningForceAtLeast.value)
      ? aPursuit('the manticore pride hunts the beaten', numbers.theBeatenFoesRoutLosses.value)
      : null;
  },
  // PRIMAL — Feeding Frenzy: at sea the sharks tear into beaten crews, the same, when at least half the winning force
  // are theirs. Between heroes only.
  'feeding-frenzy': (facts) => {
    const { unit, numbers, onTheGround } = ROWS['feeding-frenzy'];
    return facts.theBattle === 'between heroes' &&
      onTheGround.some((g) => g === facts.ground) &&
      atLeastAShareOf(facts.theWinningForce, unit, numbers.theWinningForceAtLeast.value)
      ? aPursuit('the shark shoals tear into the beaten crews', numbers.theBeatenFoesRoutLosses.value)
      : null;
  },
} satisfies Partial<Record<UnitAbilitySlug, TheFateStages['the winner runs the beaten down']>>;

// A force holds the sea lanes (each looks for its row's unit in the force; it holds them if one says so).
export const A_FORCE_HOLDS_THE_SEA_LANES = {
  // HUMAN — Cut the Line: between heroes, a corsair-heavy victor leaves the beaten no line of retreat by sea.
  'cut-the-line': (facts) =>
    facts.theBattle === 'between heroes' &&
    atLeastAShareOf(
      facts.theForce,
      ROWS['cut-the-line'].unit,
      ROWS['cut-the-line'].numbers.theWinningForceAtLeast.value,
    ),
  // HUMAN — Keep the Sea Lanes: neutral guards never withdraw, so there is no line of theirs to sever; a corsair-heavy
  // force instead keeps its OWN escape back to the ships when beaten.
  'keep-the-sea-lanes': (facts) =>
    facts.theBattle === 'a hero against neutral guards' &&
    atLeastAShareOf(
      facts.theForce,
      ROWS['keep-the-sea-lanes'].unit,
      ROWS['keep-the-sea-lanes'].numbers.theForceAtLeast.value,
    ),
} satisfies Partial<Record<UnitAbilitySlug, TheFateStages['a force holds the sea lanes']>>;
