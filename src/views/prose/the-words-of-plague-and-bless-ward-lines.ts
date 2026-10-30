// ── THE WORDS OF THE LINES OF THE PLAGUE AND THE BLESS WARD (plan P1-12d17: P1-12's Decisions of 2026-10-30,
// Decision 2) ──
// The views write the words of the facts the lines of the Plague and the Bless ward record (src/engine/magic/the-
// facts-plague-and-bless-ward-lines-record.ts), in the same words the engine wrote before (magic/plague-and-bless-
// ward.ts): the fallback for a caster not named, the units sickened joined, and the plural from the count.
import type { TheFactOfAPlagueOrBlessWardLine } from '../../engine/magic/the-facts-plague-and-bless-ward-lines-record.ts';

/** The words of a line of the Plague or the Bless ward (each of its kinds). */
export function theWordsOfAPlagueOrBlessWardLine(fact: TheFactOfAPlagueOrBlessWardLine): string {
  switch (fact.kind) {
    case "a Bless ward turns an enemy's spell aside":
      return `✨ A blessing lies over ${fact.provinceName} — ${fact.casterName ?? 'a hostile mage'}'s ${fact.spellName} washes over the sacred ground and does no harm.`;
    case "the Plague sickens a realm's troops in a province": {
      const names = fact.units.map((u) => `${u.unitName} (now ${u.quality})`).join(', ');
      const where = fact.theGarrison ? `the garrison of ${fact.provinceName}` : `your troops in ${fact.provinceName}`;
      return `☠ Plague sickens ${where}: ${names} lose an experience level.`;
    }
    case 'the Plague spreads into a province':
      return `☠ The plague spreads into ${fact.provinceName} — ${String(fact.affected)} of ${String(fact.tested)} humanoid unit${fact.tested !== 1 ? 's' : ''} sicken.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(
        `the lines of the Plague and the Bless ward have no words for ${JSON.stringify(aKindWithNoWords)}`,
      );
    }
  }
}
