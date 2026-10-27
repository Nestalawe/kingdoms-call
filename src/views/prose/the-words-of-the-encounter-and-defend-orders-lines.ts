// ── THE WORDS OF THE ENCOUNTER AND DEFEND ORDERS' LINES (plan P1-12d6: P1-12's Decisions of 2026-10-26, Decisions 6
// and 7) ──
// The views write the words of each fact the Encounter Character and Defend orders' lines record
// (src/engine/orders/the-facts-the-encounter-and-defend-orders-lines-record.ts), in the same words the engine wrote
// before (orders/encounter-and-defend-orders-chasing-a-hero-down-and-keeping-watch.ts). A kind with no words here is a
// compile error (the `never` below).
import type { TheFactOfAnEncounterOrDefendOrdersLine } from '../../engine/orders/the-facts-the-encounter-and-defend-orders-lines-record.ts';

/** The words of one fact of the Encounter Character and Defend orders' lines. */
export function theWordsOfAnEncounterOrDefendOrdersLine(fact: TheFactOfAnEncounterOrDefendOrdersLine): string {
  switch (fact.kind) {
    case 'a hunter finds no quarry to hunt down':
      return `${fact.heroName} casts about for a quarry to hunt down but finds no trail to follow.`;
    case 'a hero cannot set out to encounter himself':
      return `${fact.heroName} cannot set out to encounter themself.`;
    case "a charmed hero will not hunt a hero of his true lord's realm":
      return `${fact.heroName} will not hunt ${fact.quarryName} — the Charm bends their will, but not so far as to turn them on their own lord's people.`;
    case 'a common hero may not run down a rival king':
      return `${fact.heroName} sets out after ${fact.quarryName}, but a rival king does not answer to a common hero — only a king may run down another king. The chase is abandoned.`;
    case 'a hunter finds no trail of a cloaked quarry':
      return `${fact.heroName} sets out after ${fact.quarryName}, but they are cloaked and leave no trail to follow.`;
    case 'a hunter finds no trail of a quarry who has vanished':
      return `${fact.heroName} sets out after ${fact.quarryName}, but there is no trail to follow — the quarry has vanished into the shadows.`;
    case 'a hunter sets out to run down his quarry':
      return `${fact.heroName} sets out to run down ${fact.quarryName} and will not turn aside until the matter is settled.`;
    case "a defender's watch is spent in this season's battle":
      return `🛡 ${fact.heroName} has met this season's threat in battle — their Defend order is done, and they set no new watch until ordered to Defend in a later season.`;
    case 'a defender keeps the watch he set in an earlier season':
      return fact.hasNoColumn
        ? `🛡 ${fact.heroName} still lies in wait about ${fact.provinceName}.`
        : `🛡 ${fact.heroName} keeps the watch in ${fact.provinceName}.`;
    case 'a defender with no column lies in wait to ambush':
      return `${fact.heroName} melts into the country around ${fact.provinceName} and lies in wait — with no column at their back they cannot bar a road, but they will try to ambush any enemy who ventures into these lands (their Spy craft decides whether they can spring the trap).`;
    case 'a defender makes camp and sets a watch':
      return `${fact.heroName} makes camp in ${fact.provinceName} and sets a watch — their column will answer any incursion into the lands about them for the rest of the year.`;
    case 'a defender sets a watch over the country around another province':
      return `${fact.heroName} sets a watch from ${fact.provinceName} over the country around ${fact.centreProvinceName} — their column will ride to meet any incursion there for the rest of the year.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the Encounter and Defend orders' lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
