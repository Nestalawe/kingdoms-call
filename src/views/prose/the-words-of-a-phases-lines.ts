// ── THE WORDS OF A PHASE'S LINES (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact a phase's stages and intents record (src/engine/turn/the-facts-a-phases-lines-
// record.ts), in the same words the engine wrote before (turn/phase-stages-start-intents-and-reactions-orders-in-two-
// tiers-and-end.ts, turn/phase-intents-and-dependency-ordering.ts): a province with no name "the province". A kind with
// no words here is a compile error (the `never` below).
import type { TheFactOfAPhasesLine } from '../../engine/turn/the-facts-a-phases-lines-record.ts';

/** The words of one fact of a phase's lines. */
export function theWordsOfAPhasesLine(fact: TheFactOfAPhasesLine): string {
  switch (fact.kind) {
    case 'a phase begins':
      return `— ${fact.seasonName} —`;
    case "Herbal Lore dresses a hero's wounds from the previous season":
      return `🌿 Herbal Lore: ${fact.heroName}'s wounds from the previous season are dressed with healing herbs — 40% of the ${String(fact.damage)} damage taken is mended. +${String(fact.healed)} HP (${String(fact.hp)}/${String(fact.maxHp)}).`;
    case 'a hero hired this phase will act from the next':
      return `${fact.heroName} was hired this phase and will be ready to act from the next phase.`;
    case 'a march is cancelled while the hero is locked in an unresolved battle':
      return `${fact.heroName} is still locked in the unresolved battle for ${fact.provinceName} and cannot march away — the fight must be seen through before they can move on.`;
    case 'a march is cancelled because the hero has fought a battle this phase':
      return `${fact.heroName} has already fought a battle this phase and cannot march on to start another — one battle per phase.`;
    case "a fallen hero's remaining orders go unanswered":
      return `${fact.heroName} has fallen — their remaining orders for this turn go unanswered.`;
    case "a march is pinned head-on by an enemy column marching into the hero's province":
      return `${fact.heroName} breaks camp for ${fact.destinationName}, but ${fact.foeName}'s banners are already cresting the hills toward ${fact.provinceName ?? 'the province'} — there is no time to march past one another. ${fact.heroName} turns their column about and stands to defend.`;
    case "a march is pinned by an enemy force entering the hero's province first":
      return `${fact.heroName} is under orders to march on ${fact.destinationName}, but an enemy force enters ${fact.provinceName ?? 'the province'} before the column can clear the gates. ${fact.heroName} stays to defend.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a phase's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
