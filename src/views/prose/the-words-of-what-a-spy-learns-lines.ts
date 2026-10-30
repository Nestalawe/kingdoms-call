// ── THE WORDS OF THE LINES OF WHAT A SPY LEARNS (plan P1-12d17: P1-12's Decisions of 2026-10-30, Decision 2) ──
// The views write the words of the facts the lines of what a spy learns record (src/engine/espionage/the-facts-what-a-
// spy-learns-lines-record.ts), in the same words the engine wrote before (espionage/what-a-spy-learns.ts,
// applySpySuccess): the fallbacks for a realm with no name, the defenders joined, the plurals from the counts, and the
// roll's mark (fmtRoll, the engine's).
import type { TheFactOfWhatASpyLearnsLine } from '../../engine/espionage/the-facts-what-a-spy-learns-lines-record.ts';
import { fmtRoll } from '../../engine/dice-and-army-names.ts';

/** The words of a line of what a spy learns (each of its kinds). */
export function theWordsOfWhatASpyLearnsLine(fact: TheFactOfWhatASpyLearnsLine): string {
  switch (fact.kind) {
    case 'a spy learns who holds a province, its tax and its defenders': {
      const defs = fact.defenders.map((d) => `${d.quality} ${d.type}`).join(', ') || 'none';
      return `${fact.heroName} spies on ${fact.provinceName}: controlled by ${fact.ownerRealmName ?? 'no-one'}, tax ${String(fact.tax)}g, defenders: ${defs}.`;
    }
    case "a spy learns a king's home's tax income and heroes":
      return `[Intelligence] Home-capital intelligence on ${fact.realmName}: the crown draws ~${String(fact.taxIncome)}g in tax income each turn and commands ${String(fact.heroes)} hero${fact.heroes === 1 ? '' : 'es'} beyond the king.`;
    case "a spy rifles a king's archives for a discovery":
      return `[Intelligence] 📊 Discovery theft — ${fact.heroName} (Spy ${String(fact.spyLevel)}) rifling ${fact.realmName}'s archives: ${fmtRoll(fact.chance, fact.roll)}`;
    case "a spy copies a secret from a king's archives":
      return `[Intelligence] 🗝 ${fact.heroName} copies the secret of "${fact.discoveryName}" from ${fact.realmName}'s archives — your scholars now hold it as their own.`;
    case "a province's watch catches a rival's agents prying": {
      const byName = fact.pryingRealmName ?? (fact.theSpyServesARealm ? 'an unknown power' : 'unknown agents');
      return `[Intelligence] 🕵 Counter-intelligence: your watch in ${fact.provinceName} caught ${byName}'s agents prying this turn.`;
    }
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the lines of what a spy learns have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
