// The unit abilities the rule registry holds (plan P1-19, Decision 3): one row per ability, keyed by its slug, with its
// unit, its name as the books write it, its numbers each with how the books write it, and the units it reaches or counts
// when more than its own. The registry (src/engine/rules/the-registry-of-content-effects.ts) has one entry for each row
// and no other: a row with no entry, or an entry with no row, fails to compile. A row exists only for an effect the
// registry holds, so no row waits for its code. Change a number here, and the books with it: tests/static/
// each-unit-abilitys-name-and-numbers-are-in-both-books.test.ts reads every row against the unit's blurb in the player
// portal and its roster row in the rulebook.
import type { UnitType } from './kingdoms-call-data.ts';

/** How the books write a number: a multiplier as `×1.25`; a fraction added as `+10%` (0.1); full strength (×1, where
 *  others fight at less) as `no penalty`; a unit's base strength as `base strength 6`. */
export type HowTheBooksWriteANumber = 'a multiplier' | 'a fraction added' | 'no penalty' | 'a base strength';

/** One number of an ability, and how the books write it. */
export interface ANumberOfAnAbility {
  readonly value: number;
  readonly theBooksWriteIt: HowTheBooksWriteANumber;
}

/** A row: what the books and the registry's effect read of one ability. */
export interface AUnitAbilityAsTheBooksWriteIt {
  /** The unit that has it (its blurb and its roster row name it). */
  readonly unit: UnitType;
  /** Its name, as both books write it. */
  readonly name: string;
  /** Its numbers, by what each is for. */
  readonly numbers: Readonly<Record<string, ANumberOfAnAbility>>;
  /** The units of the force it counts (Sheer Numbers: the orc foot), when it counts the others in the force. */
  readonly counts?: readonly UnitType[];
  /** The units it reaches, when more than its own (Reaver Crews: every unit of the force the ships land). */
  readonly reaches?: 'every unit of the force';
  /** The grounds it acts on, when not every ground (a terrain's name: Woodland Skirmish, in forest and jungle). */
  readonly onTheGround?: readonly string[];
  /** Its words in the strength ladder, where they differ from its name (Spear Hedge, when Purity breaks it). */
  readonly wordsInTheLadder?: Readonly<Record<string, string>>;
}

/** The unit abilities the registry holds, in the order the battle code meets them: the strength of a unit in its
 *  whole force (plan P1-19a), then a unit meeting another or shooting over its line (P1-19b; the whole line and the
 *  fates join row by row). */
export const UNIT_ABILITIES_THE_REGISTRY_HOLDS = {
  // Orc: goblins are worth little alone and a great deal in a mob.
  'sheer-numbers': {
    unit: 'Goblin Horde',
    name: 'Sheer Numbers',
    numbers: {
      perOtherOrcFootUnit: { value: 0.1, theBooksWriteIt: 'a fraction added' },
      atMost: { value: 0.3, theBooksWriteIt: 'a fraction added' },
    },
    counts: ['Goblin Horde', 'Orc Berserkers', 'Orc Garrison'],
  },
  // Orc: troops put ashore by longships hit the beach at a run.
  'reaver-crews': {
    unit: 'Orcish Longships',
    name: 'Reaver Crews',
    numbers: { theForceTheyLand: { value: 0.25, theBooksWriteIt: 'a fraction added' } },
    reaches: 'every unit of the force',
  },
  // Sharks are worthless alone and deadly in numbers (as the goblins' Sheer Numbers).
  'shoal-swarm': {
    unit: 'Shark Shoals',
    name: 'Shoal Swarm',
    numbers: {
      perOtherShoal: { value: 0.1, theBooksWriteIt: 'a fraction added' },
      atMost: { value: 0.3, theBooksWriteIt: 'a fraction added' },
    },
    counts: ['Shark Shoals'],
  },
  'relentless-hunt': {
    unit: 'Manticore Pride',
    name: 'Relentless Hunt',
    numbers: { attacking: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'stone-deterrent': {
    unit: 'Basilisk Brood',
    name: 'Stone Deterrent',
    numbers: { defending: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'tidal-might': {
    unit: 'Sea Giants',
    name: 'Tidal Might',
    numbers: { inACoastalLandProvince: { value: 1.2, theBooksWriteIt: 'a multiplier' } },
  },
  'deepwater-grasp': {
    unit: 'Eldritch Kraken',
    name: 'Deepwater Grasp',
    numbers: { atSea: { value: 1.35, theBooksWriteIt: 'a multiplier' } },
  },
  wyrmscale: {
    unit: 'Elder Dragons',
    name: 'Wyrmscale',
    numbers: { inEveryBattle: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'air-superiority': {
    unit: 'Crimson Rocs',
    name: 'Air Superiority',
    numbers: { whenTheEnemyFieldsRangedUnits: { value: 1.3, theBooksWriteIt: 'a multiplier' } },
  },
  // ── A unit meeting another, or shooting over its line (plan P1-19b: abilityFront and abilityBack) ──
  // What a unit does to the unit it meets (a matchup that sets the multiplier, or one that multiplies it).
  halberds: {
    unit: 'Men-at-Arms',
    name: 'Halberds',
    numbers: { facingCavalry: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'lance-charge': {
    unit: 'Gilded Lances',
    name: 'Lance Charge',
    numbers: { facingFoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  frenzy: {
    unit: 'Orc Berserkers',
    name: 'Frenzy',
    numbers: { facingFoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  'wolves-panic-horses': {
    unit: 'Warg Riders',
    name: 'Wolves Panic Horses',
    numbers: { facingCavalry: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  // Its matchup; the flank slot it may hold stays in the grid (battleGrid).
  'stoop-on-the-horses': {
    unit: 'Eagle Riders',
    name: 'Stoop on the Horses',
    numbers: { facingCavalry: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  harriers: {
    unit: 'Free Lances',
    name: 'Harriers',
    numbers: { inAFlankDuel: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  'woodland-skirmish': {
    unit: 'Forest Wardens',
    name: 'Woodland Skirmish',
    numbers: { inTheWoods: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
    onTheGround: ['forest', 'jungle'],
  },
  bloodthirsty: {
    unit: 'Orc Garrison',
    name: 'Bloodthirsty',
    numbers: { defendingFacingFoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  // The beasts (2026-10-13, Creatures and Monsters V): the walking beasts' matchups, and the unicorns' Purity.
  maul: {
    unit: 'Great Bears',
    name: 'Maul',
    numbers: { facingFoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  trample: {
    unit: 'Mammoth Host',
    name: 'Trample',
    numbers: { facingFoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  'many-heads': {
    unit: 'Dread Hydras',
    name: 'Many Heads',
    numbers: { facingFoot: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  purity: {
    unit: 'Unicorn Herd',
    name: 'Purity',
    numbers: { facingMonstersAndSkeletons: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  // What the unit it meets does to it. 2026-10-12 (Toby): Purity breaks a Spear Hedge or a Boulder Wall: the Unicorn
  // Herd is never held to their cap.
  'spear-hedge': {
    unit: 'Shieldwall Levies',
    name: 'Spear Hedge',
    numbers: { cavalryFacingThemAtMost: { value: 0.75, theBooksWriteIt: 'a multiplier' } },
    wordsInTheLadder: { whenPurityBreaksIt: 'Purity breaks the Spear Hedge' },
  },
  'boulder-wall': {
    unit: 'Stone Giants',
    name: 'Boulder Wall',
    numbers: { cavalryFacingThemAtMost: { value: 0.75, theBooksWriteIt: 'a multiplier' } },
    wordsInTheLadder: { whenPurityBreaksIt: 'Purity breaks the Boulder Wall' },
  },
  unbreakable: {
    unit: 'Dwarven Guard',
    name: 'Unbreakable',
    numbers: { footFacingThem: { value: 0.85, theBooksWriteIt: 'a multiplier' } },
  },
  'stone-halls': {
    unit: 'Dwarf Garrison',
    name: 'Stone Halls',
    numbers: { footFacingItInTheMountains: { value: 0.9, theBooksWriteIt: 'a multiplier' } },
    onTheGround: ['mountain'],
  },
  'thorn-hedge': {
    unit: 'Elven Garrison',
    name: 'Thorn Hedge',
    numbers: { cavalryFacingItInTheWoods: { value: 0.85, theBooksWriteIt: 'a multiplier' } },
    onTheGround: ['forest', 'jungle'],
  },
  // What a shooter in the second line does to its target, the enemy front unit it shoots.
  'bodkin-points': {
    unit: 'Yeoman Longbows',
    name: 'Bodkin Points',
    numbers: { shootingCavalry: { value: 1, theBooksWriteIt: 'no penalty' } },
  },
  'volley-at-the-charge': {
    unit: 'Elven Bowmen',
    name: 'Volley at the Charge',
    numbers: { shootingCavalry: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  // Its matchup; its choice of target along the enemy front stays in the line (battleFaceSide).
  marksmen: {
    unit: 'Shadow Archers',
    name: 'Marksmen',
    numbers: { shootingArchers: { value: 1.25, theBooksWriteIt: 'a multiplier' } },
  },
  'armour-piercing': {
    unit: 'Ironwood Crossbows',
    name: 'Armour-Piercing',
    numbers: {
      shootingAStrongUnit: { value: 1.25, theBooksWriteIt: 'a multiplier' },
      aStrongUnitsBaseStrengthAtLeast: { value: 6, theBooksWriteIt: 'a base strength' },
    },
  },
  bombard: {
    unit: 'Mountain Guns',
    name: 'Bombard',
    numbers: { whateverTheyShoot: { value: 1.15, theBooksWriteIt: 'a multiplier' } },
  },
  // What the target does to the shooter.
  'arrow-fodder': {
    unit: 'Goblin Horde',
    name: 'Arrow Fodder',
    numbers: { archersShootingThem: { value: 0.75, theBooksWriteIt: 'a multiplier' } },
  },
} as const satisfies Record<string, AUnitAbilityAsTheBooksWriteIt>;

/** The slug of an ability the registry holds. */
export type UnitAbilitySlug = keyof typeof UNIT_ABILITIES_THE_REGISTRY_HOLDS;
