// Each unit ability's name and numbers are in both books (plan P1-19, Decision 5): for every row of the content's unit
// abilities (src/content/unit-abilities-their-names-numbers-and-words.ts, the numbers the rule registry's effects
// read), the ability's name, and each of its numbers as the books write it (×1.25, +10%), are in its unit's blurb in
// the player portal (UNIT_ABILITIES) and in its roster row in the comprehensive rulebook, within the ability's own words
// (from its name to the next ability's). So a number changed in content, and not in the books, turns this red. This
// family's share of plan P3-02's words helper; the older words tests (abilities-words, primal-abilities-words) keep the
// names of the abilities the registry doesn't hold yet.
// One gap is known and let through, each with its fix parked: the rulebook's Orcish Longships row doesn't name Reaver
// Crews (the test fails once it does, so the exception leaves with the fix). An ability the books give no number (Rooted,
// Hold the Gate, Town Watch, Battering Horns: plan P1-19c; Knightly Example: P1-19d) is listed below, and its name is
// checked; a number the books leave out (Driven Before Them's cap, which the units beside them never reach) is checked
// to be still left out.
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
};

/** A number as the books write it: ×1.25; +10% for a fraction added (and for one the books leave out, which the test
 *  checks they still do); 30% for a chance; "no penalty" for full strength, ×1 (any other value is written so that no
 *  book holds it, and the test turns red); "base strength 6" for a unit's base strength. */
function asTheBooksWriteIt(n: ANumberOfAnAbility): string {
  switch (n.theBooksWriteIt) {
    case 'a multiplier':
      return `×${String(n.value)}`;
    case 'a fraction added':
    case 'a fraction the books leave out':
      return `+${String(Number((n.value * 100).toFixed(6)))}%`;
    case 'a chance':
      return `${String(Number((n.value * 100).toFixed(6)))}%`;
    case 'no penalty':
      return n.value === 1 ? 'no penalty' : `×${String(n.value)}, which is not "no penalty"`;
    case 'a base strength':
      return `base strength ${String(n.value)}`;
  }
}

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
    numbers: all.filter((n) => !leftOut(n)).map(asTheBooksWriteIt),
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
    for (const n of numbers) expect(words, `${name} in ${unit}'s blurb says ${n}`).toContain(n);
    for (const n of numbersLeftOut) expect(words, `${name} in ${unit}'s blurb still leaves out ${n}`).not.toContain(n);
  });

  test.for(ROWS.filter((r) => !(r.slug in NOT_IN_THE_RULEBOOK_YET)))(
    "$name ($unit): the rulebook's roster row",
    ({ unit, name, numbers, numbersLeftOut }) => {
      const row = rosterRow(unit);
      expect(row, `the rulebook's roster has a row for ${unit}`).not.toBeNull();
      const words = ownWords(row ?? '', name);
      expect(words, `${unit}'s roster row names ${name}`).not.toBeNull();
      for (const n of numbers) expect(words, `${name} in ${unit}'s roster row says ${n}`).toContain(n);
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
