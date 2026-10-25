// The rule registry of content effects (plan P1-19, Decisions 2, 3 and 6). A content effect (today a unit ability) is
// one row in src/content/ (its unit, name and numbers: unit-abilities-their-names-numbers-and-words.ts) and one entry
// here, keyed by the same slug, naming its effect at each stage of a hook point. A hook point is one of the engine's
// real decisions (the nine below); its stages run in the battle code's order, and within a stage the effects run in the
// order its list gives (THE_ORDER_OF_EACH_STAGE): a product of decimals, and the ladder's words, depend on it. Each
// stage's effect type says exactly what the stage hands it, read-only, and an effect returns a value: it changes
// nothing. The resolvers ask the runners at the bottom; an effect reads only what its stage hands it and the content
// (src/engine/rules/ imports only itself, src/engine/rules-on-plain-values/ and src/content/: npm run lint:arch).
//
// The hook points' types live here, in a file that holds code, not in a file of types alone: a file only `import type`
// reaches is in no page's bundle, and the build's checks refuse it (docs/traps.md).
import {
  UNIT_ABILITIES_THE_REGISTRY_HOLDS,
  type AUnitAbilityAsTheBooksWriteIt,
  type UnitAbilitySlug,
} from '../../content/unit-abilities-their-names-numbers-and-words.ts';
import { THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE } from './unit-abilities/the-strength-of-a-unit-in-its-force.ts';
import {
  WHAT_A_SHOOTER_DOES_TO_ITS_TARGET,
  WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS,
  WHAT_THE_TARGET_DOES_TO_THE_SHOOTER,
  WHAT_THE_UNIT_IT_MEETS_DOES_TO_IT,
} from './unit-abilities/a-unit-meeting-another-or-shooting-over-the-line.ts';

/** A unit of a force as an effect reads it: its type. */
export interface AUnitOfAForce {
  readonly type: string;
}

/** What the stage "strength: the whole force" hands an effect (unitAbilityMult, inside armStr). */
export interface AUnitInItsForce {
  /** The unit's type. */
  readonly unitType: string;
  /** Its force, itself among them, with the holes the battle code leaves in a force. */
  readonly itsForce: readonly (AUnitOfAForce | null | undefined)[];
  /** Whether the enemy's force fields a ranged unit (the ladder's missile set, MISSILE_ARMIES_MASTER). */
  readonly theEnemyFieldsRangedUnits: boolean;
  /** Whether its side is the attacker. */
  readonly itsSideAttacks: boolean;
  /** Whether its force landed from longships this phase. */
  readonly landedFromLongshipsThisPhase: boolean;
  /** Whether the province borders the sea. */
  readonly coastal: boolean;
  /** The battle's ground (a terrain's name: 'sea', 'plain', …). */
  readonly ground: string | null | undefined;
}

/** A unit's part in the battle line: in the air, cavalry, ranged, or on foot (battleRole). */
export type ARoleInTheBattleLine = 'fly' | 'cav' | 'arc' | 'foot';

/** A unit placed in the battle line, as an effect reads it: its type (none on some of the bots' estimates of a battle)
 *  and its part in the line. */
export interface AUnitInTheLine {
  readonly unitType: string | undefined;
  readonly role: ARoleInTheBattleLine;
}

/** Where two units meet (abilityFront): in the front line (facing, or met by a rider guarding the end), in a flank
 *  duel, or a rider guarding a line's end. */
export type WhereTwoUnitsMeet = 'front' | 'duel' | 'guard';

/** What the stages "what a unit does to the unit it meets" and "what the unit it meets does to it" hand an effect
 *  (abilityFront): the unit, the unit it meets, and the battle's facts. */
export interface AUnitMeetingAnother {
  readonly theUnit: AUnitInTheLine;
  readonly theUnitItMeets: AUnitInTheLine;
  /** Whether the unit it meets is a Monster (KC_UNIT_CLASS.monster) or skeletal. */
  readonly theUnitItMeetsIsAMonsterOrSkeletal: boolean;
  /** The battle's ground (a terrain's name), or none. */
  readonly ground: string | null;
  readonly where: WhereTwoUnitsMeet;
  /** Whether the unit's side is the attacker. */
  readonly theUnitsSideAttacks: boolean;
}

/** What the stages "what a shooter does to its target" and "what the target does to the shooter" hand an effect
 *  (abilityBack): a ranged unit of the second line, and the enemy front unit it shoots. */
export interface AShooterAndItsTarget {
  readonly theShooter: AUnitInTheLine;
  readonly theTarget: AUnitInTheLine;
  /** The target's base strength (its type's; 0 for a unit with no type). */
  readonly theTargetsBaseStrength: number;
}

/** A multiplier, and its words in the strength ladder (the ability's name, or its own words). */
export interface AMultiplierAndItsWords {
  readonly multiplier: number;
  readonly words: string;
}

/** The effect of a stage that takes the multiplier so far and may set or change it: the new multiplier and its words,
 *  or nothing (the ability doesn't act here). */
type AnEffectOnTheMultiplierSoFar<Facts> = (facts: Facts, theMultiplierSoFar: number) => AMultiplierAndItsWords | null;

/** The hook points, each a set of named stages in the order the engine runs them, and the effect type of each stage.
 *  A stage or a hook point typed `never` has no signature yet: its family's first row writes it (plan P1-19's Choice
 *  1), so an entry on it fails to compile meanwhile. */
export interface TheStagesOfEachHookPoint {
  readonly strength: {
    /** The unit's own factor from its force and the battle's facts; the runner multiplies them in the stage's order. */
    readonly 'the whole force': (facts: AUnitInItsForce) => number;
    /** The unit's own matchup against the unit it meets, from the role matchup's multiplier (abilityFront). */
    readonly 'what a unit does to the unit it meets': AnEffectOnTheMultiplierSoFar<AUnitMeetingAnother>;
    /** What the unit it meets does to it, after the unit's own (abilityFront). */
    readonly 'what the unit it meets does to it': AnEffectOnTheMultiplierSoFar<AUnitMeetingAnother>;
    /** A shooter's own matchup against its target, from the role's multiplier (abilityBack). */
    readonly 'what a shooter does to its target': AnEffectOnTheMultiplierSoFar<AShooterAndItsTarget>;
    /** What the target does to the shooter, after the shooter's own (abilityBack). */
    readonly 'what the target does to the shooter': AnEffectOnTheMultiplierSoFar<AShooterAndItsTarget>;
    readonly 'held when hit from the side': never;
    readonly 'beside and behind it in the front line': never;
    readonly 'marked by the enemy line': never;
    readonly 'a shooter picks its target': never;
    readonly 'turns an anchored line': never;
    readonly 'what a flyer does': never;
  };
  readonly volley: never;
  readonly fate: {
    readonly 'a beaten unit fails its death roll': never;
    readonly 'a beaten unit fails its demotion roll': never;
  };
  readonly movementCost: never;
  readonly orderValidity: never;
  readonly experience: never;
  readonly visibility: never;
  readonly turnStart: never;
  readonly turnEnd: never;
}

/** The nine hook points. */
export type HookPointName = keyof TheStagesOfEachHookPoint;

/** An entry: the ability's effect at each stage it acts in. */
export type UnitAbilityEntry = { readonly [H in HookPointName]?: Partial<TheStagesOfEachHookPoint[H]> };

type TheWholeForceEffect = TheStagesOfEachHookPoint['strength']['the whole force'];

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). */
export const THE_REGISTRY_OF_UNIT_ABILITIES = {
  'sheer-numbers': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['sheer-numbers'] } },
  'reaver-crews': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['reaver-crews'] } },
  'shoal-swarm': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['shoal-swarm'] } },
  'relentless-hunt': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['relentless-hunt'] } },
  'stone-deterrent': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['stone-deterrent'] } },
  'tidal-might': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['tidal-might'] } },
  'deepwater-grasp': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['deepwater-grasp'] } },
  wyrmscale: { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE.wyrmscale } },
  'air-superiority': { strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['air-superiority'] } },
  halberds: { strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS.halberds } },
  'lance-charge': {
    strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS['lance-charge'] },
  },
  frenzy: { strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS.frenzy } },
  'wolves-panic-horses': {
    strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS['wolves-panic-horses'] },
  },
  'stoop-on-the-horses': {
    strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS['stoop-on-the-horses'] },
  },
  harriers: { strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS.harriers } },
  'woodland-skirmish': {
    strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS['woodland-skirmish'] },
  },
  bloodthirsty: {
    strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS.bloodthirsty },
  },
  maul: { strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS.maul } },
  trample: { strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS.trample } },
  'many-heads': {
    strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS['many-heads'] },
  },
  purity: { strength: { 'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS.purity } },
  'spear-hedge': {
    strength: { 'what the unit it meets does to it': WHAT_THE_UNIT_IT_MEETS_DOES_TO_IT['spear-hedge'] },
  },
  'boulder-wall': {
    strength: { 'what the unit it meets does to it': WHAT_THE_UNIT_IT_MEETS_DOES_TO_IT['boulder-wall'] },
  },
  unbreakable: { strength: { 'what the unit it meets does to it': WHAT_THE_UNIT_IT_MEETS_DOES_TO_IT.unbreakable } },
  'stone-halls': {
    strength: { 'what the unit it meets does to it': WHAT_THE_UNIT_IT_MEETS_DOES_TO_IT['stone-halls'] },
  },
  'thorn-hedge': {
    strength: { 'what the unit it meets does to it': WHAT_THE_UNIT_IT_MEETS_DOES_TO_IT['thorn-hedge'] },
  },
  'bodkin-points': {
    strength: { 'what a shooter does to its target': WHAT_A_SHOOTER_DOES_TO_ITS_TARGET['bodkin-points'] },
  },
  'volley-at-the-charge': {
    strength: { 'what a shooter does to its target': WHAT_A_SHOOTER_DOES_TO_ITS_TARGET['volley-at-the-charge'] },
  },
  marksmen: { strength: { 'what a shooter does to its target': WHAT_A_SHOOTER_DOES_TO_ITS_TARGET.marksmen } },
  'armour-piercing': {
    strength: { 'what a shooter does to its target': WHAT_A_SHOOTER_DOES_TO_ITS_TARGET['armour-piercing'] },
  },
  bombard: { strength: { 'what a shooter does to its target': WHAT_A_SHOOTER_DOES_TO_ITS_TARGET.bombard } },
  'arrow-fodder': {
    strength: { 'what the target does to the shooter': WHAT_THE_TARGET_DOES_TO_THE_SHOOTER['arrow-fodder'] },
  },
} satisfies Record<UnitAbilitySlug, UnitAbilityEntry>;

/** Each stage's order: the entries with an effect at the stage, each once, in the order they run (the battle code's
 *  order before the registry took them). */
export const THE_ORDER_OF_EACH_STAGE = {
  strength: {
    'the whole force': [
      'sheer-numbers',
      'reaver-crews',
      'shoal-swarm',
      'relentless-hunt',
      'stone-deterrent',
      'tidal-might',
      'deepwater-grasp',
      'wyrmscale',
      'air-superiority',
    ],
    'what a unit does to the unit it meets': [
      'halberds',
      'lance-charge',
      'frenzy',
      'wolves-panic-horses',
      'stoop-on-the-horses',
      'harriers',
      'woodland-skirmish',
      'bloodthirsty',
      'maul',
      'trample',
      'many-heads',
      'purity',
    ],
    'what the unit it meets does to it': ['spear-hedge', 'boulder-wall', 'unbreakable', 'stone-halls', 'thorn-hedge'],
    'what a shooter does to its target': [
      'bodkin-points',
      'volley-at-the-charge',
      'marksmen',
      'armour-piercing',
      'bombard',
    ],
    'what the target does to the shooter': ['arrow-fodder'],
  },
} as const satisfies {
  readonly [H in HookPointName]?: { readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly UnitAbilitySlug[] };
};

const ROWS: Readonly<Record<UnitAbilitySlug, AUnitAbilityAsTheBooksWriteIt>> = UNIT_ABILITIES_THE_REGISTRY_HOLDS;
const ENTRIES: Readonly<Record<UnitAbilitySlug, UnitAbilityEntry>> = THE_REGISTRY_OF_UNIT_ABILITIES;

/** The effects of "the whole force" that reach a unit of the type given (its own and those that reach every unit), in
 *  the stage's order. */
function theWholeForceEffectsReaching(unitType: string | null): readonly TheWholeForceEffect[] {
  return THE_ORDER_OF_EACH_STAGE.strength['the whole force'].flatMap((slug) => {
    const effect = ENTRIES[slug].strength?.['the whole force'];
    const row = ROWS[slug];
    return effect && (row.unit === unitType || row.reaches === 'every unit of the force') ? [effect] : [];
  });
}

// Built once, as the file loads, from the content: a battle does no more work than when the effects were inline.
const THE_WHOLE_FORCE_BY_UNIT = new Map<string, readonly TheWholeForceEffect[]>(
  Object.values(ROWS).map((row) => [row.unit, theWholeForceEffectsReaching(row.unit)]),
);
const THE_WHOLE_FORCE_FOR_ANY_OTHER_UNIT = theWholeForceEffectsReaching(null);

/** The runner of "strength: the whole force": the product of the unit's factors, in the stage's order. */
export function theStrengthOfAUnitInItsWholeForce(facts: AUnitInItsForce): number {
  let m = 1;
  for (const effect of THE_WHOLE_FORCE_BY_UNIT.get(facts.unitType) ?? THE_WHOLE_FORCE_FOR_ANY_OTHER_UNIT)
    m *= effect(facts);
  return m;
}

/** Each unit type's effects at a stage, in the stage's order. Built once, as the file loads, from the content. */
function theEffectsOfEachUnitAt<Effect>(
  order: readonly UnitAbilitySlug[],
  effectOf: (entry: UnitAbilityEntry) => Effect | undefined,
): ReadonlyMap<string | undefined, readonly Effect[]> {
  const byUnit = new Map<string | undefined, Effect[]>();
  for (const slug of order) {
    const effect = effectOf(ENTRIES[slug]);
    if (!effect) continue;
    const unit = ROWS[slug].unit;
    byUnit.set(unit, [...(byUnit.get(unit) ?? []), effect]);
  }
  return byUnit;
}

const THE_ORDER_OF_STRENGTH = THE_ORDER_OF_EACH_STAGE.strength;
const WHAT_A_UNIT_DOES_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['what a unit does to the unit it meets'],
  (entry) => entry.strength?.['what a unit does to the unit it meets'],
);
const WHAT_THE_UNIT_IT_MEETS_DOES_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['what the unit it meets does to it'],
  (entry) => entry.strength?.['what the unit it meets does to it'],
);
const WHAT_A_SHOOTER_DOES_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['what a shooter does to its target'],
  (entry) => entry.strength?.['what a shooter does to its target'],
);
const WHAT_THE_TARGET_DOES_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['what the target does to the shooter'],
  (entry) => entry.strength?.['what the target does to the shooter'],
);
const NO_EFFECTS: readonly never[] = [];

/** A multiplier, and the words of each ability that moved it, in order. */
export interface AMultiplierAndTheAbilitiesThatMovedIt {
  multiplier: number;
  readonly words: string[];
}

/** Runs a stage's effects in order on the multiplier so far, and adds the words of each that acts. */
function runOnTheMultiplier<Facts>(
  effects: readonly AnEffectOnTheMultiplierSoFar<Facts>[],
  facts: Facts,
  soFar: AMultiplierAndTheAbilitiesThatMovedIt,
): void {
  for (const effect of effects) {
    const moved = effect(facts, soFar.multiplier);
    if (!moved) continue;
    soFar.multiplier = moved.multiplier;
    soFar.words.push(moved.words);
  }
}

/** The runner of abilityFront's two stages: from the role matchup's multiplier, what the unit does to the unit it
 *  meets, then what the unit it meets does to it, each in its stage's order. */
export function theStrengthOfAUnitMeetingAnother(
  facts: AUnitMeetingAnother,
  theRoleMatchup: number,
): AMultiplierAndTheAbilitiesThatMovedIt {
  const soFar: AMultiplierAndTheAbilitiesThatMovedIt = { multiplier: theRoleMatchup, words: [] };
  runOnTheMultiplier(WHAT_A_UNIT_DOES_BY_UNIT.get(facts.theUnit.unitType) ?? NO_EFFECTS, facts, soFar);
  runOnTheMultiplier(
    WHAT_THE_UNIT_IT_MEETS_DOES_BY_UNIT.get(facts.theUnitItMeets.unitType) ?? NO_EFFECTS,
    facts,
    soFar,
  );
  return soFar;
}

/** The runner of abilityBack's two stages: from the role's multiplier, what the shooter does to its target, then what
 *  the target does to the shooter, each in its stage's order. */
export function theStrengthOfAShooterOverTheLine(
  facts: AShooterAndItsTarget,
  theRolesMultiplier: number,
): AMultiplierAndTheAbilitiesThatMovedIt {
  const soFar: AMultiplierAndTheAbilitiesThatMovedIt = { multiplier: theRolesMultiplier, words: [] };
  runOnTheMultiplier(WHAT_A_SHOOTER_DOES_BY_UNIT.get(facts.theShooter.unitType) ?? NO_EFFECTS, facts, soFar);
  runOnTheMultiplier(WHAT_THE_TARGET_DOES_BY_UNIT.get(facts.theTarget.unitType) ?? NO_EFFECTS, facts, soFar);
  return soFar;
}
