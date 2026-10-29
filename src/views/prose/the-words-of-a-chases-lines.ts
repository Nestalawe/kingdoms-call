// ── THE WORDS OF A CHASE'S LINES (plan P1-12d12: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact a chase's lines record (src/engine/heroes/the-facts-a-chases-lines-
// record.ts), in the same words the engine wrote before (heroes/pursuits-and-the-catch-roll.ts). A rival's skill and
// the odds as a realm is shown them are written by theWordsOfAStatShown and theWordsOfTheOddsShown (heroes/effective-
// skills-and-hidden-heroes.ts), on the values alone, as the engine's statNote and oddsNote wrote them. A kind with no
// words here is a compile error (the `never` below).
import type { TheFactOfAChasesLine } from '../../engine/heroes/the-facts-a-chases-lines-record.ts';
import {
  theWordsOfAStatShown,
  theWordsOfTheOddsShown,
} from '../../engine/heroes/effective-skills-and-hidden-heroes.ts';

/** The words of one fact of a chase's lines. */
export function theWordsOfAChasesLine(fact: TheFactOfAChasesLine): string {
  switch (fact.kind) {
    case "a chaser's quarry is beyond catching":
      return `${fact.heroName}'s quarry is beyond catching now — the chase is called off.`;
    case 'a chaser loses the trail of a quarry who leaves no track':
      return `${fact.heroName} follows the trail of ${fact.quarryName} into ${fact.provinceName ?? 'the wilds'} and loses it utterly — the man seems to leave no track at all.`;
    case "a chaser's quarry vanishes into the shadows":
      return `${fact.heroName} presses the chase after ${fact.quarryName}, but the quarry melts into the shadows and is gone. (Vanish)`;
    case 'a chaser with a battle on his hands holds the chase over':
      return `${fact.heroName} has a battle on their hands in ${fact.provinceName ?? 'the field'} this season — the chase after ${fact.quarryName} must wait.`;
    case "a chaser's horses can go no further this year":
      return `${fact.heroName} can drive their horses no further this year — the chase after ${fact.quarryName} stalls.`;
    case 'a chaser finds no road closer to his quarry':
      return `${fact.heroName} can find no road that brings them closer to ${fact.quarryName} — the trail goes cold.`;
    case 'a chaser has no ships left to follow his quarry to sea':
      return `${fact.heroName} has no ships left to follow ${fact.quarryName} out onto the water.`;
    case "a chaser's column is spent":
      return `${fact.heroName}'s column is spent and can march no further after ${fact.quarryName}.`;
    case "a chaser presses on hard on his quarry's trail":
      return `${fact.heroName} presses on into ${fact.provinceName}, hard on the trail of ${fact.quarryName}.`;
    case 'a chaser rides in and finds his quarry':
      return `${fact.heroName} rides into ${fact.provinceName} and finds ${fact.quarryName} there.`;
    case 'a chaser rolls to close on his quarry':
      return `📊 Pursuit — ${fact.heroName} (Spy ${String(fact.spy)}) closing on ${fact.quarryName}${theWordsOfAStatShown(fact.quarrysSpy)}: ${theWordsOfTheOddsShown(fact.odds)}`;
    case "a chaser's quarry slips away":
      return `${fact.quarryName} slips away through the country around ${fact.provinceName} — ${fact.heroName} keeps the trail but cannot close.`;
    case 'a chaser catches up with a quarry of his own realm and the columns join':
      return `${fact.heroName} catches up with ${fact.quarryName} in ${fact.provinceName} and the two columns join company.`;
    case 'a chaser overtakes a quarry whose realm is not at war with his':
      return `${fact.heroName} overtakes ${fact.quarryName} in ${fact.provinceName}, but ${fact.quarrysRealmName ?? 'their realm'} is not at war with ${fact.chasersRealmName ?? 'us'} — the two columns pass without bloodshed.`;
    case 'a chaser closes on his quarry on ground already a battlefield':
      return `${fact.heroName} closes on ${fact.quarryName} in ${fact.provinceName}, but the ground is already a battlefield this season — the reckoning must wait.`;
    case 'a chaser runs his quarry to ground and forces battle':
      return `⚔ ${fact.heroName} runs ${fact.quarryName} to ground in ${fact.provinceName} and forces battle!`;
    case 'a chaser carries the field but the province is still held':
      return fact.onlyItsGarrisonHolds
        ? `${fact.heroName} carries the field at ${fact.provinceName}, but its garrison still holds the province — the fight for it resumes next season.`
        : `${fact.heroName} carries the field at ${fact.provinceName}, but enemy forces still hold their ground — the province remains contested.`;
    case 'a chaser claims the province for his realm':
      return `${fact.heroName} claims ${fact.provinceName} for ${fact.realmName ?? 'their realm'}!`;
    case "a lone challenger rolls to break the ranks of his quarry's camp":
      return `📊 Breaking ranks — ${fact.heroName} (Spy ${String(fact.spy)}) slips toward ${fact.quarryName}'s tent through a camp of ${String(fact.unitCount)} unit${fact.unitCount !== 1 ? 's' : ''}${theWordsOfAStatShown(fact.quarrysTactical)}: ${theWordsOfTheOddsShown(fact.odds)}`;
    case 'a lone challenger is turned away by the sentries':
      return `${fact.heroName} runs ${fact.quarryName} to ground in ${fact.provinceName}, but the sentries of their column are awake — the challenger is turned away from the lines before reaching the commander, and the chase is abandoned.`;
    case "a quarry's realm learns a lone challenger came for him":
      return `👁 ${fact.heroName}${fact.realmTag} came for ${fact.quarryName} in ${fact.provinceName} — a lone challenger, turned away by the sentries before reaching the tent.`;
    case 'a lone challenger slips through the picket lines':
      return `${fact.heroName} slips through the picket lines of ${fact.quarryName}'s column in ${fact.provinceName} and forces the matter before the commander can rally the guard.`;
    case "a crowned quarry will not answer a commoner's challenge":
      return `${fact.heroName} corners ${fact.quarryName} in ${fact.provinceName}, but a crowned head does not stoop to answer every challenge — the King rides on.`;
    case 'a chaser finally corners his quarry':
      return `⚔ ${fact.heroName} finally corners ${fact.quarryName} in ${fact.provinceName}.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a chase's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
