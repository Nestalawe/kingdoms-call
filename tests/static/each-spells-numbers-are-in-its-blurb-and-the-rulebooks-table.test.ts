// Each spell's numbers are in its blurb and the rulebook's table (plan P1-19's spells family, Decision 2: the words
// tests read the registry's rows, so a number has one source). For every row of the content's spells
// (src/content/spell-effects-their-names-numbers-and-words.ts, the numbers the spells' registry reads), each number of
// its battle magic is stated, as the spell's texts write it (a share lost as "half", "halved" or "halves", or as a
// percentage, `20%`, or as the share kept, `75%`; a multiplier as "half", "halved" or "halves"; the strongest units
// struck as "strongest unit" or "strongest enemy army unit"; the level counted to as "counted to 5"), in the "Battle
// magic:" part of its blurb (SPELL_DEFS_P's `desc`, which the order form shows) and in the "Battle:" part of its row of
// the rulebook's spell table (src/kingdoms-call-rules.html), whole (no digit or letter just before it, nor a digit, a
// letter, a `%` or a decimal part just after). So a number changed in content, and not in the texts, turns this red,
// and so does a text changed alone. Every spell whose blurb has a "Battle magic:" part has a row with its battle
// magic, and its rulebook row the B pill; the rows with no number (a mark on the enemy commander, a unit turned) are
// listed with why, so a number added to one is checked. The known gaps are listed by name, each with its Parked entry,
// and checked to be still gaps (so the exception leaves with the fix).
// Level 0 (static): the content's spells and the rulebook's source are files; nothing of the engine runs.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { SPELL_DEFS_P } from '../../src/content/kingdoms-call-data.ts';
import {
  SPELL_EFFECTS_THE_REGISTRY_HOLDS,
  type ANumberOfASpellsEffect,
  type SpellSlug,
} from '../../src/content/spell-effects-their-names-numbers-and-words.ts';
import { ROOT } from '../../tools/build.ts';

const BLURBS = 'Parked "Two spell blurbs misstate their battle magic"';
/** The numbers a text doesn't state yet, by the row's slug and the number's name, each with where and why. */
const KNOWN_GAPS: Partial<Record<SpellSlug, Readonly<Record<string, Partial<Record<'blurb' | 'rulebook', string>>>>>> =
  {
    'lightning-bolt': {
      theLevelItCountsTo: {
        blurb: `its Battle magic says "a number of enemy armies equal to your level" (${BLURBS})`,
        rulebook:
          'its Battle part says "several enemy units": the spellbook states the rule once for every spell ("Spell EFFECTS are worked out on your level counted to 5")',
      },
    },
    'telekinetic-storm': {
      theTacticalMultiplier: { blurb: `its Battle magic says it "negates" the Tactical bonus (${BLURBS})` },
    },
  };
/** The rows with no number in their battle magic, each with why. */
const ROWS_WITH_NO_NUMBER: Partial<Record<SpellSlug, string>> = {
  'psychic-blast': "a mark on the enemy commander (his Druid negated, which the battle's readers of the mark apply)",
  curse: "a mark on the enemy commander (his skill to halve, which the battle's readers of the mark halve)",
  'control-undead': 'one unit turned, drawn at random',
};

/** A count in words, as the texts write it (a value with no word here writes as itself: no text matches). */
const IN_WORDS: Readonly<Record<number, string>> = { 1: 'one', 2: 'two', 3: 'three' };
const inWords = (value: number) => IN_WORDS[value] ?? String(value);
const percent = (value: number) => `${String(Number((value * 100).toFixed(6)))}%`;

/** A number as a spell's texts write it (any of the forms given). */
function asTheTextsWriteIt(n: ANumberOfASpellsEffect): string[] {
  switch (n.theTextsWriteIt) {
    case 'a share lost, in words':
    case 'a multiplier, in words':
      return n.value === 0.5 ? ['half', 'halved', 'halves'] : [String(n.value)];
    case 'a share lost, as a percentage':
      return [percent(n.value)];
    case 'a share lost, as the share kept':
      return [percent(1 - n.value)];
    case 'the strongest units, in words':
      return n.value === 1 ? ['strongest unit', 'strongest enemy army unit'] : [`${inWords(n.value)} strongest`];
    case 'the level it counts to':
      return [`counted to ${String(n.value)}`, `counted to level ${String(n.value)}`];
  }
}
/** A number as the texts write it, with no digit or letter just before it, nor a digit, a letter, a `%` or a decimal
 *  part just after. */
const theNumber = (text: string) =>
  new RegExp(`(?<![0-9A-Za-z])${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9A-Za-z%]|\\.[0-9])`);
/** Whether a text states a number in one of the forms it is written. */
const states = (text: string, forms: readonly string[]) => forms.some((form) => theNumber(form).test(text));

/** The blurbs by any spell's name. */
const SPELLS: Readonly<Record<string, { readonly desc: string } | undefined>> = SPELL_DEFS_P;
/** The part of a blurb after "Battle magic:", or none. */
const theBattleMagicOf = (name: string) => SPELLS[name]?.desc.split('Battle magic:')[1]?.trim() ?? null;

const RULEBOOK = fs.readFileSync(path.join(ROOT, 'src', 'kingdoms-call-rules.html'), 'utf8');
/** A spell's row of the rulebook's spell table, or none. */
const theRulebooksRowOf = (name: string) =>
  RULEBOOK.split('\n').find((line) => line.includes(`<tr><td><strong>${name}</strong>`)) ?? null;
/** The words of the "Battle:" part of a spell's rulebook row (its tags taken out), or none. */
const theRulebooksBattleOf = (name: string) =>
  theRulebooksRowOf(name)
    ?.split('Battle:')[1]
    ?.replace(/<[^>]*>/g, '')
    .trim() ?? null;

const ROWS = Object.entries(SPELL_EFFECTS_THE_REGISTRY_HOLDS).map(([slug, row]) => ({
  slug: slug as SpellSlug,
  name: row.name,
  numbers: Object.entries<ANumberOfASpellsEffect>(row.battleMagic).map(
    ([name, n]) => [name, asTheTextsWriteIt(n)] as const,
  ),
  blurb: theBattleMagicOf(row.name),
  rulebook: theRulebooksBattleOf(row.name),
}));

describe("each spell's battle magic states its numbers, in its blurb and its rulebook row", () => {
  test.for(ROWS.filter((row) => row.numbers.length))('%s', (row) => {
    expect(row.blurb, `${row.name}'s blurb has a Battle magic part`).not.toBeNull();
    expect(row.rulebook, `${row.name}'s rulebook row has a Battle part`).not.toBeNull();
    const gaps = KNOWN_GAPS[row.slug] ?? {};
    const missing = row.numbers.flatMap(([name, forms]) =>
      (['blurb', 'rulebook'] as const).flatMap((where) =>
        gaps[name]?.[where] === undefined && !states(row[where] ?? '', forms)
          ? [`${where}: ${forms.join(' or ')}`]
          : [],
      ),
    );
    expect(missing, `the numbers ${row.name}'s texts leave out`).toEqual([]);
  });
});

describe('the known gaps are still gaps (each leaves with its fix)', () => {
  test.for(
    Object.entries(KNOWN_GAPS).flatMap(([slug, numbers]) =>
      Object.entries(numbers).flatMap(([name, wheres]) =>
        Object.keys(wheres).map((where) => [slug, name, where] as const),
      ),
    ),
  )('%s: %s, in its %s', ([slug, name, where]) => {
    const row = ROWS.find((r) => r.slug === slug);
    const forms = row?.numbers.find(([n]) => n === name)?.[1];
    expect(forms, `${slug} has the number ${name}`).toBeDefined();
    expect(states((where === 'blurb' ? row?.blurb : row?.rulebook) ?? '', forms ?? [])).toBe(false);
  });
});

test('every spell whose blurb has battle magic has a row with it, and its rulebook row the B pill', () => {
  const withBattleMagic = Object.keys(SPELL_DEFS_P).filter((name) => theBattleMagicOf(name) !== null);
  expect(withBattleMagic.sort()).toEqual(ROWS.map((row) => row.name).sort());
  for (const row of ROWS)
    expect(theRulebooksRowOf(row.name), `${row.name}'s rulebook row`).toContain('<span class="pill">B</span>');
});

test('the rows with no number are the ones listed', () => {
  expect(
    ROWS.filter((row) => !row.numbers.length)
      .map((row) => row.slug)
      .sort(),
  ).toEqual(Object.keys(ROWS_WITH_NO_NUMBER).sort());
});
