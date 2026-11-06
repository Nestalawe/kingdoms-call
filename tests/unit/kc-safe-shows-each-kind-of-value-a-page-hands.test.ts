// kc-safe.ts's four helpers (src/ui/shared/kc-safe.ts, the one way a page builds HTML) on each kind of value a page
// hands them: a string, a number, null, undefined, an object, a list, a boolean. For each, the text it comes out as:
// - kcEsc: the value as String() writes it, with & < > " ' escaped, and null and undefined as ''; a string's spaces kept;
// - kcRaw: the value as String() writes it, unescaped, null and undefined as ''; the marked value keeps it whole;
// - kcHtml: the template's own text kept whole (its spaces too), each value as kcEsc shows it;
// - kcArg: the value as JSON, escaped, undefined as null.
// Level 1 (unit): the helpers imported as a module and called on plain values; no page runs (tests/kc-safe.test.js
// checks the file as a classic script, and in a page through jsdom; tests/hostile-*.test.js, each page's names).
import { expect, test } from 'vitest';
import { KcSafeHtml, kcArg, kcEsc, kcHtml, kcRaw } from '../../src/ui/shared/kc-safe.ts';

const anObject = { name: '<Ser Brann>' };

test.each([
  ['a string, its spaces kept', '  Ser Brann & <Sons>  ', '  Ser Brann &amp; &lt;Sons&gt;  '],
  ['a number', 3, '3'],
  ['the number 0', 0, '0'],
  ['a fraction', 1.5, '1.5'],
  ['null', null, ''],
  ['undefined', undefined, ''],
  ['an object', anObject, '[object Object]'],
  ['a list', ['<a>', 'b'], '&lt;a&gt;,b'],
  ['false', false, 'false'],
])('kcEsc shows %s as text', (_kind, value, text) => {
  expect(kcEsc(value)).toBe(text);
});

test.each([
  ['a string, its spaces kept', '  <b>bold</b>  ', '  <b>bold</b>  '],
  ['a number', 7, '7'],
  ['the number 0', 0, '0'],
  ['null', null, ''],
  ['undefined', undefined, ''],
  ['an object', anObject, '[object Object]'],
])('kcRaw passes %s through as markup', (_kind, value, markup) => {
  const raw = kcRaw(value);
  expect(raw).toBeInstanceOf(KcSafeHtml);
  expect(String(raw)).toBe(markup);
  expect(String(kcHtml`<td>${raw}</td>`)).toBe(`<td>${markup}</td>`);
});

test.each([
  ['a string', '"A" & <B>', '<td title="&quot;A&quot; &amp; &lt;B&gt;">&quot;A&quot; &amp; &lt;B&gt;</td>'],
  ['a number', 12, '<td title="12">12</td>'],
  ['null', null, '<td title=""></td>'],
  ['undefined', undefined, '<td title=""></td>'],
  ['an object', anObject, '<td title="[object Object]">[object Object]</td>'],
])('kcHtml shows %s as text, in an attribute and in the text', (_kind, value, html) => {
  expect(String(kcHtml`<td title="${value}">${value}</td>`)).toBe(html);
});

test('kcHtml keeps its own text whole, the spaces before, between and after its values too', () => {
  expect(String(kcHtml`  <p> ${'a'} · ${'b'} </p>  `)).toBe('  <p> a · b </p>  ');
});

test.each([
  ['a string', `O'Rourke "the Bold"`, '&quot;O&#39;Rourke \\&quot;the Bold\\&quot;&quot;'],
  ['a number', 12, '12'],
  ['null', null, 'null'],
  ['undefined', undefined, 'null'],
  ['an object', { a: [1, 'x'] }, '{&quot;a&quot;:[1,&quot;x&quot;]}'],
])('kcArg writes %s as an escaped JavaScript value', (_kind, value, text) => {
  const arg = kcArg(value);
  expect(arg).toBeInstanceOf(KcSafeHtml);
  expect(String(arg)).toBe(text);
});
