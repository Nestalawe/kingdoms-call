// Each unit ability's name and numbers are in both books (plan P1-19, Decision 5): for every row of the content's unit
// abilities (src/content/unit-abilities-their-names-numbers-and-words.ts, the numbers the rule registry's effects
// read), the ability's name, and each of its numbers as the books write it (×1.25, +10%), are in its unit's blurb in
// the player portal (UNIT_ABILITIES) and in its roster row in the comprehensive rulebook, within the ability's own words
// (from its name to the next ability's). So a number changed in content, and not in the books, turns this red. This
// family's share of plan P3-02's words helper; the older words tests (abilities-words, primal-abilities-words) keep the
// names of the abilities the registry doesn't hold yet.
// One gap is known and let through, each with its fix parked: the rulebook's Orcish Longships row doesn't name Reaver
// Crews (the test fails once it does, so the exception leaves with the fix).
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

/** A number as the books write it: ×1.25, or +10% for a fraction added. */
function asTheBooksWriteIt(n: ANumberOfAnAbility): string {
  if (n.theBooksWriteIt === 'a multiplier') return `×${String(n.value)}`;
  return `+${String(Number((n.value * 100).toFixed(6)))}%`;
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

const ROWS = Object.entries(UNIT_ABILITIES_THE_REGISTRY_HOLDS).map(([slug, row]) => ({
  slug,
  unit: row.unit,
  name: row.name,
  numbers: Object.values<ANumberOfAnAbility>(row.numbers).map(asTheBooksWriteIt),
}));

describe("each ability's name and numbers in its unit's blurb and its roster row", () => {
  test('the content holds rows, each with its numbers', () => {
    expect(ROWS.length).toBeGreaterThan(0);
    for (const row of ROWS) expect(row.numbers.length, row.slug).toBeGreaterThan(0);
  });

  test.for(ROWS)("$name ($unit): the player portal's blurb", ({ unit, name, numbers }) => {
    const blurb = blurbs.get(unit);
    expect(blurb, `the player portal has a blurb for ${unit}`).toBeDefined();
    const words = ownWords(blurb ?? '', name);
    expect(words, `${unit}'s blurb names ${name}`).not.toBeNull();
    for (const n of numbers) expect(words, `${name} in ${unit}'s blurb says ${n}`).toContain(n);
  });

  test.for(ROWS.filter((r) => !(r.slug in NOT_IN_THE_RULEBOOK_YET)))(
    "$name ($unit): the rulebook's roster row",
    ({ unit, name, numbers }) => {
      const row = rosterRow(unit);
      expect(row, `the rulebook's roster has a row for ${unit}`).not.toBeNull();
      const words = ownWords(row ?? '', name);
      expect(words, `${unit}'s roster row names ${name}`).not.toBeNull();
      for (const n of numbers) expect(words, `${name} in ${unit}'s roster row says ${n}`).toContain(n);
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
