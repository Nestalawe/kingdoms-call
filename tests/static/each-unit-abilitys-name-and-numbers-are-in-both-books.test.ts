// Each unit ability's name and numbers are in both books (plan P1-19, Decision 5): for every row of the content's unit
// abilities (src/content/unit-abilities-their-names-numbers-and-words.ts, the numbers the rule registry's effects
// read), the ability's name, and each of its numbers as the books write it (×1.25, +10%), are in its unit's blurb in
// the player portal (UNIT_ABILITIES) and in its roster row in the comprehensive rulebook, within the ability's own words
// (from its name to the next ability's), with no digit just before or after it (×1.2 is not in "×1.25": plan P1-19f).
// So a number changed in content, and not in the books, turns this red. This
// family's share of plan P3-02's words helper. The abilities a table holds, read by the unit's type (plan P1-19l,
// Choice 2), are checked the same way from their tables: each pre-battle strike's name and damage range (2–4, with the
// books' en dash; PRIMAL_ARMY_DEFS_P's spells and BATTLE_ARMY_SPELLS, in content), Island Back's berths
// (KC_CARRIER_BERTHS: "two land units") and Forest Runners' two cells of TERRAIN_MODS (read by its syntax tree: "×1.1
// in forest", "no penalty in jungle"). A table's number is matched with what it counts or where it acts, since a bare
// "one" or "×1" is in the books' words already ("where a fleet carries one", "×1.1"). The older words tests
// (abilities-words, primal-abilities-words) name no ability now; they keep their other checks.
// Three gaps are known and let through, each with its fix parked (the three fleets): the rulebook's Orcish Longships row
// doesn't name Reaver Crews, nor its Elven Galleys row Sea Archers, nor its Dwarf Ironclads row Armoured Hulls (the test
// fails once it does, so the exception leaves with the fix). And three numbers: the rulebook's Whale Cohort row names
// Breach and Swamp but not its 25% chance (plan P1-19i; parked: the row's words from the blurb), and its Manticore Pride
// row gives the Manticores' pursuit (at least half the winning force, +15%) after Spine Volley, outside Relentless
// Hunt's words (plan P1-19j; parked likewise), each checked to be still left out there, so the exception leaves with
// the fix too. Of the tables: the battle report names the Wyvern Riders' strike "Acid Spit Volley", both books "Acid
// Spit" (parked: one name), checked to be still so; and the rulebook gives Forest Runners' two numbers in its terrain
// column, not in Forest Runners' words (a known difference: roster-words holds that column to the decided roster, and
// roster holds TERRAIN_MODS to it), checked to be still so. The Corsair Fleet's two (Cut the Line, Keep the Sea Lanes:
// plan P1-19j, Choice 4) are a retired unit's,
// in no book: checked to be still in none, and nothing else. An ability the books give no number (Rooted, Hold the Gate,
// Town Watch, Battering Horns: plan P1-19c; Knightly Example: P1-19d; eight of the volley's: P1-19g; the three flank
// slots of rough ground: P1-19h; Deep Halls: P1-19j; Raiders' Muster: P1-19k) is listed below,
// and its name is checked; a number the books leave out (Driven Before Them's cap, which the units beside them never
// reach) is checked to be still left out. A number the books write in words (double, half, two, full strength) is matched
// as a whole word, case aside (the rulebook writes "DOUBLE volley damage").
// Level 0 (static): the content's rows and tables imported (plain data), TERRAIN_MODS and the player portal's blurbs by
// their syntax tree (tests/lib/source.ts), the rulebook as built (site/); nothing runs.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Every row of the content's unit abilities (the names and numbers the rule registry's effects read, plan P1-19
// Decision 5): its name, and each of its numbers as the books write it (`×1.25`, `+10%`, `30%` for a chance, `no
// penalty` for ×1, `base strength 6`; since P1-19g `55%` for a share, `double`, `half` and a count in words, `two`,
// these three as a whole word, case aside; since P1-19h `full strength` for ×1, a whole word too; since P1-19i `−30%`
// for a fraction taken, with the books' minus sign), within the ability's own words (from its name to the next
// ability's), with no digit just before or after it (since P1-19f: `×1.2` isn't in "×1.25"), in its unit's
// player-portal blurb (`UNIT_ABILITIES`, by syntax tree; since P1-19e in the same content file, found as the player
// page's) and its rulebook roster row (as built). Three gaps let through, and checked to be still there (parked, the
// three fleets): the rulebook's Orcish Longships row doesn't name Reaver Crews, nor its Elven Galleys row Sea Archers,
// nor its Dwarf Ironclads row Armoured Hulls (P1-19g); and the numbers the rulebook leaves out of an ability's words,
// checked to be still left out while the blurb gives them (parked: the rulebook's Whale Cohort row gives Breach and
// Swamp no chance, P1-19i; its Manticore Pride row gives the Manticores' pursuit, at least half the winning force and
// +15%, after Spine Volley, outside Relentless Hunt's words, P1-19j). A retired unit's abilities in no book (the
// Corsair Fleet's Cut the Line and Keep the Sea Lanes, P1-19j) are checked to be still in neither book, and nothing
// else. Since P1-19l the abilities a table holds too, read by the unit's type: each pre-battle strike's name and damage
// range (`2–4`, with the books' en dash; each beast's `spells` in `PRIMAL_ARMY_DEFS_P` and the winged riders'
// `BATTLE_ARMY_SPELLS`, both in content), Island Back's berths (`KC_CARRIER_BERTHS`, as "two land units") and Forest
// Runners' forest and jungle cells (`TERRAIN_MODS`, by its syntax tree, as "×1.1 in forest" and "no penalty in
// jungle"): a table's number is matched with what it counts or where it acts, since a bare "one" or "×1" is in the
// books' words already. Two of these are known and checked to be still so: the table names the Wyvern Riders' strike
// "Acid Spit Volley", both books "Acid Spit" (parked); the rulebook gives Forest Runners' numbers in its terrain
// column, not in its words. The abilities the books give no number (Rooted, Hold the Gate, Town Watch, Battering Horns,
// P1-19c; Knightly Example, P1-19d; Broadside, Tree Watch, Eyes of the Forest, Ambush, Loosed From Cover, Armoured
// Hulls, Shell Wall, Sea Archers, P1-19g; Through the Trees, Through the Glades, Crag Charge, P1-19h; Deep Halls,
// P1-19j; Raiders' Muster, P1-19k) are listed, each with why: their rows hold none, every other row holds one, and
// their names are checked; a number the books leave out (Driven Before Them's cap at +30%, which two units beside them
// never reach) is checked to be still left out. Red with Wyrmscale ×1.26 in content (P1-19a), with Arrow Fodder ×0.8,
// Bodkin Points' ×0.75 or Armour-Piercing's base strength 7 (P1-19b), and with Storm Wings ×0.9, Driven Before Them's
// cap at +10% or Rooted taken off the list (P1-19c), and with Regenerating Hide at 31% or Knightly Example taken off
// the list (P1-19d), and with Halberds ×1.2 or Deepwater Grasp ×1.3, each the start of the books' number, which the
// test let through before (P1-19f), and with Woodland Volley ×1.9 (not "double"), Punch Through's 50% or Bombardment's
// +40% (P1-19g), and with Colossal Bulk at ×0.5 (not "full strength", P1-19h), and with Flak Screen at −25% (both
// books) or Breach and Swamp at 20% (the blurb, P1-19i), and with Ride Them Down at +5% a company (both books, P1-19j),
// and with Acid Spit at 2–4, Boulder Barrage at 4–6, Island Back at one berth (both books) or Forest Runners at ×1 in
// forest (the blurb), and with the table's strike named "Acid Spit" (P1-19l). Level 0: the content's rows and tables
// are plain data, `TERRAIN_MODS` and the books are read; nothing runs. TypeScript, in `static/`
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { BATTLE_ARMY_SPELLS, KC_CARRIER_BERTHS, PRIMAL_ARMY_DEFS_P } from '../../src/content/kingdoms-call-data.ts';
import {
  UNIT_ABILITIES_THE_REGISTRY_HOLDS,
  type ANumberOfAnAbility,
} from '../../src/content/unit-abilities-their-names-numbers-and-words.ts';
import { readPage } from '../lib/boot.js';
import { entriesOf, fileDeclaring } from '../lib/source.ts';

const PLAYER = 'kingdoms-call-player-portal.html';
/** The rulebook rows that don't name an ability yet, each with why: the test checks the gap is still there. */
const NOT_IN_THE_RULEBOOK_YET: Readonly<Record<string, string>> = {
  'reaver-crews': "the rulebook's Orcish Longships row doesn't name Reaver Crews (parked: add it to the row)",
  'sea-archers': "the rulebook's Elven Galleys row doesn't name Sea Archers (parked: add it to the row)",
  'armoured-hulls': "the rulebook's Dwarf Ironclads row doesn't name Armoured Hulls (parked: add it to the row)",
};

/** The numbers a rulebook row that names the ability leaves out, by the ability and the number, each with why: the test
 *  checks the rulebook still leaves each out, and the blurb still gives it. */
const NUMBERS_NOT_IN_THE_RULEBOOK_YET: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'breach-and-swamp': {
    toSinkAHull:
      "the rulebook's Whale Cohort row gives Breach and Swamp no chance (parked: the row's words from the blurb)",
  },
  'relentless-hunt': {
    theWinningForceAtLeast:
      "the rulebook's Manticore Pride row gives the Manticores' pursuit after Spine Volley, outside Relentless Hunt's words (parked: the row's words from the blurb)",
    theBeatenFoesRoutLosses:
      "the rulebook's Manticore Pride row gives the Manticores' pursuit after Spine Volley, outside Relentless Hunt's words (parked: the row's words from the blurb)",
  },
};

/** The abilities of a retired unit that no book names (no blurb, no roster row), each with why: the test checks that
 *  neither book has the unit yet, and nothing else (plan P1-19's second slice, Choice 4). */
const A_RETIRED_UNITS_IN_NO_BOOK: Readonly<Record<string, string>> = {
  'cut-the-line':
    'the Corsair Fleet left the pools on 2026-10-15, and a company raised before still fights (a question for Toby)',
  'keep-the-sea-lanes':
    'the Corsair Fleet left the pools on 2026-10-15, and a company raised before still fights (a question for Toby)',
};

/** The abilities whose words in the books give no number, each with why: the test checks that their rows hold none,
 *  and that every other row holds one. */
const NO_NUMBER_IN_THE_BOOKS: Readonly<Record<string, string>> = {
  rooted: "never hit from the side: the side hit it is spared is the battle lines' number",
  'hold-the-gate': 'never hit from the side, defending',
  'town-watch': "a Human Garrison counts as Levies for Shieldwall: Shieldwall's number",
  'battering-horns': "a free Ram turns an anchored line: the turned flank is the battle lines' number",
  'knightly-example':
    'the Levies and the Men-at-Arms never lose a tier in defeat while a Gilded Lances unit is in the army',
  broadside: 'a galleon fires in the archery step at sea',
  'tree-watch': 'the Elven Garrison shoots like an archer unit in forest or jungle',
  'eyes-of-the-forest': 'an enemy Ambush is spoiled and Shadow Archers can be shot at',
  ambush: 'the side facing the Wardens in forest or jungle gets no archery phase',
  'loosed-from-cover': 'enemy volleys cannot target them',
  'armoured-hulls': 'immune to pre-battle volleys',
  'shell-wall': 'immune to pre-battle volleys, as the Ironclads',
  'sea-archers': 'your ranged units ignore the land-unit penalty at sea',
  'through-the-trees': 'the one cavalry that takes a flank in forest and jungle',
  'through-the-glades': 'the one cavalry, with the Stag Riders, that takes a flank in forest and jungle',
  'crag-charge': 'the one cavalry that takes a flank in the mountains',
  'deep-halls': "a Dwarf Garrison counts as Guard for Shield Fort: Shield Fort's number",
  'raiders-muster': 'an orcish province that sees an orc realm win there gains a Goblin Horde in its garrison',
};

/** A count as the books write it, in words (any other count is written so that no book holds it). */
const COUNTS_IN_WORDS: Readonly<Record<number, string>> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

/** The ways the books write a number in words: matched as a whole word, case aside. */
const IN_WORDS: ReadonlySet<ANumberOfAnAbility['theBooksWriteIt']> = new Set([
  'double',
  'half',
  'a count in words',
  'full strength',
]);

/** A number as the books write it: ×1.25; +10% for a fraction added (and for one the books leave out, which the test
 *  checks they still do), −30% for one taken (the books' minus sign, U+2212); 30% for a chance and 55% for a share; "no penalty" or "full strength" for ×1, "double" for ×2 and
 *  "half" for ×0.5, and a count in words, "two" (any other value is written so that no book holds it, and the test turns
 *  red); "base strength 6" for a unit's base strength. */
function asTheBooksWriteIt(n: ANumberOfAnAbility): string {
  switch (n.theBooksWriteIt) {
    case 'a multiplier':
      return `×${String(n.value)}`;
    case 'a fraction added':
    case 'a fraction the books leave out':
      return `+${String(Number((n.value * 100).toFixed(6)))}%`;
    case 'a fraction taken':
      return `\u2212${String(Number((n.value * 100).toFixed(6)))}%`;
    case 'a chance':
    case 'a share':
      return `${String(Number((n.value * 100).toFixed(6)))}%`;
    case 'double':
      return n.value === 2 ? 'double' : `×${String(n.value)}, which is not "double"`;
    case 'half':
      return n.value === 0.5 ? 'half' : `×${String(n.value)}, which is not "half"`;
    case 'a count in words':
      return COUNTS_IN_WORDS[n.value] ?? `${String(n.value)}, a count the books write in words`;
    case 'no penalty':
      return n.value === 1 ? 'no penalty' : `×${String(n.value)}, which is not "no penalty"`;
    case 'full strength':
      return n.value === 1 ? 'full strength' : `×${String(n.value)}, which is not "full strength"`;
    case 'a base strength':
      return `base strength ${String(n.value)}`;
  }
}

/** A number as the books write it, matched with no digit just before or after it, so that a number which starts
 *  or ends the books' number isn't taken for it (×1.2 isn't in "×1.25", 5% isn't in "15%"); one written in words, as a
 *  whole word, case aside ("double" is in "DOUBLE volley damage", "two" isn't in "twofold"). */
const theNumber = (n: { readonly text: string; readonly inWords: boolean }) => {
  const escaped = n.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return n.inWords
    ? new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, 'i')
    : new RegExp(`(?<![0-9])${escaped}(?![0-9])`);
};
const norm = (s: string) => s.replace(/[’‘]/g, "'");
const strip = (s: string) => {
  for (let t = s; ;) {
    const u = t.replace(/<[^>]*>/g, ' ');
    if (u === t) return norm(u).replace(/\s+/g, ' ');
    t = u;
  }
};

const blurbs = new Map(
  entriesOf(fileDeclaring(PLAYER, 'UNIT_ABILITIES'), 'UNIT_ABILITIES').map((e) => [e.key, norm(e.value)]),
);
const rules = readPage('kingdoms-call-rules.html');
/** A unit's roster row in the rulebook, its tags stripped, or null. */
function rosterRow(unit: string): string | null {
  const at = rules.indexOf(`<tr><td><strong>${unit}</strong></td>`);
  return at < 0 ? null : strip(rules.slice(at, rules.indexOf('</tr>', at)));
}

/** The ability's own words in a text: from its name (where it heads its entry, "Name:" or "Name —", if it does) to
 *  the next ability's ("… . Other Name:"), or null if the text doesn't name it. */
function ownWords(text: string, name: string): string | null {
  const heads = [`${name}:`, `${name} —`].map((h) => text.indexOf(h)).filter((i) => i >= 0);
  const at = heads.length ? Math.min(...heads) : text.indexOf(name);
  if (at < 0) return null;
  const rest = text.slice(at + name.length);
  const next = /\.\s+[A-Z][^.:—]{0,40}(?:\s—|:)/.exec(rest);
  return name + (next ? rest.slice(0, next.index + 1) : rest);
}

const ROWS = Object.entries(UNIT_ABILITIES_THE_REGISTRY_HOLDS).map(([slug, row]) => {
  const all = Object.entries<ANumberOfAnAbility>(row.numbers);
  const leftOut = ([, n]: [string, ANumberOfAnAbility]) => n.theBooksWriteIt === 'a fraction the books leave out';
  const notInTheRulebookYet = NUMBERS_NOT_IN_THE_RULEBOOK_YET[slug] ?? {};
  const asWritten = ([, n]: [string, ANumberOfAnAbility]) => ({
    text: asTheBooksWriteIt(n),
    inWords: IN_WORDS.has(n.theBooksWriteIt),
  });
  const written = all.filter((n) => !leftOut(n));
  return {
    slug,
    unit: row.unit,
    name: row.name,
    numbers: written.map(asWritten),
    numbersInTheRulebook: written.filter(([key]) => !(key in notInTheRulebookYet)).map(asWritten),
    numbersNotInTheRulebookYet: written
      .filter(([key]) => key in notInTheRulebookYet)
      .map((n) => ({ ...asWritten(n), why: notInTheRulebookYet[n[0]] ?? '' })),
    numbersLeftOut: all.filter(leftOut).map(([, n]) => asTheBooksWriteIt(n)),
  };
});

describe("each ability's name and numbers in its unit's blurb and its roster row", () => {
  test('the content holds rows, each with its numbers but those listed as having none in the books', () => {
    expect(ROWS.length).toBeGreaterThan(0);
    for (const row of ROWS)
      expect(row.numbers.length > 0, `${row.slug} holds a number the books write`).toBe(
        !(row.slug in NO_NUMBER_IN_THE_BOOKS),
      );
    for (const slug of Object.keys(NO_NUMBER_IN_THE_BOOKS))
      expect(Object.keys(UNIT_ABILITIES_THE_REGISTRY_HOLDS)).toContain(slug);
  });

  const IN_THE_BOOKS = ROWS.filter((r) => !(r.slug in A_RETIRED_UNITS_IN_NO_BOOK));

  test.for(IN_THE_BOOKS)("$name ($unit): the player portal's blurb", ({ unit, name, numbers, numbersLeftOut }) => {
    const blurb = blurbs.get(unit);
    expect(blurb, `the player portal has a blurb for ${unit}`).toBeDefined();
    const words = ownWords(blurb ?? '', name);
    expect(words, `${unit}'s blurb names ${name}`).not.toBeNull();
    for (const n of numbers) expect(words, `${name} in ${unit}'s blurb says ${n.text}`).toMatch(theNumber(n));
    for (const n of numbersLeftOut) expect(words, `${name} in ${unit}'s blurb still leaves out ${n}`).not.toContain(n);
  });

  test.for(IN_THE_BOOKS.filter((r) => !(r.slug in NOT_IN_THE_RULEBOOK_YET)))(
    "$name ($unit): the rulebook's roster row",
    ({ slug, unit, name, numbersInTheRulebook, numbersNotInTheRulebookYet, numbersLeftOut }) => {
      const row = rosterRow(unit);
      expect(row, `the rulebook's roster has a row for ${unit}`).not.toBeNull();
      const words = ownWords(row ?? '', name);
      expect(words, `${unit}'s roster row names ${name}`).not.toBeNull();
      for (const n of numbersInTheRulebook)
        expect(words, `${name} in ${unit}'s roster row says ${n.text}`).toMatch(theNumber(n));
      for (const n of numbersNotInTheRulebookYet)
        expect(
          words,
          `${n.why}: now it says ${n.text}, so take it out of NUMBERS_NOT_IN_THE_RULEBOOK_YET['${slug}']`,
        ).not.toMatch(theNumber(n));
      for (const n of numbersLeftOut)
        expect(words, `${name} in ${unit}'s roster row still leaves out ${n}`).not.toContain(n);
    },
  );

  test.for(ROWS.filter((r) => r.slug in NOT_IN_THE_RULEBOOK_YET))(
    "$name ($unit): the rulebook's roster row doesn't name it yet (a known gap)",
    ({ slug, unit, name }) => {
      expect(rosterRow(unit), `the rulebook's roster has a row for ${unit}`).not.toBeNull();
      expect(
        ownWords(rosterRow(unit) ?? '', name),
        `${String(NOT_IN_THE_RULEBOOK_YET[slug])}: now it does, so take ${slug} out of NOT_IN_THE_RULEBOOK_YET`,
      ).toBeNull();
    },
  );

  test.for(ROWS.filter((r) => r.slug in A_RETIRED_UNITS_IN_NO_BOOK))(
    '$name ($unit): a retired unit in neither book yet (a known gap)',
    ({ slug, unit }) => {
      const why = String(A_RETIRED_UNITS_IN_NO_BOOK[slug]);
      expect(blurbs.get(unit), `${why}: now the player portal has a blurb for ${unit}, so check ${slug} there`).toBe(
        undefined,
      );
      expect(rosterRow(unit), `${why}: now the rulebook has a row for ${unit}, so check ${slug} there`).toBeNull();
    },
  );

  test('each known gap is a row the content holds, and each number left out of the rulebook one of its row', () => {
    for (const slug of [...Object.keys(NOT_IN_THE_RULEBOOK_YET), ...Object.keys(A_RETIRED_UNITS_IN_NO_BOOK)])
      expect(Object.keys(UNIT_ABILITIES_THE_REGISTRY_HOLDS)).toContain(slug);
    for (const [slug, numbers] of Object.entries(NUMBERS_NOT_IN_THE_RULEBOOK_YET)) {
      const row = ROWS.find((r) => r.slug === slug);
      expect(row, `${slug} is a row the content holds`).toBeDefined();
      expect(row?.numbersNotInTheRulebookYet.length, `each of ${slug}'s numbers listed is one of its row's`).toBe(
        Object.keys(numbers).length,
      );
    }
  });
});

// ── The abilities a table holds, read by the unit's type (plan P1-19l, Choice 2) ──

/** A number of an ability a table holds, as the books write it, with what it counts or where it acts. */
interface ANumberATableHolds {
  readonly text: string;
  readonly inWords: boolean;
}

/** An ability a table holds: its unit, its name as the books write it (and as its table does, where they differ), and
 *  its numbers as the books write them. */
interface AnAbilityATableHolds {
  readonly table: string;
  readonly unit: string;
  readonly name: string;
  readonly nameInTheTable: string;
  readonly numbers: readonly ANumberATableHolds[];
}

/** The names a table writes otherwise than both books, each with the books' name and why: the test checks that the
 *  table still writes it so and neither book does. */
const NAMES_THE_BOOKS_WRITE_ANOTHER_WAY: Readonly<Record<string, { readonly books: string; readonly why: string }>> = {
  'Acid Spit Volley': {
    books: 'Acid Spit',
    why: 'the battle report names the Wyvern Riders\' strike "Acid Spit Volley", both books "Acid Spit" (parked: one name)',
  },
};

/** The abilities whose numbers the rulebook writes outside their words, each with why: the test checks that their
 *  words in the rulebook still leave the numbers out. */
const NUMBERS_THE_RULEBOOK_WRITES_ELSEWHERE: Readonly<Record<string, string>> = {
  'Forest Runners':
    "the rulebook gives Forest Runners' numbers in the Stag Riders' terrain column (Forest ×1.1; jungle unlisted, ×1), which roster-words holds to the decided roster and roster holds TERRAIN_MODS to",
};

/** A strike's damage range as the books write it: `2–4`, with the books' en dash (U+2013). */
const aDamageRange = ([least, most]: readonly number[]): ANumberATableHolds => ({
  text: `${String(least)}\u2013${String(most)}`,
  inWords: false,
});

/** A number of a table, written as a row's number would be, with the words after it that say what it counts or where
 *  it acts ("two land units", "×1.1 in forest"). */
const withItsWords = (n: ANumberOfAnAbility, words: string): ANumberATableHolds => ({
  text: `${asTheBooksWriteIt(n)} ${words}`,
  inWords: IN_WORDS.has(n.theBooksWriteIt),
});

/** The pre-battle strikes, as the battle code reads them: a beast's `spells` that deal damage (PRIMAL_ARMY_DEFS_P),
 *  and the winged riders' (BATTLE_ARMY_SPELLS). */
interface AStrike {
  readonly name: string;
  readonly dmg: readonly number[];
}
const strikesOf = (table: string, rows: Readonly<Record<string, readonly AStrike[] | undefined>>) =>
  Object.entries(rows).flatMap(([unit, spells]) =>
    (spells ?? [])
      .filter((s) => (s.dmg[1] ?? 0) > 0)
      .map((s): AnAbilityATableHolds => ({
        table,
        unit,
        name: NAMES_THE_BOOKS_WRITE_ANOTHER_WAY[s.name]?.books ?? s.name,
        nameInTheTable: s.name,
        numbers: [aDamageRange(s.dmg)],
      })),
  );
const BEASTS_SPELLS: Readonly<Record<string, readonly AStrike[] | undefined>> = Object.fromEntries(
  Object.entries(PRIMAL_ARMY_DEFS_P).map(([unit, d]) => [unit, 'spells' in d ? d.spells : undefined]),
);
const RIDERS_SPELLS: Readonly<Record<string, readonly AStrike[] | undefined>> = BATTLE_ARMY_SPELLS;

/** The engine's TERRAIN_MODS, read by its syntax tree: a unit's cell on a ground, or undefined. The battle file isn't
 *  loaded (it is the engine's); its initializer is an object literal of grounds, each an object literal of units. */
const TERRAIN_MODS = entriesOf('engine/battle/terrain-and-unit-strength.ts', 'TERRAIN_MODS');
function terrainCell(ground: string, unit: string): number | undefined {
  const row = TERRAIN_MODS.find((e) => e.key === ground)?.value;
  if (row === undefined) return undefined;
  const tree = ts.createSourceFile('cell.ts', `(${row})`, ts.ScriptTarget.Latest);
  const first = tree.statements[0];
  if (!first || !ts.isExpressionStatement(first) || !ts.isParenthesizedExpression(first.expression)) return undefined;
  const cells = first.expression.expression;
  if (!ts.isObjectLiteralExpression(cells)) return undefined;
  for (const p of cells.properties)
    if (
      ts.isPropertyAssignment(p) &&
      (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name)) &&
      p.name.text === unit &&
      ts.isNumericLiteral(p.initializer)
    )
      return Number(p.initializer.text);
  return undefined;
}
const FOREST_RUNNERS = { forest: terrainCell('forest', 'Stag Riders'), jungle: terrainCell('jungle', 'Stag Riders') };
const ISLAND_BACK = KC_CARRIER_BERTHS['Great Turtles'];

const TABLES: readonly AnAbilityATableHolds[] = [
  ...strikesOf('PRIMAL_ARMY_DEFS_P', BEASTS_SPELLS),
  ...strikesOf('BATTLE_ARMY_SPELLS', RIDERS_SPELLS),
  {
    table: 'KC_CARRIER_BERTHS',
    unit: 'Great Turtles',
    name: 'Island Back',
    nameInTheTable: 'Island Back',
    numbers: [
      withItsWords(
        { value: ISLAND_BACK, theBooksWriteIt: 'a count in words' },
        ISLAND_BACK === 1 ? 'land unit' : 'land units',
      ),
    ],
  },
  {
    table: 'TERRAIN_MODS',
    unit: 'Stag Riders',
    name: 'Forest Runners',
    nameInTheTable: 'Forest Runners',
    numbers: [
      withItsWords({ value: FOREST_RUNNERS.forest ?? NaN, theBooksWriteIt: 'a multiplier' }, 'in forest'),
      withItsWords({ value: FOREST_RUNNERS.jungle ?? NaN, theBooksWriteIt: 'no penalty' }, 'in jungle'),
    ],
  },
];

describe("each ability a table holds: its name and numbers in its unit's blurb and its roster row", () => {
  test('the tables are read: the strikes of both tables, Island Back and both of Forest Runners’ cells', () => {
    expect(TABLES.filter((r) => r.table === 'PRIMAL_ARMY_DEFS_P').length).toBeGreaterThan(0);
    expect(TABLES.filter((r) => r.table === 'BATTLE_ARMY_SPELLS').length).toBeGreaterThan(0);
    expect(ISLAND_BACK, "the Great Turtles' berths").toBeTypeOf('number');
    expect(FOREST_RUNNERS.forest, "the Stag Riders' forest cell of TERRAIN_MODS").toBeTypeOf('number');
    expect(FOREST_RUNNERS.jungle, "the Stag Riders' jungle cell of TERRAIN_MODS").toBeTypeOf('number');
  });

  test.for(TABLES)("$name ($unit, $table): the player portal's blurb", ({ unit, name, numbers }) => {
    const blurb = blurbs.get(unit);
    expect(blurb, `the player portal has a blurb for ${unit}`).toBeDefined();
    const words = ownWords(blurb ?? '', name);
    expect(words, `${unit}'s blurb names ${name}`).not.toBeNull();
    for (const n of numbers) expect(words, `${name} in ${unit}'s blurb says ${n.text}`).toMatch(theNumber(n));
  });

  test.for(TABLES.filter((r) => !(r.name in NUMBERS_THE_RULEBOOK_WRITES_ELSEWHERE)))(
    "$name ($unit, $table): the rulebook's roster row",
    ({ unit, name, numbers }) => {
      const row = rosterRow(unit);
      expect(row, `the rulebook's roster has a row for ${unit}`).not.toBeNull();
      const words = ownWords(row ?? '', name);
      expect(words, `${unit}'s roster row names ${name}`).not.toBeNull();
      for (const n of numbers) expect(words, `${name} in ${unit}'s roster row says ${n.text}`).toMatch(theNumber(n));
    },
  );

  test.for(TABLES.filter((r) => r.name in NUMBERS_THE_RULEBOOK_WRITES_ELSEWHERE))(
    "$name ($unit, $table): the rulebook's roster row names it, its numbers elsewhere (a known difference)",
    ({ unit, name, numbers }) => {
      const row = rosterRow(unit);
      expect(row, `the rulebook's roster has a row for ${unit}`).not.toBeNull();
      const words = ownWords(row ?? '', name);
      expect(words, `${unit}'s roster row names ${name}`).not.toBeNull();
      const why = String(NUMBERS_THE_RULEBOOK_WRITES_ELSEWHERE[name]);
      for (const n of numbers)
        expect(
          words,
          `${why}: now its words say ${n.text}, so take ${name} out of NUMBERS_THE_RULEBOOK_WRITES_ELSEWHERE`,
        ).not.toMatch(theNumber(n));
    },
  );

  test.for(TABLES.filter((r) => r.nameInTheTable !== r.name))(
    '$nameInTheTable ($unit, $table): a name neither book writes yet (a known gap)',
    ({ unit, name, nameInTheTable }) => {
      const why = String(NAMES_THE_BOOKS_WRITE_ANOTHER_WAY[nameInTheTable]?.why);
      for (const [book, text] of [
        ['blurb', blurbs.get(unit) ?? ''],
        ['roster row', rosterRow(unit) ?? ''],
      ] as const)
        expect(
          text,
          `${why}: now ${unit}'s ${book} names ${nameInTheTable}, not ${name}, so take it out of NAMES_THE_BOOKS_WRITE_ANOTHER_WAY`,
        ).not.toContain(nameInTheTable);
    },
  );

  test('each name and number listed as known is one a table holds', () => {
    for (const name of Object.keys(NAMES_THE_BOOKS_WRITE_ANOTHER_WAY))
      expect(TABLES.map((r) => r.nameInTheTable)).toContain(name);
    for (const name of Object.keys(NUMBERS_THE_RULEBOOK_WRITES_ELSEWHERE))
      expect(TABLES.map((r) => r.name)).toContain(name);
  });
});
