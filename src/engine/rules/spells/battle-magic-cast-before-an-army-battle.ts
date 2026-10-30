// The battle spells' effects at the two stages of "strength" before an army battle (plan P1-19's spells family, row
// P1-19u): what each of the eight does once cast, in the copy of battle magic that casts it, and whether it has
// something to strike on the field (which the choice of a battle spell asks). Each takes its numbers from the content's
// row (src/content/spell-effects-their-names-numbers-and-words.ts) and returns what it does: the resolver draws where
// the battle drew (Lightning Bolt's units, Control Undead's unit), applies it and writes the line the effect names. Each
// copy keeps its own rule (Parked "Battle magic's three copies disagree on two rules": the guards' commander counts his
// level past 5 for Lightning Bolt; Telekinetic Storm between heroes halves only a Tactical he has, and not at sea) and
// its own lines. Until P1-19u they were written inline in applyPreBattleMagic (src/engine/battle/battles-between-
// heroes.ts), twice in combatVsNPC (src/engine/battle/battles-against-province-defenders.ts) and in battleSpellUseful
// (src/engine/magic/pre-battle-spell-choice.ts).
import {
  SPELL_EFFECTS_THE_REGISTRY_HOLDS as ROWS,
  type SpellSlug,
} from '../../../content/spell-effects-their-names-numbers-and-words.ts';
import type {
  ABattleSpellCastBeforeTheBattle,
  ACopyOfBattleMagic,
  AFieldABattleSpellMayBeCastOn,
  AnEnemyUnitAsABattleSpellReadsIt,
  AnEnemyUnitStruck,
  TheLineOfABattleSpell,
  TheStagesOfEachHookPoint,
  WhatABattleSpellDoes,
} from '../the-registry-of-content-effects.ts';

type TheStrength = TheStagesOfEachHookPoint['strength'];

/** A line for each copy (none: the copy writes none). */
type TheLinesOfEachCopy = Readonly<Record<ACopyOfBattleMagic, TheLineOfABattleSpell | null>>;
/** A line each copy writes (every copy writes one). */
type TheLineOfEachCopy = Readonly<Record<ACopyOfBattleMagic, TheLineOfABattleSpell>>;

/** The undead as Control Undead reads them: risen dead, of the Undead race, or of a type that names the dead. */
const AN_UNDEAD_TYPE_CONTROL_UNDEAD_TURNS = /Skelet|Bone|Wraith|Zombie|Ghoul|Lich/i;
/** The undead as Holy Symbol and the choice of a spell read them: risen dead, or of a type that names the dead. */
const AN_UNDEAD_TYPE_A_HOLY_SYMBOL_SEARS = /Skelet|Bone|Wraith|Zombie|Ghoul|Lich|Undead/i;

/** Each unit that `strikes`, by its place, with the strength `loses` takes from its base strength. */
function theUnitsStruck(
  units: readonly AnEnemyUnitAsABattleSpellReadsIt[],
  strikes: (unit: AnEnemyUnitAsABattleSpellReadsIt) => boolean,
  loses: (baseStrength: number) => number,
): AnEnemyUnitStruck[] {
  return units.flatMap((unit, theUnit) =>
    strikes(unit) ? [{ theUnit, theStrengthItLoses: loses(unit.baseStrength) }] : [],
  );
}

/** Nothing to strike, and the copy's line (or none). */
const nothingToStrike = (lines: TheLinesOfEachCopy, facts: ABattleSpellCastBeforeTheBattle): WhatABattleSpellDoes => ({
  kind: 'nothing to strike',
  theLine: lines[facts.theCopy],
});

const FIREBALLS = ROWS.fireball.battleMagic;
const FIREBALLS_LINE: TheLineOfEachCopy = {
  'between heroes': "a fireball halves the enemy's strongest units",
  'a hero against the guards': "a fireball engulfs the defenders' strongest units",
  "the guards' commander": "a fireball halves the attackers' strongest unit",
};
const LIGHTNING_BOLTS = ROWS['lightning-bolt'].battleMagic;
const LIGHTNING_BOLTS_LINE: TheLineOfEachCopy = {
  'between heroes': 'a lightning bolt weakens enemy units',
  'a hero against the guards': 'a lightning bolt sears the defending units',
  "the guards' commander": 'a lightning bolt sears the attacking units',
};
const A_TELEKINETIC_STORMS_CUT = ROWS['telekinetic-storm'].battleMagic.theTacticalMultiplier.value;
const A_TELEKINETIC_STORM_SCATTERS: TheLineOfABattleSpell =
  "a telekinetic storm scatters the enemy commander's formations";
const A_TELEKINETIC_STORM_FINDS_NO_COMMANDER: TheLinesOfEachCopy = {
  'between heroes': null,
  'a hero against the guards': 'a telekinetic storm finds no command among leaderless defenders',
  "the guards' commander": null,
};
const A_PSYCHIC_BLAST_FINDS_NO_COMMANDER: TheLinesOfEachCopy = {
  'between heroes': null,
  'a hero against the guards': 'a psychic blast finds no commander among the defenders',
  "the guards' commander": null,
};
const A_CURSE_FINDS_NO_COMMANDER: TheLinesOfEachCopy = {
  'between heroes': null,
  'a hero against the guards': 'a curse finds no commander among leaderless defenders',
  "the guards' commander": null,
};
const CONTROL_UNDEAD_TURNS: TheLineOfEachCopy = {
  'between heroes': "control undead turns an enemy undead unit to the caster's side",
  'a hero against the guards': "control undead turns a defending undead unit to the attacker's side",
  "the guards' commander": "control undead turns an enemy undead unit to the caster's side",
};
const CONTROL_UNDEAD_FINDS_NONE: TheLinesOfEachCopy = {
  'between heroes': 'control undead finds no enemy undead to turn',
  'a hero against the guards': 'control undead finds no undead among the defenders',
  "the guards' commander": 'control undead finds no undead among the attackers',
};
const A_HOLY_SYMBOLS_SHARE = ROWS['holy-symbol'].battleMagic.theShareOfBaseStrengthLost.value;
const A_HOLY_SYMBOL_SEARS: TheLineOfEachCopy = {
  'between heroes': 'a holy symbol weakens enemy undead units',
  'a hero against the guards': 'a holy symbol sears the defending undead',
  "the guards' commander": 'a holy symbol sears the attacking undead',
};
const A_HOLY_SYMBOL_FINDS_NONE: TheLinesOfEachCopy = {
  'between heroes': 'a holy symbol finds no enemy undead to smite',
  'a hero against the guards': 'a holy symbol finds no undead among the defenders',
  "the guards' commander": 'a holy symbol finds no undead among the attackers',
};
const SPIRITWRACKS_SHARE = ROWS.spiritwrack.battleMagic.theShareOfBaseStrengthLost.value;
const SPIRITWRACK_HALVES: TheLineOfEachCopy = {
  'between heroes': 'spiritwrack halves enemy missile units',
  'a hero against the guards': "spiritwrack halves the defenders' missile units",
  "the guards' commander": "spiritwrack halves the attackers' missile units",
};
const SPIRITWRACK_FINDS_NONE: TheLinesOfEachCopy = {
  'between heroes': 'spiritwrack finds no enemy missile troops',
  'a hero against the guards': 'spiritwrack finds no missile troops among the defenders',
  "the guards' commander": 'spiritwrack finds no missile troops among the attackers',
};
const NO_LINE: TheLinesOfEachCopy = {
  'between heroes': null,
  'a hero against the guards': null,
  "the guards' commander": null,
};

export const A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE = {
  // The strongest enemy unit (or as many as the caster's items let it strike: the Ember Rune's two) loses half its base
  // strength, rounded, at least 1; the guards' commander's strikes the first of the strongest, and no item adds one.
  fireball: (facts) => {
    const units = facts.theEnemysUnits.map((unit, theUnit) => ({ theUnit, baseStrength: unit.baseStrength }));
    const first = units[0];
    if (first === undefined) return nothingToStrike(NO_LINE, facts);
    const loses = (baseStrength: number) =>
      Math.max(1, Math.round(baseStrength * FIREBALLS.theShareOfBaseStrengthLost.value));
    const struck =
      facts.theCopy === "the guards' commander"
        ? [units.reduce((b, x) => (x.baseStrength > b.baseStrength ? x : b), first)]
        : units
            .slice()
            .sort((a, b) => b.baseStrength - a.baseStrength)
            .slice(
              0,
              facts.theStrongestUnitsTheCastersItemsLetAFireballStrike ?? FIREBALLS.theStrongestUnitsStruck.value,
            );
    return {
      kind: 'the strongest units lose strength',
      theUnitsStruck: struck.map((u) => ({ theUnit: u.theUnit, theStrengthItLoses: loses(u.baseStrength) })),
      theLine: FIREBALLS_LINE[facts.theCopy],
    };
  },
  // As many enemy units as the caster's level (at least one; counted to 5, but by a guards' commander), drawn at random
  // by the resolver, each lose 20% of its base strength, rounded, at least 1.
  'lightning-bolt': (facts) => {
    const theLevel =
      facts.theCopy === "the guards' commander"
        ? facts.theCastersLevel
        : Math.min(facts.theCastersLevel, LIGHTNING_BOLTS.theLevelItCountsTo.value);
    return {
      kind: 'units drawn at random lose strength',
      howMany: Math.min(facts.theEnemysUnits.length, Math.max(1, theLevel)),
      theStrengthEachWouldLose: facts.theEnemysUnits.map((unit) =>
        Math.max(1, Math.round(unit.baseStrength * LIGHTNING_BOLTS.theShareOfBaseStrengthLost.value)),
      ),
      theLine: LIGHTNING_BOLTS_LINE[facts.theCopy],
    };
  },
  // The enemy commander's Tactical is halved for the battle; between heroes only if he has some and not at sea (else he
  // is only marked, so no second storm is chosen).
  'telekinetic-storm': (facts) => {
    const commander = facts.theEnemyCommander;
    if (commander === null) return nothingToStrike(A_TELEKINETIC_STORM_FINDS_NO_COMMANDER, facts);
    if (facts.theCopy === 'between heroes' && !(commander.tactical > 0 && !facts.atSea))
      return {
        kind: "the enemy commander's Tactical is marked, with none to cut",
        theLine: 'a telekinetic storm finds no tactical command to disrupt',
      };
    return {
      kind: "the enemy commander's Tactical is cut",
      theMultiplier: A_TELEKINETIC_STORMS_CUT,
      theLine: A_TELEKINETIC_STORM_SCATTERS,
    };
  },
  // The enemy commander's Druid is negated for the battle.
  'psychic-blast': (facts) =>
    facts.theEnemyCommander === null
      ? nothingToStrike(A_PSYCHIC_BLAST_FINDS_NO_COMMANDER, facts)
      : {
          kind: "the enemy commander's Druid is negated",
          theLine: "a psychic blast severs the enemy commander's bond with his beasts",
        },
  // The enemy commander's best combat-affecting skill is withered for the battle.
  curse: (facts) =>
    facts.theEnemyCommander === null
      ? nothingToStrike(A_CURSE_FINDS_NO_COMMANDER, facts)
      : {
          kind: "the enemy commander's skill is withered",
          theSkill: facts.theEnemyCommander.theSkillACurseWithers,
          theLine: "a curse withers the enemy commander's skill",
        },
  // One enemy undead unit, drawn at random by the resolver among those given, defects to the caster's side.
  'control-undead': (facts) => {
    const theUndead = facts.theEnemysUnits.flatMap((unit, i) =>
      unit.isSkeletal || unit.race === 'Undead' || AN_UNDEAD_TYPE_CONTROL_UNDEAD_TURNS.test(unit.type) ? [i] : [],
    );
    if (theUndead.length === 0) return nothingToStrike(CONTROL_UNDEAD_FINDS_NONE, facts);
    return {
      kind: 'an undead unit drawn at random defects',
      theUndead,
      theLine: CONTROL_UNDEAD_TURNS[facts.theCopy],
    };
  },
  // Every enemy undead unit loses a quarter of its base strength, rounded up.
  'holy-symbol': (facts) => {
    const struck = theUnitsStruck(
      facts.theEnemysUnits,
      (unit) => unit.isSkeletal || AN_UNDEAD_TYPE_A_HOLY_SYMBOL_SEARS.test(unit.type),
      (baseStrength) => Math.ceil(baseStrength * A_HOLY_SYMBOLS_SHARE),
    );
    if (struck.length === 0) return nothingToStrike(A_HOLY_SYMBOL_FINDS_NONE, facts);
    return { kind: 'the undead lose strength', theUnitsStruck: struck, theLine: A_HOLY_SYMBOL_SEARS[facts.theCopy] };
  },
  // Every enemy missile unit loses half its base strength, rounded up.
  spiritwrack: (facts) => {
    const struck = theUnitsStruck(
      facts.theEnemysUnits,
      (unit) => unit.isAMissileUnit,
      (baseStrength) => Math.ceil(baseStrength * SPIRITWRACKS_SHARE),
    );
    if (struck.length === 0) return nothingToStrike(SPIRITWRACK_FINDS_NONE, facts);
    return {
      kind: 'the missile units lose strength',
      theUnitsStruck: struck,
      theLine: SPIRITWRACK_HALVES[facts.theCopy],
    };
  },
} satisfies Partial<Record<SpellSlug, TheStrength['a battle spell is cast before the battle']>>;

/** Whether the field holds an enemy unit of the undead (as Holy Symbol reads them). */
const theFieldHoldsTheUndead = (facts: AFieldABattleSpellMayBeCastOn) =>
  facts.theEnemysUnits.some((unit) => unit.isSkeletal || AN_UNDEAD_TYPE_A_HOLY_SYMBOL_SEARS.test(unit.type));
/** Whether the field holds an enemy unit. */
const theFieldHoldsAnEnemyUnit = (facts: AFieldABattleSpellMayBeCastOn) => facts.theEnemysUnits.length > 0;

export const A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE = {
  // Fireball and Lightning Bolt need only an enemy unit on the field.
  fireball: theFieldHoldsAnEnemyUnit,
  'lightning-bolt': theFieldHoldsAnEnemyUnit,
  // Telekinetic Storm needs an enemy commander with Tactical, not halved already this battle.
  'telekinetic-storm': ({ theEnemyCommander }) =>
    theEnemyCommander !== null && !theEnemyCommander.hisTacticalIsHalved && theEnemyCommander.tactical > 0,
  // Psychic Blast needs an enemy commander with Druid, not negated already this battle.
  'psychic-blast': ({ theEnemyCommander }) =>
    theEnemyCommander !== null && !theEnemyCommander.hisDruidIsNegated && theEnemyCommander.druid > 0,
  // Curse needs an enemy commander with a skill to wither: Tactical, Druid or Naval.
  curse: ({ theEnemyCommander }) =>
    theEnemyCommander !== null &&
    (theEnemyCommander.tactical > 0 || theEnemyCommander.druid > 0 || theEnemyCommander.naval > 0),
  // Control Undead and Holy Symbol need enemy undead.
  'control-undead': theFieldHoldsTheUndead,
  'holy-symbol': theFieldHoldsTheUndead,
  // Spiritwrack needs enemy missile units.
  spiritwrack: (facts) => facts.theEnemysUnits.some((unit) => unit.isAMissileUnit),
} satisfies Partial<Record<SpellSlug, TheStrength['a battle spell has something to strike']>>;
