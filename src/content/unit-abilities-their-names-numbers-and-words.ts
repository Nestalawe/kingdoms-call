// The unit abilities the rule registry holds (plan P1-19, Decision 3): one row per ability, keyed by its slug, with its
// unit, its name as the books write it, its numbers each with how the books write it, and the units it reaches or counts
// when more than its own. The registry (src/engine/rules/the-registry-of-content-effects.ts) has one entry for each row
// and no other: a row with no entry, or an entry with no row, fails to compile. A row exists only for an effect the
// registry holds, so no row waits for its code. Change a number here, and the books with it: tests/static/
// each-unit-abilitys-name-and-numbers-are-in-both-books.test.ts reads every row against the unit's blurb in the player
// portal and its roster row in the rulebook.
import type { UnitType } from './kingdoms-call-data.ts';

/** How the books write a number: a multiplier as `×1.25`; a fraction added as `+10%` (0.1). */
export type HowTheBooksWriteANumber = 'a multiplier' | 'a fraction added';

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
}

/** The unit abilities the registry holds, in the order the battle code meets them: today, the strength of a unit in
 *  its whole force (plan P1-19a; the battle line, facing and fates join row by row). */
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
} as const satisfies Record<string, AUnitAbilityAsTheBooksWriteIt>;

/** The slug of an ability the registry holds. */
export type UnitAbilitySlug = keyof typeof UNIT_ABILITIES_THE_REGISTRY_HOLDS;
