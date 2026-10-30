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
// listed with why, so a number added to one is checked. Since P1-19w, each number of a row's combat (a percentage as
// `10%`, rounds as "3 rounds" or "three rounds", rounds longer as "one round longer", the most rounds as "at most 3" or
// "up to 3", the levels for each round more as "per two" or "every two", a share as "a quarter", a multiplier as
// `×1.5` or "half as much again", a range of damage as `1–3`, a divisor as "halve", "halved" or "halves") is stated the
// same way in the "Combat:" part of its blurb (up to its "Battle magic:") and of its rulebook row (from its "Combat:" or
// "In combat:", up to its "Battle:"); since P1-19x, every spell whose blurb has a "Combat:" part has a row with its
// combat, and the rows with no combat number are listed with why. The known gaps are listed by name, each with where
// and why (a Parked entry where the text is at fault), and checked to be still gaps (so the exception leaves with the
// fix).
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
const SPIRITWRACKS_BLURB = 'Parked "Spiritwrack\'s blurb leaves out three of its combat numbers"';
const MIRROR_AND_INVISIBILITY =
  "Parked \"Mirror Image's and Invisibility's texts leave out numbers, and the Mirror Shard's its half\"";
/** A Mirror Image's chance to be seen through, as no text gives it yet: a guardian's, and its bounds. */
const A_GUARDIANS_DISBELIEF = `a guardian's chance to see through it, and its bounds, are in neither text (${MIRROR_AND_INVISIBILITY})`;
/** Where a text states a spell's numbers: its blurb's or its rulebook row's part for a use. */
type AText = 'blurb' | 'rulebook';
/** The numbers of a use a text doesn't state yet, by the row's slug and the number's name, each with where and why. */
type TheGaps = Partial<Record<SpellSlug, Readonly<Record<string, Partial<Record<AText, string>>>>>>;
/** The numbers a text doesn't state yet, of the spells' battle magic. */
const KNOWN_GAPS: TheGaps = {
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
/** The numbers a text doesn't state yet, of the spells' combat. */
const KNOWN_COMBAT_GAPS: TheGaps = {
  spiritwrack: {
    theMostRounds: { rulebook: 'it gives the rounds level by level ("3 at 4–5; levels past 5 add nothing")' },
    theRoundsLongerAgainstAGuardianWeakToWhite: {
      blurb: `its Combat part leaves out a guardian weak to White (${SPIRITWRACKS_BLURB})`,
    },
    theChanceAPowerfulGuardianShrugsItOff: { blurb: `its Combat part leaves out the shrug (${SPIRITWRACKS_BLURB})` },
    theChanceALegendaryGuardianShrugsItOff: { blurb: `its Combat part leaves out the shrug (${SPIRITWRACKS_BLURB})` },
  },
  'mirror-image': {
    theShareOfHisHealthTheImageCarries: {
      blurb: `its Combat part leaves out the image's health (${MIRROR_AND_INVISIBILITY})`,
    },
    theRoundsItLasts: { blurb: `its Combat part leaves out the rounds it lasts (${MIRROR_AND_INVISIBILITY})` },
    theChanceAGuardianSeesThroughIt: { blurb: A_GUARDIANS_DISBELIEF, rulebook: A_GUARDIANS_DISBELIEF },
    theChanceMoreForEachLevelOfAGuardiansMelee: { blurb: A_GUARDIANS_DISBELIEF, rulebook: A_GUARDIANS_DISBELIEF },
    theLeastChanceItIsSeenThrough: { blurb: A_GUARDIANS_DISBELIEF, rulebook: A_GUARDIANS_DISBELIEF },
    theMostChanceItIsSeenThrough: { blurb: A_GUARDIANS_DISBELIEF, rulebook: A_GUARDIANS_DISBELIEF },
  },
  invisibility: {
    theStealAdded: { blurb: `its Combat part leaves out the steal (${MIRROR_AND_INVISIBILITY})` },
  },
};
/** The rows with no number in their combat, each with why. */
const ROWS_WITH_NO_COMBAT_NUMBER: Partial<Record<SpellSlug, string>> = {
  'control-undead': 'a stun of a round a level, the level counted to 5 (the rule every spell shares)',
  charm: "the caster's next flight at double the chance (the doubling is the flight's)",
};
/** The rows with no number in their battle magic, each with why. */
const ROWS_WITH_NO_NUMBER: Partial<Record<SpellSlug, string>> = {
  'psychic-blast': "a mark on the enemy commander (his Druid negated, which the battle's readers of the mark apply)",
  curse: "a mark on the enemy commander (his skill to halve, which the battle's readers of the mark halve)",
  'control-undead': 'one unit turned, drawn at random',
};

/** A count in words, as the texts write it (a value with no word here writes as itself: no text matches). */
const IN_WORDS: Readonly<Record<number, string>> = { 1: 'one', 2: 'two', 3: 'three' };
/** A share in words, as the texts write it (a value with no word here writes as itself: no text matches). */
const A_SHARE_IN_WORDS: Readonly<Record<number, string>> = { 0.25: 'a quarter', 0.5: 'half' };
/** A multiplier in words, as the texts write it, beside its figure. */
const A_MULTIPLIER_IN_WORDS: Readonly<Record<number, string>> = { 1.5: 'half as much again' };
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
    case 'a percentage':
      return [`${String(n.value)}%`];
    case 'rounds':
      return [
        `${String(n.value)} round${n.value === 1 ? '' : 's'}`,
        `${inWords(n.value)} round${n.value === 1 ? '' : 's'}`,
      ];
    case 'rounds longer':
      return [`${inWords(n.value)} round${n.value === 1 ? '' : 's'} longer`];
    case 'the most rounds':
      return [`at most ${String(n.value)}`, `up to ${String(n.value)}`];
    case 'the levels for each round more, in words':
      return [`per ${inWords(n.value)}`, `every ${inWords(n.value)}`];
    case 'a share, in words':
      return [A_SHARE_IN_WORDS[n.value] ?? String(n.value)];
    case 'a multiplier, as a figure':
      return [
        `×${String(n.value)}`,
        ...(A_MULTIPLIER_IN_WORDS[n.value] === undefined ? [] : [A_MULTIPLIER_IN_WORDS[n.value] ?? '']),
      ];
    case 'the least of a range':
      return [`${String(n.value)}–`];
    case 'the most of a range':
      return [`–${String(n.value)}`];
    case 'a divisor, in words':
      return n.value === 2 ? ['halve', 'halved', 'halves'] : [String(n.value)];
  }
}
/** A number as the texts write it, with no digit or letter just before it, nor a digit, a letter, a `%` or a decimal
 *  part just after; but a half of a range (`1–`, `–3`) is whole on its dash's side, where the other half's digits
 *  stand. */
const theNumber = (text: string) =>
  new RegExp(
    `${text.startsWith('–') ? '' : '(?<![0-9A-Za-z])'}${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${text.endsWith('–') ? '' : '(?![0-9A-Za-z%]|\\.[0-9])'}`,
  );
/** Whether a text states a number in one of the forms it is written. */
const states = (text: string, forms: readonly string[]) => forms.some((form) => theNumber(form).test(text));

/** The blurbs by any spell's name. */
const SPELLS: Readonly<Record<string, { readonly desc: string } | undefined>> = SPELL_DEFS_P;
/** The part of a blurb after "Battle magic:", or none. */
const theBattleMagicOf = (name: string) => SPELLS[name]?.desc.split('Battle magic:')[1]?.trim() ?? null;
/** The part of a blurb after "Combat:", up to its "Battle magic:", or none. */
const theCombatOf = (name: string) => SPELLS[name]?.desc.split('Combat:')[1]?.split('Battle magic:')[0]?.trim() ?? null;

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

/** The words of the "Combat:" (or "In combat:") part of a spell's rulebook row, up to its "Battle:" (its tags taken
 *  out), or none. */
const theRulebooksCombatOf = (name: string) =>
  theRulebooksRowOf(name)
    ?.split(/Combat:|In combat:/)[1]
    ?.split('Battle:')[0]
    ?.replace(/<[^>]*>/g, '')
    .trim() ?? null;

/** The rows as the content writes them (each use's numbers by any name). */
type ARow = Readonly<{
  name: string;
  battleMagic?: Readonly<Record<string, ANumberOfASpellsEffect>>;
  combat?: Readonly<Record<string, ANumberOfASpellsEffect>>;
}>;
const THE_ROWS: Readonly<Record<SpellSlug, ARow>> = SPELL_EFFECTS_THE_REGISTRY_HOLDS;
/** Each row with numbers for the use, the forms of each number, and the parts of its texts that state them. */
const rowsOf = (use: 'battleMagic' | 'combat') =>
  Object.entries(THE_ROWS).flatMap(([slug, row]) => {
    const numbers = row[use];
    if (numbers === undefined) return [];
    return [
      {
        slug: slug as SpellSlug,
        name: row.name,
        numbers: Object.entries(numbers).map(([name, n]) => [name, asTheTextsWriteIt(n)] as const),
        blurb: use === 'battleMagic' ? theBattleMagicOf(row.name) : theCombatOf(row.name),
        rulebook: use === 'battleMagic' ? theRulebooksBattleOf(row.name) : theRulebooksCombatOf(row.name),
      },
    ];
  });
const ROWS = rowsOf('battleMagic');
const COMBAT_ROWS = rowsOf('combat');
type ARowOfAUse = (typeof ROWS)[number];

/** The numbers a row's texts leave out, but its known gaps. */
const whatTheTextsLeaveOut = (row: ARowOfAUse, gaps: TheGaps) =>
  row.numbers.flatMap(([name, forms]) =>
    (['blurb', 'rulebook'] as const).flatMap((where) =>
      gaps[row.slug]?.[name]?.[where] === undefined && !states(row[where] ?? '', forms)
        ? [`${where}: ${forms.join(' or ')}`]
        : [],
    ),
  );
/** Each known gap, as [slug, number, where]. */
const theGapsOf = (gaps: TheGaps) =>
  Object.entries(gaps).flatMap(([slug, numbers]) =>
    Object.entries(numbers).flatMap(([name, wheres]) =>
      Object.keys(wheres).map((where) => [slug, name, where] as const),
    ),
  );
/** A known gap's number's forms (none if the row has no such number), and whether the text it is listed for states
 *  it. */
const theGap = (rows: readonly ARowOfAUse[], [slug, name, where]: readonly [string, string, string]) => {
  const row = rows.find((r) => r.slug === slug);
  const forms = row?.numbers.find(([n]) => n === name)?.[1];
  return { forms, stated: states((where === 'blurb' ? row?.blurb : row?.rulebook) ?? '', forms ?? []) };
};

describe("each spell's battle magic states its numbers, in its blurb and its rulebook row", () => {
  test.for(ROWS.filter((row) => row.numbers.length))('%s', (row) => {
    expect(row.blurb, `${row.name}'s blurb has a Battle magic part`).not.toBeNull();
    expect(row.rulebook, `${row.name}'s rulebook row has a Battle part`).not.toBeNull();
    expect(whatTheTextsLeaveOut(row, KNOWN_GAPS), `the numbers ${row.name}'s texts leave out`).toEqual([]);
  });
});

describe("each spell's combat states its numbers, in its blurb and its rulebook row", () => {
  test.for(COMBAT_ROWS)('%s', (row) => {
    expect(row.blurb, `${row.name}'s blurb has a Combat part`).not.toBeNull();
    expect(row.rulebook, `${row.name}'s rulebook row has a Combat part`).not.toBeNull();
    expect(whatTheTextsLeaveOut(row, KNOWN_COMBAT_GAPS), `the numbers ${row.name}'s texts leave out`).toEqual([]);
  });
});

describe('the known gaps are still gaps (each leaves with its fix)', () => {
  test.for(theGapsOf(KNOWN_GAPS))('battle magic, %s: %s, in its %s', (gap) => {
    const { forms, stated } = theGap(ROWS, gap);
    expect(forms, `${gap[0]} has the number ${gap[1]}`).toBeDefined();
    expect(stated).toBe(false);
  });
  test.for(theGapsOf(KNOWN_COMBAT_GAPS))('combat, %s: %s, in its %s', (gap) => {
    const { forms, stated } = theGap(COMBAT_ROWS, gap);
    expect(forms, `${gap[0]} has the number ${gap[1]}`).toBeDefined();
    expect(stated).toBe(false);
  });
});

test('every spell whose blurb has battle magic has a row with it, and its rulebook row the B pill', () => {
  const withBattleMagic = Object.keys(SPELL_DEFS_P).filter((name) => theBattleMagicOf(name) !== null);
  expect(withBattleMagic.sort()).toEqual(ROWS.map((row) => row.name).sort());
  for (const row of ROWS)
    expect(theRulebooksRowOf(row.name), `${row.name}'s rulebook row`).toContain('<span class="pill">B</span>');
});

test('every spell whose blurb has a Combat part has a row with its combat, and its rulebook row the C pill', () => {
  const withCombat = Object.keys(SPELL_DEFS_P).filter((name) => theCombatOf(name) !== null);
  expect(withCombat.sort()).toEqual(COMBAT_ROWS.map((row) => row.name).sort());
  for (const row of COMBAT_ROWS)
    expect(theRulebooksRowOf(row.name), `${row.name}'s rulebook row`).toContain('<span class="pill">C</span>');
});

test('a half of a range is matched beside its other half, and not inside another number', () => {
  expect(asTheTextsWriteIt({ value: 1, theTextsWriteIt: 'the least of a range' })).toEqual(['1–']);
  expect(asTheTextsWriteIt({ value: 3, theTextsWriteIt: 'the most of a range' })).toEqual(['–3']);
  expect(states('deals 1–3 damage', ['1–']) && states('deals 1–3 damage', ['–3'])).toBe(true);
  expect(states('deals 11–3 damage', ['1–']) || states('deals 1–30 damage', ['–3'])).toBe(false);
  expect(asTheTextsWriteIt({ value: 1.5, theTextsWriteIt: 'a multiplier, as a figure' })).toEqual([
    '×1.5',
    'half as much again',
  ]);
  expect(states('+12% to hit', ['2%'])).toBe(false);
});

test('the rows with no number are the ones listed', () => {
  expect(
    ROWS.filter((row) => !row.numbers.length)
      .map((row) => row.slug)
      .sort(),
  ).toEqual(Object.keys(ROWS_WITH_NO_NUMBER).sort());
});

test('the rows with no combat number are the ones listed', () => {
  expect(
    COMBAT_ROWS.filter((row) => !row.numbers.length)
      .map((row) => row.slug)
      .sort(),
  ).toEqual(Object.keys(ROWS_WITH_NO_COMBAT_NUMBER).sort());
});

test('a divisor of 2 is matched as "halve", "halved" or "halves", whole', () => {
  expect(asTheTextsWriteIt({ value: 2, theTextsWriteIt: 'a divisor, in words' })).toEqual([
    'halve',
    'halved',
    'halves',
  ]);
  expect(states('halve (round down) the best', ['halve'])).toBe(true);
  expect(states('it halved', ['halve']) || states('behalves', ['halves'])).toBe(false);
});
