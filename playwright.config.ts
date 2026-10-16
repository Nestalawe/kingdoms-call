// Playwright Test runs the browser specs (tests/browser/*.spec.ts) in Chromium: npx playwright test. The site is
// served from one folder, as deployed, by tests/browser/server.ts: site/, or the copy in $KC_SITE (e.g. a
// deliberately broken one).
//
// The same answer every time, as in vitest.config.mts: Node pinned (tests/setup/global.ts), time zone and locale
// fixed in Node and in the browser, the seed fixed (KC_SEED; the default in tests/setup/fixed.ts), no retries and no
// .only. A failing spec keeps its trace (npx playwright show-trace test-results/…/trace.zip).
import path from 'node:path';
import { defineConfig } from '@playwright/test';
import { DEFAULT_SEED, FIXED } from './tests/setup/fixed.ts';

// Set before the workers start, so they start with them (tests/lib/boot.js reads KC_SEED when it loads).
Object.assign(process.env, FIXED, { KC_SEED: process.env['KC_SEED'] || DEFAULT_SEED });
const PORT = 4173;

export default defineConfig({
  testDir: 'tests/browser',
  globalSetup: './tests/setup/global.ts',
  retries: 0,
  forbidOnly: true,
  fullyParallel: true,
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    browserName: 'chromium',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `${path.join('node_modules', '.bin', 'tsx')} tests/browser/server.ts ${String(PORT)}`,
    url: `http://127.0.0.1:${String(PORT)}/index.html`,
    // Never another server already on the port: it might be serving another copy of the site.
    reuseExistingServer: false,
  },
});
