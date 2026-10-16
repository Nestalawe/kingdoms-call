// Third-party requests (P0-18): every page in site/, served from one folder as deployed and opened in Chromium with
// the real vendored supabase-js (not a stub), asks no other site for anything except Google Fonts. On the pages that
// use the database, the library has loaded (window.supabase.createClient) from the site's own vendor/ folder.
// No database is reached: kc-config.js is answered with an address on the test's own server, which has no database
// there, and every request to another site is refused and recorded. Level 4: only a real browser shows which
// requests a page makes. The static side (the tags in the pages) is vendor-supabase.test.js.
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { SITE } from '../lib/boot.js';

const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const pages = fs
  .readdirSync(SITE)
  .filter((f) => f.endsWith('.html'))
  .sort();
const usesDb = (name: string) => /\bcreateClient\s*\(/.test(fs.readFileSync(`${SITE}/${name}`, 'utf8'));

// Opens the page with every request to another site refused and recorded, and waits until it has asked for all it
// will. Gives what it asked of other sites, the window.supabase.createClient it ended with, and its vendor/ files.
async function open(page: Page, own: string, name: string) {
  const outside: string[] = [];
  const vendor: string[] = [];
  await page.route('**/*', (r) => {
    const url = r.request().url();
    if (url === own + 'kc-config.js')
      return r.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `const KC_CONFIG=Object.freeze({env:'test',supabaseUrl:${JSON.stringify(own + 'no-database')},supabaseKey:'test-key'});`,
      });
    if (url.startsWith(own)) return r.continue();
    if (FONTS.test(url))
      return r.fulfill({ status: 200, contentType: url.includes('googleapis') ? 'text/css' : 'font/woff2', body: '' });
    outside.push(`${r.request().resourceType()} ${url}`);
    return r.abort();
  });
  page.on('response', (res) => {
    if (res.url().startsWith(own + 'vendor/')) vendor.push(`${String(res.status())} /${res.url().slice(own.length)}`);
  });
  await page.goto('/' + name);
  // Whatever the page asks for once it has loaded: no request for half a second. Waiting for that is the check, so
  // eslint-plugin-playwright's no-networkidle is off for this file alone (eslint.config.js).
  await page.waitForLoadState('networkidle');
  const lib = await page.evaluate(
    () => typeof (window as { supabase?: { createClient?: unknown } }).supabase?.createClient,
  );
  return { outside, lib, vendor };
}

for (const name of pages.filter((n) => !usesDb(n))) {
  test(`${name}: no request to another site but Google Fonts`, async ({ page, baseURL }) => {
    const { outside } = await open(page, String(baseURL) + '/', name);
    expect(outside, 'requests to another site').toEqual([]);
  });
}

for (const name of pages.filter(usesDb)) {
  test(`${name}: no request to another site but Google Fonts; supabase-js from vendor/`, async ({ page, baseURL }) => {
    const { outside, lib, vendor } = await open(page, String(baseURL) + '/', name);
    expect.soft(outside, 'requests to another site').toEqual([]);
    expect.soft(lib, "supabase-js didn't load (window.supabase.createClient)").toBe('function');
    expect(
      vendor.some((v) => /^200 \/vendor\/supabase-js-[\d.]+\.min\.js$/.test(v)),
      `supabase-js wasn't served from vendor/ (${vendor.join(', ') || 'no vendor/ request'})`,
    ).toBe(true);
  });
}
