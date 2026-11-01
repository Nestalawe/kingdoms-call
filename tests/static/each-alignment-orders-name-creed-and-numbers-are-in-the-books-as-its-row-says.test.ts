// Each alignment order's name, creed and numbers are in the books as its row says (plan P1-19's alignment orders,
// Decision 3): for every row of the content's alignment orders (src/content/alignment-orders-their-keys-names-creeds-
// numbers-and-words.ts, the rows the turn's gate reads, and the turn, the dispatch and the bots will), the rulebook's
// orders table ("Your alignment's signature action") gives its name in its creed's row, with the "king" mark if and only
// if the king alone gives it; the rulebook's creed section ("The Seven Alignments") has an entry of that name, marked
// "(king" if and only if the king alone gives it, stating each of its numbers in the words its row gives; and the
// intro's table "The seven alignments" gives its name as its creed's signature action, with the numbers its row says
// the intro states. Neither table names a signature order with no row. So a number, a name, a creed or the king's
// mark changed in content, and not in the books (or in the books, and not in content), turns this red.
// Level 0 (static): the content's rows imported (plain data), both books read as written in src/; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  THE_ALIGNMENT_ORDERS,
  type ANumberOfAnAlignmentOrder,
  type AnAlignmentOrder,
} from '../../src/content/alignment-orders-their-keys-names-creeds-numbers-and-words.ts';
import { ROOT } from '../../tools/build.ts';

const RULEBOOK = fs.readFileSync(path.join(ROOT, 'src', 'kingdoms-call-rules.html'), 'utf8');
const INTRO = fs.readFileSync(path.join(ROOT, 'src', 'kingdoms-call-rules-intro.html'), 'utf8');
const ROWS: readonly AnAlignmentOrder[] = Object.values(THE_ALIGNMENT_ORDERS);
const KING = '<span class="pill k">king</span>';

/** The words a reader sees: the markup dropped, the page's entities written out, the spaces made one. */
const asAReaderSeesIt = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** The part of a page from the first `from` to the first `to` after it. */
function thePartOf(page: string, from: string, to: string): string {
  const start = page.indexOf(from);
  if (start < 0) throw new Error(`the page has no ${from}`);
  const end = page.indexOf(to, start + from.length);
  return page.slice(start, end < 0 ? undefined : end);
}

/** Each row of a table's html, its cells' html. */
const theRowsOf = (table: string): string[][] =>
  [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((tr) =>
    [...(tr[1] ?? '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((td) => td[1] ?? ''),
  );

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const THE_TURN_IT_LASTS_UNTIL: Readonly<Record<number, string>> = { 1: 'the following turn' };
/** A number as the books write it, as its row says. */
function written(n: ANumberOfAnAlignmentOrder): string {
  if (n.writtenAs === 'as it is') return String(n.value);
  const words = n.writtenAs === 'as a word' ? WORDS : THE_TURN_IT_LASTS_UNTIL;
  const w = typeof n.value === 'number' ? words[n.value] : undefined;
  if (w === undefined) throw new Error(`no words for ${String(n.value)} ${n.writtenAs}`);
  return w;
}

/** The books' tables and the creed sections, as the test reads them. */
interface TheBooks {
  readonly rulebook: string;
  readonly intro: string;
}

/** The rulebook's orders table's rows. */
const theOrdersTable = (b: TheBooks) =>
  theRowsOf(thePartOf(b.rulebook, "<h4>Your alignment's signature action</h4>", '</table>'));
/** The intro's table of the alignments' rows. */
const theIntrosTable = (b: TheBooks) => theRowsOf(thePartOf(b.intro, '<h3>The seven alignments</h3>', '</table>'));
/** The entries of a creed's section in the rulebook, as a reader sees each. */
function theEntriesOfItsCreedsSection(b: TheBooks, creed: string): string[] {
  const section = thePartOf(b.rulebook, '<section id="alignments">', '</section>');
  const heading = new RegExp(`<h3>[^<]* ${creed} <span`);
  const at = section.search(heading);
  if (at < 0) return [];
  const next = section.indexOf('<h3>', at + 4);
  const its = section.slice(at, next < 0 ? undefined : next);
  return [...its.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((li) => asAReaderSeesIt(li[1] ?? ''));
}

/** What a row breaks in the books: each place its name, creed, king's mark or a number isn't as the row says. */
function whatARowBreaks(row: AnAlignmentOrder, b: TheBooks): string[] {
  const broken: string[] = [];
  const named = `<strong>${row.name}</strong>`;
  // the rulebook's orders table
  const inTheTable = theOrdersTable(b).filter((cells) => cells[1]?.startsWith(named));
  const [cells] = inTheTable;
  if (inTheTable.length !== 1 || !cells) broken.push(`the orders table has ${String(inTheTable.length)} rows of it`);
  else {
    if (!asAReaderSeesIt(cells[0] ?? '').endsWith(` ${row.creed}`)) broken.push("the orders table's creed");
    if ((cells[1] ?? '').includes(KING) !== row.theKingAlone) broken.push("the orders table's king mark");
  }
  // the rulebook's creed section
  const entries = theEntriesOfItsCreedsSection(b, row.creed).filter((e) => e.startsWith(row.name));
  const [entry] = entries;
  if (entries.length !== 1 || entry === undefined)
    broken.push(`its creed's section has ${String(entries.length)} entries of it`);
  else {
    if (entry.startsWith(`${row.name} (king`) !== row.theKingAlone) broken.push("its creed's section's king mark");
    for (const [what, n] of Object.entries(row.theNumbers)) {
      const words = n.inItsCreedsSection.replace('{N}', written(n));
      if (!entry.includes(words)) broken.push(`its creed's section's ${what}: "${words}"`);
    }
  }
  // the intro's table
  const inTheIntro = theIntrosTable(b).filter((c) => (c[0] ?? '').includes(`<strong>${row.creed}</strong>`));
  const action = inTheIntro[0]?.at(-1) ?? '';
  if (inTheIntro.length !== 1 || !action.startsWith(named)) broken.push("the intro's table's name");
  else
    for (const [what, n] of Object.entries(row.theNumbers)) {
      if (n.inTheIntrosTable === undefined) continue;
      const words = n.inTheIntrosTable.replace('{N}', written(n));
      if (!asAReaderSeesIt(action).includes(words)) broken.push(`the intro's table's ${what}: "${words}"`);
    }
  return broken;
}

/** The names of the signature orders a table gives (a cell that opens with a name in bold). */
const theOrdersNamed = (rows: readonly string[][], cell: (cells: string[]) => string | undefined): string[] =>
  rows.flatMap((cells) => {
    const m = /^<strong>([^<]+)<\/strong>/.exec(cell(cells) ?? '');
    return m?.[1] ? [m[1]] : [];
  });

const BOOKS: TheBooks = { rulebook: RULEBOOK, intro: INTRO };

test.for(ROWS.map((row) => [row.name, row] as const))(
  '%s: its name, creed, king mark and numbers are in both books as its row says',
  ([, row]) => {
    expect(whatARowBreaks(row, BOOKS)).toEqual([]);
  },
);

test('neither table names a signature order with no row, and each creed has one order at most', () => {
  const names = ROWS.map((row) => row.name);
  expect(theOrdersNamed(theOrdersTable(BOOKS), (cells) => cells[1])).toEqual(names);
  expect(theOrdersNamed(theIntrosTable(BOOKS), (cells) => cells.at(-1)).sort()).toEqual([...names].sort());
  expect(new Set(ROWS.map((row) => row.creed)).size).toBe(ROWS.length);
});

test("the rows' numbers are the ones the books state today", () => {
  expect(
    Object.fromEntries(
      ROWS.map((row) => [row.name, Object.fromEntries(Object.entries(row.theNumbers).map(([k, n]) => [k, n.value]))]),
    ),
  ).toEqual({
    Consecrate: {},
    'Call to Arms': { theGradeMustered: 'Green' },
    Broker: { thePriceOfWordFromAProvince: 2 },
    'Harvest the Field': { thePrice: 2 },
    'Perform Rite': { theWildHuntsBeasts: 2, theWildHuntsTurnsMore: 1, theBloodOfferingsGrades: 2 },
  });
});

// Planted: a number changed in a row alone, or in the rulebook or the intro alone; a king's mark or a creed changed in a
// row alone; each is found.
test('planted, a number, a king mark or a creed in a row alone, or a number in a book alone, are found', () => {
  const broker = THE_ALIGNMENT_ORDERS.broker;
  const harvest = THE_ALIGNMENT_ORDERS['harvest-the-field'];
  const rite = THE_ALIGNMENT_ORDERS['perform-rite'];
  const aPrice = (row: AnAlignmentOrder, what: string, value: number): AnAlignmentOrder => {
    const n = row.theNumbers[what];
    if (!n) throw new Error(`no ${what}`);
    return { ...row, theNumbers: { ...row.theNumbers, [what]: { ...n, value } } };
  };
  expect(whatARowBreaks(aPrice(broker, 'thePriceOfWordFromAProvince', 3), BOOKS)).toEqual([
    `its creed's section's thePriceOfWordFromAProvince: "has ever seen for 3g"`,
  ]);
  expect(whatARowBreaks(aPrice(harvest, 'thePrice', 3), BOOKS)).toEqual([
    `its creed's section's thePrice: "as a Skeletal unit for 3g"`,
    `the intro's table's thePrice: "from a grave for 3 gold"`,
  ]);
  expect(whatARowBreaks(aPrice(rite, 'theWildHuntsBeasts', 3), BOOKS)).toEqual([
    `its creed's section's theWildHuntsBeasts: "the Wild Hunt binds three of"`,
  ]);
  expect(() => whatARowBreaks(aPrice(rite, 'theWildHuntsTurnsMore', 2), BOOKS)).toThrow(/no words for 2/);
  expect(whatARowBreaks({ ...harvest, theKingAlone: true }, BOOKS)).toEqual([
    "the orders table's king mark",
    "its creed's section's king mark",
  ]);
  expect(whatARowBreaks({ ...broker, creed: 'Good' }, BOOKS)).toEqual([
    "the orders table's creed",
    "its creed's section has 0 entries of it",
    "the intro's table's name",
  ]);
  const aBookWith = (from: string, to: string, inTheIntro = false): TheBooks => {
    const page = inTheIntro ? INTRO : RULEBOOK;
    expect(page.split(from)).toHaveLength(2);
    return inTheIntro ? { ...BOOKS, intro: page.replace(from, to) } : { ...BOOKS, rulebook: page.replace(from, to) };
  };
  expect(whatARowBreaks(broker, aBookWith('has ever seen for <strong>2g</strong>', 'has ever seen for 3g'))).toEqual([
    `its creed's section's thePriceOfWordFromAProvince: "has ever seen for 2g"`,
  ]);
  expect(whatARowBreaks(harvest, aBookWith('from a grave for 2 gold', 'from a grave for 3 gold', true))).toEqual([
    `the intro's table's thePrice: "from a grave for 2 gold"`,
  ]);
  expect(whatARowBreaks(rite, aBookWith('+2 quality tiers', '+1 quality tier'))).toEqual([
    `its creed's section's theBloodOfferingsGrades: "by +2 quality tiers"`,
  ]);
});
