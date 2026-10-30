// The rule registry of the spells' effects (plan P1-19's spells family, Decisions 2, 3 and 5). A spell's effect is one
// row in src/content/ (its name as SPELL_DEFS_P keys it, its `fn` and its numbers: spell-effects-their-names-numbers-
// and-words.ts) and one entry here, keyed by the same slug, naming its effect at each stage of a hook point. The hook
// points and their stages are the content effects' (one union, in the-registry-of-content-effects.ts); each stage's
// order is THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS.
//
// A runner finds a spell's entry by the name the battle or the order holds (a Map from content, built as the file
// loads, of the entries in the stage's order), so an old save's names work as they do (Decision 8). One spell is cast
// at a time, so a stage's order is which spells it holds, not the order they run in.
import {
  SPELL_EFFECTS_THE_REGISTRY_HOLDS,
  type ASpellAsItsTextsWriteIt,
  type SpellSlug,
} from '../../content/spell-effects-their-names-numbers-and-words.ts';
import {
  A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE,
  A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE,
} from './spells/battle-magic-cast-before-an-army-battle.ts';
import { A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD } from './spells/a-combat-spell-that-harms-in-a-personal-combat.ts';
import {
  A_COMBAT_SPELL_THAT_HINDERS_TAKES_HOLD,
  A_FIGHTERS_SPELL_ADDS_TO_HIS_STEAL,
  A_MIRROR_IMAGE_IS_DISBELIEVED,
} from './spells/a-combat-spell-that-hinders-deceives-or-sways-in-a-personal-combat.ts';
import {
  A_UNIT_STRIKES_BEFORE_THE_BATTLE,
  theChanceOfAStrikeBeforeTheBattle,
} from './spells/a-units-strike-before-an-army-battle.ts';
import type {
  ABattleSpellCastBeforeTheBattle,
  ACombatSpellTakingHold,
  AFieldABattleSpellMayBeCastOn,
  AMirrorImageItsVictimMaySeeThrough,
  AStepOfACombatSpell,
  AUnitAboutToStrikeBeforeTheBattle,
  HookPointName,
  TheStagesOfEachHookPoint,
  WhatABattleSpellDoes,
  WhatAUnitsStrikeMayDo,
} from './the-registry-of-content-effects.ts';

/** An entry: the spell's effect at each stage it acts in. */
export type SpellEffectEntry = { readonly [H in HookPointName]?: Partial<TheStagesOfEachHookPoint[H]> };

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). */
export const THE_REGISTRY_OF_SPELL_EFFECTS = {
  fireball: {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE.fireball,
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE.fireball,
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD.fireball },
  },
  'lightning-bolt': {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE['lightning-bolt'],
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE['lightning-bolt'],
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD['lightning-bolt'] },
  },
  'telekinetic-storm': {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE['telekinetic-storm'],
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE['telekinetic-storm'],
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD['telekinetic-storm'] },
  },
  'psychic-blast': {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE['psychic-blast'],
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE['psychic-blast'],
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD['psychic-blast'] },
  },
  curse: {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE.curse,
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE.curse,
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HINDERS_TAKES_HOLD.curse },
  },
  'control-undead': {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE['control-undead'],
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE['control-undead'],
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HINDERS_TAKES_HOLD['control-undead'] },
  },
  'holy-symbol': {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE['holy-symbol'],
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE['holy-symbol'],
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD['holy-symbol'] },
  },
  spiritwrack: {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE.spiritwrack,
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE.spiritwrack,
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD.spiritwrack },
  },
  'hand-of-death': {
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD['hand-of-death'] },
  },
  'mirror-image': {
    personalCombat: {
      'a combat spell takes hold': A_COMBAT_SPELL_THAT_HINDERS_TAKES_HOLD['mirror-image'],
      'a mirror image is disbelieved': A_MIRROR_IMAGE_IS_DISBELIEVED['mirror-image'],
    },
  },
  invisibility: {
    personalCombat: {
      'a combat spell takes hold': A_COMBAT_SPELL_THAT_HINDERS_TAKES_HOLD.invisibility,
      "a fighter's spell adds to his steal": A_FIGHTERS_SPELL_ADDS_TO_HIS_STEAL.invisibility,
    },
  },
  charm: {
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HINDERS_TAKES_HOLD.charm },
  },
} satisfies Record<SpellSlug, SpellEffectEntry>;

/** The battle spells, in the order the battle code's list writes them (BATTLE_MAGIC_SPELL_NAMES). */
const THE_BATTLE_SPELLS = [
  'holy-symbol',
  'spiritwrack',
  'fireball',
  'telekinetic-storm',
  'lightning-bolt',
  'curse',
  'psychic-blast',
  'control-undead',
] as const;

/** Each stage's order: the entries with an effect at the stage, each once. */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS = {
  strength: {
    'a battle spell is cast before the battle': THE_BATTLE_SPELLS,
    'a battle spell has something to strike': THE_BATTLE_SPELLS,
  },
  // the combat spells, in the order pcCastCombatSpell's switch wrote them (written here, once: a constant read once is
  // written in where it is read in the engine's bundle, and so is no name of it); one spell is cast at a time
  personalCombat: {
    'a combat spell takes hold': [
      'lightning-bolt',
      'fireball',
      'holy-symbol',
      'spiritwrack',
      'psychic-blast',
      'telekinetic-storm',
      'mirror-image',
      'invisibility',
      'hand-of-death',
      'curse',
      'control-undead',
      'charm',
    ],
    "a fighter's spell adds to his steal": ['invisibility'],
    'a mirror image is disbelieved': ['mirror-image'],
  },
} as const satisfies {
  readonly [H in HookPointName]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly SpellSlug[];
  };
};

const ROWS: Readonly<Record<SpellSlug, ASpellAsItsTextsWriteIt>> = SPELL_EFFECTS_THE_REGISTRY_HOLDS;
const ENTRIES: Readonly<Record<SpellSlug, SpellEffectEntry>> = THE_REGISTRY_OF_SPELL_EFFECTS;

/** The entries of a stage's order, by the spell's name (as SPELL_DEFS_P keys it). */
const byTheSpellsName = (order: readonly SpellSlug[]) =>
  new Map<string, SpellSlug>(order.map((slug) => [ROWS[slug].name, slug]));
const CAST_BEFORE_THE_BATTLE = byTheSpellsName(
  THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS.strength['a battle spell is cast before the battle'],
);
const HAS_SOMETHING_TO_STRIKE = byTheSpellsName(
  THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS.strength['a battle spell has something to strike'],
);
const TAKES_HOLD = byTheSpellsName(THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS.personalCombat['a combat spell takes hold']);

/** The runner of "strength: a battle spell is cast before the battle" (applyPreBattleMagic, and combatVsNPC twice, once
 *  the spell's roll is made): what the spell named does, or nothing for a name the registry holds no effect for (the
 *  battle cast nothing for it). */
export function whatABattleSpellDoesBeforeTheBattle(
  theSpellsName: string,
  facts: ABattleSpellCastBeforeTheBattle,
): WhatABattleSpellDoes | null {
  const slug = CAST_BEFORE_THE_BATTLE.get(theSpellsName);
  const effect = slug === undefined ? undefined : ENTRIES[slug].strength?.['a battle spell is cast before the battle'];
  return effect ? effect(facts) : null;
}

/** The runner of "strength: a battle spell has something to strike" (battleSpellUseful): whether the spell named has
 *  something to strike on the field; a name the registry holds no effect for strikes any enemy unit. */
export function aBattleSpellHasSomethingToStrike(theSpellsName: string, facts: AFieldABattleSpellMayBeCastOn): boolean {
  const slug = HAS_SOMETHING_TO_STRIKE.get(theSpellsName);
  const effect = slug === undefined ? undefined : ENTRIES[slug].strength?.['a battle spell has something to strike'];
  return effect ? effect(facts) : facts.theEnemysUnits.length > 0;
}

/** The runner of "strength: a unit strikes before the battle" (the three copies of the pre-battle strikes, after battle
 *  magic): what the unit's strike may do, or nothing. The strikes are each unit's, in the content's tables, not a
 *  spell's (P1-19l's Choice 2), so no entry holds them: one effect casts them all (plan P1-19v). */
export function whatAUnitsStrikeMayDoBeforeTheBattle(
  facts: AUnitAboutToStrikeBeforeTheBattle,
): WhatAUnitsStrikeMayDo | null {
  return A_UNIT_STRIKES_BEFORE_THE_BATTLE(facts);
}

/** The chance a unit's strike lands before an army battle (primalStrikeChance, which the GM page and the tests call
 *  too): the effect's own rule, as the stage above counts it. */
export function theChanceOfAUnitsStrikeBeforeTheBattle(
  facts: Pick<AUnitAboutToStrikeBeforeTheBattle, 'theUnitsType' | 'theDruidLevel' | 'whatTheCommandersItemsAdd'>,
): number {
  return theChanceOfAStrikeBeforeTheBattle(facts);
}

/** The runner of "personalCombat: a combat spell takes hold" (pcCastCombatSpell, once the cast roll is made and the
 *  weakness's lines written): the steps of what the spell named does, in order, or nothing for a name the registry
 *  holds no effect for (the resolver's own code casts it). */
export function whatACombatSpellDoesAsItTakesHold(
  theSpellsName: string,
  facts: ACombatSpellTakingHold,
): readonly AStepOfACombatSpell[] | null {
  const slug = TAKES_HOLD.get(theSpellsName);
  const effect = slug === undefined ? undefined : ENTRIES[slug].personalCombat?.['a combat spell takes hold'];
  return effect ? effect(facts) : null;
}

/** The runner of "personalCombat: a fighter's spell adds to his steal" (pcAct's theft): the percentage points the
 *  spells he has cast in the fight add to his chance, each once, in the stage's order (none: 0). */
export function theChanceAThiefsSpellsAddToHisSteal(theSpellsHeHasCast: readonly string[]): number {
  let added = 0;
  for (const slug of THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS.personalCombat["a fighter's spell adds to his steal"])
    if (theSpellsHeHasCast.includes(ROWS[slug].name))
      added += ENTRIES[slug].personalCombat?.["a fighter's spell adds to his steal"]?.() ?? 0;
  return added;
}

/** The runner of "personalCombat: a mirror image is disbelieved" (resolvePersonalCombat, each round an image fights):
 *  the chance its victim sees through it, by the one spell that conjures an image. */
export function theChanceAMirrorImageIsSeenThrough(facts: AMirrorImageItsVictimMaySeeThrough): number {
  const [theSpell] = THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS.personalCombat['a mirror image is disbelieved'];
  return THE_REGISTRY_OF_SPELL_EFFECTS[theSpell].personalCombat['a mirror image is disbelieved'](facts);
}
