// ── THE WORDS OF A STRANDING AT SEA'S LINES (plan P1-12d14: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact a stranding at sea's lines record (src/engine/units/the-facts-a-stranding-at-
// seas-lines-record.ts), in the same words the engine wrote before (units/sea-lift-stranding-and-retreats.ts,
// settleStrandedAtSea). strandLabel, which the engine still calls for the army orders' and the sea lift's lines, names
// each unit the fact copied as the line was told. A kind with no words here is a compile error (the `never` below).
import type { TheFactOfAStrandingAtSeasLine } from '../../engine/units/the-facts-a-stranding-at-seas-lines-record.ts';
import { strandLabel } from '../../engine/units/sea-lift-stranding-and-retreats.ts';

/** Why the column put units ashore: the words its caller handed in, else "too few hulls left afloat …". */
function whyTheColumnIsShort(why: string | null): string {
  return why ?? 'too few hulls left afloat to carry the whole column';
}

/** The words of one fact of a stranding at sea's lines. */
export function theWordsOfAStrandingAtSeasLine(fact: TheFactOfAStrandingAtSeasLine): string {
  switch (fact.kind) {
    case 'bound units a column cannot carry over open water dissolve':
      return `✨ ${fact.heroName}'s ${fact.units.map(strandLabel).join(', ')} cannot be carried over open water — the binding fails and ${fact.units.length === 1 ? 'it dissolves' : 'they dissolve'}.`;
    case 'units a column cannot carry are put ashore and join a garrison':
      return `⚓ ${fact.heroName} has ${whyTheColumnIsShort(fact.why)}: ${fact.units.map(strandLabel).join(', ')} ${fact.units.length === 1 ? 'is' : 'are'} put ashore at ${fact.shoreName} and ${fact.units.length === 1 ? 'joins' : 'join'} its garrison (the weakest go first).`;
    case "units a column cannot carry hold the realm's sea province":
      return `⚓ ${fact.heroName} has ${whyTheColumnIsShort(fact.why)}, and no shore of the realm lies alongside: ${fact.units.map(strandLabel).join(', ')} ${fact.units.length === 1 ? 'is' : 'are'} left holding ${fact.provinceName} as its garrison (the weakest go first).`;
    case 'units a column cannot carry hold and claim an unowned sea province':
      return `⚓ ${fact.heroName} has ${whyTheColumnIsShort(fact.why)}, and no shore of the realm lies alongside: ${fact.units.map(strandLabel).join(', ')} ${fact.units.length === 1 ? 'is' : 'are'} left holding ${fact.provinceName}, which they claim for ${fact.realmName ?? 'the realm'} as its garrison (the weakest go first).`;
    case 'units a column cannot carry are lost at sea':
      return `⚓ ${fact.heroName} has ${whyTheColumnIsShort(fact.why)}, no shore of the realm lies alongside and ${fact.provinceName} is ${fact.waters === null ? 'waters its neutral defenders still hold' : `${fact.waters.realmName ?? 'another realm'}'s waters`}: ${fact.units.map(strandLabel).join(', ')} ${fact.units.length === 1 ? 'is' : 'are'} lost at sea.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a stranding at sea's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
