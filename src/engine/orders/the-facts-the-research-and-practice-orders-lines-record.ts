// ── THE FACTS THE RESEARCH AND PRACTICE ORDERS' LINES RECORD (plan P1-12d6: P1-12's Decisions of 2026-10-26, Decisions
// 2, 6 and 7) ──
// The lines the Research, Practice Skill, Rest and Research Breakthrough orders write (orders/research-and-practice-
// orders-discoveries-skill-drills-and-rest.ts): a Sage's discovery roll and what it finds (one discovery, two to choose
// between, an unlooked-for find in a hidden field, nothing), a field already spent, a skill practised (its roll, why
// its chance is what it is, the comrades a hero trains, a rise and the wage it brings), the drills of a commander's
// troops, a rest, a breakthrough. Each kind holds plain values: a name as the world or the content holds it, a skill's
// slug, a number, a flag, the chance and the roll, the reason for a practice's chance as a record of its values, and
// the skill in play as its line tells it (copied: theSkillInPlayAsALineTellsIt, heroes/effective-skills-and-hidden-
// heroes.ts); the prose writes every word (src/views/prose/the-words-of-the-research-and-practice-orders-lines.ts).
// Each is filed on its own, with the audience its event names (Decision 6: its event's).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { ASkillInPlayAsALineTellsIt } from '../heroes/effective-skills-and-hidden-heroes.ts';

/** Why a practice's chance is what it is, as the line tells it: a more skilled mentor (certain), peers of the same
 *  level (half as likely again), or alone; the base chance at the hero's level, and whether the Astronomical Tables
 *  add to it. */
export type TheReasonForAPracticesChance =
  | { kind: 'a more skilled mentor trains a hero at practice'; mentorName: string; mentorsLevel: number }
  | {
      kind: 'a hero practises alongside peers of his level';
      peerNames: string[];
      /** The base chance at his level, in percent, rounded down as it is shown. */
      baseChance: number;
      level: number;
      astronomicalTables: boolean;
    }
  | { kind: 'a hero practises alone'; baseChance: number; level: number; astronomicalTables: boolean };

/** A comrade a hero trains at practice (a lower level at the start of the phase), as the line names him. */
export interface APupilAsTheLineNamesHim {
  readonly name: string;
  readonly level: number;
}

/** What a practice line tells of its chance and its comrades, beside its kind. */
interface APracticesChanceAndComrades {
  heroName: string;
  /** The skill practised (its slug: the prose names it). */
  skill: string;
  /** The chance shown, in percent, and the roll against it. */
  chance: number;
  roll: number;
  theChance: TheReasonForAPracticesChance;
  /** The practices that failed earlier this turn, and the perseverance they bring (×1.2 each). */
  earlierFailures: number;
  perseverance: number;
  /** A Human of a Human realm: Quick Learners. */
  quickLearner: boolean;
  /** The chance is below certain (else no multiplier is shown). */
  belowCertain: boolean;
  pupils: APupilAsTheLineNamesHim[];
}

/** A discovery as a line names it: its name, its field, and its description. */
interface ADiscoveryAsTheLineNamesIt {
  heroName: string;
  discoveryName: string;
  discoveryCategory: string;
  discoveryDescription: string;
}

/** What a line of the research and practice orders records. */
export type TheFactOfTheResearchAndPracticeOrdersLine =
  | { kind: 'a hero without Sage learning cannot research'; heroName: string }
  | {
      kind: 'every field of discovery is spent and nothing is left to research';
      heroName: string;
      /** The field named, as the order names it. */
      field: string;
    }
  | {
      kind: "a field's archives are spent and the research turns to another";
      heroName: string;
      field: string;
      turnsTo: string;
    }
  | ({ kind: 'an unlooked-for discovery in a hidden field' } & ADiscoveryAsTheLineNamesIt)
  | {
      kind: "a Sage's discovery roll";
      /** The field studied, as the order names it ('' or 'any': the whole table). */
      field: string;
      /** The chance, in percent, and the roll against it. */
      chance: number;
      sageLevel: number;
      /** A Neutral realm's bonus to the chance (above 0: doubled). */
      neutralBonus: number;
      earlierFailures: number;
      perseverance: number;
      roll: number;
    }
  | {
      kind: 'research brings two discoveries to light and one is to be kept';
      heroName: string;
      firstName: string;
      firstCategory: string;
      secondName: string;
      secondCategory: string;
    }
  | ({ kind: "research makes the field's last discovery" } & ADiscoveryAsTheLineNamesIt)
  | { kind: 'the research roll succeeds but every discovery is already made'; heroName: string }
  | { kind: 'research makes no discovery this turn'; heroName: string }
  | { kind: 'a skill is drilled as far as practice can take it'; heroName: string; skill: string }
  | ({
      kind: 'a hero practises a skill and improves';
      /** The level he rises to. */
      level: number;
      skillInPlay: ASkillInPlayAsALineTellsIt | null;
      /** A mentor taught him: no roll is shown. */
      mentored: boolean;
      /** His maximum hit points' rise with it, and his maximum after. */
      maxHpRise: number;
      maxHp: number;
    } & APracticesChanceAndComrades)
  | { kind: "a hero's wage rises with his renown"; heroName: string; wage: number; wasWage: number }
  | ({ kind: 'a hero practises a skill but makes no progress' } & APracticesChanceAndComrades)
  | {
      kind: "a commander's drills advance a unit a tier";
      heroName: string;
      /** Naval drills (his fleets), else training drills (his land and air companies). */
      isNaval: boolean;
      /** The unit's name (null: none; the prose names its type). */
      unitName: string | null;
      unitType: string;
      quality: string;
    }
  | { kind: "a commander's drills advance no unit this season"; heroName: string; isNaval: boolean }
  | { kind: 'a commander drills theory alone with no troops to train'; heroName: string; isNaval: boolean }
  | {
      kind: 'a hero rests and recovers';
      heroName: string;
      healed: number;
      hp: number;
      maxHp: number;
      /** A Divine realm's blessing lifts the healing by half. */
      isDivine: boolean;
    }
  | { kind: 'a hero lacks the Sage mastery for a Research Breakthrough'; heroName: string }
  | { kind: 'a Research Breakthrough finds every discovery already made'; heroName: string }
  | ({ kind: 'a Research Breakthrough makes a discovery' } & ADiscoveryAsTheLineNamesIt);

/** Each kind's audience: its event's (a kind filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_THE_RESEARCH_AND_PRACTICE_ORDERS_LINE: Readonly<
  Record<TheFactOfTheResearchAndPracticeOrdersLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a hero without Sage learning cannot research': "its event's",
  'every field of discovery is spent and nothing is left to research': "its event's",
  "a field's archives are spent and the research turns to another": "its event's",
  'an unlooked-for discovery in a hidden field': "its event's",
  "a Sage's discovery roll": "its event's",
  'research brings two discoveries to light and one is to be kept': "its event's",
  "research makes the field's last discovery": "its event's",
  'the research roll succeeds but every discovery is already made': "its event's",
  'research makes no discovery this turn': "its event's",
  'a skill is drilled as far as practice can take it': "its event's",
  'a hero practises a skill and improves': "its event's",
  "a hero's wage rises with his renown": "its event's",
  'a hero practises a skill but makes no progress': "its event's",
  "a commander's drills advance a unit a tier": "its event's",
  "a commander's drills advance no unit this season": "its event's",
  'a commander drills theory alone with no troops to train': "its event's",
  'a hero rests and recovers': "its event's",
  'a hero lacks the Sage mastery for a Research Breakthrough': "its event's",
  'a Research Breakthrough finds every discovery already made': "its event's",
  'a Research Breakthrough makes a discovery': "its event's",
};
