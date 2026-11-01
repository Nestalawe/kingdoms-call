// The rule registry of content effects (plan P1-19, Decisions 2, 3 and 6). A content effect (today a unit ability) is
// one row in src/content/ (its unit, name and numbers: unit-abilities-their-names-numbers-and-words.ts) and one entry
// here, keyed by the same slug, naming its effect at each stage of a hook point. A hook point is one of the engine's
// real decisions (the thirteen below); its stages run in the battle code's order, and within a stage the effects run in the
// order its list gives (THE_ORDER_OF_EACH_STAGE): a product of decimals, and the ladder's words, depend on it. Each
// stage's effect type says exactly what the stage hands it, read-only, and an effect returns a value: it changes
// nothing. The resolvers ask the runners at the bottom; an effect reads only what its stage hands it and the content
// (src/engine/rules/ imports only itself, src/engine/rules-on-plain-values/ and src/content/: npm run lint:arch).
// The magic items' effects (plan P1-19's items family) have a registry of their own, the-registry-of-magic-item-
// effects.ts, on the same hook points and stages: their stages' types are here, in the one union.
//
// The hook points' types live here, in a file that holds code, not in a file of types alone: a file only `import type`
// reaches is in no page's bundle, and the build's checks refuse it (docs/traps.md).
import type { KC_MAGIC_SCHOOLS, Quality, UnitType } from '../../content/kingdoms-call-data.ts';
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
  A_FLYER_IS_HARRIED_BEFORE_THE_BATTLE,
  A_HULL_IS_SUNK_BEFORE_THE_BATTLE,
} from './unit-abilities/a-flyer-harried-and-a-hull-sunk-before-the-battle.ts';
import {
  A_FORCE_HOLDS_THE_SEA_LANES,
  THE_BEATEN_FORCE_HOLDS,
  THE_WINNER_RUNS_THE_BEATEN_DOWN,
} from './unit-abilities/the-rout-after-a-battle.ts';
import { A_PROVINCE_RAISES_A_UNIT } from './unit-abilities/a-province-raises-a-unit-at-the-turns-end.ts';
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
import type { TheEffectOfADiscovery } from '../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import type { AUnitAsTheDiscoveriesReadIt } from '../rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts';

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

/** What the stage "strength: the commander's items" hands an effect (armStr, after the unit's own modifiers and before
 *  its factors from its force): the unit he leads and his realm's alignment. Which effects his items carry, the items'
 *  runner reads from his active items, once a call (the-registry-of-magic-item-effects.ts). */
export interface AUnitLedByACommander {
  readonly unitType: string;
  /** The unit's own quality (not the tier Oratory lifts it to). */
  readonly quality: string | undefined;
  /** Whether the unit is skeletal (the mark a raising of the dead writes on it). */
  readonly isSkeletal: boolean;
  /** The alignment of the realm he leads it for, if any. */
  readonly theRealmsAlignment: string | null | undefined;
}

/** A step of the commander's items on a unit's strength: strength added, or a multiplier (with, for a step up a quality
 *  tier, the tier's own multiplier it is divided by), the result rounded. */
export type AStepOfTheCommandersItems =
  { readonly adds: number } | { readonly multipliesBy: number; readonly dividedBy?: number };

/** What the stage "strength: a land unit at sea, led" hands an effect (armStr, where the sea's penalty would cut a land
 *  unit a commander leads): the unit's type. */
export interface ALandUnitAtSeaLed {
  readonly unitType: string;
}

/** What the stage "strength: the defenders' fortifications" hands an effect (both battles, once the province's and the
 *  realm's own bonuses are counted): the side of the battle whose commander carries the item, and whether the defenders
 *  fight at their home (the province is the defender's founding home and he holds it; between heroes only: against
 *  neutral guards no defender's items are read). Which effects each commander's items carry, the items' runner reads
 *  from his active items, only when an effect would act for his side. */
export interface TheDefendersFortificationsAndACommandersSide {
  readonly hisSide: 'the attacker' | 'the defender';
  readonly theDefendersFightAtTheirHome: boolean;
}

/** Which line the battle writes for a commander's item at the defenders' fortifications (its words stay in the battle
 *  code until plan P1-12d moves them). */
export type TheFortificationsLine =
  | "the defender's banner rallies the home defence"
  | "the attacker's siege mastery halves the defenders' fortifications";

/** The defenders' fortifications after a commander's item: the new bonus, and the line the battle writes for it. */
export interface TheFortificationsAfterAnItem {
  readonly theBonus: number;
  readonly theLine: TheFortificationsLine;
}

/** Which line the battle writes for a commander's item at the volley before the battle (the volley's opening line
 *  records each: its words stay in the battle code). */
export type TheVolleysLine =
  'each missile unit looses two volleys instead of one' | 'each missile unit looses one more shot';

/** The volleys a commander's item adds to each missile unit he leads, and the line the battle writes for it. */
export interface TheVolleysAnItemAdds {
  readonly theVolleysAdded: number;
  readonly theLine: TheVolleysLine;
}

/** A held copy of a magic item, as a stage that reads the copy's own numbers hands it to an effect (plan P1-19's items
 *  family, Decision 2: the copy's number, not content's, so an old save's copy works as it did): its effect's `bonus`
 *  and `temper`, the share of a province it explores on a move (`exploreMove`, a field of its own) and what it adds to
 *  a strike's chance (`primalStrike`, a field of its own), each guarded. */
export interface AHeldCopysOwnNumbers {
  readonly effect?: { readonly bonus?: unknown; readonly temper?: string | null | undefined } | null | undefined;
  readonly exploreMove?: unknown;
  readonly primalStrike?: unknown;
}

/** The aura a hero's item spreads over his realm's heroes in his province: the levels it adds to every skill, and the
 *  name a hero's sources of a skill show it by. */
export interface TheAuraAnItemSpreads {
  readonly theLevelsItAddsToEverySkill: number;
  readonly itsName: string;
}

/** What a hero's item adds to his realm's tax at the turn's end: gold, or gold for each province the realm holds (the
 *  runner adds the gold of every item, and the most any one item gives for each province, once). */
export type WhatAnItemAddsToTheRealmsTax = { readonly gold: number } | { readonly goldForEachProvince: number };

/** What the stage "orderOutcome: a rest's heal" hands an effect (resolveRestOrder): the resting hero's maximum hit
 *  points (20 where he has none). */
export interface AHeroAtRest {
  readonly hisMaximumHp: number;
}

/** The power a held item works when it is used (a Use Item order; the bots' plan reads it to choose one): a spell
 *  charm's is to cast the spell its copy names (`effect.spell`), as a Cast Spell order (plan P1-19y). */
export type ThePowerAnItemWorksWhenUsed =
  'every unit of the realm rises a quality tier' | 'it casts the spell it holds';

/** What the stage "orderOutcome: a spell's cast cannot fail" hands an effect (resolveCastSpellOrder, before the cast
 *  chance: plan P1-19y): the spell's school, and whether the caster's sure cast is spent this turn (his mark). */
export interface ASpellAboutToBeCast {
  readonly theSpellsSchool: string;
  readonly hisSureCastIsSpentThisTurn: boolean;
}

/** What the stage "orderValidity: a spell that costs no casting slot" hands an effect (resolveCastSpellOrder's casting
 *  limit: plan P1-19y): whether the caster's realm has a Grand Cathedral (the Divine realm's Grand Design). */
export interface ACastAndTheCastersRealm {
  readonly theCastersRealmHasAGrandCathedral: boolean;
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
 *  at, and the ability as the ladder names it. */
export interface AMarkOnMyLine {
  readonly theUnitsMarked: readonly AUnitPlacedInALine[];
  readonly factor: number;
  readonly ability: AnAbilityAsTheLadderNamesIt;
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
 *  no line's end to guard). The effect returns its slug when they turn my flank even though foot anchor both ends of my
 *  front, or nothing. */
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

/** The fate by which a unit that failed its death roll lives (plan P1-12d27: a slug of a unit's fate in the battle,
 *  which the resolver tells with the unit's record and the views word). */
export type TheLineOfAUnitThatLivesThroughItsDeathRoll = 'is cut down and rises again by its regenerating hide';

/** What the stage "a beaten unit fails its demotion roll" hands an effect (rollUnitFates): a unit of the beaten side
 *  whose second roll fell below its chance of losing a tier (no Shield Fort holding it), its force, itself among them,
 *  with the holes the battle code leaves in a force, and the Knightly Example where the call gives it (o.knightly). */
export interface AUnitThatFailedItsDemotionRoll {
  readonly unitType: string;
  readonly itsForce: readonly (AUnitOfAForce | null | undefined)[];
  readonly theKnightlyExampleTheCallGives: boolean | null | undefined;
}

/** The fate by which a unit that failed its demotion roll holds its tier (plan P1-12d27: a slug of a unit's fate in the
 *  battle, which the resolver tells with the unit's record and the views word). */
export type TheLineOfAUnitThatHoldsThroughItsDemotionRoll = 'keeps its nerve under the knightly example';

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

/** What the stage "a flyer is harried before the battle" hands an effect (applyFlakScreen): a unit of the force, the
 *  enemy's flyers that no unit has harried this battle yet, in the force's order, the rule of a unit's base strength
 *  (unitBaseStrength, as the dice, handed: an effect imports only the registry's folder and the content), and the dice
 *  (an effect draws only when it acts and a flyer is left, as the battle code did). */
export interface AUnitAndTheEnemyFlyersNotYetHarried {
  readonly unitType: string;
  readonly theEnemyFlyersNotYetHarried: readonly AUnitOfAForce[];
  readonly theBaseStrengthOf: (flyer: AUnitOfAForce) => number;
  readonly theDice: () => number;
}

/** The flyer a unit harries before the battle: its place among the flyers not yet harried, and the strength it loses
 *  for the battle. */
export interface AFlyerHarried {
  readonly theFlyersPlace: number;
  readonly theStrengthItLoses: number;
}

/** What the stage "a hull is sunk before the battle" hands an effect (both battles: combatVsChar's
 *  applyBreachAndSwamp, and combatVsNPC): a unit of the force, the enemy's hulls still afloat (its units that move by
 *  sea and aren't sunk yet), in the force's order, and the dice (an effect draws only when it acts and a hull is
 *  afloat, as the battle code did). */
export interface AUnitAndTheEnemyHullsAfloat {
  readonly unitType: string;
  readonly theEnemyHullsAfloat: readonly AUnitOfAForce[];
  readonly theDice: () => number;
}

/** The battle a rout follows, as the force handed sees it: between two heroes' forces; a hero's force against a
 *  province's neutral guards, who never flee the province; or those neutral guards against the hero's force. */
export type TheBattleARoutFollows =
  'between heroes' | 'a hero against neutral guards' | 'neutral guards against a hero';

/** What the stage "the beaten force holds" hands an effect (shieldFortHolds): the force, with the holes the battle code
 *  leaves in a force, and the unit types of its front line as the battle grid placed it (its empty places left out; a
 *  place with no unit is none), or none when no grid was placed (an estimate). */
export interface ABeatenForceAndItsFrontLine {
  readonly theForce: readonly (AUnitOfAForce | null | undefined)[];
  readonly theFrontLine: readonly (string | undefined)[] | null;
}

/** What the stage "the winner runs the beaten down" hands an effect (pursuitsOfTheBeaten, for both battles' rout): the
 *  winning force, with the holes the battle code leaves in a force, the battle's ground, whether its commander carries
 *  the War-Horn of the Plains (an item: asked, as the dice are handed, only by an effect that needs it, as the battle
 *  code asked it, since reading a commander's items tidies them), and the battle. */
export interface AWinningForceOnItsGround {
  readonly theWinningForce: readonly (AUnitOfAForce | null | undefined)[];
  readonly ground: string | null | undefined;
  readonly itsCommanderCarriesTheWarHornOfThePlains: () => boolean;
  readonly theBattle: TheBattleARoutFollows;
}

/** Which line the battle writes for a pursuit (its kinds and words stay in the battle code until plan P1-12d moves
 *  them): the line as it bites, or the line by which a Shield Fort leaves it nothing to bite on. */
export type ThePursuitsLine =
  | 'the free lances ride the beaten down'
  | 'the warg riders run the beaten down'
  | "the warg riders halve the winner's losses"
  | 'the manticore pride hunts the beaten'
  | 'the shark shoals tear into the beaten crews';

/** How the ground lets a pursuit run: it does; only by the commander's War-Horn of the Plains (on ground it finds no room
 *  on by itself); or it finds no room, and adds nothing (the battle writes a line before the fighting for the last two). */
export type HowTheGroundLetsAPursuitRun = 'it runs' | 'by the war-horn of the plains' | 'it finds no room';

/** A pursuit of the beaten by a winning force's ability: its line, the fraction it adds to each beaten unit's death
 *  roll, the factor on each of the winner's own death rolls (1, but Run Them Down's half against neutral guards), and
 *  how the ground lets it run. */
export interface APursuitOfTheBeaten {
  readonly line: ThePursuitsLine;
  readonly theFractionAddedToEachBeatenUnitsDeathRoll: number;
  readonly theFactorOnTheWinnersOwnDeathRolls: number;
  readonly onTheGround: HowTheGroundLetsAPursuitRun;
}

/** What the stage "a force holds the sea lanes" hands an effect (both battles' retreat): the force, with the holes the
 *  battle code leaves in a force, and the battle. Between heroes, a winner holding them closes the sea to the beaten;
 *  against neutral guards, an attacker holding them keeps its way back to the ships when beaten. */
export interface AForceInItsBattle {
  readonly theForce: readonly (AUnitOfAForce | null | undefined)[];
  readonly theBattle: TheBattleARoutFollows;
}

/** What the stage "a province raises a unit" hands an effect (Early Winter, for each province with a realm, after the
 *  wages and before the garrison drill): the province's race, the race of the realm that holds it (none if no realm
 *  does), and whether an orc realm won a battle there this turn (the mark both battles leave on an orcish province). */
export interface AProvinceAtTheTurnsEnd {
  readonly theProvincesRace: string | null | undefined;
  readonly theRaceOfTheRealmThatHoldsIt: string | null | undefined;
  readonly anOrcRealmWonABattleThereThisTurn: boolean;
}

/** A unit a province raises into its garrison at the turn's end, for nothing: its type, quality and race. Early Winter
 *  names it, adds it and writes the line. */
export interface AUnitAProvinceRaises {
  readonly type: UnitType;
  readonly quality: Quality;
  readonly race: string;
}

/** The keys of the words in the ladder the content's rows give (wordsInTheLadder), of every row that gives some. */
type TheKeysOfTheWordsInTheLadder = {
  [Slug in UnitAbilitySlug]: (typeof UNIT_ABILITIES_THE_REGISTRY_HOLDS)[Slug] extends {
    readonly wordsInTheLadder: infer Words;
  }
    ? keyof Words
    : never;
}[UnitAbilitySlug];

/** An ability as the strength ladder names it (plan P1-12d4, P1-12's Choice 2: an effect names its slug, never words):
 *  its slug, and where its words in the ladder are not its name, the key of its row's wordsInTheLadder or the factor its
 *  words show. The prose writes the words, from the content's row. */
export interface AnAbilityAsTheLadderNamesIt {
  readonly slug: UnitAbilitySlug;
  readonly wordsInTheLadder?: TheKeysOfTheWordsInTheLadder;
  readonly factor?: number;
}

/** A multiplier, and the ability that set it, as the strength ladder names it. */
export interface AMultiplierAndTheAbilityThatSetIt {
  readonly multiplier: number;
  readonly ability: AnAbilityAsTheLadderNamesIt;
}

/** The effect of a stage that takes the multiplier so far and may set or change it: the new multiplier and the ability,
 *  or nothing (the ability doesn't act here). */
type AnEffectOnTheMultiplierSoFar<Facts> = (
  facts: Facts,
  theMultiplierSoFar: number,
) => AMultiplierAndTheAbilityThatSetIt | null;

/** A ward as the merge reads it (pcArmourMerge): an armour's effect, a rider's (an item's `effect.pc`), a guardian's
 *  perk's (`fx`), or a guardian's grade's cap. Every field optional: the saved item's schema allows any of them out.
 *  (Plan P1-10b11 wrote it in src/engine/personal-combat/helpers.ts; plan P1-19q moved it here, the stage's type.) */
export interface AWardAsTheMergeReadsIt {
  readonly ward?: string | undefined;
  readonly amt?: number | undefined;
  readonly pct?: number | undefined;
  readonly hits?: number | undefined;
  readonly school?: string | undefined;
}

/** The riders a fighter wears beside his wards (pcApplyFx writes them on him, the hit bonus on his status). */
export interface TheRidersAFighterWears {
  readonly aura?: number | undefined;
  readonly burn?: number | undefined;
  readonly drain?: number | undefined;
  readonly hitBonus?: number | undefined;
  readonly dmgBonus?: number | undefined;
}

/** The riders (pcApplyFx's `fx`): an item's `effect.pc` and a guardian's perk's `fx`, one type for both. A ward among
 *  them merges into the fighter's wards; the others are the riders he wears. */
export interface TheRidersOfAnItemOrAPerk extends AWardAsTheMergeReadsIt, TheRidersAFighterWears {}

/** The wards a fighter wears (his `arm`): every worn armour's ward and every ward rider merged into one table by
 *  pcArmourMerge (flat reductions add, percentages take the best, flags are set once), with the names of what gave
 *  them. A fighter who wears none has `null` (a hero) or no table (a guardian). (Plan P1-10b11 wrote it in
 *  src/engine/personal-combat/helpers.ts; plan P1-19q moved it here, the stage's type.) */
export interface TheWardsAFighterWears {
  names: string[];
  meleeDR?: number | undefined;
  arrowDR?: number | undefined;
  natureDR?: number | undefined;
  darkDR?: number | undefined;
  thorns?: number | undefined;
  regen?: number | undefined;
  spellPct?: number | undefined;
  dodge?: number | undefined;
  block?: number | undefined;
  cap?: number | undefined;
  secondWind?: number | undefined;
  lowHp?: number | undefined;
  firstHit?: boolean | undefined;
  dotImmune?: boolean | undefined;
  resist?: boolean | undefined;
  arrowBlock?: number | undefined;
  openGuardHits?: number | undefined;
  openGuardPct?: number | undefined;
  spellBlock?: number | undefined;
  roundWard?: number | undefined;
  stunImmune?: boolean | undefined;
  stunWard?: number | undefined;
  dotWard?: number | undefined;
  /** A guardian perk's ward against one school of magic: the school, and what it takes off that school's cast chance. */
  schoolWard?: Partial<Record<string, number>> | undefined;
}

/** What a ward a fighter puts on sets in the wards he wears: each field it changes, with its new value. */
export type WhatAWardSets = Partial<Omit<TheWardsAFighterWears, 'names'>>;

/** The wards a fighter wears as their effects in the fight read them (plan P1-19r): the table, without the names of
 *  what gave them (the lines' alone). */
export type TheWardsAsTheirEffectsReadThem = Readonly<Omit<TheWardsAFighterWears, 'names'>>;

/** The channel of a harm as a fighter's wards meet it: a melee blow, an arrow, or anything else (a spell, a guardian's
 *  special), which pcTakeHit calls 'spell'. */
export type TheChannelOfAHarm = string;

/** What the stage "a hit lands on a fighter: before all else" hands an effect (pcTakeHit, after a mirror image): the
 *  wards he wears (none: null), the harm's channel, the damage so far (each effect before it in the stage's order has
 *  taken its share), whether his first-hit ward has drunk a hit this fight, what is left of this round's ward, and
 *  whether he fights in Mithril with what his suit turns aside (pcCharCombatant's `mithrilDR`). */
export interface AHitAsAFightersWardsMeetItFirst {
  readonly theWards: TheWardsAsTheirEffectsReadThem | null;
  readonly theChannel: TheChannelOfAHarm;
  readonly theDamageSoFar: number;
  readonly theFirstHitHasBeenDrunk: boolean | undefined;
  readonly theRoundWardLeft: number | undefined;
  readonly heFightsInMithril: boolean | undefined;
  readonly theDamageHisMithrilTurnsAside: number | undefined;
}

/** What a ward does to a hit before all else: drinks the first hit of the fight whole; may turn it aside whole (a
 *  shield's chance, which pcTakeHit rolls where it rolled: against a blow or an arrow, an arrow, or a spell); soaks some
 *  of it with this round's ward; or turns aside some of a blow or an arrow (the Mithril suit). Each gives the damage
 *  after it, where it changes it. */
export type WhatAWardDoesToAHitFirst =
  | { readonly does: 'drinks the first hit of the fight' }
  | {
      readonly does: 'may turn it aside whole';
      readonly against: 'a blow or an arrow' | 'an arrow' | 'a spell';
      readonly theChance: number;
    }
  | { readonly does: "soaks some with this round's ward"; readonly theSoak: number; readonly theDamageAfter: number }
  | { readonly does: 'turns aside some of a blow or an arrow'; readonly theDamageAfter: number };

/** What the stage "a hit lands on a fighter: his wards cut it" hands an effect (pcTakeHit, after his own nature, his
 *  temper and his perks, when he wears wards and the hit still deals damage): the wards he wears, the harm's channel,
 *  the striker's kind (beast, undead, …, or none), his hit points and his maximum as the fight reads it, the hits his
 *  open guard has taken so far, and the damage so far (each effect before it in the stage's order has cut it). */
export interface AHitAsAFightersWardsCutIt {
  readonly theWards: TheWardsAsTheirEffectsReadThem;
  readonly theChannel: TheChannelOfAHarm;
  readonly theStrikersKind: string | null;
  readonly hisHp: number;
  readonly hisMaximumHp: number;
  readonly theHitsHisOpenGuardHasTaken: number;
  readonly theDamageSoFar: number;
}

/** What a ward's cut leaves of a hit, and whether his open guard takes it (one hit more counted). */
export interface WhatAWardCutsOffAHit {
  readonly theDamageAfter: number;
  readonly hisOpenGuardTakesIt?: true;
}

/** What the wards he wears leave of a hit, whether his open guard took it, and the ward the line names (the one of the
 *  harm's channel: a guardian's perk is named for it). */
export interface WhatAFightersWardsLeaveOfAHit {
  readonly theDamageAfter: number;
  readonly hisOpenGuardTookIt: boolean;
  readonly theWardTheLineNames: string;
}

/** What the stage "a hit lands on a fighter: his wards cap it" hands an effect (pcTakeHit, after the damage floor):
 *  the wards he wears (none: null), his maximum hit points as the fight reads it, and the damage so far. */
export interface AHitAsAFightersWardsCapIt {
  readonly theWards: TheWardsAsTheirEffectsReadThem | null;
  readonly hisMaximumHp: number;
  readonly theDamageSoFar: number;
}

/** A ward's ceiling on a hit that would bite deeper: the damage it lets through, and the ward the line names. */
export interface AWardsCapOnAHit {
  readonly theDamageAfter: number;
  readonly theWardTheLineNames: string;
}

/** What the stage "a hit lands on a fighter: after it" hands an effect (pcTakeHit, once the hit is dealt): the wards he
 *  wears (none: null), whether his second wind has been used this fight, and his hit points and maximum as the fight
 *  reads them. */
export interface AFighterAsHisWardsMeetHimAfterAHit {
  readonly theWards: TheWardsAsTheirEffectsReadThem | null;
  readonly hisSecondWindHasBeenUsed: boolean | undefined;
  readonly hisHp: number;
  readonly hisMaximumHp: number;
}

/** The hit points a ward gives back after a hit (once a fight), and the ward the line names. */
export interface TheHpAWardGivesBack {
  readonly theHp: number;
  readonly theWardTheLineNames: string;
}

/** What the wards he wears do as a round starts (pcRoundStart): a fresh ward for the round, every lingering harm
 *  sloughed off, the hit points he regenerates (before a guardian's fading sustain) with the ward the line names, and
 *  whether he holds steady (a to-hit penalty fades twice, and a daze is shrugged off on a draw under the chance, which
 *  pcRoundStart draws where it drew). Each effect sets its own field. */
export interface WhatAFightersWardsDoAsARoundStarts {
  readonly theFreshWardThisRound?: number;
  readonly everyLingeringHarmSloughsOff?: true;
  readonly heRegenerates?: TheHpAWardGivesBack;
  readonly heHoldsSteady?: { readonly theChanceToShrugOffADaze: number };
}

/** The thorns a fighter's wards bite back with at whoever lands a melee blow on him, and the ward the line names. */
export interface TheHarmAWardBitesBackWith {
  readonly theHarm: number;
  readonly theWardTheLineNames: string;
}

/** What the stage "personalCombat: the fight opens: a fighter's aura hinders his foe" hands an effect: the riders he
 *  wears, and the aura's penalty his foe carries so far (plan P1-19ak). */
export interface AFightersAuraAsTheFightOpens {
  readonly theRiders: TheRidersAFighterWears;
  readonly theFoesAuraPenaltySoFar: number | undefined;
}

/** A striker's marks as his chance to hit reads them (his status): the aura's penalty his foe laid on him, and his
 *  bonus to hit (his riders', and a combat item's: plan P1-19ak). */
export interface AStrikersMarksAsHisChanceToHitReadsThem {
  readonly auraPenalty?: number | undefined;
  readonly hitBonus?: number | undefined;
}

/** The harm a fighter's burn sears his foe with each melee round, and the rider the line names (plan P1-19ak). */
export interface TheHarmAFightersBurnSearsWith {
  readonly theHarm: number;
  readonly theRiderTheLineNames: string;
}

/** What the stage "personalCombat: a blow lands: his drain" hands an effect (pcMeleeStrike, once his blow deals
 *  damage): his riders, the damage dealt, his hit points, and the fade of a guardian's sustain, asked only when he
 *  drinks (plan P1-19ak). */
export interface ABlowAsTheStrikersDrainMeetsIt {
  readonly theRiders: TheRidersAFighterWears;
  readonly theDamageDealt: number;
  readonly hisHp: number;
  readonly hisMaxHp: number;
  readonly theSustainsFade: () => number;
}

/** What a striker's drain drinks of the wound he dealt: the hit points, the sustain's fade it was drunk at, and the
 *  rider the line names (plan P1-19ak). */
export interface WhatAStrikersDrainDrinks {
  readonly theHpDrunk: number;
  readonly theFade: number;
  readonly theRiderTheLineNames: string;
}

/** What the stage "personalCombat: a combat item adds to his bonus to hit" hands an effect (pcUseCombatItem's
 *  focus): his bonus so far, and the item's (plan P1-19ak). */
export interface ABonusToHitACombatItemAdds {
  readonly theBonusSoFar: number | undefined;
  readonly theBonusAdded: number;
}

/** A combat item's own numbers, as its effects read them (its saved `effect`, plan P1-19s): each guarded, as a copy may
 *  lack any (where it carries none, or 0, an effect takes its row's). */
export interface ACombatItemsOwnNumbers {
  readonly below?: number | undefined;
  readonly amt?: number | undefined;
  readonly rounds?: number | undefined;
  readonly dmg?: readonly number[] | null | undefined;
  readonly times?: number | undefined;
  readonly doubleVs?: readonly string[] | undefined;
  readonly dot?: readonly number[] | undefined;
  readonly hitPen?: number | undefined;
  readonly stun?: number | undefined;
  readonly melee?: number | undefined;
  readonly archery?: number | undefined;
  readonly hitBonus?: number | undefined;
  readonly absorb?: number | undefined;
  readonly reflect?: number | undefined;
  readonly images?: number | undefined;
  readonly fleeBonus?: number | undefined;
  readonly toHitReduce?: number | undefined;
  readonly vs?: readonly string[] | undefined;
}

/** A combat item as the stage "a combat item is used" hands it to its effect: its words (an item that says "for the
 *  rest of the fight" blinds for good) and its own numbers. */
export interface ACombatItemAsItsUseReadsIt {
  readonly desc?: string | undefined;
  readonly effect: ACombatItemsOwnNumbers;
}

/** A fighter's status as he weighs a combat item: what lingers on him, his penalty to hit, and the ward, warmth,
 *  unseeing and images he holds (each guarded). */
export interface AFightersStatusAsHeWeighsACombatItem {
  readonly hot?: { readonly rounds: number } | undefined;
  readonly dot?: readonly unknown[] | undefined;
  readonly hitPenalty?: unknown;
  readonly absorb?: number | undefined;
  readonly toHitReduce?: number | undefined;
  readonly mirrorImages?: number | undefined;
}

/** What the stage "a fighter reaches for a combat item" hands an effect (pcCombatItemWanted): the share of his maximum
 *  hit points left (his maximum, or 20), his hit points and that maximum, his status, whether he never flees, and,
 *  asked only when an effect needs it, the foe's kind and whether the foe has a power or a school of magic. */
export interface AMomentAsAFighterWeighsACombatItem {
  readonly theShareOfHisHpLeft: number;
  readonly hisHp: number;
  readonly hisMaximumHp: number;
  readonly hisStatus: AFightersStatusAsHeWeighsACombatItem;
  readonly heNeverFlees: boolean | undefined;
  readonly theFoesKind: () => string;
  readonly theFoeHasPowers: () => boolean;
}

/** What a combat item does when used (pcUseCombatItem applies it, draws its dice where it drew them and tells its
 *  lines): each with the numbers its effect read, the copy's or, where it carries none, its row's. */
export type WhatACombatItemDoes =
  | { readonly does: 'restores his hit points'; readonly theHp: number }
  | { readonly does: 'restores his hit points and lifts every lingering harm'; readonly theHp: number }
  | { readonly does: 'warms him each round'; readonly theHp: number; readonly theRounds: number }
  | {
      readonly does: 'strikes the foe';
      readonly theTimes: number;
      readonly theDamageRange: readonly number[] | null | undefined;
      readonly theLingeringHarm: readonly number[] | undefined;
      readonly thePenaltyFromTheNextRound: number | undefined;
      readonly theDazeFromTheNextRound: number | undefined;
    }
  | { readonly does: 'drains the foe'; readonly theDamageRange: readonly number[] | null | undefined }
  | { readonly does: 'holds the foe'; readonly theRounds: number }
  | { readonly does: 'blinds the foe'; readonly thePenalty: number; readonly forTheRestOfTheFight: boolean }
  | { readonly does: 'saps the foe'; readonly theMelee: number | undefined; readonly theArchery: number | undefined }
  | {
      readonly does: 'may send the foe fleeing';
      readonly theChanceTheFoeFlees: number;
      readonly thePenaltyIfHeHolds: number;
    }
  | { readonly does: "binds the foe's powers"; readonly theRounds: number }
  | {
      readonly does: 'strengthens him';
      readonly theMelee: number | undefined;
      readonly theArchery: number | undefined;
    }
  | { readonly does: 'sharpens his eye'; readonly theBonus: number }
  | { readonly does: 'wards him'; readonly theWard: number; readonly theReflect: number | undefined }
  | { readonly does: 'sends his images out'; readonly theImages: number }
  | {
      readonly does: 'readies him to break away';
      readonly theFleeBonus: number;
      readonly theUnseen: number | undefined;
    }
  | { readonly does: 'hides him'; readonly theUnseen: number }
  | { readonly does: 'lifts every lingering harm' };

/** What an item of a lair's hoard does for the guardian who wields it (pcBuildGuardian), beside its skill, its combat
 *  use, its armour and its riders: the hit points it adds to his maximum, if he is at full health, and whether it drives
 *  his melee blows home (his flag, which "a blow's damage" reads). Each effect sets its own field. */
export interface WhatAHoardsItemDoesForItsGuardian {
  readonly theHpItAddsAtFullHealth?: number;
  readonly itDrivesHisBlowsHome?: true;
}

/** What an item is for (plan P1-19t): a combat item helps a hero in a fight, and never sits in a Weak lair; a utility
 *  item helps him lead, spy, steal, explore or run the purse. */
export type TheRoleOfAnItem = 'combat' | 'utility';

/** An item's effect as the treasury weighs it (itemPowerScore, _useScore): its stat, and each number its worth reads,
 *  each optional (a copy may lack any; the saved item's schema allows a 0 in any). */
export interface AnEffectAsTheTreasuryWeighsIt {
  readonly stat?: string | null | undefined;
  readonly bonus?: number | undefined;
  readonly spell?: string | undefined;
  readonly use?: string | undefined;
  readonly amt?: number | undefined;
  readonly rounds?: number | undefined;
  readonly dmg?: readonly number[] | undefined;
  readonly times?: number | undefined;
  readonly dot?: readonly number[] | undefined;
  readonly stun?: number | undefined;
  readonly hitPen?: number | undefined;
  readonly melee?: number | undefined;
  readonly archery?: number | undefined;
  readonly hitBonus?: number | undefined;
  readonly absorb?: number | undefined;
  readonly reflect?: number | undefined;
  readonly images?: number | undefined;
  readonly fleeBonus?: number | undefined;
  readonly toHitReduce?: number | undefined;
}

/** A ward as the treasury weighs it (_wardScore): an armour's effect, or a rider's; its amount or its percentage. */
export interface AWardAsTheTreasuryWeighsIt {
  readonly ward?: string | null | undefined;
  readonly amt?: number | undefined;
  readonly pct?: number | undefined;
}

/** An item's riders as the treasury weighs them (_pcScore): each rider's amount. */
export interface TheRidersAsTheTreasuryWeighsThem {
  readonly hitBonus?: number | undefined;
  readonly dmgBonus?: number | undefined;
  readonly burn?: number | undefined;
  readonly drain?: number | undefined;
  readonly aura?: number | undefined;
}

/** The worth of an item's parts, as its kind's worth asks them (each asked only when the kind needs it): its combat
 *  use's, and its ward's, each with the treasury's worth of one the registry holds no effect for. */
export interface TheWorthOfAnItemsParts {
  readonly ofItsCombatUse: () => number;
  readonly ofItsWard: () => number;
}

// ── Battle magic (plan P1-19's spells family, row P1-19u): a battle spell cast before an army battle, and whether it
// has something to strike. The spells' registry (the-registry-of-spell-effects.ts) holds the effects. ──

/** Which of the battle code's three copies of battle magic casts the spell: a hero's between two heroes' hosts
 *  (applyPreBattleMagic), a hero's against a province's neutral guards, or the guards' commander's against him (both in
 *  combatVsNPC). Each copy keeps its own rule and writes its own lines (Parked "Battle magic's three copies disagree on
 *  two rules"). */
export type ACopyOfBattleMagic = 'between heroes' | 'a hero against the guards' | "the guards' commander";

/** An enemy unit as a battle spell reads it. */
export interface AnEnemyUnitAsABattleSpellReadsIt {
  /** Its type ('' for none). */
  readonly type: string;
  /** Its race, if it has one. */
  readonly race?: string | null | undefined;
  /** Whether it is risen dead (skeletal). */
  readonly isSkeletal: boolean;
  /** Its base strength (unitBaseStrength: its type's strength by its quality's multiplier). */
  readonly baseStrength: number;
  /** Whether it is a missile unit, by the copy's set. */
  readonly isAMissileUnit: boolean;
}

/** The enemy commander as a battle spell reads him. */
export interface AnEnemyCommanderAsABattleSpellReadsHim {
  /** His Tactical (effStat). */
  readonly tactical: number;
  /** The best of his combat-affecting skills, which a Curse withers (bestCurseSkill). */
  readonly theSkillACurseWithers: string;
}

/** What the stage "strength: a battle spell is cast before the battle" hands an effect (once the spell's roll is made). */
export interface ABattleSpellCastBeforeTheBattle {
  readonly theCopy: ACopyOfBattleMagic;
  /** The caster's level in the spell's school (effStat). */
  readonly theCastersLevel: number;
  /** The enemy's units, in the order the battle holds them. */
  readonly theEnemysUnits: readonly AnEnemyUnitAsABattleSpellReadsIt[];
  /** The enemy commander, or none. */
  readonly theEnemyCommander: AnEnemyCommanderAsABattleSpellReadsHim | null;
  /** Whether the battle is fought at sea. */
  readonly atSea: boolean;
  /** How many of the strongest enemy units the caster's items let his Fireball strike, or nothing (the items'
   *  registry's runner of "strength: a hero's items change his battle spell"). */
  readonly theStrongestUnitsTheCastersItemsLetAFireballStrike: number | null;
}

/** An enemy unit a battle spell strikes, by its place in the list handed, and the strength it loses. */
export interface AnEnemyUnitStruck {
  readonly theUnit: number;
  readonly theStrengthItLoses: number;
}

/** The line a copy writes for what a battle spell does: each copy's own kinds, as the battle code wrote them. */
export type TheLineOfABattleSpell =
  | "a fireball halves the enemy's strongest units"
  | "a fireball engulfs the defenders' strongest units"
  | "a fireball halves the attackers' strongest unit"
  | 'a lightning bolt weakens enemy units'
  | 'a lightning bolt sears the defending units'
  | 'a lightning bolt sears the attacking units'
  | "a telekinetic storm scatters the enemy commander's formations"
  | 'a telekinetic storm finds no tactical command to disrupt'
  | 'a telekinetic storm finds no command among leaderless defenders'
  | "a psychic blast severs the enemy commander's bond with his beasts"
  | 'a psychic blast finds no commander among the defenders'
  | "a curse withers the enemy commander's skill"
  | 'a curse finds no commander among leaderless defenders'
  | "control undead turns an enemy undead unit to the caster's side"
  | "control undead turns a defending undead unit to the attacker's side"
  | 'control undead finds no enemy undead to turn'
  | 'control undead finds no undead among the defenders'
  | 'control undead finds no undead among the attackers'
  | 'a holy symbol weakens enemy undead units'
  | 'a holy symbol sears the defending undead'
  | 'a holy symbol sears the attacking undead'
  | 'a holy symbol finds no enemy undead to smite'
  | 'a holy symbol finds no undead among the defenders'
  | 'a holy symbol finds no undead among the attackers'
  | 'spiritwrack halves enemy missile units'
  | "spiritwrack halves the defenders' missile units"
  | "spiritwrack halves the attackers' missile units"
  | 'spiritwrack finds no enemy missile troops'
  | 'spiritwrack finds no missile troops among the defenders'
  | 'spiritwrack finds no missile troops among the attackers';

/** What a battle spell does, and the line its copy writes (the resolver draws what it draws, applies the rest and
 *  writes the line, with the facts its kind records): the strongest units, or the undead, or the missile units, each
 *  lose the strength given; units drawn at random (howMany of them, the resolver's draw) each lose the strength given
 *  for its place; the enemy commander's Tactical is cut to the multiplier (or only marked, with none to cut), his Druid
 *  negated, or his skill withered; an undead unit drawn at random among those given defects; or nothing to strike (with
 *  a line, or none). */
export type WhatABattleSpellDoes =
  | {
      readonly kind:
        'the strongest units lose strength' | 'the undead lose strength' | 'the missile units lose strength';
      readonly theUnitsStruck: readonly AnEnemyUnitStruck[];
      readonly theLine: TheLineOfABattleSpell;
    }
  | {
      readonly kind: 'units drawn at random lose strength';
      readonly howMany: number;
      readonly theStrengthEachWouldLose: readonly number[];
      readonly theLine: TheLineOfABattleSpell;
    }
  | {
      readonly kind: "the enemy commander's Tactical is cut";
      readonly theMultiplier: number;
      readonly theLine: TheLineOfABattleSpell;
    }
  | {
      readonly kind:
        "the enemy commander's Tactical is marked, with none to cut" | "the enemy commander's Druid is negated";
      readonly theLine: TheLineOfABattleSpell;
    }
  | {
      readonly kind: "the enemy commander's skill is withered";
      readonly theSkill: string;
      readonly theLine: TheLineOfABattleSpell;
    }
  | {
      readonly kind: 'an undead unit drawn at random defects';
      readonly theUndead: readonly number[];
      readonly theLine: TheLineOfABattleSpell;
    }
  | { readonly kind: 'nothing to strike'; readonly theLine: TheLineOfABattleSpell | null };

/** An enemy unit as the battle spell's choice reads it. */
export interface AnEnemyUnitAsTheSpellChoiceReadsIt {
  /** Its type ('' for none). */
  readonly type: string;
  /** Whether it is risen dead (skeletal). */
  readonly isSkeletal: boolean;
  /** Whether it is a missile unit (MISSILE_ARMIES_MASTER). */
  readonly isAMissileUnit: boolean;
}

/** The enemy commander as the battle spell's choice reads him: whether a spell has halved his Tactical or negated his
 *  Druid this battle already, and his Tactical, Druid and Naval (effStat). */
export interface AnEnemyCommanderAsTheSpellChoiceReadsHim {
  readonly hisTacticalIsHalved: boolean;
  readonly hisDruidIsNegated: boolean;
  readonly tactical: number;
  readonly druid: number;
  readonly naval: number;
}

/** What the stage "strength: a battle spell has something to strike" hands an effect (battleSpellUseful). */
export interface AFieldABattleSpellMayBeCastOn {
  readonly theEnemyCommander: AnEnemyCommanderAsTheSpellChoiceReadsHim | null;
  readonly theEnemysUnits: readonly AnEnemyUnitAsTheSpellChoiceReadsIt[];
}

/** What a hero's item changes in his battle spell: how many of the strongest enemy units his Fireball strikes. */
export interface TheChangeAnItemMakesToABattleSpell {
  readonly theStrongestUnitsAFireballStrikes: number;
}

// ── The pre-battle strikes (plan P1-19's spells family, row P1-19v): a unit's strike before an army battle, after battle
// magic. The strikes are each unit's, in the content's tables (P1-19l's Choice 2); one effect casts them all. ──

/** Which of the battle code's three copies of the pre-battle strikes asks: a hero's units' between two heroes' hosts
 *  (combatVsChar's applyArmyBattleSpells, each side), a hero's units' against a province's neutral guards, or the
 *  guards' own units' against him (both in combatVsNPC). Each copy keeps its own roll and writes its own lines. */
export type ACopyOfThePreBattleStrikes =
  'between heroes' | "a hero's units against the guards" | "the guards' units against a hero";

/** What the stage "strength: a unit strikes before the battle" hands an effect (before any of the strike's draws). */
export interface AUnitAboutToStrikeBeforeTheBattle {
  readonly theCopy: ACopyOfThePreBattleStrikes;
  /** Its type: its strikes are its type's, in the content's tables. */
  readonly theUnitsType: string | null | undefined;
  /** Whether the other side has a unit to strike. */
  readonly theEnemyHasAUnit: boolean;
  /** Its commander's Druid, as the copy counts it (0 for none). */
  readonly theDruidLevel: number;
  /** What its commander's items add to the chance (the items' registry's runner of "strength: a commander's items add
   *  to a strike's chance"), asked only when the chance counts them: reading a commander's items tidies them. */
  readonly whatTheCommandersItemsAdd: () => number;
}

/** The line a copy writes for a strike: each copy's own kinds, as the battle code wrote them. */
export type TheLineOfAPreBattleStrike =
  | "a unit's power gathers but never strikes"
  | 'a unit uses its power in battle'
  | 'a defending unit uses its power in battle'
  | "a unit's power hits all enemy units"
  | "a unit's power hits every defending unit"
  | "a unit's power hits every attacking unit"
  | "a unit's power hits one enemy unit"
  | "a unit's power hits one unit of the other side";

/** A strike a unit may make, as the resolver draws it: its name and flavour (the table's), and its blow: every enemy
 *  unit, or one the resolver draws, loses the damage the resolver draws in the table's range, and the line its copy
 *  writes for it. */
export interface APreBattleStrike {
  readonly name: string;
  readonly flavour: string | undefined;
  readonly theBlow: {
    readonly reaches: 'every enemy unit' | 'one enemy unit drawn at random';
    /** The table's range, as the battle reads it: its least and its most. */
    readonly theDamage: readonly number[];
    readonly theLine: TheLineOfAPreBattleStrike;
  };
}

/** What a unit's strike may do before the battle: the strikes the resolver draws one of, the chance its roll must make,
 *  and the lines its copy writes when it strikes, and when it misses (none: a winged rider's strike misses quietly). */
export interface WhatAUnitsStrikeMayDo {
  readonly theStrikes: readonly APreBattleStrike[];
  readonly theChance: number;
  readonly theLineIfItStrikes: TheLineOfAPreBattleStrike;
  readonly theLineIfItMisses: TheLineOfAPreBattleStrike | null;
}

// ── A combat spell in a personal combat (plan P1-19's spells family, rows P1-19w and P1-19x): what a spell does once its
// cast takes hold (pcCastCombatSpell, after the cast roll and the weakness's lines). The effect returns its steps; the
// resolver draws where the code drew, applies each step with the functions it called (pcTakeHit, pcPushDot,
// pcLandStun), in the steps' order, and writes each step's line. ──

/** A school of magic. */
export type AMagicSchool = (typeof KC_MAGIC_SCHOOLS)[number];

/** What a Charm reads of its target (a guardian or an illusion is none of these). */
export interface ATargetAsACharmReadsHim {
  /** Whether he is a hero and a king. */
  readonly isACrownedHero: boolean;
  /** Whether he is a hero charmed this turn already. */
  readonly wasSwayedThisTurn: boolean;
  /** A hero's will against a Charm (each past charm's), or 0 for none. */
  readonly hisWill: number;
}

/** The target as a combat spell reads him. */
export interface ATargetAsACombatSpellReadsHim {
  readonly maxHp: number;
  /** Whether he is undead or a fiend (Holy Symbol bites them harder). */
  readonly isUndeadOrAFiend: boolean;
  /** His grade, if he is a guardian (none for a hero or an illusion). */
  readonly theGuardiansGrade: string | null;
  /** The percentage his wards cut a spell's burn by (the items' registry: a burn ticks outside pcTakeHit). */
  readonly theShareHisWardsCutABurnBy: number;
  // From P1-19x:
  /** His HP now (a Mirror Image's phantom carries a share of it). */
  readonly hp: number;
  /** Whether he is undead (Control Undead grips the undead alone). */
  readonly isUndead: boolean;
  /** His Melee, his Archery and his level in each school, as Curse weighs his best. */
  readonly melee: number;
  readonly archery: number;
  readonly hisSchools: Readonly<Record<AMagicSchool, number>>;
  /** His plan, as it is guarded (a Mirror Image's phantom fights by it). */
  readonly hisPlan: readonly string[] | null | undefined;
  readonly asACharmReadsHim: ATargetAsACharmReadsHim;
}

/** What a hero's items change in his combat spells (the items' registry's runner of "personalCombat: a hero's items
 *  change his combat spell"): none of his items, 0 rounds and ×1. */
export interface TheChangesAHerosItemsMakeToHisCombatSpells {
  readonly theRoundsHisPsychicBlastStunsLonger: number;
  readonly theMultiplierOfHisHandOfDeathsBite: number;
  /** The Mirror Shard's (plan P1-19x): the chance his Mirror Image is seen through is multiplied by it. */
  readonly theMultiplierOfTheChanceHisMirrorImageIsSeenThrough: number;
}

/** What one of a hero's items changes in his combat spells: one of the two. */
export type TheChangeAnItemMakesToACombatSpell = Partial<TheChangesAHerosItemsMakeToHisCombatSpells>;

/** What the stage "personalCombat: a combat spell takes hold" hands an effect (after the cast roll). */
export interface ACombatSpellTakingHold {
  /** The caster's level in the spell's school, counted to 5 (every spell's effect counts it so). */
  readonly theLevelCountedTo5: number;
  /** ×2 against a guardian weak to the spell's school, else ×1 (it doubles what doesn't harm: a harm is doubled once,
   *  in pcTakeHit). */
  readonly theWeaknessFactor: number;
  /** Whether the target is a guardian weak to the spell's school. */
  readonly theTargetIsWeakToTheSchool: boolean;
  /** The caster's maximum HP, as Holy Symbol reads it (20 when he has none). */
  readonly theCastersMaximumHp: number;
  readonly theTarget: ATargetAsACombatSpellReadsHim;
  /** The fight's Mirror Image as the spell finds it: no fight to conjure one in (a forecast's bare cast), one that
   *  fights, or none (from P1-19x). */
  readonly theFightsMirrorImage: 'there is no fight' | 'an image fights' | 'no image fights';
  /** What the caster's items change in his combat spells, asked only by a spell that reads it, when it reads it:
   *  reading a hero's items tidies them. */
  readonly whatTheCastersItemsChange: () => TheChangesAHerosItemsMakeToHisCombatSpells;
}

/** What the stage "personalCombat: a mirror image is disbelieved" hands an effect (resolvePersonalCombat, each round an
 *  image fights, before the victim's roll; plan P1-19x). */
export interface AMirrorImageItsVictimMaySeeThrough {
  /** The victim's skill levels, if he is a hero with skills (each as it is held: none read as 0), else none. */
  readonly theVictimsSkillLevels: readonly (number | undefined)[] | null;
  /** The victim's Melee (none read as 0). */
  readonly theVictimsMelee: number;
  /** What the caster's items change in his combat spells (asked every round, as the code asked it). */
  readonly whatTheCastersItemsChange: () => TheChangesAHerosItemsMakeToHisCombatSpells;
}

/** The line of a combat spell that has no other step to write it (plan P1-19x), with the facts its kind records beside
 *  the caster's and the target's names. */
export type TheLineOfACombatSpell =
  | { readonly kind: 'the caster conjures a mirror image' | 'the caster weaves a second mirror image' }
  | { readonly kind: 'the caster conjures a phantom of the target' }
  | { readonly kind: 'the caster fades from sight'; readonly invPct: number }
  | {
      readonly kind: "the caster's curse withers the target";
      readonly bestKey: string;
      readonly bestSchool: string;
      readonly bestAbilityLevel: number;
    }
  | {
      readonly kind:
        | "the caster's curse finds no ability"
        | "the caster's charm washes over a crowned will"
        | "the caster's charm slides off a mind lately swayed"
        | "the caster charms the target's wits";
    }
  | { readonly kind: 'control undead has no hold over the living' };

/** The line a hit of a combat spell writes when it lands, with the facts its kind records beside the target's. */
export type TheLineOfACombatSpellsHit =
  | { readonly kind: "the caster's lightning bolt arcs into the target" }
  | { readonly kind: "the holy light's damage"; readonly againstTheUnclean: boolean }
  | { readonly kind: 'a telekinetic storm rips the target'; readonly self: number }
  | { readonly kind: "the hand of death claims part of the target's health"; readonly handOfDeathBitePct: number };

// ── What a daze or a lingering harm in a personal combat comes from (plan P1-12d19: P1-12's Decisions of 2026-10-30,
// Decision 4). The fight hands its source, as a record of the names it is written from, never its words: the prose
// writes them (src/views/prose/the-words-of-a-personal-combats-lines.ts). Here, beside the combat spells' steps, which
// name a source too (src/engine/rules/ imports nothing from src/engine/personal-combat/); the facts module of personal
// combat exports them by the same names. ──

/** What a daze comes from, as the line a ward turns it with names it (pcStunTurned, pcLandStun). */
export type TheSourceOfADaze =
  /** A combat item's daze, riding on its blow: "the Thunder Stone's daze". */
  | { readonly kind: "a combat item's daze"; readonly itemName: string }
  /** A combat item that holds the foe: "the Scroll of Paralysis". */
  | { readonly kind: "a combat item's hold"; readonly itemName: string }
  /** A spell's blast (Psychic Blast's), by the spell's name as the content holds it: "the blast". */
  | { readonly kind: "a spell's blast"; readonly spellName: string }
  /** A caster's grip (Control Undead's), by the caster's name: "Aldric's grip". */
  | { readonly kind: "a caster's grip"; readonly casterName: string }
  /** A guardian's special's daze, by the special's name: "Tail Sweep's daze". */
  | { readonly kind: "a guardian's special's daze"; readonly specialName: string };

/** What a daze comes from, as a combat spell's step names it: a caster's grip without his name, which the resolver
 *  adds. */
export type TheSourceOfADazeAsACombatSpellsStepNamesIt =
  Exclude<TheSourceOfADaze, { readonly kind: "a caster's grip" }> | { readonly kind: "a caster's grip" };

/** What a lingering harm comes from (pcPushDot). Its identity too: the same source refreshes the harm, another runs
 *  beside it (theSameSourceOfALingeringHarm, src/engine/personal-combat/helpers.ts). */
export type TheSourceOfALingeringHarm =
  /** A combat item's burn: "Vial of Alchemist's Fire". */
  | { readonly kind: 'a combat item'; readonly itemName: string }
  /** An archer's impaling arrow, by the archer's name: "Aldric's impaling arrow". */
  | { readonly kind: "an archer's impaling arrow"; readonly archerName: string }
  /** A spell that burns (Fireball's), by the spell's name as the content holds it: "Fireball burns". */
  | { readonly kind: 'a spell that burns'; readonly spellName: string }
  /** A guardian's special, by its name: "Barbed Sting". */
  | { readonly kind: "a guardian's special"; readonly specialName: string };

/** The damage of a hit: a number, or dice the resolver draws (rng), one a level. */
export type TheDamageOfACombatSpellsHit =
  number | { readonly theDice: number; readonly eachFrom: number; readonly eachTo: number };

/** One step of what a combat spell does, in the order the resolver applies them. */
export type AStepOfACombatSpell =
  /** A hit (pcTakeHit, the spell's name its kind), the HP the caster loses as it lands, and its line if it deals any. */
  | {
      readonly kind: 'a hit';
      readonly theDamage: TheDamageOfACombatSpellsHit;
      readonly theCastersRecoil: number | null;
      readonly theLine: TheLineOfACombatSpellsHit;
    }
  /** A burn a round (pcPushDot), its source, and the share of the target's maximum HP and the ward's cut its line
   *  shows. */
  | {
      readonly kind: 'a burn';
      readonly theDamage: number;
      readonly theRounds: number;
      readonly theSource: TheSourceOfALingeringHarm;
      readonly theShareOfMaximumHp: number;
      readonly theWardsCut: number;
      readonly theLine: 'a fireball engulfs the target and will burn';
    }
  /** A stun (pcLandStun, by its source: a spell's blast, or the caster's grip, his name added by the resolver), and its
   *  line if it lands. */
  | {
      readonly kind: 'a stun';
      readonly theRounds: number;
      readonly theSource: TheSourceOfADazeAsACombatSpellsStepNamesIt;
      readonly theLine: "psychic blast sears the target's mind" | 'the caster seizes the undead target';
    }
  /** A silence and a halved melee, at least these rounds, and the chance a round the target shrugs it off. */
  | { readonly kind: 'a silence'; readonly theRounds: number; readonly theChanceItIsShruggedOff: number }
  /** A cut to the target's aim. */
  | { readonly kind: "a cut to the target's aim"; readonly theCut: number; readonly againstTheUnclean: boolean }
  /** The caster's heal, to his maximum HP as the spell reads it, if he is hurt. */
  | { readonly kind: "the caster's heal"; readonly theHp: number; readonly theCastersMaximumHp: number }
  /** A chance (the resolver's roll: kcRng() * 100 under it), the steps if it holds (worked out once it holds), and the
   *  line if it fails. */
  | {
      readonly kind: 'a chance';
      readonly theChance: number;
      readonly ifItHolds: () => readonly AStepOfACombatSpell[];
      readonly theLineIfItFails: "the caster's hand of death fails";
    }
  // From P1-19x:
  /** A cut to his foes' aim at the caster (the larger of it and the cut he has). */
  | { readonly kind: "a cut to the foes' aim at the caster"; readonly theCut: number }
  /** A share added to the caster's chance to flee. */
  | { readonly kind: 'a flight bonus'; readonly theShareAdded: number }
  /** The caster's next flight at double the chance. */
  | { readonly kind: "the caster's flight doubled" }
  /** The target's skill (his Melee, his Archery, or his level in the school) left at the level given. */
  | {
      readonly kind: 'a skill halved';
      readonly theSkill: 'melee' | 'archery' | 'magic';
      readonly theSchool: AMagicSchool;
      readonly theLevelLeft: number;
    }
  /** A phantom of the target conjured into the fight (the resolver builds it), of the HP and the plan given, for the
   *  rounds given. */
  | {
      readonly kind: 'an image conjured';
      readonly theImagesHp: number;
      readonly theImagesPlan: readonly string[];
      readonly theRounds: number;
    }
  /** The image that fights, and the one cast, vanish. */
  | { readonly kind: 'the images vanish' }
  /** A target's will that may throw the spell off (the resolver's roll: d100() at most it), and the steps if it
   *  doesn't. */
  | {
      readonly kind: 'a will that may throw it off';
      readonly theWill: number;
      readonly ifItDoesNot: readonly AStepOfACombatSpell[];
    }
  /** A line alone. */
  | { readonly kind: 'a line'; readonly theLine: TheLineOfACombatSpell };

/** A unit a realm's discoveries may strengthen, and its battle (discUnitMult, which armStr asks: plan P1-19aa). */
export interface AUnitARealmsDiscoveriesMayStrengthen {
  readonly theUnit: AUnitAsTheDiscoveriesReadIt;
  /** The ground it fights on, or none given. */
  readonly theGround: string | null | undefined;
  /** Whether its side attacks (true), defends (false), or neither is given. */
  readonly isItsSideTheAttacker: boolean | null | undefined;
  /** Whether the realm's king leads it in person. */
  readonly isItLedByTheKing: boolean;
  /** Whether a commander leads it (a garrison standing alone has none). */
  readonly hasItACommander: boolean;
}

/** The attacker's units, as a realm's siegecraft reads them (both battles, before the defenders' bonus is counted). */
export interface TheAttackersUnitsAtASiege {
  readonly theAttackersUnits: readonly (Pick<AUnitAsTheDiscoveriesReadIt, 'type'> | null | undefined)[];
}

/** The province a realm defends, as its own-ground discoveries read it (both battles). */
export interface TheGroundARealmDefends {
  /** Whether the province is the realm's home: asked only by an effect that reads it (asking may fix a realm's home,
   *  as homeProvinceIdFor does the first time, so it is asked when the resolver asked it before). */
  readonly isItTheRealmsHome: () => boolean;
}

/** A side of a battle, as a realm's fanaticism discoveries read it (both battles, before the fanaticism rolls). */
export interface ASideAsItsFanaticismIsRolled {
  readonly theSide: 'atk' | 'def';
  readonly theGround: string | null | undefined;
  readonly theForce: readonly (AUnitAsTheDiscoveriesReadIt | null | undefined)[] | null | undefined;
}

/** Where a hero casts, as a discovery's `ctx` names it: before a battle, in an order, in a personal combat. */
export type WhereAHeroCasts = 'battle' | 'action' | 'duel';

/** A caster's cast, as a realm's discoveries read it (applyPreBattleMagic and the hero's cast in combatVsNPC: plan
 *  P1-19aa; castChanceFor and pcCastCombatSpell: P1-19ac). */
export interface ACastARealmsDiscoveriesMayHelp {
  readonly theSchool: string;
  readonly whereHeCasts: WhereAHeroCasts;
}

/** A unit a commander leads, as Dragon Taming reads it (dragonTamed). */
export interface ABeastACommanderLeads {
  readonly theUnitsType: string;
}

/** A beaten unit, as a realm's discoveries that cut its chance of death read it (discDeathMult: plan P1-19ab). */
export interface ABeatenUnitARealmsDiscoveriesMaySpare {
  readonly theUnit: AUnitAsTheDiscoveriesReadIt;
  /** Its side ('atk' or 'def'), or none given. */
  readonly theSide: string | null | undefined;
}

/** A unit after a battle, as a realm's discoveries that add to its chance of promotion read it (discPromo: plan
 *  P1-19ab). */
export interface AUnitARealmsDiscoveriesMayPromote {
  readonly theUnit: AUnitAsTheDiscoveriesReadIt;
}

/** The foe a fighter aims at in a personal combat, as a realm's discoveries that steady his aim read him (pcHitChance
 *  and pcArrowHitChance: plan P1-19ac). */
export interface AFoeARealmsDiscoveriesSteadyAFightersAimAt {
  /** What the foe is: a character or a monster (his `kind`). */
  readonly whatTheFoeIs: string | undefined;
  /** The foe's kind (pcFoeCat: 'undead', 'humanoid', 'beast', …), asked only by an effect that reads it. */
  readonly theFoesKind: () => string;
}

/** A guardian's perk as his card's rule reads it (monsterTraits: plan P1-19ai): its ward, or a field of the ward's own
 *  name set (the form the rule has always read too; no perk of MONSTERS_P writes it). */
export interface APerkAsAGuardiansCardReadsIt {
  readonly ward?: string | undefined;
  readonly meleeDR?: unknown;
  readonly arrowDR?: unknown;
  readonly spellPct?: unknown;
}

/** An approach to a guardian a perk on his card may turn (monsterTraits' hidden multipliers: blades, arrows, magic). */
export type AnApproachAGuardiansCardMayTurn = 'melee' | 'archery' | 'spell';

/** The approaches a guardian's perks turn, so no hidden multiplier of his nature leaves him weaker to them. */
export type TheApproachesAGuardiansPerksTurn = Readonly<Record<AnApproachAGuardiansCardMayTurn, boolean>>;

/** What the stage "a guardian's perks: his grade's cap beside his own" hands an effect (pcMonsterCombatant, once his
 *  perks are on him: plan P1-19ai): the cap on a single hit his grade gives him (GUARDIAN_BODY_CAP_PCT; 0 for none),
 *  and the wards his perks gave him (none: no table). */
export interface AGuardiansGradesCapAndTheWardsHisPerksGaveHim {
  readonly theCapOfHisGrade: number;
  readonly theWardsHisPerksGaveHim: Readonly<TheWardsAFighterWears> | null | undefined;
}

/** What a guardian's grade's cap does to the wards his perks gave him: the ward merged into them (the looser of the two
 *  caps is kept, as the merge keeps a percentage), then what his own tighter cap sets back (none: null). */
export interface WhatAGuardiansGradesCapDoes {
  readonly theWardHisGradeAdds: AWardAsTheMergeReadsIt;
  readonly whatHisOwnTighterCapKeeps: WhatAWardSets | null;
}

/** A guardian's stun ward as a stun meets it (pcStunWard, pcStunTurned: plan P1-19aj): the chance, 0 to a full ward's
 *  100, that his perks turn a stun as it lands (none worn: 0), and the ward the line names. */
export interface AGuardiansStunWard {
  readonly theChance: number;
  readonly theWardTheLineNames: string;
}

/** What the stage "a guardian's perks: a round starts" hands an effect (pcRoundStart, when he wears wards: plan
 *  P1-19aj): the wards he wears, the chance his wards turn a stun (pcStunWard: his items' refusal, else his perks'
 *  chance), and whether his items slough off every lingering harm (the items' registry's round start). */
export interface AFightersWardsAsAGuardiansPerksMeetARound {
  readonly theWards: TheWardsAsTheirEffectsReadThem;
  readonly theChanceHisWardsTurnAStun: number;
  readonly hisItemsSloughOffEveryLingeringHarm: boolean;
}

/** What a guardian's perks do as a round starts, each with the ward the line names: a stun he is under cleared (his
 *  wards turn every stun), every lingering harm sloughed off (his items', or his perk's whole ward). Each effect sets its
 *  own field. */
export interface WhatAGuardiansPerksDoAsARoundStarts {
  readonly theStunHeIsUnderIsCleared?: { readonly theWardTheLineNames: string };
  readonly everyLingeringHarmSloughsOff?: { readonly theWardTheLineNames: string };
}

/** A guardian's lingering-harm ward as each tick of a lingering harm meets it (pcRoundStart, any fighter: plan
 *  P1-19aj): the share of each tick it turns, 0 to a full ward's 100 (none worn: 0), and the ward the line names. */
export interface AGuardiansLingeringHarmWard {
  readonly theShareItTurns: number;
  readonly theWardTheLineNames: string;
}

/** What the stage "a guardian's perks: a combat spell's chance: a ward against its school" hands an effect
 *  (pcCastCombatSpell, once the chance is capped: plan P1-19aj): the target's wards (none: null), the spell's school,
 *  whether the target is a guardian weak to that school, and the cast's chance so far. */
export interface ACastAsAGuardiansWardAgainstItsSchoolMeetsIt {
  readonly theTargetsWards: TheWardsAsTheirEffectsReadThem | null | undefined;
  readonly theSchool: string;
  readonly heIsWeakToTheSchool: boolean;
  readonly theChanceSoFar: number;
}

/** What a guardian's ward against a spell's school does to its cast: the points it takes off (none: 0), the cast's
 *  chance after, and the ward the line names. */
export interface WhatAWardAgainstASchoolDoesToACast {
  readonly thePointsOff: number;
  readonly theChanceAfter: number;
  readonly theWardTheLineNames: string;
}

/** A skill about to roll to rise through experience, as a realm's discoveries that add to its chance read it
 *  (trySkillGain: plan P1-19ac). */
export interface ASkillARealmsDiscoveriesMayRaise {
  readonly theSkill: string;
}

/** The province a spy spies in or on, as a realm's discoveries that help or hinder him read it (resolveSpyOrder, and
 *  the report's odds: plan P1-19ad). Each question is asked only by an effect that needs it. */
export interface WhereASpyActsAsARealmsDiscoveriesReadIt {
  /** The province's ground, or none (the report's odds name no province). */
  readonly theGround: string | null | undefined;
  /** Whether the province touches the sea. */
  readonly isItCoastal: () => boolean;
  /** Whether it is the home of the realm whose discoveries these are (asking may fix a realm's home:
   *  homeProvinceIdFor writes it the first time). */
  readonly isItTheRealmsHome: () => boolean;
}

/** The province an explorer maps, or a lair is cleared in, as a realm's discoveries read its ground (plan P1-19ad). */
export interface TheGroundAHeroWorks {
  readonly theGround: string;
}

/** A cleared lair's hoard, as a realm's discoveries that add to its gold read it (resolveSearchLairOrder: plan
 *  P1-19ad). */
export interface ALairsHoardARealmsDiscoveriesMayEnrich {
  readonly theGround: string;
  /** The race of the hero who cleared it. */
  readonly theHerosRace: string | null | undefined;
}

/** A Research order, as a realm's discoveries that add to its chance read it (resolveResearchOrder, and the report's
 *  odds: plan P1-19ad). */
export interface AResearchARealmsDiscoveriesMayHelp {
  /** Whether the field studied is the realm's own creed, asked only by an effect for that field. */
  readonly isTheFieldStudiedItsOwnCreed: () => boolean;
}

/** A skill practised, as a realm's discoveries that add to its chance read it (resolvePracticeSkillOrder, and the
 *  report's odds with no skill: plan P1-19ad). */
export interface ASkillARealmsDiscoveriesMayDrill {
  readonly theSkill: string | null | undefined;
}

/** Where a hero rests, as a realm's discoveries that add to his heal read it (resolveRestOrder: plan P1-19ad). */
export interface WhereAHeroRestsAsARealmsDiscoveriesReadIt {
  /** Whether the province is his realm's. */
  readonly isItHisRealmsGround: boolean;
  /** Whether it is his realm's home, asked only by an effect for the home (asking may fix a realm's home). */
  readonly isItHisRealmsHome: () => boolean;
  readonly theGround: string;
}

/** A province a realm holds, as its discoveries that help it spot an enemy hero lurking there read it
 *  (spotEnemyInOwnedProvince: plan P1-19ad). Each question is asked only by an effect that needs it. */
export interface AProvinceARealmsDiscoveriesWatch {
  readonly theGround: string;
  /** Whether it is the watching realm's home (asking may fix a realm's home). */
  readonly isItTheRealmsHome: () => boolean;
  /** Whether it touches the sea. */
  readonly isItCoastal: () => boolean;
}

/** A Consecrate order, as a realm's discoveries that add to the consecrated provinces a crown may hold read it
 *  (resolveConsecrateOrder: plan P1-19ae). */
export interface AConsecrationARealmsDiscoveriesMayAllow {
  /** The consecrating hero's White skill level. */
  readonly theConsecratorsWhiteSkill: number;
}

/** The quality a discovery lets a Call to Arms raise its company at, and the chance it does (resolveCallToArmsOrder,
 *  which rolls: plan P1-19ae), each as its row writes it. */
export interface AQualityACallToArmsMayRaise {
  /** The chance, as a share; none: it always does. */
  readonly theChance: number | undefined;
  readonly theQuality: string | readonly string[] | undefined;
}

/** A unit a realm recruits or a band it hires, as a realm's discoveries that change its price or its grade read it
 *  (resolveRecruitArmiesOrder, and the report's prices: plan P1-19ae). */
export interface AUnitARealmRaises {
  /** The unit's type. */
  readonly theUnitsType: string;
}

/** A unit a realm recruits, as a realm's discoveries that change its price read it, with its price so far (each
 *  effect in turn: realmRecruitCost, plan P1-19ae). */
export interface AUnitARealmRecruitsAndItsPriceSoFar extends AUnitARealmRaises {
  readonly thePriceSoFar: number;
}

/** A province an Evil conqueror plunders, as a realm's discoveries that add to the plunder read it (applyEvilConquest:
 *  plan P1-19af). */
export interface AProvinceARealmsDiscoveriesMayPlunder {
  /** The province's terrain. */
  readonly theGround: string;
}

/** A land unit of Speed 1–2 a realm's discoveries may speed on the march, as they read it (computeMovePoolMax,
 *  garrisonMoveRate and the report's speeds, each after its own guards: plan P1-19af). */
export interface AUnitARealmsDiscoveriesMaySpeed {
  readonly theUnit: AUnitAsTheDiscoveriesReadIt;
}

/** A province a realm's discoveries may add to the tax of, as they read it (discTaxAdd, which the collection and the
 *  views ask: plan P1-19ag). Its coast and whether it is the realm's home are questions, asked only by an effect that
 *  needs them, in the order the filters read them. */
export interface AProvinceARealmsDiscoveriesMayTax {
  /** The province's own tax (none read as 0). */
  readonly theTax: number;
  /** Its terrain. */
  readonly theGround: string;
  /** Its folk's race, if it has one. */
  readonly theFolk: string | null | undefined;
  /** The realm's own race. */
  readonly theRealmsRace: string | undefined;
  /** Whether a garrison stands in it. */
  readonly isItGarrisoned: boolean;
  readonly isItCoastal: () => boolean;
  readonly isItTheRealmsHome: () => boolean;
}

/** What one effect of a realm's discoveries adds to a province's tax, or cuts off a wage, and its row's own ceiling,
 *  if it writes one (the runner caps it, with the realm's, and keeps the account). */
export interface WhatAnEffectPaysAndItsOwnCeiling {
  readonly theGold: number;
  readonly itsOwnCeiling: number | undefined;
}

/** The ceiling a discovery a realm holds puts on a hero's wage, and its row's own ceiling on what it saves. */
export interface AWageCeilingAndItsOwnCeiling {
  readonly theWagesCeiling: number;
  readonly itsOwnCeiling: number | undefined;
}

/** What each capped effect of a realm's discoveries has paid (or saved) so far this collection: a Map, one per realm
 *  per collection, kept by the caller (discTaxAdd's, discUpkeepWage's and discHeroWage's `acc`). */
export interface WhatEachCappedEffectHasPaid {
  get(effect: TheEffectOfADiscovery): number | undefined;
  set(effect: TheEffectOfADiscovery, paid: number): unknown;
}

/** The provinces' income and the realm's ceiling, as Taxation Records reads them (taxRecordsGold: plan P1-19ag). */
export interface TheIncomeTaxationRecordsAddsTo {
  readonly theIncome: number | null | undefined;
  /** The realm's ceiling (5% of its base tax), or none given (the row's own `max`, else 99g). */
  readonly theCeiling: number | null | undefined;
}

/** A realm's treasury and its ceiling, as the interest discoveries read them (the collection and the report). */
export interface ATreasuryARealmsDiscoveriesMayEarnInterestOn {
  readonly theTreasury: number;
  readonly theCeiling: number;
}

/** A unit whose wage a realm's discoveries may cut (discUpkeepWage, after its guards: plan P1-19ag). */
export interface AUnitWhoseWageARealmsDiscoveriesMayCut {
  readonly theUnit: AUnitAsTheDiscoveriesReadIt;
}

/** A hero whose wage a realm's discoveries may cut (discHeroWage: plan P1-19ag). */
export interface AHeroWhoseWageARealmsDiscoveriesMayCut {
  readonly theHerosAlignment: string;
}

/** A hero as the discoveries that heal the wounded or add to his maximum HP read him (plan P1-19ag). */
export interface AHeroARealmsDiscoveriesMayHeal {
  readonly isHeTheKing: boolean;
}

/** A hero whose maximum HP a realm's discoveries may raise (discMaxHpFor: plan P1-19ag). */
export interface AHeroWhoseMaximumHpARealmsDiscoveriesMayRaise extends AHeroARealmsDiscoveriesMayHeal {
  /** His skills' levels (a skill he hasn't, none). */
  readonly theLevelsOfHisSkills: Readonly<Partial<Record<string, number>>>;
}

/** The hook points, each a set of named stages in the order the engine runs them, and the effect type of each stage.
 *  A stage or a hook point typed `never` has no signature yet: its family's first row writes it (plan P1-19's Choice
 *  1), so an entry on it fails to compile meanwhile. */
export interface TheStagesOfEachHookPoint {
  readonly strength: {
    /** The enemy flyer a unit harries before the battle, and the strength it loses, or nothing (applyFlakScreen,
     *  before the volley). */
    readonly 'a flyer is harried before the battle': (
      facts: AUnitAndTheEnemyFlyersNotYetHarried,
    ) => AFlyerHarried | null;
    /** Whether the sea's penalty to a land unit is waived (armStr, before the unit's factors from its force). */
    readonly 'a land unit at sea': (facts: ALandUnitAtSea) => boolean;
    /** Whether the commander's item waives the sea's penalty to a land unit he leads (armStr, beside Naval's eighth
     *  level; the items' registry). */
    readonly 'a land unit at sea, led': (facts: ALandUnitAtSeaLed) => boolean;
    /** The step an item the commander carries makes on the strength of a unit he leads, or nothing; the runner applies
     *  the steps in the stage's order, each rounded as it goes (armStr; the items' registry). */
    readonly "the commander's items": (facts: AUnitLedByACommander) => AStepOfTheCommandersItems | null;
    /** The defenders' fortifications after an item a commander of the battle carries, from the bonus so far, or nothing
     *  (both battles, after the realm's own bonuses; the items' registry). */
    readonly "the defenders' fortifications": (
      facts: TheDefendersFortificationsAndACommandersSide,
      theBonusSoFar: number,
    ) => TheFortificationsAfterAnItem | null;
    /** The unit's own factor from its force and the battle's facts; the runner multiplies them in the stage's order. */
    readonly 'the whole force': (facts: AUnitInItsForce) => number;
    /** Whether a rider takes the one flank slot rough ground allows (battleGrid, through abilityFlanksRough). */
    readonly 'a rider takes the flank on rough ground': (facts: AUnitInTheLineOnItsGround) => boolean;
    /** Whether a flyer leaves the air for a flank slot no rider fills, on open ground (battleGrid). */
    readonly 'a flyer takes an open flank no rider fills': (facts: AUnitInTheLineOnItsGround) => boolean;
    /** The multiplier of the unit's place in its line, and the ability, or nothing (the line's own: battleRegrid). */
    readonly 'its place in the line': (facts: AUnitInItsLine) => AMultiplierAndTheAbilityThatSetIt | null;
    /** The unit's own matchup against the unit it meets, from the role matchup's multiplier (abilityFront). */
    readonly 'what a unit does to the unit it meets': AnEffectOnTheMultiplierSoFar<AUnitMeetingAnother>;
    /** What the unit it meets does to it, after the unit's own (abilityFront). */
    readonly 'what the unit it meets does to it': AnEffectOnTheMultiplierSoFar<AUnitMeetingAnother>;
    /** A shooter's own matchup against its target, from the role's multiplier (abilityBack). */
    readonly 'what a shooter does to its target': AnEffectOnTheMultiplierSoFar<AShooterAndItsTarget>;
    /** What the target does to the shooter, after the shooter's own (abilityBack). */
    readonly 'what the target does to the shooter': AnEffectOnTheMultiplierSoFar<AShooterAndItsTarget>;
    /** Whether a unit at a wrapped end isn't hit from the side: the ability's slug, or nothing (battleFaceSide). */
    readonly 'held when hit from the side': (facts: AUnitAtAWrappedEnd) => UnitAbilitySlug | null;
    /** What the units beside and behind a front-line unit do to it, after its facing and any side hit. */
    readonly 'beside and behind it in the front line': AnEffectOnTheMultiplierSoFar<AUnitBesideAndBehindOthers>;
    /** The units of my line the enemy's ability marks, and the factor they fight at (the resolver applies each mark
     *  last, where the unit marked fights: the front, the second line, the air). */
    readonly 'marked by the enemy line': (myLine: MyLineAsTheEnemyLineMarksIt) => AMarkOnMyLine | null;
    /** The unit of the enemy front a shooter shoots instead of the one in front of it: its place in the list. */
    readonly 'a shooter picks its target': (facts: AShooterAndTheEnemyFront) => number | null;
    /** Whether free enemy riders turn an anchored line: the ability's slug, or nothing. */
    readonly 'turns an anchored line': (facts: TheFreeEnemyRiders) => UnitAbilitySlug | null;
    /** A unit's own ability in the air, from ×1. */
    readonly 'what a flyer does': AnEffectOnTheMultiplierSoFar<AFlyerAndTheEnemysFlyers>;
    /** What a battle spell does once cast before an army battle, in the copy that casts it (applyPreBattleMagic, and
     *  combatVsNPC twice: the spells' registry; one spell a cast, found by its name). */
    readonly 'a battle spell is cast before the battle': (
      facts: ABattleSpellCastBeforeTheBattle,
    ) => WhatABattleSpellDoes;
    /** Whether a battle spell has something to strike on this field (battleSpellUseful, which the choice of a battle
     *  spell asks; the spells' registry: a spell with no effect here strikes any enemy unit). */
    readonly 'a battle spell has something to strike': (facts: AFieldABattleSpellMayBeCastOn) => boolean;
    /** What a hero's item changes in his battle spell (applyPreBattleMagic and the hero's cast in combatVsNPC; the
     *  items' registry: the first of his items, in the stage's order, that changes it). */
    readonly "a hero's items change his battle spell": () => TheChangeAnItemMakesToABattleSpell;
    /** What a unit's strike may do before an army battle, in the copy that asks, or nothing (it has no strike, or the
     *  other side no unit): the three copies, after battle magic. One effect casts every unit's strikes, its type's in
     *  the content's tables (the spells' registry's runner). */
    readonly 'a unit strikes before the battle': (
      facts: AUnitAboutToStrikeBeforeTheBattle,
    ) => WhatAUnitsStrikeMayDo | null;
    /** What an item a commander carries adds to the chance of his units' strikes before an army battle (the three
     *  copies, through primalStrikeChance; the items' registry: the runner adds every item's, item by item). */
    readonly "a commander's items add to a strike's chance": (theItem: AHeldCopysOwnNumbers) => number;
    /** The factor a discovery the unit's realm holds strengthens a unit by, or nothing (it doesn't reach the unit, or
     *  not in this battle); the runner multiplies them, then caps the product at the kind's ceiling (discUnitMult:
     *  the discoveries' registry, plan P1-19aa). */
    readonly "a realm's discoveries strengthen a unit": (
      theEffect: TheEffectOfADiscovery,
      facts: AUnitARealmsDiscoveriesMayStrengthen,
    ) => number | null;
    /** What a discovery the attacker's realm holds takes off the defenders' bonus, or nothing (both battles; the
     *  runner adds them). */
    readonly "a realm's discoveries add to a siege": (
      theEffect: TheEffectOfADiscovery,
      facts: TheAttackersUnitsAtASiege,
    ) => number | null;
    /** The share a discovery the defending realm holds adds to its defence on its own ground, or nothing (both
     *  battles; the runner adds them, then caps the sum at the kind's ceiling). */
    readonly "a realm's discoveries fortify its own ground": (
      theEffect: TheEffectOfADiscovery,
      facts: TheGroundARealmDefends,
    ) => number | null;
    /** The share a discovery a side's realm holds adds to its chance of fanaticism, or nothing (both battles; the
     *  runner adds them). */
    readonly "a realm's discoveries stir a side's fanaticism": (
      theEffect: TheEffectOfADiscovery,
      facts: ASideAsItsFanaticismIsRolled,
    ) => number | null;
    /** Whether a discovery the commander's realm holds lets a winged beast he leads follow him without his Druid
     *  (dragonTamed: the runner asks each effect of the kind the realm holds). */
    readonly "a realm's discoveries let a beast follow without its Druid": (
      theEffect: TheEffectOfADiscovery,
      facts: ABeastACommanderLeads,
    ) => boolean;
    /** The share a discovery a realm holds adds to its whole army's strength (both battles). No entry holds it: War
     *  Drums, the one such discovery, is an ordinary unit strength effect since 2026-09-21, so the runner adds
     *  nothing (Parked "Three dead paths in discoveries.ts"). */
    readonly "a realm's discoveries add to the whole army": (theEffect: TheEffectOfADiscovery) => number;
    /** The weights a discovery gives the lines behind the front, as its row writes them, or none (Flanking Tactics:
     *  a side whose realm holds an effect of the stage has its lines weighted, and flankLineMults reads the weights
     *  of the content's effect of it, a list of four or its fallback; plan P1-19ab). */
    readonly "a realm's discoveries weight the lines behind the front": (
      theEffect: TheEffectOfADiscovery,
    ) => readonly number[] | undefined;
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
    /** The volleys an item the commander carries adds to each missile unit he leads (both battles' volley; the items'
     *  registry: the runner adds them to the one volley each looses). */
    readonly 'the commander adds volleys': () => TheVolleysAnItemAdds;
    /** The shooter's factor on a shot's damage; the runner multiplies them in the stage's order (missileDamageMult). */
    readonly "a shot's damage": (facts: AShotAtItsTarget) => number;
    /** The damage of a shot after the target's ability, from the damage so far (after a flyer's double), or nothing
     *  (applyMissileHit). */
    readonly 'what the target does to a shot': (facts: TheTargetOfAShot, theDamageSoFar: number) => number | null;
    /** The share of the target's strength a shooter may soften it to, or nothing (the usual limit: missileCap). */
    readonly 'the softening limit': (facts: AShooterAndWhetherItsTargetFlies) => number | null;
  };
  readonly fate: {
    /** The enemy hull a unit sinks before the battle: its place among the hulls afloat, or nothing (both battles, before
     *  either side's strength is counted). */
    readonly 'a hull is sunk before the battle': (facts: AUnitAndTheEnemyHullsAfloat) => number | null;
    /** Whether a beaten force holds, never routing (shieldFortHolds, before the rout). */
    readonly 'the beaten force holds': (facts: ABeatenForceAndItsFrontLine) => boolean;
    /** A pursuit of the beaten by the winning force, or nothing (the rout of both battles, before the beaten units'
     *  death rolls). */
    readonly 'the winner runs the beaten down': (facts: AWinningForceOnItsGround) => APursuitOfTheBeaten | null;
    /** Whether an item the winning commander carries lets his riders' pursuit run on any ground (the answer the stage
     *  above is handed, asked by Ride Them Down; the items' registry). */
    readonly "the commander's riders run the beaten down on any ground": () => boolean;
    /** Whether a unit that failed its death roll lives: the line of the battle by which it does, or nothing (it dies). */
    readonly 'a beaten unit fails its death roll': (
      facts: AUnitThatFailedItsDeathRoll,
    ) => TheLineOfAUnitThatLivesThroughItsDeathRoll | null;
    /** Whether a beaten unit that failed its demotion roll holds its tier: the line by which it does, or nothing. */
    readonly 'a beaten unit fails its demotion roll': (
      facts: AUnitThatFailedItsDemotionRoll,
    ) => TheLineOfAUnitThatHoldsThroughItsDemotionRoll | null;
    /** Whether a force holds the sea lanes (both battles' retreat, after the units' fates). */
    readonly 'a force holds the sea lanes': (facts: AForceInItsBattle) => boolean;
    /** Whether an item the beaten commander carries lets his force retreat (the battle against neutral guards'
     *  retreat, after the units' fates; the items' registry: false refuses every retreat, and the force stands). */
    readonly 'the beaten force may retreat': () => boolean;
    /** The share a discovery the unit's realm holds cuts from a beaten unit's chance of death, or nothing (it doesn't
     *  reach the unit, or not on its side); the runner adds them and gives the multiplier left, never below the
     *  kind's floor (discDeathMult, which both battles ask: plan P1-19ab). */
    readonly "a realm's discoveries spare a beaten unit": (
      theEffect: TheEffectOfADiscovery,
      facts: ABeatenUnitARealmsDiscoveriesMaySpare,
    ) => number | null;
    /** The share a discovery the unit's realm holds adds to its chance of promotion after a battle, or nothing (it
     *  doesn't reach the unit); the runner adds them (discPromo, which both battles ask). */
    readonly "a realm's discoveries promote a unit": (
      theEffect: TheEffectOfADiscovery,
      facts: AUnitARealmsDiscoveriesMayPromote,
    ) => number | null;
    /** The points a discovery an Elven realm holds adds to a fallen Elven unit's chance of slipping away home; the
     *  runner adds them (recordBattleGraves, which rolls). */
    readonly "a realm's discoveries carry a fallen unit home": (theEffect: TheEffectOfADiscovery) => number;
    /** The chance a discovery a slain hero's realm holds gives him of being dragged from the field alive, as its row
     *  writes it (a share); the runner gives the first effect's, or nothing if the realm holds none
     *  (handleHeroDeath, which rolls). */
    readonly "a realm's discoveries drag a hero from the field": (theEffect: TheEffectOfADiscovery) => number;
    /** The gold a discovery a Pagan victor's realm holds adds to its blood harvest for each enemy unit destroyed; the
     *  runner adds them (bloodHarvest: plan P1-19af). */
    readonly "a realm's discoveries add to a blood harvest": (theEffect: TheEffectOfADiscovery) => number;
    /** The share of strength a discovery an Evil victor's realm holds adds to what each terror stack its victory leaves
     *  costs the next defenders; the runner adds them (spreadTerror, its stacks and its line). */
    readonly "a realm's discoveries add to the terror a victory leaves": (theEffect: TheEffectOfADiscovery) => number;
    /** The share of a conquered province's tax a discovery an Evil conqueror's realm holds adds to the plunder, or
     *  nothing (its row names other ground); the runner adds them (applyEvilConquest). */
    readonly "a realm's discoveries add to a conquest's plunder": (
      theEffect: TheEffectOfADiscovery,
      facts: AProvinceARealmsDiscoveriesMayPlunder,
    ) => number | null;
  };
  /** A unit's or a force's movement (plan P1-19's discoveries family: its row P1-19af typed it). */
  readonly movementCost: {
    /** The move points a discovery a realm holds adds to a land unit of Speed 1–2 (no flyer, no ship) a turn, or
     *  nothing (it doesn't reach the unit); the runner adds them (computeMovePoolMax, garrisonMoveRate and the
     *  report's speeds, each after its own guards). */
    readonly "a realm's discoveries add to a march": (
      theEffect: TheEffectOfADiscovery,
      facts: AUnitARealmsDiscoveriesMaySpeed,
    ) => number | null;
    /** The points a discovery a realm holds adds to the chance a column converging on a hero's battle unites with his
     *  force; the runner adds them (resolveMoveOrder, both its rolls). */
    readonly "a realm's discoveries help converging columns unite": (theEffect: TheEffectOfADiscovery) => number;
  };
  /** The checks the Cast Spell order makes of the spell named, before it is worked and as it is (plan P1-19's spells
   *  family: its row P1-19y typed them; the spells' registry, one spell an order, found by its name). In the order the
   *  order makes them. */
  readonly orderValidity: {
    /** Whether a hero charmed from an enemy realm will not turn the spell on his own lord's heroes (refused before the
     *  casting limit, unrolled, no slot spent). */
    readonly 'a charmed hero will not turn it on his lord': () => boolean;
    /** Whether the spell costs no casting slot of its school (the casting limit: it is not counted among the casts so
     *  far, nor ever blocked). */
    readonly 'a spell that costs no casting slot': (facts: ACastAndTheCastersRealm) => boolean;
    /** Whether the hero the spell is aimed at must stand in the caster's province (one gone is refused before the cast
     *  roll, and spends no slot). */
    readonly "a spell's mark must stand in the province": () => boolean;
    /** Whether a hostile mark hidden by a Cloak of Many Faces is shielded from the spell (once the cast lands, before
     *  the spell works). */
    readonly 'a cloaked mark is shielded from it': () => boolean;
    /** Whether an enemy's Bless ward over the province the spell is aimed at may turn it aside (blessWardNegates, where
     *  the spell asks it, before the ward's own roll). */
    readonly 'a Bless ward may turn it aside': () => boolean;
    /** Whether a discovery a realm holds waives the ban on hiring a hero across the gulf between Divine and Undead
     *  (heroHireWage then asks the most; plan P1-19ae: resolveHireHeroOrder, resolveBrokerOrder, the Charm, and
     *  playerView's wages for the report). */
    readonly "a realm's discoveries waive the hiring ban": (theEffect: TheEffectOfADiscovery) => boolean;
  };
  /** A hero's experience (plan P1-19's discoveries family: its row P1-19ac typed it). */
  readonly experience: {
    /** The share a discovery the hero's realm holds adds to a skill's chance to rise through experience, or nothing
     *  (it names other skills); the runner adds them (trySkillGain, which rolls). */
    readonly "a realm's discoveries add to a skill's rise": (
      theEffect: TheEffectOfADiscovery,
      facts: ASkillARealmsDiscoveriesMayRaise,
    ) => number | null;
    /** The factor a discovery the king's realm holds multiplies his hardening after a fight by (the hit points a win
     *  or a wound earns him); the runner gives the first effect's, or nothing if the realm holds none (awardHpRoll). */
    readonly "a realm's discoveries harden the king": (theEffect: TheEffectOfADiscovery) => number;
  };
  /** What a realm sees (plan P1-19's discoveries family: its row P1-19ad typed it). */
  readonly visibility: {
    /** The percentage points a discovery a realm holds adds to its chance to spot an enemy hero lurking in a province
     *  it holds, or nothing (it names other ground); the runner adds them (spotEnemyInOwnedProvince, before the
     *  chance's bounds). */
    readonly "a realm's discoveries spot a hero lurking in its province": (
      theEffect: TheEffectOfADiscovery,
      facts: AProvinceARealmsDiscoveriesWatch,
    ) => number | null;
    /** The share of each province around him a discovery an explorer's realm holds maps as he explores; the runner
     *  gives the first effect's, or nothing if the realm holds none (resolveExploreOrder). */
    readonly "a realm's discoveries map the provinces around an explorer": (theEffect: TheEffectOfADiscovery) => number;
    /** Whether a discovery a realm holds names one enemy captain it can't see, at the new turn; the runner asks whether
     *  any does (the new turn's informants: plan P1-19ag). */
    readonly "a realm's discoveries name an unseen captain": (theEffect: TheEffectOfADiscovery) => boolean;
    /** Whether a discovery a realm holds charts one province it hasn't charted in full, at the new turn; the runner asks
     *  whether any does (the new turn's Observatory: plan P1-19ag). */
    readonly "a realm's discoveries chart a province": (theEffect: TheEffectOfADiscovery) => boolean;
    /** Whether a discovery a realm holds widens the provinces its warnings reach to two steps from its own; the runner
     *  asks whether any does (playerEvents, building the realm's report: plan P1-19ah; the set it widens is read by
     *  nothing, Parked). */
    readonly "a realm's discoveries widen the warnings it hears": (theEffect: TheEffectOfADiscovery) => boolean;
  };
  /** The start of a phase (plan P1-19's discoveries family: its row P1-19ag typed it). */
  readonly turnStart: {
    /** The share of the wounds his last fight cost him that a discovery a hero's realm holds dresses as the next phase
     *  begins; the runner gives the first effect's, or nothing if the realm holds none
     *  (startPhaseHealingSnapshotsAndStalledBattles, which rounds it and writes the line). */
    readonly "a realm's discoveries dress a fighter's wounds": (theEffect: TheEffectOfADiscovery) => number;
  };
  readonly turnEnd: {
    /** The unit a province raises into its garrison, or nothing (Early Winter, after the wages: plan P1-19's second
     *  slice, Choice 3, the effect returns what the turn must do, and the turn does it and writes the line). */
    readonly 'a province raises a unit': (facts: AProvinceAtTheTurnsEnd) => AUnitAProvinceRaises | null;
    /** What a held item adds to its realm's tax (Early Winter, after the provinces' own tax; the items' registry: the
     *  runner sums them over the realm's heroes, and capItemTaxGold caps the sum as before). */
    readonly "a hero's items add to the realm's tax": (theItem: AHeldCopysOwnNumbers) => WhatAnItemAddsToTheRealmsTax;
    /** The gold a discovery a realm holds adds to a province's tax, with its row's own ceiling, or nothing (its row
     *  names other provinces); the runner caps each effect and keeps its account (discTaxAdd, which Early Winter's
     *  collection and the views ask: plan P1-19ag). */
    readonly "a realm's discoveries add to a province's tax": (
      theEffect: TheEffectOfADiscovery,
      facts: AProvinceARealmsDiscoveriesMayTax,
    ) => WhatAnEffectPaysAndItsOwnCeiling | null;
    /** The gold a discovery adds to its realm's tax from the provinces' income, under the ceiling; the runner gives the
     *  first discovery's of the content (taxRecordsGold, which Early Winter and the report ask of a realm that holds
     *  one: whether it does, the runner below). */
    readonly "a realm's discoveries add to the realm's tax": (
      theEffect: TheEffectOfADiscovery,
      facts: TheIncomeTaxationRecordsAddsTo,
    ) => number;
    /** The interest a discovery a realm holds earns on its treasury, under the ceiling; the runner adds them (Early
     *  Winter, and the report's forecast). */
    readonly "a realm's discoveries earn interest": (
      theEffect: TheEffectOfADiscovery,
      facts: ATreasuryARealmsDiscoveriesMayEarnInterestOn,
    ) => number;
    /** The gold a discovery a realm holds cuts off a unit's wage, with its row's own ceiling, or nothing (it doesn't
     *  reach the unit); the runner cuts each in turn, never below 1g, and keeps its account (discUpkeepWage). */
    readonly "a realm's discoveries cut a unit's wage": (
      theEffect: TheEffectOfADiscovery,
      facts: AUnitWhoseWageARealmsDiscoveriesMayCut,
    ) => WhatAnEffectPaysAndItsOwnCeiling | null;
    /** The gold a discovery a realm holds cuts off a hero's wage, with its row's own ceiling, or nothing (it names
     *  other alignments); the runner cuts each in turn, never below 1g, and keeps its account (discHeroWage). */
    readonly "a realm's discoveries cut a hero's wage": (
      theEffect: TheEffectOfADiscovery,
      facts: AHeroWhoseWageARealmsDiscoveriesMayCut,
    ) => WhatAnEffectPaysAndItsOwnCeiling | null;
    /** The wage a discovery a realm holds lets no hero be paid above, with its row's own ceiling, or nothing (it
     *  writes none); the runner cuts a wage above it in turn, after the cuts, and keeps its account (discHeroWage). */
    readonly "a realm's discoveries cap a hero's wage": (
      theEffect: TheEffectOfADiscovery,
    ) => AWageCeilingAndItsOwnCeiling | null;
    /** The hit points a discovery a realm holds heals a wounded hero of it at the turn's end, or nothing (it is the
     *  king's alone); the runner adds them (the new turn's gardens, which heal him to his maximum and write the
     *  line). */
    readonly "a realm's discoveries heal the wounded": (
      theEffect: TheEffectOfADiscovery,
      facts: AHeroARealmsDiscoveriesMayHeal,
    ) => number | null;
    /** The rate the graves of a province a realm holds rot at under a discovery it holds, or nothing (its row writes
     *  none: the ground's own); the runner keeps the lowest (the new turn's graves, which roll each). */
    readonly "a realm's discoveries keep the graves": (theEffect: TheEffectOfADiscovery) => number | null;
    /** The chance a discovery a realm holds gives each company at its capital to train up a grade at the new turn; the
     *  runner gives the first effect's, or nothing if the realm holds none (the new turn's War Academy, which rolls). */
    readonly "a realm's discoveries promote the capital's armies": (theEffect: TheEffectOfADiscovery) => number;
  };
  /** An order's outcome a hero's item changes (plan P1-19's items family, Choice 1: its first row, P1-19o, typed it). */
  readonly orderOutcome: {
    /** Whether an item the spy carries makes his Spy order succeed without a roll (resolveSpyOrder; the items'
     *  registry). */
    readonly "a spy's sure success": () => boolean;
    /** Whether an item the explorer carries reveals one more lair of the province the map hasn't reached
     *  (resolveExploreOrder, after the province's own finds: the order draws which, as before; the items' registry). */
    readonly 'a lair revealed when exploring': () => boolean;
    /** The hit points an item the resting hero carries adds to his heal (resolveRestOrder, after the discoveries'; the
     *  items' registry: the runner adds each effect once, however many of its items he carries). */
    readonly "a rest's heal": (facts: AHeroAtRest) => number;
    /** The share of a province a held item explores more as its bearer moves in (resolveMoveOrder, with his Explorer
     *  skill's; the items' registry: the runner adds every item's). */
    readonly "a move's exploration": (theItem: AHeldCopysOwnNumbers) => number;
    /** The power a held item works when it is used (resolveUseItemOrder; the bots' plan, botItemPre, to choose it;
     *  processOrder, which makes a spell charm's Use Item a Cast Spell order; the items' registry). */
    readonly "an item's power used": () => ThePowerAnItemWorksWhenUsed;
    /** Whether an item the caster carries makes the cast of a spell sure (resolveCastSpellOrder, before the cast chance:
     *  plan P1-19y; the items' registry: any of his items, in the stage's order). */
    readonly "a spell's cast cannot fail": (facts: ASpellAboutToBeCast) => boolean;
    /** The share a discovery a spy's realm holds adds to his chance, or nothing (it names other ground); the runner
     *  adds them (resolveSpyOrder, both his rolls; the report's odds, where no province is named: plan P1-19ad). */
    readonly "a realm's discoveries add to a spy's chance": (
      theEffect: TheEffectOfADiscovery,
      facts: WhereASpyActsAsARealmsDiscoveriesReadIt,
    ) => number | null;
    /** The share a discovery the realm that holds the province spied on takes off a rival spy's chance, or nothing; the
     *  runner adds them (resolveSpyOrder, a province of another realm's: its scope as before, Parked). */
    readonly "a realm's discoveries cut a rival spy's chance": (
      theEffect: TheEffectOfADiscovery,
      facts: WhereASpyActsAsARealmsDiscoveriesReadIt,
    ) => number | null;
    /** The share a discovery a spy's realm holds adds to his chance to read a hero beside him, or nothing; the runner adds
     *  them (resolveSpyOrder). */
    readonly "a realm's discoveries add to spying on a hero": (
      theEffect: TheEffectOfADiscovery,
      facts: WhereASpyActsAsARealmsDiscoveriesReadIt,
    ) => number | null;
    /** The points a discovery the realm of a hero spied on adds to his chance to catch the spy, or nothing; the runner
     *  adds them (resolveSpyOrder, before the chance's bounds). */
    readonly "a realm's discoveries add to catching a spy": (
      theEffect: TheEffectOfADiscovery,
      facts: WhereASpyActsAsARealmsDiscoveriesReadIt,
    ) => number | null;
    /** The chance, as its row writes it (a share), that a discovery a spy's realm holds keeps his success from raising
     *  the alarm; the runner gives the first effect's, or nothing (resolveSpyOrder, which rolls). */
    readonly "a realm's discoveries keep a spy's success quiet": (theEffect: TheEffectOfADiscovery) => number;
    /** The factor a discovery an explorer's realm holds multiplies what he maps by, or nothing (it names other
     *  ground); the runner multiplies them (resolveExploreOrder, and discExploreMult, which the report ships). */
    readonly "a realm's discoveries add to exploring": (
      theEffect: TheEffectOfADiscovery,
      facts: TheGroundAHeroWorks,
    ) => number | null;
    /** The turns a discovery a hero's realm holds adds to the service of the beasts the Wild Hunt binds; the runner adds
     *  them (resolvePerformRiteOrder). */
    readonly "a realm's discoveries lengthen the wild hunt": (theEffect: TheEffectOfADiscovery) => number;
    /** The share a discovery a hero's realm holds adds to a cleared lair's gold, or nothing; the runner adds them
     *  (resolveSearchLairOrder). */
    readonly "a realm's discoveries add to a lair's gold": (
      theEffect: TheEffectOfADiscovery,
      facts: ALairsHoardARealmsDiscoveriesMayEnrich,
    ) => number | null;
    /** The chance a discovery a hero's realm holds adds of an extra find in a cleared lair, or nothing; the runner adds
     *  them (resolveSearchLairOrder, which rolls). */
    readonly "a realm's discoveries add to a lair's item": (
      theEffect: TheEffectOfADiscovery,
      facts: TheGroundAHeroWorks,
    ) => number | null;
    /** The points a discovery a scholar's realm holds adds to his chance of a discovery, or nothing (it names another
     *  field); the runner adds them (resolveResearchOrder; the report's odds). */
    readonly "a realm's discoveries add to research": (
      theEffect: TheEffectOfADiscovery,
      facts: AResearchARealmsDiscoveriesMayHelp,
    ) => number | null;
    /** The share a discovery a hero's realm holds adds to his chance to raise a skill by practice, or nothing (it
     *  names other skills); the runner adds them (resolvePracticeSkillOrder; the report's odds, every skill and each
     *  named). */
    readonly "a realm's discoveries add to practice": (
      theEffect: TheEffectOfADiscovery,
      facts: ASkillARealmsDiscoveriesMayDrill,
    ) => number | null;
    /** The hit points a discovery a resting hero's realm holds adds to his heal, or nothing; the runner adds them
     *  (resolveRestOrder, before the items'). */
    readonly "a realm's discoveries add to a rest's heal": (
      theEffect: TheEffectOfADiscovery,
      facts: WhereAHeroRestsAsARealmsDiscoveriesReadIt,
    ) => number | null;
    /** Whether a discovery a resting hero's realm holds restores every hit point he lacks (resolveRestOrder). */
    readonly "a realm's discoveries heal a resting hero in full": (theEffect: TheEffectOfADiscovery) => boolean;
    /** The consecrated provinces a discovery the crown holds adds to those it may hold at once, or nothing (the
     *  consecrator's White skill is short of its row's); the runner adds them (resolveConsecrateOrder: plan P1-19ae). */
    readonly "a realm's discoveries add to the consecrations a crown may hold": (
      theEffect: TheEffectOfADiscovery,
      facts: AConsecrationARealmsDiscoveriesMayAllow,
    ) => number | null;
    /** The quality a discovery a realm holds may raise a Call to Arms' company at, and its chance; the runner lists
     *  them, and the order rolls each chance in turn and takes the first quality that is one (resolveCallToArmsOrder). */
    readonly "a realm's discoveries raise a call to arms' quality": (
      theEffect: TheEffectOfADiscovery,
    ) => AQualityACallToArmsMayRaise;
    /** The gold a discovery a realm holds adds to the corpse-carters' cost (a cut is less than 0); the runner adds them
     *  (resolveHarvestTheFieldOrder, and the report's price). */
    readonly "a realm's discoveries cut the corpse-carters' cost": (theEffect: TheEffectOfADiscovery) => number;
    /** The gold a discovery a realm holds adds to a mercenary band's price, or nothing (it names another class of
     *  unit); the runner adds them (resolveRecruitArmiesOrder, and the report's price). */
    readonly "a realm's discoveries cut a company's price": (
      theEffect: TheEffectOfADiscovery,
      facts: AUnitARealmRaises,
    ) => number | null;
    /** A unit's price once a discovery a realm holds has changed it, or nothing (it doesn't reach the unit); the
     *  runner hands each effect the price so far (realmRecruitCost, which the order and the report's prices ask). */
    readonly "a realm's discoveries cut a unit's price": (
      theEffect: TheEffectOfADiscovery,
      facts: AUnitARealmRecruitsAndItsPriceSoFar,
    ) => number | null;
    /** The share a discovery a realm holds adds to the chance a unit recruited starts a grade higher, or nothing; the
     *  runner adds them (discRecruitQChance, which resolveRecruitArmiesOrder asks before it rolls). */
    readonly "a realm's discoveries raise a recruit's quality": (
      theEffect: TheEffectOfADiscovery,
      facts: AUnitARealmRaises,
    ) => number | null;
    /** The share of the province's tax a discovery the caster's realm holds adds to a Bless; the runner adds them
     *  (workBlessProvince). */
    readonly "a realm's discoveries add to a Bless": (theEffect: TheEffectOfADiscovery) => number;
  };
  /** A hero's own figures a hero's item changes (plan P1-19's items family, Choice 1: its first row, P1-19p, typed it). */
  readonly aHerosStanding: {
    /** The hit points a held item adds to its bearer's maximum (itemMaxHpBonus, and applyItemMaxHp to know whether
     *  an item granted or lost changes it; the items' registry: the runner counts two copies of one name once). */
    readonly 'maximum HP': (theItem: AHeldCopysOwnNumbers) => number;
    /** The temper a held item makes its bearer fight with in personal combat, over his own, or nothing (effTemper;
     *  the items' registry: the first of his items that gives one). */
    readonly 'the temper he fights with': (theItem: AHeldCopysOwnNumbers) => string | null;
    /** The aura a held item spreads over its bearer's realm's heroes in his province, him too, or nothing
     *  (skillBonusBreakdown, after a hero's items and curses; the items' registry: the first such bearer among the
     *  heroes, his first such effect). */
    readonly "a skill's aura in the province": () => TheAuraAnItemSpreads | null;
    /** The percentage points a discovery the caster's realm holds adds to his chance to cast, or nothing (the
     *  discoveries' registry: plan P1-19aa, the runner adds them). */
    readonly "a realm's discoveries add to a caster's chance": (
      theEffect: TheEffectOfADiscovery,
      facts: ACastARealmsDiscoveriesMayHelp,
    ) => number | null;
    /** The hit points a discovery a hero's realm holds adds to his maximum, or nothing (it names the king, the heroes or
     *  a skill he isn't or hasn't); the runner adds them (discMaxHpFor: plan P1-19ag). */
    readonly "a realm's discoveries add to maximum HP": (
      theEffect: TheEffectOfADiscovery,
      facts: AHeroWhoseMaximumHpARealmsDiscoveriesMayRaise,
    ) => number | null;
  };
  /** A fighter in a personal combat (plan P1-19's items family, Choice 1: its first row, P1-19q, typed it). A guardian's
   *  perks reach the same effects at "what a fighter wears" as a hero's items: one applier for both (pcApplyFx). */
  readonly personalCombat: {
    /** What a ward he puts on sets in the wards he wears, from the wards so far (pcArmourMerge: his armour, an item's
     *  rider or a guardian's perk; the items' registry: the effect of the ward's own kind). */
    readonly 'what a fighter wears: a ward': (
      theWard: AWardAsTheMergeReadsIt,
      theWardsSoFar: Readonly<TheWardsAFighterWears>,
    ) => WhatAWardSets;
    /** What a rider he puts on sets in the riders he wears, from the riders so far (pcApplyFx, after the rider's ward;
     *  the items' registry: each rider carried, above 0, in the stage's order). */
    readonly 'what a fighter wears: a rider': (
      theRiders: TheRidersAFighterWears,
      theRidersSoFar: TheRidersAFighterWears,
    ) => TheRidersAFighterWears;
    /** Whether a held item makes its bearer fight in Mithril (pcCharCombatant's flag, which the fight reads; the items'
     *  registry). */
    readonly 'what a fighter wears: Mithril': () => boolean;
    /** What the wards he wears take off a blow's or an arrow's chance to hit him (pcHitChance, pcArrowHitChance:
     *  after the unseen, before the discoveries; plan P1-19r wrote the rest of these stages). */
    readonly "a blow's chance to hit": (theWards: TheWardsAsTheirEffectsReadThem) => number;
    /** What a ward does to a hit on him before all else (pcTakeHit, after a mirror image: the stage's order is the
     *  code's), or nothing. */
    readonly 'a hit lands on a fighter: before all else': (
      theHit: AHitAsAFightersWardsMeetItFirst,
    ) => WhatAWardDoesToAHitFirst | null;
    /** What a ward cuts off a hit on him (pcTakeHit, after his nature, his temper and his perks, before the damage
     *  floor), or nothing. */
    readonly 'a hit lands on a fighter: his wards cut it': (
      theHit: AHitAsAFightersWardsCutIt,
    ) => WhatAWardCutsOffAHit | null;
    /** A ward's ceiling on a hit that would bite deeper (pcTakeHit, after the damage floor), or nothing. */
    readonly 'a hit lands on a fighter: his wards cap it': (
      theHit: AHitAsAFightersWardsCapIt,
    ) => AWardsCapOnAHit | null;
    /** The hit points a ward gives back once the hit is dealt (pcTakeHit), or nothing. */
    readonly 'a hit lands on a fighter: after it': (
      theFighter: AFighterAsHisWardsMeetHimAfterAHit,
    ) => TheHpAWardGivesBack | null;
    /** What a ward bites back with at whoever lands a melee blow on him (pcMeleeStrike, once the blow deals damage), or
     *  nothing. */
    readonly 'a blow lands': (theWards: TheWardsAsTheirEffectsReadThem) => TheHarmAWardBitesBackWith | null;
    /** What a ward does as a round starts (pcRoundStart): the fields it sets. */
    readonly 'a round starts': (theWards: TheWardsAsTheirEffectsReadThem) => WhatAFightersWardsDoAsARoundStarts;
    /** Whether a ward refuses a stun, or a guardian's terror, outright (pcStunWard, pcMonsterSpecial). */
    readonly 'a stun or a terror takes hold': (theWards: TheWardsAsTheirEffectsReadThem) => boolean;
    /** The percentage a ward cuts a spell's burn by (pcCastCombatSpell's Fireball: the burn ticks outside pcTakeHit),
     *  or nothing. */
    readonly "a spell's burn takes hold": (theWards: TheWardsAsTheirEffectsReadThem) => number | undefined;
    /** The aura's penalty his foe carries once his aura is laid on him, or nothing (no aura worn); the fight opens
     *  (resolvePersonalCombat, each fighter in turn: plan P1-19ak wrote this stage and the five after it, each holding
     *  one rider's effect, a guardian's perk of the same rider's too). */
    readonly "the fight opens: a fighter's aura hinders his foe": (
      facts: AFightersAuraAsTheFightOpens,
    ) => number | null;
    /** What the aura laid on a striker takes off his blow's or his arrow's chance to hit (pcHitChance,
     *  pcArrowHitChance: after his other penalties, before his bonus). */
    readonly "a blow's or an arrow's chance to hit: the aura's penalty": (
      theStrikersMarks: AStrikersMarksAsHisChanceToHitReadsThem,
    ) => number;
    /** What a striker's bonus to hit adds to his blow's or his arrow's chance (pcHitChance, pcArrowHitChance: after the
     *  aura's penalty, before the foe's wards). */
    readonly "a blow's or an arrow's chance to hit: his bonus": (
      theStrikersMarks: AStrikersMarksAsHisChanceToHitReadsThem,
    ) => number;
    /** The damage a striker's rider adds to a melee blow (pcMeleeDamage, after his items'; a guardian's special
     *  multiplies the blow, this with it), 0 for none. */
    readonly "a blow's damage: his bonus": (theRiders: TheRidersAFighterWears) => number;
    /** The harm a fighter's burn sears his foe with as a melee round starts (resolvePersonalCombat, at melee range,
     *  each fighter in turn, both standing), or nothing. */
    readonly 'a melee round: his burn': (theRiders: TheRidersAFighterWears) => TheHarmAFightersBurnSearsWith | null;
    /** What a striker's drain drinks of the wound his melee blow dealt (pcMeleeStrike), or nothing. */
    readonly 'a blow lands: his drain': (theBlow: ABlowAsTheStrikersDrainMeetsIt) => WhatAStrikersDrainDrinks | null;
    /** His bonus to hit once a combat item adds its own (pcUseCombatItem's focus: the Elixir of Focus and kin). */
    readonly 'a combat item adds to his bonus to hit': (facts: ABonusToHitACombatItemAdds) => number;
    /** Whether a fighter reaches for a combat item now (pcCombatItemWanted, asked by pcTryCombatItem in the stage's
     *  order, the item's use's: plan P1-19s wrote this stage and the five after it). */
    readonly 'a fighter reaches for a combat item': (
      theItem: ACombatItemsOwnNumbers,
      theMoment: AMomentAsAFighterWeighsACombatItem,
    ) => boolean;
    /** What a combat item does when used (pcUseCombatItem: its use's effect). */
    readonly 'a combat item is used': (theItem: ACombatItemAsItsUseReadsIt) => WhatACombatItemDoes;
    /** What a combat item's blow is multiplied by against a foe of the kind given (pcUseCombatItem, each blow, after
     *  its draw), or nothing. */
    readonly "a combat item's blow lands": (theItem: ACombatItemsOwnNumbers, theFoesKind: string) => number | null;
    /** What an item of a lair's hoard does for the guardian who wields it (pcBuildGuardian). */
    readonly 'a guardian wields its hoard': (theItem: AHeldCopysOwnNumbers) => WhatAHoardsItemDoesForItsGuardian;
    /** The percentage points an item a thief carries adds to his chance to steal (pcAct's theft, after his skill and
     *  his temper, before the guardian's grade). */
    readonly "a steal's chance": () => number;
    /** The damage an item its bearer strikes with adds to a melee blow he lands (pcMeleeDamage, after a halving, before
     *  a guardian's perk). */
    readonly "a blow's damage": () => number;
    /** What a combat spell does once its cast takes hold (pcCastCombatSpell: the spells' registry; one spell a cast,
     *  found by its name): its steps, in order (plan P1-19w). */
    readonly 'a combat spell takes hold': (facts: ACombatSpellTakingHold) => readonly AStepOfACombatSpell[];
    /** The percentage points a spell a thief has cast in the fight adds to his chance to steal (pcAct's theft, after his
     *  temper, before his items: plan P1-19x). */
    readonly "a fighter's spell adds to his steal": () => number;
    /** The chance a mirror image's victim sees through it this round (resolvePersonalCombat; the spells' registry: plan
     *  P1-19x). */
    readonly 'a mirror image is disbelieved': (facts: AMirrorImageItsVictimMaySeeThrough) => number;
    /** What a hero's item changes in his combat spells (pcCastCombatSpell, through the stage above; the items'
     *  registry: the first of his items, in the stage's order, that changes each). */
    readonly "a hero's items change his combat spell": () => TheChangeAnItemMakesToACombatSpell;
    /** The percentage points a discovery a fighter's realm holds adds to his chance to hit the foe, or nothing (it
     *  names another kind of foe); the runner adds them (pcHitChance and pcArrowHitChance, after the wards: plan
     *  P1-19ac). */
    readonly "a realm's discoveries steady a fighter's aim": (
      theEffect: TheEffectOfADiscovery,
      facts: AFoeARealmsDiscoveriesSteadyAFightersAimAt,
    ) => number | null;
    /** The levels a discovery a hero's realm holds adds to his Melee and his Archery in a personal combat; the runner
     *  gives the first effect's, or 0 if the realm holds none (pcCharCombatant, and extraSkillBonuses for his card). */
    readonly "a realm's discoveries add to a fighter's skills": (theEffect: TheEffectOfADiscovery) => number;
    /** The damage a discovery a hero's realm holds adds to what his Mithril turns aside of a melee blow; the runner
     *  adds them (pcCharCombatant, after the suit's own). */
    readonly "a realm's discoveries strengthen his Mithril": (theEffect: TheEffectOfADiscovery) => number;
    /** The approach a guardian's perk turns on his card, or nothing; the runner gathers them over his perks, and
     *  monsterTraits keeps each hidden multiplier of an approach turned at 1 or below (the guardian perks' registry:
     *  plan P1-19ai). */
    readonly "a guardian's perks: what his card turns": (
      thePerk: APerkAsAGuardiansCardReadsIt,
    ) => AnApproachAGuardiansCardMayTurn | null;
    /** What a guardian's grade's cap does to the wards his perks gave him, or nothing (his grade gives none); the
     *  runner gives the first effect's (pcMonsterCombatant, once his perks are on him: plan P1-19ai). */
    readonly "a guardian's perks: his grade's cap beside his own": (
      facts: AGuardiansGradesCapAndTheWardsHisPerksGaveHim,
    ) => WhatAGuardiansGradesCapDoes | null;
    /** What a guardian's perk's own ward (one no item carries) sets in the wards he wears, from the wards so far
     *  (pcArmourMerge, asked after the items' registry finds no effect of the ward's kind: plan P1-19aj); the runner
     *  asks the effect of the ward's own kind. */
    readonly "a guardian's perks: what he wears: a ward of his own": (
      theWard: AWardAsTheMergeReadsIt,
      theWardsSoFar: Readonly<TheWardsAFighterWears>,
    ) => WhatAWardSets;
    /** The chance his perks turn a stun as it lands, and the ward the line names (pcStunWard, beside his items'
     *  refusal; pcStunTurned's line: plan P1-19aj). The stage holds one effect. */
    readonly "a guardian's perks: a stun takes hold": (
      theWards: TheWardsAsTheirEffectsReadThem | null | undefined,
    ) => AGuardiansStunWard;
    /** What his perks do as a round starts, beside his items (pcRoundStart: plan P1-19aj): the fields each sets. */
    readonly "a guardian's perks: a round starts": (
      facts: AFightersWardsAsAGuardiansPerksMeetARound,
    ) => WhatAGuardiansPerksDoAsARoundStarts;
    /** The share of each tick of a lingering harm his perks turn, and the ward the line names (pcRoundStart, every
     *  fighter: plan P1-19aj). The stage holds one effect. */
    readonly "a guardian's perks: a lingering harm bites": (
      theWards: TheWardsAsTheirEffectsReadThem | null | undefined,
    ) => AGuardiansLingeringHarmWard;
    /** What a guardian's ward against a spell's school does to its cast (pcCastCombatSpell: plan P1-19aj). The stage
     *  holds one effect. */
    readonly "a guardian's perks: a combat spell's chance: a ward against its school": (
      facts: ACastAsAGuardiansWardAgainstItsSchoolMeetsIt,
    ) => WhatAWardAgainstASchoolDoesToACast;
  };
  /** The treasury (plan P1-19's items family, Choice 1: its first row, P1-19t, typed it): what an item is for and what
   *  it is worth, read as the engine loads (the load-time pass tiers each item by them, so which lairs hold it) and by a
   *  bot choosing what to carry. */
  readonly treasury: {
    /** The role an item's effect gives it (itemRole, before the skills' and its riders'). */
    readonly "an item's role": () => TheRoleOfAnItem;
    /** What an item's effect is worth, by its kind (itemPowerScore, before its riders'; a skill's item is generic). */
    readonly "an item's worth": (
      theEffect: AnEffectAsTheTreasuryWeighsIt,
      theWorthOfItsParts: TheWorthOfAnItemsParts,
    ) => number;
    /** What a combat item's use is worth (_useScore). */
    readonly "an item's worth: a combat use": (theEffect: AnEffectAsTheTreasuryWeighsIt) => number;
    /** What a ward is worth, an armour's or a rider's (_wardScore). */
    readonly "an item's worth: a ward": (theWard: AWardAsTheTreasuryWeighsIt) => number;
    /** What a rider is worth (_pcScore: each rider in the stage's order, before the rider's ward). */
    readonly "an item's worth: a rider": (theRiders: TheRidersAsTheTreasuryWeighsThem) => number;
  };
}

/** The thirteen hook points. */
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
  'relentless-hunt': {
    strength: { 'the whole force': THE_STRENGTH_OF_A_UNIT_IN_ITS_FORCE['relentless-hunt'] },
    fate: { 'the winner runs the beaten down': THE_WINNER_RUNS_THE_BEATEN_DOWN['relentless-hunt'] },
  },
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
  'flak-screen': {
    strength: { 'a flyer is harried before the battle': A_FLYER_IS_HARRIED_BEFORE_THE_BATTLE['flak-screen'] },
  },
  'breach-and-swamp': {
    fate: { 'a hull is sunk before the battle': A_HULL_IS_SUNK_BEFORE_THE_BATTLE['breach-and-swamp'] },
  },
  'shield-fort': { fate: { 'the beaten force holds': THE_BEATEN_FORCE_HOLDS['shield-fort'] } },
  'deep-halls': { fate: { 'the beaten force holds': THE_BEATEN_FORCE_HOLDS['deep-halls'] } },
  'ride-them-down': {
    fate: { 'the winner runs the beaten down': THE_WINNER_RUNS_THE_BEATEN_DOWN['ride-them-down'] },
  },
  'run-them-down': {
    fate: { 'the winner runs the beaten down': THE_WINNER_RUNS_THE_BEATEN_DOWN['run-them-down'] },
  },
  'feeding-frenzy': {
    fate: { 'the winner runs the beaten down': THE_WINNER_RUNS_THE_BEATEN_DOWN['feeding-frenzy'] },
  },
  'cut-the-line': { fate: { 'a force holds the sea lanes': A_FORCE_HOLDS_THE_SEA_LANES['cut-the-line'] } },
  'keep-the-sea-lanes': { fate: { 'a force holds the sea lanes': A_FORCE_HOLDS_THE_SEA_LANES['keep-the-sea-lanes'] } },
  'raiders-muster': { turnEnd: { 'a province raises a unit': A_PROVINCE_RAISES_A_UNIT['raiders-muster'] } },
} satisfies Record<UnitAbilitySlug, UnitAbilityEntry>;

/** Each stage's order: the entries with an effect at the stage, each once, in the order they run (the battle code's
 *  order before the registry took them). */
export const THE_ORDER_OF_EACH_STAGE = {
  strength: {
    'a flyer is harried before the battle': ['flak-screen'],
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
    'a hull is sunk before the battle': ['breach-and-swamp'],
    'the beaten force holds': ['shield-fort', 'deep-halls'],
    'the winner runs the beaten down': ['ride-them-down', 'run-them-down', 'relentless-hunt', 'feeding-frenzy'],
    'a beaten unit fails its death roll': ['regenerating-hide'],
    'a beaten unit fails its demotion roll': ['knightly-example'],
    'a force holds the sea lanes': ['cut-the-line', 'keep-the-sea-lanes'],
  },
  turnEnd: {
    'a province raises a unit': ['raiders-muster'],
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
const A_FLYER_IS_HARRIED_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_STRENGTH['a flyer is harried before the battle'],
  (entry) => entry.strength?.['a flyer is harried before the battle'],
);
const A_HULL_IS_SUNK_BY_UNIT = theEffectsOfEachUnitAt(
  THE_ORDER_OF_FATE['a hull is sunk before the battle'],
  (entry) => entry.fate?.['a hull is sunk before the battle'],
);
type TheBeatenForceHoldsEffect = TheStagesOfEachHookPoint['fate']['the beaten force holds'];
/** The effects of "the beaten force holds", in the stage's order (each looks for its unit in the force). */
const THE_BEATEN_FORCE_HOLDS_EFFECTS = THE_ORDER_OF_FATE['the beaten force holds'].flatMap((slug) => {
  const effect = ENTRIES[slug].fate?.['the beaten force holds'];
  return effect ? [effect] : [];
}) satisfies readonly TheBeatenForceHoldsEffect[];
type TheWinnerRunsTheBeatenDownEffect = TheStagesOfEachHookPoint['fate']['the winner runs the beaten down'];
/** The effects of "the winner runs the beaten down", in the stage's order (each looks for its unit in the force). */
const THE_WINNER_RUNS_THE_BEATEN_DOWN_EFFECTS = THE_ORDER_OF_FATE['the winner runs the beaten down'].flatMap((slug) => {
  const effect = ENTRIES[slug].fate?.['the winner runs the beaten down'];
  return effect ? [effect] : [];
}) satisfies readonly TheWinnerRunsTheBeatenDownEffect[];
type AForceHoldsTheSeaLanesEffect = TheStagesOfEachHookPoint['fate']['a force holds the sea lanes'];
/** The effects of "a force holds the sea lanes", in the stage's order (each looks for its unit in the force). */
const A_FORCE_HOLDS_THE_SEA_LANES_EFFECTS = THE_ORDER_OF_FATE['a force holds the sea lanes'].flatMap((slug) => {
  const effect = ENTRIES[slug].fate?.['a force holds the sea lanes'];
  return effect ? [effect] : [];
}) satisfies readonly AForceHoldsTheSeaLanesEffect[];
type AProvinceRaisesAUnitEffect = TheStagesOfEachHookPoint['turnEnd']['a province raises a unit'];
/** The effects of "a province raises a unit", in the stage's order. */
const A_PROVINCE_RAISES_A_UNIT_EFFECTS = THE_ORDER_OF_EACH_STAGE.turnEnd['a province raises a unit'].flatMap((slug) => {
  const effect = ENTRIES[slug].turnEnd?.['a province raises a unit'];
  return effect ? [effect] : [];
}) satisfies readonly AProvinceRaisesAUnitEffect[];
const NO_EFFECTS: readonly never[] = [];

/** A multiplier, and each ability that moved it, in order, as the strength ladder names it. */
export interface AMultiplierAndTheAbilitiesThatMovedIt {
  multiplier: number;
  readonly abilities: AnAbilityAsTheLadderNamesIt[];
}

/** Runs a stage's effects in order on the multiplier so far, and adds each ability that acts. */
function runOnTheMultiplier<Facts>(
  effects: readonly AnEffectOnTheMultiplierSoFar<Facts>[],
  facts: Facts,
  soFar: AMultiplierAndTheAbilitiesThatMovedIt,
): void {
  for (const effect of effects) {
    const moved = effect(facts, soFar.multiplier);
    if (!moved) continue;
    soFar.multiplier = moved.multiplier;
    soFar.abilities.push(moved.ability);
  }
}

/** The runner of abilityFront's two stages: from the role matchup's multiplier, what the unit does to the unit it
 *  meets, then what the unit it meets does to it, each in its stage's order. */
export function theStrengthOfAUnitMeetingAnother(
  facts: AUnitMeetingAnother,
  theRoleMatchup: number,
): AMultiplierAndTheAbilitiesThatMovedIt {
  const soFar: AMultiplierAndTheAbilitiesThatMovedIt = { multiplier: theRoleMatchup, abilities: [] };
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
  const soFar: AMultiplierAndTheAbilitiesThatMovedIt = { multiplier: theRolesMultiplier, abilities: [] };
  runOnTheMultiplier(WHAT_A_SHOOTER_DOES_BY_UNIT.get(facts.theShooter.unitType) ?? NO_EFFECTS, facts, soFar);
  runOnTheMultiplier(WHAT_THE_TARGET_DOES_BY_UNIT.get(facts.theTarget.unitType) ?? NO_EFFECTS, facts, soFar);
  return soFar;
}

/** The runner of "held when hit from the side" (battleFaceSide): the slug of the first of the unit's abilities that
 *  holds it, in the stage's order, or nothing (it is hit from the side). */
export function theAbilityThatHoldsAUnitHitFromTheSide(facts: AUnitAtAWrappedEnd): UnitAbilitySlug | null {
  for (const effect of HELD_BY_UNIT.get(facts.theUnit.unitType) ?? NO_EFFECTS) {
    const slug = effect(facts);
    if (slug !== null) return slug;
  }
  return null;
}

/** The runner of "beside and behind it in the front line" (battleFaceSide): from the multiplier so far, the unit's
 *  effects in the stage's order. */
export function theStrengthOfAUnitBesideAndBehindOthers(
  facts: AUnitBesideAndBehindOthers,
  theMultiplierSoFar: number,
): AMultiplierAndTheAbilitiesThatMovedIt {
  const soFar: AMultiplierAndTheAbilitiesThatMovedIt = { multiplier: theMultiplierSoFar, abilities: [] };
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

/** The runner of "turns an anchored line" (battleFaceSide): the slug of the first ability, in the stage's order, by
 *  which the free enemy riders turn an anchored line, or nothing. */
export function theAbilityThatTurnsAnAnchoredLine(facts: TheFreeEnemyRiders): UnitAbilitySlug | null {
  for (const effect of TURNS_AN_ANCHORED_LINE_EFFECTS) {
    const slug = effect(facts);
    if (slug !== null) return slug;
  }
  return null;
}

/** The runner of "what a flyer does" (battleFaceSide): from ×1, the flyer's effects in the stage's order. */
export function theStrengthOfAFlyer(facts: AFlyerAndTheEnemysFlyers): AMultiplierAndTheAbilitiesThatMovedIt {
  const soFar: AMultiplierAndTheAbilitiesThatMovedIt = { multiplier: 1, abilities: [] };
  runOnTheMultiplier(WHAT_A_FLYER_DOES_BY_UNIT.get(facts.theFlyer.unitType) ?? NO_EFFECTS, facts, soFar);
  return soFar;
}

/** The runner of "a beaten unit fails its death roll" (rollUnitFates): the fate (a slug, P1-12d27) of the first of the
 *  unit's abilities, in the stage's order, by which it lives, or nothing (it dies). An effect that rolls draws its die only when it runs,
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

/** The runner of "a beaten unit fails its demotion roll" (rollUnitFates): the fate (a slug, P1-12d27) of the first
 *  ability reaching the unit, in the stage's order, by which it holds its tier, or nothing (it loses one). */
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

/** The runner of "strength: its place in the line" (battleRegrid): the multiplier the first of the unit's abilities,
 *  in the stage's order, gives its place, and the ability, or nothing (the line's own). */
export function theMultiplierOfAUnitsPlaceInTheLine(facts: AUnitInItsLine): AMultiplierAndTheAbilityThatSetIt | null {
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

/** The runner of "strength: a flyer is harried before the battle" (applyFlakScreen): the flyer the first of the unit's
 *  abilities, in the stage's order, harries, and the strength it loses, or nothing. An effect draws its dice only when
 *  it runs, so a unit with no such ability draws none. */
export function theFlyerAUnitHarriesBeforeTheBattle(facts: AUnitAndTheEnemyFlyersNotYetHarried): AFlyerHarried | null {
  for (const effect of A_FLYER_IS_HARRIED_BY_UNIT.get(facts.unitType) ?? NO_EFFECTS) {
    const harried = effect(facts);
    if (harried !== null) return harried;
  }
  return null;
}

/** The runner of "fate: a hull is sunk before the battle" (both battles): the place, among the enemy's hulls afloat, of
 *  the hull the first of the unit's abilities, in the stage's order, sinks, or nothing. An effect draws its dice only
 *  when it runs, so a unit with no such ability draws none. */
export function theHullAUnitSinksBeforeTheBattle(facts: AUnitAndTheEnemyHullsAfloat): number | null {
  for (const effect of A_HULL_IS_SUNK_BY_UNIT.get(facts.unitType) ?? NO_EFFECTS) {
    const sunk = effect(facts);
    if (sunk !== null) return sunk;
  }
  return null;
}

/** The runner of "fate: the beaten force holds" (shieldFortHolds): whether any ability, in the stage's order, holds the
 *  beaten force (it never routs). */
export function theBeatenForceHolds(facts: ABeatenForceAndItsFrontLine): boolean {
  return THE_BEATEN_FORCE_HOLDS_EFFECTS.some((effect) => effect(facts));
}

/** The runner of "fate: the winner runs the beaten down" (pursuitsOfTheBeaten): the pursuit of each ability of the
 *  winning force that makes one, in the stage's order. */
export function thePursuitsOfTheBeaten(facts: AWinningForceOnItsGround): readonly APursuitOfTheBeaten[] {
  const pursuits: APursuitOfTheBeaten[] = [];
  for (const effect of THE_WINNER_RUNS_THE_BEATEN_DOWN_EFFECTS) {
    const pursuit = effect(facts);
    if (pursuit !== null) pursuits.push(pursuit);
  }
  return pursuits;
}

/** The runner of "fate: a force holds the sea lanes" (both battles' retreat): whether any ability, in the stage's order,
 *  holds them for the force in its battle. */
export function aForceHoldsTheSeaLanes(facts: AForceInItsBattle): boolean {
  return A_FORCE_HOLDS_THE_SEA_LANES_EFFECTS.some((effect) => effect(facts));
}

/** The runner of "turnEnd: a province raises a unit" (Early Winter): the unit each ability raises in the province, in
 *  the stage's order. The turn names each, adds it to the garrison and writes the line. */
export function theUnitsAProvinceRaisesAtTheTurnsEnd(facts: AProvinceAtTheTurnsEnd): readonly AUnitAProvinceRaises[] {
  const raised: AUnitAProvinceRaises[] = [];
  for (const effect of A_PROVINCE_RAISES_A_UNIT_EFFECTS) {
    const unit = effect(facts);
    if (unit !== null) raised.push(unit);
  }
  return raised;
}
