// The rule registry of the minor titles' perks (B-06, T7, the rules pulled out: its Reckoning and titles family, from
// row B-06i). A minor title is one row in src/content/ (its key, name, perk and requirement as players read them, and
// how its holder is found: the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts) and
// one entry here, keyed by the same slug, naming its perk's effect at each stage of a hook point. The hook points and
// their stages are the content effects' (one union, in the-registry-of-content-effects.ts); each stage's order is
// THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES, and each stage's runner is here. The Duelist, the Marksman, the
// Widowmaker and the Relic-Hunter act at personalCombat (B-06j); the Strategist, the Naturalist, the Cavalier, the
// Beastmaster and the Ironclad at strength (B-06k); every other entry is at no stage yet (its perk is still checked
// where it acts, by the holders worked out at the turn's start: `charMinor` and its kin). Here too is the
// measure a hero is held to for a title, which the awarding (computeMinorTitles) asks. The rows after B-06k give each
// other perk its effect, at the hook points TheHookPointsAMinorTitlesPerkActsAt names. How to add one:
// docs/architecture/the-minor-titles-registry-its-hook-points-and-how-to-add-a-perk.md.
import {
  THE_ORDER_THE_MINOR_TITLES_ARMY_PERKS_LIFT_A_UNIT_IN,
  type AMinorTitlesSlug,
  type HowTheHolderOfAMinorTitleIsFound,
} from '../../content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import { theHighestLevelAHeroHasTrainedInAMagicSchool } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import {
  aCompanyIsOfTheKindAMinorTitleCounts,
  theStrengthAUnitHasAfterTheStepsOfItsCommandersMinorTitles,
  theTrainedLevelOfASkill,
  type AMinorTitleWithAnArmyPerk,
  type AMinorTitlesArmyPerk,
} from '../rules-on-plain-values/the-quality-a-commanders-druid-8-or-necromancy-6-lifts-a-unit-to-and-the-minor-titles-army-perks.ts';
import type { TheStagesOfEachHookPoint } from './the-registry-of-content-effects.ts';
import { A_HEROS_TITLES_ADD_TO_HIS_SKILLS } from './the-minor-titles/a-heros-titles-add-to-his-skills-in-a-personal-combat.ts';
import {
  A_HEROS_TITLES_ADD_TO_HIS_TACTICAL,
  THE_COMMANDERS_MINOR_TITLES_LIFT_THE_UNITS_HE_LEADS,
} from './the-minor-titles/a-heros-titles-add-to-his-tactical-and-lift-the-units-he-leads-in-a-battle.ts';

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

/** One entry for each content row, and no other (a row with no entry fails to compile, TS1360, and at ENTRIES, TS2741;
 *  an entry with no row, TS2353). An entry at no stage yet: the row named beside it gives it its effect. */
export const THE_REGISTRY_OF_THE_MINOR_TITLES_PERKS = {
  duelist: {
    personalCombat: { "a hero's titles add to his skills": A_HEROS_TITLES_ADD_TO_HIS_SKILLS.duelist },
  },
  marksman: {
    personalCombat: { "a hero's titles add to his skills": A_HEROS_TITLES_ADD_TO_HIS_SKILLS.marksman },
  },
  strategist: {
    strength: { "a hero's titles add to his Tactical": A_HEROS_TITLES_ADD_TO_HIS_TACTICAL.strategist },
  },
  swift: {}, // movement (B-06l)
  seawolf: {}, // movement (B-06l)
  shadow: {}, // orders (B-06l)
  cutpurse: {}, // turnEnd (B-06m; its gold is the economy's registry's)
  naturalist: {
    strength: { "the commander's minor titles": THE_COMMANDERS_MINOR_TITLES_LIFT_THE_UNITS_HE_LEADS.naturalist },
  },
  loreseeker: {}, // orders (B-06l)
  trailblazer: {}, // orders (B-06l)
  colossus: {}, // orders (B-06l)
  widowmaker: {
    personalCombat: { "a hero's titles add to his skills": A_HEROS_TITLES_ADD_TO_HIS_SKILLS.widowmaker },
  },
  champion: {}, // turnEnd (B-06m; its gold is the economy's registry's)
  hostleader: {}, // turnEnd (B-06m)
  cavalier: {
    strength: { "the commander's minor titles": THE_COMMANDERS_MINOR_TITLES_LIFT_THE_UNITS_HE_LEADS.cavalier },
  },
  beastmaster: {
    strength: { "the commander's minor titles": THE_COMMANDERS_MINOR_TITLES_LIFT_THE_UNITS_HE_LEADS.beastmaster },
  },
  ironclad: {
    strength: { "the commander's minor titles": THE_COMMANDERS_MINOR_TITLES_LIFT_THE_UNITS_HE_LEADS.ironclad },
  },
  relichunter: {
    personalCombat: { "a hero's titles add to his skills": A_HEROS_TITLES_ADD_TO_HIS_SKILLS.relichunter },
  },
  castellan: {}, // turnEnd (B-06m; its gold is the economy's registry's)
  warlock: {}, // orders (B-06l)
} satisfies Record<AMinorTitlesSlug, TheEffectsOfAMinorTitlesPerkAtEachHookPoint>;

/** Each stage's effects, in the order the turn runs them (a hero's skills: the character card's, SKILL_EXTRA_MINORS';
 *  the commander's minor titles: armStr's, content's list beside the rows, which the army card reads too). */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES = {
  personalCombat: {
    "a hero's titles add to his skills": ['duelist', 'marksman', 'widowmaker', 'relichunter'],
  },
  strength: {
    "the commander's minor titles": THE_ORDER_THE_MINOR_TITLES_ARMY_PERKS_LIFT_A_UNIT_IN,
    "a hero's titles add to his Tactical": ['strategist'],
  },
} as const satisfies {
  readonly [H in TheHookPointsAMinorTitlesPerkActsAt]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly AMinorTitlesSlug[];
  };
};

const ENTRIES: Readonly<Record<AMinorTitlesSlug, TheEffectsOfAMinorTitlesPerkAtEachHookPoint>> =
  THE_REGISTRY_OF_THE_MINOR_TITLES_PERKS;
const PERSONAL_COMBAT = THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES.personalCombat;
const STRENGTH = THE_ORDER_OF_EACH_STAGE_OF_THE_MINOR_TITLES.strength;

/** The runner of "personalCombat: a hero's titles add to his skills" (pcCharCombatant, for his Melee and his Archery
 *  and their raw levels, after his items and before his realm's discoveries): the levels each title of the stage adds
 *  to the skill, in the stage's order, added for each he holds. Whether he holds a title is asked only of a title that
 *  adds to the skill, in that order (as `charMinor` was asked before). */
export function theLevelsAHerosTitlesAddToHisSkillInAPersonalCombat(
  theSkill: 'melee' | 'archery',
  heHoldsTheTitle: (theTitle: AMinorTitlesSlug) => boolean,
): number {
  const theStage = "a hero's titles add to his skills";
  return PERSONAL_COMBAT[theStage].reduce((theLevels, slug) => {
    const added = ENTRIES[slug].personalCombat?.[theStage]?.(theSkill) ?? 0;
    return added !== 0 && heHoldsTheTitle(slug) ? theLevels + added : theLevels;
  }, 0);
}

/** The runner of "strength: a hero's titles add to his Tactical" (commandScore, and each side of both battles, after
 *  his Tactical and before a curse halves it): the levels each title of the stage adds, in the stage's order, added
 *  for each he holds. Whether he holds a title is asked only of a title that adds (as `charMinor` was asked before). */
export function theLevelsAHerosTitlesAddToHisTacticalInABattle(
  heHoldsTheTitle: (theTitle: AMinorTitlesSlug) => boolean,
): number {
  const theStage = "a hero's titles add to his Tactical";
  return STRENGTH[theStage].reduce((theLevels, slug) => {
    const added = ENTRIES[slug].strength?.[theStage]?.() ?? 0;
    return added !== 0 && heHoldsTheTitle(slug) ? theLevels + added : theLevels;
  }, 0);
}

/** The runner of "strength: the commander's minor titles" (armStr, after his Druid mastery): a unit's strength once the
 *  titles its commander holds have lifted it, and their perks, in the stage's order, each step rounded as it goes (on
 *  plain values, as the army card reads it: each entry of the stage is that product's step of its title). */
export function theStrengthOfAUnitOnceItsCommandersMinorTitlesLiftIt(
  theStrengthSoFar: number,
  unitType: string,
  heHoldsTheTitle: (theTitle: AMinorTitleWithAnArmyPerk) => boolean,
): { strength: number; liftedBy: AMinorTitlesArmyPerk[] } {
  return theStrengthAUnitHasAfterTheStepsOfItsCommandersMinorTitles(
    STRENGTH["the commander's minor titles"],
    { unitType },
    theStrengthSoFar,
    heHoldsTheTitle,
  );
}

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
  return (c.armies ?? []).filter((a) => aCompanyIsOfTheKindAMinorTitleCounts(ofWhichKind, a.type)).length;
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
