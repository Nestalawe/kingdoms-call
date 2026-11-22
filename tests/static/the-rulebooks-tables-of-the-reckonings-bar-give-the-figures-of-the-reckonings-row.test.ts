// The rulebook's tables of the Reckoning's bar give the figures of the Reckoning's content row (B-06q). The row,
// KC_THE_RECKONINGS_NUMBERS (src/content/kingdoms-call-data.ts), holds the numbers the engine reads by its RECKONING_*
// names; the rulebook's "How to Win: The Reckoning" (src/kingdoms-call-rules.html) writes them out three ways:
// - the base bar's table, by the number of realms in the game (2 to 5, then "6 or more");
// - the three steps' words: the points the bar wears away a turn, the turn it may first, its floor; each ally's step
//   (the row's points over the number of realms, rounded) in a 4-, a 5- and a 6-realm game, and the ceiling;
// - the bar at a glance, by realms and allies: the base, plus each ally's step, never past the ceiling; a dash where
//   no such bloc can stand (fewer realms to ally with, or a game of three realms or fewer, where no alliance can be
//   sealed: the turn's diplomacy, `G.players.length <= 3`, not a number of the row).
// So a number changed in the row and not in the book, or in the book alone, turns this red.
// Level 0 (static): the rulebook's source and the content row are files; nothing of the engine runs. The figures are
// the book's words, so no lower level holds them.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { KC_THE_RECKONINGS_NUMBERS } from '../../src/content/kingdoms-call-data.ts';
import { ROOT } from '../../tools/build.ts';

const ROW = KC_THE_RECKONINGS_NUMBERS;
const BOOK = fs.readFileSync(path.join(ROOT, 'src', 'kingdoms-call-rules.html'), 'utf8');
/** A cell's or a step's words: its tags taken off until none is left (a tag a removal leaves whole goes too). */
const stripTags = (s: string) => {
  let t = s;
  for (;;) {
    const u = t.replace(/<[^>]*>/g, '');
    if (u === t) return u.replace(/\s+/g, ' ').trim();
    t = u;
  }
};
/** The rows of the first table after `anchor` in the book, each a list of its cells' words. */
const theRowsOfTheTableAfter = (anchor: string): string[][] => {
  const from = BOOK.indexOf(anchor);
  const table = from < 0 ? '' : BOOK.slice(from, BOOK.indexOf('</table>', from));
  return [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...(r[1] ?? '').matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => stripTags(c[1] ?? '')),
  );
};
/** The words of the step numbered `n` of the bar's three steps. */
const theStep = (n: number) => {
  const m = new RegExp(`<div class="step"><span class="n">${String(n)}</span>([\\s\\S]*?)</div>`).exec(BOOK);
  return stripTags(m?.[1] ?? '');
};
const THE_BAR_BY_THE_NUMBER_OF_REALMS: Readonly<Record<number, number | undefined>> = ROW.theBarByTheNumberOfRealms;
const theBarAlone = (realms: number) => THE_BAR_BY_THE_NUMBER_OF_REALMS[realms] ?? ROW.theBarWithSixRealmsOrMore;
const theAllysStep = (realms: number) =>
  Math.round(ROW.thePointsOverTheNumberOfRealmsThatMakeEachAllysStep / Math.max(2, realms));

test("the base bar's table gives the row's bar for each number of realms", () => {
  const [head, bars] = theRowsOfTheTableAfter('<tr><th>Realms</th>');
  expect(head, 'the table of the base bar was found').toEqual(['Realms', '2', '3', '4', '5', '6 or more']);
  const theRows = [2, 3, 4, 5].map((n) => `${String(THE_BAR_BY_THE_NUMBER_OF_REALMS[n])}%`);
  expect(bars, "each number of realms's base bar").toEqual([
    'Base bar',
    ...theRows,
    `${String(ROW.theBarWithSixRealmsOrMore)}%`,
  ]);
  expect(Object.keys(ROW.theBarByTheNumberOfRealms), 'the row gives a bar of its own to 2 to 5 realms only').toEqual([
    '2',
    '3',
    '4',
    '5',
  ]);
});

test("the three steps' words give the row's erosion, its floor, each ally's step and the ceiling", () => {
  const two = theStep(2);
  expect(two, 'step 2 was found').not.toBe('');
  expect(two).toContain(
    `Less ${String(ROW.thePointsTheBarWearsAwayEachTurn)} points for every turn the world has waited.`,
  );
  expect(two).toContain(`by the end of Turn ${String(ROW.theFirstTurnAtWhoseEndTheBarMayWearAway)},`);
  expect(two).toContain(`the base falls ${String(ROW.thePointsTheBarWearsAwayEachTurn)} percentage points`);
  expect(two).toContain(`down to a floor of ${String(ROW.theFloorTheBarNeverFallsBelow)}%, and no lower.`);
  const three = theStep(3);
  expect(three, 'step 3 was found').not.toBe('');
  expect(three).toContain(
    `that is ${String(ROW.thePointsOverTheNumberOfRealmsThatMakeEachAllysStep)} ÷ the number of realms, rounded: ` +
      `+${String(theAllysStep(4))} points each in a 4-realm game, +${String(theAllysStep(5))} in a 5-realm, ` +
      `+${String(theAllysStep(6))} in a 6-realm.`,
  );
  expect(three).toContain(`the bar never passes ${String(ROW.theCeilingNoBlocsBarPasses)}%.`);
});

test('the bar at a glance gives, for each number of realms and allies, the base plus their steps, never past the ceiling', () => {
  const [head, ...rows] = theRowsOfTheTableAfter('<caption>The bar at a glance');
  expect(head, 'the table at a glance was found').toEqual([
    'Realms in the game',
    'Alone',
    '+1 ally',
    '+2 allies',
    '+3 allies',
    '+4 allies',
  ]);
  expect(
    rows.map((r) => r[0]),
    'its realms',
  ).toEqual(['3', '4', '5', '6']);
  for (const row of rows) {
    const realms = Number(row[0]);
    const theCells = [0, 1, 2, 3, 4].map((allies) =>
      allies > 0 && (allies > realms - 1 || realms <= 3)
        ? '—'
        : `${String(Math.min(ROW.theCeilingNoBlocsBarPasses, theBarAlone(realms) + theAllysStep(realms) * allies))}%`,
    );
    expect(row.slice(1), `${String(realms)} realms, alone and with each number of allies`).toEqual(theCells);
  }
});
