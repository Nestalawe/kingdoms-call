// ── THE FACTS A HERO'S EXPERIENCE LINES RECORD (plan P1-12d12: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The lines a hero's experience and hit points write (heroes/experience-skill-rises-and-earned-hp.ts): a skill rising
// through experience (where and against whom it was earned, the level it counts at in play, the maximum HP it brings),
// the mastery a rise crosses into, the wage a rise raises, a wandering hero learning from the fighting, a hero hardened
// by a fight outside a fight's narrative, and every hero's maximum HP kept in step after each phase. Each kind holds
// plain values: a hero's or a province's name as the world holds it (null where there is none: the prose leaves its
// clause out), a skill's slug (the prose writes its label, and a mastery's unlock as the content words it), a level, a
// wage, a hit-point rise copied as the line tells it (aHitPointRiseAsTheLineTellsIt, personal combat's), and the skill
// in play (theSkillInPlayAsALineTellsIt, heroes/effective-skills-and-hidden-heroes.ts); the prose writes every word
// (src/views/prose/the-words-of-a-heros-experience-lines.ts). Each is filed with the audience its event names (its
// event's): no audience changes. The skill rises held back to the end of the phase (turnContext._deferredSkillLogs)
// hold their facts until writeDeferredSkillLines files them (turn/events-and-their-audiences.ts).
import type { TheAudienceOfAKindOfLine } from '../turn/events-and-their-audiences.ts';
import type { AHitPointRiseAsTheLineTellsIt } from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';
import type { ASkillInPlayAsALineTellsIt } from './effective-skills-and-hidden-heroes.ts';

/** What a line of a hero's experience and hit points records. */
export type TheFactOfAHerosExperienceLine =
  | {
      kind: 'a wandering hero learns from the fighting';
      /** His name as the world holds it ('' for none): the prose drops its "(wandering)". */
      heroName: string;
      skill: string;
      level: number;
    }
  | {
      kind: "a hero's skill rises through experience";
      heroName: string;
      skill: string;
      level: number;
      /** Whom he fought in single combat before a battle, when he earned it there; null: not in a duel. */
      duelWith: string | null;
      /** The province of the battle he earned it in; null: not in a battle. */
      provinceName: string | null;
      /** The skill as it counts in play, when items or an aura lift it above his own level; null: they don't. */
      skillInPlay: ASkillInPlayAsALineTellsIt | null;
      /** The maximum HP the rise brings (0: none), and his maximum HP after it. */
      maxHpRise: number;
      maxHp: number;
    }
  | { kind: 'a hero attains mastery of a skill'; heroName: string; skill: string; level: number }
  | { kind: "a hero's growing renown raises his wage"; heroName: string; wageBefore: number; wageAfter: number }
  | { kind: 'a hero is hardened after a fight'; heroName: string; rise: AHitPointRiseAsTheLineTellsIt }
  | {
      kind: "a hero's maximum hit points rise as the phase ends";
      heroName: string;
      /** How far it rises, his maximum HP after it, and his current HP (the prose rounds it down). */
      by: number;
      maxHp: number;
      hp: number;
    }
  | { kind: "a hero's maximum hit points fall as the phase ends"; heroName: string; by: number; maxHp: number };

/** Each kind's audience: its event's (each is filed on its own). */
export const THE_AUDIENCE_OF_EACH_KIND_OF_A_HEROS_EXPERIENCE_LINE: Readonly<
  Record<TheFactOfAHerosExperienceLine['kind'], Extract<TheAudienceOfAKindOfLine, "its event's">>
> = {
  'a wandering hero learns from the fighting': "its event's",
  "a hero's skill rises through experience": "its event's",
  'a hero attains mastery of a skill': "its event's",
  "a hero's growing renown raises his wage": "its event's",
  'a hero is hardened after a fight': "its event's",
  "a hero's maximum hit points rise as the phase ends": "its event's",
  "a hero's maximum hit points fall as the phase ends": "its event's",
};
