// Each guardian perk's number is in its words and the rulebook's table (plan P1-19's guardian perks, Decision 2 and its
// row P1-19ai's tests). The perks' content rows (src/content/guardian-perks-their-kinds-numbers-and-words.ts) hold each
// kind's value at each grade (the decided table), the form of its words and its row in the rulebook's table "Guardian
// perks by grade" (src/kingdoms-call-rules.html). So:
// - every perk of every guardian of MONSTERS_P reads its kind's form with its own number (its `pct`, `amt` or rider's,
//   a share written as a percentage), a school's ward its school, and a second wind the share of his health the items'
//   row says it waits for; a stun ward of 100 reads the full ward's words;
// - each kind's value at each grade is in its row of the rulebook's table, in the cell's form (the full ward, "all");
// - the numbers the code writes are in the rulebook too: the grade's cap ("its grade's own 20% hit cap"), the
//   sustain's fade (the regeneration row's rounds, and its words' "fourth" and "eighth"), a second wind's share.
// So a number changed in content and not in a text, or in a text alone, turns this red. A form is the words, not what
// they mean: question 34 (plan NEXT.md: Parked "A guardian's damage perk is multiplied by a special's weight; its words
// say a flat bonus") was found by reading the code, and its form is listed below with it. Whether each perk carries its
// grade's value is tests/unit/guardian-perks.test.ts's.
// Level 0 (static): the content's guardians and rows, and the rulebook, are files; nothing of the engine runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { MONSTERS_P } from '../../src/content/kingdoms-call-data.ts';
import {
  GUARDIAN_PERKS_THE_REGISTRY_HOLDS,
  THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS,
  type AKindOfGuardianPerk,
} from '../../src/content/guardian-perks-their-kinds-numbers-and-words.ts';
import { MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS } from '../../src/content/magic-item-effects-their-names-numbers-and-words.ts';
import { ROOT } from '../../tools/build.ts';

const ROWS: Readonly<Record<string, AKindOfGuardianPerk>> = GUARDIAN_PERKS_THE_REGISTRY_HOLDS;
const NUMBERS = THE_NUMBERS_THE_CODE_WRITES_FOR_A_GUARDIANS_PERKS;
const GRADES = ['Weak', 'Moderate', 'Powerful', 'Legendary'];
/** The share of his health a second wind waits for, as the items' row writes it (a share, as a percentage). */
const A_SECOND_WINDS_SHARE =
  MAGIC_ITEM_EFFECTS_THE_REGISTRY_HOLDS['second-wind'].numbers.belowThisShareOfHisMaximumHp.value * 100;

/** The forms of words a question for Toby holds, by the kind's slug, with the question: checked to be still the form,
 *  so the exception is seen when the words change. */
const THE_FORMS_A_QUESTION_HOLDS: Readonly<Record<string, { readonly form: string; readonly question: string }>> = {
  'brute-strength': {
    form: '+{N} damage on every blow and special',
    question:
      'question 34 (Parked "A guardian\'s damage perk is multiplied by a special\'s weight; its words say a flat bonus")',
  },
};

/** A perk's effect as MONSTERS_P writes it. */
type Fx = Readonly<Record<string, unknown>>;
/** A perk as this test reads it. */
interface APerk {
  readonly name: string;
  readonly desc: string;
  readonly fx: Fx;
}

/** The row of a perk's kind (its ward, or its rider's key), with its slug, or none. */
function theRowOf(fx: Fx): readonly [slug: string, row: AKindOfGuardianPerk] | undefined {
  const kind = typeof fx['ward'] === 'string' ? fx['ward'] : Object.keys(fx)[0];
  return Object.entries(ROWS).find(([, row]) =>
    'ward' in row.carriedAs ? row.carriedAs.ward === kind : row.carriedAs.rider === kind,
  );
}

/** A perk's number: its ward's `pct` or `amt`, or its rider's. */
function aPerksNumber(fx: Fx, row: AKindOfGuardianPerk): number {
  const n = 'ward' in row.carriedAs ? (fx['pct'] ?? fx['amt']) : fx[row.carriedAs.rider];
  return typeof n === 'number' ? n : NaN;
}

/** A number as a row's words write it. */
function written(n: number, row: AKindOfGuardianPerk): string {
  return String(row.itsNumberIsWritten === 'a share, as a percentage' ? Math.round(n * 100) : n);
}

/** The words a perk of its row should read: the form filled with its number, its school, a second wind's share. */
function theWordsItShouldRead(fx: Fx, row: AKindOfGuardianPerk): string {
  const n = aPerksNumber(fx, row);
  if (n === NUMBERS.aFullWard.value && row.itsWordsAtAFullWard !== undefined) return row.itsWordsAtAFullWard;
  const school = typeof fx['school'] === 'string' ? fx['school'] : '';
  return row.itsWords
    .replaceAll('{N}', written(n, row))
    .replaceAll('{School}', school.charAt(0).toUpperCase() + school.slice(1))
    .replaceAll('{theShareASecondWindWaitsFor}', String(A_SECOND_WINDS_SHARE));
}

/** What a guardian's perks break: each perk with no row, or whose words aren't its row's form with its number. */
function whatAGuardiansPerksBreak(guardianName: string, perks: readonly APerk[]): string[] {
  return perks.flatMap((perk) => {
    const found = theRowOf(perk.fx);
    if (!found) return [`${guardianName}: ${perk.name} has no row (${JSON.stringify(perk.fx)})`];
    const want = theWordsItShouldRead(perk.fx, found[1]);
    return perk.desc === want ? [] : [`${guardianName}: ${perk.name} reads "${perk.desc}", not "${want}"`];
  });
}

const RULEBOOK = fs.readFileSync(path.join(ROOT, 'src', 'kingdoms-call-rules.html'), 'utf8');
/** The rulebook's table "Guardian perks by grade": each row's first cell, with its four grades' cells. */
function theRulebooksTable(html: string): ReadonlyMap<string, readonly string[]> {
  const start = html.indexOf('<caption>Guardian perks by grade</caption>');
  const table = html.slice(start, html.indexOf('</table>', start));
  const rows = new Map<string, readonly string[]>();
  for (const [, cells = ''] of table.matchAll(/<tr><td>(.*?)<\/tr>/g)) {
    const [first = '', ...grades] = cells.split(/<\/td><td[^>]*>/).map((c) => c.replace(/<\/td>$/, ''));
    rows.set(first, grades);
  }
  return rows;
}

/** What a kind's row breaks in the rulebook's table: its row missing, or a grade's cell not its value in the form. */
function whatAKindBreaksInTheRulebook(
  slug: string,
  row: AKindOfGuardianPerk,
  table: ReadonlyMap<string, readonly string[]>,
): string[] {
  const cells = table.get(row.inTheRulebook.row);
  if (!cells) return [`${slug}: the rulebook has no row "${row.inTheRulebook.row}"`];
  return row.theValueAtEachGrade.flatMap((value, i) => {
    const cell = cells[i] ?? '';
    const part = row.inTheRulebook.part === undefined ? cell : (cell.split(' / ')[row.inTheRulebook.part] ?? '');
    const want =
      value === NUMBERS.aFullWard.value
        ? NUMBERS.aFullWard.theRulebookWritesIt
        : row.inTheRulebook.aCellWritesIt.replace('{N}', written(value, row));
    return part === want ? [] : [`${slug} at ${GRADES[i] ?? '?'}: the rulebook writes "${part}", not "${want}"`];
  });
}

const GUARDIANS: readonly { readonly name: string; readonly passives: readonly APerk[] }[] = MONSTERS_P;

test("every guardian's every perk reads its kind's words with its number", () => {
  expect(GUARDIANS.flatMap((m) => m.passives)).toHaveLength(227);
  expect(GUARDIANS.flatMap((m) => whatAGuardiansPerksBreak(m.name, m.passives))).toEqual([]);
});

test("each kind's value at each grade is in its row of the rulebook's table", () => {
  const table = theRulebooksTable(RULEBOOK);
  expect(table.size).toBe(14);
  expect(Object.entries(ROWS).flatMap(([slug, row]) => whatAKindBreaksInTheRulebook(slug, row, table))).toEqual([]);
});

test('the numbers the code writes are in the rulebook and the words', () => {
  const ordinal: Readonly<Record<number, string>> = { 4: 'fourth', 8: 'eighth' };
  const { theRoundsAtFullStrength: full, theRoundsAtHalfStrength: half } = NUMBERS.theSustainsFade;
  expect(RULEBOOK).toContain(
    `every Legendary guardian also carries its grade's own ${String(NUMBERS.theCapOfEachGrade.Legendary)}% hit cap`,
  );
  expect(GUARDIAN_PERKS_THE_REGISTRY_HOLDS.regeneration.inTheRulebook.row).toContain(
    `half after round ${String(full)}, none after round ${String(half)}`,
  );
  expect(GUARDIAN_PERKS_THE_REGISTRY_HOLDS.regeneration.itsWords).toContain(
    `half as fast after the ${ordinal[full] ?? '?'} round, spent after the ${ordinal[half] ?? '?'}`,
  );
  expect(GUARDIAN_PERKS_THE_REGISTRY_HOLDS['a-second-wind'].inTheRulebook.row).toContain(
    `below ${String(A_SECOND_WINDS_SHARE)}% health`,
  );
});

test('the forms a question for Toby holds are still the forms', () => {
  for (const [slug, { form, question }] of Object.entries(THE_FORMS_A_QUESTION_HOLDS))
    expect(ROWS[slug]?.itsWords, `${slug}: ${question}`).toBe(form);
});

// The checks find a fault: a number planted in a perk's words, in a row alone, in the rulebook alone, and a perk of a
// kind no row has.
test('planted, a number in a perk’s words, in a row alone, in the rulebook alone, and a kind with no row, are found', () => {
  const ward = { name: 'Made-up Hide', desc: 'every blow against it deals 3 less', fx: { ward: 'meleeDR', amt: 2 } };
  const school = {
    name: 'Made-up Ward',
    desc: 'Psychic Magic cast at it is −30% to take hold',
    fx: { ward: 'schoolWard', school: 'psychic', pct: 30 },
  };
  const full = { name: 'Made-up Will', desc: 'cannot be stunned, dazed or held', fx: { ward: 'stunWard', pct: 100 } };
  const drain = {
    name: 'Made-up Thirst',
    desc: 'heals 25% of the melee damage it deals (the thirst fades as a fight runs long)',
    fx: { drain: 0.35 },
  };
  const none = { name: 'Made-up Glow', desc: 'glows', fx: { glow: 1 } };
  expect(whatAGuardiansPerksBreak('Made-up Mole', [ward, school, full, drain, none])).toEqual([
    'Made-up Mole: Made-up Hide reads "every blow against it deals 3 less", not "every blow against it deals 2 less"',
    'Made-up Mole: Made-up Thirst reads "heals 25% of the melee damage it deals (the thirst fades as a fight runs long)", not "heals 35% of the melee damage it deals (the thirst fades as a fight runs long)"',
    'Made-up Mole: Made-up Glow has no row ({"glow":1})',
  ]);
  const table = theRulebooksTable(RULEBOOK);
  const aRowPlanted = {
    ...GUARDIAN_PERKS_THE_REGISTRY_HOLDS['a-keen-eye'],
    theValueAtEachGrade: [5, 10, 15, 25] as const,
  };
  expect(whatAKindBreaksInTheRulebook('a-keen-eye', aRowPlanted, table)).toEqual([
    'a-keen-eye at Legendary: the rulebook writes "+20%", not "+25%"',
  ]);
  const aRulebookPlanted = theRulebooksTable(
    RULEBOOK.replace('<td class="num">all</td></tr>', '<td class="num">90%</td></tr>'),
  );
  expect(
    whatAKindBreaksInTheRulebook('a-stun-ward', GUARDIAN_PERKS_THE_REGISTRY_HOLDS['a-stun-ward'], aRulebookPlanted),
  ).toEqual(['a-stun-ward at Legendary: the rulebook writes "90%", not "all"']);
});
