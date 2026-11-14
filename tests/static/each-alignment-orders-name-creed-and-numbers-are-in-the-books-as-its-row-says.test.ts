// Each alignment order's name, creed and numbers are in the books as its row says (plan P1-19's alignment orders,
// Decision 3): for every row of the content's alignment orders (src/content/alignment-orders-their-keys-names-creeds-
// numbers-and-words.ts, the rows the turn's gate reads, and the turn, the dispatch and the bots will), the rulebook's
// orders table ("Your alignment's signature action") gives its name in its creed's row, with the "king" mark if and only
// if the king alone gives it; the rulebook's creed section ("The Seven Alignments") has an entry of that name, marked
// "(king" if and only if the king alone gives it, stating each of its numbers in the words its row gives; and the
// intro's table "The seven alignments" gives its name as its creed's signature action, with the numbers its row says
// the intro states. Neither table names a signature order with no row. The player page's two texts of its creed (the
// turn report's summary, ALIGNMENT_SUMMARIES; the join form's description, the alignment's DESCS, read by scan: the one
// string that opens on the creed in bold) name it, and state each number in the words its row gives for that place
// (P1-11d9). The GM's statistics label Consecrate, Call to Arms and the Broker by their rows' names; "Harvest Field" and
// "Rite" are the GM's own words. So a number, a name, a creed or the king's mark changed in content, and not in the
// books or the page's texts (or there, and not in content), turns this red. Since P1-19at1 each alignment ability's
// numbers (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts) are held the same way: each stated in
// the words its row gives in its creed's section of the rulebook, the rulebook's paragraph on gold, its creed's row of
// the rulebook's orders table (since P1-19at2), its creed's row of the intro's table, and the page's two texts of its
// creed, where its row says the place states it. Since P1-19av2 the alignments' ladder (THE_LADDER_OF_THE_ALIGNMENTS,
// a table beside the rows) is held so too: its rungs are the seven alignments in the order both books list them, and
// its numbers (the wage, the steps, the gulf, each rung's mercy) are in the rulebook's paragraphs on the alignments and
// on hiring, and its entry on the Cowardly, in the words the table gives.
// Level 0 (static): the content's rows imported (plain data), both books read as written in src/, the page's texts and
// the GM's labels read by their syntax trees (tests/lib/source.ts); nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  THE_ALIGNMENT_ORDERS,
  type ANumberOfAnAlignmentOrder,
  type AnAlignmentOrder,
} from '../../src/content/alignment-orders-their-keys-names-creeds-numbers-and-words.ts';
import {
  ALIGNMENT_ABILITIES,
  THE_LADDER_OF_THE_ALIGNMENTS,
  type ANumberOfAnAlignmentAbility,
  type ANumberOfTheLadder,
  type AnAlignmentAbility,
  type TheLadderOfTheAlignments,
} from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { ROOT } from '../../tools/build.ts';
import { entriesOf, stringsOf } from '../lib/source.ts';

const RULEBOOK = fs.readFileSync(path.join(ROOT, 'src', 'kingdoms-call-rules.html'), 'utf8');
const INTRO = fs.readFileSync(path.join(ROOT, 'src', 'kingdoms-call-rules-intro.html'), 'utf8');
const ROWS: readonly AnAlignmentOrder[] = Object.values(THE_ALIGNMENT_ORDERS);
const KING = '<span class="pill k">king</span>';

/** The markup dropped, again until none is left (a tag a first pass would leave behind is dropped too). */
function withoutItsTags(html: string): string {
  let text = html;
  for (let before = ''; before !== text;) {
    before = text;
    text = text.replace(/<[^>]*>/g, '');
  }
  return text;
}

/** The words a reader sees: the markup dropped, the page's entities written out, the spaces made one. */
const asAReaderSeesIt = (html: string): string =>
  withoutItsTags(html)
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
const THE_MULTIPLES: Readonly<Record<number, string>> = { 2: 'double' };
/** A number as the books write it, as its row says. */
function written(n: ANumberOfAnAlignmentOrder | ANumberOfAnAlignmentAbility | ANumberOfTheLadder): string {
  if (n.writtenAs === 'as it is') return String(n.value);
  if (n.writtenAs === 'as a percentage') return `${String(n.value)}%`;
  if (n.writtenAs === 'as a multiplier') return `×${String(n.value)}`;
  if (n.writtenAs === 'as a multiple') {
    const m = THE_MULTIPLES[n.value];
    if (m === undefined) throw new Error(`no words for ${String(n.value)} as a multiple`);
    return m;
  }
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

/** The heading of a creed's section in the rulebook, as a reader sees it ("💀 Undead — zeal 0%"), or nothing. */
function theHeadingOfItsCreedsSection(b: TheBooks, creed: string): string {
  const section = thePartOf(b.rulebook, '<section id="alignments">', '</section>');
  const at = section.search(new RegExp(`<h3>[^<]* ${creed} <span`));
  const end = section.indexOf('</h3>', at);
  return at < 0 || end < 0 ? '' : asAReaderSeesIt(section.slice(at, end));
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

/** The player page's two texts of each creed: the turn report's summaries (`ALIGNMENT_SUMMARIES`, by creed) and the
 *  join form's strings (its alignments' descriptions among them, each opening on its creed in bold: `**Divine:**`). */
interface ThePagesTexts {
  readonly theReportsSummaries: Readonly<Record<string, string>>;
  readonly theJoinFormsStrings: readonly string[];
}
const THE_REPORTS_SUMMARIES = 'ui/player/report.ts';
const THE_JOIN_FORM = 'ui/player/briefing-and-submit.ts';
/** The words a reader sees in a page's text: the join form's bold marks (`**`) dropped, the spaces made one. */
const asAReaderSeesThePagesText = (text: string): string => text.split('**').join('').replace(/\s+/g, ' ').trim();

/** What a row breaks in the page's texts: each place its name or a number isn't as the row says. */
function whatARowBreaksInThePagesTexts(row: AnAlignmentOrder, texts: ThePagesTexts): string[] {
  const broken: string[] = [];
  const summary = texts.theReportsSummaries[row.creed];
  if (summary === undefined) broken.push('the report has no summary of its creed');
  const descriptions = texts.theJoinFormsStrings.filter((s) => s.includes(`**${row.creed}:**`));
  const [description] = descriptions;
  if (descriptions.length !== 1)
    broken.push(`the join form has ${String(descriptions.length)} descriptions of its creed`);
  const places = [
    ["the report's summary", summary, 'inTheReportsSummary'],
    ["the join form's description", descriptions.length === 1 ? description : undefined, 'inTheJoinForm'],
  ] as const;
  for (const [place, text, field] of places) {
    if (text === undefined) continue;
    const seen = asAReaderSeesThePagesText(text);
    if (!seen.includes(row.name)) broken.push(`${place}'s name`);
    for (const [what, n] of Object.entries(row.theNumbers)) {
      const phrase = n[field];
      if (phrase === undefined) continue;
      const words = phrase.replace('{N}', written(n));
      if (!seen.includes(words)) broken.push(`${place}'s ${what}: "${words}"`);
    }
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
const TEXTS: ThePagesTexts = {
  theReportsSummaries: Object.fromEntries(
    entriesOf(THE_REPORTS_SUMMARIES, 'ALIGNMENT_SUMMARIES').map((e) => [e.key, e.value]),
  ),
  theJoinFormsStrings: stringsOf(THE_JOIN_FORM),
};

/** A row with one of its numbers planted as another value. */
const aRowWithTheNumber = (row: AnAlignmentOrder, what: string, value: number): AnAlignmentOrder => {
  const n = row.theNumbers[what];
  if (!n) throw new Error(`no ${what}`);
  return { ...row, theNumbers: { ...row.theNumbers, [what]: { ...n, value } } };
};

test.for(ROWS.map((row) => [row.name, row] as const))(
  '%s: its name, creed, king mark and numbers are in both books as its row says',
  ([, row]) => {
    expect(whatARowBreaks(row, BOOKS)).toEqual([]);
  },
);

test.for(ROWS.map((row) => [row.name, row] as const))(
  "%s: its name and numbers are in its creed's summary on the report and description on the join form as its row says",
  ([, row]) => {
    expect(whatARowBreaksInThePagesTexts(row, TEXTS)).toEqual([]);
  },
);

test("the GM's statistics label Consecrate, Call to Arms and the Broker by their rows' names; Harvest Field and Rite are its own words", () => {
  // (P1-11d9, choice 3's option 1) a value read from a row is its source; a literal, its words
  const labels = new Map(entriesOf('ui/gm/stats-tab.ts', 'STATS_ACTION_LABEL').map((e) => [e.key, e.value]));
  expect(ROWS.map((row) => [row.key, labels.get(row.key)])).toEqual([
    ['consecrate', 'THE_ALIGNMENT_ORDERS.consecrate.name'],
    ['call_to_arms', "THE_ALIGNMENT_ORDERS['call-to-arms'].name"],
    ['broker', 'THE_ALIGNMENT_ORDERS.broker.name'],
    ['harvest_field', 'Harvest Field'],
    ['rite', 'Rite'],
  ]);
});

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
  const aPrice = aRowWithTheNumber;
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

// Planted (P1-11d9): another number ("3g") in each of the page's texts that states one, or a number or a name in a row
// alone; each is found, in the place it was planted.
test('planted, a "3g" in each of the page\'s texts, or a number or a name in a row alone, are found', () => {
  const callToArms = THE_ALIGNMENT_ORDERS['call-to-arms'];
  const broker = THE_ALIGNMENT_ORDERS.broker;
  const harvest = THE_ALIGNMENT_ORDERS['harvest-the-field'];
  const rite = THE_ALIGNMENT_ORDERS['perform-rite'];
  const aSummaryWith = (creed: string, from: string, to: string): ThePagesTexts => {
    const summary = TEXTS.theReportsSummaries[creed] ?? '';
    expect(summary.split(from)).toHaveLength(2);
    return { ...TEXTS, theReportsSummaries: { ...TEXTS.theReportsSummaries, [creed]: summary.replace(from, to) } };
  };
  const aJoinFormWith = (from: string, to: string): ThePagesTexts => {
    expect(TEXTS.theJoinFormsStrings.filter((s) => s.includes(from))).toHaveLength(1);
    return { ...TEXTS, theJoinFormsStrings: TEXTS.theJoinFormsStrings.map((s) => s.replace(from, to)) };
  };
  expect(whatARowBreaksInThePagesTexts(broker, aSummaryWith('Neutral', 'seen for 2g', 'seen for 3g'))).toEqual([
    `the report's summary's thePriceOfWordFromAProvince: "has ever seen for 2g"`,
  ]);
  expect(whatARowBreaksInThePagesTexts(harvest, aSummaryWith('Undead', 'unit for 2g', 'unit for 3g'))).toEqual([
    `the report's summary's thePrice: "as a Skeletal unit for 2g"`,
  ]);
  expect(whatARowBreaksInThePagesTexts(harvest, aJoinFormWith('soldier for 2g', 'soldier for 3g'))).toEqual([
    `the join form's description's thePrice: "raises a grave as a soldier for 2g"`,
  ]);
  expect(whatARowBreaksInThePagesTexts(rite, aSummaryWith('Pagan', '(+2 quality', '(+3 quality'))).toEqual([
    `the report's summary's theBloodOfferingsGrades: "(+2 quality tiers each"`,
  ]);
  expect(whatARowBreaksInThePagesTexts(callToArms, aSummaryWith('Good', 'free Green', 'free Veteran'))).toEqual([
    `the report's summary's theGradeMustered: "a free Green garrison unit"`,
  ]);
  expect(whatARowBreaksInThePagesTexts(aRowWithTheNumber(harvest, 'thePrice', 3), TEXTS)).toEqual([
    `the report's summary's thePrice: "as a Skeletal unit for 3g"`,
    `the join form's description's thePrice: "raises a grave as a soldier for 3g"`,
  ]);
  expect(whatARowBreaksInThePagesTexts(aRowWithTheNumber(broker, 'thePriceOfWordFromAProvince', 3), TEXTS)).toEqual([
    `the report's summary's thePriceOfWordFromAProvince: "has ever seen for 3g"`,
  ]);
  expect(whatARowBreaksInThePagesTexts({ ...broker, name: 'Brokerage' }, TEXTS)).toEqual([
    "the report's summary's name",
    "the join form's description's name",
  ]);
  expect(
    whatARowBreaksInThePagesTexts({ ...broker, creed: 'Druidic' }, aJoinFormWith('**Druidic:**', 'Druidic:')),
  ).toEqual([
    'the join form has 0 descriptions of its creed',
    "the report's summary's name",
    `the report's summary's thePriceOfWordFromAProvince: "has ever seen for 2g"`,
  ]);
});

// The words of the turn's rule the Evil and Pagan texts state (the intro's Evil row too: it restates the plunder), and
// the words they said before, which none may (R-136, plan question 46 (d) and (f)): an Evil hero conquers by the
// doctrine on his orders, Terror plundering 50% of the province's tax and Enslave pressing a free Green garrison unit,
// the province paying 1g less tax for 3 turns, as the order form and the turn's line say (src/engine/realms/relations-
// and-captures.ts, applyEvilConquest; the tax in src/engine/turn/early-winter-…ts, which counts the turn of the conquest
// too: plan question 68); the Wild Hunt binds two of a province's creatures, as Veterans until the end of the following
// turn (its row's numbers, above).
const THE_EVIL_BONUS_LINES = stringsOf(THE_REPORTS_SUMMARIES).filter((s) =>
  s.includes('<strong>Evil bonuses</strong>'),
);
const THE_JOIN_FORMS_PAGAN = TEXTS.theJoinFormsStrings.filter((s) => s.includes('**Pagan:**'));
const THE_EVIL_DOCTRINE = ['Terror plunders 50%', 'Enslave', 'free Green garrison unit', '1g less tax for 3 turns'];
const WHAT_THE_EVIL_TEXTS_SAID = [
  'instant 50% loot',
  'your forces immediately plunder 50%',
  'conquering a province immediately yields',
];
test.for([
  {
    text: "the report's Evil summary",
    seen: asAReaderSeesThePagesText(TEXTS.theReportsSummaries['Evil'] ?? ''),
    says: THE_EVIL_DOCTRINE,
    saidBefore: WHAT_THE_EVIL_TEXTS_SAID,
  },
  {
    text: "the report's Evil bonus line",
    seen: THE_EVIL_BONUS_LINES.length === 1 ? asAReaderSeesIt(THE_EVIL_BONUS_LINES[0] ?? '') : '',
    says: THE_EVIL_DOCTRINE,
    saidBefore: WHAT_THE_EVIL_TEXTS_SAID,
  },
  {
    text: "the rulebook's Evil section",
    seen: theEntriesOfItsCreedsSection(BOOKS, 'Evil').join(' '),
    says: THE_EVIL_DOCTRINE,
    saidBefore: WHAT_THE_EVIL_TEXTS_SAID,
  },
  {
    text: "the intro's Evil row",
    seen: theIntrosTable(BOOKS)
      .filter((cells) => (cells[0] ?? '').includes('<strong>Evil</strong>'))
      .map((cells) => asAReaderSeesIt(cells.join(' ')))
      .join(' '),
    says: ['under the Terror doctrine a conquest plunders 50%', 'Enslave (passive), the other doctrine'],
    saidBefore: ["; plunder 50% of a conquered province's tax"],
  },
  {
    text: "the report's Pagan summary",
    seen: asAReaderSeesThePagesText(TEXTS.theReportsSummaries['Pagan'] ?? ''),
    says: [
      "the Wild Hunt binds two of the province's creatures to your host as Veterans until the end of the following turn",
    ],
    saidBefore: ["binds a province's creatures"],
  },
  {
    text: "the join form's Pagan description",
    seen: THE_JOIN_FORMS_PAGAN.length === 1 ? asAReaderSeesThePagesText(THE_JOIN_FORMS_PAGAN[0] ?? '') : '',
    says: ["the Wild Hunt binds two of that province's beasts"],
    saidBefore: ["binds that province's beasts"],
  },
] as const)('$text says what the turn does (R-136)', ({ text, seen, says, saidBefore }) => {
  expect(seen, `${text} is found once`).not.toBe('');
  for (const words of says) expect(seen, `${text} says "${words}"`).toContain(words);
  for (const words of saidBefore) expect(seen, `${text} no longer says "${words}"`).not.toContain(words);
});

/** Each alignment ability's row, by its slug. */
const ABILITIES: readonly (readonly [slug: string, row: AnAlignmentAbility])[] = Object.entries(ALIGNMENT_ABILITIES);

/** The rulebook's paragraph on gold, as a reader sees it. */
const theParagraphOnGold = (b: TheBooks): string =>
  asAReaderSeesIt(thePartOf(b.rulebook, '<p>Your gold comes chiefly', '</p>'));
/** A creed's row of the rulebook's orders table, as a reader sees it. */
const theOrdersTableRowOf = (b: TheBooks, creed: string): string =>
  theOrdersTable(b)
    .filter((cells) => asAReaderSeesIt(cells[0] ?? '').endsWith(` ${creed}`))
    .map((cells) => asAReaderSeesIt(cells.join(' ')))
    .join(' ');
/** A creed's row of the intro's table, as a reader sees it. */
const theIntrosRowOf = (b: TheBooks, creed: string): string =>
  theRowsOf(thePartOf(b.intro, '<h3>The seven alignments</h3>', '</table>'))
    .filter((cells) => (cells[0] ?? '').includes(`<strong>${creed}</strong>`))
    .map((cells) => asAReaderSeesIt(cells.join(' ')))
    .join(' ');

/** What an ability's row breaks in the books and the page's texts: each place one of its numbers isn't in the words its
 *  row gives. */
function whatAnAbilitysRowBreaks(row: AnAlignmentAbility, b: TheBooks, texts: ThePagesTexts): string[] {
  const broken: string[] = [];
  const descriptions = texts.theJoinFormsStrings.filter((s) => s.includes(`**${row.alignment}:**`));
  const summary = texts.theReportsSummaries[row.alignment];
  for (const [what, n] of Object.entries(row.theNumbers)) {
    const places = [
      [
        "its creed's section",
        n.inItsCreedsSection,
        [theHeadingOfItsCreedsSection(b, row.alignment), ...theEntriesOfItsCreedsSection(b, row.alignment)].join(' '),
      ],
      ["the rulebook's paragraph on gold", n.inTheRulebooksParagraphOnGold, theParagraphOnGold(b)],
      ["the rulebook's orders table", n.inTheRulebooksOrdersTable, theOrdersTableRowOf(b, row.alignment)],
      ["the intro's table", n.inTheIntrosTable, theIntrosRowOf(b, row.alignment)],
      ["the report's summary", n.inTheReportsSummary, asAReaderSeesThePagesText(summary ?? '')],
      [
        "the join form's description",
        n.inTheJoinForm,
        descriptions.length === 1 ? asAReaderSeesThePagesText(descriptions[0] ?? '') : '',
      ],
    ] as const;
    for (const [place, phrase, seen] of places) {
      if (phrase === undefined) continue;
      const words = phrase.replace('{N}', written(n));
      if (!seen.includes(words)) broken.push(`${place}'s ${what}: "${words}"`);
    }
  }
  return broken;
}

test.for(ABILITIES)("%s: its numbers are in both books and the page's texts as its row says", ([, row]) => {
  expect(whatAnAbilitysRowBreaks(row, BOOKS, TEXTS)).toEqual([]);
});

test("the abilities' numbers are the ones the books state today", () => {
  expect(
    Object.fromEntries(
      ABILITIES.map(([slug, row]) => [
        slug,
        Object.fromEntries(Object.entries(row.theNumbers).map(([k, n]) => [k, n.value])),
      ]),
    ),
  ).toEqual({
    'neutral-trade': { theShareOfTheProvincesIncome: 20 },
    'consecrated-ground-tax': { theShareMoreTax: 50 },
    'zeal-of-a-divine-realm': { theChanceOfZeal: 50, theStrengthOfZeal: 1.3 },
    'zeal-of-a-good-realm': { theChanceOfZeal: 40 },
    'zeal-of-a-druidic-realm': { theChanceOfZeal: 20 },
    'zeal-of-a-neutral-realm': { theChanceOfZeal: 10 },
    'zeal-of-a-pagan-realm': { theChanceOfZeal: 15 },
    'zeal-of-an-evil-realm': { theChanceOfZeal: 25 },
    'zeal-of-an-undead-realm': { theChanceOfZeal: 0 },
    'consecrated-ground-doubles-a-defenders-zeal': { theTimesTheChance: 2 },
    'savage-fury': { theStrengthOfTheHost: 1.25 },
    'skeletal-fervour': { underTheKing: 1.5, underAnyOtherCommander: 1.3 },
    'consecrated-ground-weakens-an-unholy-attacker': { theShareWeaker: 15 },
    'righteous-defence': { theShareStronger: 10 },
    'banner-of-fellowship': { thePointsMoreReadily: 15 },
    'home-of-the-wild': { theStrengthOfACreature: 1.5 },
    'reign-of-fear': { theStrengthOfAMonster: 1.5 },
    'the-deathless-march': {},
    'the-neutral-mercenary-discount': { theGoldLess: 2 },
    'the-divine-blessing': { byTheRealmsCasters: 80, byTheKingInPerson: 100 },
    'creatures-follow-without-a-druid': {},
    'monsters-follow-without-a-druid': {},
    'neutral-scholars': { thePointsASageLevelAdds: 5 },
  });
});

// Planted: an ability's number changed in its row alone, or in one place alone (the rulebook's creed section, its
// paragraph on gold, the intro, the report's summary, the join form); each is found, in the place it was planted.
test("planted, an ability's number in its row alone, or in each place that states it alone, is found", () => {
  const trade = ALIGNMENT_ABILITIES['neutral-trade'];
  const n = trade.theNumbers.theShareOfTheProvincesIncome;
  expect(
    whatAnAbilitysRowBreaks(
      { ...trade, theNumbers: { theShareOfTheProvincesIncome: { ...n, value: 25 } } },
      BOOKS,
      TEXTS,
    ),
  ).toEqual([
    `its creed's section's theShareOfTheProvincesIncome: "Trade: province tax income is +25%"`,
    `the rulebook's paragraph on gold's theShareOfTheProvincesIncome: "Neutral realms add a +25% trade bonus (rounded down)"`,
    `the intro's table's theShareOfTheProvincesIncome: "+25% tax"`,
    `the report's summary's theShareOfTheProvincesIncome: "Province tax income flows 25% richer"`,
    `the join form's description's theShareOfTheProvincesIncome: "+25% tax from every province"`,
  ]);
  const aBookWith = (from: string, to: string, inTheIntro = false): TheBooks => {
    const page = inTheIntro ? INTRO : RULEBOOK;
    expect(page.split(from)).toHaveLength(2);
    return inTheIntro ? { ...BOOKS, intro: page.replace(from, to) } : { ...BOOKS, rulebook: page.replace(from, to) };
  };
  expect(
    whatAnAbilitysRowBreaks(trade, aBookWith('tax income is <strong>+20%</strong>', 'tax income is +25%'), TEXTS),
  ).toEqual([`its creed's section's theShareOfTheProvincesIncome: "Trade: province tax income is +20%"`]);
  expect(
    whatAnAbilitysRowBreaks(trade, aBookWith('<strong>+20% trade bonus</strong>', '+25% trade bonus'), TEXTS),
  ).toEqual([
    `the rulebook's paragraph on gold's theShareOfTheProvincesIncome: "Neutral realms add a +20% trade bonus (rounded down)"`,
  ]);
  expect(whatAnAbilitysRowBreaks(trade, aBookWith('+20% tax; cheapest', '+25% tax; cheapest', true), TEXTS)).toEqual([
    `the intro's table's theShareOfTheProvincesIncome: "+20% tax"`,
  ]);
  const summary = TEXTS.theReportsSummaries['Neutral'] ?? '';
  expect(summary.split('flows 20% richer')).toHaveLength(2);
  const aSummary: ThePagesTexts = {
    ...TEXTS,
    theReportsSummaries: { ...TEXTS.theReportsSummaries, Neutral: summary.replace('flows 20%', 'flows 25%') },
  };
  expect(whatAnAbilitysRowBreaks(trade, BOOKS, aSummary)).toEqual([
    `the report's summary's theShareOfTheProvincesIncome: "Province tax income flows 20% richer"`,
  ]);
  expect(TEXTS.theJoinFormsStrings.filter((s) => s.includes('+20% tax from every province'))).toHaveLength(1);
  const aJoinForm: ThePagesTexts = {
    ...TEXTS,
    theJoinFormsStrings: TEXTS.theJoinFormsStrings.map((s) => s.replace('+20% tax from', '+25% tax from')),
  };
  expect(whatAnAbilitysRowBreaks(trade, BOOKS, aJoinForm)).toEqual([
    `the join form's description's theShareOfTheProvincesIncome: "+20% tax from every province"`,
  ]);
});

// Planted (P1-19at2): the consecrated ground's 50% changed in its row alone, or in each of the six places alone (the
// rulebook's creed section and orders table, the intro, the report's summary, the join form); each is found where planted.
test("planted, the consecrated ground's share in its row alone, or in each place that states it alone, is found", () => {
  const tax = ALIGNMENT_ABILITIES['consecrated-ground-tax'];
  const n = tax.theNumbers.theShareMoreTax;
  expect(
    whatAnAbilitysRowBreaks({ ...tax, theNumbers: { theShareMoreTax: { ...n, value: 40 } } }, BOOKS, TEXTS),
  ).toEqual([
    `its creed's section's theShareMoreTax: "Consecrated ground gives +40% tax"`,
    `the rulebook's orders table's theShareMoreTax: "+40% tax, stauncher defenders"`,
    `the intro's table's theShareMoreTax: "+40% tax and holy ground"`,
    `the report's summary's theShareMoreTax: "Consecrated ground yields +40% tax"`,
    `the join form's description's theShareMoreTax: "Consecrate provinces: +40% tax"`,
  ]);
  const aBookWith = (from: string, to: string, inTheIntro = false): TheBooks => {
    const page = inTheIntro ? INTRO : RULEBOOK;
    expect(page.split(from)).toHaveLength(2);
    return inTheIntro ? { ...BOOKS, intro: page.replace(from, to) } : { ...BOOKS, rulebook: page.replace(from, to) };
  };
  expect(
    whatAnAbilitysRowBreaks(tax, aBookWith('ground gives <strong>+50% tax</strong>', 'ground gives +40% tax'), TEXTS),
  ).toEqual([`its creed's section's theShareMoreTax: "Consecrated ground gives +50% tax"`]);
  expect(whatAnAbilitysRowBreaks(tax, aBookWith('+50% tax, stauncher', '+40% tax, stauncher'), TEXTS)).toEqual([
    `the rulebook's orders table's theShareMoreTax: "+50% tax, stauncher defenders"`,
  ]);
  expect(
    whatAnAbilitysRowBreaks(tax, aBookWith('+50% tax and holy ground', '+40% tax and holy ground', true), TEXTS),
  ).toEqual([`the intro's table's theShareMoreTax: "+50% tax and holy ground"`]);
  const summary = TEXTS.theReportsSummaries['Divine'] ?? '';
  expect(summary.split('yields +50% tax')).toHaveLength(2);
  const aSummary: ThePagesTexts = {
    ...TEXTS,
    theReportsSummaries: {
      ...TEXTS.theReportsSummaries,
      Divine: summary.replace('yields +50% tax', 'yields +40% tax'),
    },
  };
  expect(whatAnAbilitysRowBreaks(tax, BOOKS, aSummary)).toEqual([
    `the report's summary's theShareMoreTax: "Consecrated ground yields +50% tax"`,
  ]);
  expect(TEXTS.theJoinFormsStrings.filter((s) => s.includes('provinces: +50% tax'))).toHaveLength(1);
  const aJoinForm: ThePagesTexts = {
    ...TEXTS,
    theJoinFormsStrings: TEXTS.theJoinFormsStrings.map((s) => s.replace('provinces: +50% tax', 'provinces: +40% tax')),
  };
  expect(whatAnAbilitysRowBreaks(tax, BOOKS, aJoinForm)).toEqual([
    `the join form's description's theShareMoreTax: "Consecrate provinces: +50% tax"`,
  ]);
});

// The alignments' ladder (P1-19av2): its rungs in the books' order, and each of its numbers in the words it gives.
/** Each number of the ladder, by what it is (a rung's mercy by its alignment). */
const theLaddersNumbers = (
  ladder: TheLadderOfTheAlignments,
): (readonly [what: string, n: ANumberOfTheLadder, creed?: string])[] => [
  ...Object.entries(ladder.theNumbers),
  ...ladder.theRungs.map(
    (rung) => [`${rung.alignment}'s mercy`, rung.theChanceAFoeSparesAPlea, rung.alignment] as const,
  ),
];
/** What the ladder breaks in the rulebook: each place one of its numbers isn't in the words it gives. */
function whatTheLadderBreaks(ladder: TheLadderOfTheAlignments, b: TheBooks): string[] {
  const broken: string[] = [];
  const paragraphs = [
    ['the paragraph on the alignments', '<p>Alignment sets your battle fervour', '</p>'],
    ['the paragraph on hiring', '<p>When you <strong>hire a wandering hero</strong>', '</p>'],
    ["the Cowardly's entry", '<li><strong>Cowardly — Opening Shot &amp; Beg for Mercy.</strong>', '</li>'],
  ] as const;
  const [onTheAlignments, onHiring, onTheCowardly] = paragraphs.map(([, from, to]) =>
    asAReaderSeesIt(thePartOf(b.rulebook, from, to)),
  );
  for (const [what, n, creed] of theLaddersNumbers(ladder)) {
    const places = [
      [paragraphs[0][0], n.inTheRulebooksParagraphOnTheAlignments, onTheAlignments],
      [paragraphs[1][0], n.inTheRulebooksParagraphOnHiring, onHiring],
      [paragraphs[2][0], n.inTheRulebooksEntryOnTheCowardly, onTheCowardly],
      ["its creed's section", n.inItsCreedsSection, creed ? theEntriesOfItsCreedsSection(b, creed).join(' ') : ''],
    ] as const;
    for (const [place, phrase, seen] of places) {
      if (phrase === undefined) continue;
      const words = phrase.replace('{N}', written(n));
      if (!(seen ?? '').includes(words)) broken.push(`${place}'s ${what}: "${words}"`);
    }
  }
  return broken;
}

test("the ladder's rungs are the seven alignments, in the order both books list them", () => {
  const order = THE_LADDER_OF_THE_ALIGNMENTS.theRungs.map((rung) => rung.alignment);
  expect(order).toEqual(['Divine', 'Good', 'Druidic', 'Neutral', 'Pagan', 'Evil', 'Undead']);
  for (const book of [RULEBOOK, INTRO]) expect(asAReaderSeesIt(book)).toContain(order.join(', '));
});

test("the ladder's numbers are in the rulebook as it says, and are the ones the books state today", () => {
  expect(whatTheLadderBreaks(THE_LADDER_OF_THE_ALIGNMENTS, BOOKS)).toEqual([]);
  expect(Object.fromEntries(theLaddersNumbers(THE_LADDER_OF_THE_ALIGNMENTS).map(([k, n]) => [k, n.value]))).toEqual({
    theWageOfAHeroAtNoDistance: 2,
    theStepsForEachGoldMore: 2,
    theStepsOfTheGulf: 6,
    theStepsAKingsHeroesAreDealtWithin: 1,
    "Divine's mercy": 75,
    "Good's mercy": 75,
    "Druidic's mercy": 75,
    "Neutral's mercy": 50,
    "Pagan's mercy": 50,
    "Evil's mercy": 20,
    "Undead's mercy": 20,
  });
  expect(
    THE_LADDER_OF_THE_ALIGNMENTS.theRungs.filter((rung) => rung.aFoesRefusalIsLaughter).map((r) => r.alignment),
  ).toEqual(['Evil', 'Undead']);
});

// Planted: a number of the ladder changed in the table alone, or in the rulebook alone; each is found where planted.
test('planted, a number of the ladder in the table alone, or in the rulebook alone, is found', () => {
  const ladder = THE_LADDER_OF_THE_ALIGNMENTS;
  const { theNumbers, theRungs } = ladder;
  expect(
    whatTheLadderBreaks(
      {
        ...ladder,
        theNumbers: {
          ...theNumbers,
          theWageOfAHeroAtNoDistance: { ...theNumbers.theWageOfAHeroAtNoDistance, value: 3 },
          theStepsOfTheGulf: { ...theNumbers.theStepsOfTheGulf, value: 5 },
        },
        theRungs: theRungs.map((rung) =>
          rung.alignment === 'Evil'
            ? { ...rung, theChanceAFoeSparesAPlea: { ...rung.theChanceAFoeSparesAPlea, value: 25 } }
            : rung,
        ),
      },
      BOOKS,
    ),
  ).toEqual([
    `the paragraph on the alignments's theWageOfAHeroAtNoDistance: "a wandering hero costs 3g/turn"`,
    `the paragraph on hiring's theWageOfAHeroAtNoDistance: "3g for a close match"`,
    `the paragraph on the alignments's theStepsOfTheGulf: "across the full gulf of five steps"`,
    `the Cowardly's entry's Evil's mercy: "25% by Evil or Undead"`,
    `its creed's section's Evil's mercy: "A felled Cowardly enemy begging your mercy is spared only 25% of the time"`,
  ]);
  const aBookWith = (from: string, to: string): TheBooks => {
    expect(RULEBOOK.split(from)).toHaveLength(2);
    return { ...BOOKS, rulebook: RULEBOOK.replace(from, to) };
  };
  expect(whatTheLadderBreaks(ladder, aBookWith('mercy is spared <strong>75%</strong>', 'mercy is spared 70%'))).toEqual(
    [`its creed's section's Good's mercy: "A felled Cowardly enemy who begs your mercy is spared 75% of the time"`],
  );
  expect(whatTheLadderBreaks(ladder, aBookWith('+1g for every two steps', '+1g for every three steps'))).toEqual([
    `the paragraph on the alignments's theStepsForEachGoldMore: "+1g for every two steps between your alignment and theirs"`,
  ]);
  expect(
    whatTheLadderBreaks(ladder, aBookWith('life: spared <strong>75%</strong>', 'life: spared <strong>70%</strong>')),
  ).toEqual([
    `the Cowardly's entry's Divine's mercy: "spared 75% of the time by a Good, Divine or Druidic foe"`,
    `the Cowardly's entry's Good's mercy: "spared 75% of the time by a Good, Divine or Druidic foe"`,
    `the Cowardly's entry's Druidic's mercy: "spared 75% of the time by a Good, Divine or Druidic foe"`,
  ]);
});
