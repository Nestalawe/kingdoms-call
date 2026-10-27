// ── THE WORDS OF THE RESEARCH AND PRACTICE ORDERS' LINES (plan P1-12d6: P1-12's Decisions of 2026-10-26, Decisions 6
// and 7) ──
// The views write the words of each fact the research and practice orders' lines record (src/engine/orders/the-facts-
// the-research-and-practice-orders-lines-record.ts), in the same words the engine wrote before (orders/research-and-
// practice-orders-discoveries-skill-drills-and-rest.ts): the reason for a practice's chance and the comrades a hero
// trains are written as the engine built them there (bonusReason, pupilNote). The skills' names, fmtRoll and the words
// of a skill in play are the engine's, read here on plain values. A kind with no words here is a compile error (the
// `never` below).
import type {
  TheFactOfTheResearchAndPracticeOrdersLine,
  TheReasonForAPracticesChance,
  APupilAsTheLineNamesHim,
} from '../../engine/orders/the-facts-the-research-and-practice-orders-lines-record.ts';
import { SKILL_LABELS } from '../../engine/army-tables.ts';
import { fmtRoll } from '../../engine/dice-and-army-names.ts';
import { theWordsOfASkillInPlay } from '../../engine/heroes/effective-skills-and-hidden-heroes.ts';
import { theWordsInATableFor } from './the-words-of-the-order-dispatchs-lines.ts';

/** A skill's name, by its slug (the slug itself when the table has none). */
function theSkillsName(skill: string): string {
  return theWordsInATableFor(SKILL_LABELS, skill) ?? skill;
}

/** Why a practice's chance is what it is, as the engine wrote it (bonusReason): the mentor, the peers or none, the base
 *  chance, the Astronomical Tables, then the perseverance and the Quick Learners while the chance is below certain. */
function theReasonForThePracticesChance(fact: {
  skill: string;
  theChance: TheReasonForAPracticesChance;
  earlierFailures: number;
  perseverance: number;
  quickLearner: boolean;
  belowCertain: boolean;
}): string {
  const reason = fact.theChance;
  let bonusReason: string;
  if (reason.kind === 'a more skilled mentor trains a hero at practice') {
    bonusReason = ` — trained by ${reason.mentorName} (${theSkillsName(fact.skill)} ${String(reason.mentorsLevel)}), a more skilled mentor`;
  } else if (reason.kind === 'a hero practises alongside peers of his level') {
    bonusReason = ` — practising alongside ${reason.peerNames.join(' & ')} (base ${String(reason.baseChance)}% at level ${String(reason.level)}, +50% group bonus)`;
    if (reason.astronomicalTables) bonusReason += ' incl. Astronomical Tables';
  } else {
    bonusReason =
      ` (base ${String(reason.baseChance)}% at level ${String(reason.level)})` +
      (reason.astronomicalTables ? ' +5% (Astronomical Tables)' : '');
  }
  if (fact.earlierFailures > 0 && fact.belowCertain)
    bonusReason += ` ×${fact.perseverance.toFixed(2)} for ${String(fact.earlierFailures)} earlier failed practice${fact.earlierFailures !== 1 ? 's' : ''} this turn`;
  if (fact.quickLearner && fact.belowCertain) bonusReason += ' ×1.5 (Human: Quick Learners)';
  return bonusReason;
}

/** The comrades a hero trains at practice, as the engine wrote them (pupilNote): " — trains Bran (Melee 1) in Melee". */
function thePupilsAHeroTrains(skill: string, pupils: readonly APupilAsTheLineNamesHim[]): string {
  return pupils.length
    ? ` — trains ${pupils.map((t) => `${t.name} (${theSkillsName(skill)} ${String(t.level)})`).join(' & ')} in ${theSkillsName(skill)}`
    : '';
}

/** The words of one fact of the research and practice orders' lines. */
export function theWordsOfTheResearchAndPracticeOrdersLine(fact: TheFactOfTheResearchAndPracticeOrdersLine): string {
  switch (fact.kind) {
    case 'a hero without Sage learning cannot research':
      return `${fact.heroName} pores over the archives, but without any Sage learning (Sage 1+) the pages mean nothing to them.`;
    case 'every field of discovery is spent and nothing is left to research':
      return `${fact.heroName}: every ${fact.field} discovery has already been made, set aside, or is awaiting your choice — and so has every other field your realm can study. There is nothing left to research.`;
    case "a field's archives are spent and the research turns to another":
      return `📚 ${fact.heroName} finds the ${fact.field} archives already spent — every ${fact.field} discovery has been made, set aside, or is awaiting your choice — and turns instead to ${fact.turnsTo}.`;
    case 'an unlooked-for discovery in a hidden field':
      return `💡 An unlooked-for find! Among the pages ${fact.heroName} was not even studying, **${fact.discoveryName}** (${fact.discoveryCategory}) comes to light — and the ordinary course of study is set aside for it. ${fact.discoveryDescription}`;
    case "a Sage's discovery roll":
      return `📊 Research${fact.field && fact.field.toLowerCase() !== 'any' ? ` (${fact.field})` : ''} — Sage discovery roll: ${String(fact.chance)}% chance (Sage level ${String(fact.sageLevel)}${fact.neutralBonus > 0 ? ', Neutral ×2' : ''}${fact.earlierFailures > 0 ? ` ×${fact.perseverance.toFixed(2)} for ${String(fact.earlierFailures)} earlier failed Research${fact.earlierFailures !== 1 ? ' orders' : ''} this turn` : ''}) — roll ${String(fact.roll)} — ${fact.roll <= fact.chance ? '✓ Success!' : '✗ No discovery this turn.'}`;
    case 'research brings two discoveries to light and one is to be kept':
      return `💡 ${fact.heroName}'s research bears fruit — two discoveries come to light: **${fact.firstName}** (${fact.firstCategory}) and **${fact.secondName}** (${fact.secondCategory}). Only one can be pursued: choose which to keep in next turn's orders (the 💡 Research box just under the Realm section). The other will be lost for good.`;
    case "research makes the field's last discovery":
      return `💡 ${fact.heroName}'s research bears fruit! **${fact.discoveryName}** (${fact.discoveryCategory}) discovered — the last discovery this field still holds for your realm, so there is nothing to choose between. ${fact.discoveryDescription}`;
    case 'the research roll succeeds but every discovery is already made':
      return `${fact.heroName} researches diligently — the roll succeeded but all known discoveries have already been made by your realm.`;
    case 'research makes no discovery this turn':
      return `${fact.heroName} researches hard but makes no new discovery this turn.`;
    case 'a skill is drilled as far as practice can take it':
      return `${fact.heroName} has trained ${theSkillsName(fact.skill)} as far as drilling can take them (level 5). Higher mastery (levels 6–9) is won only through experience in the field, never the practice ground.`;
    case 'a hero practises a skill and improves': {
      const bonusReason = theReasonForThePracticesChance(fact);
      const pupilNote = thePupilsAHeroTrains(fact.skill, fact.pupils);
      return `${fact.heroName} practises ${theSkillsName(fact.skill)} and improves to level ${String(fact.level)}${theWordsOfASkillInPlay(fact.skillInPlay)}!${fact.mentored ? '' : ' ' + fmtRoll(fact.chance, fact.roll)}${bonusReason}${pupilNote}${fact.maxHpRise > 0 ? ` (Max HP +${String(fact.maxHpRise)} → ${String(fact.maxHp)}.)` : ''}`;
    }
    case "a hero's wage rises with his renown":
      return `💰 ${fact.heroName}'s growing renown raises their wage to ${String(fact.wage)}g/turn (was ${String(fact.wasWage)}g/turn).`;
    case 'a hero practises a skill but makes no progress': {
      const bonusReason = theReasonForThePracticesChance(fact);
      const pupilNote = thePupilsAHeroTrains(fact.skill, fact.pupils);
      return `${fact.heroName} practises ${theSkillsName(fact.skill)} but makes no measurable progress this season. ${fmtRoll(fact.chance, fact.roll)}${bonusReason ? ` ${bonusReason}.` : ''}${pupilNote ? ` ${pupilNote.slice(3)}.` : ''}`;
    }
    case "a commander's drills advance a unit a tier":
      return `${fact.heroName}'s ${fact.isNaval ? 'Naval drills' : 'training drills'}: ${fact.unitName ?? fact.unitType} (${fact.unitType}) advances to **${fact.quality}**!`;
    case "a commander's drills advance no unit this season":
      return `${fact.heroName}'s ${fact.isNaval ? 'Naval drills were thorough but no crews' : 'training drills were thorough but no units'} achieved a breakthrough this season.`;
    case 'a commander drills theory alone with no troops to train':
      return fact.isNaval
        ? `${fact.heroName} drills Naval theory alone — commanding fleets or sea-beasts would yield greater benefit.`
        : `${fact.heroName} practises Tactical theory alone — leading land armies would yield greater benefit.`;
    case 'a hero rests and recovers':
      return `${fact.heroName} rests and recovers. +${String(fact.healed)} HP (${String(fact.hp)}/${String(fact.maxHp)}${fact.isDivine ? ' — Divine blessing lifts healing by half' : ''}).`;
    case 'a hero lacks the Sage mastery for a Research Breakthrough':
      return `${fact.heroName} lacks the Sage mastery (7) for a Research Breakthrough.`;
    case 'a Research Breakthrough finds every discovery already made':
      return `${fact.heroName}'s Research Breakthrough succeeds, but your scholars have already unlocked every known discovery.`;
    case 'a Research Breakthrough makes a discovery':
      return `💡 ${fact.heroName} drives a Research Breakthrough — **${fact.discoveryName}** (${fact.discoveryCategory}) discovered! ${fact.discoveryDescription}`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the research and practice orders' lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
