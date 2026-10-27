// Each unit ability's name and numbers are in both books (plan P1-19, Decision 5): for every row of the content's unit
// abilities (src/content/unit-abilities-their-names-numbers-and-words.ts, the numbers the rule registry's effects
// read), the ability's name, and each of its numbers as the books write it (×1.25, +10%), are in its unit's blurb in
// the player portal (UNIT_ABILITIES) and in its roster row in the comprehensive rulebook, within the ability's own words
// (from its name to the next ability's), with no digit just before or after it (×1.2 is not in "×1.25": plan P1-19f).
// So a number changed in content, and not in the books, turns this red. This
// family's share of plan P3-02's words helper; the older words tests (abilities-words, primal-abilities-words) keep the
// names of the abilities the registry doesn't hold yet.
// Three gaps are known and let through, each with its fix parked (the three fleets): the rulebook's Orcish Longships row
// doesn't name Reaver Crews, nor its Elven Galleys row Sea Archers, nor its Dwarf Ironclads row Armoured Hulls (the test
// fails once it does, so the exception leaves with the fix). An ability the books give no number (Rooted, Hold the Gate,
// Town Watch, Battering Horns: plan P1-19c; Knightly Example: P1-19d; eight of the volley's: P1-19g) is listed below,
// and its name is checked; a number the books leave out (Driven Before Them's cap, which the units beside them never
// reach) is checked to be still left out. A number the books write in words (double, half, two) is matched as a whole
// word, case aside (the rulebook writes "DOUBLE volley damage").
// Level 0 (static): the content's rows imported (plain data), the player portal's blurbs by their syntax tree
// (tests/lib/source.ts), the rulebook as built (site/); nothing runs.
import { describe, expect, test } from 'vitest';
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
};

/** A count as the books write it, in words (any other count is written so that no book holds it). */
const COUNTS_IN_WORDS: Readonly<Record<number, string>> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

/** The ways the books write a number in words: matched as a whole word, case aside. */
const IN_WORDS: ReadonlySet<ANumberOfAnAbility['theBooksWriteIt']> = new Set(['double', 'half', 'a count in words']);

/** A number as the books write it: ×1.25; +10% for a fraction added (and for one the books leave out, which the test
 *  checks they still do); 30% for a chance and 55% for a share; "no penalty" for full strength, ×1, "double" for ×2 and
 *  "half" for ×0.5, and a count in words, "two" (any other value is written so that no book holds it, and the test turns
 *  red); "base strength 6" for a unit's base strength. */
function asTheBooksWriteIt(n: ANumberOfAnAbility): string {
  switch (n.theBooksWriteIt) {
    case 'a multiplier':
      return `×${String(n.value)}`;
    case 'a fraction added':
    case 'a fraction the books leave out':
      return `+${String(Number((n.value * 100).toFixed(6)))}%`;
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
  const all = Object.values<ANumberOfAnAbility>(row.numbers);
  const leftOut = (n: ANumberOfAnAbility) => n.theBooksWriteIt === 'a fraction the books leave out';
  return {
    slug,
    unit: row.unit,
    name: row.name,
    numbers: all
      .filter((n) => !leftOut(n))
      .map((n) => ({ text: asTheBooksWriteIt(n), inWords: IN_WORDS.has(n.theBooksWriteIt) })),
    numbersLeftOut: all.filter(leftOut).map(asTheBooksWriteIt),
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

  test.for(ROWS)("$name ($unit): the player portal's blurb", ({ unit, name, numbers, numbersLeftOut }) => {
    const blurb = blurbs.get(unit);
    expect(blurb, `the player portal has a blurb for ${unit}`).toBeDefined();
    const words = ownWords(blurb ?? '', name);
    expect(words, `${unit}'s blurb names ${name}`).not.toBeNull();
    for (const n of numbers) expect(words, `${name} in ${unit}'s blurb says ${n.text}`).toMatch(theNumber(n));
    for (const n of numbersLeftOut) expect(words, `${name} in ${unit}'s blurb still leaves out ${n}`).not.toContain(n);
  });

  test.for(ROWS.filter((r) => !(r.slug in NOT_IN_THE_RULEBOOK_YET)))(
    "$name ($unit): the rulebook's roster row",
    ({ unit, name, numbers, numbersLeftOut }) => {
      const row = rosterRow(unit);
      expect(row, `the rulebook's roster has a row for ${unit}`).not.toBeNull();
      const words = ownWords(row ?? '', name);
      expect(words, `${unit}'s roster row names ${name}`).not.toBeNull();
      for (const n of numbers) expect(words, `${name} in ${unit}'s roster row says ${n.text}`).toMatch(theNumber(n));
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

  test('each known gap is a row the content holds', () => {
    for (const slug of Object.keys(NOT_IN_THE_RULEBOOK_YET))
      expect(Object.keys(UNIT_ABILITIES_THE_REGISTRY_HOLDS)).toContain(slug);
  });
});
