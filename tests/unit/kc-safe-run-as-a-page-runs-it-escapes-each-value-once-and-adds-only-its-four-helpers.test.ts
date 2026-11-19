// kc-safe.ts, the one way a page builds HTML from data (P0-19), run on its own as a classic script, as a page once
// loaded it: tests/lib/source.ts's scriptOf takes off its `export`s and types. Moved from the old script
// tests/kc-safe.test.js (P1-14z); the checks unit/kc-safe-shows-each-kind-of-value-a-page-hands.test.ts already makes on
// the module (null, undefined, 0 and false; kcEsc's answer a plain string; kcRaw on markup and null) are not repeated.
// Level 1 (unit): the file run in a fresh vm context and in jsdom, with no page around it. Static can't: it runs code.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// - only the four helpers (kcArg, kcEsc, kcHtml, kcRaw) are added to the page's scope, and the class behind them is a
//   top-level name of its own (KcSafeHtml);
// - kcEsc: the five characters that matter in HTML text and quoted attributes, and nothing else (an & that looks like
//   an entity too);
// - kcHtml: a value written to break out of an attribute stays text; a template with no values is itself; lists are
//   their items in order, with no commas, mixing text, kcHtml and kcRaw; nesting never escapes twice; it returns a
//   marked value, which + turns into a plain string;
// - in jsdom: the result goes into innerHTML as markup and a value with markup in it comes out as text, in the text and
//   in an attribute, and no element is made from a value; kcArg: a value inside an on…="…" handler reaches the handler
//   exactly as given (quotes, backslashes and newlines included), keeping its type; no value runs as code.
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { beforeAll, describe, expect, test } from 'vitest';
import type * as KcSafe from '../../src/ui/shared/kc-safe.ts';
import { scriptOf } from '../lib/source.ts';

type TheFourHelpers = Pick<typeof KcSafe, 'kcEsc' | 'kcHtml' | 'kcRaw' | 'kcArg'>;

const SOURCE = scriptOf('ui/shared/kc-safe.ts');

/** The file run in a fresh context: the names it added to the context, and its four helpers. */
function theFileRunOnItsOwn(): { context: vm.Context; added: string[]; helpers: TheFourHelpers } {
  const context = vm.createContext({});
  const before = new Set(Object.getOwnPropertyNames(context));
  vm.runInContext(SOURCE, context);
  // `as`: the four names the file defines, read back from the context it ran in.
  const helpers = vm.runInContext('({kcEsc,kcHtml,kcRaw,kcArg})', context) as TheFourHelpers;
  const added = Object.getOwnPropertyNames(context)
    .filter((n) => !before.has(n))
    .sort();
  return { context, added, helpers };
}

const { context, added, helpers } = theFileRunOnItsOwn();
const { kcEsc, kcHtml, kcRaw } = helpers;

describe('kc-safe.ts run on its own, as a classic script', () => {
  test('adds only kcArg, kcEsc, kcHtml and kcRaw as properties of the page', () => {
    expect(added.join(',')).toBe('kcArg,kcEsc,kcHtml,kcRaw');
  });

  test('the marked-value class is a top-level name of its own (KcSafeHtml)', () => {
    expect(vm.runInContext('typeof KcSafeHtml', context)).toBe('function');
  });
});

describe('kcEsc', () => {
  test(`escapes < > & " and '`, () => {
    expect(kcEsc(`<a href="x" title='y'>Tom & Jerry</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;',
    );
  });

  test('leaves everything else alone (curly quotes, accents, backticks, ${})', () => {
    expect(kcEsc('Ser Brann’s Keep · Élodie of Vær — `tick` ${x}')).toBe(
      'Ser Brann’s Keep · Élodie of Vær — `tick` ${x}',
    );
  });

  test('escapes an & that already looks like an entity (a name is text, not markup)', () => {
    expect(kcEsc('&amp;')).toBe('&amp;amp;');
  });
});

describe('kcHtml', () => {
  test('escapes every value, in text and in attributes', () => {
    const name = '"><img src=x onerror="window.__kcPwned=1">';
    expect(String(kcHtml`<td title="${name}">${name}</td>`)).toBe(
      '<td title="&quot;&gt;&lt;img src=x onerror=&quot;window.__kcPwned=1&quot;&gt;">&quot;&gt;&lt;img src=x onerror=&quot;window.__kcPwned=1&quot;&gt;</td>',
    );
  });

  test('numbers show as themselves', () => {
    expect(String(kcHtml`<i>${3}·${0}</i>`)).toBe('<i>3·0</i>');
  });

  test('a template with no values is itself', () => {
    expect(String(kcHtml`no values`)).toBe('no values');
  });

  test('a nested kcHtml is markup, not escaped again', () => {
    const inner = kcHtml`<span class="pill">${'A & B'}</span>`;
    expect(String(kcHtml`<td>${inner}</td>`)).toBe('<td><span class="pill">A &amp; B</span></td>');
  });

  test('a list of kcHtml is its items, in order, with no commas', () => {
    expect(String(kcHtml`<ul>${['<x>', 'y'].map((v) => kcHtml`<li>${v}</li>`)}</ul>`)).toBe(
      '<ul><li>&lt;x&gt;</li><li>y</li></ul>',
    );
  });

  test('a list may mix text, kcHtml, kcRaw and lists: text is escaped, the rest is markup', () => {
    expect(String(kcHtml`<p>${['<a>', kcHtml`<br>`, [kcRaw('<hr>'), '&']]}</p>`)).toBe('<p>&lt;a&gt;<br><hr>&amp;</p>');
  });

  test('an empty list shows as nothing', () => {
    expect(String(kcHtml`<p>${[]}</p>`)).toBe('<p></p>');
  });

  test('returns a marked value, not a plain string; + turns it into a plain string (why pages never join kcHtml with +)', () => {
    expect(typeof kcHtml`a`).toBe('object');
    // The + is run in the file's own context, as a page's code would write it.
    expect(vm.runInContext("typeof (kcHtml`a`+'')", context)).toBe('string');
  });

  test('nesting three deep escapes the value exactly once', () => {
    expect(String(kcHtml`<i>${kcHtml`${kcHtml`${'<'}`}`}</i>`)).toBe('<i>&lt;</i>');
  });
});

// ── in a page: innerHTML, attributes and handlers ──

/** The page's window, as this test uses it. */
interface ThePagesWindow {
  eval(code: string): unknown;
  document: Document;
  take: (...args: unknown[]) => void;
  __got: unknown[][];
  __kcPwned?: unknown;
  close(): void;
}
/** The part of jsdom this test uses (jsdom ships no types, and @types/jsdom isn't installed). */
interface TheJsdomPackageAsThisTestUsesIt {
  JSDOM: new (html: string, options: { runScripts: 'dangerously' }) => { window: ThePagesWindow };
}
// `as`: require() gives no type, and jsdom ships none; the type is the part of jsdom used here.
const { JSDOM } = createRequire(import.meta.url)('jsdom') as TheJsdomPackageAsThisTestUsesIt;

/** An element of the page, by its id. */
function theElement(w: ThePagesWindow, id: string): HTMLElement {
  const found = w.document.getElementById(id);
  if (found === null) throw new Error(`no element #${id} in the page`);
  return found;
}

const TRICKY = [
  'O\'Rourke "the Bold" & <Sons>',
  "');window.__kcPwned=1;//",
  '`${window.__kcPwned=1}`',
  '\\" onmouseover=x ',
  '</script><script>window.__kcPwned=1</script>',
  'line\nbreak',
  ' trailing  spaces ',
];

/** What a page sees when kc-safe.ts runs in it and builds its HTML from the tricky values, buttons clicked. */
function whatAPageSees() {
  const w = new JSDOM('<!DOCTYPE html><body><div id="box"></div></body>', { runScripts: 'dangerously' }).window;
  try {
    w.eval(SOURCE);
    // `as`: the page's own copies of the helpers, which the file defined in it.
    const pageHtml = w.eval('kcHtml') as TheFourHelpers['kcHtml'];
    const pageArg = w.eval('kcArg') as TheFourHelpers['kcArg'];
    const box = theElement(w, 'box');
    w.__got = [];
    w.take = (...a: unknown[]) => w.__got.push(a);
    box.innerHTML = String(
      pageHtml`<div id="t" title="${TRICKY[0]}">${TRICKY[0]}</div>${TRICKY.map((v, i) => pageHtml`<button id="b${i}" onclick="take(${pageArg(v)},${pageArg(i)})">go</button>`)}`,
    );
    const t = theElement(w, 't');
    const textAsGiven = t.textContent;
    const titleAsGiven = t.getAttribute('title');
    const elementsMadeFromValues = w.document.querySelectorAll('img,script').length;
    TRICKY.forEach((_v, i) => {
      theElement(w, `b${String(i)}`).click();
    });
    const gotFromTheButtons = JSON.stringify(w.__got);
    const pwnedByTheButtons = w.__kcPwned;
    box.innerHTML = String(
      pageHtml`<button id="n" onclick="take(${pageArg(undefined)},${pageArg(null)},${pageArg({ a: [1, 'x'] })},${pageArg(true)})">go</button>`,
    );
    w.__got = [];
    theElement(w, 'n').click();
    const gotFromTheTypes = JSON.stringify(w.__got);
    return { textAsGiven, titleAsGiven, elementsMadeFromValues, gotFromTheButtons, pwnedByTheButtons, gotFromTheTypes };
  } finally {
    w.close();
  }
}

describe('in a page (jsdom): innerHTML, attributes and handlers', () => {
  // Built before the tests, not while they are collected: a page that fails here fails these tests only.
  let seen: ReturnType<typeof whatAPageSees>;
  beforeAll(() => {
    seen = whatAPageSees();
  });

  test('a value put in with kcHtml reads back exactly as given', () => {
    expect(seen.textAsGiven).toBe(TRICKY[0]);
  });

  test('and so does a value in an attribute', () => {
    expect(seen.titleAsGiven).toBe(TRICKY[0]);
  });

  test('no element is made from a value', () => {
    expect(seen.elementsMadeFromValues).toBe(0);
  });

  test('a handler given kcArg values receives each one exactly, quotes, backslashes and newlines included', () => {
    expect(seen.gotFromTheButtons).toBe(JSON.stringify(TRICKY.map((v, i) => [v, i])));
  });

  test('no value ran as code', () => {
    expect(seen.pwnedByTheButtons).toBeFalsy();
  });

  test("kcArg keeps a value's type: numbers, booleans, objects; undefined becomes null", () => {
    expect(seen.gotFromTheTypes).toBe('[[null,null,{"a":[1,"x"]},true]]');
  });
});
