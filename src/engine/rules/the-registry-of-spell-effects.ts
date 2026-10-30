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
  A_BLESS_WARD_MAY_TURN_IT_ASIDE,
  A_CHARMED_HERO_WILL_NOT_TURN_IT_ON_HIS_LORD,
  A_CLOAKED_MARK_IS_SHIELDED_FROM_IT,
  A_SPELL_THAT_COSTS_NO_CASTING_SLOT,
  A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE,
} from './spells/the-checks-the-cast-spell-order-makes-of-a-spell.ts';
import {
  A_UNIT_STRIKES_BEFORE_THE_BATTLE,
  theChanceOfAStrikeBeforeTheBattle,
} from './spells/a-units-strike-before-an-army-battle.ts';
import type {
  ACastAndTheCastersRealm,
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
    orderValidity: {
      'a charmed hero will not turn it on his lord': A_CHARMED_HERO_WILL_NOT_TURN_IT_ON_HIS_LORD['telekinetic-storm'],
      "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE['telekinetic-storm'],
    },
  },
  'psychic-blast': {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE['psychic-blast'],
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE['psychic-blast'],
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HARMS_TAKES_HOLD['psychic-blast'] },
    orderValidity: {
      'a charmed hero will not turn it on his lord': A_CHARMED_HERO_WILL_NOT_TURN_IT_ON_HIS_LORD['psychic-blast'],
      "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE['psychic-blast'],
      'a cloaked mark is shielded from it': A_CLOAKED_MARK_IS_SHIELDED_FROM_IT['psychic-blast'],
    },
  },
  curse: {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE.curse,
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE.curse,
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HINDERS_TAKES_HOLD.curse },
    orderValidity: {
      'a charmed hero will not turn it on his lord': A_CHARMED_HERO_WILL_NOT_TURN_IT_ON_HIS_LORD.curse,
      "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE.curse,
      'a cloaked mark is shielded from it': A_CLOAKED_MARK_IS_SHIELDED_FROM_IT.curse,
    },
  },
  'control-undead': {
    strength: {
      'a battle spell is cast before the battle': A_BATTLE_SPELL_CAST_BEFORE_THE_BATTLE['control-undead'],
      'a battle spell has something to strike': A_BATTLE_SPELL_HAS_SOMETHING_TO_STRIKE['control-undead'],
    },
    personalCombat: { 'a combat spell takes hold': A_COMBAT_SPELL_THAT_HINDERS_TAKES_HOLD['control-undead'] },
    orderValidity: {
      'a charmed hero will not turn it on his lord': A_CHARMED_HERO_WILL_NOT_TURN_IT_ON_HIS_LORD['control-undead'],
      "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE['control-undead'],
    },
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
    orderValidity: {
      'a charmed hero will not turn it on his lord': A_CHARMED_HERO_WILL_NOT_TURN_IT_ON_HIS_LORD.charm,
      "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE.charm,
    },
  },
  'part-sea': { orderValidity: { 'a Bless ward may turn it aside': A_BLESS_WARD_MAY_TURN_IT_ASIDE['part-sea'] } },
  'bless-province': {
    orderValidity: { 'a spell that costs no casting slot': A_SPELL_THAT_COSTS_NO_CASTING_SLOT['bless-province'] },
  },
  oratory: {
    orderValidity: { "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE.oratory },
  },
  'phantasmal-armies': {
    orderValidity: {
      "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE['phantasmal-armies'],
    },
  },
  earthquake: { orderValidity: { 'a Bless ward may turn it aside': A_BLESS_WARD_MAY_TURN_IT_ASIDE.earthquake } },
  flood: { orderValidity: { 'a Bless ward may turn it aside': A_BLESS_WARD_MAY_TURN_IT_ASIDE.flood } },
  plague: { orderValidity: { 'a Bless ward may turn it aside': A_BLESS_WARD_MAY_TURN_IT_ASIDE.plague } },
  'divine-judgment': {
    orderValidity: {
      "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE['divine-judgment'],
    },
  },
  'mass-confusion': {
    orderValidity: {
      "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE['mass-confusion'],
    },
  },
  dominate: {
    orderValidity: {
      'a charmed hero will not turn it on his lord': A_CHARMED_HERO_WILL_NOT_TURN_IT_ON_HIS_LORD.dominate,
      "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE.dominate,
    },
  },
  'chain-lightning': {
    orderValidity: {
      "a spell's mark must stand in the province": A_SPELLS_MARK_MUST_STAND_IN_THE_PROVINCE['chain-lightning'],
    },
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
  // the Cast Spell order's checks (plan P1-19y), each in the order its set or the order's code wrote it; one spell is
  // cast at a time
  orderValidity: {
    'a charmed hero will not turn it on his lord': [
      'psychic-blast',
      'telekinetic-storm',
      'curse',
      'charm',
      'control-undead',
      'dominate',
    ],
    'a spell that costs no casting slot': ['bless-province'],
    "a spell's mark must stand in the province": [
      'charm',
      'psychic-blast',
      'telekinetic-storm',
      'oratory',
      'phantasmal-armies',
      'control-undead',
      'curse',
      'divine-judgment',
      'mass-confusion',
      'dominate',
      'chain-lightning',
    ],
    'a cloaked mark is shielded from it': ['psychic-blast', 'curse'],
    'a Bless ward may turn it aside': ['part-sea', 'earthquake', 'flood', 'plague'],
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
const THE_ORDERS_CHECKS = THE_ORDER_OF_EACH_STAGE_OF_THE_SPELLS.orderValidity;
const NOT_ON_HIS_LORD = byTheSpellsName(THE_ORDERS_CHECKS['a charmed hero will not turn it on his lord']);
const NO_CASTING_SLOT = byTheSpellsName(THE_ORDERS_CHECKS['a spell that costs no casting slot']);
const THE_MARK_STANDS_HERE = byTheSpellsName(THE_ORDERS_CHECKS["a spell's mark must stand in the province"]);
const SHIELDED_BY_A_CLOAK = byTheSpellsName(THE_ORDERS_CHECKS['a cloaked mark is shielded from it']);
const TURNED_BY_A_BLESS_WARD = byTheSpellsName(THE_ORDERS_CHECKS['a Bless ward may turn it aside']);

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

/** The runner of "orderValidity: a charmed hero will not turn it on his lord" (resolveCastSpellOrder, before the casting
 *  limit): whether a hero charmed from an enemy realm refuses to aim the spell named at his own lord's heroes; a name
 *  the registry holds no such effect for, he aims as any hero would. */
export function aCharmedHeroWillNotTurnThisSpellOnHisLord(theSpellsName: string): boolean {
  const slug = NOT_ON_HIS_LORD.get(theSpellsName);
  const effect =
    slug === undefined ? undefined : ENTRIES[slug].orderValidity?.['a charmed hero will not turn it on his lord'];
  return effect ? effect() : false;
}

/** The runner of "orderValidity: a spell that costs no casting slot" (resolveCastSpellOrder's casting limit, for each
 *  cast so far and for the cast itself): whether the spell named spends no slot of its school; a name the registry
 *  holds no such effect for spends one. */
export function theSpellCostsNoCastingSlot(theSpellsName: string, facts: ACastAndTheCastersRealm): boolean {
  const slug = NO_CASTING_SLOT.get(theSpellsName);
  const effect = slug === undefined ? undefined : ENTRIES[slug].orderValidity?.['a spell that costs no casting slot'];
  return effect ? effect(facts) : false;
}

/** The runner of "orderValidity: a spell's mark must stand in the province" (resolveCastSpellOrder, before the cast
 *  roll): whether the hero the spell named is aimed at must stand in the caster's province; a name the registry holds
 *  no such effect for needs none. */
export function theMarkOfThisSpellMustStandInTheProvince(theSpellsName: string): boolean {
  const slug = THE_MARK_STANDS_HERE.get(theSpellsName);
  const effect =
    slug === undefined ? undefined : ENTRIES[slug].orderValidity?.["a spell's mark must stand in the province"];
  return effect ? effect() : false;
}

/** The runner of "orderValidity: a cloaked mark is shielded from it" (resolveCastSpellOrder, once the cast lands):
 *  whether a hostile mark hidden by a Cloak of Many Faces is shielded from the spell named; a name the registry holds
 *  no such effect for reaches him. */
export function aCloakedMarkIsShieldedFromThisSpell(theSpellsName: string): boolean {
  const slug = SHIELDED_BY_A_CLOAK.get(theSpellsName);
  const effect = slug === undefined ? undefined : ENTRIES[slug].orderValidity?.['a cloaked mark is shielded from it'];
  return effect ? effect() : false;
}

/** The runner of "orderValidity: a Bless ward may turn it aside" (blessWardNegates, before the ward's own roll): whether
 *  an enemy's Bless ward may turn the spell named aside; a name the registry holds no such effect for it never turns. */
export function aBlessWardMayTurnThisSpellAside(theSpellsName: string): boolean {
  const slug = TURNED_BY_A_BLESS_WARD.get(theSpellsName);
  const effect = slug === undefined ? undefined : ENTRIES[slug].orderValidity?.['a Bless ward may turn it aside'];
  return effect ? effect() : false;
}
