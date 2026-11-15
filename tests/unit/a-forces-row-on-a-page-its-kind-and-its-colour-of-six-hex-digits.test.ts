// A colour a page writes into a style from a force's row (src/engine/rules-on-plain-values/a-forces-row-on-a-page-its-
// kind-and-its-colour-of-six-hex-digits.ts): a realm's colour as the game deals it, `#rrggbb`, is kept as it is; a value
// of any other form is none, so the page draws the force in its default grey.
// - six hex digits after `#`, in small or capital letters, are kept;
// - three digits, a colour's name, digits that are not hex, more after the six, a number, none and an object are none;
// - every colour the game deals a realm is of the form.
// Level 1 (unit): the function called on plain values; no page runs (the page cases, in tests/page/, show each page
// drawing the default grey from it).
import { expect, test } from 'vitest';
import { REALM_COLOURS, REALM_COLOUR_FALLBACK } from '../../src/engine/bots/intel.ts';
import { aColourOfSixHexDigitsOrNone } from '../../src/engine/rules-on-plain-values/a-forces-row-on-a-page-its-kind-and-its-colour-of-six-hex-digits.ts';

test('a colour of six hex digits is kept as it is', () => {
  expect(['#3366aa', '#A0B1C2', '#000000', '#ffffff'].map(aColourOfSixHexDigitsOrNone)).toEqual([
    '#3366aa',
    '#A0B1C2',
    '#000000',
    '#ffffff',
  ]);
});

test('a value of any other form is none', () => {
  const others: unknown[] = [
    '#a33',
    'red',
    '#12345g',
    '#1x2y3z',
    '#3366aa00',
    ' #3366aa',
    '3366aa',
    '',
    3366,
    null,
    undefined,
    { color: '#3366aa' },
    ['#3366aa'],
  ];
  expect(others.map(aColourOfSixHexDigitsOrNone)).toEqual(others.map(() => null));
});

test('every colour the game deals a realm is of the form', () => {
  const dealt = [...REALM_COLOURS, REALM_COLOUR_FALLBACK];
  expect(dealt.map(aColourOfSixHexDigitsOrNone)).toEqual(dealt);
});
