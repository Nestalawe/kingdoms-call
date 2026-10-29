// ── THE WORDS OF A HERO'S EXPERIENCE LINES (plan P1-12d12: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact a hero's experience and hit points lines record (src/engine/heroes/the-facts-
// a-heros-experience-lines-record.ts), in the same words the engine wrote before (heroes/experience-skill-rises-and-
// earned-hp.ts): a skill's label from SKILL_LABELS (else its slug), a mastery's unlock as the content words it
// (MASTERY_UNLOCKS), the skill in play by theWordsOfASkillInPlay and a hit-point rise by hpGainLine, which the engine
// still calls elsewhere, on the values alone. A kind with no words here is a compile error (the `never` below).
import type { TheFactOfAHerosExperienceLine } from '../../engine/heroes/the-facts-a-heros-experience-lines-record.ts';
import { SKILL_LABELS } from '../../engine/army-tables.ts';
import { MASTERY_UNLOCKS } from '../../content/kingdoms-call-data.ts';
import { theWordsOfASkillInPlay } from '../../engine/heroes/effective-skills-and-hidden-heroes.ts';
import { hpGainLine } from '../../engine/heroes/skills-and-hp.ts';
import { dispFloor } from '../../engine/rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { theWordsInATableFor } from './the-words-of-the-order-dispatchs-lines.ts';

/** What each mastery level of each skill grants, as the content words it, by the skill's slug. */
const THE_UNLOCKS_OF_EACH_SKILL: Readonly<Record<string, Readonly<Record<number, string>> | undefined>> =
  MASTERY_UNLOCKS;

/** A skill's label ("White Magic"), else its slug. */
function theSkillsLabel(skill: string): string {
  return theWordsInATableFor(SKILL_LABELS, skill) ?? skill;
}

/** Where and against whom a rise was earned: " in single combat with Gorm before the Battle for Highmoor", " in the
 *  fighting at Highmoor", or nothing. */
function whereItWasEarned(duelWith: string | null, provinceName: string | null): string {
  if (duelWith !== null)
    return ` in single combat with ${duelWith}${provinceName !== null ? ` before the Battle for ${provinceName}` : ''}`;
  return provinceName !== null ? ` in the fighting at ${provinceName}` : '';
}

/** The words of one fact of a hero's experience and hit points lines. */
export function theWordsOfAHerosExperienceLine(fact: TheFactOfAHerosExperienceLine): string {
  switch (fact.kind) {
    case 'a wandering hero learns from the fighting':
      return `📜 ${fact.heroName.replace(/\s*\(wandering\)/i, '')} learns from the fighting — ${theSkillsLabel(fact.skill)} rises to ${String(fact.level)}.`;
    case "a hero's skill rises through experience":
      return `📈 ${fact.heroName}'s ${theSkillsLabel(fact.skill)} rises to level ${String(fact.level)} through hard-won experience${whereItWasEarned(fact.duelWith, fact.provinceName)}${theWordsOfASkillInPlay(fact.skillInPlay)}.${fact.maxHpRise > 0 ? ` (Max HP +${String(fact.maxHpRise)} → ${String(fact.maxHp)}.)` : ''}`;
    case 'a hero attains mastery of a skill': {
      const unlock = THE_UNLOCKS_OF_EACH_SKILL[fact.skill]?.[fact.level];
      return `🎉 ${fact.heroName} attains mastery of ${theSkillsLabel(fact.skill)} — level ${String(fact.level)}!${unlock ? ' ' + unlock : ''}`;
    }
    case "a hero's growing renown raises his wage":
      return `💰 ${fact.heroName}'s growing renown raises their wage to ${String(fact.wageAfter)}g/turn (was ${String(fact.wageBefore)}g/turn).`;
    case 'a hero is hardened after a fight':
      return hpGainLine({ name: fact.heroName }, fact.rise);
    case "a hero's maximum hit points rise as the phase ends":
      return `💪 ${fact.heroName}'s maximum HP rises by ${String(fact.by)} to ${String(fact.maxHp)} (current HP ${String(dispFloor(fact.hp))}).`;
    case "a hero's maximum hit points fall as the phase ends":
      return `${fact.heroName}'s maximum HP falls by ${String(fact.by)} to ${String(fact.maxHp)}.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a hero's experience lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
