// ── THE WORDS OF THE LINES OF RELATIONS AND CAPTURES (plan P1-12d17: P1-12's Decisions of 2026-10-30, Decision 2) ──
// The views write the words of the facts the lines of relations and captures record (src/engine/realms/the-facts-
// relations-and-captures-lines-record.ts), in the same words the engine wrote before (realms/relations-and-
// captures.ts): the fallbacks for a conqueror or a realm not named, the units that rose joined, and the plurals from
// the counts.
import type { TheFactOfARelationsAndCapturesLine } from '../../engine/realms/the-facts-relations-and-captures-lines-record.ts';

/** The words of a line of relations and captures (each of its kinds). */
export function theWordsOfARelationsAndCapturesLine(fact: TheFactOfARelationsAndCapturesLine): string {
  switch (fact.kind) {
    case 'a consecration is broken as its province is captured':
      return `✨ The consecration of ${fact.provinceName} is broken — it has passed from ${fact.realmName}'s hands, and the hallowed light departs. The crown may sanctify new ground in its place.`;
    case "a conquering column casts down a province's altars": {
      const rose = fact.unitsThatRose.map((u) => `${u.unitName} (now ${u.quality})`);
      return `✨ ${fact.heroName}'s column casts down the altars of ${fact.provinceName} — the ground is holy no longer. ${rose.length ? `Flushed with the deed, ${rose.join(', ')} gain${rose.length === 1 ? 's' : ''} an experience level.` : fact.theTroopsMayRise ? 'None of the troops is the better for it.' : 'The troops take no pride in the sacrilege.'}`;
    }
    case 'a realm is told a province has been captured from it': {
      const n = fact.unitsLed;
      const led = n === null ? '' : n > 0 ? `, leading ${String(n)} unit${n !== 1 ? 's' : ''}` : ', leading no units';
      return `🏴 ${fact.provinceName} has been captured from you by ${fact.conquerorName ?? 'an unknown commander'} (${fact.realmName ?? 'an enemy realm'})${led}.`;
    }
    case 'an Evil conqueror presses the beaten folk into the garrison in chains':
      return `⛓ Enslavement: ${fact.heroName} presses the beaten folk of ${fact.provinceName} into service — a Green ${fact.unitType} joins the garrison in chains, but the province seethes (−1 tax for 3 turns).`;
    case 'an Evil conqueror finds no humanoid folk to enslave':
      return `⛓ ${fact.heroName} would enslave ${fact.provinceName}, but there are no humanoid folk here to press — the forces plunder instead.`;
    case "an Evil conqueror's forces plunder a province":
      return `⚔ Evil looting: ${fact.heroName}'s forces plunder ${fact.provinceName} — ${String(fact.loot)}g seized immediately!`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the lines of relations and captures have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
