// Each discovery's numbers are in its text (plan P1-19's discoveries family, Decision 2 and its row P1-19aa's tests: a
// discovery's numbers stay in its row of SAGE_DISCOVERIES_P, which the registry's effects read, so the text a player
// reads, its `desc`, is checked against them). For every effect of every discovery (`effect` and `effect2`), each number
// of the fields that hold its size (`pct`, `bonus`, `delta`, `amount`, `cap`, `factor`, `mult`, `hp`, `extra`, `gold`,
// `turns`, `max`, `rate`) is stated in the desc, whole (no digit or decimal point just before it, nor a digit or a
// decimal part just after: a unit may follow, `1g`, `75%`; a word, no letter either side), in one of the forms a text
// writes it (the scoping's rule): the number as it is (`0.05`, `3`, a `pct` of 75 as `75%`, 0.2 as `0.20`), as a
// percentage (0.05 as `5%`), a whole number to ten in words (2 as "two"), and a multiplier (`mult`, `factor`) also as
// `×1.2`, as the share it adds or takes off (1.2 as `20%`, 0.8 as `20%`), or as "half", "double" or "twice". So a
// number changed in content, and not in its text, turns this red, and so does a text changed alone. A form is a number,
// not its meaning: a number the text states for another reason passes too (an upkeep row's unread `max` of 1 is found in
// its `1g`). The known gaps are listed by name, each with why (a Parked entry where the code is at fault), and checked
// to be still gaps, so the exception leaves with the fix. The kinds' own numbers (the registry's ceilings) are in no
// text: the rulebook keeps the discoveries secret by design.
// Level 0 (static): the content's discoveries are a file; nothing of the engine runs.
import { describe, expect, test } from 'vitest';
import { SAGE_DISCOVERIES_P } from '../../src/content/kingdoms-call-data.ts';

/** The fields of an effect that hold its size. */
const THE_SIZES = [
  'pct',
  'bonus',
  'delta',
  'amount',
  'cap',
  'factor',
  'mult',
  'hp',
  'extra',
  'gold',
  'turns',
  'max',
  'rate',
] as const;
const THE_NUMBERS_IN_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const DEAD_PATHS = 'Parked "Three dead paths in `discoveries.ts`": the row\'s own `max` is never read';
/** The numbers a text doesn't state, by the discovery's id and the effect's field, each with why. */
const KNOWN_GAPS: Readonly<Record<string, string>> = {
  'sd12 interest.max': DEAD_PATHS,
  'sd38 heroWageCap.max': DEAD_PATHS,
  'az08 graveDecay.rate': 'a rate of 0 is written "never rot away"',
};

/** The forms a text may write a number of the field in. */
function theFormsOf(field: string, value: number): string[] {
  const a = Math.abs(value);
  const forms = [String(a), `${String(+(a * 100).toFixed(2))}%`];
  if (!Number.isInteger(a)) forms.push(a.toFixed(2));
  if (field === 'mult' || field === 'factor') {
    forms.push(`${String(+((a - 1) * 100).toFixed(2))}%`, `${String(+((1 - a) * 100).toFixed(2))}%`, `×${String(a)}`);
    if (a === 0.5) forms.push('half');
    if (a === 2) forms.push('double', 'twice');
  }
  const inWords = Number.isInteger(a) ? THE_NUMBERS_IN_WORDS[a] : undefined;
  if (inWords !== undefined) forms.push(inWords);
  return forms;
}

/** Whether the text states the form whole: no digit or decimal point just before it, nor a digit or a decimal part
 *  just after (a unit may follow: `1g`, `75%`); a form in words, no letter either side. */
function statesWhole(text: string, form: string): boolean {
  const lower = text.toLowerCase();
  const f = form.toLowerCase();
  const inWords = /^[a-z]+$/.test(f);
  for (let at = lower.indexOf(f); at >= 0; at = lower.indexOf(f, at + 1)) {
    const before = lower.slice(Math.max(0, at - 1), at);
    const after = lower.slice(at + f.length, at + f.length + 2);
    if (/[0-9.]/.test(before) || /^[0-9]/.test(after) || /^\.[0-9]/.test(after)) continue;
    if (inWords && (/[a-z]/.test(before) || /^[a-z]/.test(after))) continue;
    return true;
  }
  return false;
}

/** Each number of each effect, as `<id> <kind>.<field>`, with the discovery's text and whether the text states it. */
const THE_NUMBERS = SAGE_DISCOVERIES_P.flatMap((d) =>
  [d.effect, 'effect2' in d ? d.effect2 : undefined].flatMap((effect) => {
    if (!effect) return [];
    const sizes: Readonly<Record<string, unknown>> = effect;
    return THE_SIZES.flatMap((field) => {
      const value = sizes[field];
      if (typeof value !== 'number') return [];
      const stated = theFormsOf(field, value).some((form) => statesWhole(d.desc, form));
      return [{ key: `${d.id} ${effect.kind}.${field}`, value, desc: d.desc, stated }];
    });
  }),
);

describe("each discovery's numbers are in its text", () => {
  test('the numbers read: every effect of the 296 discoveries, 368 numbers', () => {
    expect(SAGE_DISCOVERIES_P.length).toBe(296);
    expect(THE_NUMBERS.length).toBe(368);
  });

  test.for(THE_NUMBERS.filter((n) => !(n.key in KNOWN_GAPS)))('%s is in its text', (n) => {
    expect(n.stated, `${n.key} = ${String(n.value)}: ${n.desc}`).toBe(true);
  });

  test.for(Object.entries(KNOWN_GAPS))('%s is a known gap (%s), still not in its text', ([key]) => {
    const n = THE_NUMBERS.find((x) => x.key === key);
    expect(n, `${key} is a number of an effect`).toBeDefined();
    expect(n?.stated, `${key}: ${n?.desc ?? ''}`).toBe(false);
  });
});

// The check finds what it should: a number stated whole in each form, and none that only looks like it.
test.for([
  ['pct', 0.05, 'Recruits have a 5% chance.', true],
  ['pct', 0.05, 'Recruits have a 15% chance.', false],
  ['pct', 0.05, 'Recruits have a 5.5% chance.', false],
  ['pct', 75, 'unify +75% more readily', true],
  ['delta', -1, 'cost 1g less upkeep', true],
  ['delta', 0.05, 'reduced by ×0.05 (e.g. ×1.25 becomes ×1.20)', true],
  ['delta', 0.05, 'reduced by ×0.055', false],
  ['delta', 0.2, 'reduced by ×0.20', true],
  ['hp', 3, '+3 maximum HP', true],
  ['hp', 3, '+30 maximum HP', false],
  ['turns', 2, 'for two more turns', true],
  ['turns', 2, 'for twofold turns', false],
  ['mult', 1.2, 'explores 20% more', true],
  ['mult', 0.5, 'costs half as much', true],
  ['factor', 0.5, 'costs halfway', false],
] as const)('a %s of %s in "%s" is stated: %s', ([field, value, text, stated]) => {
  expect(theFormsOf(field, value).some((form) => statesWhole(text, form))).toBe(stated);
});
