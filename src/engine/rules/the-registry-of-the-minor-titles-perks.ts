// The rule registry of the minor titles' perks (B-06, T7, the rules pulled out: its Reckoning and titles family, from
// row B-06i). A minor title is one row in src/content/ (its key, name, perk and requirement as players read them, and
// how its holder is found: the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts) and
// one entry here, keyed by the same slug, naming its perk's effect at each stage of a hook point. The hook points and
// their stages are the content effects' (one union, in the-registry-of-content-effects.ts); each stage's order is
// THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES. B-06i writes the skeleton: an entry for each title, at no stage yet (each
// perk is still checked where it acts, by the holders worked out at the turn's start: `charMinor` and its kin), and
// the measure a hero is held to for a title, which the awarding (computeMinorTitles) asks. The rows after it give each
// perk its effect, at the hook points TheHookPointsAMinorTitlesPerkActsAt names. How to add one:
// docs/architecture/the-minor-titles-registry-its-hook-points-and-how-to-add-a-perk.md.
import type {
  AMinorTitlesSlug,
  HowTheHolderOfAMinorTitleIsFound,
} from '../../content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import { theHighestLevelAHeroHasTrainedInAMagicSchool } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import {
  MINOR_CAV,
  MINOR_HEAVY,
  theTrainedLevelOfASkill,
} from '../rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import type { TheStagesOfEachHookPoint } from './the-registry-of-content-effects.ts';

/** The hook points a minor title's perk acts at, each filled by a row of the family: `personalCombat` (B-06j: a hero's
 *  titles add to his skills in a fight), `strength` (B-06k: to his Tactical in a battle, and the units the commander's
 *  titles lift), `movementCost`, `orderValidity` and `orderOutcome` (B-06l: his movement points and his orders) and
 *  `turnEnd` (B-06m: the titles' tax and wage cuts). */
export type TheHookPointsAMinorTitlesPerkActsAt =
  'personalCombat' | 'strength' | 'movementCost' | 'orderValidity' | 'orderOutcome' | 'turnEnd';

/** An entry: the perk's effect at each stage it acts in. */
export type TheEffectsOfAMinorTitlesPerkAtEachHookPoint = {
  readonly [H in TheHookPointsAMinorTitlesPerkActsAt]?: Partial<TheStagesOfEachHookPoint[H]>;
};

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360; an entry with no row,
 *  TS2353). Each is at no stage yet: the row named beside it gives it its effect. */
export const THE_REGISTRY_OF_THE_MINOR_TITLES_PERKS = {
  duelist: {}, // personalCombat (B-06j)
  marksman: {}, // personalCombat (B-06j)
  strategist: {}, // strength (B-06k)
  swift: {}, // movement (B-06l)
  seawolf: {}, // movement (B-06l)
  shadow: {}, // orders (B-06l)
  cutpurse: {}, // turnEnd (B-06m; its gold is the economy's registry's)
  naturalist: {}, // strength (B-06k)
  loreseeker: {}, // orders (B-06l)
  trailblazer: {}, // orders (B-06l)
  colossus: {}, // orders (B-06l)
  widowmaker: {}, // personalCombat (B-06j)
  champion: {}, // turnEnd (B-06m; its gold is the economy's registry's)
  hostleader: {}, // turnEnd (B-06m)
  cavalier: {}, // strength (B-06k)
  beastmaster: {}, // strength (B-06k)
  ironclad: {}, // strength (B-06k)
  relichunter: {}, // personalCombat (B-06j)
  castellan: {}, // turnEnd (B-06m; its gold is the economy's registry's)
  warlock: {}, // orders (B-06l)
} satisfies Record<AMinorTitlesSlug, TheEffectsOfAMinorTitlesPerkAtEachHookPoint>;

/** Each stage's effects, in the order the turn runs them (none yet). */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES = {} as const satisfies {
  readonly [H in TheHookPointsAMinorTitlesPerkActsAt]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly AMinorTitlesSlug[];
  };
};

/** A hero as the minor titles measure him: his skills, his hit points, his kills of another realm's heroes, his merits,
 *  his companies and items (a list a guard may find missing), and whether he is his realm's king. */
export interface AHeroAsTheMinorTitlesMeasureHim {
  readonly player: number;
  readonly isKing: boolean;
  readonly maxHp: number;
  readonly merits: number;
  readonly skills?: Readonly<Record<string, number | undefined>> | null | undefined;
  readonly tm?: { readonly duelKills?: number | undefined } | null | undefined;
  readonly armies?: readonly { readonly type: string }[] | null | undefined;
  readonly items?: readonly unknown[] | null | undefined;
}
/** The world as the minor titles measure a hero in it: its provinces' owners (the Castellan's count). */
export interface TheWorldAsTheMinorTitlesMeasureAHeroInIt {
  readonly world?:
    { readonly provinces?: readonly { readonly owner: number | null }[] | null | undefined } | null | undefined;
}

/** The companies a hero leads, of any kind or of one. */
function theCompaniesAHeroLeadsOfAKind(
  c: AHeroAsTheMinorTitlesMeasureHim,
  ofWhichKind: Extract<HowTheHolderOfAMinorTitleIsFound, { theMeasure: 'the companies he leads' }>['ofWhichKind'],
): number {
  switch (ofWhichKind) {
    case 'any':
      return (c.armies ?? []).length;
    case 'cavalry':
      return (c.armies ?? []).filter((a) => MINOR_CAV.has(a.type)).length;
    case 'creatures and monsters':
      return (c.armies ?? []).filter((a) => CREATURE_ARMIES.has(a.type) || MONSTER_ARMIES.has(a.type)).length;
    case 'heavy units and fleets':
      return (c.armies ?? []).filter((a) => MINOR_HEAVY.has(a.type)).length;
  }
}

/** The measure a living hero of a realm is held to for a minor title, by how its row says its holder is found (the
 *  awarding, computeMinorTitles, gives the title to the highest, ties to the first found; 0 leaves it vacant). */
export function theMeasureAHeroIsHeldToForAMinorTitle(
  how: HowTheHolderOfAMinorTitleIsFound,
  c: AHeroAsTheMinorTitlesMeasureHim,
  st: TheWorldAsTheMinorTitlesMeasureAHeroInIt,
): number {
  switch (how.theMeasure) {
    case 'his level of a skill':
      return theTrainedLevelOfASkill(c.skills?.[how.theSkill]);
    case 'his maximum hit points':
      return c.maxHp || how.theHitPointsOfAHeroWithNoneWritten;
    case 'the heroes of other realms he has killed':
      return Number(c.tm?.duelKills) || 0;
    case 'the merits he has earned':
      return c.merits || 0;
    case 'the companies he leads':
      return theCompaniesAHeroLeadsOfAKind(c, how.ofWhichKind);
    case 'the magic items he carries':
      return (c.items ?? []).length;
    case 'the provinces his realm holds, if he is its king':
      return c.isKing ? (st.world?.provinces ?? []).filter((pv) => pv.owner === c.player).length : 0;
    case 'his highest level in a magic school':
      return theHighestLevelAHeroHasTrainedInAMagicSchool(c);
  }
}
