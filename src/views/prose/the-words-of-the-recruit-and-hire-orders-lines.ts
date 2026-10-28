// ── THE WORDS OF THE RECRUIT AND HIRE ORDERS' LINES (plan P1-12d6: P1-12's Decisions of 2026-10-26, Decisions 6 and
// 7) ──
// The views write the words of each fact the recruit and hire orders' lines record (src/engine/orders/the-facts-the-
// recruit-and-hire-orders-lines-record.ts), in the same words the engine wrote before (orders/recruit-and-hire-orders-
// companies-mercenaries-and-heroes.ts): where the companies muster (_destNote), why a company was not raised (the
// blocked list), the companies raised and a sworn hero's skills are written as the engine built them there. The skills'
// names and the words of a beast command are the engine's, read here on plain values. A kind with no words here is a
// compile error (the `never` below).
import type {
  CompaniesRaisedAsTheLineCountsThem,
  TheFactOfTheRecruitAndHireOrdersLine,
  WhereTheCompaniesMuster,
  WhyACompanyWasNotRaised,
} from '../../engine/orders/the-facts-the-recruit-and-hire-orders-lines-record.ts';
import { SKILL_LABELS } from '../../engine/army-tables.ts';
import { theWordsOfABeastCommand } from '../../engine/world/tables.ts';
import { theWordsInATableFor } from './the-words-of-the-order-dispatchs-lines.ts';

/** Where the companies muster, as the engine wrote it after the province (_destNote): nothing for his own column. */
function whereTheCompaniesMuster(destination: WhereTheCompaniesMuster | null): string {
  if (destination === null) return '';
  switch (destination.kind) {
    case 'the companies muster straight into the garrison':
      return ` (mustered directly into the garrison of ${destination.provinceName})`;
    case "the garrison is not the realm's to muster into":
      return ' (garrison unavailable — province not controlled; troops join the recruiter)';
    case "the companies muster under a comrade's banner":
      return ` (mustered under ${destination.heroName}'s banner)`;
    case 'the comrade named to receive the companies is not here':
      return ' (chosen recipient is not here — troops join the recruiter)';
    default: {
      const aKindWithNoWords: never = destination;
      throw new Error(`no words for where the companies muster: ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}

/** A company not raised, and why, as the engine wrote it in the blocked list. */
function aCompanyNotRaised(why: WhyACompanyWasNotRaised): string {
  switch (why.kind) {
    case 'a sea beast can be summoned only in a sea province':
      return `${why.type} (can only be summoned in a sea province)`;
    case 'the province does not raise the unit':
      return `${why.type} (not raised in ${why.provinceName} — that unit isn't available here)`;
    case 'the unit was already recruited this turn':
      return `${why.type} (already recruited this turn)`;
    case 'the treasury cannot pay for the unit':
      return `${why.type} (insufficient gold: need ${String(why.cost)}g more)`;
    default: {
      const aKindWithNoWords: never = why;
      throw new Error(`no words for a company not raised: ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}

/** The companies raised, as the engine listed them: "2× Shieldwall Levies". */
function theCompaniesRaised(recruited: readonly CompaniesRaisedAsTheLineCountsThem[]): string[] {
  return recruited.map((r) => `${String(r.count)}× ${r.type}`);
}

/** The words of one fact of the recruit and hire orders' lines. */
export function theWordsOfTheRecruitAndHireOrdersLine(fact: TheFactOfTheRecruitAndHireOrdersLine): string {
  switch (fact.kind) {
    case 'a hired hero takes up the orders his hirer laid down':
      return `${fact.heroName} takes up the orders ${fact.realmName} laid down for them — ${String(fact.phasesLeft)} phase${fact.phasesLeft !== 1 ? 's' : ''} of this turn remain to be acted on.`;
    case 'a beast a full column cannot take musters into the garrison':
      return `🐾 ${theWordsOfABeastCommand(fact.beastCommand)}: ${fact.unitName ?? fact.unitType} (${fact.unitType}) musters into the garrison of ${fact.provinceName} instead.`;
    case 'mercenary beasts are not hired into a full column':
      return `🐾 ${theWordsOfABeastCommand(fact.beastCommand)} — the ${fact.mercenaryName ?? fact.mercenaryType} mercenaries are not hired.`;
    case 'a hero cannot afford a mercenary band':
      return `${fact.heroName}: cannot afford ${fact.mercenaryName ?? fact.mercenaryType} mercenaries (${String(fact.cost)}g).`;
    case 'a hero hires a mercenary band':
      return `${fact.heroName} hires mercenary band ${fact.mercenaryName ?? fact.mercenaryType} (${fact.quality}) for ${String(fact.cost)}g${fact.cost < fact.baseCost ? ' (Neutral discount)' : ''}.`;
    case 'a hero cannot recruit in a province his realm does not hold':
      return `${fact.heroName} cannot recruit in ${fact.provinceName} — you must control the province to raise troops there.`;
    case 'a hero recruits companies': {
      const _agN = fact.autoGarrisoned;
      const _autoGarrNote = _agN
        ? `; ${String(_agN)} garrison unit${_agN !== 1 ? 's' : ''} muster${_agN === 1 ? 's' : ''} straight into the garrison of ${fact.provinceName}`
        : '';
      return (
        `${fact.heroName} recruits ${theCompaniesRaised(fact.recruited).join(', ')} in ${fact.provinceName}${whereTheCompaniesMuster(fact.destination)}${_autoGarrNote}. Cost: ${String(fact.cost)}g. Treasury: ${String(fact.treasury)}g remaining.` +
        (fact.blocked.length > 0 ? ` (Blocked: ${fact.blocked.map(aCompanyNotRaised).join('; ')}.)` : '')
      );
    }
    case "companies muster to a comrade's banner":
      return `⚔ ${theCompaniesRaised(fact.recruited).join(', ')} muster to ${fact.recipientName}'s banner in ${fact.provinceName}, raised by ${fact.heroName}.`;
    case "a hero's recruitment is entirely blocked":
      return `${fact.heroName}'s recruitment in ${fact.provinceName} was entirely blocked: ${fact.blocked.map(aCompanyNotRaised).join('; ')}.`;
    case 'no hero of that description is to be hired here':
      return `${fact.heroName} tries to hire a hero but none matching that description are available in ${fact.provinceName}.`;
    case "a neutral province's guardian cannot be hired away":
      return `${fact.guardianName} is sworn to defend ${fact.provinceName} and will not abandon their post — the guardian of a neutral province cannot be hired away. You must defeat them in battle to take the province.`;
    case 'a hero driven from his home refuses to be hired this turn':
      return `${fact.heroName} is furious at being driven from their home — they refuse to work with you this turn. Try again next turn.`;
    case 'a hero just released from service hears no offers this turn':
      return `${fact.heroName} was only just released from service and will hear no offers this turn. Try again next turn.`;
    case 'a hero recoils from a hire across the gulf between Divine and Undead':
      return `${fact.heroName} (${fact.alignment}) recoils from ${fact.hirerName}'s offer — ${fact.realmIsDivine ? 'no creature of the grave will serve a Divine crown' : 'the faithful will never serve an Undead throne'}. (Alignment gulf too wide: Divine and Undead cannot hire one another.)`;
    case 'a hero cannot afford to hire another':
      return `${fact.heroName} cannot afford to hire ${fact.hiredName} — needs ${String(fact.wage)}g/turn, treasury has only ${String(fact.treasury)}g.`;
    case 'a hero agrees to serve the realm': {
      const _aDist = fact.alignmentSteps;
      const _hActs = `They may act from ${fact.seasonTheyMayActFrom ?? 'next turn'} onwards.`;
      return `${fact.heroName} (${fact.race}, ${fact.alignment}) agrees to serve ${fact.realmName} for ${String(fact.wage)}g/turn (${_aDist === 0 ? 'kindred spirits — base rate' : _aDist <= 1 ? 'close in outlook — base rate' : `${String(_aDist)} steps across the alignment spectrum`}). Skills: ${
        fact.skills.map(([k, v]) => `${theWordsInATableFor(SKILL_LABELS, k) ?? k} ${String(v)}`).join(', ') ||
        'none yet'
      }. ${_hActs}`;
    }
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the recruit and hire orders' lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
