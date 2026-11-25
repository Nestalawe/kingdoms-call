// The rulebook's table of a battle's margin bands and its carry-on words give the figures of the battle's content rows
// (B-06ay1). The rows, KC_A_BATTLES_MARGIN_BANDS_AND_EACH_SIDES_CHANCES_IN_THEM and
// KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS (src/content/kingdoms-call-data.ts), hold the numbers the engine
// reads by its BATTLE_MARGIN_BANDS and CARRYON_DEATH_* names; the rulebook's "How a Battle Is Fought"
// (src/kingdoms-call-rules.html) writes them out:
// - the table of the result margin: each band's name, the margin it runs from (the band before's top, 0 for the first)
//   to its own top (the last band: more than the band before's top), and its five chances, in whole or part per cent;
// - the sentence under it: "+35% per carried-over round, to ×2.5", the carry-on's step and the most times it scales.
// So a number changed in a row and not in the book, or in the book alone, turns this red.
// Level 0 (static): the rulebook's source and the content rows are files; nothing of the engine runs. The figures are
// the book's words, so no lower level holds them.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  KC_A_BATTLES_MARGIN_BANDS_AND_EACH_SIDES_CHANCES_IN_THEM as BANDS,
  KC_A_CARRIED_ON_BATTLES_DEATH_CHANCES_BY_ITS_ROUNDS as CARRY_ON,
} from '../../src/content/kingdoms-call-data.ts';
import { ROOT } from '../../tools/build.ts';

const BOOK = fs.readFileSync(path.join(ROOT, 'src', 'kingdoms-call-rules.html'), 'utf8');
/** A cell's or a sentence's words: its tags taken off until none is left, and the book's `&gt;` read as `>`. */
const theWords = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u.replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
    t = u;
  }
};
/** The rows of the first table after `anchor` in the book, each a list of its cells' words. */
const theRowsOfTheTableAfter = (anchor: string): string[][] => {
  const from = BOOK.indexOf(anchor);
  const table = from < 0 ? '' : BOOK.slice(from, BOOK.indexOf('</table>', from));
  return [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...(r[1] ?? '').matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => theWords(c[1] ?? '')),
  );
};
/** A share as the book writes it, in per cent: 0.04 is "4", 0.155 would be "15.5". */
const perCent = (share: number) => String(Number((share * 100).toFixed(6)));
const THE_TABLES_ANCHOR = '<caption>Result margin';

test("the table of the result margin gives each band's name, margin and five chances as the bands' row", () => {
  const [head, ...rows] = theRowsOfTheTableAfter(THE_TABLES_ANCHOR);
  expect(head, 'the table of the margin bands was found').toEqual([
    'Band',
    'Margin',
    'Winner unit death',
    'Loser unit death',
    'Winner quality gain',
    'Loser quality gain',
    'Loser quality loss',
  ]);
  const theRowsTheBandsGive = BANDS.map((band, i) => {
    const below = i === 0 ? 0 : (BANDS[i - 1]?.max ?? Number.NaN);
    const margin = i === BANDS.length - 1 ? `>${perCent(below)}%` : `${perCent(below)}–${perCent(band.max)}%`;
    return [
      `${band.slug.charAt(0).toUpperCase()}${band.slug.slice(1)}`,
      margin,
      ...[band.winDeath, band.loseDeath, band.winXP, band.loseXP, band.loseDemote].map((c) => `${perCent(c)}%`),
    ];
  });
  expect(rows, "each band, its margin and its chances (the bands' row, in order)").toEqual(theRowsTheBandsGive);
});

test("the sentence under the table gives the carry-on's step a round and the most times it scales", () => {
  const from = BOOK.indexOf(THE_TABLES_ANCHOR);
  const after = from < 0 ? '' : BOOK.slice(BOOK.indexOf('</table>', from));
  const sentence = theWords(/<p>([\s\S]*?)<\/p>/.exec(after)?.[1] ?? '');
  expect(sentence, 'the sentence under the table was found').toContain('Death chances are per unit');
  expect(sentence).toContain(
    `(+${perCent(CARRY_ON.theStepEachCarriedOverRoundAdds)}% per carried-over round, ` +
      `to ×${String(CARRY_ON.theMostTimesTheyScaleTo)})`,
  );
});
