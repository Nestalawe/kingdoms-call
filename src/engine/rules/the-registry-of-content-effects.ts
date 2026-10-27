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
import {
  A_LAND_UNIT_AT_SEA,
  THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE,
} from './unit-abilities/the-strength-of-a-unit-in-its-force.ts';
import {
  WHAT_A_SHOOTER_DOES_TO_ITS_TARGET,
  WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS,
  WHAT_THE_TARGET_DOES_TO_THE_SHOOTER,
  WHAT_THE_UNIT_IT_MEETS_DOES_TO_IT,
} from './unit-abilities/a-unit-meeting-another-or-shooting-over-the-line.ts';
import {
  A_SHOOTER_PICKS_ITS_TARGET,
  BESIDE_AND_BEHIND_IT_IN_THE_FRONT_LINE,
  HELD_WHEN_HIT_FROM_THE_SIDE,
  MARKED_BY_THE_ENEMY_LINE,
  TURNS_AN_ANCHORED_LINE,
  WHAT_A_FLYER_DOES,
} from './unit-abilities/a-unit-beside-behind-and-under-the-enemys-line.ts';
import {
  A_BEATEN_UNIT_FAILS_ITS_DEATH_ROLL,
  A_BEATEN_UNIT_FAILS_ITS_DEMOTION_ROLL,
} from './unit-abilities/a-units-fate-after-a-battle.ts';
import {
  A_FLYER_TAKES_AN_OPEN_FLANK_NO_RIDER_FILLS,
  A_RIDER_TAKES_THE_FLANK_ON_ROUGH_GROUND,
  ITS_PLACE_IN_THE_LINE,
} from './unit-abilities/a-units-place-in-the-battle-grid.ts';
import {
  A_SHOTS_DAMAGE,
  HOW_MANY_VOLLEYS,
  MAY_BE_SHOT_AT,
  STOPS_THE_VOLLEY,
  THE_SHOOTERS_SEE_WHAT_HIDES,
  THE_SOFTENING_LIMIT,
  WHAT_THE_TARGET_DOES_TO_A_SHOT,
  WHO_SHOOTS,
  WHO_SHOOTS_FIRST,
} from './unit-abilities/the-volley-before-the-battle.ts';

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

/** What the stage "strength: a land unit at sea" hands an effect (armStr, where the sea's penalty would cut a land
 *  unit's strength): the unit's type, and its force, itself among them, with the holes the battle code leaves. */
export interface ALandUnitAtSea {
  readonly unitType: string;
  readonly itsForce: readonly (AUnitOfAForce | null | undefined)[];
}

/** A unit's part in the battle line: in the air, cavalry, ranged, or on foot (battleRole). */
export type ARoleInTheBattleLine = 'fly' | 'cav' | 'arc' | 'foot';

/** A unit placed in the battle line, as an effect reads it: its type (none on some of the bots' estimates of a battle)
 *  and its part in the line. */
export interface AUnitInTheLine {
  readonly unitType: string | undefined;
  readonly role: ARoleInTheBattleLine;
}

/** What the stages "a rider takes the flank on rough ground" and "a flyer takes an open flank no rider fills" hand an
 *  effect (battleGrid, as it places the flanks): a unit of the line, and the battle's ground. */
export interface AUnitInTheLineOnItsGround {
  readonly theUnit: AUnitInTheLine;
  /** The battle's ground (a terrain's name), or none. */
  readonly ground: string | null;
}

/** What the stage "its place in the line" hands an effect (battleRegrid, as it scores the grid): a unit of the line on
 *  the battle's ground, and the line it stands in, the front or the second line (where it doesn't shoot over a fighter
 *  of its own). */
export interface AUnitInItsLine extends AUnitInTheLineOnItsGround {
  readonly itsLine: 'front' | 'second';
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

/** What the stage "held when hit from the side" hands an effect (battleFaceSide): a unit at an end of its front that
 *  the enemy line wraps, which would be hit from the side. */
export interface AUnitAtAWrappedEnd {
  readonly theUnit: AUnitInTheLine;
  /** Whether the unit's side is the attacker. */
  readonly theUnitsSideAttacks: boolean;
}

/** What the stage "beside and behind it in the front line" hands an effect (battleFaceSide): a unit of the front line,
 *  the units either side of it in the front (none at an end or beside an empty place), and the unit behind it in the
 *  second line (none if the place is empty). */
export interface AUnitBesideAndBehindOthers {
  readonly theUnit: AUnitInTheLine;
  readonly theUnitsEitherSide: readonly [left: AUnitInTheLine | null, right: AUnitInTheLine | null];
  readonly theUnitBehind: AUnitInTheLine | null;
}

/** A unit placed in a line, as the stage "marked by the enemy line" reads it: its part in the line and its strength
 *  (`s`, the grid's name for it). */
export interface AUnitPlacedInALine {
  readonly role: ARoleInTheBattleLine;
  readonly s: number;
}

/** What the stage "marked by the enemy line" hands an effect (battleFaceSide), once the enemy's line holds the
 *  ability's unit: my line, its front and second line by column (a place may be empty), and my units in the air. */
export interface MyLineAsTheEnemyLineMarksIt {
  readonly theFront: readonly (AUnitPlacedInALine | null | undefined)[];
  readonly theSecondLine: readonly (AUnitPlacedInALine | null | undefined)[];
  readonly theAir: readonly AUnitPlacedInALine[];
}

/** A mark the enemy's line leaves on mine: the units it marks (of those my line handed), the factor each of them fights
 *  at, and its words in the ladder. */
export interface AMarkOnMyLine {
  readonly theUnitsMarked: readonly AUnitPlacedInALine[];
  readonly factor: number;
  readonly words: string;
}

/** What the stage "a shooter picks its target" hands an effect (battleFaceSide): a ranged unit of the second line, and
 *  what its shot is worth at each unit of the enemy front (the unit's strength times the shooter's multiplier against
 *  it), in the front's order, its empty places left out. The effect returns the place in that list of the unit it
 *  shoots instead of the one in front of it, or nothing. */
export interface AShooterAndTheEnemyFront {
  readonly theShooter: AUnitInTheLine;
  readonly theWorthOfAShotAtEachUnitOfTheEnemyFront: readonly number[];
}

/** What the stage "turns an anchored line" hands an effect (battleFaceSide): the enemy's riders that ride free (no duel,
 *  no line's end to guard). The effect returns its words when they turn my flank even though foot anchor both ends of
 *  my front, or nothing. */
export interface TheFreeEnemyRiders {
  readonly theFreeEnemyRiders: readonly AUnitInTheLine[];
}

/** What the stage "what a flyer does" hands an effect (battleFaceSide): a unit of mine in the air, and whether the
 *  enemy has flyers (in the air or on a flank). */
export interface AFlyerAndTheEnemysFlyers {
  readonly theFlyer: AUnitInTheLine;
  readonly theEnemyHasFlyers: boolean;
}

/** What the stage "a beaten unit fails its death roll" hands an effect (rollUnitFates): a unit whose roll fell below
 *  its chance of dying, whether its side won, the dice (an effect whose roll is its own draws its die from them, and
 *  only when its condition holds), and Regenerating Hide's chance where the call gives one (o.regen, the tests'). */
export interface AUnitThatFailedItsDeathRoll {
  readonly unitType: string;
  readonly itsSideWon: boolean;
  readonly theDice: () => number;
  readonly theChanceOfRegeneratingHideTheCallGives: number | null | undefined;
}

/** The line of the battle by which a unit that failed its death roll lives (the kind of the fact the views word; the
 *  resolver gives it the unit's reference). */
export type TheLineOfAUnitThatLivesThroughItsDeathRoll = 'a unit is cut down and rises again by its regenerating hide';

/** What the stage "a beaten unit fails its demotion roll" hands an effect (rollUnitFates): a unit of the beaten side
 *  whose second roll fell below its chance of losing a tier (no Shield Fort holding it), its force, itself among them,
 *  with the holes the battle code leaves in a force, and the Knightly Example where the call gives it (o.knightly). */
export interface AUnitThatFailedItsDemotionRoll {
  readonly unitType: string;
  readonly itsForce: readonly (AUnitOfAForce | null | undefined)[];
  readonly theKnightlyExampleTheCallGives: boolean | null | undefined;
}

/** The line of the battle by which a unit that failed its demotion roll holds its tier (the kind of the fact the views
 *  word; the resolver gives it the unit's reference). */
export type TheLineOfAUnitThatHoldsThroughItsDemotionRoll = 'a unit keeps its nerve under the knightly example';

/** What the stage "who shoots" hands an effect (abilityMissileUnits): a unit of the shooters' force that is no ranged
 *  unit, and the battle's ground. */
export interface AUnitThatIsNoRangedUnitOnItsGround {
  readonly unitType: string;
  /** The battle's ground (a terrain's name), or none. */
  readonly ground: string | null | undefined;
}

/** What the stage "who shoots first" hands an effect (abilityMissileUnits' order): a shooter's type. */
export interface AShooter {
  readonly theShootersType: string;
}

/** What the stage "the shooters see what hides" hands an effect: the shooters' force, with the holes the battle code
 *  leaves in a force. */
export interface TheShootersForce {
  readonly theShootersForce: readonly (AUnitOfAForce | null | undefined)[];
}

/** What the stage "stops the volley" hands an effect (archeryBlockedBy): the force the volley would be shot at (the
 *  side defending against it), the battle's ground, and whether the shooters see what hides. */
export interface AVolleyAtAForce {
  readonly theForceTheVolleyIsShotAt: readonly (AUnitOfAForce | null | undefined)[];
  readonly ground: string | null | undefined;
  readonly theShootersSeeWhatHides: boolean;
}

/** What the stage "may be shot at" hands an effect (missileTargetPool, missileCapReached, applyMissileHit): a unit of
 *  the force shot at, and whether the shooters see what hides. */
export interface AUnitAVolleyIsShotAt {
  readonly theTargetsType: string;
  readonly theShootersSeeWhatHides: boolean;
}

/** The words of the battle line by which a shot glances off a unit that is immune to volleys (whyTheShotGlances). */
export type WhyAShotGlancesOffAUnit = 'armoured hull' | 'shell';

/** Why a unit may not be shot at: it hides from these shooters, or every shot glances off it, with the line's words. */
export type WhyAUnitMayNotBeShotAt = 'hidden' | { readonly immune: WhyAShotGlancesOffAUnit };

/** What the stage "how many volleys" hands an effect (abilityVolleys): a shooter's type, and whether its side attacks. */
export interface AShooterAndItsSide {
  readonly theShootersType: string;
  readonly theShootersSideAttacks: boolean;
}

/** What the stage "a shot's damage" hands an effect (missileDamageMult): the shooter's type, its target's (none when
 *  the call gives no target), the battle's ground, and whether the shooter's side attacks. */
export interface AShotAtItsTarget {
  readonly theShootersType: string;
  readonly theTargetsType: string | null;
  readonly ground: string | null | undefined;
  readonly theShootersSideAttacks: boolean;
}

/** What the stage "what the target does to a shot" hands an effect (applyMissileHit): the target's type. */
export interface TheTargetOfAShot {
  readonly theTargetsType: string;
}

/** What the stage "the softening limit" hands an effect (missileCap): the shooter's type (none when the call gives no
 *  shooter), and whether its target is a winged rider (FLYING_TYPES). */
export interface AShooterAndWhetherItsTargetFlies {
  readonly theShootersType: string | undefined;
  readonly theTargetFlies: boolean;
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
    /** Whether the sea's penalty to a land unit is waived (armStr, before the unit's factors from its force). */
    readonly 'a land unit at sea': (facts: ALandUnitAtSea) => boolean;
    /** The unit's own factor from its force and the battle's facts; the runner multiplies them in the stage's order. */
    readonly 'the whole force': (facts: AUnitInItsForce) => number;
    /** Whether a rider takes the one flank slot rough ground allows (battleGrid, through abilityFlanksRough). */
    readonly 'a rider takes the flank on rough ground': (facts: AUnitInTheLineOnItsGround) => boolean;
    /** Whether a flyer leaves the air for a flank slot no rider fills, on open ground (battleGrid). */
    readonly 'a flyer takes an open flank no rider fills': (facts: AUnitInTheLineOnItsGround) => boolean;
    /** The multiplier of the unit's place in its line, and its words, or nothing (the line's own: battleRegrid). */
    readonly 'its place in the line': (facts: AUnitInItsLine) => AMultiplierAndItsWords | null;
    /** The unit's own matchup against the unit it meets, from the role matchup's multiplier (abilityFront). */
    readonly 'what a unit does to the unit it meets': AnEffectOnTheMultiplierSoFar<AUnitMeetingAnother>;
    /** What the unit it meets does to it, after the unit's own (abilityFront). */
    readonly 'what the unit it meets does to it': AnEffectOnTheMultiplierSoFar<AUnitMeetingAnother>;
    /** A shooter's own matchup against its target, from the role's multiplier (abilityBack). */
    readonly 'what a shooter does to its target': AnEffectOnTheMultiplierSoFar<AShooterAndItsTarget>;
    /** What the target does to the shooter, after the shooter's own (abilityBack). */
    readonly 'what the target does to the shooter': AnEffectOnTheMultiplierSoFar<AShooterAndItsTarget>;
    /** Whether a unit at a wrapped end isn't hit from the side: the ability's words, or nothing (battleFaceSide). */
    readonly 'held when hit from the side': (facts: AUnitAtAWrappedEnd) => string | null;
    /** What the units beside and behind a front-line unit do to it, after its facing and any side hit. */
    readonly 'beside and behind it in the front line': AnEffectOnTheMultiplierSoFar<AUnitBesideAndBehindOthers>;
    /** The units of my line the enemy's ability marks, and the factor they fight at (the resolver applies each mark
     *  last, where the unit marked fights: the front, the second line, the air). */
    readonly 'marked by the enemy line': (myLine: MyLineAsTheEnemyLineMarksIt) => AMarkOnMyLine | null;
    /** The unit of the enemy front a shooter shoots instead of the one in front of it: its place in the list. */
    readonly 'a shooter picks its target': (facts: AShooterAndTheEnemyFront) => number | null;
    /** Whether free enemy riders turn an anchored line: the ability's words, or nothing. */
    readonly 'turns an anchored line': (facts: TheFreeEnemyRiders) => string | null;
    /** A unit's own ability in the air, from ×1. */
    readonly 'what a flyer does': AnEffectOnTheMultiplierSoFar<AFlyerAndTheEnemysFlyers>;
  };
  readonly volley: {
    /** Whether a unit that is no ranged unit shoots in the volley (abilityMissileUnits, after the ranged units). */
    readonly 'who shoots': (facts: AUnitThatIsNoRangedUnitOnItsGround) => boolean;
    /** Whether a shooter shoots before the others (the order of abilityMissileUnits' list, a stable sort). */
    readonly 'who shoots first': (facts: AShooter) => boolean;
    /** Whether the shooters see what hides (missileTargetPool, archeryBlockedBy, eyesOfTheForestLine). */
    readonly 'the shooters see what hides': (facts: TheShootersForce) => boolean;
    /** Whether the force shot at stops the volley altogether (archeryBlockedBy, eyesOfTheForestLine). */
    readonly 'stops the volley': (facts: AVolleyAtAForce) => boolean;
    /** Why a unit may not be shot at, or nothing (missileTargetPool; missileCapReached and applyMissileHit read the
     *  immunity alone). */
    readonly 'may be shot at': (facts: AUnitAVolleyIsShotAt) => WhyAUnitMayNotBeShotAt | null;
    /** How many volleys a shooter looses, or nothing (one: abilityVolleys). */
    readonly 'how many volleys': (facts: AShooterAndItsSide) => number | null;
    /** The shooter's factor on a shot's damage; the runner multiplies them in the stage's order (missileDamageMult). */
    readonly "a shot's damage": (facts: AShotAtItsTarget) => number;
    /** The damage of a shot after the target's ability, from the damage so far (after a flyer's double), or nothing
     *  (applyMissileHit). */
    readonly 'what the target does to a shot': (facts: TheTargetOfAShot, theDamageSoFar: number) => number | null;
    /** The share of the target's strength a shooter may soften it to, or nothing (the usual limit: missileCap). */
    readonly 'the softening limit': (facts: AShooterAndWhetherItsTargetFlies) => number | null;
  };
  readonly fate: {
    /** Whether a unit that failed its death roll lives: the line of the battle by which it does, or nothing (it dies). */
    readonly 'a beaten unit fails its death roll': (
      facts: AUnitThatFailedItsDeathRoll,
    ) => TheLineOfAUnitThatLivesThroughItsDeathRoll | null;
    /** Whether a beaten unit that failed its demotion roll holds its tier: the line by which it does, or nothing. */
    readonly 'a beaten unit fails its demotion roll': (
      facts: AUnitThatFailedItsDemotionRoll,
    ) => TheLineOfAUnitThatHoldsThroughItsDemotionRoll | null;
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
    strength: {
      'a flyer takes an open flank no rider fills': A_FLYER_TAKES_AN_OPEN_FLANK_NO_RIDER_FILLS['stoop-on-the-horses'],
      'what a unit does to the unit it meets': WHAT_A_UNIT_DOES_TO_THE_UNIT_IT_MEETS['stoop-on-the-horses'],
    },
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
  unbreakable: {
    strength: {
      'what the unit it meets does to it': WHAT_THE_UNIT_IT_MEETS_DOES_TO_IT.unbreakable,
      'held when hit from the side': HELD_WHEN_HIT_FROM_THE_SIDE.unbreakable,
    },
  },
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
  marksmen: {
    strength: {
      'what a shooter does to its target': WHAT_A_SHOOTER_DOES_TO_ITS_TARGET.marksmen,
      'a shooter picks its target': A_SHOOTER_PICKS_ITS_TARGET.marksmen,
    },
  },
  'armour-piercing': {
    strength: { 'what a shooter does to its target': WHAT_A_SHOOTER_DOES_TO_ITS_TARGET['armour-piercing'] },
  },
  bombard: { strength: { 'what a shooter does to its target': WHAT_A_SHOOTER_DOES_TO_ITS_TARGET.bombard } },
  'arrow-fodder': {
    strength: { 'what the target does to the shooter': WHAT_THE_TARGET_DOES_TO_THE_SHOOTER['arrow-fodder'] },
  },
  rooted: { strength: { 'held when hit from the side': HELD_WHEN_HIT_FROM_THE_SIDE.rooted } },
  'hold-the-gate': { strength: { 'held when hit from the side': HELD_WHEN_HIT_FROM_THE_SIDE['hold-the-gate'] } },
  shieldwall: {
    strength: { 'beside and behind it in the front line': BESIDE_AND_BEHIND_IT_IN_THE_FRONT_LINE.shieldwall },
  },
  'town-watch': {
    strength: { 'beside and behind it in the front line': BESIDE_AND_BEHIND_IT_IN_THE_FRONT_LINE['town-watch'] },
  },
  sergeants: {
    strength: { 'beside and behind it in the front line': BESIDE_AND_BEHIND_IT_IN_THE_FRONT_LINE.sergeants },
  },
  'driven-before-them': {
    strength: {
      'beside and behind it in the front line': BESIDE_AND_BEHIND_IT_IN_THE_FRONT_LINE['driven-before-them'],
    },
  },
  'terror-from-above': { strength: { 'marked by the enemy line': MARKED_BY_THE_ENEMY_LINE['terror-from-above'] } },
  'dive-on-the-bowmen': { strength: { 'marked by the enemy line': MARKED_BY_THE_ENEMY_LINE['dive-on-the-bowmen'] } },
  'storm-wings': { strength: { 'marked by the enemy line': MARKED_BY_THE_ENEMY_LINE['storm-wings'] } },
  'battering-horns': { strength: { 'turns an anchored line': TURNS_AN_ANCHORED_LINE['battering-horns'] } },
  'flak-gunners': { strength: { 'what a flyer does': WHAT_A_FLYER_DOES['flak-gunners'] } },
  'regenerating-hide': {
    fate: { 'a beaten unit fails its death roll': A_BEATEN_UNIT_FAILS_ITS_DEATH_ROLL['regenerating-hide'] },
  },
  'knightly-example': {
    fate: { 'a beaten unit fails its demotion roll': A_BEATEN_UNIT_FAILS_ITS_DEMOTION_ROLL['knightly-example'] },
  },
  broadside: { volley: { 'who shoots': WHO_SHOOTS.broadside } },
  'tree-watch': { volley: { 'who shoots': WHO_SHOOTS['tree-watch'] } },
  bombardment: {
    volley: { 'who shoots first': WHO_SHOOTS_FIRST.bombardment, "a shot's damage": A_SHOTS_DAMAGE.bombardment },
  },
  'eyes-of-the-forest': {
    volley: { 'the shooters see what hides': THE_SHOOTERS_SEE_WHAT_HIDES['eyes-of-the-forest'] },
  },
  ambush: { volley: { 'stops the volley': STOPS_THE_VOLLEY.ambush } },
  'loosed-from-cover': { volley: { 'may be shot at': MAY_BE_SHOT_AT['loosed-from-cover'] } },
  'armoured-hulls': { volley: { 'may be shot at': MAY_BE_SHOT_AT['armoured-hulls'] } },
  'shell-wall': { volley: { 'may be shot at': MAY_BE_SHOT_AT['shell-wall'] } },
  'prepared-ground': { volley: { 'how many volleys': HOW_MANY_VOLLEYS['prepared-ground'] } },
  'woodland-volley': { volley: { "a shot's damage": A_SHOTS_DAMAGE['woodland-volley'] } },
  'raiders-volley': { volley: { "a shot's damage": A_SHOTS_DAMAGE['raiders-volley'] } },
  'thick-hide': { volley: { 'what the target does to a shot': WHAT_THE_TARGET_DOES_TO_A_SHOT['thick-hide'] } },
  'punch-through': { volley: { 'the softening limit': THE_SOFTENING_LIMIT['punch-through'] } },
  'sea-archers': { strength: { 'a land unit at sea': A_LAND_UNIT_AT_SEA['sea-archers'] } },
  'through-the-trees': {
    strength: {
      'a rider takes the flank on rough ground': A_RIDER_TAKES_THE_FLANK_ON_ROUGH_GROUND['through-the-trees'],
    },
  },
  'through-the-glades': {
    strength: {
      'a rider takes the flank on rough ground': A_RIDER_TAKES_THE_FLANK_ON_ROUGH_GROUND['through-the-glades'],
    },
  },
  'crag-charge': {
    strength: { 'a rider takes the flank on rough ground': A_RIDER_TAKES_THE_FLANK_ON_ROUGH_GROUND['crag-charge'] },
  },
  'brawling-archers': { strength: { 'its place in the line': ITS_PLACE_IN_THE_LINE['brawling-archers'] } },
  'colossal-bulk': { strength: { 'its place in the line': ITS_PLACE_IN_THE_LINE['colossal-bulk'] } },
} satisfies Record<UnitAbilitySlug, UnitAbilityEntry>;

/** Each stage's order: the entries with an effect at the stage, each once, in the order they run (the battle code's
 *  order before the registry took them). */
export const THE_ORDER_OF_EACH_STAGE = {
  strength: {
    'a land unit at sea': ['sea-archers'],
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
    'a rider takes the flank on rough ground': ['through-the-trees', 'through-the-glades', 'crag-charge'],
    'a flyer takes an open flank no rider fills': ['stoop-on-the-horses'],
    'its place in the line': ['brawling-archers', 'colossal-bulk'],
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
    'held when hit from the side': ['unbreakable', 'rooted', 'hold-the-gate'],
    'beside and behind it in the front line': ['shieldwall', 'town-watch', 'sergeants', 'driven-before-them'],
    'marked by the enemy line': ['terror-from-above', 'dive-on-the-bowmen', 'storm-wings'],
    'a shooter picks its target': ['marksmen'],
    'turns an anchored line': ['battering-horns'],
    'what a flyer does': ['flak-gunners'],
  },
  volley: {
    'who shoots': ['broadside', 'tree-watch'],
    'who shoots first': ['bombardment'],
    'the shooters see what hides': ['eyes-of-the-forest'],
    'stops the volley': ['ambush'],
    'may be shot at': ['loosed-from-cover', 'armoured-hulls', 'shell-wall'],
    'how many volleys': ['prepared-ground'],
    "a shot's damage": ['woodland-volley', 'bombardment', 'raiders-volley'],
    'what the target does to a shot': ['thick-hide'],
    'the softening limit': ['punch-through'],
  },
  fate: {
    'a beaten unit fails its death roll': ['regenerating-hide'],
    'a beaten unit fails its demotion roll': ['knightly-example'],
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

/** Each unit type's effects at a stage, in the stage's order: an ability's effect is the effect of its own unit, or of
 *  each unit its row says it reaches (Hold the Gate: every garrison; Sergeants: the Levies). Built once, as the file
 *  loads, from the content. */
function theEffectsOfEachUnitAt<Effect>(
  order: readonly UnitAbilitySlug[],
  effectOf: (entry: UnitAbilityEntry) => Effect | undefined,
): ReadonlyMap<string | undefined, readonly Effect[]> {
  const byUnit = new Map<string | undefined, Effect[]>();
  for (const slug of order) {
    const effect = effectOf(ENTRIES[slug]);
    if (!effect) continue;
    const { unit, reaches } = ROWS[slug];
    for (const reached of typeof reaches === 'object' ? reaches : [unit])
      byUnit.set(reached, [...(byUnit.get(reached) ?? []), effect]);
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
const HELD_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['held when hit from the side'],
  (entry) => entry.strength?.['held when hit from the side'],
);
const BESIDE_AND_BEHIND_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['beside and behind it in the front line'],
  (entry) => entry.strength?.['beside and behind it in the front line'],
);
const A_SHOOTER_PICKS_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['a shooter picks its target'],
  (entry) => entry.strength?.['a shooter picks its target'],
);
const WHAT_A_FLYER_DOES_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['what a flyer does'],
  (entry) => entry.strength?.['what a flyer does'],
);
type MarkedByTheEnemyLineEffect = TheStagesOfEachHookPoint['strength']['marked by the enemy line'];
/** The effects of "marked by the enemy line", in the stage's order, each with the unit the enemy's line must hold. */
const THE_MARKS_OF_THE_ENEMY_LINE = THE_ORDER_OF_STRENGTH['marked by the enemy line'].flatMap((slug) => {
  const effect = ENTRIES[slug].strength?.['marked by the enemy line'];
  return effect ? [{ unit: ROWS[slug].unit, effect }] : [];
}) satisfies readonly { unit: string; effect: MarkedByTheEnemyLineEffect }[];
type TurnsAnAnchoredLineEffect = TheStagesOfEachHookPoint['strength']['turns an anchored line'];
/** The effects of "turns an anchored line", in the stage's order (each looks for its unit among the free riders). */
const TURNS_AN_ANCHORED_LINE_EFFECTS = THE_ORDER_OF_STRENGTH['turns an anchored line'].flatMap((slug) => {
  const effect = ENTRIES[slug].strength?.['turns an anchored line'];
  return effect ? [effect] : [];
}) satisfies readonly TurnsAnAnchoredLineEffect[];
const THE_ORDER_OF_FATE = THE_ORDER_OF_EACH_STAGE.fate;
const THE_DEATH_ROLL_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_FATE['a beaten unit fails its death roll'],
  (entry) => entry.fate?.['a beaten unit fails its death roll'],
);
const THE_DEMOTION_ROLL_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_FATE['a beaten unit fails its demotion roll'],
  (entry) => entry.fate?.['a beaten unit fails its demotion roll'],
);
const THE_ORDER_OF_THE_VOLLEY = THE_ORDER_OF_EACH_STAGE.volley;
type WhoShootsEffect = TheStagesOfEachHookPoint['volley']['who shoots'];
/** The effects of "who shoots", in the stage's order, each with its row's unit. */
const WHO_SHOOTS_EFFECTS = THE_ORDER_OF_THE_VOLLEY['who shoots'].flatMap((slug) => {
  const effect = ENTRIES[slug].volley?.['who shoots'];
  return effect ? [{ unit: ROWS[slug].unit, effect }] : [];
}) satisfies readonly { unit: string; effect: WhoShootsEffect }[];
const WHO_SHOOTS_FIRST_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_THE_VOLLEY['who shoots first'],
  (entry) => entry.volley?.['who shoots first'],
);
type TheShootersSeeWhatHidesEffect = TheStagesOfEachHookPoint['volley']['the shooters see what hides'];
/** The effects of "the shooters see what hides", in the stage's order (each looks for its unit in the shooters' force). */
const THE_SHOOTERS_SEE_WHAT_HIDES_EFFECTS = THE_ORDER_OF_THE_VOLLEY['the shooters see what hides'].flatMap((slug) => {
  const effect = ENTRIES[slug].volley?.['the shooters see what hides'];
  return effect ? [effect] : [];
}) satisfies readonly TheShootersSeeWhatHidesEffect[];
type StopsTheVolleyEffect = TheStagesOfEachHookPoint['volley']['stops the volley'];
/** The effects of "stops the volley", in the stage's order (each looks for its unit in the force shot at). */
const STOPS_THE_VOLLEY_EFFECTS = THE_ORDER_OF_THE_VOLLEY['stops the volley'].flatMap((slug) => {
  const effect = ENTRIES[slug].volley?.['stops the volley'];
  return effect ? [effect] : [];
}) satisfies readonly StopsTheVolleyEffect[];
const MAY_BE_SHOT_AT_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_THE_VOLLEY['may be shot at'],
  (entry) => entry.volley?.['may be shot at'],
);
const HOW_MANY_VOLLEYS_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_THE_VOLLEY['how many volleys'],
  (entry) => entry.volley?.['how many volleys'],
);
const A_SHOTS_DAMAGE_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_THE_VOLLEY["a shot's damage"],
  (entry) => entry.volley?.["a shot's damage"],
);
const WHAT_THE_TARGET_DOES_TO_A_SHOT_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_THE_VOLLEY['what the target does to a shot'],
  (entry) => entry.volley?.['what the target does to a shot'],
);
const THE_SOFTENING_LIMIT_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_THE_VOLLEY['the softening limit'],
  (entry) => entry.volley?.['the softening limit'],
);
const A_RIDER_TAKES_THE_FLANK_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['a rider takes the flank on rough ground'],
  (entry) => entry.strength?.['a rider takes the flank on rough ground'],
);
const A_FLYER_TAKES_AN_OPEN_FLANK_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['a flyer takes an open flank no rider fills'],
  (entry) => entry.strength?.['a flyer takes an open flank no rider fills'],
);
const ITS_PLACE_IN_THE_LINE_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['its place in the line'],
  (entry) => entry.strength?.['its place in the line'],
);
type ALandUnitAtSeaEffect = TheStagesOfEachHookPoint['strength']['a land unit at sea'];
/** The effects of "a land unit at sea", in the stage's order (each runs for every land unit at sea: Sea Archers looks
 *  for its unit in the force, and reaches its ranged units). */
const A_LAND_UNIT_AT_SEA_EFFECTS = THE_ORDER_OF_STRENGTH['a land unit at sea'].flatMap((slug) => {
  const effect = ENTRIES[slug].strength?.['a land unit at sea'];
  return effect ? [effect] : [];
}) satisfies readonly ALandUnitAtSeaEffect[];
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

/** The runner of "held when hit from the side" (battleFaceSide): the words of the first of the unit's abilities that
 *  holds it, in the stage's order, or nothing (it is hit from the side). */
export function theAbilityThatHoldsAUnitHitFromTheSide(facts: AUnitAtAWrappedEnd): string | null {
  for (const effect of HELD_BY_UNIT.get(facts.theUnit.unitType) ?? NO_EFFECTS) {
    const words = effect(facts);
    if (words !== null) return words;
  }
  return null;
}

/** The runner of "beside and behind it in the front line" (battleFaceSide): from the multiplier so far, the unit's
 *  effects in the stage's order. */
export function theStrengthOfAUnitBesideAndBehindOthers(
  facts: AUnitBesideAndBehindOthers,
  theMultiplierSoFar: number,
): AMultiplierAndTheAbilitiesThatMovedIt {
  const soFar: AMultiplierAndTheAbilitiesThatMovedIt = { multiplier: theMultiplierSoFar, words: [] };
  runOnTheMultiplier(BESIDE_AND_BEHIND_BY_UNIT.get(facts.theUnit.unitType) ?? NO_EFFECTS, facts, soFar);
  return soFar;
}

/** The runner of "marked by the enemy line" (battleFaceSide): in the stage's order, the mark of each ability whose
 *  unit the enemy's line holds (the resolver says which it holds, from its grid). */
export function theMarksTheEnemyLineLeavesOnMine(
  myLine: MyLineAsTheEnemyLineMarksIt,
  theEnemyLineHoldsAUnitOf: (unitType: string) => boolean,
): readonly AMarkOnMyLine[] {
  const marks: AMarkOnMyLine[] = [];
  for (const { unit, effect } of THE_MARKS_OF_THE_ENEMY_LINE) {
    if (!theEnemyLineHoldsAUnitOf(unit)) continue;
    const mark = effect(myLine);
    if (mark) marks.push(mark);
  }
  return marks;
}

/** The runner of "a shooter picks its target" (battleFaceSide): the place, in the enemy front's list, of the unit the
 *  first of the shooter's abilities that picks one picks, or nothing. The worth of each shot is worked out only for a
 *  shooter with such an ability (the resolver hands the work, not its result). */
export function theTargetAShooterPicks(
  theShooter: AUnitInTheLine,
  theWorthOfAShotAtEachUnitOfTheEnemyFront: () => readonly number[],
): number | null {
  const effects = A_SHOOTER_PICKS_BY_UNIT.get(theShooter.unitType) ?? NO_EFFECTS;
  if (!effects.length) return null;
  const facts: AShooterAndTheEnemyFront = {
    theShooter,
    theWorthOfAShotAtEachUnitOfTheEnemyFront: theWorthOfAShotAtEachUnitOfTheEnemyFront(),
  };
  for (const effect of effects) {
    const pick = effect(facts);
    if (pick !== null) return pick;
  }
  return null;
}

/** The runner of "turns an anchored line" (battleFaceSide): the words of the first ability, in the stage's order, by
 *  which the free enemy riders turn an anchored line, or nothing. */
export function theAbilityThatTurnsAnAnchoredLine(facts: TheFreeEnemyRiders): string | null {
  for (const effect of TURNS_AN_ANCHORED_LINE_EFFECTS) {
    const words = effect(facts);
    if (words !== null) return words;
  }
  return null;
}

/** The runner of "what a flyer does" (battleFaceSide): from ×1, the flyer's effects in the stage's order. */
export function theStrengthOfAFlyer(facts: AFlyerAndTheEnemysFlyers): AMultiplierAndTheAbilitiesThatMovedIt {
  const soFar: AMultiplierAndTheAbilitiesThatMovedIt = { multiplier: 1, words: [] };
  runOnTheMultiplier(WHAT_A_FLYER_DOES_BY_UNIT.get(facts.theFlyer.unitType) ?? NO_EFFECTS, facts, soFar);
  return soFar;
}

/** The runner of "a beaten unit fails its death roll" (rollUnitFates): the line of the first of the unit's abilities,
 *  in the stage's order, by which it lives, or nothing (it dies). An effect that rolls draws its die only when it runs,
 *  so a unit with no such ability draws none. */
export function theLineByWhichAUnitLivesThroughItsDeathRoll(
  facts: AUnitThatFailedItsDeathRoll,
): TheLineOfAUnitThatLivesThroughItsDeathRoll | null {
  for (const effect of THE_DEATH_ROLL_BY_UNIT.get(facts.unitType) ?? NO_EFFECTS) {
    const line = effect(facts);
    if (line !== null) return line;
  }
  return null;
}

/** The runner of "a beaten unit fails its demotion roll" (rollUnitFates): the line of the first ability reaching the
 *  unit, in the stage's order, by which it holds its tier, or nothing (it loses one). */
export function theLineByWhichABeatenUnitHoldsItsTier(
  facts: AUnitThatFailedItsDemotionRoll,
): TheLineOfAUnitThatHoldsThroughItsDemotionRoll | null {
  for (const effect of THE_DEMOTION_ROLL_BY_UNIT.get(facts.unitType) ?? NO_EFFECTS) {
    const line = effect(facts);
    if (line !== null) return line;
  }
  return null;
}

/** The runner of "strength: a land unit at sea" (armStr): whether any ability, in the stage's order, waives the sea's
 *  penalty for the unit (Sea Archers: the ranged units of a force with Elven Galleys). */
export function theSeasPenaltyIsWaivedForALandUnit(facts: ALandUnitAtSea): boolean {
  return A_LAND_UNIT_AT_SEA_EFFECTS.some((effect) => effect(facts));
}

/** The runner of "strength: a rider takes the flank on rough ground" (abilityFlanksRough, in battleGrid): whether any
 *  of the rider's abilities, in the stage's order, takes it there. */
export function aRiderTakesTheFlankOnRoughGround(facts: AUnitInTheLineOnItsGround): boolean {
  return (A_RIDER_TAKES_THE_FLANK_BY_UNIT.get(facts.theUnit.unitType) ?? NO_EFFECTS).some((effect) => effect(facts));
}

/** The runner of "strength: a flyer takes an open flank no rider fills" (battleGrid, on open ground): whether any of the
 *  flyer's abilities, in the stage's order, takes it there. */
export function aFlyerTakesAnOpenFlankNoRiderFills(facts: AUnitInTheLineOnItsGround): boolean {
  return (A_FLYER_TAKES_AN_OPEN_FLANK_BY_UNIT.get(facts.theUnit.unitType) ?? NO_EFFECTS).some((effect) =>
    effect(facts),
  );
}

/** The runner of "strength: its place in the line" (battleRegrid): the multiplier and words the first of the unit's
 *  abilities, in the stage's order, gives its place, or nothing (the line's own). */
export function theMultiplierOfAUnitsPlaceInTheLine(facts: AUnitInItsLine): AMultiplierAndItsWords | null {
  for (const effect of ITS_PLACE_IN_THE_LINE_BY_UNIT.get(facts.theUnit.unitType) ?? NO_EFFECTS) {
    const placed = effect(facts);
    if (placed !== null) return placed;
  }
  return null;
}

/** The runner of "volley: who shoots" (abilityMissileUnits): the units of a force that shoot though they are no ranged
 *  units, those of each ability in the stage's order, each in the force's order. */
export function theUnitsThatShootThoughNoRangedUnits<U extends AUnitOfAForce>(
  force: readonly U[],
  ground: string | null | undefined,
): U[] {
  const shooters: U[] = [];
  for (const { unit, effect } of WHO_SHOOTS_EFFECTS)
    for (const a of force) if (a.type === unit && effect({ unitType: a.type, ground })) shooters.push(a);
  return shooters;
}

/** The runner of "volley: who shoots first" (abilityMissileUnits' order): whether a shooter of the type given shoots
 *  before the others. */
export function theShooterShootsFirst(theShootersType: string): boolean {
  return (WHO_SHOOTS_FIRST_BY_UNIT.get(theShootersType) ?? NO_EFFECTS).some((effect) => effect({ theShootersType }));
}

/** The runner of "volley: the shooters see what hides": whether any ability, in the stage's order, lets the shooters
 *  see what hides. */
export function theShootersSeeWhatHides(theShootersForce: TheShootersForce['theShootersForce']): boolean {
  return THE_SHOOTERS_SEE_WHAT_HIDES_EFFECTS.some((effect) => effect({ theShootersForce }));
}

/** The runner of "volley: stops the volley" (archeryBlockedBy): whether any ability of the force shot at, in the
 *  stage's order, stops the volley. */
export function theVolleyIsStopped(facts: AVolleyAtAForce): boolean {
  return STOPS_THE_VOLLEY_EFFECTS.some((effect) => effect(facts));
}

/** The runner of "volley: may be shot at": why the first of the target's abilities, in the stage's order, keeps it from
 *  being shot at, or nothing. */
export function whyAUnitMayNotBeShotAt(facts: AUnitAVolleyIsShotAt): WhyAUnitMayNotBeShotAt | null {
  for (const effect of MAY_BE_SHOT_AT_BY_UNIT.get(facts.theTargetsType) ?? NO_EFFECTS) {
    const why = effect(facts);
    if (why !== null) return why;
  }
  return null;
}

/** The runner of "volley: how many volleys" (abilityVolleys): the volleys the first of the shooter's abilities, in the
 *  stage's order, gives it, or one. */
export function theVolleysAShooterLooses(facts: AShooterAndItsSide): number {
  for (const effect of HOW_MANY_VOLLEYS_BY_UNIT.get(facts.theShootersType) ?? NO_EFFECTS) {
    const volleys = effect(facts);
    if (volleys !== null) return volleys;
  }
  return 1;
}

/** The runner of "volley: a shot's damage" (missileDamageMult): the product of the shooter's factors, from ×1, in the
 *  stage's order. */
export function theFactorOnAShotsDamage(facts: AShotAtItsTarget): number {
  let m = 1;
  for (const effect of A_SHOTS_DAMAGE_BY_UNIT.get(facts.theShootersType) ?? NO_EFFECTS) m *= effect(facts);
  return m;
}

/** A shot's damage after the target's abilities, and whether one of them acted. */
export interface TheDamageOfAShotAfterItsTarget {
  readonly damage: number;
  readonly theTargetsAbilityActed: boolean;
}

/** The runner of "volley: what the target does to a shot" (applyMissileHit): from the damage so far, the target's
 *  effects in the stage's order. */
export function theDamageOfAShotAfterItsTarget(
  facts: TheTargetOfAShot,
  theDamageSoFar: number,
): TheDamageOfAShotAfterItsTarget {
  let damage = theDamageSoFar;
  let theTargetsAbilityActed = false;
  for (const effect of WHAT_THE_TARGET_DOES_TO_A_SHOT_BY_UNIT.get(facts.theTargetsType) ?? NO_EFFECTS) {
    const after = effect(facts, damage);
    if (after === null) continue;
    damage = after;
    theTargetsAbilityActed = true;
  }
  return { damage, theTargetsAbilityActed };
}

/** The runner of "volley: the softening limit" (missileCap): the share the first of the shooter's abilities, in the
 *  stage's order, gives, or nothing (the usual limit). */
export function theSofteningLimitOfAShooter(facts: AShooterAndWhetherItsTargetFlies): number | null {
  for (const effect of THE_SOFTENING_LIMIT_BY_UNIT.get(facts.theShootersType) ?? NO_EFFECTS) {
    const limit = effect(facts);
    if (limit !== null) return limit;
  }
  return null;
}
