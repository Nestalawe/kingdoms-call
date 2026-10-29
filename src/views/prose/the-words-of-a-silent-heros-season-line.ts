// ── THE WORDS OF A SILENT HERO'S SEASON LINE (plan P1-12d15: P1-12's Decisions of 2026-10-29, Decision 3) ──
// The views write the words of each fact a silent hero's season line records (src/engine/turn/the-facts-a-silent-heros-
// season-line-records.ts), in the same words the engine wrote before (turn/log-line-helpers.ts, noteSilentHeroes): a
// province with no name "the field". A kind with no words here is a compile error (the `never` below).
import type { TheFactOfASilentHerosSeasonLine } from '../../engine/turn/the-facts-a-silent-heros-season-line-records.ts';

/** The words of a silent hero's season line. */
export function theWordsOfASilentHerosSeasonLine(fact: TheFactOfASilentHerosSeasonLine): string {
  switch (fact.kind) {
    case 'a hero with no line of his own leaves a province and ends the season in another':
      return `${fact.heroName} leaves ${fact.fromProvinceName ?? 'the field'} and ends the season in ${fact.provinceName ?? 'the field'}.`;
    case 'a hero with no line of his own remains where he is this season':
      return `${fact.heroName} remains in ${fact.provinceName ?? 'the field'} this season.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`a silent hero's season line has no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
