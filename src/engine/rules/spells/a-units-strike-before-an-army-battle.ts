// The pre-battle strikes' effect at the stage "strength: a unit strikes before the battle" (plan P1-19's spells family,
// row P1-19v): what a unit's strike may do before an army battle, after battle magic, in the copy that asks. The strikes
// are each unit's, in the content's tables (a winged rider's in BATTLE_ARMY_SPELLS, else a beast's `spells` in
// PRIMAL_ARMY_DEFS_P that deal damage: P1-19l's Choice 2), so one effect casts them all; the chance is the content's
// (THE_CHANCE_OF_A_STRIKE_BEFORE_THE_BATTLE). It returns what the strike may do: the resolver draws the strike, rolls
// its chance as its copy rolls it, draws the unit struck and the damage, applies it and writes the line the effect
// names. Until P1-19v the three copies were written inline in combatVsChar's applyArmyBattleSpells (src/engine/battle/
// battles-between-heroes.ts) and twice in combatVsNPC (src/engine/battle/battles-against-province-defenders.ts), and the
// chance in primalStrikeChance (src/engine/chances-and-lair-grades.ts), which asks theChanceOfAStrikeBeforeTheBattle.
import { BATTLE_ARMY_SPELLS, KC_UNIT_CLASS, PRIMAL_ARMY_DEFS_P } from '../../../content/kingdoms-call-data.ts';
import { THE_CHANCE_OF_A_STRIKE_BEFORE_THE_BATTLE as THE_CHANCE } from '../../../content/spell-effects-their-names-numbers-and-words.ts';
import type {
  ACopyOfThePreBattleStrikes,
  APreBattleStrike,
  AUnitAboutToStrikeBeforeTheBattle,
  TheLineOfAPreBattleStrike,
  TheStagesOfEachHookPoint,
} from '../the-registry-of-content-effects.ts';

/** A strike as the content's tables hold it: its name, its damage range, whom it strikes and its flavour. */
interface AStrikeAsTheTablesHoldIt {
  readonly name: string;
  readonly dmg: readonly number[];
  readonly target: string;
  readonly flavour?: string;
}
/** The winged riders' strikes, by the unit's type. */
const A_WINGED_RIDERS_STRIKES: Readonly<Record<string, readonly AStrikeAsTheTablesHoldIt[] | undefined>> =
  BATTLE_ARMY_SPELLS;
/** The beasts' strikes, by the unit's type (a beast of no strike holds none). */
const A_BEASTS_STRIKES: Readonly<Record<string, readonly AStrikeAsTheTablesHoldIt[] | undefined>> = Object.fromEntries(
  Object.entries(PRIMAL_ARMY_DEFS_P).map(([unit, d]) => [unit, 'spells' in d ? d.spells : undefined]),
);
/** The units whose strikes land one time in two, whatever the commander's Druid. */
const THE_FLYING_UNITS: readonly string[] = KC_UNIT_CLASS.flying;

const THE_LINE_IF_IT_STRIKES: Readonly<Record<ACopyOfThePreBattleStrikes, TheLineOfAPreBattleStrike>> = {
  'between heroes': 'a unit uses its power in battle',
  "a hero's units against the guards": 'a unit uses its power in battle',
  "the guards' units against a hero": 'a defending unit uses its power in battle',
};
const EVERY_ENEMY_UNIT_IS_HIT: Readonly<Record<ACopyOfThePreBattleStrikes, TheLineOfAPreBattleStrike>> = {
  'between heroes': "a unit's power hits all enemy units",
  "a hero's units against the guards": "a unit's power hits every defending unit",
  "the guards' units against a hero": "a unit's power hits every attacking unit",
};
const ONE_ENEMY_UNIT_IS_HIT: Readonly<Record<ACopyOfThePreBattleStrikes, TheLineOfAPreBattleStrike>> = {
  'between heroes': "a unit's power hits one enemy unit",
  "a hero's units against the guards": "a unit's power hits one unit of the other side",
  "the guards' units against a hero": "a unit's power hits one unit of the other side",
};

/** The chance a unit's strike lands (primalStrikeChance): a flying unit's one in two; any other's 30% and 10% for each
 *  level of its commander's Druid, with what his items add (asked only then), to 90% at most. */
export function theChanceOfAStrikeBeforeTheBattle(
  facts: Pick<AUnitAboutToStrikeBeforeTheBattle, 'theUnitsType' | 'theDruidLevel' | 'whatTheCommandersItemsAdd'>,
): number {
  if (facts.theUnitsType && THE_FLYING_UNITS.includes(facts.theUnitsType))
    return THE_CHANCE.aFlyingUnitsStrike.thePercentage;
  const beasts = THE_CHANCE.aBeastsStrike;
  return Math.min(
    beasts.atMost,
    beasts.thePercentage + facts.theDruidLevel * beasts.perDruidLevel + facts.whatTheCommandersItemsAdd(),
  );
}

export const A_UNIT_STRIKES_BEFORE_THE_BATTLE: TheStagesOfEachHookPoint['strength']['a unit strikes before the battle'] =
  (facts) => {
    const type = facts.theUnitsType ?? '';
    const theRidersStrikes = A_WINGED_RIDERS_STRIKES[type] ?? [];
    const theBeastsStrikes = theRidersStrikes.length === 0 ? A_BEASTS_STRIKES[type] : undefined;
    const strikes = theBeastsStrikes ? theBeastsStrikes.filter((s) => (s.dmg[1] ?? 0) > 0) : theRidersStrikes;
    if (strikes.length === 0 || !facts.theEnemyHasAUnit) return null;
    return {
      theStrikes: strikes.map((s): APreBattleStrike => ({
        name: s.name,
        flavour: s.flavour,
        theBlow:
          s.target === 'all'
            ? { reaches: 'every enemy unit', theDamage: s.dmg, theLine: EVERY_ENEMY_UNIT_IS_HIT[facts.theCopy] }
            : {
                reaches: 'one enemy unit drawn at random',
                theDamage: s.dmg,
                theLine: ONE_ENEMY_UNIT_IS_HIT[facts.theCopy],
              },
      })),
      theChance: theChanceOfAStrikeBeforeTheBattle(facts),
      theLineIfItStrikes: THE_LINE_IF_IT_STRIKES[facts.theCopy],
      // A beast's strike that misses says so; a winged rider's misses quietly (to keep the reports lean).
      theLineIfItMisses: theBeastsStrikes ? "a unit's power gathers but never strikes" : null,
    };
  };
