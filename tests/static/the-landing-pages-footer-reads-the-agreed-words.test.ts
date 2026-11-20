// The landing page's footer reads the agreed words. Moved from the old script tests/landing-footer.test.js
// (P1-14z), as it was.
// Level 0 (static): it reads the built site/index.html (or $KC_SITE's) into jsdom's document, to read the footer's
// text as a browser would; none of the page's code runs (jsdom runs no script unless asked).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { expect, test } from 'vitest';
import { SITE } from '../lib/boot.ts';

/** The part of jsdom this test uses (jsdom ships no types, and @types/jsdom isn't installed). */
interface TheJsdomPackageAsThisTestUsesIt {
  JSDOM: new (html: string) => { window: { document: Document } };
}
// `as`: require() gives no type, and jsdom ships none; the type is the part of jsdom used here.
const { JSDOM } = createRequire(import.meta.url)('jsdom') as TheJsdomPackageAsThisTestUsesIt;

const THE_AGREED_WORDS = 'Kingdoms Call · A Strategy Game of Simultaneous Turns';

test(`the landing page's footer reads "${THE_AGREED_WORDS}"`, () => {
  const doc = new JSDOM(fs.readFileSync(path.join(SITE, 'index.html'), 'utf8')).window.document;
  expect(doc.querySelector('footer')?.textContent.trim() ?? '(no footer)').toBe(THE_AGREED_WORDS);
});
