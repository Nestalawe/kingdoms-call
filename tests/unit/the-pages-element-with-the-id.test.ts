// The page's element with an id, of the kind asked for (src/ui/shared/the-pages-element-with-the-id.ts; plan P1-16, Open
// choice 2): the one way a page's typed code reads an element it always holds.
// - an element of the kind asked for is handed back, the same element (an input as an input, any element as HTMLElement);
// - no element with the id throws a TypeError naming the id, as a property read on getElementById's null threw a TypeError;
// - an element of another kind (a <div> asked for as an input) throws a TypeError naming the id and the tag it holds.
// Level 1 (unit): the function called on a document jsdom builds from a few elements; no page's code runs (a page test
// would boot a page to reach a lookup each of its handlers makes).
import { expect, test } from 'vitest';
import { bootJsdom } from '../lib/boot.js';
import { theElementWithTheId } from '../../src/ui/shared/the-pages-element-with-the-id.ts';

const { window } = bootJsdom(
  '<!doctype html><html><body><input id="po-target-7-1" value="3"><div id="spinner">Loading</div></body></html>',
);
const page = window['document'] as Document;
const TheInput = window['HTMLInputElement'] as typeof HTMLInputElement;
const TheElement = window['HTMLElement'] as typeof HTMLElement;

test('an element of the kind asked for is handed back, the same element', () => {
  const field = theElementWithTheId('po-target-7-1', TheInput, page);
  expect(field).toBe(page.getElementById('po-target-7-1'));
  expect(field.value).toBe('3');
  expect(theElementWithTheId('spinner', TheElement, page)).toBe(page.getElementById('spinner'));
  expect(theElementWithTheId('po-target-7-1', TheElement, page)).toBe(field);
});

test('no element with the id throws a TypeError naming the id', () => {
  expect(() => theElementWithTheId('ep-preschool-9', TheElement, page)).toThrow(TypeError);
  expect(() => theElementWithTheId('ep-preschool-9', TheElement, page)).toThrow(
    'the page holds no element with the id "ep-preschool-9"',
  );
});

test('an element of another kind throws a TypeError naming the id and its tag', () => {
  expect(() => theElementWithTheId('spinner', TheInput, page)).toThrow(TypeError);
  expect(() => theElementWithTheId('spinner', TheInput, page)).toThrow(
    `the page's element with the id "spinner" is a <div>, not of the kind asked for`,
  );
});
